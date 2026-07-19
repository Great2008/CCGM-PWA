// DEPRECATED — do not use.
//
// This file used to create a Supabase client with the service_role key
// (VITE_SUPABASE_SERVICE_KEY), which bypasses ALL row-level security.
// Because this is a Vite SPA with no backend, that key was being baked
// as plain text into the public JS bundle — anyone could extract it from
// the browser and get full unrestricted database access.
//
// All admin functionality now goes through proper RLS policies via the
// regular client (src/lib/supabase.js) + role checks (is_admin(),
// is_mod_or_admin()) enforced at the database level. Do not reintroduce
// a service-role key into any client-side file.
throw new Error(
  'supabaseAdmin.js is deprecated. Import supabase from src/lib/supabase.js instead — ' +
  'admin access is enforced via RLS policies (is_admin()/is_mod_or_admin()), not a service key.'
)
