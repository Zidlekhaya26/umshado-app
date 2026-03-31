import { NextRequest, NextResponse } from 'next/server';
import { getCallerUser } from '@/lib/server/getCallerUser';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * GET /api/admin/is-admin
 * Returns { isAdmin: true/false } for the authenticated caller.
 * Used by the admin page to avoid exposing admin emails in the client bundle.
 */
export async function GET(req: NextRequest) {
  const caller = await getCallerUser(req);
  if (!caller) return NextResponse.json({ isAdmin: false });
  const isAdmin = ADMIN_EMAILS.includes(caller.email ?? '');
  return NextResponse.json({ isAdmin });
}
