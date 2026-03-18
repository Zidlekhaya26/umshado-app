'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getPostAuthRedirect, setAuthCookies } from '@/lib/authRouting';
import { BETA_INVITE_ONLY } from '@/lib/betaGate';
import Image from 'next/image';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

/* ─── Design tokens ──────────────────────────────────────── */

/* ─── Floating diamond ───────────────────────────────────── */
function Diamond({ size = 8, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, background: 'rgba(189,152,63,0.52)',
      transform: 'rotate(45deg)', position: 'absolute', pointerEvents: 'none',
      ...style,
    }} />
  );
}

/* ─── Styled input field ─────────────────────────────────── */
function Field({
  label, id, type = 'text', value, onChange, placeholder, error, suffix,
}: {
  label?: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; error?: string;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && (
        <label htmlFor={id} style={{
          display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1,
          textTransform: 'uppercase', color: MUT, marginBottom: 7,
        }}>{label}</label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: suffix ? '13px 46px 13px 16px' : '13px 16px',
            borderRadius: 12, outline: 'none', boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#c0392b' : focused ? CR : BOR}`,
            background: '#fff', fontSize: 14, color: DK, fontFamily: 'inherit',
            boxShadow: focused ? `0 0 0 3px rgba(154,33,67,0.09)` : 'none',
            transition: 'border-color 0.14s, box-shadow 0.14s',
          }}
        />
        {suffix && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>
        )}
      </div>
      {error && <p style={{ margin: '5px 0 0', fontSize: 12, color: '#c0392b' }}>{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════ */
function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || null;

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErrors({ password: error.message }); return; }
      if (data?.user) {
        setAuthCookies((data as any).session);
        if (redirectTo && (redirectTo.startsWith('/couple') || redirectTo.startsWith('/vendor'))) {
          router.push(redirectTo); return;
        }
        router.push(await getPostAuthRedirect());
        return;
      }
      setErrors({ password: 'Sign in did not complete. Please try again.' });
    } catch { setErrors({ password: 'An error occurred. Please try again.' }); }
    finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.umshado-app.vercel.app';
      const callbackUrl = redirectTo
        ? `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`
        : `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl } });
      if (error) alert('Google sign in error: ' + error.message);
    } catch { alert('Failed to sign in with Google'); }
  };

  const handleFacebookSignIn = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.umshado-app.vercel.app';
      const callbackUrl = redirectTo
        ? `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`
        : `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo: callbackUrl } });
      if (error) alert('Facebook sign in error: ' + error.message);
    } catch { alert('Failed to sign in with Facebook'); }
  };

  const EyeIcon = ({ open }: { open: boolean }) => open
    ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
    : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

  return (
    <div style={{ minHeight: '100svh', display: 'flex', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes siUp   { from{opacity:0;transform:translateY(15px)} to{opacity:1;transform:translateY(0)} }
        @keyframes siFltA { 0%,100%{transform:rotate(45deg) translateY(0)} 50%{transform:rotate(45deg) translateY(-11px)} }
        @keyframes siFltB { 0%,100%{transform:rotate(45deg) translateY(0)} 50%{transform:rotate(45deg) translateY(10px)} }
        @keyframes siGlow { 0%,100%{opacity:.14} 50%{opacity:.28} }
        @keyframes siSpin { to{transform:rotate(360deg)} }
        .si1{animation:siUp .45s ease .04s both}.si2{animation:siUp .45s ease .10s both}
        .si3{animation:siUp .45s ease .16s both}.si4{animation:siUp .45s ease .22s both}
        .si5{animation:siUp .45s ease .28s both}.si6{animation:siUp .45s ease .34s both}
        .si-hero{display:none}
        @media(min-width:860px){.si-hero{display:flex!important}.si-mhero{display:none!important}}
        .si-gbtn:hover{border-color:${CR}!important;background:#fff7f5!important}
        input,.si-sbtn{font-family:inherit!important}
        .si-sbtn{background:none;border:none;cursor:pointer;color:${MUT};padding:4px;display:flex;align-items:center;transition:color .12s}
        .si-sbtn:hover{color:${CR}}
        .si-submit:hover:not(:disabled){box-shadow:0 6px 24px rgba(154,33,67,0.38)!important;transform:translateY(-1px)}
        .si-submit:active:not(:disabled){transform:translateY(0)}
        .si-submit{transition:box-shadow .14s,transform .14s,opacity .14s}
      `}</style>

      {/* ══ LEFT hero (desktop only) ════════════════════════ */}
      <div className="si-hero" style={{
        width: '45%', flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`,
        flexDirection: 'column',
      }}>
        {/* Rings */}
        {[580, 440, 315, 205].map((s, i) => (
          <div key={s} style={{
            position: 'absolute', width: s, height: s, borderRadius: '50%',
            border: `1.5px solid rgba(189,152,63,${0.04 + i * 0.04})`,
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
          }} />
        ))}
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(189,152,63,0.22) 0%, transparent 65%)',
          animation: 'siGlow 5s ease infinite', pointerEvents: 'none',
        }} />
        {/* Diamonds */}
        <Diamond size={10} style={{ top: '16%', left: '22%', animation: 'siFltA 6s ease-in-out infinite' }} />
        <Diamond size={6}  style={{ top: '67%', right: '19%', animation: 'siFltB 8s ease-in-out .4s infinite', opacity: .7 }} />
        <Diamond size={7}  style={{ top: '42%', left: '11%', animation: 'siFltA 9.5s ease-in-out 1s infinite', opacity: .5 }} />
        <Diamond size={5}  style={{ bottom: '22%', left: '36%', animation: 'siFltB 7.5s ease-in-out .8s infinite', opacity: .55 }} />
        <Diamond size={4}  style={{ top: '30%', right: '14%', animation: 'siFltA 11s ease-in-out 2s infinite', opacity: .4 }} />

        {/* Centre content */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 48px', textAlign: 'center' }}>
          <Image src="/logo-icon.png" alt="uMshado" width={70} height={70} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: .93, marginBottom: 28 }} />
          <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1.18, letterSpacing: -.5 }}>
            Your wedding,<br />beautifully planned
          </h1>
          <p style={{ margin: '0 0 40px', fontSize: 14.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.7, maxWidth: 268 }}>
            South Africa's premium wedding platform — connecting couples with extraordinary vendors
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%', maxWidth: 285 }}>
            {[['💍','2 400+ couples planning'],['🏪','800+ verified vendors'],['⭐','Across South Africa']].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 18px', borderRadius: 28, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: .2 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />
      </div>

      {/* ══ RIGHT — form ════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Mobile hero banner */}
        <div className="si-mhero" style={{
          background: `linear-gradient(160deg, ${CRX} 0%, ${CR} 52%, #c03050 100%)`,
          padding: '40px 28px 46px', position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{ position: 'absolute', top: -70, right: -70, width: 240, height: 240, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -35, right: -35, width: 150, height: 150, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.16)', pointerEvents: 'none' }} />
          <Diamond size={7} style={{ top: '22%', left: '16%', animation: 'siFltA 7s ease-in-out infinite' }} />
          <Diamond size={5} style={{ bottom: '24%', right: '20%', animation: 'siFltB 9s ease-in-out infinite' }} />
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <Image src="/logo-icon.png" alt="uMshado" width={56} height={56} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: .92, display: 'block', margin: '0 auto 14px' }} />
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: -.3 }}>Welcome back</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Sign in to continue your wedding journey</p>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${GD},transparent)` }} />
        </div>

        {/* Form area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '44px 36px', maxWidth: 440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {/* Desktop heading */}
          <div className="si1" style={{ marginBottom: 30 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: 1.3, textTransform: 'uppercase' }}>Sign in</p>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif', letterSpacing: -.4 }}>Welcome back</h2>
          </div>

          {/* Social buttons */}
          <div className="si2" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={handleGoogleSignIn} className="si-gbtn" style={{
              width: '100%', padding: '12px 16px', borderRadius: 13,
              border: `1.5px solid ${BOR}`, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontSize: 14, fontWeight: 700, color: DK, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(26,13,18,0.05)', transition: 'border-color .14s,background .14s',
              fontFamily: 'inherit',
            }}>
              <GoogleIcon />
              Continue with Google
            </button>
            <button onClick={handleFacebookSignIn} className="si-gbtn" style={{
              width: '100%', padding: '12px 16px', borderRadius: 13,
              border: `1.5px solid ${BOR}`, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontSize: 14, fontWeight: 700, color: DK, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(26,13,18,0.05)', transition: 'border-color .14s,background .14s',
              fontFamily: 'inherit',
            }}>
              <FacebookIcon />
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="si2" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: BOR }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: MUT, letterSpacing: .9 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: BOR }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="si3">
              <Field
                label="Email address" id="email" type="email" value={email}
                onChange={v => { setEmail(v); if (errors.email) setErrors(e => ({ ...e, email: '' })); }}
                placeholder="you@example.com" error={errors.email}
              />
            </div>

            <div className="si4">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label htmlFor="password" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: MUT }}>Password</label>
                <Link href="/auth/forgot-password" style={{ fontSize: 11.5, fontWeight: 700, color: CR, textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <Field
                id="password" type={showPw ? 'text' : 'password'} value={password}
                onChange={v => { setPassword(v); if (errors.password) setErrors(e => ({ ...e, password: '' })); }}
                placeholder="••••••••" error={errors.password}
                suffix={
                  <button type="button" className="si-sbtn" onClick={() => setShowPw(p => !p)}>
                    <EyeIcon open={showPw} />
                  </button>
                }
              />
            </div>

            <div className="si5">
              <button type="submit" disabled={isLoading} className="si-submit" style={{
                width: '100%', padding: '14px', borderRadius: 13, border: 'none',
                background: `linear-gradient(135deg,${CR} 0%,${CR2} 100%)`,
                color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: isLoading ? 'default' : 'pointer',
                boxShadow: '0 4px 18px rgba(154,33,67,0.28)',
                opacity: isLoading ? .65 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit',
              }}>
                {isLoading && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'siSpin .8s linear infinite' }} />}
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          <p className="si6" style={{ textAlign: 'center', margin: '22px 0 0', fontSize: 13.5, color: MUT }}>
            {BETA_INVITE_ONLY
              ? <>Don&apos;t have an invite?{' '}<Link href="/request-access" style={{ color: CR, fontWeight: 800, textDecoration: 'none' }}>Request access</Link></>
              : <>Don&apos;t have an account?{' '}<Link href="/auth/sign-up" style={{ color: CR, fontWeight: 800, textDecoration: 'none' }}>Create one</Link></>
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--um-ivory)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(154,33,67,0.12)', borderTopColor: 'var(--um-crimson)', borderRadius: '50%', animation: 'siSpin .8s linear infinite' }} />
        <style>{'@keyframes siSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
