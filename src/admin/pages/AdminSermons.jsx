import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { getAll, insert, update, remove } from '../supabase'

const EMPTY = { title:'', preacher:'', date:'', series:'', scripture:'', video_url:'', audio_url:'', description:'', duration:'', thumbnail:'' }

export default function AdminSermons() {
  const { showToast, logAction } = useAdmin()
  const [items, setItems]   = useState([])
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId]   = useState(null)

  const load = () => getAll('sermons', 'date').then(({data})=>{ setItems(data); setLoading(false) })
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const { error } = id ? await update('sermons', id, rest) : await insert('sermons', rest)
    if (!error) { showToast(id?'Sermon updated!':'Sermon added!'); logAction(id?'sermon_edit':'sermon_add', (id?'Updated':'Added')+' sermon: '+(form.title||''), form.title||null); setForm(null); load() }
    else showToast(error.message, 'error')
    setSaving(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    const err = await remove('sermons', delId)
    if (!err) { showToast('Deleted'); logAction('sermon_delete','Deleted sermon',null); setItems(i=>i.filter(x=>x.id!==delId)) }
    else showToast(err.message, 'error')
    setSaving(false); setDelId(null)
  }

  const F = k => ({ value: form?.[k]||'', onChange: e=>setForm(f=>({...f,[k]:e.target.value})) })

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'var(--text-light)' }}>Loading sermons...</div>

  if (form !== null) return (
    <div>
      <PageHeader icon="🎙" title={form.id?'Edit Sermon':'New Sermon'} />
      <AdminCard style={{ maxWidth:720 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Sermon Title *</label><input {...F('title')} required placeholder="e.g. Walking by Faith" /></div>
            <div className="form-group"><label>Preacher *</label><input {...F('preacher')} required placeholder="e.g. Pastor John Mensah" /></div>
            <div className="form-group"><label>Date *</label><input type="date" {...F('date')} required /></div>
            <div className="form-group"><label>Series</label><input {...F('series')} placeholder="e.g. Faith Foundations" /></div>
            <div className="form-group"><label>Scripture</label><input {...F('scripture')} placeholder="e.g. Hebrews 11:1-6" /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Video URL</label><input {...F('video_url')} placeholder="YouTube or Vimeo link" /></div>
            <div className="form-group"><label>Audio URL</label><input {...F('audio_url')} placeholder="MP3 link" /></div>
            <div className="form-group"><label>Duration</label><input {...F('duration')} placeholder="e.g. 45 min" /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Thumbnail URL</label><input {...F('thumbnail')} placeholder="https://..." /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Description</label><textarea {...F('description')} rows={4} style={{ resize:'vertical' }} /></div>
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>{saving?'⏳ Saving...':'💾 Save Sermon'}</button>
            <button type="button" className="btn btn-outline-blue" onClick={()=>setForm(null)}>Cancel</button>
          </div>
        </form>
      </AdminCard>
    </div>
  )

  return (
    <div>
      <PageHeader icon="🎙" title="Sermons" subtitle={`${items.length} sermon${items.length!==1?'s':''}`}
        action={<button className="btn btn-blue" onClick={()=>setForm({...EMPTY})}>+ New Sermon</button>} />
      {items.length===0&&<AdminCard><div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-light)' }}>No sermons yet.</div></AdminCard>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {items.map(item=>(
          <AdminCard key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:4 }}>{item.title}</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text-mid)' }}>{item.preacher} · {item.date}{item.series&&` · ${item.series}`}{item.scripture&&` · ${item.scripture}`}</div>
              <div style={{ marginTop:6, display:'flex', gap:8 }}>
                {item.video_url&&<span style={{ fontSize:'0.7rem', background:'var(--brand-pale)', color:'var(--brand-light)', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>📹 Video</span>}
                {item.audio_url&&<span style={{ fontSize:'0.7rem', background:'#f0fdf4', color:'#166534', padding:'2px 10px', borderRadius:20, fontWeight:700 }}>🎵 Audio</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-outline-blue" style={{ padding:'7px 16px', fontSize:'0.82rem' }} onClick={()=>setForm(item)}>✏️ Edit</button>
              <button style={{ padding:'7px 16px', borderRadius:30, border:'1.5px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:'0.82rem', fontFamily:'var(--font-body)' }} onClick={()=>setDelId(item.id)}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>
      {delId&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'white', borderRadius:16, padding:32, maxWidth:360, width:'90%', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div>
            <h3 style={{ color:'var(--brand-deep)', margin:'0 0 8px' }}>Delete Sermon?</h3>
            <p style={{ color:'var(--text-mid)', marginBottom:24 }}>This cannot be undone.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button className="btn btn-blue" onClick={handleDelete} disabled={saving}>{saving?'...':'Yes, Delete'}</button>
              <button className="btn btn-outline-blue" onClick={()=>setDelId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
