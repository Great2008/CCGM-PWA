/**
 * fetchBibleFallback.js
 * Alternative source — uses api.bible (bolls.life, no key needed)
 * Try this if the primary script fails.
 * Usage: node scripts/fetchBibleFallback.js
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// bolls.life free public API - full KJV
const URL = 'https://bolls.life/static/translations/KJV.json'

console.log('📖 Downloading KJV from bolls.life...')
try {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json()

  // Format: [{book:1, chapter:1, verse:1, text:"..."}, ...]
  // Book number map
  const BOOK_MAP = {
    1:'GEN',2:'EXO',3:'LEV',4:'NUM',5:'DEU',6:'JOS',7:'JDG',8:'RUT',
    9:'1SA',10:'2SA',11:'1KI',12:'2KI',13:'1CH',14:'2CH',15:'EZR',
    16:'NEH',17:'EST',18:'JOB',19:'PSA',20:'PRO',21:'ECC',22:'SNG',
    23:'ISA',24:'JER',25:'LAM',26:'EZK',27:'DAN',28:'HOS',29:'JOL',
    30:'AMO',31:'OBA',32:'JON',33:'MIC',34:'NAM',35:'HAB',36:'ZEP',
    37:'HAG',38:'ZEC',39:'MAL',40:'MAT',41:'MRK',42:'LUK',43:'JHN',
    44:'ACT',45:'ROM',46:'1CO',47:'2CO',48:'GAL',49:'EPH',50:'PHP',
    51:'COL',52:'1TH',53:'2TH',54:'1TI',55:'2TI',56:'TIT',57:'PHM',
    58:'HEB',59:'JAS',60:'1PE',61:'2PE',62:'1JN',63:'2JN',64:'3JN',
    65:'JUD',66:'REV'
  }

  const bible = {}
  for (const v of raw) {
    const bookKey = BOOK_MAP[v.book]
    if (!bookKey) continue
    if (!bible[bookKey]) bible[bookKey] = []
    const chIdx = v.chapter - 1
    if (!bible[bookKey][chIdx]) bible[bookKey][chIdx] = []
    bible[bookKey][chIdx][v.verse - 1] = v.text
  }

  const outDir = join(__dir, '../src/data')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'kjvFull.json'), JSON.stringify(bible))
  const kb = Math.round(JSON.stringify(bible).length / 1024)
  console.log(`✅ Saved kjvFull.json — ${Object.keys(bible).length} books, ${kb} KB`)
} catch (e) {
  console.error('❌ Failed:', e.message)
  process.exit(1)
}
