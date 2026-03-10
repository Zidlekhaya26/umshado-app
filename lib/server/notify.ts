import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Server-side notification creator — single source of truth.
 * NEVER import this from a 'use client' component.
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
    if (error) console.error('[notify] DB insert error:', error);

    // 2. Web Push — inline, no self-referential HTTP call
    // Import lazily so this file can still be used without web-push installed
    try {
      const webpush = (await import('web-push')).default;

      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@umshado.co.za';

      if (!vapidPublic || !vapidPrivate) {
        console.warn('[notify] VAPID keys not configured — skipping push');
        return;
      }

      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

      // Fetch subscriptions for all target users
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .in('user_id', ids);

      if (!subs || subs.length === 0) return;

      const pushPayload = JSON.stringify({
        title,
        body,
        icon: '/logo-icon.png',
        badge: '/logo-icon.png',
        tag: type,
        data: { link: link ?? '/', type },
      });

      const results = await Promise.allSettled(
        subs.map(async (sub: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload
            );
            return { ok: true };
          } catch (err: any) {
            // 410/404 = subscription gone, clean it up
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
            console.error('[notify] push failed:', err.statusCode, err.message);
            return { ok: false };
          }
        })
      );

      const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as any).ok).length;
      console.log(`[notify] push sent=${sent}/${subs.length}`);
    } catch (pushErr) {
      // web-push not installed or any other push error — never break the main flow
      console.error('[notify] push error:', pushErr);
    }
  } catch (err) {
    console.error('[notify] Unexpected error:', err);
  }
}

export async function shouldThrottleMessageNotification(
  receiverUserId: string,
  threadId: string,
  cooldownSeconds = 60,
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', receiverUserId)
      .eq('type', 'message_received')
      .gte('created_at', since)
      .limit(1);

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
    console.error('[notify] throttle check error:', err);
    return false;
  }
}

