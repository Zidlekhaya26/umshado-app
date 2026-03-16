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
  seats: string[];  // guest ids (may include `${guestId}__plus1` virtual entries)
  color: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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

// ─── Seat Diagram (compact ring in card header) ───────────────────────────────

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

// ─── Table Diagram (visual circular table layout) ────────────────────────────

function TableDiagram({
  capacity, seats, guests,
}: {
  capacity: number;
  seats: string[];
  guests: DbGuest[];
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const tableR = 36;
  const seatR = capacity > 9 ? 10 : 13;
  const orbitR = 72;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}
    >
      {/* Shadow */}
      <circle cx={cx} cy={cy + 3} r={tableR + 1} fill="rgba(26,13,18,0.07)" />
      {/* Table surface */}
      <circle cx={cx} cy={cy} r={tableR} fill="#fdf8f5" stroke="rgba(154,33,67,0.25)" strokeWidth="2.5" />
      {/* Inner ring detail */}
      <circle cx={cx} cy={cy} r={tableR - 7} fill="none" stroke="rgba(154,33,67,0.09)" strokeWidth="1.5" />

      {Array.from({ length: capacity }, (_, i) => {
        const angle = (2 * Math.PI * i / capacity) - Math.PI / 2;
        const sx = cx + orbitR * Math.cos(angle);
        const sy = cy + orbitR * Math.sin(angle);
        const seatId = seats[i];
        const filled = !!seatId;

        let initials = '';
        if (seatId) {
          if (seatId.endsWith('__plus1')) {
            initials = '+1';
          } else {
            const g = guests.find(g => g.id === seatId);
            if (g) initials = getInitials(g.full_name);
          }
        }

        const lineStartX = cx + (tableR + 3) * Math.cos(angle);
        const lineStartY = cy + (tableR + 3) * Math.sin(angle);
        const lineEndX   = sx - (seatR + 2) * Math.cos(angle);
        const lineEndY   = sy - (seatR + 2) * Math.sin(angle);

        return (
          <g key={i}>
            <line
              x1={lineStartX} y1={lineStartY}
              x2={lineEndX}   y2={lineEndY}
              stroke={filled ? 'rgba(154,33,67,0.2)' : '#e5e7eb'}
              strokeWidth="1.5"
            />
            <circle
              cx={sx} cy={sy} r={seatR}
              fill={filled ? 'var(--um-crimson)' : '#fff'}
              stroke={filled ? 'var(--um-crimson-dark)' : '#d1d5db'}
              strokeWidth="1.5"
              strokeDasharray={filled ? undefined : '3 2'}
            />
            {filled && (
              <text
                x={sx} y={sy + 0.5}
                textAnchor="middle" dominantBaseline="middle"
                fill="white"
                fontSize={seatR > 11 ? '7' : '6'}
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                {initials}
              </text>
            )}
          </g>
        );
      })}
    </svg>
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

  // Tap-to-assign (mobile)
  const [assigningGuest, setAssigningGuest] = useState<string | null>(null);

  // ── Load saved layout ───────────────────────────────────────────────────────
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
        setTables([
          { id: `t${Date.now()}1`, name: 'Head Table',    capacity: 8, seats: [], color: '0' },
          { id: `t${Date.now()}2`, name: 'Family Table',  capacity: 8, seats: [], color: '1' },
          { id: `t${Date.now()}3`, name: 'Friends Table', capacity: 8, seats: [], color: '2' },
        ]);
      }
      setLoaded(true);
    })();
  }, [userId]);

  // ── Save layout ─────────────────────────────────────────────────────────────
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeGuests = guests.filter(g => g.rsvp_status !== 'declined');

  // Only real guest IDs (not __plus1 virtuals) are tracked against activeGuests
  const seatedRealIds = new Set(
    tables.flatMap(t => t.seats.filter(s => !s.endsWith('__plus1')))
  );
  const unseated = activeGuests.filter(g => !seatedRealIds.has(g.id));

  // Total people count (each +1 flag = 1 extra person)
  const totalPeople = activeGuests.reduce((acc, g) => acc + 1 + (g.plus_one ? 1 : 0), 0);
  const unseatedPeople = unseated.reduce((acc, g) => acc + 1 + (g.plus_one ? 1 : 0), 0);

  const totalSeats   = tables.reduce((s, t) => s + t.capacity, 0);
  const totalSeated  = tables.reduce((s, t) => s + t.seats.length, 0);

  // Helper: display name for a seat entry (real guest or __plus1 virtual)
  const getDisplayName = (seatId: string): string => {
    if (seatId.endsWith('__plus1')) {
      const primaryId = seatId.replace('__plus1', '');
      const primary = guests.find(g => g.id === primaryId);
      return primary
        ? `${primary.full_name.split(' ')[0]}'s +1`
        : '+1 Guest';
    }
    return guests.find(g => g.id === seatId)?.full_name ?? 'Unknown';
  };

  // Helper: how many seats does this guest need (1 normally, 2 with plus_one)
  const slotsNeeded = (guestId: string): number => {
    const g = guests.find(x => x.id === guestId);
    return g?.plus_one ? 2 : 1;
  };

  // ── Drag & drop (desktop) ──────────────────────────────────────────────────
  const handleDrop = (tableId: string) => {
    if (!dragGuest) return;

    // If dragging a +1 chip, treat it as its own ID (allow free movement)
    const isPlusOne = dragGuest.endsWith('__plus1');
    const primaryId = isPlusOne ? dragGuest.replace('__plus1', '') : dragGuest;
    const plusOneId = `${primaryId}__plus1`;
    const withPlusOne = !isPlusOne && !!(guests.find(g => g.id === primaryId)?.plus_one);

    setTables(prev => {
      const cleared = prev.map(t => ({
        ...t,
        seats: t.seats.filter(s =>
          isPlusOne
            ? s !== dragGuest
            : s !== primaryId && s !== plusOneId
        ),
      }));
      const target = cleared.find(t => t.id === tableId);
      if (!target) return cleared;
      const needed = withPlusOne ? 2 : 1;
      if (target.seats.length + needed > target.capacity) return cleared;
      return cleared.map(t =>
        t.id === tableId
          ? { ...t, seats: [...t.seats, dragGuest, ...(withPlusOne ? [plusOneId] : [])] }
          : t
      );
    });
    setDragGuest(null);
    setDragOver(null);
  };

  const handleDropUnseated = () => {
    if (!dragGuest) return;
    // If dropping a +1 back, also remove the primary (they belong together)
    const isPlusOne = dragGuest.endsWith('__plus1');
    const primaryId = isPlusOne ? dragGuest.replace('__plus1', '') : dragGuest;
    const plusOneId = `${primaryId}__plus1`;
    setTables(prev =>
      prev.map(t => ({
        ...t,
        seats: t.seats.filter(s => s !== primaryId && s !== plusOneId),
      }))
    );
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
    const withPlusOne = !!(guests.find(g => g.id === assigningGuest)?.plus_one);
    const plusOneId = `${assigningGuest}__plus1`;

    setTables(prev => {
      const cleared = prev.map(t => ({
        ...t,
        seats: t.seats.filter(s => s !== assigningGuest && s !== plusOneId),
      }));
      const target = cleared.find(t => t.id === tableId);
      if (!target) return cleared;
      const needed = withPlusOne ? 2 : 1;
      if (target.seats.length + needed > target.capacity) return cleared;
      return cleared.map(t =>
        t.id === tableId
          ? { ...t, seats: [...t.seats, assigningGuest, ...(withPlusOne ? [plusOneId] : [])] }
          : t
      );
    });
    setAssigningGuest(null);
  };

  // ── Remove from table ──────────────────────────────────────────────────────
  const removeFromTable = (seatId: string) => {
    if (seatId.endsWith('__plus1')) {
      // Remove only the +1 chip (user explicitly split them)
      setTables(prev => prev.map(t => ({ ...t, seats: t.seats.filter(s => s !== seatId) })));
    } else {
      // Remove guest and their +1
      const plusOneId = `${seatId}__plus1`;
      setTables(prev =>
        prev.map(t => ({
          ...t,
          seats: t.seats.filter(s => s !== seatId && s !== plusOneId),
        }))
      );
    }
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
        // After auto-assign, inject +1 seats for guests with plus_one
        setTables(prev => prev.map(t => {
          const updated = data.tables?.find((dt: any) => dt.id === t.id);
          if (!updated) return t;
          const expandedSeats: string[] = [];
          for (const sid of (updated.seats ?? [])) {
            expandedSeats.push(sid);
            const g = guests.find(x => x.id === sid);
            if (g?.plus_one && expandedSeats.length < t.capacity) {
              expandedSeats.push(`${sid}__plus1`);
            }
          }
          return { ...t, seats: expandedSeats.slice(0, t.capacity) };
        }));
      }
    } catch (e) { console.error('[seating] auto-assign error', e); }
    finally { setAssigning(false); }
  };

  // ── Clear all ──────────────────────────────────────────────────────────────
  const clearAll = () => setTables(prev => prev.map(t => ({ ...t, seats: [] })));

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Seating Plan</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalSeated} of {totalPeople} people seated · {unseatedPeople} remaining
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

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Guests',    value: activeGuests.length,  color: 'text-gray-900' },
          { label: 'Seated',    value: totalSeated,           color: 'text-violet-600' },
          { label: 'Unseated',  value: unseatedPeople,        color: unseatedPeople > 0 ? 'text-amber-600' : 'text-gray-400' },
          { label: 'Capacity',  value: totalSeats,            color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* ── No guests state ──────────────────────────────────────────────────── */}
      {guests.length === 0 && (
        <div className="bg-violet-50 border-2 border-dashed border-violet-200 rounded-2xl p-8 text-center">
          <span className="text-4xl">👥</span>
          <p className="text-base font-bold text-violet-900 mt-3">Add guests first</p>
          <p className="text-sm text-violet-600 mt-1">Go to the Guests tab and add your guest list, then come back to arrange seating.</p>
        </div>
      )}

      {/* ── Unseated pool ────────────────────────────────────────────────────── */}
      {unseated.length > 0 && (
        <div
          className={`rounded-2xl border-2 p-4 transition-all ${
            dragOver === 'pool' ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver('pool'); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => { handleDropUnseated(); setDragOver(null); }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-amber-800">
              Not yet seated ({unseatedPeople})
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
                {g.plus_one && (
                  <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-200">
                    +1
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-600 mt-2">
            Drag guests to a table, or tap a guest then tap a table · Guests with +1 will auto-fill 2 seats
          </p>
        </div>
      )}

      {/* ── Tables ───────────────────────────────────────────────────────────── */}
      {tables.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
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
        <div className="grid grid-cols-1 gap-4">
          {tables.map((table, idx) => {
            const color     = getColor(Number(table.color));
            const isFull    = table.seats.length >= table.capacity;
            const isTarget  = dragOver === table.id;
            const needTwo   = assigningGuest
              ? !!(guests.find(g => g.id === assigningGuest)?.plus_one)
              : false;
            const freeSlots = table.capacity - table.seats.length;
            const canReceive = !!assigningGuest && freeSlots >= (needTwo ? 2 : 1);

            return (
              <div
                key={table.id}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${
                  isTarget
                    ? 'border-violet-500 shadow-lg shadow-violet-100 scale-[1.01]'
                    : canReceive
                    ? `${color.border} shadow-md cursor-pointer`
                    : color.border
                } ${color.bg}`}
                onDragOver={e => { e.preventDefault(); setDragOver(table.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { handleDrop(table.id); setDragOver(null); }}
                onClick={() => handleTableTap(table.id)}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/60 border-b border-white/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center`}>
                      <span className="text-white text-xs font-black">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{table.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {isFull
                          ? '✅ Full'
                          : `${freeSlots} seat${freeSlots !== 1 ? 's' : ''} open`}
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

                {/* Visual table diagram */}
                <div className="px-4 pt-3 pb-1">
                  {canReceive && (
                    <p className="text-center text-xs font-semibold text-violet-600 animate-pulse mb-1">
                      Tap to seat here
                    </p>
                  )}
                  <TableDiagram
                    capacity={table.capacity}
                    seats={table.seats}
                    guests={guests}
                  />
                </div>

                {/* Seated guest chips */}
                {table.seats.length > 0 && (
                  <div className="px-3 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {table.seats.map(seatId => {
                        const isPlusOneEntry = seatId.endsWith('__plus1');
                        return (
                          <div
                            key={seatId}
                            draggable
                            onDragStart={e => {
                              e.stopPropagation();
                              setDragGuest(seatId);
                              setAssigningGuest(null);
                            }}
                            onDragEnd={() => setDragGuest(null)}
                            className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold border cursor-grab active:cursor-grabbing select-none ${color.chip} ${
                              isPlusOneEntry ? 'opacity-80 italic' : ''
                            }`}
                            onClick={e => e.stopPropagation()}
                          >
                            <span>{getDisplayName(seatId)}</span>
                            <button
                              onClick={e => { e.stopPropagation(); removeFromTable(seatId); }}
                              className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {table.seats.length === 0 && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-gray-400 text-center italic">
                      {canReceive ? 'Tap to place guest here' : 'Drag or tap guests to seat them'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Action bar ───────────────────────────────────────────────────────── */}
      {tables.length > 0 && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={clearAll}
            className="px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:border-red-300 hover:text-red-500 transition-all flex-1"
          >
            Clear All Seats
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

      {/* ── Add Table Modal ──────────────────────────────────────────────────── */}
      {showAddModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="add-table-title" className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-60 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: 'calc(75svh - env(safe-area-inset-bottom))' }}>
            <div className="shrink-0 px-6 py-4 border-b border-gray-200">
              <h3 id="add-table-title" className="text-lg font-black text-gray-900">Add Table</h3>
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
              <button
                onClick={() => { setShowAddModal(false); setNewName(''); setNewCapacity(8); }}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={addTable}
                disabled={!newName.trim()}
                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl text-base font-extrabold hover:bg-violet-700 transition-all shadow-lg disabled:opacity-40"
              >
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Table Modal ─────────────────────────────────────────────────── */}
      {editingTable && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-table-title" className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-60 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: 'calc(80svh - env(safe-area-inset-bottom))' }}>
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 id="edit-table-title" className="text-lg font-black text-gray-900">Edit Table</h3>
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
                    Reducing capacity will remove {editingTable.seats.length - editCapacity} guest(s) from this table.
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => setEditingTable(null)}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editName.trim()}
                className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl text-base font-extrabold hover:bg-violet-700 transition-all shadow-lg disabled:opacity-40"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
