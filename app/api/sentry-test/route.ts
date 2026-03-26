import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Temporary test route — DELETE after confirming Sentry works
export async function GET() {
  Sentry.captureMessage('uMshado Sentry connection test', {
    level: 'info',
    extra: { source: 'manual-test', app: 'umshado' },
  });

  return NextResponse.json({ ok: true, message: 'Test event sent to Sentry' });
}
