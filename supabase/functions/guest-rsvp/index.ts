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
  const readLine = async (c: Deno.Conn): Promise<string> => {
    const buf = new Uint8Array(1024)
    await c.read(buf)
    return decoder.decode(buf).trim()
  }
  const send = async (c: Deno.Conn, cmd: string) => { await c.write(encoder.encode(cmd + '\r\n')) }
  try {
    await readLine(conn)
    await send(conn, `EHLO ccgworld.org`)
    await readLine(conn)
    if (port !== 465) {
      await send(conn, 'STARTTLS')
      const r = await readLine(conn)
      if (!r.startsWith('220')) throw new Error(`STARTTLS rejected: ${r}`)
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host })
      await send(conn, `EHLO ccgworld.org`)
      await readLine(conn)
    }
    await send(conn, 'AUTH LOGIN')
    await readLine(conn)
    await send(conn, btoa(login))
    await readLine(conn)
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
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0a2612,#16653a);padding:36px;text-align:center;">
      <div style="color:#f59e0b;font-size:1.1rem;font-weight:900;letter-spacing:1px;margin-bottom:8px;">🎟️ YOUR RSVP IS CONFIRMED</div>
      <div style="color:rgba(255,255,255,0.6);font-size:0.7rem;letter-spacing:4px;font-family:Arial,sans-serif;">CCG WORLD · CHRISTIAN CHURCH OF GOD MISSION</div>
    </div>
    <div style="padding:40px 36px;font-family:Georgia,serif;">
      <p style="color:#1e293b;margin:0 0 20px;font-size:1rem;">Dear ${cleanName},</p>
      <p style="color:#334155;line-height:1.85;margin:0 0 18px;font-size:0.97rem;">Thank you for registering for <strong>${event.title}</strong>.</p>
      <p style="color:#334155;line-height:1.85;margin:0 0 30px;font-size:0.97rem;">We are delighted to confirm your attendance and look forward to welcoming you to this special gathering.</p>
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:26px 24px;margin-bottom:30px;">
        <div style="color:#166534;font-size:0.72rem;font-weight:700;letter-spacing:2px;margin-bottom:12px;">✨ EVENT DETAILS</div>
        <div style="color:#0a2612;font-size:1.1rem;font-weight:700;margin-bottom:16px;">${event.title}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;color:#334155;">
          <tr><td style="padding:5px 0;width:120px;">📅 Date:</td><td style="padding:5px 0;font-weight:600;">${dateLine}</td></tr>
          ${event.location ? `<tr><td style="padding:5px 0;">📍 Venue:</td><td style="padding:5px 0;font-weight:600;">${event.location}</td></tr>` : ''}
          <tr><td style="padding:5px 0;">🎟️ Status:</td><td style="padding:5px 0;font-weight:700;color:#16a34a;">RSVP CONFIRMED</td></tr>
        </table>
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.85rem;color:#64748b;">
          <div>Attendee: <strong style="color:#1e293b;">${cleanName}</strong></div>
          <div style="margin-top:4px;">Registration ID: <code style="color:#1e293b;">${reg.id}</code></div>
        </div>
      </div>
      <div style="margin-bottom:30px;">
        <div style="color:#166534;font-size:0.72rem;font-weight:700;letter-spacing:2px;margin-bottom:10px;">🙏 GET READY FOR AN ENCOUNTER</div>
        <p style="color:#334155;line-height:1.85;margin:0 0 14px;font-size:0.95rem;">Prepare your heart for a powerful time of worship, fellowship, teaching, prayer, inspiration, and an encounter with Jesus.</p>
        <p style="color:#334155;line-height:1.85;margin:0;font-size:0.95rem;">Your registration has been successfully recorded. Please keep this email for your records and have your registration details available when attending the event.</p>
      </div>
      <div style="text-align:center;margin-bottom:30px;">
        <a href="${eventUrl}" style="display:inline-block;background:#16653a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:30px;font-family:Arial,sans-serif;font-weight:700;font-size:0.85rem;">View Event on CCG World</a>
      </div>
      <div style="text-align:center;border-top:2px solid #f1f5f9;padding-top:26px;">
        <p style="color:#1e293b;font-weight:700;margin:0 0 10px;font-size:0.98rem;">WE LOOK FORWARD TO WELCOMING YOU!</p>
        <p style="color:#64748b;line-height:1.8;margin:0 0 6px;font-size:0.9rem;">Come expectant. Come prepared. Come ready to encounter Jesus.</p>
        ${event.location ? `<p style="color:#64748b;margin:0;font-size:0.9rem;">See you at ${event.location}! 🙌</p>` : ''}
      </div>
    </div>
    <div style="background:#f8fafc;padding:22px 36px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#1e293b;font-weight:700;margin:0 0 2px;font-size:0.82rem;font-family:Arial,sans-serif;">Christian Church Of God Mission (CCG)</p>
      <p style="color:#94a3b8;font-size:0.72rem;margin:0;font-family:Arial,sans-serif;">God First</p>
    </div>
  </div>
</body></html>`

        const text = [
          `Dear ${cleanName},`, ``, `🎟️ YOUR RSVP IS CONFIRMED`, ``,
          `Thank you for registering for ${event.title}.`,
          `We are delighted to confirm your attendance.`, ``,
          `EVENT DETAILS`, event.title, `Date: ${dateLine}`,
          event.location ? `Venue: ${event.location}` : '', `Status: RSVP CONFIRMED`, ``,
          `Attendee: ${cleanName}`, `Registration ID: ${reg.id}`, ``,
          `View Event: ${eventUrl}`, ``,
          `Christian Church Of God Mission (CCG) — God First`,
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
