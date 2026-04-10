import SEO from '../components/SEO'

export default function FindChurch() {
  return (
    <>
      <SEO
        title="Find a Church"
        description="Find a CCG World church branch near you. Locate Christian Church Of God Mission branches worldwide."
        path="/find-church"
      />
      <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 66 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)',
        padding: 'clamp(40px,8vw,80px) 5% 44px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(37,99,235,0.2) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>
          <span className="section-label">Worship With Us</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: 'white', margin: '6px 0 12px', lineHeight: 1.2 }}>
            ⛪ Find a CCGM Branch
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 520, fontSize: '0.95rem', lineHeight: 1.7 }}>
            Christian Church Of God Mission has branches across multiple locations. Find the one closest to you and join us for worship.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: 30, fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              📅 Sabbath Services: Saturday
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.2)', padding: '8px 16px', borderRadius: 30, fontSize: '0.8rem', color: '#fcd34d', fontWeight: 600, border: '1px solid rgba(245,158,11,0.3)' }}>
              🕘 Sabbath School: 9:00 AM
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.2)', padding: '8px 16px', borderRadius: 30, fontSize: '0.8rem', color: '#fcd34d', fontWeight: 600, border: '1px solid rgba(245,158,11,0.3)' }}>
              ✝️ Divine Service: 11:00 AM
            </div>
          </div>
        </div>
      </div>

      {/* Map + Info */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 5% 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }} className="finder-grid">

          {/* Map embed */}
          <div style={{
            borderRadius: 18, overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            border: '1.5px solid #e2e8f0',
            background: 'var(--brand-pale)',
          }}>
            <iframe
              src="https://www.google.com/maps/d/u/1/embed?mid=1tWza1b6vxcVuFD40QnrYNpY66a0qb0E&ehbc=2E312F&noprof=1"
              width="100%"
              height="520"
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
              loading="lazy"
              title="CCGM Branch Locations"
            />
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* How to use */}
            <div style={{ background: 'var(--white, white)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e2e8f0' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '0.95rem', marginBottom: 12 }}>
                🗺️ Using the Map
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: '📍', text: 'Click any pin to see branch details' },
                  { icon: '🔍', text: 'Use the search box inside the map to find your area' },
                  { icon: '↗️', text: 'Click the expand icon for full-screen view' },
                  { icon: '🗺️', text: 'Click "Get Directions" on a pin for navigation' },
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service times */}
            <div style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))', borderRadius: 14, padding: '18px 20px', color: 'white' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', marginBottom: 14 }}>
                🕐 Service Times
              </div>
              {[
                { day: 'Sabbath School', time: '9:00 AM', icon: '📖' },
                { day: 'Divine Service', time: '11:00 AM', icon: '✝️' },
                { day: 'Evening Service', time: '6:00 PM', icon: '🌙' },
                { day: 'Prayer Meeting', time: 'Wednesday 6PM', icon: '🙏' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{s.icon}</span>
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>{s.day}</span>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)' }}>{s.time}</span>
                </div>
              ))}
            </div>

            {/* Contact CTA */}
            <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '18px 20px', border: '1.5px solid #bbf7d0' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#166534', fontSize: '0.95rem', marginBottom: 8 }}>
                🤝 New Here?
              </div>
              <p style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.6, marginBottom: 14 }}>
                We'd love to welcome you! Reach out to us before your first visit.
              </p>
              <a href="/contact" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 30, background: '#16a34a',
                color: 'white', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
                fontFamily: 'var(--font-body)', transition: 'opacity 0.2s',
              }}>
                📧 Contact Us
              </a>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:860px) {
          .finder-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </>
  )
}
