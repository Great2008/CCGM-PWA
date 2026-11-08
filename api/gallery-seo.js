// api/gallery-seo.js — everything Google needs to find individual Gallery photos.
// (Replaces api/sitemap-images.js. vercel.json maps these addresses here:)
//   /sitemap-images.xml        -> ?kind=sitemap   image sitemap: every photo page + its image
//   /photo/<id>/<slug>         -> ?kind=photo     one server-rendered page per photo
// Pages are plain HTML (not JavaScript-built), so Google and WhatsApp/Facebook previews can read
// the title, caption and image straight away.
import { createClient } from '@supabase/supabase-js'
import { ownDomainImageUrl, SITE_ORIGIN } from '../src/lib/imageUrl.js'
import { imageLinkProblem } from '../src/lib/photoText.js'
import { photoPath, photoSlug } from '../src/lib/photoPage.js'

export const config = { maxDuration: 15 }

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const one = v => String(Array.isArray(v) ? v[0] : (v ?? ''))
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400'
const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })

// ───────────────────────── sitemap ─────────────────────────
async function sitemap(res) {
  const { data, error } = await db().from('gallery')
    .select('id,url,created_at,date').order('created_at', { ascending: false }).limit(5000)
  if (error) throw error

  const seen = new Set()
  const photos = []
  for (const row of data || []) {
    if (row.id == null || seen.has(row.id) || imageLinkProblem(row.url)) continue   // blank, not https, or an ImgBB page link
    seen.add(row.id); photos.push(row)
  }

  const imageTag = row => `    <image:image><image:loc>${esc(ownDomainImageUrl(row.url))}</image:loc></image:image>`
  const pages = photos.map(row => {
    const last = String(row.created_at || row.date || '').slice(0, 10)
    return `  <url>\n    <loc>${esc(SITE_ORIGIN + photoPath({ ...row, title: null, caption: null }).replace(/\/photo$/, ''))}</loc>${last ? `\n    <lastmod>${last}</lastmod>` : ''}\n${imageTag(row)}\n  </url>`
  })
  // the Gallery page itself, listing its first 1,000 photos (Google's limit per page)
  const galleryEntry = `  <url>\n    <loc>${SITE_ORIGIN}/gallery</loc>\n${photos.slice(0, 1000).map(imageTag).join('\n')}\n  </url>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[galleryEntry, ...pages].join('\n')}
</urlset>
`
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', CACHE)
  return res.status(200).send(xml)
}

// ───────────────────────── photo page ─────────────────────────
const STYLE = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#f4f7f5;color:#1f2937;line-height:1.6}
a{color:#166534}header{background:#0a2612;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:12px}
header a{color:#fff;text-decoration:none;font-weight:700}header img{width:34px;height:34px;border-radius:8px}header nav{margin-left:auto;display:flex;gap:16px;font-size:.9rem}
main{max-width:920px;margin:0 auto;padding:20px 16px 48px}.crumbs{font-size:.82rem;color:#64748b;margin-bottom:12px}.crumbs a{color:#64748b}
h1{font-size:1.5rem;line-height:1.3;margin:0 0 14px;color:#0a2612}figure{margin:0}figure img{display:block;width:100%;height:auto;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);background:#e2e8f0}
figcaption{margin:14px 2px 0;font-size:1rem}.meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 2px;font-size:.88rem;color:#64748b}
.tag{background:#dcfce7;color:#166534;font-weight:700;font-size:.78rem;padding:3px 10px;border-radius:20px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 8px}.btn{display:inline-block;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:.9rem;padding:10px 20px;border-radius:30px;text-decoration:none;background:#166534;color:#fff}
.btn.alt{background:#fff;color:#166534;border:1.5px solid #bbf7d0}h2{font-size:1.1rem;margin:34px 0 12px;color:#0a2612}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.grid a{display:block;border-radius:10px;overflow:hidden;background:#e2e8f0;aspect-ratio:4/3}.grid img{width:100%;height:100%;object-fit:cover;display:block}
footer{text-align:center;color:#64748b;font-size:.8rem;padding:24px 16px}`

const FALLBACK = `onerror="if(!this.dataset.f&&this.dataset.orig){this.dataset.f=1;this.src=this.dataset.orig}"`

function prettyDate(d) {
  const t = new Date(d); if (!d || isNaN(t)) return ''
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function renderPhoto(photo, related) {
  const name = String(photo.title || photo.caption || 'Photo').trim()
  const caption = String(photo.caption || '').trim()
  const desc = (caption || `${name}. A photo from the CCG World (Christian Church Of God Mission) gallery.`).slice(0, 160)
  const pageUrl = SITE_ORIGIN + photoPath(photo)
  const imgUrl = ownDomainImageUrl(photo.url)
  const when = prettyDate(photo.date || photo.created_at)
  const pageTitle = `${name} | CCG World Gallery`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ImageObject',
        contentUrl: imgUrl, url: pageUrl, name, caption: caption || name, description: desc,
        uploadDate: String(photo.created_at || photo.date || '').slice(0, 10) || undefined,
        representativeOfPage: true,
        isPartOf: { '@type': 'ImageGallery', name: 'CCG World Photo Gallery', url: `${SITE_ORIGIN}/gallery` },
        publisher: { '@type': 'Organization', name: 'CCG World', url: SITE_ORIGIN },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
          { '@type': 'ListItem', position: 2, name: 'Gallery', item: `${SITE_ORIGIN}/gallery` },
          { '@type': 'ListItem', position: 3, name, item: pageUrl },
        ],
      },
    ],
  }).replace(/</g, '\\u003c')

  const relatedHtml = related.length ? `
  <h2>More photos</h2>
  <div class="grid">${related.map(r => {
    const rName = String(r.title || r.caption || 'Photo')
    return `<a href="${esc(photoPath(r))}" title="${esc(rName)}"><img src="${esc(ownDomainImageUrl(r.url))}" data-orig="${esc(r.url)}" ${FALLBACK} alt="${esc(r.caption || rName)}" loading="lazy" decoding="async"></a>`
  }).join('')}</div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0a2612">
<link rel="icon" href="/favicon.ico">
<meta property="og:site_name" content="CCG World">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(imgUrl)}">
<meta property="og:image:alt" content="${esc(caption || name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(imgUrl)}">
<script type="application/ld+json">${jsonLd}</script>
<style>${STYLE}</style>
</head>
<body>
<header><img src="/icon-128.png" alt=""><a href="/">CCG World</a><nav><a href="/gallery">Gallery</a><a href="/events">Events</a></nav></header>
<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/gallery">Gallery</a> › ${esc(name)}</nav>
  <h1>${esc(name)}</h1>
  <figure>
    <img src="${esc(imgUrl)}" data-orig="${esc(photo.url)}" ${FALLBACK} alt="${esc(caption || name)}" decoding="async" fetchpriority="high">
    ${caption && caption !== name ? `<figcaption>${esc(caption)}</figcaption>` : ''}
  </figure>
  <div class="meta">${photo.category ? `<span class="tag">${esc(photo.category)}</span>` : ''}${when ? `<span>${esc(when)}</span>` : ''}</div>
  <div class="actions">
    <a class="btn" href="/gallery">← All photos</a>
    <a class="btn alt" href="${esc(imgUrl)}" download>⬇ Download</a>
    <button class="btn alt" id="share" type="button">🔗 Share</button>
  </div>${relatedHtml}
</main>
<footer>© CCG World — God first always. God bless you.</footer>
<script>
document.getElementById('share').addEventListener('click', async function () {
  var b = this, data = { title: document.title, url: location.href.split('#')[0] };
  try {
    if (navigator.share) { await navigator.share(data); }
    else { await navigator.clipboard.writeText(data.url); b.textContent = '✓ Link copied'; setTimeout(function () { b.textContent = '🔗 Share'; }, 2000); }
  } catch (e) {}
});
</script>
</body>
</html>`
}

const notFound = (res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=60')
  return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Photo not found | CCG World</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#1f2937}a{color:#166534;font-weight:700}</style></head><body><h1>Photo not found</h1><p>This photo may have been removed.</p><p><a href="/gallery">← Back to the gallery</a></p></body></html>`)
}

async function photoPage(req, res) {
  const id = one(req.query.id)
  if (!ID_RE.test(id)) return notFound(res)
  const sb = db()
  const { data: photo, error } = await sb.from('gallery')
    .select('id,url,title,caption,category,date,created_at').eq('id', id).maybeSingle()
  if (error || !photo || imageLinkProblem(photo.url)) return notFound(res)

  // One canonical address per photo: /photo/<id>/<slug>. Anything else is redirected to it.
  const canonical = photoPath(photo)
  if (one(req.query.slug) !== photoSlug(photo)) {
    res.setHeader('Location', canonical)
    res.setHeader('Cache-Control', 'public, s-maxage=3600')
    return res.status(301).end()
  }

  // "More photos": same category first, then the newest, so every photo page links to others
  let related = []
  if (photo.category) {
    const r = await sb.from('gallery').select('id,url,title,caption').eq('category', photo.category)
      .neq('id', photo.id).order('created_at', { ascending: false }).limit(6)
    related = (r.data || []).filter(x => !imageLinkProblem(x.url))
  }
  if (related.length < 6) {
    const r = await sb.from('gallery').select('id,url,title,caption').neq('id', photo.id)
      .order('created_at', { ascending: false }).limit(12)
    const have = new Set(related.map(x => String(x.id)))
    for (const x of r.data || []) {
      if (related.length >= 6) break
      if (!have.has(String(x.id)) && !imageLinkProblem(x.url)) related.push(x)
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', CACHE)
  return res.status(200).send(renderPhoto(photo, related))
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  try {
    const kind = one(req.query.kind)
    if (kind === 'sitemap') return await sitemap(res)
    if (kind === 'photo') return await photoPage(req, res)
    return notFound(res)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).send('Temporarily unavailable')
  }
}
