import { useState, useMemo } from 'react'

// ─── Data ────────────────────────────────────────────────────────────────────
const PRAYER_CATEGORIES = [
  {
    id: 'healing', label: 'Healing', icon: '🌿',
    description: 'Physical, emotional & spiritual restoration',
    verses: [
      { ref: 'Jeremiah 17:14',   text: 'Heal me, O LORD, and I shall be healed; save me, and I shall be saved: for thou art my praise.' },
      { ref: 'James 5:14–15',    text: 'Is any sick among you? let him call for the elders of the church; and let them pray over him, anointing him with oil in the name of the Lord: and the prayer of faith shall save the sick.' },
      { ref: 'Psalm 103:2–3',    text: 'Bless the LORD, O my soul, and forget not all his benefits: who forgiveth all thine iniquities; who healeth all thy diseases.' },
      { ref: 'Isaiah 53:5',      text: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.' },
      { ref: '3 John 1:2',       text: 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.' },
      { ref: 'Psalm 30:2',       text: 'O LORD my God, I cried unto thee, and thou hast healed me.' },
      { ref: 'Exodus 15:26',     text: 'I am the LORD that healeth thee.' },
    ],
  },
  {
    id: 'protection', label: 'Protection', icon: '🛡️',
    description: 'Safety, covering & divine shelter',
    verses: [
      { ref: 'Psalm 91:1–2',         text: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.' },
      { ref: 'Isaiah 54:17',         text: 'No weapon that is formed against thee shall prosper; and every tongue that shall rise against thee in judgment thou shalt condemn.' },
      { ref: '2 Thessalonians 3:3',  text: 'But the Lord is faithful, who shall stablish you, and keep you from evil.' },
      { ref: 'Proverbs 18:10',       text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.' },
      { ref: 'Psalm 121:7–8',        text: 'The LORD shall preserve thee from all evil: he shall preserve thy soul. The LORD shall preserve thy going out and thy coming in from this time forth.' },
      { ref: 'Deuteronomy 31:6',     text: 'Be strong and courageous. Do not be afraid or terrified, for the LORD your God goes with you; he will never leave you nor forsake you.' },
      { ref: 'Psalm 46:1',           text: 'God is our refuge and strength, a very present help in trouble.' },
    ],
  },
  {
    id: 'guidance', label: 'Guidance', icon: '🧭',
    description: 'Wisdom, direction & clarity in decisions',
    verses: [
      { ref: 'Proverbs 3:5–6',  text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
      { ref: 'Psalm 32:8',      text: 'I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.' },
      { ref: 'James 1:5',       text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },
      { ref: 'Isaiah 30:21',    text: 'And thine ears shall hear a word behind thee, saying, This is the way, walk ye in it, when ye turn to the right hand, and when ye turn to the left.' },
      { ref: 'John 16:13',      text: 'Howbeit when he, the Spirit of truth, is come, he will guide you into all truth.' },
      { ref: 'Psalm 25:9',      text: 'The meek will he guide in judgment: and the meek will he teach his way.' },
      { ref: 'Jeremiah 29:11',  text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
    ],
  },
  {
    id: 'thanksgiving', label: 'Thanksgiving', icon: '🙌',
    description: 'Gratitude & praise for God\'s goodness',
    verses: [
      { ref: '1 Thessalonians 5:18',  text: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },
      { ref: 'Psalm 107:1',           text: 'O give thanks unto the LORD, for he is good: for his mercy endureth for ever.' },
      { ref: 'Colossians 3:17',       text: 'And whatsoever ye do in word or deed, do all in the name of the Lord Jesus, giving thanks to God and the Father by him.' },
      { ref: 'Philippians 4:6',       text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
      { ref: 'Psalm 100:4',           text: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.' },
      { ref: 'Ephesians 5:20',        text: 'Giving thanks always for all things unto God and the Father in the name of our Lord Jesus Christ.' },
    ],
  },
  {
    id: 'strength', label: 'Strength', icon: '💪',
    description: 'Endurance, courage & renewal of spirit',
    verses: [
      { ref: 'Isaiah 40:31',        text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
      { ref: 'Philippians 4:13',    text: 'I can do all things through Christ which strengtheneth me.' },
      { ref: 'Psalm 28:7',          text: 'The LORD is my strength and my shield; my heart trusted in him, and I am helped: therefore my heart greatly rejoiceth.' },
      { ref: 'Ephesians 6:10',      text: 'Finally, my brethren, be strong in the Lord, and in the power of his might.' },
      { ref: '2 Corinthians 12:9',  text: 'And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness.' },
      { ref: 'Deuteronomy 20:4',    text: 'For the LORD your God is he that goeth with you, to fight for you against your enemies, to save you.' },
      { ref: 'Joshua 1:9',          text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' },
    ],
  },
  {
    id: 'peace', label: 'Peace', icon: '🕊️',
    description: 'Calm, rest & freedom from anxiety',
    verses: [
      { ref: 'Philippians 4:7',   text: 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
      { ref: 'John 14:27',        text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.' },
      { ref: 'Isaiah 26:3',       text: 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.' },
      { ref: 'Romans 8:6',        text: 'For to be carnally minded is death; but to be spiritually minded is life and peace.' },
      { ref: 'Numbers 6:24–26',   text: 'The LORD bless thee, and keep thee: the LORD make his face shine upon thee, and be gracious unto thee: the LORD lift up his countenance upon thee, and give thee peace.' },
      { ref: 'Psalm 4:8',         text: 'I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.' },
    ],
  },
  {
    id: 'provision', label: 'Provision', icon: '🌾',
    description: 'Daily needs, finances & God\'s supply',
    verses: [
      { ref: 'Philippians 4:19',    text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.' },
      { ref: 'Matthew 6:31–33',     text: 'Therefore take no thought, saying, What shall we eat? or, What shall we drink? But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
      { ref: 'Psalm 23:1',          text: 'The LORD is my shepherd; I shall not want.' },
      { ref: '2 Corinthians 9:8',   text: 'And God is able to make all grace abound toward you; that ye, always having all sufficiency in all things, may abound to every good work.' },
      { ref: 'Luke 12:24',          text: 'Consider the ravens: for they neither sow nor reap; which neither have storehouse nor barn; and God feedeth them: how much more are ye better than the fowls?' },
      { ref: 'Deuteronomy 28:12',   text: 'The LORD shall open unto thee his good treasure, the heaven to give the rain unto thy land in his season, and to bless all the work of thine hand.' },
    ],
  },
  {
    id: 'forgiveness', label: 'Forgiveness', icon: '✝️',
    description: 'Cleansing, mercy & reconciliation',
    verses: [
      { ref: '1 John 1:9',      text: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.' },
      { ref: 'Psalm 51:10',     text: 'Create in me a clean heart, O God; and renew a right spirit within me.' },
      { ref: 'Isaiah 43:25',    text: 'I, even I, am he that blotteth out thy transgressions for mine own sake, and will not remember thy sins.' },
      { ref: 'Micah 7:18–19',   text: 'Who is a God like unto thee, that pardoneth iniquity... thou wilt cast all their sins into the depths of the sea.' },
      { ref: 'Hebrews 8:12',    text: 'For I will be merciful to their unrighteousness, and their sins and their iniquities will I remember no more.' },
      { ref: 'Romans 8:1',      text: 'There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.' },
    ],
  },
  {
    id: 'faith', label: 'Faith', icon: '🔥',
    description: 'Bold belief, trust & spiritual courage',
    verses: [
      { ref: 'Hebrews 11:1',    text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
      { ref: 'Mark 11:24',      text: 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.' },
      { ref: 'Romans 10:17',    text: 'So then faith cometh by hearing, and hearing by the word of God.' },
      { ref: 'Matthew 17:20',   text: 'If ye have faith as a grain of mustard seed, ye shall say unto this mountain, Remove hence to yonder place; and it shall remove; and nothing shall be impossible unto you.' },
      { ref: '2 Corinthians 5:7', text: 'For we walk by faith, not by sight.' },
      { ref: 'Galatians 2:20',  text: 'I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God.' },
    ],
  },
  {
    id: 'family', label: 'Family', icon: '🏡',
    description: 'Prayers for household, marriage & children',
    verses: [
      { ref: 'Joshua 24:15',      text: 'As for me and my house, we will serve the LORD.' },
      { ref: 'Psalm 127:3',       text: 'Lo, children are an heritage of the LORD: and the fruit of the womb is his reward.' },
      { ref: 'Proverbs 22:6',     text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.' },
      { ref: 'Ephesians 5:25',    text: 'Husbands, love your wives, even as Christ also loved the church, and gave himself for it.' },
      { ref: 'Ephesians 6:1–3',   text: 'Children, obey your parents in the Lord: for this is right. Honour thy father and mother; that it may be well with thee, and thou mayest live long on the earth.' },
      { ref: 'Colossians 3:18–19', text: 'Wives, submit yourselves unto your own husbands, as it is fit in the Lord. Husbands, love your wives, and be not bitter against them.' },
    ],
  },
  {
    id: 'salvation', label: 'Salvation', icon: '🕊️',
    description: 'Prayers for souls, evangelism & redemption',
    verses: [
      { ref: 'John 3:16',           text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
      { ref: 'Romans 10:9',         text: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.' },
      { ref: 'Acts 4:12',           text: 'Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved.' },
      { ref: '2 Peter 3:9',         text: 'The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance.' },
      { ref: 'Ezekiel 33:11',       text: 'As I live, saith the Lord GOD, I have no pleasure in the death of the wicked; but that the wicked turn from his way and live.' },
      { ref: 'Luke 19:10',          text: 'For the Son of man is come to seek and to save that which was lost.' },
    ],
  },
  {
    id: 'warfare', label: 'Spiritual Warfare', icon: '⚔️',
    description: 'Authority, binding & victory over darkness',
    verses: [
      { ref: 'Ephesians 6:11–12',   text: 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil. For we wrestle not against flesh and blood, but against principalities, against powers.' },
      { ref: '2 Corinthians 10:4',  text: 'For the weapons of our warfare are not carnal, but mighty through God to the pulling down of strong holds.' },
      { ref: 'Luke 10:19',          text: 'Behold, I give unto you power to tread on serpents and scorpions, and over all the power of the enemy: and nothing shall by any means hurt you.' },
      { ref: 'James 4:7',           text: 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.' },
      { ref: '1 Peter 5:8–9',       text: 'Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour: whom resist stedfast in the faith.' },
      { ref: 'Revelation 12:11',    text: 'And they overcame him by the blood of the Lamb, and by the word of their testimony.' },
    ],
  },
]

const STORAGE_KEY = 'ccgm_prayer_favourites_v1'

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveFavs(arr) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)) } catch {}
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VerseCard({ verse, isFav, onToggleFav, searchQuery = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(`"${verse.text}" — ${verse.ref}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Highlight matched text
  const highlighted = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase().trim()
    const parts = []
    const lower = verse.text.toLowerCase()
    let i = 0
    while (i < verse.text.length) {
      const idx = lower.indexOf(q, i)
      if (idx === -1) { parts.push({ text: verse.text.slice(i), hi: false }); break }
      if (idx > i) parts.push({ text: verse.text.slice(i, idx), hi: false })
      parts.push({ text: verse.text.slice(idx, idx + q.length), hi: true })
      i = idx + q.length
    }
    return parts
  }, [verse.text, searchQuery])

  return (
    <div style={{
      background: 'var(--white, white)',
      borderRadius: 12,
      padding: '16px 18px 12px',
      boxShadow: 'var(--shadow-sm)',
      borderLeft: '3px solid var(--brand-base)',
      marginBottom: 10,
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color: 'var(--gold)',
          fontSize: '0.82rem',
          letterSpacing: '0.02em',
        }}>{verse.ref}</span>
        <button
          onClick={() => onToggleFav(verse.ref)}
          title={isFav ? 'Remove from favourites' : 'Save to favourites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', lineHeight: 1, flexShrink: 0,
            opacity: isFav ? 1 : 0.35,
            transition: 'opacity 0.2s, transform 0.15s',
            transform: isFav ? 'scale(1.1)' : 'scale(1)',
          }}
        >⭐</button>
      </div>
      <p style={{
        fontSize: 'clamp(14px, 3.5vw, 15.5px)',
        lineHeight: 1.8,
        color: 'var(--text-dark)',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        margin: '0 0 10px',
      }}>
        "
        {highlighted
          ? highlighted.map((seg, i) => (
              <span key={i} style={seg.hi ? {
                background: '#fff176', color: '#222', borderRadius: 3,
                padding: '0 2px', fontWeight: 700, fontStyle: 'normal',
              } : {}}>{seg.text}</span>
            ))
          : verse.text}
        "
      </p>
      <button
        onClick={handleCopy}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.75rem', color: copied ? 'var(--brand-base)' : 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
          padding: 0, transition: 'color 0.2s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {copied ? '✓ Copied!' : '📋 Copy verse'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrayerTab() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [favourites, setFavourites] = useState(loadFavs)
  const [prayerView, setPrayerView] = useState('categories') // 'categories' | 'favourites' | 'search'
  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  const selected = PRAYER_CATEGORIES.find(c => c.id === activeCategory)

  const toggleFav = (ref) => {
    setFavourites(prev => {
      const next = prev.includes(ref) ? prev.filter(r => r !== ref) : [...prev, ref]
      saveFavs(next)
      return next
    })
  }

  // All verses flat list for search
  const allVerses = useMemo(() =>
    PRAYER_CATEGORIES.flatMap(cat => cat.verses.map(v => ({ ...v, catId: cat.id, catLabel: cat.label })))
  , [])

  // Favourite verse objects
  const favVerses = useMemo(() =>
    allVerses.filter(v => favourites.includes(v.ref))
  , [allVerses, favourites])

  // Search results
  const searchResults = useMemo(() => {
    if (!submittedQuery.trim()) return []
    const q = submittedQuery.toLowerCase()
    return allVerses.filter(v =>
      v.text.toLowerCase().includes(q) || v.ref.toLowerCase().includes(q) || v.catLabel.toLowerCase().includes(q)
    )
  }, [submittedQuery, allVerses])

  const runSearch = () => setSubmittedQuery(searchQuery)

  return (
    <div style={{ paddingTop: 28, maxWidth: 780 }}>

      {/* ── Sub-nav ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'categories', label: '🙏 Categories' },
          { id: 'search',     label: '🔍 Search Verses' },
          { id: 'favourites', label: `⭐ Saved (${favourites.length})` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => { setPrayerView(id); setActiveCategory(null) }} style={{
            padding: '8px 18px',
            borderRadius: 30,
            border: '1.5px solid',
            borderColor: prayerView === id ? 'var(--brand-base)' : '#ddd',
            background: prayerView === id ? 'var(--brand-base)' : 'var(--white, white)',
            color: prayerView === id ? 'white' : 'var(--text-mid)',
            fontWeight: 700, fontSize: '0.83rem',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ══════════════════ CATEGORIES VIEW ══════════════════ */}
      {prayerView === 'categories' && (
        <>
          {/* Category grid */}
          {!activeCategory && (
            <>
              <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: 16, fontStyle: 'italic' }}>
                Choose a theme to find scriptures that anchor your prayer.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>
                {PRAYER_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                    background: 'var(--white, white)',
                    borderRadius: 14,
                    border: '1.5px solid #e5f0e9',
                    padding: '16px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--brand-base)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = '#e5f0e9' }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green-deep)', fontSize: '0.9rem' }}>{cat.label}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cat.verses.length} verses</span>
                  </button>
                ))}
              </div>

              {/* Footer anchor */}
              <div style={{
                marginTop: 28, padding: '16px 20px',
                background: 'var(--brand-mist)', borderRadius: 14,
                border: '1px solid var(--brand-pale)', textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-mid)', lineHeight: 1.7, margin: 0 }}>
                  "The effectual fervent prayer of a righteous man availeth much."
                </p>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)', marginTop: 6, letterSpacing: '0.1em' }}>JAMES 5:16</span>
              </div>
            </>
          )}

          {/* Selected category detail */}
          {activeCategory && selected && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={() => setActiveCategory(null)} style={{
                  background: 'var(--white, white)', border: '1.5px solid #ddd',
                  borderRadius: 8, padding: '7px 14px',
                  fontSize: '0.8rem', color: 'var(--text-mid)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600,
                }}>← Back</button>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--green-deep)', margin: 0, fontSize: '1.2rem' }}>
                    {selected.icon} {selected.label}
                  </h3>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: '2px 0 0', fontStyle: 'italic' }}>
                    {selected.description}
                  </p>
                </div>
              </div>

              {selected.verses.map(v => (
                <VerseCard
                  key={v.ref}
                  verse={v}
                  isFav={favourites.includes(v.ref)}
                  onToggleFav={toggleFav}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ SEARCH VIEW ══════════════════ */}
      {prayerView === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder='Search prayer verses — e.g. "healing", "fear", "peace"'
              style={{
                flex: 1, padding: '12px 18px', borderRadius: 40,
                border: '1.5px solid #ddd', fontSize: '0.95rem',
                fontFamily: 'var(--font-body)', outline: 'none',
                boxShadow: 'var(--shadow-sm)',
              }}
              autoFocus
            />
            <button onClick={runSearch} className="btn btn-green" style={{ whiteSpace: 'nowrap', borderRadius: 40 }}>
              🔍 Search
            </button>
          </div>

          {submittedQuery && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 14 }}>
              {searchResults.length === 0
                ? `No verses found for "${submittedQuery}"`
                : `${searchResults.length} verse${searchResults.length === 1 ? '' : 's'} for "${submittedQuery}"`}
            </p>
          )}

          {searchResults.map(v => (
            <div key={v.ref}>
              <div style={{ fontSize: '0.7rem', color: 'var(--brand-base)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                {v.catLabel}
              </div>
              <VerseCard
                verse={v}
                isFav={favourites.includes(v.ref)}
                onToggleFav={toggleFav}
                searchQuery={submittedQuery}
              />
            </div>
          ))}

          {!submittedQuery && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
              <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
                Search across all {allVerses.length} prayer verses
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ FAVOURITES VIEW ══════════════════ */}
      {prayerView === 'favourites' && (
        <div>
          {favVerses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⭐</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
                No saved verses yet.<br />
                Tap the ⭐ on any verse to save it here.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 16, fontStyle: 'italic' }}>
                {favVerses.length} saved verse{favVerses.length === 1 ? '' : 's'} — tap ⭐ again to remove.
              </p>
              {favVerses.map(v => (
                <div key={v.ref}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--brand-base)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {v.catLabel}
                  </div>
                  <VerseCard
                    verse={v}
                    isFav
                    onToggleFav={toggleFav}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
