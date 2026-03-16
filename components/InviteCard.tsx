"use client";

import { useRef, useState } from 'react';
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

  // ── Canvas-based PNG export ────────────────────────────────
  // Draws the invite directly onto a 1200×1380 canvas at 2.5x quality.
  // No external packages. No browser-outline artifacts.
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const W = 1200;
      const H = 1380;
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // ── Palette ──
      const BG      = '#faf7f2';   // warm ivory
      const GOLD    = '#b8973e';   // deep antique gold
      const GOLD_LT = '#d4b86a';   // lighter gold for gradients
      const GOLD_HI = '#e8d090';   // highlight
      const DARK    = '#18100a';   // near-black
      const MID     = '#5c3d28';   // warm brown
      const LITE    = '#8a6e4a';   // muted gold-brown
      const PAD     = 88;

      // ── Background ──
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // ── Outer border frame ──
      // Outer gold line
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, W - 36, H - 36);
      // Inner thin line
      ctx.strokeStyle = GOLD_LT;
      ctx.lineWidth = 1;
      ctx.strokeRect(26, 26, W - 52, H - 52);

      // ── Photo ──
      const PHOTO_H = 480;
      const photoY  = 16;
      if (avatarUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload  = () => res(i);
            i.onerror = () => rej(new Error('img load failed'));
            i.src = '/api/image-proxy?url=' + encodeURIComponent(avatarUrl!);
          });
          const scale = Math.max(W / img.naturalWidth, PHOTO_H / img.naturalHeight);
          const iw = img.naturalWidth  * scale;
          const ih = img.naturalHeight * scale;
          const ix = (W  - iw) / 2;
          const iy = photoY + (PHOTO_H - ih) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, photoY, W, PHOTO_H);
          ctx.clip();
          ctx.drawImage(img, ix, iy, iw, ih);
          ctx.restore();
        } catch {
          ctx.fillStyle = '#e8ddd0';
          ctx.fillRect(0, photoY, W, PHOTO_H);
        }
      } else {
        ctx.fillStyle = '#e8ddd0';
        ctx.fillRect(0, photoY, W, PHOTO_H);
      }

      // ── Photo vignette — stronger fade ──
      const fade = ctx.createLinearGradient(0, photoY + PHOTO_H - 240, 0, photoY + PHOTO_H);
      fade.addColorStop(0, 'rgba(250,247,242,0)');
      fade.addColorStop(1, BG);
      ctx.fillStyle = fade;
      ctx.fillRect(0, photoY + PHOTO_H - 240, W, 240);

      // ── Helper: ornamental rule with diamond ──
      const drawRule = (cy: number) => {
        // Fading gold line
        const lg = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
        lg.addColorStop(0,    'rgba(184,151,62,0)');
        lg.addColorStop(0.25, GOLD_LT);
        lg.addColorStop(0.5,  GOLD);
        lg.addColorStop(0.75, GOLD_LT);
        lg.addColorStop(1,    'rgba(184,151,62,0)');
        ctx.strokeStyle = lg as any;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(PAD + 30, cy); ctx.lineTo(W - PAD - 30, cy); ctx.stroke();
        // Diamond
        ctx.save();
        ctx.translate(W / 2, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = GOLD;
        ctx.fillRect(-9, -9, 18, 18);
        // Inner diamond highlight
        ctx.fillStyle = GOLD_HI;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      };

      let y = photoY + PHOTO_H - 10;

      drawRule(y);
      y += 36;

      // ── Small decorative monogram / crest ──
      // Three small circles forming a trefoil above DEAR
      ctx.fillStyle = GOLD_LT;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(W/2, y - 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W/2 - 12, y - 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W/2 + 12, y - 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // ── D E A R ──
      ctx.fillStyle = LITE;
      ctx.font = '300 26px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '12px';
      ctx.fillText('D  E  A  R', W / 2, y);
      y += 52;

      // ── Guest name ──
      ctx.fillStyle = DARK;
      ctx.font = 'bold 76px Georgia, serif';
      ctx.letterSpacing = '1px';
      ctx.fillText(guestName, W / 2, y);
      y += 50;

      // ── Thin separator line under name ──
      ctx.strokeStyle = 'rgba(184,151,62,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W/2 - 120, y); ctx.lineTo(W/2 + 120, y);
      ctx.stroke();
      y += 38;

      // ── Prose ──
      ctx.fillStyle = MID;
      ctx.font = 'italic 30px Georgia, serif';
      ctx.letterSpacing = '0.5px';
      ctx.fillText('with love in our hearts, we invite you to', W / 2, y);
      y += 32;

      ctx.fillStyle = LITE;
      ctx.font = '300 19px Georgia, serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('CELEBRATE THE MARRIAGE OF', W / 2, y);
      y += 76;

      // ── Couple name — the centrepiece ──
      // Light weight italic — luxury style
      ctx.fillStyle = DARK;
      ctx.font = 'italic 400 96px Georgia, serif';
      ctx.letterSpacing = '0.5px';
      ctx.fillText(coupleDisplay, W / 2, y);
      y += 58;

      drawRule(y);
      y += 42;

      // ── Date + Venue tiles ──
      const tileW = (W - PAD * 2 - 28) / 2;
      const tileH = 150;
      [{ label: 'DATE', value: date ?? 'To be announced' }, { label: 'VENUE', value: venue ?? 'To be announced' }]
        .forEach(({ label, value }, i) => {
          const tx = PAD + i * (tileW + 28);
          const ty = y;

          // Tile background
          ctx.fillStyle = 'rgba(184,151,62,0.06)';
          ctx.fillRect(tx, ty, tileW, tileH);

          // Gold top border gradient
          const tg = ctx.createLinearGradient(tx, 0, tx + tileW, 0);
          tg.addColorStop(0,   '#6b5020');
          tg.addColorStop(0.5, GOLD_HI);
          tg.addColorStop(1,   '#6b5020');
          ctx.fillStyle = tg;
          ctx.fillRect(tx, ty, tileW, 3);

          // Subtle side borders
          ctx.strokeStyle = 'rgba(184,151,62,0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx, ty, tileW, tileH);

          // Label
          ctx.fillStyle = GOLD;
          ctx.font = '300 17px Georgia, serif';
          ctx.letterSpacing = '6px';
          ctx.textAlign = 'center';
          ctx.fillText(label, tx + tileW / 2, ty + 38);

          // Thin rule under label
          ctx.strokeStyle = 'rgba(184,151,62,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx + 20, ty + 52); ctx.lineTo(tx + tileW - 20, ty + 52);
          ctx.stroke();

          // Value
          ctx.fillStyle = DARK;
          ctx.font = 'bold 26px Georgia, serif';
          ctx.letterSpacing = '0px';
          const words = value.split(' ');
          let line = '';
          let lineY = ty + 82;
          for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > tileW - 36 && line) {
              ctx.fillText(line, tx + tileW / 2, lineY);
              line  = word;
              lineY += 36;
            } else { line = test; }
          }
          if (line) ctx.fillText(line, tx + tileW / 2, lineY);
        });
      y += tileH + 40;

      // ── Footer ──
      // Small ornament dots
      ctx.fillStyle = GOLD_LT;
      ctx.globalAlpha = 0.6;
      [-20, 0, 20].forEach(dx => {
        ctx.beginPath(); ctx.arc(W/2 + dx, y, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      y += 22;

      ctx.fillStyle = GOLD;
      ctx.font = 'italic 26px Georgia, serif';
      ctx.letterSpacing = '1.5px';
      ctx.textAlign = 'center';
      ctx.fillText('Black tie  ·  Kindly RSVP', W / 2, y);

      // ── Gold bottom bar ──
      const botGrad = ctx.createLinearGradient(0, 0, W, 0);
      botGrad.addColorStop(0,   '#6b5020');
      botGrad.addColorStop(0.2, GOLD);
      botGrad.addColorStop(0.5, GOLD_HI);
      botGrad.addColorStop(0.8, GOLD);
      botGrad.addColorStop(1,   '#6b5020');
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, H - 16, W, 16);

      // ── Export ──
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = (guestName ?? 'invite').replace(/\s+/g, '_') + '_invite.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');

    } catch (e) {
      console.error('Download failed', e);
      alert('Could not generate invite image. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const coupleDisplay = coupleName ?? 'The Wedding';

  return (
    <div style={{
      width: '100%', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 20,
      fontFamily: 'Georgia, "Times New Roman", serif',
    }}>

      {/* ── On-screen preview card ── */}
      <div style={{
        width: '100%', background: '#faf7f2',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(30,17,10,0.15)',
      }}>
        {/* Gold top */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #6b5020 0%, #b8973e 20%, #e8d090 50%, #b8973e 80%, #6b5020 100%)' }} />

        {/* Photo */}
        {avatarUrl && (
          <div style={{ width: '100%', height: 300, overflow: 'hidden', background: '#ede3d8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <img src={avatarUrl} alt="Couple" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, #fdfaf6, transparent)', pointerEvents: 'none' }} />
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '4px 36px 36px', textAlign: 'center', background: '#fdfaf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#b8973e', fontSize: 12 }}>✦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>
          <p style={{ margin: '0 0 2px', fontSize: 9, letterSpacing: 5, textTransform: 'uppercase', color: '#8a6e4a' }}>Dear</p>
          <p style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 700, color: '#1e110a' }}>{guestName}</p>
          <p style={{ margin: '0 0 3px', fontSize: 12, color: '#6b4d34', fontStyle: 'italic', lineHeight: 1.7 }}>with love in our hearts, we invite you to</p>
          <p style={{ margin: '0 0 14px', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#8a6e4a' }}>celebrate the marriage of</p>
          <h2 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 400, fontStyle: 'italic', color: '#1e110a', lineHeight: 1.2 }}>{coupleDisplay}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #c9a860)' }} />
            <span style={{ color: '#b8973e', fontSize: 9 }}>♦</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #c9a860)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ label: 'Date', value: date ?? 'TBA' }, { label: 'Venue', value: venue ?? 'TBA' }].map(({ label, value }) => (
              <div key={label} style={{ padding: '14px 10px', background: 'rgba(201,168,96,0.07)', borderTop: '2px solid #b8973e', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px', fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: '#b8973e' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#1e110a', fontWeight: 600, lineHeight: 1.4 }}>{value}</p>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 10, fontStyle: 'italic', color: '#b8973e' }}>Black tie · Kindly RSVP</p>
        </div>

        {/* Gold bottom */}
        <div style={{ height: 5, background: 'linear-gradient(90deg, #6b5020 0%, #b8973e 20%, #e8d090 50%, #b8973e 80%, #6b5020 100%)' }} />
      </div>

      {/* RSVP */}
      <div style={{ width: '100%', background: 'rgba(255,252,248,0.95)', borderRadius: 16, padding: '16px 24px 18px', boxShadow: '0 2px 20px rgba(100,70,30,0.10)', border: '1px solid rgba(201,168,96,0.25)' }}>
        <p style={{ textAlign: 'center', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#8a6e4a', margin: '0 0 12px' }}>Kindly respond</p>
        <RSVPClient 
          guestId={guestId} 
          token={token}
          guestName={guestName}
          coupleName={coupleName}
          partnerName={null}
          avatarUrl={avatarUrl ?? null}
          weddingDate={null}
          weddingVenue={venue}
        />
      </div>

      {/* Download */}
      <button onClick={handleDownload} disabled={downloading} style={{
        width: '100%',
        background: downloading ? '#c4a87a' : 'linear-gradient(135deg, #c9a860 0%, #8a6e3a 100%)',
        color: '#fff', border: 'none', outline: 'none', borderRadius: 12,
        padding: '14px 0', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
        cursor: downloading ? 'not-allowed' : 'pointer',
        fontFamily: 'Georgia, serif', fontWeight: 700,
        boxShadow: downloading ? 'none' : '0 4px 20px rgba(138,110,58,0.35)',
      }}>
        {downloading ? 'Generating…' : 'Download Invite'}
      </button>

    </div>
  );
}
