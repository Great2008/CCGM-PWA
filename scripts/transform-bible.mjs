// scripts/transform-bible.mjs
// Fetches the full KJV Bible text from a public source and transforms it into
// the flat { BOOKID: { chapterNum: [{verse,text}, ...] } } structure the app
// expects, writing it to public/data/kjv-bible.json so it ships as a bundled
// static asset instead of being fetched from a third-party CDN at runtime.
//
// Run via `node scripts/transform-bible.mjs` — only ever needs Node's built-in
// fetch (Node 18+), no dependencies to install. Intended to be run by the
// bundle-bible.yml GitHub Actions workflow.

const SOURCE_URL = 'https://cdn.jsdelivr.net/gh/thiagobodruk/bible@master/json/en_kjv.json'
const OUTPUT_PATH = new URL('../public/data/kjv-bible.json', import.meta.url)

// thiagobodruk's book abbreviations -> this app's book IDs (matches the
// mapping that used to live inline in Bible.jsx's loadFullBible function)
const BOOK_MAP = {
  'gn':'GEN','ex':'EXO','lv':'LEV','nm':'NUM','dt':'DEU','js':'JOS','jud':'JDG',
  'rt':'RUT','1sm':'1SA','2sm':'2SA','1kgs':'1KI','2kgs':'2KI','1ch':'1CH',
  '2ch':'2CH','ezr':'EZR','ne':'NEH','et':'EST','job':'JOB','ps':'PSA',
  'prv':'PRO','ec':'ECC','so':'SNG','is':'ISA','jr':'JER','lm':'LAM',
  'ez':'EZK','dn':'DAN','ho':'HOS','jl':'JOL','am':'AMO','ob':'OBA',
  'jn':'JON','mi':'MIC','na':'NAM','hk':'HAB','zp':'ZEP','hg':'HAG',
  'zc':'ZEC','ml':'MAL','mt':'MAT','mk':'MRK','lk':'LUK','jo':'JHN',
  'act':'ACT','rm':'ROM','1co':'1CO','2co':'2CO','gl':'GAL','ep':'EPH',
  'ph':'PHP','cl':'COL','1ts':'1TH','2ts':'2TH','1tm':'1TI','2tm':'2TI',
  'tt':'TIT','phm':'PHM','hb':'HEB','jm':'JAS','1pe':'1PE','2pe':'2PE',
  '1jo':'1JN','2jo':'2JN','3jo':'3JN','jd':'JUD','re':'REV',
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  const raw = await res.json()

  const out = {}
  let bookCount = 0, chapterCount = 0, verseCount = 0

  for (const book of raw) {
    const id = BOOK_MAP[book.abbrev] ?? book.abbrev.toUpperCase()
    out[id] = {}
    book.chapters.forEach((verses, ci) => {
      out[id][ci + 1] = verses.map((text, vi) => ({ verse: vi + 1, text: String(text) }))
      chapterCount++
      verseCount += verses.length
    })
    bookCount++
  }

  const fs = await import('node:fs/promises')
  await fs.mkdir(new URL('.', OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(out))

  console.log(`Wrote ${bookCount} books, ${chapterCount} chapters, ${verseCount} verses to ${OUTPUT_PATH.pathname}`)
}

main().catch(err => { console.error(err); process.exit(1) })
