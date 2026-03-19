// CCG World Service Worker v6 — Full Offline PWA + Push Notifications + Sabbath/Devotional API Cache
const CACHE = 'ccgworld-v6'
const API_CACHE = 'ccgworld-api-v1'

const PRECACHE = [
  '/', '/bible', '/hymnal', '/devotional',
  '/sermons', '/events', '/about', '/contact',
  '/gallery', '/blog', '/live', '/sabbath-school', '/timeline',
  '/notifications',
  '/splash.mp4',
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
      Promise.all(keys.filter(k => k !== CACHE && k !== API_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return

  // Supabase API — cache sabbath_lessons and devotional posts for offline access
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
    const isSabbath    = url.pathname.includes('sabbath_lessons')
    const isDevotional = url.pathname.includes('posts') && url.search.includes('devotional')

    if (isSabbath || isDevotional) {
      e.respondWith((async () => {
        try {
          // Network first — always try to get fresh data
          const res = await fetch(request.clone())
          if (res && res.status === 200) {
            // Only cache if response has content
            const clone = res.clone()
            const text = await clone.text()
            if (text && text.length > 2) {
              const apiCache = await caches.open(API_CACHE)
              // Store with URL as key (includes query params)
              apiCache.put(request.url, new Response(text, {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              }))
            }
          }
          return res
        } catch(_) {
          // Offline — serve from API cache
          const apiCache = await caches.open(API_CACHE)
          const cached = await apiCache.match(request.url)
          if (cached) return cached
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

  // Video files: cache-first with range request support
  if (request.destination === 'video' || url.pathname.endsWith('.mp4')) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(url.pathname)
        if (cached) return cached
        const res = await fetch(request).catch(() => null)
        if (res && res.status === 200) cache.put(url.pathname, res.clone())
        return res
      })
    )
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
