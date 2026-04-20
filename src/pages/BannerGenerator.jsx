import { useState, useRef, useEffect, useCallback } from 'react'
import SEO from '../components/SEO'

// ─── PRESETS ──────────────────────────────────────────────────────────────────
const TEMPLATES = {
  event: {
    label: 'Event / Programme',
    icon: '📅',
    defaults: {
      title: 'Annual Convention',
      subtitle: 'Walking in the Light of God',
      date: 'Saturday, 10 May 2025',
      time: '9:00 AM – 4:00 PM',
      venue: 'CCG World Headquarters',
      theme: 'Isaiah 60:1 — "Arise, shine; for your light has come"',
      cta: 'All are welcome. Come prepared to worship.',
    },
  },
  announcement: {
    label: 'Church Announcement',
    icon: '📢',
    defaults: {
      title: 'Saturday Worship Service',
      subtitle: 'Come, let us worship together',
      date: 'Every Saturday',
      time: '9:00 AM',
      venue: 'CCG World — All Branches',
      theme: '',
      cta: 'Dress modestly. Bring your Bible.',
    },
  },
}

// Aspect ratios: [width, height, label]
const FORMATS = [
  { id: 'whatsapp',   label: 'WhatsApp',   w: 1080, h: 1080, display: 360 },
  { id: 'instagram',  label: 'Instagram',  w: 1080, h: 1350, display: 288 },
  { id: 'landscape',  label: 'Website / Print', w: 1920, h: 768,  display: 480 },
]

const DESIGN_STYLES = [
  { id: 'classic',   label: 'Classic',     bg: '#0a2612', accent: '#f59e0b' },
  { id: 'royal',     label: 'Royal',       bg: '#14532d', accent: '#fcd34d' },
  { id: 'light',     label: 'Light',       bg: '#f0fdf4', accent: '#166534' },
  { id: 'midnight',  label: 'Midnight',    bg: '#030d06', accent: '#4ade80' },
]

// ─── CANVAS RENDERER ──────────────────────────────────────────────────────────
function drawBanner(canvas, { fmt, style, fields, logoImg }) {
  const { w, h } = fmt
  const ctx = canvas.getContext('2d')
  canvas.width  = w
  canvas.height = h

  const isDark  = style.bg.startsWith('#0') || style.bg.startsWith('#1') || style.bg.startsWith('#03')
  const textPrimary   = isDark ? '#ffffff' : '#0a2612'
  const textSecondary = isDark ? 'rgba(255,255,255,0.72)' : '#166534'
  const gold   = style.accent
  const isLandscape = w > h

  // ── Background ──
  const grad = ctx.createLinearGradient(0, 0, w * 0.6, h)
  grad.addColorStop(0,   style.bg)
  grad.addColorStop(0.6, style.bg === '#f0fdf4' ? '#dcfce7' : blendDark(style.bg, 0.4))
  grad.addColorStop(1,   style.bg === '#f0fdf4' ? '#bbf7d0' : blendDark(style.bg, 0.7))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // ── Decorative circles ──
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.fillStyle = gold
  ctx.beginPath()
  ctx.arc(w * 0.88, h * 0.12, w * 0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(w * 0.05, h * 0.92, w * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── Gold top bar ──
  ctx.fillStyle = gold
  ctx.fillRect(0, 0, w, Math.round(h * 0.012))

  // ── Gold bottom bar ──
  ctx.fillStyle = gold
  ctx.fillRect(0, h - Math.round(h * 0.012), w, Math.round(h * 0.012))

  // ── Gold left stripe ──
  ctx.fillStyle = gold
  ctx.globalAlpha = 0.6
  ctx.fillRect(0, 0, Math.round(w * 0.006), h)
  ctx.globalAlpha = 1

  // Layout constants
  const pad  = isLandscape ? w * 0.055 : w * 0.08
  const midX = isLandscape ? w * 0.38  : w / 2
  const align = isLandscape ? 'left' : 'center'
  let y = isLandscape ? h * 0.16 : h * 0.13

  // ── Logo ──
  const logoSize = isLandscape ? h * 0.22 : w * 0.2
  if (logoImg) {
    const lx = isLandscape ? w * 0.72 : (w - logoSize) / 2
    const ly = isLandscape ? (h - logoSize) / 2 : y
    ctx.save()
    ctx.beginPath()
    ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize)
    ctx.restore()
    if (!isLandscape) y += logoSize + h * 0.04
  }

  // ── CCGM label ──
  const labelSize = Math.round(h * 0.028)
  ctx.font = `600 ${labelSize}px 'Lato', sans-serif`
  ctx.fillStyle = gold
  ctx.textAlign = align
  ctx.letterSpacing = '3px'
  ctx.fillText('CHRISTIAN CHURCH OF GOD MISSION', isLandscape ? pad : midX, y)
  y += labelSize * 1.6

  // ── Divider ──
  ctx.strokeStyle = gold
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1.5
  if (isLandscape) {
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w * 0.65, y); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(w * 0.2, y); ctx.lineTo(w * 0.8, y); ctx.stroke()
  }
  ctx.globalAlpha = 1
  y += h * 0.035

  // ── Title ──
  const titleSize = isLandscape ? Math.round(h * 0.14) : Math.round(w * 0.09)
  ctx.font = `bold ${titleSize}px 'Playfair Display', Georgia, serif`
  ctx.fillStyle = textPrimary
  ctx.textAlign = align
  const titleLines = wrapText(ctx, fields.title || '', isLandscape ? w * 0.6 - pad * 2 : w - pad * 2)
  for (const line of titleLines) {
    ctx.fillText(line, isLandscape ? pad : midX, y)
    y += titleSize * 1.15
  }
  y += h * 0.01

  // ── Subtitle ──
  if (fields.subtitle) {
    const subSize = Math.round(titleSize * 0.38)
    ctx.font = `italic ${subSize}px 'Playfair Display', Georgia, serif`
    ctx.fillStyle = gold
    ctx.textAlign = align
    const subLines = wrapText(ctx, fields.subtitle, isLandscape ? w * 0.6 - pad * 2 : w - pad * 2)
    for (const line of subLines) {
      ctx.fillText(line, isLandscape ? pad : midX, y)
      y += subSize * 1.4
    }
    y += h * 0.02
  }

  // ── Theme verse ──
  if (fields.theme) {
    const verseSize = Math.round(titleSize * 0.28)
    ctx.font = `italic ${verseSize}px 'Lato', sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,38,18,0.55)'
    ctx.textAlign = align
    const vLines = wrapText(ctx, `"${fields.theme}"`, isLandscape ? w * 0.6 - pad * 2 : w - pad * 2)
    for (const line of vLines) {
      ctx.fillText(line, isLandscape ? pad : midX, y)
      y += verseSize * 1.5
    }
    y += h * 0.025
  }

  // ── Details block ──
  const detSize = Math.round(titleSize * 0.33)
  const details = [
    fields.date  && { icon: '📅', val: fields.date },
    fields.time  && { icon: '🕘', val: fields.time },
    fields.venue && { icon: '📍', val: fields.venue },
  ].filter(Boolean)

  for (const d of details) {
    ctx.font = `${detSize}px 'Lato', sans-serif`
    ctx.fillStyle = textSecondary
    ctx.textAlign = align
    const text = `${d.icon}  ${d.val}`
    ctx.fillText(text, isLandscape ? pad : midX, y)
    y += detSize * 1.7
  }

  // ── CTA ──
  if (fields.cta) {
    y += h * 0.02
    const ctaH  = Math.round(h * 0.06)
    const ctaW  = isLandscape ? Math.min(w * 0.45, 600) : w * 0.72
    const ctaX  = isLandscape ? pad : (w - ctaW) / 2
    const ctaY  = isLandscape ? h - ctaH - h * 0.08 : y
    ctx.fillStyle = gold
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2)
    ctx.fill()
    ctx.font = `600 ${Math.round(ctaH * 0.38)}px 'Lato', sans-serif`
    ctx.fillStyle = '#0a2612'
    ctx.textAlign = 'center'
    ctx.fillText(fields.cta, ctaX + ctaW / 2, ctaY + ctaH * 0.64)
  }

  // ── Website watermark ──
  const wmSize = Math.round(h * 0.022)
  ctx.font = `${wmSize}px 'Lato', sans-serif`
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(10,38,18,0.25)'
  ctx.textAlign = 'right'
  ctx.fillText('ccgm-pwa.vercel.app', w - pad, h - h * 0.035)
}

function wrapText(ctx, text, maxW) {
  if (!text) return []
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
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

function blendDark(hex, amt) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(amt * 40))
  const g = Math.min(255, ((num >>  8) & 0xff) + Math.round(amt * 40))
  const b = Math.min(255, ((num      ) & 0xff) + Math.round(amt * 40))
  return `rgb(${r},${g},${b})`
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function BannerGenerator() {
  const [type,    setType]    = useState('event')
  const [fmtId,   setFmtId]   = useState('whatsapp')
  const [styleId, setStyleId] = useState('classic')
  const [fields,  setFields]  = useState(TEMPLATES.event.defaults)
  const [logoImg, setLogoImg] = useState(null)
  const canvasRef = useRef(null)

  const fmt   = FORMATS.find(f => f.id === fmtId)
  const style = DESIGN_STYLES.find(s => s.id === styleId)

  // Load logo on mount
  useEffect(() => {
    const img = new Image()
    img.src = '/logo.png'
    img.onload = () => setLogoImg(img)
  }, [])

  // Redraw whenever anything changes
  const draw = useCallback(() => {
    if (!canvasRef.current) return
    drawBanner(canvasRef.current, { fmt, style, fields, logoImg })
  }, [fmt, style, fields, logoImg])

  useEffect(() => { draw() }, [draw])

  // Switch template type
  const switchType = (t) => {
    setType(t)
    setFields(TEMPLATES[t].defaults)
  }

  const setField = (k, v) => setFields(f => ({ ...f, [k]: v }))

  const download = () => {
    if (!canvasRef.current) return
    const a = document.createElement('a')
    a.download = `ccgm-banner-${fmtId}-${Date.now()}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }

  const isDark = style.bg.startsWith('#0') || style.bg.startsWith('#1') || style.bg.startsWith('#03')

  return (
    <>
      <SEO
        title="Banner Generator"
        description="Create beautiful CCG World event and announcement banners for WhatsApp, Instagram, and more."
        path="/banner-generator"
      />

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)',
        padding: 'clamp(90px,14vw,130px) 5% 60px',
        textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--brand-glow)' }}>Design Tools</span>
        <h1 style={{
          fontFamily: 'var(--font-display)', color: 'white',
          fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 12,
        }}>
          Banner Generator
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
          Design professional church banners for WhatsApp, Instagram, and print in seconds.
        </p>
      </div>

      {/* ── Main ── */}
      <div style={{ background: 'var(--cream)', minHeight: '60vh', padding: '48px 4% 80px' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'clamp(280px,35%,400px) 1fr',
          gap: 32,
          alignItems: 'start',
        }}>

          {/* ── LEFT: Controls ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Template type */}
            <Card title="Banner Type">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <button key={k} onClick={() => switchType(k)} style={{
                    padding: '12px 8px', borderRadius: 10, border: '2px solid',
                    borderColor: type === k ? 'var(--brand-base)' : 'var(--brand-pale)',
                    background: type === k ? 'var(--brand-pale)' : 'white',
                    color: 'var(--text-dark)', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Format */}
            <Card title="Output Format">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setFmtId(f.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, border: '2px solid',
                    borderColor: fmtId === f.id ? 'var(--brand-base)' : 'var(--brand-pale)',
                    background: fmtId === f.id ? 'var(--brand-pale)' : 'white',
                    color: 'var(--text-dark)', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 500,
                    transition: 'all 0.15s',
                  }}>
                    <span>{f.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{f.w}×{f.h}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Style */}
            <Card title="Colour Style">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DESIGN_STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyleId(s.id)} style={{
                    padding: '10px 6px', borderRadius: 10, border: '2px solid',
                    borderColor: styleId === s.id ? s.accent : 'transparent',
                    background: s.bg, cursor: 'pointer', position: 'relative',
                    transition: 'transform 0.15s',
                    transform: styleId === s.id ? 'scale(1.04)' : 'scale(1)',
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.accent, margin: '0 auto 4px' }} />
                    <div style={{ color: s.accent, fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-body)' }}>{s.label}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Text fields */}
            <Card title="Content">
              {[
                { key: 'title',    label: 'Title',          placeholder: 'e.g. Annual Convention' },
                { key: 'subtitle', label: 'Subtitle / Theme verse caption', placeholder: 'e.g. Walking in the Light' },
                { key: 'date',     label: 'Date',           placeholder: 'e.g. Saturday, 10 May 2025' },
                { key: 'time',     label: 'Time',           placeholder: 'e.g. 9:00 AM' },
                { key: 'venue',    label: 'Venue',          placeholder: 'e.g. CCG World Headquarters' },
                { key: 'theme',    label: 'Bible Reference (optional)', placeholder: 'e.g. Isaiah 60:1' },
                { key: 'cta',      label: 'Call to Action', placeholder: 'e.g. All are welcome' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-mid)', marginBottom: 4 }}>
                    {label}
                  </label>
                  <input
                    value={fields[key] || ''}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={placeholder}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1.5px solid var(--brand-pale)', background: 'white',
                      fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-dark)',
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand-base)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--brand-pale)'}
                  />
                </div>
              ))}
            </Card>
          </div>

          {/* ── RIGHT: Preview + Download ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 90 }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: 20,
              boxShadow: 'var(--shadow-md)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text-dark)', fontWeight: 700 }}>
                  Preview
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {fmt.w}×{fmt.h}px
                </span>
              </div>

              {/* Canvas wrapper — scales to fit */}
              <div style={{
                width: '100%',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: '#e8e8e8', borderRadius: 10, padding: 8, overflow: 'hidden',
              }}>
                <canvas
                  ref={canvasRef}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: 6,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    display: 'block',
                  }}
                />
              </div>
            </div>

            {/* Download */}
            <button onClick={download} style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, var(--brand-dark), var(--brand-mid))',
              color: 'white', border: 'none', borderRadius: 12,
              fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.5px',
              boxShadow: 'var(--shadow-md)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = 'var(--shadow-lg)' }}
              onMouseLeave={e => { e.target.style.transform = 'translateY(0)';   e.target.style.boxShadow = 'var(--shadow-md)' }}
            >
              ⬇ Download PNG
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Downloads as a full-resolution PNG ready for WhatsApp, Instagram, or print.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .banner-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}

// ─── Small reusable card ──────────────────────────────────────────────────────
function Card({ title, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14,
      padding: '18px 16px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: '0.9rem',
        color: 'var(--brand-dark)', marginBottom: 14, fontWeight: 700,
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
