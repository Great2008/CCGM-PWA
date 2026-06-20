/**
 * useMaintenanceMode.js
 * Reads the 'maintenance' key from the shared site_settings table
 * (same table/pattern as useContent.js). Polls in the background so:
 *   - turning maintenance ON instantly locks visitors already on the site
 *   - turning maintenance OFF (from /admin) instantly restores it
 * without needing a hard refresh. Falls back to a localStorage cache so
 * a previously-known maintenance state still applies while offline.
 */
import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

const CACHE_KEY = 'ccgworld_maintenance_cache'
const POLL_MS = 30000
const DEFAULT_STATE = { enabled: false, message: '', eta: null }

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE
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
          const next = {
            enabled: !!data.value.enabled,
            message: data.value.message || '',
            eta: data.value.eta || null,
          }
          setState(next)
          saveCache(next)
        } else if (!error) {
          // Row not found / no maintenance configured yet — site is live
          setState(DEFAULT_STATE)
          saveCache(DEFAULT_STATE)
        }
      } catch {
        // Network error — keep whatever we last knew (cache/in-memory state)
      } finally {
        if (active) setLoaded(true)
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return { ...state, loaded }
}
