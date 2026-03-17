"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type SeatingRow = { id: string; name?: string; payload: any; created_at: string };

export default function SeatingsPage() {
  const [rows, setRows] = useState<SeatingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SeatingRow | null>(null);

  useEffect(() => { fetchList(); }, []);

  async function getAuthHeader(): Promise<{ Authorization: string } | Record<string, never>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function fetchList() {
    setLoading(true);
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/seating/list', { headers: auth });
      const json = await res.json();
      setRows(json.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  async function viewRow(id: string) {
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/seating/get?id=' + encodeURIComponent(id), { headers: auth });
      const json = await res.json();
      setSelected(json.data || null);
    } catch (e) { console.error(e); }
  }

  function copyJson(payload: any) {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  function loadIntoPlanner(payload: any) {
    // store payload in localStorage for planner to pick up
    try {
      localStorage.setItem('restored_seating_payload', JSON.stringify(payload));
      // navigate to root where planner can read it or show message
      window.location.href = '/';
    } catch (e) { console.error(e); }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Saved Seatings</h2>
      {loading ? <div>Loading…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={{textAlign:'left'}}>Name</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                <td>{r.name ?? r.id}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => viewRow(r.id)}>View</button>{' '}
                  <button onClick={() => copyJson(r.payload)}>Copy JSON</button>{' '}
                  <button onClick={async () => {
                    // ensure full payload is fetched
                    const auth = await getAuthHeader();
                    const res = await fetch('/api/seating/get?id=' + encodeURIComponent(r.id), { headers: auth });
                    const json = await res.json();
                    if (json && json.data && json.data.payload) loadIntoPlanner(json.data.payload);
                  }}>Load</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div style={{ marginTop: 20, padding: 10, border: '1px solid #ccc', background: '#fafafa' }}>
          <h3>Preview: {selected.name ?? selected.id}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>{JSON.stringify(selected.payload, null, 2)}</pre>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => copyJson(selected.payload)}>Copy JSON</button>{' '}
            <button onClick={() => { loadIntoPlanner(selected.payload); }}>Load into Planner</button>{' '}
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
