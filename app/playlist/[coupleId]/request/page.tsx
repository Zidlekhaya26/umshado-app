'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { CR, CR2, GD, DK, MUT, BG, BOR } from '@/lib/tokens';

interface CoupleInfo { partner_name: string | null; wedding_date: string | null; }

type State = 'form' | 'submitting' | 'success' | 'error';

export default function PlaylistRequestPage() {
  const params  = useParams();
  const coupleId = params?.coupleId as string;

  const [couple, setCouple]   = useState<CoupleInfo | null>(null);
  const [title, setTitle]     = useState('');
  const [artist, setArtist]   = useState('');
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState]     = useState<State>('form');
  const [submitted, setSubmitted] = useState<{title:string;artist:string}[]>([]);

  useEffect(() => {
    if (!coupleId) return;
    supabase.from('couples').select('partner_name, wedding_date').eq('id', coupleId).maybeSingle()
      .then(({ data }) => setCouple(data));
  }, [coupleId]);

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  const submit = async () => {
    if (!title.trim()) return;
    setState('submitting');
    try {
      const { error } = await supabase.from('playlist_requests').insert({
        couple_id: coupleId,
        title: title.trim(),
        artist: artist.trim() || null,
        guest_name: guestName.trim() || null,
        message: message.trim() || null,
        approved: null,
      });
      if (error) throw error;
      setSubmitted(p => [...p, { title: title.trim(), artist: artist.trim() }]);
      setTitle(''); setArtist(''); setMessage('');
      setState('success');
    } catch { setState('error'); }
  };

  const reset = () => setState('form');

  return (
    <div style={{ minHeight:'100svh',background:BG,fontFamily:'system-ui,sans-serif',display:'flex',flexDirection:'column',alignItems:'center' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        button,input,textarea{font-family:inherit!important}
      `}</style>

      <div style={{ width:'100%',maxWidth:480,padding:'0 0 60px' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(160deg,var(--um-crimson-deep) 0%,${CR} 55%,var(--um-crimson-mid) 100%)`,padding:'40px 24px 32px',textAlign:'center',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'rgba(189,152,63,0.1)',pointerEvents:'none' }} />
          <div style={{ position:'absolute',bottom:-20,left:-20,width:90,height:90,borderRadius:'50%',background:'rgba(189,152,63,0.07)',pointerEvents:'none' }} />
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:44,marginBottom:10 }}>🎵</div>
            <h1 style={{ margin:'0 0 6px',fontSize:22,fontWeight:700,color:'#fff',fontFamily:'Georgia,serif' }}>
              {couple?.partner_name ? `${couple.partner_name}'s Wedding` : 'Wedding Playlist'}
            </h1>
            <p style={{ margin:0,fontSize:13,color:'rgba(255,255,255,0.7)' }}>
              {couple?.wedding_date ? fmtDate(couple.wedding_date) : 'Request a song for the reception!'}
            </p>
          </div>
        </div>

        <div style={{ padding:'24px 20px' }}>

          {/* Previous submissions */}
          {submitted.length > 0 && (
            <div style={{ marginBottom:18,background:'rgba(30,124,74,0.06)',borderRadius:14,padding:'12px 16px',border:'1px solid rgba(30,124,74,0.2)',animation:'fadeUp .3s ease' }}>
              <p style={{ margin:'0 0 6px',fontSize:12,fontWeight:700,color:'#1e7c4a' }}>✓ You've requested:</p>
              {submitted.map((s,i) => (
                <p key={i} style={{ margin:'0',fontSize:12,color:'#1a4a2a' }}>• {s.title}{s.artist?` – ${s.artist}`:''}</p>
              ))}
            </div>
          )}

          {state === 'success' ? (
            <div style={{ textAlign:'center',padding:'40px 20px',animation:'fadeUp .3s ease' }}>
              <div style={{ fontSize:56,marginBottom:14 }}>🎉</div>
              <h2 style={{ margin:'0 0 8px',fontSize:20,fontWeight:700,color:DK,fontFamily:'Georgia,serif' }}>Request sent!</h2>
              <p style={{ margin:'0 0 24px',fontSize:13,color:MUT }}>The couple will review your suggestion — hope to hear it on the dance floor!</p>
              <button onClick={reset} style={{ padding:'12px 28px',borderRadius:14,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer' }}>
                + Request another song
              </button>
            </div>
          ) : state === 'error' ? (
            <div style={{ textAlign:'center',padding:'40px 20px' }}>
              <div style={{ fontSize:44,marginBottom:12 }}>😕</div>
              <p style={{ margin:'0 0 6px',fontSize:16,fontWeight:700,color:DK }}>Something went wrong</p>
              <p style={{ margin:'0 0 20px',fontSize:12,color:MUT }}>Please try again</p>
              <button onClick={reset} style={{ padding:'11px 24px',borderRadius:12,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:13,fontWeight:700,cursor:'pointer' }}>Try again</button>
            </div>
          ) : (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <div style={{ background:'#fff',borderRadius:20,padding:'20px',boxShadow:'0 2px 12px rgba(26,13,18,0.07)',border:`1.5px solid ${BOR}`,display:'flex',flexDirection:'column',gap:14 }}>
                <div>
                  <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4,display:'block',marginBottom:5 }}>SONG TITLE *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Jerusalema"
                    style={{ width:'100%',padding:'13px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4,display:'block',marginBottom:5 }}>ARTIST</label>
                  <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="e.g. Master KG"
                    style={{ width:'100%',padding:'13px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4,display:'block',marginBottom:5 }}>YOUR NAME (optional)</label>
                  <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Aunt Thandiwe"
                    style={{ width:'100%',padding:'13px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4,display:'block',marginBottom:5 }}>MESSAGE (optional)</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. Play this for the first slow dance!"
                    rows={2} style={{ width:'100%',padding:'13px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',resize:'none',boxSizing:'border-box' }} />
                </div>

                <button onClick={submit} disabled={!title.trim() || state==='submitting'}
                  style={{ width:'100%',padding:14,borderRadius:13,border:'none',background:!title.trim()?'#e8e0d8':`linear-gradient(135deg,${CR},${CR2})`,color:!title.trim()?MUT:'#fff',fontSize:15,fontWeight:800,cursor:!title.trim()?'default':'pointer',transition:'all .15s' }}>
                  {state === 'submitting' ? '🎵 Sending…' : '🎵 Request this song'}
                </button>
              </div>

              <p style={{ textAlign:'center',fontSize:11,color:'#c0b0a0',marginTop:20,lineHeight:1.6 }}>
                Your request will be reviewed by the couple before it's added to the playlist.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
