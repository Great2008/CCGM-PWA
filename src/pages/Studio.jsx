import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

const CATEGORIES = ['All', 'Sermons', 'Worship & Praise', 'Choir', 'Bible Study', 'Events & Programs', 'Testimonies', 'Devotionals']

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function VideoModal({ item, onClose }) {
  const ytId = getYouTubeId(item.media_url)
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
          <div>
            <div style={{ color: 'var(--gold)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>{item.category}</div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem,2.5vw,1.4rem)', lineHeight: 1.3 }}>{item.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flexShrink: 0 }}>✕ Close</button>
        </div>
        {ytId ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} title={item.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <video src={item.media_url} controls autoPlay style={{ width: '100%', borderRadius: 12, background: '#000' }} />
        )}
        {item.description && <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 14, fontSize: '0.88rem', lineHeight: 1.7 }}>{item.description}</p>}
      </div>
    </div>
  )
}

function AudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
      <audio ref={audioRef} src={src}
        onTimeUpdate={e => setProgress(e.target.currentTime)}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => setPlaying(false)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={toggle} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1 }}>
          <input type="range" min={0} max={duration || 1} value={progress}
            onChange={e => { audioRef.current.currentTime = e.target.value; setProgress(+e.target.value) }}
            style={{ width: '100%', accentColor: 'var(--gold)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudioCard({ item, onClick }) {
  const ytId = getYouTubeId(item.media_url)
  const thumb = item.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null)
  const isClickable = item.type === 'video' || ytId  // music with YT link opens modal too

  return (
    <div onClick={() => isClickable && onClick(item)}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', cursor: isClickable ? 'pointer' : 'default', transition: 'transform 0.2s, border-color 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>

      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#111', overflow: 'hidden' }}>
        {thumb ? (
          <img src={thumb} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', background: 'linear-gradient(135deg,#0f1f3d,#1a3a6b)' }}>
            {item.type === 'video' ? '🎬' : '🎵'}
          </div>
        )}
        {isClickable && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(245,158,11,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>▶</div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span style={{ background: item.type === 'video' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)', color: 'white', fontSize: '0.62rem', fontWeight: 900, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {item.type === 'video' ? '▶ Video' : '♪ Music'}
          </span>
          {item.featured && <span style={{ background: 'rgba(245,158,11,0.9)', color: 'var(--brand-deep)', fontSize: '0.62rem', fontWeight: 900, padding: '3px 8px', borderRadius: 6 }}>★ Featured</span>}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>{item.category}</div>
        <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(0.9rem,2vw,1.05rem)', lineHeight: 1.35, marginBottom: 6 }}>{item.title}</h3>
        {item.series && <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>📂 {item.series}</div>}
        {item.description && <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>}
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</div>
        {/* Only show HTML5 audio player for non-YouTube direct audio links */}
        {item.type === 'music' && item.media_url && !ytId && <AudioPlayer src={item.media_url} />}
      </div>
    </div>
  )
}

function SubmitModal({ user, onClose, onSubmitted }) {
  const [form, setForm] = useState({ type: 'video', title: '', media_url: '', category: 'Sermons', series: '', description: '', thumbnail_url: '' })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const F = k => ({ value: form[k] || '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const submit = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('studio_items').insert({
      ...form, status: 'pending', submitted_by: user.id, published: false,
      date: new Date().toISOString().split('T')[0],
    })
    if (!error) { setDone(true); onSubmitted?.() }
    setSaving(false)
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const inp = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px', color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', outline: 'none' }
  const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d1b35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 'clamp(24px,4vw,36px)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.3rem', marginBottom: 10 }}>Submitted!</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 24 }}>Your content has been submitted for review. It will appear on CCG Studio once approved by an admin.</p>
            <button onClick={onClose} style={{ background: 'var(--gold)', color: 'var(--brand-deep)', border: 'none', borderRadius: 30, padding: '11px 28px', fontWeight: 900, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.3rem' }}>Submit Content</h2>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>✕</button>
            </div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Type toggle */}
              <div>
                <label style={lbl}>Content Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['video','music'].map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${form.type === t ? 'var(--gold)' : 'rgba(255,255,255,0.12)'}`, background: form.type === t ? 'rgba(245,158,11,0.15)' : 'transparent', color: form.type === t ? 'var(--gold)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', textTransform: 'capitalize' }}>
                      {t === 'video' ? '🎬 Video' : '🎵 Music'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={lbl}>Title *</label><input {...F('title')} required style={inp} placeholder="e.g. Amazing Grace — Sunday Choir" /></div>
              <div><label style={lbl}>{form.type === 'video' ? 'YouTube / Video URL *' : 'Audio URL (MP3) *'}</label><input {...F('media_url')} required style={inp} placeholder={form.type === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...mp3'} /></div>
              <div>
                <label style={lbl}>Category *</label>
                <select {...F('category')} required style={{ ...inp, cursor: 'pointer' }}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Series / Album</label><input {...F('series')} style={inp} placeholder="e.g. Sunday Choir Vol. 1" /></div>
              <div><label style={lbl}>Thumbnail URL</label><input {...F('thumbnail_url')} style={inp} placeholder="https://... (optional)" /></div>
              <div><label style={lbl}>Description</label><textarea {...F('description')} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Brief description..." /></div>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                ⏳ Your submission will be reviewed by an admin before it appears publicly.
              </div>
              <button type="submit" disabled={saving} style={{ background: 'var(--gold)', color: 'var(--brand-deep)', border: 'none', borderRadius: 30, padding: '13px', fontWeight: 900, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.92rem', opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Submitting...' : '🚀 Submit for Review'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function Studio() {
  const { user } = useAuth()
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('all')  // all | video | music
  const [category, setCategory]     = useState('All')
  const [playingItem, setPlayingItem] = useState(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [mySubmissions, setMySubmissions] = useState([])

  const load = async () => {
    const { data } = await supabase.from('studio_items').select('*').eq('status', 'published').eq('published', true).order('date', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  const loadMySubmissions = async () => {
    if (!user) return
    const { data } = await supabase.from('studio_items').select('id,title,type,status,date,rejection_reason').eq('submitted_by', user.id).order('created_at', { ascending: false })
    setMySubmissions(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadMySubmissions() }, [user])

  const featured = items.find(i => i.featured)
  const filtered = items.filter(i => {
    const matchTab = activeTab === 'all' || i.type === activeTab
    const matchCat = category === 'All' || i.category === category
    return matchTab && matchCat && !i.featured
  })

  // Group by series if a category is selected and has series
  const series = [...new Set(filtered.map(i => i.series).filter(Boolean))]
  const hasSeries = series.length > 0 && category !== 'All'

  const ytId = featured && getYouTubeId(featured.media_url)
  const featuredThumb = featured?.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null)

  return (
    <div style={{ background: '#080f1e', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .studio-tab:hover { background: rgba(255,255,255,0.08) !important; }
        .studio-cat:hover { background: rgba(255,255,255,0.08) !important; }
        @media (max-width: 600px) {
          .studio-grid { grid-template-columns: 1fr !important; }
          .studio-featured-inner { flex-direction: column !important; }
        }
        @media (max-width: 768px) {
          .studio-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ background: 'linear-gradient(180deg,#0d1b35 0%,#080f1e 100%)', padding: 'clamp(100px,14vw,140px) 5% clamp(40px,6vw,64px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%,rgba(37,99,235,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '6px 18px', borderRadius: 30, marginBottom: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>CCG Studio</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2.2rem,6vw,4rem)', color: 'white', lineHeight: 1.1, marginBottom: 16 }}>
            Videos & Music<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>from Our Community</em>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.8, fontSize: '0.95rem' }}>
            Sermons, worship, choir, and more — all in one place.
          </p>
          {user && (
            <button onClick={() => setShowSubmit(true)} style={{ background: 'var(--gold)', color: 'var(--brand-deep)', border: 'none', borderRadius: 30, padding: '12px 28px', fontWeight: 900, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem', letterSpacing: '0.06em' }}>
              + Submit Content
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 4% 80px' }}>

        {/* ── MY SUBMISSIONS STATUS ── */}
        {mySubmissions.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>My Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mySubmissions.map(s => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                    <span style={{ fontSize: '0.8rem' }}>{s.type === 'video' ? '🎬' : '🎵'}</span>
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{s.title}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0,
                      background: s.status === 'published' ? 'rgba(34,197,94,0.15)' : s.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: s.status === 'published' ? '#4ade80' : s.status === 'rejected' ? '#f87171' : 'var(--gold)',
                    }}>
                      {s.status === 'published' ? '✓ Live' : s.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                    </span>
                  </div>
                  {s.status === 'rejected' && s.rejection_reason && (
                    <div style={{ padding: '10px 16px 12px', borderTop: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>💬</span>
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Admin's Reason</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{s.rejection_reason}</div>
                      </div>
                    </div>
                  )}
                  {s.status === 'rejected' && !s.rejection_reason && (
                    <div style={{ padding: '8px 16px 10px', borderTop: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.05)', fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                      No reason provided. Contact an admin for more details.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FEATURED ── */}
        {featured && (
          <div style={{ marginBottom: 48, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '10px 18px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--gold)', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase' }}>★ Featured</span>
            </div>
            <div className="studio-featured-inner" style={{ display: 'flex', gap: 0 }}>
              {(() => {
                const fytId = getYouTubeId(featured.media_url)
                const featuredClickable = featured.type === 'video' || !!fytId
                return (
                  <>
                    <div style={{ flex: '0 0 55%', position: 'relative', paddingBottom: '31%', background: '#000', cursor: featuredClickable ? 'pointer' : 'default' }}
                      onClick={() => featuredClickable && setPlayingItem(featured)}>
                      {featuredThumb && <img src={featuredThumb} alt={featured.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />}
                      {featuredClickable && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', boxShadow: '0 0 40px rgba(245,158,11,0.4)' }}>▶</div>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, padding: 'clamp(20px,3vw,32px)' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>{featured.category}</div>
                      <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.1rem,2.5vw,1.6rem)', lineHeight: 1.3, marginBottom: 10 }}>{featured.title}</h2>
                      {featured.series && <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>📂 {featured.series}</div>}
                      {featured.description && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: 16 }}>{featured.description}</p>}
                      {featuredClickable ? (
                        <button onClick={() => setPlayingItem(featured)} style={{ background: 'var(--gold)', color: 'var(--brand-deep)', border: 'none', borderRadius: 30, padding: '10px 24px', fontWeight: 900, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                          {featured.type === 'video' ? '▶ Watch Now' : '▶ Play Now'}
                        </button>
                      ) : featured.media_url ? <AudioPlayer src={featured.media_url} /> : null}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── TAB + CATEGORY FILTERS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all','All'],['video','Videos'],['music','Music']].map(([id, label]) => (
              <button key={id} className="studio-tab" onClick={() => setActiveTab(id)} style={{ padding: '9px 20px', borderRadius: 30, border: `1.5px solid ${activeTab === id ? 'var(--gold)' : 'rgba(255,255,255,0.12)'}`, background: activeTab === id ? 'rgba(245,158,11,0.12)' : 'transparent', color: activeTab === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} className="studio-cat" onClick={() => setCategory(c)} style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${category === c ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`, background: category === c ? 'rgba(245,158,11,0.1)' : 'transparent', color: category === c ? 'var(--gold)' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem', transition: 'all 0.2s' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT GRID ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎬</div>
            <div>Loading Studio...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
            <div>No content yet in this category.</div>
          </div>
        ) : hasSeries ? (
          // Grouped by series
          <>
            {series.map(s => {
              const seriesItems = filtered.filter(i => i.series === s)
              return (
                <div key={s} style={{ marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ color: 'var(--gold)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>📂 {s}</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                  <div className="studio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {seriesItems.map(item => <StudioCard key={item.id} item={item} onClick={setPlayingItem} />)}
                  </div>
                </div>
              )
            })}
            {/* Items without a series */}
            {filtered.filter(i => !i.series).length > 0 && (
              <div className="studio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {filtered.filter(i => !i.series).map(item => <StudioCard key={item.id} item={item} onClick={setPlayingItem} />)}
              </div>
            )}
          </>
        ) : (
          <div className="studio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {filtered.map(item => <StudioCard key={item.id} item={item} onClick={setPlayingItem} />)}
          </div>
        )}
      </div>

      {/* Modals */}
      {playingItem && <VideoModal item={playingItem} onClose={() => setPlayingItem(null)} />}
      {showSubmit && <SubmitModal user={user} onClose={() => setShowSubmit(false)} onSubmitted={() => { loadMySubmissions(); setShowSubmit(false) }} />}
    </div>
  )
}
