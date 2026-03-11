'use client'

import { useEffect, useState } from 'react'

type BlockedDate = {
  blocked_date: string
  reason: string
}

type Props = {
  vendorId: string
}

export default function AvailabilityCalendar({ vendorId }: Props) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAvailability()
  }, [vendorId])

  async function loadAvailability() {
    setLoading(true)
    const res = await fetch(`/api/vendor/availability?vendor_id=${vendorId}`)
    if (res.ok) {
      const data = await res.json()
      setBlockedDates(data.blocked_dates || [])
    }
    setLoading(false)
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

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
        Loading availability...
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10 }}>
        📅 Availability Calendar
      </h3>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
        Green dates are available, gray dates are blocked.
      </p>

      <div
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
            alignItems: 'center',
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
              fontWeight: 600,
            }}
          >
            ← Prev
          </button>
          <h4 style={{ fontSize: 18, fontWeight: 600 }}>{monthName}</h4>
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
              fontWeight: 600,
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

            return (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  padding: 12,
                  borderRadius: 8,
                  background: blocked ? '#e0e0e0' : '#d4edda',
                  color: blocked ? '#666' : '#155724',
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                {day}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            marginTop: 20,
            fontSize: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                background: '#d4edda',
                borderRadius: 4,
              }}
            />
            <span>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 20,
                background: '#e0e0e0',
                borderRadius: 4,
              }}
            />
            <span>Blocked</span>
          </div>
        </div>
      </div>
    </div>
  )
}
