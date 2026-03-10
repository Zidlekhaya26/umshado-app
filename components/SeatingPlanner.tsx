'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbGuest {
  id: string;
  full_name: string;
  rsvp_status: 'pending' | 'accepted' | 'declined';
  side: 'groom' | 'bride' | 'both';
  plus_one: boolean;
}

interface SeatingTable {
  id: string;
  name: string;
  capacity: number; // 1–12
  seats: string[];  // guest ids
  color: string;    // accent color class
}

const TABLE_COLORS = [
  { bg: 'bg-violet-50', border: 'border-violet-300', badge: 'bg-violet-600', chip: 'bg-violet-100 text-violet-800 border-violet-200' },
  { bg: 'bg-rose-50',   border: 'border-rose-300',   badge: 'bg-rose-600',   chip: 'bg-rose-100 text-rose-800 border-rose-200' },
  { bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-600',  chip: 'bg-amber-100 text-amber-800 border-amber-200' },
  { bg: 'bg-teal-50',   border: 'border-teal-300',   badge: 'bg-teal-600',   chip: 'bg-teal-100 text-teal-800 border-teal-200' },
  { bg: 'bg-sky-50',    border: 'border-sky-300',    badge: 'bg-sky-600',    chip: 'bg-sky-100 text-sky-800 border-sky-200' },
  { bg: 'bg-emerald-50',border: 'border-emerald-300',badge: 'bg-emerald-600',chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-600', chip: 'bg-orange-100 text-orange-800 border-orange-200' },
  { bg: 'bg-fuchsia-50',border: 'border-fuchsia-300',badge: 'bg-fuchsia-600',chip: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
];

const getColor = (index: number) => TABLE_COLORS[index % TABLE_COLORS.length];

// ─── Capacity Picker ─────────────────────────────────────────────────────────

function CapacityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Seats at this table
      </label>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-10 w-full rounded-xl text-sm font-bold transition-all ${
              value === n
                ? 'bg-violet-600 text-white shadow-md scale-105'
                : 'bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-center">
        {value} {value === 1 ? 'seat' : 'seats'} selected
      </p>
    </div>
  );
}

// ─── Seat Diagram ────────────────────────────────────────────────────────────

function SeatDiagram({ capacity, filled }: { capacity: number; filled: number }) {
  const pct = capacity > 0 ? filled / capacity : 0;
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="relative flex items-center justify-center w-10 h-10">
      <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={pct >= 1 ? '#16a34a' : pct > 0.7 ? '#f59e0b' : '#7c3aed'}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <span className="text-[10px] font-bold text-gray-600">{filled}/{capacity}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  guests: DbGuest[];
  userId: string;
}

export default function SeatingPlanner({ guests, userId }: Props) {
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Add table modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState(8);

  // Edit table modal
  const [editingTable, setEditingTable] = useState<SeatingTable | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState(8);

  // Drag state (desktop)
  const [dragGuest, setDragGuest] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Touch drag state (mobile)
  const touchGuestRef = useRef<string | null>(null);
  const touchTableRef = useRef<string | null>(null);

  // Assign a guest panel target (tap-to-assign on mobile)
  const [assigningGuest, setAssigningGuest] = useState<string | null>(null);

  // ── Load saved layout from Supabase ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('seatings')
        .select('id, payload')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.payload?.tables) {
        setTables(
          (data.payload.tables as any[]).map((t: any, i: number) => ({
            id: t.id,
            name: t.name,
            capacity: t.capacity ?? 8,
            seats: t.seats ?? [],
            color: t.color ?? String(i),
          }))
        );
      } else {
        // Default starter tables
        setTables([
          { id: `t${Date.now()}1`, name: 'Head Table', capacity: 8, seats: [], color: '0' },
          { id: `t${Date.now()}2`, name: 'Family Table', capacity: 8, seats: [], color: '1' },
          { id: `t${Date.now()}3`, name: 'Friends Table', capacity: 8, seats: [], color: '2' },
        ]);
      }
      setLoaded(true);
    })();
  }, [userId]);

  // ── Persist to Supabase ─────────────────────────────────────────────────────
  const saveLayout = useCallback(async (currentTables: SeatingTable[]) => {
    setSaving(true);
    try {
      await supabase.from('seatings').insert({
        created_by: userId,
        payload: {
          tables: currentTables.map(t => ({
            id: t.id, name: t.name, capacity: t.capacity, seats: t.seats, color: t.color,
          })),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('[seating] save error', e);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeGuests = guests.filter(g => g.rsvp_status !== 'declined');
  const seatedIds = new Set(tables.flatMap(t => t.seats));
  const unseated = activeGuests.filter(g => !seatedIds.has(g.id));
  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0);
  const totalSeated = tables.reduce((s, t) => s + t.seats.length, 0);

  const getGuest = (id: string) => guests.find(g => g.id === id);

  // ── Drag & drop (desktop) ──────────────────────────────────────────────────
  const handleDrop = (tableId: string) => {
    if (!dragGuest) return;
    setTables(prev => {
      const next = prev.map(t => ({ ...t, seats: t.seats.filter(s => s !== dragGuest) }));
      return next.map(t =>
        t.id === tableId && t.seats.length < t.capacity
          ? { ...t, seats: [...t.seats, dragGuest] }
          : t
      );
    });
    setDragGuest(null);
    setDragOver(null);
  };

  const handleDropUnseated = () => {
    if (!dragGuest) return;
    setTables(prev => prev.map(t => ({ ...t, seats: t.seats.filter(s => s !== dragGuest) })));
    setDragGuest(null);
    setDragOver(null);
  };

  // ── Tap-to-assign (mobile) ─────────────────────────────────────────────────
  const handleGuestTap = (guestId: string) => {
    if (assigningGuest === guestId) { setAssigningGuest(null); return; }
    setAssigningGuest(guestId);
  };

  const handleTableTap = (tableId: string) => {
    if (!assigningGuest) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    if (table.seats.length >= table.capacity && !table.seats.includes(assigningGuest)) return;
    setTables(prev => {
      const next = prev.map(t => ({ ...t, seats: t.seats.filter(s => s !== assigningGuest) }));
      return next.map(t =>
        t.id === tableId && t.seats.length < t.capacity
          ? { ...t, seats: [...t.seats, assigningGuest] }
          : t
      );
    });
    setAssigningGuest(null);
  };

  // ── Remove from table ──────────────────────────────────────────────────────
  const removeFromTable = (guestId: string) => {
    setTables(prev => prev.map(t => ({ ...t, seats: t.seats.filter(s => s !== guestId) })));
  };

  // ── Add table ──────────────────────────────────────────────────────────────
  const addTable = () => {
    if (!newName.trim()) return;
    const colorIdx = String(tables.length % TABLE_COLORS.length);
    setTables(prev => [
      ...prev,
      { id: `t${Date.now()}`, name: newName.trim(), capacity: newCapacity, seats: [], color: colorIdx },
    ]);
    setNewName(''); setNewCapacity(8); setShowAddModal(false);
  };

  // ── Edit table ─────────────────────────────────────────────────────────────
  const openEdit = (t: SeatingTable) => {
    setEditingTable(t); setEditName(t.name); setEditCapacity(t.capacity);
  };
  const saveEdit = () => {
    if (!editingTable || !editName.trim()) return;
    setTables(prev => prev.map(t =>
      t.id === editingTable.id
        ? { ...t, name: editName.trim(), capacity: editCapacity, seats: t.seats.slice(0, editCapacity) }
        : t
    ));
    setEditingTable(null);
  };

  // ── Delete table ───────────────────────────────────────────────────────────
  const deleteTable = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    if (editingTable?.id === id) setEditingTable(null);
  };

  // ── Auto-assign ────────────────────────────────────────────────────────────
  const autoAssign = async () => {
    if (activeGuests.length === 0 || tables.length === 0) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/seating/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guests: activeGuests.map(g => ({
            id: g.id, name: g.full_name,
            rsvp: g.rsvp_status === 'accepted' ? 'yes' : 'pending',
            group: g.side,
          })),
          tables: tables.map(t => ({ id: t.id, name: t.name, capacity: t.capacity, seats: [] })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTables(prev => prev.map(t => {
          const updated = data.tables?.find((dt: any) => dt.id === t.id);
          return updated ? { ...t, seats: updated.seats ?? [] } : t;
        }));
      }
    } catch (e) { console.error('[seating] auto-assign error', e); }
    finally { setAssigning(false); }
  };

  // ── Clear all ──────────────────────────────────────────────────────────────
  const clearAll = () => {
    setTables(prev => prev.map(t => ({ ...t, seats: [] })));
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Seating Plan</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalSeated} of {activeGuests.length} guests seated · {unseated.length} remaining
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:border-violet-300 hover:text-violet-700 transition-all"
          >
            + Table
          </button>
          <button
            onClick={autoAssign}
            disabled={assigning || activeGuests.length === 0}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-all disabled:opacity-50 shadow-md shadow-violet-200"
          >
            {assigning ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Assigning…
              </span>
            ) : '✨ Auto-Assign'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Guests', value: activeGuests.length, color: 'text-gray-900' },
          { label: 'Seated', value: totalSeated, color: 'text-violet-600' },
          { label: 'Unseated', value: unseated.length, color: unseated.length > 0 ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Capacity', value: totalSeats, color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── No guests state ─────────────────────────────────── */}
      {guests.length === 0 && (
        <div className="bg-violet-50 border-2 border-dashed border-violet-200 rounded-2xl p-8 text-center">
          <span className="text-4xl">👥</span>
          <p className="text-base font-bold text-violet-900 mt-3">Add guests first</p>
          <p className="text-sm text-violet-600 mt-1">Go to the Guests tab and add your guest list, then come back to arrange seating.</p>
        </div>
      )}

      {/* ── Unseated pool ───────────────────────────────────── */}
      {unseated.length > 0 && (
        <div
          className={`rounded-2xl border-2 p-4 transition-all ${
            dragOver === 'pool'
              ? 'border-amber-400 bg-amber-50'
              : 'border-amber-200 bg-amber-50'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver('pool'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => { handleDropUnseated(); setDragOver(null); }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-amber-800">
              ⚠️ Not yet seated ({unseated.length})
            </p>
            {assigningGuest && (
              <p className="text-xs font-semibold text-amber-600 animate-pulse">
                Now tap a table to place them →
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {unseated.map(g => (
              <div
                key={g.id}
                draggable
                onDragStart={() => { setDragGuest(g.id); setAssigningGuest(null); }}
                onDragEnd={() => setDragGuest(null)}
                onClick={() => handleGuestTap(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-all select-none ${
                  assigningGuest === g.id
                    ? 'bg-amber-600 text-white border-amber-600 scale-105 shadow-md'
                    : 'bg-white text-amber-800 border-amber-300 hover:border-amber-500 active:scale-95'
                }`}
              >
                {g.full_name}
                {g.plus_one && <span className="ml-1 opacity-60">+1</span>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-600 mt-2">
            Drag guests to a table, or tap a guest then tap a table · Use Auto-Assign to fill all seats
          </p>
        </div>
      )}

      {/* ── Tables ──────────────────────────────────────────── */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
          <span className="text-5xl">🪑</span>
          <p className="text-base font-bold text-gray-800 mt-3">No tables yet</p>
          <p className="text-sm text-gray-500 mt-1">Add tables to start building your seating plan.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all shadow-md shadow-violet-200"
          >
            + Add First Table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tables.map((table, idx) => {
            const color = getColor(Number(table.color));
            const isFull = table.seats.length >= table.capacity;
            const isTarget = dragOver === table.id;
            const canReceive = assigningGuest && !isFull;

            return (
              <div
                key={table.id}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${
                  isTarget
                    ? 'border-violet-500 shadow-lg shadow-violet-100 scale-[1.01]'
                    : canReceive
                    ? `${color.border} shadow-md cursor-pointer`
                    : `${color.border}`
                } ${color.bg}`}
                onDragOver={e => { e.preventDefault(); setDragOver(table.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { handleDrop(table.id); setDragOver(null); }}
                onClick={() => handleTableTap(table.id)}
              >
                {/* Table header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/60 border-b border-white/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center`}>
                      <span className="text-white text-xs font-black">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{table.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {isFull ? '✅ Full' : `${table.capacity - table.seats.length} seat${table.capacity - table.seats.length !== 1 ? 's' : ''} open`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeatDiagram capacity={table.capacity} filled={table.seats.length} />
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(table); }}
                      className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTable(table.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Seats */}
                <div className="p-3 min-h-[52px]">
                  {table.seats.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-1.5 italic">
                      {canReceive ? '👆 Tap to place guest here' : 'Drop or drag guests here'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {table.seats.map(gid => {
                        const g = getGuest(gid);
                        return (
                          <div
                            key={gid}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDragGuest(gid); setAssigningGuest(null); }}
                            onDragEnd={() => setDragGuest(null)}
                            className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold border cursor-grab active:cursor-grabbing select-none ${color.chip}`}
                            onClick={e => e.stopPropagation()}
                          >
                            <span>{g?.full_name ?? gid}</span>
                            {g?.plus_one && <span className="opacity-50">+1</span>}
                            <button
                              onClick={e => { e.stopPropagation(); removeFromTable(gid); }}
                              className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Seat slots visual */}
                <div className="px-3 pb-3 flex gap-1 flex-wrap">
                  {Array.from({ length: table.capacity }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 min-w-[12px] rounded-full transition-all ${
                        i < table.seats.length
                          ? color.badge.replace('bg-', 'bg-') + ' opacity-70'
                          : 'bg-white/60 border border-white'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Action bar ──────────────────────────────────────── */}
      {tables.length > 0 && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={clearAll}
            className="px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:border-red-300 hover:text-red-500 transition-all flex-1"
          >
            🗑 Clear All Seats
          </button>
          <button
            onClick={() => saveLayout(tables)}
            disabled={saving}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 ${
              saved
                ? 'bg-green-600 text-white shadow-md shadow-green-200'
                : 'bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200 disabled:opacity-50'
            }`}
          >
            {saving ? 'Saving…' : saved ? '✅ Saved!' : '💾 Save Layout'}
          </button>
        </div>
      )}

      {/* ── Add Table Modal ──────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[75vh]">
            <div className="shrink-0 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-black text-gray-900">Add Table</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Table Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g., Head Table, Family, VIP"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 text-sm"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && addTable()}
                  />
                </div>
                <CapacityPicker value={newCapacity} onChange={setNewCapacity} />
              </div>
            </div>
            <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => { setShowAddModal(false); setNewName(''); setNewCapacity(8); }}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all">
                Cancel
              </button>
              <button onClick={addTable} disabled={!newName.trim()}
                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl text-base font-extrabold hover:bg-violet-700 transition-all shadow-lg disabled:opacity-40">
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Table Modal ─────────────────────────────────── */}
      {editingTable && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-black text-gray-900">Edit Table</h3>
              <button
                onClick={() => deleteTable(editingTable.id)}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
              >
                Delete Table
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Table Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 text-sm"
                  />
                </div>
                <CapacityPicker value={editCapacity} onChange={setEditCapacity} />
                {editCapacity < editingTable.seats.length && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ Reducing capacity will remove {editingTable.seats.length - editCapacity} guest(s) from this table.
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => setEditingTable(null)}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={!editName.trim()}
                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl text-base font-extrabold hover:bg-violet-700 transition-all shadow-lg disabled:opacity-40">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
