import { useEffect, useState } from 'react'

/**
 * AppSplash — full-screen splash shown on every launch.
 * Matches the native Android splash exactly:
 *   - Green radial gradient (bright centre → pale white-green edges)
 *   - Logo centred in upper half
 *   - "CCG World" bold text below
 *   - "Christian Church Of God Mission" subtitle
 * Fades out after SHOW_DURATION ms.
 */

const SHOW_DURATION = 2500  // ms before fade starts
const FADE_DURATION = 600   // ms for fade out

export default function AppSplash({ onDone }) {
  const [phase, setPhase] = useState('visible') // visible | fading | done

  useEffect(() => {
    const showTimer = setTimeout(() => setPhase('fading'), SHOW_DURATION)
    const doneTimer = setTimeout(() => {
      setPhase('done')
      onDone?.()
    }, SHOW_DURATION + FADE_DURATION)

    return () => { clearTimeout(showTimer); clearTimeout(doneTimer) }
  }, [onDone])

  if (phase === 'done') return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // Radial gradient matching native splash
      background: 'radial-gradient(ellipse 120% 80% at 50% 18%, #00b250 0%, #48c878 45%, #dcf5e6 100%)',
      opacity: phase === 'fading' ? 0 : 1,
      transition: `opacity ${FADE_DURATION}ms ease`,
      userSelect: 'none',
      paddingBottom: '18%',
    }}>
      {/* Logo */}
      <img
        src="/logo.png"
        alt="CCG World"
        style={{
          width: 'clamp(160px, 48vw, 260px)',
          height: 'auto',
          objectFit: 'contain',
          marginBottom: 28,
          filter: 'drop-shadow(0 4px 16px rgba(0,80,20,0.18))',
        }}
      />

      {/* CCG World */}
      <div style={{
        fontFamily: 'Georgia, "Playfair Display", serif',
        fontWeight: 900,
        fontSize: 'clamp(2rem, 10vw, 3rem)',
        color: '#053a14',
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
        textAlign: 'center',
      }}>
        CCG World
      </div>

      {/* Subtitle */}
      <div style={{
        fontFamily: 'Georgia, "Playfair Display", serif',
        fontWeight: 400,
        fontSize: 'clamp(0.82rem, 3.8vw, 1rem)',
        color: '#0a6e28',
        marginTop: 10,
        textAlign: 'center',
        letterSpacing: '0.01em',
      }}>
        Christian Church Of God Mission
      </div>
    </div>
  )
}
