// src/lib/passwordRules.js
// One source of truth for password rules, used by sign-up, reset and change-password.
// The "special" set matches what Supabase Auth counts as a symbol, so a password that
// passes here also passes the server-side password policy (Authentication settings).
export const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~\\"

export const PASSWORD_RULES = [
  { id: 'length',  label: 'At least 8 characters',          test: p => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A-Z)',     test: p => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a-z)',     test: p => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number (0-9)',               test: p => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (! @ # $ …)', test: p => [...p].some(c => SPECIAL_CHARS.includes(c)) },
]

export function checkPassword(pw = '') {
  const results = PASSWORD_RULES.map(r => ({ id: r.id, label: r.label, ok: r.test(pw) }))
  return { results, allMet: results.every(r => r.ok) }
}

// Returns '' when OK, otherwise a short message to show the member.
export function validatePassword(pw = '') {
  return checkPassword(pw).allMet ? '' : 'Please choose a password that meets all the requirements listed below.'
}

const COMMON = ['password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'abc123', '123456', 'jesus', 'godisgood', 'church', 'ccgworld', 'ccgm']

// Advisory strength meter (the rules above are what's enforced).
export function passwordStrength(pw = '') {
  if (!pw) return { level: 0, label: '', color: '#e2e8f0' }
  let score = PASSWORD_RULES.filter(r => r.test(pw)).length          // 0-5
  if (pw.length >= 12) score += 1
  if (pw.length >= 16) score += 1
  if (/(.)\1{2,}/.test(pw)) score -= 1                                // aaa, 111
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf|zxcv)/i.test(pw)) score -= 1
  const lower = pw.toLowerCase()
  if (COMMON.some(c => lower.includes(c))) score -= 2
  score = Math.max(0, Math.min(6, score))
  if (score <= 2) return { level: 1, label: 'Weak',   color: '#dc2626' }
  if (score === 3) return { level: 2, label: 'Fair',   color: '#f59e0b' }
  if (score === 4) return { level: 3, label: 'Good',   color: '#84cc16' }
  // "Strong" needs real length too: a short password that merely ticks every box tops out at "Good".
  if (pw.length < 12) return { level: 3, label: 'Good', color: '#84cc16' }
  return                 { level: 4, label: 'Strong', color: '#16a34a' }
}
