import { useState, useEffect } from 'react'
import { getSiteSetting } from '../lib/siteSettings'

const STORAGE_KEY = 'ccgm-verse-dismissed'
const API_CACHE_KEY = 'ccgm-verse-api-cache'
const BG_COLORS = [
  { label:'Deep Green', value:'linear-gradient(135deg,#0a2612,#166534)' },
  { label:'Gold Amber', value:'linear-gradient(135deg,#92400e,#d97706)' },
  { label:'Royal Blue', value:'linear-gradient(135deg,#1e3a5f,#2563eb)' },
  { label:'Deep Purple', value:'linear-gradient(135deg,#3b0764,#7c3aed)' },
  { label:'Crimson', value:'linear-gradient(135deg,#7f1d1d,#dc2626)' },
  { label:'Teal', value:'linear-gradient(135deg,#0f3460,#0d9488)' },
]

const DEFAULT_BG = BG_COLORS[0].value

async function fetchApiVerse(today) {
  // The verse only changes once a day, so cache it client-side keyed by
  // date instead of re-fetching (with cache:'no-store', no less) on every
  // single page load — this was a ~1.2s request sitting in the critical
  // render path on first paint.
  try {
    const cached = JSON.parse(localStorage.getItem(API_CACHE_KEY) || 'null')
    if (cached?.date === today && cached?.text && cached?.reference) {
      return { text: cached.text, reference: cached.reference }
    }
  } catch(_) {}

  try {
    const res = await fetch('https://beta.ourmanna.com/api/v1/get/?format=json')
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    const text = data?.verse?.details?.text?.trim()
    const ref  = data?.verse?.details?.reference?.trim()
    if (text && ref) {
      try { localStorage.setItem(API_CACHE_KEY, JSON.stringify({ date: today, text, reference: ref })) } catch(_) {}
      return { text, reference: ref }
    }
  } catch(_) {}
  // Hardcoded fallback in case API is down
  return {
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    reference: 'John 3:16',
  }
}

export default function DailyVerseBanner() {
  const [verse, setVerse]       = useState(null)   // { text, reference, reflection, bg }
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Check if dismissed today
    const today = new Date().toISOString().split('T')[0]
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === today) { setDismissed(true); setLoading(false); return }

    async function load() {
      // 1. Check admin override
      const override = await getSiteSetting('daily_verse')
      if (override?.reference && override?.text && override?.override_date === today) {
        setVerse({
          text: override.text,
          reference: override.reference,
          reflection: override.reflection || '',
          bg: override.bg_color || DEFAULT_BG,
          source: 'admin',
        })
        setLoading(false)
        return
      }

      // 2. Fall back to API
      const api = await fetchApiVerse(today)
      setVerse({
        text: api.text,
        reference: api.reference,
        reflection: '',
        bg: override?.bg_color || DEFAULT_BG,
        source: 'api',
      })
      setLoading(false)
    }
    // Delay fetch until after LCP — ourmanna API was sitting on critical path
    // If verse is cached from today it loads instantly anyway after the timeout
    const t = setTimeout(load, 2500)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(STORAGE_KEY, today)
    setDismissed(true)
  }

  const share = async () => {
    const msg = `📖 Daily Verse\n\n${verse.reference}\n\n"${verse.text}"\n\n— CCG World\n🌐`
    try {
      if (navigator.share) {
        await navigator.share({ title:'Daily Verse — CCG World', text: msg, url: 'https://ccgm-pwa.vercel.app' })
      } else {
        await navigator.clipboard.writeText(msg)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch(_) {
      try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(()=>setCopied(false),2000) } catch(_) {}
    }
  }

  if (loading || dismissed || !verse) return null

  return (
    <>
      {/* Backdrop when expanded */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3999, backdropFilter:'blur(2px)' }}
        />
      )}

      {/* Banner */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 4000,
        padding: expanded ? '0' : '0 12px 12px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%',
          maxWidth: expanded ? '100%' : 640,
          background: verse.bg,
          borderRadius: expanded ? '20px 20px 0 0' : 16,
          boxShadow: '0 -4px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          pointerEvents: 'all',
          transition: 'border-radius 0.3s, max-width 0.3s',
        }}>

          {/* Collapsed pill */}
          {!expanded && (
            <div
              onClick={() => setExpanded(true)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer' }}
            >
              <span style={{ fontSize:'1.2rem', flexShrink:0 }}>📖</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:1 }}>
                  Daily Verse
                </div>
                <div style={{ color:'white', fontWeight:700, fontSize:'0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {verse.reference} — Tap to read
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.75rem' }}>▲</span>
                <button
                  onClick={e => { e.stopPropagation(); dismiss() }}
                  style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:26, height:26, cursor:'pointer', color:'white', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                >✕</button>
              </div>
            </div>
          )}

          {/* Expanded card */}
          {expanded && (
            <div style={{ padding:'28px 24px 32px' }}>
              {/* Header row */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:'1.4rem' }}>📖</span>
                  <div>
                    <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em' }}>Daily Verse</div>
                    <div style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.72rem' }}>
                      {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:32, height:32, cursor:'pointer', color:'white', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}
                >▼</button>
              </div>

              {/* Decorative quote mark */}
              <div style={{ fontSize:'4rem', color:'rgba(255,255,255,0.12)', lineHeight:1, marginBottom:-16, fontFamily:'Georgia, serif' }}>"</div>

              {/* Verse text */}
              <p style={{
                fontFamily:'Georgia, serif',
                fontStyle:'italic',
                fontSize:'clamp(1rem,3vw,1.25rem)',
                color:'white',
                lineHeight:1.8,
                margin:'0 0 16px',
                textShadow:'0 1px 8px rgba(0,0,0,0.2)',
              }}>
                {verse.text}
              </p>

              {/* Reference */}
              <div style={{
                display:'inline-block',
                background:'rgba(255,255,255,0.15)',
                borderRadius:20,
                padding:'5px 16px',
                color:'rgba(255,255,255,0.95)',
                fontWeight:800,
                fontSize:'0.88rem',
                marginBottom: verse.reflection ? 18 : 24,
                letterSpacing:'0.03em',
              }}>
                — {verse.reference}
              </div>

              {/* Reflection */}
              {verse.reflection && (
                <div style={{
                  background:'rgba(255,255,255,0.1)',
                  borderRadius:12,
                  padding:'14px 16px',
                  marginBottom:24,
                  borderLeft:'3px solid rgba(255,255,255,0.35)',
                }}>
                  <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6 }}>
                    Reflection
                  </div>
                  <p style={{ color:'rgba(255,255,255,0.88)', fontSize:'0.88rem', lineHeight:1.7, margin:0 }}>
                    {verse.reflection}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button
                  onClick={share}
                  style={{
                    display:'flex', alignItems:'center', gap:7,
                    background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)',
                    borderRadius:30, padding:'9px 20px', cursor:'pointer',
                    color:'white', fontWeight:700, fontSize:'0.84rem', fontFamily:'var(--font-body)',
                    transition:'background 0.2s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.28)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}
                >
                  {copied ? '✅ Copied!' : '🔗 Share Verse'}
                </button>

                <button
                  onClick={dismiss}
                  style={{
                    background:'transparent', border:'1px solid rgba(255,255,255,0.2)',
                    borderRadius:30, padding:'9px 20px', cursor:'pointer',
                    color:'rgba(255,255,255,0.65)', fontWeight:600, fontSize:'0.84rem', fontFamily:'var(--font-body)',
                  }}
                >
                  Dismiss for today
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Export colour options for use in admin
export { BG_COLORS, DEFAULT_BG }
