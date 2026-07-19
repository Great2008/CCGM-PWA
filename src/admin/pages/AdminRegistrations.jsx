import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

export default function AdminRegistrations() {
  const { showToast } = useAdmin()
  const [events, setEvents]     = useState([])
  const [selected, setSelected] = useState(null)
  const [regs, setRegs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    supabaseAdmin.from('events').select('id,title,date,time,location,registration_url')
      .order('date', { ascending: false })
      .then(({ data }) => { setEvents(data||[]); setLoading(false) })
  }, [])

  const loadRegs = async (event) => {
    setSelected(event); setLoadingRegs(true)
    const { data } = await supabaseAdmin
      .from('event_registrations')
      .select('*, profiles(display_name,full_name,email,avatar_url)')
      .eq('event_id', event.id)
      .order('registered_at', { ascending: false })
    setRegs(data||[]); setLoadingRegs(false)
  }

  const removeReg = async (id) => {
    if (!window.confirm('Remove this registration?')) return
    const { error } = await supabaseAdmin.from('event_registrations').delete().eq('id', id)
    if (!error) { setRegs(r=>r.filter(x=>x.id!==id)); showToast('Removed') }
    else showToast(error.message,'error')
  }

  const exportCSV = () => {
    const rows = [['Name','Email','Registered At','Notes']]
    regs.forEach(r => {
      const p = r.profiles||{}
      rows.push([p.display_name||p.full_name||'', p.email||'', new Date(r.registered_at).toLocaleString(), r.notes||''])
    })
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = `${selected.title.replace(/\s+/g,'-')}-registrations.csv`
    a.click()
  }

  const filteredRegs = regs.filter(r => {
    const p = r.profiles||{}
    const name = (p.display_name||p.full_name||'').toLowerCase()
    const email = (p.email||'').toLowerCase()
    return !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase())
  })

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading events...</div>

  return (
    <div>
      <PageHeader icon="📋" title="Event Registrations" subtitle="View RSVPs for each event" />

      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:20,alignItems:'start'}} className="reg-grid">

        {/* Event list */}
        <div style={{background:'white',borderRadius:16,boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid #f1f5f9',fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem'}}>
            Select an Event
          </div>
          {events.length===0 && (
            <div style={{padding:32,textAlign:'center',color:'var(--text-light)',fontSize:'0.85rem'}}>No events found</div>
          )}
          {events.map(ev=>(
            <div key={ev.id} onClick={()=>loadRegs(ev)}
              style={{padding:'14px 16px',cursor:'pointer',borderBottom:'1px solid #f8fafc',
                background:selected?.id===ev.id?'var(--brand-pale)':'white',
                borderLeft:`3px solid ${selected?.id===ev.id?'var(--brand-light)':'transparent'}`,
                transition:'all 0.15s'}}>
              <div style={{fontWeight:600,color:'var(--brand-deep)',fontSize:'0.88rem',marginBottom:3}}>{ev.title}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>
                📅 {ev.date}{ev.time&&` · ${ev.time}`}
              </div>
              {ev.location&&<div style={{fontSize:'0.72rem',color:'var(--text-light)',marginTop:1}}>📍 {ev.location}</div>}
            </div>
          ))}
        </div>

        {/* Registrations panel */}
        <div>
          {!selected ? (
            <div style={{background:'white',borderRadius:16,padding:60,textAlign:'center',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0'}}>
              <div style={{fontSize:'2.5rem',marginBottom:12}}>📋</div>
              <div style={{color:'var(--text-light)'}}>Select an event to view registrations</div>
            </div>
          ) : (
            <div>
              <div style={{background:'white',borderRadius:16,padding:'20px 24px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                  <div>
                    <h3 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',margin:'0 0 4px',fontSize:'1.2rem'}}>{selected.title}</h3>
                    <div style={{fontSize:'0.82rem',color:'var(--text-light)'}}>
                      📅 {selected.date}{selected.time&&` · ${selected.time}`}
                      {selected.location&&<span> · 📍 {selected.location}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{background:'var(--brand-pale)',borderRadius:20,padding:'6px 16px',fontWeight:900,color:'var(--brand-light)',fontSize:'0.88rem'}}>
                      {regs.length} RSVPs
                    </div>
                    {regs.length>0 && (
                      <button onClick={exportCSV} className="btn btn-outline-blue" style={{fontSize:'0.82rem',padding:'7px 14px'}}>
                        📥 Export CSV
                      </button>
                    )}
                  </div>
                </div>
                {regs.length > 0 && (
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search attendees..."
                    style={{width:'100%',marginTop:14,padding:'9px 12px',borderRadius:9,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.85rem',boxSizing:'border-box'}} />
                )}
              </div>

              {loadingRegs ? (
                <div style={{textAlign:'center',padding:40,color:'var(--text-light)'}}>Loading registrations...</div>
              ) : regs.length===0 ? (
                <div style={{background:'white',borderRadius:14,padding:40,textAlign:'center',border:'1.5px dashed #e2e8f0',color:'var(--text-light)'}}>
                  <div style={{fontSize:'2rem',marginBottom:8}}>📭</div>
                  No registrations yet for this event.
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {filteredRegs.map((r,i)=>{
                    const p = r.profiles||{}
                    const name = p.display_name||p.full_name||'Member'
                    return (
                      <div key={r.id} style={{background:'white',borderRadius:12,padding:'14px 18px',boxShadow:'var(--shadow-sm)',border:'1.5px solid #e2e8f0',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                        <div style={{width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'0.9rem',flexShrink:0}}>
                          {p.avatar_url?<img src={p.avatar_url} alt="" style={{width:38,height:38,borderRadius:'50%',objectFit:'cover'}}/>:name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.9rem'}}>{name}</div>
                          <div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>{p.email}</div>
                          {r.notes&&<div style={{fontSize:'0.78rem',color:'var(--text-mid)',marginTop:3,fontStyle:'italic'}}>"{r.notes}"</div>}
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:'0.72rem',color:'var(--text-light)',marginBottom:6}}>{new Date(r.registered_at).toLocaleDateString()}</div>
                          <button onClick={()=>removeReg(r.id)} style={{background:'#fff5f5',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:'0.74rem',fontFamily:'var(--font-body)',fontWeight:700}}>Remove</button>
                        </div>
                      </div>
                    )
                  })}
                  {filteredRegs.length===0&&search&&(
                    <div style={{textAlign:'center',padding:24,color:'var(--text-light)',fontSize:'0.85rem'}}>No attendees match "{search}"</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@media(max-width:768px){.reg-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  )
}
