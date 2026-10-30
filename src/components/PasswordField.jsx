// src/components/PasswordField.jsx
// PasswordInput  - a password box with a show/hide eye button
// PasswordStrength - live rules checklist + strength meter
// MatchHint      - "passwords match" feedback for the confirm box
import { useState } from 'react'
import { checkPassword, passwordStrength } from '../lib/passwordRules'

function Eye({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (<>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>) : (<>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>)}
    </svg>
  )
}

// Drop-in replacement for <input type="password" ...>. Pass the same props
// (value, onChange, placeholder, required, onFocus, onBlur, style ...).
export function PasswordInput({ style, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input {...props} type={show ? 'text' : 'password'} style={{ ...style, paddingRight: 46 }} />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 8,
        }}
      ><Eye off={show} /></button>
    </div>
  )
}

export function PasswordStrength({ password = '' }) {
  const { results } = checkPassword(password)
  const s = passwordStrength(password)
  return (
    <div style={{ marginTop: 8 }}>
      {password && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= s.level ? s.color : '#e2e8f0', transition: 'background 0.2s' }} />
            ))}
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: s.color, minWidth: 48, textAlign: 'right' }}>{s.label}</span>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
        {results.map(r => (
          <li key={r.id} style={{ fontSize: '0.78rem', color: r.ok ? '#16a34a' : '#94a3b8', display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontWeight: 800, width: 14, textAlign: 'center' }}>{r.ok ? '✓' : '○'}</span>{r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MatchHint({ password, confirm }) {
  if (!confirm) return null
  const ok = password === confirm
  return (
    <div style={{ marginTop: 6, fontSize: '0.78rem', fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>
      {ok ? '✓ Passwords match' : '✕ Passwords don’t match yet'}
    </div>
  )
}
