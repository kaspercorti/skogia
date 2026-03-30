import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export type BankTransaction = {
  id: string;
  user_id: string;
  bank_account_id: string | null;
  date: string;
  amount: number;
  description: string | null;
  reference: string | null;
  transaction_type: string | null;
  direction: string;
  matched_invoice_id: string | null;
  matched_transaction_id: string | null;
  match_status: string;
  match_reason: string | null;
  created_at: string;
};

export type MatchSuggestion = {
  bankTransaction: BankTransaction;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceAmount: number;
  confidence: "high" | "medium";
  reasons: string[];
};

export function useBankTransactions() {
  return useQuery({
    queryKey: ["bank_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as BankTransaction[];
    },
  });
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  amount_inc_vat: number;
  amount_ex_vat: number;
  vat_amount: number;
  due_date: string;
  status: string;
  category: string | null;
  description: string | null;
  property_id: string | null;
  payment_date: string | null;
};

type CustomerRow = { id: string; name: string };

export function useMatchSuggestions(
  bankTransactions: BankTransaction[],
  invoices: InvoiceRow[],
  customers: CustomerRow[]
) {
  return useMemo(() => {
    const unmatchedBt = bankTransactions.filter(
      (bt) => bt.match_status === "unmatched" && bt.direction === "in" && bt.amount > 0
    );

    const openInvoices = invoices.filter(
      (inv) => inv.status === "unpaid" || inv.status === "overdue"
    );

    const suggestions: MatchSuggestion[] = [];

    for (const bt of unmatchedBt) {
      for (const inv of openInvoices) {
        const reasons: string[] = [];
        let score = 0;

        // Exact amount match
        if (Math.abs(bt.amount - inv.amount_inc_vat) < 0.01) {
          score += 50;
          reasons.push("Samma belopp");
        } else {
          continue; // Amount must match at minimum
        }

        // Invoice number in description or reference
        const text = `${bt.description || ""} ${bt.reference || ""}`.toLowerCase();
        if (text.includes(inv.invoice_number.toLowerCase())) {
          score += 30;
          reasons.push("Fakturanummer i beskrivning");
        }

        // Customer name in description
        const customer = customers.find((c) => c.id === inv.customer_id);
        if (customer && text.includes(customer.name.toLowerCase())) {
          score += 20;
          reasons.push("Kundnamn i beskrivning");
        }

        // Date proximity to due_date
        const btDate = new Date(bt.date).getTime();
        const dueDate = new Date(inv.due_date).getTime();
        const daysDiff = Math.abs(btDate - dueDate) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 7) {
          score += 10;
          reasons.push("Nära förfallodatum");
        }

        if (score >= 50) {
          const confidence = score >= 70 ? "high" : "medium";
          suggestions.push({
            bankTransaction: bt,
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            customerName: customer?.name || "—",
            invoiceAmount: inv.amount_inc_vat,
            confidence,
            reasons,
          });
        }
      }
    }

    // Sort by confidence (high first), then by score implicitly
    suggestions.sort((a, b) => (a.confidence === "high" ? -1 : 1) - (b.confidence === "high" ? -1 : 1));

    return suggestions;
  }, [bankTransactions, invoices, customers]);
}

export function useBankMatchingActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
  };

  const confirmMatch = async (
    bankTx: BankTransaction,
    invoice: InvoiceRow
  ) => {
    if (!user) return;

    // Prevent double match
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("invoice_id", invoice.id)
      .limit(1);
    if (existingTx && existingTx.length > 0) {
      toast.error("Transaktion finns redan för denna faktura");
      return;
    }

    const payDate = bankTx.date;

    // 1. Update invoice to paid
    const { error: invErr } = await supabase
      .from("invoices")
      .update({ status: "paid", payment_date: payDate } as any)
      .eq("id", invoice.id);
    if (invErr) {
      toast.error("Kunde inte uppdatera faktura: " + invErr.message);
      return;
    }

    // 2. Create transaction linked to both invoice and bank_transaction
    const { data: newTx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        date: payDate,
        type: "income",
        category: invoice.category || "virkesförsäljning",
        description: `Betald faktura #${invoice.invoice_number}${invoice.description ? " – " + invoice.description : ""}`,
        amount: invoice.amount_ex_vat,
        vat_amount: invoice.vat_amount,
        invoice_id: invoice.id,
        property_id: invoice.property_id,
        payment_method: "bank",
        status: "booked",
        bank_transaction_id: bankTx.id,
      } as any)
      .select("id")
      .single();

    if (txErr) {
      toast.error("Kunde inte skapa transaktion: " + txErr.message);
      invalidateAll();
      return;
    }

    // 3. Update bank_transaction to matched
    await supabase
      .from("bank_transactions")
      .update({
        match_status: "matched",
        matched_invoice_id: invoice.id,
        matched_transaction_id: newTx?.id || null,
      } as any)
      .eq("id", bankTx.id);

    invalidateAll();
    toast.success(`Faktura #${invoice.invoice_number} matchad och markerad som betald`);
  };

  const dismissSuggestion = async (bankTxId: string) => {
    // Just keep it unmatched, user dismissed the suggestion
    toast.info("Förslag avvisat");
  };

  const addBankTransaction = async (data: {
    bank_account_id: string;
    date: string;
    amount: number;
    description: string;
    reference: string;
    direction: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from("bank_transactions").insert({
      user_id: user.id,
      ...data,
      match_status: "unmatched",
    } as any);
    if (error) {
      toast.error("Kunde inte spara: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["bank_transactions"] });
    toast.success("Banktransaktion tillagd");
  };

  return { confirmMatch, dismissSuggestion, addBankTransaction };
}
