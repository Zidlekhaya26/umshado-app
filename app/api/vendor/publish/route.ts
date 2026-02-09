import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

/**
 * POST /api/vendor/publish
 *
 * Sets is_published = true for the vendor and notifies them.
 *
 * Body: { vendorId: string }
 */
export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const authUser = await userRes.json();
  const userId = authUser?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // --- Body ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { vendorId } = body;
  if (!vendorId) {
    return NextResponse.json({ error: 'Missing vendorId' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    // Verify this vendor belongs to the user (check both id and user_id columns)
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('id, user_id, business_name')
      .eq('id', vendorId)
      .single();

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Vendor row may use vendor.id === userId or vendor.user_id === userId
    const ownerUserId = vendor.user_id || vendor.id;
    if (ownerUserId !== userId && vendor.id !== userId) {
      return NextResponse.json({ error: 'Not your vendor profile' }, { status: 403 });
    }

    // Publish
    const { error: updateErr } = await supabase
      .from('vendors')
      .update({ is_published: true })
      .eq('id', vendorId);

    if (updateErr) {
      console.error('[vendor/publish] update error:', updateErr);
      return NextResponse.json({ error: 'Failed to publish' }, { status: 500 });
    }

    // Notify vendor
    await notifyUsers({
      userIds: [userId],
      type: 'vendor_published',
      title: 'Profile published! 🎉',
      body: `${vendor.business_name || 'Your profile'} is now live on the marketplace.`,
      link: '/vendor/dashboard',
      meta: { vendorId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[vendor/publish] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
