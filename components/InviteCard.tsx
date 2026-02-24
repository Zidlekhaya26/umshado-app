"use client";

import { useEffect, useState, useRef } from 'react';
import RSVPClient from '@/app/rsvp/[guestId]/RSVPClient';
import styles from '@/styles/inviteCard.module.css';
import { exportPNG } from '@/utils/exportInvite';

export default function InviteCard({
  guestName,
  coupleName,
  date,
  venue,
  avatarUrl,
  guestId,
  token
}: {
  guestName: string;
  coupleName: string | null;
  date: string | null;
  venue: string | null;
  avatarUrl?: string | null;
  guestId: string;
  token: string | null;
}) {
  const [theme, setTheme] = useState<'nude' | 'cream' | 'champagne' | 'white'>('nude');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Wait for fonts (if any) to load before enabling export
    if (document && (document as any).fonts) {
      (document as any).fonts.ready.then(() => setFontsLoaded(true)).catch(() => setFontsLoaded(true));
    } else {
      setFontsLoaded(true);
    }
  }, []);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      await exportPNG(cardRef.current, { fileName: `${guestName.replace(/\s+/g, '_')}_invite.png`, scale: 2 });
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export invite. See console for details.');
    }
  };

  const displayDate = date ?? 'Date TBC';
  const displayVenue = venue ?? 'Venue TBC';

  return (
    <div className={styles.wrapper} data-theme={theme}>
      <div className={styles.controls}>
        <div className={styles.themes}>
          {(['nude','cream','champagne','white'] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)} className={`${styles.themeBtn} ${theme===t?styles.active:''}`}>{t}</button>
          ))}
        </div>
        <div className={styles.actions}>
          <button onClick={handleDownload} disabled={!fontsLoaded} className={styles.downloadBtn}>Download Invite</button>
        </div>
      </div>

      <div className={styles.cardArea} ref={cardRef} id="invite-card">
        <div className={styles.cardTop}>
          <img src={avatarUrl || '/images/default-avatar.png'} alt="Couple avatar" className={styles.avatar} crossOrigin="anonymous" />
        </div>
        <div className={styles.cardBody}>
          <p className={styles.guestLabel}>{guestName.toUpperCase()}</p>
          <p className={styles.invitedText}>YOU ARE INVITED TO</p>
          <h2 className={styles.coupleName}>{coupleName ?? 'The Couple'}</h2>
          <div className={styles.details}>
            <div>
              <p className={styles.detailLabel}>DATE</p>
              <p className={styles.detailValue}>{displayDate}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>VENUE</p>
              <p className={styles.detailValue}>{displayVenue}</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.rsvpArea}>
        <RSVPClient guestId={guestId} token={token} />
      </div>
    </div>
  );
}
