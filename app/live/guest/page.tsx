'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';


// ─── Types ───────────────────────────────────────────────

interface ScheduleEvent {
  id: string; title: string; time: string; location: string | null; sort_order: number;
}
interface WellWish {
  id: string; guest_name: string; message: string; created_at: string;
}
interface Moment {
  id: string; guest_name: string; caption: string | null; media_url: string | null; created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────

const formatTime12h = (time24: string): string => {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

function initials(name: string) {
  return name.trim().split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

// ─── Shared styles ────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: `1.5px solid ${BOR}`,
  borderRadius: 12, fontSize: 14, outline: 'none', background: BG,
  color: DK, boxSizing: 'border-box', fontFamily: 'inherit',
};

// ─── Main Guest Content ─────────────────────────────────

function GuestPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [coupleNames, setCoupleNames] = useState('The Happy Couple');
  const [schedule, setSchedule]     = useState<ScheduleEvent[]>([]);
  const [wishes, setWishes]         = useState<WellWish[]>([]);
  const [moments, setMoments]       = useState<Moment[]>([]);
  const [guestName, setGuestName]   = useState('');
  const [nameSet, setNameSet]       = useState(false);
  const [wishMessage, setWishMessage] = useState('');
  const [sendingWish, setSendingWish] = useState(false);
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [momentCaption, setMomentCaption]   = useState('');
  const [momentUrl, setMomentUrl]           = useState('');
  const [sendingMoment, setSendingMoment]   = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'wishes' | 'moments'>('schedule');
  const [wishSent, setWishSent]   = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('umshado_guest_name');
      if (saved) { setGuestName(saved); setNameSet(true); }
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/live/guest?token=${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid or expired link');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCoupleNames(data.couple?.names || 'The Happy Couple');
      const loadedSchedule = data.schedule || [];
      setSchedule(loadedSchedule);
      setWishes(data.wishes || []);
      setMoments(data.moments || []);
      if (loadedSchedule.length === 0) setActiveTab('wishes');
    } catch {
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveGuestName = () => {
    if (!guestName.trim()) return;
    try { localStorage.setItem('umshado_guest_name', guestName.trim()); } catch { /* ignore */ }
    setNameSet(true);
  };

  const sendWish = async () => {
    if (!wishMessage.trim() || !token || sendingWish) return;
    setSendingWish(true);
    try {
      const res = await fetch('/api/live/wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, guest_name: guestName, message: wishMessage.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWishes(prev => [data.wish, ...prev]);
        setWishMessage('');
        setWishSent(true);
        setTimeout(() => setWishSent(false), 3000);
      }
    } catch { /* ignore */ } finally {
      setSendingWish(false);
    }
  };

  const sendMoment = async () => {
    if ((!momentCaption.trim() && !momentUrl.trim()) || !token || sendingMoment) return;
    setSendingMoment(true);
    try {
      const res = await fetch('/api/live/moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, guest_name: guestName, caption: momentCaption.trim() || null, media_url: momentUrl.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setMoments(prev => [data.moment, ...prev]);
        setMomentCaption(''); setMomentUrl(''); setShowMomentForm(false);
      }
    } catch { /* ignore */ } finally {
      setSendingMoment(false);
    }
  };

  // ─── No token ──────────────────────────────────────────

  if (!token) return (
    <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{'@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}'}</style>
      <div style={{ background:'#fff', borderRadius:24, padding:'36px 28px', maxWidth:380, width:'100%', textAlign:'center', boxShadow:'0 8px 40px rgba(26,13,18,0.1)', border:`1.5px solid ${BOR}`, animation:'fadeUp 0.35s ease-out' }}>
        <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(154,33,67,0.08)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="28" height="28" fill="none" stroke={CR} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
        </div>
        <h1 style={{ margin:'0 0 8px', fontSize:20, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Link Not Found</h1>
        <p style={{ margin:0, fontSize:14, color:MUT, lineHeight:1.6 }}>This guest link appears to be missing or invalid. Ask the couple to share the link again.</p>
      </div>
    </div>
  );

  // ─── Loading ───────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width:44, height:44, borderRadius:'50%', border:`3px solid rgba(154,33,67,0.1)`, borderTopColor:CR, animation:'spin 0.8s linear infinite' }} />
      <p style={{ margin:0, fontSize:14, color:MUT, fontWeight:600 }}>Preparing your celebration...</p>
    </div>
  );

  // ─── Error ─────────────────────────────────────────────

  if (error) return (
    <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:24, padding:'36px 28px', maxWidth:380, width:'100%', textAlign:'center', boxShadow:'0 8px 40px rgba(26,13,18,0.1)', border:`1.5px solid ${BOR}` }}>
        <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(192,50,42,0.08)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="28" height="28" fill="none" stroke="#c0322a" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/></svg>
        </div>
        <h1 style={{ margin:'0 0 8px', fontSize:20, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Something Went Wrong</h1>
        <p style={{ margin:'0 0 20px', fontSize:14, color:MUT }}>{error}</p>
        <button onClick={loadData} style={{ padding:'11px 28px', borderRadius:12, background:`linear-gradient(135deg,${CR},${CR2})`, color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer' }}>Try Again</button>
      </div>
    </div>
  );

  // ─── Name entry ────────────────────────────────────────

  if (!nameSet) return (
    <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{'@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}'}</style>
      <div style={{ maxWidth:400, width:'100%', animation:'fadeUp 0.4s ease-out' }}>
        {/* Invitation header */}
        <div style={{ background:`linear-gradient(160deg,${CRX} 0%,${CR} 60%,var(--um-crimson-mid) 100%)`, borderRadius:'24px 24px 0 0', padding:'40px 28px 36px', textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(189,152,63,0.12)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GD},transparent)` }} />
          <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="26" height="26" fill="none" stroke="#fff" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          </div>
          <p style={{ margin:'0 0 6px', fontSize:11, color:'rgba(255,255,255,0.55)', letterSpacing:3, textTransform:'uppercase' }}>You&apos;re invited</p>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, color:'#fff', fontFamily:'Georgia,serif', lineHeight:1.25 }}>{coupleNames}</h1>
          <p style={{ margin:'8px 0 0', fontSize:13, color:'rgba(255,255,255,0.7)' }}>Welcome to the celebration</p>
        </div>

        {/* Name form */}
        <div style={{ background:'#fff', borderRadius:'0 0 24px 24px', padding:'28px 28px 32px', boxShadow:'0 12px 40px rgba(26,13,18,0.1)', border:`1.5px solid ${BOR}`, borderTop:'none' }}>
          <p style={{ margin:'0 0 20px', fontSize:14, color:MUT, lineHeight:1.6, textAlign:'center' }}>
            Let the couple know you&apos;re here. Enter your name to view the schedule, send wishes, and share moments.
          </p>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:MUT, letterSpacing:1, marginBottom:8 }}>YOUR NAME</label>
          <input
            type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
            placeholder="e.g., Thabo Mokoena"
            style={{ ...inp, marginBottom:16 }}
            onKeyDown={e => e.key === 'Enter' && saveGuestName()}
            autoFocus
          />
          <button onClick={saveGuestName} disabled={!guestName.trim()}
            style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', fontSize:15, fontWeight:800, cursor: guestName.trim() ? 'pointer' : 'default',
              background: guestName.trim() ? `linear-gradient(135deg,${CR},${CR2})` : '#e8e0d0',
              color: guestName.trim() ? '#fff' : '#9a8a70',
              boxShadow: guestName.trim() ? '0 4px 18px rgba(154,33,67,0.3)' : 'none' }}>
            Enter the Celebration
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Main guest UI ─────────────────────────────────────

  const tabs = [
    { key: 'schedule' as const, label: 'Schedule', icon: '🗓' },
    { key: 'wishes'   as const, label: 'Wishes',   icon: '💌' },
    { key: 'moments'  as const, label: 'Moments',  icon: '📸' },
  ];

  return (
    <div style={{ minHeight:'100svh', background:BG, fontFamily:'system-ui,sans-serif' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}'}</style>

      {/* ── Header ── */}
      <div style={{ background:`linear-gradient(160deg,${CRX} 0%,${CR} 55%,var(--um-crimson-mid) 100%)`, padding:'24px 20px 20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'rgba(189,152,63,0.1)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GD},transparent)` }} />
        <div style={{ position:'relative' }}>
          <p style={{ margin:'0 0 4px', fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:3, textTransform:'uppercase' }}>Celebrating</p>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#fff', fontFamily:'Georgia,serif', lineHeight:1.2 }}>{coupleNames}</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'rgba(255,255,255,0.75)' }}>Welcome, <span style={{ fontWeight:700, color:`rgba(189,152,63,0.95)` }}>{guestName}</span></p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background:'#fff', borderBottom:`1px solid ${BOR}`, padding:'10px 16px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(26,13,18,0.05)' }}>
        <div style={{ display:'flex', gap:8 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ flex:1, padding:'9px 4px', borderRadius:12, fontSize:12, fontWeight:700, border:'none', cursor:'pointer', transition:'all 0.15s',
                background: activeTab === tab.key ? `linear-gradient(135deg,${CR},${CR2})` : `rgba(154,33,67,0.07)`,
                color: activeTab === tab.key ? '#fff' : MUT,
                boxShadow: activeTab === tab.key ? '0 3px 10px rgba(154,33,67,0.25)' : 'none' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 16px 40px' }}>

        {/* ═══ SCHEDULE ═══ */}
        {activeTab === 'schedule' && (
          <div style={{ animation:'fadeUp 0.25s ease-out' }}>
            <p style={{ margin:'0 0 14px', fontSize:16, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Wedding Day Schedule</p>
            {schedule.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:20, border:`2px dashed rgba(154,33,67,0.25)`, padding:'44px 20px', textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🗓</div>
                <p style={{ margin:0, fontSize:15, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Schedule coming soon</p>
                <p style={{ margin:'6px 0 0', fontSize:13, color:MUT }}>The schedule hasn&apos;t been added yet.</p>
              </div>
            ) : (
              <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 16px rgba(26,13,18,0.07)', border:`1.5px solid ${BOR}` }}>
                {schedule.map((item, index) => (
                  <div key={item.id} style={{ display:'flex', gap:14, padding:'16px 18px', borderBottom: index !== schedule.length - 1 ? `1px solid ${BOR}` : 'none' }}>
                    {/* Time + connector */}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, width:64 }}>
                      <div style={{ padding:'5px 8px', background:'rgba(154,33,67,0.08)', borderRadius:10, border:`1px solid rgba(154,33,67,0.2)`, textAlign:'center', width:'100%' }}>
                        <span style={{ fontSize:11, fontWeight:800, color:CR2 }}>{formatTime12h(item.time)}</span>
                      </div>
                      {index !== schedule.length - 1 && (
                        <div style={{ width:2, flex:1, background:`linear-gradient(to bottom,rgba(154,33,67,0.3),rgba(154,33,67,0.08))`, marginTop:6, minHeight:20 }} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, paddingTop:2 }}>
                      <p style={{ margin:0, fontSize:14, fontWeight:700, color:DK }}>{item.title}</p>
                      {item.location && (
                        <p style={{ margin:'4px 0 0', fontSize:12, color:MUT, display:'flex', alignItems:'center', gap:4 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          {item.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ WELL WISHES ═══ */}
        {activeTab === 'wishes' && (
          <div style={{ animation:'fadeUp 0.25s ease-out' }}>
            <p style={{ margin:'0 0 14px', fontSize:16, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Send Your Wishes</p>

            {/* Compose */}
            <div style={{ background:'#fff', borderRadius:20, padding:'18px', marginBottom:16, boxShadow:'0 2px 16px rgba(26,13,18,0.07)', border:`1.5px solid ${BOR}` }}>
              {wishSent ? (
                <div style={{ textAlign:'center', padding:'12px 0', animation:'popIn 0.25s ease-out' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💌</div>
                  <p style={{ margin:0, fontSize:15, fontWeight:700, color:CR, fontFamily:'Georgia,serif' }}>Wish Sent!</p>
                  <p style={{ margin:'4px 0 0', fontSize:13, color:MUT }}>The couple will treasure your message.</p>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${CR},${CR2})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{initials(guestName)}</span>
                    </div>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:DK }}>{guestName}</p>
                  </div>
                  <textarea
                    value={wishMessage} onChange={e => setWishMessage(e.target.value)}
                    placeholder="Write your congratulations, blessings, or a memory with the couple..."
                    rows={3}
                    style={{ ...inp, resize:'none', lineHeight:1.6, marginBottom:12 }}
                  />
                  <button onClick={sendWish} disabled={!wishMessage.trim() || sendingWish}
                    style={{ width:'100%', padding:'12px', borderRadius:13, border:'none', fontSize:14, fontWeight:800, cursor: wishMessage.trim() && !sendingWish ? 'pointer' : 'default',
                      background: wishMessage.trim() && !sendingWish ? `linear-gradient(135deg,${CR},${CR2})` : '#e8e0d0',
                      color: wishMessage.trim() && !sendingWish ? '#fff' : '#9a8a70',
                      boxShadow: wishMessage.trim() ? '0 4px 14px rgba(154,33,67,0.25)' : 'none' }}>
                    {sendingWish ? 'Sending...' : 'Send Wish'}
                  </button>
                </>
              )}
            </div>

            {/* Wishes feed */}
            {wishes.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:20, border:`2px dashed rgba(154,33,67,0.25)`, padding:'40px 20px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>💌</div>
                <p style={{ margin:0, fontSize:15, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Be the first!</p>
                <p style={{ margin:'6px 0 0', fontSize:13, color:MUT }}>Send your wishes above and they&apos;ll appear here.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {wishes.map(wish => (
                  <div key={wish.id} style={{ background:'#fff', borderRadius:18, border:`1.5px solid ${BOR}`, padding:'14px 16px', boxShadow:'0 1px 8px rgba(26,13,18,0.05)', animation:'fadeUp 0.2s ease-out' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(154,33,67,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid rgba(154,33,67,0.2)` }}>
                        <span style={{ fontSize:12, fontWeight:700, color:CR2 }}>{initials(wish.guest_name)}</span>
                      </div>
                      <div>
                        <p style={{ margin:0, fontSize:13, fontWeight:700, color:DK }}>{wish.guest_name}</p>
                        <p style={{ margin:0, fontSize:11, color:MUT }}>{timeAgo(wish.created_at)}</p>
                      </div>
                    </div>
                    <p style={{ margin:0, fontSize:14, color:DK, lineHeight:1.65, paddingLeft:46 }}>{wish.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ MOMENTS ═══ */}
        {activeTab === 'moments' && (
          <div style={{ animation:'fadeUp 0.25s ease-out' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <p style={{ margin:0, fontSize:16, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Moments</p>
              <button onClick={() => setShowMomentForm(!showMomentForm)}
                style={{ padding:'8px 18px', borderRadius:20, border:`1.5px solid ${BOR}`, background: showMomentForm ? 'rgba(154,33,67,0.08)' : `linear-gradient(135deg,${CR},${CR2})`, color: showMomentForm ? CR : '#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {showMomentForm ? 'Cancel' : '+ Share'}
              </button>
            </div>

            {/* Moment form */}
            {showMomentForm && (
              <div style={{ background:'#fff', borderRadius:20, padding:'18px', marginBottom:16, boxShadow:'0 2px 16px rgba(26,13,18,0.07)', border:`1.5px solid rgba(154,33,67,0.25)`, animation:'fadeUp 0.2s ease-out' }}>
                <p style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:DK }}>Share a moment</p>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:MUT, letterSpacing:.8, marginBottom:6 }}>CAPTION</label>
                <input type="text" value={momentCaption} onChange={e => setMomentCaption(e.target.value)}
                  placeholder="What's happening?" style={{ ...inp, marginBottom:12 }} />
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:MUT, letterSpacing:.8, marginBottom:6 }}>PHOTO URL (optional)</label>
                <input type="url" value={momentUrl} onChange={e => setMomentUrl(e.target.value)}
                  placeholder="https://..." style={{ ...inp, marginBottom:16 }} />
                <button onClick={sendMoment} disabled={(!momentCaption.trim() && !momentUrl.trim()) || sendingMoment}
                  style={{ width:'100%', padding:'12px', borderRadius:13, border:'none', fontSize:14, fontWeight:800,
                    cursor: (momentCaption.trim() || momentUrl.trim()) && !sendingMoment ? 'pointer' : 'default',
                    background: (momentCaption.trim() || momentUrl.trim()) && !sendingMoment ? `linear-gradient(135deg,${CR},${CR2})` : '#e8e0d0',
                    color: (momentCaption.trim() || momentUrl.trim()) ? '#fff' : '#9a8a70' }}>
                  {sendingMoment ? 'Sharing...' : 'Share Moment'}
                </button>
              </div>
            )}

            {/* Moments feed */}
            {moments.length === 0 && !showMomentForm ? (
              <div style={{ background:'#fff', borderRadius:20, border:`2px dashed rgba(154,33,67,0.25)`, padding:'44px 20px', textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📸</div>
                <p style={{ margin:0, fontSize:15, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>No moments yet</p>
                <p style={{ margin:'6px 0 0', fontSize:13, color:MUT }}>Tap &quot;+ Share&quot; to capture this day.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {moments.map(moment => (
                  <div key={moment.id} style={{ background:'#fff', borderRadius:18, border:`1.5px solid ${BOR}`, overflow:'hidden', boxShadow:'0 2px 12px rgba(26,13,18,0.06)' }}>
                    {moment.media_url && (
                      <div style={{ background:'rgba(154,33,67,0.04)', maxHeight:280, overflow:'hidden' }}>
                        <img src={moment.media_url} alt={moment.caption || 'Moment'}
                          style={{ width:'100%', maxHeight:280, objectFit:'cover', display:'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                    <div style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: moment.caption ? 6 : 0 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(154,33,67,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:CR2 }}>{initials(moment.guest_name)}</span>
                        </div>
                        <p style={{ margin:0, fontSize:13, fontWeight:700, color:DK }}>{moment.guest_name}</p>
                        <p style={{ margin:0, fontSize:11, color:MUT, marginLeft:'auto' }}>{timeAgo(moment.created_at)}</p>
                      </div>
                      {moment.caption && <p style={{ margin:0, fontSize:13, color:DK, lineHeight:1.6, paddingLeft:38 }}>{moment.caption}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign:'center', padding:'12px 0 24px', borderTop:`1px solid ${BOR}` }}>
        <p style={{ margin:0, fontSize:11, color:MUT }}>Powered by <span style={{ fontWeight:700, color:CR }}>uMshado</span></p>
      </div>
    </div>
  );
}

export default function GuestLivePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100svh', background:'var(--um-ivory)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'3px solid rgba(154,33,67,0.1)', borderTopColor:'var(--um-crimson)', animation:'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        <p style={{ margin:0, fontSize:14, color:'var(--um-muted)', fontWeight:600 }}>Loading...</p>
      </div>
    }>
      <GuestPageContent />
    </Suspense>
  );
}
