'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export default function ErudaLoader() {
  useEffect(() => {
    // Fallback: try to init eruda if it's already loaded
    const checkEruda = () => {
      if (typeof window !== 'undefined' && (window as any).eruda) {
        (window as any).eruda.init();
      }
    };
    
    // Check after a short delay
    const timer = setTimeout(checkEruda, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Script 
      src="https://cdn.jsdelivr.net/npm/eruda" 
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined' && (window as any).eruda) {
          (window as any).eruda.init();
        }
      }}
      onError={(e) => {
        console.error('Failed to load Eruda:', e);
      }}
    />
  );
}
