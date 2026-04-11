ALTER TABLE public.forest_activities
  ADD COLUMN has_subsidy boolean NOT NULL DEFAULT false,
  ADD COLUMN subsidy_type text,
  ADD COLUMN subsidy_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN subsidy_status text DEFAULT 'planned',
  ADD COLUMN subsidy_date date,
  ADD COLUMN subsidy_notes text,
  ADD COLUMN custom_type text;