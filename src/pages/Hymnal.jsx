import { useState, useRef, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import SACRED_SONGS from '../data/sacredSongsData'

const CACHE_KEY     = 'ccgworld_hymns'
const CACHE_TTL     = 24 * 60 * 60 * 1000
const FONT_SIZE_KEY = 'ccgworld_hymnal_fontsize'

function loadCache(ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const data = Array.isArray(parsed) ? parsed : parsed.data
    const ts   = Array.isArray(parsed) ? 0     : parsed.ts
    if (!data || data.length === 0) return null
    if (!ignoreExpiry && ts && Date.now() - ts > CACHE_TTL && navigator.onLine) return null
    return data
  } catch { return null }
}
function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
}
function firstHymn(hymns) {
  if (!hymns?.length) return null
  return [...hymns].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))[0]
}
function getVerses(hymn) {
  if (!hymn?.verses) return []
  if (Array.isArray(hymn.verses)) return hymn.verses
  try { return JSON.parse(hymn.verses) } catch { return [] }
}
function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function AudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  useEffect(() => {
    setPlaying(false); setProgress(0); setDuration(0)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
  }, [src])
  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '14px 18px', marginTop: 16 }}>
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={toggle} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--gold)', color: 'var(--brand-deep)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1 }}>
          <div onClick={e => {
            if (!audioRef.current) return
            audioRef.current.currentTime = (e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * audioRef.current.duration
          }} style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gold)', borderRadius: 4, transition: 'width 0.2s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
            <span>{fmtTime(audioRef.current?.currentTime || 0)}</span>
            <span>🎵 Audio</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sacred Songs & Solos Tab ──────────────────────────────────────────────────
function SacredSongsTab({ fontSize, changeFontSize }) {
  const [selected, setSelected] = useState(SACRED_SONGS[0])
  const [search,   setSearch]   = useState('')
  const [showList, setShowList] = useState(false)

  const filtered = SACRED_SONGS.filter(s =>
    !search ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.author.toLowerCase().includes(search.toLowerCase())
  )
  const idx      = filtered.findIndex(s => s.id === selected?.id)
  const prevSong = filtered[idx + 1]
  const nextSong = filtered[idx - 1]
  const pick = s => { setSelected(s); setShowList(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const SongRow = ({ s, compact = false }) => {
    const isSel = selected?.id === s.id
    return (
      <div onClick={() => pick(s)} className="hm-item"
        style={{ padding: compact ? '11px 14px' : '13px 20px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSel ? 'var(--brand-pale)' : 'white', borderLeft: `${compact?3:4}px solid ${isSel ? 'var(--brand-light)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: compact?10:12 }}>
        <div style={{ width: compact?28:32, height: compact?28:32, borderRadius: compact?7:8, background: isSel ? 'var(--brand-base)' : compact?'var(--brand-mist,#f0fdf4)':'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem', color: isSel ? 'white' : 'var(--brand-mid)', flexShrink: 0 }}>
          {s.number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: isSel?700:500, color: 'var(--brand-deep)', fontSize: compact?'0.82rem':'0.88rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
          {s.author && <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 1 }}>{s.author}</div>}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile sticky bar */}
      <div className="hm-mobile-bar" style={{ display:'none', position:'sticky', top:0, zIndex:100, background:'var(--brand-deep)', padding:'10px 14px', alignItems:'center', gap:10, boxShadow:'0 2px 12px rgba(0,0,0,0.3)' }}>
        <button onClick={() => setShowList(true)} style={{ display:'flex', alignItems:'center', gap:8, flex:1, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:10, padding:'10px 14px', cursor:'pointer', color:'white', fontFamily:'var(--font-body)', fontSize:'0.85rem', fontWeight:600, textAlign:'left' }}>
          <span>📖</span>
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selected ? `#${selected.number} ${selected.title}` : 'Pick a song'}</span>
          <span style={{ opacity:0.55, fontSize:'0.7rem' }}>▼</span>
        </button>
        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          <button onClick={() => changeFontSize(-1)} style={{ width:38, height:38, borderRadius:9, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.1)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:900, fontSize:'0.85rem' }}>T−</button>
          <button onClick={() => changeFontSize(1)}  style={{ width:38, height:38, borderRadius:9, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.1)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:900, fontSize:'0.85rem' }}>T+</button>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {showList && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.6)', display:'flex', flexDirection:'column' }} onClick={() => setShowList(false)}>
          <div style={{ marginTop:'auto', background:'white', borderRadius:'20px 20px 0 0', maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}><div style={{ width:40, height:4, borderRadius:2, background:'#d1fae5' }}/></div>
            <div style={{ padding:'8px 18px 14px', borderBottom:'1px solid #f0fdf4' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, color:'var(--brand-deep)', fontSize:'1rem', marginBottom:10 }}>Sacred Songs & Solos</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search songs or authors..." style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #d1fae5', fontFamily:'var(--font-body)', fontSize:'0.92rem', boxSizing:'border-box' }}/>
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>{filtered.map(s => <SongRow key={s.id} s={s}/>)}</div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="hm-outer" style={{ maxWidth:1100, margin:'0 auto', padding:'32px 4% 80px' }}>
        <div className="hm-content-wrap" style={{ display:'block' }}>
          {/* Desktop sidebar */}
          <div className="hm-desktop-sidebar" style={{ display:'none' }}>
            <div style={{ background:'white', borderRadius:16, boxShadow:'var(--shadow-sm)', border:'1.5px solid #d1fae5', overflow:'hidden', position:'sticky', top:24 }}>
              <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid #f0fdf4' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search songs..." style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid #d1fae5', fontFamily:'var(--font-body)', fontSize:'0.85rem', boxSizing:'border-box' }}/>
              </div>
              <div style={{ maxHeight:520, overflowY:'auto' }}>{filtered.map(s => <SongRow key={s.id} s={s} compact/>)}</div>
            </div>
          </div>

          {/* Content */}
          <div>
            {!selected ? (
              <div style={{ background:'white', borderRadius:16, padding:48, textAlign:'center', boxShadow:'var(--shadow-sm)', border:'1.5px solid #d1fae5' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>📖</div>
                <div style={{ color:'var(--text-light)' }}>Select a song to read</div>
              </div>
            ) : (
              <div className="hm-card" style={{ background:'white', borderRadius:16, boxShadow:'var(--shadow-sm)', border:'1.5px solid #d1fae5', overflow:'hidden' }}>
                {/* Header */}
                <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'clamp(20px,4vw,32px) clamp(18px,4vw,32px) 0' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--gold)', color:'var(--brand-deep)', padding:'4px 14px', borderRadius:20, fontSize:'0.72rem', fontWeight:900, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>
                        📖 SONG #{selected.number}
                      </div>
                      <h2 style={{ fontFamily:'var(--font-display)', color:'white', fontSize:'clamp(1.3rem,4.5vw,2rem)', margin:'0 0 6px', lineHeight:1.25 }}>{selected.title}</h2>
                      {selected.author && <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.88rem', margin:0 }}>✍️ {selected.author}</p>}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={() => changeFontSize(-1)} style={{ padding:'6px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.12)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:900, fontSize:'0.82rem' }}>T−</button>
                      <button onClick={() => changeFontSize(1)}  style={{ padding:'6px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.12)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:900, fontSize:'0.82rem' }}>T+</button>
                    </div>
                  </div>
                  <div style={{ height:20 }}/>
                </div>

                {/* Lyrics */}
                <div style={{ padding:'clamp(20px,5vw,36px)', maxHeight:600, overflowY:'auto' }}>
                  {selected.verses.map((verse, i) => (
                    <div key={i} style={{ marginBottom:28 }}>
                      <div style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--brand-light)', marginBottom:8 }}>Verse {i + 1}</div>
                      <p style={{ fontSize:fontSize+'px', lineHeight:2.1, color:'var(--text-dark)', whiteSpace:'pre-line', fontStyle:'italic', margin:0 }}>{verse}</p>
                    </div>
                  ))}
                  {selected.chorus && (
                    <div style={{ background:'var(--brand-pale)', borderRadius:12, padding:'18px 22px', borderLeft:'4px solid var(--gold)', marginBottom:24 }}>
                      <div style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--gold)', marginBottom:8 }}>Chorus</div>
                      <p style={{ fontSize:fontSize+'px', lineHeight:2.1, color:'var(--brand-deep)', whiteSpace:'pre-line', fontWeight:700, fontStyle:'italic', margin:0 }}>{selected.chorus}</p>
                    </div>
                  )}
                  <div style={{ marginTop:8, padding:'10px 14px', background:'#f8faf8', borderRadius:8, fontSize:'0.75rem', color:'var(--text-light)' }}>
                    ✅ Available offline · Sacred Songs & Solos — Ira D. Sankey · Public Domain
                  </div>
                </div>

                {/* Prev/Next */}
                <div style={{ padding:'14px clamp(16px,4vw,28px)', borderTop:'1px solid #f0fdf4', display:'flex', justifyContent:'space-between', gap:12 }}>
                  {prevSong ? <button onClick={() => pick(prevSong)} style={{ background:'none', border:'1.5px solid #d1fae5', borderRadius:10, padding:'10px 16px', cursor:'pointer', color:'var(--text-mid)', fontFamily:'var(--font-body)', fontSize:(fontSize-3)+'px', flex:1, textAlign:'left', lineHeight:1.4 }}>{'← #'+prevSong.number+' '+(prevSong.title.length>25?prevSong.title.slice(0,25)+'…':prevSong.title)}</button> : <div/>}
                  {nextSong ? <button onClick={() => pick(nextSong)} style={{ background:'none', border:'1.5px solid #d1fae5', borderRadius:10, padding:'10px 16px', cursor:'pointer', color:'var(--text-mid)', fontFamily:'var(--font-body)', fontSize:(fontSize-3)+'px', flex:1, textAlign:'right', lineHeight:1.4 }}>{'#'+nextSong.number+' '+(nextSong.title.length>25?nextSong.title.slice(0,25)+'…':nextSong.title)+' →'}</button> : <div/>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Hymnal() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('hymnal')
  const [hymns,    setHymns]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [offline,  setOffline]  = useState(false)
  const [selected, setSelected] = useState(null)
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [showList, setShowList] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY)) || 17 } catch { return 17 }
  })
  const [favourites,   setFavourites]   = useState(new Set())
  const [favLoading,   setFavLoading]   = useState(false)
  const [showFavsOnly, setShowFavsOnly] = useState(false)

  const changeFontSize = delta => {
    setFontSize(prev => {
      const next = Math.min(26, Math.max(13, prev + delta))
      try { localStorage.setItem(FONT_SIZE_KEY, next) } catch {}
      return next
    })
  }

  const fetchFresh = useCallback(async cached => {
    try {
      const { data } = await supabase.from('hymns').select('*').eq('published', true).order('sort_order', { ascending: true })
      if (data && data.length > 0) {
        setHymns(data)
        setSelected(prev => prev ? (data.find(h => h.id === prev.id) || firstHymn(data)) : firstHymn(data))
        saveCache(data); setOffline(false)
      } else {
        if (!cached || cached.length === 0) setLoading(false)
        setOffline(true)
      }
    } catch {
      if (!cached || cached.length === 0) { setOffline(true); setLoading(false) }
      else setOffline(true)
    }
    if (!cached || cached.length === 0) setLoading(false)
  }, [])

  useEffect(() => {
    const cached = loadCache(true)
    if (cached && cached.length > 0) { setHymns(cached); setSelected(firstHymn(cached)); setLoading(false) }
    fetchFresh(cached)
  }, [fetchFresh])

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('hymn_favourites').select('hymn_id').eq('user_id', user.id)
      .then(({ data }) => { if (data) setFavourites(new Set(data.map(f => f.hymn_id))) })
  }, [user])

  useEffect(() => {
    if (!selected) return
    const el = document.getElementById('hm-item-' + selected.id)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const toggleFavourite = async (e, hymnId) => {
    if (e) e.stopPropagation()
    if (!user || favLoading) return
    setFavLoading(true)
    if (favourites.has(hymnId)) {
      await supabase.from('hymn_favourites').delete().eq('user_id', user.id).eq('hymn_id', hymnId)
      setFavourites(prev => { const n = new Set(prev); n.delete(hymnId); return n })
    } else {
      await supabase.from('hymn_favourites').insert({ user_id: user.id, hymn_id: hymnId })
      setFavourites(prev => new Set([...prev, hymnId]))
    }
    setFavLoading(false)
  }

  const categories = ['All', ...new Set(hymns.map(h => h.category).filter(Boolean))]
  const filtered = hymns.filter(h => {
    const matchCat    = category === 'All' || h.category === category
    const matchSearch = !search || h.title?.toLowerCase().includes(search.toLowerCase()) || h.author?.toLowerCase().includes(search.toLowerCase())
    const matchFav    = !showFavsOnly || favourites.has(h.id)
    return matchCat && matchSearch && matchFav
  })
  const selectHymn = hymn => { setSelected(hymn); setShowList(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const selIdx   = filtered.findIndex(h => h.id === selected?.id)
  const prevHymn = filtered[selIdx + 1]
  const nextHymn = filtered[selIdx - 1]
  const verses   = getVerses(selected)

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @media(max-width:768px){
          .hm-desktop-sidebar{display:none!important;}
          .hm-mobile-bar{display:flex!important;}
          .hm-content-wrap{display:block!important;}
          .hm-outer{padding:0 0 60px 0!important;max-width:100%!important;}
          .hm-card{border-radius:0!important;border-left:none!important;border-right:none!important;box-shadow:none!important;}
          .hm-hero{padding-left:16px!important;padding-right:16px!important;}
        }
        @media(min-width:769px){
          .hm-mobile-bar{display:none!important;}
          .hm-content-wrap{display:grid!important;grid-template-columns:270px 1fr;gap:28px;}
          .hm-desktop-sidebar{display:block!important;}
        }
        .hm-item:hover{background:var(--brand-pale)!important;}
        .hm-tab{padding:10px 22px;border-radius:30px;border:none;cursor:pointer;font-family:var(--font-body);font-weight:700;font-size:0.88rem;transition:all 0.2s;}
        .hm-tab.active{background:var(--brand-mid);color:white;}
        .hm-tab:not(.active){background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.85);}
        .hm-tab:not(.active):hover{background:rgba(255,255,255,0.25);}
      `}</style>

      {/* Hero */}
      <div className="hm-hero" style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(90px,14vw,130px) 5% 32px', textAlign: 'center' }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Worship & Praise</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 20px' }}>🎵 Hymnal</h1>

        {/* Tab switcher */}
        <div style={{ display: 'inline-flex', gap: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 40, padding: 5, marginBottom: 20 }}>
          <button className={`hm-tab${activeTab === 'hymnal' ? ' active' : ''}`} onClick={() => setActiveTab('hymnal')}>🎵 Hymnal</button>
          <button className={`hm-tab${activeTab === 'sacred' ? ' active' : ''}`} onClick={() => setActiveTab('sacred')}>📖 Sacred Songs & Solos</button>
        </div>

        {activeTab === 'hymnal' && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {isOnline ? '🟢 Online — syncing latest hymns' : '🔴 Offline — showing cached hymns'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              📴 Available Offline
            </div>
          </div>
        )}
        {activeTab === 'sacred' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
            📴 {SACRED_SONGS.length} songs — Fully offline · Ira D. Sankey · Public Domain
          </div>
        )}
      </div>

      {/* Sacred Songs tab */}
      {activeTab === 'sacred' && <SacredSongsTab fontSize={fontSize} changeFontSize={changeFontSize} />}

      {/* Hymnal tab */}
      {activeTab === 'hymnal' && (
        <>
          {offline && hymns.length > 0 && (
            <div style={{ background: '#fff9f0', borderBottom: '2px solid #fed7aa', padding: '10px 20px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-dark)', fontWeight: 600 }}>
              Offline — showing {hymns.length} cached hymn{hymns.length !== 1 ? 's' : ''}
            </div>
          )}

          {loading ? (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>🎵</div>
              <div style={{ color: 'var(--text-light)' }}>Loading hymns...</div>
            </div>
          ) : offline && hymns.length === 0 ? (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>📴</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--brand-deep)' }}>You are Offline</div>
              <div style={{ color: 'var(--text-mid)', maxWidth: 320, lineHeight: 1.7 }}>No cached hymns found. Visit the Hymnal while online at least once to enable offline access.</div>
            </div>
          ) : (
            <>
              {/* Mobile sticky bar */}
              <div className="hm-mobile-bar" style={{ display: 'none', position: 'sticky', top: 0, zIndex: 100, background: 'var(--brand-deep)', padding: '10px 14px', alignItems: 'center', gap: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                <button onClick={() => setShowList(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left' }}>
                  <span>🎵</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? `#${selected.sort_order ?? '—'} ${selected.title}` : 'Pick a hymn'}
                  </span>
                  <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>▼</span>
                </button>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => changeFontSize(-1)} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem' }}>T−</button>
                  <button onClick={() => changeFontSize(1)}  style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem' }}>T+</button>
                </div>
              </div>

              {/* Mobile bottom sheet */}
              {showList && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }} onClick={() => setShowList(false)}>
                  <div style={{ marginTop: 'auto', background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}><div style={{ width: 40, height: 4, borderRadius: 2, background: '#d1fae5' }} /></div>
                    <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid #f0fdf4' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem', marginBottom: 10 }}>All Hymns</div>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hymns or authors..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {categories.map(cat => (
                          <button key={cat} onClick={() => setCategory(cat)} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: category === cat ? 'var(--brand-mid)' : '#d1fae5', background: category === cat ? 'var(--brand-mid)' : 'white', color: category === cat ? 'white' : 'var(--text-mid)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{cat}</button>
                        ))}
                      </div>
                      {user && (
                        <button onClick={() => setShowFavsOnly(f => !f)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${showFavsOnly ? '#f59e0b' : '#d1fae5'}`, background: showFavsOnly ? '#fffbeb' : 'white', color: showFavsOnly ? '#b45309' : 'var(--text-mid)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          ❤️ Favourites {favourites.size > 0 && `(${favourites.size})`}
                        </button>
                      )}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>No hymns found</div>}
                      {filtered.map(h => {
                        const isSel = selected?.id === h.id
                        return (
                          <div key={h.id} id={'hm-item-'+h.id} className="hm-item" onClick={() => selectHymn(h)}
                            style={{ padding: '13px 20px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSel ? 'var(--brand-pale)' : 'white', borderLeft: `4px solid ${isSel ? 'var(--brand-light)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: isSel ? 'var(--brand-base)' : 'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', color: isSel ? 'white' : 'var(--brand-mid)', flexShrink: 0 }}>{h.sort_order ?? '—'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: isSel?700:500, color: 'var(--brand-deep)', fontSize: '0.9rem', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
                              {h.author && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 2 }}>{h.author}</div>}
                            </div>
                            {user && favourites.has(h.id) && <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>❤️</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Main layout */}
              <div className="hm-outer" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 4% 80px' }}>
                <div className="hm-content-wrap" style={{ display: 'block' }}>
                  <div className="hm-desktop-sidebar" style={{ display: 'none' }}>
                    <div style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden', position: 'sticky', top: 24 }}>
                      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #f0fdf4' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hymns..." style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {categories.map(cat => (
                            <button key={cat} onClick={() => setCategory(cat)} style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid', borderColor: category === cat ? 'var(--brand-mid)' : '#d1fae5', background: category === cat ? 'var(--brand-mid)' : 'white', color: category === cat ? 'white' : 'var(--text-mid)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{cat}</button>
                          ))}
                        </div>
                        {user && (
                          <button onClick={() => setShowFavsOnly(f => !f)} style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${showFavsOnly ? '#f59e0b' : '#d1fae5'}`, background: showFavsOnly ? '#fffbeb' : 'white', color: showFavsOnly ? '#b45309' : 'var(--text-mid)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            ❤️ Favourites only {favourites.size > 0 && `(${favourites.size})`}
                          </button>
                        )}
                      </div>
                      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>No hymns found</div>}
                        {filtered.map(h => {
                          const isSel = selected?.id === h.id
                          return (
                            <div key={h.id} id={'hm-item-'+h.id} className="hm-item" onClick={() => selectHymn(h)}
                              style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSel ? 'var(--brand-pale)' : 'white', borderLeft: `3px solid ${isSel ? 'var(--brand-light)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: isSel ? 'var(--brand-base)' : 'var(--brand-mist,#f0fdf4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem', color: isSel ? 'white' : 'var(--brand-mid)', flexShrink: 0 }}>{h.sort_order ?? '—'}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: isSel?700:500, color: 'var(--brand-deep)', fontSize: '0.82rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
                                {h.author && <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: 1 }}>{h.author}</div>}
                              </div>
                              {user && favourites.has(h.id) && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>❤️</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    {!selected ? (
                      <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎵</div>
                        <div style={{ color: 'var(--text-light)' }}>Select a hymn to read</div>
                      </div>
                    ) : (
                      <div className="hm-card" style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(20px,4vw,32px) clamp(18px,4vw,32px) 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {selected.sort_order != null && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: 'var(--brand-deep)', padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                                  🎵 HYMN #{selected.sort_order}
                                </div>
                              )}
                              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.3rem,4.5vw,2rem)', margin: '0 0 6px', lineHeight: 1.25 }}>{selected.title}</h2>
                              {selected.author && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', margin: 0 }}>{'✍️ ' + selected.author}</p>}
                              {selected.category && <span style={{ display: 'inline-block', marginTop: 8, fontSize: '0.7rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>{selected.category}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                              {user && (
                                <button onClick={e => toggleFavourite(e, selected.id)} disabled={favLoading}
                                  style={{ background: favourites.has(selected.id) ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.12)', border: `1px solid ${favourites.has(selected.id) ? 'var(--gold)' : 'rgba(255,255,255,0.25)'}`, color: 'white', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'var(--font-body)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  {favourites.has(selected.id) ? '❤️ Saved' : '🤍 Save'}
                                </button>
                              )}
                              <button onClick={() => changeFontSize(-1)} style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T−</button>
                              <button onClick={() => changeFontSize(1)}  style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T+</button>
                            </div>
                          </div>
                          {selected.audio_url && <AudioPlayer src={selected.audio_url} />}
                          <div style={{ height: 20 }} />
                        </div>
                        <div style={{ padding: 'clamp(20px,5vw,36px)', maxHeight: 600, overflowY: 'auto' }}>
                          {verses.length === 0 && !selected.chorus ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)' }}>No lyrics added yet.</div>
                          ) : (
                            <>
                              {verses.map((verse, i) => (
                                <div key={verse.number ?? i} style={{ marginBottom: 28 }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--brand-light)', marginBottom: 8 }}>Verse {verse.number ?? i + 1}</div>
                                  <p style={{ fontSize: fontSize+'px', lineHeight: 2.1, color: 'var(--text-dark)', whiteSpace: 'pre-line', fontStyle: 'italic', margin: 0 }}>{verse.text}</p>
                                </div>
                              ))}
                              {selected.chorus && (
                                <div style={{ background: 'var(--brand-pale)', borderRadius: 12, padding: '18px 22px', borderLeft: '4px solid var(--gold)', marginBottom: 24 }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Chorus</div>
                                  <p style={{ fontSize: fontSize+'px', lineHeight: 2.1, color: 'var(--brand-deep)', whiteSpace: 'pre-line', fontWeight: 700, fontStyle: 'italic', margin: 0 }}>{selected.chorus}</p>
                                </div>
                              )}
                              <div style={{ marginTop: 8, padding: '10px 14px', background: '#f8faf8', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                {'✅ Lyrics cached offline · ' + (selected.audio_url ? '🎵 Audio streams when online' : '🎵 No audio linked')}
                              </div>
                            </>
                          )}
                        </div>
                        <div style={{ padding: '14px clamp(16px,4vw,28px)', borderTop: '1px solid #f0fdf4', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          {prevHymn ? <button onClick={() => selectHymn(prevHymn)} style={{ background: 'none', border: '1.5px solid #d1fae5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize-3)+'px', flex: 1, textAlign: 'left', lineHeight: 1.4 }}>{'← #'+prevHymn.sort_order+' '+(prevHymn.title.length>25?prevHymn.title.slice(0,25)+'…':prevHymn.title)}</button> : <div/>}
                          {nextHymn ? <button onClick={() => selectHymn(nextHymn)} style={{ background: 'none', border: '1.5px solid #d1fae5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize-3)+'px', flex: 1, textAlign: 'right', lineHeight: 1.4 }}>{'#'+nextHymn.sort_order+' '+(nextHymn.title.length>25?nextHymn.title.slice(0,25)+'…':nextHymn.title)+' →'}</button> : <div/>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
