// src/components/PasskeyManager.jsx
// Profile page card: add, rename and remove passkeys.
import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'
import { passkeysSupported, passkeyErrorMessage } from '../lib/passkeys'

const card = { background:'var(--white, white)', borderRadius:18, padding:'clamp(20px,4vw,32px)', boxShadow:'var(--shadow-sm)', border:'1px solid rgba(15,31,61,0.06)' }
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : null
const smallBtn = { padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontSize:'0.76rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }

export default function PasskeyManager() {
  const supported = passkeysSupported()
  const [list, setList]   = useState(null)
  const [busy, setBusy]   = useState(false)
  const [msg, setMsg]     = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.passkey.list()
    if (error) { setMsg(passkeyErrorMessage(error)); setList([]); return }
    setList((data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  }, [])

  useEffect(() => { if (supported) load() }, [supported, load])

  const add = async () => {
    setMsg(''); setBusy(true)
    const { error } = await supabase.auth.registerPasskey()
    setBusy(false)
    if (error) { setMsg(passkeyErrorMessage(error)); return }
    setMsg('✅ Passkey added. You can now sign in with it.')
    load()
  }

  const rename = async (p) => {
    const name = window.prompt('Name this passkey (for example, “My phone”)', p.friendly_name || '')
    if (name === null || !name.trim()) return
    const { error } = await supabase.auth.passkey.update({ passkeyId: p.id, friendlyName: name.trim().slice(0, 120) })
    if (error) setMsg(passkeyErrorMessage(error)); else load()
  }

  const remove = async (p) => {
    if (!window.confirm(`Remove “${p.friendly_name || 'this passkey'}”? You won’t be able to sign in with it any more.`)) return
    const { error } = await supabase.auth.passkey.delete({ passkeyId: p.id })
    if (error) setMsg(passkeyErrorMessage(error)); else { setMsg('Passkey removed.'); load() }
  }

  return (
    <div style={card}>
      <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.15rem', marginBottom:12, paddingBottom:12, borderBottom:'1px solid var(--brand-pale)' }}>🔑 Passkeys</h2>
      <p style={{ margin:'0 0 16px', fontSize:'0.86rem', color:'var(--text-mid)', lineHeight:1.65 }}>
        Sign in with your fingerprint, face or phone PIN instead of typing a password. Your password keeps working too, so you can always sign in either way.
      </p>

      {!supported ? (
        <p style={{ margin:0, fontSize:'0.84rem', color:'var(--text-light)', lineHeight:1.6 }}>
          Passkeys aren’t available in this browser. Try the latest Chrome, Safari or Edge on a device with a screen lock set up.
        </p>
      ) : (<>
        {list === null && <p style={{ color:'var(--text-light)', fontSize:'0.85rem' }}>⏳ Loading…</p>}
        {list && list.length > 0 && (
          <div style={{ display:'grid', gap:10, marginBottom:16 }}>
            {list.map(p => (
              <div key={p.id} style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', padding:'12px 14px', border:'1px solid #e2e8f0', borderRadius:12 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-dark)' }}>🔑 {p.friendly_name || 'Passkey'}</div>
                  <div style={{ fontSize:'0.76rem', color:'var(--text-light)', marginTop:2 }}>
                    Added {fmt(p.created_at)}{p.last_used_at ? ` · last used ${fmt(p.last_used_at)}` : ' · not used yet'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => rename(p)} style={smallBtn}>Rename</button>
                  <button onClick={() => remove(p)} style={{ ...smallBtn, color:'#dc2626', borderColor:'#fecaca' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {list && list.length === 0 && <p style={{ margin:'0 0 16px', fontSize:'0.84rem', color:'var(--text-light)' }}>You haven’t added a passkey yet.</p>}
        <button onClick={add} disabled={busy} style={{ padding:'10px 24px', borderRadius:40, border:'none', background: busy ? '#9ca3af' : 'var(--brand-mid)', color:'white', fontWeight:700, fontSize:'0.86rem', fontFamily:'var(--font-body)', cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Waiting for your device…' : '➕ Add a passkey on this device'}
        </button>
        {msg && (
          <div style={{ marginTop:14, padding:'10px 16px', borderRadius:10, background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border:`1px solid ${msg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, color: msg.startsWith('✅') ? '#166534' : '#dc2626', fontSize:'0.84rem', lineHeight:1.5 }}>{msg}</div>
        )}
      </>)}
    </div>
  )
}
