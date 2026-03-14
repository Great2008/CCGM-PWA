import { useRef, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import supabase from '../lib/supabase'

// ── QR Code generator (pure JS, no library needed) ──────────────
// Uses the qrcode npm-free approach via a data URL from an API
function qrDataUrl(text, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=8`
}

// ── Load image as ImageBitmap for canvas drawing ─────────────────
async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ── Cape stripe config by church title ───────────────────────────
function getCapeStripes(churchTitle) {
  if (!churchTitle) return null
  if (churchTitle === 'Apostle')  return 2
  if (churchTitle === 'Elder')    return 1
  // Pastor, Evangelist, Deacon, Deaconess, Prophet → plain (0 stripes but has cape)
  const hasCape = ['Pastor','Evangelist','Deacon','Deaconess','Prophet'].includes(churchTitle)
  return hasCape ? 0 : null // null = no cape at all
}

// ── Draw cape stripe band on canvas ──────────────────────────────
// Draws a green band with 0, 1, or 2 gold stripes beneath the cert title
function drawCapeBadge(ctx, W, y, stripes, churchTitle) {
  const bandH = 38
  const bandW = 320
  const x = (W - bandW) / 2

  // Green cape band
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, bandW, bandH, 6)
  ctx.fillStyle = '#166534'
  ctx.fill()

  // Gold stripes (horizontal lines inside the band)
  if (stripes >= 1) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    const stripeY1 = stripes === 2 ? y + 12 : y + bandH / 2
    ctx.beginPath(); ctx.moveTo(x + 20, stripeY1); ctx.lineTo(x + bandW - 20, stripeY1); ctx.stroke()
  }
  if (stripes === 2) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    const stripeY2 = y + 26
    ctx.beginPath(); ctx.moveTo(x + 20, stripeY2); ctx.lineTo(x + bandW - 20, stripeY2); ctx.stroke()
  }

  // Church title text
  ctx.fillStyle = stripes > 0 ? '#fbbf24' : 'rgba(255,255,255,0.9)'
  ctx.font = `bold 15px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.fillText(churchTitle.toUpperCase(), W / 2, y + bandH / 2 + 5)

  ctx.restore()
}

// ── Corner stripe indicator (top-right of header) ────────────────
function drawCornerStripes(ctx, W, stripes) {
  if (stripes === null) return
  const size = 90  // corner triangle size
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(W - 36, 30)   // top-right of header area (inside border)
  ctx.lineTo(W - 36, 30 + size)
  ctx.lineTo(W - 36 - size, 30)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()

  // Draw stripes as diagonal lines across the corner
  const stripeColor = '#fbbf24'
  const stripeWidth = stripes === 0 ? 0 : 4
  ctx.strokeStyle = stripeColor
  ctx.lineWidth = stripeWidth
  ctx.lineCap = 'round'

  if (stripes >= 1) {
    ctx.beginPath()
    ctx.moveTo(W - 36 - 55, 30)
    ctx.lineTo(W - 36, 30 + 55)
    ctx.stroke()
  }
  if (stripes === 2) {
    ctx.beginPath()
    ctx.moveTo(W - 36 - 30, 30)
    ctx.lineTo(W - 36, 30 + 30)
    ctx.stroke()
  }

  ctx.restore()
}

// ── Title prefix for name on certificate ─────────────────────────
function getTitlePrefix(churchTitle, gender) {
  if (churchTitle && !['Brother','Sister'].includes(churchTitle)) return churchTitle
  if (gender === 'Female') return 'Sister'
  return 'Brother'
}

// ── Format date nicely ───────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtBirthday(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const day = d.getDate()
  const suffix = day === 1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\d+/, day + suffix)
}

const APP_URL = 'https://ccgm-pwa.vercel.app'

export default function Certificate() {
  const { user, profile, churchTitle } = useAuth()
  const [searchParams] = useSearchParams()
  const [adminSig, setAdminSig] = useState(null) // base64 signature from site_settings
  const [tab, setTab] = useState(searchParams.get('type') === 'birth' ? 'birth' : 'membership')

  // Canvas refs
  const memberCanvasRef = useRef(null)
  const birthCanvasRef  = useRef(null)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [memberDone, setMemberDone] = useState(false)
  const [birthDone,  setBirthDone]  = useState(false)

  // Load admin signature from site_settings
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'admin_signature').single()
      .then(({ data }) => { if (data?.value?.image) setAdminSig(data.value.image) })
  }, [])

  if (!user || !profile) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>🏅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', margin: 0 }}>Members Only</h2>
        <p style={{ color: 'var(--text-light)' }}>Sign in to download your certificates.</p>
        <Link to="/timeline" className="btn btn-blue">Sign In →</Link>
      </div>
    )
  }

  const name      = profile.full_name || profile.display_name || 'Member'
  const branch    = profile.church_branch || 'CCG World'
  const gender    = profile.gender || null
  const titlePrefix = getTitlePrefix(churchTitle, gender)
  const displayName = `${titlePrefix} ${name}`
  const joinDate  = fmtDate(profile.created_at)
  const birthday  = profile.birthday ? fmtBirthday(profile.birthday) : null
  const certId    = 'CCG-' + (user.id || '').slice(0, 8).toUpperCase()
  const birthId   = 'CCGB-' + (user.id || '').slice(0, 8).toUpperCase()
  const today     = fmtDate(new Date().toISOString())
  const verifyUrl = APP_URL + '/verify?id=' + certId
  const birthVerifyUrl = APP_URL + '/verify?id=' + birthId

  // ── Draw membership certificate ──────────────────────────────
  const generateMembership = async () => {
    setGenerating(true)
    const canvas = memberCanvasRef.current
    const W = 1200, H = 850
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#fdf9f0'
    ctx.fillRect(0, 0, W, H)

    // Watermark cross
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 320px serif'
    ctx.textAlign = 'center'
    ctx.fillText('✝', W / 2, H / 2 + 100)
    ctx.restore()

    // Outer + inner border
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 6
    ctx.strokeRect(18, 18, W - 36, H - 36)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.strokeRect(30, 30, W - 60, H - 60)

    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, W, 130)
    grad.addColorStop(0, '#0a2612'); grad.addColorStop(1, '#166534')
    ctx.fillStyle = grad
    ctx.fillRect(30, 30, W - 60, 130)

    // Logo
    try {
      const logo = await loadImage('/logo.png')
      ctx.drawImage(logo, 56, 42, 106, 106)
    } catch (_) {}

    // Corner stripes (top-right of header)
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    // Church name in header
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 21px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W / 2, 78)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '15px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W / 2, 108)
    ctx.fillStyle = '#fbbf24'
    ctx.font = '13px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W / 2, 130)

    // Gold line
    ctx.fillStyle = '#d97706'; ctx.fillRect(30, 160, W - 60, 3)

    // Title
    ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 50px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Certificate of Membership', W / 2, 252)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(W/2-280,270); ctx.lineTo(W/2+280,270); ctx.stroke()

    // Cape stripe badge (only for titled members)
    const stripes = getCapeStripes(churchTitle)
    let bodyStartY = 318
    if (stripes !== null) {
      drawCapeBadge(ctx, W, 282, stripes, churchTitle)
      bodyStartY = 346
    }

    // Body
    ctx.fillStyle = '#374151'; ctx.font = 'italic 21px Georgia, serif'
    ctx.fillText('This is to certify that', W / 2, bodyStartY)
    const yOff = bodyStartY - 318
    ctx.fillStyle = '#0a2612'
    // Scale font down for long names to prevent overflow
    const maxNameWidth = W - 240
    let nameFontSize = 44
    ctx.font = `bold ${nameFontSize}px Georgia, serif`
    while (ctx.measureText(displayName).width > maxNameWidth && nameFontSize > 24) {
      nameFontSize -= 2
      ctx.font = `bold ${nameFontSize}px Georgia, serif`
    }
    ctx.fillText(displayName, W / 2, 384 + yOff)
    const nw = ctx.measureText(displayName).width
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-nw/2, 398 + yOff); ctx.lineTo(W/2+nw/2, 398 + yOff); ctx.stroke()
    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('is a recognized member of the', W / 2, 442 + yOff)
    ctx.fillStyle = '#166534'; ctx.font = 'bold 23px Georgia, serif'
    ctx.fillText(branch, W / 2, 478 + yOff)
    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('branch of the Christian Church of God Mission', W / 2, 512 + yOff)
    if (joinDate) ctx.fillText('Member since ' + joinDate, W / 2, 546 + yOff)

    // Gold divider
    ctx.fillStyle = '#d97706'; ctx.fillRect(W/2-180, 574 + yOff, 360, 2)

    // Issued / Cert ID
    ctx.textAlign = 'left'; ctx.fillStyle = '#374151'; ctx.font = 'italic 16px Georgia, serif'
    ctx.fillText('Issued:', 120, 640 + yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '16px Georgia, serif'
    ctx.fillText(today, 120, 660 + yOff)
    ctx.textAlign = 'right'; ctx.fillStyle = '#374151'; ctx.font = 'italic 16px Georgia, serif'
    ctx.fillText('Certificate ID:', W - 120, 640 + yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '16px Georgia, serif'
    ctx.fillText(certId, W - 120, 660 + yOff)

    // QR code
    try {
      const qr = await loadImage(qrDataUrl(verifyUrl, 110))
      ctx.drawImage(qr, W/2 - 55, 600 + yOff, 110, 110)
      ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280'; ctx.font = '11px Georgia, serif'
      ctx.fillText('Scan to verify', W/2, 722 + yOff)
    } catch (_) {}

    // Footer
    ctx.textAlign = 'center'; ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 12px Georgia, serif'
    ctx.fillText('✦ Issued digitally by CCG World ✦', W / 2, 790 + yOff)
    ctx.font = '11px Georgia, serif'
    ctx.fillText('Verify at: ' + verifyUrl, W / 2, 810 + yOff)

    setGenerating(false)
    setMemberDone(true)
  }

  // ── Draw birth certificate ────────────────────────────────────
  const generateBirth = async () => {
    if (!birthday) return
    setGenerating(true)
    const canvas = birthCanvasRef.current
    const W = 1200, H = 900
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // Soft ivory background
    ctx.fillStyle = '#fffef5'
    ctx.fillRect(0, 0, W, H)

    // Watermark
    ctx.save(); ctx.globalAlpha = 0.03; ctx.fillStyle = '#0a2612'
    ctx.font = 'bold 280px serif'; ctx.textAlign = 'center'
    ctx.fillText('✝', W/2, H/2+80); ctx.restore()

    // Decorative double border
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 7
    ctx.strokeRect(16, 16, W-32, H-32)
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2
    ctx.strokeRect(28, 28, W-56, H-56)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1
    ctx.strokeRect(36, 36, W-72, H-72)

    // Header gradient — warmer gold/green
    const grad = ctx.createLinearGradient(0, 0, W, 150)
    grad.addColorStop(0, '#0a2612'); grad.addColorStop(0.5, '#14532d'); grad.addColorStop(1, '#b45309')
    ctx.fillStyle = grad; ctx.fillRect(36, 36, W-72, 148)

    // Logo
    try {
      const logo = await loadImage('/logo.png')
      ctx.drawImage(logo, 60, 46, 110, 110)
    } catch (_) {}

    // Corner stripes
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    // Header text
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 22px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 86)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 114)
    ctx.fillStyle = '#fbbf24'; ctx.font = '13px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 136)

    // Gold line
    ctx.fillStyle = '#d97706'; ctx.fillRect(36,184,W-72,3)

    // Decorative title area
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 54px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Birth', W/2, 270)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(W/2-260,288); ctx.lineTo(W/2+260,288); ctx.stroke()

    // Subtitle
    ctx.fillStyle = '#92400e'; ctx.font = 'italic 19px Georgia, serif'
    ctx.fillText('In the Name of the Lord', W/2, 326)

    // Body
    ctx.fillStyle = '#374151'; ctx.font = 'italic 21px Georgia, serif'
    ctx.fillText('This is to certify that', W/2, 376)

    ctx.fillStyle = '#0a2612'
    const maxNameWidthB = W - 240
    let nameFontSizeB = 46
    ctx.font = `bold ${nameFontSizeB}px Georgia, serif`
    while (ctx.measureText(displayName).width > maxNameWidthB && nameFontSizeB > 24) {
      nameFontSizeB -= 2
      ctx.font = `bold ${nameFontSizeB}px Georgia, serif`
    }
    ctx.fillText(displayName, W/2, 444)
    const nw = ctx.measureText(displayName).width
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-nw/2,460); ctx.lineTo(W/2+nw/2,460); ctx.stroke()

    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('was born on', W/2, 504)

    ctx.fillStyle = '#92400e'; ctx.font = 'bold 30px Georgia, serif'
    ctx.fillText(birthday, W/2, 546)

    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('and is a member of the ' + branch + ' branch', W/2, 584)
    ctx.fillText('of the Christian Church of God Mission', W/2, 612)

    // Gold divider
    ctx.fillStyle = '#d97706'; ctx.fillRect(W/2-200,638,400,2)

    // Signature area
    if (adminSig) {
      try {
        const sig = await loadImage(adminSig)
        // Draw signature on right side
        ctx.drawImage(sig, W - 340, 648, 220, 70)
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(W-340,722); ctx.lineTo(W-120,722); ctx.stroke()
        ctx.fillStyle = '#374151'; ctx.font = 'italic 13px Georgia, serif'; ctx.textAlign = 'right'
        ctx.fillText('Authorised Signature', W-120, 740)
      } catch (_) {}
    } else {
      // Placeholder signature line
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1; ctx.textAlign = 'right'
      ctx.beginPath(); ctx.moveTo(W-340,720); ctx.lineTo(W-120,720); ctx.stroke()
      ctx.fillStyle = '#374151'; ctx.font = 'italic 13px Georgia, serif'
      ctx.fillText('Authorised Signature', W-120, 738)
    }

    // Issue / ID
    ctx.textAlign = 'left'; ctx.fillStyle = '#374151'; ctx.font = 'italic 15px Georgia, serif'
    ctx.fillText('Issued:', 120, 672)
    ctx.fillStyle = '#0a2612'; ctx.font = '15px Georgia, serif'
    ctx.fillText(today, 120, 692)
    ctx.fillStyle = '#374151'; ctx.font = 'italic 15px Georgia, serif'
    ctx.fillText('Certificate ID:', 120, 716)
    ctx.fillStyle = '#0a2612'; ctx.font = '15px Georgia, serif'
    ctx.fillText(birthId, 120, 736)

    // QR code
    try {
      const qr = await loadImage(qrDataUrl(birthVerifyUrl, 110))
      ctx.drawImage(qr, W/2 - 55, 648, 110, 110)
      ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280'; ctx.font = '11px Georgia, serif'
      ctx.fillText('Scan to verify', W/2, 772)
    } catch (_) {}

    // Footer
    ctx.textAlign = 'center'; ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 12px Georgia, serif'
    ctx.fillText('✦ Issued digitally by CCG World ✦', W/2, 842)
    ctx.font = '11px Georgia, serif'
    ctx.fillText('Verify at: ' + birthVerifyUrl, W/2, 862)

    setGenerating(false)
    setBirthDone(true)
  }

  const download = (canvasRef, filename) => {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const hasBirthday = !!profile.birthday

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(80px,12vw,110px) 5% 48px', textAlign: 'center' }}>
        <span className="section-label">Member Recognition</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 12px' }}>
          🏅 My Certificates
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          Download your official CCG World certificates with QR verification.
        </p>
      </div>

      <div className="container" style={{ maxWidth: 860, padding: '40px 5% 80px' }}>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          {[
            { key: 'membership', label: '🏅 Membership Certificate' },
            { key: 'birth',      label: '🎂 Birth Certificate' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '10px 22px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.86rem', background: tab === t.key ? 'var(--brand-mid)' : '#f1f5f9', color: tab === t.key ? 'white' : 'var(--text-mid)', transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Membership Certificate ── */}
        {tab === 'membership' && (
          <div>
            <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: '24px 28px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', margin: '0 0 16px' }}>Certificate Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 12 }}>
                {[['👤 Name', name], ['⛪ Branch', branch], ['📅 Member Since', joinDate||'N/A'], ['🔖 Certificate ID', certId], ...(churchTitle ? [['✝️ Church Title', churchTitle]] : [])].map(([l,v]) => (
                  <div key={l} style={{ background: '#f8fafc', borderRadius: 10, padding: '11px 14px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{l}</div>
                    <div style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.9rem' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {!memberDone ? (
                <button onClick={generateMembership} disabled={generating}
                  style={{ padding: '12px 28px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, cursor: generating?'not-allowed':'pointer', fontFamily: 'var(--font-body)' }}>
                  {generating ? '⏳ Generating…' : '🏅 Generate Certificate'}
                </button>
              ) : (
                <>
                  <button onClick={() => download(memberCanvasRef, 'CCG-Membership-' + name.replace(/\s+/g,'-') + '.png')}
                    style={{ padding: '12px 28px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    ⬇️ Download PNG
                  </button>
                  <button onClick={() => { setMemberDone(false); generateMembership() }}
                    style={{ padding: '12px 20px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    🔄 Regenerate
                  </button>
                </>
              )}
            </div>
            <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', display: memberDone ? 'block' : 'none' }}>
              <canvas ref={memberCanvasRef} style={{ width: '100%', display: 'block' }} />
            </div>
            {!memberDone && (
              <div style={{ background: 'var(--brand-pale)', borderRadius: 14, padding: '48px 32px', textAlign: 'center', color: 'var(--text-light)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏅</div>
                <div>Click "Generate Certificate" to preview and download</div>
              </div>
            )}
          </div>
        )}

        {/* ── Birth Certificate ── */}
        {tab === 'birth' && (
          <div>
            {!hasBirthday ? (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 16, padding: '36px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎂</div>
                <h3 style={{ fontFamily: 'var(--font-display)', color: '#92400e', margin: '0 0 10px' }}>Birthday Not Set</h3>
                <p style={{ color: '#78350f', lineHeight: 1.7, marginBottom: 20, fontSize: '0.92rem' }}>
                  You need to add your birthday to your profile before you can generate a birth certificate.
                </p>
                <Link to="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 30, background: 'var(--brand-base)', color: 'white', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
                  Add Birthday in Profile →
                </Link>
              </div>
            ) : (
              <div>
                <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: '24px 28px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', marginBottom: 24 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', margin: '0 0 16px' }}>Certificate Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 12 }}>
                    {[['👤 Name', name], ['🎂 Birthday', birthday], ['⛪ Branch', branch], ['🔖 Certificate ID', birthId]].map(([l,v]) => (
                      <div key={l} style={{ background: '#f8fafc', borderRadius: 10, padding: '11px 14px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{l}</div>
                        <div style={{ color: 'var(--text-dark)', fontWeight: 600, fontSize: '0.9rem' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {!adminSig && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginTop: 14, fontSize: '0.83rem', color: '#92400e' }}>
                      ⚠️ No admin signature uploaded yet. The certificate will have a blank signature line. Ask your admin to upload a signature in the admin panel.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                  {!birthDone ? (
                    <button onClick={generateBirth} disabled={generating}
                      style={{ padding: '12px 28px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,#b45309,#d97706)', color: 'white', fontWeight: 700, cursor: generating?'not-allowed':'pointer', fontFamily: 'var(--font-body)' }}>
                      {generating ? '⏳ Generating…' : '🎂 Generate Birth Certificate'}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => download(birthCanvasRef, 'CCG-Birth-Certificate-' + name.replace(/\s+/g,'-') + '.png')}
                        style={{ padding: '12px 28px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,#b45309,#d97706)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        ⬇️ Download PNG
                      </button>
                      <button onClick={() => { setBirthDone(false); generateBirth() }}
                        style={{ padding: '12px 20px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        🔄 Regenerate
                      </button>
                    </>
                  )}
                </div>
                <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', display: birthDone ? 'block' : 'none' }}>
                  <canvas ref={birthCanvasRef} style={{ width: '100%', display: 'block' }} />
                </div>
                {!birthDone && (
                  <div style={{ background: '#fff7ed', borderRadius: 14, padding: '48px 32px', textAlign: 'center', color: '#92400e' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎂</div>
                    <div>Click "Generate Birth Certificate" to preview and download</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
