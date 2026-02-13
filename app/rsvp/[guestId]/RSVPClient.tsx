"use client";

import { useState } from 'react';

export default function RSVPClient({ guestId }: { guestId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = async (status: 'accepted' | 'declined') => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, status }) });
      const j = await res.json();
      if (j?.success) {
        setMessage('Thanks — your RSVP has been recorded.');
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
        <button disabled={loading} onClick={() => update('accepted')} className="px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-60">Accept</button>
        <button disabled={loading} onClick={() => update('declined')} className="px-4 py-2 rounded-lg bg-red-500 text-white disabled:opacity-60">Decline</button>
      </div>
      {message && <p className="text-center text-sm text-gray-700 mt-3">{message}</p>}
    </div>
  );
}
