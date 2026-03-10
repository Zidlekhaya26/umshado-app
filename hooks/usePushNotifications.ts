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

function toBase64Url(key: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(key)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getVapidPublicKey(): string | null {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="vapid-public-key"]');
    if (meta) {
      const val = meta.getAttribute('content');
      if (val && val.length > 10) return val;
    }
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Checks if the current browser push subscription was created with
 * a different VAPID key than the one currently in use.
 * If so, unsubscribes and deletes from DB so a fresh one can be created.
 */
async function clearStaleSubscription(
  reg: ServiceWorkerRegistration,
  currentVapidKey: string,
  token: string,
): Promise<void> {
  const existing = await reg.pushManager.getSubscription();
  if (!existing) return;

  // The applicationServerKey on an existing subscription tells us which
  // VAPID key it was created with. Compare to current key.
  try {
    const existingKeyBytes = existing.options?.applicationServerKey;
    if (existingKeyBytes) {
      const existingKeyB64 = btoa(String.fromCharCode(...new Uint8Array(existingKeyBytes)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const currentKeyBytes = urlBase64ToUint8Array(currentVapidKey);
      const currentKeyB64 = btoa(String.fromCharCode(...currentKeyBytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      if (existingKeyB64 === currentKeyB64) {
        // Keys match — subscription is valid, nothing to do
        return;
      }

      console.log('[push] VAPID key mismatch — clearing stale subscription');
    }
  } catch (e) {
    // options.applicationServerKey not available in all browsers — proceed with clearing
    console.log('[push] Cannot read existing key, clearing subscription to be safe');
  }

  // Unsubscribe from browser
  const endpoint = existing.endpoint;
  await existing.unsubscribe();

  // Delete from DB
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});

  console.log('[push] Stale subscription cleared');
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

    // Register SW early — needed even before user clicks Enable
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        
        if (sub && Notification.permission === 'granted') {
          // Subscription exists — check if VAPID key still matches
          const vapidKey = getVapidPublicKey();
          const token = await getAuthToken();
          if (vapidKey && token) {
            await clearStaleSubscription(reg, vapidKey, token);
            // Check again after potential clear
            const subAfter = await reg.pushManager.getSubscription();
            setIsSubscribed(!!subAfter);
          } else {
            setIsSubscribed(true);
          }
        } else {
          setIsSubscribed(!!sub);
        }
      })
      .catch((err) => console.warn('[push] SW registration failed:', err));
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const vapidKey = getVapidPublicKey();
      if (!vapidKey) {
        console.error('[push] VAPID public key not found in meta tag or env');
        return false;
      }

      const token = await getAuthToken();
      if (!token) {
        console.error('[push] No auth token — user must be logged in');
        return false;
      }

      // Clear any stale subscription before creating a new one
      await clearStaleSubscription(reg, vapidKey, token);

      // Create fresh subscription with current VAPID key
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      console.log('[push] New subscription created:', subscription.endpoint.slice(0, 60));

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
        console.log('[push] Subscription saved to DB ✅');
        setIsSubscribed(true);
        return true;
      }

      const errBody = await res.text().catch(() => '');
      console.error('[push] Failed to save subscription:', res.status, errBody);
      return false;
    } catch (err: any) {
      console.error('[push] subscribe() error:', err?.message || err);
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
      if (!subscription) { setIsSubscribed(false); return; }

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
