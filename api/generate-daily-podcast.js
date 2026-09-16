// api/generate-daily-podcast.js
// Vercel Serverless Function — replaces the old Supabase Edge Function of
// the same name. Lives in the same repo as the rest of the app, so it
// deploys automatically on every git push. No dashboard paste-and-deploy
// step needed anymore.
//
// TTS logic is UNCHANGED from the Supabase version (still edge-tts-universal) —
// this migration is a pure platform swap. If Edge TTS was hanging due to
// Deno's WebSocket handling, Node's more mature WebSocket support may
// resolve that as a side effect; if not, swapping providers later is a
// one-function change, independent of this migration.
//
// SETUP REQUIRED (one time):
//   1. Add "edge-tts-universal": "^1.4.0" to package.json dependencies —
//      Vercel runs npm install during its own build, so no local npm
//      needed on your end.
//   2. Vercel Dashboard → Project Settings → Environment Variables, add:
//        SUPABASE_URL              (same value as your Supabase project URL)
//        SUPABASE_SERVICE_ROLE_KEY (same value as before)
//        SUPABASE_ANON_KEY         (used only to verify admin callers)
//        CRON_SECRET               (any long random string you make up —
//                                    used to authenticate the daily cron call)
//   3. Redeploy (Environment Variable changes need a redeploy to take effect).
//   4. Update the pg_cron job's URL + header — see updated podcast-setup.sql.
//
// Two ways this gets triggered:
//   - On-demand from AdminPodcast.jsx, authenticated via the admin's own
//     Supabase session token (verified server-side against is_admin()).
//   - Daily via pg_cron, authenticated via a shared secret header instead
//     (cron has no "user" to check).
//
// IMPORTANT: check your Vercel plan's function duration limit. TTS
// generation for a full 5-minute script can take up to ~30s. The
// `maxDuration` export below asks for 60s — confirm your plan allows that
// (Hobby/Pro both currently support up to 60s, but limits change, so it's
// worth a quick check in your Vercel dashboard if this ever times out).

export const config = { maxDuration: 60 }

import { createClient } from '@supabase/supabase-js'
import { UniversalEdgeTTS } from 'edge-tts-universal'

const SUPABASE_URL      = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY          = process.env.SUPABASE_ANON_KEY
const CRON_SECRET       = process.env.CRON_SECRET

const VOICE = 'en-GB-ThomasNeural' // deep, dramatic British male — matches the voice picked earlier
const WORDS_PER_MINUTE = 150
const MAX_WORDS = 750
const MAX_CHARS_PER_REQUEST = 1500

function stripScript(raw) {
  return raw.replace(/^##?\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

function chunkText(text, maxLen) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text]
  const chunks = []
  let current = ''
  for (const s of sentences) {
    if ((current + s).length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

async function synthesizeChunk(text) {
  const tts = new UniversalEdgeTTS(text, VOICE)
  const result = await tts.synthesize()
  const buf = Buffer.from(await result.audio.arrayBuffer())
  if (buf.length < 100) {
    throw new Error(`Edge TTS returned an empty/invalid audio chunk for: "${text.slice(0, 40)}..."`)
  }
  return buf
}

function concatMp3(chunks) {
  return Buffer.concat(chunks)
}

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Verifies the caller is a logged-in admin by checking their Supabase
// session token against the same is_admin() function your RLS policies
// already use — no separate admin table to maintain.
async function verifyAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(token)
  if (userErr || !userData?.user) return false
  const { data: isAdmin } = await userClient.rpc('is_admin')
  return !!isAdmin
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronHeader = req.headers['x-cron-secret']
  const isCron = CRON_SECRET && cronHeader === CRON_SECRET
  const isAdmin = isCron ? true : await verifyAdmin(req.headers.authorization)

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const episodeId = req.body?.episode_id

    let episode = null
    if (episodeId) {
      const { data, error } = await sb
        .from('podcast_episodes')
        .select('id, title, script')
        .eq('id', episodeId)
        .maybeSingle()
      if (error) throw error
      episode = data
    } else {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await sb
        .from('podcast_episodes')
        .select('id, title, script')
        .eq('published', true)
        .eq('episode_date', today)
        .is('audio_url', null)
        .maybeSingle()
      if (error) throw error
      episode = data
    }

    if (!episode) {
      return res.status(200).json({ skipped: true, reason: 'No matching episode to process' })
    }

    let script = stripScript(`${episode.title}. ${episode.script || ''}`)
    const words = script.split(' ')
    if (words.length > MAX_WORDS) script = words.slice(0, MAX_WORDS).join(' ') + '.'

    const chunks = chunkText(script, MAX_CHARS_PER_REQUEST)
    const audioChunks = []
    for (const chunk of chunks) {
      audioChunks.push(await withTimeout(synthesizeChunk(chunk), 40000, 'TTS synthesis timed out after 40s for one chunk'))
    }
    const audio = concatMp3(audioChunks)

    const path = `${episode.id}.mp3`
    const { error: upErr } = await sb.storage
      .from('podcast-audio')
      .upload(path, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '0' })
    if (upErr) throw upErr

    const { data: pub } = sb.storage.from('podcast-audio').getPublicUrl(path)
    const audioUrl = `${pub.publicUrl}?v=${Date.now()}`
    const durationSeconds = Math.round((script.split(' ').length / WORDS_PER_MINUTE) * 60)

    const { error: updateErr } = await sb
      .from('podcast_episodes')
      .update({ audio_url: audioUrl, duration_seconds: durationSeconds, status: 'ready' })
      .eq('id', episode.id)
    if (updateErr) throw updateErr

    return res.status(200).json({ success: true, url: audioUrl, seconds: durationSeconds })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
