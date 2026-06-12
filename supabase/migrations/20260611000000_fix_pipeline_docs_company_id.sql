-- Fix company_id for client_stage_document_types and client_documents
-- so they don't disappear due to RLS policies.
-- This applies the auto_set_company_id() trigger which was missing in the REAL prod DB.

-- 1. Update existing client_stage_document_types where company_id IS NULL
UPDATE client_stage_document_types dt
SET company_id = ps.company_id
FROM client_pipeline_stages ps
WHERE dt.stage_id = ps.id
  AND dt.company_id IS NULL;

-- 2. Update existing client_documents where company_id IS NULL
UPDATE client_documents cd
SET company_id = c.company_id
FROM clients c
WHERE cd.client_id = c.id
  AND cd.company_id IS NULL;

-- 3. Ensure the trigger exists for client_stage_document_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_client_stage_document_types_auto_company'
  ) THEN
    CREATE TRIGGER trg_client_stage_document_types_auto_company
      BEFORE INSERT ON client_stage_document_types
      FOR EACH ROW
      EXECUTE FUNCTION auto_set_company_id();
  END IF;
END $$;

-- 4. Ensure the trigger exists for client_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_client_documents_auto_company'
  ) THEN
    CREATE TRIGGER trg_client_documents_auto_company
      BEFORE INSERT ON client_documents
      FOR EACH ROW
      EXECUTE FUNCTION auto_set_company_id();
  END IF;
END $$;
