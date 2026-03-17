import autoAssign from '../../../../server/utils/autoAssign';
import { SeatingPayloadSchema } from '../../../../server/schemas/seatingSchema';

export async function persistAssignment(supabaseClient: any, payload: any) {
  // attempt to persist into 'seatings' table; callers may mock this in tests
  try {
    const resp = await supabaseClient.from('seatings').insert({ payload, created_at: new Date() });
    return resp;
  } catch (err) {
    return { error: String(err) };
  }
}

export async function handleAutoAssignPayload(body: any, opts?: { save?: boolean; supabaseClient?: any }) {
  const parse = SeatingPayloadSchema.safeParse(body);
  if (!parse.success) {
    return { error: parse.error.format(), status: 400 };
  }
  try {
    const { guests, tables } = parse.data;
    const assigned = autoAssign(guests, tables);
    if (opts?.save) {
      const client = opts.supabaseClient;
      if (client) {
        // await persistence and return its result in `saved`
        const saved = await persistAssignment(client, { guests, tables: assigned });
        return { tables: assigned, status: 200, saved };
      }
    }
    return { tables: assigned, status: 200 };
  } catch (err) {
    return { error: String(err), status: 500 };
  }
}

export async function POST(req: any) {
  const { NextResponse } = await import('next/server');

  // --- Auth: require authenticated user via Bearer token ---
  const authHeader = (req as any).headers?.get
    ? (req as any).headers.get('authorization')
    : (req as any).headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authedUser = await userRes.json();
  if (!authedUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const shouldSave = body.save === true;

  // Validate payload and compute assignment
  const out = await handleAutoAssignPayload(body, shouldSave ? { save: false } : undefined);
  if (out.status && out.status !== 200) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  // Persist only when caller explicitly requests it
  let savedId: string | null = null;
  if (shouldSave) {
    try {
      const { getAdminSupabase } = await import('../../../../lib/supabaseAdminClient');
      const admin = getAdminSupabase();
      const resp = await persistAssignment(admin, { guests: body.guests, tables: out.tables });
      if (resp && resp.data && Array.isArray(resp.data) && resp.data[0] && resp.data[0].id) {
        savedId = resp.data[0].id;
      }
    } catch (_) {
      // ignore persistence errors so API remains usable
    }
  }

  return NextResponse.json({ tables: out.tables, savedId });
}
