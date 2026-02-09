-- ============================================================================
-- Row-Level Security (RLS) Policies for uMshado
-- ============================================================================
-- This file enables RLS and creates policies for production-grade access control
-- Run this in Supabase SQL Editor after tables are created
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- Users can only access their own profile (auth.uid() = id)
-- ============================================================================

-- Allow users to SELECT their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow users to INSERT their own profile
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to UPDATE their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- COUPLES POLICIES
-- Users can only access their own couple record (auth.uid() = id)
-- ============================================================================

-- Allow users to SELECT their own couple
CREATE POLICY "Users can view own couple"
ON couples
FOR SELECT
USING (auth.uid() = id);

-- Allow users to INSERT their own couple
CREATE POLICY "Users can insert own couple"
ON couples
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to UPDATE their own couple
CREATE POLICY "Users can update own couple"
ON couples
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- VENDORS POLICIES
-- Vendors can manage their own records, all authenticated users can browse
-- ============================================================================

-- Allow all authenticated users to browse vendor profiles (marketplace)
CREATE POLICY "Authenticated users can view all vendors"
ON vendors
FOR SELECT
TO authenticated
USING (true);

-- Allow users to INSERT their own vendor
CREATE POLICY "Users can insert own vendor"
ON vendors
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to UPDATE their own vendor
CREATE POLICY "Users can update own vendor"
ON vendors
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- VENDOR_SERVICES POLICIES
-- Vendors can manage their own, all authenticated users can view
-- ============================================================================

-- Allow all authenticated users to view vendor services (for marketplace)
CREATE POLICY "Authenticated users can view all vendor services"
ON vendor_services
FOR SELECT
TO authenticated
USING (true);

-- Allow vendors to INSERT their own services
CREATE POLICY "Vendors can insert own services"
ON vendor_services
FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

-- Allow vendors to DELETE their own services
CREATE POLICY "Vendors can delete own services"
ON vendor_services
FOR DELETE
USING (auth.uid() = vendor_id);

-- ============================================================================
-- VENDOR_PACKAGES POLICIES
-- Vendors can manage their own, all authenticated users can view
-- ============================================================================

-- Allow all authenticated users to view vendor packages (for marketplace)
CREATE POLICY "Authenticated users can view all vendor packages"
ON vendor_packages
FOR SELECT
TO authenticated
USING (true);

-- Allow vendors to INSERT their own packages
CREATE POLICY "Vendors can insert own packages"
ON vendor_packages
FOR INSERT
WITH CHECK (auth.uid() = vendor_id);

-- Allow vendors to UPDATE their own packages
CREATE POLICY "Vendors can update own packages"
ON vendor_packages
FOR UPDATE
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Allow vendors to DELETE their own packages
CREATE POLICY "Vendors can delete own packages"
ON vendor_packages
FOR DELETE
USING (auth.uid() = vendor_id);

-- ============================================================================
-- SERVICES POLICIES (READ-ONLY CATALOG)
-- All authenticated users can SELECT services (read-only)
-- No inserts/updates/deletes from client
-- ============================================================================

-- Allow all authenticated users to view services catalog
CREATE POLICY "Authenticated users can view services catalog"
ON services
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify RLS is enabled:
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('profiles', 'couples', 'vendors', 'vendor_services', 'vendor_packages', 'services');
--
-- Expected: All tables should show rowsecurity = true
-- ============================================================================
