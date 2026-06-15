-- Migration: Fix storage policies for avatars bucket
-- This ensures authenticated users can upload thumbnails and logos

-- 1. Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clean up any conflicting policies
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Delete Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select on avatars" ON storage.objects;

-- 3. Create robust policies for avatars bucket
-- Allow public select access to avatars
CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to insert files into avatars bucket under public/ folder
CREATE POLICY "Authenticated Avatar Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'public'
);

-- Allow authenticated users to update files in avatars bucket
CREATE POLICY "Avatar Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete files in avatars bucket
CREATE POLICY "Avatar Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
