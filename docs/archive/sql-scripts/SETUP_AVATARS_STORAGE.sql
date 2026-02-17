-- SQL Migration: Setup storage for avatars
-- 1. Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for avatars
-- Policy: Allow public read access to all avatars
CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy: Allow authenticated users to upload files to public/ folder
CREATE POLICY "Authenticated Avatar Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'public'
);

-- Policy: Allow users to update their own files (simple version: any authenticated for now or match UID in filename)
CREATE POLICY "Avatar Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- 3. Ensure profiles table has the necessary columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;
