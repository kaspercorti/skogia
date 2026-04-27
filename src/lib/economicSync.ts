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
