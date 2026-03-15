import { useRef, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import supabase from '../lib/supabase'

// ── Primitive helpers — defined first so all functions below can use them ──

// Safe fillText: never throws on null/undefined
function safeFill(ctx, value, x, y) {
  ctx.fillText(value == null ? '' : String(value), x, y)
}

// roundRect polyfill: ctx.roundRect missing in older Android WebViews
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Safe ellipse: polyfill for Android WebViews that lack ctx.ellipse
// safeEllipse removed — replaced with arc calls

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function qrDataUrl(text, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=8`
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function drawStamp(ctx, x, y, size = 160) {
  try {
    const stamp = await loadImage('/stamp.png')
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.translate(x, y)
    ctx.rotate(-15 * Math.PI / 180)
    ctx.drawImage(stamp, -size/2, -size/2, size, size)
    ctx.restore()
  } catch (_) {}
}

// Cape stripes: null=none, 0=plain green, 1=one stripe, 2=two stripes
function getCapeStripes(t) {
  if (!t) return null
  if (t === 'Apostle') return 2
  if (t === 'Elder')   return 1
  return ['Pastor','Evangelist','Deacon','Deaconess','Prophet'].includes(t) ? 0 : null
}

// Draw the title/post badge band
function drawCapeBadge(ctx, W, y, stripes, title) {
  const bH = 42, bW = 360, x = (W - bW) / 2
  ctx.save()
  roundRect(ctx, x, y, bW, bH, 7)
  ctx.fillStyle = '#166534'; ctx.fill()
  if (stripes >= 1) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3
    const y1 = stripes === 2 ? y+12 : y+bH/2
    ctx.beginPath(); ctx.moveTo(x+22,y1); ctx.lineTo(x+bW-22,y1); ctx.stroke()
  }
  if (stripes === 2) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x+22,y+30); ctx.lineTo(x+bW-22,y+30); ctx.stroke()
  }
  ctx.fillStyle = stripes > 0 ? '#fbbf24' : 'rgba(255,255,255,0.92)'
  ctx.font = 'bold 17px Georgia, serif'; ctx.textAlign = 'center'
  ctx.fillText(title.toUpperCase(), W/2, y+bH/2+6)
  ctx.restore()
}

// Draw diagonal stripes in the header top-right corner
function drawCornerStripes(ctx, W, stripes) {
  if (stripes === null) return
  ctx.save()
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5; ctx.lineCap = 'round'
  if (stripes >= 1) { ctx.beginPath(); ctx.moveTo(W-36-65,32); ctx.lineTo(W-36,32+65); ctx.stroke() }
  if (stripes === 2) { ctx.beginPath(); ctx.moveTo(W-36-36,32); ctx.lineTo(W-36,32+36); ctx.stroke() }
  ctx.restore()
}

// Ornate corner flourish — draws directly at absolute coords, no scale(-1) needed
// ox/oy = corner origin, sx/sy = direction (+1 or -1 for mirroring)
function drawOrnateCorner(ctx, ox, oy, size, sx, sy) {
  try {
    // Helper: map local coords to absolute
    const ax = (lx) => ox + lx * sx
    const ay = (ly) => oy + ly * sy

    ctx.save()
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.8

    // L-bracket outer
    ctx.beginPath()
    ctx.moveTo(ax(0), ay(size))
    ctx.lineTo(ax(0), ay(0))
    ctx.lineTo(ax(size), ay(0))
    ctx.stroke()

    // L-bracket inner
    ctx.beginPath()
    ctx.moveTo(ax(0), ay(size-14))
    ctx.lineTo(ax(0), ay(10))
    ctx.lineTo(ax(size-14), ay(10))
    ctx.stroke()

    // Rosette ring
    ctx.beginPath()
    ctx.arc(ax(26), ay(26), 12, 0, Math.PI*2)
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.8; ctx.stroke()

    // Rosette fill
    ctx.beginPath()
    ctx.arc(ax(26), ay(26), 5, 0, Math.PI*2)
    ctx.fillStyle = '#d97706'; ctx.globalAlpha = 1; ctx.fill()

    // Tendril along X axis
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(ax(38), ay(26))
    ctx.bezierCurveTo(ax(50),ay(26), ax(52),ay(16), ax(63),ay(15))
    ctx.bezierCurveTo(ax(70),ay(14), ax(72),ay(7),  ax(76),ay(7))
    ctx.stroke()

    // Tendril along Y axis
    ctx.beginPath()
    ctx.moveTo(ax(26), ay(38))
    ctx.bezierCurveTo(ax(26),ay(50), ax(16),ay(52), ax(15),ay(63))
    ctx.bezierCurveTo(ax(14),ay(70), ax(7), ay(72), ax(7), ay(76))
    ctx.stroke()

    // Leaf buds
    var buds = [[50,19],[64,12],[19,50],[12,64]]
    for (var b=0; b<buds.length; b++) {
      ctx.beginPath()
      ctx.arc(ax(buds[b][0]), ay(buds[b][1]), 3.5, 0, Math.PI*2)
      ctx.fillStyle = '#d97706'; ctx.globalAlpha = 0.5; ctx.fill()
    }

    // Edge dots
    for (var i=0; i<6; i++) {
      ctx.beginPath()
      ctx.arc(ax(20+i*11), ay(5), 1.8, 0, Math.PI*2)
      ctx.fillStyle = '#d97706'; ctx.globalAlpha = 0.4; ctx.fill()
      ctx.beginPath()
      ctx.arc(ax(5), ay(20+i*11), 1.8, 0, Math.PI*2)
      ctx.fill()
    }

    ctx.restore()
  } catch(e) {
    // If ornament fails for any reason, silently skip — cert still generates
    try { ctx.restore() } catch(_) {}
  }
}

// Field line with dotted leader (like physical cert)
function drawFieldLine(ctx, label, value, x, y, maxW) {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#374151'; ctx.font = '14px Georgia, serif'
  safeFill(ctx, label, x, y)
  const lw = ctx.measureText(String(label||'')).width
  ctx.strokeStyle = '#b45309'; ctx.lineWidth = 0.8; ctx.setLineDash([2,4])
  ctx.beginPath(); ctx.moveTo(x+lw+5,y+2); ctx.lineTo(x+maxW,y+2); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#0a2612'; ctx.font = 'bold 14px Georgia, serif'
  safeFill(ctx, value == null ? '—' : value, x+lw+10, y)
}

function getTitlePrefix(churchTitle, gender) {
  if (churchTitle && !['Brother','Sister'].includes(churchTitle)) return churchTitle
  return gender === 'Female' ? 'Sister' : 'Brother'
}

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']

function fmtDate(iso) {
  if (!iso) return ''
  try {
    // Parse manually to avoid timezone-shift issues with date-only strings
    const parts = iso.split('T')[0].split('-')
    const y = parseInt(parts[0]), m = parseInt(parts[1])-1, d = parseInt(parts[2])
    if (isNaN(y)||isNaN(m)||isNaN(d)) return ''
    return `${d} ${MONTHS[m]} ${y}`
  } catch(_) { return '' }
}

function fmtBirthday(iso) {
  if (!iso) return ''
  try {
    const parts = iso.split('T')[0].split('-')
    const y = parseInt(parts[0]), m = parseInt(parts[1])-1, d = parseInt(parts[2])
    if (isNaN(y)||isNaN(m)||isNaN(d)) return ''
    const s = d===1||d===21||d===31?'st':d===2||d===22?'nd':d===3||d===23?'rd':'th'
    return `${d}${s} ${MONTHS[m]} ${y}`
  } catch(_) { return '' }
}

const APP_URL = 'https://ccgm-pwa.vercel.app'
const ORDAINED = ['Deacon','Deaconess','Elder','Evangelist','Prophet','Pastor','Apostle']

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function Certificate() {
  const { user, profile, churchTitle: rawChurchTitle } = useAuth()
  const churchTitle = rawChurchTitle ?? null
  const [searchParams] = useSearchParams()
  const [adminSig, setAdminSig] = useState(null)
  const [tab, setTab] = useState(
    searchParams.get('type') === 'birth' ? 'birth' :
    searchParams.get('type') === 'id'    ? 'id'    : 'membership'
  )

  const memberCanvasRef = useRef(null)
  const birthCanvasRef  = useRef(null)
  const idCanvasRef     = useRef(null)
  const memberImgRef    = useRef(null)
  const birthImgRef     = useRef(null)
  const idImgRef        = useRef(null)

  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState('')
  const [memberDone,  setMemberDone]  = useState(false)
  const [birthDone,   setBirthDone]   = useState(false)
  const [idDone,      setIdDone]      = useState(false)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key','admin_signature').single()
      .then(({ data }) => { if (data?.value?.image) setAdminSig(data.value.image) })
  }, [])

  if (!user || !profile) return (
    <div style={{ minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:32,textAlign:'center' }}>
      <div style={{ fontSize:'3rem' }}>🏅</div>
      <h2 style={{ fontFamily:'var(--font-display)',color:'var(--brand-deep)',margin:0 }}>Members Only</h2>
      <p style={{ color:'var(--text-light)' }}>Sign in to download your certificates.</p>
      <Link to="/timeline" className="btn btn-blue">Sign In →</Link>
    </div>
  )

  // ── Derived values (all null-safe) ──────────────────────────────
  const name           = profile?.full_name || profile?.display_name || 'Member'
  const branch         = profile?.church_branch || 'CCG World'
  const gender         = profile?.gender || null
  const titlePrefix    = getTitlePrefix(churchTitle, gender)
  const displayName    = `${titlePrefix} ${name}`
  const joinDate       = fmtDate(profile?.created_at)
  const birthday       = profile?.birthday ? fmtBirthday(profile.birthday) : null
  const certId         = 'CCG-'  + (user?.id||'').slice(0,8).toUpperCase()
  const birthId        = 'CCGB-' + (user?.id||'').slice(0,8).toUpperCase()
  const today          = fmtDate(new Date().toISOString())
  const verifyUrl      = `${APP_URL}/verify?id=${certId}`
  const birthVerifyUrl = `${APP_URL}/verify?id=${birthId}`
  const hasBirthday    = !!profile?.birthday
  // ID card only for ordained posts; Brother/Sister get badge but no card
  const hasIdCard      = !!churchTitle && ORDAINED.includes(churchTitle)

  // Birth record fields — safe fallbacks if columns don't exist yet
  const fatherName   = profile?.father_name   || ''
  const motherName   = profile?.mother_name   || ''
  const placeOfBirth = profile?.place_of_birth || ''
  const hometown     = profile?.hometown      || ''
  const lga          = profile?.lga           || ''

  // ── MEMBERSHIP CERTIFICATE — A5 Landscape (1748 × 1240 px) ──────
  const generateMembership = async () => {
    if (!profile || !user) { setGenError('Profile not loaded yet — please wait and try again.'); return }
    setGenerating(true); setGenError('')
    const canvas = memberCanvasRef.current
    if (!canvas) { setGenError('Canvas not available — refresh and try again'); setGenerating(false); return }
    let _step = 'init'
    try {
    // A5 landscape at 300dpi: 210mm × 148mm = 2480 × 1748px
    // At 150dpi (screen-friendly): 1240 × 874px — scale up 1.4x for quality
    const W = 1748, H = 1240
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenError('Canvas context unavailable'); return }

    _step = 'background'
    ctx.fillStyle = '#fdf9f0'; ctx.fillRect(0,0,W,H)

    _step = 'logo-watermark'
    try {
      const logo = await loadImage('/logo.png')
      ctx.save(); ctx.globalAlpha = 0.04
      ctx.drawImage(logo, W/2-200, H/2-200, 400, 400)
      ctx.restore()
    } catch(_){}

    _step = 'border'
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 8;  ctx.strokeRect(16,16,W-32,H-32)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5; ctx.strokeRect(28,28,W-56,H-56)
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;   ctx.strokeRect(36,36,W-72,H-72)

    _step = 'ornate-corners'
    drawOrnateCorner(ctx,18,18,80,  1, 1)
    drawOrnateCorner(ctx,W-18,18,80,-1, 1)
    drawOrnateCorner(ctx,18,H-18,80, 1,-1)
    drawOrnateCorner(ctx,W-18,H-18,80,-1,-1)

    _step = 'header'
    const grad = ctx.createLinearGradient(0,0,W,0)
    grad.addColorStop(0,'#0a2612'); grad.addColorStop(1,'#166534')
    ctx.fillStyle = grad; ctx.fillRect(36,36,W-72,190)

    // Logo in header
    try { const logo = await loadImage('/logo.png'); ctx.drawImage(logo,70,52,140,140) } catch(_){}

    // Corner stripes (post indicator)
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    // Header text
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 28px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 106)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '19px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 144)
    ctx.fillStyle = '#fbbf24'; ctx.font = '16px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 174)

    // Gold divider under header
    ctx.fillStyle = '#d97706'; ctx.fillRect(36,226,W-72,3)

    _step = 'title'
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 72px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Membership', W/2, 356)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-420,378); ctx.lineTo(W/2+420,378); ctx.stroke()

    // Post badge (if titled)
    const stripes = getCapeStripes(churchTitle)
    let bodyY = 468
    if (stripes !== null) { drawCapeBadge(ctx,W,392,stripes,churchTitle); bodyY = 502 }

    // Body text
    ctx.fillStyle = '#374151'; ctx.font = 'italic 26px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('This is to certify that', W/2, bodyY)

    const yOff = bodyY - 468
    ctx.fillStyle = '#0a2612'
    let nfs = 56; ctx.font = `bold ${nfs}px Georgia, serif`
    while (ctx.measureText(displayName).width > W-300 && nfs > 28) { nfs-=2; ctx.font=`bold ${nfs}px Georgia, serif` }
    ctx.fillText(displayName, W/2, 570+yOff)
    const nw = ctx.measureText(displayName).width
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(W/2-nw/2,590+yOff); ctx.lineTo(W/2+nw/2,590+yOff); ctx.stroke()

    ctx.fillStyle = '#374151'; ctx.font = '24px Georgia, serif'
    ctx.fillText('is a recognized member of the', W/2, 648+yOff)
    ctx.fillStyle = '#166534'; ctx.font = 'bold 28px Georgia, serif'
    ctx.fillText(branch, W/2, 698+yOff)
    ctx.fillStyle = '#374151'; ctx.font = '24px Georgia, serif'
    ctx.fillText('branch of the Christian Church of God Mission', W/2, 746+yOff)
    if (joinDate) ctx.fillText('Member since ' + joinDate, W/2, 794+yOff)

    // Gold divider
    ctx.fillStyle = '#d97706'; ctx.fillRect(W/2-320,828+yOff,640,2)

    // Printed / Cert ID row
    ctx.textAlign = 'left'
    ctx.fillStyle = '#374151'; ctx.font = 'italic 18px Georgia, serif'
    ctx.fillText('Printed:', 160, 904+yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '18px Georgia, serif'
    ctx.fillText(today, 160, 928+yOff)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#374151'; ctx.font = 'italic 18px Georgia, serif'
    ctx.fillText('Certificate ID:', W-160, 904+yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '18px Georgia, serif'
    ctx.fillText(certId, W-160, 928+yOff)

    _step = 'qr-code'
    try {
      const qr = await loadImage(qrDataUrl(verifyUrl, 130))
      ctx.drawImage(qr, W/2-65, 848+yOff, 130, 130)
      ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280'; ctx.font = '13px Georgia, serif'
      ctx.fillText('Scan to verify', W/2, 994+yOff)
    } catch(_){}

    // Official stamp
    await drawStamp(ctx, W-220, 910+yOff, 210)

    // Footer
    ctx.textAlign = 'center'; ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 14px Georgia, serif'
    ctx.fillText('✦ Printed digitally by CCG World ✦', W/2, 1160+yOff)
    ctx.font = '13px Georgia, serif'
    ctx.fillText('Verify at: ' + verifyUrl, W/2, 1184+yOff)

    // Push result to visible <img> preview
    setMemberDone(true)
    setTimeout(() => { if (memberImgRef.current) memberImgRef.current.src = canvas.toDataURL('image/png') }, 50)
    } catch(e) { const msg = `[${_step}] ${e?.message || 'unknown'}`; console.error('Membership cert ERROR at step:', _step, e); setGenError(msg) }
    finally { setGenerating(false) }
  }

  // ── BIRTH CERTIFICATE — A5 Portrait (1240 × 1748 px) ─────────────
  const generateBirth = async () => {
    if (!birthday) return
    if (!profile || !user) { setGenError('Profile not loaded yet — please wait and try again.'); return }
    setGenerating(true); setGenError('')
    const canvas = birthCanvasRef.current
    if (!canvas) { setGenError('Canvas not available'); setGenerating(false); return }
    try {
    const W = 874, H = 1240
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenError('Canvas context unavailable'); return }

    // Background
    ctx.fillStyle = '#fffef5'; ctx.fillRect(0,0,W,H)

    // Logo watermark
    try {
      const logo = await loadImage('/logo.png')
      ctx.save(); ctx.globalAlpha = 0.04
      ctx.drawImage(logo, W/2-180, H/2-180, 360, 360)
      ctx.restore()
    } catch(_){}

    // Triple border
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 8;  ctx.strokeRect(14,14,W-28,H-28)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5; ctx.strokeRect(26,26,W-52,H-52)
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;   ctx.strokeRect(34,34,W-68,H-68)

    // Ornate corner flourishes
    drawOrnateCorner(ctx,16,16,80,  1, 1)
    drawOrnateCorner(ctx,W-16,16,80,-1, 1)
    drawOrnateCorner(ctx,16,H-16,80, 1,-1)
    drawOrnateCorner(ctx,W-16,H-16,80,-1,-1)

    // Side border dots
    for (let x=120;x<W-110;x+=18) {
      ctx.save(); ctx.globalAlpha=0.3
      ctx.beginPath(); ctx.arc(x,19,2,0,Math.PI*2); ctx.fillStyle='#d97706'; ctx.fill()
      ctx.beginPath(); ctx.arc(x,H-19,2,0,Math.PI*2); ctx.fill()
      ctx.restore()
    }
    for (let y=120;y<H-110;y+=18) {
      ctx.save(); ctx.globalAlpha=0.3
      ctx.beginPath(); ctx.arc(19,y,2,0,Math.PI*2); ctx.fillStyle='#d97706'; ctx.fill()
      ctx.beginPath(); ctx.arc(W-19,y,2,0,Math.PI*2); ctx.fill()
      ctx.restore()
    }

    // Header
    const grad = ctx.createLinearGradient(0,0,0,200)
    grad.addColorStop(0,'#0a2612'); grad.addColorStop(0.6,'#14532d'); grad.addColorStop(1,'#b45309')
    ctx.fillStyle = grad; ctx.fillRect(34,34,W-68,200)
    try { const logo = await loadImage('/logo.png'); ctx.drawImage(logo,60,54,130,130) } catch(_){}
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 24px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 102)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px Georgia, serif'
    ctx.fillText('(Registered in Nig. No. 451)', W/2, 126)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = '16px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 154)
    ctx.fillStyle = '#fbbf24'; ctx.font = '14px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 178)
    ctx.fillStyle = '#d97706'; ctx.fillRect(34,234,W-68,2)

    // Printed / No. row
    ctx.textAlign = 'left'; ctx.fillStyle = '#374151'; ctx.font = 'italic 15px Georgia, serif'
    ctx.fillText('Printed:', 58, 268)
    ctx.fillStyle = '#0a2612'; ctx.font = '15px Georgia, serif'; ctx.fillText(today, 138, 268)
    ctx.textAlign = 'right'; ctx.fillStyle = '#374151'; ctx.font = 'italic 15px Georgia, serif'
    ctx.fillText('No.', W-160, 268)
    ctx.fillStyle = '#0a2612'; ctx.font = '15px Georgia, serif'
    ctx.fillText(birthId.replace('CCGB-',''), W-60, 268)

    // Title
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold italic 62px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Birth', W/2, 360)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-310,382); ctx.lineTo(W/2+310,382); ctx.stroke()
    ctx.fillStyle = '#92400e'; ctx.font = 'italic 19px Georgia, serif'
    ctx.fillText('In the Name of the Lord', W/2, 416)
    ctx.fillStyle = '#374151'; ctx.font = 'italic 21px Georgia, serif'
    ctx.fillText('This is to Certify that', W/2, 458)

    // Fields
    const LX = 62, LW = W - 124
    let fy = 514

    drawFieldLine(ctx,'Name of Child...',displayName,LX,fy,LW); fy+=54
    drawFieldLine(ctx,'Date of Birth...',birthday,LX,fy,LW); fy+=54
    drawFieldLine(ctx,'Place of Birth...',placeOfBirth||'—',LX,fy,LW); fy+=70

    ctx.fillStyle = '#374151'; ctx.font = 'italic 17px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Was born by', W/2, fy); fy+=40

    drawFieldLine(ctx,"Father's Name...",fatherName||'—',LX,fy,LW); fy+=54
    drawFieldLine(ctx,"Mother's Name...",motherName||'—',LX,fy,LW); fy+=54
    drawFieldLine(ctx,'Home Town/Village...',hometown||'—',LX,fy,LW); fy+=54
    drawFieldLine(ctx,'L.G. Area/Division...',lga||'—',LX,fy,LW); fy+=54
    drawFieldLine(ctx,'Church Branch...',branch,LX,fy,LW); fy+=54
    if (churchTitle) { drawFieldLine(ctx,'Church Post...',churchTitle,LX,fy,LW); fy+=54 }

    // Divider
    fy += 12
    ctx.fillStyle = '#d97706'; ctx.fillRect(LX,fy,LW,1.5); fy+=36

    // Witness text
    ctx.fillStyle = '#374151'; ctx.font = 'italic 14px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('In witness whereof the undersigned who accepted the above particulars to be correct and true.', W/2, fy); fy+=48

    // Bottom row: Signature | QR | Stamp
    if (adminSig) {
      try { const sig = await loadImage(adminSig); ctx.drawImage(sig, LX, fy, 220, 70) } catch(_){}
    }
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(LX,fy+84); ctx.lineTo(LX+250,fy+84); ctx.stroke()
    ctx.fillStyle = '#374151'; ctx.font = 'italic 13px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Signature of Church Minister', LX+125, fy+102)

    try {
      const qr = await loadImage(qrDataUrl(birthVerifyUrl, 110))
      ctx.drawImage(qr, W/2-55, fy, 110, 110)
      ctx.fillStyle = '#6b7280'; ctx.font = '12px Georgia, serif'; ctx.textAlign = 'center'
      ctx.fillText('Scan to verify', W/2, fy+128)
    } catch(_){}

    await drawStamp(ctx, W-160, fy+68, 160)

    // Footer
    const footY = H - 56
    ctx.fillStyle = '#d97706'; ctx.fillRect(34, footY-22, W-68, 1.5)
    ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('✦ Printed digitally by CCG World ✦', W/2, footY)
    ctx.font = '12px Georgia, serif'
    ctx.fillText('Verify at: ' + birthVerifyUrl, W/2, footY+20)

    setBirthDone(true)
    setTimeout(() => { if (birthImgRef.current) birthImgRef.current.src = canvas.toDataURL('image/png') }, 50)
    } catch(e) { const msg = `[birth] ${e?.message || 'unknown'}`; console.error('Birth cert ERROR:', e); setGenError(msg) }
    finally { setGenerating(false) }
  }

  // ── ID CARD — Portrait CR80 (638 × 1012 px @ 2x) ─────────────────
  // Physical CR80: 54mm × 85.6mm
  const generateId = async () => {
    if (!profile || !user) { setGenError('Profile not loaded yet — please wait and try again.'); return }
    setGenerating(true); setGenError('')
    const canvas = idCanvasRef.current
    if (!canvas) { setGenError('Canvas not available'); setGenerating(false); return }
    try {
    const W = 638, H = 1012
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenError('Canvas context unavailable'); return }

    // Top green band (~36% height)
    const bandH = 368
    const topGrad = ctx.createLinearGradient(0,0,0,bandH)
    topGrad.addColorStop(0,'#0a2612'); topGrad.addColorStop(1,'#166534')
    ctx.fillStyle = topGrad; ctx.fillRect(0,0,W,bandH)
    // White lower body
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,bandH,W,H-bandH)

    // Gold border
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 5; ctx.strokeRect(5,5,W-10,H-10)
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(11,11,W-22,H-22)

    // Cape stripes — top-right corner
    const stripes = getCapeStripes(churchTitle)
    if (stripes !== null) {
      ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 7; ctx.lineCap = 'round'
      if (stripes >= 1) { ctx.beginPath(); ctx.moveTo(W-68,8); ctx.lineTo(W-8,68); ctx.stroke() }
      if (stripes === 2) { ctx.beginPath(); ctx.moveTo(W-40,8); ctx.lineTo(W-8,40); ctx.stroke() }
      ctx.restore()
    }

    // Logo top-centre
    try {
      const logo = await loadImage('/logo.png')
      ctx.drawImage(logo, W/2-40, 22, 80, 80)
    } catch(_){}

    // Church name
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH', W/2, 120)
    ctx.fillText('OF GOD MISSION', W/2, 139)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px Georgia, serif'
    ctx.fillText('Official Member ID', W/2, 158)

    // Avatar — centred, large
    const avX = W/2, avY = 272, avR = 90
    ctx.save()
    // Gold ring shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14
    ctx.beginPath(); ctx.arc(avX,avY,avR+5,0,Math.PI*2)
    ctx.fillStyle = '#d97706'; ctx.fill()
    ctx.shadowBlur = 0

    if (profile.avatar_url) {
      try {
        const av = await loadImage(profile.avatar_url)
        ctx.beginPath(); ctx.arc(avX,avY,avR,0,Math.PI*2); ctx.clip()
        ctx.drawImage(av, avX-avR, avY-avR, avR*2, avR*2)
      } catch(_) {
        ctx.beginPath(); ctx.arc(avX,avY,avR,0,Math.PI*2)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill()
        ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${avR}px Georgia, serif`; ctx.textAlign = 'center'
        ctx.fillText(name.charAt(0).toUpperCase(), avX, avY + avR*0.36)
      }
    } else {
      ctx.beginPath(); ctx.arc(avX,avY,avR,0,Math.PI*2)
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill()
      ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${avR}px Georgia, serif`; ctx.textAlign = 'center'
      ctx.fillText(name.charAt(0).toUpperCase(), avX, avY + avR*0.36)
    }
    ctx.restore()

    // Post badge — straddles band/body divide
    const badgeY = bandH - 22
    ctx.fillStyle = '#d97706'
    roundRect(ctx, W/2-90,badgeY,180,34,17); ctx.fill()
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText((churchTitle||'Member').toUpperCase(), W/2, badgeY+22)

    // White body — member details
    const dy = bandH + 32
    ctx.textAlign = 'center'

    // Name
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px Georgia, serif'
    ctx.fillText('FULL NAME', W/2, dy)
    ctx.fillStyle = '#0a2612'
    let nfs2 = 22; ctx.font = `bold ${nfs2}px Georgia, serif`
    while (ctx.measureText(name).width > W-48 && nfs2 > 12) { nfs2--; ctx.font=`bold ${nfs2}px Georgia, serif` }
    ctx.fillText(name, W/2, dy+22)

    // Divider
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(44,dy+38); ctx.lineTo(W-44,dy+38); ctx.stroke()

    // Branch
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px Georgia, serif'
    ctx.fillText('BRANCH', W/2, dy+60)
    ctx.fillStyle = '#166534'; ctx.font = 'bold 16px Georgia, serif'
    ctx.fillText(branch, W/2, dy+80)

    ctx.beginPath(); ctx.moveTo(44,dy+96); ctx.lineTo(W-44,dy+96); ctx.stroke()

    // Member since (left) / Birthday (right)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px Georgia, serif'
    ctx.fillText('MEMBER SINCE', 48, dy+118)
    ctx.fillStyle = '#111827'; ctx.font = '13px Georgia, serif'
    ctx.fillText(joinDate, 48, dy+136)

    if (birthday) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px Georgia, serif'
      ctx.fillText('DATE OF BIRTH', W-48, dy+118)
      ctx.fillStyle = '#111827'; ctx.font = '13px Georgia, serif'
      ctx.fillText(birthday, W-48, dy+136)
    }

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(44,dy+152); ctx.lineTo(W-44,dy+152); ctx.stroke()

    // QR code — centred
    try {
      const qr = await loadImage(qrDataUrl(verifyUrl, 120))
      ctx.drawImage(qr, W/2-60, dy+168, 120, 120)
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px Georgia, serif'; ctx.textAlign = 'center'
      ctx.fillText('Scan to verify membership', W/2, dy+300)
    } catch(_){}

    // Member ID bottom strip
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0,H-80,W,80)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0,H-80); ctx.lineTo(W,H-80); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px Georgia, serif'
    ctx.fillText('MEMBER ID', W/2, H-56)
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 17px Georgia, serif'
    ctx.fillText(certId, W/2, H-34)
    ctx.fillStyle = '#9ca3af'; ctx.font = '9px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, H-14)

    setIdDone(true)
    setTimeout(() => { if (idImgRef.current) idImgRef.current.src = canvas.toDataURL('image/png') }, 50)
    } catch(e) { const msg = `[id-card] ${e?.message || 'unknown'}`; console.error('ID card ERROR:', e); setGenError(msg) }
    finally { setGenerating(false) }
  }

  // ── Download helper ────────────────────────────────────────────
  const download = (ref, filename) => {
    const a = document.createElement('a')
    a.download = filename; a.href = ref.current.toDataURL('image/png'); a.click()
  }

  // ── Tabs ───────────────────────────────────────────────────────
  const tabs = [
    { key:'membership', label:'🏅 Membership' },
    { key:'birth',      label:'🎂 Birth' },
    ...(hasIdCard ? [{ key:'id', label:'🪪 ID Card' }] : []),
  ]

  const TabBtn = ({ k }) => (
    <button onClick={() => setTab(k)} style={{
      padding:'10px 22px', borderRadius:30, border:'none', cursor:'pointer',
      fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.86rem',
      background: tab===k ? 'var(--brand-mid)' : '#f1f5f9',
      color: tab===k ? 'white' : 'var(--text-mid)', transition:'all 0.2s'
    }}>{tabs.find(t=>t.key===k)?.label ?? k}</button>
  )

  const GenBtn = ({ onClick, disabled, label, color='var(--brand-mid)' }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'12px 28px', borderRadius:40, border:'none',
      background: disabled ? '#9ca3af' : `linear-gradient(135deg,${color},var(--brand-mid))`,
      color:'white', fontWeight:700, cursor: disabled?'not-allowed':'pointer',
      fontFamily:'var(--font-body)'
    }}>{label}</button>
  )

  const RegenBtn = ({ onClick }) => (
    <button onClick={onClick} style={{
      padding:'12px 20px', borderRadius:40, border:'1.5px solid #e2e8f0',
      background:'transparent', color:'var(--text-mid)', fontWeight:600,
      cursor:'pointer', fontFamily:'var(--font-body)'
    }}>🔄 Regenerate</button>
  )

  const InfoGrid = ({ items }) => (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
      {items.map(([l,v]) => (
        <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'11px 14px' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
          <div style={{ color:'var(--text-dark)', fontWeight:600, fontSize:'0.9rem' }}>{v}</div>
        </div>
      ))}
    </div>
  )

  const Preview = ({ done, canvasRef, placeholder, emoji }) => (
    <>
      <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0', display:done?'block':'none' }}>
        <canvas ref={canvasRef} style={{ width:'100%', display:'block' }} />
      </div>
      {!done && (
        <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)' }}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>{emoji}</div>
          <div>{placeholder}</div>
        </div>
      )}
    </>
  )

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'clamp(80px,12vw,110px) 5% 48px', textAlign:'center' }}>
        <span className="section-label">Member Recognition</span>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3rem)', color:'white', margin:'8px 0 12px' }}>
          🏅 My Certificates
        </h1>
        <p style={{ color:'rgba(255,255,255,0.7)', maxWidth:520, margin:'0 auto', lineHeight:1.8 }}>
          Download your official CCG World certificates{hasIdCard ? ' and ID card' : ''} with QR verification.
        </p>
      </div>

      {/* Hidden canvases — always mounted so refs are always valid */}
      <div style={{ position:'absolute', left:'-9999px', top:0, pointerEvents:'none', visibility:'hidden' }}>
        <canvas ref={memberCanvasRef} />
        <canvas ref={birthCanvasRef} />
        <canvas ref={idCanvasRef} />
      </div>

      <div className="container" style={{ maxWidth:900, padding:'40px 5% 80px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:10, marginBottom:32, flexWrap:'wrap' }}>
          {tabs.map(t => <TabBtn key={t.key} k={t.key} />)}
        </div>

        {/* Generation error banner */}
        {genError && (
          <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:12, padding:'12px 18px', color:'#dc2626', fontSize:'0.88rem', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
            ❌ <span>{genError}</span>
            <button onClick={() => setGenError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'1rem' }}>✕</button>
          </div>
        )}

        {/* ── MEMBERSHIP ── */}
        {tab === 'membership' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 16px' }}>Certificate Details</h3>
              <InfoGrid items={[
                ['👤 Name', displayName],
                ['⛪ Branch', branch],
                ['📅 Member Since', joinDate||'N/A'],
                ['🔖 Certificate ID', certId],
                ...(churchTitle ? [['✝️ Post', churchTitle]] : []),
              ]} />
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {!memberDone
                ? <GenBtn onClick={generateMembership} disabled={generating} label={generating?'⏳ Generating…':'🏅 Generate Certificate'} />
                : <><GenBtn onClick={() => download(memberCanvasRef,'CCG-Membership-'+name.replace(/\s+/g,'-')+'.png')} disabled={false} label="⬇️ Download PNG" /><RegenBtn onClick={() => { setMemberDone(false); generateMembership() }} /></>
              }
            </div>
            {memberDone && (
              <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0' }}>
                <img ref={memberImgRef} style={{ width:'100%', display:'block' }} alt="Membership Certificate" />
              </div>
            )}
            {!memberDone && (
              <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>🏅</div>
                <div>Click "Generate Certificate" to preview and download</div>
              </div>
            )}
          </div>
        )}

        {/* ── BIRTH ── */}
        {tab === 'birth' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {!hasBirthday ? (
              <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:16, padding:'36px 28px', textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🎂</div>
                <h3 style={{ fontFamily:'var(--font-display)', color:'#92400e', margin:'0 0 10px' }}>Birthday Not Set</h3>
                <p style={{ color:'#78350f', lineHeight:1.7, marginBottom:20, fontSize:'0.92rem' }}>Add your birthday in your profile to generate this certificate.</p>
                <Link to="/profile" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:30, background:'var(--brand-base)', color:'white', fontWeight:700, fontSize:'0.88rem', textDecoration:'none' }}>Add Birthday in Profile →</Link>
              </div>
            ) : (
              <>
                <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
                  <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 16px' }}>Certificate Details</h3>
                  <InfoGrid items={[
                    ['👤 Name', displayName],
                    ['🎂 Birthday', birthday||''],
                    ['⛪ Branch', branch],
                    ['🔖 Certificate ID', birthId],
                  ]} />
                  {!adminSig && (
                    <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'10px 14px', marginTop:14, fontSize:'0.83rem', color:'#92400e' }}>
                      ⚠️ No admin signature uploaded yet. Ask your admin to upload one in the admin panel.
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {!birthDone
                    ? <GenBtn onClick={generateBirth} disabled={generating} label={generating?'⏳ Generating…':'🎂 Generate Birth Certificate'} color="#b45309" />
                    : <><GenBtn onClick={() => download(birthCanvasRef,'CCG-Birth-Certificate-'+name.replace(/\s+/g,'-')+'.png')} disabled={false} label="⬇️ Download PNG" color="#b45309" /><RegenBtn onClick={() => { setBirthDone(false); generateBirth() }} /></>
                  }
                </div>
                {birthDone && (
                  <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0' }}>
                    <img ref={birthImgRef} style={{ width:'100%', display:'block' }} alt="Birth Certificate" />
                  </div>
                )}
                {!birthDone && (
                  <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)' }}>
                    <div style={{ fontSize:'3rem', marginBottom:12 }}>🎂</div>
                    <div>Click "Generate Birth Certificate" to preview and download</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ID CARD (ordained posts only) ── */}
        {tab === 'id' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 8px' }}>🪪 Church ID Card</h3>
              <p style={{ color:'var(--text-mid)', fontSize:'0.88rem', marginBottom:16 }}>Portrait credit-card sized ID (CR80 standard) — print and laminate for use.</p>
              <InfoGrid items={[
                ['👤 Name', name],
                ['✝️ Post', churchTitle||''],
                ['⛪ Branch', branch],
                ['🔖 Member ID', certId],
              ]} />
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {!idDone
                ? <GenBtn onClick={generateId} disabled={generating} label={generating?'⏳ Generating…':'🪪 Generate ID Card'} />
                : <><GenBtn onClick={() => download(idCanvasRef,'CCG-ID-'+name.replace(/\s+/g,'-')+'.png')} disabled={false} label="⬇️ Download ID Card" /><RegenBtn onClick={() => { setIdDone(false); generateId() }} /></>
              }
            </div>
            <div style={{ maxWidth:360 }}>
              {idDone && (
                <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0' }}>
                  <img ref={idImgRef} style={{ width:'100%', display:'block' }} alt="ID Card" />
                </div>
              )}
              {!idDone && (
                <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)' }}>
                  <div style={{ fontSize:'3rem', marginBottom:12 }}>🪪</div>
                  <div>Click "Generate ID Card" to preview and download</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
