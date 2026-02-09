-- ============================================================================
-- Supabase Storage Setup for uMshado File Attachments
-- ============================================================================
-- This file sets up the Supabase Storage bucket and policies for chat attachments
-- Run this in Supabase SQL Editor OR use Supabase Dashboard → Storage
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKET CREATION
-- ============================================================================
-- NOTE: Storage buckets are typically created via Supabase Dashboard → Storage
-- But you can also create them via SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'umshado-files',
  'umshado-files',
  false,  -- Private bucket (not publicly accessible)
  10485760,  -- 10 MB file size limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'umshado-files' AND
  auth.uid() IS NOT NULL
);

-- Allow authenticated users to read files they uploaded
CREATE POLICY "Users can read their own uploaded files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'umshado-files' AND
  owner = auth.uid()
);

-- Allow authenticated users to read files from threads they participate in
-- (This is more complex - for MVP, we'll rely on signed URLs and app logic)
-- In production, you'd query the conversations table to verify thread participation
CREATE POLICY "Users can read thread files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'umshado-files' AND
  -- Extract thread_id from path pattern: threads/<thread_id>/<filename>
  -- For MVP: allow all authenticated users (rely on signed URL expiry)
  -- TODO: Add proper thread participation check in future versions
  auth.uid() IS NOT NULL
);

-- Allow users to update their own files (for metadata)
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'umshado-files' AND
  owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'umshado-files' AND
  owner = auth.uid()
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'umshado-files' AND
  owner = auth.uid()
);

-- ============================================================================
-- ALTERNATIVE: Dashboard Setup (Recommended for beginners)
-- ============================================================================
-- If SQL bucket creation fails, use Supabase Dashboard:
-- 1. Go to Storage → Create new bucket
-- 2. Bucket name: umshado-files
-- 3. Public bucket: OFF (unchecked)
-- 4. File size limit: 10 MB
-- 5. Allowed MIME types: (leave empty or add manually)
-- 6. Create bucket
-- 
-- Then create policies via Dashboard → Storage → umshado-files → Policies
-- Or run the CREATE POLICY statements above after bucket exists
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check bucket exists:
-- SELECT * FROM storage.buckets WHERE id = 'umshado-files';
-- 
-- Check policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
-- 
-- Test upload (from application):
-- supabase.storage.from('umshado-files').upload('test.txt', file)
-- ============================================================================
