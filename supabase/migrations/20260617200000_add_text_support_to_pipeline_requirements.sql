-- ================================================================
-- Migration: Add text support to pipeline stage requirements
-- Date: 2026-06-17
-- Description: Supports stages requiring: Only File, Only Text, or Both.
-- ================================================================

-- 1. Add requirement type indicators to client_stage_document_types
ALTER TABLE public.client_stage_document_types 
ADD COLUMN IF NOT EXISTS requiere_documento BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS requiere_texto BOOLEAN NOT NULL DEFAULT false;

-- 2. Add text response field to client_documents
ALTER TABLE public.client_documents 
ADD COLUMN IF NOT EXISTS valor_texto TEXT DEFAULT null;

-- 3. Drop NOT NULL constraint on file_path to allow text-only responses
ALTER TABLE public.client_documents 
ALTER COLUMN file_path DROP NOT NULL;

-- 4. Add UPDATE RLS policy for anon users to allow modifying text answers
DROP POLICY IF EXISTS cd_portal_anon_update ON public.client_documents;
CREATE POLICY cd_portal_anon_update ON public.client_documents
  FOR UPDATE TO anon
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE portal_token IS NOT NULL
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE portal_token IS NOT NULL
    )
  );

-- 5. Reload Schema cache
NOTIFY pgrst, 'reload schema';
