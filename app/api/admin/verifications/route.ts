import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

async function assertAdmin(req: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  return profile?.is_admin ? user : null;
}

export async function GET(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('vendors')
    .select('id, business_name, category, location, about, contact, verification_status, verification_paid_at, created_at, is_published, subscription_tier, user_id')
    .eq('verification_status', 'paid_pending_review')
    .order('verification_paid_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { vendorId, action } = await req.json() as { vendorId: string; action: 'approve' | 'reject' };
  if (!vendorId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const update = action === 'approve'
    ? { verified: true, verification_status: 'approved' }
    : { verified: false, verification_status: 'rejected' };

  // Fetch vendor details before updating so we have user_id + business_name
  const { data: vendor } = await supabase
    .from('vendors')
    .select('user_id, business_name')
    .eq('id', vendorId)
    .maybeSingle();

  const { error } = await supabase.from('vendors').update(update).eq('id', vendorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the vendor
  if (vendor?.user_id) {
    const name = vendor.business_name || 'Your profile';
    if (action === 'approve') {
      await notifyUsers({
        userIds: [vendor.user_id],
        type: 'verification_approved',
        title: '✅ Verification approved!',
        body: `${name} has been verified on uMshado. Your blue badge is now live and you'll appear higher in search results.`,
        link: '/vendor/dashboard',
        meta: { vendorId },
      });
    } else {
      await notifyUsers({
        userIds: [vendor.user_id],
        type: 'verification_rejected',
        title: 'Verification update',
        body: `Your verification request for ${name} could not be approved at this time. Please contact support for more information.`,
        link: '/vendor/billing',
        meta: { vendorId },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
