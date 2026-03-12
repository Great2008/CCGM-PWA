import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabase from '../../lib/supabaseAdmin'

const EMPTY = { name: '', location: '', country: '', active: true }

export default function AdminBranches() {
  const { showToast } = useAdmin()
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null) // branch id being edited
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [sugTab, setSugTab] = useState('branches') // 'branches' | 'suggestions'

  const loadSuggestions = async () => {
    const { data } = await supabase.from('branch_suggestions')
      .select('*, profiles(display_name, full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
  }

  const approveSuggestion = async (sug) => {
    // Add as new branch
    await supabase.from('church_branches').insert({ name: sug.branch_name, location: sug.city || '', country: '', active: true })
    // Update user's profile: set proper branch name + clear unverified flag
    await supabase.from('profiles').update({ church_branch: sug.branch_name, unverified_branch: false }).eq('id', sug.user_id)
    // Mark suggestion resolved
    await supabase.from('branch_suggestions').update({ status: 'approved' }).eq('id', sug.id)
    showToast('Branch approved and added!')
    loadSuggestions(); load()
  }

  const dismissSuggestion = async (id) => {
    await supabase.from('branch_suggestions').update({ status: 'dismissed' }).eq('id', id)
    showToast('Suggestion dismissed.')
    loadSuggestions()
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('church_branches').select('*').order('name')
    setBranches(data || [])
    setLoading(false)
  }

  useEffect(() => { load(); loadSuggestions() }, [])

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true) }

  const openEdit = (b) => {
    setForm({ name: b.name, location: b.location || '', country: b.country || '', active: b.active !== false })
    setEditing(b.id)
    setShowForm(true)
  }

  const cancel = () => { setShowForm(false); setEditing(null); setForm(EMPTY) }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Branch name is required.', 'error'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('church_branches').update(form).eq('id', editing)
      if (error) showToast('Failed to update branch.', 'error')
      else { showToast('Branch updated!'); cancel(); load() }
    } else {
      const { error } = await supabase.from('church_branches').insert(form)
      if (error) showToast('Failed to add branch.', 'error')
      else { showToast('Branch added!'); cancel(); load() }
    }
    setSaving(false)
  }

  const toggleActive = async (b) => {
    await supabase.from('church_branches').update({ active: !b.active }).eq('id', b.id)
    load()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this branch? Members who selected it will keep their saved value.')) return
    await supabase.from('church_branches').delete().eq('id', id)
    showToast('Branch deleted.')
    load()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--brand-deep)', marginBottom: 4 }}>⛪ Church Branches</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Manage branches available in the member profile dropdown.</p>
        </div>
        {sugTab === 'branches' && (
          <button onClick={openNew}
            style={{ padding: '10px 22px', borderRadius: 40, background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.86rem', fontFamily: 'var(--font-body)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 7 }}
          >+ Add Branch</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'branches', label: '⛪ All Branches' },
          { key: 'suggestions', label: `📬 Suggestions${suggestions.length ? ` (${suggestions.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setSugTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.84rem',
              background: sugTab === t.key ? 'var(--brand-mid)' : '#f1f5f9',
              color: sugTab === t.key ? 'white' : 'var(--text-mid)',
            }}>{t.label}</button>
        ))}
      </div>

      {sugTab === 'suggestions' && (
        <div>
          {suggestions.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
              <div style={{ color: 'var(--text-light)' }}>No pending branch suggestions</div>
            </div>
          ) : suggestions.map(sug => (
            <div key={sug.id} style={{ background: 'white', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #fef3c7', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1rem', marginBottom: 3 }}>🏛 {sug.branch_name}</div>
                  {sug.city && <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem', marginBottom: 3 }}>📍 {sug.city}</div>}
                  <div style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>
                    Submitted by: <strong>{sug.profiles?.display_name || sug.profiles?.full_name || 'Unknown'}</strong>
                    {sug.profiles?.email && ` (${sug.profiles.email})`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => approveSuggestion(sug)}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--brand-pale)', color: 'var(--brand-mid)', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    ✅ Add Branch
                  </button>
                  <button onClick={() => dismissSuggestion(sug.id)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: 'transparent', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sugTab === 'branches' && <>
      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 16, padding: '24px 28px', boxShadow: 'var(--shadow-md)', border: '1.5px solid var(--brand-pale)', marginBottom: 28 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.1rem', marginBottom: 20 }}>
            {editing ? '✏️ Edit Branch' : '➕ New Branch'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>
            <AdminField label="Branch Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Accra Central" />
            <AdminField label="City / Location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Accra" />
            <AdminField label="Country" value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} placeholder="e.g. Ghana" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', paddingTop: 6 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--brand-base)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-dark)', fontWeight: 600 }}>Active (shows in dropdown)</span>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '10px 26px', borderRadius: 40, background: saving ? '#9ca3af' : 'var(--brand-mid)', color: 'white', fontWeight: 700, fontSize: '0.86rem', fontFamily: 'var(--font-body)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
            >{saving ? 'Saving…' : editing ? 'Update Branch' : 'Add Branch'}</button>
            <button
              onClick={cancel}
              style={{ padding: '10px 22px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, fontSize: '0.86rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Branches table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading branches…</div>
      ) : branches.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⛪</div>
          <div style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>No branches yet. Add your first one!</div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--brand-mist)', borderBottom: '1px solid var(--brand-pale)' }}>
                  {['Branch Name', 'Location', 'Country', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-mid)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: i < branches.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafcff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem' }}>{b.name}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-mid)', fontSize: '0.88rem' }}>{b.location || '—'}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-mid)', fontSize: '0.88rem' }}>{b.country || '—'}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        onClick={() => toggleActive(b)}
                        style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', background: b.active !== false ? 'var(--brand-pale)' : '#f3f4f6', color: b.active !== false ? 'var(--brand-mid)' : '#9ca3af', fontFamily: 'var(--font-body)' }}
                      >{b.active !== false ? '✅ Active' : '⏸ Inactive'}</button>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => openEdit(b)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', color: 'var(--brand-mid)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                        >Edit</button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #fecaca', background: 'transparent', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
    </div>
  )
}

function AdminField({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text-dark)', transition: 'border-color 0.2s' }}
        onFocus={e => e.target.style.borderColor = 'var(--brand-base)'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      />
    </div>
  )
}
