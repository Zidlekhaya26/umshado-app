-- ============================================================================
-- Add vendor_media and vendor_selected_services
-- ============================================================================
-- Creates two tables used by the marketplace UI and enforces RLS + constraints
-- Run in Supabase SQL editor or include in your migration pipeline
-- ============================================================================

-- VENDOR MEDIA
CREATE TABLE IF NOT EXISTS public.vendor_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('image','video')),
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_media_vendor_id ON public.vendor_media(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_media_created_at ON public.vendor_media(created_at DESC);

ALTER TABLE public.vendor_media ENABLE ROW LEVEL SECURITY;

-- Vendors may fully manage their own media rows
CREATE POLICY "Vendors can manage their own media"
ON public.vendor_media
FOR ALL
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Public (authenticated or anonymous) may SELECT media only for published vendors
CREATE POLICY "Public can select published vendor media"
ON public.vendor_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = vendor_media.vendor_id AND COALESCE(v.is_published, false) = true
  )
);


-- VENDOR SELECTED SERVICES
CREATE TABLE IF NOT EXISTS public.vendor_selected_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT vendor_service_unique UNIQUE (vendor_id, service_id)
);

-- If there's a vendor_services table, reference it; otherwise leave service_id as uuid.
-- (Using a separate index is safe either way)
CREATE INDEX IF NOT EXISTS idx_vendor_selected_services_vendor_id ON public.vendor_selected_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_selected_services_service_id ON public.vendor_selected_services(service_id);

ALTER TABLE public.vendor_selected_services ENABLE ROW LEVEL SECURITY;

-- Vendors can insert/update/delete their own selected services
CREATE POLICY "Vendors can manage their selected services"
ON public.vendor_selected_services
FOR ALL
USING (auth.uid() = vendor_id)
WITH CHECK (auth.uid() = vendor_id);

-- Public may SELECT selected services only for published vendors
CREATE POLICY "Public can select published vendor selected services"
ON public.vendor_selected_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = vendor_selected_services.vendor_id AND COALESCE(v.is_published, false) = true
  )
);

-- Optional: keep small housekeeping metadata index
CREATE INDEX IF NOT EXISTS idx_vendor_selected_services_created_at ON public.vendor_selected_services(created_at DESC);
