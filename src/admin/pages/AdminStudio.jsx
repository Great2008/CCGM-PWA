import { useState, useEffect } from 'react'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'

/*
  Supabase table required:
  ─────────────────────────────────────────────────────
  create table studio_pins (
    id          uuid primary key default gen_random_uuid(),
    video_id    text not null unique,
    title       text not null,
    note        text,
    created_at  timestamptz default now()
  );

  RLS: only service_role (admin client) can insert/delete.
  Public anon can SELECT (so Studio.jsx can read pins).
  ─────────────────────────────────────────────────────
*/

const YT_ID_RE = /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/

function extractVideoId(input) {
  const m = input.match(YT_ID_RE)
  if (m) return m[1]
  if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim()
  return null
}

export default function AdminStudio() {
  const { showToast, logAction } = useAdmin()

  const [pins, setPins]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Form
  const [input, setInput] = useState('')   // URL or video ID
  const [title, setTitle] = useState('')
  const [note, setNote]   = useState('')
  const [preview, setPreview] = useState(null)   // { id, thumb }

  // Resolve preview when input changes
  useEffect(() => {
    const id = extractVideoId(input)
    if (id) setPreview({ id, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` })
    else setPreview(null)
  }, [input])

  const load = async () => {
    setLoading(true)
    const { data } = await supabaseAdmin.from('studio_pins').select('*').order('created_at', { ascending:false })
    setPins(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handlePin = async () => {
    const id = extractVideoId(input)
    if (!id) { showToast('Invalid YouTube URL or video ID', 'error'); return }
    if (!title.trim()) { showToast('Please enter a title for this pin', 'error'); return }

    setSaving(true)
    const { error } = await supabaseAdmin.from('studio_pins').upsert({
      video_id: id,
      title:    title.trim(),
      note:     note.trim() || null,
    }, { onConflict: 'video_id' })

    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('📌 Video pinned successfully')
      logAction('studio_pin', `Pinned video: ${title.trim()}`, title.trim())
      setInput(''); setTitle(''); setNote(''); setPreview(null)
      await load()
    }
    setSaving(false)
  }

  const handleUnpin = async (pin) => {
    if (!window.confirm(`Unpin "${pin.title}"?`)) return
    setSaving(true)
    await supabaseAdmin.from('studio_pins').delete().eq('id', pin.id)
    showToast('Pin removed')
    logAction('studio_unpin', `Unpinned video: ${pin.title}`, pin.title)
    await load()
    setSaving(false)
  }

  const inputStyle = {
    width:'100%', padding:'10px 14px', borderRadius:8,
    border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)',
    fontSize:'0.88rem', outline:'none', boxSizing:'border-box',
  }

  return (
    <div>
      <PageHeader
        title="CCG Studio"
        subtitle="Pin featured videos to the top of the Studio page. All other videos are fetched automatically from your YouTube channel."
        icon="🎬"
      />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28, alignItems:'start' }}>

        {/* ── Pin form ── */}
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin:'0 0 18px', color:'var(--brand-deep)', fontFamily:'var(--font-display)', fontSize:'1rem' }}>
            📌 Pin a Video
          </h3>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
              YouTube URL or Video ID *
            </label>
            <input
              style={inputStyle}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="https://youtu.be/dQw4w9WgXcQ  or  dQw4w9WgXcQ"
            />
          </div>

          {/* Preview thumbnail */}
          {preview && (
            <div style={{ marginBottom:14, borderRadius:10, overflow:'hidden', aspectRatio:'16/9', background:'#0f172a' }}>
              <img src={preview.thumb} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
              Title *
            </label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sunday Service — Easter 2025" />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
              Internal Note (optional)
            </label>
            <input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Keep pinned until June" />
          </div>

          <button
            onClick={handlePin}
            disabled={saving || !input.trim() || !title.trim()}
            style={{
              width:'100%', padding:'11px', borderRadius:10, border:'none',
              background: (saving || !input.trim() || !title.trim()) ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))',
              color:'white', fontWeight:700, fontSize:'0.9rem',
              fontFamily:'var(--font-body)', cursor: (saving || !input.trim() || !title.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '⏳ Pinning…' : '📌 Pin Video'}
          </button>

          <p style={{ margin:'14px 0 0', fontSize:'0.75rem', color:'var(--text-light)', lineHeight:1.6 }}>
            Pinned videos appear at the top of the Studio page with a 📌 badge, regardless of upload date.
            If the video is already in the YouTube feed it will be highlighted there; otherwise it's added as a manual entry.
          </p>
        </div>

        {/* ── Current pins ── */}
        <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin:'0 0 18px', color:'var(--brand-deep)', fontFamily:'var(--font-display)', fontSize:'1rem' }}>
            Currently Pinned ({pins.length})
          </h3>

          {loading && (
            <div style={{ textAlign:'center', padding:32, color:'var(--text-light)' }}>⏳ Loading…</div>
          )}

          {!loading && pins.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--text-light)', fontSize:'0.88rem' }}>
              No pins yet. Add one on the left.
            </div>
          )}

          {!loading && pins.map(pin => (
            <div key={pin.id} style={{
              display:'flex', gap:12, alignItems:'flex-start',
              padding:'12px 0', borderBottom:'1px solid #f0f4fa',
            }}>
              <img
                src={`https://i.ytimg.com/vi/${pin.video_id}/default.jpg`}
                alt={pin.title}
                style={{ width:80, height:45, objectFit:'cover', borderRadius:6, flexShrink:0 }}
              />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-dark)', lineHeight:1.3,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {pin.title}
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-light)', fontFamily:'monospace', marginTop:3 }}>
                  {pin.video_id}
                </div>
                {pin.note && (
                  <div style={{ fontSize:'0.72rem', color:'var(--text-mid)', marginTop:3, fontStyle:'italic' }}>
                    {pin.note}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleUnpin(pin)}
                disabled={saving}
                style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', flexShrink:0 }}
              >
                Unpin
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Setup guide */}
      <div style={{ marginTop:28, background:'#f0f9ff', borderRadius:14, padding:22, border:'1px solid #bae6fd' }}>
        <h4 style={{ margin:'0 0 10px', color:'#0369a1', fontFamily:'var(--font-display)' }}>⚙️ Setup Checklist</h4>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
          {[
            { label:'YOUTUBE_API_KEY', desc:'Google Cloud Console → APIs & Services → Credentials' },
            { label:'YOUTUBE_CHANNEL_ID', desc:'YouTube Studio → Settings → Channel → Advanced → Channel ID (starts with UC)' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ background:'white', borderRadius:8, padding:'12px 14px', border:'1px solid #e0f2fe' }}>
              <code style={{ fontSize:'0.78rem', fontWeight:700, color:'#0284c7', display:'block', marginBottom:4 }}>{label}</code>
              <div style={{ fontSize:'0.75rem', color:'#0369a1', lineHeight:1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
        <p style={{ margin:'12px 0 0', fontSize:'0.78rem', color:'#0369a1', lineHeight:1.6 }}>
          Add both as environment variables in your <strong>Vercel dashboard</strong> (Settings → Environment Variables).
          The API key is never exposed to the browser — it's only used in <code>api/index.py</code>.
          Enable the <strong>YouTube Data API v3</strong> in Google Cloud Console for your project.
        </p>
      </div>
    </div>
  )
}
