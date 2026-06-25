/**
 * useMaintenanceMode.js
 * Reads the 'maintenance' and 'maintenance_schedule' keys from site_settings.
 *
 * Manual mode:
 *   - Admin flips the toggle → instantly locks/unlocks within 30s poll.
 *   - If an ETA is set, auto-unlocks the moment countdown hits zero.
 *
 * Scheduled mode:
 *   - Admin sets recurring windows (e.g. every Friday 17:00–18:00).
 *   - The hook checks the schedule on every poll and auto-enables/disables
 *     maintenance mode client-side during the window.
 *   - Manual toggle always overrides the schedule for that session.
 */
import { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'

const CACHE_KEY     = 'ccgworld_maintenance_cache'
const SCHED_KEY     = 'ccgworld_maintenance_schedule'
const POLL_MS       = 30000
const MAX_TIMEOUT_MS = 2 ** 31 - 1
const DEFAULT_STATE = { enabled: false, message: '', eta: null }
const DEFAULT_SCHED = { enabled: false, days: [], startTime: '', endTime: '', message: '' }

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// Returns true if current local time falls inside any scheduled window
function isInScheduleWindow(schedule) {
  if (!schedule?.enabled || !schedule.days?.length || !schedule.startTime || !schedule.endTime) return false
  const now   = new Date()
  const day   = now.getDay() // 0=Sun … 6=Sat
  if (!schedule.days.includes(day)) return false
  const [sh, sm] = schedule.startTime.split(':').map(Number)
  const [eh, em] = schedule.endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins   = eh * 60 + em
  const nowMins   = now.getHours() * 60 + now.getMinutes()
  return nowMins >= startMins && nowMins < endMins
}

function applyExpiry(state) {
  if (!state.enabled || !state.eta) return state
  const etaTime = new Date(state.eta).getTime()
  if (!isNaN(etaTime) && Date.now() >= etaTime) return { ...state, enabled: false }
  return state
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? applyExpiry({ ...DEFAULT_STATE, ...JSON.parse(raw) }) : DEFAULT_STATE
  } catch { return DEFAULT_STATE }
}

function loadSchedCache() {
  try {
    const raw = localStorage.getItem(SCHED_KEY)
    return raw ? { ...DEFAULT_SCHED, ...JSON.parse(raw) } : DEFAULT_SCHED
  } catch { return DEFAULT_SCHED }
}

function saveCache(state)  { try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)) } catch {} }
function saveSchedCache(s) { try { localStorage.setItem(SCHED_KEY, JSON.stringify(s)) } catch {} }

export default function useMaintenanceMode() {
  const [state,    setState]    = useState(loadCache)
  const [schedule, setSchedule] = useState(loadSchedCache)
  const [loaded,   setLoaded]   = useState(false)
  const expiryTimer = useRef(null)

  const scheduleExpiry = (s) => {
    if (expiryTimer.current) { clearTimeout(expiryTimer.current); expiryTimer.current = null }
    if (!s.enabled || !s.eta) return
    const etaTime = new Date(s.eta).getTime()
    if (isNaN(etaTime)) return
    const delay = etaTime - Date.now()
    if (delay <= 0 || delay > MAX_TIMEOUT_MS) return
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
        // Fetch both maintenance state and schedule in one round trip
        const { data: rows, error } = await supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['maintenance', 'maintenance_schedule'])

        if (!active || error) return

        let nextState    = DEFAULT_STATE
        let nextSchedule = DEFAULT_SCHED

        rows?.forEach(row => {
          if (row.key === 'maintenance' && row.value) {
            nextState = applyExpiry({
              enabled: !!row.value.enabled,
              message: row.value.message || '',
              eta:     row.value.eta || null,
            })
          }
          if (row.key === 'maintenance_schedule' && row.value) {
            nextSchedule = { ...DEFAULT_SCHED, ...row.value }
          }
        })

        // If manual mode is OFF, let the schedule decide
        if (!nextState.enabled && isInScheduleWindow(nextSchedule)) {
          nextState = {
            enabled: true,
            message: nextSchedule.message || DEFAULT_STATE.message,
            eta: null,
          }
        }

        setState(nextState)
        saveCache(nextState)
        scheduleExpiry(nextState)
        setSchedule(nextSchedule)
        saveSchedCache(nextSchedule)
      } catch {
        // Network error — keep cached state
      } finally {
        if (active) setLoaded(true)
      }
    }

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

  return { ...state, loaded, schedule }
}
