'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Post {
  id: string;
  user_id: string;
  author: string;
  category: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const TAG_COLORS: Record<string, string> = {
  Milestone: '#10b981', Question: '#f59e0b', Inspo: '#ec4899', Tip: '#06b6d4',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch('/api/admin/posts', {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setPosts(j.posts ?? []);
      setLoading(false);
    })();
  }, []);

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(postId);
    const token = await getToken();
    await fetch('/api/admin/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId }),
    });
    setPosts(prev => prev.filter(p => p.id !== postId));
    setDeleting(null);
  };

  const filtered = posts.filter(p =>
    !search || p.content.toLowerCase().includes(search.toLowerCase()) || p.author.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 36px', color: '#fff', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9A2143', letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</p>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, fontFamily: 'Georgia,serif' }}>Community Posts</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          {posts.length} posts total — delete inappropriate content
        </p>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by author or content..."
        style={{ width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#1a1a1a', color: '#fff', fontSize: 13, fontFamily: 'inherit', marginBottom: 20, boxSizing: 'border-box', outline: 'none' }}
      />

      {loading && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>No posts found</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(p => {
          const tagColor = TAG_COLORS[p.category] ?? '#9ca3af';
          return (
            <div key={p.id} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.author}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${tagColor}18`, color: tagColor, border: `1px solid ${tagColor}30` }}>
                    {p.category}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{timeAgo(p.created_at)}</span>
                </div>
                <button
                  onClick={() => deletePost(p.id)}
                  disabled={deleting === p.id}
                  style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: deleting === p.id ? 0.5 : 1 }}>
                  {deleting === p.id ? '...' : 'Delete'}
                </button>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{p.content}</p>
              {p.image_url && (
                <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', maxWidth: 400 }}>
                  <img src={p.image_url} alt="Post" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>{p.likes_count} likes</span>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>{p.comments_count} comments</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
