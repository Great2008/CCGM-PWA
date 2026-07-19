import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { useTable } from '../useSupabaseAdmin'
import supabaseAdmin from '../../lib/supabase'
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

const BADGE = (label, color, bg) => (
  <span style={{fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20,background:bg,color,whiteSpace:'nowrap'}}>
    {label}
  </span>
)

/* ─────────────────────────────────────────
   Posts Tab
───────────────────────────────────────── */
function PostsTab() {
  const { showToast, logAction } = useAdmin()
  const { rows, loading, update, remove } = useTable('timeline_posts', {
    select: '*, profiles(display_name,full_name,avatar_url,email), reactions:timeline_reactions(type)',
    order: 'created_at', asc: false,
  })
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [delId, setDelId]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = rows.filter(p => {
    const matchF = filter === 'all' || p.post_type === filter
    const matchQ = !search ||
      (p.body||'').toLowerCase().includes(search.toLowerCase()) ||
      (p.profiles?.full_name||'').toLowerCase().includes(search.toLowerCase())
    return matchF && matchQ
  })

  const counts = {
    all:       rows.length,
    update:    rows.filter(p => p.post_type==='update').length,
    testimony: rows.filter(p => p.post_type==='testimony').length,
    prayer:    rows.filter(p => p.post_type==='prayer').length,
  }

  const deletePost = async () => {
    setSaving(true)
    try {
      await supabaseAdmin.from('timeline_reactions').delete().eq('post_id', delId)
      await supabaseAdmin.from('timeline_comments').delete().eq('post_id', delId)
      await remove(delId)
      logAction('timeline_delete',
        `Deleted timeline post by ${selected?.profiles?.display_name || selected?.profiles?.full_name || 'unknown'}`,
        selected?.profiles?.display_name || selected?.profiles?.full_name || null)
      showToast('Post deleted.')
      setDelId(null); setSelected(null)
    } catch(e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const togglePin = async (post) => {
    try {
      await update(post.id, { pinned: !post.pinned })
      const name = post.profiles?.display_name || post.profiles?.full_name || 'unknown'
      logAction(post.pinned ? 'timeline_unpin' : 'timeline_pin',
        `${post.pinned ? 'Unpinned' : 'Pinned'} post by ${name}`, name)
      showToast(post.pinned ? 'Unpinned.' : '📌 Pinned!')
      if (selected?.id === post.id) setSelected(p => ({ ...p, pinned: !p.pinned }))
    } catch(e) { showToast(e.message, 'error') }
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading posts...</div>

  return (
    <>
      {/* Filter tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {[['all','All',counts.all],['update','Updates',counts.update],['testimony','Testimonies',counts.testimony],['prayer','Prayers',counts.prayer]].map(([id,label,count]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'7px 16px', borderRadius:30, border:'1.5px solid',
            borderColor: filter===id ? 'var(--brand-light)' : '#e2e8f0',
            background: filter===id ? 'var(--brand-light)' : 'white',
            color: filter===id ? 'white' : 'var(--text-mid)',
            fontSize:'0.8rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)',
            display:'flex', gap:6, alignItems:'center',
          }}>
            {label}
            <span style={{background:'rgba(255,255,255,0.25)',borderRadius:20,padding:'0 7px',fontSize:'0.7rem'}}>{count}</span>
          </button>
        ))}
      </div>

      <div style={{position:'relative',marginBottom:18,maxWidth:380}}>
        <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:'var(--text-light)'}}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..."
          style={{width:'100%',padding:'9px 14px 9px 38px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',outline:'none',boxSizing:'border-box'}} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:selected ? '1fr 360px' : '1fr',gap:20,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length === 0 && <div style={{background:'white',borderRadius:14,padding:'40px',textAlign:'center',color:'var(--text-light)'}}>No posts found.</div>}
          {filtered.map(post => {
            const tc = TYPE_COLORS[post.post_type] || 'var(--brand-light)'
            return (
              <div key={post.id} onClick={() => setSelected(post)} style={{
                background:'white', borderRadius:12, padding:'14px 18px', cursor:'pointer',
                boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
                border:`1.5px solid ${selected?.id===post.id ? 'var(--brand-light)' : 'transparent'}`,
                transition:'border-color 0.15s',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:`${tc}22`,display:'flex',alignItems:'center',justifyContent:'center',color:tc,fontWeight:900,fontSize:'1rem',flexShrink:0}}>
                    {post.profiles?.avatar_url
                      ? <img src={post.profiles.avatar_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}} />
                      : initials(post.profiles)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:'0.88rem',color:'var(--text-dark)'}}>{post.profiles?.display_name||post.profiles?.full_name||'Unknown'}</span>
                      <span style={{fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20,background:tc+'20',color:tc}}>{post.post_type}</span>
                      {post.pinned && <span style={{fontSize:'0.65rem',color:'var(--gold)',fontWeight:700}}>📌 Pinned</span>}
                      <span style={{fontSize:'0.72rem',color:'var(--text-light)',marginLeft:'auto'}}>{timeAgo(post.created_at)}</span>
                    </div>
                    <p style={{fontSize:'0.85rem',color:'var(--text-mid)',lineHeight:1.6,margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{post.body}</p>
                    <div style={{display:'flex',gap:12,marginTop:8,fontSize:'0.75rem',color:'var(--text-light)'}}>
                      <span>🙏 {post.reactions?.filter(r=>r.type==='amen').length||0}</span>
                      <span>❤️ {post.reactions?.filter(r=>r.type==='love').length||0}</span>
                      <span>💬 {post.comment_count||0} comments</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Post detail panel */}
        {selected && (
          <div style={{position:'sticky',top:20}}>
            <div style={{background:'white',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.09)',overflow:'hidden'}}>
              <div style={{padding:'16px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{margin:0,color:'var(--brand-deep)',fontSize:'0.95rem',fontFamily:'var(--font-display)'}}>Post Detail</h3>
                <button onClick={() => setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--text-light)'}}>✕</button>
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
                  <button onClick={() => togglePin(selected)} style={{padding:'10px',borderRadius:10,border:`1.5px solid ${selected.pinned?'#e2e8f0':'var(--gold)'}`,background:selected.pinned?'white':'#fef3c7',color:selected.pinned?'var(--text-mid)':'#92400e',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    {selected.pinned ? '📌 Unpin Post' : '📌 Pin to Top'}
                  </button>
                  <button onClick={() => setDelId(selected.id)} style={{padding:'10px',borderRadius:10,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    🗑 Delete Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {delId && <Confirm message="Delete this post and all its comments/reactions? This cannot be undone." onConfirm={deletePost} onCancel={() => setDelId(null)} loading={saving} />}
    </>
  )
}

/* ─────────────────────────────────────────
   Topics Tab
───────────────────────────────────────── */
function TopicsTab() {
  const { showToast, logAction } = useAdmin()
  const [topics, setTopics]               = useState([])
  const [loading, setLoading]             = useState(false)
  const [topicSearch, setTopicSearch]     = useState('')
  const [delTopicId, setDelTopicId]       = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [saving, setSaving]               = useState(false)

  const loadTopics = async () => {
    setLoading(true)
    const { data, error } = await supabaseAdmin.from('timeline_topics')
      .select('*').order('created_at', { ascending: false })
    if (error || !data) { setLoading(false); return }

    // Hydrate profiles separately (FK may be absent in schema cache)
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

    setTopics(data.map(t => ({
      ...t,
      profiles: profileMap[t.user_id] || null,
      reply_count: countMap[t.id] || 0,
    })))
    setLoading(false)
  }

  useEffect(() => { loadTopics() }, [])

  const filteredTopics = topics.filter(t =>
    !topicSearch ||
    (t.title||'').toLowerCase().includes(topicSearch.toLowerCase()) ||
    (t.body||'').toLowerCase().includes(topicSearch.toLowerCase()) ||
    (t.profiles?.full_name||'').toLowerCase().includes(topicSearch.toLowerCase())
  )

  const deleteTopic = async () => {
    setSaving(true)
    try {
      await supabaseAdmin.from('topic_replies').delete().eq('topic_id', delTopicId)
      await supabaseAdmin.from('timeline_topics').delete().eq('id', delTopicId)
      const name = selectedTopic?.profiles?.display_name || selectedTopic?.profiles?.full_name || 'unknown'
      logAction('topic_delete', `Deleted topic "${selectedTopic?.title}" by ${name}`, name)
      showToast('Topic deleted.')
      setTopics(ts => ts.filter(t => t.id !== delTopicId))
      setDelTopicId(null); setSelectedTopic(null)
    } catch(e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const togglePinTopic = async (topic) => {
    try {
      await supabaseAdmin.from('timeline_topics').update({ pinned: !topic.pinned }).eq('id', topic.id)
      const name = topic.profiles?.display_name || topic.profiles?.full_name || 'unknown'
      logAction(topic.pinned ? 'topic_unpin' : 'topic_pin',
        `${topic.pinned ? 'Unpinned' : 'Pinned'} topic "${topic.title}"`, name)
      showToast(topic.pinned ? 'Unpinned.' : '📌 Pinned!')
      setTopics(ts => ts.map(t => t.id === topic.id ? { ...t, pinned: !t.pinned } : t))
      if (selectedTopic?.id === topic.id) setSelectedTopic(t => ({ ...t, pinned: !t.pinned }))
    } catch(e) { showToast(e.message, 'error') }
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading topics…</div>

  return (
    <>
      <div style={{position:'relative',marginBottom:18,maxWidth:380}}>
        <span style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:'var(--text-light)'}}>🔍</span>
        <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)} placeholder="Search topics..."
          style={{width:'100%',padding:'9px 14px 9px 38px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',outline:'none',boxSizing:'border-box'}} />
      </div>

      <div style={{display:'grid',gridTemplateColumns:selectedTopic ? '1fr 360px' : '1fr',gap:20,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filteredTopics.length === 0 && <div style={{background:'white',borderRadius:14,padding:'40px',textAlign:'center',color:'var(--text-light)'}}>No topics found.</div>}
          {filteredTopics.map(topic => {
            const catColor = TOPIC_CATEGORY_COLORS[topic.category] || '#64748b'
            return (
              <div key={topic.id} onClick={() => setSelectedTopic(topic)} style={{
                background:'white', borderRadius:12, padding:'14px 18px', cursor:'pointer',
                boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
                border:`1.5px solid ${selectedTopic?.id===topic.id ? 'var(--brand-light)' : 'transparent'}`,
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
                      {topic.pinned && <span style={{fontSize:'0.65rem',color:'var(--gold)',fontWeight:700}}>📌 Pinned</span>}
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
                <button onClick={() => setSelectedTopic(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--text-light)'}}>✕</button>
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
                  <button onClick={() => togglePinTopic(selectedTopic)} style={{padding:'10px',borderRadius:10,border:`1.5px solid ${selectedTopic.pinned?'#e2e8f0':'var(--gold)'}`,background:selectedTopic.pinned?'white':'#fef3c7',color:selectedTopic.pinned?'var(--text-mid)':'#92400e',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    {selectedTopic.pinned ? '📌 Unpin Topic' : '📌 Pin to Top'}
                  </button>
                  <button onClick={() => setDelTopicId(selectedTopic.id)} style={{padding:'10px',borderRadius:10,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem'}}>
                    🗑 Delete Topic & Replies
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {delTopicId && <Confirm message="Delete this topic and ALL its replies? This cannot be undone." onConfirm={deleteTopic} onCancel={() => setDelTopicId(null)} loading={saving} />}
    </>
  )
}

/* ─────────────────────────────────────────
   Reports Tab
───────────────────────────────────────── */
function ReportsTab() {
  const { showToast, logAction } = useAdmin()
  const [reports, setReports]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [statusFilter, setStatusFilter]   = useState('pending')
  const [selected, setSelected]           = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const REASON_COLORS = {
    'Spam or irrelevant content':            '#f97316',
    'Inappropriate or offensive content':    '#dc2626',
    'Harassment or bullying':                '#9333ea',
    'False information / misinformation':    '#0ea5e9',
    'Other':                                 '#64748b',
  }

  const loadReports = async () => {
    setLoading(true)
    const { data, error } = await supabaseAdmin
      .from('post_reports')
      .select(`
        *,
        reporter:profiles!reporter_id(display_name, full_name, avatar_url),
        post:timeline_posts(
          id, body, post_type, created_at, pinned, image_url,
          author:profiles(id, display_name, full_name, avatar_url, email, suspended)
        )
      `)
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setReports(data || [])
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [])

  // Group reports by post_id
  const reportsByPost = {}
  reports.forEach(r => {
    if (!reportsByPost[r.post_id]) reportsByPost[r.post_id] = []
    reportsByPost[r.post_id].push(r)
  })

  // One row per post, most recent report first
  const deduped = Object.entries(reportsByPost).map(([postId, reps]) => {
    const sorted = [...reps].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    return { postId, count: reps.length, latest: sorted[0], all: reps }
  }).sort((a,b) => {
    const aResolved = a.all.every(r => r.resolved)
    const bResolved = b.all.every(r => r.resolved)
    if (aResolved !== bResolved) return aResolved ? 1 : -1
    return b.count - a.count
  })

  const filtered = deduped.filter(item => {
    const allResolved = item.all.every(r => r.resolved)
    if (statusFilter === 'pending')  return !allResolved
    if (statusFilter === 'resolved') return allResolved
    return true
  })

  const pendingCount  = deduped.filter(d => !d.all.every(r => r.resolved)).length
  const resolvedCount = deduped.filter(d =>  d.all.every(r => r.resolved)).length

  // ── Actions ──
  const markResolved = async (postId) => {
    setActionLoading(true)
    try {
      await supabaseAdmin.from('post_reports').update({ resolved: true }).eq('post_id', postId)
      logAction('report_dismiss', `Dismissed all reports for post ${postId}`)
      showToast('Reports dismissed.')
      await loadReports()
      setSelected(null)
    } catch(e) { showToast(e.message, 'error') }
    setActionLoading(false)
    setConfirmAction(null)
  }

  const deleteReportedPost = async (postId) => {
    setActionLoading(true)
    try {
      await supabaseAdmin.from('timeline_reactions').delete().eq('post_id', postId)
      await supabaseAdmin.from('timeline_comments').delete().eq('post_id', postId)
      await supabaseAdmin.from('post_reports').update({ resolved: true }).eq('post_id', postId)
      await supabaseAdmin.from('timeline_posts').delete().eq('id', postId)
      const authorName = selected?.latest?.post?.author?.display_name || selected?.latest?.post?.author?.full_name || 'unknown'
      logAction('timeline_delete', `Deleted reported post by ${authorName}`, authorName)
      showToast('Post deleted and reports resolved.')
      await loadReports()
      setSelected(null)
    } catch(e) { showToast(e.message, 'error') }
    setActionLoading(false)
    setConfirmAction(null)
  }

  const suspendAuthor = async (authorId, postId) => {
    setActionLoading(true)
    try {
      const now = new Date().toISOString()
      const reason = 'Suspended by admin after post reports review'
      await supabaseAdmin.from('profiles').update({
        suspended: true, suspended_at: now, suspension_reason: reason,
        suspension_expires_at: null, auto_suspended: false,
      }).eq('id', authorId)
      await supabaseAdmin.from('suspension_logs').insert({
        user_id: authorId, action: 'suspended', reason,
        post_id: postId, created_at: now,
      })
      await supabaseAdmin.from('post_reports').update({ resolved: true }).eq('post_id', postId)
      const authorName = selected?.latest?.post?.author?.display_name || selected?.latest?.post?.author?.full_name || 'unknown'
      logAction('suspend', reason, authorName)
      showToast('Member suspended and reports resolved.')
      await loadReports()
      setSelected(null)
    } catch(e) { showToast(e.message, 'error') }
    setActionLoading(false)
    setConfirmAction(null)
  }

  const reinstateAuthor = async (authorId) => {
    setActionLoading(true)
    try {
      await supabaseAdmin.from('profiles').update({
        suspended: false, suspended_at: null, suspension_reason: null,
        suspension_expires_at: null, auto_suspended: false,
      }).eq('id', authorId)
      const authorName = selected?.latest?.post?.author?.display_name || selected?.latest?.post?.author?.full_name || 'unknown'
      logAction('reinstate', `Reinstated ${authorName}`, authorName)
      showToast('Member reinstated.')
      await loadReports()
    } catch(e) { showToast(e.message, 'error') }
    setActionLoading(false)
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading reports...</div>

  return (
    <>
      {/* Status filter */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[
          ['pending',  '🚨 Pending',  pendingCount],
          ['resolved', '✅ Resolved', resolvedCount],
          ['all',      '📋 All',      deduped.length],
        ].map(([id, label, count]) => (
          <button key={id} onClick={() => setStatusFilter(id)} style={{
            padding:'7px 16px', borderRadius:30, border:'1.5px solid',
            borderColor: statusFilter===id ? (id==='pending'?'#dc2626':'var(--brand-light)') : '#e2e8f0',
            background: statusFilter===id ? (id==='pending'?'#dc2626':'var(--brand-light)') : 'white',
            color: statusFilter===id ? 'white' : 'var(--text-mid)',
            fontSize:'0.8rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)',
            display:'flex', gap:6, alignItems:'center',
          }}>
            {label}
            <span style={{background:'rgba(255,255,255,0.25)',borderRadius:20,padding:'0 7px',fontSize:'0.7rem'}}>{count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{background:'white',borderRadius:16,padding:'60px 40px',textAlign:'center',color:'var(--text-light)'}}>
          <div style={{fontSize:'2.5rem',marginBottom:12}}>{statusFilter==='pending'?'🎉':'📋'}</div>
          <h3 style={{color:'var(--brand-deep)',margin:'0 0 8px',fontFamily:'var(--font-display)'}}>
            {statusFilter==='pending' ? 'No pending reports' : 'Nothing here'}
          </h3>
          <p style={{margin:0,fontSize:'0.88rem'}}>
            {statusFilter==='pending' ? 'The community is behaving — no posts have been flagged.' : 'No reports in this category.'}
          </p>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:selected ? '1fr 380px' : '1fr',gap:20,alignItems:'start'}}>

        {/* Report list */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(item => {
            const post       = item.latest?.post
            const author     = post?.author
            const allResolved = item.all.every(r => r.resolved)
            const tc         = TYPE_COLORS[post?.post_type] || 'var(--brand-light)'
            const reasons    = [...new Set(item.all.map(r => r.reason).filter(Boolean))]
            const isActive   = selected?.postId === item.postId

            return (
              <div key={item.postId} onClick={() => setSelected(item)}
                style={{
                  background:'white', borderRadius:14, padding:'16px 18px',
                  cursor:'pointer', boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
                  border:`1.5px solid ${isActive ? 'var(--brand-light)' : allResolved ? '#e2e8f0' : item.count >= 5 ? '#fecaca' : '#fee2e2'}`,
                  opacity: allResolved ? 0.7 : 1,
                  transition:'border-color 0.15s',
                }}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  {/* Report count badge */}
                  <div style={{
                    width:44, height:44, borderRadius:12, flexShrink:0,
                    background: allResolved ? '#f1f5f9' : item.count >= 5 ? '#fef2f2' : '#fff5f5',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    border:`1.5px solid ${allResolved ? '#e2e8f0' : '#fecaca'}`,
                  }}>
                    <span style={{fontSize:'1rem'}}>{allResolved ? '✅' : '🚩'}</span>
                    <span style={{fontSize:'0.65rem', fontWeight:800, color: allResolved ? '#64748b' : '#dc2626', lineHeight:1}}>
                      {item.count}
                    </span>
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:5}}>
                      {author?.avatar_url
                        ? <img src={author.avatar_url} alt="" style={{width:22,height:22,borderRadius:'50%',objectFit:'cover'}} />
                        : <div style={{width:22,height:22,borderRadius:'50%',background:'var(--brand-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'0.7rem',color:'var(--brand-light)'}}>{initials(author)}</div>
                      }
                      <span style={{fontWeight:700,fontSize:'0.85rem',color:'var(--text-dark)'}}>{author?.display_name||author?.full_name||'Unknown'}</span>
                      {BADGE(post?.post_type||'post', tc, tc+'18')}
                      {author?.suspended && BADGE('Suspended','#dc2626','#fef2f2')}
                      {allResolved && BADGE('Resolved','#059669','#ecfdf5')}
                      <span style={{fontSize:'0.7rem',color:'var(--text-light)',marginLeft:'auto'}}>{timeAgo(item.latest?.created_at)}</span>
                    </div>
                    <p style={{fontSize:'0.82rem',color:'var(--text-mid)',lineHeight:1.55,margin:'0 0 8px',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                      {post?.body || '(post unavailable)'}
                    </p>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {reasons.slice(0,3).map(reason => (
                        <span key={reason} style={{
                          fontSize:'0.66rem', fontWeight:700, padding:'2px 7px', borderRadius:20,
                          background:(REASON_COLORS[reason]||'#64748b')+'15',
                          color: REASON_COLORS[reason]||'#64748b',
                        }}>{reason}</span>
                      ))}
                      {reasons.length > 3 && (
                        <span style={{fontSize:'0.66rem',color:'var(--text-light)',padding:'2px 4px'}}>+{reasons.length-3} more</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Report detail panel */}
        {selected && (() => {
          const post        = selected.latest?.post
          const author      = post?.author
          const allResolved = selected.all.every(r => r.resolved)
          const tc          = TYPE_COLORS[post?.post_type] || 'var(--brand-light)'
          const uniqueReporters = [...new Map(selected.all.map(r => [r.reporter_id, r])).values()]

          return (
            <div style={{position:'sticky',top:20}}>
              <div style={{background:'white',borderRadius:16,boxShadow:'0 2px 16px rgba(0,0,0,0.1)',overflow:'hidden'}}>

                {/* Panel header */}
                <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',background: allResolved ? '#f8fafc' : '#fff5f5'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:'1.1rem'}}>{allResolved ? '✅' : '🚨'}</span>
                    <div>
                      <div style={{fontWeight:800,fontSize:'0.9rem',color: allResolved ? 'var(--text-dark)' : '#dc2626',fontFamily:'var(--font-display)'}}>
                        {allResolved ? 'Resolved' : `${selected.count} Report${selected.count!==1?'s':''}`}
                      </div>
                      <div style={{fontSize:'0.72rem',color:'var(--text-light)'}}>
                        {uniqueReporters.length} unique reporter{uniqueReporters.length!==1?'s':''}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--text-light)'}}>✕</button>
                </div>

                <div style={{padding:'18px',display:'flex',flexDirection:'column',gap:16}}>

                  {/* Reported post */}
                  <div>
                    <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Reported Post</div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      {author?.avatar_url
                        ? <img src={author.avatar_url} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} />
                        : <div style={{width:32,height:32,borderRadius:'50%',background:'var(--brand-pale)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:'0.8rem',color:'var(--brand-light)'}}>{initials(author)}</div>
                      }
                      <div>
                        <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--text-dark)'}}>{author?.display_name||author?.full_name||'Unknown'}</div>
                        <div style={{fontSize:'0.7rem',color:'var(--text-light)'}}>{author?.email}</div>
                      </div>
                      {author?.suspended && BADGE('⛔ Suspended','#dc2626','#fef2f2')}
                    </div>
                    <div style={{background:'#f8fafc',borderRadius:10,padding:'12px 14px',fontSize:'0.88rem',color:'var(--text-dark)',lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:160,overflowY:'auto'}}>
                      {post?.body || '(post deleted or unavailable)'}
                    </div>
                    {post?.image_url && (
                      <img src={post.image_url} alt="" style={{width:'100%',borderRadius:8,marginTop:8,maxHeight:160,objectFit:'cover'}} />
                    )}
                  </div>

                  {/* Reports breakdown */}
                  <div>
                    <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>
                      Reports ({selected.count})
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto'}}>
                      {selected.all.map(r => (
                        <div key={r.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',background:'#f8fafc',borderRadius:8}}>
                          {r.reporter?.avatar_url
                            ? <img src={r.reporter.avatar_url} alt="" style={{width:24,height:24,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                            : <div style={{width:24,height:24,borderRadius:'50%',background:'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,color:'var(--text-mid)',flexShrink:0}}>{initials(r.reporter)}</div>
                          }
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              <span style={{fontSize:'0.78rem',fontWeight:700,color:'var(--text-dark)'}}>{r.reporter?.display_name||r.reporter?.full_name||'Member'}</span>
                              <span style={{fontSize:'0.68rem',color:'var(--text-light)'}}>{timeAgo(r.created_at)}</span>
                              {r.resolved && <span style={{fontSize:'0.65rem',color:'#059669',fontWeight:700}}>✓ resolved</span>}
                            </div>
                            <div style={{marginTop:2,fontSize:'0.75rem',fontWeight:600,color: REASON_COLORS[r.reason]||'#64748b'}}>
                              {r.reason || 'No reason given'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{display:'flex',flexDirection:'column',gap:8,paddingTop:4,borderTop:'1px solid #f1f5f9'}}>
                    <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Actions</div>

                    {!allResolved && (
                      <button
                        onClick={() => setConfirmAction({ type:'dismiss', label:'Dismiss all reports for this post?', fn: () => markResolved(selected.postId) })}
                        disabled={actionLoading}
                        style={{padding:'10px 14px',borderRadius:10,border:'1.5px solid #bbf7d0',background:'#f0fdf4',color:'#15803d',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem',textAlign:'left'}}>
                        ✅ Dismiss — Post is fine
                      </button>
                    )}

                    {post?.body && (
                      <button
                        onClick={() => setConfirmAction({ type:'delete', label:'Delete this post and resolve all its reports? This cannot be undone.', fn: () => deleteReportedPost(selected.postId) })}
                        disabled={actionLoading}
                        style={{padding:'10px 14px',borderRadius:10,border:'1.5px solid #fecaca',background:'#fff5f5',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem',textAlign:'left'}}>
                        🗑 Delete Post + Resolve
                      </button>
                    )}

                    {author && !author.suspended && (
                      <button
                        onClick={() => setConfirmAction({ type:'suspend', label:`Suspend ${author.display_name||author.full_name||'this member'} and resolve reports?`, fn: () => suspendAuthor(author.id, selected.postId) })}
                        disabled={actionLoading}
                        style={{padding:'10px 14px',borderRadius:10,border:'1.5px solid #fde68a',background:'#fffbeb',color:'#92400e',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem',textAlign:'left'}}>
                        ⛔ Delete Post + Suspend Member
                      </button>
                    )}

                    {author?.suspended && (
                      <button
                        onClick={() => reinstateAuthor(author.id)}
                        disabled={actionLoading}
                        style={{padding:'10px 14px',borderRadius:10,border:'1.5px solid #bbf7d0',background:'#f0fdf4',color:'#15803d',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.85rem',textAlign:'left'}}>
                        ↩ Reinstate Member
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {confirmAction && (
        <Confirm
          message={confirmAction.label}
          onConfirm={confirmAction.fn}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading}
        />
      )}
    </>
  )
}

/* ─────────────────────────────────────────
   Main AdminTimeline
───────────────────────────────────────── */
export default function AdminTimeline() {
  const [tab, setTab] = useState('posts')
  const [pendingReports, setPendingReports] = useState(0)

  // Refresh pending report badge whenever tab changes
  useEffect(() => {
    supabaseAdmin
      .from('post_reports')
      .select('post_id', { count: 'exact', head: false })
      .eq('resolved', false)
      .then(({ data }) => {
        const unique = new Set((data||[]).map(r => r.post_id))
        setPendingReports(unique.size)
      })
  }, [tab])

  const TABS = [
    { id:'posts',   label:'📰 Feed Posts' },
    { id:'topics',  label:'💬 Topics' },
    { id:'reports', label:'🚩 Reports', badge: pendingReports },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>💬 Timeline Moderation</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>Manage posts, topics, and member reports</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'2px solid #f1f5f9',paddingBottom:0}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding:'10px 20px', border:'none', cursor:'pointer', position:'relative',
              fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.88rem',
              background:'transparent',
              color: tab===t.id ? 'var(--brand-deep)' : 'var(--text-light)',
              borderBottom: tab===t.id ? '2px solid var(--brand-light)' : '2px solid transparent',
              marginBottom:-2, transition:'all 0.15s',
            }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{
                position:'absolute', top:6, right:6,
                background:'#dc2626', color:'white', borderRadius:20,
                fontSize:'0.6rem', fontWeight:800, padding:'1px 5px', lineHeight:1.4,
                minWidth:16, textAlign:'center',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'posts'   && <PostsTab />}
      {tab === 'topics'  && <TopicsTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  )
}
