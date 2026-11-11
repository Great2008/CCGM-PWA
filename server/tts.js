// server/tts.js — text-to-speech for the daily podcast.
//
// Voices are tried in this order, and the whole episode uses ONE voice (never a mix):
//   1. Piper      (your self-hosted API)  - when PIPER_API_URL + PIPER_API_KEY are set
//   2. Azure AI Speech (official)         - when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set
//   3. Edge TTS   (free, unofficial)      - last resort; Microsoft's endpoint is known to hang at times
// Everything runs inside a time budget so the caller always gets a clear message instead of a bare
// Vercel timeout.
const PIPER_PIECE_CHARS = 700    // small pieces: each is quick, and they are fetched in parallel
const PIPER_PARALLEL = 3
const VOICE = 'en-GB-ThomasNeural'   // Azure / Edge voice

const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Every voice attempt can be recorded into `trace.events` (pass { trace } to synthesizeAll). The podcast
// route saves it in the Generation Log, so you can see exactly what each voice did and how long it took.
const note = (trace, e) => {
  if (trace) trace.events.push({ ...e, error: e.error ? String(e.error).slice(0, 200) : undefined })
}

export const piperConfigured = () => !!(process.env.PIPER_API_URL && process.env.PIPER_API_KEY)
export const azureConfigured = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION)

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Split text into pieces of at most `max` characters, breaking at sentence ends where possible.
export function splitText(text, max) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text]
  const pieces = []
  let cur = ''
  const push = () => { if (cur.trim()) pieces.push(cur.trim()); cur = '' }
  for (let s of sentences) {
    while (s.length > max) {                       // one huge sentence: cut at a space
      let cut = s.lastIndexOf(' ', max)
      if (cut < max * 0.5) cut = max
      if (cur) push()
      pieces.push(s.slice(0, cut).trim()); s = s.slice(cut)
    }
    if (cur.length + s.length > max) push()
    cur += s
  }
  push()
  return pieces.filter(Boolean)
}

// ── Piper (self-hosted) ──────────────────────────────────────────────────────
async function piperPiece(text, timeoutMs) {
  const base = process.env.PIPER_API_URL.trim().replace(/\/+$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/api/tts`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-api-key': process.env.PIPER_API_KEY.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, format: 'mp3' }),
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json()).detail } catch { /* not JSON */ }
      throw new Error(`Piper error ${res.status}${detail ? ': ' + String(detail).slice(0, 100) : ''}`)
    }
    const type = (res.headers.get('content-type') || '').toLowerCase()
    if (type.includes('wav')) throw new Error('Piper sent WAV instead of MP3: update the Piper service’s main.py to the version with MP3 support')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('Piper returned empty audio')
    return buf
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Piper timed out after ${Math.round(timeoutMs / 1000)}s`)
    throw e
  } finally { clearTimeout(timer) }
}

// Runs fn over items with limited parallelism, keeps the ORIGINAL ORDER, stops early on the first failure.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0, failed = null
  async function worker() {
    while (!failed) {
      const i = next++
      if (i >= items.length) return
      try { results[i] = await fn(items[i], i) } catch (e) { failed = failed || e; return }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  if (failed) throw failed
  return results
}

async function piperAll(chunks, deadline, trace) {
  const pieces = chunks.flatMap(c => splitText(c, PIPER_PIECE_CHARS))
  // Leave time at the end for the fallback voices if Piper turns out not to work.
  const phaseEnd = Math.min(deadline - 12000, Date.now() + 38000)
  const parts = await mapLimit(pieces, PIPER_PARALLEL, async (piece, idx) => {
    const base = { provider: 'piper', piece: idx + 1, of: pieces.length }
    let last
    for (let attempt = 0; attempt < 2; attempt++) {     // the first call after a quiet spell can be slow: try twice
      const remaining = phaseEnd - Date.now()
      if (remaining < 3000) break
      const t0 = Date.now()
      try {
        const buf = await piperPiece(piece, Math.min(30000, remaining))
        note(trace, { ...base, attempt: attempt + 1, ok: true, ms: Date.now() - t0, bytes: buf.length })
        return buf
      } catch (e) {
        note(trace, { ...base, attempt: attempt + 1, ok: false, ms: Date.now() - t0, error: e.message })
        last = e; await sleep(400)
      }
    }
    if (!last) { last = new Error('Piper ran out of time'); note(trace, { ...base, attempt: 0, ok: false, ms: 0, error: last.message }) }
    throw last
  })
  return Buffer.concat(parts)
}

// ── Azure Speech ─────────────────────────────────────────────────────────────
async function azureChunk(text, timeoutMs) {
  const region = process.env.AZURE_SPEECH_REGION.trim()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY.trim(),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'ccgworld-podcast',
      },
      body: `<speak version='1.0' xml:lang='en-GB'><voice xml:lang='en-GB' name='${VOICE}'>${escapeXml(text)}</voice></speak>`,
    })
    if (!res.ok) throw new Error(`Azure Speech error ${res.status}${res.status === 401 ? ' (check AZURE_SPEECH_KEY and region)' : ''}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('Azure Speech returned empty audio')
    return buf
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Azure Speech timed out after ${Math.round(timeoutMs / 1000)}s`)
    throw e
  } finally { clearTimeout(timer) }
}

// ── Edge TTS ─────────────────────────────────────────────────────────────────
async function edgeChunk(text, timeoutMs) {
  const { UniversalEdgeTTS } = await import('edge-tts-universal')
  return withTimeout((async () => {
    const result = await new UniversalEdgeTTS(text, VOICE).synthesize()
    const buf = Buffer.from(await result.audio.arrayBuffer())
    if (buf.length < 100) throw new Error('Edge TTS returned empty audio')
    return buf
  })(), timeoutMs, `Edge TTS timed out after ${Math.round(timeoutMs / 1000)}s`)
}

// chunks: array of strings. Returns one MP3 Buffer. Optional { trace: { events: [], provider: null } }
// is filled in with every attempt and the voice that produced the final audio.
export async function synthesizeAll(chunks, { budgetMs = 52000, trace } = {}) {
  const deadline = Date.now() + budgetMs
  const problems = new Set()

  if (piperConfigured()) {
    try {
      const out = await piperAll(chunks, deadline, trace)
      if (trace) trace.provider = 'piper'
      return out
    } catch (e) { problems.add(e.message) }
  }

  const plan = azureConfigured()
    ? [['Azure', azureChunk, 20000], ['Azure', azureChunk, 20000], ['Edge TTS', edgeChunk, 15000], ['Edge TTS', edgeChunk, 15000]]
    : [['Edge TTS', edgeChunk, 15000], ['Edge TTS', edgeChunk, 15000], ['Edge TTS', edgeChunk, 15000]]
  const parts = []
  const used = []

  for (let i = 0; i < chunks.length; i++) {
    let audio = null
    const tries = {}
    for (const [name, fn, perTry] of plan) {
      const remaining = deadline - Date.now()
      if (remaining < 4000) break
      const id = name === 'Azure' ? 'azure' : 'edge'
      tries[id] = (tries[id] || 0) + 1
      const base = { provider: id, piece: i + 1, of: chunks.length, attempt: tries[id] }
      const t0 = Date.now()
      try {
        audio = await fn(chunks[i], Math.min(perTry, remaining - 1000))
        note(trace, { ...base, ok: true, ms: Date.now() - t0, bytes: audio.length })
        if (!used.includes(id)) used.push(id)
        break
      } catch (e) {
        problems.add(e.message)
        note(trace, { ...base, ok: false, ms: Date.now() - t0, error: e.message })
        await sleep(300)
      }
    }
    if (!audio) {
      if (trace) trace.provider = null
      const hint = (piperConfigured() || azureConfigured()) ? '' : ' · Tip: set up Piper (PIPER_API_URL and PIPER_API_KEY) or an Azure Speech key for reliable audio.'
      throw new Error(`Couldn’t generate audio for part ${i + 1} of ${chunks.length}. ${[...problems].join(' · ')}${hint}`)
    }
    parts.push(audio)
  }
  if (trace) trace.provider = used.join('+') || null
  return Buffer.concat(parts)
}
