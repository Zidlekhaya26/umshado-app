import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * GET /api/invite/validate?token=<uuid>
 * Validates an invite token and returns its status.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 400 });
  }

  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ valid: false, error: 'Invalid token format' }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ valid: false, error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/beta_requests?select=id,email,name,role_interest,status&invite_token=eq.${token}&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: 'Failed to validate' }, { status: 500 });
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invite not found' }, { status: 404 });
    }

    const invite = data[0];

    if (invite.status === 'redeemed') {
      return NextResponse.json({
        valid: false,
        error: 'This invite has already been used',
        status: 'redeemed',
      }, { status: 410 });
    }

    if (invite.status !== 'approved') {
      return NextResponse.json({
        valid: false,
        error: 'This invite has not been approved yet',
        status: invite.status,
      }, { status: 403 });
    }

    // Valid invite!
    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        name: invite.name,
        role: invite.role_interest,
      },
    });
  } catch (err) {
    console.error('Invite validation error:', err);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/invite/validate
 * Marks an invite token as redeemed after successful sign-up.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token;

  if (!token) {
    return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/beta_requests?invite_token=eq.${token}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: 'redeemed' }),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to redeem invite' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Invite redeem error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
