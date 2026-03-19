import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminApp'
import supabase from '../../lib/supabaseAdmin'

const ACTION_ICONS = {
  'role_change':        '🛡',
  'suspend':            '🚫',
  'reinstate':          '✅',
  'post_approved':      '✝️',
  'post_rejected':      '❌',
  'branch_add':         '⛪',
  'branch_edit':        '✏️',
  'branch_delete':      '🗑',
  'sermon_add':         '🎙',
  'sermon_edit':        '✏️',
  'sermon_delete':      '🗑',
  'event_add':          '📅',
  'event_edit':         '✏️',
  'event_delete':       '🗑',
  'blog_add':           '✍️',
  'blog_edit':          '✏️',
  'blog_delete':        '🗑',
  'gallery_add':        '🖼',
  'gallery_delete':     '🗑',
  'timeline_delete':    '💬',
  'prayer_delete':      '🙏',
}

const ACTION_COLORS = {
  'role_change':    { bg: '#f5f3ff', color: '#7c3aed' },
  'suspend':        { bg: '#fff5f5', color: '#dc2626' },
  'reinstate':      { bg: '#f0fdf4', color: '#166534' },
  'post_approved':  { bg: '#f0fdf4', color: '#166534' },
  'post_rejected':  { bg: '#fff5f5', color: '#dc2626' },
  'branch_add':     { bg: '#f0fdf4', color: '#0369a1' },
  'branch_edit':    { bg: '#eff6ff', color: '#0369a1' },
  'branch_delete':  { bg: '#fff5f5', color: '#dc2626' },
  'sermon_add':     { bg: '#f0fdf4', color: '#166534' },
  'sermon_edit':    { bg: '#eff6ff', color: '#0369a1' },
  'sermon_delete':  { bg: '#fff5f5', color: '#dc2626' },
  'event_add':      { bg: '#f0fdf4', color: '#166534' },
  'event_edit':     { bg: '#eff6ff', color: '#0369a1' },
  'event_delete':   { bg: '#fff5f5', color: '#dc2626' },
  'blog_add':       { bg: '#f0fdf4', color: '#166534' },
  'blog_edit':      { bg: '#eff6ff', color: '#0369a1' },
  'blog_delete':    { bg: '#fff5f5', color: '#dc2626' },
  'gallery_add':    { bg: '#f0fdf4', color: '#166534' },
  'gallery_delete': { bg: '#fff5f5', color: '#dc2626' },
  'timeline_delete':{ bg: '#fff7ed', color: '#c2410c' },
  'prayer_delete':  { bg: '#fff7ed', color: '#c2410c' },
}

const CATEGORIES = [
  { value: 'all',        label: 'All Actions' },
  { value: 'members',    label: 'Members' },
  { value: 'content',    label: 'Content' },
  { value: 'branches',   label: 'Branches' },
  { value: 'moderation', label: 'Moderation' },
]

const MEMBER_ACTIONS     = ['role_change','suspend','reinstate','post_approved','post_rejected']
const CONTENT_ACTIONS    = ['sermon_add','sermon_edit','sermon_delete','event_add','event_edit','event_delete','blog_add','blog_edit','blog_delete','gallery_add','gallery_delete']
const BRANCH_ACTIONS     = ['branch_add','branch_edit','branch_delete']
const MODERATION_ACTIONS = ['timeline_delete','prayer_delete']

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

export default function AdminLog() {
  const { isSuperAdmin } = useAdmin()
  const [lockPhase, setLockPhase] = useState('locking') // 'locking' | 'locked' | 'denied'

  useEffect(() => {
    if (isSuperAdmin) return
    // Phase 1: locking animation (1.4s)
    const t1 = setTimeout(() => setLockPhase('locked'), 1400)
    // Phase 2: show denied message (2.6s total)
    const t2 = setTimeout(() => setLockPhase('denied'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isSuperAdmin])
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('admin_audit_log')
      .select('*, admin:admin_id(full_name, display_name, email)')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (category === 'members')    q = q.in('action', MEMBER_ACTIONS)
    else if (category === 'content')    q = q.in('action', CONTENT_ACTIONS)
    else if (category === 'branches')   q = q.in('action', BRANCH_ACTIONS)
    else if (category === 'moderation') q = q.in('action', MODERATION_ACTIONS)

    const { data, error } = await q
    if (!error) setLogs(data || [])
    setLoading(false)
  }, [category, page])

  useEffect(() => { load() }, [load])

  if (!isSuperAdmin) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0, padding: 32, textAlign: 'center' }}>

      <style>{`
        @keyframes shackle-open {
          0%   { transform: translateY(0) rotate(0deg); }
          40%  { transform: translateY(-8px) rotate(-15deg); }
          70%  { transform: translateY(-6px) rotate(-10deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes shackle-close {
          0%   { transform: translateY(-6px) rotate(-10deg); }
          60%  { transform: translateY(2px) rotate(5deg); }
          80%  { transform: translateY(-1px) rotate(-2deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes lock-shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          15%     { transform: translateX(-6px) rotate(-4deg); }
          30%     { transform: translateX(6px) rotate(4deg); }
          45%     { transform: translateX(-5px) rotate(-3deg); }
          60%     { transform: translateX(5px) rotate(3deg); }
          75%     { transform: translateX(-3px) rotate(-2deg); }
          90%     { transform: translateX(3px) rotate(2deg); }
        }
        @keyframes lock-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
          50%     { box-shadow: 0 0 32px 8px rgba(220,38,38,0.35); }
        }
        @keyframes text-appear {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes denied-pulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.7; }
        }
        .lock-icon-locking { animation: shackle-open 0.5s ease-in-out, shackle-close 0.6s ease-in-out 0.6s; }
        .lock-icon-locked  { animation: lock-shake 0.6s ease-in-out, lock-glow 1.5s ease-in-out infinite; }
        .lock-icon-denied  { animation: lock-glow 2s ease-in-out infinite; }
      `}</style>

      {/* Lock icon */}
      <div style={{
        width: 96, height: 96, borderRadius: 24,
        background: lockPhase === 'denied'
          ? 'linear-gradient(135deg,#7f1d1d,#dc2626)'
          : 'linear-gradient(135deg,#0a2612,#166534)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '3.2rem', marginBottom: 28,
        transition: 'background 0.6s ease',
        cursor: 'default',
      }}
        className={`lock-icon-${lockPhase}`}
      >
        {lockPhase === 'locking' ? '🔓' : '🔒'}
      </div>

      {/* Phase text */}
      {lockPhase === 'locking' && (
        <div style={{ animation: 'text-appear 0.3s ease', color: 'var(--text-light)', fontSize: '1rem', letterSpacing: '0.08em' }}>
          Checking clearance…
        </div>
      )}

      {lockPhase === 'locked' && (
        <div style={{ animation: 'text-appear 0.4s ease' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--brand-deep)', fontWeight: 900, marginBottom: 6 }}>
            Access Denied
          </div>
          <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Verifying credentials…</div>
        </div>
      )}

      {lockPhase === 'denied' && (
        <div style={{ animation: 'text-appear 0.5s ease' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#dc2626', fontWeight: 900, marginBottom: 10, animation: 'denied-pulse 2s ease infinite' }}>
            🚫 Authorised Users Only
          </div>
          <div style={{ color: 'var(--text-mid)', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 320 }}>
            This area is restricted to <strong>Super Admins</strong>.<br />
            You are not a Super Admin.
          </div>
          <div style={{ marginTop: 20, padding: '10px 20px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fecaca', display: 'inline-block', fontSize: '0.78rem', color: '#991b1b', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            CLEARANCE LEVEL: INSUFFICIENT
          </div>
        </div>
      )}
    </div>
  )

  const filtered = logs.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    const adminName = (l.admin?.full_name || l.admin?.display_name || l.admin?.email || '').toLowerCase()
    const detail = (l.detail || '').toLowerCase()
    return adminName.includes(q) || detail.includes(q) || l.action.includes(q)
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--brand-deep)', margin: '0 0 4px' }}>
          📋 Admin Audit Log
        </h1>
        <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.86rem' }}>
          All admin actions — visible to Super Admins only. Records are kept forever.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => { setCategory(c.value); setPage(0) }}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', background: category === c.value ? 'var(--brand-mid)' : '#f1f5f9', color: category === c.value ? 'white' : 'var(--text-mid)', transition: 'all 0.15s' }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '0.9rem' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by admin, action or detail..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 20, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: 'white', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      {/* Log table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading logs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 14, padding: '48px 20px', textAlign: 'center', color: 'var(--text-light)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 10 }}>📋</div>
          No log entries found.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--brand-mist)', borderBottom: '1px solid var(--brand-pale)' }}>
                  {['Time', 'Admin', 'Action', 'Detail'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-mid)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => {
                  const c = ACTION_COLORS[log.action] || { bg: '#f8fafc', color: '#64748b' }
                  const adminName = log.admin?.full_name || log.admin?.display_name || log.admin?.email || 'Unknown'
                  return (
                    <tr key={log.id}
                      style={{ borderBottom: i < filtered.length-1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafcff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{adminName}</div>
                        {log.admin?.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{log.admin.email}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                          {ACTION_ICONS[log.action] || '📝'} {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.86rem', color: 'var(--text-mid)', maxWidth: 480 }}>
                        {log.detail || '—'}
                        {log.target_name && (
                          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            → {log.target_name}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
        <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
          style={{ padding: '8px 20px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: page === 0 ? '#f1f5f9' : 'white', color: page === 0 ? '#9ca3af' : 'var(--text-mid)', cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.84rem' }}>
          ← Previous
        </button>
        <span style={{ padding: '8px 16px', fontSize: '0.84rem', color: 'var(--text-light)' }}>Page {page + 1}</span>
        <button onClick={() => setPage(p => p+1)} disabled={logs.length < PAGE_SIZE}
          style={{ padding: '8px 20px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: logs.length < PAGE_SIZE ? '#f1f5f9' : 'white', color: logs.length < PAGE_SIZE ? '#9ca3af' : 'var(--text-mid)', cursor: logs.length < PAGE_SIZE ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.84rem' }}>
          Next →
        </button>
      </div>
    </div>
  )
}
