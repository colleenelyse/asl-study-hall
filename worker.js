/* asl.cool: serves the site's files, plus small endpoints for the home page, the teachers' share links and the admin page.
   Workers KV (binding LOCKS) holds one key, "state": { lock, vsalt, vhash, mytools, shares, updated }.
   - lock: the home page's tool list, encrypted in the browser (AES-GCM, key from the password with PBKDF2-SHA256).
   - vsalt / vhash: proof check. The browser sends PBKDF2(password, vsalt) (never the password); the Worker compares SHA-256 of it with vhash.
   - slocks: student lists, each encrypted with its own CLASS password (2026-10-14, Colleen: "a class password and my admin password. allow for multiple class passwords.
     one box should accept both and know the difference"). The home page's one password box tries her lock, then each class lock.
   - mytools: the old open student list; empty once a class password is set (then nothing about the buttons is public).
   - shares: [{ code, tools }]: a teacher's list at asl.cool/t/<code> (a random code nobody can guess; Colleen picks the buttons and the teacher's
     name in /admin; the name stays inside the encrypted lock). A code that is not in the list shows "This link is not active".
   - products: the aslstudyhall.com storefront's product cards [{ title, price, img, link, desc, tag }] (2026-10-14, Colleen: "a storefront type site ... images that link to a shopify account"); public.
   aslstudyhall.com: its home page is store/ (the storefront); www. goes to the bare address. Every other path is the same site as asl.cool.
   Until KV has a state, lock-seed.json (written by dev/home-lock/lock-home.js on Colleen's Mac) is used. */
const MAX_FAILS = 5, FAIL_WINDOW = 600;      // 5 wrong passwords per 10 minutes per address
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function state(env, req) {
  const s = env.LOCKS ? await env.LOCKS.get('state', 'json') : null;
  if (s) return s;
  const r = await env.ASSETS.fetch(new Request(new URL('/lock-seed.json', req.url)));
  return r.ok ? r.json() : null;
}
const okStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
function okTools(list) {
  return Array.isArray(list) && list.length <= 60 && list.every(t => t && okStr(t.title, 120) && (t.desc === undefined || (typeof t.desc === 'string' && t.desc.length <= 400)) &&
    (t.icon === undefined || (typeof t.icon === 'string' && t.icon.length <= 16)) && okStr(t.href, 300) && !/^\s*javascript:/i.test(t.href) && (t.alt === undefined || (typeof t.alt === 'string' && t.alt.length <= 200)));
}
const okUrl = u => typeof u === 'string' && u.length <= 500 && (/^https:\/\//.test(u) || /^[\w./-]+$/.test(u));
function okProducts(list) { return Array.isArray(list) && list.length <= 60 && list.every(x => x && okStr(x.title, 120) && okUrl(x.link) && (!x.img || okUrl(x.img)) && (x.price === undefined || (typeof x.price === 'string' && x.price.length <= 30)) && (x.desc === undefined || (typeof x.desc === 'string' && x.desc.length <= 300)) && (x.tag === undefined || (typeof x.tag === 'string' && x.tag.length <= 40))); }
function okShares(list) { return Array.isArray(list) && list.length <= 40 && list.every(x => x && /^[a-z0-9]{8,16}$/.test(x.code || '') && okTools(x.tools)); }
async function save(req, env) {
  if (!env.LOCKS) return json({ error: 'Saving is not set up yet (no KV).' }, 503);
  const ip = req.headers.get('cf-connecting-ip') || 'unknown', failKey = 'fail:' + ip;
  const fails = +(await env.LOCKS.get(failKey) || 0);
  if (fails >= MAX_FAILS) return json({ error: 'Too many wrong passwords. Wait 10 minutes and try again.' }, 429);
  let body; try { const t = await req.text(); if (t.length > 200000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That request was not readable.' }, 400); }
  const st = await state(env, req);
  if (!st || !st.vhash) return json({ error: 'The lock is not set up yet.' }, 503);
  let proofOk = false; try { proofOk = same(await sha256hex(b64(body.proof || '')), st.vhash); } catch (e) {}
  if (!proofOk) { await env.LOCKS.put(failKey, String(fails + 1), { expirationTtl: FAIL_WINDOW }); return json({ error: 'The current password is not right.' }, 403); }
  const L = body.lock;
  if (!L || !okStr(L.salt, 100) || !okStr(L.iv, 100) || !okStr(L.data, 150000) || !(L.iter >= 100000) || !okStr(body.vsalt, 100) || !/^[0-9a-f]{64}$/.test(body.vhash || '') || !okTools(body.mytools) || (body.shares !== undefined && !okShares(body.shares)) || (body.products !== undefined && !okProducts(body.products)))
    return json({ error: 'Something in the new list was not right.' }, 400);
  const SL = Array.isArray(body.slocks) ? body.slocks : [], okLock = x => x && okStr(x.salt, 100) && okStr(x.iv, 100) && okStr(x.data, 150000) && x.iter >= 100000;
  if (SL.length > 30 || !SL.every(okLock)) return json({ error: 'Something in the class passwords was not right.' }, 400);
  const slocks = SL.map(x => ({ v: 1, iter: x.iter, salt: x.salt, iv: x.iv, data: x.data }));
  const next = { lock: { v: 1, iter: L.iter, salt: L.salt, iv: L.iv, data: L.data }, slocks, products: body.products !== undefined ? body.products.map(x => ({ title: x.title, link: x.link, img: x.img || '', price: x.price || '', desc: x.desc || '', tag: x.tag || '' })) : (st.products || []), vsalt: body.vsalt, vhash: body.vhash, mytools: slocks.length ? [] : body.mytools, shares: (body.shares || []).map(x => ({ code: x.code, tools: x.tools, shop: !!x.shop })), shopOn: body.shopOn !== undefined ? !!body.shopOn : !!st.shopOn, updated: new Date().toISOString() };
  await env.LOCKS.put('state', JSON.stringify(next));
  const log = (await env.LOCKS.get('log', 'json')) || []; log.push([next.updated, ip, body.mytools.length]); await env.LOCKS.put('log', JSON.stringify(log.slice(-50)));
  await env.LOCKS.delete(failKey);
  return json({ ok: true, updated: next.updated });
}
/* every product in her Shopify store, from its public products.json (cached 10 minutes by Cloudflare) */
async function shopProducts() {
  try {
    const r = await fetch('https://aslstudyhall.com/products.json?limit=50', { headers: { accept: 'application/json' }, cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.products || []).map(x => { const v = (x.variants || [])[0] || {}, img = (x.images || [])[0];
      return { title: x.title || '', price: v.price ? '$' + (+v.price).toFixed(2) : '', img: img && img.src ? img.src : '', desc: strip(x.body_html).slice(0, 160), link: 'https://aslstudyhall.com/products/' + x.handle, tag: '' }; });
  } catch (e) { return []; }
}
/* /lookup?u=<listing link>: the name, price, picture and description of one of Colleen's listings (Shopify: the product's .js data; TpT: the page's share tags).
   Only her shop and TpT, so this is not an open proxy. */
const strip = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
async function lookup(u) {
  let x; try { x = new URL(u); } catch (e) { return json({ error: 'That is not a link.' }, 400); }
  const h = x.hostname.toLowerCase(), shop = h === 'aslstudyhall.com' || h === 'www.aslstudyhall.com' || h.endsWith('.myshopify.com'), tpt = h === 'www.teacherspayteachers.com' || h === 'teacherspayteachers.com';
  if (x.protocol !== 'https:' || !(shop || tpt)) return json({ error: 'Paste a link to a product on aslstudyhall.com or Teachers Pay Teachers.' }, 400);
  try {
    if (shop) {
      const m = x.pathname.match(/\/products\/([^/?#]+)/); if (!m) return json({ error: 'That is not a product page (it needs /products/ in the link).' }, 400);
      const r = await fetch('https://' + h + '/products/' + m[1] + '.js', { headers: { accept: 'application/json' } });
      if (!r.ok) return json({ error: 'Shopify did not share that product. If your store still has a password, remove it first (Online Store > Preferences).' }, 502);
      const d = await r.json(), img = d.featured_image || (d.images || [])[0] || '';
      return json({ title: d.title || '', price: d.price ? '$' + (d.price / 100).toFixed(2) : '', img: img ? (img.startsWith('//') ? 'https:' + img : img) : '', desc: strip(d.description).slice(0, 220), link: 'https://aslstudyhall.com/products/' + m[1], tag: '' });
    }
    const r = await fetch(x.toString(), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; ASLStudyHall/1.0)', accept: 'text/html' } });
    const t = await r.text(), meta = k => ((t.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]+content=["\']([^"\']*)', 'i')) || [])[1] || '');
    const title = strip(meta('og:title')), img = meta('og:image'), price = meta('product:price:amount');
    if (!title) return json({ error: 'TpT did not share that listing. Fill in the name and picture by hand.' }, 502);
    return json({ title: title.replace(/\s*\|\s*Teachers Pay Teachers\s*$/i, ''), price: price ? '$' + (+price).toFixed(2) : '', img, desc: strip(meta('og:description')).slice(0, 220), link: x.toString(), tag: 'On TpT' });
  } catch (e) { return json({ error: 'Could not read that listing. Try again, or fill it in by hand.' }, 502); }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    const host = url.hostname.toLowerCase();
    if (host === 'www.aslstudyhall.com') return Response.redirect('https://aslstudyhall.com' + p + url.search, 301);
    if (host === 'aslstudyhall.com' && (p === '/' || p === '/index.html')) return env.ASSETS.fetch(new Request(new URL('/store/', req.url)));      // the storefront
    if (p === '/lookup') return lookup(url.searchParams.get('u') || '');      // admin > Featured Products: fill a card from a Shopify or TpT listing link
    if (p === '/products.json') {      // featured products: Colleen's picks in admin, or else every product in her Shopify store (Colleen: "i'll feature all of them")
      const st = await state(env, req), picked = (st && st.products) || [];
      if (picked.length) return json({ products: picked, source: 'admin' });
      return json({ products: await shopProducts(), source: 'shopify' });
    }
    if (p === '/lock.json' || p === '/mytools.json') {
      const st = await state(env, req); if (!st) return json({}, 404);
      return json(p === '/lock.json' ? { lock: st.lock, slocks: st.slocks || [], vsalt: st.vsalt, shopOn: !!st.shopOn } : { tools: (st.slocks || []).length ? [] : (st.mytools || []) });      // with class passwords the student lists are only in slocks
    }
    if (p === '/share.json') {      // one teacher's list, only with its code
      const st = await state(env, req), c = url.searchParams.get('c') || '', sh = st && (st.shares || []).find(x => x.code === c);
      return sh ? json({ tools: sh.tools, shop: !!sh.shop }) : json({ error: 'This link is not active.' }, 404);      // shop: show Colleen's shop links and products (teachers yes, students no)
    }
    if (/^\/t\/[a-z0-9]{8,16}\/?$/.test(p)) return env.ASSETS.fetch(new Request(new URL('/share/', req.url)));      // the share page reads the code from the address
    if (p === '/admin/save') return req.method === 'POST' ? save(req, env) : json({ error: 'POST only' }, 405);
    const res = await env.ASSETS.fetch(req);
    return shopSwitch(req, env, res, p);
  }
};
/* Admin > Show the shop to everyone (Colleen: "a show/hide toggle that's universal on the admin page"). The pages ship with the shop hidden;
   when the switch is on, the Worker takes the hide rule out as it serves them. Never in the TpT copies (fs-tpt, num-tpt). */
async function shopSwitch(req, env, res, p) {
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200 || /^\/(fs|num)-tpt\//.test(p) || !/text\/(html|css)/.test(type)) return res;
  const st = await state(env, req); if (!st || !st.shopOn) return res;
  const body = (await res.text()).replace('[data-shop]{display:none!important}', '[data-shop-off]{display:none!important}').replace('.top nav a.tptlink, .shopcard { display: none !important; }', '.shop-hide-off { display: none !important; }');
  const h = new Headers(res.headers); h.delete('content-length'); h.delete('etag'); h.set('cache-control', 'no-cache');
  return new Response(body, { status: 200, headers: h });
}
