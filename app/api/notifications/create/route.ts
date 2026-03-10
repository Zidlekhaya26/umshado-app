import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyUsers } from '@/lib/server/notify';

/**
 * POST /api/notifications/create
 * 
 * Creates a notification record AND sends push notifications to the user.
 * This ensures notifications always trigger pushes (unlike manual DB inserts).
 * 
 * Body:
 * {
 *   userId: string (uuid)
 *   type: 'message' | 'quote' | 'rsvp' | 'system' | etc
 *   title: string
 *   body: string
 *   link?: string (optional, defaults to '/')
 *   meta?: object (optional, defaults to {})
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, type, title, body, link, meta } = await req.json();

    if (!userId || !type || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, body' },
        { status: 400 }
      );
    }

    // Create notification in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        link: link || '/',
        meta: meta || {},
        read: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[notifications/create] DB error:', dbError);
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
    }

    // Send push notification
    try {
      await notifyUsers([userId], title, body, link || '/', notification.id);
      console.log(`[notifications/create] ✅ Notification ${notification.id} created + push sent to ${userId}`);
    } catch (pushError: any) {
      // Don't fail the request if push fails — notification was still created
      console.error('[notifications/create] Push failed (notification was still saved):', pushError.message);
    }

    return NextResponse.json({
      success: true,
      notification,
      pushSent: true,
    });
  } catch (err: any) {
    console.error('[notifications/create] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
