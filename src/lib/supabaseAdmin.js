import { createClient } from '@supabase/supabase-js'

// Service role key — admin panel only, never exposed on public pages
const URL         = import.meta.env.VITE_SUPABASE_URL
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const supabaseAdmin = createClient(URL || '', SERVICE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false }
})
export default supabaseAdmin
