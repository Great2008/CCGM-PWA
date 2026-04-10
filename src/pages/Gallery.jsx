import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import SEO from '../components/SEO'

const CACHE_KEY = 'ccgworld_gallery'

async function loadGallery() {
  try {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    // Always overwrite cache — deletions must be reflected
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

export default function Gallery() {
  const [images, setImages]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('All')
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    loadGallery().then(data => { setImages(data); setLoading(false) })
  }, [])

  const categories = ['All', ...new Set(images.map(i => i.category).filter(Boolean))]
  const filtered = filter === 'All' ? images : images.filter(i => i.category === filter)

  return (
    <>
      <SEO
        title="Gallery"
        description="Photos and memories from CCG World church events, services and programmes."
        path="/gallery"
      />
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 100%)',
        padding: 'clamp(90px,14vw,130px) 5% 60px', textAlign: 'center',
      }}>
        <span className="section-label" style={{ color: 'var(--gold)' }}>Our Community</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: 16 }}>
          Photo Gallery
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 520, margin: '0 auto' }}>
          Capturing moments of faith, fellowship, and worship in our church family.
        </p>
      </div>

      <section style={{ background: 'var(--cream)', padding: '60px 5%' }}>
        <div className="container">

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🖼</div>
              <p>Loading gallery...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && images.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '80px 20px',
              background: 'var(--white, white)', borderRadius: 20, boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: 20 }}>📷</div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.5rem', marginBottom: 12 }}>
                No Photos Yet
              </h3>
              <p style={{ color: 'var(--text-mid)', maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
                Photos from our services and events will appear here. Check back soon!
              </p>
            </div>
          )}

          {/* Gallery */}
          {!loading && images.length > 0 && (
            <>
              {/* Category filters */}
              {categories.length > 1 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)} style={{
                      padding: '9px 22px', borderRadius: 30, border: '1.5px solid',
                      borderColor: filter === cat ? 'var(--brand-mid)' : '#ddd',
                      background: filter === cat ? 'var(--brand-mid)' : 'white',
                      color: filter === cat ? 'white' : 'var(--text-mid)',
                      fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    }}>{cat}</button>
                  ))}
                </div>
              )}

              {/* Masonry grid */}
              {filtered.length > 0 ? (
                <div style={{ columns: '3 280px', gap: 18 }}>
                  {filtered.map(img => (
                    <div key={img.id} style={{ breakInside: 'avoid', marginBottom: 18, cursor: 'pointer' }}
                      onClick={() => setLightbox(img)}>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
                        <img
                          src={img.url || img.src}
                          alt={img.caption || img.title || ''}
                          style={{ width: '100%', display: 'block', transition: 'transform 0.4s' }}
                          onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; e.target.nextSibling.style.opacity = '1' }}
                          onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.nextSibling.style.opacity = '0' }}
                        />
                        <div style={{
                          position: 'absolute', inset: 0, opacity: 0,
                          background: 'rgba(15,31,61,0.75)', transition: 'opacity 0.3s',
                          display: 'flex', alignItems: 'flex-end', padding: 16,
                          pointerEvents: 'none',
                        }}>
                          <div>
                            {img.category && (
                              <span className="tag" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: 6, display: 'inline-block' }}>
                                {img.category}
                              </span>
                            )}
                            {(img.caption || img.title) && (
                              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                                {img.caption || img.title}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                  <p>No photos in this category.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
            <img
              src={lightbox.url || lightbox.src}
              alt={lightbox.caption || lightbox.title || ''}
              style={{ width: '100%', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
              <p style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0 }}>
                {lightbox.caption || lightbox.title || ''}
              </p>
              <button onClick={() => setLightbox(null)} style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                color: 'white', padding: '8px 20px', borderRadius: 30, cursor: 'pointer', fontSize: '0.88rem',
              }}>✕ Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </>
  )
}
