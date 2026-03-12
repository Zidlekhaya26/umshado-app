import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseAdminClient';

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

// DELETE /api/account/delete
// Permanently deletes the authenticated user and all their data.
// Cascades via ON DELETE CASCADE to profiles, couples/vendors, and all
// related rows — no manual cleanup needed.
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = getAdminSupabase();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
