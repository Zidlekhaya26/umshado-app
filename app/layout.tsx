import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthRoleProvider } from "./providers/AuthRoleProvider";
import { CurrencyProvider } from "./providers/CurrencyProvider";
import CurrencySelector from '@/components/CurrencySelector';
import FullscreenPrompt from '@/components/FullscreenPrompt';
import RoleGate from "@/components/RoleGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "uMshado",
  description: "Plan your dream wedding with uMshado",
  themeColor: '#F7F0EA',
  icons: {
    apple: '/apple-touch-icon.png',
  }
};

// ✅ This helps iPhone Safari render at true device width
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F7F0EA]`}>
        {/* ✅ No centering, no max-width here */}
        <AuthRoleProvider>
          <CurrencyProvider>
            <div className="w-full">
              <header className="bg-white border-b border-gray-100 px-4 py-3 flex justify-end items-center">
                <div className="block flex items-center gap-3">
                  <CurrencySelector />
                  <FullscreenPrompt />
                </div>
              </header>
              <RoleGate>
                <div className="min-h-screen w-full">{children}</div>
              </RoleGate>
            </div>
          </CurrencyProvider>
        </AuthRoleProvider>
      </body>
    </html>
  );
}
