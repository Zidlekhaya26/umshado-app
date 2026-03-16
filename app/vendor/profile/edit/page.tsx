'use client';

import Link from 'next/link';
import Image from 'next/image';

/* ─── Brand tokens ───────────────────────────────────────── */
const CR  = '#9A2143';
const CR2 = '#731832';
const CRX = '#4d0f21';
const GD  = '#BD983F';
const DK  = '#1a0d12';
const MUT = '#7a5060';
const BOR = '#e8d5d0';
const BG  = '#faf8f5';

const SECTIONS = [
  { href: '/vendor/onboarding', label: 'Business Profile', icon: '💼', desc: 'Name, category, location, description' },
  { href: '/vendor/services',   label: 'Services',          icon: '🎯', desc: 'What services you offer to couples' },
  { href: '/vendor/packages',   label: 'Packages & Pricing', icon: '📦', desc: 'Your pricing tiers and packages' },
  { href: '/vendor/media',      label: 'Media & Contact',    icon: '📸', desc: 'Logo, portfolio, social links' },
  { href: '/vendor/review',     label: 'Preview & Publish',  icon: '🚀', desc: 'Review and go live on the marketplace' },
] as const;

export default function VendorProfileEditHub() {
  const modeQuery = '?mode=edit';
  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ehUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .eh1{animation:ehUp .35s ease .04s both}.eh2{animation:ehUp .35s ease .09s both}
        .eh3{animation:ehUp .35s ease .13s both}.eh4{animation:ehUp .35s ease .17s both}
        .eh5{animation:ehUp .35s ease .21s both}.eh6{animation:ehUp .35s ease .25s both}
        .eh-card:hover .eh-arrow{transform:translateX(3px)}
        .eh-arrow{transition:transform .15s}
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`,
        padding: '22px 20px 26px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.09)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.15)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Image src="/logo-icon.png" alt="uMshado" width={34} height={34} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: .9 }} />
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 700 }}>Vendor Studio</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Edit Profile</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Choose a section to update your vendor profile</p>
        </div>
      </div>

      {/* Back to dashboard */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>
        <Link href="/vendor/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: MUT, textDecoration: 'none', padding: '6px 12px', borderRadius: 20, background: 'rgba(122,80,96,0.07)', border: `1px solid ${BOR}` }}>
          ← Back to dashboard
        </Link>
      </div>

      {/* Section links */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map((section, i) => (
          <Link
            key={section.href}
            href={section.href + modeQuery}
            className={`eh-card eh${i + 1}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
              background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`,
              textDecoration: 'none', boxShadow: '0 2px 8px rgba(26,13,18,0.04)',
              transition: 'border-color .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = CR; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(154,33,67,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BOR; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(26,13,18,0.04)'; }}
          >
            {/* Icon */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(154,33,67,0.07)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {section.icon}
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: DK }}>{section.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: MUT }}>{section.desc}</p>
            </div>
            {/* Arrow */}
            <svg className="eh-arrow" width="16" height="16" fill="none" stroke={MUT} strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
