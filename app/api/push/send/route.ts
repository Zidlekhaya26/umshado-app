import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@umshado.co.za',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

/**
 * POST /api/push/send
 *
 * Internal endpoint — called by notifyUsers() to deliver a push
 * to all subscribed devices for a given user.
 *
 * Body: { userId, title, body, link?, tag? }
 * OR:   { notificationId }  ← legacy / manual test path
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string;
    let title: string;
    let messageBody: string;
    let link: string | null = null;
    let tag: string | undefined;

    if (body.notificationId) {
      // ── Legacy path: fetch notification from DB ──────────────────
      const { data: notification, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', body.notificationId)
        .single();

      if (notifError || !notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      userId = notification.user_id;
      title = notification.title;
      messageBody = notification.body;
      link = notification.link;
      tag = notification.type;
    } else if (body.userId && body.title && body.body) {
      // ── Direct path: called from notifyUsers() ───────────────────
      userId = body.userId;
      title = body.title;
      messageBody = body.body;
      link = body.link || null;
      tag = body.tag;
    } else {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (subError) {
      console.error('[push/send] subscription query error:', subError);
      return NextResponse.json({ error: 'DB error fetching subscriptions' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions', sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: '/logo-icon.png',
      badge: '/logo-icon.png',
      tag: tag || 'umshado',
      data: { link, tag },
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { success: true };
        } catch (err: any) {
          console.error(`[push/send] push failed (${sub.endpoint.slice(0, 50)}):`, err.statusCode, err.message);
          // 410 Gone = subscription expired, delete it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { success: false, status: err.statusCode };
        }
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - sent;
    console.log(`[push/send] sent=${sent} failed=${failed} total=${results.length}`);

    return NextResponse.json({ sent, failed, total: results.length });
  } catch (err: any) {
    console.error('[push/send] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
