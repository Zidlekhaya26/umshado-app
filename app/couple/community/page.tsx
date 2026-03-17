'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ───────────────────────────────────────────────── */
interface CommunityPost {
  id: string;
  author: string;
  avatar: string;
  avatarColor: string;
  timeAgo: string;
  tag: string;
  tagColor: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  liked?: boolean;
}

interface SponsoredAd {
  id: string;
  vendorId?: string;
  headline: string;
  body: string;
  cta: string;
  category: string;
  color: string;
  emoji: string;
  badge?: string;
}

/* ── Dummy posts ─────────────────────────────────────────── */
const POSTS: CommunityPost[] = [
  {
    id: 'p1', author: 'Lerato & Tebogo', avatar: 'LT', avatarColor: '#9A2143',
    timeAgo: '2h ago', tag: 'Milestone', tagColor: '#10b981',
    content: 'We just confirmed our venue — The Botanical Gardens in Joburg! 8 months to go and it\'s finally feeling real. Anyone else booked here before? Would love tips!',
    likes: 47, comments: 12,
  },
  {
    id: 'p2', author: 'Amahle & Sipho', avatar: 'AS', avatarColor: '#3a7bec',
    timeAgo: '4h ago', tag: 'Question', tagColor: '#f59e0b',
    content: 'Brides who\'ve done a traditional Zulu wedding AND a church ceremony — how did you handle the two-day schedule? We\'re planning for April and feeling overwhelmed with logistics.',
    likes: 83, comments: 29,
  },
  {
    id: 'p3', author: 'Priya & Kiran', avatar: 'PK', avatarColor: '#8b5cf6',
    timeAgo: '6h ago', tag: 'Inspo', tagColor: '#ec4899',
    content: 'Our cake tasting was yesterday and WOW. We went with a 4-tier naked cake with fresh flowers. The baker suggested hibiscus and it looked absolutely stunning. Highly recommend exploring unconventional florals!',
    likes: 134, comments: 18,
  },
  {
    id: 'p4', author: 'Nomsa & Bongani', avatar: 'NB', avatarColor: '#e8523a',
    timeAgo: '9h ago', tag: 'Tip', tagColor: '#06b6d4',
    content: 'PSA for couples on a budget: book your vendors on a Tuesday or Wednesday — we got 20% off our photographer just by being flexible on the day. uMshado made it so easy to find vendors who offer weekday rates.',
    likes: 211, comments: 44,
  },
  {
    id: 'p5', author: 'Candice & Mark', avatar: 'CM', avatarColor: '#BD983F',
    timeAgo: '12h ago', tag: 'Question', tagColor: '#f59e0b',
    content: 'Cape Town brides — what\'s realistic for a 120-person seated dinner with full catering? We\'ve had quotes ranging from R60k to R180k and don\'t know what\'s fair.',
    likes: 67, comments: 37,
  },
  {
    id: 'p6', author: 'Zanele & Lungelo', avatar: 'ZL', avatarColor: '#14b8a6',
    timeAgo: '1d ago', tag: 'Milestone', tagColor: '#10b981',
    content: 'ENGAGED! After 6 years together, he proposed at Kruger with a sunrise bush breakfast. Now the planning begins... any advice for a first-time bride? Where do I even start?',
    likes: 342, comments: 91,
  },
  {
    id: 'p7', author: 'Fatima & Yusuf', avatar: 'FY', avatarColor: '#6366f1',
    timeAgo: '1d ago', tag: 'Inspo', tagColor: '#ec4899',
    content: 'We wanted a fusion of modern and Malay culture for our nikah and reception. Our decorator sourced handwoven Cape Malay textiles for the centrepieces — it was beyond anything we imagined.',
    likes: 189, comments: 22,
  },
  {
    id: 'p8', author: 'Bianca & Danie', avatar: 'BD', avatarColor: '#f97316',
    timeAgo: '2d ago', tag: 'Tip', tagColor: '#06b6d4',
    content: 'Tip from someone who just survived their wedding week: have a "day-of coordinator" even if you planned everything yourself. Ours cost R3k and saved us from at least 5 disasters. Non-negotiable.',
    likes: 276, comments: 53,
  },
  {
    id: 'p9', author: 'Nokwanda & Sifiso', avatar: 'NS', avatarColor: '#9A2143',
    timeAgo: '2d ago', tag: 'Question', tagColor: '#f59e0b',
    content: 'How many of you did a first look? We\'re torn — my fiancé wants the traditional aisle reveal but I love the idea of a private moment before the ceremony. Opinions?',
    likes: 94, comments: 61,
  },
  {
    id: 'p10', author: 'Thandi & Mpho', avatar: 'TM', avatarColor: '#BD983F',
    timeAgo: '3d ago', tag: 'Milestone', tagColor: '#10b981',
    content: 'Just crossed the 100-day mark! Sent out our invitations, confirmed our DJ, and our dress alterations are done. Feeling terrifyingly excited.',
    likes: 158, comments: 14,
  },
];

/* ── Dummy ads ───────────────────────────────────────────── */
const ADS: SponsoredAd[] = [
  {
    id: 'ca-noxa',
    headline: 'Noxa — Wedding Planning, Reimagined',
    body: 'Stress-free planning from first look to last dance. Noxa brings together coordination, vendor matching & day-of support for modern SA weddings.',
    cta: 'Explore Services',
    category: 'Planning & Coordination',
    color: '#9A2143',
    emoji: '🌟',
    badge: 'Verified Pro',
  },
  {
    id: 'ca1',
    headline: 'Luminary Photography — Capturing Your Story',
    body: 'Award-winning wedding photography. Available across SA. Booking 2025–2026 now.',
    cta: 'View Portfolio',
    category: 'Photography',
    color: '#3a7bec',
    emoji: '📸',
    badge: '5-star rated',
  },
  {
    id: 'ca2',
    headline: 'The Grand Botanical Venue — Joburg & Cape Town',
    body: 'Iconic gardens for up to 350 guests. Full catering & accommodation packages.',
    cta: 'Check Availability',
    category: 'Venues',
    color: '#10b981',
    emoji: '🌿',
    badge: 'Verified',
  },
  {
    id: 'ca3',
    headline: 'Velvet Touch — Bridal Makeup & Hair Packages',
    body: 'From R2 500. Destination weddings welcome. 180+ brides served.',
    cta: 'Book a Trial',
    category: 'Makeup & Hair',
    color: '#ec4899',
    emoji: '💄',
    badge: 'Popular',
  },
  {
    id: 'ca4',
    headline: 'Bliss Catering — Traditional & Fusion Menus',
    body: 'Halaal, kosher & vegan options. Intimate dinners to 500-guest receptions.',
    cta: 'Get a Quote',
    category: 'Catering',
    color: '#e8523a',
    emoji: '🍽️',
    badge: 'Top rated',
  },
];

/* ── Tag styles ──────────────────────────────────────────── */
const TAG_ICONS: Record<string, string> = {
  Milestone: '🎯', Question: '❓', Inspo: '✨', Tip: '💡',
};

/* ── Post card ───────────────────────────────────────────── */
function PostCard({ post, onLike }: { post: CommunityPost; onLike: (id: string) => void }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f1efec', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
      {/* Author row */}
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: post.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'Georgia,serif', flexShrink: 0 }}>
          {post.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{post.author}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9ca3af' }}>{post.timeAgo}</p>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${post.tagColor}18`, color: post.tagColor, border: `1px solid ${post.tagColor}30` }}>
          {TAG_ICONS[post.tag]} {post.tag}
        </span>
      </div>

      {/* Content */}
      <p style={{ margin: '10px 16px 14px', fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{post.content}</p>

      {/* Actions */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f5f3f0', display: 'flex', alignItems: 'center', gap: 18 }}>
        <button onClick={() => onLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: post.liked ? '#9A2143' : '#9ca3af', fontWeight: post.liked ? 700 : 500, fontSize: 13, fontFamily: 'inherit', transition: 'color .15s' }}>
          <svg width="16" height="16" fill={post.liked ? '#9A2143' : 'none'} stroke={post.liked ? '#9A2143' : '#9ca3af'} strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.likes + (post.liked ? 1 : 0)}
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: 13, fontFamily: 'inherit' }}>
          <svg width="16" height="16" fill="none" stroke="#9ca3af" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.comments}
        </button>
        <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: 13, fontFamily: 'inherit' }}>
          <svg width="15" height="15" fill="none" stroke="#9ca3af" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>
    </div>
  );
}

/* ── Ad card ─────────────────────────────────────────────── */
function AdCard({ ad }: { ad: SponsoredAd }) {
  return (
    <Link href="/marketplace" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${ad.color}28`, boxShadow: `0 4px 20px ${ad.color}12`, background: '#fff', position: 'relative' }}>
        {/* Sponsored label */}
        <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>SPONSORED</span>
        </div>

        {/* Band */}
        <div style={{ height: 72, background: `linear-gradient(135deg,${ad.color}20,${ad.color}08)`, borderBottom: `1px solid ${ad.color}18`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg,${ad.color}cc,${ad.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 3px 10px ${ad.color}28` }}>
            {ad.emoji}
          </div>
          <div>
            {ad.badge && (
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${ad.color}15`, color: ad.color, border: `1px solid ${ad.color}22`, display: 'inline-block', marginBottom: 3 }}>{ad.badge}</span>
            )}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif', lineHeight: 1.25 }}>{ad.headline}</h3>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 12.5, color: '#4b5563', lineHeight: 1.5 }}>{ad.body}</p>
          <div style={{ flexShrink: 0, padding: '9px 14px', borderRadius: 11, background: `linear-gradient(135deg,${ad.color}cc,${ad.color})`, color: '#fff', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: `0 3px 10px ${ad.color}30` }}>
            {ad.cta}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Community page ──────────────────────────────────────── */
const TABS = ['All', 'Milestone', 'Question', 'Inspo', 'Tip'] as const;
type Tab = typeof TABS[number];

export default function CommunityPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [liked, setLiked]         = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft]         = useState('');
  const [draftTag, setDraftTag]   = useState<'Milestone' | 'Question' | 'Inspo' | 'Tip'>('Milestone');

  const filtered = activeTab === 'All' ? POSTS : POSTS.filter(p => p.tag === activeTab);

  const handleLike = (id: string) => {
    setLiked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Intersperse ads every 4 posts
  const feed: Array<{ type: 'post'; data: CommunityPost } | { type: 'ad'; data: SponsoredAd }> = [];
  filtered.forEach((p, i) => {
    feed.push({ type: 'post', data: p });
    if ((i + 1) % 4 === 0) {
      feed.push({ type: 'ad', data: ADS[Math.floor(i / 4) % ADS.length] });
    }
  });

  return (
    <div style={{ minHeight: '100svh', background: '#faf8f5', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#4d0f21 0%,#9A2143 52%,#c03050 100%)', padding: '20px 20px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.12)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Community</h1>
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>Tips, milestones & inspiration from SA couples</p>
          </div>
          <button onClick={() => setShowCompose(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)', fontFamily: 'inherit' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Post
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 0, scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flexShrink: 0, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab ? 800 : 600, color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)', borderBottom: activeTab === tab ? '2.5px solid #BD983F' : '2.5px solid transparent', transition: 'all .15s', fontFamily: 'inherit' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px calc(90px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {feed.map((item, i) =>
          item.type === 'post'
            ? <PostCard key={item.data.id} post={{ ...item.data, liked: liked.has(item.data.id) }} onLike={handleLike} />
            : <AdCard key={`ad-${i}`} ad={item.data} />
        )}
      </div>

      {/* Compose sheet */}
      {showCompose && (
        <>
          <div onClick={() => setShowCompose(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', zIndex: 60, padding: '0 0 env(safe-area-inset-bottom)', maxWidth: 640, margin: '0 auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 0' }} />
            <div style={{ padding: '16px 20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif' }}>Share with the community</p>
                <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Tag selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {(['Milestone', 'Question', 'Inspo', 'Tip'] as const).map(t => (
                  <button key={t} onClick={() => setDraftTag(t)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: draftTag === t ? '#9A2143' : '#f3f4f6', color: draftTag === t ? '#fff' : '#4b5563', transition: 'all .14s' }}>
                    {TAG_ICONS[t]} {t}
                  </button>
                ))}
              </div>

              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Share a milestone, ask a question, or inspire another couple..."
                rows={4}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', outline: 'none', fontSize: 14, color: '#111827', resize: 'none', fontFamily: 'inherit', lineHeight: 1.55, boxSizing: 'border-box' }}
              />
              <p style={{ margin: '4px 0 14px', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{draft.length}/280</p>

              <button
                onClick={() => { setShowCompose(false); setDraft(''); }}
                disabled={draft.trim().length < 10}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: draft.trim().length >= 10 ? 'pointer' : 'default', background: draft.trim().length >= 10 ? 'linear-gradient(135deg,#4d0f21,#9A2143)' : '#e5e7eb', color: draft.trim().length >= 10 ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', transition: 'all .15s' }}>
                Post to Community
              </button>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
