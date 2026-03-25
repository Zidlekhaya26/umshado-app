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
    .from('community_posts')
    .select('id, user_id, author, category, content, likes_count, comments_count, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const admin = await assertAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { postId } = await req.json() as { postId: string };
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
