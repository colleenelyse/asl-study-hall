/* ASL pronoun drills: the four camera gestures from MediaPipe hand landmarks (and the face finder for where the chin is).
   HANDSHAPE: index alone out = point; four fingers out = flat.
   DIRECTION: point -> which way the index finger aims in depth (MediaPipe's 3D "world" estimate) plus, when the face is found, whether the
   fingertip is in front of the chest; flat -> which way the palm faces (toward the camera = outward), plus the same chest clue.
   A single webcam guesses depth, so each student can CALIBRATE (a few seconds of each sign); the classifier then compares with that
   student's own signs. Anything unclear comes back as "unsure", never as a particular sign. This is a classroom prototype, not a
   validated ASL recognition model. Pure functions: tested in Node by dev/pronoun-test.js. */
(function (root) {
  'use strict';
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }, dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var len = function (a) { return Math.hypot(a[0], a[1], a[2]); }, unit = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  /* The chest area, in face widths from the chin (Colleen, 2026-10-17: ME, MY, YOU and YOUR are signed lower than the chin; the top of the
     area starts below the chin). The area just under the chin is where AGES are signed (reader.js). */
  var CHEST = { top: 0.6, bottom: 3.0, half: 0.95 };

  /* P: 21 world points already turned to our frame (x right as the signer sees it, y up, z toward the camera; a left hand mirrored).
     L: 21 image points (0-1, as the camera sees them). face: { x, y, fw } (the chin, and the face width) or null. */
  function features(P, L, face) {
    var palmLen = len(sub(P[9], P[0])) || 1, ext = function (tip, base) { return len(sub(P[tip], P[base])) / palmLen; };
    var e = [ext(8, 5), ext(12, 9), ext(16, 13), ext(20, 17)];
    var shape = e[0] > 0.6 && e[1] < 0.62 && e[2] < 0.6 && e[3] < 0.6 ? 'point' : e[0] > 0.6 && e[1] > 0.62 && e[2] > 0.58 && e[3] > 0.5 ? 'flat' : 'other';
    var y = unit(sub(P[9], P[0])), across = sub(P[5], P[17]), x = unit(sub(across, y.map(function (v) { return v * dot(across, y); }))), z = cross(x, y);
    var aim = unit(sub(P[8], P[5]));      // the pointer finger's direction
    var f = { shape: shape, ext: e, aimZ: aim[2], aimY: aim[1], palmZ: z[2], palmY: z[1], chest: null, size: null };
    if (L && L.length > 9) {
      f.size = Math.hypot(L[9].x - L[0].x, L[9].y - L[0].y);
      if (face && face.fw) {
        var tip = shape === 'point' ? L[8] : L[9], dx = (tip.x - face.x) / face.fw, dy = (tip.y - face.y) / face.fw;
        f.chest = { dx: dx, dy: dy, near: Math.abs(dx) < CHEST.half && dy > CHEST.top && dy < CHEST.bottom, rel: f.size / face.fw };      // in front of the chest: below the chin, within the body's width
      }
    }
    return f;
  }
  /* The direction score for one hand: + = outward (toward the camera / the other person), - = toward the signer. */
  function dirScore(f) {
    var s = f.shape === 'point' ? f.aimZ * 1.0 : f.palmZ * 1.0;
    if (f.chest) { if (f.chest.near && f.chest.rel < 0.75) s -= 0.15; if (!f.chest.near || f.chest.rel > 0.95) s += 0.15; }      // a hand at the chest leans "self"; a hand out front and big leans "out"
    return s;
  }
  var DEFAULT = { point: { self: -0.35, out: 0.4 }, flat: { self: -0.45, out: 0.45 } };      // starting guesses (centers) before calibration
  /* classify: { g, conf, why }. g is null when it is not one of the four (or not sure). */
  function classify(f, calib) {
    if (!f || f.shape === 'other') return { g: null, conf: 0, why: f ? 'handshape' : 'no hand' };
    var c = (calib && calib[f.shape]) || DEFAULT[f.shape], s = dirScore(f), mid = (c.self + c.out) / 2, half = Math.max(0.15, Math.abs(c.out - c.self) / 2);
    var outward = c.out > c.self ? s > mid : s < mid, conf = clamp(Math.abs(s - mid) / half, 0, 1);
    var g = (f.shape === 'point' ? 'POINT_' : 'FLAT_') + (outward ? 'OUT' : 'SELF');
    return { g: g, conf: conf, score: s, why: conf < 0.6 ? 'direction unclear' : '' };
  }
  /* Calibration: a few frames of each of the four signs -> the centers of that student's own direction scores, per handshape.
     Refuses to calibrate when a pair can't be told apart (the two centers too close), so a bad calibration can't make scoring worse. */
  function calibrate(samples) {
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }, out = {}, problems = [];
    [['point', 'POINT_SELF', 'POINT_OUT'], ['flat', 'FLAT_SELF', 'FLAT_OUT']].forEach(function (p) {
      var a = (samples[p[1]] || []).filter(function (f) { return f.shape === p[0]; }).map(dirScore), b = (samples[p[2]] || []).filter(function (f) { return f.shape === p[0]; }).map(dirScore);
      if (a.length < 8 || b.length < 8) { problems.push(p[0] === 'point' ? 'the pointing signs' : 'the flat-hand signs'); return; }
      var ms = mean(a), mo = mean(b);
      if (Math.abs(mo - ms) < 0.25) { problems.push(p[0] === 'point' ? 'pointing at yourself and pointing out looked too alike' : 'the flat hand toward you and toward the other person looked too alike'); return; }
      out[p[0]] = { self: ms, out: mo };
    });
    return { calib: out, problems: problems, ok: !problems.length };
  }
  /* Steady: turns frames into gesture ONSETS. A sign counts once: the same gesture held steady for stableMs (with good confidence),
     and before the next counts the hand must change or drop for releaseMs (no "held sign scores twice"). An unclear direction held
     for unsureMs gives one "unsure" (so the game can say "try again" without guessing). Times come from the caller's clock. */
  function Steady(o) {
    o = o || {}; var stableMs = o.stableMs || 250, releaseMs = o.releaseMs || 180, unsureMs = o.unsureMs || 900, minConf = o.minConf || 0.6;
    var cur = null, since = 0, lastSent = null, offSince = null, unsureSent = false, confs = [];
    return function (r, t) {      // r: classify() result or null (no hand); returns an event or null
      var label = r && r.g && r.conf >= minConf ? r.g : r && r.g ? 'unsure' : null;
      if (label !== cur) { cur = label; since = t; confs = []; unsureSent = false; }
      if (r && r.g) confs.push(r.conf);
      if (!label || label === 'unsure') { if (offSince == null) offSince = t; if (t - offSince >= releaseMs) lastSent = null; }      // the hand dropped or changed: the same sign can count again
      else offSince = null;
      if (label === 'unsure' && !unsureSent && t - since >= unsureMs) { unsureSent = true; return { g: null, unsure: true, t: t }; }
      if (label && label !== 'unsure' && label !== lastSent && t - since >= stableMs) {      // a new steady sign (a different sign right away counts too)
        lastSent = label; var conf = confs.reduce(function (a, b) { return a + b; }, 0) / (confs.length || 1);
        return { g: label, conf: conf, t: since };      // the moment the sign was first made (fair at fast paces)
      }
      return null;
    };
  }
  var API = { CHEST: CHEST, features: features, dirScore: dirScore, classify: classify, calibrate: calibrate, Steady: Steady, DEFAULT: DEFAULT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PRONOUN_REC = API;
})(typeof window !== 'undefined' ? window : this);
