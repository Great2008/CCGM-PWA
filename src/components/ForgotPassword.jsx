// src/components/ForgotPassword.jsx
// "Forgot password" flow rendered inside the sign-in modal. Code-based (no email links), so it
// works the same in the website and the Capacitor app:
//   1) enter email  ->  2) enter the 6-digit code + a new password  ->  3) done (signed in)
import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { checkPassword } from '../lib/passwordRules'
import { PasswordInput, PasswordStrength, MatchHint } from './PasswordField'

const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:'0.92rem', fontFamily:'var(--font-body)', outline:'none', color:'var(--text-dark)', boxSizing:'border-box', background:'white' }
const label = { fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:5 }
const focus = e => { e.target.style.borderColor = 'var(--brand-base)' }
const blur  = e => { e.target.style.borderColor = '#e2e8f0' }

function Header({ icon, title, sub }) {
  return (
    <div style={{ textAlign:'center', marginBottom:22 }}>
      <div style={{ width:50, height:50, borderRadius:14, background:'linear-gradient(135deg,var(--brand-light),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', margin:'0 auto 12px' }}>{icon}</div>
      <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.35rem', margin:'0 0 4px' }}>{title}</h2>
      <p style={{ color:'var(--text-light)', fontSize:'0.83rem', margin:0, lineHeight:1.5 }}>{sub}</p>
    </div>
  )
}

const linkBtn = { background:'none', border:'none', cursor:'pointer', color:'var(--brand-light)', fontWeight:700, fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:0 }

export default function ForgotPassword({ initialEmail = '', onBack, onDone }) {
  const [step, setStep]         = useState('email')   // 'email' | 'reset' | 'done'
  const [email, setEmail]       = useState(initialEmail)
  const [code, setCode]         = useState('')
  const [pass, setPass]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const friendly = (error) => {
    const m = (error?.message || '').toLowerCase()
    if (error?.status === 429 || m.includes('rate limit') || m.includes('only request this after') || m.includes('security purposes'))
      return 'Please wait a minute before asking for another code.'
    return error?.message || 'Something went wrong. Please try again.'
  }

  const sendCode = async (e) => {
    e?.preventDefault(); setErr('')
    const clean = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setErr('Please enter a valid email address.'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(clean)
    setLoading(false)
    if (error) { setErr(friendly(error)); return }
    setEmail(clean); setCode(''); setStep('reset'); setCooldown(60)
  }

  const resend = async () => {
    if (cooldown > 0) return
    setErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) setErr(friendly(error)); else setCooldown(60)
  }

  const submitReset = async (e) => {
    e.preventDefault(); setErr('')
    if (!/^\d{6}$/.test(code)) { setErr('Please enter the 6-digit code from your email.'); return }
    if (!checkPassword(pass).allMet) { setErr('Please choose a password that meets all the requirements listed below.'); return }
    if (pass !== confirm) { setErr('Passwords do not match.'); return }
    setLoading(true)
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
    if (vErr) { setLoading(false); setErr('That code is invalid or has expired. Request a new one and try again.'); return }
    const { error: uErr } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (uErr) { setErr(uErr.message); return }
    setStep('done')
  }

  const ErrBox = () => err ? (
    <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.84rem', marginBottom:14 }}>❌ {err}</div>
  ) : null

  if (step === 'done') return (
    <>
      <Header icon="✅" title="Password Updated" sub="Your password has been changed and you’re now signed in." />
      <button onClick={onDone} className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'12px' }}>Continue →</button>
    </>
  )

  if (step === 'reset') return (
    <>
      <Header icon="🔑" title="Enter Your Code" sub={`If an account exists for ${email}, we’ve sent it a 6-digit code.`} />
      <form onSubmit={submitReset}>
        <div style={{ marginBottom:14 }}>
          <label style={label}>6-digit code</label>
          <input style={{ ...inputStyle, textAlign:'center', letterSpacing:'0.4em', fontSize:'1.2rem', fontWeight:700 }}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" maxLength={6} required onFocus={focus} onBlur={blur} />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={label}>New password</label>
          <PasswordInput style={inputStyle} value={pass} onChange={e => setPass(e.target.value)} placeholder="Create a new password" autoComplete="new-password" required onFocus={focus} onBlur={blur} />
          <PasswordStrength password={pass} />
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={label}>Confirm new password</label>
          <PasswordInput style={inputStyle} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" required onFocus={focus} onBlur={blur} />
          <MatchHint password={pass} confirm={confirm} />
        </div>
        <ErrBox />
        <button type="submit" className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'12px', marginBottom:14 }} disabled={loading}>{loading ? '⏳ Updating…' : 'Reset Password →'}</button>
      </form>
      <div style={{ textAlign:'center', fontSize:'0.84rem', color:'var(--text-light)', display:'grid', gap:8 }}>
        <span>Didn’t get it?{' '}
          <button onClick={resend} disabled={cooldown > 0} style={{ ...linkBtn, color: cooldown > 0 ? '#94a3b8' : 'var(--brand-light)', cursor: cooldown > 0 ? 'default' : 'pointer' }}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </span>
        <button onClick={() => { setStep('email'); setErr('') }} style={linkBtn}>Use a different email</button>
      </div>
    </>
  )

  return (
    <>
      <Header icon="🔐" title="Forgot Password?" sub="Enter your email and we’ll send you a 6-digit code to reset it." />
      <form onSubmit={sendCode}>
        <div style={{ marginBottom:18 }}>
          <label style={label}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required autoFocus onFocus={focus} onBlur={blur} />
        </div>
        <ErrBox />
        <button type="submit" className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'12px', marginBottom:16 }} disabled={loading}>{loading ? '⏳ Sending…' : 'Send Code →'}</button>
      </form>
      <div style={{ textAlign:'center' }}><button onClick={onBack} style={linkBtn}>← Back to sign in</button></div>
    </>
  )
}
