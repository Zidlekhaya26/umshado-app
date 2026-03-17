-- ============================================================
-- Migration 025: Seed Noxa as a fully paid Pro + Verified vendor
-- Applies to all vendor rows where business_name ILIKE '%noxa%'
-- ============================================================

-- 1) Set subscription tier, status, and expiry (5 years)
UPDATE public.vendors
SET
  subscription_tier      = 'pro',
  subscription_status    = 'active',
  trial_started_at       = COALESCE(trial_started_at, created_at, now()),
  subscription_expires_at = now() + INTERVAL '5 years',
  verified               = true,
  verification_status    = 'approved',
  verification_paid_at   = COALESCE(verification_paid_at, now()),
  featured               = true,
  featured_until         = now() + INTERVAL '5 years'
WHERE business_name ILIKE '%noxa%';

-- 2) Log a pro billing transaction for each Noxa vendor
INSERT INTO public.billing_transactions (vendor_id, plan, payment_type, billing_cycle, amount_cents, status)
SELECT id, 'pro', 'pro', 'yearly', 49900, 'complete'
FROM public.vendors
WHERE business_name ILIKE '%noxa%'
ON CONFLICT DO NOTHING;

-- 3) Log a verification billing transaction for each Noxa vendor
INSERT INTO public.billing_transactions (vendor_id, plan, payment_type, amount_cents, status)
SELECT id, 'verification', 'verification', 9900, 'complete'
FROM public.vendors
WHERE business_name ILIKE '%noxa%'
ON CONFLICT DO NOTHING;

-- 4) Create an active boost campaign for each Noxa vendor (5-year window)
INSERT INTO public.vendor_boosts (
  vendor_id, status, amount_cents,
  ad_headline, ad_body, ad_cta,
  started_at, ends_at
)
SELECT
  id,
  'active',
  19900,
  'Noxa — Wedding Planning, Reimagined',
  'Stress-free planning from first look to last dance. Noxa brings together coordination, vendor matching & day-of support for modern SA weddings.',
  'Explore Services',
  now(),
  now() + INTERVAL '5 years'
FROM public.vendors
WHERE business_name ILIKE '%noxa%'
ON CONFLICT DO NOTHING;

-- 5) Mark any pending verification requests as approved
UPDATE public.verification_requests
SET
  status      = 'approved',
  reviewed_at = COALESCE(reviewed_at, now()),
  paid_at     = COALESCE(paid_at, now())
WHERE vendor_id IN (
  SELECT id FROM public.vendors WHERE business_name ILIKE '%noxa%'
);
