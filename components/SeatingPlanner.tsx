'use client';
import { useEffect, useState, useCallback } from 'react';

const G  = '#b8973e';
const G2 = '#8a6010';
const IVORY = '#faf7f2';
const STORAGE_KEY = 'umshado_seating_v2';

interface SeatTable {
  id: string;
  name: string;
  seats: (string | null)[];
}

interface GuestRef {
  id: string;
  full_name: string;
  rsvp_status: 'pending' | 'accepted' | 'declined';
  plus_one?: boolean;
}

interface Props {
  guests?: GuestRef[];
  onApply?: (payload: any) => void;
}

function uid() {
  return typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function SeatingPlanner({ guests = [], onApply }: Props) {
  const [open, setOpen]               = useState(false);
  const [tables, setTables]           = useState<SeatTable[]>([]);
  const [selected, setSelected]       = useState<string | null>(null);
  const [newName, setNewName]         = useState('');
  const [newSeats, setNewSeats]       = useState(8);
  const [activeTable, setActiveTable] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTables(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: SeatTable[]) => {
    setTables(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const addTable = () => {
    const name = newName.trim() || `Table ${tables.length + 1}`;
    persist([...tables, { id: uid(), name, seats: Array(newSeats).fill(null) }]);
    setNewName('');
  };

  const removeTable = (id: string) => {
    persist(tables.filter(t => t.id !== id));
    if (activeTable === id) setActiveTable(null);
  };

  const assignToSeat = (tableId: string, seatIdx: number) => {
    if (!selected) return;
    persist(tables.map(t => {
      const seats = t.seats.map(s => s === selected ? null : s);
      if (t.id === tableId) seats[seatIdx] = selected;
      return { ...t, seats };
    }));
    setSelected(null);
  };

  const clearSeat = (tableId: string, seatIdx: number) => {
    persist(tables.map(t =>
      t.id === tableId ? { ...t, seats: t.seats.map((s, i) => i === seatIdx ? null : s) } : t
    ));
  };

  const clearAll = () => persist(tables.map(t => ({ ...t, seats: Array(t.seats.length).fill(null) })));

  const apply = () => {
    const payload = { tables: tables.map(t => ({ id: t.id, name: t.name, seats: t.seats })) };
    try { sessionStorage.setItem('active_seating_payload', JSON.stringify(payload)); } catch {}
    if (onApply) onApply(payload);
    try { window.dispatchEvent(new CustomEvent('umshado:seatingApplied', { detail: payload })); } catch {}
    setOpen(false);
  };

  const guestName  = (id: string) => guests.find(g => g.id === id)?.full_name ?? '?';
  const assignedIds = new Set(tables.flatMap(t => t.seats.filter(Boolean) as string[]));
  const unassigned  = guests.filter(g => !assignedIds.has(g.id));
  const totalSeats  = tables.reduce((s, t) => s + t.seats.length, 0);
  const totalFilled = assignedIds.size;
  const active      = tables.find(t => t.id === activeTable) ?? tables[0] ?? null;

  const statusDot = (id: string) => {
    const s = guests.find(g => g.id === id)?.rsvp_status;
    return s === 'accepted' ? '#3d9e6a' : s === 'declined' ? '#e04444' : '#b8973e';
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderRadius:16, background:`linear-gradient(135deg,${G},${G2})`, color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 4px 16px rgba(184,151,62,0.3)' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>💺</span>
          <div style={{ textAlign:'left' }}>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#fff' }}>Seating Arrangement</p>
            <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.88)' }}>
              {tables.length === 0 ? 'Tap to set up tables & seats' : `${tables.length} table${tables.length !== 1 ? 's' : ''} · ${totalFilled}/${totalSeats} seats filled`}
            </p>
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>

      {/* Full-screen modal */}
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:70, display:'flex', flexDirection:'column' }}>
          <div style={{ flex:1, background:IVORY, display:'flex', flexDirection:'column', maxWidth:640, width:'100%', margin:'0 auto', overflow:'hidden' }}>

            {/* Header */}
            <div style={{ background:`linear-gradient(135deg,${G},${G2})`, padding:'18px 20px 14px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div>
                  <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.6)', letterSpacing:2, textTransform:'uppercase' }}>Planner</p>
                  <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:'#fff', fontFamily:'Georgia,serif' }}>Seating Arrangement</h2>
                </div>
                <button onClick={() => setOpen(false)} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.1)', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'6px 14px', textAlign:'center' }}>
                  <p style={{ margin:0, fontSize:18, fontWeight:700, color:'#fff' }}>{tables.length}</p>
                  <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.7)' }}>Tables</p>
                </div>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'6px 14px', textAlign:'center' }}>
                  <p style={{ margin:0, fontSize:18, fontWeight:700, color:'#fff' }}>{totalFilled}</p>
                  <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.7)' }}>Seated</p>
                </div>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'6px 14px', textAlign:'center' }}>
                  <p style={{ margin:0, fontSize:18, fontWeight:700, color:'#fff' }}>{unassigned.length}</p>
                  <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.7)' }}>Unassigned</p>
                </div>
              </div>
            </div>

            {/* Body — scrollable */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 0' }}>

              {/* Add Table */}
              <div style={{ background:'#fff', borderRadius:16, padding:'14px 16px', marginBottom:14, border:'1px solid rgba(184,151,62,0.2)' }}>
                <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:'#3d2510' }}>Add a Table</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <input
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Table name (e.g. VIP, Family)"
                    style={{ flex:1, minWidth:120, height:38, borderRadius:10, border:'1.5px solid rgba(184,151,62,0.3)', padding:'0 12px', fontSize:13, outline:'none', background:'#faf7f2' }}
                  />
                  <select value={newSeats} onChange={e => setNewSeats(Number(e.target.value))}
                    style={{ height:38, borderRadius:10, border:'1.5px solid rgba(184,151,62,0.3)', padding:'0 10px', fontSize:13, background:'#faf7f2', color:'#3d2510', outline:'none' }}>
                    {[4,6,8,10,12].map(n => <option key={n} value={n}>{n} seats</option>)}
                  </select>
                  <button onClick={addTable}
                    style={{ height:38, padding:'0 16px', borderRadius:10, background:`linear-gradient(135deg,${G},${G2})`, color:'#fff', fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>
                    + Add
                  </button>
                </div>
              </div>

              {tables.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'#9a7c58' }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>🪑</div>
                  <p style={{ margin:0, fontSize:14, fontWeight:600 }}>No tables yet</p>
                  <p style={{ margin:'4px 0 0', fontSize:12 }}>Add a table above to start arranging guests</p>
                </div>
              ) : (
                <>
                  {/* Table selector tabs */}
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:12, scrollbarWidth:'none' }}>
                    {tables.map(t => (
                      <button key={t.id} onClick={() => setActiveTable(t.id)}
                        style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, border:`1.5px solid ${activeTable === t.id || (!activeTable && tables[0]?.id === t.id) ? G : 'rgba(184,151,62,0.25)'}`, background: activeTable === t.id || (!activeTable && tables[0]?.id === t.id) ? `linear-gradient(135deg,${G},${G2})` : '#fff', color: activeTable === t.id || (!activeTable && tables[0]?.id === t.id) ? '#fff' : '#7a5c30', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                        {t.name} ({t.seats.filter(Boolean).length}/{t.seats.length})
                      </button>
                    ))}
                  </div>

                  {/* Active table seat grid */}
                  {active && (
                    <div style={{ background:'#fff', borderRadius:16, padding:'14px 16px', marginBottom:14, border:'1px solid rgba(184,151,62,0.2)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#3d2510', fontFamily:'Georgia,serif' }}>{active.name}</p>
                        <button onClick={() => removeTable(active.id)}
                          style={{ fontSize:11, padding:'3px 10px', borderRadius:20, border:'1px solid rgba(200,50,50,0.3)', background:'rgba(200,50,50,0.06)', color:'#c83232', cursor:'pointer', fontWeight:600 }}>
                          Remove Table
                        </button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                        {active.seats.map((guestId, idx) => (
                          <div key={idx}
                            onClick={() => guestId ? clearSeat(active.id, idx) : assignToSeat(active.id, idx)}
                            style={{ borderRadius:12, border:`2px solid ${guestId ? G : selected ? 'rgba(184,151,62,0.5)' : 'rgba(0,0,0,0.1)'}`, background: guestId ? 'rgba(184,151,62,0.1)' : selected ? 'rgba(184,151,62,0.05)' : '#f9f7f4', padding:'8px 6px', cursor:'pointer', textAlign:'center', minHeight:54, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', transition:'all 0.15s', position:'relative' }}>
                            {guestId ? (
                              <>
                                <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(guestId), marginBottom:3 }} />
                                <p style={{ margin:0, fontSize:10, fontWeight:700, color:'#3d2510', lineHeight:1.2, wordBreak:'break-word' }}>{guestName(guestId)}</p>
                                <p style={{ margin:'2px 0 0', fontSize:9, color:'#9a7c58' }}>tap to remove</p>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize:16, opacity: selected ? 1 : 0.3 }}>🪑</span>
                                <p style={{ margin:'2px 0 0', fontSize:9, color: selected ? G2 : '#bbb', fontWeight:600 }}>{selected ? 'tap to assign' : `Seat ${idx + 1}`}</p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unassigned guests */}
                  {unassigned.length > 0 && (
                    <div style={{ background:'#fff', borderRadius:16, padding:'14px 16px', marginBottom:14, border:'1px solid rgba(184,151,62,0.2)' }}>
                      <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:'#3d2510' }}>
                        Unassigned Guests ({unassigned.length})
                        {selected && <span style={{ marginLeft:8, fontSize:11, color:G2, fontWeight:600 }}>— now tap a seat above</span>}
                      </p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {unassigned.map(g => (
                          <button key={g.id} onClick={() => setSelected(selected === g.id ? null : g.id)}
                            style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${selected === g.id ? G : 'rgba(184,151,62,0.3)'}`, background: selected === g.id ? `linear-gradient(135deg,${G},${G2})` : '#faf7f2', color: selected === g.id ? '#fff' : '#5c3d28', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, transition:'all 0.15s' }}>
                            <span style={{ width:7, height:7, borderRadius:'50%', background: g.rsvp_status === 'accepted' ? '#3d9e6a' : g.rsvp_status === 'declined' ? '#e04444' : G, flexShrink:0, display:'inline-block' }} />
                            {g.full_name}{g.plus_one ? ' +1' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {unassigned.length === 0 && guests.length > 0 && (
                    <div style={{ background:'rgba(61,158,106,0.08)', border:'1.5px solid rgba(61,158,106,0.25)', borderRadius:16, padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:20 }}>✅</span>
                      <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#2d7a52' }}>All {guests.length} guests have been assigned a seat!</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 16px', borderTop:'1px solid rgba(184,151,62,0.15)', background:'#fff', display:'flex', gap:10, flexShrink:0 }}>
              {tables.length > 0 && totalFilled > 0 && (
                <button onClick={clearAll}
                  style={{ padding:'12px 16px', borderRadius:14, border:'1.5px solid rgba(200,50,50,0.3)', background:'rgba(200,50,50,0.06)', color:'#c83232', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Clear All
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ flex:1, padding:'12px 16px', borderRadius:14, border:'1.5px solid rgba(184,151,62,0.3)', background:'#faf7f2', color:'#7a5c30', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Close
              </button>
              <button onClick={apply}
                style={{ flex:2, padding:'12px 16px', borderRadius:14, background:`linear-gradient(135deg,${G},${G2})`, color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 4px 12px rgba(184,151,62,0.3)' }}>
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
