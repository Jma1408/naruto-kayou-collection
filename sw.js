const V = 'kd-v6', SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'data/sets.json', 'data/heaven-scroll.json', 'data/odds.json', 'icons/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'kd-img').map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.pathname.endsWith('/prices.json')) { // network-first
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put('data/prices.json', c)); return r; })
      .catch(() => caches.match('data/prices.json')));
    return;
  }
  if (e.request.destination === 'image' && u.origin !== location.origin) { // card images: cache-first
    e.respondWith(caches.open('kd-img').then(c => c.match(e.request).then(m => m || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  // app shell : network-first (mises à jour immédiates), cache si hors ligne
  e.respondWith(fetch(e.request).then(r => { if (r.ok && u.origin === location.origin) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
