// src/lib/api.js
// Calls our own Vercel API routes (/api/*) with the member's Supabase session token.
// Same call shape and return shape as supabase.functions.invoke(name, { body }),
// so call sites only need the function swapped:  { data, error }.
//
// Uses the absolute APP_URL (not a relative /api path) so the Capacitor mobile app —
// which is bundled locally, not served from Vercel — can call it too.
import supabase from './supabase'
import { APP_URL } from './config'

export async function invokeApi(name, { body } = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${APP_URL}/api/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { data, error: new Error(data?.error || `Request failed (${res.status})`) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}
