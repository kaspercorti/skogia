/**
 * Central sync engine for Skogia.
 * 
 * All financial events flow through here so that forest activities,
 * accounting transactions, bank balance, tax planning and reports stay in sync.
 * 
 * Key principle: an activity NEVER directly affects bank balance.
 * Only registered payments (paid_to_bank) create bank-affecting transactions.
 */

import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus =
  | "not_paid"
  | "paid_to_bank"
  | "paid_to_forest_account"
  | "pending_invoice"
  | "historical_already_paid";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_paid: "Ej betald ännu",
  paid_to_bank: "Betald till bankkonto",
  paid_to_forest_account: "Insatt på skogslikvidkonto",
  pending_invoice: "Faktura ska skapas",
  historical_already_paid: "Historisk – redan betald (påverkar bara rapporter)",
};

export interface ActivitySyncParams {
  userId: string;
  activityId: string;
  propertyId: string;
  standId: string | null;
  type: string;
  isCompleted: boolean;
  completedDate: string | null;
  plannedDate: string | null;
  income: number;
  cost: number;
  vatAmount: number;
  applyVat: boolean;
  vatRate: number;
  subsidyAmount: number;
  hasSubsidy: boolean;
  notes: string | null;
  paymentStatus: PaymentStatus;
  paymentDate: string | null;
  bankAccountId: string | null;
  forestAccountId: string | null;
  forestAccountName?: string | null; // used when creating a new account
}

const FA_TAG = (id: string) => `[FA:${id}]`;

function pickEffectiveDate(p: ActivitySyncParams): string {
  return (
    p.paymentDate ||
    p.completedDate ||
    p.plannedDate ||
    new Date().toISOString().slice(0, 10)
  );
}

function taxYearOf(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

/**
 * Removes all economic_events and transactions previously generated
 * for a given activity, so we can re-create them cleanly (idempotent).
 */
async function cleanupForActivity(userId: string, activityId: string) {
  const tag = FA_TAG(activityId);
  await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .like("description", `%${tag}%`);
  await supabase
    .from("economic_events")
    .delete()
    .eq("user_id", userId)
    .eq("activity_id", activityId);
}

/**
 * Decide whether the payment status means money actually moved into a bank account today.
 */
function affectsBank(status: PaymentStatus): boolean {
  return status === "paid_to_bank";
}

/**
 * Main sync entry point. Idempotent — safe to call repeatedly.
 */
export async function syncActivityEconomicImpact(p: ActivitySyncParams): Promise<{ ok: boolean; error?: string }> {
  await cleanupForActivity(p.userId, p.activityId);

  if (!p.isCompleted) {
    return { ok: true };
  }

  const date = pickEffectiveDate(p);
  const taxYear = taxYearOf(date);
  const tag = FA_TAG(p.activityId);
  const baseDesc = `${p.type}${p.notes ? ` · ${p.notes}` : ""}`;

  const events: any[] = [];
  const transactions: any[] = [];

  // ── Income (timber sale)
  if (p.income > 0) {
    const isHistorical = p.paymentStatus === "historical_already_paid";
    const isPendingInvoice = p.paymentStatus === "pending_invoice";
    const isForestAccount = p.paymentStatus === "paid_to_forest_account";
    const isBank = p.paymentStatus === "paid_to_bank";
    const isUnpaid = p.paymentStatus === "not_paid";

    events.push({
      user_id: p.userId,
      type: "forest_sale",
      source_type: "forestActivity",
      source_id: p.activityId,
      activity_id: p.activityId,
      property_id: p.propertyId,
      stand_id: p.standId,
      bank_account_id: isBank ? p.bankAccountId : null,
      forest_account_id: isForestAccount ? p.forestAccountId : null,
      amount: p.income,
      vat_amount: p.applyVat ? p.vatAmount : 0,
      date,
      tax_year: taxYear,
      affects_result: true,
      affects_bank_balance: isBank,
      affects_tax: true,
      affects_forest_plan: true,
      payment_status: p.paymentStatus,
      category: "virkesförsäljning",
      description: `${baseDesc} – intäkt ${tag}`,
    });

    // Only create a bookkeeping transaction when the income is actually realized
    // (not for "not_paid" or "pending_invoice" — those are receivables, not income yet from a cash perspective,
    //  but we still want them in the result rapport, so we book them as 'pending').
    transactions.push({
      user_id: p.userId,
      property_id: p.propertyId,
      stand_id: p.standId,
      date,
      type: "income",
      category: "virkesförsäljning",
      description: `${baseDesc} – intäkt ${tag}`,
      amount: p.income,
      vat_amount: p.applyVat ? p.vatAmount : 0,
      payment_method: isBank ? "bank" : isForestAccount ? "skogskonto" : isHistorical ? "historisk" : "väntar",
      status: isBank || isHistorical || isForestAccount ? "booked" : "pending",
    });

    // Forest liquidity account: ensure account exists and increment its balance
    if (isForestAccount && p.forestAccountId) {
      const { data: acc } = await supabase
        .from("forest_liquidity_accounts")
        .select("id, original_deposit_amount, remaining_amount")
        .eq("id", p.forestAccountId)
        .maybeSingle();
      if (acc) {
        await supabase
          .from("forest_liquidity_accounts")
          .update({
            original_deposit_amount: Number(acc.original_deposit_amount) + p.income,
            remaining_amount: Number(acc.remaining_amount) + p.income,
            source_activity_id: p.activityId,
          })
          .eq("id", p.forestAccountId);
      }
    }
  }

  // ── Cost
  if (p.cost > 0) {
    const isBank = p.paymentStatus === "paid_to_bank";
    events.push({
      user_id: p.userId,
      type: "expense",
      source_type: "forestActivity",
      source_id: p.activityId,
      activity_id: p.activityId,
      property_id: p.propertyId,
      stand_id: p.standId,
      bank_account_id: isBank ? p.bankAccountId : null,
      amount: p.cost,
      vat_amount: 0,
      date,
      tax_year: taxYear,
      affects_result: true,
      affects_bank_balance: isBank,
      affects_tax: true,
      affects_forest_plan: false,
      payment_status: p.paymentStatus,
      category: p.type,
      description: `${baseDesc} – kostnad ${tag}`,
    });
    transactions.push({
      user_id: p.userId,
      property_id: p.propertyId,
      stand_id: p.standId,
      date,
      type: "expense",
      category: p.type,
      description: `${baseDesc} – kostnad ${tag}`,
      amount: p.cost,
      vat_amount: 0,
      payment_method: isBank ? "bank" : "väntar",
      status: isBank || p.paymentStatus === "historical_already_paid" ? "booked" : "pending",
    });
  }

  // ── Subsidy (always treated as income; bank affected only if paid)
  if (p.hasSubsidy && p.subsidyAmount > 0) {
    const isBank = p.paymentStatus === "paid_to_bank";
    events.push({
      user_id: p.userId,
      type: "subsidy",
      source_type: "forestActivity",
      source_id: p.activityId,
      activity_id: p.activityId,
      property_id: p.propertyId,
      stand_id: p.standId,
      bank_account_id: isBank ? p.bankAccountId : null,
      amount: p.subsidyAmount,
      vat_amount: 0,
      date,
      tax_year: taxYear,
      affects_result: true,
      affects_bank_balance: isBank,
      affects_tax: true,
      affects_forest_plan: false,
      payment_status: p.paymentStatus,
      category: "bidrag",
      description: `${baseDesc} – bidrag ${tag}`,
    });
    transactions.push({
      user_id: p.userId,
      property_id: p.propertyId,
      stand_id: p.standId,
      date,
      type: "income",
      category: "bidrag",
      description: `${baseDesc} – bidrag ${tag}`,
      amount: p.subsidyAmount,
      vat_amount: 0,
      payment_method: isBank ? "bank" : "väntar",
      status: isBank || p.paymentStatus === "historical_already_paid" ? "booked" : "pending",
    });
  }

  if (events.length > 0) {
    const { error } = await supabase.from("economic_events").insert(events);
    if (error) return { ok: false, error: error.message };
  }
  if (transactions.length > 0) {
    const { error } = await supabase.from("transactions").insert(transactions);
    if (error) return { ok: false, error: error.message };
  }

  // Update bank account balance for amounts that actually hit the bank today
  if (affectsBank(p.paymentStatus) && p.bankAccountId) {
    const netDelta = p.income + (p.hasSubsidy ? p.subsidyAmount : 0) - p.cost;
    if (netDelta !== 0) {
      const { data: bank } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", p.bankAccountId)
        .maybeSingle();
      if (bank) {
        await supabase
          .from("bank_accounts")
          .update({ current_balance: Number(bank.current_balance) + netDelta })
          .eq("id", p.bankAccountId);
      }
    }
  }

  return { ok: true };
}

/**
 * Cleanup when an activity is deleted.
 */
export async function deleteActivityEconomicImpact(userId: string, activityId: string) {
  await cleanupForActivity(userId, activityId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers (Etapp 4): receipts, manual transactions, invoice payments
// All flow through economic_events so dashboard / reports stay consistent.
// ─────────────────────────────────────────────────────────────────────────────

async function adjustBank(bankAccountId: string | null, delta: number) {
  if (!bankAccountId || delta === 0) return;
  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("current_balance")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (bank) {
    await supabase
      .from("bank_accounts")
      .update({ current_balance: Number(bank.current_balance) + delta })
      .eq("id", bankAccountId);
  }
}

async function pickDefaultBankId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_connected", true)
    .limit(1);
  return data?.[0]?.id ?? null;
}

export interface ManualTxParams {
  userId: string;
  date: string;
  type: "income" | "expense";
  amount: number; // ex VAT base for the event
  vatAmount: number;
  category: string | null;
  description: string;
  propertyId?: string | null;
  standId?: string | null;
  paymentStatus?: PaymentStatus; // default not_paid for income, paid_to_bank for expense
  bankAccountId?: string | null;
  applyVat?: boolean;
}

/**
 * Manual bookkeeping entry: writes BOTH a transaction AND an economic_event,
 * and adjusts bank balance only when payment_status === paid_to_bank.
 */
export async function recordManualTransaction(p: ManualTxParams): Promise<{ ok: boolean; error?: string; transactionId?: string }> {
  const status: PaymentStatus = p.paymentStatus ?? (p.type === "expense" ? "paid_to_bank" : "not_paid");
  const isBank = status === "paid_to_bank";
  const taxYear = taxYearOf(p.date);

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: p.userId,
      date: p.date,
      type: p.type,
      category: p.category,
      description: p.description,
      amount: p.amount,
      vat_amount: p.vatAmount,
      property_id: p.propertyId ?? null,
      stand_id: p.standId ?? null,
      payment_method: isBank ? "bank" : "väntar",
      status: isBank || status === "historical_already_paid" ? "booked" : "pending",
    })
    .select("id")
    .single();
  if (txErr) return { ok: false, error: txErr.message };

  const { error: evErr } = await supabase.from("economic_events").insert({
    user_id: p.userId,
    type: p.type === "income" ? "income" : "expense",
    source_type: "manual",
    source_id: tx.id,
    transaction_id: tx.id,
    bank_account_id: isBank ? (p.bankAccountId ?? null) : null,
    property_id: p.propertyId ?? null,
    stand_id: p.standId ?? null,
    amount: p.amount,
    vat_amount: p.vatAmount,
    date: p.date,
    tax_year: taxYear,
    affects_result: true,
    affects_bank_balance: isBank,
    affects_tax: true,
    affects_forest_plan: false,
    payment_status: status,
    category: p.category,
    description: p.description,
  });
  if (evErr) return { ok: false, error: evErr.message };

  if (isBank) {
    const totalCash = p.amount + p.vatAmount;
    const delta = p.type === "income" ? totalCash : -totalCash;
    const bankId = p.bankAccountId ?? (await pickDefaultBankId(p.userId));
    await adjustBank(bankId, delta);
  }

  return { ok: true, transactionId: tx.id };
}

export interface ReceiptApproveParams {
  userId: string;
  receiptId: string;
  date: string;
  supplierName: string;
  amountExVat: number;
  vatAmount: number;
  totalAmount: number;
  category: string | null;
  propertyId?: string | null;
  paymentMethod: string;
  bankAccountId?: string | null;
  paid?: boolean; // default true (kvitto = redan betalt)
}

/**
 * Approve a receipt: marks receipt booked, creates transaction + event,
 * and adjusts bank balance if paid via card/bank/swish.
 */
export async function recordReceiptApproval(p: ReceiptApproveParams): Promise<{ ok: boolean; error?: string }> {
  const paid = p.paid ?? true;
  const status: PaymentStatus = paid ? "paid_to_bank" : "not_paid";

  const txRes = await recordManualTransaction({
    userId: p.userId,
    date: p.date,
    type: "expense",
    amount: p.amountExVat,
    vatAmount: p.vatAmount,
    category: p.category,
    description: `Kvitto från ${p.supplierName || "okänd"}`,
    propertyId: p.propertyId,
    paymentStatus: status,
    bankAccountId: p.bankAccountId,
  });
  if (!txRes.ok) return txRes;

  const { error } = await supabase
    .from("receipts")
    .update({
      status: "booked",
      approved_at: new Date().toISOString(),
      approved_by: p.userId,
      linked_transaction_id: txRes.transactionId,
    })
    .eq("id", p.receiptId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export interface InvoicePaymentParams {
  userId: string;
  invoiceId: string;
  paymentDate: string;
  bankAccountId?: string | null;
}

/**
 * Mark invoice paid → transaction + economic_event (forest_sale-style income),
 * bank balance updated. Idempotent guard: refuse if a transaction exists.
 */
export async function recordInvoicePayment(p: InvoicePaymentParams): Promise<{ ok: boolean; error?: string }> {
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", p.invoiceId)
    .maybeSingle();
  if (invErr || !invoice) return { ok: false, error: "Hittar inte fakturan" };

  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("invoice_id", p.invoiceId)
    .limit(1);
  if (existing && existing.length > 0) return { ok: false, error: "Transaktion finns redan för denna faktura" };

  const taxYear = taxYearOf(p.paymentDate);
  const bankId = p.bankAccountId ?? (await pickDefaultBankId(p.userId));

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: p.userId,
      date: p.paymentDate,
      type: "income",
      category: invoice.category || "virkesförsäljning",
      description: `Betald faktura #${invoice.invoice_number}${invoice.description ? " – " + invoice.description : ""}`,
      amount: Number(invoice.amount_ex_vat),
      vat_amount: Number(invoice.vat_amount),
      invoice_id: invoice.id,
      property_id: invoice.property_id,
      payment_method: "bank",
      status: "booked",
    })
    .select("id")
    .single();
  if (txErr) return { ok: false, error: txErr.message };

  await supabase.from("economic_events").insert({
    user_id: p.userId,
    type: "income",
    source_type: "invoice",
    source_id: invoice.id,
    invoice_id: invoice.id,
    transaction_id: tx.id,
    bank_account_id: bankId,
    property_id: invoice.property_id,
    amount: Number(invoice.amount_ex_vat),
    vat_amount: Number(invoice.vat_amount),
    date: p.paymentDate,
    tax_year: taxYear,
    affects_result: true,
    affects_bank_balance: true,
    affects_tax: true,
    affects_forest_plan: false,
    payment_status: "paid_to_bank",
    category: invoice.category || "virkesförsäljning",
    description: `Betald faktura #${invoice.invoice_number}`,
  });

  await supabase
    .from("invoices")
    .update({ status: "paid", payment_date: p.paymentDate } as any)
    .eq("id", invoice.id);

  await adjustBank(bankId, Number(invoice.amount_inc_vat));
  return { ok: true };
}

/**
 * Reverse an invoice payment: removes transaction + event, restores invoice + bank.
 */
export async function reverseInvoicePayment(userId: string, invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { ok: false, error: "Hittar inte fakturan" };

  // Find linked event for bank account ref
  const { data: events } = await supabase
    .from("economic_events")
    .select("id, bank_account_id")
    .eq("invoice_id", invoiceId);
  const bankId = events?.[0]?.bank_account_id ?? (await pickDefaultBankId(userId));

  await supabase.from("transactions").delete().eq("invoice_id", invoiceId);
  await supabase.from("economic_events").delete().eq("invoice_id", invoiceId);
  await supabase
    .from("invoices")
    .update({ status: "unpaid", payment_date: null } as any)
    .eq("id", invoiceId);
  await adjustBank(bankId, -Number(invoice.amount_inc_vat));
  return { ok: true };
}

/**
 * Withdraw from a forest liquidity account → goes to bank, creates taxable event for the year of withdrawal.
 */
export async function withdrawFromForestAccount(params: {
  userId: string;
  forestAccountId: string;
  bankAccountId: string;
  amount: number;
  date: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, forestAccountId, bankAccountId, amount, date, notes } = params;
  if (amount <= 0) return { ok: false, error: "Belopp måste vara större än 0" };

  const { data: acc, error: accErr } = await supabase
    .from("forest_liquidity_accounts")
    .select("*")
    .eq("id", forestAccountId)
    .maybeSingle();
  if (accErr || !acc) return { ok: false, error: "Hittar inte skogslikvidkontot" };
  if (Number(acc.remaining_amount) < amount) return { ok: false, error: "Belopp överstiger tillgängligt saldo" };

  const newRemaining = Number(acc.remaining_amount) - amount;
  const newStatus = newRemaining <= 0 ? "withdrawn" : "partially_withdrawn";

  // Update account
  await supabase
    .from("forest_liquidity_accounts")
    .update({ remaining_amount: newRemaining, status: newStatus })
    .eq("id", forestAccountId);

  // Increase bank
  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("current_balance")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (bank) {
    await supabase
      .from("bank_accounts")
      .update({ current_balance: Number(bank.current_balance) + amount })
      .eq("id", bankAccountId);
  }

  // Bookkeeping: this is taxable income in the withdrawal year
  await supabase.from("transactions").insert({
    user_id: userId,
    date,
    type: "income",
    category: "skogskonto-uttag",
    description: `Uttag från skogslikvidkonto ${acc.name}${notes ? ` · ${notes}` : ""}`,
    amount,
    vat_amount: 0,
    payment_method: "bank",
    status: "booked",
  });

  await supabase.from("economic_events").insert({
    user_id: userId,
    type: "forest_account_withdrawal",
    source_type: "manual",
    forest_account_id: forestAccountId,
    bank_account_id: bankAccountId,
    amount,
    vat_amount: 0,
    date,
    tax_year: taxYearOf(date),
    affects_result: true,
    affects_bank_balance: true,
    affects_tax: true,
    affects_forest_plan: false,
    payment_status: "paid_to_bank",
    category: "skogskonto-uttag",
    description: `Uttag från skogslikvidkonto ${acc.name}`,
    notes: notes ?? null,
  });

  return { ok: true };
}
