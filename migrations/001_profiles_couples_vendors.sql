-- Migration: create profiles, couples, vendors tables and auth trigger
-- Run this in Supabase SQL editor or psql connected to your project

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('couple','vendor')),
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Create couples table
CREATE TABLE IF NOT EXISTS public.couples (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_name text,
  wedding_date date,
  location text,
  country text,
  created_at timestamptz DEFAULT now()
);

-- Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text,
  category text,
  city text,
  country text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Function to create default profile on auth.user creation
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger AS $$
BEGIN
  -- Create a profiles row for the new user with default role 'couple'
  INSERT INTO public.profiles (id, role, created_at)
  VALUES (NEW.id, 'couple', now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS auth_user_created ON auth.users;
CREATE TRIGGER auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- Note: Run this file in the Supabase SQL editor. The trigger will auto-create a
-- `profiles` row for each new auth user with role = 'couple'. Vendor onboarding will
-- update `profiles.role` to 'vendor' when a vendor completes onboarding.
