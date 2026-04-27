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
