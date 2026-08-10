import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getAll, insert, update, remove } from '../supabase'
import supabaseAdmin from '../../lib/supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { parseBlocks, renderInline } from '../../lib/textFormat'

const EMPTY = { subject: '', body: '', published: false }

const DEFAULT_GREETING  = 'Dear {name},'
const DEFAULT_SIGNATURE = 'God first always. God bless you.\nOne Family. One Faith. One Mission.\nCCG World.'
const DEFAULT_FOOTER    = 'You are receiving this because you subscribed on CCG World.'

// Live-preview renderer — mirrors the public /newsletter page exactly
// (## heading, # sub-heading, **bold**, *italic*) using the shared parser,
// same as Sabbath School and Sermons.
function renderBlocks(text) {
  return parseBlocks(text).map((para, i) => (
    /^##/.test(para)
      ? <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.1rem', margin: '20px 0 8px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 4 }}>{renderInline(para.replace(/^##\s*/, ''))}</h3>
      : /^#/.test(para)
      ? <h4 key={i} style={{ color: 'var(--brand-light)', fontSize: '1rem', margin: '16px 0 6px', fontWeight: 700 }}>{renderInline(para.replace(/^#\s*/, ''))}</h4>
      : <p key={i} style={{ lineHeight: 1.9, color: 'var(--text-dark)', marginBottom: 14 }}>{renderInline(para)}</p>
  ))
}

// ─── Formatting Guide (same tokens as Sabbath School, so authors only need
// to learn this syntax once across the whole admin panel) ─────────────────
function FormatGuide() {
  const [open, setOpen] = useState(false)
  const TOKENS = [
    { syntax: '## Section Heading', description: 'Major section', render: <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.05rem', margin: '4px 0', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 3 }}>Section Heading</h3> },
    { syntax: '# Sub-heading', description: 'Minor heading', render: <h4 style={{ color: 'var(--brand-light)', fontSize: '0.95rem', margin: '4px 0', fontWeight: 700 }}>Sub-heading</h4> },
    { syntax: 'Plain paragraph text', description: 'Regular body text — just write normally', render: <p style={{ lineHeight: 1.9, color: 'var(--text-dark)', margin: '4px 0', fontSize: '0.9rem' }}>Plain paragraph text</p> },
    { syntax: '**bold text**', description: 'Wrap words in double asterisks', render: <p style={{ lineHeight: 1.9, color: 'var(--text-dark)', margin: '4px 0', fontSize: '0.9rem' }}>This is <strong>bold text</strong> in a sentence</p> },
    { syntax: '*italic text*', description: 'Wrap words in single asterisks', render: <p style={{ lineHeight: 1.9, color: 'var(--text-dark)', margin: '4px 0', fontSize: '0.9rem' }}>This is <em>italic text</em> in a sentence</p> },
    { syntax: '(blank line)', description: 'A blank line starts a new paragraph', render: <span style={{ color: 'var(--text-light)', fontSize: '0.82rem', fontStyle: 'italic' }}>→ paragraph break</span> },
  ]
  const EXAMPLE = `## This Week at CCG World\n\nWe are **so grateful** for everyone who joined us this Sabbath.\n\n# Upcoming\n\n*Join us next week* as we continue our series on faith.`

  return (
    <div style={{ marginBottom: 4 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1.5px solid #bbf7d0',
        borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.83rem',
        fontWeight: 700, color: 'var(--brand-deep)', width: '100%', textAlign: 'left',
      }}>
        <span style={{ fontSize: '1rem' }}>📐</span>
        <span style={{ flex: 1 }}>Formatting Guide — how text is rendered on the newsletter page</span>
        <span style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && (
        <div style={{ background: '#f8fafb', border: '1.5px solid #d1fae5', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TOKENS.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, alignItems: 'center', background: 'white', borderRadius: 8, padding: '10px 14px', border: '1px solid #e8f5e9' }}>
                <code style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f0fdf4', padding: '3px 8px', borderRadius: 5, color: '#166534', whiteSpace: 'nowrap' }}>{t.syntax}</code>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-mid)' }}>{t.description}</span>
                <div style={{ borderLeft: '2px solid #d1fae5', paddingLeft: 12 }}>{t.render}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.82rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Example</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <pre style={{ background: '#1e293b', color: '#94d3a2', borderRadius: 8, padding: '14px 16px', fontSize: '0.8rem', lineHeight: 1.7, margin: 0, overflowX: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{EXAMPLE}</pre>
              <div style={{ background: 'white', border: '1px solid #e8f5e9', borderRadius: 8, padding: '14px 16px', minHeight: 100 }}>{renderBlocks(EXAMPLE)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminNewsletter() {
  const { showToast, logAction } = useAdmin()
  const [items, setItems]     = useState([])
  const [form, setForm]       = useState(null)
  const [wasPublished, setWasPublished] = useState(false) // published state BEFORE this edit — detects the true unpublished->published transition
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId]     = useState(null)
  const [preview, setPreview] = useState(false)

  const load = () => getAll('newsletters', 'published_at')
    .then(({ data }) => { setItems(data || []); setLoading(false) })
    .catch(err => { showToast(err.message, 'error'); setLoading(false) })
    .catch(err => { showToast(err.message, 'error'); setLoading(false) })
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const nowPublishing = !wasPublished && rest.published
    const payload = { ...rest, ...(nowPublishing ? { published_at: new Date().toISOString() } : {}) }

    const { error } = id ? await update('newsletters', id, payload) : await insert('newsletters', payload)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    showToast(id ? 'Newsletter updated!' : 'Newsletter saved!')
    logAction(id ? 'newsletter_edit' : 'newsletter_add', (id ? 'Updated' : 'Added') + ' newsletter: ' + (payload.subject || ''), payload.subject || null)

    if (nowPublishing) {
      // This is the actual publish moment — send to every active subscriber.
      const { data: subs } = await supabaseAdmin.from('newsletter_subscribers').select('*')
      const recipients = (subs || []).filter(s => s.wants_email && s.active && s.email).map(s => ({ email: s.email, name: s.name || 'Member' }))
      if (recipients.length === 0) {
        showToast('Published — but there are no active email subscribers to send to yet', 'error')
      } else {
        const { data: sendResult, error: sendError } = await supabaseAdmin.functions.invoke('send-newsletter', {
          body: {
            subject: payload.subject, body: payload.body,
            greeting: DEFAULT_GREETING, signature: DEFAULT_SIGNATURE, footer: DEFAULT_FOOTER,
            recipients,
          },
        })
        if (sendError) {
          showToast('Published, but the email send failed — check 📋 Delivery Logs in Newsletter admin', 'error')
        } else {
          const delivered = sendResult?.delivered ?? recipients.length
          const failed = sendResult?.failed ?? 0
          showToast(failed === 0 ? `✅ Published and emailed to ${delivered} subscribers!` : `⚠️ Published — sent to ${delivered}, failed for ${failed} (check Delivery Logs)`, failed > 0 ? 'error' : undefined)
        }
        logAction('newsletter_published', `Published & sent "${payload.subject}" to ${recipients.length} subscribers`, payload.subject)
      }
    }

    setForm(null); setSaving(false); load()
  }

  const handleDelete = async () => {
    const err = await remove('newsletters', delId)
    if (!err) { showToast('Deleted'); logAction('newsletter_delete', 'Deleted newsletter', null); setItems(i => i.filter(x => x.id !== delId)) }
    else showToast(err.message, 'error')
    setDelId(null)
  }

  const F = k => ({ value: form?.[k] || '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading newsletters...</div>

  // FORM VIEW
  if (form !== null) return (
    <div>
      <PageHeader icon="📰" title={form.id ? 'Edit Newsletter' : 'New Newsletter'}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline-blue" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.85rem' }}>{preview ? '📝 Edit' : '👁 Preview'}</button>
            <button className="btn btn-blue" onClick={handleSubmit} disabled={saving}>{saving ? '⏳...' : '💾 Save'}</button>
            <button className="btn btn-outline-blue" onClick={() => setForm(null)} style={{ fontSize: '0.85rem' }}>Cancel</button>
          </div>
        }
      />

      {!wasPublished && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: '0.82rem', color: '#92400e' }}>
          Checking "Published" below and saving will <strong>immediately email every active subscriber</strong> — there's no separate confirmation step after this.
        </div>
      )}

      {preview ? (
        <AdminCard style={{ maxWidth: 720 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 8 }}>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.4rem', marginBottom: 16 }}>{form.subject || 'Untitled'}</h2>
          {form.body ? renderBlocks(form.body) : <p style={{ color: 'var(--text-light)' }}>Nothing written yet.</p>}
        </AdminCard>
      ) : (
        <AdminCard style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Subject *</label>
              <input {...F('subject')} required placeholder="e.g. This Week at CCG World" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Body</label>
              <FormatGuide />
              <textarea {...F('body')} rows={16} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.7 }}
                placeholder={"## This Week at CCG World\n\nWrite your update here...\n\n## Coming Up\n\nWhat's next..."} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} style={{ width: 18, height: 18 }} />
                Published (visible on /newsletter{!wasPublished ? ' — and emails every subscriber on save' : ''})
              </label>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  )

  // LIST VIEW
  return (
    <div>
      <PageHeader icon="📰" title="Newsletter" subtitle={`${items.length} newsletters`}
        action={<button className="btn btn-blue" onClick={() => { setForm({ ...EMPTY }); setWasPublished(false) }}>+ New Newsletter</button>}
      />

      {items.length === 0 && (
        <AdminCard><div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
          No newsletters yet. Write your first one above.
        </div></AdminCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <AdminCard key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>{item.subject}</span>
                {!item.published && <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>DRAFT</span>}
                {item.published && <span style={{ fontSize: '0.68rem', background: '#f0fdf4', color: '#16a34a', padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>PUBLISHED</span>}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-mid)' }}>
                📅 {new Date(item.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline-blue" style={{ padding: '7px 16px', fontSize: '0.82rem' }}
                onClick={() => { setForm(item); setWasPublished(!!item.published) }}>✏️ Edit</button>
              <button style={{ padding: '7px 16px', borderRadius: 30, border: '1.5px solid #fecaca', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}
                onClick={() => setDelId(item.id)}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>

      {delId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: 'var(--brand-deep)', margin: '0 0 8px' }}>Delete Newsletter?</h3>
            <p style={{ color: 'var(--text-mid)', marginBottom: 24 }}>This removes it from the public archive. It does not un-send any email already delivered. This cannot be undone.</p>
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
