import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'
import ShareButton from '../components/ShareButton'
import SEO from '../components/SEO'
import { APP_URL } from '../lib/config'

const CACHE_KEY      = 'ccgworld_blog'
const BOOKMARKS_KEY  = 'ccgworld_blog_bookmarks'
const FONT_SIZE_KEY  = 'ccgworld_blog_fontsize'

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const data = Array.isArray(parsed) ? parsed : parsed.data
    if (!data || data.length === 0) return null
    return data
  } catch { return null }
}

function saveCache(data) {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data }))
  } catch {}
}

function renderBody(body, fontSize = 15) {
  if (!body) return null
  return (
    <div style={{ fontSize: fontSize + 'px', color: 'var(--text-dark)', lineHeight: 1.9 }}>
      {body.split('\n\n').map((para, i) =>
        para.startsWith('##') ? (
          <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: (fontSize + 4) + 'px', margin: '24px 0 10px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 6 }}>
            {para.replace(/^##\s*/, '')}
          </h3>
        ) : para.startsWith('#') ? (
          <h4 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-light)', fontSize: (fontSize + 2) + 'px', margin: '18px 0 8px', fontWeight: 700 }}>
            {para.replace(/^#\s*/, '')}
          </h4>
        ) : (
          <p key={i} style={{ marginBottom: 16 }}>
            {para.split('**').map((chunk, j) =>
              j % 2 === 1 ? <strong key={j} style={{ color: 'var(--brand-deep)' }}>{chunk}</strong> : chunk
            )}
          </p>
        )
      )}
    </div>
  )
}

export default function Blog() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [showList, setShowList] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY)) || 15 } catch { return 15 }
  })
  const [bookmarked, setBookmarked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { return [] }
  })
  const [showBookmarks, setShowBookmarks] = useState(false)

  const changeFontSize = (delta) => {
    setFontSize(prev => {
      const next = Math.min(24, Math.max(12, prev + delta))
      try { localStorage.setItem(FONT_SIZE_KEY, next) } catch {}
      return next
    })
  }

  const toggleBookmark = (postId) => {
    const updated = bookmarked.includes(postId)
      ? bookmarked.filter(b => b !== postId)
      : [...bookmarked, postId]
    setBookmarked(updated)
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated)) } catch {}
  }

  const fetchFresh = useCallback(async (cached) => {
    try {
      const { data } = await supabase.from('posts')
        .select('*')
        .eq('published', true)
        .order('date', { ascending: false })
      if (data && data.length > 0) {
        saveCache(data)
        setPosts(data)
        const match = id ? data.find(p => String(p.id) === String(id)) : null
        setSelected(match || data[0] || null)
      }
    } catch {
      // silent — cached data (if any) is already on screen
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const cached = loadCache()
    if (cached && cached.length > 0) {
      setPosts(cached)
      const match = id ? cached.find(p => String(p.id) === String(id)) : null
      setSelected(match || cached[0] || null)
      setLoading(false)
    }
    fetchFresh(cached)
  }, [fetchFresh]) // eslint-disable-line

  // Auto-scroll sidebar to selected
  useEffect(() => {
    if (!selected) return
    const el = document.getElementById('blog-item-' + selected.id)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const categories = ['All', ...new Set(posts.map(p => p.category).filter(Boolean))]

  const filtered = posts.filter(p => {
    const matchCat = category === 'All' || p.category === category
    const matchSearch = !search ||
      (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.excerpt || '').toLowerCase().includes(search.toLowerCase())
    const matchBk = showBookmarks ? bookmarked.includes(p.id) : true
    return matchCat && matchSearch && matchBk
  })

  const selectPost = (p) => {
    setSelected(p)
    setShowList(false)
    navigate(`/blog/${p.id}`, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedIdx = filtered.findIndex(p => p.id === selected?.id)
  const prevPost    = filtered[selectedIdx + 1]
  const nextPost    = filtered[selectedIdx - 1]

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>✍️</div>
      <div style={{ color: 'var(--text-light)' }}>Loading posts...</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <>
      <SEO
        title="Blog"
        description="Read the latest articles, news and updates from CCG World — Christian Church Of God Mission."
        path="/blog"
      />
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @media(max-width:768px){
          .blog-desktop-sidebar{display:none!important;}
          .blog-mobile-bar{display:flex!important;}
          .blog-content-wrap{display:block!important;}
          .blog-outer{padding:0 0 60px 0!important;max-width:100%!important;}
          .blog-card{border-radius:0!important;border-left:none!important;border-right:none!important;box-shadow:none!important;}
          .blog-hero{padding-left:16px!important;padding-right:16px!important;}
        }
        @media(min-width:769px){
          .blog-mobile-bar{display:none!important;}
          .blog-content-wrap{display:grid!important;grid-template-columns:260px 1fr;gap:28px;}
          .blog-desktop-sidebar{display:block!important;}
        }
        .blog-item:hover{background:var(--brand-pale)!important;}
      `}</style>

      {/* Hero */}
      <div className="blog-hero" style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 56px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Daily Inspiration</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', margin: '8px 0 16px' }}>
          ✍️ Blog & Articles
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8, fontSize: '0.95rem' }}>
          Encouragement, scripture reflections, and faith-building articles from our pastors and leaders.
        </p>
      </div>

      {/* ── MOBILE STICKY TOP BAR ── */}
      <div className="blog-mobile-bar" style={{
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
          <span>✍️</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.title : 'Pick a post'}
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
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e8dcf5' }} />
            </div>
            <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid #f5f0fa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem' }}>All Posts</div>
                <button onClick={() => setShowBookmarks(b => !b)} style={{
                  padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                  borderColor: showBookmarks ? 'var(--gold)' : '#e8dcf5',
                  background: showBookmarks ? 'var(--gold)' : 'white',
                  color: showBookmarks ? 'var(--brand-deep)' : 'var(--text-mid)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>⭐ {bookmarked.length}</button>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8dcf5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', boxSizing: 'border-box', outline: 'none' }} />
              {categories.length > 2 && (
                <select value={category} onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8dcf5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', background: 'var(--white, white)', outline: 'none' }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>
                  {showBookmarks ? 'No bookmarks yet.' : 'No posts found.'}
                </div>
              )}
              {filtered.map(p => {
                const isSelected = selected?.id === p.id
                return (
                  <div key={p.id} id={'blog-item-' + p.id} className="blog-item" onClick={() => selectPost(p)}
                    style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #faf8fc', background: isSelected ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `4px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.95rem', lineHeight: 1.4 }}>{p.title}</div>
                      {bookmarked.includes(p.id) && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>⭐</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                      {p.author && <>{p.author} · </>}{p.date}
                    </div>
                    {p.category && <div style={{ fontSize: '0.75rem', color: 'var(--brand-light)', marginTop: 3, fontWeight: 600 }}>{p.category}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="blog-outer" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 4% 80px' }}>
        <div className="blog-content-wrap" style={{ display: 'block' }}>

          {/* Desktop Sidebar */}
          <div className="blog-desktop-sidebar" style={{ display: 'none' }}>
            <div style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e8dcf5', overflow: 'hidden', position: 'sticky', top: 24 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f5f0fa' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e8dcf5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }} />
                {categories.length > 2 && (
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e8dcf5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'var(--white, white)', outline: 'none' }}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <button onClick={() => setShowBookmarks(b => !b)} style={{
                  width: '100%', marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1.5px solid',
                  borderColor: showBookmarks ? 'var(--gold)' : '#e8dcf5',
                  background: showBookmarks ? 'var(--gold)' : 'white',
                  color: showBookmarks ? 'var(--brand-deep)' : 'var(--text-mid)',
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>⭐ Saved ({bookmarked.length})</button>
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                    {showBookmarks ? 'No bookmarks yet.' : 'No posts found.'}
                  </div>
                )}
                {filtered.map(p => {
                  const isSelected = selected?.id === p.id
                  return (
                    <div key={p.id} id={'blog-item-' + p.id} className="blog-item" onClick={() => selectPost(p)}
                      style={{ padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #faf8fc', background: isSelected ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `3px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.85rem', lineHeight: 1.4 }}>{p.title}</div>
                        {bookmarked.includes(p.id) && <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>⭐</span>}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: 3 }}>
                        {p.author && <>{p.author} · </>}{p.date}
                      </div>
                      {p.category && <div style={{ fontSize: '0.71rem', color: 'var(--brand-light)', marginTop: 2, fontWeight: 600 }}>{p.category}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Content Panel */}
          <div>
            {posts.length === 0 ? (
              <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e8dcf5' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✍️</div>
                <div style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.4rem', marginBottom: 10 }}>No Posts Yet</div>
                <div style={{ color: 'var(--text-mid)', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
                  Devotionals and blog posts will appear here. Check back soon!
                </div>
              </div>
            ) : !selected ? (
              <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e8dcf5' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✍️</div>
                <div style={{ color: 'var(--text-light)' }}>Select a post to read</div>
              </div>
            ) : (
              <div className="blog-card" style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e8dcf5', overflow: 'hidden' }}>

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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    {selected.author && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>✍️ {selected.author}</span>}
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>📅 {selected.date}</span>
                    {selected.read_time && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>⏱ {selected.read_time}</span>}
                  </div>

                  {/* Action row: save/share + T-/T+ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
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
                        text={`${APP_URL}/blog/${selected.id}\n\n${selected.title}`}
                        includeLink={false}
                        style={{
                          borderRadius: '10px 10px 0 0',
                          borderColor: 'rgba(255,255,255,0.25)',
                          padding: 'clamp(8px,1.5vw,11px) clamp(14px,3vw,20px)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 5, paddingBottom: 10 }}>
                      <button onClick={() => changeFontSize(-1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T−</button>
                      <button onClick={() => changeFontSize(1)}  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T+</button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: 'clamp(20px,5vw,36px)' }}>
                  {selected.image_url && (
                    <img src={selected.image_url} alt={selected.title}
                      style={{ width: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 12, marginBottom: 24 }} />
                  )}

                  {selected.excerpt && (
                    <div style={{ background: 'var(--brand-pale)', borderLeft: '4px solid var(--brand-light)', borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 28, fontStyle: 'italic', color: 'var(--brand-deep)', lineHeight: 1.8, fontSize: fontSize + 'px' }}>
                      "{selected.excerpt}"
                    </div>
                  )}

                  {selected.body ? (
                    renderBody(selected.body, fontSize)
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>No content for this post yet.</div>
                  )}
                </div>

                {/* Prev / Next */}
                <div style={{ padding: '16px clamp(16px,4vw,28px)', borderTop: '1px solid #f5f0fa', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  {prevPost ? (
                    <button onClick={() => selectPost(prevPost)} style={{ background: 'none', border: '1.5px solid #e8dcf5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'left', lineHeight: 1.4 }}>
                      ← {prevPost.title.length > 30 ? prevPost.title.slice(0, 30) + '…' : prevPost.title}
                    </button>
                  ) : <div />}
                  {nextPost ? (
                    <button onClick={() => selectPost(nextPost)} style={{ background: 'none', border: '1.5px solid #e8dcf5', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'right', lineHeight: 1.4 }}>
                      {nextPost.title.length > 30 ? nextPost.title.slice(0, 30) + '…' : nextPost.title} →
                    </button>
                  ) : <div />}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
    </>
  )
}
