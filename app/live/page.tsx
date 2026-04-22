'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import { CR, CR2, CRX, DK, MUT, BOR, BG } from '@/lib/tokens';

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
  reposts_count: number;
  reposted?: boolean;
}

interface CommunityComment {
  id: string; post_id: string; user_id: string; author: string;
  content: string; created_at: string;
  parent_id?: string | null;
}

// ─── Constants ───────────────────────────────────────────

// G/G2/IVORY kept as aliases so every template expression picks up crimson automatically
const G = CR, G2 = CR2, IVORY = BG;
const BUCKET = 'community-images';

const CATEGORIES: { key: PostCategory; label: string; emoji: string; color: string; bg: string }[] = [
  { key: 'inspiration', label: 'Inspiration',  emoji: '✨', color: 'var(--um-gold-dark)', bg: 'rgba(184,151,62,0.12)' },
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
  width: '100%', padding: '10px 14px', border: `1.5px solid ${BOR}`,
  borderRadius: 12, fontSize: 14, outline: 'none', background: IVORY,
  color: DK, boxSizing: 'border-box',
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
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Live day data
  const [schedule, setSchedule]     = useState<LiveEvent[]>([]);
  const [wishes, setWishes]         = useState<WellWish[]>([]);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Community feed
  const [posts, setPosts]                   = useState<CommunityPost[]>([]);
  const [myLikes, setMyLikes]               = useState<Set<string>>(new Set());
  const [myReposts, setMyReposts]           = useState<Set<string>>(new Set());
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

  // Threaded replies
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; author: string; postId: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Delete confirmations
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<{ id: string; postId: string } | null>(null);

  // Share sheet
  const [sharePost, setSharePost] = useState<CommunityPost | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

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
      const [postsRes, likesRes, repostsRes] = await Promise.all([
        supabase.from('community_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('community_likes').select('post_id').eq('user_id', uid),
        supabase.from('community_reposts').select('post_id').eq('user_id', uid),
      ]);
      const likedSet = new Set<string>((likesRes.data ?? []).map((l: { post_id: string }) => l.post_id));
      const repostSet = new Set<string>((repostsRes.data ?? []).map((r: { post_id: string }) => r.post_id));
      setMyLikes(likedSet);
      setMyReposts(repostSet);
      setPosts((postsRes.data ?? []).map((p: CommunityPost) => ({
        ...p,
        liked: likedSet.has(p.id),
        reposted: repostSet.has(p.id),
        reposts_count: p.reposts_count ?? 0,
      })));
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
        setPosts(prev => [{ ...data, liked: false, reposted: false, reposts_count: 0 }, ...prev]);
        setNewContent(''); setImageFile(null); setImagePreview(null);
        setNewCategory('general'); setShowPostModal(false);
      }
    } finally {
      setUploading(false);
    }
  };

  const communityNotify = (payload: object) => {
    if (!authToken) return;
    fetch('/api/community/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(payload),
    }).catch(() => {});
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
      communityNotify({ type: 'post_liked', postId });
    }
  };

  const toggleRepost = async (postId: string) => {
    if (!userId) return;
    const reposted = myReposts.has(postId);
    setMyReposts(prev => { const s = new Set(prev); reposted ? s.delete(postId) : s.add(postId); return s; });
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, reposted: !reposted, reposts_count: Math.max(0, (p.reposts_count || 0) + (reposted ? -1 : 1)) }
      : p));
    if (reposted) {
      await supabase.from('community_reposts').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('community_reposts').insert({ post_id: postId, user_id: userId });
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
      parent_id: null,
    }).select().single();
    if (!error && data) {
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      const preview = newComment.trim().length > 80 ? newComment.trim().slice(0, 77) + '…' : newComment.trim();
      communityNotify({ type: 'post_commented', postId, commentPreview: preview });
      setNewComment('');
    }
    setSubmittingComment(false);
  };

  const addReply = async (postId: string, parentId: string) => {
    if (!replyContent.trim() || !userId || submittingComment) return;
    setSubmittingComment(true);
    // Find the parent comment's author user_id before inserting
    const parentComment = (comments[postId] ?? []).find(c => c.id === parentId);
    const { data, error } = await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: userId,
      content: replyContent.trim(),
      parent_id: parentId,
    }).select().single();
    if (!error && data) {
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      const preview = replyContent.trim().length > 80 ? replyContent.trim().slice(0, 77) + '…' : replyContent.trim();
      communityNotify({
        type: 'comment_replied',
        postId,
        commentPreview: preview,
        parentCommentUserId: parentComment?.user_id,
      });
      setReplyContent('');
      setReplyingTo(null);
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
      setAuthToken(session.access_token);
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

  // ── Real-time: community_posts INSERT → prepend; UPDATE → patch counts ──────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('community_feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_posts',
      }, payload => {
        const row = payload.new as CommunityPost;
        // Don't duplicate posts the current user just submitted (already in state)
        setPosts(prev => {
          if (prev.some(p => p.id === row.id)) return prev;
          return [{ ...row, liked: false, reposted: false }, ...prev];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'community_posts',
      }, payload => {
        const row = payload.new as CommunityPost;
        setPosts(prev =>
          prev.map(p => p.id === row.id
            ? { ...p, likes_count: row.likes_count, comments_count: row.comments_count, reposts_count: row.reposts_count }
            : p
          )
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(154,33,67,0.15)', borderTopColor: G, animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100svh', background: IVORY }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', minHeight: '100svh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(160deg,${CRX} 0%,${CR} 55%,var(--um-crimson-mid) 100%)`, padding: '22px 20px 18px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(189,152,63,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(189,152,63,0.06)', pointerEvents: 'none' }} />
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
        <div style={{ background: '#fff', borderBottom: '1px solid rgba(154,33,67,0.15)', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'community', label: '👥 Community' },
              { key: 'day',       label: '🗓 Schedule'  },
              { key: 'wishes',    label: '💌 Wishes'    },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: activeTab === tab.key ? `linear-gradient(135deg,${G},${G2})` : 'rgba(154,33,67,0.07)',
                  color: activeTab === tab.key ? '#fff' : 'var(--um-muted)',
                  boxShadow: activeTab === tab.key ? '0 3px 10px rgba(154,33,67,0.25)' : 'none' }}>
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
              <div style={{ background: `linear-gradient(160deg,${CRX} 0%,${G} 60%,var(--um-crimson-mid) 100%)`, borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(189,152,63,0.12)', pointerEvents: 'none' }} />
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Share your journey</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Inspire couples with your story, traditions & vendor tips</p>
                </div>
                <button onClick={() => setShowPostModal(true)}
                  style={{ padding: '9px 18px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, backdropFilter: 'blur(4px)' }}>
                  + Post
                </button>
              </div>

              {/* Category filter chips */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
                <button onClick={() => setFilterCat('all')}
                  style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterCat === 'all' ? G : 'rgba(154,33,67,0.25)'}`,
                    background: filterCat === 'all' ? `linear-gradient(135deg,${G},${G2})` : '#fff',
                    color: filterCat === 'all' ? '#fff' : 'var(--um-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🌍 All
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => setFilterCat(cat.key)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterCat === cat.key ? G : 'rgba(154,33,67,0.2)'}`,
                      background: filterCat === cat.key ? `linear-gradient(135deg,${G},${G2})` : '#fff',
                      color: filterCat === cat.key ? '#fff' : 'var(--um-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* Post cards */}
              {filteredPosts.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(154,33,67,0.3)', padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>✨</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>No posts yet</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--um-muted)' }}>Be the first to share in this category!</p>
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
                      <div key={post.id} style={{ background: '#fff', borderRadius: 20, border: post.category === 'vendor_tip' ? `1.5px solid rgba(154,33,67,0.4)` : '1.5px solid rgba(154,33,67,0.12)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                        {post.category === 'vendor_tip' && (
                          <div style={{ background: 'rgba(154,33,67,0.08)', padding: '6px 16px', borderBottom: '1px solid rgba(154,33,67,0.15)' }}>
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
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--um-dark)' }}>{post.author}</p>
                                <span style={{ padding: '2px 8px', borderRadius: 20, background: cat.bg, color: cat.color, fontSize: 10, fontWeight: 700 }}>
                                  {cat.emoji} {cat.label}
                                </span>
                              </div>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--um-muted)' }}>{timeAgo(post.created_at)}</p>
                            </div>
                            {post.user_id === userId && (
                              <button
                                onClick={() => setConfirmDeletePostId(post.id)}
                                title="Delete post"
                                style={{ padding: '4px 6px', color: 'var(--um-muted)', background: 'rgba(154,33,67,0.06)', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0, fontSize: 16, lineHeight: 1 }}>
                                ···
                              </button>
                            )}
                          </div>

                          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--um-dark)', lineHeight: 1.6 }}>{post.content}</p>

                          {post.image_url && (
                            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10, background: 'rgba(154,33,67,0.06)' }}>
                              <img src={post.image_url} alt="Post" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          )}

                          {/* ── Actions row ── */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid rgba(154,33,67,0.1)', flexWrap: 'wrap' }}>
                            {/* Like */}
                            <button onClick={() => toggleLike(post.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: post.liked ? '#e04444' : MUT, fontSize: 13, fontWeight: 600 }}>
                              <span style={{ fontSize: 16 }}>{post.liked ? '❤️' : '🤍'}</span>
                              {post.likes_count}
                            </button>
                            <span style={{ fontSize: 12, color: '#b0a090' }}>·</span>
                            {/* Repost */}
                            <button onClick={() => toggleRepost(post.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: post.reposted ? CR : MUT, fontSize: 13, fontWeight: 600 }}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                              {post.reposts_count || 0}
                            </button>
                            <span style={{ fontSize: 12, color: '#b0a090' }}>·</span>
                            {/* Comments */}
                            <button onClick={() => toggleComments(post.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: expandedPost === post.id ? G2 : MUT, fontSize: 13, fontWeight: 600 }}>
                              💬 {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
                            </button>
                            <span style={{ fontSize: 12, color: '#b0a090' }}>·</span>
                            {/* Share */}
                            <button onClick={() => { setSharePost(post); setShareCopied(false); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: MUT, fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>
                              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                            </button>
                          </div>

                          {/* ── Comments section ── */}
                          {expandedPost === post.id && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(154,33,67,0.08)' }}>
                              {loadingComments === post.id ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(154,33,67,0.15)', borderTopColor: G, animation: 'spin 0.8s linear infinite' }} />
                                </div>
                              ) : (
                                <>
                                  {(comments[post.id] ?? []).length === 0 && (
                                    <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--um-muted)', textAlign: 'center' }}>No comments yet — be the first!</p>
                                  )}

                                  {/* Threaded comments render */}
                                  {(comments[post.id] ?? [])
                                    .filter(c => !c.parent_id)
                                    .map(topComment => {
                                      const replies = (comments[post.id] ?? []).filter(r => r.parent_id === topComment.id);
                                      const isReplyingToThis = replyingTo?.commentId === topComment.id;
                                      return (
                                        <div key={topComment.id} style={{ marginBottom: 12 }}>
                                          {/* Top-level comment */}
                                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(154,33,67,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                              <span style={{ fontSize: 9, fontWeight: 700, color: G2 }}>{initials(topComment.author)}</span>
                                            </div>
                                            <div style={{ flex: 1, background: 'rgba(154,33,67,0.06)', borderRadius: 10, padding: '7px 10px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--um-dark)' }}>{topComment.author}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                  <span style={{ fontSize: 10, color: 'var(--um-muted)' }}>{timeAgo(topComment.created_at)}</span>
                                                  <button
                                                    onClick={() => {
                                                      if (isReplyingToThis) {
                                                        setReplyingTo(null); setReplyContent('');
                                                      } else {
                                                        setReplyingTo({ commentId: topComment.id, author: topComment.author, postId: post.id });
                                                        setReplyContent('');
                                                      }
                                                    }}
                                                    style={{ fontSize: 11, color: MUT, background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontWeight: 600 }}>
                                                    {isReplyingToThis ? 'Cancel' : 'Reply'}
                                                  </button>
                                                  {topComment.user_id === userId && (
                                                    <button onClick={() => setConfirmDeleteComment({ id: topComment.id, postId: post.id })}
                                                      title="Delete comment"
                                                      style={{ padding: '2px 5px', color: '#e04444', background: 'rgba(224,68,68,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                                                      Delete
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                              <p style={{ margin: 0, fontSize: 12, color: 'var(--um-dark)', lineHeight: 1.5 }}>{topComment.content}</p>
                                            </div>
                                          </div>

                                          {/* Inline reply form — appears directly below parent */}
                                          {isReplyingToThis && (
                                            <div style={{ marginLeft: 36, marginTop: 6, borderLeft: '2px solid rgba(154,33,67,0.15)', paddingLeft: 10 }}>
                                              <p style={{ margin: '0 0 4px', fontSize: 11, color: CR, fontWeight: 700 }}>@{replyingTo!.author}</p>
                                              <div style={{ display: 'flex', gap: 6 }}>
                                                <input
                                                  value={replyContent}
                                                  onChange={e => setReplyContent(e.target.value)}
                                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addReply(post.id, topComment.id); } }}
                                                  placeholder={`Reply to ${replyingTo!.author}…`}
                                                  autoFocus
                                                  style={{ flex: 1, padding: '7px 11px', border: '1.5px solid rgba(154,33,67,0.25)', borderRadius: 18, fontSize: 12, outline: 'none', background: IVORY, color: DK }}
                                                />
                                                <button
                                                  onClick={() => addReply(post.id, topComment.id)}
                                                  disabled={!replyContent.trim() || submittingComment}
                                                  style={{ padding: '7px 13px', borderRadius: 18, background: replyContent.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: replyContent.trim() ? '#fff' : '#9a8a70', fontSize: 12, fontWeight: 700, border: 'none', cursor: replyContent.trim() ? 'pointer' : 'default', flexShrink: 0 }}>
                                                  {submittingComment ? '…' : 'Send'}
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Replies indented below parent */}
                                          {replies.map(reply => (
                                            <div key={reply.id} style={{ marginLeft: 36, marginTop: 6, borderLeft: '2px solid rgba(154,33,67,0.15)', paddingLeft: 10 }}>
                                              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(154,33,67,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <span style={{ fontSize: 8, fontWeight: 700, color: G2 }}>{initials(reply.author)}</span>
                                                </div>
                                                <div style={{ flex: 1, background: 'rgba(154,33,67,0.04)', borderRadius: 10, padding: '6px 9px' }}>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--um-dark)' }}>{reply.author}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                      <span style={{ fontSize: 10, color: 'var(--um-muted)' }}>{timeAgo(reply.created_at)}</span>
                                                      {reply.user_id === userId && (
                                                        <button onClick={() => setConfirmDeleteComment({ id: reply.id, postId: post.id })}
                                                          title="Delete reply"
                                                          style={{ padding: '2px 5px', color: '#e04444', background: 'rgba(224,68,68,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                                                          Delete
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <p style={{ margin: 0, fontSize: 12, color: 'var(--um-dark)', lineHeight: 1.5 }}>
                                                    <span style={{ color: CR, fontWeight: 700 }}>@{topComment.author} </span>
                                                    {reply.content}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })}

                                  {/* Add top-level comment input */}
                                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <input
                                      value={newComment}
                                      onChange={e => setNewComment(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(post.id); } }}
                                      placeholder="Write a comment…"
                                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid rgba(154,33,67,0.25)', borderRadius: 20, fontSize: 12, outline: 'none', background: IVORY, color: 'var(--um-dark)' }}
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
              <div style={{ background: `linear-gradient(135deg,rgba(189,152,63,0.07),rgba(154,33,67,0.05))`, borderRadius: 18, border: `1.5px solid rgba(189,152,63,0.25)`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,var(--um-gold),var(--um-gold-dark))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>🌟</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--um-dark)' }}>Know a great vendor?</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--um-muted)' }}>Help other couples find reliable vendors across SA</p>
                </div>
                <button onClick={() => { setNewCategory('vendor_tip'); setShowPostModal(true); }}
                  style={{ padding: '8px 16px', borderRadius: 20, background: `linear-gradient(135deg,var(--um-gold),var(--um-gold-dark))`, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: '0 3px 10px rgba(189,152,63,0.3)' }}>
                  Recommend
                </button>
              </div>
            </div>
          )}

          {/* ════ SCHEDULE TAB ════ */}
          {activeTab === 'day' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Share with Guests */}
              <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid rgba(154,33,67,0.2)', padding: '16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--um-dark)' }}>📲 Share with Guests</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--um-muted)' }}>Guests can view your schedule, send wishes, and share moments.</p>
                {guestUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ background: '#fff', padding: 12, borderRadius: 16, border: '1.5px solid rgba(154,33,67,0.2)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <QRCodeSVG value={guestUrl} size={150} level="M" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={guestUrl} onClick={e => (e.target as HTMLInputElement).select()}
                        style={{ flex: 1, padding: '9px 12px', border: '1.5px solid rgba(154,33,67,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--um-dark)', background: IVORY, outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }} />
                      <button onClick={copyGuestLink}
                        style={{ padding: '9px 16px', borderRadius: 10, background: linkCopied ? '#3d9e6a' : `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        {linkCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (!guestUrl) return;
                        const text = encodeURIComponent(`You're invited! View our wedding schedule and send your wishes here: ${guestUrl}`);
                        const a = document.createElement('a'); a.href = `https://wa.me/?text=${text}`;
                        a.target = '_blank'; a.rel = 'noopener noreferrer';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }}
                      style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: '#25d366', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Share via WhatsApp
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid rgba(154,33,67,0.2)`, borderTopColor: G, animation: 'spin 0.8s linear infinite', margin: '0 auto 6px' }} />
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--um-muted)' }}>Generating guest link…</p>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--um-dark)' }}>Wedding Day Schedule</p>
                <button onClick={() => setShowScheduleModal(true)}
                  style={{ padding: '8px 18px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 3px 10px rgba(154,33,67,0.25)' }}>
                  + Add
                </button>
              </div>

              {schedule.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(154,33,67,0.3)', padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🗓️</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>No schedule yet</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--um-muted)' }}>Add your wedding day timeline so guests know what&apos;s happening.</p>
                  <button onClick={() => setShowScheduleModal(true)}
                    style={{ padding: '10px 22px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    + Add Event
                  </button>
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid rgba(154,33,67,0.15)', overflow: 'hidden' }}>
                  {schedule.map((item, index) => (
                    <div key={item.id} style={{ padding: '14px 16px', display: 'flex', gap: 12, borderBottom: index !== schedule.length - 1 ? '1px solid rgba(154,33,67,0.1)' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ minWidth: 64, padding: '4px 8px', background: 'rgba(154,33,67,0.1)', borderRadius: 10, textAlign: 'center', border: '1px solid rgba(154,33,67,0.2)' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: G2 }}>{formatTime12h(item.time)}</span>
                        </div>
                        {index !== schedule.length - 1 && <div style={{ width: 2, flex: 1, background: 'rgba(154,33,67,0.2)', marginTop: 6 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--um-dark)' }}>{item.title}</p>
                        {item.location && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--um-muted)' }}>📍 {item.location}</p>}
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
              {/* Header with count + hint */}
              <div style={{ background: `linear-gradient(135deg,rgba(154,33,67,0.06),rgba(189,152,63,0.06))`, borderRadius: 18, padding: '16px 18px', border: `1.5px solid ${BOR}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${G},${G2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 18 }}>💌</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DK }}>
                      Well Wishes {wishes.length > 0 && <span style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(154,33,67,0.12)', color: G2, fontSize: 11, marginLeft: 6 }}>{wishes.length}</span>}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: MUT }}>Share your guest link so guests can send love</p>
                  </div>
                </div>
              </div>

              {wishes.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: 20, border: '2px dashed rgba(154,33,67,0.3)', padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>💌</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>No well wishes yet</p>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--um-muted)' }}>Share your guest link so friends & family can send you their love!</p>
                  <button onClick={() => handleTabChange('day')}
                    style={{ padding: '10px 22px', borderRadius: 20, background: `linear-gradient(135deg,${G},${G2})`, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                    Get Guest Link
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {wishes.map(wish => (
                    <div key={wish.id} style={{ background: '#fff', borderRadius: 18, border: '1.5px solid rgba(154,33,67,0.12)', padding: '14px 16px', boxShadow: '0 1px 8px rgba(26,13,18,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,rgba(154,33,67,0.12),rgba(154,33,67,0.06))`, border: '1px solid rgba(154,33,67,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: CR2 }}>{wish.guest_name.slice(0,2).toUpperCase()}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--um-dark)' }}>{wish.guest_name}</span>
                            <span style={{ fontSize: 11, color: 'var(--um-muted)' }}>{timeAgo(wish.created_at)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--um-dark)', lineHeight: 1.65, background: 'rgba(154,33,67,0.04)', padding: '8px 12px', borderRadius: 12, borderLeft: `3px solid rgba(154,33,67,0.3)` }}>{wish.message}</p>
                        </div>
                        <button onClick={() => deleteWish(wish.id)} style={{ padding: 4, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(154,33,67,0.2)', margin: '16px auto 20px' }} />
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>Share with Community</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 8 }}>YOUR NAMES</label>
                <input value={authorName} readOnly placeholder="e.g., Thabo & Lerato" style={inp} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 8 }}>CATEGORY</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.key} onClick={() => setNewCategory(cat.key)}
                      style={{ padding: '8px 6px', borderRadius: 12, border: `1.5px solid ${newCategory === cat.key ? G : 'rgba(154,33,67,0.2)'}`,
                        background: newCategory === cat.key ? `linear-gradient(135deg,${G},${G2})` : IVORY,
                        color: newCategory === cat.key ? '#fff' : 'var(--um-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 8 }}>YOUR MESSAGE</label>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                  placeholder="Share your inspiration, story, vendor recommendation or wedding moment…"
                  rows={5}
                  style={{ ...inp, resize: 'none', lineHeight: 1.6 }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 8 }}>PHOTO (OPTIONAL)</label>
                {imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'rgba(154,33,67,0.06)' }}>
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
                    style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px dashed rgba(154,33,67,0.3)', background: IVORY, color: 'var(--um-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
                style={{ flex: 1, padding: '13px', borderRadius: 14, background: 'rgba(154,33,67,0.06)', color: 'var(--um-muted)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitPost} disabled={!newContent.trim() || uploading}
                style={{ flex: 2, padding: '13px', borderRadius: 14, background: newContent.trim() && !uploading ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: newContent.trim() && !uploading ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: newContent.trim() && !uploading ? 'pointer' : 'default', boxShadow: newContent.trim() && !uploading ? '0 4px 14px rgba(154,33,67,0.3)' : 'none' }}>
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
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>Add Schedule Event</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>TIME</label><input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>EVENT TITLE</label><input type="text" value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} placeholder="e.g., Ceremony begins" style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>LOCATION (OPTIONAL)</label><input type="text" value={scheduleLocation} onChange={e => setScheduleLocation(e.target.value)} placeholder="e.g., Main Chapel" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowScheduleModal(false); setScheduleTitle(''); setScheduleTime(''); setScheduleLocation(''); }}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(154,33,67,0.06)', color: 'var(--um-muted)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addScheduleEvent} disabled={!scheduleTime || !scheduleTitle.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: scheduleTime && scheduleTitle.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: scheduleTime && scheduleTitle.trim() ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: scheduleTime && scheduleTitle.trim() ? 'pointer' : 'default', boxShadow: scheduleTime && scheduleTitle.trim() ? '0 4px 14px rgba(154,33,67,0.3)' : 'none' }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {editingEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', width: '100%', maxWidth: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: 'var(--um-dark)', fontFamily: 'Georgia,serif' }}>Edit Schedule Event</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>TIME</label><input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>EVENT TITLE</label><input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inp} /></div>
              <div><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--um-muted)', letterSpacing: 1, marginBottom: 6 }}>LOCATION (OPTIONAL)</label><input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditingEvent(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: 'rgba(154,33,67,0.06)', color: 'var(--um-muted)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditEvent} disabled={!editTime || !editTitle.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: 14, background: editTime && editTitle.trim() ? `linear-gradient(135deg,${G},${G2})` : '#e8e0d0', color: editTime && editTitle.trim() ? '#fff' : '#9a8a70', fontSize: 14, fontWeight: 700, border: 'none', cursor: editTime && editTitle.trim() ? 'pointer' : 'default' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Post Confirmation ── */}
      {confirmDeletePostId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setConfirmDeletePostId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(224,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="26" height="26" fill="none" stroke="#e04444" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: DK, fontFamily: 'Georgia,serif' }}>Delete Post?</p>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: MUT, lineHeight: 1.5 }}>This will permanently remove your post and all its comments. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeletePostId(null)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', background: '#f9f6f2', color: DK, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { deletePost(confirmDeletePostId); setConfirmDeletePostId(null); }}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#e04444', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 12px rgba(224,68,68,0.35)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Comment Confirmation ── */}
      {confirmDeleteComment && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setConfirmDeleteComment(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: '24px 22px', maxWidth: 300, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: DK }}>Delete Comment?</p>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: MUT }}>This will permanently remove your comment.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeleteComment(null)}
                style={{ flex: 1, padding: 11, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', background: '#f9f6f2', color: DK, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { deleteComment(confirmDeleteComment.id, confirmDeleteComment.postId); setConfirmDeleteComment(null); }}
                style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: '#e04444', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Sheet Modal ── */}
      {sharePost && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Backdrop */}
          <div
            onClick={() => { setSharePost(null); setShareCopied(false); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
          />
          {/* Sheet */}
          <div style={{ position: 'relative', background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '0 20px 40px', zIndex: 1 }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(154,33,67,0.2)', margin: '16px auto 18px' }} />
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: DK, fontFamily: 'Georgia,serif' }}>Share Post</h3>

            {/* Post preview */}
            <div style={{ background: 'rgba(154,33,67,0.05)', borderRadius: 14, border: '1px solid rgba(154,33,67,0.12)', padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${G},${G2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{initials(sharePost.author)}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: DK }}>{sharePost.author}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#3a2030', lineHeight: 1.5 }}>
                {sharePost.content.length > 120 ? sharePost.content.slice(0, 120) + '…' : sharePost.content}
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={async () => {
                  const text = `${sharePost.author}: ${sharePost.content}`;
                  try { await navigator.clipboard.writeText(text); }
                  catch {
                    const el = document.createElement('textarea');
                    el.value = text; document.body.appendChild(el); el.select();
                    document.execCommand('copy'); document.body.removeChild(el);
                  }
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }}
                style={{ width: '100%', padding: '13px', borderRadius: 14, background: shareCopied ? '#3d9e6a' : 'rgba(154,33,67,0.07)', color: shareCopied ? '#fff' : DK, fontSize: 14, fontWeight: 700, border: `1.5px solid ${shareCopied ? '#3d9e6a' : 'rgba(154,33,67,0.15)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {shareCopied ? '✓ Copied!' : 'Copy Text'}
              </button>

              <button
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://umshado.co.za';
                  const text = encodeURIComponent(`${sharePost.author} on uMshado Community:\n\n${sharePost.content}\n\nJoin the community: ${origin}/live`);
                  const a = document.createElement('a');
                  a.href = `https://wa.me/?text=${text}`;
                  a.target = '_blank'; a.rel = 'noopener noreferrer';
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }}
                style={{ width: '100%', padding: '13px', borderRadius: 14, background: '#25d366', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Share on WhatsApp
              </button>
            </div>

            {/* Cancel */}
            <button
              onClick={() => { setSharePost(null); setShareCopied(false); }}
              style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'rgba(154,33,67,0.06)', color: MUT, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 10 }}>
              Cancel
            </button>
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
      <div style={{ minHeight: '100svh', background: 'var(--um-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(154,33,67,0.15)', borderTopColor: 'var(--um-crimson)', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    }>
      <LivePageContent />
    </Suspense>
  );
}
