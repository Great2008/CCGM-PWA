import { useState } from 'react'
import { useAdmin } from '../AdminApp'
import { useTable } from '../useSupabaseAdmin'
import supabaseAdmin from '../../lib/supabaseAdmin'
import { Confirm } from '../components/CrudShell'

const ROLE_COLORS = { admin:'#7c3aed', member:'#2563eb' }

export default function AdminMembers() {
  const { showToast } = useAdmin()
  const { rows: members, loading, update, remove, reload } = useTable('profiles', { order:'created_at', asc:false })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [delId, setDelId]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    const matchQ = !q || (m.full_name||'').toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q)
    const matchF = filter==='all' || m.role===filter
    return matchQ && matchF
  })

  const counts = {
    all: members.length,
    admin: members.filter(m=>m.role==='admin').length,
    member: members.filter(m=>m.role==='member').length,
  }

  const setRole = async (id, role) => {
    setSaving(true)
    try { await update(id, { role }); showToast(`Role updated to ${role}`) }
    catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }


  const deleteUser = async () => {
    setSaving(true)
    try {
      await supabaseAdmin.auth.admin.deleteUser(delId)
      await remove(delId)
      showToast('Member deleted.')
      setDelId(null); setSelected(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  const initials = p => (p?.display_name || p?.full_name || '?').charAt(0).toUpperCase()

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading members...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',fontSize:'1.7rem',margin:'0 0 4px'}}>👥 Members</h1>
          <p style={{color:'var(--text-light)',margin:0,fontSize:'0.86rem'}}>{members.length} total members</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[['all','All',counts.all],['member','Active',counts.member],['admin','Admins',counts.admin]].map(([id,label,count])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{
            padding:'8px 18px',borderRadius:30,border:'1.5px solid',
            borderColor:filter===id?'var(--brand-light)':'#e2e8f0',
            background:filter===id?'var(--brand-light)':'white',
            color:filter===id?'white':'var(--text-mid)',
            fontSize:'0.82rem',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',
            display:'flex',gap:6,alignItems:'center',
          }}>
            {label}
            <span style={{background:'rgba(255,255,255,0.25)',borderRadius:20,padding:'0 7px',fontSize:'0.72rem'}}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{position:'relative',marginBottom:20,maxWidth:400}}>
        <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'var(--text-light)',fontSize:'1rem'}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email..." style={{width:'100%',padding:'10px 14px 10px 40px',borderRadius:30,border:'1.5px solid #e2e8f0',fontFamily:'var(--font-body)',fontSize:'0.9rem',outline:'none',boxSizing:'border-box'}} />
      </div>

      {/* Two-pane layout */}
      <div className="members-pane" style={{display:'grid',gridTemplateColumns:selected?'minmax(0,1fr) min(320px,35%)':'1fr',gap:20,alignItems:'start'}}>
        {/* Member list */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length===0&&<div style={{background:'white',borderRadius:14,padding:'40px 20px',textAlign:'center',color:'var(--text-light)'}}>No members found.</div>}
          {filtered.map(m=>(
            <div key={m.id} onClick={()=>setSelected(m)} style={{
              background:'white',borderRadius:12,padding:'14px 18px',cursor:'pointer',
              display:'flex',alignItems:'center',gap:14,
              boxShadow:'0 1px 8px rgba(0,0,0,0.06)',
              border:`1.5px solid ${selected?.id===m.id?'var(--brand-light)':'transparent'}`,
              transition:'border-color 0.15s',
            }}>
              <div style={{width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,var(--brand-light),var(--gold))`,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'1.1rem',flexShrink:0}}>
                {m.avatar_url ? <img src={m.avatar_url} alt="" style={{width:44,height:44,borderRadius:'50%',objectFit:'cover'}} /> : initials(m)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:'var(--text-dark)',fontSize:'0.95rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.full_name||m.display_name||'Unknown'}</div>
                <div style={{fontSize:'0.78rem',color:'var(--text-light)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.email}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <span style={{fontSize:'0.68rem',fontWeight:700,padding:'2px 10px',borderRadius:20,background:(ROLE_COLORS[m.role]||'#94a3b8')+'20',color:ROLE_COLORS[m.role]||'#94a3b8'}}>
                  {m.role||'member'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail pane */}
        {selected && (
          <div style={{position:'sticky',top:20}}>
            <div style={{background:'white',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.09)',overflow:'hidden'}}>
              {/* Header */}
              <div style={{background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',padding:'24px 20px',textAlign:'center',position:'relative'}}>
                <button onClick={()=>setSelected(null)} style={{position:'absolute',top:12,right:14,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,width:28,height:28,color:'white',cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                <div style={{width:64,height:64,borderRadius:'50%',background:'linear-gradient(135deg,var(--brand-light),var(--gold))',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:'1.6rem',margin:'0 auto 12px'}}>
                  {selected.avatar_url ? <img src={selected.avatar_url} alt="" style={{width:64,height:64,borderRadius:'50%',objectFit:'cover'}} /> : initials(selected)}
                </div>
                <div style={{color:'white',fontWeight:700,fontSize:'1.1rem'}}>{selected.full_name||selected.display_name||'Unknown'}</div>
                <div style={{color:'rgba(255,255,255,0.6)',fontSize:'0.8rem',marginTop:2}}>{selected.email}</div>
              </div>

              <div style={{padding:'20px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18,fontSize:'0.8rem'}}>
                  {[
                    ['Joined', selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'],
                    ['Role', selected.role||'member'],
                    ['Status', '✅ Active'],
                    ['Display Name', selected.display_name||'—'],
                  ].map(([k,v])=>(
                    <div key={k} style={{background:'#f8fafc',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{color:'var(--text-light)',fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{k}</div>
                      <div style={{color:'var(--text-dark)',fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {selected.role!=='admin' && (
                    <button onClick={()=>setRole(selected.id,'admin')} disabled={saving} style={{padding:'10px',borderRadius:10,border:'1.5px solid var(--brand-light)',background:'white',color:'var(--brand-light)',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.88rem'}}>
                      🛡 Make Admin
                    </button>
                  )}
                  {selected.role==='admin' && (
                    <button onClick={()=>setRole(selected.id,'member')} disabled={saving} style={{padding:'10px',borderRadius:10,border:'1.5px solid #e2e8f0',background:'white',color:'var(--text-mid)',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.88rem'}}>
                      👤 Remove Admin Role
                    </button>
                  )}
                  <button onClick={()=>setDelId(selected.id)} style={{padding:'10px',borderRadius:10,border:'1.5px solid #fecaca',background:'white',color:'#dc2626',fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'0.88rem'}}>
                    🗑 Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {delId && <Confirm message="Permanently delete this member account? This cannot be undone." onConfirm={deleteUser} onCancel={()=>setDelId(null)} loading={saving} />}
      <style>{`
        @media(max-width:860px){
          .members-pane { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
