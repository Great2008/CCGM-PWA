import { useState, useRef, useEffect, useCallback } from 'react'
import SEO from '../components/SEO'

// ─── Constants ─────────────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'square',    label: 'WhatsApp / IG Square', w: 1080, h: 1080 },
  { id: 'portrait',  label: 'Instagram Portrait',   w: 1080, h: 1350 },
  { id: 'story',     label: 'Story / Status',       w: 1080, h: 1920 },
  { id: 'landscape', label: 'Website / Print',      w: 1920, h: 768  },
]

const THEMES = [
  { id: 'gold_green', label: 'Gold & Green', bg1: '#0a2612', bg2: '#1a4a28', accent: '#f59e0b', accent2: '#fcd34d', text: '#ffffff' },
  { id: 'royal_gold', label: 'Royal Gold',   bg1: '#14532d', bg2: '#065f46', accent: '#fbbf24', accent2: '#fde68a', text: '#ffffff' },
  { id: 'midnight',   label: 'Midnight',     bg1: '#020617', bg2: '#0f172a', accent: '#f59e0b', accent2: '#fcd34d', text: '#ffffff' },
  { id: 'crimson',    label: 'Crimson',      bg1: '#7f1d1d', bg2: '#1c1917', accent: '#fcd34d', accent2: '#fef08a', text: '#ffffff' },
]

const TEMPLATES = {
  event: {
    label: 'Event / Conference', icon: '📅',
    defaults: {
      churchName: 'CHRISTIAN CHURCH OF GOD MISSION',
      title: 'ANNUAL GENERAL\nCONFERENCE 2026',
      date: '1ST – 5TH APRIL 2026',
      theme: 'LIVING IN THE\nSAFE HAND OF GOD',
      themeLabel: 'THEME:',
      cta: '',
    },
  },
  announcement: {
    label: 'Announcement', icon: '📢',
    defaults: {
      churchName: 'CHRISTIAN CHURCH OF GOD MISSION',
      title: 'SATURDAY\nWORSHIP SERVICE',
      date: 'EVERY SATURDAY · 9:00 AM',
      theme: 'ALL ARE WELCOME.\nCOME PREPARED TO WORSHIP.',
      themeLabel: 'NOTE:',
      cta: '',
    },
  },
  crusade: {
    label: 'Crusade / Revival', icon: '🔥',
    defaults: {
      churchName: 'CHRISTIAN CHURCH OF GOD MISSION',
      title: 'POWER &\nGLORY CRUSADE',
      date: '20TH – 25TH JUNE 2026',
      theme: '"THE SPIRIT OF THE LORD IS\nUPON ME" – LUKE 4:18',
      themeLabel: 'THEME:',
      cta: '',
    },
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function wrapText(ctx, text, maxW) {
  if (!text) return []
  const lines = []
  for (const para of text.split('\n')) {
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word }
      else line = test
    }
    if (line) lines.push(line)
  }
  return lines
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

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => res(i); i.onerror = rej; i.src = src
  })
}

// Draw the gold ribbon swoosh (left side + bottom curve)
function drawRibbon(ctx, W, H) {
  ctx.save()

  // Left ribbon
  const grad1 = ctx.createLinearGradient(0, 0, 160, H)
  grad1.addColorStop(0,   '#fde68a')
  grad1.addColorStop(0.3, '#f59e0b')
  grad1.addColorStop(0.7, '#b45309')
  grad1.addColorStop(1,   '#fbbf24')
  ctx.fillStyle = grad1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(160, H * 0.15, 60, H * 0.55, 0, H * 0.72)
  ctx.lineTo(0, H)
  ctx.bezierCurveTo(60, H * 0.82, 180, H * 0.55, 140, H * 0.3)
  ctx.bezierCurveTo(120, H * 0.18, 80, 0, 0, 0)
  ctx.fill()

  // Bottom ribbon
  const grad2 = ctx.createLinearGradient(0, H - 140, W, H)
  grad2.addColorStop(0,   '#fde68a')
  grad2.addColorStop(0.4, '#f59e0b')
  grad2.addColorStop(1,   '#b45309')
  ctx.fillStyle = grad2
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.bezierCurveTo(W * 0.25, H - 160, W * 0.6, H - 80, W, H - 40)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Thin gold inner line on left ribbon
  ctx.strokeStyle = '#fef9c3'
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(60, 0)
  ctx.bezierCurveTo(200, H * 0.12, 110, H * 0.5, 52, H * 0.68)
  ctx.stroke()

  ctx.restore()
}

// Draw glowing sky background (simulated with gradients)
function drawBackground(ctx, W, H, theme, bgImg) {
  // Base gradient
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0,   '#c8d8e8') // sky top
  base.addColorStop(0.4, '#e8d4b0') // horizon glow
  base.addColorStop(1,   theme.bg1)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Uploaded background image if provided
  if (bgImg) {
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.drawImage(bgImg, 0, 0, W, H)
    ctx.restore()
  }

  // Dark green overlay (bottom 60%)
  const overlay = ctx.createLinearGradient(0, H * 0.2, 0, H)
  overlay.addColorStop(0,   'rgba(10,38,18,0)')
  overlay.addColorStop(0.3, 'rgba(10,38,18,0.82)')
  overlay.addColorStop(1,   'rgba(10,38,18,0.97)')
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, W, H)

  // Central light ray / glow from top
  const ray = ctx.createRadialGradient(W / 2, H * 0.08, 0, W / 2, H * 0.08, W * 0.7)
  ray.addColorStop(0,   'rgba(255,240,180,0.55)')
  ray.addColorStop(0.4, 'rgba(255,220,100,0.12)')
  ray.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = ray
  ctx.fillRect(0, 0, W, H)
}

// Draw the silhouette of crowd/hands at the bottom
function drawSilhouette(ctx, W, H) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.7)'

  // Simple crowd silhouette using arcs and rectangles
  const baseY = H
  const numPeople = Math.floor(W / 38)
  for (let i = 0; i < numPeople; i++) {
    const x  = (i + 0.5) * (W / numPeople)
    const hr = 28 + Math.sin(i * 2.3) * 8
    const bodyH = 60 + Math.cos(i * 1.7) * 12
    const bY = baseY - bodyH
    // Head
    ctx.beginPath()
    ctx.arc(x, bY - hr, hr, 0, Math.PI * 2)
    ctx.fill()
    // Body
    ctx.fillRect(x - 14, bY, 28, bodyH)

    // Raised hand (every 3rd person)
    if (i % 3 === 1) {
      ctx.beginPath()
      ctx.moveTo(x - 6, bY + 10)
      ctx.lineTo(x - 26, bY - 80)
      ctx.lineTo(x - 16, bY - 80)
      ctx.lineTo(x + 2, bY + 10)
      ctx.fill()
    }
    if (i % 3 === 2) {
      ctx.beginPath()
      ctx.moveTo(x + 6, bY + 10)
      ctx.lineTo(x + 26, bY - 70)
      ctx.lineTo(x + 16, bY - 70)
      ctx.lineTo(x - 2, bY + 10)
      ctx.fill()
    }
  }

  // Cross in center (glowing)
  const cx = W / 2, crossBase = H - 20
  const crossGlow = ctx.createRadialGradient(cx, crossBase - 120, 0, cx, crossBase - 120, 180)
  crossGlow.addColorStop(0,   'rgba(255,220,100,0.55)')
  crossGlow.addColorStop(0.5, 'rgba(255,200,50,0.15)')
  crossGlow.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = crossGlow
  ctx.fillRect(cx - 180, crossBase - 300, 360, 300)

  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(cx - 10, crossBase - 200, 20, 200) // vertical
  ctx.fillRect(cx - 50, crossBase - 160, 100, 18)  // horizontal

  ctx.restore()
}

// Main draw function
async function drawBanner(canvas, { fmt, theme, fields, logoImg, bgImg, showSilhouette }) {
  const { w, h } = fmt
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'alphabetic'

  const isLandscape = w > h
  const scale = w / 1080  // everything sized relative to 1080px width

  // 1. Background
  drawBackground(ctx, w, h, theme, bgImg)

  // 2. Silhouette at bottom
  if (showSilhouette && !isLandscape) {
    ctx.save()
    ctx.translate(0, h - Math.round(200 * scale))
    ctx.scale(scale, scale * 0.85)
    drawSilhouette(ctx, w / scale, 240)
    ctx.restore()
  }

  // 3. Gold ribbon
  ctx.save()
  ctx.scale(scale, scale)
  drawRibbon(ctx, w / scale, h / scale)
  ctx.restore()

  const pad  = isLandscape ? w * 0.06 : w * 0.1
  const midX = w / 2
  let y = isLandscape ? h * 0.12 : h * 0.07

  // 4. Logo
  const logoSize = Math.round(isLandscape ? h * 0.28 : w * 0.22)
  if (logoImg) {
    const lx = isLandscape ? w * 0.76 : midX - logoSize / 2
    const ly = isLandscape ? (h - logoSize) / 2 - h * 0.1 : y
    // White circle behind logo
    ctx.save()
    ctx.beginPath()
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize)
    ctx.restore()
    if (!isLandscape) y += logoSize + Math.round(h * 0.03)
  }

  // 5. Church name
  const churchSize = Math.round(w * (isLandscape ? 0.022 : 0.042))
  ctx.textAlign = isLandscape ? 'left' : 'center'
  ctx.font = `800 ${churchSize}px Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.letterSpacing = '2px'
  const churchLines = wrapText(ctx, fields.churchName || 'CHRISTIAN CHURCH OF GOD MISSION',
    isLandscape ? w * 0.6 : w - pad * 2.5)
  for (const line of churchLines) {
    ctx.fillText(line, isLandscape ? pad + 160 * scale : midX, y)
    y += churchSize * 1.3
  }
  y += churchSize * 0.5

  // 6. BIG title with gold gradient
  const titleSize = Math.round(w * (isLandscape ? 0.065 : 0.115))
  const titleGrad = ctx.createLinearGradient(0, y, 0, y + titleSize * 3)
  titleGrad.addColorStop(0,   theme.accent2)
  titleGrad.addColorStop(0.5, theme.accent)
  titleGrad.addColorStop(1,   '#92400e')
  ctx.font = `900 ${titleSize}px Arial Black, Arial, sans-serif`
  ctx.fillStyle = titleGrad
  ctx.textAlign = isLandscape ? 'left' : 'center'
  const titleLines = wrapText(ctx, fields.title || '', isLandscape ? w * 0.58 : w - pad * 1.6)
  for (const line of titleLines) {
    // Stroke for depth
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = titleSize * 0.06
    ctx.strokeText(line, isLandscape ? pad + 160 * scale : midX, y)
    ctx.fillText(line, isLandscape ? pad + 160 * scale : midX, y)
    y += titleSize * 1.12
  }
  y += titleSize * 0.3

  // 7. Date / subtitle bar
  if (fields.date) {
    const dateSize = Math.round(w * (isLandscape ? 0.028 : 0.05))
    ctx.font = `700 ${dateSize}px Arial, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = isLandscape ? 'left' : 'center'
    ctx.fillText(fields.date, isLandscape ? pad + 160 * scale : midX, y)
    y += dateSize * 2
  }

  // 8. Theme box (glassmorphism rounded rectangle)
  if (fields.theme) {
    const themeSize  = Math.round(w * (isLandscape ? 0.025 : 0.048))
    const labelSize  = Math.round(themeSize * 0.65)
    const boxPadX    = Math.round(w * 0.06)
    const boxPadY    = Math.round(h * 0.025)
    const maxThemeW  = isLandscape ? w * 0.55 : w - pad * 2.2
    ctx.font = `700 ${themeSize}px Arial, sans-serif`
    const themeLines = wrapText(ctx, fields.theme, maxThemeW - boxPadX * 2)
    const boxW = isLandscape ? maxThemeW : w - pad * 2
    const boxH = boxPadY * 2 + labelSize * 1.8 + themeLines.length * themeSize * 1.3 + boxPadY
    const boxX = isLandscape ? pad + 160 * scale : (w - boxW) / 2
    const boxY = y

    // Glass box
    ctx.save()
    roundRect(ctx, boxX, boxY, boxW, boxH, Math.round(24 * scale))
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // Theme label (gold, small)
    let ty = boxY + boxPadY + labelSize
    ctx.font = `700 ${labelSize}px Arial, sans-serif`
    ctx.fillStyle = theme.accent
    ctx.textAlign = 'center'
    ctx.fillText(fields.themeLabel || 'THEME:', boxX + boxW / 2, ty)
    ty += labelSize * 1.8

    // Theme text (white, bold)
    ctx.font = `800 ${themeSize}px Arial Black, Arial, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    for (const line of themeLines) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = themeSize * 0.04
      ctx.strokeText(line, boxX + boxW / 2, ty)
      ctx.fillText(line, boxX + boxW / 2, ty)
      ty += themeSize * 1.3
    }

    y = boxY + boxH + h * 0.025
  }

  // 9. CTA text
  if (fields.cta) {
    const ctaSize = Math.round(w * (isLandscape ? 0.018 : 0.035))
    ctx.font = `600 ${ctaSize}px Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.textAlign = isLandscape ? 'left' : 'center'
    const ctaLines = wrapText(ctx, fields.cta, isLandscape ? w * 0.55 : w - pad * 2)
    for (const line of ctaLines) {
      ctx.fillText(line, isLandscape ? pad + 160 * scale : midX, y)
      y += ctaSize * 1.6
    }
  }

  // 10. Watermark
  const wmSize = Math.round(w * 0.022)
  ctx.font = `500 ${wmSize}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.textAlign = 'right'
  ctx.fillText('ccgm-pwa.vercel.app', w - Math.round(30 * scale), h - Math.round(30 * scale))
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BannerGenerator() {
  const [type,          setType]          = useState('event')
  const [fmtId,         setFmtId]         = useState('square')
  const [themeId,       setThemeId]       = useState('gold_green')
  const [fields,        setFields]        = useState(TEMPLATES.event.defaults)
  const [logoImg,       setLogoImg]       = useState(null)
  const [bgImg,         setBgImg]         = useState(null)
  const [showSilhouette,setShowSilhouette]= useState(true)
  const [rendering,     setRendering]     = useState(false)
  const canvasRef = useRef(null)
  const bgInputRef = useRef(null)

  const fmt   = FORMATS.find(f => f.id === fmtId)
  const theme = THEMES.find(t => t.id === themeId)

  // Load logo
  useEffect(() => {
    loadImg('/logo.png').then(setLogoImg).catch(() => {})
  }, [])

  const draw = useCallback(async () => {
    if (!canvasRef.current) return
    setRendering(true)
    try {
      await drawBanner(canvasRef.current, { fmt, theme, fields, logoImg, bgImg, showSilhouette })
    } catch(e) { console.error(e) }
    setRendering(false)
  }, [fmt, theme, fields, logoImg, bgImg, showSilhouette])

  useEffect(() => { draw() }, [draw])

  const switchType = (t) => { setType(t); setFields(TEMPLATES[t].defaults) }
  const setField   = (k, v) => setFields(f => ({ ...f, [k]: v }))

  const download = () => {
    if (!canvasRef.current) return
    const a = document.createElement('a')
    a.download = `ccgm-banner-${fmtId}-${Date.now()}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }

  const handleBgUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => loadImg(ev.target.result).then(setBgImg)
    reader.readAsDataURL(file)
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <>
      <SEO
        title="Banner Generator"
        description="Create beautiful CCG World event and announcement banners for WhatsApp, Instagram, and more."
        path="/banner-generator"
      />

      <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center' }}>
        <span className="section-label" style={{ color: 'var(--brand-glow)' }}>Design Tools</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem,5vw,3rem)', marginBottom: 12 }}>
          🎨 Banner Generator
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
          Design professional church banners for WhatsApp, Instagram, Stories and print.
        </p>
      </div>

      <div style={{ background: 'var(--cream)', minHeight: '60vh', padding: '32px 4% 80px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Preview */}
          <div style={{ background: 'white', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-dark)', fontWeight: 700 }}>
                {rendering ? '⏳ Rendering…' : '✅ Preview'}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{fmt.w}×{fmt.h}px</span>
            </div>
            <div style={{ width: '100%', background: '#111', borderRadius: 10, padding: 8, lineHeight: 0 }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.35)' }}
              />
            </div>
          </div>

          {/* Download */}
          <button onClick={download} style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', color: 'white', border: 'none', borderRadius: 12, fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-md)', letterSpacing: '0.5px' }}>
            ⬇ Download PNG
          </button>

          {/* Banner Type */}
          <Card title="Banner Type">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <button key={k} onClick={() => switchType(k)} style={{ padding: '12px 8px', borderRadius: 10, border: '2px solid', borderColor: type === k ? 'var(--brand-base)' : 'var(--brand-pale)', background: type === k ? 'var(--brand-pale)' : 'white', color: 'var(--text-dark)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Format */}
          <Card title="Output Format">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFmtId(f.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, border: '2px solid', borderColor: fmtId === f.id ? 'var(--brand-base)' : 'var(--brand-pale)', background: fmtId === f.id ? 'var(--brand-pale)' : 'white', color: 'var(--text-dark)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s' }}>
                  {f.label}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>{f.w}×{f.h}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Colour Theme */}
          <Card title="Colour Theme">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setThemeId(t.id)} style={{ padding: '12px 6px', borderRadius: 10, border: `2px solid ${themeId === t.id ? t.accent : 'transparent'}`, background: t.bg1, cursor: 'pointer', transition: 'transform 0.15s', transform: themeId === t.id ? 'scale(1.06)' : 'scale(1)' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.accent, margin: '0 auto 5px' }} />
                  <div style={{ color: t.accent, fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-body)' }}>{t.label}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Background Image */}
          <Card title="Background Photo (optional)">
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>Upload a photo (crowd, church, sky) to use as the background. It blends with the dark overlay automatically.</p>
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => bgInputRef.current?.click()} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '2px dashed var(--brand-pale)', background: '#f8fafc', color: 'var(--text-mid)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                {bgImg ? '✅ Photo uploaded' : '📷 Choose photo…'}
              </button>
              {bgImg && (
                <button onClick={() => setBgImg(null)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>Remove</button>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-mid)' }}>
              <input type="checkbox" checked={showSilhouette} onChange={e => setShowSilhouette(e.target.checked)} />
              Show crowd silhouette at bottom
            </label>
          </Card>

          {/* Content */}
          <Card title="Content">
            {[
              { key: 'churchName', label: 'Church Name',         placeholder: 'CHRISTIAN CHURCH OF GOD MISSION', multiline: false },
              { key: 'title',      label: 'Event Title',         placeholder: 'ANNUAL GENERAL\nCONFERENCE 2026',  multiline: true  },
              { key: 'date',       label: 'Date / Time',         placeholder: '1ST – 5TH APRIL 2026',            multiline: false },
              { key: 'themeLabel', label: 'Theme Box Label',     placeholder: 'THEME:',                          multiline: false },
              { key: 'theme',      label: 'Theme / Message',     placeholder: 'LIVING IN THE\nSAFE HAND OF GOD', multiline: true  },
              { key: 'cta',        label: 'Call to Action',      placeholder: 'All are welcome',                 multiline: false },
            ].map(({ key, label, placeholder, multiline }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }}>{label}</label>
                {multiline ? (
                  <textarea
                    value={fields[key] || ''}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={placeholder}
                    rows={2}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--brand-pale)', background: 'white', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-dark)', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                ) : (
                  <input
                    value={fields[key] || ''}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={placeholder}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--brand-pale)', background: 'white', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-dark)', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            ))}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              💡 Use line breaks in Title and Theme to control how text wraps on the banner.
            </p>
          </Card>

          <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Downloads as full-resolution PNG. Ready for WhatsApp, Instagram, or print.
          </p>
        </div>
      </div>
    </>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '18px 16px', boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--brand-dark)', marginBottom: 14, fontWeight: 700 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
