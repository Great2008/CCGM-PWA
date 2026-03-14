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

function reinstatedHtml(name: string) {
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
    const { type, email, name, reason, period, until } = await req.json()
    if (!email) throw new Error('email is required')
    if (!GMAIL_USER || !GMAIL_PASS) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD secrets not set')

    const isReinstatement = type === 'reinstatement'
    const subject = isReinstatement
      ? 'Your CCG World Account Has Been Reinstated'
      : 'Your CCG World Account Has Been Suspended'
    const html = isReinstatement
      ? reinstatedHtml(name || 'Member')
      : suspensionHtml(name || 'Member', reason || 'Community guideline violation', period || 'Unspecified', until || null)
    const plain = isReinstatement
      ? `Dear ${name},\n\nYour CCG World account suspension has been lifted. Welcome back!\n\n${APP_URL}/timeline`
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
