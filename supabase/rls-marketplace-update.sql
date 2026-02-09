-- ============================================================================
-- RLS Policy Update for Marketplace Access
-- ============================================================================
-- Run this to update RLS policies to allow marketplace browsing
-- This replaces restrictive policies with marketplace-friendly ones
-- ============================================================================

-- ============================================================================
-- DROP OLD RESTRICTIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own vendor" ON vendors;
DROP POLICY IF EXISTS "Vendors can view own services" ON vendor_services;
DROP POLICY IF EXISTS "Vendors can view own packages" ON vendor_packages;

-- ============================================================================
-- CREATE NEW MARKETPLACE-FRIENDLY POLICIES
-- ============================================================================

-- Allow all authenticated users to browse vendor profiles
CREATE POLICY "Authenticated users can view all vendors"
ON vendors
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to view vendor services
CREATE POLICY "Authenticated users can view all vendor services"
ON vendor_services
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to view vendor packages
CREATE POLICY "Authenticated users can view all vendor packages"
ON vendor_packages
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test that policies work:
--
-- As any authenticated user:
-- SELECT * FROM vendors;  -- Should return all vendors
-- SELECT * FROM vendor_packages;  -- Should return all packages
-- SELECT * FROM vendor_services;  -- Should return all vendor-service links
-- 
-- Expected: All queries should succeed and return data
-- ============================================================================
