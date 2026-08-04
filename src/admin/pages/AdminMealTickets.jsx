import { useState, useEffect, useRef, useCallback } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabase'
import PageHeader from '../components/PageHeader'

const SLOTS = [
  { id: 'breakfast', label: '🌅 Breakfast' },
  { id: 'dinner',    label: '🌙 Dinner' },
]
const QUEUE_KEY = 'ccgm_meal_checkin_queue'
const todayStr  = () => new Date().toISOString().slice(0, 10)

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}
function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) }

function displayName(reg) {
  if (!reg) return ''
  if (reg.is_guest) return reg.guest_name || 'Guest'
  const p = reg.profiles || {}
  return p.display_name || p.full_name || 'Member'
}
function qrDataUrl(text, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=10`
}

export default function AdminMealTickets() {
  const { showToast, adminUser } = useAdmin()
  const [events, setEvents]       = useState([])
  const [eventId, setEventId]     = useState('')
  const [roster, setRoster]       = useState([])       // cached registrations for offline lookup
  const [loading, setLoading]     = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [mode, setMode]           = useState('scan')   // scan | search
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)      // currently focused registration
  const [checkins, setCheckins]   = useState({})        // registration_id -> {breakfast: ts, dinner: ts}
  const [queue, setQueue]         = useState(loadQueue())
  const [online, setOnline]       = useState(navigator.onLine)
  const [scanError, setScanError] = useState('')
  const [showWalkin, setShowWalkin] = useState(false)
  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [savingWalkin, setSavingWalkin] = useState(false)
  const [ticketReg, setTicketReg] = useState(null) // just-registered guest, shown with QR to screenshot
  const [possibleDupe, setPossibleDupe] = useState(null) // existing registration that looks like a name match
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)
  const jsQRRef   = useRef(null)
  const showToastRef = useRef(showToast)
  useEffect(() => { showToastRef.current = showToast })

  // Load the events list
  useEffect(() => {
    supabaseAdmin.from('events').select('id,title,date').order('date', { ascending: false })
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [])

  // Track online/offline
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Load roster + today's checkins for selected event, cache to localStorage for offline search
  const loadRoster = useCallback(async (id) => {
    setLoadingRoster(true)
    const cacheKey = `ccgm_meal_roster_${id}`
    try {
      const { data, error } = await supabaseAdmin
        .from('event_registrations')
        .select('id, user_id, is_guest, guest_name, guest_phone, profiles(full_name,display_name,email,avatar_url)')
        .eq('event_id', id)
      if (error) throw error
      setRoster(data || [])
      localStorage.setItem(cacheKey, JSON.stringify(data || []))

      const { data: ci } = await supabaseAdmin
        .from('meal_checkins')
        .select('registration_id, slot, checked_in_at')
        .eq('event_id', id)
        .eq('meal_date', todayStr())
      const map = {}
      ;(ci || []).forEach(c => { map[c.registration_id] = { ...map[c.registration_id], [c.slot]: c.checked_in_at } })
      setCheckins(map)
    } catch (e) {
      console.error('Meal roster load failed:', e)
      const cached = localStorage.getItem(cacheKey)
      const reason = navigator.onLine ? (e?.message || e?.error_description || 'Unknown error') : 'No internet connection'
      if (cached) { setRoster(JSON.parse(cached)); showToastRef.current(`Using cached roster — ${reason}`, 'error') }
      else showToastRef.current(`Could not load roster: ${reason}`, 'error')
    }
    setLoadingRoster(false)
  }, []) // intentionally no deps: showToast is read via ref so this never changes identity

  useEffect(() => { if (eventId) loadRoster(eventId) }, [eventId, loadRoster])

  // ── Offline queue sync ──────────────────────────────────────────
  useEffect(() => {
    if (!online || queue.length === 0) return
    let cancelled = false
    ;(async () => {
      const remaining = [...queue]
      for (const item of queue) {
        const { error } = await supabaseAdmin.from('meal_checkins').insert({
          registration_id: item.registration_id, event_id: item.event_id, user_id: item.user_id,
          meal_date: item.meal_date, slot: item.slot, checked_in_by: item.checked_in_by,
        })
        // ignore unique-violation (already synced/duplicate) — treat as success
        if (!error || error.code === '23505') {
          const idx = remaining.findIndex(r => r.tmp_id === item.tmp_id)
          if (idx > -1) remaining.splice(idx, 1)
        }
      }
      if (!cancelled) {
        // only update state if something actually changed, to avoid re-triggering this effect pointlessly
        if (remaining.length !== queue.length) { setQueue(remaining); saveQueue(remaining) }
      }
    })()
    return () => { cancelled = true }
  }, [online, queue])

  const markMeal = async (reg, slot) => {
    const already = checkins[reg.id]?.[slot]
    if (already) {
      if (!window.confirm(`Already marked ${slot} at ${new Date(already).toLocaleTimeString()}. Mark again?`)) return
    }
    const ts = new Date().toISOString()
    setCheckins(c => ({ ...c, [reg.id]: { ...c[reg.id], [slot]: ts } }))

    const record = {
      tmp_id: `${reg.id}-${slot}-${Date.now()}`,
      registration_id: reg.id, event_id: eventId, user_id: reg.user_id,
      meal_date: todayStr(), slot, checked_in_by: adminUser?.id,
    }
    if (!online) {
      const q = [...queue, record]; setQueue(q); saveQueue(q)
      showToast('Saved offline — will sync later')
      return
    }
    const { error } = await supabaseAdmin.from('meal_checkins').insert({
      registration_id: record.registration_id, event_id: record.event_id, user_id: record.user_id,
      meal_date: record.meal_date, slot: record.slot, checked_in_by: record.checked_in_by,
    })
    if (error && error.code !== '23505') {
      // insert failed for a real reason — queue it instead of losing it
      const q = [...queue, record]; setQueue(q); saveQueue(q)
      showToast('Could not save — queued for retry', 'error')
    } else {
      showToast(`✅ ${slot === 'breakfast' ? 'Breakfast' : 'Dinner'} marked`)
    }
  }

  const findPossibleDupes = (name) => {
    const norm = name.trim().toLowerCase()
    if (!norm) return []
    return roster.filter(r => {
      const existing = displayName(r).trim().toLowerCase()
      return existing === norm || existing.includes(norm) || norm.includes(existing)
    })
  }

  const registerWalkin = async () => {
    if (!walkinName.trim()) { showToast('Enter a name', 'error'); return }
    const dupes = findPossibleDupes(walkinName)
    if (dupes.length > 0) { setPossibleDupe(dupes); return }
    await doInsertWalkin()
  }

  const useExisting = (reg) => {
    setSelected(reg)
    setShowWalkin(false); setPossibleDupe(null); setWalkinName(''); setWalkinPhone('')
    showToast(`Using existing registration for ${displayName(reg)}`)
  }

  const doInsertWalkin = async () => {
    setSavingWalkin(true)
    const payload = { event_id: eventId, is_guest: true, guest_name: walkinName.trim(), guest_phone: walkinPhone.trim() || null, registered_by: adminUser?.id }
    const { data, error } = await supabaseAdmin.from('event_registrations').insert(payload).select('id, user_id, is_guest, guest_name, guest_phone').single()
    setSavingWalkin(false)
    if (error) { showToast('Could not register — try again', 'error'); return }
    setRoster(r => {
      const next = [...r, data]
      localStorage.setItem(`ccgm_meal_roster_${eventId}`, JSON.stringify(next))
      return next
    })
    setShowWalkin(false); setWalkinName(''); setWalkinPhone(''); setPossibleDupe(null)
    setSelected(data)
    setTicketReg(data)
    showToast(`✅ ${data.guest_name} registered`)
  }

  // ── Camera scanning ─────────────────────────────────────────────
  const stopScan = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const onDecoded = useCallback((text) => {
    const id = text.replace(/^MEAL-/, '').trim()
    const reg = roster.find(r => r.id === id)
    if (!reg) { setScanError('Ticket not recognized for this event'); setTimeout(() => setScanError(''), 2000); return }
    setSelected(reg)
    if (navigator.vibrate) navigator.vibrate(80)
  }, [roster])

  useEffect(() => {
    if (mode !== 'scan' || !eventId) { stopScan(); return }
    let cancelled = false

    const loadJsQR = () => new Promise((resolve, reject) => {
      if (window.jsQR) return resolve(window.jsQR)
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js'
      s.onload = () => resolve(window.jsQR)
      s.onerror = reject
      document.head.appendChild(s)
    })

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // Prefer native BarcodeDetector, fall back to jsQR
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const tick = async () => {
            if (cancelled) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes[0]) onDecoded(codes[0].rawValue)
            } catch (_) {}
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        } else {
          const jsQR = await loadJsQR()
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const tick = () => {
            if (cancelled) return
            const v = videoRef.current
            if (v && v.videoWidth) {
              canvas.width = v.videoWidth; canvas.height = v.videoHeight
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(img.data, img.width, img.height)
              if (code) onDecoded(code.data)
            }
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        }
      } catch (e) {
        setScanError('Camera unavailable — use Search instead')
      }
    }
    start()
    return () => { cancelled = true; stopScan() }
  }, [mode, eventId, onDecoded])

  const filteredRoster = roster.filter(r => {
    if (!search) return false
    const p = r.profiles || {}
    const name = displayName(r).toLowerCase()
    return name.includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase()) || (r.guest_phone || '').includes(search)
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading events...</div>

  return (
    <div>
      <PageHeader icon="🍽️" title="Meal Tickets" subtitle="Check in participants at breakfast & dinner" />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={eventId} onChange={e => { setEventId(e.target.value); setSelected(null) }}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
          <option value="">Select event...</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>)}
        </select>
        {eventId && (
          <span style={{ fontSize: '0.78rem', color: online ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
            {online ? '🟢 Online' : '🔴 Offline'}{queue.length > 0 && ` · ${queue.length} pending sync`}
          </span>
        )}
      </div>

      {!eventId ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 60, textAlign: 'center', border: '1.5px solid #e2e8f0', color: 'var(--text-light)' }}>
          Select an event to begin checking in meal tickets
        </div>
      ) : loadingRoster ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>Loading roster ({roster.length} cached)...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setMode('scan')} className={mode === 'scan' ? 'btn btn-primary' : 'btn btn-outline-blue'} style={{ fontSize: '0.85rem' }}>📷 Scan QR</button>
            <button onClick={() => { setMode('search'); stopScan() }} className={mode === 'search' ? 'btn btn-primary' : 'btn btn-outline-blue'} style={{ fontSize: '0.85rem' }}>🔍 Search</button>
            <button onClick={() => { setShowWalkin(true); stopScan() }} className="btn btn-outline-blue" style={{ fontSize: '0.85rem', marginLeft: 'auto' }}>➕ Register Walk-in</button>
          </div>

          {showWalkin && (
            <div style={{ background: 'white', borderRadius: 16, padding: 18, border: '1.5px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-deep)', marginBottom: 10, fontSize: '0.9rem' }}>Register a walk-in participant</div>
              <input value={walkinName} onChange={e => { setWalkinName(e.target.value); setPossibleDupe(null) }} placeholder="Full name"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', marginBottom: 8, boxSizing: 'border-box' }} />
              <input value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} placeholder="Phone (optional)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', marginBottom: 12, boxSizing: 'border-box' }} />

              {possibleDupe && (
                <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                    ⚠️ Already registered? {possibleDupe.length === 1 ? 'This looks like a match' : 'These look like matches'}:
                  </div>
                  {possibleDupe.map(r => (
                    <div key={r.id} onClick={() => useExisting(r)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: 'white', border: '1px solid #fde68a', marginBottom: 6, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{displayName(r)} {r.is_guest ? `(${r.guest_phone || 'no phone'})` : `(${r.profiles?.email || 'app user'})`}</span>
                      <span style={{ color: 'var(--brand-light)', fontWeight: 700, fontSize: '0.78rem' }}>Use this →</span>
                    </div>
                  ))}
                  <button onClick={doInsertWalkin} disabled={savingWalkin} className="btn btn-outline-blue" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    {savingWalkin ? 'Saving...' : "No, it's a different person — register new"}
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {!possibleDupe && (
                  <button onClick={registerWalkin} disabled={savingWalkin} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>{savingWalkin ? 'Saving...' : 'Register & Generate Ticket'}</button>
                )}
                <button onClick={() => { setShowWalkin(false); setWalkinName(''); setWalkinPhone(''); setPossibleDupe(null) }} className="btn btn-outline-blue" style={{ fontSize: '0.85rem' }}>Cancel</button>
              </div>
            </div>
          )}

          {ticketReg && (
            <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '2px solid #bbf7d0', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 8, fontSize: '0.9rem' }}>🎟️ Ticket ready for {ticketReg.guest_name}</div>
              <img src={qrDataUrl(`MEAL-${ticketReg.id}`)} alt="Walk-in meal ticket QR" style={{ width: 180, height: 180, borderRadius: 10 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 8 }}>Screenshot or print this for {ticketReg.guest_name} to present at meals — or just mark today's meal below now.</div>
              <button onClick={() => setTicketReg(null)} className="btn btn-outline-blue" style={{ fontSize: '0.8rem', marginTop: 10 }}>Done</button>
            </div>
          )}

          {mode === 'scan' && (
            <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1.5px solid #e2e8f0', marginBottom: 16, textAlign: 'center' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }} />
              {scanError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: 8 }}>{scanError}</div>}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 8 }}>Point the camera at the participant's ticket QR code</div>
            </div>
          )}

          {mode === 'search' && (
            <div style={{ marginBottom: 16 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name or email..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.88rem', boxSizing: 'border-box' }} />
              {search && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredRoster.length === 0 && <div style={{ color: 'var(--text-light)', fontSize: '0.85rem', padding: 12 }}>No match found</div>}
                  {filteredRoster.map(r => {
                    const p = r.profiles || {}
                    return (
                      <div key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: selected?.id === r.id ? 'var(--brand-pale)' : 'white' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.88rem' }}>{displayName(r)}{r.is_guest && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: 6 }}>WALK-IN</span>}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{r.is_guest ? (r.guest_phone || 'No phone on file') : p.email}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {selected && (() => {
            const p = selected.profiles || {}
            const c = checkins[selected.id] || {}
            return (
              <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '2px solid var(--brand-light)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, flexShrink: 0 }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} /> : displayName(selected).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1.05rem' }}>{displayName(selected)}{selected.is_guest && <span style={{ marginLeft: 6, fontSize: '0.65rem', color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: 6, verticalAlign: 'middle' }}>WALK-IN</span>}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{selected.is_guest ? (selected.guest_phone || '') : p.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {SLOTS.map(s => (
                    <button key={s.id} onClick={() => markMeal(selected, s.id)}
                      style={{ flex: 1, minWidth: 140, padding: '14px 10px', borderRadius: 12, border: '2px solid', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
                        borderColor: c[s.id] ? '#bbf7d0' : '#e2e8f0', background: c[s.id] ? '#f0fdf4' : 'white', color: c[s.id] ? '#16a34a' : 'var(--brand-deep)' }}>
                      {s.label}{c[s.id] ? ` ✅ ${new Date(c[s.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
