/* Pronoun Signs: ME / MY / YOU / YOUR on the camera (Colleen, 2026-10-17; spec dev/pronoun-drills/). Uses pronoun-engine.js (the game rules),
   pronoun-recognize.js (the four gestures) and Colleen's bank (pronoun-sentences.js). MediaPipe's hand reader and face finder run on this
   computer; nothing is recorded. One clock: performance.now(). */
import { FilesetResolver, HandLandmarker, FaceDetector } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const ENG = window.PRONOUN, REC = window.PRONOUN_REC, G = ENG.GESTURES;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const now = () => performance.now();
const WASM = 'https:' + '/' + '/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL = 'https:' + '/' + '/storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL = 'https:' + '/' + '/storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/* ---------- settings (remembered on this computer) ---------- */
const S = Object.assign({ drill: 'I_ME_MY', diff: 'Easy', pace: 'beginner', mode: 'both', voice: '', rate: 1, shuffle: true, repeat: true, preview: false, count: '10' }, load('pron-set', {}));
let CAL = load('pron-cal', null), MINE = load('pron-mine', []), STATS = load('pron-stats', { rounds: 0, targets: 0, correct: 0, kinds: {}, errors: {} });
const T = Object.assign({ wpm: 110, win: 0.75, grace: 0.25, explain: 4 }, load('pron-teach', {}));
const saveS = () => save('pron-set', S);
function opts(el, items, key, after) {
  el.innerHTML = items.map(([v, label, small]) => '<button data-v="' + esc(v) + '" class="' + (S[key] === v ? 'on' : '') + '">' + esc(label) + (small ? '<small>' + esc(small) + '</small>' : '') + '</button>').join('');
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; S[key] = b.dataset.v; saveS(); opts(el, items, key, after); if (after) after(); };
}
function drawSetup() {
  opts($('#oDrill'), Object.entries(ENG.DRILLS).map(([k, v]) => [k, v]), 'drill', count);
  opts($('#oDiff'), [['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']], 'diff', count);
  opts($('#oPace'), Object.entries(ENG.PACES).map(([k, p]) => [k, p.name, k === 'beginner' ? 'waits for the right sign' : k === 'intermediate' ? 'explains, then moves on' : k === 'interpreter' ? 'never stops' : 'timed']), 'pace');
  opts($('#oMode'), [['read', 'Read it'], ['hear', 'Hear it'], ['both', 'Both']], 'mode', () => { $('#voiceBox').hidden = S.mode === 'read'; });
  $('#voiceBox').hidden = S.mode === 'read';
  ['shuffle', 'repeat', 'preview'].forEach(k => { const c = $('#o' + k[0].toUpperCase() + k.slice(1)); c.checked = !!S[k]; c.onchange = () => { S[k] = c.checked; saveS(); }; });
  $('#oCount').value = S.count; $('#oCount').onchange = () => { S.count = $('#oCount').value; saveS(); };
  $('#oRate').value = S.rate; $('#oRateV').textContent = (+S.rate).toFixed(1) + '×'; $('#oRate').oninput = () => { S.rate = +$('#oRate').value; $('#oRateV').textContent = S.rate.toFixed(1) + '×'; saveS(); };
  $('#calNote').innerHTML = CAL && (CAL.point || CAL.flat) ? '✓ Calibrated on this computer.' : '<b>Tip:</b> calibrate first (the Calibrate tab, about 20 seconds) so the camera learns which way <i>your</i> hand points.';
  count();
}
/* INSIDE ASL STUDY (opened from the Practice page or the games): the teacher's own sentences from the Pronoun Sentences / Pronoun Targets
   tabs replace the built-in bank, and each finished round is sent back to be saved (only the results: which word, which sign, right or not). */
const QS = new URLSearchParams(location.search), IN_SHEET = QS.get('embed') === 'aslstudy' && !!window.opener;
let SHEET_BANK = null, SHEET_NOTES = [];
if (IN_SHEET) {
  window.addEventListener('message', e => {
    if (e.source !== window.opener || !e.data) return;
    if (e.data.type === 'fsp-pron-bank' && Array.isArray(e.data.sentences) && e.data.sentences.length) {
      const b = ENG.bankFromSheet(e.data.sentences, e.data.targets || []); SHEET_BANK = b.sentences; SHEET_NOTES = b.notes;
      $('#status').textContent = 'Your teacher\u2019s sentences: ' + SHEET_BANK.length + (SHEET_NOTES.length ? ' (' + SHEET_NOTES.length + ' left out; see the Teacher tab)' : ''); count(); drawStats();
    }
    if (e.data.type === 'fsp-cam-saved') { const el = $('#savedNote'); if (el) el.innerHTML = '✓ Saved to your class: ' + esc((e.data.got || []).join(', ')) + (e.data.milestones || []).map(m => '<div class="feedback ok" style="margin-top:6px"><b>' + esc(m.title) + '</b> ' + esc(m.text) + '</div>').join(''); }
  });
  try { window.opener.postMessage({ type: 'fsp-pron-bank?' }, '*'); } catch (e) {}
}
const bankAll = () => (SHEET_BANK || ENG.validateBank(window.PRONOUN_BANK).ok).concat(ENG.validateBank({ sentences: MINE }).ok);
function count() { const n = ENG.pick(bankAll(), { drill: S.drill, difficulty: S.diff }).length; $('#start').textContent = 'Start (' + n + ' sentences)'; $('#start').disabled = !n; }

/* ---------- voice (the computer's own voices; Colleen: a few voice options) ---------- */
let VOICES = [];
function fillVoices() {
  VOICES = (speechSynthesis.getVoices() || []).filter(v => /^en(-|_|$)/i.test(v.lang));
  const sel = $('#oVoice'); sel.innerHTML = VOICES.length ? VOICES.map(v => '<option value="' + esc(v.name) + '"' + (v.name === S.voice ? ' selected' : '') + '>' + esc(v.name.replace(/^(Microsoft|Google|Apple)\s*/, '')) + ' (' + esc(v.lang) + ')</option>').join('') : '<option value="">This computer’s voice</option>';
  sel.onchange = () => { S.voice = sel.value; saveS(); speak('This is how I sound.'); };
}
if ('speechSynthesis' in window) { fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; } else { $('#voiceBox').innerHTML = '<p class="small2">This browser can’t read aloud. Use Read it.</p>'; }
let speakId = 0;
function speak(text) {      // resolves when the words are spoken (or after a safe timeout, since some voices never report "end")
  return new Promise(res => {
    if (S.mode === 'read' || !('speechSynthesis' in window) || !String(text).trim()) return res();
    const id = ++speakId, u = new SpeechSynthesisUtterance(text), v = VOICES.find(x => x.name === S.voice);
    if (v) u.voice = v; u.rate = +S.rate || 1; let done = false; const fin = () => { if (done) return; done = true; res(id === speakId); };
    u.onend = fin; u.onerror = fin; setTimeout(fin, 1500 + text.length * 90 / (u.rate || 1)); speechSynthesis.speak(u);
  });
}
const hush = () => { speakId++; try { speechSynthesis.cancel(); } catch (e) {} };

/* ---------- camera, hands and face ---------- */
let landmarker = null, faceDet = null, files = null, video = $('#video'), draw = $('#draw'), ctx = draw.getContext('2d'), lastT = -1, frameN = 0, FACE = null;
let lastHandAt = 0, fpsT = now(), fpsN = 0, FPS = 0, LIVE = null, steady = REC.Steady({ stableMs: 250, releaseMs: 180, minConf: 0.6 });
function camStatus(kind, text) { const s = $('#camStatus'); s.className = 'status ' + kind; s.querySelector('span').textContent = text; }
async function camOn() {
  $('#camMsg').innerHTML = '<p>Starting the camera…</p>';
  try { const st = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }); video.srcObject = st; await video.play(); }
  catch (e) { $('#camMsg').innerHTML = '<p>The camera did not turn on. Check that the browser may use it (the camera icon in the address bar). Some school computers turn the camera off. You won’t lose any points for this.</p>'; camStatus('bad', 'Camera blocked'); return; }
  $('#camMsg').innerHTML = '<p>Getting the hand reader ready…</p>';
  try {
    files = await FilesetResolver.forVisionTasks(WASM);
    const mk = d => HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d }, runningMode: 'VIDEO', numHands: 1 });
    landmarker = await mk('GPU').catch(() => mk('CPU'));
    const mf = d => FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 });
    faceDet = await mf('GPU').catch(() => mf('CPU')).catch(() => null);      // the chest clue is a helper: the game works without it
  } catch (e) { $('#camMsg').innerHTML = '<p>The hand reader could not load. Your school may block it; try again at home or ask your tech team.</p>'; camStatus('bad', 'Reader blocked'); return; }
  $('#camMsg').hidden = true; draw.width = video.videoWidth; draw.height = video.videoHeight; camStatus('', 'Show your hand'); requestAnimationFrame(loop);
}
$('#camOn').onclick = camOn;
function loop() {
  requestAnimationFrame(loop);
  if (!landmarker || video.currentTime === lastT || document.hidden) return; lastT = video.currentTime;
  const t = now(), r = landmarker.detectForVideo(video, t); frameN++; fpsN++;
  if (t - fpsT > 1000) { FPS = fpsN * 1000 / (t - fpsT); fpsN = 0; fpsT = t; }
  if (faceDet && frameN % 3 === 0) { try { const fr = faceDet.detectForVideo(video, t), d = fr && fr.detections && fr.detections[0]; if (d && d.keypoints && d.keypoints.length >= 6) { const k = d.keypoints; FACE = { x: k[3].x + (k[3].x - k[2].x) * 1.3, y: k[3].y + (k[3].y - k[2].y) * 1.3, fw: Math.abs(k[4].x - k[5].x) || 0.25, t }; } else if (FACE && t - FACE.t > 1500) FACE = null; } catch (e) {} }
  ctx.clearRect(0, 0, draw.width, draw.height);
  if (!r.worldLandmarks || !r.worldLandmarks.length) { LIVE = null; handGone(t); steady(null, t); drawDiag(null, null); return; }
  lastHandAt = t; handBack(t);
  const side = r.handednesses && r.handednesses[0] && r.handednesses[0][0] ? r.handednesses[0][0].categoryName : 'Right', isLeft = side === 'Right';      // MediaPipe names hands as if the picture were mirrored; ours is not
  const P = r.worldLandmarks[0].map(p => [isLeft ? -p.x : p.x, -p.y, -p.z]);      // our frame: x right, y up, z toward the camera; a left hand mirrored
  const f = REC.features(P, r.landmarks[0], FACE && t - FACE.t < 800 ? FACE : null), c = REC.classify(f, CAL);
  LIVE = { f, c, side: isLeft ? 'left' : 'right' };
  dots(r.landmarks[0], c);
  drawDiag(f, c);
  if (CALIB) return calFrame(f, t);
  const ev = steady(c, t);
  if (ev) onSign(ev);
  camStatus(FPS && FPS < 10 ? 'bad' : 'ok', FPS && FPS < 10 ? 'Slow camera (' + Math.round(FPS) + ' fps)' : 'Camera ready · ' + (isLeft ? 'left' : 'right') + ' hand');
}
function dots(L, c) {
  const W = draw.width, H = draw.height, col = c.g && c.conf >= 0.6 ? '#3fd07a' : c.g ? '#f5b400' : 'rgba(255,255,255,.7)';
  const B = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = col;
  B.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(L[a].x * W, L[a].y * H); ctx.lineTo(L[b].x * W, L[b].y * H); ctx.stroke(); });
  if (FACE) { ctx.beginPath(); ctx.arc(FACE.x * W, FACE.y * H, 8, 0, 7); ctx.strokeStyle = '#FFC83D'; ctx.stroke(); }
  drawChest();
}
/* the chest area the recognizer uses (pronoun-recognize.js features: within 0.9 face widths of the chin's middle, from 0.1 to 2.6 face widths
   below it). Drawn only when the teacher ticks "Show the chest area", so students see a clean camera. The canvas is mirrored like the video. */
function drawChest() {
  if (!$('#tChest') || !$('#tChest').checked || !FACE) return;
  const C = REC.CHEST, W = draw.width, H = draw.height, x0 = (FACE.x - C.half * FACE.fw) * W, w = 2 * C.half * FACE.fw * W, y0 = (FACE.y + C.top * FACE.fw) * H, h = (C.bottom - C.top) * FACE.fw * H;      // exactly the recognizer's numbers (both in 0-1 picture units)
  ctx.save(); ctx.fillStyle = 'rgba(255,200,61,.16)'; ctx.strokeStyle = 'rgba(255,200,61,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, 18) : ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(x0 + w / 2, y0 + 26); ctx.scale(-1, 1); ctx.font = '700 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFE38A'; ctx.fillText('chest area: ME, MY', 0, 0); ctx.restore();      // the label un-mirrored so it reads normally
}
window.PRON_CHEST_DEMO = (face) => { FACE = Object.assign({ t: now() }, face); draw.width = 640; draw.height = 480; ctx.clearRect(0, 0, 640, 480); $('#tChest').checked = true; ctx.beginPath(); ctx.arc(FACE.x * 640, FACE.y * 480, 8, 0, 7); ctx.strokeStyle = '#FFC83D'; ctx.lineWidth = 4; ctx.stroke(); drawChest(); };
function drawDiag(f, c) {
  if ($('#t-teach').hidden) return;
  if (!f) { $('#diag').textContent = 'No hand in view.'; return; }
  const n = v => v == null ? '–' : (+v).toFixed(2);
  $('#diag').textContent = 'Reading: ' + (c.g ? G[c.g].sign + ' (' + c.g + ')' : 'none') + '   sure: ' + Math.round(c.conf * 100) + '%' + (c.why ? '  [' + c.why + ']' : '') +
    '\nHandshape: ' + f.shape + '   fingers out: ' + f.ext.map(n).join(' ') + '\nPointer aims toward camera: ' + n(f.aimZ) + '   palm faces camera: ' + n(f.palmZ) +
    '\nChest: ' + (f.chest ? (f.chest.near ? 'in front of chest' : 'away from chest') + '  size vs face: ' + n(f.chest.rel) : 'face not found') + '   direction score: ' + n(c.score) +
    '\nHand: ' + (LIVE ? LIVE.side : '–') + '   camera: ' + Math.round(FPS) + ' fps   calibrated: ' + (CAL ? JSON.stringify(CAL) : 'no (default guesses)');
}

/* ---------- the game ---------- */
let G1 = null;      // { queue, qi, round, missed, results[], repeating, t0 }
function tip(t) { $('#tip').textContent = t || ''; }
function big(t, bad) { const b = $('#big'); b.textContent = t; b.classList.toggle('no', !!bad); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
function fb(text, kind) { const e = $('#fb'); e.hidden = !text; e.className = 'feedback ' + (kind || 'info'); e.textContent = text || ''; }
$('#start').onclick = () => {
  if (!landmarker) { $('#status').textContent = 'Turn on the camera first.'; return; }
  let list = ENG.pick(bankAll(), { drill: S.drill, difficulty: S.diff, shuffle: S.shuffle }); const n = +S.count; if (n) list = list.slice(0, n);
  G1 = { queue: list, qi: 0, missed: [], results: [], repeating: false, t0: Date.now() };
  $('#setup').hidden = true; $('#done').hidden = true; $('#playing').hidden = false; $('#sent').hidden = false; drawRef(); nextSentence();
};
$('#stop').onclick = () => { if (G1) finish(true); };
function drawRef(cur) {      // the four signs, as a reminder (beginner and intermediate); timed paces keep the screen clean
  const show = S.pace === 'beginner' || S.pace === 'intermediate';
  $('#ref').innerHTML = show ? Object.entries(G).map(([k, g]) => '<div class="gcard2"><b>' + g.sign + '</b>' + esc(g.how) + '</div>').join('') : '';
}
function nextSentence() {
  hush(); fb(''); $('#cont').hidden = true;
  if (!G1) return;
  if (G1.qi >= G1.queue.length) {
    if (S.repeat && !G1.repeating && G1.missed.length) { G1.repeating = true; G1.queue = G1.missed.slice(); G1.missed = []; G1.qi = 0; fb('Now the sentences you missed, one more time.', 'info'); }
    else return finish();
  }
  const s = G1.queue[G1.qi], pace = ENG.PACES[S.pace];
  G1.round = ENG.Round(s, { pace: S.pace, grace: +T.grace, deadline: S.pace === 'interpreter' ? +T.win : undefined });
  G1.round.begin(now()); G1.sent = s; G1.lastEnd = 0;
  drawSentence(); $('#metaL').textContent = (G1.repeating ? 'Again: ' : 'Sentence ') + (G1.qi + 1) + ' of ' + G1.queue.length; $('#skip').hidden = !!pace.continuous;
  if (pace.continuous) interpreter(); else setTimeout(() => stepTo(0), 500);
}
function drawSentence(nowWord) {
  const s = G1.sent, res = G1.round.results;
  let html = '';
  ENG.tokens(s).forEach(tk => {
    if (tk.target == null) { html += esc(tk.text); return; }
    const r = res[tk.target], cls = r ? (r.kind === 'correct' ? 'ok' : 'bad') : tk.target === G1.round.cur && G1.round.opened[tk.target] != null ? 'cur' : '';
    html += '<span class="tw ' + cls + '" data-t="' + tk.target + '">' + esc(tk.text) + '</span>';
  });
  $('#sentTxt').innerHTML = html;
  $('#prev').hidden = !S.preview; if (S.preview) $('#prev').innerHTML = s.targets.map(t => '<span>' + esc(t.text) + ' → ' + G[t.gesture].sign + '</span>').join('');
  const done = res.filter(Boolean).length; $('#metaR').textContent = 'Word ' + Math.min(done + 1, s.targets.length) + ' of ' + s.targets.length;
}
function stepTo(i) {
  const s = G1.sent;
  if (i >= s.targets.length) { speak(s.sentence.slice(G1.lastEnd)).then(() => setTimeout(sentenceDone, 700)); return; }
  const seg = s.sentence.slice(G1.lastEnd, s.targets[i].end); G1.lastEnd = s.targets[i].end;
  const my = G1.round;
  speak(seg).then(() => { if (!G1 || G1.round !== my) return; handle(my.reach(i, now())); tip(S.pace === 'beginner' ? 'Sign the yellow word' : ''); });
}
function handle(evs) {
  if (!G1) return; const r = G1.round, s = G1.sent;
  evs.forEach(e => {
    if (e.type === 'reach') drawSentence();
    if (e.type === 'correct') { big('✓'); fb(''); tip(''); drawSentence(); }
    if (e.type === 'not_yet') { fb('Not yet: that looked like ' + G[e.got].sign + '. Try again.', 'bad'); }
    if (e.type === 'hint') { fb($('#fb').textContent + ' ' + e.text, 'bad'); }
    if (e.type === 'retry') { tip('Hold it steady so the camera can see which way your hand faces'); }
    if (e.type === 'wrong') { big('✗', true); drawSentence(); flashTarget(e.i); if (e.quick) fb('That was ' + G[e.got].sign + '. It’s ' + G[s.targets[e.i].gesture].sign + '.', 'bad'); }
    if (e.type === 'timeout') { drawSentence(); flashTarget(e.i); if (S.pace !== 'interpreter') fb('Time’s up: it was ' + G[s.targets[e.i].gesture].sign + '.', 'bad'); }
    if (e.type === 'explain') { fb(e.text, 'bad'); $('#cont').hidden = false; const my = r; const go = () => { if (G1 && G1.round === my && !$('#cont').hidden) { $('#cont').hidden = true; handle(my.advanceAfterExplain(e.i, now())); } }; $('#cont').onclick = go; setTimeout(go, (+T.explain || 4) * 1000); }
    if (e.type === 'advance') { const my = r; setTimeout(() => { if (G1 && G1.round === my) { fb(''); stepTo(e.from + 1); } }, 450); }
    if (e.type === 'done' && S.pace !== 'interpreter') { /* stepTo reads the end of the sentence via the advance that follows the last target */ }
  });
  if (evs.some(e => e.type === 'done') && S.pace !== 'interpreter') { const my = r; setTimeout(() => { if (G1 && G1.round === my) stepTo(s.targets.length); }, 450); }
}
function flashTarget(i) { const el = $('.tw[data-t="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } $('#sent').classList.add('redbar'); setTimeout(() => $('#sent').classList.remove('redbar'), 450); }
function onSign(ev) {
  if (!G1 || !G1.round) return;
  if (ev.unsure) { if (G1.round.cur >= 0 && !G1.round.results[G1.round.cur]) tip('Hold it steady so the camera can see which way your hand faces'); return; }
  handle(G1.round.gesture(ev));
}
$('#skip').onclick = () => { if (!G1 || !G1.round) return; const r = G1.round, i = r.cur; if (i < 0 || r.results[i]) return; r.results[i] = { kind: 'skipped', at: now() }; drawSentence(); hush(); stepTo(i + 1); };
/* a hand out of view (or the camera stalling) pauses timed targets: nobody fails because of the camera */
let lostTimer = null;
function handGone(t) {
  if (!G1 || !G1.round) return;
  if (t - lastHandAt > 800 && G1.round.cameraOk && G1.round.cur >= 0 && !G1.round.done) { G1.round.cameraLost(t); G1.paused = t; tip('Show your hand to the camera'); try { speechSynthesis.pause(); } catch (e) {} }
}
function handBack(t) { if (G1 && G1.round && !G1.round.cameraOk) { G1.round.cameraBack(t); if (G1.paused) { G1.pausedTotal = (G1.pausedTotal || 0) + (t - G1.paused); G1.paused = 0; } tip(''); try { speechSynthesis.resume(); } catch (e) {} } }
setInterval(() => { if (G1 && G1.round && S.pace !== 'interpreter') handle(G1.round.tick(now())); }, 50);
/* INTERPRETER SPEED: the sentence keeps its reading pace; the yellow word moves along; each target opens when the reading gets there.
   Wrong or missed = a quick red flash, and the reading goes on. */
function interpreter() {
  const s = G1.sent, my = G1.round, words = [], re = /\S+/g; let m;
  while ((m = re.exec(s.sentence))) words.push({ start: m.index, end: m.index + m[0].length });
  const per = 60000 / Math.max(40, +T.wpm || 110), t0 = now(); G1.pausedTotal = 0;
  speak(s.sentence);      // read at the same time (roughly the same pace)
  let w = -1;
  const iv = setInterval(() => {
    if (!G1 || G1.round !== my) { clearInterval(iv); return; }
    if (!my.cameraOk) return;      // paused for the camera
    const el = now() - t0 - (G1.pausedTotal || 0), wi = Math.min(words.length - 1, Math.floor(el / per));
    while (w < wi) { w++; const wd = words[w]; s.targets.forEach((tg, i) => { if (tg.start >= wd.start && tg.start < wd.end) handle(my.reach(i, now())); }); }
    handle(my.tick(now()));
    if (my.done && el > words.length * per) { clearInterval(iv); setTimeout(sentenceDone, 900); }
    else if (el > words.length * per + (+T.win + +T.grace) * 1000 + 400 && !my.done) { handle(my.tick(now() + 99999)); }
  }, 30);
}
function sentenceDone() {
  if (!G1) return; const r = G1.round, s = G1.sent;
  r.results.forEach((x, i) => G1.results.push({ s, i, t: s.targets[i], r: x || { kind: 'skipped' } }));
  if (r.results.some(x => !x || x.kind !== 'correct')) G1.missed.push(s);
  G1.qi++; setTimeout(nextSentence, 600);
}
function finish(stopped) {
  hush(); const res = G1.results, n = res.length, ok = res.filter(x => x.r.kind === 'correct');
  const rts = ok.map(x => x.r.rt).filter(v => v != null), avg = rts.length ? (rts.reduce((a, b) => a + b, 0) / rts.length / 1000).toFixed(1) : '–';
  STATS.rounds++; STATS.targets += n; STATS.correct += ok.length;
  res.forEach(x => { STATS.kinds[x.r.kind] = (STATS.kinds[x.r.kind] || 0) + 1; if (x.r.errorType) STATS.errors[x.r.errorType] = (STATS.errors[x.r.errorType] || 0) + 1; }); save('pron-stats', STATS);
  const name = k => ({ correct: 'Right', wrong: 'Wrong sign', timeout: 'Too late', skipped: 'Skipped' }[k] || k);
  $('#done').innerHTML = '<h2>' + (stopped ? 'Stopped' : 'Round done!') + '</h2><div class="bigscore">' + ok.length + ' of ' + n + '</div><p class="small2">signs right · about ' + avg + ' seconds each</p>' +
    '<table class="review"><tr><th>Sentence</th><th>Word</th><th>Sign</th><th>Result</th></tr>' + res.map(x => '<tr><td>' + esc(x.s.sentence) + '</td><td><b>' + esc(x.t.text) + '</b></td><td>' + G[x.t.gesture].sign + '</td><td class="k-' + x.r.kind + '">' + name(x.r.kind) + (x.r.got && x.r.kind === 'wrong' ? ' (' + G[x.r.got].sign + ')' : '') + (x.r.why ? '<br><span class="small2">' + esc(x.r.why) + '</span>' : x.r.kind === 'timeout' ? '<br><span class="small2">' + esc(x.t.explanation || '') + '</span>' : '') + '</td></tr>').join('') + '</table>' +
    '<div class="row2"><button class="btn" id="again">Play again</button>' + (res.some(x => x.r.kind !== 'correct') ? '<button class="btn ghost" id="misses">Practice what I missed</button>' : '') + '<button class="btn ghost" id="toSetup">Change settings</button></div>';
  const missed = [...new Set(res.filter(x => x.r.kind !== 'correct').map(x => x.s))];
  // special recognition on this computer too (Colleen): a faster average than your best at this speed, a perfect round
  const B = load('pron-best', {}), key = S.pace, avgN = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length / 1000 : 0, cheers = [];
  if (!stopped && n >= 3) { if (avgN && ok.length / n >= 0.8) { if (B[key] && avgN <= B[key] * 0.9) cheers.push('🚀 Faster than your best at ' + ENG.PACES[key].name + '!'); if (!B[key] || avgN < B[key]) B[key] = avgN; }
    if (ok.length === n && n >= 5) cheers.push('⭐ Perfect round!'); save('pron-best', B); }
  if (cheers.length) $('#done').insertAdjacentHTML('afterbegin', cheers.map(c => '<div class="feedback ok"><b>' + esc(c) + '</b></div>').join(''));
  if (IN_SHEET && n) {      // the results go to the class (ASL Study saves them and answers with what was earned)
    $('#done').insertAdjacentHTML('beforeend', '<p class="small2" id="savedNote">Saving to your class…</p>');
    try { window.opener.postMessage({ type: 'fsp-cam-round', kind: 'pronouns', game: 'pronouns', name: 'Pronoun Signs', rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), secs: Math.round((Date.now() - (G1.t0 || Date.now())) / 1000), pace: S.pace,
      pron: res.map(x => [x.t.text, x.t.gesture, x.r.kind, x.r.got || '', x.r.errorType || '', x.r.rt != null ? Math.round(x.r.rt / 100) / 10 : 0]) }, '*'); } catch (e) { $('#savedNote').textContent = 'Could not save: keep the ASL Study tab open.'; }
  }
  G1 = null; $('#playing').hidden = true; $('#done').hidden = false; $('#sent').hidden = true; tip('');
  $('#again').onclick = () => $('#start').click();
  if ($('#misses')) $('#misses').onclick = () => { G1 = { queue: missed, qi: 0, missed: [], results: [], repeating: true }; $('#done').hidden = true; $('#playing').hidden = false; $('#sent').hidden = false; nextSentence(); };
  $('#toSetup').onclick = () => { $('#done').hidden = true; $('#setup').hidden = false; drawSetup(); };
  drawStats();
}

/* ---------- calibration: a few seconds of each sign -> that student's own directions ---------- */
const CAL_ORDER = ['POINT_SELF', 'FLAT_SELF', 'POINT_OUT', 'FLAT_OUT'], CAL_SAY = { POINT_SELF: 'ME: point to your chest', FLAT_SELF: 'MY: flat hand on your chest', POINT_OUT: 'YOU: point at the camera', FLAT_OUT: 'YOUR: flat hand, palm toward the camera' };
let CALIB = null;
function drawCal(i) { $('#calCards').innerHTML = CAL_ORDER.map((g, k) => '<div class="gcard2' + (k < i ? ' done' : k === i ? ' now' : '') + '"><b>' + G[g].sign + '</b>' + esc(CAL_SAY[g].split(': ')[1]) + '</div>').join(''); }
$('#calGo').onclick = () => {
  if (!landmarker) { $('#calMsg').textContent = 'Turn on the camera first (the button on the camera).'; return; }
  CALIB = { i: 0, samples: {}, phase: 'ready', t: now() }; drawCal(0); $('#calMsg').textContent = 'Get ready: ' + CAL_SAY[CAL_ORDER[0]] + '.'; tip(CAL_SAY[CAL_ORDER[0]]);
};
function calFrame(f, t) {
  const C = CALIB, g = CAL_ORDER[C.i], want = G[g].shape;
  if (C.phase === 'ready' && t - C.t > 1800) { C.phase = 'hold'; C.t = t; C.samples[g] = []; }
  if (C.phase === 'hold') {
    if (f.shape === want) C.samples[g].push(f);
    const k = Math.min(1, (t - C.t) / 3000); $('#calBar').style.width = Math.round(((C.i + k) / 4) * 100) + '%';
    $('#calMsg').textContent = 'Hold it: ' + CAL_SAY[g] + (f.shape !== want ? ' (the camera sees a ' + f.shape + ' hand)' : '');
    if (t - C.t > 3000) {
      C.i++;
      if (C.i < 4) { C.phase = 'ready'; C.t = t; drawCal(C.i); $('#calMsg').textContent = 'Next: ' + CAL_SAY[CAL_ORDER[C.i]] + '.'; tip(CAL_SAY[CAL_ORDER[C.i]]); }
      else {
        const out = REC.calibrate(C.samples); CALIB = null; tip(''); drawCal(4);
        if (out.ok) { CAL = out.calib; save('pron-cal', CAL); $('#calMsg').textContent = '✓ Done! The camera learned your signs. You can play now.'; }
        else { if (Object.keys(out.calib).length) { CAL = Object.assign({}, CAL || {}, out.calib); save('pron-cal', CAL); } $('#calMsg').textContent = 'Almost: ' + out.problems.join('; ') + '. Try again: make the direction really clear (toward your chest vs. toward the camera).'; }
        drawSetup();
      }
    }
  }
}
$('#calClear').onclick = () => { CAL = null; save('pron-cal', null); $('#calMsg').textContent = 'Forgotten. The camera uses its starting guesses until you calibrate again.'; drawSetup(); };

/* ---------- teacher: speeds, results on this computer, new sentences ---------- */
['wpm', 'win', 'grace', 'explain'].forEach(k => { const el = $('#t' + k[0].toUpperCase() + k.slice(1)); el.value = T[k]; el.onchange = () => { T[k] = +el.value; save('pron-teach', T); }; });
function drawStats() {
  const k = STATS.kinds, e = STATS.errors, pct = STATS.targets ? Math.round(100 * STATS.correct / STATS.targets) : 0;
  const notes = SHEET_NOTES.length ? '<p><b>Sentences left out from your sheet:</b><br>' + SHEET_NOTES.map(esc).join('<br>') + '</p>' : '';
  $('#tStats').innerHTML = notes + (STATS.rounds ? STATS.rounds + ' rounds · ' + STATS.correct + ' of ' + STATS.targets + ' signs right (' + pct + '%)<br>Wrong sign: ' + (k.wrong || 0) + ' (direction ' + (e.wrong_direction || 0) + ', handshape ' + (e.wrong_handshape || 0) + ', both ' + (e.both_wrong || 0) + ') · too late: ' + (k.timeout || 0) + ' · skipped: ' + (k.skipped || 0) : 'No rounds yet on this computer.');
}
$('#aDrill').innerHTML = Object.entries(ENG.DRILLS).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('');
let DRAFT = null;
$('#aFind').onclick = () => {
  const s = $('#aSent').value.trim(); if (!s) return;
  const found = ENG.suggestTargets(s); DRAFT = { sentence: s, found };
  $('#aTargets').innerHTML = found.length ? found.map((t, i) => '<label class="small2" style="display:flex;gap:6px;align-items:center;margin:4px 0"><input type="checkbox" data-a="' + i + '" checked> <b>' + esc(t.text) + '</b> → <select class="auth" data-g="' + i + '" style="width:auto">' + Object.keys(G).map(g => '<option value="' + g + '"' + (g === t.gesture ? ' selected' : '') + '>' + G[g].sign + ' (' + g + ')</option>').join('') + '</select></label>').join('') + '<p class="small2">Untick a word that should stay unassessed (only context).</p>' : '<p class="small2">No I, me, my, I’m, you, you’re or your found.</p>';
  $('#aSave').hidden = !found.length;
};
$('#aSave').onclick = () => {
  if (!DRAFT) return;
  const targets = DRAFT.found.map((t, i) => ({ ...t, gesture: $('[data-g="' + i + '"]').value, on: $('[data-a="' + i + '"]').checked })).filter(t => t.on).map(({ on, ...t }) => t);
  const s = { id: 'MINE_' + Date.now(), drill: $('#aDrill').value, difficulty: $('#aDiff').value, sentence: DRAFT.sentence, targets };
  const v = ENG.validateBank({ sentences: [s] }); if (v.errors.length) { alert(v.errors[0]); return; }
  MINE.push(s); save('pron-mine', MINE); DRAFT = null; $('#aTargets').innerHTML = ''; $('#aSave').hidden = true; $('#aSent').value = ''; drawMine(); count();
};
function drawMine() { $('#aMine').textContent = MINE.length ? MINE.length + ' sentence' + (MINE.length === 1 ? '' : 's') + ' of your own on this computer (they join the round for their drill and level).' : ''; }
$('#aExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, sentences: MINE }, null, 2)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'my_pronoun_sentences.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
/* ---------- tabs ---------- */
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); ['play', 'cal', 'teach'].forEach(k => { $('#t-' + k).hidden = b.dataset.t !== k; }); if (b.dataset.t === 'cal') drawCal(-1); if (b.dataset.t === 'teach') drawStats(); };
const bv = ENG.validateBank(window.PRONOUN_BANK);
$('#status').textContent = bv.errors.length ? 'Bank problems: ' + bv.errors.join('; ') : 'Ready: ' + bv.ok.length + ' sentences.';
drawSetup(); drawMine();
window.PRON_TEST = { G1: () => G1, handle, onSign, S, nextSentence, startWith: list => { G1 = { queue: list, qi: 0, missed: [], results: [], repeating: false }; $('#done').hidden = true; $('#setup').hidden = true; $('#playing').hidden = false; $('#sent').hidden = false; nextSentence(); } };
