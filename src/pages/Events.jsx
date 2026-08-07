import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useEventsContent } from '../hooks/useContent'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import SEO from '../components/SEO'
import { ShareButtonLight } from '../components/ShareButton'

export default function Events() {
  const { data: events, loading } = useEventsContent()
  const [filter, setFilter] = useState('All')
  const [rsvpd, setRsvpd] = useState({})
  const [rsvping, setRsvping] = useState({})
  const [rsvpError, setRsvpError] = useState({})
  const [lightbox, setLightbox] = useState(null) // { src, title } | null
  const { user, profile, isApproved } = useAuth()
  const [guestFormOpen, setGuestFormOpen] = useState({})   // event.id -> bool
  const [guestForm, setGuestForm] = useState({})           // event.id -> {name,email,phone}
  const [guestSubmitting, setGuestSubmitting] = useState({})
  const [guestDone, setGuestDone] = useState({})           // event.id -> bool
  const [guestError, setGuestError] = useState({})

  // Load the user's existing registrations so the button reflects real DB state
  // on page load / refresh, instead of always starting as "not RSVP'd".
  useEffect(() => {
    if (!user || !events.length) return
    let cancelled = false
    supabase.from('event_registrations').select('event_id').eq('user_id', user.id)
      .in('event_id', events.map(e => e.id))
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const map = {}
        data.forEach(r => { map[r.event_id] = true })
        setRsvpd(map)
      })
    return () => { cancelled = true }
  }, [user, events])

  // If someone opens a shared event link (#event-<id>), scroll to that card once loaded
  useEffect(() => {
    if (!events.length || !window.location.hash) return
    const el = document.querySelector(window.location.hash)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [events])

  // Fire-and-forget — a failed confirmation email should never block or
  // visibly break the RSVP flow itself.
  const sendRsvpConfirmation = ({ email, name, event, registrationId }) => {
    if (!email) return
    supabase.functions.invoke('send-rsvp-confirmation', {
      body: {
        email, name,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time || null,
        venue: event.location || null,
        registrationId,
        eventUrl: `${window.location.origin}/events#event-${event.id}`,
      },
    }).catch(err => console.warn('RSVP confirmation email failed to send:', err))
  }

  const submitGuestRsvp = async (event) => {
    const g = guestForm[event.id] || {}
    const name = (g.name || '').trim()
    const email = (g.email || '').trim()
    const phone = (g.phone || '').trim()
    if (!name) { setGuestError(e => ({ ...e, [event.id]: 'Name is required' })); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setGuestError(e => ({ ...e, [event.id]: 'Enter a valid email' })); return }
    setGuestError(e => ({ ...e, [event.id]: null }))
    setGuestSubmitting(s => ({ ...s, [event.id]: true }))
    const { data, error } = await supabase.from('event_registrations').insert({
      event_id: event.id, is_guest: true, guest_name: name, guest_email: email, guest_phone: phone || null,
    }).select('id').single()
    setGuestSubmitting(s => ({ ...s, [event.id]: false }))
    if (error) {
      // 23505 = unique violation — this email already RSVP'd for this event
      setGuestError(e => ({ ...e, [event.id]: error.code === '23505' ? "You're already registered with this email" : error.message }))
      return
    }
    setGuestDone(d => ({ ...d, [event.id]: true }))
    sendRsvpConfirmation({ email, name, event, registrationId: data.id })
  }

  const handleRsvp = async (event) => {
    if (!user || !isApproved) return
    setRsvping(r=>({...r,[event.id]:true}))
    setRsvpError(r=>({...r,[event.id]:null}))
    if (rsvpd[event.id]) {
      // Un-RSVP
      const { error } = await supabase.from('event_registrations').delete().eq('event_id',event.id).eq('user_id',user.id)
      if (!error) setRsvpd(r=>({...r,[event.id]:false}))
      else { console.error('Un-RSVP failed:', error); setRsvpError(r=>({...r,[event.id]:error.message})) }
    } else {
      const { data, error } = await supabase.from('event_registrations').insert({ event_id:event.id, user_id:user.id }).select('id').single()
      // 23505 = unique violation — a row already exists (state was just out of sync), treat as success
      if (!error || error.code === '23505') {
        setRsvpd(r=>({...r,[event.id]:true}))
        if (!error && data) {
          sendRsvpConfirmation({
            email: user.email,
            name: profile?.display_name || profile?.full_name || 'Member',
            event, registrationId: data.id,
          })
        }
      }
      else { console.error('RSVP failed:', error.message, error.code, error.details, error.hint); setRsvpError(r=>({...r,[event.id]:error.message})) }
    }
    setRsvping(r=>({...r,[event.id]:false}))
  }

  const categories = ['All', ...new Set(events.map(e => e.category).filter(Boolean))]
  const filtered = filter === 'All' ? events : events.filter(e => e.category === filter)

  return (
    <>
      <SEO
        title="Events"
        description="Upcoming events at CCG World — Christian Church Of God Mission. Programmes, services and special gatherings."
        path="/events"
      />
      <div style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--green-light)' }}>Stay Connected</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: 16 }}>
          Events & Gatherings
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          Join us for worship services, community events, and special gatherings throughout the year.
        </p>
      </div>

      <section style={{ background: 'var(--cream)', padding: '60px 5%' }}>
        <div className="container">

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📅</div>
              <p>Loading events...</p>
            </div>
          )}

          {/* Has data */}
          {!loading && events.length > 0 && (
            <>
              {categories.length > 1 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 40, flexWrap: 'wrap' }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)} style={{
                      padding: '9px 22px', borderRadius: 30, border: '1.5px solid',
                      borderColor: filter === cat ? 'var(--brand-mid)' : '#ddd',
                      background: filter === cat ? 'var(--brand-mid)' : 'white',
                      color: filter === cat ? 'white' : 'var(--text-mid)',
                      fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    }}>{cat}</button>
                  ))}
                </div>
              )}

              {filtered.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 26 }}>
                  {filtered.map(event => (
                    <div key={event.id} id={`event-${event.id}`} className="card">
                      {event.image_url ? (
                        <div style={{ position: 'relative', height: 210, overflow: 'hidden' }}>
                          <img src={event.image_url} alt={event.title}
                            onClick={() => setLightbox({ src: event.image_url, title: event.title })}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', cursor: 'zoom-in' }}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.07)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'} />
                          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                            {event.category && <span className="tag">{event.category}</span>}
                            {event.recurring && (
                              <span style={{ background: 'var(--gold)', color: 'var(--brand-deep)', padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>
                                Recurring
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          height: 100, background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                        }}>
                          <span style={{ fontSize: '2.5rem' }}>📅</span>
                          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6 }}>
                            {event.category && <span className="tag">{event.category}</span>}
                            {event.recurring && (
                              <span style={{ background: 'var(--gold)', color: 'var(--brand-deep)', padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>
                                Recurring
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ padding: '24px' }}>
                        <div style={{
                          display: 'inline-flex', gap: 16, alignItems: 'center',
                          background: 'var(--brand-pale)', borderRadius: 8,
                          padding: '8px 14px', marginBottom: 14, fontSize: '0.82rem', color: 'var(--brand-deep)',
                          flexWrap: 'wrap',
                        }}>
                          {event.date && <span>📅 {event.date}</span>}
                          {event.time && <span>⏰ {event.time}</span>}
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--brand-deep)', marginBottom: 10 }}>
                          {event.title}
                        </h3>
                        {event.description && (
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', lineHeight: 1.65, marginBottom: 14 }}>
                            {event.description}
                          </p>
                        )}
                        {event.location && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--brand-mid)', fontWeight: 700 }}>
                            📍 {event.location}
                          </div>
                        )}
                        <div style={{ marginTop: 16, display:'flex', gap:8, flexWrap:'wrap' }}>
                          {user && isApproved ? (
                            <button onClick={()=>handleRsvp(event)} disabled={rsvping[event.id]}
                              style={{ padding:'9px 20px', borderRadius:30, border:'1.5px solid', fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', transition:'all 0.2s',
                                borderColor: rsvpd[event.id] ? '#bbf7d0' : 'var(--brand-light)',
                                background: rsvpd[event.id] ? '#f0fdf4' : 'var(--brand-light)',
                                color: rsvpd[event.id] ? '#16a34a' : 'white',
                              }}>
                              {rsvping[event.id] ? '⏳' : rsvpd[event.id] ? '✅ Attending' : '📋 RSVP'}
                            </button>
                          ) : null}
                          {user && isApproved && rsvpd[event.id] && event.meal_tickets_enabled && (
                            <Link to={`/meal-ticket?event=${event.id}`} style={{ padding:'9px 20px', borderRadius:30, background:'var(--brand-pale)', color:'var(--brand-light)', fontWeight:700, fontSize:'0.82rem', textDecoration:'none', border:'1.5px solid #bfdbfe' }}>
                              🎫 Meal Ticket
                            </Link>
                          )}
                          {!user ? (
                            guestDone[event.id] ? (
                              <span style={{ padding:'9px 20px', borderRadius:30, background:'#f0fdf4', color:'#16a34a', fontWeight:700, fontSize:'0.82rem', border:'1.5px solid #bbf7d0' }}>
                                ✅ You're on the list
                              </span>
                            ) : (
                              <button onClick={() => setGuestFormOpen(o => ({ ...o, [event.id]: !o[event.id] }))} style={{ padding:'9px 20px', borderRadius:30, background:'var(--brand-pale)', color:'var(--brand-light)', fontWeight:700, fontSize:'0.82rem', border:'1.5px solid #bfdbfe', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                                📋 RSVP as Guest
                              </button>
                            )
                          ) : null}
                          {!user && (
                            <Link to="/timeline" style={{ padding:'9px 14px', color:'var(--text-light)', fontWeight:600, fontSize:'0.78rem', textDecoration:'underline', alignSelf:'center' }}>
                              or sign in
                            </Link>
                          )}
                          {event.registration_url && (
                            <a href={event.registration_url} target="_blank" rel="noreferrer" style={{ padding:'9px 20px', borderRadius:30, background:'#f8fafc', color:'var(--text-mid)', fontWeight:700, fontSize:'0.82rem', textDecoration:'none', border:'1.5px solid #e2e8f0' }}>
                              External Reg →
                            </a>
                          )}
                          <ShareButtonLight
                            title={event.title}
                            text={`${event.title} is coming up on ${event.date}${event.location ? ` at ${event.location}` : ''}.`}
                            url={`${window.location.origin}/events#event-${event.id}`}
                            imageUrl={event.image_url}
                            suffix="See details on CCG World"
                            style={{ marginLeft: 'auto' }}
                          />
                        </div>
                        {rsvpError[event.id] && (
                          <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#dc2626' }}>⚠️ {rsvpError[event.id]}</div>
                        )}
                        {!user && guestFormOpen[event.id] && !guestDone[event.id] && (
                          <div style={{ marginTop: 14, padding: 16, borderRadius: 12, background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                            <input placeholder="Your name" value={guestForm[event.id]?.name || ''}
                              onChange={e => setGuestForm(f => ({ ...f, [event.id]: { ...f[event.id], name: e.target.value } }))}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', marginBottom: 8, boxSizing: 'border-box' }} />
                            <input placeholder="Email (required)" type="email" value={guestForm[event.id]?.email || ''}
                              onChange={e => setGuestForm(f => ({ ...f, [event.id]: { ...f[event.id], email: e.target.value } }))}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', marginBottom: 8, boxSizing: 'border-box' }} />
                            <input placeholder="Phone (optional)" value={guestForm[event.id]?.phone || ''}
                              onChange={e => setGuestForm(f => ({ ...f, [event.id]: { ...f[event.id], phone: e.target.value } }))}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', marginBottom: 10, boxSizing: 'border-box' }} />
                            {guestError[event.id] && <div style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: 8 }}>⚠️ {guestError[event.id]}</div>}
                            <button onClick={() => submitGuestRsvp(event)} disabled={guestSubmitting[event.id]}
                              style={{ padding: '9px 20px', borderRadius: 30, background: 'var(--brand-mid)', color: 'white', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                              {guestSubmitting[event.id] ? 'Submitting...' : 'Confirm RSVP'}
                            </button>
                          </div>
                        )}
                        {!user && guestDone[event.id] && (
                          <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#16a34a' }}>
                            We've got you down for this one. Keep an eye on your email for updates.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                  <p>No events found in this category.</p>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!loading && events.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'var(--white, white)', borderRadius: 20, boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>📅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', marginBottom: 12 }}>
                No Events Scheduled Yet
              </h3>
              <p style={{ color: 'var(--text-mid)', maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
                There are no upcoming events at the moment. Check back soon — we'll be posting services and gatherings here regularly.
              </p>
            </div>
          )}

        </div>
      </section>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', cursor: 'zoom-out',
        }}>
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer',
          }}>✕</button>
          <img src={lightbox.src} alt={lightbox.title} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', cursor: 'default' }} />
        </div>
      )}
    </>
  )
}
