import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useHomepageContent, useSermonsContent, useEventsContent } from '../hooks/useContent'
import supabase from '../lib/supabase'
import { getSiteSetting, setSiteSettingCache } from '../lib/siteSettings'
import AppDownloadBanner from '../components/AppDownloadBanner'
import SEO from '../components/SEO'

// Hero rule (Nigeria time, WAT) — the same on every day of the week:
//   morning 6am–3pm · evening 3pm–6pm · night 6pm–6am, each with its own picture (saved in the repo).
//   The picture shows with today's date and a message (edit them in Admin → Homepage → Hero).
//   Messages: Mon–Fri have morning, evening and night texts. Sat & Sun keep their morning text until 6pm,
//   then switch to their night text. After midnight the night text is still the previous evening's.
//   Saturday & Sunday use the same pictures unless a picture link is set in Admin → Homepage → Hero.
// If an image uses another extension (.png/.jpg), change it here. Text colour must suit each picture.
const HERO_IMG   = { morning: '/hero/morning.webp', evening: '/hero/evening.webp', night: '/hero/night.webp' }
const HERO_COLOR = { morning: '#1f3a2a', evening: '#4a2a45', night: '#ffffff' }
// Used until a message is saved in Admin → Homepage → Hero.
const DEFAULT_MESSAGES = {
  morning: {
    Mon: "May the Lord go before you this week, open new doors, and give you the strength to accomplish great things.",
    Tue: "God is working behind the scenes. Trust His timing, walk in faith, and never give up on His promises.",
    Wed: "May God's wisdom guide your decisions, His peace guard your heart, and His grace sustain you today.",
    Thu: "Your present challenges are not greater than God's power. Keep believing; your testimony is on the way.",
    Fri: "May the goodness of God surround you, His favour distinguish you, and His blessings overflow in your life.",
    Sat: "Rest in God's promises. He who began a good work in you is faithful to bring it to completion.",
    Sun: "May this new week be filled with fresh grace, renewed strength, divine encounters, and abundant blessings.",
  },
  evening: {
    Mon: "As the sun goes down, may God's grace renew your strength, quiet every worry, and fill your heart with peace. Rest knowing He is watching over you.",
    Tue: "As evening falls, remember that God is working even when you cannot see it. Let go of today's worries and trust Him with tomorrow.",
    Wed: "As the day comes to an end, may God's peace settle your heart, His love surround your home, and His presence give you sweet rest tonight.",
    Thu: "As night approaches, remember that no challenge is greater than God's power. Keep your faith alive; your story is still unfolding.",
    Fri: "As the week draws to a close, give thanks for God's faithfulness. May He refresh your soul, restore your strength, and fill your night with peace.",
  },
  night: {
    Mon: "Today has come to an end, and another night is here. Whatever the day has brought, remember that God's grace has carried you this far. Let go of your worries, trust His plans, and rest in the assurance that He is watching over you.",
    Tue: "Another day is behind you, and a peaceful night lies ahead. May every burden on your heart be lifted, every anxious thought be calmed, and God's unfailing love give you peace tonight.",
    Wed: "The day is over, but God's faithfulness never ends. Take a moment to appreciate how far He has brought you. May His presence fill your home, protect your loved ones, and grant you refreshing rest.",
    Thu: "As another night begins, remember that a delay is not a denial, and a difficult day is not the end of your story. Keep trusting God. He is still working things together for your good.",
    Fri: "The week is gradually coming to a close. Whatever you accomplished or could not accomplish, give thanks to God. May He restore your strength, renew your joy, and prepare you for greater testimonies.",
    Sat: "Another Sabbath day has drawn to a close. May the blessings of God's presence remain with you. As you enter this new night, may your heart be filled with gratitude, your mind with peace, and your home with His love.",
    Sun: "A new week is approaching, and tonight is a beautiful opportunity to place it all in God's hands. May He go ahead of you, open the right doors, order your steps, and make the coming week a season of testimonies.",
  },
}
// Soft dark shadow behind white text on the night picture.
const NIGHT_GLOW = '0 2px 12px rgba(0,0,25,0.85), 0 0 26px rgba(0,0,30,0.6)'
// Soft white halo behind dark text so it stays readable over leaves, sky and water (no overlay on the photo).
const GLOW = '0 0 10px rgba(255,255,255,0.95), 0 0 22px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.55)'
const watDay  = (d) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Africa/Lagos' }).format(d)
const watHour = (d) => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Lagos' }).format(d))
const watDate = (d) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' }).format(d)

export default function Home() {
  const { data: hp } = useHomepageContent()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000) // flips at midnight WAT even if the page stays open
    return () => clearInterval(t)
  }, [])
  const day = watDay(now)                                    // calendar day in WAT
  const hour = watHour(now)
  const period = (hour >= 18 || hour < 6) ? 'night' : hour >= 15 ? 'evening' : 'morning'
  // After midnight the night text still belongs to the evening before (Sunday's night text at 1am Monday).
  const textDay = (period === 'night' && hour < 6) ? watDay(new Date(now.getTime() - 86400000)) : day
  const weekendText = textDay === 'Sat' || textDay === 'Sun'
  const slot = (period === 'evening' && weekendText) ? 'morning' : period // weekend text keeps its morning message until 6pm
  const saved = ((hp.hero.msgs || {})[slot] || {})[textDay] ?? (slot === 'morning' ? (hp.hero.dayMessages || {})[textDay] : undefined)
  const dayMessage = (saved === undefined ? ((DEFAULT_MESSAGES[slot] || {})[textDay] || '') : saved).trim()
  const cardMode = true
  const tc = HERO_COLOR[period]
  const glow = period === 'night' ? NIGHT_GLOW : GLOW
  const weekendDay = day === 'Sat' || day === 'Sun'
  const link = ((weekendDay ? (period === 'night' ? hp.hero.themeNightImage : hp.hero.themeImage) : '') || '').trim()
  const heroImg = (link || HERO_IMG[period]).replace(/"/g, '%22')
  const { data: liveSermons } = useSermonsContent()
  const { data: liveEvents }  = useEventsContent()
  const [liveData, setLiveData]     = useState(null)
  const [activeProg, setActiveProg] = useState(null) // active programme or null

  useEffect(() => {
    getSiteSetting('live').then(value => setLiveData(value || null))
    const sub = supabase.channel('home-live')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'site_settings', filter:'key=eq.live' },
        payload => { setLiveData(payload.new.value); setSiteSettingCache('live', payload.new.value) })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // Fetch active programme for homepage banner
  useEffect(() => {
    supabase.from('programmes').select('id,title,theme,start_date,end_date,venue')
      .eq('is_active', true).limit(1).maybeSingle()
      .then(({ data }) => setActiveProg(data || null))
    const sub = supabase.channel('home-prog')
      .on('postgres_changes', { event:'*', schema:'public', table:'programmes' },
        async () => {
          const { data } = await supabase.from('programmes')
            .select('id,title,theme,start_date,end_date,venue')
            .eq('is_active', true).limit(1).maybeSingle()
          setActiveProg(data || null)
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const isLive = liveData?.isLive

  // Use live Supabase data if available, fall back to mock data
  const latestSermon   = liveSermons[0]  || null
  const upcomingEvents = liveEvents.slice(0, 3)

  return (
    <>
      <SEO
        title="Home"
        description="Welcome to CCG World — Christian Church Of God Mission. Access Bible, Hymnal, Daily Devotionals, Sermons, Live Services, Sabbath School and more."
        path="/"
      />
      {hp.announcement?.show && hp.announcement?.text && (
        <div style={{ background:'var(--gold)',color:'var(--green-deep)',textAlign:'center',padding:'12px 20px',fontSize:'0.9rem',fontWeight:700,lineHeight:1.5,position:'fixed',top:0,left:0,right:0,zIndex:2000 }}>
          {hp.announcement.text}
        </div>
      )}

      {/* HERO */}
      <section style={{
        minHeight:'100vh',
        background:`url("${heroImg}") center/cover no-repeat #0a2612`,
        display:'flex',alignItems:'center',justifyContent:'center',
        textAlign:'center',padding: cardMode ? 'clamp(230px,33vh,310px) 20px 80px' : 'clamp(100px,15vw,140px) 20px 80px',
        position:'relative',overflow:'hidden',
        marginTop: hp.announcement?.show ? 44 : 0,
      }}>
        {cardMode && <div style={{position:'absolute',top:0,left:0,right:0,height:150,background:'linear-gradient(to bottom,rgba(8,28,18,0.55),rgba(8,28,18,0))',pointerEvents:'none'}} />}
        <div style={{position:'absolute',right:'-2%',bottom:'2%',fontSize:'clamp(8rem,20vw,22rem)',color:cardMode?'transparent':'rgba(255,255,255,0.04)',lineHeight:1,pointerEvents:'none',userSelect:'none'}}>✝</div>
        <div style={{position:'relative',maxWidth:780,width:'100%'}}>
            <div style={{margin:'0 auto 40px',maxWidth:600}}>
              <div style={{fontFamily:'var(--font-body)',fontWeight:900,fontSize:'clamp(2.6rem,11vw,4.6rem)',color:tc,lineHeight:1.1,marginBottom:14,textShadow:glow}}>{watDate(now)}</div>
              {dayMessage && <div style={{fontFamily:'var(--font-body)',fontWeight:700,fontSize:'clamp(1.05rem,3.7vw,1.6rem)',color:tc,lineHeight:1.5,textShadow:glow}}>{dayMessage}</div>}
            </div>
          <div className="hero-ctas" style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <Link to="/sermons" className="btn btn-gold">🎙 Latest Sermon</Link>
            <Link to={hp.hero.ctaLink||'/events'} className="btn btn-outline-white" style={cardMode ? {background:'rgba(255,255,255,0.92)',color:'#1f3a2a',borderColor:'rgba(255,255,255,0.92)'} : undefined}>{hp.hero.ctaText}</Link>
          </div>

          {/* Programme Banner — shown only when an active programme exists */}
          {activeProg && (
            <Link to="/programme" style={{ textDecoration:'none', display:'block', marginTop:28 }}>
              <div
                style={{
                  background:'linear-gradient(135deg,rgba(180,83,9,0.88),rgba(217,119,6,0.82))',
                  backdropFilter:'blur(12px)',
                  border:'1px solid rgba(251,191,36,0.45)',
                  borderRadius:16, padding:'16px 22px',
                  display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
                  boxShadow:'0 8px 32px rgba(180,83,9,0.35)',
                  transition:'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(180,83,9,0.45)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 8px 32px rgba(180,83,9,0.35)'}}
              >
                <div style={{fontSize:'1.8rem',flexShrink:0,animation:'softPulse 2.5s ease-in-out infinite'}}>📅</div>
                <div style={{flex:1,minWidth:160,textAlign:'left'}}>
                  <div style={{fontSize:'0.65rem',fontWeight:800,color:'rgba(255,255,255,0.75)',textTransform:'uppercase',letterSpacing:'0.18em',marginBottom:3}}>
                    ⭐ Special Event — Now On
                  </div>
                  <div style={{fontFamily:'var(--font-display)',fontWeight:900,color:'white',fontSize:'clamp(0.92rem,2vw,1.08rem)',lineHeight:1.2,marginBottom:activeProg.theme?4:0}}>
                    {activeProg.title}
                  </div>
                  {activeProg.theme && (
                    <div style={{color:'rgba(255,255,255,0.8)',fontStyle:'italic',fontSize:'0.8rem'}}>"{activeProg.theme}"</div>
                  )}
                  {activeProg.venue && (
                    <div style={{color:'rgba(255,255,255,0.65)',fontSize:'0.75rem',marginTop:3}}>📍 {activeProg.venue}</div>
                  )}
                </div>
                <div style={{background:'rgba(255,255,255,0.15)',borderRadius:30,padding:'8px 16px',color:'white',fontWeight:800,fontSize:'0.8rem',whiteSpace:'nowrap',flexShrink:0}}>
                  View Programme →
                </div>
              </div>
            </Link>
          )}
          <div style={{marginTop:48,display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',alignItems:'center'}}>
            {isLive ? (
              <Link to="/live" style={{display:'inline-flex',alignItems:'center',gap:10,background:'#dc2626',border:'none',borderRadius:40,padding:'10px 24px',textDecoration:'none',animation:'pulse 1.5s infinite'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background: 'var(--white, white)',display:'inline-block'}} />
                <span style={{color:'white',fontSize:'0.88rem',fontWeight:900}}>🔴 We Are Live — Watch Now</span>
              </Link>
            ) : (
              <div style={{display:'inline-flex',alignItems:'center',gap:10,background:cardMode?'rgba(15,40,28,0.82)':'rgba(255,255,255,0.12)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:40,padding:'10px 24px'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#ff4444',animation:'pulse 1.5s infinite',display:'inline-block'}} />
                <span style={{color:'white',fontSize:'0.88rem',fontWeight:700}}>🌟 Divine Service every Saturday</span>
              </div>
            )}
            <Link to="/live" style={{display:'inline-flex',alignItems:'center',gap:6,color:cardMode?'#1f3a2a':'rgba(255,255,255,0.6)',fontSize:'0.8rem',fontWeight:cardMode?700:400,textDecoration:'none',background:cardMode?'rgba(255,255,255,0.92)':'transparent',border:cardMode?'1px solid rgba(255,255,255,0.92)':'1px solid rgba(255,255,255,0.15)',borderRadius:30,padding:'8px 18px'}}>
              📡 View Schedule
            </Link>
          </div>
        </div>
        <div style={{position:'absolute',bottom:28,left:'50%',transform:'translateX(-50%)',color:cardMode?tc:'rgba(255,255,255,0.45)',fontSize:'0.72rem',letterSpacing:'0.18em',textTransform:'uppercase',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
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
                background:'var(--white, white)',borderRadius:14,padding:'18px 12px',textAlign:'center',
                borderTop:`4px solid ${day==='Saturday'?'var(--gold)':'var(--green-mid)'}`,
                boxShadow:'var(--shadow-sm)',transition:'transform 0.2s',
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{fontSize:'1.5rem',marginBottom:8}}>{icon||'✝'}</div>
                <div style={{fontWeight:900,fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:day==='Saturday'?'var(--gold-deep)':'var(--green-mid)',marginBottom:4}}>{day}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:'0.88rem',color:'var(--green-deep)',fontWeight:700,lineHeight:1.3,marginBottom:time?4:0}}>{name}</div>
                {time&&<div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>{time}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST SERMON */}
      {latestSermon && (
        <section style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(60px,8vw,90px) 5%'}}>
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
                    <div style={{position:'absolute',inset:0,borderRadius:16,background:'rgba(10,38,18,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
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
                  {event.image_url ? (
                    <div style={{position:'relative',overflow:'hidden',height:170}}>
                      <img src={event.image_url} alt={event.title} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform 0.4s'}}
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

      <section className="stats-section" style={{padding:'clamp(50px,7vw,80px) 5%'}}>
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

      <AppDownloadBanner />

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
        @keyframes softPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.12)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        @media(max-width:768px){
          .sermon-grid{grid-template-columns:1fr!important;gap:32px!important;}
          .hero-ctas{flex-direction:column;align-items:center;}
          .hero-ctas a{width:100%;max-width:280px;justify-content:center;}
        }
      `}</style>

      {/* Daily Verse floating banner is now rendered globally in App.jsx */}
    </>
  )
}
