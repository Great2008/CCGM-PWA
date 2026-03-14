import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

function PrayerCard({ prayer, currentUserId, isAdmin, onPray, onDelete, onReply }) {
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies]         = useState([])
  const [replyText, setReplyText]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const myPray = prayer.prayer_counts?.some(p => p.user_id === currentUserId)

  const loadReplies = async () => {
    setLoadingReplies(true)
    const { data } = await supabase
      .from('prayer_replies')
      .select('*, profiles(display_name, full_name, avatar_url)')
      .eq('prayer_id', prayer.id)
      .order('created_at', { ascending: true })
    setReplies(data || [])
    setLoadingReplies(false)
  }

  const toggleReplies = () => {
    if (!showReplies) loadReplies()
    setShowReplies(r => !r)
  }

  const submitReply = async () => {
    if (!replyText.trim() || submitting || !currentUserId) return
    setSubmitting(true)
    await supabase.from('prayer_replies').insert({
      prayer_id: prayer.id,
      user_id: currentUserId,
      body: replyText.trim()
    })
    setReplyText('')
    await loadReplies()
    setSubmitting(false)
  }

  const prayCount = prayer.prayer_counts?.length || 0
  const replyCount = prayer.reply_count || 0

  return (
    <div style={{
      background: 'var(--white, white)', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(15,31,61,0.07)',
      border: '1.5px solid #e8f0fe',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Card header */}
      <div style={{ background: 'linear-gradient(135deg, var(--brand-pale), #f0f7ff)', padding: '16px 20px 12px', borderBottom: '1px solid #e8f0fe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Anonymous avatar */}
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-light), var(--brand-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
              🙏
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.88rem' }}>
                Anonymous Member
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: 1 }}>
                {timeAgo(prayer.created_at)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {prayer.category && (
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--brand-pale)', color: 'var(--brand-light)', border: '1px solid #bfdbfe' }}>
                {prayer.category}
              </span>
            )}
            {(isAdmin) && (
              <button onClick={() => onDelete(prayer.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5, padding: 4, fontSize: '0.9rem' }} title="Delete">🗑</button>
            )}
          </div>
        </div>
      </div>

      {/* Prayer request */}
      <div style={{ padding: '16px 20px 14px' }}>
        <p style={{ color: 'var(--text-dark)', lineHeight: 1.85, fontSize: '0.95rem', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {prayer.request}
        </p>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => currentUserId && onPray(prayer.id)}
          disabled={!currentUserId}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 30,
            border: `1.5px solid ${myPray ? 'var(--brand-light)' : '#e2e8f0'}`,
            background: myPray ? 'var(--brand-pale)' : 'white',
            color: myPray ? 'var(--brand-light)' : 'var(--text-light)',
            fontWeight: myPray ? 700 : 400, fontSize: '0.82rem',
            cursor: currentUserId ? 'pointer' : 'default',
            fontFamily: 'var(--font-body)', transition: 'all 0.15s',
          }}>
          🙏 {myPray ? 'Praying' : 'I\'ll Pray'} {prayCount > 0 && <span style={{ fontWeight: 700 }}>{prayCount}</span>}
        </button>

        <button onClick={toggleReplies}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 30,
            border: '1.5px solid #e2e8f0', background: 'var(--white, white)',
            color: 'var(--text-light)', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
          💬 {replyCount > 0 ? `${replyCount} Repl${replyCount === 1 ? 'y' : 'ies'}` : 'Encourage'}
        </button>
      </div>

      {/* Replies section */}
      {showReplies && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px', background: '#fafbff' }}>
          {loadingReplies && <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-light)', fontSize: '0.82rem' }}>Loading...</div>}
          {replies.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold), #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>
                {(r.profiles?.display_name || r.profiles?.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, background: 'var(--white, white)', borderRadius: 10, padding: '10px 14px', border: '1px solid #e8f0fe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.82rem' }}>
                    {r.profiles?.display_name || r.profiles?.full_name || 'Member'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-mid)', lineHeight: 1.7 }}>{r.body}</p>
              </div>
            </div>
          ))}

          {currentUserId ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submitReply())}
                placeholder="Write an encouraging word..."
                rows={2}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', resize: 'none', outline: 'none' }}
              />
              <button onClick={submitReply} disabled={!replyText.trim() || submitting}
                style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--brand-light)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-body)', opacity: !replyText.trim() ? 0.5 : 1 }}>
                {submitting ? '...' : 'Send'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'center', padding: '8px 0' }}>Sign in to leave an encouraging reply</div>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORIES = ['All', 'Health', 'Family', 'Finance', 'Guidance', 'Thanksgiving', 'Relationships', 'Other']

export default function PrayerWall() {
  const { user, canModerate } = useAuth()
  const [prayers, setPrayers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [request, setRequest]       = useState('')
  const [category, setCategory]     = useState('Other')
  const [filter, setFilter]         = useState('All')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const textareaRef = useRef(null)

  const loadPrayers = async () => {
    const { data } = await supabase
      .from('prayer_requests')
      .select('*, prayer_counts:prayer_prays(*), reply_count:prayer_replies(count)')
      .order('created_at', { ascending: false })
      .limit(60)
    // Flatten reply count
    const normalized = (data || []).map(p => ({
      ...p,
      reply_count: p.reply_count?.[0]?.count || 0
    }))
    setPrayers(normalized)
    setLoading(false)
  }

  useEffect(() => {
    loadPrayers()
    // Realtime subscription
    const sub = supabase.channel('prayer-wall')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prayer_requests' }, loadPrayers)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'prayer_requests' }, loadPrayers)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  const submitPrayer = async () => {
    if (!request.trim() || submitting) return
    setSubmitting(true)
    await supabase.from('prayer_requests').insert({
      request: request.trim(),
      category,
      // No user_id — completely anonymous
    })
    setRequest('')
    setCategory('Other')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
    await loadPrayers()
    setSubmitting(false)
  }

  const handlePray = async (prayerId) => {
    if (!user) return
    const prayer = prayers.find(p => p.id === prayerId)
    const existing = prayer?.prayer_counts?.find(p => p.user_id === user.id)
    if (existing) {
      await supabase.from('prayer_prays').delete().eq('id', existing.id)
    } else {
      await supabase.from('prayer_prays').insert({ prayer_id: prayerId, user_id: user.id })
    }
    await loadPrayers()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this prayer request?')) return
    await supabase.from('prayer_prays').delete().eq('prayer_id', id)
    await supabase.from('prayer_replies').delete().eq('prayer_id', id)
    await supabase.from('prayer_requests').delete().eq('id', id)
    await loadPrayers()
  }

  const filtered = filter === 'All' ? prayers : prayers.filter(p => p.category === filter)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingTop: 66 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)',
        padding: 'clamp(40px,8vw,80px) 5% 44px',
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 80%, rgba(245,158,11,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <span className="section-label">Community Prayer</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(2rem,5vw,3rem)', color: 'white', margin: '8px 0 14px', lineHeight: 1.2 }}>
            🙏 Prayer Wall
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', lineHeight: 1.8, maxWidth: 480, margin: '0 auto' }}>
            Share your prayer requests anonymously. Our community will pray with you and stand in faith together.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              🔒 Completely Anonymous
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              💬 Community Replies
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              🙏 Prayer Counter
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 5% 80px' }}>

        {/* Submit box — anyone can submit, no login needed */}
        <div style={{ background: 'var(--white, white)', borderRadius: 20, padding: 'clamp(20px,4vw,32px)', marginBottom: 32, boxShadow: 'var(--shadow-md)', border: '1.5px solid #e8f0fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-light), var(--brand-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🙏</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem' }}>Share a Prayer Request</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Your request will be posted anonymously</div>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder="What would you like the community to pray about? Share your heart — no names needed..."
            rows={4}
            style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: 1.7, resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--brand-light)'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                    borderColor: category === cat ? 'var(--brand-light)' : '#e2e8f0',
                    background: category === cat ? 'var(--brand-pale)' : 'white',
                    color: category === cat ? 'var(--brand-light)' : 'var(--text-light)',
                    fontSize: '0.72rem', fontWeight: category === cat ? 700 : 400,
                    cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                  }}>{cat}</button>
              ))}
            </div>
            <button onClick={submitPrayer} disabled={!request.trim() || submitting}
              style={{
                padding: '10px 28px', borderRadius: 30,
                background: 'linear-gradient(135deg, var(--brand-light), var(--brand-mid))',
                color: 'white', fontWeight: 800, fontSize: '0.88rem',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
                boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
                opacity: !request.trim() || submitting ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}>
              {submitting ? '⏳ Submitting...' : '🙏 Submit Prayer Request'}
            </button>
          </div>

          {submitted && (
            <div style={{ marginTop: 14, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', color: '#166534', fontWeight: 600, fontSize: '0.88rem' }}>
              ✅ Your prayer request has been shared. The community will pray with you. 💙
            </div>
          )}
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', marginRight: 4 }}>FILTER:</span>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: filter === cat ? 'var(--brand-mid)' : '#e2e8f0',
                background: filter === cat ? 'var(--brand-mid)' : 'white',
                color: filter === cat ? 'white' : 'var(--text-mid)',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}>{cat}</button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🙏</div>
            Loading prayer requests...
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🙏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', marginBottom: 8 }}>
              {filter !== 'All' ? `No ${filter} requests yet` : 'No prayer requests yet'}
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>Be the first to share a prayer request above.</div>
          </div>
        )}

        {/* Prayer cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(prayer => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              currentUserId={user?.id}
              isAdmin={canModerate}
              onPray={handlePray}
              onDelete={handleDelete}
              onReply={() => {}}
            />
          ))}
        </div>

        {!user && prayers.length > 0 && (
          <div style={{ marginTop: 24, background: 'linear-gradient(135deg, var(--brand-pale), white)', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '18px 24px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: 'var(--brand-deep)', marginBottom: 6 }}>🙏 Want to pray for others?</div>
            <div style={{ color: 'var(--text-mid)', fontSize: '0.85rem' }}>Sign in to mark prayers and leave encouraging replies for your brothers and sisters.</div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
