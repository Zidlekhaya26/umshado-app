-- ============================================================================
-- Quote Status + Notifications (MVP)
-- ============================================================================
-- Adds vendor final quote fields and notifications table
-- Run after supabase/quotes.sql
-- ============================================================================

-- ============================================================================
-- QUOTES: add final quote fields
-- ============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS vendor_final_price int,
  ADD COLUMN IF NOT EXISTS vendor_message text;

-- Ensure updated_at exists with default
ALTER TABLE public.quotes
  ALTER COLUMN updated_at SET DEFAULT now();

-- ============================================================================
-- QUOTES: update policies for status transitions
-- ============================================================================

DROP POLICY IF EXISTS "Vendors can update quote status" ON public.quotes;
DROP POLICY IF EXISTS "Couples can update own quotes" ON public.quotes;

-- Vendors can update their quotes (final price + status)
CREATE POLICY "Vendors can update quote pricing and status"
ON public.quotes
FOR UPDATE
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Couples can accept/decline quotes
CREATE POLICY "Couples can accept or decline quotes"
ON public.quotes
FOR UPDATE
USING (auth.uid() = couple_id)
WITH CHECK (auth.uid() = couple_id AND status IN ('accepted','declined'));

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('quote_requested','quote_updated','message','system')),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Authenticated users can insert notifications (for recipients)
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
