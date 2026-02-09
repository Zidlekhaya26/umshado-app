-- Add profile role switching support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_couple boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_vendor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_role text CHECK (active_role IN ('couple','vendor'));

-- Backfill role availability
UPDATE public.profiles p
SET has_couple = EXISTS (
  SELECT 1 FROM public.couples c WHERE c.id = p.id
);

UPDATE public.profiles p
SET has_vendor = EXISTS (
  SELECT 1 FROM public.vendors v WHERE v.id = p.id
);

-- Backfill active_role
UPDATE public.profiles p
SET active_role = COALESCE(p.role, 'couple')
WHERE p.active_role IS NULL;
