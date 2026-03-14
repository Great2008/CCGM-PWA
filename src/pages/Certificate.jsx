import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function Certificate() {
  const { user, profile } = useAuth()
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)

  if (!user || !profile) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🏅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', margin: 0 }}>Members Only</h2>
        <p style={{ color: 'var(--text-light)' }}>Sign in to download your membership certificate.</p>
        <Link to="/timeline" className="btn btn-blue">Sign In →</Link>
      </div>
    )
  }

  const name        = profile.full_name || profile.display_name || 'Member'
  const branch      = profile.church_branch || 'CCG World'
  const joinDate    = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  const certId      = 'CCG-' + (user.id || '').slice(0, 8).toUpperCase()
  const today       = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const generate = async () => {
    setGenerating(true)
    const canvas = canvasRef.current
    const W = 1200, H = 850
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#fdf9f0'
    ctx.fillRect(0, 0, W, H)

    // Outer border
    ctx.strokeStyle = '#b45309'
    ctx.lineWidth = 6
    ctx.strokeRect(18, 18, W - 36, H - 36)

    // Inner border
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 2
    ctx.strokeRect(30, 30, W - 60, H - 60)

    // Dark green header band
    const grad = ctx.createLinearGradient(0, 0, W, 120)
    grad.addColorStop(0, '#0a2612')
    grad.addColorStop(1, '#166534')
    ctx.fillStyle = grad
    ctx.fillRect(30, 30, W - 60, 130)

    // Gold accent line below header
    ctx.fillStyle = '#d97706'
    ctx.fillRect(30, 160, W - 60, 4)

    // Church name in header
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '6px'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W / 2, 80)
    ctx.letterSpacing = '0px'

    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '16px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1954', W / 2, 112)

    // Certificate title
    ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 52px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Certificate of Membership', W / 2, 260)

    // Decorative line under title
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(W / 2 - 300, 278)
    ctx.lineTo(W / 2 + 300, 278)
    ctx.stroke()

    // "This is to certify that"
    ctx.fillStyle = '#374151'
    ctx.font = 'italic 22px Georgia, serif'
    ctx.fillText('This is to certify that', W / 2, 330)

    // Member name
    ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 46px Georgia, serif'
    ctx.fillText(name, W / 2, 400)

    // Underline name
    const nameWidth = ctx.measureText(name).width
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W / 2 - nameWidth / 2, 414)
    ctx.lineTo(W / 2 + nameWidth / 2, 414)
    ctx.stroke()

    // Body text
    ctx.fillStyle = '#374151'
    ctx.font = '20px Georgia, serif'
    ctx.fillText('is a recognized member of the', W / 2, 460)

    ctx.fillStyle = '#166534'
    ctx.font = 'bold 24px Georgia, serif'
    ctx.fillText(branch, W / 2, 498)

    ctx.fillStyle = '#374151'
    ctx.font = '20px Georgia, serif'
    ctx.fillText('branch of the Christian Church of God Mission', W / 2, 534)

    if (joinDate) {
      ctx.fillText('Member since ' + joinDate, W / 2, 568)
    }

    // Gold divider
    ctx.fillStyle = '#d97706'
    ctx.fillRect(W / 2 - 200, 598, 400, 2)

    // Signature area
    ctx.fillStyle = '#374151'
    ctx.font = 'italic 18px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('Issued:', 120, 680)
    ctx.font = '18px Georgia, serif'
    ctx.fillStyle = '#0a2612'
    ctx.fillText(today, 120, 706)

    ctx.textAlign = 'right'
    ctx.fillStyle = '#374151'
    ctx.font = 'italic 18px Georgia, serif'
    ctx.fillText('Certificate ID:', W - 120, 680)
    ctx.font = '18px Georgia, serif'
    ctx.fillStyle = '#0a2612'
    ctx.fillText(certId, W - 120, 706)

    // Bottom seal area
    ctx.textAlign = 'center'
    ctx.font = 'bold 13px Georgia, serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText('✦ This certificate is issued digitally by CCG World ✦', W / 2, 790)
    ctx.font = '12px Georgia, serif'
    ctx.fillText('Verify at ccgm-pwa.vercel.app', W / 2, 812)

    // Watermark cross
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 320px serif'
    ctx.textAlign = 'center'
    ctx.fillText('✝', W / 2, H / 2 + 100)
    ctx.restore()

    setGenerating(false)
    setDone(true)
  }

  const download = () => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = 'CCG-World-Certificate-' + name.replace(/\s+/g, '-') + '.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(80px,12vw,110px) 5% 48px', textAlign: 'center' }}>
        <span className="section-label">Member Recognition</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 12px' }}>
          🏅 Membership Certificate
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          Download your official CCG World membership certificate as a PNG image.
        </p>
      </div>

      <div className="container" style={{ maxWidth: 800, padding: '48px 5% 80px' }}>

        {/* Member info card */}
        <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: '28px 32px', boxShadow: 'var(--shadow-md)', border: '1.5px solid #e2e8f0', marginBottom: 32 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', margin: '0 0 20px', fontSize: '1.15rem' }}>Your Certificate Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {[
              ['👤 Name', name],
              ['⛪ Branch', branch],
              ['📅 Member Since', joinDate || 'N/A'],
              ['🔖 Certificate ID', certId],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                <div style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.92rem' }}>{value}</div>
              </div>
            ))}
          </div>

          {profile.unverified_branch && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: '0.84rem', color: '#92400e' }}>
              ⏳ Your branch is pending admin verification. Your certificate will show the branch name you submitted.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          {!done ? (
            <button onClick={generate} disabled={generating}
              style={{ padding: '13px 32px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-body)', cursor: generating ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              {generating ? '⏳ Generating…' : '🏅 Generate Certificate'}
            </button>
          ) : (
            <>
              <button onClick={download}
                style={{ padding: '13px 32px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                ⬇️ Download PNG
              </button>
              <button onClick={() => { setDone(false); generate() }}
                style={{ padding: '13px 24px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                🔄 Regenerate
              </button>
            </>
          )}
        </div>

        {/* Canvas preview */}
        <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', display: done ? 'block' : 'none' }}>
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
        </div>

        {!done && (
          <div style={{ background: 'var(--brand-pale)', borderRadius: 16, padding: '48px 32px', textAlign: 'center', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏅</div>
            <div style={{ fontSize: '0.95rem' }}>Click "Generate Certificate" to preview and download your certificate</div>
          </div>
        )}
      </div>
    </>
  )
}
