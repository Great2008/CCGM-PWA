import { useEffect, useRef } from 'react'

const APK_URL = 'https://gxetxqlzuipiymdmibpt.supabase.co/storage/v1/object/public/apk/CCGWorld-latest.apk'

function QRCanvas({ url, size = 140 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')

    // Load QR via Google Charts API (reliable, no package needed)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(url)}&color=0a2612&bgcolor=ffffff&margin=2`
    img.onload = () => {
      canvas.width  = size
      canvas.height = size
      ctx.drawImage(img, 0, 0, size, size)
    }
  }, [url, size])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ borderRadius: 10, display: 'block' }}
    />
  )
}

export default function AppDownloadBanner({ compact = false }) {
  if (compact) {
    // Navbar / tight spaces — just a small button
    return (
      <a
        href={APK_URL}
        download="CCGWorld-latest.apk"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 16px', borderRadius: 10,
          background: 'linear-gradient(135deg,#14532d,#166534)',
          color: 'white', textDecoration: 'none',
          fontWeight: 700, fontSize: '0.82rem',
          fontFamily: 'var(--font-body)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '1rem' }}>📱</span>
        Download App
      </a>
    )
  }

  return (
    <section style={{
      background: 'linear-gradient(135deg, #0a2612 0%, #14532d 60%, #1a4a1a 100%)',
      padding: 'clamp(50px,7vw,80px) 5%',
    }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 'clamp(30px,5vw,60px)',
          alignItems: 'center',
        }} className="app-download-grid">

          {/* QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <QRCanvas url={APK_URL} size={140} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'center', letterSpacing: '0.06em' }}>
              SCAN TO DOWNLOAD
            </span>
          </div>

          {/* Text + Button */}
          <div>
            <span style={{
              display: 'inline-block', background: 'var(--gold)',
              color: '#0a2612', fontSize: '0.7rem', fontWeight: 900,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: 20, marginBottom: 14,
            }}>
              Android App
            </span>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              color: 'white',
              fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
              marginBottom: 12, lineHeight: 1.2,
            }}>
              Take CCG World <span style={{ color: 'var(--gold)' }}>Everywhere</span>
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.72)', lineHeight: 1.75,
              fontSize: '0.95rem', marginBottom: 28, maxWidth: 420,
            }}>
              Get the full CCG World experience on your Android phone — sermons, live services, Sabbath School, devotionals and more. Always with you, even when offline.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={APK_URL}
                download="CCGWorld-latest.apk"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: 'var(--gold)', color: '#0a2612',
                  padding: '13px 26px', borderRadius: 12,
                  fontWeight: 900, fontSize: '0.95rem',
                  textDecoration: 'none', fontFamily: 'var(--font-body)',
                  boxShadow: '0 4px 16px rgba(245,166,35,0.35)',
                  transition: 'transform 0.18s, box-shadow 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(245,166,35,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,166,35,0.35)' }}
              >
                <span style={{ fontSize: '1.2rem' }}>📥</span>
                Download APK
              </a>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                Free · Android 7+
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width: 600px) {
          .app-download-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .app-download-grid > div:first-child {
            justify-self: center;
          }
          .app-download-grid > div:last-child > div {
            justify-content: center !important;
          }
        }
      `}</style>
    </section>
  )
}
