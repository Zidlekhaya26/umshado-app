import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Server-side notification creator — single source of truth.
 * Uses SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
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
 * Insert one notification per userId into public.notifications.
 * Silently skips empty userIds. Logs errors but never throws
 * (notifications should never break a primary flow).
 */
export async function notifyUsers(payload: NotifyPayload): Promise<void> {
  const { userIds, type, title, body, link, meta } = payload;

  // De-duplicate and filter empties
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const supabase = createServiceClient();

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
  } catch (err) {
    console.error('[notify] Unexpected error:', err);
  }
}

/**
 * Anti-spam check for message notifications.
 * Returns true if we should SKIP sending the notification
 * (i.e. one was already sent within the cooldown window).
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
      return false; // fail open — send the notification
    }

    // Also check meta for the specific threadId
    // Since we store threadId in meta, let's do a secondary filter
    if (data && data.length > 0) {
      // There's a recent message notification — check if it's for the same thread
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
