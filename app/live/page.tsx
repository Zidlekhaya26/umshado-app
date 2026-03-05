'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';

// ─── Types ───────────────────────────────────────────────

interface LiveEvent {
  id: string; couple_id: string; title: string; time: string;
  location: string | null; sort_order: number; created_at: string;
}
interface WellWish {
  id: string; couple_id: string; guest_name: string; message: string; created_at: string;
}

type PostCategory = 'inspiration' | 'our_story' | 'lobola' | 'vendor_tip' | 'moment' | 'general';

interface CommunityPost {
  id: string; user_id: string; author: string; category: PostCategory;
  content: string; image_url: string | null; likes_count: number;
  comments_count: number; created_at: string; liked?: boolean;
}

interface CommunityComment {
  id: string; post_id: string; user_id: string; author: string;
  content: string; created_at: string;
}

// ─── Constants ───────────────────────────────────────────

const G = '#b8973e'; const G2 = '#8a6010'; const IVORY = '#faf7f2';
const BUCKET = 'community-images';

const CATEGORIES: { key: PostCategory; label: string; emoji: string; color: string; bg: string }[] = [
  { key: 'inspiration', label: 'Inspiration',  emoji: '✨', color: '#8a6010', bg: 'rgba(184,151,62,0.12)' },
  { key: 'our_story',   label: 'Our Story',    emoji: '💍', color: '#b83050', bg: 'rgba(184,48,80,0.08)'  },
  { key: 'lobola',      label: 'Lobola',       emoji: '🎊', color: '#5a3a10', bg: 'rgba(90,58,16,0.08)'  },
  { key: 'vendor_tip',  label: 'Vendor Tips',  emoji: '🌟', color: '#7a5200', bg: 'rgba(200,140,0,0.1)'  },
  { key: 'moment',      label: 'Moments',      emoji: '📸', color: '#2d7a52', bg: 'rgba(45,122,82,0.1)'  },
  { key: 'general',     label: 'General',      emoji: '💬', color: '#5a4030', bg: 'rgba(90,64,48,0.08)'  },
];

// ─── Helpers ─────────────────────────────────────────────

const formatTime12h = (t: string) => {
  if (!t?.includes(':')) return t;
  let h = parseInt(t.split(':')[0], 10);
  const m = t.split(':')[1];
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${m} ${ap}`;
};

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function genId() {
  return typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
}

async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')); };
    img.src = url;
  });
}

function catInfo(key: PostCategory) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[5];
}

function initials(name: string) {
  return name.split('&').map(p => p.trim()[0] ?? '?').join('').toUpperCase().slice(0, 2);
}

// ─── Input style ─────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid rgba(184,151,62,0.3)',
  borderRadius: 12, fontSize: 14, outline: 'none', background: IVORY,
  color: '#3d2510', boxSizing: 'border-box',
};

// ─── Main Content ────────────────────────────────────────

function LivePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlTab = searchParams.get('tab') || 'community';

  const [activeTab, setActiveTab] = useState<'community' | 'day' | 'wishes'>(
    (['community', 'day', 'wishes'].includes(urlTab) ? urlTab : 'community') as 'community' | 'day' | 'wishes'
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Live day data
  const [schedule, setSchedule]     = useState<LiveEvent[]>([]);
  const [wishes, setWishes]         = useState<WellWish[]>([]);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Community feed
  const [posts, setPosts]                   = useState<CommunityPost[]>([]);
  const [myLikes, setMyLikes]               = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat]           = useState<PostCategory | 'all'>('all');
  const [showPostModal, setShowPostModal]   = useState(false);
  const [newContent, setNewContent]         = useState('');
  const [newCategory, setNewCategory]       = useState<PostCategory>('general');
  const [authorName, setAuthorName]         = useState('');
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [loadingPosts, setLoadingPosts]     = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  // Comments
  const [expandedPost, setExpandedPost]         = useState<string | null>(null);
  const [comments, setComments]                 = useState<Record<string, CommunityComment[]>>({});
  const [loadingComments, setLoadingComments]   = useState<string | null>(null);
  const [newComment, setNewComment]             = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Schedule form
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTitle, setScheduleTitle]         = useState('');
  const [scheduleTime, setScheduleTime]           = useState('');
  const [scheduleLocation, setScheduleLocation]   = useState('');
  const [editingEvent, setEditingEvent]           = useState<LiveEvent | null>(null);
  const [editTitle, setEditTitle]                 = useState('');
  const [editTime, setEditTime]                   = useState('');
  const [editLocation, setEditLocation]           = useState('');

  // ─── Community: Supabase CRUD ─────────────────────────

  const loadPosts = useCallback(async (uid: string) => {
    setLoadingPosts(true);
    try {
      const [postsRes, likesRes] = await Promise.all([
        supabase.from('community_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('community_likes').select('post_id').eq('user_id', uid),
      ]);
      const likedSet = new Set<string>((likesRes.data ?? []).map((l: { post_id: string }) => l.post_id));
      setMyLikes(likedSet);
      setPosts((postsRes.data ?? []).map((p: CommunityPost) => ({ ...p, liked: likedSet.has(p.id) })));
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const uploadImage = async (file: File, uid: string): Promise<string | null> => {
    try {
      const compressed = await compressImage(file);
      const path = `${uid}/${genId()}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        contentType: 'image/webp', upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  };

  const submitPost = async () => {
    if (!newContent.trim() || !userId) return;
    setUploading(true);
    try {
      const image_url = imageFile ? await uploadImage(imageFile, userId) : null;
      const { data, error } = await supabase.from('community_posts').insert({
        user_id: userId,
        category: newCategory,
        content: newContent.trim(),
        image_url,
      }).select().single();
      if (!error && data) {
        setPosts(prev => [{ ...data, liked: false }, ...prev]);
        setNewContent(''); setImageFile(null); setImagePreview(null);
        setNewCategory('general'); setShowPostModal(false);
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!userId) return;
    const liked = myLikes.has(postId);
    // Optimistic update
    setMyLikes(prev => { const s = new Set(prev); liked ? s.delete(postId) : s.add(postId); return s; });
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, liked: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 }
      : p));
    if (liked) {
      await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('community_likes').insert({ post_id: postId, user_id: userId });
    }
  };

  const deletePost = async (postId: string) => {
    await supabase.from('community_posts').delete().eq('id', postId).eq('user_id', userId!);
    setPosts(prev => prev.filter(p => p.id !== postId));
    setComments(prev => { const n = { ...prev }; delete n[postId]; return n; });
  };

  const toggleComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (comments[postId]) return;
    setLoadingComments(postId);
    const { data } = await supabase.from('community_comments')
      .select('*').eq('post_id', postId).order('created_at');
    setComments(prev => ({ ...prev, [postId]: data ?? [] }));
    setLoadingComments(null);
  };

  const addComment = async (postId: string) => {
    if (!newComment.trim() || !userId || submittingComment) return;
    setSubmittingComment(true);
    const { data, error } = await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: userId,
      content: newComment.trim(),
    }).select().single();
    if (!error && data) {
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      setNewComment('');
    }
    setSubmittingComment(false);
  };

  const deleteComment = async (commentId: string, postId: string) => {
    await supabase.from('community_comments').delete().eq('id', commentId).eq('user_id', userId!);
    setComments(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId) }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
  };

  const filteredPosts = filterCat === 'all' ? posts : posts.filter(p => p.category === filterCat);

  // ─── Auth + live data ────────────────────────────────

  const loadData = useCallback(async (uid: string) => {
    const [s, w] = await Promise.all([
      supabase.from('live_events').select('*').eq('couple_id', uid).order('sort_order'),
      supabase.from('live_well_wishes').select('*').eq('couple_id', uid).order('created_at', { ascending: false }),
    ]);
    if (s.data) setSchedule(s.data);
    if (w.data) setWishes(w.data);
  }, []);

  const loadGuestToken = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch('/api/live/link', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) { const d = await res.json(); setGuestToken(d.token); }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/auth/sign-in'); return; }
      setUserId(session.user.id);
      // Resolve the logged-in user's display name (profile → couples)
      try {
        const [profileRes, coupleRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle(),
          supabase.from('couples').select('partner_name').eq('id', session.user.id).maybeSingle(),
        ]);
        const profileName = profileRes.data?.full_name;
        const coupleName = coupleRes.data?.partner_name;
        // Prefer the couple-level canonical name if present; otherwise fall back to profile full_name or email
        const displayName = coupleName || profileName || session.user.email?.split('@')[0] || 'Couple';
        setAuthorName(displayName);
      } catch {}
      await Promise.all([loadPosts(session.user.id), loadData(session.user.id), loadGuestToken(session.access_token)]);
      setLoaded(true);
    })();
  }, [router, loadPosts, loadData, loadGuestToken]);

  useEffect(() => {
    if (['community', 'day', 'wishes'].includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab as 'community' | 'day' | 'wishes');
    }
  }, [urlTab, activeTab]);

  const handleTabChange = (tab: 'community' | 'day' | 'wishes') => {
    setActiveTab(tab); router.push(`/live?tab=${tab}`);
  };

  // ─── Guest link ──────────────────────────────────────

  const guestUrl = guestToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live/guest?token=${guestToken}`
    : null;

  const copyGuestLink = async () => {
    if (!guestUrl) return;
    try { await navigator.clipboard.writeText(guestUrl); }
    catch { const i = document.createElement('input'); i.value = guestUrl; document.body.appendChild(i); i.select(); document.execCommand('copy'); document.body.removeChild(i); }
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
  };

  // ─── Schedule CRUD ───────────────────────────────────

  const addScheduleEvent = async () => {
    if (!scheduleTitle.trim() || !scheduleTime || !userId) return;
    const nextOrder = schedule.length > 0 ? Math.max(...schedule.map(s => s.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('live_events').insert({
      couple_id: userId, title: scheduleTitle.trim(),
      time: scheduleTime, location: scheduleLocation.trim() || null, sort_order: nextOrder,
    }).select().single();
    if (!error && data) {
      setSchedule(prev => [...prev, data].sort((a, b) => a.time.localeCompare(b.time)));
      setScheduleTitle(''); setScheduleTime(''); setScheduleLocation('');
      setShowScheduleModal(false);
    }
  };

  const startEditEvent = (ev: LiveEvent) => {
    setEditingEvent(ev); setEditTitle(ev.title); setEditTime(ev.time); setEditLocation(ev.location || '');
  };

  const saveEditEvent = async () => {
    if (!editingEvent || !editTitle.trim() || !editTime) return;
    const { error } = await supabase.from('live_events').update({
      title: editTitle.trim(), time: editTime, location: editLocation.trim() || null,
    }).eq('id', editingEvent.id);
    if (!error) {
      setSchedule(prev => prev.map(s => s.id === editingEvent.id
        ? { ...s, title: editTitle.trim(), time: editTime, location: editLocation.trim() || null } : s
      ).sort((a, b) => a.time.localeCompare(b.time)));
    }
    setEditingEvent(null);
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('live_events').delete().eq('id', id);
    if (!error) setSchedule(prev => prev.filter(s => s.id !== id));
  };

  const deleteWish = async (id: string) => {
    const { error } = await supabase.from('live_well_wishes').delete().eq('id', id);
    if (!error) setWishes(prev => prev.filter(w => w.id !== id));
  };

  // ─── Loading ─────────────────────────────────────────

  if (!loaded) return (
    <div style={{ minHeight: '100svh', background: IVORY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(184,151,62,0.15)', borderTopColor: G, animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: IVORY }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', minHeight: '100svh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(135deg,${G},${G2})`, padding: '22px 20px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UmshadoIcon size={28} />
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 2.5, textTransform: 'uppercase' }}>uMshado</p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1.1 }}>Community</h1>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Inspire · Celebrate · Connect with couples across SA</p>
        </div>

        {/* ── Tabs ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(184,151,62,0.15)', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'community', label: '👥 Community' },
              { key: 'day',       label: '🗓 Schedule'  },
              { key: 'wishes',    label: '💌 Wishes'    },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeTab === tab.key ? `linear-gradient(135deg,${G},${G2})` : 'rgba(184,151,62,0.07)',
                  color: activeTab === tab.key ? '#fff' : '#7a5c30',
                  boxShadow: activeTab === tab.key ? '0 3px 10px rgba(184,151,62,0.25)' : 'none' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ════ COMMUNITY TAB ════ */}
          {activeTab === 'community' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Share prompt */}
              <div style={{ background: `linear-gradient(135deg,${G},${G2})`, borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>🤝</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Share your journey</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Inspire other couples with your story, traditions & tips</p>
                </div>
                <button onClick={() => setShowPostModal(true)}
                  style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  + Post
                </button>
              </div>

              {/* Category filter chips */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
                <button onClick={() => setFilterCat('all')}
                  style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterCat === 'all' ? G : 'rgba(184,151,62,0.25)'}`,
                    background: filterCat === 'all' ? `linear-gradient(135deg,${G},${G2})` : '#fff',
                    color: filterCat === 'all' ? '#fff' : '#7a5c30', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🌍 All
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => setFilterCat(cat.key)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterCat === cat.key ? G : 'rgba(184,151,62,0.2)'}`,
                      background: filterCat === cat.key ? `linear-gradient(135deg,${G},${G2})` : '#fff',
                      color: filterCat === cat.key ? '#fff' : '#7a5c30', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* Post cards */}
              {filteredPosts.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(184,151,62,0.3)', padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>✨</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>No posts yet</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#9a7c58' }}>Be the first to share in this category!</p>
                  <button onClick={() => setShowPostModal(true)}
                    style={{ padding: '10px 22px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    Share Something
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredPosts.map(post => {
                    const cat = catInfo(post.category);
                    return (
                      <div key={post.id} style={{ background: '#fff', borderRadius: 20, border: post.category === 'vendor_tip' ? `1.5px solid rgba(184,151,62,0.4)` : '1.5px solid rgba(184,151,62,0.12)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                        {post.category === 'vendor_tip' && (
                          <div style={{ background: 'rgba(184,151,62,0.08)', padding: '6px 16px', borderBottom: '1px solid rgba(184,151,62,0.15)' }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: G2, letterSpacing: 1.5 }}>⭐ VENDOR RECOMMENDATION</p>
                          </div>
                        )}
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                            {/* Avatar */}
                            <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg,${G},${G2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{initials(post.author)}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3d2510' }}>{post.author}</p>
                                <span style={{ padding: '2px 8px', borderRadius: 20, background: cat.bg, color: cat.color, fontSize: 10, fontWeight: 700 }}>
                                  {cat.emoji} {cat.label}
                                </span>
                              </div>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9a7c58' }}>{timeAgo(post.created_at)}</p>
                            </div>
                            <button onClick={() => deletePost(post.id)} style={{ padding: 4, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          <p style={{ margin: '0 0 10px', fontSize: 14, color: '#3d2510', lineHeight: 1.6 }}>{post.content}</p>

                          {post.image_url && (
                            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: '#f5f0e8' }}>
                              <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6, borderTop: '1px solid rgba(184,151,62,0.1)' }}>
                            <button onClick={() => toggleLike(post.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: post.liked ? '#e04444' : '#9a7c58', fontSize: 13, fontWeight: 600 }}>
                              <span style={{ fontSize: 16 }}>{post.liked ? '❤️' : '🤍'}</span>
                              {post.likes_count}
                            </button>
                            <span style={{ fontSize: 12, color: '#c0a87c' }}>·</span>
                            <button onClick={() => toggleComments(post.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: expandedPost === post.id ? G2 : '#9a7c58', fontSize: 13, fontWeight: 600 }}>
                              💬 {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
                            </button>
                          </div>

                          {/* ── Comments section ── */}
                          {expandedPost === post.id && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(184,151,62,0.08)' }}>
                              {loadingComments === post.id ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(184,151,62,0.15)', borderTopColor: G, animation: 'spin 0.8s linear infinite' }} />
                                </div>
                              ) : (
                                <>
                                  {(comments[post.id] ?? []).length === 0 && (
                                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9a7c58', textAlign: 'center' }}>No comments yet — be the first!</p>
                                  )}
                                  {(comments[post.id] ?? []).map(c => (
                                    <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,151,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: G2 }}>{initials(c.author)}</span>
                                      </div>
                                      <div style={{ flex: 1, background: 'rgba(184,151,62,0.06)', borderRadius: 10, padding: '7px 10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: '#3d2510' }}>{c.author}</span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 10, color: '#9a7c58' }}>{timeAgo(c.created_at)}</span>
                                            {c.user_id === userId && (
                                              <button onClick={() => deleteComment(c.id, post.id)} style={{ padding: 2, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: 12, color: '#3d2510', lineHeight: 1.5 }}>{c.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                  {/* Add comment input */}
                                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <input
                                      value={newComment}
                                      onChange={e => setNewComment(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(post.id); } }}
                                      placeholder="Write a comment…"
                                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid rgba(184,151,62,0.25)', borderRadius: 20, fontSize: 12, outline: 'none', background: IVORY, color: '#3d2510' }}
                                    />
                                    <button
                                      onClick={() => addComment(post.id)}
                                      disabled={!newComment.trim() || submittingComment}
                                      style={{ padding: '8px 14px', borderRadius: 20, background: newComment.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: newComment.trim() ? '#fff' : '#9a8a70', fontSize: 12, fontWeight: 700, border: 'none', cursor: newComment.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
                                      {submittingComment ? '…' : 'Post'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Vendor suggestion quick-post */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(184,151,62,0.2)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🌟</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#3d2510' }}>Know a great vendor?</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9a7c58' }}>Help other couples by recommending reliable vendors</p>
                </div>
                <button onClick={() => { setNewCategory('vendor_tip'); setShowPostModal(true); }}
                  style={{ padding: '7px 14px', borderRadius: 20, background: 'rgba(184,151,62,0.1)', color: '#8a6010', fontSize: 12, fontWeight: 700, border: '1px solid rgba(184,151,62,0.3)', cursor: 'pointer', flexShrink: 0 }}>
                  Suggest
                </button>
              </div>
            </div>
          )}

          {/* ════ SCHEDULE TAB ════ */}
          {activeTab === 'day' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Share with Guests */}
              <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid rgba(184,151,62,0.2)', padding: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#3d2510' }}>📲 Share with Guests</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9a7c58' }}>Guests can view your schedule, send wishes, and share moments.</p>
                {guestUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ background: '#fff', padding: 12, borderRadius: 16, border: '1.5px solid rgba(184,151,62,0.2)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <QRCodeSVG value={guestUrl} size={150} level="M" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={guestUrl} onClick={e => (e.target as HTMLInputElement).select()}
                        style={{ flex: 1, padding: '9px 12px', border: '1.5px solid rgba(184,151,62,0.2)', borderRadius: 10, fontSize: 11, color: '#5c3d28', background: IVORY, outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }} />
                      <button onClick={copyGuestLink}
                        style={{ padding: '9px 16px', borderRadius: 10, background: linkCopied ? '#3d9e6a' : `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        {linkCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid rgba(184,151,62,0.2)`, borderTopColor: G, animation: 'spin 0.8s linear infinite', margin: '0 auto 6px' }} />
                    <p style={{ margin: 0, fontSize: 12, color: '#9a7c58' }}>Generating guest link…</p>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3d2510' }}>Wedding Day Schedule</p>
                <button onClick={() => setShowScheduleModal(true)}
                  style={{ padding: '8px 18px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(184,151,62,0.25)' }}>
                  + Add
                </button>
              </div>

              {schedule.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(184,151,62,0.3)', padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🗓️</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>No schedule yet</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#9a7c58' }}>Add your wedding day timeline so guests know what's happening.</p>
                  <button onClick={() => setShowScheduleModal(true)}
                    style={{ padding: '10px 22px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    + Add Event
                  </button>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid rgba(184,151,62,0.15)', overflow: 'hidden' }}>
                  {schedule.map((item, index) => (
                    <div key={item.id} style={{ padding: '14px 16px', display: 'flex', gap: 12, borderBottom: index !== schedule.length - 1 ? '1px solid rgba(184,151,62,0.1)' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ minWidth: 64, padding: '4px 8px', background: 'rgba(184,151,62,0.1)', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(184,151,62,0.2)' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: G2 }}>{formatTime12h(item.time)}</span>
                        </div>
                        {index !== schedule.length - 1 && <div style={{ width: 2, flex: 1, background: 'rgba(184,151,62,0.2)', marginTop: 6 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3d2510' }}>{item.title}</p>
                        {item.location && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9a7c58' }}>📍 {item.location}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexShrink: 0 }}>
                        <button onClick={() => startEditEvent(item)} style={{ padding: 5, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => deleteEvent(item.id)} style={{ padding: 5, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ WISHES TAB ════ */}
          {activeTab === 'wishes' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3d2510' }}>Well Wishes</p>
                {wishes.length > 0 && <span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(184,151,62,0.1)', color: G2, fontSize: 11, fontWeight: 700 }}>{wishes.length}</span>}
              </div>

              {wishes.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(184,151,62,0.3)', padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>No well wishes yet</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9a7c58' }}>Share your guest link so friends & family can send you their love!</p>
                </div>
              ) : (
                wishes.map(wish => (
                  <div key={wish.id} style={{ background: '#fff', borderRadius: 16, border: '1.5px solid rgba(184,151,62,0.12)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(184,151,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 18 }}>💌</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#3d2510' }}>{wish.guest_name}</span>
                          <span style={{ fontSize: 11, color: '#9a7c58' }}>{timeAgo(wish.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#5c3d28', lineHeight: 1.55 }}>{wish.message}</p>
                      </div>
                      <button onClick={() => deleteWish(wish.id)} style={{ padding: 4, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* Create Community Post Modal */}
      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 640, padding: '0 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(184,151,62,0.2)', margin: '16px auto 20px' }} />
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>Share with Community</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 8 }}>YOUR NAMES</label>
                <input value={authorName} readOnly placeholder="e.g., Thabo & Lerato" style={inp} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 8 }}>CATEGORY</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.key} onClick={() => setNewCategory(cat.key)}
                      style={{ padding: '8px 6px', borderRadius: 12, border: `1.5px solid ${newCategory === cat.key ? G : 'rgba(184,151,62,0.2)'}`,
                        background: newCategory === cat.key ? `linear-gradient(135deg,${G},${G2})` : IVORY,
                        color: newCategory === cat.key ? '#fff' : '#7a5c30', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 8 }}>YOUR MESSAGE</label>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                  placeholder="Share your inspiration, story, vendor recommendation or wedding moment…"
                  rows={5}
                  style={{ ...inp, resize: 'none', lineHeight: 1.6 }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 8 }}>PHOTO (OPTIONAL)</label>
                {imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f5f0e8' }}>
                    <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✕
                    </button>
                    <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 10, color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '2px 6px' }}>Will be compressed to WebP on upload</div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px dashed rgba(184,151,62,0.3)', background: IVORY, color: '#9a7c58', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    📷 Tap to add a photo
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageFile(file);
                    const prev = imagePreview;
                    if (prev) URL.revokeObjectURL(prev);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowPostModal(false); setNewContent(''); setImageFile(null); setImagePreview(null); setNewCategory('general'); }}
                style={{ flex: 1, padding: '13px', borderRadius: 14, background: '#f5f0e8', color: '#7a5c30', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitPost} disabled={!newContent.trim() || uploading}
                style={{ flex: 2, padding: '13px', borderRadius: 14, background: newContent.trim() && !uploading ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: newContent.trim() && !uploading ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: newContent.trim() && !uploading ? 'pointer' : 'default', boxShadow: newContent.trim() && !uploading ? '0 4px 14px rgba(184,151,62,0.3)' : 'none' }}>
                {uploading ? (imageFile ? 'Uploading photo…' : 'Posting…') : 'Share Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showScheduleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: '100%', maxWidth: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>Add Schedule Event</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>TIME</label><input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>EVENT TITLE</label><input type="text" value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} placeholder="e.g., Ceremony begins" style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>LOCATION (OPTIONAL)</label><input type="text" value={scheduleLocation} onChange={e => setScheduleLocation(e.target.value)} placeholder="e.g., Main Chapel" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowScheduleModal(false); setScheduleTitle(''); setScheduleTime(''); setScheduleLocation(''); }}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#f5f0e8', color: '#7a5c30', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addScheduleEvent} disabled={!scheduleTime || !scheduleTitle.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: scheduleTime && scheduleTitle.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: scheduleTime && scheduleTitle.trim() ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: scheduleTime && scheduleTitle.trim() ? 'pointer' : 'default', boxShadow: scheduleTime && scheduleTitle.trim() ? '0 4px 14px rgba(184,151,62,0.3)' : 'none' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editingEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: '100%', maxWidth: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: '#3d2510', fontFamily: 'Georgia,serif' }}>Edit Schedule Event</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>TIME</label><input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>EVENT TITLE</label><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7a5c30', letterSpacing: 1, marginBottom: 6 }}>LOCATION (OPTIONAL)</label><input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditingEvent(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: '#f5f0e8', color: '#7a5c30', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditEvent} disabled={!editTime || !editTitle.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: editTime && editTitle.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: editTime && editTitle.trim() ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: editTime && editTitle.trim() ? 'pointer' : 'default' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100svh', background: '#faf7f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(184,151,62,0.15)', borderTopColor: '#b8973e', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    }>
      <LivePageContent />
    </Suspense>
  );
}
