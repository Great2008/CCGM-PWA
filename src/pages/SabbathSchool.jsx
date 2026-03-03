import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

const CACHE_KEY = 'ccg-sabbath-lessons'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function loadCache(ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Support both old format (plain array) and new format ({ data, ts })
    const data = Array.isArray(parsed) ? parsed : parsed.data
    const ts   = Array.isArray(parsed) ? 0      : parsed.ts
    if (!data || data.length === 0) return null
    // If offline or ignoreExpiry, always return cached data regardless of age
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

export default function SabbathSchool() {
  const [lessons, setLessons]   = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [offline, setOffline]   = useState(false)
  const [search, setSearch]     = useState('')
  const [quarter, setQuarter]   = useState('all')

  useEffect(() => {
    // 1. Always load cache first with expiry ignored — show something immediately
    const cached = loadCache(true)
    if (cached && cached.length > 0) {
      setLessons(cached)
      setSelected(thisWeekLesson(cached))
      setLoading(false)
    }

    // 2. Try network refresh — but don't let it block or clear cached data
    const fetchFresh = async () => {
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
          // Network returned nothing — keep cache, mark offline
          if (!cached || cached.length === 0) setLoading(false)
          setOffline(true)
        }
      } catch {
        // Network error — keep whatever cache we have
        if (!cached || cached.length === 0) {
          setOffline(true)
          setLoading(false)
        } else {
          setOffline(true)
        }
      }
      if (!cached || cached.length === 0) setLoading(false)
    }

    fetchFresh()
  }, [])

  const quarters = [...new Set(lessons.map(l => l.quarter).filter(Boolean))].sort().reverse()

  const filtered = lessons.filter(l => {
    const matchQ = quarter === 'all' || l.quarter === quarter
    const matchS = !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.scripture||'').toLowerCase().includes(search.toLowerCase())
    return matchQ && matchS
  })

  if (loading) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontSize:'2rem',animation:'spin 1.5s linear infinite'}}>📖</div>
      <div style={{color:'var(--text-light)'}}>Loading lessons...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (offline && lessons.length === 0) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:'0 24px',textAlign:'center'}}>
      <div style={{fontSize:'3rem'}}>📴</div>
      <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'1.3rem',color:'var(--brand-deep)'}}>You're Offline</div>
      <div style={{color:'var(--text-mid)',maxWidth:320,lineHeight:1.7}}>
        No cached lessons found. Visit Sabbath School while online at least once to enable offline access.
      </div>
    </div>
  )

  return (
    <>
      {/* Offline banner */}
      {offline && lessons.length > 0 && (
        <div style={{background:'#fff9f0',borderBottom:'2px solid #fed7aa',padding:'10px 20px',textAlign:'center',fontSize:'0.82rem',color:'#c2410c',fontWeight:600}}>
          📴 You're offline — showing {lessons.length} cached lesson{lessons.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(90px,14vw,130px) 5% 56px',textAlign:'center'}}>
        <span className="section-label">Every Saturday</span>
        <h1 style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'clamp(2rem,5vw,3rem)',color:'white',margin:'8px 0 16px'}}>
          📖 Sabbath School
        </h1>
        <p style={{color:'rgba(255,255,255,0.75)',maxWidth:520,margin:'0 auto',lineHeight:1.8,fontSize:'0.95rem'}}>
          Weekly lessons to deepen your understanding of God's Word. Study along with our community every Sabbath.
        </p>
        <div style={{marginTop:16,display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.12)',padding:'6px 16px',borderRadius:20,fontSize:'0.75rem',color:'rgba(255,255,255,0.8)',fontWeight:600}}>
          ✅ Available Offline
        </div>
      </div>

      <div className="container" style={{maxWidth:1100,padding:'40px 5% 80px'}}>

        {/* This Week highlight */}
        {selected && (
          <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',borderRadius:20,padding:'clamp(28px,4vw,40px)',marginBottom:40,color:'white',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:'-2%',bottom:'-5%',fontSize:'12rem',opacity:0.04,lineHeight:1,pointerEvents:'none'}}>📖</div>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                <span style={{background:'var(--gold)',color:'var(--brand-deep)',padding:'4px 14px',borderRadius:20,fontSize:'0.72rem',fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                  {selected.lesson_date === lessons[0]?.lesson_date ? "This Week's Lesson" : "Latest Lesson"}
                </span>
                {selected.quarter && <span style={{background:'rgba(255,255,255,0.15)',padding:'4px 12px',borderRadius:20,fontSize:'0.72rem',fontWeight:700}}>{selected.quarter}</span>}
              </div>
              <h2 style={{fontFamily:'var(--font-display)',fontSize:'clamp(1.4rem,3vw,2rem)',margin:'0 0 8px',lineHeight:1.3}}>{selected.title}</h2>
              {selected.scripture && <div style={{color:'var(--gold)',fontWeight:700,fontSize:'0.88rem',marginBottom:12}}>📜 {selected.scripture}</div>}
              <div style={{color:'rgba(255,255,255,0.6)',fontSize:'0.82rem',marginBottom:20}}>📅 {fmt(selected.lesson_date)}</div>
              {selected.summary && <p style={{color:'rgba(255,255,255,0.85)',lineHeight:1.8,maxWidth:640,marginBottom:24,fontSize:'0.95rem'}}>{selected.summary}</p>}
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <button onClick={()=>document.getElementById('lesson-content').scrollIntoView({behavior:'smooth'})}
                  className="btn btn-gold" style={{padding:'10px 24px'}}>
                  📖 Read Full Lesson
                </button>
                {selected.pdf_url && (
                  <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                    style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:40,border:'1.5px solid rgba(255,255,255,0.3)',color:'white',textDecoration:'none',fontWeight:700,fontSize:'0.88rem'}}>
                    📄 Download PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:32,alignItems:'start'}} className="ss-grid">

          {/* Sidebar — lesson list */}
          <div>
            <div style={{background:'white',borderRadius:16,boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
              <div style={{padding:'18px 18px 14px',borderBottom:'1px solid #f1f5f9'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="🔍 Search lessons..."
                  style={{width:'100%',padding:'9px 12px',borderRadius:9,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.85rem',boxSizing:'border-box'}} />
                {quarters.length > 1 && (
                  <select value={quarter} onChange={e=>setQuarter(e.target.value)}
                    style={{width:'100%',marginTop:8,padding:'9px 12px',borderRadius:9,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.85rem',background:'white'}}>
                    <option value="all">All Quarters</option>
                    {quarters.map(q=><option key={q} value={q}>{q}</option>)}
                  </select>
                )}
              </div>
              <div style={{maxHeight:520,overflowY:'auto'}}>
                {filtered.length === 0 && (
                  <div style={{padding:32,textAlign:'center',color:'var(--text-light)',fontSize:'0.88rem'}}>No lessons found</div>
                )}
                {filtered.map(l => {
                  const isSelected = selected?.id === l.id
                  const isThisWeek = l.id === thisWeekLesson(lessons)?.id
                  return (
                    <div key={l.id} onClick={()=>{ setSelected(l); setTimeout(()=>document.getElementById('lesson-content')?.scrollIntoView({behavior:'smooth'}),100) }}
                      style={{padding:'14px 18px',cursor:'pointer',borderBottom:'1px solid #f8fafc',
                        background:isSelected?'var(--brand-pale)':'white',
                        borderLeft:`3px solid ${isSelected?'var(--brand-light)':'transparent'}`,
                        transition:'all 0.15s'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{fontWeight:isSelected?700:500,color:'var(--brand-deep)',fontSize:'0.88rem',lineHeight:1.4}}>{l.title}</div>
                        {isThisWeek && <span style={{background:'var(--gold)',color:'white',fontSize:'0.6rem',padding:'2px 7px',borderRadius:10,fontWeight:900,flexShrink:0}}>NOW</span>}
                      </div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-light)',marginTop:3}}>{fmt(l.lesson_date)}</div>
                      {l.scripture && <div style={{fontSize:'0.72rem',color:'var(--brand-light)',marginTop:2,fontWeight:600}}>📜 {l.scripture}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div id="lesson-content">
            {!selected ? (
              <div style={{background:'white',borderRadius:16,padding:48,textAlign:'center',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
                <div style={{fontSize:'3rem',marginBottom:12}}>📖</div>
                <div style={{color:'var(--text-light)'}}>Select a lesson to read</div>
              </div>
            ) : (
              <div style={{background:'white',borderRadius:16,boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
                <div style={{background:'linear-gradient(135deg,var(--brand-pale),white)',padding:'28px 32px',borderBottom:'1px solid #f1f5f9'}}>
                  {selected.quarter && <div style={{fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--brand-light)',marginBottom:8}}>{selected.quarter}</div>}
                  <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'clamp(1.4rem,2.5vw,1.8rem)',margin:'0 0 8px',lineHeight:1.3}}>{selected.title}</h2>
                  {selected.scripture && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--gold)',color:'white',padding:'6px 16px',borderRadius:20,fontSize:'0.82rem',fontWeight:700,marginBottom:10}}>
                      📜 Memory Text: {selected.scripture}
                    </div>
                  )}
                  <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:8}}>
                    <span style={{color:'var(--text-light)',fontSize:'0.82rem'}}>📅 {fmt(selected.lesson_date)}</span>
                    {selected.author && <span style={{color:'var(--text-light)',fontSize:'0.82rem'}}>✍️ {selected.author}</span>}
                  </div>
                </div>

                {selected.pdf_url && (
                  <div style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',padding:'12px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                    <span style={{color:'#166534',fontSize:'0.85rem',fontWeight:600}}>📄 PDF version available</span>
                    <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                      style={{background:'#16a34a',color:'white',padding:'7px 18px',borderRadius:20,textDecoration:'none',fontWeight:700,fontSize:'0.82rem'}}>
                      Download PDF
                    </a>
                  </div>
                )}

                <div style={{padding:'28px 32px'}}>
                  {selected.summary && (
                    <div style={{background:'var(--brand-pale)',borderLeft:'4px solid var(--brand-light)',borderRadius:'0 10px 10px 0',padding:'16px 20px',marginBottom:28,fontStyle:'italic',color:'var(--brand-deep)',lineHeight:1.8,fontSize:'0.95rem'}}>
                      {selected.summary}
                    </div>
                  )}
                  {selected.body ? (
                    <div style={{lineHeight:1.9,color:'var(--text-dark)',fontSize:'0.95rem'}}>
                      {selected.body.split('\n\n').map((para,i) => (
                        para.startsWith('##') ? (
                          <h3 key={i} style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.15rem',margin:'28px 0 12px',borderBottom:'2px solid var(--brand-pale)',paddingBottom:6}}>
                            {para.replace(/^##\s*/,'')}
                          </h3>
                        ) : para.startsWith('#') ? (
                          <h4 key={i} style={{fontFamily:'var(--font-display)',color:'var(--brand-light)',fontSize:'1rem',margin:'20px 0 8px',fontWeight:700}}>
                            {para.replace(/^#\s*/,'')}
                          </h4>
                        ) : (
                          <p key={i} style={{marginBottom:18}}>{para}</p>
                        )
                      ))}
                    </div>
                  ) : selected.pdf_url ? (
                    <div style={{textAlign:'center',padding:'40px 20px'}}>
                      <div style={{fontSize:'3rem',marginBottom:12}}>📄</div>
                      <p style={{color:'var(--text-mid)',marginBottom:20}}>This lesson is available as a PDF download.</p>
                      <a href={selected.pdf_url} target="_blank" rel="noreferrer" className="btn btn-blue">Download Lesson PDF</a>
                    </div>
                  ) : (
                    <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-light)'}}>No content available for this lesson.</div>
                  )}

                  {selected.discussion_questions && (
                    <div style={{marginTop:32,background:'#fffbf0',borderRadius:12,padding:'20px 24px',border:'1.5px solid #fcd34d'}}>
                      <h4 style={{fontFamily:'var(--font-display)',color:'#92400e',margin:'0 0 14px',fontSize:'1rem'}}>💬 Discussion Questions</h4>
                      <div style={{color:'var(--text-dark)',lineHeight:1.9,fontSize:'0.92rem'}}>
                        {selected.discussion_questions.split('\n').filter(Boolean).map((q,i)=>(
                          <div key={i} style={{display:'flex',gap:10,marginBottom:8}}>
                            <span style={{color:'var(--gold)',fontWeight:900,flexShrink:0}}>{i+1}.</span>
                            <span>{q.replace(/^\d+\.\s*/,'')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Divine Service Message */}
                  {(selected.divine_message_title || selected.divine_message_speaker) && (
                    <div style={{marginTop:32,background:'linear-gradient(135deg,var(--brand-pale),#f0f7ff)',borderRadius:14,padding:'22px 26px',border:'1.5px solid #bfdbfe'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                        <span style={{fontSize:'1.5rem'}}>⛪</span>
                        <div>
                          <div style={{fontFamily:'var(--font-display)',fontWeight:800,color:'var(--brand-deep)',fontSize:'1rem'}}>Divine Service Message</div>
                          <div style={{fontSize:'0.74rem',color:'var(--text-light)'}}>Sabbath Morning Service</div>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                        {selected.divine_message_title && (
                          <div style={{background:'white',borderRadius:10,padding:'12px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--brand-light)',marginBottom:4}}>Sermon Title</div>
                            <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.92rem'}}>{selected.divine_message_title}</div>
                          </div>
                        )}
                        {selected.divine_message_speaker && (
                          <div style={{background:'white',borderRadius:10,padding:'12px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--brand-light)',marginBottom:4}}>Preacher</div>
                            <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.92rem'}}>🎙 {selected.divine_message_speaker}</div>
                          </div>
                        )}
                        {selected.divine_message_scripture && (
                          <div style={{background:'white',borderRadius:10,padding:'12px 16px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--brand-light)',marginBottom:4}}>Scripture</div>
                            <div style={{fontWeight:700,color:'var(--gold)',fontSize:'0.92rem'}}>📜 {selected.divine_message_scripture}</div>
                          </div>
                        )}
                      </div>
                      {selected.divine_message_notes && (
                        <div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,0.7)',borderRadius:8,fontSize:'0.85rem',color:'var(--text-mid)',lineHeight:1.6,fontStyle:'italic'}}>
                          {selected.divine_message_notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evening Service Message */}
                  {(selected.evening_title || selected.evening_speaker) && (
                    <div style={{marginTop:16,background:'linear-gradient(135deg,#1e1b4b,#2d2b5e)',borderRadius:14,padding:'22px 26px',border:'1.5px solid #4338ca'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                        <span style={{fontSize:'1.5rem'}}>🌙</span>
                        <div>
                          <div style={{fontFamily:'var(--font-display)',fontWeight:800,color:'white',fontSize:'1rem'}}>Evening Service Message</div>
                          <div style={{fontSize:'0.74rem',color:'rgba(255,255,255,0.5)'}}>Sabbath Evening Service</div>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                        {selected.evening_title && (
                          <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 16px'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)',marginBottom:4}}>Sermon Title</div>
                            <div style={{fontWeight:700,color:'white',fontSize:'0.92rem'}}>{selected.evening_title}</div>
                          </div>
                        )}
                        {selected.evening_speaker && (
                          <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 16px'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)',marginBottom:4}}>Preacher</div>
                            <div style={{fontWeight:700,color:'white',fontSize:'0.92rem'}}>🎙 {selected.evening_speaker}</div>
                          </div>
                        )}
                        {selected.evening_scripture && (
                          <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 16px'}}>
                            <div style={{fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)',marginBottom:4}}>Scripture</div>
                            <div style={{fontWeight:700,color:'var(--gold)',fontSize:'0.92rem'}}>📜 {selected.evening_scripture}</div>
                          </div>
                        )}
                      </div>
                      {selected.evening_notes && (
                        <div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,0.07)',borderRadius:8,fontSize:'0.85rem',color:'rgba(255,255,255,0.7)',lineHeight:1.6,fontStyle:'italic'}}>
                          {selected.evening_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{padding:'16px 32px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',gap:12}}>
                  {(() => {
                    const idx = filtered.findIndex(l=>l.id===selected.id)
                    const prev = filtered[idx+1]; const next = filtered[idx-1]
                    return (<>
                      {prev ? <button onClick={()=>setSelected(prev)} style={{background:'none',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'9px 18px',cursor:'pointer',color:'var(--text-mid)',fontFamily:'var(--font-body)',fontSize:'0.82rem'}}>← {prev.title.length>30?prev.title.slice(0,30)+'…':prev.title}</button> : <div/>}
                      {next ? <button onClick={()=>setSelected(next)} style={{background:'none',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'9px 18px',cursor:'pointer',color:'var(--text-mid)',fontFamily:'var(--font-body)',fontSize:'0.82rem'}}>{next.title.length>30?next.title.slice(0,30)+'…':next.title} →</button> : <div/>}
                    </>)
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@media(max-width:768px){.ss-grid{grid-template-columns:1fr!important;}}`}</style>
    </>
  )
}
