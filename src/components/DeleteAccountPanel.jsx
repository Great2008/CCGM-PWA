// src/components/DeleteAccountPanel.jsx
// "Delete My Account" for the Profile page's Danger Zone. The real deletion happens on the
// server (/api/delete-account): it re-checks the password, removes the member's data and files,
// and deletes the sign-in account so the email can be registered again.
import { useState } from 'react'
import { invokeApi } from '../lib/api'
import { PasswordInput } from './PasswordField'

const field = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #fca5a5', fontSize:'0.9rem', fontFamily:'var(--font-body)', outline:'none', color:'var(--text-dark)', boxSizing:'border-box', background:'white' }
const lbl = { fontSize:'0.72rem', fontWeight:700, color:'#7f1d1d', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:5 }

export default function DeleteAccountPanel({ onDeleted }) {
  const [open, setOpen]       = useState(false)
  const [password, setPassword] = useState('')
  const [typed, setTyped]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  const close = () => { setOpen(false); setPassword(''); setTyped(''); setErr('') }
  const ready = !!password && typed === 'DELETE' && !busy

  const submit = async () => {
    setErr(''); setBusy(true)
    const { error } = await invokeApi('delete-account', { body: { password, confirm: typed } })
    if (error) { setBusy(false); setErr(error.message || 'Something went wrong. Please try again.'); return }
    await onDeleted()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ padding:'10px 24px', borderRadius:40, border:'1.5px solid #fca5a5', background:'transparent', color:'#dc2626', fontWeight:700, fontSize:'0.84rem', fontFamily:'var(--font-body)', cursor:'pointer' }}>
      Delete My Account
    </button>
  )

  return (
    <div style={{ display:'grid', gap:14, maxWidth:420 }}>
      <div style={{ fontSize:'0.84rem', color:'#7f1d1d', lineHeight:1.65 }}>
        This <strong>permanently deletes</strong> your profile, posts, comments, prayers, event registrations and other activity.
        It can’t be undone. Your email address will be freed up so you can register again later if you wish.
      </div>
      <div>
        <label style={lbl}>Your password</label>
        <PasswordInput style={field} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
      </div>
      <div>
        <label style={lbl}>Type DELETE to confirm</label>
        <input style={field} value={typed} onChange={e => setTyped(e.target.value)} placeholder="DELETE" autoCapitalize="characters" autoCorrect="off" />
      </div>
      {err && <div style={{ background:'#fff', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.84rem', lineHeight:1.5 }}>❌ {err}</div>}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <button onClick={submit} disabled={!ready} style={{ padding:'10px 22px', borderRadius:40, border:'none', background: ready ? '#dc2626' : '#fca5a5', color:'white', fontWeight:700, fontSize:'0.84rem', fontFamily:'var(--font-body)', cursor: ready ? 'pointer' : 'not-allowed' }}>
          {busy ? '⏳ Deleting…' : 'Permanently delete my account'}
        </button>
        <button onClick={close} disabled={busy} style={{ padding:'10px 22px', borderRadius:40, border:'1.5px solid #e2e8f0', background:'transparent', color:'var(--text-mid)', fontWeight:600, fontSize:'0.84rem', fontFamily:'var(--font-body)', cursor:'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}
