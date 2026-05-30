import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getAll, insert, update, remove } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const EMPTY = {
  title: '', preacher: '', date: '', series: '', scripture: '',
  video_url: '', audio_url: '', duration: '', thumbnail: '',
  description: '', body: '', published: true,
}

// ─── Formatting Guide ──────────────────────────────────────────────────────────
function parseBlocks(text) {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let paraLines = []
  const flushPara = () => {
    const joined = paraLines.join(' ').trim()
    if (joined) blocks.push(joined)
    paraLines = []
  }
  lines.forEach(line => {
    const trimmed = line.trim()
    if (/^##/.test(trimmed) && trimmed.length > 2) {
      flushPara(); blocks.push(trimmed)
    } else if (/^#/.test(trimmed) && trimmed.length > 1 && !trimmed.startsWith('##')) {
      flushPara(); blocks.push(trimmed)
    } else if (trimmed === '') {
      flushPara()
    } else {
      paraLines.push(trimmed)
    }
  })
  flushPara()
  return blocks.filter(Boolean)
}

function renderBlocks(text, baseStyle = {}) {
  return parseBlocks(text).map((para, i) => (
    /^##/.test(para)
      ? <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.1rem', margin: '20px 0 8px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 4 }}>{para.replace(/^##\s*/, '')}</h3>
      : /^#/.test(para)
      ? <h4 key={i} style={{ color: 'var(--brand-light)', fontSize: '1rem', margin: '16px 0 6px', fontWeight: 700 }}>{para.replace(/^#\s*/, '')}</h4>
      : <p key={i} style={{ lineHeight: 1.9, color: 'var(--text-dark)', marginBottom: 14, ...baseStyle }}>{para}</p>
  ))
}

function FormatGuide() {
  const [open, setOpen] = useState(false)

  const TOKENS = [
    {
      syntax: '## Section Heading',
      description: 'Major section — e.g. Point 1 — The Call',
      render: (
        <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.05rem', margin: '4px 0', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 3 }}>
          Section Heading
        </h3>
      ),
    },
    {
      syntax: '# Sub-heading',
      description: 'Minor heading within a section',
      render: (
        <h4 style={{ color: 'var(--brand-light)', fontSize: '0.95rem', margin: '4px 0', fontWeight: 700 }}>
          Sub-heading
        </h4>
      ),
    },
    {
      syntax: 'Plain paragraph text',
      description: 'Regular body text — just write normally',
      render: (
        <p style={{ lineHeight: 1.9, color: 'var(--text-dark)', margin: '4px 0', fontSize: '0.9rem' }}>
          Plain paragraph text
        </p>
      ),
    },
    {
      syntax: '(blank line)',
      description: 'A blank line starts a new paragraph',
      render: (
        <span style={{ color: 'var(--text-light)', fontSize: '0.82rem', fontStyle: 'italic' }}>→ paragraph break</span>
      ),
    },
  ]

  const EXAMPLE = `## Point 1 — The Call\n\nGod's call to Abraham was both sudden and specific.\nHe was asked to leave everything familiar behind.\n\n# Key Verse\n\nFaith is the substance of things hoped for,\nthe evidence of things not seen.`

  return (
    <div style={{ gridColumn: '1/-1', marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f0fdf4', border: '1.5px solid #bbf7d0',
          borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '0.83rem',
          fontWeight: 700, color: 'var(--brand-deep)',
          width: '100%', textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: '1rem' }}>📐</span>
        <span style={{ flex: 1 }}>Formatting Guide — how sermon notes text is rendered on the page</span>
        <span style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div style={{
          background: '#f8fafb', border: '1.5px solid #d1fae5',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* Token table */}
          <div>
            <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.82rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Format tokens
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TOKENS.map((t, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '200px 1fr 1fr',
                  gap: 12, alignItems: 'center',
                  background: 'white', borderRadius: 8,
                  padding: '10px 14px', border: '1px solid #e8f5e9',
                }}>
                  <code style={{
                    fontFamily: 'monospace', fontSize: '0.83rem',
                    background: '#f0fdf4', padding: '3px 8px',
                    borderRadius: 5, color: '#166534', whiteSpace: 'nowrap',
                  }}>
                    {t.syntax}
                  </code>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>
                    {t.description}
                  </span>
                  <div style={{ borderLeft: '2px solid #d1fae5', paddingLeft: 12 }}>
                    {t.render}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full example */}
          <div>
            <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.82rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Example — typed vs. rendered
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  What you type
                </div>
                <pre style={{
                  background: '#1e293b', color: '#94d3a2',
                  borderRadius: 8, padding: '14px 16px',
                  fontSize: '0.8rem', lineHeight: 1.7,
                  margin: 0, overflowX: 'auto', fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                }}>
                  {EXAMPLE}
                </pre>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  How it appears to members
                </div>
                <div style={{
                  background: 'white', border: '1px solid #e8f5e9',
                  borderRadius: 8, padding: '14px 16px', minHeight: 100,
                }}>
                  {renderBlocks(EXAMPLE)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminSermons() {
  const { showToast, logAction } = useAdmin()
  const [items,   setItems]   = useState([])
  const [form,    setForm]    = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId,   setDelId]   = useState(null)
  const [preview, setPreview] = useState(false)
  const [search,  setSearch]  = useState('')

  const load = () => getAll('sermons', 'date')
    .then(({ data }) => { setItems(data || []); setLoading(false) })
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const { error } = id
      ? await update('sermons', id, rest)
      : await insert('sermons', rest)
    if (!error) {
      showToast(id ? 'Sermon updated!' : 'Sermon added!')
      logAction(id ? 'sermon_edit' : 'sermon_add', (id ? 'Updated' : 'Added') + ' sermon: ' + (form.title || ''), form.title || null)
      setForm(null); load()
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    const err = await remove('sermons', delId)
    if (!err) {
      showToast('Deleted')
      logAction('sermon_delete', 'Deleted sermon', null)
      setItems(i => i.filter(x => x.id !== delId))
    } else {
      showToast(err.message, 'error')
    }
    setDelId(null)
  }

  const F = k => ({ value: form?.[k] || '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = items.filter(s => !search ||
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    (s.preacher || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.series || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading sermons...</div>

  // ── FORM VIEW ────────────────────────────────────────────────────────────────
  if (form !== null) return (
    <div>
      <PageHeader
        icon="🎙"
        title={form.id ? 'Edit Sermon' : 'New Sermon'}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline-blue" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.85rem' }}>
              {preview ? '📝 Edit' : '👁 Preview'}
            </button>
            <button className="btn btn-blue" onClick={handleSubmit} disabled={saving}>
              {saving ? '⏳...' : '💾 Save'}
            </button>
            <button className="btn btn-outline-blue" onClick={() => setForm(null)} style={{ fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>
        }
      />

      {/* ── PREVIEW ── */}
      {preview ? (
        <AdminCard style={{ maxWidth: 760 }}>
          {/* Header band */}
          <div style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))', borderRadius: 12, padding: '24px 28px', marginBottom: 24 }}>
            {form.series && (
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                {form.series}
              </div>
            )}
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.6rem', margin: '0 0 12px', lineHeight: 1.25 }}>
              {form.title || 'Untitled Sermon'}
            </h2>
            {form.scripture && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--brand-deep)', padding: '6px 16px', borderRadius: 30, fontSize: '0.85rem', fontWeight: 800, marginBottom: 12 }}>
                📜 {form.scripture}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
              {form.date     && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>📅 {form.date}</span>}
              {form.preacher && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>🎙 {form.preacher}</span>}
              {form.duration && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>⏱ {form.duration}</span>}
            </div>
          </div>

          {/* Media buttons */}
          {(form.video_url || form.audio_url) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              {form.video_url && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 22px', borderRadius: 30, background: 'var(--brand-mid)', color: 'white', fontSize: '0.88rem', fontWeight: 700 }}>
                  ▶ Watch Sermon
                </span>
              )}
              {form.audio_url && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 22px', borderRadius: 30, border: '1.5px solid var(--brand-pale)', color: 'var(--brand-deep)', fontSize: '0.88rem', fontWeight: 700 }}>
                  🎧 Listen
                </span>
              )}
            </div>
          )}

          {/* Thumbnail preview */}
          {form.thumbnail && (
            <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24, maxHeight: 280 }}>
              <img src={form.thumbnail} alt="thumbnail" style={{ width: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            </div>
          )}

          {/* Description pull-quote */}
          {form.description && (
            <div style={{ background: 'var(--brand-pale)', borderLeft: '4px solid var(--brand-light)', borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 24, fontStyle: 'italic', color: 'var(--brand-deep)', lineHeight: 1.8 }}>
              {form.description}
            </div>
          )}

          {/* Body content */}
          {form.body && renderBlocks(form.body)}

          {!form.description && !form.body && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎙</div>
              <div>No description or notes added yet.</div>
            </div>
          )}
        </AdminCard>
      ) : (

        /* ── EDIT FORM ── */
        <AdminCard style={{ maxWidth: 800 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Core fields */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Sermon Title *</label>
              <input {...F('title')} required placeholder="e.g. Walking by Faith" />
            </div>
            <div className="form-group">
              <label>Preacher *</label>
              <input {...F('preacher')} required placeholder="e.g. Pastor John Mensah" />
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input type="date" {...F('date')} required />
            </div>
            <div className="form-group">
              <label>Series</label>
              <input {...F('series')} placeholder="e.g. Faith Foundations" />
            </div>
            <div className="form-group">
              <label>Scripture</label>
              <input {...F('scripture')} placeholder="e.g. Hebrews 11:1-6" />
            </div>
            <div className="form-group">
              <label>Duration</label>
              <input {...F('duration')} placeholder="e.g. 45 min" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Video URL</label>
              <input {...F('video_url')} placeholder="YouTube or Vimeo link" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Audio URL</label>
              <input {...F('audio_url')} placeholder="MP3 direct link" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Thumbnail URL</label>
              <input {...F('thumbnail')} placeholder="https://..." />
            </div>

            {/* Description */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>
                Description / Summary
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-light)', marginLeft: 8 }}>
                  Shown as highlighted intro text below the sermon header
                </span>
              </label>
              <textarea {...F('description')} rows={3} style={{ resize: 'vertical' }}
                placeholder="A short summary of what this sermon is about..." />
            </div>

            {/* Formatting guide */}
            <FormatGuide />

            {/* Body / Notes */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>
                Sermon Notes / Full Content
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-light)', marginLeft: 8 }}>
                  Use ## for section headings, # for subheadings, blank line between paragraphs
                </span>
              </label>
              <textarea {...F('body')} rows={16}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.7 }}
                placeholder={"## Introduction\n\nOpening thoughts...\n\n## Point 1 — The Call\n\nContent here...\n\n## Conclusion\n\nClosing application..."} />
            </div>

            {/* Published toggle */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form?.published !== false}
                  onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                  style={{ width: 18, height: 18 }} />
                Published (visible to members)
              </label>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  )

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        icon="🎙"
        title="Sermons"
        subtitle={`${items.length} sermon${items.length !== 1 ? 's' : ''}`}
        action={<button className="btn btn-blue" onClick={() => setForm({ ...EMPTY })}>+ New Sermon</button>}
      />

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search sermons, preacher or series..."
          style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.88rem', width: '100%', maxWidth: 400, boxSizing: 'border-box' }}
        />
      </div>

      {filtered.length === 0 && (
        <AdminCard>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
            {items.length === 0 ? 'No sermons yet. Add your first sermon above.' : 'No sermons match your search.'}
          </div>
        </AdminCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => (
          <AdminCard key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>{item.title}</span>
                {item.published === false && (
                  <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>DRAFT</span>
                )}
                {item.series && (
                  <span style={{ fontSize: '0.68rem', background: 'var(--brand-pale)', color: 'var(--brand-light)', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>{item.series}</span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-mid)', marginBottom: 6 }}>
                {item.preacher && <span>🎙 {item.preacher}</span>}
                {item.date && <span style={{ marginLeft: 10 }}>📅 {item.date}</span>}
                {item.scripture && <span style={{ marginLeft: 10, color: 'var(--brand-light)' }}>📜 {item.scripture}</span>}
                {item.duration && <span style={{ marginLeft: 10 }}>⏱ {item.duration}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {item.video_url && <span style={{ fontSize: '0.7rem', background: 'var(--brand-pale)', color: 'var(--brand-light)', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>📹 Video</span>}
                {item.audio_url && <span style={{ fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>🎵 Audio</span>}
                {item.body     && <span style={{ fontSize: '0.7rem', background: '#f0f4ff', color: '#3730a3', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>📝 Notes</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline-blue" style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                onClick={() => { setForm(item); setPreview(false) }}>✏️ Edit</button>
              <button style={{ padding: '7px 16px', borderRadius: 30, border: '1.5px solid #fecaca', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}
                onClick={() => setDelId(item.id)}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>

      {/* Delete confirm */}
      {delId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: 'var(--brand-deep)', margin: '0 0 8px' }}>Delete Sermon?</h3>
            <p style={{ color: 'var(--text-mid)', marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-blue" onClick={handleDelete}>Delete</button>
              <button className="btn btn-outline-blue" onClick={() => setDelId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
