import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useHomepageContent, useSermonsContent, useEventsContent } from '../hooks/useContent'
import supabase from '../lib/supabase'

export default function Home() {
  const { data: hp } = useHomepageContent()
  const { data: liveSermons } = useSermonsContent()
  const { data: liveEvents }  = useEventsContent()
  const [liveData, setLiveData] = useState(null)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key','live').single()
      .then(({ data }) => setLiveData(data?.value || null))
    const sub = supabase.channel('home-live')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'site_settings', filter:'key=eq.live' },
        payload => setLiveData(payload.new.value))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const isLive = liveData?.isLive

  // Use live Supabase data if available, fall back to mock data
  const latestSermon   = liveSermons[0]  || null
  const upcomingEvents = liveEvents.slice(0, 3)

  return (
    <>
      {hp.announcement?.show && hp.announcement?.text && (
        <div style={{ background:'var(--gold)',color:'var(--green-deep)',textAlign:'center',padding:'12px 20px',fontSize:'0.9rem',fontWeight:700,lineHeight:1.5,position:'fixed',top:0,left:0,right:0,zIndex:2000 }}>
          {hp.announcement.text}
        </div>
      )}

      {/* HERO */}
      <section style={{
        minHeight:'100vh',
        background:`linear-gradient(160deg,rgba(15,31,61,0.92) 0%,rgba(26,58,107,0.85) 55%,rgba(37,99,235,0.4) 100%),url('https://images.unsplash.com/photo-1438232992991-995b671e4b8b?w=1600&q=80') center/cover no-repeat`,
        display:'flex',alignItems:'center',justifyContent:'center',
        textAlign:'center',padding:'clamp(100px,15vw,140px) 20px 80px',
        position:'relative',overflow:'hidden',
        marginTop: hp.announcement?.show ? 44 : 0,
      }}>
        <div style={{position:'absolute',right:'-2%',bottom:'2%',fontSize:'clamp(8rem,20vw,22rem)',color:'rgba(255,255,255,0.04)',lineHeight:1,pointerEvents:'none',userSelect:'none'}}>✝</div>
        <div style={{position:'relative',maxWidth:780,width:'100%'}}>
          <div style={{display:'inline-block',border:'1px solid var(--gold)',color:'var(--gold)',padding:'6px 24px',borderRadius:30,fontSize:'0.78rem',fontWeight:700,letterSpacing:'0.3em',textTransform:'uppercase',marginBottom:28}}>🌐 CCG World</div>
          <h1 style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'clamp(2rem,6vw,4.4rem)',color:'white',lineHeight:1.12,marginBottom:20,textShadow:'0 2px 24px rgba(0,0,0,0.3)'}}>
            Welcome to<br /><em style={{fontStyle:'italic',color:'var(--gold)'}}>Christian Church<br />Of God Mission</em>
          </h1>
          <p style={{fontSize:'clamp(0.95rem,2vw,1.1rem)',color:'rgba(255,255,255,0.88)',lineHeight:1.8,maxWidth:540,margin:'0 auto 40px'}}>
            {hp.hero.subtitle}
          </p>
          <div className="hero-ctas" style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <Link to="/sermons" className="btn btn-gold">🎙 Latest Sermon</Link>
            <Link to={hp.hero.ctaLink||'/events'} className="btn btn-outline-white">{hp.hero.ctaText}</Link>
          </div>

          {/* Android App Download */}
          <div style={{marginTop:28,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <a
              href="https://github.com/Great2008/CCGM/releases/download/latest/CCGWorld-latest.apk"
              target="_blank"
              rel="noreferrer"
              style={{
                display:'inline-flex',alignItems:'center',gap:10,
                background:'linear-gradient(135deg,#16a34a,#15803d)',
                border:'none',borderRadius:40,padding:'13px 28px',
                textDecoration:'none',boxShadow:'0 6px 24px rgba(22,163,74,0.35)',
                transition:'transform 0.2s,box-shadow 0.2s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 32px rgba(22,163,74,0.45)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 6px 24px rgba(22,163,74,0.35)'}}
            >
              <span style={{fontSize:'1.3rem'}}>🤖</span>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.75)',letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:1}}>Download for</div>
                <div style={{fontSize:'0.95rem',fontWeight:900,color:'white',lineHeight:1.3}}>Android APK</div>
              </div>
            </a>
            <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.35)',letterSpacing:'0.05em'}}>
              Free · No Play Store required
            </div>
          </div>
          <div style={{marginTop:48,display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',alignItems:'center'}}>
            {isLive ? (
              <Link to="/live" style={{display:'inline-flex',alignItems:'center',gap:10,background:'#dc2626',border:'none',borderRadius:40,padding:'10px 24px',textDecoration:'none',animation:'pulse 1.5s infinite'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'white',display:'inline-block'}} />
                <span style={{color:'white',fontSize:'0.88rem',fontWeight:900}}>🔴 We Are Live — Watch Now</span>
              </Link>
            ) : (
              <div style={{display:'inline-flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.12)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:40,padding:'10px 24px'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#ff4444',animation:'pulse 1.5s infinite',display:'inline-block'}} />
                <span style={{color:'white',fontSize:'0.88rem',fontWeight:700}}>🌟 Divine Service every Saturday</span>
              </div>
            )}
            <Link to="/live" style={{display:'inline-flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:'0.8rem',textDecoration:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:30,padding:'8px 18px'}}>
              📡 View Schedule
            </Link>
          </div>
        </div>
        <div style={{position:'absolute',bottom:28,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.45)',fontSize:'0.72rem',letterSpacing:'0.18em',textTransform:'uppercase',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
          <span>Scroll</span><span style={{animation:'bounce 2s infinite'}}>↓</span>
        </div>
      </section>

      {/* SERVICE TIMES */}
      <section style={{background:'var(--green-pale)',padding:'clamp(40px,6vw,70px) 5%'}}>
        <div className="container">
          <div style={{textAlign:'center',marginBottom:32}}>
            <span className="section-label">Join Us</span>
            <h2 className="section-title">Weekly Programs</h2>
            <div className="section-divider" style={{margin:'0 auto'}} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12}}>
            {hp.serviceTimes.map(({icon,day,name,time})=>(
              <div key={day} style={{
                background:'white',borderRadius:14,padding:'18px 12px',textAlign:'center',
                borderTop:`4px solid ${day==='Saturday'?'var(--gold)':'var(--green-mid)'}`,
                boxShadow:'var(--shadow-sm)',transition:'transform 0.2s',
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'1.5rem',marginBottom:8}}>{icon||'✝'}</div>
                <div style={{fontWeight:900,fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:day==='Saturday'?'var(--gold)':'var(--green-mid)',marginBottom:4}}>{day}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:'0.88rem',color:'var(--green-deep)',fontWeight:700,lineHeight:1.3,marginBottom:time?4:0}}>{name}</div>
                {time&&<div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>{time}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST SERMON */}
      {latestSermon && (
        <section style={{background:'var(--green-deep)',padding:'clamp(60px,8vw,90px) 5%'}}>
          <div className="container">
            <div className="sermon-grid">
              <div>
                <span className="section-label" style={{color:'var(--green-light)'}}>Latest Message</span>
                <h2 className="section-title" style={{color:'white'}}>{latestSermon.title}</h2>
                <div className="section-divider" style={{background:'linear-gradient(90deg,var(--green-light),var(--gold))'}} />
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                  {latestSermon.series && <span className="tag" style={{background:'rgba(255,255,255,0.12)',color:'var(--gold)'}}>{latestSermon.series}</span>}
                  <span style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.55)'}}>{latestSermon.date}</span>
                </div>
                {latestSermon.description && <p style={{color:'rgba(255,255,255,0.78)',lineHeight:1.8,marginBottom:12}}>{latestSermon.description}</p>}
                {(latestSermon.scripture || latestSermon.pastor) && (
                  <p style={{color:'var(--green-light)',fontSize:'0.88rem',fontWeight:700,marginBottom:28}}>
                    {latestSermon.scripture && `📖 ${latestSermon.scripture}`}{latestSermon.scripture && latestSermon.pastor && ' — '}{latestSermon.pastor}
                  </p>
                )}
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  <Link to="/sermons" className="btn btn-gold">▶ Watch Now</Link>
                  <Link to="/sermons" className="btn btn-outline-white" style={{border:'1.5px solid rgba(255,255,255,0.4)',color:'white'}}>All Sermons →</Link>
                </div>
              </div>
              <div style={{position:'relative'}}>
                {latestSermon.thumbnail ? (
                  <>
                    <img src={latestSermon.thumbnail} alt={latestSermon.title} style={{width:'100%',borderRadius:16,boxShadow:'0 24px 60px rgba(0,0,0,0.4)'}} />
                    <div style={{position:'absolute',inset:0,borderRadius:16,background:'rgba(15,31,61,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(255,255,255,0.95)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.6rem',boxShadow:'0 8px 30px rgba(0,0,0,0.3)',cursor:'pointer',transition:'transform 0.2s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>▶</div>
                    </div>
                  </>
                ) : (
                  <div style={{height:200,borderRadius:16,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'4rem'}}>🎙</div>
                )}
                {latestSermon.duration && (
                  <div style={{position:'absolute',bottom:-14,left:-14,background:'var(--gold)',color:'var(--brand-deep)',borderRadius:10,padding:'10px 16px',fontWeight:900,fontSize:'0.82rem'}}>🎙 {latestSermon.duration}</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* EVENTS */}
      {upcomingEvents.length > 0 && (
        <section style={{background:'var(--cream)',padding:'clamp(60px,8vw,90px) 5%'}}>
          <div className="container">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:40,flexWrap:'wrap',gap:16}}>
              <div>
                <span className="section-label">What's Coming Up</span>
                <h2 className="section-title">Upcoming Events</h2>
                <div className="section-divider" />
              </div>
              <Link to="/events" className="btn btn-outline-green">View All →</Link>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:22}}>
              {upcomingEvents.map(event=>(
                <div key={event.id} className="card">
                  {event.image ? (
                    <div style={{position:'relative',overflow:'hidden',height:170}}>
                      <img src={event.image} alt={event.title} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform 0.4s'}}
                        onMouseEnter={e=>e.target.style.transform='scale(1.06)'}
                        onMouseLeave={e=>e.target.style.transform='scale(1)'} />
                      {event.category && <div style={{position:'absolute',top:12,left:12}}><span className="tag">{event.category}</span></div>}
                    </div>
                  ) : (
                    <div style={{height:100,background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.5rem'}}>📅</div>
                  )}
                  <div style={{padding:'18px 20px'}}>
                    <div style={{display:'flex',gap:8,marginBottom:8,fontSize:'0.8rem',color:'var(--text-light)',flexWrap:'wrap'}}>
                      {event.date && <span>📅 {event.date}</span>}
                      {event.date && event.time && <span>·</span>}
                      {event.time && <span>⏰ {event.time}</span>}
                    </div>
                    <h3 style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',color:'var(--brand-deep)',marginBottom:8}}>{event.title}</h3>
                    {event.description && <p style={{fontSize:'0.86rem',color:'var(--text-mid)',lineHeight:1.65}}>{event.description}</p>}
                    {event.location && <div style={{marginTop:14,fontSize:'0.8rem',color:'var(--brand-mid)',fontWeight:700}}>📍 {event.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{background:'linear-gradient(135deg,var(--green-deep),var(--green-mid))',padding:'clamp(50px,7vw,80px) 5%'}}>
        <div className="container">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:24,textAlign:'center'}}>
            {hp.stats.map(s=>(
              <div key={s.label}>
                <div style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,5vw,3.2rem)',fontWeight:900,color:'var(--gold)',lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.75)',marginTop:8}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{background:'var(--cream)',padding:'clamp(60px,8vw,90px) 5%',textAlign:'center'}}>
        <div className="container" style={{maxWidth:640}}>
          <div style={{fontSize:'2.5rem',marginBottom:16}}>✝</div>
          <h2 style={{fontFamily:'var(--font-display)',color:'var(--green-deep)',fontSize:'clamp(1.6rem,4vw,2.4rem)',marginBottom:16}}>New Here? You're Family Already.</h2>
          <p style={{color:'var(--text-mid)',maxWidth:480,margin:'0 auto 36px',lineHeight:1.8}}>
            Whether you're searching for faith, returning to God, or looking for a community — our doors are always open.
          </p>
          <div className="hero-ctas" style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <Link to="/about" className="btn btn-green">Learn About Us</Link>
            <Link to="/contact" className="btn btn-outline-green">Get In Touch</Link>
          </div>
        </div>
      </section>

      <style>{`
        .sermon-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        @media(max-width:768px){
          .sermon-grid{grid-template-columns:1fr!important;gap:32px!important;}
          .hero-ctas{flex-direction:column;align-items:center;}
          .hero-ctas a{width:100%;max-width:280px;justify-content:center;}
        }
      `}</style>
    </>
  )
}
