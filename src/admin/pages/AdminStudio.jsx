import { useState, useEffect } from 'react'
import supabaseAdmin from '../../lib/supabase'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import { invokeApi } from '../../lib/api'

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

  // Community suggestions (members suggest YouTube links; staff review here)
  const [subs, setSubs]           = useState([])
  const [subFilter, setSubFilter] = useState('pending')
  const [notes, setNotes]         = useState({})     // optional reviewer note, per submission id
  const [busyId, setBusyId]       = useState(null)
  const [previewId, setPreviewId] = useState(null)

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
    const { data: sdata } = await supabaseAdmin.from('studio_submissions').select('*')
      .order('created_at', { ascending:false }).limit(200)
    setSubs(sdata || [])
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

  const handleReview = async (sub, action) => {
    if (action === 'remove' && !window.confirm(`Take "${sub.title}" off the Studio page?`)) return
    setBusyId(sub.id)
    const { data, error } = await invokeApi('studio-review', { body: { id: sub.id, action, note: notes[sub.id] || '' } })
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); await load(); return }
    const verb = { approve:'approved', reject:'declined', remove:'removed' }[action]
    showToast(`Suggestion ${verb}${data?.emailSent ? ' · member emailed' : ''}`)
    logAction('studio_review', `${verb} suggestion: ${sub.title}`, sub.title)
    setNotes(n => { const c = { ...n }; delete c[sub.id]; return c })
    setPreviewId(null)
    await load()
  }

  // Promote an approved suggestion to the top of the Videos tab
  const handlePinSubmission = async (sub) => {
    setBusyId(sub.id)
    const { error } = await supabaseAdmin.from('studio_pins').upsert({
      video_id: sub.video_id, title: sub.title, note: `Suggested by ${sub.submitter_name || 'a member'}`,
    }, { onConflict:'video_id' })
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast('📌 Pinned to the top of Studio')
    logAction('studio_pin', `Pinned suggested video: ${sub.title}`, sub.title)
    await load()
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

      {/* ── Community suggestions (review queue) ── */}
      {(() => {
        const counts = { pending:0, approved:0, rejected:0 }
        subs.forEach(x => { counts[x.status] = (counts[x.status] || 0) + 1 })
        const list = subs.filter(x => x.status === subFilter)
        const chip = (id, text) => (
          <button key={id} onClick={() => setSubFilter(id)} style={{
            padding:'6px 14px', borderRadius:20, cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
            border: subFilter===id ? '1.5px solid var(--brand-mid,#1d4ed8)' : '1.5px solid #e2e8f0',
            background: subFilter===id ? 'var(--brand-mid,#1d4ed8)' : 'white',
            color: subFilter===id ? 'white' : 'var(--text-mid)',
          }}>{text} ({counts[id] || 0})</button>
        )
        const btn = (bg, color, border) => ({ padding:'7px 14px', borderRadius:8, border:`1px solid ${border}`, background:bg, color, fontSize:'0.78rem', fontWeight:700, cursor:'pointer' })
        return (
          <div style={{ background:'white', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', marginBottom:28 }}>
            <h3 style={{ margin:'0 0 6px', color:'var(--brand-deep)', fontFamily:'var(--font-display)', fontSize:'1rem' }}>
              🤝 Community Suggestions
            </h3>
            <p style={{ margin:'0 0 14px', fontSize:'0.78rem', color:'var(--text-light)', lineHeight:1.6 }}>
              Videos suggested by signed-in members. Nothing is public until you approve it; approved videos appear in the Community tab.
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              {chip('pending', '⏳ Pending')}{chip('approved', '✅ Approved')}{chip('rejected', 'Declined')}
            </div>

            {!loading && list.length === 0 && (
              <div style={{ textAlign:'center', padding:28, color:'var(--text-light)', fontSize:'0.88rem' }}>
                {subFilter === 'pending' ? 'No suggestions waiting for review. 🎉' : 'Nothing here yet.'}
              </div>
            )}

            {list.map(sub => {
              const busy = busyId === sub.id
              return (
                <div key={sub.id} style={{ padding:'16px 0', borderBottom:'1px solid #f0f4fa' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <img
                      src={`https://i.ytimg.com/vi/${sub.video_id}/mqdefault.jpg`} alt=""
                      onClick={() => setPreviewId(previewId === sub.id ? null : sub.id)}
                      style={{ width:120, height:68, objectFit:'cover', borderRadius:8, flexShrink:0, cursor:'pointer' }}
                    />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-dark)', lineHeight:1.35 }}>{sub.title}</div>
                      <div style={{ fontSize:'0.74rem', color:'var(--text-light)', marginTop:4, lineHeight:1.5 }}>
                        {sub.category} · by <strong>{sub.submitter_name || 'Member'}</strong>
                        {sub.show_name === false && ' (asked not to be credited)'}
                        {sub.channel_name && <> · channel: {sub.channel_name}</>}
                        {' · '}{new Date(sub.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                      </div>
                      {sub.description && (
                        <div style={{ fontSize:'0.8rem', color:'var(--text-mid)', marginTop:6, lineHeight:1.55 }}>{sub.description}</div>
                      )}
                      {sub.status !== 'pending' && sub.admin_note && (
                        <div style={{ fontSize:'0.74rem', color:'var(--text-mid)', marginTop:5, fontStyle:'italic' }}>Note: {sub.admin_note}</div>
                      )}
                      <button onClick={() => setPreviewId(previewId === sub.id ? null : sub.id)}
                        style={{ marginTop:6, background:'none', border:'none', padding:0, color:'var(--brand-mid)', fontWeight:700, fontSize:'0.76rem', cursor:'pointer' }}>
                        {previewId === sub.id ? '▲ Hide preview' : '▶ Watch preview'}
                      </button>
                    </div>
                  </div>

                  {previewId === sub.id && (
                    <div style={{ marginTop:12, aspectRatio:'16/9', borderRadius:10, overflow:'hidden', background:'#000', maxWidth:560 }}>
                      <iframe src={`https://www.youtube.com/embed/${sub.video_id}?rel=0&modestbranding=1`} title={sub.title}
                        allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
                        style={{ width:'100%', height:'100%', border:'none', display:'block' }} />
                    </div>
                  )}

                  {(sub.status === 'pending' || sub.status === 'approved' || sub.status === 'rejected') && (
                    <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      {sub.status !== 'approved' && (
                        <input
                          style={{ ...{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.82rem', outline:'none', boxSizing:'border-box' }, flex:'1 1 220px', width:'auto' }}
                          value={notes[sub.id] || ''} maxLength={300}
                          onChange={e => setNotes(n => ({ ...n, [sub.id]: e.target.value }))}
                          placeholder="Optional note to the member (shown in their email)"
                        />
                      )}
                      {sub.status === 'pending' && (<>
                        <button disabled={busy} onClick={() => handleReview(sub, 'approve')} style={btn('#16a34a', 'white', '#16a34a')}>{busy ? '…' : '✅ Approve'}</button>
                        <button disabled={busy} onClick={() => handleReview(sub, 'reject')}  style={btn('#fff5f5', '#dc2626', '#fecaca')}>✕ Decline</button>
                      </>)}
                      {sub.status === 'approved' && (<>
                        <button disabled={busy} onClick={() => handlePinSubmission(sub)} style={btn('#fffbeb', '#b45309', '#fde68a')}>📌 Pin to top</button>
                        <button disabled={busy} onClick={() => handleReview(sub, 'remove')} style={btn('#fff5f5', '#dc2626', '#fecaca')}>Remove</button>
                      </>)}
                      {sub.status === 'rejected' && (
                        <button disabled={busy} onClick={() => handleReview(sub, 'approve')} style={btn('white', '#16a34a', '#bbf7d0')}>Approve anyway</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

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
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Divine Service" />
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

    </div>
  )
}
