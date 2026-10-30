import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { invokeApi } from '../lib/api'
import SEO from '../components/SEO'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
}

const fmtDuration = (iso) => {
  if (!iso) return ''
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0)
  if (h) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${min}:${String(s).padStart(2,'0')}`
}

const fmtViews = (n) => {
  if (!n) return ''
  const num = parseInt(n)
  if (num >= 1000000) return `${(num/1000000).toFixed(1)}M views`
  if (num >= 1000) return `${(num/1000).toFixed(1)}K views`
  return `${num} views`
}

// ─── API fetch helpers ───────────────────────────────────────────────────────

const fetchVideos   = () => fetch('/api/youtube/videos').then(r => r.json())
const fetchPlaylists= () => fetch('/api/youtube/playlists').then(r => r.json())
const fetchLive     = () => fetch('/api/youtube/live').then(r => r.json())

// Approved member suggestions come from the privacy-safe `studio_community` view
// (it hides names unless the member agreed to be credited).
const fetchCommunity = async () => {
  const { data, error } = await supabase.from('studio_community').select('*')
    .order('published_at', { ascending:false }).limit(100)
  if (error) throw new Error(error.message)
  return { items: (data || []).map(r => ({
    id: r.video_id, title: r.title, description: r.description, category: r.category,
    sharedBy: r.shared_by, community: true, type: 'video',
    thumbnail: `https://i.ytimg.com/vi/${r.video_id}/hqdefault.jpg`,
    publishedAt: r.published_at,
  })) }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:'#dc2626', color:'white', fontSize:'0.65rem',
      fontWeight:800, letterSpacing:'0.1em', padding:'3px 8px',
      borderRadius:4, textTransform:'uppercase',
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'white', animation:'studio-pulse 1.2s ease infinite' }} />
      LIVE
    </span>
  )
}

function PinBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      background:'var(--gold,#f59e0b)', color:'#1a1a1a', fontSize:'0.62rem',
      fontWeight:800, letterSpacing:'0.08em', padding:'2px 7px',
      borderRadius:4, textTransform:'uppercase',
    }}>📌 Featured</span>
  )
}

function VideoCard({ item, onPlay }) {
  const [hov, setHov] = useState(false)
  const isLive = item.isLive
  const isPinned = item.pinned

  return (
    <div
      onClick={() => onPlay(item)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor:'pointer', borderRadius:12, overflow:'hidden',
        background:'var(--surface,#fff)',
        boxShadow: hov ? '0 8px 32px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.07)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition:'all 0.22s ease',
        border: isPinned ? '2px solid var(--gold,#f59e0b)' : '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position:'relative', aspectRatio:'16/9', background:'#0f172a', overflow:'hidden' }}>
        <img
          src={item.thumbnail}
          alt={item.title}
          loading="lazy"
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform 0.3s', transform: hov ? 'scale(1.04)' : 'scale(1)' }}
        />
        {/* Play overlay */}
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          opacity: hov ? 1 : 0, transition:'opacity 0.2s',
        }}>
          <div style={{
            width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.92)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.3rem',
          }}>▶</div>
        </div>
        {/* Duration badge */}
        {item.duration && !isLive && (
          <div style={{
            position:'absolute', bottom:6, right:6,
            background:'rgba(0,0,0,0.8)', color:'white',
            fontSize:'0.7rem', fontWeight:700, padding:'2px 6px', borderRadius:4,
            fontFamily:'monospace',
          }}>{item.duration}</div>
        )}
        {/* Live badge */}
        {isLive && (
          <div style={{ position:'absolute', top:8, left:8 }}><LiveBadge /></div>
        )}
        {/* Pin badge */}
        {isPinned && (
          <div style={{ position:'absolute', top:8, right:8 }}><PinBadge /></div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{
          fontWeight:700, fontSize:'0.88rem', color:'var(--text-dark,#0f172a)',
          lineHeight:1.4, marginBottom:6,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
        }}>{item.title}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {item.views && <span style={{ fontSize:'0.72rem', color:'var(--text-light,#64748b)' }}>{fmtViews(item.views)}</span>}
          {item.views && item.publishedAt && <span style={{ fontSize:'0.72rem', color:'var(--text-light,#64748b)' }}>·</span>}
          {item.publishedAt && <span style={{ fontSize:'0.72rem', color:'var(--text-light,#64748b)' }}>{fmt(item.publishedAt)}</span>}
        </div>
        {item.community && (
          <div style={{ marginTop:6, fontSize:'0.72rem', color:'var(--text-light,#64748b)' }}>
            🤝 Shared by {item.sharedBy || 'a member'}
            {item.category && item.category !== 'other' ? ` · ${CATEGORY_LABEL[item.category] || ''}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function PlaylistCard({ item, onOpen }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor:'pointer', borderRadius:12, overflow:'hidden',
        background:'var(--surface,#fff)',
        boxShadow: hov ? '0 8px 32px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.07)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition:'all 0.22s ease',
        border:'1px solid rgba(0,0,0,0.07)',
      }}
    >
      <div style={{ position:'relative', aspectRatio:'16/9', background:'#0f172a', overflow:'hidden' }}>
        <img src={item.thumbnail} alt={item.title} loading="lazy"
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', filter: hov ? 'brightness(0.7)' : 'brightness(0.85)', transition:'all 0.3s' }} />
        {/* Stacked effect */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.7)', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'white', fontSize:'0.72rem', fontWeight:700 }}>🎬 PLAYLIST</span>
          <span style={{ color:'white', fontSize:'0.72rem' }}>{item.itemCount} videos</span>
        </div>
      </div>
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text-dark,#0f172a)', lineHeight:1.4, marginBottom:4,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize:'0.75rem', color:'var(--text-light,#64748b)', lineHeight:1.5,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.description}</div>
        )}
      </div>
    </div>
  )
}

function PlayerModal({ item, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isPlaylist = item.type === 'playlist'
  // No autoplay — mobile browsers block it and cause black screen
  // Use rel=0 to hide related videos, modestbranding for cleaner look
  const embedSrc = isPlaylist
    ? `https://www.youtube.com/embed/videoseries?list=${item.id}&rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${item.id}?rel=0&modestbranding=1`

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.92)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
        animation:'studio-fadein 0.2s ease',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:900, borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ aspectRatio:'16/9', background:'#000' }}>
          <iframe
            src={embedSrc}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width:'100%', height:'100%', border:'none', display:'block' }}
          />
        </div>
        <div style={{ background:'#0f172a', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div>
            <div style={{ color:'white', fontWeight:700, fontSize:'0.95rem', lineHeight:1.4 }}>{item.title}</div>
            {item.publishedAt && <div style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.75rem', marginTop:4 }}>{fmt(item.publishedAt)}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'white', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', flexShrink:0 }}>✕ Close</button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ tab }) {
  const msgs = {
    videos: { icon:'🎬', text:'No videos found. Check your internet connection and try gain.' },
    playlists: { icon:'📂', text:'No playlists found on this channel.' },
    live: { icon:'📡', text:'No live streams active right now.' },
    community: { icon:'🤝', text:'No community videos yet. Be the first to suggest one!' },
  }
  const { icon, text } = msgs[tab] || msgs.videos
  return (
    <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-light,#64748b)' }}>
      <div style={{ fontSize:'3rem', marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:'0.9rem' }}>{text}</div>
    </div>
  )
}

function ErrorState({ onRetry }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 20px' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div>
      <div style={{ color:'var(--text-dark,#0f172a)', fontWeight:700, marginBottom:6 }}>Couldn't load YouTube content</div>
      <div style={{ color:'var(--text-light,#64748b)', fontSize:'0.85rem', marginBottom:20 }}>Check your internet connection and try again</div>
      <button onClick={onRetry} style={{ padding:'10px 24px', borderRadius:40, background:'var(--brand-mid,#1d4ed8)', color:'white', border:'none', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
        Try Again
      </button>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
      {[...Array(8)].map((_,i) => (
        <div key={i} style={{ borderRadius:12, overflow:'hidden', background:'var(--surface,#fff)', border:'1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ aspectRatio:'16/9', background:'linear-gradient(90deg,#f0f4fa 25%,#e2e8f0 50%,#f0f4fa 75%)', backgroundSize:'200% 100%', animation:'studio-shimmer 1.4s ease infinite' }} />
          <div style={{ padding:'12px 14px 14px' }}>
            <div style={{ height:14, borderRadius:4, background:'#f0f4fa', marginBottom:8, animation:'studio-shimmer 1.4s ease infinite' }} />
            <div style={{ height:12, borderRadius:4, background:'#f0f4fa', width:'60%', animation:'studio-shimmer 1.4s ease infinite' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Community suggestions ──────────────────────────────────

const CATEGORY_OPTIONS = [
  ['sermon','Sermon'], ['teaching','Teaching'], ['worship','Worship / Music'],
  ['testimony','Testimony'], ['other','Other'],
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS)

const STATUS_STYLE = {
  pending:  { bg:'#fef3c7', fg:'#92400e', label:'⏳ Waiting for review' },
  approved: { bg:'#dcfce7', fg:'#166534', label:'✅ Live on Studio' },
  rejected: { bg:'#fee2e2', fg:'#991b1b', label:'Not approved' },
}

const previewIdOf = (s) => (s || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/)?.[1] || null

const labelStyle = { display:'block', fontSize:'0.74rem', fontWeight:700, color:'var(--text-mid,#475569)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }
const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', outline:'none', boxSizing:'border-box', background:'white', color:'var(--text-dark,#0f172a)' }

function ModalShell({ onClose, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, animation:'studio-fadein 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', background:'var(--surface,#fff)', borderRadius:18, boxShadow:'0 24px 70px rgba(0,0,0,0.4)' }}>
        {children}
      </div>
    </div>
  )
}

function SignInPrompt({ suspended, onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding:'32px 28px', textAlign:'center' }}>
        <div style={{ fontSize:'2.6rem', marginBottom:10 }}>{suspended ? '🚫' : '🎬'}</div>
        <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep,#0a2612)', margin:'0 0 10px', fontSize:'1.2rem' }}>
          {suspended ? 'Suggestions are paused' : 'Sign in to suggest a video'}
        </h3>
        <p style={{ color:'var(--text-mid,#475569)', fontSize:'0.9rem', lineHeight:1.65, margin:'0 0 22px' }}>
          {suspended
            ? 'Your account is currently suspended, so you can’t suggest videos right now.'
            : 'Members of the CCG World community can suggest videos for the Studio page. Join or sign in on the Timeline page, then come back here.'}
        </p>
        {!suspended && (
          <Link to="/timeline" className="btn btn-gold" style={{ display:'inline-block', padding:'11px 26px', marginBottom:12 }}>🌐 Sign In / Join</Link>
        )}
        <div><button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-light,#64748b)', cursor:'pointer', fontWeight:600, fontSize:'0.85rem' }}>Close</button></div>
      </div>
    </ModalShell>
  )
}

function SuggestModal({ user, onClose }) {
  const [view, setView]               = useState('form')   // 'form' | 'mine'
  const [url, setUrl]                 = useState('')
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState('sermon')
  const [showName, setShowName]       = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(false)
  const [agreed, setAgreed]           = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [mine, setMine]               = useState(null)

  const loadMine = useCallback(async () => {
    const { data } = await supabase.from('studio_submissions')
      .select('id,video_id,title,status,category,admin_note,created_at')
      .eq('user_id', user.id).order('created_at', { ascending:false }).limit(30)
    setMine(data || [])
  }, [user.id])

  useEffect(() => { loadMine() }, [loadMine])

  const vid = previewIdOf(url)
  const canSubmit = !!vid && agreed && !submitting

  const submit = async () => {
    setError(''); setSubmitting(true)
    const { error: err } = await invokeApi('studio-submit', { body: { url: url.trim(), title: title.trim(), description: description.trim(), category, showName } })
    setSubmitting(false)
    if (err) { setError(err.message || 'Something went wrong. Please try again.'); return }
    setDone(true); loadMine()
  }

  const again = () => { setUrl(''); setTitle(''); setDescription(''); setCategory('sermon'); setError(''); setDone(false); setView('form') }

  const tabBtn = (id, text) => (
    <button onClick={() => setView(id)} style={{
      flex:1, padding:'11px 8px', border:'none', background:'none', cursor:'pointer',
      fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.82rem',
      color: view===id ? 'var(--brand-mid,#1d4ed8)' : 'var(--text-light,#64748b)',
      borderBottom: view===id ? '2.5px solid var(--brand-mid,#1d4ed8)' : '2.5px solid transparent',
    }}>{text}</button>
  )

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding:'22px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep,#0a2612)', margin:0, fontSize:'1.2rem' }}>➕ Suggest a Video</h3>
        <button onClick={onClose} aria-label="Close" style={{ background:'#f1f5f9', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:'1rem' }}>✕</button>
      </div>
      <div style={{ display:'flex', margin:'12px 24px 0', borderBottom:'1px solid rgba(0,0,0,0.08)' }}>
        {tabBtn('form', 'New suggestion')}
        {tabBtn('mine', `My suggestions${mine?.length ? ` (${mine.length})` : ''}`)}
      </div>

      {view === 'form' && !done && (
        <div style={{ padding:'20px 24px 24px' }}>
          <p style={{ margin:'0 0 16px', fontSize:'0.82rem', color:'var(--text-light,#64748b)', lineHeight:1.6 }}>
            Share a YouTube video you think the community would be blessed by. Our team reviews every suggestion before it appears.
          </p>

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>YouTube link *</label>
            <input style={inputStyle} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtu.be/…" inputMode="url" autoCapitalize="none" autoCorrect="off" />
          </div>

          {vid && (
            <div style={{ marginBottom:14, borderRadius:10, overflow:'hidden', aspectRatio:'16/9', background:'#0f172a' }}>
              <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="Video preview" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Title (optional)</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Leave blank to use the YouTube title" />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Why share this? (optional)</label>
            <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical' }} value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="A sentence or two about what it is and who it’s for" />
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, fontSize:'0.85rem', color:'var(--text-mid,#475569)', cursor:'pointer' }}>
            <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} style={{ width:18, height:18 }} />
            Credit me by name on the Studio page
          </label>

          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
            <div style={{ fontSize:'0.74rem', fontWeight:700, color:'var(--text-mid,#475569)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Guidelines</div>
            <ul style={{ margin:0, paddingLeft:18, fontSize:'0.8rem', color:'var(--text-mid,#475569)', lineHeight:1.65 }}>
              <li>Share videos that encourage faith: sermons, teaching, worship and testimonies.</li>
              <li>The video must be public on YouTube, and be yours or from its original channel.</li>
              <li>No promotion or selling, and nothing unkind or unsuitable for families.</li>
            </ul>
            <button type="button" onClick={() => setShowGuidelines(v => !v)} style={{ marginTop:8, background:'none', border:'none', padding:0, color:'var(--brand-mid,#1d4ed8)', fontWeight:700, fontSize:'0.78rem', cursor:'pointer' }}>
              {showGuidelines ? 'Hide full guidelines ▴' : 'Read the full guidelines ▾'}
            </button>
            {showGuidelines && (
              <ol style={{ margin:'10px 0 0', paddingLeft:20, fontSize:'0.8rem', color:'var(--text-mid,#475569)', lineHeight:1.65 }}>
                <li><strong>Edifying and on-mission.</strong> Sermons, teachings, worship, testimonies and encouragement that fit the faith and values of CCG World.</li>
                <li><strong>Public and playable.</strong> The video must be public on YouTube and allow embedding, or it can’t play here.</li>
                <li><strong>Yours to share.</strong> Suggest your own videos or ones from the original channel. Please don’t suggest re-uploads of someone else’s content, especially music and full sermons.</li>
                <li><strong>No promotion.</strong> No selling, fundraising or campaigning, and no advertising of products, ministries or businesses.</li>
                <li><strong>Clean and kind.</strong> Nothing hateful, abusive, graphic or unsuitable for a family audience.</li>
                <li><strong>Reviewed by our team.</strong> Every suggestion is reviewed before it appears. We may decline one, or take a video down later, if it no longer fits.</li>
                <li><strong>Limits.</strong> Up to 3 suggestions waiting at a time and 5 per day. You’ll get an email with the decision.</li>
              </ol>
            )}
          </div>

          <label style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:18, fontSize:'0.85rem', color:'var(--text-mid,#475569)', cursor:'pointer', lineHeight:1.5 }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width:18, height:18, marginTop:1, flexShrink:0 }} />
            I’ve read the guidelines and this video follows them
          </label>

          {error && (
            <div style={{ background:'#fee2e2', color:'#991b1b', borderRadius:10, padding:'10px 14px', fontSize:'0.84rem', lineHeight:1.5, marginBottom:14 }}>{error}</div>
          )}

          <button onClick={submit} disabled={!canSubmit} style={{
            width:'100%', padding:'13px', borderRadius:12, border:'none', fontWeight:800, fontSize:'0.95rem',
            fontFamily:'var(--font-body)', color:'white', cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? 'linear-gradient(135deg,var(--brand-base,#16a34a),var(--brand-mid,#1d4ed8))' : '#9ca3af',
          }}>{submitting ? '⏳ Checking your video…' : 'Submit for review'}</button>
        </div>
      )}

      {view === 'form' && done && (
        <div style={{ padding:'32px 24px 28px', textAlign:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:10 }}>🙏</div>
          <h4 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep,#0a2612)', margin:'0 0 8px', fontSize:'1.15rem' }}>Thank you for sharing!</h4>
          <p style={{ color:'var(--text-mid,#475569)', fontSize:'0.9rem', lineHeight:1.65, margin:'0 0 22px' }}>
            Your suggestion is with our team. We’ll email you as soon as there’s a decision, and you can follow its status under “My suggestions”.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={again} style={{ padding:'10px 20px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', fontWeight:700, cursor:'pointer' }}>Suggest another</button>
            <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'var(--brand-mid,#1d4ed8)', color:'white', fontWeight:700, cursor:'pointer' }}>Done</button>
          </div>
        </div>
      )}

      {view === 'mine' && (
        <div style={{ padding:'8px 24px 24px' }}>
          {mine === null && <div style={{ textAlign:'center', padding:28, color:'var(--text-light,#64748b)' }}>⏳ Loading…</div>}
          {mine && mine.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 8px', color:'var(--text-light,#64748b)', fontSize:'0.88rem' }}>You haven’t suggested anything yet.</div>
          )}
          {mine && mine.map(m => {
            const st = STATUS_STYLE[m.status] || STATUS_STYLE.pending
            return (
              <div key={m.id} style={{ display:'flex', gap:12, padding:'14px 0', borderBottom:'1px solid #f0f4fa' }}>
                <img src={`https://i.ytimg.com/vi/${m.video_id}/default.jpg`} alt="" style={{ width:80, height:45, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'0.86rem', color:'var(--text-dark,#0f172a)', lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                  <span style={{ display:'inline-block', marginTop:5, background:st.bg, color:st.fg, fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:6 }}>{st.label}</span>
                  {m.status === 'rejected' && m.admin_note && (
                    <div style={{ marginTop:5, fontSize:'0.76rem', color:'var(--text-mid,#475569)', lineHeight:1.5 }}>Reason: {m.admin_note}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ModalShell>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const TABS = ['videos', 'playlists', 'community', 'live']
const TAB_LABELS = { videos:'Videos', playlists:'Playlists', community:'🤝 Community', live:'🔴 Live' }

export default function Studio() {
  const [tab, setTab]         = useState('videos')
  const [data, setData]       = useState({ videos:null, playlists:null, community:null, live:null })
  const [loading, setLoading] = useState({ videos:false, playlists:false, community:false, live:false })
  const [error, setError]     = useState({ videos:false, playlists:false, community:false, live:false })
  const [pins, setPins]       = useState([])   // admin-pinned items from Supabase
  const [playing, setPlaying] = useState(null) // item in modal
  const [search, setSearch]   = useState('')
  const { user, profile } = useAuth()
  const [showSuggest, setShowSuggest] = useState(false)
  const [showSignIn, setShowSignIn]   = useState(false)
  const openSuggest = () => { (user && !profile?.suspended) ? setShowSuggest(true) : setShowSignIn(true) }

  // Load admin pins from Supabase
  useEffect(() => {
    supabase.from('studio_pins').select('*').order('created_at', { ascending:false })
      .then(({ data }) => { if (data) setPins(data) })
      .catch(() => {})
  }, [])

  const loadTab = useCallback(async (t) => {
    if (data[t] !== null) return   // already loaded
    setLoading(l => ({ ...l, [t]:true }))
    setError(e => ({ ...e, [t]:false }))
    try {
      const fetchers = { videos:fetchVideos, playlists:fetchPlaylists, community:fetchCommunity, live:fetchLive }
      const result = await fetchers[t]()
      if (result.error) throw new Error(result.error)
      setData(d => ({ ...d, [t]:result.items || [] }))
    } catch(e) {
      setError(er => ({ ...er, [t]:true }))
    } finally {
      setLoading(l => ({ ...l, [t]:false }))
    }
  }, [data])

  useEffect(() => { loadTab(tab) }, [tab])

  const retry = () => {
    setData(d => ({ ...d, [tab]:null }))
    setError(e => ({ ...e, [tab]:false }))
    setTimeout(() => loadTab(tab), 50)
  }

  // Merge pins + YouTube items for video tab
  const buildItems = () => {
    const raw = data[tab] || []

    if (tab === 'videos') {
      // Attach pinned flag to any YouTube video that's also pinned
      const pinnedIds = new Set(pins.map(p => p.video_id))
      const ytItems = raw.map(v => ({ ...v, pinned: pinnedIds.has(v.id) }))

      // Manual-only pins (not in YT results — e.g. older videos)
      const ytIds = new Set(raw.map(v => v.id))
      const manualPins = pins
        .filter(p => !ytIds.has(p.video_id))
        .map(p => ({
          id: p.video_id,
          title: p.title,
          thumbnail: `https://i.ytimg.com/vi/${p.video_id}/hqdefault.jpg`,
          publishedAt: p.created_at,
          pinned: true,
          type: 'video',
        }))

      const pinned   = [...manualPins, ...ytItems.filter(v => v.pinned)]
      const unpinned = ytItems.filter(v => !v.pinned)
      return [...pinned, ...unpinned]
    }

    return raw
  }

  const items = buildItems()

  const filtered = search.trim()
    ? items.filter(v => v.title?.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <>
      <SEO
        title="Studio"
        description="CCG World Studio — sermons, teachings and worship videos from the Christian Church Of God Mission YouTube channel."
        path="/studio"
      />
      <style>{`
        @keyframes studio-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes studio-pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes studio-fadein  { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* Hero */}
      <div style={{ background:'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=80") center/cover no-repeat', padding:'clamp(90px,14vw,110px) 5% 48px', marginBottom:0 }}>
        <div className="container" style={{ maxWidth:1100 }}>
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--gold,#f59e0b)', display:'block', marginBottom:10 }}>
            🎬 Media
          </span>
          <h1 style={{ fontFamily:'var(--font-display)', color:'white', fontSize:'clamp(1.8rem,4vw,2.6rem)', margin:'0 0 10px', fontWeight:900 }}>
            CCG Studio
          </h1>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.95rem', margin:0 }}>
            Sermons, teachings, worship &amp; live broadcasts from CCG World
          </p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ background:'var(--surface,#fff)', borderBottom:'1px solid rgba(0,0,0,0.08)', position:'sticky', top:0, zIndex:50 }}>
        <div className="container" style={{ maxWidth:1100, display:'flex', alignItems:'center', gap:0, justifyContent:'space-between', flexWrap:'wrap' }}>
          {/* Tabs */}
          <div style={{ display:'flex' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:'14px 20px', border:'none', background:'none', cursor:'pointer',
                fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.85rem',
                color: tab===t ? 'var(--brand-mid,#1d4ed8)' : 'var(--text-light,#64748b)',
                borderBottom: tab===t ? '2.5px solid var(--brand-mid,#1d4ed8)' : '2.5px solid transparent',
                transition:'all 0.18s', whiteSpace:'nowrap',
              }}>{TAB_LABELS[t]}</button>
            ))}
          </div>
          {/* Search */}
          <div style={{ padding:'8px 0', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={openSuggest} style={{
              padding:'8px 16px', borderRadius:30, border:'none', cursor:'pointer', whiteSpace:'nowrap',
              background:'var(--gold,#f59e0b)', color:'#1a1a1a', fontWeight:800, fontSize:'0.8rem', fontFamily:'var(--font-body)',
            }}>➕ Suggest a video</button>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ padding:'8px 14px', borderRadius:30, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.85rem', outline:'none', width:180 }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container" style={{ maxWidth:1100, padding:'32px 5% 64px' }}>

        {/* Live banner */}
        {tab === 'live' && data.live?.length > 0 && (
          <div style={{ background:'linear-gradient(135deg,#7f1d1d,#dc2626)', borderRadius:14, padding:'14px 20px', marginBottom:28, display:'flex', alignItems:'center', gap:12 }}>
            <LiveBadge />
            <span style={{ color:'white', fontWeight:700, fontSize:'0.9rem' }}>
              {data.live.length} stream{data.live.length > 1 ? 's' : ''} currently live
            </span>
          </div>
        )}

        {tab === 'community' && (
          <div style={{ background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.2)', borderRadius:12, padding:'12px 18px', marginBottom:24, fontSize:'0.85rem', color:'var(--text-mid,#475569)', lineHeight:1.6 }}>
            🤝 Videos suggested by members of our community and reviewed by our team before they appear here.
          </div>
        )}

        {loading[tab] && <SkeletonGrid />}

        {!loading[tab] && error[tab] && <ErrorState onRetry={retry} />}

        {!loading[tab] && !error[tab] && filtered.length === 0 && (
          search ? (
            <div style={{ textAlign:'center', padding:'64px 20px', color:'var(--text-light,#64748b)' }}>
              No results for "<strong>{search}</strong>"
            </div>
          ) : <EmptyState tab={tab} />
        )}

        {!loading[tab] && !error[tab] && filtered.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
            {filtered.map(item =>
              tab === 'playlists'
                ? <PlaylistCard key={item.id} item={item} onOpen={v => setPlaying({ ...v, type:'playlist' })} />
                : <VideoCard key={item.id} item={item} onPlay={v => setPlaying({ ...v, type:'video' })} />
            )}
          </div>
        )}
      </div>

      {showSuggest && user && <SuggestModal user={user} onClose={() => setShowSuggest(false)} />}
      {showSignIn && <SignInPrompt suspended={!!(user && profile?.suspended)} onClose={() => setShowSignIn(false)} />}

      {/* Player modal */}
      {playing && <PlayerModal item={playing} onClose={() => setPlaying(null)} />}
    </>
  )
}
