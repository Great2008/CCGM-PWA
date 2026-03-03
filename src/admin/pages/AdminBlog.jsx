import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import supabaseAdmin from '../../lib/supabaseAdmin'

const EMPTY = { title:'', author:'', date:'', category:'', type:'blog', excerpt:'', body:'', image_url:'', tags:'', published:true }
const CATS = ['Devotional','Sermon Notes','Announcement','Ministry','Testimony','Teaching']

export default function AdminBlog() {
  const { showToast } = useAdmin()
  const [items, setItems] = useState([])
  const [form, setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId] = useState(null)
  const [preview, setPreview] = useState(false)

  const load = async () => {
    const { data, error } = await supabaseAdmin.from('posts').select('*').order('date', { ascending: false })
    if (error) showToast('Failed to load: ' + error.message, 'error')
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    const payload = { ...rest, tags: typeof rest.tags==='string' ? rest.tags.split(',').map(t=>t.trim()).filter(Boolean) : rest.tags, date: rest.date||new Date().toISOString().split('T')[0] }
    const { error } = id
      ? await supabaseAdmin.from('posts').update(payload).eq('id', id)
      : await supabaseAdmin.from('posts').insert(payload)
    if (!error) { showToast(id?'Post updated!':'Post published!'); setForm(null); load() }
    else showToast(error.message,'error')
    setSaving(false)
  }
  const handleDelete = async () => {
    const { error: err } = await supabaseAdmin.from('posts').delete().eq('id', delId)
    if (!err) { showToast('Deleted'); setItems(i=>i.filter(x=>x.id!==delId)) }
    else showToast(err.message,'error')
    setDelId(null)
  }
  const F = k => ({ value:form?.[k]||'', onChange:e=>setForm(f=>({...f,[k]:e.target.value})) })

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'var(--text-light)' }}>Loading posts...</div>

  if (form !== null) return (
    <div>
      <PageHeader icon="✍️" title={form.id?'Edit Post':'New Post'}
        action={<div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline-blue" onClick={()=>setPreview(p=>!p)} style={{ fontSize:'0.85rem' }}>{preview?'📝 Edit':'👁 Preview'}</button>
          <button className="btn btn-blue" onClick={handleSubmit} disabled={saving}>{saving?'⏳...':'💾 Save'}</button>
          <button className="btn btn-outline-blue" onClick={()=>setForm(null)} style={{ fontSize:'0.85rem' }}>Cancel</button>
        </div>} />
      {preview ? (
        <AdminCard style={{ maxWidth:760 }}>
          {form.image_url&&<img src={form.image_url} alt="" style={{ width:'100%', height:260, objectFit:'cover', borderRadius:10, marginBottom:24 }} />}
          <div style={{ fontSize:'0.78rem', color:'var(--brand-light)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>{form.category}</div>
          <h1 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.8rem', marginBottom:8 }}>{form.title||'Untitled'}</h1>
          <div style={{ fontSize:'0.82rem', color:'var(--text-light)', marginBottom:20 }}>{form.author} · {form.date}</div>
          <p style={{ color:'var(--text-mid)', fontStyle:'italic', marginBottom:24, lineHeight:1.8 }}>{form.excerpt}</p>
          {(form.body||'').split('\n\n').map((para,i)=>
            para.startsWith('##') ? (
              <h3 key={i} style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.15rem', margin:'24px 0 10px', borderBottom:'2px solid var(--brand-pale)', paddingBottom:6 }}>{para.replace(/^##\s*/,'')}</h3>
            ) : para.startsWith('#') ? (
              <h4 key={i} style={{ fontFamily:'var(--font-display)', color:'var(--brand-light)', fontSize:'1rem', margin:'18px 0 8px', fontWeight:700 }}>{para.replace(/^#\s*/,'')}</h4>
            ) : (
              <p key={i} style={{ lineHeight:1.9, marginBottom:16, color:'var(--text-dark)' }}>
                {para.split('**').map((chunk,j)=> j%2===1 ? <strong key={j} style={{color:'var(--brand-deep)'}}>{chunk}</strong> : chunk)}
              </p>
            )
          )}
        </AdminCard>
      ) : (
        <AdminCard style={{ maxWidth:760 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Title *</label><input {...F('title')} required /></div>
            <div className="form-group"><label>Author</label><input {...F('author')} placeholder="Pastor John Mensah" /></div>
            <div className="form-group"><label>Date</label><input type="date" {...F('date')} /></div>
            <div className="form-group"><label>Category</label><select value={form?.category||''} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', width:'100%', fontFamily:'var(--font-body)' }}><option value="">Select</option>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>Type</label><select value={form?.type||'blog'} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', width:'100%', fontFamily:'var(--font-body)' }}><option value="blog">Blog Post</option><option value="devotional">Devotional</option></select></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Cover Image URL</label><input {...F('image_url')} /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Excerpt</label><textarea {...F('excerpt')} rows={2} style={{ resize:'vertical' }} /></div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label>Body
                <span style={{ fontWeight:400, fontSize:'0.78rem', color:'var(--text-light)', marginLeft:8 }}>(blank lines = new paragraph)</span>
              </label>
              <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'8px 8px 0 0', padding:'8px 14px', display:'flex', gap:16, flexWrap:'wrap', fontSize:'0.75rem', color:'var(--text-mid)', borderBottom:'none' }}>
                <span><code style={{ background:'#e2e8f0', padding:'1px 6px', borderRadius:4 }}>## Heading</code> → Section heading</span>
                <span><code style={{ background:'#e2e8f0', padding:'1px 6px', borderRadius:4 }}># Subheading</code> → Subheading</span>
                <span><code style={{ background:'#e2e8f0', padding:'1px 6px', borderRadius:4 }}>**text**</code> → <strong>Bold</strong></span>
              </div>
              <textarea {...F('body')} rows={14} style={{ resize:'vertical', fontFamily:'monospace', fontSize:'0.88rem', lineHeight:1.7, borderRadius:'0 0 8px 8px' }} />
            </div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Tags (comma separated)</label><input {...F('tags')} placeholder="Faith, Prayer, Healing" /></div>
            <div className="form-group"><label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}><input type="checkbox" checked={form?.published!==false} onChange={e=>setForm(f=>({...f,published:e.target.checked}))} style={{ width:18, height:18 }} /> Published</label></div>
          </div>
        </AdminCard>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader icon="✍️" title="Blog & Devotionals" subtitle={`${items.length} posts`} action={<button className="btn btn-blue" onClick={()=>setForm({...EMPTY,date:new Date().toISOString().split('T')[0]})}>+ New Post</button>} />
      {items.length===0&&<AdminCard><div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-light)' }}>No posts yet.</div></AdminCard>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {items.map(item=>(
          <AdminCard key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ flex:1, display:'flex', gap:14, alignItems:'center' }}>
              {item.image_url&&<img src={item.image_url} alt="" style={{ width:52, height:52, borderRadius:8, objectFit:'cover', flexShrink:0 }} />}
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, color:'var(--brand-deep)' }}>{item.title}</span>
                  {!item.published&&<span style={{ fontSize:'0.68rem', background:'#fef3c7', color:'#92400e', padding:'1px 8px', borderRadius:20, fontWeight:700 }}>DRAFT</span>}
                  <span style={{ fontSize:'0.68rem', background:'var(--brand-pale)', color:'var(--brand-light)', padding:'1px 8px', borderRadius:20, fontWeight:700 }}>{item.type==='devotional'?'Devotional':'Blog'}</span>
                </div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-mid)' }}>{item.author} · {item.date}{item.category&&` · ${item.category}`}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-outline-blue" style={{ padding:'7px 16px', fontSize:'0.82rem' }} onClick={()=>setForm({...item,tags:Array.isArray(item.tags)?item.tags.join(', '):item.tags})}>✏️ Edit</button>
              <button style={{ padding:'7px 16px', borderRadius:30, border:'1.5px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:'0.82rem', fontFamily:'var(--font-body)' }} onClick={()=>setDelId(item.id)}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>
      {delId&&<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}><div style={{ background:'white', borderRadius:16, padding:32, maxWidth:360, width:'90%', textAlign:'center' }}><div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div><h3 style={{ color:'var(--brand-deep)', margin:'0 0 8px' }}>Delete Post?</h3><p style={{ color:'var(--text-mid)', marginBottom:24 }}>Cannot be undone.</p><div style={{ display:'flex', gap:12, justifyContent:'center' }}><button className="btn btn-blue" onClick={handleDelete}>Delete</button><button className="btn btn-outline-blue" onClick={()=>setDelId(null)}>Cancel</button></div></div></div>}
    </div>
  )
}
