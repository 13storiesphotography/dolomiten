-- Shooting-Workflow-Status (nur für Shootings ohne Event-Zuordnung im Admin)
-- In Supabase SQL Editor ausführen.

ALTER TABLE public.shootings
  ADD COLUMN IF NOT EXISTS workflow_status text;

COMMENT ON COLUMN public.shootings.workflow_status IS
  'Planungsstatus für einzelne Shootings ohne project_name (z. B. angefragt, fix). NULL wenn an Event gebunden.';
