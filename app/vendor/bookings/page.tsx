'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type Booking = {
  id: string
  booking_ref: string
  package_name: string
  event_date: string | null
  event_location: string | null
  confirmed_price: number
  status: string
  confirmed_at: string
  completed_at: string | null
  couple: {
    full_name: string
    phone: string
  }
}

export default function VendorBookingsPage() {
  const [vendor, setVendor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<string>('upcoming') // 'upcoming', 'completed', 'all'
  const [sendingReview, setSendingReview] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: v } = await supabase
      .from('vendors')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single()

    if (!v) {
      router.push('/')
      return
    }

    setVendor(v)

    // Load bookings
    const { data: bks } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_couple_id_fkey(full_name, phone)')
      .eq('vendor_id', v.id)
      .order('event_date', { ascending: true, nullsFirst: false })

    setBookings(
      (bks || []).map((b: any) => ({
        ...b,
        couple: b.profiles,
      }))
    )
    setLoading(false)
  }

  async function markComplete(bookingId: string) {
    await supabase
      .from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', bookingId)
    await loadData()
  }

  async function sendReviewRequest(bookingId: string) {
    setSendingReview(bookingId)
    const res = await fetch('/api/vendor/review-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId }),
    })
    const data = await res.json()

    if (res.ok && data.whatsapp_url) {
      window.open(data.whatsapp_url, '_blank')
    }

    setSendingReview(null)
  }

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'upcoming') return b.status === 'confirmed'
    if (filter === 'completed') return b.status === 'completed'
    return true
  })

  if (loading) {
    return (
      <div style={{ padding: 20, color: '#333' }}>
        <p>Loading bookings...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
        📋 Your Bookings
      </h1>
      <p style={{ color: '#666', marginBottom: 30 }}>
        Confirmed bookings from couples. Mark them complete and request reviews after the
        event.
      </p>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        {['upcoming', 'completed', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: 600,
              color: filter === tab ? '#9A2143' : '#999',
              borderBottom: filter === tab ? '3px solid #9A2143' : 'none',
              textTransform: 'capitalize',
            }}
          >
            {tab} ({bookings.filter((b) => {
              if (tab === 'upcoming') return b.status === 'confirmed'
              if (tab === 'completed') return b.status === 'completed'
              return true
            }).length})
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 40,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <p style={{ fontSize: 18, color: '#666' }}>
            {filter === 'upcoming'
              ? 'No upcoming bookings yet.'
              : filter === 'completed'
              ? 'No completed bookings.'
              : 'No bookings yet.'}
          </p>
          <Link
            href="/vendor/dashboard"
            style={{
              display: 'inline-block',
              marginTop: 20,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #9A2143, #b8315a)',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 15,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 5 }}>
                    {booking.booking_ref}
                  </h3>
                  <p style={{ color: '#666', fontSize: 14 }}>
                    {booking.couple?.full_name || 'Couple'} • {booking.package_name}
                  </p>
                </div>
                <div
                  style={{
                    background:
                      booking.status === 'completed'
                        ? '#d4edda'
                        : booking.status === 'confirmed'
                        ? '#d1ecf1'
                        : '#f8d7da',
                    color:
                      booking.status === 'completed'
                        ? '#155724'
                        : booking.status === 'confirmed'
                        ? '#0c5460'
                        : '#721c24',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    height: 'fit-content',
                  }}
                >
                  {booking.status}
                </div>
              </div>

              <div style={{ marginBottom: 15, fontSize: 14, color: '#555' }}>
                <div>
                  <strong>Event Date:</strong>{' '}
                  {booking.event_date
                    ? new Date(booking.event_date + 'T00:00:00').toDateString()
                    : 'TBD'}
                </div>
                <div>
                  <strong>Location:</strong> {booking.event_location || 'Not specified'}
                </div>
                <div>
                  <strong>Price:</strong> R{(booking.confirmed_price / 100).toFixed(2)}
                </div>
                <div>
                  <strong>Confirmed:</strong>{' '}
                  {new Date(booking.confirmed_at).toLocaleDateString()}
                </div>
                {booking.completed_at && (
                  <div>
                    <strong>Completed:</strong>{' '}
                    {new Date(booking.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {booking.status === 'confirmed' && (
                  <button
                    onClick={() => markComplete(booking.id)}
                    style={{
                      background: '#28a745',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Mark Complete
                  </button>
                )}

                {booking.status === 'completed' && (
                  <button
                    onClick={() => sendReviewRequest(booking.id)}
                    disabled={sendingReview === booking.id}
                    style={{
                      background: 'linear-gradient(135deg, #9A2143, #b8315a)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: 8,
                      cursor: sendingReview === booking.id ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      opacity: sendingReview === booking.id ? 0.6 : 1,
                    }}
                  >
                    {sendingReview === booking.id
                      ? 'Opening WhatsApp...'
                      : '⭐ Request Review via WhatsApp'}
                  </button>
                )}

                <a
                  href={`tel:${booking.couple?.phone}`}
                  style={{
                    background: '#f1f1f1',
                    color: '#333',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  📞 Call {booking.couple?.full_name}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
