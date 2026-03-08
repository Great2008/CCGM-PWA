import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import ShareButton from '../components/ShareButton'

const CACHE_KEY    = 'ccgworld_devotionals'
const BOOKMARKS_KEY = 'ccgworld_dev_bookmarks'
const LAST_READ_KEY = 'ccgworld_last_devotional'

function getMonthDay() {
  const d = new Date()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function setCached(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}

export default function Devotional() {
  const today = getMonthDay()

  const [devotionals, setDevotionals] = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [category, setCategory]       = useState('All')
  const [search, setSearch]           = useState('')
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [bookmarked, setBookmarked]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    // 1. Show cache immediately — never wait for network
    const cached = getCached()
    if (cached && cached.length > 0) {
      setDevotionals(cached)
      setLoading(false)
      // Auto-select: last read → today's → first
      try {
        const lastId = localStorage.getItem(LAST_READ_KEY)
        if (lastId) {
          const last = cached.find(d => d.id === lastId)
          if (last) { setSelected(last) }
          else { setSelected(cached.find(d => d.date === today) || cached[0]) }
        } else {
          setSelected(cached.find(d => d.date === today) || cached[0])
        }
      } catch {
        setSelected(cached.find(d => d.date === today) || cached[0])
      }
    }

    // 2. Refresh from network in background
    supabase.from('posts')
      .select('*')
      .eq('type', 'devotional')
      .eq('published', true)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDevotionals(data)
          setCached(data)
          // Always update selected to get fresh fields (e.g. newly added image_url)
          setSelected(prev => {
            if (prev) return data.find(d => d.id === prev.id) || prev
            try {
              const lastId = localStorage.getItem(LAST_READ_KEY)
              if (lastId) {
                const last = data.find(d => d.id === lastId)
                if (last) return last
              }
            } catch {}
            return data.find(d => d.date === today) || data[0]
          })
        } else if (!cached || cached.length === 0) {
          setLoading(false)
        }
        if (!cached || cached.length === 0) setLoading(false)
      })
      .catch(() => {
        if (!cached || cached.length === 0) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (selected) try { localStorage.setItem(LAST_READ_KEY, selected.id) } catch {}
  }, [selected?.id])

  const toggleBookmark = id => {
    const updated = bookmarked.includes(id)
      ? bookmarked.filter(b => b !== id)
      : [...bookmarked, id]
    setBookmarked(updated)
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated)) } catch {}
  }

  const categories = ['All', ...new Set(devotionals.map(d => d.category).filter(Boolean))]

  const filtered = devotionals.filter(d => {
    const matchCat  = category === 'All' || d.category === category
    const matchSearch = !search ||
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.excerpt?.toLowerCase().includes(search.toLowerCase()) ||
      d.body?.toLowerCase().includes(search.toLowerCase())
    const matchBk = showBookmarks ? bookmarked.includes(d.id) : true
    return matchCat && matchSearch && matchBk
  })

  const selectedIdx = devotionals.findIndex(d => d.id === selected?.id)
  const isToday = selected?.date === today

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)', padding: 'clamp(80px,12vw,120px) 5% 0' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingBottom: 28 }}>
            <div>
              <span className="section-label" style={{ color: 'var(--gold)' }}>Daily Bread</span>
              <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem,5vw,3rem)', margin: '4px 0 10px' }}>🌅 Daily Devotional</h1>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' }}>
                  {loading ? '⏳ Loading...' : `📖 ${devotionals.length} Devotional${devotionals.length !== 1 ? 's' : ''}`}
                </span>
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: isOnline ? 'rgba(74,184,102,0.15)' : 'rgba(255,100,100,0.2)', color: isOnline ? '#a8e6b8' : '#ffaaaa', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {isOnline ? '🟢 Online' : '🔴 Offline — cached'}
                </span>
              </div>
            </div>
            {!loading && devotionals.length > 0 && (
              <button onClick={() => {
                const todayDev = devotionals.find(d => d.date === today)
                if (todayDev) { setSelected(todayDev); setCategory('All'); setSearch('') }
              }} style={{
                padding: '10px 22px', borderRadius: 30, border: '1.5px solid rgba(255,255,255,0.5)',
                background: 'transparent', color: 'white', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>📅 Today's Devotional</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--cream)', padding: '0 5% 60px' }}>
        <div className="container">

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🌅</div>
              <p>Loading devotionals...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && devotionals.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'white', borderRadius: 20, boxShadow: 'var(--shadow-sm)', marginTop: 32,
            }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>🌅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', marginBottom: 12 }}>
                No Devotionals Yet
              </h3>
              <p style={{ color: 'var(--text-mid)', maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
                {isOnline
                  ? 'Daily devotionals will appear here once an admin posts them via the Admin Panel → Blog & Devotionals.'
                  : "You're offline and no devotionals have been cached yet. Connect to load them."}
              </p>
            </div>
          )}

          {/* Devotionals loaded */}
          {!loading && devotionals.length > 0 && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 24, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Search devotionals..."
                  style={{ flex: '1 1 220px', padding: '9px 16px', borderRadius: 30, border: '1.5px solid #ddd', fontSize: '0.88rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} style={{
                      padding: '7px 16px', borderRadius: 30, border: '1.5px solid',
                      borderColor: category === cat ? 'var(--brand-mid)' : '#ddd',
                      background: category === cat ? 'var(--brand-mid)' : 'white',
                      color: category === cat ? 'white' : 'var(--text-mid)',
                      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    }}>{cat}</button>
                  ))}
                </div>
                <button onClick={() => setShowBookmarks(b => !b)} style={{
                  padding: '7px 16px', borderRadius: 30, border: '1.5px solid',
                  borderColor: showBookmarks ? 'var(--gold)' : '#ddd',
                  background: showBookmarks ? 'var(--gold)' : 'white',
                  color: showBookmarks ? 'var(--brand-deep)' : 'var(--text-mid)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                }}>⭐ {bookmarked.length}</button>
              </div>

              <div className="dev-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 22 }}>

                {/* Sidebar list */}
                <div style={{ maxHeight: 680, overflowY: 'auto', paddingRight: 4 }}>
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-light)', fontSize: '0.88rem' }}>
                      {showBookmarks ? 'No bookmarks yet.' : 'No results found.'}
                    </div>
                  ) : filtered.map(d => (
                    <div key={d.id} onClick={() => setSelected(d)} style={{
                      background: selected?.id === d.id ? 'var(--brand-deep)' : 'white',
                      color: selected?.id === d.id ? 'white' : 'var(--text-dark)',
                      borderRadius: 11, padding: '12px 14px', cursor: 'pointer', marginBottom: 8,
                      boxShadow: 'var(--shadow-sm)', transition: 'all 0.18s',
                      borderLeft: `4px solid ${selected?.id === d.id ? 'var(--gold)' : d.date === today ? 'var(--brand-light)' : 'transparent'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>{d.date}</span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {d.date === today && <span style={{ fontSize: '0.6rem', background: 'var(--brand-light)', color: 'white', padding: '1px 7px', borderRadius: 10, fontWeight: 900 }}>TODAY</span>}
                          {bookmarked.includes(d.id) && <span style={{ fontSize: '0.8rem' }}>⭐</span>}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.3, marginBottom: 3 }}>{d.title}</div>
                      {d.category && <div style={{ fontSize: '0.72rem', opacity: 0.65 }}>{d.category}</div>}
                    </div>
                  ))}
                </div>

                {/* Detail pane */}
                {selected && (
                  <div style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-md)', overflow: 'hidden', alignSelf: 'start' }}>

                    {/* Cover image */}
                    {selected.image_url && (
                      <div style={{ position: 'relative', height: 220, overflow: 'hidden', background: 'var(--brand-deep)' }}>
                        <img
                          src={selected.image_url}
                          alt={selected.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none' }}
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to bottom, transparent 40%, rgba(15,31,61,0.75) 100%)',
                        }} />
                      </div>
                    )}

                    <div style={{ background: selected.image_url ? 'var(--brand-deep)' : 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))', padding: '28px 32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                            {selected.date}{isToday ? " · Today's Devotional" : ''}{selected.category ? ` · ${selected.category}` : ''}
                          </div>
                          <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.3rem,3vw,1.8rem)', margin: '0 0 6px' }}>{selected.title}</h2>
                          {selected.author && <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>By {selected.author}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => toggleBookmark(selected.id)} style={{
                            background: bookmarked.includes(selected.id) ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
                            border: 'none', borderRadius: 30, padding: '8px 18px', cursor: 'pointer',
                            color: bookmarked.includes(selected.id) ? 'var(--brand-deep)' : 'white',
                            fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-body)',
                          }}>{bookmarked.includes(selected.id) ? '⭐ Saved' : '☆ Save'}</button>
                          <ShareButton
                            title={selected.title}
                            text={selected.excerpt || selected.title}
                            url={selected.image_url ? `${window.location.href}#${selected.id}` : undefined}
                            label="Share"
                          />
                        </div>
                      </div>

                      {/* Scripture / excerpt highlight */}
                      {(selected.excerpt || selected.tags) && (
                        <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '16px 20px' }}>
                          {selected.tags && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
                              📖 {selected.tags}
                            </div>
                          )}
                          {selected.excerpt && (
                            <p style={{ color: 'white', fontStyle: 'italic', lineHeight: 1.8, fontSize: '0.95rem', margin: 0 }}>"{selected.excerpt}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: '28px 32px' }}>
                      {selected.body ? (
                        <div style={{ lineHeight: 1.9, color: 'var(--text-dark)', fontSize: '0.97rem' }}>
                          {selected.body.split('\n\n').map((para, i) =>
                            para.startsWith('##') ? (
                              <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.15rem', margin: '28px 0 12px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 6 }}>
                                {para.replace(/^##\s*/, '')}
                              </h3>
                            ) : para.startsWith('#') ? (
                              <h4 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-light)', fontSize: '1rem', margin: '20px 0 8px', fontWeight: 700 }}>
                                {para.replace(/^#\s*/, '')}
                              </h4>
                            ) : (
                              <p key={i} style={{ marginBottom: 18 }}>
                                {para.split('**').map((chunk, j) =>
                                  j % 2 === 1
                                    ? <strong key={j} style={{ color: 'var(--brand-deep)' }}>{chunk}</strong>
                                    : chunk
                                )}
                              </p>
                            )
                          )}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No content for this devotional yet.</p>
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--brand-light)', fontWeight: 700 }}>✅ Available Offline</span>
                      </div>

                      {/* Prev / Next */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                        <button
                          onClick={() => selectedIdx > 0 && setSelected(devotionals[selectedIdx - 1])}
                          disabled={selectedIdx <= 0}
                          className="btn btn-outline-green"
                          style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: '0.82rem', opacity: selectedIdx <= 0 ? 0.4 : 1 }}>
                          ← Previous
                        </button>
                        <button
                          onClick={() => selectedIdx < devotionals.length - 1 && setSelected(devotionals[selectedIdx + 1])}
                          disabled={selectedIdx >= devotionals.length - 1}
                          className="btn btn-green"
                          style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: '0.82rem', opacity: selectedIdx >= devotionals.length - 1 ? 0.4 : 1 }}>
                          Next →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @media(max-width:768px){.dev-layout{grid-template-columns:1fr!important;}}
      `}</style>
    </>
  )
}
