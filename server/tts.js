// server/tts.js — text-to-speech for the daily podcast.
//
// Provider order for every chunk of the script:
//   1. Piper (self-hosted, MP3)             - used when PIPER_API_URL + PIPER_API_KEY are set
//   2. Azure AI Speech (official, stable)   - used when AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set
//   3. Edge TTS (free, unofficial)          - fallback. Microsoft's Read Aloud endpoint is known to time out
//                                             or hang at times, so it is never relied on alone.
// Azure/Edge use en-GB-ThomasNeural; Piper uses whatever voice the Piper server has loaded. Everything runs inside a time budget so the caller always
// gets a clear error message instead of a bare Vercel timeout.
const VOICE = 'en-GB-ThomasNeural'

const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const sleep = ms => new Promise(r => setTimeout(r, ms))

export const azureConfigured = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION)

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export const piperConfigured = () => !!(process.env.PIPER_API_URL && process.env.PIPER_API_KEY)

async function piperChunk(text, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${process.env.PIPER_API_URL.trim().replace(/\/+$/, '')}/api/tts`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': process.env.PIPER_API_KEY.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, format: 'mp3' }),
    })
    if (!res.ok) throw new Error(`Piper error ${res.status}${res.status === 401 ? ' (check PIPER_API_KEY)' : ''}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100) throw new Error('Piper returned empty audio')
    return buf
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Piper timed out after ${Math.round(timeoutMs / 1000)}s`)
    throw e
  } finally { clearTimeout(timer) }
}

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

async function edgeChunk(text, timeoutMs) {
  const { UniversalEdgeTTS } = await import('edge-tts-universal')
  return withTimeout((async () => {
    const result = await new UniversalEdgeTTS(text, VOICE).synthesize()
    const buf = Buffer.from(await result.audio.arrayBuffer())
    if (buf.length < 100) throw new Error('Edge TTS returned empty audio')
    return buf
  })(), timeoutMs, `Edge TTS timed out after ${Math.round(timeoutMs / 1000)}s`)
}

// chunks: array of strings (each already small enough for one request). Returns one MP3 Buffer.
export async function synthesizeAll(chunks, { budgetMs = 52000 } = {}) {
  const deadline = Date.now() + budgetMs
  const plan = [
    ...(piperConfigured() ? [['Piper', piperChunk, 25000]] : []),
    ...(azureConfigured() ? [['Azure', azureChunk, 20000], ['Azure', azureChunk, 20000]] : []),
    ['Edge TTS', edgeChunk, 15000],
    ['Edge TTS', edgeChunk, 15000],
  ]
  const parts = []
  const problems = new Set()

  for (let i = 0; i < chunks.length; i++) {
    let audio = null
    for (const [name, fn, perTry] of plan) {
      const remaining = deadline - Date.now()
      if (remaining < 4000) break
      try { audio = await fn(chunks[i], Math.min(perTry, remaining - 1000)); break }
      catch (e) { problems.add(e.message); await sleep(300) }
    }
    if (!audio) {
      throw new Error(`Couldn’t generate audio for part ${i + 1} of ${chunks.length}. ${[...problems].join(' · ')}` +
        (azureConfigured() ? '' : ' · Tip: add an Azure Speech key (AZURE_SPEECH_KEY and AZURE_SPEECH_REGION) for reliable audio.'))
    }
    parts.push(audio)
  }
  return Buffer.concat(parts)
}
