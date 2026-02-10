-- Migration: add logo_url to marketplace_vendors view
-- Run: psql -f migrations/014_add_logo_to_marketplace_view.sql

DROP VIEW IF EXISTS public.marketplace_vendors;

CREATE OR REPLACE VIEW public.marketplace_vendors AS
SELECT 
  v.id AS vendor_id,
  v.business_name,
  v.logo_url,
  v.verified,
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
  (
    SELECT MIN(vp.base_price)
    FROM vendor_packages vp
    WHERE vp.vendor_id = v.id
  ) AS min_from_price,
  (
    SELECT COALESCE(array_agg(DISTINCT s.name), ARRAY[]::text[])
    FROM vendor_services vs
    LEFT JOIN services s ON vs.service_id = s.id
    WHERE vs.vendor_id = v.id AND s.name IS NOT NULL
  ) AS services,
  (
    SELECT COUNT(*)
    FROM vendor_packages vp
    WHERE vp.vendor_id = v.id
  ) AS package_count
FROM vendors v
WHERE v.business_name IS NOT NULL;

GRANT SELECT ON public.marketplace_vendors TO authenticated;
