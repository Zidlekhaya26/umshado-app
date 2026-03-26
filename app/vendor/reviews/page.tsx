'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import VendorBottomNav from '@/components/VendorBottomNav';
import { LoadingPage } from '@/components/ui/UmshadoLogo';
import { CR, CR2, GD, DK, MUT, BOR, BG } from '@/lib/tokens';

interface Review {
  id: string;
  vendor_id: string;
  couple_id: string;
  rating: number;
  review_text: string | null;
  vendor_reply: string | null;
  vendor_replied_at: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
  couples: { partner_name: string | null } | null;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          fill={i <= rating ? '#f59e0b' : '#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function reviewerName(r: Review): string {
  return r.profiles?.full_name || r.couples?.partner_name || 'uMshado Couple';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReplyModal({ review, onClose, onSaved }: {
  review: Review;
  onClose: () => void;
  onSaved: (id: string, reply: string) => void;
}) {
  const [text, setText] = useState(review.vendor_reply ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('vendor_reviews')
      .update({ vendor_reply: trimmed, vendor_replied_at: new Date().toISOString() })
      .eq('id', review.id);
    setSaving(false);
    if (err) {
      setError('Failed to save reply. Please try again.');
    } else {
      onSaved(review.id, trimmed);
      onClose();
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 540, background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: DK }}>Reply to review</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" fill="none" stroke={MUT} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: MUT }}>Replying to {reviewerName(review)} — {formatDate(review.created_at)}</p>

        <div style={{ background: '#faf8f5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: `1px solid ${BOR}` }}>
          <StarRow rating={review.rating} />
          {review.review_text && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: DK, lineHeight: 1.5 }}>"{review.review_text}"</p>
          )}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a professional, courteous reply…"
          maxLength={500}
          rows={4}
          style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${BOR}`, padding: '10px 12px', fontSize: 14, color: DK, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
        />
        <p style={{ margin: '4px 0 14px', fontSize: 11, color: MUT, textAlign: 'right' }}>{text.length}/500</p>

        {error && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: CR }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          style={{ width: '100%', padding: '13px', background: saving || !text.trim() ? '#ccc' : `linear-gradient(135deg,${CR2},${CR})`, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving || !text.trim() ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Post reply'}
        </button>
      </div>
    </div>
  );
}

function ReviewCard({ review, onReply }: { review: Review; onReply: (r: Review) => void }) {
  const name = reviewerName(review);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${BOR}`, padding: '16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${CR2},${CR})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DK }}>{name}</p>
            <p style={{ margin: 0, fontSize: 11, color: MUT }}>{formatDate(review.created_at)}</p>
          </div>
          <div style={{ marginTop: 4 }}>
            <StarRow rating={review.rating} />
          </div>
          {review.review_text && (
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#374151', lineHeight: 1.55 }}>{review.review_text}</p>
          )}
        </div>
      </div>

      {review.vendor_reply ? (
        <div style={{ marginTop: 14, background: '#faf8f5', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${CR}` }}>
          <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: CR, letterSpacing: 0.5, textTransform: 'uppercase' }}>Your reply</p>
          <p style={{ margin: 0, fontSize: 13, color: DK, lineHeight: 1.5 }}>{review.vendor_reply}</p>
          <button
            onClick={() => onReply(review)}
            style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MUT, padding: 0, textDecoration: 'underline' }}
          >
            Edit reply
          </button>
        </div>
      ) : (
        <button
          onClick={() => onReply(review)}
          style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1.5px solid ${BOR}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: CR, fontWeight: 600 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
          Reply
        </button>
      )}
    </div>
  );
}

export default function VendorReviewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<'all' | 'replied' | 'unreplied'>('all');
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!vendor) { router.replace('/vendor/onboarding'); return; }
      setVendorId(vendor.id);

      const { data } = await supabase
        .from('vendor_reviews')
        .select('*, profiles:couple_id(full_name), couples:couple_id(partner_name)')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      setReviews((data as Review[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function handleReplySaved(id: string, reply: string) {
    setReviews(prev => prev.map(r => r.id === id
      ? { ...r, vendor_reply: reply, vendor_replied_at: new Date().toISOString() }
      : r
    ));
  }

  const filtered = reviews.filter(r => {
    if (filter === 'replied') return !!r.vendor_reply;
    if (filter === 'unreplied') return !r.vendor_reply;
    return true;
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const repliedCount = reviews.filter(r => r.vendor_reply).length;

  if (loading) return <LoadingPage />;

  return (
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: 96 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${CR2},${CR})`, padding: '52px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>Reviews</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Client feedback</p>
          </div>
        </div>

        {/* Stats */}
        {reviews.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>{avgRating}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Avg rating</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>{reviews.length}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Total reviews</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>{repliedCount}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Replied</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all', 'unreplied', 'replied'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filter === tab ? CR : '#fff',
                color: filter === tab ? '#fff' : MUT,
                boxShadow: filter === tab ? `0 2px 8px ${CR}44` : '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {tab === 'all' ? `All (${reviews.length})` : tab === 'unreplied' ? `Needs reply (${reviews.filter(r => !r.vendor_reply).length})` : `Replied (${repliedCount})`}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3e8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" fill="none" stroke={CR} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DK }}>
              {filter === 'unreplied' ? 'All caught up' : filter === 'replied' ? 'No replied reviews yet' : 'No reviews yet'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: MUT }}>
              {filter === 'unreplied' ? 'You have replied to all reviews.' : 'Reviews from couples will appear here.'}
            </p>
          </div>
        )}

        {/* Review cards */}
        {filtered.map(review => (
          <ReviewCard key={review.id} review={review} onReply={setReplyTarget} />
        ))}
      </div>

      {/* Reply modal */}
      {replyTarget && (
        <ReplyModal
          review={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSaved={handleReplySaved}
        />
      )}

      <VendorBottomNav />
    </div>
  );
}
