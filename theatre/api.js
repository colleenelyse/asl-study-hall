/* asl.cool/theatre/api/... : the theatre app's storage (imported by worker.js; not served as a file, see .assetsignore).
   KV (binding LOCKS), keys prefixed theatre: (never the home page's "state").
   - theatre:show  { enc, vsalt, vhash, updated }. enc is the whole show (script lines, lyrics, cast, photos), encrypted in the browser
     with a show key that only the cast password unwraps. The Worker never sees a password or the key.
   - theatre:track:<songId>:<rehearsal|performance>  the track's bytes, encrypted the same way (12-byte iv, then AES-GCM data).
   - theatre:notes  [{ id, at, box }]: notes from students' iPads (a rehearsal conflict), encrypted with the show key on the iPad.
     Anyone may add one (small, a few per address per hour); only the teacher password reads and clears them.
   - theatre:progress:<actor>  one student's practice record (lines right/wrong, song ratings, minutes), encrypted with the show key on the iPad.
     The iPad reads and writes its own (no password: it is sealed, small, and limited per student); the teacher reads all of them with the teacher password.
   Saving needs the teacher password: the browser sends PBKDF2(teacherPw, vsalt) as proof; the Worker compares SHA-256 of it with vhash.
   The first save sets vsalt/vhash, only while none exists (and with the THEATRE_SETUP secret, if one is set). */
/* first-time setup needs Colleen's setup code (given to her privately; only its SHA-256 is here), or the THEATRE_SETUP secret if one is set */
const SETUP_SHA = '34f8cca6a9bd1ccfcf06a776a7dff687337235afa18b37051bea0f3da54b7c6b';
const MAX_FAILS = 5, FAIL_WINDOW = 600, MAX_SHOW = 8e6, MAX_TRACK = 24e6, MAX_NOTES = 300, NOTES_PER_HOUR = 60;      // a school's iPads often share one address
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const okStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
const okEnc = e => e && e.iter >= 100000 && okStr(e.salt, 100) && okStr(e.iv, 100) && okStr(e.data, MAX_SHOW) && e.wrap && okStr(e.wrap.iv, 100) && okStr(e.wrap.data, 200);

/* the teacher's proof; counts wrong guesses per address */
async function proven(env, req, proof, st) {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown', failKey = 'theatre:fail:' + ip;
  const fails = +(await env.LOCKS.get(failKey) || 0);
  if (fails >= MAX_FAILS) return json({ error: 'Too many wrong passwords. Wait 10 minutes and try again.' }, 429);
  let ok = false; try { ok = same(await sha256hex(b64(proof || '')), st.vhash); } catch (e) {}
  if (!ok) { await env.LOCKS.put(failKey, String(fails + 1), { expirationTtl: FAIL_WINDOW }); return json({ error: 'The teacher password is not right.' }, 403); }
  await env.LOCKS.delete(failKey);
  return null;
}

export async function theatreApi(req, env, url, p) {
  if (!env.LOCKS) return json({ error: 'Saving is not set up yet (no KV).' }, 503);
  const rest = p.slice('/theatre/api/'.length);
  if (rest === 'show') {
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (req.method === 'GET') return st ? json({ enc: st.enc, vsalt: st.vsalt, updated: st.updated }) : json({ none: true }, 404);
    if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
    let body; try { const t = await req.text(); if (t.length > MAX_SHOW + 2000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That show is too big or not readable.' }, 400); }
    const newPw = body.newVsalt !== undefined;
    if (newPw && (!okStr(body.newVsalt, 100) || !/^[0-9a-f]{64}$/.test(body.newVhash || ''))) return json({ error: 'The new teacher password was not right.' }, 400);
    if (!okEnc(body.enc)) return json({ error: 'Something in the show was not right.' }, 400);
    if (st && st.vhash) { const bad = await proven(env, req, body.proof, st); if (bad) return bad; }
    else {
      if (!newPw) return json({ error: 'Choose a teacher password first.' }, 400);
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', failKey = 'theatre:fail:' + ip, fails = +(await env.LOCKS.get(failKey) || 0);
      if (fails >= MAX_FAILS) return json({ error: 'Too many wrong codes. Wait 10 minutes and try again.' }, 429);
      const code = String(body.setup || '').trim().toUpperCase();
      const ok = env.THEATRE_SETUP ? same(code, String(env.THEATRE_SETUP).toUpperCase()) : same(await sha256hex(new TextEncoder().encode(code)), SETUP_SHA);
      if (!ok) { await env.LOCKS.put(failKey, String(fails + 1), { expirationTtl: FAIL_WINDOW }); return json({ error: 'The setup code is not right.' }, 403); }
    }
    const e = body.enc, next = { enc: { v: 1, iter: e.iter, salt: e.salt, iv: e.iv, data: e.data, wrap: { iv: e.wrap.iv, data: e.wrap.data } },
      vsalt: newPw ? body.newVsalt : st.vsalt, vhash: newPw ? body.newVhash : st.vhash, updated: new Date().toISOString() };
    await env.LOCKS.put('theatre:show', JSON.stringify(next));
    return json({ ok: true, updated: next.updated });
  }
  if (rest === 'check') {      // is this the teacher password? (Teacher mode asks once per visit)
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    let body; try { body = JSON.parse(await req.text()); } catch (e) { return json({ error: 'That request was not readable.' }, 400); }
    const bad = await proven(env, req, body.proof, st); if (bad) return bad;
    return json({ ok: true });
  }
  if (rest === 'notes') {
    const list = (await env.LOCKS.get('theatre:notes', 'json')) || [];
    if (req.method === 'POST') {      // a student's iPad sends a note (no password: it is encrypted, small, and limited per address)
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:noterate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= NOTES_PER_HOUR) return json({ error: 'Too many notes from this iPad. Try again later, or tell your teacher.' }, 429);
      let body; try { const t = await req.text(); if (t.length > 6000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That note is too long.' }, 400); }
      const b = body.box; if (!b || !okStr(b.iv, 100) || !okStr(b.data, 5000)) return json({ error: 'That note was not readable.' }, 400);
      if (list.length >= MAX_NOTES) return json({ error: 'Your teacher has too many notes waiting. Tell your teacher in person.' }, 507);
      const id = crypto.randomUUID();
      list.push({ id, at: new Date().toISOString(), box: { iv: b.iv, data: b.data } });
      await env.LOCKS.put('theatre:notes', JSON.stringify(list));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true, id });
    }
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    if (req.method === 'GET') return json({ notes: list });
    if (req.method === 'DELETE') {      // the teacher took these notes into the show
      let ids; try { ids = JSON.parse(await req.text()).ids; } catch (e) { ids = null; }
      if (!Array.isArray(ids)) return json({ error: 'Which notes?' }, 400);
      await env.LOCKS.put('theatre:notes', JSON.stringify(list.filter(x => ids.indexOf(x.id) < 0)));
      return json({ ok: true });
    }
    return json({ error: 'GET, POST or DELETE' }, 405);
  }
  if (rest === 'progress') {      // the teacher: everyone's records
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    const out = []; let cursor;
    do {
      const page = await env.LOCKS.list({ prefix: 'theatre:progress:', cursor });
      for (const k of page.keys) { const v = await env.LOCKS.get(k.name, 'json'); if (v) out.push({ actor: k.name.slice('theatre:progress:'.length), box: v.box, at: v.at }); }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && out.length < 200);
    return json({ records: out });
  }
  const pm = rest.match(/^progress\/([a-z0-9]{2,16})$/);
  if (pm) {
    const key = 'theatre:progress:' + pm[1];
    if (req.method === 'GET') { const v = await env.LOCKS.get(key, 'json'); return v ? json(v) : json({ none: true }, 404); }
    if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
    const rk = 'theatre:prograte:' + pm[1], n = +(await env.LOCKS.get(rk) || 0);
    if (n >= 40) return json({ error: 'Saving practice too often. It will try again later.' }, 429);
    let body; try { const t = await req.text(); if (t.length > 120000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That record is too big.' }, 400); }
    const b = body.box; if (!b || !okStr(b.iv, 100) || !okStr(b.data, 115000)) return json({ error: 'That record was not readable.' }, 400);
    await env.LOCKS.put(key, JSON.stringify({ box: { iv: b.iv, data: b.data }, at: new Date().toISOString() }));
    await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 600 });
    return json({ ok: true });
  }
  const m = rest.match(/^track\/([a-z0-9-]{1,24})\/(rehearsal|performance)$/);
  if (m) {
    const key = 'theatre:track:' + m[1] + ':' + m[2];
    if (req.method === 'GET') {
      const v = await env.LOCKS.get(key, 'arrayBuffer');
      return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : json({ none: true }, 404);
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'GET, POST or DELETE' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'Save the show once before adding tracks.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    if (req.method === 'DELETE') { await env.LOCKS.delete(key); return json({ ok: true }); }
    const len = +(req.headers.get('content-length') || 0);
    if (len > MAX_TRACK) return json({ error: 'That track is too big (24 MB at most). Try an MP3.' }, 413);
    const buf = await req.arrayBuffer();
    if (buf.byteLength < 100 || buf.byteLength > MAX_TRACK) return json({ error: 'That track is empty or too big (24 MB at most).' }, 413);
    await env.LOCKS.put(key, buf);
    return json({ ok: true, size: buf.byteLength });
  }
  return json({ error: 'Not found' }, 404);
}
