import { createServiceClient } from '@/lib/supabaseServer';
import { sendWebPush, type PushSubscription } from './webpush';

/**
 * Server-side notification creator — single source of truth.
 * Uses SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 * Also fires Web Push to any registered browser subscriptions.
 *
 * NEVER import this file from a 'use client' component.
 */

export interface NotifyPayload {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Insert one notification per userId into public.notifications,
 * then fire Web Push to all registered subscriptions for those users.
 * Silently skips empty userIds. Logs errors but never throws.
 */
export async function notifyUsers(payload: NotifyPayload): Promise<void> {
  const { userIds, type, title, body, link, meta } = payload;

  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const supabase = createServiceClient();

    // 1. Insert in-app notifications
    const rows = ids.map((uid) => ({
      user_id: uid,
      type,
      title,
      body,
      link: link ?? null,
      is_read: false,
      meta: meta ?? {},
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      console.error('[notify] Failed to insert notifications:', error);
    }

    // 2. Fire Web Push to all subscriptions for these users (fire-and-forget)
    try {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', ids);

      if (subs && subs.length > 0) {
        const pushPayload = {
          title,
          body,
          icon: '/logo-icon.png',
          badge: '/logo-icon.png',
          tag: type,
          url: link || '/',
          data: { link, type, ...(meta || {}) },
        };

        const results = await Promise.allSettled(
          subs.map((sub: any) => {
            const subscription: PushSubscription = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            return sendWebPush(subscription, pushPayload);
          })
        );

        // Clean up expired / invalid subscriptions (410 Gone = unsubscribed)
        const expiredEndpoints: string[] = [];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value.status === 410) {
            expiredEndpoints.push(subs[i].endpoint);
          }
        });
        if (expiredEndpoints.length > 0) {
          await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
        }
      }
    } catch (pushErr) {
      console.error('[notify] Web push error:', pushErr);
    }
  } catch (err) {
    console.error('[notify] Unexpected error:', err);
  }
}

/**
 * Anti-spam: returns true if we should SKIP sending the notification
 * (one was already sent within the cooldown window for this thread).
 */
export async function shouldThrottleMessageNotification(
  receiverUserId: string,
  threadId: string,
  cooldownSeconds = 60,
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - cooldownSeconds * 1000).toISOString();

    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', receiverUserId)
      .eq('type', 'message_received')
      .gte('created_at', since)
      .limit(1);

    if (error) {
      console.error('[notify] throttle check error:', error);
      return false;
    }

    if (data && data.length > 0) {
      const { data: exactMatch } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', receiverUserId)
        .eq('type', 'message_received')
        .gte('created_at', since)
        .contains('meta', { threadId })
        .limit(1);
      return (exactMatch?.length ?? 0) > 0;
    }

    return false;
  } catch (err) {
    console.error('[notify] throttle check unexpected error:', err);
    return false;
  }
}

