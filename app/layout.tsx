import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthRoleProvider } from "./providers/AuthRoleProvider";
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
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="uMshado" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F7F0EA]`}>
        {/* ✅ No centering, no max-width here */}
        <AuthRoleProvider>
          <RoleGate>
            <div className="min-h-screen w-full">{children}</div>
          </RoleGate>
        </AuthRoleProvider>
      </body>
    </html>
  );
}
