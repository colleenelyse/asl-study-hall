/* Local test server for asl.cool/theatre: the site's files + theatre/api.js on an in-memory KV (nothing is saved after it stops).
   node theatre/dev/dev-server.mjs <repo folder> 8830 <private folder>   then open http://localhost:8830/theatre/
   <private folder> is served at /__private/ for testing only (the licensed script PDF, test tracks). Keep it OUTSIDE the repo. */
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const ROOT = path.resolve(process.argv[2]), PORT = +process.argv[3] || 8787, PRIV = process.argv[4] ? path.resolve(process.argv[4]) : null;
const tmp = path.join(os.tmpdir(), 'theatre-api-' + process.pid + '.mjs');      // api.js is an ES module in a plain .js file
fs.copyFileSync(path.join(ROOT, 'theatre/api.js'), tmp);
const { theatreApi } = await import(pathToFileURL(tmp));
const kv = new Map();
const LOCKS = { async get(k, type) { const v = kv.get(k); if (v == null) return null; if (type === 'json') return JSON.parse(v); if (type === 'arrayBuffer') return v; return v; },
  async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); },
  async list({ prefix }) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  if (url.pathname.startsWith('/theatre/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await theatreApi(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), { LOCKS, THEATRE_SETUP: process.env.THEATRE_SETUP || 'DEV' }, url, url.pathname);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let base = ROOT, p = url.pathname;
  if (PRIV && p.startsWith('/__private/')) { base = PRIV; p = p.slice('/__private'.length); }      // test-only files outside the repo (the licensed PDF)
  let f = path.join(base, decodeURIComponent(p));
  if (!f.startsWith(base)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); res.end(); return; } f = path.join(f, 'index.html'); }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('theatre dev on http://localhost:' + PORT + '/theatre/'));
