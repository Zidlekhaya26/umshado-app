"use client";

import { useEffect, useState } from 'react';

export default function RSVPClient({ guestId, token: propToken }: { guestId: string; token?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(propToken ?? null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!token && typeof window !== 'undefined') {
      try {
        const p = new URLSearchParams(window.location.search);
        const t = p.get('t');
        if (t) setToken(t);
      } catch (e) {
        // ignore
      }
    }
  }, [token]);

  const update = async (status: 'accepted' | 'declined') => {
    if (disabled) return;
    if (!token) {
      setMessage('Missing RSVP token. Please ask the couple to resend the invite.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, status, token }) });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.success) {
        setMessage('Thanks — your RSVP has been recorded.');
        setDisabled(true);
      } else if (j && j.message) {
        setMessage(j.message);
      } else if (!res.ok) {
        setMessage('Server error while recording RSVP. Please try again later.');
      } else {
        setMessage('Sorry, we could not record your RSVP.');
      }
    } catch (e) {
      setMessage('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex justify-center gap-3">
        <button aria-live="polite" disabled={loading || disabled} onClick={() => update('accepted')} className="px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-60">Accept</button>
        <button aria-live="polite" disabled={loading || disabled} onClick={() => update('declined')} className="px-4 py-2 rounded-lg bg-red-500 text-white disabled:opacity-60">Decline</button>
      </div>
      {message && <p className="text-center text-sm text-gray-700 mt-3" role="status">{message}</p>}
      {!token && <p className="text-center text-xs text-gray-500 mt-2">If the RSVP fails due to a missing token, ask the couple to resend the invite.</p>}
    </div>
  );
}
