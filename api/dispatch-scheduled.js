// api/dispatch-scheduled.js
// Vercel Serverless Function — replaces the Supabase Edge Function of the
// same name. Same logic, ported to Node.js.
//
// BRIDGE NOTE: send-push hasn't been migrated yet, so this still calls the
// EXISTING Supabase Edge Function "send-push" over HTTP (using the service
// role key as its bearer token, same as before). Once send-push is ported
// to Vercel too, update SEND_PUSH_URL below to point at
// `${VERCEL_URL}/api/send-push` instead — or better, just import its
// handler directly and call it in-process, since same-runtime function
// calls don't need an HTTP round-trip at all.
//
// SETUP REQUIRED (one time):
//   1. Vercel env vars (reuses the same ones as generate-daily-podcast if
//      already set): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET
//   2. Set up a pg_cron job pointing at this endpoint — see the SQL below.
//      Suggested schedule: every 5 minutes, since this checks for
//      notifications whose send_at time has already passed.
//
// -- pg_cron setup (run in Supabase SQL Editor) --
//   select cron.schedule(
//     'dispatch-scheduled',
//     '*/5 * * * *',
//     $$
//     select net.http_post(
//       url := 'https://ccgm-pwa.vercel.app/api/dispatch-scheduled',
//       headers := jsonb_build_object('x-cron-secret', 'CRON_SECRET_VALUE', 'Content-Type', 'application/json'),
//       body := '{}'::jsonb
//     );
//     $$
//   );

export const config = { maxDuration: 60 }

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY         = process.env.SUPABASE_ANON_KEY
const CRON_SECRET      = process.env.CRON_SECRET

const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`

async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(token)
  if (userErr || !userData?.user) return false
  const { data: isAdmin } = await userClient.rpc('is_admin')
  return !!isAdmin
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const isCron = CRON_SECRET && req.headers['x-cron-secret'] === CRON_SECRET
  const isAdmin = isCron ? true : await verifyAdmin(req.headers.authorization)
  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const { data: due, error: fetchErr } = await sb
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())

    if (fetchErr) throw fetchErr
    if (!due || due.length === 0) {
      return res.status(200).json({ dispatched: 0 })
    }

    const { data: subs, error: subErr } = await sb.from('push_subscriptions').select('*')
    if (subErr) throw subErr

    let dispatched = 0

    for (const notif of due) {
      await sb.from('scheduled_notifications')
        .update({ status: 'processing' })
        .eq('id', notif.id)

      const payload = {
        title: notif.title,
        body: notif.body,
        url: notif.url || '/',
        tag: notif.tag || 'general',
        image: notif.image || undefined,
        requireInteraction: notif.require_interaction || false,
        icon: '/icon-192.png',
        badge: '/icon-96.png',
      }

      try {
        const pushRes = await fetch(SEND_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ subscriptions: subs, payload }),
        })
        const result = await pushRes.json().catch(() => ({}))
        if (!pushRes.ok) throw new Error(result?.error || `send-push failed (${pushRes.status})`)

        await Promise.all([
          sb.from('scheduled_notifications')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', notif.id),
          sb.from('notification_logs').insert({
            title: notif.title,
            body: notif.body,
            url: notif.url,
            tag: notif.tag,
            recipients: subs?.length || 0,
            delivered: result?.delivered || 0,
            failed: result?.failed || 0,
            sent_at: new Date().toISOString(),
            scheduled: true,
          }),
        ])

        dispatched++
      } catch (sendError) {
        console.error(`Failed to dispatch notification ${notif.id}:`, sendError)
        await sb.from('scheduled_notifications')
          .update({ status: 'failed', error: sendError.message })
          .eq('id', notif.id)
      }
    }

    return res.status(200).json({ dispatched, total: due.length })
  } catch (e) {
    console.error('dispatch-scheduled error:', e)
    return res.status(500).json({ error: e.message })
  }
}
