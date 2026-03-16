import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APP_URL   = Deno.env.get('APP_URL')          || 'https://ccgm-pwa.vercel.app'
const GMAIL_USER = Deno.env.get('GMAIL_USER')      || ''
const GMAIL_PASS = Deno.env.get('GMAIL_APP_PASSWORD') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmail(to: string, subject: string, html: string, plain: string) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const message = [
    `From: CCG World <${GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    plain,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const readLine = async (): Promise<string> => {
    const buf = new Uint8Array(1024)
    await conn.read(buf)
    return decoder.decode(buf).trim()
  }
  const send = async (cmd: string) => {
    await conn.write(encoder.encode(cmd + '\r\n'))
  }

  await readLine()                          // 220 greeting
  await send('EHLO ccgm-pwa.vercel.app')
  await readLine()                          // 250 capabilities
  await send('AUTH LOGIN')
  await readLine()                          // 334 Username:
  await send(btoa(GMAIL_USER))
  await readLine()                          // 334 Password:
  await send(btoa(GMAIL_PASS))
  const authResult = await readLine()
  if (!authResult.startsWith('235')) throw new Error('Auth failed: ' + authResult)

  await send(`MAIL FROM:<${GMAIL_USER}>`)
  await readLine()
  await send(`RCPT TO:<${to}>`)
  await readLine()
  await send('DATA')
  await readLine()
  await send(message + '\r\n.')
  await readLine()
  await send('QUIT')
  conn.close()
}

function suspensionHtml(name: string, reason: string, period: string, until: string | null) {
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
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your CCG World account has been suspended by the admin team.
              You can still browse public content but cannot post or interact until reinstated.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;"><strong style="color:#dc2626;">Reason:</strong><br/><span style="color:#7f1d1d;">${reason}</span></p>
                <p style="margin:0 0 12px;"><strong style="color:#dc2626;">Duration:</strong><br/><span style="color:#7f1d1d;">${period}</span></p>
                <p style="margin:0;"><strong style="color:#dc2626;">Until:</strong><br/><span style="color:#7f1d1d;">${until ?? 'Indefinite'}</span></p>
              </td></tr>
            </table>
            <p style="text-align:center;margin:0 0 28px;">
              <a href="${APP_URL}/contact" style="display:inline-block;padding:13px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;border-radius:10px;">Contact Us →</a>
            </p>
            <p style="color:#6b7280;font-size:0.82rem;margin:0;text-align:center;">© ${new Date().getFullYear()} Christian Church of God Mission</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function reinstatedHtml(name: string, note: string | null = null) {
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
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your CCG World account suspension has been lifted. You now have full access and can participate in the community again.
            </p>
            ${note ? `<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
              <div style="font-size:0.72rem;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Note from Admin</div>
              <p style="color:#14532d;font-size:0.92rem;line-height:1.6;margin:0;">${note}</p>
            </div>` : ''}
            <p style="text-align:center;margin:0 0 28px;">
              <a href="${APP_URL}/timeline" style="display:inline-block;padding:13px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;border-radius:10px;">Back to Timeline →</a>
            </p>
            <p style="color:#6b7280;font-size:0.82rem;margin:0;text-align:center;">© ${new Date().getFullYear()} Christian Church of God Mission</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const body = await req.json()
    const { type, email, name, reason, period, until, note, authorName, postBody, reportCount, adminPanelUrl } = body

    if (!GMAIL_USER || !GMAIL_PASS) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD secrets not set')

    // ── Admin alert for auto-suspension ──────────────────────────
    if (type === 'auto_suspension_admin_alert') {
      const adminEmail = GMAIL_USER
      const subject = `⚠️ Auto-suspension triggered: ${authorName}`
      const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;background:#fffef5">
        <div style="background:#0a2612;padding:24px 28px;border-radius:12px 12px 0 0;text-align:center">
          <h2 style="color:#fbbf24;margin:0;font-size:1.4rem">⚠️ Auto-Suspension Alert</h2>
        </div>
        <div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:28px">
          <p style="color:#374151">A member has been <strong>automatically suspended</strong> after their post received <strong>${reportCount} reports</strong>.</p>
          <div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0">
            <div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Member</div>
            <div style="color:#7f1d1d;font-weight:700">${authorName}</div>
          </div>
          ${postBody ? `<div style="background:#f8fafc;border-radius:10px;padding:16px;margin:16px 0;font-style:italic;color:#64748b">"${postBody}${postBody.length >= 120 ? '…' : ''}"</div>` : ''}
          <p style="color:#374151">Please review this suspension in the admin panel.</p>
          <a href="${adminPanelUrl || APP_URL + '/admin'}" style="display:inline-block;padding:12px 28px;background:#166534;color:white;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
            Open Admin Panel →
          </a>
        </div>
      </body></html>`
      const plain = `Auto-suspension alert: ${authorName} was auto-suspended after ${reportCount} reports.\n\nReview at: ${adminPanelUrl || APP_URL + '/admin'}`
      await sendEmail(adminEmail, subject, html, plain)
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...CORS } })
    }

    // ── User-facing emails ────────────────────────────────────────
    if (!email) throw new Error('email is required')

    const isReinstatement = type === 'reinstatement'
    const subject = isReinstatement
      ? 'Your CCG World Account Has Been Reinstated'
      : 'Your CCG World Account Has Been Suspended'

    const html = isReinstatement
      ? reinstatedHtml(name || 'Member', note || null)
      : suspensionHtml(name || 'Member', reason || 'Community guideline violation', period || 'Unspecified', until || null)

    const plain = isReinstatement
      ? `Dear ${name},\n\nYour CCG World account suspension has been lifted. Welcome back!\n${note ? '\nNote from admin: ' + note + '\n' : ''}\n${APP_URL}/timeline`
      : `Dear ${name},\n\nYour account has been suspended.\nReason: ${reason}\nDuration: ${period}\nUntil: ${until ?? 'Indefinite'}\n\nContact us: ${APP_URL}/contact`

    await sendEmail(email, subject, html, plain)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e: any) {
    console.error('send-suspension-email error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
