import { type Metadata } from 'next';
import { createServiceClient } from '@/lib/supabaseServer';

type Props = {
  params: Promise<{ vendorId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vendorId } = await params;

  const uuidStrict = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
  if (!uuidStrict.test(vendorId)) {
    return { title: 'Vendor — uMshado' };
  }

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('vendors')
      .select('business_name, category, about, description, cover_url, portfolio_urls, location')
      .eq('id', vendorId)
      .maybeSingle();

    if (!data) return { title: 'Vendor — uMshado' };

    const name = data.business_name ?? 'Wedding Vendor';
    const category = data.category ?? '';
    const location = data.location ?? '';
    const rawDesc = data.about ?? data.description ?? '';
    const desc = rawDesc
      ? rawDesc.slice(0, 200).trimEnd()
      : `${category} services${location ? ` in ${location}` : ''} — book via uMshado`;

    const portfolioUrls: string[] = Array.isArray(data.portfolio_urls) ? data.portfolio_urls : [];
    const imageUrl: string | undefined = data.cover_url || portfolioUrls[0] || undefined;

    const ogImages = imageUrl
      ? [{ url: imageUrl, width: 1200, height: 630, alt: name }]
      : [];

    return {
      title: `${name} — ${category} | uMshado`,
      description: desc,
      openGraph: {
        title: `${name} — ${category}`,
        description: desc,
        images: ogImages,
        type: 'website',
      },
      twitter: {
        card: imageUrl ? 'summary_large_image' : 'summary',
        title: `${name} — ${category}`,
        description: desc,
        images: imageUrl ? [imageUrl] : [],
      },
    };
  } catch {
    return { title: 'Vendor — uMshado' };
  }
}

export default function VendorProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
