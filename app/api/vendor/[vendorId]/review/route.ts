import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

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

async function isCoupleUser(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('has_couple')
    .eq('id', userId)
    .maybeSingle();
  return data?.has_couple === true;
}

// GET /api/vendor/[vendorId]/review?coupleId=xxx
export async function GET(req: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const url = new URL(req.url);
  const coupleId = url.searchParams.get('coupleId');
  const supabase = createServiceClient();

  // Fetch all reviews for vendor
  const { data: reviews, error } = await supabase
    .from('vendor_reviews')
    .select('id, rating, review_text, created_at, couple_id, profiles:couple_id(full_name)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If coupleId provided, find their specific review
  const myReview = coupleId ? (reviews || []).find(r => r.couple_id === coupleId) ?? null : null;

  return NextResponse.json({ reviews: reviews || [], myReview });
}

// POST — create or update a review
export async function POST(req: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only couples can leave reviews
  const isCouple = await isCoupleUser(user.id);
  if (!isCouple) {
    return NextResponse.json({ error: 'Only couples can leave vendor reviews' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('vendor_reviews')
    .upsert({
      vendor_id: vendorId,
      couple_id: user.id,
      rating: body.rating,
      review_text: body.reviewText || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vendor_id,couple_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}

// DELETE — remove own review
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only couples can delete reviews
  const isCouple = await isCoupleUser(user.id);
  if (!isCouple) {
    return NextResponse.json({ error: 'Only couples can manage vendor reviews' }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('vendor_reviews')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('couple_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
