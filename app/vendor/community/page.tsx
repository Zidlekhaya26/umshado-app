'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import VendorBottomNav from '@/components/VendorBottomNav';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ───────────────────────────────────────────── */
interface CommunityPost {
  id: string;
  author: string;
  avatar: string;
  avatarColor: string;
  timeAgo: string;
  tag: string;
  tagColor: string;
  content: string;
  image_url: string | null;
  likes: number;
  comments: number;
}

interface SponsoredAd {
  id: string;
  vendorId?: string | null;
  vendorName?: string | null;
  headline: string;
  body: string;
  cta: string;
  category: string;
  color: string;
  emoji: string;
  badge?: string;
  imageUrl?: string | null;
  discountPct?: number | null;
}

/* ── Helpers ─────────────────────────────────────────── */
const TAG_COLORS: Record<string, string> = {
  Milestone: '#10b981', Question: '#f59e0b', Inspo: '#ec4899', Tip: '#06b6d4',
};
const TAG_ICONS: Record<string, string> = {
  Milestone: '🎯', Question: '❓', Inspo: '✨', Tip: '💡',
};
const AVATAR_COLORS = ['#9A2143','#3a7bec','#8b5cf6','#e8523a','#BD983F','#14b8a6','#6366f1','#f97316','#10b981','#ec4899'];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Seed posts (shown when DB is empty) ─────────────── */
const SEED_POSTS: CommunityPost[] = [
  { id: 'p1', author: 'Lerato & Tebogo', avatar: 'LT', avatarColor: '#9A2143', timeAgo: '2h ago', tag: 'Milestone', tagColor: '#10b981', content: 'We just confirmed our venue — The Botanical Gardens in Joburg! 8 months to go and it\'s finally feeling real. Anyone else booked here before? Would love tips!', image_url: null, likes: 47, comments: 12 },
  { id: 'p2', author: 'Amahle & Sipho', avatar: 'AS', avatarColor: '#3a7bec', timeAgo: '4h ago', tag: 'Question', tagColor: '#f59e0b', content: 'Brides who\'ve done a traditional Zulu wedding AND a church ceremony — how did you handle the two-day schedule? We\'re planning for April and feeling overwhelmed with logistics.', image_url: null, likes: 83, comments: 29 },
  { id: 'p3', author: 'Priya & Kiran', avatar: 'PK', avatarColor: '#8b5cf6', timeAgo: '6h ago', tag: 'Inspo', tagColor: '#ec4899', content: 'Our cake tasting was yesterday and WOW. We went with a 4-tier naked cake with fresh flowers. The baker suggested hibiscus and it looked absolutely stunning. Highly recommend exploring unconventional florals!', image_url: null, likes: 134, comments: 18 },
  { id: 'p4', author: 'Nomsa & Bongani', avatar: 'NB', avatarColor: '#e8523a', timeAgo: '9h ago', tag: 'Tip', tagColor: '#06b6d4', content: 'PSA for couples on a budget: book your vendors on a Tuesday or Wednesday — we got 20% off our photographer just by being flexible on the day.', image_url: null, likes: 211, comments: 44 },
  { id: 'p5', author: 'Candice & Mark', avatar: 'CM', avatarColor: '#BD983F', timeAgo: '12h ago', tag: 'Question', tagColor: '#f59e0b', content: 'Cape Town brides — what\'s realistic for a 120-person seated dinner with full catering? We\'ve had quotes ranging from R60k to R180k and don\'t know what\'s fair.', image_url: null, likes: 67, comments: 37 },
  { id: 'p6', author: 'Zanele & Lungelo', avatar: 'ZL', avatarColor: '#14b8a6', timeAgo: '1d ago', tag: 'Milestone', tagColor: '#10b981', content: 'ENGAGED! After 6 years together, he proposed at Kruger with a sunrise bush breakfast. Now the planning begins... any advice for a first-time bride?', image_url: null, likes: 342, comments: 91 },
  { id: 'p7', author: 'Fatima & Yusuf', avatar: 'FY', avatarColor: '#6366f1', timeAgo: '1d ago', tag: 'Inspo', tagColor: '#ec4899', content: 'We wanted a fusion of modern and Malay culture for our nikah and reception. Our decorator sourced handwoven Cape Malay textiles for the centrepieces — it was beyond anything we imagined.', image_url: null, likes: 189, comments: 22 },
  { id: 'p8', author: 'Bianca & Danie', avatar: 'BD', avatarColor: '#f97316', timeAgo: '2d ago', tag: 'Tip', tagColor: '#06b6d4', content: 'Tip from someone who just survived their wedding week: have a "day-of coordinator" even if you planned everything yourself. Ours cost R3k and saved us from at least 5 disasters. Non-negotiable.', image_url: null, likes: 276, comments: 53 },
  { id: 'p9', author: 'Nokwanda & Sifiso', avatar: 'NS', avatarColor: '#9A2143', timeAgo: '2d ago', tag: 'Question', tagColor: '#f59e0b', content: 'How many of you did a first look? We\'re torn — my fiancé wants the traditional aisle reveal but I love the idea of a private moment before the ceremony.', image_url: null, likes: 94, comments: 61 },
  { id: 'p10', author: 'Thandi & Mpho', avatar: 'TM', avatarColor: '#BD983F', timeAgo: '3d ago', tag: 'Milestone', tagColor: '#10b981', content: 'Just crossed the 100-day mark! Sent out our invitations, confirmed our DJ, and our dress alterations are done. Feeling terrifyingly excited.', image_url: null, likes: 158, comments: 14 },
];


/* ── Read-only post card ──────────────────────────────── */
function PostCard({ post }: { post: CommunityPost }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f1efec', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
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
      <p style={{ margin: '10px 16px', fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{post.content}</p>
      {post.image_url && (
        <div style={{ margin: '0 16px 12px', borderRadius: 12, overflow: 'hidden', background: 'rgba(154,33,67,0.05)' }}>
          <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
      {/* Read-only stats — no interactive buttons */}
      <div style={{ padding: '10px 16px 12px', borderTop: '1px solid #f5f3f0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#d1d5db', fontSize: 12.5 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.likes}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#d1d5db', fontSize: 12.5 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.comments}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#d1d5db', fontWeight: 600, letterSpacing: 0.3 }}>VIEW ONLY</span>
      </div>
    </div>
  );
}

/* ── Ad card ─────────────────────────────────────────── */
function AdCard({ ad }: { ad: SponsoredAd }) {
  const hasImage = Boolean(ad.imageUrl);
  return (
    <Link href={ad.vendorId ? `/v/${ad.vendorId}` : '/marketplace'} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${ad.color}28`, boxShadow: `0 4px 20px ${ad.color}12`, background: `${ad.color}0a`, position: 'relative', display: 'flex', minHeight: 130 }}>
        {/* SPONSORED badge */}
        <div style={{ position: 'absolute', top: 10, right: hasImage ? 'calc(36% + 8px)' : 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.08)', zIndex: 2 }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>SPONSORED</span>
        </div>
        {/* Left content */}
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center', minWidth: 0 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${ad.color}15`, color: ad.color, border: `1px solid ${ad.color}22`, alignSelf: 'flex-start' }}>
            {ad.category.split('&')[0].trim()}
          </span>
          {ad.vendorName && <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: ad.color, letterSpacing: 0.6, textTransform: 'uppercase' }}>{ad.vendorName}</p>}
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif', lineHeight: 1.25 }}>{ad.headline}</h3>
          <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', lineHeight: 1.4 }}>{ad.body}</p>
          <div style={{ alignSelf: 'flex-start', marginTop: 4, padding: '7px 14px', borderRadius: 20, background: ad.color, color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>
            {ad.cta.toUpperCase()}
          </div>
        </div>
        {/* Right: image or emoji */}
        {hasImage ? (
          <div style={{ width: '36%', flexShrink: 0, position: 'relative' }}>
            <img src={ad.imageUrl!} alt={ad.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {ad.discountPct && (
              <div style={{ position: 'absolute', bottom: 10, left: 10, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
                {ad.discountPct}% OFF
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: '26%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: `${ad.color}10`, borderLeft: `1px solid ${ad.color}18` }}>
            <span style={{ fontSize: 36 }}>{ad.emoji}</span>
            {ad.discountPct && (
              <div style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                {ad.discountPct}% OFF
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Upgrade wall ─────────────────────────────────────── */
function UpgradeWall() {
  return (
    <div style={{ minHeight: '100svh', background: '#faf8f5', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(160deg,#4d0f21 0%,#9A2143 52%,#c03050 100%)', padding: '40px 20px 32px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Community Feed</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>See what couples are planning across South Africa</p>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: 20, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#4d0f21,#9A2143)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(154,33,67,0.25)' }}>
          <svg width="32" height="32" fill="none" stroke="#fff" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif' }}>Pro Feature</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6, maxWidth: 300 }}>
            Browse real couple conversations, questions, and inspiration. Available on the Pro plan.
          </p>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Browse couple milestones and questions', 'See what couples are asking vendors', 'Stay ahead of trends and preferences', 'Your ad appears every 4 posts'].map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#374151' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(154,33,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" fill="none" stroke="#9A2143" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
              {f}
            </li>
          ))}
        </ul>
        <Link href="/vendor/billing" style={{ display: 'block', width: '100%', maxWidth: 320, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#4d0f21,#9A2143)', color: '#fff', fontSize: 15, fontWeight: 800, textAlign: 'center', textDecoration: 'none', boxShadow: '0 6px 20px rgba(154,33,67,0.3)', fontFamily: 'inherit' }}>
          Upgrade to Pro — R49.99/mo
        </Link>
        <p style={{ margin: 0, fontSize: 11.5, color: '#9ca3af' }}>Cancel anytime. Includes 7-day free trial.</p>
      </div>
      <VendorBottomNav />
    </div>
  );
}

/* ── Main ────────────────────────────────────────────── */
const TABS = ['All', 'Milestone', 'Question', 'Inspo', 'Tip'] as const;
type Tab = typeof TABS[number];

export default function VendorCommunityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [posts, setPosts]         = useState<CommunityPost[]>([]);
  const [ads, setAds]             = useState<SponsoredAd[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [tier, setTier]           = useState<string | null | undefined>(undefined); // undefined = loading

  /* ── Check subscription tier ──────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setTier(null); return; }
      const { data } = await supabase
        .from('vendors')
        .select('subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();
      setTier(data?.subscription_tier ?? null);
    })();
  }, []);

  /* ── Load posts ───────────────────────────────────── */
  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('id, user_id, author, category, content, image_url, likes_count, comments_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return;

    const mapped: CommunityPost[] = data.map(p => ({
      id: p.id,
      author: p.author || 'Anonymous',
      avatar: initials(p.author || 'A'),
      avatarColor: avatarColor(p.user_id),
      timeAgo: timeAgo(p.created_at),
      tag: p.category || 'Milestone',
      tagColor: TAG_COLORS[p.category] || '#10b981',
      content: p.content,
      image_url: p.image_url ?? null,
      likes: p.likes_count,
      comments: p.comments_count,
    }));

    setPosts(mapped.length > 0 ? mapped : SEED_POSTS);
    setPostsLoaded(true);
  }, []);

  useEffect(() => {
    if (tier === 'pro' || tier === 'trial') loadPosts();
  }, [tier, loadPosts]);

  /* ── Load ads ─────────────────────────────────────── */
  useEffect(() => {
    if (tier !== 'pro' && tier !== 'trial') return;
    fetch('/api/ads/active').then(r => r.json()).then(j => {
      if (j.ads?.length) setAds(j.ads);
    }).catch(() => {});
  }, [tier]);

  /* ── Loading state ────────────────────────────────── */
  if (tier === undefined) {
    return (
      <div style={{ minHeight: '100svh', background: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p>
        <VendorBottomNav />
      </div>
    );
  }

  /* ── Upgrade wall for free/null tier ─────────────── */
  if (tier !== 'pro' && tier !== 'trial') return <UpgradeWall />;

  /* ── Build feed ───────────────────────────────────── */
  const filtered = activeTab === 'All' ? posts : posts.filter(p => p.tag === activeTab);
  const feed: Array<{ type: 'post'; data: CommunityPost } | { type: 'ad'; data: SponsoredAd }> = [];
  // Always pin first sponsored ad at the top of the feed
  if (ads.length > 0) feed.push({ type: 'ad', data: ads[0] });
  filtered.forEach((p, i) => {
    feed.push({ type: 'post', data: p });
    // Rotate additional ads after every 5th post
    if ((i + 1) % 5 === 0 && ads.length > 0) {
      feed.push({ type: 'ad', data: ads[(Math.floor(i / 5) + 1) % ads.length] });
    }
  });

  return (
    <div style={{ minHeight: '100svh', background: '#faf8f5', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#4d0f21 0%,#9A2143 52%,#c03050 100%)', padding: '20px 20px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.12)', pointerEvents: 'none' }} />
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Community</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>Tips, milestones &amp; inspiration from SA couples</p>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(189,152,63,0.25)', color: '#BD983F', border: '1px solid rgba(189,152,63,0.3)', flexShrink: 0 }}>PRO</span>
          </div>
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

      {/* View-only notice */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '10px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, background: 'rgba(154,33,67,0.06)', border: '1px solid rgba(154,33,67,0.12)' }}>
          <svg width="13" height="13" fill="none" stroke="#9A2143" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: '#9A2143', fontWeight: 600 }}>Viewing as a vendor — browse only, couples post here</p>
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 14px calc(90px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!postsLoaded && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>Loading community posts...</div>
        )}
        {feed.map((item, i) =>
          item.type === 'post'
            ? <PostCard key={item.data.id} post={item.data} />
            : <AdCard key={`ad-${i}`} ad={item.data} />
        )}
      </div>

      <VendorBottomNav />
    </div>
  );
}
