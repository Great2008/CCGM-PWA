import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     || 'mailto:info@ccgworld.org'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<{ ok: boolean; error?: string }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 86400 }
    )
    return { ok: true }
  } catch (e: any) {
    const status = e.statusCode || 0
    if (status === 410 || status === 404) return { ok: false, error: 'expired' }
    return { ok: false, error: `HTTP ${status}: ${e.body?.substring(0, 200) || e.message}` }
  }
}

serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const { subscriptions, payload } = await req.json()
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ delivered: 0, failed: 0 }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    let delivered = 0, failed = 0
    const expired: string[] = []

    await Promise.all(subscriptions.map(async (sub: any) => {
      const result = await sendPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
      if (result.ok) {
        delivered++
      } else {
        failed++
        console.error(`Push failed for ${sub.endpoint.substring(0, 60)}: ${result.error}`)
        if (result.error === 'expired') expired.push(sub.endpoint)
      }
    }))

    if (expired.length) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const sb = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )
      for (const ep of expired) await sb.from('push_subscriptions').delete().eq('endpoint', ep)
    }

    return new Response(JSON.stringify({ delivered, failed, expired: expired.length }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (e: any) {
    console.error('send-push error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})