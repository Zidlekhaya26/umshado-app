-- Migration: 017_add_role_flags_to_profiles.sql
-- Adds role tracking columns to profiles table to support multi-role users

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_couple boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_vendor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS active_role text DEFAULT 'couple' CHECK (active_role IN ('couple', 'vendor'));

-- Create index on active_role for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_active_role ON public.profiles(active_role);

-- Set has_couple=true for all existing profiles where role='couple'
UPDATE public.profiles 
SET has_couple = true, active_role = 'couple'
WHERE role = 'couple' AND has_couple = false;

-- Ensure profiles have at least one role set
UPDATE public.profiles 
SET has_couple = true, active_role = 'couple'
WHERE has_couple = false AND has_vendor = false;
