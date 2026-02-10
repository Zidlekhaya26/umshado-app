/**
 * uMshado Logo Components — UI only, no logic.
 *
 * Uses the ACTUAL logo images from /public:
 *   /logo-icon.png  – heart symbol only  (headers, loading states)
 *   /logo-full.png  – symbol + "uMshado®" wordmark  (landing, auth)
 *
 * <UmshadoIcon />   – renders /logo-icon.png
 * <UmshadoLogo />   – renders /logo-full.png
 */

import Image from 'next/image';

/* ------------------------------------------------------------------ */
/*  Icon – heart symbol only                                           */
/* ------------------------------------------------------------------ */

interface IconProps {
  size?: number;
  className?: string;
}

export function UmshadoIcon({ size = 40, className = '' }: IconProps) {
   
  return (
    <img
      src="/logo-icon.png"
      alt="uMshado"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Full logo – symbol + wordmark                                      */
/* ------------------------------------------------------------------ */

interface LogoProps {
  iconSize?: number;
  className?: string;
}

export function UmshadoLogo({ iconSize = 56, className = '' }: LogoProps) {
  // The full logo image contains both the heart symbol and the
  // "uMshado®" wordmark, so we just render it at the right height.
  // Width is auto-calculated from the image's aspect ratio.
  const height = Math.round(iconSize * 1.6); // accommodate symbol + text

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Image
        src="/logo-full.png"
        alt="uMshado"
        width={Math.round(height * 0.85)}
        height={height}
        style={{ width: 'auto', height: 'auto', maxHeight: height }}
        className="object-contain"
        priority
      />
    </div>
  );
}
