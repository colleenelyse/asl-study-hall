/* Live class games (ASL Study 4.139, Colleen 2026-10-21: "i want to move to cloudflare now").
   Google Apps Script was too slow for The Vault: every click took 1-3 seconds and a class of 30 hit Google's limit on requests at once.
   Now ASL Study still runs the lobby, sign-in, partners and saving, and hands each started game to one LiveRoom here (a Durable Object):
   students' screens stay connected to it (a WebSocket), every click is answered at once, and both partners' screens change together.
   No names or emails come here: players are numbers (p1, p2...), and names stay on the students' own screens.
   Routes (worker.js sends /rt/<room>/... here; room = the 5-digit game code + a long random part only ASL Study knows):
     POST /setup   {k, kind:'vault', vault, ends}  (from ASL Study's server)  start the room; k = the game's key
     GET  /ws?id=<p3 or board>&t=<signature>       a screen connects (signature = HMAC-SHA256(k, id), made by ASL Study)
     POST /results {k}                              the outcome, for ASL Study to save
     POST /stop    {k}                              the teacher ended the game (results stay until /end)
     POST /end     {k}                              close the room
   Messages: screen -> {a:'view'} | {a:'act', act, arg, n}; room -> {t:'v', v} (your view) | {t:'r', n, out, v} (a reply) | {t:'b', b} (the board) | {t:'over'} */
import { vaultViewCore_, vaultBoardCore_, vaultActCore_, vaultEnd_ } from './vault-core.js';

const TICK_MS = 2000;      // between clicks the room still moves time along: the meeting minute, the guards (loot run), the end
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
  async save() { await this.ctx.storage.put('s', this.s); }
  over() { return !this.s || Date.now() >= this.s.ends; }

  async fetch(req) {
    const url = new URL(req.url), op = url.pathname.split('/').pop();
    if (op === 'ws') return this.connect(req, url);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    if (op === 'setup') {
      if (this.s && this.s.k !== body.k) return json({ error: 'taken' }, 409);
      if (!body.k || body.kind !== 'vault' || !body.vault || !body.vault.pairs) return json({ error: 'bad setup' }, 400);
      this.s = { k: body.k, kind: 'vault', v: body.vault, ends: Number(body.ends) || Date.now() + 3600e3, made: Date.now() };
      await this.save(); await this.ctx.storage.setAlarm(Date.now() + TICK_MS); return json({ ok: true });
    }
    if (!this.s || body.k !== this.s.k) return json({ error: 'no room' }, 404);
    if (op === 'results') {
      const V = this.s.v; return json({ ends: this.s.ends, pairs: V.pairs.map(P => ({ ids: P.m, done: P.done || 0, t0: P.t0 || 0, pen: P.pen || 0, n: (P.locks || []).length, loot: (P.loot || []).reduce((t, x) => t + x[1], 0), caught: !!(vaultEnd_(V, P) || {}).caught })) });
    }
    if (op === 'stop') { this.s.ends = Math.min(this.s.ends, Date.now()); await this.save(); this.ctx.getWebSockets().forEach(ws => { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} }); this.pushBoard(true); return json({ ok: true }); }      // the teacher ended the game early
    if (op === 'end') { this.ctx.getWebSockets().forEach(ws => { try { ws.send(JSON.stringify({ t: 'over' })); ws.close(1000, 'over'); } catch (e) {} }); await this.ctx.storage.deleteAll(); this.s = null; return json({ ok: true }); }
    return json({ error: 'unknown' }, 404);
  }

  async connect(req, url) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const id = url.searchParams.get('id') || '', t = url.searchParams.get('t') || '';
    if (!this.s) return new Response('no room', { status: 404 });
    if (!/^(p\d{1,3}|board)$/.test(id) || !same(await hmacHex(this.s.k, id), t)) return new Response('not allowed', { status: 403 });
    if (id !== 'board' && this.s.v.byE[id] == null) return new Response('not in this game', { status: 403 });
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [id]); server.serializeAttachment({ id });
    return new Response(null, { status: 101, webSocket: client });
  }

  view(id) { const v = vaultViewCore_(this.s.v, id); return v; }
  /* send a screen its view only when something it shows changed (the clock runs on the screen) */
  push(id, force) { const v = this.view(id); if (!v) return; const sig = JSON.stringify(Object.assign({}, v, { elapsed: 0, loot: v.loot ? Object.assign({}, v.loot, { alarm: Math.round((v.loot.alarm || 0) * 20) / 20 }) : 0 }));
    if (!force && this.sent.get(id) === sig) return; this.sent.set(id, sig);
    const msg = JSON.stringify({ t: 'v', v }); this.ctx.getWebSockets(id).forEach(ws => { try { ws.send(msg); } catch (e) {} }); }
  pushBoard(force) { const socks = this.ctx.getWebSockets('board'); if (!socks.length) return; const b = vaultBoardCore_(this.s.v); b.over = this.over(); b.ends = this.s.ends;
    const msg = JSON.stringify({ t: 'b', b }), sig = JSON.stringify(Object.assign({}, b, { pairs: b.pairs.map(p => Object.assign({}, p, { alarm: Math.round((p.alarm || 0) * 20) / 20 })) }));
    if (!force && sig === this.boardSent) return; this.boardSent = sig; socks.forEach(ws => { try { ws.send(msg); } catch (e) {} }); }
  pairIds(id) { const V = this.s.v, i = V.byE[id]; return i == null ? [id] : V.pairs[i].m; }

  async webSocketMessage(ws, raw) {
    if (!this.s) { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} return; }
    const { id } = ws.deserializeAttachment() || {}; let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (this.over()) { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} return; }
    if (id === 'board') { this.pushBoard(true); return; }
    if (m.a === 'view') { this.push(id, true); await this.save(); return; }      // the view can start a pair's clock (the meeting minute), so it is saved
    if (m.a !== 'act') return;
    const now = Date.now(), out = vaultActCore_(this.s.v, id, String(m.act || ''), m.arg == null ? '' : String(m.arg), now);
    if (out.allDone) this.s.ends = Math.min(this.s.ends, now + 20000);      // everyone out: the game ends 20 seconds later
    delete out.changed; delete out.pair; delete out.allDone;
    if (!out.none) await this.save();
    const v = this.view(id), sig = JSON.stringify(Object.assign({}, v, { elapsed: 0 }));
    try { ws.send(JSON.stringify({ t: 'r', n: m.n, out, v })); } catch (e) {}
    this.sent.set(id, null); this.push(id, true);      // my other tabs, if any
    this.pairIds(id).filter(x => x !== id).forEach(x => this.push(x, true));      // my partner's screen changes at the same moment
    this.pushBoard(false);
  }
  async webSocketClose(ws) { try { ws.close(); } catch (e) {} }
  async webSocketError(ws) { try { ws.close(); } catch (e) {} }

  async alarm() {
    if (!this.s) return;
    if (this.over()) { this.ctx.getWebSockets().forEach(ws => { try { ws.send(JSON.stringify({ t: 'over' })); } catch (e) {} }); this.pushBoard(true);
      if (Date.now() > this.s.ends + 6 * 3600e3) { await this.ctx.storage.deleteAll(); this.s = null; return; }      // forgotten rooms clean themselves up
      await this.ctx.storage.setAlarm(Date.now() + 60e3); return; }
    const ids = new Set(); this.ctx.getWebSockets().forEach(ws => { const a = ws.deserializeAttachment(); if (a && a.id && a.id !== 'board') ids.add(a.id); });
    ids.forEach(id => this.push(id, false)); this.pushBoard(false);
    await this.save(); await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }
}

/* worker.js: asl.cool/rt/<room>/<op> -> that room */
export function rtRoute(req, env, url) {
  const m = url.pathname.match(/^\/rt\/(\d{5}-[a-f0-9]{24,40})\/(setup|ws|results|stop|end)$/);
  if (!m) return json({ error: 'not found' }, 404);
  return env.LIVE.get(env.LIVE.idFromName(m[1])).fetch(req);
}
