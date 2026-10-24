/* Local test server for asl.cool/theatre: the site's files + theatre/api.js on a KV kept in <private folder>/dev-kv (so a restart keeps the test show).
   api.js is read again whenever it changes.
   node theatre/dev/dev-server.mjs <repo folder> 8830 <private folder>   then open http://localhost:8830/theatre/
   <private folder> is served at /__private/ for testing only (the licensed script PDF, test tracks). Keep it OUTSIDE the repo. */
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url'; import crypto from 'node:crypto';
const ROOT = path.resolve(process.argv[2]), PORT = +process.argv[3] || 8787, PRIV = process.argv[4] ? path.resolve(process.argv[4]) : null;
const API_FILE = path.join(ROOT, 'theatre/api.js');
let theatreApi = null, apiAt = 0, apiN = 0;
async function api() {      // api.js is an ES module in a plain .js file: copied to .mjs, and again when it changes
  const at = fs.statSync(API_FILE).mtimeMs;
  if (!theatreApi || at !== apiAt) { const tmp = path.join(os.tmpdir(), 'theatre-api-' + process.pid + '-' + (++apiN) + '.mjs'); fs.copyFileSync(API_FILE, tmp); theatreApi = (await import(pathToFileURL(tmp))).theatreApi; fs.unlinkSync(tmp); apiAt = at; }
  return theatreApi;
}
const kv = new Map(), KVDIR = PRIV ? path.join(PRIV, 'dev-kv') : null;
if (KVDIR) { fs.mkdirSync(KVDIR, { recursive: true }); for (const f of fs.readdirSync(KVDIR)) { const b = fs.readFileSync(path.join(KVDIR, f)), k = decodeURIComponent(f.slice(2)); kv.set(k, f[0] === 'b' ? b.buffer.slice(b.byteOffset, b.byteOffset + b.length) : b.toString('utf8')); } }
const keep = (k, v) => { if (!KVDIR) return; const n = encodeURIComponent(k); for (const t of ['s_', 'b_']) fs.rmSync(path.join(KVDIR, t + n), { force: true }); if (v != null) fs.writeFileSync(path.join(KVDIR, (typeof v === 'string' ? 's_' : 'b_') + n), typeof v === 'string' ? v : Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v)); };
const LOCKS = { async get(k, type) { const v = kv.get(k); if (v == null) return null; if (type === 'json') return JSON.parse(v); if (type === 'arrayBuffer') return v; return v; },
  async put(k, v) { kv.set(k, v); keep(k, v); }, async delete(k) { kv.delete(k); keep(k, null); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  if (url.pathname.startsWith('/theatre/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await (await api())(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), { LOCKS, THEATRE_SETUP: process.env.THEATRE_SETUP || 'DEV' }, url, url.pathname);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (url.pathname === '/__mail') {      // a stand-in for theatre/mail-script (key "devkey"): records emails in <private>/dev-mail.json instead of sending
    const file = PRIV ? path.join(PRIV, 'dev-mail.json') : null, box = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { sent: [], unsub: [] };
    const sig = a => crypto.createHmac('sha256', 'devkey').update(String(a).trim().toLowerCase()).digest('hex'), save = () => file && fs.writeFileSync(file, JSON.stringify(box, null, 1));
    if (req.method === 'GET') { const u = url.searchParams.get('u') || ''; if (/^[0-9a-f]{64}$/.test(u)) { box.unsub = box.unsub.filter(x => x !== u); if (url.searchParams.get('undo') !== '1') box.unsub.push(u); save(); } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<p>Unsubscribed (dev)</p>'); return; }
    const chunks = []; for await (const c of req) chunks.push(c); let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) {}
    const out = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (body.key !== 'devkey') return out({ ok: false, error: 'The key is not right.' });
    let sent = 0, skipped = 0;
    for (const m of (body.messages || []).slice(0, 40)) { if (box.unsub.includes(sig(m.to))) { skipped++; continue; } box.sent.push({ at: new Date().toISOString(), name: body.name, to: m.to, subject: m.subject, text: m.text }); sent++; }
    save(); return out({ ok: true, sent, skipped, quota: 1500 - box.sent.length });
  }
  let base = ROOT, p = url.pathname;
  if (PRIV && p.startsWith('/__private/')) { base = PRIV; p = p.slice('/__private'.length); }      // test-only files outside the repo (the licensed PDF)
  let f = path.join(base, decodeURIComponent(p));
  if (!f.startsWith(base)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); res.end(); return; } f = path.join(f, 'index.html'); }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('theatre dev on http://localhost:' + PORT + '/theatre/'));
