import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Parses and validates request JSON against a Zod schema.
 * Returns { data } on success or { error: NextResponse } on failure.
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { data: null, error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  return { data: result.data, error: null };
}
