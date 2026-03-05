import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

const CACHE_KEY = 'ccg-sabbath-lessons'
const CACHE_TTL = 24 * 60 * 60 * 1000
const FONT_SIZE_KEY = 'ccg-sabbath-fontsize'

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

function fmt(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
}

function thisWeekLesson(lessons) {
  if (!lessons?.length) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const past = lessons.filter(l => new Date(l.lesson_date + 'T00:00:00') <= today)
  if (past.length) return past.sort((a,b) => new Date(b.lesson_date) - new Date(a.lesson_date))[0]
  return lessons.sort((a,b) => new Date(a.lesson_date) - new Date(b.lesson_date))[0]
}

const parseBlocks = (text) => {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let paraLines = []
  const flushPara = () => {
    const joined = paraLines.join(' ').trim()
    if (joined) blocks.push(joined)
    paraLines = []
  }
  lines.forEach(line => {
    const trimmed = line.trim()
    if (/^##/.test(trimmed) && trimmed.length > 2) { flushPara(); blocks.push(trimmed) }
    else if (/^#/.test(trimmed) && trimmed.length > 1 && !trimmed.startsWith('##')) { flushPara(); blocks.push(trimmed) }
    else if (trimmed === '') { flushPara() }
    else { paraLines.push(trimmed) }
  })
  flushPara()
  return blocks.filter(Boolean)
}

function ReadingContent({ blocks, fontSize }) {
  return (
    <div style={{ lineHeight: 1.9, color: 'var(--text-dark)', fontSize: fontSize + 'px' }}>
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
          <p key={i} style={{ marginBottom: 20 }}>{para}</p>
        )
      )}
    </div>
  )
}

export default function SabbathSchool() {
  const [lessons, setLessons]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [offline, setOffline]     = useState(false)
  const [search, setSearch]       = useState('')
  const [quarter, setQuarter]     = useState('all')
  const [activeTab, setActiveTab] = useState('lesson')
  const [showList, setShowList]   = useState(false)
  const [fontSize, setFontSize]   = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY)) || 17 } catch { return 17 }
  })

  const changeFontSize = (delta) => {
    setFontSize(prev => {
      const next = Math.min(26, Math.max(13, prev + delta))
      try { localStorage.setItem(FONT_SIZE_KEY, next) } catch {}
      return next
    })
  }

  const fetchFresh = useCallback(async (cached) => {
    try {
      const { data } = await supabase.from('sabbath_lessons')
        .select('*').eq('published', true)
        .order('lesson_date', { ascending: false })
      if (data && data.length > 0) {
        setLessons(data)
        setSelected(prev => {
          if (!prev) return thisWeekLesson(data)
          return data.find(l => l.id === prev.id) || thisWeekLesson(data)
        })
        saveCache(data)
        setOffline(false)
      } else {
        if (!cached || cached.length === 0) setLoading(false)
        setOffline(true)
      }
    } catch {
      if (!cached || cached.length === 0) { setOffline(true); setLoading(false) }
      else { setOffline(true) }
    }
    if (!cached || cached.length === 0) setLoading(false)
  }, [])

  useEffect(() => {
    const cached = loadCache(true)
    if (cached && cached.length > 0) {
      setLessons(cached)
      setSelected(thisWeekLesson(cached))
      setLoading(false)
    }
    fetchFresh(cached)
  }, [fetchFresh])

  const quarters = [...new Set(lessons.map(l => l.quarter).filter(Boolean))].sort().reverse()
  const filtered = lessons.filter(l => {
    const matchQ = quarter === 'all' || l.quarter === quarter
    const matchS = !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.scripture || '').toLowerCase().includes(search.toLowerCase())
    return matchQ && matchS
  })

  const selectLesson = (l) => {
    setSelected(l)
    setActiveTab('lesson')
    setShowList(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const tabs = [
    { id: 'lesson',   label: 'Lesson'   },
    { id: 'analysis', label: 'Analysis' },
    { id: 'divine',   label: 'Service'  },
  ].filter(t => {
    if (!selected) return false
    if (t.id === 'analysis') return !!(selected.analysis || selected.analysis_points)
    if (t.id === 'divine') return !!(selected.divine_message_title || selected.divine_message_speaker || selected.evening_title || selected.evening_speaker)
    return true
  })

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '2rem' }}>📖</div>
      <div style={{ color: 'var(--text-light)' }}>Loading lessons...</div>
    </div>
  )

  if (offline && lessons.length === 0) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>📴</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--brand-deep)' }}>You are Offline</div>
      <div style={{ color: 'var(--text-mid)', maxWidth: 320, lineHeight: 1.7 }}>
        No cached lessons found. Visit Sabbath School while online at least once to enable offline access.
      </div>
    </div>
  )

  const lessonIdx  = filtered.findIndex(l => l.id === selected?.id)
  const prevLesson = filtered[lessonIdx + 1]
  const nextLesson = filtered[lessonIdx - 1]

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .ss-desktop-sidebar { display: none !important; }
          .ss-mobile-bar { display: flex !important; }
          .ss-content-wrap { display: block !important; }
          .ss-outer { padding: 0 0 60px 0 !important; }
          .ss-card { border-radius: 0 !important; border-left: none !important; border-right: none !important; box-shadow: none !important; }
          .ss-hero { padding-left: 16px !important; padding-right: 16px !important; }
        }
        @media (min-width: 769px) {
          .ss-mobile-bar { display: none !important; }
          .ss-content-wrap { display: grid !important; grid-template-columns: 260px 1fr; gap: 28px; }
          .ss-desktop-sidebar { display: block !important; }
        }
        .ss-lesson-item:hover { background: var(--brand-pale) !important; }
      `}</style>

      {offline && lessons.length > 0 && (
        <div style={{ background: '#fff9f0', borderBottom: '2px solid #fed7aa', padding: '10px 20px', textAlign: 'center', fontSize: '0.82rem', color: '#c2410c', fontWeight: 600 }}>
          Offline — showing {lessons.length} cached lesson{lessons.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Hero */}
      <div className="ss-hero" style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(90px,14vw,130px) 5% 56px', textAlign: 'center' }}>
        <span className="section-label">Every Saturday</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 16px' }}>
          Sabbath School
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8, fontSize: '0.95rem' }}>
          Weekly lessons to deepen your understanding of God's Word. Study along with our community every Sabbath.
        </p>
        <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
          📴 Available Offline
        </div>
      </div>

      {/* ── MOBILE STICKY TOP BAR ── */}
      <div className="ss-mobile-bar" style={{
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
          <span>📖</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.title : 'Pick a lesson'}
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

      {/* ── MOBILE LESSON LIST SHEET ── */}
      {showList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}
          onClick={() => setShowList(false)}>
          <div style={{ marginTop: 'auto', background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
            </div>
            <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem', marginBottom: 10 }}>All Lessons</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.92rem', boxSizing: 'border-box' }} />
              {quarters.length > 1 && (
                <select value={quarter} onChange={e => setQuarter(e.target.value)}
                  style={{ width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.92rem', background: 'white' }}>
                  <option value="all">All Quarters</option>
                  {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>No lessons found</div>
              )}
              {filtered.map(l => {
                const isSelected = selected?.id === l.id
                const isThisWeek = l.id === thisWeekLesson(lessons)?.id
                return (
                  <div key={l.id} className="ss-lesson-item" onClick={() => selectLesson(l)}
                    style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', background: isSelected ? 'var(--brand-pale)' : 'white', borderLeft: `4px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.95rem', lineHeight: 1.4 }}>{l.title}</div>
                      {isThisWeek && <span style={{ background: 'var(--gold)', color: 'white', fontSize: '0.62rem', padding: '3px 9px', borderRadius: 10, fontWeight: 900, flexShrink: 0, alignSelf: 'flex-start' }}>NOW</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>{fmt(l.lesson_date)}</div>
                    {l.scripture && <div style={{ fontSize: '0.78rem', color: 'var(--brand-light)', marginTop: 3, fontWeight: 600 }}>📜 {l.scripture}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="ss-outer" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 4% 80px' }}>
        <div className="ss-content-wrap" style={{ display: 'block' }}>

          {/* Desktop Sidebar */}
          <div className="ss-desktop-sidebar" style={{ display: 'none' }}>
            <div style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e2e8f0', overflow: 'hidden', position: 'sticky', top: 24 }}>
              <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1f5f9' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                {quarters.length > 1 && (
                  <select value={quarter} onChange={e => setQuarter(e.target.value)}
                    style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'white' }}>
                    <option value="all">All Quarters</option>
                    {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                )}
              </div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {filtered.map(l => {
                  const isSelected = selected?.id === l.id
                  const isThisWeek = l.id === thisWeekLesson(lessons)?.id
                  return (
                    <div key={l.id} className="ss-lesson-item" onClick={() => selectLesson(l)}
                      style={{ padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', background: isSelected ? 'var(--brand-pale)' : 'white', borderLeft: `3px solid ${isSelected ? 'var(--brand-light)' : 'transparent'}`, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.85rem', lineHeight: 1.4 }}>{l.title}</div>
                        {isThisWeek && <span style={{ background: 'var(--gold)', color: 'white', fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, fontWeight: 900, flexShrink: 0 }}>NOW</span>}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: 3 }}>{fmt(l.lesson_date)}</div>
                      {l.scripture && <div style={{ fontSize: '0.71rem', color: 'var(--brand-light)', marginTop: 2, fontWeight: 600 }}>📜 {l.scripture}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Content Panel */}
          <div>
            {!selected ? (
              <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e2e8f0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📖</div>
                <div style={{ color: 'var(--text-light)' }}>Select a lesson to read</div>
              </div>
            ) : (
              <div className="ss-card" style={{ background: 'white', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>

                {/* Lesson Header */}
                <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(20px,4vw,32px) clamp(18px,4vw,32px) 0' }}>
                  {selected.quarter && (
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                      {selected.quarter}
                    </div>
                  )}
                  <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.3rem,4.5vw,2rem)', margin: '0 0 14px', lineHeight: 1.25 }}>
                    {selected.title}
                  </h2>
                  {selected.scripture && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--brand-deep)', padding: '7px 18px', borderRadius: 30, fontSize: 'clamp(0.78rem,2vw,0.88rem)', fontWeight: 800, marginBottom: 14 }}>
                      📜 LESSON READING: {selected.scripture}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>📅 {fmt(selected.lesson_date)}</span>
                    {selected.author && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>✍️ {selected.author}</span>}
                    {selected.pdf_url && (
                      <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.3)', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
                        📄 Download PDF
                      </a>
                    )}
                  </div>

                  {/* Tabs row + desktop T-/T+ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                          padding: 'clamp(8px,1.5vw,11px) clamp(14px,3vw,24px)',
                          borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font-body)', fontSize: 'clamp(0.8rem,2vw,0.9rem)', fontWeight: 700,
                          background: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.12)',
                          color: activeTab === tab.id ? 'var(--brand-deep)' : 'rgba(255,255,255,0.8)',
                          borderBottom: activeTab === tab.id ? '2px solid white' : '2px solid transparent',
                          transition: 'all 0.15s',
                        }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {/* Desktop T-/T+ */}
                    <div style={{ display: 'flex', gap: 5, paddingBottom: 10 }}>
                      <button onClick={() => changeFontSize(-1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T−</button>
                      <button onClick={() => changeFontSize(1)}  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T+</button>
                    </div>
                  </div>
                </div>

                {/* Tab Body */}
                <div style={{ padding: 'clamp(20px,5vw,36px)' }}>

                  {/* LESSON */}
                  {activeTab === 'lesson' && (
                    <div>
                      {selected.summary && (
                        <div style={{ background: 'var(--brand-pale)', borderLeft: '4px solid var(--brand-light)', borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 28, fontStyle: 'italic', color: 'var(--brand-deep)', lineHeight: 1.8, fontSize: fontSize + 'px' }}>
                          {selected.summary}
                        </div>
                      )}
                      {selected.body ? (
                        <ReadingContent blocks={parseBlocks(selected.body)} fontSize={fontSize} />
                      ) : selected.pdf_url ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
                          <p style={{ color: 'var(--text-mid)', marginBottom: 20 }}>This lesson is available as a PDF download.</p>
                          <a href={selected.pdf_url} target="_blank" rel="noreferrer" className="btn btn-blue">Download Lesson PDF</a>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>No content available for this lesson.</div>
                      )}
                      {selected.discussion_questions && (
                        <div style={{ marginTop: 32, background: '#fffbf0', borderRadius: 14, padding: '22px 24px', border: '1.5px solid #fcd34d' }}>
                          <h4 style={{ fontFamily: 'var(--font-display)', color: '#92400e', margin: '0 0 16px', fontSize: (fontSize + 1) + 'px' }}>Discussion Questions</h4>
                          <div style={{ lineHeight: 1.9, fontSize: fontSize + 'px' }}>
                            {selected.discussion_questions.split('\n').filter(Boolean).map((q, i) => (
                              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                <span style={{ color: 'var(--gold)', fontWeight: 900, flexShrink: 0 }}>{i + 1}.</span>
                                <span>{q.replace(/^\d+\.\s*/, '')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ANALYSIS */}
                  {activeTab === 'analysis' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🔍</div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: (fontSize + 1) + 'px' }}>Detailed Analysis</div>
                          <div style={{ fontSize: (fontSize - 3) + 'px', color: 'var(--text-light)' }}>In-depth study and commentary</div>
                        </div>
                      </div>
                      {selected.analysis ? (
                        <ReadingContent blocks={parseBlocks(selected.analysis)} fontSize={fontSize} />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-light)' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
                          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: fontSize + 'px' }}>No analysis yet</div>
                          <div style={{ fontSize: (fontSize - 2) + 'px' }}>Analysis for this lesson will appear here when added.</div>
                        </div>
                      )}
                      {selected.analysis_points && (
                        <div style={{ marginTop: 32 }}>
                          <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: (fontSize + 1) + 'px', marginBottom: 16 }}>Key Points</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {selected.analysis_points.split('\n').filter(Boolean).map((pt, i) => (
                              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--brand-pale)', borderRadius: 12, padding: '14px 18px' }}>
                                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
                                <span style={{ color: 'var(--brand-deep)', fontSize: fontSize + 'px', lineHeight: 1.7 }}>{pt.replace(/^\d+\.\s*/, '')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SERVICE */}
                  {activeTab === 'divine' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {(selected.divine_message_title || selected.divine_message_speaker) && (
                        <div style={{ background: 'linear-gradient(135deg,var(--brand-pale),#f0f7ff)', borderRadius: 16, padding: 'clamp(18px,4vw,28px)', border: '1.5px solid #bfdbfe' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <span style={{ fontSize: '1.6rem' }}>⛪</span>
                            <div>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: 'clamp(1rem,2.5vw,1.15rem)' }}>Divine Service Message</div>
                              <div style={{ fontSize: (fontSize - 3) + 'px', color: 'var(--text-light)' }}>Sabbath Morning Service</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {selected.divine_message_title && (
                              <div style={{ background: 'white', borderRadius: 12, padding: 'clamp(12px,3vw,18px)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand-light)', marginBottom: 6 }}>SERMON TITLE</div>
                                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: 'clamp(1rem,3vw,1.2rem)', lineHeight: 1.35 }}>{selected.divine_message_title}</div>
                              </div>
                            )}
                            {selected.divine_message_speaker && (
                              <div style={{ background: 'white', borderRadius: 12, padding: 'clamp(12px,3vw,18px)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand-light)', marginBottom: 6 }}>PREACHER</div>
                                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: fontSize + 'px' }}>🎙 {selected.divine_message_speaker}</div>
                              </div>
                            )}
                            {selected.divine_message_scripture && (
                              <div style={{ background: 'white', borderRadius: 12, padding: 'clamp(12px,3vw,18px)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brand-light)', marginBottom: 6 }}>SCRIPTURE</div>
                                <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: fontSize + 'px' }}>📜 {selected.divine_message_scripture}</div>
                              </div>
                            )}
                            {selected.divine_message_notes && (
                              <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '12px 16px', fontSize: fontSize + 'px', color: 'var(--text-mid)', lineHeight: 1.8, fontStyle: 'italic' }}>
                                {selected.divine_message_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {(selected.evening_title || selected.evening_speaker) && (
                        <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#2d2b5e)', borderRadius: 16, padding: 'clamp(18px,4vw,28px)', border: '1.5px solid #4338ca' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <span style={{ fontSize: '1.6rem' }}>🌙</span>
                            <div>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 'clamp(1rem,2.5vw,1.15rem)' }}>Evening Service Message</div>
                              <div style={{ fontSize: (fontSize - 3) + 'px', color: 'rgba(255,255,255,0.5)' }}>Sabbath Evening Service</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {selected.evening_title && (
                              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 'clamp(12px,3vw,18px)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>SERMON TITLE</div>
                                <div style={{ fontWeight: 700, color: 'white', fontSize: 'clamp(1rem,3vw,1.2rem)', lineHeight: 1.35 }}>{selected.evening_title}</div>
                              </div>
                            )}
                            {selected.evening_speaker && (
                              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 'clamp(12px,3vw,18px)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>PREACHER</div>
                                <div style={{ fontWeight: 700, color: 'white', fontSize: fontSize + 'px' }}>🎙 {selected.evening_speaker}</div>
                              </div>
                            )}
                            {selected.evening_scripture && (
                              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 'clamp(12px,3vw,18px)' }}>
                                <div style={{ fontSize: (fontSize - 5) + 'px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>SCRIPTURE</div>
                                <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: fontSize + 'px' }}>📜 {selected.evening_scripture}</div>
                              </div>
                            )}
                            {selected.evening_notes && (
                              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', fontSize: fontSize + 'px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, fontStyle: 'italic' }}>
                                {selected.evening_notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Prev / Next */}
                <div style={{ padding: '16px clamp(16px,4vw,28px)', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  {prevLesson ? (
                    <button onClick={() => selectLesson(prevLesson)} style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'left', lineHeight: 1.4 }}>
                      ← {prevLesson.title.length > 30 ? prevLesson.title.slice(0, 30) + '…' : prevLesson.title}
                    </button>
                  ) : <div />}
                  {nextLesson ? (
                    <button onClick={() => selectLesson(nextLesson)} style={{ background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', color: 'var(--text-mid)', fontFamily: 'var(--font-body)', fontSize: (fontSize - 3) + 'px', flex: 1, textAlign: 'right', lineHeight: 1.4 }}>
                      {nextLesson.title.length > 30 ? nextLesson.title.slice(0, 30) + '…' : nextLesson.title} →
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
