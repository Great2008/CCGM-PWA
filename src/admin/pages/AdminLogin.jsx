import { useState, useEffect } from 'react'
import supabase from '../../lib/supabase'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  // Unauthorized animation state
  // phases: 'locking' → 'locked' → 'scanning' → 'denied'
  const [denied, setDenied]       = useState(false)
  const [lockPhase, setLockPhase] = useState('locking')

  // Authorized unlock animation state
  // phases: 'opening' → 'scanning' → 'open' → 'verifying' → 'granted' → (onLogin)
  const [unlocking, setUnlocking]     = useState(false)
  const [unlockPhase, setUnlockPhase] = useState('opening')

  useEffect(() => {
    if (!denied) return
    const t1 = setTimeout(() => setLockPhase('locked'),   2000)   // shackle slams shut
    const t2 = setTimeout(() => setLockPhase('scanning'), 4500)   // scanning identity…
    const t3 = setTimeout(() => setLockPhase('denied'),   8500)   // ACCESS DENIED
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [denied])

  useEffect(() => {
    if (!unlocking) return
    const t1 = setTimeout(() => setUnlockPhase('scanning'),  1500)   // scanning biometrics…
    const t2 = setTimeout(() => setUnlockPhase('open'),      5000)   // shackle swings open
    const t3 = setTimeout(() => setUnlockPhase('verifying'), 7500)   // verifying clearance…
    const t4 = setTimeout(() => setUnlockPhase('granted'),  10000)   // ACCESS GRANTED
    const t5 = setTimeout(() => onLogin(),                  13000)   // enter dashboard
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5) }
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

  // ── Shared keyframes ─────────────────────────────────────────────
  const sharedStyles = `
    @keyframes text-in    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fade-in    { from { opacity:0; } to { opacity:1; } }
    @keyframes scan-bar   { 0% { top:0%; opacity:0.9; } 100% { top:100%; opacity:0.4; } }
    @keyframes scan-bar-h { 0% { left:0%; opacity:0.9; } 100% { left:100%; opacity:0.4; } }
    @keyframes ripple-out { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(4); opacity:0; } }
    @keyframes pulse-slow { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.82; transform:scale(0.98); } }
    @keyframes flicker    { 0%,96%,100% { opacity:1; } 97% { opacity:0.4; } 98% { opacity:1; } 99% { opacity:0.6; } }
    @keyframes blink-dot  { 0%,100% { opacity:1; } 50% { opacity:0; } }
    @keyframes progress   { from { width:0%; } to { width:100%; } }
    @keyframes shake      { 0%,100%{transform:translateX(0) rotate(0);} 15%{transform:translateX(-9px) rotate(-5deg);} 30%{transform:translateX(9px) rotate(5deg);} 45%{transform:translateX(-7px) rotate(-4deg);} 60%{transform:translateX(7px) rotate(4deg);} 75%{transform:translateX(-4px) rotate(-2deg);} 90%{transform:translateX(4px) rotate(2deg);} }
    @keyframes glow-red   { 0%,100%{box-shadow:0 0 30px 8px rgba(220,38,38,0.35),0 0 60px 16px rgba(220,38,38,0.12);} 50%{box-shadow:0 0 70px 22px rgba(220,38,38,0.65),0 0 120px 36px rgba(220,38,38,0.28);} }
    @keyframes glow-gold  { 0%{filter:drop-shadow(0 0 0px #fbbf24);} 100%{filter:drop-shadow(0 0 28px #fbbf24) drop-shadow(0 0 8px #f59e0b);} }
    @keyframes shackle-open { 0%{transform:translateY(0) rotate(0deg);} 100%{transform:translateY(-20px) rotate(-24deg);} }
    @keyframes shackle-bounce { 0%{transform:translateY(0) rotate(0deg);} 40%{transform:translateY(-9px) rotate(-16deg);} 70%{transform:translateY(-7px) rotate(-11deg);} 100%{transform:translateY(0) rotate(0deg);} }
    @keyframes check-pop  { 0%,60%{opacity:0;transform:scale(0.2);} 78%{opacity:1;transform:scale(1.25);} 100%{opacity:1;transform:scale(1);} }
    @keyframes btn-up     { from{opacity:0;transform:translateY(22px);} to{opacity:1;transform:translateY(0);} }
    @keyframes spin       { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
    @keyframes badge-in   { from{opacity:0;transform:scale(0.7) translateY(8px);} to{opacity:1;transform:scale(1) translateY(0);} }
  `

  // ── Authorized unlock screen ─────────────────────────────────────
  if (unlocking) {
    const isOpen     = ['open','verifying','granted'].includes(unlockPhase)
    const isGranted  = unlockPhase === 'granted'
    const isVerify   = unlockPhase === 'verifying'
    const isScanning = unlockPhase === 'scanning'

    return (
      <div style={{
        position:'fixed', inset:0, zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column', padding:32, textAlign:'center',
        background: isGranted
          ? 'linear-gradient(135deg,#052e16 0%,#14532d 50%,#166534 100%)'
          : 'linear-gradient(135deg,#060d1a 0%,#0a1f3d 50%,#0e2a4a 100%)',
        transition:'background 1.8s ease',
        overflow:'hidden',
      }}>
        <style>{sharedStyles}</style>

        {/* Scanning bar — vertical sweep */}
        {isScanning && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
            <div style={{
              position:'absolute', left:0, right:0, height:3,
              background:'linear-gradient(90deg,transparent,rgba(251,191,36,0.7),transparent)',
              animation:'scan-bar 2.2s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Gold ripple rings — granted */}
        {isGranted && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            {[0, 0.5, 1.0, 1.5].map((delay, i) => (
              <div key={i} style={{
                position:'absolute', width:100, height:100, borderRadius:'50%',
                border:'2px solid rgba(251,191,36,0.45)',
                animation:`ripple-out 3s ease-out ${delay}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Corner grid lines — scanning phase */}
        {(isScanning || unlockPhase === 'opening') && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.12 }}>
            {[...Array(8)].map((_,i) => (
              <div key={i} style={{ position:'absolute', left:0, right:0, top:`${i*14}%`, height:'1px', background:'rgba(251,191,36,0.6)' }} />
            ))}
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ position:'absolute', top:0, bottom:0, left:`${i*20}%`, width:'1px', background:'rgba(251,191,36,0.6)' }} />
            ))}
          </div>
        )}

        {/* Lock SVG */}
        <div style={{
          marginBottom:32, position:'relative', zIndex:1,
          animation: isOpen ? 'glow-gold 1.5s ease forwards' : 'none',
        }}>
          <svg width="110" height="120" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g style={{
              animation: isOpen ? 'shackle-open 1.2s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
              transformOrigin:'72px 52px',
            }}>
              <path d="M28 52 V36 C28 18 72 18 72 36 V52"
                stroke={isOpen ? '#fbbf24' : 'rgba(251,191,36,0.5)'} strokeWidth="9" strokeLinecap="round" fill="none" />
            </g>
            <rect x="12" y="48" width="76" height="56" rx="12" fill="url(#ulGrad)" />
            <rect x="12" y="48" width="76" height="56" rx="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="50" cy="74" r="10" fill="#0f172a" opacity="0.75" />
            <rect x="46" y="74" width="8" height="14" rx="4" fill="#0f172a" opacity="0.75" />
            {/* Check — appears at granted */}
            {isGranted && (
              <g style={{ animation:'check-pop 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <circle cx="50" cy="74" r="14" fill="#22c55e" />
                <path d="M42 74 L47.5 79.5 L58 68" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>
            )}
            {/* Scan dot on keyhole */}
            {isScanning && (
              <circle cx="50" cy="74" r="5" fill="#fbbf24" style={{ animation:'blink-dot 0.9s ease infinite' }} />
            )}
            <defs>
              <linearGradient id="ulGrad" x1="12" y1="48" x2="88" y2="104" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1e40af" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Progress bar */}
        {!isGranted && (
          <div style={{ width:260, height:3, background:'rgba(255,255,255,0.1)', borderRadius:4, marginBottom:24, overflow:'hidden', position:'relative', zIndex:1 }}>
            <div style={{
              height:'100%', borderRadius:4,
              background:'linear-gradient(90deg,#fbbf24,#f59e0b)',
              animation:`progress ${
                unlockPhase==='opening' ? '1.5s' :
                unlockPhase==='scanning' ? '3.5s' :
                unlockPhase==='open' ? '2.5s' : '3s'
              } ease forwards`,
            }} />
          </div>
        )}

        {/* Text phases */}
        <div key={unlockPhase} style={{ animation:'text-in 0.5s ease', position:'relative', zIndex:1 }}>
          {unlockPhase === 'opening' && (
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.9rem', letterSpacing:'0.2em', textTransform:'uppercase' }}>
              Initialising secure connection
              <span style={{ animation:'blink-dot 0.8s ease infinite', display:'inline-block', marginLeft:4 }}>▮</span>
            </div>
          )}
          {unlockPhase === 'scanning' && (
            <div>
              <div style={{ color:'#fbbf24', fontSize:'0.95rem', letterSpacing:'0.2em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>
                🔍 Scanning credentials
              </div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.75rem', fontFamily:'monospace', letterSpacing:'0.12em' }}>
                BIOMETRIC VERIFICATION IN PROGRESS
              </div>
            </div>
          )}
          {unlockPhase === 'open' && (
            <div>
              <div style={{ color:'#86efac', fontSize:'1rem', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700, marginBottom:6 }}>
                ✓ Lock disengaged
              </div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.75rem', fontFamily:'monospace', letterSpacing:'0.1em' }}>
                RUNNING PERMISSION CHECKS…
              </div>
            </div>
          )}
          {unlockPhase === 'verifying' && (
            <div>
              <div style={{ color:'#fbbf24', fontSize:'1rem', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>
                ⚡ Verifying clearance level
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:4 }}>
                {['IDENTITY','ROLE','SCOPE'].map((label,i) => (
                  <div key={label} style={{
                    padding:'3px 10px', borderRadius:20, fontSize:'0.65rem', fontFamily:'monospace',
                    letterSpacing:'0.1em', fontWeight:700,
                    background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.4)',
                    color:'#86efac',
                    animation:`fade-in 0.4s ease ${i*0.4}s both`,
                  }}>✓ {label}</div>
                ))}
              </div>
            </div>
          )}
          {unlockPhase === 'granted' && (
            <div>
              <div style={{
                fontFamily:'var(--font-display)', fontSize:'clamp(1.6rem,4vw,2.2rem)',
                color:'white', fontWeight:900, marginBottom:10,
                animation:'flicker 1.5s ease 0.2s both',
              }}>
                ✅ Access Granted
              </div>
              <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.8rem', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:20 }}>
                Welcome to CCG World Admin
              </div>
              <div style={{
                display:'inline-block', padding:'6px 18px', borderRadius:8,
                background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.35)',
                color:'#86efac', fontSize:'0.7rem', fontFamily:'monospace', letterSpacing:'0.14em',
                animation:'badge-in 0.6s ease 0.5s both',
              }}>
                CLEARANCE LEVEL: AUTHORISED
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Unauthorized screen ──────────────────────────────────────────
  if (denied) {
    const isScanning = lockPhase === 'scanning'
    const isDenied   = lockPhase === 'denied'

    return (
      <div style={{
        position:'fixed', inset:0, zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column', padding:32, textAlign:'center',
        background: isDenied
          ? 'linear-gradient(135deg,#3b0000 0%,#7f1d1d 50%,#991b1b 100%)'
          : lockPhase === 'locked'
          ? 'linear-gradient(135deg,#060d1a,#0a1f3d,#1a0000)'
          : 'linear-gradient(135deg,#060d1a,#0a1f3d)',
        transition:'background 1.8s ease',
        overflow:'hidden',
      }}>
        <style>{sharedStyles}</style>

        {/* Scan bar — scanning phase */}
        {isScanning && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
            <div style={{
              position:'absolute', left:0, right:0, height:3,
              background:'linear-gradient(90deg,transparent,rgba(220,38,38,0.8),transparent)',
              animation:'scan-bar 1.8s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Red ripples — denied */}
        {isDenied && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            {[0, 0.5, 1.0, 1.5].map((delay, i) => (
              <div key={i} style={{
                position:'absolute', width:100, height:100, borderRadius:'50%',
                border:'2px solid rgba(220,38,38,0.5)',
                animation:`ripple-out 3s ease-out ${delay}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Grid lines — scanning */}
        {isScanning && (
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0.1 }}>
            {[...Array(8)].map((_,i) => (
              <div key={i} style={{ position:'absolute', left:0, right:0, top:`${i*14}%`, height:'1px', background:'rgba(220,38,38,0.8)' }} />
            ))}
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ position:'absolute', top:0, bottom:0, left:`${i*20}%`, width:'1px', background:'rgba(220,38,38,0.8)' }} />
            ))}
          </div>
        )}

        {/* Lock icon */}
        <div style={{
          width:110, height:110, borderRadius:28,
          background: isDenied ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.07)',
          backdropFilter:'blur(12px)',
          border:`2px solid ${isDenied ? 'rgba(220,38,38,0.6)' : isScanning ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.15)'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'3.6rem', marginBottom:32,
          transition:'all 0.8s ease',
          position:'relative', zIndex:1,
          animation: isDenied ? 'glow-red 2.5s ease-in-out infinite' : lockPhase === 'locked' ? 'shake 0.7s ease-in-out' : 'none',
        }}>
          {lockPhase === 'locking' ? '🔓' : '🔒'}
        </div>

        {/* Progress bar */}
        {!isDenied && (
          <div style={{ width:260, height:3, background:'rgba(255,255,255,0.08)', borderRadius:4, marginBottom:24, overflow:'hidden', position:'relative', zIndex:1 }}>
            <div style={{
              height:'100%', borderRadius:4,
              background:'linear-gradient(90deg,#dc2626,#ef4444)',
              animation:`progress ${lockPhase === 'locking' ? '2s' : '4s'} ease forwards`,
            }} />
          </div>
        )}

        {/* Text phases */}
        <div key={lockPhase} style={{ animation:'text-in 0.5s ease', position:'relative', zIndex:1 }}>
          {lockPhase === 'locking' && (
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.9rem', letterSpacing:'0.2em', textTransform:'uppercase' }}>
              Checking clearance
              <span style={{ animation:'blink-dot 0.8s ease infinite', display:'inline-block', marginLeft:4 }}>▮</span>
            </div>
          )}
          {lockPhase === 'locked' && (
            <div>
              <div style={{ color:'#fca5a5', fontSize:'0.95rem', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>
                ⛔ Credentials rejected
              </div>
              <div style={{ color:'rgba(255,255,255,0.35)', fontSize:'0.75rem', fontFamily:'monospace', letterSpacing:'0.12em' }}>
                RUNNING SECURITY SCAN…
              </div>
            </div>
          )}
          {lockPhase === 'scanning' && (
            <div>
              <div style={{ color:'#fca5a5', fontSize:'1rem', letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>
                🔍 Scanning identity
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:4 }}>
                {['IDENTITY','ROLE','CLEARANCE'].map((label,i) => (
                  <div key={label} style={{
                    padding:'3px 10px', borderRadius:20, fontSize:'0.65rem', fontFamily:'monospace',
                    letterSpacing:'0.1em', fontWeight:700,
                    background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.4)',
                    color:'#fca5a5',
                    animation:`fade-in 0.4s ease ${i*0.5}s both`,
                  }}>✗ {label}</div>
                ))}
              </div>
            </div>
          )}
          {lockPhase === 'denied' && (
            <div>
              <div style={{
                fontFamily:'var(--font-display)', fontSize:'clamp(1.6rem,4vw,2.2rem)',
                color:'white', fontWeight:900, marginBottom:14,
                animation:'pulse-slow 2.5s ease infinite',
              }}>
                🚫 Unauthorised Access
              </div>
              <div style={{ color:'rgba(255,255,255,0.72)', fontSize:'0.95rem', lineHeight:1.9, maxWidth:340, marginBottom:12 }}>
                This account does not have<br />
                <strong style={{ color:'white' }}>admin or moderator</strong> privileges.
              </div>
              <div style={{
                padding:'8px 22px', borderRadius:10,
                background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)',
                border:'1px solid rgba(220,38,38,0.45)',
                display:'inline-block', fontSize:'0.72rem', color:'#fca5a5',
                fontFamily:'monospace', letterSpacing:'0.12em', marginBottom:32,
                animation:'flicker 3s ease 0.5s infinite',
              }}>
                CLEARANCE LEVEL: INSUFFICIENT
              </div>
              <div style={{ animation:'btn-up 0.5s ease 0.5s both' }}>
                <button
                  onClick={handleGoBack}
                  style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'13px 32px', borderRadius:40, border:'2px solid rgba(255,255,255,0.28)', background:'rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', color:'white', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.2s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.5)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.28)' }}>
                  ← Go Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Normal login form ────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,var(--brand-deep) 0%,var(--brand-mid) 100%)', padding:20 }}>
      <div style={{ background:'white', borderRadius:20, padding:'44px 40px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <picture><source srcSet="/logo.webp" type="image/webp" /><img src="/logo.webp" alt="CCG World" width={72} height={72} style={{ width:72, height:72, objectFit:'contain', margin:'0 auto 16px', display:'block', filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} /></picture>
          <h1 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.6rem', margin:'0 0 4px' }}>CCG World Admin</h1>
          <p style={{ color:'var(--text-light)', fontSize:'0.85rem', margin:0 }}>Sign in with your admin account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@ccgworld.org" required autoFocus /></div>
          <div className="form-group"><label>Password</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required /></div>
          {err&&<div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.85rem', marginBottom:16 }}>❌ {err}</div>}
          <button type="submit" className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'13px' }} disabled={loading}>
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
