-- ============================================================================
-- Maintenance: Remove duplicate vendors + updated_at trigger
-- ============================================================================

-- ============================================================================
-- 1) Remove duplicate vendors by user_id (keep newest)
--    Only runs if vendors.user_id column exists
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'user_id'
  ) THEN
    WITH ranked AS (
      SELECT
        ctid,
        user_id,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM public.vendors
      WHERE user_id IS NOT NULL
    )
    DELETE FROM public.vendors v
    USING ranked r
    WHERE v.ctid = r.ctid
      AND r.rn > 1;

    -- Prevent future duplicates if user_id exists
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_user_id_unique ON public.vendors(user_id);
    EXCEPTION
      WHEN others THEN
        -- Ignore if index creation fails (e.g., column not found or permissions)
        NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- 2) Auto-update updated_at on quotes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_quotes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_set_updated_at ON public.quotes;
CREATE TRIGGER quotes_set_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.set_quotes_updated_at();
