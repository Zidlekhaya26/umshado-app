'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import VendorBottomNav from '@/components/VendorBottomNav';
import { CR, CR2, GD, GD2, DK, MUT, BOR, BG, GR, BL } from '@/lib/tokens';
import { LoadingPage } from '@/components/ui/UmshadoLogo';


interface Booking {
  id:string; booking_ref:string; package_name:string; event_date:string|null;
  event_location:string|null; confirmed_price:number;
  status:'confirmed'|'completed'|'cancelled'; vendor_notes:string|null;
  confirmed_at:string; couple_name:string; couple_avatar:string|null;
  couple_id:string; review_requested:boolean;
}
interface BlockedDate { id:string; blocked_date:string; reason:Reason; note:string|null; }
type Reason='booked'|'unavailable'|'holiday';
type Tab='upcoming'|'past'|'calendar';

const RS:Record<Reason,{label:string;color:string;bg:string;border:string}>={
  booked:     {label:'Booked',     color:GR, bg:'rgba(30,124,74,0.1)',  border:'rgba(30,124,74,0.25)'},
  unavailable:{label:'Unavailable',color:CR, bg:'rgba(154,33,67,0.09)',border:'rgba(154,33,67,0.22)'},
  holiday:    {label:'Personal',   color:GD2,bg:'rgba(189,152,63,0.1)',border:'rgba(189,152,63,0.25)'},
};
const SS:Record<string,{label:string;color:string;bg:string;border:string}>={
  confirmed:{label:'Confirmed',color:GR, bg:'rgba(30,124,74,0.1)',  border:'rgba(30,124,74,0.25)'},
  completed:{label:'Completed',color:BL, bg:'rgba(29,111,168,0.1)', border:'rgba(29,111,168,0.25)'},
  cancelled:{label:'Cancelled',color:CR, bg:'rgba(154,33,67,0.08)',border:'rgba(154,33,67,0.2)'},
};
const DAYS=['S','M','T','W','T','F','S'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const toKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayKey=()=>toKey(new Date());
const fmtP=(c:number)=>`R${(c/100).toLocaleString('en-ZA',{minimumFractionDigits:0})}`;

export default function VendorBookingsPage(){
  const router=useRouter();
  const [vendorId,setVendorId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [tab,setTab]=useState<Tab>('upcoming');
  const [actionSheet,setActionSheet]=useState<Booking|null>(null);
  const [notesSheet,setNotesSheet]=useState<Booking|null>(null);
  const [noteDraft,setNoteDraft]=useState('');
  const [blocked,setBlocked]=useState<Map<string,BlockedDate>>(new Map());
  const [viewYear,setViewYear]=useState(()=>new Date().getFullYear());
  const [viewMonth,setViewMonth]=useState(()=>new Date().getMonth());
  const [blockSheet,setBlockSheet]=useState<{date:string;reason:Reason;note:string}|null>(null);
  const [savingBlock,setSavingBlock]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [successMsg,setSuccessMsg]=useState<string|null>(null);
  const [editDateSheet,setEditDateSheet]=useState<Booking|null>(null);
  const [editDateValue,setEditDateValue]=useState('');

  const showOk=(m:string)=>{setSuccessMsg(m);setTimeout(()=>setSuccessMsg(null),3000);};

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.push('/auth/sign-in');return;}
      const {data:v}=await supabase.from('vendors').select('id').eq('user_id',user.id).limit(1).maybeSingle();
      const vid=v?.id||user.id;
      setVendorId(vid);
      await Promise.all([loadBookings(vid),loadBlocked(vid)]);
      setLoading(false);
    })();
  },[router]);

  const loadBookings=async(vid:string)=>{
    const {data}=await supabase.from('bookings')
      .select('id,booking_ref,package_name,event_date,event_location,confirmed_price,status,vendor_notes,confirmed_at,couple_id')
      .eq('vendor_id',vid).order('event_date',{ascending:true,nullsFirst:false});
    if(!data)return;
    type CoupleRow={id:string;partner_name:string|null;avatar_url:string|null};
    type ProfileRow={id:string;full_name:string|null};
    type RRRow={booking_id:string};
    type BookingRow={couple_id:string;[k:string]:unknown};
    const coupleIds=[...new Set((data as BookingRow[]).map(b=>b.couple_id))];
    const [{data:rr},{data:couplesData},{data:profilesData}]=await Promise.all([
      supabase.from('review_requests').select('booking_id').eq('vendor_id',vid),
      supabase.from('couples').select('id,partner_name,avatar_url').in('id',coupleIds),
      supabase.from('profiles').select('id,full_name').in('id',coupleIds),
    ]);
    const reqIds=new Set(((rr||[]) as RRRow[]).map(r=>r.booking_id));
    const coupleMap=new Map(((couplesData||[]) as CoupleRow[]).map(c=>[c.id,c]));
    const profileMap=new Map(((profilesData||[]) as ProfileRow[]).map(p=>[p.id,p]));
    const enriched=(data as BookingRow[]).map(b=>{
      const c=coupleMap.get(b.couple_id);
      const p=profileMap.get(b.couple_id);
      const parts=[p?.full_name,c?.partner_name].filter(Boolean);
      return{...b,couple_name:parts.length>0?parts.join(' & '):'Unknown Couple',couple_avatar:c?.avatar_url||null,review_requested:reqIds.has(b.id)};
    });
    setBookings(enriched as Booking[]);
  };

  const loadBlocked=async(vid:string)=>{
    const {data}=await supabase.from('vendor_availability').select('id,blocked_date,reason,note').eq('vendor_id',vid);
    const m=new Map<string,BlockedDate>();
    (data||[]).forEach((r:any)=>m.set(r.blocked_date,r));
    setBlocked(m);
  };

  const handleMarkComplete=async(b:Booking)=>{
    setBookings(prev=>prev.map(bk=>bk.id===b.id?{...bk,status:'completed'}:bk));
    setActionSheet(null);
    const{error:e}=await supabase.from('bookings').update({status:'completed'}).eq('id',b.id);
    if(e){setBookings(prev=>prev.map(bk=>bk.id===b.id?{...bk,status:b.status}:bk));setError(e.message);}
    else showOk('Booking completed');
  };

  const handleReviewRequest=async(b:Booking)=>{
    setBookings(prev=>prev.map(bk=>bk.id===b.id?{...bk,review_requested:true}:bk));
    setActionSheet(null);
    try{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('No session');
      const res=await fetch('/api/vendor/review-request',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({bookingId:b.id,coupleId:b.couple_id})});
      if(!res.ok)throw new Error('Request failed');
      showOk('Review request sent!');
    }catch(e:any){
      setBookings(prev=>prev.map(bk=>bk.id===b.id?{...bk,review_requested:false}:bk));
      setError(e.message||'Failed');
    }
  };

  const handleSaveEventDate=async()=>{
    if(!editDateSheet||!editDateValue)return;
    const prev=editDateSheet.event_date;
    setBookings(bs=>bs.map(b=>b.id===editDateSheet.id?{...b,event_date:editDateValue}:b));
    setEditDateSheet(null);
    const{error:e}=await supabase.from('bookings').update({event_date:editDateValue}).eq('id',editDateSheet.id);
    if(e){setBookings(bs=>bs.map(b=>b.id===editDateSheet.id?{...b,event_date:prev}:b));setError(e.message);}
    else showOk('Event date saved');
  };

  const handleSaveNote=async()=>{
    if(!notesSheet)return;
    const snapshot=notesSheet.vendor_notes;
    const noteVal=noteDraft||null;
    setBookings(bs=>bs.map(b=>b.id===notesSheet.id?{...b,vendor_notes:noteVal}:b));
    setNotesSheet(null);
    const{error:e}=await supabase.from('bookings').update({vendor_notes:noteVal}).eq('id',notesSheet.id);
    if(e){setBookings(bs=>bs.map(b=>b.id===notesSheet.id?{...b,vendor_notes:snapshot}:b));setError(e.message);}
    else showOk('Note saved');
  };

  const prevMonth=()=>{if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1);};
  const nextMonth=()=>{if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1);};

  const calCells=useMemo(()=>{
    const first=new Date(viewYear,viewMonth,1).getDay();
    const dim=new Date(viewYear,viewMonth+1,0).getDate();
    const cells:(number|null)[]=[...Array(first).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
    while(cells.length%7!==0)cells.push(null);
    return cells;
  },[viewYear,viewMonth]);

  const cellKey=(day:number)=>`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const bookedDates=useMemo(()=>{const s=new Set<string>();bookings.filter(b=>b.status==='confirmed').forEach(b=>{if(b.event_date)s.add(b.event_date);});return s;},[bookings]);

  const onDayPress=(day:number)=>{
    const key=cellKey(day);if(key<todayKey())return;
    const ex=blocked.get(key);
    setBlockSheet({date:key,reason:ex?.reason||'unavailable',note:ex?.note||''});
  };

  const handleSaveBlock=async()=>{
    if(!blockSheet||!vendorId)return;setSavingBlock(true);setError(null);
    try{
      const ex=blocked.get(blockSheet.date);
      if(ex){
        await supabase.from('vendor_availability').update({reason:blockSheet.reason,note:blockSheet.note||null}).eq('id',ex.id);
        setBlocked(prev=>{const m=new Map(prev);m.set(blockSheet.date,{...ex,reason:blockSheet.reason,note:blockSheet.note||null});return m;});
      }else{
        const{data,error:e}=await supabase.from('vendor_availability').insert({vendor_id:vendorId,blocked_date:blockSheet.date,reason:blockSheet.reason,note:blockSheet.note||null}).select().single();
        if(e)throw e;
        setBlocked(prev=>{const m=new Map(prev);m.set(blockSheet.date,data);return m;});
      }
      showOk('Date blocked');
    }catch(e:any){setError(e.message||'Failed');}
    setSavingBlock(false);setBlockSheet(null);
  };

  const handleDeleteBlock=async()=>{
    if(!blockSheet)return;
    const ex=blocked.get(blockSheet.date);if(!ex){setBlockSheet(null);return;}
    setBlocked(prev=>{const m=new Map(prev);m.delete(blockSheet.date);return m;});
    setBlockSheet(null);
    const{error:e}=await supabase.from('vendor_availability').delete().eq('id',ex.id);
    if(e){setBlocked(prev=>{const m=new Map(prev);m.set(ex.blocked_date,ex);return m;});setError(e.message);}
    else showOk('Date unblocked');
  };

  const todayStr=new Date().toISOString().slice(0,10);
  const upcoming=bookings.filter(b=>b.status==='confirmed'&&(!b.event_date||b.event_date>=todayStr));
  const past=bookings.filter(b=>b.status==='completed'||b.status==='cancelled'||(b.status==='confirmed'&&b.event_date&&b.event_date<todayStr));
  const filtered=tab==='upcoming'?upcoming:tab==='past'?past:[];
  const upcomingBlocked=Array.from(blocked.values()).filter(b=>b.blocked_date>=todayKey()).sort((a,b)=>a.blocked_date.localeCompare(b.blocked_date));

  if(loading)return <LoadingPage />;

  return(
    <div style={{minHeight:'100svh',background:BG,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes bkSpin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        button{font-family:inherit!important}
      `}</style>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,var(--um-crimson-deep) 0%,${CR} 55%,var(--um-crimson-mid) 100%)`,padding:'20px 20px 0',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle,rgba(189,152,63,0.14) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18,position:'relative'}}>
          <Link href="/vendor/dashboard" style={{width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid rgba(255,255,255,0.15)',textDecoration:'none',flexShrink:0}}>
            <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </Link>
          <div style={{flex:1}}>
            <h1 style={{margin:0,fontSize:20,fontWeight:800,color:'#fff',fontFamily:'Georgia,serif'}}>Bookings & Calendar</h1>
            <p style={{margin:'2px 0 0',fontSize:11,color:'rgba(255,255,255,0.55)'}}>{upcoming.length} upcoming · {past.filter(b=>b.status==='completed').length} completed</p>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.12)'}}>
          {([['upcoming','Upcoming'],['past','Past'],['calendar','📅 Availability']] as const).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'10px 4px 12px',border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:0.3,color:tab===t?'#fff':'rgba(255,255,255,0.45)',borderBottom:tab===t?`2.5px solid ${GD}`:'2.5px solid transparent',transition:'all .15s'}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:560,margin:'0 auto',padding:'18px 16px 110px'}}>

        {error&&<div style={{padding:'11px 14px',borderRadius:12,background:'rgba(192,50,42,0.08)',border:'1.5px solid rgba(192,50,42,0.2)',marginBottom:14}}><p style={{margin:0,fontSize:13,color:'#c0322a',fontWeight:600}}>{error}</p></div>}
        {successMsg&&<div style={{padding:'11px 14px',borderRadius:12,background:'rgba(30,124,74,0.08)',border:'1.5px solid rgba(30,124,74,0.25)',marginBottom:14}}><p style={{margin:0,fontSize:13,color:GR,fontWeight:700}}>✓ {successMsg}</p></div>}

        {/* Bookings tabs */}
        {(tab==='upcoming'||tab==='past')&&(
          <>
            {filtered.length===0?(
              <div style={{background:'#fff',borderRadius:18,padding:'40px 20px',textAlign:'center',border:`1.5px solid ${BOR}`}}>
                <div style={{fontSize:36,marginBottom:10,opacity:.3}}>📋</div>
                <p style={{margin:'0 0 4px',fontSize:14,fontWeight:700,color:DK}}>{tab==='upcoming'?'No upcoming bookings':'No past bookings yet'}</p>
                <p style={{margin:0,fontSize:12,color:MUT}}>Bookings appear here once confirmed</p>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {filtered.map(booking=>{
                  const st=SS[booking.status];
                  const eventDate=booking.event_date?new Date(booking.event_date+'T00:00:00'):null;
                  const daysUntil=eventDate?Math.ceil((eventDate.getTime()-new Date().getTime())/86400000):null;
                  return(
                    <div key={booking.id} style={{background:'#fff',borderRadius:18,overflow:'hidden',border:`1.5px solid ${st.border}`,boxShadow:'0 2px 10px rgba(0,0,0,0.04)'}}>
                      <div style={{height:3,background:st.color}}/>
                      <div style={{padding:'16px 18px'}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
                          {booking.couple_avatar?<Image src={booking.couple_avatar} alt="" width={44} height={44} style={{borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                            :<div style={{width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${CR},${CR2})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:17,flexShrink:0}}>{(booking.couple_name||'C')[0].toUpperCase()}</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{margin:0,fontSize:15,fontWeight:800,color:DK}}>{booking.couple_name}</p>
                            <p style={{margin:'1px 0 0',fontSize:11.5,color:MUT}}>{booking.package_name}</p>
                          </div>
                          <span style={{fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,background:st.bg,color:st.color,border:`1px solid ${st.border}`,flexShrink:0}}>{st.label}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                          <div style={{background:BG,borderRadius:11,padding:'9px 12px'}}>
                            <p style={{margin:0,fontSize:9,fontWeight:700,color:MUT,textTransform:'uppercase',letterSpacing:.5}}>Event Date</p>
                            <p style={{margin:'3px 0 0',fontSize:13,fontWeight:700,color:DK}}>{eventDate?eventDate.toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'TBD'}</p>
                            {daysUntil!==null&&daysUntil>=0&&<p style={{margin:'1px 0 0',fontSize:10,fontWeight:700,color:daysUntil<=7?CR:GD2}}>{daysUntil===0?'🎊 Today!':`in ${daysUntil} day${daysUntil!==1?'s':''}`}</p>}
                          </div>
                          <div style={{background:BG,borderRadius:11,padding:'9px 12px'}}>
                            <p style={{margin:0,fontSize:9,fontWeight:700,color:MUT,textTransform:'uppercase',letterSpacing:.5}}>Price</p>
                            <p style={{margin:'3px 0 0',fontSize:14,fontWeight:800,color:CR,fontFamily:'Georgia,serif'}}>{fmtP(booking.confirmed_price)}</p>
                          </div>
                          {booking.event_location&&<div style={{background:BG,borderRadius:11,padding:'9px 12px',gridColumn:'1/-1'}}><p style={{margin:0,fontSize:9,fontWeight:700,color:MUT,textTransform:'uppercase',letterSpacing:.5}}>Location</p><p style={{margin:'3px 0 0',fontSize:13,color:DK}}>📍 {booking.event_location}</p></div>}
                          {booking.vendor_notes&&<div style={{background:'rgba(189,152,63,0.06)',borderRadius:11,padding:'9px 12px',gridColumn:'1/-1',border:`1px solid rgba(189,152,63,0.2)`}}><p style={{margin:0,fontSize:9,fontWeight:700,color:GD2,textTransform:'uppercase',letterSpacing:.5}}>My Note</p><p style={{margin:'3px 0 0',fontSize:12,color:'#6b4f1c'}}>{booking.vendor_notes}</p></div>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <span style={{fontSize:10,fontWeight:600,color:MUT}}>{booking.booking_ref}</span>
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>{setNoteDraft(booking.vendor_notes||'');setNotesSheet(booking);}} style={{fontSize:12,fontWeight:700,color:GD2,background:'rgba(189,152,63,0.08)',border:'none',borderRadius:20,padding:'6px 12px',cursor:'pointer'}}>📝 Note</button>
                            <button onClick={()=>setActionSheet(booking)} style={{fontSize:12,fontWeight:700,color:CR,background:'rgba(154,33,67,0.07)',border:'none',borderRadius:20,padding:'6px 14px',cursor:'pointer'}}>Actions</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Calendar tab */}
        {tab==='calendar'&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {Object.entries(RS).map(([k,v])=>(
                <div key={k} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:v.bg,border:`1px solid ${v.border}`}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:v.color}}/><span style={{fontSize:11,fontWeight:700,color:v.color}}>{v.label}</span>
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:'rgba(30,124,74,0.08)',border:'1px solid rgba(30,124,74,0.25)'}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:GR}}/><span style={{fontSize:11,fontWeight:700,color:GR}}>Wedding</span>
              </div>
            </div>

            <div style={{background:'#fff',borderRadius:18,border:`1.5px solid ${BOR}`,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:`1px solid ${BOR}`}}>
                <button onClick={prevMonth} style={{width:32,height:32,borderRadius:'50%',border:`1.5px solid ${BOR}`,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="12" height="12" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <p style={{margin:0,fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>{MONTHS[viewMonth]} {viewYear}</p>
                <button onClick={nextMonth} style={{width:32,height:32,borderRadius:'50%',border:`1.5px solid ${BOR}`,background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="12" height="12" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'10px 12px 4px'}}>
                {DAYS.map((d,i)=><div key={i} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#b0a0a8',letterSpacing:.3}}>{d}</div>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',padding:'0 12px 16px',gap:2}}>
                {calCells.map((day,i)=>{
                  if(!day)return<div key={i}/>;
                  const key=cellKey(day);
                  const bl=blocked.get(key)||null;
                  const bk=bookedDates.has(key)&&!bl;
                  const isPast=key<todayKey();
                  const isToday=key===todayKey();
                  const rs=bl?RS[bl.reason]:null;
                  let bg='transparent',border='1.5px solid transparent',color=isPast?'#c0a8b0':'#374151',fw:number=400;
                  if(isToday){bg='rgba(154,33,67,0.07)';border=`1.5px solid ${CR}`;color=CR;fw=800;}
                  if(bk){bg='rgba(30,124,74,0.08)';border=`1.5px solid rgba(30,124,74,0.3)`;color=GR;fw=700;}
                  if(bl){bg=rs!.bg;border=`1.5px solid ${rs!.color}40`;color=rs!.color;fw=700;}
                  return(
                    <div key={i} onClick={!isPast?()=>onDayPress(day):undefined} style={{height:38,borderRadius:9,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:bg,border,cursor:isPast?'default':'pointer',opacity:isPast?0.45:1,transition:'background .1s'}}>
                      <span style={{fontSize:12.5,fontWeight:fw,color,lineHeight:1}}>{day}</span>
                      {(bl||bk)&&<div style={{width:4,height:4,borderRadius:'50%',background:bl?rs!.color:GR}}/>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{padding:'13px 16px',borderRadius:14,background:'rgba(154,33,67,0.04)',border:`1.5px solid rgba(154,33,67,0.12)`,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:16}}>💡</span>
              <p style={{margin:0,fontSize:13,color:MUT,flex:1,lineHeight:1.5}}>Tap any future date to mark it unavailable. Green dates have confirmed bookings.</p>
            </div>

            {upcomingBlocked.length>0&&(
              <div>
                <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:DK}}>Upcoming blocked dates ({upcomingBlocked.length})</p>
                <div style={{background:'#fff',borderRadius:16,overflow:'hidden',border:`1.5px solid ${BOR}`}}>
                  {upcomingBlocked.slice(0,12).map((b,i,arr)=>{
                    const rs=RS[b.reason];const d=new Date(b.blocked_date+'T00:00:00');
                    return(
                      <div key={b.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<arr.length-1?`1px solid ${BOR}`:'none'}}>
                        <div style={{width:38,height:38,borderRadius:10,background:rs.bg,border:`1.5px solid ${rs.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <span style={{fontSize:13,fontWeight:800,color:rs.color,lineHeight:1}}>{d.getDate()}</span>
                          <span style={{fontSize:8,color:rs.color,fontWeight:700,letterSpacing:.3}}>{MONTHS[d.getMonth()].slice(0,3).toUpperCase()}</span>
                        </div>
                        <div style={{flex:1}}><p style={{margin:0,fontSize:13,fontWeight:700,color:DK}}>{rs.label}</p>{b.note&&<p style={{margin:'2px 0 0',fontSize:11,color:MUT}}>{b.note}</p>}</div>
                        <button onClick={()=>setBlockSheet({date:b.blocked_date,reason:b.reason,note:b.note||''})} style={{fontSize:11.5,color:CR,fontWeight:700,background:'rgba(154,33,67,0.07)',border:'none',borderRadius:20,padding:'5px 12px',cursor:'pointer'}}>Edit</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action sheet */}
      {actionSheet&&(
        <>
          <div onClick={()=>setActionSheet(null)} style={{position:'fixed',inset:0,background:'rgba(26,13,18,0.5)',zIndex:60,animation:'fadeIn .2s ease'}}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderRadius:'24px 24px 0 0',zIndex:70,animation:'slideUp .25s ease',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto'}}>
            <div style={{width:40,height:4,background:'rgba(154,33,67,0.15)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{padding:'20px 20px 24px'}}>
              <p style={{margin:'0 0 2px',fontSize:17,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>{actionSheet.couple_name}</p>
              <p style={{margin:'0 0 20px',fontSize:12,color:MUT}}>{actionSheet.booking_ref} · {actionSheet.package_name}</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {actionSheet.status==='confirmed'&&(
                  <button onClick={()=>handleMarkComplete(actionSheet)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid rgba(30,124,74,0.25)`,background:'rgba(30,124,74,0.06)',cursor:'pointer'}}>
                    <div style={{width:38,height:38,borderRadius:10,background:'rgba(30,124,74,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>✅</div>
                    <div style={{textAlign:'left'}}><p style={{margin:0,fontSize:14,fontWeight:700,color:GR}}>Mark as Completed</p><p style={{margin:'2px 0 0',fontSize:11,color:'#5a9c78'}}>Wedding day done</p></div>
                  </button>
                )}
                {(actionSheet.status==='confirmed'||actionSheet.status==='completed')&&!actionSheet.review_requested&&(
                  <button onClick={()=>handleReviewRequest(actionSheet)} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid rgba(189,152,63,0.3)`,background:'rgba(189,152,63,0.06)',cursor:'pointer'}}>
                    <div style={{width:38,height:38,borderRadius:10,background:'rgba(189,152,63,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>⭐</div>
                    <div style={{textAlign:'left'}}><p style={{margin:0,fontSize:14,fontWeight:700,color:GD2}}>Request a Review</p><p style={{margin:'2px 0 0',fontSize:11,color:'#a08040'}}>Send WhatsApp review link</p></div>
                  </button>
                )}
                {actionSheet.review_requested&&(
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid rgba(30,124,74,0.25)`,background:'rgba(30,124,74,0.06)'}}>
                    <div style={{width:38,height:38,borderRadius:10,background:'rgba(30,124,74,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>✓</div>
                    <div><p style={{margin:0,fontSize:14,fontWeight:700,color:GR}}>Review request sent</p><p style={{margin:'2px 0 0',fontSize:11,color:'#5a9c78'}}>Waiting for couple</p></div>
                  </div>
                )}
                <button onClick={()=>{setNoteDraft(actionSheet.vendor_notes||'');setNotesSheet(actionSheet);setActionSheet(null);}} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid rgba(189,152,63,0.25)`,background:'rgba(189,152,63,0.05)',cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(189,152,63,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📝</div>
                  <div style={{textAlign:'left'}}><p style={{margin:0,fontSize:14,fontWeight:700,color:GD2}}>Add / edit note</p><p style={{margin:'2px 0 0',fontSize:11,color:'#a08040'}}>Private — only you see this</p></div>
                </button>
                <button onClick={()=>{setEditDateValue(actionSheet.event_date||'');setEditDateSheet(actionSheet);setActionSheet(null);}} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid ${BOR}`,background:BG,cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(0,0,0,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📅</div>
                  <div style={{textAlign:'left'}}><p style={{margin:0,fontSize:14,fontWeight:700,color:DK}}>{actionSheet.event_date?'Change event date':'Set event date'}</p><p style={{margin:'2px 0 0',fontSize:11,color:MUT}}>{actionSheet.event_date||'Currently TBD'}</p></div>
                </button>
                <Link href="/messages" style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`1.5px solid rgba(29,111,168,0.25)`,background:'rgba(29,111,168,0.06)',textDecoration:'none'}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'rgba(29,111,168,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>💬</div>
                  <div><p style={{margin:0,fontSize:14,fontWeight:700,color:BL}}>Message Couple</p></div>
                </Link>
              </div>
              <button onClick={()=>setActionSheet(null)} style={{width:'100%',marginTop:14,padding:'13px',borderRadius:14,border:'none',background:'#f4ede8',color:MUT,fontSize:13,fontWeight:700,cursor:'pointer'}}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* Notes sheet */}
      {notesSheet&&(
        <>
          <div onClick={()=>setNotesSheet(null)} style={{position:'fixed',inset:0,background:'rgba(26,13,18,0.5)',zIndex:60,animation:'fadeIn .2s ease'}}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderRadius:'24px 24px 0 0',zIndex:70,animation:'slideUp .25s ease',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto'}}>
            <div style={{width:40,height:4,background:'rgba(154,33,67,0.15)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{padding:'20px 20px 24px'}}>
              <p style={{margin:'0 0 4px',fontSize:16,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>Private Note</p>
              <p style={{margin:'0 0 16px',fontSize:12,color:MUT}}>{notesSheet.couple_name} · {notesSheet.booking_ref}</p>
              <textarea value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="e.g. Bride prefers ivory linens. Final payment due 1 week before." rows={4} style={{width:'100%',padding:'12px 14px',borderRadius:12,border:`1.5px solid ${BOR}`,fontSize:13,color:DK,fontFamily:'inherit',resize:'none',outline:'none',boxSizing:'border-box',marginBottom:16}}/>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setNotesSheet(null)} style={{flex:1,padding:'13px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',color:MUT,fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                <button onClick={handleSaveNote} style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:`linear-gradient(135deg,${GD},${GD2})`,color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}}>Save note</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Block date sheet */}
      {blockSheet&&(
        <>
          <div onClick={()=>setBlockSheet(null)} style={{position:'fixed',inset:0,background:'rgba(26,13,18,0.5)',zIndex:60,animation:'fadeIn .2s ease'}}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderRadius:'24px 24px 0 0',zIndex:70,animation:'slideUp .3s ease',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto'}}>
            <div style={{width:40,height:4,background:'rgba(154,33,67,0.15)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{padding:'20px 20px 24px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
                <div>
                  <p style={{margin:0,fontSize:16,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>{new Date(blockSheet.date+'T00:00:00').toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
                  <p style={{margin:'3px 0 0',fontSize:11,color:MUT}}>{blocked.has(blockSheet.date)?'Edit this blocked date':'Block this date'}</p>
                </div>
                {blocked.has(blockSheet.date)&&<button onClick={handleDeleteBlock} disabled={savingBlock} style={{fontSize:12,fontWeight:700,color:'#c0322a',background:'rgba(192,50,42,0.07)',border:'none',borderRadius:20,padding:'6px 14px',cursor:'pointer'}}>Unblock</button>}
              </div>
              <p style={{margin:'0 0 10px',fontSize:11,fontWeight:800,color:MUT,textTransform:'uppercase',letterSpacing:.8}}>Reason</p>
              <div style={{display:'flex',gap:8,marginBottom:18}}>
                {(Object.entries(RS) as [Reason,any][]).map(([key,val])=>(
                  <button key={key} onClick={()=>setBlockSheet(s=>s?{...s,reason:key}:s)} style={{flex:1,padding:'10px 4px',borderRadius:12,border:'none',cursor:'pointer',background:blockSheet.reason===key?val.bg:BG,color:blockSheet.reason===key?val.color:MUT,fontWeight:blockSheet.reason===key?800:500,fontSize:12,outline:blockSheet.reason===key?`2px solid ${val.color}`:'2px solid transparent',transition:'all .13s'}}>{val.label}</button>
                ))}
              </div>
              <p style={{margin:'0 0 8px',fontSize:11,fontWeight:800,color:MUT,textTransform:'uppercase',letterSpacing:.8}}>Private note (optional)</p>
              <textarea value={blockSheet.note} onChange={e=>setBlockSheet(s=>s?{...s,note:e.target.value}:s)} placeholder="e.g. Family event, travelling, another booking" style={{width:'100%',height:72,padding:'10px 14px',borderRadius:12,border:`1.5px solid ${BOR}`,fontSize:13,color:DK,fontFamily:'inherit',resize:'none',outline:'none',boxSizing:'border-box',marginBottom:18}}/>
              <button onClick={handleSaveBlock} disabled={savingBlock} style={{width:'100%',height:50,borderRadius:14,border:'none',cursor:savingBlock?'default':'pointer',fontSize:14,fontWeight:800,background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',boxShadow:'0 4px 16px rgba(154,33,67,0.28)',opacity:savingBlock?.7:1}}>
                {savingBlock?'Saving…':blocked.has(blockSheet.date)?'Update date':'Block date'}
              </button>
            </div>
          </div>
        </>
      )}

      {editDateSheet&&(
        <>
          <div onClick={()=>setEditDateSheet(null)} style={{position:'fixed',inset:0,background:'rgba(26,13,18,0.5)',zIndex:60,animation:'fadeIn .2s ease'}}/>
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderRadius:'24px 24px 0 0',zIndex:70,animation:'slideUp .25s ease',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto'}}>
            <div style={{width:40,height:4,background:'rgba(154,33,67,0.15)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{padding:'20px 20px 24px'}}>
              <p style={{margin:'0 0 2px',fontSize:16,fontWeight:800,color:DK,fontFamily:'Georgia,serif'}}>Event Date</p>
              <p style={{margin:'0 0 18px',fontSize:12,color:MUT}}>{editDateSheet.couple_name} · {editDateSheet.booking_ref}</p>
              <input type="date" value={editDateValue} onChange={e=>setEditDateValue(e.target.value)}
                style={{width:'100%',padding:'13px 14px',borderRadius:12,border:`1.5px solid ${BOR}`,fontSize:15,color:DK,fontFamily:'inherit',outline:'none',boxSizing:'border-box',marginBottom:18}}/>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setEditDateSheet(null)} style={{flex:1,padding:'13px',borderRadius:13,border:`1.5px solid ${BOR}`,background:'#fff',color:MUT,fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
                <button onClick={handleSaveEventDate} disabled={!editDateValue} style={{flex:2,padding:'13px',borderRadius:13,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:14,fontWeight:800,cursor:editDateValue?'pointer':'default',opacity:editDateValue?1:0.5}}>Save date</button>
              </div>
            </div>
          </div>
        </>
      )}

      <VendorBottomNav/>
    </div>
  );
}
