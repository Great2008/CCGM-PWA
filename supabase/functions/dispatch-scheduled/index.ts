import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    // Fetch all pending notifications due now (with a 5-min look-ahead buffer for late cron)
    const { data: due, error: fetchErr } = await sb
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())

    if (fetchErr) throw fetchErr
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Get all push subscriptions once
    const { data: subs, error: subErr } = await sb.from('push_subscriptions').select('*')
    if (subErr) throw subErr

    let dispatched = 0

    for (const notif of due) {
      // Mark as processing immediately to prevent double-dispatch if cron fires twice
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
        const { data: result, error: sendErr } = await sb.functions.invoke('send-push', {
          body: { subscriptions: subs, payload },
        })

        if (sendErr) throw sendErr

        // Mark sent and log it
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
      } catch (sendError: any) {
        console.error(`Failed to dispatch notification ${notif.id}:`, sendError)
        await sb.from('scheduled_notifications')
          .update({ status: 'failed', error: sendError.message })
          .eq('id', notif.id)
      }
    }

    return new Response(JSON.stringify({ dispatched, total: due.length }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (e: any) {
    console.error('dispatch-scheduled error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
