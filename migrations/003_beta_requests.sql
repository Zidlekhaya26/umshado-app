-- Migration: beta_requests table for private-beta access requests
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.beta_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role_interest text NOT NULL CHECK (role_interest IN ('couple', 'vendor')),
  created_at timestamptz DEFAULT now()
);

-- Unique on email so duplicates are silently ignored
CREATE UNIQUE INDEX IF NOT EXISTS beta_requests_email_idx
  ON public.beta_requests (email);

-- RLS: allow inserts from anonymous + authenticated, reads from service role only
ALTER TABLE public.beta_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated via anon key) can insert a request
CREATE POLICY "Anyone can request beta access"
  ON public.beta_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service-role (dashboard) can read requests
CREATE POLICY "Service role can read beta requests"
  ON public.beta_requests
  FOR SELECT
  TO service_role
  USING (true);

-- Grant insert to anon so the public form works without auth
GRANT INSERT ON public.beta_requests TO anon;
GRANT INSERT ON public.beta_requests TO authenticated;
