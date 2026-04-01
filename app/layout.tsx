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
  title: "uMshado — African Wedding Platform",
  description: "Plan your dream wedding or grow your wedding business. Africa's #1 wedding platform.",
  icons: {
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: "uMshado — African Wedding Platform",
    description: "Plan your dream wedding or grow your wedding business. Africa's #1 wedding platform.",
    url: "https://www.umshadohub.co.za",
    siteName: "uMshado",
    images: [
      {
        url: "https://www.umshadohub.co.za/logo-full.png",
        width: 512,
        height: 512,
        alt: "uMshado — African Wedding Platform",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "uMshado — African Wedding Platform",
    description: "Plan your dream wedding or grow your wedding business. Africa's #1 wedding platform.",
    images: ["https://www.umshadohub.co.za/logo-full.png"],
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
        {/* VAPID key injected server-side so it's always available to the client */}
        <meta name="vapid-public-key" content={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''} />
        {/* Open Graph — WhatsApp, iMessage, Telegram read these */}
        <meta property="og:title" content="uMshado — African Wedding Platform" />
        <meta property="og:description" content="Plan your dream wedding or grow your wedding business. Africa's #1 wedding platform." />
        <meta property="og:image" content="https://www.umshadohub.co.za/logo-full.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:url" content="https://www.umshadohub.co.za" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="uMshado" />
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
