'use client'

import { useEffect, useState } from 'react'

type BlockedDate = {
  blocked_date: string
  reason: string
  note?: string
}

type Props = {
  vendorId: string
}

const CR = '#9A2143'
const CRX = '#4d0f21'

const REASON_LABEL: Record<string, string> = {
  booked: 'Already booked',
  unavailable: 'Unavailable',
  holiday: 'Holiday / personal time',
}

export default function AvailabilityCalendar({ vendorId }: Props) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BlockedDate | null>(null)

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

  const getBlocked = (day: number): BlockedDate | undefined => {
    const date = `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return blockedDates.find((b) => b.blocked_date === date)
  }

  if (loading) {
    return (
      <div style={{ padding: 28, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid rgba(154,33,67,0.15)`, borderTopColor: CR, animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#7a5060', lineHeight: 1.5 }}>
          Red dates are unavailable. Tap a date to see why.
        </p>
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          style={{ background: 'rgba(154,33,67,0.06)', border: '1px solid rgba(154,33,67,0.15)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: CR, fontSize: 13 }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a0d12' }}>{monthName}</span>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          style={{ background: 'rgba(154,33,67,0.06)', border: '1px solid rgba(154,33,67,0.15)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: CR, fontSize: 13 }}
        >
          Next →
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: 11, color: '#b0a090', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const blocked = getBlocked(day)

          return (
            <button
              key={day}
              onClick={() => blocked ? setSelected(blocked) : undefined}
              style={{
                textAlign: 'center',
                padding: '9px 2px',
                borderRadius: 8,
                border: 'none',
                background: blocked ? `rgba(154,33,67,0.12)` : '#f0ece8',
                color: blocked ? CR : '#5a4050',
                fontWeight: blocked ? 700 : 500,
                fontSize: 14,
                cursor: blocked ? 'pointer' : 'default',
                outline: 'none',
                position: 'relative',
              }}
            >
              {day}
              {blocked && (
                <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: CR }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 18, fontSize: 12, color: '#7a5060' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 14, background: '#f0ece8', borderRadius: 4 }} />
          <span>Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 14, background: 'rgba(154,33,67,0.12)', borderRadius: 4, border: `1px solid rgba(154,33,67,0.2)` }} />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Bottom sheet — reason popover */}
      {selected && (
        <>
          <div
            onClick={() => setSelected(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,18,0.45)', zIndex: 60 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '24px 24px 40px',
            boxShadow: '0 -4px 32px rgba(26,13,18,0.18)',
          }}>
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(154,33,67,0.15)', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(154,33,67,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                🚫
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#b0a090', fontWeight: 500 }}>
                  {new Date(selected.blocked_date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#1a0d12' }}>
                  {REASON_LABEL[selected.reason] || selected.reason}
                </p>
              </div>
            </div>

            <div style={{ borderRadius: 12, background: 'rgba(154,33,67,0.05)', border: '1.5px solid rgba(154,33,67,0.12)', padding: '12px 16px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#7a5060', lineHeight: 1.6 }}>
                This vendor is not available on this date.
              </p>
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{ marginTop: 20, width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg,${CRX},${CR})`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  )
}
