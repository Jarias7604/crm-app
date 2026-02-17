-- =====================================================
-- SQL Migration: Setup Storage for Lead Documents
-- =====================================================
-- Purpose: Create the 'lead-documents' bucket for:
--   1. Lead-related document uploads
--   2. Chat message attachments (PDFs, images, etc.)
--
-- Dependencies: None
-- Safe to re-run: Yes (idempotent)
-- =====================================================

-- 1. Create storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lead-documents', 'lead-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies for lead-documents
-- Remove existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public Lead Documents Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Lead Documents Upload" ON storage.objects;
DROP POLICY IF EXISTS "Lead Documents Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Lead Documents Delete Access" ON storage.objects;

-- Policy: Allow public read access (for shared file links)
CREATE POLICY "Public Lead Documents Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lead-documents');

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated Lead Documents Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

-- Policy: Allow authenticated users to update/replace files
CREATE POLICY "Lead Documents Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lead-documents');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "Lead Documents Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-documents');
