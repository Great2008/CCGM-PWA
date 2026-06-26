import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import supabase from '../lib/supabase'
import { getSiteSetting, setSiteSettingCache } from '../lib/siteSettings'
import { useAuth } from '../contexts/AuthContext'
import SEO from '../components/SEO'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function pad(n) { return String(n).padStart(2,'0') }

function parseEventDate(dateStr, timeStr) {
  if (!dateStr) return new Date()
  if (!timeStr) return new Date(dateStr + 'T00:00:00')
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
    return { d:Math.floor(total/86400), h:Math.floor((total%86400)/3600), m:Math.floor((total%3600)/60), s:total%60, done:false }
  }
  const [t, setT] = useState(calc)
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id) }, [target])
  if (t.done) return <div style={{textAlign:'center',padding:'12px',color:'#dc2626',fontWeight:900,fontSize:'1rem'}}>🔴 Starting now!</div>
  const BOX = ({val, label}) => (
    <div style={{textAlign:'center'}}>
      <div style={{background:'var(--brand-deep)',color:'white',borderRadius:10,padding:'10px 14px',fontFamily:'var(--font-display)',fontSize:'1.8rem',fontWeight:900,minWidth:56,lineHeight:1}}>{String(val).padStart(2,'0')}</div>
      <div style={{fontSize:'0.65rem',color:'#94a3b8',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:5}}>{label}</div>
    </div>
  )
  return (
    <div style={{borderTop:'1px solid #f1f5f9',paddingTop:16,marginTop:8}}>
      <div style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'#94a3b8',marginBottom:12,textAlign:'center'}}>⏳ Starts In</div>
      <div style={{display:'flex',gap:10,justifyContent:'center'}}>
        <BOX val={t.d} label="Days" /><BOX val={t.h} label="Hours" /><BOX val={t.m} label="Mins" /><BOX val={t.s} label="Secs" />
      </div>
    </div>
  )
}

/* ── Live Chat ── */
function LiveChat({ isLive }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef(null)

  const loadMessages = async () => {
    const { data } = await supabase
      .from('live_chat')
      .select('*, profiles(display_name, full_name, avatar_url)')
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  useEffect(() => {
    if (!open) return
    loadMessages()
    // Poll every 5 seconds as fallback (works even without realtime enabled on table)
    const pollId = setInterval(loadMessages, 5000)
    // Also try realtime
    let sub = null
    try {
      sub = supabase.channel('live-chat-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat' },
          () => loadMessages())
        .subscribe()
    } catch(_) {}
    return () => {
      clearInterval(pollId)
      if (sub) supabase.removeChannel(sub)
    }
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    if (!text.trim() || !user || sending) return
    if (profile?.suspended) return
    setSending(true)
    await supabase.from('live_chat').insert({ user_id: user.id, message: text.trim() })
    setText('')
    setSending(false)
  }

  const timeStr = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  // Floating chat button + panel
  return (
    <>
      <SEO
        title="Live Service"
        description="Watch CCG World live services online. Join us every Saturday for worship — Christian Church Of God Mission."
        path="/live"
      />
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 88, right: 20, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: isLive ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))',
          color: 'white', fontSize: '1.3rem', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Live Chat"
      >
        💬
        {messages.length > 0 && !open && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: 'white', fontSize: '0.6rem', fontWeight: 900, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
            {messages.length > 99 ? '99+' : messages.length}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 152, right: 16, zIndex: 1000,
          width: 'min(340px, calc(100vw - 32px))',
          height: 420,
          background: 'var(--white, white)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.1)',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', background: isLive ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&q=80") center/cover no-repeat', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isLive && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'blink 1s infinite', display: 'inline-block' }} />}
              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                {isLive ? 'Live Chat' : 'Service Chat'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>({messages.length})</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.84rem', marginTop: 40 }}>
                {isLive ? '🙏 Be the first to say something!' : '💬 Chat opens during live services'}
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.user_id === user?.id
              const name = msg.profiles?.display_name || msg.profiles?.full_name || 'Member'
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.72rem', flexShrink: 0 }}>
                      {msg.profiles?.avatar_url
                        ? <img src={msg.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                        : initials(msg.profiles)}
                    </div>
                  )}
                  <div style={{ maxWidth: '75%' }}>
                    {!isMe && <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginBottom: 2, fontWeight: 600 }}>{name}</div>}
                    <div style={{
                      background: isMe ? 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))' : 'var(--brand-pale, #f0fdf4)',
                      color: isMe ? 'white' : 'var(--text-dark)',
                      padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      fontSize: '0.86rem', lineHeight: 1.5, wordBreak: 'break-word',
                    }}>{msg.message}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>{timeStr(msg.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
            {user && !profile?.suspended ? (
              <>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Say something..."
                  maxLength={300}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1.5px solid #e2e8f0', fontSize: '0.86rem', fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--white, white)', color: 'var(--text-dark)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--brand-base)' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
                />
                <button onClick={send} disabled={!text.trim() || sending}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: text.trim() ? 'var(--brand-base)' : '#e2e8f0', color: text.trim() ? 'white' : '#94a3b8', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, transition: 'background 0.2s' }}>
                  ➤
                </button>
              </>
            ) : (
              <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.82rem', padding: '8px 0' }}>
                {profile?.suspended ? '🚫 Suspended members cannot chat' : <Link to="/timeline" style={{ color: 'var(--brand-light)', fontWeight: 700 }}>Sign in to chat →</Link>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function Live() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('youtube')

  useEffect(() => {
    getSiteSetting('live').then(value => { setSettings(value || null); setLoading(false) })
  }, [])

  useEffect(() => {
    const sub = supabase.channel('live-settings')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'site_settings', filter:'key=eq.live' },
        payload => { setSettings(payload.new.value); setSiteSettingCache('live', payload.new.value) })
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
  const ttUrl       = settings?.tiktokUrl || ''
  const hasYT = !!ytUrl
  const hasFB = !!fbUrl
  const hasTT = !!ttUrl
  const ytId = ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([^?&\s]+)/)?.[1]
  const ytEmbed = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0` : null
  const fbEmbed = fbUrl ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fbUrl)}&width=800&show_text=false&autoplay=true` : null
  // TikTok live embed — extract video/live ID
  const ttId = ttUrl.match(/tiktok\.com\/@[^/]+\/(?:video|live)\/([0-9]+)/)?.[1]
  const ttUser = ttUrl.match(/tiktok\.com\/@([^/\?]+)/)?.[1]
  // TikTok embeds via their oembed iframe
  const ttEmbed = ttId
    ? `https://www.tiktok.com/embed/v2/${ttId}`
    : ttUser
    ? `https://www.tiktok.com/embed/@${ttUser}/live`
    : null

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--brand-deep)',color:'white',flexDirection:'column',gap:16}}>
      <div style={{fontSize:'2.5rem',animation:'pulse 1.5s infinite'}}>📡</div>
      <div style={{fontSize:'1rem',color:'rgba(255,255,255,0.6)'}}>Loading live stream...</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <>
      <div style={{background:'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&q=80") center/cover no-repeat',padding:'clamp(80px,12vw,110px) 5% 48px'}}>
        <div className="container" style={{maxWidth:900,textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20}}>
            {isLive ? (
              <span style={{display:'flex',alignItems:'center',gap:8,background:'#dc2626',padding:'6px 20px',borderRadius:30,fontSize:'0.82rem',fontWeight:900,color:'white',letterSpacing:'0.1em',textTransform:'uppercase'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'var(--white, white)',animation:'blink 1s infinite',display:'inline-block'}} />
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
          {isLive && hasYT && hasFB && (
            <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:24}}>
              {[['youtube','▶ YouTube'],['facebook','📘 Facebook']].map(([id,label])=>(
                <button key={id} onClick={()=>setActiveTab(id)} style={{padding:'9px 24px',borderRadius:30,border:'1.5px solid',borderColor:activeTab===id?'white':'rgba(255,255,255,0.25)',background:activeTab===id?'white':'transparent',color:activeTab===id?'var(--brand-deep)':'white',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:'var(--font-body)',transition:'all 0.2s'}}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{maxWidth:900,padding:'32px 5% 80px'}}>
        {isLive && (hasYT || hasFB) && (
          <div style={{marginBottom:40}}>
            <div style={{position:'relative',paddingBottom:'56.25%',height:0,borderRadius:16,overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',border:'2px solid #dc2626'}}>
              {(activeTab==='youtube'||(!hasFB&&activeTab!=='tiktok')) && ytEmbed && (
                <iframe src={ytEmbed} title="Live Stream" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} />
              )}
              {(activeTab==='facebook'||!hasYT) && fbEmbed && (
                <iframe src={fbEmbed} title="Live Stream - Facebook" allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share" allowFullScreen style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} />
              )}
              {activeTab==='tiktok' && ttEmbed && (
                <iframe src={ttEmbed} title="Live Stream - TikTok" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope" allowFullScreen style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} sandbox="allow-scripts allow-same-origin allow-popups" />
              )}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
              {ytUrl && <a href={ytUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',borderRadius:30,background:'#ff0000',color:'white',fontWeight:700,fontSize:'0.82rem',textDecoration:'none'}}>▶ Watch on YouTube</a>}
              {fbUrl && <a href={fbUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',borderRadius:30,background:'#1877f2',color:'white',fontWeight:700,fontSize:'0.82rem',textDecoration:'none'}}>📘 Watch on Facebook</a>}
              {ttUrl && <a href={ttUrl} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 20px',borderRadius:30,background:'#010101',color:'white',fontWeight:700,fontSize:'0.82rem',textDecoration:'none'}}>♪ Watch on TikTok</a>}
            </div>
          </div>
        )}

        {!isLive && (
          <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',borderRadius:20,padding:'clamp(40px,6vw,64px) 32px',textAlign:'center',marginBottom:40,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20rem',opacity:0.03,pointerEvents:'none',userSelect:'none'}}>📡</div>
            <div style={{position:'relative'}}>
              <div style={{fontSize:'3rem',marginBottom:16}}>📡</div>
              <h2 style={{fontFamily:'var(--font-display)',color:'white',fontSize:'clamp(1.4rem,3vw,2rem)',margin:'0 0 12px'}}>We're Not Live Right Now</h2>
              <p style={{color:'rgba(255,255,255,0.65)',lineHeight:1.8,maxWidth:480,margin:'0 auto 32px',fontSize:'0.95rem'}}>
                Join us for our next live service. We broadcast our Divine Service and other programs directly to you.
              </p>
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

        {schedule.length > 0 && (
          <div style={{marginBottom:40}}>
            <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.6rem',marginBottom:6}}>📅 Broadcast Schedule</h2>
            <p style={{color:'var(--text-light)',fontSize:'0.88rem',marginBottom:24}}>We stream the following services live online</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
              {schedule.filter(s=>s.day&&s.name).map((s,i)=>{
                const isSat = s.day==='Saturday'
                return (
                  <div key={i} style={{background:'var(--white, white)',borderRadius:14,padding:'18px 20px',boxShadow:'var(--shadow-sm)',borderLeft:`4px solid ${isSat?'var(--gold)':'var(--brand-light)'}`,display:'flex',gap:14,alignItems:'flex-start'}}>
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

        {(settings?.specialEvents||[]).filter(e=>e.title&&e.date).length > 0 && (
          <div style={{marginBottom:40}}>
            <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.6rem',marginBottom:6}}>🎊 Upcoming Special Events</h2>
            <p style={{color:'var(--text-light)',fontSize:'0.88rem',marginBottom:24}}>Mark your calendar — these will be broadcast live</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {(settings.specialEvents||[]).filter(e=>e.title&&e.date&&new Date(e.date)>=new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date)).map((ev,i)=>{
                const target = parseEventDate(ev.date, ev.time)
                const isPast = target < new Date()
                return (
                  <div key={i} style={{background:'var(--white, white)',borderRadius:16,padding:'22px 24px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
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
                    {ev.broadcast!==false&&!isPast&&<SimpleCountdown target={target} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{background:'var(--brand-pale)',borderRadius:16,padding:'28px 28px'}}>
          <h3 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.2rem',margin:'0 0 16px'}}>📱 How to Watch</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>
            {[['▶','YouTube','Subscribe to our channel and tap the bell 🔔 to get notified when we go live.'],['📘','Facebook','Follow our page and turn on notifications to never miss a service.'],['📱','Mobile','Watch right here on any device — phone, tablet or computer.']].map(([icon,title,desc])=>(
              <div key={title} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:36,height:36,borderRadius:10,background:'var(--white, white)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0,boxShadow:'var(--shadow-sm)'}}>{icon}</div>
                <div>
                  <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem',marginBottom:3}}>{title}</div>
                  <div style={{fontSize:'0.82rem',color:'var(--text-mid)',lineHeight:1.6}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LiveChat isLive={isLive} />

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </>
  )
}
