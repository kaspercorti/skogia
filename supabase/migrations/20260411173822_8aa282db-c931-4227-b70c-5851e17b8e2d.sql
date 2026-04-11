ALTER TABLE public.stands
  ADD COLUMN IF NOT EXISTS huggningsklass text,
  ADD COLUMN IF NOT EXISTS mean_diameter_cm numeric,
  ADD COLUMN IF NOT EXISTS mean_height_m numeric,
  ADD COLUMN IF NOT EXISTS goal_class text,
  ADD COLUMN IF NOT EXISTS basal_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS annual_growth_m3sk numeric,
  ADD COLUMN IF NOT EXISTS description text;