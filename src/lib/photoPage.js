// src/lib/photoPage.js
// Addresses for individual Gallery photo pages, shared by the website and the server.
//   /photo/<id>/<slug>      e.g.  /photo/42/easter-sunday-2026
// The slug is only there to make the address readable (and good for search); the id is what matters.
import { SITE_ORIGIN } from './imageUrl.js'

export function slugify(text, max = 60) {
  let s = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (s.length > max) { s = s.slice(0, max); const cut = s.lastIndexOf('-'); if (cut > 20) s = s.slice(0, cut); s = s.replace(/-+$/, '') }
  return s
}

export const photoSlug = (img) => slugify(img?.title || img?.caption) || 'photo'
export const photoPath = (img) => `/photo/${encodeURIComponent(img.id)}/${photoSlug(img)}`
export const photoUrl  = (img) => `${SITE_ORIGIN}${photoPath(img)}`
