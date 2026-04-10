import AppDownloadBanner from '../components/AppDownloadBanner'

export default function About() {
  return (
    <>
      <div style={{
        background: `linear-gradient(160deg, rgba(15,31,61,0.88) 0%, rgba(26,58,107,0.75) 100%), url('https://images.unsplash.com/photo-1507692049790-de58290a4334?w=1600&q=80') center/cover`,
        padding: 'clamp(90px,14vw,130px) 5% 80px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Our Story</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.4rem)', marginBottom: 16 }}>
          About Our Church
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 560, margin: '0 auto', lineHeight: 1.8, fontSize: '1.05rem' }}>
          Rooted in the Word, growing in grace, reaching the world.
        </p>
      </div>

      {/* Mission & Vision */}
      <section style={{ background: 'var(--white, white)', padding: '90px 5%' }}>
        <div className="container">
          <div className="about-mission-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
            <div>
              <span className="section-label">Who We Are</span>
              <h2 className="section-title">Our Mission & Vision</h2>
              <div className="section-divider" />
              <p style={{ color: 'var(--text-mid)', lineHeight: 1.85, marginBottom: 18, fontSize: '1rem' }}>
                Christian Church Of God Mission (CCGM) was founded on the belief that every person deserves to encounter the transforming love of Jesus Christ. We are a multigenerational, multicultural family of believers united by one faith and one Lord.
              </p>
              <p style={{ color: 'var(--text-mid)', lineHeight: 1.85, marginBottom: 28, fontSize: '1rem' }}>
                Our mission is simple: <strong style={{ color: 'var(--green-deep)' }}>God First</strong>. We exist to worship God with everything we have, grow every believer into the fullness of Christ, and carry the Gospel to our community and beyond.
              </p>
              <div className="about-values-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['🙏', 'Authentic Worship', 'Encountering God through Spirit-filled praise'],
                  ['📖', 'Biblical Teaching', 'Sound doctrine rooted in Scripture'],
                  ['🤝', 'Community', 'Life-giving fellowship and brotherhood'],
                  ['🌍', 'Outreach', 'Serving and reaching our city for Christ'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ background: 'var(--brand-pale)', borderRadius: 10, padding: '16px' }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-deep)', marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=700&q=80"
                alt="Church community"
                style={{ width: '100%', borderRadius: 18, boxShadow: 'var(--shadow-lg)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'linear-gradient(135deg,#0a2612,#14532d)', padding: '70px 5%' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 30, textAlign: 'center' }}>
            {[
              ['100+', 'Years of Ministry'],
              ['10000+', 'Active Members'],
              ['7', 'Weekly Services'],
              ['12+', 'Countries Reached'],
            ].map(([num, label]) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', marginTop: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AppDownloadBanner />

      {/* Call to action */}
      <section style={{ background: 'var(--cream)', padding: '90px 5%', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 640 }}>
          <span className="section-label">Join Us</span>
          <h2 className="section-title" style={{ margin: '0 auto 16px' }}>Come as You Are</h2>
          <div className="section-divider" style={{ margin: '0 auto 24px' }} />
          <p style={{ color: 'var(--text-mid)', lineHeight: 1.85, marginBottom: 36, fontSize: '1rem' }}>
            Whether you're new to faith or returning home, you are welcome here. Our doors are open every week — come and experience the love of God in community.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="btn btn-green">📍 Find Us</a>
            <a href="/sermons" className="btn btn-outline-green">🎙 Watch a Sermon</a>
          </div>
        </div>
      </section>

      <style>{`
        @media(max-width:768px){
          .about-mission-grid{grid-template-columns:1fr!important;gap:32px!important;}
          .about-values-grid{grid-template-columns:1fr!important;}
        }
      `}</style>
    </>
  )
}
