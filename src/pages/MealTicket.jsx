import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import SEO from '../components/SEO'

function qrDataUrl(text, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a2612&margin=10`
}

// Computes the labeled conference days (Day 1, Day 2, ...) from an event's
// date → end_date range. Falls back to a single day if there's no end_date.
function getConferenceDays(ev) {
  if (!ev?.date) return []
  const start = new Date(ev.date + 'T00:00:00')
  const end = ev.end_date ? new Date(ev.end_date + 'T00:00:00') : start
  if (isNaN(start) || isNaN(end) || end < start) return [{ day: 1, date: ev.date }]
  const days = []
  const d = new Date(start)
  let i = 1
  while (d <= end) {
    days.push({ day: i, date: d.toISOString().slice(0, 10) })
    d.setDate(d.getDate() + 1)
    i++
  }
  return days
}

export default function MealTicket() {
  const [params] = useSearchParams()
  const eventId = params.get('event')
  const { user, isApproved } = useAuth()
  const [status, setStatus]   = useState('loading') // loading | ready | not-registered | error | disabled
  const [event, setEvent]     = useState(null)
  const [regId, setRegId]     = useState(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(true)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!user || !eventId) { setStatus('error'); return }
    (async () => {
      const { data: ev } = await supabase.from('events').select('id,title,date,end_date,time,location,requires_payment,meal_tickets_enabled').eq('id', eventId).single()
      const { data: reg } = await supabase.from('event_registrations').select('id,payment_confirmed').eq('event_id', eventId).eq('user_id', user.id).single()
      if (!ev) { setStatus('error'); return }
      setEvent(ev)
      if (!ev.meal_tickets_enabled) { setStatus('disabled'); return }
      if (!reg) { setStatus('not-registered'); return }
      setRegId(reg.id)
      setPaymentConfirmed(!ev.requires_payment || reg.payment_confirmed)
      setStatus('ready')

      const { data: checkins } = await supabase.from('meal_checkins').select('meal_date,slot,checked_in_at').eq('registration_id', reg.id).order('meal_date', { ascending: true }).order('slot', { ascending: true })
      setHistory(checkins || [])
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

        {status === 'disabled' && (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🍽️</div>
            <p style={{ color: 'var(--text-mid)', marginBottom: 16 }}><strong>{event?.title}</strong> doesn't use meal tickets.</p>
            <Link to="/events" className="btn btn-primary">Back to Events</Link>
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

            {paymentConfirmed ? (
              <img src={qrDataUrl(`MEAL-${regId}`)} alt="Meal ticket QR code" style={{ width: 220, height: 220, borderRadius: 12, border: '1.5px solid #f1f5f9' }} />
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={qrDataUrl(`MEAL-${regId}`)} alt="Meal ticket QR code" style={{ width: 220, height: 220, borderRadius: 12, border: '1.5px solid #fde68a' }} />
                <div style={{ marginTop: 10, background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <span>⏳</span>
                  <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>Payment pending — show this to staff to confirm</span>
                </div>
              </div>
            )}

            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 18, lineHeight: 1.6 }}>
              {paymentConfirmed
                ? 'Present this code at breakfast and dinner during the conference. One scan per meal, per day.'
                : 'Present this code at the registration desk to confirm your payment. Meals can\'t be marked until payment is confirmed.'}
            </p>

            {(() => {
              const days = getConferenceDays(event)
              const map = {}
              history.forEach(h => { map[h.meal_date] = { ...map[h.meal_date], [h.slot]: h.checked_in_at } })
              return (
                <div style={{ marginTop: 26, textAlign: 'left', borderTop: '1.5px solid #f1f5f9', paddingTop: 18 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-deep)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Meal History</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {days.map(({ day, date }) => (
                      <div key={date}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 700, marginBottom: 4 }}>Day {day} · {date}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['breakfast', 'dinner'].map(slot => {
                            const ts = map[date]?.[slot]
                            return (
                              <div key={slot} style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '7px 10px', borderRadius: 8, background: ts ? '#f0fdf4' : '#f8fafc', color: ts ? '#16a34a' : 'var(--text-light)' }}>
                                <span>{slot === 'breakfast' ? '🌅' : '🌙'} {slot === 'breakfast' ? 'Breakfast' : 'Dinner'}</span>
                                <span>{ts ? `✅ ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </>
  )
}
