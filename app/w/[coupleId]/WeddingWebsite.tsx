'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

// ─── Theme Definitions ────────────────────────────────────────────────────────

export const THEMES = {
  champagne: {
    name: 'Champagne Gold',
    emoji: '🥂',
    bg: '#0e0c07',
    bgMid: '#1a1508',
    accent: '#c9a84c',
    accentLight: 'rgba(201,168,76,0.12)',
    accentBorder: 'rgba(201,168,76,0.22)',
    text: '#f5ead8',
    textMid: 'rgba(245,234,216,0.68)',
    textFaint: 'rgba(245,234,216,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    btnPrimary: 'linear-gradient(135deg, #b8965a 0%, #d4af70 50%, #b8965a 100%)',
    btnText: '#1a1208',
    heroBg: 'linear-gradient(160deg, #0e0c07 0%, #1a1508 40%, #0e0c07 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=Lora:ital,wght@0,400;0,500;1,400',
    grain: 'rgba(201,168,76,0.03)',
  },
  rose: {
    name: 'Rose & Blush',
    emoji: '🌹',
    bg: '#1a0810',
    bgMid: '#2a1018',
    accent: '#e8849a',
    accentLight: 'rgba(232,132,154,0.12)',
    accentBorder: 'rgba(232,132,154,0.25)',
    text: '#fdf0f3',
    textMid: 'rgba(253,240,243,0.68)',
    textFaint: 'rgba(253,240,243,0.35)',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(232,132,154,0.12)',
    btnPrimary: 'linear-gradient(135deg, #c2607a 0%, #e8849a 50%, #c2607a 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #1a0810 0%, #2d1020 50%, #1a0810 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400',
    grain: 'rgba(232,132,154,0.03)',
  },
  sage: {
    name: 'Sage & Ivory',
    emoji: '🌿',
    bg: '#06100a',
    bgMid: '#0c1c12',
    accent: '#7eb89a',
    accentLight: 'rgba(126,184,154,0.12)',
    accentBorder: 'rgba(126,184,154,0.25)',
    text: '#f0f7f2',
    textMid: 'rgba(240,247,242,0.68)',
    textFaint: 'rgba(240,247,242,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(126,184,154,0.12)',
    btnPrimary: 'linear-gradient(135deg, #4a8a68 0%, #7eb89a 50%, #4a8a68 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #06100a 0%, #0f2016 50%, #06100a 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,700&family=Lora:ital,wght@0,400;1,400',
    grain: 'rgba(126,184,154,0.03)',
  },
  midnight: {
    name: 'Midnight Navy',
    emoji: '🌙',
    bg: '#040610',
    bgMid: '#080c1e',
    accent: '#7b9ef0',
    accentLight: 'rgba(123,158,240,0.12)',
    accentBorder: 'rgba(123,158,240,0.25)',
    text: '#eef2ff',
    textMid: 'rgba(238,242,255,0.68)',
    textFaint: 'rgba(238,242,255,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(123,158,240,0.12)',
    btnPrimary: 'linear-gradient(135deg, #4060d0 0%, #7b9ef0 50%, #4060d0 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #04060f 0%, #0a0e24 50%, #04060f 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
    grain: 'rgba(123,158,240,0.03)',
  },
  terracotta: {
    name: 'Terracotta & Sand',
    emoji: '🏺',
    bg: '#120806',
    bgMid: '#1e1008',
    accent: '#d4845a',
    accentLight: 'rgba(212,132,90,0.12)',
    accentBorder: 'rgba(212,132,90,0.25)',
    text: '#fdf3ec',
    textMid: 'rgba(253,243,236,0.68)',
    textFaint: 'rgba(253,243,236,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(212,132,90,0.12)',
    btnPrimary: 'linear-gradient(135deg, #b05c30 0%, #d4845a 50%, #b05c30 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #120806 0%, #22100a 50%, #120806 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,700&family=Lora:ital,wght@0,400;1,400',
    grain: 'rgba(212,132,90,0.03)',
  },
  ivory: {
    name: 'Pure Ivory',
    emoji: '🤍',
    bg: '#faf8f4',
    bgMid: '#f5f0e8',
    accent: '#8b6b3d',
    accentLight: 'rgba(139,107,61,0.08)',
    accentBorder: 'rgba(139,107,61,0.18)',
    text: '#2c1f0e',
    textMid: 'rgba(44,31,14,0.68)',
    textFaint: 'rgba(44,31,14,0.38)',
    card: 'rgba(0,0,0,0.03)',
    cardBorder: 'rgba(139,107,61,0.15)',
    btnPrimary: 'linear-gradient(135deg, #7a5c2a 0%, #b8965a 50%, #7a5c2a 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #faf8f4 0%, #f0ead8 50%, #faf8f4 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
    grain: 'rgba(139,107,61,0.02)',
  },
  blush: {
    name: 'Blush & White',
    emoji: '🌸',
    bg: '#fff8f9',
    bgMid: '#fff0f3',
    accent: '#d9607a',
    accentLight: 'rgba(217,96,122,0.08)',
    accentBorder: 'rgba(217,96,122,0.2)',
    text: '#3a1a22',
    textMid: 'rgba(58,26,34,0.65)',
    textFaint: 'rgba(58,26,34,0.35)',
    card: 'rgba(217,96,122,0.04)',
    cardBorder: 'rgba(217,96,122,0.14)',
    btnPrimary: 'linear-gradient(135deg, #b84060 0%, #d9607a 50%, #b84060 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #fff8f9 0%, #ffe4ec 50%, #fff8f9 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
    grain: 'rgba(217,96,122,0.02)',
  },
  garden: {
    name: 'Garden White',
    emoji: '🌿',
    bg: '#f8fbf8',
    bgMid: '#eff7ef',
    accent: '#3a7d52',
    accentLight: 'rgba(58,125,82,0.08)',
    accentBorder: 'rgba(58,125,82,0.2)',
    text: '#1a3325',
    textMid: 'rgba(26,51,37,0.65)',
    textFaint: 'rgba(26,51,37,0.38)',
    card: 'rgba(58,125,82,0.04)',
    cardBorder: 'rgba(58,125,82,0.12)',
    btnPrimary: 'linear-gradient(135deg, #2a6040 0%, #3a7d52 50%, #2a6040 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #f8fbf8 0%, #e6f5ec 50%, #f8fbf8 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,700&family=Lora:ital,wght@0,400;1,400',
    grain: 'rgba(58,125,82,0.02)',
  },
} as const;

export type ThemeKey = keyof typeof THEMES;

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
interface GiftItem {
  id: string;
  title: string;
  description: string;
  amount: number;
  emoji: string;
}

interface Props {
  coupleId: string;
  coupleName: string | null;
  partnerName: string | null;
  weddingDate: string | null;
  location: string | null;
  avatarUrl: string | null;
  weddingTheme: string;
  giftEnabled: boolean;
  giftMessage: string | null;
  giftItems: GiftItem[];
  schedule: ScheduleEvent[];
  wishes: WellWish[];
  moments: Moment[];
  // New story fields
  howWeMet: string | null;
  proposalStory: string | null;
  coupleMessage: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12h(t: string) {
  if (!t?.includes(':')) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
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

function formatAmount(n: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPrettyDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.getDate().toString().padStart(2, '0'),
    month: d.toLocaleDateString('en-ZA', { month: 'long' }),
    year: d.getFullYear().toString(),
    weekday: d.toLocaleDateString('en-ZA', { weekday: 'long' }),
    full: d.toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    short: d.toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  };
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(dateStr: string | null) {
  const [c, setC] = useState({ d: 0, h: 0, m: 0, s: 0, past: false });
  useEffect(() => {
    if (!dateStr) return;
    const tick = () => {
      const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
      if (diff <= 0) { setC(p => ({ ...p, past: true })); return; }
      setC({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        past: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dateStr]);
  return c;
}

// ─── Scroll fade ──────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.06 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.9s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.9s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>{children}</div>
  );
}

// ─── Ornamental divider ───────────────────────────────────────────────────────

function Ornament({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 0.75 : 1;
  return (
    <div className="flex items-center justify-center gap-3 my-2" style={{ transform: `scale(${s})` }}>
      <svg width="48" height="10" viewBox="0 0 48 10" fill="none">
        <path d="M0 5 Q12 2 24 5 Q36 8 48 5" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      </svg>
      <svg width="12" height="12" viewBox="0 0 12 12" fill={color} opacity="0.8">
        <path d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8Z"/>
      </svg>
      <svg width="48" height="10" viewBox="0 0 48 10" fill="none">
        <path d="M0 5 Q12 8 24 5 Q36 2 48 5" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      </svg>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle, t }: { title: string; subtitle?: string; t: any }) {
  return (
    <div className="text-center mb-10">
      <Ornament color={t.accent} size="sm" />
      <h2 style={{
        fontFamily: t.font,
        color: t.text,
        fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
        fontStyle: 'italic',
        fontWeight: 400,
        letterSpacing: '-0.01em',
        marginTop: '0.5rem',
      }}>{title}</h2>
      {subtitle && (
        <p className="mt-2 text-sm" style={{ color: t.textFaint, fontFamily: t.bodyFont, letterSpacing: '0.02em' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Wish form ────────────────────────────────────────────────────────────────

function WishForm({ coupleId, t, onAdded }: { coupleId: string; t: any; onAdded: (w: WellWish) => void }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { try { const n = localStorage.getItem('umshado_guest_name'); if (n) setName(n); } catch {} }, []);

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
        setTimeout(() => setDone(false), 3500);
      }
    } catch {}
    setSending(false);
  };

  if (done) return (
    <div className="text-center py-10">
      <div className="text-5xl mb-4">💌</div>
      <p style={{ fontFamily: t.font, color: t.accent, fontSize: '1.15rem', fontStyle: 'italic' }}>
        Your wish has been sent beautifully.
      </p>
      <p className="text-sm mt-3" style={{ color: t.textFaint }}>The couple will treasure it forever.</p>
    </div>
  );

  const inp: React.CSSProperties = { background: t.card, border: `1px solid ${t.accentBorder}`, color: t.text, fontFamily: t.bodyFont, borderRadius: '14px', width: '100%', padding: '14px 18px', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} />
      <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write a heartfelt message for the couple…" rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.7 }} />
      <button onClick={send} disabled={sending || !name.trim() || !msg.trim()}
        style={{ background: t.btnPrimary, color: t.btnText, fontFamily: t.bodyFont, borderRadius: '50px', padding: '14px', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.06em', border: 'none', cursor: 'pointer', opacity: (sending || !name.trim() || !msg.trim()) ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {sending ? 'Sending…' : 'Send Your Wishes ✦'}
      </button>
    </div>
  );
}

// ─── Gift card ────────────────────────────────────────────────────────────────

function GiftCard({ item, t }: { item: GiftItem; t: any }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: '24px', padding: '28px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{item.emoji}</div>
      <h4 style={{ fontFamily: t.font, color: t.text, fontSize: '1.15rem', marginBottom: '8px', fontStyle: 'italic' }}>{item.title}</h4>
      <p style={{ color: t.textMid, fontFamily: t.bodyFont, lineHeight: 1.75, fontSize: '0.9rem', marginBottom: '16px' }}>{item.description}</p>
      <p style={{ fontFamily: t.font, color: t.accent, fontSize: '1.4rem', fontWeight: 600, marginBottom: '16px' }}>{formatAmount(item.amount)}</p>
      <button style={{ background: t.btnPrimary, color: t.btnText, borderRadius: '50px', padding: '12px 24px', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', width: '100%', letterSpacing: '0.05em' }}>
        Contribute
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeddingWebsite({
  coupleId,
  coupleName,
  partnerName,
  weddingDate,
  location,
  avatarUrl,
  weddingTheme,
  giftEnabled,
  giftMessage,
  giftItems,
  schedule,
  wishes: initWishes,
  moments,
  howWeMet,
  proposalStory,
  coupleMessage,
}: Props) {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';

  const t = THEMES[weddingTheme as ThemeKey] ?? THEMES.champagne;
  const hasStoryContentInit = !!(howWeMet || proposalStory || coupleMessage);
  const [activeTab, setActiveTab] = useState<'story' | 'schedule' | 'wishes' | 'gifts' | 'gallery'>(
    hasStoryContentInit ? 'story' : 'wishes'
  );
  const [wishes, setWishes] = useState<WellWish[]>(initWishes);

  const prettyDate = formatPrettyDate(weddingDate);
  const countdown = useCountdown(weddingDate);

  const name1 = coupleName ?? 'The Happy';
  const name2 = partnerName ?? 'Couple';
  const coupleDisplay = `${name1} & ${name2}`;

  const hasStoryContent = howWeMet || proposalStory || coupleMessage;

  const tabs: { id: typeof activeTab; label: string }[] = [
    ...(hasStoryContent ? [{ id: 'story' as const, label: 'Our Story' }] : []),
    ...(schedule.length > 0 ? [{ id: 'schedule' as const, label: 'Schedule' }] : []),
    { id: 'wishes', label: `Wishes${wishes.length ? ` · ${wishes.length}` : ''}` },
    ...(giftEnabled ? [{ id: 'gifts' as const, label: 'Registry' }] : []),
    ...(moments.length > 0 ? [{ id: 'gallery' as const, label: 'Gallery' }] : []),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=${t.gfont}&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
        body { background: ${t.bg}; overflow-x: hidden; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }

        .hero-enter { animation: scaleIn 1.4s cubic-bezier(.22,1,.36,1) both; }
        .a1 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 0.15s both; }
        .a2 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 0.35s both; }
        .a3 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 0.55s both; }
        .a4 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 0.75s both; }
        .a5 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 0.95s both; }
        .a6 { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) 1.1s both; }

        .tab-rail::-webkit-scrollbar { display: none; }
        .tab-rail { -ms-overflow-style: none; scrollbar-width: none; }

        input::placeholder, textarea::placeholder { color: ${t.textFaint}; }
        input:focus, textarea:focus { border-color: ${t.accent} !important; box-shadow: 0 0 0 3px ${t.accentLight}; }

        .countdown-num {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }

        .btn-primary {
          background: ${t.btnPrimary};
          color: ${t.btnText};
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); }

        .tab-btn {
          transition: all 0.25s ease;
        }
        .tab-btn:hover { opacity: 1 !important; }

        .wish-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .wish-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 40px ${t.accentLight};
        }

        @media (max-width: 640px) {
          .hero-names { font-size: clamp(2.8rem, 14vw, 4.5rem) !important; }
        }
      `}</style>

      <div style={{ background: t.bg, minHeight: '100dvh', fontFamily: t.bodyFont, color: t.text }}>

        {/* Preview back banner */}
        {isPreview && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(154,33,67,0.95)', backdropFilter: 'blur(8px)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/couple/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              Back to dashboard
            </a>
            <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>Preview mode — this is how guests see your website</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════ */}
        <section className="hero-enter relative" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', paddingTop: isPreview ? '44px' : undefined }}>

          {/* Background layer */}
          {avatarUrl ? (
            <>
              <Image src={avatarUrl} alt="" fill style={{ objectFit: 'cover', objectPosition: 'center top', opacity: 0.25 }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${t.bg}60 0%, ${t.bg}90 45%, ${t.bg} 80%)` }} />
              {/* Vignette edges */}
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, transparent 40%, ${t.bg}80 100%)` }} />
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: t.heroBg }} />
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 30%, ${t.accentLight} 0%, transparent 100%)`, opacity: 0.8 }} />
            </>
          )}

          {/* Decorative corner flourishes */}
          <svg style={{ position: 'absolute', top: 24, left: 24, opacity: 0.18 }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke={t.accent} strokeWidth="1" fill="none"/>
            <path d="M8 8 L8 28 Q8 8 28 8 Z" stroke={t.accent} strokeWidth="0.5" fill="none" opacity="0.5"/>
          </svg>
          <svg style={{ position: 'absolute', top: 24, right: 24, opacity: 0.18, transform: 'scaleX(-1)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke={t.accent} strokeWidth="1" fill="none"/>
          </svg>
          <svg style={{ position: 'absolute', bottom: 24, left: 24, opacity: 0.18, transform: 'scaleY(-1)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke={t.accent} strokeWidth="1" fill="none"/>
          </svg>
          <svg style={{ position: 'absolute', bottom: 24, right: 24, opacity: 0.18, transform: 'scale(-1,-1)' }} width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M4 4 L4 36 Q4 4 36 4 Z" stroke={t.accent} strokeWidth="1" fill="none"/>
          </svg>

          {/* Content */}
          <div style={{ position: 'relative', textAlign: 'center', padding: '60px 24px', width: '100%', maxWidth: '600px', margin: '0 auto' }}>

            {/* Eyebrow */}
            <p className="a1" style={{ fontSize: '10px', letterSpacing: '0.5em', textTransform: 'uppercase', color: t.textFaint, marginBottom: '32px' }}>
              uMshado · Wedding Website
            </p>

            {/* Couple photo — circular, elegant */}
            {avatarUrl && (
              <div className="a2" style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                <div style={{
                  width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                  border: `1px solid ${t.accentBorder}`,
                  boxShadow: `0 0 0 6px ${t.accentLight}, 0 20px 60px rgba(0,0,0,0.4)`,
                  position: 'relative',
                }}>
                  <Image src={avatarUrl} alt="" fill style={{ objectFit: 'cover' }} />
                </div>
              </div>
            )}

            {/* Tagline */}
            <p className="a2" style={{ fontFamily: t.font, fontStyle: 'italic', color: t.accent, fontSize: '1.05rem', marginBottom: '20px', letterSpacing: '0.02em' }}>
              Together with their loved ones
            </p>

            {/* Couple names — the centrepiece */}
            <div className="a3">
              <h1 className="hero-names" style={{
                fontFamily: t.font,
                fontWeight: 400,
                color: t.text,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                fontSize: 'clamp(2.8rem, 12vw, 5.5rem)',
              }}>
                {name1}
              </h1>
              <div className="a3" style={{ margin: '12px 0' }}>
                <Ornament color={t.accent} />
              </div>
              <h1 className="hero-names" style={{
                fontFamily: t.font,
                fontWeight: 400,
                color: t.text,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                fontSize: 'clamp(2.8rem, 12vw, 5.5rem)',
              }}>
                {name2}
              </h1>
            </div>

            {/* Date + Location pill */}
            {prettyDate && (
              <div className="a4" style={{ marginTop: '36px', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  padding: '16px 32px', borderRadius: '100px',
                  background: `${t.bg}90`, backdropFilter: 'blur(20px)',
                  border: `1px solid ${t.accentBorder}`,
                }}>
                  <p style={{ fontFamily: t.font, color: t.accent, fontSize: '1rem', letterSpacing: '0.02em' }}>
                    {prettyDate.short}
                  </p>
                  {location && (
                    <p style={{ color: t.textMid, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                      ✦ {location}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Countdown */}
            {weddingDate && !countdown.past && (
              <div className="a5" style={{ marginTop: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '340px', margin: '0 auto' }}>
                  {[{ v: countdown.d, l: 'Days' }, { v: countdown.h, l: 'Hrs' }, { v: countdown.m, l: 'Min' }, { v: countdown.s, l: 'Sec' }].map(({ v, l }) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{
                        background: `${t.bg}80`, backdropFilter: 'blur(16px)',
                        border: `1px solid ${t.accentBorder}`,
                        borderRadius: '16px', padding: '14px 8px',
                      }}>
                        <p className="countdown-num" style={{
                          fontFamily: t.font, fontSize: '1.85rem', fontWeight: 700,
                          color: t.text, lineHeight: 1,
                        }}>
                          {String(v).padStart(2, '0')}
                        </p>
                      </div>
                      <p style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: t.textFaint, marginTop: '8px' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countdown.past && weddingDate && (
              <div className="a5" style={{ marginTop: '32px' }}>
                <p style={{ fontFamily: t.font, color: t.accent, fontStyle: 'italic', fontSize: '1.3rem' }}>🎉 We are married!</p>
              </div>
            )}

            {/* Explore CTA only — no Share for visitors */}
            <div className="a6" style={{ marginTop: '40px' }}>
              <a href="#content" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '14px 32px', borderRadius: '50px',
                background: t.btnPrimary, color: t.btnText,
                fontFamily: t.bodyFont, fontSize: '0.88rem', fontWeight: 600,
                letterSpacing: '0.08em', textDecoration: 'none',
                boxShadow: `0 16px 40px ${t.accentLight}`,
                textTransform: 'uppercase',
              }}>
                Explore Our Day
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </a>
            </div>

          </div>

          {/* Scroll hint */}
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', animation: 'pulse 2s ease infinite' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.textFaint} strokeWidth="1.5">
              <path d="M12 5v14M5 15l7 7 7-7"/>
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            STICKY TAB NAV
        ══════════════════════════════════════════════════ */}
        <nav id="content" className="tab-rail" style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: `${t.bg}f0`, backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${t.accentBorder}`,
          overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '10px 20px', minWidth: 'max-content', maxWidth: '700px', margin: '0 auto' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className="tab-btn"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '50px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  fontFamily: t.bodyFont,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  color: activeTab === tab.id ? t.btnText : t.textFaint,
                  background: activeTab === tab.id ? t.btnPrimary : 'transparent',
                  textTransform: 'uppercase',
                  opacity: activeTab === tab.id ? 1 : 0.8,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════
            TAB CONTENT
        ══════════════════════════════════════════════════ */}
        <main style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 20px 80px' }}>

          {/* ── OUR STORY ─────────────────────────────────── */}
          {activeTab === 'story' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Date / Venue cards */}
              <FadeIn>
                <div style={{ display: 'grid', gridTemplateColumns: location ? '1fr 1fr' : '1fr', gap: '16px' }}>
                  {prettyDate && (
                    <div style={{ background: t.accentLight, border: `1px solid ${t.accentBorder}`, borderRadius: '24px', padding: '28px', textAlign: 'center' }}>
                      <p style={{ fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', color: t.textFaint, marginBottom: '12px' }}>Wedding Date</p>
                      <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.3rem', lineHeight: 1.4, fontStyle: 'italic' }}>{prettyDate.weekday}</p>
                      <p style={{ fontFamily: t.font, color: t.accent, fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{prettyDate.day}</p>
                      <p style={{ color: t.textMid, fontSize: '0.9rem', marginTop: '4px' }}>{prettyDate.month} {prettyDate.year}</p>
                    </div>
                  )}
                  {location && (
                    <div style={{ background: t.accentLight, border: `1px solid ${t.accentBorder}`, borderRadius: '24px', padding: '28px', textAlign: 'center' }}>
                      <p style={{ fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', color: t.textFaint, marginBottom: '12px' }}>Venue</p>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📍</div>
                      <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.2rem', fontStyle: 'italic', lineHeight: 1.4 }}>{location}</p>
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Story sections */}
              {hasStoryContent ? (
                <>
                  {howWeMet && (
                    <FadeIn delay={80}>
                      <StoryBlock icon="💫" label="How We Met" text={howWeMet} t={t} />
                    </FadeIn>
                  )}
                  {proposalStory && (
                    <FadeIn delay={120}>
                      <StoryBlock icon="💍" label="The Proposal" text={proposalStory} t={t} />
                    </FadeIn>
                  )}
                  {coupleMessage && (
                    <FadeIn delay={160}>
                      <StoryBlock icon="✉️" label="A Note to Our Guests" text={coupleMessage} t={t} quote />
                    </FadeIn>
                  )}
                </>
              ) : (
                <FadeIn delay={80}>
                  <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: '28px', padding: '40px 32px', textAlign: 'center' }}>
                    <p style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📖</p>
                    <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.2rem', fontStyle: 'italic', marginBottom: '12px' }}>Our Story is Coming Soon</p>
                    <p style={{ color: t.textFaint, fontSize: '0.9rem', lineHeight: 1.8 }}>
                      The couple is still writing their love story here. Check back soon.
                    </p>
                  </div>
                </FadeIn>
              )}

              {/* Write a wish CTA */}
              <FadeIn delay={200}>
                <div style={{
                  background: t.card, border: `1px solid ${t.accentBorder}`, borderRadius: '28px',
                  padding: '36px', textAlign: 'center',
                  backgroundImage: `radial-gradient(ellipse at 50% 0%, ${t.accentLight} 0%, transparent 70%)`,
                }}>
                  <Ornament color={t.accent} size="sm" />
                  <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.3rem', fontStyle: 'italic', margin: '12px 0 8px' }}>
                    Leave a message for {name1} & {name2}
                  </p>
                  <p style={{ color: t.textFaint, fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.7 }}>
                    Share your blessings, prayers, and heartfelt wishes with the happy couple.
                  </p>
                  <button onClick={() => setActiveTab('wishes')} className="btn-primary" style={{
                    padding: '14px 36px', borderRadius: '50px', fontSize: '0.88rem',
                    fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: t.bodyFont,
                  }}>
                    Write a Wish ✦
                  </button>
                </div>
              </FadeIn>
            </div>
          )}

          {/* ── SCHEDULE ──────────────────────────────────── */}
          {activeTab === 'schedule' && (
            <FadeIn>
              <SectionHeading title="Wedding Day" subtitle={prettyDate?.full ?? 'A day to remember forever'} t={t} />

              {schedule.length === 0 ? (
                <EmptyState icon="📋" message="Schedule coming soon…" sub="The couple is still finalising the day's programme." t={t} />
              ) : (
                <div style={{ position: 'relative', maxWidth: '520px', margin: '0 auto' }}>
                  {/* Timeline line */}
                  <div style={{
                    position: 'absolute', left: '28px', top: '40px', bottom: '40px', width: '1px',
                    background: `linear-gradient(to bottom, transparent, ${t.accentBorder} 10%, ${t.accentBorder} 90%, transparent)`,
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '64px' }}>
                    {schedule.map((ev, i) => (
                      <FadeIn key={ev.id} delay={i * 60}>
                        <div style={{ position: 'relative' }}>
                          {/* Dot */}
                          <div style={{
                            position: 'absolute', left: '-44px', top: '20px',
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: t.accent, boxShadow: `0 0 0 4px ${t.accentLight}`,
                          }} />
                          <div style={{
                            background: t.card, border: `1px solid ${t.cardBorder}`,
                            borderRadius: '20px', padding: '20px 24px',
                          }}>
                            <p style={{ color: t.accent, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>{fmt12h(ev.time)}</p>
                            <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.1rem', fontStyle: 'italic' }}>{ev.title}</p>
                            {ev.location && <p style={{ color: t.textFaint, fontSize: '0.82rem', marginTop: '6px' }}>📍 {ev.location}</p>}
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}
            </FadeIn>
          )}

          {/* ── WISHES ────────────────────────────────────── */}
          {activeTab === 'wishes' && (
            <div>
              <FadeIn>
                <SectionHeading title="Wishes & Blessings" subtitle="Leave your heartfelt message for the couple" t={t} />
                <div style={{ background: t.accentLight, border: `1px solid ${t.accentBorder}`, borderRadius: '28px', padding: '32px', marginBottom: '32px' }}>
                  <WishForm coupleId={coupleId} t={t} onAdded={w => setWishes(p => [w, ...p])} />
                </div>
              </FadeIn>

              {wishes.length > 0 && (
                <>
                  <FadeIn delay={100}>
                    <p style={{ fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', color: t.textFaint, textAlign: 'center', marginBottom: '24px' }}>
                      {wishes.length} {wishes.length === 1 ? 'message' : 'messages'} of love
                    </p>
                  </FadeIn>
                  <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {wishes.map((w, i) => (
                      <FadeIn key={w.id} delay={i * 50}>
                        <div className="wish-card" style={{
                          background: t.card, border: `1px solid ${t.cardBorder}`,
                          borderRadius: '22px', padding: '22px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                              background: t.accentLight, border: `1px solid ${t.accentBorder}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: t.font, color: t.accent, fontSize: '1rem', fontWeight: 700,
                            }}>
                              {w.guest_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ color: t.text, fontSize: '0.9rem', fontWeight: 600 }}>{w.guest_name}</p>
                              <p style={{ color: t.textFaint, fontSize: '0.75rem', marginTop: '2px' }}>{timeAgo(w.created_at)}</p>
                            </div>
                          </div>
                          <p style={{ color: t.textMid, fontStyle: 'italic', fontFamily: t.bodyFont, lineHeight: 1.75, fontSize: '0.92rem' }}>
                            "{w.message}"
                          </p>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </>
              )}

              {wishes.length === 0 && (
                <FadeIn delay={100}>
                  <EmptyState icon="💌" message="Be the first to leave a wish" sub="Your message will mean the world to the couple." t={t} />
                </FadeIn>
              )}
            </div>
          )}

          {/* ── GIFTS ─────────────────────────────────────── */}
          {activeTab === 'gifts' && giftEnabled && (
            <FadeIn>
              <SectionHeading
                title="Gift Registry"
                subtitle={giftMessage || 'Your love and presence are the greatest gift. Should you wish to bless us further, we are grateful.'}
                t={t}
              />
              {giftItems.length === 0 ? (
                <EmptyState icon="🎁" message="Registry coming soon" sub="The couple is still adding their gift registry." t={t} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                  {giftItems.map(item => <GiftCard key={item.id} item={item} t={t} />)}
                </div>
              )}
            </FadeIn>
          )}

          {/* ── GALLERY ───────────────────────────────────── */}
          {activeTab === 'gallery' && (
            <FadeIn>
              <SectionHeading title="Gallery" subtitle="Memories captured and shared" t={t} />
              {moments.length === 0 ? (
                <EmptyState icon="📷" message="Gallery coming soon" sub="Guests can share beautiful memories from the celebration here." t={t} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {moments.map((m, i) => (
                    <FadeIn key={m.id} delay={i * 40}>
                      <div style={{ aspectRatio: '1', borderRadius: '18px', overflow: 'hidden', background: t.card, border: `1px solid ${t.cardBorder}`, position: 'relative' }}>
                        {m.media_url ? (
                          <Image src={m.media_url} alt={m.caption ?? ''} fill style={{ objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📸</div>
                        )}
                      </div>
                    </FadeIn>
                  ))}
                </div>
              )}
            </FadeIn>
          )}

        </main>

        {/* ══════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════ */}
        <footer style={{ borderTop: `1px solid ${t.accentBorder}`, textAlign: 'center', padding: '48px 24px' }}>
          <Ornament color={t.accent} size="sm" />
          <p style={{ fontFamily: t.font, color: t.textFaint, fontStyle: 'italic', fontSize: '1rem', margin: '16px 0 8px' }}>
            {coupleDisplay}
          </p>
          {prettyDate && (
            <p style={{ color: t.textFaint, fontSize: '0.82rem', letterSpacing: '0.08em' }}>{prettyDate.short}</p>
          )}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${t.cardBorder}` }}>
            <p style={{ fontSize: '9px', letterSpacing: '0.4em', textTransform: 'uppercase', color: t.textFaint, marginBottom: '10px' }}>Created with</p>
            <a href="/" style={{ color: t.accent, fontSize: '0.85rem', fontFamily: t.font, fontStyle: 'italic', textDecoration: 'none' }}>
              uMshado Wedding Platform
            </a>
            <p style={{ color: t.textFaint, fontSize: '0.8rem', marginTop: '6px', opacity: 0.6 }}>
              Beautiful wedding websites for modern couples
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}

// ─── Story block ──────────────────────────────────────────────────────────────

function StoryBlock({ icon, label, text, t, quote = false }: { icon: string; label: string; text: string; t: any; quote?: boolean }) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: '28px',
      padding: '36px 32px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle accent glow top-left */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '200px', background: `radial-gradient(circle, ${t.accentLight} 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '1.3rem' }}>{icon}</span>
          <p style={{ fontSize: '10px', letterSpacing: '0.4em', textTransform: 'uppercase', color: t.accent, fontWeight: 600 }}>{label}</p>
        </div>
        {quote ? (
          <blockquote style={{
            fontFamily: t.font, fontStyle: 'italic', color: t.textMid,
            fontSize: 'clamp(1rem, 3vw, 1.15rem)', lineHeight: 1.9,
            paddingLeft: '20px', borderLeft: `2px solid ${t.accentBorder}`,
          }}>
            {text}
          </blockquote>
        ) : (
          <p style={{ color: t.textMid, lineHeight: 1.9, fontSize: '0.97rem', fontFamily: t.bodyFont }}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub, t }: { icon: string; message: string; sub: string; t: any }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: '28px', padding: '60px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: '3rem', marginBottom: '16px' }}>{icon}</p>
      <p style={{ fontFamily: t.font, color: t.text, fontSize: '1.1rem', fontStyle: 'italic', marginBottom: '8px' }}>{message}</p>
      <p style={{ color: t.textFaint, fontSize: '0.88rem', lineHeight: 1.7 }}>{sub}</p>
    </div>
  );
}
