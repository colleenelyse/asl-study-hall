/* Live class games (ASL Study 4.139 The Vault, 4.142 Breach; Colleen 2026-10-21: "i want to move to cloudflare now", "yes move this one too").
   Google Apps Script was too slow for these games: every click took 1-3 seconds and a class of 30 hit Google's limit on requests at once.
   Now ASL Study still runs the lobby, sign-in, partners / crews and saving, and hands each started game to one LiveRoom here (a Durable Object):
   students' screens stay connected to it (a WebSocket), every click is answered at once, and everyone it changes sees it at the same moment.
   No names or emails come here: players are numbers (p1, p2...), and names stay on the students' own screens and the teacher's projector.
   The game rules are ASL Study's own code (vault-core.js and breach-core.js are generated from Code.gs by dev/build-rt.py).
   Routes (worker.js sends /rt/<room>/... here; room = the 5-digit game code + a long random part only ASL Study knows):
     POST /setup   {k, kind:'vault', vault, ends} | {k, kind:'breach', g, j}   start the room (from ASL Study's server); k = the game's key
     GET  /ws?id=<p3 or board>&t=<signature>       a screen connects (signature = HMAC-SHA256(k, id), made by ASL Study)
     POST /join    {k, id, team}                    Breach: a student who joined after Start
     POST /control {k, action}                      Breach: the teacher's buttons (pause, skip the vote, Color Scan, new Decoder)
     POST /results {k}                              the outcome, for ASL Study to save
     POST /stop    {k}                              the teacher ended the game (results stay until /end)
     POST /end     {k}                              close the room
   Messages: screen -> {a:'view'} | {a:'act', act, arg, n} (Vault) | {a:'call', fn, args, n, right} (Breach);
             room -> {t:'v', v} (your view) | {t:'r', n, out, v} (a reply) | {t:'b', b} (the board) | {t:'over'} */
import { vaultViewCore_, vaultBoardCore_, vaultActCore_, vaultEnd_ } from './vault-core.js';
import { rtUse, breachView_, breachTick_, breachDue_, breachControl_, api_breachVote, api_breachMove, api_breachNote, api_breachBox, api_breachTool, api_breachTry } from './breach-core.js';

const TICK_MS = { vault: 2000, breach: 1000 };      // between clicks the room still moves time along (Vault: the meeting minute, the guards; Breach: the vote, attempts, Color Scans)
const BR_CALLS = { api_breachVote, api_breachMove, api_breachNote, api_breachBox, api_breachTool, api_breachTry };
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}
const same = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export class LiveRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.s = null; this.sent = new Map(); this.boardSent = '';
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('s')) || null; }); }
  async save() { if (this.s) await this.ctx.storage.put('s', this.s); }
  breach() { return this.s && this.s.kind === 'breach'; }
  ends() { return this.breach() ? Number(this.s.g.ends) || 0 : this.s.ends; }
  setEnds(t) { if (this.breach()) this.s.g.ends = t; else this.s.ends = t; }
  over() { return !this.s || (this.breach() && this.s.g.breach.paused ? false : Date.now() >= this.ends()); }
  rt() { this.s.dirty = false; rtUse(this.s); return this.s; }      // Breach's rules read the room's game through these stand-ins
  sendAll(o) { const m = JSON.stringify(o); this.ctx.getWebSockets().forEach(ws => { try { ws.send(m); } catch (e) {} }); }

  async fetch(req) {
    const url = new URL(req.url), op = url.pathname.split('/').pop();
    if (op === 'ws') return this.connect(req, url);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (op === 'setup') {
      if (this.s && this.s.k !== body.k) return json({ error: 'taken' }, 409);
      if (body.kind === 'vault' && body.k && body.vault && body.vault.pairs) this.s = { k: body.k, kind: 'vault', v: body.vault, ends: Number(body.ends) || Date.now() + 3600e3, made: Date.now() };
      else if (body.kind === 'breach' && body.k && body.g && body.g.breach && body.j) this.s = { k: body.k, kind: 'breach', g: body.g, j: body.j, rights: {}, made: Date.now() };
      else return json({ error: 'bad setup' }, 400);
      await this.save(); await this.ctx.storage.setAlarm(Date.now() + TICK_MS[this.s.kind]); return json({ ok: true });
    }
    if (!this.s || body.k !== this.s.k) return json({ error: 'no room' }, 404);
    if (op === 'results') {
      if (this.breach()) return json({ g: this.s.g });
      const V = this.s.v; return json({ ends: this.s.ends, pairs: V.pairs.map(P => ({ ids: P.m, done: P.done || 0, t0: P.t0 || 0, pen: P.pen || 0, n: (P.locks || []).length, loot: (P.loot || []).reduce((t, x) => t + x[1], 0), caught: !!(vaultEnd_(V, P) || {}).caught })) });
    }
    if (op === 'join' && this.breach()) { const id = String(body.id || ''), t = Number(body.team); if (!/^p\d{1,3}$/.test(id) || !(t >= 0)) return json({ error: 'bad join' }, 400); this.s.j[id] = [id, '', t]; await this.save(); this.pushAll(); return json({ ok: true }); }
    if (op === 'control' && this.breach()) { this.rt(); const ch = breachControl_(this.s.g, String(body.action || '')); if (ch) { await this.save(); this.pushAll(); } return json({ ok: true, changed: !!ch }); }
    if (op === 'stop') { this.setEnds(Math.min(this.ends(), Date.now())); if (this.breach()) this.s.g.breach.paused = false; await this.save(); this.sendAll({ t: 'over' }); this.pushBoard(true); return json({ ok: true }); }      // the teacher ended the game early
    if (op === 'end') { this.ctx.getWebSockets().forEach(ws => { try { ws.send(JSON.stringify({ t: 'over' })); ws.close(1000, 'over'); } catch (e) {} }); await this.ctx.storage.deleteAll(); this.s = null; return json({ ok: true }); }
    return json({ error: 'unknown' }, 404);
  }

  async connect(req, url) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const id = url.searchParams.get('id') || '', t = url.searchParams.get('t') || '';
    if (!this.s) return new Response('no room', { status: 404 });
    if (!/^(p\d{1,3}|board)$/.test(id) || !same(await hmacHex(this.s.k, id), t)) return new Response('not allowed', { status: 403 });
    if (id !== 'board' && (this.breach() ? !this.s.j[id] : this.s.v.byE[id] == null)) return new Response('not in this game', { status: 403 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [id]); server.serializeAttachment({ id });
    return new Response(null, { status: 101, webSocket: client });
  }

  view(id) { if (!this.breach()) return vaultViewCore_(this.s.v, id); this.rt(); const me = this.s.j[id]; return breachView_(this.s.g, me && typeof me[2] === 'number' ? me[2] : -2, id); }
  boardView() { if (!this.breach()) { const b = vaultBoardCore_(this.s.v); b.over = this.over(); b.ends = this.s.ends; return b; } this.rt(); const b = breachView_(this.s.g, -1, ''); b.ends = this.s.g.ends; return b; }
  /* the parts of a view that only count time (the screen counts those down itself): a screen gets a new view only when something else changed */
  sigOf(v) { if (!this.breach()) return JSON.stringify(Object.assign({}, v, { elapsed: 0, loot: v.loot ? Object.assign({}, v.loot, { alarm: Math.round((v.loot.alarm || 0) * 20) / 20 }) : 0 }));
    return JSON.stringify(Object.assign({}, v, { left: 0, glow: v.glow ? 1 : 0, attempt: v.attempt ? Object.assign({}, v.attempt, { left: 0 }) : null })); }
  push(id, force) { const v = this.view(id); if (!v) return; const sig = this.sigOf(v);
    if (!force && this.sent.get(id) === sig) return; this.sent.set(id, sig);
    const msg = JSON.stringify({ t: 'v', v }); this.ctx.getWebSockets(id).forEach(ws => { try { ws.send(msg); } catch (e) {} }); }
  pushBoard(force) { const socks = this.ctx.getWebSockets('board'); if (!socks.length) return; const b = this.boardView();
    const msg = JSON.stringify({ t: 'b', b }), sig = this.breach() ? this.sigOf(b) : JSON.stringify(Object.assign({}, b, { pairs: b.pairs.map(p => Object.assign({}, p, { alarm: Math.round((p.alarm || 0) * 20) / 20 })) }));
    if (!force && sig === this.boardSent) return; this.boardSent = sig; socks.forEach(ws => { try { ws.send(msg); } catch (e) {} }); }
  ids() { const ids = new Set(); this.ctx.getWebSockets().forEach(ws => { const a = ws.deserializeAttachment(); if (a && a.id && a.id !== 'board') ids.add(a.id); }); return ids; }
  pushAll() { this.ids().forEach(id => this.push(id, false)); this.pushBoard(false); }
  pairIds(id) { const V = this.s.v, i = V.byE[id]; return i == null ? [id] : V.pairs[i].m; }

  async webSocketMessage(ws, raw) {
    if (!this.s) { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} return; }
    const { id } = ws.deserializeAttachment() || {}; let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (this.over()) { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} if (id === 'board') this.pushBoard(true); return; }
    if (this.breach()) return this.breachMessage(ws, id, m);
    if (id === 'board') {      /* the projector: a teacher's tap skips a stuck pair's lock (ASL Study 4.140) */
      const P = m.a === 'tskip' ? this.s.v.pairs[Number(m.pair)] : null;
      if (P) { const out = vaultActCore_(this.s.v, P.m[0], 'tskip', '', Date.now()); if (out.allDone) this.s.ends = Math.min(this.s.ends, Date.now() + 20000); if (!out.none) { await this.save(); P.m.forEach(x => this.push(x, true)); } }
      this.pushBoard(true); return; }
    if (m.a === 'view') { this.push(id, true); await this.save(); return; }      // the view can start a pair's clock (the meeting minute), so it is saved
    if (m.a !== 'act' || m.act === 'tskip') return;
    const now = Date.now(), out = vaultActCore_(this.s.v, id, String(m.act || ''), m.arg == null ? '' : String(m.arg), now);
    if (out.allDone) this.s.ends = Math.min(this.s.ends, now + 20000);      // everyone out: the game ends 20 seconds later
    delete out.changed; delete out.pair; delete out.allDone;
    if (!out.none) await this.save();
    const v = this.view(id);
    try { ws.send(JSON.stringify({ t: 'r', n: m.n, out, v })); } catch (e) {}
    this.sent.set(id, null); this.push(id, true);      // my other tabs, if any
    this.pairIds(id).filter(x => x !== id).forEach(x => this.push(x, true));      // my partner's screen changes at the same moment
    this.pushBoard(false);
  }
  /* Breach: the same calls the screens used to send to ASL Study (api_breachMove ...), run here with the player's number in place of their sign-in */
  async breachMessage(ws, id, m) {
    if (id === 'board') { this.pushBoard(true); return; }
    if (m.a === 'view') { this.push(id, true); return; }
    if (m.a !== 'call' || !BR_CALLS[m.fn]) return;
    const S = this.rt(); if (m.right != null) { const r = Math.floor(Number(m.right)) || 0; if (r > (S.rights[id] || 0)) S.rights[id] = r; }
    let out; try { out = BR_CALLS[m.fn](id, S.g.id, ...(Array.isArray(m.args) ? m.args : [])); } catch (e) { out = { none: true, why: String(e && e.message || e) }; }
    if (this.s.dirty) await this.save(); else await this.save();      // the earned power is saved too
    try { ws.send(JSON.stringify({ t: 'r', n: m.n, out })); } catch (e) {}
    this.push(id, true); this.pushAll();      // what one crew member does can change every crew's screen (pieces seen, attempts, the logbook)
  }
  async webSocketClose(ws) { try { ws.close(); } catch (e) {} }
  async webSocketError(ws) { try { ws.close(); } catch (e) {} }

  async alarm() {
    if (!this.s) return;
    if (this.over()) { this.sendAll({ t: 'over' }); this.pushBoard(true);
      if (Date.now() > this.ends() + 6 * 3600e3) { await this.ctx.storage.deleteAll(); this.s = null; return; }      // forgotten rooms clean themselves up
      await this.ctx.storage.setAlarm(Date.now() + 60e3); return; }
    if (this.breach()) { this.rt(); if (breachDue_(this.s.g) && breachTick_(this.s.g)) { await this.save(); this.ids().forEach(id => this.push(id, true)); this.pushBoard(true); } else this.pushAll(); }
    else { this.pushAll(); await this.save(); }
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS[this.s.kind]);
  }
}

/* worker.js: asl.cool/rt/<room>/<op> -> that room */
export function rtRoute(req, env, url) {
  const m = url.pathname.match(/^\/rt\/(\d{5}-[a-f0-9]{24,40})\/(setup|ws|results|join|control|stop|end)$/);
  if (!m) return json({ error: 'not found' }, 404);
  return env.LIVE.get(env.LIVE.idFromName(m[1])).fetch(req);
}
