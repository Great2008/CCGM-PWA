import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Cookie-based storage for auth session — survives hard refreshes and
// can be read server-side (e.g. Vercel edge functions / API routes).
// Falls back to localStorage if cookies are unavailable.
const cookieStorage = {
  getItem: (key) => {
    const match = document.cookie.match(new RegExp('(^|;)\\s*' + encodeURIComponent(key) + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
  },
  setItem: (key, value) => {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString()
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`
  },
  removeItem: (key) => {
    document.cookie = `${encodeURIComponent(key)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  },
}

export const supabase = createClient(URL, ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: cookieStorage,
    storageKey: 'ccgm_auth',
  },
})

export default supabase
