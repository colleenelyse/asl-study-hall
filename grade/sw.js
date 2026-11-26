/* Grade Calculator home-screen app (2026-11-25, Colleen: "add this as an app option that adds nicely to a home screen on asl.cool/apps").
   The page: the network first (so every change shows up right away), the saved copy only when there is no Wi-Fi. Icons: saved copy first.
   Sign-in and saving go to script.google.com and are never touched here. Change VER to replace everything. */
const VER = 'gc-1', SHELL = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gc-') && k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/grade/')) return;
  if (e.request.mode === 'navigate' || /\/grade\/(index\.html)?$/.test(u.pathname)) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VER).then(x => x.put('./', c)); } return r; }).catch(() => caches.match('./'))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
