import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { getAll, insert, update, remove } from '../supabase'

const EMPTY = { title:'', date:'', end_date:'', time:'', location:'', category:'', description:'', image_url:'', registration_url:'' }
const CATS = ['Worship','Fellowship','Youth','Outreach','Conference','Prayer','Special']

export default function AdminEvents() {
  const { showToast, logAction } = useAdmin()
  const [items, setItems] = useState([])
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId] = useState(null)

  const load = () => getAll('events','date').then(({data})=>{ setItems(data); setLoading(false) })
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const { error } = id ? await update('events',id,rest) : await insert('events',rest)
    if (!error) { showToast(id?'Event updated!':'Event added!'); logAction(id?'event_edit':'event_add', (id?'Updated':'Added')+' event: '+(form.title||''), form.title||null); setForm(null); load() }
    else showToast(error.message,'error')
    setSaving(false)
  }
  const handleDelete = async () => {
    setSaving(true); const err = await remove('events',delId)
    if (!err) { showToast('Deleted'); logAction('event_delete','Deleted event',null); setItems(i=>i.filter(x=>x.id!==delId)) }
    else showToast(err.message,'error'); setSaving(false); setDelId(null)
  }
  const F = k => ({ value:form?.[k]||'', onChange:e=>setForm(f=>({...f,[k]:e.target.value})) })
  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'var(--text-light)' }}>Loading events...</div>

  if (form !== null) return (
    <div>
      <PageHeader icon="📅" title={form.id?'Edit Event':'New Event'} />
      <AdminCard style={{ maxWidth:720 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Title *</label><input {...F('title')} required /></div>
            <div className="form-group"><label>Date *</label><input type="date" {...F('date')} required /></div>
            <div className="form-group"><label>End Date</label><input type="date" {...F('end_date')} /></div>
            <div className="form-group"><label>Time</label><input {...F('time')} placeholder="9:00 AM – 12:00 PM" /></div>
            <div className="form-group"><label>Category</label><select {...F('category')} style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', width:'100%', fontFamily:'var(--font-body)' }}><option value="">Select</option>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Location</label><input {...F('location')} /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Image URL</label><input {...F('image_url')} placeholder="https://..." /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Registration URL</label><input {...F('registration_url')} /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Description</label><textarea {...F('description')} rows={4} style={{ resize:'vertical' }} /></div>
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>{saving?'⏳ Saving...':'💾 Save Event'}</button>
            <button type="button" className="btn btn-outline-blue" onClick={()=>setForm(null)}>Cancel</button>
          </div>
        </form>
      </AdminCard>
    </div>
  )

  const upcoming = items.filter(i=>i.date>=today), past = items.filter(i=>i.date<today)
  const Row = ({item}) => (
    <AdminCard style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:4 }}>{item.title}</div>
        <div style={{ fontSize:'0.82rem', color:'var(--text-mid)' }}>📅 {item.date}{item.time&&` · ⏰ ${item.time}`}{item.location&&` · 📍 ${item.location}`}</div>
        {item.category&&<span style={{ display:'inline-block', marginTop:6, fontSize:'0.7rem', background:'var(--brand-pale)', color:'var(--brand-light)', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>{item.category}</span>}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-outline-blue" style={{ padding:'7px 16px', fontSize:'0.82rem' }} onClick={()=>setForm(item)}>✏️ Edit</button>
        <button style={{ padding:'7px 16px', borderRadius:30, border:'1.5px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:'0.82rem', fontFamily:'var(--font-body)' }} onClick={()=>setDelId(item.id)}>🗑</button>
      </div>
    </AdminCard>
  )

  return (
    <div>
      <PageHeader icon="📅" title="Events" subtitle={`${upcoming.length} upcoming · ${past.length} past`} action={<button className="btn btn-blue" onClick={()=>setForm({...EMPTY})}>+ New Event</button>} />
      {items.length===0&&<AdminCard><div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-light)' }}>No events yet.</div></AdminCard>}
      {upcoming.length>0&&<><h3 style={{ color:'var(--brand-deep)', marginBottom:12 }}>Upcoming</h3><div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>{upcoming.map(i=><Row key={i.id} item={i}/>)}</div></>}
      {past.length>0&&<><h3 style={{ color:'var(--text-mid)', marginBottom:12 }}>Past Events</h3><div style={{ display:'flex', flexDirection:'column', gap:12 }}>{past.map(i=><Row key={i.id} item={i}/>)}</div></>}
      {delId&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}><div style={{ background:'white', borderRadius:16, padding:32, maxWidth:360, width:'90%', textAlign:'center' }}><div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div><h3 style={{ color:'var(--brand-deep)', margin:'0 0 8px' }}>Delete Event?</h3><p style={{ color:'var(--text-mid)', marginBottom:24 }}>This cannot be undone.</p><div style={{ display:'flex', gap:12, justifyContent:'center' }}><button className="btn btn-blue" onClick={handleDelete} disabled={saving}>{saving?'...':'Yes, Delete'}</button><button className="btn btn-outline-blue" onClick={()=>setDelId(null)}>Cancel</button></div></div></div>}
    </div>
  )
}
