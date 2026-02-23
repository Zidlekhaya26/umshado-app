import { useEffect, useState } from 'react';

type SeatingPayload = any;

export default function SeatingPlanner({ onApply }: { onApply?: (p: SeatingPayload) => void }) {
  const [payload, setPayload] = useState<SeatingPayload | null>(null);

  useEffect(() => {
    // Check sessionStorage one-time payload
    try {
      const raw = sessionStorage.getItem('active_seating_payload') || localStorage.getItem('restored_seating_payload');
      if (raw) {
        const p = JSON.parse(raw);
        setPayload(p);
      }
    } catch (e) {
      // ignore
    }

    const handler = (ev: any) => {
      try {
        const p = ev?.detail ?? null;
        if (p) setPayload(p);
      } catch (e) {}
    };

    window.addEventListener('umshado:restoreSeating', handler as EventListener);
    return () => { window.removeEventListener('umshado:restoreSeating', handler as EventListener); };
  }, []);

  const apply = () => {
    if (!payload) return;
    try {
      // persist into sessionStorage so other in-page consumers can read it
      sessionStorage.setItem('active_seating_payload', JSON.stringify(payload));
    } catch (e) {}
    if (onApply) onApply(payload);
    try {
      const ev = new CustomEvent('umshado:seatingApplied', { detail: payload });
      window.dispatchEvent(ev);
    } catch (e) {}
  };

  if (!payload) return null;

  const tableCount = Array.isArray(payload.tables) ? payload.tables.length : 0;
  let assigned = 0;
  if (Array.isArray(payload.tables)) payload.tables.forEach((t: any) => { if (Array.isArray(t.seats)) assigned += t.seats.length; });

  return (
    <div className="mb-4 bg-white rounded-xl border-2 border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Seating Loaded</p>
          <p className="text-xs text-gray-500">{tableCount} tables — {assigned} assigned</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={apply} className="px-3 py-1 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">Apply Seating</button>
        </div>
      </div>
    </div>
  );
}
