import supabaseAdmin from '../lib/supabaseAdmin'

// ── Site Settings ──────────────────────────────────────────
export async function getContent(key) {
  const { data } = await supabaseAdmin.from('site_settings').select('value').eq('key', key).single()
  return data?.value || null
}
export async function setContent(key, value) {
  const { error } = await supabaseAdmin.from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

// ── Generic CRUD helpers (used by older admin pages) ───────
export async function getAll(table, order = 'created_at') {
  const { data, error } = await supabaseAdmin.from(table).select('*').order(order, { ascending: false })
  if (error) throw new Error(error.message)
  return { data: data || [], error: null }
}
export async function insert(table, row) {
  const { data, error } = await supabaseAdmin.from(table).insert(row).select().single()
  return { data, error }
}
export async function update(table, id, row) {
  const { data, error } = await supabaseAdmin.from(table).update(row).eq('id', id).select().single()
  return { data, error }
}
export async function remove(table, id) {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
  return error
}
