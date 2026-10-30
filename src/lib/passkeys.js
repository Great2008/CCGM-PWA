// src/lib/passkeys.js
// Helpers for Supabase passkeys (beta). Needs @supabase/supabase-js 2.105.0+ and the
// `experimental: { passkey: true }` flag in src/lib/supabase.js.
import supabase from './supabase'

// True only when BOTH the browser and the installed library can do passkeys, so the buttons
// simply don't appear on unsupported setups (instead of crashing).
export function passkeysSupported() {
  return typeof window !== 'undefined'
    && !!window.PublicKeyCredential
    && typeof supabase.auth?.signInWithPasskey === 'function'
    && typeof supabase.auth?.registerPasskey === 'function'
}

export function passkeyErrorMessage(error) {
  const code = error?.code || ''
  const msg  = (error?.message || '').toLowerCase()
  if (error?.name === 'NotAllowedError' || msg.includes('cancel') || msg.includes('not allowed') || msg.includes('timed out'))
    return 'The passkey prompt was cancelled or timed out. Please try again.'
  if (code === 'passkey_disabled') return 'Passkeys aren’t switched on for this site yet.'
  if (code === 'webauthn_credential_not_found')
    return 'No matching passkey was found. Sign in with your password, then add a passkey from your Profile.'
  if (code === 'too_many_passkeys') return 'You’ve reached the maximum number of passkeys. Remove one and try again.'
  if (code === 'webauthn_credential_exists') return 'This device is already saved as a passkey on your account.'
  if (code === 'email_not_confirmed') return 'Please confirm your email address first.'
  if (code === 'user_banned') return 'This account can’t sign in right now. Please contact us.'
  return error?.message || 'Something went wrong with the passkey. Please try again.'
}
