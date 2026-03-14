import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APP_URL  = Deno.env.get('APP_URL')        || 'https://ccgworld.vercel.app'
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM     = Deno.env.get('FROM_EMAIL')      || 'noreply@ccgworld.org'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function suspensionHtml(name: string, reason: string, period: string, until: string | null) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Account Suspended — CCG World</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:36px 40px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:12px;">🚫</div>
            <h1 style="color:#fff;font-size:1.5rem;margin:0 0 6px;font-weight:800;">Account Suspended</h1>
            <p style="color:rgba(255,255,255,0.75);margin:0;font-size:0.9rem;">CCG World — Christian Church of God Mission</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your <strong>CCG World</strong> account has been suspended by the admin team.
              You can still browse public content but cannot post or interact until reinstated.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;">
                  <span style="font-size:0.72rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Reason</span><br/>
                  <span style="color:#7f1d1d;font-size:0.92rem;font-weight:600;">${reason}</span>
                </p>
                <p style="margin:0 0 12px;border-top:1px solid #fecaca;padding-top:12px;">
                  <span style="font-size:0.72rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Duration</span><br/>
                  <span style="color:#7f1d1d;font-size:0.92rem;font-weight:600;">${period}</span>
                </p>
                <p style="margin:0;border-top:1px solid #fecaca;padding-top:12px;">
                  <span style="font-size:0.72rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.08em;">Suspended Until</span><br/>
                  <span style="color:#7f1d1d;font-size:0.92rem;font-weight:600;">${until ?? 'Indefinite — admin will reinstate manually'}</span>
                </p>
              </td></tr>
            </table>
            <p style="color:#374151;font-size:0.92rem;line-height:1.7;margin:0 0 28px;">
              If you believe this is a mistake, please reach out through our contact page.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr><td style="background:#16a34a;border-radius:10px;">
                <a href="${APP_URL}/contact" style="display:inline-block;padding:13px 32px;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;">Contact Us →</a>
              </td></tr>
            </table>
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
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Account Reinstated — CCG World</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0a2612,#166534);padding:36px 40px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:12px;">✅</div>
            <h1 style="color:#fff;font-size:1.5rem;margin:0 0 6px;font-weight:800;">Account Reinstated</h1>
            <p style="color:rgba(255,255,255,0.75);margin:0;font-size:0.9rem;">CCG World — Christian Church of God Mission</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:1rem;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin:0 0 24px;">
              Your <strong>CCG World</strong> account suspension has been lifted.
              You now have full access and can participate in the community again.
            </p>
            <p style="color:#374151;font-size:0.92rem;line-height:1.7;margin:0 0 28px;">
              Welcome back! Please continue to uphold our community guidelines as you engage with fellow members.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr><td style="background:#16a34a;border-radius:10px;">
                <a href="${APP_URL}/timeline" style="display:inline-block;padding:13px 32px;color:#fff;font-weight:700;font-size:0.92rem;text-decoration:none;">Back to Timeline →</a>
              </td></tr>
            </table>
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
    if (!RESEND_KEY) throw new Error('RESEND_API_KEY secret not set')

    const isReinstatement = type === 'reinstatement'
    const subject = isReinstatement
      ? '✅ Your CCG World Account Has Been Reinstated'
      : '🚫 Your CCG World Account Has Been Suspended'
    const html = isReinstatement
      ? reinstatedHtml(name || 'Member')
      : suspensionHtml(name || 'Member', reason || 'Community guideline violation', period || 'Unspecified', until || null)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CCG World <' + FROM + '>',
        to: [email],
        subject,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Resend API error')

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e: any) {
    console.error('send-suspension-email:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
