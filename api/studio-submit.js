// api/studio-submit.js — a signed-in member suggests a YouTube video for the Studio page.
// Goes into the review queue as "pending"; nothing is public until staff approve it.
import { cors, authenticate, serviceClient, emailConfigured, sendEmail, escapeHtml, APP_URL } from '../server/mail.js'

export const config = { maxDuration: 20 }

const CATEGORIES = ['sermon', 'teaching', 'worship', 'testimony', 'other']
const MAX_PENDING = 3          // waiting for review at once, per member
const MAX_PER_DAY = 5          // submissions per rolling 24 hours, per member

// Accepts watch / youtu.be / embed / shorts / live links. Returns the 11-char video id or null.
function parseYouTubeId(input) {
  let u
  try { u = new URL(String(input).trim()) } catch { return null }
  const host = u.hostname.replace(/^(www\.|m\.)/, '')
  let id = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)
      if (m) id = m[1]
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

// YouTube's public oEmbed endpoint: no API key needed. It fails for private,
// deleted and embedding-disabled videos, which is exactly what we want to reject.
async function lookupVideo(id) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`,
      { signal: ctrl.signal },
    )
    if (!r.ok) return null
    return await r.json()
  } catch { return null } finally { clearTimeout(timer) }
}

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx) return res.status(401).json({ error: 'Please sign in to suggest a video' })

  try {
    const { url, title, description, category, showName } = req.body || {}
    const sb = serviceClient()

    const { data: profile } = await sb.from('profiles')
      .select('suspended, display_name, full_name').eq('id', ctx.user.id).maybeSingle()
    if (profile?.suspended) return res.status(403).json({ error: 'Your account is suspended, so you cannot submit videos right now' })

    const videoId = parseYouTubeId(url)
    if (!videoId) return res.status(400).json({ error: 'That doesn’t look like a YouTube video link' })

    const cleanDesc = String(description || '').trim().slice(0, 500)
    const cleanCat = CATEGORIES.includes(category) ? category : 'other'
    const userTitle = String(title || '').trim().slice(0, 100)
    if (userTitle && userTitle.length < 3) return res.status(400).json({ error: 'Title is too short' })

    // Rate limits
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [{ count: pending }, { count: today }] = await Promise.all([
      sb.from('studio_submissions').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user.id).eq('status', 'pending'),
      sb.from('studio_submissions').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user.id).gte('created_at', since),
    ])
    if ((pending || 0) >= MAX_PENDING) return res.status(429).json({ error: `You already have ${MAX_PENDING} suggestions waiting for review. Please wait for a decision first.` })
    if ((today || 0) >= MAX_PER_DAY) return res.status(429).json({ error: 'You’ve reached today’s limit for suggestions. Please try again tomorrow.' })

    // Already featured, pending or live?
    const [{ data: pin }, { data: existing }] = await Promise.all([
      sb.from('studio_pins').select('id').eq('video_id', videoId).maybeSingle(),
      sb.from('studio_submissions').select('id,status').eq('video_id', videoId).in('status', ['pending', 'approved']).maybeSingle(),
    ])
    if (pin || existing?.status === 'approved') return res.status(409).json({ error: 'This video is already on the Studio page' })
    if (existing) return res.status(409).json({ error: 'This video has already been suggested and is waiting for review' })

    const info = await lookupVideo(videoId)
    if (!info) return res.status(422).json({ error: 'We couldn’t find that video. It may be private, removed, or have embedding turned off.' })

    const submitterName = profile?.display_name || profile?.full_name || 'Member'
    const row = {
      user_id: ctx.user.id,
      video_id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: userTitle || String(info.title || 'Untitled video').slice(0, 100),
      description: cleanDesc || null,
      category: cleanCat,
      channel_name: info.author_name || null,
      submitter_name: submitterName,
      show_name: showName !== false,
    }
    const { data: saved, error } = await sb.from('studio_submissions').insert(row)
      .select('id,video_id,title,category,status,created_at').single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'This video has just been suggested by someone else' })
      return res.status(500).json({ error: error.message })
    }

    // Best-effort heads-up to the admin inbox; never affects the member's result.
    const adminTo = process.env.ADMIN_ALERT_EMAIL
    if (adminTo && emailConfigured()) {
      sendEmail({
        to: adminTo,
        subject: `🎬 New Studio suggestion: ${row.title}`,
        html: `<p>${escapeHtml(submitterName)} suggested a video for the Studio page:</p>
<p><strong>${escapeHtml(row.title)}</strong> (${escapeHtml(row.category)})<br/>${escapeHtml(info.author_name || '')}</p>
<p><a href="${row.url}">Watch on YouTube</a> · <a href="${APP_URL}/admin">Open the admin panel to review</a></p>`,
        text: `${submitterName} suggested "${row.title}" (${row.category}).\n${row.url}\nReview it in the admin panel: ${APP_URL}/admin`,
      }).catch(() => {})
    }

    return res.status(200).json({ success: true, submission: saved })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
