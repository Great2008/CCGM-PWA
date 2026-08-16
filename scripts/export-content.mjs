// scripts/export-content.mjs
// Exports "reading content" tables (Sermons, Sabbath School, Devotional,
// Blog, Gallery, Newsletter) to static JSON files in public/data/, so the
// mobile app can fetch a fast, always-available snapshot instead of hitting
// Supabase live on every visit. Interactive/write-heavy content (Events
// RSVPs, Timeline, Prayer) is NOT exported here — that stays on live
// Supabase as-is.
//
// Manually triggered via .github/workflows/sync-content.yml (or run locally
// with SUPABASE_URL / SUPABASE_ANON_KEY env vars set). Uses the same public
// anon key the app itself uses client-side — nothing sensitive here, since
// every table exported is already publicly readable in the live app.

import { createClient } from '@supabase/supabase-js'
import { writeFile, mkdir } from 'node:fs/promises'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_ prefixed) env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const OUT_DIR = new URL('../public/data/', import.meta.url)

// [output filename, table, select, filters as [column, op, value][], order [column, opts]]
const EXPORTS = [
  { file: 'sermons.json',         table: 'sermons',         eq: { published: true },                    order: ['date', { ascending: false }] },
  { file: 'sabbath-lessons.json', table: 'sabbath_lessons',  eq: { published: true },                    order: ['lesson_date', { ascending: false }] },
  { file: 'devotionals.json',     table: 'posts',            eq: { type: 'devotional', published: true }, order: ['date', { ascending: false }] },
  { file: 'blog.json',            table: 'posts',            eq: { published: true },                    order: ['date', { ascending: false }] },
  { file: 'gallery.json',         table: 'gallery',          eq: {},                                     order: ['created_at', { ascending: false }] },
  { file: 'newsletters.json',     table: 'newsletters',      eq: { published: true },                    order: ['published_at', { ascending: false }] },
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const summary = {}

  for (const { file, table, eq, order } of EXPORTS) {
    let query = supabase.from(table).select('*')
    for (const [col, val] of Object.entries(eq)) query = query.eq(col, val)
    query = query.order(order[0], order[1])

    const { data, error } = await query
    if (error) {
      console.error(`Failed to export ${table} -> ${file}:`, error.message)
      process.exit(1)
    }
    await writeFile(new URL(file, OUT_DIR), JSON.stringify(data ?? []))
    summary[file.replace('.json', '')] = (data ?? []).length
    console.log(`Wrote ${file}: ${(data ?? []).length} rows`)
  }

  // Small manifest the app checks first (cheap) before deciding whether to
  // re-download the full content files.
  const manifest = { generatedAt: new Date().toISOString(), counts: summary }
  await writeFile(new URL('manifest.json', OUT_DIR), JSON.stringify(manifest))
  console.log('Wrote manifest.json:', manifest)
}

main().catch(err => { console.error(err); process.exit(1) })
