import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'
import ShareButton from '../components/ShareButton'

const CACHE_KEY     = 'ccgworld_devotionals'
const CACHE_TTL     = 24 * 60 * 60 * 1000
const BOOKMARKS_KEY = 'ccgworld_dev_bookmarks'
const FONT_SIZE_KEY = 'ccgworld_dev_fontsize'

function loadCache(ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const data = Array.isArray(parsed) ? parsed : parsed.data
    const ts   = Array.isArray(parsed) ? 0      : parsed.ts
    if (!data || data.length === 0) return null
    if (!ignoreExpiry && ts && Date.now() - ts > CACHE_TTL && navigator.onLine) return null
    return data
  } catch { return null }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function getMonthDay() {
  const d = new Date()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

// Parse a "Jan 5" or "2025-01-05" style date string into a comparable Date (midnight local)
function parseDevDate(dateStr) {
  if (!dateStr) return null
  // ISO format
  if (/^\d{4}-/.test(dateStr)) return new Date(dateStr + 'T00:00:00')
  // "Jan 5" or "Jan 05"
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length < 2) return null
  const month = months.indexOf(parts[0])
  const day = parseInt(parts[1], 10)
  if (month === -1 || isNaN(day)) return null
  const now = new Date()
  // Use current year; if date would be far in the future, try previous year
  const d = new Date(now.getFullYear(), month, day)
  return d
}

// Returns true if the devotional's date is today or in the past
function isAvailableToday(dateStr) {
  const devDate = parseDevDate(dateStr)
  if (!devDate) return true // no date = always show
  const today = new Date()
  today.setHours(23, 59, 59, 999) // end of today
  return devDate <= today
}

function fmt(dateStr) {
  if (!dateStr) return ''
  // Handle "Jan 1", "Jan 01" style dates directly
  if (/^[A-Za-z]/.test(dateStr)) return dateStr
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

const parseBlocks = (text) => {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let paraLines = []
  const flush = () => {
    const joined = paraLines.join(' ').trim()
    if (joined) blocks.push(joined)
    paraLines = []
  }
  lines.forEach(line => {
    const t = line.trim()
    if (/^##/.test(t) && t.length > 2)       { flush(); blocks.push(t) }
    else if (/^#/.test(t) && t.length > 1)   { flush(); blocks.push(t) }
    else if (t === '')                        { flush() }
    else                                      { paraLines.push(t) }
  })
  flush()
  return blocks.filter(Boolean)
}

function ReadingContent({ blocks, fontSize }) {
  return (
    <div style={{ lineHeight: 1.95, color: 'var(--text-dark)', fontSize: fontSize + 'px' }}>
      {blocks.map((para, i) =>
        /^##/.test(para) ? (
          <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: (fontSize + 4) + 'px', margin: '32px 0 14px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 6 }}>
            {para.replace(/^##\s*/, '')}
          </h3>
        ) : /^#/.test(para) ? (
          <h4 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-light)', fontSize: (fontSize + 2) + 'px', margin: '22px 0 10px', fontWeight: 700 }}>
            {para.replace(/^#\s*/, '')}
          </h4>
        ) : (
          <p key={i} style={{ marginBottom: 20 }}>
            {para.split('**').map((chunk, j) =>
              j % 2 === 1 ? <strong key={j} style={{ color: 'var(--brand-deep)' }}>{chunk}</strong> : chunk
            )}
          </p>
        )
      )}
    </div>
  )
}

function todaysDev(devs, today) {
  // Only pick from devotionals that are available (today or past)
  const available = devs.filter(d => isAvailableToday(d.date))
  return available.find(d => d.date === today) || available[0] || null
}

export default function Devotional() {
  const today = getMonthDay()

  const [devs, setDevs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [showList, setShowList] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY)) || 17 } catch { return 17 }
  })
  const [bookmarked, setBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { return [] }
  })
  const [showBookmarks, setShowBookmarks] = useState(false)

  const changeFontSize = (delta) => {
    setFontSize(prev => {
      const next = Math.min(26, Math.max(13, prev + delta))
      try { localStorage.setItem(FONT_SIZE_KEY, next) } catch {}
      return next
    })
  }

  const toggleBookmark = (id) => {
    const updated = bookmarked.includes(id)
      ? bookmarked.filter(b => b !== id)
      : [...bookmarked, id]
    setBookmarked(updated)
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated)) } catch {}
  }

  const fetchFresh = useCallback(async (cached) => {
    try {
      const { data } = await supabase.from('posts')
        .select('*')
        .eq('type', 'devotional')
        .eq('published', true)
        .order('date', { ascending: false })
      if (data && data.length > 0) {
        setDevs(data)
        setSelected(prev => prev ? (data.find(d => d.id === prev.id) || todaysDev(data, today)) : todaysDev(data, today))
        saveCache(data)
        setOffline(false)
      } else if (!cached || cached.length === 0) {
        setLoading(false)
      }
    } catch {
      if (!cached || cached.length === 0) { setOffline(true); setLoading(false) }
      else setOffline(true)
    }
    if (!cached || cached.length === 0) setLoading(false)
  }, [today])

  useEffect(() => {
    const cached = loadCache(true)
    if (cached && cached.length > 0) {
      setDevs(cached)
      setSelected(todaysDev(cached, today))
      setLoading(false)
    }
    fetchFresh(cached)
  }, [fetchFresh])

  // Auto-scroll sidebar to selected
  useEffect(() => {
    if (!selected) return
    const el = document.getElementById('dev-item-' + selected.id)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  // All devs are cached (including future) but only past+today are visible
  const visibleDevs = devs.filter(d => isAvailableToday(d.date))

  const categories = ['All', ...new Set(visibleDevs.map(d => d.category).filter(Boolean))]

  const filtered = visibleDevs.filter(d => {
    const matchCat = category === 'All' || d.category === category
    const matchSearch = !search ||
      (d.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.excerpt || '').toLowerCase().includes(search.toLowerCase())
    const matchBk = showBookmarks ? bookmarked.includes(d.id) : true
    return matchCat && matchSearch && matchBk
  })

  const selectDev = (d) => {
    setSelected(d)
    setShowList(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedIdx = filtered.findIndex(d => d.id === selected?.id)
  const prevDev     = filtered[selectedIdx + 1]
  const nextDev     = filtered[selectedIdx - 1]
  const isToday     = selected?.date === today

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>🌅</div>
      <div style={{ color: 'var(--text-light)' }}>Loading devotionals...</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  if (offline && devs.length === 0) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>📴</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--brand-deep)' }}>You are Offline</div>
      <div style={{ color: 'var(--text-mid)', maxWidth: 320, lineHeight: 1.7 }}>
        No cached devotionals found. Visit while online at least once to enable offline access.
      </div>
    </div>
  )

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @media(max-width:768px){
          .dev-desktop-sidebar{display:none!important;}
          .dev-mobile-bar{display:flex!important;}
          .dev-content-wrap{display:block!important;}
          .dev-outer{padding:0 0 60px 0!important;max-width:100%!important;}
          .dev-card{border-radius:0!important;border-left:none!important;border-right:none!important;box-shadow:none!important;}
          .dev-hero{padding-left:16px!important;padding-right:16px!important;}
        }
        @media(min-width:769px){
          .dev-mobile-bar{display:none!important;}
          .dev-content-wrap{display:grid!important;grid-template-columns:260px 1fr;gap:28px;}
          .dev-desktop-sidebar{display:block!important;}
        }
        .dev-item:hover{background:var(--brand-pale)!important;}
      `}</style>

      {/* Offline banner */}
      {offline && devs.length > 0 && (
        <div style={{ background: 'var(--white, #fff9f0)', borderBottom: '2px solid #fed7aa', padding: '10px 20px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-dark)', fontWeight: 600 }}>
          Offline — showing {visibleDevs.length} devotional{visibleDevs.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Hero */}
      <div className="dev-hero" style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(90px,14vw,130px) 5% 56px', textAlign: 'center' }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Daily Bread</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 16px' }}>
          🌅 Daily Devotional
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8, fontSize: '0.95rem' }}>
          Begin every day in God's presence. Reflections, scripture, and prayer to guide your walk.
        </p>
        <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
          📴 Available Offline
        </div>
      </div>

      {/* ── MOBILE STICKY TOP BAR ── */}
      <div className="dev-mobile-bar" style={{
        display: 'none', position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--brand-deep)', padding: '10px 14px',
        alignItems: 'center', gap: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        <button onClick={() => setShowList(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: 'white',
          fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left',
        }}>
          <span>🌅</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.title : 'Pick a devotional'}
          </span>
          <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>▼</span>
        </button>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => changeFontSize(-1)} style={{
            width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem',
          }}>T−</button>
          <button onClick={() => changeFontSize(1)} style={{
            width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem',
          }}>T+</button>
        </div>
      </div>

      {/* ── MOBILE BOTTOM SHEET ── */}
      {showList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}
          onClick={() => setShowList(false)}>
          <div style={{ marginTop: 'auto', background: 'var(--white, white)', borderRadius: '20px 20px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#d1fae5' }} />
            </div>
            <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid #f0fdf4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem' }}>All Devotionals</div>
                <button onClick={() => { setShowBookmarks(b => !b) }} style={{
                  padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                  borderColor: showBookmarks ? 'var(--gold)' : '#d1fae5',
                  background: showBookmarks ? 'var(--gold)' : 'white',
                  color: showBookmarks ? 'var(--brand-deep)' : 'var(--text-mid)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>⭐ {bookmarked.length}</button>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devotionals..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none' }} />
              {categories.length > 2 && (
                <select value={category} onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', background: 'var(--white, white)', outline: 'none' }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>
                  {showBookmarks ? 'No bookmarks yet.' : 'No devotionals found.'}
                </div>
              )}
              {filtered.map(d => {
                const isSelected = selected?.id === d.id
                const isTod = d.date === today
                return (
                  <div key={d.id} id={'dev-item-' + d.id} className="dev-item" onClick={() => selectDev(d)}
                    style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSelected ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `4px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.95rem', lineHeight: 1.4 }}>{d.title}</div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {isTod && <span style={{ background: 'var(--gold)', color: 'white', fontSize: '0.62rem', padding: '3px 9px', borderRadius: 10, fontWeight: 900 }}>TODAY</span>}
                        {bookmarked.includes(d.id) && <span style={{ fontSize: '0.8rem' }}>⭐</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>{fmt(d.date)}</div>
                    {d.category && <div style={{ fontSize: '0.75rem', color: 'var(--brand-light)', marginTop: 3, fontWeight: 600 }}>{d.category}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="dev-outer" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 4% 80px' }}>
        <div className="dev-content-wrap" style={{ display: 'block' }}>

          {/* Desktop Sidebar */}
          <div className="dev-desktop-sidebar" style={{ display: 'none' }}>
            <div style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden', position: 'sticky', top: 24 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0fdf4' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devotionals..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                {categories.length > 2 && (
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'var(--white, white)', outline: 'none' }}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={() => setShowBookmarks(b => !b)} style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid',
                    borderColor: showBookmarks ? 'var(--gold)' : '#d1fae5',
                    background: showBookmarks ? 'var(--gold)' : 'white',
                    color: showBookmarks ? 'var(--brand-deep)' : 'var(--text-mid)',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}>⭐ Saved ({bookmarked.length})</button>
                  <button onClick={() => { const d = devs.find(d => d.date === today); if (d) selectDev(d) }}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--brand-light)', background: 'var(--brand-pale)', color: 'var(--brand-mid)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    📅 Today
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {filtered.map(d => {
                  const isSelected = selected?.id === d.id
                  const isTod = d.date === today
                  return (
                    <div key={d.id} id={'dev-item-' + d.id} className="dev-item" onClick={() => selectDev(d)}
                      style={{ padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSelected ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `3px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.85rem', lineHeight: 1.4 }}>{d.title}</div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {isTod && <span style={{ background: 'var(--gold)', color: 'white', fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, fontWeight: 900 }}>TODAY</span>}
                          {bookmarked.includes(d.id) && <span style={{ fontSize: '0.75rem' }}>⭐</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: 3 }}>{fmt(d.date)}</div>
                      {d.category && <div style={{ fontSize: '0.71rem', color: 'var(--brand-light)', marginTop: 2, fontWeight: 600 }}>{d.category}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Content Panel */}
          <div>
            {devs.length === 0 ? (
              <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌅</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.4rem', marginBottom: 10 }}>No Devotionals Yet</div>
                <div style={{ color: 'var(--text-mid)', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
                  Daily devotionals will appear here once an admin posts them.
                </div>
              </div>
            ) : !selected ? (
              <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌅</div>
                <div style={{ color: 'var(--text-light)' }}>Select a devotional to read</div>
              </div>
            ) : (
              <div className="dev-card" style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(20px,4vw,32px) clamp(18px,4vw,32px) 0' }}>
                  {selected.category && (
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                      {selected.category}
                    </div>
                  )}
                  <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.3rem,4.5vw,2rem)', margin: '0 0 14px', lineHeight: 1.25 }}>
                    {selected.title}
                  </h2>

                  {/* Scripture / tags pill */}
                  {selected.tags && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--brand-deep)', padding: '7px 18px', borderRadius: 30, fontSize: 'clamp(0.78rem,2vw,0.88rem)', fontWeight: 800, marginBottom: 14 }}>
                      📜 {selected.tags}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>📅 {fmt(selected.date)}{isToday ? " · Today's Devotional" : ''}</span>
                    {selected.author && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>✍️ {selected.author}</span>}
                  </div>

                  {/* Action row: tabs + T-/T+ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {/* Save + Share inline with the "tabs" area */}
                      <button onClick={() => toggleBookmark(selected.id)} style={{
                        padding: 'clamp(8px,1.5vw,11px) clamp(14px,3vw,20px)',
                        borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: 'clamp(0.78rem,2vw,0.88rem)', fontWeight: 700,
                        background: bookmarked.includes(selected.id) ? 'var(--gold)' : 'rgba(255,255,255,0.12)',
                        color: bookmarked.includes(selected.id) ? 'var(--brand-deep)' : 'rgba(255,255,255,0.8)',
                        transition: 'all 0.15s',
                      }}>
                        {bookmarked.includes(selected.id) ? '⭐ Saved' : '☆ Save'}
                      </button>
                      <ShareButton
                        title={selected.title}
                        text={selected.excerpt || selected.title}
                        style={{
                          borderRadius: '10px 10px 0 0',
                          borderColor: 'rgba(255,255,255,0.25)',
                          padding: 'clamp(8px,1.5vw,11px) clamp(14px,3vw,20px)',
                        }}
                      />
                    </div>
                    {/* Font controls */}
                    <div style={{ display: 'flex', gap: 5, paddingBottom: 10 }}>
                      <button onClick={() => changeFontSize(-1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T−</button>
                      <button onClick={() => changeFontSize(1)}  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T+</button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: 'clamp(20px,5vw,36px)' }}>

                  {/* Excerpt / scripture highlight */}
                  {selected.excerpt && (
                    <div style={{ background: 'var(--brand-pale)', borderLeft: '4px solid var(--brand-light)', borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 28, fontStyle: 'italic', color: 'var(--brand-deep)', lineHeight: 1.8, fontSize: fontSize + 'px' }}>
                      "{selected.excerpt}"
                    </div>
                  )}

                  {selected.body ? (
                    <ReadingContent blocks={parseBlocks(selected.body)} fontSize={fontSize} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>No content for this devotional yet.</div>
                  )}

                  {/* Offline badge + read time */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0fdf4', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--brand-light)', fontWeight: 700 }}>✅ Available Offline</span>
                    {selected.read_time && <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>⏱ {selected.read_time}</span>}
                  </div>
                </div>

                {/* Prev / Next */}
                <div style={{ padding: '16px clamp(16px,4vw,28px)', borderTop: '1px solid #f0fdf4', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  {prevDev ? (
                    <button onClick={() => selectDev(prevDev)} style={{ background: 'none', border: '1.5px solid #d1fae5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'left', lineHeight: 1.4 }}>
                      ← {prevDev.title.length > 30 ? prevDev.title.slice(0, 30) + '…' : prevDev.title}
                    </button>
                  ) : <div />}
                  {nextDev ? (
                    <button onClick={() => selectDev(nextDev)} style={{ background: 'none', border: '1.5px solid #d1fae5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'right', lineHeight: 1.4 }}>
                      {nextDev.title.length > 30 ? nextDev.title.slice(0, 30) + '…' : nextDev.title} →
                    </button>
                  ) : <div />}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
