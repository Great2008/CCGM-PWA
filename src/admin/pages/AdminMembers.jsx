import { useState } from 'react'
import { useAdmin } from '../AdminApp'
import { useTable } from '../useSupabaseAdmin'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { Confirm } from '../components/CrudShell'

// ── App roles (permissions) ────────────────────────────────────────────────
const APP_ROLES = [
  { value: 'member',      label: 'Member',      color: '#2563eb', bg: '#eff6ff', desc: 'Standard member experience' },
  { value: 'moderator',   label: 'Moderator',   color: '#059669', bg: '#f0fdf4', desc: 'Timeline & Prayer Wall moderation' },
  { value: 'admin',       label: 'Admin',       color: '#7c3aed', bg: '#f5f3ff', desc: 'Full admin panel access' },
  { value: 'super_admin', label: 'Super Admin', color: '#dc2626', bg: '#fff1f2', desc: 'All access including role management' },
]
// ── Church titles (display only, no permissions) ───────────────────────────
const CHURCH_TITLES = ['', 'Apostle', 'Prophet', 'Evangelist', 'Pastor', 'Elder', 'Deacon', 'Deaconess']
const ROLE_COLORS = Object.fromEntries(APP_ROLES.map(r => [r.value, r.color]))

const SUSPEND_REASONS = [
  'Violation of community guidelines',
  'Posting inappropriate content',
  'Harassment of other members',
  'Spreading misinformation',
  'Spam or repeated off-topic posts',
  'Other (specify below)',
]

const SUSPEND_PERIODS = [
  { label: '1 Month',     months: 1  },
  { label: '2 Months',    months: 2  },
  { label: '3 Months',    months: 3  },
  { label: '6 Months',    months: 6  },
  { label: '1 Year',      months: 12 },
  { label: 'Indefinitely', months: null },
]

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d.toISOString()
}

export default function AdminMembers() {
  const { showToast, isSuperAdmin } = useAdmin()
  const { rows: members, loading, update, reload } = useTable('profiles', { order: 'created_at', asc: false })
  const [search, setSearch]   = useState('')
  const [tab, setTab]         = useState('active') // 'active' | 'suspended'
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]   = useState(false)

  // Suspend modal
  const [showSuspend, setShowSuspend]     = useState(false)
  const [suspendReason, setSuspendReason] = useState(SUSPEND_REASONS[0])
  const [suspendCustom, setSuspendCustom] = useState('')
  const [suspendNote, setSuspendNote]     = useState('')
  const [suspendPeriod, setSuspendPeriod] = useState(SUSPEND_PERIODS[0])

  // Unsuspend confirm
  const [showUnsuspend, setShowUnsuspend] = useState(false)

  const activeMembers = members.filter(m => !m.suspended)
  const suspendedMembers = members.filter(m => m.suspended === true)

  const list = (tab === 'active' ? activeMembers : suspendedMembers).filter(m => {
    const q = search.toLowerCase()
    return !q || (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  })

  const setRole = async (id, role) => {
    setSaving(true)
    try {
      await update(id, { role })
      const label = APP_ROLES.find(r => r.value === role)?.label || role
      showToast('App role updated to ' + label)
      setSelected(s => ({ ...s, role }))
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const setChurchTitle = async (id, church_title) => {
    setSaving(true)
    try {
      await update(id, { church_title })
      showToast(church_title ? 'Church title set to ' + church_title : 'Church title cleared')
      setSelected(s => ({ ...s, church_title }))
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const openSuspend = () => {
    setSuspendReason(SUSPEND_REASONS[0])
    setSuspendCustom(''); setSuspendNote('')
    setSuspendPeriod(SUSPEND_PERIODS[0])
    setShowSuspend(true)
  }

  const confirmSuspend = async () => {
    const baseReason = suspendReason === 'Other (specify below)'
      ? (suspendCustom.trim() || 'Violation of community guidelines')
      : suspendReason
    const fullReason = suspendNote.trim() ? baseReason + ' — ' + suspendNote.trim() : baseReason
    const now = new Date().toISOString()
    const expiresAt = suspendPeriod.months ? addMonths(now, suspendPeriod.months) : null

    setSaving(true)
    try {
      await update(selected.id, {
        suspended: true,
        suspended_at: now,
        suspension_reason: fullReason,
        suspension_expires_at: expiresAt,
      })

      // In-app notification
      const periodLabel = suspendPeriod.months ? suspendPeriod.label.toLowerCase() : 'indefinitely'
      await supabaseAdmin.from('notification_logs').insert({
        title: '🚫 Account Suspended',
        body: 'Your account has been suspended for ' + periodLabel + '. Reason: ' + fullReason + '. Contact us at /contact if you have questions.',
        url: '/contact',
        tag: 'suspension',
        recipients: 1,
        delivered: 1,
        failed: 0,
        sent_at: now,
        user_id: selected.id,
      })

      // Email notification
      const untilStr = expiresAt
        ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null
      await supabaseAdmin.functions.invoke('send-suspension-email', {
        body: {
          type: 'suspension',
          email: selected.email,
          name: selected.full_name || selected.display_name || 'Member',
          reason: fullReason,
          period: suspendPeriod.months ? suspendPeriod.label : 'Indefinite',
          until: untilStr,
        }
      })

      showToast((selected.full_name || 'Member') + ' suspended for ' + (suspendPeriod.months ? suspendPeriod.label : 'indefinitely') + '.')
      setShowSuspend(false)
      setSelected(s => ({ ...s, suspended: true, suspension_reason: fullReason, suspension_expires_at: expiresAt }))
      reload()
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const confirmUnsuspend = async () => {
    setSaving(true)
    try {
      await update(selected.id, {
        suspended: false,
        suspended_at: null,
        suspension_reason: null,
        suspension_expires_at: null,
      })
      await supabaseAdmin.from('notification_logs').insert({
        title: '✅ Account Reinstated',
        body: 'Your account suspension has been lifted. Welcome back to CCG World!',
        url: '/timeline',
        tag: 'reinstatement',
        recipients: 1,
        delivered: 1,
        failed: 0,
        sent_at: new Date().toISOString(),
        user_id: selected.id,
      })
      // Email notification
      await supabaseAdmin.functions.invoke('send-suspension-email', {
        body: {
          type: 'reinstatement',
          email: selected.email,
          name: selected.full_name || selected.display_name || 'Member',
        }
      })

      showToast((selected.full_name || 'Member') + ' has been reinstated.')
      setShowUnsuspend(false)
      setSelected(null)
      reload()
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading members...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.7rem', margin: '0 0 4px' }}>👥 Members</h1>
          <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.86rem' }}>{members.length} total · {suspendedMembers.length} suspended</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setTab('active'); setSelected(null) }}
          style={{ padding: '8px 22px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.84rem', background: tab === 'active' ? 'var(--brand-mid)' : '#f1f5f9', color: tab === 'active' ? 'white' : 'var(--text-mid)' }}>
          ✅ Active ({activeMembers.length})
        </button>
        <button onClick={() => { setTab('suspended'); setSelected(null) }}
          style={{ padding: '8px 22px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.84rem', background: tab === 'suspended' ? '#dc2626' : '#f1f5f9', color: tab === 'suspended' ? 'white' : 'var(--text-mid)' }}>
          🚫 Suspended ({suspendedMembers.length})
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 400 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 30, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Two-pane */}
      <div className="members-pane" style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) min(340px,38%)' : '1fr', gap: 20, alignItems: 'start' }}>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.length === 0 && (
            <div style={{ background: 'white', borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
              {tab === 'suspended' ? '🎉 No suspended members' : 'No members found.'}
            </div>
          )}
          {list.map(m => (
            <div key={m.id} onClick={() => setSelected(m)}
              style={{ background: 'white', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1.5px solid ' + (selected?.id === m.id ? 'var(--brand-light)' : 'transparent'), transition: 'border-color 0.15s' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0 }}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> : initials(m)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name || m.display_name || 'Unknown'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                {m.suspended && m.suspension_expires_at && (
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 2 }}>Until {fmtDate(m.suspension_expires_at)}</div>
                )}
                {m.suspended && !m.suspension_expires_at && (
                  <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 2 }}>Indefinite suspension</div>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                {m.suspended ? (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>🚫 Suspended</span>
                ) : (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: (ROLE_COLORS[m.role] || '#94a3b8') + '20', color: ROLE_COLORS[m.role] || '#94a3b8' }}>
                    {APP_ROLES.find(r=>r.value===m.role)?.label || 'Member'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail pane */}
        {selected && (
          <div style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: selected.suspended ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: '24px 20px', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, color: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.6rem', margin: '0 auto 12px' }}>
                  {selected.avatar_url ? <img src={selected.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} /> : initials(selected)}
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>{selected.full_name || selected.display_name || 'Unknown'}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginTop: 2 }}>{selected.email}</div>
                {selected.suspended && (
                  <div style={{ marginTop: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '6px 12px', display: 'inline-block', fontSize: '0.78rem', color: 'white', fontWeight: 700 }}>
                    🚫 SUSPENDED
                  </div>
                )}
              </div>

              <div style={{ padding: '20px' }}>
                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18, fontSize: '0.8rem' }}>
                  {[
                    ['Joined', fmtDate(selected.created_at)],
                    ['Role', selected.role || 'member'],
                    ['Branch', selected.church_branch || '—'],
                    ['Location', selected.location || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ color: 'var(--text-light)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
                      <div style={{ color: 'var(--text-dark)', fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Suspension info */}
                {selected.suspended && (
                  <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.8rem', marginBottom: 4 }}>Suspension Details</div>
                    <div style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                      <strong>Reason:</strong> {selected.suspension_reason || '—'}<br />
                      <strong>Since:</strong> {fmtDate(selected.suspended_at)}<br />
                      <strong>Until:</strong> {selected.suspension_expires_at ? fmtDate(selected.suspension_expires_at) : 'Indefinite'}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* ── App Role (permissions) ── */}
                  {isSuperAdmin && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>App Role</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {APP_ROLES.map(r => (
                          <button
                            key={r.value}
                            onClick={() => setRole(selected.id, r.value)}
                            disabled={saving || selected.role === r.value}
                            style={{
                              padding: '9px 14px', borderRadius: 10, border: '1.5px solid',
                              borderColor: selected.role === r.value ? r.color : '#e2e8f0',
                              background: selected.role === r.value ? r.bg : 'white',
                              color: selected.role === r.value ? r.color : 'var(--text-mid)',
                              fontWeight: selected.role === r.value ? 700 : 500,
                              cursor: selected.role === r.value ? 'default' : 'pointer',
                              fontFamily: 'var(--font-body)', fontSize: '0.84rem',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <span>{r.label} {selected.role === r.value ? '✓' : ''}</span>
                            <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>{r.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isSuperAdmin && !selected.suspended && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                      Role: <strong style={{ color: ROLE_COLORS[selected.role] || '#94a3b8' }}>{APP_ROLES.find(r=>r.value===selected.role)?.label || 'Member'}</strong>
                      <br/><span style={{ fontSize: '0.72rem' }}>Only Super Admins can change roles.</span>
                    </div>
                  )}

                  {/* ── Church Title (display only) ── */}
                  {!selected.suspended && (
                    <div style={{ marginTop: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Church Title</div>
                      <select
                        value={selected.church_title || ''}
                        onChange={e => setChurchTitle(selected.id, e.target.value)}
                        disabled={saving}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontFamily: 'var(--font-body)', background: 'white', color: 'var(--text-dark)', cursor: 'pointer', outline: 'none' }}
                      >
                        {CHURCH_TITLES.map(t => (
                          <option key={t} value={t}>{t || '— None —'}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Display badge only — no permissions attached.</div>
                    </div>
                  )}

                  {/* ── Suspend / Reinstate ── */}
                  {!selected.suspended ? (
                    <button onClick={openSuspend}
                      style={{ padding: '10px', borderRadius: 10, border: '1.5px solid #fecaca', background: '#fff5f5', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem', marginTop: 4 }}>
                      🚫 Suspend Member
                    </button>
                  ) : (
                    <button onClick={() => setShowUnsuspend(true)}
                      style={{ padding: '10px', borderRadius: 10, border: '1.5px solid var(--brand-light)', background: 'var(--brand-pale)', color: 'var(--brand-mid)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                      ✅ Reinstate Member
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      {showSuspend && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 18, padding: '28px', width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: '#dc2626', fontSize: '1.2rem', margin: '0 0 6px' }}>🚫 Suspend Member</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.84rem', margin: '0 0 22px' }}>
              Suspending <strong>{selected?.full_name || selected?.display_name}</strong>. They will see a suspension notice and cannot interact until reinstated.
            </p>

            {/* Period */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Suspension Period</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUSPEND_PERIODS.map(p => (
                  <button key={p.label} onClick={() => setSuspendPeriod(p)}
                    style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid', borderColor: suspendPeriod.label === p.label ? '#dc2626' : '#e2e8f0', background: suspendPeriod.label === p.label ? '#fee2e2' : 'white', color: suspendPeriod.label === p.label ? '#dc2626' : 'var(--text-mid)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Reason *</label>
              {SUSPEND_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                  <input type="radio" name="reason" checked={suspendReason === r} onChange={() => setSuspendReason(r)} style={{ accentColor: '#dc2626' }} />
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-dark)' }}>{r}</span>
                </label>
              ))}
            </div>

            {/* Custom reason */}
            {suspendReason === 'Other (specify below)' && (
              <div style={{ marginBottom: 14 }}>
                <input value={suspendCustom} onChange={e => setSuspendCustom(e.target.value)} placeholder="Enter reason..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fecaca', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* Additional note */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Additional Note (optional)</label>
              <textarea value={suspendNote} onChange={e => setSuspendNote(e.target.value)} rows={3} placeholder="Any extra context for the member..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmSuspend} disabled={saving}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: saving ? '#9ca3af' : '#dc2626', color: 'white', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-body)', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Suspending…' : 'Confirm Suspension'}
              </button>
              <button onClick={() => setShowSuspend(false)}
                style={{ padding: '11px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: 'var(--text-mid)', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reinstate confirm */}
      {showUnsuspend && (
        <Confirm
          message={'Reinstate ' + (selected?.full_name || 'this member') + '? They will regain full access immediately and receive a notification.'}
          onConfirm={confirmUnsuspend}
          onCancel={() => setShowUnsuspend(false)}
          loading={saving}
        />
      )}

      <style>{`
        @media(max-width:860px){
          .members-pane { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
