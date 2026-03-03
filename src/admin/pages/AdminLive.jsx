import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getContent, setContent } from '../supabase'
import supabaseAdmin from '../../lib/supabaseAdmin'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const ICONS = ['📡','🌟','🙏','📖','⛪','🔥','✨','🤝','🎵','✝','🎤','🏛','🎊','📢']

const EMPTY_EVENT = { title:'', date:'', time:'', description:'', icon:'🎊', broadcast:true }

const DEFAULT = {
  isLive: false,
  liveTitle: 'Saturday Divine Service',
  liveDescription: 'Join us live as we worship together.',
  youtubeUrl: '',
  facebookUrl: '',
  schedule: [
    { day:'Sunday',    name:'Meetings of Different Bodies', time:'', icon:'🤝', broadcast:false },
    { day:'Monday',    name:"Children's Prayer",            time:'', icon:'🙏', broadcast:false },
    { day:'Tuesday',   name:'Bible Study',                  time:'', icon:'📖', broadcast:false },
    { day:'Wednesday', name:'Midweek Service',              time:'', icon:'⛪', broadcast:false },
    { day:'Thursday',  name:'Deliverance Service',          time:'', icon:'🔥', broadcast:false },
    { day:'Friday',    name:'Sabbath Preparation',          time:'', icon:'✨', broadcast:false },
    { day:'Saturday',  name:'Divine Service',               time:'', icon:'🌟', broadcast:true  },
  ],
  specialEvents: [],
}

export default function AdminLive() {
  const { showToast } = useAdmin()
  const [data, setData]     = useState(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [savedLive, setSavedLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab]       = useState('stream')

  useEffect(() => {
    getContent('live').then(d => {
      if (d) { setSavedLive(!!d.isLive); setData(prev => ({
        ...prev, ...d,
        schedule: d.schedule || prev.schedule,
        specialEvents: d.specialEvents || [],
      }))}
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const wasLive = savedLive
    try {
      await setContent('live', data)
      showToast('Live settings saved!')
      // Auto-send push notification when going live
      if (data.isLive && !wasLive) {
        try {
          const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*')
          if (subs?.length) {
            await supabaseAdmin.functions.invoke('send-push', {
              body: {
                subscriptions: subs,
                payload: {
                  title: '🔴 CCG World is Live!',
                  body: data.liveTitle || 'We are live now — join us for today\'s service!',
                  url: '/live', tag: 'live', requireInteraction: true,
                }
              }
            })
            showToast("Live notification sent to " + subs.length + " subscribers!")
          }
        } catch(e) { console.log('Push skipped:', e.message) }
      }
      setSavedLive(data.isLive)
    }
    catch(e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const updateSchedule = (i, key, val) => {
    const s = [...data.schedule]; s[i] = { ...s[i], [key]: val }
    setData(d => ({ ...d, schedule: s }))
  }

  const addSpecialEvent = () => {
    setData(d => ({ ...d, specialEvents: [...(d.specialEvents||[]), { ...EMPTY_EVENT }] }))
  }

  const updateSpecialEvent = (i, key, val) => {
    const ev = [...(data.specialEvents||[])]; ev[i] = { ...ev[i], [key]: val }
    setData(d => ({ ...d, specialEvents: ev }))
  }

  const removeSpecialEvent = (i) => {
    setData(d => ({ ...d, specialEvents: d.specialEvents.filter((_,idx)=>idx!==i) }))
  }

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading...</div>

  const TABS = [['stream','📡 Stream'],['schedule','📅 Schedule'],['events','🎊 Special Events']]

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>📡 Live Stream</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>Manage broadcasts, schedule and special events</p>
        </div>
        <button className="btn btn-green" onClick={save} disabled={saving}>{saving?'⏳ Saving...':'💾 Save All'}</button>
      </div>

      {/* LIVE TOGGLE — always visible */}
      <div style={{background:data.isLive?'linear-gradient(135deg,#dc2626,#b91c1c)':'white',borderRadius:16,padding:'20px 24px',marginBottom:20,boxShadow:'var(--shadow-sm)',border:data.isLive?'none':'1.5px solid #e2e8f0',transition:'all 0.3s'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'1.1rem',color:data.isLive?'white':'var(--brand-deep)',marginBottom:3}}>
              {data.isLive?'🔴 You Are Live!':'⚫ Stream is Offline'}
            </div>
            <div style={{fontSize:'0.84rem',color:data.isLive?'rgba(255,255,255,0.8)':'var(--text-light)'}}>
              {data.isLive?'Members can see your live stream right now.':'Toggle on when your service begins.'}
            </div>
          </div>
          <div onClick={()=>setData(d=>({...d,isLive:!d.isLive}))} style={{width:72,height:38,borderRadius:30,cursor:'pointer',position:'relative',background:data.isLive?'rgba(255,255,255,0.3)':'#e2e8f0',transition:'background 0.3s',flexShrink:0,border:data.isLive?'2px solid rgba(255,255,255,0.5)':'2px solid #cbd5e1'}}>
            <div style={{position:'absolute',top:3,left:data.isLive?36:3,width:28,height:28,borderRadius:'50%',background:data.isLive?'white':'#94a3b8',transition:'left 0.25s',boxShadow:'0 2px 6px rgba(0,0,0,0.2)'}} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'8px 18px',borderRadius:30,border:'1.5px solid',borderColor:tab===id?'var(--brand-light)':'#e2e8f0',background:tab===id?'var(--brand-light)':'white',color:tab===id?'white':'var(--text-mid)',fontSize:'0.82rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
            {label}
          </button>
        ))}
      </div>

      {/* STREAM TAB */}
      {tab==='stream' && (
        <div style={{background:'white',borderRadius:16,padding:'24px 28px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
          <h3 style={{margin:'0 0 18px',color:'var(--brand-deep)',fontFamily:'var(--font-display)'}}>Stream Details</h3>
          <div className="form-group">
            <label>Stream Title (shown to viewers)</label>
            <input value={data.liveTitle} onChange={e=>setData(d=>({...d,liveTitle:e.target.value}))} placeholder="e.g. Saturday Divine Service" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={data.liveDescription} onChange={e=>setData(d=>({...d,liveDescription:e.target.value}))} rows={2} placeholder="e.g. Join us as we worship together." style={{resize:'vertical'}} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="form-group" style={{margin:0}}>
              <label>▶ YouTube Live URL</label>
              <input value={data.youtubeUrl} onChange={e=>setData(d=>({...d,youtubeUrl:e.target.value}))} placeholder="https://youtube.com/live/..." />
              <small style={{color:'var(--text-light)',fontSize:'0.74rem'}}>Paste the live video URL from YouTube Studio</small>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>📘 Facebook Live URL</label>
              <input value={data.facebookUrl} onChange={e=>setData(d=>({...d,facebookUrl:e.target.value}))} placeholder="https://facebook.com/..." />
              <small style={{color:'var(--text-light)',fontSize:'0.74rem'}}>Paste the Facebook live video URL</small>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {tab==='schedule' && (
        <div style={{background:'white',borderRadius:16,padding:'24px 28px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
          <h3 style={{margin:'0 0 6px',color:'var(--brand-deep)',fontFamily:'var(--font-display)'}}>Weekly Broadcast Schedule</h3>
          <p style={{color:'var(--text-light)',fontSize:'0.85rem',marginBottom:20}}>Toggle which services you stream live. These appear in the countdown on the Live page.</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {data.schedule.map((s,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'36px 40px 100px 1fr 140px',gap:10,alignItems:'center',padding:'12px 14px',borderRadius:10,background:s.broadcast?(s.day==='Saturday'?'#fffbf0':'#f0fdf4'):'#f8fafc',border:s.broadcast?(s.day==='Saturday'?'1.5px solid #fcd34d':'1.5px solid #bbf7d0'):'1.5px solid #e2e8f0'}}>
                <div onClick={()=>updateSchedule(i,'broadcast',!s.broadcast)} style={{width:28,height:16,borderRadius:10,background:s.broadcast?'var(--brand-light)':'#cbd5e1',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:s.broadcast?12:2,width:12,height:12,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
                </div>
                <select value={s.icon||'📡'} onChange={e=>updateSchedule(i,'icon',e.target.value)} style={{padding:'4px 2px',borderRadius:6,border:'1.5px solid #e2e8f0',fontSize:'1.1rem',background:'white',cursor:'pointer'}}>
                  {ICONS.map(ic=><option key={ic} value={ic}>{ic}</option>)}
                </select>
                <div style={{fontWeight:700,fontSize:'0.8rem',color:s.day==='Saturday'?'#b45309':'var(--brand-deep)'}}>{s.day}</div>
                <input value={s.name} onChange={e=>updateSchedule(i,'name',e.target.value)} style={{padding:'7px 10px',borderRadius:7,border:'1.5px solid #e2e8f0',width:'100%',fontFamily:'var(--font-body)',fontSize:'0.88rem',boxSizing:'border-box'}} />
                <input value={s.time} onChange={e=>updateSchedule(i,'time',e.target.value)} placeholder="e.g. 9:00 AM" style={{padding:'7px 10px',borderRadius:7,border:'1.5px solid #e2e8f0',width:'100%',fontFamily:'var(--font-body)',fontSize:'0.88rem',boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
          <p style={{fontSize:'0.76rem',color:'var(--text-light)',marginTop:12}}>💡 Toggle the switch to include a service in the live schedule and countdown.</p>
        </div>
      )}

      {/* SPECIAL EVENTS TAB */}
      {tab==='events' && (
        <div>
          <div style={{background:'white',borderRadius:16,padding:'24px 28px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:12}}>
              <div>
                <h3 style={{margin:'0 0 4px',color:'var(--brand-deep)',fontFamily:'var(--font-display)'}}>Special Events</h3>
                <p style={{color:'var(--text-light)',fontSize:'0.85rem',margin:0}}>Add one-off broadcasts like conferences, crusades, anniversaries, or special services. These show on the Live page with their own countdown.</p>
              </div>
              <button onClick={addSpecialEvent} className="btn btn-blue" style={{padding:'9px 20px',fontSize:'0.85rem',whiteSpace:'nowrap'}}>+ Add Event</button>
            </div>
          </div>

          {(!data.specialEvents||data.specialEvents.length===0) && (
            <div style={{background:'white',borderRadius:14,padding:'48px 20px',textAlign:'center',color:'var(--text-light)',border:'1.5px dashed #e2e8f0'}}>
              <div style={{fontSize:'2.5rem',marginBottom:12}}>🎊</div>
              <div style={{fontWeight:600,color:'var(--brand-deep)',marginBottom:6}}>No special events yet</div>
              <div style={{fontSize:'0.85rem'}}>Add upcoming conferences, crusades, or special services above.</div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {(data.specialEvents||[]).map((ev,i)=>(
              <div key={i} style={{background:'white',borderRadius:14,padding:'20px 22px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <select value={ev.icon||'🎊'} onChange={e=>updateSpecialEvent(i,'icon',e.target.value)} style={{fontSize:'1.4rem',border:'none',background:'transparent',cursor:'pointer',padding:'2px'}}>
                      {ICONS.map(ic=><option key={ic} value={ic}>{ic}</option>)}
                    </select>
                    <span style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem'}}>Special Event #{i+1}</span>
                  </div>
                  <button onClick={()=>removeSpecialEvent(i)} style={{background:'#fff5f5',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'5px 12px',cursor:'pointer',fontSize:'0.8rem',fontFamily:'var(--font-body)',fontWeight:700}}>Remove</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div className="form-group" style={{margin:0,gridColumn:'1/-1'}}>
                    <label>Event Title *</label>
                    <input value={ev.title} onChange={e=>updateSpecialEvent(i,'title',e.target.value)} placeholder="e.g. Annual Conference 2026, Easter Crusade, Youth Convention" />
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label>Date *</label>
                    <input type="date" value={ev.date} onChange={e=>updateSpecialEvent(i,'date',e.target.value)} />
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label>Time</label>
                    <input value={ev.time} onChange={e=>updateSpecialEvent(i,'time',e.target.value)} placeholder="e.g. 9:00 AM" />
                  </div>
                  <div className="form-group" style={{margin:0,gridColumn:'1/-1'}}>
                    <label>Description</label>
                    <textarea value={ev.description} onChange={e=>updateSpecialEvent(i,'description',e.target.value)} rows={2} placeholder="Brief description of the event..." style={{resize:'vertical'}} />
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                      <input type="checkbox" checked={ev.broadcast!==false} onChange={e=>updateSpecialEvent(i,'broadcast',e.target.checked)} style={{width:16,height:16}} />
                      Show countdown on Live page
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:22}}>
        <button className="btn btn-green" onClick={save} disabled={saving} style={{padding:'12px 32px',fontSize:'0.95rem'}}>
          {saving?'⏳ Saving...':'💾 Save All Live Settings'}
        </button>
      </div>
    </div>
  )
}
