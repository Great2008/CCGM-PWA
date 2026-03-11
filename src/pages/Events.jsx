import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEventsContent } from '../hooks/useContent'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

export default function Events() {
  const { data: events, loading } = useEventsContent()
  const [filter, setFilter] = useState('All')
  const [rsvpd, setRsvpd] = useState({})
  const [rsvping, setRsvping] = useState({})
  const { user, isApproved } = useAuth()

  const handleRsvp = async (event) => {
    if (!user || !isApproved) return
    setRsvping(r=>({...r,[event.id]:true}))
    if (rsvpd[event.id]) {
      // Un-RSVP
      await supabase.from('event_registrations').delete().eq('event_id',event.id).eq('user_id',user.id)
      setRsvpd(r=>({...r,[event.id]:false}))
    } else {
      const { error } = await supabase.from('event_registrations').insert({ event_id:event.id, user_id:user.id })
      if (!error) setRsvpd(r=>({...r,[event.id]:true}))
    }
    setRsvping(r=>({...r,[event.id]:false}))
  }

  const categories = ['All', ...new Set(events.map(e => e.category).filter(Boolean))]
  const filtered = filter === 'All' ? events : events.filter(e => e.category === filter)

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, var(--green-deep) 0%, var(--green-mid) 100%)',
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
                    <div key={event.id} className="card">
                      {event.image ? (
                        <div style={{ position: 'relative', height: 210, overflow: 'hidden' }}>
                          <img src={event.image} alt={event.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
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
                          ) : !user ? (
                            <Link to="/timeline" style={{ padding:'9px 20px', borderRadius:30, background:'var(--brand-pale)', color:'var(--brand-light)', fontWeight:700, fontSize:'0.82rem', textDecoration:'none', border:'1.5px solid #bfdbfe' }}>
                              🔐 Sign in to RSVP
                            </Link>
                          ) : null}
                          {event.registration_url && (
                            <a href={event.registration_url} target="_blank" rel="noreferrer" style={{ padding:'9px 20px', borderRadius:30, background:'#f8fafc', color:'var(--text-mid)', fontWeight:700, fontSize:'0.82rem', textDecoration:'none', border:'1.5px solid #e2e8f0' }}>
                              External Reg →
                            </a>
                          )}
                        </div>
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
    </>
  )
}
