import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import { getAll, insert, update, remove } from '../supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const EMPTY = {
  title:'', lesson_date:'', quarter:'', scripture:'', author:'',
  summary:'', body:'', pdf_url:'', discussion_questions:'', analysis:'', analysis_points:'',
  divine_message_speaker:'', divine_message_title:'', divine_message_scripture:'', divine_message_notes:'',
  evening_speaker:'', evening_title:'', evening_scripture:'', evening_notes:'',
  published:true
}

// Auto-generate quarter string from a date
function dateToQuarter(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

export default function AdminSabbath() {
  const { showToast } = useAdmin()
  const [items, setItems]   = useState([])
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [delId, setDelId]   = useState(null)
  const [preview, setPreview] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => getAll('sabbath_lessons','lesson_date')
    .then(({data}) => { setItems(data||[]); setLoading(false) })
  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true)
    const { id, ...rest } = form
    // Auto-fill quarter if empty
    const payload = { ...rest, quarter: rest.quarter || dateToQuarter(rest.lesson_date) }
    const { error } = id ? await update('sabbath_lessons',id,payload) : await insert('sabbath_lessons',payload)
    if (!error) { showToast(id?'Lesson updated!':'Lesson added!'); setForm(null); load() }
    else showToast(error.message,'error')
    setSaving(false)
  }

  const handleDelete = async () => {
    const err = await remove('sabbath_lessons', delId)
    if (!err) { showToast('Deleted'); setItems(i=>i.filter(x=>x.id!==delId)) }
    else showToast(err.message,'error')
    setDelId(null)
  }

  const F = k => ({ value: form?.[k]||'', onChange: e => setForm(f=>({...f,[k]:e.target.value})) })

  const filtered = items.filter(l => !search ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.quarter||'').toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading lessons...</div>

  // FORM VIEW
  if (form !== null) return (
    <div>
      <PageHeader icon="📖" title={form.id?'Edit Lesson':'New Lesson'}
        action={
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-outline-blue" onClick={()=>setPreview(p=>!p)} style={{fontSize:'0.85rem'}}>{preview?'📝 Edit':'👁 Preview'}</button>
            <button className="btn btn-blue" onClick={handleSubmit} disabled={saving}>{saving?'⏳...':'💾 Save'}</button>
            <button className="btn btn-outline-blue" onClick={()=>setForm(null)} style={{fontSize:'0.85rem'}}>Cancel</button>
          </div>
        }
      />

      {preview ? (
        <AdminCard style={{maxWidth:760}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--brand-light)',marginBottom:8}}>{form.quarter}</div>
          <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.6rem',marginBottom:8}}>{form.title||'Untitled'}</h2>
          {form.scripture&&<div style={{background:'var(--gold)',display:'inline-block',color:'white',padding:'5px 14px',borderRadius:20,fontSize:'0.82rem',fontWeight:700,marginBottom:16}}>📜 {form.scripture}</div>}
          <div style={{color:'var(--text-light)',fontSize:'0.82rem',marginBottom:20}}>📅 {form.lesson_date}{form.author&&` · ${form.author}`}</div>
          {form.summary&&<div style={{background:'var(--brand-pale)',borderLeft:'4px solid var(--brand-light)',borderRadius:'0 10px 10px 0',padding:'14px 18px',marginBottom:24,fontStyle:'italic',color:'var(--brand-deep)',lineHeight:1.8}}>{form.summary}</div>}
          {form.body&&form.body.split('\n\n').map((p,i)=>(
            p.startsWith('##') ? <h3 key={i} style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.1rem',margin:'20px 0 8px'}}>{p.replace(/^##\s*/,'')}</h3>
            : p.startsWith('#') ? <h4 key={i} style={{color:'var(--brand-light)',fontSize:'1rem',margin:'16px 0 6px',fontWeight:700}}>{p.replace(/^#\s*/,'')}</h4>
            : <p key={i} style={{lineHeight:1.9,color:'var(--text-dark)',marginBottom:16}}>{p}</p>
          ))}
          {form.discussion_questions&&(
            <div style={{marginTop:24,background:'#fffbf0',borderRadius:10,padding:'16px 20px',border:'1.5px solid #fcd34d'}}>
              <strong style={{color:'#92400e'}}>💬 Discussion Questions</strong>
              <div style={{marginTop:10}}>{form.discussion_questions.split('\n').filter(Boolean).map((q,i)=><div key={i} style={{marginBottom:8,color:'var(--text-dark)'}}>{i+1}. {q.replace(/^\d+\.\s*/,'')}</div>)}</div>
            </div>
          )}

          {form.analysis&&(
            <div style={{marginTop:24,background:'var(--brand-pale)',borderRadius:10,padding:'16px 20px',border:'1.5px solid var(--brand-light)'}}>
              <strong style={{color:'var(--brand-deep)'}}>🔍 Detailed Analysis</strong>
              <div style={{marginTop:10,lineHeight:1.9,color:'var(--text-dark)',fontSize:'0.92rem'}}>{form.analysis.split('\n\n').map((p,i)=>(<p key={i} style={{marginBottom:12}}>{p}</p>))}</div>
            </div>
          )}
          {form.analysis_points&&(
            <div style={{marginTop:12,background:'#f0fdf4',borderRadius:10,padding:'16px 20px',border:'1.5px solid #bbf7d0'}}>
              <strong style={{color:'#166534'}}>📌 Key Points</strong>
              <div style={{marginTop:10}}>{form.analysis_points.split('\n').filter(Boolean).map((p,i)=><div key={i} style={{marginBottom:8,color:'var(--text-dark)'}}>{i+1}. {p.replace(/^\d+\.\s*/,'')}</div>)}</div>
            </div>
          )}

          {/* Divine Service Preview */}
          {(form.divine_message_title||form.divine_message_speaker)&&(
            <div style={{marginTop:24,background:'linear-gradient(135deg,var(--brand-pale),#f0f7ff)',borderRadius:12,padding:'18px 22px',border:'1.5px solid #bfdbfe'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <span style={{fontSize:'1.2rem'}}>⛪</span>
                <strong style={{color:'var(--brand-deep)'}}>Divine Service Message</strong>
                <span style={{fontSize:'0.72rem',color:'var(--text-light)'}}>Sabbath Morning</span>
              </div>
              {form.divine_message_title&&<div style={{fontWeight:700,color:'var(--brand-deep)',marginBottom:4}}>{form.divine_message_title}</div>}
              {form.divine_message_speaker&&<div style={{fontSize:'0.85rem',color:'var(--text-mid)',marginBottom:4}}>🎙 {form.divine_message_speaker}</div>}
              {form.divine_message_scripture&&<div style={{fontSize:'0.85rem',color:'var(--gold)',fontWeight:700,marginBottom:4}}>📜 {form.divine_message_scripture}</div>}
              {form.divine_message_notes&&<div style={{fontSize:'0.82rem',color:'var(--text-mid)',fontStyle:'italic',marginTop:6}}>{form.divine_message_notes}</div>}
            </div>
          )}

          {/* Evening Service Preview */}
          {(form.evening_title||form.evening_speaker)&&(
            <div style={{marginTop:12,background:'linear-gradient(135deg,#1e1b4b,#2d2b5e)',borderRadius:12,padding:'18px 22px',border:'1.5px solid #4338ca'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <span style={{fontSize:'1.2rem'}}>🌙</span>
                <strong style={{color:'white'}}>Evening Service Message</strong>
                <span style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.45)'}}>Sabbath Evening</span>
              </div>
              {form.evening_title&&<div style={{fontWeight:700,color:'white',marginBottom:4}}>{form.evening_title}</div>}
              {form.evening_speaker&&<div style={{fontSize:'0.85rem',color:'rgba(255,255,255,0.7)',marginBottom:4}}>🎙 {form.evening_speaker}</div>}
              {form.evening_scripture&&<div style={{fontSize:'0.85rem',color:'var(--gold)',fontWeight:700,marginBottom:4}}>📜 {form.evening_scripture}</div>}
              {form.evening_notes&&<div style={{fontSize:'0.82rem',color:'rgba(255,255,255,0.6)',fontStyle:'italic',marginTop:6}}>{form.evening_notes}</div>}
            </div>
          )}
        </AdminCard>
      ) : (
        <AdminCard style={{maxWidth:800}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>Lesson Title *</label>
              <input {...F('title')} required placeholder="e.g. The Sabbath: A Gift of Time" />
            </div>
            <div className="form-group">
              <label>Lesson Date (Sabbath) *</label>
              <input type="date" {...F('lesson_date')} required onChange={e=>{
                setForm(f=>({...f, lesson_date:e.target.value, quarter:f.quarter||dateToQuarter(e.target.value)}))
              }} />
            </div>
            <div className="form-group">
              <label>Quarter <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)'}}>(auto-filled from date)</span></label>
              <input {...F('quarter')} placeholder="e.g. Q2 2026" />
            </div>
            <div className="form-group">
              <label>Memory Scripture</label>
              <input {...F('scripture')} placeholder='e.g. John 3:16' />
            </div>
            <div className="form-group">
              <label>Author / Prepared by</label>
              <input {...F('author')} placeholder="e.g. Sabbath School Dept." />
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>PDF URL <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)'}}>Paste a link to your PDF (Google Drive, Dropbox etc)</span></label>
              <input {...F('pdf_url')} placeholder="https://drive.google.com/file/..." />
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>Summary / Introduction</label>
              <textarea {...F('summary')} rows={3} placeholder="Brief overview shown as highlighted intro text..." style={{resize:'vertical'}} />
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>
                Lesson Content
                <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)',marginLeft:8}}>
                  Use ## for section headings, # for subheadings, blank line between paragraphs
                </span>
              </label>
              <textarea {...F('body')} rows={16} style={{resize:'vertical',fontFamily:'monospace',fontSize:'0.88rem',lineHeight:1.7}}
                placeholder={"## Day 1 — Sunday\n\nLesson content here...\n\n## Day 2 — Monday\n\nMore content..."} />
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>Discussion Questions <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)'}}>One per line</span></label>
              <textarea {...F('discussion_questions')} rows={5} style={{resize:'vertical'}}
                placeholder={"1. What does this lesson teach us about God's grace?\n2. How can you apply this in daily life?"} />
            </div>

            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>
                Detailed Analysis
                <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)',marginLeft:8}}>
                  In-depth commentary and study notes. Use ## for headings, blank line between paragraphs
                </span>
              </label>
              <textarea {...F('analysis')} rows={10} style={{resize:'vertical',fontFamily:'monospace',fontSize:'0.88rem',lineHeight:1.7}}
                placeholder={"## Overview\n\nDetailed analysis here...\n\n## Key Themes\n\nMore analysis..."} />
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}>
              <label>Key Points <span style={{fontWeight:400,fontSize:'0.75rem',color:'var(--text-light)'}}>One per line — shown as numbered list in Analysis tab</span></label>
              <textarea {...F('analysis_points')} rows={5} style={{resize:'vertical'}}
                placeholder={"1. God's covenant is eternal\n2. Sabbath is a sign of sanctification\n3. Rest is a spiritual discipline"} />
            </div>

            {/* Divine Service Message */}
            <div style={{gridColumn:'1/-1',marginTop:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:10,borderBottom:'2px solid var(--brand-pale)'}}>
                <span style={{fontSize:'1.2rem'}}>⛪</span>
                <div>
                  <div style={{fontWeight:800,color:'var(--brand-deep)',fontSize:'0.95rem'}}>Divine Service Message</div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>Main sermon for the Sabbath morning service</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Speaker / Preacher</label>
                  <input {...F('divine_message_speaker')} placeholder="e.g. Pastor Emmanuel" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Sermon Title</label>
                  <input {...F('divine_message_title')} placeholder="e.g. Walking in the Light" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Scripture Text</label>
                  <input {...F('divine_message_scripture')} placeholder="e.g. John 8:12" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Notes / Summary <span style={{fontWeight:400,fontSize:'0.72rem',color:'var(--text-light)'}}>(optional)</span></label>
                  <input {...F('divine_message_notes')} placeholder="Brief description..." />
                </div>
              </div>
            </div>

            {/* Evening Service Message */}
            <div style={{gridColumn:'1/-1',marginTop:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:10,borderBottom:'2px solid var(--brand-pale)'}}>
                <span style={{fontSize:'1.2rem'}}>🌙</span>
                <div>
                  <div style={{fontWeight:800,color:'var(--brand-deep)',fontSize:'0.95rem'}}>Evening Service Message</div>
                  <div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>Message for the Sabbath evening service</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group" style={{margin:0}}>
                  <label>Speaker / Preacher</label>
                  <input {...F('evening_speaker')} placeholder="e.g. Elder John" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Sermon Title</label>
                  <input {...F('evening_title')} placeholder="e.g. The Promise of Rest" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Scripture Text</label>
                  <input {...F('evening_scripture')} placeholder="e.g. Matthew 11:28" />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label>Notes / Summary <span style={{fontWeight:400,fontSize:'0.72rem',color:'var(--text-light)'}}>(optional)</span></label>
                  <input {...F('evening_notes')} placeholder="Brief description..." />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <input type="checkbox" checked={form?.published!==false} onChange={e=>setForm(f=>({...f,published:e.target.checked}))} style={{width:18,height:18}} />
                Published (visible to members)
              </label>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  )

  // LIST VIEW
  return (
    <div>
      <PageHeader icon="📖" title="Sabbath School" subtitle={`${items.length} lessons`}
        action={<button className="btn btn-blue" onClick={()=>setForm({...EMPTY,lesson_date:new Date().toISOString().split('T')[0]})}>+ New Lesson</button>}
      />

      {/* Search */}
      <div style={{marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search lessons..."
          style={{padding:'10px 16px',borderRadius:10,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.88rem',width:'100%',maxWidth:360,boxSizing:'border-box'}} />
      </div>

      {filtered.length===0 && (
        <AdminCard><div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-light)'}}>
          {items.length===0 ? 'No lessons yet. Add your first Sabbath School lesson above.' : 'No lessons match your search.'}
        </div></AdminCard>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {filtered.map(item => (
          <AdminCard key={item.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                <span style={{fontWeight:700,color:'var(--brand-deep)'}}>{item.title}</span>
                {!item.published&&<span style={{fontSize:'0.68rem',background:'#fef3c7',color:'#92400e',padding:'1px 8px',borderRadius:20,fontWeight:700}}>DRAFT</span>}
                {item.quarter&&<span style={{fontSize:'0.68rem',background:'var(--brand-pale)',color:'var(--brand-light)',padding:'1px 8px',borderRadius:20,fontWeight:700}}>{item.quarter}</span>}
                {item.pdf_url&&<span style={{fontSize:'0.68rem',background:'#f0fdf4',color:'#16a34a',padding:'1px 8px',borderRadius:20,fontWeight:700}}>📄 PDF</span>}
              </div>
              <div style={{fontSize:'0.82rem',color:'var(--text-mid)'}}>
                📅 {new Date(item.lesson_date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}
                {item.scripture&&<span style={{marginLeft:12,color:'var(--brand-light)'}}>📜 {item.scripture}</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-outline-blue" style={{padding:'7px 16px',fontSize:'0.82rem'}}
                onClick={()=>setForm(item)}>✏️ Edit</button>
              <button style={{padding:'7px 16px',borderRadius:30,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',cursor:'pointer',fontSize:'0.82rem',fontFamily:'var(--font-body)'}}
                onClick={()=>setDelId(item.id)}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>

      {delId&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'white',borderRadius:16,padding:32,maxWidth:360,width:'90%',textAlign:'center'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>⚠️</div>
            <h3 style={{color:'var(--brand-deep)',margin:'0 0 8px'}}>Delete Lesson?</h3>
            <p style={{color:'var(--text-mid)',marginBottom:24}}>This cannot be undone.</p>
            <div style={{display:'flex',gap:12,justifyContent:'center'}}>
              <button className="btn btn-blue" onClick={handleDelete}>Delete</button>
              <button className="btn btn-outline-blue" onClick={()=>setDelId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
