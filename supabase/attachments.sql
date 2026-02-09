-- ============================================================================
-- Message Attachments Table for uMshado
-- ============================================================================
-- This file creates the message_attachments table and RLS policies
-- Run this AFTER supabase/quotes.sql (messages table must exist)
-- ============================================================================

-- ============================================================================
-- MESSAGE ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,  -- Full path in storage: threads/<conversation_id>/<timestamp>-<filename>
  file_name text NOT NULL,  -- Original filename
  mime_type text,
  file_size int,  -- Size in bytes
  created_at timestamptz DEFAULT now(),
  
  -- Indexes for performance
  CONSTRAINT message_attachments_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation_id ON message_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_uploader_id ON message_attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_created_at ON message_attachments(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ATTACHMENT POLICIES
-- ============================================================================

-- Uploaders can INSERT their own attachments
CREATE POLICY "Users can upload attachments"
ON message_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploader_id);

-- Users can view attachments in conversations they participate in
CREATE POLICY "Users can view thread attachments"
ON message_attachments
FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON message_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = uploader_id);

-- ============================================================================
-- QUOTE ATTACHMENTS TABLE (Optional)
-- ============================================================================
-- For attaching files to quote requests (inspiration images, requirements PDFs)

CREATE TABLE IF NOT EXISTS public.quote_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,  -- Full path in storage: quotes/<quote_id>/<timestamp>-<filename>
  file_name text NOT NULL,
  mime_type text,
  file_size int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote_id ON quote_attachments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_attachments_uploader_id ON quote_attachments(uploader_id);

ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;

-- Users can upload attachments to their own quotes
CREATE POLICY "Users can upload quote attachments"
ON quote_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploader_id = auth.uid() AND
  quote_id IN (
    SELECT id FROM quotes WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Users can view attachments for quotes they have access to
CREATE POLICY "Users can view quote attachments"
ON quote_attachments
FOR SELECT
TO authenticated
USING (
  quote_id IN (
    SELECT id FROM quotes WHERE couple_id = auth.uid() OR vendor_id = auth.uid()
  )
);

-- Users can delete their own quote attachments
CREATE POLICY "Users can delete own quote attachments"
ON quote_attachments
FOR DELETE
TO authenticated
USING (auth.uid() = uploader_id);

-- ============================================================================
-- HELPER FUNCTION: Get attachment signed URL
-- ============================================================================
-- This function generates a signed URL for secure file access
-- Call from application: supabase.rpc('get_attachment_url', { file_path: '...' })

CREATE OR REPLACE FUNCTION get_attachment_signed_url(file_path text, expires_in int DEFAULT 3600)
RETURNS text AS $$
DECLARE
  signed_url text;
BEGIN
  -- In production, use Supabase Storage API to generate signed URL
  -- This is a placeholder - actual implementation happens in application code
  -- via: supabase.storage.from('umshado-files').createSignedUrl(file_path, expires_in)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify tables and RLS are set up:
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('message_attachments', 'quote_attachments');
--
-- Expected: Both tables should show rowsecurity = true
--
-- Test insert (from application):
-- INSERT INTO message_attachments (conversation_id, message_id, uploader_id, file_path, file_name, mime_type, file_size)
-- VALUES ('<conversation_id>', '<message_id>', auth.uid(), 'threads/xxx/file.jpg', 'file.jpg', 'image/jpeg', 12345);
-- ============================================================================
