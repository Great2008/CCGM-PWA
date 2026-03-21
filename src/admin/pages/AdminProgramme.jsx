import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabaseAdmin'

const PERIODS = ['morning','afternoon','evening','special']
const PERIOD_LABELS = { morning:'🌅 Morning', afternoon:'☀️ Afternoon', evening:'🌙 Evening', special:'⭐ Special' }

const EMPTY_PROGRAMME = { title:'', description:'', theme:'', venue:'', start_date:'', end_date:'', is_active:false }
const EMPTY_DAY       = { day_number:1, date:'', title:'' }
const EMPTY_SESSION   = { title:'', period:'morning', time_start:'', time_end:'', speaker:'', venue:'', scripture:'', notes:'', sort_order:0 }
const EMPTY_AGENDA    = { title:'', duration_mins:'', person:'', topic:'', scripture:'', sort_order:0 }

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2,'0')} ${ampm}`
}

function fmtDayDate(iso) {
  if (!iso) return ''
  return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})
}

function fmtFullDate(iso) {
  if (!iso) return ''
  return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})
}

function Input({ label, value, onChange, type='text', placeholder='', rows, required }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>
        {label}{required && <span style={{color:'#dc2626'}}> *</span>}
      </div>
      {rows ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
          style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', resize:'vertical', boxSizing:'border-box', outline:'none' }} />
      ) : (
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', boxSizing:'border-box', outline:'none' }} />
      )}
    </label>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', background:'white', boxSizing:'border-box' }}>
        {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

function Card({ children, style={} }) {
  return <div style={{ background:'white', borderRadius:14, padding:'18px 20px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', ...style }}>{children}</div>
}

function Btn({ onClick, disabled, children, color='var(--brand-mid)', small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '5px 12px' : '9px 20px',
      borderRadius:30, cursor: disabled ? 'not-allowed' : 'pointer',
      border:'none', background: color, color:'white',
      fontWeight:700, fontSize: small ? '0.75rem' : '0.84rem',
      fontFamily:'var(--font-body)', whiteSpace:'nowrap',
      opacity: disabled ? 0.6 : 1, transition:'opacity 0.15s', flexShrink:0,
    }}>{children}</button>
  )
}

function Modal({ children, title, onClose, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:16 }}>
      <div style={{ background:'white', borderRadius:18, padding:'24px 20px 20px', width:'100%', maxWidth: wide ? 640 : 440, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.35)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:0, fontSize:'1.05rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.3rem', cursor:'pointer', color:'var(--text-light)', lineHeight:1, padding:'0 4px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminProgramme() {
  const { showToast, logAction } = useAdmin()

  const [programmes, setProgrammes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('list')
  const [editProg, setEditProg]     = useState(null)
  const [progForm, setProgForm]     = useState(EMPTY_PROGRAMME)
  const [saving, setSaving]         = useState(false)

  const [manageProg, setManageProg]   = useState(null)
  const [days, setDays]               = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [sessions, setSessions]       = useState([])
  const [agendaMap, setAgendaMap]     = useState({})
  const [expandedSess, setExpandedSess] = useState(null)

  const [dayModal, setDayModal]         = useState(null)
  const [sessionModal, setSessionModal] = useState(null)
  const [agendaModal, setAgendaModal]   = useState(null)
  const [dayForm, setDayForm]           = useState(EMPTY_DAY)
  const [sessForm, setSessForm]         = useState(EMPTY_SESSION)
  const [agendaForm, setAgendaForm]     = useState(EMPTY_AGENDA)
  const [delConfirm, setDelConfirm]     = useState(null)

  // ── Loaders ───────────────────────────────────────────────────────
  const loadProgrammes = async () => {
    setLoading(true)
    const { data } = await supabaseAdmin.from('programmes').select('*').order('created_at',{ascending:false})
    setProgrammes(data||[]); setLoading(false)
  }
  useEffect(() => { loadProgrammes() }, [])

  const loadDays = async (progId) => {
    const { data } = await supabaseAdmin.from('programme_days').select('*').eq('programme_id',progId).order('day_number')
    setDays(data||[]); setSelectedDay(data?.[0]||null)
  }

  const loadSessions = async (dayId) => {
    const { data } = await supabaseAdmin.from('programme_sessions').select('*').eq('day_id',dayId).order('sort_order')
    setSessions(data||[]); setAgendaMap({}); setExpandedSess(null)
  }

  useEffect(() => {
    if (selectedDay) loadSessions(selectedDay.id)
    else { setSessions([]); setAgendaMap({}) }
  }, [selectedDay])

  const loadAgenda = async (sessionId) => {
    const { data } = await supabaseAdmin.from('programme_agenda_items').select('*').eq('session_id',sessionId).order('sort_order')
    setAgendaMap(prev => ({...prev, [sessionId]: data||[]}))
    return data||[]
  }

  const toggleAgenda = async (sessionId) => {
    if (expandedSess === sessionId) { setExpandedSess(null); return }
    setExpandedSess(sessionId)
    if (!agendaMap[sessionId]) await loadAgenda(sessionId)
  }

  // ── Programme CRUD ────────────────────────────────────────────────
  const saveProgramme = async () => {
    if (!progForm.title.trim()) { showToast('Title is required','error'); return }
    setSaving(true)
    try {
      if (editProg) {
        await supabaseAdmin.from('programmes').update(progForm).eq('id',editProg.id)
        showToast('Programme updated'); logAction('programme_updated',progForm.title)
      } else {
        await supabaseAdmin.from('programmes').insert(progForm)
        showToast('Programme created'); logAction('programme_created',progForm.title)
      }
      await loadProgrammes(); setView('list')
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const setActive = async (prog) => {
    await supabaseAdmin.from('programmes').update({is_active:false}).neq('id','00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('programmes').update({is_active:true}).eq('id',prog.id)
    showToast(`"${prog.title}" is now active`); logAction('programme_activated',prog.title); loadProgrammes()
  }

  const deactivate = async (prog) => {
    await supabaseAdmin.from('programmes').update({is_active:false}).eq('id',prog.id)
    showToast('Programme deactivated'); loadProgrammes()
  }

  const deleteProgramme = async (prog) => {
    await supabaseAdmin.from('programmes').delete().eq('id',prog.id)
    showToast('Programme deleted'); logAction('programme_deleted',prog.title); loadProgrammes(); setDelConfirm(null)
  }

  // ── Day CRUD ──────────────────────────────────────────────────────
  const saveDay = async () => {
    if (!dayForm.day_number) { showToast('Day number required','error'); return }
    setSaving(true)
    try {
      if (dayModal && dayModal!=='new') {
        await supabaseAdmin.from('programme_days').update(dayForm).eq('id',dayModal.id)
        showToast('Day updated')
      } else {
        await supabaseAdmin.from('programme_days').insert({...dayForm,programme_id:manageProg.id})
        showToast('Day added')
      }
      await loadDays(manageProg.id); setDayModal(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const deleteDay = async (day) => {
    await supabaseAdmin.from('programme_days').delete().eq('id',day.id)
    showToast('Day deleted')
    if (selectedDay?.id===day.id) setSelectedDay(null)
    await loadDays(manageProg.id); setDelConfirm(null)
  }

  // ── Session CRUD ──────────────────────────────────────────────────
  const saveSession = async () => {
    if (!sessForm.title.trim()) { showToast('Session title required','error'); return }
    setSaving(true)
    try {
      if (sessionModal && sessionModal!=='new') {
        await supabaseAdmin.from('programme_sessions').update(sessForm).eq('id',sessionModal.id)
        showToast('Session updated')
      } else {
        await supabaseAdmin.from('programme_sessions').insert({...sessForm,day_id:selectedDay.id})
        showToast('Session added')
      }
      await loadSessions(selectedDay.id); setSessionModal(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const deleteSession = async (sess) => {
    await supabaseAdmin.from('programme_sessions').delete().eq('id',sess.id)
    showToast('Session deleted'); await loadSessions(selectedDay.id); setDelConfirm(null)
  }

  // ── Agenda CRUD ───────────────────────────────────────────────────
  const openNewAgenda = async (sessionId) => {
    let items = agendaMap[sessionId]
    if (!items) items = await loadAgenda(sessionId)
    const nextOrder = items.length ? Math.max(...items.map(i=>i.sort_order||0))+10 : 0
    setAgendaForm({...EMPTY_AGENDA, sort_order:nextOrder})
    setAgendaModal({mode:'new', sessionId})
    setExpandedSess(sessionId)
  }

  const openEditAgenda = (sessionId, item) => {
    setAgendaForm({
      title: item.title||'',
      duration_mins: item.duration_mins!=null ? String(item.duration_mins) : '',
      person: item.person||'',
      topic: item.topic||'',
      scripture: item.scripture||'',
      sort_order: item.sort_order||0,
    })
    setAgendaModal({mode:'edit', sessionId, item})
  }

  const saveAgenda = async () => {
    if (!agendaForm.title.trim()) { showToast('Item title required','error'); return }
    setSaving(true)
    const payload = {
      title: agendaForm.title.trim(),
      duration_mins: agendaForm.duration_mins ? parseInt(agendaForm.duration_mins) : null,
      person: agendaForm.person.trim()||null,
      topic: agendaForm.topic.trim()||null,
      scripture: agendaForm.scripture.trim()||null,
      sort_order: parseInt(agendaForm.sort_order)||0,
    }
    try {
      const {sessionId, mode, item} = agendaModal
      if (mode==='edit') {
        await supabaseAdmin.from('programme_agenda_items').update(payload).eq('id',item.id)
        showToast('Item updated')
      } else {
        await supabaseAdmin.from('programme_agenda_items').insert({...payload,session_id:sessionId})
        showToast('Item added')
      }
      await loadAgenda(agendaModal.sessionId); setAgendaModal(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const deleteAgenda = async (sessionId, itemId) => {
    await supabaseAdmin.from('programme_agenda_items').delete().eq('id',itemId)
    showToast('Item deleted'); await loadAgenda(sessionId); setDelConfirm(null)
  }

  // ── UI helpers ────────────────────────────────────────────────────
  const openNewProg  = () => { setEditProg(null); setProgForm(EMPTY_PROGRAMME); setView('edit-prog') }
  const openEditProg = (p) => { setEditProg(p); setProgForm({title:p.title,description:p.description||'',theme:p.theme||'',venue:p.venue||'',start_date:p.start_date||'',end_date:p.end_date||'',is_active:p.is_active}); setView('edit-prog') }
  const openManage   = async (p) => { setManageProg(p); await loadDays(p.id); setView('edit-days') }

  const openNewDay = () => {
    const nextNum = days.length ? Math.max(...days.map(d=>d.day_number))+1 : 1
    setDayForm({...EMPTY_DAY,day_number:nextNum}); setDayModal('new')
  }
  const openEditDay = (d) => { setDayForm({day_number:d.day_number,date:d.date||'',title:d.title||''}); setDayModal(d) }

  const openNewSession = () => {
    const nextOrder = sessions.length ? Math.max(...sessions.map(s=>s.sort_order||0))+10 : 0
    setSessForm({...EMPTY_SESSION,sort_order:nextOrder}); setSessionModal('new')
  }
  const openEditSession = (s) => {
    setSessForm({title:s.title,period:s.period||'morning',time_start:s.time_start||'',time_end:s.time_end||'',speaker:s.speaker||'',venue:s.venue||'',scripture:s.scripture||'',notes:s.notes||'',sort_order:s.sort_order||0})
    setSessionModal(s)
  }

  const deleteConfirmHandler = () => {
    if (delConfirm.type==='programme') deleteProgramme(delConfirm.item)
    else if (delConfirm.type==='day') deleteDay(delConfirm.item)
    else if (delConfirm.type==='session') deleteSession(delConfirm.item)
    else if (delConfirm.type==='agenda') deleteAgenda(delConfirm.sessionId, delConfirm.item.id)
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER — Programme list
  // ══════════════════════════════════════════════════════════════════
  if (view==='list') return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:'1.6rem',color:'var(--brand-deep)',margin:'0 0 4px'}}>📅 Programme of Activities</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.82rem'}}>Manage special event programmes. Only one can be active at a time.</p>
        </div>
        <Btn onClick={openNewProg}>+ New Programme</Btn>
      </div>

      {loading && <p style={{color:'var(--text-light)',textAlign:'center',padding:40}}>Loading…</p>}
      {!loading && !programmes.length && (
        <Card style={{textAlign:'center',padding:'50px 20px'}}>
          <div style={{fontSize:'2.5rem',marginBottom:12}}>📋</div>
          <p style={{color:'var(--text-light)',marginBottom:20}}>No programmes yet.</p>
          <Btn onClick={openNewProg}>+ Create Programme</Btn>
        </Card>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {programmes.map(p => (
          <Card key={p.id} style={{borderColor:p.is_active?'#86efac':'#e2e8f0',background:p.is_active?'#f0fdf4':'white'}}>
            <div style={{marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                <span style={{fontFamily:'var(--font-display)',fontWeight:800,color:'var(--brand-deep)',fontSize:'1.05rem'}}>{p.title}</span>
                {p.is_active && <span style={{background:'#16a34a',color:'white',fontSize:'0.65rem',fontWeight:700,padding:'2px 9px',borderRadius:10}}>ACTIVE</span>}
              </div>
              {p.theme && <p style={{color:'#92400e',fontStyle:'italic',fontSize:'0.84rem',margin:'0 0 3px'}}>"{p.theme}"</p>}
              {p.venue && <p style={{color:'var(--text-light)',fontSize:'0.8rem',margin:'0 0 2px'}}>📍 {p.venue}</p>}
              {(p.start_date||p.end_date) && (
                <p style={{color:'var(--text-light)',fontSize:'0.8rem',margin:0}}>
                  📅 {fmtFullDate(p.start_date)}{p.start_date!==p.end_date&&p.end_date?` – ${fmtFullDate(p.end_date)}`:''}
                </p>
              )}
            </div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              <Btn onClick={()=>openManage(p)} color='#2563eb' small>📋 Manage Days</Btn>
              <Btn onClick={()=>openEditProg(p)} color='#6b7280' small>✏️ Edit</Btn>
              {p.is_active
                ? <Btn onClick={()=>deactivate(p)} color='#d97706' small>⏸ Deactivate</Btn>
                : <Btn onClick={()=>setActive(p)} color='#16a34a' small>▶️ Set Active</Btn>
              }
              <Btn onClick={()=>setDelConfirm({type:'programme',item:p})} color='#dc2626' small>🗑</Btn>
            </div>
          </Card>
        ))}
      </div>

      {delConfirm && (
        <Modal onClose={()=>setDelConfirm(null)} title="Confirm Delete">
          <p style={{color:'var(--text-mid)',marginBottom:20}}>Delete <strong>{delConfirm.item?.title||`Day ${delConfirm.item?.day_number}`||'this item'}</strong>? This cannot be undone.</p>
          <div style={{display:'flex',gap:10}}>
            <Btn onClick={deleteConfirmHandler} color='#dc2626'>Delete</Btn>
            <Btn onClick={()=>setDelConfirm(null)} color='#6b7280'>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  )

  // ── Programme form ────────────────────────────────────────────────
  if (view==='edit-prog') return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <button onClick={()=>setView('list')} style={{background:'none',border:'none',color:'var(--brand-mid)',cursor:'pointer',fontWeight:700,fontSize:'0.9rem',padding:0,fontFamily:'var(--font-body)'}}>← Back</button>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'1.5rem',color:'var(--brand-deep)',margin:0}}>{editProg?'Edit Programme':'New Programme'}</h1>
      </div>
      <Card style={{maxWidth:580}}>
        <Input label="Programme Title" value={progForm.title} onChange={v=>setProgForm(f=>({...f,title:v}))} placeholder="e.g. Annual General Conference 2026" required />
        <Input label="Theme / Motto" value={progForm.theme} onChange={v=>setProgForm(f=>({...f,theme:v}))} placeholder="e.g. Living In The Safe Hands Of God" />
        <Input label="Description" value={progForm.description} onChange={v=>setProgForm(f=>({...f,description:v}))} placeholder="Brief overview" rows={3} />
        <Input label="Main Venue" value={progForm.venue} onChange={v=>setProgForm(f=>({...f,venue:v}))} placeholder="e.g. CCGM HQ, Lagos" />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Input label="Start Date" type="date" value={progForm.start_date} onChange={v=>setProgForm(f=>({...f,start_date:v}))} />
          <Input label="End Date" type="date" value={progForm.end_date} onChange={v=>setProgForm(f=>({...f,end_date:v}))} />
        </div>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',marginBottom:20}}>
          <input type="checkbox" checked={progForm.is_active} onChange={e=>setProgForm(f=>({...f,is_active:e.target.checked}))} style={{width:16,height:16}} />
          <span style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem'}}>Set as active (visible to members now)</span>
        </label>
        <div style={{display:'flex',gap:10}}>
          <Btn onClick={saveProgramme} disabled={saving}>{saving?'Saving…':'💾 Save Programme'}</Btn>
          <Btn onClick={()=>setView('list')} color='#6b7280'>Cancel</Btn>
        </div>
      </Card>
    </div>
  )

  // ── Days & Sessions manager ───────────────────────────────────────
  if (view==='edit-days') return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
        <button onClick={()=>setView('list')} style={{background:'none',border:'none',color:'var(--brand-mid)',cursor:'pointer',fontWeight:700,fontSize:'0.9rem',padding:0,fontFamily:'var(--font-body)'}}>← Back</button>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'1.35rem',color:'var(--brand-deep)',margin:0,flex:1}}>
          📋 {manageProg?.title}
        </h1>
        {manageProg?.is_active && <span style={{background:'#16a34a',color:'white',fontSize:'0.65rem',fontWeight:700,padding:'3px 10px',borderRadius:10}}>ACTIVE</span>}
      </div>
      <p style={{color:'var(--text-light)',fontSize:'0.82rem',marginBottom:18}}>Manage days, sessions and agenda items.</p>

      {/* Days — horizontal scroll strip */}
      <div style={{marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem'}}>Days</span>
          <Btn onClick={openNewDay} small>+ Day</Btn>
        </div>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,WebkitOverflowScrolling:'touch'}}>
          {days.map(day => (
            <div key={day.id} style={{
              flexShrink:0, borderRadius:12, minWidth:100, maxWidth:130,
              border:`2px solid ${selectedDay?.id===day.id?'var(--brand-mid)':'#e2e8f0'}`,
              background:selectedDay?.id===day.id?'var(--brand-pale)':'white',
              padding:'10px 12px', cursor:'pointer', transition:'border-color 0.15s',
            }} onClick={()=>setSelectedDay(day)}>
              <div style={{fontWeight:800,color:'var(--brand-deep)',fontSize:'0.82rem'}}>Day {day.day_number}</div>
              {day.title && <div style={{color:'var(--text-mid)',fontSize:'0.72rem',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{day.title}</div>}
              {day.date && <div style={{color:'var(--text-light)',fontSize:'0.68rem',marginTop:1}}>{fmtDayDate(day.date)}</div>}
              <div style={{display:'flex',gap:4,marginTop:8}}>
                <button onClick={e=>{e.stopPropagation();openEditDay(day)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',padding:'2px 3px'}}>✏️</button>
                <button onClick={e=>{e.stopPropagation();setDelConfirm({type:'day',item:day})}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',padding:'2px 3px'}}>🗑️</button>
              </div>
            </div>
          ))}
          {!days.length && <p style={{color:'var(--text-light)',fontSize:'0.82rem',padding:'10px 0'}}>No days yet — add one above.</p>}
        </div>
      </div>

      {/* Sessions */}
      {!selectedDay ? (
        <Card style={{textAlign:'center',padding:'36px 20px'}}>
          <p style={{color:'var(--text-light)'}}>Select a day above to manage its sessions.</p>
        </Card>
      ) : (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.92rem'}}>
              Day {selectedDay.day_number}{selectedDay.title?` — ${selectedDay.title}`:''} sessions
            </span>
            <Btn onClick={openNewSession} small>+ Session</Btn>
          </div>

          {!sessions.length && (
            <Card style={{textAlign:'center',padding:'32px 20px'}}>
              <p style={{color:'var(--text-light)',marginBottom:14}}>No sessions yet.</p>
              <Btn onClick={openNewSession}>+ Add Session</Btn>
            </Card>
          )}

          {PERIODS.filter(p=>sessions.some(s=>s.period===p)).map(period => (
            <div key={period} style={{marginBottom:16}}>
              <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--text-light)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8}}>
                {PERIOD_LABELS[period]}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {sessions.filter(s=>s.period===period).map(sess => (
                  <SessionBlock
                    key={sess.id}
                    sess={sess}
                    expanded={expandedSess===sess.id}
                    agenda={agendaMap[sess.id]||[]}
                    onToggle={()=>toggleAgenda(sess.id)}
                    onEdit={()=>openEditSession(sess)}
                    onDelete={()=>setDelConfirm({type:'session',item:sess})}
                    onAddAgenda={()=>openNewAgenda(sess.id)}
                    onEditAgenda={(item)=>openEditAgenda(sess.id,item)}
                    onDeleteAgenda={(item)=>setDelConfirm({type:'agenda',item,sessionId:sess.id})}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Day modal */}
      {dayModal && (
        <Modal onClose={()=>setDayModal(null)} title={dayModal==='new'?'Add Day':'Edit Day'}>
          <Input label="Day Number" type="number" value={String(dayForm.day_number)} onChange={v=>setDayForm(f=>({...f,day_number:parseInt(v)||1}))} required />
          <Input label="Day Title (optional)" value={dayForm.title} onChange={v=>setDayForm(f=>({...f,title:v}))} placeholder="e.g. Opening Day, Closing Service" />
          <Input label="Date (optional)" type="date" value={dayForm.date} onChange={v=>setDayForm(f=>({...f,date:v}))} />
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={saveDay} disabled={saving}>{saving?'Saving…':'Save Day'}</Btn>
            <Btn onClick={()=>setDayModal(null)} color='#6b7280'>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Session modal */}
      {sessionModal && (
        <Modal onClose={()=>setSessionModal(null)} title={sessionModal==='new'?'Add Session':'Edit Session'} wide>
          <Input label="Session Title" value={sessForm.title} onChange={v=>setSessForm(f=>({...f,title:v}))} placeholder="e.g. Morning Devotion" required />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <Select label="Period" value={sessForm.period} onChange={v=>setSessForm(f=>({...f,period:v}))} options={PERIODS.map(p=>[p,PERIOD_LABELS[p]])} />
            <Input label="Sort Order" type="number" value={String(sessForm.sort_order)} onChange={v=>setSessForm(f=>({...f,sort_order:parseInt(v)||0}))} />
            <Input label="Start Time" type="time" value={sessForm.time_start} onChange={v=>setSessForm(f=>({...f,time_start:v}))} />
            <Input label="End Time" type="time" value={sessForm.time_end} onChange={v=>setSessForm(f=>({...f,time_end:v}))} />
            <Input label="Speaker / Minister" value={sessForm.speaker} onChange={v=>setSessForm(f=>({...f,speaker:v}))} placeholder="Name of speaker" />
            <Input label="Venue / Location" value={sessForm.venue} onChange={v=>setSessForm(f=>({...f,venue:v}))} placeholder="Main Auditorium…" />
          </div>
          <Input label="Theme / Scripture" value={sessForm.scripture} onChange={v=>setSessForm(f=>({...f,scripture:v}))} placeholder="e.g. John 15:5" />
          <Input label="Notes" value={sessForm.notes} onChange={v=>setSessForm(f=>({...f,notes:v}))} placeholder="Additional info…" rows={2} />
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={saveSession} disabled={saving}>{saving?'Saving…':'Save Session'}</Btn>
            <Btn onClick={()=>setSessionModal(null)} color='#6b7280'>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Agenda item modal */}
      {agendaModal && (
        <Modal onClose={()=>setAgendaModal(null)} title={agendaModal.mode==='new'?'Add Agenda Item':'Edit Agenda Item'}>
          <Input label="Activity Title" value={agendaForm.title} onChange={v=>setAgendaForm(f=>({...f,title:v}))} placeholder="e.g. Opening Prayer, Sermon, Bible Reading" required />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
            <Input label="Duration (minutes)" type="number" value={agendaForm.duration_mins} onChange={v=>setAgendaForm(f=>({...f,duration_mins:v}))} placeholder="e.g. 5" />
            <Input label="Sort Order" type="number" value={String(agendaForm.sort_order)} onChange={v=>setAgendaForm(f=>({...f,sort_order:parseInt(v)||0}))} />
          </div>
          <Input label="Person (optional)" value={agendaForm.person} onChange={v=>setAgendaForm(f=>({...f,person:v}))} placeholder="e.g. Bro. John Adeyemi" />
          <Input label="Topic (optional)" value={agendaForm.topic} onChange={v=>setAgendaForm(f=>({...f,topic:v}))} placeholder="e.g. The Power of Prayer" />
          <Input label="Bible Verse (optional)" value={agendaForm.scripture} onChange={v=>setAgendaForm(f=>({...f,scripture:v}))} placeholder="e.g. Matthew 6:9-13" />
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={saveAgenda} disabled={saving}>{saving?'Saving…':'Save Item'}</Btn>
            <Btn onClick={()=>setAgendaModal(null)} color='#6b7280'>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <Modal onClose={()=>setDelConfirm(null)} title="Confirm Delete">
          <p style={{color:'var(--text-mid)',marginBottom:20}}>
            Delete <strong>{delConfirm.item?.title||`Day ${delConfirm.item?.day_number}`||'this item'}</strong>? This cannot be undone.
          </p>
          <div style={{display:'flex',gap:10}}>
            <Btn onClick={deleteConfirmHandler} color='#dc2626'>Delete</Btn>
            <Btn onClick={()=>setDelConfirm(null)} color='#6b7280'>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Session card with expandable agenda list ──────────────────────
function SessionBlock({ sess, expanded, agenda, onToggle, onEdit, onDelete, onAddAgenda, onEditAgenda, onDeleteAgenda }) {
  return (
    <Card style={{padding:'13px 15px'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem',marginBottom:4}}>{sess.title}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {(sess.time_start||sess.time_end) && (
              <span style={{color:'var(--text-mid)',fontSize:'0.75rem'}}>
                🕐 {fmtTime(sess.time_start)}{sess.time_end?` – ${fmtTime(sess.time_end)}`:''}
              </span>
            )}
            {sess.speaker && <span style={{color:'var(--text-mid)',fontSize:'0.75rem'}}>🎤 {sess.speaker}</span>}
            {sess.venue && <span style={{color:'var(--text-light)',fontSize:'0.75rem'}}>📍 {sess.venue}</span>}
            {sess.scripture && <span style={{color:'#92400e',fontSize:'0.75rem'}}>📖 {sess.scripture}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <Btn onClick={onEdit} color='#6b7280' small>✏️</Btn>
          <Btn onClick={onDelete} color='#dc2626' small>🗑</Btn>
        </div>
      </div>

      {/* Agenda toggle */}
      <button onClick={onToggle} style={{
        marginTop:10, background:'none', border:'1px solid #e2e8f0',
        borderRadius:8, padding:'5px 12px', cursor:'pointer',
        color:'var(--brand-mid)', fontSize:'0.74rem', fontWeight:700,
        fontFamily:'var(--font-body)', display:'flex', alignItems:'center', gap:6,
      }}>
        📋 Agenda items {agenda.length>0?`(${agenda.length})`:''}
        <span style={{fontSize:'0.62rem'}}>{expanded?'▲':'▼'}</span>
      </button>

      {expanded && (
        <div style={{marginTop:10,borderTop:'1px solid #f1f5f9',paddingTop:10}}>
          {!agenda.length && <p style={{color:'var(--text-light)',fontSize:'0.8rem',margin:'0 0 10px'}}>No agenda items yet.</p>}
          <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:10}}>
            {agenda.map((item, idx) => (
              <div key={item.id} style={{
                background:'#f8fafc', borderRadius:10, padding:'9px 12px',
                display:'flex', alignItems:'flex-start', gap:8,
                borderLeft:'3px solid #d97706',
              }}>
                <div style={{color:'#d97706',fontWeight:800,fontSize:'0.7rem',minWidth:16,paddingTop:1}}>{idx+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.84rem'}}>{item.title}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:3}}>
                    {item.duration_mins!=null && <span style={{color:'var(--text-light)',fontSize:'0.72rem'}}>⏱ {item.duration_mins} min</span>}
                    {item.person && <span style={{color:'var(--text-mid)',fontSize:'0.72rem'}}>👤 {item.person}</span>}
                    {item.topic && <span style={{color:'var(--text-mid)',fontSize:'0.72rem'}}>💬 {item.topic}</span>}
                    {item.scripture && <span style={{color:'#92400e',fontSize:'0.72rem'}}>📖 {item.scripture}</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:3,flexShrink:0}}>
                  <button onClick={()=>onEditAgenda(item)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',padding:'2px 3px'}}>✏️</button>
                  <button onClick={()=>onDeleteAgenda(item)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.8rem',padding:'2px 3px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <Btn onClick={onAddAgenda} small>+ Add Item</Btn>
        </div>
      )}
    </Card>
  )
}
