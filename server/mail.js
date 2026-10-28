// server/mail.js
// Shared helpers for the email API routes in /api (Resend + Supabase auth).
// Lives OUTSIDE /api on purpose so Vercel doesn't count it as a function.
//
// Vercel env vars needed (Project Settings -> Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY   (already set for the podcast route)
//   RESEND_API_KEY        Resend API key (re_...)
//   RESEND_FROM_EMAIL     address on your verified Resend domain
//   RESEND_FROM_NAME      optional, defaults to "CCG World"
//   ADMIN_ALERT_EMAIL     where auto-suspension alerts are sent
import { createClient } from '@supabase/supabase-js'

export const APP_URL = process.env.APP_URL || 'https://ccgm-pwa.vercel.app'
export const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── HTTP plumbing ────────────────────────────────────────────────────────────
// CORS is open because auth is a Bearer token, not cookies. This also lets the
// Capacitor mobile app (which is NOT served from the Vercel domain) call these.
// Returns true if the request was fully handled (preflight / wrong method).
export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return true }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return true }
  return false
}

// ── Supabase auth ────────────────────────────────────────────────────────────
export const serviceClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

// Verifies the caller's Supabase session token. Returns { user, userClient } or null.
export async function authenticate(req) {
  const h = req.headers.authorization || ''
  if (!h.startsWith('Bearer ')) return null
  const token = h.slice(7)
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data?.user) return null
  return { user: data.user, userClient }
}

// Uses the same is_admin() RPC the rest of the app relies on.
export async function isAdmin(ctx) {
  const { data } = await ctx.userClient.rpc('is_admin')
  return !!data
}

// ── Resend ───────────────────────────────────────────────────────────────────
function fromHeader() {
  const email = process.env.RESEND_FROM_EMAIL
  if (!email) throw new Error('RESEND_FROM_EMAIL is not set')
  return `${process.env.RESEND_FROM_NAME || 'CCG World'} <${email}>`
}

async function resend(path, payload) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.resend.com${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (r.ok) return r.json().catch(() => ({}))
    if (r.status === 429 && attempt < 2) { await sleep(1000 * (attempt + 1)); continue }
    const err = await r.json().catch(() => ({}))
    throw new Error(err.message || `Resend error ${r.status}`)
  }
}

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)

// One email. attachments: [{ filename, contentType, base64 }]
export function sendEmail({ to, subject, html, text, attachments = [] }) {
  const payload = { from: fromHeader(), to: [to], subject, html, text }
  if (attachments.length) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename, content: a.base64, content_type: a.contentType,
    }))
  }
  return resend('/emails', payload)
}

// Up to 100 emails in ONE request (no attachments allowed by Resend's batch API).
export function sendBatch(messages) {
  return resend('/emails/batch', messages.map(m => ({
    from: fromHeader(), to: [m.to], subject: m.subject, html: m.html, text: m.text,
  })))
}

// Powers the admin "Delivery Logs" tab. Never throws.
export async function logDelivery(sb, rows) {
  try { if (rows.length) await sb.from('email_delivery_logs').insert(rows) } catch (_) { /* ignore */ }
}

// ── Formatting ───────────────────────────────────────────────────────────────
export const escapeHtml = s =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function formatDate(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d)) return String(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

// ── RSVP confirmation (shared by guest-rsvp and send-rsvp-confirmation) ──────
export function rsvpConfirmationEmail({ name, event, registrationId }) {
  const prettyDate = formatDate(event.date)
  const dateLine = event.time ? `${prettyDate} · ${event.time}` : prettyDate
  const eventUrl = `${APP_URL}/events#event-${event.id}`
  const subject = `🎟️ Your RSVP is Confirmed — ${event.title}`
  const t = escapeHtml(event.title), n = escapeHtml(name)
  const loc = event.location ? escapeHtml(event.location) : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Dear ${n},</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Thank you for registering for <strong>${t}</strong>. We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:24px 0 4px;"><strong>${t}</strong></p>
    <p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Date: ${escapeHtml(dateLine)}</p>
    ${loc ? `<p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Venue: ${loc}</p>` : ''}
    <p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Status: RSVP Confirmed</p>
    <p style="font-size:0.9rem;line-height:1.6;margin:0 0 24px;color:#4b5563;">Registration ID: ${escapeHtml(registrationId)}</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus. Please keep this email for your records.</p>
    <p style="font-size:0.95rem;margin:24px 0;"><a href="${eventUrl}" style="color:#2563eb;">View Event on CCG World</a></p>
    <p style="font-size:0.95rem;line-height:1.6;margin:24px 0 0;">We look forward to welcoming you${loc ? ` at ${loc}` : ''}.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
    <p style="font-size:0.75rem;color:#9ca3af;margin:0;line-height:1.6;">God first always. God bless you.<br/>One Family. One Faith. One Mission.<br/>CCG World.</p>
  </div>
</body></html>`

  const text = [
    `Dear ${name},`, ``,
    `Thank you for registering for ${event.title}. We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.`, ``,
    event.title, `Date: ${dateLine}`,
    event.location ? `Venue: ${event.location}` : '', `Status: RSVP Confirmed`,
    `Registration ID: ${registrationId}`, ``,
    `Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus.`,
    `Please keep this email for your records.`, ``,
    `View Event: ${eventUrl}`, ``,
    `God first always. God bless you.`, `One Family. One Faith. One Mission.`, `CCG World.`,
  ].filter(Boolean).join('\n')

  return { subject, html, text }
}
