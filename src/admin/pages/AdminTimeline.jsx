import { useState, useEffect } from 'react'
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
const TOPIC_CATEGORY_COLORS = {
  general:'#64748b', bible:'#7c3aed', prayer:'#059669',
  youth:'#f97316', worship:'#ec4899', testimony:'#0ea5e9',
}

export default function AdminTimeline() {
  const { showToast, logAction } = useAdmin()

  /* ── Posts ── */
  const { rows, loading, update, remove } = useTable('timeline_posts', {
    select: '*, profiles(display_name,full_name,avatar_url,email)',
    order: 'created_at', asc: false,
  })
  const [activeTab, setActiveTab] = useState('posts')
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [delId, setDelId]         = useState(null)
  const [saving, setSaving]       = useState(false)
  const [selected, setSelected]   = useState(null)

  /* ── Topics ── */
  const [topics, setTopics]             = useState([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [topicSearch, setTopicSearch]   = useState('')
  const [delTopicId, setDelTopicId]     = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [topicSaving, setTopicSaving]   = useState(false)

  const loadTopics = async () => {
    setTopicsLoading(true)
    // Fetch topics without FK join (FK may be absent in schema cache)
    const { data, error } = await supabaseAdmin.from('timeline_topics')
      .select('*').order('created_at', { ascending: false })
    if (error || !data) { setTopicsLoading(false); return }

    // Hydrate profiles separately
    const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))]
    let profileMap = {}
    if (userIds.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from('profiles').select('id,display_name,full_name,avatar_url,email').in('id', userIds)
      ;(profileRows || []).forEach(p => { profileMap[p.id] = p })
    }
    // Attach reply counts
    const { data: replyRows } = await supabaseAdmin.from('topic_replies').select('topic_id')
    const countMap = {}
    ;(replyRows || []).forEach(r => { countMap[r.topic_id] = (countMap[r.topic_id] || 0) + 1 })

    const enriched = data.map(t => ({
      ...t,
      profiles: profileMap[t.user_id] || null,
      reply_count: countMap[t.id] || 0,
    }))
    setTopics(enriched)
    setTopicsLoading(false)
  }

  useEffect(() => { if (activeTab === 'topics') loadTopics() }, [activeTab])

  /* ── Post actions ── */
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
      logAction('timeline_delete', `Deleted timeline post by ${selected?.profiles?.display_name || selected?.profiles?.full_name || 'unknown'}`, selected?.profiles?.display_name || selected?.profiles?.full_name || null)
      showToast('Post deleted.')
      setDelId(null); setSelected(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const togglePin = async (post) => {
    try {
      await update(post.id, { pinned: !post.pinned })
      const name = post.profiles?.display_name || post.profiles?.full_name || 'unknown'
      logAction(post.pinned?'timeline_unpin':'timeline_pin', `${post.pinned?'Unpinned':'Pinned'} post by ${name}`, name)
      showToast(post.pinned?'Unpinned.':'📌 Pinned!')
    } catch(e) { showToast(e.message,'error') }
  }

  /* ── Topic actions ── */
  const filteredTopics = topics.filter(t =>
    !topicSearch ||
    (t.title||'').toLowerCase().includes(topicSearch.toLowerCase()) ||
    (t.body||'').toLowerCase().includes(topicSearch.toLowerCase()) ||
    (t.profiles?.full_name||'').toLowerCase().includes(topicSearch.toLowerCase())
  )

  const deleteTopic = async () => {
    setTopicSaving(true)
    try {
      await supabaseAdmin.from('topic_replies').delete().eq('topic_id', delTopicId)
      await supabaseAdmin.from('timeline_topics').delete().eq('id', delTopicId)
      const name = selectedTopic?.profiles?.display_name || selectedTopic?.profiles?.full_name || 'unknown'
      logAction('topic_delete', `Deleted topic "${selectedTopic?.title}" by ${name}`, name)
      showToast('Topic deleted.')
      setTopics(ts => ts.filter(t => t.id !== delTopicId))
      setDelTopicId(null); setSelectedTopic(null)
    } catch(e) { showToast(e.message,'error') }
    setTopicSaving(false)
  }

  const togglePinTopic = async (topic) => {
    try {
      await supabaseAdmin.from('timeline_topics').update({ pinned: !topic.pinned }).eq('id', topic.id)
      const name = topic.profiles?.display_name || topic.profiles?.full_name || 'unknown'
      logAction(topic.pinned?'topic_unpin':'topic_pin', `${topic.pinned?'Unpinned':'Pinned'} topic "${topic.title}"`, name)
      showToast(topic.pinned ? 'Unpinned.' : '📌 Pinned!')
      setTopics(ts => ts.map(t => t.id === topic.id ? { ...t, pinned: !t.pinned } : t))
      if (selectedTopic?.id === topic.id) setSelectedTopic(t => ({ ...t, pinned: !t.pinned }))
    } catch(e) { showToast(e.message,'error') }
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading && activeTab === 'posts') return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading timeline...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>💬 Timeline Moderation</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>
            {activeTab === 'posts' ? `${rows.length} posts total` : `${topics.length} topics total`}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:0,borderBottom:'2px solid #f1f5f9',marginBottom:22}}>
        {[['posts','📰 Feed Posts'],['topics','💬 Topics']].map(([id,label]) => (
          <button key={id} onClick={()=>{ setActiveTab(id); setSelected(null); setSelectedTopic(null) }}
            style={{
              padding:'9px 24px', border:'none', cursor:'pointer',
              fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.88rem',
              background:'transparent',
              color: activeTab===id ? 'var(--brand-light)' : 'var(--text-light)',
              borderBottom: activeTab===id ? '2.5px solid var(--brand-light)' : '2.5px solid transparent',
              marginBottom:-2, transition:'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ POSTS TAB ══ */}
      {activeTab === 'posts' && (
        <>
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
        </>
      )}

      {/* ══ TOPICS TAB ══ */}
      {activeTab === 'topics' && (
        <>
          <div style={{position:'relative',marginBottom:18,maxWidth:380}}>
            <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:'var(--text-light)'}}>🔍</span>
            <input value={topicSearch} onChange={e=>setTopicSearch(e.target.value)} placeholder="Search topics..." style={{width:'100%',padding:'9px 14px 9px 38px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',outline:'none',boxSizing:'border-box'}} />
          </div>

          {topicsLoading && <div style={{textAlign:'center',padding:'40px',color:'var(--text-light)'}}>Loading topics…</div>}

          {!topicsLoading && (
            <div style={{display:'grid',gridTemplateColumns:selectedTopic?'1fr 360px':'1fr',gap:20,alignItems:'start'}}>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {filteredTopics.length===0&&<div style={{background:'white',borderRadius:14,padding:'40px',textAlign:'center',color:'var(--text-light)'}}>No topics found.</div>}
                {filteredTopics.map(topic => {
                  const catColor = TOPIC_CATEGORY_COLORS[topic.category] || '#64748b'
                  return (
                    <div key={topic.id} onClick={()=>setSelectedTopic(topic)} style={{
                      background:'white',borderRadius:12,padding:'14px 18px',cursor:'pointer',
                      boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
                      border:`1.5px solid ${selectedTopic?.id===topic.id?'var(--brand-light)':'transparent'}`,
                      transition:'border-color 0.15s',
                    }}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:`${catColor}18`,display:'flex',alignItems:'center',justifyContent:'center',color:catColor,fontWeight:900,fontSize:'1rem',flexShrink:0}}>
                          {topic.profiles?.avatar_url
                            ? <img src={topic.profiles.avatar_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}} />
                            : initials(topic.profiles)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                            <span style={{fontWeight:700,fontSize:'0.88rem',color:'var(--text-dark)'}}>{topic.profiles?.display_name||topic.profiles?.full_name||'Unknown'}</span>
                            <span style={{fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20,background:catColor+'20',color:catColor}}>{topic.category||'general'}</span>
                            {topic.pinned&&<span style={{fontSize:'0.65rem',color:'var(--gold)',fontWeight:700}}>📌 Pinned</span>}
                            <span style={{fontSize:'0.72rem',color:'var(--text-light)',marginLeft:'auto'}}>{timeAgo(topic.created_at)}</span>
                          </div>
                          <p style={{fontSize:'0.88rem',fontWeight:700,color:'var(--text-dark)',margin:'0 0 4px',display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{topic.title}</p>
                          <p style={{fontSize:'0.82rem',color:'var(--text-mid)',lineHeight:1.5,margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{topic.body}</p>
                          <div style={{marginTop:8,fontSize:'0.75rem',color:'var(--text-light)'}}>
                            💬 {topic.reply_count} {topic.reply_count===1?'reply':'replies'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Topic detail panel */}
              {selectedTopic && (
                <div style={{position:'sticky',top:20}}>
                  <div style={{background:'white',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.09)',overflow:'hidden'}}>
                    <div style={{padding:'16px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <h3 style={{margin:0,color:'var(--brand-deep)',fontSize:'0.95rem',fontFamily:'var(--font-display)'}}>Topic Detail</h3>
                      <button onClick={()=>setSelectedTopic(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--text-light)'}}>✕</button>
                    </div>
                    <div style={{padding:'18px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:'var(--brand-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'var(--brand-light)'}}>
                          {initials(selectedTopic.profiles)}
                        </div>
                        <div>
                          <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--text-dark)'}}>{selectedTopic.profiles?.display_name||selectedTopic.profiles?.full_name||'Unknown'}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--text-light)'}}>{selectedTopic.profiles?.email} · {timeAgo(selectedTopic.created_at)}</div>
                        </div>
                      </div>
                      <div style={{fontWeight:800,fontSize:'0.95rem',color:'var(--text-dark)',marginBottom:8,lineHeight:1.35}}>{selectedTopic.title}</div>
                      <div style={{background:'#f8fafc',borderRadius:10,padding:'14px',marginBottom:16,lineHeight:1.75,color:'var(--text-dark)',fontSize:'0.88rem',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                        {selectedTopic.body}
                      </div>
                      <div style={{fontSize:'0.82rem',color:'var(--text-mid)',marginBottom:18}}>
                        💬 {selectedTopic.reply_count} {selectedTopic.reply_count===1?'reply':'replies'}
                        {selectedTopic.pinned && <span style={{marginLeft:10,color:'#d97706',fontWeight:700}}>📌 Pinned</span>}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        <button onClick={()=>togglePinTopic(selectedTopic)} style={{padding:'10px',borderRadius:10,border:`1.5px solid ${selectedTopic.pinned?'#e2e8f0':'var(--gold)'}`,background:selectedTopic.pinned?'white':'#fef3c7',color:selectedTopic.pinned?'var(--text-mid)':'#92400e',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                          {selectedTopic.pinned?'📌 Unpin Topic':'📌 Pin to Top'}
                        </button>
                        <button onClick={()=>setDelTopicId(selectedTopic.id)} style={{padding:'10px',borderRadius:10,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                          🗑 Delete Topic & Replies
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {delId && <Confirm message="Delete this post and all its comments/reactions? This cannot be undone." onConfirm={deletePost} onCancel={()=>setDelId(null)} loading={saving} />}
      {delTopicId && <Confirm message="Delete this topic and ALL its replies? This cannot be undone." onConfirm={deleteTopic} onCancel={()=>setDelTopicId(null)} loading={topicSaving} />}
    </div>
  )
}
