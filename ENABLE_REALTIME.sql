-- ============================================================================
-- Enable Supabase Realtime for Messages Features
-- ============================================================================
-- This SQL script enables Realtime subscriptions on the messages table
-- Required for: typing indicators, online presence, real-time message updates
--
-- Run this in the Supabase SQL Editor:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste and run this script
-- ============================================================================

-- Enable Realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify that Realtime is enabled (optional - for checking)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- Additional Configuration (if needed)
-- ============================================================================

-- If you need to enable Realtime on conversations table as well:
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- If you need to enable Realtime on message_attachments:
-- ALTER PUBLICATION supabase_realtime ADD TABLE message_attachments;

-- ============================================================================
-- Verification Instructions
-- ============================================================================
-- To verify Realtime is working:
-- 1. Check Supabase Dashboard > Database > Replication
-- 2. Ensure "messages" table is listed under "supabase_realtime" publication
-- 3. Test by opening two browser windows with the chat thread
-- 4. Send a message in one window - it should appear in the other instantly
-- 5. Start typing in one window - "typing..." should appear in the other
-- ============================================================================
