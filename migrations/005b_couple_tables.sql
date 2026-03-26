-- ============================================================
-- Migration 005: Couple Data Tables
-- ============================================================
-- Creates real persistence tables for couple flow pages:
--   couple_tasks, couple_budget_items, couple_guests,
--   live_schedule_items, live_moments, well_wishes
-- Also adds avatar_url to the existing couples table.
-- Notifications table already exists (see quote_status.sql).
-- All tables are RLS-protected: couple_id = auth.uid()
-- ============================================================

-- 1) Add avatar_url to couples table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couples' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.couples ADD COLUMN avatar_url text;
  END IF;
END $$;

-- ============================================================
-- 2) couple_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couple_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_couple_tasks_couple ON public.couple_tasks(couple_id);

ALTER TABLE public.couple_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple_tasks_select" ON public.couple_tasks
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "couple_tasks_insert" ON public.couple_tasks
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "couple_tasks_update" ON public.couple_tasks
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "couple_tasks_delete" ON public.couple_tasks
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 3) couple_budget_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couple_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  category text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','partial','paid')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_couple_budget_couple ON public.couple_budget_items(couple_id);

ALTER TABLE public.couple_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple_budget_select" ON public.couple_budget_items
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "couple_budget_insert" ON public.couple_budget_items
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "couple_budget_update" ON public.couple_budget_items
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "couple_budget_delete" ON public.couple_budget_items
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 4) couple_guests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couple_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  rsvp_status text NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending','accepted','declined')),
  invited_via text NOT NULL DEFAULT 'manual' CHECK (invited_via IN ('manual','import','whatsapp')),
  plus_one boolean DEFAULT false,
  side text NOT NULL DEFAULT 'both' CHECK (side IN ('groom','bride','both')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_couple_guests_couple ON public.couple_guests(couple_id);

ALTER TABLE public.couple_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple_guests_select" ON public.couple_guests
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "couple_guests_insert" ON public.couple_guests
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "couple_guests_update" ON public.couple_guests
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "couple_guests_delete" ON public.couple_guests
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 5) live_schedule_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_label text NOT NULL,
  event_name text NOT NULL,
  location text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_schedule_couple ON public.live_schedule_items(couple_id);

ALTER TABLE public.live_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_schedule_select" ON public.live_schedule_items
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "live_schedule_insert" ON public.live_schedule_items
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "live_schedule_update" ON public.live_schedule_items
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "live_schedule_delete" ON public.live_schedule_items
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 6) live_moments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo','video')),
  description text NOT NULL,
  media_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_moments_couple ON public.live_moments(couple_id);

ALTER TABLE public.live_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_moments_select" ON public.live_moments
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "live_moments_insert" ON public.live_moments
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "live_moments_update" ON public.live_moments
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "live_moments_delete" ON public.live_moments
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 7) well_wishes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.well_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_well_wishes_couple ON public.well_wishes(couple_id);

ALTER TABLE public.well_wishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "well_wishes_select" ON public.well_wishes
  FOR SELECT USING (auth.uid() = couple_id);
CREATE POLICY "well_wishes_insert" ON public.well_wishes
  FOR INSERT WITH CHECK (auth.uid() = couple_id);
CREATE POLICY "well_wishes_update" ON public.well_wishes
  FOR UPDATE USING (auth.uid() = couple_id);
CREATE POLICY "well_wishes_delete" ON public.well_wishes
  FOR DELETE USING (auth.uid() = couple_id);

-- ============================================================
-- 8) Storage buckets for couple avatars and live moments
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('couple-avatars', 'couple-avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('live-moments', 'live-moments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload/read their own files
-- couple-avatars
CREATE POLICY "couple_avatars_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "couple_avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'couple-avatars');
CREATE POLICY "couple_avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "couple_avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- live-moments
CREATE POLICY "live_moments_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'live-moments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "live_moments_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'live-moments');
CREATE POLICY "live_moments_update_obj" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'live-moments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "live_moments_delete_obj" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'live-moments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
