import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { ShareButtonLight } from '../components/ShareButton'
import SEO from '../components/SEO'
import { APP_URL } from '../lib/config'

const TODAY_STR = new Date().toISOString().slice(0, 10)

function fmt(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

// Monday-start week key for a given ISO date string
function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d
}

function weekLabel(monday) {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const todayMonday = getMonday(TODAY_STR)
  const diffWeeks = Math.round((todayMonday - monday) / (7 * 24 * 60 * 60 * 1000))
  if (diffWeeks === 0) return 'This Week'
  if (diffWeeks === 1) return 'Last Week'
  const opt = { month: 'short', day: 'numeric' }
  return `Week of ${monday.toLocaleDateString('en-US', opt)} – ${sunday.toLocaleDateString('en-US', opt)}`
}

export default function Podcast() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScript, setShowScript] = useState({})
  const [search, setSearch] = useState('')
  const [weekFilter, setWeekFilter] = useState('all')

  useEffect(() => {
    let active = true
    supabase
      .from('podcast_episodes')
      .select('id, episode_date, title, script, audio_url, duration_seconds, status')
      .eq('published', true)
      .lte('episode_date', TODAY_STR)
      .order('episode_date', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (active) { setEpisodes(data || []); setLoading(false) } })
    return () => { active = false }
  }, [])

  // Build the "All Weeks" dropdown options (key = Monday's ISO date)
  const weekOptions = [...new Map(
    episodes.map(ep => {
      const monday = getMonday(ep.episode_date)
      const key = monday.toISOString().slice(0, 10)
      return [key, { key, monday }]
    })
  ).values()].sort((a, b) => b.monday - a.monday)

  const filtered = episodes.filter(ep => {
    const matchSearch = !search || (ep.title || '').toLowerCase().includes(search.toLowerCase())
    const matchWeek = weekFilter === 'all' || getMonday(ep.episode_date).toISOString().slice(0, 10) === weekFilter
    return matchSearch && matchWeek
  })

  return (
    <div>
      <SEO title="A Moment a Day" description="Start your day with a word of faith, hope, and encouragement." path="/podcast" />

      <style>{`
        @media(max-width:768px){
          .amad-hero{padding-left:16px!important;padding-right:16px!important;}
        }
      `}</style>

      {/* Hero — same background treatment as Hymnal for visual consistency */}
      <div className="amad-hero" style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 32px',
        textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Daily Encouragement</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 12px' }}>
          🎙️ A Moment a Day
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 auto', maxWidth: 480, fontSize: '0.95rem' }}>
          Start your day with a word of faith, hope, and encouragement.
        </p>
      </div>

      {/* All episodes — searchable, filterable by week */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.3rem', margin: '0 0 16px' }}>
          All Episodes
        </h2>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search episodes..."
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 16px', marginBottom: 10,
            borderRadius: 10, border: '1.5px solid var(--brand-pale)', fontSize: '0.92rem',
            fontFamily: 'var(--font-body)', outline: 'none',
          }}
        />
        <select
          value={weekFilter}
          onChange={e => setWeekFilter(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 16px', marginBottom: 20,
            borderRadius: 10, border: '1.5px solid var(--brand-pale)', fontSize: '0.92rem',
            fontFamily: 'var(--font-body)', color: 'var(--text-dark, #1e293b)', background: 'white',
          }}
        >
          <option value="all">All Weeks</option>
          {weekOptions.map(({ key, monday }) => (
            <option key={key} value={key}>{weekLabel(monday)}</option>
          ))}
        </select>

        {loading && <p>Loading…</p>}

        {!loading && filtered.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center' }}>No episodes match.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(ep => {
            const isToday = ep.episode_date === TODAY_STR
            return (
              <div key={ep.id} style={{
                borderRadius: 14, padding: '16px 16px',
                background: isToday ? 'var(--brand-pale)' : 'white',
                border: isToday ? 'none' : '1px solid #e2e8f0',
                borderLeft: isToday ? '4px solid var(--brand-light)' : '1px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--brand-light)', fontWeight: 600 }}>{fmt(ep.episode_date)}</span>
                  {isToday && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', background: '#f59e0b', padding: '3px 12px', borderRadius: 20 }}>
                      NOW
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-deep)', marginBottom: 10 }}>
                  {ep.title}
                </div>

                {ep.audio_url ? (
                  <audio controls preload="none" src={ep.audio_url} style={{ width: '100%' }} />
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 8 }}>
                    {isToday ? "Today's audio is still being prepared — check back shortly." : 'Audio unavailable'}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                  <button
                    onClick={() => setShowScript(s => ({ ...s, [ep.id]: !s[ep.id] }))}
                    style={{ padding: 0, border: 'none', background: 'none', color: 'var(--brand-light)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    {showScript[ep.id] ? 'Hide script' : 'Read script'}
                  </button>
                  <ShareButtonLight
                    title={ep.title}
                    text={`🎙 " *${(ep.title || '').toUpperCase()}* "\n\nListen to " *A Moment A Day* " on CCG World:\n🌐${APP_URL}/podcast`}
                    includeLink={false}
                    label=""
                    style={{ padding: '6px 10px' }}
                  />
                </div>

                {showScript[ep.id] && (
                  <p style={{ marginTop: 12, lineHeight: 1.8, color: 'var(--text-dark, #1e293b)', whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>
                    {ep.script}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
