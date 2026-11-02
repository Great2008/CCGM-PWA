// api/sitemap-images.js — image sitemap for Google, always fresh, served at /sitemap-images.xml
// (vercel.json maps that address here). Lists every Gallery photo on the /gallery page, so Google
// can find photos that only appear after the page's JavaScript runs. Cached for an hour.
import { createClient } from '@supabase/supabase-js'
import { ownDomainImageUrl, SITE_ORIGIN } from '../src/lib/imageUrl.js'
import { imageLinkProblem } from '../src/lib/photoText.js'

export const config = { maxDuration: 15 }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const MAX_IMAGES = 1000   // Google's limit per <url> entry

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end()
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data, error } = await sb.from('gallery').select('url').order('created_at', { ascending: false }).limit(MAX_IMAGES * 2)
    if (error) throw error

    const seen = new Set()
    const urls = []
    for (const row of data || []) {
      if (imageLinkProblem(row.url)) continue        // blank, not http(s), or an ImgBB page link
      const u = ownDomainImageUrl(row.url)
      if (!u || seen.has(u)) continue
      seen.add(u); urls.push(u)
      if (urls.length >= MAX_IMAGES) break
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_ORIGIN}/gallery</loc>
${urls.map(u => `    <image:image><image:loc>${esc(u)}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).send(xml)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).send('Sitemap temporarily unavailable')
  }
}
