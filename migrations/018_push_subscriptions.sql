-- Migration 018: Push Subscriptions
-- Stores Web Push subscriptions (one per user per device/browser)
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  -- One subscription per endpoint (same browser won't create duplicates)
  UNIQUE (endpoint)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all (for server-side sending)
-- (Service role bypasses RLS automatically)

-- Also add 'rsvp_received' to the notifications type constraint
-- so RSVP events can be notified
DO $$
BEGIN
  -- Drop old constraint
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  -- Re-add with rsvp_received included
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
      'system',
      'rsvp_received'
    ));
EXCEPTION WHEN others THEN
  -- If constraint manipulation fails, log and continue
  RAISE WARNING 'Could not update notifications_type_check: %', SQLERRM;
END $$;
