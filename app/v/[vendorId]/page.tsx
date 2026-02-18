import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import PublicVendorCTAs from '@/components/PublicVendorCTAs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default async function VendorPublicPage({ params }: { params: { vendorId: string } }) {
  const { vendorId } = params;

  // Fetch vendor public info
  let { data: vendor } = await supabase
    .from('vendors')
    .select('id, business_name, category, location, description, logo_url, portfolio_urls, contact')
    .eq('id', vendorId)
    .maybeSingle();

  // Fallback: some deployments expose a public view `marketplace_vendors`.
  // If no direct `vendors` row exists, try the marketplace view to render a public profile.
  if (!vendor) {
    const { data: mv } = await supabase
      .from('marketplace_vendors')
      .select('vendor_id, business_name, category, city, country, description, logo_url')
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
      } as any;
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
      <div className="w-full max-w-screen-xl mx-auto px-4 py-6">
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
              <PublicVendorCTAs vendorId={vendor.id} whatsapp={whatsapp} />
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
