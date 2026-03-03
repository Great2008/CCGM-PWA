import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabaseAdmin'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

export default function AdminEmail() {
  const { showToast } = useAdmin()
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [preview, setPreview]   = useState(false)
  const [form, setForm] = useState({
    subject: '',
    greeting: 'Dear Member,',
    body: '',
    signature: 'God bless you,\nCCG World Admin Team',
    footer: 'You are receiving this because you are a registered member of CCG World.',
  })

  useEffect(() => {
    supabaseAdmin.from('profiles')
      .select('id,email,display_name,full_name')
      .eq('approved', true)
      .not('email','is',null)
      .then(({ data }) => { setMembers(data||[]); setLoading(false) })
  }, [])

  const F = k => ({ value: form[k]||'', onChange: e => setForm(f=>({...f,[k]:e.target.value})) })

  // Build email HTML preview
  const buildHtml = (name='Member') => `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:32px;text-align:center;">
        <div style="color:#f59e0b;font-size:1.5rem;font-weight:900;letter-spacing:2px;">CCG WORLD</div>
        <div style="color:rgba(255,255,255,0.6);font-size:0.75rem;letter-spacing:3px;margin-top:4px;">CHRISTIAN CHURCH OF GOD MISSION</div>
      </div>
      <div style="padding:40px 36px;">
        <p style="color:#1e293b;margin:0 0 20px;">${form.greeting.replace('Member', name)}</p>
        ${form.body.split('\n\n').map(p=>`<p style="color:#334155;line-height:1.8;margin:0 0 18px;">${p.replace(/\n/g,'<br/>')}</p>`).join('')}
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
          ${form.signature.split('\n').map(l=>`<p style="color:#1e293b;margin:0;">${l}</p>`).join('')}
        </div>
      </div>
      <div style="background:#f8fafc;padding:20px 36px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.75rem;margin:0;">${form.footer}</p>
      </div>
    </div>`

  const handleSend = async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      showToast('Please fill in subject and message body', 'error'); return
    }
    if (!window.confirm(`Send this email to ${members.length} approved members?`)) return

    setSending(true)

    // Use Supabase Edge Function or send via mailto: batch
    // Since we don't have a transactional email service configured yet,
    // we'll save to an email_log table and show the admin what was sent
    try {
      const { error } = await supabaseAdmin.from('email_logs').insert({
        subject: form.subject,
        body: form.body,
        greeting: form.greeting,
        signature: form.signature,
        recipients: members.length,
        recipient_emails: members.map(m=>m.email),
        sent_at: new Date().toISOString(),
        status: 'pending', // Will be 'sent' once email provider is connected
      })
      if (error) throw error

      // Build mailto with all recipients (works for small lists, opens email client)
      const emails = members.map(m=>m.email).filter(Boolean).join(',')
      const subject = encodeURIComponent(form.subject)
      const body = encodeURIComponent(
        form.greeting + '\n\n' + form.body + '\n\n' + form.signature + '\n\n---\n' + form.footer
      )
      window.open(`mailto:${emails}?subject=${subject}&body=${body}`)

      setSent(true)
      showToast(`Email opened for ${members.length} members!`)
    } catch(e) {
      showToast(e.message, 'error')
    }
    setSending(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Loading members...</div>

  if (sent) return (
    <div>
      <PageHeader icon="✉️" title="Bulk Email" />
      <AdminCard style={{textAlign:'center',padding:'60px 40px'}}>
        <div style={{fontSize:'3.5rem',marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:'var(--font-display)',color:'var(--brand-deep)',marginBottom:12}}>Email Ready!</h2>
        <p style={{color:'var(--text-mid)',maxWidth:440,margin:'0 auto 24px',lineHeight:1.8}}>
          Your email client opened with <strong>{members.length} recipients</strong> pre-filled. Review and click Send in your email app.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button className="btn btn-blue" onClick={()=>setSent(false)}>✉️ Send Another</button>
          <button className="btn btn-outline-blue" onClick={()=>{ setSent(false); setForm({subject:'',greeting:'Dear Member,',body:'',signature:'God bless you,\nCCG World Admin Team',footer:'You are receiving this because you are a registered member of CCG World.'}) }}>Start Fresh</button>
        </div>
      </AdminCard>
    </div>
  )

  return (
    <div>
      <PageHeader icon="✉️" title="Bulk Email"
        subtitle={`Send to ${members.length} approved members`}
        action={
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline-blue" onClick={()=>setPreview(p=>!p)} style={{fontSize:'0.85rem'}}>{preview?'📝 Edit':'👁 Preview'}</button>
            <button className="btn btn-blue" onClick={handleSend} disabled={sending||members.length===0}>
              {sending?'⏳ Opening...':sending?'':'📤 Send Email'}
            </button>
          </div>
        }
      />

      {/* Recipient summary */}
      <div style={{background:'linear-gradient(135deg,var(--brand-pale),white)',border:'1.5px solid #bfdbfe',borderRadius:14,padding:'16px 20px',marginBottom:20,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{fontSize:'1.6rem'}}>👥</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:'var(--brand-deep)',marginBottom:2}}>Sending to {members.length} approved members</div>
          <div style={{fontSize:'0.78rem',color:'var(--text-light)',lineHeight:1.6}}>
            {members.slice(0,5).map(m=>m.email).join(', ')}{members.length>5?` and ${members.length-5} more...`:''}
          </div>
        </div>
      </div>

      {preview ? (
        <AdminCard style={{maxWidth:640}}>
          <div style={{marginBottom:12,padding:'10px 14px',background:'#f8fafc',borderRadius:8,fontSize:'0.85rem'}}>
            <span style={{color:'var(--text-light)'}}>Subject: </span>
            <span style={{fontWeight:700,color:'var(--brand-deep)'}}>{form.subject||'(no subject)'}</span>
          </div>
          <div dangerouslySetInnerHTML={{__html: buildHtml('John Smith')}} />
        </AdminCard>
      ) : (
        <AdminCard style={{maxWidth:720}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="form-group" style={{margin:0}}>
              <label>Subject Line *</label>
              <input {...F('subject')} placeholder="e.g. 🙏 CCG World Newsletter — March 2026" style={{fontSize:'1rem',fontWeight:500}} />
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Greeting</label>
              <input {...F('greeting')} placeholder="Dear Member," />
              <small style={{color:'var(--text-light)',fontSize:'0.74rem'}}>"Member" is replaced with each person's name automatically</small>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>Message Body *</label>
              <textarea {...F('body')} rows={12} style={{resize:'vertical',lineHeight:1.8,fontSize:'0.92rem'}}
                placeholder={"We are excited to share this month's updates with you...\n\nBlank lines between paragraphs will create spacing in the email.\n\nUse plain text — no HTML needed."} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div className="form-group" style={{margin:0}}>
                <label>Sign-off</label>
                <textarea {...F('signature')} rows={3} style={{resize:'vertical',fontSize:'0.88rem'}} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>Footer (small text)</label>
                <textarea {...F('footer')} rows={3} style={{resize:'vertical',fontSize:'0.88rem'}} />
              </div>
            </div>
          </div>
        </AdminCard>
      )}

      {members.length === 0 && (
        <div style={{marginTop:16,background:'#fff9f0',border:'1.5px solid #fed7aa',borderRadius:12,padding:'14px 18px',color:'#c2410c',fontSize:'0.88rem'}}>
          ⚠️ No approved members with email addresses found. Approve members first in the Members panel.
        </div>
      )}
    </div>
  )
}
