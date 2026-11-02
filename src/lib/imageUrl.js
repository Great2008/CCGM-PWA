// src/lib/imageUrl.js
// Serve Gallery photos from OUR OWN domain instead of the host's (ImgBB or Supabase).
//
// Why: Google Images works best when a photo lives on a domain you've verified in Search Console,
// and you can't verify ibb.co or supabase.co. vercel.json forwards
//     /img/supa/<id>/<file>    ->  https://i.supaimg.com/<id>/<file>              (SupaImg direct links)
//     /img/ibb/<id>/<file>      ->  https://i.ibb.co/<id>/<file>                   (ImgBB direct links)
//     /img/<bucket>/<file>      ->  Supabase public storage                        (Supabase links)
// so each photo appears at https://www.ccgworld.name.ng/img/... Links from any other website are
// left untouched (we can't proxy those).
//
// Set SERVE_IMAGES_FROM_OWN_DOMAIN to false to switch this off everywhere.
export const SERVE_IMAGES_FROM_OWN_DOMAIN = true
export const SITE_ORIGIN = 'https://www.ccgworld.name.ng'

// [original address starts with, our own-domain path]  (order does not matter: prefixes are distinct)
export const IMAGE_HOSTS = [
  ['https://i.supaimg.com/', '/img/supa/'],
  ['https://i.ibb.co/', '/img/ibb/'],
  ['https://gxetxqlzuipiymdmibpt.supabase.co/storage/v1/object/public/', '/img/'],
]

export function ownDomainImageUrl(url) {
  const u = String(url || '').trim()
  if (SERVE_IMAGES_FROM_OWN_DOMAIN) {
    for (const [prefix, path] of IMAGE_HOSTS) {
      if (u.startsWith(prefix)) return `${SITE_ORIGIN}${path}${u.slice(prefix.length)}`
    }
  }
  return u
}

// <img onError={...}>: if the own-domain copy ever fails to load, quietly fall back to the
// original link, so a photo is never left broken.
export const onImageError = (original) => (e) => {
  const img = e.currentTarget
  if (original && img.src !== original && !img.dataset.fellBack) { img.dataset.fellBack = '1'; img.src = original }
}
