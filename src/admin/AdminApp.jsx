import { useState, useEffect, createContext, useContext } from 'react'
import supabase from '../lib/supabase'
import AdminLogin     from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminSermons   from './pages/AdminSermons'
import AdminEvents    from './pages/AdminEvents'
import AdminBlog      from './pages/AdminBlog'
import AdminGallery   from './pages/AdminGallery'
import AdminHomepage  from './pages/AdminHomepage'
import AdminPrayer    from './pages/AdminPrayer'
import AdminMembers   from './pages/AdminMembers'
import AdminTimeline  from './pages/AdminTimeline'
import AdminHymnal    from './pages/AdminHymnal'
import AdminLive     from './pages/AdminLive'
import AdminSabbath  from './pages/AdminSabbath'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminEmail    from './pages/AdminEmail'
import AdminRegistrations from './pages/AdminRegistrations'
import AdminNotifications from './pages/AdminNotifications'
import AdminStudio from './pages/AdminStudio'
import AdminBulkMessage from './pages/AdminBulkMessage'
import AdminBranches from './pages/AdminBranches'
import AdminMemberDirectory from './pages/AdminMemberDirectory'

export const AdminContext = createContext(null)
export const useAdmin = () => useContext(AdminContext)

const NAV = [
  ['dashboard', '📊', 'Dashboard'],
  ['studio',    '🎬', 'CCG Studio'],
  ['sermons',   '🎙', 'Sermons'],
  ['events',    '📅', 'Events'],
  ['blog',      '✍️', 'Blog & Devotionals'],
  ['gallery',   '🖼', 'Gallery'],
  ['hymnal',    '🎵', 'Hymnal'],
  ['homepage',  '🏠', 'Homepage'],
  ['prayer',    '🙏', 'Prayer Requests'],
  ['timeline',  '💬', 'Timeline'],
  ['members',   '👥', 'Members'],
  ['live',      '📡', 'Live Stream'],
  ['sabbath',    '📖', 'Sabbath School'],
  ['analytics',  '📊', 'Analytics'],
  ['email',      '✉️', 'Bulk Email'],
  ['registrations','📋','Registrations'],
  ['notifications','🔔','Push Notifications'],
  ['branches',    '⛪', 'Church Branches'],
  ['directory',   '🗂', 'Member Directory'],
]
const PAGES = { dashboard:AdminDashboard, studio:AdminStudio, sermons:AdminSermons, events:AdminEvents, blog:AdminBlog, gallery:AdminGallery, hymnal:AdminHymnal, homepage:AdminHomepage, prayer:AdminPrayer, timeline:AdminTimeline, members:AdminMembers, live:AdminLive, sabbath:AdminSabbath, analytics:AdminAnalytics, email:AdminEmail, registrations:AdminRegistrations, notifications:AdminNotifications, branches:AdminBranches, directory:AdminMemberDirectory }

export default function AdminApp() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        setAuthed(p?.role === 'admin')
      }
      setChecking(false)
    })
  }, [])

  // Poll for pending studio submissions every 60s
  useEffect(() => {
    if (!authed) return
    const check = async () => {
      const { count } = await supabase.from('studio_items').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      setPendingCount(count || 0)
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [authed])

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null), 3500) }
  const logout = () => { supabase.auth.signOut(); setAuthed(false) }

  if (checking) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--brand-deep)', color:'white', fontSize:'1.1rem' }}>⏳ Loading admin...</div>
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />

  const Page = PAGES[page] || AdminDashboard
  return (
    <AdminContext.Provider value={{ showToast, setPage, pendingCount }}>
      <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--font-body)', background:'#f0f4fa' }}>
        {/* Mobile overlay */}
        {sideOpen&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99 }} onClick={()=>setSideOpen(false)} />}

        {/* Sidebar */}
        <aside style={{
          width:240, background:'var(--brand-deep)', display:'flex', flexDirection:'column',
          position:'fixed', top:0, left:0, height:'100vh',
          boxShadow:'4px 0 24px rgba(0,0,0,0.2)', zIndex:100,
          transition:'transform 0.3s',
          transform: typeof window !== 'undefined' && window.innerWidth < 768 && !sideOpen ? 'translateX(-100%)' : 'none',
        }}>
          <div style={{ padding:'22px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10 }}>
            <img src="/logo.png" alt="CCG World" style={{ width:36, height:36, objectFit:'contain', flexShrink:0 }} />
            <div>
              <div style={{ color:'white', fontFamily:'var(--font-display)', fontWeight:900, fontSize:'0.95rem' }}>CCG <span style={{ color:'var(--gold)' }}>World</span></div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.6rem', letterSpacing:'0.15em', textTransform:'uppercase' }}>Admin Panel</div>
            </div>
          </div>
          <nav style={{ flex:1, padding:'10px 0', overflowY:'auto' }}>
            {NAV.map(([id,icon,label]) => (
              <button key={id} onClick={() => { setPage(id); setSideOpen(false) }} style={{
                display:'flex', alignItems:'center', gap:12,
                width:'100%', padding:'11px 18px', border:'none', cursor:'pointer',
                background: page===id ? 'rgba(37,99,235,0.2)' : 'transparent',
                color: page===id ? 'white' : 'rgba(255,255,255,0.6)',
                fontSize:'0.86rem', fontWeight: page===id ? 700 : 400,
                fontFamily:'var(--font-body)', textAlign:'left',
                borderLeft: page===id ? '3px solid var(--brand-glow)' : '3px solid transparent',
                transition:'all 0.2s',
              }}>
                <span style={{ fontSize:'1rem', width:20, textAlign:'center' }}>{icon}</span>
                <span style={{ flex:1 }}>{label}</span>
                {id === 'studio' && pendingCount > 0 && (
                  <span style={{ background:'#f59e0b', color:'#0f1f3d', fontSize:'0.62rem', fontWeight:900, padding:'2px 7px', borderRadius:10, minWidth:18, textAlign:'center' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div style={{ padding:'14px 18px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
            <a href="/" target="_blank" rel="noreferrer" style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'0.76rem', marginBottom:10, textDecoration:'none' }}>↗ View Live Site</a>
            <button onClick={logout} style={{ width:'100%', padding:'9px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.55)', fontSize:'0.8rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>Sign Out</button>
          </div>
        </aside>

        {/* Mobile nav toggle */}
        <button onClick={()=>setSideOpen(o=>!o)} style={{ position:'fixed', top:16, left:16, zIndex:200, display:'none', width:40, height:40, borderRadius:10, background:'var(--brand-deep)', border:'none', cursor:'pointer', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', boxShadow:'var(--shadow-md)', color:'white' }} className="admin-menu-btn">
          ☰
        </button>

        <main style={{ marginLeft:240, flex:1, minHeight:'100vh', padding:'32px 28px', overflowX:'hidden', minWidth:0 }} className="admin-main">
          <Page />
        </main>

        {toast&&(
          <div style={{ position:'fixed', bottom:28, right:28, zIndex:9999, background:toast.type==='success'?'var(--brand-deep)':'#dc2626', color:'white', padding:'14px 22px', borderRadius:12, boxShadow:'var(--shadow-lg)', fontSize:'0.9rem', fontWeight:600, maxWidth:340, animation:'slideIn 0.3s ease' }}>
            {toast.type==='success'?'✅':'❌'} {toast.msg}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideIn { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @media(max-width:768px) {
          .admin-menu-btn { display:flex!important; }
          .admin-main { margin-left:0!important; padding:16px!important; padding-top:60px!important; }
        }
      `}</style>
    </AdminContext.Provider>
  )
}
