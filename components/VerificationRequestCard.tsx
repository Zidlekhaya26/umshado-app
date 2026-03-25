'use client';

import Link from 'next/link';

/**
 * VerificationRequestCard — payment-first verification.
 * Clicking "Apply for Verification" goes to /vendor/billing#verification.
 */
export default function VerificationRequestCard({ vendorVerified }: { vendorVerified: boolean }) {
  if (vendorVerified) {
    return (
      <div style={{
        padding: '14px 18px', borderRadius: 16,
        background: '#ecfdf5', border: '1.5px solid #a7f3d0',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46' }}>uMshado Verified</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#059669' }}>Your verified badge is live on your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1.5px solid rgba(15,12,41,0.12)',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', border: '1.5px solid rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Get Verified</p>
            <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#3b82f6' }}>One-time application · R99 · No renewals</p>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: 'rgba(37,99,235,0.12)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.2)', letterSpacing: 0.5 }}>BADGE</span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px' }}>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#374151', lineHeight: 1.55 }}>
          Pay a once-off application fee to apply for your verified badge. Our team reviews your business details within 2–3 working days.
        </p>

        {/* Benefits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {[
            { icon: '✓', text: 'Verified shield badge on your profile' },
            { icon: '✓', text: 'Higher placement in search results' },
            { icon: '✓', text: 'Build instant trust with couples' },
          ].map(b => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#2563eb' }}>{b.icon}</span>
              </div>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{b.text}</span>
            </div>
          ))}
        </div>

        <Link
          href="/vendor/billing#verification"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 18px', borderRadius: 12, textDecoration: 'none',
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            boxShadow: '0 3px 12px rgba(37,99,235,0.28)',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          Apply for Verification — R99
        </Link>

        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
          Full refund if your business cannot be verified. No questions asked.
        </p>
      </div>
    </div>
  );
}
