/* asl.cool/theatre offline helper: the app's own files come from the network when there is one (so updates show at once) and from this
   device's copy when there is not. The show itself is already kept on the device (IndexedDB); /theatre/api/ is never cached here. */
var CACHE = 'theatre-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.indexOf('/theatre/api/') === 0 || u.pathname.indexOf('/__private/') === 0) return;
  if (u.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match('/theatre/'); }); }));
});
