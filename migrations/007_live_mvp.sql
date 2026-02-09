-- ============================================================================
-- Migration 007: Live MVP — Schedule, Well Wishes, Moments, Guest Links
-- ============================================================================
-- Creates four tables for the Live wedding-day experience:
--   1. live_events       — couple's wedding-day schedule
--   2. live_well_wishes  — guest messages / well wishes
--   3. live_moments      — guest photo/video moments
--   4. live_guest_links  — token-based guest access links
--
-- RLS: Couples own their data (CRUD). Guests access via server API routes
-- that validate tokens (using service role), so no anon direct writes.
-- ============================================================================

-- ============================================================================
-- TABLE 1: live_events (couple's wedding-day schedule)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  time        text NOT NULL,            -- MVP: simple string like "14:00" or "2pm"
  location    text,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

-- Couple can do everything with their own events
CREATE POLICY "Couples manage own live_events"
ON public.live_events
FOR ALL
USING (couple_id = auth.uid())
WITH CHECK (couple_id = auth.uid());

-- ============================================================================
-- TABLE 2: live_well_wishes (guest well-wish messages)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_well_wishes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name  text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.live_well_wishes ENABLE ROW LEVEL SECURITY;

-- Couple can read and delete their own well wishes
CREATE POLICY "Couples read own well_wishes"
ON public.live_well_wishes
FOR SELECT
USING (couple_id = auth.uid());

CREATE POLICY "Couples delete own well_wishes"
ON public.live_well_wishes
FOR DELETE
USING (couple_id = auth.uid());

-- INSERT is done server-side via service role (guest API route validates token)
-- No anon/public INSERT policy needed

-- ============================================================================
-- TABLE 3: live_moments (guest photo/video moments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_moments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name  text NOT NULL,
  caption     text,
  media_url   text,                     -- MVP: pasted URL or optional storage upload
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.live_moments ENABLE ROW LEVEL SECURITY;

-- Couple can read and delete their own moments
CREATE POLICY "Couples read own live_moments"
ON public.live_moments
FOR SELECT
USING (couple_id = auth.uid());

CREATE POLICY "Couples delete own live_moments"
ON public.live_moments
FOR DELETE
USING (couple_id = auth.uid());

-- INSERT is done server-side via service role (guest API route validates token)

-- ============================================================================
-- TABLE 4: live_guest_links (token-based guest access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_guest_links (
  couple_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token       uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz              -- optional expiry
);

ALTER TABLE public.live_guest_links ENABLE ROW LEVEL SECURITY;

-- Couple can manage their own guest link
CREATE POLICY "Couples manage own guest_link"
ON public.live_guest_links
FOR ALL
USING (couple_id = auth.uid())
WITH CHECK (couple_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_live_events_couple
  ON public.live_events(couple_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_live_well_wishes_couple
  ON public.live_well_wishes(couple_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_moments_couple
  ON public.live_moments(couple_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_guest_links_token
  ON public.live_guest_links(token);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
--
-- 1. Tables exist:
--    SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('live_events','live_well_wishes','live_moments','live_guest_links');
--    -- Expected: 4 rows
--
-- 2. RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename LIKE 'live_%';
--    -- Expected: all true
--
-- 3. Policies exist:
--    SELECT tablename, policyname FROM pg_policies
--    WHERE tablename LIKE 'live_%';
-- ============================================================================
