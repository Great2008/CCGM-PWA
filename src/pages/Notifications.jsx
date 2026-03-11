import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import { usePushNotifications } from '../hooks/usePushNotifications'

// ── helpers ────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const TAG_ICONS = {
  live:         '🔴',
  sermon:       '🎙',
  sabbath:      '📖',
  event:        '📅',
  announcement: '📢',
  general:      '🔔',
}

// ── component ──────────────────────────────────────────────────────
export default function Notifications() {
  const { user } = useAuth()
  const { supported, permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(user)

  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [subMsg, setSubMsg]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notification_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: prepend new notifications as they arrive
  useEffect(() => {
    const ch = supabase.channel('notif-feed')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notification_logs',
      }, payload => {
        setLogs(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe()
      setSubMsg('Notifications turned off.')
    } else {
      const r = await subscribe()
      if (r.success) setSubMsg('✅ You\'re subscribed! You\'ll receive notifications here.')
      else setSubMsg('❌ ' + r.error)
    }
  }

  const tags = ['all', ...Array.from(new Set(logs.map(l => l.tag).filter(Boolean)))]
  const filtered = filter === 'all' ? logs : logs.filter(l => l.tag === filter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft, #f8fafc)', paddingTop: 90 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, color: 'var(--brand-deep)', marginBottom: 6 }}>
            🔔 Notifications
          </h1>
          <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem' }}>
            Stay up to date with services, sermons, and announcements from CCG World.
          </p>
        </div>

        {/* Subscription card */}
        <div style={{
          background: subscribed ? 'linear-gradient(135deg,#052e16,#14532d)' : 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',
          borderRadius: 16, padding: '22px 24px', marginBottom: 28,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'white', marginBottom: 4 }}>
                {subscribed ? '🔔 Notifications Enabled' : '🔕 Notifications Off'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                {!supported
                  ? 'Push notifications are not supported in your browser.'
                  : permission === 'denied'
                  ? 'You\'ve blocked notifications. Please enable them in your browser settings.'
                  : subscribed
                  ? 'You\'ll receive live alerts, new sermons, and announcements directly.'
                  : 'Enable push notifications to get instant alerts when we go live or post something new.'}
              </div>
              {subMsg && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: subMsg.startsWith('✅') ? '#86efac' : '#fca5a5' }}>
                  {subMsg}
                </div>
              )}
            </div>
            {supported && permission !== 'denied' && (
              <button
                onClick={handleToggle}
                disabled={pushLoading}
                style={{
                  padding: '10px 22px', borderRadius: 30, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0,
                  background: subscribed ? '#dc2626' : 'var(--gold, #f59e0b)',
                  color: subscribed ? 'white' : 'var(--brand-deep)',
                  opacity: pushLoading ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
              >
                {pushLoading ? '⏳ ...' : subscribed ? 'Turn Off' : '🔔 Enable'}
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {logs.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {tags.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{
                  padding: '6px 16px', borderRadius: 30, border: '1.5px solid',
                  borderColor: filter === t ? 'var(--brand-light)' : '#e2e8f0',
                  background: filter === t ? 'var(--brand-light)' : 'white',
                  color: filter === t ? 'white' : 'var(--text-mid)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.15s', textTransform: 'capitalize',
                }}>
                {TAG_ICONS[t] || '🔔'} {t}
              </button>
            ))}
          </div>
        )}

        {/* Notification list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>
            Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--white, white)', borderRadius: 16,
            border: '1.5px dashed #e2e8f0', color: 'var(--text-light)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No notifications yet</div>
            <div style={{ fontSize: '0.82rem' }}>
              {filter === 'all'
                ? 'When the church sends announcements or goes live, they\'ll appear here.'
                : `No "${filter}" notifications yet.`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((log, i) => (
              <NotifCard key={log.id || i} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NotifCard({ log }) {
  const icon = TAG_ICONS[log.tag] || '🔔'
  const dest = log.url && log.url !== '/' ? log.url : null

  const inner = (
    <div style={{
      background: 'var(--white, white)', borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1.5px solid #f1f5f9',
      display: 'flex', gap: 14, alignItems: 'flex-start',
      transition: 'box-shadow 0.15s, transform 0.15s',
      cursor: dest ? 'pointer' : 'default',
      textDecoration: 'none',
    }}
    onMouseEnter={e => { if (dest) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Icon bubble */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: 'var(--brand-pale, #eff6ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.3rem',
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.92rem', lineHeight: 1.3 }}>
            {log.title}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', flexShrink: 0, marginTop: 2 }}>
            {timeAgo(log.sent_at)}
          </div>
        </div>
        <div style={{ color: 'var(--text-mid)', fontSize: '0.83rem', lineHeight: 1.55 }}>
          {log.body}
        </div>
        {dest && (
          <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--brand-light)', fontWeight: 700 }}>
            View → {dest}
          </div>
        )}
      </div>
    </div>
  )

  return dest ? <Link to={dest} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}
