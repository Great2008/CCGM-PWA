// supabase/functions/send-rsvp-confirmation/index.ts
// Self-contained — no cross-file imports, so this can be deployed by
// pasting the whole file into the Supabase Dashboard's Edge Function editor.
//
// Required Supabase Secrets (dashboard → Edge Functions → Secrets):
//   SMTP_HOST        = smtp-relay.brevo.com
//   SMTP_PORT        = 587
//   SMTP_LOGIN       = your SMTP login
//   SMTP_PASSWORD    = your SMTP key / app password
//   SMTP_FROM_EMAIL  = the address you verified as a sender
//   SMTP_FROM_NAME   = CCG World   (optional)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Inlined SMTP sender (kept duplicated across functions on purpose — this
// project is maintained from a phone, and pasting one self-contained file
// into the Supabase Dashboard's editor is far easier than wiring up cross-
// file imports without a terminal/CLI available) ──────────────────────────
export interface EmailAttachment {
  filename: string
  contentType: string
  base64: string
}

export interface SendEmailOptions {
  host: string
  port: number
  login: string
  password: string
  fromEmail: string
  fromName?: string
  to: string
  subject: string
  html: string
  text: string
  attachments?: EmailAttachment[]
}

// Wraps a base64 string at 76 chars/line per RFC 2045 — some mail servers
// are lenient about this, but it's cheap to just do it right.
function wrapBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') || b64
}

function buildMimeMessage(opts: SendEmailOptions): string {
  const { fromEmail, fromName = 'CCG World', to, subject, html, text, attachments = [] } = opts

  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const altBody = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
    ``,
    `--${altBoundary}--`,
  ].join('\r\n')

  if (attachments.length === 0) {
    return [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,
      altBody,
    ].join('\r\n')
  }

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const attachmentParts = attachments.map(att => [
    `--${mixedBoundary}`,
    `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${att.filename}"`,
    ``,
    wrapBase64(att.base64),
    ``,
  ].join('\r\n')).join('')

  return [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    altBody,
    ``,
    attachmentParts,
    `--${mixedBoundary}--`,
  ].join('\r\n')
}

// Sends one email via SMTP. Auto-detects connection style from the port:
// 465 = implicit TLS (connect already encrypted, e.g. Gmail); anything else
// (587, 25, 2525...) = STARTTLS (connect plain, then upgrade to TLS — what
// Brevo and most modern providers use). Throws on failure — callers should
// catch per-recipient so one bad address doesn't abort a whole batch.
export async function sendSmtpEmail(opts: SendEmailOptions): Promise<void> {
  const message = buildMimeMessage(opts)
  const { host, port, login, password, to } = opts

  let conn: Deno.Conn = port === 465
    ? await Deno.connectTls({ hostname: host, port })
    : await Deno.connect({ hostname: host, port })

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  // Buffered line reader — accumulates bytes across multiple read() calls
  // until a full \r\n-terminated line is available. A single read() can
  // return a partial line, several lines at once, or anything in between —
  // SMTP servers routinely send multi-line responses (EHLO's capability
  // list in particular) in one burst, and naively assuming "one read() =
  // one line" causes responses to silently get misaligned by one step,
  // which showed up as auth appearing to fail on the *prompt* for the
  // password rather than the actual result.
  let buffer = ''
  const readLine = async (): Promise<string> => {
    while (true) {
      const idx = buffer.indexOf('\r\n')
      if (idx !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        return line
      }
      const chunk = new Uint8Array(4096)
      const n = await conn.read(chunk)
      if (n === null) throw new Error('SMTP connection closed unexpectedly')
      buffer += decoder.decode(chunk.subarray(0, n))
    }
  }
  // Consumes a full (possibly multi-line) SMTP response — continuation
  // lines are formatted "250-text", the final line "250 text".
  const readResponse = async (): Promise<string> => {
    let line = await readLine()
    while (line.length >= 4 && line[3] === '-') line = await readLine()
    return line
  }
  const send = async (cmd: string) => { await conn.write(encoder.encode(cmd + '\r\n')) }

  try {
    await readResponse() // 220 greeting
    await send(`EHLO ccgworld.org`)
    await readResponse() // 250 capabilities

    if (port !== 465) {
      // STARTTLS handshake, then upgrade the plain socket to TLS and
      // re-introduce ourselves (SMTP requires a fresh EHLO after upgrading).
      await send('STARTTLS')
      const starttlsResp = await readResponse()
      if (!starttlsResp.startsWith('220')) throw new Error(`STARTTLS rejected: ${starttlsResp}`)
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host })
      buffer = '' // discard anything buffered pre-upgrade — required after STARTTLS
      await send(`EHLO ccgworld.org`)
      await readResponse() // 250 capabilities (post-TLS)
    }

    await send('AUTH LOGIN')
    await readResponse() // 334 Username:
    await send(btoa(login))
    await readResponse() // 334 Password:
    await send(btoa(password))
    const authResult = await readResponse()
    if (!authResult.startsWith('235')) throw new Error(`Auth failed: ${authResult}`)

    await send(`MAIL FROM:<${opts.fromEmail}>`)
    await readResponse()
    await send(`RCPT TO:<${to}>`)
    await readResponse()
    await send('DATA')
    await readResponse()
    await send(message + '\r\n.')
    await readResponse()
    await send('QUIT')
  } finally {
    conn.close()
  }
}


const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return iso
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const {
      email,
      name,
      eventTitle,
      eventDate,      // ISO date, e.g. "2026-09-01"
      eventTime,      // optional, e.g. "9:00 AM"
      venue,
      registrationId,
      eventUrl,
    } = await req.json()

    if (!email || !name || !eventTitle || !eventDate || !registrationId) {
      return new Response(
        JSON.stringify({ error: 'email, name, eventTitle, eventDate, and registrationId are required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const smtpHost     = Deno.env.get('SMTP_HOST')
    const smtpPort     = Number(Deno.env.get('SMTP_PORT') || '587')
    const smtpLogin    = Deno.env.get('SMTP_LOGIN')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const fromEmail    = Deno.env.get('SMTP_FROM_EMAIL')
    const fromName     = Deno.env.get('SMTP_FROM_NAME') || 'CCG World'
    if (!smtpHost || !smtpLogin || !smtpPassword || !fromEmail) {
      return new Response(
        JSON.stringify({ error: 'SMTP_HOST, SMTP_LOGIN, SMTP_PASSWORD, and SMTP_FROM_EMAIL secrets must all be set' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const prettyDate = formatDate(eventDate)
    const dateLine = eventTime ? `${prettyDate} · ${eventTime}` : prettyDate

    const subject = `🎟️ Your RSVP is Confirmed — ${eventTitle}`

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#0a2612,#16653a);padding:36px;text-align:center;">
      <div style="color:#f59e0b;font-size:1.1rem;font-weight:900;letter-spacing:1px;margin-bottom:8px;">🎟️ YOUR RSVP IS CONFIRMED</div>
      <div style="color:rgba(255,255,255,0.6);font-size:0.7rem;letter-spacing:4px;font-family:Arial,sans-serif;">CCG WORLD · CHRISTIAN CHURCH OF GOD MISSION</div>
    </div>

    <div style="padding:40px 36px;font-family:Georgia,serif;">
      <p style="color:#1e293b;margin:0 0 20px;font-size:1rem;">Dear ${name},</p>
      <p style="color:#334155;line-height:1.85;margin:0 0 18px;font-size:0.97rem;">
        Thank you for registering for <strong>${eventTitle}</strong>.
      </p>
      <p style="color:#334155;line-height:1.85;margin:0 0 30px;font-size:0.97rem;">
        We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.
      </p>

      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:26px 24px;margin-bottom:30px;">
        <div style="color:#166534;font-size:0.72rem;font-weight:700;letter-spacing:2px;margin-bottom:12px;">✨ EVENT DETAILS</div>
        <div style="color:#0a2612;font-size:1.1rem;font-weight:700;margin-bottom:16px;">${eventTitle}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;color:#334155;">
          <tr><td style="padding:5px 0;width:120px;">📅 Date:</td><td style="padding:5px 0;font-weight:600;">${dateLine}</td></tr>
          ${venue ? `<tr><td style="padding:5px 0;">📍 Venue:</td><td style="padding:5px 0;font-weight:600;">${venue}</td></tr>` : ''}
          <tr><td style="padding:5px 0;">🎟️ Status:</td><td style="padding:5px 0;font-weight:700;color:#16a34a;">RSVP CONFIRMED</td></tr>
        </table>
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.85rem;color:#64748b;">
          <div>Attendee: <strong style="color:#1e293b;">${name}</strong></div>
          <div style="margin-top:4px;">Registration ID: <code style="color:#1e293b;">${registrationId}</code></div>
        </div>
      </div>

      <div style="margin-bottom:30px;">
        <div style="color:#166534;font-size:0.72rem;font-weight:700;letter-spacing:2px;margin-bottom:10px;">🙏 GET READY FOR AN ENCOUNTER</div>
        <p style="color:#334155;line-height:1.85;margin:0 0 14px;font-size:0.95rem;">
          Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus.
        </p>
        <p style="color:#334155;line-height:1.85;margin:0;font-size:0.95rem;">
          Your registration has been successfully recorded. Please keep this email for your records and have your registration details available when attending the event.
        </p>
      </div>

      ${eventUrl ? `
      <div style="text-align:center;margin-bottom:30px;">
        <a href="${eventUrl}" style="display:inline-block;background:#16653a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:30px;font-family:Arial,sans-serif;font-weight:700;font-size:0.85rem;">View Event on CCG World</a>
      </div>` : ''}

      <div style="text-align:center;border-top:2px solid #f1f5f9;padding-top:26px;">
        <p style="color:#1e293b;font-weight:700;margin:0 0 10px;font-size:0.98rem;">WE LOOK FORWARD TO WELCOMING YOU!</p>
        <p style="color:#64748b;line-height:1.8;margin:0 0 6px;font-size:0.9rem;">Come expectant. Come prepared. Come ready to encounter Jesus.</p>
        ${venue ? `<p style="color:#64748b;margin:0;font-size:0.9rem;">See you at ${venue}! 🙌</p>` : ''}
      </div>
    </div>

    <div style="background:#f8fafc;padding:22px 36px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#1e293b;font-weight:700;margin:0 0 2px;font-size:0.82rem;font-family:Arial,sans-serif;">Christian Church Of God Mission (CCG)</p>
      <p style="color:#94a3b8;font-size:0.72rem;margin:0;font-family:Arial,sans-serif;">God First</p>
    </div>
  </div>
</body>
</html>`

    const text = [
      `Dear ${name},`,
      ``,
      `🎟️ YOUR RSVP IS CONFIRMED`,
      ``,
      `Thank you for registering for ${eventTitle}.`,
      `We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.`,
      ``,
      `✨ EVENT DETAILS`,
      eventTitle,
      `📅 Date: ${dateLine}`,
      venue ? `📍 Venue: ${venue}` : '',
      `🎟️ Status: RSVP CONFIRMED`,
      ``,
      `Attendee: ${name}`,
      `Registration ID: ${registrationId}`,
      ``,
      `🙏 GET READY FOR AN ENCOUNTER`,
      `Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus.`,
      `Your registration has been successfully recorded. Please keep this email for your records.`,
      ``,
      eventUrl ? `View Event on CCG World: ${eventUrl}` : '',
      ``,
      `WE LOOK FORWARD TO WELCOMING YOU!`,
      `Come expectant. Come prepared. Come ready to encounter Jesus.`,
      venue ? `See you at ${venue}! 🙌` : '',
      ``,
      `Christian Church Of God Mission (CCG)`,
      `God First`,
    ].filter(Boolean).join('\n')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    let sendError: string | null = null
    try {
      await sendSmtpEmail({ host: smtpHost, port: smtpPort, login: smtpLogin, password: smtpPassword, fromEmail, fromName, to: email, subject, html, text })
    } catch (err) {
      sendError = err.message
    }

    try {
      await supabase.from('email_delivery_logs').insert({
        source: 'send-rsvp-confirmation',
        recipient_email: email,
        recipient_name: name,
        subject,
        success: !sendError,
        error_message: sendError,
      })
    } catch (_) { /* logging itself failing should never break the response */ }

    if (sendError) {
      return new Response(
        JSON.stringify({ error: sendError }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
