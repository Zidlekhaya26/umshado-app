import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

async function getCallerEmail(req: NextRequest): Promise<string | null> {
  let token: string | null = null;
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  if (!token) {
    const cookieNames = ['sb-access-token', 'sb:token', 'supabase-auth-token'];
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
    if (!res.ok) return null;
    const user = await res.json();
    return user?.email?.toLowerCase() ?? null;
  } catch { return null; }
}

function isAdmin(email: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

async function supabaseAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.method === 'PATCH' ? 'return=representation' : 'return=minimal',
      ...(options.headers || {}),
    },
  });
}

// GET — list all verification requests with vendor info
export async function GET(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!isAdmin(email)) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const res = await supabaseAdmin(
      'verification_requests?select=id,vendor_id,status,paid_at,created_at,updated_at,admin_notes,payfast_payment_id&order=created_at.desc'
    );
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    const requests = await res.json();

    // Enrich with vendor business_name
    const enriched = await Promise.all(
      requests.map(async (r: Record<string, unknown>) => {
        const vRes = await supabaseAdmin(
          `vendors?id=eq.${r.vendor_id}&select=business_name,category,city,verified,verification_status`
        );
        const vendors = vRes.ok ? await vRes.json() : [];
        return { ...r, vendor: vendors[0] || null };
      })
    );

    return NextResponse.json({ requests: enriched });
  } catch (err) {
    console.error('admin/verifications GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — approve or reject a verification request
export async function POST(req: NextRequest) {
  const callerEmail = await getCallerEmail(req);
  if (!isAdmin(callerEmail)) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { action, id, admin_notes } = body as {
    action: 'approve' | 'reject';
    id: string;
    admin_notes?: string;
  };

  if (!action || !id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action or missing id' }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Get the verification request to find vendor_id
    const vrRes = await supabaseAdmin(`verification_requests?id=eq.${id}&select=vendor_id,user_id`);
    if (!vrRes.ok) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    const vrs = await vrRes.json();
    const vr = vrs[0];
    if (!vr) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update verification_request
    await supabaseAdmin(`verification_requests?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: newStatus,
        admin_notes: admin_notes || null,
        reviewed_at: now,
        updated_at: now,
      }),
    });

    // Update vendor
    await supabaseAdmin(`vendors?id=eq.${vr.vendor_id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        verified: action === 'approve',
        verification_status: newStatus,
        updated_at: now,
      }),
    });

    // Notify vendor via in-app notification
    try {
      await supabaseAdmin('notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_id: vr.user_id,
          type: action === 'approve' ? 'verification_approved' : 'verification_rejected',
          title: action === 'approve'
            ? '✅ Your business is now Verified!'
            : '❌ Verification request not approved',
          body: action === 'approve'
            ? 'Congratulations! uMshado has verified your business. Your Verified badge is now live.'
            : `Your verification was not approved. ${admin_notes ? `Reason: ${admin_notes}` : 'Please contact support for more info.'}`,
          link: '/vendor/billing',
          meta: { verification_request_id: id },
          created_at: now,
        }),
      });
    } catch (notifyErr) {
      console.error('Failed to notify vendor:', notifyErr);
    }

    return NextResponse.json({ success: true, action, vendor_id: vr.vendor_id });
  } catch (err) {
    console.error('admin/verifications POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
