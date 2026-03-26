import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

// Temporary test route — DELETE after confirming Sentry works
export async function GET() {
  try {
    throw new Error('uMshado Sentry test error — safe to ignore');
  } catch (err) {
    Sentry.captureException(err);
    // Flush ensures the event is sent before Vercel closes the serverless function
    await Sentry.flush(2000);
  }

  return NextResponse.json({ ok: true, message: 'Test error sent to Sentry — check your Issues tab' });
}
