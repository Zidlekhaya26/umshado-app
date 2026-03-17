import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import VendorPublicClient from './VendorPublicClient';

/**
 * Public vendor page — accessible to anyone with the link.
 * Uses service role to bypass RLS (no public SELECT policy on vendors table).
 * Only published (is_published = true) vendors resolve; all others return 404.
 */
export default async function VendorPublicPage({ params }: { params: { vendorId: string } }) {
  const { vendorId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Use service role to bypass RLS for public pages
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Only published vendors are publicly accessible; unpublished/suspended return 404
  const { data: vendorData, error: vendorError } = await supabase
    .from('vendors')
    .select('id, business_name, category, location, description, logo_url, cover_url, portfolio_urls, contact, social_links, verified, top_rated, rating, review_count')
    .eq('id', vendorId)
    .eq('is_published', true)
    .maybeSingle();

  if (vendorError) {
    console.error('Error fetching vendor:', vendorError);
    notFound();
  }

  if (!vendorData) {
    console.error('Vendor not found:', vendorId);
    notFound();
  }

  // Fetch services
  const { data: servicesData } = await supabase
    .from('vendor_services')
    .select('id, service_id, custom_name, services:service_id(name)')
    .eq('vendor_id', vendorId);

  const services = (servicesData || []).map((vs: any) => ({
    id: vs.id,
    name: vs.custom_name || vs.services?.name || 'Unknown Service',
  }));

  // Fetch packages
  const { data: packagesData } = await supabase
    .from('vendor_packages')
    .select('id, name, base_price, pricing_mode, base_guests, base_hours, included_services, is_popular, description')
    .eq('vendor_id', vendorId)
    .order('base_price', { ascending: true });

  const packages = packagesData || [];

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

  const CAT_ICONS: Record<string, string> = {
    'Photography & Video': '📸', 'Catering & Food': '🍽️',
    'Décor & Styling': '💐', 'Music, DJ & Sound': '🎵',
    'Makeup & Hair': '💄', 'Attire & Fashion': '👗',
    'Wedding Venues': '🏛️', 'Transport': '🚗',
    'Honeymoon & Travel': '✈️', 'Support Services': '🛡️',
    'Furniture & Equipment Hire': '🪑',
    'Special Effects & Experiences': '✨',
    'Planning & Coordination': '📋',
  };
  const catIcon = CAT_ICONS[vendorData.category] || '💍';

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

export async function generateMetadata({ params }: { params: { vendorId: string } }) {
  const { vendorId } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: v } = await supabase
      .from('vendors')
      .select('business_name, logo_url, description, category, location')
      .eq('id', vendorId)
      .eq('is_published', true)
      .maybeSingle();

    if (!v) return { title: 'Wedding Vendor | uMshado' };

    const images: { url: string }[] = [];
    if (v.logo_url && String(v.logo_url).startsWith('https://')) images.push({ url: v.logo_url });

    return {
      title: `${v.business_name} | uMshado Wedding Marketplace`,
      description: v.description
        ? v.description.slice(0, 160)
        : `${v.business_name} — ${v.category} in ${v.location}. Find and book wedding vendors on uMshado.`,
      openGraph: {
        title: v.business_name,
        description: v.description?.slice(0, 160),
        images,
        type: 'website',
      },
    };
  } catch {
    return { title: 'Wedding Vendor | uMshado' };
  }
}
