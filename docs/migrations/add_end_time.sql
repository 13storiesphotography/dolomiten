-- Optionales Ende für Shootings (ICS, lange Termine)
ALTER TABLE public.shootings
  ADD COLUMN IF NOT EXISTS end_time text;

COMMENT ON COLUMN public.shootings.end_time IS
  'Optionales Ende (HH:MM). shooting_time = Start der Shooting-Session in der Kunden-App.';
