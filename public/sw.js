const CACHE_NAME = 'school-survival-clock-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add('./'))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const cachedResponse = caches.match(event.request)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => cachedResponse.then((response) => response || caches.match('./'))),
    )
    return
  }

  event.respondWith(
    cachedResponse.then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          const copy = networkResponse.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return networkResponse
      })
    }),
  )
})
