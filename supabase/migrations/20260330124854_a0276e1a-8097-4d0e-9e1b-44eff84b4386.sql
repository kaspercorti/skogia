
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload invoice PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-pdfs');

CREATE POLICY "Authenticated users can read own invoice PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-pdfs');

CREATE POLICY "Public can read invoice PDFs"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'invoice-pdfs');
