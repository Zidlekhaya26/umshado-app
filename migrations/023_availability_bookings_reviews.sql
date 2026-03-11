-- ============================================================================
-- uMshado Migration 023 — Availability, Bookings & Review Requests
-- Run in Supabase SQL Editor
-- ============================================================================

-- ── 1. VENDOR AVAILABILITY (blocked dates) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason      text,                          -- 'booked', 'unavailable', 'holiday'
  note        text,                          -- private note for vendor
  created_at  timestamptz DEFAULT now(),
  UNIQUE (vendor_id, blocked_date)
);

ALTER TABLE public.vendor_availability ENABLE ROW LEVEL SECURITY;

-- Anyone can read availability (couples need to see it)
CREATE POLICY "Anyone can read vendor availability"
  ON public.vendor_availability FOR SELECT
  USING (true);

-- Only the vendor (by user_id) can insert/update/delete
CREATE POLICY "Vendor manages own availability"
  ON public.vendor_availability FOR ALL
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION
      SELECT auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_vendor_availability_vendor_date
  ON public.vendor_availability (vendor_id, blocked_date);

-- ── 2. BOOKINGS ──────────────────────────────────────────────────────────────
-- Extends the existing quotes flow: when a quote is accepted & vendor confirms,
-- a booking record is created for tracking + PDF generation.

CREATE TABLE IF NOT EXISTS public.bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref     text UNIQUE NOT NULL,
  quote_id        uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  couple_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_name    text NOT NULL,
  event_date      date,
  event_location  text,
  confirmed_price bigint NOT NULL,          -- in cents
  vendor_notes    text,
  status          text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled')),
  confirmed_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Booking ref generator
CREATE OR REPLACE FUNCTION public.generate_booking_ref()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  ref text;
  exists_check int;
BEGIN
  LOOP
    ref := 'BK' || LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    SELECT COUNT(*) INTO exists_check FROM public.bookings WHERE booking_ref = ref;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN ref;
END;
$$;

-- Auto-generate booking_ref on insert
CREATE OR REPLACE FUNCTION public.set_booking_ref()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_ref IS NULL OR NEW.booking_ref = '' THEN
    NEW.booking_ref := public.generate_booking_ref();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_booking_ref ON public.bookings;
CREATE TRIGGER trg_set_booking_ref
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_ref();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS policies for bookings
CREATE POLICY "Vendors can view own bookings"
  ON public.bookings FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION SELECT auth.uid()
    )
  );

CREATE POLICY "Vendors can insert bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION SELECT auth.uid()
    )
  );

CREATE POLICY "Vendors and couples can update bookings"
  ON public.bookings FOR UPDATE
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid() UNION SELECT auth.uid())
    OR couple_id = auth.uid()
  );

CREATE INDEX IF NOT EXISTS idx_bookings_vendor   ON public.bookings (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_couple   ON public.bookings (couple_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_event    ON public.bookings (event_date);

-- Also update quotes to add 'booked' status
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('requested','negotiating','accepted','declined','expired','booked'));

-- ── 3. REVIEW REQUESTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  vendor_id   uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  couple_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel     text DEFAULT 'whatsapp',     -- 'whatsapp', 'email', 'sms'
  sent_at     timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (booking_id, vendor_id)
);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own review requests"
  ON public.review_requests FOR ALL
  USING (
    vendor_id IN (
      SELECT id FROM public.vendors WHERE user_id = auth.uid()
      UNION SELECT auth.uid()
    )
  );

CREATE POLICY "Couples can read review requests sent to them"
  ON public.review_requests FOR SELECT
  USING (couple_id = auth.uid());

-- ── 4. VENDOR_REVIEWS (if not already created in 022) ────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  couple_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, couple_id)
);

ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vendor reviews"
  ON public.vendor_reviews FOR SELECT USING (true);

CREATE POLICY "Couples can write own reviews"
  ON public.vendor_reviews FOR INSERT
  WITH CHECK (auth.uid() = couple_id);

CREATE POLICY "Couples can update own reviews"
  ON public.vendor_reviews FOR UPDATE
  USING (auth.uid() = couple_id);

CREATE POLICY "Couples can delete own reviews"
  ON public.vendor_reviews FOR DELETE
  USING (auth.uid() = couple_id);

-- ── 5. VENDOR RATING CACHE ───────────────────────────────────────────────────
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS rating       numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count int          DEFAULT 0;

-- Auto-update vendor rating cache on every review change
CREATE OR REPLACE FUNCTION public.recalculate_vendor_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  vid uuid;
BEGIN
  vid := COALESCE(NEW.vendor_id, OLD.vendor_id);
  UPDATE public.vendors
  SET
    rating       = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.vendor_reviews WHERE vendor_id = vid), 0),
    review_count = COALESCE((SELECT COUNT(*) FROM public.vendor_reviews WHERE vendor_id = vid), 0),
    updated_at   = now()
  WHERE id = vid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_rating ON public.vendor_reviews;
CREATE TRIGGER trg_vendor_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_vendor_rating();

-- ── 6. EXPOSE IN MARKETPLACE VIEW ───────────────────────────────────────────
-- Rebuild marketplace_vendors view to include rating, review_count
DROP VIEW IF EXISTS public.marketplace_vendors;
CREATE VIEW public.marketplace_vendors AS
SELECT
  v.id,
  v.business_name,
  v.logo_url,
  v.verified,
  v.category,
  v.location AS city,
  NULL::text AS country,
  v.description,
  v.rating,
  v.review_count,
  v.featured,
  v.featured_until,
  v.plan,
  v.plan_until,
  (SELECT MIN(vp.base_price) FROM public.vendor_packages vp WHERE vp.vendor_id = v.id) AS min_from_price,
  (SELECT COALESCE(array_agg(DISTINCT s.name), ARRAY[]::text[])
   FROM public.vendor_services vs
   LEFT JOIN public.services s ON vs.service_id = s.id
   WHERE vs.vendor_id = v.id AND s.name IS NOT NULL) AS services,
  (SELECT COUNT(*) FROM public.vendor_packages vp WHERE vp.vendor_id = v.id) AS package_count,
  v.created_at
FROM public.vendors v
WHERE v.is_published = true;
