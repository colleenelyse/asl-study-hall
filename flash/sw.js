/* 2026-11-24 Forehead Flash moved to asl.cool/headsup. A phone that saved the old /flash/ app gets this: it clears the old saved copy and opens the new address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => /^ff-/.test(k) && k !== 'ff-pics').map(k => caches.delete(k))))
  .then(() => self.registration.unregister()).then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.navigate('/headsup/')))); });
