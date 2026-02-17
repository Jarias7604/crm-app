-- SQL Migration: Setup storage for quotations (PDFs)
-- 1. Create storage bucket for quotations if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quotations', 'quotations', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies for quotations
-- Remove existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public Quotations Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Quotations Upload" ON storage.objects;
DROP POLICY IF EXISTS "Quotations Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Quotations Delete Access" ON storage.objects;

-- Policy: Allow public read access (so they can be shared via link)
CREATE POLICY "Public Quotations Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quotations');

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated Quotations Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quotations');

-- Policy: Allow users to update files (e.g. overwriting same name)
CREATE POLICY "Quotations Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'quotations');

-- Policy: Allow users to delete files
CREATE POLICY "Quotations Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'quotations');
