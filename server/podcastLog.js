// server/podcastLog.js — writes the podcast generation log (see sql/podcast_generation_logs.sql).
// Logging must NEVER get in the way of making the podcast: every function here swallows its own
// errors (for example when the table has not been created yet) and simply returns.
const MAX_EVENTS = 80
const cut = (s, n) => (s == null ? null : String(s).slice(0, n))

// The final update for a log row. Pure, so it can be tested.
export function buildFinish({ startedAt, trace, stage, error, chars, parts, audioBytes, audioSeconds, now = Date.now() }) {
  const failed = !!error
  const attempts = (trace?.events || []).slice(0, MAX_EVENTS).map(e => ({ ...e, error: e.error ? cut(e.error, 200) : undefined }))
  return {
    status: failed ? 'failed' : 'success',
    provider: trace?.provider || null,
    stage: failed ? (stage || 'speech') : null,
    error_message: failed ? cut(error, 600) : null,
    duration_ms: Math.max(0, now - startedAt),
    chars: chars ?? null,
    parts: parts ?? null,
    audio_bytes: audioBytes ?? null,
    audio_seconds: audioSeconds ?? null,
    attempts,
  }
}

// Writes a "running" row as soon as generation starts. If the server is later cut off at its time
// limit, that row stays "running" forever, and the log page then shows it as "never finished".
export async function startPodcastLog(sb, { episode, source, triggeredBy }) {
  try {
    const { data, error } = await sb.from('podcast_generation_logs').insert({
      episode_id: episode?.id != null ? String(episode.id) : null,
      episode_title: cut(episode?.title, 200),
      source, triggered_by: triggeredBy || null, status: 'running',
    }).select('id').single()
    return error ? null : (data?.id ?? null)
  } catch { return null }
}

export async function finishPodcastLog(sb, logId, details) {
  if (!logId) return
  try { await sb.from('podcast_generation_logs').update(buildFinish(details)).eq('id', logId) } catch { /* ignore */ }
}
