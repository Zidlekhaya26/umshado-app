import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

async function assertAdmin(req: NextRequest) {
  const supabase = createServiceClient();
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  if (!token) return false;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  return !!profile?.is_admin;
}

export async function GET(req: NextRequest) {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const [
    { count: totalVendors },
    { count: pendingVerifications },
    { count: totalCouples },
    { count: totalPosts },
    { count: proVendors },
    { count: publishedVendors },
  ] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('verification_status', 'paid_pending_review'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('has_couple', true),
    supabase.from('community_posts').select('*', { count: 'exact', head: true }),
    supabase.from('vendors').select('*', { count: 'exact', head: true }).in('subscription_tier', ['pro', 'trial']),
    supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_published', true),
  ]);

  return NextResponse.json({
    totalVendors: totalVendors ?? 0,
    pendingVerifications: pendingVerifications ?? 0,
    totalCouples: totalCouples ?? 0,
    totalPosts: totalPosts ?? 0,
    proVendors: proVendors ?? 0,
    publishedVendors: publishedVendors ?? 0,
  });
}
