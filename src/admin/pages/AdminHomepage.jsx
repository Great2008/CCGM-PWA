import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import AdminCard from '../components/AdminCard'
import { getContent, setContent } from '../supabase'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { BG_COLORS, DEFAULT_BG } from '../../components/DailyVerseBanner'

const ICONS = ['🤝','🙏','📖','⛪','🔥','✨','🌟','🎵','📢','✝','🕊','💒']

const DEFAULT = {
  hero: { title:'Welcome to CCG World', subtitle:'A community rooted in faith, love, and the Word of God. Join us as we worship, grow, and serve together.', ctaText:'Join Us This Saturday', ctaLink:'/events' },
  serviceTimes: [
    { day:'Sunday',    name:'Meetings of Different Bodies', time:'', icon:'🤝' },
    { day:'Monday',    name:"Children's Prayer",            time:'', icon:'🙏' },
    { day:'Tuesday',   name:'Bible Study',                  time:'', icon:'📖' },
    { day:'Wednesday', name:'Midweek Service',              time:'', icon:'⛪' },
    { day:'Thursday',  name:'Deliverance Service',          time:'', icon:'🔥' },
    { day:'Friday',    name:'Sabbath Preparation',          time:'', icon:'✨' },
    { day:'Saturday',  name:'Divine Service',               time:'', icon:'🌟' },
  ],
  announcement: { show:false, text:'' },
  stats: [
    { label:'Years of Ministry', value:'25+' },
    { label:'Active Members',    value:'500+' },
    { label:'Weekly Services',   value:'7' },
    { label:'Countries Reached', value:'12+' },
  ],
  contact: { address:'', phone:'', email:'', mapUrl:'' },
}

export default function AdminHomepage() {
  const { showToast } = useAdmin()
  const [data, setData] = useState(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hero')

  // Daily verse state
  const [verse, setVerse]       = useState({ text:'', reference:'', reflection:'', bg_color: DEFAULT_BG })
  const [verseSaving, setVerseSaving] = useState(false)
  const [verseLoading, setVerseLoading] = useState(true)
  const [verseActive, setVerseActive] = useState(false) // whether an override is active today

  useEffect(() => {
    getContent('homepage').then(d => {
      if (d) setData(prev => ({ ...prev, ...d, serviceTimes: d.serviceTimes || prev.serviceTimes }))
      setLoading(false)
    })
  }, [])

  // Load current daily verse override
  useEffect(() => {
    supabaseAdmin.from('site_settings').select('value').eq('key','daily_verse').single()
      .then(({ data }) => {
        const val = data?.value
        const today = new Date().toISOString().split('T')[0]
        if (val) {
          setVerse({
            text: val.text || '',
            reference: val.reference || '',
            reflection: val.reflection || '',
            bg_color: val.bg_color || DEFAULT_BG,
          })
          setVerseActive(val.override_date === today)
        }
        setVerseLoading(false)
      })
  }, [])

  const save = async () => {
    setSaving(true)
    try { await setContent('homepage', data); showToast('Homepage saved! Live immediately.') }
    catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const updateService = (idx,key,val) => { const t=[...data.serviceTimes]; t[idx]={...t[idx],[key]:val}; setData(d=>({...d,serviceTimes:t})) }
  const updateStat = (idx,key,val) => { const s=[...data.stats]; s[idx]={...s[idx],[key]:val}; setData(d=>({...d,stats:s})) }

  const saveVerse = async () => {
    if (!verse.text.trim() || !verse.reference.trim()) { showToast('Verse text and reference are required','error'); return }
    setVerseSaving(true)
    const today = new Date().toISOString().split('T')[0]
    try {
      const payload = { ...verse, override_date: today }
      const { data: existing } = await supabaseAdmin.from('site_settings').select('id').eq('key','daily_verse').single()
      if (existing) {
        await supabaseAdmin.from('site_settings').update({ value: payload }).eq('key','daily_verse')
      } else {
        await supabaseAdmin.from('site_settings').insert({ key:'daily_verse', value: payload })
      }
      setVerseActive(true)
      showToast('Daily verse override saved for today!')
    } catch(e) { showToast(e.message,'error') }
    setVerseSaving(false)
  }

  const clearVerseOverride = async () => {
    setVerseSaving(true)
    try {
      await supabaseAdmin.from('site_settings').update({ value: { ...verse, override_date: null } }).eq('key','daily_verse')
      setVerseActive(false)
      showToast('Override cleared — API verse will show today')
    } catch(e) { showToast(e.message,'error') }
    setVerseSaving(false)
  }

  const tabs = [['hero','🏠 Hero'],['services','⛪ Programs'],['announcement','📢 Announce'],['stats','📊 Stats'],['contact','📍 Contact'],['verse','📖 Daily Verse']]

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>🏠 Homepage</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>Changes go live immediately on save</p>
        </div>
        <button className="btn btn-green" onClick={save} disabled={saving}>{saving?'⏳ Saving...':'💾 Save All'}</button>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:22,flexWrap:'wrap'}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'8px 16px',borderRadius:30,border:'1.5px solid',borderColor:tab===id?'var(--brand-light)':'#e2e8f0',background:tab===id?'var(--brand-light)':'white',color:tab===id?'white':'var(--text-mid)',fontSize:'0.8rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
            {label}
          </button>
        ))}
      </div>

      {tab==='hero'&&(
        <AdminCard style={{maxWidth:720}}>
          <h3 style={{margin:'0 0 18px',color:'var(--brand-deep)'}}>Hero Section</h3>
          <div className="form-group"><label>Page Title</label><input value={data.hero.title} onChange={e=>setData(d=>({...d,hero:{...d.hero,title:e.target.value}}))} /></div>
          <div className="form-group"><label>Subtitle</label><textarea value={data.hero.subtitle} onChange={e=>setData(d=>({...d,hero:{...d.hero,subtitle:e.target.value}}))} rows={3} style={{resize:'vertical'}} /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="form-group"><label>CTA Button Text</label><input value={data.hero.ctaText} onChange={e=>setData(d=>({...d,hero:{...d.hero,ctaText:e.target.value}}))} /></div>
            <div className="form-group"><label>CTA Link</label><input value={data.hero.ctaLink} onChange={e=>setData(d=>({...d,hero:{...d.hero,ctaLink:e.target.value}}))} /></div>
          </div>
        </AdminCard>
      )}

      {tab==='services'&&(
        <AdminCard style={{maxWidth:800}}>
          <h3 style={{margin:'0 0 8px',color:'var(--brand-deep)'}}>Weekly Programs</h3>
          <p style={{color:'var(--text-light)',fontSize:'0.85rem',marginBottom:18}}>Saturday (Divine Service) is your Sabbath — highlighted in gold.</p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {data.serviceTimes.map((s,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'44px 100px 1fr 160px',gap:10,alignItems:'center',padding:'12px 14px',background:s.day==='Saturday'?'#fffbf0':'#f8fafc',borderRadius:10,border:s.day==='Saturday'?'1.5px solid #fcd34d':'1.5px solid #e2e8f0'}}>
                <select value={s.icon||'✝'} onChange={e=>updateService(i,'icon',e.target.value)} style={{padding:'6px 4px',borderRadius:6,border:'1.5px solid #e2e8f0',fontSize:'1.1rem',fontFamily:'var(--font-body)',background:'white',cursor:'pointer'}}>
                  {ICONS.map(ic=><option key={ic} value={ic}>{ic}</option>)}
                </select>
                <div style={{fontWeight:700,fontSize:'0.8rem',color:s.day==='Saturday'?'#b45309':'var(--brand-deep)'}}>{s.day}</div>
                <input value={s.name} onChange={e=>updateService(i,'name',e.target.value)} placeholder="Program name" style={{padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',width:'100%',fontFamily:'var(--font-body)',fontSize:'0.88rem',boxSizing:'border-box'}} />
                <input value={s.time} onChange={e=>updateService(i,'time',e.target.value)} placeholder="e.g. 9:00 AM" style={{padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',width:'100%',fontFamily:'var(--font-body)',fontSize:'0.88rem',boxSizing:'border-box'}} />
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {tab==='announcement'&&(
        <AdminCard style={{maxWidth:720}}>
          <h3 style={{margin:'0 0 18px',color:'var(--brand-deep)'}}>Announcement Banner</h3>
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
              <input type="checkbox" checked={!!data.announcement?.show} onChange={e=>setData(d=>({...d,announcement:{...d.announcement,show:e.target.checked}}))} style={{width:18,height:18}} />
              Show announcement banner at the top of the site
            </label>
          </div>
          <div className="form-group"><label>Announcement Text</label><textarea value={data.announcement?.text||''} onChange={e=>setData(d=>({...d,announcement:{...d.announcement,text:e.target.value}}))} rows={3} placeholder="🎉 Join us this Saturday for our Annual Thanksgiving Service!" style={{resize:'vertical'}} /></div>
          {data.announcement?.show && data.announcement?.text && (
            <div style={{background:'var(--gold)',borderRadius:10,padding:'12px 18px',color:'var(--brand-deep)',fontWeight:700,fontSize:'0.9rem'}}>
              Preview: {data.announcement.text}
            </div>
          )}
        </AdminCard>
      )}

      {tab==='stats'&&(
        <AdminCard style={{maxWidth:560}}>
          <h3 style={{margin:'0 0 18px',color:'var(--brand-deep)'}}>Statistics</h3>
          {data.stats?.map((s,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label style={{fontSize:'0.72rem'}}>Value</label><input value={s.value} onChange={e=>updateStat(i,'value',e.target.value)} placeholder="500+" /></div>
              <div className="form-group" style={{margin:0}}><label style={{fontSize:'0.72rem'}}>Label</label><input value={s.label} onChange={e=>updateStat(i,'label',e.target.value)} placeholder="Active Members" /></div>
            </div>
          ))}
        </AdminCard>
      )}

      {tab==='contact'&&(
        <AdminCard style={{maxWidth:720}}>
          <h3 style={{margin:'0 0 18px',color:'var(--brand-deep)'}}>Contact Details</h3>
          <div className="form-group"><label>Church Address</label><input value={data.contact?.address||''} onChange={e=>setData(d=>({...d,contact:{...d.contact,address:e.target.value}}))} placeholder="123 Church Street, City, Country" /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="form-group"><label>Phone</label><input value={data.contact?.phone||''} onChange={e=>setData(d=>({...d,contact:{...d.contact,phone:e.target.value}}))} placeholder="+233 20 000 0000" /></div>
            <div className="form-group"><label>Email</label><input type="email" value={data.contact?.email||''} onChange={e=>setData(d=>({...d,contact:{...d.contact,email:e.target.value}}))} /></div>
          </div>
          <div className="form-group"><label>Google Maps Embed URL</label><input value={data.contact?.mapUrl||''} onChange={e=>setData(d=>({...d,contact:{...d.contact,mapUrl:e.target.value}}))} placeholder="https://maps.google.com/maps?q=..." /></div>
        </AdminCard>
      )}

      {tab==='verse'&&(
        <AdminCard style={{maxWidth:720}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18,flexWrap:'wrap',gap:10}}>
            <div>
              <h3 style={{margin:'0 0 4px',color:'var(--brand-deep)'}}>📖 Daily Verse Override</h3>
              <p style={{color:'var(--text-light)',fontSize:'0.82rem',margin:0}}>
                By default the app fetches a verse from an API automatically each day. Use this to set your own verse for today.
              </p>
            </div>
            {verseActive && (
              <span style={{background:'#dcfce7',color:'#15803d',fontWeight:700,fontSize:'0.72rem',padding:'4px 12px',borderRadius:10,border:'1px solid #86efac',whiteSpace:'nowrap'}}>
                ✅ Override active today
              </span>
            )}
          </div>

          {verseLoading ? (
            <p style={{color:'var(--text-light)'}}>Loading…</p>
          ) : (
            <>
              <div className="form-group">
                <label>Verse Text <span style={{color:'#dc2626'}}>*</span></label>
                <textarea
                  value={verse.text}
                  onChange={e=>setVerse(v=>({...v,text:e.target.value}))}
                  rows={4}
                  placeholder="Enter the full verse text…"
                  style={{resize:'vertical'}}
                />
              </div>
              <div className="form-group">
                <label>Reference <span style={{color:'#dc2626'}}>*</span></label>
                <input
                  value={verse.reference}
                  onChange={e=>setVerse(v=>({...v,reference:e.target.value}))}
                  placeholder="e.g. John 3:16"
                />
              </div>
              <div className="form-group">
                <label>Reflection / Thought (optional)</label>
                <textarea
                  value={verse.reflection}
                  onChange={e=>setVerse(v=>({...v,reflection:e.target.value}))}
                  rows={3}
                  placeholder="A short reflection or application thought to go with the verse…"
                  style={{resize:'vertical'}}
                />
              </div>

              {/* Background colour picker */}
              <div style={{marginBottom:18}}>
                <label style={{display:'block',fontWeight:700,fontSize:'0.8rem',color:'var(--text-mid)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>Banner Background</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {BG_COLORS.map(c=>(
                    <button
                      key={c.value}
                      onClick={()=>setVerse(v=>({...v,bg_color:c.value}))}
                      title={c.label}
                      style={{
                        width:36,height:36,borderRadius:'50%',border:'none',cursor:'pointer',
                        background:c.value,
                        outline:verse.bg_color===c.value?'3px solid #0a2612':'3px solid transparent',
                        outlineOffset:2,transition:'outline 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {verse.text && verse.reference && (
                <div style={{borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:'0 4px 20px rgba(0,0,0,0.15)'}}>
                  <div style={{background:verse.bg_color||DEFAULT_BG,padding:'18px 20px'}}>
                    <div style={{fontSize:'2.5rem',color:'rgba(255,255,255,0.12)',lineHeight:1,marginBottom:-8,fontFamily:'Georgia,serif'}}>"</div>
                    <p style={{fontFamily:'Georgia,serif',fontStyle:'italic',color:'white',lineHeight:1.7,margin:'0 0 10px',fontSize:'0.95rem'}}>{verse.text}</p>
                    <span style={{background:'rgba(255,255,255,0.18)',borderRadius:20,padding:'3px 12px',color:'white',fontWeight:700,fontSize:'0.8rem'}}>— {verse.reference}</span>
                    {verse.reflection && <p style={{color:'rgba(255,255,255,0.8)',fontSize:'0.82rem',marginTop:10,lineHeight:1.6}}>{verse.reflection}</p>}
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <button
                  onClick={saveVerse}
                  disabled={verseSaving}
                  style={{padding:'10px 24px',borderRadius:30,border:'none',background:'var(--brand-mid)',color:'white',fontWeight:700,fontSize:'0.88rem',fontFamily:'var(--font-body)',cursor:'pointer',opacity:verseSaving?0.7:1}}
                >
                  {verseSaving?'Saving…':'📖 Set as Today\'s Verse'}
                </button>
                {verseActive && (
                  <button
                    onClick={clearVerseOverride}
                    disabled={verseSaving}
                    style={{padding:'10px 24px',borderRadius:30,border:'1.5px solid #e2e8f0',background:'transparent',color:'var(--text-mid)',fontWeight:600,fontSize:'0.88rem',fontFamily:'var(--font-body)',cursor:'pointer'}}
                  >
                    Clear Override (use API)
                  </button>
                )}
              </div>

              <p style={{color:'var(--text-light)',fontSize:'0.76rem',marginTop:14,marginBottom:0}}>
                💡 The override only applies for today's date. Tomorrow the app will automatically fetch from the Bible API again unless you set a new override.
              </p>
            </>
          )}
        </AdminCard>
      )}

      <div style={{marginTop:22}}>
        <button className="btn btn-green" onClick={save} disabled={saving} style={{padding:'12px 32px',fontSize:'0.95rem'}}>
          {saving?'⏳ Saving...':'💾 Save All Homepage Changes'}
        </button>
      </div>
    </div>
  )
}
