'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import BottomNav from '@/components/BottomNav';
import WeddingWebsiteSettings from '@/components/WeddingWebsiteSettings';
import { supabase } from '@/lib/supabaseClient';

/* ─── Types ──────────────────────────────────────────────── */
interface DbTask { id: string; couple_id: string; title: string; due_date: string | null; is_done: boolean; created_at: string; }
interface DbBudgetItem { id: string; couple_id: string; title: string; amount: number; amount_paid: number; category: string | null; status: 'planned' | 'partial' | 'paid'; created_at: string; }
interface RecentQuote { id: string; quote_ref: string; vendor_id: string; package_name: string; status: string; created_at: string; vendor_name: string; }
interface DbGuest { id: string; couple_id: string; full_name: string; rsvp_status: 'pending' | 'accepted' | 'declined'; }
interface CoupleProfile {
  partner_name: string | null;
  wedding_date: string | null;
  location: string | null;
  avatar_url: string | null;
  wedding_theme: string | null;
  gift_enabled: boolean | null;
  gift_message: string | null;
  gift_items: any[];
  how_we_met: string | null;
  proposal_story: string | null;
  couple_message: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────── */
const daysUntil = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); return Math.max(0, Math.ceil((new Date(d+'T00:00:00').getTime() - t.getTime()) / 86400000)); };
const fmtDate   = (d: string) => new Date(d+'T00:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' });
const fmtShort  = (d: string) => new Date(d+'T00:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'short' });

/* ─── Tokens ──────────────────────────────────────────────── */
const G = '#b8973e', G2 = '#8a6010', DARK = '#18100a', MID = '#5c3d28', LITE = '#8a6e4a', BG = '#faf7f2';
const GRN = '#2d7a4f', BLU = '#1a6aa8', RED = '#c83232';

/* ─── SVG Donut ───────────────────────────────────────────── */
function Donut({ pct, size=80, sw=8, color=G, track='rgba(184,151,62,0.12)', children }: {
  pct:number; size?:number; sw?:number; color?:string; track?:string; children?:React.ReactNode;
}) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct / 100, 1));
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Task row with inline toggle ────────────────────────── */
function TaskRow({ task, onToggle }: { task:DbTask; onToggle:(id:string,done:boolean)=>void }) {
  const overdue = !task.is_done && task.due_date && new Date(task.due_date+'T23:59:59') < new Date();
  return (
    <button onClick={() => onToggle(task.id, !task.is_done)}
      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12,
        background: task.is_done ? 'rgba(45,122,79,0.04)' : 'rgba(184,151,62,0.04)',
        border:`1px solid ${task.is_done ? 'rgba(45,122,79,0.12)' : 'rgba(184,151,62,0.12)'}`,
        cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
      {/* Checkbox */}
      <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, transition:'all 0.15s',
        background: task.is_done ? GRN : 'transparent',
        border:`2px solid ${task.is_done ? GRN : 'rgba(184,151,62,0.4)'}`,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {task.is_done && <svg width="11" height="11" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
      </div>
      <span style={{ flex:1, fontSize:13, color: task.is_done ? LITE : DARK, fontWeight: task.is_done ? 400 : 600,
        textDecoration: task.is_done ? 'line-through' : 'none',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
      {task.due_date && (
        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, flexShrink:0,
          background: overdue ? 'rgba(200,50,50,0.1)' : 'rgba(184,151,62,0.08)',
          color: overdue ? RED : LITE }}>
          {overdue && '⚠ '}{fmtShort(task.due_date)}
        </span>
      )}
    </button>
  );
}

/* ─── Quote badge ─────────────────────────────────────────── */
function QBadge({ status }: { status:string }) {
  const map: Record<string,{bg:string;color:string;label:string}> = {
    accepted:    { bg:'rgba(45,122,79,0.1)',  color:GRN, label:'Accepted' },
    negotiating: { bg:'rgba(26,106,168,0.1)', color:BLU, label:'Negotiating' },
    requested:   { bg:'rgba(184,151,62,0.1)', color:G2,  label:'Pending' },
    declined:    { bg:'rgba(200,50,50,0.1)',  color:RED, label:'Declined' },
  };
  const s = map[status] ?? { bg:'#f5f5f5', color:'#888', label:status };
  return <span style={{ padding:'3px 10px', borderRadius:20, background:s.bg, color:s.color, fontSize:10, fontWeight:700, flexShrink:0, textTransform:'capitalize' }}>{s.label}</span>;
}

/* ─── Smart milestone timeline ────────────────────────────── */
const MILESTONES = [
  { days:365, icon:'🏛️', label:'Book venue', sub:'Sets your capacity & style' },
  { days:300, icon:'📸', label:'Book photographer', sub:'Top ones fill fast' },
  { days:240, icon:'🍽️', label:'Book catering', sub:'Confirm guest numbers' },
  { days:180, icon:'💌', label:'Send invitations', sub:'Allow RSVP time' },
  { days:120, icon:'👗', label:'Dress fittings', sub:'Allow alteration time' },
  { days:90,  icon:'💄', label:'Hair & makeup trial', sub:'Test your wedding look' },
  { days:60,  icon:'🎵', label:'Finalise playlist', sub:'Share with DJ or band' },
  { days:30,  icon:'💍', label:'Final fittings', sub:'All attire confirmed' },
  { days:14,  icon:'🗺️', label:'Confirm seating plan', sub:'Send to caterer' },
  { days:7,   icon:'✅', label:'Final vendor calls', sub:'Confirm arrival times' },
];

function MilestoneTimeline({ daysLeft }: { daysLeft:number }) {
  const upcoming = MILESTONES.filter(m => m.days >= daysLeft - 7 && m.days <= daysLeft + 60).slice(0,3);
  if (!upcoming.length) return null;
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:'18px 18px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1.5px solid rgba(0,0,0,0.05)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <p style={{ margin:0, fontSize:15, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)' }}>📅 What to book next</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {upcoming.map((m, i) => {
          const diff = m.days - daysLeft;
          const done = diff < -7;
          const now  = Math.abs(diff) <= 7;
          return (
            <div key={m.label} style={{ display:'flex', alignItems:'center', gap:12, opacity: done ? 0.4 : 1 }}>
              <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                background: now ? `${G}18` : done ? '#f5f5f5' : 'rgba(184,151,62,0.06)',
                border:`1.5px solid ${now ? `${G}40` : 'rgba(0,0,0,0.06)'}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{m.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:'0 0 1px', fontSize:13, fontWeight:700, color:DARK }}>{m.label}</p>
                <p style={{ margin:0, fontSize:11, color: now ? G : LITE }}>{m.sub}</p>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                {done
                  ? <span style={{ fontSize:10, color:GRN, fontWeight:700 }}>✓ Done</span>
                  : now
                  ? <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${G}18`, color:G2 }}>NOW</span>
                  : <span style={{ fontSize:10, color:LITE, fontWeight:600 }}>{diff > 0 ? `in ~${diff}d` : 'overdue'}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Dynamic planning tip ────────────────────────────────── */
function PlanningTip({ daysLeft }: { daysLeft:number|null }) {
  const tips = [
    { max:30,  icon:'🏁', msg:"You're almost there! Do a final vendor run-through and enjoy every moment." },
    { max:60,  icon:'📋', msg:'Chase any outstanding RSVPs and finalise your seating plan now.' },
    { max:90,  icon:'💌', msg:'Send your final guest confirmations and share the event schedule.' },
    { max:180, icon:'📸', msg:'Confirm all major vendors with signed contracts and deposit receipts.' },
    { max:270, icon:'✉️', msg:'Send save-the-dates now — international guests need at least 6 months notice.' },
    { max:365, icon:'🏛️', msg:'Venue is your anchor. Book it first — it dictates the date, size and style for everything else.' },
    { max:9999,icon:'💍', msg:'Start big: venue and photographer should be your first two bookings, ideally 12+ months out.' },
  ];
  const tip = daysLeft !== null ? tips.find(t => daysLeft <= t.max) ?? tips[tips.length-1] : tips[tips.length-1];
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:'16px 18px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:`1.5px solid ${G}28`, display:'flex', alignItems:'flex-start', gap:14 }}>
      <div style={{ width:42, height:42, borderRadius:12, background:'rgba(184,151,62,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{tip.icon}</div>
      <div>
        <p style={{ margin:'0 0 3px', fontSize:13, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)' }}>Planning tip</p>
        <p style={{ margin:0, fontSize:12, color:MID, lineHeight:1.65 }}>{tip.msg}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function CoupleDashboard() {
  const [userId, setUserId]               = useState<string|null>(null);
  const [loaded, setLoaded]               = useState(false);
  const [coupleProfile, setCoupleProfile] = useState<CoupleProfile|null>(null);
  const [userName, setUserName]           = useState<string|null>(null);
  const [tasks, setTasks]                 = useState<DbTask[]>([]);
  const [budgetItems, setBudgetItems]     = useState<DbBudgetItem[]>([]);
  const [guests, setGuests]               = useState<DbGuest[]>([]);
  const [recentQuotes, setRecentQuotes]   = useState<RecentQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [editDate, setEditDate]           = useState('');
  const [savingDate, setSavingDate]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { format } = useCurrency();

  /* ── Load data ──────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); setLoadingQuotes(false); return; }
      setUserId(user.id);
      const authName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || null;
      const [profileRes, coupleRes, tasksRes, budgetRes, guestsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase.from('couples').select('partner_name,wedding_date,location,avatar_url,wedding_theme,gift_enabled,gift_message,gift_items,how_we_met,proposal_story,couple_message').eq('id', user.id).maybeSingle(),
        supabase.from('couple_tasks').select('*').eq('couple_id', user.id).order('due_date', { ascending:true, nullsFirst:false }),
        supabase.from('couple_budget_items').select('*').eq('couple_id', user.id).order('created_at'),
        supabase.from('couple_guests').select('id,couple_id,full_name,rsvp_status').eq('couple_id', user.id),
      ]);
      setUserName(profileRes.data?.full_name || authName);
      if (coupleRes.data) setCoupleProfile(coupleRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (budgetRes.data) setBudgetItems(budgetRes.data.map((i: any) => ({ ...i, amount_paid: i.amount_paid ?? 0 })));
      if (guestsRes.data) setGuests(guestsRes.data);
      setLoaded(true);
      try {
        const { data, error } = await supabase.from('quotes').select('id,quote_ref,vendor_id,package_name,status,created_at').eq('couple_id', user.id).order('created_at', { ascending:false }).limit(4);
        if (!error && data) {
          const withNames = await Promise.all(data.map(async (q: any) => {
            const { data: v } = await supabase.from('vendors').select('business_name').eq('id', q.vendor_id).maybeSingle();
            return { ...q, vendor_name: v?.business_name || 'Vendor' } as RecentQuote;
          }));
          setRecentQuotes(withNames);
        }
      } catch {} finally { setLoadingQuotes(false); }
    })();
  }, []);

  /* ── Toggle task ────────────────────────────────────────── */
  const toggleTask = async (id: string, done: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_done: done } : t));
    await supabase.from('couple_tasks').update({ is_done: done }).eq('id', id);
  };

  /* ── Derived ────────────────────────────────────────────── */
  const totalTasks  = tasks.length;
  const doneTasks   = tasks.filter(t => t.is_done).length;
  const pct         = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const pendingTasks= tasks.filter(t => !t.is_done).slice(0, 3);
  const extraTasks  = tasks.filter(t => !t.is_done).length - 3;
  const totalBudget = budgetItems.reduce((s,b) => s + Number(b.amount), 0);
  const totalPaid   = budgetItems.reduce((s,b) => s + Number(b.amount_paid||0), 0);
  const budgetPct   = totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0;
  const totalGuests = guests.length;
  const gAccepted   = guests.filter(g => g.rsvp_status === 'accepted').length;
  const gPending    = guests.filter(g => g.rsvp_status === 'pending').length;
  const gDeclined   = guests.filter(g => g.rsvp_status === 'declined').length;
  const rsvpPct     = totalGuests > 0 ? Math.round((gAccepted / totalGuests) * 100) : 0;
  const weddingDate = coupleProfile?.wedding_date ?? null;
  const daysLeft    = weddingDate ? daysUntil(weddingDate) : null;

  /* ── Avatar upload ──────────────────────────────────────── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !file.type.startsWith('image/') || file.size > 5242880) return;
    setUploadingAvatar(true);
    try {
      const fp = `${userId}/avatar.${file.name.split('.').pop() || 'jpg'}`;
      const { error } = await supabase.storage.from('couple-avatars').upload(fp, file, { upsert:true });
      if (error) throw error;
      const { data: u } = supabase.storage.from('couple-avatars').getPublicUrl(fp);
      await supabase.from('couples').upsert({ id:userId, avatar_url:u.publicUrl });
      setCoupleProfile(p => p ? { ...p, avatar_url:u.publicUrl } : p);
    } catch (err) { console.error(err); } finally { setUploadingAvatar(false); }
  };

  /* ── Save date ──────────────────────────────────────────── */
  const saveWeddingDate = async () => {
    if (!userId) return;
    if (editDate) { const t = new Date(); t.setHours(0,0,0,0); if (new Date(editDate+'T00:00:00') < t) { alert('Date cannot be in the past'); return; } }
    setSavingDate(true);
    const { error } = await supabase.from('couples').upsert({ id:userId, wedding_date:editDate || null });
    if (!error) { setCoupleProfile(p => p ? { ...p, wedding_date:editDate || null } : p); setShowDateModal(false); }
    else alert('Failed to save. Try again.');
    setSavingDate(false);
  };

  /* ── Loading ────────────────────────────────────────────── */
  if (!loaded) return (
    <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:38, height:38, borderRadius:'50%', border:'3px solid rgba(184,151,62,0.15)', borderTopColor:G, animation:'spin 0.8s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  const coupleTitle = coupleProfile?.partner_name
    ? `Hi, ${coupleProfile.partner_name} 👋`
    : userName ? `Hi, ${userName} 👋` : 'Your Wedding';

  const quickNav = [
    { icon:'📋', label:'Planner',  href:'/couple/planner' },
    { icon:'🏪', label:'Vendors',  href:'/marketplace' },
    { icon:'💬', label:'Messages', href:'/messages' },
    { icon:'👥', label:'Guests',   href:'/couple/planner?tab=guests' },
  ];

  return (
    <div style={{ minHeight:'100svh', background:BG }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .dc{animation:fadeUp 0.38s ease both}
        .dc:nth-child(1){animation-delay:.04s}.dc:nth-child(2){animation-delay:.08s}
        .dc:nth-child(3){animation-delay:.12s}.dc:nth-child(4){animation-delay:.16s}
        .dc:nth-child(5){animation-delay:.20s}.dc:nth-child(6){animation-delay:.24s}
        .dc:nth-child(7){animation-delay:.28s}.dc:nth-child(8){animation-delay:.32s}
      `}</style>

      <div style={{ maxWidth:900, margin:'0 auto', paddingBottom:100 }}>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarUpload}/>

        {/* ════ HEADER ════════════════════════════════════════ */}
        <div style={{ background:'linear-gradient(135deg,#9A2143 0%,#b8315a 100%)', padding:'22px 20px 0', position:'relative', overflow:'hidden' }}>
          {/* Orbs */}
          <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'rgba(154,33,67,0.12)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', bottom:30, left:-20, width:90, height:90, borderRadius:'50%', background:'rgba(154,33,67,0.08)', pointerEvents:'none' }}/>

          {/* Name + settings */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 3px', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:2.5, textTransform:'uppercase' }}>Wedding Planner</p>
              <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'86%' }}>{coupleTitle}</h1>
            </div>
            <Link href="/settings" style={{ width:38, height:38, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, textDecoration:'none' }}>
              <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </Link>
          </div>

          {/* Countdown ring + avatar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
            {weddingDate ? (
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                {/* Ring shows % of year elapsed toward wedding */}
                <Donut
                  pct={daysLeft! > 0 ? Math.min(((365 - daysLeft!) / 365) * 100, 99) : 100}
                  size={108} sw={9}
                  color="rgba(255,255,255,0.9)" track="rgba(255,255,255,0.12)"
                >
                  {daysLeft === 0
                    ? <span style={{ fontSize:30 }}>🎉</span>
                    : <>
                        <span style={{ fontSize:28, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1 }}>{daysLeft}</span>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)', letterSpacing:1.5, marginTop:1 }}>DAYS</span>
                      </>
                  }
                </Donut>
                <div>
                  <p style={{ margin:'0 0 1px', fontSize:10, color:'rgba(255,255,255,0.42)', letterSpacing:1, textTransform:'uppercase' }}>
                    {daysLeft === 0 ? 'Today is the day!' : 'Until your wedding'}
                  </p>
                  <p style={{ margin:'0 0 4px', fontSize:15, fontWeight:600, color:'#fff', lineHeight:1.3 }}>{fmtDate(weddingDate)}</p>
                  {coupleProfile?.location && <p style={{ margin:'0 0 8px', fontSize:11, color:'rgba(255,255,255,0.45)' }}>📍 {coupleProfile.location}</p>}
                  <button onClick={() => { setEditDate(weddingDate); setShowDateModal(true); }}
                    style={{ padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.6)', fontSize:10, cursor:'pointer', fontWeight:600 }}>
                    ✏️ Edit date
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin:'0 0 4px', fontSize:17, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)' }}>Set your wedding date</p>
                <p style={{ margin:'0 0 12px', fontSize:12, color:'rgba(255,255,255,0.42)' }}>Start the countdown to your big day ✨</p>
                <button onClick={() => { setEditDate(''); setShowDateModal(true); }}
                  style={{ padding:'10px 22px', borderRadius:22, border:'none', background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(184,151,62,0.45)' }}>
                  Set date
                </button>
              </div>
            )}

            {/* Couple photo */}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
              style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:'3px solid rgba(184,151,62,0.5)', flexShrink:0, cursor:'pointer', background:'rgba(255,255,255,0.08)', position:'relative' }}>
              {uploadingAvatar
                ? <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }}/>
                  </div>
                : coupleProfile?.avatar_url
                  ? <img src={coupleProfile.avatar_url} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3 }}>
                      <span style={{ fontSize:28 }}>💍</span>
                      <span style={{ fontSize:7.5, color:'rgba(255,255,255,0.4)', letterSpacing:0.8 }}>ADD PHOTO</span>
                    </div>
              }
              <div style={{ position:'absolute', bottom:2, right:2, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#b8973e,#8a6010)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}>
                <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
            </button>
          </div>

          {/* Quick nav */}
          <div style={{ display:'flex', gap:8, paddingBottom:20 }}>
            {quickNav.map(n => (
              <Link key={n.href} href={n.href}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'10px 4px', borderRadius:14, background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.1)', textDecoration:'none', textAlign:'center' }}>
                <span style={{ fontSize:20 }}>{n.icon}</span>
                <span style={{ fontSize:9, fontWeight:600, color:'rgba(255,255,255,0.55)', letterSpacing:0.7 }}>{n.label.toUpperCase()}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ════ BODY ══════════════════════════════════════════ */}
        <div style={{ padding:'16px 16px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* ── 1. Planning progress + interactive tasks ─── */}
          <div className="dc" style={{ background:'#fff', borderRadius:20, padding:'18px', boxShadow:'0 2px 14px rgba(0,0,0,0.06)', border:'1.5px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
              <Donut pct={pct} size={76} sw={8} color={G} track="rgba(184,151,62,0.1)">
                <span style={{ fontSize:17, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1 }}>{pct}%</span>
              </Donut>
              <div style={{ flex:1 }}>
                <p style={{ margin:'0 0 2px', fontSize:11, color:LITE, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>Planning Progress</p>
                <p style={{ margin:'0 0 2px', fontSize:22, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1 }}>
                  {doneTasks} <span style={{ fontSize:13, color:LITE, fontWeight:400 }}>of {totalTasks} tasks</span>
                </p>
                <Link href="/couple/planner" style={{ fontSize:11, color:G, fontWeight:700, textDecoration:'none' }}>View all →</Link>
              </div>
            </div>
            {pendingTasks.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {pendingTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask}/>)}
                {extraTasks > 0 && (
                  <Link href="/couple/planner?tab=tasks"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'8px', fontSize:12, color:G, fontWeight:600, textDecoration:'none' }}>
                    +{extraTasks} more tasks →
                  </Link>
                )}
              </div>
            ) : totalTasks === 0 ? (
              <Link href="/couple/planner?tab=tasks"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 14px', borderRadius:12, border:'1.5px dashed rgba(184,151,62,0.3)', textDecoration:'none' }}>
                <span style={{ fontSize:13, color:G, fontWeight:600 }}>+ Add your first task</span>
              </Link>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px', borderRadius:12, background:'rgba(45,122,79,0.06)', border:'1px solid rgba(45,122,79,0.15)' }}>
                <span style={{ fontSize:18 }}>🎉</span>
                <span style={{ fontSize:13, color:GRN, fontWeight:700 }}>All tasks complete!</span>
              </div>
            )}
          </div>

          {/* ── 2. Budget + Guests donuts ──────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

            {/* Budget */}
            <Link href="/couple/planner?tab=budget" className="dc"
              style={{ background:'#fff', borderRadius:20, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.06)', border:'1.5px solid rgba(0,0,0,0.05)', textDecoration:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <p style={{ margin:0, fontSize:10, fontWeight:700, color:LITE, letterSpacing:1, textTransform:'uppercase', alignSelf:'flex-start' }}>Budget</p>
              {budgetItems.length > 0 ? (
                <>
                  <Donut pct={budgetPct} size={84} sw={8} color={GRN} track="rgba(45,122,79,0.1)">
                    <span style={{ fontSize:15, fontWeight:700, color:GRN, lineHeight:1 }}>{budgetPct}%</span>
                    <span style={{ fontSize:8, color:LITE }}>paid</span>
                  </Donut>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ margin:'0 0 1px', fontSize:16, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1 }}>{format(totalBudget)}</p>
                    <p style={{ margin:0, fontSize:10, color:LITE }}>{format(totalBudget - totalPaid)} remaining</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width:84, height:84, borderRadius:'50%', border:'7px dashed rgba(184,151,62,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>💰</div>
                  <p style={{ margin:0, fontSize:11, color:LITE, textAlign:'center', fontStyle:'italic' }}>No budget set</p>
                </>
              )}
            </Link>

            {/* Guests */}
            <Link href="/couple/planner?tab=guests" className="dc"
              style={{ background:'#fff', borderRadius:20, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.06)', border:'1.5px solid rgba(0,0,0,0.05)', textDecoration:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <p style={{ margin:0, fontSize:10, fontWeight:700, color:LITE, letterSpacing:1, textTransform:'uppercase', alignSelf:'flex-start' }}>Guests</p>
              {totalGuests > 0 ? (
                <>
                  <Donut pct={rsvpPct} size={84} sw={8} color={BLU} track="rgba(26,106,168,0.1)">
                    <span style={{ fontSize:20, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)', lineHeight:1 }}>{totalGuests}</span>
                    <span style={{ fontSize:8, color:LITE }}>invited</span>
                  </Donut>
                  <div style={{ display:'flex', gap:4, width:'100%' }}>
                    {[{v:gAccepted,l:'YES',c:GRN},{v:gPending,l:'TBD',c:G2},{v:gDeclined,l:'NO',c:RED}].map(s => (
                      <div key={s.l} style={{ flex:1, textAlign:'center', padding:'5px 2px', borderRadius:8, background:`${s.c}12` }}>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:s.c }}>{s.v}</p>
                        <p style={{ margin:0, fontSize:8, color:s.c, fontWeight:700 }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width:84, height:84, borderRadius:'50%', border:'7px dashed rgba(26,106,168,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>👥</div>
                  <p style={{ margin:0, fontSize:11, color:LITE, textAlign:'center', fontStyle:'italic' }}>No guests yet</p>
                </>
              )}
            </Link>
          </div>

          {/* ── 3. Smart milestone timeline ────────────────── */}
          {daysLeft !== null && (
            <div className="dc">
              <MilestoneTimeline daysLeft={daysLeft}/>
            </div>
          )}

          {/* ── 4. Recent quotes ───────────────────────────── */}
          <div className="dc">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)' }}>Recent Quotes</h2>
              <Link href="/messages" style={{ fontSize:12, fontWeight:600, color:G, textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
                View all <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </Link>
            </div>
            {loadingQuotes ? (
              <div style={{ background:'#fff', borderRadius:16, padding:'22px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', border:'2px solid rgba(184,151,62,0.15)', borderTopColor:G, animation:'spin 0.7s linear infinite' }}/>
              </div>
            ) : recentQuotes.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:18, border:'1.5px dashed rgba(184,151,62,0.25)', padding:'28px 20px', textAlign:'center' }}>
                <p style={{ margin:'0 0 4px', fontSize:32 }}>💬</p>
                <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)' }}>No quotes yet</p>
                <p style={{ margin:'0 0 14px', fontSize:12, color:LITE }}>Browse vendors and request your first quote</p>
                <Link href="/marketplace" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 20px', borderRadius:20, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none' }}>Browse Vendors</Link>
              </div>
            ) : (
              <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:'1.5px solid rgba(0,0,0,0.05)' }}>
                {recentQuotes.map((q, i) => (
                  <Link key={q.id} href="/messages"
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom: i < recentQuotes.length-1 ? '1px solid rgba(0,0,0,0.04)' : 'none', textDecoration:'none' }}>
                    <div style={{ width:38, height:38, borderRadius:12, background:'rgba(184,151,62,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🏪</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:'0 0 1px', fontSize:13, fontWeight:700, color:DARK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.vendor_name}</p>
                      <p style={{ margin:0, fontSize:11, color:LITE, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.package_name}</p>
                    </div>
                    <QBadge status={q.status}/>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. Discover vendors CTA ────────────────────── */}
          <div className="dc" style={{ background:'linear-gradient(135deg,#18100a,#3d2810)', borderRadius:20, padding:'20px', display:'flex', alignItems:'center', gap:14, overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:110, height:110, borderRadius:'50%', background:'rgba(184,151,62,0.1)', pointerEvents:'none' }}/>
            <div style={{ fontSize:38 }}>🏪</div>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 3px', fontSize:14, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)' }}>Find perfect vendors</p>
              <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.45)' }}>Photography · Catering · Décor · More</p>
            </div>
            <Link href="/marketplace" style={{ padding:'10px 16px', borderRadius:12, background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0, boxShadow:'0 3px 12px rgba(184,151,62,0.4)' }}>Browse →</Link>
          </div>

          {/* ── 6. Live page CTA ───────────────────────────── */}
          <div className="dc" style={{ background:'linear-gradient(135deg,#0d2240,#1a3a5c)', borderRadius:20, padding:'20px', display:'flex', alignItems:'center', gap:14, overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', top:-15, right:-15, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>
            <div style={{ fontSize:38 }}>🎥</div>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 3px', fontSize:14, fontWeight:700, color:'#fff', fontFamily:'var(--font-display,Georgia,serif)' }}>Your live wedding page</p>
              <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.45)' }}>RSVP · wishes · live updates for guests</p>
            </div>
            <Link href="/live" style={{ padding:'10px 16px', borderRadius:12, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0 }}>Open →</Link>
          </div>

          {/* ── 7. Wedding website customization ──────────── */}
          {userId && coupleProfile && (
            <WeddingWebsiteSettings
              coupleId={userId}
              currentTheme={coupleProfile.wedding_theme ?? 'champagne'}
              giftEnabled={coupleProfile.gift_enabled ?? false}
              giftMessage={coupleProfile.gift_message ?? null}
              giftItems={coupleProfile.gift_items ?? []}
              weddingWebsiteUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/w/${userId}`}
              howWeMet={coupleProfile.how_we_met ?? null}
              proposalStory={coupleProfile.proposal_story ?? null}
              coupleMessage={coupleProfile.couple_message ?? null}
              onSaved={async () => {
                // Refetch couple profile after saving
                const { data } = await supabase.from('couples').select('partner_name, wedding_date, location, avatar_url, wedding_theme, gift_enabled, gift_message, gift_items, how_we_met, proposal_story, couple_message').eq('id', userId).maybeSingle();
                if (data) setCoupleProfile(data);
              }}
            />
          )}

          {/* ── 8. Contextual planning tip ─────────────────── */}
          <div className="dc">
            <PlanningTip daysLeft={daysLeft}/>
          </div>

        </div>
      </div>

      {/* ════ DATE MODAL ════════════════════════════════════ */}
      {showDateModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:50 }}>
          <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, padding:'0 24px 44px', boxShadow:'0 -8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'#e0d8cc', margin:'16px auto 22px' }}/>
            <h3 style={{ margin:'0 0 18px', fontSize:19, fontWeight:700, color:DARK, fontFamily:'var(--font-display,Georgia,serif)' }}>
              {coupleProfile?.wedding_date ? '✏️ Edit Wedding Date' : '✨ Set Your Wedding Date'}
            </h3>
            <label style={{ fontSize:11, fontWeight:700, color:LITE, letterSpacing:1.2, textTransform:'uppercase', display:'block', marginBottom:8 }}>Date</label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ width:'100%', height:50, padding:'0 16px', borderRadius:14, border:'1.5px solid rgba(184,151,62,0.3)', fontSize:16, color:DARK, outline:'none', boxSizing:'border-box', background:BG, fontFamily:'var(--font-display,Georgia,serif)' }}
            />
            {editDate && (
              <p style={{ margin:'8px 0 0', fontSize:12, color:LITE }}>
                📅 {fmtDate(editDate)} · {daysUntil(editDate)} days from today
              </p>
            )}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setShowDateModal(false)} style={{ flex:1, height:48, borderRadius:14, border:'1.5px solid #e0d8cc', background:'#fff', fontSize:14, fontWeight:600, color:MID, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveWeddingDate} disabled={savingDate}
                style={{ flex:2, height:48, borderRadius:14, border:'none', background:'linear-gradient(135deg,#b8973e,#8a6010)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(184,151,62,0.35)', opacity:savingDate ? 0.7 : 1 }}>
                {savingDate ? 'Saving…' : '✓ Save Date'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav/>
    </div>
  );
}
