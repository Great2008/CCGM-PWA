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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const {
      subject,
      greeting  = 'Dear {name},',
      body,
      signature = 'God first always. God bless you.\nOne Family. One Faith. One Mission.\nCCG World.',
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

    const buildHtml = (name: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">${greeting.replace('{name}', name)}</p>
    ${body.split('\n\n').map((p: string) =>
      `<p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">${p.replace(/\n/g, '<br/>')}</p>`
    ).join('')}
    <div style="margin-top:24px;">
      ${signature.split('\n').map((l: string) =>
        `<p style="font-size:0.95rem;line-height:1.6;margin:0;">${l}</p>`
      ).join('')}
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
    <p style="font-size:0.75rem;color:#9ca3af;margin:0;">${footer}</p>
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
