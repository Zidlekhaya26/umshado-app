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
  const body = await req.json();
  const out = await handleAutoAssignPayload(body);
  const { NextResponse } = await import('next/server');
  if (out.status && out.status !== 200) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  let savedId: string | null = null;
  // attempt to persist and include DB response id in the API response when possible
  try {
    // Prefer service-role admin client when available
    try {
      const { getAdminSupabase } = await import('../../../../lib/supabaseAdminClient');
      const admin = getAdminSupabase();
      const resp = await persistAssignment(admin, { guests: body.guests, tables: out.tables });
      if (resp && resp.data && Array.isArray(resp.data) && resp.data[0] && resp.data[0].id) {
        savedId = resp.data[0].id;
      }
    } catch (e) {
      // fallback to public client if admin not configured
      const { supabase } = await import('../../../../lib/supabaseClient');
      const resp = await persistAssignment(supabase, { guests: body.guests, tables: out.tables });
      if (resp && resp.data && Array.isArray(resp.data) && resp.data[0] && resp.data[0].id) {
        savedId = resp.data[0].id;
      }
    }
  } catch (_) {
    // ignore persistence errors so API remains usable
  }

  return NextResponse.json({ tables: out.tables, savedId });
}
