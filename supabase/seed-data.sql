-- ============================================================================
-- SEED DATA for uMshado Testing
-- ============================================================================
-- Run this AFTER all schema migrations (vendors, services, packages, quotes, etc.)
-- This creates sample vendors, services, and packages for testing
-- ============================================================================

-- ============================================================================
-- SERVICES (Wedding service categories)
-- ============================================================================

INSERT INTO services (id, name, category, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Wedding catering', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111112', 'Buffet & plated service', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111113', 'Custom menus', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111114', 'Traditional dishes', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111115', 'Canapés & desserts', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111116', 'Beverage service', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111117', 'Serving staff', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111118', 'On-site preparation', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111119', 'Equipment hire', 'Catering', NOW()),
  ('11111111-1111-1111-1111-111111111120', 'Dietary options', 'Catering', NOW()),

  ('22222222-2222-2222-2222-222222222111', 'Wedding photography', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222112', 'Wedding videography', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222113', 'Engagement shoots', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222114', 'Drone photography', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222115', 'Photo albums', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222116', 'Highlight reel', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222117', 'Same-day edits', 'Photography & Video', NOW()),
  ('22222222-2222-2222-2222-222222222118', 'Live streaming', 'Photography & Video', NOW()),

  ('33333333-3333-3333-3333-333333333111', 'Venue styling', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333112', 'Floral design', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333113', 'Table settings', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333114', 'Lighting design', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333115', 'Backdrop & draping', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333116', 'Centerpieces', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333117', 'Cake table styling', 'Decor & Styling', NOW()),
  ('33333333-3333-3333-3333-333333333118', 'Event rentals', 'Decor & Styling', NOW()),

  ('44444444-4444-4444-4444-444444444111', 'DJ services', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444112', 'Live band', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444113', 'MC services', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444114', 'Traditional musicians', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444115', 'Sound system', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444116', 'Dance floor', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444117', 'Ceremony music', 'Music & Entertainment', NOW()),
  ('44444444-4444-4444-4444-444444444118', 'Reception entertainment', 'Music & Entertainment', NOW()),

  ('55555555-5555-5555-5555-555555555111', 'Bridal makeup', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555112', 'Bridal hairstyling', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555113', 'Groom grooming', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555114', 'Bridesmaids makeup', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555115', 'Makeup trials', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555116', 'Hair trials', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555117', 'On-site touch-ups', 'Beauty & Grooming', NOW()),
  ('55555555-5555-5555-5555-555555555118', 'Barber services', 'Beauty & Grooming', NOW()),

  ('66666666-6666-6666-6666-666666666111', 'Bridal gowns', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666112', 'Bridesmaids dresses', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666113', 'Groom suits', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666114', 'Traditional attire', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666115', 'Alterations', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666116', 'Accessories', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666117', 'Rental attire', 'Attire', NOW()),
  ('66666666-6666-6666-6666-666666666118', 'Custom tailoring', 'Attire', NOW()),

  ('77777777-7777-7777-7777-777777777111', 'Bridal car', 'Transport', NOW()),
  ('77777777-7777-7777-7777-777777777112', 'Guest shuttle', 'Transport', NOW()),
  ('77777777-7777-7777-7777-777777777113', 'Luxury vehicles', 'Transport', NOW()),
  ('77777777-7777-7777-7777-777777777114', 'Vintage cars', 'Transport', NOW()),
  ('77777777-7777-7777-7777-777777777115', 'Decorated vehicles', 'Transport', NOW()),
  ('77777777-7777-7777-7777-777777777116', 'Driver service', 'Transport', NOW()),

  ('88888888-8888-8888-8888-888888888111', 'Wedding venues', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888112', 'Outdoor venues', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888113', 'Indoor halls', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888114', 'Garden venues', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888115', 'Beach venues', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888116', 'On-site accommodation', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888117', 'Catering allowed', 'Venues', NOW()),
  ('88888888-8888-8888-8888-888888888118', 'Venue coordination', 'Venues', NOW()),

  ('99999999-9999-9999-9999-999999999111', 'Full planning', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999112', 'Partial planning', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999113', 'Day-of coordination', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999114', 'Vendor management', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999115', 'Timeline planning', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999116', 'Budget planning', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999117', 'Guest management', 'Planning & Coordination', NOW()),
  ('99999999-9999-9999-9999-999999999118', 'RSVP management', 'Planning & Coordination', NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category;

-- ============================================================================
-- SAMPLE VENDORS
-- ============================================================================
-- NOTE: These use placeholder UUIDs. In production, vendors would be linked to 
-- real auth.users. For testing, you can replace these IDs with actual user IDs
-- from your auth.users table, or create test users first.
-- ============================================================================

-- Sample Vendor 1: Premium Photography Studio
INSERT INTO vendors (
  id, 
  business_name, 
  category, 
  location, 
  rating, 
  review_count, 
  verified, 
  top_rated, 
  about, 
  portfolio_images, 
  contact,
  created_at,
  updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Eternal Moments Photography',
  'Photography & Video',
  'Johannesburg, Gauteng',
  4.9,
  127,
  true,
  true,
  'Award-winning wedding photography studio specializing in candid moments and artistic compositions. With over 10 years of experience capturing love stories across South Africa.',
  45,
  '{"whatsapp": "0821234567", "phone": "0821234567", "preferredContact": "whatsapp"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  verified = EXCLUDED.verified,
  top_rated = EXCLUDED.top_rated,
  about = EXCLUDED.about,
  portfolio_images = EXCLUDED.portfolio_images,
  contact = EXCLUDED.contact,
  updated_at = NOW();

-- Sample Vendor 2: Luxury Catering
INSERT INTO vendors (
  id, 
  business_name, 
  category, 
  location, 
  rating, 
  review_count, 
  verified, 
  top_rated, 
  about, 
  portfolio_images, 
  contact,
  created_at,
  updated_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Royal Feast Catering',
  'Catering',
  'Cape Town, Western Cape',
  4.8,
  203,
  true,
  true,
  'Gourmet catering for unforgettable weddings. From traditional African cuisine to international fine dining, we create culinary experiences that delight every guest.',
  68,
  '{"whatsapp": "0837654321", "phone": "0837654321", "preferredContact": "whatsapp"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  verified = EXCLUDED.verified,
  top_rated = EXCLUDED.top_rated,
  about = EXCLUDED.about,
  portfolio_images = EXCLUDED.portfolio_images,
  contact = EXCLUDED.contact,
  updated_at = NOW();

-- Sample Vendor 3: Boutique Venue
INSERT INTO vendors (
  id, 
  business_name, 
  category, 
  location, 
  rating, 
  review_count, 
  verified, 
  top_rated, 
  about, 
  portfolio_images, 
  contact,
  created_at,
  updated_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Garden Bliss Estate',
  'Venues',
  'Pretoria, Gauteng',
  4.7,
  89,
  true,
  false,
  'Stunning garden venue with indoor and outdoor spaces. Perfect for intimate ceremonies to grand celebrations. Capacity up to 300 guests with full on-site amenities.',
  92,
  '{"whatsapp": "0849876543", "phone": "0849876543", "preferredContact": "phone"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  verified = EXCLUDED.verified,
  top_rated = EXCLUDED.top_rated,
  about = EXCLUDED.about,
  portfolio_images = EXCLUDED.portfolio_images,
  contact = EXCLUDED.contact,
  updated_at = NOW();

-- ============================================================================
-- VENDOR SERVICES (Link vendors to services they offer)
-- ============================================================================

-- Eternal Moments Photography offers Photography and Videography
INSERT INTO vendor_services (vendor_id, service_id, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222111', NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222112', NOW())
ON CONFLICT (vendor_id, service_id) DO NOTHING;

-- Royal Feast Catering offers Catering
INSERT INTO vendor_services (vendor_id, service_id, created_at) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', NOW())
ON CONFLICT (vendor_id, service_id) DO NOTHING;

-- Garden Bliss Estate offers Venue and Decoration
INSERT INTO vendor_services (vendor_id, service_id, created_at) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '88888888-8888-8888-8888-888888888111', NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '88888888-8888-8888-8888-888888888116', NOW())
ON CONFLICT (vendor_id, service_id) DO NOTHING;

-- ============================================================================
-- VENDOR PACKAGES
-- ============================================================================

-- Eternal Moments Photography Packages
INSERT INTO vendor_packages (
  id,
  vendor_id,
  name,
  description,
  pricing_mode,
  base_price,
  guest_min,
  guest_max,
  price_per_guest,
  hours,
  price_per_hour,
  included_services,
  is_popular,
  created_at
) VALUES
  (
    '11111111-aaaa-aaaa-aaaa-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Essential Package',
    'Perfect for intimate weddings',
    'guest-based',
    8500,
    50,
    100,
    85,
    NULL,
    NULL,
    '["4 hours coverage", "200 edited photos", "Online gallery"]'::jsonb,
    false,
    NOW()
  ),
  (
    '11111111-aaaa-aaaa-aaaa-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Premium Package',
    'Full day coverage with engagement shoot',
    'guest-based',
    15000,
    100,
    200,
    75,
    NULL,
    NULL,
    '["8 hours coverage", "500 edited photos", "Engagement shoot", "Photo album", "Online gallery"]'::jsonb,
    true,
    NOW()
  ),
  (
    '11111111-aaaa-aaaa-aaaa-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Luxury Package',
    'Complete photography and videography experience',
    'guest-based',
    25000,
    150,
    300,
    65,
    NULL,
    NULL,
    '["Full day coverage", "Unlimited photos", "4K videography", "Drone footage", "2 photographers", "Photo album", "Highlight reel"]'::jsonb,
    false,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_mode = EXCLUDED.pricing_mode,
  base_price = EXCLUDED.base_price,
  guest_min = EXCLUDED.guest_min,
  guest_max = EXCLUDED.guest_max,
  price_per_guest = EXCLUDED.price_per_guest,
  included_services = EXCLUDED.included_services,
  is_popular = EXCLUDED.is_popular;

-- Royal Feast Catering Packages
INSERT INTO vendor_packages (
  id,
  vendor_id,
  name,
  description,
  pricing_mode,
  base_price,
  guest_min,
  guest_max,
  price_per_guest,
  hours,
  price_per_hour,
  included_services,
  is_popular,
  created_at
) VALUES
  (
    '22222222-bbbb-bbbb-bbbb-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Classic Menu',
    'Traditional 3-course meal',
    'guest-based',
    12000,
    50,
    150,
    180,
    NULL,
    NULL,
    '["3-course meal", "Table service", "Soft drinks", "Table settings"]'::jsonb,
    false,
    NOW()
  ),
  (
    '22222222-bbbb-bbbb-bbbb-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Gourmet Experience',
    'Premium 5-course dining with wine pairing',
    'guest-based',
    20000,
    80,
    200,
    250,
    NULL,
    NULL,
    '["5-course meal", "Wine pairing", "Champagne toast", "Table service", "Custom menu", "Sommelier"]'::jsonb,
    true,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_mode = EXCLUDED.pricing_mode,
  base_price = EXCLUDED.base_price,
  guest_min = EXCLUDED.guest_min,
  guest_max = EXCLUDED.guest_max,
  price_per_guest = EXCLUDED.price_per_guest,
  included_services = EXCLUDED.included_services,
  is_popular = EXCLUDED.is_popular;

-- Garden Bliss Estate Packages
INSERT INTO vendor_packages (
  id,
  vendor_id,
  name,
  description,
  pricing_mode,
  base_price,
  guest_min,
  guest_max,
  price_per_guest,
  hours,
  price_per_hour,
  included_services,
  is_popular,
  created_at
) VALUES
  (
    '33333333-cccc-cccc-cccc-000000000001',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Garden Ceremony',
    'Outdoor ceremony and reception',
    'time-based',
    18000,
    NULL,
    NULL,
    NULL,
    6,
    3000,
    '["6 hours venue hire", "Garden ceremony space", "Reception hall", "Tables & chairs", "Basic décor", "Bridal suite"]'::jsonb,
    false,
    NOW()
  ),
  (
    '33333333-cccc-cccc-cccc-000000000002',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Full Day Estate',
    'Complete venue access from morning to night',
    'time-based',
    35000,
    NULL,
    NULL,
    NULL,
    12,
    2500,
    '["12 hours venue hire", "Ceremony & reception", "Cocktail area", "Premium décor", "Bridal suite", "Parking attendants", "Setup & breakdown"]'::jsonb,
    true,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_mode = EXCLUDED.pricing_mode,
  base_price = EXCLUDED.base_price,
  hours = EXCLUDED.hours,
  price_per_hour = EXCLUDED.price_per_hour,
  included_services = EXCLUDED.included_services,
  is_popular = EXCLUDED.is_popular;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify data was inserted:
--
-- SELECT COUNT(*) FROM services;  -- Should show 8
-- SELECT COUNT(*) FROM vendors;   -- Should show 3
-- SELECT COUNT(*) FROM vendor_services;  -- Should show 5
-- SELECT COUNT(*) FROM vendor_packages;  -- Should show 7
--
-- SELECT * FROM marketplace_vendors;  -- Should show 3 vendors with aggregated data
-- ============================================================================
