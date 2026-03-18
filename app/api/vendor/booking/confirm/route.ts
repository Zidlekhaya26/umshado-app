import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { validateBody } from '@/lib/apiValidate'
import { z } from 'zod'

/**
 * POST /api/vendor/booking/confirm
 * Vendor confirms an accepted quote as a booking
 * Body: { quote_id: uuid }
 * 
 * Creates a booking record, updates quote status to 'booked',
 * and notifies the couple.
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  // Authenticate via Bearer token (service client has no user session)
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
  const authUser = await userRes.json()
  const user = authUser?.id ? authUser : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get vendor
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single()

  if (vendorErr || !vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  const { data: bodyData, error: bodyError } = await validateBody(req, z.object({ quote_id: z.string().uuid('quote_id must be a valid UUID') }))
  if (bodyError) return bodyError
  const { quote_id } = bodyData

  // Get quote details
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('*, vendor_packages(*)')
    .eq('id', quote_id)
    .eq('vendor_id', vendor.id)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (quote.status !== 'accepted') {
    return NextResponse.json(
      { error: 'Only accepted quotes can be confirmed as bookings' },
      { status: 400 }
    )
  }

  // Check if booking already exists
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, booking_ref')
    .eq('quote_id', quote_id)
    .single()

  if (existingBooking) {
    return NextResponse.json({
      message: 'Booking already exists',
      booking: existingBooking,
    })
  }

  // Create booking
  // confirmed_price stored in cents — both booking pages divide by 100 to display
  const finalPriceCents = Math.round(
    ((quote.vendor_final_price ?? quote.base_from_price ?? 0) as number) * 100
  );

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      quote_id,
      vendor_id: vendor.id,
      couple_id: quote.couple_id,
      package_name: quote.package_name || quote.vendor_packages?.name || 'Custom Package',
      event_date: (quote as any).event_date ?? null,
      event_location: (quote as any).event_location ?? null,
      confirmed_price: finalPriceCents,
      status: 'confirmed',
    })
    .select()
    .single()

  if (bookingErr || !booking) {
    console.error(JSON.stringify({ route: 'vendor/booking/confirm', event: 'booking_insert_error', vendorId: vendor.id, quoteId: quote_id, err: bookingErr?.message }))
    return NextResponse.json({ error: bookingErr?.message || 'Failed to create booking' }, { status: 500 })
  }

  // Update quote status to 'booked'
  const { error: updateErr } = await supabase
    .from('quotes')
    .update({ status: 'booked' })
    .eq('id', quote_id)

  if (updateErr) {
    console.error(JSON.stringify({ route: 'vendor/booking/confirm', event: 'quote_update_error', quoteId: quote_id, err: updateErr.message }))
  }

  // Send notification to couple
  const { notifyUsers } = await import('@/lib/server/notify')
  await notifyUsers({
    userIds: [quote.couple_id],
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    body: `${vendor.business_name} has confirmed your booking (Ref: ${booking.booking_ref}).`,
    link: `/couple/bookings`,
    meta: { bookingId: booking.id, bookingRef: booking.booking_ref },
  })

  console.log(JSON.stringify({ route: 'vendor/booking/confirm', event: 'booking_confirmed', vendorId: vendor.id, quoteId: quote_id, bookingId: booking.id, coupleId: quote.couple_id }))
  return NextResponse.json({
    success: true,
    booking,
  })
}
