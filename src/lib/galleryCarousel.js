// src/lib/galleryCarousel.js
// Pure helpers for the Gallery page (kept separate so they can be tested without a browser).

// Position of slide `i` relative to the centre slide: 0 = centre, negative = left, positive = right.
// Wraps around, so the carousel loops forever.
export function carouselOffset(i, active, n) {
  const half = Math.floor(n / 2)
  return (((i - active + half) % n) + n) % n - half
}

export const MAX_VISIBLE = 2   // how many slides to show on each side of the centre one

// The 3D look: neighbours step sideways, sink back, turn inward, shrink and blur a little.
export function slideLook(offset, reduced = false) {
  const abs = Math.abs(offset)
  return {
    transform: `translate(-50%, -50%) translateX(${offset * 56}%) translateZ(${-abs * 160}px) rotateY(${-offset * 34}deg) scale(${1 - abs * 0.06})`,
    filter: abs === 0 ? 'none' : `blur(${abs * 1.6}px) brightness(${1 - abs * 0.12})`,
    zIndex: 10 - abs,
    transition: reduced ? 'none' : 'transform 0.6s cubic-bezier(.22,.8,.3,1), filter 0.6s ease',
  }
}

const plain = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Category chip + title search (case- and accent-insensitive, matches anywhere in the title).
export function filterGallery(images, category = 'All', query = '') {
  const q = plain(query)
  return images.filter(img =>
    (category === 'All' || img.category === category) &&
    (!q || plain(img.title).includes(q)))
}
