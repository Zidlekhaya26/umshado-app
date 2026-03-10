'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UsePushNotifications {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** base64url — required by web-push for p256dh and auth keys */
function toBase64Url(key: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(key)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Read VAPID public key — tries meta tag first (always works), then process.env fallback */
function getVapidPublicKey(): string | null {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="vapid-public-key"]');
    if (meta) return meta.getAttribute('content');
  }
  // process.env fallback (only works if built with the var set)
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export function usePushNotifications(): UsePushNotifications {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermission);

    // Register SW on every page load (idempotent) so push works even if prompt was dismissed
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    }).catch((err) => {
      console.warn('[push] SW registration failed:', err);
    });
  }, []);

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidPublicKey = getVapidPublicKey();
      if (!vapidPublicKey) {
        console.error('[push] VAPID public key not available');
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const token = await getAuthToken();
      if (!token) return false;

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: toBase64Url(subscription.getKey('p256dh')!),
            auth: toBase64Url(subscription.getKey('auth')!),
          },
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        return true;
      }
      const errJson = await res.json().catch(() => ({}));
      console.error('[push] subscribe save failed:', res.status, errJson);
      return false;
    } catch (err) {
      console.error('[push] subscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const token = await getAuthToken();
      if (token) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
