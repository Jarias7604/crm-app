-- SQL Migration: Add document support to leads and setup storage
-- 1. Add column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS document_path TEXT;

-- 2. Create storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lead-documents', 'lead-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies (Multi-tenancy)
-- We use a policy that checks the company_id from the user's profile
-- Assumption: Files are stored in paths like 'company_id/lead_id/filename.pdf'

-- POLICY: Give users access to their company's folder
CREATE POLICY "Company Access to Documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);
