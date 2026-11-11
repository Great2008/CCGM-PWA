// src/admin/components/PodcastGenerationLog.jsx
// Admin > Daily Podcast > "Generation Log": every attempt to turn an episode into audio, from the Generate
// button, the nightly GitHub job and the cron endpoint. Same look as the email Delivery Logs.
import { useState, useEffect, useCallback } from 'react'
import supabaseAdmin from '../../lib/supabase'
import AdminCard from './AdminCard'

const SOURCE_LABEL = { 'admin-page': 'Admin page', 'nightly-job': 'Nightly job', 'github-manual': 'GitHub (manual run)', 'cron-endpoint': 'Cron' }
const PROVIDER_LABEL = { piper: 'Piper', azure: 'Azure', edge: 'Edge TTS', 'azure+edge': 'Azure + Edge TTS' }
const STUCK_AFTER_MS = 2 * 60 * 1000          // a "running" row older than this never got to write its result

const COLORS = {
  success:    { border: '#bbf7d0', bg: '#f0fdf4', text: '#16a34a' },
  failed:     { border: '#fecaca', bg: '#fef2f2', text: '#dc2626' },
  unfinished: { border: '#fde68a', bg: '#fffbeb', text: '#b45309' },
  running:    { border: '#bfdbfe', bg: '#eff6ff', text: '#1d4ed8' },
}

// running / success / failed / unfinished (= "running" for too long: the server was cut off)
function statusOf(l) {
  if (l.status !== 'running') return l.status
  return Date.now() - new Date(l.created_at).getTime() > STUCK_AFTER_MS ? 'unfinished' : 'running'
}

const secs = (ms) => (ms == null ? '' : `${(ms / 1000).toFixed(1)}s`)
const mb = (b) => (b == null ? '' : `${(b / 1048576).toFixed(1)} MB`)
const attemptsOf = (l) => (Array.isArray(l.attempts) ? l.attempts : [])
const piperFailed = (l) => attemptsOf(l).some(a => a.provider === 'piper' && a.ok === false)
const fellBack = (l) => !!l.provider && l.provider !== 'piper' && piperFailed(l)

function attemptLine(a) {
  const who = PROVIDER_LABEL[a.provider] || a.provider
  const where = a.of > 1 ? ` · part ${a.piece}/${a.of}` : ''
  const tryNo = a.attempt > 0 ? ` · try ${a.attempt}` : ''
  return `${who}${where}${tryNo} · ${a.ok ? '✅' : '❌'} ${secs(a.ms)}${a.error ? ` · ${a.error}` : ''}`
}

function reportText(l) {
  const st = statusOf(l)
  return [
    `Episode: ${l.episode_title || l.episode_id || 'unknown'}`,
    `When: ${new Date(l.created_at).toLocaleString()}`,
    `Source: ${SOURCE_LABEL[l.source] || l.source}${l.triggered_by ? ` (${l.triggered_by})` : ''}`,
    `Result: ${st}${l.stage ? ` at the "${l.stage}" stage` : ''}`,
    l.provider ? `Voice used: ${PROVIDER_LABEL[l.provider] || l.provider}` : '',
    l.error_message ? `Error: ${l.error_message}` : '',
    l.duration_ms != null ? `Total time: ${secs(l.duration_ms)}` : '',
    l.chars != null ? `Script: ${l.chars} characters in ${l.parts ?? '?'} parts` : '',
    attemptsOf(l).length ? 'Attempts:' : '',
    ...attemptsOf(l).map(a => `  - ${attemptLine(a)}`),
  ].filter(Boolean).join('\n')
}

export default function PodcastGenerationLog({ refreshKey = 0 }) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [open, setOpen]       = useState({})
  const [copied, setCopied]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseAdmin.from('podcast_generation_logs')
      .select('*').order('created_at', { ascending: false }).limit(200)
    if (error) {
      const missing = /does not exist|schema cache|relation/i.test(error.message || '')
      setLoadError(missing ? 'The log table has not been created yet. Run podcast_generation_logs.sql in the Supabase SQL Editor.' : 'Could not load the log: ' + error.message)
      setLogs([])
    } else { setLoadError(''); setLogs(data || []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  // While something is running, check again every 8 seconds
  const anyRunning = logs.some(l => statusOf(l) === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [anyRunning, load])

  const shown = logs.filter(l => {
    const st = statusOf(l)
    if (filter === 'failed' && st !== 'failed') return false
    if (filter === 'success' && st !== 'success') return false
    if (filter === 'unfinished' && st !== 'unfinished' && st !== 'running') return false
    if (search && !`${l.episode_title} ${l.provider} ${l.error_message} ${l.triggered_by} ${l.source}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // quick health summary of the 20 most recent attempts
  const recent = logs.slice(0, 20)
  const okN = recent.filter(l => statusOf(l) === 'success').length
  const badN = recent.filter(l => statusOf(l) === 'failed').length
  const lostN = recent.filter(l => statusOf(l) === 'unfinished').length
  const times = recent.filter(l => l.status === 'success' && l.duration_ms).map(l => l.duration_ms)
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
  const piperN = recent.filter(l => l.status === 'success' && l.provider === 'piper').length
  const backN = recent.filter(l => l.status === 'success' && fellBack(l)).length

  const copy = async (l) => {
    try { await navigator.clipboard.writeText(reportText(l)); setCopied(l.id); setTimeout(() => setCopied(null), 2000) } catch { /* ignore */ }
  }

  return (
    <AdminCard>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search episode, voice, or error..."
          style={{ flex: '1 1 220px', padding: '9px 14px', borderRadius: 30, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'All'], ['failed', '❌ Failed'], ['success', '✅ Succeeded'], ['unfinished', '⏳ Not finished']].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: '7px 14px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700,
              borderColor: filter === id ? 'var(--brand-mid)' : '#e2e8f0',
              background: filter === id ? 'var(--brand-mid)' : 'white',
              color: filter === id ? 'white' : 'var(--text-mid)',
            }}>{label}</button>
          ))}
          <button onClick={load} style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-mid)' }}>↻ Refresh</button>
        </div>
      </div>

      {recent.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-mid)', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, lineHeight: 1.7 }}>
          <strong>Last {recent.length}:</strong> ✅ {okN} succeeded · ❌ {badN} failed{lostN ? ` · ⏳ ${lostN} never finished` : ''}
          {avg ? ` · average ${secs(avg)}` : ''}
          {(piperN || backN) ? ` · Piper made ${piperN}, fell back to another voice ${backN}` : ''}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>Loading...</div>
      ) : loadError ? (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.86rem', lineHeight: 1.6 }}>{loadError}</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
          {logs.length === 0 ? 'No podcast generations logged yet.' : 'No logs match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(l => {
            const st = statusOf(l); const c = COLORS[st]; const isOpen = !!open[l.id]; const list = attemptsOf(l)
            return (
              <div key={l.id} style={{ padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.bg, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>{l.episode_title || 'Episode'}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-mid)' }}>
                  <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: 4, fontSize: '0.72rem' }}>{SOURCE_LABEL[l.source] || l.source}</code>
                  {l.triggered_by && l.triggered_by !== 'cron' && <span>{l.triggered_by}</span>}
                  {l.provider && <span style={{ fontWeight: 700 }}>🎙 {PROVIDER_LABEL[l.provider] || l.provider}</span>}
                  {fellBack(l) && <span style={{ color: '#b45309', fontWeight: 700 }}>↩ Piper failed, another voice finished it</span>}
                </div>

                {(l.duration_ms != null || l.chars != null) && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {[l.duration_ms != null && `⏱ ${secs(l.duration_ms)}`, l.chars != null && `${l.chars.toLocaleString()} characters`, l.parts != null && `${l.parts} part${l.parts === 1 ? '' : 's'}`, l.audio_bytes != null && mb(l.audio_bytes), l.audio_seconds != null && `~${Math.max(1, Math.round(l.audio_seconds / 60))} min of audio`].filter(Boolean).join(' · ')}
                  </div>
                )}

                <div style={{ marginTop: 6, color: c.text, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.5 }}>
                  {st === 'success' && '✅ Audio created'}
                  {st === 'failed' && `❌ ${l.stage ? `Failed at “${l.stage}”: ` : ''}${l.error_message || 'Failed — no error message captured'}`}
                  {st === 'running' && '⏳ In progress…'}
                  {st === 'unfinished' && '⏳ Never finished: the server was probably cut off at its time limit (about 60 seconds) before it could record a result.'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {list.length > 0 && (
                    <button onClick={() => setOpen(o => ({ ...o, [l.id]: !o[l.id] }))}
                      style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-mid)' }}>
                      {isOpen ? 'Hide details ▴' : `Details (${list.length}) ▾`}
                    </button>
                  )}
                  <button onClick={() => copy(l)}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-mid)' }}>
                    {copied === l.id ? '✓ Copied' : '📋 Copy report'}
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.8)', borderRadius: 8, fontSize: '0.76rem', lineHeight: 1.7, color: 'var(--text-mid)' }}>
                    {list.map((a, i) => <div key={i} style={{ color: a.ok ? '#166534' : '#b91c1c' }}>{attemptLine(a)}</div>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminCard>
  )
}
