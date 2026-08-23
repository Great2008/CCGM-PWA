// CCG World Service Worker v15 — Full Offline PWA + Push Notifications + Sabbath/Devotional/Programme/Events/Newsletter API Cache + BG Image Cache + Bundled Bible
const CACHE = 'ccgworld-v15'
const API_CACHE = 'ccgworld-api-v5'
const BG_CACHE = 'ccgworld-bg-v1'  // Hero background images from Unsplash — cache-first, permanent

const PRECACHE = [
  '/', '/bible', '/hymnal', '/devotional',
  '/sermons', '/events', '/about', '/contact',
  '/gallery', '/blog', '/live', '/sabbath-school', '/timeline',
  '/notifications', '/programme', '/meal-ticket', '/newsletter',
  // Precache WebP logos for instant display
  '/logo.webp', '/logo-sm.webp', '/logo-splash.webp',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => null)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== API_CACHE && k !== BG_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return

  // QR code images from api.qrserver.com — cache permanently (QR content never changes)
  if (url.hostname.includes('api.qrserver.com')) {
    e.respondWith((async () => {
      const cache = await caches.open(BG_CACHE)
      const cached = await cache.match(request.url)
      if (cached) return cached
      try {
        const res = await fetch(request.clone())
        if (res && res.status === 200) cache.put(request.url, res.clone())
        return res
      } catch {
        return cached || new Response('', { status: 503 })
      }
    })())
    return
  }

  // Unsplash hero background images — cache-first, permanent
  // After first load the image is served instantly from cache with no network hit.
  // Only updates if the URL changes (which it won't since URLs are hardcoded in JSX).
  if (url.hostname.includes('images.unsplash.com')) {
    e.respondWith((async () => {
      const bgCache = await caches.open(BG_CACHE)
      const cached = await bgCache.match(request.url)
      if (cached) return cached  // Instant — serve from cache
      try {
        const res = await fetch(request.clone())
        if (res && res.status === 200) {
          bgCache.put(request.url, res.clone())
        }
        return res
      } catch {
        // Offline and not cached yet — return empty transparent image
        return new Response('', { status: 200, headers: { 'Content-Type': 'image/webp' } })
      }
    })())
    return
  }

  // Bundled Bible data (public/data/kjv-bible.json) — cache-first, permanent.
  // It's a large (~4-5MB) static file that never changes, so once fetched
  // it's served instantly from cache with zero network hit on every future
  // visit, including fully offline ones. Deliberately NOT in the blocking
  // PRECACHE list (would slow down initial SW install) — this caches it
  // lazily on first actual use instead.
  if (url.pathname === '/data/kjv-bible.json') {
    e.respondWith((async () => {
      const bgCache = await caches.open(BG_CACHE)
      const cached = await bgCache.match(request.url)
      if (cached) return cached
      try {
        const res = await fetch(request.clone())
        if (res && res.status === 200) bgCache.put(request.url, res.clone())
        return res
      } catch {
        return cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      }
    })())
    return
  }

  // Supabase API — permanent offline cache for sabbath_lessons, devotionals, hymns
  // Strategy: cache-first when offline, network-first when online but only
  // replace the cache if the response body actually changed (length check).
  // This means data persists forever offline and only updates when new content exists.
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    const isSabbath    = url.pathname.includes('sabbath_lessons')
    const isDevotional = url.pathname.includes('posts') && url.search.includes('devotional')
    const isHymnal     = url.pathname.includes('hymns')
    const isProgramme  = url.pathname.includes('programme_days') || url.pathname.includes('programme_sessions') ||
                          url.pathname.includes('programme_agenda_items') || url.pathname.includes('programmes') ||
                          url.pathname.includes('programme_rsvps')
    // Cache events + this user's own registrations so meal tickets & RSVP status
    // still work when conference wifi is unreliable.
    const isEvents      = url.pathname.includes('/events') ||
                           url.pathname.includes('event_registrations') ||
                           url.pathname.includes('meal_checkins')
    const isNewsletters = url.pathname.includes('/newsletters')

    if (isSabbath || isDevotional || isHymnal || isProgramme || isEvents || isNewsletters) {
      e.respondWith((async () => {
        const apiCache = await caches.open(API_CACHE)
        const cachedRes = await apiCache.match(request.url)

        try {
          // Always try network when available
          const res = await fetch(request.clone())
          if (res && res.status === 200) {
            const freshText = await res.clone().text()
            if (freshText && freshText.length > 2) {
              // Only overwrite cache if content actually changed
              let shouldUpdate = true
              if (cachedRes) {
                const cachedText = await cachedRes.clone().text()
                shouldUpdate = freshText.length !== cachedText.length || freshText !== cachedText
              }
              if (shouldUpdate) {
                await apiCache.put(request.url, new Response(freshText, {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                }))
              }
            }
          }
          return res
        } catch(_) {
          // Offline — serve permanently cached data
          if (cachedRes) return cachedRes
          return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
      })())
      return
    }
  }

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    return
  }

  // Static assets: cache-first
  if (request.destination === 'script' || request.destination === 'style' ||
      request.destination === 'font' || request.destination === 'image') {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        }).catch(() => null)
      })
    )
    return
  }

  // Navigation: network-first, fall back to cached version of that exact page,
  // then fall back to cached '/' (the app shell) so React Router can handle it
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          // Cache every successfully fetched page
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached ||
            caches.match('/').then(r =>
              r || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } })
            )
          )
        )
    )
    return
  }
})

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() }
  catch { payload = { title: 'CCG World', body: e.data.text() } }

  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    image: payload.image || undefined,
    tag: payload.tag || 'ccgworld-notification',
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    data: { url: payload.url || '/' },
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
  }

  e.waitUntil(
    self.registration.showNotification(payload.title || 'CCG World', options)
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

self.addEventListener('pushsubscriptionchange', e => {
  // Re-subscribe if subscription expires
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: e.oldSubscription?.options?.applicationServerKey
    })
  )
})
