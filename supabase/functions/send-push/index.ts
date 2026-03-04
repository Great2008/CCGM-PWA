import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     || 'mailto:info@ccgworld.org'
const FIREBASE_PROJECT  = Deno.env.get('FIREBASE_PROJECT_ID') || ''
const FIREBASE_SA_JSON  = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || ''

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// ── FCM V1 via service account ───────────────────────────────────────
async function getFCMAccessToken(): Promise<string> {
  const sa = JSON.parse(FIREBASE_SA_JSON)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${encode(header)}.${encode(payload)}`

  // Import RSA private key
  const pemKey = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
    .trim()

  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

async function sendFCM(
  fcmToken: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await getFCMAccessToken()
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            android: {
              notification: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                channel_id: 'ccg_world',
                icon: 'ic_launcher',
                color: '#0f1f3d',
              },
            },
            data: {
              url:  payload.url  || '/',
              tag:  payload.tag  || 'general',
            },
          },
        }),
      }
    )
    const result = await res.json()
    if (!res.ok) return { ok: false, error: JSON.stringify(result.error) }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// ── Web Push (VAPID) ─────────────────────────────────────────────────
async function sendWebPush(
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

// ── Main handler ─────────────────────────────────────────────────────
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
      const isFCM = sub.p256dh === 'fcm' || sub.auth === 'fcm'

      let result
      if (isFCM) {
        // Native Android — send via FCM V1
        result = await sendFCM(sub.endpoint, payload)
      } else {
        // Web/PWA — send via VAPID
        result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        )
      }

      if (result.ok) {
        delivered++
      } else {
        failed++
        console.error(`Push failed [${isFCM ? 'FCM' : 'VAPID'}] ${sub.endpoint.substring(0, 60)}: ${result.error}`)
        if (result.error === 'expired') expired.push(sub.endpoint)
      }
    }))

    // Clean up expired web push subscriptions
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
