/* Offline copy for ASL Numberwise (dev/build-phone-apps.py). Online: always the newest files (network first, 4 s).
   Offline or slow: the saved copy. Nothing is sent anywhere; progress lives in the page's own storage. */
var CACHE = 'numberwise-675ade47', CORE = ["app.js", "defs.js", "fonts/asl.ttf", "hand.js", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "ily-180-o.png", "ily-180.png", "ily-o.png", "ily.png", "index.html", "lib/GLTFLoader.js", "lib/RoomEnvironment.js", "lib/confetti.browser.min.js", "lib/html2canvas.min.js", "lib/qrcode.min.js", "lib/right.glb", "lib/three.min.js", "lib/xlsx.full.min.js", "link.js", "logo-180.png", "logo-32.png", "logo-64.png", "look.js", "manifest.json", "people.js", "privacy.html", "reader.html", "reader.js", "samples.js", "shell.css", "shell.js", "style.css", "themes.js", "words.js", "wordsamp.js"];
/* asl.cool sends reader.html on to /reader; Safari refuses a redirected answer for a page, so a fresh copy is kept instead */
function clean(r) { return r.redirected ? r.blob().then(function (b) { return new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }); }) : Promise.resolve(r); }
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(CORE.map(function (u) { return fetch(u, { cache: 'reload' }).then(function (r) { if (r.ok) return clean(r).then(function (x) { return c.put(u, x); }); }).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('numberwise-') === 0 && k !== CACHE; }).map(function (k) {
    return caches.open(k).then(function (old) { return old.keys().then(function (reqs) { return Promise.all(reqs.filter(function (r) { return /mediapipe/.test(r.url); }).map(function (r) { return old.match(r).then(function (res) { return res && caches.open(CACHE).then(function (c) { return c.put(r, res); }); }); })); }); }).then(function () { return caches.delete(k); });      /* the hand reader moves to the new version's cache instead of downloading again */
  })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url), mine = url.origin === location.origin && url.pathname.indexOf(new URL('./', location).pathname) === 0;
  var fonts = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  /* files that never change once published (the libraries in lib/, Google's hand reader at its version number): kept after the first download,
     so the camera starts quickly the next time (2026-11-12, Colleen: "it takes a long time for the camera to load") */
  var fixed = (mine && /\/lib\//.test(url.pathname)) || (url.hostname === 'cdn.jsdelivr.net' && /\/@mediapipe\/tasks-vision@[\d.]+\//.test(url.pathname)) || (url.hostname === 'storage.googleapis.com' && url.pathname.indexOf('/mediapipe-models/') === 0);
  if (fixed) { e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; }); })); return; }
  if (!mine && !fonts) return;
  e.respondWith(new Promise(function (done) {
    var settled = false, fromCache = function () { return caches.match(req, { ignoreSearch: !fonts }).then(function (r) { if (r || req.mode !== 'navigate') return r; return caches.match(/reader/.test(url.pathname) ? 'reader.html' : 'index.html'); }); };
    var t = setTimeout(function () { fromCache().then(function (r) { if (r && !settled) { settled = true; done(r); } }); }, 4000);
    fetch(req).then(function (r) {
      if (r && (r.ok || r.type === 'opaque')) { var copy = r.clone(); clean(copy).then(function (x) { return caches.open(CACHE).then(function (c) { return c.put(req, x); }); }).catch(function () {}); }
      clearTimeout(t); if (!settled) { settled = true; done(r); }
    }).catch(function () { clearTimeout(t); fromCache().then(function (r) { if (!settled) { settled = true; done(r || Response.error()); } }); });
  }));
});
