-- Migration: Add media and publish columns to vendors table
-- Run this in your Supabase SQL editor

-- Add media columns if they don't exist
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS portfolio_urls text[] DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Ensure portfolio_images column exists (tracks count)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS portfolio_images integer DEFAULT 0;

-- Ensure contact column exists (jsonb for whatsapp, phone, preferredContact)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact jsonb DEFAULT '{}';

-- Create the vendor-media storage bucket (public for serving images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-media', 'vendor-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own vendor folder
CREATE POLICY "Vendors can upload their own media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vendor-media'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
    UNION
    SELECT id::text FROM vendors WHERE id = auth.uid()
  )
);

-- Allow public read access to vendor media
CREATE POLICY "Public can view vendor media" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'vendor-media');

-- Allow vendors to delete their own media
CREATE POLICY "Vendors can delete their own media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'vendor-media'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM vendors WHERE user_id = auth.uid()
    UNION
    SELECT id::text FROM vendors WHERE id = auth.uid()
  )
);

-- ============================================================================
-- UPDATE marketplace_vendors VIEW to filter by is_published
-- ============================================================================
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
  v.logo_url,
  v.is_published,
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
WHERE v.business_name IS NOT NULL
  AND v.is_published = true;

GRANT SELECT ON public.marketplace_vendors TO authenticated;

-- Mark existing vendors that already have data as published
-- (so they still appear on the marketplace after this migration)
UPDATE vendors
SET is_published = true
WHERE business_name IS NOT NULL
  AND is_published IS NOT true;
