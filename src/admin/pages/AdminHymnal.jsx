import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { getAll, insert, update, remove } from '../supabase'

const EMPTY = {
  title: '', author: '', category: '', audio_url: '',
  chorus: '', verses: '', sort_order: 0, published: true,
}

// Convert textarea input (verse blocks separated by blank lines) to JSON array
function parseVerses(raw) {
  if (!raw?.trim()) return []
  return raw.trim().split(/\n\s*\n/).map((block, i) => ({
    number: i + 1,
    text: block.trim(),
  }))
}

// Convert JSON array back to textarea format
function versesToText(verses) {
  if (!verses) return ''
  try {
    const arr = Array.isArray(verses) ? verses : JSON.parse(verses)
    return arr.map(v => v.text).join('\n\n')
  } catch { return '' }
}

export default function AdminHymnal() {
  const { showToast, logAction } = useAdmin()
  const [items, setItems]   = useState([])
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId]   = useState(null)
  const [versesText, setVersesText] = useState('')

  const load = () => getAll('hymns', 'sort_order').then(({ data }) => { setItems(data); setLoading(false) })
  useEffect(() => { load() }, [])

  const openForm = (hymn = null) => {
    const item = hymn ? { ...hymn } : { ...EMPTY }
    setForm(item)
    setVersesText(hymn ? versesToText(hymn.verses) : '')
  }

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const payload = {
      ...rest,
      verses: JSON.stringify(parseVerses(versesText)),
      published: form.published ?? true,
    }
    const { error } = id ? await update('hymns', id, payload) : await insert('hymns', payload)
    if (!error) {
      showToast(id ? 'Hymn updated!' : 'Hymn added!'); logAction(id?'hymn_edit':'hymn_add', (id?'Updated':'Added')+' hymn: '+(payload?.title||''), payload?.title||null)
      setForm(null); load()
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    const err = await remove('hymns', delId)
    if (!err) { showToast('Hymn deleted'); logAction('hymn_delete','Deleted hymn',null); setItems(i => i.filter(x => x.id !== delId)) }
    else showToast(err.message, 'error')
    setSaving(false); setDelId(null)
  }

  const F = k => ({ value: form?.[k] ?? '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading hymns...</div>

  // ── Form view ──
  if (form !== null) return (
    <div>
      <PageHeader icon="🎵" title={form.id ? 'Edit Hymn' : 'New Hymn'} />
      <AdminCard style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Hymn Title *</label>
              <input {...F('title')} required placeholder="e.g. Amazing Grace" />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input {...F('author')} placeholder="e.g. John Newton, 1779" />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input {...F('category')} placeholder="e.g. Grace, Praise, Prayer, Faith" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Audio URL</label>
              <input {...F('audio_url')} placeholder="https://... (MP3 link, optional)" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Verses *</label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 8 }}>
                Type each verse separated by a blank line. The verses will be numbered automatically.
              </p>
              <textarea
                value={versesText}
                onChange={e => setVersesText(e.target.value)}
                required
                rows={12}
                style={{ resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.8 }}
                placeholder={`Amazing grace! how sweet the sound,\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.\n\n'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!`}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Chorus <span style={{ fontWeight: 400, color: 'var(--text-light)' }}>(optional)</span></label>
              <textarea {...F('chorus')} rows={4} style={{ resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.8 }}
                placeholder="Then sings my soul, my Saviour God, to Thee:&#10;How great Thou art, how great Thou art!" />
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <input type="number" {...F('sort_order')} placeholder="0" min={0} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 24 }}>
              <input type="checkbox" id="pub" checked={form.published ?? true}
                onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <label htmlFor="pub" style={{ marginBottom: 0, cursor: 'pointer' }}>Published (visible on site)</label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Hymn'}
            </button>
            <button type="button" className="btn btn-outline-blue" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      </AdminCard>
    </div>
  )

  // ── List view ──
  return (
    <div>
      <PageHeader icon="🎵" title="Hymnal" subtitle={`${items.length} hymn${items.length !== 1 ? 's' : ''}`}
        action={<button className="btn btn-blue" onClick={() => openForm()}>+ New Hymn</button>} />

      <AdminCard style={{ marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
        <p style={{ fontSize: '0.85rem', color: '#92400e', margin: 0, lineHeight: 1.7 }}>
          🎵 Hymns are cached in the browser after the first load — members can access them offline. 
          Changes you make here will sync automatically next time they go online.
        </p>
      </AdminCard>

      {items.length === 0 && (
        <AdminCard>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎵</div>
            <p>No hymns yet. Click <strong>+ New Hymn</strong> to add the first one.</p>
          </div>
        </AdminCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => {
          const verseCount = (() => {
            try {
              const v = Array.isArray(item.verses) ? item.verses : JSON.parse(item.verses || '[]')
              return v.length
            } catch { return 0 }
          })()
          return (
            <AdminCard key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>
                  {item.author && `${item.author} · `}
                  {item.category && `${item.category} · `}
                  {verseCount} verse{verseCount !== 1 ? 's' : ''}
                  {item.chorus ? ' · Chorus' : ''}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.audio_url && <span style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>🎵 Audio</span>}
                  {!item.published && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>Draft</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline-blue" style={{ padding: '7px 16px', fontSize: '0.82rem' }} onClick={() => openForm(item)}>✏️ Edit</button>
                <button style={{ padding: '7px 16px', borderRadius: 30, border: '1.5px solid #fecaca', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }} onClick={() => setDelId(item.id)}>🗑</button>
              </div>
            </AdminCard>
          )
        })}
      </div>

      {delId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: 'var(--brand-deep)', margin: '0 0 8px' }}>Delete Hymn?</h3>
            <p style={{ color: 'var(--text-mid)', marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-blue" onClick={handleDelete} disabled={saving}>{saving ? '...' : 'Yes, Delete'}</button>
              <button className="btn btn-outline-blue" onClick={() => setDelId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
