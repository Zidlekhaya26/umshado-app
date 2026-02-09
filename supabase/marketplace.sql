-- ============================================================================
-- Marketplace View and Policies for uMshado
-- ============================================================================
-- This file creates a public read-only view for marketplace vendors
-- Run this in Supabase SQL Editor after tables and RLS are set up
-- ============================================================================

-- ============================================================================
-- CREATE MARKETPLACE VENDORS VIEW
-- ============================================================================
-- This view aggregates vendor data with packages and services for marketplace display
-- Couples can read this view safely without accessing vendor private data

DROP VIEW IF EXISTS public.marketplace_vendors;

CREATE OR REPLACE VIEW public.marketplace_vendors AS
SELECT 
  v.id AS vendor_id,
  v.business_name,
  v.category,
  v.location AS city,
  NULL::text AS country,
  v.description,
  v.created_at,
  v.updated_at,
  v.featured,
  v.featured_until,
  v.plan,
  v.plan_until,
  -- Compute minimum package price
  (
    SELECT MIN(vp.base_price)
    FROM vendor_packages vp
    WHERE vp.vendor_id = v.id
  ) AS min_from_price,
  -- Aggregate services as array of service names
  (
    SELECT COALESCE(array_agg(DISTINCT s.name), ARRAY[]::text[])
    FROM vendor_services vs
    LEFT JOIN services s ON vs.service_id = s.id
    WHERE vs.vendor_id = v.id AND s.name IS NOT NULL
  ) AS services,
  -- Count packages for profile completeness scoring
  (
    SELECT COUNT(*)
    FROM vendor_packages vp
    WHERE vp.vendor_id = v.id
  ) AS package_count
FROM vendors v
WHERE v.business_name IS NOT NULL;

-- ============================================================================
-- GRANT SELECT ACCESS TO AUTHENTICATED USERS
-- ============================================================================
-- Allow all authenticated users (couples + vendors) to read marketplace

GRANT SELECT ON public.marketplace_vendors TO authenticated;

-- ============================================================================
-- OPTIONAL: Add index for better performance
-- ============================================================================
-- Create indexes on columns used for filtering and sorting

CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_business_name ON vendors(business_name);
CREATE INDEX IF NOT EXISTS idx_vendors_updated_at ON vendors(updated_at);
CREATE INDEX IF NOT EXISTS idx_vendor_packages_base_price ON vendor_packages(base_price);

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the view is working:
-- 
-- SELECT * FROM marketplace_vendors LIMIT 5;
--
-- Expected: Returns vendor data with computed min_from_price and services array
-- ============================================================================
