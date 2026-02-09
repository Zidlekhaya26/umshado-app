-- Migration: Add 'revoked' status to beta_requests constraint
-- Run this ONLY if you already ran 004_invite_tokens.sql without the 'revoked' value.
-- If you're running 004 fresh, this migration is not needed (004 already includes 'revoked').

-- Drop old constraint and re-add with revoked included
ALTER TABLE public.beta_requests
  DROP CONSTRAINT IF EXISTS beta_requests_status_check;

ALTER TABLE public.beta_requests
  ADD CONSTRAINT beta_requests_status_check
    CHECK (status IN ('pending', 'approved', 'redeemed', 'rejected', 'revoked'));
