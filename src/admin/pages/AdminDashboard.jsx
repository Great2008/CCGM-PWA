import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import AdminCard from '../components/AdminCard'
import PageHeader from '../components/PageHeader'
import supabase from '../../lib/supabase'

export default function AdminDashboard() {
  const { setPage } = useAdmin()
  const [counts, setCounts] = useState({ sermons:0, events:0, posts:0, prayers:0, gallery:0, members:0, posts_timeline:0 })

  useEffect(() => {
    const load = async () => {
      const [s,e,b,p,g,m,t] = await Promise.all([
        supabase.from('sermons').select('*',{count:'exact',head:true}),
        supabase.from('events').select('*',{count:'exact',head:true}),
        supabase.from('posts').select('*',{count:'exact',head:true}),
        supabase.from('prayers').select('*',{count:'exact',head:true}),
        supabase.from('gallery').select('*',{count:'exact',head:true}),
        supabase.from('profiles').select('*',{count:'exact',head:true}),
        supabase.from('timeline_posts').select('*',{count:'exact',head:true}),
      ])
      setCounts({ sermons:s.count||0, events:e.count||0, posts:b.count||0, prayers:p.count||0, gallery:g.count||0, members:m.count||0, posts_timeline:t.count||0 })
    }
    load()
  }, [])

  const stats = [
    { label:'Sermons',         value:counts.sermons,        icon:'🎙', page:'sermons', bg:'#eff6ff' },
    { label:'Events',          value:counts.events,         icon:'📅', page:'events',  bg:'#f0fdf4' },
    { label:'Blog Posts',      value:counts.posts,          icon:'✍️', page:'blog',    bg:'#fdf4ff' },
    { label:'Prayer Requests', value:counts.prayers,        icon:'🙏', page:'prayer',  bg:'#fff7ed' },
    { label:'Gallery Photos',  value:counts.gallery,        icon:'🖼', page:'gallery', bg:'#fef2f2' },
    { label:'Members',         value:counts.members,        icon:'👥', page:'members', bg:'#f8fafc' },
    { label:'Timeline Posts',  value:counts.posts_timeline, icon:'💬', page:'timeline',bg:'#eff6ff' },
  ]

  return (
    <div>
      <PageHeader icon="📊" title="Dashboard" subtitle={new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:14, marginBottom:32 }}>
        {stats.map(s=>(
          <div key={s.label} onClick={()=>setPage(s.page)} style={{ background:s.bg, borderRadius:14, padding:20, cursor:'pointer', transition:'transform 0.2s,box-shadow 0.2s', boxShadow:'var(--shadow-sm)' }}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='var(--shadow-md)'}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>
            <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:'2rem', fontWeight:900, color:'var(--brand-deep)', lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-mid)', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <AdminCard>
        <h3 style={{ margin:'0 0 16px', color:'var(--brand-deep)', fontSize:'1rem', fontWeight:700 }}>⚡ Quick Actions</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
          {[['🎙','New Sermon','sermons'],['📅','New Event','events'],['✍️','New Post','blog'],['🏠','Edit Homepage','homepage'],['🙏','View Prayers','prayer'],['👥','Manage Members','members']].map(([icon,label,pg])=>(
            <button key={label} onClick={()=>setPage(pg)} style={{ padding:'14px 10px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', cursor:'pointer', fontSize:'0.82rem', fontWeight:700, color:'var(--brand-deep)', fontFamily:'var(--font-body)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--brand-pale)';e.currentTarget.style.borderColor='var(--brand-light)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='white';e.currentTarget.style.borderColor='#e2e8f0'}}>
              <span style={{ fontSize:'1.4rem' }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </AdminCard>
    </div>
  )
}
