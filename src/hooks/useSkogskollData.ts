import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Convenience types from generated DB types
export type Property = {
  id: string;
  name: string;
  municipality: string | null;
  total_area_ha: number;
  productive_forest_ha: number;
};

export type Stand = {
  id: string;
  property_id: string;
  name: string;
  tree_species: string | null;
  area_ha: number;
  age: number | null;
  volume_m3sk: number | null;
  site_index: string | null;
  estimated_value: number | null;
  growth_rate_percent: number | null;
  planned_action: string | null;
  planned_year: number | null;
  notes: string | null;
};

export type ForestActivity = {
  id: string;
  stand_id: string | null;
  property_id: string;
  type: string;
  planned_date: string | null;
  estimated_income: number;
  estimated_cost: number;
  estimated_net: number;
  status: string;
  notes: string | null;
};

export type Customer = {
  id: string;
  name: string;
  organization_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type Invoice = {
  id: string;
  customer_id: string | null;
  property_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  description: string | null;
  amount_ex_vat: number;
  vat_amount: number;
  amount_inc_vat: number;
  status: string;
  category: string | null;
  linked_activity_id: string | null;
};

export type Transaction = {
  id: string;
  property_id: string | null;
  stand_id: string | null;
  invoice_id: string | null;
  date: string;
  type: string;
  category: string | null;
  description: string | null;
  amount: number;
  vat_amount: number;
  payment_method: string | null;
  status: string;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string | null;
  account_number_masked: string | null;
  current_balance: number;
  last_synced_at: string | null;
  is_connected: boolean;
};

export type TaxAccount = {
  id: string;
  current_balance: number;
  estimated_tax_to_pay: number;
  last_synced_at: string | null;
  is_connected: boolean;
};

export type TaxScenario = {
  id: string;
  year: number;
  estimated_income: number;
  estimated_expenses: number;
  estimated_profit: number;
  estimated_tax: number;
  scenario_name: string;
  notes: string | null;
};

export type Integration = {
  id: string;
  type: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
};

// ─── Query hooks ───

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*");
      if (error) throw error;
      return data as Property[];
    },
  });
}

export function useStands(propertyId?: string) {
  return useQuery({
    queryKey: ["stands", propertyId],
    queryFn: async () => {
      let q = supabase.from("stands").select("*");
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Stand[];
    },
  });
}

export function useForestActivities(propertyId?: string) {
  return useQuery({
    queryKey: ["forest_activities", propertyId],
    queryFn: async () => {
      let q = supabase.from("forest_activities").select("*");
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ForestActivity[];
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*");
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*");
      if (error) throw error;
      return data as BankAccount[];
    },
  });
}

export function useTaxAccounts() {
  return useQuery({
    queryKey: ["tax_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_accounts").select("*");
      if (error) throw error;
      return data as TaxAccount[];
    },
  });
}

export function useTaxScenarios(year?: number) {
  return useQuery({
    queryKey: ["tax_scenarios", year],
    queryFn: async () => {
      let q = supabase.from("tax_scenarios").select("*");
      if (year) q = q.eq("year", year);
      const { data, error } = await q;
      if (error) throw error;
      return data as TaxScenario[];
    },
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*");
      if (error) throw error;
      return data as Integration[];
    },
  });
}

// ─── Calculation helpers ───

export const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

export function calcSaldo(transactions: Transaction[]) {
  return transactions.reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum - t.amount), 0);
}

export function calcResultat(transactions: Transaction[], year: number) {
  return transactions
    .filter((t) => new Date(t.date).getFullYear() === year)
    .reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum - t.amount), 0);
}

export function calcTotalArea(properties: Property[]) {
  return properties.reduce((sum, p) => sum + p.total_area_ha, 0);
}

export function calcOpenInvoices(invoices: Invoice[]) {
  return invoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount_inc_vat, 0);
}

export function calcOverdueInvoices(invoices: Invoice[]) {
  return invoices.filter((i) => i.status === "overdue");
}

export function calcUpcomingIncome(activities: ForestActivity[]) {
  return activities
    .filter((a) => a.status === "planned")
    .reduce((sum, a) => sum + a.estimated_income, 0);
}

export function calcEstimatedTax(resultat: number) {
  return resultat > 0 ? resultat * 0.27 : 0;
}

export function calcVat(transactions: Transaction[], year: number) {
  const yearTx = transactions.filter((t) => new Date(t.date).getFullYear() === year);
  const inVat = yearTx.filter((t) => t.type === "income").reduce((s, t) => s + t.vat_amount, 0);
  const outVat = yearTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.vat_amount, 0);
  return { inVat, outVat, netVat: inVat - outVat };
}
