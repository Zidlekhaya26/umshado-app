import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { validateBody } from '@/lib/apiValidate'
import { z } from 'zod'

/**
 * POST /api/vendor/review-request
 * Vendor sends a WhatsApp review request to a couple after event completion
 * Body: { booking_id: uuid }
 * 
 * Returns: { success: true, whatsapp_url: string }
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

  const { data: bodyData, error: bodyError } = await validateBody(req, z.object({
    booking_id: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
  }))
  if (bodyError) return bodyError
  const booking_id = bodyData.booking_id || bodyData.bookingId
  if (!booking_id) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })

  // Get booking + couple details
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*, profiles!bookings_couple_id_fkey(id, phone, full_name)')
    .eq('id', booking_id)
    .eq('vendor_id', vendor.id)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const couple = booking.profiles

  // Check if review request already sent
  const { data: existingRequest } = await supabase
    .from('review_requests')
    .select('id')
    .eq('booking_id', booking_id)
    .eq('vendor_id', vendor.id)
    .single()

  if (!existingRequest) {
    // Create review_request record
    await supabase.from('review_requests').insert({
      booking_id,
      vendor_id: vendor.id,
      couple_id: booking.couple_id,
      channel: 'whatsapp',
    })

    // Send in-app notification
    await supabase.from('notifications').insert({
      user_id: booking.couple_id,
      type: 'review_request',
      title: 'How was your experience?',
      message: `${vendor.business_name} would love your feedback!`,
      link: `/v/${vendor.id}?review=true`,
      read: false,
    })
  }

  // Generate WhatsApp deep-link
  const vendorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://umshado.app'}/v/${vendor.id}?review=true`
  const message = `Hi ${couple?.full_name || 'there'}! 👋\n\nThank you for choosing ${vendor.business_name} for your special day! We hope everything went perfectly.\n\nWe'd love to hear your feedback. Could you take a moment to leave us a review?\n\n${vendorUrl}\n\nThank you! 🙏`

  const phone = couple?.phone?.replace(/[^\d+]/g, '') || ''
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  return NextResponse.json({
    success: true,
    whatsapp_url: whatsappUrl,
    couple_phone: phone,
  })
}
