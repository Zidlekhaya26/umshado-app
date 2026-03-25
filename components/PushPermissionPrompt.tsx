'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const STORAGE_KEY = 'umshado_push_prompted';

export default function PushPermissionPrompt() {
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (permission === 'unsupported' || permission === 'denied') return;

    // Show if: not yet subscribed AND not dismissed this session
    if (isSubscribed) return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    }, 2000);
    return () => clearTimeout(timer);
  }, [permission, isSubscribed]);

  const handleEnable = async () => {
    setError(null);
    try {
      const ok = await subscribe();
      if (ok) {
        setSuccess(true);
        sessionStorage.setItem(STORAGE_KEY, '1');
        setTimeout(() => setVisible(false), 2500);
      } else {
        // subscribe() returned false — give a specific reason
        if (Notification.permission === 'denied') {
          setError('Notifications are blocked. Open browser settings and allow notifications for this site, then try again.');
        } else {
          setError('Could not save subscription. Check Vercel logs for [push/subscribe] errors.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error — check browser console.');
    }
  };

  const dismiss = () => {
    setAnimateIn(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-none">
      <div
        className="pointer-events-auto mx-auto max-w-md transition-transform duration-300 ease-out"
        style={{ transform: animateIn ? 'translateY(0)' : 'translateY(110%)' }}
      >
        <div className="m-4 rounded-2xl shadow-2xl" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
          {success ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Notifications enabled!</p>
                <p className="text-xs text-gray-400 mt-0.5">You&apos;ll get alerts for messages, quotes &amp; RSVPs.</p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(107,31,58,0.4)' }}>
                  <svg className="w-5 h-5" style={{ color: '#c9a84c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Stay in the loop</p>
                  <p className="text-xs text-gray-400 mt-0.5">Get alerts for messages, quotes & RSVPs — even when the app is closed.</p>
                </div>
                <button onClick={dismiss} className="p-1 text-gray-500 hover:text-gray-300 -mt-1 -mr-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mt-3 rounded-lg px-3 py-2 text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  {error}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button onClick={dismiss} className="flex-1 rounded-xl py-2.5 text-sm font-medium text-gray-400" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  Not now
                </button>
                <button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#6b1f3a', color: '#fff' }}
                >
                  {isLoading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Enable notifications'
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
