import { useState, useEffect, useRef, useCallback } from 'react'
import { useSermonsContent } from '../hooks/useContent'
import { ShareButtonLight } from '../components/ShareButton'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'
import { parseBlocks, ReadingContent, FormattedText } from '../lib/textFormat'
import { exportSermonPDF } from '../lib/exportPdf'

const FONT_SIZE_KEY = 'ccg-sermons-fontsize'

// ─── Sermon Notes Hook ─────────────────────────────────────────────────────────
function useSermonNotes(sermonId) {
  const { user } = useAuth()
  const [note,    setNote]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const saveTimer = useRef(null)

  const fetch = useCallback(async () => {
    if (!user || !sermonId) return
    setLoading(true)
    const { data } = await supabase
      .from('sermon_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('sermon_id', String(sermonId))
      .maybeSingle()
    setNote(data || null)
    setLoading(false)
  }, [user, sermonId])

  useEffect(() => { fetch() }, [fetch])

  const save = useCallback(async (content, isPublic, sermonTitle) => {
    if (!user || !sermonId) return
    setSaving(true); setSaved(false)
    const payload = {
      user_id:      user.id,
      sermon_id:    String(sermonId),
      sermon_title: sermonTitle,
      content,
      is_public:    isPublic,
      updated_at:   new Date().toISOString(),
    }
    if (note?.id) {
      await supabase.from('sermon_notes').update(payload).eq('id', note.id)
      setNote(prev => ({ ...prev, ...payload }))
    } else {
      const { data } = await supabase.from('sermon_notes').insert(payload).select().single()
      setNote(data)
    }
    setSaving(false); setSaved(true)
    saveTimer.current = setTimeout(() => setSaved(false), 2500)
  }, [user, sermonId, note])

  const remove = useCallback(async () => {
    if (!note?.id) return
    await supabase.from('sermon_notes').delete().eq('id', note.id)
    setNote(null)
  }, [note])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  return { note, loading, saving, saved, save, remove, refetch: fetch }
}

// ─── Public Notes ──────────────────────────────────────────────────────────────
function usePublicNotes(sermonId) {
  const [notes,   setNotes]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sermonId) return
    setLoading(true)
    supabase.from('sermon_notes')
      .select('id, content, is_public, updated_at, user_id')
      .eq('sermon_id', String(sermonId))
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setNotes(data || []); setLoading(false) })
  }, [sermonId])

  return { notes, loading }
}

// ─── My Notes Modal ────────────────────────────────────────────────────────────
function MyNotesModal({ onClose }) {
  const { user } = useAuth()
  const [notes,    setNotes]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('sermon_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setNotes(data || []); setLoading(false) })
  }, [user])

  const fmtDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return '' }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:600, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'white', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #f0fdf4', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ margin:0, fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.15rem' }}>📓 My Sermon Notes</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:'var(--text-light)' }}>{notes.length} note{notes.length!==1?'s':''} saved</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'#94a3b8' }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
          {loading && <div style={{ padding:40, textAlign:'center', color:'var(--text-light)' }}>Loading...</div>}
          {!loading && notes.length === 0 && (
            <div style={{ padding:'60px 24px', textAlign:'center', color:'var(--text-light)' }}>
              <div style={{ fontSize:'3rem', marginBottom:12 }}>📓</div>
              <div>No notes yet. Open a sermon and start writing!</div>
            </div>
          )}
          {notes.map(n => (
            <div key={n.id} style={{ borderBottom:'1px solid #f8faf8' }}>
              <div onClick={() => setExpanded(expanded===n.id ? null : n.id)}
                style={{ padding:'14px 24px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.92rem', marginBottom:4 }}>{n.sermon_title}</div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-light)', display:'flex', gap:10 }}>
                    <span>{fmtDate(n.updated_at)}</span>
                    {n.is_public && <span style={{ color:'#16a34a', fontWeight:600 }}>🌐 Public</span>}
                    <span>{n.content.length} chars</span>
                  </div>
                  {expanded !== n.id && (
                    <p style={{ margin:'6px 0 0', fontSize:'0.82rem', color:'var(--text-mid)', lineHeight:1.6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                      {n.content}
                    </p>
                  )}
                </div>
                <span style={{ color:'var(--text-light)', fontSize:'0.8rem', marginTop:2 }}>{expanded===n.id ? '▲' : '▼'}</span>
              </div>
              {expanded === n.id && (
                <div style={{ padding:'0 24px 16px' }}>
                  <div style={{ background:'#f8faf8', borderRadius:12, padding:'14px 18px', whiteSpace:'pre-wrap', fontSize:'0.88rem', lineHeight:1.8, color:'var(--text-dark)', fontFamily:'Georgia, serif', maxHeight:300, overflowY:'auto' }}>
                    {n.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sermon Notes Panel ─────────────────────────────────────────────────────────
function SermonNotesPanel({ sermon, onClose }) {
  const { user } = useAuth()
  const { note, loading, saving, saved, save, remove } = useSermonNotes(sermon.id)
  const { notes: publicNotes, loading: pubLoading } = usePublicNotes(sermon.id)
  const [content,    setContent]  = useState('')
  const [isPublic,   setIsPublic] = useState(false)
  const [tab,        setTab]      = useState('write')
  const [showDelete, setShowDelete] = useState(false)
  const autoSaveTimer = useRef(null)
  const textareaRef   = useRef(null)

  useEffect(() => {
    if (note) { setContent(note.content || ''); setIsPublic(note.is_public || false) }
  }, [note])

  useEffect(() => {
    if (tab === 'write') setTimeout(() => textareaRef.current?.focus(), 100)
  }, [tab])

  const handleChange = val => {
    setContent(val)
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (val.trim()) save(val, isPublic, sermon.title)
    }, 2000)
  }

  const handleSave = () => {
    clearTimeout(autoSaveTimer.current)
    save(content, isPublic, sermon.title)
  }

  const handleDelete = async () => { await remove(); setContent(''); setShowDelete(false) }

  const fmtDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) }
    catch { return '' }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  if (!user) return (
    <div style={{ padding:32, textAlign:'center' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔒</div>
      <p style={{ color:'var(--text-mid)', marginBottom:16 }}>Sign in to take and save sermon notes.</p>
      <button onClick={onClose} style={{ padding:'10px 24px', borderRadius:30, border:'none', background:'var(--brand-mid)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700 }}>Close</button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding:'18px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div style={{ flex:1, minWidth:0, paddingRight:12 }}>
            <div style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.6)', marginBottom:4 }}>📓 Sermon Notes</div>
            <div style={{ fontFamily:'var(--font-display)', color:'white', fontWeight:800, fontSize:'0.95rem', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sermon.title}</div>
            {sermon.pastor && <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.65)', marginTop:3 }}>{sermon.pastor}</div>}
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, width:34, height:34, cursor:'pointer', color:'white', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:6, background:'rgba(0,0,0,0.2)', borderRadius:30, padding:4 }}>
          {['write','community'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'7px 0', borderRadius:26, border:'none', background:tab===t?'white':'transparent', color:tab===t?'var(--brand-deep)':'rgba(255,255,255,0.8)', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.8rem', transition:'all 0.2s' }}>
              {t==='write' ? '✍️ My Notes' : `🌐 Community${publicNotes.length ? ` (${publicNotes.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'write' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {loading ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-light)' }}>Loading your notes...</div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => handleChange(e.target.value)}
                placeholder={'Write your notes here...\n\nCapture key points, scriptures, personal reflections or action steps.\n\nYour notes auto-save as you type.'}
                style={{ flex:1, padding:'18px 20px', border:'none', outline:'none', resize:'none', fontFamily:'Georgia, serif', fontSize:'0.95rem', lineHeight:1.85, color:'var(--text-dark)', background:'#fafef9' }}
              />
              <div style={{ padding:'12px 16px', borderTop:'1px solid #f0fdf4', display:'flex', flexDirection:'column', gap:10, background:'white' }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 12px', borderRadius:10, background:isPublic?'#f0fdf4':'#f8fafc', border:`1.5px solid ${isPublic?'#86efac':'#e2e8f0'}`, transition:'all 0.2s' }}>
                  <div onClick={() => { setIsPublic(p => !p); if(content.trim()) save(content, !isPublic, sermon.title) }}
                    style={{ width:40, height:22, borderRadius:11, background:isPublic?'#16a34a':'#cbd5e1', position:'relative', transition:'background 0.2s', flexShrink:0, cursor:'pointer' }}>
                    <div style={{ position:'absolute', top:2, left:isPublic?20:2, width:18, height:18, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.82rem', fontWeight:700, color:isPublic?'#15803d':'var(--text-mid)' }}>
                      {isPublic ? '🌐 Shared publicly' : '🔒 Private note'}
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-light)', marginTop:1 }}>
                      {isPublic ? 'Others can read this note in Community tab' : 'Only you can see this note'}
                    </div>
                  </div>
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-light)', flex:1 }}>
                    {wordCount > 0 && `${wordCount} word${wordCount!==1?'s':''} · `}
                    {saving ? '💾 Saving...' : saved ? '✅ Saved' : note?.updated_at ? `Last saved ${fmtDate(note.updated_at)}` : 'Not saved yet'}
                  </div>
                  {note && (
                    <button onClick={() => setShowDelete(true)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fff5f5', color:'#dc2626', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.78rem', fontWeight:600 }}>
                      🗑 Delete
                    </button>
                  )}
                  <button onClick={handleSave} disabled={saving || !content.trim()} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:content.trim()?'var(--brand-mid)':'#e2e8f0', color:content.trim()?'white':'#94a3b8', fontWeight:700, cursor:content.trim()?'pointer':'not-allowed', fontFamily:'var(--font-body)', fontSize:'0.85rem', transition:'all 0.2s' }}>
                    {saving ? '...' : '💾 Save'}
                  </button>
                </div>
              </div>
              {showDelete && (
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, padding:24 }}>
                  <div style={{ background:'white', borderRadius:16, padding:28, maxWidth:320, width:'100%', textAlign:'center' }}>
                    <div style={{ fontSize:'2rem', marginBottom:12 }}>🗑</div>
                    <h4 style={{ margin:'0 0 8px', color:'var(--brand-deep)' }}>Delete Note?</h4>
                    <p style={{ fontSize:'0.85rem', color:'var(--text-mid)', margin:'0 0 20px', lineHeight:1.6 }}>This will permanently delete your notes for this sermon.</p>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={() => setShowDelete(false)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>Cancel</button>
                      <button onClick={handleDelete} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:'#dc2626', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700 }}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'community' && (
        <div style={{ flex:1, overflowY:'auto', background:'#f8faf8' }}>
          {pubLoading && <div style={{ padding:40, textAlign:'center', color:'var(--text-light)' }}>Loading community notes...</div>}
          {!pubLoading && publicNotes.length === 0 && (
            <div style={{ padding:'60px 24px', textAlign:'center', color:'var(--text-light)' }}>
              <div style={{ fontSize:'3rem', marginBottom:12 }}>🌐</div>
              <div>No public notes yet for this sermon.</div>
              <div style={{ fontSize:'0.82rem', marginTop:8 }}>Be the first — write your notes and toggle to public!</div>
            </div>
          )}
          {publicNotes.map((n, i) => (
            <div key={n.id} style={{ margin:'12px 16px', background:'white', borderRadius:14, padding:'16px 18px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', border:'1px solid #f0fdf4' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--brand-pale)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'0.8rem', color:'var(--brand-mid)' }}>
                    {String.fromCharCode(65 + (i % 26))}
                  </div>
                  <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-light)' }}>Member · {fmtDate(n.updated_at)}</span>
                </div>
                <span style={{ fontSize:'0.68rem', background:'#f0fdf4', color:'#16a34a', fontWeight:700, padding:'3px 10px', borderRadius:20 }}>🌐 Public</span>
              </div>
              <p style={{ margin:0, fontSize:'0.88rem', lineHeight:1.8, color:'var(--text-dark)', fontFamily:'Georgia, serif', whiteSpace:'pre-wrap' }}>{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Sermons Page ─────────────────────────────────────────────────────────
export default function Sermons() {
  const { user }                      = useAuth()
  const { data: sermons, loading }    = useSermonsContent()
  const [search,       setSearch]     = useState('')
  const [filter,       setFilter]     = useState('All')
  const [selected,     setSelected]   = useState(null)
  const [showList,     setShowList]   = useState(false)
  const [notesSermon,  setNotesSermon]= useState(null)
  const [showMyNotes,  setShowMyNotes]= useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try { return parseInt(localStorage.getItem(FONT_SIZE_KEY)) || 17 } catch { return 17 }
  })

  const changeFontSize = (delta) => {
    setFontSize(prev => {
      const next = Math.min(26, Math.max(13, prev + delta))
      try { localStorage.setItem(FONT_SIZE_KEY, next) } catch {}
      return next
    })
  }

  const series = ['All', ...new Set(sermons.map(s => s.series).filter(Boolean))]

  const filtered = sermons.filter(s => {
    const matchSearch = !search ||
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.pastor?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || s.series === filter
    return matchSearch && matchFilter
  })

  // Auto-select first sermon on load
  useEffect(() => {
    if (!selected && filtered.length > 0) setSelected(filtered[0])
  }, [sermons]) // eslint-disable-line

  const selectSermon = (s) => {
    setSelected(s)
    setShowList(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <SEO
        title="Sermons"
        description="Watch and listen to CCG World sermons. Spirit-filled messages from the Christian Church Of God Mission."
        path="/sermons"
      />

      <div style={{ overflowX: 'hidden', width: '100%' }}>
        <style>{`
          @media (max-width: 768px) {
            .sm-desktop-sidebar { display: none !important; }
            .sm-mobile-bar      { display: flex !important; }
            .sm-content-wrap    { display: block !important; }
            .sm-outer           { padding: 0 0 60px 0 !important; max-width: 100% !important; }
            .sm-card            { border-radius: 0 !important; border-left: none !important; border-right: none !important; box-shadow: none !important; }
            .sm-hero            { padding-left: 16px !important; padding-right: 16px !important; }
            .sm-mobile-bar      { left: 0 !important; right: 0 !important; width: 100% !important; box-sizing: border-box !important; }
          }
          @media (min-width: 769px) {
            .sm-mobile-bar   { display: none !important; }
            .sm-content-wrap { display: grid !important; grid-template-columns: 270px 1fr; gap: 28px; }
            .sm-desktop-sidebar { display: block !important; }
          }
          .sm-sermon-item:hover { background: var(--brand-pale) !important; }
        `}</style>

        {/* Hero */}
        <div className="sm-hero" style={{ background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1600&q=80") center/cover no-repeat', padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center' }}>
          <span className="section-label">Messages & Teachings</span>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: 16 }}>
            Sermons & Messages
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.8 }}>
            Grow in faith through the preached Word. Stream, download, or share our messages.
          </p>
          {user && (
            <button onClick={() => setShowMyNotes(true)} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:30, border:'1.5px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.12)', color:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700, fontSize:'0.88rem', backdropFilter:'blur(4px)', transition:'all 0.2s' }}>
              📓 My Sermon Notes
            </button>
          )}
        </div>

        {/* ── MOBILE STICKY TOP BAR ── */}
        <div className="sm-mobile-bar" style={{
          display: 'none', position: 'sticky', top: 0, zIndex: 100,
          background: 'var(--brand-deep)', padding: '10px 14px',
          alignItems: 'center', gap: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <button onClick={() => setShowList(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1,
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: 'white',
            fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'left',
          }}>
            <span>🎙</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected ? selected.title : 'Pick a sermon'}
            </span>
            <span style={{ opacity: 0.55, fontSize: '0.7rem' }}>▼</span>
          </button>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button onClick={() => changeFontSize(-1)} style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem' }}>T−</button>
            <button onClick={() => changeFontSize(1)}  style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.85rem' }}>T+</button>
          </div>
        </div>

        {/* ── MOBILE SERMON LIST SHEET ── */}
        {showList && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}
            onClick={() => setShowList(false)}>
            <div style={{ marginTop: 'auto', background: 'var(--white, white)', borderRadius: '20px 20px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: '#d1fae5' }} />
              </div>
              <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid #f0fdf4' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-deep)', fontSize: '1rem', marginBottom: 10 }}>All Sermons</div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sermons..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', boxSizing: 'border-box' }} />
                {series.length > 2 && (
                  <select value={filter} onChange={e => setFilter(e.target.value)}
                    style={{ width: '100%', marginTop: 8, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.92rem', background: 'var(--white, white)' }}>
                    {series.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filtered.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>No sermons found</div>
                )}
                {filtered.map(s => {
                  const isSel = selected?.id === s.id
                  return (
                    <div key={s.id} className="sm-sermon-item" onClick={() => selectSermon(s)}
                      style={{ padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSel ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `4px solid ${isSel ? 'var(--brand-light)' : 'transparent'}` }}>
                      <div style={{ fontWeight: isSel ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.95rem', lineHeight: 1.4 }}>{s.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>{s.date}</div>
                      {s.pastor && <div style={{ fontSize: '0.78rem', color: 'var(--brand-light)', marginTop: 3, fontWeight: 600 }}>🎙 {s.pastor}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN LAYOUT ── */}
        <div className="sm-outer" style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 4% 80px' }}>
          <div className="sm-content-wrap" style={{ display: 'block' }}>

            {/* Desktop Sidebar */}
            <div className="sm-desktop-sidebar" style={{ display: 'none' }}>
              <div style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden', position: 'sticky', top: 24 }}>
                <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0fdf4' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sermons..."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  {series.length > 2 && (
                    <select value={filter} onChange={e => setFilter(e.target.value)}
                      style={{ width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d1fae5', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: 'var(--white, white)' }}>
                      {series.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ maxHeight: 540, overflowY: 'auto' }}>
                  {filtered.map(s => {
                    const isSel = selected?.id === s.id
                    return (
                      <div key={s.id} className="sm-sermon-item" onClick={() => selectSermon(s)}
                        style={{ padding: '13px 16px', cursor: 'pointer', borderBottom: '1px solid #f8faf8', background: isSel ? 'var(--brand-pale)' : 'var(--white, white)', borderLeft: `3px solid ${isSel ? 'var(--brand-light)' : 'transparent'}`, transition: 'all 0.15s' }}>
                        <div style={{ fontWeight: isSel ? 700 : 500, color: 'var(--brand-deep)', fontSize: '0.85rem', lineHeight: 1.4 }}>{s.title}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: 3 }}>{s.date}</div>
                        {s.pastor && <div style={{ fontSize: '0.71rem', color: 'var(--brand-light)', marginTop: 2, fontWeight: 600 }}>🎙 {s.pastor}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Content Panel */}
            <div>
              {loading && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🎙</div>
                  <p>Loading sermons...</p>
                </div>
              )}

              {!loading && sermons.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--white, white)', borderRadius: 20, boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '4rem', marginBottom: 20 }}>🎙</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', marginBottom: 12 }}>No Sermons Posted Yet</h3>
                  <p style={{ color: 'var(--text-mid)', maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
                    Our sermon library is being set up. Check back soon.
                  </p>
                </div>
              )}

              {!loading && !selected && sermons.length > 0 && (
                <div style={{ background: 'var(--white, white)', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎙</div>
                  <div style={{ color: 'var(--text-light)' }}>Select a sermon to read</div>
                </div>
              )}

              {!loading && selected && (
                <div className="sm-card" style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', overflow: 'hidden' }}>

                  {/* Sermon Header */}
                  <div style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))', padding: 'clamp(20px,4vw,32px) clamp(18px,4vw,32px) 0' }}>
                    {selected.series && (
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                        {selected.series}
                      </div>
                    )}
                    <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.3rem,4.5vw,2rem)', margin: '0 0 14px', lineHeight: 1.25 }}>
                      {selected.title}
                    </h2>
                    {selected.scripture && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--brand-deep)', padding: '7px 18px', borderRadius: 30, fontSize: 'clamp(0.78rem,2vw,0.88rem)', fontWeight: 800, marginBottom: 14 }}>
                        📜 {selected.scripture}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                      {selected.date    && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>📅 {selected.date}</span>}
                      {selected.pastor  && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>🎙 {selected.pastor}</span>}
                      {selected.duration && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>⏱ {selected.duration}</span>}
                      {selected.views   && <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>👁 {Number(selected.views).toLocaleString()} views</span>}
                      <button
                        onClick={async () => {
                          const msg = `🎙 "${selected.title}"${selected.pastor ? ` — ${selected.pastor}` : ''}\n\nListen on CCG World:\nhttps://ccgm-pwa.vercel.app/sermons`
                          if (navigator.share) {
                            try { await navigator.share({ text: msg }) } catch(_) {}
                          } else {
                            try { await navigator.clipboard.writeText(msg) } catch(_) {}
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        🔗 Share
                      </button>
                      {user && (
                        <button onClick={() => setNotesSermon(selected)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          📓 Notes
                        </button>
                      )}
                      <button onClick={() => exportSermonPDF(selected)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        ⬇️ Export PDF
                      </button>
                    </div>

                    {/* Desktop T-/T+ */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 14, gap: 5 }}>
                      <button onClick={() => changeFontSize(-1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T−</button>
                      <button onClick={() => changeFontSize(1)}  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '0.82rem' }}>T+</button>
                    </div>
                  </div>

                  {/* Media & Content body */}
                  <div style={{ padding: 'clamp(20px,5vw,36px)' }}>

                    {/* Watch / Audio buttons */}
                    {(selected.videoUrl || selected.audioUrl) && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
                        {selected.videoUrl && (
                          <a href={selected.videoUrl} target="_blank" rel="noreferrer" className="btn btn-green" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
                            ▶ Watch Sermon
                          </a>
                        )}
                        {selected.audioUrl && (
                          <a href={selected.audioUrl} className="btn btn-outline-green" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
                            🎧 Listen
                          </a>
                        )}
                      </div>
                    )}

                    {/* Thumbnail */}
                    {selected.thumbnail && !selected.videoUrl && (
                      <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
                        <img src={selected.thumbnail} alt={selected.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover' }} />
                      </div>
                    )}

                    {/* Description / body */}
                    {selected.description && (
                      <div style={{ background: 'var(--brand-pale)', borderLeft: '4px solid var(--brand-light)', borderRadius: '0 10px 10px 0', padding: '16px 20px', marginBottom: 28, fontStyle: 'italic', color: 'var(--brand-deep)', lineHeight: 1.8, fontSize: fontSize + 'px' }}>
                        <FormattedText text={selected.description} />
                      </div>
                    )}

                    {selected.body ? (
                      <ReadingContent blocks={parseBlocks(selected.body)} fontSize={fontSize} />
                    ) : !selected.description && (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎙</div>
                        <p>No notes available for this sermon.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notes panel */}
      {notesSermon && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.55)' }}
          onClick={() => setNotesSermon(null)}>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, maxWidth:680, margin:'0 auto', height:'85vh', background:'white', borderRadius:'20px 20px 0 0', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 -8px 40px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <SermonNotesPanel sermon={notesSermon} onClose={() => setNotesSermon(null)} />
          </div>
        </div>
      )}

      {showMyNotes && <MyNotesModal onClose={() => setShowMyNotes(false)} />}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </>
  )
}
