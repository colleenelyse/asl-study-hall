/* ---------- TEACH THE CAMERA: camera samples (ASL Study 4.465, Colleen 2026-11-10) ----------
   "it could be helpful to get more samples of hands on the camera ... an assignment for students, to spell and count into the camera". Students sign
   A-Z, every number 0-30 (the teens and 20s each move or change shape) and both versions of 16-19, 23 and 25, once each. Only the 21 dots the hand
   tracker finds (fingertips, knuckles, wrist) are kept, as positions: never a picture or video. Each sample goes to the page that opened this tab
   (ASL Study), which saves it to her Camera Samples spreadsheet with the class period, not the name; the name is only for completion credit.
   Palm direction is strict (Colleen: "be strict about palm facing ... don't allow anything to be palm in that shouldn't be"): a sample with the
   palm the wrong way is not saved. reader.html?samples=1&embed=aslstudy. reader.js calls SAMP.tick(P, f, nowT, rank) for every frame with a hand. */
(function () {
  const QS = new URLSearchParams(location.search); if (QS.get('samples') !== '1') return;
  /* palm rules, from the palm's facing (f.orient[5]: about +1 toward the camera, about -1 toward the signer):
     out = facing out (reject anything below -0.15) · side = sideways or out, never in (reject below -0.35) · in = facing the signer (needs below -0.3)
     twist = starts in, ends out · endout = the last moment never palm in · '' = no rule (10's thumb) */
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => ({ id: c, show: c, how: c === 'J' ? 'with the movement' : c === 'Z' ? 'draw the Z' : '', mv: c === 'J' || c === 'Z', palm: /[GHPQ]/.test(c) ? 'side' : c === 'J' || c === 'Z' ? 'endout' : 'out' }));
  const N = [];
  for (let n = 0; n <= 30; n++) {
    if (n === 0) N.push({ id: '0', show: '0', how: '', mv: false, palm: 'side' });
    else if (n <= 5) N.push({ id: String(n), show: String(n), how: 'palm toward you', mv: false, palm: 'in' });
    else if (n <= 9) N.push({ id: String(n), show: String(n), how: 'palm out', mv: false, palm: 'out' });
    else if (n === 10) N.push({ id: '10', show: '10', how: 'thumbs up, shake', mv: true, palm: '' });
    else if (n <= 15) N.push({ id: String(n), show: String(n), how: 'palm toward you', mv: true, palm: 'in' });
    else if (n <= 19) { N.push({ id: n + 't', show: String(n), how: 'twist version: ' + (n - 10) + ', palm toward you, twist to palm out', mv: true, palm: 'twist' });
      N.push({ id: n + 'p', show: String(n), how: 'two-part version: 10 (thumbs up), then ' + (n - 10), mv: true, palm: 'endout' }); }
    else if (n === 23 || n === 25) { N.push({ id: n + 'f', show: String(n), how: 'formal: L, then ' + (n - 20), mv: true, palm: 'endout' });
      N.push({ id: n + 's', show: String(n), how: 'slang: ' + (n - 20) + ' with the middle finger wiggling', mv: true, palm: 'endout' }); }
    else N.push({ id: String(n), show: String(n), how: '', mv: true, palm: 'endout' });
  }
  const ITEMS = L.concat(N);      /* 26 + 37 = 63 */
  window.SAMP_ITEMS = ITEMS.map(x => ({ id: x.id, show: x.show, how: x.how, mv: x.mv, palm: x.palm }));
  const KEY = 'fsp-samp-v1', had = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })();
  const st = { done: had.done || {}, pend: had.pend || [], i: 0, phase: 'wait', hold: 0, prev: null, lastT: 0, rec: [], recT0: 0, msg: '', cd: 0 };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ done: st.done, pend: st.pend.slice(-80) })); } catch (e) {} };
  const nextI = from => { for (let k = 0; k < ITEMS.length; k++) { const j = (from + k) % ITEMS.length; if (!st.done[ITEMS[j].id]) return j; } return -1; };
  st.i = nextI(0);
  /* sending: kept on this computer until ASL Study says it is saved */
  function send() { const o = window.opener; if (!o || !st.pend.length) return; const msg = { type: 'fsp-cam-samples', v: 1, list: st.pend.slice(0, 6) };
    try { o.postMessage(msg, '*'); } catch (e) {} try { if (o.parent && o.parent !== o) o.parent.postMessage(msg, '*'); } catch (e) {} }
  addEventListener('message', e => { const d = e.data; if (!d || d.type !== 'fsp-cam-samples-ok' || !Array.isArray(d.sids)) return; st.pend = st.pend.filter(s => d.sids.indexOf(s.sid) < 0); save(); paint(); if (st.pend.length) send(); });
  setInterval(send, 4000);
  const mm = v => Math.round(v * 10000);      /* tenths of a millimeter */
  const enc = P => P.map(p => [mm(p[0]), mm(p[1]), mm(p[2])]);
  function palmOK(it, zs) {
    if (!zs.length) return 'Keep your hand in view';
    const last = zs.slice(-Math.max(1, Math.round(zs.length / 4))), avgLast = last.reduce((a, b) => a + b, 0) / last.length, min = Math.min.apply(null, zs), first = zs.slice(0, Math.max(1, Math.round(zs.length / 3)));
    const avg = zs.reduce((a, b) => a + b, 0) / zs.length;
    if (it.palm === 'out' && Math.min.apply(null, last) < -0.15) return 'Turn your palm out (toward the camera)';
    if (it.palm === 'side' && min < -0.35) return 'Don’t turn your palm toward you';
    if (it.palm === 'in' && avg > -0.3) return 'Turn your palm toward you';
    if (it.palm === 'twist' && (Math.min.apply(null, first) > -0.3 || avgLast < 0.15)) return 'Start palm toward you, then twist to palm out';
    if (it.palm === 'endout' && avgLast < -0.15) return 'End with your palm out (toward the camera)';
    return '';
  }
  function keep(it, frames, zs, guess) {
    const why = palmOK(it, zs); if (why) { if (st.msg.indexOf(why) < 0) { st.msg = '⚠️ ' + why + ', then try again.'; setTimeout(paint, 0); } return false; }
    const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    st.pend.push({ sid, item: it.id, mv: it.mv ? 1 : 0, left: window.READER_LEFT ? 1 : 0, frames, z: zs.map(z => Math.round(z * 100) / 100), guess: guess || [] });
    st.done[it.id] = 1; save(); send(); setTimeout(paint, 0); st.msg = '✓ Saved ' + it.show + (it.how ? ' (' + it.how.split(':')[0] + ')' : '') + '. Next one!'; st.i = nextI(st.i + 1); st.phase = 'wait'; st.hold = 0; st.prev = null; return true;
  }
  window.SAMP = {
    tick(P, f, _t, rank, left) {
      const it = ITEMS[st.i]; if (!it) return true; const nowT = performance.now(); window.READER_LEFT = !!left;
      const gap = st.lastT ? nowT - st.lastT : 0; st.lastT = nowT;
      if (!it.mv) {      /* still signs: hold steady 0.8 s, then 3 moments are kept */
        const d = st.prev ? f.shape.reduce((a, v, k) => a + Math.abs(v - st.prev.shape[k]), 0) / f.shape.length : 1; st.prev = f;
        if (gap > 300 || d > 0.035) { st.hold = 0; st.rec = []; } else st.hold += gap;
        st.rec.push({ P: enc(P), z: f.orient[5] }); if (st.rec.length > 6) st.rec.shift();
        if (st.hold >= 800 && st.rec.length >= 3) { const r3 = st.rec.slice(-3), g = rank ? rank(f).slice(0, 3).map(x => x[0]) : []; if (!keep(it, r3.map(x => x.P), r3.map(x => x.z), g)) { st.hold = 0; st.rec = []; } }
        bar(Math.min(1, st.hold / 800)); return true;
      }
      if (st.phase === 'count') { if (nowT >= st.cd) { st.phase = 'rec'; st.recT0 = nowT; st.rec = []; paint(); } return true; }
      if (st.phase === 'rec') {      /* moving signs: 2.5 s after the countdown, every frame with a hand */
        if (gap < 300) st.rec.push({ P: enc(P), z: f.orient[5] });
        if (nowT - st.recT0 >= 2500) { const r = st.rec; st.phase = 'wait';
          if (r.length < 8) { st.msg = '⚠️ The camera lost your hand. Tap Record and try again.'; paint(); }
          else { const k = 16, pick = Array.from({ length: Math.min(k, r.length) }, (_, j) => r[Math.round(j * (r.length - 1) / (Math.min(k, r.length) - 1 || 1))]); keep(it, pick.map(x => x.P), pick.map(x => x.z), []); } }
        if (st.phase === 'rec') bar((nowT - st.recT0) / 2500); else paint(); return true; }
      return true;
    }
  };
  /* the screen */
  document.body.classList.add('samp');
  const css = document.createElement('style');
  css.textContent = 'body.samp .rd-target>*:not(#sp),body.samp #rd-prompt,body.samp .rd-safe,body.samp #rd-pct,body.samp #rd-tip{display:none!important}' +
    '#sp{display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center}#sp .big{font:900 92px/1 var(--display,inherit)}#sp .how{font-weight:800;font-size:18px;max-width:28ch}' +
    '#sp .bar{width:100%;height:12px;border-radius:8px;background:rgba(127,127,127,.25);overflow:hidden}#sp .bar i{display:block;height:100%;background:#FFC83D;width:0}' +
    '#sp .msg{font-weight:800;min-height:1.4em}#sp .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}#sp .cnt{font:900 64px/1 inherit;color:#FFC83D}#sp .safe{font-size:13px;opacity:.85;max-width:40ch}';
  document.head.appendChild(css);
  const box = document.querySelector('.rd-target'), el = document.createElement('div'); el.id = 'sp'; if (box) box.appendChild(el);
  const h1 = document.querySelector('h1'); if (h1) h1.textContent = 'Teach the Camera'; document.title = 'Teach the Camera';
  const intro = document.getElementById('rd-intro'); if (intro) intro.textContent = 'Sign each letter and number so the camera can learn from real hands. Do your best signing: these help the camera read everyone better.';
  function bar(p) { const b = document.getElementById('sp-p'); if (b) b.style.width = Math.round(100 * Math.max(0, Math.min(1, p || 0))) + '%'; }
  function paint() {
    const n = ITEMS.filter(x => st.done[x.id]).length, it = ITEMS[st.i];
    if (!it) { el.innerHTML = `<div class="big">🎉</div><p class="how">All ${ITEMS.length} done. Thank you!</p><p class="msg">${st.pend.length ? 'Saving the last ones… keep this tab open a moment.' : '✓ Everything is saved. You can close this tab.'}</p>`; return; }
    const cnt = st.phase === 'count' ? Math.max(1, Math.ceil((st.cd - performance.now()) / 1000)) : 0;
    el.innerHTML = `<p style="margin:0;font-weight:800">${n} of ${ITEMS.length} done</p><div class="bar"><i style="width:${Math.round(100 * n / ITEMS.length)}%"></i></div>
      <div class="big">${it.show}</div><p class="how">${it.how ? it.how[0].toUpperCase() + it.how.slice(1) : it.mv ? 'With its movement' : 'Hold it still'}</p>
      ${it.mv ? (st.phase === 'count' ? `<div class="cnt">${cnt}</div>` : st.phase === 'rec' ? `<p class="how">● Sign it now</p><div class="bar"><i id="sp-p" style="width:0"></i></div>` : `<button class="btn" id="sp-rec" type="button">● Record (3, 2, 1, then sign it)</button>`)
        : `<p style="margin:0">Make the sign and hold it still until the bar fills.</p><div class="bar"><i id="sp-p" style="width:0"></i></div>`}
      <p class="msg" aria-live="polite">${st.msg}</p>
      <div class="row"><button class="btn ghost" id="sp-skip" type="button">Skip for now</button></div>
      <p class="safe" style="margin:0">Signing with your <b>${window.READER_LEFT ? 'left' : 'right'}</b> hand. <button class="link" id="sp-hand" type="button" style="background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Switch hands</button></p>
      <p class="safe">🔒 No picture or video is kept: only the positions of 21 dots on your hand. Your teacher sees which signs you finished.${st.pend.length ? ' · Saving ' + st.pend.length + '…' : ''}</p>`;
    const r = document.getElementById('sp-rec'); if (r) r.onclick = () => { st.phase = 'count'; st.cd = performance.now() + 3000; st.msg = ''; paint(); };
    document.getElementById('sp-hand').onclick = () => { const b = document.getElementById('rd-switch'); if (b) b.click(); window.READER_LEFT = !window.READER_LEFT; paint(); };
    document.getElementById('sp-skip').onclick = () => { st.msg = ''; st.phase = 'wait'; st.hold = 0; st.i = nextI(st.i + 1); paint(); };
  }
  addEventListener('keydown', e => { const it = ITEMS[st.i]; if (e.code === 'Space' && it && it.mv && st.phase === 'wait') { e.preventDefault(); st.phase = 'count'; st.cd = performance.now() + 3000; st.msg = ''; paint(); } });
  setInterval(() => { if (st.phase === 'count') paint(); }, 250);
  const fixSafe = () => document.querySelectorAll('p, div, span, small').forEach(e => { if (/nothing\s+is\s+(recorded|saved)/i.test(e.textContent) && !e.querySelector('p, div')) e.textContent = 'Then the camera turns on. Only the positions of 21 dots on your hand are saved: no picture or video.'; });      /* this activity does keep the dots */
  fixSafe(); new MutationObserver(fixSafe).observe(document.body, { childList: true, subtree: true, characterData: true });
  paint(); if (st.pend.length) send();
})();
