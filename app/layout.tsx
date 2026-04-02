import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthRoleProvider } from "./providers/AuthRoleProvider";
import { CurrencyProvider } from "./providers/CurrencyProvider";
import { ToastProvider } from '@/components/ui/ToastProvider';
import RoleGate from "@/components/RoleGate";
import PushPermissionPrompt from '@/components/PushPermissionPrompt';
import ErrorBoundary from '@/components/ErrorBoundary';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.umshadohub.co.za"),
  title: {
    default: "uMshado — Africa's #1 Wedding Planning Platform",
    template: "%s | uMshado",
  },
  description:
    "Plan your perfect African wedding with uMshado. Find photographers, caterers, décor artists, DJs, venues and more across South Africa, Zimbabwe, Nigeria, Kenya and Ghana. 100% free for couples.",
  keywords: [
    "wedding planning South Africa",
    "wedding vendors South Africa",
    "African wedding platform",
    "wedding photographers Johannesburg",
    "wedding venues Cape Town",
    "wedding caterers Durban",
    "wedding décor South Africa",
    "African wedding app",
    "uMshado",
    "umshado hub",
    "wedding planning app Africa",
    "wedding vendors Zimbabwe",
    "wedding vendors Nigeria",
    "wedding planner online",
    "RSVP wedding website",
    "wedding marketplace Africa",
    "South African wedding",
    "lobola wedding",
    "traditional African wedding",
  ],
  authors: [{ name: "uMshado", url: "https://www.umshadohub.co.za" }],
  creator: "uMshado",
  publisher: "uMshado",
  category: "Wedding Planning",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://www.umshadohub.co.za",
  },
  verification: {
    google: "r_DBnzqRD5OZxR94I1P06EirXgJ5BVDI1nNT",
  },
  icons: {
    icon: "/logo-icon.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/logo-icon.png",
  },
  openGraph: {
    title: "uMshado — Africa's #1 Wedding Planning Platform",
    description:
      "Find trusted wedding photographers, venues, caterers, DJs, décor artists and more across Africa. Free for couples. List your business free.",
    url: "https://www.umshadohub.co.za",
    siteName: "uMshado",
    locale: "en_ZA",
    type: "website",
    images: [
      {
        url: "https://www.umshadohub.co.za/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "uMshado — Africa's #1 Wedding Planning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "uMshado — Africa's #1 Wedding Planning Platform",
    description:
      "Find trusted wedding photographers, venues, caterers, DJs, décor artists and more across Africa. Free for couples.",
    images: ["https://www.umshadohub.co.za/og-image.jpg"],
    creator: "@umshadohub",
    site: "@umshadohub",
  },
};

// ✅ This helps iPhone Safari render at true device width
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F7F0EA',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="uMshado" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F7F0EA" />
        <link rel="manifest" href="/manifest.json?v=1" />
        <link rel="manifest" href="/manifest.webmanifest?v=1" />
        <link rel="icon" href="/logo-icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="canonical" href="https://www.umshadohub.co.za" />
        {/* VAPID key injected server-side so it's always available to the client */}
        <meta name="vapid-public-key" content={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''} />
        {/* JSON-LD — WebSite + Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://www.umshadohub.co.za/#website",
                  "url": "https://www.umshadohub.co.za",
                  "name": "uMshado",
                  "description": "Africa's #1 Wedding Planning Platform — find trusted wedding vendors, manage RSVPs, build your wedding website and plan every detail in one place.",
                  "publisher": { "@id": "https://www.umshadohub.co.za/#organization" },
                  "inLanguage": "en-ZA",
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://www.umshadohub.co.za/marketplace?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "Organization",
                  "@id": "https://www.umshadohub.co.za/#organization",
                  "name": "uMshado",
                  "url": "https://www.umshadohub.co.za",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.umshadohub.co.za/logo-full.png",
                    "width": 512,
                    "height": 512
                  },
                  "sameAs": [],
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "email": "support@umshadohub.co.za",
                    "contactType": "customer support"
                  },
                  "areaServed": ["ZA", "ZW", "NG", "KE", "GH", "BW"],
                  "description": "uMshado connects African couples with trusted wedding vendors. Plan your perfect wedding — free for couples."
                },
                {
                  "@type": "SoftwareApplication",
                  "name": "uMshado",
                  "operatingSystem": "Android, iOS, Web",
                  "applicationCategory": "LifestyleApplication",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "ZAR"
                  },
                  "url": "https://www.umshadohub.co.za",
                  "screenshot": "https://www.umshadohub.co.za/og-image.jpg"
                }
              ]
            })
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F7F0EA]`}>
        <ErrorBoundary>
        <AuthRoleProvider>
          <CurrencyProvider>
            <ToastProvider>
            <div id="um-main" className="w-full">
              <RoleGate>
                <div id="um-page-wrap" className="min-h-screen w-full">{children}</div>
                <PushPermissionPrompt />
              </RoleGate>
            </div>
            </ToastProvider>
          </CurrencyProvider>
        </AuthRoleProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
