// src/components/GalleryCarousel.jsx
// 3D "cover flow" showcase for the FEATURED gallery photos: sharp photo in the centre, tilted and
// slightly blurred photos on both sides. Swipe, tap the arrows, use the arrow keys, or tap a side
// photo to bring it forward. Tapping the centre photo opens the full-screen viewer.
import { useState, useEffect, useRef, useCallback } from 'react'
import { carouselOffset, slideLook, MAX_VISIBLE } from '../lib/galleryCarousel'
import { ownDomainImageUrl, onImageError } from '../lib/imageUrl'

const arrow = (side) => ({
  position: 'absolute', top: '50%', [side]: 4, transform: 'translateY(-50%)', zIndex: 30,
  width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.92)', color: 'var(--brand-deep, #0a2612)', fontSize: '1.5rem', lineHeight: 1,
  boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
})

export default function GalleryCarousel({ items, onOpen }) {
  const n = items.length
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)
  const resumeTimer = useRef(null)
  const reduced = useRef(typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches).current

  useEffect(() => { if (active >= n) setActive(0) }, [n, active])
  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  const go = useCallback((d) => setActive(a => (a + d + n) % n), [n])

  // Gentle autoplay: pauses on hover, touch and hidden tabs; off entirely for "reduce motion".
  useEffect(() => {
    if (n < 2 || paused || reduced) return
    const t = setInterval(() => { if (!document.hidden) go(1) }, 5000)
    return () => clearInterval(t)
  }, [n, paused, reduced, go, active])

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; setPaused(true); clearTimeout(resumeTimer.current) }
  const onTouchEnd = (e) => {
    if (touchX.current !== null) {
      const dx = e.changedTouches[0].clientX - touchX.current
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    }
    touchX.current = null
    resumeTimer.current = setTimeout(() => setPaused(false), 8000)
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    else if (e.key === 'Enter') { e.preventDefault(); onOpen(items[active]) }
  }

  if (!n) return null
  const current = items[active]

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span className="section-label">⭐ Featured</span>
      </div>

      <div
        role="region" aria-roledescription="carousel" aria-label="Featured photos" tabIndex={0}
        onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        style={{
          position: 'relative', height: 'clamp(300px, 74vw, 560px)', perspective: '1100px', overflow: 'hidden',
          touchAction: 'pan-y', outline: 'none', borderRadius: 24,
          background: 'radial-gradient(ellipse at 50% 85%, rgba(245,158,11,0.18), rgba(255,255,255,0) 65%), linear-gradient(180deg, var(--brand-pale, #ecfdf5), rgba(255,255,255,0.4))',
        }}
      >
        {items.map((img, i) => {
          const offset = carouselOffset(i, active, n)
          if (Math.abs(offset) > MAX_VISIBLE) return null        // only a few photos are ever on the page
          const look = slideLook(offset, reduced)
          const centre = offset === 0
          return (
            <div
              key={img.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}
              onClick={() => (centre ? onOpen(img) : setActive(i))}
              style={{
                position: 'absolute', left: '50%', top: '50%', width: 'min(80%, 560px)', aspectRatio: '4 / 3',
                borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: '#0f172a',
                boxShadow: centre ? '0 30px 60px rgba(0,0,0,0.38)' : '0 14px 30px rgba(0,0,0,0.22)',
                ...look,
              }}
            >
              <img
                src={ownDomainImageUrl(img.url || img.src)} onError={onImageError(img.url || img.src)} alt={img.caption || img.title || ''} draggable={false}
                loading={Math.abs(offset) <= 1 ? 'eager' : 'lazy'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none' }}
              />
            </div>
          )
        })}

        {n > 1 && (<>
          <button onClick={() => go(-1)} aria-label="Previous photo" style={arrow('left')}>‹</button>
          <button onClick={() => go(1)} aria-label="Next photo" style={arrow('right')}>›</button>
        </>)}
      </div>

      <div style={{ textAlign: 'center', marginTop: 16, minHeight: 56 }} aria-live="polite">
        {(current.title || current.caption) && (
          <div style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.1rem', fontWeight: 700 }}>
            {current.title || current.caption}
          </div>
        )}
        {current.category && <span className="tag" style={{ marginTop: 6, display: 'inline-block' }}>{current.category}</span>}
      </div>

      {n > 1 && n <= 12 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          {items.map((img, i) => (
            <button key={img.id} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} style={{
              width: i === active ? 22 : 9, height: 9, borderRadius: 5, border: 'none', cursor: 'pointer', padding: 0,
              background: i === active ? 'var(--brand-mid, #1d4ed8)' : '#cbd5e1', transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}
      {n > 12 && <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>{active + 1} / {n}</div>}
    </div>
  )
}
