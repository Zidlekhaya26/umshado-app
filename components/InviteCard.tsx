"use client";

import { useState } from 'react';
import RSVPClient from '@/app/rsvp/[guestId]/RSVPClient';

export default function InviteCard({
  guestName,
  coupleName,
  date,
  venue,
  avatarUrl,
  guestId,
  token,
}: {
  guestName: string;
  coupleName: string | null;
  date: string | null;
  venue: string | null;
  avatarUrl?: string | null;
  guestId: string;
  token: string | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      // Fetch the server-generated PNG — clean, no browser artifacts
      const url = `/api/invite-image?guestId=${guestId}&t=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to generate image');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = guestName.replace(/\s+/g, '_') + '_invite.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error('Download failed', e);
      alert('Could not download invite. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 20,
      fontFamily: 'Georgia, "Times New Roman", serif',
    }}>

      {/* ── Printable card (on-screen preview) ── */}
      <div style={{
        width: '100%',
        background: '#fdfaf6',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(30,17,10,0.14)',
      }}>
        {/* Gold top bar */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)' }} />

        {/* Photo */}
        <div style={{
          width: '100%', height: 300, overflow: 'hidden',
          background: '#ede3d8', display: 'flex',
          alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="Couple" crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
            : <div style={{ textAlign: 'center', color: '#c4a882' }}>
                <div style={{ fontSize: 52 }}>💍</div>
                <p style={{ margin: '10px 0 0', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Georgia, serif', color: '#c4a882' }}>Photo coming soon</p>
              </div>
          }
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, #fdfaf6, transparent)', pointerEvents: 'none' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '4px 40px 40px', textAlign: 'center', background: '#fdfaf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#c9a860', fontSize: 13 }}>✦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>

          <p style={{ margin: '0 0 3px', fontSize: 10, letterSpacing: 5, textTransform: 'uppercase', color: '#9a7c58', fontFamily: 'Georgia, serif' }}>Dear</p>
          <p style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: '#1e110a', fontFamily: 'Georgia, serif' }}>{guestName}</p>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#6b4d34', fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>with love in our hearts, we invite you to</p>
          <p style={{ margin: '0 0 16px', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#9a7c58', fontFamily: 'Georgia, serif' }}>celebrate the marriage of</p>
          <h2 style={{ margin: '0 0 26px', fontSize: 34, fontWeight: 400, fontStyle: 'italic', color: '#1e110a', lineHeight: 1.25, fontFamily: 'Georgia, "Times New Roman", serif' }}>{coupleName ?? 'The Wedding'}</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#c9a860', fontSize: 10 }}>♦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {[{ label: 'Date', value: date ?? 'To be announced' }, { label: 'Venue', value: venue ?? 'To be announced' }].map(({ label, value }) => (
              <div key={label} style={{ padding: '16px 12px', background: 'rgba(201,168,96,0.07)', borderTop: '2px solid #c9a860', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#c9a860', fontFamily: 'Georgia, serif' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#1e110a', fontWeight: 600, lineHeight: 1.5, fontFamily: 'Georgia, serif' }}>{value}</p>
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic', color: '#c9a860', fontFamily: 'Georgia, serif' }}>Black tie · Kindly RSVP</p>
        </div>

        {/* Gold bottom bar */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)' }} />
      </div>


      {/* RSVP panel */}
      <div style={{ width: '100%', background: 'rgba(255,252,248,0.95)', borderRadius: 16, padding: '18px 24px 20px', boxShadow: '0 2px 20px rgba(100,70,30,0.10)', border: '1px solid rgba(201,168,96,0.25)' }}>
        <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#9a7c58', fontFamily: 'Georgia, serif', margin: '0 0 14px' }}>Kindly respond</p>
        <RSVPClient guestId={guestId} token={token} />
      </div>

      {/* Download — fetches the clean server-rendered PNG */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          width: '100%',
          background: downloading ? '#c4a87a' : 'linear-gradient(135deg, #c9a860 0%, #8a6e3a 100%)',
          color: '#fff', border: 'none', outline: 'none', borderRadius: 12,
          padding: '14px 0', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
          cursor: downloading ? 'not-allowed' : 'pointer',
          fontFamily: 'Georgia, serif', fontWeight: 700,
          boxShadow: downloading ? 'none' : '0 4px 20px rgba(138,110,58,0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        {downloading ? 'Generating…' : 'Download Invite'}
      </button>

    </div>
  );
}
