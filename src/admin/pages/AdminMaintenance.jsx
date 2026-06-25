import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getContent, setContent } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const DEFAULT      = { enabled: false, message: '', eta: '' }
const DEFAULT_SCHED = { enabled: false, days: [], startTime: '', endTime: '', message: '' }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function formatRemaining(ms) {
  if (ms <= 0) return null
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (!d) parts.push(`${m}m`)
  return parts.join(' ')
}

function nextOccurrence(schedule) {
  if (!schedule.enabled || !schedule.days?.length || !schedule.startTime) return null
  const [sh, sm] = schedule.startTime.split(':').map(Number)
  const now = new Date()
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + i)
    candidate.setHours(sh, sm, 0, 0)
    if (schedule.days.includes(candidate.getDay()) && candidate > now) {
      return candidate.toLocaleString([], { weekday:'long', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    }
  }
  return null
}

export default function AdminMaintenance() {
  const { showToast, logAction } = useAdmin()
  const [data,    setData]    = useState(DEFAULT)
  const [sched,   setSched]   = useState(DEFAULT_SCHED)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [savingSched, setSavingSched] = useState(false)
  const [remaining,   setRemaining]   = useState(null)

  useEffect(() => {
    Promise.all([
      getContent('maintenance'),
      getContent('maintenance_schedule'),
    ]).then(async ([d, s]) => {
      if (d) {
        const loaded = { enabled: !!d.enabled, message: d.message || '', eta: d.eta || '' }
        // Self-heal expired countdown
        if (loaded.enabled && loaded.eta) {
          const etaTime = new Date(loaded.eta).getTime()
          if (!isNaN(etaTime) && Date.now() >= etaTime) {
            const corrected = { ...loaded, enabled: false }
            setData(corrected)
            try {
              await setContent('maintenance', corrected)
              logAction('maintenance_disabled', 'Auto-disabled after countdown expired', null)
            } catch {}
            return
          }
        }
        setData(loaded)
      }
      if (s) setSched({ ...DEFAULT_SCHED, ...s })
      setLoading(false)
    }).catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live countdown ticker for manual ETA
  useEffect(() => {
    if (!data.enabled || !data.eta) { setRemaining(null); return }
    const etaTime = new Date(data.eta).getTime()
    if (isNaN(etaTime)) { setRemaining(null); return }
    const tick = () => {
      const ms = etaTime - Date.now()
      if (ms <= 0) {
        setRemaining(null)
        setData(d => {
          if (!d.enabled) return d
          const corrected = { ...d, enabled: false }
          setContent('maintenance', corrected).catch(() => {})
          logAction('maintenance_disabled', 'Auto-disabled after countdown expired', null)
          return corrected
        })
      } else {
        setRemaining(formatRemaining(ms))
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [data.enabled, data.eta])

  const save = async (overrides = {}) => {
    const payload = { ...data, ...overrides }
    setSaving(true)
    try {
      await setContent('maintenance', payload)
      setData(payload)
      logAction(
        payload.enabled ? 'maintenance_enabled' : 'maintenance_disabled',
        payload.enabled ? 'Turned ON maintenance mode' : 'Turned OFF maintenance mode',
        null
      )
      showToast(payload.enabled
        ? '🚧 Maintenance mode is ON — the live site is locked.'
        : '✅ Maintenance mode is OFF — the live site is back up.')
    } catch (e) {
      showToast(e.message || 'Could not save', 'error')
    }
    setSaving(false)
  }

  const saveSchedule = async () => {
    if (sched.enabled && (!sched.days.length || !sched.startTime || !sched.endTime)) {
      showToast('Please select at least one day and set both start and end times.', 'error')
      return
    }
    if (sched.enabled && sched.startTime >= sched.endTime) {
      showToast('End time must be after start time.', 'error')
      return
    }
    setSavingSched(true)
    try {
      await setContent('maintenance_schedule', sched)
      logAction('maintenance_schedule_updated', `Schedule ${sched.enabled ? 'enabled' : 'disabled'}`, null)
      showToast(sched.enabled
        ? `📅 Schedule saved! Next window: ${nextOccurrence(sched) || 'soon'}`
        : '📅 Schedule saved (disabled).')
    } catch (e) {
      showToast(e.message || 'Could not save schedule', 'error')
    }
    setSavingSched(false)
  }

  const toggleDay = (dayIndex) => {
    setSched(s => ({
      ...s,
      days: s.days.includes(dayIndex)
        ? s.days.filter(d => d !== dayIndex)
        : [...s.days, dayIndex].sort(),
    }))
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>⏳ Loading...</div>
  }

  const nextWindow = nextOccurrence(sched)

  return (
    <div>
      <PageHeader
        icon="🚧"
        title="Maintenance Mode"
        subtitle="Lock the public site manually or on a recurring schedule. The /admin panel is always accessible."
      />

      {/* ── STATUS / MANUAL TOGGLE ── */}
      <AdminCard style={{ maxWidth: 720, marginBottom: 20, border: data.enabled ? '2px solid #dc2626' : '2px solid #16a34a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, color: data.enabled ? '#dc2626' : '#16a34a', fontSize: '1.05rem', marginBottom: 4 }}>
              {data.enabled ? '🔒 Site is currently LOCKED' : '🟢 Site is currently LIVE'}
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
              {data.enabled
                ? 'Visitors see the maintenance page. Navbar and footer are hidden site-wide.'
                : 'Visitors see the normal site.'}
            </div>
            {data.enabled && remaining && (
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                ⏱️ Auto-unlocks in {remaining}
              </div>
            )}
          </div>
          <button
            onClick={() => save({ enabled: !data.enabled })}
            disabled={saving}
            style={{
              padding: '12px 26px', borderRadius: 30, border: 'none', cursor: saving ? 'default' : 'pointer',
              fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-body)', color: 'white',
              background: data.enabled ? '#16a34a' : '#dc2626', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '⏳ Saving…' : data.enabled ? '✅ Turn Maintenance OFF' : '🚧 Turn Maintenance ON'}
          </button>
        </div>
      </AdminCard>

      {/* ── MANUAL SETTINGS ── */}
      <AdminCard style={{ maxWidth: 720, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 18px', color: 'var(--brand-deep)' }}>Manual Maintenance Settings</h3>

        <div className="form-group">
          <label>Message shown to visitors</label>
          <textarea
            value={data.message}
            onChange={e => setData(d => ({ ...d, message: e.target.value }))}
            rows={3}
            placeholder="CCG World is currently down for scheduled maintenance. We'll be back in just a moment."
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label>Expected back-online time (optional — shows a live countdown)</label>
          <input
            type="datetime-local"
            value={data.eta}
            onChange={e => setData(d => ({ ...d, eta: e.target.value }))}
          />
        </div>

        <button className="btn btn-green" onClick={() => save()} disabled={saving}>
          {saving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>
      </AdminCard>

      {/* ── RECURRING SCHEDULE ── */}
      <AdminCard style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, color: 'var(--brand-deep)' }}>📅 Recurring Schedule</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={sched.enabled}
              onChange={e => setSched(s => ({ ...s, enabled: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--brand-mid)', cursor: 'pointer' }}
            />
            Enable recurring schedule
          </label>
        </div>

        {sched.enabled && nextWindow && (
          <div style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', fontSize: '0.82rem', fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>
            📅 Next window: {nextWindow}
          </div>
        )}

        <div className="form-group">
          <label>Days of the week</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                style={{
                  padding: '8px 14px', borderRadius: 20, border: '2px solid',
                  borderColor: sched.days.includes(i) ? 'var(--brand-mid)' : '#e5e7eb',
                  background: sched.days.includes(i) ? 'var(--brand-mid)' : 'white',
                  color: sched.days.includes(i) ? 'white' : 'var(--text-main)',
                  fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {sched.days.length > 0 && (
            <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Selected: {sched.days.map(d => DAY_FULL[d]).join(', ')}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Start time</label>
            <input
              type="time"
              value={sched.startTime}
              onChange={e => setSched(s => ({ ...s, startTime: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>End time</label>
            <input
              type="time"
              value={sched.endTime}
              onChange={e => setSched(s => ({ ...s, endTime: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Message during scheduled window (optional)</label>
          <textarea
            value={sched.message}
            onChange={e => setSched(s => ({ ...s, message: e.target.value }))}
            rows={2}
            placeholder="CCG World is undergoing its regular weekly maintenance. We'll be back shortly."
            style={{ resize: 'vertical' }}
          />
        </div>

        <button className="btn btn-green" onClick={saveSchedule} disabled={savingSched}>
          {savingSched ? '⏳ Saving...' : '💾 Save Schedule'}
        </button>

        <p style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: 14, marginBottom: 0 }}>
          💡 The schedule is checked every 30 seconds. The site enters maintenance mode automatically at the start time and returns to normal at the end time — no manual action needed. The manual toggle above always takes priority. The <code>/admin</code> panel is never affected.
        </p>
      </AdminCard>
    </div>
  )
}
