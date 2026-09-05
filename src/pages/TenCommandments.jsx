import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

// Reuses the same bundled offline KJV file the Bible reader uses
// (public/data/kjv-bible.json) so this page can never drift from what
// the rest of the app shows for these same verses.
const BIBLE_DATA_URL = '/data/kjv-bible.json'
let KJV_MEMORY = null

async function loadFullBible() {
  if (KJV_MEMORY) return KJV_MEMORY
  const res = await fetch(BIBLE_DATA_URL)
  if (!res.ok) throw new Error('Could not load bundled Bible data')
  KJV_MEMORY = await res.json()
  return KJV_MEMORY
}

// Verse groupings per commandment, as specified.
const COMMANDMENTS = [
  { num: 1,  verses: [3] },
  { num: 2,  verses: [4, 5, 6] },
  { num: 3,  verses: [7] },
  { num: 4,  verses: [8, 9, 10, 11] },
  { num: 5,  verses: [12] },
  { num: 6,  verses: [13] },
  { num: 7,  verses: [14] },
  { num: 8,  verses: [15] },
  { num: 9,  verses: [16] },
  { num: 10, verses: [17] },
]

const sectionHeader = {
  fontFamily: 'var(--font-display)', color: 'var(--brand-deep)',
  fontSize: '1.3rem', margin: '36px 0 16px', textAlign: 'center',
}
const readingBox = {
  background: 'var(--brand-pale)', borderRadius: 16, padding: '20px 22px',
}
const verseP = { lineHeight: 1.85, margin: '0 0 10px', color: 'var(--text-dark, #1e293b)' }
const commandmentCard = {
  border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px',
}
const numberBadge = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-deep)',
  color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
}

function verseText(chapterVerses, num) {
  const v = chapterVerses?.find(v => v.verse === num)
  return v ? v.text : ''
}

export default function TenCommandments() {
  const [exo20, setExo20] = useState(null)
  const [eph6, setEph6]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadFullBible()
      .then(bible => {
        if (!active) return
        setExo20(bible.EXO?.['20'] || [])
        setEph6(bible.EPH?.['6'] || [])
      })
      .catch(() => { if (active) setError('Could not load scripture text — check your connection and try again.') })
    return () => { active = false }
  }, [])

  const loading = !exo20 && !error

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(90px,14vw,130px) 16px 60px' }}>
      <SEO title="The Ten Commandments" description="Exodus 20:1-17, King James Version." path="/ten-commandments" />

      <Link to="/divine-service" style={{ fontSize: '0.82rem', color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none' }}>
        ← Divine Service
      </Link>

      <div style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <span className="section-label">Exodus 20:1–17 · King James Version</span>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: 'clamp(1.8rem,5vw,2.6rem)', margin: '8px 0 0' }}>
          📜 The Ten Commandments
        </h1>
      </div>

      {loading && <p style={{ textAlign: 'center', marginTop: 24 }}>Loading…</p>}
      {error && <p style={{ textAlign: 'center', marginTop: 24, color: '#b91c1c' }}>{error}</p>}

      {exo20 && (
        <>
          <h2 style={sectionHeader}>Reading Before the Law</h2>
          <div style={readingBox}>
            {[1, 2].map(n => (
              <p key={n} style={verseP}>
                <sup style={{ fontSize: '0.7em', marginRight: 4, color: 'var(--brand-light)', fontWeight: 700 }}>{n}</sup>
                {verseText(exo20, n)}
              </p>
            ))}
          </div>

          <h2 style={sectionHeader}>The Ten Commandments</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {COMMANDMENTS.map(c => (
              <div key={c.num} style={commandmentCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={numberBadge}>{c.num}</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    Exodus 20:{c.verses.length > 1 ? `${c.verses[0]}–${c.verses[c.verses.length - 1]}` : c.verses[0]}
                  </span>
                </div>
                {c.verses.map(n => (
                  <p key={n} style={verseP}>{verseText(exo20, n)}</p>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {eph6 && (
        <>
          <h2 style={sectionHeader}>Reading After the Law</h2>
          <div style={readingBox}>
            <p style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: 8 }}>Ephesians 6:12</p>
            <p style={verseP}>{verseText(eph6, 12)}</p>
          </div>
        </>
      )}
    </div>
  )
}
