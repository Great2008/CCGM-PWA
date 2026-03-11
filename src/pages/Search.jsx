import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import supabase from '../lib/supabase'

// ── Result type config ──────────────────────────────────────────────────────
const TYPES = {
  sermon:   { label: 'Sermon',      icon: '🎙', color: '#2563eb', path: '/sermons'       },
  event:    { label: 'Event',       icon: '📅', color: '#059669', path: '/events'        },
  blog:     { label: 'Blog',        icon: '✍️', color: '#7c3aed', path: '/blog'          },
  devotional:{ label: 'Devotional', icon: '🌅', color: '#b45309', path: '/devotional'    },
  hymn:     { label: 'Hymn',        icon: '🎵', color: '#0891b2', path: '/hymnal'        },
  sabbath:  { label: 'Sabbath',     icon: '📖', color: '#166534', path: '/sabbath-school'},
  studio:   { label: 'Studio',      icon: '🎬', color: '#dc2626', path: '/studio'        },
}

function highlight(text, query) {
  if (!text || !query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--gold)', color: 'var(--brand-deep)', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function ResultCard({ result, query }) {
  const type = TYPES[result._type] || TYPES.blog
  return (
    <Link to={type.path} style={{ display: 'block', textDecoration: 'none' }}>
      <div
        style={{ background: 'var(--white, white)', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #e8f0e8', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', gap: 14, alignItems: 'flex-start' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-base)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8f0e8'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
      >
        {/* Type icon */}
        <div style={{ width: 40, height: 40, borderRadius: 10, background: type.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, border: `1px solid ${type.color}25` }}>
          {type.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: type.color + '15', color: type.color, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
              {type.label}
            </span>
            {result.category && (
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{result.category}</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.95rem', lineHeight: 1.35, marginBottom: 4 }}>
            {highlight(result.title, query)}
          </div>
          {result.subtitle && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 4 }}>
              {highlight(result.subtitle, query)}
            </div>
          )}
          {result.excerpt && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-mid)', lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {highlight(result.excerpt, query)}
            </p>
          )}
          {result.meta && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{result.meta}</div>
          )}
        </div>
        <div style={{ color: 'var(--brand-base)', fontSize: '0.9rem', flexShrink: 0, alignSelf: 'center', opacity: 0.5 }}>→</div>
      </div>
    </Link>
  )
}

// ── Main search function ────────────────────────────────────────────────────
async function runSearch(q) {
  if (!q || q.trim().length < 2) return []
  const term = q.trim().toLowerCase()
  const ilike = `%${term}%`

  const [
    { data: sermons },
    { data: events },
    { data: posts },
    { data: hymns },
    { data: lessons },
    { data: studio },
  ] = await Promise.all([
    supabase.from('sermons').select('id,title,pastor,series,date').eq('published', true)
      .or(`title.ilike.${ilike},pastor.ilike.${ilike},series.ilike.${ilike}`).limit(6),
    supabase.from('events').select('id,title,description,location,category,date').eq('published', true)
      .or(`title.ilike.${ilike},description.ilike.${ilike},location.ilike.${ilike}`).limit(6),
    supabase.from('posts').select('id,title,excerpt,author,category,type,date').eq('published', true)
      .or(`title.ilike.${ilike},excerpt.ilike.${ilike},author.ilike.${ilike}`).limit(8),
    supabase.from('hymns').select('id,title,author,category,sort_order').eq('published', true)
      .or(`title.ilike.${ilike},author.ilike.${ilike}`).limit(6),
    supabase.from('sabbath_lessons').select('id,title,scripture,quarter,lesson_date').eq('published', true)
      .or(`title.ilike.${ilike},scripture.ilike.${ilike}`).limit(5),
    supabase.from('studio_items').select('id,title,description,category,series,type').eq('status', 'published').eq('published', true)
      .or(`title.ilike.${ilike},description.ilike.${ilike},series.ilike.${ilike}`).limit(6),
  ])

  const results = []

  ;(sermons || []).forEach(s => results.push({
    _type: 'sermon', id: s.id,
    title: s.title,
    subtitle: [s.pastor, s.series].filter(Boolean).join(' · '),
    meta: s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  }))

  ;(events || []).forEach(e => results.push({
    _type: 'event', id: e.id,
    title: e.title, category: e.category,
    excerpt: e.description,
    meta: [e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '', e.location].filter(Boolean).join(' · '),
  }))

  ;(posts || []).forEach(p => results.push({
    _type: p.type === 'devotional' ? 'devotional' : 'blog', id: p.id,
    title: p.title, category: p.category,
    subtitle: p.author ? `By ${p.author}` : '',
    excerpt: p.excerpt,
    meta: p.date || '',
  }))

  ;(hymns || []).forEach(h => results.push({
    _type: 'hymn', id: h.id,
    title: `${h.sort_order != null ? `#${h.sort_order} ` : ''}${h.title}`,
    subtitle: h.author || '',
    category: h.category,
  }))

  ;(lessons || []).forEach(l => results.push({
    _type: 'sabbath', id: l.id,
    title: l.title,
    subtitle: l.scripture ? `📜 ${l.scripture}` : '',
    category: l.quarter,
    meta: l.lesson_date ? new Date(l.lesson_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  }))

  ;(studio || []).forEach(s => results.push({
    _type: 'studio', id: s.id,
    title: s.title, category: s.category,
    subtitle: s.series ? `📂 ${s.series}` : '',
    excerpt: s.description,
  }))

  return results
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''

  const [query,    setQuery]    = useState(initialQ)
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [filter,   setFilter]   = useState('all')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    const res = await runSearch(q)
    setResults(res)
    setLoading(false)
  }, [])

  // Run search on mount if URL has ?q=
  useEffect(() => {
    if (initialQ) doSearch(initialQ)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, []) // eslint-disable-line

  const handleInput = (val) => {
    setQuery(val)
    setSearchParams(val ? { q: val } : {}, { replace: true })
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 320)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { clearTimeout(debounceRef.current); doSearch(query) }
    if (e.key === 'Escape') { setQuery(''); setResults([]); setSearched(false) }
  }

  // Filter by type
  const typeFilters = ['all', ...new Set(results.map(r => r._type))]
  const filtered = filter === 'all' ? results : results.filter(r => r._type === filter)

  // Group by type for display
  const grouped = {}
  filtered.forEach(r => {
    if (!grouped[r._type]) grouped[r._type] = []
    grouped[r._type].push(r)
  })

  const totalCount = results.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--off-white)', paddingTop: 66 }}>

      {/* ── Search hero ── */}
      <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(40px,8vw,72px) 5% 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 70% 50%,rgba(245,158,11,0.1) 0%,transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
          <span className="section-label" style={{ color: 'var(--gold)' }}>Search Everything</span>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.8rem,4vw,2.6rem)', margin: '6px 0 24px', lineHeight: 1.15 }}>
            Find anything in CCG World
          </h1>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: 0 }}>
            <span style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none', zIndex: 1 }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search sermons, hymns, events, blog posts…"
              style={{ width: '100%', padding: '18px 52px 18px 52px', borderRadius: '14px 14px 0 0', border: 'none', fontSize: '1.05rem', fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--white, white)', color: 'var(--text-dark)', boxSizing: 'border-box', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
            />
            {query && (
              <button onClick={() => handleInput('')} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: '#e2e8f0', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-mid)' }}>✕</button>
            )}
          </div>

          {/* Type filter pills — shown below input, flush with it */}
          {searched && totalCount > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '0 0 14px 14px', padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', backdropFilter: 'blur(8px)' }}>
              {typeFilters.map(t => {
                const cnt = t === 'all' ? totalCount : results.filter(r => r._type === t).length
                const info = TYPES[t]
                return (
                  <button key={t} onClick={() => setFilter(t)} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${filter === t ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`, background: filter === t ? 'var(--gold)' : 'rgba(255,255,255,0.1)', color: filter === t ? 'var(--brand-deep)' : 'rgba(255,255,255,0.85)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
                    {t === 'all' ? '✨ All' : `${info?.icon} ${info?.label}`}
                    <span style={{ background: filter === t ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '0 6px', fontSize: '0.65rem' }}>{cnt}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Results area ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 'clamp(24px,4vw,40px) 5% 80px' }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--brand-pale)', borderTopColor: 'var(--brand-base)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Searching…</div>
          </div>
        )}

        {/* Empty query prompt */}
        {!loading && !searched && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
            <div style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.3rem', marginBottom: 8 }}>Search across everything</div>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
              Find sermons, events, blog posts, devotionals, hymns, Sabbath lessons, and CCG Studio content — all in one place.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24 }}>
              {Object.entries(TYPES).map(([key, t]) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 20, background: 'var(--white, white)', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', color: 'var(--text-mid)', fontWeight: 600 }}>
                  {t.icon} {t.label}s
                </span>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && searched && totalCount === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>😔</div>
            <div style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.2rem', marginBottom: 8 }}>No results for "{query}"</div>
            <p style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>Try different keywords or check your spelling.</p>
          </div>
        )}

        {/* Results grouped by type */}
        {!loading && totalCount > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontWeight: 600 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}{query ? ` for "${query}"` : ''}
            </div>
            {Object.entries(grouped).map(([type, items]) => {
              const info = TYPES[type]
              return (
                <div key={type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '1rem' }}>{info?.icon}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem' }}>{info?.label}s</span>
                    <span style={{ background: 'var(--brand-pale)', color: 'var(--brand-mid)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map(r => <ResultCard key={r.id} result={r} query={query} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
