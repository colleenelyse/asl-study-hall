/* Who Do You Think You Are? (was Forehead Flash, 2026-11-23): makes the Home Screen app open fast and keep working if the Wi-Fi drops.
   The page and icons: saved copy first, refreshed in the background. Her decks (decks.json): the network first, the saved copy if offline.
   Pictures: saved the first time they load, so a deck played once works offline. Change VER to replace everything. */
const VER = 'ff-18', SHELL = ['./', 'index.html', 'starter.json', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k !== 'ff-pics2').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET') return;
  if (u.origin === location.origin && /\/whoami\/decks\.json$/.test(u.pathname)) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VER).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); return; }
  /* pictures through asl.cool/whoami/img?u=...: saved by their FULL address. (Until 2026-11-24 the line below matched them ignoring the ?u= part, so every pasted
     picture after the first came back as that first picture: Colleen saw Pippi Longstocking on every card.) */
  if (u.origin === location.origin && u.pathname === '/whoami/img') {
    e.respondWith(caches.open('ff-pics2').then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })))); return; }
  if (u.origin === location.origin && u.pathname.startsWith('/whoami/')) {
    e.respondWith(caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(hit => { const net = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VER).then(x => x.put(e.request, c)); } return r; }).catch(() => hit); return hit || net; })); return; }
  if (/(^|\.)wikimedia\.org$/.test(u.hostname) && e.request.destination === 'image') {
    e.respondWith(caches.open('ff-pics2').then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })))); }
});
