// api/send-rsvp-confirmation.js — confirmation email for a signed-in member's RSVP.
// Replaces the Supabase edge function of the same name.
//
// SECURITY: unlike the old version, this does NOT trust the email/event text the
// browser sends (that would let anyone use your domain to email arbitrary people).
// It only needs a registrationId, then looks up the member's own registration,
// the event details, and the recipient address server-side.
import { cors, authenticate, serviceClient, emailConfigured, sendEmail, logDelivery, rsvpConfirmationEmail } from '../server/mail.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { registrationId } = req.body || {}
    if (!registrationId) return res.status(400).json({ error: 'registrationId is required' })
    if (!emailConfigured()) return res.status(500).json({ error: 'RESEND_API_KEY and RESEND_FROM_EMAIL must be set' })

    const sb = serviceClient()
    const { data: reg } = await sb.from('event_registrations')
      .select('id,event_id,user_id').eq('id', registrationId).eq('user_id', ctx.user.id).maybeSingle()
    if (!reg) return res.status(404).json({ error: 'Registration not found' })

    const [{ data: event }, { data: profile }] = await Promise.all([
      sb.from('events').select('id,title,date,time,location').eq('id', reg.event_id).single(),
      sb.from('profiles').select('display_name,full_name').eq('id', ctx.user.id).maybeSingle(),
    ])
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const name = profile?.display_name || profile?.full_name || 'Member'
    const to = ctx.user.email
    const mail = rsvpConfirmationEmail({ name, event, registrationId: reg.id })

    let sendError = null
    try { await sendEmail({ to, ...mail }) } catch (e) { sendError = e.message }
    await logDelivery(sb, [{
      source: 'send-rsvp-confirmation', recipient_email: to, recipient_name: name,
      subject: mail.subject, success: !sendError, error_message: sendError,
    }])

    if (sendError) return res.status(500).json({ error: sendError })
    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
