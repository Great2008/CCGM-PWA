import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getContent, setContent } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const DEFAULT = { enabled: false, message: '', eta: '' }

export default function AdminMaintenance() {
  const { showToast, logAction } = useAdmin()
  const [data, setData]       = useState(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    getContent('maintenance').then(d => {
      if (d) setData({ enabled: !!d.enabled, message: d.message || '', eta: d.eta || '' })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

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
          maintenance page automatically, without needing to refresh. The <code>/admin</code> panel is
          never affected by this setting.
        </p>
      </AdminCard>
    </div>
  )
}
