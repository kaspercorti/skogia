
CREATE TABLE public.loss_carry_forwards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.loss_carry_forwards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own loss_carry_forwards"
  ON public.loss_carry_forwards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_loss_carry_forwards_updated_at
  BEFORE UPDATE ON public.loss_carry_forwards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
