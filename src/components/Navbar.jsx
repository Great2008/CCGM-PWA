import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import supabase from '../lib/supabase'
import AppDownloadBanner from './AppDownloadBanner'

const BELL_SEEN_KEY = 'ccg-notif-last-seen'

const LANGUAGES = [
  { code: 'en',    label: 'English',    flag: '🇬🇧' },
  { code: 'yo',    label: 'Yoruba',     flag: '🇳🇬' },
  { code: 'ig',    label: 'Igbo',       flag: '🇳🇬' },
  { code: 'ha',    label: 'Hausa',      flag: '🇳🇬' },
  { code: 'fr',    label: 'French',     flag: '🇫🇷' },
  { code: 'pt',    label: 'Portuguese', flag: '🇵🇹' },
  { code: 'es',    label: 'Spanish',    flag: '🇪🇸' },
  { code: 'ar',    label: 'Arabic',     flag: '🇸🇦' },
  { code: 'zh-CN', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'sw',    label: 'Swahili',    flag: '🌍' },
]

function setGoogleTranslateCookie(lang) {
  if (lang === 'en') {
    // Reset to English — remove the cookie
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname
    window.location.reload()
    return
  }
  const val = `/en/${lang}`
  document.cookie = `googtrans=${val}; path=/`
  document.cookie = `googtrans=${val}; path=/; domain=${window.location.hostname}`
  window.location.reload()
}

const NAV_LINKS = [
  { to:'/',         label:'Home' },
  { to:'/sermons',  label:'Sermons' },
  { to:'/events',   label:'Events' },
  { to:'/studio',   label:'🎬 Studio' },
  { to:'/about',    label:'About' },
  { to:'/blog',     label:'Blog' },
  { to:'/gallery',  label:'Gallery' },
  { to:'/sabbath-school', label:'📖 Sabbath' },
  { to:'/find-church', label:'⛪ Find Church' },
  { to:'/timeline', label:'🌐 Timeline' },
  { to:'/prayer-wall', label:'🙏 Prayer Wall' },
  { to:'/contact',  label:'Contact' },
]

const OFFLINE_LINKS = [
  { to:'/bible',          label:'📖 Bible',          sub:'Full KJV offline' },
  { to:'/hymnal',         label:'🎵 Hymnal',          sub:'Songs & lyrics' },
  { to:'/devotional',     label:'🌅 Daily Word',      sub:'365 devotionals' },
  { to:'/sabbath-school', label:'📚 Sabbath School',  sub:'Weekly lessons' },
]

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [isLive, setIsLive]           = useState(false)
  const [unread, setUnread]           = useState(0)
  const [activeProg, setActiveProg]   = useState(false)
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const [langOpen, setLangOpen]     = useState(false)

  // Detect current language from cookie
  const currentLang = (() => {
    try {
      const m = document.cookie.match(/googtrans=\/en\/([^;]+)/)
      return m ? m[1] : 'en'
    } catch { return 'en' }
  })()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])
  useEffect(() => { setMenuOpen(false); setOfflineOpen(false); setLangOpen(false) }, [pathname])

  // Check for active programme
  useEffect(() => {
    supabase.from('programmes').select('id').eq('is_active', true).limit(1)
      .then(({ data }) => setActiveProg(!!(data?.length)))
    const sub = supabase.channel('nav-prog')
      .on('postgres_changes', { event:'*', schema:'public', table:'programmes' },
        async () => {
          const { data } = await supabase.from('programmes').select('id').eq('is_active', true).limit(1)
          setActiveProg(!!(data?.length))
        })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // Check live status
  useEffect(() => {    supabase.from('site_settings').select('value').eq('key','live').single()
      .then(({ data }) => setIsLive(!!data?.value?.isLive))
    const sub = supabase.channel('nav-live')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'site_settings', filter:'key=eq.live' },
        payload => setIsLive(!!payload.new.value?.isLive))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // Unread notification count
  useEffect(() => {
    const lastSeen = localStorage.getItem(BELL_SEEN_KEY)
    const query = supabase.from('notification_logs').select('*', { count: 'exact', head: true })
    if (lastSeen) query.gt('sent_at', lastSeen)
    query.then(({ count }) => setUnread(count || 0))

    const ch = supabase.channel('nav-notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_logs' },
        () => setUnread(n => n + 1))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const isHome = pathname === '/'
  const solid  = scrolled || !isHome || menuOpen
  const initials = (profile?.display_name || profile?.full_name || '?').charAt(0).toUpperCase()

  const LiveLink = ({ mobile }) => (
    <Link to="/live" style={{
      display:'flex', alignItems:'center', gap:6,
      color: pathname==='/live' ? 'var(--gold)' : isLive ? '#ff4444' : 'rgba(255,255,255,0.82)',
      fontWeight: pathname==='/live' || isLive ? 700 : 500,
      fontSize: mobile ? '0.95rem' : '0.82rem',
      padding: mobile ? '12px 22px' : '6px 10px',
      borderRadius:6, textDecoration:'none',
      borderLeft: mobile ? (pathname==='/live' ? '3px solid var(--gold)' : '3px solid transparent') : 'none',
    }}>
      {isLive && <span style={{width:7,height:7,borderRadius:'50%',background:'#ff4444',animation:'blink 1s infinite',display:'inline-block',flexShrink:0}} />}
      📡 Live{isLive ? ' Now' : ''}
    </Link>
  )

  return (
    <>
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:1000,
        background: solid ? 'rgba(10,38,18,0.97)' : 'transparent',
        backdropFilter: solid ? 'blur(14px)' : 'none',
        boxShadow: solid ? '0 2px 24px rgba(0,0,0,0.22)' : 'none',
        transition:'background 0.3s,box-shadow 0.3s',
        padding:'0 5%',
      }}>
        <div style={{maxWidth:1160,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:66}}>

          {/* Logo */}
          <Link to="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',flexShrink:0}}>
            <img src="/logo.png" alt="CCG World" style={{width:46,height:46,objectFit:'contain',flexShrink:0,filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.3))'}} />
            <div>
              <span style={{color:'white',fontFamily:'var(--font-display)',fontWeight:900,fontSize:'clamp(0.82rem,1.6vw,0.98rem)',lineHeight:1.1,display:'block'}}>CCG <span style={{color:'var(--gold)'}}>World</span></span>
              <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.55rem',letterSpacing:'0.18em',textTransform:'uppercase',fontWeight:700}}>Christian Church Of God Mission</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="desktop-nav" style={{display:'flex',alignItems:'center',gap:2}}>
            {NAV_LINKS.map(({to,label})=>(
              <Link key={to} to={to} style={{
                color: pathname===to ? 'var(--gold)' : 'rgba(255,255,255,0.82)',
                fontWeight: pathname===to ? 700 : 500,
                fontSize:'0.82rem', padding:'6px 10px', borderRadius:6,
                textDecoration:'none', transition:'color 0.2s', whiteSpace:'nowrap',
              }}
              onMouseEnter={e=>{if(pathname!==to)e.target.style.color='white'}}
              onMouseLeave={e=>{if(pathname!==to)e.target.style.color='rgba(255,255,255,0.82)'}}>
                {label}
              </Link>
            ))}

            {/* Live link */}
            <LiveLink />

            {/* Programme link — only when active */}
            {activeProg && (
              <Link to="/programme" style={{
                color: pathname==='/programme' ? 'var(--gold)' : '#fbbf24',
                fontWeight: 700, fontSize:'0.82rem', padding:'6px 10px', borderRadius:6,
                textDecoration:'none', transition:'color 0.2s', whiteSpace:'nowrap',
                background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)',
              }}>📅 Programme</Link>
            )}

            {/* Offline dropdown */}
            <div style={{position:'relative'}}>
              <button onClick={()=>setOfflineOpen(o=>!o)} style={{
                color:'rgba(255,255,255,0.82)',fontSize:'0.82rem',padding:'6px 10px',
                borderRadius:6,background:'transparent',border:'none',cursor:'pointer',
                display:'flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',whiteSpace:'nowrap',
              }}>📴 Offline <span style={{fontSize:'0.55rem',opacity:0.6}}>{offlineOpen?'▲':'▼'}</span></button>
              {offlineOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'var(--white, white)',borderRadius:12,padding:8,boxShadow:'0 12px 40px rgba(0,0,0,0.18)',minWidth:210,border:'1px solid rgba(0,0,0,0.06)',zIndex:200}}>
                  {OFFLINE_LINKS.map(({to,label,sub})=>(
                    <Link key={to} to={to} style={{display:'block',padding:'10px 14px',borderRadius:8,textDecoration:'none',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--brand-pale)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{color:'var(--brand-deep)',fontWeight:700,fontSize:'0.86rem'}}>{label}</div>
                      <div style={{color:'var(--text-light)',fontSize:'0.7rem',marginTop:1}}>{sub} · <span style={{color:'var(--brand-light)',fontWeight:700}}>✅ Offline</span></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            

            {/* Language picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setLangOpen(o => !o)}
                title="Translate"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, background: langOpen ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: currentLang !== 'en' ? 'var(--gold)' : 'rgba(255,255,255,0.82)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', fontWeight: currentLang !== 'en' ? 700 : 500, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = langOpen ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}
              >
                🌐 {LANGUAGES.find(l => l.code === currentLang)?.label || 'English'}
                <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>{langOpen ? '▲' : '▼'}</span>
              </button>
              {langOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'white', borderRadius: 12, padding: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', minWidth: 180, border: '1px solid rgba(0,0,0,0.06)', zIndex: 200 }}>
                  <div style={{ padding: '6px 12px 8px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Select Language</div>
                  {LANGUAGES.map(lang => (
                    <button key={lang.code} onClick={() => { setLangOpen(false); setGoogleTranslateCookie(lang.code) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: currentLang === lang.code ? 'var(--brand-pale)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: currentLang === lang.code ? 'var(--brand-deep)' : '#374151', fontWeight: currentLang === lang.code ? 700 : 400, textAlign: 'left', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (currentLang !== lang.code) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (currentLang !== lang.code) e.currentTarget.style.background = 'transparent' }}>
                      <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                      {lang.label}
                      {currentLang === lang.code && <span style={{ marginLeft: 'auto', color: 'var(--brand-mid)', fontSize: '0.8rem' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search button */}
            <button
              onClick={() => setSearchOpen(s => !s)}
              title="Search"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:'50%', background: searchOpen ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)', border:'none', cursor:'pointer', fontSize:'1rem', flexShrink:0, transition:'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = searchOpen ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}
            >🔍</button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'none', cursor:'pointer', fontSize:'1rem', flexShrink:0, transition:'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
            >{dark ? '☀️' : '🌙'}</button>

            {/* Notifications bell */}
            <Link to="/notifications"
              onClick={() => { localStorage.setItem(BELL_SEEN_KEY, new Date().toISOString()); setUnread(0) }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', marginLeft: 4, flexShrink: 0, textDecoration: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              title="Notifications"
            >
              <span style={{ fontSize: '1rem' }}>🔔</span>
              {unread > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444', color: 'white', fontSize: '0.62rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid rgba(10,38,18,0.97)' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            {/* Auth */}
            {user ? (
              <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:6}}>
                <Link to="/profile" title="My Profile" style={{display:'block',borderRadius:'50%',flexShrink:0,textDecoration:'none',transition:'opacity 0.2s'}} onMouseEnter={e=>e.currentTarget.style.opacity='0.8'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-base),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'0.9rem',flexShrink:0,overflow:'hidden'}}>
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} /> : initials}
                  </div>
                </Link>
                <button onClick={signOut} style={{color:'rgba(255,255,255,0.5)',background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',fontFamily:'var(--font-body)'}}>Sign out</button>
              </div>
            ) : (
              <Link to="/timeline" className="btn btn-gold" style={{padding:'7px 18px',fontSize:'0.78rem',marginLeft:6}}>Sign In</Link>
            )}
          </div>

          {/* Hamburger */}
          <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)}
            style={{display:'none',flexDirection:'column',gap:5,background:'none',border:'none',cursor:'pointer',padding:6}}
            aria-label="Menu">
            {[0,1,2].map(i=>(
              <span key={i} style={{
                display:'block',width:24,height:2.5,background:'white',borderRadius:2,
                transform: menuOpen ? (i===0?'translateY(7.5px) rotate(45deg)':i===2?'translateY(-7.5px) rotate(-45deg)':'scaleX(0)') : 'none',
                opacity: menuOpen&&i===1?0:1,
                transition:'transform 0.28s,opacity 0.2s',
              }} />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div style={{position:'fixed',inset:0,zIndex:999,background:'rgba(0,0,0,0.5)',opacity:menuOpen?1:0,pointerEvents:menuOpen?'all':'none',transition:'opacity 0.28s'}} onClick={()=>setMenuOpen(false)} />

      {/* Mobile drawer */}
      <div style={{
        position:'fixed',top:0,right:0,bottom:0,zIndex:1000,
        width:'min(300px,85vw)',background:'var(--brand-deep)',
        transform:menuOpen?'translateX(0)':'translateX(100%)',
        transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        display:'flex',flexDirection:'column',
        boxShadow:'-8px 0 40px rgba(0,0,0,0.3)',overflowY:'auto',
      }}>
        <div style={{padding:'22px 20px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/logo.png" alt="CCG World" style={{width:36,height:36,objectFit:'contain',filter:'drop-shadow(0 1px 4px rgba(0,0,0,0.3))'}} />
            <div style={{color:'white',fontFamily:'var(--font-display)',fontWeight:900,fontSize:'1rem'}}>CCG <span style={{color:'var(--gold)'}}>World</span></div>
          </div>
          <button onClick={()=>setMenuOpen(false)} style={{color:'rgba(255,255,255,0.6)',background:'none',border:'none',fontSize:'1.4rem',cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
        <nav style={{padding:'10px 0',flex:1}}>
          {/* Mobile Search */}
          <div style={{ padding: '10px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQ.trim()) { navigate('/search?q=' + encodeURIComponent(searchQ.trim())); setMenuOpen(false); setSearchQ('') }
                }}
                placeholder="🔍 Search…"
                style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 9, padding: '9px 14px', color: 'white', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none' }}
              />
              <button
                onClick={() => { if (searchQ.trim()) { navigate('/search?q=' + encodeURIComponent(searchQ.trim())); setMenuOpen(false); setSearchQ('') } }}
                style={{ background: 'var(--gold)', color: 'var(--brand-deep)', border: 'none', borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'var(--font-body)', flexShrink: 0 }}
              >Go</button>
            </div>
          </div>
          {NAV_LINKS.map(({to,label})=>(
            <Link key={to} to={to} style={{
              display:'block',padding:'12px 22px',
              color:pathname===to?'var(--gold)':'rgba(255,255,255,0.82)',
              fontWeight:pathname===to?700:400,fontSize:'0.95rem',textDecoration:'none',
              borderLeft:pathname===to?'3px solid var(--gold)':'3px solid transparent',
              transition:'all 0.2s',
            }}>{label}</Link>
          ))}
          {/* Live in mobile */}
          <LiveLink mobile />
          {/* Programme in mobile — only when active */}
          {activeProg && (
            <Link to="/programme" style={{
              display:'block', padding:'12px 22px',
              color: pathname==='/programme' ? 'var(--gold)' : '#fbbf24',
              fontWeight:700, fontSize:'0.95rem', textDecoration:'none',
              borderLeft: pathname==='/programme' ? '3px solid var(--gold)' : '3px solid rgba(251,191,36,0.4)',
              background:'rgba(251,191,36,0.06)',
            }}>📅 Programme</Link>
          )}
          <Link to="/notifications"
            onClick={() => { localStorage.setItem(BELL_SEEN_KEY, new Date().toISOString()); setUnread(0) }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px', color: pathname === '/notifications' ? 'var(--gold)' : 'rgba(255,255,255,0.82)', fontWeight: pathname === '/notifications' ? 700 : 400, fontSize: '0.95rem', textDecoration: 'none', borderLeft: pathname === '/notifications' ? '3px solid var(--gold)' : '3px solid transparent' }}>
            <span>🔔 Notifications</span>
            {unread > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 900 }}>{unread}</span>}
          </Link>
          {/* Dark mode toggle — mobile */}
          <button
            onClick={toggleTheme}
            style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 22px', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', color:'rgba(255,255,255,0.75)', fontSize:'0.95rem', borderLeft:'3px solid transparent', textAlign:'left' }}
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          {/* Language picker — mobile */}
          <div style={{ margin:'12px 20px 6px', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.35)' }}>Language</div>
          <div style={{ padding:'0 14px 10px', display:'flex', flexWrap:'wrap', gap:6 }}>
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => setGoogleTranslateCookie(lang.code)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:20, border:`1.5px solid ${currentLang===lang.code?'var(--gold)':'rgba(255,255,255,0.18)'}`, background: currentLang===lang.code?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.06)', color: currentLang===lang.code?'var(--gold)':'rgba(255,255,255,0.75)', fontFamily:'var(--font-body)', fontSize:'0.78rem', fontWeight: currentLang===lang.code?700:400, cursor:'pointer' }}>
                <span>{lang.flag}</span>{lang.label}
              </button>
            ))}
          </div>

          <div style={{margin:'12px 20px 6px',fontSize:'0.65rem',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)'}}>Offline Resources</div>
          {OFFLINE_LINKS.map(({to,label,sub})=>(
            <Link key={to} to={to} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 22px',color:'rgba(255,255,255,0.75)',fontSize:'0.9rem',textDecoration:'none'}}>
              <span>{label}</span>
              <span style={{fontSize:'0.62rem',color:'var(--brand-light)',fontWeight:700}}>✅ Offline</span>
            </Link>
          ))}
        </nav>
        <div style={{padding:'16px 20px 32px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          {user ? (
            <div>
              <Link to="/profile" style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,textDecoration:'none'}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-base),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'0.9rem',flexShrink:0,overflow:'hidden'}}>
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover'}} /> : initials}
                </div>
                <div>
                  <div style={{color:'white',fontSize:'0.85rem',fontWeight:700}}>{profile?.display_name||profile?.full_name}</div>
                  <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.7rem'}}>View Profile →</div>
                </div>
              </Link>
              <button onClick={signOut} style={{width:'100%',padding:'11px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>Sign Out</button>
            </div>
          ) : (
            <Link to="/timeline" className="btn btn-gold" style={{width:'100%',justifyContent:'center',padding:'12px'}}>🌐 Join Community</Link>
          )}
          <Link to="/admin" style={{display:'block',textAlign:'center',marginTop:12,color:'rgba(255,255,255,0.25)',fontSize:'0.7rem'}}>Admin Panel</Link>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <AppDownloadBanner compact />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @media(max-width:960px){.desktop-nav{display:none!important;}.hamburger{display:flex!important;}}
        @media(min-width:961px){.hamburger{display:none!important;}}
      `}</style>
    </>
  )
}
