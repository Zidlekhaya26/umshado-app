import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wedding Vendors Marketplace — Photographers, Venues, Caterers & More',
  description:
    'Browse hundreds of trusted wedding vendors across South Africa, Zimbabwe, Nigeria, Kenya and Ghana. Find wedding photographers, venues, caterers, DJs, décor artists, makeup artists and more. Free to use.',
  keywords: [
    'wedding vendors marketplace South Africa',
    'wedding photographers near me',
    'wedding venues South Africa',
    'wedding caterers South Africa',
    'wedding décor South Africa',
    'wedding DJ South Africa',
    'makeup artist wedding',
    'wedding florist South Africa',
    'African wedding vendors',
    'wedding vendor directory',
  ],
  alternates: {
    canonical: 'https://www.umshadohub.co.za/marketplace',
  },
  openGraph: {
    title: 'Wedding Vendors Marketplace | uMshado',
    description: 'Discover and connect with trusted wedding vendors across Africa — venues, photographers, caterers, DJs, décor and more.',
    url: 'https://www.umshadohub.co.za/marketplace',
    type: 'website',
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
