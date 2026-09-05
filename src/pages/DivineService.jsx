import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

const TILES = [
  { to: '/sabbath-school',   icon: '📚', label: 'Sabbath School',   sub: 'Weekly lessons' },
  { to: '/sermons',          icon: '📒', label: 'Sermons',          sub: 'Watch & listen' },
  { to: '/hymnal',           icon: '🎵', label: 'Hymnal',           sub: 'Songs & lyrics' },
  { to: '/bible',            icon: '📖', label: 'Bible',            sub: 'Full KJV offline' },
  { to: '/ten-commandments', icon: '📜', label: 'Ten Commandments', sub: 'Exodus 20, KJV' },
]

export default function DivineService() {
  return (
    <div>
      <SEO title="Divine Service" description="Sabbath School, Sermons, Hymnal, Bible, and the Ten Commandments — all in one place." path="/divine-service" />

      <style>{`
        @media(max-width:768px){
          .ds-hero{padding-left:16px!important;padding-right:16px!important;}
        }
      `}</style>

      {/* Hero — same background treatment as Hymnal for visual consistency */}
      <div className="ds-hero" style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 32px',
        textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Worship & Study</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 12px' }}>
          🛐 Divine Service
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 auto', maxWidth: 480, fontSize: '0.95rem' }}>
          Everything for worship, together in one place.
        </p>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 18 }}>
          {TILES.map(t => (
            <Link key={t.to} to={t.to} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white', borderRadius: 16, padding: '24px 20px', textAlign: 'center',
                borderTop: '4px solid var(--brand-light)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.2s', height: '100%',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>{t.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-deep)', marginBottom: 4 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
