import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default async function VendorPublicPage({ params }: { params: { vendorId: string } }) {
  const { vendorId } = await params;

  // Log the requested vendorId for debugging (server-side)
  console.log('Public vendor page requested for vendorId=', vendorId);

  // Try the public marketplace view first (this view is usually anon-readable)
  // It avoids permission/RLS issues that can occur when querying `vendors` directly.
  let vendor: any = null;
  try {
    const { data: mv, error: mvError } = await supabase
      .from('marketplace_vendors')
      .select('vendor_id, business_name, category, city, country, description, logo_url, featured, featured_until')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (mv) {
      vendor = {
        id: mv.vendor_id,
        business_name: mv.business_name,
        category: mv.category,
        location: [mv.city, mv.country].filter(Boolean).join(', '),
        description: mv.description,
        logo_url: mv.logo_url,
        portfolio_urls: null,
        contact: null,
        featured: mv.featured,
        featured_until: mv.featured_until,
      } as any;
    }
    if (mvError) console.warn('marketplace_vendors query error:', mvError);
  } catch (err) {
    console.error('marketplace_vendors fetch failed:', err);
  }

  // If the public view didn't return a row, fall back to the `vendors` table (may require auth)
  if (!vendor) {
    try {
      const { data: vData, error: vError } = await supabase
        .from('vendors')
        .select('id, business_name, category, location, description, logo_url, portfolio_urls, contact')
        .eq('id', vendorId)
        .maybeSingle();

      if (vData) vendor = vData as any;
      if (vError) console.warn('vendors query error:', vError);
    } catch (err) {
      console.error('vendors fetch failed:', err);
    }
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center"> 
        <div className="text-center">Vendor not found</div>
      </div>
    );
  }

  const portfolio: string[] = Array.isArray(vendor.portfolio_urls) ? vendor.portfolio_urls : [];
  const whatsapp = vendor.contact?.whatsapp ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto px-4 py-6">
        {/* Hero / cover */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          {portfolio[0] ? (
            <div className="w-full h-64 relative">
              <Image src={portfolio[0]} alt={vendor.business_name || 'Cover'} fill style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div className="w-full h-64 bg-gray-100 flex items-center justify-center">
              <div className="text-gray-400">No cover image</div>
            </div>
          )}

          <div className="p-4">
            <h1 className="text-2xl font-bold text-gray-900">{vendor.business_name}</h1>
            <p className="text-sm text-gray-600 mt-1">{vendor.category} • {vendor.location}</p>
            <p className="text-sm text-gray-700 mt-3 leading-relaxed">{vendor.description}</p>

            <div className="mt-4">
              <div className="flex gap-2">
                <a href={`/messages/new?vendor=${vendor.id}`} className="rounded border px-3 py-2">Message</a>
                <a href={`/quotes/new?vendor=${vendor.id}`} className="rounded border px-3 py-2">Request Quote</a>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio thumbnails */}
        {portfolio.length > 1 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {portfolio.slice(1,7).map((u, i) => (
              <div key={i} className="w-full h-32 relative rounded-md overflow-hidden bg-gray-100">
                <Image src={u} alt={`Portfolio ${i}`} fill style={{ objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Services & packages placeholder: use simple lists from public tables */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Services</h3>
            {/* lightweight public fetch of services */}
            <ServicesList vendorId={vendor.id} />
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Packages</h3>
            <PackagesList vendorId={vendor.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

async function ServicesList({ vendorId }: { vendorId: string }) {
  const { data } = await supabase.from('vendor_services').select('id,name,description').eq('vendor_id', vendorId).limit(10);
  const items = data || [];
  return (
    <ul className="space-y-2 text-sm text-gray-700">
      {items.length === 0 && <li className="italic text-gray-400">No services listed</li>}
      {items.map((s: any) => (
        <li key={s.id} className="py-1">{s.name}</li>
      ))}
    </ul>
  );
}

async function PackagesList({ vendorId }: { vendorId: string }) {
  const { data } = await supabase.from('vendor_packages').select('id,name,base_price').eq('vendor_id', vendorId).limit(10);
  const items = data || [];
  return (
    <ul className="space-y-2 text-sm text-gray-700">
      {items.length === 0 && <li className="italic text-gray-400">No packages listed</li>}
      {items.map((p: any) => (
        <li key={p.id} className="py-1">{p.name} {p.base_price ? <span className="text-xs text-gray-500">• from R{Number(p.base_price).toLocaleString()}</span> : null}</li>
      ))}
    </ul>
  );
}
