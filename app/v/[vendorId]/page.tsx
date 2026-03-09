import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import VendorPublicClient from './VendorPublicClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
// Use service role client to bypass RLS for reading published vendors
const supabase = createClient(supabaseUrl, supabaseServiceRole);

export default async function VendorPublicPage({ params }: { params: { vendorId: string } }) {
  const { vendorId } = await params;

  // Fetch vendor data from vendors table (only published vendors)
  const { data: vendorData, error: vendorError } = await supabase
    .from('vendors')
    .select('id, business_name, category, location, description, logo_url, cover_url, portfolio_urls, contact, social_links, verified, top_rated, rating, review_count, is_published')
    .eq('id', vendorId)
    .eq('is_published', true)
    .maybeSingle();

  if (vendorError) {
    console.error('Error fetching vendor:', vendorError);
    notFound();
  }

  if (!vendorData) {
    console.error('Vendor not found or not published:', vendorId);
    notFound();
  }

  // Fetch services
  const { data: servicesData } = await supabase
    .from('vendor_services')
    .select('id, service_id, custom_name, services:service_id(name)')
    .eq('vendor_id', vendorId);

  const services = (servicesData || []).map((vs: any) => ({
    id: vs.id,
    name: vs.custom_name || (vs.services?.name) || 'Unknown Service'
  }));

  // Fetch packages
  const { data: packagesData } = await supabase
    .from('vendor_packages')
    .select('id, name, base_price, pricing_mode, base_guests, base_hours, included_services, is_popular, description')
    .eq('vendor_id', vendorId)
    .order('base_price', { ascending: true });

  const packages = packagesData || [];

  // Map to VendorData structure for VendorPublicClient
  const vendor = {
    id: vendorData.id,
    business_name: vendorData.business_name || '',
    category: vendorData.category || '',
    location: vendorData.location || '',
    description: vendorData.description || null,
    logo_url: vendorData.logo_url || null,
    cover_url: vendorData.cover_url || null,
    portfolio_urls: vendorData.portfolio_urls || [],
    contact: vendorData.contact || null,
    social_links: vendorData.social_links || {},
    verified: vendorData.verified || false,
    top_rated: vendorData.top_rated || false,
    rating: vendorData.rating || 0,
    review_count: vendorData.review_count || 0,
  };

  // Determine category icon (basic mapping)
  const catIcon = '📸'; // Default icon, can be expanded based on category

  return (
    <VendorPublicClient
      vendorId={vendorId}
      vendor={vendor}
      services={services}
      packages={packages}
      catIcon={catIcon}
    />
  );
}

// Only include open graph image if it's an absolute https URL
export async function generateMetadata({ params }: { params: { vendorId: string } }) {
  const { vendorId } = await params;
  try {
    const { data: mv } = await supabase
      .from('marketplace_vendors')
      .select('vendor_id, business_name, logo_url')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    let logoUrl = mv?.logo_url || null;

    if (!logoUrl) {
      const { data: v } = await supabase.from('vendors').select('logo_url').eq('id', vendorId).maybeSingle();
      logoUrl = v?.logo_url || null;
    }

    const images = [] as { url: string }[];
    if (logoUrl && String(logoUrl).startsWith('https://')) images.push({ url: logoUrl });

    return {
      title: mv?.business_name || 'Vendor',
      openGraph: { images },
    };
  } catch (err) {
    return { title: 'Vendor' };
  }
}
