import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import ShareButton from '../components/ShareButton'
import SEO from '../components/SEO'
import { APP_URL } from '../lib/config'

const TODAY_STR = new Date().toISOString().slice(0, 10)

function fmt(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

export default function Podcast() {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScript, setShowScript] = useState({})

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

      {/* All episodes — one clean list, most recent first */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 60px' }}>
        {loading && <p>Loading…</p>}

        {!loading && episodes.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center' }}>No episodes yet — check back soon.</p>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {episodes.map(ep => {
            const isToday = ep.episode_date === TODAY_STR
            return (
              <div key={ep.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{fmt(ep.episode_date)}</span>
                  {isToday && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--brand-deep)', background: 'var(--brand-pale)', padding: '2px 8px', borderRadius: 20 }}>
                      TODAY
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
                  <ShareButton title={`${ep.title} — A Moment a Day`} url={`${APP_URL}/podcast`} variant="icon-only" />
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
