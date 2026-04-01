'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

/* ── Brand tokens ─────────────────────────────────────────── */
const CR = '#9A2143', CR2 = '#731832', CRX = '#4d0f21';
const GD = '#BD983F', GD2 = '#8a6b24';
const DK = '#1a0d12', BG = '#faf8f5', BOR = '#e8d5d0';

/* ── Feature data ─────────────────────────────────────────── */
const COUPLE_FEATURES = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    ),
    title: 'Find Vendors',
    desc: 'Browse photographers, venues, caterers, florists and more — all vetted, local and ready to quote.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    title: 'Wedding Website',
    desc: 'Create a beautiful wedding website for your guests — RSVP, event details, countdown and your love story in one link.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
      </svg>
    ),
    title: 'Wedding Planner',
    desc: 'Tasks, checklists, and timelines so nothing gets missed — from first deposit to the last dance.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    ),
    title: 'Guest List & RSVPs',
    desc: 'Manage your guest list, track RSVPs, meal choices and seating — no more endless spreadsheets.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    title: 'Budget Tracker',
    desc: 'Set your total budget, log every expense and always know exactly where your money is going.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    ),
    title: 'Direct Messaging',
    desc: 'Chat directly with vendors, share documents and get quotes — no middlemen, no hidden fees.',
  },
];

const VENDOR_FEATURES = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    ),
    title: 'Showcase Your Work',
    desc: 'Upload your portfolio, set your packages, and let your work speak for itself.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    ),
    title: 'Reach More Couples',
    desc: 'Get discovered by couples actively planning their wedding across Africa.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
    title: 'Profile Analytics',
    desc: 'See who views your profile, which packages get clicks, and where leads come from.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    title: 'Manage Quotes',
    desc: 'Respond to quote requests, negotiate, and convert leads — all in one inbox.',
  },
];

const STEPS = [
  { step: '01', title: 'Create your account', desc: 'Sign up in under a minute — free for couples, free to list for vendors.' },
  { step: '02', title: 'Set up your profile', desc: 'Couples add their wedding details. Vendors upload their portfolio and packages.' },
  { step: '03', title: 'Start connecting', desc: 'Browse vendors, send messages, request quotes, and plan your perfect day.' },
];

export default function Home() {
  const { user, role, loading } = useAuthRole();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && role === 'couple') { router.replace('/couple/dashboard'); return; }
    if (user && role === 'vendor') { router.replace('/vendor/dashboard'); return; }
  }, [user, role, loading, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already running as installed PWA — hide the install section
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }
    // Capture the browser's native install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const handleAndroidInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') setInstallPrompt(null);
    } else {
      // Fallback: direct APK download
      const a = document.createElement('a');
      a.href = '/umshado.apk';
      a.download = 'uMshado.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  /* Redirect flash — show nothing while redirecting authenticated users */
  if (!loading && user) return null;

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: BG, color: DK, overflowX: 'hidden' }}>

      {/* ── Sticky Nav ────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 20px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'background 0.25s, box-shadow 0.25s',
        background: scrolled ? 'rgba(26,13,18,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled ? '0 1px 0 rgba(255,255,255,0.08)' : 'none',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/logo-full.png" alt="uMshado" width={180} height={58} style={{ height: 52, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/auth/sign-in" style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', transition: 'border-color 0.2s' }}>
            Sign In
          </Link>
          <Link href="/auth/sign-up" style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13.5, fontWeight: 700, color: '#fff', textDecoration: 'none', background: CR, boxShadow: '0 2px 10px rgba(154,33,67,0.4)' }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100svh', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden',
      }}>
        {/* Background photo */}
        <img
          src="https://images.pexels.com/photos/14988950/pexels-photo-14988950.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1280&fit=crop"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', pointerEvents: 'none' }}
        />
        {/* Gradient overlay — dark enough that white text is always legible over any photo */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(20,8,14,0.72) 0%, rgba(26,13,18,0.82) 35%, rgba(26,13,18,0.88) 65%, rgba(20,8,14,0.75) 100%)`, pointerEvents: 'none', zIndex: 1 }} />
        {/* Abstract decorative rings */}
        <div style={{ position: 'absolute', top: '10%', left: '-10%', width: '50vw', height: '50vw', maxWidth: 500, maxHeight: 500, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '-15%', width: '60vw', height: '60vw', maxWidth: 600, maxHeight: 600, borderRadius: '50%', border: '1px solid rgba(189,152,63,0.08)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Content wrapper — z-index 2 ensures it always sits above photo + overlay */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 16px', borderRadius: 20, background: 'rgba(189,152,63,0.15)', border: '1px solid rgba(189,152,63,0.3)', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GD, display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: GD, letterSpacing: 1.8, textTransform: 'uppercase' }}>Africa&apos;s Wedding Platform</span>
          </div>

          {/* Headline */}
          <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(36px, 7vw, 72px)', fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', lineHeight: 1.1, maxWidth: 820, letterSpacing: -1, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            Your dream wedding,<br />
            <span style={{ color: GD }}>perfectly planned.</span>
          </h1>
          <p style={{ margin: '0 0 44px', fontSize: 'clamp(15px, 2.5vw, 19px)', color: 'rgba(255,255,255,0.80)', lineHeight: 1.65, maxWidth: 560, textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
            Discover trusted vendors, manage every detail, and celebrate your love story — all in one place. Built for African couples and wedding businesses.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link href="/auth/sign-up?role=couple" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', borderRadius: 30, background: `linear-gradient(135deg, ${CR}, ${CR2})`, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(154,33,67,0.5)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              Plan My Wedding
            </Link>
            <Link href="/auth/sign-up?role=vendor" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', borderRadius: 30, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              List My Business
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.45, zIndex: 2 }}>
          <span style={{ fontSize: 11, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' }}>Scroll</span>
          <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <section style={{ background: DK, padding: '20px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 40px' }}>
          {[
            { num: '500+', label: 'Vendors listed' },
            { num: '50+', label: 'Service categories' },
            { num: '5+', label: 'Countries growing' },
            { num: '100%', label: 'Free for couples' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: GD, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Photo strip ───────────────────────────────────────── */}
      <section style={{ overflow: 'hidden', lineHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 0.9fr', height: 'clamp(180px, 28vw, 340px)' }}>
          <img
            src="https://images.pexels.com/photos/3975613/pexels-photo-3975613.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop"
            alt="Wedding couple portrait"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
          />
          <img
            src="https://images.pexels.com/photos/11618945/pexels-photo-11618945.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop"
            alt="Wedding ceremony moment"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
          <img
            src="https://images.pexels.com/photos/26502322/pexels-photo-26502322.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop"
            alt="Couple celebrating their wedding"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) 24px', background: '#fff' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: CR, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: DK, fontFamily: 'Georgia, serif', margin: '0 0 56px', lineHeight: 1.2 }}>Up and running in minutes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {STEPS.map(({ step, title, desc }) => (
              <div key={step} style={{ textAlign: 'center', padding: '32px 24px', borderRadius: 20, background: BG, border: `1.5px solid ${BOR}` }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${CR}, ${CR2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(154,33,67,0.25)' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{step}</span>
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: DK }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: '#7a5060', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Couples ───────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) 24px', background: BG }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: 'rgba(154,33,67,0.08)', border: `1px solid rgba(154,33,67,0.18)`, marginBottom: 14 }}>
            <svg width="14" height="14" fill={CR} viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: CR, letterSpacing: 1.8, textTransform: 'uppercase' }}>For Couples</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: DK, fontFamily: 'Georgia, serif', margin: '0 0 8px', lineHeight: 1.2 }}>Everything for your big day</h2>
          <p style={{ fontSize: 15.5, color: '#7a5060', lineHeight: 1.65, maxWidth: 540, margin: '0 0 32px' }}>From finding the perfect venue to ticking off the last task — uMshado keeps your wedding journey organised and stress-free.</p>

          {/* Couple photo */}
          <div style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 36, height: 'clamp(220px, 36vw, 420px)', position: 'relative' }}>
            <img
              src="https://images.pexels.com/photos/29955684/pexels-photo-29955684.jpeg?auto=compress&cs=tinysrgb&w=1400&h=700&fit=crop"
              alt="South African wedding couple"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,13,18,0.6) 0%, transparent 50%)' }} />
            <div style={{ position: 'absolute', bottom: 22, left: 26, right: 26 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: 0.3 }}>Your love story deserves to be celebrated — perfectly.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {COUPLE_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '28px 22px', borderRadius: 20, background: '#fff', border: `1.5px solid ${BOR}`, transition: 'box-shadow 0.2s' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(154,33,67,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CR, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: DK }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: '#7a5060', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36, display: 'flex', gap: 12 }}>
            <Link href="/auth/sign-up?role=couple" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 24, background: `linear-gradient(135deg, ${CR}, ${CR2})`, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 3px 14px rgba(154,33,67,0.3)' }}>
              Start Planning Free
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── For Vendors ───────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) 24px', background: DK }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: 'rgba(189,152,63,0.12)', border: '1px solid rgba(189,152,63,0.25)', marginBottom: 14 }}>
            <svg width="14" height="14" fill={GD} viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: GD, letterSpacing: 1.8, textTransform: 'uppercase' }}>For Vendors</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', margin: '0 0 8px', lineHeight: 1.2 }}>Grow your wedding business</h2>
          <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, maxWidth: 540, margin: '0 0 32px' }}>List your business for free and get in front of couples across Africa who are actively planning their weddings right now.</p>

          {/* Vendor category grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 36, borderRadius: 24, overflow: 'hidden' }}>
            {[
              { src: 'https://images.pexels.com/photos/27025523/pexels-photo-27025523.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop', label: 'Catering' },
              { src: 'https://images.pexels.com/photos/14071388/pexels-photo-14071388.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop', label: 'Photography' },
              { src: 'https://images.pexels.com/photos/34244969/pexels-photo-34244969.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop', label: 'Makeup & Beauty' },
              { src: 'https://images.pexels.com/photos/33485957/pexels-photo-33485957.jpeg?auto=compress&cs=tinysrgb&w=800&h=500&fit=crop', label: 'Venues' },
            ].map(({ src, label }) => (
              <div key={label} style={{ position: 'relative', height: 'clamp(120px, 18vw, 220px)', borderRadius: 16, overflow: 'hidden' }}>
                <img
                  src={src}
                  alt={label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,13,18,0.72) 0%, rgba(26,13,18,0.1) 55%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: GD, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {VENDOR_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '28px 22px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(189,152,63,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GD, marginBottom: 16 }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36 }}>
            <Link href="/auth/sign-up?role=vendor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 24, background: `linear-gradient(135deg, ${GD}, ${GD2})`, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 3px 14px rgba(189,152,63,0.3)' }}>
              List My Business Free
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Install section ───────────────────────────────────── */}
      {!isStandalone && (
      <section style={{ padding: 'clamp(60px,8vw,100px) 24px', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: CR, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 }}>Get the App</p>
            <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: DK, fontFamily: 'Georgia, serif', margin: '0 0 14px', lineHeight: 1.2 }}>Take uMshado everywhere</h2>
            <p style={{ fontSize: 15.5, color: '#7a5060', lineHeight: 1.65, maxWidth: 500, margin: '0 auto 20px' }}>
              Install the app for the best experience — fast, works offline, and supports push notifications for messages and bookings.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {['Works offline', 'Push notifications', 'No App Store needed', 'Free forever'].map(f => (
                <span key={f} style={{ fontSize: 12, fontWeight: 600, color: CR, background: 'rgba(154,33,67,0.07)', border: '1px solid rgba(154,33,67,0.15)', borderRadius: 20, padding: '4px 14px' }}>{f}</span>
              ))}
            </div>
          </div>
          {/* Platform cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

            {/* ── Android card ── */}
            <div style={{ borderRadius: 28, overflow: 'hidden', background: '#fff', border: `1.5px solid ${BOR}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '28px 28px 24px', background: 'linear-gradient(135deg, #0a2e1a, #1a5c32)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-1C2.67 17 2 16.33 2 15.5v-7C2 7.67 2.67 7 3.5 7S5 7.67 5 8.5v7c0 .83-.67 1.5-1.5 1.5zm17 0c-.83 0-1.5-.67-1.5-1.5v-7c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.88.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12a5.96 5.96 0 00-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Android</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>One-tap install</div>
                  </div>
                </div>
                <button
                  onClick={handleAndroidInstall}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 18, fontSize: 15, fontWeight: 700,
                    background: installPrompt ? '#4ade80' : 'rgba(255,255,255,0.12)',
                    color: installPrompt ? '#0a2e1a' : '#fff',
                    border: installPrompt ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: installPrompt ? '0 4px 16px rgba(74,222,128,0.4)' : 'none',
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {installPrompt ? 'Tap to Install Now' : 'Install on Android'}
                </button>
                {!installPrompt && (
                  <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    or{' '}
                    <a href="/umshado.apk" download="uMshado.apk" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'underline' }}>
                      download APK directly
                    </a>
                  </p>
                )}
              </div>
              <div style={{ padding: '22px 28px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: '#7a5060', letterSpacing: 1.2, textTransform: 'uppercase' }}>Manual steps via Chrome</p>
                {[
                  { icon: '🌐', text: 'Open umshadohub.co.za in Chrome' },
                  { icon: '⋮', text: 'Tap the 3-dot menu (top right)' },
                  { icon: '📲', text: 'Tap "Add to Home screen"' },
                  { icon: '✓', text: 'Tap "Add" to confirm' },
                ].map(({ icon, text }, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 11 : 0, alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(52,168,83,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>{icon}</div>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#4a3728', lineHeight: 1.45 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── iPhone card ── */}
            <div style={{ borderRadius: 28, overflow: 'hidden', background: '#fff', border: `1.5px solid ${BOR}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '28px 28px 24px', background: 'linear-gradient(135deg, #1c1c1e, #3a3a3c)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="26" height="26" fill="white" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>iPhone</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Add to Home Screen</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(true)}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 18, fontSize: 15, fontWeight: 700,
                    background: CR, color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: '0 4px 16px rgba(154,33,67,0.45)',
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                  How to Install on iPhone
                </button>
                <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Takes 30 seconds in Safari</p>
              </div>
              <div style={{ padding: '22px 28px' }}>
                <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: '#7a5060', letterSpacing: 1.2, textTransform: 'uppercase' }}>Quick steps via Safari</p>
                {[
                  { icon: '🧭', text: 'Open in Safari (not Chrome)' },
                  { icon: '⬆️', text: 'Tap the Share button at the bottom' },
                  { icon: '＋', text: 'Tap "Add to Home Screen"' },
                  { icon: '✓', text: 'Tap "Add" — done!' },
                ].map(({ icon, text }, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 11 : 0, alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>{icon}</div>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#4a3728', lineHeight: 1.45 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Push notification callout */}
          <div style={{ padding: '18px 22px', borderRadius: 18, background: 'rgba(154,33,67,0.06)', border: '1px solid rgba(154,33,67,0.15)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: CR, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(154,33,67,0.3)' }}>
              <svg width="22" height="22" fill="none" stroke="white" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DK }}>Get instant notifications after installing</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#7a5060', lineHeight: 1.45 }}>Once installed, open the app and tap "Enable notifications" to receive instant alerts for new messages, quote replies and bookings — even when the app is closed.</p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(60px,8vw,100px) 24px', background: `linear-gradient(135deg, ${DK}, ${CRX} 60%, ${CR})`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', margin: '0 0 16px', lineHeight: 1.15 }}>
            Ready to start your<br />
            <span style={{ color: GD }}>wedding journey?</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, margin: '0 0 40px' }}>Join thousands of African couples and wedding vendors already using uMshado.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link href="/auth/sign-up?role=couple" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 30px', borderRadius: 30, background: '#fff', color: CR, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              I&apos;m planning a wedding
            </Link>
            <Link href="/auth/sign-up?role=vendor" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 30px', borderRadius: 30, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)' }}>
              I&apos;m a vendor
            </Link>
          </div>
        </div>
      </section>

      {/* ── iOS Install Modal ─────────────────────────────────── */}
      {showIOSModal && (
        <div
          onClick={() => setShowIOSModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: '28px 28px 0 0', padding: '12px 28px 48px', boxShadow: '0 -8px 50px rgba(0,0,0,0.25)' }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e0d0d4', margin: '8px auto 28px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: DK, fontFamily: 'Georgia, serif' }}>Add to iPhone</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7a5060' }}>Follow these steps in Safari</p>
              </div>
              <button onClick={() => setShowIOSModal(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5edf0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" stroke={CR} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
              {[
                { color: '#0077ff', title: 'Open Safari', desc: 'Must be Safari — Chrome cannot install the app on iPhone.', icon: <svg width="22" height="22" fill="none" stroke="white" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg> },
                { color: '#34a853', title: 'Tap the Share button', desc: 'The square with an arrow — at the bottom centre of Safari.', icon: <svg width="22" height="22" fill="none" stroke="white" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> },
                { color: CR, title: 'Tap "Add to Home Screen"', desc: 'Scroll down in the share sheet — it\'s listed with a + icon.', icon: <svg width="22" height="22" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg> },
                { color: '#16a34a', title: 'Tap "Add" to confirm', desc: 'uMshado is now on your home screen. Open it and enable notifications!', icon: <svg width="22" height="22" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> },
              ].map(({ color, title, desc, icon }, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${color}55` }}>
                    {icon}
                  </div>
                  <div style={{ paddingTop: 3 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DK }}>{title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: '#7a5060', lineHeight: 1.45 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(154,33,67,0.07)', border: '1px solid rgba(154,33,67,0.15)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width="18" height="18" fill="none" stroke={CR} strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <p style={{ margin: 0, fontSize: 12.5, color: '#5a3040', lineHeight: 1.45 }}>
                After installing, open the app and tap <strong>Enable notifications</strong> to get instant alerts for messages and bookings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{ background: '#100810', padding: '40px 24px 32px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
            <Image src="/logo-full.png" alt="uMshado" width={120} height={38} style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.8 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
              {[
                { label: 'For Couples', href: '/auth/sign-up?role=couple' },
                { label: 'For Vendors', href: '/auth/sign-up?role=vendor' },
                { label: 'Marketplace', href: '/marketplace' },
                { label: 'Sign In', href: '/auth/sign-in' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>{label}</Link>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              &copy; {new Date().getFullYear()} uMshado. Built with love for African weddings.
            </p>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <Link href="/privacy" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Privacy</Link>
              <Link href="/terms" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Terms</Link>
              <Link href="/auth/sign-in" style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', textDecoration: 'none', letterSpacing: 0.5 }}>Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
