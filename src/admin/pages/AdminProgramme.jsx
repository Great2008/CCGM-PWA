import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabaseAdmin'

const PERIODS = ['morning','afternoon','evening','special']
const PERIOD_LABELS = { morning:'🌅 Morning', afternoon:'☀️ Afternoon', evening:'🌙 Evening', special:'⭐ Special' }

const EMPTY_PROGRAMME = { title:'', description:'', theme:'', venue:'', start_date:'', end_date:'', is_active:false }
const EMPTY_DAY       = { day_number:1, date:'', title:'' }
const EMPTY_SESSION   = { title:'', period:'morning', time_start:'', time_end:'', speaker:'', venue:'', scripture:'', notes:'', sort_order:0 }

function Input({ label, value, onChange, type='text', placeholder='', rows, required }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-mid)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</div>
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
        {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

function Card({ children, style={} }) {
  return <div style={{ background:'white', borderRadius:14, padding:'20px 22px', boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', ...style }}>{children}</div>
}

export default function AdminProgramme() {
  const { showToast, logAction } = useAdmin()

  // ── State ──────────────────────────────────────────────────────
  const [programmes, setProgrammes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState('list')    // 'list' | 'edit-prog' | 'edit-days'
  const [editProg, setEditProg]     = useState(null)      // programme being edited (null = new)
  const [progForm, setProgForm]     = useState(EMPTY_PROGRAMME)
  const [saving, setSaving]         = useState(false)

  // Days & sessions for programme being managed
  const [manageProg, setManageProg]     = useState(null)  // programme whose days/sessions we're editing
  const [days, setDays]                 = useState([])
  const [selectedDay, setSelectedDay]   = useState(null)
  const [sessions, setSessions]         = useState([])    // sessions for selectedDay

  // Modals
  const [dayModal, setDayModal]         = useState(null)  // null | 'new' | day-object
  const [sessionModal, setSessionModal] = useState(null)  // null | 'new' | session-object
  const [dayForm, setDayForm]           = useState(EMPTY_DAY)
  const [sessForm, setSessForm]         = useState(EMPTY_SESSION)

  const [delConfirm, setDelConfirm] = useState(null) // { type, id, label }

  // ── Load programmes ────────────────────────────────────────────
  const loadProgrammes = async () => {
    setLoading(true)
    const { data } = await supabaseAdmin.from('programmes').select('*').order('created_at', { ascending:false })
    setProgrammes(data || [])
    setLoading(false)
  }
  useEffect(() => { loadProgrammes() }, [])

  // ── Load days for manageProg ────────────────────────────────────
  const loadDays = async (progId) => {
    const { data } = await supabaseAdmin.from('programme_days').select('*').eq('programme_id', progId).order('day_number')
    setDays(data || [])
    if (data?.length) setSelectedDay(data[0])
    else setSelectedDay(null)
  }

  // ── Load sessions for selectedDay ───────────────────────────────
  const loadSessions = async (dayId) => {
    const { data } = await supabaseAdmin.from('programme_sessions').select('*').eq('day_id', dayId).order('sort_order')
    setSessions(data || [])
  }

  useEffect(() => {
    if (selectedDay) loadSessions(selectedDay.id)
    else setSessions([])
  }, [selectedDay])

  // ── Programme CRUD ─────────────────────────────────────────────
  const saveProgramme = async () => {
    if (!progForm.title.trim()) { showToast('Title is required', 'error'); return }
    setSaving(true)
    try {
      if (editProg) {
        await supabaseAdmin.from('programmes').update(progForm).eq('id', editProg.id)
        showToast('Programme updated')
        logAction('programme_updated', `Updated: ${progForm.title}`)
      } else {
        await supabaseAdmin.from('programmes').insert(progForm)
        showToast('Programme created')
        logAction('programme_created', `Created: ${progForm.title}`)
      }
      await loadProgrammes()
      setView('list')
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const setActive = async (prog) => {
    // Deactivate all, then activate this one
    await supabaseAdmin.from('programmes').update({ is_active:false }).neq('id','00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('programmes').update({ is_active:true }).eq('id', prog.id)
    showToast(`"${prog.title}" is now the active programme`)
    logAction('programme_activated', prog.title)
    loadProgrammes()
  }

  const deactivate = async (prog) => {
    await supabaseAdmin.from('programmes').update({ is_active:false }).eq('id', prog.id)
    showToast('Programme deactivated')
    loadProgrammes()
  }

  const deleteProgramme = async (prog) => {
    await supabaseAdmin.from('programmes').delete().eq('id', prog.id)
    showToast('Programme deleted')
    logAction('programme_deleted', prog.title)
    loadProgrammes()
    setDelConfirm(null)
  }

  // ── Day CRUD ───────────────────────────────────────────────────
  const saveDay = async () => {
    if (!dayForm.day_number) { showToast('Day number required', 'error'); return }
    setSaving(true)
    try {
      if (dayModal && dayModal !== 'new') {
        await supabaseAdmin.from('programme_days').update(dayForm).eq('id', dayModal.id)
        showToast('Day updated')
      } else {
        await supabaseAdmin.from('programme_days').insert({ ...dayForm, programme_id: manageProg.id })
        showToast('Day added')
      }
      await loadDays(manageProg.id)
      setDayModal(null)
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const deleteDay = async (day) => {
    await supabaseAdmin.from('programme_days').delete().eq('id', day.id)
    showToast('Day deleted')
    await loadDays(manageProg.id)
    setDelConfirm(null)
    if (selectedDay?.id === day.id) setSelectedDay(null)
  }

  // ── Session CRUD ───────────────────────────────────────────────
  const saveSession = async () => {
    if (!sessForm.title.trim()) { showToast('Session title required', 'error'); return }
    setSaving(true)
    try {
      if (sessionModal && sessionModal !== 'new') {
        await supabaseAdmin.from('programme_sessions').update(sessForm).eq('id', sessionModal.id)
        showToast('Session updated')
      } else {
        await supabaseAdmin.from('programme_sessions').insert({ ...sessForm, day_id: selectedDay.id })
        showToast('Session added')
      }
      await loadSessions(selectedDay.id)
      setSessionModal(null)
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const deleteSession = async (sess) => {
    await supabaseAdmin.from('programme_sessions').delete().eq('id', sess.id)
    showToast('Session deleted')
    await loadSessions(selectedDay.id)
    setDelConfirm(null)
  }

  // ── UI helpers ─────────────────────────────────────────────────
  const openNewProg = () => { setEditProg(null); setProgForm(EMPTY_PROGRAMME); setView('edit-prog') }
  const openEditProg = (p) => { setEditProg(p); setProgForm({ title:p.title, description:p.description||'', theme:p.theme||'', venue:p.venue||'', start_date:p.start_date||'', end_date:p.end_date||'', is_active:p.is_active }); setView('edit-prog') }
  const openManage = async (p) => { setManageProg(p); await loadDays(p.id); setView('edit-days') }

  const openNewDay = () => {
    const nextNum = days.length ? Math.max(...days.map(d=>d.day_number))+1 : 1
    setDayForm({ ...EMPTY_DAY, day_number:nextNum })
    setDayModal('new')
  }
  const openEditDay = (d) => { setDayForm({ day_number:d.day_number, date:d.date||'', title:d.title||'' }); setDayModal(d) }

  const openNewSession = () => {
    const nextOrder = sessions.length ? Math.max(...sessions.map(s=>s.sort_order||0))+10 : 0
    setSessForm({ ...EMPTY_SESSION, sort_order:nextOrder })
    setSessionModal('new')
  }
  const openEditSession = (s) => {
    setSessForm({ title:s.title, period:s.period||'morning', time_start:s.time_start||'', time_end:s.time_end||'', speaker:s.speaker||'', venue:s.venue||'', scripture:s.scripture||'', notes:s.notes||'', sort_order:s.sort_order||0 })
    setSessionModal(s)
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  // ── Programme list ─────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.7rem', color:'var(--brand-deep)', margin:'0 0 4px' }}>📅 Programme of Activities</h1>
          <p style={{ color:'var(--text-light)', margin:0, fontSize:'0.85rem' }}>Manage special event programmes. Only one can be active (visible to members) at a time.</p>
        </div>
        <button onClick={openNewProg} style={btnStyle('var(--brand-mid)')}>+ New Programme</button>
      </div>

      {loading && <p style={{ color:'var(--text-light)', padding:'40px 0', textAlign:'center' }}>Loading…</p>}

      {!loading && programmes.length === 0 && (
        <Card style={{ textAlign:'center', padding:'60px 32px' }}>
          <div style={{ fontSize:'3rem', marginBottom:14 }}>📋</div>
          <h3 style={{ color:'var(--brand-deep)', margin:'0 0 10px' }}>No programmes yet</h3>
          <p style={{ color:'var(--text-light)', marginBottom:24 }}>Create your first programme for an upcoming event.</p>
          <button onClick={openNewProg} style={btnStyle('var(--brand-mid)')}>+ Create Programme</button>
        </Card>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {programmes.map(p => (
          <Card key={p.id} style={{ borderColor: p.is_active ? '#86efac' : '#e2e8f0', background: p.is_active ? '#f0fdf4' : 'white' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:800, color:'var(--brand-deep)', fontSize:'1.05rem' }}>{p.title}</span>
                  {p.is_active && <span style={{ background:'#16a34a', color:'white', fontSize:'0.68rem', fontWeight:700, padding:'2px 9px', borderRadius:10, letterSpacing:'0.06em' }}>ACTIVE</span>}
                </div>
                {p.theme && <p style={{ color:'#92400e', fontStyle:'italic', fontSize:'0.84rem', margin:'0 0 4px' }}>"{p.theme}"</p>}
                {p.venue && <p style={{ color:'var(--text-light)', fontSize:'0.8rem', margin:'0 0 2px' }}>📍 {p.venue}</p>}
                {(p.start_date||p.end_date) && (
                  <p style={{ color:'var(--text-light)', fontSize:'0.8rem', margin:0 }}>
                    📅 {p.start_date && new Date(p.start_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
                    {p.start_date !== p.end_date && p.end_date && ` – ${new Date(p.end_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:7, flexWrap:'wrap', flexShrink:0 }}>
                <button onClick={() => openManage(p)} style={btnStyle('#2563eb','small')}>📋 Manage Days</button>
                <button onClick={() => openEditProg(p)} style={btnStyle('#6b7280','small')}>✏️ Edit</button>
                {p.is_active
                  ? <button onClick={() => deactivate(p)} style={btnStyle('#d97706','small')}>⏸ Deactivate</button>
                  : <button onClick={() => setActive(p)} style={btnStyle('#16a34a','small')}>▶️ Set Active</button>
                }
                <button onClick={() => setDelConfirm({ type:'programme', item:p })} style={btnStyle('#dc2626','small')}>🗑</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete confirm */}
      {delConfirm && (
        <Modal onClose={() => setDelConfirm(null)} title="Confirm Delete">
          <p style={{ color:'var(--text-mid)', marginBottom:20 }}>
            Delete <strong>{delConfirm.item.title || 'this item'}</strong>? This will also delete all days and sessions inside it. This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => {
              if (delConfirm.type==='programme') deleteProgramme(delConfirm.item)
              if (delConfirm.type==='day') deleteDay(delConfirm.item)
              if (delConfirm.type==='session') deleteSession(delConfirm.item)
            }} style={btnStyle('#dc2626')}>Delete</button>
            <button onClick={() => setDelConfirm(null)} style={btnStyle('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )

  // ── Programme form ─────────────────────────────────────────────
  if (view === 'edit-prog') return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none', color:'var(--brand-mid)', cursor:'pointer', fontSize:'0.9rem', fontWeight:700, padding:0, fontFamily:'var(--font-body)' }}>← Back</button>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', color:'var(--brand-deep)', margin:0 }}>
          {editProg ? 'Edit Programme' : 'New Programme'}
        </h1>
      </div>
      <Card style={{ maxWidth:640 }}>
        <Input label="Programme Title" value={progForm.title} onChange={v=>setProgForm(f=>({...f,title:v}))} placeholder="e.g. Annual General Conference 2025" required />
        <Input label="Theme / Scripture" value={progForm.theme} onChange={v=>setProgForm(f=>({...f,theme:v}))} placeholder="e.g. Abide in Me and I in You" />
        <Input label="Description" value={progForm.description} onChange={v=>setProgForm(f=>({...f,description:v}))} placeholder="Brief overview of the event" rows={3} />
        <Input label="Main Venue" value={progForm.venue} onChange={v=>setProgForm(f=>({...f,venue:v}))} placeholder="e.g. CCG Mission HQ, Lagos" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Input label="Start Date" type="date" value={progForm.start_date} onChange={v=>setProgForm(f=>({...f,start_date:v}))} />
          <Input label="End Date" type="date" value={progForm.end_date} onChange={v=>setProgForm(f=>({...f,end_date:v}))} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:20 }}>
          <input type="checkbox" checked={progForm.is_active} onChange={e=>setProgForm(f=>({...f,is_active:e.target.checked}))} style={{ width:16, height:16 }} />
          <span style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.9rem' }}>Set as active programme (visible to members)</span>
        </label>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={saveProgramme} disabled={saving} style={btnStyle('var(--brand-mid)')}>{saving ? 'Saving…' : '💾 Save Programme'}</button>
          <button onClick={() => setView('list')} style={btnStyle('#6b7280')}>Cancel</button>
        </div>
      </Card>
    </div>
  )

  // ── Days & sessions manager ─────────────────────────────────────
  if (view === 'edit-days') return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none', color:'var(--brand-mid)', cursor:'pointer', fontSize:'0.9rem', fontWeight:700, padding:0, fontFamily:'var(--font-body)' }}>← Back</button>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', color:'var(--brand-deep)', margin:0 }}>
          📋 {manageProg?.title}
        </h1>
        {manageProg?.is_active && <span style={{ background:'#16a34a', color:'white', fontSize:'0.68rem', fontWeight:700, padding:'2px 9px', borderRadius:10 }}>ACTIVE</span>}
      </div>
      <p style={{ color:'var(--text-light)', fontSize:'0.84rem', marginBottom:24, marginLeft:60 }}>Manage days and sessions for this programme.</p>

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, alignItems:'start' }}>

        {/* Days sidebar */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.86rem' }}>Days</span>
            <button onClick={openNewDay} style={{ ...btnStyle('var(--brand-mid)','small'), padding:'4px 10px' }}>+ Day</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {days.map(day => (
              <div key={day.id} style={{
                borderRadius:10, border:`1.5px solid ${selectedDay?.id===day.id ? 'var(--brand-mid)':'#e2e8f0'}`,
                background: selectedDay?.id===day.id ? 'var(--brand-pale)' : 'white',
                padding:'10px 14px', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }} onClick={() => setSelectedDay(day)}>
                <div>
                  <div style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.84rem' }}>Day {day.day_number}</div>
                  {day.title && <div style={{ color:'var(--text-light)', fontSize:'0.75rem' }}>{day.title}</div>}
                  {day.date && <div style={{ color:'var(--text-light)', fontSize:'0.72rem' }}>{new Date(day.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <button onClick={e=>{e.stopPropagation();openEditDay(day)}} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'var(--text-light)', padding:'2px 4px' }}>✏️</button>
                  <button onClick={e=>{e.stopPropagation();setDelConfirm({type:'day',item:day})}} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'#dc2626', padding:'2px 4px' }}>🗑</button>
                </div>
              </div>
            ))}
            {days.length===0 && <p style={{ color:'var(--text-light)', fontSize:'0.8rem', textAlign:'center', padding:'16px 0' }}>No days yet</p>}
          </div>
        </div>

        {/* Sessions panel */}
        <div>
          {!selectedDay ? (
            <Card style={{ textAlign:'center', padding:'40px 20px' }}>
              <p style={{ color:'var(--text-light)' }}>Select a day to manage its sessions, or add a day first.</p>
            </Card>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.95rem' }}>
                  Day {selectedDay.day_number}{selectedDay.title?` — ${selectedDay.title}`:''} sessions
                </span>
                <button onClick={openNewSession} style={btnStyle('var(--brand-mid)','small')}>+ Add Session</button>
              </div>

              {sessions.length === 0 && (
                <Card style={{ textAlign:'center', padding:'40px 20px' }}>
                  <p style={{ color:'var(--text-light)', marginBottom:16 }}>No sessions for this day yet.</p>
                  <button onClick={openNewSession} style={btnStyle('var(--brand-mid)')}>+ Add Session</button>
                </Card>
              )}

              {/* Group sessions by period */}
              {PERIODS.filter(p => sessions.some(s => s.period===p)).map(period => (
                <div key={period} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:'0.76rem', fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>
                    {PERIOD_LABELS[period]}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {sessions.filter(s=>s.period===period).map(sess => (
                      <Card key={sess.id} style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, color:'var(--brand-deep)', fontSize:'0.9rem', marginBottom:3 }}>{sess.title}</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                              {(sess.time_start||sess.time_end) && (
                                <span style={{ color:'var(--text-light)', fontSize:'0.75rem' }}>
                                  🕐 {sess.time_start}{sess.time_end?` – ${sess.time_end}`:''}
                                </span>
                              )}
                              {sess.speaker && <span style={{ color:'var(--text-mid)', fontSize:'0.75rem' }}>🎤 {sess.speaker}</span>}
                              {sess.venue && <span style={{ color:'var(--text-light)', fontSize:'0.75rem' }}>📍 {sess.venue}</span>}
                              {sess.scripture && <span style={{ color:'#92400e', fontSize:'0.75rem' }}>📖 {sess.scripture}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                            <button onClick={() => openEditSession(sess)} style={btnStyle('#6b7280','small')}>✏️</button>
                            <button onClick={() => setDelConfirm({type:'session',item:sess})} style={btnStyle('#dc2626','small')}>🗑</button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Day modal */}
      {dayModal && (
        <Modal onClose={() => setDayModal(null)} title={dayModal==='new' ? 'Add Day' : 'Edit Day'}>
          <Input label="Day Number" type="number" value={String(dayForm.day_number)} onChange={v=>setDayForm(f=>({...f,day_number:parseInt(v)||1}))} required />
          <Input label="Day Title (optional)" value={dayForm.title} onChange={v=>setDayForm(f=>({...f,title:v}))} placeholder="e.g. Opening Day, Closing Service" />
          <Input label="Date (optional)" type="date" value={dayForm.date} onChange={v=>setDayForm(f=>({...f,date:v}))} />
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={saveDay} disabled={saving} style={btnStyle('var(--brand-mid)')}>{saving?'Saving…':'Save Day'}</button>
            <button onClick={() => setDayModal(null)} style={btnStyle('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Session modal */}
      {sessionModal && (
        <Modal onClose={() => setSessionModal(null)} title={sessionModal==='new' ? 'Add Session' : 'Edit Session'} wide>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Input label="Session Title" value={sessForm.title} onChange={v=>setSessForm(f=>({...f,title:v}))} placeholder="e.g. Morning Devotion, Bible Study" required />
            </div>
            <Select label="Period" value={sessForm.period} onChange={v=>setSessForm(f=>({...f,period:v}))} options={PERIODS.map(p=>[p,PERIOD_LABELS[p]])} />
            <Input label="Sort Order" type="number" value={String(sessForm.sort_order)} onChange={v=>setSessForm(f=>({...f,sort_order:parseInt(v)||0}))} />
            <Input label="Start Time" type="time" value={sessForm.time_start} onChange={v=>setSessForm(f=>({...f,time_start:v}))} />
            <Input label="End Time" type="time" value={sessForm.time_end} onChange={v=>setSessForm(f=>({...f,time_end:v}))} />
            <Input label="Speaker / Minister" value={sessForm.speaker} onChange={v=>setSessForm(f=>({...f,speaker:v}))} placeholder="Name of minister or speaker" />
            <Input label="Venue / Location" value={sessForm.venue} onChange={v=>setSessForm(f=>({...f,venue:v}))} placeholder="Hall A, Main Auditorium…" />
            <div style={{ gridColumn:'1/-1' }}>
              <Input label="Theme / Scripture" value={sessForm.scripture} onChange={v=>setSessForm(f=>({...f,scripture:v}))} placeholder="e.g. John 15:5 — Abide in Me" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <Input label="Notes / Description" value={sessForm.notes} onChange={v=>setSessForm(f=>({...f,notes:v}))} placeholder="Any additional information…" rows={3} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={saveSession} disabled={saving} style={btnStyle('var(--brand-mid)')}>{saving?'Saving…':'Save Session'}</button>
            <button onClick={() => setSessionModal(null)} style={btnStyle('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <Modal onClose={() => setDelConfirm(null)} title="Confirm Delete">
          <p style={{ color:'var(--text-mid)', marginBottom:20 }}>
            Delete <strong>{delConfirm.item.title || `Day ${delConfirm.item.day_number}` || 'this item'}</strong>? This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => {
              if (delConfirm.type==='programme') deleteProgramme(delConfirm.item)
              if (delConfirm.type==='day') deleteDay(delConfirm.item)
              if (delConfirm.type==='session') deleteSession(delConfirm.item)
            }} style={btnStyle('#dc2626')}>Delete</button>
            <button onClick={() => setDelConfirm(null)} style={btnStyle('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Shared button style helper ────────────────────────────────────
function btnStyle(bg, size='normal') {
  const small = size==='small'
  return {
    padding: small ? '6px 14px' : '10px 22px',
    borderRadius: 30, border:'none', cursor:'pointer',
    background: bg, color:'white', fontWeight:700,
    fontSize: small ? '0.78rem' : '0.88rem',
    fontFamily:'var(--font-body)', whiteSpace:'nowrap',
    transition:'opacity 0.15s',
  }
}

// ── Modal wrapper ─────────────────────────────────────────────────
function Modal({ children, title, onClose, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:20 }}>
      <div style={{ background:'white', borderRadius:18, padding:'28px 28px 24px', width:'100%', maxWidth: wide ? 680 : 480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.35)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', margin:0, fontSize:'1.15rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'var(--text-light)', lineHeight:1, padding:0 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
