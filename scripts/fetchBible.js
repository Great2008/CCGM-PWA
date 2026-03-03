/**
 * fetchBible.js — Run ONCE to download + bundle the full KJV
 * Usage: node scripts/fetchBible.js
 * Then commit src/data/kjvFull.json to your repo.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'

const ABBREV_MAP = {
  'gn':'GEN','ex':'EXO','lv':'LEV','nm':'NUM','dt':'DEU','js':'JOS','jud':'JDG',
  'rt':'RUT','1sm':'1SA','2sm':'2SA','1kgs':'1KI','2kgs':'2KI','1ch':'1CH',
  '2ch':'2CH','ez':'EZR','ne':'NEH','et':'EST','job':'JOB','ps':'PSA',
  'prv':'PRO','ec':'ECC','so':'SNG','is':'ISA','jr':'JER','lm':'LAM',
  'ezk':'EZK','dn':'DAN','ho':'HOS','jl':'JOL','am':'AMO','ob':'OBA',
  'jn':'JON','mi':'MIC','na':'NAM','hk':'HAB','zp':'ZEP','hg':'HAG',
  'zc':'ZEC','ml':'MAL','mt':'MAT','mk':'MRK','lk':'LUK','jo':'JHN',
  'act':'ACT','rm':'ROM','1co':'1CO','2co':'2CO','gl':'GAL','ep':'EPH',
  'ph':'PHP','cl':'COL','1ts':'1TH','2ts':'2TH','1tm':'1TI','2tm':'2TI',
  'tt':'TIT','phm':'PHM','hb':'HEB','jm':'JAS','1pe':'1PE','2pe':'2PE',
  '1jo':'1JN','2jo':'2JN','3jo':'3JN','jd':'JUD','rv':'REV'
}

console.log('📖 Downloading full KJV Bible from public domain source...')
try {
  const res = await fetch(KJV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json()

  const bible = {}
  for (const book of raw) {
    const key = ABBREV_MAP[book.abbrev] ?? book.abbrev.toUpperCase()
    bible[key] = book.chapters
  }

  const outDir = join(__dir, '../src/data')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'kjvFull.json')
  writeFileSync(outPath, JSON.stringify(bible))

  const sizeKB = Math.round(JSON.stringify(bible).length / 1024)
  const books = Object.keys(bible).length
  console.log(`✅ Saved to src/data/kjvFull.json`)
  console.log(`   ${books} books · ${sizeKB} KB`)
} catch (e) {
  console.error('❌ Error:', e.message)
  process.exit(1)
}
