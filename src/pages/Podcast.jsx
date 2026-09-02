import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import ShareButton from '../components/ShareButton'
import SEO from '../components/SEO'
import { APP_URL } from '../lib/config'

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
      .lte('episode_date', new Date().toISOString().slice(0, 10))
      .order('episode_date', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (active) { setEpisodes(data || []); setLoading(false) } })
    return () => { active = false }
  }, [])

  const today = episodes[0]
  const past = episodes.slice(1)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>
      <SEO title="Daily Podcast" description="A short daily scripted podcast — 1 to 5 minutes." path="/podcast" />

      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.7rem', margin: '0 0 4px' }}>
        🎙 Daily Podcast
      </h1>
      <p style={{ color: 'var(--text-light, #64748b)', margin: '0 0 24px', fontSize: '0.92rem' }}>
        A short scripted word for your day — 1 to 5 minutes.
      </p>

      {loading && <p>Loading…</p>}

      {!loading && !today && (
        <p style={{ color: '#64748b' }}>No episodes yet — check back soon.</p>
      )}

      {today && (
        <div style={{ background: 'var(--brand-pale)', borderRadius: 16, padding: '20px 18px', marginBottom: 28 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {fmt(today.episode_date)}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.3rem', margin: '4px 0 12px' }}>
            {today.title}
          </h2>

          {today.audio_url ? (
            <>
              <audio controls preload="metadata" src={today.audio_url} style={{ width: '100%' }} />
              {today.duration_seconds && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6 }}>
                  ~{Math.round(today.duration_seconds / 60)} min
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#92400e', background: '#fef3c7', padding: '10px 14px', borderRadius: 8 }}>
              Today's audio is still being prepared — check back shortly.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowScript(s => ({ ...s, [today.id]: !s[today.id] }))}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--brand-light)', background: 'white', color: 'var(--brand-deep)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {showScript[today.id] ? 'Hide script' : 'Read script'}
            </button>
            <ShareButton title={today.title} url={`${APP_URL}/podcast`} />
          </div>

          {showScript[today.id] && (
            <p style={{ marginTop: 14, lineHeight: 1.8, color: 'var(--text-dark, #1e293b)', whiteSpace: 'pre-wrap' }}>
              {today.script}
            </p>
          )}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.05rem', margin: '0 0 12px' }}>
            Past Episodes
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {past.map(ep => (
              <div key={ep.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fmt(ep.episode_date)}</div>
                <div style={{ fontWeight: 700, margin: '2px 0 8px' }}>{ep.title}</div>
                {ep.audio_url ? (
                  <audio controls preload="none" src={ep.audio_url} style={{ width: '100%', height: 34 }} />
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Audio unavailable</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
