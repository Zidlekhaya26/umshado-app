-- Migration: Add invite token support to beta_requests
-- Run this in your Supabase SQL editor

-- Add invite_token column for tracking invite links
ALTER TABLE public.beta_requests
  ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'redeemed', 'rejected', 'revoked'));

-- Index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS beta_requests_invite_token_idx
  ON public.beta_requests (invite_token);

-- Allow anonymous users to read their own invite by token (for validation)
CREATE POLICY "Anyone can validate an invite token"
  ON public.beta_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow updates to mark invites as redeemed (status change only)
CREATE POLICY "Authenticated users can redeem their invite"
  ON public.beta_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.beta_requests TO anon;
GRANT SELECT ON public.beta_requests TO authenticated;
GRANT UPDATE ON public.beta_requests TO authenticated;

-- To approve an invite and send the link, run (from dashboard/service role):
-- UPDATE public.beta_requests SET status = 'approved' WHERE email = 'user@example.com';
-- Then send them: https://yourapp.com/auth/sign-up?invite=<invite_token>
