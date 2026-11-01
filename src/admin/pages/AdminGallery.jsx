import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { getAll, insert, update, remove } from '../supabase'

const CATS=['Worship','Events','Community','Outreach','Youth','Leadership','Baptism','Christmas','Easter','Sermons']

export default function AdminGallery() {
  const { showToast, logAction } = useAdmin()
  const [items, setItems] = useState([])
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId] = useState(null)
  const [bulk, setBulk]   = useState('')
  const [showBulk, setShowBulk] = useState(false)

  const load = () => getAll('gallery','created_at').then(({data})=>{ setItems(data); setLoading(false) })
  useEffect(() => { load() }, [])

  // Friendly hint if the "featured" column hasn't been added yet (see sql/gallery_featured.sql)
  const errText = (err) => /featured/i.test(err.message || '') ? 'Run the gallery SQL first: it adds the Featured option.' : err.message

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const row = { url:form.url, title:form.title, caption:form.caption, category:form.category, date:form.date||new Date().toISOString().split('T')[0], featured:!!form.featured }
    const editing = !!form.id
    const { error } = editing ? await update('gallery', form.id, row) : await insert('gallery', row)
    if (!error) {
      showToast(editing ? 'Photo updated!' : 'Photo added!')
      logAction(editing ? 'gallery_edit' : 'gallery_add', (editing ? 'Edited photo: ' : 'Added photo: ')+(form.title||form.url||''), form.title||null)
      setForm(null); load()
    } else showToast(errText(error),'error')
    setSaving(false)
  }

  const toggleFeatured = async (item) => {
    const next = !item.featured
    setItems(list => list.map(x => x.id===item.id ? { ...x, featured:next } : x))   // instant feedback
    const { error } = await update('gallery', item.id, { featured:next })
    if (error) { setItems(list => list.map(x => x.id===item.id ? { ...x, featured:!next } : x)); showToast(errText(error),'error'); return }
    showToast(next ? '⭐ Added to the Featured carousel' : 'Removed from Featured')
    logAction('gallery_feature', (next ? 'Featured: ' : 'Unfeatured: ')+(item.title||item.url||''), item.title||null)
  }

  const startEdit = (item) => setForm({
    id:item.id, url:item.url||'', title:item.title||'', caption:item.caption||'', category:item.category||'',
    date:(item.date||'').slice(0,10), featured:!!item.featured,
  })

  const handleBulk = async () => {
    const urls = bulk.split('\n').map(u=>u.trim()).filter(Boolean)
    if (!urls.length) return
    setSaving(true)
    await Promise.all(urls.map(url => insert('gallery', { url, date: new Date().toISOString().split('T')[0] })))
    showToast(`${urls.length} photos added!`); setBulk(''); setShowBulk(false); load()
    setSaving(false)
  }

  const handleDelete = async () => {
    const err = await remove('gallery', delId)
    if (!err) { showToast('Removed'); logAction('gallery_delete','Deleted photo',null); setItems(i=>i.filter(x=>x.id!==delId)) }
    else showToast(err.message,'error'); setDelId(null)
  }
  const F = k => ({ value:form?.[k]||'', onChange:e=>setForm(f=>({...f,[k]:e.target.value})) })

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'var(--text-light)' }}>Loading gallery...</div>

  if (form !== null) return (
    <div>
      <PageHeader icon="🖼" title={form.id ? 'Edit Photo' : 'Add Photo'} />
      <AdminCard style={{ maxWidth:600 }}>
        <form onSubmit={handleSubmit}>
          {form.url&&<img src={form.url} alt="" style={{ width:'100%', height:220, objectFit:'cover', borderRadius:10, marginBottom:16 }} onError={e=>e.target.style.display='none'} />}
          <div className="form-group"><label>Image URL *</label><input {...F('url')} required placeholder="https://..." /></div>
          <div className="form-group"><label>Title</label><input {...F('title')} placeholder="e.g. Easter Sunday 2025" /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="form-group"><label>Category</label><select value={form?.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', width:'100%', fontFamily:'var(--font-body)' }}><option value="">Select</option>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>Date</label><input type="date" {...F('date')} /></div>
          </div>
          <div className="form-group"><label>Caption</label><textarea {...F('caption')} rows={2} style={{ resize:'vertical' }} /></div>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, margin:'4px 0 18px', cursor:'pointer', fontSize:'0.88rem', color:'var(--text-mid)', lineHeight:1.5 }}>
            <input type="checkbox" checked={!!form.featured} onChange={e=>setForm(f=>({...f,featured:e.target.checked}))} style={{ width:18, height:18, marginTop:2, flexShrink:0 }} />
            <span>⭐ <strong>Feature this photo</strong><br /><span style={{ fontSize:'0.78rem', color:'var(--text-light)' }}>Featured photos appear in the 3D carousel at the top of the Gallery page.</span></span>
          </label>
          <div style={{ display:'flex', gap:12 }}>
            <button type="submit" className="btn btn-blue" disabled={saving}>{saving?'⏳...':(form.id?'💾 Save Changes':'💾 Add Photo')}</button>
            <button type="button" className="btn btn-outline-blue" onClick={()=>setForm(null)}>Cancel</button>
          </div>
        </form>
      </AdminCard>
    </div>
  )

  return (
    <div>
      <PageHeader icon="🖼" title="Gallery" subtitle={`${items.length} photos · ${items.filter(x=>x.featured).length} featured`}
        action={<div style={{ display:'flex', gap:10 }}><button className="btn btn-outline-blue" onClick={()=>setShowBulk(s=>!s)}>📋 Bulk Add</button><button className="btn btn-blue" onClick={()=>setForm({url:'',title:'',caption:'',category:'',date:'',featured:false})}>+ Add Photo</button></div>} />
      {showBulk&&<AdminCard style={{ marginBottom:24, maxWidth:600 }}>
        <h3 style={{ margin:'0 0 12px', color:'var(--brand-deep)', fontSize:'1rem' }}>Bulk Add — one URL per line</h3>
        <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={6} style={{ width:'100%', padding:12, borderRadius:8, border:'1.5px solid #e2e8f0', fontFamily:'monospace', fontSize:'0.85rem', resize:'vertical', boxSizing:'border-box' }} />
        <div style={{ display:'flex', gap:12, marginTop:12 }}>
          <button className="btn btn-blue" onClick={handleBulk} disabled={saving||!bulk.trim()}>{saving?'⏳...':'✅ Add All'}</button>
          <button className="btn btn-outline-blue" onClick={()=>{setShowBulk(false);setBulk('')}}>Cancel</button>
        </div>
      </AdminCard>}
      {items.length===0&&<AdminCard><div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-light)' }}>No photos yet.</div></AdminCard>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
        {items.map(item=>(
          <div key={item.id} style={{ background:'white', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ height:150, background:'#f0f4fa', overflow:'hidden', position:'relative' }}>
              {item.featured&&<div style={{ position:'absolute', top:8, left:8, background:'#f59e0b', color:'#1a1a1a', fontSize:'0.68rem', fontWeight:800, padding:'3px 8px', borderRadius:20, zIndex:1 }}>⭐ Featured</div>}
              {item.url?<img src={item.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />:<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:'2rem' }}>🖼</div>}
            </div>
            <div style={{ padding:'10px 12px' }}>
              <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--brand-deep)', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.title||'Untitled'}</div>
              {item.category&&<div style={{ fontSize:'0.7rem', color:'var(--brand-light)', marginBottom:6 }}>{item.category}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <button onClick={()=>toggleFeatured(item)} style={{ gridColumn:'1 / -1', padding:'5px', borderRadius:6, border:'1.5px solid #fde68a', background:item.featured?'#fffbeb':'white', color:'#b45309', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, fontFamily:'var(--font-body)' }}>{item.featured?'★ Unfeature':'☆ Feature'}</button>
                <button onClick={()=>startEdit(item)} style={{ padding:'5px', borderRadius:6, border:'1.5px solid #e2e8f0', background:'white', color:'var(--text-mid)', cursor:'pointer', fontSize:'0.75rem', fontFamily:'var(--font-body)' }}>✏️ Edit</button>
                <button onClick={()=>setDelId(item.id)} style={{ padding:'5px', borderRadius:6, border:'1.5px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:'0.75rem', fontFamily:'var(--font-body)' }}>🗑 Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {delId&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}><div style={{ background:'white', borderRadius:16, padding:32, maxWidth:360, width:'90%', textAlign:'center' }}><div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div><h3 style={{ color:'var(--brand-deep)', margin:'0 0 8px' }}>Remove Photo?</h3><p style={{ color:'var(--text-mid)', marginBottom:24 }}>Cannot be undone.</p><div style={{ display:'flex', gap:12, justifyContent:'center' }}><button className="btn btn-blue" onClick={handleDelete}>Remove</button><button className="btn btn-outline-blue" onClick={()=>setDelId(null)}>Cancel</button></div></div></div>}
    </div>
  )
}
