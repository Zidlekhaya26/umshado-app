-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create vendor_packages table
CREATE TABLE IF NOT EXISTS vendor_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pricing_mode VARCHAR(20) CHECK (pricing_mode IN ('guest', 'time')) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  base_guests INTEGER,
  base_hours INTEGER,
  price_per_guest DECIMAL(10, 2),
  price_per_hour DECIMAL(10, 2),
  included_services TEXT[],
  is_popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_packages ENABLE ROW LEVEL SECURITY;

-- Policies for vendors table
CREATE POLICY "Vendors can view their own data" ON vendors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Vendors can insert their own data" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendors can update their own data" ON vendors
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for vendor_packages table
CREATE POLICY "Vendors can view their own packages" ON vendor_packages
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can insert their own packages" ON vendor_packages
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can update their own packages" ON vendor_packages
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can delete their own packages" ON vendor_packages
  FOR DELETE USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

-- Public read access for packages (for marketplace)
CREATE POLICY "Anyone can view packages" ON vendor_packages
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX idx_vendor_packages_vendor_id ON vendor_packages(vendor_id);
CREATE INDEX idx_vendors_user_id ON vendors(user_id);
