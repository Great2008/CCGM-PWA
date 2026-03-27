import { useState, useEffect } from 'react'
import supabase from '../../lib/supabase'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  // Unauthorized animation state
  const [denied, setDenied]       = useState(false)
  const [lockPhase, setLockPhase] = useState('locking') // 'locking' | 'locked' | 'denied'

  // Authorized unlock animation state
  const [unlocking, setUnlocking]     = useState(false)
  const [unlockPhase, setUnlockPhase] = useState('opening') // 'opening' | 'open' | 'granted'

  useEffect(() => {
    if (!denied) return
    const t1 = setTimeout(() => setLockPhase('locked'), 1400)
    const t2 = setTimeout(() => setLockPhase('denied'), 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [denied])

  useEffect(() => {
    if (!unlocking) return
    const t1 = setTimeout(() => setUnlockPhase('open'),    700)
    const t2 = setTimeout(() => setUnlockPhase('granted'), 1400)
    const t3 = setTimeout(() => onLogin(),                 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [unlocking])

  const handleSubmit = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) { setErr(error.message); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    const allowed = ['super_admin', 'admin', 'moderator']
    if (!allowed.includes(profile?.role)) {
      await supabase.auth.signOut()
      setLoading(false)
      setDenied(true)
      setLockPhase('locking')
      return
    }
    setLoading(false)
    setUnlocking(true)
    setUnlockPhase('opening')
  }

  const handleGoBack = () => {
    setDenied(false)
    setLockPhase('locking')
    setEmail('')
    setPass('')
    setErr('')
  }

  // ── Authorized unlock screen ─────────────────────────────────────
  if (unlocking) return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', padding: 32, textAlign: 'center',
      background: unlockPhase === 'granted'
        ? 'linear-gradient(135deg,#052e16,#14532d,#166534)'
        : 'linear-gradient(135deg,#0a1628,#0e2a4a,#1a3a5c)',
      transition: 'background 0.8s ease',
    }}>
      <style>{`
        @keyframes ul-shackle-open {
          0%   { transform: translateY(0) rotate(0deg); }
          60%  { transform: translateY(-18px) rotate(-22deg); }
          100% { transform: translateY(-18px) rotate(-22deg); }
        }
        @keyframes ul-lock-glow-gold {
          0%,40% { filter: drop-shadow(0 0 0px #fbbf24); }
          100%   { filter: drop-shadow(0 0 22px #fbbf24); }
        }
        @keyframes ul-check-pop {
          0%,55% { opacity: 0; transform: scale(0.3); }
          75%    { opacity: 1; transform: scale(1.2); }
          100%   { opacity: 1; transform: scale(1); }
        }
        @keyframes ul-text-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ul-ripple {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>

      {/* Gold ripple rings on granted */}
      {unlockPhase === 'granted' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {[0, 0.35, 0.7].map((delay, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 120, height: 120, borderRadius: '50%',
              border: '2px solid rgba(251,191,36,0.5)',
              animation: `ul-ripple 2s ease-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Lock SVG */}
      <div style={{
        marginBottom: 32, position: 'relative', zIndex: 1,
        animation: 'ul-lock-glow-gold 2.4s ease forwards',
      }}>
        <svg width="100" height="110" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Shackle — animates open */}
          <g style={{
            animation: unlockPhase !== 'opening' ? 'ul-shackle-open 0.7s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
            transformOrigin: '72px 52px',
          }}>
            <path d="M28 52 V36 C28 18 72 18 72 36 V52"
              stroke="#fbbf24" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
          {/* Body */}
          <rect x="12" y="48" width="76" height="56" rx="12" fill="#1d4ed8" />
          <rect x="12" y="48" width="76" height="56" rx="12" fill="url(#ulBodyGrad)" />
          {/* Keyhole (hidden behind check) */}
          <circle cx="50" cy="74" r="10" fill="#0f172a" opacity="0.7" />
          <rect x="46" y="74" width="8" height="14" rx="4" fill="#0f172a" opacity="0.7" />
          {/* Checkmark */}
          <g style={{ animation: 'ul-check-pop 2.4s ease forwards' }}>
            <circle cx="50" cy="74" r="13" fill="#22c55e" opacity="0.97" />
            <path d="M43 74 L48 79 L57 69" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
          <defs>
            <linearGradient id="ulBodyGrad" x1="12" y1="48" x2="88" y2="104" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Text phases */}
      {unlockPhase === 'opening' && (
        <div style={{ animation: 'ul-text-in 0.4s ease', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Verifying clearance…
        </div>
      )}
      {unlockPhase === 'open' && (
        <div style={{ animation: 'ul-text-in 0.4s ease', color: '#fbbf24', fontSize: '1rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          Clearance confirmed…
        </div>
      )}
      {unlockPhase === 'granted' && (
        <div style={{ animation: 'ul-text-in 0.5s ease', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem,4vw,2rem)', color: 'white', fontWeight: 900, marginBottom: 10 }}>
            ✅ Access Granted
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Welcome to CCG World Admin
          </div>
        </div>
      )}
    </div>
  )

  // ── Unauthorized screen ──────────────────────────────────────────
  if (denied) return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', padding: 32, textAlign: 'center',
      background: lockPhase === 'denied'
        ? 'linear-gradient(135deg,#450a0a,#7f1d1d,#dc2626)'
        : lockPhase === 'locked'
        ? 'linear-gradient(135deg,#0a2612,#166534,#dc2626)'
        : 'linear-gradient(135deg,#0a2612,#166534)',
      transition: 'background 0.8s ease',
    }}>
      <style>{`
        @keyframes shackle-open {
          0%   { transform: translateY(0) rotate(0deg); }
          40%  { transform: translateY(-8px) rotate(-15deg); }
          70%  { transform: translateY(-6px) rotate(-10deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes shackle-close {
          0%   { transform: translateY(-6px) rotate(-10deg); }
          60%  { transform: translateY(2px) rotate(5deg); }
          80%  { transform: translateY(-1px) rotate(-2deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes lock-shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          15%     { transform: translateX(-8px) rotate(-5deg); }
          30%     { transform: translateX(8px) rotate(5deg); }
          45%     { transform: translateX(-6px) rotate(-4deg); }
          60%     { transform: translateX(6px) rotate(4deg); }
          75%     { transform: translateX(-4px) rotate(-2deg); }
          90%     { transform: translateX(4px) rotate(2deg); }
        }
        @keyframes lock-glow-red {
          0%,100% { box-shadow: 0 0 40px 10px rgba(220,38,38,0.4), 0 0 80px 20px rgba(220,38,38,0.15); }
          50%     { box-shadow: 0 0 80px 24px rgba(220,38,38,0.7), 0 0 140px 40px rgba(220,38,38,0.3); }
        }
        @keyframes al-text-appear {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes denied-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.85; transform: scale(0.98); }
        }
        @keyframes ripple {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes btn-appear {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .al-lock-locking { animation: shackle-open 0.5s ease-in-out, shackle-close 0.6s ease-in-out 0.6s; }
        .al-lock-locked  { animation: lock-shake 0.7s ease-in-out; }
        .al-lock-denied  { animation: lock-glow-red 2s ease-in-out infinite; }
      `}</style>

      {lockPhase === 'denied' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {[0, 0.4, 0.8].map((delay, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 120, height: 120, borderRadius: '50%',
              border: '2px solid rgba(220,38,38,0.5)',
              animation: `ripple 2s ease-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      )}

      <div style={{
        width: 110, height: 110, borderRadius: 28,
        background: lockPhase === 'denied' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        border: `2px solid ${lockPhase === 'denied' ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '3.6rem', marginBottom: 36,
        transition: 'all 0.6s ease',
        position: 'relative', zIndex: 1,
      }} className={`al-lock-${lockPhase}`}>
        {lockPhase === 'locking' ? '🔓' : '🔒'}
      </div>

      {lockPhase === 'locking' && (
        <div style={{ animation: 'al-text-appear 0.3s ease', color: 'rgba(255,255,255,0.7)', fontSize: '1rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Checking clearance…
        </div>
      )}
      {lockPhase === 'locked' && (
        <div style={{ animation: 'al-text-appear 0.4s ease' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'white', fontWeight: 900, marginBottom: 8 }}>
            Access Denied
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', letterSpacing: '0.08em' }}>
            Verifying credentials…
          </div>
        </div>
      )}
      {lockPhase === 'denied' && (
        <div style={{ animation: 'al-text-appear 0.5s ease', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,4vw,2.2rem)', color: 'white', fontWeight: 900, marginBottom: 14, animation: 'denied-pulse 2.5s ease infinite' }}>
            🚫 Unauthorised Access
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.8, maxWidth: 340, marginBottom: 10 }}>
            This account does not have<br />
            <strong style={{ color: 'white' }}>admin or moderator</strong> privileges.
          </div>
          <div style={{ padding: '10px 24px', borderRadius: 10, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(220,38,38,0.4)', display: 'inline-block', fontSize: '0.78rem', color: '#fca5a5', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 32 }}>
            CLEARANCE LEVEL: INSUFFICIENT
          </div>
          <div style={{ animation: 'btn-appear 0.5s ease 0.3s both' }}>
            <button
              onClick={handleGoBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 32px', borderRadius: 40, border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}>
              ← Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Normal login form ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,var(--brand-deep) 0%,var(--brand-mid) 100%)', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '44px 40px', width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="CCG World" style={{ width: 72, height: 72, objectFit: 'contain', margin: '0 auto 16px', display: 'block', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.6rem', margin: '0 0 4px' }}>CCG World Admin</h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', margin: 0 }}>Sign in with your admin account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@ccgworld.org" required autoFocus /></div>
          <div className="form-group"><label>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required /></div>
          {err && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', marginBottom: 16 }}>❌ {err}</div>}
          <button type="submit" className="btn btn-blue" style={{ width: '100%', justifyContent: 'center', padding: '13px' }} disabled={loading}>
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
