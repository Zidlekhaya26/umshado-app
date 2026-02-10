-- Migration: mark Noxa vendors as verified
-- This migration sets `verified = true` for vendors whose business_name
-- matches 'noxa' (case-insensitive). Review before applying to production.

BEGIN;

UPDATE vendors
SET verified = true
WHERE business_name ILIKE '%noxa%';

COMMIT;

-- NOTE: This migration updates all rows matching the pattern. If you prefer
-- to target a single vendor by id, replace the WHERE clause with
-- `WHERE id = '<VENDOR_ID>'` before running.
