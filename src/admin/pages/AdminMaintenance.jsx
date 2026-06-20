import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getContent, setContent } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const DEFAULT = { enabled: false, message: '', eta: '' }

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

export default function AdminMaintenance() {
  const { showToast, logAction } = useAdmin()
  const [data, setData]       = useState(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    getContent('maintenance').then(async (d) => {
      if (d) {
        const loaded = { enabled: !!d.enabled, message: d.message || '', eta: d.eta || '' }
        setData(loaded)

        // Self-heal: if the countdown already passed before this admin
        // opened the page, the public site has already auto-unlocked
        // itself — persist that correction here too, so this panel
        // doesn't keep showing "locked" indefinitely.
        if (loaded.enabled && loaded.eta) {
          const etaTime = new Date(loaded.eta).getTime()
          if (!isNaN(etaTime) && Date.now() >= etaTime) {
            const corrected = { ...loaded, enabled: false }
            setData(corrected)
            try {
              await setContent('maintenance', corrected)
              logAction('maintenance_disabled', 'Maintenance mode auto-disabled after countdown expired', null)
            } catch {}
          }
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live "auto-unlocks in …" countdown shown on the status card, and
  // auto-flips + persists the toggle the moment it reaches zero while
  // the admin is looking at the page.
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
          logAction('maintenance_disabled', 'Maintenance mode auto-disabled after countdown expired', null)
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>⏳ Loading...</div>
  }

  return (
    <div>
      <PageHeader
        icon="🚧"
        title="Maintenance Mode"
        subtitle="Lock the public site while you make changes. The /admin panel is a separate app and always stays accessible, so you can switch this back off."
      />

      <AdminCard style={{ maxWidth: 720, marginBottom: 20, border: data.enabled ? '2px solid #dc2626' : '2px solid #16a34a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, color: data.enabled ? '#dc2626' : '#16a34a', fontSize: '1.05rem', marginBottom: 4 }}>
              {data.enabled ? '🔒 Site is currently LOCKED' : '🟢 Site is currently LIVE'}
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
              {data.enabled
                ? 'Visitors see the maintenance page. The navbar and footer are hidden site-wide.'
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

      <AdminCard style={{ maxWidth: 720 }}>
        <h3 style={{ margin: '0 0 18px', color: 'var(--brand-deep)' }}>Maintenance Page Settings</h3>

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

        <p style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: 14, marginBottom: 0 }}>
          💡 Changes apply within about 30 seconds — visitors already on the site switch to/from the
          maintenance page automatically, without needing to refresh. If you set an expected
          back-online time, the site unlocks itself the instant the countdown hits zero — no need to
          come back and turn it off manually. The <code>/admin</code> panel is never affected by this
          setting.
        </p>
      </AdminCard>
    </div>
  )
}
