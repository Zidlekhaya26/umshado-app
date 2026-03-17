-- ============================================================
-- Migration 024: Vendor subscription tiers, billing intents, and boosts
-- ============================================================

-- 1) Vendor subscription columns
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS subscription_tier text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_paid_at timestamptz;

UPDATE public.vendors
SET
  subscription_tier = COALESCE(subscription_tier, 'free'),
  subscription_status = COALESCE(subscription_status, 'inactive'),
  trial_started_at = COALESCE(trial_started_at, created_at, now())
WHERE subscription_tier IS NULL
   OR subscription_status IS NULL
   OR trial_started_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendors_subscription_tier_check'
      AND conrelid = 'public.vendors'::regclass
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_subscription_tier_check
      CHECK (subscription_tier IN ('trial', 'free', 'pro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendors_subscription_status_check'
      AND conrelid = 'public.vendors'::regclass
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_subscription_status_check
      CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'expired'));
  END IF;
END $$;

ALTER TABLE public.vendors
  ALTER COLUMN subscription_tier SET DEFAULT 'free',
  ALTER COLUMN subscription_status SET DEFAULT 'inactive',
  ALTER COLUMN trial_started_at SET DEFAULT now();

-- 2) Payment intents table (for PayFast flow tracking)
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid NULL,
  payment_type text NOT NULL DEFAULT 'pro',
  plan text NULL,
  billing_cycle text NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending',
  ad_creative jsonb NULL,
  metadata jsonb NULL,
  payfast_payment_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS ad_creative jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS payfast_payment_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_intents_vendor_id ON public.payment_intents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON public.payment_intents(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_intents_payment_type_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE public.payment_intents
      ADD CONSTRAINT payment_intents_payment_type_check
      CHECK (payment_type IN ('pro', 'verification', 'boost'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_intents_billing_cycle_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE public.payment_intents
      ADD CONSTRAINT payment_intents_billing_cycle_check
      CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly'));
  END IF;
END $$;

-- 3) Billing transactions ledger
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  plan text NULL,
  payment_type text NULL,
  billing_cycle text NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  payfast_payment_id text NULL,
  status text NOT NULL DEFAULT 'complete',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS payfast_payment_id text,
  ADD COLUMN IF NOT EXISTS status text;

CREATE INDEX IF NOT EXISTS idx_billing_transactions_vendor_id ON public.billing_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created_at ON public.billing_transactions(created_at DESC);

-- 4) Extend verification request lifecycle for paid reviews
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS amount_cents integer,
  ADD COLUMN IF NOT EXISTS payfast_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
DECLARE
  c_name text;
BEGIN
  -- Drop all existing status CHECK constraints (by name pattern or definition)
  FOR c_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.verification_requests'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%status IN%'
           OR conname = 'verification_requests_status_check')
  LOOP
    EXECUTE format('ALTER TABLE public.verification_requests DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_status_check
  CHECK (status IN ('pending', 'payment_pending', 'paid_pending_review', 'approved', 'rejected', 'payment_failed'));

-- 5) Vendor boost campaigns for sponsored ads
CREATE TABLE IF NOT EXISTS public.vendor_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  amount_cents integer NOT NULL DEFAULT 19900 CHECK (amount_cents > 0),
  ad_headline text,
  ad_body text,
  ad_cta text,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  payfast_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_boosts_vendor_id ON public.vendor_boosts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_boosts_active_window ON public.vendor_boosts(status, started_at, ends_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_boosts_status_check'
      AND conrelid = 'public.vendor_boosts'::regclass
  ) THEN
    ALTER TABLE public.vendor_boosts
      ADD CONSTRAINT vendor_boosts_status_check
      CHECK (status IN ('active', 'expired', 'cancelled'));
  END IF;
END $$;

ALTER TABLE public.vendor_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors can read own boosts" ON public.vendor_boosts;
CREATE POLICY "vendors can read own boosts"
  ON public.vendor_boosts FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.vendors WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendors can insert own boosts" ON public.vendor_boosts;
CREATE POLICY "vendors can insert own boosts"
  ON public.vendor_boosts FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.vendors WHERE id = auth.uid()
    )
  );
