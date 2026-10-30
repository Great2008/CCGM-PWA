// api/delete-account.js — a member permanently deletes their own account.
//
// Why this is a server route: removing a sign-in account needs the secret service key, which must
// never be in the browser. (The old button called auth.admin.deleteUser from the browser, which
// Supabase refuses, so only sign-out happened and the email stayed registered.)
//
// Order: verify -> collect file paths -> delete data rows -> delete files -> delete profile
//        -> delete the sign-in account (this is what frees the email) -> goodbye email.
import { createClient } from '@supabase/supabase-js'
import { cors, authenticate, serviceClient, emailConfigured, sendEmail, escapeHtml } from '../server/mail.js'

export const config = { maxDuration: 60 }

const STAFF_ROLES = ['moderator', 'admin', 'super_admin']

// Rows owned by the member. Children come before parents. A table or column that doesn't exist
// in your database is skipped silently, so this list can safely be a little generous.
const OWNED = [
  ['timeline_reactions', 'user_id'], ['timeline_comments', 'user_id'],
  ['post_reports', 'reporter_id'],   ['post_reports', 'user_id'],
  ['topic_replies', 'user_id'],      ['prayer_replies', 'user_id'],   ['prayer_prays', 'user_id'],
  ['timeline_posts', 'user_id'],     ['timeline_topics', 'user_id'],  ['prayer_requests', 'user_id'],
  ['live_chat', 'user_id'],          ['event_registrations', 'user_id'], ['programme_rsvps', 'user_id'],
  ['meal_checkins', 'user_id'],      ['hymn_favourites', 'user_id'],  ['devotional_bookmarks', 'user_id'],
  ['sermon_notes', 'user_id'],       ['branch_suggestions', 'user_id'], ['studio_submissions', 'user_id'],
  ['push_subscriptions', 'user_id'], ['suspension_logs', 'user_id'],
  ['member_follows', 'follower_id'], ['member_follows', 'following_id'],
]
// Rows that identify the member only by their email address.
const BY_EMAIL = [['newsletter_subscribers', 'email'], ['email_delivery_logs', 'recipient_email']]

const BUCKETS = ['avatars', 'media']
const MISSING = new Set(['42P01', '42703', 'PGRST205', 'PGRST204'])   // no such table / column

// Find storage URLs that are the WHOLE value of a field in the member's own rows.
// (Whole-value only, so a URL pasted inside post text never causes a file to be removed.)
function collectFiles(rows, found) {
  const re = /\/storage\/v1\/object\/public\/([a-z0-9_-]+)\/(.+?)(?:\?.*)?$/i
  for (const row of rows || []) {
    for (const v of Object.values(row)) {
      if (typeof v !== 'string' || v.length > 600) continue
      const m = v.match(re)
      if (m && BUCKETS.includes(m[1])) found.add(`${m[1]}::${decodeURIComponent(m[2])}`)
    }
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return
  const ctx = await authenticate(req)
  if (!ctx) return res.status(401).json({ error: 'Please sign in again and retry' })

  try {
    const { password, confirm } = req.body || {}
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' })
    if (!password) return res.status(400).json({ error: 'Enter your password to confirm' })

    const uid = ctx.user.id
    const email = ctx.user.email
    const sb = serviceClient()

    // Guard rails
    const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle()
    if (STAFF_ROLES.includes(profile?.role)) {
      return res.status(403).json({ error: 'Admin and moderator accounts can’t be deleted here. Ask a super admin to change your role first.' })
    }
    if (profile?.suspended) {
      return res.status(403).json({ error: 'Your account is suspended, so it can’t be deleted right now. Please contact us.' })
    }

    // Re-check the password (protects against a stolen or left-open session)
    const checker = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error: pwErr } = await checker.auth.signInWithPassword({ email, password })
    if (pwErr) return res.status(401).json({ error: 'That password is incorrect' })

    const warnings = []

    // 1) Remember which uploaded files belong to this member (before their rows disappear)
    const files = new Set()
    const tables = [...new Set(OWNED.map(([t]) => t))]
    await Promise.all(tables.map(async t => {
      const col = OWNED.find(([tt]) => tt === t)[1]
      const { data } = await sb.from(t).select('*').eq(col, uid).limit(500)
      collectFiles(data, files)
    }))
    if (profile) collectFiles([profile], files)

    // 2) Delete the member's rows
    for (const [table, col] of OWNED) {
      const { error } = await sb.from(table).delete().eq(col, uid)
      if (error && !MISSING.has(error.code)) warnings.push(`${table}: ${error.message}`)
    }
    for (const [table, col] of BY_EMAIL) {
      const { error } = await sb.from(table).delete().eq(col, email)
      if (error && !MISSING.has(error.code)) warnings.push(`${table}: ${error.message}`)
    }

    // 3) Delete files: the avatar (fixed path from the app) plus anything found above
    const byBucket = {}
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) (byBucket.avatars ||= new Set()).add(`avatars/${uid}.${ext}`)
    for (const f of files) { const [b, p] = f.split('::'); (byBucket[b] ||= new Set()).add(p) }
    for (const [bucket, paths] of Object.entries(byBucket)) {
      const { error } = await sb.storage.from(bucket).remove([...paths])
      if (error) warnings.push(`storage ${bucket}: ${error.message}`)
    }

    // 4) Profile, then the sign-in account itself
    const { error: pErr } = await sb.from('profiles').delete().eq('id', uid)
    if (pErr && !MISSING.has(pErr.code)) warnings.push(`profiles: ${pErr.message}`)

    const { error: delErr } = await sb.auth.admin.deleteUser(uid)
    if (delErr) {
      console.error('delete-account: auth delete failed', delErr.message, warnings)
      return res.status(500).json({ error: 'We couldn’t finish deleting your account. Please try again, or contact us if it keeps happening.' })
    }
    if (warnings.length) console.warn('delete-account warnings for', uid, warnings)

    // 5) Goodbye email. Awaited (a background send can be killed once the response goes out) and
    //    deliberately NOT written to the delivery logs, so the deleted member's address isn't re-stored.
    if (email && emailConfigured()) {
      const name = escapeHtml(profile?.display_name || profile?.full_name || 'Member')
      await Promise.race([sendEmail({
        to: email,
        subject: 'Your CCG World account has been deleted',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;"><div style="font-family:Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1f2937;">
<p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">Dear ${name},</p>
<p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">This is to confirm that your CCG World account and the information linked to it have been deleted, as you requested.</p>
<p style="font-size:0.95rem;line-height:1.6;margin:0 0 16px;">If this wasn’t you, please contact us right away. You are always welcome to join again.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;"/><p style="font-size:0.75rem;color:#9ca3af;margin:0;line-height:1.6;">God first always. God bless you.<br/>One Family. One Faith. One Mission.<br/>CCG World.</p></div></body></html>`,
        text: `Dear ${profile?.display_name || profile?.full_name || 'Member'},\n\nThis is to confirm that your CCG World account and the information linked to it have been deleted, as you requested.\n\nIf this wasn’t you, please contact us right away. You are always welcome to join again.\n\nGod first always. God bless you.\nCCG World.`,
      }), new Promise(r => setTimeout(r, 5000))]).catch(() => {})
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('delete-account error:', e.message)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
