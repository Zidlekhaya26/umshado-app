import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/messages/mark-read
 *
 * Marks all messages in a conversation as read for the current user.
 * Uses service role to bypass RLS — the caller's auth token is verified
 * to confirm they are a participant in the conversation before writing.
 *
 * Body: { conversationId: string }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Validate caller's token and get their user id
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }
  const { id: userId } = await userRes.json();

  const body = await req.json().catch(() => null);
  const { conversationId } = body || {};
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  const db = createServiceClient();

  // Verify caller is a participant (couple or vendor user) in this conversation
  const { data: conv } = await db
    .from('conversations')
    .select('id, couple_id, vendor_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Resolve vendor user_id from vendor row if needed
  let isParticipant = conv.couple_id === userId;
  if (!isParticipant) {
    const { data: vendor } = await db
      .from('vendors')
      .select('user_id')
      .eq('id', conv.vendor_id)
      .maybeSingle();
    isParticipant = vendor?.user_id === userId;
  }

  if (!isParticipant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();

  // Run both updates in parallel using service role (bypasses RLS)
  await Promise.all([
    db.from('conversations')
      .update({ last_read_at: now })
      .eq('id', conversationId),
    db.from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false),
  ]);

  return NextResponse.json({ success: true });
}
