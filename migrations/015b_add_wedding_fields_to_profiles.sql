-- Migration: 015_add_wedding_fields_to_profiles.sql
-- Adds wedding_date and wedding_venue to profiles so onboarding can persist them

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wedding_date date,
  ADD COLUMN IF NOT EXISTS wedding_venue text;

-- Optional: if you want an index for queries by date, uncomment below
-- CREATE INDEX IF NOT EXISTS idx_profiles_wedding_date ON public.profiles (wedding_date);
