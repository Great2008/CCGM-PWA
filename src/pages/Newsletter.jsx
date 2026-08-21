import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { ShareButtonLight } from '../components/ShareButton'
import { APP_URL } from '../lib/config'
import NewsletterSignup from '../components/NewsletterSignup'
import SEO from '../components/SEO'
import { parseBlocks, renderInline } from '../lib/textFormat'

const CACHE_KEY = 'ccgworld_newsletters'

async function loadNewsletters() {
  try {
    const { data, error } = await supabase
      .from('newsletters')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
    if (error) throw error
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data ?? [])) } catch {}
    return data ?? []
  } catch {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  }
}

// Mirrors the admin preview and the email rendering — same shared parser,
// so a newsletter looks identical everywhere it appears.
function renderBody(body) {
  if (!body) return null
  return (
    <div style={{ fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.9 }}>
      {parseBlocks(body).map((para, i) => (
        /^##/.test(para)
          ? <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.15rem', margin: '26px 0 10px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 5 }}>{renderInline(para.replace(/^##\s*/, ''))}</h3>
          : /^#/.test(para)
          ? <h4 key={i} style={{ color: 'var(--brand-light)', fontSize: '1.02rem', margin: '18px 0 6px', fontWeight: 700 }}>{renderInline(para.replace(/^#\s*/, ''))}</h4>
          : <p key={i} style={{ marginBottom: 16 }}>{renderInline(para)}</p>
      ))}
    </div>
  )
}

function previewText(body) {
  const firstPara = parseBlocks(body).find(b => !/^#/.test(b))
  return firstPara || ''
}

export default function Newsletter() {
  const [newsletters, setNewsletters] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadNewsletters().then(data => { setNewsletters(data); setLoading(false) })
  }, [])

  return (
    <>
      <SEO
        title="Newsletter"
        description="Read past newsletters from CCG World, and subscribe to get future issues straight to your inbox."
        path="/newsletter"
      />
      <div style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Stay Connected</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: 16 }}>
          Newsletter
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          Announcements, updates, and encouragement from CCG World — read past issues below, or subscribe to get the next one by email.
        </p>
      </div>

      <section style={{ background: 'var(--cream)', padding: '70px 5%' }}>
        <div className="container" style={{ maxWidth: 720 }}>

          {/* Subscribe */}
          <div style={{
            marginBottom: 64,
            background: 'linear-gradient(135deg, var(--brand-mid) 0%, var(--brand-deep) 100%)',
            borderRadius: 20, padding: '50px 40px', textAlign: 'center',
          }}>
            <NewsletterSignup />
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>✉️</div>
              <p>Loading newsletters...</p>
            </div>
          )}

          {!loading && newsletters.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'white', borderRadius: 20, boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
              <p style={{ color: 'var(--text-light)' }}>No newsletters published yet — check back soon.</p>
            </div>
          )}

          {!loading && newsletters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {newsletters.map(n => {
                const isOpen = expanded === n.id
                const preview = previewText(n.body)
                return (
                  <div key={n.id} style={{ background: 'white', borderRadius: 16, padding: '28px 32px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 8 }}>
                      {new Date(n.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.3rem', marginBottom: 14 }}>
                      {n.subject}
                    </h2>
                    {isOpen ? renderBody(n.body) : (
                      <p style={{ color: 'var(--text-mid)', lineHeight: 1.8, fontSize: '0.95rem' }}>{renderInline(preview)}</p>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
                      <button className="btn btn-green" onClick={() => setExpanded(isOpen ? null : n.id)}>
                        {isOpen ? 'Show Less ↑' : 'Read Full Newsletter →'}
                      </button>
                      <ShareButtonLight title={n.subject} text={`${APP_URL}/newsletter#newsletter-${n.id}\n\n${n.subject}`} includeLink={false} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </>
  )
}
