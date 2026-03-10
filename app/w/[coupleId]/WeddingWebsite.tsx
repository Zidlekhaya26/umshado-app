'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Theme Definitions ────────────────────────────────────────────────────────

export const THEMES = {
  champagne: {
    name: 'Champagne Gold',
    emoji: '🥂',
    bg: '#0e0c07',
    bgMid: '#1a1508',
    accent: '#c9a84c',
    accentLight: 'rgba(201,168,76,0.15)',
    accentBorder: 'rgba(201,168,76,0.25)',
    text: '#f5ead8',
    textMid: 'rgba(245,234,216,0.65)',
    textFaint: 'rgba(245,234,216,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    btnPrimary: 'linear-gradient(135deg, #b8965a 0%, #d4af70 50%, #b8965a 100%)',
    btnText: '#1a1208',
    heroBg: 'linear-gradient(160deg, #0e0c07 0%, #1a1508 40%, #0e0c07 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,500;1,400',
  },
  rose: {
    name: 'Rose & Blush',
    emoji: '🌹',
    bg: '#1a0810',
    bgMid: '#2a1018',
    accent: '#e8849a',
    accentLight: 'rgba(232,132,154,0.15)',
    accentBorder: 'rgba(232,132,154,0.28)',
    text: '#fdf0f3',
    textMid: 'rgba(253,240,243,0.65)',
    textFaint: 'rgba(253,240,243,0.35)',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(232,132,154,0.12)',
    btnPrimary: 'linear-gradient(135deg, #c2607a 0%, #e8849a 50%, #c2607a 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #1a0810 0%, #2d1020 50%, #1a0810 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
  },
  sage: {
    name: 'Sage & Ivory',
    emoji: '🌿',
    bg: '#06100a',
    bgMid: '#0c1c12',
    accent: '#7eb89a',
    accentLight: 'rgba(126,184,154,0.15)',
    accentBorder: 'rgba(126,184,154,0.28)',
    text: '#f0f7f2',
    textMid: 'rgba(240,247,242,0.65)',
    textFaint: 'rgba(240,247,242,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(126,184,154,0.12)',
    btnPrimary: 'linear-gradient(135deg, #4a8a68 0%, #7eb89a 50%, #4a8a68 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #06100a 0%, #0f2016 50%, #06100a 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;1,400',
  },
  midnight: {
    name: 'Midnight Navy',
    emoji: '🌙',
    bg: '#040610',
    bgMid: '#080c1e',
    accent: '#7b9ef0',
    accentLight: 'rgba(123,158,240,0.15)',
    accentBorder: 'rgba(123,158,240,0.28)',
    text: '#eef2ff',
    textMid: 'rgba(238,242,255,0.65)',
    textFaint: 'rgba(238,242,255,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(123,158,240,0.12)',
    btnPrimary: 'linear-gradient(135deg, #4060d0 0%, #7b9ef0 50%, #4060d0 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #04060f 0%, #0a0e24 50%, #04060f 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
  },
  terracotta: {
    name: 'Terracotta & Sand',
    emoji: '🏺',
    bg: '#120806',
    bgMid: '#1e1008',
    accent: '#d4845a',
    accentLight: 'rgba(212,132,90,0.15)',
    accentBorder: 'rgba(212,132,90,0.28)',
    text: '#fdf3ec',
    textMid: 'rgba(253,243,236,0.65)',
    textFaint: 'rgba(253,243,236,0.35)',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(212,132,90,0.12)',
    btnPrimary: 'linear-gradient(135deg, #b05c30 0%, #d4845a 50%, #b05c30 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #120806 0%, #22100a 50%, #120806 100%)',
    font: "'Playfair Display', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    gfont: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;1,400',
  },
  ivory: {
    name: 'Pure Ivory',
    emoji: '🤍',
    bg: '#faf8f4',
    bgMid: '#f5f0e8',
    accent: '#8b6b3d',
    accentLight: 'rgba(139,107,61,0.1)',
    accentBorder: 'rgba(139,107,61,0.2)',
    text: '#2c1f0e',
    textMid: 'rgba(44,31,14,0.65)',
    textFaint: 'rgba(44,31,14,0.38)',
    card: 'rgba(0,0,0,0.03)',
    cardBorder: 'rgba(139,107,61,0.15)',
    btnPrimary: 'linear-gradient(135deg, #7a5c2a 0%, #b8965a 50%, #7a5c2a 100%)',
    btnText: '#fff',
    heroBg: 'linear-gradient(160deg, #faf8f4 0%, #f0ead8 50%, #faf8f4 100%)',
    font: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'EB Garamond', Georgia, serif",
    gfont: 'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=EB+Garamond:ital,wght@0,400;1,400',
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
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(dateStr: string | null) {
  const [c, setC] = useState({ d: 0, h: 0, m: 0, s: 0, past: false });

  useEffect(() => {
    if (!dateStr) return;
    const tick = () => {
      const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
      if (diff <= 0) {
        setC((prev) => ({ ...prev, past: true }));
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setC({ d, h, m, s, past: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dateStr]);

  return c;
}

// ─── Fade In ──────────────────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVis(true);
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Ornamental Accent ────────────────────────────────────────────────────────

function FloralAccent({
  color,
  side = 'left',
}: {
  color: string;
  side?: 'left' | 'right';
}) {
  return (
    <svg
      className={`absolute top-0 ${side === 'left' ? 'left-0' : 'right-0'}`}
      width="90"
      height="90"
      viewBox="0 0 90 90"
      style={{
        opacity: 0.2,
        transform: side === 'right' ? 'scaleX(-1)' : undefined,
      }}
    >
      <path d="M14 50 Q 24 32, 40 42 T 66 44" stroke={color} strokeWidth="0.7" fill="none" />
      <circle cx="20" cy="40" r="3" fill={color} opacity="0.4" />
      <circle cx="40" cy="42" r="4.5" fill={color} opacity="0.25" />
      <circle cx="58" cy="35" r="2.5" fill={color} opacity="0.55" />
      <path d="M28 58 Q 38 44, 56 56" stroke={color} strokeWidth="0.5" fill="none" />
    </svg>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function SectionHeading({
  title,
  subtitle,
  t,
}: {
  title: string;
  subtitle?: string;
  t: any;
}) {
  return (
    <div className="text-center mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: t.accentBorder }} />
        <span style={{ color: t.accent, fontSize: '1rem' }}>✦</span>
        <div className="flex-1 h-px" style={{ background: t.accentBorder }} />
      </div>
      <h2
        style={{
          fontFamily: t.font,
          color: t.text,
          fontSize: 'clamp(1.5rem, 5vw, 2rem)',
          fontStyle: 'italic',
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mt-2" style={{ color: t.textFaint }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Wish Form ────────────────────────────────────────────────────────────────

function WishForm({
  coupleId,
  t,
  onAdded,
}: {
  coupleId: string;
  t: any;
  onAdded: (w: WellWish) => void;
}) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const n = localStorage.getItem('umshado_guest_name');
      if (n) setName(n);
    } catch {}
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
        try {
          localStorage.setItem('umshado_guest_name', name.trim());
        } catch {}
        onAdded(
          j.wish ?? {
            id: Date.now().toString(),
            guest_name: name.trim(),
            message: msg.trim(),
            created_at: new Date().toISOString(),
          }
        );
        setMsg('');
        setDone(true);
        setTimeout(() => setDone(false), 3500);
      }
    } catch {}
    setSending(false);
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">💌</div>
        <p
          style={{
            fontFamily: t.font,
            color: t.accent,
            fontSize: '1.1rem',
            fontStyle: 'italic',
          }}
        >
          Your wish has been sent beautifully.
        </p>
        <p className="text-sm mt-2" style={{ color: t.textFaint }}>
          The couple will treasure it forever.
        </p>
      </div>
    );
  }

  const inputStyle = {
    background: t.card,
    border: `1px solid ${t.accentBorder}`,
    color: t.text,
    fontFamily: t.bodyFont,
  } as React.CSSProperties;

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
        style={inputStyle}
      />
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Write a heartfelt message for the couple…"
        rows={4}
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none transition-all"
        style={inputStyle}
      />
      <button
        onClick={send}
        disabled={sending || !name.trim() || !msg.trim()}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40"
        style={{
          background: t.btnPrimary,
          color: t.btnText,
          fontFamily: t.bodyFont,
          letterSpacing: '0.04em',
        }}
      >
        {sending ? 'Sending…' : 'Send Your Wishes'}
      </button>
    </div>
  );
}

// ─── Gift Card ────────────────────────────────────────────────────────────────

function GiftCard({ item, t }: { item: GiftItem; t: any }) {
  return (
    <div
      className="rounded-3xl p-5 relative overflow-hidden"
      style={{
        background: t.card,
        border: `1px solid ${t.cardBorder}`,
        boxShadow: `0 10px 30px ${t.accentLight}`,
      }}
    >
      <FloralAccent color={t.accent} side="right" />
      <div className="relative">
        <div className="text-4xl mb-4">{item.emoji}</div>
        <h4
          style={{
            fontFamily: t.font,
            color: t.text,
            fontSize: '1.15rem',
            marginBottom: '0.5rem',
          }}
        >
          {item.title}
        </h4>
        <p
          className="text-sm mb-4"
          style={{
            color: t.textMid,
            fontFamily: t.bodyFont,
            lineHeight: 1.7,
          }}
        >
          {item.description}
        </p>
        <p
          style={{
            fontFamily: t.font,
            color: t.accent,
            fontSize: '1.35rem',
            fontWeight: 700,
          }}
        >
          {formatAmount(item.amount)}
        </p>
        <button
          className="mt-5 w-full py-3 rounded-2xl text-sm font-semibold transition-all"
          style={{ background: t.btnPrimary, color: t.btnText }}
        >
          Contribute
        </button>
      </div>
    </div>
  );
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────

function ShareSheet({
  url,
  coupleName,
  t,
  onClose,
}: {
  url: string;
  coupleName: string;
  t: any;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const msg = `View ${coupleName}'s wedding website 💍\n${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const smsUrl = `sms:?body=${encodeURIComponent(msg)}`;
  const emailUrl = `mailto:

?subject=${encodeURIComponent(`${coupleName}'s Wedding`)}&body=${encodeURIComponent(msg)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] p-6 space-y-4"
        style={{
          background: t.bgMid,
          border: `1px solid ${t.accentBorder}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 style={{ fontFamily: t.font, color: t.text, fontSize: '1.2rem' }}>
            Share Website
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: t.card }}
          >
            <svg className="w-4 h-4" style={{ color: t.text }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2">
          <div
            className="flex-1 px-3 py-3 rounded-2xl text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ background: t.card, color: t.textMid }}
          >
            {url}
          </div>
          <button
            onClick={copy}
            className="px-4 py-3 rounded-2xl text-xs font-bold transition-all"
            style={{
              background: copied ? '#10b981' : t.accentLight,
              color: copied ? '#fff' : t.accent,
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener"
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all"
            style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
          >
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-lg">
              💬
            </div>
            <span className="text-xs font-semibold" style={{ color: t.text }}>
              WhatsApp
            </span>
          </a>

          <a
            href={smsUrl}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all"
            style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: t.accentLight, color: t.accent }}
            >
              💌
            </div>
            <span className="text-xs font-semibold" style={{ color: t.text }}>
              SMS
            </span>
          </a>

          <a
            href={emailUrl}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all"
            style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: t.accentLight, color: t.accent }}
            >
              ✉️
            </div>
            <span className="text-xs font-semibold" style={{ color: t.text }}>
              Email
            </span>
          </a>
        </div>
      </div>
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
}: Props) {
  const t = THEMES[weddingTheme as ThemeKey] ?? THEMES.champagne;
  const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'wishes' | 'gifts' | 'moments'>('info');
  const [wishes, setWishes] = useState<WellWish[]>(initWishes);
  const [showShare, setShowShare] = useState(false);

  const prettyDate = formatPrettyDate(weddingDate);
  const countdown = useCountdown(weddingDate);

  const couple = coupleName && partnerName
    ? { name1: coupleName, name2: partnerName }
    : coupleName
    ? { name1: coupleName, name2: null }
    : { name1: 'The Happy', name2: 'Couple' };

  const coupleDisplay = couple.name2 ? `${couple.name1} & ${couple.name2}` : couple.name1;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const tabs = [
    { id: 'info' as const, label: 'Story' },
    { id: 'schedule' as const, label: 'Schedule' },
    { id: 'wishes' as const, label: `Wishes${wishes.length ? ` (${wishes.length})` : ''}` },
    ...(giftEnabled ? [{ id: 'gifts' as const, label: 'Registry' }] : []),
    { id: 'moments' as const, label: 'Gallery' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?${t.gfont}&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${t.bg}; }

        @keyframes heroFade {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes rise {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hero-bg { animation: heroFade 1.25s ease both; }
        .hero-line-1 { animation: rise 0.7s ease 0.2s both; }
        .hero-line-2 { animation: rise 0.7s ease 0.45s both; }
        .hero-line-3 { animation: rise 0.7s ease 0.7s both; }
        .hero-line-4 { animation: rise 0.7s ease 0.95s both; }
        .hero-line-5 { animation: rise 0.7s ease 1.15s both; }

        .tab-scroll::-webkit-scrollbar { display: none; }
        .tab-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        input::placeholder,
        textarea::placeholder {
          color: ${t.textFaint};
        }

        input:focus,
        textarea:focus {
          border-color: ${t.accent} !important;
        }

        .glass {
          background: ${t.card};
          border: 1px solid ${t.cardBorder};
          backdrop-filter: blur(10px);
        }
      `}</style>

      <div style={{ background: t.bg, minHeight: '100vh', fontFamily: t.bodyFont }}>

        {/* ── HERO ───────────────────────────────────────── */}
        <section
          className="hero-bg relative overflow-hidden"
          style={{
            minHeight: '100svh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {avatarUrl ? (
            <>
              <img
                src={avatarUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.3 }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, ${t.bg}20 0%, ${t.bg}bb 55%, ${t.bg} 100%)`,
                }}
              />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: t.heroBg }} />
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(circle at 20% 20%, ${t.accentLight} 0%, transparent 25%),
                    radial-gradient(circle at 80% 30%, ${t.accentLight} 0%, transparent 25%),
                    radial-gradient(circle at 50% 80%, ${t.accentLight} 0%, transparent 30%)
                  `,
                  opacity: 0.7,
                }}
              />
            </>
          )}

          <div className="relative px-6 py-14 max-w-4xl mx-auto w-full text-center">
            <p
              className="hero-line-1 text-[10px] tracking-[0.45em] uppercase mb-6"
              style={{ color: t.textFaint }}
            >
              uMshado Wedding Website
            </p>

            {avatarUrl && (
              <div className="hero-line-2 mb-6 flex justify-center">
                <div
                  className="rounded-full overflow-hidden"
                  style={{
                    width: 112,
                    height: 112,
                    border: `2px solid ${t.accentBorder}`,
                    boxShadow: `0 0 0 8px ${t.accentLight}`,
                  }}
                >
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            <div className="hero-line-2">
              <p
                style={{
                  color: t.accent,
                  fontFamily: t.font,
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  marginBottom: '0.6rem',
                }}
              >
                Together with their loved ones
              </p>

              <h1
                style={{
                  fontFamily: t.font,
                  fontSize: 'clamp(2.5rem, 9vw, 4.5rem)',
                  fontWeight: 400,
                  color: t.text,
                  lineHeight: 1.04,
                  letterSpacing: '-0.03em',
                }}
              >
                {couple.name1}
                {couple.name2 && (
                  <>
                    <br />
                    <span
                      style={{
                        color: t.accent,
                        fontSize: '0.46em',
                        letterSpacing: '0.28em',
                        fontStyle: 'normal',
                        fontWeight: 400,
                      }}
                    >
                      &amp;
                    </span>
                    <br />
                    {couple.name2}
                  </>
                )}
              </h1>
            </div>

            <div className="hero-line-3 mt-6 max-w-xl mx-auto">
              <p
                style={{
                  color: t.textMid,
                  fontSize: '1rem',
                  lineHeight: 1.75,
                }}
              >
                Welcome to our wedding website — a place to celebrate our journey,
                view our special day details, send love, and share in the joy of what's ahead.
              </p>
            </div>

            {prettyDate && (
              <div className="hero-line-4 mt-8">
                <div
                  className="inline-flex flex-col items-center gap-2 px-5 py-4 rounded-[24px]"
                  style={{
                    background: t.card,
                    border: `1px solid ${t.cardBorder}`,
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <p style={{ color: t.accent, fontFamily: t.font, fontSize: '1.15rem' }}>
                    {prettyDate.full}
                  </p>
                  {location && (
                    <p className="text-sm" style={{ color: t.textMid }}>
                      📍 {location}
                    </p>
                  )}
                </div>
              </div>
            )}

            {weddingDate && !countdown.past && (
              <div className="hero-line-5 mt-8">
                <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
                  {[
                    { v: countdown.d, l: 'Days' },
                    { v: countdown.h, l: 'Hours' },
                    { v: countdown.m, l: 'Minutes' },
                    { v: countdown.s, l: 'Seconds' },
                  ].map(({ v, l }) => (
                    <div key={l} className="text-center">
                      <div
                        className="rounded-2xl py-3 px-2"
                        style={{
                          background: t.card,
                          border: `1px solid ${t.cardBorder}`,
                        }}
                      >
                        <p
                          style={{
                            fontFamily: t.font,
                            fontSize: '1.7rem',
                            fontWeight: 700,
                            color: t.text,
                            lineHeight: 1,
                          }}
                        >
                          {String(v).padStart(2, '0')}
                        </p>
                      </div>
                      <p
                        className="text-[10px] mt-2 tracking-[0.18em] uppercase"
                        style={{ color: t.textFaint }}
                      >
                        {l}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {countdown.past && weddingDate && (
              <div className="hero-line-5 mt-8">
                <p
                  style={{
                    color: t.accent,
                    fontFamily: t.font,
                    fontStyle: 'italic',
                    fontSize: '1.25rem',
                  }}
                >
                  🎉 We are married!
                </p>
              </div>
            )}

            <div className="hero-line-5 mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowShare(true)}
                className="px-6 py-3 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: t.btnPrimary,
                  color: t.btnText,
                  boxShadow: `0 12px 30px ${t.accentLight}`,
                }}
              >
                Share Website
              </button>

              <a
                href="#content"
                className="px-6 py-3 rounded-full text-sm transition-all"
                style={{
                  background: t.card,
                  color: t.textMid,
                  border: `1px solid ${t.cardBorder}`,
                }}
              >
                Explore Details
              </a>
            </div>
          </div>
        </section>

        {/* ── STICKY NAV ─────────────────────────────────── */}
        <div
          className="sticky top-0 z-20 tab-scroll overflow-x-auto"
          style={{
            background: `${t.bg}f5`,
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${t.accentBorder}`,
          }}
        >
          <div className="flex min-w-max px-4 py-2 max-w-5xl mx-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-xs font-semibold transition-all whitespace-nowrap rounded-full"
                style={{
                  color: activeTab === tab.id ? t.btnText : t.textFaint,
                  background: activeTab === tab.id ? t.btnPrimary : 'transparent',
                  letterSpacing: '0.06em',
                  fontFamily: t.bodyFont,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ────────────────────────────────────── */}
        <main id="content" className="px-5 py-10 max-w-5xl mx-auto pb-24 space-y-8">

          {/* STORY / ABOUT */}
          {activeTab === 'info' && (
            <FadeIn>
              <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
                <div
                  className="rounded-[28px] p-6 md:p-8 relative overflow-hidden"
                  style={{
                    background: t.card,
                    border: `1px solid ${t.cardBorder}`,
                  }}
                >
                  <FloralAccent color={t.accent} side="left" />
                  <SectionHeading
                    title="Our Story"
                    subtitle="A glimpse into our special day and the love we are celebrating."
                    t={t}
                  />
                  <div className="relative">
                    <p
                      style={{
                        color: t.textMid,
                        lineHeight: 1.9,
                        fontSize: '0.98rem',
                      }}
                    >
                      We are so grateful to share this beautiful season of our lives with you.
                      This website is our little corner to keep our loved ones informed,
                      connected, and part of the joy as we prepare to say "I do."
                    </p>

                    <p
                      className="mt-5"
                      style={{
                        color: t.textMid,
                        lineHeight: 1.9,
                        fontSize: '0.98rem',
                      }}
                    >
                      Here you'll find our wedding details, schedule, registry, photo moments,
                      and a space to leave your wishes. Thank you for being part of our love story.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {prettyDate && (
                    <div
                      className="rounded-[28px] p-5"
                      style={{
                        background: t.accentLight,
                        border: `1px solid ${t.accentBorder}`,
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.22em] mb-2"
                        style={{ color: t.textFaint }}
                      >
                        Wedding Date
                      </p>
                      <p
                        style={{
                          color: t.text,
                          fontFamily: t.font,
                          fontSize: '1.25rem',
                          lineHeight: 1.4,
                        }}
                      >
                        {prettyDate.full}
                      </p>
                    </div>
                  )}

                  {location && (
                    <div
                      className="rounded-[28px] p-5"
                      style={{
                        background: t.accentLight,
                        border: `1px solid ${t.accentBorder}`,
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.22em] mb-2"
                        style={{ color: t.textFaint }}
                      >
                        Venue
                      </p>
                      <p
                        style={{
                          color: t.text,
                          fontFamily: t.font,
                          fontSize: '1.25rem',
                          lineHeight: 1.4,
                        }}
                      >
                        {location}
                      </p>
                    </div>
                  )}

                  <div
                    className="rounded-[28px] p-5 text-center"
                    style={{
                      background: t.card,
                      border: `1px solid ${t.cardBorder}`,
                    }}
                  >
                    <p className="text-3xl mb-3">💌</p>
                    <p
                      style={{
                        fontFamily: t.font,
                        color: t.text,
                        fontSize: '1.15rem',
                        fontStyle: 'italic',
                      }}
                    >
                      Leave the couple a message
                    </p>
                    <p className="text-sm mt-2 mb-4" style={{ color: t.textMid }}>
                      Share your blessings, prayers, and beautiful wishes.
                    </p>
                    <button
                      onClick={() => setActiveTab('wishes')}
                      className="px-5 py-3 rounded-full text-sm font-semibold"
                      style={{ background: t.btnPrimary, color: t.btnText }}
                    >
                      Write a Wish
                    </button>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* SCHEDULE */}
          {activeTab === 'schedule' && (
            <FadeIn>
              <SectionHeading
                title="Wedding Day Schedule"
                subtitle={prettyDate ? prettyDate.full : 'The day we celebrate forever'}
                t={t}
              />

              {schedule.length === 0 ? (
                <div
                  className="rounded-[28px] p-10 text-center"
                  style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
                >
                  <p className="text-4xl mb-3">📋</p>
                  <p style={{ color: t.textFaint, fontStyle: 'italic' }}>
                    Schedule coming soon…
                  </p>
                </div>
              ) : (
                <div className="relative max-w-3xl mx-auto">
                  <div
                    className="absolute left-[18px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px"
                    style={{ background: t.accentBorder }}
                  />
                  <div className="space-y-6">
                    {schedule.map((ev, i) => (
                      <div
                        key={ev.id}
                        className={`grid md:grid-cols-2 gap-4 items-start ${
                          i % 2 === 0 ? '' : 'md:[&>div:first-child]:order-2'
                        }`}
                      >
                        <div className={i % 2 === 0 ? 'md:text-right md:pr-10' : 'md:pl-10'}>
                          <div
                            className="rounded-[24px] p-5 inline-block w-full md:w-auto"
                            style={{
                              background: t.card,
                              border: `1px solid ${t.cardBorder}`,
                            }}
                          >
                            <p className="text-xs mb-1" style={{ color: t.accent }}>
                              {fmt12h(ev.time)}
                            </p>
                            <p
                              style={{
                                color: t.text,
                                fontFamily: t.font,
                                fontSize: '1.05rem',
                              }}
                            >
                              {ev.title}
                            </p>
                            {ev.location && (
                              <p className="text-xs mt-2" style={{ color: t.textFaint }}>
                                📍 {ev.location}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="hidden md:block" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </FadeIn>
          )}

          {/* WISHES */}
          {activeTab === 'wishes' && (
            <FadeIn>
              <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6">
                <div
                  className="rounded-[28px] p-6"
                  style={{
                    background: t.accentLight,
                    border: `1px solid ${t.accentBorder}`,
                  }}
                >
                  <SectionHeading
                    title="Send Your Wishes"
                    subtitle="Leave a beautiful message for the happy couple."
                    t={t}
                  />
                  <WishForm
                    coupleId={coupleId}
                    t={t}
                    onAdded={(w) => setWishes((prev) => [w, ...prev])}
                  />
                </div>

                <div className="space-y-4">
                  <SectionHeading
                    title="Messages of Love"
                    subtitle={`${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'} received`}
                    t={t}
                  />

                  {wishes.length === 0 ? (
                    <div
                      className="rounded-[28px] p-10 text-center"
                      style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
                    >
                      <p className="text-4xl mb-3">💌</p>
                      <p style={{ color: t.textFaint, fontStyle: 'italic' }}>
                        Be the first to send your wishes.
                      </p>
                    </div>
                  ) : (
                    wishes.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-[24px] p-5"
                        style={{
                          background: t.card,
                          border: `1px solid ${t.cardBorder}`,
                        }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ background: t.accentLight, color: t.accent }}
                          >
                            {w.guest_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: t.text }}>
                              {w.guest_name}
                            </p>
                            <p className="text-xs" style={{ color: t.textFaint }}>
                              {timeAgo(w.created_at)}
                            </p>
                          </div>
                        </div>
                        <p
                          className="text-sm leading-relaxed"
                          style={{
                            color: t.textMid,
                            fontStyle: 'italic',
                            fontFamily: t.bodyFont,
                          }}
                        >
                          "{w.message}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </FadeIn>
          )}

          {/* GIFTS */}
          {activeTab === 'gifts' && giftEnabled && (
            <FadeIn>
              <SectionHeading
                title="Gift Registry"
                subtitle={
                  giftMessage ||
                  'Your love and support mean the world — should you wish to bless us, you may do so here.'
                }
                t={t}
              />

              {giftItems.length === 0 ? (
                <div
                  className="rounded-[28px] p-10 text-center"
                  style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
                >
                  <p className="text-4xl mb-3">🎁</p>
                  <p style={{ color: t.textFaint, fontStyle: 'italic' }}>
                    No gift items added yet.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {giftItems.map((item) => (
                    <GiftCard key={item.id} item={item} t={t} />
                  ))}
                </div>
              )}
            </FadeIn>
          )}

          {/* MOMENTS */}
          {activeTab === 'moments' && (
            <FadeIn>
              <SectionHeading
                title="Moments"
                subtitle="A collection of shared memories from this beautiful celebration."
                t={t}
              />

              {moments.length === 0 ? (
                <div
                  className="rounded-[28px] p-10 text-center"
                  style={{ background: t.card, border: `1px solid ${t.cardBorder}` }}
                >
                  <p className="text-4xl mb-3">📸</p>
                  <p style={{ color: t.textFaint, fontStyle: 'italic' }}>
                    No moments shared yet.
                  </p>
                  <p className="text-xs mt-2" style={{ color: t.textFaint }}>
                    Guests can upload beautiful memories from the day.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {moments.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-[22px] overflow-hidden"
                      style={{
                        background: t.card,
                        border: `1px solid ${t.cardBorder}`,
                        aspectRatio: '1',
                      }}
                    >
                      {m.media_url ? (
                        <img
                          src={m.media_url}
                          alt={m.caption ?? 'Wedding moment'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          📸
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FadeIn>
          )}
        </main>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <footer
          className="text-center py-10 px-6"
          style={{ borderTop: `1px solid ${t.accentBorder}` }}
        >
          <p
            className="text-[10px] tracking-[0.45em] uppercase"
            style={{ color: t.textFaint }}
          >
            Created with uMshado
          </p>
          <p
            className="mt-3 max-w-md mx-auto text-sm"
            style={{ color: t.textMid, lineHeight: 1.8 }}
          >
            Beautiful wedding websites for modern couples — share your story, schedule,
            gallery and registry all in one place.
          </p>
          <a
            href="/"
            className="text-sm mt-4 inline-block"
            style={{ color: t.accent, textDecoration: 'underline' }}
          >
            Create your own wedding website →
          </a>
        </footer>
      </div>

      {showShare && (
        <ShareSheet
          url={shareUrl}
          coupleName={coupleDisplay}
          t={t}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
