/**
 * useMaintenanceMode.js
 * Reads the 'maintenance' key from the shared site_settings table
 * (same table/pattern as useContent.js).
 *
 *   - Turning maintenance ON instantly locks visitors already on the site
 *     (next 30s poll picks it up).
 *   - If an ETA is set, the site automatically unlocks itself the exact
 *     moment the countdown hits zero — no admin action needed. This is
 *     done purely client-side (no write to Supabase from the public,
 *     anon-key client — only /admin, using the privileged service-role
 *     client, is allowed to persist the "enabled" flag).
 *   - Turning maintenance OFF from /admin instantly restores the site
 *     for anyone already on it, without a hard refresh.
 *
 * Falls back to a localStorage cache so a previously-known maintenance
 * state still applies while offline.
 */
import { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'

const CACHE_KEY = 'ccgworld_maintenance_cache'
const POLL_MS = 30000
const MAX_TIMEOUT_MS = 2 ** 31 - 1 // setTimeout's practical ceiling (~24.8 days)
const DEFAULT_STATE = { enabled: false, message: '', eta: null }

// If an ETA is set and has already passed, treat the site as live —
// this is what makes maintenance mode "auto disable on countdown".
function applyExpiry(state) {
  if (!state.enabled || !state.eta) return state
  const etaTime = new Date(state.eta).getTime()
  if (!isNaN(etaTime) && Date.now() >= etaTime) {
    return { ...state, enabled: false }
  }
  return state
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? applyExpiry({ ...DEFAULT_STATE, ...JSON.parse(raw) }) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function saveCache(state) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)) } catch {}
}

export default function useMaintenanceMode() {
  const [state, setState] = useState(loadCache)
  const [loaded, setLoaded] = useState(false)
  const expiryTimer = useRef(null)

  // Schedules an exact, instant unlock right when the ETA is reached,
  // instead of waiting for the next 30s poll.
  const scheduleExpiry = (s) => {
    if (expiryTimer.current) { clearTimeout(expiryTimer.current); expiryTimer.current = null }
    if (!s.enabled || !s.eta) return
    const etaTime = new Date(s.eta).getTime()
    if (isNaN(etaTime)) return
    const delay = etaTime - Date.now()
    if (delay <= 0) return // already expired — applyExpiry() handles this
    if (delay > MAX_TIMEOUT_MS) return // sanity guard for absurdly far-out ETAs
    expiryTimer.current = setTimeout(() => {
      setState(prev => {
        const next = { ...prev, enabled: false }
        saveCache(next)
        return next
      })
    }, delay)
  }

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'maintenance')
          .single()
        if (!active) return
        if (!error && data?.value) {
          const next = applyExpiry({
            enabled: !!data.value.enabled,
            message: data.value.message || '',
            eta: data.value.eta || null,
          })
          setState(next)
          saveCache(next)
          scheduleExpiry(next)
        } else if (!error) {
          // Row not found / no maintenance configured yet — site is live
          setState(DEFAULT_STATE)
          saveCache(DEFAULT_STATE)
          scheduleExpiry(DEFAULT_STATE)
        }
      } catch {
        // Network error — keep whatever we last knew (cache/in-memory state)
      } finally {
        if (active) setLoaded(true)
      }
    }

    // Apply expiry to the cached state immediately and schedule its
    // unlock too, in case it was loaded mid-countdown from a previous visit.
    scheduleExpiry(state)

    check()
    const interval = setInterval(check, POLL_MS)
    return () => {
      active = false
      clearInterval(interval)
      if (expiryTimer.current) clearTimeout(expiryTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, loaded }
}
