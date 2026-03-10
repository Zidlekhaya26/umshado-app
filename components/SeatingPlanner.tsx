import { useEffect, useState } from 'react';

type SeatingPayload = any;

export default function SeatingPlanner({ onApply }: { onApply?: (p: SeatingPayload) => void }) {
  const [payload, setPayload] = useState<SeatingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check sessionStorage one-time payload
    try {
      let raw = sessionStorage.getItem('active_seating_payload');
      if (!raw || raw === 'null' || raw === 'undefined') {
        raw = localStorage.getItem('restored_seating_payload');
      }
      
      if (raw && raw !== 'null' && raw !== 'undefined') {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          console.log('[SeatingPlanner] Loaded payload:', p);
          setPayload(p);
          setError(null);
        }
      }
    } catch (e: any) {
      console.error('[SeatingPlanner] Failed to load seating payload:', e);
      setError('Failed to load seating data');
    }

    const handler = (ev: any) => {
      try {
        const p = ev?.detail ?? null;
        if (p && typeof p === 'object') {
          console.log('[SeatingPlanner] Received payload via event:', p);
          setPayload(p);
          setError(null);
        }
      } catch (e: any) {
        console.error('[SeatingPlanner] Failed to handle seating event:', e);
        setError('Failed to apply seating data');
      }
    };

    window.addEventListener('umshado:restoreSeating', handler as EventListener);
    return () => { 
      window.removeEventListener('umshado:restoreSeating', handler as EventListener); 
    };
  }, []);

  const apply = () => {
    if (!payload) {
      console.warn('[SeatingPlanner] No payload to apply');
      return;
    }
    
    try {
      // Validate payload structure
      if (!payload.tables || !Array.isArray(payload.tables)) {
        throw new Error('Invalid payload: missing or invalid tables array');
      }

      // Persist into sessionStorage so other in-page consumers can read it
      sessionStorage.setItem('active_seating_payload', JSON.stringify(payload));
      console.log('[SeatingPlanner] Saved payload to sessionStorage');
      
      if (onApply) {
        onApply(payload);
      }
      
      // Dispatch event for other components
      const ev = new CustomEvent('umshado:seatingApplied', { detail: payload });
      window.dispatchEvent(ev);
      console.log('[SeatingPlanner] Applied seating and dispatched event');
      
      setError(null);
    } catch (e: any) {
      console.error('[SeatingPlanner] Failed to apply seating:', e);
      setError(e.message || 'Failed to apply seating');
    }
  };

  // Show placeholder when no seating loaded
  if (!payload) {
    return (
      <div className="mb-4 bg-blue-50 rounded-xl border-2 border-blue-200 p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">💺 Seating Planner</p>
            <p className="text-xs text-blue-700">No seating arrangement loaded yet</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.location.href = '/admin/seatings'}
              className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Load Seating
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tableCount = Array.isArray(payload.tables) ? payload.tables.length : 0;
  let assigned = 0;
  if (Array.isArray(payload.tables)) {
    payload.tables.forEach((t: any) => { 
      if (Array.isArray(t.seats)) {
        assigned += t.seats.filter((s: any) => s && s !== '').length;
      }
    });
  }

  if (tableCount === 0) {
    return (
      <div className="mb-4 bg-yellow-50 rounded-xl border-2 border-yellow-200 p-3">
        <p className="text-sm font-semibold text-yellow-900">⚠️ No tables in seating arrangement</p>
        <p className="text-xs text-yellow-700 mt-1">The loaded seating has no tables defined.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-white rounded-xl border-2 border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">✓ Seating Loaded</p>
          <p className="text-xs text-gray-500">{tableCount} tables — {assigned} guests assigned</p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={apply} 
            className="px-3 py-1 rounded-full bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm"
          >
            Apply Seating
          </button>
        </div>
      </div>
    </div>
  );
}
