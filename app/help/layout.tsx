import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & FAQs — Wedding Planning Support',
  description: 'Get help with uMshado — answers to common questions about planning your wedding, finding vendors, managing RSVPs, and growing your wedding business.',
  alternates: {
    canonical: 'https://www.umshadohub.co.za/help',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
