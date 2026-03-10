"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Props {
  guestId: string;
  token: string | null;
  guestName: string;
  coupleName: string | null;
  partnerName: string | null;
  avatarUrl: string | null;
  weddingDate: string | null;
  weddingVenue: string | null;
}

export default function RSVPClient({
  guestId,
  token: propToken,
  guestName,
  coupleName,
  partnerName,
  avatarUrl,
  weddingDate,
  weddingVenue,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [token, setToken] = useState<string | null>(propToken ?? null);
  const [visible, setVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

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

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const update = async (newStatus: 'accepted' | 'declined') => {
    if (status !== 'pending') return;
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, status: newStatus, token }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.success) {
        setStatus(newStatus);
      }
    } catch (e) {
      // silent fail - user can retry
    } finally {
      setLoading(false);
    }
  };

  // Format date display
  let dayNum = '';
  let monthYear = '';
  let daysUntil = 0;
  if (weddingDate) {
    try {
      const d = new Date(weddingDate);
      if (!isNaN(d.getTime())) {
        dayNum = d.getDate().toString();
        monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        daysUntil = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
    } catch (_) {}
  }

  // Build couple display name
  let coupleDisplay = '';
  if (coupleName && partnerName) {
    coupleDisplay = `${coupleName} & ${partnerName}`;
  } else if (coupleName) {
    coupleDisplay = coupleName;
  } else if (partnerName) {
    coupleDisplay = partnerName;
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');
      `}</style>

      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-6"
        style={{
          background: 'linear-gradient(160deg, #f5ebe0 0%, #e3d5ca 40%, #d6c1a6 100%)',
        }}
      >
        <div
          className={`relative max-w-lg w-full transition-all duration-1000 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Main invitation card */}
          <div
            className="relative bg-gradient-to-br from-[#fdfbf7] to-[#f8f4ed] rounded-lg shadow-2xl overflow-hidden"
            style={{
              border: '1px solid #d4af37',
              boxShadow: '0 20px 60px rgba(139, 100, 55, 0.15)',
            }}
          >
            {/* Gold corner ornaments */}
            <div className="absolute top-0 left-0 w-12 h-12 opacity-40">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 0 L24 0 L24 1 L1 1 L1 24 L0 24 Z"
                  fill="#d4af37"
                />
                <path
                  d="M2 2 L22 2 L22 3 L3 3 L3 22 L2 22 Z"
                  fill="#d4af37"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div className="absolute top-0 right-0 w-12 h-12 opacity-40 rotate-90">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 0 L24 0 L24 1 L1 1 L1 24 L0 24 Z"
                  fill="#d4af37"
                />
                <path
                  d="M2 2 L22 2 L22 3 L3 3 L3 22 L2 22 Z"
                  fill="#d4af37"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 w-12 h-12 opacity-40 -rotate-90">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 0 L24 0 L24 1 L1 1 L1 24 L0 24 Z"
                  fill="#d4af37"
                />
                <path
                  d="M2 2 L22 2 L22 3 L3 3 L3 22 L2 22 Z"
                  fill="#d4af37"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div className="absolute bottom-0 right-0 w-12 h-12 opacity-40 rotate-180">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 0 L24 0 L24 1 L1 1 L1 24 L0 24 Z"
                  fill="#d4af37"
                />
                <path
                  d="M2 2 L22 2 L22 3 L3 3 L3 22 L2 22 Z"
                  fill="#d4af37"
                  opacity="0.6"
                />
              </svg>
            </div>

            {/* Top botanical flourish */}
            <div
              className={`flex justify-center pt-8 transition-all duration-700 delay-200 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
              }`}
            >
              <svg width="180" height="32" viewBox="0 0 180 32" fill="none">
                <path
                  d="M90 2 Q80 8, 70 10 Q60 12, 50 10 Q40 8, 30 14 M90 2 Q100 8, 110 10 Q120 12, 130 10 Q140 8, 150 14"
                  stroke="#c9a86a"
                  strokeWidth="1.5"
                  opacity="0.5"
                  fill="none"
                />
                <circle cx="50" cy="10" r="2" fill="#c9a86a" opacity="0.4" />
                <circle cx="70" cy="10" r="2.5" fill="#c9a86a" opacity="0.5" />
                <circle cx="110" cy="10" r="2.5" fill="#c9a86a" opacity="0.5" />
                <circle cx="130" cy="10" r="2" fill="#c9a86a" opacity="0.4" />
                <path
                  d="M90 2 L88 8 L90 14 L92 8 Z"
                  fill="#d4af37"
                  opacity="0.3"
                />
              </svg>
            </div>

            <div className="px-8 sm:px-12 py-8 text-center space-y-6">
              {/* Couple photo */}
              {avatarUrl && !imageError && (
                <div
                  className={`flex justify-center transition-all duration-700 delay-300 ${
                    visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  }`}
                >
                  <div className="relative">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37, #f4e4c1)',
                        padding: '3px',
                      }}
                    >
                      <div
                        className="w-full h-full rounded-full"
                        style={{ background: '#fdfbf7' }}
                      />
                    </div>
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg">
                      <Image
                        src={avatarUrl}
                        alt="Couple"
                        fill
                        className="object-cover"
                        onError={() => setImageError(true)}
                      />
                    </div>
                    <div
                      className="absolute -inset-1 rounded-full pointer-events-none"
                      style={{
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
                      }}
                    />
                  </div>
                </div>
              )}

              {(!avatarUrl || imageError) && (
                <div
                  className={`flex justify-center transition-all duration-700 delay-300 ${
                    visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  }`}
                >
                  <div className="w-20 h-20 flex items-center justify-center text-5xl">
                    💍
                  </div>
                </div>
              )}

              {/* Couple names */}
              {coupleDisplay && (
                <div
                  className={`transition-all duration-700 delay-400 ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  <h1
                    className="text-4xl sm:text-5xl font-semibold italic leading-tight"
                    style={{ color: '#5a4a3a', letterSpacing: '0.02em' }}
                  >
                    {coupleDisplay.split(' & ').map((name, i, arr) => (
                      <span key={i}>
                        {name}
                        {i < arr.length - 1 && (
                          <span
                            className="inline-block mx-2 text-3xl"
                            style={{ color: '#d4af37' }}
                          >
                            &
                          </span>
                        )}
                      </span>
                    ))}
                  
</h1>
                </div>
              )}

              {/* Invitation text */}
              <div
                className={`transition-all duration-700 delay-500 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                <p
                  className="text-sm uppercase tracking-[0.2em] font-semibold"
                  style={{ color: '#8b7355' }}
                >
                  Request the honour of your presence
                </p>
              </div>

              {/* Wedding date */}
              {dayNum && monthYear && (
                <div
                  className={`transition-all duration-700 delay-600 ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  <div className="flex items-baseline justify-center gap-3">
                    <span
                      className="text-5xl sm:text-6xl font-bold"
                      style={{ color: '#5a4a3a' }}
                    >
                      {dayNum}
                    </span>
                    <span
                      className="text-2xl italic"
                      style={{ color: '#8b7355' }}
                    >
                      {monthYear}
                    </span>
                  </div>
                  {daysUntil > 0 && (
                    <p
                      className="text-xs mt-2 italic tracking-wide"
                      style={{ color: '#a8937d' }}
                    >
                      {daysUntil} {daysUntil === 1 ? 'day' : 'days'} until the celebration
                    </p>
                  )}
                </div>
              )}

              {/* Venue */}
              {weddingVenue && (
                <div
                  className={`transition-all duration-700 delay-700 ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  <p
                    className="text-lg italic"
                    style={{ color: '#6b5d4f' }}
                  >
                    {weddingVenue}
                  </p>
                </div>
              )}

              {/* Personalized greeting */}
              <div
                className={`transition-all duration-700 delay-800 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                <div
                  className="inline-block px-6 py-2 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.15))',
                    border: '1px solid rgba(212,175,55,0.2)',
                  }}
                >
                  <p
                    className="text-base font-semibold"
                    style={{ color: '#5a4a3a' }}
                  >
                    {guestName}
                  </p>
                </div>
              </div>

              {/* RSVP section */}
              <div
                className={`transition-all duration-700 delay-900 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                {status === 'pending' && (
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => update('accepted')}
                      disabled={loading || !token}
                      className="w-full py-4 rounded-full font-semibold text-white text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #f4e4c1 100%)',
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '0.05em',
                      }}
                    >
                      {loading ? 'Confirming...' : 'Joyfully Accepts'}
                    </button>
                    <button
                      onClick={() => update('declined')}
                      disabled={loading || !token}
                      className="w-full py-4 rounded-full font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 hover:bg-gray-50 active:scale-[0.98]"
                      style={{
                        color: '#8b7355',
                        borderColor: '#d4af37',
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '0.05em',
                      }}
                    >
                      Regretfully Declines
                    </button>
                    {!token && (
                      <p
                        className="text-xs italic mt-3"
                        style={{ color: '#a8937d' }}
                      >
                        Missing RSVP token. Please ask the couple to resend the invite.
                      </p>
                    )}
                  </div>
                )}

                {status === 'accepted' && (
                  <div
                    className="py-6 px-4 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.12))',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}
                  >
                    <div className="text-4xl mb-3">🎉</div>
                    <p
                      className="text-xl font-semibold mb-2"
                      style={{
                        color: '#047857',
                        fontFamily: "'Cormorant Garamond', serif",
                      }}
                    >
                      We are delighted!
                    </p>
                    <p
                      className="text-sm italic"
                      style={{ color: '#065f46' }}
                    >
                      Your presence will make our day complete.
                    </p>
                  </div>
                )}

                {status === 'declined' && (
                  <div
                    className="py-6 px-4 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(156,146,136,0.08), rgba(120,113,108,0.12))',
                      border: '1px solid rgba(139,115,85,0.2)',
                    }}
                  >
                    <p
                      className="text-xl font-semibold mb-2"
                      style={{
                        color: '#6b5d4f',
                        fontFamily: "'Cormorant Garamond', serif",
                      }}
                    >
                      You will be missed
                    </p>
                    <p
                      className="text-sm italic"
                      style={{ color: '#8b7355' }}
                    >
                      Thank you for letting us know.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom botanical flourish */}
            <div
              className={`flex justify-center pb-8 transition-all duration-700 delay-1000 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <svg width="180" height="32" viewBox="0 0 180 32" fill="none">
                <path
                  d="M90 30 Q80 24, 70 22 Q60 20, 50 22 Q40 24, 30 18 M90 30 Q100 24, 110 22 Q120 20, 130 22 Q140 24, 150 18"
                  stroke="#c9a86a"
                  strokeWidth="1.5"
                  opacity="0.5"
                  fill="none"
                />
                <circle cx="50" cy="22" r="2" fill="#c9a86a" opacity="0.4" />
                <circle cx="70" cy="22" r="2.5" fill="#c9a86a" opacity="0.5" />
                <circle cx="110" cy="22" r="2.5" fill="#c9a86a" opacity="0.5" />
                <circle cx="130" cy="22" r="2" fill="#c9a86a" opacity="0.4" />
                <path
                  d="M90 30 L88 24 L90 18 L92 24 Z"
                  fill="#d4af37"
                  opacity="0.3"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
