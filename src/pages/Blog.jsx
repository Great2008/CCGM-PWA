import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import ShareButton, { ShareButtonLight } from '../components/ShareButton'
import NewsletterSignup from '../components/NewsletterSignup'
import SEO from '../components/SEO'

const CACHE_KEY = 'ccgworld_blog'

async function loadPosts() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .order('date', { ascending: false })
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


function renderBody(body) {
  if (!body) return null
  return (
    <div style={{ fontSize:'0.95rem', color:'var(--text-dark)', lineHeight:1.9 }}>
      {body.split('\n\n').map((para, i) =>
        para.startsWith('##') ? (
          <h3 key={i} style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.15rem', margin:'24px 0 10px', borderBottom:'2px solid var(--brand-pale)', paddingBottom:6 }}>
            {para.replace(/^##\s*/, '')}
          </h3>
        ) : para.startsWith('#') ? (
          <h4 key={i} style={{ fontFamily:'var(--font-display)', color:'var(--brand-light)', fontSize:'1rem', margin:'18px 0 8px', fontWeight:700 }}>
            {para.replace(/^#\s*/, '')}
          </h4>
        ) : (
          <p key={i} style={{ marginBottom:16 }}>
            {para.split('**').map((chunk, j) =>
              j % 2 === 1 ? <strong key={j} style={{ color:'var(--brand-deep)' }}>{chunk}</strong> : chunk
            )}
          </p>
        )
      )}
    </div>
  )
}

export default function Blog() {
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadPosts().then(data => { setPosts(data); setLoading(false) })
  }, [])

  const [featured, ...rest] = posts

  return (
    <>
      <SEO
        title="Blog"
        description="Read the latest articles, news and updates from CCG World — Christian Church Of God Mission."
        path="/blog"
      />
      <div style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1600&q=80") center/cover no-repeat',
        padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Daily Inspiration</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: 16 }}>
          Blog & Devotionals
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
          Daily encouragement, scripture reflections, and faith-building articles from our pastors and leaders.
        </p>
      </div>

      <section style={{ background: 'var(--cream)', padding: '70px 5%' }}>
        <div className="container">

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>✍️</div>
              <p>Loading posts...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && posts.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'var(--white, white)', borderRadius: 20, boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>✍️</div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', marginBottom: 12 }}>
                No Posts Yet
              </h3>
              <p style={{ color: 'var(--text-mid)', maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
                Devotionals and blog posts will appear here. Check back soon!
              </p>
            </div>
          )}

          {/* Posts */}
          {!loading && posts.length > 0 && (
            <>
              {/* Featured post */}
              <div style={{ marginBottom: 56 }}>
                <span className="section-label">Featured Post</span>
                <div className="card blog-featured-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
                  {featured.image_url ? (
                    <img src={featured.image_url} alt={featured.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 300 }} />
                  ) : (
                    <div style={{
                      minHeight: 300, background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem',
                    }}>✍️</div>
                  )}
                  <div style={{ padding: '40px 36px' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      {featured.category && <span className="tag">{featured.category}</span>}
                      {featured.read_time && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{featured.read_time}</span>}
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--brand-deep)', marginBottom: 12, lineHeight: 1.3 }}>
                      {featured.title}
                    </h2>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 14 }}>
                      {featured.author && <>By <strong style={{ color: 'var(--brand-mid)' }}>{featured.author}</strong> · </>}
                      {featured.date}
                    </div>
                    {featured.excerpt && (
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-mid)', lineHeight: 1.8, marginBottom: 24 }}>
                        {featured.excerpt}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {featured.body && (
                        <button className="btn btn-green" onClick={() => setExpanded(expanded?.id === featured.id ? null : featured)}>
                          {expanded?.id === featured.id ? 'Show Less ↑' : 'Read Full Article →'}
                        </button>
                      )}
                      <ShareButtonLight
                        title={featured.title}
                        text={featured.excerpt || featured.title}
                      />
                    </div>
                    {expanded?.id === featured.id && (
                      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
                        {renderBody(featured.body)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rest of posts */}
              {rest.length > 0 && (
                <>
                  <span className="section-label">More Devotionals</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 24, marginTop: 16 }}>
                    {rest.map(post => (
                      <div key={post.id} className="card">
                        {post.image_url ? (
                          <img src={post.image_url} alt={post.title} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                        ) : (
                          <div style={{
                            height: 120, background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-mid))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
                          }}>✍️</div>
                        )}
                        <div style={{ padding: '22px' }}>
                          <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            {post.category && <span className="tag">{post.category}</span>}
                            {post.read_time && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{post.read_time}</span>}
                          </div>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--brand-deep)', marginBottom: 8, lineHeight: 1.35 }}>
                            {post.title}
                          </h3>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 10 }}>
                            {post.author && <>By <strong style={{ color: 'var(--brand-mid)' }}>{post.author}</strong> · </>}
                            {post.date}
                          </div>
                          {post.excerpt && (
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', lineHeight: 1.65, marginBottom: 16 }}>
                              {post.excerpt}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {post.body && (
                              <>
                                <button className="btn btn-outline-green" style={{ padding: '8px 20px', fontSize: '0.8rem' }}
                                  onClick={() => setExpanded(expanded?.id === post.id ? null : post)}>
                                  {expanded?.id === post.id ? 'Show Less ↑' : 'Read More →'}
                                </button>
                              </>
                            )}
                            <ShareButtonLight
                              title={post.title}
                              text={post.excerpt || post.title}
                            />
                          </div>
                          {expanded?.id === post.id && (
                            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
                              {renderBody(post.body)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Newsletter */}
          {!loading && (
            <div style={{
              marginTop: 64,
              background: 'linear-gradient(135deg, var(--brand-mid) 0%, var(--brand-deep) 100%)',
              borderRadius: 20, padding: '50px 40px', textAlign: 'center',
            }}>
              <NewsletterSignup />
            </div>
          )}
        </div>
      </section>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @media(max-width:768px){.blog-featured-card{grid-template-columns:1fr!important;}}
      `}</style>
    </>
  )
}
