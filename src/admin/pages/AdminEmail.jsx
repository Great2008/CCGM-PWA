import { useState, useEffect } from 'react'
import { useAdmin } from '../AdminApp'
import supabaseAdmin from '../../lib/supabase'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'

const TABS = ['✉️ Email', '💬 WhatsApp', '👥 Subscribers']

export default function AdminEmail() {
  const { showToast, logAction } = useAdmin()
  const [tab, setTab]           = useState(0)
  const [subs, setSubs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [preview, setPreview]   = useState(false)
  const [form, setForm] = useState({
    subject:   '',
    greeting:  'Dear {name},',
    body:      '',
    signature: 'God bless you,\nCCG World Admin Team',
    footer:    'You are receiving this because you subscribed on CCG World.',
  })
  const [waMsg, setWaMsg]         = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [recipientSource, setRecipientSource] = useState('subscribers') // 'subscribers' | 'event'
  const [rsvpEvents, setRsvpEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [eventRecipients, setEventRecipients] = useState([])
  const [loadingEventRecipients, setLoadingEventRecipients] = useState(false)
  const [attachments, setAttachments] = useState([]) // {name, type, size, base64}

  const emailSubs = subs.filter(s => s.wants_email && s.active && s.email)
  const waSubs    = subs.filter(s => s.wants_whatsapp && s.active && s.whatsapp)
  const recipients = recipientSource === 'subscribers' ? emailSubs : eventRecipients

  useEffect(() => {
    supabaseAdmin
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false })
      .then(({ data }) => { setSubs(data || []); setLoading(false) })
    supabaseAdmin.from('events').select('id,title,date').order('date', { ascending: false })
      .then(({ data }) => setRsvpEvents(data || []))
  }, [])

  // Pull recipient emails from an event's registrations — both app users
  // (via their profile) and guests (via their guest_email).
  useEffect(() => {
    if (!selectedEventId) { setEventRecipients([]); return }
    setLoadingEventRecipients(true)
    supabaseAdmin.from('event_registrations')
      .select('is_guest, guest_name, guest_email, profiles!user_id(email, full_name, display_name)')
      .eq('event_id', selectedEventId)
      .then(({ data, error }) => {
        if (error) { showToast('Could not load RSVP list: ' + error.message, 'error'); setEventRecipients([]); setLoadingEventRecipients(false); return }
        const list = (data || [])
          .map(r => r.is_guest
            ? { email: r.guest_email, name: r.guest_name || 'Guest' }
            : { email: r.profiles?.email, name: r.profiles?.display_name || r.profiles?.full_name || 'Member' }
          )
          .filter(r => r.email)
        setEventRecipients(list)
        setLoadingEventRecipients(false)
      })
  }, [selectedEventId])

  const F = k => ({ value: form[k] || '', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const buildHtml = (name = 'Member') => `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#0f1f3d,#1a3a6b);padding:32px;text-align:center;">
        <div style="color:#f59e0b;font-size:1.5rem;font-weight:900;letter-spacing:2px;">CCG WORLD</div>
        <div style="color:rgba(255,255,255,0.6);font-size:0.75rem;letter-spacing:3px;margin-top:4px;">CHRISTIAN CHURCH OF GOD MISSION</div>
      </div>
      <div style="padding:40px 36px;">
        <p style="color:#1e293b;margin:0 0 20px;">${form.greeting.replace('{name}', name)}</p>
        ${form.body.split('\n\n').map(p => `<p style="color:#334155;line-height:1.8;margin:0 0 18px;">${p.replace(/\n/g, '<br/>')}</p>`).join('')}
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
          ${form.signature.split('\n').map(l => `<p style="color:#1e293b;margin:0;">${l}</p>`).join('')}
        </div>
      </div>
      <div style="background:#f8fafc;padding:20px 36px;text-align:center;">
        <p style="color:#94a3b8;font-size:0.75rem;margin:0;">${form.footer}</p>
      </div>
    </div>`

  const handleSendEmail = async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      showToast('Please fill in subject and body', 'error'); return
    }
    if (recipients.length === 0) {
      showToast(recipientSource === 'event' ? 'No RSVPs with an email found for this event' : 'No email subscribers found', 'error'); return
    }
    if (!window.confirm(`Send this email to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}?`)) return
    setSending(true)
    try {
      const { error } = await supabaseAdmin.functions.invoke('send-newsletter', {
        body: {
          subject: form.subject,
          greeting: form.greeting,
          body: form.body,
          signature: form.signature,
          footer: form.footer,
          recipients: recipients.map(s => ({ email: s.email, name: s.name || 'Member' })),
          attachments: attachments.map(a => ({ filename: a.name, contentType: a.type, base64: a.base64 })),
        },
      })
      if (error) throw error
      await supabaseAdmin.from('email_logs').insert({
        subject: form.subject, body: form.body,
        recipients: recipients.length,
        recipient_emails: recipients.map(s => s.email),
        sent_at: new Date().toISOString(), status: 'sent',
      })
      logAction('email_sent', `Email sent to ${recipients.length} recipients (${recipientSource === 'event' ? 'event RSVPs' : 'newsletter subscribers'}): ${form.subject}`, form.subject); showToast(`✅ Email sent to ${recipients.length} recipients!`)
      setForm(f => ({ ...f, subject: '', body: '' }))
      setAttachments([])
    } catch {
      if (recipients.length <= 50) {
        const emails  = recipients.map(s => s.email).join(',')
        const subject = encodeURIComponent(form.subject)
        const body    = encodeURIComponent(
          form.greeting.replace('{name}', 'Member') + '\n\n' + form.body +
          '\n\n' + form.signature + '\n\n---\n' + form.footer
        )
        window.open(`mailto:${emails}?subject=${subject}&body=${body}`)
        showToast(`Opened Gmail with ${recipients.length} recipients`)
      } else {
        showToast('Edge Function not configured yet — see setup notice above', 'error')
      }
    }
    setSending(false)
  }

  const handleWABroadcast = () => {
    if (!waMsg.trim()) { showToast('Please enter a message', 'error'); return }
    if (waSubs.length === 0) { showToast('No WhatsApp subscribers', 'error'); return }
    const encoded = encodeURIComponent(waMsg.trim())
    const first   = waSubs[0].whatsapp.replace(/[^0-9+]/g, '')
    window.open(`https://wa.me/${first}?text=${encoded}`, '_blank')
    showToast(`WhatsApp opened. Copy message to remaining ${waSubs.length - 1} contacts via Broadcast List.`)
  }

  const copyWANumbers = () => {
    const nums = waSubs.map(s => s.whatsapp).join('\n')
    navigator.clipboard.writeText(nums)
      .then(() => showToast(`Copied ${waSubs.length} WhatsApp numbers!`))
      .catch(() => showToast('Copy failed', 'error'))
  }

  const copyWAMessage = () => {
    if (!waMsg.trim()) { showToast('No message to copy', 'error'); return }
    navigator.clipboard.writeText(waMsg.trim()).then(() => showToast('Message copied!'))
  }

  const removeSub = async (id) => {
    if (!window.confirm('Remove this subscriber?')) return
    setRemovingId(id)
    await supabaseAdmin.from('newsletter_subscribers').update({ active: false }).eq('id', id); logAction('newsletter_unsubscribe', `Unsubscribed member from newsletter`, null)
    setSubs(s => s.map(sub => sub.id === id ? { ...sub, active: false } : sub))
    setRemovingId(null)
    showToast('Subscriber removed')
  }

  const filteredSubs = subs.filter(s => {
    const q = subSearch.toLowerCase()
    return !q || (s.email || '').toLowerCase().includes(q) || (s.whatsapp || '').includes(q)
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>Loading subscribers...</div>

  return (
    <div>
      <PageHeader icon="📨" title="Newsletter"
        subtitle={`${emailSubs.length} email · ${waSubs.length} WhatsApp subscribers`}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '👥', label: 'Total Active',  value: subs.filter(s => s.active).length,   color: 'var(--brand-light)' },
          { icon: '✉️',  label: 'Email',         value: emailSubs.length,                    color: 'var(--brand-mid)'   },
          { icon: '💬', label: 'WhatsApp',       value: waSubs.length,                       color: '#25D366'            },
          { icon: '📊', label: 'Both channels',  value: subs.filter(s => s.active && s.wants_email && s.wants_whatsapp).length, color: 'var(--gold)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #e2e8f0' }}>
            <div style={{ fontSize: '1.3rem' }}>{stat.icon}</div>
            <div style={{ fontWeight: 900, fontSize: '1.6rem', color: stat.color, lineHeight: 1.1, margin: '4px 0 2px' }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            flex: 1, padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === i ? 'white' : 'transparent',
            color: tab === i ? 'var(--brand-deep)' : 'var(--text-light)',
            fontWeight: tab === i ? 700 : 400, fontSize: '0.84rem',
            fontFamily: 'var(--font-body)', boxShadow: tab === i ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* ── EMAIL TAB ── */}
      {tab === 0 && (
        <AdminCard style={{ maxWidth: 720 }}>
          {/* Recipient source */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setRecipientSource('subscribers')} className={recipientSource === 'subscribers' ? 'btn btn-blue' : 'btn btn-outline-blue'} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                👥 Newsletter Subscribers ({emailSubs.length})
              </button>
              <button onClick={() => setRecipientSource('event')} className={recipientSource === 'event' ? 'btn btn-blue' : 'btn btn-outline-blue'} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                🎟️ Event RSVPs
              </button>
            </div>
            {recipientSource === 'event' && (
              <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                <option value="">Select event...</option>
                {rsvpEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>)}
              </select>
            )}
          </div>

          {recipients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>✉️</div>
              {recipientSource === 'subscribers' ? (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>No email subscribers yet</div>
                  <p style={{ fontSize: '0.85rem', maxWidth: 340, margin: '0 auto' }}>Subscribers appear here when users sign up on the Blog page.</p>
                </>
              ) : !selectedEventId ? (
                <div style={{ fontWeight: 700 }}>Select an event above to load its RSVPs</div>
              ) : loadingEventRecipients ? (
                <div>Loading RSVPs...</div>
              ) : (
                <div style={{ fontWeight: 700 }}>No RSVPs with an email found for this event</div>
              )}
            </div>
          ) : (
            <>
              <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '14px 18px', marginBottom: 18, fontSize: '0.82rem', color: '#92400e' }}>
                <strong>⚙️ Gmail Setup</strong> — Add these secrets to your Supabase Edge Function dashboard:
                <code style={{ display: 'block', marginTop: 6, background: 'rgba(0,0,0,0.06)', padding: '6px 10px', borderRadius: 6, lineHeight: 1.8 }}>
                  GMAIL_USER = yourname@gmail.com<br />
                  GMAIL_APP_PASSWORD = xxxx-xxxx-xxxx-xxxx
                </code>
                <span style={{ display: 'block', marginTop: 6 }}>
                  Generate an App Password at <strong>myaccount.google.com → Security → 2-Step Verification → App passwords</strong>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>
                  Sending to <strong style={{ color: 'var(--brand-deep)' }}>{recipients.length}</strong> {recipientSource === 'event' ? 'RSVPs' : 'subscribers'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline-blue" onClick={() => setPreview(p => !p)} style={{ fontSize: '0.82rem', padding: '8px 16px' }}>
                    {preview ? '📝 Edit' : '👁 Preview'}
                  </button>
                  <button className="btn btn-blue" onClick={handleSendEmail} disabled={sending} style={{ fontSize: '0.82rem', padding: '8px 18px' }}>
                    {sending ? '⏳ Sending...' : '📤 Send'}
                  </button>
                </div>
              </div>

              {preview ? (
                <div>
                  <div style={{ marginBottom: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-light)' }}>Subject: </span>
                    <strong style={{ color: 'var(--brand-deep)' }}>{form.subject || '(no subject)'}</strong>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: buildHtml('John Smith') }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Subject *</label>
                    <input {...F('subject')} placeholder="e.g. 🙏 CCG World Newsletter — March 2026" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Greeting</label>
                    <input {...F('greeting')} />
                    <small style={{ color: 'var(--text-light)', fontSize: '0.74rem' }}>{'{name}'} is replaced with each subscriber's name</small>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Message Body *</label>
                    <textarea {...F('body')} rows={10} style={{ resize: 'vertical', lineHeight: 1.8 }}
                      placeholder={"We're excited to share this month's updates with you...\n\nBlank lines create new paragraphs."} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Sign-off</label>
                      <textarea {...F('signature')} rows={3} style={{ resize: 'vertical', fontSize: '0.88rem' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Footer</label>
                      <textarea {...F('footer')} rows={3} style={{ resize: 'vertical', fontSize: '0.88rem' }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Attachments (optional)</label>
                    <input type="file" multiple onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      const currentSize = attachments.reduce((s, a) => s + a.size, 0)
                      const newSize = files.reduce((s, f) => s + f.size, 0)
                      if (currentSize + newSize > 15 * 1024 * 1024) {
                        showToast('Attachments too large — keep total under 15MB', 'error'); e.target.value = ''; return
                      }
                      const read = file => new Promise((resolve, reject) => {
                        const r = new FileReader()
                        r.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, base64: r.result.split(',')[1] })
                        r.onerror = reject
                        r.readAsDataURL(file)
                      })
                      try {
                        const newAttachments = await Promise.all(files.map(read))
                        setAttachments(a => [...a, ...newAttachments])
                      } catch { showToast('Could not read one of the files', 'error') }
                      e.target.value = ''
                    }} />
                    {attachments.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {attachments.map((a, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', background: '#f8fafc', padding: '6px 12px', borderRadius: 8 }}>
                            <span>📎 {a.name} ({(a.size / 1024).toFixed(0)}KB)</span>
                            <button onClick={() => setAttachments(list => list.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <small style={{ color: 'var(--text-light)', fontSize: '0.74rem' }}>Same attachment(s) sent to every recipient. Total kept under 15MB.</small>
                  </div>
                </div>
              )}
            </>
          )}
        </AdminCard>
      )}

      {/* ── WHATSAPP TAB ── */}
      {tab === 1 && (
        <AdminCard style={{ maxWidth: 720 }}>
          {waSubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>💬</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>No WhatsApp subscribers yet</div>
              <p style={{ fontSize: '0.85rem', maxWidth: 340, margin: '0 auto' }}>
                Subscribers who opt-in to WhatsApp when signing up on the Blog page will appear here.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: 'rgba(37,211,102,0.08)', border: '1.5px solid #25D366', borderRadius: 12, padding: '14px 18px', marginBottom: 18, fontSize: '0.82rem', color: '#065f46', lineHeight: 1.7 }}>
                <strong>💬 How to broadcast:</strong> Compose your message → Copy numbers → Save them as contacts in your phone → Use WhatsApp <strong>Broadcast Lists</strong> to send to all at once.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>
                  <strong style={{ color: '#25D366' }}>{waSubs.length}</strong> WhatsApp subscribers
                </span>
                <button onClick={copyWANumbers} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 30,
                  border: '1.5px solid #25D366', background: 'white', color: '#16a34a',
                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>📋 Copy All Numbers</button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18, padding: '8px', background: '#f8fafc', borderRadius: 10, maxHeight: 90, overflowY: 'auto' }}>
                {waSubs.map(s => (
                  <span key={s.id} style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', fontSize: '0.76rem', color: '#065f46', fontWeight: 600 }}>
                    {s.whatsapp}
                  </span>
                ))}
              </div>

              <div className="form-group" style={{ margin: '0 0 14px' }}>
                <label>Message</label>
                <textarea
                  value={waMsg}
                  onChange={e => setWaMsg(e.target.value)}
                  rows={8}
                  style={{ resize: 'vertical', lineHeight: 1.8 }}
                  placeholder={"🙏 *CCG World Update*\n\nDear Family,\n\nThis week's devotional...\n\nGod bless you,\nCCG World Team\nccgworld.org"}
                />
                <small style={{ color: 'var(--text-light)', fontSize: '0.74rem' }}>
                  Use *bold* and _italic_ for WhatsApp formatting.
                </small>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={copyWAMessage} style={{
                  flex: 1, padding: '11px 0', borderRadius: 30,
                  border: '1.5px solid #25D366', background: 'white', color: '#16a34a',
                  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>📋 Copy Message</button>
                <button onClick={handleWABroadcast} style={{
                  flex: 2, padding: '11px 0', borderRadius: 30,
                  background: '#25D366', color: 'white', border: 'none',
                  fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
                }}>💬 Open WhatsApp →</button>
              </div>
            </>
          )}
        </AdminCard>
      )}

      {/* ── SUBSCRIBERS TAB ── */}
      {tab === 2 && (
        <AdminCard>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              placeholder="🔍 Search by email or number..."
              style={{ flex: '1 1 220px', padding: '9px 14px', borderRadius: 30, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.85rem', outline: 'none' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
              {subs.filter(s => s.active).length} active
            </span>
          </div>

          {filteredSubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>No subscribers yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Email', 'WhatsApp', 'Channels', 'Subscribed', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-light)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc', opacity: s.active ? 1 : 0.4 }}>
                      <td style={{ padding: '9px 10px', color: 'var(--brand-deep)', fontWeight: 600, wordBreak: 'break-all' }}>{s.email || '—'}</td>
                      <td style={{ padding: '9px 10px', color: 'var(--text-mid)' }}>{s.whatsapp || '—'}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {s.wants_email    && <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 10, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>✉️</span>}
                          {s.wants_whatsapp && <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 10, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700 }}>💬</span>}
                        </div>
                      </td>
                      <td style={{ padding: '9px 10px', color: 'var(--text-light)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        {s.active
                          ? <button onClick={() => removeSub(s.id)} disabled={removingId === s.id} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-body)' }}>Remove</button>
                          : <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Removed</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}
    </div>
  )
}
