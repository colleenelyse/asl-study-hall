/* asl.cool: serves the site's files, plus small endpoints for the home page, the teachers' share links and the admin page.
   Workers KV (binding LOCKS) holds one key, "state": { lock, vsalt, vhash, mytools, shares, updated }.
   - lock: the home page's tool list, encrypted in the browser (AES-GCM, key from the password with PBKDF2-SHA256).
   - vsalt / vhash: proof check. The browser sends PBKDF2(password, vsalt) (never the password); the Worker compares SHA-256 of it with vhash.
   - mytools: the student list, open to everyone: asl.cool itself and asl.cool/mytools (2026-10-14, Colleen: "i want the students to only need to type asl.cool").
   - shares: [{ code, tools }]: a teacher's list at asl.cool/t/<code> (a random code nobody can guess; Colleen picks the buttons and the teacher's
     name in /admin; the name stays inside the encrypted lock). A code that is not in the list shows "This link is not active".
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
  if (!L || !okStr(L.salt, 100) || !okStr(L.iv, 100) || !okStr(L.data, 150000) || !(L.iter >= 100000) || !okStr(body.vsalt, 100) || !/^[0-9a-f]{64}$/.test(body.vhash || '') || !okTools(body.mytools) || (body.shares !== undefined && !okShares(body.shares)))
    return json({ error: 'Something in the new list was not right.' }, 400);
  const next = { lock: { v: 1, iter: L.iter, salt: L.salt, iv: L.iv, data: L.data }, vsalt: body.vsalt, vhash: body.vhash, mytools: body.mytools, shares: (body.shares || []).map(x => ({ code: x.code, tools: x.tools })), updated: new Date().toISOString() };
  await env.LOCKS.put('state', JSON.stringify(next));
  const log = (await env.LOCKS.get('log', 'json')) || []; log.push([next.updated, ip, body.mytools.length]); await env.LOCKS.put('log', JSON.stringify(log.slice(-50)));
  await env.LOCKS.delete(failKey);
  return json({ ok: true, updated: next.updated });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (p === '/lock.json' || p === '/mytools.json') {
      const st = await state(env, req); if (!st) return json({}, 404);
      return json(p === '/lock.json' ? { lock: st.lock, vsalt: st.vsalt } : { tools: st.mytools || [] });
    }
    if (p === '/share.json') {      // one teacher's list, only with its code
      const st = await state(env, req), c = url.searchParams.get('c') || '', sh = st && (st.shares || []).find(x => x.code === c);
      return sh ? json({ tools: sh.tools }) : json({ error: 'This link is not active.' }, 404);
    }
    if (/^\/t\/[a-z0-9]{8,16}\/?$/.test(p)) return env.ASSETS.fetch(new Request(new URL('/share/', req.url)));      // the share page reads the code from the address
    if (p === '/admin/save') return req.method === 'POST' ? save(req, env) : json({ error: 'POST only' }, 405);
    return env.ASSETS.fetch(req);
  }
};
