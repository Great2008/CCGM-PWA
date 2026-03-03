import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import { Link } from 'react-router-dom'

const POST_TYPES = [
  { id:'update',    label:'📝 Update',    color:'var(--brand-light)' },
  { id:'testimony', label:'🙌 Testimony', color:'#7c3aed' },
  { id:'prayer',    label:'🙏 Prayer',    color:'#059669' },
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

function PostCard({ post, currentUserId, onReact, onComment, onDelete, isAdmin }) {
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
    <div style={{background:'white',borderRadius:16,boxShadow:'var(--shadow-sm)',overflow:'hidden',border:'1px solid rgba(15,31,61,0.05)',marginBottom:16}}>
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
        {(currentUserId===post.user_id||isAdmin)&&(
          <button onClick={()=>onDelete(post.id)} style={{color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:'1rem',opacity:0.5,padding:4,flexShrink:0}} title="Delete">🗑</button>
        )}
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
  const { signIn, signUp } = useAuth()
  const [mode, setMode]     = useState('signin')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [name, setName]     = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    const error = mode==='signin'
      ? await signIn(email, pass)
      : await signUp(email, pass, name)
    if (error) setErr(error.message)
    else onClose()
    setLoading(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
      <div style={{background:'white',borderRadius:20,padding:'36px 32px',width:'100%',maxWidth:420,boxShadow:'0 24px 80px rgba(0,0,0,0.28)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:18,background:'none',border:'none',cursor:'pointer',fontSize:'1.3rem',color:'var(--text-light)',lineHeight:1}}>✕</button>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',margin:'0 auto 14px'}}>🌐</div>
          <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.4rem',margin:'0 0 4px'}}>
            {mode==='signin'?'Welcome Back':'Join CCG World'}
          </h2>
          <p style={{color:'var(--text-light)',fontSize:'0.84rem',margin:0}}>
            {mode==='signin'?'Sign in to join the Timeline':'Create your member account'}
          </p>
        </div>
        <form onSubmit={handle}>
          {mode==='signup'&&<div className="form-group"><label>Full Name</label><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Your name" /></div>}
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="your@email.com" /></div>
          <div className="form-group"><label>Password</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} required placeholder="••••••••" /></div>
          {err&&<div style={{background:'#fff5f5',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',color:'#dc2626',fontSize:'0.85rem',marginBottom:14}}>❌ {err}</div>}
          {mode==='signup'&&<p style={{fontSize:'0.78rem',color:'var(--text-light)',marginBottom:14,lineHeight:1.6}}>ℹ️ New accounts need admin approval before accessing the Timeline.</p>}
          <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px'}} disabled={loading}>
            {loading?'⏳ Please wait...':(mode==='signin'?'Sign In →':'Create Account →')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:18}}>
          <button onClick={()=>setMode(m=>m==='signin'?'signup':'signin')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--brand-light)',fontSize:'0.85rem',fontFamily:'var(--font-body)',fontWeight:600}}>
            {mode==='signin'?'No account? Sign up free →':'Already have an account? Sign in'}
          </button>
        </div>
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
      <div style={{background:'white',borderRadius:18,padding:'28px 28px',width:'100%',maxWidth:400,boxShadow:'var(--shadow-lg)'}}>
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

/* ── Main Timeline Page ── */
export default function Timeline() {
  const { user, profile, loading: authLoading, signOut, isAdmin, updateProfile } = useAuth()
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [body, setBody]         = useState('')
  const [postType, setPostType] = useState('update')
  const [posting, setPosting]   = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const listRef = useRef(null)

  const canPost = !!user

  const loadPosts = async () => {
    const { data } = await supabase.from('timeline_posts')
      .select('*, profiles(display_name,full_name,avatar_url), reactions:timeline_reactions(*)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [])

  // Realtime subscription
  useEffect(() => {
    const sub = supabase.channel('timeline')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'timeline_posts' }, () => loadPosts())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const submitPost = async () => {
    if (!body.trim() || posting || !canPost) return
    setPosting(true)
    await supabase.from('timeline_posts').insert({ user_id: user.id, body: body.trim(), post_type: postType })
    setBody('')
    await loadPosts()
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
    await supabase.from('timeline_reactions').delete().eq('post_id', postId)
    await supabase.from('timeline_comments').delete().eq('post_id', postId)
    await supabase.from('timeline_posts').delete().eq('id', postId)
    await loadPosts()
  }

  if (authLoading) return <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>⏳</div>

  return (
    <>
      {/* Page header */}
      <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'clamp(90px,14vw,110px) 5% 40px',marginBottom:0}}>
        <div className="container" style={{maxWidth:760}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:16}}>
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
        </div>
      </div>

      <div className="container" style={{maxWidth:720,padding:'32px 5% 80px'}}>

        

        {/* Compose box */}
        {canPost && (
          <div style={{background:'white',borderRadius:16,boxShadow:'var(--shadow-sm)',padding:'20px',marginBottom:24,border:'1px solid rgba(15,31,61,0.05)'}}>
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
          {loading && (
            <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
              <div style={{fontSize:'2rem',marginBottom:12,animation:'pulse 1.5s infinite'}}>🌐</div>
              Loading timeline...
            </div>
          )}
          {!loading && posts.length===0 && (
            <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-light)'}}>
              <div style={{fontSize:'2.5rem',marginBottom:14}}>🕊</div>
              <h3 style={{color:'var(--brand-deep)',marginBottom:8}}>The Timeline is empty</h3>
              <p>Be the first to share a testimony or update!</p>
            </div>
          )}
          {posts.map(post=>(
            <PostCard key={post.id} post={post} currentUserId={user?.id} onReact={handleReact} onDelete={handleDelete} isAdmin={isAdmin} />
          ))}
        </div>
      </div>

      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} />}
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
