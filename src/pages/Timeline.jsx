import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import { auditLog } from '../lib/auditLog'
import { Link, useNavigate } from 'react-router-dom'

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
                <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="your@email.com"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:18}}>
                <label style={label}>Password</label>
                <input style={inputStyle} type="password" value={pass} onChange={e=>setPass(e.target.value)} required placeholder="••••••••"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <ErrBox />
              <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px'}} disabled={loading}>
                {loading ? '⏳ Signing in…' : 'Sign In →'}
              </button>
            </form>
            <div style={{textAlign:'center',marginTop:16}}>
              <button onClick={()=>{setMode('signup');setStep(1);setErr('')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--brand-light)',fontSize:'0.85rem',fontFamily:'var(--font-body)',fontWeight:600}}>
                No account? Sign up free →
              </button>
            </div>
          </>
        )}

        {/* ── SIGNUP STEP 1: Credentials ── */}
        {mode === 'signup' && step === 1 && (
          <>
            <Header title="Join CCG World" sub="Step 1 of 3 — Create your login" />
            <div style={{display:'flex',gap:6,marginBottom:22}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=1?'var(--brand-base)':'#e2e8f0',transition:'background 0.3s'}} />
              ))}
            </div>
            <form onSubmit={handleCredsNext}>
              <div style={{marginBottom:14}}>
                <label style={label}>Email *</label>
                <input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="your@email.com"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:14}}>
                <label style={label}>Password *</label>
                <input style={inputStyle} type="password" value={pass} onChange={e=>setPass(e.target.value)} required placeholder="At least 6 characters"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{marginBottom:18}}>
                <label style={label}>Confirm Password *</label>
                <input style={inputStyle} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required placeholder="Re-enter password"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <ErrBox />
              <button type="submit" className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'12px'}}>
                Continue →
              </button>
            </form>
            <div style={{textAlign:'center',marginTop:16}}>
              <button onClick={()=>{setMode('signin');setErr('')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--brand-light)',fontSize:'0.85rem',fontFamily:'var(--font-body)',fontWeight:600}}>
                Already have an account? Sign in
              </button>
            </div>
          </>
        )}

        {/* ── SIGNUP STEP 2: Profile ── */}
        {mode === 'signup' && step === 2 && (
          <>
            <Header title="Your Profile" sub="Step 2 of 3 — Tell us about yourself" />
            <div style={{display:'flex',gap:6,marginBottom:22}}>
              {[1,2,3].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=2?'var(--brand-base)':'#e2e8f0',transition:'background 0.3s'}} />
              ))}
            </div>
            <form onSubmit={handleProfileNext}>

              {/* Required */}
              <div style={{marginBottom:14}}>\
                <label style={label}>Full Name *</label>
                <input style={inputStyle} value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="e.g. Samuel Adeyemi"
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>

              {/* Gender — required */}
              <div style={{marginBottom:14}}>
                <label style={label}>Gender *</label>
                <select style={{...inputStyle, appearance:'none', cursor:'pointer'}} value={gender} onChange={e=>{ setGender(e.target.value); setChurchPost('') }}
                  onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                  <option value="">Select gender…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Church Post — required after gender selected */}
              {gender && (
                <div style={{marginBottom:14}}>
                  <label style={label}>Church Post *</label>
                  <select style={{...inputStyle, appearance:'none', cursor:'pointer'}} value={churchPost} onChange={e=>setChurchPost(e.target.value)}
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                    <option value="">Select your post…</option>
                    {gender === 'Male' && <>
                      <option value="Brother">Brother</option>
                      <option value="Deacon">Deacon</option>
                      <option value="Elder">Elder</option>
                      <option value="Evangelist">Evangelist</option>
                      <option value="Prophet">Prophet</option>
                      <option value="Pastor">Pastor</option>
                      <option value="Apostle">Apostle</option>
                    </>}
                    {gender === 'Female' && <>
                      <option value="Sister">Sister</option>
                      <option value="Deaconess">Deaconess</option>
                      <option value="Evangelist">Evangelist</option>
                      <option value="Prophet">Prophet</option>
                      <option value="Pastor">Pastor</option>
                      <option value="Apostle">Apostle</option>
                    </>}
                  </select>
                  {churchPost && ['Deacon','Deaconess','Elder','Evangelist','Prophet','Pastor','Apostle'].includes(churchPost) && (
                    <div style={{fontSize:'0.76rem',color:'#92400e',marginTop:4,background:'#fff7ed',padding:'6px 10px',borderRadius:6}}>
                      ⏳ <strong>{churchPost}</strong> requires admin approval before it shows on your profile.
                    </div>
                  )}
                </div>
              )}

              {/* Church Branch — required */}
              <div style={{marginBottom:14}}>
                <label style={label}>Church Branch *</label>
                {!notListed ? (
                  <select style={{...inputStyle, appearance:'none', cursor:'pointer'}} value={branch} onChange={e=>{ if(e.target.value==='__not_listed__'){setNotListed(true);setBranch('')}else{setBranch(e.target.value)} }}
                    onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}>
                    <option value="">Select your branch…</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}{b.location ? ` — ${b.location}` : ''}</option>
                    ))}
                    <option value="__not_listed__">🔍 My branch isn't listed</option>
                  </select>
                ) : (
                  <div>
                    <input style={{...inputStyle, marginBottom:8}} value={unlistedName} onChange={e=>setUnlistedName(e.target.value)} placeholder="Branch name"
                      onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    <input style={inputStyle} value={unlistedCity} onChange={e=>setUnlistedCity(e.target.value)} placeholder="City / State (optional)"
                      onFocus={e=>e.target.style.borderColor='var(--brand-base)'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                )}
                {/* Toggle not listed */}
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

              {/* Optional divider */}
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
              {/* 6 separate digit boxes */}
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

/* ── Main Timeline Page ── */
export default function Timeline() {
  const { user, profile, loading: authLoading, signOut, isAdmin, updateProfile } = useAuth()
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [body, setBody]         = useState('')
  const [postType, setPostType] = useState('update')
  const [posting, setPosting]   = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  // Guidelines banner — dismissed per session; new-user popup — shown once after signup
  const [guidesBannerDismissed, setGuidesBannerDismissed] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem('ccgm_guides_dismissed')
  )
  const [showNewUserGuides, setShowNewUserGuides] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem('ccgm_new_user_guides')
  )
  const [showProfile, setShowProfile] = useState(false)
  const listRef = useRef(null)

  // Report state
  const [reportPost, setReportPost]     = useState(null)   // post being reported
  const [reportReason, setReportReason] = useState('')
  const [reportOther, setReportOther]   = useState('')
  const [reportSending, setReportSending] = useState(false)
  const [reportDone, setReportDone]     = useState(false)
  const [myReports, setMyReports]       = useState([])     // post_ids I've already reported

  const REPORT_REASONS = [
    'Spam or irrelevant content',
    'Inappropriate or offensive content',
    'Harassment or bullying',
    'False information / misinformation',
    'Other',
  ]

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

  // Load posts I've already reported (so flag shows as already-reported)
  const loadMyReports = async () => {
    if (!user) return
    const { data } = await supabase.from('post_reports')
      .select('post_id').eq('reporter_id', user.id)
    setMyReports((data || []).map(r => r.post_id))
  }

  useEffect(() => { loadPosts(); loadMyReports() }, [user])

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
    const post = posts.find(p => p.id === postId)
    await supabase.from('timeline_reactions').delete().eq('post_id', postId)
    await supabase.from('timeline_comments').delete().eq('post_id', postId)
    await supabase.from('timeline_posts').delete().eq('id', postId)
    // Log if a moderator/admin deleted someone else's post
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

    // Insert report (unique constraint on reporter_id + post_id prevents duplicates)
    const { error } = await supabase.from('post_reports').insert({
      post_id:     reportPost.id,
      reporter_id: user.id,
      reason,
    })

    if (error) { setReportSending(false); return }

    // Update local state
    setMyReports(r => [...r, reportPost.id])

    // Count unique reports on this post
    const { count } = await supabase.from('post_reports')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', reportPost.id)

    // Auto-suspend if 10 unique reports reached
    if (count >= 10) {
      const authorId = reportPost.user_id
      const now = new Date().toISOString()
      const reason_text = `Auto-suspended: post received ${count} reports`

      // Suspend the user
      await supabase.from('profiles').update({
        suspended: true,
        suspended_at: now,
        suspension_reason: reason_text,
        suspension_expires_at: null,  // indefinite
        auto_suspended: true,
      }).eq('id', authorId)

      // Log to suspension_logs
      await supabase.from('suspension_logs').insert({
        user_id: authorId,
        action: 'auto_suspended',
        reason: reason_text,
        post_id: reportPost.id,
        created_at: now,
      })

      // Audit log
      const authorName = reportPost.profiles?.display_name || reportPost.profiles?.full_name || 'Member'
      auditLog('suspend', reason_text, authorName)

      // Notify admin via email
      try {
        await supabase.functions.invoke('send-suspension-email', {
          body: {
            type: 'auto_suspension_admin_alert',
            authorName,
            postBody: reportPost.body?.slice(0, 120),
            reportCount: count,
            adminPanelUrl: 'https://ccgm-pwa.vercel.app/admin',
          }
        })
      } catch(_) {}
    }

    setReportSending(false)
    setReportDone(true)
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
          <div style={{background: 'var(--white, white)',borderRadius:16,boxShadow:'var(--shadow-sm)',padding:'20px',marginBottom:24,border:'1px solid rgba(15,31,61,0.05)'}}>
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

          {/* ── Community Guidelines Banner ── */}
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
            <PostCard key={post.id} post={post} currentUserId={user?.id} onReact={handleReact} onDelete={handleDelete} isAdmin={isAdmin} onReport={handleReport} reportedByMe={myReports.includes(post.id)} />
          ))}
        </div>
      </div>

      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} />}

      {/* ── New User Guidelines Popup ── */}
      {showNewUserGuides && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9500, padding:20 }}>
          <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:460, boxShadow:'0 32px 80px rgba(0,0,0,0.4)', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'28px 28px 24px', textAlign:'center', position:'relative' }}>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.05, fontSize:'8rem', pointerEvents:'none' }}>✝</div>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🙏</div>
              <h2 style={{ fontFamily:'var(--font-display)', color:'white', fontSize:'1.4rem', margin:'0 0 8px', fontWeight:800 }}>Welcome to CCG World!</h2>
              <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.88rem', margin:0, lineHeight:1.6 }}>
                Before you dive in, please take a moment to read our Community Guidelines.
              </p>
            </div>
            {/* Body */}
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
