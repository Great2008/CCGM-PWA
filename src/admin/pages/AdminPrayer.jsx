import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import supabase from '../../lib/supabase'

const SC = { new:{bg:'#eff6ff',text:'#1d4ed8',label:'New'}, praying:{bg:'#dcfce7',text:'#166534',label:'Praying'}, answered:{bg:'#fef9c3',text:'#854d0e',label:'Answered'}, closed:{bg:'#f5f5f5',text:'#6b7280',label:'Closed'} }

export default function AdminPrayer() {
  const { showToast, logAction } = useAdmin()
  const [tab, setTab]         = useState('wall') // 'wall' | 'requests'
  const [items, setItems]     = useState([])
  const [wallItems, setWallItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('all')

  const load = async () => {
    setLoading(true)
    const [req, wall] = await Promise.all([
      supabase.from('prayers').select('*').order('submitted_at', { ascending: false }),
      supabase.from('prayer_requests').select('*, prayer_counts:prayer_prays(count), reply_count:prayer_replies(count)').order('created_at', { ascending: false })
    ])
    setItems(req.data||[])
    setWallItems((wall.data||[]).map(p=>({ ...p, pray_count: p.prayer_counts?.[0]?.count||0, reply_count: p.reply_count?.[0]?.count||0 })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    setSaving(true)
    await supabase.from('prayers').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    logAction('prayer_status', `Updated prayer status to ${status}`, null); showToast('Status updated'); load()
    if (selected?.id===id) setSelected(s=>({...s,status}))
    setSaving(false)
  }

  const addNote = async (id) => {
    if (!note.trim()) return; setSaving(true)
    const item = items.find(i=>i.id===id)
    const notes = [...(item?.notes||[]), { text:note.trim(), date:new Date().toLocaleDateString(), by:'Admin' }]
    await supabase.from('prayers').update({ notes, updated_at:new Date().toISOString() }).eq('id', id)
    logAction('prayer_note', 'Added note to prayer request', null); showToast('Note added'); setNote(''); load()
    setSaving(false)
  }

  const deleteReq = async id => {
    await supabase.from('prayers').delete().eq('id', id)
    logAction('prayer_delete', 'Deleted prayer request', null); setItems(i=>i.filter(x=>x.id!==id)); setSelected(null); showToast('Deleted')
  }

  const deleteWallPost = async id => {
    await supabase.from('prayer_prays').delete().eq('prayer_id', id)
    await supabase.from('prayer_replies').delete().eq('prayer_id', id)
    await supabase.from('prayer_requests').delete().eq('id', id)
    setWallItems(i=>i.filter(x=>x.id!==id)); showToast('Deleted')
  }

  const filtered = filter==='all' ? items : items.filter(i=>(i.status||'new')===filter)
  const counts = { new:items.filter(i=>!i.status||i.status==='new').length, praying:items.filter(i=>i.status==='praying').length, answered:items.filter(i=>i.status==='answered').length }

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'var(--text-light)' }}>Loading...</div>

  return (
    <div>
      <PageHeader icon="🙏" title="Prayer" subtitle={`${items.length} form requests · ${wallItems.length} wall posts`} />

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button onClick={()=>setTab('wall')} style={{ padding:'9px 22px', borderRadius:30, border:'1.5px solid', borderColor:tab==='wall'?'var(--brand-light)':'#e2e8f0', background:tab==='wall'?'var(--brand-light)':'white', color:tab==='wall'?'white':'var(--text-mid)', fontSize:'0.85rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
          🙏 Prayer Wall ({wallItems.length})
        </button>
        <button onClick={()=>setTab('requests')} style={{ padding:'9px 22px', borderRadius:30, border:'1.5px solid', borderColor:tab==='requests'?'var(--brand-light)':'#e2e8f0', background:tab==='requests'?'var(--brand-light)':'white', color:tab==='requests'?'white':'var(--text-mid)', fontSize:'0.85rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
          📋 Form Requests ({items.length})
        </button>
      </div>

      {/* Prayer Wall tab */}
      {tab==='wall' && (
        <div>
          {wallItems.length===0 && <AdminCard><div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-light)'}}>No prayer wall posts yet.</div></AdminCard>}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {wallItems.map(item=>(
              <AdminCard key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
                    {item.category&&<span style={{fontSize:'0.68rem',background:'var(--brand-pale)',color:'var(--brand-light)',padding:'2px 10px',borderRadius:20,fontWeight:700}}>{item.category}</span>}
                    <span style={{fontSize:'0.72rem',color:'var(--text-light)'}}>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{margin:'0 0 8px',color:'var(--text-dark)',fontSize:'0.9rem',lineHeight:1.7}}>{item.request}</p>
                  <div style={{display:'flex',gap:12,fontSize:'0.78rem',color:'var(--text-light)'}}>
                    <span>🙏 {item.pray_count} praying</span>
                    <span>💬 {item.reply_count} replies</span>
                  </div>
                </div>
                <button onClick={()=>deleteWallPost(item.id)} style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',cursor:'pointer',fontSize:'0.78rem',fontFamily:'var(--font-body)',flexShrink:0}}>🗑 Delete</button>
              </AdminCard>
            ))}
          </div>
        </div>
      )}

      {/* Form Requests tab */}
      {tab==='requests' && <>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[['all','All'],['new',`New (${counts.new})`],['praying','Praying'],['answered','Answered'],['closed','Closed']].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ padding:'8px 18px', borderRadius:30, border:'1.5px solid', borderColor:filter===id?'var(--brand-light)':'#e2e8f0', background:filter===id?'var(--brand-light)':'white', color:filter===id?'white':'var(--text-mid)', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>{label}</button>
        ))}
      </div>
      {filtered.length===0&&<AdminCard><div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-light)' }}>No requests here.</div></AdminCard>}
      <div style={{ display:'grid', gridTemplateColumns:selected?'1fr 360px':'1fr', gap:20, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(item=>{
            const sc=SC[item.status||'new']||SC.new
            return(
              <div key={item.id} onClick={()=>setSelected(item)} style={{ background:selected?.id===item.id?'var(--brand-pale)':'white', borderRadius:12, padding:'16px 18px', cursor:'pointer', boxShadow:'var(--shadow-sm)', borderLeft:`4px solid ${selected?.id===item.id?'var(--brand-light)':'transparent'}`, transition:'all 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:4 }}>{item.name||'Anonymous'}</div>
                    <div style={{ fontSize:'0.82rem', color:'var(--text-mid)', lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.request}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-light)', marginTop:6 }}>{item.email&&`📧 ${item.email} · `}{new Date(item.submitted_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ padding:'3px 12px', borderRadius:20, fontSize:'0.68rem', fontWeight:700, background:sc.bg, color:sc.text, flexShrink:0 }}>{sc.label}</span>
                </div>
              </div>
            )
          })}
        </div>
        {selected&&(
          <div style={{ position:'sticky', top:20 }}>
            <AdminCard>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <h3 style={{ margin:0, color:'var(--brand-deep)', fontSize:'1rem' }}>{selected.name||'Anonymous'}</h3>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'var(--text-light)' }}>✕</button>
              </div>
              {selected.email&&<div style={{ fontSize:'0.82rem', color:'var(--text-mid)', marginBottom:12 }}>📧 {selected.email}</div>}
              <div style={{ background:'var(--brand-pale)', borderRadius:10, padding:14, marginBottom:16, fontSize:'0.9rem', lineHeight:1.8, color:'var(--text-dark)' }}>{selected.request}</div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-light)', marginBottom:8 }}>Status</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(SC).map(([s,c])=>(<button key={s} onClick={()=>updateStatus(selected.id,s)} disabled={saving} style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${c.bg}`, background:(selected.status||'new')===s?c.bg:'white', color:(selected.status||'new')===s?c.text:'var(--text-mid)', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>{c.label}</button>))}
                </div>
              </div>
              {selected.notes?.length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-light)', marginBottom:8 }}>Notes</div>
                  {selected.notes.map((n,i)=>(
                    <div key={i} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginBottom:8, fontSize:'0.82rem', lineHeight:1.7 }}>
                      {n.text}<div style={{ fontSize:'0.7rem', color:'var(--text-light)', marginTop:4 }}>{n.by} · {n.date}</div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-light)', marginBottom:8 }}>Add Note</div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Pastoral note..." style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.85rem', resize:'vertical', boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button className="btn btn-blue" style={{ flex:1, justifyContent:'center', fontSize:'0.82rem', padding:'8px' }} onClick={()=>addNote(selected.id)} disabled={!note.trim()||saving}>Add Note</button>
                  <button style={{ padding:'8px 14px', borderRadius:30, border:'1.5px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:'0.78rem', fontFamily:'var(--font-body)' }} onClick={()=>deleteReq(selected.id)}>🗑 Delete</button>
                </div>
              </div>
            </AdminCard>
          </div>
        )}
      </div>
    </> }
    </div>
  )
}
