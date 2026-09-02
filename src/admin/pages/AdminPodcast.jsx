import { useState, useEffect } from 'react'
import supabaseAdmin from '../../lib/supabase'
import { getAll, insert, update, remove } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const EMPTY = { episode_date: '', title: '', script: '', published: true }

function StatusBadge({ status }) {
  const map = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    ready:   { bg: '#dcfce7', color: '#166534', label: 'Ready' },
    failed:  { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// supabase-js only gives a generic "non-2xx status code" message on
// fnError; the actual reason is in the response body it wrapped.
async function extractFnErrorMessage(fnError) {
  try {
    const text = await fnError.context.text()
    try {
      const json = JSON.parse(text)
      if (json?.error) return json.error
    } catch { /* not JSON */ }
    if (text) return text
  } catch { /* no readable body */ }
  return fnError.message || 'Edge Function error'
}

async function invokeGenerate(episodeId) {
  const { data, error: fnError } = await supabaseAdmin.functions.invoke('generate-daily-podcast', {
    body: { episode_id: episodeId },
  })
  if (fnError) throw new Error(await extractFnErrorMessage(fnError))
  if (data?.error) throw new Error(data.error)
  if (data?.skipped) throw new Error(data.reason || 'Generation was skipped')
  return data
}

export default function AdminPodcast() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null = list view, object = editing/creating
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [preview, setPreview] = useState(null) // { audio_url, duration_seconds }

  async function load() {
    setLoading(true)
    const { data } = await getAll('podcast_episodes', 'episode_date')
    setEpisodes(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function startNew() {
    const today = new Date().toISOString().slice(0, 10)
    setForm({ ...EMPTY, episode_date: today })
    setPreview(null)
    setGenError('')
  }

  function startEdit(ep) {
    setForm(ep)
    setPreview(ep.audio_url ? { audio_url: ep.audio_url, duration_seconds: ep.duration_seconds } : null)
    setGenError('')
  }

  // Saves the script, then immediately asks the edge function to narrate it
  // so the admin sees/hears a preview right away instead of waiting for the
  // next cron run.
  async function save() {
    if (!form.episode_date || !form.title || !form.script) {
      alert('Date, title, and script are all required.')
      return
    }
    setSaving(true)
    setGenError('')
    const payload = {
      episode_date: form.episode_date,
      title: form.title,
      script: form.script,
      published: form.published,
    }
    const { data: savedRow, error } = form.id
      ? await update('podcast_episodes', form.id, payload)
      : await insert('podcast_episodes', payload)
    setSaving(false)
    if (error) { alert(error.message); return }

    setForm(savedRow)
    load()

    setGenerating(true)
    setPreview(null)
    try {
      const data = await invokeGenerate(savedRow.id)
      setPreview({ audio_url: data.url, duration_seconds: data.seconds })
      load()
    } catch (e) {
      setGenError(e.message || 'Audio generation failed — you can retry below.')
    }
    setGenerating(false)
  }

  async function regenerate() {
    if (!form?.id) return
    setGenerating(true)
    setGenError('')
    try {
      const data = await invokeGenerate(form.id)
      setPreview({ audio_url: data.url, duration_seconds: data.seconds })
      load()
    } catch (e) {
      setGenError(e.message || 'Audio generation failed — you can retry below.')
    }
    setGenerating(false)
  }

  async function del(ep) {
    if (!confirm(`Delete the episode for ${ep.episode_date}?`)) return
    await remove('podcast_episodes', ep.id)
    load()
  }

  const wordCount = form?.script ? form.script.trim().split(/\s+/).filter(Boolean).length : 0
  const estMinutes = wordCount ? Math.max(1, Math.round(wordCount / 150)) : 0

  if (form) {
    return (
      <div>
        <PageHeader icon="🎙" title={form.id ? 'Edit Episode' : 'New Episode'} subtitle="Audio is generated and previewed automatically when you save." />
        <AdminCard>
          <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
            <div className="form-group">
              <label>Episode date</label>
              <input type="date" value={form.episode_date} onChange={e => setForm(f => ({ ...f, episode_date: e.target.value }))}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Walking in Faith Today"
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Script</label>
              <textarea value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
                rows={12} placeholder="Write exactly what should be read aloud, 1–5 minutes worth (roughly 150–750 words)."
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', width: '100%', fontFamily: 'var(--font-body)', lineHeight: 1.6 }} />
              <div style={{ fontSize: '0.78rem', color: wordCount > 750 ? '#b91c1c' : '#64748b', marginTop: 4 }}>
                {wordCount} words · ~{estMinutes} min{wordCount > 750 ? ' — anything past 750 words gets trimmed for audio' : ''}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
              Published (visible to listeners once audio is ready)
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving || generating}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--brand-deep, #166534)', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: saving || generating ? 0.7 : 1 }}>
                {saving ? 'Saving…' : generating ? 'Saving…' : 'Save & Generate Audio'}
              </button>
              <button onClick={() => setForm(null)} disabled={generating}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                {form.id ? 'Back' : 'Cancel'}
              </button>
            </div>

            {/* Audio preview */}
            {(generating || preview || genError) && (
              <div style={{ padding: '14px 16px', background: 'var(--brand-pale, #f0fdf4)', borderRadius: 12 }}>
                {generating && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--brand-deep, #166534)', fontWeight: 600 }}>
                    🎙 Generating audio… this can take up to 30 seconds for longer scripts.
                  </div>
                )}
                {!generating && preview && (
                  <>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-deep, #166534)', marginBottom: 8 }}>
                      ✅ Preview ready {preview.duration_seconds ? `· ~${Math.round(preview.duration_seconds / 60)} min` : ''}
                    </div>
                    <audio controls autoPlay={false} src={preview.audio_url} style={{ width: '100%' }} />
                  </>
                )}
                {!generating && genError && (
                  <>
                    <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: 8 }}>⚠️ {genError}</div>
                    {form.id && (
                      <button onClick={regenerate}
                        style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #b91c1c', background: 'white', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        Retry generation
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {!generating && !preview && !genError && form.id && form.audio_url && (
              <div style={{ padding: '14px 16px', background: 'var(--brand-pale, #f0fdf4)', borderRadius: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-deep, #166534)', marginBottom: 8 }}>
                  🎧 Current audio {form.duration_seconds ? `· ~${Math.round(form.duration_seconds / 60)} min` : ''}
                </div>
                <audio controls src={form.audio_url} style={{ width: '100%' }} />
                <button onClick={regenerate}
                  style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--brand-light)', background: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  Regenerate audio
                </button>
              </div>
            )}
          </div>
        </AdminCard>
      </div>
    )
  }

  return (
    <div>
      <PageHeader icon="🎙" title="Daily Podcast" subtitle="1–5 minute scripted episodes, narrated automatically when you save."
        action={
          <button onClick={startNew}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--brand-deep, #166534)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            + New Episode
          </button>
        } />
      <AdminCard>
        {loading ? (
          <p>Loading…</p>
        ) : episodes.length === 0 ? (
          <p style={{ color: '#64748b' }}>No episodes yet. Write one for today or schedule ahead.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {episodes.map(ep => (
              <div key={ep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{ep.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {ep.episode_date} {ep.duration_seconds ? `· ~${Math.round(ep.duration_seconds / 60)} min` : ''} {!ep.published && '· Unpublished'}
                  </div>
                </div>
                <StatusBadge status={ep.status} />
                {ep.audio_url && (
                  <audio controls preload="none" src={ep.audio_url} style={{ height: 32, maxWidth: 220 }} />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(ep)} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                  <button onClick={() => del(ep)} style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid #fca5a5', background: 'white', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
