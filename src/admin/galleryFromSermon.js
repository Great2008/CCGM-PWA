// src/admin/galleryFromSermon.js
// Every sermon thumbnail is also added to the Gallery (once per image, matched by URL).
// `db` is the Supabase client. Never throws: returns { status, message? } where status is
// 'added' | 'exists' | 'none' (no usable thumbnail) | 'error'.
export async function addSermonThumbnailToGallery(db, sermon) {
  const url = String(sermon?.thumbnail || '').trim()
  if (!/^https?:\/\//i.test(url)) return { status: 'none' }

  const { data: found, error: findErr } = await db.from('gallery').select('id').eq('url', url).limit(1)
  if (findErr) return { status: 'error', message: findErr.message }
  if (found && found.length) return { status: 'exists' }

  const title = String(sermon.title || 'Sermon').trim()
  const caption = ['Sermon', sermon.preacher ? `by ${sermon.preacher}` : '', sermon.series ? `· ${sermon.series}` : '']
    .filter(Boolean).join(' ')
  const { error } = await db.from('gallery').insert({
    url, title, caption, category: 'Sermons',
    date: sermon.date || new Date().toISOString().split('T')[0],
  })
  return error ? { status: 'error', message: error.message } : { status: 'added' }
}
