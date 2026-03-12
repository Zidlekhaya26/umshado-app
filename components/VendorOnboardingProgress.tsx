const STEPS = [
  { n: 1, label: 'Profile' },
  { n: 2, label: 'Services' },
  { n: 3, label: 'Packages' },
  { n: 4, label: 'Media' },
  { n: 5, label: 'Review' },
];

const CR  = '#9A2143';
const GD  = '#BD983F';

export default function VendorOnboardingProgress({ step }: { step: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 16px 16px',
      overflowX: 'auto',
    }}>
      {STEPS.map((s, i) => {
        const done    = s.n < step;
        const current = s.n === step;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{
                width: 18,
                height: 2,
                borderRadius: 1,
                background: done || current ? `rgba(189,152,63,0.55)` : 'rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}/>
            )}
            {/* Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: current ? '5px 12px' : '5px 9px',
              borderRadius: 20,
              background: done
                ? `rgba(189,152,63,0.22)`
                : current
                  ? 'rgba(255,255,255,0.18)'
                  : 'rgba(255,255,255,0.07)',
              border: `1.5px solid ${done ? 'rgba(189,152,63,0.45)' : current ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
              transition: 'all .15s',
            }}>
              {done ? (
                /* Gold checkmark */
                <svg width="11" height="11" fill="none" stroke={GD} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                /* Step number */
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: current ? '#fff' : 'rgba(255,255,255,0.38)',
                  lineHeight: 1,
                }}>{s.n}</span>
              )}
              {current && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: .2,
                }}>{s.label}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
