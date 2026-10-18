/* Fingerspell to the Camera (2026-10-17). The camera hand-tracker (Google MediaPipe, running inside the browser) finds the 21 joints of the
   student's hand; we compare that hand to each letter. The letters come from Colleen's own 3D hand (hand.poseJoints), and "Teach it my hand"
   adds the student's own way of making a letter (kept in this browser only). The camera picture never leaves the computer. */
import { FilesetResolver, HandLandmarker, FaceDetector } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), STILL = LETTERS.filter(c => c !== 'J' && c !== 'Z'), MOVING = { J: 1, Z: 1 };
/* NUMBERS (the number camera, 2026-10-17): 0-9, read from the handshape like the letters. SET is what is being signed now (letters or digits). */
const DIGITS = '0123456789'.split('');
let NUMS = false, SET = LETTERS, STILLSET = STILL;
const UNIT = () => NUMS ? 'number' : 'letter';      /* J and Z move: they are read from the motion (readMotion), the others from the handshape */
const MODEL = 'https:' + '/' + '/storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM = 'https:' + '/' + '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
let VFILES = null;
const HOLD = 300;      /* ms (Colleen, 2026-10-17): held on purpose, not a quick pass-through; 500 ms felt too long (E), so 300 */
const clock = () => window.__fakeNow !== undefined ? window.__fakeNow : performance.now();      /* tests can move time by hand */
let prevT = 0, EMA = 0, SKIP = 0;      /* still quick: no sitting at 99% (Colleen) */

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
const LOOSE = { D: 0.5, G: 0.35, H: 0.4, K: 0.45, P: 0.4, Q: 0.4, O: 0.5, C: 0.6 };      /* Colleen: D tricky; H worse than G; P a problem */      /* letters whose angle varies a lot from signer to signer (Colleen: G and H persnickety, K and Q need more flexible rotation) */
/* MUST-HAVES (Colleen, 2026-10-17: it accepted C for O, K for P, G for Q): the detail that tells a pair apart has to be there, however close
   the rest looks. Up-down = which way the fingers point (1 up, 0 level, -1 down); the gap = thumb tip to pointer fingertip, for the hand's size. */
const gapTI = f => { const s = f.shape, a = [s[9], s[10], s[11]], b = [s[21], s[22], s[23]]; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
const GATE = { K: [f => f.orient[1] > 0.55, 'Point your fingers up for K'], P: [f => f.orient[1] < 0.35, 'Point your fingers down for P'],
  G: [f => f.orient[1] > -0.4, 'Point your fingers to the side for G'], Q: [f => f.orient[1] < -0.45, 'Point your fingers down for Q'],
  O: [f => gapTI(f) < 0.26, 'Close your fingertips onto your thumb for O'], C: [f => gapTI(f) > 0.3, 'Leave a gap between your fingers and thumb for C'] };
const EASY = { S: 1.35, H: 1.3, P: 1.3 };      /* (Colleen, 2026-10-17) H: too picky about the turn; P: it's a P once it's low enough not to be a K */      /* letters the camera was too picky about (Colleen: S): they also count as a close second or third */
const KEYW = [1.3, 0.7, 0.6, 1.4, 0.4];      /* how much each key detail counts */
function dist(a, b, letter) {
  let s = 0, o = 0, k = 0; for (let i = 0; i < a.shape.length; i++) s += (a.shape[i] - b.shape[i]) ** 2;
  for (let i = 0; i < 6; i++) o += (a.orient[i] - b.orient[i]) ** 2;
  if (a.key && b.key) for (let i = 0; i < KEYW.length; i++) k += KEYW[i] * Math.abs(a.key[i] - b.key[i]);
  return Math.sqrt(s) + 1.2 * (LOOSE[letter] || 1) * Math.sqrt(o) + k;
}

/* ---------- letters from Colleen's hand, and the student's own ---------- */
const TPL = {}, ALT = {}, NOTNUM = {};      /* NOTNUM: shapes that are not numbers (a thumbs-up, the letters that don't look like a number), so they can't pass as one (Colleen: a thumbs-up passed as 1) */      /* ALT: a second way the same sign looks (1-5 palm out, as inside a bigger number) */
let MINE = {}; try { MINE = JSON.parse(localStorage.getItem('fs-reader-mine') || '{}'); } catch (e) {}
const MINE_KEY = 'fs-reader-mine';
const saveMine = () => { try { localStorage.setItem('fs-reader-mine', JSON.stringify(MINE)); } catch (e) {} };
const dModel = (f, c) => Math.min(TPL[c] ? dist(f, TPL[c], c) : 99, ALT[c] ? dist(f, ALT[c], c) : 99);
const rankModel = f => (NUMS ? DIGITS.map(c => [c, TPL[c] ? dist(f, TPL[c], c) : 99]).concat(Object.keys(ALT).map(c => [c + '*', dist(f, ALT[c], c)]), Object.keys(NOTNUM).map(c => ['~' + c, dist(f, NOTNUM[c], c)])) : STILLSET.map(c => [c, dModel(f, c)])).sort((a, b) => a[1] - b[1]);      /* Colleen's hand only */
const nearModel = (f, c, n) => rankModel(f).slice(0, n).some(x => x[0] === c);      /* SAFEGUARD: is the hand at least close to Colleen's letter? */
/* K and P (and G and Q) are the same handshape; only the direction differs: P and Q point down. When both are in the running, the direction decides. */
const DOWNPAIRS = [['K', 'P', 0.6], ['G', 'Q', -0.45]];      /* [up letter, down letter, the direction that divides them: K points up, P forward-down; G sideways, Q down] */
function byDirection(R, f) {
  DOWNPAIRS.forEach(([up, dn, cut]) => { const down = f.orient[1] < cut; const iu = R.findIndex(x => x[0] === up), id = R.findIndex(x => x[0] === dn); if (iu < 0 || id < 0 || Math.min(iu, id) > 1) return;
    const want = down ? dn : up, other = down ? up : dn, iw = R.findIndex(x => x[0] === want), io = R.findIndex(x => x[0] === other);
    if (iw > io && R[iw][1] < R[io][1] * 1.6) { const t = R[iw]; R[iw] = R[io]; R[io] = t; const lo = Math.min(R[iw][1], R[io][1]); R[io][1] = lo; R[io][1] = Math.min(R[io][1], lo); } });
  return R;
}
function rank(f) { return byDirection(rankRaw(f), f); }
function rankRaw(f) {
  if (NUMS) return DIGITS.map(c => { let d = TPL[c] ? dist(f, TPL[c], c) * 1.25 : 99; (MINE[c] || []).forEach(m => { d = Math.min(d, dist(f, m, c)); }); return [c, d]; })
    .concat(Object.keys(ALT).map(c => [c + '*', dist(f, ALT[c], c) * 1.25]), Object.keys(NOTNUM).map(c => ['~' + c, dist(f, NOTNUM[c], c) * 1.25])).sort((a, b) => a[1] - b[1]);      /* NUMBERS (Colleen): the palm has to face the right way; 1-5 alone face you, so a palm-out 3 is "3*", not 3 */
  return STILLSET.map(c => { let d = dModel(f, c) * 1.25; (MINE[c] || []).forEach(m => { d = Math.min(d, dist(f, m, c)); }); return [c, d]; }).sort((a, b) => a[1] - b[1]);
}

/* ---------- the camera ---------- */
let LEFT = false;
const camHand = P => P.map(p => [LEFT ? -p.x : p.x, -p.y, -p.z]);      /* the tracker's y points down; ours up. A left hand is mirrored so it matches the right-hand letters */
let landmarker = null, video = $('#rd-video'), draw = $('#rd-draw'), ctx = draw.getContext('2d'), lastT = -1, held = 0, cur = 0, done = false, lastF = null, teaching = 0, teachBuf = [];
const WANT_GAME = (new URLSearchParams(location.search).get('g') || '').replace(/[^a-z]/g, '');      /* a camera game card on the games page opens straight into it */
async function start() {
  $('#rd-camsg').innerHTML = '<p>Starting the camera…</p>';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    video.srcObject = stream; await video.play();
  } catch (e) { $('#rd-camsg').innerHTML = '<p>The camera did not turn on. Check that this computer has a camera and that the browser is allowed to use it. Some school computers turn the camera off.</p>'; return; }
  $('#rd-camsg').innerHTML = '<p>Getting the hand reader ready…</p>';
  try {
    const files = VFILES = await FilesetResolver.forVisionTasks(WASM);
    const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numHands: 1 });
    try { landmarker = await HandLandmarker.createFromOptions(files, opts('GPU')); } catch (g) { landmarker = await HandLandmarker.createFromOptions(files, opts('CPU')); }      /* SPEED (a class of Chromebooks at once): the graphics chip when there is one, else the processor */
  } catch (e) { $('#rd-camsg').innerHTML = '<p>The hand reader could not load. Your school may block it; try again at home or ask your tech team.</p>'; return; }
  $('#rd-camsg').hidden = true; draw.width = video.videoWidth; draw.height = video.videoHeight; requestAnimationFrame(loop);
  if (WANT_GAME && (NUMS ? NGAMES : LGAMES).some(g => g[0] === WANT_GAME)) { const gb = document.querySelector('#rd-kind [data-v="games"]'); if (gb) gb.click(); refHand.ready.then(() => startGame(WANT_GAME)); }
}
function loop() {
  requestAnimationFrame(loop);
  if (!landmarker || video.currentTime === lastT || document.hidden) return; lastT = video.currentTime;
  if (SKIP > 0) { SKIP--; return; }      /* SPEED: a slow device reads fewer frames instead of falling behind (holds are timed in ms, so nothing gets harder) */
  const t0 = performance.now(), r = landmarker.detectForVideo(video, t0); EMA = EMA * 0.9 + (performance.now() - t0) * 0.1; SKIP = EMA > 60 ? 2 : EMA > 35 ? 1 : 0;
  ctx.clearRect(0, 0, draw.width, draw.height);
  const nowT = clock(); if (!r.worldLandmarks || !r.worldLandmarks.length) { if (CK) CK.lastT = 0; $('#rd-guess').innerHTML = '<span>No hand</span>'; held = 0; $('#rd-hold').style.width = '0'; lastF = null; $('#rd-pct').hidden = true; $('#rd-tip').textContent = 'Hold your hand up where the camera can see it'; return; }
  const f = lastF = feat(camHand(r.worldLandmarks[0]));
  if (teaching) { teachBuf.push(f); if (--teaching === 0) finishTeach(); return; }
  if (CK && CK.on && !done) { if (CK.lastT) CK.t += nowT - CK.lastT; CK.lastT = nowT; ckTick(); if (!CK.on) return; }      /* the check's clock runs only while a hand is in view */
  if (GAME && GAME.pace) { paceRead(f, r.landmarks[0]); return; }      /* Speed Pacer: forgiving, timed by the pacer */
  if (GAME && GAME.free) { freeRead(f, r.landmarks[0]); return; }      /* Hangman, Wordle: any letter, no target */
  const target0 = WORD ? WORD[wi] : SET[cur];
  if (MOVING[target0]) { readMotion(target0, camHand(r.worldLandmarks[0]), r.landmarks[0], f); return; }
  if (NUMS && String(target0)[0] === 'a') { ageRead(target0, f, r.landmarks[0], nowT); return; }
  if (NUMS && String(target0).length > 1) { seqRead(target0, f, r.landmarks[0]); return; }
  if (WORD) { const L0 = r.landmarks[0], sz = Math.hypot(L0[9].x - L0[0].x, L0[9].y - L0[0].y); BOUNCE.push({ y: L0[0].y, s: sz }); if (BOUNCE.length > 240) BOUNCE.shift(); }
  MOT = [];
  const R = rank(f), target = target0;
  const T = (MINE[target] || []).concat(TPL[target] ? [TPL[target]] : []).sort((a, b) => dist(f, a, target) - dist(f, b, target))[0];      /* the closest version of the target letter */
  const dTgt = (R.find(x => x[0] === target) || [0, 99])[1];
  const easy = EASY[target], gate = GATE[target], gateOK = !gate || gate[0](f), AIM = TPL[target] || T, aimOK = !AIM || (dot(f.orient.slice(0, 3), AIM.orient.slice(0, 3)) >= 0.7 && dot(f.orient.slice(3), AIM.orient.slice(3)) >= 0.2), right = gateOK && aimOK && (R[0][0] === target || (R.slice(0, easy ? 3 : 2).some(x => x[0] === target) && dTgt <= R[0][1] * (easy || 1.15))) && nearModel(f, target, NUMS ? 3 : 4), dT = T ? dist(f, T, target) : 9; if (right) lastD = dT;      /* fewer struggles (Colleen: S, H): the target also counts when it is a very close second */
  const pct = right ? 100 : Math.max(0, Math.min(90, Math.round(100 - dT * 18)));      /* the right letter shows 100% at once; anything else tops out at 90% (never stuck at 99%) */
  const hot = right || !T ? -1 : worstFinger(f, T); dots(r.landmarks[0], hot, right);
  const palmWrong = NUMS && !right && R[0][0] === target + '*';      /* the right number, the palm the wrong way */
  $('#rd-pct').hidden = false; $('#rd-pct').style.setProperty('--p', pct); $('#rd-pct').innerHTML = '<span>' + pct + '%</span>'; $('#rd-tip').textContent = right ? 'Yes!' : !gateOK ? gate[1] : palmWrong ? 'Turn your palm toward you' : T ? coach(f, T, hot) : '';
  $('#rd-guess').innerHTML = R.slice(0, 3).map((x, i) => '<span class="' + (i ? '' : 'top') + '">' + (x[0][0] === '~' ? 'not a number (' + x[0].slice(1) + ')' : x[0].replace('*', ' palm out')) + '<small>' + Math.max(0, Math.round(100 - x[1] * 18)) + '% close</small></span>').join('');      /* the testing panel: top 3 guesses and how close each is */
  if (done) return;
  quickCheck(R, target, f, dTgt);
  oopsCheck(R, target, f);
  /* DOUBLE LETTERS (Colleen): the second of two same letters only counts after the hand slides to the side or bounces (opens a little and closes) */
  if (DBL) { const wx = r.landmarks[0][0].x; if (DBL.x0 === null) DBL.x0 = wx; if (Math.abs(wx - DBL.x0) > 0.05 || dT > DBL.d0 + 0.6) DBL.moved = true; if (!DBL.moved) { $('#rd-tip').textContent = 'Double letter: slide it or bounce it'; held = 0; $('#rd-hold').style.width = '0'; return; } }
  const dt = Math.min(100, prevT ? nowT - prevT : 33); prevT = nowT;
  held = right ? held + dt : Math.max(0, held - dt);      /* a one-frame misread only takes a little off (not a restart) */      /* SAFEGUARD inside `right`: a letter the student taught still has to look close to the real handshape */ $('#rd-hold').style.width = Math.min(100, 100 * held / HOLD) + '%';
  if (held >= HOLD && WORD && !DBL && bouncy()) { done = true; return stopBounce(); }
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
  if (dot(dy, ty) < 0.7) return ty[1] > 0.6 ? 'Point your fingers up' : ty[1] < -0.6 ? 'Point your fingers down' : 'Turn your fingers to the side';
  if (dot(dz, tz) < 0.2) return tz[2] > 0.5 ? 'Turn your palm toward the camera' : tz[2] < -0.5 ? 'Turn your palm toward you' : 'Turn your palm to face sideways';      /* says which way (Colleen: there may be no picture) */
  return hot >= 0 ? 'Check your ' + FNAME[hot] : '';
}
/* ---------- "Oops, that's an M, not an N" (Colleen), and the mix-ups the student makes often ---------- */
let wrongL = '', wrongN = 0, oopsAt = 0;
let MIX = {}; try { MIX = JSON.parse(localStorage.getItem('fs-reader-mix') || '{}'); } catch (e) {}
function oopsCheck(R, target, f) {
  const top = R[0][0]; if (top === target || top.endsWith('*') || top[0] === '~' || !nearModel(f, top, 1)) { wrongL = ''; wrongN = 0; return; }      /* only when the hand clearly looks like another letter */
  wrongN = top === wrongL ? wrongN + 1 : 1; wrongL = top;
  if (wrongN >= 14 && performance.now() - oopsAt > 2500) {
    oopsAt = performance.now(); wrongN = 0; const box = $('#rd-oops'); box.textContent = 'Oops, that’s ' + an(top) + ', not ' + an(target) + '.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 2600);
    const k = [target, top].sort().join(''); MIX[k] = (MIX[k] || 0) + 1; try { localStorage.setItem('fs-reader-mix', JSON.stringify(MIX)); } catch (e) {} drawMix();
  }
}
const an = c => (/^[AEFHILMNORSX8]$/.test(c) ? 'an ' : 'a ') + c;
const TIPS = { MN: 'M tucks the thumb under three fingers; N under two.', MS: 'M has the thumb tucked under the fingers; S crosses it in front.', NS: 'N has the thumb under two fingers; S crosses it in front.', ST: 'S crosses the thumb in front; T tucks it between two fingers.', AS: 'A keeps the thumb at the side; S crosses it in front.', AE: 'A keeps the thumb at the side; E curls the fingertips down over it.', ES: 'E curls the fingertips down; S makes a fist with the thumb in front.', RU: 'R crosses the two fingers; U keeps them side by side.', UV: 'U holds the fingers together; V spreads them apart.', KP: 'K and P are the same shape: K points up, P points down.', GH: 'G uses one finger, H uses two.', GQ: 'G points sideways; Q points down.', DI: 'D raises the pointer finger; I raises the pinky.', IY: 'I raises the pinky; Y adds the thumb.', CO: 'C is open like a C; O closes all the way.', MT: 'M tucks the thumb under three fingers; T between the first two.', NT: 'N tucks the thumb under two fingers; T between the first two.',
  '23': '2 is two fingers; 3 adds the thumb.', '45': '4 tucks the thumb in; 5 opens it too.', '12': '1 is one finger; 2 is two.', '34': '3 is the thumb and two fingers; 4 is four fingers, thumb in.', '06': '0 curls every finger into the thumb; 6 touches only the pinky.', '09': '0 curls every finger into the thumb; 9 touches only the pointer finger.' };
{ const TOUCH = { 6: 'the pinky', 7: 'the ring finger', 8: 'the middle finger', 9: 'the pointer finger' }; for (let a = 6; a <= 9; a++) for (let b = a + 1; b <= 9; b++) TIPS['' + a + b] = a + ' touches the thumb to ' + TOUCH[a] + '; ' + b + ' to ' + TOUCH[b] + '.'; }
function drawMix() {      /* targeted feedback: the pairs this student mixes up most */
  const L = Object.entries(MIX).filter(x => x[1] >= 3 && /^\d+$/.test(x[0]) === NUMS).sort((a, b) => b[1] - a[1]).slice(0, 3), box = $('#rd-mix');
  box.hidden = !L.length; box.innerHTML = L.map(([k, n]) => '<p style="margin:0 0 6px">You often mix up <b>' + k[0] + '</b> and <b>' + k[1] + '</b>. ' + (TIPS[k] || 'Watch the difference closely.') + '</p>').join('') + (L.length ? '<button class="link" id="rd-mixclear" style="background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;text-decoration:underline;padding:0">Start fresh</button>' : '');
  const c = $('#rd-mixclear'); if (c) c.onclick = () => { MIX = {}; try { localStorage.removeItem('fs-reader-mix'); } catch (e) {} drawMix(); };
}

/* ---------- the letter to sign ---------- */
let refHand = null;
function go(k) {
  cur = (k + SET.length) % SET.length; done = false; held = 0; $('#rd-hold').style.width = '0';
  AGE = null;
  const c = SET[cur]; $('#rd-letter').textContent = GAME && GAME.mask ? '?' : NUMS ? numText(c) : c; $('#rd-letter').classList.toggle('long', NUMS && numText(c).length > 4); $('#rd-letter').classList.remove('ok'); SEQ = null;
  const sn = $('#rd-shownum'); if (sn) sn.hidden = !NUMS || c.length < 2; $('#rd-modelbox').hidden = true;
  showRef(c); drawAlpha();
}
function drawAlpha() { $('#rd-alpha').innerHTML = SET.map((c, i) => '<button class="' + (MINE[c] && MINE[c].length ? 'has ' : '') + (i === cur ? 'cur' : '') + '" data-i="' + i + '">' + c + '</button>').join(''); }
function finishTeach() {      /* SAFEGUARD (Colleen: new learners could teach it a mistake): only frames that already look close to Colleen's letter are kept */
  const c = SET[cur], M = TPL[c], good = teachBuf.filter(f => nearModel(f, c, 3) && (!M || (dot(f.orient.slice(0, 3), M.orient.slice(0, 3)) >= 0.7 && dot(f.orient.slice(3), M.orient.slice(3)) >= 0.2))); teachBuf = [];      /* it can't learn a turned-around hand (Colleen: palm toward the signer) */
  $('#rd-teachbtn').disabled = false; $('#rd-teachbtn').textContent = 'Teach this ' + UNIT();
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
/* ---------- NUMBERS THAT MOVE (2026-10-17): 10 and up, read as the hand's key moments in order, from Colleen's locked animations in hand.js.
   Every way she signs a number counts (23 and 25 both ways, 16-19 both ways, hundreds into a C or a curl). Rocking numbers must rock the
   right way: 67 rocks up into the 7, 76 rocks down into the 6. ---------- */
const sample = (k, f) => { const o = new Set(); for (let i = 0; i < k * 3 && o.size < k; i++) o.add(f()); return [...o]; }, rndPick = a => a[Math.floor(Math.random() * a.length)];
const ROCK = new Set([67, 68, 69, 76, 78, 79, 86, 87, 89, 96, 97, 98]);
const range = (a, b) => { const o = []; for (let n = a; n <= b; n++) o.push(n); return o; };
const NSETS = [['d', '0–9', range(0, 9)], ['teen', '10–19', range(10, 19)], ['twenty', '20–29', range(20, 29)], ['tens', 'Tens (30–90)', range(3, 9).map(d => d * 10)],
  ['two', 'Other two-digit numbers', range(31, 99).filter(n => n % 10 && n % 11 && !ROCK.has(n))], ['rock', 'Rocking numbers', [...ROCK]], ['dbl', 'Doubles (22–99)', range(2, 9).map(d => d * 11)], ['hund', 'Hundreds (100–900)', range(1, 9).map(d => d * 100)],
  ['big', '101–999', sample(40, () => { let n; do { n = 101 + Math.floor(Math.random() * 899); } while (n % 100 === 0); return n; })],
  ['thou', 'Thousands', sample(40, () => rndPick([1000 * (1 + Math.floor(Math.random() * 99)), 1000 + Math.floor(Math.random() * 98999), 100000 + 1000 * Math.floor(Math.random() * 900)]))],
  ['mil', 'Millions', sample(30, () => 1e6 * (1 + Math.floor(Math.random() * 20)) + rndPick([0, 0, 500000, 250000, 1000 * Math.floor(Math.random() * 999)]))],
  ['age', 'Ages', sample(36, () => 'a' + rndPick([1 + Math.floor(Math.random() * 9), 10 + Math.floor(Math.random() * 10), 20 + Math.floor(Math.random() * 80)]))],
  ['year', 'Years', sample(40, () => 'y' + rndPick([1492, 1776, 1865, 1906, 1900, 1969, 1999, 2000, 2005, 2008, 1000 + Math.floor(Math.random() * 1100)]))]];      /* every number (Colleen): big numbers are read in parts, in spoken order */
let NS = ['d']; try { const v = JSON.parse(localStorage.getItem('fs-reader-nsets') || 'null'); if (Array.isArray(v) && v.length) NS = v.filter(k => NSETS.some(x => x[0] === k)); if (!NS.length) NS = ['d']; } catch (e) {}
const nPool = () => { const out = []; NSETS.forEach(x => { if (NS.includes(x[0])) x[2].forEach(n => out.push(String(n))); }); return out; };
const onlyDigits = () => NS.length === 1 && NS[0] === 'd';
function numChips() {
  const el = $('#rd-nsets'); if (!el) return;
  el.innerHTML = NSETS.map(([k, label]) => '<button class="' + (NS.includes(k) ? 'on' : '') + '" data-v="' + k + '">' + label + '</button>').join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b || (CK && CK.on)) return; const i = NS.indexOf(b.dataset.v); if (i >= 0) { if (NS.length > 1) NS.splice(i, 1); } else NS.push(b.dataset.v); try { localStorage.setItem('fs-reader-nsets', JSON.stringify(NS)); } catch (x) {} numChips(); if (NUMS) { SET = onlyDigits() ? DIGITS : shuffleA(nPool()); go(0); ckAbout(); } };
}
function nHint(n) {      /* one short reminder of the movement */
  if (String(n)[0] === 'a') { const a = +String(n).slice(1); return a <= 9 ? a + ' palm out, pointer finger on your chin, then push down and forward' : '1 on your chin, then push forward into the ' + a; }
  { const P = partsFor(n); if (P.length > 1) return 'In parts: ' + P.map(p => p.v === 'T' ? 'THOUSAND' : p.v === 'M' ? 'MILLION' : p.v).join(', '); }
  n = +n; if (n === 10) return 'Thumb up, then twist it'; if (n <= 12) return 'Flick ' + (n === 11 ? 'the finger' : 'the fingers') + ' up from the thumb'; if (n <= 15) return 'Bend the fingers down, twice';
  if (n <= 19) return '10, then flick into the ' + (n - 10) + ' (or twist the ' + (n - 10) + ')'; if (n === 20) return 'Pinch: thumb and pointer, twice'; if (n === 21) return 'L, then bend the thumb';
  if (n === 23 || n === 25) return 'Bend the middle finger twice, or L into the ' + (n - 20); if (n < 30 && n !== 22) return 'L, then slide into the ' + (n - 20);
  if (n % 11 === 0 && n < 100) return 'Place it, lift, place it again'; if (n >= 100) return n / 100 + ', then pull back into a C (or curl the fingers)'; if (n % 10 === 0) return n / 10 + ', then close into a 0';
  if (ROCK.has(n)) { const a = Math.floor(n / 10), b = n % 10; return 'Rock ' + (b > a ? 'up' : 'down') + ' into the ' + b; }
  return 'Slide into the ' + (n % 10);
}
const KEYS = {}, DECOY = {}, SQ = 0.6;
/* spoken order (Colleen's rules): 347 = 300, 47; 1,250 = 1, THOUSAND, 200, 50; never an unspoken zero */
function tokensFor(n) { if (n >= 1e6) { const m = Math.floor(n / 1e6), r = n % 1e6; return tokensFor(m).concat(['M'], r ? tokensFor(r) : []); } if (n >= 1000) { const t = Math.floor(n / 1000), r = n % 1000; return tokensFor(t).concat(['T'], r ? tokensFor(r) : []); } if (n >= 100) { const h = Math.floor(n / 100), r = n % 100; return [h * 100].concat(r ? [r] : []); } return [n]; }
function partsFor(t) {
  t = String(t);
  if (t[0] === 'y') { const yp = refHand && refHand.yearParts ? refHand.yearParts(+t.slice(1)) : null; return (yp || []).map(([v]) => ({ v, o: { series: true, tenOnly: true } })); }      /* years: 16-19 only as 10 + number */
  const tok = tokensFor(+t); return tok.map(v => ({ v, o: { series: tok.length > 1 } }));
}
const numText = t => { t = String(t); return t[0] === 'a' ? 'Age ' + t.slice(1) : t[0] === 'y' ? t.slice(1) : t.length > 3 ? Number(t).toLocaleString('en-US') : t; };      /* SQ: key moments closer than this count as one */
const roll = f => Math.atan2(f.orient[0], f.orient[1]) * 57.3;      /* how far the fingers lean, side to side, as the camera sees it */
function squash(K) {
  const out = []; K.forEach(k => { if (!out.length || dist(k, out[out.length - 1]) > SQ) out.push(k); });
  if (out.length === 1 && K.length > 1) { const far = K.reduce((m, k) => dist(k, K[0]) > dist(m, K[0]) ? k : m, K[0]); return [K[0], far, K[0]]; }      /* 10: only the wrist twists, so keep the twist as its own moment */
  return out.length >= 4 && dist(out[2], out[0]) < SQ * 1.5 ? out.slice(0, 3) : out;      /* a movement done twice: once there and back is enough */
}
let SEQ = null;
function seqStart(n) {
  const P = partsFor(n), multi = P.length > 1;
  if (!KEYS[n] && refHand && refHand.numberKeys) {
    if (!multi) KEYS[n] = refHand.numberKeys(P[0].v, P[0].o).map(F => squash(F.map(feat))).filter(K => K.length);
    else { let combos = [[]];      /* every way of signing each part, one after another */
      P.forEach(p => { const forms = refHand.numberKeys(p.v, p.o).map(F => squash(F.map(feat))).filter(K => K.length); combos = combos.flatMap(c => forms.map(F => c.concat(c.length && dist(c[c.length - 1], F[0]) < SQ ? F.slice(1) : F))).slice(0, 16); });
      KEYS[n] = combos; }
  }
  const twin = +n >= 11 && +n <= 15 ? +n - 10 : -1;      /* 11-15 start like 1-5 (fingers together, or held by the thumb): that plain digit is not a look-alike to beat (Colleen: 14 struggled) */
  if (!DECOY[n] && refHand && refHand.numberDecoys) DECOY[n] = [].concat(...P.map(p => refHand.numberDecoys(p.v, p.o).filter(([d]) => d !== twin).map(([d, J]) => feat(J))));
  SEQ = { n, forms: (KEYS[n] || []).map(K => ({ K, i: -1, run: 0, r0: null, noSkip: multi })) };      /* a part can't be skipped */
}
function seqRead(n, f, L, opt) {
  opt = opt || {};
  if (!SEQ || SEQ.n !== n) seqStart(n);
  let best = 99; DIGITS.forEach(c => { best = Math.min(best, dModel(f, c)); (MINE[c] || []).forEach(m => { best = Math.min(best, dist(f, m, c)); }); });
  SEQ.forms.forEach(F => F.K.forEach(k => { best = Math.min(best, dist(f, k)); })); (DECOY[n] || []).forEach(k => { best = Math.min(best, dist(f, k)); });
  const tol = +n >= 11 && +n <= 15 ? 1.3 : 1.15, ok = k => dist(f, k) <= best * tol + (tol > 1.2 ? 0.25 : 0.1);      /* the bends and flicks of 11-15 get a little more room */
  let prog = 0, win = null;
  SEQ.forms.forEach(F => {
    let j = -1; for (let t = F.i + 1; t <= Math.min(F.i >= 0 && F.K.length >= 4 && !F.noSkip ? F.i + 2 : F.i + 1, F.K.length - 1); t++) if (ok(F.K[t]) && (F.i < 0 || dist(f, F.K[t]) < dist(f, F.K[F.i]))) j = t;      /* the next key moment (one in between may be skipped) */
    const last = j === F.K.length - 1, t = clock();
    if (j >= 0 && last) { if (F.at === undefined || F.at === null) F.at = t; F.miss = 0; if (t - F.at >= HOLD) { F.i = j; F.run = 0; } }      /* the last shape is held on purpose for half a second (Colleen) */
    else if (j >= 0) { F.miss = 0; if (++F.run >= 2) { F.i = j; F.run = 0; if (j === 0 || F.r0 === null) F.r0 = roll(f); } }
    else { F.run = Math.max(0, F.run - 1); if (++F.miss > 2) F.at = null; }
    if (F.i === F.K.length - 1 && F.K.length > 1) {
      if (ROCK.has(+n)) { const want = roll(F.K[F.K.length - 1]) - roll(F.K[0]), got = roll(f) - F.r0; if (Math.sign(want) !== Math.sign(got) || Math.abs(got) < 10) { F.i = -1; F.r0 = null; F.wrong = true; return; } }      /* rocked the wrong way (or not at all): start again */
      win = F;
    }
    prog = Math.max(prog, (F.i + 1) / F.K.length);
  });
  if (!opt.quiet) {      /* ages draw their own picture and tip */
  dots(L, -1, !!win);
  const pct = win ? 100 : Math.round(prog * 90); $('#rd-pct').hidden = false; $('#rd-pct').style.setProperty('--p', pct); $('#rd-pct').innerHTML = '<span>' + pct + '%</span>';
  const wrongWay = SEQ.forms.some(F => F.wrong); $('#rd-tip').textContent = win ? 'Yes!' : wrongWay ? 'Check which way it rocks: ' + nHint(n).toLowerCase() : nHint(n);
  $('#rd-guess').innerHTML = SEQ.forms.map(F => '<span class="' + (F === win ? 'top' : '') + '">' + (F.i + 1) + '/' + F.K.length + '<small>key moments</small></span>').join('');
  $('#rd-hold').style.width = (win ? 100 : prog * 100) + '%';
  }
  if (win && !done && (!opt.gate || opt.gate())) { done = true; SEQ = null; $('#rd-letter').classList.add('ok'); flash(numText(opt.as || n)); ckRecord(opt.as || n, true, 1); setTimeout(nextLetter, 1300); }
  return !!win;
}
/* AGES (2026-10-17): the face finder (MediaPipe, on this computer only, loaded only for ages) finds the mouth and nose; the chin is just below.
   1-9: the number palm out, the pointer finger on the chin, then a push down and forward. 10 and up: the 1 palm in on the chin, then the push
   turns into the number with its usual rules (Colleen's locked age rules in hand.js). */
let FACE_DET = null, FACE_LOAD = null, FACE = null, AGE = null, faceN = 0;
const FACE_MODEL = 'https:' + '/' + '/storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
function faceStart() {
  if (FACE_LOAD || !VFILES) return; const o = d => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 });
  FACE_LOAD = FaceDetector.createFromOptions(VFILES, o('GPU')).catch(() => FaceDetector.createFromOptions(VFILES, o('CPU'))).then(d => { FACE_DET = d; }).catch(() => { FACE_LOAD = null; });
}
function faceTick(t) {
  if (!FACE_DET) { faceStart(); return; } if (++faceN % 3) return;      /* every third frame is plenty */
  try { const r = FACE_DET.detectForVideo(video, t), d = r && r.detections && r.detections[0]; if (!d || !d.keypoints || d.keypoints.length < 6) { FACE = null; return; }
    const k = d.keypoints, nose = k[2], mouth = k[3], fw = Math.abs(k[4].x - k[5].x) || (d.boundingBox ? d.boundingBox.width / (video.videoWidth || 640) : 0.25);
    FACE = { x: mouth.x + (mouth.x - nose.x) * 1.3, y: mouth.y + (mouth.y - nose.y) * 1.3, fw, t }; } catch (e) { FACE = null; }
}
/* the age area (Colleen, 2026-10-17: "a good area to expect to see ages"): from the chin to about two and a half face widths down, about as
   wide as the shoulders. Drawn only when "Show the age area" is ticked (off every time the page loads). The canvas is mirrored like the video. */
const AGE_AREA = { top: 0.1, bottom: 2.6, half: 0.9 };
function ageArea() {
  const box = $('#rd-agebox'); if (!box || !box.checked || !FACE) return;
  const W = draw.width, H = draw.height, A = AGE_AREA, x0 = (FACE.x - A.half * FACE.fw) * W, w = 2 * A.half * FACE.fw * W, y0 = (FACE.y + A.top * FACE.fw) * H, h = (A.bottom - A.top) * FACE.fw * H;
  ctx.save(); ctx.fillStyle = 'rgba(127,209,255,.15)'; ctx.strokeStyle = 'rgba(127,209,255,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, 18) : ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(x0 + w / 2, y0 + 26); ctx.scale(-1, 1); ctx.font = '700 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#bfe8ff'; ctx.fillText('age area', 0, 0); ctx.restore();
}
function ageRead(t, f, L, now) {
  const a = +String(t).slice(1); faceTick(now);
  if (!AGE || AGE.t !== t) AGE = { t, phase: 'chin', ms: 0, last: now, s0: 0, pushed: false };
  const dt = Math.min(100, now - AGE.last); AGE.last = now;
  const startC = a <= 9 ? (a <= 5 ? a + '*' : String(a)) : '1', R = rank(f), best = R[0][1], dS = (R.find(x => x[0] === startC) || [0, 99])[1], shapeOK = dS <= best * 1.2;      /* 1-5 palm out are the "*" entries */
  const tip = L[8], size = Math.hypot(L[9].x - L[0].x, L[9].y - L[0].y);
  dots(L, -1, AGE.phase === 'done');
  if (FACE && now - FACE.t < 600) ageArea();
  if (FACE && now - FACE.t < 600) { ctx.beginPath(); ctx.arc(FACE.x * draw.width, FACE.y * draw.height, 9, 0, 7); ctx.strokeStyle = AGE.phase === 'chin' ? '#FFC83D' : '#14804D'; ctx.lineWidth = 4; ctx.stroke(); }      /* where the chin is */
  const face = FACE && now - FACE.t < 600, near = face ? Math.hypot(tip.x - FACE.x, tip.y - FACE.y) / FACE.fw : 9;
  let tipTxt = '', prog = 0;
  if (!face) tipTxt = 'Face the camera so it can see your chin';
  else if (AGE.phase === 'chin') {
    tipTxt = !shapeOK ? (a <= 9 ? 'Make ' + a + ', palm out' : 'Make a 1, palm toward you') : near > 0.4 ? 'Put your pointer finger on your chin' : 'Now push down and forward';
    if (shapeOK && near <= 0.4) { AGE.ms += dt; if (AGE.ms >= 250) { AGE.phase = 'push'; AGE.s0 = size; AGE.y0 = tip.y; } } else AGE.ms = 0;
    prog = 0.1 + (shapeOK ? 0.15 : 0) + (near <= 0.4 ? 0.15 : 0);
  }
  if (face && (AGE.phase === 'push' || AGE.phase === 'num')) {
    if (!AGE.pushed && (near > 0.75 || size > AGE.s0 * 1.12) && tip.y >= AGE.y0 - 0.02) AGE.pushed = true;      /* away from the chin: down, or forward (bigger) */
    if (a <= 9) { tipTxt = AGE.pushed ? 'Yes!' : 'Push down and forward'; prog = AGE.pushed ? 1 : 0.5;
      if (AGE.pushed && shapeOK && !done) { AGE.phase = 'done'; done = true; $('#rd-letter').classList.add('ok'); flash(numText(t)); ckRecord(t, true, 1); setTimeout(nextLetter, 1300); } }
    else { AGE.phase = 'num'; const won = seqRead(String(a), f, L, { as: t, gate: () => AGE.pushed, quiet: true }); tipTxt = won && AGE.pushed ? 'Yes!' : AGE.pushed ? 'Now sign ' + a : 'Push forward into the ' + a; prog = 0.5 + (AGE.pushed ? 0.25 : 0) + (won ? 0.25 : 0); if (done) AGE.phase = 'done'; }
  }
  $('#rd-tip').textContent = tipTxt; $('#rd-hold').style.width = Math.round(prog * 100) + '%';
  $('#rd-pct').hidden = false; $('#rd-pct').style.setProperty('--p', Math.round(prog * 100)); $('#rd-pct').innerHTML = '<span>' + Math.round(prog * 100) + '%</span>';
}
async function showNum() {      /* the hand signs the number, so the student can see the movement */
  if (!refHand || !NUMS) return; const n = +String(SET[cur]).replace(/^[ya]/, ''), box = $('#rd-modelbox'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false; $('#rd-shownum').disabled = true;
  try { await refHand.ready; const t = String(SET[cur]); if (t[0] === 'a') await refHand.signAge(+t.slice(1), {}); else if (t[0] === 'y') await refHand.signYear(+t.slice(1), {}); else if (partsFor(t).length > 1) await refHand.signParts(tokensFor(+t).flatMap(v => v >= 100 && v < 1000 ? [v / 100, 'H'] : [v]), {}); else await refHand.sign(n, {}); } catch (e) {} finally { $('#rd-shownum').disabled = false; }
}
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
try { const got = JSON.parse(sessionStorage.getItem('fsp.sheetWords') || 'null'); if (got && got.defs && typeof got.defs === 'object') window.FS_DEFS = Object.assign({}, window.FS_DEFS || {}, got.defs); } catch (e) {}      /* the teacher's own descriptions, when opened from the sheet */
const QS = new URLSearchParams(location.search), IN_SHEET = QS.get('embed') === 'aslstudy' && !!window.opener;
const ONLY = /^(letters|numbers)$/.test(QS.get('only') || '') ? QS.get('only') : '';      /* the TpT editions: only the half the sheet has */
{ const numPage = ONLY === 'numbers' || QS.get('kind') === 'numbers'; $$('#rd-mode button').forEach(b => { if (numPage !== (b.dataset.v === 'numbers')) b.remove(); }); if ($$('#rd-mode button').length < 2) $('#rd-mode').hidden = true; }      /* two separate pages (Colleen): the letters camera never links to the numbers camera or back, since a buyer may have only one */
if (QS.get('embed') === 'aslstudy') { const m = document.getElementById('rd-safe-more'); if (m) m.textContent = 'The only thing your teacher gets is your score: which letters you signed and how long each one took.'; }
let CK = null;
const TL_FIXED = QS.has('tl') ? Math.max(0, Math.min(60, +QS.get('tl') || 0)) : null;      /* the teacher's time limit from the sheet's Settings */
const tlNow = () => TL_FIXED !== null ? TL_FIXED : +($('#rd-tl').value || 8);
const shuffleA = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function ckStart() {
  const words = !!WORD || $('#rd-mode .on').dataset.v === 'words';
  CK = { on: true, words, items: [], t: 0, lastT: 0, quickN: 0, quickL: '', quick: '', start: Date.now(), queue: words ? shuffleA(pool()).slice(0, 8) : NUMS ? shuffleA(onlyDigits() ? DIGITS : nPool()).slice(0, 10) : shuffleA(SET) };
  if (!CK.queue.length) { CK = null; $('#rd-status').textContent = 'No words fit. Choose another length or list.'; return; }
  document.body.classList.add('checking'); $('#rd-results').hidden = true; $('#rd-checkgo').hidden = true; $('#rd-ckbar').hidden = false; $('#rd-hint').checked = false;
  if (NUMS) SET = CK.queue.slice();
  if (words) { CK.qi = 0; WORD = CK.queue[0]; wi = 0; showWord(); } else { CK.qi = 0; go(SET.indexOf(CK.queue[0])); }
  ckBar();
}
function ckBar() { if (!CK) return; const total = CK.queue.length, at = CK.qi + 1; $('#rd-ckpos').textContent = (CK.words ? 'Word ' : NUMS ? 'Number ' : 'Letter ') + Math.min(at, total) + ' of ' + total; const L = tlNow(); $('#rd-cktime').style.width = L ? Math.min(100, CK.t / (L * 10)) + '%' : '0'; }
function ckTick() {
  ckBar(); const L = tlNow(); if (!L || CK.t < L * 1000) return;
  const c = WORD ? WORD[wi] : SET[cur]; ckRecord(c, false, 1); done = true;      /* time is up: "not yet", on to the next */
  const box = $('#rd-oops'); box.textContent = 'Time’s up for ' + c + '. On to the next one.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 1600);
  if (WORD) setTimeout(() => { wi++; if (wi >= WORD.length) wordDone(); else showWord(); }, 600); else setTimeout(nextLetter, 600);
}
function ckRecord(c, ok, step) {
  if (!CK || !CK.on) return; const secs = Math.round(CK.t / 100) / 10;
  for (let k = 0; k < step; k++) CK.items.push({ c: k ? c : c, ok, secs: k ? 0 : secs, quick: k ? '' : CK.quick });
  CK.t = 0; CK.lastT = 0; CK.quick = ''; CK.quickN = 0; CK.quickL = '';
}
function quickCheck(R, target, f, dTgt) {      /* quick and confident (Colleen): early in the letter, held steady, clearly another letter */
  if (!CK || !CK.on || CK.quick) return; const top = R[0][0]; if (top.endsWith('*') || top[0] === '~') { CK.quickN = 0; return; }
  if (top === target || CK.t > 3000 || !nearModel(f, top, 1) || R[0][1] > dTgt * 0.75) { CK.quickN = 0; return; }
  CK.quickN = top === CK.quickL ? CK.quickN + 1 : 1; CK.quickL = top; if (CK.quickN >= 8) CK.quick = top;
}
function nextLetter() {
  if (LIVEON && !GAME) liveDone(SET[cur]);      /* a class game: this number counts */
  if (GAME && GAME.numDone) return GAME.numDone(SET[cur]);
  if (!CK || !CK.on) return go(cur + 1);
  CK.qi++; if (CK.qi >= CK.queue.length) return ckFinish(); go(SET.indexOf(CK.queue[CK.qi])); ckBar();
}
function ckNextWord() { CK.qi++; if (CK.qi >= CK.queue.length) return ckFinish(); WORD = CK.queue[CK.qi]; wi = 0; showWord(); ckBar(); }
function ckFinish() {
  const C = CK, U = UNIT(); C.on = false; document.body.classList.remove('checking'); $('#rd-ckbar').hidden = true; $('#rd-checkgo').hidden = false; $('#rd-checkgo').textContent = 'Check again';
  const it = C.items, signed = it.filter(x => x.ok), slow = signed.filter(x => x.secs > 4), notYet = it.filter(x => !x.ok), quick = it.filter(x => x.quick);
  const avg = signed.length ? Math.round(signed.reduce((a, x) => a + x.secs, 0) / signed.length * 10) / 10 : 0;
  const per = {}; it.forEach(x => { const p = per[x.c] = per[x.c] || { ok: 0, n: 0, secs: 0 }; p.n++; if (x.ok) { p.ok++; p.secs += x.secs; } });
  const cls = c => { const p = per[c]; return !p.ok ? 'no' : p.secs / p.ok > 4 ? 'slow' : 'ok'; };
  $('#rd-results').innerHTML = '<h3>Your check</h3><div class="big">' + signed.length + ' of ' + it.length + '</div><p class="rd-small">' + U + 's signed' + (signed.length ? ', about ' + avg + ' seconds each' : '') + '</p>' +
    '<div class="lets">' + Object.keys(per).sort((a, b) => NUMS ? a - b : a < b ? -1 : 1).map(c => '<span class="' + cls(c) + '">' + c + '</span>').join('') + '</div><p class="rd-small">Green: signed. Yellow: signed, but slow. Red: not yet.</p>' +
    (quick.length ? '<p><b>Quick mix-ups</b> (signed fast and sure, but a different ' + U + '):</p><ul>' + quick.map(x => '<li>' + an(x.quick).replace(/^an? /, '') + ' when asked for ' + x.c + '</li>').join('') + '</ul>' : '') +
    (notYet.length ? '<p><b>Not yet:</b> ' + [...new Set(notYet.map(x => x.c))].join(', ') + '. The camera can misread a hand, so ask your teacher to check these.</p>' : '<p><b>Every ' + U + ' signed!</b></p>') +
    (IN_SHEET ? '<p class="rd-small" id="rd-sent">Saving to your class…</p>' : '');
  $('#rd-results').hidden = false;
  if (IN_SHEET) ckSend(C, it, signed, quick);
  CK = null; WORD = null; if (!C.words) go(0); else { $$('#rd-mode button').forEach(x => x.classList.toggle('on', x.dataset.v === 'words')); newWord(); }
}
function ckSend(C, it, signed, quick) {      /* to the games page that opened this tab, which passes it to ASL Study / the TpT sheet */
  const round = { type: 'fsp-cam-round', v: 1, kind: NUMS ? 'numbers' : 'letters', game: NUMS ? 'camera-num' : 'camera', name: NUMS ? 'Sign Numbers to the Camera' : 'Fingerspell to the Camera', rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    n: it.length, right: signed.length, secs: Math.round((Date.now() - C.start) / 1000), speed: 1, lps: null, top: null, letters: NUMS ? 0 : signed.length, items: [],
    exp: { words: C.words ? 1 : 0, hand: LEFT ? 'left' : 'right', limit: tlNow(), items: it.slice(0, 200).map(x => [x.c, x.ok ? 1 : 0, x.secs, x.quick || '']) } };
  try { window.opener.postMessage(round, '*');      /* the games page that opened it, or ASL Study's Practice page (another origin); only the score goes */ $('#rd-sent').textContent = 'Saved to your class.'; } catch (e) { $('#rd-sent').textContent = 'Could not save: keep the ASL Study tab open and try again.'; }
}
$('#rd-kind').onclick = e => { const b = e.target.closest('button'); if (!b || (CK && CK.on)) return; if (GAME) quitGame(); $$('#rd-kind button').forEach(x => x.classList.toggle('on', x === b)); const ck = b.dataset.v === 'check', gm = b.dataset.v === 'games';
  $('#rd-gamelist').hidden = !gm; document.body.classList.toggle('gamestab', gm); if (gm) { drawGames(); $('#rd-checkset').hidden = true; $('#rd-results').hidden = true; return; } else if (!WORD && !NUMS) go(cur);
  $('#rd-checkset').hidden = !ck; $('#rd-results').hidden = true; $('#rd-checkgo').hidden = false; $('#rd-checkgo').textContent = 'Start the check';
  ckAbout(); };
function ckAbout() { const v = $('#rd-mode .on').dataset.v; $('#rd-checkabout').textContent = (v === 'words' ? '8 words from the words you chose.' : v === 'numbers' ? (onlyDigits() ? 'All 10 numbers, 0 to 9, in a mixed order.' : '10 numbers from the sets you chose.') : 'All 26 letters, in a mixed order.') + ' No hints. The time only runs while your hand is in view.'; const u = $('#rd-tlunit'); if (u) u.textContent = v === 'numbers' ? 'number' : 'letter'; }
$('#rd-checkgo').onclick = ckStart;
if (TL_FIXED !== null) { $('#rd-tlwrap').innerHTML = 'Time per letter: ' + (TL_FIXED ? TL_FIXED + ' seconds' : 'no limit') + ' (set by your teacher)'; }
else { try { const v = localStorage.getItem('fs-reader-tl'); if (v !== null) $('#rd-tl').value = v; } catch (e) {} $('#rd-tl').onchange = () => { try { localStorage.setItem('fs-reader-tl', $('#rd-tl').value); } catch (e) {} }; }

function flash(c) {      /* a big green check on the camera, so it's obvious the letter was accepted (Colleen) */
  const f = $('#rd-flash'); f.textContent = '✓ ' + c; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
let DBL = null;
/* NO BOUNCING OR PUNCHING (Colleen): fingerspelling flows from letter to letter with the hand in one place. Between letters the wrist is
   watched; a dip down and back up (a bounce) or a push toward the camera and back (a punch) on 3 letters in a row stops the student. */
let BOUNCE = [], BRUN = 0;
function bouncy() {
  const B = BOUNCE; BOUNCE = []; if (B.length < 6) { BRUN = 0; return false; }
  const ms = B.reduce((a, b) => a + b.s, 0) / B.length || 1, ends = [B[0], B[1], B[B.length - 2], B[B.length - 1]], mid = B.slice(2, -2);
  const dip = Math.max(...mid.map(b => b.y)) - Math.max(...ends.map(b => b.y)), push = Math.max(...mid.map(b => b.s)) - Math.max(...ends.map(b => b.s));      /* image y grows downward; a closer hand looks bigger */
  const hit = dip > 0.2 * ms || push > 0.12 * ms;
  BRUN = hit ? BRUN + 1 : 0; return BRUN >= 3;
}
function stopBounce() {
  BRUN = 0; held = 0; $('#rd-hold').style.width = '0';
  const box = $('#rd-oops'); box.textContent = 'Stop bouncing or punching each letter. Keep your hand in one place and let the letters flow smoothly into each other.'; box.hidden = false;
  $('#rd-tip').textContent = 'Flow smoothly: no bouncing';
  setTimeout(() => { box.hidden = true; if (!WORD) return; if (CK && CK.on) { done = false; return; } wi = 0; showWord(); }, 3500);      /* practice: the word starts over; in a check the clock keeps the score */
}
function showWord() {
  if (wi === 0) { BRUN = 0; BOUNCE = []; }      /* the samples run on between letters, so the move from one letter to the next is in them */
  if (GAME && GAME.onLetter && wi > 0) GAME.onLetter(wi);
  const c = WORD[wi]; DBL = wi > 0 && WORD[wi - 1] === c ? { x0: null, d0: lastD, moved: false } : null; done = false; held = 0; $('#rd-hold').style.width = '0'; $('#rd-letter').textContent = GAME && GAME.hideLetter ? '?' : c; $('#rd-letter').classList.remove('ok'); $('#rd-word').classList.remove('alldone');
  $('#rd-word').innerHTML = WORD.split('').map((x, i) => '<span class="' + (i < wi ? 'd' : i === wi ? 'c' : 'n') + '">' + (GAME && GAME.hide && i >= wi ? '_' : x) + '</span>').join('');      /* games that hide the word show blanks until each letter is signed */
  if (wi === 0) showDef(WORD);
  showRef(c);
}
function showDef(w) {      /* what the word means, right under the word, from the moment it appears (Colleen) */
  const D = window.FS_DEFS || {}, k = Object.keys(D).find(x => x.toUpperCase().replace(/[^A-Z]/g, '') === w), dv = $('#rd-def');
  if (!WORD || (CK && CK.on && !k)) { dv.hidden = true; return; } $('#rd-prompt').appendChild(dv); dv.hidden = !k; if (k) dv.textContent = '📖 ' + (GAME && GAME.hide ? maskWord(D[k], k) : D[k]);
}
function newWord() { const P = pool(); WORD = P.length ? P[Math.floor(Math.random() * P.length)] : 'CAT'; wi = 0; showWord(); }
let LAST = '';
function wordDone() {      /* all green, then straight on to the next word (Colleen); "Show me" stays for the word just spelled */
  done = true; LAST = WORD; const w = $('#rd-word'); w.innerHTML = WORD.split('').map(x => '<span class="d">' + x + '</span>').join(''); w.classList.add('alldone');
  $('#rd-showbox').hidden = true; $('#rd-after').hidden = false; $('#rd-showme').textContent = '▶ Show me ' + LAST; $('#rd-status').textContent = 'You spelled ' + LAST + '!';
  if (GAME && GAME.wordDone) { $('#rd-after').hidden = true; return GAME.wordDone(LAST); }
  if (LIVEON) liveDone(LAST);      /* a class game: this word counts */
  setTimeout(() => { if (WORD === LAST && done) { if (CK && CK.on) ckNextWord(); else newWord(); } }, 1500);
}
async function showMe() {      /* the hand spells the word back, for clarity (Colleen) */
  if (!refHand || !LAST) return; const box = $('#rd-modelbox'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false; $('#rd-showme').disabled = true;
  try { await refHand.ready; await refHand.spell(LAST, { speed: () => 0.15 }); } finally { $('#rd-showme').disabled = false; }
}
function showRef(c) {      /* the handshape picture: only when "Show the handshape" is on (beginners); most of the time it just asks for the letter */
  const on = $('#rd-hint').checked; $('#rd-showbox').hidden = !on;
  if (on && refHand && refHand.chartImage) { try { $('#rd-ref').src = NUMS ? refHand.numberImage(+c) : refHand.chartImage(c); } catch (e) {} }
}
$('#rd-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#rd-mode button').forEach(x => x.classList.toggle('on', x === b));
  setNums(b.dataset.v === 'numbers'); const words = b.dataset.v === 'words'; if (!words) $('#rd-def').hidden = true; $('#rd-prompt').hidden = !words; (words ? $('#rd-prompt') : $('.rd-target')).insertBefore($('#rd-word'), words ? null : $('#rd-letter')); $('#rd-letter').hidden = words; $('#rd-ask').hidden = words; $('#rd-word').hidden = !words;      /* the word sits right above the camera (Colleen) */ $('#rd-wordset').hidden = !words; document.querySelector('.rd-teach').hidden = words; $('#rd-after').hidden = true; $('#rd-modelbox').hidden = true;
  $('#rd-ask').textContent = words ? 'Spell this word' : 'Sign this ' + UNIT(); ckAbout(); if (words) newWord(); else { WORD = null; go(NUMS ? 0 : cur); } };
function setNums(on) {      /* letters <-> numbers: what is asked, the templates in the running, the page title */
  { const pr = document.getElementById('rd-pacerow'); if (pr) pr.hidden = !!on; }      /* the Speed Pacer is for letters */
  if (on === NUMS) return; NUMS = on; SET = on ? (onlyDigits() ? DIGITS : shuffleA(nPool())) : LETTERS; STILLSET = on ? DIGITS : STILL; cur = 0; WORD = null; MOT = [];
  $('h1').textContent = on ? 'Sign Numbers to the Camera' : 'Fingerspell to the Camera'; document.title = $('h1').textContent;
  $('#rd-intro').textContent = on ? 'Sign the number to your camera. When the camera reads it, the number turns green.' : 'Sign the letter to your camera. When the camera reads it, the letter turns green.';
  $('#rd-teachbtn').textContent = 'Teach this ' + UNIT(); $('#rd-forget').textContent = 'Forget this ' + UNIT();
  $('#rd-numset').hidden = !on; drawMix(); const sn = $('#rd-shownum'); if (sn && !on) sn.hidden = true;
  const sm = $('#rd-safe-more'); if (sm) sm.textContent = sm.textContent.replace(on ? /letters/g : /numbers/g, on ? 'numbers' : 'letters');
}
chips($('#rd-lens'), LENS.map(l => [l[0], l[1]]), 'lens'); chips($('#rd-cats'), CATS.map(k => [k, nice(k)]), 'cats'); count();
$('#rd-showme').onclick = showMe; numChips(); { const sn = $('#rd-shownum'); if (sn) sn.onclick = showNum; }
try { $('#rd-hint').checked = localStorage.getItem('fs-reader-hint') === '1'; } catch (e) {}
$('#rd-hint').onchange = () => { try { localStorage.setItem('fs-reader-hint', $('#rd-hint').checked ? '1' : '0'); } catch (e) {} showRef(WORD ? WORD[wi] || 'A' : SET[cur]); };
drawMix();

/* ---------- CAMERA GAMES (Colleen, 2026-10-17). Practice only: nothing is saved to the sheet; each game keeps this computer's best score. ---------- */
let GAME = null, CLASSNAMES = null;
/* CLASS GAMES (2026-10-17): ASL Study's live class game opens this tab and tells it what to do.
   { type: 'fsp-cam-live', on, kind: 'letters'|'numbers' }: every word (or number) signed in practice counts for the student and their team.
   { type: 'fsp-cam-target', word }: "camera answers": fingerspell this word (hidden: the student sees the sign in the game) and say when it is done. */
let LIVEON = false;
function liveDone(w) { if (!IN_SHEET) return; try { window.opener.postMessage({ type: 'fsp-cam-done', w: String(w) }, '*'); } catch (e) {} }
function liveBanner(t) { let b = $('#rd-livebar'); if (!b) { b = document.createElement('div'); b.id = 'rd-livebar'; b.className = 'rd-livebar'; const m = $('main') || document.body; m.insertBefore(b, m.firstChild); } b.innerHTML = t || ''; b.hidden = !t; }
if (IN_SHEET) window.addEventListener('message', e => {
  if (e.source !== window.opener || !e.data) return; const d = e.data;
  if (d.type === 'fsp-cam-live') {
    LIVEON = !!d.on; if (GAME) quitGame();
    if (!LIVEON) { liveBanner(''); return; }
    const want = d.kind === 'numbers' ? 'numbers' : 'words', btn = document.querySelector('#rd-mode [data-v="' + want + '"]');
    if (btn && !btn.classList.contains('on')) btn.click();
    liveBanner(d.target ? '🎮 Class game: look at the sign in your game, then fingerspell the English word here.' : '🎮 Class game: every ' + (want === 'numbers' ? 'number' : 'word') + ' you sign counts for you' + (d.team ? ' and the ' + String(d.team).replace(/[<>&]/g, '') + ' team' : '') + '!');
  }
  if (d.type === 'fsp-cam-target' && d.word) {
    const w = String(d.word).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 24); if (!w) return;
    const btn = document.querySelector('#rd-mode [data-v="words"]'); if (btn && !btn.classList.contains('on')) btn.click();
    const G = { k: 'live', hide: true, hideLetter: true, wordDone: () => { liveDone(w); GAME = { k: 'live', free: true, letter: () => {} }; WORD = null;      /* waits quietly for the next word */ $('#rd-word').innerHTML = '<span class="d">✓</span>'; $('#rd-letter').textContent = '✓'; $('#rd-tip').textContent = 'Got it! Look at your game for the next sign.'; } };
    $('#rd-prompt').hidden = false; wordGame(G, w); $('#rd-tip').textContent = 'Fingerspell the English word for the sign in your game (' + w.length + ' letters)';
  }
  if (d.type === 'fsp-cam-target' && d.stop) { if (GAME && GAME.k === 'live') { GAME = null; WORD = null; } }
});
if (IN_SHEET) window.addEventListener('message', e => { if (e.source === window.opener && e.data && e.data.type === 'fsp-cam-saved') { const el = $('#rd-sent'); if (el) el.innerHTML = '✓ Saved to your class: ' + (e.data.got || []).join(', ').replace(/[<>&]/g, '') + (e.data.milestones || []).map(m => '<br><b>' + String(m.title).replace(/[<>&]/g, '') + '</b> ' + String(m.text).replace(/[<>&]/g, '')).join(''); } });      /* what a Check earned, with milestones (4.20) */
/* the Name Game: inside a class app the camera tab asks for the class's first names (they stay on this screen; nothing is kept) */
if (IN_SHEET) { window.addEventListener('message', e => { if (e.source === window.opener && e.data && e.data.type === 'fsp-cam-names' && Array.isArray(e.data.names)) CLASSNAMES = e.data.names.map(x => String(x).toUpperCase().replace(/[^A-Z]/g, '')).filter(x => x.length >= 2 && x.length <= 14); }); try { window.opener.postMessage({ type: 'fsp-cam-names?' }, '*'); } catch (e) {} }
const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function maskWord(text, key) { let t = String(text); [key].concat(key.split(/\s+/).filter(w => w.length >= 3)).forEach(w => { t = t.replace(new RegExp(reEsc(w), 'gi'), '_____'); }); return t; }      /* the description must not give the word away */
const best = (k, v, lower) => { let b = null; try { b = JSON.parse(localStorage.getItem('fs-cam-best') || '{}'); } catch (e) { b = {}; } const old = b[k]; if (v !== undefined && (old === undefined || (lower ? v < old : v > old))) { b[k] = v; try { localStorage.setItem('fs-cam-best', JSON.stringify(b)); } catch (e) {} return { old, isNew: true }; } return { old, isNew: false }; };
const ghead = html => { const h = $('#rd-ghead'); h.hidden = !html; h.innerHTML = html || ''; };
const defOf = w => { const D = window.FS_DEFS || {}; return Object.keys(D).find(x => x.toUpperCase().replace(/[^A-Z]/g, '') === w); };
const rnd = a => a[Math.floor(Math.random() * a.length)];
const LGAMES = [
  ['def', '📖', 'Definition to Word', 'Read what it means, then fingerspell the word.'],
  ['echo', '🔁', 'Echo', 'The hand spells a word. Spell it back.'],
  ['speed', '⏱️', 'Speed Spell', 'How many words can you spell in 60 seconds?'],
  ['ladder', '🪜', 'Spelling Ladder', 'Every word you spell, the next one is longer.'],
  ['hang', '🎯', 'Camera Hangman', 'Sign letters to find the hidden word.'],
  ['wordle', '🟩', 'ASL Wordle', 'Fingerspell five-letter guesses. Six tries.'],
  ['names', '🙋', 'Name Game', 'Fingerspell names: your classmates\u2019 names in your class app, popular names here.'],
  ['rain', '🌧️', 'Letter Rain', 'Letters fall from the sky. Sign each one before it lands!'],
  ['whack', '🔨', 'Whack-a-Letter', 'Moles pop up holding letters. Sign the letter to bonk the mole.'],
  ['racer', '🏎️', 'Fingerspell Racer', 'Every letter moves your car. Beat your own ghost car.'],
  ['boss', '👾', 'Boss Battle', 'Every word you spell hits the boss. Beat it before it gets you!'],
  ['picture', '🖼️', 'Picture Spell', 'A picture shows up. Fingerspell what it is.'],
  ['chain', '🔗', 'Word Chain', 'Each word starts with the last letter of the one before. Make the longest chain!'],
  ['scramble', '🔀', 'Unscramble', 'The letters are mixed up. Fingerspell the real word.'],
  ['blitz', '⚡', 'Category Blitz', 'Spell as many words in the category as you can in 60 seconds.'],
  ['r50', '📷', 'Race to 50', 'Alone: how fast can you sign 10, 25 or 50 words? (In class it is a team game.)'],
  ['jar', '🫙', 'Fill the Jar', 'Alone: every word drops a marble in your jar. Two minutes. (In class it is a team game.)'],
  ['bee', '🐝', 'Spelling Bee', 'Take turns at the camera; a miss and you sit down. Last one standing wins. (Alone: how far can you go?)']];
const NGAMES = [
  ['math', '➗', 'Math Answer', 'Solve the problem, then sign the answer.'],
  ['count', '🔢', 'Count Up', 'Sign 1 to 20 in order, as fast as you can.'],
  ['clock', '⏰', 'Beat the Clock', 'Sign each number before time runs out. It gets faster.'],
  ['r50', '📷', 'Race to 50', 'Alone: how fast can you sign 10, 25 or 50 numbers? (In class it is a team game.)'],
  ['jar', '🫙', 'Fill the Jar', 'Alone: every number drops a marble in your jar. Two minutes. (In class it is a team game.)'],
  ['charlie', '🧑', 'How Old Is Charlie?', 'Look at Charlie, pick the age, then sign it as an AGE (start at the chin).'],
  ['years', '📜', 'When Did It Happen?', 'See the event, pick the year, then sign the year.'],
  ['guessage', '🎂', 'Guess My Age', 'Type your best guess of Charlie\u2019s age, then sign it. Closer guesses score more.'],
  ['hilo', '🔼', 'Higher or Lower', 'Find the secret number from 1 to 100. Sign each guess.'],
  ['price', '🏷️', 'Price Is Right', 'Guess the price, then sign it. Closest without going over!']];
function drawGames() {
  const L = NUMS ? NGAMES : LGAMES;
  $('#rd-mlevel').hidden = !NUMS; $$('#rd-mlevel button').forEach(b => b.classList.toggle('on', b.dataset.v === MLEVEL));
  $('#rd-gamelist').innerHTML = partyBar() + L.map(g => { const b = best(g[0]).old; return '<button class="rd-gcard" data-g="' + g[0] + '"><span aria-hidden="true">' + g[1] + '</span><b>' + g[2] + '</b><small>' + g[3] + (b !== undefined ? ' Best: ' + (g[0] === 'count' ? b + ' s' : b) + '.' : '') + '</small></button>'; }).join('');
}
function gameUI(on) {
  if (!on) { gpic(''); gchoose(''); }
  document.body.classList.toggle('gaming', on); $('#rd-prompt').hidden = !on; $('#rd-prompt').classList.toggle('numgame', on && NUMS); const gm = $('#rd-gmodel'); if (gm) gm.hidden = true;      /* the game's line (problem, score, timer) sits right above the camera */ $('#rd-mlevel').hidden = true; if (!on) $('#rd-calc').hidden = true; $('#rd-gamelist').hidden = on; $('#rd-gamebar').hidden = !on; $('#rd-results').hidden = true;
  if (on) { $('#rd-hint').checked = false; $('#rd-showbox').hidden = true; $('#rd-after').hidden = true; } else { ghead(''); $('#rd-modelbox').hidden = true; }
}
function endGame(html, again) {
  if (PARTY.on && PARTY.names.length && again !== 'bee' && again !== 'pacer' && partyTurnOver(html, again)) return;
  const G = GAME; clearInterval(G && G.timer); GAME = null; WORD = null; done = true;
  gameUI(false); $('#rd-gamelist').hidden = true; $('#rd-def').hidden = true; $('#rd-word').innerHTML = ''; $('#rd-prompt').hidden = true;
  $('#rd-results').innerHTML = html + '<div class="rd-row"><button class="btn" id="rd-again">Play again</button><button class="btn ghost" id="rd-other">Other games</button></div>'; $('#rd-results').hidden = false;
  $('#rd-again').onclick = () => startGame(again); $('#rd-other').onclick = () => { $('#rd-results').hidden = true; $('#rd-gamelist').hidden = false; drawGames(); };
  if (again === 'pacer') { $('#rd-again').textContent = 'Train again'; $('#rd-other').textContent = 'Back to practice'; $('#rd-other').onclick = () => { $('#rd-results').hidden = true; const b = document.querySelector('#rd-kind [data-v="practice"]'); if (b) b.click(); }; }      /* the Speed Pacer is training, not a game (Colleen) */
}
function quitGame() { const G = GAME; if (!G) return; clearInterval(G.timer); GAME = null; WORD = null; gameUI(false); $('#rd-def').hidden = true; $('#rd-prompt').hidden = true; drawGames(); }
const wordGame = (G, w) => { GAME = G; WORD = w; wi = 0; done = false; $('#rd-prompt').hidden = false; showWord(); };
const bar = (txt, buttons) => { $('#rd-gtitle').textContent = txt; $('#rd-gbtns').innerHTML = (buttons || []).map(b => '<button class="btn ghost" data-gb="' + b[0] + '">' + b[1] + '</button>').join('') + '<button class="btn ghost" data-gb="quit">Quit</button>'; };
function startGame(k) {
  if (!landmarker && !window.__test) { $('#rd-status').textContent = 'Turn on the camera first: choose your hand above the camera.'; return; }
  if (PARTY.on && PARTY.names.length && k !== 'bee' && k !== 'pacer' && !PARTY.going) return partyStart(k);
  PARTY.going = false;
  if (GAME) clearInterval(GAME.timer);
  gameUI(true); $('#rd-results').hidden = true; MOT = []; BRUN = 0;
  const any = (lo, hi) => { const out = new Set(); CATS.forEach(c => (window.FS_WORDS[c] || []).forEach(w => { w = String(w).toUpperCase(); if (/^[A-Z]+$/.test(w) && w.length >= lo && w.length <= hi) out.add(w); })); return [...out]; };
  const G = { k, score: 0 }; GAME = G; WORD = null;
  if (k === 'def' || k === 'echo') {
    const P = k === 'def' ? any(3, 9).filter(w => { const d = defOf(w); return d && !/\b(first|last|family) name\b|^\S+ is a name\b/i.test(window.FS_DEFS[d]); }) : pool();      /* names make poor riddles */
    if (!P.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    G.hide = true; G.left = 10; G.n = 0;
    G.next = () => { if (G.n >= 10) return endGame('<h3>' + (k === 'def' ? 'Definition to Word' : 'Echo') + '</h3><div class="big">' + G.score + ' of 10</div><p class="rd-small">words spelled' + (best(k, G.score).isNew ? ' (a new best!)' : '') + '</p>', k); G.n++; G.w = rnd(P); bar((k === 'def' ? 'Definition to Word' : 'Echo') + ': word ' + G.n + ' of 10', k === 'echo' ? [['replay', '▶ Again'], ['skip', 'Show me the word']] : [['skip', 'Show me the word']]); ghead('<b>' + G.score + '</b> spelled'); wordGame(G, G.w); if (k === 'echo') G.play(); };
    G.play = async () => { const box = $('#rd-modelbox'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false; try { await refHand.ready; await refHand.spell(G.w, { speed: () => 0.15 }); } catch (e) {} };
    G.wordDone = () => { G.score++; ghead('<b>' + G.score + '</b> spelled'); setTimeout(G.next, 1600); };
    G.skip = () => { const w = $('#rd-word'); w.innerHTML = G.w.split('').map(x => '<span class="n">' + x + '</span>').join(''); done = true; $('#rd-def').textContent = '📖 ' + ((window.FS_DEFS || {})[defOf(G.w)] || ''); setTimeout(G.next, 2600); };
    G.next();
  } else if (k === 'names') {
    const P = CLASSNAMES && CLASSNAMES.length >= 3 ? CLASSNAMES : (window.FS_WORDS.NAME || []).map(w => String(w).toUpperCase()).filter(w => /^[A-Z]{2,12}$/.test(w));
    const mine = !!(CLASSNAMES && CLASSNAMES.length >= 3), order = shuffleA(P); G.n = 0;
    G.next = () => { if (G.n >= Math.min(10, order.length)) return endGame('<h3>Name Game</h3><div class="big">' + G.score + ' of ' + G.n + '</div><p class="rd-small">names spelled' + (best('names', G.score).isNew ? ' (a new best!)' : '') + '</p>', k); G.w = order[G.n++]; bar('Name Game: ' + (mine ? 'names in your class' : 'popular names') + ', ' + G.n + ' of ' + Math.min(10, order.length), [['skip', 'Skip']]); ghead('<b>' + G.score + '</b> spelled'); wordGame(G, G.w); };
    G.wordDone = () => { G.score++; ghead('<b>' + G.score + '</b> spelled'); setTimeout(G.next, 1200); }; G.skip = G.next;
    G.next();
  } else if (k === 'speed') {
    const P = pool().filter(w => w.length <= 6); if (!P.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    G.end = Date.now() + 60000; bar('Speed Spell', [['skip', 'Skip']]);
    G.next = () => wordGame(G, rnd(P)); G.wordDone = () => { G.score++; setTimeout(G.next, 500); }; G.skip = G.next;
    G.timer = setInterval(() => { const t = Math.max(0, Math.ceil((G.end - Date.now()) / 1000)); ghead('<b>' + G.score + '</b> words · <b>' + t + '</b> s'); if (t <= 0) { const b = best('speed', G.score); endGame('<h3>Speed Spell</h3><div class="big">' + G.score + '</div><p class="rd-small">words in 60 seconds' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); } }, 200);
    G.next();
  } else if (k === 'ladder') {
    const P = any(3, 10); G.len = 3; G.lives = 3;
    G.next = () => { const L = P.filter(w => w.length === G.len); bar('Spelling Ladder', [['skip', 'Skip (lose a heart)']]); ghead('Step <b>' + (G.len - 2) + '</b> · ' + G.len + ' letters · ' + '❤️'.repeat(G.lives)); wordGame(G, rnd(L.length ? L : P)); };
    G.wordDone = () => { G.score = G.len - 2; if (G.len >= 10) return G.over(true); G.len++; setTimeout(G.next, 900); };
    G.over = top => { const b = best('ladder', G.score); endGame('<h3>Spelling Ladder</h3><div class="big">Step ' + G.score + '</div><p class="rd-small">' + (top ? 'You reached the top!' : 'Out of hearts.') + (b.isNew ? ' A new best!' : b.old !== undefined ? ' Best: step ' + b.old + '.' : '') + '</p>', k); };
    G.skip = () => { G.lives--; if (G.lives <= 0) return G.over(false); G.next(); };
    G.next();
  } else if (k === 'hang') {
    const P = any(4, 9).filter(w => !/[JZ]/.test(w)); G.free = true; G.w = rnd(P); G.got = new Set(); G.miss = []; G.tries = 6;
    G.paint = () => { $('#rd-prompt').hidden = false; $('#rd-word').hidden = false; $('#rd-word').innerHTML = G.w.split('').map(x => '<span class="' + (G.got.has(x) ? 'd' : 'n') + '">' + (G.got.has(x) ? x : '_') + '</span>').join(''); ghead('Misses: <b>' + (G.miss.join(' ') || '–') + '</b> · ' + '❤️'.repeat(G.tries - G.miss.length)); };
    G.letter = c => { if (G.got.has(c) || G.miss.includes(c)) { $('#rd-tip').textContent = 'You already tried ' + c; return; } if (G.w.includes(c)) { G.got.add(c); flash(c); } else { G.miss.push(c); const box = $('#rd-oops'); box.textContent = 'No ' + c + '.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 1200); } G.paint();
      if ([...G.w].every(x => G.got.has(x))) { const n = G.miss.length; best('hang', 6 - n); endGame('<h3>You found it!</h3><div class="big">' + G.w + '</div><p class="rd-small">with ' + n + ' miss' + (n === 1 ? '' : 'es') + '</p>', k); } else if (G.miss.length >= G.tries) endGame('<h3>Out of tries</h3><div class="big">' + G.w + '</div><p class="rd-small">was the word.</p>', k); };
    bar('Camera Hangman: sign one letter at a time', []); G.paint();
  } else if (k === 'wordle') {
    const P = any(5, 5).filter(w => !/[JZ]/.test(w)); G.free = true; G.w = rnd(P); G.rows = []; G.cur = '';
    const score = g => { const out = Array(5).fill('n'), left = {}; [...G.w].forEach((x, i) => { if (g[i] === x) out[i] = 'y'; else left[x] = (left[x] || 0) + 1; }); [...g].forEach((x, i) => { if (out[i] !== 'y' && left[x]) { out[i] = 'm'; left[x]--; } }); return out; };
    G.paint = () => { $('#rd-prompt').hidden = false; $('#rd-word').hidden = false; $('#rd-word').innerHTML = '<div class="rd-wordle">' + G.rows.map(r => r.g.split('').map((x, i) => '<i class="' + r.s[i] + '">' + x + '</i>').join('')).concat(G.rows.length < 6 ? [G.cur.padEnd(5, ' ').split('').map(x => '<i class="t">' + x + '</i>').join('')] : []).map(r => '<div>' + r + '</div>').join('') + '</div>'; ghead('Guess <b>' + Math.min(6, G.rows.length + 1) + '</b> of 6 · green = right spot, yellow = in the word'); };
    G.letter = c => { if (G.cur.length >= 5) return; G.cur += c; flash(c); G.paint(); if (G.cur.length === 5) setTimeout(() => { const s2 = score(G.cur); G.rows.push({ g: G.cur, s: s2 }); const won = G.cur === G.w; G.cur = ''; G.paint();
      if (won) { best('wordle', 7 - G.rows.length); endGame('<h3>You got it in ' + G.rows.length + '!</h3><div class="big">' + G.w + '</div>', k); } else if (G.rows.length >= 6) endGame('<h3>So close</h3><div class="big">' + G.w + '</div><p class="rd-small">was the word.</p>', k); }, 600); };
    G.undo = () => { G.cur = G.cur.slice(0, -1); G.paint(); };
    bar('ASL Wordle: fingerspell a five-letter word', [['undo', '⌫ Undo a letter']]); G.paint();
  } else if (k === 'math') {
    G.mask = true; G.n = 0;
    const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)), canRead = n => Number.isInteger(n) && n >= 0 && n <= 9999;      /* the camera reads every number now; answers stay under 10,000 */
    const calc = (a, op, b) => op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b;
    const make = () => { const lv = MLEVEL; for (let t = 0; t < 400; t++) {
      let op = rnd(['+', '-', 'x', '/']), a, b;
      if (lv === 'easy') { if (op === '+') { a = ri(1, 10); b = ri(0, 10); } else if (op === '-') { a = ri(2, 20); b = ri(0, a); } else if (op === 'x') { a = ri(1, 5); b = ri(0, 5); } else { b = ri(1, 5); a = b * ri(0, 5); } }
      else if (lv === 'medium') { if (op === '+') { a = ri(12, 60); b = ri(8, 39); } else if (op === '-') { a = ri(30, 99); b = ri(11, a); } else if (op === 'x') { a = ri(3, 12); b = ri(3, 12); } else { b = ri(3, 12); a = b * ri(2, 12); } }
      else {      /* hard: three numbers, order of operations (Colleen: difficult problems) */
        const op2 = rnd(['+', '-', 'x', '/']); a = ri(8, 99); b = ri(3, 25); const c = ri(2, 15);
        if (op === '/' && a % b) continue; if (op2 === '/' && (op === 'x' || op === '/' ? calc(a, op, b) % c : b % c)) continue;
        const hi = o => o === 'x' || o === '/', ans = hi(op2) && !hi(op) ? calc(a, op, calc(b, op2, c)) : calc(calc(a, op, b), op2, c);
        if (canRead(ans) && ans > 20) return { a, b, c, op, op2, ans }; continue; }
      const ans = calc(a, op, b); if (canRead(ans)) return { a, b, op, ans }; }
      return { a: 6, b: 7, op: 'x', ans: 42 }; };
    const SIGN = { '+': '+', '-': '−', x: '×', '/': '÷' };
    G.next = () => { if (G.n >= 10) return endGame('<h3>Math Answer</h3><div class="big">' + G.score + ' of 10</div><p class="rd-small">answers signed' + (best('math-' + MLEVEL, G.score).isNew ? ' (a new best!)' : '') + '</p>', k); G.n++; G.p = make(); SET = [String(G.p.ans)]; bar('Math Answer (' + MLEVEL + '): problem ' + G.n + ' of 10', [['watch', '▶ Watch it signed'], ['calc', '🧮 Calculator'], ['skip', 'Show the answer']]); ghead('<span class="rd-math">' + G.q() + ' = ?</span>'); go(0); };
    G.q = () => G.p.a + ' ' + SIGN[G.p.op] + ' ' + G.p.b + (G.p.op2 ? ' ' + SIGN[G.p.op2] + ' ' + G.p.c : '');
    G.numDone = () => { G.score++; ghead('<span class="rd-math">' + G.q() + ' = ' + G.p.ans + '</span>'); $('#rd-letter').textContent = G.p.ans; setTimeout(G.next, 1200); };
    G.watch = async () => { const box = $('#rd-gmodel'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false;      /* the hand signs the problem right beside it, above the camera (Colleen) */ try { await refHand.ready; await refHand.sign(G.p.a, {}); await refHand.signOp(G.p.op, {}); await refHand.sign(G.p.b, {}); if (G.p.op2) { await refHand.signOp(G.p.op2, {}); await refHand.sign(G.p.c, {}); } } catch (e) {} };
    G.skip = () => { done = true; $('#rd-letter').textContent = G.p.ans; setTimeout(G.next, 2000); };
    $('#rd-calc').hidden = true; G.next();
  } else if (k === 'count') {
    G.i = 1; G.t0 = Date.now(); bar('Count Up: 1 to 20', [['skip', 'Skip (adds 5 seconds)']]);
    G.next = () => { SET = [String(G.i)]; go(0); };
    G.numDone = () => { G.i++; if (G.i > 20) { const secs = Math.round((Date.now() - G.t0) / 100) / 10, b = best('count', secs, true); return endGame('<h3>Count Up</h3><div class="big">' + secs + ' s</div><p class="rd-small">1 to 20' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ' s)' : '') + '</p>', k); } setTimeout(G.next, 250); };
    G.skip = () => { G.t0 -= 5000; G.numDone(); };
    G.timer = setInterval(() => ghead('Number <b>' + Math.min(G.i, 20) + '</b> of 20 · <b>' + Math.round((Date.now() - G.t0) / 1000) + '</b> s'), 200);
    G.next();
  } else if (k === 'clock') {
    const P = nPool().length ? nPool() : DIGITS.slice(); G.lives = 3; G.limit = 9;
    G.next = () => { SET = [rnd(P)]; G.end = Date.now() + G.limit * 1000; go(0); };
    G.numDone = () => { G.score++; G.limit = Math.max(3, G.limit - 0.5); setTimeout(G.next, 500); };
    bar('Beat the Clock (uses the numbers chosen under Practice)', []);
    G.timer = setInterval(() => { const t = Math.max(0, (G.end - Date.now()) / 1000); ghead('<b>' + G.score + '</b> signed · ' + '❤️'.repeat(G.lives) + ' · <b>' + t.toFixed(1) + '</b> s'); if (t <= 0 && !done) { G.lives--; const box = $('#rd-oops'); box.textContent = 'Time! It was ' + SET[0] + '.'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 1400);
      if (G.lives <= 0) { const b = best('clock', G.score); return endGame('<h3>Beat the Clock</h3><div class="big">' + G.score + '</div><p class="rd-small">numbers signed' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); } G.next(); } }, 100);
    G.next();
  } else if (PICKGAMES[k]) PICKGAMES[k](G, k);
  else if (LETTERGAMES[k]) LETTERGAMES[k](G, k);
}
/* ---------- choose, then sign (Colleen, 2026-10-17: age and year games, Higher or Lower, Price Is Right) ----------
   The student picks or types an answer (the camera can only check a sign it expects), then signs it; the camera has to see it before it counts. */
const later = (G, fn, ms) => setTimeout(() => { if (GAME === G) fn(); }, ms);      /* only while this game is still on */
function gpic(html) { const e = $('#rd-gpic'); e.innerHTML = html || ''; e.hidden = !html; }
function gchoose(html, wire) { const e = $('#rd-gchoose'); e.innerHTML = html || ''; e.hidden = !html; if (wire) wire(e); }
function gtype(label, lo, hi, then) {      /* a number box and a Sign it button */
  gchoose('<label class="rd-gtype">' + label + ' <input type="number" inputmode="numeric" min="' + lo + '" max="' + hi + '" id="rd-gin"></label><button class="btn" id="rd-ggo">Sign it</button><p class="rd-small" id="rd-gmsg"></p>', e => {
    const go2 = () => { const v = Math.round(+$('#rd-gin').value); if (!(v >= lo && v <= hi) || $('#rd-gin').value === '') { $('#rd-gmsg').textContent = 'Type a number from ' + lo + ' to ' + hi + '.'; return; } then(v); };
    $('#rd-ggo').onclick = go2; $('#rd-gin').onkeydown = ev => { if (ev.key === 'Enter') go2(); }; setTimeout(() => { try { $('#rd-gin').focus(); } catch (x) {} }, 50); });
}
function gpicks(list, label, then) {      /* choice buttons */
  gchoose('<div class="rd-gpicks">' + list.map(v => '<button class="btn ghost" data-v="' + v + '">' + label(v) + '</button>').join('') + '</div>', e => { e.onclick = ev => { const b = ev.target.closest('[data-v]'); if (b) then(+b.dataset.v); }; });
}
function gsign(target, msg) { gchoose(''); SET = [target]; go(0); $('#rd-tip').textContent = msg || 'Now sign it'; }
function gsay(html, ms, next) { gchoose('<div class="rd-gsay">' + html + '</div>'); const g0 = GAME; if (next) setTimeout(() => { if (GAME === g0) next(); }, ms || 1800); }      /* only if this game is still on */
const PRICES = [['🍕', 'A large pizza', 14], ['🚲', 'A new bike', 250], ['🎮', 'A video game', 60], ['🍦', 'An ice cream cone', 4], ['👟', 'Brand-name sneakers', 120], ['📱', 'A new phone', 800],
  ['🎟️', 'A movie ticket', 13], ['🎧', 'Wireless earbuds', 150], ['🧸', 'A teddy bear', 20], ['🚗', 'A new car', 28000], ['🏀', 'A basketball', 30], ['🎸', 'A beginner guitar', 150],
  ['📚', 'A paperback book', 12], ['🥤', 'A large soda', 3], ['🛹', 'A skateboard', 80], ['💻', 'A laptop', 700], ['🐶', 'A dog from a shelter (adoption fee)', 150], ['⌚', 'A smartwatch', 300]];      /* about what they cost; a game, not a store */
const PICKGAMES = {
  charlie(G, k) {      /* Charlie's picture; four ages, each from a different time of life; sign the one you pick as an AGE */
    const C = window.CHARLIE; if (!C) return endGame('<p>Charlie did not load. Reload the page.</p>', k);
    G.n = 0; G.score = 0; bar('How Old Is ' + C.NAME + '?', [['skip', 'Skip']]);
    const ageIn = i => { const s = C.STAGES[i]; return s[2] + Math.floor(Math.random() * (s[3] - s[2] + 1)); };
    G.next = () => { if (G.n >= 8) return endGame('<h3>How Old Is ' + C.NAME + '?</h3><div class="big">' + G.score + ' of 8</div><p class="rd-small">ages right' + (best('charlie', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      G.n++; const st = Math.floor(Math.random() * C.STAGES.length), others = shuffleA(C.STAGES.map((x, i) => i).filter(i => Math.abs(i - st) >= 2)).slice(0, 3);
      G.right = C.STAGES[st]; gpic('<div class="rd-pic">' + C.picture(st) + '</div>'); ghead('Round <b>' + G.n + '</b> of 8 · <b>' + G.score + '</b> right');
      $('#rd-letter').textContent = '?'; gpicks(shuffleA([st].concat(others)).map(ageIn), v => 'Age ' + v, v => { G.pick = v; gsign('a' + v, 'Sign AGE ' + v + ': start at your chin'); }); };
    G.numDone = () => { const ok = G.pick >= G.right[2] && G.pick <= G.right[3]; if (ok) G.score++; gsay(ok ? '✅ Yes! ' + C.NAME + ' is ' + G.right[2] + ' to ' + G.right[3] + ' here.' : '❌ ' + C.NAME + ' is ' + G.right[2] + ' to ' + G.right[3] + ' here. You signed ' + G.pick + ' well, though!', 2200, G.next); };
    G.skip = G.next; G.next();
  },
  guessage(G, k) {      /* type any age; closer = more points (the age in Colleen's picture) */
    const C = window.CHARLIE; if (!C) return endGame('<p>Charlie did not load. Reload the page.</p>', k);
    G.n = 0; G.score = 0; bar('Guess My Age', [['skip', 'Skip']]);
    G.next = () => { if (G.n >= 6) return endGame('<h3>Guess My Age</h3><div class="big">' + G.score + '</div><p class="rd-small">points out of 600' + (best('guessage', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      G.n++; const st = Math.floor(Math.random() * C.STAGES.length); G.age = C.STAGES[st][1]; gpic('<div class="rd-pic">' + C.picture(st) + '</div>'); ghead('Round <b>' + G.n + '</b> of 6 · <b>' + G.score + '</b> points');
      $('#rd-letter').textContent = '?'; gtype('How old is ' + C.NAME + '?', 1, 99, v => { G.pick = v; gsign('a' + v, 'Sign AGE ' + v + ': start at your chin'); }); };
    G.numDone = () => { const off = Math.abs(G.pick - G.age), pts = Math.max(0, 100 - off * 10); G.score += pts; gsay((off === 0 ? '🎯 Exactly ' : off <= 3 ? '🔥 So close! ' : off <= 8 ? '👍 Not bad! ' : '🤔 ') + C.NAME + ' is ' + G.age + ' here. <b>+' + pts + '</b>', 2200, G.next); };
    G.skip = G.next; G.next();
  },
  years(G, k) {      /* Colleen's event pictures; four years: the right one, a nearby one, a look-alike (swapped or another century) and one far off */
    const E = (window.EVENTS || []).filter(e => e.year >= 1000 && e.year <= 2099); if (!E.length) return endGame('<p>The event pictures did not load. Reload the page.</p>', k);
    const order = shuffleA(E); G.n = 0; G.score = 0; bar('When Did It Happen?', [['skip', 'Skip']]);
    const ok = y => y >= 1000 && y <= 2099;
    const choices = y => { const out = [y], add = v => { if (ok(v) && out.indexOf(v) < 0) out.push(v); };
      const swap = Math.floor(y / 100) * 100 + (y % 10) * 10 + Math.floor((y % 100) / 10); if (swap !== y) add(swap); add(y + (y >= 2000 ? -100 : 100)); add(y - 100);
      for (let t = 0; out.length < 3 && t < 20; t++) add(y + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.floor(Math.random() * 30)));
      out.length = Math.min(out.length, 3); for (let t = 0; out.length < 4 && t < 40; t++) add(y >= 1850 ? 1100 + Math.floor(Math.random() * 500) : 2030 + Math.floor(Math.random() * 60));      /* far off */
      return shuffleA(out); };
    G.next = () => { if (G.n >= Math.min(8, order.length)) return endGame('<h3>When Did It Happen?</h3><div class="big">' + G.score + ' of ' + G.n + '</div><p class="rd-small">years right' + (best('years', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      G.e = order[G.n++]; gpic('<div class="rd-pic"><img src="events/' + G.e.img + '" alt=""><b>' + G.e.title + '</b></div>'); ghead('Event <b>' + G.n + '</b> · <b>' + G.score + '</b> right');
      $('#rd-letter').textContent = '?'; gpicks(choices(G.e.year), v => String(v), v => { G.pick = v; gsign('y' + v, 'Sign the year ' + v); }); };
    G.numDone = () => { const okk = G.pick === G.e.year; if (okk) G.score++; gsay(okk ? '✅ Yes! ' + G.e.title + ': ' + G.e.year + '.' : '❌ It was ' + G.e.year + '. You signed ' + G.pick + ' well, though!', 2400, G.next); };
    G.skip = G.next; G.next();
  },
  hilo(G, k) {      /* a secret number 1-100; each guess is signed; fewer guesses = better */
    G.secret = 1 + Math.floor(Math.random() * 100); G.tries = 0; G.lo = 1; G.hi = 100; bar('Higher or Lower', [['skip', 'Give up']]);
    G.ask = () => { gpic('<div class="rd-hilo">🔢 <b>' + G.lo + '</b> to <b>' + G.hi + '</b></div>'); ghead('Guesses: <b>' + G.tries + '</b>'); $('#rd-letter').textContent = '?'; gtype('Your guess', 1, 100, v => { G.pick = v; gsign(String(v), 'Sign ' + v); }); };
    G.numDone = () => { G.tries++; const v = G.pick;
      if (v === G.secret) { const b = best('hilo', G.tries, true); return endGame('<h3>You found it!</h3><div class="big">' + G.secret + '</div><p class="rd-small">in ' + G.tries + ' guess' + (G.tries === 1 ? '' : 'es') + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); }
      if (v < G.secret) G.lo = Math.max(G.lo, v + 1); else G.hi = Math.min(G.hi, v - 1);
      gsay(v < G.secret ? '🔼 Higher than ' + v + '!' : '🔽 Lower than ' + v + '!', 1300, G.ask); };
    G.skip = () => endGame('<h3>The number was</h3><div class="big">' + G.secret + '</div>', k); G.ask();
  },
  price(G, k) {      /* guess, sign, then the price; going over scores 0 */
    const order = shuffleA(PRICES); G.n = 0; G.score = 0; bar('Price Is Right', [['skip', 'Skip']]);
    G.next = () => { if (G.n >= 5) return endGame('<h3>Price Is Right</h3><div class="big">' + G.score + '</div><p class="rd-small">points out of 500' + (best('price', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      G.it = order[G.n++]; gpic('<div class="rd-hilo"><span style="font-size:72px">' + G.it[0] + '</span><b>' + G.it[1] + '</b><small>about how many dollars?</small></div>'); ghead('Item <b>' + G.n + '</b> of 5 · <b>' + G.score + '</b> points');
      $('#rd-letter').textContent = '?'; gtype('Your price: $', 1, 9999, v => { G.pick = v; gsign(String(v), 'Sign ' + v); }); };
    G.numDone = () => { const p = G.it[2], v = G.pick, over = v > p, pts = over ? 0 : Math.max(0, Math.round(100 - 100 * (p - v) / p)); G.score += pts;
      gsay((over ? '💥 Over! ' : pts >= 90 ? '🎯 Wow! ' : pts >= 60 ? '👍 Close! ' : '🤔 ') + 'About <b>$' + p.toLocaleString('en-US') + '</b>. <b>+' + pts + '</b>', 2400, G.next); };
    G.skip = G.next; G.next();
  }
};
/* ---------- take turns (Colleen, 2026-10-17: "any group game that can have a solo mode, should. and vice versa"): every camera game can be played
   by a group at one camera. Each player plays the same game in turn; the scores line up at the end (lower is better for the timed games). ---------- */
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const anyWords = (lo, hi) => { const out = new Set(); CATS.forEach(c => (window.FS_WORDS[c] || []).forEach(w => { w = String(w).toUpperCase(); if (/^[A-Z]+$/.test(w) && w.length >= lo && w.length <= hi) out.add(w); })); return [...out]; };
let PARTY = { on: false, names: [], i: 0, scores: [], k: '' };
try { const p0 = JSON.parse(localStorage.getItem('fs-cam-party') || 'null'); if (p0 && Array.isArray(p0.names)) PARTY.names = p0.names.slice(0, 40); } catch (e) {}
const LOWER = { count: 1, racer: 1, boss: 1, hilo: 1 };
function partyBar() {
  if (!PARTY.on) return '<div class="rd-party"><button class="btn ghost" id="rd-partyon">👥 Take turns (group)</button><span class="rd-small">Play any game with friends at this camera.</span></div>';
  return '<div class="rd-party on"><b>👥 Taking turns:</b> ' + PARTY.names.map(esc).join(', ') + ' <button class="btn ghost" id="rd-partyedit">Change players</button><button class="btn ghost" id="rd-partyoff">Play alone</button></div>';
}
function partyAsk() {
  const names = PARTY.names.length ? PARTY.names : (CLASSNAMES || []).slice(0, 30);
  $('#rd-results').innerHTML = '<h3>👥 Who is playing?</h3><p class="rd-small">One name per line (first names only). Each player takes a turn at the camera.</p><textarea id="rd-partynames" rows="6" style="width:100%;font:inherit">' + esc(names.join('\n')) + '</textarea>' +
    '<div class="rd-row"><button class="btn" id="rd-partygo">Start taking turns</button><button class="btn ghost" id="rd-partycancel">Cancel</button></div>';
  $('#rd-results').hidden = false; $('#rd-gamelist').hidden = true;
  $('#rd-partygo').onclick = () => { const L = $('#rd-partynames').value.split(/\n+/).map(x => x.trim().replace(/[<>]/g, '').slice(0, 24)).filter(Boolean).slice(0, 40); if (L.length < 2) { alert('Type at least two names.'); return; }
    PARTY.names = L; PARTY.on = true; try { localStorage.setItem('fs-cam-party', JSON.stringify({ names: L })); } catch (e) {} $('#rd-results').hidden = true; $('#rd-gamelist').hidden = false; drawGames(); };
  $('#rd-partycancel').onclick = () => { $('#rd-results').hidden = true; $('#rd-gamelist').hidden = false; drawGames(); };
}
document.addEventListener('click', e => { const t = e.target; if (!t || !t.id) return;
  if (t.id === 'rd-partyon' || t.id === 'rd-partyedit') partyAsk();
  else if (t.id === 'rd-partyoff') { PARTY.on = false; drawGames(); } });
function partyStart(k) {      /* before each turn: whose turn it is */
  if (PARTY.k !== k || PARTY.i >= PARTY.names.length) { PARTY.k = k; PARTY.i = 0; PARTY.scores = []; }
  const name = PARTY.names[PARTY.i];
  $('#rd-results').innerHTML = '<h3>🎤 ' + esc(name) + '\u2019s turn</h3><p class="rd-small">Turn ' + (PARTY.i + 1) + ' of ' + PARTY.names.length + '. Step up to the camera!</p><div class="rd-row"><button class="btn" id="rd-turngo">Start</button><button class="btn ghost" id="rd-turnskip">Skip ' + esc(name) + '</button></div>';
  $('#rd-results').hidden = false; $('#rd-gamelist').hidden = true;
  $('#rd-turngo').onclick = () => { $('#rd-results').hidden = true; PARTY.going = true; startGame(k); };
  $('#rd-turnskip').onclick = () => { PARTY.scores.push([name, null]); PARTY.i++; partyNext(k); };
}
function partyTurnOver(html, k) {      /* the game ended: keep this player's score, then the next player (or the scores) */
  const G = GAME; if (G) clearInterval(G.timer); GAME = null; WORD = null; done = true; gameUI(false); $('#rd-def').hidden = true; $('#rd-prompt').hidden = true;
  const m = /class="big">([^<]*)</.exec(html), v = m ? parseFloat(m[1].replace(/[^0-9.\-]/g, '')) : NaN;
  PARTY.scores.push([PARTY.names[PARTY.i], isFinite(v) ? v : null, m ? m[1] : '–']); PARTY.i++; PARTY.going = false;
  $('#rd-results').innerHTML = html.replace('<h3>', '<h3>' + esc(PARTY.names[PARTY.i - 1]) + ': '); $('#rd-results').hidden = false;
  setTimeout(() => partyNext(k), 2500); return true;
}
function partyNext(k) {
  if (PARTY.i < PARTY.names.length) return partyStart(k);
  const lower = !!LOWER[k], S2 = PARTY.scores.filter(x => x[1] !== null).sort((a, b) => lower ? a[1] - b[1] : b[1] - a[1]), medal = ['🥇', '🥈', '🥉'];
  $('#rd-results').innerHTML = '<h3>🏆 Scores</h3><ol class="rd-board">' + S2.map((x, i) => '<li>' + (medal[i] || '') + ' <b>' + esc(x[0]) + '</b> ' + esc(x[2]) + '</li>').join('') + '</ol>' +
    '<div class="rd-row"><button class="btn" id="rd-partyagain">Play again</button><button class="btn ghost" id="rd-partyother">Other games</button></div>';
  $('#rd-results').hidden = false; PARTY.i = 0;
  $('#rd-partyagain').onclick = () => { PARTY.scores = []; partyStart(k); }; $('#rd-partyother').onclick = () => { $('#rd-results').hidden = true; $('#rd-gamelist').hidden = false; drawGames(); };
}
document.addEventListener('click', e => { if (e.target && e.target.id === 'rd-pacebtn') startGame('pacer'); });
/* ---------- SPEED PACER (Colleen, 2026-10-17): the student picks a speed; each letter gets its time slot and the word moves on whether they keep up
   or not, with a pause between words to look at the next one. Much more forgiving than the other modes: no hold, no direction or must-have
   checks (but the palm must face the right way: a wrong palm never counts), no double-letter slide; the right letter among the top guesses for a moment (two frames) anywhere in its slot (plus a little grace)
   counts. J and Z count from their handshape (I, or the pointer finger). ---------- */
const PACES = [[0.5, 'Very slow', '1 letter every 2 seconds'], [1, 'Slow', '1 letter a second'], [1.5, 'Steady', '3 letters every 2 seconds'], [2, 'Quick', '2 letters a second'], [3, 'Fast', '3 letters a second'], [4, 'Native-like', '4 letters a second']];
const PACE_ALIKE = { J: ['J', 'I'], Z: ['Z', 'D', 'G'] };
function paceRead(f, L) {
  const P = GAME.pace; if (!P.run || P.i < 0 || !WORD) { dots(L, -1, false); return; }
  const R = rank(f), palmOK = c => { const A = TPL[c]; return !A || (dot(f.orient.slice(0, 3), A.orient.slice(0, 3)) >= 0.7 && dot(f.orient.slice(3), A.orient.slice(3)) >= 0.2); };      /* the palm facing the wrong way never counts, even here (Colleen) */
  const check = i => { const want = (PACE_ALIKE[WORD[i]] || [WORD[i]]).filter(palmOK); if (!want.length) return false; const top = R.slice(0, 3), dT = Math.min(...want.map(c => (R.find(x => x[0] === c) || [0, 99])[1]));
    return top.some(x => want.indexOf(x[0]) >= 0) || dT <= R[0][1] * 1.4 + 0.15; };
  let hit = false;
  [P.i, P.i - 1].forEach(i => { if (i < 0 || P.got[i] !== null || (i === P.i - 1 && clock() - P.slotAt > P.grace)) return;      /* the letter just before still counts for a moment (grace) */
    if (check(i)) { P.seen[i] = (P.seen[i] || 0) + 1; if (P.seen[i] >= 2) { P.got[i] = true; hit = true; P.paint(); } } else P.seen[i] = 0; });
  dots(L, -1, hit || P.got[P.i] === true);
  $('#rd-tip').textContent = P.got[P.i] ? 'Got it!' : 'Sign ' + WORD[P.i];
}
/* ---------- more letter games (Colleen, 2026-10-17: "actually fun games") ---------- */
const PICS = [['🐱', 'CAT'], ['🐶', 'DOG'], ['🐟', 'FISH'], ['🐦', 'BIRD'], ['🐸', 'FROG'], ['🐷', 'PIG'], ['🐮', 'COW'], ['🐻', 'BEAR'], ['🦁', 'LION'], ['🦆', 'DUCK'], ['🐝', 'BEE'], ['🦉', 'OWL'],
  ['🐯', 'TIGER'], ['🦓', 'ZEBRA'], ['🐍', 'SNAKE'], ['🐋', 'WHALE'], ['🐢', 'TURTLE'], ['🦒', 'GIRAFFE'], ['🍎', 'APPLE'], ['🍕', 'PIZZA'], ['🎂', 'CAKE'], ['🥚', 'EGG'], ['🥛', 'MILK'], ['🌮', 'TACO'],
  ['🌽', 'CORN'], ['🍐', 'PEAR'], ['🍇', 'GRAPES'], ['🍋', 'LEMON'], ['🍌', 'BANANA'], ['🥕', 'CARROT'], ['🍞', 'BREAD'], ['🧀', 'CHEESE'], ['🍪', 'COOKIE'], ['🍩', 'DONUT'], ['🚗', 'CAR'], ['🚌', 'BUS'],
  ['🚲', 'BIKE'], ['⛵', 'BOAT'], ['✈️', 'PLANE'], ['🚆', 'TRAIN'], ['🚀', 'ROCKET'], ['⚽', 'BALL'], ['📖', 'BOOK'], ['☀️', 'SUN'], ['🌙', 'MOON'], ['⭐', 'STAR'], ['🌳', 'TREE'], ['🌸', 'FLOWER'],
  ['❄️', 'SNOW'], ['🏠', 'HOUSE'], ['📱', 'PHONE'], ['⏰', 'CLOCK'], ['🎩', 'HAT'], ['👟', 'SHOE'], ['🧦', 'SOCKS'], ['🔑', 'KEY'], ['🎁', 'GIFT'], ['❤️', 'HEART'], ['🔔', 'BELL'], ['🥁', 'DRUM'],
  ['🎸', 'GUITAR'], ['🤖', 'ROBOT'], ['👻', 'GHOST'], ['👑', 'CROWN'], ['🌈', 'RAINBOW'], ['🍔', 'BURGER'], ['🧁', 'CUPCAKE'], ['🦋', 'BUTTERFLY'], ['🐙', 'OCTOPUS'], ['🦈', 'SHARK']];
const BLITZ = [['FRUIT', 'a fruit'], ['VEGETABLE', 'a vegetable'], ['ANIMAL', 'an animal'], ['COLOR', 'a color'], ['CANDY', 'a candy'], ['DRINK', 'a drink'], ['CLOTHES', 'clothes'], ['FLOWER', 'a flower'], ['GAME', 'a game']];
const clean = w => String(w).toUpperCase().replace(/[^A-Z]/g, '');
let DICT = null;
const dict = () => DICT || (DICT = new Set([].concat(...Object.values(window.FS_WORDS || {}).map(L => L.map(clean)), Object.keys(window.FS_DEFS || {}).map(clean), PICS.map(p => p[1])).filter(w => w.length >= 2)));
const noJZ = w => !/[JZ]/.test(w);      /* letters that fall, pop up or get typed letter by letter are read one still handshape at a time */
function freeBar(G, title, extra) { bar(title, (extra || []).concat([['undo', '⌫ Undo a letter'], ['clr', 'Clear']])); G.undo = () => { G.cur = G.cur.slice(0, -1); G.paint(); }; G.gb_clr = () => { G.cur = ''; G.paint(); }; }
/* the solo versions of the class camera games: Race to 50 (a goal, timed) and Fill the Jar (two minutes, marbles) */
function soloCount(G, k, jar) {
  const nums = NUMS, P = nums ? (nPool().length ? nPool() : DIGITS.slice()) : pool(); if (!P.length) return endGame('<p>Nothing fits. Choose other ' + (nums ? 'numbers' : 'words') + ' in Practice first.</p>', k);
  const unit = nums ? 'number' : 'word';
  const paint = () => { const v = G.score;
    if (jar) { const cap = Math.max(20, Math.ceil((v + 1) / 20) * 20); gpic('<div class="jars"><div class="jar"><div class="glass"><div class="fill" style="height:' + Math.min(100, 100 * v / cap) + '%"></div></div><b>' + v + '</b></div></div>'); }
    else gpic('<div class="rd-hilo"><b>' + v + ' / ' + G.goal + '</b><div class="camtrack"><i style="width:' + Math.min(100, 100 * v / G.goal) + '%"></i></div></div>'); };
  const go1 = () => { if (nums) { SET = [rnd(P)]; go(0); } else wordGame(G, rnd(P)); };
  const hit = () => { G.score++; paint(); if (!jar && G.score >= G.goal) { const secs = Math.round((Date.now() - G.t0) / 100) / 10, b = best('r50-' + unit + '-' + G.goal, secs, true); return endGame('<h3>Race to ' + G.goal + '</h3><div class="big">' + secs + ' s</div><p class="rd-small">' + G.goal + ' ' + unit + 's' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ' s)' : '') + '</p>', k); } later(G, go1, nums ? 400 : 600); };
  G.score = 0; G.wordDone = hit; G.numDone = hit; G.skip = go1;
  const start = goal => { G.goal = goal; G.t0 = Date.now(); gchoose(''); bar(jar ? 'Fill the Jar' : 'Race to ' + goal, [['skip', 'Skip']]); paint(); go1();
    G.timer = setInterval(() => { const el = (Date.now() - G.t0) / 1000;
      if (jar) { const t = Math.max(0, Math.ceil(120 - el)); ghead('<b>' + G.score + '</b> marbles · <b>' + t + '</b> s'); if (t <= 0) { const b = best('jar-' + unit, G.score); endGame('<h3>Fill the Jar</h3><div class="big">' + G.score + '</div><p class="rd-small">marbles in two minutes' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); } }
      else ghead('<b>' + G.score + '</b> of ' + G.goal + ' · <b>' + el.toFixed(1) + '</b> s'); }, 200); };
  if (jar) return start(0);
  bar('Race to 50', []); gpicks([10, 25, 50], v => v + ' ' + unit + 's', start);
}
const LETTERGAMES = {
  picture(G, k) {
    const order = shuffleA(PICS); G.n = 0; G.score = 0; G.hideLetter = true;
    G.next = () => { if (G.n >= 10) return endGame('<h3>Picture Spell</h3><div class="big">' + G.score + ' of 10</div><p class="rd-small">pictures spelled' + (best('picture', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      const P = order[G.n++]; G.w = P[1]; bar('Picture Spell', [['skip', 'Show me and skip']]); gpic('<div class="rd-hilo"><span style="font-size:110px;line-height:1">' + P[0] + '</span></div>'); ghead('Picture <b>' + G.n + '</b> of 10 · <b>' + G.score + '</b> spelled'); G.hide = true; wordGame(G, G.w); };
    G.wordDone = () => { G.score++; ghead('✅ <b>' + G.w + '</b>'); later(G, G.next, 1300); };
    G.skip = () => { done = true; $('#rd-word').innerHTML = G.w.split('').map(x => '<span class="n">' + x + '</span>').join(''); later(G, G.next, 2200); };
    G.next();
  },
  scramble(G, k) {
    const P = pool().filter(w => w.length >= 4 && w.length <= 7 && new Set(w).size > 2); if (!P.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    G.n = 0; G.score = 0; G.hideLetter = true;
    const mix = w => { for (let t = 0; t < 20; t++) { const m = shuffleA(w.split('')).join(''); if (m !== w) return m; } return w.split('').reverse().join(''); };
    G.next = () => { if (G.n >= 10) return endGame('<h3>Unscramble</h3><div class="big">' + G.score + ' of 10</div><p class="rd-small">words unscrambled' + (best('scramble', G.score).isNew ? ' (a new best!)' : '') + '</p>', k);
      G.n++; G.w = rnd(P); bar('Unscramble', [['skip', 'Show me and skip']]); gpic('<div class="rd-scram">' + mix(G.w).split('').map(x => '<i>' + x + '</i>').join('') + '</div>'); ghead('Word <b>' + G.n + '</b> of 10 · <b>' + G.score + '</b> right'); G.hide = true; wordGame(G, G.w); };
    G.wordDone = () => { G.score++; ghead('✅ <b>' + G.w + '</b>'); later(G, G.next, 1300); };
    G.skip = () => { done = true; $('#rd-word').innerHTML = G.w.split('').map(x => '<span class="n">' + x + '</span>').join(''); later(G, G.next, 2200); };
    G.next();
  },
  chain(G, k) {      /* free letters; ✓ checks the word (a real word from the word lists, starting with the right letter, not used yet) */
    const D = dict(), starts = [...D].filter(w => w.length === 4 && noJZ(w)); G.free = true; G.cur = ''; G.used = [rnd(starts)]; G.end = Date.now() + 120000;
    freeBar(G, 'Word Chain', [['ok', '✓ Check my word']]);
    G.need = () => G.used[G.used.length - 1].slice(-1);
    G.paint = () => { gpic('<div class="rd-chain">' + G.used.slice(-4).map((w, i, a) => '<span' + (i === a.length - 1 ? ' class="last"' : '') + '>' + w + '</span>').join(' → ') + '</div>');
      $('#rd-prompt').hidden = false; $('#rd-word').hidden = false; $('#rd-word').innerHTML = '<span class="c">' + G.need() + '</span>' + (G.cur.slice(1) || '…').split('').map(x => '<span class="d">' + x + '</span>').join(''); };
    G.letter = c => { if (!G.cur) { if (c !== G.need()) { $('#rd-tip').textContent = 'Start with ' + G.need(); return; } } G.cur += c; flash(c); G.paint(); };
    G.gb_ok = () => { const w = G.cur; if (w.length < 2) return; if (G.used.indexOf(w) >= 0) { $('#rd-tip').textContent = w + ' is already in the chain'; return; }
      if (!D.has(w)) { $('#rd-tip').textContent = w + ' is not in the word lists. Try another word.'; return; } G.used.push(w); G.cur = ''; flash('✓'); G.paint(); };
    G.timer = setInterval(() => { const t = Math.max(0, Math.ceil((G.end - Date.now()) / 1000)); ghead('Chain: <b>' + (G.used.length - 1) + '</b> words · <b>' + t + '</b> s'); if (t <= 0) { const n = G.used.length - 1, b = best('chain', n); endGame('<h3>Word Chain</h3><div class="big">' + n + '</div><p class="rd-small">words: ' + G.used.join(' → ') + (b.isNew ? ' (a new best!)' : '') + '</p>', k); } }, 250);
    G.paint();
  },
  blitz(G, k) {      /* free letters; a word in the category counts as soon as it is complete (or with ✓) */
    const cats = BLITZ.filter(c => (window.FS_WORDS[c[0]] || []).length), C = rnd(cats), words = new Set((window.FS_WORDS[C[0]] || []).map(clean).filter(w => w.length >= 3 && noJZ(w)));
    G.free = true; G.cur = ''; G.got = []; G.end = Date.now() + 60000; freeBar(G, 'Category Blitz: spell ' + C[1], [['ok', '✓ Check my word']]);
    G.paint = () => { gpic('<div class="rd-hilo">⚡ Spell <b>' + C[1] + '</b><small>' + (G.got.join(', ') || 'Any word in the category counts') + '</small></div>'); $('#rd-prompt').hidden = false; $('#rd-word').hidden = false; $('#rd-word').innerHTML = (G.cur || '…').split('').map(x => '<span class="d">' + x + '</span>').join(''); };
    const take = w => { G.got.push(w); G.cur = ''; flash('✓'); G.paint(); };
    G.letter = c => { G.cur += c; flash(c); if (words.has(G.cur) && G.got.indexOf(G.cur) < 0 && ![...words].some(w => w !== G.cur && w.startsWith(G.cur))) take(G.cur); else G.paint(); };
    G.gb_ok = () => { const w = G.cur; if (G.got.indexOf(w) >= 0) { $('#rd-tip').textContent = 'You already spelled ' + w; return; } if (words.has(w)) take(w); else $('#rd-tip').textContent = w + ' is not on the ' + C[1] + ' list.'; };
    G.timer = setInterval(() => { const t = Math.max(0, Math.ceil((G.end - Date.now()) / 1000)); ghead('<b>' + G.got.length + '</b> words · <b>' + t + '</b> s'); if (t <= 0) { const b = best('blitz', G.got.length); endGame('<h3>Category Blitz: ' + C[1] + '</h3><div class="big">' + G.got.length + '</div><p class="rd-small">' + (G.got.join(', ') || 'Try again!') + (b.isNew ? ' (a new best!)' : '') + '</p>', k); } }, 250);
    G.paint();
  },
  rain(G, k) {      /* letters fall in the picture area; a signed letter pops the lowest one like it */
    const L = 'ABCDEFGHIKLMNOPQRSTUVWXY'.split(''); G.free = true; G.drops = []; G.lives = 3; G.score = 0; G.speed = 9; G.t0 = Date.now(); G.id = 0;
    bar('Letter Rain', []); gpic('<div class="rd-rain" id="rd-rain"></div>');
    const box = () => $('#rd-rain');
    G.spawn = () => { const b = box(); if (!b) return; const d = { id: ++G.id, c: rnd(L), x: 6 + Math.random() * 82, y: 0 }; G.drops.push(d); const e = document.createElement('i'); e.id = 'rd-drop' + d.id; e.textContent = d.c; e.style.left = d.x + '%'; b.appendChild(e); };
    G.letter = c => { const hit = G.drops.filter(d => d.c === c).sort((a, b) => b.y - a.y)[0]; if (!hit) { $('#rd-tip').textContent = 'No ' + c + ' falling right now'; return; }
      G.drops = G.drops.filter(d => d !== hit); const e = $('#rd-drop' + hit.id); if (e) { e.classList.add('pop'); setTimeout(() => e.remove(), 300); } G.score++; G.speed = Math.max(4, G.speed - 0.15); flash(c); };
    let last = Date.now(), nextAt = 0;
    G.timer = setInterval(() => { const now = Date.now(), dt = (now - last) / 1000; last = now; if (now >= nextAt) { G.spawn(); nextAt = now + Math.max(900, 2600 - G.score * 60); }
      G.drops.slice().forEach(d => { d.y += 100 * dt / G.speed; const e = $('#rd-drop' + d.id); if (e) e.style.top = d.y + '%';
        if (d.y >= 92) { G.drops = G.drops.filter(x => x !== d); if (e) { e.classList.add('splat'); setTimeout(() => e.remove(), 400); } G.lives--; } });
      ghead('<b>' + G.score + '</b> popped · ' + '❤️'.repeat(Math.max(0, G.lives)));
      if (G.lives <= 0) { const b = best('rain', G.score); endGame('<h3>Letter Rain</h3><div class="big">' + G.score + '</div><p class="rd-small">letters popped' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); } }, 50);
  },
  whack(G, k) {      /* nine holes; a mole holds a letter for a few seconds; 60 seconds */
    const L = 'ABCDEFGHIKLMNOPQRSTUVWXY'.split(''); G.free = true; G.score = 0; G.miss = 0; G.end = Date.now() + 60000; G.moles = {};
    bar('Whack-a-Letter', []); gpic('<div class="rd-whack" id="rd-whack">' + Array.from({ length: 9 }, (_, i) => '<div class="hole" id="rd-hole' + i + '"><span></span></div>').join('') + '</div>');
    const show = () => { const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !G.moles[i]); if (!free.length) return; const i = rnd(free), c = rnd(L.filter(x => !Object.values(G.moles).some(m => m.c === x)));
      G.moles[i] = { c, until: Date.now() + Math.max(2200, 4200 - G.score * 80) }; const h = $('#rd-hole' + i); h.classList.add('up'); h.querySelector('span').textContent = c; };
    const down = (i, hit) => { const h = $('#rd-hole' + i); if (!h) return; h.classList.remove('up'); if (hit) { h.classList.add('bonk'); setTimeout(() => h.classList.remove('bonk'), 350); } delete G.moles[i]; };
    G.letter = c => { const i = Object.keys(G.moles).find(j => G.moles[j].c === c); if (i === undefined) { $('#rd-tip').textContent = 'No mole is holding ' + c; return; } down(i, true); G.score++; flash(c); };
    let nextAt = 0;
    G.timer = setInterval(() => { const now = Date.now(); Object.keys(G.moles).forEach(i => { if (now > G.moles[i].until) { down(i, false); G.miss++; } });
      if (now >= nextAt && Object.keys(G.moles).length < (G.score >= 12 ? 3 : 2)) { show(); nextAt = now + Math.max(700, 1600 - G.score * 30); }
      const t = Math.max(0, Math.ceil((G.end - now) / 1000)); ghead('<b>' + G.score + '</b> bonked · <b>' + t + '</b> s');
      if (t <= 0) { const b = best('whack', G.score); endGame('<h3>Whack-a-Letter</h3><div class="big">' + G.score + '</div><p class="rd-small">moles bonked' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); } }, 100);
  },
  racer(G, k) {      /* 30 letters of short words; the ghost car drives at the pace of your best time */
    const P = pool().filter(w => w.length >= 3 && w.length <= 5); if (!P.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    const GOAL = 30, ghostSecs = best('racer').old; G.letters = 0; G.t0 = 0;
    bar('Fingerspell Racer', [['skip', 'Skip this word']]); gpic('<div class="rd-race"><div class="lane"><span class="car" id="rd-car">🏎️</span></div>' + (ghostSecs ? '<div class="lane ghost"><span class="car" id="rd-ghost">👻</span></div>' : '') + '<div class="finish">🏁</div></div>');
    G.onLetter = () => { if (!G.t0) G.t0 = Date.now(); G.letters++; };
    G.next = () => wordGame(G, rnd(P));
    G.wordDone = () => { G.onLetter(); if (G.letters >= GOAL) { const secs = Math.round((Date.now() - G.t0) / 100) / 10, b = best('racer', secs, true); return endGame('<h3>Fingerspell Racer</h3><div class="big">' + secs + ' s</div><p class="rd-small">for ' + GOAL + ' letters' + (b.isNew ? ' (a new best: the ghost car gets faster!)' : b.old !== undefined ? ' (ghost: ' + b.old + ' s)' : '') + '</p>', k); } later(G, G.next, 400); };
    G.skip = G.next;
    G.timer = setInterval(() => { const pct = Math.min(1, G.letters / GOAL), car = $('#rd-car'), gh = $('#rd-ghost'); if (car) car.style.left = (pct * 88) + '%';
      const el = G.t0 ? (Date.now() - G.t0) / 1000 : 0; if (gh && ghostSecs) gh.style.left = (Math.min(1, el / ghostSecs) * 88) + '%';
      ghead('<b>' + G.letters + '</b> of ' + GOAL + ' letters · <b>' + el.toFixed(1) + '</b> s'); }, 100);
    G.next();
  },
  r50(G, k) { soloCount(G, k, false); },
  jar(G, k) { soloCount(G, k, true); },
  pacer(G, k) {
    const P0 = pool(); if (!P0.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    let pick = 1; try { pick = +localStorage.getItem('fs-cam-pace') || 1; } catch (e) {}
    bar('Speed Pacer', []); gpic('');
    gchoose('<div class="rd-gsay" style="font-size:18px">🎵 How fast are you aiming for?</div><div class="rd-gpicks">' + PACES.map(p => '<button class="btn ' + (p[0] === pick ? '' : 'ghost') + '" data-v="' + p[0] + '">' + p[1] + '<br><small>' + p[2] + '</small></button>').join('') + '</div>' +
      '<label class="rd-gtype">Pause between words <select id="rd-pacegap"><option value="1500">1.5 s</option><option value="2500" selected>2.5 s</option><option value="4000">4 s</option></select></label><p class="rd-small">Uses the word lengths and lists chosen under Practice. 10 words.</p>', e => {
      e.onclick = ev => { const b = ev.target.closest('[data-v]'); if (!b) return; const lps = +b.dataset.v; try { localStorage.setItem('fs-cam-pace', lps); } catch (x) {} start(lps, +$('#rd-pacegap').value); }; });
    const start = (lps, gap) => {
      gchoose(''); const name = (PACES.find(p => p[0] === lps) || PACES[1])[1];
      const P = G.pace = { lps, gap, slot: 1000 / lps, grace: Math.min(350, 450 / lps), i: -1, got: [], seen: [], run: false, n: 0, hits: 0, total: 0, slotAt: 0 };
      bar('Speed Pacer: ' + name, [['skip', 'Skip this word']]);
      P.paint = () => { $('#rd-word').hidden = false; $('#rd-word').innerHTML = WORD.split('').map((x, i) => '<span class="' + (P.got[i] === true ? 'ph' : P.got[i] === false ? 'pm' : i === P.i ? 'c' : 'n') + '">' + x + '</span>').join(''); };
      const nextWord = () => {
        if (P.n >= 10) { const pct = P.total ? Math.round(100 * P.hits / P.total) : 0, b = best('pacer-' + lps, pct); return endGame('<h3>Speed Pacer: ' + name + '</h3><div class="big">' + pct + '%</div><p class="rd-small">' + P.hits + ' of ' + P.total + ' letters at ' + (PACES.find(p => p[0] === lps) || [0, '', ''])[2] + (b.isNew ? ' (a new best for this speed!)' : b.old !== undefined ? ' (best: ' + b.old + '%)' : '') + (pct >= 85 ? '. Ready to try the next speed up?' : '') + '</p>', k); }
        P.n++; P.tok = (P.tok || 0) + 1; WORD = rnd(P0); wi = 0; done = false; P.i = -1; P.got = WORD.split('').map(() => null); P.seen = []; P.run = false;
        $('#rd-prompt').hidden = false; P.paint(); $('#rd-letter').textContent = '…'; ghead('Word <b>' + P.n + '</b> of 10 · get ready…');
        const tk = P.tok; later(G, () => { if (tk === P.tok) { P.run = true; slot(0, tk); } }, gap);
      };
      const slot = (i, tk) => {
        if (tk !== P.tok) return;      /* a skipped word stops its own clock */
        if (i > 0 && P.got[i - 1] === null) later(G, () => { if (P.got[i - 1] === null) { P.got[i - 1] = false; P.paint(); } }, P.grace);      /* missed: red once its grace is over */
        if (i >= WORD.length) { P.run = false; later(G, () => { P.got.forEach((g, j) => { if (g === null) P.got[j] = false; }); P.total += WORD.length; P.hits += P.got.filter(x => x === true).length; P.paint(); later(G, nextWord, 700); }, P.grace + 20); return; }
        P.i = i; P.slotAt = clock(); $('#rd-letter').textContent = WORD[i]; P.paint(); ghead('Word <b>' + P.n + '</b> of 10 · <b>' + (P.total ? Math.round(100 * P.hits / P.total) : 100) + '%</b> so far');
        later(G, () => slot(i + 1, tk), P.slot);
      };
      G.skip = () => { if (!P.run) return; P.run = false; P.tok++; P.got = P.got.map(g => g === true); P.total += WORD.length; P.hits += P.got.filter(Boolean).length; P.paint(); later(G, nextWord, 500); };
      nextWord();
    };
  },
  bee(G, k) {      /* group: the players (Take turns names, or 2+ typed now) take turns; a miss or running out of time sits you down; words get longer each round.
                     Alone: one player, one miss ends it (how many words?). The teacher (or the player) presses Missed it for a wrong letter. */
    const P = anyWords(3, 12); if (!P.length) return endGame('<p>No words fit.</p>', k);
    const solo = !(PARTY.on && PARTY.names.length >= 2);
    G.players = solo ? [{ n: 'You', out: false }] : PARTY.names.map(n => ({ n, out: false })); G.turn = -1; G.round = 1; G.len = 3; G.secs = 30; G.mode = 'read'; G.n = 0;
    gpic(''); gchoose('<div class="rd-gsay" style="font-size:18px">🐝 ' + (solo ? 'Solo bee: spell until you miss' : G.players.length + ' players: ' + G.players.map(x => esc(x.n)).join(', ')) + '</div>' +
      '<label class="rd-gtype">The word is <select id="rd-beemode"><option value="read">shown</option><option value="hand">fingerspelled by the hand (hidden)</option><option value="def">a definition (hidden)</option></select></label>' +
      '<label class="rd-gtype">Time per word <select id="rd-beesecs"><option value="20">20 s</option><option value="30" selected>30 s</option><option value="60">60 s</option><option value="0">no limit</option></select></label><button class="btn" id="rd-beego">Start the bee</button>' +
      (solo ? '<p class="rd-small">Playing with a group? Quit, press 👥 Take turns, add the names, then choose Spelling Bee.</p>' : ''));
    bar('Spelling Bee', []);
    $('#rd-beego').onclick = () => { G.mode = $('#rd-beemode').value; G.secs = +$('#rd-beesecs').value; bar('Spelling Bee', [['miss', '❌ Missed it'], ['replay', '🔁 Show again']]); G.next(); };
    const alive = () => G.players.filter(x => !x.out);
    G.next = () => {
      const A = alive(); if ((!solo && A.length <= 1) || (solo && A.length === 0)) return G.over();
      do { G.turn = (G.turn + 1) % G.players.length; if (G.turn === 0 && G.n) { G.round++; G.len = Math.min(12, G.len + 1); } } while (G.players[G.turn].out);
      G.n++; const L = P.filter(w => w.length === G.len && (G.mode !== 'def' || defOf(w))), pick = L.length ? L : P; G.w = rnd(pick); G.hide = G.mode !== 'read'; G.hideLetter = G.hide;
      G.end = G.secs ? Date.now() + G.secs * 1000 : 0;
      gpic('<div class="rd-bee">' + G.players.map((x, i) => '<span class="' + (x.out ? 'out' : i === G.turn ? 'now' : '') + '">' + (x.out ? '🪑 ' : i === G.turn ? '🎤 ' : '') + esc(x.n) + '</span>').join('') + '</div>');
      wordGame(G, G.w); if (G.mode === 'hand') G.play();
    };
    G.play = async () => { if (G.mode !== 'hand') return; const box = $('#rd-modelbox'), cv = $('#rd-model'); box.appendChild(cv); box.hidden = false; try { await refHand.ready; await refHand.spell(G.w, { speed: () => 0.15 }); } catch (e) {} };
    G.wordDone = () => { G.players[G.turn].words = (G.players[G.turn].words || 0) + 1; ghead('✅ <b>' + esc(G.players[G.turn].n) + '</b> spelled ' + G.w); later(G, G.next, 1400); };
    G.gb_miss = () => { if (!WORD) return; G.players[G.turn].out = true; done = true; $('#rd-word').innerHTML = G.w.split('').map(x => '<span class="n">' + x + '</span>').join(''); ghead('❌ <b>' + esc(G.players[G.turn].n) + '</b> sits down. The word was ' + G.w); later(G, G.next, 2200); };
    G.over = () => { const A = alive(), win = solo ? null : A[0];
      if (solo) { const n = G.players[0].words || 0, b = best('bee', n); return endGame('<h3>Spelling Bee</h3><div class="big">' + n + '</div><p class="rd-small">words before a miss' + (b.isNew ? ' (a new best!)' : b.old !== undefined ? ' (best: ' + b.old + ')' : '') + '</p>', k); }
      endGame('<h3>🐝 ' + (win ? esc(win.n) + ' wins the Spelling Bee!' : 'Spelling Bee') + '</h3><div class="big">Round ' + G.round + '</div><p class="rd-small">' + G.players.map(x => esc(x.n) + ': ' + (x.words || 0)).join(' · ') + '</p>', k); };
    G.timer = setInterval(() => { if (!G.end || !WORD || done) { if (G.turn >= 0 && !G.end) ghead('Round <b>' + G.round + '</b> · ' + G.len + ' letters · <b>' + esc((G.players[G.turn] || {}).n || '') + '</b>'); return; }
      const t = Math.max(0, Math.ceil((G.end - Date.now()) / 1000)); ghead('Round <b>' + G.round + '</b> · <b>' + esc(G.players[G.turn].n) + '</b> · <b>' + t + '</b> s'); if (t <= 0) G.gb_miss(); }, 250);
  },
  boss(G, k) {      /* the boss loses 6 health per letter of each word you spell; every 15 seconds it attacks (3 hearts) */
    const P = pool().filter(w => w.length >= 3 && w.length <= 7); if (!P.length) return endGame('<p>No words fit. Choose other words in Practice first.</p>', k);
    const BOSSES = ['👾', '🐉', '🦖', '👹', '🤖', '🐙']; G.hp = 100; G.lives = 3; G.boss = rnd(BOSSES); G.t0 = Date.now(); G.hitAt = Date.now() + 15000;
    bar('Boss Battle', [['skip', 'Skip this word']]);
    G.paint = hurt => { gpic('<div class="rd-boss' + (hurt ? ' hurt' : '') + '"><span class="b">' + G.boss + '</span><div class="hp"><i style="width:' + Math.max(0, G.hp) + '%"></i></div><small>Boss health ' + Math.max(0, G.hp) + '</small></div>'); };
    G.next = () => wordGame(G, rnd(P));
    G.wordDone = w => { G.hp -= (w || '').length * 6 || 18; G.paint(true); flash('💥'); if (G.hp <= 0) { const secs = Math.round((Date.now() - G.t0) / 1000), b = best('boss', secs, true); return endGame('<h3>You beat the boss! ' + G.boss + '</h3><div class="big">' + secs + ' s</div><p class="rd-small">' + (b.isNew ? 'A new best!' : b.old !== undefined ? 'Best: ' + b.old + ' s' : '') + '</p>', k); } later(G, G.next, 500); };
    G.skip = G.next;
    G.timer = setInterval(() => { const left = Math.max(0, Math.ceil((G.hitAt - Date.now()) / 1000)); ghead('❤️'.repeat(Math.max(0, G.lives)) + ' · the boss attacks in <b>' + left + '</b> s');
      if (Date.now() >= G.hitAt) { G.lives--; G.hitAt = Date.now() + 15000; const box = $('#rd-oops'); box.textContent = G.boss + ' attacks!'; box.hidden = false; setTimeout(() => { box.hidden = true; }, 1200);
        if (G.lives <= 0) endGame('<h3>The boss won this time ' + G.boss + '</h3><div class="big">' + Math.max(0, G.hp) + '</div><p class="rd-small">health left. Try again!</p>', k); } }, 250);
    G.paint(false); G.next();
  }
};
/* free letters (Hangman, Wordle): any letter held on purpose counts once; the same letter again needs the hand to change or slide first */
let FREE = { c: '', ms: 0, lock: '', x0: 0 };
let MLEVEL = 'easy'; try { MLEVEL = localStorage.getItem('fs-cam-mlevel') || 'easy'; } catch (e) {}
/* the on-screen calculator (Colleen): for working out the answer; the camera still needs the answer signed */
let CALC = '';
function calcKey(k) {
  const d = $('#rd-calcd');
  if (k === 'C') CALC = ''; else if (k === '⌫') CALC = CALC.slice(0, -1);
  else if (k === '=') { try { const v = Function('return (' + CALC.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/[^0-9+\-*/(). ]/g, '') + ')')(); CALC = isFinite(v) ? String(Math.round(v * 1000) / 1000) : ''; } catch (e) { CALC = ''; } }
  else CALC += k;
  d.textContent = CALC || '0';
}
$('#rd-calc').onclick = e => { const b = e.target.closest('button'); if (b) calcKey(b.dataset.k); };
function freeRead(f, L) {
  const R = rank(f).filter(x => !MOVING[x[0]] && x[0].length === 1 && /[A-Z]/.test(x[0])), top = R[0][0], ok = nearModel(f, top, 2) && (!GATE[top] || GATE[top][0](f)) && (!TPL[top] || (dot(f.orient.slice(0, 3), TPL[top].orient.slice(0, 3)) >= 0.7 && dot(f.orient.slice(3), TPL[top].orient.slice(3)) >= 0.2)), now = clock();      /* the must-haves apply here too */
  const dt = Math.min(100, FREE.t ? now - FREE.t : 33); FREE.t = now; dots(L, -1, false);
  if (FREE.lock && (top !== FREE.lock || Math.abs(L[0].x - FREE.x0) > 0.06)) FREE.lock = '';
  if (!ok || top === FREE.lock) { FREE.ms = 0; $('#rd-hold').style.width = '0'; $('#rd-tip').textContent = FREE.lock ? 'Next letter' : 'Sign a letter'; return; }
  FREE.ms = top === FREE.c ? FREE.ms + dt : 0; FREE.c = top; $('#rd-tip').textContent = 'Reading: ' + top; $('#rd-hold').style.width = Math.min(100, 100 * FREE.ms / HOLD) + '%';
  if (FREE.ms >= HOLD) { FREE.ms = 0; FREE.lock = top; FREE.x0 = L[0].x; if (GAME && GAME.letter) GAME.letter(top); }
}
$('#rd-mlevel').onclick = e => { const b = e.target.closest('button'); if (!b) return; MLEVEL = b.dataset.v; try { localStorage.setItem('fs-cam-mlevel', MLEVEL); } catch (x) {} drawGames(); };
$('#rd-gamelist').onclick = e => { const b = e.target.closest('[data-g]'); if (b) startGame(b.dataset.g); };
$('#rd-gbtns').onclick = e => { const b = e.target.closest('[data-gb]'); if (!b || !GAME) return; const v = b.dataset.gb; if (v === 'quit') quitGame(); else if (v === 'skip' && GAME.skip) GAME.skip(); else if (v === 'replay' && GAME.play) GAME.play(); else if (v === 'undo' && GAME.undo) GAME.undo(); else if (v === 'watch' && GAME.watch) GAME.watch(); else if (v === 'calc') { $('#rd-calc').hidden = !$('#rd-calc').hidden; } else if (GAME['gb_' + v]) GAME['gb_' + v](); };
/* ---------- set up ---------- */
const setHand = h => { LEFT = h === 'left'; document.body.classList.toggle('lefty', LEFT); $('#rd-handname').textContent = LEFT ? 'left' : 'right'; try { localStorage.setItem('fs-reader-hand', h); } catch (e) {} };
$$('[data-hand]').forEach(b => b.onclick = () => { setHand(b.dataset.hand); start(); });      /* asks first: right or left hand (Colleen) */
$('#rd-switch').onclick = () => setHand(LEFT ? 'right' : 'left');
$('#rd-skip').onclick = () => { if (WORD) { if (done) return newWord(); wi++; if (wi >= WORD.length) wordDone(); else showWord(); } else go(cur + 1); }; $('#rd-prev').onclick = () => { if (WORD) { if (wi > 0 && !done) { wi--; showWord(); } } else go(cur - 1); }; $('#rd-rand').onclick = () => { if (WORD) newWord(); else go(Math.floor(Math.random() * SET.length)); };
$('#rd-alpha').onclick = e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); };
$('#rd-teachbtn').onclick = () => { if (!landmarker) return; if (NUMS && SET[cur].length > 1) { $('#rd-status').textContent = 'Teaching works for 0 to 9. Moving numbers are read from the movement.'; return; } if (!NUMS && MOVING[SET[cur]]) { $('#rd-status').textContent = 'J and Z are read from the motion, so they don\u2019t need teaching.'; return; } teachBuf = []; teaching = 30; $('#rd-teachbtn').disabled = true; $('#rd-teachbtn').textContent = 'Hold still…'; };
$('#rd-forget').onclick = () => { delete MINE[SET[cur]]; saveMine(); drawAlpha(); };
refHand = window.FSHand.create($('#rd-model'), {});
refHand.ready.then(() => { STILL.forEach(c => { const P = refHand.poseJoints(c); if (P) TPL[c] = feat(P); });
  STILL.filter(c => !'WFOC'.includes(c)).forEach(c => { if (TPL[c]) NOTNUM[c] = TPL[c]; }); { const P = refHand.numberJoints(10, false); if (P) NOTNUM['thumbs up'] = feat(P); }      /* W = 6, F = 9, O and C = 0: those stay out */
  DIGITS.forEach(c => { const n = +c, P = refHand.numberJoints(n, false); if (P) TPL[c] = feat(P); if (n >= 1 && n <= 5) { const Q = refHand.numberJoints(n, true); if (Q) ALT[c] = feat(Q); } });      /* 1-5: palm toward you (counting) or palm out (inside a bigger number); both count */
  go(0); $('#rd-status').textContent = NUMS ? 'Ready: numbers.' : 'Ready: all 26 letters.'; });
if (WANT_GAME) { const gb = document.querySelector('#rd-kind [data-v="games"]'); if (gb) setTimeout(() => gb.click(), 0); }      /* show the game list until the camera is on */
{ const want = ONLY === 'numbers' || QS.get('kind') === 'numbers' ? 'numbers' : ''; const b = want && document.querySelector('#rd-mode [data-v="numbers"]'); if (b) { $$('#rd-mode button').forEach(x => x.classList.toggle('on', x === b)); setNums(true); $('#rd-ask').textContent = 'Sign this number'; ckAbout(); } }
window.READER = { ageArea, setFaceDemo: v => { FACE = v; }, ageRead, face: () => FACE, setFace: v => { FACE = v; }, startGame, game: () => GAME, freeRead, maskWord, bouncy, setB: v => { BOUNCE = v; }, NOTNUM, go, isDone: () => done, ckStart, setNums, seqRead, seqStart, KEYS, DECOY, SEQ: () => SEQ, NSETS, nPool, roll, squash, setNS: v => { NS = v; }, DIGITS, ALT, SET: () => SET, ckRecord, ckFinish, ck: () => CK, setWord: (w, i) => { WORD = w; wi = i; showWord(); }, at: () => [WORD, wi], TPL, MINE, feat, rank, dist, LETTERS, readMotion, MOT: () => MOT, setMOT: v => { MOT = v; }, pool, oopsCheck, MIX: () => MIX };      /* for testing */
