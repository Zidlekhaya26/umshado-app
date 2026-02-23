-- Migration: add indexes to improve marketplace filtering and vendor page performance
-- Run: psql -f migrations/016_add_vendor_indexes.sql

-- Index on vendor location for faster region/city filtering
CREATE INDEX IF NOT EXISTS idx_vendors_location ON public.vendors(location);

-- Index on vendor created_at for newest sorting
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON public.vendors(created_at DESC);

-- Index on vendor_packages.vendor_id for faster package lookups per vendor
CREATE INDEX IF NOT EXISTS idx_vendor_packages_vendor_id ON public.vendor_packages(vendor_id);
