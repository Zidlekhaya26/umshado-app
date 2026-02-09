-- ============================================================================
-- Migration 008: Support Tickets, Bug Reports, User Preferences
-- ============================================================================
-- Creates three tables for the Settings MVP:
--   1. support_tickets     — user-submitted support requests
--   2. bug_reports         — user-submitted bug/problem reports
--   3. user_preferences    — per-user preference flags (notification toggle etc)
--
-- RLS: authenticated users can insert/read their own rows.
--       Service role can read all (for admin dashboard later).
-- ============================================================================

-- ============================================================================
-- TABLE 1: support_tickets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  subject     text NOT NULL,
  message     text NOT NULL,
  role        text CHECK (role IN ('couple', 'vendor', 'other')),
  include_diagnostics boolean DEFAULT false,
  status      text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own support_tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own support_tickets"
ON public.support_tickets FOR SELECT
USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 2: bug_reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_route      text,
  issue_type      text NOT NULL CHECK (issue_type IN ('bug', 'ui', 'performance', 'other')),
  description     text NOT NULL,
  steps_to_reproduce text,
  expected_result text,
  actual_result   text,
  status          text DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'fixed', 'wont_fix')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own bug_reports"
ON public.bug_reports FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own bug_reports"
ON public.bug_reports FOR SELECT
USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 3: user_preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_notifications    boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
ON public.user_preferences FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user
  ON public.bug_reports(user_id, created_at DESC);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
--
-- 1. Tables exist:
--    SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('support_tickets','bug_reports','user_preferences');
--    -- Expected: 3 rows
--
-- 2. RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('support_tickets','bug_reports','user_preferences');
--    -- Expected: all true
-- ============================================================================
