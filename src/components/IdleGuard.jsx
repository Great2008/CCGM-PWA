// src/components/IdleGuard.jsx
// Applies the auto sign-out policy to the main site. (The /admin app mounts <IdleSignOut> itself.)
import { useAuth } from '../contexts/AuthContext'
import IdleSignOut from './IdleSignOut'
import { STAFF_IDLE_MS, SHARED_IDLE_MS, MEMBER_IDLE_MS, WARN_MS, SHARED_DEVICE_KEY } from '../lib/sessionPolicy'

export default function IdleGuard() {
  const { user, isModerator, signOut } = useAuth()
  let shared = false
  try { shared = localStorage.getItem(SHARED_DEVICE_KEY) === '1' } catch { /* ignore */ }
  const timeoutMs = isModerator ? STAFF_IDLE_MS : shared ? SHARED_IDLE_MS : MEMBER_IDLE_MS
  const warnMs    = (isModerator || shared) ? WARN_MS : 0       // 7-day sessions sign out quietly
  return <IdleSignOut active={!!user} timeoutMs={timeoutMs} warnMs={warnMs} onSignOut={signOut} />
}
