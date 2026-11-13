/* Offline copy for ASL NumberWise (dev/build-phone-apps.py). Online: always the newest files (network first, 4 s).
   Offline or slow: the saved copy. Nothing is sent anywhere; progress lives in the page's own storage. */
var CACHE = 'numberwise-c5fe8119', CORE = ["app.js", "defs.js", "fonts/asl.ttf", "hand.js", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "ily-180-o.png", "ily-180.png", "ily-o.png", "ily.png", "index.html", "lib/GLTFLoader.js", "lib/RoomEnvironment.js", "lib/confetti.browser.min.js", "lib/html2canvas.min.js", "lib/qrcode.min.js", "lib/right.glb", "lib/three.min.js", "lib/xlsx.full.min.js", "link.js", "logo-180.png", "logo-32.png", "logo-64.png", "look.js", "manifest.json", "people.js", "privacy.html", "reader.html", "reader.js", "samples.js", "shell.css", "shell.js", "style.css", "themes.js", "words.js", "wordsamp.js"];
/* asl.cool sends reader.html on to /reader; Safari refuses a redirected answer for a page, so a fresh copy is kept instead */
function clean(r) { return r.redirected ? r.blob().then(function (b) { return new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers }); }) : Promise.resolve(r); }
/* a page that was never saved and no internet: a friendly screen instead of the browser's error (2026-11-12) */
function offline() { return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASL NumberWise</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B2A4E;color:#fff;font:600 18px/1.5 system-ui,sans-serif;text-align:center;padding:24px"><div><p style="font-size:48px;margin:0">📶</p><h1 style="margin:8px 0">No internet right now</h1><p>This page needs a connection the first time. Your saved practice still works: go back to the games.</p><p><a href="./#/games" style="display:inline-block;background:#5DB6F2;color:#0B2A4E;padding:12px 22px;border-radius:999px;font-weight:800;text-decoration:none">Back to the games</a></p></div></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
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
    }).catch(function () { clearTimeout(t); fromCache().then(function (r) { if (!settled) { settled = true; done(r || (req.mode === 'navigate' ? offline() : Response.error())); } }); });
  }));
});
