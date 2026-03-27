import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'

/**
 * POST /api/vendor/couple-names
 * Returns couple + profile data for an array of couple IDs.
 * Uses service client so vendor RLS restrictions don't block the lookup.
 * Body: { coupleIds: string[] }
 */
export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  })
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const coupleIds: string[] = body?.coupleIds ?? []
  if (!coupleIds.length) {
    return NextResponse.json({ couples: [], profiles: [] })
  }

  const supabase = createServiceClient()
  const [{ data: couples }, { data: profiles }] = await Promise.all([
    supabase.from('couples').select('id,partner_name,avatar_url').in('id', coupleIds),
    supabase.from('profiles').select('id,full_name').in('id', coupleIds),
  ])

  return NextResponse.json({ couples: couples ?? [], profiles: profiles ?? [] })
}
