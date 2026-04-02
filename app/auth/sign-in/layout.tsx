import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — uMshado Wedding Platform',
  description: 'Sign in to your uMshado account to manage your wedding planning or vendor profile.',
  alternates: {
    canonical: 'https://www.umshadohub.co.za/auth/sign-in',
  },
  robots: { index: true, follow: false },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
