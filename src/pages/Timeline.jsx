import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import { auditLog } from '../lib/auditLog'
import { Link, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'

const POST_TYPES = [
  { id:'update',    label:'📝 Update',    color:'var(--brand-light)' },
  { id:'testimony', label:'🙌 Testimony', color:'#7c3aed' },
  { id:'prayer',    label:'🙏 Prayer',    color:'#059669' },
]

const TOPIC_CATEGORIES = [
  { id:'general',   label:'💬 General',       color:'#64748b' },
  { id:'bible',     label:'📖 Bible Study',   color:'#7c3aed' },
  { id:'prayer',    label:'🙏 Prayer',        color:'#059669' },
  { id:'youth',     label:'🔥 Youth Corner',  color:'#f97316' },
  { id:'worship',   label:'🎵 Worship',       color:'#ec4899' },
  { id:'testimony', label:'🙌 Testimonies',   color:'#0ea5e9' },
]

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.floor(d/60)}m ago`
  if (d < 86400) return `${Math.floor(d/3600)}h ago`
  return `${Math.floor(d/86400)}d ago`
}

function Avatar({ profile, size=40 }) {
  const init = (profile?.display_name || profile?.full_name || '?').charAt(0).toUpperCase()
  return profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
    : <div style={{width:size,height:size,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:size*0.38,flexShrink:0}}>{init}</div>
}

/* ── ThreadedReply component for Topics ── */
function ThreadedReply({ reply, depth=0, currentUserId, topicId, onReplyAdded, isAdmin }) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyText, setReplyText]       = useState('')
  const [sending, setSending]           = useState(false)
  const [childReplies, setChildReplies] = useState(reply.children || [])

  const submitReply = async () => {
    if (!replyText.trim() || sending || !currentUserId) return
    setSending(true)
    const { data } = await supabase.from('topic_replies').insert({
      topic_id: topicId,
      user_id: currentUserId,
      body: replyText.trim(),
      parent_id: reply.id,
    }).select('*, profiles(display_name,full_name,avatar_url)').single()
    if (data) {
      setChildReplies(c => [...c, { ...data, children: [] }])
      onReplyAdded && onReplyAdded()
    }
    setReplyText('')
    setSending(false)
    setShowReplyBox(false)
  }

  const deleteReply = async () => {
    if (!window.confirm('Delete this reply?')) return
    await supabase.from('topic_replies').delete().eq('id', reply.id)
    // Parent refreshes
    onReplyAdded && onReplyAdded()
  }

  const maxDepth = 3
  const indent = Math.min(depth, maxDepth) * 20

  return (
    <div style={{marginLeft: indent, borderLeft: depth > 0 ? '2px solid #f1f5f9' : 'none', paddingLeft: depth > 0 ? 14 : 0, marginTop: 10}}>
      <div style={{display:'flex', gap:10, alignItems:'flex-start'}}>
        <Avatar profile={reply.profiles} size={depth === 0 ? 34 : 28} />
        <div style={{flex:1}}>
          <div style={{background:'#f8fafc', borderRadius:12, padding:'10px 14px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:4}}>
              <span style={{fontWeight:700, fontSize:'0.82rem', color:'var(--text-dark)'}}>
                {reply.profiles?.display_name || reply.profiles?.full_name || 'Member'}
              </span>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <span style={{fontSize:'0.7rem', color:'var(--text-light)'}}>{timeAgo(reply.created_at)}</span>
                {(currentUserId === reply.user_id || isAdmin) && (
                  <button onClick={deleteReply} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'0.75rem',opacity:0.5,padding:'0 2px'}}>🗑</button>
                )}
              </div>
            </div>
            <p style={{margin:0, fontSize:'0.88rem', color:'var(--text-mid)', lineHeight:1.65, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{reply.body}</p>
          </div>
          {currentUserId && depth < maxDepth && (
            <button onClick={() => setShowReplyBox(s => !s)}
              style={{marginTop:4, background:'none', border:'none', cursor:'pointer', color:'var(--brand-light)', fontSize:'0.75rem', fontWeight:700, padding:'2px 0', fontFamily:'var(--font-body)'}}>
              {showReplyBox ? 'Cancel' : '↩ Reply'}
            </button>
          )}
          {showReplyBox && (
            <div style={{display:'flex', gap:8, marginTop:8}}>
              <input value={replyText} onChange={e=>setReplyText(e.target.value)}
                placeholder="Write a reply..."
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&submitReply()}
                autoFocus
                style={{flex:1, padding:'7px 12px', borderRadius:20, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.85rem', outline:'none'}} />
              <button onClick={submitReply} disabled={!replyText.trim()||sending}
                style={{padding:'7px 16px', borderRadius:20, background:'var(--brand-light)', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.78rem', opacity:!replyText.trim()?0.5:1}}>
                {sending ? '...' : 'Post'}
              </button>
            </div>
          )}
        </div>
      </div>
      {childReplies.map(child => (
        <ThreadedReply key={child.id} reply={child} depth={depth+1}
          currentUserId={currentUserId} topicId={topicId}
          onReplyAdded={onReplyAdded} isAdmin={isAdmin} />
      ))}
    </div>
  )
}

/* ── TopicCard component ── */
function TopicCard({ topic, currentUserId, isAdmin, onDelete, onOpen }) {
  const cat = TOPIC_CATEGORIES.find(c=>c.id===topic.category) || TOPIC_CATEGORIES[0]
  return (
    <div onClick={() => onOpen(topic)}
      style={{background:'var(--white, white)', borderRadius:16, boxShadow:'var(--shadow-sm)', border:'1px solid rgba(15,31,61,0.05)', marginBottom:14, cursor:'pointer', transition:'box-shadow 0.15s, transform 0.12s'}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 20px rgba(15,31,61,0.1)'; e.currentTarget.style.transform='translateY(-1px)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow-sm)'; e.currentTarget.style.transform='none'}}>
      <div style={{padding:'16px 20px 12px', display:'flex', gap:12, alignItems:'flex-start'}}>
        <Avatar profile={topic.profiles} size={42} />
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4}}>
            <span style={{fontSize:'0.7rem', fontWeight:700, padding:'2px 10px', borderRadius:20, background:cat.color+'18', color:cat.color}}>{cat.label}</span>
            <span style={{fontSize:'0.68rem', color:'var(--text-light)'}}>{timeAgo(topic.created_at)}</span>
          </div>
          <h3 style={{margin:'0 0 4px', fontSize:'1rem', fontWeight:800, color:'var(--text-dark)', lineHeight:1.35}}>{topic.title}</h3>
          <p style={{margin:0, fontSize:'0.85rem', color:'var(--text-mid)', lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{topic.body}</p>
        </div>
        {(currentUserId === topic.user_id || isAdmin) && (
          <button onClick={e=>{e.stopPropagation(); onDelete(topic.id)}}
            style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'1rem', opacity:0.45, padding:4, flexShrink:0}} title="Delete">🗑</button>
        )}
      </div>
      <div style={{padding:'8px 20px 14px', display:'flex', gap:16, alignItems:'center'}}>
        <span style={{fontSize:'0.8rem', color:'var(--text-light)', display:'flex', alignItems:'center', gap:4}}>
          <span style={{fontWeight:700, color:'var(--text-dark)'}}>{topic.profiles?.display_name||topic.profiles?.full_name||'Member'}</span>
        </span>
        <span style={{marginLeft:'auto', fontSize:'0.78rem', color:'var(--text-light)', display:'flex', alignItems:'center', gap:4}}>
          💬 {topic.reply_count || 0} {topic.reply_count === 1 ? 'reply' : 'replies'}
        </span>
      </div>
    </div>
  )
}

/* ── TopicDetailModal ── */
function TopicDetailModal({ topic, currentUserId, isAdmin, onClose, onTopicUpdated }) {
  const [replies, setReplies]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending]     = useState(false)
  const cat = TOPIC_CATEGORIES.find(c=>c.id===topic.category) || TOPIC_CATEGORIES[0]

  const loadReplies = async () => {
    const { data } = await supabase.from('topic_replies')
      .select('*, profiles(display_name,full_name,avatar_url)')
      .eq('topic_id', topic.id)
      .is('parent_id', null)
      .order('created_at')
    if (!data) { setLoading(false); return }

    // Fetch all nested replies for this topic
    const { data: allReplies } = await supabase.from('topic_replies')
      .select('*, profiles(display_name,full_name,avatar_url)')
      .eq('topic_id', topic.id)
      .not('parent_id', 'is', null)
      .order('created_at')

    // Build tree
    const replyMap = {}
    data.forEach(r => { replyMap[r.id] = { ...r, children: [] } })
    ;(allReplies || []).forEach(r => {
      if (replyMap[r.parent_id]) replyMap[r.parent_id].children.push({ ...r, children: [] })
    })
    setReplies(data.map(r => replyMap[r.id]))
    setLoading(false)
  }

  useEffect(() => { loadReplies() }, [topic.id])

  const submitTopLevelReply = async () => {
    if (!replyText.trim() || sending || !currentUserId) return
    setSending(true)
    await supabase.from('topic_replies').insert({
      topic_id: topic.id,
      user_id: currentUserId,
      body: replyText.trim(),
      parent_id: null,
    })
    setReplyText('')
    await loadReplies()
    onTopicUpdated && onTopicUpdated()
    setSending(false)
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:9990, padding:'20px 16px', overflowY:'auto'}}>
      <div style={{background:'var(--white, white)', borderRadius:20, width:'100%', maxWidth:680, boxShadow:'0 24px 80px rgba(0,0,0,0.3)', marginTop:60, marginBottom:40}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', borderRadius:'20px 20px 0 0', padding:'24px 24px 20px', position:'relative'}}>
          <button onClick={onClose}
            style={{position:'absolute', top:14, right:16, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, cursor:'pointer', fontSize:'1rem', color:'white', lineHeight:1, padding:'4px 10px', fontFamily:'var(--font-body)'}}>✕</button>
          <div style={{display:'flex', gap:12, alignItems:'flex-start', paddingRight:40}}>
            <Avatar profile={topic.profiles} size={44} />
            <div>
              <span style={{fontSize:'0.68rem', fontWeight:700, padding:'2px 10px', borderRadius:20, background:'rgba(255,255,255,0.15)', color:'white', display:'inline-block', marginBottom:8}}>{cat.label}</span>
              <h2 style={{fontFamily:'var(--font-display)', color:'white', fontSize:'1.2rem', margin:'0 0 4px', fontWeight:800, lineHeight:1.3}}>{topic.title}</h2>
              <div style={{fontSize:'0.75rem', color:'rgba(255,255,255,0.65)'}}>
                {topic.profiles?.display_name||topic.profiles?.full_name||'Member'} · {timeAgo(topic.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Original body */}
        <div style={{padding:'20px 24px', borderBottom:'1px solid #f1f5f9'}}>
          <p style={{margin:0, color:'var(--text-mid)', fontSize:'0.95rem', lineHeight:1.8, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{topic.body}</p>
        </div>

        {/* Replies */}
        <div style={{padding:'16px 24px'}}>
          <div style={{fontWeight:700, fontSize:'0.85rem', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14}}>
            💬 {replies.length} {replies.length===1?'Reply':'Replies'}
          </div>

          {loading && <div style={{textAlign:'center', padding:'30px', color:'var(--text-light)'}}>Loading replies…</div>}

          {!loading && replies.length === 0 && (
            <div style={{textAlign:'center', padding:'30px', color:'var(--text-light)', fontSize:'0.9rem'}}>
              No replies yet. Be the first to respond! 🙌
            </div>
          )}

          {replies.map(reply => (
            <ThreadedReply key={reply.id} reply={reply} depth={0}
              currentUserId={currentUserId} topicId={topic.id}
              onReplyAdded={loadReplies} isAdmin={isAdmin} />
          ))}

          {/* Top-level reply box */}
          {currentUserId ? (
            <div style={{display:'flex', gap:10, marginTop:20, paddingTop:16, borderTop:'1px solid #f1f5f9'}}>
              <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                placeholder="Share your thoughts…"
                rows={2}
                style={{flex:1, padding:'10px 14px', borderRadius:12, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', resize:'vertical', outline:'none', transition:'border-color 0.2s'}}
                onFocus={e=>e.target.style.borderColor='var(--brand-light)'}
                onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                onKeyDown={e=>e.key==='Enter'&&e.ctrlKey&&submitTopLevelReply()}
              />
              <button onClick={submitTopLevelReply} disabled={!replyText.trim()||sending}
                style={{padding:'10px 20px', borderRadius:12, background:'var(--brand-light)', color:'white', border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', alignSelf:'flex-end', opacity:!replyText.trim()?0.5:1, fontFamily:'var(--font-body)'}}>
                {sending ? '…' : 'Reply 🕊'}
              </button>
            </div>
          ) : (
            <div style={{marginTop:16, padding:'14px', background:'var(--brand-pale,#e8f5e9)', borderRadius:10, textAlign:'center', fontSize:'0.85rem', color:'var(--text-mid)'}}>
              Sign in to reply to this topic.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── New Topic Modal ── */
function NewTopicModal({ currentUser, profile, onClose, onCreated }) {
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [category, setCategory] = useState('general')
  const [posting, setPosting] = useState(false)
  const [err, setErr]         = useState('')

  const submit = async () => {
    if (!title.trim() || !body.trim() || posting) return
    if (title.trim().length < 10) { setErr('Title must be at least 10 characters.'); return }
    setErr('')
    setPosting(true)
    const { error } = await supabase.from('timeline_topics').insert({
      user_id: currentUser.id,
      title: title.trim(),
      body: body.trim(),
      category,
    })
    if (error) { setErr('Something went wrong. Please try again.'); setPosting(false); return }
    onCreated()
    onClose()
  }

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20}}>
      <div style={{background:'var(--white, white)', borderRadius:20, width:'100%', maxWidth:520, boxShadow:'0 24px 80px rgba(0,0,0,0.3)', overflow:'hidden'}}>
        <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'20px 24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{fontFamily:'var(--font-display)', color:'white', margin:0, fontSize:'1.15rem'}}>💬 Start a New Topic</h3>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, cursor:'pointer', color:'white', fontSize:'1rem', padding:'4px 10px'}}>✕</button>
          </div>
        </div>
        <div style={{padding:'24px'}}>
          {/* Category selector */}
          <div style={{marginBottom:18}}>
            <label style={{fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:8}}>Category</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {TOPIC_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)}
                  style={{padding:'5px 14px', borderRadius:20, border:`1.5px solid ${category===cat.id?cat.color:'#e2e8f0'}`, background:category===cat.id?cat.color+'15':'white', color:category===cat.id?cat.color:'var(--text-light)', fontSize:'0.78rem', fontWeight:category===cat.id?700:400, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s'}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6}}>Topic Title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="e.g. What does Proverbs 3:5-6 mean to you?"
              maxLength={120}
              style={{width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.92rem', outline:'none', color:'var(--text-dark)', boxSizing:'border-box', background:'var(--white, white)'}}
              onFocus={e=>e.target.style.borderColor='var(--brand-light)'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
            <div style={{textAlign:'right', fontSize:'0.72rem', color:'var(--text-light)', marginTop:4}}>{title.length}/120</div>
          </div>

          {/* Body */}
          <div style={{marginBottom:18}}>
            <label style={{fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6}}>Description</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)}
              placeholder="Give context or ask your question…"
              rows={4}
              style={{width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.92rem', outline:'none', color:'var(--text-dark)', resize:'vertical', boxSizing:'border-box', background:'var(--white, white)'}}
              onFocus={e=>e.target.style.borderColor='var(--brand-light)'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
          </div>

          {err && <div style={{background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.84rem', marginBottom:14}}>❌ {err}</div>}

          <div style={{display:'flex', gap:10}}>
            <button onClick={submit} disabled={!title.trim()||!body.trim()||posting}
              className="btn btn-blue" style={{flex:1, justifyContent:'center', padding:'12px', opacity:(!title.trim()||!body.trim())?0.5:1}}>
              {posting ? 'Posting…' : 'Create Topic 🕊'}
            </button>
            <button onClick={onClose} style={{padding:'12px 20px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)'}}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, currentUserId, onReact, onComment, onDelete, isAdmin, onReport, reportedByMe }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments]         = useState([])
  const [commentText, setCommentText]   = useState('')
  const [sending, setSending]           = useState(false)
  const postType = POST_TYPES.find(t=>t.id===post.post_type) || POST_TYPES[0]
  const amenCount = post.reactions?.filter(r=>r.type==='amen').length || 0
  const loveCount = post.reactions?.filter(r=>r.type==='love').length || 0
  const myAmen = post.reactions?.some(r=>r.type==='amen'&&r.user_id===currentUserId)
  const myLove = post.reactions?.some(r=>r.type==='love'&&r.user_id===currentUserId)

  const loadComments = async () => {
    const { data } = await supabase.from('timeline_comments')
      .select('*, profiles(display_name,full_name,avatar_url)')
      .eq('post_id', post.id).order('created_at')
    setComments(data||[])
  }

  const toggleComments = () => { if (!showComments) loadComments(); setShowComments(s=>!s) }

  const submitComment = async () => {
    if (!commentText.trim()||sending) return
    setSending(true)
    await supabase.from('timeline_comments').insert({ post_id:post.id, user_id:currentUserId, body:commentText.trim() })
    setCommentText('')
    await loadComments()
    setSending(false)
  }

  return (
    <div style={{background: 'var(--white, white)',borderRadius:16,boxShadow:'var(--shadow-sm)',overflow:'hidden',border:'1px solid rgba(15,31,61,0.05)',marginBottom:16}}>
      {post.pinned && (
        <div style={{background:'linear-gradient(90deg,#fef3c7,#fffbeb)',padding:'6px 18px',fontSize:'0.75rem',fontWeight:700,color:'#92400e',display:'flex',alignItems:'center',gap:6}}>
          📌 Pinned by admin
        </div>
      )}
      <div style={{padding:'16px 20px 12px',display:'flex',alignItems:'flex-start',gap:12}}>
        <Avatar profile={post.profiles} size={44} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:700,color:'var(--text-dark)',fontSize:'0.95rem'}}>{post.profiles?.display_name||post.profiles?.full_name||'Member'}</span>
            <span style={{fontSize:'0.7rem',fontWeight:700,padding:'2px 10px',borderRadius:20,background:postType.color+'18',color:postType.color}}>{postType.label}</span>
          </div>
          <div style={{fontSize:'0.72rem',color:'var(--text-light)',marginTop:2}}>{timeAgo(post.created_at)}</div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
          {currentUserId && currentUserId !== post.user_id && !isAdmin && (
            <button onClick={()=>onReport(post)} title={reportedByMe?'Already reported':'Report post'}
              style={{color:reportedByMe?'#f59e0b':'var(--text-light)',background:'none',border:'none',cursor:reportedByMe?'default':'pointer',fontSize:'0.9rem',opacity:reportedByMe?0.8:0.4,padding:4,flexShrink:0}}>
              🚩
            </button>
          )}
          {(currentUserId===post.user_id||isAdmin)&&(
            <button onClick={()=>onDelete(post.id)} style={{color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',opacity:0.5,padding:4,flexShrink:0}} title="Delete">🗑</button>
          )}
        </div>
      </div>

      <div style={{padding:'0 20px 14px'}}>
        <p style={{lineHeight:1.8,color:'var(--text-mid)',fontSize:'0.95rem',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0}}>{post.body}</p>
      </div>

      <div style={{padding:'10px 20px 14px',borderTop:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>onReact(post.id,'amen')} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:30,border:`1.5px solid ${myAmen?'var(--brand-light)':'#e2e8f0'}`,background:myAmen?'var(--brand-pale)':'white',color:myAmen?'var(--brand-light)':'var(--text-light)',cursor:'pointer',fontSize:'0.82rem',fontWeight:myAmen?700:400,transition:'all 0.15s',fontFamily:'var(--font-body)'}}>
          🙏 <span>{amenCount>0?amenCount:''} Amen</span>
        </button>
        <button onClick={()=>onReact(post.id,'love')} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:30,border:`1.5px solid ${myLove?'#ef4444':'#e2e8f0'}`,background:myLove?'#fff5f5':'white',color:myLove?'#ef4444':'var(--text-light)',cursor:'pointer',fontSize:'0.82rem',fontWeight:myLove?700:400,transition:'all 0.15s',fontFamily:'var(--font-body)'}}>
          ❤️ <span>{loveCount>0?loveCount:''} Love</span>
        </button>
        <button onClick={toggleComments} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:30,border:'1.5px solid #e2e8f0',background:showComments?'var(--brand-pale)':'white',color:showComments?'var(--brand-light)':'var(--text-light)',cursor:'pointer',fontSize:'0.82rem',fontFamily:'var(--font-body)'}}>
          💬 {post.comment_count>0?post.comment_count:''} Comment{post.comment_count!==1?'s':''}
        </button>
      </div>

      {showComments&&(
        <div style={{borderTop:'1px solid #f1f5f9',padding:'14px 20px'}}>
          {comments.map(c=>(
            <div key={c.id} style={{display:'flex',gap:10,marginBottom:12}}>
              <Avatar profile={c.profiles} size={32} />
              <div style={{flex:1,background:'#f8fafc',borderRadius:10,padding:'8px 12px'}}>
                <div style={{fontWeight:700,fontSize:'0.8rem',color:'var(--text-dark)',marginBottom:3}}>{c.profiles?.display_name||c.profiles?.full_name||'Member'}</div>
                <div style={{fontSize:'0.88rem',color:'var(--text-mid)',lineHeight:1.65}}>{c.body}</div>
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <Avatar profile={null} size={32} />
            <div style={{flex:1,display:'flex',gap:8}}>
              <input value={commentText} onChange={e=>setCommentText(e.target.value)}
                placeholder="Write a comment..."
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&submitComment()}
                style={{flex:1,padding:'8px 14px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',outline:'none'}} />
              <button onClick={submitComment} disabled={!commentText.trim()||sending}
                style={{padding:'8px 18px',borderRadius:30,background:'var(--brand-light)',color:'white',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:700,fontSize:'0.82rem',opacity:!commentText.trim()?0.5:1}}>
                {sending?'...':'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Auth modal ── */
function AuthModal({ onClose }) {
  const { signIn, signUp, verifyOtp, resendOtp } = useAuth()

  // 'signin' | 'signup' | 'verify'
  const [mode, setMode]       = useState('signin')
  const [step, setStep]       = useState(1) // signup: 1=creds, 2=profile, 3=otp
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')

  // Profile fields (step 2)
  const [fullName, setFullName]   = useState('')
  const [branch, setBranch]       = useState('')
  const [branches, setBranches]   = useState([])
  const [notListed, setNotListed] = useState(false)
  const [unlistedName, setUnlistedName] = useState('')
  const [unlistedCity, setUnlistedCity] = useState('')
  const [phone, setPhone]         = useState('')
  const [location, setLocation]   = useState('')
  const [occupation, setOccupation] = useState('')
  const [gender, setGender]       = useState('')
  const [churchPost, setChurchPost] = useState('')
  const [birthday, setBirthday]   = useState('')

  // OTP (step 3)
  const [otp, setOtp]           = useState(['','','','','',''])
  const otpRefs                 = Array.from({length:6}, () => useRef(null))
  const [resendCooldown, setResendCooldown] = useState(0)

  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)

  // Load branches on mount
  useEffect(() => {
    supabase.from('church_branches').select('id,name,location').eq('active', true).order('name')
      .then(({ data }) => setBranches(data || []))
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const otpValue = otp.join('')

  const handleOtpInput = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = digit
    setOtp(next)
    if (digit && i < 5) otpRefs[i + 1].current?.focus()
    if (!digit && i > 0) otpRefs[i - 1].current?.focus()
  }

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (text.length === 6) {
      setOtp(text.split(''))
      otpRefs[5].current?.focus()
    }
    e.preventDefault()
  }

  // Step 1: credentials
  const handleCredsNext = async e => {
    e.preventDefault(); setErr('')
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (pass !== confirm) { setErr('Passwords do not match.'); return }
    setStep(2)
  }

  // Step 2: profile → trigger signup + send OTP
  const handleProfileNext = async e => {
    e.preventDefault(); setErr('')
    if (!fullName.trim()) { setErr('Full name is required.'); return }
    if (!gender) { setErr('Please select your gender.'); return }
    if (!notListed && !branch) { setErr('Please select your church branch.'); return }
    if (notListed && !unlistedName.trim()) { setErr('Please enter your branch name.'); return }
    setLoading(true)

    // Auto-assign church_title for Brother/Sister only
    // All ordained titles require admin approval
    const ORDAINED = ['Deacon','Deaconess','Elder','Evangelist','Prophet','Pastor','Apostle']
    const selectedPost = churchPost || (gender === 'Female' ? 'Sister' : 'Brother')
    const isAutoApproved = !ORDAINED.includes(selectedPost)

    const profileData = {
      fullName: fullName.trim(),
      church_branch: notListed ? `[Unlisted] ${unlistedName.trim()}` : branch,
      gender,
      ...(isAutoApproved
        ? { church_title: selectedPost }
        : { pending_church_post: selectedPost }
      ),
      ...(phone && { phone }),
      ...(location && { location }),
      ...(occupation && { occupation }),
      ...(birthday && { birthday }),
      ...(notListed && { unlisted_branch: { name: unlistedName.trim(), city: unlistedCity.trim() } }),
    }
    const error = await signUp(email, pass, profileData)
    if (error) { setErr(error.message); setLoading(false); return }
    setStep(3)
    setResendCooldown(60)
    setLoading(false)
  }

  // Step 3: verify OTP
  const handleVerify = async e => {
    e.preventDefault(); setErr('')
    if (otpValue.length < 6) { setErr('Please enter the full 6-digit code.'); return }
    setLoading(true)
    const error = await verifyOtp(email, otpValue)
    if (error) { setErr('Invalid or expired code. Please try again.'); setLoading(false); return }
    // Flag new user so Timeline shows guidelines popup
    sessionStorage.setItem('ccgm_new_user_guides', '1')
    onClose()
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setErr('')
    const error = await resendOtp(email)
    if (error) setErr(error.message)
    else setResendCooldown(60)
  }

  // Sign in
  const handleSignIn = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    const error = await signIn(email, pass)
    if (error) setErr(error.message)
    else onClose()
    setLoading(false)
  }

  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }
  const card = { background:'var(--white, white)', borderRadius:22, padding:'32px 28px', width:'100%', maxWidth:440, boxShadow:'0 24px 80px rgba(0,0,0,0.3)', position:'relative', maxHeight:'92vh', overflowY:'auto' }
  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:'0.92rem', fontFamily:'var(--font-body)', outline:'none', color:'var(--text-dark)', boxSizing:'border-box', background:'var(--white, white)' }
  const label = { fontSize:'0.72rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:5 }

  const Header = ({ title, sub }) => (
    <div style={{textAlign:'center', marginBottom:24}}>
      <div style={{width:50,height:50,borderRadius:14,background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.3rem',margin:'0 auto 12px'}}>🌐</div>
      <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.35rem',margin:'0 0 4px'}}>{title}</h2>
      <p style={{color:'var(--text-light)',fontSize:'0.83rem',margin:0}}>{sub}</p>
    </div>
  )

  const ErrBox = () => err ? (
    <div style={{background:'#fff5f5',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',color:'#dc2626',fontSize:'0.84rem',marginBottom:14}}>❌ {err}</div>
  ) : null

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={card}>
        <button onClick={onClose} style={{position:'absolute',top:14,right:16,background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--text-light)',lineHeight:1}}>✕</button>

        {/* ── SIGN IN ── */}
        {mode === 'signin' && (
          <>
            <Header title="Welcome Back" sub="Sign in to your CCG World account" />
            <form onSubmit={handleSignIn}>
              <div style={{marginBottom:14}}>
                <label style={label}>Email</label>
                <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:20}}>
                <label style={label}>Password</label>
                <input style={inputStyle} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <ErrBox />
              <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px',marginBottom:16}} disabled={loading}>
                {loading ? '⏳ Signing in…' : 'Sign In →'}
              </button>
            </form>
            <div style={{textAlign:'center',fontSize:'0.84rem',color:'var(--text-light)'}}>
              Don't have an account?{' '}
              <button onClick={()=>{setMode('signup');setStep(1);setErr('')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--brand-light)',fontWeight:700,fontFamily:'var(--font-body)',fontSize:'0.84rem'}}>Sign Up</button>
            </div>
          </>
        )}

        {/* ── SIGNUP STEP 1 ── */}
        {mode === 'signup' && step === 1 && (
          <>
            <Header title="Join CCG World" sub="Step 1 of 3 — Create your login" />
            <div style={{display:'flex',gap:6,marginBottom:22}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=step?'var(--brand-base)':'#e2e8f0',transition:'background 0.3s'}} />
              ))}
            </div>
            <form onSubmit={handleCredsNext}>
              <div style={{marginBottom:14}}>
                <label style={label}>Email</label>
                <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:14}}>
                <label style={label}>Password</label>
                <input style={inputStyle} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Min 6 characters" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:20}}>
                <label style={label}>Confirm Password</label>
                <input style={inputStyle} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <ErrBox />
              <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px',marginBottom:16}}>
                Continue →
              </button>
            </form>
            <div style={{textAlign:'center',fontSize:'0.84rem',color:'var(--text-light)'}}>
              Already have an account?{' '}
              <button onClick={()=>{setMode('signin');setErr('')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--brand-light)',fontWeight:700,fontFamily:'var(--font-body)',fontSize:'0.84rem'}}>Sign In</button>
            </div>
          </>
        )}

        {/* ── SIGNUP STEP 2 ── */}
        {mode === 'signup' && step === 2 && (
          <>
            <Header title="Your Profile" sub="Step 2 of 3 — Tell us about yourself" />
            <div style={{display:'flex',gap:6,marginBottom:22}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=step?'var(--brand-base)':'#e2e8f0',transition:'background 0.3s'}} />
              ))}
            </div>
            <form onSubmit={handleProfileNext}>
              <div style={{marginBottom:14}}>
                <label style={label}>Full Name</label>
                <input style={inputStyle} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Grace Okonkwo" required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:14}}>
                <label style={label}>Gender</label>
                <select style={{...inputStyle}} value={gender} onChange={e=>setGender(e.target.value)} required
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                  <option value="">Select gender…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div style={{marginBottom:6}}>
                <label style={label}>Church Branch</label>
                {!notListed ? (
                  <select style={{...inputStyle}} value={branch} onChange={e=>setBranch(e.target.value)}
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                    <option value="">Select your branch…</option>
                    {branches.map(b=><option key={b.id} value={b.name}>{b.name}{b.location?` — ${b.location}`:''}</option>)}
                  </select>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <input style={inputStyle} value={unlistedName} onChange={e=>setUnlistedName(e.target.value)} placeholder="Branch name" required
                      onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    <input style={inputStyle} value={unlistedCity} onChange={e=>setUnlistedCity(e.target.value)} placeholder="City / Country (optional)"
                      onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                )}
                <button type="button"
                  onClick={() => { setNotListed(v=>!v); setBranch(''); setUnlistedName(''); setUnlistedCity('') }}
                  style={{marginTop:6, background:'none', border:'none', cursor:'pointer', color:'var(--brand-light)', fontSize:'0.8rem', fontFamily:'var(--font-body)', fontWeight:600, padding:0}}>
                  {notListed ? '← Back to branch list' : '🔍 My branch isn\'t listed'}
                </button>
                {notListed && (
                  <div style={{fontSize:'0.77rem',color:'var(--text-light)',marginTop:4,lineHeight:1.5}}>
                    ℹ️ Your branch info will be sent to admins for review and possible addition.
                  </div>
                )}
              </div>

              <div style={{display:'flex',alignItems:'center',gap:10,margin:'18px 0 14px'}}>
                <div style={{flex:1,height:1,background:'#e2e8f0'}} />
                <span style={{fontSize:'0.72rem',color:'var(--text-light)',fontWeight:600}}>OPTIONAL</span>
                <div style={{flex:1,height:1,background:'#e2e8f0'}} />
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={label}>Phone</label>
                  <input style={inputStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 555 000 0000"
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>
                <div>
                  <label style={label}>Birthday</label>
                  <input style={inputStyle} type="date" value={birthday} onChange={e=>setBirthday(e.target.value)}
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={label}>Location / City</label>
                <input style={inputStyle} value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Accra, Ghana"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:20}}>
                <label style={label}>Occupation</label>
                <input style={inputStyle} value={occupation} onChange={e=>setOccupation(e.target.value)} placeholder="e.g. Teacher, Engineer…"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>

              <ErrBox />
              <div style={{display:'flex',gap:10}}>
                <button type="button" onClick={()=>{setStep(1);setErr('')}}
                  style={{padding:'11px 18px',borderRadius:10,border:'1.5px solid #e2e8f0',background:'transparent',color:'var(--text-mid)',fontWeight:600,fontSize:'0.88rem',fontFamily:'var(--font-body)',cursor:'pointer'}}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-blue" style={{flex:1,justifyContent:'center',padding:'12px'}} disabled={loading}>
                  {loading ? '⏳ Creating account…' : 'Create Account →'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── SIGNUP STEP 3: OTP Verification ── */}
        {mode === 'signup' && step === 3 && (
          <>
            <Header title="Verify Your Email" sub={`We sent a 6-digit code to ${email}`} />
            <div style={{display:'flex',gap:6,marginBottom:22}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:'var(--brand-base)',transition:'background 0.3s'}} />
              ))}
            </div>

            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:'2.8rem',marginBottom:8}}>📧</div>
              <p style={{color:'var(--text-mid)',fontSize:'0.88rem',lineHeight:1.6,margin:0}}>
                Check your inbox for a 6-digit verification code.<br/>
                <span style={{fontSize:'0.8rem',color:'var(--text-light)'}}>It may take a minute. Check your spam folder too.</span>
              </p>
            </div>

            <form onSubmit={handleVerify}>
              <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:20}}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    value={digit}
                    onChange={e=>handleOtpInput(i, e.target.value)}
                    onPaste={i===0?handleOtpPaste:undefined}
                    onKeyDown={e=>{ if(e.key==='Backspace'&&!digit&&i>0) otpRefs[i-1].current?.focus() }}
                    maxLength={1}
                    inputMode="numeric"
                    style={{
                      width:44, height:54, textAlign:'center', fontSize:'1.4rem', fontWeight:700,
                      borderRadius:10, border:`2px solid ${digit?'var(--brand-base)':'#e2e8f0'}`,
                      background:'var(--white, white)', color:'var(--text-dark)',
                      outline:'none', transition:'border-color 0.2s', fontFamily:'var(--font-body)',
                    }}
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'}
                    onBlur={e=>e.target.style.borderColor=digit?'var(--brand-base)':'#e2e8f0'}
                  />
                ))}
              </div>

              <ErrBox />
              <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px',marginBottom:12}} disabled={loading||otpValue.length<6}>
                {loading ? '⏳ Verifying…' : '✅ Verify & Join →'}
              </button>
            </form>

            <div style={{textAlign:'center'}}>
              <button onClick={handleResend} disabled={resendCooldown>0}
                style={{background:'none',border:'none',cursor:resendCooldown>0?'default':'pointer',color:resendCooldown>0?'var(--text-light)':'var(--brand-light)',fontSize:'0.84rem',fontFamily:'var(--font-body)',fontWeight:600}}>
                {resendCooldown>0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

/* ── Profile edit modal ── */
function ProfileModal({ profile, onClose, onUpdate }) {
  const [name, setName]   = useState(profile?.display_name || profile?.full_name || '')
  const [bio, setBio]     = useState(profile?.bio || '')
  const [avatar, setAvatar] = useState(profile?.avatar_url || '')
  const [saving, setSaving] = useState(false)

  const save = async e => {
    e.preventDefault(); setSaving(true)
    await onUpdate({ display_name: name, bio, avatar_url: avatar })
    onClose(); setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
      <div style={{background: 'var(--white, white)',borderRadius:18,padding:'28px 28px',width:'100%',maxWidth:400,boxShadow:'var(--shadow-lg)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <h3 style={{margin:0,color:'var(--brand-deep)',fontFamily:'var(--font-display)'}}>Edit Profile</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--text-light)'}}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="form-group"><label>Display Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="form-group"><label>Avatar URL</label><input value={avatar} onChange={e=>setAvatar(e.target.value)} placeholder="https://..." /></div>
          <div className="form-group"><label>Bio</label><textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} placeholder="Tell the community about yourself..." style={{resize:'vertical'}} /></div>
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button type="submit" className="btn btn-blue" style={{flex:1,justifyContent:'center'}} disabled={saving}>{saving?'Saving...':'Save Changes'}</button>
            <button type="button" className="btn btn-outline-blue" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   Main Timeline Page
══════════════════════════════════════════ */
export default function Timeline() {
  const { user, profile, loading: authLoading, signOut, isAdmin, updateProfile } = useAuth()

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('feed') // 'feed' | 'topics'

  // ── Feed state ──
  const [posts, setPosts]         = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [body, setBody]           = useState('')
  const [postType, setPostType]   = useState('update')
  const [posting, setPosting]     = useState(false)
  const [feedFilter, setFeedFilter] = useState('all') // 'all' | post_type ids
  const listRef = useRef(null)

  // ── Topics state ──
  const [topics, setTopics]         = useState([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicFilter, setTopicFilter] = useState('all')
  const [openTopic, setOpenTopic]   = useState(null)
  const [showNewTopic, setShowNewTopic] = useState(false)
  const [userPostCount, setUserPostCount] = useState(0)

  // ── Shared state ──
  const [showAuth, setShowAuth]     = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [guidesBannerDismissed, setGuidesBannerDismissed] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem('ccgm_guides_dismissed')
  )
  const [showNewUserGuides, setShowNewUserGuides] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem('ccgm_new_user_guides')
  )

  // ── Report state ──
  const [reportPost, setReportPost]       = useState(null)
  const [reportReason, setReportReason]   = useState('')
  const [reportOther, setReportOther]     = useState('')
  const [reportSending, setReportSending] = useState(false)
  const [reportDone, setReportDone]       = useState(false)
  const [myReports, setMyReports]         = useState([])

  const REPORT_REASONS = [
    'Spam or irrelevant content',
    'Inappropriate or offensive content',
    'Harassment or bullying',
    'False information / misinformation',
    'Other',
  ]

  const canPost = !!user
  const canCreateTopic = !!user && (isAdmin || userPostCount >= 3)

  // ── Data loaders ──
  const loadPosts = async () => {
    const { data } = await supabase.from('timeline_posts')
      .select('*, profiles(display_name,full_name,avatar_url), reactions:timeline_reactions(*)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
    setFeedLoading(false)
  }

  const loadTopics = async () => {
    const { data } = await supabase.from('timeline_topics')
      .select('*, profiles(display_name,full_name,avatar_url), reply_count:topic_replies(count)')
      .order('created_at', { ascending: false })
      .limit(60)
    // Flatten reply_count from [{count:N}] → N
    const normalized = (data || []).map(t => ({
      ...t,
      reply_count: t.reply_count?.[0]?.count ?? 0,
    }))
    setTopics(normalized)
    setTopicsLoading(false)
  }

  const loadMyReports = async () => {
    if (!user) return
    const { data } = await supabase.from('post_reports')
      .select('post_id').eq('reporter_id', user.id)
    setMyReports((data || []).map(r => r.post_id))
  }

  const loadUserPostCount = async () => {
    if (!user) return
    const { count } = await supabase.from('timeline_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setUserPostCount(count || 0)
  }

  useEffect(() => {
    loadPosts()
    loadTopics()
    loadMyReports()
    loadUserPostCount()
  }, [user])

  // Realtime for feed
  useEffect(() => {
    const sub = supabase.channel('timeline')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // Realtime for topics
  useEffect(() => {
    const sub = supabase.channel('topics')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'timeline_topics' }, () => loadTopics())
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'timeline_topics' }, () => loadTopics())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // ── Feed actions ──
  const submitPost = async () => {
    if (!body.trim() || posting || !canPost) return
    setPosting(true)
    await supabase.from('timeline_posts').insert({ user_id: user.id, body: body.trim(), post_type: postType })
    setBody('')
    await loadPosts()
    await loadUserPostCount()
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setPosting(false)
  }

  const handleReact = async (postId, type) => {
    if (!user || !canPost) return
    const post = posts.find(p=>p.id===postId)
    const existing = post?.reactions?.find(r=>r.user_id===user.id&&r.type===type)
    if (existing) await supabase.from('timeline_reactions').delete().eq('id', existing.id)
    else await supabase.from('timeline_reactions').insert({ post_id: postId, user_id: user.id, type })
    await loadPosts()
  }

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return
    const post = posts.find(p => p.id === postId)
    await supabase.from('timeline_reactions').delete().eq('post_id', postId)
    await supabase.from('timeline_comments').delete().eq('post_id', postId)
    await supabase.from('timeline_posts').delete().eq('id', postId)
    if (post && post.user_id !== user?.id) {
      const authorName = post.profiles?.display_name || post.profiles?.full_name || 'member'
      auditLog('timeline_delete', `Deleted timeline post by ${authorName}`, authorName)
    }
    setPosts(p => p.filter(x => x.id !== postId))
  }

  const handleReport = (post) => {
    if (!user) { setShowAuth(true); return }
    setReportPost(post)
    setReportReason('')
    setReportOther('')
    setReportDone(false)
  }

  const submitReport = async () => {
    if (!reportReason || !reportPost || !user) return
    setReportSending(true)
    const reason = reportReason === 'Other' ? (reportOther.trim() || 'Other') : reportReason
    const { error } = await supabase.from('post_reports').insert({
      post_id:     reportPost.id,
      reporter_id: user.id,
      reason,
    })
    if (error) { setReportSending(false); return }
    setMyReports(r => [...r, reportPost.id])
    const { count } = await supabase.from('post_reports')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', reportPost.id)
    if (count >= 10) {
      const authorId = reportPost.user_id
      const now = new Date().toISOString()
      const reason_text = `Auto-suspended: post received ${count} reports`
      await supabase.from('profiles').update({
        suspended: true, suspended_at: now, suspension_reason: reason_text,
        suspension_expires_at: null, auto_suspended: true,
      }).eq('id', authorId)
      await supabase.from('suspension_logs').insert({
        user_id: authorId, action: 'auto_suspended', reason: reason_text,
        post_id: reportPost.id, created_at: now,
      })
      const authorName = reportPost.profiles?.display_name || reportPost.profiles?.full_name || 'Member'
      auditLog('suspend', reason_text, authorName)
      try {
        await supabase.functions.invoke('send-suspension-email', {
          body: {
            type: 'auto_suspension_admin_alert', authorName,
            postBody: reportPost.body?.slice(0, 120), reportCount: count,
            adminPanelUrl: 'https://ccgm-pwa.vercel.app/admin',
          }
        })
      } catch(_) {}
    }
    setReportSending(false)
    setReportDone(true)
  }

  // ── Topic actions ──
  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Delete this topic and all its replies?')) return
    await supabase.from('topic_replies').delete().eq('topic_id', topicId)
    await supabase.from('timeline_topics').delete().eq('id', topicId)
    setTopics(t => t.filter(x => x.id !== topicId))
  }

  // ── Filtered lists ──
  const filteredPosts = feedFilter === 'all'
    ? posts
    : posts.filter(p => p.post_type === feedFilter)

  const filteredTopics = topicFilter === 'all'
    ? topics
    : topics.filter(t => t.category === topicFilter)

  if (authLoading) return <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>⏳</div>

  return (
    <>
      <SEO
        title="Community Timeline"
        description="CCG World Community Timeline — connect with members of the Christian Church Of God Mission worldwide."
        path="/timeline"
      />

      {/* ── Page header ── */}
      <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(90px,14vw,110px) 5% 0',marginBottom:0}}>
        <div className="container" style={{maxWidth:760}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:16,marginBottom:24}}>
            <div>
              <span style={{fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.22em',textTransform:'uppercase',color:'var(--gold)',display:'block',marginBottom:8}}>Members Community</span>
              <h1 style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'clamp(1.8rem,4vw,2.8rem)',color:'white',lineHeight:1.1,margin:'0 0 8px'}}>🌐 Timeline</h1>
              <p style={{color:'rgba(255,255,255,0.65)',fontSize:'0.9rem',margin:0}}>Share testimonies, updates, and prayer requests with the CCG World family</p>
            </div>
            {user ? (
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <button onClick={()=>setShowProfile(true)} style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:40,padding:'8px 18px',cursor:'pointer',color:'white',fontFamily:'var(--font-body)',fontWeight:600,fontSize:'0.85rem'}}>
                  <Avatar profile={profile} size={28} />
                  {profile?.display_name||profile?.full_name||'Me'}
                </button>
                <button onClick={signOut} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,padding:'8px 14px',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.8rem'}}>Sign out</button>
              </div>
            ) : (
              <button onClick={()=>setShowAuth(true)} className="btn btn-gold" style={{padding:'10px 24px'}}>🌐 Join Community</button>
            )}
          </div>

          {/* ── Tab bar (inside hero, flush to bottom) ── */}
          <div style={{display:'flex', gap:0, borderBottom:'none'}}>
            {[
              { id:'feed',   label:'📰 Feed' },
              { id:'topics', label:'💬 Topics' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding:'10px 26px', border:'none', cursor:'pointer',
                  fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.9rem',
                  background: activeTab===tab.id ? 'white' : 'transparent',
                  color: activeTab===tab.id ? 'var(--brand-deep)' : 'rgba(255,255,255,0.65)',
                  borderRadius: activeTab===tab.id ? '10px 10px 0 0' : '10px 10px 0 0',
                  transition:'all 0.2s',
                  borderBottom: activeTab===tab.id ? '2px solid white' : '2px solid transparent',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{maxWidth:720, padding:'28px 5% 80px'}}>

        {/* ════════════════════════════════
            FEED TAB
        ════════════════════════════════ */}
        {activeTab === 'feed' && (
          <>
            {/* Feed filter bar */}
            <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
              {[{id:'all',label:'🌐 All'},...POST_TYPES].map(f => (
                <button key={f.id} onClick={()=>setFeedFilter(f.id)}
                  style={{padding:'5px 16px', borderRadius:20, border:`1.5px solid ${feedFilter===f.id?(f.color||'var(--brand-light)'):'#e2e8f0'}`, background:feedFilter===f.id?(f.color||'var(--brand-light)')+'15':'white', color:feedFilter===f.id?(f.color||'var(--brand-light)'):'var(--text-light)', fontSize:'0.78rem', fontWeight:feedFilter===f.id?700:400, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s'}}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Compose box */}
            {canPost && (
              <div style={{background:'var(--white, white)',borderRadius:16,boxShadow:'var(--shadow-sm)',padding:'20px',marginBottom:24,border:'1px solid rgba(15,31,61,0.05)'}}>
                <div style={{display:'flex',gap:12,marginBottom:14}}>
                  <Avatar profile={profile} size={44} />
                  <textarea
                    value={body}
                    onChange={e=>setBody(e.target.value)}
                    placeholder={`Share something with the CCG World family, ${profile?.display_name||profile?.full_name?.split(' ')[0]||'friend'}...`}
                    style={{flex:1,border:'1.5px solid #e2e8f0',borderRadius:12,padding:'12px 14px',fontFamily:'var(--font-body)',fontSize:'0.95rem',resize:'none',outline:'none',lineHeight:1.65,minHeight:80,transition:'border-color 0.2s'}}
                    onFocus={e=>e.target.style.borderColor='var(--brand-light)'}
                    onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                  />
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                  <div style={{display:'flex',gap:6}}>
                    {POST_TYPES.map(pt=>(
                      <button key={pt.id} onClick={()=>setPostType(pt.id)} style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${postType===pt.id?pt.color:'#e2e8f0'}`,background:postType===pt.id?pt.color+'15':'white',color:postType===pt.id?pt.color:'var(--text-light)',fontSize:'0.78rem',fontWeight:postType===pt.id?700:400,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all 0.15s'}}>
                        {pt.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={submitPost} disabled={!body.trim()||posting} className="btn btn-blue" style={{padding:'9px 24px',fontSize:'0.85rem',opacity:!body.trim()?0.5:1}}>
                    {posting?'Posting...':'Share 🕊'}
                  </button>
                </div>
              </div>
            )}

            {/* Sign in prompt */}
            {!user && (
              <div style={{background:'linear-gradient(135deg,var(--brand-pale),white)',border:'1.5px solid #bfdbfe',borderRadius:16,padding:'24px',textAlign:'center',marginBottom:24}}>
                <div style={{fontSize:'2rem',marginBottom:10}}>🌐</div>
                <h3 style={{color:'var(--brand-deep)',margin:'0 0 8px',fontFamily:'var(--font-display)'}}>Join the CCG World Family</h3>
                <p style={{color:'var(--text-mid)',fontSize:'0.9rem',marginBottom:20,lineHeight:1.7}}>Create a free account to post testimonies, share prayer requests, and connect with other members.</p>
                <button onClick={()=>setShowAuth(true)} className="btn btn-blue" style={{padding:'11px 28px'}}>Sign Up — It's Free</button>
              </div>
            )}

            {/* Posts */}
            <div ref={listRef}>
              {/* Community Guidelines Banner */}
              {!guidesBannerDismissed && (
                <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', borderRadius:14, padding:'16px 20px', marginBottom:18, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <span style={{ fontSize:'1.4rem', flexShrink:0 }}>📖</span>
                  <div style={{ flex:1, minWidth:180 }}>
                    <div style={{ fontWeight:700, color:'white', fontSize:'0.92rem', marginBottom:3 }}>Community Guidelines</div>
                    <div style={{ color:'rgba(255,255,255,0.72)', fontSize:'0.8rem', lineHeight:1.5 }}>
                      Keep this a Spirit-filled space. Read our guidelines to understand what's welcome here.
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <Link to="/guidelines" style={{ padding:'7px 16px', borderRadius:20, background:'rgba(255,255,255,0.15)', color:'white', textDecoration:'none', fontSize:'0.78rem', fontWeight:700, border:'1px solid rgba(255,255,255,0.25)', backdropFilter:'blur(8px)' }}>
                      Read Guidelines →
                    </Link>
                    <button onClick={() => { sessionStorage.setItem('ccgm_guides_dismissed','1'); setGuidesBannerDismissed(true) }}
                      style={{ padding:'7px 12px', borderRadius:20, background:'none', color:'rgba(255,255,255,0.6)', border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {feedLoading && (
                <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
                  <div style={{fontSize:'2rem',marginBottom:12,animation:'pulse 1.5s infinite'}}>🌐</div>
                  Loading timeline...
                </div>
              )}
              {!feedLoading && filteredPosts.length===0 && (
                <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
                  <div style={{fontSize:'2.5rem',marginBottom:14}}>🕊</div>
                  <h3 style={{color:'var(--brand-deep)',marginBottom:8}}>
                    {feedFilter==='all' ? 'The Timeline is empty' : `No ${POST_TYPES.find(t=>t.id===feedFilter)?.label||''} posts yet`}
                  </h3>
                  <p>Be the first to share!</p>
                </div>
              )}
              {filteredPosts.map(post=>(
                <PostCard key={post.id} post={post} currentUserId={user?.id} onReact={handleReact} onDelete={handleDelete} isAdmin={isAdmin} onReport={handleReport} reportedByMe={myReports.includes(post.id)} />
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════
            TOPICS TAB
        ════════════════════════════════ */}
        {activeTab === 'topics' && (
          <>
            {/* Topics header row */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12}}>
              <div>
                <h2 style={{fontFamily:'var(--font-display)', fontSize:'1.15rem', color:'var(--text-dark)', margin:'0 0 2px', fontWeight:800}}>Community Topics</h2>
                <p style={{margin:0, fontSize:'0.8rem', color:'var(--text-light)'}}>Start discussions, ask questions, dig into the Word</p>
              </div>
              {canCreateTopic ? (
                <button onClick={()=>setShowNewTopic(true)} className="btn btn-blue" style={{padding:'9px 20px', fontSize:'0.85rem'}}>
                  + New Topic
                </button>
              ) : user ? (
                <div style={{fontSize:'0.78rem', color:'var(--text-light)', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 14px', maxWidth:220, lineHeight:1.5}}>
                  🔒 Post 3+ times on the Feed to unlock topic creation ({userPostCount}/3)
                </div>
              ) : (
                <button onClick={()=>setShowAuth(true)} className="btn btn-blue" style={{padding:'9px 20px', fontSize:'0.85rem'}}>
                  Sign in to participate
                </button>
              )}
            </div>

            {/* Category filter */}
            <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
              <button onClick={()=>setTopicFilter('all')}
                style={{padding:'5px 16px', borderRadius:20, border:`1.5px solid ${topicFilter==='all'?'var(--brand-light)':'#e2e8f0'}`, background:topicFilter==='all'?'var(--brand-light)15':'white', color:topicFilter==='all'?'var(--brand-light)':'var(--text-light)', fontSize:'0.78rem', fontWeight:topicFilter==='all'?700:400, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s'}}>
                🌐 All
              </button>
              {TOPIC_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={()=>setTopicFilter(cat.id)}
                  style={{padding:'5px 16px', borderRadius:20, border:`1.5px solid ${topicFilter===cat.id?cat.color:'#e2e8f0'}`, background:topicFilter===cat.id?cat.color+'15':'white', color:topicFilter===cat.id?cat.color:'var(--text-light)', fontSize:'0.78rem', fontWeight:topicFilter===cat.id?700:400, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s'}}>
                  {cat.label}
                </button>
              ))}
            </div>

            {topicsLoading && (
              <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
                <div style={{fontSize:'2rem',marginBottom:12,animation:'pulse 1.5s infinite'}}>💬</div>
                Loading topics...
              </div>
            )}

            {!topicsLoading && filteredTopics.length === 0 && (
              <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:14}}>💬</div>
                <h3 style={{color:'var(--brand-deep)',marginBottom:8}}>No topics yet</h3>
                <p style={{marginBottom:20}}>
                  {topicFilter==='all'
                    ? 'Be the first to start a discussion!'
                    : `No topics in this category yet.`}
                </p>
                {canCreateTopic && (
                  <button onClick={()=>setShowNewTopic(true)} className="btn btn-blue" style={{padding:'10px 24px'}}>
                    Start the first topic
                  </button>
                )}
              </div>
            )}

            {filteredTopics.map(topic => (
              <TopicCard key={topic.id} topic={topic}
                currentUserId={user?.id} isAdmin={isAdmin}
                onDelete={handleDeleteTopic}
                onOpen={t => setOpenTopic(t)} />
            ))}
          </>
        )}

      </div>

      {/* ── Modals ── */}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} />}

      {showNewTopic && (
        <NewTopicModal
          currentUser={user}
          profile={profile}
          onClose={() => setShowNewTopic(false)}
          onCreated={() => { loadTopics() }}
        />
      )}

      {openTopic && (
        <TopicDetailModal
          topic={openTopic}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onClose={() => setOpenTopic(null)}
          onTopicUpdated={loadTopics}
        />
      )}

      {/* ── New User Guidelines Popup ── */}
      {showNewUserGuides && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9500, padding:20 }}>
          <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:460, boxShadow:'0 32px 80px rgba(0,0,0,0.4)', overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'28px 28px 24px', textAlign:'center', position:'relative' }}>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.05, fontSize:'8rem', pointerEvents:'none' }}>✝</div>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🙏</div>
              <h2 style={{ fontFamily:'var(--font-display)', color:'white', fontSize:'1.4rem', margin:'0 0 8px', fontWeight:800 }}>Welcome to CCG World!</h2>
              <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.88rem', margin:0, lineHeight:1.6 }}>
                Before you dive in, please take a moment to read our Community Guidelines.
              </p>
            </div>
            <div style={{ padding:'24px 28px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:22 }}>
                {[
                  ['✝️', 'Honour God in all your posts and interactions'],
                  ['💬', 'Speak the truth in love — disagreements are fine, hostility is not'],
                  ['🚫', 'No spam, harassment, false info, or inappropriate content'],
                  ['🚩', 'Use the report button if you see a violation — don\'t engage'],
                ].map(([icon, text]) => (
                  <div key={text} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 14px', background:'var(--brand-pale,#e8f5e9)', borderRadius:10 }}>
                    <span style={{ fontSize:'1rem', flexShrink:0, marginTop:1 }}>{icon}</span>
                    <span style={{ fontSize:'0.86rem', color:'var(--text-dark)', lineHeight:1.55 }}>{text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <Link to="/guidelines" onClick={() => { sessionStorage.removeItem('ccgm_new_user_guides'); setShowNewUserGuides(false) }}
                  style={{ display:'block', textAlign:'center', padding:'12px', borderRadius:10, background:'white', color:'var(--brand-mid)', fontWeight:700, fontSize:'0.9rem', textDecoration:'none', border:'1.5px solid var(--brand-mid)' }}>
                  📖 Read Full Guidelines
                </Link>
                <button onClick={() => { sessionStorage.removeItem('ccgm_new_user_guides'); setShowNewUserGuides(false) }}
                  style={{ padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer', fontSize:'0.9rem' }}>
                  I Understand — Take Me to the Timeline →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {reportPost && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}>
          <div style={{ background:'white', borderRadius:18, padding:'28px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
            {reportDone ? (
              <>
                <div style={{ textAlign:'center', padding:'16px 0' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🚩</div>
                  <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:'0 0 10px' }}>Report Submitted</h3>
                  <p style={{ color:'var(--text-mid)', fontSize:'0.88rem', lineHeight:1.6 }}>
                    Thank you. Our team will review this post. If it violates our guidelines, action will be taken.
                  </p>
                </div>
                <button onClick={() => setReportPost(null)}
                  style={{ width:'100%', marginTop:16, padding:'11px', borderRadius:10, border:'none', background:'var(--brand-mid)', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:'pointer' }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily:'var(--font-display)', color:'#dc2626', fontSize:'1.1rem', margin:'0 0 6px' }}>🚩 Report Post</h3>
                <p style={{ color:'var(--text-light)', fontSize:'0.83rem', margin:'0 0 20px' }}>
                  Why are you reporting this post?
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {REPORT_REASONS.map(r => (
                    <label key={r} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${reportReason===r?'#dc2626':'#e2e8f0'}`, background:reportReason===r?'#fff5f5':'white', cursor:'pointer' }}>
                      <input type="radio" name="reason" checked={reportReason===r} onChange={() => setReportReason(r)} style={{ accentColor:'#dc2626' }} />
                      <span style={{ fontSize:'0.88rem', color:'var(--text-dark)' }}>{r}</span>
                    </label>
                  ))}
                </div>
                {reportReason === 'Other' && (
                  <textarea value={reportOther} onChange={e=>setReportOther(e.target.value)}
                    placeholder="Please describe the issue..."
                    rows={3}
                    style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.88rem', outline:'none', resize:'vertical', boxSizing:'border-box', marginBottom:16 }} />
                )}
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={submitReport} disabled={!reportReason || reportSending}
                    style={{ flex:1, padding:'11px', borderRadius:10, border:'none', background:(!reportReason||reportSending)?'#9ca3af':'#dc2626', color:'white', fontWeight:700, fontFamily:'var(--font-body)', cursor:(!reportReason||reportSending)?'not-allowed':'pointer' }}>
                    {reportSending ? 'Submitting…' : 'Submit Report'}
                  </button>
                  <button onClick={() => setReportPost(null)}
                    style={{ padding:'11px 20px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', fontWeight:600, fontFamily:'var(--font-body)', cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showProfile && <ProfileModal profile={profile} onClose={()=>setShowProfile(false)} onUpdate={updateProfile} />}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .btn-blue { background:var(--brand-light);color:white;box-shadow:0 4px 20px rgba(37,99,235,0.35); }
        .btn-blue:hover { background:var(--brand-mid); }
        .btn-outline-blue { border:2px solid var(--brand-light);color:var(--brand-light); }
        .btn-outline-blue:hover { background:var(--brand-light);color:white; }
      `}</style>
    </>
  )
}
