import { useState, useEffect } from 'react'
import supabaseAdmin from '../../lib/supabaseAdmin'
import AdminCard from '../components/AdminCard'
import PageHeader from '../components/PageHeader'

function StatBox({ icon, label, value, sub, color='var(--brand-light)' }) {
  return (
    <div style={{background:'white',borderRadius:14,padding:'20px 22px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
      <div style={{fontSize:'1.8rem',marginBottom:8}}>{icon}</div>
      <div style={{fontFamily:'var(--font-display)',fontSize:'2rem',fontWeight:900,color,lineHeight:1}}>{value}</div>
      <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem',marginTop:4}}>{label}</div>
      {sub && <div style={{color:'var(--text-light)',fontSize:'0.75rem',marginTop:3}}>{sub}</div>}
    </div>
  )
}

function MiniBar({ label, value, max, color='var(--brand-light)' }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:'0.85rem',color:'var(--brand-deep)',fontWeight:500}}>{label}</span>
        <span style={{fontSize:'0.85rem',fontWeight:700,color}}>{value.toLocaleString()}</span>
      </div>
      <div style={{height:8,background:'#f1f5f9',borderRadius:6,overflow:'hidden'}}>
        <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:6,transition:'width 0.6s ease'}} />
      </div>
    </div>
  )
}

function LineSparkline({ data, color='var(--brand-light)', height=60 }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d=>d.count), 1)
  const w = 300; const h = height
  const pts = data.map((d,i) => {
    const x = (i / (data.length-1)) * w
    const y = h - (d.count / max) * (h-8) - 4
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',height}} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d,i) => {
        const x = (i / (data.length-1)) * w
        const y = h - (d.count / max) * (h-8) - 4
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color}/>
      })}
    </svg>
  )
}

export default function AdminAnalytics() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState(30)

  useEffect(() => { loadAll() }, [range])

  const loadAll = async () => {
    setLoading(true)
    const since = new Date(); since.setDate(since.getDate() - range)
    const sinceStr = since.toISOString()

    const [
      { count: totalMembers },
      { count: newMembers },
      { count: pendingMembers },
      { count: totalPosts },
      { count: newPosts },
      { count: totalReactions },
      { count: totalComments },
      { count: totalSermons },
      { count: totalEvents },
      { count: totalBlog },
      { count: totalPrayers },
      { count: totalSabbath },
      { data: memberGrowth },
      { data: recentMembers },
      { data: topSermons },
      { data: recentPosts },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).gte('created_at',sinceStr),
      supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).eq('role','admin').not('role','eq','admin'),
      supabaseAdmin.from('timeline_posts').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('timeline_posts').select('*',{count:'exact',head:true}).gte('created_at',sinceStr),
      supabaseAdmin.from('timeline_reactions').select('*',{count:'exact',head:true}).gte('created_at',sinceStr),
      supabaseAdmin.from('timeline_comments').select('*',{count:'exact',head:true}).gte('created_at',sinceStr),
      supabaseAdmin.from('sermons').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('events').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('posts').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('prayers').select('*',{count:'exact',head:true}).gte('submitted_at',sinceStr),
      supabaseAdmin.from('sabbath_lessons').select('*',{count:'exact',head:true}),
      supabaseAdmin.from('profiles').select('created_at').gte('created_at',sinceStr).order('created_at'),
      supabaseAdmin.from('profiles').select('display_name,full_name,email,created_at').order('created_at',{ascending:false}).limit(5),
      supabaseAdmin.from('sermons').select('title,preacher,date').order('created_at',{ascending:false}).limit(5),
      supabaseAdmin.from('timeline_posts').select('body,created_at,profiles(display_name)').gte('created_at',sinceStr).order('created_at',{ascending:false}).limit(5),
    ])

    // Build member growth by day
    const growthMap = {}
    for (let i = range-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i)
      growthMap[d.toISOString().split('T')[0]] = 0
    }
    ;(memberGrowth||[]).forEach(m => {
      const day = m.created_at.split('T')[0]
      if (growthMap[day] !== undefined) growthMap[day]++
    })
    const growthSeries = Object.entries(growthMap).map(([date,count])=>({date,count}))

    setData({
      totalMembers:totalMembers||0, newMembers:newMembers||0, pendingMembers:pendingMembers||0,
      totalPosts:totalPosts||0, newPosts:newPosts||0,
      totalReactions:totalReactions||0, totalComments:totalComments||0,
      totalSermons:totalSermons||0, totalEvents:totalEvents||0,
      totalBlog:totalBlog||0, totalPrayers:totalPrayers||0, totalSabbath:totalSabbath||0,
      growthSeries, recentMembers:recentMembers||[],
      topSermons:topSermons||[], recentPosts:recentPosts||[],
    })
    setLoading(false)
  }

  if (loading) return (
    <div style={{textAlign:'center',padding:80,color:'var(--text-light)'}}>
      <div style={{fontSize:'2.5rem',marginBottom:12,animation:'pulse 1.5s infinite'}}>📊</div>
      Loading analytics...
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  const engagement = data.newPosts + data.totalReactions + data.totalComments

  return (
    <div>
      <PageHeader icon="📊" title="Analytics" subtitle="Community overview and activity"
        action={
          <div style={{display:'flex',gap:6}}>
            {[7,30,90].map(d=>(
              <button key={d} onClick={()=>setRange(d)} style={{padding:'7px 14px',borderRadius:20,border:'1.5px solid',borderColor:range===d?'var(--brand-light)':'#e2e8f0',background:range===d?'var(--brand-light)':'white',color:range===d?'white':'var(--text-mid)',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {/* Top stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:14,marginBottom:28}}>
        <StatBox icon="👥" label="Total Members" value={data.totalMembers} sub={`+${data.newMembers} this period`} color="var(--brand-light)" />
        <StatBox icon="⏳" label="Pending Approval" value={data.pendingMembers} sub="Awaiting review" color="#f59e0b" />
        <StatBox icon="💬" label="Timeline Posts" value={data.totalPosts} sub={`+${data.newPosts} new`} color="#8b5cf6" />
        <StatBox icon="🔥" label="Engagement" value={engagement} sub={`reactions + comments`} color="#dc2626" />
        <StatBox icon="🎙" label="Sermons" value={data.totalSermons} color="#059669" />
        <StatBox icon="📖" label="Sabbath Lessons" value={data.totalSabbath} color="#0ea5e9" />
        <StatBox icon="🙏" label="Prayer Requests" value={data.totalPrayers} sub="This period" color="#7c3aed" />
        <StatBox icon="📅" label="Events" value={data.totalEvents} color="#ea580c" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:20,marginBottom:20}} className="analytics-grid">

        {/* Member Growth Chart */}
        <AdminCard>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:4}}>📈 Member Growth</div>
          <div style={{color:'var(--text-light)',fontSize:'0.78rem',marginBottom:16}}>New members — last {range} days</div>
          {data.growthSeries.every(d=>d.count===0) ? (
            <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-light)',fontSize:'0.85rem'}}>No new members in this period</div>
          ) : (
            <>
              <LineSparkline data={data.growthSeries} color="var(--brand-light)" height={80} />
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{fontSize:'0.7rem',color:'var(--text-light)'}}>{data.growthSeries[0]?.date}</span>
                <span style={{fontSize:'0.7rem',color:'var(--text-light)'}}>{data.growthSeries[data.growthSeries.length-1]?.date}</span>
              </div>
            </>
          )}
        </AdminCard>

        {/* Timeline Activity */}
        <AdminCard>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:4}}>🌐 Timeline Activity</div>
          <div style={{color:'var(--text-light)',fontSize:'0.78rem',marginBottom:20}}>Last {range} days</div>
          <MiniBar label="Posts" value={data.newPosts} max={Math.max(data.newPosts,data.totalReactions,data.totalComments,1)} color="#8b5cf6" />
          <MiniBar label="Reactions (Amen + Love)" value={data.totalReactions} max={Math.max(data.newPosts,data.totalReactions,data.totalComments,1)} color="#dc2626" />
          <MiniBar label="Comments" value={data.totalComments} max={Math.max(data.newPosts,data.totalReactions,data.totalComments,1)} color="var(--brand-light)" />
          <div style={{marginTop:16,padding:'12px 14px',background:'var(--brand-pale)',borderRadius:10,fontSize:'0.82rem',color:'var(--brand-deep)',fontWeight:600,textAlign:'center'}}>
            Total Engagement: {engagement} interactions
          </div>
        </AdminCard>

        {/* Content Overview */}
        <AdminCard>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:4}}>📚 Content Library</div>
          <div style={{color:'var(--text-light)',fontSize:'0.78rem',marginBottom:20}}>All time totals</div>
          <MiniBar label="Sermons" value={data.totalSermons} max={Math.max(data.totalSermons,data.totalBlog,data.totalSabbath,1)} color="#059669" />
          <MiniBar label="Blog Posts" value={data.totalBlog} max={Math.max(data.totalSermons,data.totalBlog,data.totalSabbath,1)} color="#0ea5e9" />
          <MiniBar label="Sabbath Lessons" value={data.totalSabbath} max={Math.max(data.totalSermons,data.totalBlog,data.totalSabbath,1)} color="#7c3aed" />
          <MiniBar label="Events" value={data.totalEvents} max={Math.max(data.totalSermons,data.totalBlog,data.totalSabbath,1)} color="#ea580c" />
        </AdminCard>

        {/* Recent Members */}
        <AdminCard>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:4}}>👥 Recent Members</div>
          <div style={{color:'var(--text-light)',fontSize:'0.78rem',marginBottom:16}}>Latest members</div>
          {data.recentMembers.length===0 ? (
            <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-light)',fontSize:'0.85rem'}}>No members yet</div>
          ) : data.recentMembers.map((m,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:i<data.recentMembers.length-1?'1px solid #f8fafc':'none'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'0.85rem',flexShrink:0}}>
                {(m.display_name||m.full_name||'?').charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,color:'var(--brand-deep)',fontSize:'0.88rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.display_name||m.full_name||'Member'}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text-light)'}}>{new Date(m.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </AdminCard>
      </div>

      {/* Recent Timeline Posts */}
      {data.recentPosts.length > 0 && (
        <AdminCard>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:16}}>🌐 Recent Timeline Posts</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {data.recentPosts.map((p,i)=>(
              <div key={i} style={{padding:'12px 14px',background:'#f8fafc',borderRadius:10,borderLeft:'3px solid var(--brand-light)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,flexWrap:'wrap',gap:8}}>
                  <span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--brand-deep)'}}>{p.profiles?.display_name||'Member'}</span>
                  <span style={{fontSize:'0.72rem',color:'var(--text-light)'}}>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{fontSize:'0.85rem',color:'var(--text-mid)',lineHeight:1.6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.body}</div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      <style>{`
        .analytics-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
        @media(max-width:900px){ .analytics-grid { grid-template-columns: 1fr !important; } }
        @media(max-width:600px){ .analytics-stat-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}
