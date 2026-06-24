/**
 * siteSettings.js
 * Several independent components read different keys from the same
 * `site_settings` table on first paint (homepage, live, daily_verse — and
 * Footer + Home both read 'homepage' separately). Each used to fire its
 * own `.eq('key', X).single()` request, which PageSpeed's network
 * waterfall showed stacking up as ~5 sequential ~1.1s round trips on a
 * single page load.
 *
 * This module batches all of them into ONE request the first time any of
 * them is needed, and dedupes concurrent calls so two components asking
 * for the same (or different) keys in the same tick share one network
 * request instead of firing one each.
 *
 * Note: useMaintenanceMode.js intentionally does NOT use this — it polls
 * site_settings on its own schedule so maintenance mode can flip on/off
 * and auto-unlock without a refresh, and that polling logic shouldn't be
 * coupled to this cache.
 */
import supabase from './supabase'

// The keys read on a typical page load. Add to this list if a new
// site_settings key gets read on first paint elsewhere.
const KNOWN_KEYS = ['homepage', 'live', 'daily_verse']

const cache = new Map()
let inFlight = null

async function fetchKnownKeys() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', KNOWN_KEYS)
  if (!error && data) {
    data.forEach(row => cache.set(row.key, row.value))
  }
  return cache
}

// Returns the value for `key`, transparently batched with any other
// getSiteSetting() calls happening around the same time.
export async function getSiteSetting(key) {
  if (cache.has(key)) return cache.get(key)
  if (!inFlight) inFlight = fetchKnownKeys().finally(() => { inFlight = null })
  await inFlight
  if (cache.has(key)) return cache.get(key)
  // Not one of the batched keys (a one-off lookup) — fetch it by itself.
  // maybeSingle() avoids PostgREST's 406 when the row doesn't exist yet.
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle()
  const value = data?.value ?? null
  if (value !== null) cache.set(key, value)
  return value
}

// Lets a realtime UPDATE handler (or any fresher read) push a new value
// into the shared cache so other consumers see it without a re-fetch.
export function setSiteSettingCache(key, value) {
  cache.set(key, value)
}
