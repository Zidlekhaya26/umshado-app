import { NextRequest, NextResponse } from 'next/server';
import { notifyUsers } from '@/lib/server/notify';

/**
 * POST /api/notifications/create
 * 
 * Creates a notification record AND sends push notifications to the user.
 * This ensures notifications always trigger pushes (unlike manual DB inserts).
 * 
 * Body:
 * {
 *   userId: string (uuid) or userIds: string[] (array of uuids)
 *   type: 'message' | 'quote' | 'rsvp' | 'system' | etc
 *   title: string
 *   body: string
 *   link?: string (optional, defaults to '/')
 *   meta?: object (optional, defaults to {})
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, userIds, type, title, body, link, meta } = await req.json();

    // Accept either userId (string) or userIds (array)
    const ids = userIds || (userId ? [userId] : []);

    if (!ids.length || !type || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: userId/userIds, type, title, body' },
        { status: 400 }
      );
    }

    // notifyUsers handles both DB insert AND push notification
    await notifyUsers({
      userIds: ids,
      type,
      title,
      body,
      link: link || '/',
      meta: meta || {},
    });

    console.log(`[notifications/create] ✅ Notification created + push sent to ${ids.length} user(s)`);

    return NextResponse.json({
      success: true,
      userIds: ids,
      pushSent: true,
    });
  } catch (err: any) {
    console.error('[notifications/create] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
