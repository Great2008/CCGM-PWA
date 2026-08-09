// supabase/functions/guest-rsvp/index.ts
// Handles public (no-login) guest RSVPs server-side, using the service role
// key — which bypasses RLS entirely, since this is trusted server code, not
// a public client. This replaces having the browser insert directly into
// event_registrations as `anon`, which was tangled up in several interacting
// RLS policies. Also sends the confirmation email in the same request.
//
// Self-contained — no cross-file imports, so this can be deployed by pasting
// the whole file into the Supabase Dashboard's Edge Function editor.
//
// Required Supabase Secrets (dashboard → Edge Functions → Secrets):
//   SMTP_HOST        = smtp-relay.brevo.com
//   SMTP_PORT        = 587
//   SMTP_LOGIN       = your SMTP login
//   SMTP_PASSWORD    = your SMTP key / app password
//   SMTP_FROM_EMAIL  = the address you verified as a sender
//   SMTP_FROM_NAME   = CCG World   (optional)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase
// into every edge function — nothing to add for those two.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inlined SMTP sender (see send-newsletter/send-rsvp-confirmation for the
// same code — duplicated on purpose for phone-paste deployability) ────────
interface EmailAttachment { filename: string; contentType: string; base64: string }
interface SendEmailOptions {
  host: string; port: number; login: string; password: string
  fromEmail: string; fromName?: string; to: string; subject: string
  html: string; text: string; attachments?: EmailAttachment[]
}
function wrapBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') || b64
}
function buildMimeMessage(opts: SendEmailOptions): string {
  const { fromEmail, fromName = 'CCG World', to, subject, html, text, attachments = [] } = opts
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const altBody = [
    `--${altBoundary}`, `Content-Type: text/plain; charset=UTF-8`, ``, text, ``,
    `--${altBoundary}`, `Content-Type: text/html; charset=UTF-8`, ``, html, ``,
    `--${altBoundary}--`,
  ].join('\r\n')
  if (attachments.length === 0) {
    return [
      `From: ${fromName} <${fromEmail}>`, `To: ${to}`, `Subject: ${subject}`,
      `MIME-Version: 1.0`, `Content-Type: multipart/alternative; boundary="${altBoundary}"`, ``, altBody,
    ].join('\r\n')
  }
  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const attachmentParts = attachments.map(att => [
    `--${mixedBoundary}`,
    `Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${att.filename}"`, ``,
    wrapBase64(att.base64), ``,
  ].join('\r\n')).join('')
  return [
    `From: ${fromName} <${fromEmail}>`, `To: ${to}`, `Subject: ${subject}`,
    `MIME-Version: 1.0`, `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, ``,
    `--${mixedBoundary}`, `Content-Type: multipart/alternative; boundary="${altBoundary}"`, ``, altBody, ``,
    attachmentParts, `--${mixedBoundary}--`,
  ].join('\r\n')
}
async function sendSmtpEmail(opts: SendEmailOptions): Promise<void> {
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
      await send('STARTTLS')
      const r = await readResponse()
      if (!r.startsWith('220')) throw new Error(`STARTTLS rejected: ${r}`)
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

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return iso }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { eventId, name, email, phone } = await req.json()

    const cleanName  = (name || '').trim()
    const cleanEmail = (email || '').trim().toLowerCase()
    const cleanPhone = (phone || '').trim()

    if (!eventId) return new Response(JSON.stringify({ error: 'eventId is required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    if (!cleanName) return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return new Response(JSON.stringify({ error: 'Enter a valid email' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: event, error: eventErr } = await supabase
      .from('events').select('id,title,date,time,location').eq('id', eventId).single()
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const { data: reg, error: insertErr } = await supabase
      .from('event_registrations')
      .insert({ event_id: eventId, is_guest: true, guest_name: cleanName, guest_email: cleanEmail, guest_phone: cleanPhone || null })
      .select('id').single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: "You're already registered with this email" }), { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Best-effort confirmation email — the RSVP itself already succeeded above,
    // so an email failure here shouldn't turn into an error response.
    let emailSent = false
    let emailError: string | null = null
    try {
      const smtpHost = Deno.env.get('SMTP_HOST')
      const smtpPort = Number(Deno.env.get('SMTP_PORT') || '587')
      const smtpLogin = Deno.env.get('SMTP_LOGIN')
      const smtpPassword = Deno.env.get('SMTP_PASSWORD')
      const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')
      const fromName = Deno.env.get('SMTP_FROM_NAME') || 'CCG World'

      if (smtpHost && smtpLogin && smtpPassword && fromEmail) {
        const prettyDate = formatDate(event.date)
        const dateLine = event.time ? `${prettyDate} · ${event.time}` : prettyDate
        const eventUrl = `${req.headers.get('origin') || 'https://ccgm-pwa.vercel.app'}/events#event-${event.id}`
        const subject = `🎟️ Your RSVP is Confirmed — ${event.title}`

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Dear ${cleanName},</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Thank you for registering for <strong>${event.title}</strong>. We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:24px 0 4px;"><strong>${event.title}</strong></p>
    <p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Date: ${dateLine}</p>
    ${event.location ? `<p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Venue: ${event.location}</p>` : ''}
    <p style="font-size:0.9rem;line-height:1.6;margin:0;color:#4b5563;">Status: RSVP Confirmed</p>
    <p style="font-size:0.9rem;line-height:1.6;margin:0 0 24px;color:#4b5563;">Registration ID: ${reg.id}</p>
    <p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus. Please keep this email for your records.</p>
    <p style="font-size:0.95rem;margin:24px 0;"><a href="${eventUrl}" style="color:#2563eb;">View Event on CCG World</a></p>
    <p style="font-size:0.95rem;line-height:1.6;margin:24px 0 0;">We look forward to welcoming you${event.location ? ` at ${event.location}` : ''}.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
    <p style="font-size:0.75rem;color:#9ca3af;margin:0;line-height:1.6;">God first always. God bless you.<br/>One Family. One Faith. One Mission.<br/>CCG World.</p>
  </div>
</body></html>`

        const text = [
          `Dear ${cleanName},`, ``,
          `Thank you for registering for ${event.title}. We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.`, ``,
          event.title, `Date: ${dateLine}`,
          event.location ? `Venue: ${event.location}` : '', `Status: RSVP Confirmed`,
          `Registration ID: ${reg.id}`, ``,
          `Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus.`,
          `Please keep this email for your records.`, ``,
          `View Event: ${eventUrl}`, ``,
          `God first always. God bless you.`,
          `One Family. One Faith. One Mission.`,
          `CCG World.`,
        ].filter(Boolean).join('\n')

        await sendSmtpEmail({ host: smtpHost, port: smtpPort, login: smtpLogin, password: smtpPassword, fromEmail, fromName, to: cleanEmail, subject, html, text })
        emailSent = true
      } else {
        emailError = 'SMTP secrets not fully configured'
      }
    } catch (emailErr) {
      emailError = emailErr.message
      console.warn('RSVP confirmation email failed:', emailErr.message)
    }

    // Log the delivery attempt regardless of outcome — this is what makes
    // "why didn't this email arrive" answerable from the admin panel instead
    // of digging through Supabase's function logs.
    try {
      await supabase.from('email_delivery_logs').insert({
        source: 'guest-rsvp',
        recipient_email: cleanEmail,
        recipient_name: cleanName,
        subject: `🎟️ Your RSVP is Confirmed — ${event.title}`,
        success: emailSent,
        error_message: emailError,
      })
    } catch (_) { /* logging itself failing should never break the RSVP flow */ }

    return new Response(
      JSON.stringify({ success: true, registrationId: reg.id, emailSent, emailError }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
