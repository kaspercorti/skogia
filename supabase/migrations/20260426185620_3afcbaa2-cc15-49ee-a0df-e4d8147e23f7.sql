ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS map_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-maps', 'property-maps', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Property maps are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-maps');

CREATE POLICY "Users can upload their own property maps"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-maps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own property maps"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-maps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own property maps"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-maps' AND auth.uid()::text = (storage.foldername(name))[1]);