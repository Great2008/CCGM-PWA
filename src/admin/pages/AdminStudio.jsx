import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabaseAdmin'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const CATEGORIES = ['Sermons', 'Worship & Praise', 'Choir', 'Bible Study', 'Events & Programs', 'Testimonies', 'Devotionals']
const EMPTY = { type: 'video', title: '', media_url: '', thumbnail_url: '', category: 'Sermons', series: '', description: '', date: new Date().toISOString().split('T')[0], featured: false, published: true, status: 'published' }

export default function AdminStudio() {
  const { showToast } = useAdmin()
  const [items, setItems]       = useState([])
  const [pending, setPending]   = useState([])
  const [form, setForm]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('all')   // all | pending
  const [delId, setDelId]       = useState(null)

  const load = async () => {
    const [{ data: all }, { data: pend }] = await Promise.all([
      supabaseAdmin.from('studio_items').select('*').eq('status', 'published').order('date', { ascending: false }),
      supabaseAdmin.from('studio_items').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setItems(all || [])
    setPending(pend || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const F = k => ({ value: form?.[k] ?? '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const payload = { ...rest, featured: !!form.featured, published: !!form.published }
    const { error } = id
      ? await supabaseAdmin.from('studio_items').update(payload).eq('id', id)
      : await supabaseAdmin.from('studio_items').insert(payload)
    if (!error) { showToast(id ? 'Item updated!' : 'Item added!'); setForm(null); load() }
    else showToast(error.message, 'error')
    setSaving(false)
  }

  const approve = async (item) => {
    const { error } = await supabaseAdmin.from('studio_items').update({ status: 'published', published: true }).eq('id', item.id)
    if (!error) { showToast(`"${item.title}" approved and published!`); load() }
    else showToast(error.message, 'error')
  }

  const reject = async (item) => {
    if (!window.confirm(`Reject "${item.title}"? This cannot be undone.`)) return
    const { error } = await supabaseAdmin.from('studio_items').update({ status: 'rejected', published: false }).eq('id', item.id)
    if (!error) { showToast(`"${item.title}" rejected.`, 'error'); load() }
    else showToast(error.message, 'error')
  }

  const handleDelete = async () => {
    setSaving(true)
    const { error } = await supabaseAdmin.from('studio_items').delete().eq('id', delId)
    if (!error) { showToast('Deleted'); load() }
    else showToast(error.message, 'error')
    setSaving(false); setDelId(null)
  }

  const toggleFeatured = async (item) => {
    // Unfeature all, then feature this one (only one featured at a time)
    await supabaseAdmin.from('studio_items').update({ featured: false }).eq('featured', true)
    if (!item.featured) {
      await supabaseAdmin.from('studio_items').update({ featured: true }).eq('id', item.id)
      showToast(`"${item.title}" is now featured!`)
    } else {
      showToast('Featured removed.')
    }
    load()
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.88rem', background: 'white', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: 5 }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading Studio...</div>

  // ── FORM VIEW ──
  if (form !== null) return (
    <div>
      <PageHeader icon="🎬" title={form.id ? 'Edit Item' : 'New Studio Item'} />
      <AdminCard style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Type */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Content Type *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['video','music'].map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, border: `2px solid ${form.type === t ? 'var(--brand-light)' : '#e2e8f0'}`, background: form.type === t ? 'var(--brand-pale)' : 'white', color: form.type === t ? 'var(--brand-light)' : 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', textTransform: 'capitalize' }}>
                    {t === 'video' ? '🎬 Video' : '🎵 Music'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Title *</label><input {...F('title')} required style={inp} placeholder="e.g. Amazing Grace — Sunday Choir" /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>{form.type === 'video' ? 'YouTube / Video URL *' : 'Audio URL (MP3) *'}</label><input {...F('media_url')} required style={inp} placeholder={form.type === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...mp3'} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Thumbnail URL</label><input {...F('thumbnail_url')} style={inp} placeholder="Leave blank to auto-generate from YouTube" /></div>

            <div>
              <label style={lbl}>Category *</label>
              <select {...F('category')} required style={{ ...inp, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Series / Album</label><input {...F('series')} style={inp} placeholder="e.g. Sunday Choir Vol. 1" /></div>
            <div><label style={lbl}>Date *</label><input type="date" {...F('date')} required style={inp} /></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                <input type="checkbox" checked={!!form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
                Published
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                <input type="checkbox" checked={!!form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
                ★ Featured
              </label>
            </div>

            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description</label><textarea {...F('description')} rows={4} style={{ ...inp, resize: 'vertical' }} /></div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</button>
            <button type="button" className="btn btn-outline-blue" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      </AdminCard>
    </div>
  )

  // ── MAIN VIEW ──
  return (
    <div>
      <PageHeader icon="🎬" title="CCG Studio"
        subtitle={`${items.length} published · ${pending.length} pending`}
        action={<button className="btn btn-blue" onClick={() => setForm({ ...EMPTY })}>+ Add Item</button>} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['all', `All Published (${items.length})`], ['pending', `⏳ Pending Approval ${pending.length > 0 ? `(${pending.length})` : ''}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 18px', borderRadius: 8, border: `1.5px solid ${tab === id ? 'var(--brand-light)' : '#e2e8f0'}`,
            background: tab === id ? 'var(--brand-pale)' : 'white', color: tab === id ? 'var(--brand-light)' : 'var(--text-mid)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem',
            ...(id === 'pending' && pending.length > 0 ? { borderColor: '#f59e0b', background: '#fffbf0', color: '#92400e' } : {}),
          }}>{label}</button>
        ))}
      </div>

      {/* ── PENDING TAB ── */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.length === 0 ? (
            <AdminCard><div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>✅ No pending submissions.</div></AdminCard>
          ) : pending.map(item => (
            <AdminCard key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', background: 'var(--brand-pale)', color: 'var(--brand-light)', padding: '2px 10px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>{item.type}</span>
                  <span style={{ fontSize: '0.68rem', background: '#fffbf0', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>⏳ Pending</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.95rem', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', marginBottom: 4 }}>{item.category}{item.series ? ` · ${item.series}` : ''}</div>
                {item.media_url && (
                  <a href={item.media_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--brand-light)', wordBreak: 'break-all' }}>{item.media_url}</a>
                )}
                {item.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 6, lineHeight: 1.6 }}>{item.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => approve(item)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem' }}>✓ Approve</button>
                <button onClick={() => reject(item)} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem' }}>✗ Reject</button>
                <button onClick={() => setForm({ ...item })} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>✏️</button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* ── ALL PUBLISHED TAB ── */}
      {tab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 ? (
            <AdminCard><div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>No content yet. Add your first item!</div></AdminCard>
          ) : items.map(item => (
            <AdminCard key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', background: item.type === 'video' ? '#fef2f2' : '#f0fdf4', color: item.type === 'video' ? '#dc2626' : '#16a34a', padding: '2px 10px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>
                    {item.type === 'video' ? '▶ Video' : '♪ Music'}
                  </span>
                  {item.featured && <span style={{ fontSize: '0.68rem', background: '#fffbf0', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>★ Featured</span>}
                  {!item.published && <span style={{ fontSize: '0.68rem', background: '#f8fafc', color: 'var(--text-light)', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>Draft</span>}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{item.category}{item.series ? ` · ${item.series}` : ''} · {item.date}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                <button onClick={() => toggleFeatured(item)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${item.featured ? '#f59e0b' : '#e2e8f0'}`, background: item.featured ? '#fffbf0' : 'white', color: item.featured ? '#92400e' : 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700 }}>
                  {item.featured ? '★ Unfeature' : '☆ Feature'}
                </button>
                <button onClick={() => setForm({ ...item })} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>✏️ Edit</button>
                <button onClick={() => setDelId(item.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>🗑</button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗑</div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', marginBottom: 10 }}>Delete this item?</h3>
            <p style={{ color: 'var(--text-mid)', fontSize: '0.88rem', marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={handleDelete} disabled={saving} style={{ padding: '10px 24px', borderRadius: 30, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700 }}>{saving ? '...' : 'Delete'}</button>
              <button onClick={() => setDelId(null)} style={{ padding: '10px 24px', borderRadius: 30, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-mid)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
