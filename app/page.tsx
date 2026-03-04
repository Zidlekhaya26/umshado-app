import Link from 'next/link';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';
import { UmshadoLogo } from '@/components/ui/UmshadoLogo';

export default function Home() {
  return (
    <div style={{ minHeight:'100svh', background:'var(--background)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:420, background:'var(--surface)', borderRadius:28, boxShadow:'0 8px 48px rgba(0,0,0,0.18)', padding:'40px 28px 36px', position:'relative', overflow:'hidden' }}>
        {/* Gold orb decoration */}
        <div style={{ position:'absolute', top:-50, right:-50, width:160, height:160, borderRadius:'50%', background:'rgba(184,151,62,0.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, left:-30, width:100, height:100, borderRadius:'50%', background:'rgba(184,151,62,0.05)', pointerEvents:'none' }} />

        {/* Logo — on lighter bg, maroon logo is visible */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'inline-block', marginBottom:12 }}>
            <UmshadoLogo iconSize={64} />
          </div>

          {BETA_INVITE_ONLY && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, background:'rgba(184,151,62,0.12)', border:'1px solid rgba(184,151,62,0.25)', marginBottom:16 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--um-gold)', display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize:10, fontWeight:700, color:'var(--primary-dark)', letterSpacing:1.5 }}>PRIVATE BETA</span>
            </div>
          )}

          <h1 style={{ margin:'0 0 10px', fontSize:28, fontWeight:700, color:'var(--foreground)', fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1.2 }}>
            Welcome to uMshado
          </h1>
          <p style={{ margin:0, fontSize:14, color:'var(--muted)', lineHeight:1.65 }}>
            {BETA_INVITE_ONLY
              ? 'Your all-in-one South African wedding planning platform — currently in private beta.'
              : 'Plan your dream wedding, discover trusted vendors, and celebrate every milestone.'}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,var(--border),transparent)', margin:'0 0 24px' }} />

        {/* Action buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {BETA_INVITE_ONLY ? (
            <>
              <Link href="/auth/sign-in"
                style={{ display:'block', width:'100%', padding:'14px 20px', borderRadius:16, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:15, fontWeight:700, textAlign:'center', textDecoration:'none', boxShadow:'0 4px 16px rgba(184,151,62,0.35)', boxSizing:'border-box' }}>
                Sign In
              </Link>
              <Link href="/request-access"
                style={{ display:'block', width:'100%', padding:'14px 20px', borderRadius:16, background:'transparent', color:'var(--primary-dark)', fontSize:15, fontWeight:700, textAlign:'center', textDecoration:'none', border:'1.5px solid rgba(184,151,62,0.4)', boxSizing:'border-box' }}>
                Request Access
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/sign-up?role=couple"
                style={{ display:'block', width:'100%', padding:'14px 20px', borderRadius:16, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:15, fontWeight:700, textAlign:'center', textDecoration:'none', boxShadow:'0 4px 16px rgba(184,151,62,0.35)', boxSizing:'border-box' }}>
                💍 I&apos;m planning a wedding
              </Link>
              <Link href="/auth/sign-up?role=vendor"
                style={{ display:'block', width:'100%', padding:'14px 20px', borderRadius:16, background:'transparent', color:'var(--primary-dark)', fontSize:15, fontWeight:700, textAlign:'center', textDecoration:'none', border:'1.5px solid rgba(184,151,62,0.4)', boxSizing:'border-box' }}>
                🏪 I&apos;m a wedding vendor
              </Link>
            </>
          )}
        </div>

        {/* Sign in link */}
        <p style={{ margin:'22px 0 0', textAlign:'center', fontSize:13, color:'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/auth/sign-in" style={{ color:'var(--um-gold)', fontWeight:700, textDecoration:'none' }}>
            Sign in
          </Link>
        </p>
      </div>
      <style>{'@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}'}</style>
    </div>
  );
}
