// src/lib/sessionPolicy.js
// Auto sign-out rules in ONE place. Change a number here and it applies everywhere.
export const STAFF_IDLE_MS  = 1 * 60 * 1000            // admins & moderators: signed out after 20 min of inactivity
export const SHARED_IDLE_MS = 15 * 60 * 1000            // anyone who ticks "shared device" at sign-in: 15 min
export const MEMBER_IDLE_MS = 7 * 24 * 60 * 60 * 1000   // regular members on their own device: 7 days
export const WARN_MS        = 60 * 1000                 // "Still there?" warning shown for the last 60 seconds

export const SHARED_DEVICE_KEY = 'ccgm_shared_device'

// Pure decision function (kept separate so it can be tested without a browser).
//   lastActivity: ms timestamp of the last user activity   now: current ms timestamp
// Returns { action: 'none' | 'warn' | 'signout', secsLeft, nextCheckMs }
export function evaluateIdle(lastActivity, now, timeoutMs, warnMs = 0) {
  const idle = Math.max(0, now - lastActivity)
  if (idle >= timeoutMs) return { action: 'signout', secsLeft: 0, nextCheckMs: 0 }
  if (warnMs > 0 && idle >= timeoutMs - warnMs) {
    return { action: 'warn', secsLeft: Math.max(1, Math.ceil((timeoutMs - idle) / 1000)), nextCheckMs: 1000 }
  }
  const untilWarn = timeoutMs - warnMs - idle                 // time before anything needs to happen
  return { action: 'none', secsLeft: null, nextCheckMs: Math.min(15000, Math.max(1000, untilWarn)) }
}
