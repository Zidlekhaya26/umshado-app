import { NextRequest, NextResponse } from 'next/server';
import { notifyUsers } from '@/lib/server/notify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// ─── helpers ─────────────────────────────────────────────

/**
 * Resolve the authenticated user's email from the request.
 * Reads the access token from:
 *   1. Authorization: Bearer <token> header (sent by the client page)
 *   2. Fallback: common Supabase cookie names
 */
async function getCallerEmail(req: NextRequest): Promise<string | null> {
  let token: string | null = null;

  // 1. Authorization header (preferred — client sends this)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Fallback: try common cookie names
  if (!token) {
    const cookieNames = ['sb-access-token', 'sb:token', 'supabase-auth-token', 'sb-session'];
    for (const name of cookieNames) {
      const c = req.cookies.get(name);
      if (c?.value) { token = c.value; break; }
    }
  }

  if (!token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
    });
    if (!res.ok) {
      return null;
    }
    const user = await res.json();
    return user?.email?.toLowerCase() ?? null;
  } catch (err) {
    return null;
  }
}

function isAdmin(email: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Supabase REST helper using service-role key (bypasses RLS). */
async function supabaseAdmin(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: (options.method === 'PATCH' || options.method === 'POST')
        ? 'return=representation'
        : 'return=minimal',
      ...(options.headers || {}),
    },
  });
}

// ─── GET — list all beta requests ────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const email = await getCallerEmail(req);
  if (!isAdmin(email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Server misconfigured — SUPABASE_SERVICE_ROLE_KEY is missing.' },
      { status: 500 },
    );
  }

  try {
    // Fetch all beta_requests (service role bypasses RLS)
    const res = await supabaseAdmin(
      'beta_requests?select=id,name,email,role_interest,status,invite_token,created_at&order=created_at.desc',
    );
    if (!res.ok) {
      const text = await res.text();
      // Detect missing columns (e.g. if 004 migration wasn't run)
      if (text.includes('invite_token') || text.includes('status')) {
        return NextResponse.json({
          error:
            'Database schema mismatch — the invite_token or status column is missing. ' +
            'Please run migration 004_invite_tokens.sql in your Supabase SQL editor.',
          schemaError: true,
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to fetch beta requests' }, { status: 500 });
    }

    const requests: any[] = await res.json();

    // Build a set of registered emails for the "Already registered?" badge
    // Fetch auth users with service role
    let registeredEmails: Set<string> = new Set();
    try {
      // Paginate through all auth users (50 per page is default)
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const usersRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=100`,
          {
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (!usersRes.ok) break;
        const body = await usersRes.json();
        const users: { email?: string }[] = body?.users ?? [];
        for (const u of users) {
          if (u.email) registeredEmails.add(u.email.toLowerCase());
        }
        // If we got fewer than per_page, we're done
        if (users.length < 100) hasMore = false;
        else page++;
        // Safety cap
        if (page > 20) break;
      }
    } catch {
      // If we can't fetch auth users, just skip the registered check
    }

    // Enrich each request with a `registered` boolean
    const enriched = requests.map(r => ({
      ...r,
      registered: registeredEmails.has(r.email?.toLowerCase()),
    }));

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    console.error('Admin beta-requests GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ─── POST — approve / revoke / pending / redeem ─────────

export async function POST(req: NextRequest) {
  const callerEmail = await getCallerEmail(req);
  if (!isAdmin(callerEmail)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, id } = body as { action?: string; id?: string };

  if (!action || !id) {
    return NextResponse.json(
      { error: 'Missing required fields: action, id' },
      { status: 400 },
    );
  }

  const validActions = ['approve', 'revoke', 'pending', 'redeem'];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
      { status: 400 },
    );
  }

  const statusMap: Record<string, string> = {
    approve: 'approved',
    revoke: 'revoked',
    pending: 'pending',
    redeem: 'redeemed',
  };

  try {
    const res = await supabaseAdmin(
      `beta_requests?id=eq.${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: statusMap[action] }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Failed to update: ${text}` },
        { status: 500 },
      );
    }

    const updated = await res.json();
    
    // If approved, send in-app notification to the user (if they have an auth account)
    if (action === 'approve') {
      try {
        // Look up the beta request's email to find their auth user_id
        const betaReq = Array.isArray(updated) ? updated[0] : updated;
        const email = betaReq?.email?.toLowerCase();
        if (email) {
          // Check if user exists in auth
          const usersRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`,
            {
              headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              },
            },
          );
          if (usersRes.ok) {
            // Search for user by email using the admin API
            const searchRes = await fetch(
              `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`,
              {
                headers: {
                  apikey: SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                },
              },
            );
            if (searchRes.ok) {
              const searchBody = await searchRes.json();
              const matchedUser = (searchBody?.users ?? []).find(
                (u: any) => u.email?.toLowerCase() === email,
              );
              if (matchedUser?.id) {
                await notifyUsers({
                  userIds: [matchedUser.id],
                  type: 'invite_approved',
                  title: 'Welcome to uMshado! 🎉',
                  body: 'Your beta access has been approved. Start exploring!',
                  link: '/',
                  meta: { betaRequestId: id },
                });
              }
            }
          }
        }
      } catch (notifyErr) {
        // Non-critical — don't fail the approval
        console.error('Failed to send invite_approved notification:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      updated: Array.isArray(updated) ? updated[0] : updated,
    });
  } catch (err) {
    console.error('Admin beta-requests POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
