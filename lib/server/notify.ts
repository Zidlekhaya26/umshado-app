import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Server-side notification creator — single source of truth.
 * Uses SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 * Also fires Web Push via /api/push/send (uses web-push package).
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

    // 2. Fire Web Push for each user — via /api/push/send (uses web-push package)
    // Fire-and-forget: push errors must never break the primary flow
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
      || 'http://localhost:3000';

    await Promise.allSettled(
      ids.map((userId) =>
        fetch(`${baseUrl}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title, body, link: link ?? null, tag: type }),
        }).catch((err) => {
          console.error('[notify] push/send fetch error for user', userId, err);
        })
      )
    );
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

