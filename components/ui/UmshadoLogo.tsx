/**
 * uMshado Logo Components — UI only, no logic.
 *
 * Uses the ACTUAL logo images from /public:
 *   /logo-icon.png  – heart symbol only  (headers, loading states)
 *   /logo-full.png  – symbol + "uMshado®" wordmark  (landing, auth)
 *
 * <UmshadoIcon />   – renders /logo-icon.png
 * <UmshadoLogo />   – renders /logo-full.png
 * <UmshadoLoader /> – branded loading animation (arc + pulse + heartbeat)
 * <LoadingPage />   – full-screen loading screen using UmshadoLoader
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
    <Image
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
        style={{ height: 'auto' }}
        className="object-contain"
        priority
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loader – spinning arc + pulsing logo (use on all loading screens)  */
/* ------------------------------------------------------------------ */

interface LoaderProps {
  size?: number;
  label?: string;
}

export function UmshadoLoader({ size = 80, label }: LoaderProps) {
  const r     = (size / 2) * 0.78;          // arc radius
  const cx    = size / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * 0.72;                // 72% filled arc
  const gap   = circ - dash;
  const iconSz = Math.round(size * 0.52);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: size, height: size }}>

        {/* Ripple rings — expand & fade */}
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          border: '1.5px solid rgba(154,33,67,0.25)',
          animation: 'um-ripple 2.2s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: '1px solid rgba(189,152,63,0.18)',
          animation: 'um-ripple 2.2s ease-out 0.6s infinite',
        }} />

        {/* Spinning arc — crimson comet */}
        <svg
          width={size} height={size}
          style={{ position: 'absolute', inset: 0, animation: 'um-arc-spin 1.15s cubic-bezier(0.4,0,0.6,1) infinite' }}
        >
          <defs>
            {/* Gradient along the arc for comet-tail effect */}
            <linearGradient id="um-comet" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#9A2143" stopOpacity="0.05" />
              <stop offset="60%"  stopColor="#9A2143" stopOpacity="0.7"  />
              <stop offset="100%" stopColor="#9A2143" stopOpacity="1"    />
            </linearGradient>
          </defs>

          {/* Thin static track ring */}
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(154,33,67,0.08)" strokeWidth={2.5} />

          {/* Moving arc */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke="url(#um-comet)"
            strokeWidth={3}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            style={{ transformOrigin: `${cx}px ${cx}px` }}
          />

          {/* Gold comet head dot — rides at the arc tip */}
          <circle cx={cx + r} cy={cx} r={3.5} fill="#BD983F" />
          {/* Smaller trailing sparkle */}
          <circle
            cx={cx + r * Math.cos(-dash / r)}
            cy={cx + r * Math.sin(-dash / r)}
            r={1.8}
            fill="rgba(189,152,63,0.5)"
          />
        </svg>

        {/* Logo icon — heartbeat pulse */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'um-heartbeat 1.15s ease-in-out infinite',
        }}>
          <Image src="/logo-icon.png" alt="uMshado" width={iconSz} height={iconSz} className="object-contain" priority />
        </div>
      </div>

      {label && (
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: 'rgba(154,33,67,0.45)', letterSpacing: 2.5,
          textTransform: 'uppercase', fontFamily: 'Georgia, serif',
        }}>
          {label}
        </p>
      )}

      <style>{`
        @keyframes um-arc-spin  { to { transform: rotate(360deg); } }
        @keyframes um-heartbeat {
          0%,100% { transform: scale(1);    }
          15%     { transform: scale(1.1);  }
          30%     { transform: scale(0.96); }
          45%     { transform: scale(1.07); }
        }
        @keyframes um-ripple {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

/* Full-screen loading page */
export function LoadingPage({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--um-ivory, #faf8f5)',
    }}>
      <UmshadoLoader size={84} label={label} />
    </div>
  );
}
