-- ============================================================================
-- Migration 009: Notifications Upgrade
-- ============================================================================
-- Extends the existing public.notifications table:
--   1. Add meta jsonb column
--   2. Relax type CHECK constraint to allow new notification types
--   3. Add composite indexes for performance
--   4. Ensure service role insert policy exists
--
-- Safe to re-run (uses IF NOT EXISTS / DO blocks).
-- ============================================================================

-- ============================================================================
-- 1. Add meta column if missing
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- 2. Drop old restrictive CHECK constraint on type, replace with permissive one
-- ============================================================================
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'notifications'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- New constraint allows all MVP notification types
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'quote_created',
  'quote_requested',
  'quote_status_updated',
  'quote_updated',
  'message_received',
  'message',
  'vendor_published',
  'invite_approved',
  'system'
));

-- ============================================================================
-- 3. Composite indexes for notification queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read
  ON public.notifications(user_id, is_read);

-- ============================================================================
-- 4. Ensure RLS policies exist (idempotent)
-- ============================================================================
-- SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE own (mark read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- INSERT: any authenticated user can insert (needed for client fallback + service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated can insert notifications'
  ) THEN
    CREATE POLICY "Authenticated can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'notifications' AND table_schema = 'public';
-- Expected: id, user_id, type, title, body, link, is_read, created_at, meta
-- ============================================================================
