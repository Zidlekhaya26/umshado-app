import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody } from '@/lib/apiValidate'
import { createServiceClient } from '@/lib/supabaseServer'

const BlockDateSchema = z.object({
  blocked_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'blocked_date must be YYYY-MM-DD'),
  reason: z.enum(['booked', 'unavailable', 'holiday']).optional(),
  note: z.string().max(500).optional().nullable(),
})

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  })
  if (!res.ok) return null
  const user = await res.json()
  return user?.id ? user : null
}

/**
 * GET /api/vendor/availability?vendor_id=...
 * Public endpoint: returns array of blocked dates for a vendor
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vendor_id = searchParams.get('vendor_id')

  if (!vendor_id) {
    return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('vendor_availability')
    .select('blocked_date, reason, note')
    .eq('vendor_id', vendor_id)
    .order('blocked_date', { ascending: true })

  if (error) {
    console.error('[GET /api/vendor/availability] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ blocked_dates: data || [] })
}

/**
 * POST /api/vendor/availability
 * Vendor adds a blocked date
 * Body: { blocked_date: 'YYYY-MM-DD', reason: 'booked'|'unavailable'|'holiday', note?: string }
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get vendor_id from auth user
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (vendorErr || !vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const { data: body, error: bodyError } = await validateBody(req, BlockDateSchema)
  if (bodyError) return bodyError
  const { blocked_date, reason, note } = body

  const { data, error } = await supabase
    .from('vendor_availability')
    .upsert(
      {
        vendor_id: vendor.id,
        blocked_date,
        reason: reason || 'unavailable',
        note,
      },
      { onConflict: 'vendor_id,blocked_date' }
    )
    .select()
    .single()

  if (error) {
    console.error(JSON.stringify({ route: 'vendor/availability', event: 'upsert_error', vendorId: vendor.id, blocked_date, err: error.message }))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(JSON.stringify({ route: 'vendor/availability', event: 'date_blocked', vendorId: vendor.id, blocked_date, reason: reason || 'unavailable' }))
  return NextResponse.json({ success: true, data })
}

/**
 * DELETE /api/vendor/availability?blocked_date=YYYY-MM-DD
 * Vendor removes a blocked date
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const blocked_date = searchParams.get('blocked_date')

  if (!blocked_date) {
    return NextResponse.json({ error: 'blocked_date required' }, { status: 400 })
  }

  // Get vendor_id
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (vendorErr || !vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('vendor_availability')
    .delete()
    .eq('vendor_id', vendor.id)
    .eq('blocked_date', blocked_date)

  if (error) {
    console.error(JSON.stringify({ route: 'vendor/availability', event: 'delete_error', vendorId: vendor.id, blocked_date, err: error.message }))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(JSON.stringify({ route: 'vendor/availability', event: 'date_unblocked', vendorId: vendor.id, blocked_date }))
  return NextResponse.json({ success: true })
}
