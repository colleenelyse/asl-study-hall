/* Fingerspell to the Camera (2026-10-17). The camera hand-tracker (Google MediaPipe, running inside the browser) finds the 21 joints of the
   student's hand; we compare that hand to each letter. The letters come from Colleen's own 3D hand (hand.poseJoints), and "Teach it my hand"
   adds the student's own way of making a letter (kept in this browser only). The camera picture never leaves the computer. */
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), STILL = LETTERS.filter(c => c !== 'J' && c !== 'Z'), MOVING = { J: 1, Z: 1 };      /* J and Z move: they are read from the motion (readMotion), the others from the handshape */
const MODEL = 'https:' + '/' + '/storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM = 'https:' + '/' + '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HOLD = 6;      /* frames in a row the right letter must be read (short, so a right letter is accepted quickly; Colleen: no sitting at 99%) */

/* ---------- features: the hand's shape in its own frame (palm up the screen), plus which way it points ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function feat(P) {
  const w = P[0], up = sub(P[9], w), s = len(up) || 1, y = unit(up), across = sub(P[5], P[17]);
  const x = unit(sub(across, y.map(v => v * dot(across, y)))), z = cross(x, y), shape = [];
  for (let k = 1; k < 21; k++) { const d = sub(P[k], w); shape.push(dot(d, x) / s, dot(d, y) / s, dot(d, z) / s); }
  /* KEY DETAILS (Colleen: M read as E, N as T, R not read): where the thumb tip sits across the hand (0 = pinky side, 1 = pointer side) and how
     low it is, whether the thumb is in front of the fingers, and whether the pointer and middle fingertips cross (R) */
  const X = k => dot(sub(P[k], w), x) / s, Y = k => dot(sub(P[k], w), y) / s, Z = k => dot(sub(P[k], w), z) / s;
  const span = (X(5) - X(17)) || 0.001, thumbAcross = (X(4) - X(17)) / span, thumbLow = Y(4) - (Y(6) + Y(10)) / 2, thumbFront = Z(4) - (Z(6) + Z(10) + Z(14)) / 3;
  const crossed = (X(8) - X(12)) / span, tipsUp = (Y(8) + Y(12)) / 2 - Y(5);
  return { shape, orient: y.concat(z), key: [thumbAcross, thumbLow, thumbFront, crossed, tipsUp] };
}
const LOOSE = { D: 0.5, G: 0.35, H: 0.25, K: 0.45, P: 0.35, Q: 0.4, O: 0.5, C: 0.6 };      /* Colleen: D tricky; H worse than G; P a problem */      /* letters whose angle varies a lot from signer to signer (Colleen: G and H persnickety, K and Q need more flexible rotation) */
const KEYW = [1.3, 0.7, 0.6, 1.4, 0.4];      /* how much each key detail counts */
function dist(a, b, letter) {
  let s = 0, o = 0, k = 0; for (let i = 0; i < a.shape.length; i++) s += (a.shape[i] - b.shape[i]) ** 2;
  for (let i = 0; i < 6; i++) o += (a.orient[i] - b.orient[i]) ** 2;
  if (a.key && b.key) for (let i = 0; i < KEYW.length; i++) k += KEYW[i] * Math.abs(a.key[i] - b.key[i]);
  return Math.sqrt(s) + 1.2 * (LOOSE[letter] || 1) * Math.sqrt(o) + k;
}

/* ---------- letters from Colleen's hand, and the student's own ---------- */
const TPL = {};
let MINE = {}; try { MINE = JSON.parse(localStorage.getItem('fs-reader-mine') || '{}'); } catch (e) {}
const MINE_KEY = 'fs-reader-mine';
const saveMine = () => { try { localStorage.setItem('fs-reader-mine', JSON.stringify(MINE)); } catch (e) {} };
const rankModel = f => STILL.map(c => [c, TPL[c] ? dist(f, TPL[c], c) : 99]).sort((a, b) => a[1] - b[1]);      /* Colleen's hand only */
const nearModel = (f, c, n) => rankModel(f).slice(0, n).some(x => x[0] === c);      /* SAFEGUARD: is the hand at least close to Colleen's letter? */
/* K and P (and G and Q) are the same handshape; only the direction differs: P and Q point down. When both are in the running, the direction decides. */
const DOWNPAIRS = [['K', 'P', 0.4], ['G', 'Q', -0.45]];      /* [up letter, down letter, the direction that divides them: K points up, P forward-down; G sideways, Q down] */
function byDirection(R, f) {
  DOWNPAIRS.forEach(([up, dn, cut]) => { const down = f.orient[1] < cut; const iu = R.findIndex(x => x[0] === up), id = R.findIndex(x => x[0] === dn); if (iu < 0 || id < 0 || Math.min(iu, id) > 1) return;
    const want = down ? dn : up, other = down ? up : dn, iw = R.findIndex(x => x[0] === want), io = R.findIndex(x => x[0] === other);
    if (iw > io && R[iw][1] < R[io][1] * 1.6) { const t = R[iw]; R[iw] = R[io]; R[io] = t; const lo = Math.min(R[iw][1], R[io][1]); R[io][1] = lo; R[io][1] = Math.min(R[io][1], lo); } });
  return R;
}
function rank(f) { return byDirection(rankRaw(f), f); }
function rankRaw(f) {
  return STILL.map(c => { let d = TPL[c] ? dist(f, TPL[c], c) * 1.25 : 99; (MINE[c] || []).forEach(m => { d = Math.min(d, dist(f, m, c)); }); return [c, d]; }).sort((a, b) => a[1] - b[1]);
}

/* ---------- the camera ---------- */
let LEFT = false;
const camHand = P => P.map(p => [LEFT ? -p.x : p.x, -p.y, -p.z]);      /* the tracker's y points down; ours up. A left hand is mirrored so it matches the right-hand letters */
let landmarker = null, video = $('#rd-video'), draw = $('#rd-draw'), ctx = draw.getContext('2d'), lastT = -1, held = 0, cur = 0, done = false, lastF = null, teaching = 0, teachBuf = [];
async function start() {
  $('#rd-camsg').innerHTML = '<p>Starting the camera…</p>';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    video.srcObject = stream; await video.play();
  } catch (e) { $('#rd-camsg').innerHTML = '<p>The camera did not turn on. Check that this computer has a camera and that the browser is allowed to use it. Some school computers turn the camera off.</p>'; return; }
  $('#rd-camsg').innerHTML = '<p>Getting the hand reader ready…</p>';
  try {
    const files = await FilesetResolver.forVisionTasks(WASM);
    landmarker = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: 'VIDEO', numHands: 1 });
  } catch (e) { $('#rd-camsg').innerHTML = '<p>The hand reader could not load. Your school may block it; try again at home or ask your tech team.</p>'; return; }
  $('#rd-camsg').hidden = true; draw.width = video.videoWidth; draw.height = video.videoHeight; requestAnimationFrame(loop);
}
function loop() {
  requestAnimationFrame(loop);
  if (!landmarker || video.currentTime === lastT) return; lastT = video.currentTime;
  const r = landmarker.detectForVideo(video, performance.now());
  ctx.clearRect(0, 0, draw.width, draw.height);
  const nowT = performance.now(); if (!r.worldLandmarks || !r.worldLandmarks.length) { if (CK) CK.lastT = 0; $('#rd-guess').innerHTML = '<span>No hand</span>'; held = 0; $('#rd-hold').style.width = '0'; lastF = null; $('#rd-pct').hidden = true; $('#rd-tip').textContent = 'Hold your hand up where the camera can see it'; return; }
  const f = lastF = feat(camHand(r.worldLandmarks[0]));
  if (teaching) { teachBuf.push(f); if (--teaching === 0) finishTeach(); return; }
  if (CK && CK.on && !done) { if (CK.lastT) CK.t += nowT - CK.lastT; CK.lastT = nowT; ckTick(); if (!CK.on) return; }      /* the check's clock runs only while a hand is in view */
  const target0 = WORD ? WORD[wi] : LETTERS[cur];
  if (MOVING[target0]) { readMotion(target0, camHand(r.worldLandmarks[0]), r.landmarks[0], f); return; }
  MOT = [];
  const R = rank(f), target = target0;
  const T = (MINE[target] || []).concat(TPL[target] ? [TPL[target]] : []).sort((a, b) => dist(f, a, target) - dist(f, b, target))[0];      /* the closest version of the target letter */
  const dTgt = (R.find(x => x[0] === target) || [0, 99])[1];
  const right = (R[0][0] === target || (R.slice(0, 2).some(x => x[0] === target) && dTgt <= R[0][1] * 1.15)) && nearModel(f, target, 4), dT = T ? dist(f, T, target) : 9; if (right) lastD = dT;      /* fewer struggles (Colleen: S, H): the target also counts when it is a very close second */
  const pct = right ? 100 : Math.max(0, Math.min(90, Math.round(100 - dT * 18)));      /* the right letter shows 100% at once; anything else tops out at 90% (never stuck at 99%) */
  const hot = right || !T ? -1 : worstFinger(f, T); dots(r.landmarks[0], hot, right);
  $('#rd-pct').hidden = false; $('#rd-pct').style.setProperty('--p', pct); $('#rd-pct').innerHTML = '<span>' + pct + '%</span>'; $('#rd-tip').textContent = right ? 'Yes!' : T ? coach(f, T, hot) : '';
  $('#rd-guess').innerHTML = R.slice(0, 3).map((x, i) => '<span class="' + (i ? '' : 'top') + '">' + x[0] + '<small>' + Math.max(0, Math.round(100 - x[1] * 18)) + '% close</small></span>').join('');      /* the testing panel: top 3 guesses and how close each is */
  if (done) return;
  quickCheck(R, target, f, dTgt);
  oopsCheck(R, target, f);
  /* DOUBLE LETTERS (Colleen): the second of two same letters only counts after the hand slides to the side or bounces (opens a little and closes) */
  if (DBL) { const wx = r.landmarks[0][0].x; if (DBL.x0 === null) DBL.x0 = wx; if (Math.abs(wx - DBL.x0) > 0.05 || dT > DBL.d0 + 0.6) DBL.moved = true; if (!DBL.moved) { $('#rd-tip').textContent = 'Double letter: slide it or bounce it'; held = 0; $('#rd-hold').style.width = '0'; return; } }
  held = right ? held + 1 : Math.max(0, held - 2);      /* SAFEGUARD inside `right`: a letter the student taught still has to look close to the real handshape */ $('#rd-hold').style.width = Math.min(100, 100 * held / HOLD) + '%';
  if (held >= HOLD) { done = true; $('#rd-letter').classList.add('ok'); flash(target); ckRecord(target, true, 1);
    if (WORD) { setTimeout(() => { wi++; if (wi >= WORD.length) wordDone(); else showWord(); }, 700); }
    else setTimeout(nextLetter, 1100); }
}
/* the hand outline (drawn in dots()) */
const FING = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2F6BFF', GOOD = getComputedStyle(document.documentElement).getPropertyValue('--good').trim() || '#14804D';
function worstFinger(f, t) {      /* which finger is furthest from the target letter */
  let best = -1, worst = 0; FING.forEach((J, k) => { let e = 0; J.forEach(j => { const a = (j - 1) * 3; for (let q = 0; q < 3; q++) e += (f.shape[a + q] - t.shape[a + q]) ** 2; }); if (e > worst) { worst = e; best = k; } }); return worst > 0.05 ? best : -1;
}
function dots(L, hot, allGood) {      /* our own style: each finger its own soft color, round joints; the finger to fix glows in the accent; all green when right */
  const W = draw.width, Hh = draw.height, COL = ['#ffb86b', '#7fd1ff', '#b39dff', '#ff8fb1', '#8ee6a8'], P = i => [L[i].x * W, L[i].y * Hh];
  const line = (a, b, c, w) => { ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); };
  [[0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17]].forEach(([a, b]) => line(a, b, allGood ? GOOD : 'rgba(255,255,255,.55)', 3));      /* the palm */
  FING.forEach((J, k) => { const c = allGood ? GOOD : k === hot ? ACCENT : COL[k], w = allGood || k === hot ? 7 : 4; [J[0] === 1 ? 0 : J[0]].concat(J).reduce((a, b) => { if (a !== b) line(a, b, c, w); return b; });
    J.forEach(j => { ctx.beginPath(); ctx.arc(...P(j), k === hot ? 6 : 4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke(); }); });
}
const FNAME = ['thumb', 'pointer finger', 'middle finger', 'ring finger', 'pinky'];
function coach(f, t, hot) {      /* one short tip: which way the hand points or faces first, then the finger to fix */
  const dy = f.orient.slice(0, 3), ty = t.orient.slice(0, 3), dz = f.orient.slice(3), tz = t.orient.slice(3);
  if (dot(dy, ty) < 0.6) return ty[1] > 0.6 ? 'Point your fingers up' : ty[1] < -0.6 ? 'Point your fingers down' : 'Turn your fingers to the side';
  if (dot(dz, tz) < 0.4) return tz[2] > 0.5 ? 'Turn your palm toward the camera' : 'Turn your hand like the picture';
  return hot >= 0 ? 'Check your ' + FNAME[hot] : '';
}
/* ---------- "Oops, that's an M, not an N" (Colleen), and the mix-ups the student makes often ---------- */
let wrongL = '', wrongN = 0, oopsAt = 0;
let MIX = {}; try { MIX = JSON.parse(localStorage.getItem('fs-reader-mix') || '{}'); } catch (e) {}
function oopsCheck(R, target, f) {
  const top = R[0][0]; if (top === target || !nearModel(f, top, 1)) { wrongL = ''; wrongN = 0; return; }      /* only when the hand clearly looks like another letter */
  wrongN = top === wrongL ? wrongN + 1 : 1; wrongL = top;
  if (wrongN >= 14 && performance.now() - oopsAt > 2500) {
    oopsAt = performance.now(); wrongN = 0; const box = $('#rd-oops'); box.textContent = 'Oops, that’s ' + an(top) + ', not ' + an(target) + '.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 2600);
    const k = [target, top].sort().join(''); MIX[k] = (MIX[k] || 0) + 1; try { localStorage.setItem('fs-reader-mix', JSON.stringify(MIX)); } catch (e) {} drawMix();
  }
}
const an = c => ('AEFHILMNORSX'.includes(c) ? 'an ' : 'a ') + c;
const TIPS = { MN: 'M tucks the thumb under three fingers; N under two.', MS: 'M has the thumb tucked under the fingers; S crosses it in front.', NS: 'N has the thumb under two fingers; S crosses it in front.', ST: 'S crosses the thumb in front; T tucks it between two fingers.', AS: 'A keeps the thumb at the side; S crosses it in front.', AE: 'A keeps the thumb at the side; E curls the fingertips down over it.', ES: 'E curls the fingertips down; S makes a fist with the thumb in front.', RU: 'R crosses the two fingers; U keeps them side by side.', UV: 'U holds the fingers together; V spreads them apart.', KP: 'K and P are the same shape: K points up, P points down.', GH: 'G uses one finger, H uses two.', GQ: 'G points sideways; Q points down.', DI: 'D raises the pointer finger; I raises the pinky.', IY: 'I raises the pinky; Y adds the thumb.', CO: 'C is open like a C; O closes all the way.', MT: 'M tucks the thumb under three fingers; T between the first two.', NT: 'N tucks the thumb under two fingers; T between the first two.' };
function drawMix() {      /* targeted feedback: the pairs this student mixes up most */
  const L = Object.entries(MIX).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3), box = $('#rd-mix');
  box.hidden = !L.length; box.innerHTML = L.map(([k, n]) => '<p style="margin:0 0 6px">You often mix up <b>' + k[0] + '</b> and <b>' + k[1] + '</b>. ' + (TIPS[k] || 'Watch the difference closely.') + '</p>').join('') + (L.length ? '<button class="link" id="rd-mixclear" style="background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;text-decoration:underline;padding:0">Start fresh</button>' : '');
  const c = $('#rd-mixclear'); if (c) c.onclick = () => { MIX = {}; try { localStorage.removeItem('fs-reader-mix'); } catch (e) {} drawMix(); };
}

/* ---------- the letter to sign ---------- */
let refHand = null;
function go(k) {
  cur = (k + LETTERS.length) % LETTERS.length; done = false; held = 0; $('#rd-hold').style.width = '0';
  const c = LETTERS[cur]; $('#rd-letter').textContent = c; $('#rd-letter').classList.remove('ok');
  showRef(c); drawAlpha();
}
function drawAlpha() { $('#rd-alpha').innerHTML = LETTERS.map((c, i) => '<button class="' + (MINE[c] && MINE[c].length ? 'has ' : '') + (i === cur ? 'cur' : '') + '" data-i="' + i + '">' + c + '</button>').join(''); }
function finishTeach() {      /* SAFEGUARD (Colleen: new learners could teach it a mistake): only frames that already look close to Colleen's letter are kept */
  const c = LETTERS[cur], good = teachBuf.filter(f => nearModel(f, c, 3)); teachBuf = [];
  $('#rd-teachbtn').disabled = false; $('#rd-teachbtn').textContent = 'Teach this letter';
  if (good.length < 15) { $('#rd-status').textContent = 'That doesn\u2019t look close enough to ' + c + ' yet. Check the picture, then try again.'; return; }
  MINE[c] = (MINE[c] || []).concat(good).slice(-60); saveMine(); drawAlpha(); $('#rd-status').textContent = 'Learned your ' + c + '.';
}

/* ---------- word mode (Colleen): shorter words easier, longer harder; the student chooses the lengths and the word lists; after a word, Show me ---------- */
let WORD = null, wi = 0, lastD = 1;
const LENS = [['short', 'Short (3–4)', 3, 4], ['medium', 'Medium (5–6)', 5, 6], ['long', 'Long (7+)', 7, 99]];
const CATS = Object.keys(window.FS_WORDS || {});
const nice = k => k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ');
let WS = { lens: ['short'], cats: CATS.slice() }; try { Object.assign(WS, JSON.parse(localStorage.getItem('fs-reader-words') || '{}')); } catch (e) {}
const saveWS = () => { try { localStorage.setItem('fs-reader-words', JSON.stringify(WS)); } catch (e) {} };
function pool() {
  const lens = LENS.filter(l => WS.lens.includes(l[0])), out = new Set();
  WS.cats.forEach(k => (window.FS_WORDS[k] || []).forEach(w => { w = String(w).toUpperCase(); if (/^[A-Z]+$/.test(w) && lens.some(l => w.length >= l[2] && w.length <= l[3])) out.add(w); }));
  return [...out];
}
function chips(el, items, key) {
  el.innerHTML = items.map(([v, label]) => '<button class="' + (WS[key].includes(v) ? 'on' : '') + '" data-v="' + v + '">' + label + '</button>').join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; const a = WS[key], i = a.indexOf(b.dataset.v); if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(b.dataset.v); saveWS(); chips(el, items, key); count(); };
}
const count = () => { const n = pool().length; $('#rd-count').textContent = n ? n + ' words' : 'No words fit. Choose another length or list.'; };
/* ---------- J and Z (the letters that move) ---------- */
let MOT = [];      /* the last couple of seconds of the moving fingertip */
const ext = (P, tip, base) => len(sub(P[tip], P[base])) / (len(sub(P[9], P[0])) || 1);      /* how far a finger reaches out, for its size */
function readMotion(c, P, L, f) {
  const now = performance.now(), J = c === 'J';
  const zz = !J && WORD && WORD[wi + 1] === 'Z', bentV = zz && ext(P, 8, 5) > 0.6 && ext(P, 12, 9) > 0.67 && ext(P, 16, 13) < 0.66 && ext(P, 20, 17) < 0.62;      /* double Z (Colleen): two full Z's, or the slang bent V drawing one Z for both */
  const shapeOK = bentV || (J ? ext(P, 20, 17) > 0.62 && ext(P, 8, 5) < 0.66 && ext(P, 12, 9) < 0.68 : ext(P, 8, 5) > 0.7 && ext(P, 12, 9) < 0.68 && ext(P, 16, 13) < 0.66);      /* measured on Colleen's hand: a finger out reaches 0.7-0.95, a curled one 0.45-0.6 */      /* J: only the pinky out; Z: only the pointer out */
  const tip = L[J ? 20 : 8], sx = LEFT ? -1 : 1;
  if (shapeOK) MOT.push({ t: now, x: tip.x * sx, y: tip.y, z: f.orient.slice(3) }); MOT = MOT.filter(m => now - m.t < 2200);
  dots(L, shapeOK ? -1 : (J ? 4 : 1), false);
  $('#rd-guess').innerHTML = '<span class="top">' + (shapeOK ? (J ? 'I shape' : 'pointer out') : 'shape?') + '</span>';
  let prog = 0, ok = false;
  if (MOT.length > 6) {
    const a = MOT[0], b = MOT[MOT.length - 1], down = b.y - a.y, across = Math.abs(b.x - a.x);
    if (J) { const turn = Math.acos(Math.max(-1, Math.min(1, dot(a.z, b.z)))) * 57.3; prog = Math.min(1, Math.max(0, down) / 0.07) * 0.6 + Math.min(1, Math.max(across / 0.04, turn / 35)) * 0.4; ok = down > 0.06 && (across > 0.03 || turn > 30); }      /* J: the pinky goes down and hooks (moves across or the palm turns) */
    else { let rev = 0, dir = 0, lastX = a.x; MOT.forEach(m => { const d = m.x - lastX; if (Math.abs(d) > 0.025) { const sd = Math.sign(d); if (dir && sd !== dir) rev++; dir = sd; lastX = m.x; } }); const span = Math.max(...MOT.map(m => m.x)) - Math.min(...MOT.map(m => m.x));
      prog = Math.min(1, rev / 2) * 0.6 + Math.min(1, Math.max(0, down) / 0.05) * 0.2 + Math.min(1, span / 0.1) * 0.2; ok = rev >= 2 && down > 0.03 && span > 0.08; }      /* Z: across, back at an angle, across again: two turns, going down */
  }
  const pct = ok ? 100 : Math.round(prog * 90); $('#rd-pct').hidden = false; $('#rd-pct').style.setProperty('--p', pct); $('#rd-pct').innerHTML = '<span>' + pct + '%</span>';
  $('#rd-tip').textContent = ok ? 'Yes!' : !shapeOK ? (J ? 'Make an I (pinky up), then draw a J' : zz ? 'Draw two Z\u2019s, or one Z with a bent V' : 'Point your pointer finger, then draw a Z') : (J ? 'Draw a J: down, then hook' : 'Draw a Z in the air');
  if (ok && !done) { done = true; MOT = []; $('#rd-letter').classList.add('ok'); flash(c); $('#rd-hold').style.width = '100%';
    const step = bentV ? 2 : 1; if (bentV) flash('ZZ'); ckRecord(c, true, step);
    if (WORD) setTimeout(() => { wi += step; if (wi >= WORD.length) wordDone(); else showWord(); }, 700); else setTimeout(nextLetter, 1100); }
  else $('#rd-hold').style.width = (prog * 100) + '%';
}
/* ---------- CHECK (the diagnostic, Colleen): a fixed set, no hints, a time limit per letter (only while the hand is in view); every letter is
   recorded: signed or not yet, the seconds it took, and a letter signed quickly and confidently instead (a real mix-up, not a struggle).
   Inside ASL Study / the TpT sheet the results go to the student's Fingerspelling Stats as EXPRESSIVE. Nothing but these results is kept. ---------- */
const QS = new URLSearchParams(location.search), IN_SHEET = QS.get('embed') === 'aslstudy' && !!window.opener;
if (QS.get('embed') === 'aslstudy') { const m = document.getElementById('rd-safe-more'); if (m) m.textContent = 'The only thing your teacher gets is your score: which letters you signed and how long each one took.'; }
let CK = null;
const TL_FIXED = QS.has('tl') ? Math.max(0, Math.min(60, +QS.get('tl') || 0)) : null;      /* the teacher's time limit from the sheet's Settings */
const tlNow = () => TL_FIXED !== null ? TL_FIXED : +($('#rd-tl').value || 8);
const shuffleA = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function ckStart() {
  const words = !!WORD || $('#rd-mode .on').dataset.v === 'words';
  CK = { on: true, words, items: [], t: 0, lastT: 0, quickN: 0, quickL: '', quick: '', start: Date.now(), queue: words ? shuffleA(pool()).slice(0, 8) : shuffleA(LETTERS) };
  if (!CK.queue.length) { CK = null; $('#rd-status').textContent = 'No words fit. Choose another length or list.'; return; }
  document.body.classList.add('checking'); $('#rd-results').hidden = true; $('#rd-checkgo').hidden = true; $('#rd-ckbar').hidden = false; $('#rd-hint').checked = false;
  if (words) { CK.qi = 0; WORD = CK.queue[0]; wi = 0; showWord(); } else { CK.qi = 0; go(LETTERS.indexOf(CK.queue[0])); }
  ckBar();
}
function ckBar() { if (!CK) return; const total = CK.words ? CK.queue.length : 26, at = CK.qi + 1; $('#rd-ckpos').textContent = (CK.words ? 'Word ' : 'Letter ') + Math.min(at, total) + ' of ' + total; const L = tlNow(); $('#rd-cktime').style.width = L ? Math.min(100, CK.t / (L * 10)) + '%' : '0'; }
function ckTick() {
  ckBar(); const L = tlNow(); if (!L || CK.t < L * 1000) return;
  const c = WORD ? WORD[wi] : LETTERS[cur]; ckRecord(c, false, 1); done = true;      /* time is up: "not yet", on to the next */
  const box = $('#rd-oops'); box.textContent = 'Time’s up for ' + c + '. On to the next one.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 1600);
  if (WORD) setTimeout(() => { wi++; if (wi >= WORD.length) wordDone(); else showWord(); }, 600); else setTimeout(nextLetter, 600);
}
function ckRecord(c, ok, step) {
  if (!CK || !CK.on) return; const secs = Math.round(CK.t / 100) / 10;
  for (let k = 0; k < step; k++) CK.items.push({ c: k ? c : c, ok, secs: k ? 0 : secs, quick: k ? '' : CK.quick });
  CK.t = 0; CK.lastT = 0; CK.quick = ''; CK.quickN = 0; CK.quickL = '';
}
function quickCheck(R, target, f, dTgt) {      /* quick and confident (Colleen): early in the letter, held steady, clearly another letter */
  if (!CK || !CK.on || CK.quick) return; const top = R[0][0];
  if (top === target || CK.t > 3000 || !nearModel(f, top, 1) || R[0][1] > dTgt * 0.75) { CK.quickN = 0; return; }
  CK.quickN = top === CK.quickL ? CK.quickN + 1 : 1; CK.quickL = top; if (CK.quickN >= 8) CK.quick = top;
}
function nextLetter() {
  if (!CK || !CK.on) return go(cur + 1);
  CK.qi++; if (CK.qi >= CK.queue.length) return ckFinish(); go(LETTERS.indexOf(CK.queue[CK.qi])); ckBar();
}
function ckNextWord() { CK.qi++; if (CK.qi >= CK.queue.length) return ckFinish(); WORD = CK.queue[CK.qi]; wi = 0; showWord(); ckBar(); }
function ckFinish() {
  const C = CK; C.on = false; document.body.classList.remove('checking'); $('#rd-ckbar').hidden = true; $('#rd-checkgo').hidden = false; $('#rd-checkgo').textContent = 'Check again';
  const it = C.items, signed = it.filter(x => x.ok), slow = signed.filter(x => x.secs > 4), notYet = it.filter(x => !x.ok), quick = it.filter(x => x.quick);
  const avg = signed.length ? Math.round(signed.reduce((a, x) => a + x.secs, 0) / signed.length * 10) / 10 : 0;
  const per = {}; it.forEach(x => { const p = per[x.c] = per[x.c] || { ok: 0, n: 0, secs: 0 }; p.n++; if (x.ok) { p.ok++; p.secs += x.secs; } });
  const cls = c => { const p = per[c]; return !p.ok ? 'no' : p.secs / p.ok > 4 ? 'slow' : 'ok'; };
  $('#rd-results').innerHTML = '<h3>Your check</h3><div class="big">' + signed.length + ' of ' + it.length + '</div><p class="rd-small">letters signed' + (signed.length ? ', about ' + avg + ' seconds each' : '') + '</p>' +
    '<div class="lets">' + Object.keys(per).sort().map(c => '<span class="' + cls(c) + '">' + c + '</span>').join('') + '</div><p class="rd-small">Green: signed. Yellow: signed, but slow. Red: not yet.</p>' +
    (quick.length ? '<p><b>Quick mix-ups</b> (signed fast and sure, but a different letter):</p><ul>' + quick.map(x => '<li>' + an(x.quick).replace(/^an? /, '') + ' when asked for ' + x.c + '</li>').join('') + '</ul>' : '') +
    (notYet.length ? '<p><b>Not yet:</b> ' + [...new Set(notYet.map(x => x.c))].join(', ') + '. The camera can misread a hand, so ask your teacher to check these.</p>' : '<p><b>Every letter signed!</b></p>') +
    (IN_SHEET ? '<p class="rd-small" id="rd-sent">Saving to your class…</p>' : '');
  $('#rd-results').hidden = false;
  if (IN_SHEET) ckSend(C, it, signed, quick);
  CK = null; WORD = null; if (!C.words) go(0); else { $$('#rd-mode button').forEach(x => x.classList.toggle('on', x.dataset.v === 'words')); newWord(); }
}
function ckSend(C, it, signed, quick) {      /* to the games page that opened this tab, which passes it to ASL Study / the TpT sheet */
  const round = { type: 'fsp-cam-round', v: 1, kind: 'letters', game: 'camera', name: 'Fingerspell to the Camera', rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    n: it.length, right: signed.length, secs: Math.round((Date.now() - C.start) / 1000), speed: 1, lps: null, top: null, letters: signed.length, items: [],
    exp: { words: C.words ? 1 : 0, hand: LEFT ? 'left' : 'right', limit: tlNow(), items: it.slice(0, 200).map(x => [x.c, x.ok ? 1 : 0, x.secs, x.quick || '']) } };
  try { window.opener.postMessage(round, location.origin); $('#rd-sent').textContent = 'Saved to your class.'; } catch (e) { $('#rd-sent').textContent = 'Could not save: keep the ASL Study tab open and try again.'; }
}
$('#rd-kind').onclick = e => { const b = e.target.closest('button'); if (!b || (CK && CK.on)) return; $$('#rd-kind button').forEach(x => x.classList.toggle('on', x === b)); const ck = b.dataset.v === 'check';
  $('#rd-checkset').hidden = !ck; $('#rd-results').hidden = true; $('#rd-checkgo').hidden = false; $('#rd-checkgo').textContent = 'Start the check';
  $('#rd-checkabout').textContent = $('#rd-mode .on').dataset.v === 'words' ? '8 words from the words you chose. No hints. The time only runs while your hand is in view.' : 'All 26 letters, in a mixed order. No hints. The time only runs while your hand is in view.'; };
$('#rd-checkgo').onclick = ckStart;
if (TL_FIXED !== null) { $('#rd-tlwrap').innerHTML = 'Time per letter: ' + (TL_FIXED ? TL_FIXED + ' seconds' : 'no limit') + ' (set by your teacher)'; }
else { try { const v = localStorage.getItem('fs-reader-tl'); if (v !== null) $('#rd-tl').value = v; } catch (e) {} $('#rd-tl').onchange = () => { try { localStorage.setItem('fs-reader-tl', $('#rd-tl').value); } catch (e) {} }; }

function flash(c) {      /* a big green check on the camera, so it's obvious the letter was accepted (Colleen) */
  const f = $('#rd-flash'); f.textContent = '✓ ' + c; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
let DBL = null;
function showWord() {
  const c = WORD[wi]; DBL = wi > 0 && WORD[wi - 1] === c ? { x0: null, d0: lastD, moved: false } : null; done = false; held = 0; $('#rd-hold').style.width = '0'; $('#rd-letter').textContent = c; $('#rd-letter').classList.remove('ok'); $('#rd-word').classList.remove('alldone');
  $('#rd-word').innerHTML = WORD.split('').map((x, i) => '<span class="' + (i < wi ? 'd' : i === wi ? 'c' : 'n') + '">' + x + '</span>').join('');
  showRef(c);
}
function newWord() { const P = pool(); WORD = P.length ? P[Math.floor(Math.random() * P.length)] : 'CAT'; wi = 0; showWord(); }
let LAST = '';
function wordDone() {      /* all green, then straight on to the next word (Colleen); "Show me" stays for the word just spelled */
  done = true; LAST = WORD; const w = $('#rd-word'); w.innerHTML = WORD.split('').map(x => '<span class="d">' + x + '</span>').join(''); w.classList.add('alldone');
  const D = window.FS_DEFS || {}, k = Object.keys(D).find(x => x.toUpperCase().replace(/[^A-Z]/g, '') === LAST); const dv = $('#rd-def'); dv.hidden = !k; if (k) dv.textContent = '📖 ' + D[k];      /* what the word means (Colleen) */
  $('#rd-showbox').hidden = true; $('#rd-after').hidden = false; $('#rd-showme').textContent = '▶ Show me ' + LAST; $('#rd-status').textContent = 'You spelled ' + LAST + '!';
  setTimeout(() => { if (WORD === LAST && done) { if (CK && CK.on) ckNextWord(); else newWord(); } }, 1500);
}
async function showMe() {      /* the hand spells the word back, for clarity (Colleen) */
  if (!refHand || !LAST) return; const box = $('#rd-modelbox'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false; $('#rd-showme').disabled = true;
  try { await refHand.ready; await refHand.spell(LAST, { speed: () => 0.15 }); } finally { $('#rd-showme').disabled = false; }
}
function showRef(c) {      /* the handshape picture: only when "Show the handshape" is on (beginners); most of the time it just asks for the letter */
  const on = $('#rd-hint').checked; $('#rd-showbox').hidden = !on;
  if (on && refHand && refHand.chartImage) { try { $('#rd-ref').src = refHand.chartImage(c); } catch (e) {} }
}
$('#rd-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#rd-mode button').forEach(x => x.classList.toggle('on', x === b));
  const words = b.dataset.v === 'words'; $('#rd-prompt').hidden = !words; (words ? $('#rd-prompt') : $('.rd-target')).insertBefore($('#rd-word'), words ? null : $('#rd-letter')); $('#rd-letter').hidden = words; $('#rd-ask').hidden = words; $('#rd-word').hidden = !words;      /* the word sits right above the camera (Colleen) */ $('#rd-wordset').hidden = !words; document.querySelector('.rd-teach').hidden = words; $('#rd-after').hidden = true; $('#rd-modelbox').hidden = true;
  $('#rd-ask').textContent = words ? 'Spell this word' : 'Sign this letter'; if (words) newWord(); else { WORD = null; go(cur); } };
chips($('#rd-lens'), LENS.map(l => [l[0], l[1]]), 'lens'); chips($('#rd-cats'), CATS.map(k => [k, nice(k)]), 'cats'); count();
$('#rd-showme').onclick = showMe;
try { $('#rd-hint').checked = localStorage.getItem('fs-reader-hint') === '1'; } catch (e) {}
$('#rd-hint').onchange = () => { try { localStorage.setItem('fs-reader-hint', $('#rd-hint').checked ? '1' : '0'); } catch (e) {} showRef(WORD ? WORD[wi] || 'A' : LETTERS[cur]); };
drawMix();

/* ---------- set up ---------- */
const setHand = h => { LEFT = h === 'left'; document.body.classList.toggle('lefty', LEFT); $('#rd-handname').textContent = LEFT ? 'left' : 'right'; try { localStorage.setItem('fs-reader-hand', h); } catch (e) {} };
$$('[data-hand]').forEach(b => b.onclick = () => { setHand(b.dataset.hand); start(); });      /* asks first: right or left hand (Colleen) */
$('#rd-switch').onclick = () => setHand(LEFT ? 'right' : 'left');
$('#rd-skip').onclick = () => { if (WORD) { if (done) return newWord(); wi++; if (wi >= WORD.length) wordDone(); else showWord(); } else go(cur + 1); }; $('#rd-prev').onclick = () => { if (WORD) { if (wi > 0 && !done) { wi--; showWord(); } } else go(cur - 1); }; $('#rd-rand').onclick = () => { if (WORD) newWord(); else go(Math.floor(Math.random() * LETTERS.length)); };
$('#rd-alpha').onclick = e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); };
$('#rd-teachbtn').onclick = () => { if (!landmarker) return; if (MOVING[LETTERS[cur]]) { $('#rd-status').textContent = 'J and Z are read from the motion, so they don\u2019t need teaching.'; return; } teachBuf = []; teaching = 30; $('#rd-teachbtn').disabled = true; $('#rd-teachbtn').textContent = 'Hold still…'; };
$('#rd-forget').onclick = () => { delete MINE[LETTERS[cur]]; saveMine(); drawAlpha(); };
refHand = window.FSHand.create($('#rd-model'), {});
refHand.ready.then(() => { STILL.forEach(c => { const P = refHand.poseJoints(c); if (P) TPL[c] = feat(P); }); go(0); $('#rd-status').textContent = 'Ready: all 26 letters.'; });
window.READER = { ckStart, ckRecord, ckFinish, ck: () => CK, setWord: (w, i) => { WORD = w; wi = i; showWord(); }, at: () => [WORD, wi], TPL, MINE, feat, rank, dist, LETTERS, readMotion, MOT: () => MOT, setMOT: v => { MOT = v; }, pool, oopsCheck, MIX: () => MIX };      /* for testing */
