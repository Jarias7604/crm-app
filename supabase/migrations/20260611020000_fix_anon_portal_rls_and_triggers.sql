-- ================================================================
-- FIX: Scope anon RLS policies for client portal + Add auto-triggers
-- DATE: 2026-06-11
-- 
-- PROBLEMA 1: Las políticas anon en client_documents y 
--   client_stage_document_types usaban USING (true) — cualquier 
--   usuario anónimo podía leer TODOS los documentos de TODOS 
--   los tenants. Riesgo de privacidad (DUIs, contratos, etc.)
--
-- SOLUCIÓN 1: Restringir acceso anon solo a documentos/doc_types
--   que pertenezcan a un cliente con portal_token válido.
--
-- PROBLEMA 2: No existen triggers que auto-asignen company_id 
--   en inserciones futuras a client_stage_document_types y 
--   client_documents. Si un bug olvida pasar company_id, el 
--   registro queda NULL y vuelve a desaparecer.
--
-- SOLUCIÓN 2: Agregar triggers BEFORE INSERT que heredan el 
--   company_id del registro padre automáticamente.
-- ================================================================

-- ─── 1. ARREGLAR políticas anon en client_stage_document_types ──

DROP POLICY IF EXISTS anon_portal_read ON public.client_stage_document_types;

-- El portal consulta doc_types a través del stage_id que viene del
-- cliente con portal_token. Restringimos al stage que pertenezca a 
-- un cliente que SÍ tenga un portal_token válido (no NULL).
CREATE POLICY anon_portal_read ON public.client_stage_document_types
  FOR SELECT TO anon
  USING (
    stage_id IN (
      SELECT etapa_actual_id 
      FROM public.clients 
      WHERE portal_token IS NOT NULL
        AND etapa_actual_id IS NOT NULL
    )
  );

-- ─── 2. ARREGLAR políticas anon en client_documents ─────────────

DROP POLICY IF EXISTS cd_portal_anon ON public.client_documents;
DROP POLICY IF EXISTS client_docs_anon_insert ON public.client_documents;

-- SELECT anon: solo documentos de clientes con portal_token válido
CREATE POLICY cd_portal_anon ON public.client_documents
  FOR SELECT TO anon
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE portal_token IS NOT NULL
    )
  );

-- INSERT anon: solo si el client_id tiene portal_token válido
-- (el cliente sube sus propios documentos desde el portal)
CREATE POLICY client_docs_anon_insert ON public.client_documents
  FOR INSERT TO anon
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE portal_token IS NOT NULL
    )
  );

-- ─── 3. TRIGGER: auto-asignar company_id en client_stage_document_types ──

CREATE OR REPLACE FUNCTION public.fn_auto_company_id_stage_doc_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si ya viene con company_id, no hacer nada
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Heredar company_id del stage padre
  SELECT company_id INTO NEW.company_id
  FROM public.client_pipeline_stages
  WHERE id = NEW.stage_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_stage_document_types_auto_company 
  ON public.client_stage_document_types;

CREATE TRIGGER trg_client_stage_document_types_auto_company
  BEFORE INSERT ON public.client_stage_document_types
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_company_id_stage_doc_type();

-- ─── 4. TRIGGER: auto-asignar company_id en client_documents ────

CREATE OR REPLACE FUNCTION public.fn_auto_company_id_client_doc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si ya viene con company_id, no hacer nada
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Heredar company_id del cliente padre
  SELECT company_id INTO NEW.company_id
  FROM public.clients
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_documents_auto_company 
  ON public.client_documents;

CREATE TRIGGER trg_client_documents_auto_company
  BEFORE INSERT ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_company_id_client_doc();

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
SELECT 
  tablename, 
  policyname, 
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('client_stage_document_types', 'client_documents')
ORDER BY tablename, roles, cmd;
