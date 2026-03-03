import { createClient } from '@supabase/supabase-js'

const URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(URL, ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export default supabase
