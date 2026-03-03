import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../lib/supabase'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function pad(n) { return String(n).padStart(2,'0') }

function parseEventDate(dateStr, timeStr) {
  if (!dateStr) return new Date()
  if (!timeStr) return new Date(dateStr + 'T00:00:00')
  // Parse "9:00 AM" / "10:30 PM" style times
  const match = timeStr.match(/^(\d{1,2}):?(\d{0,2})\s*(AM|PM)?$/i)
  if (!match) return new Date(dateStr + 'T00:00:00')
  let h = parseInt(match[1])
  const m = parseInt(match[2] || '0')
  const period = (match[3] || '').toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
}

function Countdown({ target }) {
  const getT = () => target instanceof Date ? target : new Date(target)
  const getDiff = () => Math.max(0, getT() - Date.now())
  const [diff, setDiff] = useState(() => getDiff())

  useEffect(() => {
    setDiff(getDiff())
    const id = setInterval(() => setDiff(getDiff()), 1000)
    return () => clearInterval(id)
  }, [target])

  // If NaN (bad date), show nothing
  if (isNaN(getT().getTime())) return null

  const totalSecs = Math.floor(diff / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60

  if (diff <= 0) return <span style={{color:'var(--gold)',fontWeight:900}}>🔴 Starting now!</span>

  return (
    <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
      {[['Days',d],['Hours',h],['Minutes',m],['Seconds',s]].map(([label,val])=>(
        <div key={label} style={{textAlign:'center',minWidth:64}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'clamp(2rem,6vw,3rem)',fontWeight:900,color:'white',lineHeight:1,background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 16px',border:'1px solid rgba(255,255,255,0.12)'}}>
            {pad(val)}
          </div>
          <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.5)',letterSpacing:'0.14em',textTransform:'uppercase',marginTop:6}}>{label}</div>
        </div>
      ))}
    </div>
  )
}

function getNextService(schedule) {
  if (!schedule?.length) return null
  const now = new Date()
  const today = now.getDay()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  // Try to find next occurrence within the week
  for (let offset = 0; offset < 8; offset++) {
    const dayIdx = (today + offset) % 7
    const matches = schedule.filter(s => DAYS.indexOf(s.day) === dayIdx && s.time)
    for (const svc of matches) {
      const [time, period] = svc.time.split(' ')
      const [h, m] = time.split(':').map(Number)
      let hours = h
      if (period === 'PM' && h !== 12) hours += 12
      if (period === 'AM' && h === 12) hours = 0
      const svcMins = hours * 60 + (m || 0)
      if (offset > 0 || svcMins > nowMins) {
        const target = new Date()
        target.setDate(now.getDate() + offset)
        target.setHours(hours, m || 0, 0, 0)
        return { ...svc, target }
      }
    }
  }
  return null
}

function SimpleCountdown({ target }) {
  const calc = () => {
    const ms = target - Date.now()
    if (ms <= 0) return { d:0, h:0, m:0, s:0, done:true }
    const total = Math.floor(ms / 1000)
    return {
      d: Math.floor(total / 86400),
      h: Math.floor((total % 86400) / 3600),
      m: Math.floor((total % 3600) / 60),
      s: total % 60,
      done: false
    }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (t.done) return (
    <div style={{textAlign:'center',padding:'12px',color:'#dc2626',fontWeight:900,fontSize:'1rem'}}>🔴 Starting now!</div>
  )

  const BOX = ({val, label}) => (
    <div style={{textAlign:'center'}}>
      <div style={{
        background:'var(--brand-deep)', color:'white',
        borderRadius:10, padding:'10px 14px',
        fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900,
        minWidth:56, lineHeight:1
      }}>{String(val).padStart(2,'0')}</div>
      <div style={{fontSize:'0.65rem',color:'#94a3b8',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:5}}>{label}</div>
    </div>
  )

  return (
    <div style={{borderTop:'1px solid #f1f5f9', paddingTop:16, marginTop:8}}>
      <div style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'#94a3b8',marginBottom:12,textAlign:'center'}}>⏳ Starts In</div>
      <div style={{display:'flex', gap:10, justifyContent:'center'}}>
        <BOX val={t.d} label="Days" />
        <BOX val={t.h} label="Hours" />
        <BOX val={t.m} label="Mins" />
        <BOX val={t.s} label="Secs" />
      </div>
    </div>
  )
}

export default function Live() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('youtube')

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key','live').single()
      .then(({ data }) => {
        setSettings(data?.value || null)
        setLoading(false)
      })
  }, [])

  // Realtime — admin toggling live status reflects instantly
  useEffect(() => {
    const sub = supabase.channel('live-settings')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'site_settings', filter:'key=eq.live' },
        payload => setSettings(payload.new.value))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const isLive      = settings?.isLive
  const ytUrl       = settings?.youtubeUrl || ''
  const fbUrl       = settings?.facebookUrl || ''
  const title       = settings?.liveTitle || 'Live Service'
  const description = settings?.liveDescription || ''
  const schedule    = settings?.schedule || []
  const nextService = getNextService(schedule)

  const hasYT = !!ytUrl
  const hasFB = !!fbUrl

  // Extract YouTube embed ID
  const ytId = ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([^?&\s]+)/)?.[1]
  const ytEmbed = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0` : null

  // Facebook embed URL
  const fbEmbed = fbUrl ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbUrl)}&width=800&show_text=false&autoplay=true` : null

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--brand-deep)',color:'white',flexDirection:'column',gap:16}}>
      <div style={{fontSize:'2.5rem',animation:'pulse 1.5s infinite'}}>📡</div>
      <div style={{fontSize:'1rem',color:'rgba(255,255,255,0.6)'}}>Loading live stream...</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(80px,12vw,110px) 5% 48px'}}>
        <div className="container" style={{maxWidth:900,textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20}}>
            {isLive ? (
              <span style={{display:'flex',alignItems:'center',gap:8,background:'#dc2626',padding:'6px 20px',borderRadius:30,fontSize:'0.82rem',fontWeight:900,color:'white',letterSpacing:'0.1em',textTransform:'uppercase'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'white',animation:'blink 1s infinite',display:'inline-block'}} />
                LIVE NOW
              </span>
            ) : (
              <span style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',padding:'6px 20px',borderRadius:30,fontSize:'0.82rem',fontWeight:700,color:'rgba(255,255,255,0.7)',letterSpacing:'0.1em',textTransform:'uppercase'}}>
                📡 Live Stream
              </span>
            )}
          </div>

          <h1 style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'clamp(1.8rem,4vw,2.8rem)',color:'white',margin:'0 0 12px'}}>
            {isLive ? title : 'CCG World Live'}
          </h1>
          {description && isLive && (
            <p style={{color:'rgba(255,255,255,0.7)',fontSize:'1rem',margin:'0 auto 24px',lineHeight:1.7,maxWidth:560}}>{description}</p>
          )}

          {/* Tab switcher — only if both platforms active */}
          {isLive && hasYT && hasFB && (
            <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:24}}>
              {[['youtube','▶ YouTube'],['facebook','📘 Facebook']].map(([id,label])=>(
                <button key={id} onClick={()=>setActiveTab(id)} style={{
                  padding:'9px 24px',borderRadius:30,border:'1.5px solid',
                  borderColor:activeTab===id?'white':'rgba(255,255,255,0.25)',
                  background:activeTab===id?'white':'transparent',
                  color:activeTab===id?'var(--brand-deep)':'white',
                  fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:'var(--font-body)',
                  transition:'all 0.2s',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{maxWidth:900,padding:'32px 5% 80px'}}>

        {/* LIVE PLAYER */}
        {isLive && (hasYT || hasFB) && (
          <div style={{marginBottom:40}}>
            <div style={{position:'relative',paddingBottom:'56.25%',height:0,borderRadius:16,overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',border:'2px solid #dc2626'}}>
              {/* YouTube */}
              {(activeTab==='youtube'||!hasFB) && ytEmbed && (
                <iframe src={ytEmbed} title="Live Stream" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen
                  style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} />
              )}
              {/* Facebook */}
              {(activeTab==='facebook'||!hasYT) && fbEmbed && (
                <iframe src={fbEmbed} title="Live Stream - Facebook" allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share" allowFullScreen
                  style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} />
              )}
            </div>
            {/* Direct links */}
            <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
              {ytUrl && <a href={ytUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',borderRadius:30,background:'#ff0000',color:'white',fontWeight:700,fontSize:'0.82rem',textDecoration:'none'}}>▶ Watch on YouTube</a>}
              {fbUrl && <a href={fbUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',borderRadius:30,background:'#1877f2',color:'white',fontWeight:700,fontSize:'0.82rem',textDecoration:'none'}}>📘 Watch on Facebook</a>}
            </div>
          </div>
        )}

        {/* OFFLINE STATE */}
        {!isLive && (
          <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',borderRadius:20,padding:'clamp(40px,6vw,64px) 32px',textAlign:'center',marginBottom:40,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20rem',opacity:0.03,pointerEvents:'none',userSelect:'none'}}>📡</div>
            <div style={{position:'relative'}}>
              <div style={{fontSize:'3rem',marginBottom:16}}>📡</div>
              <h2 style={{fontFamily:'var(--font-display)',color:'white',fontSize:'clamp(1.4rem,3vw,2rem)',margin:'0 0 12px'}}>
                We're Not Live Right Now
              </h2>
              <p style={{color:'rgba(255,255,255,0.65)',lineHeight:1.8,maxWidth:480,margin:'0 auto 32px',fontSize:'0.95rem'}}>
                Join us for our next live service. We broadcast our Divine Service and other programs directly to you.
              </p>

              {/* Countdown to next service */}
              {nextService && (
                <div style={{marginBottom:32}}>
                  <p style={{color:'var(--gold)',fontWeight:700,fontSize:'0.82rem',letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:16}}>
                    Next: {nextService.name} — {nextService.day} {nextService.time && `at ${nextService.time}`}
                  </p>
                  <Countdown target={nextService.target} />
                </div>
              )}

              <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
                {ytUrl && <a href={`https://www.youtube.com/@${ytUrl.includes('@')?ytUrl.split('@')[1].split('/')[0]:''}`} target="_blank" rel="noreferrer" className="btn btn-gold">▶ Subscribe on YouTube</a>}
                {fbUrl && <a href={fbUrl.split('/videos')[0]} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'13px 32px',borderRadius:40,background:'#1877f2',color:'white',fontWeight:700,fontSize:'0.88rem',textDecoration:'none'}}>📘 Follow on Facebook</a>}
                <Link to="/sermons" className="btn btn-outline-white" style={{border:'1.5px solid rgba(255,255,255,0.3)',color:'white'}}>Watch Past Sermons</Link>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE */}
        {schedule.length > 0 && (
          <div style={{marginBottom:40}}>
            <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.6rem',marginBottom:6}}>📅 Broadcast Schedule</h2>
            <p style={{color:'var(--text-light)',fontSize:'0.88rem',marginBottom:24}}>We stream the following services live online</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
              {schedule.filter(s=>s.day&&s.name).map((s,i)=>{
                const isSat = s.day==='Saturday'
                return (
                  <div key={i} style={{background:'white',borderRadius:14,padding:'18px 20px',boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${isSat?'var(--gold)':'var(--brand-light)'}`,display:'flex',gap:14,alignItems:'flex-start'}}>
                    <div style={{fontSize:'1.6rem',flexShrink:0}}>{s.icon||'📡'}</div>
                    <div>
                      <div style={{fontWeight:900,fontSize:'0.72rem',letterSpacing:'0.12em',textTransform:'uppercase',color:isSat?'#b45309':'var(--brand-light)',marginBottom:3}}>{s.day}</div>
                      <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--brand-deep)',fontWeight:700,lineHeight:1.3}}>{s.name}</div>
                      {s.time && <div style={{fontSize:'0.82rem',color:'var(--text-light)',marginTop:3}}>🕐 {s.time}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SPECIAL EVENTS */}
        {(settings?.specialEvents||[]).filter(e=>e.title&&e.date).length > 0 && (
          <div style={{marginBottom:40}}>
            <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.6rem',marginBottom:6}}>🎊 Upcoming Special Events</h2>
            <p style={{color:'var(--text-light)',fontSize:'0.88rem',marginBottom:24}}>Mark your calendar — these will be broadcast live</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {(settings.specialEvents||[]).filter(e=>e.title&&e.date&&new Date(e.date)>=new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date)).map((ev,i)=>{
                const target = parseEventDate(ev.date, ev.time)
                const isPast = target < new Date()
                return (
                  <div key={i} style={{background:'white',borderRadius:16,padding:'22px 24px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
                    {/* Header row */}
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:ev.broadcast!==false&&!isPast?20:0}}>
                      <div style={{fontSize:'2.2rem',flexShrink:0,lineHeight:1}}>{ev.icon||'🎊'}</div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'1.15rem',color:'var(--brand-deep)',marginBottom:4}}>{ev.title}</div>
                        <div style={{fontSize:'0.82rem',color:'var(--brand-light)',fontWeight:700,marginBottom:ev.description?8:0}}>
                          📅 {new Date(ev.date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}{ev.time&&` · 🕐 ${ev.time}`}
                        </div>
                        {ev.description&&<div style={{fontSize:'0.88rem',color:'var(--text-mid)',lineHeight:1.7}}>{ev.description}</div>}
                      </div>
                    </div>
                    {/* Countdown — always full width below */}
                    {ev.broadcast!==false&&!isPast&&(
                      <SimpleCountdown target={target} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* HOW TO WATCH */}
        <div style={{background:'var(--brand-pale)',borderRadius:16,padding:'28px 28px'}}>
          <h3 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.2rem',margin:'0 0 16px'}}>📱 How to Watch</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>
            {[
              ['▶','YouTube','Subscribe to our channel and tap the bell 🔔 to get notified when we go live.'],
              ['📘','Facebook','Follow our page and turn on notifications to never miss a service.'],
              ['📱','Mobile','Watch right here on any device — phone, tablet or computer.'],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:36,height:36,borderRadius:10,background:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0,boxShadow:'var(--shadow-sm)'}}>{icon}</div>
                <div>
                  <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem',marginBottom:3}}>{title}</div>
                  <div style={{fontSize:'0.82rem',color:'var(--text-mid)',lineHeight:1.6}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </>
  )
}
