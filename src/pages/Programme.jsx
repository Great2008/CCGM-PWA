import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function fmtDate(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('T')[0].split('-').map(Number)
  return `${d} ${MONTHS[m-1]} ${y}`
}

function fmtDateShort(iso) {
  if (!iso) return ''
  const [y,m,d] = iso.split('T')[0].split('-').map(Number)
  const dt = new Date(y, m-1, d)
  return `${DAYS[dt.getDay()].slice(0,3)}, ${d} ${MONTHS[m-1].slice(0,3)}`
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`
}

const PERIOD_ORDER = { morning: 0, afternoon: 1, evening: 2, special: 3 }
const PERIOD_META = {
  morning:   { label: '🌅 Morning',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  afternoon: { label: '☀️ Afternoon', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  evening:   { label: '🌙 Evening',   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  special:   { label: '⭐ Special',   color: '#dc2626', bg: '#fff5f5', border: '#fecaca' },
}

export default function Programme() {
  const { user, profile } = useAuth()
  const [programme, setProgramme]   = useState(null)
  const [days, setDays]             = useState([])
  const [sessions, setSessions]     = useState([]) // flat, all days
  const [rsvps, setRsvps]           = useState(new Set()) // session_ids user has RSVPd
  const [rsvpCounts, setRsvpCounts] = useState({}) // session_id → count
  const [activeDay, setActiveDay]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(null) // session_id being toggled

  // ── Load programme ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      // Fetch active programme
      const { data: prog } = await supabase
        .from('programmes')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!prog) { setLoading(false); return }
      setProgramme(prog)

      // Fetch days
      const { data: daysData } = await supabase
        .from('programme_days')
        .select('*')
        .eq('programme_id', prog.id)
        .order('day_number')
      setDays(daysData || [])

      if (!daysData?.length) { setLoading(false); return }

      const dayIds = daysData.map(d => d.id)

      // Fetch sessions
      const { data: sessData } = await supabase
        .from('programme_sessions')
        .select('*')
        .in('day_id', dayIds)
        .order('sort_order')
      setSessions(sessData || [])

      // Fetch RSVP counts
      if (sessData?.length) {
        const sessIds = sessData.map(s => s.id)
        const { data: counts } = await supabase
          .from('programme_rsvps')
          .select('session_id')
          .in('session_id', sessIds)
        const countMap = {}
        for (const r of counts || []) {
          countMap[r.session_id] = (countMap[r.session_id] || 0) + 1
        }
        setRsvpCounts(countMap)

        // Fetch user's own RSVPs
        if (user) {
          const { data: myRsvps } = await supabase
            .from('programme_rsvps')
            .select('session_id')
            .eq('user_id', user.id)
            .in('session_id', sessIds)
          setRsvps(new Set((myRsvps || []).map(r => r.session_id)))
        }
      }

      setLoading(false)
    }
    load()
  }, [user])

  // ── RSVP toggle ──────────────────────────────────────────────────
  const toggleRsvp = async (sessionId) => {
    if (!user) return
    setRsvpLoading(sessionId)
    const already = rsvps.has(sessionId)

    if (already) {
      await supabase.from('programme_rsvps')
        .delete().eq('session_id', sessionId).eq('user_id', user.id)
      setRsvps(prev => { const s = new Set(prev); s.delete(sessionId); return s })
      setRsvpCounts(prev => ({ ...prev, [sessionId]: Math.max(0, (prev[sessionId]||1)-1) }))
    } else {
      await supabase.from('programme_rsvps')
        .insert({ session_id: sessionId, user_id: user.id })
      setRsvps(prev => new Set([...prev, sessionId]))
      setRsvpCounts(prev => ({ ...prev, [sessionId]: (prev[sessionId]||0)+1 }))
    }
    setRsvpLoading(null)
  }

  // ── No active programme ──────────────────────────────────────────
  if (!loading && !programme) {
    return (
      <>
        <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'clamp(90px,14vw,130px) 5% 60px', textAlign:'center' }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3rem)', color:'white', margin:'0 0 14px' }}>
            📅 Programme of Activities
          </h1>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'1rem' }}>Christian Church of God Mission</p>
        </div>
        <div className="container" style={{ maxWidth:600, padding:'80px 5%', textAlign:'center' }}>
          <div style={{ fontSize:'4rem', marginBottom:20 }}>📋</div>
          <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 14px' }}>No Active Programme</h2>
          <p style={{ color:'var(--text-mid)', lineHeight:1.8 }}>There is no event programme published at the moment. Check back soon or watch out for announcements.</p>
          <Link to="/" style={{ display:'inline-block', marginTop:28, padding:'12px 30px', borderRadius:30, background:'var(--brand-mid)', color:'white', fontWeight:700, textDecoration:'none', fontFamily:'var(--font-body)' }}>← Back to Home</Link>
        </div>
      </>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:'2.5rem', animation:'spin 1.2s linear infinite', display:'inline-block' }}>⏳</div>
        <p style={{ color:'var(--text-light)', fontFamily:'var(--font-body)' }}>Loading programme…</p>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Sessions for active day ──────────────────────────────────────
  const currentDay  = days[activeDay]
  const daySessions = sessions.filter(s => s.day_id === currentDay?.id)

  // Group by period in order
  const grouped = {}
  for (const s of daySessions) {
    const p = s.period || 'morning'
    if (!grouped[p]) grouped[p] = []
    grouped[p].push(s)
  }
  const sortedPeriods = Object.keys(grouped).sort(
    (a,b) => (PERIOD_ORDER[a] ?? 99) - (PERIOD_ORDER[b] ?? 99)
  )

  // Count my RSVPs for this day
  const daySessionIds = new Set(daySessions.map(s => s.id))
  const myDayRsvps = [...rsvps].filter(id => daySessionIds.has(id)).length

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg,var(--brand-deep) 0%,#166534 60%,#b45309 100%)',
        padding: 'clamp(90px,14vw,130px) 5% 0',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative rings */}
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', border:'60px solid rgba(251,191,36,0.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-60, width:220, height:220, borderRadius:'50%', border:'40px solid rgba(255,255,255,0.05)', pointerEvents:'none' }} />

        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center', position:'relative' }}>
          <span style={{ display:'inline-block', background:'rgba(251,191,36,0.18)', color:'#fbbf24', fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.18em', textTransform:'uppercase', padding:'5px 16px', borderRadius:30, marginBottom:18, border:'1px solid rgba(251,191,36,0.3)' }}>
            Special Event
          </span>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3.2rem)', color:'white', margin:'0 0 14px', lineHeight:1.2 }}>
            {programme.title}
          </h1>
          {programme.theme && (
            <p style={{ color:'#fbbf24', fontStyle:'italic', fontSize:'clamp(1rem,2vw,1.25rem)', margin:'0 0 12px', fontFamily:'Georgia, serif' }}>
              "{programme.theme}"
            </p>
          )}
          {programme.description && (
            <p style={{ color:'rgba(255,255,255,0.72)', maxWidth:620, margin:'0 auto 18px', lineHeight:1.8, fontSize:'0.95rem' }}>
              {programme.description}
            </p>
          )}

          {/* Date + venue pill row */}
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:12, marginBottom:32 }}>
            {(programme.start_date || programme.end_date) && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', borderRadius:30, padding:'8px 18px', border:'1px solid rgba(255,255,255,0.15)' }}>
                <span>📅</span>
                <span style={{ color:'white', fontSize:'0.88rem', fontWeight:600 }}>
                  {programme.start_date === programme.end_date
                    ? fmtDate(programme.start_date)
                    : `${fmtDate(programme.start_date)} – ${fmtDate(programme.end_date)}`}
                </span>
              </div>
            )}
            {programme.venue && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', borderRadius:30, padding:'8px 18px', border:'1px solid rgba(255,255,255,0.15)' }}>
                <span>📍</span>
                <span style={{ color:'white', fontSize:'0.88rem', fontWeight:600 }}>{programme.venue}</span>
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', borderRadius:30, padding:'8px 18px', border:'1px solid rgba(255,255,255,0.15)' }}>
              <span>📆</span>
              <span style={{ color:'white', fontSize:'0.88rem', fontWeight:600 }}>{days.length} Day{days.length!==1?'s':''}</span>
            </div>
          </div>

          {/* Day tabs — anchored to bottom of hero */}
          {days.length > 0 && (
            <div style={{ display:'flex', gap:0, overflowX:'auto', justifyContent:'center', flexWrap:'nowrap', marginBottom:0 }}>
              {days.map((day, idx) => (
                <button
                  key={day.id}
                  onClick={() => setActiveDay(idx)}
                  style={{
                    padding: '14px 20px', border:'none', cursor:'pointer',
                    background: activeDay===idx ? 'white' : 'transparent',
                    color: activeDay===idx ? 'var(--brand-deep)' : 'rgba(255,255,255,0.7)',
                    fontWeight: activeDay===idx ? 800 : 500,
                    fontFamily: 'var(--font-body)', fontSize:'0.82rem',
                    borderRadius:'12px 12px 0 0',
                    transition:'all 0.2s', whiteSpace:'nowrap',
                    borderBottom: activeDay===idx ? 'none' : '2px solid transparent',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontWeight:700, fontSize:'0.78rem', opacity:0.8 }}>Day {day.day_number}</div>
                  <div style={{ fontWeight:800, fontSize:'0.88rem' }}>{day.title || fmtDateShort(day.date)}</div>
                  {day.date && <div style={{ fontSize:'0.68rem', opacity:0.65, marginTop:1 }}>{fmtDateShort(day.date)}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Day content ───────────────────────────────────────────── */}
      <div style={{ background:'var(--white, white)', minHeight:400 }}>
        <div className="container" style={{ maxWidth:860, padding:'36px 5% 80px' }}>

          {/* Day header */}
          {currentDay && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:28 }}>
              <div>
                <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 4px', fontSize:'1.4rem' }}>
                  Day {currentDay.day_number}{currentDay.title ? ` — ${currentDay.title}` : ''}
                </h2>
                {currentDay.date && (
                  <p style={{ color:'var(--text-light)', margin:0, fontSize:'0.88rem' }}>
                    📅 {fmtDate(currentDay.date)}
                  </p>
                )}
              </div>
              {user && myDayRsvps > 0 && (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:20, padding:'6px 14px', fontSize:'0.8rem', color:'#15803d', fontWeight:700 }}>
                  ✅ You've registered for {myDayRsvps} session{myDayRsvps!==1?'s':''}
                </div>
              )}
            </div>
          )}

          {/* No sessions */}
          {daySessions.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-light)' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📋</div>
              <p>No sessions scheduled for this day yet.</p>
            </div>
          )}

          {/* Periods */}
          {sortedPeriods.map(period => {
            const meta = PERIOD_META[period] || PERIOD_META.morning
            return (
              <div key={period} style={{ marginBottom:36 }}>
                {/* Period heading */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <div style={{ height:2, flex:1, background:'linear-gradient(to right, transparent, #e2e8f0)' }} />
                  <span style={{ background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`, borderRadius:20, padding:'5px 16px', fontWeight:700, fontSize:'0.8rem', whiteSpace:'nowrap' }}>
                    {meta.label}
                  </span>
                  <div style={{ height:2, flex:1, background:'linear-gradient(to left, transparent, #e2e8f0)' }} />
                </div>

                {/* Sessions */}
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {grouped[period].map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isRsvpd={rsvps.has(session.id)}
                      count={rsvpCounts[session.id] || 0}
                      loading={rsvpLoading === session.id}
                      user={user}
                      onRsvp={() => toggleRsvp(session.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Sign in nudge for guests */}
          {!user && daySessions.length > 0 && (
            <div style={{ background:'var(--brand-pale)', border:'1.5px solid var(--brand-light)', borderRadius:16, padding:'20px 24px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginTop:8 }}>
              <div style={{ fontSize:'1.5rem' }}>✋</div>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:2 }}>Want to RSVP for sessions?</div>
                <div style={{ color:'var(--text-mid)', fontSize:'0.86rem' }}>Sign in to register your attendance for individual sessions.</div>
              </div>
              <Link to="/timeline" style={{ padding:'10px 22px', borderRadius:30, background:'var(--brand-mid)', color:'white', fontWeight:700, textDecoration:'none', fontFamily:'var(--font-body)', fontSize:'0.86rem', whiteSpace:'nowrap' }}>Sign In →</Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @media(max-width:600px){ .session-card-inner { flex-direction:column !important; } }
      `}</style>
    </>
  )
}

// ── Session card ───────────────────────────────────────────────────
function SessionCard({ session, isRsvpd, count, loading, user, onRsvp }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: isRsvpd ? '#f0fdf4' : 'var(--white, white)',
      border: `1.5px solid ${isRsvpd ? '#86efac' : '#e2e8f0'}`,
      borderRadius: 14, overflow:'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      transition:'border-color 0.2s, background 0.2s',
    }}>
      <div className="session-card-inner" style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'18px 20px' }}>

        {/* Time column */}
        <div style={{ textAlign:'center', minWidth:60, flexShrink:0 }}>
          {session.time_start && (
            <div style={{ fontWeight:800, color:'var(--brand-deep)', fontSize:'0.88rem', lineHeight:1.2 }}>{fmtTime(session.time_start)}</div>
          )}
          {session.time_start && session.time_end && (
            <div style={{ color:'var(--text-light)', fontSize:'0.72rem', marginTop:2 }}>–</div>
          )}
          {session.time_end && (
            <div style={{ color:'var(--text-light)', fontSize:'0.72rem' }}>{fmtTime(session.time_end)}</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width:2, alignSelf:'stretch', background:'#e2e8f0', borderRadius:2, flexShrink:0, minHeight:40 }} />

        {/* Content */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'1rem', marginBottom:4, lineHeight:1.3 }}>
            {session.title}
          </div>

          {/* Tags row */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: (session.scripture || session.notes) ? 8 : 0 }}>
            {session.speaker && (
              <span style={{ background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:20, padding:'2px 10px', fontSize:'0.74rem', fontWeight:600 }}>
                🎤 {session.speaker}
              </span>
            )}
            {session.venue && (
              <span style={{ background:'#fafafa', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:20, padding:'2px 10px', fontSize:'0.74rem', fontWeight:600 }}>
                📍 {session.venue}
              </span>
            )}
            {session.scripture && (
              <span style={{ background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', borderRadius:20, padding:'2px 10px', fontSize:'0.74rem', fontWeight:600 }}>
                📖 {session.scripture}
              </span>
            )}
          </div>

          {/* Notes (collapsible) */}
          {session.notes && (
            <div>
              {!expanded ? (
                <button onClick={() => setExpanded(true)} style={{ background:'none', border:'none', color:'var(--brand-mid)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', padding:0, fontFamily:'var(--font-body)' }}>
                  + Show details
                </button>
              ) : (
                <>
                  <p style={{ color:'var(--text-mid)', fontSize:'0.84rem', lineHeight:1.7, margin:'4px 0 6px' }}>{session.notes}</p>
                  <button onClick={() => setExpanded(false)} style={{ background:'none', border:'none', color:'var(--text-light)', fontSize:'0.78rem', cursor:'pointer', padding:0, fontFamily:'var(--font-body)' }}>
                    Hide details
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* RSVP column */}
        <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
          {user ? (
            <button
              onClick={onRsvp}
              disabled={loading}
              style={{
                padding:'8px 16px', borderRadius:20, border:'none', cursor: loading ? 'wait' : 'pointer',
                background: isRsvpd
                  ? 'linear-gradient(135deg,#15803d,#16a34a)'
                  : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))',
                color:'white', fontWeight:700, fontSize:'0.78rem',
                fontFamily:'var(--font-body)', transition:'all 0.2s',
                opacity: loading ? 0.7 : 1, whiteSpace:'nowrap',
              }}
            >
              {loading ? '…' : isRsvpd ? '✅ Going' : '+ RSVP'}
            </button>
          ) : (
            <Link to="/timeline" style={{
              padding:'8px 16px', borderRadius:20, textDecoration:'none',
              background:'#f1f5f9', color:'var(--text-mid)', fontWeight:700,
              fontSize:'0.78rem', fontFamily:'var(--font-body)', whiteSpace:'nowrap',
            }}>Sign in</Link>
          )}
          {count > 0 && (
            <div style={{ color:'var(--text-light)', fontSize:'0.72rem', fontWeight:600 }}>
              {count} attending
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
