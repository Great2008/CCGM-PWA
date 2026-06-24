import { useRef, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import supabase from '../lib/supabase'

// ── Primitive helpers ──────────────────────────────────────────────────────────

function safeFill(ctx, value, x, y) {
  ctx.fillText(value == null ? '' : String(value), x, y)
}

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

function getCapeStripes(t) {
  if (!t) return null
  if (t === 'Apostle') return 2
  if (t === 'Elder')   return 1
  return ['Pastor','Evangelist','Deacon','Deaconess','Prophet'].includes(t) ? 0 : null
}

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

function drawCornerStripes(ctx, W, stripes) {
  if (stripes === null) return
  ctx.save()
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5; ctx.lineCap = 'round'
  if (stripes >= 1) { ctx.beginPath(); ctx.moveTo(W-36-65,32); ctx.lineTo(W-36,32+65); ctx.stroke() }
  if (stripes === 2) { ctx.beginPath(); ctx.moveTo(W-36-36,32); ctx.lineTo(W-36,32+36); ctx.stroke() }
  ctx.restore()
}

function drawOrnateCorner(ctx, ox, oy, size, sx, sy) {
  try {
    const ax = (lx) => ox + lx * sx
    const ay = (ly) => oy + ly * sy
    ctx.save()
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(ax(0), ay(size)); ctx.lineTo(ax(0), ay(0)); ctx.lineTo(ax(size), ay(0))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ax(0), ay(size-14)); ctx.lineTo(ax(0), ay(10)); ctx.lineTo(ax(size-14), ay(10))
    ctx.stroke()
    ctx.beginPath(); ctx.arc(ax(26), ay(26), 12, 0, Math.PI*2)
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.8; ctx.stroke()
    ctx.beginPath(); ctx.arc(ax(26), ay(26), 5, 0, Math.PI*2)
    ctx.fillStyle = '#d97706'; ctx.globalAlpha = 1; ctx.fill()
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(ax(38), ay(26))
    ctx.bezierCurveTo(ax(50),ay(26), ax(52),ay(16), ax(63),ay(15))
    ctx.bezierCurveTo(ax(70),ay(14), ax(72),ay(7),  ax(76),ay(7))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ax(26), ay(38))
    ctx.bezierCurveTo(ax(26),ay(50), ax(16),ay(52), ax(15),ay(63))
    ctx.bezierCurveTo(ax(14),ay(70), ax(7), ay(72), ax(7), ay(76))
    ctx.stroke()
    var buds = [[50,19],[64,12],[19,50],[12,64]]
    for (var b=0; b<buds.length; b++) {
      ctx.beginPath(); ctx.arc(ax(buds[b][0]), ay(buds[b][1]), 3.5, 0, Math.PI*2)
      ctx.fillStyle = '#d97706'; ctx.globalAlpha = 0.5; ctx.fill()
    }
    for (var i=0; i<6; i++) {
      ctx.beginPath(); ctx.arc(ax(20+i*11), ay(5), 1.8, 0, Math.PI*2)
      ctx.fillStyle = '#d97706'; ctx.globalAlpha = 0.4; ctx.fill()
      ctx.beginPath(); ctx.arc(ax(5), ay(20+i*11), 1.8, 0, Math.PI*2); ctx.fill()
    }
    ctx.restore()
  } catch(e) {
    try { ctx.restore() } catch(_) {}
  }
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

// ── PDF render helper (dynamic import so it only loads when needed) ────────────
async function pdfPageToDataUrl(pdfUrl) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  const pdf  = await pdfjsLib.getDocument(pdfUrl).promise
  const page = await pdf.getPage(1)
  const vp   = page.getViewport({ scale: 2 })
  const c    = document.createElement('canvas')
  c.width = vp.width; c.height = vp.height
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
  return c.toDataURL('image/png')
}

// ── Map profile fields to template field keys ─────────────────────────────────
function getMemberValue(key, profile, user, certType, today) {
  if (!profile) return ''
  switch (key) {
    case 'full_name':      return profile.full_name || profile.display_name || ''
    case 'church_branch':  return profile.church_branch || ''
    case 'member_since':   return fmtDate(profile.created_at)
    case 'church_title':   return profile.church_title || ''
    case 'cert_id':        return (certType === 'birth' ? 'CCGB-' : 'CCG-') + (user?.id || '').slice(0,8).toUpperCase()
    case 'issued_date':    return today
    case 'birthday':       return profile.birthday ? fmtBirthday(profile.birthday) : ''
    case 'place_of_birth': return profile.place_of_birth || ''
    case 'father_name':    return profile.father_name || ''
    case 'mother_name':    return profile.mother_name || ''
    case 'hometown':       return profile.hometown || ''
    case 'lga':            return profile.lga || ''
    default:               return ''
  }
}

// ── CustomCertTab: renders a template onto canvas and lets member download ─────
function CustomCertTab({ template, profile, user, today }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [done,        setDone]      = useState(false)
  const [imgSrc,      setImgSrc]    = useState(null)
  const [format,      setFormat]    = useState('png')
  const [error,       setError]     = useState('')

  const generate = useCallback(async () => {
    setGenerating(true); setError('')
    try {
      // Resolve the background image
      let bgDataUrl
      if (template.is_pdf) {
        bgDataUrl = await pdfPageToDataUrl(template.image_url)
      } else {
        const img = await loadImage(template.image_url)
        const tmp = document.createElement('canvas')
        tmp.width = img.naturalWidth; tmp.height = img.naturalHeight
        tmp.getContext('2d').drawImage(img, 0, 0)
        bgDataUrl = tmp.toDataURL('image/png')
      }

      const bgImg  = await loadImage(bgDataUrl)
      const canvas = canvasRef.current
      canvas.width  = bgImg.naturalWidth
      canvas.height = bgImg.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bgImg, 0, 0)

      // Overlay each placed field
      const fieldsMap = template.fields || {}
      for (const [key, f] of Object.entries(fieldsMap)) {
        const val = getMemberValue(key, profile, user, template.cert_type, today)
        if (!val || !f) continue
        ctx.save()
        ctx.font = `${f.bold ? 'bold ' : ''}${f.fontSize}px ${f.fontFamily}`
        ctx.fillStyle = f.fontColor
        ctx.textBaseline = 'middle'
        ctx.fillText(val, f.x, f.y)
        ctx.restore()
      }

      const dataUrl = canvas.toDataURL('image/png')
      setImgSrc(dataUrl)
      setDone(true)
    } catch (e) {
      setError(e.message || 'Generation failed. Please try again.')
    }
    setGenerating(false)
  }, [template, profile, user, today])

  const download = async () => {
    if (format === 'pdf') {
      try {
        const { jsPDF } = await import('jspdf')
        const img  = await loadImage(imgSrc)
        const isLandscape = img.naturalWidth > img.naturalHeight
        const pdf = new jsPDF({
          orientation: isLandscape ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.naturalWidth, img.naturalHeight],
        })
        pdf.addImage(imgSrc, 'PNG', 0, 0, img.naturalWidth, img.naturalHeight)
        pdf.save(`CCG-${template.cert_type}-${(profile.full_name||'member').replace(/\s+/g,'-')}.pdf`)
      } catch (e) {
        setError('PDF export failed: ' + e.message)
      }
    } else {
      const a = document.createElement('a')
      a.download = `CCG-${template.cert_type}-${(profile.full_name||'member').replace(/\s+/g,'-')}.png`
      a.href = imgSrc; a.click()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} />

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 18px', color: '#dc2626', fontSize: '0.88rem', display: 'flex', gap: 10, alignItems: 'center' }}>
          ❌ <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Preview */}
      {done && imgSrc ? (
        <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0' }}>
          <img src={imgSrc} alt="Your certificate" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : (
        <div style={{ background: 'var(--brand-pale)', borderRadius: 14, padding: '48px 32px', textAlign: 'center', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📜</div>
          <div>Your details will be written onto the official church template.</div>
          <div style={{ fontSize: '0.82rem', marginTop: 8, opacity: 0.7 }}>Click "Generate" to preview, then choose your download format.</div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {!done ? (
          <button onClick={generate} disabled={generating} style={{ padding: '12px 28px', borderRadius: 40, border: 'none', background: generating ? '#94a3b8' : 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', color: 'white', fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
            {generating ? '⏳ Generating…' : '🎨 Generate Certificate'}
          </button>
        ) : (
          <>
            {/* Format picker */}
            <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 30, padding: 4 }}>
              {['png', 'pdf'].map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{ padding: '7px 18px', borderRadius: 26, border: 'none', background: format === f ? 'var(--brand-mid)' : 'transparent', color: format === f ? 'white' : 'var(--text-mid)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            <button onClick={download} style={{ padding: '12px 24px', borderRadius: 40, border: 'none', background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              ⬇️ Download {format.toUpperCase()}
            </button>

            <button onClick={() => { setDone(false); setImgSrc(null); generate() }} style={{ padding: '12px 20px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              🔄 Regenerate
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function Certificate() {
  const { user, profile, churchTitle: rawChurchTitle } = useAuth()
  const churchTitle = rawChurchTitle ?? null
  const [searchParams] = useSearchParams()
  const [adminSig, setAdminSig] = useState(null)

  // Custom templates from DB
  const [customTemplates, setCustomTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

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

  // Load active custom templates
  useEffect(() => {
    supabase.from('certificate_templates')
      .select('id, name, cert_type, image_url, is_pdf, fields, active')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCustomTemplates(data || [])
        setTemplatesLoading(false)
      })
  }, [])

  if (!user || !profile) return (
    <div style={{ minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:32,textAlign:'center' }}>
      <div style={{ fontSize:'3rem' }}>🏅</div>
      <h2 style={{ fontFamily:'var(--font-display)',color:'var(--brand-deep)',margin:0 }}>Members Only</h2>
      <p style={{ color:'var(--text-light)' }}>Sign in to download your certificates.</p>
      <Link to="/timeline" className="btn btn-blue">Sign In →</Link>
    </div>
  )

  // ── Derived values ─────────────────────────────────────────────
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
  const hasIdCard      = !!churchTitle && ORDAINED.includes(churchTitle)

  const fatherName   = profile?.father_name   || ''
  const motherName   = profile?.mother_name   || ''
  const placeOfBirth = profile?.place_of_birth || ''
  const hometown     = profile?.hometown      || ''
  const lga          = profile?.lga           || ''

  // Group custom templates by type
  const membershipTemplates = customTemplates.filter(t => t.cert_type === 'membership')
  const birthTemplates      = customTemplates.filter(t => t.cert_type === 'birth')

  // ── MEMBERSHIP CERTIFICATE ─────────────────────────────────────
  const generateMembership = async () => {
    if (!profile || !user) { setGenError('Profile not loaded yet — please wait and try again.'); return }
    setGenerating(true); setGenError('')
    const canvas = memberCanvasRef.current
    if (!canvas) { setGenError('Canvas not available — refresh and try again'); setGenerating(false); return }
    let _step = 'init'
    try {
    const W = 1748, H = 1240
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenError('Canvas context unavailable'); return }

    _step = 'background'
    ctx.fillStyle = '#fdf9f0'; ctx.fillRect(0,0,W,H)

    _step = 'logo-watermark'
    try {
      const logo = await loadImage('/logo.webp')
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

    try { const logo = await loadImage('/logo.webp'); ctx.drawImage(logo,70,52,140,140) } catch(_){}
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 28px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 106)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '19px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 144)
    ctx.fillStyle = '#fbbf24'; ctx.font = '16px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 174)

    ctx.fillStyle = '#d97706'; ctx.fillRect(36,226,W-72,3)

    _step = 'title'
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 72px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Membership', W/2, 356)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(W/2-420,378); ctx.lineTo(W/2+420,378); ctx.stroke()

    const stripes = getCapeStripes(churchTitle)
    let bodyY = 468
    if (stripes !== null) { drawCapeBadge(ctx,W,392,stripes,churchTitle); bodyY = 502 }

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

    ctx.fillStyle = '#d97706'; ctx.fillRect(W/2-320,828+yOff,640,2)

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

    await drawStamp(ctx, W-220, 910+yOff, 210)

    ctx.textAlign = 'center'; ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 14px Georgia, serif'
    ctx.fillText('✦ Printed digitally by CCG World ✦', W/2, 1160+yOff)
    ctx.font = '13px Georgia, serif'
    ctx.fillText('Verify at: ' + verifyUrl, W/2, 1184+yOff)

    setMemberDone(true)
    setTimeout(() => { if (memberImgRef.current) memberImgRef.current.src = canvas.toDataURL('image/png') }, 50)
    } catch(e) { const msg = `[${_step}] ${e?.message || 'unknown'}`; console.error('Membership cert ERROR at step:', _step, e); setGenError(msg) }
    finally { setGenerating(false) }
  }

  // ── BIRTH CERTIFICATE ──────────────────────────────────────────
  const generateBirth = async () => {
    if (!birthday) return
    if (!profile || !user) { setGenError('Profile not loaded yet.'); return }
    setGenerating(true); setGenError('')
    const canvas = birthCanvasRef.current
    if (!canvas) { setGenError('Canvas not available'); setGenerating(false); return }
    try {
    const W = 1748, H = 1240
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { setGenError('Canvas context unavailable'); return }

    ctx.fillStyle = '#fffef5'; ctx.fillRect(0,0,W,H)

    try {
      const logo = await loadImage('/logo.webp')
      ctx.save(); ctx.globalAlpha = 0.04
      ctx.drawImage(logo, W/2-180, H/2-180, 360, 360)
      ctx.restore()
    } catch(_){}

    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 8;  ctx.strokeRect(14,14,W-28,H-28)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5; ctx.strokeRect(26,26,W-52,H-52)
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;   ctx.strokeRect(34,34,W-68,H-68)

    drawOrnateCorner(ctx,16,16,80,  1, 1)
    drawOrnateCorner(ctx,W-16,16,80,-1, 1)
    drawOrnateCorner(ctx,16,H-16,80, 1,-1)
    drawOrnateCorner(ctx,W-16,H-16,80,-1,-1)

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

    const grad = ctx.createLinearGradient(0,0,W,0)
    grad.addColorStop(0,'#0a2612'); grad.addColorStop(0.6,'#14532d'); grad.addColorStop(1,'#b45309')
    ctx.fillStyle = grad; ctx.fillRect(34,34,W-68,190)
    try { const logo = await loadImage('/logo.webp'); ctx.drawImage(logo,70,52,140,140) } catch(_){}
    drawCornerStripes(ctx, W, getCapeStripes(churchTitle))

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 26px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', W/2, 104)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '14px Georgia, serif'
    ctx.fillText('(Registered in Nig. No. 451)', W/2, 128)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = '16px Georgia, serif'
    ctx.fillText('CCG Mission — Re-established 1st October, 1954', W/2, 154)
    ctx.fillStyle = '#fbbf24'; ctx.font = '14px Georgia, serif'
    ctx.fillText('ccgm-pwa.vercel.app', W/2, 178)
    ctx.fillStyle = '#d97706'; ctx.fillRect(34,224,W-68,2)

    ctx.textAlign = 'left'; ctx.fillStyle = '#374151'; ctx.font = 'italic 17px Georgia, serif'
    ctx.fillText('Printed:', 60, 264)
    ctx.fillStyle = '#0a2612'; ctx.font = '17px Georgia, serif'; ctx.fillText(today, 148, 264)
    ctx.textAlign = 'right'; ctx.fillStyle = '#374151'; ctx.font = 'italic 17px Georgia, serif'
    ctx.fillText('No.', W-160, 264)
    ctx.fillStyle = '#0a2612'; ctx.font = '17px Georgia, serif'
    ctx.fillText(birthId.replace('CCGB-',''), W-60, 264)

    ctx.fillStyle = '#0a2612'; ctx.font = 'bold italic 72px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Certificate of Birth', W/2, 368)
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(W/2-380,392); ctx.lineTo(W/2+380,392); ctx.stroke()
    ctx.fillStyle = '#92400e'; ctx.font = 'italic 24px Georgia, serif'
    ctx.fillText('In the Name of the Lord', W/2, 432)
    ctx.fillStyle = '#374151'; ctx.font = 'italic 26px Georgia, serif'
    ctx.fillText('This is to Certify that', W/2, 476)

    const LX = 60, RX = W/2 + 40
    const COL_W = W/2 - 100

    const fieldLine = (label, value, x, y, lineW, lSz=18, vSz=18) => {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#374151'; ctx.font = lSz + 'px Georgia, serif'
      ctx.fillText(label, x, y)
      const lw = ctx.measureText(String(label||'')).width
      ctx.strokeStyle = '#b45309'; ctx.lineWidth = 0.9; ctx.setLineDash([2,4])
      ctx.beginPath(); ctx.moveTo(x+lw+5,y+3); ctx.lineTo(x+lineW,y+3); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#0a2612'; ctx.font = 'bold ' + vSz + 'px Georgia, serif'
      const val = value == null ? '—' : String(value)
      let dv = val
      while (ctx.measureText(dv).width > lineW - lw - 20 && dv.length > 1) dv = dv.slice(0,-1)
      if (dv !== val) dv += '…'
      ctx.fillText(dv, x+lw+10, y)
    }

    let fy = 512

    const nameFont = 'bold 28px Georgia, serif'
    const nameLabelFont = '20px Georgia, serif'
    ctx.font = nameLabelFont; ctx.fillStyle = '#374151'; ctx.textAlign = 'left'
    ctx.fillText('Name of Child...', LX, fy)
    const nameLabelW = ctx.measureText('Name of Child...').width
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 0.9; ctx.setLineDash([2,4])
    ctx.beginPath(); ctx.moveTo(LX+nameLabelW+5, fy+3); ctx.lineTo(LX + W - 120, fy+3); ctx.stroke()
    ctx.setLineDash([])
    ctx.font = nameFont; ctx.fillStyle = '#0a2612'
    const nameAvailW = (W - 120) - nameLabelW - 20
    if (ctx.measureText(name).width <= nameAvailW) {
      ctx.fillText(name, LX + nameLabelW + 10, fy)
      fy += 68
    } else {
      ctx.fillText(name, LX, fy + 32)
      ctx.strokeStyle = '#b45309'; ctx.lineWidth = 0.9; ctx.setLineDash([2,4])
      ctx.beginPath(); ctx.moveTo(LX, fy+38); ctx.lineTo(LX + W - 120, fy+38); ctx.stroke()
      ctx.setLineDash([])
      fy += 100
    }

    fieldLine('Date of Birth...', birthday, LX, fy, COL_W)
    fieldLine('Place of Birth...', placeOfBirth||'—', RX, fy, COL_W)
    fy += 66

    ctx.fillStyle = '#374151'; ctx.font = 'italic 22px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Was born by', W/2, fy); fy += 54

    fieldLine("Father's Name...", fatherName||'—', LX, fy, COL_W)
    fieldLine("Mother's Name...", motherName||'—', RX, fy, COL_W)
    fy += 66

    fieldLine('Home Town/Village...', hometown||'—', LX, fy, COL_W)
    fieldLine('L.G. Area/Division...', lga||'—', RX, fy, COL_W)
    fy += 66

    fy += 20
    ctx.fillStyle = '#d97706'; ctx.fillRect(LX, fy, W-120, 1.5); fy += 38

    ctx.fillStyle = '#374151'; ctx.font = 'italic 17px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('In witness whereof the undersigned who accepted the above particulars to be correct and true.', W/2, fy)
    fy += 56

    const botY = fy

    if (adminSig) {
      try { const sig = await loadImage(adminSig); ctx.drawImage(sig, 100, botY, 260, 80) } catch(_){}
    }
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(100, botY+96); ctx.lineTo(400, botY+96); ctx.stroke()
    ctx.fillStyle = '#374151'; ctx.font = 'italic 15px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('Signature of Church Minister', 250, botY+116)

    try {
      const qr = await loadImage(qrDataUrl(birthVerifyUrl, 130))
      ctx.drawImage(qr, W/2-65, botY, 130, 130)
      ctx.fillStyle = '#6b7280'; ctx.font = '13px Georgia, serif'; ctx.textAlign = 'center'
      ctx.fillText('Scan to verify', W/2, botY+150)
    } catch(_){}

    await drawStamp(ctx, W-220, botY+80, 180)

    const footY = H - 44
    ctx.fillStyle = '#d97706'; ctx.fillRect(34, footY-18, W-68, 1.5)
    ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('✶ Printed digitally by CCG World ✶', W/2, footY)
    ctx.font = '12px Georgia, serif'
    ctx.fillText('Verify at: ' + birthVerifyUrl, W/2, footY+18)

    setBirthDone(true)
    setTimeout(() => { if (birthImgRef.current) birthImgRef.current.src = canvas.toDataURL('image/png') }, 50)
    } catch(e) { const msg = `[birth] ${e?.message || 'unknown'}`; console.error('Birth cert ERROR:', e); setGenError(msg) }
    finally { setGenerating(false) }
  }

  // ── ID CARD ────────────────────────────────────────────────────
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

    const bandH = 368
    const topGrad = ctx.createLinearGradient(0,0,0,bandH)
    topGrad.addColorStop(0,'#0a2612'); topGrad.addColorStop(1,'#166534')
    ctx.fillStyle = topGrad; ctx.fillRect(0,0,W,bandH)
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,bandH,W,H-bandH)

    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 5; ctx.strokeRect(5,5,W-10,H-10)
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(11,11,W-22,H-22)

    const stripes = getCapeStripes(churchTitle)
    if (stripes !== null) {
      ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 7; ctx.lineCap = 'round'
      if (stripes >= 1) { ctx.beginPath(); ctx.moveTo(W-68,8); ctx.lineTo(W-8,68); ctx.stroke() }
      if (stripes === 2) { ctx.beginPath(); ctx.moveTo(W-40,8); ctx.lineTo(W-8,40); ctx.stroke() }
      ctx.restore()
    }

    try {
      const logo = await loadImage('/logo.webp')
      ctx.drawImage(logo, W/2-40, 22, 80, 80)
    } catch(_){}

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText('CHRISTIAN CHURCH', W/2, 120)
    ctx.fillText('OF GOD MISSION', W/2, 139)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px Georgia, serif'
    ctx.fillText('Official Member ID', W/2, 158)

    const avX = W/2, avY = 272, avR = 90
    ctx.save()
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

    const badgeY = bandH - 22
    ctx.fillStyle = '#d97706'
    roundRect(ctx, W/2-90,badgeY,180,34,17); ctx.fill()
    ctx.fillStyle = '#0a2612'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText((churchTitle||'Member').toUpperCase(), W/2, badgeY+22)

    const dy = bandH + 32
    ctx.textAlign = 'center'

    ctx.fillStyle = '#9ca3af'; ctx.font = '11px Georgia, serif'
    ctx.fillText('FULL NAME', W/2, dy)
    ctx.fillStyle = '#0a2612'
    let nfs2 = 22; ctx.font = `bold ${nfs2}px Georgia, serif`
    while (ctx.measureText(name).width > W-48 && nfs2 > 12) { nfs2--; ctx.font=`bold ${nfs2}px Georgia, serif` }
    ctx.fillText(name, W/2, dy+22)

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(44,dy+38); ctx.lineTo(W-44,dy+38); ctx.stroke()

    ctx.fillStyle = '#9ca3af'; ctx.font = '11px Georgia, serif'
    ctx.fillText('BRANCH', W/2, dy+60)
    ctx.fillStyle = '#166534'; ctx.font = 'bold 16px Georgia, serif'
    ctx.fillText(branch, W/2, dy+80)

    ctx.beginPath(); ctx.moveTo(44,dy+96); ctx.lineTo(W-44,dy+96); ctx.stroke()

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

    try {
      const qr = await loadImage(qrDataUrl(verifyUrl, 120))
      ctx.drawImage(qr, W/2-60, dy+168, 120, 120)
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px Georgia, serif'; ctx.textAlign = 'center'
      ctx.fillText('Scan to verify membership', W/2, dy+300)
    } catch(_){}

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

  // ── Download helpers ───────────────────────────────────────────
  const downloadPng = (canvasRef, filename) => {
    const a = document.createElement('a')
    a.download = filename; a.href = canvasRef.current.toDataURL('image/png'); a.click()
  }

  const downloadPdf = async (canvasRef, filename) => {
    try {
      const { jsPDF } = await import('jspdf')
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const img     = await loadImage(dataUrl)
      const isLandscape = img.naturalWidth > img.naturalHeight
      const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'px', format: [img.naturalWidth, img.naturalHeight] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.naturalWidth, img.naturalHeight)
      pdf.save(filename)
    } catch (e) {
      setGenError('PDF export failed: ' + e.message)
    }
  }

  // ── Shared sub-components ──────────────────────────────────────
  const TabBtn = ({ k, label }) => (
    <button onClick={() => setTab(k)} style={{
      padding:'10px 22px', borderRadius:30, border:'none', cursor:'pointer',
      fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.86rem',
      background: tab===k ? 'var(--brand-mid)' : '#f1f5f9',
      color: tab===k ? 'white' : 'var(--text-mid)', transition:'all 0.2s',
      whiteSpace: 'nowrap',
    }}>{label}</button>
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

  // Download format picker + buttons for built-in certs
  const DownloadRow = ({ canvasRef, baseName, onRegen, color }) => {
    const [fmt, setFmt] = useState('png')
    return (
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, background:'#f1f5f9', borderRadius:30, padding:4 }}>
          {['png','pdf'].map(f => (
            <button key={f} onClick={() => setFmt(f)} style={{ padding:'7px 18px', borderRadius:26, border:'none', background:fmt===f?'var(--brand-mid)':'transparent', color:fmt===f?'white':'var(--text-mid)', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.85rem', transition:'all 0.2s' }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <GenBtn
          onClick={() => fmt==='pdf' ? downloadPdf(canvasRef, baseName+'.pdf') : downloadPng(canvasRef, baseName+'.png')}
          disabled={false}
          label={`⬇️ Download ${fmt.toUpperCase()}`}
          color={color}
        />
        <RegenBtn onClick={onRegen} />
      </div>
    )
  }

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

  // ── Build tab list ─────────────────────────────────────────────
  const tabs = [
    { key:'membership', label:'🏅 Membership' },
    { key:'birth',      label:'🎂 Birth' },
    ...(hasIdCard ? [{ key:'id', label:'🪪 ID Card' }] : []),
    // Custom templates — one tab each
    ...membershipTemplates.map(t => ({ key:`custom-${t.id}`, label:`📜 ${t.name}` })),
    ...birthTemplates.map(t => ({ key:`custom-${t.id}`, label:`📜 ${t.name}` })),
  ]

  // Detect if current tab is a custom template tab
  const activeCustomTemplate = customTemplates.find(t => tab === `custom-${t.id}`)

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ background:'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&q=80") center/cover no-repeat', padding:'clamp(80px,12vw,110px) 5% 48px', textAlign:'center' }}>
        <span className="section-label">Member Recognition</span>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3rem)', color:'white', margin:'8px 0 12px' }}>
          🏅 My Certificates
        </h1>
        <p style={{ color:'rgba(255,255,255,0.7)', maxWidth:520, margin:'0 auto', lineHeight:1.8 }}>
          Download your official CCG World certificates{hasIdCard ? ' and ID card' : ''} with QR verification.
        </p>
      </div>

      {/* Hidden canvases — always mounted */}
      <div style={{ position:'absolute', left:'-9999px', top:0, pointerEvents:'none', visibility:'hidden' }}>
        <canvas ref={memberCanvasRef} />
        <canvas ref={birthCanvasRef} />
        <canvas ref={idCanvasRef} />
      </div>

      <div className="container" style={{ maxWidth:900, padding:'40px 5% 80px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:10, marginBottom:32, flexWrap:'wrap' }}>
          {tabs.map(t => <TabBtn key={t.key} k={t.key} label={t.label} />)}
        </div>

        {/* Error banner */}
        {genError && (
          <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:12, padding:'12px 18px', color:'#dc2626', fontSize:'0.88rem', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
            ❌ <span>{genError}</span>
            <button onClick={() => setGenError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'1rem' }}>✕</button>
          </div>
        )}

        {/* ── CUSTOM TEMPLATE TAB ── */}
        {activeCustomTemplate && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'20px 24px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 6px' }}>{activeCustomTemplate.name}</h3>
              <p style={{ color:'var(--text-light)', fontSize:'0.84rem', margin:'0 0 16px' }}>
                Your details will be placed directly onto the official church template.
              </p>
              <InfoGrid items={[
                ['👤 Name', displayName],
                ['⛪ Branch', branch],
                ['📅 Member Since', joinDate || 'N/A'],
                ...(activeCustomTemplate.cert_type === 'birth' && birthday ? [['🎂 Birthday', birthday]] : []),
              ]} />
            </div>
            <CustomCertTab
              template={activeCustomTemplate}
              profile={profile}
              user={user}
              today={today}
            />
          </div>
        )}

        {/* ── MEMBERSHIP TAB ── */}
        {tab === 'membership' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
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
                : <DownloadRow canvasRef={memberCanvasRef} baseName={'CCG-Membership-'+name.replace(/\s+/g,'-')} onRegen={() => { setMemberDone(false); generateMembership() }} />
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

        {/* ── BIRTH TAB ── */}
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
                <div style={{ background:'white', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
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
                    : <DownloadRow canvasRef={birthCanvasRef} baseName={'CCG-Birth-Certificate-'+name.replace(/\s+/g,'-')} onRegen={() => { setBirthDone(false); generateBirth() }} color="#b45309" />
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

        {/* ── ID CARD TAB ── */}
        {tab === 'id' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ background:'white', borderRadius:16, padding:'24px 28px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0' }}>
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
                : <DownloadRow canvasRef={idCanvasRef} baseName={'CCG-ID-'+name.replace(/\s+/g,'-')} onRegen={() => { setIdDone(false); generateId() }} />
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
