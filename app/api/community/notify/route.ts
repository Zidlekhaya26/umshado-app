import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';
import { validateBody } from '@/lib/apiValidate';
import { z } from 'zod';

const Schema = z.object({
  type: z.enum(['post_liked', 'post_commented', 'comment_replied']),
  postId: z.string().uuid(),
  // For replies: the parent comment author's user_id
  parentCommentUserId: z.string().uuid().optional(),
  // For comments/replies: a short preview of the comment
  commentPreview: z.string().max(120).optional(),
});

/**
 * POST /api/community/notify
 * Called from the client after a community like/comment/reply action.
 * Notifies the post owner (and parent comment author for replies).
 * Never notifies the actor themselves.
 */
export async function POST(req: NextRequest) {
  // Authenticate via Bearer token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authUser = await userRes.json();
  const actorId: string | undefined = authUser?.id;
  if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: bodyError } = await validateBody(req, Schema);
  if (bodyError) return bodyError;

  const { type, postId, parentCommentUserId, commentPreview } = body;
  const supabase = createServiceClient();

  // Fetch the post to find its owner and author name
  const { data: post } = await supabase
    .from('community_posts')
    .select('user_id, author, content')
    .eq('id', postId)
    .maybeSingle();

  if (!post) return NextResponse.json({ ok: true }); // post deleted or not found — silent

  const postOwnerId: string = post.user_id;
  const postAuthor: string = post.author || 'you';

  // Resolve actor's display name
  let actorName = 'Someone';
  const [profileRes, coupleRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', actorId).maybeSingle(),
    supabase.from('couples').select('partner_name').eq('id', actorId).maybeSingle(),
  ]);
  actorName = coupleRes.data?.partner_name || profileRes.data?.full_name || 'Someone';

  const link = `/live?tab=community`;

  try {
    if (type === 'post_liked') {
      // Don't notify if the owner liked their own post
      if (postOwnerId === actorId) return NextResponse.json({ ok: true });

      // Throttle: only send 1 like notification per post per 10 minutes for this actor
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', postOwnerId)
        .eq('type', 'post_liked')
        .contains('meta', { post_id: postId, actor_id: actorId })
        .gte('created_at', tenMinutesAgo)
        .limit(1)
        .maybeSingle();

      if (!recent) {
        await notifyUsers({
          userIds: [postOwnerId],
          type: 'post_liked',
          title: `${actorName} liked your post`,
          body: post.content.length > 80 ? post.content.slice(0, 77) + '…' : post.content,
          link,
          meta: { post_id: postId, actor_id: actorId },
        });
      }
    } else if (type === 'post_commented') {
      // Don't notify if the owner commented on their own post
      if (postOwnerId === actorId) return NextResponse.json({ ok: true });

      await notifyUsers({
        userIds: [postOwnerId],
        type: 'post_commented',
        title: `${actorName} commented on your post`,
        body: commentPreview || 'Someone left a comment on your post.',
        link,
        meta: { post_id: postId, actor_id: actorId },
      });
    } else if (type === 'comment_replied') {
      // Notify the post owner (if not the actor) AND the parent comment author (if different)
      const recipients = new Set<string>();

      if (postOwnerId !== actorId) recipients.add(postOwnerId);
      if (parentCommentUserId && parentCommentUserId !== actorId) recipients.add(parentCommentUserId);

      if (recipients.size > 0) {
        await notifyUsers({
          userIds: [...recipients],
          type: 'comment_replied',
          title: `${actorName} replied to a comment`,
          body: commentPreview || 'Someone replied in a thread you\'re part of.',
          link,
          meta: { post_id: postId, actor_id: actorId },
        });
      }
    }
  } catch (err: any) {
    // Non-fatal — don't block the UX action
    console.error('[community/notify]', err?.message);
  }

  return NextResponse.json({ ok: true });
}
