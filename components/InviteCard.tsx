"use client";

import { useRef, useState } from 'react';
import RSVPClient from '@/app/rsvp/[guestId]/RSVPClient';
import { exportPNG } from '@/utils/exportInvite';

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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      await exportPNG(cardRef.current, {
        fileName: guestName.replace(/\s+/g, '_') + '_invite.png',
        scale: 3,
      });
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

      {/* ── Download Button ───────────────────────────────── */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          background: '#8b6f47',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: 14,
          fontWeight: 600,
          cursor: downloading ? 'not-allowed' : 'pointer',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 2px 8px rgba(139, 111, 71, 0.25)',
        }}
      >
        {downloading ? 'Saving...' : 'Download Invite'}
      </button>

      {/* ── The Card ─────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          width: '100%',
          background: '#fff',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          position: 'relative',
        }}
      >
        {/* Photo section */}
        <div style={{
          width: '100%',
          aspectRatio: '4/3',
          background: 'linear-gradient(180deg, #f0e8df 0%, #e8ddd4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Couple"
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#b8a898' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💍</div>
              <p style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>Photo coming soon</p>
            </div>
          )}
          {/* Gradient overlay at bottom of photo */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
            background: 'linear-gradient(to top, rgba(255, 255, 255, 1), transparent)',
          }} />
        </div>

        {/* Card body */}
        <div style={{ padding: '32px 28px', textAlign: 'center' }}>

          {/* Invitation text */}
          <p style={{
            fontSize: 14, color: '#5c3d2e', lineHeight: 1.6, margin: '0 0 24px',
            fontFamily: 'system-ui, sans-serif', fontWeight: 500,
          }}>
            {guestName} <br />
            <span style={{ fontStyle: 'italic' }}>with love in our hearts</span>,<br />
            invite you to
          </p>

          {/* Couple name — the hero element */}
          <h2 style={{
            fontSize: 32, fontWeight: 400, color: '#5c3d2e',
            lineHeight: 1.3, margin: '0 0 32px',
            fontStyle: 'italic',
          }}>
            {coupleName ?? 'The Wedding'}
          </h2>

          {/* Date & Venue */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <p style={{ 
                fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                color: '#b8a898', fontFamily: 'system-ui, sans-serif', marginBottom: 10, fontWeight: 500,
              }}>
                Date
              </p>
              <p style={{ fontSize: 15, color: '#3d2b1f', fontWeight: 500, lineHeight: 1.4 }}>
                {date ?? 'To be announced'}
              </p>
            </div>
            <div>
              <p style={{ 
                fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                color: '#b8a898', fontFamily: 'system-ui, sans-serif', marginBottom: 10, fontWeight: 500,
              }}>
                Venue
              </p>
              <p style={{ fontSize: 15, color: '#3d2b1f', fontWeight: 500, lineHeight: 1.4 }}>
                {venue ?? 'To be announced'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RSVP Section ─────────────────────────────────── */}
      <div style={{ width: '100%', display: 'flex', gap: 12, justifyContent: 'center' }}>
        <RSVPClient guestId={guestId} token={token} />
      </div>

    </div>
  );
}
