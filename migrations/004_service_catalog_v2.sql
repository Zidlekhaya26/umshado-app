-- ============================================================
-- Migration 004: Canonical Service Catalog v2
-- ============================================================
-- • Adds pricing_type + is_mvp columns to services table
-- • Replaces old seed data with comprehensive MVP catalog
-- • Adds Honeymoon & Travel, Support Services categories
-- • Photography & Video = ONE category (no duplicates)
-- • Phase 2 categories seeded but flagged is_mvp = false
-- • Pricing types enforced per spec
-- ============================================================

-- 1) Add new columns to services table (safe if already exist)
DO $$
BEGIN
  -- pricing_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE services ADD COLUMN pricing_type VARCHAR(30) DEFAULT 'event-based';
  END IF;

  -- is_mvp column (true = show in UI, false = Phase 2 hidden)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'is_mvp'
  ) THEN
    ALTER TABLE services ADD COLUMN is_mvp BOOLEAN DEFAULT TRUE;
  END IF;

  -- sort_order for consistent display ordering
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2) Create index on category + is_mvp for fast filtered lookups
CREATE INDEX IF NOT EXISTS idx_services_category_mvp ON services(category, is_mvp);

-- 3) Remove old seed data that will be replaced
--    (Only deletes services not referenced by any vendor_services row)
DELETE FROM services
WHERE id NOT IN (SELECT DISTINCT service_id FROM vendor_services WHERE service_id IS NOT NULL);

-- ============================================================
-- 4) Seed MVP Categories + Services
-- ============================================================
-- Uses ON CONFLICT (name) DO UPDATE to set correct pricing_type/category
-- on existing rows and insert new ones cleanly.

-- ── Catering & Food (guest-based) ────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Wedding catering',                    'Catering & Food', 'guest-based', true,  1),
  ('Custom menus',                        'Catering & Food', 'guest-based', true,  2),
  ('Buffet service',                      'Catering & Food', 'guest-based', true,  3),
  ('Plated service',                      'Catering & Food', 'guest-based', true,  4),
  ('Traditional dishes',                  'Catering & Food', 'guest-based', true,  5),
  ('Canapés & desserts',                  'Catering & Food', 'guest-based', true,  6),
  ('Beverage service (non-alcoholic)',    'Catering & Food', 'guest-based', true,  7),
  ('On-site preparation',                'Catering & Food', 'guest-based', true,  8),
  ('Serving staff',                       'Catering & Food', 'guest-based', true,  9),
  ('Equipment hire (catering equipment)', 'Catering & Food', 'guest-based', true, 10),
  ('Dietary options (halaal/vegan/gluten-free)', 'Catering & Food', 'guest-based', true, 11),
  ('Cake & desserts table',              'Catering & Food', 'guest-based', true, 12),
  ('Mobile food station / street food',  'Catering & Food', 'guest-based', true, 13),
  ('Coffee / tea station',               'Catering & Food', 'guest-based', true, 14)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Décor & Styling (guest-based) ────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Full venue décor',              'Décor & Styling', 'guest-based', true,  1),
  ('Floral arrangements',           'Décor & Styling', 'guest-based', true,  2),
  ('Table styling & centerpieces',  'Décor & Styling', 'guest-based', true,  3),
  ('Draping & fabric styling',      'Décor & Styling', 'guest-based', true,  4),
  ('Backdrops & photo walls',       'Décor & Styling', 'guest-based', true,  5),
  ('Aisle décor',                   'Décor & Styling', 'guest-based', true,  6),
  ('Stage décor',                   'Décor & Styling', 'guest-based', true,  7),
  ('Ceiling décor',                 'Décor & Styling', 'guest-based', true,  8),
  ('Ambient fairy lights',          'Décor & Styling', 'guest-based', true,  9),
  ('Seating plan / signage setup',  'Décor & Styling', 'guest-based', true, 10),
  ('Theme styling',                 'Décor & Styling', 'guest-based', true, 11),
  ('Bridal bouquet & boutonnieres', 'Décor & Styling', 'guest-based', true, 12),
  ('Balloon styling',               'Décor & Styling', 'guest-based', true, 13)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Photography & Video (time-based) — ONE category ──────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Wedding photography',       'Photography & Video', 'time-based', true,  1),
  ('Wedding videography',       'Photography & Video', 'time-based', true,  2),
  ('Pre-wedding shoot',         'Photography & Video', 'time-based', true,  3),
  ('Engagement shoot',          'Photography & Video', 'time-based', true,  4),
  ('Traditional ceremony coverage', 'Photography & Video', 'time-based', true, 5),
  ('White wedding coverage',    'Photography & Video', 'time-based', true,  6),
  ('Bridal prep coverage',      'Photography & Video', 'time-based', true,  7),
  ('Groom prep coverage',       'Photography & Video', 'time-based', true,  8),
  ('Reception coverage',        'Photography & Video', 'time-based', true,  9),
  ('Drone photography',         'Photography & Video', 'time-based', true, 10),
  ('Drone videography',         'Photography & Video', 'time-based', true, 11),
  ('Highlight video',           'Photography & Video', 'time-based', true, 12),
  ('Full wedding film',         'Photography & Video', 'time-based', true, 13),
  ('Same-day edit (SDE)',       'Photography & Video', 'time-based', true, 14),
  ('Live streaming',            'Photography & Video', 'time-based', true, 15),
  ('Photo editing & retouching','Photography & Video', 'time-based', true, 16),
  ('Video color grading',       'Photography & Video', 'time-based', true, 17),
  ('Digital gallery delivery',  'Photography & Video', 'time-based', true, 18),
  ('Album design',              'Photography & Video', 'time-based', true, 19),
  ('Album printing',            'Photography & Video', 'time-based', true, 20)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Music, DJ & Sound (time-based) ───────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('DJ services',              'Music, DJ & Sound', 'time-based', true, 1),
  ('Live band performance',    'Music, DJ & Sound', 'time-based', true, 2),
  ('Sound system hire',        'Music, DJ & Sound', 'time-based', true, 3),
  ('PA system setup',          'Music, DJ & Sound', 'time-based', true, 4),
  ('Microphones & mixers',     'Music, DJ & Sound', 'time-based', true, 5),
  ('Lighting setup (party lighting)', 'Music, DJ & Sound', 'time-based', true, 6),
  ('MC / Host services',       'Music, DJ & Sound', 'time-based', true, 7),
  ('Ceremony sound setup',     'Music, DJ & Sound', 'time-based', true, 8),
  ('Reception sound setup',    'Music, DJ & Sound', 'time-based', true, 9)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Makeup & Hair (per-person) ───────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Bridal makeup',                        'Makeup & Hair', 'per-person', true,  1),
  ('Traditional bridal makeup',            'Makeup & Hair', 'per-person', true,  2),
  ('Bridal trial makeup',                  'Makeup & Hair', 'per-person', true,  3),
  ('Bridesmaids makeup',                   'Makeup & Hair', 'per-person', true,  4),
  ('Mother of the bride/groom makeup',     'Makeup & Hair', 'per-person', true,  5),
  ('Groom grooming',                       'Makeup & Hair', 'per-person', true,  6),
  ('Bridal hair styling',                  'Makeup & Hair', 'per-person', true,  7),
  ('Bridesmaids hair styling',             'Makeup & Hair', 'per-person', true,  8),
  ('Wig installation & styling',           'Makeup & Hair', 'per-person', true,  9),
  ('Touch-up services',                    'Makeup & Hair', 'per-person', true, 10),
  ('HD / airbrush makeup',                 'Makeup & Hair', 'per-person', true, 11),
  ('Lash application',                     'Makeup & Hair', 'per-person', true, 12)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Attire & Fashion (package-based) ─────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Wedding dress design',          'Attire & Fashion', 'package-based', true,  1),
  ('Dress hire',                    'Attire & Fashion', 'package-based', true,  2),
  ('Dress alterations',             'Attire & Fashion', 'package-based', true,  3),
  ('Suit hire',                     'Attire & Fashion', 'package-based', true,  4),
  ('Suit tailoring',                'Attire & Fashion', 'package-based', true,  5),
  ('Groom & groomsmen styling',     'Attire & Fashion', 'package-based', true,  6),
  ('Bridesmaids dresses',           'Attire & Fashion', 'package-based', true,  7),
  ('Traditional wear (couple)',     'Attire & Fashion', 'package-based', true,  8),
  ('Traditional wear (family)',     'Attire & Fashion', 'package-based', true,  9),
  ('Accessories',                   'Attire & Fashion', 'package-based', true, 10),
  ('Shoes',                         'Attire & Fashion', 'package-based', true, 11)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Wedding Venues (event-based) ─────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Venue hire (ceremony)',           'Wedding Venues', 'event-based', true, 1),
  ('Venue hire (reception)',          'Wedding Venues', 'event-based', true, 2),
  ('Full wedding venue package',     'Wedding Venues', 'event-based', true, 3),
  ('Outdoor venue',                  'Wedding Venues', 'event-based', true, 4),
  ('Indoor hall',                    'Wedding Venues', 'event-based', true, 5),
  ('Garden venue',                   'Wedding Venues', 'event-based', true, 6),
  ('Accommodation on-site',         'Wedding Venues', 'event-based', true, 7),
  ('Changing rooms (bride/groom)',   'Wedding Venues', 'event-based', true, 8)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Transport (time-based) ───────────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Bridal car hire',           'Transport', 'time-based', true, 1),
  ('Groom car hire',            'Transport', 'time-based', true, 2),
  ('Shuttle services (guests)', 'Transport', 'time-based', true, 3),
  ('Bus hire',                  'Transport', 'time-based', true, 4),
  ('Luxury vehicle hire',       'Transport', 'time-based', true, 5),
  ('Chauffeur service',         'Transport', 'time-based', true, 6),
  ('After-party transport',     'Transport', 'time-based', true, 7)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Honeymoon & Travel (package-based) ───────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Honeymoon packages',              'Honeymoon & Travel', 'package-based', true, 1),
  ('Resort bookings',                 'Honeymoon & Travel', 'package-based', true, 2),
  ('Hotel bookings',                  'Honeymoon & Travel', 'package-based', true, 3),
  ('Flight booking assistance',       'Honeymoon & Travel', 'package-based', true, 4),
  ('Romantic excursions',             'Honeymoon & Travel', 'package-based', true, 5),
  ('Couples spa packages',            'Honeymoon & Travel', 'package-based', true, 6),
  ('Candlelight dinner setup',        'Honeymoon & Travel', 'package-based', true, 7),
  ('Itinerary planning',              'Honeymoon & Travel', 'package-based', true, 8),
  ('Destination honeymoon packages',  'Honeymoon & Travel', 'package-based', true, 9)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Support Services (event-based) ───────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Cleaning services (pre-event)',         'Support Services', 'event-based', true, 1),
  ('Cleaning services (post-event)',        'Support Services', 'event-based', true, 2),
  ('Security services',                     'Support Services', 'event-based', true, 3),
  ('Event marshals / crowd control',        'Support Services', 'event-based', true, 4),
  ('Parking management',                    'Support Services', 'event-based', true, 5),
  ('Valet parking',                         'Support Services', 'event-based', true, 6),
  ('Ushers / guest seating assistance',     'Support Services', 'event-based', true, 7),
  ('Childcare services',                    'Support Services', 'event-based', true, 8),
  ('Elderly/accessibility assistance',      'Support Services', 'event-based', true, 9)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 5) Phase 2 Categories (seeded but hidden in UI)
-- ============================================================

-- ── Furniture & Equipment Hire (quantity-based) ──────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Table hire',                'Furniture & Equipment Hire', 'quantity-based', false, 1),
  ('Chair hire',                'Furniture & Equipment Hire', 'quantity-based', false, 2),
  ('Linen hire',                'Furniture & Equipment Hire', 'quantity-based', false, 3),
  ('Crockery & cutlery hire',   'Furniture & Equipment Hire', 'quantity-based', false, 4),
  ('Glassware hire',            'Furniture & Equipment Hire', 'quantity-based', false, 5),
  ('Tent / marquee hire',       'Furniture & Equipment Hire', 'quantity-based', false, 6),
  ('Lounge furniture hire',     'Furniture & Equipment Hire', 'quantity-based', false, 7),
  ('Red carpet hire',           'Furniture & Equipment Hire', 'quantity-based', false, 8)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Special Effects & Experiences ────────────────────────
INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Fireworks display',           'Special Effects & Experiences', 'event-based', false, 1),
  ('Cold spark machines',         'Special Effects & Experiences', 'event-based', false, 2),
  ('Smoke / fog machines',        'Special Effects & Experiences', 'event-based', false, 3),
  ('Confetti cannons',            'Special Effects & Experiences', 'event-based', false, 4),
  ('Photo booth',                 'Special Effects & Experiences', 'event-based', false, 5),
  ('360° video booth',            'Special Effects & Experiences', 'event-based', false, 6),
  ('Fire dancers / performers',   'Special Effects & Experiences', 'event-based', false, 7),
  ('Lantern / balloon release',   'Special Effects & Experiences', 'event-based', false, 8)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ── Planning & Coordination (Phase 2) ───────────────────
-- Update existing Planning & Coordination rows to Phase 2
UPDATE services SET is_mvp = false WHERE category = 'Planning & Coordination';

INSERT INTO services (name, category, pricing_type, is_mvp, sort_order) VALUES
  ('Full planning',          'Planning & Coordination', 'event-based', false, 1),
  ('Partial planning',       'Planning & Coordination', 'event-based', false, 2),
  ('Day-of coordination',   'Planning & Coordination', 'event-based', false, 3),
  ('Vendor management',     'Planning & Coordination', 'event-based', false, 4),
  ('Timeline planning',     'Planning & Coordination', 'event-based', false, 5),
  ('Budget planning',        'Planning & Coordination', 'event-based', false, 6),
  ('Guest management',      'Planning & Coordination', 'event-based', false, 7),
  ('RSVP management',       'Planning & Coordination', 'event-based', false, 8)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  pricing_type = EXCLUDED.pricing_type,
  is_mvp = EXCLUDED.is_mvp,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 6) Clean up orphaned old-name services not linked to vendors
-- ============================================================
-- Old names from v1 that were renamed/reorganized. Only delete
-- if no vendor_services reference them, to avoid breaking existing data.
DELETE FROM services
WHERE name IN (
  'Buffet & plated service', 'Beverage service', 'Equipment hire', 'Dietary options',
  'Engagement shoots', 'Photo albums', 'Highlight reel', 'Same-day edits',
  'Venue styling', 'Floral design', 'Table settings', 'Lighting design',
  'Backdrop & draping', 'Centerpieces', 'Cake table styling', 'Event rentals',
  'Live band', 'MC services', 'Traditional musicians', 'Sound system',
  'Dance floor', 'Ceremony music', 'Reception entertainment',
  'Bridal hairstyling', 'Makeup trials', 'Hair trials', 'On-site touch-ups', 'Barber services',
  'Bridal gowns', 'Groom suits', 'Traditional attire', 'Alterations', 'Rental attire', 'Custom tailoring',
  'Bridal car', 'Guest shuttle', 'Luxury vehicles', 'Vintage cars', 'Decorated vehicles', 'Driver service',
  'Wedding venues', 'Outdoor venues', 'Indoor halls', 'Garden venues', 'Beach venues',
  'On-site accommodation', 'Catering allowed', 'Venue coordination'
)
AND id NOT IN (SELECT DISTINCT service_id FROM vendor_services WHERE service_id IS NOT NULL);
