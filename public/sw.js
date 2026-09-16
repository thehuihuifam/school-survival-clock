/* Service worker: offline-first app shell for the survival dashboard.
 *
 * Strategy
 * - Navigations are network-first so a new deploy is picked up on the next
 *   visit, with the cached shell as the offline fallback.
 * - Same-origin hashed assets (JS/CSS/worker) are stale-while-revalidate: they
 *   are immutable (content-addressed filenames), so serving from cache first is
 *   both instant and always correct.
 * - Cross-origin font/CSS requests are cached opportunistically so a teacher
 *   who opened the app once keeps full fidelity on the school's flaky Wi-Fi.
 */

const CACHE_VERSION = 'survival-clock-v5'

/** Everything needed for the first paint, precached on install. */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION)
      // Individual failures (e.g. an icon 404 in a weird environment) must not
      // abort the whole precache.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) {
      return cached
    }
    const shell = await cache.match('./index.html') || await cache.match('./')
    if (shell) {
      return shell
    }
    throw error
  }
}

async function staleWhileRevalidate(request, { allowOpaque = false } = {}) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)

  const refresh = fetch(request)
    .then((response) => {
      if (response && (response.ok || (allowOpaque && response.type === 'opaque'))) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    // Update in the background; never block the user on the network.
    refresh.catch(() => undefined)
    return cached
  }

  const response = await refresh
  if (response) {
    return response
  }

  return Response.error()
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Fonts and icon fonts from CDNs: use the cache, refresh in the background.
  event.respondWith(staleWhileRevalidate(request, { allowOpaque: true }))
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting()
  }
})
