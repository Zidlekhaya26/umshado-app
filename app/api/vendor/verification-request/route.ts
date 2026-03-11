import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

async function getVendorId(userId: string) {
  const supabase = createServiceClient();
  const { data: v1 } = await supabase.from('vendors').select('id').eq('user_id', userId).maybeSingle();
  if (v1) return v1.id;
  const { data: v2 } = await supabase.from('vendors').select('id').eq('id', userId).maybeSingle();
  return v2?.id ?? null;
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

// GET — fetch vendor's own verification request status
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vendorId = await getVendorId(user.id);
  if (!vendorId) return NextResponse.json({ request: null });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('verification_requests')
    .select('id, status, notes, admin_notes, created_at, updated_at')
    .eq('vendor_id', vendorId)
    .maybeSingle();

  return NextResponse.json({ request: data ?? null });
}

// POST — submit a verification request
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vendorId = await getVendorId(user.id);
  if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  // Upsert: allows re-submit if previously rejected
  const { data, error } = await supabase
    .from('verification_requests')
    .upsert({
      vendor_id: vendorId,
      status: 'pending',
      notes: body.notes || null,
      admin_notes: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vendor_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
