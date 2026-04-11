ALTER TABLE public.forest_activities
  ADD COLUMN IF NOT EXISTS harvested_volume_m3sk numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_volume_m3sk numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_per_m3sk numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS affects_forest_plan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_updated boolean NOT NULL DEFAULT false;