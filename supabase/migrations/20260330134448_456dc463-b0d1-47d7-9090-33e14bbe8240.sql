
-- Create bank_transactions table
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  reference TEXT,
  transaction_type TEXT,
  direction TEXT NOT NULL DEFAULT 'in',
  matched_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  match_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own bank_transactions"
  ON public.bank_transactions
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add bank_transaction_id to transactions table
ALTER TABLE public.transactions ADD COLUMN bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL;
