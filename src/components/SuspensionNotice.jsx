import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function SuspensionNotice() {
  const { profile, signOut } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  // Show reinstatement notice once if just reinstated (suspended=false but flag set)
  // We detect "just reinstated" via a sessionStorage flag set by the admin action —
  // but simpler: just check if profile has no suspension but had one (we can't know that here).
  // Instead: suspended=true → show suspension. suspended=false → nothing to show.
  // For reinstatement notice, we use sessionStorage written by AuthContext after profile refresh.

  if (!profile) return null

  // Reinstatement notice — shown once after suspension is lifted
  const reinstatedKey = 'ccgm_reinstated_notice'
  const wasReinstatement = typeof window !== 'undefined' && sessionStorage.getItem(reinstatedKey)

  if (!profile.suspended && wasReinstatement && !dismissed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 8000, padding: 20,
      }}>
        <div style={{
          background: 'white', borderRadius: 20, padding: '40px 32px',
          width: '100%', maxWidth: 420, textAlign: 'center',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', margin: '0 0 12px' }}>
            Account Reinstated!
          </h2>
          <p style={{ color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 28, fontSize: '0.92rem' }}>
            Your suspension has been lifted. You now have full access to CCG World. Welcome back!
          </p>
          <button
            onClick={() => { sessionStorage.removeItem(reinstatedKey); setDismissed(true) }}
            style={{ padding: '12px 36px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer', fontSize: '0.95rem' }}>
            Continue to CCG World →
          </button>
        </div>
      </div>
    )
  }

  // Suspension notice
  if (!profile.suspended) return null

  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const until = fmtDate(profile.suspension_expires_at)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,5,5,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 8000, padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '40px 32px',
        width: '100%', maxWidth: 460, textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: '#dc2626', fontSize: '1.5rem', margin: '0 0 10px' }}>
          Account Suspended
        </h2>
        <p style={{ color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 20, fontSize: '0.92rem' }}>
          Your account has been temporarily suspended by the CCG World admin team.
        </p>

        {profile.suspension_reason && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Reason</div>
            <div style={{ color: '#7f1d1d', fontSize: '0.9rem', lineHeight: 1.6 }}>{profile.suspension_reason}</div>
          </div>
        )}

        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Suspended Until</div>
          <div style={{ color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 600 }}>
            {until ? until : 'Indefinite'}
          </div>
          {!until && (
            <div style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: 3 }}>
              An admin will lift this suspension manually.
            </div>
          )}
        </div>

        <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', marginBottom: 24, lineHeight: 1.6 }}>
          If you believe this is a mistake, please{' '}
          <Link to="/contact" style={{ color: 'var(--brand-light)', fontWeight: 700 }}>contact us</Link>.
          You can still browse public content while suspended.
        </p>

        <button onClick={signOut}
          style={{ padding: '11px 28px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: 'var(--text-mid)', fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer', fontSize: '0.88rem' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
