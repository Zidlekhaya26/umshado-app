'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import { CR, CR2, GD, GD2, DK, MUT, BOR, BG } from '@/lib/tokens';

const SURF='#fff';

/* ─── Moment definitions ─────────────────────────────────── */
const MOMENTS = [
  { id: 'arrival',      label: 'Guest Arrival',      icon: '🚶', color: '#7a8f5a', desc: 'Music as guests enter the venue' },
  { id: 'ceremony',     label: 'Ceremony',            icon: '💍', color: CR,        desc: 'Walk down the aisle & vows' },
  { id: 'first_dance',  label: 'First Dance',         icon: '💃', color: '#b8517a', desc: 'Your very first dance together' },
  { id: 'parent_dance', label: 'Parent Dance',        icon: '👨‍👧', color: '#6a7ab8',  desc: 'Dance with parents / family' },
  { id: 'reception',    label: 'Reception Dinner',    icon: '🥂', color: GD2,       desc: 'Background music during dinner' },
  { id: 'cake',         label: 'Cake Cutting',        icon: '🎂', color: '#c0703a', desc: 'Song for the big cut' },
  { id: 'bouquet',      label: 'Bouquet Toss',        icon: '💐', color: '#9a5ab8', desc: 'Fun moment for the ladies' },
  { id: 'party',        label: 'Party & Dance Floor', icon: '🎉', color: '#c0402a', desc: 'Get the crowd moving!' },
  { id: 'last_dance',   label: 'Last Dance',          icon: '🌙', color: '#4a6a9a', desc: 'Final song of the night' },
  { id: 'do_not_play',  label: 'Do Not Play',         icon: '🚫', color: '#888',    desc: 'Songs to avoid entirely' },
];

/* ─── Types ─────────────────────────────────────────────── */
interface Song {
  id: string; title: string; artist: string; moment_id: string;
  notes: string | null; added_by: 'couple' | 'guest'; guest_name: string | null;
  created_at: string; sort_order: number;
}
interface GuestRequest {
  id: string; title: string; artist: string; guest_name: string | null;
  message: string | null; created_at: string; approved: boolean | null;
}

/* ─── Shimmer skeleton ───────────────────────────────────── */
function Skel({ h=14, w='100%', r=8 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,#f0ebe4 25%,#faf5ee 50%,#f0ebe4 75%)', backgroundSize: '400px 100%', animation: 'plShimmer 1.4s infinite linear' }} />
  );
}

/* ─── Add song sheet ─────────────────────────────────────── */
function AddSongSheet({ momentId, onClose, onAdd }: {
  momentId: string; onClose: () => void; onAdd: (song: { title: string; artist: string; notes: string }) => void;
}) {
  const [title, setTitle]   = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes]   = useState('');
  const [err, setErr]       = useState('');
  const m = MOMENTS.find(x => x.id === momentId)!;

  const submit = () => {
    if (!title.trim()) { setErr('Song title is required'); return; }
    onAdd({ title: title.trim(), artist: artist.trim(), notes: notes.trim() });
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:60 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:70,background:'#fff',borderRadius:'22px 22px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'plSlideUp .22s ease' }}>
        <div style={{ width:38,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'18px 20px 28px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:`${m.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{m.icon}</div>
            <div>
              <p style={{ margin:0,fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Add a song</p>
              <p style={{ margin:0,fontSize:11,color:MUT }}>{m.label}</p>
            </div>
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>SONG TITLE *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. A Thousand Years"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>ARTIST</label>
              <input value={artist} onChange={e=>setArtist(e.target.value)} placeholder="e.g. Christina Perri"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>NOTES FOR DJ (optional)</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Fade in gently, no edits"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
          </div>

          {err && <p style={{ color:CR,fontSize:12,marginTop:8 }}>{err}</p>}

          <button onClick={submit} style={{ width:'100%',marginTop:18,padding:14,borderRadius:13,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer' }}>
            Add Song 🎵
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Move song sheet ────────────────────────────────────── */
function MoveSongSheet({ song, onClose, onMove }: {
  song: Song; onClose: () => void; onMove: (momentId: string) => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:60 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:70,background:'#fff',borderRadius:'22px 22px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'plSlideUp .22s ease',maxHeight:'80vh',overflow:'auto' }}>
        <div style={{ width:38,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'18px 20px 28px' }}>
          <p style={{ margin:'0 0 4px',fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Move &quot;{song.title}&quot;</p>
          <p style={{ margin:'0 0 18px',fontSize:11,color:MUT }}>Choose a different moment</p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {MOMENTS.filter(m => m.id !== song.moment_id).map(m => (
              <button key={m.id} onClick={() => onMove(m.id)}
                style={{ display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',cursor:'pointer',textAlign:'left' }}>
                <span style={{ fontSize:22 }}>{m.icon}</span>
                <div>
                  <p style={{ margin:'0 0 1px',fontSize:13,fontWeight:700,color:DK }}>{m.label}</p>
                  <p style={{ margin:0,fontSize:11,color:MUT }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Share sheet ────────────────────────────────────────── */
function ShareSheet({ songs, coupleId, djName, onClose }: {
  songs: Song[]; coupleId: string; djName: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const requestUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/playlist/${coupleId}/request`;

  const buildPlaylistText = () => {
    const lines: string[] = ['🎵 *WEDDING PLAYLIST*\n'];
    MOMENTS.forEach(m => {
      const ms = songs.filter(s => s.moment_id === m.id && s.added_by === 'couple');
      if (ms.length === 0) return;
      lines.push(`*${m.icon} ${m.label.toUpperCase()}*`);
      ms.forEach(s => {
        lines.push(`• ${s.title}${s.artist ? ` – ${s.artist}` : ''}${s.notes ? ` _(${s.notes})_` : ''}`);
      });
      lines.push('');
    });
    lines.push(`🔗 Guest requests: ${requestUrl}`);
    return lines.join('\n');
  };

  const sendViaWhatsApp = () => {
    const text = encodeURIComponent(buildPlaylistText());
    const a = document.createElement('a');
    a.href = `https://wa.me/?text=${text}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(requestUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:60 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:70,background:'#fff',borderRadius:'22px 22px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'plSlideUp .22s ease' }}>
        <div style={{ width:38,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'20px 20px 28px' }}>
          <p style={{ margin:'0 0 4px',fontSize:17,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Share your playlist</p>
          <p style={{ margin:'0 0 22px',fontSize:12,color:MUT }}>{songs.filter(s=>s.added_by==='couple').length} songs across {MOMENTS.filter(m=>songs.some(s=>s.moment_id===m.id&&s.added_by==='couple')).length} moments</p>

          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {/* WhatsApp to DJ */}
            <button onClick={sendViaWhatsApp} style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:15,border:'1.5px solid rgba(37,211,102,0.3)',background:'rgba(37,211,102,0.05)',cursor:'pointer',textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:13,background:'#25d166',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <p style={{ margin:'0 0 2px',fontSize:14,fontWeight:800,color:DK }}>Send to DJ via WhatsApp</p>
                <p style={{ margin:0,fontSize:12,color:MUT }}>Share full playlist with moment breakdowns</p>
              </div>
            </button>

            {/* Guest request link */}
            <button onClick={copyLink} style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:15,border:`1.5px solid ${BOR}`,background:'rgba(154,33,67,0.04)',cursor:'pointer',textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${CR},${CR2})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:22 }}>
                🔗
              </div>
              <div style={{ flex:1 }}>
                <p style={{ margin:'0 0 2px',fontSize:14,fontWeight:800,color:DK }}>{copied ? '✓ Link copied!' : 'Copy guest request link'}</p>
                <p style={{ margin:0,fontSize:11,color:MUT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{requestUrl}</p>
              </div>
            </button>

            {/* Copy full playlist */}
            <button onClick={async () => { await navigator.clipboard.writeText(buildPlaylistText()); }} style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:15,border:`1.5px solid ${BOR}`,background:'#fff',cursor:'pointer',textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:13,background:'rgba(184,151,62,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:22 }}>📋</div>
              <div>
                <p style={{ margin:'0 0 2px',fontSize:14,fontWeight:800,color:DK }}>Copy full playlist text</p>
                <p style={{ margin:0,fontSize:12,color:MUT }}>Paste into any chat or email</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Song row ──────────────────────────────────────────── */
function SongRow({ song, onDelete, onMove }: {
  song: Song; onDelete: () => void; onMove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isRequest = song.added_by === 'guest';
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:`1px solid ${BOR}`,position:'relative' }}>
      <div style={{ width:38,height:38,borderRadius:10,background:isRequest?'rgba(184,151,62,0.1)':'rgba(154,33,67,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18 }}>
        {isRequest ? '🙋' : '🎵'}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ margin:'0 0 1px',fontSize:13,fontWeight:700,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{song.title}</p>
        <p style={{ margin:0,fontSize:11,color:MUT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
          {song.artist || 'Unknown artist'}
          {isRequest && song.guest_name && <span style={{ color:GD2 }}> · req. by {song.guest_name}</span>}
        </p>
        {song.notes && <p style={{ margin:'2px 0 0',fontSize:10,color:'#b0a090',fontStyle:'italic' }}>{song.notes}</p>}
      </div>
      <button onClick={() => setOpen(p => !p)} style={{ width:30,height:30,borderRadius:'50%',border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:MUT,fontSize:18,flexShrink:0 }}>⋯</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed',inset:0,zIndex:30 }} />
          <div style={{ position:'absolute',right:8,top:42,background:'#fff',borderRadius:14,boxShadow:'0 8px 28px rgba(26,13,18,0.16)',zIndex:40,minWidth:160,overflow:'hidden' }}>
            <button onClick={() => { setOpen(false); onMove(); }} style={{ width:'100%',padding:'12px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,color:DK,cursor:'pointer',display:'block' }}>📂 Move to moment</button>
            <button onClick={() => { setOpen(false); onDelete(); }} style={{ width:'100%',padding:'12px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,color:CR,cursor:'pointer',borderTop:`1px solid ${BOR}`,display:'block' }}>🗑️ Remove</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function DJPlaylistPage() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [songs, setSongs]             = useState<Song[]>([]);
  const [requests, setRequests]       = useState<GuestRequest[]>([]);
  const [coupleId, setCoupleId]       = useState<string | null>(null);
  const [activeMoment, setActiveMoment] = useState<string>('first_dance');
  const [addSheet, setAddSheet]       = useState(false);
  const [moveTarget, setMoveTarget]   = useState<Song | null>(null);
  const [shareOpen, setShareOpen]     = useState(false);
  const [view, setView]               = useState<'moments' | 'requests'>('moments');
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [djName, setDjName]           = useState('');

  const showOk = (m: string) => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(null), 3000); };

  const loadSongs = async (uid: string) => {
    const { data } = await supabase
      .from('playlist_songs')
      .select('*')
      .eq('couple_id', uid)
      .order('moment_id').order('sort_order');
    setSongs(data || []);
  };

  const loadRequests = async (uid: string) => {
    const { data } = await supabase
      .from('playlist_requests')
      .select('*')
      .eq('couple_id', uid)
      .order('created_at', { ascending: false });
    setRequests(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/sign-in'); return; }
      setCoupleId(user.id);
      await Promise.all([loadSongs(user.id), loadRequests(user.id)]);
      setLoading(false);
    })();
  }, [router]);

  const addSong = async (draft: { title: string; artist: string; notes: string }) => {
    if (!coupleId) return;
    const existing = songs.filter(s => s.moment_id === activeMoment);
    const { data, error } = await supabase.from('playlist_songs').insert({
      couple_id: coupleId, moment_id: activeMoment,
      title: draft.title, artist: draft.artist || null,
      notes: draft.notes || null, added_by: 'couple',
      sort_order: existing.length,
    }).select().single();
    if (!error && data) {
      setSongs(p => [...p, data]);
      setAddSheet(false);
      showOk(`"${draft.title}" added to ${MOMENTS.find(m=>m.id===activeMoment)?.label}`);
    }
  };

  const deleteSong = async (id: string) => {
    await supabase.from('playlist_songs').delete().eq('id', id);
    setSongs(p => p.filter(s => s.id !== id));
    showOk('Song removed');
  };

  const moveSong = async (songId: string, newMomentId: string) => {
    await supabase.from('playlist_songs').update({ moment_id: newMomentId }).eq('id', songId);
    setSongs(p => p.map(s => s.id === songId ? { ...s, moment_id: newMomentId } : s));
    setMoveTarget(null);
    showOk(`Moved to ${MOMENTS.find(m=>m.id===newMomentId)?.label}`);
  };

  const approveRequest = async (req: GuestRequest) => {
    if (!coupleId) return;
    const existing = songs.filter(s => s.moment_id === 'party');
    const { data } = await supabase.from('playlist_songs').insert({
      couple_id: coupleId, moment_id: 'party',
      title: req.title, artist: req.artist || null,
      notes: req.message || null, added_by: 'guest',
      guest_name: req.guest_name, sort_order: existing.length,
    }).select().single();
    await supabase.from('playlist_requests').update({ approved: true }).eq('id', req.id);
    if (data) setSongs(p => [...p, data]);
    setRequests(p => p.map(r => r.id === req.id ? { ...r, approved: true } : r));
    showOk(`"${req.title}" added to Party`);
  };

  const declineRequest = async (id: string) => {
    await supabase.from('playlist_requests').update({ approved: false }).eq('id', id);
    setRequests(p => p.map(r => r.id === id ? { ...r, approved: false } : r));
  };

  const momentSongs = useMemo(() => songs.filter(s => s.moment_id === activeMoment), [songs, activeMoment]);
  const pendingRequests = requests.filter(r => r.approved === null);
  const totalSongs = songs.filter(s => s.added_by === 'couple').length;

  const activeMomentData = MOMENTS.find(m => m.id === activeMoment)!;

  return (
    <div style={{ minHeight:'100svh',background:BG,fontFamily:'system-ui,sans-serif' }}>
      <style>{`
        @keyframes plShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes plSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes plFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes plToast{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        button,a{font-family:inherit!important}
        ::-webkit-scrollbar{display:none}
      `}</style>

      <div style={{ maxWidth:600,margin:'0 auto',paddingBottom:100 }}>

        {/* ── Header ── */}
        <div style={{ background:`linear-gradient(160deg,var(--um-crimson-deep) 0%,${CR} 55%,var(--um-crimson-mid) 100%)`,padding:'20px 20px 0',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-50,right:-50,width:180,height:180,borderRadius:'50%',background:'rgba(189,152,63,0.1)',pointerEvents:'none' }} />
          <div style={{ position:'absolute',bottom:-20,left:-20,width:100,height:100,borderRadius:'50%',background:'rgba(189,152,63,0.06)',pointerEvents:'none' }} />

          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14,position:'relative' }}>
            <button onClick={() => router.back()} style={{ width:34,height:34,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <h1 style={{ margin:0,fontSize:20,fontWeight:700,color:'#fff',fontFamily:'Georgia,serif' }}>🎵 DJ Playlist</h1>
              <p style={{ margin:0,fontSize:11,color:'rgba(255,255,255,0.65)' }}>
                {loading ? 'Loading…' : `${totalSongs} songs · ${pendingRequests.length} pending requests`}
              </p>
            </div>
            <button onClick={() => setShareOpen(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:20,border:'1.5px solid rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.12)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              Share
            </button>
          </div>

          {/* View tabs */}
          <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.12)' }}>
            <button onClick={() => setView('moments')} style={{ flex:1,padding:'10px 0',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:view==='moments'?'#fff':'rgba(255,255,255,0.45)',borderBottom:view==='moments'?'2.5px solid #fff':'2.5px solid transparent' }}>
              🎭 Moments
            </button>
            <button onClick={() => setView('requests')} style={{ flex:1,padding:'10px 0',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:view==='requests'?'#fff':'rgba(255,255,255,0.45)',borderBottom:view==='requests'?'2.5px solid #fff':'2.5px solid transparent',position:'relative' }}>
              🙋 Requests
              {pendingRequests.length > 0 && (
                <span style={{ position:'absolute',top:8,right:24,width:18,height:18,borderRadius:9,background:GD,color:'#fff',fontSize:9,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center' }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Moments view ── */}
        {view === 'moments' && (
          <>
            {/* Moment selector horizontal scroll */}
            <div style={{ overflowX:'auto',padding:'14px 16px 0',display:'flex',gap:8,scrollbarWidth:'none' }}>
              {MOMENTS.map(m => {
                const count = songs.filter(s => s.moment_id === m.id && s.added_by === 'couple').length;
                const isActive = activeMoment === m.id;
                return (
                  <button key={m.id} onClick={() => setActiveMoment(m.id)}
                    style={{ flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 12px',borderRadius:14,border:isActive?`2px solid ${m.color}`:`1.5px solid ${BOR}`,background:isActive?`${m.color}12`:SURF,cursor:'pointer',minWidth:68,transition:'all .15s' }}>
                    <span style={{ fontSize:20 }}>{m.icon}</span>
                    <span style={{ fontSize:9,fontWeight:700,color:isActive?m.color:MUT,letterSpacing:.3,textAlign:'center',lineHeight:1.3 }}>{m.label.split(' ').slice(0,2).join('\n')}</span>
                    {count > 0 && <span style={{ fontSize:9,fontWeight:800,width:18,height:18,borderRadius:9,background:m.color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Active moment panel */}
            <div style={{ padding:'14px 16px' }}>
              <div style={{ background:SURF,borderRadius:20,overflow:'hidden',boxShadow:'0 2px 12px rgba(26,13,18,0.07)',border:`1.5px solid ${BOR}` }}>
                {/* Moment header */}
                <div style={{ padding:'16px 18px 14px',borderBottom:`1px solid ${BOR}`,display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:44,height:44,borderRadius:13,background:`${activeMomentData.color}12`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>{activeMomentData.icon}</div>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:'0 0 2px',fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>{activeMomentData.label}</p>
                    <p style={{ margin:0,fontSize:11,color:MUT }}>{activeMomentData.desc}</p>
                  </div>
                  <button onClick={() => setAddSheet(true)} style={{ width:36,height:36,borderRadius:'50%',border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>+</button>
                </div>

                {/* Songs */}
                {loading ? (
                  <div style={{ padding:16,display:'flex',flexDirection:'column',gap:10 }}>
                    {[1,2].map(i => <Skel key={i} h={50} />)}
                  </div>
                ) : momentSongs.length === 0 ? (
                  <div style={{ padding:'32px 20px',textAlign:'center' }}>
                    <p style={{ margin:'0 0 4px',fontSize:28,opacity:.25 }}>{activeMomentData.icon}</p>
                    <p style={{ margin:'0 0 4px',fontSize:14,fontWeight:700,color:DK }}>No songs yet</p>
                    <p style={{ margin:'0 0 16px',fontSize:12,color:MUT }}>{activeMomentData.desc}</p>
                    <button onClick={() => setAddSheet(true)} style={{ padding:'10px 22px',borderRadius:20,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                      + Add first song
                    </button>
                  </div>
                ) : (
                  momentSongs.map(s => (
                    <SongRow key={s.id} song={s}
                      onDelete={() => deleteSong(s.id)}
                      onMove={() => setMoveTarget(s)}
                    />
                  ))
                )}

                {momentSongs.length > 0 && (
                  <button onClick={() => setAddSheet(true)} style={{ width:'100%',padding:'13px',border:'none',borderTop:`1px solid ${BOR}`,background:'none',color:CR,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                    + Add another song
                  </button>
                )}
              </div>

              {/* All moments summary */}
              <div style={{ marginTop:16 }}>
                <p style={{ margin:'0 0 10px',fontSize:13,fontWeight:700,color:DK,fontFamily:'Georgia,serif' }}>Playlist overview</p>
                <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                  {MOMENTS.filter(m => songs.some(s => s.moment_id === m.id)).map(m => {
                    const ms = songs.filter(s => s.moment_id === m.id && s.added_by === 'couple');
                    const gs = songs.filter(s => s.moment_id === m.id && s.added_by === 'guest');
                    return (
                      <button key={m.id} onClick={() => setActiveMoment(m.id)}
                        style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:13,border:`1.5px solid ${activeMoment===m.id?m.color:BOR}`,background:activeMoment===m.id?`${m.color}08`:SURF,cursor:'pointer',textAlign:'left' }}>
                        <span style={{ fontSize:18,flexShrink:0 }}>{m.icon}</span>
                        <span style={{ flex:1,fontSize:13,fontWeight:600,color:DK }}>{m.label}</span>
                        <span style={{ fontSize:11,color:MUT }}>{ms.length} song{ms.length!==1?'s':''}{gs.length>0?` + ${gs.length} req`:''}</span>
                        <svg width="12" height="12" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Requests view ── */}
        {view === 'requests' && (
          <div style={{ padding:'14px 16px' }}>
            {/* Guest request link card */}
            <div style={{ background:`linear-gradient(135deg,${CR},${CR2})`,borderRadius:18,padding:'16px 18px',marginBottom:14,color:'#fff' }}>
              <p style={{ margin:'0 0 4px',fontSize:14,fontWeight:700,fontFamily:'Georgia,serif' }}>Share request link with guests</p>
              <p style={{ margin:'0 0 14px',fontSize:11,color:'rgba(255,255,255,0.7)' }}>Guests can suggest songs without seeing your full playlist</p>
              <button onClick={() => setShareOpen(true)} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.15)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                🔗 Get link
              </button>
            </div>

            {loading ? (
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {[1,2,3].map(i => <Skel key={i} h={80} r={14} />)}
              </div>
            ) : requests.length === 0 ? (
              <div style={{ background:SURF,borderRadius:20,padding:'40px 20px',textAlign:'center',border:`1.5px solid ${BOR}` }}>
                <p style={{ margin:'0 0 8px',fontSize:36,opacity:.25 }}>🙋</p>
                <p style={{ margin:'0 0 6px',fontSize:15,fontWeight:700,color:DK }}>No requests yet</p>
                <p style={{ margin:0,fontSize:12,color:MUT }}>Share the request link and your guests can suggest songs</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {/* Pending */}
                {pendingRequests.length > 0 && (
                  <>
                    <p style={{ margin:'0 0 4px',fontSize:12,fontWeight:700,color:GD2,letterSpacing:.4 }}>PENDING REVIEW ({pendingRequests.length})</p>
                    {pendingRequests.map(r => (
                      <div key={r.id} style={{ background:SURF,borderRadius:16,border:`1.5px solid rgba(184,151,62,0.25)`,overflow:'hidden' }}>
                        <div style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                            <div style={{ fontSize:28,flexShrink:0 }}>🎵</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <p style={{ margin:'0 0 1px',fontSize:14,fontWeight:700,color:DK }}>{r.title}</p>
                              {r.artist && <p style={{ margin:'0 0 3px',fontSize:12,color:MUT }}>{r.artist}</p>}
                              {r.guest_name && <p style={{ margin:'0 0 3px',fontSize:11,color:GD2,fontWeight:600 }}>Requested by {r.guest_name}</p>}
                              {r.message && <p style={{ margin:0,fontSize:11,color:MUT,fontStyle:'italic' }}>&quot;{r.message}&quot;</p>}
                            </div>
                          </div>
                          <div style={{ display:'flex',gap:8,marginTop:12 }}>
                            <button onClick={() => declineRequest(r.id)} style={{ flex:1,padding:'9px',borderRadius:10,border:`1.5px solid ${BOR}`,background:'#fff',color:CR,fontSize:12,fontWeight:700,cursor:'pointer' }}>✕ Decline</button>
                            <button onClick={() => approveRequest(r)} style={{ flex:2,padding:'9px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>✓ Add to Party</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Reviewed */}
                {requests.filter(r => r.approved !== null).length > 0 && (
                  <>
                    <p style={{ margin:'12px 0 4px',fontSize:12,fontWeight:700,color:MUT,letterSpacing:.4 }}>REVIEWED</p>
                    {requests.filter(r => r.approved !== null).map(r => (
                      <div key={r.id} style={{ background:SURF,borderRadius:14,border:`1.5px solid ${BOR}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,opacity:.7 }}>
                        <span style={{ fontSize:20 }}>{r.approved ? '✅' : '❌'}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          <p style={{ margin:'0 0 1px',fontSize:13,fontWeight:600,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.title}{r.artist?` – ${r.artist}`:''}</p>
                          <p style={{ margin:0,fontSize:10,color:MUT }}>{r.approved?'Added to playlist':'Declined'}{r.guest_name?` · ${r.guest_name}`:''}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {successMsg && (
        <div style={{ position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:DK,color:'#fff',padding:'11px 18px',borderRadius:14,fontSize:13,fontWeight:700,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',zIndex:80,whiteSpace:'nowrap',animation:'plToast .22s ease' }}>
          {successMsg}
        </div>
      )}

      {/* Sheets */}
      {addSheet && <AddSongSheet momentId={activeMoment} onClose={() => setAddSheet(false)} onAdd={addSong} />}
      {moveTarget && <MoveSongSheet song={moveTarget} onClose={() => setMoveTarget(null)} onMove={(mid) => moveSong(moveTarget.id, mid)} />}
      {shareOpen && coupleId && <ShareSheet songs={songs} coupleId={coupleId} djName={djName} onClose={() => setShareOpen(false)} />}

      <BottomNav />
    </div>
  );
}
