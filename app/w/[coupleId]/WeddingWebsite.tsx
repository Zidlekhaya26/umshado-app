'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  location: string | null;
  sort_order: number;
}

interface WellWish {
  id: string;
  guest_name: string;
  message: string;
  created_at: string;
}

interface Moment {
  id: string;
  guest_name: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
}

interface Props {
  coupleId: string;
  coupleName: string | null;
  partnerName: string | null;
  weddingDate: string | null;
  location: string | null;
  avatarUrl: string | null;
  schedule: ScheduleEvent[];
  wishes: WellWish[];
  moments: Moment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12h(t: string) {
  if (!t?.includes(':')) return t;
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(dateStr: string | null) {
  const [counts, setCounts] = useState({ d: 0, h: 0, m: 0, s: 0, past: false });

  useEffect(() => {
    if (!dateStr) return;
    const tick = () => {
      const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
      if (diff <= 0) { setCounts(c => ({ ...c, past: true })); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCounts({ d, h, m, s, past: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dateStr]);

  return counts;
}

// ─── Section wrapper (fade-in on scroll) ─────────────────────────────────────

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
    >
      {children}
    </div>
  );
}

// ─── Well Wish Form ───────────────────────────────────────────────────────────

function WishForm({ coupleId, onAdded }: { coupleId: string; onAdded: (w: WellWish) => void }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try { const n = localStorage.getItem('umshado_guest_name'); if (n) setName(n); } catch {}
  }, []);

  const send = async () => {
    if (!name.trim() || !msg.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/live/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupleId, guestName: name.trim(), message: msg.trim() }),
      });
      if (res.ok) {
        const j = await res.json();
        try { localStorage.setItem('umshado_guest_name', name.trim()); } catch {}
        onAdded(j.wish ?? { id: Date.now().toString(), guest_name: name.trim(), message: msg.trim(), created_at: new Date().toISOString() });
        setMsg('');
        setDone(true);
        setTimeout(() => setDone(false), 4000);
      }
    } catch {}
    setSending(false);
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">💌</div>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#c9a84c', fontSize: '1.1rem', fontStyle: 'italic' }}>
          Your wish has been sent!
        </p>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>The couple will cherish it forever.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.25)', color: '#fff', fontFamily: 'Georgia, serif' }}
      />
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="Write your wishes for the happy couple…"
        rows={3}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.25)', color: '#fff', fontFamily: 'Georgia, serif' }}
      />
      <button
        onClick={send}
        disabled={sending || !name.trim() || !msg.trim()}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #b8965a, #d4af70)', color: '#1a1208', fontFamily: 'Georgia, serif', letterSpacing: '0.05em' }}
      >
        {sending ? 'Sending…' : 'Send Wishes 💌'}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeddingWebsite({
  coupleId, coupleName, partnerName, weddingDate,
  location, avatarUrl, schedule, wishes: initWishes, moments,
}: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'wishes' | 'moments'>('info');
  const [wishes, setWishes] = useState<WellWish[]>(initWishes);
  const [copied, setCopied] = useState(false);

  const couple = coupleName && partnerName
    ? { name1: coupleName, name2: partnerName }
    : coupleName ? { name1: coupleName, name2: null }
    : { name1: 'The Happy', name2: 'Couple' };

  const countdown = useCountdown(weddingDate);

  const dateDisplay = weddingDate ? (() => {
    const d = new Date(weddingDate + 'T12:00:00');
    return {
      day: d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleDateString('en-ZA', { month: 'long' }),
      year: d.getFullYear().toString(),
      weekday: d.toLocaleDateString('en-ZA', { weekday: 'long' }),
    };
  })() : null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: couple.name2 ? `${couple.name1} & ${couple.name2}'s Wedding` : `${couple.name1}'s Wedding`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const tabs = [
    { id: 'info', label: 'About' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'wishes', label: `Wishes${wishes.length ? ` (${wishes.length})` : ''}` },
    { id: 'moments', label: 'Moments' },
  ] as const;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111008; }
        @keyframes heroFade { from { opacity:0; transform:scale(1.04) } to { opacity:1; transform:scale(1) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse-soft { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .hero-bg { animation: heroFade 1.2s ease both }
        .hero-text-1 { animation: slideUp 0.8s ease 0.5s both }
        .hero-text-2 { animation: slideUp 0.8s ease 0.7s both }
        .hero-text-3 { animation: slideUp 0.8s ease 0.9s both }
        .hero-cta    { animation: slideUp 0.8s ease 1.1s both }
        .gold-pulse  { animation: pulse-soft 2.5s ease-in-out infinite }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.3); }
        input:focus, textarea:focus { border-color: rgba(201,168,76,0.5) !important; }
        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div style={{ background: '#111008', minHeight: '100vh', fontFamily: "'Lora', Georgia, serif" }}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <div
          className="hero-bg relative overflow-hidden"
          style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Background — photo or gradient */}
          {avatarUrl ? (
            <>
              <img
                src={avatarUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.35 }}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(17,16,8,0.3) 0%, rgba(17,16,8,0.6) 50%, #111008 100%)' }} />
            </>
          ) : (
            <>
              {/* Decorative background without photo */}
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(107,31,58,0.12) 0%, transparent 60%)' }} />
              {/* Geometric line art */}
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
                <circle cx="200" cy="280" r="180" fill="none" stroke="#c9a84c" strokeWidth="0.5"/>
                <circle cx="200" cy="280" r="140" fill="none" stroke="#c9a84c" strokeWidth="0.3"/>
                <line x1="20" y1="280" x2="380" y2="280" stroke="#c9a84c" strokeWidth="0.3"/>
                <line x1="200" y1="100" x2="200" y2="460" stroke="#c9a84c" strokeWidth="0.3"/>
                <path d="M 60 180 Q 200 80 340 180" fill="none" stroke="#c9a84c" strokeWidth="0.4"/>
                <path d="M 60 380 Q 200 480 340 380" fill="none" stroke="#c9a84c" strokeWidth="0.4"/>
              </svg>
            </>
          )}

          {/* Content */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">

            {/* Top wordmark */}
            <p className="hero-text-1 text-[10px] tracking-[0.4em] uppercase mb-8" style={{ color: 'rgba(201,168,76,0.6)' }}>
              uMshado · Wedding
            </p>

            {/* Couple avatar */}
            {avatarUrl && (
              <div className="hero-text-1 mb-6">
                <div
                  className="mx-auto rounded-full overflow-hidden"
                  style={{
                    width: 100, height: 100,
                    border: '2px solid rgba(201,168,76,0.5)',
                    boxShadow: '0 0 0 6px rgba(201,168,76,0.1)',
                  }}
                >
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Names */}
            <div className="hero-text-2">
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(2.2rem, 10vw, 3.5rem)',
                fontWeight: 400,
                color: '#f5ead8',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
              }}>
                {couple.name1}
                {couple.name2 && (
                  <>
                    <br/>
                    <span style={{ color: '#c9a84c', fontSize: '0.55em', letterSpacing: '0.2em', fontStyle: 'normal', fontWeight: 400 }}>
                      &amp;
                    </span>
                    <br/>
                    {couple.name2}
                  </>
                )}
              </h1>
            </div>

            {/* Date & location */}
            {dateDisplay && (
              <div className="hero-text-3 mt-6 space-y-1">
                <p style={{ color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: '1.05rem' }}>
                  {dateDisplay.weekday}, {dateDisplay.day} {dateDisplay.month} {dateDisplay.year}
                </p>
                {location && (
                  <p className="text-sm" style={{ color: 'rgba(245,234,216,0.6)' }}>
                    📍 {location}
                  </p>
                )}
              </div>
            )}

            {/* Countdown */}
            {weddingDate && !countdown.past && (
              <div className="hero-cta mt-8">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { v: countdown.d, l: 'Days' },
                    { v: countdown.h, l: 'Hours' },
                    { v: countdown.m, l: 'Min' },
                    { v: countdown.s, l: 'Sec' },
                  ].map(({ v, l }) => (
                    <div key={l} className="text-center">
                      <div
                        className="rounded-xl py-2 px-1"
                        style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
                      >
                        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.6rem', fontWeight: 700, color: '#f5ead8', lineHeight: 1 }}>
                          {String(v).padStart(2, '0')}
                        </p>
                      </div>
                      <p className="text-[9px] mt-1 tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countdown.past && weddingDate && (
              <p className="hero-cta mt-6 text-lg" style={{ color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic' }}>
                🎉 We're married!
              </p>
            )}

            {/* Share + scroll hint */}
            <div className="hero-cta mt-8 flex items-center gap-3">
              <button
                onClick={share}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, #b8965a, #d4af70)', color: '#1a1208' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
                {copied ? 'Link copied!' : 'Share'}
              </button>
              <a
                href="#content"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(245,234,216,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                View details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="relative pb-8 flex justify-center gold-pulse">
            <svg className="w-5 h-5" style={{ color: 'rgba(201,168,76,0.5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        {/* ── CONTENT TABS ─────────────────────────────────── */}
        <div id="content" style={{ background: '#111008' }}>

          {/* Sticky tab bar */}
          <div
            className="sticky top-0 z-20 tab-scroll overflow-x-auto"
            style={{ background: 'rgba(17,16,8,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}
          >
            <div className="flex min-w-max px-4 py-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="px-5 py-3 text-xs font-semibold transition-all whitespace-nowrap"
                  style={{
                    color: activeTab === t.id ? '#c9a84c' : 'rgba(245,234,216,0.45)',
                    borderBottom: activeTab === t.id ? '2px solid #c9a84c' : '2px solid transparent',
                    letterSpacing: '0.05em',
                    fontFamily: "'Lora', Georgia, serif",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-8 max-w-lg mx-auto space-y-8 pb-20">

            {/* ── ABOUT ── */}
            {activeTab === 'info' && (
              <Section>
                <div className="space-y-6">
                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.2)' }}/>
                    <span style={{ color: '#c9a84c', fontSize: '1.2rem' }}>💍</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.2)' }}/>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>
                      We are getting married
                    </p>
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', color: '#f5ead8', fontStyle: 'italic' }}>
                      {couple.name2 ? `${couple.name1} & ${couple.name2}` : couple.name1}
                    </h2>
                  </div>

                  {/* Info cards */}
                  <div className="space-y-3">
                    {dateDisplay && (
                      <div
                        className="rounded-2xl p-5 flex items-center gap-4"
                        style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,76,0.12)' }}>
                          <svg className="w-6 h-6" style={{ color: '#c9a84c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs tracking-widest uppercase mb-0.5" style={{ color: 'rgba(201,168,76,0.6)' }}>Date</p>
                          <p style={{ color: '#f5ead8', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.05rem' }}>
                            {dateDisplay.weekday}
                          </p>
                          <p className="text-sm" style={{ color: 'rgba(245,234,216,0.6)' }}>
                            {dateDisplay.day} {dateDisplay.month} {dateDisplay.year}
                          </p>
                        </div>
                      </div>
                    )}

                    {location && (
                      <div
                        className="rounded-2xl p-5 flex items-center gap-4"
                        style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,76,0.12)' }}>
                          <svg className="w-6 h-6" style={{ color: '#c9a84c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs tracking-widest uppercase mb-0.5" style={{ color: 'rgba(201,168,76,0.6)' }}>Venue</p>
                          <p style={{ color: '#f5ead8', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.05rem' }}>
                            {location}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Wish CTA */}
                  <div
                    className="rounded-2xl p-5 text-center"
                    style={{ background: 'rgba(107,31,58,0.15)', border: '1px solid rgba(107,31,58,0.25)' }}
                  >
                    <p className="text-2xl mb-2">💌</p>
                    <p style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#f5ead8', fontSize: '1rem', fontStyle: 'italic' }}>
                      Send the couple your wishes
                    </p>
                    <p className="text-xs mt-1 mb-3" style={{ color: 'rgba(245,234,216,0.5)' }}>
                      Leave a heartfelt message for {couple.name2 ? `${couple.name1} & ${couple.name2}` : couple.name1}
                    </p>
                    <button
                      onClick={() => setActiveTab('wishes')}
                      className="px-5 py-2.5 rounded-full text-sm font-semibold"
                      style={{ background: 'linear-gradient(135deg, #b8965a, #d4af70)', color: '#1a1208' }}
                    >
                      Write a Wish
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* ── SCHEDULE ── */}
            {activeTab === 'schedule' && (
              <Section>
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#f5ead8', fontSize: '1.4rem', fontStyle: 'italic' }}>
                      Wedding Day Schedule
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'rgba(245,234,216,0.4)' }}>
                      {dateDisplay ? `${dateDisplay.day} ${dateDisplay.month} ${dateDisplay.year}` : 'The Big Day'}
                    </p>
                  </div>

                  {schedule.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-3">📋</p>
                      <p style={{ color: 'rgba(245,234,216,0.4)', fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif" }}>
                        Schedule coming soon…
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[23px] top-4 bottom-4 w-px" style={{ background: 'rgba(201,168,76,0.2)' }}/>
                      <div className="space-y-5">
                        {schedule.map((ev, i) => (
                          <div key={ev.id} className="flex gap-4">
                            {/* Dot */}
                            <div className="flex-shrink-0 w-12 flex flex-col items-center">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center mt-1 relative z-10"
                                style={{ background: i === 0 ? '#c9a84c' : 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)' }}
                              >
                                {i === 0 && <div className="w-2 h-2 rounded-full bg-white/80"/>}
                              </div>
                            </div>
                            {/* Content */}
                            <div
                              className="flex-1 rounded-xl p-4 mb-1"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
                            >
                              <p className="text-xs mb-1" style={{ color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
                                {fmt12h(ev.time)}
                              </p>
                              <p style={{ color: '#f5ead8', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '0.95rem' }}>
                                {ev.title}
                              </p>
                              {ev.location && (
                                <p className="text-xs mt-1" style={{ color: 'rgba(245,234,216,0.4)' }}>📍 {ev.location}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── WISHES ── */}
            {activeTab === 'wishes' && (
              <Section>
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#f5ead8', fontSize: '1.4rem', fontStyle: 'italic' }}>
                      Well Wishes
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'rgba(245,234,216,0.4)' }}>
                      Leave a message for the happy couple
                    </p>
                  </div>

                  {/* Form */}
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}
                  >
                    <WishForm
                      coupleId={coupleId}
                      onAdded={w => setWishes(prev => [w, ...prev])}
                    />
                  </div>

                  {/* Existing wishes */}
                  {wishes.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
                        {wishes.length} {wishes.length === 1 ? 'wish' : 'wishes'}
                      </p>
                      {wishes.map(w => (
                        <div
                          key={w.id}
                          className="rounded-2xl p-4"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                              style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c' }}
                            >
                              {w.guest_name.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-sm font-semibold" style={{ color: '#f5ead8' }}>{w.guest_name}</p>
                            <p className="text-xs ml-auto" style={{ color: 'rgba(245,234,216,0.35)' }}>{timeAgo(w.created_at)}</p>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,234,216,0.7)', fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif" }}>
                            "{w.message}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {wishes.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-3xl mb-3">💌</p>
                      <p style={{ color: 'rgba(245,234,216,0.4)', fontStyle: 'italic' }}>Be the first to send your wishes!</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── MOMENTS ── */}
            {activeTab === 'moments' && (
              <Section>
                <div className="space-y-5">
                  <div className="text-center">
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#f5ead8', fontSize: '1.4rem', fontStyle: 'italic' }}>
                      Moments
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'rgba(245,234,216,0.4)' }}>
                      Photos & memories from the celebration
                    </p>
                  </div>

                  {moments.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-3">📸</p>
                      <p style={{ color: 'rgba(245,234,216,0.4)', fontStyle: 'italic' }}>
                        No moments shared yet
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(245,234,216,0.3)' }}>
                        Guests can share photos on the wedding day
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {moments.map(m => (
                        <div
                          key={m.id}
                          className="rounded-xl overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', aspectRatio: '1' }}
                        >
                          {m.media_url ? (
                            <img
                              src={m.media_url}
                              alt={m.caption ?? 'Wedding moment'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">📸</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8" style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
          <p className="text-[10px] tracking-[0.4em] uppercase" style={{ color: 'rgba(201,168,76,0.35)' }}>
            Created with uMshado
          </p>
          <a href="/" className="text-xs mt-1 block" style={{ color: 'rgba(201,168,76,0.4)', textDecoration: 'underline' }}>
            Plan your own wedding →
          </a>
        </div>
      </div>
    </>
  );
}
