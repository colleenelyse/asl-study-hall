/* asl.cool/theatre/api/... : the theatre app's storage (imported by worker.js; not served as a file, see .assetsignore).
   KV (binding LOCKS), keys prefixed theatre: (never the home page's "state").
   - theatre:show  { enc, vsalt, vhash, updated }. enc is the whole show (script lines, lyrics, cast, photos), encrypted in the browser
     with a show key that only the cast password unwraps. The Worker never sees a password or the key.
   - theatre:track:<songId>:<rehearsal|performance>  the track's bytes, encrypted the same way (12-byte iv, then AES-GCM data).
   - theatre:notes  [{ id, at, box }]: notes from students' iPads (a rehearsal conflict), encrypted with the show key on the iPad.
     Anyone may add one (small, a few per address per hour); only the teacher password reads and clears them.
   - theatre:pdf  the teacher's script PDF (for the script view that looks like the real pages), encrypted the same way as a track.
   - theatre:voice:<line>:<tts|rec>  a line's audio, sealed: tts = made with ElevenLabs by the teacher, rec = a student's recording the teacher approved.
     theatre:pending:<line>:<actor>  a student's recording waiting for the teacher's OK; theatre:pendinglist  [{ h, actor, at }].
     Students may add recordings (sealed, small, limited per address). Colleen (2026-10-21): as students record their own lines, everyone hears them,
     so recordings go live at once unless the teacher turns on checking first (theatre:autorec = '0'); every new one is on the teacher's list to remove.
     theatre:voiceindex  { line: { tts: at, rec: { at, actor } } }: which lines have audio, read by every iPad (line ids are hashes; nothing readable).
   - theatre:progress:<actor>  one student's practice record (lines right/wrong, song ratings, minutes), encrypted with the show key on the iPad.
     The iPad reads and writes its own (no password: it is sealed, small, and limited per student); the teacher reads all of them with the teacher password.
   - theatre:photo:<id>  a photo of a finished costume or prop (Colleen 2026-10-24: students photograph what they bought after the shopping trip, as a reference
     for the costume crew, performers and Mentors), sealed with the show key on the iPad (the photo and its caption). theatre:photoindex [{ id, actor, char, kind,
     ref, at, ok }]: ids only (actor ids are random; char and ref are the show outline's ids), nothing readable. Anyone may add one (sealed, small, limited per
     address); it waits for the teacher's OK (ok false) before other iPads show it. Only the teacher password approves or removes.
     kind research: a student's costume research picture (ref = the character), board: the teacher's choice board of outfit pictures for a character.
   - theatre:google  { clientId, gated: [pass ids] } (Colleen 2026-10-24: "require parents to sign in with a google account and use that email for
     communication"). A password listed in gated (a parent password) is left out of GET show; its key wrap is given only by POST gpass with a Google
     ID token this Worker checks (Google's signature, this app's Client ID, not expired, a verified email). Nothing from the token is kept.
   - theatre:board:<id>  [{ id, at, box }]: a group's messages (the Company dinner plan: who brings what, and the families' chat), sealed with the
     show key on the device. Anyone may add one (sealed, small, limited per address; 300 per board); everyone with the app reads them; only the
     teacher password removes them (Colleen 2026-10-24: families splitting the cost of a Company dinner talk to one another in the app).
   - theatre:crewform / theatre:crewin  the Tech Week Crew questionnaire (no password): its questions and the teacher's public key, and the answers
     sealed with that key (see crew/form below).
   Saving needs the teacher password: the browser sends PBKDF2(teacherPw, vsalt) as proof; the Worker compares SHA-256 of it with vhash.
   The first save sets vsalt/vhash, only while none exists (and with the THEATRE_SETUP secret, if one is set). */
/* first-time setup needs Colleen's setup code (given to her privately; only its SHA-256 is here), or the THEATRE_SETUP secret if one is set */
const SETUP_SHA = '34f8cca6a9bd1ccfcf06a776a7dff687337235afa18b37051bea0f3da54b7c6b';
const MAX_REC = 800000;
const MAX_PHOTO = 900000, MAX_PHOTOS = 800;      // a photo is made smaller on the iPad first (about 1280 px)      // a recorded line: about 30 seconds at most
const MAX_FAILS = 5, FAIL_WINDOW = 600, MAX_SHOW = 8e6, MAX_TRACK = 24e6, MAX_NOTES = 300, NOTES_PER_HOUR = 60;      // a school's iPads often share one address
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256hex(bytes) { const d = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const okStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
const okWrap = w => w && okStr(w.iv, 100) && okStr(w.data, 200);
/* more: other passwords that open the show (parents, peer helpers), each wrapping the same show key (Colleen 2026-10-23) */
const okMore = m => m === undefined || (Array.isArray(m) && m.length <= 30 && m.every(x => x && okStr(x.id, 40) && x.iter >= 100000 && okStr(x.salt, 100) && okWrap(x.wrap)));
const okEnc = e => e && e.iter >= 100000 && okStr(e.salt, 100) && okStr(e.iv, 100) && okStr(e.data, MAX_SHOW) && okWrap(e.wrap) && okMore(e.more);

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

/* Google sign-in for parents: the ID token checked against Google's public keys (cached an hour) */
let gCerts = null, gCertsAt = 0;
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function googleClaims(token, clientId, env) {
  if (env.THEATRE_DEV_GOOGLE && /^dev:[^@\s]+@[^@\s]+$/.test(token)) return { email: token.slice(4), email_verified: true };      // the local test server only
  const parts = String(token).split('.'); if (parts.length !== 3) return null;
  const head = JSON.parse(new TextDecoder().decode(unb64url(parts[0]))), claims = JSON.parse(new TextDecoder().decode(unb64url(parts[1])));
  if (head.alg !== 'RS256') return null;
  if (!gCerts || Date.now() - gCertsAt > 36e5 || !gCerts.keys.some(k => k.kid === head.kid)) { gCerts = await (await fetch('https:' + '//www.googleapis.com/oauth2/v3/certs')).json(); gCertsAt = Date.now(); }
  const jwk = (gCerts.keys || []).find(k => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const good = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!good || claims.aud !== clientId || ['accounts.google.com', 'https://accounts.google.com'].indexOf(claims.iss) < 0 || !(claims.exp * 1000 > Date.now()) || claims.email_verified !== true || !claims.email) return null;
  return claims;
}
export async function theatreApi(req, env, url, p) {
  if (!env.LOCKS) return json({ error: 'Saving is not set up yet (no KV).' }, 503);
  const rest = p.slice('/theatre/api/'.length);
  if (rest === 'show') {
    const st = await env.LOCKS.get('theatre:show', 'json');
    const gated = ((await env.LOCKS.get('theatre:google', 'json')) || {}).gated || [];
    if (req.method === 'GET') {
      if (!st) return json({ none: true }, 404);
      const more = (st.enc.more || []).filter(m => gated.indexOf(m.id) < 0), e = Object.assign({}, st.enc); if (st.enc.more) e.more = more;      // parent passwords that need Google sign-in: only through gpass
      return json({ enc: e, vsalt: st.vsalt, updated: st.updated, gated: gated.length > 0 });
    }
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
    const e = body.enc, next = { enc: { v: 1, iter: e.iter, salt: e.salt, iv: e.iv, data: e.data, wrap: { iv: e.wrap.iv, data: e.wrap.data },
      more: (e.more || []).map(x => ({ id: x.id, iter: x.iter, salt: x.salt, wrap: { iv: x.wrap.iv, data: x.wrap.data } })) },
      vsalt: newPw ? body.newVsalt : st.vsalt, vhash: newPw ? body.newVhash : st.vhash, updated: new Date().toISOString() };
    // the teacher's copy has no gated wraps (GET leaves them out): keep the stored ones unless this save replaces or drops them
    const drop = Array.isArray(body.drop) ? body.drop : [];
    if (st && st.enc && st.enc.more) st.enc.more.forEach(m => { if (gated.indexOf(m.id) >= 0 && drop.indexOf(m.id) < 0 && !next.enc.more.some(x => x.id === m.id)) next.enc.more.push(m); });
    if (next.enc.more.length > 30) return json({ error: 'Too many passwords.' }, 400);
    await env.LOCKS.put('theatre:show', JSON.stringify(next));
    if (drop.some(id => gated.indexOf(id) >= 0)) { const g = (await env.LOCKS.get('theatre:google', 'json')) || {}; g.gated = (g.gated || []).filter(id => drop.indexOf(id) < 0); await env.LOCKS.put('theatre:google', JSON.stringify(g)); }
    return json({ ok: true, updated: next.updated });
  }
  if (rest === 'google') {      // the Client ID (public) and which passwords need Google sign-in; the teacher sets them
    const g = (await env.LOCKS.get('theatre:google', 'json')) || {};
    if (req.method === 'GET') return json({ clientId: g.clientId || '', gated: (g.gated || []).length > 0 });
    if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    let body; try { body = JSON.parse(await req.text()); } catch (e) { return json({ error: 'That request was not readable.' }, 400); }
    const bad = await proven(env, req, body.proof, st); if (bad) return bad;
    if (body.clientId !== undefined) { const c = String(body.clientId).trim(); if (c && !/^[\w.-]{10,200}\.apps\.googleusercontent\.com$|^dev$/.test(c)) return json({ error: 'That does not look like a Google Client ID (it ends in .apps.googleusercontent.com).' }, 400); g.clientId = c; }
    if (Array.isArray(body.gated)) g.gated = body.gated.filter(id => okStr(id, 40)).slice(0, 30);
    await env.LOCKS.put('theatre:google', JSON.stringify(g));
    return json({ ok: true, clientId: g.clientId || '', gated: (g.gated || []).length > 0 });
  }
  if (rest === 'gpass') {      // a parent signed in with Google: the parent passwords' key wraps (the parent password still opens them)
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:grate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
    if (n >= 30) return json({ error: 'Too many sign-ins from here. Wait an hour and try again.' }, 429);
    await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
    const g = (await env.LOCKS.get('theatre:google', 'json')) || {}, st = await env.LOCKS.get('theatre:show', 'json');
    if (!g.clientId || !st) return json({ error: 'Google sign-in is not set up yet. Tell the teacher.' }, 400);
    let body; try { body = JSON.parse(await req.text()); } catch (e) { return json({ error: 'That request was not readable.' }, 400); }
    let c = null; try { c = await googleClaims(String(body.token || ''), g.clientId, env); } catch (e) { c = null; }
    if (!c) return json({ error: 'Google sign-in did not work. Try again.' }, 403);
    return json({ more: (st.enc.more || []).filter(m => (g.gated || []).indexOf(m.id) >= 0) });
  }
  /* Tech Week Crew questionnaire (Colleen 2026-10-25: "the initial survey should be available without a password at all"): asl.cool/theatre/crew/.
     crew/form: the questions (dates, ways to help, the intro words) and the teacher's PUBLIC key; anyone reads it, only the teacher password sets it.
     crew/in: the answers, each sealed in the volunteer's browser with that public key (RSA-OAEP wraps a fresh AES-GCM key), so only the teacher's
     private key (in the vault, teacher password) opens them. Anyone may add one (small, limited per address); only the teacher reads and clears them. */
  if (rest === 'crew/form') {
    if (req.method === 'GET') { const f = await env.LOCKS.get('theatre:crewform', 'json'); return f ? json(f) : json({ none: true }, 404); }
    if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    let body; try { const t = await req.text(); if (t.length > 20000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That form is too big or not readable.' }, 400); }
    const bad = await proven(env, req, body.proof, st); if (bad) return bad;
    const f = body.form;
    if (!f || typeof f !== 'object' || !f.pub || f.pub.kty !== 'RSA' || !okStr(f.pub.n, 1000) || !okStr(f.pub.e, 10)) return json({ error: 'Something in the form was not right.' }, 400);
    delete f.proof; await env.LOCKS.put('theatre:crewform', JSON.stringify(f));
    return json({ ok: true });
  }
  if (rest === 'crew/in') {
    const list = (await env.LOCKS.get('theatre:crewin', 'json')) || [];
    if (req.method === 'POST') {
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:crewrate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= NOTES_PER_HOUR) return json({ error: 'Too many answers from here this hour. Try again later.' }, 429);
      if (!(await env.LOCKS.get('theatre:crewform'))) return json({ error: 'This form is not open yet.' }, 400);
      let body; try { const t = await req.text(); if (t.length > 16000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That is too long. Make the answers a little shorter.' }, 400); }
      const b = body.box; if (!b || !okStr(b.k, 800) || !okStr(b.iv, 100) || !okStr(b.data, 15000)) return json({ error: 'Those answers were not readable.' }, 400);
      if (list.length >= 400) return json({ error: 'The teacher has too many answers waiting. Please tell the teacher.' }, 507);
      const id = crypto.randomUUID();
      list.push({ id, at: new Date().toISOString(), box: { k: b.k, iv: b.iv, data: b.data } });
      await env.LOCKS.put('theatre:crewin', JSON.stringify(list));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true, id });
    }
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    if (req.method === 'GET') return json({ answers: list });
    if (req.method === 'DELETE') {      // the teacher took these into the vault
      let ids; try { ids = JSON.parse(await req.text()).ids; } catch (e) { ids = null; }
      if (!Array.isArray(ids)) return json({ error: 'Which answers?' }, 400);
      await env.LOCKS.put('theatre:crewin', JSON.stringify(list.filter(x => ids.indexOf(x.id) < 0)));
      return json({ ok: true });
    }
    return json({ error: 'GET, POST or DELETE' }, 405);
  }
  if (rest === 'check') {      // is this the teacher password? (Teacher mode asks once per visit)
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    let body; try { body = JSON.parse(await req.text()); } catch (e) { return json({ error: 'That request was not readable.' }, 400); }
    const bad = await proven(env, req, body.proof, st); if (bad) return bad;
    return json({ ok: true });
  }
  const bm = rest.match(/^board\/([a-z0-9-]{3,40})$/);
  if (bm) {
    const bk = 'theatre:board:' + bm[1], list = (await env.LOCKS.get(bk, 'json')) || [];
    if (req.method === 'GET') return json({ msgs: list });
    if (req.method === 'POST') {
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:boardrate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= NOTES_PER_HOUR) return json({ error: 'Too many messages from here. Try again later.' }, 429);
      let body; try { const t = await req.text(); if (t.length > 4000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'That message is too long.' }, 400); }
      const b = body.box; if (!b || !okStr(b.iv, 100) || !okStr(b.data, 3500)) return json({ error: 'That message was not readable.' }, 400);
      if (list.length >= 300) return json({ error: 'This group has too many messages. Tell the teacher.' }, 507);
      const id = crypto.randomUUID();
      list.push({ id, at: new Date().toISOString(), box: { iv: b.iv, data: b.data } });
      await env.LOCKS.put(bk, JSON.stringify(list));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true, id });
    }
    if (req.method === 'DELETE') {      // the teacher removes messages (or the whole board)
      const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
      const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
      let ids; try { ids = JSON.parse(await req.text()).ids; } catch (e) { ids = null; }
      if (ids === 'all') { await env.LOCKS.delete(bk); return json({ ok: true }); }
      if (!Array.isArray(ids)) return json({ error: 'Which messages?' }, 400);
      await env.LOCKS.put(bk, JSON.stringify(list.filter(x => ids.indexOf(x.id) < 0)));
      return json({ ok: true });
    }
    return json({ error: 'GET, POST or DELETE' }, 405);
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
  /* which parts of the app get used (Colleen 2026-10-23: to see what is worth building out). Anonymous counts only: the kind of password
     (student, parent, helper), the page, how many opens and seconds, added up by month. No name, student, device or address is kept. */
  if (rest === 'usage') {
    if (req.method === 'POST') {
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:userate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= 400) return json({ ok: true });      // a school's iPads share one address: quietly stop counting for the hour
      let body; try { const t = await req.text(); if (t.length > 4000) throw 0; body = JSON.parse(t); } catch (e) { return json({ error: 'Not readable.' }, 400); }
      const k = String(body.k || ''), pages = body.pages;
      if (['student', 'parent', 'helper'].indexOf(k) < 0 || !pages || typeof pages !== 'object') return json({ error: 'Not readable.' }, 400);
      const month = new Date().toISOString().slice(0, 7), key = 'theatre:usage:' + month, all = (await env.LOCKS.get(key, 'json')) || {}, mine = all[k] = all[k] || {};
      for (const p of Object.keys(pages).slice(0, 40)) {
        const v = pages[p]; if (!/^[a-z][a-z-]{0,23}$/.test(p) || !Array.isArray(v)) continue;
        const opens = Math.max(0, Math.min(200, v[0] | 0)), secs = Math.max(0, Math.min(3600, v[1] | 0)), x = mine[p] = mine[p] || [0, 0];
        x[0] += opens; x[1] += secs;
      }
      await env.LOCKS.put(key, JSON.stringify(all));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true });
    }
    if (req.method !== 'GET') return json({ error: 'GET or POST' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    const out = {}; let cursor;
    do {
      const page = await env.LOCKS.list({ prefix: 'theatre:usage:', cursor });
      for (const x of page.keys) out[x.name.slice('theatre:usage:'.length)] = await env.LOCKS.get(x.name, 'json');
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ months: out });
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
  /* costume and prop photos */
  if (rest === 'photo/index') return json({ photos: (await env.LOCKS.get('theatre:photoindex', 'json')) || [] });
  const ph = rest.match(/^photo\/([a-z0-9-]{6,24})(?:\/(ok)|\/([a-z0-9-]{1,40})\/(costume|prop|build|research|board)\/([a-z0-9-]{1,40})\/([a-z0-9-]{1,60}))?$/);
  if (ph) {
    const id = ph[1], pkey = 'theatre:photo:' + id;
    if (req.method === 'GET' && !ph[2] && !ph[3]) { const v = await env.LOCKS.get(pkey, 'arrayBuffer'); return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : json({ none: true }, 404); }
    if (req.method === 'POST' && ph[3]) {      // a Company member's iPad sends a photo (no password: sealed, small, limited)
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:photorate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= 120) return json({ error: 'Too many photos from here this hour. Try again later.' }, 429);
      const buf = await req.arrayBuffer();
      if (buf.byteLength < 100 || buf.byteLength > MAX_PHOTO) return json({ error: 'That photo is empty or too big.' }, 413);
      const list = (await env.LOCKS.get('theatre:photoindex', 'json')) || [];
      if (list.some(x => x.id === id)) return json({ error: 'That photo is already here.' }, 409);
      if (list.length >= MAX_PHOTOS) return json({ error: 'Your teacher has too many photos. Ask them to remove some.' }, 507);
      await env.LOCKS.put(pkey, buf);
      list.push({ id, actor: ph[3], kind: ph[4], char: ph[5], ref: ph[6], at: new Date().toISOString(), ok: false });
      await env.LOCKS.put('theatre:photoindex', JSON.stringify(list));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true });
    }
    if ((req.method === 'POST' && ph[2]) || (req.method === 'DELETE' && !ph[3])) {      // the teacher: OK a photo, or remove it
      const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
      const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
      const list = (await env.LOCKS.get('theatre:photoindex', 'json')) || [];
      if (req.method === 'DELETE') { await env.LOCKS.delete(pkey); await env.LOCKS.put('theatre:photoindex', JSON.stringify(list.filter(x => x.id !== id))); return json({ ok: true }); }
      const x = list.find(y => y.id === id); if (!x) return json({ error: 'That photo is gone.' }, 404);
      x.ok = true; await env.LOCKS.put('theatre:photoindex', JSON.stringify(list));
      return json({ ok: true });
    }
    return json({ error: 'Not allowed' }, 405);
  }
  /* line audio */
  const index = async (h, src, val) => { const ix = (await env.LOCKS.get('theatre:voiceindex', 'json')) || {}; ix[h] = ix[h] || {}; if (val) ix[h][src] = val; else delete ix[h][src]; if (!Object.keys(ix[h]).length) delete ix[h]; await env.LOCKS.put('theatre:voiceindex', JSON.stringify(ix)); };
  if (rest === 'voice/index') return json({ lines: (await env.LOCKS.get('theatre:voiceindex', 'json')) || {}, check: (await env.LOCKS.get('theatre:autorec')) === '0' });
  if (rest === 'voice/settings') {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    let body; try { body = JSON.parse(await req.text()); } catch (e) { body = {}; }
    const bad = await proven(env, req, body.proof, st); if (bad) return bad;
    await env.LOCKS.put('theatre:autorec', body.check ? '0' : '1');
    return json({ ok: true });
  }
  if (rest === 'voice/pending') {      // the teacher: recordings waiting
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    return json({ pending: (await env.LOCKS.get('theatre:pendinglist', 'json')) || [] });
  }
  const vp = rest.match(/^voice\/([a-z0-9]{6,20})\/(pending|approve)\/([a-z0-9]{2,16})$/);
  if (vp) {
    const pkey = 'theatre:pending:' + vp[1] + ':' + vp[3];
    if (vp[2] === 'pending' && req.method === 'POST') {      // a student's iPad sends a recording (no password: sealed, small, limited)
      const ip = req.headers.get('cf-connecting-ip') || 'unknown', rk = 'theatre:recrate:' + ip, n = +(await env.LOCKS.get(rk) || 0);
      if (n >= 200) return json({ error: 'Too many recordings from here this hour. Try again later.' }, 429);
      const buf = await req.arrayBuffer();
      if (buf.byteLength < 100 || buf.byteLength > MAX_REC) return json({ error: 'That recording is empty or too long (keep it under about 30 seconds).' }, 413);
      const list = (await env.LOCKS.get('theatre:pendinglist', 'json')) || [];
      if (list.length >= 600 && !list.some(x => x.h === vp[1] && x.actor === vp[3])) return json({ error: 'Your teacher has too many recordings waiting.' }, 507);
      const live = (await env.LOCKS.get('theatre:autorec')) !== '0', at = new Date().toISOString();
      if (live) { await env.LOCKS.put('theatre:voice:' + vp[1] + ':rec', buf); await index(vp[1], 'rec', { at, actor: vp[3] }); }
      else await env.LOCKS.put(pkey, buf);
      const next = list.filter(x => !(x.h === vp[1] && x.actor === vp[3])); next.push({ h: vp[1], actor: vp[3], at, live });
      if (next.length > 600) next.splice(0, next.length - 600);
      await env.LOCKS.put('theatre:pendinglist', JSON.stringify(next));
      await env.LOCKS.put(rk, String(n + 1), { expirationTtl: 3600 });
      return json({ ok: true, live });
    }
    const st = await env.LOCKS.get('theatre:show', 'json'); if (!st || !st.vhash) return json({ error: 'The show is not set up yet.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    const drop = async () => { const list = (await env.LOCKS.get('theatre:pendinglist', 'json')) || []; await env.LOCKS.put('theatre:pendinglist', JSON.stringify(list.filter(x => !(x.h === vp[1] && x.actor === vp[3])))); await env.LOCKS.delete(pkey); };
    if (vp[2] === 'pending' && req.method === 'GET') { const v = (await env.LOCKS.get(pkey, 'arrayBuffer')) || (await env.LOCKS.get('theatre:voice:' + vp[1] + ':rec', 'arrayBuffer')); return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : json({ none: true }, 404); }
    if (vp[2] === 'pending' && req.method === 'DELETE') {      // reject a waiting one, or take down a live one from that student
      const ix = (await env.LOCKS.get('theatre:voiceindex', 'json')) || {}, r = ix[vp[1]] && ix[vp[1]].rec;
      if (r && r.actor === vp[3]) { await env.LOCKS.delete('theatre:voice:' + vp[1] + ':rec'); await index(vp[1], 'rec', null); }
      await drop(); return json({ ok: true });
    }
    if (vp[2] === 'approve' && req.method === 'POST') {
      const v = await env.LOCKS.get(pkey, 'arrayBuffer'); if (!v) return json({ error: 'That recording is gone.' }, 404);
      await env.LOCKS.put('theatre:voice:' + vp[1] + ':rec', v); await index(vp[1], 'rec', { at: new Date().toISOString(), actor: vp[3] }); await drop();
      return json({ ok: true });
    }
    return json({ error: 'Not allowed' }, 405);
  }
  const vm = rest.match(/^voice\/([a-z0-9]{6,20})\/(tts|rec)$/);
  const m = vm ? ['voice'] : rest === 'pdf' ? ['pdf'] : rest.match(/^track\/([a-z0-9_-]{1,24})\/(rehearsal|performance)$/);
  if (m) {
    const key = vm ? 'theatre:voice:' + vm[1] + ':' + vm[2] : rest === 'pdf' ? 'theatre:pdf' : 'theatre:track:' + m[1] + ':' + m[2];
    if (req.method === 'GET') {
      const v = await env.LOCKS.get(key, 'arrayBuffer');
      return v ? new Response(v, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : json({ none: true }, 404);
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'GET, POST or DELETE' }, 405);
    const st = await env.LOCKS.get('theatre:show', 'json');
    if (!st || !st.vhash) return json({ error: 'Save the show once before adding tracks.' }, 400);
    const bad = await proven(env, req, req.headers.get('x-proof'), st); if (bad) return bad;
    if (req.method === 'DELETE') { await env.LOCKS.delete(key); if (vm) await index(vm[1], vm[2], null); return json({ ok: true }); }
    const len = +(req.headers.get('content-length') || 0);
    if (len > MAX_TRACK) return json({ error: 'That track is too big (24 MB at most). Try an MP3.' }, 413);
    const buf = await req.arrayBuffer();
    if (buf.byteLength < 100 || buf.byteLength > MAX_TRACK) return json({ error: 'That track is empty or too big (24 MB at most).' }, 413);
    await env.LOCKS.put(key, buf);
    if (vm) await index(vm[1], vm[2], vm[2] === 'rec' ? { at: new Date().toISOString(), actor: 'teacher' } : new Date().toISOString());
    return json({ ok: true, size: buf.byteLength });
  }
  return json({ error: 'Not found' }, 404);
}
