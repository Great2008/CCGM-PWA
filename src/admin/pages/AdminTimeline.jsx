import { useState } from 'react'
import { useAdmin } from '../AdminApp'
import { useTable } from '../useSupabaseAdmin'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { Confirm } from '../components/CrudShell'

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return `${Math.floor(d/86400)}d ago`
}

const TYPE_COLORS = { update:'var(--brand-light)', testimony:'#7c3aed', prayer:'#059669' }

export default function AdminTimeline() {
  const { showToast, logAction } = useAdmin()
  const { rows, loading, update, remove } = useTable('timeline_posts', {
    select: '*, profiles(display_name,full_name,avatar_url,email)',
    order: 'created_at', asc: false,
  })
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [delId, setDelId]     = useState(null)
  const [saving, setSaving]   = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = rows.filter(p => {
    const matchF = filter==='all' || p.post_type===filter
    const matchQ = !search || (p.body||'').toLowerCase().includes(search.toLowerCase()) ||
      (p.profiles?.full_name||'').toLowerCase().includes(search.toLowerCase())
    return matchF && matchQ
  })

  const counts = {
    all: rows.length,
    update: rows.filter(p=>p.post_type==='update').length,
    testimony: rows.filter(p=>p.post_type==='testimony').length,
    prayer: rows.filter(p=>p.post_type==='prayer').length,
  }

  const deletePost = async () => {
    setSaving(true)
    try {
      await supabaseAdmin.from('timeline_reactions').delete().eq('post_id', delId)
      await supabaseAdmin.from('timeline_comments').delete().eq('post_id', delId)
      await remove(delId)
      logAction('timeline_delete', `Deleted timeline post by ${delPost?.author_name || 'unknown'}`, delPost?.author_name || null)
      showToast('Post deleted.')
      setDelId(null); setSelected(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const togglePin = async (post) => {
    try { await update(post.id, { pinned: !post.pinned }); logAction(post.pinned?'timeline_unpin':'timeline_pin', `${post.pinned?'Unpinned':'Pinned'} post by ${post.author_name||'unknown'}`, post.author_name||null); showToast(post.pinned?'Unpinned.':'📌 Pinned!') }
    catch(e) { showToast(e.message,'error') }
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading timeline...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>💬 Timeline Moderation</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>{rows.length} posts total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {[['all','All',counts.all],['update','Updates',counts.update],['testimony','Testimonies',counts.testimony],['prayer','Prayers',counts.prayer]].map(([id,label,count])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{
            padding:'7px 16px',borderRadius:30,border:'1.5px solid',
            borderColor:filter===id?'var(--brand-light)':'#e2e8f0',
            background:filter===id?'var(--brand-light)':'white',
            color:filter===id?'white':'var(--text-mid)',
            fontSize:'0.8rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',gap:6,alignItems:'center',
          }}>
            {label}<span style={{background:'rgba(255,255,255,0.25)',borderRadius:20,padding:'0 7px',fontSize:'0.7rem'}}>{count}</span>
          </button>
        ))}
      </div>

      <div style={{position:'relative',marginBottom:18,maxWidth:380}}>
        <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:'var(--text-light)'}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search posts..." style={{width:'100%',padding:'9px 14px 9px 38px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',outline:'none',boxSizing:'border-box'}} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:selected?'1fr 360px':'1fr',gap:20,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length===0&&<div style={{background:'white',borderRadius:14,padding:'40px',textAlign:'center',color:'var(--text-light)'}}>No posts found.</div>}
          {filtered.map(post=>{
            const tc = TYPE_COLORS[post.post_type]||'var(--brand-light)'
            return (
              <div key={post.id} onClick={()=>setSelected(post)} style={{
                background:'white',borderRadius:12,padding:'14px 18px',cursor:'pointer',
                boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
                border:`1.5px solid ${selected?.id===post.id?'var(--brand-light)':'transparent'}`,
                transition:'border-color 0.15s',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:`${tc}22`,display:'flex',alignItems:'center',justifyContent:'center',color:tc,fontWeight:900,fontSize:'1rem',flexShrink:0}}>
                    {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}} /> : initials(post.profiles)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:'0.88rem',color:'var(--text-dark)'}}>{post.profiles?.display_name||post.profiles?.full_name||'Unknown'}</span>
                      <span style={{fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20,background:tc+'20',color:tc}}>{post.post_type}</span>
                      {post.pinned&&<span style={{fontSize:'0.65rem',color:'var(--gold)',fontWeight:700}}>📌 Pinned</span>}
                      <span style={{fontSize:'0.72rem',color:'var(--text-light)',marginLeft:'auto'}}>{timeAgo(post.created_at)}</span>
                    </div>
                    <p style={{fontSize:'0.85rem',color:'var(--text-mid)',lineHeight:1.6,margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{post.body}</p>
                    <div style={{display:'flex',gap:12,marginTop:8,fontSize:'0.75rem',color:'var(--text-light)'}}>
                      <span>🙏 {post.reactions?.filter(r=>r.type==='amen').length||0} Amen</span>
                      <span>❤️ {post.reactions?.filter(r=>r.type==='love').length||0} Love</span>
                      <span>💬 {post.comment_count||0} comments</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{position:'sticky',top:20}}>
            <div style={{background:'white',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.09)',overflow:'hidden'}}>
              <div style={{padding:'16px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{margin:0,color:'var(--brand-deep)',fontSize:'0.95rem',fontFamily:'var(--font-display)'}}>Post Detail</h3>
                <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--text-light)'}}>✕</button>
              </div>
              <div style={{padding:'18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:'var(--brand-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'var(--brand-light)'}}>
                    {initials(selected.profiles)}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--text-dark)'}}>{selected.profiles?.display_name||selected.profiles?.full_name}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-light)'}}>{selected.profiles?.email} · {timeAgo(selected.created_at)}</div>
                  </div>
                </div>

                <div style={{background:'#f8fafc',borderRadius:10,padding:'14px',marginBottom:16,lineHeight:1.75,color:'var(--text-dark)',fontSize:'0.9rem',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                  {selected.body}
                </div>

                {selected.image_url && <img src={selected.image_url} alt="" style={{width:'100%',borderRadius:10,marginBottom:16,maxHeight:200,objectFit:'cover'}} />}

                <div style={{display:'flex',gap:12,fontSize:'0.82rem',color:'var(--text-mid)',marginBottom:18}}>
                  <span>🙏 {selected.reactions?.filter(r=>r.type==='amen').length||0} Amen</span>
                  <span>❤️ {selected.reactions?.filter(r=>r.type==='love').length||0} Love</span>
                  <span>💬 {selected.comment_count||0}</span>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>togglePin(selected)} style={{padding:'10px',borderRadius:10,border:`1.5px solid ${selected.pinned?'#e2e8f0':'var(--gold)'}`,background:selected.pinned?'white':'#fef3c7',color:selected.pinned?'var(--text-mid)':'#92400e',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    {selected.pinned?'📌 Unpin Post':'📌 Pin to Top'}
                  </button>
                  <button onClick={()=>setDelId(selected.id)} style={{padding:'10px',borderRadius:10,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    🗑 Delete Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {delId&&<Confirm message="Delete this post and all its comments/reactions? This cannot be undone." onConfirm={deletePost} onCancel={()=>setDelId(null)} loading={saving} />}
    </div>
  )
}
