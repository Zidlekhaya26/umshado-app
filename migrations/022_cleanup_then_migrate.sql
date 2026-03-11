-- ============================================================
-- Cleanup script: Remove existing vendor reviews/verification system
-- Run this FIRST if you need to re-apply migration 022
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "anyone can read reviews" ON vendor_reviews;
DROP POLICY IF EXISTS "couples can insert review" ON vendor_reviews;
DROP POLICY IF EXISTS "couples can update own review" ON vendor_reviews;
DROP POLICY IF EXISTS "couples can delete own review" ON vendor_reviews;
DROP POLICY IF EXISTS "vendors can read own verification request" ON verification_requests;
DROP POLICY IF EXISTS "vendors can submit verification request" ON verification_requests;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_vendor_review_rating ON vendor_reviews;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_recalc_vendor_rating();
DROP FUNCTION IF EXISTS recalculate_vendor_rating(uuid);

-- Drop views
DROP VIEW IF EXISTS public.marketplace_vendors;

-- Drop tables (CASCADE will handle foreign keys)
DROP TABLE IF EXISTS verification_requests CASCADE;
DROP TABLE IF EXISTS vendor_reviews CASCADE;

-- Remove columns from vendors table
ALTER TABLE vendors 
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS review_count;

-- ============================================================
-- NOW RE-CREATE: Run 022_ratings_reviews_verification.sql
-- ============================================================

-- ── 1. Vendor reviews table ──────────────────────────────────
CREATE TABLE vendor_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  couple_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, couple_id)
);

CREATE INDEX idx_vendor_reviews_vendor_id ON vendor_reviews(vendor_id);
CREATE INDEX idx_vendor_reviews_couple_id ON vendor_reviews(couple_id);

-- ── 2. RLS for reviews ───────────────────────────────────────
ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read reviews"
  ON vendor_reviews FOR SELECT
  USING (true);

CREATE POLICY "couples can insert review"
  ON vendor_reviews FOR INSERT
  WITH CHECK (auth.uid() = couple_id);

CREATE POLICY "couples can update own review"
  ON vendor_reviews FOR UPDATE
  USING (auth.uid() = couple_id);

CREATE POLICY "couples can delete own review"
  ON vendor_reviews FOR DELETE
  USING (auth.uid() = couple_id);

-- ── 3. Add rating/review_count cache columns to vendors ──────
ALTER TABLE vendors
  ADD COLUMN rating       numeric(3,2) DEFAULT 0,
  ADD COLUMN review_count integer DEFAULT 0;

-- ── 4. Function to recalculate vendor rating ─────────────────
CREATE OR REPLACE FUNCTION recalculate_vendor_rating(vid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE vendors
  SET
    rating       = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM vendor_reviews WHERE vendor_id = vid), 0),
    review_count = COALESCE((SELECT COUNT(*) FROM vendor_reviews WHERE vendor_id = vid), 0),
    updated_at   = now()
  WHERE id = vid;
END;
$$;

-- ── 5. Trigger to auto-update rating on review changes ───────
CREATE OR REPLACE FUNCTION trigger_recalc_vendor_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_rating(OLD.vendor_id);
  ELSE
    PERFORM recalculate_vendor_rating(NEW.vendor_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vendor_review_rating
  AFTER INSERT OR UPDATE OR DELETE ON vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_vendor_rating();

-- ── 6. Expose rating columns in marketplace_vendors view ──────
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
  v.rating,
  v.review_count,
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

GRANT SELECT ON public.marketplace_vendors TO public;

-- ── 7. Verification requests table ───────────────────────────
CREATE TABLE verification_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes         text,
  admin_notes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);

CREATE INDEX idx_verification_requests_vendor_id ON verification_requests(vendor_id);
CREATE INDEX idx_verification_requests_status   ON verification_requests(status);

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors can read own verification request"
  ON verification_requests FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
      UNION
      SELECT id FROM vendors WHERE id = auth.uid()
    )
  );

CREATE POLICY "vendors can submit verification request"
  ON verification_requests FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
      UNION
      SELECT id FROM vendors WHERE id = auth.uid()
    )
  );
