import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function SuspensionNotice() {
  const { profile, signOut } = useAuth()
  if (!profile?.suspended) return null

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
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Suspension Period</div>
          <div style={{ color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 600 }}>
            {until ? 'Until ' + until : 'Indefinite'}
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
