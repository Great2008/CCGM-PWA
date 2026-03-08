// supabase/functions/send-newsletter/index.ts
// Sends bulk email via Gmail SMTP using Deno's native SMTP support.
//
// Required Supabase Secrets (set in dashboard → Edge Functions → Secrets):
//   GMAIL_USER         = yourname@gmail.com
//   GMAIL_APP_PASSWORD = xxxx-xxxx-xxxx-xxxx   (Google App Password, NOT your Gmail password)
//
// How to get an App Password:
//   1. Enable 2-Step Verification on your Google account
//   2. Go to myaccount.google.com → Security → App passwords
//   3. Create one named "CCG World Newsletter"
//   4. Copy the 16-character password into Supabase secrets

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    } = await req.json()

    if (!subject || !body || !recipients?.length) {
      return new Response(
        JSON.stringify({ error: 'subject, body, and recipients are required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const gmailUser     = Deno.env.get('GMAIL_USER')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailUser || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: 'GMAIL_USER and GMAIL_APP_PASSWORD secrets not set' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Build personalised HTML for each recipient
    const buildHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:36px;text-align:center;">
      <div style="color:#f59e0b;font-size:1.6rem;font-weight:900;letter-spacing:3px;font-family:Georgia,serif;">CCG WORLD</div>
      <div style="color:rgba(255,255,255,0.55);font-size:0.7rem;letter-spacing:4px;margin-top:6px;font-family:Arial,sans-serif;">CHRISTIAN CHURCH OF GOD MISSION</div>
    </div>

    <!-- Body -->
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

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:0.72rem;margin:0;font-family:Arial,sans-serif;">${footer}</p>
    </div>
  </div>
</body>
</html>`

    // Send emails via Gmail SMTP
    // Deno supports native TCP — we use raw SMTP over TLS
    let delivered = 0
    const errors: string[] = []

    for (const recipient of recipients) {
      const name      = recipient.name || 'Member'
      const toEmail   = recipient.email
      const html      = buildHtml(name)
      const plainText = `${greeting.replace('{name}', name)}\n\n${body}\n\n${signature}\n\n---\n${footer}`

      try {
        // Build RFC 2822 MIME message
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const message  = [
          `From: CCG World <${gmailUser}>`,
          `To: ${toEmail}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          plainText,
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          html,
          ``,
          `--${boundary}--`,
        ].join('\r\n')

        // Connect to Gmail SMTP over TLS (port 465)
        const conn = await Deno.connectTls({
          hostname: 'smtp.gmail.com',
          port: 465,
        })

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

        await readLine() // 220 greeting
        await send('EHLO ccgworld.org')
        await readLine() // 250 capabilities

        // AUTH LOGIN
        await send('AUTH LOGIN')
        await readLine() // 334 Username:
        await send(btoa(gmailUser))
        await readLine() // 334 Password:
        await send(btoa(gmailPassword))
        const authResult = await readLine()

        if (!authResult.startsWith('235')) {
          throw new Error(`Auth failed: ${authResult}`)
        }

        await send(`MAIL FROM:<${gmailUser}>`)
        await readLine()
        await send(`RCPT TO:<${toEmail}>`)
        await readLine()
        await send('DATA')
        await readLine()
        await send(message + '\r\n.')
        await readLine()
        await send('QUIT')
        conn.close()

        delivered++
      } catch (err) {
        errors.push(`${toEmail}: ${err.message}`)
      }

      // Small delay to avoid Gmail rate limits
      await new Promise(r => setTimeout(r, 150))
    }

    return new Response(
      JSON.stringify({
        success:   true,
        delivered,
        failed:    errors.length,
        errors:    errors.slice(0, 5),
        total:     recipients.length,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
