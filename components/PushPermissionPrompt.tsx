'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

const STORAGE_KEY = 'umshado_push_prompted';

export default function PushPermissionPrompt() {
  const { user, loading: authLoading } = useAuthRole();
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Only show to authenticated users — unauthenticated users have no token to save the subscription
    if (authLoading || !user) return;
    if (permission === 'unsupported' || permission === 'denied') return;
    if (isSubscribed) return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    }, 2500);
    return () => clearTimeout(timer);
  }, [authLoading, user, permission, isSubscribed]);

  const handleEnable = async () => {
    setError(null);
    try {
      const ok = await subscribe();
      if (ok) {
        setSuccess(true);
        sessionStorage.setItem(STORAGE_KEY, '1');
        setTimeout(() => {
          setAnimateIn(false);
          setTimeout(() => setVisible(false), 300);
        }, 2200);
      } else {
        if (Notification.permission === 'denied') {
          setError('Notifications are blocked in your browser settings. Please allow them for this site and try again.');
        } else {
          setError('Something went wrong. Please try again in a moment.');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const dismiss = () => {
    setAnimateIn(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes um-ring {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(14deg); }
          20%  { transform: rotate(-8deg); }
          30%  { transform: rotate(14deg); }
          40%  { transform: rotate(-4deg); }
          50%  { transform: rotate(10deg); }
          60%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes um-fade-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes um-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Backdrop blur on mobile */}
      <div
        className="fixed inset-0 z-[59] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0)', transition: 'background 0.3s' }}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+80px)]">
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            transform: animateIn ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform 0.35s cubic-bezier(0.34,1.4,0.64,1)',
          }}
        >
          <div style={{
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 -4px 0 rgba(154,33,67,0.15), 0 20px 60px rgba(0,0,0,0.35)',
            background: '#1c0d14',
            border: '1px solid rgba(154,33,67,0.25)',
          }}>

            {/* Top crimson accent line */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #9A2143, #BD983F, #9A2143)' }} />

            {success ? (
              /* ── Success state ── */
              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(45,122,79,0.15)', border: '1.5px solid rgba(45,122,79,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'um-fade-in 0.3s ease',
                }}>
                  <svg width="20" height="20" fill="none" stroke="#4ade80" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>You&apos;re in the loop!</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                    We&apos;ll alert you for messages, quotes &amp; RSVPs.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Default / error state ── */
              <div style={{ padding: '18px 20px 20px' }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: error ? 12 : 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(154,33,67,0.3), rgba(154,33,67,0.1))',
                    border: '1px solid rgba(154,33,67,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg
                      width="22" height="22" fill="none" stroke="#BD983F" strokeWidth={1.8} viewBox="0 0 24 24"
                      style={{ animation: 'um-ring 2s ease 1s 1' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>Stay in the loop</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45 }}>
                      Get instant alerts for messages, quotes &amp; RSVPs — even when the app is closed.
                    </p>
                  </div>

                  <button
                    onClick={dismiss}
                    style={{ padding: 6, marginTop: -4, marginRight: -4, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}
                    aria-label="Dismiss"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 12,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <svg width="15" height="15" fill="none" stroke="#f87171" strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', lineHeight: 1.45 }}>{error}</p>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={dismiss}
                    style={{
                      flex: 1, padding: '11px 0', borderRadius: 14, fontSize: 13, fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                    }}
                  >
                    Not now
                  </button>
                  <button
                    onClick={handleEnable}
                    disabled={isLoading}
                    style={{
                      flex: 2, padding: '11px 0', borderRadius: 14, fontSize: 13, fontWeight: 700,
                      background: isLoading ? 'rgba(154,33,67,0.5)' : 'linear-gradient(135deg, #9A2143, #731832)',
                      border: 'none', color: '#fff', cursor: isLoading ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: isLoading ? 'none' : '0 3px 12px rgba(154,33,67,0.35)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                        Enabling…
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Enable notifications
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
