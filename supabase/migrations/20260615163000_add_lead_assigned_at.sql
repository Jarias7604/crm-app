-- Add assigned_at column to public.leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Create function to handle auto-updating assigned_at on leads
CREATE OR REPLACE FUNCTION public.handle_lead_assignment_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      NEW.assigned_at := COALESCE(NEW.created_at, now());
    ELSE
      NEW.assigned_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      IF NEW.assigned_to IS NOT NULL THEN
        NEW.assigned_at := now();
      ELSE
        NEW.assigned_at := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically call the function on insert/update of assigned_to
DROP TRIGGER IF EXISTS trg_lead_assignment ON public.leads;
CREATE TRIGGER trg_lead_assignment
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_assignment_trigger();

-- Backfill assigned_at for existing leads using audit logs where assignment happened
WITH lead_assignments AS (
  SELECT 
    entity_id::uuid as lead_id,
    created_at as assigned_time,
    ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY created_at DESC) as rn
  FROM public.audit_logs
  WHERE entity_type = 'lead'
    AND (
      (action = 'UPDATE' AND (new_values->>'assigned_to') IS NOT NULL AND (old_values->>'assigned_to' IS DISTINCT FROM new_values->>'assigned_to'))
      OR
      (action = 'INSERT' AND (new_values->>'assigned_to') IS NOT NULL)
    )
)
UPDATE public.leads l
SET assigned_at = COALESCE(
  (SELECT assigned_time FROM lead_assignments la WHERE la.lead_id = l.id AND la.rn = 1),
  l.created_at
)
WHERE l.assigned_to IS NOT NULL;
