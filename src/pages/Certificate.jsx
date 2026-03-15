import { useRef, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import supabase from '../lib/supabase'

function qrDataUrl(text, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=8`
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
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

function getCapeStripes(churchTitle) {
  if (!churchTitle) return null
  if (churchTitle === 'Apostle') return 2
  if (churchTitle === 'Elder') return 1
  return ['Pastor','Evangelist','Deacon','Deaconess','Prophet'].includes(churchTitle) ? 0 : null
}

function drawCapeBadge(ctx, W, y, stripes, churchTitle) {
  const bandH = 38, bandW = 320, x = (W - bandW) / 2
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x, y, bandW, bandH, 6)
  ctx.fillStyle = '#166534'; ctx.fill()
  if (stripes >= 1) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3
    const y1 = stripes === 2 ? y+12 : y+bandH/2
    ctx.beginPath(); ctx.moveTo(x+20,y1); ctx.lineTo(x+bandW-20,y1); ctx.stroke()
  }
  if (stripes === 2) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x+20,y+26); ctx.lineTo(x+bandW-20,y+26); ctx.stroke()
  }
  ctx.fillStyle = stripes > 0 ? '#fbbf24' : 'rgba(255,255,255,0.9)'
  ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center'
  ctx.fillText(churchTitle.toUpperCase(), W/2, y+bandH/2+5)
  ctx.restore()
}

function drawCornerStripes(ctx, W, stripes) {
  if (stripes === null) return
  ctx.save()
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.lineCap = 'round'
  if (stripes >= 1) {
    ctx.beginPath(); ctx.moveTo(W-36-55,30); ctx.lineTo(W-36,30+55); ctx.stroke()
  }
  if (stripes === 2) {
    ctx.beginPath(); ctx.moveTo(W-36-30,30); ctx.lineTo(W-36,30+30); ctx.stroke()
  }
  ctx.restore()
}

function drawCornerOrnament(ctx, x, y, size, flipX, flipY) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6
  ctx.beginPath(); ctx.moveTo(0,size); ctx.lineTo(0,0); ctx.lineTo(size,0); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0,size-14); ctx.bezierCurveTo(0,size-32,22,size-32,22,size-16); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(size-14,0); ctx.bezierCurveTo(size-32,0,size-32,22,size-16,22); ctx.stroke()
  ctx.beginPath(); ctx.arc(9,9,3,0,Math.PI*2)
  ctx.fillStyle = '#d97706'; ctx.fill()
  ctx.restore()
}

function drawFieldLine(ctx, label, value, x, y, lineW) {
  const lf = '14px Georgia, serif'
  const vf = 'bold 14px Georgia, serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#374151'; ctx.font = lf
  ctx.fillText(label, x, y)
  const lw = ctx.measureText(label).width
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 0.8; ctx.setLineDash([2,4])
  ctx.beginPath(); ctx.moveTo(x+lw+6, y+2); ctx.lineTo(x+lineW, y+2); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#0a2612'; ctx.font = vf
  ctx.fillText(value, x+lw+12, y)
}

function getTitlePrefix(churchTitle, gender) {
  if (churchTitle && !['Brother','Sister'].includes(churchTitle)) return churchTitle
  return gender === 'Female' ? 'Sister' : 'Brother'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
}
function fmtBirthday(iso) {
  if (!iso) return ''
  const d = new Date(iso), day = d.getDate()
  const s = day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th'
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }).replace(/^\d+/, day+s)
}

const APP_URL = 'https://ccgm-pwa.vercel.app'

export default function Certificate() {
  const { user, profile, churchTitle } = useAuth()
  const [searchParams] = useSearchParams()
  const [adminSig, setAdminSig] = useState(null)
  const [tab, setTab] = useState(
    searchParams.get('type') === 'birth' ? 'birth' :
    searchParams.get('type') === 'id' ? 'id' : 'membership'
  )

  const memberCanvasRef = useRef(null)
  const birthCanvasRef  = useRef(null)
  const idCanvasRef     = useRef(null)

  const [generating, setGenerating] = useState(false)
  const [memberDone,  setMemberDone]  = useState(false)
  const [birthDone,   setBirthDone]   = useState(false)
  const [idDone,      setIdDone]      = useState(false)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key','admin_signature').single()
      .then(({ data }) => { if (data?.value?.image) setAdminSig(data.value.image) })
  }, [])

  if (!user || !profile) return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:32, textAlign:'center' }}>
      <div style={{ fontSize:'3rem' }}>🏅</div>
      <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:0 }}>Members Only</h2>
      <p style={{ color:'var(--text-light)' }}>Sign in to download your certificates.</p>
      <Link to="/timeline" className="btn btn-blue">Sign In →</Link>
    </div>
  )

  const name        = profile.full_name || profile.display_name || 'Member'
  const branch      = profile.church_branch || 'CCG World'
  const gender      = profile.gender || null
  const titlePrefix = getTitlePrefix(churchTitle, gender)
  const displayName = `${titlePrefix} ${name}`
  const joinDate    = fmtDate(profile.created_at)
  const birthday    = profile.birthday ? fmtBirthday(profile.birthday) : null
  const certId      = 'CCG-' + (user.id||'').slice(0,8).toUpperCase()
  const birthId     = 'CCGB-' + (user.id||'').slice(0,8).toUpperCase()
  const today       = fmtDate(new Date().toISOString())
  const verifyUrl   = APP_URL + '/verify?id=' + certId
  const birthVerifyUrl = APP_URL + '/verify?id=' + birthId
  const hasPost     = !!churchTitle
  const hasBirthday = !!profile.birthday
  // Birth record fields
  const fatherName    = profile.father_name || ''
  const motherName    = profile.mother_name || ''
  const placeOfBirth  = profile.place_of_birth || ''
  const hometown      = profile.hometown || ''
  const lga           = profile.lga || ''

  // ── MEMBERSHIP CERTIFICATE ────────────────────────────────────────
  const generateMembership = async () => {
    setGenerating(true)
    const canvas = memberCanvasRef.current
    const W = 1200, H = 850
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#fdf9f0'; ctx.fillRect(0,0,W,H)

    // Logo watermark
    try {
      const logo = await loadImage('/logo.png')
      ctx.save(); ctx.globalAlpha = 0.045
      ctx.drawImage(logo, W/2-155, H/2-155, 310, 310)
      ctx.restore()
    } catch(_){}

    // Ornate border overlay (landscape version)
    try {
      const border = await loadImage('/cert_border_land.png')
      ctx.drawImage(border, 0, 0, W, H)
    } catch(_) {
      ctx.strokeStyle = '#b45309'; ctx.lineWidth = 6; ctx.strokeRect(18,18,W-36,H-36)
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2; ctx.strokeRect(30,30,W-60,H-60)
    }

    // Header
    const grad = ctx.createLinearGradient(0,0,W,130)
    grad.addColorStop(0,'#0a2612'); grad.addColorStop(1,'#166534')
    ctx.fillStyle = grad; ctx.fillRect(30,30,W-60,130)
    try { const logo = await loadImage('/logo.png'); ctx.drawImage(logo,56,42,106,106) } catch(_){}
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 21px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 78)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '15px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 108)
    ctx.fillStyle = '#fbbf24'; ctx.font = '13px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 130)
    ctx.fillStyle = '#d97706'; ctx.fillRect(30,160,W-60,3)

    // Title
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 50px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Membership', W/2, 252)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(W/2-280,270); ctx.lineTo(W/2+280,270); ctx.stroke()

    const stripes = getCapeStripes(churchTitle)
    let bodyY = 318
    if (stripes !== null) { drawCapeBadge(ctx,W,282,stripes,churchTitle); bodyY = 346 }

    ctx.fillStyle = '#374151'; ctx.font = 'italic 21px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('This is to certify that', W/2, bodyY)
    const yOff = bodyY - 318

    ctx.fillStyle = '#0a2612'
    let nfs = 44; ctx.font = `bold ${nfs}px Georgia, serif`
    while (ctx.measureText(displayName).width > W-240 && nfs > 24) { nfs-=2; ctx.font=`bold ${nfs}px Georgia, serif` }
    ctx.fillText(displayName, W/2, 384+yOff)
    const nw = ctx.measureText(displayName).width
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-nw/2,398+yOff); ctx.lineTo(W/2+nw/2,398+yOff); ctx.stroke()
    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('is a recognized member of the', W/2, 442+yOff)
    ctx.fillStyle = '#166534'; ctx.font = 'bold 23px Georgia, serif'
    ctx.fillText(branch, W/2, 478+yOff)
    ctx.fillStyle = '#374151'; ctx.font = '20px Georgia, serif'
    ctx.fillText('branch of the Christian Church of God Mission', W/2, 512+yOff)
    if (joinDate) ctx.fillText('Member since ' + joinDate, W/2, 546+yOff)
    ctx.fillStyle = '#d97706'; ctx.fillRect(W/2-180,574+yOff,360,2)

    // Printed / Cert ID
    ctx.textAlign = 'left'; ctx.fillStyle = '#374151'; ctx.font = 'italic 16px Georgia, serif'
    ctx.fillText('Printed:', 120, 640+yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '16px Georgia, serif'; ctx.fillText(today, 120, 660+yOff)
    ctx.textAlign = 'right'; ctx.fillStyle = '#374151'; ctx.font = 'italic 16px Georgia, serif'
    ctx.fillText('Certificate ID:', W-120, 640+yOff)
    ctx.fillStyle = '#0a2612'; ctx.font = '16px Georgia, serif'; ctx.fillText(certId, W-120, 660+yOff)

    try {
      const qr = await loadImage(qrDataUrl(verifyUrl,110))
      ctx.drawImage(qr, W/2-55, 600+yOff, 110, 110)
      ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280'; ctx.font = '11px Georgia, serif'
      ctx.fillText('Scan to verify', W/2, 722+yOff)
    } catch(_){}

    await drawStamp(ctx, W-160, 680+yOff, 155)

    ctx.textAlign = 'center'; ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 12px Georgia, serif'
    ctx.fillText('✦ Printed digitally by CCG World ✦', W/2, 790+yOff)
    ctx.font = '11px Georgia, serif'
    ctx.fillText('Verify at: ' + verifyUrl, W/2, 810+yOff)

    setGenerating(false); setMemberDone(true)
  }

  // ── BIRTH CERTIFICATE (portrait A4, physical layout + ornate border) ─────
  const generateBirth = async () => {
    if (!birthday) return
    setGenerating(true)
    const canvas = birthCanvasRef.current
    const W = 850, H = 1200
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#fffef5'; ctx.fillRect(0,0,W,H)

    // Logo watermark
    try {
      const logo = await loadImage('/logo.png')
      ctx.save(); ctx.globalAlpha = 0.04
      ctx.drawImage(logo, W/2-140, H/2-140, 280, 280)
      ctx.restore()
    } catch(_){}

    // Outer gold frames
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 8; ctx.strokeRect(12,12,W-24,H-24)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3; ctx.strokeRect(22,22,W-44,H-44)
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(28,28,W-56,H-56)

    // Ornate corner flourishes
    const drawOrnateCorner = (x, y, fx, fy) => {
      ctx.save()
      ctx.translate(x, y); ctx.scale(fx, fy)
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.moveTo(0,72); ctx.lineTo(0,0); ctx.lineTo(72,0); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0,60); ctx.lineTo(0,10); ctx.lineTo(60,10); ctx.stroke()
      // Rosette
      ctx.beginPath(); ctx.arc(24,24,11,0,Math.PI*2)
      ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.beginPath(); ctx.arc(24,24,5,0,Math.PI*2)
      ctx.fillStyle = '#d97706'; ctx.globalAlpha = 1; ctx.fill()
      // Tendrils
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85
      ctx.beginPath(); ctx.moveTo(35,24)
      ctx.bezierCurveTo(46,24,48,15,58,14)
      ctx.bezierCurveTo(65,13,66,7,70,7); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(24,35)
      ctx.bezierCurveTo(24,46,15,48,14,58)
      ctx.bezierCurveTo(13,65,7,66,7,70); ctx.stroke()
      // Leaf buds
      [[46,18],[60,11],[18,46],[11,60]].forEach(([bx,by]) => {
        ctx.save(); ctx.globalAlpha = 0.55
        ctx.beginPath(); ctx.ellipse(bx,by,3,5,Math.PI/4,0,Math.PI*2)
        ctx.fillStyle = '#d97706'; ctx.fill(); ctx.restore()
      })
      // Filigree dots along edges
      for (let i=0;i<5;i++) {
        ctx.beginPath(); ctx.arc(18+i*12,5,1.5,0,Math.PI*2)
        ctx.fillStyle='#d97706'; ctx.globalAlpha=0.45; ctx.fill()
        ctx.beginPath(); ctx.arc(5,18+i*12,1.5,0,Math.PI*2); ctx.fill()
      }
      ctx.restore()
    }
    drawOrnateCorner(14,14,1,1); drawOrnateCorner(W-14,14,-1,1)
    drawOrnateCorner(14,H-14,1,-1); drawOrnateCorner(W-14,H-14,-1,-1)

    // Side border dots
    for (let x=100;x<W-90;x+=16) {
      ctx.save(); ctx.globalAlpha=0.3
      ctx.beginPath(); ctx.arc(x,17,1.8,0,Math.PI*2)
      ctx.fillStyle='#d97706'; ctx.fill()
      ctx.beginPath(); ctx.arc(x,H-17,1.8,0,Math.PI*2); ctx.fill()
      ctx.restore()
    }
    for (let y=100;y<H-90;y+=16) {
      ctx.save(); ctx.globalAlpha=0.3
      ctx.beginPath(); ctx.arc(17,y,1.8,0,Math.PI*2)
      ctx.fillStyle='#d97706'; ctx.fill()
      ctx.beginPath(); ctx.arc(W-17,y,1.8,0,Math.PI*2); ctx.fill()
      ctx.restore()
    }

    // Header
    const grad = ctx.createLinearGradient(0,0,0,155)
    grad.addColorStop(0,'#0a2612'); grad.addColorStop(0.6,'#14532d'); grad.addColorStop(1,'#b45309')
    ctx.fillStyle = grad; ctx.fillRect(32,32,W-64,148)
    try { const logo = await loadImage('/logo.png'); ctx.drawImage(logo,50,46,100,100) } catch(_){}
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 19px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 82)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px Georgia, serif'
    ctx.fillText('(Registered in Nig. No. 451)', W/2, 100)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '13px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 120)
    ctx.fillStyle = '#fbbf24'; ctx.font = '12px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 140)
    ctx.fillStyle = '#d97706'; ctx.fillRect(32,180,W-64,2)

    // Printed / No.
    ctx.textAlign='left'; ctx.fillStyle='#374151'; ctx.font='italic 13px Georgia, serif'
    ctx.fillText('Printed:', 50, 212)
    ctx.fillStyle='#0a2612'; ctx.font='13px Georgia, serif'; ctx.fillText(today, 118, 212)
    ctx.textAlign='right'; ctx.fillStyle='#374151'; ctx.font='italic 13px Georgia, serif'
    ctx.fillText('No.', W-130, 212)
    ctx.fillStyle='#0a2612'; ctx.font='13px Georgia, serif'
    ctx.fillText(birthId.replace('CCGB-',''), W-50, 212)

    // Title
    ctx.fillStyle='#0a2612'; ctx.font='bold italic 46px Georgia, serif'; ctx.textAlign='center'
    ctx.fillText('Certificate of Birth', W/2, 278)
    ctx.strokeStyle='#d97706'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(W/2-220,296); ctx.lineTo(W/2+220,296); ctx.stroke()
    ctx.fillStyle='#92400e'; ctx.font='italic 15px Georgia, serif'
    ctx.fillText('In the Name of the Lord', W/2, 322)
    ctx.fillStyle='#374151'; ctx.font='italic 17px Georgia, serif'
    ctx.fillText('This is to Certify that', W/2, 356)

    // Fields
    const LX=50, LW=W-100; let fy=404
    drawFieldLine(ctx,'Name of Child...',displayName,LX,fy,LW); fy+=44
    drawFieldLine(ctx,'Date of Birth...',birthday,LX,fy,LW); fy+=44
    drawFieldLine(ctx,'Place of Birth...',placeOfBirth||'—',LX,fy,LW); fy+=54

    ctx.fillStyle='#374151'; ctx.font='italic 14px Georgia, serif'; ctx.textAlign='center'
    ctx.fillText('Was born by', W/2, fy); fy+=32

    drawFieldLine(ctx,"Father's Name...",fatherName||'—',LX,fy,LW); fy+=44
    drawFieldLine(ctx,"Mother's Name...",motherName||'—',LX,fy,LW); fy+=44
    drawFieldLine(ctx,'Home Town/Village...',hometown||'—',LX,fy,LW); fy+=44
    drawFieldLine(ctx,'L.G. Area/Division...',lga||'—',LX,fy,LW); fy+=44
    drawFieldLine(ctx,'Church Branch...',branch,LX,fy,LW); fy+=44
    if (churchTitle) { drawFieldLine(ctx,'Church Post...',churchTitle,LX,fy,LW); fy+=44 }

    fy+=8; ctx.fillStyle='#d97706'; ctx.fillRect(LX,fy,LW,1.5); fy+=28

    ctx.fillStyle='#374151'; ctx.font='italic 12px Georgia, serif'; ctx.textAlign='center'
    ctx.fillText('In witness whereof the undersigned who accepted the above particulars to be correct and true.',W/2,fy); fy+=40

    if (adminSig) {
      try { const sig=await loadImage(adminSig); ctx.drawImage(sig,LX,fy,180,56) } catch(_){}
    }
    ctx.strokeStyle='#d97706'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(LX,fy+68); ctx.lineTo(LX+200,fy+68); ctx.stroke()
    ctx.fillStyle='#374151'; ctx.font='italic 11px Georgia, serif'; ctx.textAlign='center'
    ctx.fillText('Signature of Church Minister', LX+100, fy+84)

    try {
      const qr=await loadImage(qrDataUrl(birthVerifyUrl,90))
      ctx.drawImage(qr, W/2-45, fy, 90, 90)
      ctx.fillStyle='#6b7280'; ctx.font='10px Georgia, serif'; ctx.textAlign='center'
      ctx.fillText('Scan to verify', W/2, fy+106)
    } catch(_){}

    await drawStamp(ctx, W-110, fy+55, 130)

    const footY=H-44
    ctx.fillStyle='#d97706'; ctx.fillRect(32,footY-18,W-64,1)
    ctx.fillStyle='#9ca3af'; ctx.font='bold 11px Georgia, serif'; ctx.textAlign='center'
    ctx.fillText('✶ Printed digitally by CCG World ✶', W/2, footY)
    ctx.font='10px Georgia, serif'
    ctx.fillText('Verify at: '+birthVerifyUrl, W/2, footY+16)

    setGenerating(false); setBirthDone(true)
  }

  // ── ID CARD (credit card landscape 856×540) ───────────────────────
  const generateId = async () => {
    setGenerating(true)
    const canvas = idCanvasRef.current
    const W = 856, H = 540
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    const bg = ctx.createLinearGradient(0,0,W,H)
    bg.addColorStop(0,'#0a2612'); bg.addColorStop(0.6,'#14532d'); bg.addColorStop(1,'#1a4a28')
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H)

    // Watermark
    try {
      const logo = await loadImage('/logo.png')
      ctx.save(); ctx.globalAlpha = 0.07
      ctx.drawImage(logo, W-260, H/2-130, 260, 260)
      ctx.restore()
    } catch(_){}

    // Border
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 4; ctx.strokeRect(6,6,W-12,H-12)
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(12,12,W-24,H-24)

    // Cape stripes corner
    const stripes = getCapeStripes(churchTitle)
    if (stripes !== null) {
      ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5; ctx.lineCap = 'round'
      if (stripes >= 1) { ctx.beginPath(); ctx.moveTo(W-60,6); ctx.lineTo(W-6,60); ctx.stroke() }
      if (stripes === 2) { ctx.beginPath(); ctx.moveTo(W-36,6); ctx.lineTo(W-6,36); ctx.stroke() }
      ctx.restore()
    }

    // Logo + church name top-left
    try { const logo = await loadImage('/logo.png'); ctx.drawImage(logo,30,28,88,88) } catch(_){}
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'left'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', 130, 54)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px Georgia, serif'
    ctx.fillText('Official Member Identification Card', 130, 72)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', 130, 90)

    // Horizontal divider
    ctx.strokeStyle = 'rgba(217,119,6,0.5)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(30,128); ctx.lineTo(W-30,128); ctx.stroke()

    // Avatar circle
    const avX = 78, avY = 240, avR = 72
    ctx.save()
    ctx.beginPath(); ctx.arc(avX,avY,avR,0,Math.PI*2)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill()
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3; ctx.stroke()
    if (profile.avatar_url) {
      try {
        const av = await loadImage(profile.avatar_url)
        ctx.beginPath(); ctx.arc(avX,avY,avR-2,0,Math.PI*2); ctx.clip()
        ctx.drawImage(av, avX-avR, avY-avR, avR*2, avR*2)
      } catch(_) {
        ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${avR}px Georgia, serif`; ctx.textAlign = 'center'
        ctx.fillText(name.charAt(0).toUpperCase(), avX, avY+avR*0.35)
      }
    } else {
      ctx.fillStyle = '#fbbf24'; ctx.font = `bold ${avR}px Georgia, serif`; ctx.textAlign = 'center'
      ctx.fillText(name.charAt(0).toUpperCase(), avX, avY+avR*0.35)
    }
    ctx.restore()

    // Post badge under avatar
    if (churchTitle) {
      const bY = avY+avR+18
      ctx.fillStyle = '#d97706'
      ctx.beginPath(); ctx.roundRect(avX-58,bY,116,26,13); ctx.fill()
      ctx.fillStyle = '#0a2612'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center'
      ctx.fillText(churchTitle.toUpperCase(), avX, bY+17)
    }

    // Details
    const dx = 172
    ctx.textAlign = 'left'

    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px Georgia, serif'
    ctx.fillText('FULL NAME', dx, 152)
    ctx.fillStyle = 'white'
    let nfs2 = 22; ctx.font = `bold ${nfs2}px Georgia, serif`
    while (ctx.measureText(name).width > W-dx-40 && nfs2 > 13) { nfs2--; ctx.font=`bold ${nfs2}px Georgia, serif` }
    ctx.fillText(name, dx, 174)

    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px Georgia, serif'
    ctx.fillText('BRANCH', dx, 208)
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px Georgia, serif'
    ctx.fillText(branch, dx, 228)

    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px Georgia, serif'
    ctx.fillText('MEMBER SINCE', dx, 262)
    ctx.fillStyle = 'white'; ctx.font = '14px Georgia, serif'
    ctx.fillText(joinDate, dx, 280)

    if (birthday) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px Georgia, serif'
      ctx.fillText('DATE OF BIRTH', dx, 314)
      ctx.fillStyle = 'white'; ctx.font = '14px Georgia, serif'
      ctx.fillText(birthday, dx, 332)
    }

    // Bottom strip
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0,H-90,W,90)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0,H-90); ctx.lineTo(W,H-90); ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px Georgia, serif'
    ctx.fillText('MEMBER ID', 30, H-62)
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 16px Georgia, serif'
    ctx.fillText(certId, 30, H-42)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', 30, H-22)

    try {
      const qr = await loadImage(qrDataUrl(verifyUrl,72))
      ctx.drawImage(qr, W-102, H-88, 72, 72)
    } catch(_){}

    // Gender dot
    ctx.beginPath(); ctx.arc(W-120,H-46,5,0,Math.PI*2)
    ctx.fillStyle = gender==='Female'?'#f9a8d4':'#93c5fd'; ctx.fill()

    setGenerating(false); setIdDone(true)
  }

  const download = (ref, filename) => {
    const a = document.createElement('a')
    a.download = filename; a.href = ref.current.toDataURL('image/png'); a.click()
  }

  const tabs = [
    { key:'membership', label:'🏅 Membership' },
    { key:'birth',      label:'🎂 Birth' },
    ...(hasPost ? [{ key:'id', label:'🪪 ID Card' }] : []),
  ]

  const BtnStyle = (active, color='var(--brand-mid)') => ({
    padding:'10px 22px', borderRadius:30, border:'none', cursor:'pointer',
    fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.86rem',
    background: active ? color : '#f1f5f9',
    color: active ? 'white' : 'var(--text-mid)', transition:'all 0.2s'
  })

  return (
    <>
      <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'clamp(80px,12vw,110px) 5% 48px', textAlign:'center' }}>
        <span className="section-label">Member Recognition</span>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3rem)', color:'white', margin:'8px 0 12px' }}>🏅 My Certificates</h1>
        <p style={{ color:'rgba(255,255,255,0.7)', maxWidth:520, margin:'0 auto', lineHeight:1.8 }}>
          Download your official CCG World certificates and ID card with QR verification.
        </p>
      </div>

      <div className="container" style={{ maxWidth:860, padding:'40px 5% 80px' }}>
        <div style={{ display:'flex', gap:10, marginBottom:32, flexWrap:'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={BtnStyle(tab===t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── MEMBERSHIP ── */}
        {tab === 'membership' && (
          <div>
            <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', marginBottom:24 }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 16px' }}>Certificate Details</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
                {[['👤 Name',displayName],['⛪ Branch',branch],['📅 Member Since',joinDate||'N/A'],['🔖 Certificate ID',certId],...(churchTitle?[['✝️ Post',churchTitle]]:[])]
                  .map(([l,v]) => (
                    <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'11px 14px' }}>
                      <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
                      <div style={{ color:'var(--text-dark)', fontWeight:600, fontSize:'0.9rem' }}>{v}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
              {!memberDone
                ? <button onClick={generateMembership} disabled={generating} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, cursor:generating?'not-allowed':'pointer', fontFamily:'var(--font-body)' }}>{generating?'⏳ Generating…':'🏅 Generate Certificate'}</button>
                : <><button onClick={() => download(memberCanvasRef,'CCG-Membership-'+name.replace(/\s+/g,'-')+'.png')} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>⬇️ Download PNG</button>
                  <button onClick={() => { setMemberDone(false); generateMembership() }} style={{ padding:'12px 20px', borderRadius:40, border:'1.5px solid #e2e8f0', background:'transparent', color:'var(--text-mid)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>🔄 Regenerate</button></>
              }
            </div>
            <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0', display:memberDone?'block':'none' }}>
              <canvas ref={memberCanvasRef} style={{ width:'100%', display:'block' }} />
            </div>
            {!memberDone && <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)' }}><div style={{ fontSize:'3rem', marginBottom:12 }}>🏅</div><div>Click "Generate Certificate" to preview and download</div></div>}
          </div>
        )}

        {/* ── BIRTH ── */}
        {tab === 'birth' && (
          <div>
            {!hasBirthday ? (
              <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:16, padding:'36px 28px', textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🎂</div>
                <h3 style={{ fontFamily:'var(--font-display)', color:'#92400e', margin:'0 0 10px' }}>Birthday Not Set</h3>
                <p style={{ color:'#78350f', lineHeight:1.7, marginBottom:20, fontSize:'0.92rem' }}>Add your birthday in your profile to generate this certificate.</p>
                <Link to="/profile" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:30, background:'var(--brand-base)', color:'white', fontWeight:700, fontSize:'0.88rem', textDecoration:'none' }}>Add Birthday in Profile →</Link>
              </div>
            ) : (
              <div>
                <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', marginBottom:24 }}>
                  <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 16px' }}>Certificate Details</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
                    {[['👤 Name',displayName],['🎂 Birthday',birthday],['⛪ Branch',branch],['🔖 Certificate ID',birthId]]
                      .map(([l,v]) => (
                        <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'11px 14px' }}>
                          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
                          <div style={{ color:'var(--text-dark)', fontWeight:600, fontSize:'0.9rem' }}>{v}</div>
                        </div>
                      ))}
                  </div>
                  {!adminSig && <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:'10px 14px', marginTop:14, fontSize:'0.83rem', color:'#92400e' }}>⚠️ No admin signature uploaded yet. Ask your admin to upload one in the admin panel.</div>}
                </div>
                <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
                  {!birthDone
                    ? <button onClick={generateBirth} disabled={generating} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,#b45309,#d97706)', color:'white', fontWeight:700, cursor:generating?'not-allowed':'pointer', fontFamily:'var(--font-body)' }}>{generating?'⏳ Generating…':'🎂 Generate Birth Certificate'}</button>
                    : <><button onClick={() => download(birthCanvasRef,'CCG-Birth-Certificate-'+name.replace(/\s+/g,'-')+'.png')} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,#b45309,#d97706)', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>⬇️ Download PNG</button>
                      <button onClick={() => { setBirthDone(false); generateBirth() }} style={{ padding:'12px 20px', borderRadius:40, border:'1.5px solid #e2e8f0', background:'transparent', color:'var(--text-mid)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>🔄 Regenerate</button></>
                  }
                </div>
                <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0', display:birthDone?'block':'none' }}>
                  <canvas ref={birthCanvasRef} style={{ width:'100%', display:'block' }} />
                </div>
                {!birthDone && <div style={{ background:'#fff7ed', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'#92400e' }}><div style={{ fontSize:'3rem', marginBottom:12 }}>🎂</div><div>Click "Generate Birth Certificate" to preview and download</div></div>}
              </div>
            )}
          </div>
        )}

        {/* ── ID CARD ── */}
        {tab === 'id' && (
          <div>
            <div style={{ background:'var(--white,white)', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', marginBottom:24 }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 8px' }}>🪪 Church ID Card</h3>
              <p style={{ color:'var(--text-mid)', fontSize:'0.88rem', marginBottom:16 }}>Credit-card sized ID showing your post, branch, and QR verification code.</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12 }}>
                {[['👤 Name',name],['✝️ Post',churchTitle],['⛪ Branch',branch],['🔖 Member ID',certId]]
                  .map(([l,v]) => (
                    <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'11px 14px' }}>
                      <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
                      <div style={{ color:'var(--text-dark)', fontWeight:600, fontSize:'0.9rem' }}>{v}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap' }}>
              {!idDone
                ? <button onClick={generateId} disabled={generating} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, cursor:generating?'not-allowed':'pointer', fontFamily:'var(--font-body)' }}>{generating?'⏳ Generating…':'🪪 Generate ID Card'}</button>
                : <><button onClick={() => download(idCanvasRef,'CCG-ID-'+name.replace(/\s+/g,'-')+'.png')} style={{ padding:'12px 28px', borderRadius:40, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>⬇️ Download ID Card</button>
                  <button onClick={() => { setIdDone(false); generateId() }} style={{ padding:'12px 20px', borderRadius:40, border:'1.5px solid #e2e8f0', background:'transparent', color:'var(--text-mid)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>🔄 Regenerate</button></>
              }
            </div>
            <div style={{ borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', border:'1px solid #e2e8f0', display:idDone?'block':'none', maxWidth:520 }}>
              <canvas ref={idCanvasRef} style={{ width:'100%', display:'block' }} />
            </div>
            {!idDone && <div style={{ background:'var(--brand-pale)', borderRadius:14, padding:'48px 32px', textAlign:'center', color:'var(--text-light)', maxWidth:520 }}><div style={{ fontSize:'3rem', marginBottom:12 }}>🪪</div><div>Click "Generate ID Card" to preview and download</div></div>}
          </div>
        )}
      </div>
    </>
  )
}
