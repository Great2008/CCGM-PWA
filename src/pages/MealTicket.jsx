import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import SEO from '../components/SEO'

function qrDataUrl(text, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=10`
}

export default function MealTicket() {
  const [params] = useSearchParams()
  const eventId = params.get('event')
  const { user, isApproved } = useAuth()
  const [status, setStatus]   = useState('loading') // loading | ready | not-registered | error
  const [event, setEvent]     = useState(null)
  const [regId, setRegId]     = useState(null)

  useEffect(() => {
    if (!user || !eventId) { setStatus('error'); return }
    (async () => {
      const { data: ev } = await supabase.from('events').select('id,title,date,time,location').eq('id', eventId).single()
      const { data: reg } = await supabase.from('event_registrations').select('id').eq('event_id', eventId).eq('user_id', user.id).single()
      if (!ev) { setStatus('error'); return }
      setEvent(ev)
      if (!reg) { setStatus('not-registered'); return }
      setRegId(reg.id)
      setStatus('ready')
    })()
  }, [user, eventId])

  if (!user || !isApproved) {
    return (
      <div className="container" style={{ padding: '120px 5% 80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-mid)' }}>Sign in to view your meal ticket.</p>
        <Link to="/timeline" className="btn btn-primary" style={{ marginTop: 16 }}>Sign In</Link>
      </div>
    )
  }

  return (
    <>
      <SEO title="Meal Ticket" description="Your digital meal ticket." path="/meal-ticket" />
      <div className="container" style={{ maxWidth: 480, padding: '110px 5% 80px', textAlign: 'center' }}>

        {status === 'loading' && <p style={{ color: 'var(--text-light)' }}>Loading your ticket...</p>}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <p style={{ color: 'var(--text-mid)' }}>Couldn't load this ticket. Make sure you followed a valid link.</p>
          </div>
        )}

        {status === 'not-registered' && (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <p style={{ color: 'var(--text-mid)', marginBottom: 16 }}>You haven't RSVP'd to <strong>{event?.title}</strong> yet.</p>
            <Link to="/events" className="btn btn-primary">Go to Events</Link>
          </div>
        )}

        {status === 'ready' && (
          <div style={{ background: 'white', borderRadius: 20, padding: '32px 24px', boxShadow: 'var(--shadow-md, 0 10px 30px rgba(0,0,0,0.08))', border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <picture><source srcSet="/logo-sm.webp" type="image/webp" /><img src="/logo.webp" alt="CCG World" width={44} height={44} /></picture>
            </div>
            <div className="section-label" style={{ marginBottom: 6 }}>Meal Ticket</div>
            <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.4rem', marginBottom: 4 }}>{event.title}</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 22 }}>
              📅 {event.date}{event.time && ` · ${event.time}`}{event.location && ` · 📍 ${event.location}`}
            </div>

            <img src={qrDataUrl(`MEAL-${regId}`)} alt="Meal ticket QR code" style={{ width: 220, height: 220, borderRadius: 12, border: '1.5px solid #f1f5f9' }} />

            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 18, lineHeight: 1.6 }}>
              Present this code at breakfast and dinner during the conference. One scan per meal, per day.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
