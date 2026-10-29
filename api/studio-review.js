// api/studio-review.js — staff approve / reject / remove a Studio suggestion.
// Emails the member when a PENDING suggestion is decided. Staff only (moderator, admin, super admin).
import { cors, authenticate, serviceClient, emailConfigured, sendEmail, logDelivery, escapeHtml, APP_URL } from '../server/mail.js'

export const config = { maxDuration: 20 }

// Moderators can review too; fall back to is_admin() if is_mod_or_admin() isn't there.
async function canReview(ctx) {
  let r = await ctx.userClient.rpc('is_mod_or_admin')
  if (!r.error) return !!r.data
  r = await ctx.userClient.rpc('is_admin')
  return !!r.data
}

const wrap = inner => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;"><div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">${inner}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;"/><p style="font-size:0.75rem;color:#9ca3af;margin:0;line-height:1.6;">God first always. God bless you.<br/>One Family. One Faith. One Mission.<br/>CCG World.</p></div></body></html>`

function decisionEmail(approved, name, title, note) {
  const p = 'font-size:0.95rem;line-height:1.6;margin:0 0 16px;'
  if (approved) {
    return {
      subject: `✅ Your video suggestion is now live — ${title}`,
      html: wrap(`<p style="${p}">Dear ${escapeHtml(name)},</p>
<p style="${p}">Thank you for sharing. Your suggestion <strong>${escapeHtml(title)}</strong> has been approved and is now on the CCG Studio page, in the Community tab.</p>
${note ? `<p style="${p}"><em>Note from the team:</em> ${escapeHtml(note)}</p>` : ''}
<p style="font-size:0.95rem;margin:24px 0;"><a href="${APP_URL}/studio" style="color:#2563eb;">See it on CCG Studio</a></p>`),
      text: `Dear ${name},\n\nThank you for sharing. Your suggestion "${title}" has been approved and is now on the CCG Studio page, in the Community tab.\n${note ? `\nNote from the team: ${note}\n` : ''}\n${APP_URL}/studio`,
    }
  }
  return {
    subject: `Update on your video suggestion — ${title}`,
    html: wrap(`<p style="${p}">Dear ${escapeHtml(name)},</p>
<p style="${p}">Thank you for suggesting <strong>${escapeHtml(title)}</strong> for CCG Studio. After review, we are not able to feature it at this time.</p>
${note ? `<p style="${p}"><em>Reason:</em> ${escapeHtml(note)}</p>` : ''}
<p style="${p}">You are always welcome to suggest other videos.</p>`),
    text: `Dear ${name},\n\nThank you for suggesting "${title}" for CCG Studio. After review, we are not able to feature it at this time.\n${note ? `\nReason: ${note}\n` : ''}\nYou are always welcome to suggest other videos.`,
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx || !(await canReview(ctx))) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { id, action, note } = req.body || {}
    const cleanNote = String(note || '').trim().slice(0, 300) || null
    // Which current status each action is allowed to start from, and the status it produces.
    const rules = {
      approve: { from: ['pending', 'rejected'], to: 'approved' },
      reject:  { from: ['pending'],             to: 'rejected' },
      remove:  { from: ['approved'],            to: 'rejected' },   // take a live item down
    }
    const rule = rules[action]
    if (!id || !rule) return res.status(400).json({ error: 'id and a valid action are required' })

    const sb = serviceClient()
    // The status filter makes this atomic: if two reviewers act at once, only the first wins.
    const { data: row, error } = await sb.from('studio_submissions')
      .update({ status: rule.to, admin_note: cleanNote, reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id).in('status', rule.from).select('*').maybeSingle()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Another copy of this video is already live' })
      return res.status(500).json({ error: error.message })
    }
    if (!row) return res.status(409).json({ error: 'This suggestion was already handled. Refresh the list.' })

    // Approve and reject notify the member (including approve-after-reject, since they were told "no").
    // Taking a live item down ("remove") is silent.
    let emailSent = false
    if (action !== 'remove' && emailConfigured()) {
      try {
        const { data: u } = await sb.auth.admin.getUserById(row.user_id)
        const to = u?.user?.email
        if (to) {
          const name = row.submitter_name || 'Member'
          const mail = decisionEmail(action === 'approve', name, row.title, cleanNote)
          let err = null
          try { await sendEmail({ to, ...mail }); emailSent = true } catch (e) { err = e.message }
          await logDelivery(sb, [{ source: 'studio-review', recipient_email: to, recipient_name: name, subject: mail.subject, success: !err, error_message: err }])
        }
      } catch (_) { /* decision is saved; email is best-effort */ }
    }
    return res.status(200).json({ success: true, status: row.status, emailSent })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
