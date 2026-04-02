'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ───────────────────────────────────────────── */
interface CommunityPost {
  id: string;
  user_id?: string;
  author: string;
  avatar: string;
  avatarColor: string;
  timeAgo: string;
  tag: string;
  tagColor: string;
  content: string;
  likes: number;
  comments: number;
  liked?: boolean;
  fromDb: boolean;
}

interface SponsoredAd {
  id: string;
  vendorId?: string | null;
  headline: string;
  body: string;
  cta: string;
  category: string;
  color: string;
  emoji: string;
  badge?: string;
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
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── Seed posts (shown when DB is empty) ─────────────── */
const SEED_POSTS: CommunityPost[] = [
  { id: 'p1', author: 'Lerato & Tebogo', avatar: 'LT', avatarColor: '#9A2143', timeAgo: '2h ago', tag: 'Milestone', tagColor: '#10b981', content: 'We just confirmed our venue — The Botanical Gardens in Joburg! 8 months to go and it\'s finally feeling real. Anyone else booked here before? Would love tips!', likes: 47, comments: 12, fromDb: false },
  { id: 'p2', author: 'Amahle & Sipho', avatar: 'AS', avatarColor: '#3a7bec', timeAgo: '4h ago', tag: 'Question', tagColor: '#f59e0b', content: 'Brides who\'ve done a traditional Zulu wedding AND a church ceremony — how did you handle the two-day schedule? We\'re planning for April and feeling overwhelmed with logistics.', likes: 83, comments: 29, fromDb: false },
  { id: 'p3', author: 'Priya & Kiran', avatar: 'PK', avatarColor: '#8b5cf6', timeAgo: '6h ago', tag: 'Inspo', tagColor: '#ec4899', content: 'Our cake tasting was yesterday and WOW. We went with a 4-tier naked cake with fresh flowers. The baker suggested hibiscus and it looked absolutely stunning. Highly recommend exploring unconventional florals!', likes: 134, comments: 18, fromDb: false },
  { id: 'p4', author: 'Nomsa & Bongani', avatar: 'NB', avatarColor: '#e8523a', timeAgo: '9h ago', tag: 'Tip', tagColor: '#06b6d4', content: 'PSA for couples on a budget: book your vendors on a Tuesday or Wednesday — we got 20% off our photographer just by being flexible on the day. uMshado made it so easy to find vendors who offer weekday rates.', likes: 211, comments: 44, fromDb: false },
  { id: 'p5', author: 'Candice & Mark', avatar: 'CM', avatarColor: '#BD983F', timeAgo: '12h ago', tag: 'Question', tagColor: '#f59e0b', content: 'Cape Town brides — what\'s realistic for a 120-person seated dinner with full catering? We\'ve had quotes ranging from R60k to R180k and don\'t know what\'s fair.', likes: 67, comments: 37, fromDb: false },
  { id: 'p6', author: 'Zanele & Lungelo', avatar: 'ZL', avatarColor: '#14b8a6', timeAgo: '1d ago', tag: 'Milestone', tagColor: '#10b981', content: 'ENGAGED! After 6 years together, he proposed at Kruger with a sunrise bush breakfast. Now the planning begins... any advice for a first-time bride? Where do I even start?', likes: 342, comments: 91, fromDb: false },
  { id: 'p7', author: 'Fatima & Yusuf', avatar: 'FY', avatarColor: '#6366f1', timeAgo: '1d ago', tag: 'Inspo', tagColor: '#ec4899', content: 'We wanted a fusion of modern and Malay culture for our nikah and reception. Our decorator sourced handwoven Cape Malay textiles for the centrepieces — it was beyond anything we imagined.', likes: 189, comments: 22, fromDb: false },
  { id: 'p8', author: 'Bianca & Danie', avatar: 'BD', avatarColor: '#f97316', timeAgo: '2d ago', tag: 'Tip', tagColor: '#06b6d4', content: 'Tip from someone who just survived their wedding week: have a "day-of coordinator" even if you planned everything yourself. Ours cost R3k and saved us from at least 5 disasters. Non-negotiable.', likes: 276, comments: 53, fromDb: false },
  { id: 'p9', author: 'Nokwanda & Sifiso', avatar: 'NS', avatarColor: '#9A2143', timeAgo: '2d ago', tag: 'Question', tagColor: '#f59e0b', content: 'How many of you did a first look? We\'re torn — my fiancé wants the traditional aisle reveal but I love the idea of a private moment before the ceremony. Opinions?', likes: 94, comments: 61, fromDb: false },
  { id: 'p10', author: 'Thandi & Mpho', avatar: 'TM', avatarColor: '#BD983F', timeAgo: '3d ago', tag: 'Milestone', tagColor: '#10b981', content: 'Just crossed the 100-day mark! Sent out our invitations, confirmed our DJ, and our dress alterations are done. Feeling terrifyingly excited.', likes: 158, comments: 14, fromDb: false },
];

/* ── Fallback ads (shown when no active boosts) ──────── */
const FALLBACK_ADS: SponsoredAd[] = [
  { id: 'ca-noxa', headline: 'Noxa — Wedding Photography Across SA', body: 'Capturing every moment from engagement to last dance. Award-winning photography and coordination. Verified Pro on uMshado.', cta: 'View Portfolio', category: 'Photography & Video', color: '#9A2143', emoji: '📸', badge: 'Verified Pro' },
  { id: 'ca1', headline: 'Luminary Photography — Capturing Your Story', body: 'Award-winning wedding photography. Available across SA. Booking 2025–2026 now.', cta: 'View Portfolio', category: 'Photography', color: '#3a7bec', emoji: '📸', badge: '5-star rated' },
  { id: 'ca2', headline: 'The Grand Botanical Venue — Joburg & Cape Town', body: 'Iconic gardens for up to 350 guests. Full catering & accommodation packages.', cta: 'Check Availability', category: 'Venues', color: '#10b981', emoji: '🌿', badge: 'Verified' },
  { id: 'ca3', headline: 'Velvet Touch — Bridal Makeup & Hair Packages', body: 'From R2 500. Destination weddings welcome. 180+ brides served.', cta: 'Book a Trial', category: 'Makeup & Hair', color: '#ec4899', emoji: '💄', badge: 'Popular' },
];

/* ── Post card ───────────────────────────────────────── */
function PostCard({ post, onLike, userId, onDelete }: { post: CommunityPost; onLike: (id: string) => void; userId: string | null; onDelete: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwn = post.fromDb && post.user_id === userId;

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
        {isOwn && (
          <button onClick={() => setConfirmDelete(true)} title="Delete post"
            style={{ marginLeft: 4, padding: '4px 8px', background: 'rgba(154,33,67,0.06)', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
            ···
          </button>
        )}
      </div>
      <p style={{ margin: '10px 16px 14px', fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{post.content}</p>

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div style={{ margin: '0 14px 14px', padding: '14px 16px', background: 'rgba(224,68,68,0.06)', borderRadius: 12, border: '1.5px solid rgba(224,68,68,0.2)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>Delete this post?</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.1)', background: '#f9f6f2', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { setConfirmDelete(false); onDelete(post.id); }}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: '#e04444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f5f3f0', display: 'flex', alignItems: 'center', gap: 18 }}>
        <button onClick={() => onLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: post.liked ? '#9A2143' : '#9ca3af', fontWeight: post.liked ? 700 : 500, fontSize: 13, fontFamily: 'inherit' }}>
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

/* ── Ad card ─────────────────────────────────────────── */
function AdCard({ ad }: { ad: SponsoredAd }) {
  return (
    <Link href={ad.vendorId ? `/marketplace/vendor/${ad.vendorId}` : '/marketplace'} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ borderRadius: 18, overflow: 'hidden', border: `1.5px solid ${ad.color}28`, boxShadow: `0 4px 20px ${ad.color}12`, background: '#fff', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>SPONSORED</span>
        </div>
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

/* ── Community page ──────────────────────────────────── */
const TABS = ['All', 'Milestone', 'Question', 'Inspo', 'Tip'] as const;
type Tab = typeof TABS[number];

export default function CommunityPage() {
  const [activeTab, setActiveTab]     = useState<Tab>('All');
  const [posts, setPosts]             = useState<CommunityPost[]>([]);
  const [likedIds, setLikedIds]       = useState<Set<string>>(new Set());
  const [ads, setAds]                 = useState<SponsoredAd[]>(FALLBACK_ADS);
  const [userId, setUserId]           = useState<string | null>(null);
  const [authorName, setAuthorName]   = useState('Anonymous Couple');
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft]             = useState('');
  const [draftTag, setDraftTag]       = useState<'Milestone' | 'Question' | 'Inspo' | 'Tip'>('Milestone');
  const [submitting, setSubmitting]   = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  /* ── Load user + author name ──────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Try to get couple display name
      const { data: couple } = await supabase
        .from('couples')
        .select('partner_name')
        .eq('id', user.id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const name = couple?.partner_name || profile?.full_name || 'Anonymous Couple';
      setAuthorName(name);
    })();
  }, []);

  /* ── Load posts from DB ───────────────────────────── */
  const loadPosts = useCallback(async (uid: string | null) => {
    const { data } = await supabase
      .from('community_posts')
      .select('id, user_id, author, category, content, likes_count, comments_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return;

    // Get liked post IDs for current user
    let liked: Set<string> = new Set();
    if (uid) {
      const { data: likeRows } = await supabase
        .from('community_likes')
        .select('post_id')
        .eq('user_id', uid);
      liked = new Set((likeRows || []).map((l: { post_id: string }) => l.post_id));
      setLikedIds(liked);
    }

    const mapped: CommunityPost[] = data.map(p => ({
      id: p.id,
      user_id: p.user_id,
      author: p.author || 'Anonymous',
      avatar: initials(p.author || 'A'),
      avatarColor: avatarColor(p.user_id),
      timeAgo: timeAgo(p.created_at),
      tag: p.category || 'Milestone',
      tagColor: TAG_COLORS[p.category] || '#10b981',
      content: p.content,
      likes: p.likes_count,
      comments: p.comments_count,
      liked: liked.has(p.id),
      fromDb: true,
    }));

    setPosts(mapped.length > 0 ? mapped : SEED_POSTS);
    setPostsLoaded(true);
  }, []);

  useEffect(() => { loadPosts(userId); }, [userId, loadPosts]);

  /* ── Load real ads ────────────────────────────────── */
  useEffect(() => {
    fetch('/api/ads/active').then(r => r.json()).then(j => {
      if (j.ads?.length) setAds(j.ads);
    }).catch(() => {});
  }, []);
  /* ── Delete post ─────────────────────────────────── */
  const handleDeletePost = async (id: string) => {
    if (!userId) return;
    await supabase.from('community_posts').delete().eq('id', id).eq('user_id', userId);
    setPosts(prev => prev.filter(p => p.id !== id));
  };
  /* ── Like toggle ──────────────────────────────────── */
  const handleLike = async (id: string) => {
    const post = posts.find(p => p.id === id);
    if (!post?.fromDb || !userId) {
      // Local-only toggle for seed posts
      setLikedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      return;
    }

    const isLiked = likedIds.has(id);
    // Optimistic update
    setLikedIds(prev => { const n = new Set(prev); isLiked ? n.delete(id) : n.add(id); return n; });
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !isLiked, likes: p.likes + (isLiked ? -1 : 1) } : p));

    if (isLiked) {
      await supabase.from('community_likes').delete().eq('post_id', id).eq('user_id', userId);
      await supabase.from('community_posts').update({ likes_count: Math.max(0, (post.likes) - 1) }).eq('id', id);
    } else {
      await supabase.from('community_likes').insert({ post_id: id, user_id: userId });
      await supabase.from('community_posts').update({ likes_count: post.likes + 1 }).eq('id', id);
    }
  };

  /* ── Submit post ──────────────────────────────────── */
  const handleSubmit = async () => {
    if (!draft.trim() || draft.trim().length < 10 || !userId || submitting) return;
    setSubmitting(true);

    const { data, error } = await supabase.from('community_posts').insert({
      user_id: userId,
      author: authorName,
      category: draftTag,
      content: draft.trim(),
      likes_count: 0,
      comments_count: 0,
    }).select().single();

    if (!error && data) {
      const newPost: CommunityPost = {
        id: data.id,
        user_id: data.user_id,
        author: data.author,
        avatar: initials(data.author),
        avatarColor: avatarColor(data.user_id),
        timeAgo: 'just now',
        tag: data.category,
        tagColor: TAG_COLORS[data.category] || '#10b981',
        content: data.content,
        likes: 0,
        comments: 0,
        liked: false,
        fromDb: true,
      };
      // Replace seeds with real posts if this is the first real post
      setPosts(prev => {
        const realPosts = prev.filter(p => p.fromDb);
        return [newPost, ...realPosts];
      });
    }

    setDraft(''); setDraftTag('Milestone'); setShowCompose(false); setSubmitting(false);
  };

  /* ── Build feed with ad injection ────────────────── */
  const filtered = activeTab === 'All' ? posts : posts.filter(p => p.tag === activeTab);

  const feed: Array<{ type: 'post'; data: CommunityPost } | { type: 'ad'; data: SponsoredAd }> = [];
  filtered.forEach((p, i) => {
    feed.push({ type: 'post', data: { ...p, liked: p.fromDb ? p.liked : likedIds.has(p.id) } });
    if ((i + 1) % 4 === 0) {
      feed.push({ type: 'ad', data: ads[Math.floor(i / 4) % ads.length] });
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
            <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>Tips, milestones &amp; inspiration from SA couples</p>
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
        {!postsLoaded && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>Loading community posts...</div>
        )}
        {feed.map((item, i) =>
          item.type === 'post'
            ? <PostCard key={item.data.id} post={item.data} onLike={handleLike} userId={userId} onDelete={handleDeletePost} />
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
                maxLength={280}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', outline: 'none', fontSize: 14, color: '#111827', resize: 'none', fontFamily: 'inherit', lineHeight: 1.55, boxSizing: 'border-box' }}
              />
              <p style={{ margin: '4px 0 14px', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>{draft.length}/280</p>

              <button
                onClick={handleSubmit}
                disabled={draft.trim().length < 10 || submitting}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: draft.trim().length >= 10 && !submitting ? 'pointer' : 'default', background: draft.trim().length >= 10 && !submitting ? 'linear-gradient(135deg,#4d0f21,#9A2143)' : '#e5e7eb', color: draft.trim().length >= 10 && !submitting ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', transition: 'all .15s' }}>
                {submitting ? 'Posting...' : 'Post to Community'}
              </button>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
