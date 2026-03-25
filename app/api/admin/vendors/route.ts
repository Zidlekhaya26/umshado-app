import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

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
    .select('id, business_name, category, location, subscription_tier, verified, verification_status, is_published, created_at, user_id')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { vendorId, update } = await req.json() as { vendorId: string; update: Record<string, unknown> };
  if (!vendorId || !update) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const allowed = ['subscription_tier', 'is_published', 'verified', 'verification_status'];
  const safe = Object.fromEntries(Object.entries(update).filter(([k]) => allowed.includes(k)));
  const supabase = createServiceClient();
  const { error } = await supabase.from('vendors').update(safe).eq('id', vendorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
