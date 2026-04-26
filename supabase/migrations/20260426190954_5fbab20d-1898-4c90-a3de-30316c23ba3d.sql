-- Tabell för att koppla en aktivitet till flera bestånd
CREATE TABLE public.forest_activity_stands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL,
  stand_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (activity_id, stand_id)
);

CREATE INDEX idx_fas_activity ON public.forest_activity_stands(activity_id);
CREATE INDEX idx_fas_stand ON public.forest_activity_stands(stand_id);

ALTER TABLE public.forest_activity_stands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own forest_activity_stands"
ON public.forest_activity_stands
FOR ALL
USING (
  activity_id IN (
    SELECT fa.id FROM public.forest_activities fa
    JOIN public.properties p ON p.id = fa.property_id
    WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  activity_id IN (
    SELECT fa.id FROM public.forest_activities fa
    JOIN public.properties p ON p.id = fa.property_id
    WHERE p.user_id = auth.uid()
  )
);