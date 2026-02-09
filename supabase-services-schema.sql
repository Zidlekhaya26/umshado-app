-- Create services master table (predefined services only)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create vendor_services join table
CREATE TABLE IF NOT EXISTS vendor_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  service_name VARCHAR(255),
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_vendor_service UNIQUE (vendor_id, service_id),
  CONSTRAINT unique_vendor_custom_service UNIQUE (vendor_id, service_name, is_custom)
);

-- Enable Row Level Security
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_services ENABLE ROW LEVEL SECURITY;

-- Policies for services table (public read)
CREATE POLICY "Anyone can view services" ON services
  FOR SELECT USING (true);

-- Policies for vendor_services table
CREATE POLICY "Vendors can view their own services" ON vendor_services
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can insert their own services" ON vendor_services
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can delete their own services" ON vendor_services
  FOR DELETE USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX idx_vendor_services_vendor_id ON vendor_services(vendor_id);
CREATE INDEX idx_vendor_services_service_id ON vendor_services(service_id);

-- Insert predefined services
INSERT INTO services (name, category) VALUES
  ('Wedding catering', 'Catering'),
  ('Buffet & plated service', 'Catering'),
  ('Custom menus', 'Catering'),
  ('Traditional dishes', 'Catering'),
  ('Canapés & desserts', 'Catering'),
  ('Beverage service', 'Catering'),
  ('Serving staff', 'Catering'),
  ('On-site preparation', 'Catering'),
  ('Equipment hire', 'Catering'),
  ('Dietary options', 'Catering'),

  ('Wedding photography', 'Photography & Video'),
  ('Wedding videography', 'Photography & Video'),
  ('Engagement shoots', 'Photography & Video'),
  ('Drone photography', 'Photography & Video'),
  ('Photo albums', 'Photography & Video'),
  ('Highlight reel', 'Photography & Video'),
  ('Same-day edits', 'Photography & Video'),
  ('Live streaming', 'Photography & Video'),

  ('Venue styling', 'Decor & Styling'),
  ('Floral design', 'Decor & Styling'),
  ('Table settings', 'Decor & Styling'),
  ('Lighting design', 'Decor & Styling'),
  ('Backdrop & draping', 'Decor & Styling'),
  ('Centerpieces', 'Decor & Styling'),
  ('Cake table styling', 'Decor & Styling'),
  ('Event rentals', 'Decor & Styling'),

  ('DJ services', 'Music & Entertainment'),
  ('Live band', 'Music & Entertainment'),
  ('MC services', 'Music & Entertainment'),
  ('Traditional musicians', 'Music & Entertainment'),
  ('Sound system', 'Music & Entertainment'),
  ('Dance floor', 'Music & Entertainment'),
  ('Ceremony music', 'Music & Entertainment'),
  ('Reception entertainment', 'Music & Entertainment'),

  ('Bridal makeup', 'Beauty & Grooming'),
  ('Bridal hairstyling', 'Beauty & Grooming'),
  ('Groom grooming', 'Beauty & Grooming'),
  ('Bridesmaids makeup', 'Beauty & Grooming'),
  ('Makeup trials', 'Beauty & Grooming'),
  ('Hair trials', 'Beauty & Grooming'),
  ('On-site touch-ups', 'Beauty & Grooming'),
  ('Barber services', 'Beauty & Grooming'),

  ('Bridal gowns', 'Attire'),
  ('Bridesmaids dresses', 'Attire'),
  ('Groom suits', 'Attire'),
  ('Traditional attire', 'Attire'),
  ('Alterations', 'Attire'),
  ('Accessories', 'Attire'),
  ('Rental attire', 'Attire'),
  ('Custom tailoring', 'Attire'),

  ('Bridal car', 'Transport'),
  ('Guest shuttle', 'Transport'),
  ('Luxury vehicles', 'Transport'),
  ('Vintage cars', 'Transport'),
  ('Decorated vehicles', 'Transport'),
  ('Driver service', 'Transport'),

  ('Wedding venues', 'Venues'),
  ('Outdoor venues', 'Venues'),
  ('Indoor halls', 'Venues'),
  ('Garden venues', 'Venues'),
  ('Beach venues', 'Venues'),
  ('On-site accommodation', 'Venues'),
  ('Catering allowed', 'Venues'),
  ('Venue coordination', 'Venues'),

  ('Full planning', 'Planning & Coordination'),
  ('Partial planning', 'Planning & Coordination'),
  ('Day-of coordination', 'Planning & Coordination'),
  ('Vendor management', 'Planning & Coordination'),
  ('Timeline planning', 'Planning & Coordination'),
  ('Budget planning', 'Planning & Coordination'),
  ('Guest management', 'Planning & Coordination'),
  ('RSVP management', 'Planning & Coordination')
ON CONFLICT (name) DO NOTHING;
