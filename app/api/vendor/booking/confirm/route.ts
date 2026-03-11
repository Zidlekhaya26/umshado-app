import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'

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
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const body = await req.json()
  const { quote_id } = body

  if (!quote_id) {
    return NextResponse.json({ error: 'quote_id required' }, { status: 400 })
  }

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
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      quote_id,
      vendor_id: vendor.id,
      couple_id: quote.couple_id,
      package_name: quote.vendor_packages?.name || 'Custom Package',
      event_date: quote.event_date,
      event_location: quote.event_location,
      confirmed_price: quote.agreed_price || quote.quoted_price,
      status: 'confirmed',
    })
    .select()
    .single()

  if (bookingErr || !booking) {
    console.error('[POST /api/vendor/booking/confirm] booking insert error:', bookingErr)
    return NextResponse.json({ error: bookingErr?.message || 'Failed to create booking' }, { status: 500 })
  }

  // Update quote status to 'booked'
  const { error: updateErr } = await supabase
    .from('quotes')
    .update({ status: 'booked' })
    .eq('id', quote_id)

  if (updateErr) {
    console.error('[POST /api/vendor/booking/confirm] quote update error:', updateErr)
  }

  // Send notification to couple
  await supabase.from('notifications').insert({
    user_id: quote.couple_id,
    type: 'booking_confirmed',
    title: 'Booking Confirmed! 🎉',
    message: `${vendor.business_name} has confirmed your booking (Ref: ${booking.booking_ref}).`,
    link: `/couple/bookings/${booking.id}`,
    read: false,
  })

  return NextResponse.json({
    success: true,
    booking,
  })
}
