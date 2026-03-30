
-- Receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  receipt_date DATE,
  supplier_name TEXT,
  total_amount NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  amount_ex_vat NUMERIC DEFAULT 0,
  suggested_category TEXT,
  suggested_account TEXT,
  property_id UUID,
  stand_id UUID,
  forest_activity_id UUID,
  status TEXT NOT NULL DEFAULT 'uploaded',
  confidence_score NUMERIC,
  notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  linked_transaction_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own receipts"
  ON public.receipts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipt-images', 'receipt-images', false);

CREATE POLICY "Users can upload receipt images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own receipt images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own receipt images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text);
