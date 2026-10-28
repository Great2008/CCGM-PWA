// api/send-newsletter.js — bulk email to a recipient list (newsletter + admin Email tool).
// Replaces the Supabase edge function of the same name. ADMIN ONLY.
//
// Sending strategy:
//   - No attachments: Resend's batch API, 100 emails per request (fast, 1 call per 100).
//     If a batch is rejected (e.g. one bad address), that chunk falls back to one-by-one
//     so only the bad address fails.
//   - With attachments: one-by-one (Resend batch can't carry attachments), ~4 per second.
//   - A 52s deadline protects against Vercel's function timeout; anything not reached is
//     reported as failed ("time limit reached") in Delivery Logs so you can resend it.
// Vercel request bodies max out at ~4.5 MB, so total attachment size must stay under ~3 MB.
import {
  cors, authenticate, isAdmin, serviceClient, emailConfigured,
  sendEmail, sendBatch, logDelivery, escapeHtml, sleep,
} from '../server/mail.js'

export const config = { maxDuration: 60 }

// ── Markdown-lite -> HTML (same rules as src/lib/textFormat.jsx) ─────────────
const inline = s => s ? escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') : ''

function parseBlocks(text) {
  if (!text) return []
  const blocks = []
  let para = []
  const flush = () => { const j = para.join(' ').trim(); if (j) blocks.push(j); para = [] }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (/^##/.test(t) && t.length > 2) { flush(); blocks.push(t) }
    else if (/^#/.test(t) && t.length > 1 && !t.startsWith('##')) { flush(); blocks.push(t) }
    else if (t === '') flush()
    else para.push(t)
  }
  flush()
  return blocks.filter(Boolean)
}

const bodyToHtml = text => parseBlocks(text).map(b => {
  if (/^##/.test(b)) return `<h3 style="font-family:Georgia,serif;color:#166534;font-size:1.1rem;margin:24px 0 8px;border-bottom:2px solid #d1fae5;padding-bottom:4px;">${inline(b.replace(/^##\s*/, ''))}</h3>`
  if (/^#/.test(b)) return `<h4 style="color:#16a34a;font-size:1rem;margin:18px 0 6px;font-weight:700;">${inline(b.replace(/^#\s*/, ''))}</h4>`
  return `<p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;color:#1f2937;">${inline(b)}</p>`
}).join('')

const stripMd = str => str.split('\n').map(l => l.replace(/^##?\s*/, '')).join('\n')
  .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx || !(await isAdmin(ctx))) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const {
      subject,
      greeting  = 'Dear {name},',
      body,
      signature = 'God first always. God bless you.\nOne Family. One Faith. One Mission.\nCCG World.',
      footer    = 'You are receiving this because you subscribed on CCG World.',
      recipients,
      attachments = [],
    } = req.body || {}

    if (!subject || !body || !Array.isArray(recipients) || !recipients.length) {
      return res.status(400).json({ error: 'subject, body, and recipients are required' })
    }
    if (!emailConfigured()) return res.status(500).json({ error: 'RESEND_API_KEY and RESEND_FROM_EMAIL must be set' })

    // De-duplicate by email so nobody gets the same newsletter twice.
    const seen = new Set()
    const items = []
    for (const r of recipients) {
      const email = String(r?.email || '').trim()
      const key = email.toLowerCase()
      if (!email || seen.has(key)) continue
      seen.add(key)
      items.push({ email, name: r.name || 'Member' })
    }

    const build = name => {
      const g = greeting.replace('{name}', escapeHtml(name))
      return {
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">${g}</p>
    ${bodyToHtml(body)}
    <div style="margin-top:24px;">
      ${signature.split('\n').map(l => `<p style="font-size:0.95rem;line-height:1.6;margin:0;">${l}</p>`).join('')}
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
    <p style="font-size:0.75rem;color:#9ca3af;margin:0;">${footer}</p>
  </div>
</body>
</html>`,
        text: `${greeting.replace('{name}', name)}\n\n${stripMd(body)}\n\n${signature}\n\n---\n${footer}`,
      }
    }

    const deadline = Date.now() + 52000
    const results = []
    const TIMEOUT_MSG = 'Not sent: time limit reached — resend to this address'

    const sendOne = async c => {
      if (Date.now() > deadline) return { ...c, ok: false, error: TIMEOUT_MSG }
      try { await sendEmail({ to: c.email, subject, ...build(c.name), attachments }); return { ...c, ok: true } }
      catch (e) { return { ...c, ok: false, error: e.message } }
    }

    if (attachments.length === 0) {
      for (let i = 0; i < items.length; i += 100) {
        const chunk = items.slice(i, i + 100)
        if (Date.now() > deadline) { chunk.forEach(c => results.push({ ...c, ok: false, error: TIMEOUT_MSG })); continue }
        try {
          await sendBatch(chunk.map(c => ({ to: c.email, subject, ...build(c.name) })))
          chunk.forEach(c => results.push({ ...c, ok: true }))
        } catch (_) {
          for (const c of chunk) { results.push(await sendOne(c)); await sleep(250) }
        }
      }
    } else {
      for (const c of items) { results.push(await sendOne(c)); await sleep(250) }
    }

    await logDelivery(serviceClient(), results.map(r => ({
      source: 'send-newsletter', recipient_email: r.email, recipient_name: r.name,
      subject, success: r.ok, error_message: r.ok ? null : r.error,
    })))

    const delivered = results.filter(r => r.ok).length
    const failed = results.length - delivered
    const errors = results.filter(r => !r.ok).slice(0, 5).map(r => `${r.email}: ${r.error}`)
    // 502 when EVERY send failed, so callers that only check "was there an error" can't mistake it for success.
    return res.status(delivered === 0 ? 502 : 200).json({
      success: delivered > 0, delivered, failed, errors, total: results.length,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
