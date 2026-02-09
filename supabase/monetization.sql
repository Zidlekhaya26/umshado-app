-- Monetization structures (no payments yet)

-- 1) Add vendor plan fields
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' CHECK (plan IN ('free','featured','pro')),
  ADD COLUMN IF NOT EXISTS plan_until timestamptz NULL;

-- 2) Vendor subscriptions table
CREATE TABLE IF NOT EXISTS public.vendor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free','featured','pro')),
  status text NOT NULL CHECK (status IN ('active','canceled','expired')),
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own subscriptions
DROP POLICY IF EXISTS "Vendors can view own subscriptions" ON public.vendor_subscriptions;
CREATE POLICY "Vendors can view own subscriptions"
ON public.vendor_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

-- 3) Conversions (commission-ready)
CREATE TABLE IF NOT EXISTS public.conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  couple_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int,
  status text DEFAULT 'accepted' CHECK (status IN ('accepted','completed','refunded')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

-- Vendors can view own conversions
DROP POLICY IF EXISTS "Vendors can view own conversions" ON public.conversions;
CREATE POLICY "Vendors can view own conversions"
ON public.conversions
FOR SELECT
TO authenticated
USING (auth.uid() = vendor_id);

-- Couples can view own conversions
DROP POLICY IF EXISTS "Couples can view own conversions" ON public.conversions;
CREATE POLICY "Couples can view own conversions"
ON public.conversions
FOR SELECT
TO authenticated
USING (auth.uid() = couple_id);

-- Couples can insert conversions for their accepted quotes
DROP POLICY IF EXISTS "Couples can insert own conversions" ON public.conversions;
CREATE POLICY "Couples can insert own conversions"
ON public.conversions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = couple_id);
