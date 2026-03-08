import { useState } from 'react'
import supabase from '../lib/supabase'

/**
 * NewsletterSignup
 * Collects email + optional WhatsApp number.
 * Saves to `newsletter_subscribers` Supabase table.
 *
 * Props:
 *   dark  — use on dark/gradient backgrounds (default true)
 *   title — override heading text
 */
export default function NewsletterSignup({ dark = true, title = 'Get Daily Devotionals in Your Inbox' }) {
  const [step, setStep]       = useState('form')   // 'form' | 'success' | 'error'
  const [loading, setLoading] = useState(false)
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [wantWA, setWantWA]   = useState(false)
  const [errMsg, setErrMsg]   = useState('')

  const textColor   = dark ? 'white'                  : 'var(--brand-deep)'
  const subColor    = dark ? 'rgba(255,255,255,0.75)'  : 'var(--text-mid)'
  const inputBg     = dark ? 'rgba(255,255,255,0.12)'  : 'white'
  const inputBorder = dark ? 'rgba(255,255,255,0.25)'  : '#e2e8f0'
  const inputColor  = dark ? 'white'                  : 'var(--text-dark)'

  const handleSubmit = async () => {
    setErrMsg('')
    const trimEmail = email.trim()
    const trimPhone = phone.trim().replace(/\s+/g, '')

    if (!trimEmail || !trimEmail.includes('@')) {
      setErrMsg('Please enter a valid email address.'); return
    }
    if (wantWA && !trimPhone) {
      setErrMsg('Please enter your WhatsApp number or uncheck WhatsApp delivery.'); return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({
          email: trimEmail.toLowerCase(),
          whatsapp: wantWA ? trimPhone : null,
          wants_email: true,
          wants_whatsapp: wantWA,
          subscribed_at: new Date().toISOString(),
          active: true,
        }, { onConflict: 'email' })

      if (error) throw error
      setStep('success')
    } catch (e) {
      if (e.code === '23505' || e.message?.includes('duplicate')) {
        // Already subscribed — treat as success
        setStep('success')
      } else {
        setErrMsg('Something went wrong. Please try again.')
        console.error(e)
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎉</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: textColor, fontSize: '1.2rem', marginBottom: 8 }}>
        You're subscribed!
      </div>
      <p style={{ color: subColor, fontSize: '0.88rem', lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
        {wantWA
          ? "You'll receive devotionals by email and a WhatsApp message when new content is posted."
          : "You'll receive daily devotionals straight to your inbox."}
      </p>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: '2rem', marginBottom: 10 }}>📬</div>
      <h3 style={{ fontFamily: 'var(--font-display)', color: textColor, fontSize: '1.6rem', marginBottom: 10 }}>
        {title}
      </h3>
      <p style={{ color: subColor, marginBottom: 24, maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.7, fontSize: '0.92rem' }}>
        Start every morning in the Word. Subscribe for free daily devotionals and church updates.
      </p>

      <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Email field */}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="✉️  Your email address"
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 40,
            border: `1.5px solid ${inputBorder}`,
            background: inputBg, color: inputColor,
            fontSize: '0.92rem', outline: 'none',
            fontFamily: 'var(--font-body)', boxSizing: 'border-box',
          }}
        />

        {/* WhatsApp toggle */}
        <button
          onClick={() => setWantWA(w => !w)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 18px', borderRadius: 40,
            border: `1.5px solid ${wantWA ? '#25D366' : inputBorder}`,
            background: wantWA ? 'rgba(37,211,102,0.12)' : inputBg,
            color: wantWA ? '#25D366' : subColor,
            fontSize: '0.85rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'all 0.2s', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>💬</span>
          <span style={{ flex: 1 }}>
            {wantWA ? 'WhatsApp delivery enabled ✓' : 'Also receive updates on WhatsApp (optional)'}
          </span>
        </button>

        {/* WhatsApp number field */}
        {wantWA && (
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="📱  WhatsApp number (e.g. +2348012345678)"
            style={{
              width: '100%', padding: '13px 18px', borderRadius: 40,
              border: `1.5px solid #25D366`,
              background: 'rgba(37,211,102,0.08)',
              color: inputColor,
              fontSize: '0.92rem', outline: 'none',
              fontFamily: 'var(--font-body)', boxSizing: 'border-box',
            }}
          />
        )}

        {/* Error */}
        {errMsg && (
          <div style={{ color: '#fca5a5', fontSize: '0.82rem', textAlign: 'center', padding: '4px 0' }}>
            ⚠️ {errMsg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '13px 32px', borderRadius: 40,
            background: 'var(--gold)', color: 'var(--brand-deep)',
            fontWeight: 800, fontSize: '0.92rem',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? '⏳ Subscribing...' : '🙏 Subscribe Now →'}
        </button>

        <p style={{ color: subColor, fontSize: '0.72rem', margin: '4px 0 0', opacity: 0.7 }}>
          No spam. Unsubscribe anytime. Your details are kept private.
        </p>
      </div>
    </div>
  )
}
