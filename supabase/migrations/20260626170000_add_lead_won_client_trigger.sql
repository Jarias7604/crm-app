-- 1. Ensure lead_id is UNIQUE in public.clients table to support ON CONFLICT operations
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_id_key;
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_id_key UNIQUE (lead_id);

-- 2. Trigger and Function to automatically create or update a Client record when a Lead's status changes to 'Cerrado' or 'Cliente'.
CREATE OR REPLACE FUNCTION public.fn_promote_lead_to_client()
RETURNS TRIGGER AS $$
DECLARE
  v_first_stage_id uuid;
BEGIN
  -- Solo actuar si status cambia A 'Cerrado' o 'Cliente'
  IF NEW.status NOT IN ('Cerrado', 'Cliente') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Obtener la primera etapa del pipeline de la empresa (orden ASC)
  SELECT id INTO v_first_stage_id
  FROM public.client_pipeline_stages
  WHERE company_id = NEW.company_id
    AND activo = true
  ORDER BY orden ASC
  LIMIT 1;

  -- Crear el cliente (si no existe ya para este lead)
  INSERT INTO public.clients (
    company_id,
    lead_id,
    nombre,
    contacto,
    email,
    telefono,
    assigned_to,
    etapa_actual_id,
    es_activo
  )
  VALUES (
    NEW.company_id,
    NEW.id,
    NEW.name,
    NEW.name,   -- contacto = nombre del lead
    NEW.email,
    NEW.phone,
    NEW.assigned_to,
    v_first_stage_id,
    CASE WHEN NEW.status = 'Cliente' THEN true ELSE false END
  )
  ON CONFLICT (lead_id) DO UPDATE
    SET es_activo = CASE WHEN NEW.status = 'Cliente' THEN true ELSE EXCLUDED.es_activo END,
        updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function
DROP TRIGGER IF EXISTS trg_lead_cerrado_to_client ON public.leads;
CREATE TRIGGER trg_lead_cerrado_to_client
    AFTER UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_promote_lead_to_client();
