'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import BottomNav from '@/components/BottomNav';

/* ─── Tokens ─────────────────────────────────────────────── */
const CR='#9A2143', CR2='#731832', GD='#BD983F', GD2='#8a6010';
const DK='#1a0d12', MUT='#7a5060', BG='#faf8f5', BOR='rgba(154,33,67,0.1)';
const GR='#1e7c4a', AM='#c67a2e';

/* ─── Types ─────────────────────────────────────────────── */
interface Booking {
  id: string; booking_ref: string; package_name: string;
  event_date: string | null; event_location: string | null;
  confirmed_price: number; status: 'confirmed' | 'completed' | 'cancelled';
  confirmed_at: string; vendor_name: string; vendor_logo: string | null;
  vendor_category: string; vendor_id: string; review_submitted: boolean;
}
type Tab = 'upcoming' | 'past';

/* ─── Helpers ─────────────────────────────────────────────── */
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
const daysUntil = (d: string) => {
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - t.getTime()) / 86400000);
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: 'Confirmed',  color: GR,  bg: 'rgba(30,124,74,0.09)',  border: 'rgba(30,124,74,0.22)' },
  completed: { label: 'Completed',  color: GD2, bg: 'rgba(184,151,62,0.09)', border: 'rgba(184,151,62,0.22)' },
  cancelled: { label: 'Cancelled',  color: CR,  bg: 'rgba(154,33,67,0.08)',  border: 'rgba(154,33,67,0.2)'  },
};

const CAT_ICONS: Record<string, string> = {
  'Catering & Food': '🍽️', 'Décor & Styling': '💐', 'Photography & Video': '📸',
  'Music, DJ & Sound': '🎵', 'Makeup & Hair': '💄', 'Attire & Fashion': '👗',
  'Wedding Venues': '🏛️', 'Transport': '🚗', 'Honeymoon & Travel': '✈️', 'Support Services': '🛡️',
};

/* ─── Review sheet ──────────────────────────────────────── */
function ReviewSheet({ booking, onClose, onDone }: {
  booking: Booking; onClose: () => void; onDone: () => void;
}) {
  const [rating, setRating]     = useState(0);
  const [hovered, setHovered]   = useState(0);
  const [text, setText]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const submit = async () => {
    if (!rating) { setErr('Please select a star rating'); return; }
    setSaving(true); setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('vendor_reviews').upsert({
        vendor_id: booking.vendor_id, couple_id: user.id,
        rating, review_text: text.trim() || null,
      }, { onConflict: 'vendor_id,couple_id' });
      if (error) throw error;
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Failed to submit review');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:50 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:60,background:'#fff',borderRadius:'24px 24px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'slideUp .25s ease' }}>
        <div style={{ width:40,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'20px 20px 28px' }}>
          <p style={{ margin:'0 0 4px',fontSize:17,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Leave a review</p>
          <p style={{ margin:'0 0 20px',fontSize:12,color:MUT }}>{booking.vendor_name}</p>

          {/* Stars */}
          <div style={{ display:'flex',gap:8,marginBottom:18,justifyContent:'center' }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setRating(s)}
                onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
                style={{ fontSize:38,background:'none',border:'none',cursor:'pointer',transition:'transform .1s',transform:(hovered||rating)>=s?'scale(1.15)':'scale(1)',opacity:(hovered||rating)>=s?1:0.28 }}>
                ★
              </button>
            ))}
          </div>
          <p style={{ textAlign:'center',fontSize:12,color:MUT,marginBottom:16,height:18 }}>
            {rating===1?'Poor':rating===2?'Fair':rating===3?'Good':rating===4?'Great':rating===5?'Excellent!':''}
          </p>

          <textarea value={text} onChange={e=>setText(e.target.value)}
            placeholder="Share your experience (optional)…"
            rows={3}
            style={{ width:'100%',borderRadius:12,border:`1.5px solid ${BOR}`,padding:'12px',fontSize:13,color:DK,resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit' }}
          />
          {err && <p style={{ color:CR,fontSize:12,marginTop:6 }}>{err}</p>}

          <button onClick={submit} disabled={saving} style={{ width:'100%',marginTop:14,padding:14,borderRadius:13,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:15,fontWeight:800,cursor:saving?'default':'pointer',opacity:saving?.7:1 }}>
            {saving ? 'Submitting…' : 'Submit Review ★'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Cancel confirmation ───────────────────────────────── */
function CancelSheet({ booking, onClose, onDone }: {
  booking: Booking; onClose: () => void; onDone: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const cancel = async () => {
    setCancelling(true);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    onDone();
  };
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:50 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:60,background:'#fff',borderRadius:'24px 24px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto' }}>
        <div style={{ width:40,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'20px 20px 28px' }}>
          <p style={{ margin:'0 0 8px',fontSize:17,fontWeight:800,color:CR,fontFamily:'Georgia,serif' }}>Cancel Booking?</p>
          <p style={{ margin:'0 0 6px',fontSize:13,color:DK,fontWeight:600 }}>{booking.vendor_name}</p>
          <p style={{ margin:'0 0 20px',fontSize:12,color:MUT }}>Ref: {booking.booking_ref} · {booking.event_date ? fmtDate(booking.event_date) : 'Date TBD'}</p>
          <p style={{ margin:'0 0 20px',fontSize:12,color:MUT,background:'rgba(154,33,67,0.06)',padding:'12px 14px',borderRadius:10,border:`1px solid ${BOR}` }}>
            ⚠️ Cancellations must be confirmed directly with the vendor. This only updates the status in your planner.
          </p>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={onClose} style={{ flex:1,padding:13,borderRadius:12,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:14,fontWeight:700,cursor:'pointer' }}>Keep</button>
            <button onClick={cancel} disabled={cancelling} style={{ flex:1,padding:13,borderRadius:12,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer' }}>
              {cancelling?'Cancelling…':'Yes, Cancel'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Booking card ──────────────────────────────────────── */
function BookingCard({ booking, onReview, onCancel, format }: {
  booking: Booking; onReview: () => void; onCancel: () => void;
  format: (n: number) => string;
}) {
  const days       = booking.event_date ? daysUntil(booking.event_date) : null;
  const st         = STATUS_STYLES[booking.status] || STATUS_STYLES.confirmed;
  const isUpcoming = booking.status === 'confirmed' && (days == null || days >= 0);
  const isPast     = booking.status === 'completed' || (days != null && days < 0);

  const countdownLabel = () => {
    if (days == null) return null;
    if (days === 0) return { text: '🎊 Today!', color: GD };
    if (days === 1) return { text: '⏳ Tomorrow', color: GD2 };
    if (days < 0)  return null;
    return { text: `${days} days away`, color: days < 14 ? AM : MUT };
  };
  const cd = countdownLabel();

  return (
    <div style={{ background:'#fff',borderRadius:20,overflow:'hidden',boxShadow:'0 2px 12px rgba(26,13,18,0.07)',border:`1.5px solid ${isUpcoming&&days!=null&&days<14?'rgba(189,152,63,0.35)':BOR}` }}>
      {/* Header stripe */}
      <div style={{ height:3,background:isUpcoming?`linear-gradient(90deg,${CR},${GD})`:`linear-gradient(90deg,#e0d8cc,#ccc)` }} />

      <div style={{ padding:'16px 18px' }}>
        {/* Vendor row */}
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14 }}>
          {booking.vendor_logo ? (
            <Image src={booking.vendor_logo} alt={booking.vendor_name}
              width={46} height={46}
              style={{ borderRadius:'50%',objectFit:'cover',border:`2px solid rgba(184,151,62,0.25)`,flexShrink:0 }} />
          ) : (
            <div style={{ width:46,height:46,borderRadius:'50%',background:`linear-gradient(135deg,${CR},${CR2})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:18,fontFamily:'Georgia,serif',flexShrink:0 }}>
              {booking.vendor_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ margin:'0 0 2px',fontSize:15,fontWeight:700,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'Georgia,serif' }}>{booking.vendor_name}</p>
            <div style={{ display:'flex',alignItems:'center',gap:5 }}>
              <span style={{ fontSize:12 }}>{CAT_ICONS[booking.vendor_category]??'🏢'}</span>
              <span style={{ fontSize:11,color:MUT }}>{booking.vendor_category}</span>
            </div>
          </div>
          <span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:st.bg,color:st.color,border:`1px solid ${st.border}`,flexShrink:0 }}>{st.label}</span>
        </div>

        {/* Details grid */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14 }}>
          <div style={{ background:BG,borderRadius:10,padding:'9px 12px' }}>
            <p style={{ margin:'0 0 2px',fontSize:9,color:MUT,fontWeight:700,letterSpacing:.5 }}>PACKAGE</p>
            <p style={{ margin:0,fontSize:12,fontWeight:600,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{booking.package_name}</p>
          </div>
          <div style={{ background:BG,borderRadius:10,padding:'9px 12px' }}>
            <p style={{ margin:'0 0 2px',fontSize:9,color:MUT,fontWeight:700,letterSpacing:.5 }}>PRICE</p>
            <p style={{ margin:0,fontSize:13,fontWeight:700,color:GD }}>{format(booking.confirmed_price / 100)}</p>
          </div>
          {booking.event_date && (
            <div style={{ background:BG,borderRadius:10,padding:'9px 12px' }}>
              <p style={{ margin:'0 0 2px',fontSize:9,color:MUT,fontWeight:700,letterSpacing:.5 }}>DATE</p>
              <p style={{ margin:0,fontSize:12,fontWeight:600,color:DK }}>{fmtDate(booking.event_date)}</p>
            </div>
          )}
          {booking.event_location && (
            <div style={{ background:BG,borderRadius:10,padding:'9px 12px' }}>
              <p style={{ margin:'0 0 2px',fontSize:9,color:MUT,fontWeight:700,letterSpacing:.5 }}>LOCATION</p>
              <p style={{ margin:0,fontSize:12,fontWeight:600,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{booking.event_location}</p>
            </div>
          )}
        </div>

        {/* Countdown chip */}
        {cd && (
          <div style={{ marginBottom:12,display:'flex',alignItems:'center',gap:6 }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:20,background:`rgba(184,151,62,0.08)`,border:`1px solid rgba(184,151,62,0.2)` }}>
              <span style={{ fontSize:11,fontWeight:700,color:cd.color }}>{cd.text}</span>
            </div>
          </div>
        )}

        {/* Ref */}
        <p style={{ margin:'0 0 14px',fontSize:10,color:'#b0a090' }}>Ref: {booking.booking_ref}</p>

        {/* Actions */}
        <div style={{ display:'flex',gap:8 }}>
          <Link href={`/messages?vendorId=${booking.vendor_id}`}
            style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px',borderRadius:11,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:12,fontWeight:700,textDecoration:'none' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Message
          </Link>
          {(isPast || booking.status === 'completed') && !booking.review_submitted ? (
            <button onClick={onReview} style={{ flex:1,padding:'10px',borderRadius:11,border:'none',background:`linear-gradient(135deg,${GD},${GD2})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              ★ Review
            </button>
          ) : booking.status === 'confirmed' && days != null && days >= 0 ? (
            <button onClick={onCancel} style={{ flex:1,padding:'10px',borderRadius:11,border:`1.5px solid rgba(154,33,67,0.2)`,background:'rgba(154,33,67,0.05)',color:CR,fontSize:12,fontWeight:700,cursor:'pointer' }}>
              Cancel
            </button>
          ) : booking.review_submitted ? (
            <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'10px',borderRadius:11,background:'rgba(30,124,74,0.07)',border:`1px solid rgba(30,124,74,0.2)` }}>
              <span style={{ fontSize:11,fontWeight:700,color:GR }}>✓ Reviewed</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function CoupleBookingsPage() {
  const router = useRouter();
  const { format } = useCurrency();
  const [loading, setLoading]       = useState(true);
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [tab, setTab]               = useState<Tab>('upcoming');
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showOk = (m: string) => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(null), 3000); };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/sign-in'); return; }
      await loadBookings(user.id);
      setLoading(false);
    })();
  }, [router]);

  const loadBookings = async (uid: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('id,booking_ref,package_name,event_date,event_location,confirmed_price,status,confirmed_at,vendor_id,couple_id')
      .eq('couple_id', uid)
      .order('event_date', { ascending: true, nullsFirst: false });

    if (!data) return;

    // Enrich with vendor info + review status
    const enriched = await Promise.all(data.map(async (b: any) => {
      const { data: v } = await supabase
        .from('vendors')
        .select('business_name,logo_url,category')
        .eq('id', b.vendor_id).maybeSingle();
      const { data: rev } = await supabase
        .from('vendor_reviews')
        .select('id')
        .eq('vendor_id', b.vendor_id)
        .eq('couple_id', uid)
        .maybeSingle();
      return {
        ...b,
        vendor_name: v?.business_name || 'Unknown Vendor',
        vendor_logo: v?.logo_url || null,
        vendor_category: v?.category || 'Other',
        review_submitted: !!rev,
      } as Booking;
    }));
    setBookings(enriched);
  };

  const upcomingList = useMemo(() =>
    bookings.filter(b =>
      b.status === 'confirmed' &&
      (b.event_date == null || daysUntil(b.event_date) >= 0)
    ), [bookings]);

  const pastList = useMemo(() =>
    bookings.filter(b =>
      b.status !== 'confirmed' ||
      (b.event_date != null && daysUntil(b.event_date) < 0)
    ), [bookings]);

  const displayList = tab === 'upcoming' ? upcomingList : pastList;

  const handleReviewDone = async () => {
    setReviewTarget(null);
    showOk('Review submitted — thank you! 🌟');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadBookings(user.id);
  };

  const handleCancelDone = async () => {
    setCancelTarget(null);
    showOk('Booking cancelled.');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadBookings(user.id);
  };

  return (
    <div style={{ minHeight:'100svh',background:BG,fontFamily:'system-ui,sans-serif' }}>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        button,a{font-family:inherit!important}
      `}</style>

      <div style={{ maxWidth:600,margin:'0 auto',paddingBottom:100 }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(160deg,#4d0f21 0%,${CR} 55%,#b8315a 100%)`,padding:'22px 20px 0',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-40,right:-40,width:150,height:150,borderRadius:'50%',background:'rgba(189,152,63,0.1)',pointerEvents:'none' }} />

          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:18 }}>
            <button onClick={() => router.back()} style={{ width:34,height:34,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 style={{ margin:0,fontSize:20,fontWeight:700,color:'#fff',fontFamily:'Georgia,serif' }}>My Bookings</h1>
              <p style={{ margin:0,fontSize:11,color:'rgba(255,255,255,0.65)' }}>Your confirmed wedding vendors</p>
            </div>
          </div>

          {/* Summary chips */}
          {!loading && (
            <div style={{ display:'flex',gap:8,marginBottom:14,flexWrap:'wrap' }}>
              <div style={{ padding:'5px 12px',borderRadius:20,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)' }}>
                <span style={{ fontSize:11,fontWeight:700,color:'#fff' }}>{upcomingList.length} upcoming</span>
              </div>
              <div style={{ padding:'5px 12px',borderRadius:20,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.18)' }}>
                <span style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.75)' }}>{pastList.length} past</span>
              </div>
              {bookings.length > 0 && (
                <div style={{ padding:'5px 12px',borderRadius:20,background:'rgba(189,152,63,0.25)',border:'1px solid rgba(189,152,63,0.35)' }}>
                  <span style={{ fontSize:11,fontWeight:700,color:'#ffd77a' }}>
                    {format(bookings.filter(b=>b.status!=='cancelled').reduce((s,b)=>s+b.confirmed_price/100,0))} total
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.12)' }}>
            {(['upcoming','past'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1,padding:'11px 0',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:tab===t?'#fff':'rgba(255,255,255,0.45)',borderBottom:tab===t?'2.5px solid #fff':'2.5px solid transparent',textTransform:'capitalize',letterSpacing:.2 }}>
                {t === 'upcoming' ? `Upcoming${upcomingList.length>0?' ('+upcomingList.length+')':''}` : `Past${pastList.length>0?' ('+pastList.length+')':''}`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:'14px 16px' }}>
          {loading ? (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ background:'#fff',borderRadius:20,height:220,animation:'fadeUp .4s ease both',animationDelay:i*.08+'s' }}>
                  <div style={{ height:3,background:'linear-gradient(90deg,#f0ebe4,#faf5ee,#f0ebe4)',backgroundSize:'400px 100%',animation:'fadeUp 1.4s linear infinite' }} />
                </div>
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center' }}>
              <div style={{ fontSize:56,marginBottom:14,opacity:.3 }}>{tab==='upcoming'?'📅':'📋'}</div>
              <p style={{ margin:'0 0 6px',fontSize:17,fontWeight:700,color:DK,fontFamily:'Georgia,serif' }}>
                {tab==='upcoming'?'No upcoming bookings':'No past bookings'}
              </p>
              <p style={{ margin:'0 0 22px',fontSize:13,color:MUT }}>
                {tab==='upcoming'?'Browse the marketplace to find and book your perfect vendors':'Your completed and cancelled bookings will appear here'}
              </p>
              {tab==='upcoming' && (
                <Link href="/marketplace" style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'12px 24px',borderRadius:14,background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontWeight:700,fontSize:14,textDecoration:'none',boxShadow:'0 4px 16px rgba(154,33,67,0.3)' }}>
                  🏪 Browse vendors
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {displayList.map((b,i) => (
                <div key={b.id} style={{ animation:'fadeUp .35s ease both',animationDelay:i*.06+'s' }}>
                  <BookingCard
                    booking={b} format={format}
                    onReview={() => setReviewTarget(b)}
                    onCancel={() => setCancelTarget(b)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {successMsg && (
        <div style={{ position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',background:DK,color:'#fff',padding:'12px 20px',borderRadius:14,fontSize:13,fontWeight:700,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',zIndex:80,whiteSpace:'nowrap',animation:'toastIn .25s ease' }}>
          {successMsg}
        </div>
      )}

      {/* Sheets */}
      {reviewTarget && <ReviewSheet booking={reviewTarget} onClose={() => setReviewTarget(null)} onDone={handleReviewDone} />}
      {cancelTarget && <CancelSheet booking={cancelTarget} onClose={() => setCancelTarget(null)} onDone={handleCancelDone} />}

      <BottomNav />
    </div>
  );
}
