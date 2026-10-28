// api/send-suspension-email.js — suspension / reinstatement emails + auto-suspension admin alert.
// Replaces the Supabase edge function of the same name.
//
// Access rules:
//   - type "auto_suspension_admin_alert": any signed-in member (Timeline triggers it from the
//     reporting member's session). It can only ever email ADMIN_ALERT_EMAIL.
//   - "suspension" / "reinstatement" (emails a member): ADMIN ONLY.
import { cors, authenticate, isAdmin, serviceClient, emailConfigured, sendEmail, logDelivery, escapeHtml, APP_URL } from '../server/mail.js'

export const config = { maxDuration: 30 }

const year = () => new Date().getFullYear()

function suspensionHtml(name, reason, period, until) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<title>Account Suspended — CCG World</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:36px 40px;text-align:center;">
            <h1 style="color:#fff;font-size:1.5rem;margin:0 0 6px;font-weight:800;">🚫 Account Suspended</h1>
            <p style="color:rgba(255,255,255,0.75);margin:0;font-size:0.9rem;">CCG World — Christian Church of God Mission</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your CCG World account has been suspended by the admin team.
              You can still browse public content but cannot post or interact until reinstated.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;"><strong style="color:#dc2626;">Reason:</strong><br/><span style="color:#7f1d1d;">${escapeHtml(reason)}</span></p>
                <p style="margin:0 0 12px;"><strong style="color:#dc2626;">Duration:</strong><br/><span style="color:#7f1d1d;">${escapeHtml(period)}</span></p>
                <p style="margin:0;"><strong style="color:#dc2626;">Until:</strong><br/><span style="color:#7f1d1d;">${escapeHtml(until ?? 'Indefinite')}</span></p>
              </td></tr>
            </table>
            <p style="text-align:center;margin:0 0 28px;">
              <a href="${APP_URL}/contact" style="display:inline-block;padding:13px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;border-radius:10px;">Contact Us →</a>
            </p>
            <p style="color:#6b7280;font-size:0.82rem;margin:0;text-align:center;">© ${year()} Christian Church of God Mission</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function reinstatedHtml(name, note) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<title>Account Reinstated — CCG World</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0a2612,#166534);padding:36px 40px;text-align:center;">
            <h1 style="color:#fff;font-size:1.5rem;margin:0 0 6px;font-weight:800;">✅ Account Reinstated</h1>
            <p style="color:rgba(255,255,255,0.75);margin:0;font-size:0.9rem;">CCG World — Christian Church of God Mission</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${escapeHtml(name)}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your CCG World account suspension has been lifted. You now have full access and can participate in the community again.
            </p>
            ${note ? `<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
              <div style="font-size:0.72rem;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Note from Admin</div>
              <p style="color:#14532d;font-size:0.92rem;line-height:1.6;margin:0;">${escapeHtml(note)}</p>
            </div>` : ''}
            <p style="text-align:center;margin:0 0 28px;">
              <a href="${APP_URL}/timeline" style="display:inline-block;padding:13px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;border-radius:10px;">Back to Timeline →</a>
            </p>
            <p style="color:#6b7280;font-size:0.82rem;margin:0;text-align:center;">© ${year()} Christian Church of God Mission</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function alertHtml(authorName, postBody, reportCount, link) {
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;background:#fffef5">
  <div style="background:#0a2612;padding:24px 28px;border-radius:12px 12px 0 0;text-align:center">
    <h2 style="color:#fbbf24;margin:0;font-size:1.4rem">⚠️ Auto-Suspension Alert</h2>
  </div>
  <div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px">
    <p style="color:#374151">A member has been <strong>automatically suspended</strong> after their post received <strong>${reportCount} reports</strong>.</p>
    <div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0">
      <div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Member</div>
      <div style="color:#7f1d1d;font-weight:700">${escapeHtml(authorName)}</div>
    </div>
    ${postBody ? `<div style="background:#f8fafc;border-radius:10px;padding:16px;margin:16px 0;font-style:italic;color:#64748b">"${escapeHtml(postBody)}${postBody.length >= 120 ? '…' : ''}"</div>` : ''}
    <p style="color:#374151">Please review this suspension in the admin panel.</p>
    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#166534;color:white;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">Open Admin Panel →</a>
  </div>
</body></html>`
}

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx) return res.status(401).json({ error: 'Unauthorized' })

  try {
    if (!emailConfigured()) return res.status(500).json({ error: 'RESEND_API_KEY and RESEND_FROM_EMAIL must be set' })
    const { type, email, name, reason, period, until, note, authorName, postBody, reportCount } = req.body || {}
    const sb = serviceClient()

    // ── Admin alert (any signed-in member can trigger; recipient is fixed) ──
    if (type === 'auto_suspension_admin_alert') {
      const to = process.env.ADMIN_ALERT_EMAIL
      if (!to) return res.status(500).json({ error: 'ADMIN_ALERT_EMAIL is not set' })
      const author = String(authorName || 'Member').slice(0, 100)
      const body = postBody ? String(postBody).slice(0, 120) : ''
      const count = Number(reportCount) || 0
      const subject = `⚠️ Auto-suspension triggered: ${author}`
      const link = `${APP_URL}/admin`
      let err = null
      try {
        await sendEmail({
          to, subject, html: alertHtml(author, body, count, link),
          text: `Auto-suspension alert: ${author} was auto-suspended after ${count} reports.\n\nReview at: ${link}`,
        })
      } catch (e) { err = e.message }
      await logDelivery(sb, [{ source: 'send-suspension-email', recipient_email: to, recipient_name: 'Admin', subject, success: !err, error_message: err }])
      if (err) return res.status(500).json({ error: err })
      return res.status(200).json({ success: true })
    }

    // ── Emails to a member: admin only ──────────────────────────────────────
    if (!(await isAdmin(ctx))) return res.status(403).json({ error: 'Admin access required' })
    if (!email) return res.status(400).json({ error: 'email is required' })

    const reinstated = type === 'reinstatement'
    const who = name || 'Member'
    const subject = reinstated ? 'Your CCG World Account Has Been Reinstated' : 'Your CCG World Account Has Been Suspended'
    const html = reinstated
      ? reinstatedHtml(who, note || null)
      : suspensionHtml(who, reason || 'Community guideline violation', period || 'Unspecified', until || null)
    const text = reinstated
      ? `Dear ${who},\n\nYour CCG World account suspension has been lifted. Welcome back!\n${note ? '\nNote from admin: ' + note + '\n' : ''}\n${APP_URL}/timeline`
      : `Dear ${who},\n\nYour account has been suspended.\nReason: ${reason}\nDuration: ${period}\nUntil: ${until ?? 'Indefinite'}\n\nContact us: ${APP_URL}/contact`

    let err = null
    try { await sendEmail({ to: email, subject, html, text }) } catch (e) { err = e.message }
    await logDelivery(sb, [{ source: 'send-suspension-email', recipient_email: email, recipient_name: who, subject, success: !err, error_message: err }])
    if (err) return res.status(500).json({ error: err })
    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('send-suspension-email error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
