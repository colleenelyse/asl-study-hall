/* ---------- TEACH THE CAMERA: WORDS (teacher model, ASL Study 4.472, Colleen 2026-11-11) ----------
   "allow me to do this teach the camera repeatedly by prompting me with words to get additional models to help blend between letters by modeling how i do it".
   reader.html?samples=words&embed=aslstudy. A word is shown; when her hand is in view it counts 3-2-1 and records the whole word as dots (21 hand points
   per moment, with the time of each moment), and stops by itself when she holds the last letter still, drops her hand, or runs out of time. Then the
   next word comes up. Words are picked to cover letter pairs she has not modeled yet (a-b, b-c ...), so every word adds new transitions.
   Only the 21 dots are kept, never a picture or video. ASL Study saves them (teacher only) to the Words tab of her Camera Samples spreadsheet. */
(function () {
  const QS = new URLSearchParams(location.search); if (QS.get('samples') !== 'words') return;
  /* everyday words with many different letter pairs, then her fingerspelling word bank */
  const BASE = ('cat dog sun bus map jam fox owl yes zip box quiz jump kite play blue red green pink gray brown black white sky lake park bike ' +
    'milk cake soup rice taco pizza bread apple lemon grape juice water coffee tea snow rain wind fog hot cold warm cozy ' +
    'mom dad aunt uncle baby sister brother friend teacher school class desk book pen paper chair table phone laptop clock ' +
    'happy sad mad tired hungry funny lucky brave quick quiet lazy fuzzy jolly zany ' +
    'mexico texas ohio iowa utah idaho maine vermont kansas wyoming oklahoma chicago boston denver austin phoenix ' +
    'january march april june july august october november december monday friday weekend holiday ' +
    'pizza waffle yogurt bagel quilt jacket glove scarf boots socks hoodie zipper buckle ' +
    'gym art music math science history spanish german french band choir drama ' +
    'zebra koala panda tiger hippo llama walrus giraffe penguin squirrel rabbit kitten puppy monkey turkey ' +
    'jazz quartz fjord sphinx rhythm lynx oxygen wax vex hex jinx quack quirk squad equal query ' +
    'ivy jug kid lap mob nap orb pup rug sob tub urn van web yak zoo').split(' ');
  const bank = []; try { Object.values(window.FS_WORDS || {}).forEach(a => a.forEach(w => { if (!/[\s-]/.test(String(w).trim())) bank.push(w); })); } catch (e) {}      /* one-word entries only (no team or place names with spaces) */
  const ALL = [...new Set(BASE.concat(bank).map(w => String(w).toUpperCase().replace(/[^A-Z]/g, '')).filter(w => w.length >= 2 && w.length <= 12))];
  /* two- and three-word phrases (Colleen: "to record the appropriate way to indicate the end of the first word and the beginning of the next"): every 3rd prompt */
  const PH = ('ice cream|new york|hot dog|high school|best friend|good job|post office|zip code|fire truck|bus stop|lunch box|hot cocoa|french fries|' +
    'taco bell|red sox|las vegas|san diego|los angeles|el paso|st louis|lake michigan|happy birthday|thank you|see you|big mac|dr pepper|' +
    'salt lake city|new york city|big red dog|kansas city chiefs|green bay|jump rope|ping pong|fun fact|spring break|game day|rock band|' +
    'pop quiz|home run|yo yo|tic tac toe|old navy|six flags|true blue|ice age|wow wow wubbzy').split('|');
  const bankPh = []; try { Object.values(window.FS_WORDS || {}).forEach(a => a.forEach(w => { const p = String(w).trim().split(/\s+/); if (p.length >= 2 && p.length <= 3) bankPh.push(p.join(' ')); })); } catch (e) {}
  const PHRASES = [...new Set(PH.concat(bankPh).map(x => x.toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim()).filter(x => { const p = x.split(' '); return p.length >= 2 && p.length <= 3 && p.every(y => y.length >= 1 && y.length <= 12) && x.replace(/ /g, '').length <= 14; }))];
  const KEY = 'fsp-wsamp-v1', had = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })();
  const st = { pairs: had.pairs || {}, used: had.used || {}, pend: had.pend || [], n: had.n || 0, w: '', phase: 'wait', seen: 0, cool: 0, rec: [], t0: 0, lastT: 0, stillMs: 0, prev: null, msg: '', cd: 0, last: '' };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pairs: st.pairs, used: st.used, pend: st.pend.slice(-30), n: st.n })); } catch (e) {} };
  const pairsOf = w => { const out = []; for (let i = 1; i < w.length; i++) out.push(w[i - 1] + w[i]); return out; };
  const joins = x => { const p = x.split(' '), out = []; for (let i = 1; i < p.length; i++) out.push(p[i - 1].slice(-1) + '_' + p[i][0]); return out; };      /* the word-to-word moves */
  function pickPhrase() { let best = '', score = -1;
    PHRASES.forEach(x => { if (st.used[x]) return; const fresh = joins(x).filter(j => !st.pairs[j]).length + pairsOf(x.replace(/ /g, '')).filter(p => !st.pairs[p]).length * 0.3, sc = fresh * 6 + Math.random() * 5; if (sc > score) { score = sc; best = x; } });
    return best || PHRASES[Math.floor(Math.random() * PHRASES.length)]; }
  function pick() {      /* the word with the most letter pairs not modeled yet (a little randomness so it is not always the same order); every 3rd prompt a phrase */
    st.k = (st.k || 0) + 1; if (st.k % 3 === 0 && PHRASES.length) return pickPhrase();
    let best = '', score = -1;
    ALL.forEach(w => { if (st.used[w]) return; const ps = pairsOf(w), fresh = new Set(ps.filter(p => !st.pairs[p])).size, sc = fresh * 6 - Math.max(0, w.length - 7) * 9 - (w.length < 3 ? 6 : 0) + Math.random() * 5;      /* new letter pairs first, in everyday 3-7 letter words */ if (sc > score) { score = sc; best = w; } });
    if (!best) { st.used = {}; return pick(); }
    return best;
  }
  /* sending: kept on this computer until ASL Study says it is saved (same path as the letter samples) */
  function send() { const o = window.opener; if (!o || !st.pend.length) return; const msg = { type: 'fsp-cam-samples', v: 1, list: st.pend.slice(0, 2) };
    try { o.postMessage(msg, '*'); } catch (e) {} try { if (o.parent && o.parent !== o) o.parent.postMessage(msg, '*'); } catch (e) {} }
  addEventListener('message', e => { const d = e.data; if (!d || d.type !== 'fsp-cam-samples-ok' || !Array.isArray(d.sids)) return; st.pend = st.pend.filter(s => d.sids.indexOf(s.sid) < 0); save(); paint(); if (st.pend.length) send(); });
  setInterval(send, 4000);
  const mm = v => Math.round(v * 10000);
  function finish(why) {
    const r = st.rec; st.phase = 'wait'; st.cool = performance.now() + 1500; st.seen = 0;
    if (r.length < Math.max(10, st.w.replace(/ /g, '').length * 3)) { st.msg = '⚠️ ' + (why || 'Too short') + '. Keep your hand in view: it will try ' + st.w + ' again.'; paint(); return; }
    const k = Math.min(st.w.indexOf(' ') > 0 ? 140 : 100, r.length), sel = Array.from({ length: k }, (_, j) => r[Math.round(j * (r.length - 1) / (k - 1 || 1))]);      /* at most 100 moments, spread over the word */
    const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    st.pend.push({ sid, item: 'w:' + st.w.replace(/ /g, '_'), mv: 1, left: window.READER_LEFT ? 1 : 0, frames: sel.map(x => x.P), z: sel.map(x => Math.round(x.z * 100) / 100), t: sel.map(x => x.t), guess: [] });
    st.w.split(' ').forEach(x => pairsOf(x).forEach(p => { st.pairs[p] = (st.pairs[p] || 0) + 1; })); joins(st.w).forEach(j => { st.pairs[j] = (st.pairs[j] || 0) + 1; }); st.used[st.w] = 1; st.n++; st.last = st.w;
    st.msg = '✓ Saved ' + st.w + '. Next word!'; st.w = pick(); save(); send(); paint();
  }
  window.SAMP = {
    tick(P, f, _t, rank, left) {
      const nowT = performance.now(); window.READER_LEFT = !!left; const gap = st.lastT ? nowT - st.lastT : 0; st.lastT = nowT;
      if (st.phase === 'wait') { if (nowT < st.cool) return true; if (gap > 300 || !st.seen) st.seen = nowT; if (nowT - st.seen >= 700) { st.phase = 'count'; st.cd = nowT + 3000; st.msg = ''; paint(); } return true; }
      if (st.phase === 'count') { if (nowT >= st.cd) { st.phase = 'rec'; st.t0 = nowT; st.rec = []; st.stillMs = 0; st.prev = null; paint(); } return true; }
      if (st.phase === 'rec') {
        st.rec.push({ P: P.map(p => [mm(p[0]), mm(p[1]), mm(p[2])]), z: f.orient[5], t: Math.round(nowT - st.t0) });
        const d = st.prev ? f.shape.reduce((a, v, k) => a + Math.abs(v - st.prev.shape[k]), 0) / f.shape.length : 1; st.prev = f;
        st.stillMs = d < 0.03 && gap < 300 ? st.stillMs + gap : 0;
        const nl = st.w.replace(/ /g, '').length, nw = st.w.split(' ').length, el = nowT - st.t0, minT = 350 * nl + 700 * (nw - 1) + 300, maxT = 1100 * nl + 1500 * (nw - 1) + 3000;
        if ((el > minT && st.stillMs > (nw > 1 ? 1400 : 900)) || el > maxT) finish();      /* holding the last letter still ends it; a phrase needs a longer hold, so the pause between words never ends it */
        bar(Math.min(1, el / (650 * nl + 900 * (nw - 1) + 1200))); return true;
      }
      return true;
    }
  };
  setInterval(() => { if (st.phase === 'rec' && performance.now() - st.lastT > 700) finish('Your hand left the camera'); if (st.phase === 'count') paint(); }, 150);      /* dropping the hand also ends the word */
  /* the screen */
  document.body.classList.add('samp');
  const css = document.createElement('style');
  css.textContent = 'body.samp .rd-target>*:not(#sp),body.samp #rd-prompt,body.samp .rd-safe,body.samp #rd-pct,body.samp #rd-tip{display:none!important}' +
    '#sp{display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center}#sp .big{font:900 64px/1.05 var(--display,inherit);letter-spacing:.06em;overflow-wrap:anywhere}#sp .how{font-weight:800;font-size:18px;max-width:30ch}' +
    '#sp .bar{width:100%;height:12px;border-radius:8px;background:rgba(127,127,127,.25);overflow:hidden}#sp .bar i{display:block;height:100%;background:#FFC83D;width:0}' +
    '#sp .msg{font-weight:800;min-height:1.4em}#sp .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}#sp .cnt{font:900 64px/1 inherit;color:#FFC83D}#sp .safe{font-size:13px;opacity:.85;max-width:44ch}';
  document.head.appendChild(css);
  const box = document.querySelector('.rd-target'), el = document.createElement('div'); el.id = 'sp'; if (box) box.appendChild(el);
  const h1 = document.querySelector('h1'); if (h1) h1.textContent = 'Teach the Camera: words'; document.title = 'Teach the Camera: words';
  const intro = document.getElementById('rd-intro'); if (intro) intro.textContent = 'Your model: fingerspell each word at your natural speed. The moves between letters teach the camera (and the 3D signer) how letters blend.';
  function bar(p) { const b = document.getElementById('sp-p'); if (b) b.style.width = Math.round(100 * Math.max(0, Math.min(1, p || 0))) + '%'; }
  const covered = () => Object.keys(st.pairs).length;
  function paint() {
    if (!st.w) st.w = pick();
    const cnt = st.phase === 'count' ? Math.max(1, Math.ceil((st.cd - performance.now()) / 1000)) : 0;
    el.innerHTML = `<p style="margin:0;font-weight:800">${st.n} modeled · ${Object.keys(st.pairs).filter(k => k.indexOf('_') < 0).length} letter pairs · ${Object.keys(st.pairs).filter(k => k.indexOf('_') > 0).length} word breaks</p>
      <div class="big">${st.w.split(' ').join('<span style="opacity:.35"> · </span>')}</div>${st.w.indexOf(' ') > 0 && st.phase !== 'rec' ? '<p class="how" style="margin:0">A phrase: show the break between words your usual way.</p>' : ''}
      ${st.phase === 'count' ? `<div class="cnt">${cnt}</div>` : st.phase === 'rec' ? `<p class="how">● Fingerspell it now${st.w.indexOf(' ') > 0 ? ', showing where each word ends and the next begins the way you naturally do' : ''}. Hold the last letter still (or drop your hand) to finish.</p><div class="bar"><i id="sp-p" style="width:0"></i></div>` : `<p class="how" style="opacity:.8">Raise your hand: it counts 3, 2, 1 and records by itself.</p>`}
      <p class="msg" aria-live="polite">${st.msg}</p>
      <div class="row"><button class="btn ghost" id="sp-skip" type="button">Another word</button>${st.last ? `<button class="btn ghost" id="sp-redo" type="button">↺ Redo ${st.last}</button>` : ''}${st.phase === 'rec' ? '<button class="btn" id="sp-stop" type="button">Done with this word</button>' : ''}</div>
      <p class="safe" style="margin:0">Signing with your <b>${window.READER_LEFT ? 'left' : 'right'}</b> hand. <button id="sp-hand" type="button" style="background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Switch hands</button> · Stop any time: close this tab. Come back for more whenever you like.</p>
      <p class="safe">🔒 Only the positions of 21 dots on your hand are kept, no picture or video. Saved to the Words tab of your Camera Samples spreadsheet.${st.pend.length ? ' · Saving ' + st.pend.length + '…' : ''}</p>`;
    document.getElementById('sp-skip').onclick = () => { st.used[st.w] = 1; st.w = pick(); st.phase = 'wait'; st.msg = ''; st.cool = performance.now() + 600; save(); paint(); };
    const rd = document.getElementById('sp-redo'); if (rd) rd.onclick = () => { st.w = st.last; st.phase = 'wait'; st.cool = performance.now() + 800; st.msg = '↺ Sign ' + st.last + ' again: the new one is saved too.'; paint(); };
    const sp = document.getElementById('sp-stop'); if (sp) sp.onclick = () => finish();
    document.getElementById('sp-hand').onclick = () => { const b = document.getElementById('rd-switch'); if (b) b.click(); window.READER_LEFT = !window.READER_LEFT; paint(); };
  }
  addEventListener('keydown', e => { if (e.code === 'Space' && st.phase === 'rec') { e.preventDefault(); finish(); } });
  const fixSafe = () => document.querySelectorAll('p, div, span, small').forEach(e => { if (/nothing\s+is\s+(recorded|saved)/i.test(e.textContent) && !e.querySelector('p, div')) e.textContent = 'Then the camera turns on. Only the positions of 21 dots on your hand are saved: no picture or video.'; });
  fixSafe(); new MutationObserver(fixSafe).observe(document.body, { childList: true, subtree: true, characterData: true });
  paint(); if (st.pend.length) send();
})();
