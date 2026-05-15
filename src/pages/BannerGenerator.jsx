import { useState, useRef, useEffect, useCallback } from 'react'
import SEO from '../components/SEO'

// ─── Constants ─────────────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'portrait',  label: 'WhatsApp / IG Portrait', w: 1080, h: 1350 },
  { id: 'square',    label: 'IG Square',               w: 1080, h: 1080 },
  { id: 'story',     label: 'Story / Status',          w: 1080, h: 1920 },
  { id: 'landscape', label: 'Website / Print',         w: 1920, h: 768  },
]

const THEMES = [
  { id: 'forest',   label: 'Forest Green', bg1: '#0a2e14', bg2: '#14532d', accent: '#d4a017', accent2: '#f5d060' },
  { id: 'midnight', label: 'Midnight',     bg1: '#050d14', bg2: '#0f2236', accent: '#d4a017', accent2: '#f5d060' },
  { id: 'crimson',  label: 'Crimson',      bg1: '#3b0a0a', bg2: '#1c0505', accent: '#f5d060', accent2: '#fffde7' },
  { id: 'purple',   label: 'Royal Purple', bg1: '#1e0a3b', bg2: '#2d1060', accent: '#d4a017', accent2: '#f5d060' },
]

const TEMPLATES = {
  event: {
    label: 'Event / Conference', icon: '📅',
    defaults: {
      churchLine1: 'CHRISTIAN CHURCH',
      churchLine2: 'OF GOD MISSION',
      title: 'ANNUAL GENERAL\nCONFERENCE 2026',
      date: '1ST - 5TH APRIL 2026',
      themeLabel: 'THEME:',
      theme: 'LIVING IN THE\nSAFE HAND OF GOD',
      cta: '',
    },
  },
  announcement: {
    label: 'Announcement', icon: '📢',
    defaults: {
      churchLine1: 'CHRISTIAN CHURCH',
      churchLine2: 'OF GOD MISSION',
      title: 'SATURDAY\nWORSHIP SERVICE',
      date: 'EVERY SATURDAY · 9:00 AM',
      themeLabel: 'NOTE:',
      theme: 'ALL ARE WELCOME.\nCOME PREPARED TO WORSHIP.',
      cta: '',
    },
  },
  crusade: {
    label: 'Crusade / Revival', icon: '🔥',
    defaults: {
      churchLine1: 'CHRISTIAN CHURCH',
      churchLine2: 'OF GOD MISSION',
      title: 'POWER &\nGLORY CRUSADE',
      date: '20TH - 25TH JUNE 2026',
      themeLabel: 'THEME:',
      theme: '"THE SPIRIT OF THE LORD\nIS UPON ME" – LUKE 4:18',
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
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r)
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h)
  ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r)
  ctx.quadraticCurveTo(x,y,x+r,y)
  ctx.closePath()
}

function loadImg(src) {
  return new Promise((res,rej) => {
    const i = new Image(); i.crossOrigin='anonymous'
    i.onload=()=>res(i); i.onerror=rej; i.src=src
  })
}

function drawLeftRibbon(ctx, W, H) {
  ctx.save()
  // Outer gold ribbon
  const g1 = ctx.createLinearGradient(0,0,130,H)
  g1.addColorStop(0,   '#fef9c3')
  g1.addColorStop(0.15,'#f59e0b')
  g1.addColorStop(0.5, '#b45309')
  g1.addColorStop(0.75,'#f59e0b')
  g1.addColorStop(1,   '#fde68a')
  ctx.fillStyle = g1
  ctx.beginPath()
  ctx.moveTo(0,0)
  ctx.bezierCurveTo(130,H*0.08, 90,H*0.38, 110,H*0.55)
  ctx.bezierCurveTo(125,H*0.65, 80,H*0.78, 0,H)
  ctx.lineTo(0,H); ctx.lineTo(0,0)
  ctx.fill()

  // Inner highlight
  const g2 = ctx.createLinearGradient(0,0,60,H)
  g2.addColorStop(0,  'rgba(255,253,200,0.85)')
  g2.addColorStop(0.3,'rgba(255,220,80,0.45)')
  g2.addColorStop(0.7,'rgba(180,83,9,0.35)')
  g2.addColorStop(1,  'rgba(255,240,120,0.65)')
  ctx.fillStyle = g2
  ctx.beginPath()
  ctx.moveTo(0,0)
  ctx.bezierCurveTo(55,H*0.1, 40,H*0.4, 50,H*0.56)
  ctx.bezierCurveTo(58,H*0.65, 36,H*0.8, 0,H)
  ctx.lineTo(0,H); ctx.lineTo(0,0)
  ctx.fill()

  // Bottom curve flourish
  const g3 = ctx.createLinearGradient(0,H-180,W*0.55,H)
  g3.addColorStop(0,  '#fde68a')
  g3.addColorStop(0.4,'#f59e0b')
  g3.addColorStop(1,  '#b45309')
  ctx.fillStyle = g3
  ctx.beginPath()
  ctx.moveTo(0,H)
  ctx.bezierCurveTo(W*0.18,H-200, W*0.45,H-90, W*0.62,H-30)
  ctx.bezierCurveTo(W*0.72,H-12,  W*0.85,H-4,  W,H)
  ctx.lineTo(W,H); ctx.lineTo(0,H)
  ctx.fill()

  // Bright edge on flourish
  ctx.strokeStyle='rgba(255,253,200,0.7)'; ctx.lineWidth=3
  ctx.beginPath()
  ctx.moveTo(0,H-8)
  ctx.bezierCurveTo(W*0.2,H-180, W*0.48,H-78, W*0.65,H-22)
  ctx.bezierCurveTo(W*0.75,H-8,  W*0.87,H-2,  W,H-2)
  ctx.stroke()
  ctx.restore()
}

function drawSkyCross(ctx, W, H) {
  ctx.save()
  const cx=W*0.72, cy=H*0.15
  const crossH=H*0.2, crossW=crossH*0.09
  const armW=crossH*0.4, armH=crossH*0.08, armY=cy-crossH*0.18

  const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,H*0.26)
  glow.addColorStop(0,  'rgba(255,255,210,0.6)')
  glow.addColorStop(0.3,'rgba(255,240,150,0.22)')
  glow.addColorStop(0.7,'rgba(255,220,80,0.06)')
  glow.addColorStop(1,  'rgba(0,0,0,0)')
  ctx.fillStyle=glow
  ctx.fillRect(cx-H*0.28, cy-H*0.22, H*0.56, H*0.5)

  const cg=ctx.createLinearGradient(cx,cy-crossH/2,cx,cy+crossH/2)
  cg.addColorStop(0,'rgba(255,255,230,0.95)')
  cg.addColorStop(1,'rgba(255,240,160,0.55)')
  ctx.fillStyle=cg
  ctx.fillRect(cx-crossW/2, cy-crossH/2, crossW, crossH)
  ctx.fillRect(cx-armW/2, armY-armH/2, armW, armH)
  ctx.restore()
}

function drawCrowdSilhouette(ctx, W, H) {
  ctx.save()
  // Glow
  const glow=ctx.createRadialGradient(W/2,H*0.8,0,W/2,H*0.8,W*0.38)
  glow.addColorStop(0,  'rgba(255,210,60,0.4)')
  glow.addColorStop(0.4,'rgba(255,190,40,0.12)')
  glow.addColorStop(1,  'rgba(0,0,0,0)')
  ctx.fillStyle=glow
  ctx.fillRect(0,H*0.6,W,H*0.4)

  // Cross
  const cx=W/2
  ctx.fillStyle='rgba(15,15,8,0.85)'
  ctx.fillRect(cx-13,H*0.7,26,H*0.18)
  ctx.fillRect(cx-58,H*0.75,116,17)

  // People
  ctx.fillStyle='rgba(0,0,0,0.82)'
  const count=Math.floor(W/34)
  for(let i=0;i<count;i++){
    const x=(i+0.5)*(W/count)
    const hr=20+Math.sin(i*2.7)*6
    const bH=52+Math.cos(i*1.9)*10
    const bY=H-bH
    ctx.beginPath(); ctx.arc(x,bY-hr,hr,0,Math.PI*2); ctx.fill()
    ctx.fillRect(x-11,bY,22,bH)
    if(i%4===1){
      ctx.beginPath()
      ctx.moveTo(x-4,bY+8); ctx.lineTo(x-26,bY-60); ctx.lineTo(x-17,bY-60); ctx.lineTo(x+3,bY+8)
      ctx.fill()
    }
    if(i%4===3){
      ctx.beginPath()
      ctx.moveTo(x+4,bY+8); ctx.lineTo(x+26,bY-50); ctx.lineTo(x+17,bY-50); ctx.lineTo(x-3,bY+8)
      ctx.fill()
    }
  }
  ctx.restore()
}

async function drawBanner(canvas, { fmt, theme, fields, logoImg, bgImg, crowdImg }) {
  const {w,h} = fmt
  canvas.width=w; canvas.height=h
  const ctx=canvas.getContext('2d')
  ctx.textBaseline='alphabetic'
  const isLandscape=w>h
  const S=w/1080

  // 1. Sky background
  const sky=ctx.createLinearGradient(0,0,0,h*0.55)
  sky.addColorStop(0,  '#c8dce8')
  sky.addColorStop(0.4,'#e0d4b0')
  sky.addColorStop(1,  '#a8b89a')
  ctx.fillStyle=sky; ctx.fillRect(0,0,w,h)

  const ray=ctx.createRadialGradient(w/2,0,0,w/2,0,w*0.88)
  ray.addColorStop(0,  'rgba(255,250,215,0.88)')
  ray.addColorStop(0.3,'rgba(255,240,170,0.38)')
  ray.addColorStop(0.7,'rgba(200,220,200,0.08)')
  ray.addColorStop(1,  'rgba(0,0,0,0)')
  ctx.fillStyle=ray; ctx.fillRect(0,0,w,h*0.6)

  if(bgImg){
    ctx.save(); ctx.globalAlpha=0.35
    ctx.drawImage(bgImg,0,0,w,h)
    ctx.restore()
  }

  // 2. Green overlay
  const ov=ctx.createLinearGradient(0,h*0.16,0,h)
  ov.addColorStop(0,  'rgba(10,46,20,0)')
  ov.addColorStop(0.18,'rgba(10,46,20,0.86)')
  ov.addColorStop(0.45,'rgba(10,46,20,0.95)')
  ov.addColorStop(1,  'rgba(4,18,9,0.99)')
  ctx.fillStyle=ov; ctx.fillRect(0,0,w,h)

  // 3. Sky cross
  if(!isLandscape) drawSkyCross(ctx,w,h)

  // 4. Crowd / silhouette at bottom
  if(crowdImg){
    const cH=Math.round(h*0.3), cY=h-cH
    ctx.save()
    const cf=ctx.createLinearGradient(0,cY,0,h)
    cf.addColorStop(0,'rgba(0,0,0,0)'); cf.addColorStop(0.35,'rgba(0,0,0,1)')
    ctx.globalCompositeOperation='destination-out'
    ctx.fillStyle=cf; ctx.fillRect(0,cY,w,cH)
    ctx.globalCompositeOperation='source-over'
    ctx.globalAlpha=0.78
    ctx.drawImage(crowdImg,0,cY,w,cH)
    ctx.restore()
  } else {
    drawCrowdSilhouette(ctx,w,h)
  }

  // 5. Gold ribbon
  ctx.save(); ctx.scale(S,S)
  drawLeftRibbon(ctx,w/S,h/S)
  ctx.restore()

  // 6. Logo — NO circle clip, full shield shape
  const logoSize=Math.round(isLandscape ? h*0.3 : w*0.2)
  const logoX=isLandscape ? w*0.77 : (w-logoSize)/2
  const logoY=Math.round(isLandscape ? (h-logoSize)/2-h*0.12 : h*0.032)

  if(logoImg){
    // Soft halo glow
    ctx.save()
    const halo=ctx.createRadialGradient(
      logoX+logoSize/2, logoY+logoSize/2, logoSize*0.15,
      logoX+logoSize/2, logoY+logoSize/2, logoSize*0.85
    )
    halo.addColorStop(0,  'rgba(255,255,210,0.5)')
    halo.addColorStop(0.5,'rgba(255,250,190,0.18)')
    halo.addColorStop(1,  'rgba(0,0,0,0)')
    ctx.fillStyle=halo
    ctx.fillRect(logoX-logoSize*0.3, logoY-logoSize*0.2, logoSize*1.6, logoSize*1.4)
    ctx.restore()
    // Draw full logo, no clipping
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
  }

  let y = isLandscape ? h*0.12 : logoY+logoSize+Math.round(h*0.016)

  // 7. Church name — two lines, white bold
  const cSize=Math.round(w*(isLandscape?0.03:0.056))
  const cX=isLandscape ? w*0.5 : w/2
  ctx.textAlign='center'
  ctx.font=`900 ${cSize}px Arial Black, Arial, sans-serif`
  for(const line of [fields.churchLine1||'CHRISTIAN CHURCH', fields.churchLine2||'OF GOD MISSION']){
    ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=10
    ctx.fillStyle='#ffffff'
    ctx.fillText(line, cX, y)
    ctx.shadowBlur=0
    y+=cSize*1.28
  }
  y+=cSize*0.7

  // 8. Giant gold title
  const tSize=Math.round(w*(isLandscape?0.07:0.116))
  const tMaxW=isLandscape ? w*0.56 : w*0.9
  ctx.font=`900 ${tSize}px Arial Black, Arial, sans-serif`
  const tLines=wrapText(ctx, fields.title||'', tMaxW)

  const tGrad=ctx.createLinearGradient(0,y-tSize,0,y+tSize*tLines.length*1.12)
  tGrad.addColorStop(0,  '#fffde7')
  tGrad.addColorStop(0.28,'#f5d060')
  tGrad.addColorStop(0.6, '#d4a017')
  tGrad.addColorStop(1,   '#7a5000')

  const tX=isLandscape ? w*0.06+140*S : w/2
  ctx.textAlign=isLandscape?'left':'center'

  for(const line of tLines){
    ctx.font=`900 ${tSize}px Arial Black, Arial, sans-serif`
    ctx.strokeStyle='#0a2e14'; ctx.lineWidth=tSize*0.09; ctx.lineJoin='round'
    ctx.strokeText(line,tX,y)
    ctx.fillStyle=tGrad
    ctx.fillText(line,tX,y)
    y+=tSize*1.1
  }
  y+=tSize*0.22

  // 9. Date
  if(fields.date){
    const dSize=Math.round(w*(isLandscape?0.03:0.052))
    ctx.font=`800 ${dSize}px Arial, sans-serif`
    ctx.fillStyle='#ffffff'; ctx.textAlign=isLandscape?'left':'center'
    ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=6
    ctx.fillText(fields.date, isLandscape?w*0.06+140*S:w/2, y)
    ctx.shadowBlur=0
    y+=dSize*2.4
  }

  // 10. Theme box
  if(fields.theme){
    const thSize=Math.round(w*(isLandscape?0.026:0.054))
    const lbSize=Math.round(thSize*0.58)
    const bPadX=Math.round(42*S), bPadY=Math.round(30*S)
    const bMarX=isLandscape?w*0.06+140*S:Math.round(56*S)
    const bW=isLandscape?w*0.5:w-bMarX*2
    ctx.font=`800 ${thSize}px Arial Black, Arial, sans-serif`
    const thLines=wrapText(ctx, fields.theme, bW-bPadX*2)
    const bH=bPadY*2+lbSize*2.2+thLines.length*thSize*1.3
    const bX=isLandscape?w*0.06+140*S:bMarX
    const bY=y

    // Dark box
    ctx.save()
    roundRect(ctx,bX,bY,bW,bH,Math.round(26*S))
    ctx.fillStyle='rgba(6,28,14,0.84)'; ctx.fill()
    ctx.strokeStyle='#d4a017'; ctx.lineWidth=Math.round(3*S); ctx.stroke()
    // Inner glow border
    roundRect(ctx,bX+5*S,bY+5*S,bW-10*S,bH-10*S,Math.round(22*S))
    ctx.strokeStyle='rgba(245,208,96,0.28)'; ctx.lineWidth=Math.round(1.5*S); ctx.stroke()
    ctx.restore()

    let ty=bY+bPadY+lbSize
    ctx.font=`800 ${lbSize}px Arial, sans-serif`
    ctx.fillStyle='#d4a017'; ctx.textAlign='center'
    ctx.fillText((fields.themeLabel||'THEME:').toUpperCase(), bX+bW/2, ty)
    ty+=lbSize*2.2

    ctx.font=`800 ${thSize}px Arial Black, Arial, sans-serif`
    ctx.fillStyle='#ffffff'; ctx.textAlign='center'
    for(const line of thLines){
      ctx.shadowColor='rgba(0,0,0,0.45)'; ctx.shadowBlur=4
      ctx.fillText(line, bX+bW/2, ty)
      ctx.shadowBlur=0
      ty+=thSize*1.3
    }
    y=bY+bH+Math.round(28*S)
  }

  // 11. CTA
  if(fields.cta){
    const cS=Math.round(w*0.036)
    ctx.font=`600 ${cS}px Arial, sans-serif`
    ctx.fillStyle='rgba(255,255,255,0.68)'; ctx.textAlign=isLandscape?'left':'center'
    for(const line of wrapText(ctx,fields.cta,isLandscape?w*0.5:w*0.82)){
      ctx.fillText(line, isLandscape?w*0.06+140*S:w/2, y)
      y+=cS*1.6
    }
  }

  // 12. Watermark
  ctx.font=`500 ${Math.round(20*S)}px Arial, sans-serif`
  ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.textAlign='right'; ctx.shadowBlur=0
  ctx.fillText('ccgm-pwa.vercel.app', w-Math.round(30*S), h-Math.round(26*S))
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function BannerGenerator() {
  const [type,      setType]      = useState('event')
  const [fmtId,     setFmtId]     = useState('portrait')
  const [themeId,   setThemeId]   = useState('forest')
  const [fields,    setFields]    = useState(TEMPLATES.event.defaults)
  const [logoImg,   setLogoImg]   = useState(null)
  const [bgImg,     setBgImg]     = useState(null)
  const [crowdImg,  setCrowdImg]  = useState(null)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef(null)
  const bgRef     = useRef(null)
  const crowdRef  = useRef(null)

  const fmt   = FORMATS.find(f=>f.id===fmtId)
  const theme = THEMES.find(t=>t.id===themeId)

  useEffect(() => { loadImg('/logo.png').then(setLogoImg).catch(()=>{}) }, [])

  const draw = useCallback(async () => {
    if(!canvasRef.current) return
    setRendering(true)
    try { await drawBanner(canvasRef.current,{fmt,theme,fields,logoImg,bgImg,crowdImg}) }
    catch(e){ console.error('Banner draw error:',e) }
    setRendering(false)
  },[fmt,theme,fields,logoImg,bgImg,crowdImg])

  useEffect(()=>{ draw() },[draw])

  const switchType = t => { setType(t); setFields(TEMPLATES[t].defaults) }
  const setField   = (k,v) => setFields(f=>({...f,[k]:v}))

  const download = () => {
    if(!canvasRef.current) return
    const a=document.createElement('a')
    a.download=`ccgm-banner-${fmtId}-${Date.now()}.png`
    a.href=canvasRef.current.toDataURL('image/png'); a.click()
  }

  const handleImg = (e, setter) => {
    const file=e.target.files?.[0]; if(!file) return
    const r=new FileReader()
    r.onload=ev=>loadImg(ev.target.result).then(setter).catch(()=>{})
    r.readAsDataURL(file)
  }

  const inp = {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:'1.5px solid var(--brand-pale)', background:'white',
    fontFamily:'var(--font-body)', fontSize:'0.85rem',
    color:'var(--text-dark)', boxSizing:'border-box',
  }

  return (
    <>
      <SEO title="Banner Generator" description="Create beautiful CCG World event and announcement banners." path="/banner-generator" />

      <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(90px,14vw,130px) 5% 60px',textAlign:'center'}}>
        <span className="section-label" style={{color:'var(--brand-glow)'}}>Design Tools</span>
        <h1 style={{fontFamily:'var(--font-display)',color:'white',fontSize:'clamp(2rem,5vw,3rem)',marginBottom:12}}>🎨 Banner Generator</h1>
        <p style={{color:'rgba(255,255,255,0.75)',maxWidth:500,margin:'0 auto',lineHeight:1.8}}>
          Design professional church banners for WhatsApp, Instagram, Stories and print.
        </p>
      </div>

      <div style={{background:'var(--cream)',minHeight:'60vh',padding:'32px 4% 80px'}}>
        <div style={{maxWidth:680,margin:'0 auto',display:'flex',flexDirection:'column',gap:18}}>

          {/* Preview */}
          <div style={{background:'white',borderRadius:16,padding:16,boxShadow:'var(--shadow-md)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--text-dark)',fontWeight:700}}>
                {rendering ? '⏳ Rendering…' : '✅ Preview'}
              </span>
              <span style={{fontSize:'0.74rem',color:'var(--text-muted)'}}>{fmt.w}×{fmt.h}px</span>
            </div>
            <div style={{width:'100%',background:'#111',borderRadius:10,padding:8,lineHeight:0}}>
              <canvas ref={canvasRef} style={{width:'100%',height:'auto',display:'block',borderRadius:6,boxShadow:'0 4px 20px rgba(0,0,0,0.35)'}} />
            </div>
          </div>

          {/* Download */}
          <button onClick={download} style={{width:'100%',padding:16,background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',color:'white',border:'none',borderRadius:12,fontFamily:'var(--font-body)',fontSize:'1rem',fontWeight:700,cursor:'pointer',boxShadow:'var(--shadow-md)'}}>
            ⬇ Download PNG
          </button>

          {/* Banner Type */}
          <Card title="Banner Type">
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {Object.entries(TEMPLATES).map(([k,t])=>(
                <button key={k} onClick={()=>switchType(k)} style={{padding:'12px 8px',borderRadius:10,border:'2px solid',borderColor:type===k?'var(--brand-base)':'var(--brand-pale)',background:type===k?'var(--brand-pale)':'white',color:'var(--text-dark)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.8rem',fontWeight:600,transition:'all 0.15s'}}>
                  <div style={{fontSize:'1.4rem',marginBottom:4}}>{t.icon}</div>{t.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Format */}
          <Card title="Output Format">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {FORMATS.map(f=>(
                <button key={f.id} onClick={()=>setFmtId(f.id)} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'10px 14px',borderRadius:8,border:'2px solid',borderColor:fmtId===f.id?'var(--brand-base)':'var(--brand-pale)',background:fmtId===f.id?'var(--brand-pale)':'white',color:'var(--text-dark)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.82rem',fontWeight:600,transition:'all 0.15s'}}>
                  {f.label}
                  <span style={{fontSize:'0.7rem',color:'var(--text-muted)',fontWeight:400,marginTop:2}}>{f.w}×{f.h}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Theme */}
          <Card title="Colour Theme">
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
              {THEMES.map(t=>(
                <button key={t.id} onClick={()=>setThemeId(t.id)} style={{padding:'12px 6px',borderRadius:10,border:`2px solid ${themeId===t.id?t.accent:'transparent'}`,background:t.bg1,cursor:'pointer',transition:'transform 0.15s',transform:themeId===t.id?'scale(1.07)':'scale(1)'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',background:t.accent,margin:'0 auto 5px'}}/>
                  <div style={{color:t.accent,fontSize:'0.65rem',fontWeight:700,fontFamily:'var(--font-body)'}}>{t.label}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Photos */}
          <Card title="Photos (optional)">
            <p style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:12}}>Upload a background and/or a crowd/hands photo for the bottom section.</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {label:'Background Photo', ref:bgRef, img:bgImg, setter:setBgImg, icon:'📷', text:'Choose background…'},
                {label:'Crowd / Hands Photo (bottom)', ref:crowdRef, img:crowdImg, setter:setCrowdImg, icon:'👐', text:'Choose crowd photo…'},
              ].map(({label,ref,img,setter,icon,text})=>(
                <div key={label}>
                  <label style={{fontSize:'0.75rem',fontWeight:600,color:'var(--text-mid)',display:'block',marginBottom:4}}>{label}</label>
                  <div style={{display:'flex',gap:8}}>
                    <input ref={ref} type="file" accept="image/*" onChange={e=>handleImg(e,setter)} style={{display:'none'}}/>
                    <button onClick={()=>ref.current?.click()} style={{flex:1,padding:'9px',borderRadius:8,border:'2px dashed var(--brand-pale)',background:'#f8fafc',color:'var(--text-mid)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.82rem'}}>
                      {img ? '✅ Uploaded' : `${icon} ${text}`}
                    </button>
                    {img && <button onClick={()=>setter(null)} style={{padding:'9px 12px',borderRadius:8,border:'1px solid #fecaca',background:'#fff5f5',color:'#dc2626',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.8rem'}}>✕</button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Content */}
          <Card title="Content">
            {[
              {key:'churchLine1', label:'Church Name Line 1', placeholder:'CHRISTIAN CHURCH',             multi:false},
              {key:'churchLine2', label:'Church Name Line 2', placeholder:'OF GOD MISSION',               multi:false},
              {key:'title',       label:'Event Title',        placeholder:'ANNUAL GENERAL\nCONFERENCE',   multi:true },
              {key:'date',        label:'Date',               placeholder:'1ST - 5TH APRIL 2026',         multi:false},
              {key:'themeLabel',  label:'Theme Box Label',    placeholder:'THEME:',                       multi:false},
              {key:'theme',       label:'Theme / Message',    placeholder:'LIVING IN THE\nSAFE HAND OF GOD', multi:true},
              {key:'cta',         label:'Call to Action',     placeholder:'All are welcome',              multi:false},
            ].map(({key,label,placeholder,multi})=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:'0.75rem',fontWeight:600,color:'var(--text-mid)',marginBottom:4}}>{label}</label>
                {multi
                  ? <textarea value={fields[key]||''} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} rows={2} style={{...inp,resize:'vertical'}}/>
                  : <input   value={fields[key]||''} onChange={e=>setField(key,e.target.value)} placeholder={placeholder} style={inp}/>
                }
              </div>
            ))}
            <p style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:2}}>💡 Use new lines in Title and Theme to control line breaks on the banner.</p>
          </Card>

          <p style={{textAlign:'center',fontSize:'0.74rem',color:'var(--text-muted)',lineHeight:1.6}}>
            Downloads as full-resolution PNG. Ready for WhatsApp, Instagram, or print.
          </p>
        </div>
      </div>
    </>
  )
}

function Card({ title, children }) {
  return (
    <div style={{background:'white',borderRadius:14,padding:'18px 16px',boxShadow:'var(--shadow-sm)'}}>
      <h3 style={{fontFamily:'var(--font-display)',fontSize:'0.9rem',color:'var(--brand-dark)',marginBottom:14,fontWeight:700}}>{title}</h3>
      {children}
    </div>
  )
}
