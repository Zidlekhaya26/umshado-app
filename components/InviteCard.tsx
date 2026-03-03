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
    <div style={{
      width: '100%',
      maxWidth: 480,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 20,
    }}>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          PRINTABLE CARD — cardRef wraps ONLY this section.
          All children use inline styles only. No Tailwind.
          No interactive elements. No borders from browser.
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        ref={cardRef}
        style={{
          width: '100%',
          background: '#fdfaf6',
          borderRadius: 0,
          overflow: 'hidden',
          outline: 'none',
          border: 'none',
          boxShadow: 'none',
          fontFamily: 'Georgia, "Times New Roman", serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        {/* ── Gold top rule ─────────────────────────────── */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)',
          flexShrink: 0,
        }} />

        {/* ── Couple photo ──────────────────────────────── */}
        <div style={{
          width: '100%',
          height: 340,
          overflow: 'hidden',
          position: 'relative',
          background: '#ede3d8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Couple"
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
                display: 'block',
                outline: 'none',
                border: 'none',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#c4a882' }}>
              <div style={{ fontSize: 52, lineHeight: 1 }}>💍</div>
              <p style={{
                margin: '12px 0 0',
                fontSize: 10,
                letterSpacing: 4,
                textTransform: 'uppercase',
                fontFamily: 'Georgia, serif',
                color: '#c4a882',
              }}>Photo coming soon</p>
            </div>
          )}
          {/* Soft vignette fade into body */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
            background: 'linear-gradient(to top, #fdfaf6 0%, rgba(253,250,246,0) 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* ── Invitation body ───────────────────────────── */}
        <div style={{
          background: '#fdfaf6',
          padding: '4px 48px 44px',
          textAlign: 'center',
        }}>

          {/* Thin gold rule + ornament */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#c9a860', fontSize: 13, lineHeight: 1, fontFamily: 'Georgia, serif' }}>✦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>

          {/* "Dear" */}
          <p style={{
            margin: '0 0 3px',
            fontSize: 10,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: '#9a7c58',
            fontFamily: 'Georgia, serif',
          }}>Dear</p>

          {/* Guest name */}
          <p style={{
            margin: '0 0 16px',
            fontSize: 22,
            fontWeight: 700,
            color: '#1e110a',
            letterSpacing: 0.5,
            fontFamily: 'Georgia, serif',
            lineHeight: 1.3,
          }}>{guestName}</p>

          {/* Invitation prose */}
          <p style={{
            margin: '0 0 4px',
            fontSize: 13,
            color: '#6b4d34',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.7,
          }}>with love in our hearts, we invite you to</p>
          <p style={{
            margin: '0 0 18px',
            fontSize: 10,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#9a7c58',
            fontFamily: 'Georgia, serif',
          }}>celebrate the marriage of</p>

          {/* Couple name — the statement */}
          <h2 style={{
            margin: '0 0 30px',
            fontSize: 36,
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1e110a',
            lineHeight: 1.25,
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: 0.5,
          }}>{coupleName ?? 'The Wedding'}</h2>

          {/* Middle ornament */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#c9a860', fontSize: 10, fontFamily: 'Georgia, serif' }}>♦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>

          {/* Date + Venue tiles */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 28,
          }}>
            {[
              { label: 'Date',  value: date  ?? 'To be announced' },
              { label: 'Venue', value: venue ?? 'To be announced' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '16px 12px',
                background: 'rgba(201,168,96,0.07)',
                borderTop: '2px solid #c9a860',
              }}>
                <p style={{
                  margin: '0 0 6px',
                  fontSize: 9,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: '#c9a860',
                  fontFamily: 'Georgia, serif',
                }}>{label}</p>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#1e110a',
                  fontWeight: 600,
                  lineHeight: 1.5,
                  fontFamily: 'Georgia, serif',
                }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Footer script */}
          <p style={{
            margin: 0,
            fontSize: 11,
            fontStyle: 'italic',
            color: '#c9a860',
            fontFamily: 'Georgia, serif',
            letterSpacing: 0.5,
          }}>Black tie · Kindly RSVP</p>

        </div>

        {/* ── Gold bottom rule ─────────────────────────── */}
        <div style={{
          height: 5,
          background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)',
          flexShrink: 0,
        }} />
      </div>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ end printable card ━ */}


      {/* ── RSVP panel — completely outside cardRef ─────── */}
      <div style={{
        width: '100%',
        background: 'rgba(255,252,248,0.92)',
        borderRadius: 16,
        padding: '18px 24px 20px',
        boxShadow: '0 2px 20px rgba(100,70,30,0.10)',
        border: '1px solid rgba(201,168,96,0.25)',
        backdropFilter: 'blur(10px)',
      }}>
        <p style={{
          textAlign: 'center',
          fontSize: 10,
          letterSpacing: 4,
          textTransform: 'uppercase',
          color: '#9a7c58',
          fontFamily: 'Georgia, serif',
          margin: '0 0 14px',
        }}>Kindly respond</p>
        <RSVPClient guestId={guestId} token={token} />
      </div>

      {/* ── Download button ──────────────────────────────── */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          width: '100%',
          background: downloading
            ? '#c4a87a'
            : 'linear-gradient(135deg, #c9a860 0%, #8a6e3a 100%)',
          color: '#fff',
          border: 'none',
          outline: 'none',
          borderRadius: 12,
          padding: '14px 0',
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          cursor: downloading ? 'not-allowed' : 'pointer',
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          boxShadow: downloading ? 'none' : '0 4px 20px rgba(138,110,58,0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        {downloading ? 'Saving…' : 'Download Invite'}
      </button>

    </div>
  );
}
