'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Props {
  vendorId: string;
  vendorName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (rating: number, count: number) => void;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  couple_id: string;
  profiles: { full_name: string | null } | null;
  couples: { partner_name: string | null } | null;
}

function StarButton({ value, selected, hovered, onHover, onClick }: {
  value: number; selected: boolean; hovered: boolean;
  onHover: (v: number) => void; onClick: (v: number) => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(value)}
      onClick={() => onClick(value)}
      style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', transition: 'transform 0.1s' }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24"
        fill={selected || hovered ? '#f59e0b' : '#e5e7eb'}
        style={{ transform: (selected || hovered) ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s, fill 0.15s' }}
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function reviewerName(r: Review): string {
  return r.profiles?.full_name || r.couples?.partner_name || 'uMshado Couple';
}

export default function RateVendorSheet({ vendorId, vendorName, isOpen, onClose, onSaved }: Props) {
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rate' | 'reviews'>('rate');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSaved(false);
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);

      // Fetch current user's display name so anonymous reviews are blocked
      if (uid) {
        const [{ data: prof }, { data: couple }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
          supabase.from('couples').select('partner_name').eq('id', uid).maybeSingle(),
        ]);
        setUserName(prof?.full_name || couple?.partner_name || null);
      }

      const res = await fetch(`/api/vendor/${vendorId}/review${uid ? `?coupleId=${uid}` : ''}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setReviews(json.reviews ?? []);
        if (json.myReview) {
          setMyReview(json.myReview);
          setRating(json.myReview.rating);
          setReviewText(json.myReview.review_text ?? '');
        } else {
          setMyReview(null);
          setRating(0);
          setReviewText('');
        }
      }
      setLoading(false);
    })();
  }, [isOpen, vendorId]);

  const handleSave = async () => {
    if (!rating || saving) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/vendor/${vendorId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ rating, reviewText }),
    });
    if (res.ok) {
      setSaved(true);
      // Refresh reviews
      const get = await fetch(`/api/vendor/${vendorId}/review?coupleId=${userId}`);
      if (get.ok) {
        const json = await get.json();
        setReviews(json.reviews ?? []);
        setMyReview(json.myReview ?? null);
        const avg = json.reviews.length > 0
          ? json.reviews.reduce((s: number, r: Review) => s + r.rating, 0) / json.reviews.length
          : 0;
        onSaved(Math.round(avg * 10) / 10, json.reviews.length);
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove your review?')) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/vendor/${vendorId}/review`, {
      method: 'DELETE',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    setMyReview(null); setRating(0); setReviewText(''); setSaved(false);
    const get = await fetch(`/api/vendor/${vendorId}/review?coupleId=${userId}`);
    if (get.ok) {
      const json = await get.json();
      setReviews(json.reviews ?? []);
      const avg = json.reviews.length > 0
        ? json.reviews.reduce((s: number, r: Review) => s + r.rating, 0) / json.reviews.length
        : 0;
      onSaved(Math.round(avg * 10) / 10, json.reviews.length);
    }
    setDeleting(false);
  };

  if (!isOpen) return null;

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <button style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', width: '100%' }} onClick={onClose} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #f1f0ee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>
                Reviews
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{vendorName}</p>
            </div>
            {reviews.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                  {avgRating.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, background: '#f8f7f4', borderRadius: 10, padding: 3 }}>
            {(['rate', 'reviews'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#111827' : '#9ca3af',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {t === 'rate' ? (userId ? (myReview ? '✏️ My Review' : '⭐ Rate') : '⭐ Rate') : `💬 All Reviews (${reviews.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : tab === 'rate' ? (
            <>
              {!userId ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Sign in to leave a review</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>Only couples can rate vendors</p>
                </div>
              ) : !userName ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Add your name first</p>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
                    Reviews must show your name so vendors can identify feedback.<br/>Add your name in your profile to continue.
                  </p>
                  <a href="/couple/profile" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 10, background: '#9A2143', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    Update profile →
                  </a>
                </div>
              ) : (
                <div>
                  {/* Star selector */}
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textAlign: 'center' }}>
                    {myReview ? 'Update your rating' : 'How would you rate this vendor?'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }} onMouseLeave={() => setHovered(0)}>
                    {[1, 2, 3, 4, 5].map(v => (
                      <StarButton
                        key={v} value={v}
                        selected={v <= rating}
                        hovered={v <= hovered}
                        onHover={setHovered}
                        onClick={setRating}
                      />
                    ))}
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#f59e0b', minHeight: 20, marginBottom: 16 }}>
                    {RATING_LABELS[hovered || rating] || ''}
                  </p>

                  {/* Review text */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                    Your review (optional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    rows={3}
                    placeholder="Share your experience with this vendor…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px', borderRadius: 12,
                      border: '1.5px solid #e5e7eb', fontSize: 13, color: '#111827',
                      resize: 'none', outline: 'none', fontFamily: 'inherit',
                    }}
                  />

                  {/* Saved confirmation */}
                  {saved && (
                    <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                      ✅ Review saved! Thank you.
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    {myReview && (
                      <button onClick={handleDelete} disabled={deleting}
                        style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid #fca5a5', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                        {deleting ? '…' : 'Remove'}
                      </button>
                    )}
                    <button onClick={handleSave} disabled={!rating || saving}
                      style={{
                        flex: 2, height: 44, borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                        color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        opacity: (!rating || saving) ? 0.6 : 1,
                        boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                      }}>
                      {saving ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review ⭐'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* All reviews tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>No reviews yet</p>
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>Be the first to review this vendor</p>
                </div>
              ) : reviews.map(r => (
                <div key={r.id} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: r.couple_id === userId ? 'rgba(245,158,11,0.06)' : '#f8f7f4',
                  border: `1.5px solid ${r.couple_id === userId ? 'rgba(245,158,11,0.2)' : '#f1f0ee'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#302b63,#24243e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                      }}>
                        {reviewerName(r).charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {reviewerName(r)}
                        {r.couple_id === userId && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6 }}>(You)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 1 }}>
                      {[1,2,3,4,5].map(i => (
                        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= r.rating ? '#f59e0b' : '#e5e7eb'}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.review_text && (
                    <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{r.review_text}</p>
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#9ca3af' }}>
                    {new Date(r.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
