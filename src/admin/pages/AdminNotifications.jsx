import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabaseAdmin'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const TEMPLATES = [
  { label:'🔴 We Are Live!', title:'CCG World is Live! 🔴', body:'We\'re live now — join us for today\'s service!', url:'/live', tag:'live' },
  { label:'📖 New Sabbath Lesson', title:'New Sabbath School Lesson', body:'This week\'s lesson is now available. Read and study along!', url:'/sabbath-school', tag:'sabbath' },
  { label:'📢 New Announcement', title:'CCG World Announcement', body:'', url:'/', tag:'announcement' },
  { label:'📅 New Event', title:'New Event Posted', body:'Check out our latest upcoming event!', url:'/events', tag:'event' },
  { label:'🎙 New Sermon', title:'New Sermon Available', body:'A new sermon has been posted. Listen now!', url:'/sermons', tag:'sermon' },
  { label:'⏰ Saturday Reminder', title:'Divine Service Tomorrow 🙏', body:'Reminder: Divine Service is tomorrow. Join us in worship!', url:'/live', tag:'reminder' },
  { label:'✍️ Custom', title:'', body:'', url:'/', tag:'general' },
]

const PAGES = ['/', '/live', '/sermons', '/events', '/blog', '/sabbath-school', '/timeline', '/about', '/contact']

const EMPTY_FORM = { title:'', body:'', url:'/', tag:'general', image:'', requireInteraction:false }

function localToISO(local) {
  // datetime-local gives "2026-06-27T17:00" — convert to UTC ISO string
  if (!local) return null
  return new Date(local).toISOString()
}

function isoToLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminNotifications() {
  const { showToast, logAction } = useAdmin()
  const [tab, setTab]           = useState('send')   // 'send' | 'schedule'
  const [subCount, setSubCount]   = useState(0)
  const [logs, setLogs]           = useState([])
  const [scheduled, setScheduled] = useState([])
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [sent, setSent]           = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [schedForm, setSchedForm] = useState({ ...EMPTY_FORM, send_at:'' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [{ count }, { data: logData }, { data: schedData }] = await Promise.all([
      supabaseAdmin.from('push_subscriptions').select('*', { count:'exact', head:true }),
      supabaseAdmin.from('notification_logs').select('*').order('sent_at', { ascending:false }).limit(20),
      supabaseAdmin.from('scheduled_notifications').select('*')
        .eq('status', 'pending').order('send_at', { ascending:true }),
    ])
    setSubCount(count || 0)
    setLogs(logData || [])
    setScheduled(schedData || [])
    setLoading(false)
  }

  const applyTemplate = (tpl, which='send') => {
    if (which==='send') setForm(f => ({ ...f, title:tpl.title, body:tpl.body, url:tpl.url, tag:tpl.tag }))
    else setSchedForm(f => ({ ...f, title:tpl.title, body:tpl.body, url:tpl.url, tag:tpl.tag }))
  }

  // ── Send Now ────────────────────────────────────────────────────────
  const sendNotification = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Title and message are required', 'error'); return
    }
    if (subCount === 0) { showToast('No subscribers yet', 'error'); return }
    if (!window.confirm(`Send this notification to ${subCount} subscribers?`)) return
    setSending(true)
    try {
      const { data: subs, error: subErr } = await supabaseAdmin.from('push_subscriptions').select('*')
      if (subErr) throw subErr
      const payload = { title:form.title, body:form.body, url:form.url, tag:form.tag,
        image:form.image||undefined, requireInteraction:form.requireInteraction,
        icon:'/icon-192.png', badge:'/icon-96.png' }
      const { data: result, error } = await supabaseAdmin.functions.invoke('send-push', { body:{ subscriptions:subs, payload } })
      if (error) throw error
      await supabaseAdmin.from('notification_logs').insert({
        title:form.title, body:form.body, url:form.url, tag:form.tag,
        recipients:subs.length, delivered:result?.delivered||subs.length,
        failed:result?.failed||0, sent_at:new Date().toISOString(),
      })
      setSent({ delivered:result?.delivered||subs.length, failed:result?.failed||0 })
      logAction('notification_sent', `Push sent to ${result?.delivered||subs.length} subscribers`, form.title)
      showToast(`Sent to ${result?.delivered||subs.length} subscribers!`)
      loadData()
    } catch(err) {
      if (err.message?.includes('FunctionNotFound')||err.message?.includes('not found')) {
        setSent({ needsSetup:true })
      } else { showToast(err.message, 'error') }
    }
    setSending(false)
  }

  // ── Schedule ─────────────────────────────────────────────────────────
  const scheduleNotification = async () => {
    if (!schedForm.title.trim() || !schedForm.body.trim()) {
      showToast('Title and message are required', 'error'); return
    }
    if (!schedForm.send_at) { showToast('Please set a date and time', 'error'); return }
    const sendAt = new Date(schedForm.send_at)
    if (sendAt <= new Date()) { showToast('Scheduled time must be in the future', 'error'); return }
    setScheduling(true)
    try {
      const { error } = await supabaseAdmin.from('scheduled_notifications').insert({
        title:schedForm.title, body:schedForm.body, url:schedForm.url, tag:schedForm.tag,
        image:schedForm.image||null, require_interaction:schedForm.requireInteraction,
        send_at:localToISO(schedForm.send_at), status:'pending',
        created_at:new Date().toISOString(),
      })
      if (error) throw error
      logAction('notification_scheduled', `Scheduled: "${schedForm.title}" for ${sendAt.toLocaleString()}`, schedForm.title)
      showToast(`📅 Scheduled for ${sendAt.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`)
      setSchedForm({ ...EMPTY_FORM, send_at:'' })
      loadData()
    } catch(err) { showToast(err.message, 'error') }
    setScheduling(false)
  }

  const cancelScheduled = async (id, title) => {
    if (!window.confirm(`Cancel scheduled notification "${title}"?`)) return
    await supabaseAdmin.from('scheduled_notifications').update({ status:'cancelled' }).eq('id', id)
    logAction('notification_cancelled', `Cancelled scheduled: "${title}"`, title)
    showToast('Notification cancelled')
    loadData()
  }

  if (loading) return (
    <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}><div style={{fontSize:'2rem',marginBottom:8}}>🔔</div>Loading...</div>
  )

  const ComposeSection = ({ which }) => {
    const f = which==='send' ? form : schedForm
    const setF = which==='send' ? setForm : setSchedForm
    return (
      <>
        <div style={{marginBottom:16}}>
          <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--text-light)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Quick Templates</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {TEMPLATES.map(t=>(
              <button key={t.label} onClick={()=>applyTemplate(t, which)}
                style={{padding:'5px 12px',borderRadius:20,border:'1.5px solid #e2e8f0',background:'white',color:'var(--text-mid)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Title *</label>
          <input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="e.g. CCG World is Live! 🔴" maxLength={80} />
          <small style={{color:'var(--text-light)',fontSize:'0.72rem'}}>{f.title.length}/80</small>
        </div>
        <div className="form-group">
          <label>Message *</label>
          <textarea value={f.body} onChange={e=>setF(p=>({...p,body:e.target.value}))}
            rows={3} placeholder="e.g. Join us now for today's Divine Service!" maxLength={200} style={{resize:'vertical'}} />
          <small style={{color:'var(--text-light)',fontSize:'0.72rem'}}>{f.body.length}/200</small>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group" style={{margin:0}}>
            <label>Open Page</label>
            <select value={f.url} onChange={e=>setF(p=>({...p,url:e.target.value}))}
              style={{padding:'10px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',width:'100%',fontFamily:'var(--font-body)',background:'white',fontSize:'0.88rem'}}>
              {PAGES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label>Image URL <span style={{fontWeight:400,color:'var(--text-light)'}}>(optional)</span></label>
            <input value={f.image} onChange={e=>setF(p=>({...p,image:e.target.value}))} placeholder="https://..." />
          </div>
        </div>
        {which==='schedule' && (
          <div className="form-group">
            <label>📅 Send at (your local time) *</label>
            <input type="datetime-local" value={f.send_at}
              min={isoToLocal(new Date().toISOString())}
              onChange={e=>setF(p=>({...p,send_at:e.target.value}))} />
          </div>
        )}
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
            <input type="checkbox" checked={f.requireInteraction}
              onChange={e=>setF(p=>({...p,requireInteraction:e.target.checked}))} style={{width:16,height:16}} />
            Keep notification visible until dismissed
          </label>
        </div>
      </>
    )
  }

  return (
    <div>
      <PageHeader icon="🔔" title="Push Notifications" subtitle={`${subCount} subscriber${subCount!==1?'s':''}`} />

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14,marginBottom:24}}>
        {[
          { icon:'📱', label:'Total Subscribers', value:subCount, color:'var(--brand-light)' },
          { icon:'📤', label:'Sent', value:logs.length, color:'#8b5cf6' },
          { icon:'⏰', label:'Scheduled', value:scheduled.length, color:'#f59e0b' },
          { icon:'✅', label:'Last Send', value:logs[0]?new Date(logs[0].sent_at).toLocaleDateString():'—', color:'#059669', small:true },
        ].map(s=>(
          <div key={s.label} style={{background:'white',borderRadius:14,padding:'18px 20px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
            <div style={{fontSize:'1.6rem',marginBottom:6}}>{s.icon}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:s.small?'1.1rem':'1.8rem',fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'0.78rem',color:'var(--text-light)',marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,background:'white',borderRadius:12,padding:4,boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',maxWidth:400}}>
        {[['send','📤 Send Now'],['schedule','⏰ Schedule']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            flex:1,padding:'10px 0',borderRadius:9,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:'0.88rem',fontFamily:'var(--font-body)',
            background:tab===k?'var(--brand-mid)':'transparent',
            color:tab===k?'white':'var(--text-mid)',transition:'all 0.2s',
          }}>{l}</button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr',gap:20,alignItems:'start'}} className="notif-grid">
        {/* Left: Compose */}
        <div>
          {tab==='send' ? (
            <AdminCard>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:16}}>📝 Compose Notification</div>
              <ComposeSection which="send" />
              <button onClick={sendNotification} disabled={sending||subCount===0}
                className="btn btn-blue" style={{width:'100%',justifyContent:'center',padding:'13px',fontSize:'0.95rem',marginTop:4}}>
                {sending?'⏳ Sending...':`📤 Send to ${subCount} Subscribers`}
              </button>
              {subCount===0&&<div style={{marginTop:12,padding:'10px 14px',background:'#fff9f0',border:'1px solid #fed7aa',borderRadius:8,fontSize:'0.8rem',color:'#c2410c'}}>⚠️ No subscribers yet.</div>}
            </AdminCard>
          ) : (
            <AdminCard>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:16}}>⏰ Schedule Notification</div>
              <ComposeSection which="schedule" />
              <button onClick={scheduleNotification} disabled={scheduling}
                className="btn btn-green" style={{width:'100%',justifyContent:'center',padding:'13px',fontSize:'0.95rem',marginTop:4}}>
                {scheduling?'⏳ Scheduling...':'📅 Schedule Notification'}
              </button>
              <p style={{fontSize:'0.75rem',color:'var(--text-light)',marginTop:10,marginBottom:0}}>
                💡 Scheduled notifications are dispatched automatically within 1 minute of the set time.
              </p>
            </AdminCard>
          )}

          {/* Preview */}
          {((tab==='send'&&(form.title||form.body))||(tab==='schedule'&&(schedForm.title||schedForm.body))) && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-light)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Preview</div>
              <div style={{background:'#1e293b',borderRadius:16,padding:'14px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.3)'}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                  <img src="/icon-96.png" alt="" style={{width:36,height:36,borderRadius:8,flexShrink:0,objectFit:'cover'}} onError={e=>{e.target.style.display='none'}} />
                  <div>
                    <div style={{fontWeight:700,color:'white',fontSize:'0.85rem',marginBottom:2}}>
                      {(tab==='send'?form.title:schedForm.title)||'Notification Title'}
                    </div>
                    <div style={{color:'rgba(255,255,255,0.7)',fontSize:'0.78rem',lineHeight:1.5}}>
                      {(tab==='send'?form.body:schedForm.body)||'Your message here...'}
                    </div>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.68rem',marginTop:4}}>
                      CCG World · {tab==='schedule'&&schedForm.send_at ? new Date(schedForm.send_at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'now'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Scheduled queue + History */}
        <div>
          {sent&&(
            <AdminCard style={{marginBottom:16,background:sent.needsSetup?'#fff9f0':sent.failed>0?'#fffbf0':'#f0fdf4',border:`1.5px solid ${sent.needsSetup?'#fed7aa':sent.failed>0?'#fcd34d':'#bbf7d0'}`}}>
              {sent.needsSetup ? (
                <>
                  <div style={{fontWeight:900,color:'#c2410c',marginBottom:12}}>⚙️ Edge Function Setup Required</div>
                  <div style={{background:'#1e293b',borderRadius:10,padding:'14px 16px',fontSize:'0.78rem',color:'#e2e8f0',fontFamily:'monospace',lineHeight:1.9,overflowX:'auto'}}>
                    <div>supabase functions deploy send-push</div>
                    <div>supabase functions deploy dispatch-scheduled</div>
                  </div>
                  <button onClick={()=>setSent(null)} className="btn btn-outline-blue" style={{marginTop:14,fontSize:'0.82rem'}}>Got it</button>
                </>
              ) : (
                <>
                  <div style={{fontWeight:900,color:sent.failed>0?'#92400e':'#166534',fontSize:'1rem',marginBottom:8}}>
                    {sent.failed>0?'⚠️ Partially Sent':'✅ Sent Successfully!'}
                  </div>
                  <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                    <div style={{textAlign:'center'}}><div style={{fontFamily:'var(--font-display)',fontSize:'1.8rem',fontWeight:900,color:'#16a34a'}}>{sent.delivered}</div><div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>Delivered</div></div>
                    {sent.failed>0&&<div style={{textAlign:'center'}}><div style={{fontFamily:'var(--font-display)',fontSize:'1.8rem',fontWeight:900,color:'#dc2626'}}>{sent.failed}</div><div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>Failed</div></div>}
                  </div>
                  <button onClick={()=>setSent(null)} className="btn btn-outline-blue" style={{marginTop:14,fontSize:'0.82rem'}}>Send Another</button>
                </>
              )}
            </AdminCard>
          )}

          {/* Scheduled queue */}
          {scheduled.length>0&&(
            <AdminCard style={{marginBottom:16}}>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:16}}>⏰ Scheduled Queue ({scheduled.length})</div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {scheduled.map((s,i)=>(
                  <div key={s.id||i} style={{padding:'12px 14px',background:'#fffbf0',borderRadius:10,borderLeft:'3px solid #f59e0b',display:'flex',gap:10,alignItems:'flex-start'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem',marginBottom:2}}>{s.title}</div>
                      <div style={{fontSize:'0.78rem',color:'var(--text-mid)',marginBottom:6,lineHeight:1.4}}>{s.body}</div>
                      <div style={{fontSize:'0.72rem',color:'#92400e',fontWeight:700}}>
                        📅 {new Date(s.send_at).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    </div>
                    <button onClick={()=>cancelScheduled(s.id,s.title)}
                      style={{flexShrink:0,padding:'5px 12px',borderRadius:20,border:'1.5px solid #fca5a5',background:'white',color:'#dc2626',fontSize:'0.72rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {/* History */}
          <AdminCard>
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand-deep)',fontSize:'1rem',marginBottom:16}}>📋 Notification History</div>
            {logs.length===0 ? (
              <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-light)',fontSize:'0.85rem'}}><div style={{fontSize:'2rem',marginBottom:8}}>📭</div>No notifications sent yet</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {logs.map((log,i)=>(
                  <div key={log.id||i} style={{padding:'12px 14px',background:'#f8fafc',borderRadius:10,borderLeft:'3px solid var(--brand-light)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                      <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem',flex:1}}>{log.title}</div>
                      <div style={{fontSize:'0.7rem',color:'var(--text-light)',flexShrink:0}}>{new Date(log.sent_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{fontSize:'0.8rem',color:'var(--text-mid)',marginBottom:6,lineHeight:1.5}}>{log.body}</div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.7rem',background:'#f0fdf4',color:'#16a34a',padding:'2px 8px',borderRadius:10,fontWeight:700}}>✅ {log.delivered||log.recipients} sent</span>
                      {log.failed>0&&<span style={{fontSize:'0.7rem',background:'#fff5f5',color:'#dc2626',padding:'2px 8px',borderRadius:10,fontWeight:700}}>❌ {log.failed} failed</span>}
                      {log.scheduled&&<span style={{fontSize:'0.7rem',background:'#fffbf0',color:'#92400e',padding:'2px 8px',borderRadius:10,fontWeight:700}}>⏰ Scheduled</span>}
                      <span style={{fontSize:'0.7rem',color:'var(--text-light)'}}>{log.url}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      </div>
      <style>{`@media(max-width:900px){.notif-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  )
}
