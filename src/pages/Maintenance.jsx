/**
 * Maintenance.jsx — CCG World Maintenance Page
 *
 * Shown automatically (by App.jsx) whenever an admin turns on
 * Maintenance Mode from /admin → Maintenance Mode. No navbar/footer are
 * rendered around it. The /admin panel is a separate app (see main.jsx)
 * so it is never affected by this page and always stays reachable to
 * turn maintenance back off.
 */
import { useEffect, useState } from 'react'
import SEO from '../components/SEO'

function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    if (!target) { setTimeLeft(null); return }
    const calc = () => {
      const diff = target - Date.now()
      if (diff <= 0) return setTimeLeft({ d: 0, h: 0, m: 0, s: 0 })
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000)  / 60000),
        s: Math.floor((diff % 60000)    / 1000),
      })
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [target])

  return timeLeft
}

const UPDATES = [
  { icon: '⚡', text: 'Improving app performance' },
  { icon: '🔒', text: 'Security enhancements' },
  { icon: '✨', text: 'New features being deployed' },
  { icon: '📖', text: 'Bible & content updates' },
]

const DEFAULT_MESSAGE = "CCG World is currently down for scheduled maintenance. We'll be back in just a moment"

export default function Maintenance({ message, eta }) {
  const target = eta ? new Date(eta) : null
  const validTarget = target && !isNaN(target.getTime()) ? target : null
  const countdown = useCountdown(validTarget)

  const [dots, setDots]     = useState(1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setDots(d => d === 3 ? 1 : d + 1), 600)
    return () => clearInterval(t)
  }, [])

  const bodyMessage = (message || '').trim() || DEFAULT_MESSAGE

  return (
    <>
      <SEO
        title="CCG World — Under Maintenance"
        description="CCG World is currently undergoing maintenance. We'll be back shortly."
        path="/"
      />

      <div style={{
        minHeight: '100vh',
        background: '#00b250',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, serif',
      }}>

        {/* Animated background rings */}
        {[1,2,3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            borderRadius: '50%',
            border: `${4-i}px solid rgba(255,255,255,${0.06 * i})`,
            width:  `${i * 38}vw`,
            height: `${i * 38}vw`,
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            animation: `pulse-ring ${2 + i * 0.8}s ease-in-out infinite alternate`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Gold top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #f59e0b, #fcd34d, #f59e0b)',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 0, maxWidth: 520, width: '100%',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>

          {/* Logo */}
          <img
            src="/logo.png"
            alt="CCG World"
            style={{
              width: 'clamp(90px,22vw,130px)',
              height: 'auto',
              marginBottom: 24,
              filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.25))',
            }}
          />

          {/* Gear / wrench icon */}
          <div style={{
            fontSize: 'clamp(2.8rem,10vw,4rem)',
            marginBottom: 16,
            animation: 'spin-slow 6s linear infinite',
            display: 'inline-block',
          }}>
            ⚙️
          </div>

          {/* Heading */}
          <h1 style={{
            color: '#ffffff',
            fontSize: 'clamp(1.6rem,6vw,2.6rem)',
            fontWeight: 900,
            textAlign: 'center',
            margin: '0 0 10px',
            letterSpacing: '-0.02em',
            textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>
            Under Maintenance
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 'clamp(0.9rem,3vw,1.05rem)',
            textAlign: 'center',
            margin: '0 0 36px',
            lineHeight: 1.75,
          }}>
            {bodyMessage}{'.'.repeat(dots)}
          </p>

          {/* Countdown — only shown when an admin has set an expected back-online time */}
          {countdown && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'clamp(8px,2vw,16px)',
              width: '100%',
              marginBottom: 36,
            }}>
              {[
                { val: countdown.d, label: 'Days' },
                { val: countdown.h, label: 'Hours' },
                { val: countdown.m, label: 'Mins' },
                { val: countdown.s, label: 'Secs' },
              ].map(({ val, label }) => (
                <div key={label} style={{
                  background: 'rgba(0,0,0,0.18)',
                  borderRadius: 16,
                  padding: 'clamp(12px,3vw,20px) 8px',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <div style={{
                    color: '#fcd34d',
                    fontSize: 'clamp(1.6rem,6vw,2.8rem)',
                    fontWeight: 900,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {String(val ?? 0).padStart(2, '0')}
                  </div>
                  <div style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 'clamp(0.62rem,2vw,0.75rem)',
                    fontWeight: 600,
                    marginTop: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontFamily: 'Arial, sans-serif',
                  }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* What we're working on */}
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 16,
            padding: '20px 24px',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.12)',
            marginBottom: 32,
          }}>
            <div style={{
              color: '#fcd34d',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 14,
              fontFamily: 'Arial, sans-serif',
            }}>
              What we're working on
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPDATES.map(({ icon, text }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: 'clamp(0.82rem,2.8vw,0.92rem)',
                  fontFamily: 'Arial, sans-serif',
                  animation: `fade-in 0.4s ease ${i * 0.12}s both`,
                }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Bible verse */}
          <div style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '18px 22px',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.15)',
            textAlign: 'center',
            marginBottom: 28,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>"</div>
            <p style={{
              color: 'rgba(255,255,255,0.9)',
              fontStyle: 'italic',
              fontSize: 'clamp(0.82rem,2.8vw,0.95rem)',
              lineHeight: 1.8,
              margin: '0 0 10px',
            }}>
              For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.
            </p>
            <div style={{
              color: '#fcd34d',
              fontSize: '0.78rem',
              fontWeight: 700,
              fontFamily: 'Arial, sans-serif',
            }}>
              — Jeremiah 29:11
            </div>
          </div>

          {/* Contact note */}
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.78rem',
            textAlign: 'center',
            lineHeight: 1.7,
            fontFamily: 'Arial, sans-serif',
          }}>
            For urgent enquiries contact us at{' '}
            <a href="mailto: ccgmworldwide@gmail.com" style={{ color: '#fcd34d', textDecoration: 'none' }}>
              ccgmworldwide@gmail.com
            </a>
          </p>
        </div>

        {/* Gold bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #f59e0b, #fcd34d, #f59e0b)',
        }} />

        {/* Keyframe styles */}
        <style>{`
          @keyframes pulse-ring {
            from { opacity: 0.4; transform: translate(-50%,-50%) scale(0.96); }
            to   { opacity: 1;   transform: translate(-50%,-50%) scale(1.04); }
          }
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateX(-8px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    </>
  )
}
