// src/components/IdleSignOut.jsx
// Signs the person out after a period of inactivity, with an optional "Still there?" warning.
// Works in both the main site and the separate /admin app (it needs no auth context).
//
//   <IdleSignOut active={isSignedIn} timeoutMs={...} warnMs={...} onSignOut={signOut} />
//
// "Activity" = tapping, typing, scrolling or moving the mouse in ANY open tab (shared through
// localStorage). Timers sleep when a phone is locked, so the clock is checked again the moment
// the app comes back to the screen.
import { useEffect, useRef, useState, useCallback } from 'react'
import { evaluateIdle } from '../lib/sessionPolicy'

const ACTIVITY_KEY = 'ccgm_last_activity'
const NOTICE_KEY   = 'ccgm_idle_notice'
const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel', 'mousemove']

const readLast  = () => { try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0 } catch { return 0 } }
const writeLast = () => { try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())) } catch { /* private mode */ } }

export default function IdleSignOut({ active, timeoutMs, warnMs = 0, onSignOut }) {
  const [secsLeft, setSecsLeft] = useState(null)
  const [notice, setNotice]     = useState(false)
  const warningRef = useRef(false)
  const doneRef    = useRef(false)
  const signOutRef = useRef(onSignOut)
  signOutRef.current = onSignOut

  // After an idle sign-out, tell the person why (also survives the admin panel swapping screens).
  useEffect(() => {
    try {
      const ts = Number(localStorage.getItem(NOTICE_KEY)) || 0
      if (ts && Date.now() - ts < 2 * 60 * 1000) setNotice(true)
      localStorage.removeItem(NOTICE_KEY)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(false), 12000)
    return () => clearTimeout(t)
  }, [notice])

  // Always track activity, even before sign-in, so a brand-new sign-in is never mistaken
  // for a stale session. While the warning is showing, only its own buttons count.
  useEffect(() => {
    let last = 0
    const onActivity = () => {
      if (warningRef.current) return
      const t = Date.now()
      if (t - last < 2000) return
      last = t; writeLast()
    }
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }))
    return () => EVENTS.forEach(e => window.removeEventListener(e, onActivity, { capture: true }))
  }, [])

  const signOutNow = useCallback(async (becauseIdle) => {
    if (doneRef.current) return
    doneRef.current = true
    warningRef.current = false
    setSecsLeft(null)
    if (becauseIdle) {
      try { localStorage.setItem(NOTICE_KEY, String(Date.now())) } catch { /* ignore */ }
      setNotice(true)
      setTimeout(() => { try { localStorage.removeItem(NOTICE_KEY) } catch { /* ignore */ } }, 3000)
    }
    try { await signOutRef.current?.() } catch { /* already signed out */ }
  }, [])

  const stay = useCallback(() => {
    warningRef.current = false
    setSecsLeft(null)
    writeLast()
  }, [])

  // The clock
  useEffect(() => {
    if (!active || !timeoutMs) { warningRef.current = false; setSecsLeft(null); return }
    doneRef.current = false
    let timer
    const check = () => {
      if (doneRef.current) return
      let last = readLast()
      if (!last) { writeLast(); last = Date.now() }          // first ever visit on this device
      const r = evaluateIdle(last, Date.now(), timeoutMs, warnMs)
      if (r.action === 'signout') { signOutNow(true); return }
      if (r.action === 'warn') { warningRef.current = true; setSecsLeft(r.secsLeft) }
      else if (warningRef.current) { warningRef.current = false; setSecsLeft(null) }   // active in another tab
      timer = setTimeout(check, r.nextCheckMs)
    }
    const wake = () => { clearTimeout(timer); check() }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('pageshow', wake)
    window.addEventListener('storage', wake)
    check()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('pageshow', wake)
      window.removeEventListener('storage', wake)
    }
  }, [active, timeoutMs, warnMs, signOutNow])

  return (
    <>
      {secsLeft !== null && (
        <div role="alertdialog" aria-modal="true" aria-label="Inactivity warning"
          style={{ position:'fixed', inset:0, zIndex:10001, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--white, white)', borderRadius:18, padding:'28px 26px', width:'100%', maxWidth:380, textAlign:'center', boxShadow:'0 24px 70px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize:'2.4rem', marginBottom:8 }}>🔒</div>
            <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep, #0a2612)', margin:'0 0 8px', fontSize:'1.2rem' }}>Still there?</h3>
            <p style={{ color:'var(--text-mid, #475569)', fontSize:'0.9rem', lineHeight:1.6, margin:'0 0 20px' }}>
              For your security, you’ll be signed out in <strong>{secsLeft}s</strong> because you’ve been inactive.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              <button onClick={stay} style={{ padding:'11px 22px', borderRadius:10, border:'none', background:'var(--brand-mid, #1d4ed8)', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>Stay signed in</button>
              <button onClick={() => signOutNow(false)} style={{ padding:'11px 22px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid, #475569)', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>Sign out now</button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div role="status" style={{ position:'fixed', left:'50%', bottom:24, transform:'translateX(-50%)', zIndex:10000, background:'#0f172a', color:'white', padding:'12px 18px', borderRadius:12, fontSize:'0.86rem', lineHeight:1.5, boxShadow:'0 10px 30px rgba(0,0,0,0.35)', display:'flex', gap:12, alignItems:'center', maxWidth:'calc(100vw - 32px)' }}>
          <span>🔒 You were signed out because of inactivity. Please sign in again.</span>
          <button onClick={() => setNotice(false)} aria-label="Dismiss" style={{ background:'none', border:'none', color:'white', cursor:'pointer', fontSize:'1rem', padding:0 }}>✕</button>
        </div>
      )}
    </>
  )
}
