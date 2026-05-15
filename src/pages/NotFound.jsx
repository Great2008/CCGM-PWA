import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const VERSES = [
  { text: 'For I know the plans I have for you, plans to prosper you and not to harm you, plans to give you hope and a future.', ref: 'Jeremiah 29:11' },
  { text: 'Trust in the Lord with all your heart and lean not on your own understanding.', ref: 'Proverbs 3:5' },
  { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'The Lord is my shepherd; I shall not want.', ref: 'Psalm 23:1' },
]

export default function NotFound() {
  const navigate  = useNavigate()
  const [verse]   = useState(() => VERSES[Math.floor(Math.random() * VERSES.length)])
  const [dots,    setDots]    = useState('')
  const [counter, setCounter] = useState(10)

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500)
    return () => clearInterval(t)
  }, [])

  // Countdown redirect
  useEffect(() => {
    if (counter <= 0) { navigate('/'); return }
    const t = setTimeout(() => setCounter(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [counter, navigate])

  const LINKS = [
    { to: '/',            icon: '🏠', label: 'Home'         },
    { to: '/bible',       icon: '📖', label: 'Bible'        },
    { to: '/sermons',     icon: '🎙️', label: 'Sermons'      },
    { to: '/events',      icon: '📅', label: 'Events'       },
    { to: '/prayer-wall', icon: '🙏', label: 'Prayer Wall'  },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a2612 0%, #14532d 45%, #0a2612 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>

      {/* Background glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,208,96,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,184,102,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* Logo */}
      <img src="/logo.png" alt="CCG World" style={{ width: 'clamp(72px,16vw,108px)', height: 'auto', marginBottom: 24, filter: 'drop-shadow(0 4px 20px rgba(245,208,96,0.3))' }} />

      {/* 404 number */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ fontSize: 'clamp(6rem,22vw,11rem)', fontWeight: 900, fontFamily: 'Georgia, serif', lineHeight: 1, background: 'linear-gradient(135deg, #fffde7 0%, #f5d060 35%, #d4a017 70%, #7a5000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 4px 24px rgba(212,160,23,0.35))' }}>
          404
        </div>
        {/* Subtle cross watermark inside 404 */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.06, pointerEvents: 'none' }}>
          <div style={{ width: 8, height: 80, background: 'white', margin: '0 auto' }} />
          <div style={{ width: 48, height: 8, background: 'white', marginTop: -52 }} />
        </div>
      </div>

      {/* Heading */}
      <h1 style={{ fontFamily: 'Georgia, serif', color: '#ffffff', fontSize: 'clamp(1.4rem,4vw,2.2rem)', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Page Not Found{dots}
      </h1>

      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(0.88rem,2.5vw,1rem)', maxWidth: 400, lineHeight: 1.75, margin: '0 0 32px' }}>
        The page you're looking for doesn't exist or may have been moved. But don't worry — God knows exactly where you are.
      </p>

      {/* Verse card */}
      <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,208,96,0.25)', borderRadius: 16, padding: '20px 24px', maxWidth: 480, marginBottom: 36, backdropFilter: 'blur(8px)' }}>
        <div style={{ color: 'rgba(245,208,96,0.7)', fontSize: '2rem', marginBottom: 8, lineHeight: 1 }}>"</div>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 'clamp(0.88rem,2.5vw,1rem)', lineHeight: 1.8, margin: '0 0 10px' }}>
          {verse.text}
        </p>
        <div style={{ color: '#d4a017', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          — {verse.ref}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 36 }}>
        {LINKS.map(l => (
          <Link key={l.to} to={l.to} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 30, border: '1.5px solid rgba(245,208,96,0.35)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontFamily: 'sans-serif', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(245,208,96,0.15)'; e.currentTarget.style.borderColor='rgba(245,208,96,0.7)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor='rgba(245,208,96,0.35)' }}>
            <span>{l.icon}</span> {l.label}
          </Link>
        ))}
      </div>

      {/* Go home button */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 36px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg, #f5d060, #d4a017)', color: '#0a2612', fontWeight: 800, fontSize: '1rem', fontFamily: 'sans-serif', textDecoration: 'none', boxShadow: '0 4px 24px rgba(212,160,23,0.35)', transition: 'transform 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.04)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
        🏠 Return Home
      </Link>

      {/* Countdown */}
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginTop: 20, fontFamily: 'sans-serif' }}>
        Redirecting to home in <span style={{ color: '#d4a017', fontWeight: 700 }}>{counter}s</span>
      </p>

      {/* Footer text */}
      <p style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', fontFamily: 'sans-serif' }}>
        CCG World · ccgm-pwa.vercel.app
      </p>
    </div>
  )
}
