import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ForestLiquidityAccount = {
  id: string;
  user_id: string;
  name: string;
  bank_name: string | null;
  account_number_masked: string | null;
  opened_date: string;
  deposit_date: string;
  original_deposit_amount: number;
  remaining_amount: number;
  expiry_date: string;
  source_activity_id: string | null;
  source_transaction_id: string | null;
  status: "active" | "partially_withdrawn" | "withdrawn" | "expired";
  notes: string | null;
};

export function useForestLiquidityAccounts() {
  return useQuery({
    queryKey: ["forest_liquidity_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forest_liquidity_accounts")
        .select("*")
        .order("deposit_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ForestLiquidityAccount[];
    },
  });
}

export type EconomicEvent = {
  id: string;
  user_id: string;
  type: string;
  source_type: string;
  source_id: string | null;
  property_id: string | null;
  stand_id: string | null;
  activity_id: string | null;
  invoice_id: string | null;
  transaction_id: string | null;
  bank_account_id: string | null;
  forest_account_id: string | null;
  amount: number;
  vat_amount: number;
  date: string;
  tax_year: number;
  affects_result: boolean;
  affects_bank_balance: boolean;
  affects_tax: boolean;
  affects_forest_plan: boolean;
  payment_status: string;
  category: string | null;
  description: string | null;
  notes: string | null;
};

export function useEconomicEvents(year?: number) {
  return useQuery({
    queryKey: ["economic_events", year],
    queryFn: async () => {
      let q = supabase.from("economic_events").select("*").order("date", { ascending: false });
      if (year) q = q.eq("tax_year", year);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EconomicEvent[];
    },
  });
}

/**
 * Aggregated, year-aware view of economic_events.
 * - result: all events that affect_result for given year (income − expense)
 * - bankImpact: only events that actually moved money to bank that year
 * - tax: events affecting tax that year
 * - upcomingIncome: events for given year that affect_result but are not yet realized in bank
 */
export function useEconomicSummary(year: number) {
  const q = useEconomicEvents(year);
  const events = q.data ?? [];

  const isIncomeType = (t: string) =>
    t === "forest_sale" || t === "subsidy" || t === "forest_account_withdrawal" || t === "income";
  const isExpenseType = (t: string) => t === "expense";

  let income = 0;
  let expense = 0;
  let bankIn = 0;
  let bankOut = 0;
  let taxableIncome = 0;
  let taxableExpense = 0;
  let upcomingIncome = 0;
  let upcomingExpense = 0;
  let forestAccountDeposits = 0;

  for (const e of events) {
    const amt = Number(e.amount) || 0;
    if (e.affects_result) {
      if (isIncomeType(e.type)) income += amt;
      else if (isExpenseType(e.type)) expense += amt;
    }
    if (e.affects_bank_balance) {
      if (isIncomeType(e.type)) bankIn += amt;
      else if (isExpenseType(e.type)) bankOut += amt;
    } else if (e.affects_result) {
      // Booked in result but not yet in bank → kommande likviditet
      if (isIncomeType(e.type)) upcomingIncome += amt;
      else if (isExpenseType(e.type)) upcomingExpense += amt;
    }
    if (e.affects_tax) {
      if (isIncomeType(e.type)) taxableIncome += amt;
      else if (isExpenseType(e.type)) taxableExpense += amt;
    }
    if (e.payment_status === "paid_to_forest_account" && isIncomeType(e.type)) {
      forestAccountDeposits += amt;
    }
  }

  return {
    ...q,
    summary: {
      year,
      income,
      expense,
      result: income - expense,
      bankIn,
      bankOut,
      bankNet: bankIn - bankOut,
      taxableResult: taxableIncome - taxableExpense,
      upcomingIncome,
      upcomingExpense,
      forestAccountDeposits,
      eventsCount: events.length,
    },
  };
}

/**
 * List of distinct years that have economic_events.
 * Always includes current year.
 */
export function useAvailableYears() {
  return useQuery({
    queryKey: ["economic_events_years"],
    queryFn: async () => {
      const { data, error } = await supabase.from("economic_events").select("tax_year");
      if (error) throw error;
      const years = new Set<number>([new Date().getFullYear()]);
      (data ?? []).forEach((r: any) => years.add(Number(r.tax_year)));
      return Array.from(years).sort((a, b) => b - a);
    },
  });
}
