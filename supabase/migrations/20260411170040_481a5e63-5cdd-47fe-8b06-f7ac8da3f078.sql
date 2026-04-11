
-- Table for forest plan imports
CREATE TABLE public.forest_plan_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'uploaded',
  extracted_stands_count INTEGER DEFAULT 0,
  extracted_data JSONB DEFAULT '[]'::jsonb,
  confidence_score NUMERIC,
  notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.forest_plan_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own forest_plan_imports"
  ON public.forest_plan_imports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_forest_plan_imports_updated_at
  BEFORE UPDATE ON public.forest_plan_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for forest plan PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('forest-plans', 'forest-plans', false);

CREATE POLICY "Users can upload own forest plans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'forest-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own forest plans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'forest-plans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own forest plans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'forest-plans' AND auth.uid()::text = (storage.foldername(name))[1]);
