import { useState } from 'react'
import { useHomepageContent } from '../hooks/useContent'
import supabase from '../lib/supabase'
import AppDownloadBanner from '../components/AppDownloadBanner'
import SEO from '../components/SEO'

export default function Contact() {
  const { data: hp } = useHomepageContent()
  const [form, setForm] = useState({ name:'', email:'', phone:'', subject:'Prayer Request', message:'' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      // Insert as anonymous — uses anon key with RLS policy "prayers: anyone submit"
      const { data, error: err } = await supabase
        .from('prayers')
        .insert([{
          name: form.name,
          email: form.email,
          request: form.subject === 'General Inquiry'
            ? form.message
            : `[${form.subject}] ${form.message}`,
          prayer_type: form.subject,
          status: 'new',
        }])
        .select()

      if (err) {
        console.error('Supabase error:', err)
        throw new Error(err.message)
      }
      setSubmitted(true)
    } catch (err) {
      console.error('Submit error:', err)
      setError(`Failed to send: ${err.message}. Please try again or contact us directly.`)
    } finally {
      setLoading(false)
    }
  }

  const contact = hp?.contact || {}

  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with CCG World — Christian Church Of God Mission. Send a prayer request, general inquiry or find out how to get involved."
        path="/contact"
      />
      <div style={{ background:'linear-gradient(135deg,var(--brand-deep) 0%,var(--brand-mid) 100%)', padding:'clamp(90px,14vw,130px) 5% 56px', textAlign:'center' }}>
        <span className="section-label">Get In Touch</span>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'clamp(2rem,5vw,3.2rem)', color:'white', margin:'8px 0 16px' }}>Contact Us</h1>
        <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'clamp(0.95rem,1.8vw,1.1rem)', maxWidth:520, margin:'0 auto', lineHeight:1.8 }}>
          Reach out for prayer, information, or just to say hello. Our team will respond within 24 hours.
        </p>
      </div>

      <section style={{ padding:'clamp(48px,8vw,80px) 5%' }}>
        <div className="container">
          <div className="contact-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:60, alignItems:'start' }}>

            {/* Info */}
            <div>
              <h2 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.5rem', marginBottom:24 }}>We'd Love to Hear From You</h2>
              {[
                ['📍', 'Address', contact.address || 'Contact us for our location'],
                ['📞', 'Phone',   contact.phone   || 'Contact us for our phone number'],
                ['✉️', 'Email',   contact.email   || 'info@ccgworld.org'],
              ].map(([icon,label,val]) => (
                <div key={label} style={{ display:'flex', gap:16, marginBottom:24 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:'var(--brand-pale)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:2 }}>{label}</div>
                    <div style={{ color:'var(--text-mid)', fontSize:'0.9rem' }}>{val}</div>
                  </div>
                </div>
              ))}
              <div style={{ background:'var(--brand-pale)', borderRadius:16, padding:'20px 22px', marginTop:8 }}>
                <div style={{ fontWeight:700, color:'var(--brand-deep)', marginBottom:6 }}>🙏 Prayer Line</div>
                <div style={{ color:'var(--text-mid)', fontSize:'0.88rem', lineHeight:1.7 }}>Our prayer team is committed to standing with you in faith at any hour.</div>
                {contact.phone && <div style={{ color:'var(--brand-light)', fontWeight:700, marginTop:8 }}>{contact.phone}</div>}
              </div>
            </div>

            {/* Form */}
            <div style={{ background: 'var(--white, white)', borderRadius:20, padding:'clamp(24px,4vw,40px)', boxShadow:'var(--shadow-md)' }}>
              {submitted ? (
                <div style={{ textAlign:'center', padding:'40px 20px' }}>
                  <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🙏</div>
                  <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.6rem', marginBottom:12 }}>Thank You, {form.name.split(' ')[0]}!</h3>
                  <p style={{ color:'var(--text-mid)', lineHeight:1.8, marginBottom:28 }}>Your message has been received. Our team will be in prayer for you and will reach out shortly.</p>
                  <button onClick={()=>{ setSubmitted(false); setForm({ name:'', email:'', phone:'', subject:'Prayer Request', message:'' }) }} className="btn btn-blue" style={{ padding:'12px 32px' }}>
                    SEND ANOTHER MESSAGE
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.3rem', marginBottom:24 }}>Send Us a Message</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                    <div className="form-group"><label>Full Name *</label><input name="name" value={form.name} onChange={handleChange} required placeholder="Your full name" /></div>
                    <div className="form-group"><label>Email *</label><input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="your@email.com" /></div>
                    <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={handleChange} placeholder="+234 800 000 0000" /></div>
                    <div className="form-group">
                      <label>Subject</label>
                      <select name="subject" value={form.subject} onChange={handleChange} style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', width:'100%', fontFamily:'var(--font-body)', fontSize:'0.9rem', background: 'var(--white, white)' }}>
                        {['Prayer Request','General Inquiry','Event Information','Counseling','Partnership','Volunteer'].map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label>Message *</label>
                      <textarea name="message" value={form.message} onChange={handleChange} required rows={5} placeholder="How can we help or pray for you?" style={{ resize:'vertical' }} />
                    </div>
                  </div>
                  {error && (
                    <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.85rem', marginBottom:16 }}>
                      ❌ {error}
                    </div>
                  )}
                  <button type="submit" className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'14px' }} disabled={loading}>
                    {loading ? '⏳ Sending...' : '✉️ Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <AppDownloadBanner />

      <style>{`
        @media(max-width:768px){ .contact-grid{grid-template-columns:1fr!important;gap:32px!important;} }
      `}</style>
    </>
  )
}
