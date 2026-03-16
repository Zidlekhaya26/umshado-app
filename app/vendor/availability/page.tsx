'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import VendorBottomNav from '@/components/VendorBottomNav'
import { CR, CR2, CRX, GD, DK, MUT, BOR, BG } from '@/lib/tokens';


const REASON_LABELS: Record<string, string> = {
  booked: 'Booked',
  unavailable: 'Unavailable',
  holiday: 'Personal / Holiday',
}

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


  if (loading) {
    return (
      <div style={{ minHeight:'100svh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid rgba(154,33,67,0.12)`, borderTopColor:CR, animation:'spin 0.8s linear infinite' }} />
        <p style={{ margin:0, fontSize:13, color:MUT, fontWeight:600 }}>Loading availability...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100svh', background:BG, fontFamily:'system-ui,sans-serif' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes avToast{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'}</style>

      <div style={{ maxWidth:600, margin:'0 auto', paddingBottom:100 }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(160deg,${CRX} 0%,${CR} 55%,var(--um-crimson-mid) 100%)`, padding:'20px 20px 22px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'rgba(189,152,63,0.1)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${GD},transparent)` }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, position:'relative' }}>
            <button onClick={() => router.back()} style={{ width:34, height:34, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'#fff', fontFamily:'Georgia,serif' }}>Availability</h1>
              <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.6)' }}>
                {blockedDates.length > 0 ? `${blockedDates.length} blocked date${blockedDates.length !== 1 ? 's' : ''}` : "Mark dates you're unavailable"}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding:'16px' }}>

          {/* Calendar card */}
          <div style={{ background:'#fff', borderRadius:20, padding:'18px 16px', marginBottom:16, boxShadow:'0 2px 12px rgba(26,13,18,0.07)', border:`1.5px solid ${BOR}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                style={{ background:'rgba(154,33,67,0.06)', border:`1px solid ${BOR}`, padding:'7px 14px', borderRadius:8, cursor:'pointer', fontWeight:600, color:CR, fontSize:13 }}>
                ← Prev
              </button>
              <span style={{ fontSize:15, fontWeight:700, color:DK }}>{monthName}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                style={{ background:'rgba(154,33,67,0.06)', border:`1px solid ${BOR}`, padding:'7px 14px', borderRadius:8, cursor:'pointer', fontWeight:600, color:CR, fontSize:13 }}>
                Next →
              </button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:4 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} style={{ textAlign:'center', fontWeight:600, fontSize:11, color:'#b0a090', padding:'4px 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const blocked = isBlocked(day)
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isSelected = selectedDate === dateStr
                return (
                  <button key={day} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    style={{ textAlign:'center', padding:'9px 2px', borderRadius:8, border: isSelected ? `2px solid ${CR}` : 'none', background: blocked ? 'rgba(154,33,67,0.12)' : isSelected ? 'rgba(154,33,67,0.06)' : '#f0ece8', color: blocked ? CR : DK, fontWeight: blocked ? 700 : 500, fontSize:14, cursor:'pointer', outline:'none', position:'relative' }}>
                    {day}
                    {blocked && <div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:CR }} />}
                  </button>
                )
              })}
            </div>

            <div style={{ display:'flex', gap:16, marginTop:16, fontSize:12, color:MUT }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14, height:14, background:'#f0ece8', borderRadius:4 }} /><span>Available</span></div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:14, height:14, background:'rgba(154,33,67,0.12)', borderRadius:4 }} /><span>Blocked</span></div>
            </div>
          </div>

          {/* Selected date form */}
          {selectedDate && (
            <div style={{ background:'#fff', borderRadius:20, padding:'18px', marginBottom:16, boxShadow:'0 2px 12px rgba(26,13,18,0.07)', border:`1.5px solid ${BOR}` }}>
              <p style={{ margin:'0 0 14px', fontSize:15, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long' })}
              </p>

              {isBlocked(parseInt(selectedDate.split('-')[2])) ? (
                <>
                  <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:12, background:'rgba(154,33,67,0.05)', border:`1px solid ${BOR}` }}>
                    <p style={{ margin:0, fontSize:12, color:MUT }}>This date is currently blocked.</p>
                  </div>
                  <button onClick={() => unblockDate(selectedDate)}
                    style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:'linear-gradient(135deg,#1e7c4a,#155a33)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>
                    Unblock This Date
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:11, fontWeight:700, color:MUT, letterSpacing:.4 }}>REASON</label>
                    <div style={{ display:'flex', gap:8, marginTop:6 }}>
                      {Object.entries(REASON_LABELS).map(([k, v]) => (
                        <button key={k} onClick={() => setReason(k)}
                          style={{ flex:1, padding:'8px 4px', borderRadius:10, border:`1.5px solid ${reason === k ? CR : BOR}`, background: reason === k ? 'rgba(154,33,67,0.06)' : '#fff', color: reason === k ? CR : MUT, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:11, fontWeight:700, color:MUT, letterSpacing:.4 }}>PRIVATE NOTE (optional)</label>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Family event, equipment repair..."
                      style={{ width:'100%', marginTop:6, padding:'11px 13px', borderRadius:11, border:`1.5px solid ${BOR}`, fontSize:13, color:DK, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }} />
                  </div>
                  <button onClick={blockDate} disabled={saving}
                    style={{ width:'100%', padding:'13px', borderRadius:13, border:'none', background:`linear-gradient(135deg,${CR},${CR2})`, color:'#fff', fontSize:14, fontWeight:800, cursor: saving ? 'default' : 'pointer', opacity: saving ? .6 : 1 }}>
                    {saving ? 'Saving...' : 'Block This Date'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Blocked dates list */}
          {blockedDates.length > 0 && (
            <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 12px rgba(26,13,18,0.07)', border:`1.5px solid ${BOR}` }}>
              <div style={{ padding:'14px 18px 12px', borderBottom:`1px solid ${BOR}` }}>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:DK, fontFamily:'Georgia,serif' }}>Blocked Dates ({blockedDates.length})</p>
              </div>
              {blockedDates.slice(0, 20).map(b => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', borderBottom:`1px solid ${BOR}` }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:'0 0 1px', fontSize:13, fontWeight:700, color:DK }}>
                      {new Date(b.blocked_date + 'T00:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' })}
                    </p>
                    <p style={{ margin:0, fontSize:11, color:MUT }}>{REASON_LABELS[b.reason] || b.reason}{b.note ? ` · ${b.note}` : ''}</p>
                  </div>
                  <button onClick={() => unblockDate(b.blocked_date)}
                    style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${BOR}`, background:'#fff', color:CR, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <VendorBottomNav />
    </div>
  )
}
