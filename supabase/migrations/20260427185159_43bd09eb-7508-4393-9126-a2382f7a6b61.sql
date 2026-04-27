
-- 1) Rensa gamla auto-transaktioner från skogsaktiviteter
DELETE FROM public.transactions WHERE description LIKE '%[FA:%]%';

-- 2) Utöka forest_activities med betalningsfält
ALTER TABLE public.forest_activities
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_paid',
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS forest_account_id uuid,
  ADD COLUMN IF NOT EXISTS apply_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;

-- 3) Skogslikvidkonton
CREATE TABLE IF NOT EXISTS public.forest_liquidity_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  bank_name text,
  account_number_masked text,
  opened_date date NOT NULL DEFAULT CURRENT_DATE,
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  original_deposit_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  expiry_date date GENERATED ALWAYS AS ((deposit_date + INTERVAL '10 years')::date) STORED,
  source_activity_id uuid,
  source_transaction_id uuid,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forest_liquidity_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own forest_liquidity_accounts"
ON public.forest_liquidity_accounts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_forest_liquidity_accounts_updated_at
BEFORE UPDATE ON public.forest_liquidity_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Central economic_events-tabell
CREATE TABLE IF NOT EXISTS public.economic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  property_id uuid,
  stand_id uuid,
  activity_id uuid,
  invoice_id uuid,
  transaction_id uuid,
  bank_account_id uuid,
  forest_account_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  tax_year integer NOT NULL,
  affects_result boolean NOT NULL DEFAULT true,
  affects_bank_balance boolean NOT NULL DEFAULT false,
  affects_tax boolean NOT NULL DEFAULT true,
  affects_forest_plan boolean NOT NULL DEFAULT false,
  payment_status text NOT NULL DEFAULT 'not_paid',
  category text,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own economic_events"
ON public.economic_events
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_economic_events_updated_at
BEFORE UPDATE ON public.economic_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_economic_events_user_year ON public.economic_events(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_economic_events_activity ON public.economic_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_economic_events_property ON public.economic_events(property_id);
