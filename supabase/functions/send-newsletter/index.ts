// supabase/functions/send-newsletter/index.ts
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

  const readLine = async (c: Deno.Conn): Promise<string> => {
    const buf = new Uint8Array(1024)
    await c.read(buf)
    return decoder.decode(buf).trim()
  }
  const send = async (c: Deno.Conn, cmd: string) => { await c.write(encoder.encode(cmd + '\r\n')) }

  try {
    await readLine(conn) // 220 greeting
    await send(conn, `EHLO ccgworld.org`)
    await readLine(conn) // 250 capabilities

    if (port !== 465) {
      // STARTTLS handshake, then upgrade the plain socket to TLS and
      // re-introduce ourselves (SMTP requires a fresh EHLO after upgrading).
      await send(conn, 'STARTTLS')
      const starttlsResp = await readLine(conn)
      if (!starttlsResp.startsWith('220')) throw new Error(`STARTTLS rejected: ${starttlsResp}`)
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host })
      await send(conn, `EHLO ccgworld.org`)
      await readLine(conn) // 250 capabilities (post-TLS)
    }

    await send(conn, 'AUTH LOGIN')
    await readLine(conn) // 334 Username:
    await send(conn, btoa(login))
    await readLine(conn) // 334 Password:
    await send(conn, btoa(password))
    const authResult = await readLine(conn)
    if (!authResult.startsWith('235')) throw new Error(`Auth failed: ${authResult}`)

    await send(conn, `MAIL FROM:<${opts.fromEmail}>`)
    await readLine(conn)
    await send(conn, `RCPT TO:<${to}>`)
    await readLine(conn)
    await send(conn, 'DATA')
    await readLine(conn)
    await send(conn, message + '\r\n.')
    await readLine(conn)
    await send(conn, 'QUIT')
  } finally {
    conn.close()
  }
}


const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const {
      subject,
      greeting  = 'Dear {name},',
      body,
      signature = 'God bless you,\nCCG World Admin Team',
      footer    = 'You are receiving this because you subscribed on CCG World.',
      recipients,   // Array of { email: string, name?: string }
      attachments = [] as EmailAttachment[],
    } = await req.json()

    if (!subject || !body || !recipients?.length) {
      return new Response(
        JSON.stringify({ error: 'subject, body, and recipients are required' }),
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

    const buildHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:36px;text-align:center;">
      <div style="color:#f59e0b;font-size:1.6rem;font-weight:900;letter-spacing:3px;font-family:Georgia,serif;">CCG WORLD</div>
      <div style="color:rgba(255,255,255,0.55);font-size:0.7rem;letter-spacing:4px;margin-top:6px;font-family:Arial,sans-serif;">CHRISTIAN CHURCH OF GOD MISSION</div>
    </div>
    <div style="padding:40px 36px;font-family:Georgia,serif;">
      <p style="color:#1e293b;margin:0 0 22px;font-size:1rem;">${greeting.replace('{name}', name)}</p>
      ${body.split('\n\n').map((p: string) =>
        `<p style="color:#334155;line-height:1.85;margin:0 0 18px;font-size:0.97rem;">${p.replace(/\n/g, '<br/>')}</p>`
      ).join('')}
      <div style="margin-top:36px;padding-top:24px;border-top:2px solid #f1f5f9;">
        ${signature.split('\n').map((l: string) =>
          `<p style="color:#1e293b;margin:0 0 4px;font-size:0.95rem;">${l}</p>`
        ).join('')}
      </div>
    </div>
    <div style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:0.72rem;margin:0;font-family:Arial,sans-serif;">${footer}</p>
    </div>
  </div>
</body>
</html>`

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    let delivered = 0
    const errors: string[] = []

    for (const recipient of recipients) {
      const name    = recipient.name || 'Member'
      const toEmail = recipient.email
      let sendError: string | null = null
      try {
        await sendSmtpEmail({
          host: smtpHost, port: smtpPort, login: smtpLogin, password: smtpPassword,
          fromEmail, fromName, to: toEmail, subject,
          html: buildHtml(name),
          text: `${greeting.replace('{name}', name)}\n\n${body}\n\n${signature}\n\n---\n${footer}`,
          attachments,
        })
        delivered++
      } catch (err) {
        sendError = err.message
        errors.push(`${toEmail}: ${err.message}`)
      }
      try {
        await supabase.from('email_delivery_logs').insert({
          source: 'send-newsletter', recipient_email: toEmail, recipient_name: name,
          subject, success: !sendError, error_message: sendError,
        })
      } catch (_) { /* logging itself failing should never abort the batch */ }
      await new Promise(r => setTimeout(r, 150)) // avoid rate limits
    }

    // Report real failure at the HTTP level too — not just inside the JSON
    // body — so a caller that only checks "was there an error" (which is the
    // normal way to use supabase.functions.invoke) can't mistake "every
    // single recipient failed" for success.
    const allFailed = recipients.length > 0 && delivered === 0
    return new Response(
      JSON.stringify({ success: !allFailed, delivered, failed: errors.length, errors: errors.slice(0, 5), total: recipients.length }),
      { status: allFailed ? 502 : 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
