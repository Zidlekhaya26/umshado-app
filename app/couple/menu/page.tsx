'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import { CR, CR2, GD2, DK, MUT, BOR, BG } from '@/lib/tokens';

/* ─── Tokens ─────────────────────────────────────────────── */
const DK='var(--um-dark)', MUT='var(--um-muted)', BG='var(--um-ivory)', BOR='rgba(154,33,67,0.1)';
const SURF='#fff';

/* ─── Course definitions ─────────────────────────────────── */
const COURSES = [
  { id: 'starter',   label: 'Starters',        icon: '🥗', color: '#5a7a40', desc: 'Soups, salads & small plates' },
  { id: 'main',      label: 'Mains',            icon: '🍽️', color: CR,        desc: 'Primary dishes for all guests' },
  { id: 'dessert',   label: 'Desserts',         icon: '🍰', color: '#b8517a', desc: 'Sweet endings & cake options' },
  { id: 'drinks',    label: 'Drinks',           icon: '🥂', color: GD2,       desc: 'Beverages & bar selections' },
  { id: 'kids',      label: "Kids' Menu",       icon: '🧒', color: '#6a7ab8',  desc: 'Simple dishes for little ones' },
  { id: 'dietary',   label: 'Dietary Options',  icon: '🌿', color: '#4a8a6a', desc: 'Vegan, halal, gluten-free etc.' },
];

interface MenuItem {
  id: string;
  couple_id: string;
  course: string;
  name: string;
  description: string | null;
  dietary_notes: string | null;
  sort_order: number;
  created_at: string;
}

/* ─── Shimmer ─────────────────────────────────────────────── */
function Skel({ h=14, w='100%', r=8 }: { h?: number; w?: string | number; r?: number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,#f0ebe4 25%,#faf5ee 50%,#f0ebe4 75%)', backgroundSize: '400px 100%', animation: 'mnShimmer 1.4s infinite linear' }} />
  );
}

/* ─── Add item sheet ─────────────────────────────────────── */
function AddItemSheet({ courseId, onClose, onAdd }: {
  courseId: string;
  onClose: () => void;
  onAdd: (item: { name: string; description: string; dietary_notes: string }) => void;
}) {
  const [name, setName]           = useState('');
  const [desc, setDesc]           = useState('');
  const [dietary, setDietary]     = useState('');
  const [err, setErr]             = useState('');
  const course = COURSES.find(c => c.id === courseId)!;

  const submit = () => {
    if (!name.trim()) { setErr('Dish name is required'); return; }
    onAdd({ name: name.trim(), description: desc.trim(), dietary_notes: dietary.trim() });
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:60 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:70,background:'#fff',borderRadius:'22px 22px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'mnSlideUp .22s ease' }}>
        <div style={{ width:38,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'18px 20px 28px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:`${course.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{course.icon}</div>
            <div>
              <p style={{ margin:0,fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Add a dish</p>
              <p style={{ margin:0,fontSize:11,color:MUT }}>{course.label}</p>
            </div>
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>DISH NAME *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Prawn Cocktail"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>DESCRIPTION (optional)</label>
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Served with Marie Rose sauce"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:MUT,letterSpacing:.4 }}>DIETARY NOTES (optional)</label>
              <input value={dietary} onChange={e=>setDietary(e.target.value)} placeholder="e.g. vegan, gluten-free, halal"
                style={{ width:'100%',marginTop:5,padding:'12px',borderRadius:11,border:`1.5px solid ${BOR}`,fontSize:14,color:DK,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} />
            </div>
          </div>

          {err && <p style={{ color:CR,fontSize:12,marginTop:8 }}>{err}</p>}

          <button onClick={submit} style={{ width:'100%',marginTop:18,padding:14,borderRadius:13,border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer' }}>
            Add Dish
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Share sheet ─────────────────────────────────────────── */
function ShareSheet({ items, onClose }: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const buildMenuText = () => {
    const lines: string[] = ['🍽️ *OUR WEDDING MENU*\n'];
    COURSES.forEach(c => {
      const courseItems = items.filter(i => i.course === c.id);
      if (courseItems.length === 0) return;
      lines.push(`*${c.icon} ${c.label.toUpperCase()}*`);
      courseItems.forEach(item => {
        let line = `• ${item.name}`;
        if (item.description) line += ` – ${item.description}`;
        if (item.dietary_notes) line += ` _(${item.dietary_notes})_`;
        lines.push(line);
      });
      lines.push('');
    });
    lines.push('_Prepared with love for our special day_ 💍');
    return lines.join('\n');
  };

  const sendViaWhatsApp = () => {
    const text = encodeURIComponent(buildMenuText());
    const a = document.createElement('a');
    a.href = `https://wa.me/?text=${text}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(buildMenuText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const courseCount = COURSES.filter(c => items.some(i => i.course === c.id)).length;
  const totalItems  = items.length;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(26,13,18,0.55)',zIndex:60 }} />
      <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:70,background:'#fff',borderRadius:'22px 22px 0 0',padding:'0 0 env(safe-area-inset-bottom)',maxWidth:560,margin:'0 auto',animation:'mnSlideUp .22s ease' }}>
        <div style={{ width:38,height:4,background:BOR,borderRadius:2,margin:'12px auto 0' }} />
        <div style={{ padding:'20px 20px 28px' }}>
          <p style={{ margin:'0 0 4px',fontSize:17,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>Share your menu</p>
          <p style={{ margin:'0 0 22px',fontSize:12,color:MUT }}>{totalItems} dishes across {courseCount} course{courseCount!==1?'s':''}</p>

          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {/* WhatsApp to caterer */}
            <button onClick={sendViaWhatsApp} style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:15,border:'1.5px solid rgba(37,211,102,0.3)',background:'rgba(37,211,102,0.05)',cursor:'pointer',textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:13,background:'#25d166',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <p style={{ margin:'0 0 2px',fontSize:14,fontWeight:800,color:DK }}>Send to caterer via WhatsApp</p>
                <p style={{ margin:0,fontSize:12,color:MUT }}>Share full menu with course breakdowns</p>
              </div>
            </button>

            {/* Copy text */}
            <button onClick={copyText} style={{ display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:15,border:`1.5px solid ${BOR}`,background:'rgba(154,33,67,0.04)',cursor:'pointer',textAlign:'left' }}>
              <div style={{ width:44,height:44,borderRadius:13,background:`linear-gradient(135deg,${CR},${CR2})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:22 }}>
                📋
              </div>
              <div>
                <p style={{ margin:'0 0 2px',fontSize:14,fontWeight:800,color:DK }}>{copied ? '✓ Copied!' : 'Copy menu text'}</p>
                <p style={{ margin:0,fontSize:12,color:MUT }}>Paste into any chat or email</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Dish row ────────────────────────────────────────────── */
function DishRow({ item, onDelete }: { item: MenuItem; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:`1px solid ${BOR}`,position:'relative' }}>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ margin:'0 0 1px',fontSize:13,fontWeight:700,color:DK,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.name}</p>
        {item.description && <p style={{ margin:'0 0 2px',fontSize:11,color:MUT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.description}</p>}
        {item.dietary_notes && (
          <span style={{ fontSize:10,fontWeight:700,color:GD2,background:'rgba(189,152,63,0.1)',padding:'1px 7px',borderRadius:20 }}>{item.dietary_notes}</span>
        )}
      </div>
      <button onClick={() => setOpen(p => !p)} style={{ width:30,height:30,borderRadius:'50%',border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:MUT,fontSize:18,flexShrink:0 }}>⋯</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed',inset:0,zIndex:30 }} />
          <div style={{ position:'absolute',right:8,top:42,background:'#fff',borderRadius:14,boxShadow:'0 8px 28px rgba(26,13,18,0.16)',zIndex:40,minWidth:150,overflow:'hidden' }}>
            <button onClick={() => { setOpen(false); onDelete(); }} style={{ width:'100%',padding:'12px 16px',border:'none',background:'none',textAlign:'left',fontSize:13,color:CR,cursor:'pointer',display:'block' }}>🗑️ Remove</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function WeddingMenuPage() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [coupleId, setCoupleId]       = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<string>('starter');
  const [addSheet, setAddSheet]       = useState(false);
  const [shareOpen, setShareOpen]     = useState(false);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const showOk = (m: string) => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(null), 3000); };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/sign-in'); return; }
      setCoupleId(user.id);
      const { data } = await supabase
        .from('wedding_menu')
        .select('*')
        .eq('couple_id', user.id)
        .order('course').order('sort_order');
      setItems(data || []);
      setLoading(false);
    })();
  }, [router]);

  const addItem = async (draft: { name: string; description: string; dietary_notes: string }) => {
    if (!coupleId) return;
    const existing = items.filter(i => i.course === activeCourse);
    const { data, error } = await supabase.from('wedding_menu').insert({
      couple_id: coupleId,
      course: activeCourse,
      name: draft.name,
      description: draft.description || null,
      dietary_notes: draft.dietary_notes || null,
      sort_order: existing.length,
    }).select().single();
    if (!error && data) {
      setItems(p => [...p, data]);
      setAddSheet(false);
      showOk(`"${draft.name}" added to ${COURSES.find(c=>c.id===activeCourse)?.label}`);
    }
  };

  const deleteItem = async (id: string) => {
    await supabase.from('wedding_menu').delete().eq('id', id);
    setItems(p => p.filter(i => i.id !== id));
    showOk('Dish removed');
  };

  const courseItems    = useMemo(() => items.filter(i => i.course === activeCourse), [items, activeCourse]);
  const totalItems     = items.length;
  const activeCourseData = COURSES.find(c => c.id === activeCourse)!;

  return (
    <div style={{ minHeight:'100svh',background:BG,fontFamily:'system-ui,sans-serif' }}>
      <style>{`
        @keyframes mnShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes mnSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes mnToast{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        button,a{font-family:inherit!important}
        ::-webkit-scrollbar{display:none}
      `}</style>

      <div style={{ maxWidth:600,margin:'0 auto',paddingBottom:100 }}>

        {/* ── Header ── */}
        <div style={{ background:`linear-gradient(160deg,var(--um-crimson-deep) 0%,${CR} 55%,var(--um-crimson-mid) 100%)`,padding:'20px 20px 18px',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:-50,right:-50,width:180,height:180,borderRadius:'50%',background:'rgba(189,152,63,0.1)',pointerEvents:'none' }} />

          <div style={{ display:'flex',alignItems:'center',gap:10,position:'relative' }}>
            <button onClick={() => router.back()} style={{ width:34,height:34,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <h1 style={{ margin:0,fontSize:20,fontWeight:700,color:'#fff',fontFamily:'Georgia,serif' }}>Wedding Menu</h1>
              <p style={{ margin:0,fontSize:11,color:'rgba(255,255,255,0.65)' }}>
                {loading ? 'Loading…' : `${totalItems} dish${totalItems!==1?'es':''} across ${COURSES.filter(c=>items.some(i=>i.course===c.id)).length} courses`}
              </p>
            </div>
            <button onClick={() => setShareOpen(true)} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:20,border:'1.5px solid rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.12)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              Share
            </button>
          </div>
        </div>

        {/* ── Course selector ── */}
        <div style={{ overflowX:'auto',padding:'14px 16px 0',display:'flex',gap:8,scrollbarWidth:'none' }}>
          {COURSES.map(c => {
            const count = items.filter(i => i.course === c.id).length;
            const isActive = activeCourse === c.id;
            return (
              <button key={c.id} onClick={() => setActiveCourse(c.id)}
                style={{ flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 12px',borderRadius:14,border:isActive?`2px solid ${c.color}`:`1.5px solid ${BOR}`,background:isActive?`${c.color}12`:SURF,cursor:'pointer',minWidth:64,transition:'all .15s' }}>
                <span style={{ fontSize:20 }}>{c.icon}</span>
                <span style={{ fontSize:9,fontWeight:700,color:isActive?c.color:MUT,letterSpacing:.3,textAlign:'center',lineHeight:1.3 }}>{c.label.split(' ').slice(0,2).join('\n')}</span>
                {count > 0 && <span style={{ fontSize:9,fontWeight:800,width:18,height:18,borderRadius:9,background:c.color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Active course panel ── */}
        <div style={{ padding:'14px 16px' }}>
          <div style={{ background:SURF,borderRadius:20,overflow:'hidden',boxShadow:'0 2px 12px rgba(26,13,18,0.07)',border:`1.5px solid ${BOR}` }}>
            {/* Course header */}
            <div style={{ padding:'16px 18px 14px',borderBottom:`1px solid ${BOR}`,display:'flex',alignItems:'center',gap:12 }}>
              <div style={{ width:44,height:44,borderRadius:13,background:`${activeCourseData.color}12`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>{activeCourseData.icon}</div>
              <div style={{ flex:1 }}>
                <p style={{ margin:'0 0 2px',fontSize:15,fontWeight:800,color:DK,fontFamily:'Georgia,serif' }}>{activeCourseData.label}</p>
                <p style={{ margin:0,fontSize:11,color:MUT }}>{activeCourseData.desc}</p>
              </div>
              <button onClick={() => setAddSheet(true)} style={{ width:36,height:36,borderRadius:'50%',border:'none',background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>+</button>
            </div>

            {/* Items */}
            {loading ? (
              <div style={{ padding:16,display:'flex',flexDirection:'column',gap:10 }}>
                {[1,2].map(i => <Skel key={i} h={50} />)}
              </div>
            ) : courseItems.length === 0 ? (
              <div style={{ padding:'32px 20px',textAlign:'center' }}>
                <p style={{ margin:'0 0 4px',fontSize:28,opacity:.25 }}>{activeCourseData.icon}</p>
                <p style={{ margin:'0 0 4px',fontSize:14,fontWeight:700,color:DK }}>No dishes yet</p>
                <p style={{ margin:'0 0 16px',fontSize:12,color:MUT }}>{activeCourseData.desc}</p>
                <button onClick={() => setAddSheet(true)} style={{ padding:'10px 22px',borderRadius:20,border:`1.5px solid ${BOR}`,background:'#fff',color:DK,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                  + Add first dish
                </button>
              </div>
            ) : (
              courseItems.map(item => (
                <DishRow key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
              ))
            )}

            {courseItems.length > 0 && (
              <button onClick={() => setAddSheet(true)} style={{ width:'100%',padding:'13px',border:'none',borderTop:`1px solid ${BOR}`,background:'none',color:CR,fontSize:13,fontWeight:700,cursor:'pointer' }}>
                + Add another dish
              </button>
            )}
          </div>

          {/* Menu overview */}
          {items.length > 0 && (
            <div style={{ marginTop:16 }}>
              <p style={{ margin:'0 0 10px',fontSize:13,fontWeight:700,color:DK,fontFamily:'Georgia,serif' }}>Menu overview</p>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {COURSES.filter(c => items.some(i => i.course === c.id)).map(c => {
                  const count = items.filter(i => i.course === c.id).length;
                  return (
                    <button key={c.id} onClick={() => setActiveCourse(c.id)}
                      style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:13,border:`1.5px solid ${activeCourse===c.id?c.color:BOR}`,background:activeCourse===c.id?`${c.color}08`:SURF,cursor:'pointer',textAlign:'left' }}>
                      <span style={{ fontSize:18,flexShrink:0 }}>{c.icon}</span>
                      <span style={{ flex:1,fontSize:13,fontWeight:600,color:DK }}>{c.label}</span>
                      <span style={{ fontSize:11,color:MUT }}>{count} dish{count!==1?'es':''}</span>
                      <svg width="12" height="12" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  );
                })}
              </div>

              {/* Share CTA */}
              <div style={{ marginTop:14,padding:'16px 18px',borderRadius:18,background:`linear-gradient(135deg,${CR},${CR2})`,color:'#fff' }}>
                <p style={{ margin:'0 0 4px',fontSize:14,fontWeight:700,fontFamily:'Georgia,serif' }}>Ready to share with your caterer?</p>
                <p style={{ margin:'0 0 14px',fontSize:11,color:'rgba(255,255,255,0.7)' }}>Send your full menu via WhatsApp in seconds</p>
                <button onClick={() => setShareOpen(true)} style={{ padding:'9px 18px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.15)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                  Share menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {successMsg && (
        <div style={{ position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:DK,color:'#fff',padding:'11px 18px',borderRadius:14,fontSize:13,fontWeight:700,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',zIndex:80,whiteSpace:'nowrap',animation:'mnToast .22s ease' }}>
          {successMsg}
        </div>
      )}

      {/* Sheets */}
      {addSheet && <AddItemSheet courseId={activeCourse} onClose={() => setAddSheet(false)} onAdd={addItem} />}
      {shareOpen && <ShareSheet items={items} onClose={() => setShareOpen(false)} />}

      <BottomNav />
    </div>
  );
}
