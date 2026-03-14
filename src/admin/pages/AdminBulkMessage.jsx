import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabase from '../../lib/supabaseAdmin'

export default function AdminBulkMessage() {
  const { showToast } = useAdmin()

  const [members, setMembers]   = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)

  // Targeting
  const [targetType, setTargetType] = useState('all') // all | role | branch | specific
  const [targetRole, setTargetRole] = useState('member')
  const [targetBranch, setTargetBranch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [searchQ, setSearchQ] = useState('')

  // Message
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [url, setUrl]     = useState('')

  // Result
  const [result, setResult] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, full_name, display_name, email, role, church_branch, suspended').eq('suspended', false).order('full_name'),
      supabase.from('church_branches').select('name').eq('active', true).order('name'),
    ]).then(([{ data: m }, { data: b }]) => {
      setMembers(m || [])
      setBranches(b || [])
      setLoading(false)
    })
  }, [])

  const recipients = (() => {
    if (targetType === 'all') return members
    if (targetType === 'role') return members.filter(m => m.role === targetRole)
    if (targetType === 'branch') return members.filter(m => m.church_branch === targetBranch)
    if (targetType === 'specific') return members.filter(m => selectedIds.includes(m.id))
    return []
  })()

  const filteredForPicker = members.filter(m => {
    const q = searchQ.toLowerCase()
    return !q || (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  })

  const toggleId = id => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const displayName = m => m.full_name || m.display_name || m.email || 'Unknown'

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { showToast('Title and message are required.', 'error'); return }
    if (recipients.length === 0) { showToast('No recipients selected.', 'error'); return }
    if (!window.confirm('Send to ' + recipients.length + ' member(s)?')) return

    setSending(true)
    setResult(null)

    try {
      // Insert notification log for each recipient
      const rows = recipients.map(m => ({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
        tag: 'bulk_message',
        recipients: 1,
        delivered: 1,
        failed: 0,
        sent_at: new Date().toISOString(),
        user_id: m.id,
      }))

      // Insert in batches of 50
      let delivered = 0, failed = 0
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        const { error } = await supabase.from('notification_logs').insert(batch)
        if (error) failed += batch.length
        else delivered += batch.length
      }

      setResult({ delivered, failed, total: recipients.length })
      showToast('Message sent to ' + delivered + ' members!')

      // Reset form
      setTitle('')
      setBody('')
      setUrl('')
      setSelectedIds([])
    } catch (e) {
      showToast(e.message, 'error')
    }
    setSending(false)
  }

  const TARGET_TYPES = [
    { key: 'all',      label: '👥 All Members',      desc: members.length + ' members' },
    { key: 'role',     label: '🛡 By Role',           desc: 'Target by app role (member/moderator/admin)' },
    { key: 'branch',   label: '⛪ By Branch',         desc: 'Target a specific branch' },
    { key: 'specific', label: '🎯 Specific Members',  desc: 'Hand-pick recipients' },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--brand-deep)', margin: '0 0 4px' }}>📣 Bulk Messaging</h1>
        <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.86rem' }}>Send in-app notifications to members by role, branch, or individually.</p>
      </div>

      <div className="bulk-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* Left — targeting + message */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Target selector */}
          <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1rem', margin: '0 0 16px' }}>1. Choose Recipients</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {TARGET_TYPES.map(t => (
                <button key={t.key} onClick={() => setTargetType(t.key)}
                  style={{ padding: '12px 14px', borderRadius: 12, border: '2px solid', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s', borderColor: targetType === t.key ? 'var(--brand-base)' : '#e2e8f0', background: targetType === t.key ? 'var(--brand-pale)' : 'white' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: targetType === t.key ? 'var(--brand-mid)' : 'var(--text-dark)', marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>{t.desc}</div>
                </button>
              ))}
            </div>

            {/* Role picker */}
            {targetType === 'role' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { value: 'member',      label: '👤 Members' },
                  { value: 'moderator',   label: '🔰 Moderators' },
                  { value: 'admin',       label: '🛡 Admins' },
                  { value: 'super_admin', label: '⭐ Super Admins' },
                ].map(r => (
                  <button key={r.value} onClick={() => setTargetRole(r.value)}
                    style={{ flex: 1, minWidth: 120, padding: '10px', borderRadius: 10, border: '1.5px solid', borderColor: targetRole === r.value ? 'var(--brand-base)' : '#e2e8f0', background: targetRole === r.value ? 'var(--brand-pale)' : 'white', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'var(--font-body)', color: targetRole === r.value ? 'var(--brand-mid)' : 'var(--text-mid)' }}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Branch picker */}
            {targetType === 'branch' && (
              <select value={targetBranch} onChange={e => setTargetBranch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none' }}>
                <option value="">Select a branch…</option>
                {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            )}

            {/* Specific member picker */}
            {targetType === 'specific' && (
              <div>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search members…"
                  style={{ width: '100%', padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  {filteredForPicker.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selectedIds.includes(m.id) ? 'var(--brand-pale)' : 'white' }}>
                      <input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggleId(m.id)} style={{ accentColor: 'var(--brand-base)', width: 16, height: 16 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-dark)' }}>{displayName(m)}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>{m.church_branch || 'No branch'}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedIds.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--brand-mid)', fontWeight: 700 }}>
                    {selectedIds.length} member{selectedIds.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message composer */}
          <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1rem', margin: '0 0 16px' }}>2. Compose Message</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Important Announcement"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'var(--brand-base)' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Message *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Your message to members…"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'var(--brand-base)' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Link (optional)</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="/events or /live"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'var(--brand-base)' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }} />
            </div>
            <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim() || recipients.length === 0}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: sending || !title.trim() || !body.trim() || recipients.length === 0 ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-body)', cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? '⏳ Sending…' : '📣 Send to ' + recipients.length + ' Member' + (recipients.length !== 1 ? 's' : '')}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div style={{ background: result.failed === 0 ? '#f0fdf4' : '#fffbeb', border: '1.5px solid ' + (result.failed === 0 ? '#bbf7d0' : '#fde68a'), borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, color: result.failed === 0 ? '#15803d' : '#92400e', marginBottom: 4 }}>
                {result.failed === 0 ? '✅ Message sent successfully!' : '⚠️ Partially sent'}
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-mid)' }}>
                Delivered to {result.delivered} of {result.total} members
                {result.failed > 0 && ' (' + result.failed + ' failed)'}
              </div>
            </div>
          )}
        </div>

        {/* Right — recipient preview */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', position: 'sticky', top: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1rem', margin: 0 }}>Recipients Preview</h3>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'var(--brand-pale)', color: 'var(--brand-mid)' }}>
              {recipients.length} members
            </span>
          </div>
          {recipients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-light)', fontSize: '0.88rem' }}>
              {targetType === 'branch' && !targetBranch ? 'Select a branch to see recipients' :
               targetType === 'specific' && selectedIds.length === 0 ? 'Select members to see recipients' :
               'No matching members found'}
            </div>
          ) : (
            <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipients.slice(0, 50).map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#f8fafc' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.8rem', flexShrink: 0 }}>
                    {(m.full_name || m.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(m)}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>{m.church_branch || 'No branch'}</div>
                  </div>
                </div>
              ))}
              {recipients.length > 50 && (
                <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                  + {recipients.length - 50} more members
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @media(max-width: 860px) {
          .bulk-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
