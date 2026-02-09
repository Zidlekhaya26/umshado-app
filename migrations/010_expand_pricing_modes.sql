-- ============================================================================
-- Migration 010: Expand vendor_packages pricing_mode CHECK constraint
-- ============================================================================
-- The original schema only allowed ('guest', 'time').
-- This migration expands it to support all MVP pricing modes.
-- Safe to re-run.
-- ============================================================================

-- 1. Drop old restrictive CHECK constraint
DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'vendor_packages'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%pricing_mode%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.vendor_packages DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- 2. Add new permissive CHECK constraint
ALTER TABLE public.vendor_packages
ADD CONSTRAINT vendor_packages_pricing_mode_check
CHECK (pricing_mode IN (
  'guest',
  'time',
  'per-person',
  'package',
  'event',
  'quantity'
));
