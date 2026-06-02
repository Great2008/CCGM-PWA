import { useState, useEffect } from 'react'
import { KJV_BOOKS } from '../data/bibleData'
import SEO from '../components/SEO'
import PrayerTab from '../components/PrayerTab'

// Popular verses — always available instantly, no fetch needed
const POPULAR = [
  { ref: 'John 3:16', book: 'JHN', ch: 3, v: 16 },
  { ref: 'Philippians 4:13', book: 'PHP', ch: 4, v: 13 },
  { ref: 'Jeremiah 29:11', book: 'JER', ch: 29, v: 11 },
  { ref: 'Psalm 23:1', book: 'PSA', ch: 23, v: 1 },
  { ref: 'Romans 8:28', book: 'ROM', ch: 8, v: 28 },
  { ref: 'Proverbs 3:5', book: 'PRO', ch: 3, v: 5 },
  { ref: 'Isaiah 40:31', book: 'ISA', ch: 40, v: 31 },
  { ref: 'Matthew 6:33', book: 'MAT', ch: 6, v: 33 },
  { ref: 'Psalm 119:105', book: 'PSA', ch: 119, v: 105 },
  { ref: '2 Timothy 3:16', book: '2TI', ch: 3, v: 16 },
  { ref: 'Romans 10:9', book: 'ROM', ch: 10, v: 9 },
  { ref: 'Hebrews 11:1', book: 'HEB', ch: 11, v: 1 },
]

// KJV text fetched from public domain CDN and aggressively cached in localStorage
// After reading a chapter online once, it is permanently available offline
const BIBLE_CDN = 'https://cdn.jsdelivr.net/gh/thiagobodruk/bible@master/json/en_kjv.json'
const CACHE_META = 'ccogm_kjv_loaded_v4' // v4: fixed ez→EZK, re→REV (correct API abbrevs)

// Clean up stale keys from previous versions
;['EZE','RV','EZK_bad'].forEach(bad => {
  for (let c = 1; c <= 50; c++) localStorage.removeItem(`kjv_${bad}_${c}`)
})
;['ccogm_kjv_loaded_v1','ccogm_kjv_loaded_v2','ccogm_kjv_loaded_v3'].forEach(k => localStorage.removeItem(k))
const CHAPTER_KEY = (bookId, ch) => `kjv_${bookId}_${ch}`

// In-memory store for the session
let KJV_MEMORY = null

function useStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  const save = v => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
  return [val, save]
}

// Highlight matched words in a verse text — returns array of {text, highlight} segments
function highlightWords(text, query) {
  if (!query.trim()) return [{ text, highlight: false }]
  const parts = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase().trim()
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) { parts.push({ text: text.slice(i), highlight: false }); break }
    if (idx > i) parts.push({ text: text.slice(i, idx), highlight: false })
    parts.push({ text: text.slice(idx, idx + q.length), highlight: true })
    i = idx + q.length
  }
  return parts
}

// Persist a full book's chapters to localStorage for offline use
function cacheBook(bookId, chapters) {
  try {
    chapters.forEach((verses, ci) => {
      const key = CHAPTER_KEY(bookId, ci + 1)
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(
          verses.map((text, vi) => ({ verse: vi + 1, text: String(text) }))
        ))
      }
    })
  } catch {}
}

// Load the full Bible JSON from CDN once, cache all chapters to localStorage
async function loadFullBible(onProgress) {
  if (KJV_MEMORY) return KJV_MEMORY
  if (localStorage.getItem(CACHE_META) === 'done') {
    // Already fully cached — mark as done
    KJV_MEMORY = 'cached'
    return KJV_MEMORY
  }
  try {
    onProgress('Downloading full KJV Bible...')
    const res = await fetch(BIBLE_CDN)
    if (!res.ok) throw new Error('Network error')
    const raw = await res.json()

    // Map thiagobodruk abbrev → our book IDs
    const MAP = {
      'gn':'GEN','ex':'EXO','lv':'LEV','nm':'NUM','dt':'DEU','js':'JOS','jud':'JDG',
      'rt':'RUT','1sm':'1SA','2sm':'2SA','1kgs':'1KI','2kgs':'2KI','1ch':'1CH',
      '2ch':'2CH','ezr':'EZR','ne':'NEH','et':'EST','job':'JOB','ps':'PSA',
      'prv':'PRO','ec':'ECC','so':'SNG','is':'ISA','jr':'JER','lm':'LAM',
      'ez':'EZK','dn':'DAN','ho':'HOS','jl':'JOL','am':'AMO','ob':'OBA',
      'jn':'JON','mi':'MIC','na':'NAM','hk':'HAB','zp':'ZEP','hg':'HAG',
      'zc':'ZEC','ml':'MAL','mt':'MAT','mk':'MRK','lk':'LUK','jo':'JHN',
      'act':'ACT','rm':'ROM','1co':'1CO','2co':'2CO','gl':'GAL','ep':'EPH',
      'ph':'PHP','cl':'COL','1ts':'1TH','2ts':'2TH','1tm':'1TI','2tm':'2TI',
      'tt':'TIT','phm':'PHM','hb':'HEB','jm':'JAS','1pe':'1PE','2pe':'2PE',
      '1jo':'1JN','2jo':'2JN','3jo':'3JN','jd':'JUD','re':'REV'
    }

    onProgress('Caching all books offline...')
    for (const book of raw) {
      const id = MAP[book.abbrev] ?? book.abbrev.toUpperCase()
      cacheBook(id, book.chapters)
    }

    localStorage.setItem(CACHE_META, 'done')
    KJV_MEMORY = 'cached'
    onProgress('')
    return KJV_MEMORY
  } catch (e) {
    onProgress('')
    throw e
  }
}

export default function Bible() {
  const OT = KJV_BOOKS.filter(b => b.testament === 'OT')
  const NT = KJV_BOOKS.filter(b => b.testament === 'NT')

  const [selBook, setSelBook] = useStorage('bible_book', KJV_BOOKS[39])
  const [selChapter, setSelChapter] = useStorage('bible_chapter', 1)
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('read')
  const [fontSize, setFontSize] = useStorage('bible_fontsize', 17)
  const [bookTab, setBookTab] = useState('NT')
  const [bookOpen, setBookOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cacheStatus, setCacheStatus] = useState(() =>
    localStorage.getItem(CACHE_META) === 'done' ? 'done' : 'idle'
  )
  const [downloadProgress, setDownloadProgress] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [highlightVerse, setHighlightVerse] = useState(null)
  const [popularVerses, setPopularVerses] = useState({})

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Auto-download full Bible when online and not yet cached
  useEffect(() => {
    if (isOnline && cacheStatus === 'idle') {
      setCacheStatus('loading')
      loadFullBible(msg => setDownloadProgress(msg))
        .then(() => setCacheStatus('done'))
        .catch(() => setCacheStatus('idle'))
    }
  }, [isOnline])

  // Load popular verse texts from localStorage cache
  useEffect(() => {
    const loaded = {}
    for (const pv of POPULAR) {
      try {
        const key = CHAPTER_KEY(pv.book, pv.ch)
        const cached = localStorage.getItem(key)
        if (cached) {
          const chVerses = JSON.parse(cached)
          const found = chVerses.find(v => v.verse === pv.v)
          if (found) loaded[pv.ref] = found.text
        }
      } catch {}
    }
    setPopularVerses(loaded)
  }, [cacheStatus])

  const loadChapter = (book, chapter) => {
    setLoading(true); setError(null); setVerses([])
    try {
      const key = CHAPTER_KEY(book.id, chapter)
      const cached = localStorage.getItem(key)
      if (cached) {
        setVerses(JSON.parse(cached))
        setLoading(false)
        return
      }
      if (!navigator.onLine) {
        setError('This chapter is not cached yet. Connect to the internet — the Bible will download automatically.')
        setLoading(false)
        return
      }
      // If full Bible hasn't loaded yet, fetch individual chapter as fallback
      const slug = book.name.toLowerCase().replace(/ /g, '+')
      fetch(`https://bible-api.com/${slug}+${chapter}?translation=kjv`)
        .then(r => r.json())
        .then(data => {
          const v = data.verses || []
          setVerses(v)
          try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
          setLoading(false)
        })
        .catch(() => { setError('Could not load chapter.'); setLoading(false) })
    } catch (e) {
      setError('Error: ' + e.message); setLoading(false)
    }
  }

  useEffect(() => { loadChapter(selBook, selChapter) }, [selBook.id, selChapter])

  const handleBook = book => { setSelBook(book); setSelChapter(1); setBookOpen(false); setHighlightVerse(null) }

  const goToVerse = (bookId, ch, v) => {
    const book = KJV_BOOKS.find(b => b.id === bookId)
    if (book) { setSelBook(book); setSelChapter(ch); setHighlightVerse(v); setTab('read') }
  }

  const runSearch = (q) => {
    if (!q.trim()) { setSearchResults([]); setSearchTotal(0); return }
    if (cacheStatus !== 'done') {
      setSearchResults([{ reference: '', text: cacheStatus === 'loading'
        ? 'Bible is downloading in the background. Search will be ready shortly.'
        : 'Connect to the internet so the Bible can download, then search will work fully offline.' }])
      setSearchTotal(0)
      return
    }
    const lower = q.toLowerCase().trim()
    const results = []
    let total = 0
    for (const book of KJV_BOOKS) {
      for (let ci = 1; ci <= book.chapters; ci++) {
        try {
          const cached = localStorage.getItem(CHAPTER_KEY(book.id, ci))
          if (!cached) continue
          const chVerses = JSON.parse(cached)
          for (const v of chVerses) {
            if (v.text && v.text.toLowerCase().includes(lower)) {
              total++
              if (results.length < 100) {
                results.push({ book, chapter: ci, verse: v.verse, text: v.text, reference: `${book.name} ${ci}:${v.verse}` })
              }
            }
          }
        } catch {}
      }
    }
    setSearchResults(results)
    setSearchTotal(total)
  }

  const handleSearch = e => {
    e.preventDefault()
    runSearch(search)
  }

  const chNums = Array.from({ length: selBook.chapters }, (_, i) => i + 1)

  const statusBadge = cacheStatus === 'done'
    ? { label: '✅ Full Bible Cached — 100% Offline', color: 'rgba(74,184,102,0.25)', text: '#a8e6b8', border: 'rgba(74,184,102,0.4)' }
    : cacheStatus === 'loading'
    ? { label: '⏳ Downloading Bible...', color: 'rgba(255,200,0,0.2)', text: '#ffe066', border: 'rgba(255,200,0,0.4)' }
    : { label: '☁️ Connect to cache Bible offline', color: 'rgba(255,150,50,0.2)', text: '#ffcc88', border: 'rgba(255,150,50,0.4)' }

  return (
    <>
      <SEO
        title="Bible"
        description="Read the full King James Version Bible online and offline. CCG World — Christian Church Of God Mission."
        path="/bible"
      />
      <div style={{ background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)', padding: 'clamp(80px,12vw,120px) 5% 0' }}>
        <div className="container">
          <div className="bible-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingBottom: 24 }}>
            <div>
              <span className="section-label" style={{ color: 'var(--green-light)' }}>King James Version</span>
              <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem,5vw,3rem)', margin: '4px 0 10px' }}>📖 Holy Bible</h1>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: statusBadge.color, color: statusBadge.text, border: `1px solid ${statusBadge.border}` }}>
                  {statusBadge.label}
                </span>
                {downloadProgress && (
                  <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.2)' }}>{downloadProgress}</span>
                )}
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: isOnline ? 'rgba(74,184,102,0.15)' : 'rgba(255,100,100,0.2)', color: isOnline ? '#a8e6b8' : '#ffaaaa', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 30, padding: '6px 16px' }}>
              <button onClick={() => setFontSize(f => Math.max(13, f - 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1rem', cursor: 'pointer' }}>A−</button>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', minWidth: 30, textAlign: 'center' }}>{fontSize}px</span>
              <button onClick={() => setFontSize(f => Math.min(24, f + 1))} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.1rem', cursor: 'pointer' }}>A+</button>
            </div>
          </div>
          <div className="bible-tabs" style={{ display: 'flex', gap: 4 }}>
            {[['read','📖','Read'],['search','🔍','Search'],['popular','⭐','Popular'],['prayer','🙏','Prayer']].map(([t,icon,label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '10px 22px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--cream)' : 'rgba(255,255,255,0.15)',
                color: tab === t ? 'var(--green-deep)' : 'rgba(255,255,255,0.9)',
                fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-body)',
              }}>{icon} <span className="bible-tab-label">{label}</span></button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--cream)', minHeight: '70vh', padding: '0 5% 60px' }}>
        <div className="container">

          {tab === 'read' && (
            <div className="bible-reader-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, paddingTop: 28 }}>
              <div>
                <div style={{ background: 'var(--white, white)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 14 }}>
                  <button onClick={() => setBookOpen(o => !o)} style={{
                    width: '100%', padding: '13px 18px', background: 'var(--brand-base)', color: 'white',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)',
                    fontSize: '1rem', fontWeight: 700, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{selBook.name}</span><span style={{ fontSize: '0.7rem' }}>{bookOpen ? '▲' : '▼'}</span>
                  </button>
                  {bookOpen && (
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      <div style={{ display: 'flex', borderBottom: '1px solid var(--brand-pale)', position: 'sticky', top: 0, background: 'var(--white, white)', zIndex: 1 }}>
                        {['OT','NT'].map(t => (
                          <button key={t} onClick={() => setBookTab(t)} style={{
                            flex: 1, padding: '9px', border: 'none', cursor: 'pointer',
                            background: bookTab === t ? 'var(--brand-pale)' : 'var(--white, white)',
                            color: bookTab === t ? 'var(--green-deep)' : 'var(--text-mid)',
                            fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-body)',
                          }}>{t === 'OT' ? 'Old Testament' : 'New Testament'}</button>
                        ))}
                      </div>
                      {(bookTab === 'OT' ? OT : NT).map(book => {
                        const isCached = localStorage.getItem(CHAPTER_KEY(book.id, 1)) !== null
                        return (
                          <button key={book.id} onClick={() => handleBook(book)} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            width: '100%', padding: '9px 16px', border: 'none', cursor: 'pointer',
                            background: selBook.id === book.id ? 'var(--green-pale)' : 'var(--white, white)',
                            color: selBook.id === book.id ? 'var(--green-deep)' : 'var(--text-dark)',
                            fontWeight: selBook.id === book.id ? 700 : 400,
                            fontSize: '0.88rem', textAlign: 'left', fontFamily: 'var(--font-body)',
                            borderBottom: '1px solid #f5f5f5',
                          }}>
                            <span>{book.name}</span>
                            {isCached && <span style={{ fontSize: '0.62rem', color: 'var(--green-mid)', fontWeight: 700 }}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div style={{ background: 'var(--white, white)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 10 }}>Chapter</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
                    {chNums.map(n => (
                      <button key={n} onClick={() => setSelChapter(n)} style={{
                        padding: '7px 4px', borderRadius: 7, border: '1.5px solid',
                        borderColor: selChapter === n ? 'var(--brand-base)' : '#eee',
                        background: selChapter === n ? 'var(--brand-base)' : 'var(--white, white)',
                        color: selChapter === n ? 'white' : 'var(--text-dark)',
                        fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                      }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { if (selChapter > 1) setSelChapter(c => c - 1) }} className="btn btn-outline-green" style={{ flex: 1, padding: '9px', fontSize: '0.82rem', justifyContent: 'center' }}>← Prev</button>
                  <button onClick={() => { if (selChapter < selBook.chapters) setSelChapter(c => c + 1) }} className="btn btn-green" style={{ flex: 1, padding: '9px', fontSize: '0.82rem', justifyContent: 'center' }}>Next →</button>
                </div>
              </div>

              <div style={{ background: 'var(--white, white)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '32px 36px', minHeight: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid var(--green-pale)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--green-deep)', fontSize: '1.5rem', margin: 0 }}>{selBook.name} {selChapter}</h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{verses.length} verses</span>
                </div>
                {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}><div style={{ fontSize: '2rem', marginBottom: 10 }}>📖</div>Loading...</div>}
                {error && <div style={{ background: '#fff9f0', border: '1px solid #ffd', borderRadius: 10, padding: '18px 20px', color: '#885500', lineHeight: 1.7 }}>📵 {error}</div>}
                {!loading && !error && verses.map(v => (
                  <p key={v.verse} style={{
                    fontSize, lineHeight: 1.95, marginBottom: 10, color: 'var(--text-dark)',
                    background: highlightVerse === v.verse ? 'var(--green-pale)' : 'transparent',
                    borderRadius: 6, padding: highlightVerse === v.verse ? '4px 8px' : '0',
                    transition: 'background 0.4s',
                  }}>
                    <sup style={{ color: 'var(--green-mid)', fontWeight: 900, fontSize: '0.72em', marginRight: 5 }}>{v.verse}</sup>
                    {v.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {tab === 'search' && (
            <div style={{ paddingTop: 32, maxWidth: 800 }}>
              {/* Search bar */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch(search)}
                  placeholder='Search the entire KJV Bible — e.g. "grace", "faith", "love"'
                  style={{ flex: 1, padding: '13px 20px', borderRadius: 40, border: '1.5px solid #ddd', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  autoFocus
                />
                <button onClick={handleSearch} className="btn btn-green" style={{ whiteSpace: 'nowrap' }}>🔍 Search</button>
              </div>

              {/* Status line */}
              {cacheStatus !== 'done' && (
                <div style={{ background: '#fff9e6', border: '1px solid #ffe066', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#665500' }}>
                  ⏳ {cacheStatus === 'loading'
                    ? 'Bible is downloading in the background — search will be ready shortly.'
                    : 'Connect to the internet so the Bible can download, then full-text search works offline too.'}
                </div>
              )}
              {searchTotal > 0 && (
                <div style={{ marginBottom: 16, fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  {searchTotal > 100
                    ? `Showing first 100 of ${searchTotal.toLocaleString()} results for "${search}"`
                    : `${searchTotal.toLocaleString()} result${searchTotal === 1 ? '' : 's'} for "${search}"`}
                </div>
              )}
              {searchResults.length === 0 && search.trim() && searchTotal === 0 && cacheStatus === 'done' && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔍</div>
                  No verses found for <strong>"{search}"</strong>
                </div>
              )}

              {/* Results */}
              {searchResults.map((r, i) => (
                <div key={i} onClick={() => r.reference && goToVerse(r.book?.id, r.chapter, r.verse)} style={{
                  background: 'var(--white, white)', borderRadius: 12, padding: '16px 20px', marginBottom: 10,
                  boxShadow: 'var(--shadow-sm)', borderLeft: `4px solid ${r.reference ? 'var(--green-mid)' : '#ddd'}`,
                  cursor: r.reference ? 'pointer' : 'default', transition: 'transform 0.15s',
                }}
                onMouseEnter={e => r.reference && (e.currentTarget.style.transform = 'translateX(4px)')}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                  {r.reference && (
                    <div style={{ fontWeight: 700, color: 'var(--green-deep)', marginBottom: 6, fontSize: '0.85rem' }}>
                      {r.reference}
                    </div>
                  )}
                  <p style={{ fontSize: fontSize - 1, lineHeight: 1.8, color: r.reference ? 'var(--text-dark)' : 'var(--text-light)', margin: 0 }}>
                    {r.reference
                      ? highlightWords(r.text, search).map((seg, si) => (
                          <span key={si} style={seg.highlight ? {
                            background: '#fff176', color: '#333', borderRadius: 3,
                            padding: '0 2px', fontWeight: 700,
                          } : {}}>
                            {seg.text}
                          </span>
                        ))
                      : r.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === 'popular' && (
            <div style={{ paddingTop: 32 }}>
              <p style={{ color: 'var(--text-mid)', marginBottom: 28 }}>
                Click any verse to open it in the reader. {cacheStatus === 'done' ? '✅ All cached offline.' : '⏳ Caching in background when online...'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                {POPULAR.map(v => (
                  <div key={v.ref} onClick={() => goToVerse(v.book, v.ch, v.v)} style={{
                    background: 'var(--white, white)', borderRadius: 14, padding: '22px',
                    boxShadow: 'var(--shadow-sm)', borderTop: '4px solid var(--green-mid)',
                    cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>{v.ref}</div>
                    <p style={{ fontSize: fontSize - 1, lineHeight: 1.85, color: 'var(--text-dark)', fontStyle: 'italic', margin: '0 0 12px' }}>
                      {popularVerses[v.ref]
                        ? `"${popularVerses[v.ref]}"`
                        : <span style={{ color: 'var(--text-light)', fontStyle: 'normal' }}>{isOnline ? 'Loading...' : 'Tap to read'}</span>}
                    </p>
                    <div style={{ fontSize: '0.72rem', color: 'var(--green-mid)', fontWeight: 700 }}>→ Read in context</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'prayer' && <PrayerTab />}

        </div>
      </div>
      <style>{`
        @media(max-width:768px){
          .bible-reader-grid{grid-template-columns:1fr!important;}
          .bible-header-row{flex-direction:column!important;align-items:flex-start!important;gap:12px!important;}
          .bible-tabs button{padding:8px 14px!important;font-size:0.8rem!important;}
        }
      `}</style>
    </>
  )
}
