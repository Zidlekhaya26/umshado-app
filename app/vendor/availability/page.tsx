'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type BlockedDate = {
  id: string
  blocked_date: string
  reason: string
  note: string
}

export default function VendorAvailabilityPage() {
  const [vendor, setVendor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('unavailable')
  const [note, setNote] = useState<string>('')
  const [saving, setSaving] = useState(false)

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

    // Load blocked dates
    const { data: blocked } = await supabase
      .from('vendor_availability')
      .select('*')
      .eq('vendor_id', v.id)
      .order('blocked_date', { ascending: true })

    setBlockedDates(blocked || [])
    setLoading(false)
  }

  async function blockDate() {
    if (!selectedDate || !vendor) return
    setSaving(true)

    const res = await fetch('/api/vendor/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_date: selectedDate, reason, note }),
    })

    if (res.ok) {
      await loadData()
      setSelectedDate(null)
      setNote('')
    }
    setSaving(false)
  }

  async function unblockDate(date: string) {
    if (!vendor) return
    const res = await fetch(`/api/vendor/availability?blocked_date=${date}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await loadData()
    }
  }

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate()
  const firstDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay()

  const monthName = currentMonth.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  const isBlocked = (day: number) => {
    const date = `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return blockedDates.some((b) => b.blocked_date === date)
  }

  const getBlockedInfo = (day: number) => {
    const date = `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return blockedDates.find((b) => b.blocked_date === date)
  }

  if (loading) {
    return (
      <div style={{ padding: 20, color: '#333' }}>
        <p>Loading availability...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
        📅 Manage Your Availability
      </h1>
      <p style={{ color: '#666', marginBottom: 30 }}>
        Block dates when you're unavailable or already booked. Couples will see these when
        viewing your profile.
      </p>

      {/* Calendar */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 20,
          marginBottom: 30,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
              )
            }
            style={{
              background: '#f1f1f1',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            ← Prev
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{monthName}</h2>
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
              )
            }
            style={{
              background: '#f1f1f1',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Next →
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: 14,
                color: '#999',
                padding: 8,
              }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const blocked = isBlocked(day)
            const info = getBlockedInfo(day)
            const dateStr = `${currentMonth.getFullYear()}-${String(
              currentMonth.getMonth() + 1
            ).padStart(2, '0')}-${String(day).padStart(2, '0')}`

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                style={{
                  textAlign: 'center',
                  padding: 12,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: blocked ? '#f8d7da' : selectedDate === dateStr ? '#d1ecf1' : '#f9f9f9',
                  border: selectedDate === dateStr ? '2px solid #9A2143' : 'none',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 500 }}>{day}</div>
                {blocked && info && (
                  <div style={{ fontSize: 10, color: '#721c24', marginTop: 4 }}>
                    {info.reason}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Block/Unblock Form */}
      {selectedDate && (
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: 20,
            marginBottom: 30,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 15 }}>
            Selected: {selectedDate}
          </h3>

          {isBlocked(parseInt(selectedDate.split('-')[2])) ? (
            <button
              onClick={() => unblockDate(selectedDate)}
              style={{
                background: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✓ Unblock This Date
            </button>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Reason:
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  marginBottom: 15,
                }}
              >
                <option value="booked">Booked</option>
                <option value="unavailable">Unavailable</option>
                <option value="holiday">Holiday</option>
              </select>

              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Private Note (optional):
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Personal event, equipment maintenance..."
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  marginBottom: 15,
                  minHeight: 80,
                }}
              />

              <button
                onClick={blockDate}
                disabled={saving}
                style={{
                  background: 'linear-gradient(135deg, #9A2143, #b8315a)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : '🚫 Block This Date'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Upcoming Blocked Dates */}
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 15 }}>
          📋 Upcoming Blocked Dates ({blockedDates.length})
        </h3>
        {blockedDates.length === 0 ? (
          <p style={{ color: '#666' }}>No blocked dates yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blockedDates.slice(0, 10).map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  background: '#f9f9f9',
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong>{new Date(b.blocked_date + 'T00:00:00').toDateString()}</strong>
                  {' — '}
                  <span style={{ color: '#666', textTransform: 'capitalize' }}>
                    {b.reason}
                  </span>
                  {b.note && (
                    <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                      {b.note}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => unblockDate(b.blocked_date)}
                  style={{
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
