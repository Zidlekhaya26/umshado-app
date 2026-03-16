import { NextRequest, NextResponse } from 'next/server';
import { notifyUsers } from '@/lib/server/notify';
import { validateBody } from '@/lib/apiValidate';
import { z } from 'zod';

const NotifySchema = z.object({
  userId: z.string().uuid().optional(),
  userIds: z.array(z.string().uuid()).max(100).optional(),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  link: z.string().max(500).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/notifications/create
 * Internal endpoint — requires CRON_SECRET bearer token.
 *
 * Body:
 * {
 *   userId: string (uuid) or userIds: string[] (array of uuids, max 100)
 *   type: string
 *   title: string
 *   body: string
 *   link?: string
 *   meta?: object
 * }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error: bodyError } = await validateBody(req, NotifySchema);
  if (bodyError) return bodyError;

  const { userId, userIds, type, title, body, link, meta } = data;
  const ids = userIds || (userId ? [userId] : []);

  if (!ids.length) {
    return NextResponse.json({ error: 'userId or userIds required' }, { status: 400 });
  }

  try {
    await notifyUsers({
      userIds: ids,
      type,
      title,
      body,
      link: link || '/',
      meta: meta || {},
    });

    console.log(`[notifications/create] ✅ Notification sent to ${ids.length} user(s)`);

    return NextResponse.json({ success: true, userIds: ids, pushSent: true });
  } catch (err: any) {
    console.error('[notifications/create] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
