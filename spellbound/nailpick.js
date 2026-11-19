/* Nail color picker (Colleen 2026-11-19): quick choices in a row (Natural, Nude, French, Pink, Red, Burgundy, Purple, Green, Black), then an
   "Advanced" dropdown with a color wheel like the one on an ETC Eos lighting console: tap anywhere on the wheel for the hue (around) and how strong
   the color is (center = white, edge = full color), a brightness slider under it, and the color's code. Natural, Nude and French follow the skin tone.
   NailPick.mount(el, { onChange(sel) }) -> { get(), set(sel) }.  sel = { kind: 'natural' | 'nude' | 'french' | 'color', hex }
   NailPick.apply(hand, sel, toneHex) sets the nails on a painted hand (hand.polish). */
(function () {
/* names (Colleen 2026-11-19: "like the OPI swatches with the name underneath ... fun names"): each card = [fun name, choice, plain word] */
const QUICK = [['Just Me', { kind: 'natural' }, 'Natural'], ['Second Skin', { kind: 'nude' }, 'Nude'], ['Très Chic', { kind: 'french' }, 'French tip'], ['Pinky Promise', { kind: 'color', hex: 0xe27aa0 }, 'Pink'], ['Stop Sign', { kind: 'color', hex: 0xb3122d }, 'Red'],
  ['Velvet Curtain', { kind: 'color', hex: 0x6b1328 }, 'Burgundy'], ['Royal Wave', { kind: 'color', hex: 0x5e2a7e }, 'Purple'], ['Go Light', { kind: 'color', hex: 0x1f6b45 }, 'Green'], ['Blackout', { kind: 'color', hex: 0x161616 }, 'Black']];
/* silly lengths (Colleen 2026-11-19): to show students how hard long nails make fingerspelling to read */
const LENS = [['Short', null], ['Long', 'long'], ['Stiletto', 'stiletto'], ['Coffin', 'coffin'], ['Claws', 'claws']];
const hex6 = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
const rgbOf = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const ofRgb = (r, g, b) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
/* nude follows the skin: a little lighter and pinker than the skin itself, never grey */
function natFor(tone) { const [r, g, b] = rgbOf(tone); return ofRgb(Math.min(255, r * 1.12 + 20), Math.min(255, g * 1.0 + 8), Math.min(255, b * 1.02 + 12)); }
function nudeFor(tone) { const [r, g, b] = rgbOf(tone); return ofRgb(Math.min(255, r * 1.08 + 18), Math.min(255, g * 0.98 + 10), Math.min(255, b * 0.98 + 12)); }
function apply(hand, sel, tone) {
  if (!hand || !hand.polish) return; sel = sel || { kind: 'natural' };
  if (sel.kind === 'natural') hand.polish(null, false, false);
  else if (sel.kind === 'french') hand.polish(null, false, true);
  else if (sel.kind === 'nude') hand.polish(nudeFor(tone || 0x9c6a4f), true, false);
  else hand.polish(sel.hex, true, false);
}
function hsv2rgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; }
function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; }
const CSS = `.np-head{font-size:15px;margin:0 0 8px;color:#5b6475}.np-head b{color:#1d2433}
.np-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px}
.np-card{font:inherit;background:#fff;border:1.5px solid #c9c4ba;border-radius:12px;padding:0;cursor:pointer;color:#1d2433;display:flex;flex-direction:column;align-items:stretch;overflow:hidden;text-align:left}
.np-card.on{border:3px solid #2a5aa6;margin:-1.5px}.np-dot-wrap{padding:10px 0 9px;display:flex;justify-content:center;border-bottom:1px solid #e3ded4}
.np-dot{width:56px;height:56px;border-radius:50%;box-shadow:inset -4px -6px 10px rgba(0,0,0,.18),inset 3px 4px 8px rgba(255,255,255,.25),0 1px 2px rgba(0,0,0,.25);position:relative}
.np-dot:after{content:'';position:absolute;left:12px;top:7px;width:20px;height:9px;border-radius:50%;background:rgba(255,255,255,.75);transform:rotate(-28deg);filter:blur(.6px)}
.np-name{font-size:13px;font-weight:700;padding:6px 8px 0;line-height:1.2}.np-plain{font-size:12px;color:#6b7280;padding:2px 8px 8px}
.np-adv{margin-top:10px}.np-adv summary{cursor:pointer;font-size:14px;color:#5b6475}.np-box{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:10px;padding:12px;border:1px solid #ddd6c8;border-radius:12px;background:#1b1d22;color:#e8e8e8}
.np-wheel{width:220px;height:220px;max-width:100%;touch-action:none;cursor:crosshair;border-radius:50%}.np-side{display:flex;flex-direction:column;gap:10px;min-width:150px}
.np-side label{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#a9b0bd}.np-side input[type=range]{width:160px}.np-big{width:100%;height:40px;border-radius:8px;border:1px solid #444}
.np-hex{font:13px ui-monospace,Menlo,monospace;color:#cfd3da}.np-look{margin-top:10px;font-size:14px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.np-look button{font:inherit;font-size:13px;padding:5px 10px;border-radius:8px;border:1px solid #c9c4ba;background:#fff;cursor:pointer}.np-look button.on{background:#2f6f4f;color:#fff;border-color:#2f6f4f}`;
function mount(el, opts) {
  opts = opts || {}; if (!document.getElementById('np-css')) { const st = document.createElement('style'); st.id = 'np-css'; st.textContent = CSS; document.head.appendChild(st); }
  let sel = opts.value || { kind: 'natural' }, H = 0, S = 1, V = 0.7;
  el.innerHTML = '<div class="np-head">Color: <b class="np-cur">Just Me</b></div><div class="np-row"></div><details class="np-adv"><summary>Advanced: pick any color</summary><div class="np-box"><canvas class="np-wheel" width="440" height="440"></canvas>' +
    '<div class="np-side"><label>Brightness</label><input type="range" class="np-v" min="5" max="100" value="70"><label>Color</label><div class="np-big"></div><div class="np-hex"></div></div></div></details>';
  const len = undefined;
  const row = el.querySelector('.np-row'), wheel = el.querySelector('.np-wheel'), vIn = el.querySelector('.np-v'), big = el.querySelector('.np-big'), hexEl = el.querySelector('.np-hex');
  let toneNow = opts.tone || 0x9c6a4f; const cur = el.querySelector('.np-cur');
  const swatch = s => s.kind === 'color' ? hex6(s.hex) : s.kind === 'nude' ? hex6(nudeFor(toneNow)) : s.kind === 'french' ? 'linear-gradient(172deg, #f7f4ef 0 27%, ' + hex6(natFor(toneNow)) + ' 30%)' : hex6(natFor(toneNow));
  QUICK.forEach(([lab, s, plain]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'np-card'; b.dataset.k = lab; b.title = plain;
    b.innerHTML = '<span class="np-dot-wrap"><span class="np-dot"></span></span><span class="np-name">' + lab + '</span><span class="np-plain">' + plain + '</span>';
    b.querySelector('.np-dot').style.background = swatch(s); b.onclick = () => choose(Object.assign({}, s), lab); row.appendChild(b); });
  const retone = hx => { toneNow = hx; QUICK.forEach(([lab, s]) => { const b = row.querySelector('[data-k="' + lab + '"] .np-dot'); if (b) b.style.background = swatch(s); }); };
  function drawWheel() { const g = wheel.getContext('2d'), R = wheel.width / 2, id = g.createImageData(wheel.width, wheel.height), d = id.data;
    for (let y = 0; y < wheel.height; y++) for (let x = 0; x < wheel.width; x++) { const dx = x - R, dy = y - R, r = Math.hypot(dx, dy) / R, i = (y * wheel.width + x) * 4; if (r > 1) { d[i + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, c = hsv2rgb(h, r, V); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
    g.putImageData(id, 0, 0); const a = H * Math.PI / 180, mx = R + Math.cos(a) * S * R, my = R + Math.sin(a) * S * R;
    g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(mx, my, 12, 0, 7); g.stroke(); g.lineWidth = 2; g.strokeStyle = '#000'; g.beginPath(); g.arc(mx, my, 15, 0, 7); g.stroke(); }
  function show() { const hx = sel.kind === 'color' ? sel.hex : null; big.style.background = hx !== null ? hex6(hx) : '#333'; hexEl.textContent = hx !== null ? hex6(hx).toUpperCase() : sel.kind; }
  function choose(s, lab) { sel = Object.assign({}, s, { len }); cur.textContent = lab || 'My Mix'; row.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === lab));
    if (s.kind === 'color') { const [h, sa, v] = rgb2hsv(...rgbOf(s.hex)); H = h; S = sa; V = Math.max(0.05, v); vIn.value = Math.round(V * 100); drawWheel(); }
    show(); if (opts.onChange) opts.onChange(sel); }
  function fromWheel(e) { const r = wheel.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1;
    H = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; S = Math.min(1, Math.hypot(x, y)); pick(); }
  function pick() { const c = hsv2rgb(H, S, V); sel = { kind: 'color', hex: ofRgb(c[0], c[1], c[2]), len }; row.querySelectorAll('button').forEach(b => b.classList.remove('on')); cur.textContent = 'My Mix'; drawWheel(); show(); if (opts.onChange) opts.onChange(sel); }
  let down = false; wheel.addEventListener('pointerdown', e => { down = true; wheel.setPointerCapture(e.pointerId); fromWheel(e); });
  wheel.addEventListener('pointermove', e => { if (down) fromWheel(e); }); wheel.addEventListener('pointerup', () => { down = false; });
  vIn.oninput = () => { V = vIn.value / 100; pick(); };
  drawWheel(); const q0 = QUICK.find(q => q[1].kind === sel.kind && (sel.kind !== 'color' || q[1].hex === sel.hex)); if (q0) choose(Object.assign({}, q0[1]), q0[0]); else show();
  return { tone: retone, get: () => sel, set: s => { const q = QUICK.find(x => x[1].kind === s.kind && (s.kind !== 'color' || x[1].hex === s.hex)); choose(s, q ? q[0] : ''); } };
}
/* the games site and apps (2026-11-19): every <div class="np-host"></div> becomes the nail picker plus a Realistic / Classic hand switch, saved for the
   student (FSHand.setNails / setLook in hand.js); the natural and nude swatches follow the hand's skin tone */
function autoMount() {
  const hosts = Array.from(document.querySelectorAll('.np-host:not([data-np])')); if (!hosts.length || !window.FSHand || !window.FSHand.setNails) return;
  const pickers = [];
  hosts.forEach(el => { el.dataset.np = 1; const look = window.FSHand.look ? window.FSHand.look() : 'real';
    const wrap = document.createElement('div'); el.appendChild(wrap);
    if (look !== 'classic') pickers.push(mount(wrap, { value: window.FSHand.nails(), onChange: v => window.FSHand.setNails(v) }));
    else wrap.innerHTML = '<div class="np-head">The classic hand has no nails. Choose <b>Realistic</b> to pick nail colors.</div>';
    const sw = document.createElement('div'); sw.className = 'np-look'; sw.innerHTML = '<span>Hand:</span> <button type="button" data-l="real">Realistic</button> <button type="button" data-l="classic">Classic (smooth)</button>';
    sw.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.l === look); b.onclick = () => { if (b.dataset.l === look) return; window.FSHand.setLook(b.dataset.l); location.reload(); }; });
    el.appendChild(sw); });
  window.__npTone = hex => pickers.forEach(p => p.tone(hex));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount); else setTimeout(autoMount);
window.NailPick = { autoMount, mount, apply, QUICK, LENS, nudeFor };
})();
