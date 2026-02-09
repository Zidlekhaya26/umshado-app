-- ============================================================================
-- Troubleshooting: Check Database Setup
-- ============================================================================
-- Run these queries to verify your uMshado database is set up correctly
-- ============================================================================

-- ============================================================================
-- 1. CHECK TABLES EXIST
-- ============================================================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'profiles', 
  'couples', 
  'vendors', 
  'vendor_services', 
  'vendor_packages', 
  'services',
  'quotes',
  'quote_line_items',
  'conversations',
  'messages'
)
ORDER BY tablename;

-- Expected: All 10 tables should exist with rowsecurity = true

-- ============================================================================
-- 2. CHECK RLS POLICIES (for vendors table)
-- ============================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'vendors';

-- Expected: Should see policy "Authenticated users can view all vendors"

-- ============================================================================
-- 3. CHECK SEED DATA
-- ============================================================================
SELECT COUNT(*) as service_count FROM services;
-- Expected: 8

SELECT COUNT(*) as vendor_count FROM vendors;
-- Expected: 3

SELECT COUNT(*) as package_count FROM vendor_packages;
-- Expected: 7

SELECT COUNT(*) as vendor_service_count FROM vendor_services;
-- Expected: 5

-- ============================================================================
-- 4. CHECK MARKETPLACE VIEW
-- ============================================================================
SELECT * FROM marketplace_vendors;
-- Expected: Should show 3 vendors with aggregated data

-- ============================================================================
-- 5. TEST VENDOR READ ACCESS (as authenticated user)
-- ============================================================================
SELECT id, business_name, category, location, rating 
FROM vendors 
LIMIT 5;

-- Expected: Should return all vendors without permission errors

-- ============================================================================
-- 6. CHECK QUOTE HELPER FUNCTION
-- ============================================================================
SELECT generate_quote_ref();
-- Expected: Should return format Q-YYYYMMDD-XXXXX (e.g., Q-20260206-A3K9M)

-- ============================================================================
-- COMMON ISSUES
-- ============================================================================
-- 
-- Issue: "permission denied for table vendors"
-- Solution: Run supabase/rls-marketplace-update.sql
-- 
-- Issue: No vendors returned from SELECT
-- Solution: Run supabase/seed-data.sql
-- 
-- Issue: marketplace_vendors view doesn't exist
-- Solution: Run supabase/marketplace.sql
-- 
-- Issue: generate_quote_ref() doesn't exist
-- Solution: Run supabase/quotes.sql
-- 
-- ============================================================================
