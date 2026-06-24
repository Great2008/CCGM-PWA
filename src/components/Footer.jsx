import { Link } from 'react-router-dom'
import { useHomepageContent } from '../hooks/useContent'

export default function Footer() {
  const { data: hp } = useHomepageContent()
  const year = new Date().getFullYear()
  return (
    <footer style={{ background:'var(--brand-deep)', color:'white', paddingTop:56, paddingBottom:24 }}>
      <div className="container">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:36, marginBottom:44 }}>
          {/* Brand */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <img src="/logo.png" alt="CCG World" style={{ width:52, height:52, objectFit:'contain', flexShrink:0, filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }} />
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'1.05rem' }}>CCG <span style={{ color:'var(--gold)' }}>World</span></div>
                <div style={{ fontSize:'0.6rem', letterSpacing:'0.18em', color:'rgba(255,255,255,0.62)', textTransform:'uppercase', marginTop:1 }}>God First</div>
              </div>
            </div>
            <p style={{ fontSize:'0.88rem', color:'rgba(255,255,255,0.62)', lineHeight:1.8 }}>
              A Spirit-filled community committed to worship, growth, and service in the name of Jesus Christ.
            </p>
          </div>
          {/* Links */}
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', marginBottom:16, color:'var(--gold)' }}>Navigate</h2>
            {[['/', 'Home'],['/sermons','Sermons'],['/events','Events'],['/about','About'],['/blog','Blog'],['/bible','📖 Bible'],['/hymnal','🎵 Hymnal'],['/devotional','🌅 Devotional'],['/timeline','💬 Timeline'],['/gallery','Gallery']].map(([to,label])=>(
              <Link key={to} to={to} style={{ display:'block', color:'rgba(255,255,255,0.62)', fontSize:'0.86rem', marginBottom:6, transition:'color 0.2s' }}
              onMouseEnter={e=>e.target.style.color='white'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.62)'}>→ {label}</Link>
            ))}
          </div>
          {/* Programs */}
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', marginBottom:16, color:'var(--gold)' }}>Weekly Programs</h2>
            {hp.serviceTimes.map(({day,name,time})=>(
              <div key={day} style={{ marginBottom:10 }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{day}</div>
                <div style={{ fontSize:'0.86rem', color:day==='Saturday'?'var(--gold)':'var(--brand-glow)', fontWeight:day==='Saturday'?700:400 }}>{name}{time?` · ${time}`:''}</div>
              </div>
            ))}
          </div>
          {/* Contact */}
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', marginBottom:16, color:'var(--gold)' }}>Get In Touch</h2>
            {[hp.contact?.address&&['📍',hp.contact.address], hp.contact?.phone&&['📞',hp.contact.phone], hp.contact?.email&&['✉️',hp.contact.email]].filter(Boolean).map(([icon,text])=>(
              <div key={text} style={{ display:'flex', gap:10, marginBottom:11, alignItems:'flex-start' }}>
                <span style={{ fontSize:'1rem', marginTop:1, flexShrink:0 }}>{icon}</span>
                <span style={{ fontSize:'0.86rem', color:'rgba(255,255,255,0.62)', lineHeight:1.5 }}>{text}</span>
              </div>
            ))}
            {!hp.contact?.address&&!hp.contact?.phone&&<p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.62)', fontStyle:'italic' }}>Contact info</p>}
            <Link to="/contact" style={{ display:'inline-block', marginTop:14, border:'1.5px solid var(--gold)', color:'var(--gold)', padding:'8px 22px', borderRadius:30, fontSize:'0.78rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>🙏 Prayer Request</Link>
          </div>
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:18, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.62)' }}>© {year} CCG World — CCG World. All rights reserved.</p>
          <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.62)' }}>"For God so loved the world..." — John 3:16</p>
        </div>
      </div>
    </footer>
  )
}
