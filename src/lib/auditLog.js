import supabase from './supabase'

/**
 * Write an entry to the admin_audit_log table.
 * Safe to call from anywhere — failures are silent so they never
 * interrupt the action being performed.
 *
 * @param {string} action      - e.g. 'timeline_delete', 'prayer_delete'
 * @param {string} detail      - human-readable description
 * @param {string} targetName  - optional name of the affected item/person
 */
export async function auditLog(action, detail, targetName = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('admin_audit_log').insert({
      admin_id:    user.id,
      action,
      detail:      detail || null,
      target_name: targetName || null,
    })
  } catch (e) {
    console.warn('[auditLog] failed silently:', e?.message)
  }
}
