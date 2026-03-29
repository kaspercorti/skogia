
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Properties (Fastigheter)
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  municipality TEXT,
  total_area_ha NUMERIC(10,2) NOT NULL DEFAULT 0,
  productive_forest_ha NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own properties" ON public.properties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Stands (Bestånd)
CREATE TABLE public.stands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tree_species TEXT,
  area_ha NUMERIC(10,2) NOT NULL DEFAULT 0,
  age INTEGER,
  volume_m3sk NUMERIC(10,1),
  site_index TEXT,
  estimated_value NUMERIC(12,2),
  growth_rate_percent NUMERIC(5,2),
  planned_action TEXT,
  planned_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own stands" ON public.stands FOR ALL
  USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));
CREATE TRIGGER update_stands_updated_at BEFORE UPDATE ON public.stands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Forest Activities (Skogsaktiviteter)
CREATE TABLE public.forest_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  planned_date DATE,
  estimated_income NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_net NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.forest_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own forest_activities" ON public.forest_activities FOR ALL
  USING (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()));
CREATE TRIGGER update_forest_activities_updated_at BEFORE UPDATE ON public.forest_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Customers (Kunder)
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organization_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own customers" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Invoices (Fakturor)
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  description TEXT,
  amount_ex_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_inc_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  category TEXT,
  linked_activity_id UUID REFERENCES public.forest_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Transactions (Bokföringstransaktioner)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Bank Accounts (Bankkonton)
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_name TEXT,
  account_number_masked TEXT,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank_accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Tax Accounts (Skattekonton)
CREATE TABLE public.tax_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_tax_to_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tax_accounts" ON public.tax_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_tax_accounts_updated_at BEFORE UPDATE ON public.tax_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Tax Scenarios (Skatteprognoser)
CREATE TABLE public.tax_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  estimated_income NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  scenario_name TEXT NOT NULL DEFAULT 'Nuvarande plan',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tax_scenarios" ON public.tax_scenarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_tax_scenarios_updated_at BEFORE UPDATE ON public.tax_scenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Reports (Rapporter)
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ready',
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reports" ON public.reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Integrations (Integrationer)
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integrations" ON public.integrations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_stands_property_id ON public.stands(property_id);
CREATE INDEX idx_forest_activities_property_id ON public.forest_activities(property_id);
CREATE INDEX idx_forest_activities_stand_id ON public.forest_activities(stand_id);
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX idx_tax_accounts_user_id ON public.tax_accounts(user_id);
CREATE INDEX idx_tax_scenarios_user_id ON public.tax_scenarios(user_id);
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_integrations_user_id ON public.integrations(user_id);
