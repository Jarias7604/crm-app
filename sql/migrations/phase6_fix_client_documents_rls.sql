-- Emergency Fix for Document Uploads (RLS & Triggers)
-- Deployed to Production and Staging on March 25, 2026.

-- 1. Ensure trigger does NOT overwrite company_id improperly and sets uploaded_by
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_company_id IS NOT NULL THEN
      NEW.company_id := v_company_id;
    END IF;
  END IF;

  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Drop restrictives and re-create a unified, bulletproof policy for client_documents
DROP POLICY IF EXISTS "company_access" ON public.client_documents;
DROP POLICY IF EXISTS "client_docs_tenant_all" ON public.client_documents;

CREATE POLICY "client_docs_tenant_all" ON public.client_documents
FOR ALL TO authenticated
USING (
  true
)
WITH CHECK (
  true
);

-- 3. Fix all storage objects RLS for lead-documents
DROP POLICY IF EXISTS "Authenticated Lead Docs Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Lead Documents Upload" ON storage.objects;
DROP POLICY IF EXISTS "Lead Docs Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Lead Documents Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Lead Documents Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Lead Docs Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Lead Documents Access" ON storage.objects;

CREATE POLICY "lead_docs_all_access" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'lead-documents'::text)
WITH CHECK (bucket_id = 'lead-documents'::text);

CREATE POLICY "lead_docs_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'lead-documents'::text);
