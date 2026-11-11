// src/admin/podcastGenerate.js
// Asks the server to turn an episode's script into audio, and copes sensibly when that takes a while.
//
// Why this exists: the page used to give up after 45 seconds, but the server is allowed about 60
// (Piper can need most of that), and it keeps working after the page stops listening. So the page
// could say "timed out" while the audio was actually being saved, and the server's real error message
// (which only arrives at the end) was replaced by a generic one.
//
// Now: wait for the server's real answer (90s safety net only); if the connection is lost or the
// server is cut off, check whether the audio got saved anyway before reporting a failure.
//
// Everything outside this file is passed in, so it can be tested without a browser:
//   getToken()          -> admin's session token
//   readEpisode(id)     -> { audio_url, duration_seconds } for the episode
export async function generateAudio(episodeId, previousUrl, {
  getToken, readEpisode,
  fetchFn = (...a) => fetch(...a),
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  timeoutMs = 90000, recoverMs = 30000, pollMs = 5000,
}) {
  // Did the server save NEW audio (a different address from before) while we were not listening?
  async function savedMeanwhile(waitMs) {
    const stopAt = Date.now() + waitMs
    do {
      try {
        const ep = await readEpisode(episodeId)
        if (ep?.audio_url && ep.audio_url !== (previousUrl || null)) return { url: ep.audio_url, seconds: ep.duration_seconds }
      } catch { /* try again */ }
      if (Date.now() + pollMs >= stopAt) break
      await sleep(pollMs)
    } while (Date.now() < stopAt)
    return null
  }

  let res
  const token = await getToken()
  let timer
  try {
    res = await Promise.race([
      fetchFn('/api/generate-daily-podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ episode_id: episodeId }),
      }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs) }),
    ])
  } catch (e) {
    const saved = await savedMeanwhile(e.message === 'TIMEOUT' ? recoverMs : Math.min(recoverMs, 15000))
    if (saved) return saved
    throw new Error(e.message === 'TIMEOUT'
      ? `No answer from the server after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`
      : 'Connection problem. Check your internet and try again.')
  } finally { clearTimeout(timer) }

  const data = await res.json().catch(() => ({}))

  // 502/504 = the hosting platform stopped the server at its time limit (about 60s).
  if (res.status === 504 || res.status === 502) {
    const saved = await savedMeanwhile(Math.min(recoverMs, 15000))
    if (saved) return saved
    throw new Error('The server ran out of time (about 60 seconds). The voice service may be slow to start up. Please try again; the second attempt is usually quicker.')
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)    // the server's real message, unchanged
  if (data?.skipped) throw new Error(data.reason || 'Generation was skipped')
  return data
}
