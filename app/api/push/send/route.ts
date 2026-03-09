import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { notificationId } = await req.json();

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the notification
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Get all push subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        message: 'No subscriptions found for user',
        sent: 0 
      }, { status: 200 });
    }

    // Send push to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const payload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          data: {
            notificationId: notification.id,
            link: notification.link,
            type: notification.type,
          },
        });

        try {
          await webpush.sendNotification(pushSubscription, payload);
          console.log(`✅ Push sent to ${sub.endpoint.substring(0, 50)}...`);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error(`❌ Push failed for ${sub.endpoint.substring(0, 50)}...`, error.message);
          
          // If subscription is invalid (410 Gone), delete it
          if (error.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            console.log(`🗑️  Deleted invalid subscription ${sub.id}`);
          }
          
          return { success: false, endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    return NextResponse.json({
      message: `Push notifications sent`,
      sent,
      failed,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Push send error:', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications', details: error.message },
      { status: 500 }
    );
  }
}
