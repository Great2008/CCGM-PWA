import { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import AOS from 'aos'
import 'aos/dist/aos.css'
import supabase from '../lib/supabase'
import SEO from '../components/SEO'
import GalleryCarousel from '../components/GalleryCarousel'
import { filterGallery } from '../lib/galleryCarousel'
import { ownDomainImageUrl, onImageError, SITE_ORIGIN } from '../lib/imageUrl'

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
  const [downloading, setDownloading] = useState(false)
  const [query, setQuery]     = useState('')

  useEffect(() => {
    loadGallery().then(data => { setImages(data); setLoading(false) })
  }, [])

  // Scroll animations (AOS). Skipped for people who have "reduce motion" switched on.
  useEffect(() => {
    AOS.init({
      duration: 700, easing: 'ease-out-cubic', once: true, offset: 40,
      disable: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    })
  }, [])

  const categories = ['All', ...new Set(images.map(i => i.category).filter(Boolean))]
  const filtered = filterGallery(images, filter, query)
  const featured = images.filter(i => i.featured)
  const searching = query.trim().length > 0

  // Tells Google what this page contains (a gallery of photos), using the first 50 photos.
  const galleryJsonLd = useMemo(() => {
    if (!images.length) return null
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: 'CCG World Photo Gallery',
      url: `${SITE_ORIGIN}/gallery`,
      description: 'Photos and memories from CCG World church events, services and programmes.',
      image: images.slice(0, 50).map(i => ({
        '@type': 'ImageObject',
        contentUrl: ownDomainImageUrl(i.url || i.src),
        name: i.title || i.caption || undefined,
        caption: i.caption || undefined,
        uploadDate: String(i.date || i.created_at || '').slice(0, 10) || undefined,
      })),
    }).replace(/</g, '\\u003c')
  }, [images])

  // New cards appear whenever the filter, search or photo list changes: tell AOS to look again.
  useEffect(() => {
    const t = setTimeout(() => AOS.refreshHard(), 60)
    return () => clearTimeout(t)
  }, [loading, filter, query, images.length])

  return (
    <>
      <SEO
        title="Gallery"
        description="Photos and memories from CCG World church events, services and programmes."
        path="/gallery"
      />
      {galleryJsonLd && (
        <Helmet><script type="application/ld+json">{galleryJsonLd}</script></Helmet>
      )}
      <div style={{
        background: 'linear-gradient(160deg,rgba(10,38,18,0.93) 0%,rgba(22,100,52,0.87) 55%,rgba(22,163,74,0.45) 100%),url("https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1600&q=80") center/cover no-repeat',
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
              {/* Featured 3D carousel (hidden while searching or filtering, so results come first) */}
              {featured.length > 0 && filter === 'All' && !searching && (
                <GalleryCarousel items={featured} onOpen={setLightbox} />
              )}

              {/* Search by title */}
              <form role="search" onSubmit={e => { e.preventDefault(); document.activeElement?.blur?.() }} style={{
                display: 'flex', maxWidth: 520, margin: '0 auto 24px', background: 'white', border: '1.5px solid #e2e8f0',
                borderRadius: 40, overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
              }}>
                <input
                  type="text" value={query} onChange={e => setQuery(e.target.value)} enterKeyHint="search"
                  placeholder="Search photos by title…" aria-label="Search photos by title" autoComplete="off"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '13px 20px', fontSize: '0.95rem', fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text-dark)' }}
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 12px', color: 'var(--text-light)', fontSize: '1rem' }}>✕</button>
                )}
                <button type="submit" aria-label="Search" style={{
                  border: 'none', background: 'var(--brand-mid)', color: 'white', padding: '0 22px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-body)',
                }}>🔍 Search</button>
              </form>
              {searching && (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', margin: '-8px 0 24px' }}>
                  {filtered.length} {filtered.length === 1 ? 'photo matches' : 'photos match'} “{query.trim()}”
                </p>
              )}

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
                  {filtered.map((img, idx) => (
                    <div key={img.id} data-aos="fade-up" data-aos-delay={(idx % 3) * 90} style={{ breakInside: 'avoid', marginBottom: 18, cursor: 'pointer' }}
                      onClick={() => setLightbox(img)}>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
                        <img
                          src={ownDomainImageUrl(img.url || img.src)}
                          alt={img.caption || img.title || ''}
                          loading="lazy" decoding="async"
                          onError={onImageError(img.url || img.src)}
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
                  <p>{searching ? `No photos match “${query.trim()}”.` : 'No photos in this category.'}</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (() => {
        const originalUrl = lightbox.url || lightbox.src
        const imgUrl = ownDomainImageUrl(originalUrl)
        const handleDownload = async () => {
          setDownloading(true)
          try {
            const res = await fetch(imgUrl)
            const blob = await res.blob()
            const blobUrl = URL.createObjectURL(blob)
            const ext = (imgUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 4)
            const name = (lightbox.caption || lightbox.title || 'ccgworld-photo').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = `${name}.${ext}`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(blobUrl)
          } catch {
            // Cross-origin fetch blocked or failed — fall back to opening the
            // image directly so the person can still long-press/save it.
            window.open(imgUrl, '_blank')
          } finally {
            setDownloading(false)
          }
        }

        return (
          <div onClick={() => setLightbox(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
              <img
                src={imgUrl}
                onError={onImageError(originalUrl)}
                alt={lightbox.caption || lightbox.title || ''}
                style={{ width: '100%', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
                <p style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0 }}>
                  {lightbox.caption || lightbox.title || ''}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleDownload} disabled={downloading} style={{
                    background: 'var(--brand-light, #16a34a)', border: 'none',
                    color: 'white', padding: '8px 20px', borderRadius: 30, cursor: 'pointer', fontSize: '0.88rem',
                    fontWeight: 600, opacity: downloading ? 0.7 : 1,
                  }}>{downloading ? 'Downloading…' : '⬇ Download'}</button>
                  <button onClick={() => setLightbox(null)} style={{
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white', padding: '8px 20px', borderRadius: 30, cursor: 'pointer', fontSize: '0.88rem',
                  }}>✕ Close</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </>
  )
}
