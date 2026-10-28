// api/guest-rsvp.js — public (no login) event RSVP + confirmation email.
// Replaces the Supabase edge function of the same name.
import { cors, serviceClient, emailConfigured, sendEmail, logDelivery, rsvpConfirmationEmail } from '../server/mail.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (cors(req, res)) return
  try {
    const { eventId, name, email, phone } = req.body || {}
    const cleanName  = String(name || '').trim().slice(0, 120)
    const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 254)
    const cleanPhone = String(phone || '').trim().slice(0, 40)

    if (!eventId) return res.status(400).json({ error: 'eventId is required' })
    if (!cleanName) return res.status(400).json({ error: 'Name is required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email' })

    const sb = serviceClient()
    const { data: event, error: eventErr } = await sb
      .from('events').select('id,title,date,time,location').eq('id', eventId).single()
    if (eventErr || !event) return res.status(404).json({ error: 'Event not found' })

    const { data: reg, error: insertErr } = await sb
      .from('event_registrations')
      .insert({ event_id: eventId, is_guest: true, guest_name: cleanName, guest_email: cleanEmail, guest_phone: cleanPhone || null })
      .select('id').single()
    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json({ error: "You're already registered with this email" })
      return res.status(500).json({ error: insertErr.message })
    }

    // Best-effort email: the RSVP already succeeded, so a mail failure isn't an error response.
    const mail = rsvpConfirmationEmail({ name: cleanName, event, registrationId: reg.id })
    let emailSent = false, emailError = null
    try {
      if (!emailConfigured()) throw new Error('RESEND_API_KEY / RESEND_FROM_EMAIL not set')
      await sendEmail({ to: cleanEmail, ...mail })
      emailSent = true
    } catch (e) {
      emailError = e.message
      console.warn('RSVP confirmation email failed:', e.message)
    }
    await logDelivery(sb, [{
      source: 'guest-rsvp', recipient_email: cleanEmail, recipient_name: cleanName,
      subject: mail.subject, success: emailSent, error_message: emailError,
    }])

    return res.status(200).json({ success: true, registrationId: reg.id, emailSent, emailError })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
