import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isDevOnly } from '@/lib/devOnly';

/**
 * GET /api/push/test?userId=<uuid>
 *
 * Diagnostic endpoint — tests the full push pipeline for a user.
 * Returns detailed info at each step so you can pinpoint the failure.
 *
 * Gated to development only via lib/devOnly.ts.
 */
export async function GET(req: NextRequest) {
  if (!isDevOnly) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'MISSING ❌',
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY
        ? `SET (${process.env.VAPID_PRIVATE_KEY.slice(0, 8)}...)`
        : 'MISSING ❌',
      VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'MISSING ❌',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET ✅' : 'MISSING ❌',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING ❌',
    },
  };

  if (!userId) {
    return NextResponse.json({ ...diag, error: 'Pass ?userId=<uuid> to test push for a specific user' });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check subscriptions in DB
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, created_at')
      .eq('user_id', userId);

    diag.subscriptions = {
      count: subs?.length ?? 0,
      error: subErr?.message,
      items: subs?.map((s: any) => ({
        id: s.id,
        endpoint: s.endpoint.slice(0, 60) + '...',
        p256dh_len: s.p256dh?.length,
        auth_len: s.auth?.length,
        created_at: s.created_at,
      })),
    };

    if (!subs || subs.length === 0) {
      return NextResponse.json({
        ...diag,
        verdict: 'NO SUBSCRIPTIONS — user has not enabled push or keys were not saved correctly',
      });
    }

    // Try sending a test push
    try {
      const webpush = (await import('web-push')).default;
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@umshado.co.za',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );

      const testPayload = JSON.stringify({
        title: '🔔 uMshado Test',
        body: 'Push notifications are working!',
        icon: '/logo-icon.png',
        tag: 'test',
        data: { link: '/', type: 'test' },
      });

      const results = await Promise.allSettled(
        subs.map(async (sub: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              testPayload
            );
            return { id: sub.id, ok: true };
          } catch (err: any) {
            return { id: sub.id, ok: false, status: err.statusCode, message: err.message };
          }
        })
      );

      diag.pushResults = results.map((r) => r.status === 'fulfilled' ? r.value : { ok: false, error: (r as any).reason?.message });
      diag.verdict = diag.pushResults.every((r: any) => r.ok)
        ? 'SUCCESS ✅ — check your browser for the notification'
        : 'PARTIAL/FAIL ❌ — see pushResults for details';
    } catch (err: any) {
      diag.pushError = err.message;
      diag.verdict = 'web-push import failed — is the package installed?';
    }

    return NextResponse.json(diag);
  } catch (err: any) {
    return NextResponse.json({ ...diag, fatalError: err.message }, { status: 500 });
  }
}
