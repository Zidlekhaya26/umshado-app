import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  themeColor: '#F7F0EA'
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F7F0EA]`}>
        {/* ✅ No centering, no max-width here */}
        <div className="min-h-screen w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
