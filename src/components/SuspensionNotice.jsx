import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import supabase from '../lib/supabase'

export default function SuspensionNotice() {
  const { profile, signOut } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [appealSent, setAppealSent] = useState(false)
  const [appealSending, setAppealSending] = useState(false)

  if (!profile) return null

  const reinstatedKey = 'ccgm_reinstated_notice'
  const wasReinstatement = typeof window !== 'undefined' && sessionStorage.getItem(reinstatedKey)

  if (!profile.suspended && wasReinstatement && !dismissed) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:8000, padding:20 }}>
        <div style={{ background:'white', borderRadius:20, padding:'40px 32px', width:'100%', maxWidth:420, textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🎉</div>
          <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.5rem', margin:'0 0 12px' }}>Account Reinstated!</h2>
          <p style={{ color:'var(--text-mid)', lineHeight:1.7, marginBottom:28, fontSize:'0.92rem' }}>
            Your suspension has been lifted. You now have full access to CCG World. Welcome back!
          </p>
          <button onClick={() => { sessionStorage.removeItem(reinstatedKey); setDismissed(true) }}
            style={{ padding:'12px 36px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer', fontSize:'0.95rem' }}>
            Continue to CCG World →
          </button>
        </div>
      </div>
    )
  }

  if (!profile.suspended) return null

  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : null
  const until = fmtDate(profile.suspension_expires_at)

  const submitAppeal = async () => {
    if (!appealText.trim()) return
    setAppealSending(true)
    await supabase.from('suspension_logs').insert({
      user_id: profile.id,
      action: 'review_requested',
      reason: appealText.trim(),
    })
    setAppealSending(false)
    setAppealSent(true)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,5,5,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:8000, padding:20 }}>
      <div style={{ background:'white', borderRadius:20, padding:'40px 32px', width:'100%', maxWidth:460, textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>

        {showAppeal ? (
          // ── Appeal form ──
          appealSent ? (
            <>
              <div style={{ fontSize:'2.5rem', marginBottom:14 }}>📨</div>
              <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.35rem', margin:'0 0 12px' }}>Review Requested</h2>
              <p style={{ color:'var(--text-mid)', lineHeight:1.7, fontSize:'0.9rem', marginBottom:28 }}>
                Your request has been submitted. An admin will review your case and contact you. This may take a few days.
              </p>
              <button onClick={() => setShowAppeal(false)}
                style={{ padding:'11px 28px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer' }}>
                ← Back
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.25rem', margin:'0 0 8px', textAlign:'left' }}>Request Review</h2>
              <p style={{ color:'var(--text-light)', fontSize:'0.84rem', marginBottom:18, textAlign:'left', lineHeight:1.6 }}>
                Explain why you believe your suspension should be lifted. Be clear and honest — this goes directly to an admin.
              </p>
              <textarea
                value={appealText}
                onChange={e => setAppealText(e.target.value)}
                placeholder="Explain your case here..."
                rows={5}
                style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box', marginBottom:16 }}
              />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={submitAppeal} disabled={!appealText.trim() || appealSending}
                  style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:!appealText.trim()?'#9ca3af':'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:!appealText.trim()?'not-allowed':'pointer' }}>
                  {appealSending ? 'Submitting…' : 'Submit Request'}
                </button>
                <button onClick={() => setShowAppeal(false)}
                  style={{ padding:'11px 20px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          )
        ) : (
          // ── Suspension notice ──
          <>
            <div style={{ fontSize:'3rem', marginBottom:16 }}>🚫</div>
            <h2 style={{ fontFamily:'var(--font-display)', color:'#dc2626', fontSize:'1.5rem', margin:'0 0 10px' }}>Account Suspended</h2>
            <p style={{ color:'var(--text-mid)', lineHeight:1.7, marginBottom:20, fontSize:'0.92rem' }}>
              Your account has been {profile.auto_suspended ? 'automatically suspended due to multiple reports.' : 'suspended by the CCG World admin team.'}
            </p>

            {profile.suspension_reason && (
              <div style={{ background:'#fff5f5', border:'1.5px solid #fecaca', borderRadius:12, padding:'14px 18px', marginBottom:20, textAlign:'left' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Reason</div>
                <div style={{ color:'#7f1d1d', fontSize:'0.9rem', lineHeight:1.6 }}>{profile.suspension_reason}</div>
              </div>
            )}

            <div style={{ background:'#f8fafc', borderRadius:12, padding:'14px 18px', marginBottom:24, textAlign:'left' }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Suspended Until</div>
              <div style={{ color:'var(--text-dark)', fontSize:'0.9rem', fontWeight:600 }}>
                {until ? until : 'Indefinite — pending admin review'}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={() => setShowAppeal(true)}
                style={{ padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer', fontSize:'0.9rem' }}>
                📨 Request Review
              </button>
              <button onClick={signOut}
                style={{ padding:'11px 28px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer', fontSize:'0.88rem' }}>
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
