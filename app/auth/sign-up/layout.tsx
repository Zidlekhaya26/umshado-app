import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up Free — Plan Your Wedding or List Your Business',
  description:
    'Create your free uMshado account. Couples get a complete wedding planning toolkit. Wedding vendors get a free business listing to reach couples across Africa.',
  alternates: {
    canonical: 'https://www.umshadohub.co.za/auth/sign-up',
  },
  openGraph: {
    title: 'Sign Up Free | uMshado',
    description: 'Join uMshado free — plan your perfect African wedding or grow your wedding business.',
    url: 'https://www.umshadohub.co.za/auth/sign-up',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
