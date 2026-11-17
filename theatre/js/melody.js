/* The singing line, without the words.
   A guide-vocal track is the band plus the singer; the performance track is the same band without the singer.
   Line the two up, subtract, and what is left is the voice. Follow its pitch frame by frame, then tidy that into notes.
   The notes are small ({t, d, midi}) and are saved with the show, so students only need the performance track
   to hear the melody played as a soft tone on top of it. Works on plain Float32Arrays (mono). */
(function (root) {
  'use strict';

  function toMono(buf) {                        // AudioBuffer -> Float32Array
    if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
    var a = buf.getChannelData(0), b = buf.getChannelData(1), out = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
    return out;
  }

  /* in-place radix-2 FFT (re, im: Float64Array, length a power of 2) */
  function fft(re, im, inverse) {
    var n = re.length, i, j, k, len;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = 2 * Math.PI / len * (inverse ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2], bi = im[i + k + len / 2];
          var xr = br * cr - bi * ci, xi = br * ci + bi * cr;
          re[i + k] = ar + xr; im[i + k] = ai + xi; re[i + k + len / 2] = ar - xr; im[i + k + len / 2] = ai - xi;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function lowRate(x, rate, target, maxSec) {      // average down to ~target Hz
    var step = Math.max(1, Math.floor(rate / target)), n = Math.min(Math.floor(x.length / step), Math.floor(maxSec * rate / step));
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) { var s = 0; for (var j = 0; j < step; j++) s += x[i * step + j]; out[i] = s / step; }
    return { x: out, step: step };
  }

  /* offset in samples: positive means the guide track starts later than the performance track.
     Cross-correlates the actual waveforms (at 4 kHz, through an FFT) over the first minute, then refines to the sample. */
  function findOffset(guide, perf, rate, maxLagSec) {
    maxLagSec = maxLagSec || 6;
    var g = lowRate(guide, rate, 4000, 60), p = lowRate(perf, rate, 4000, 60), step = g.step;
    var n = 1; while (n < g.x.length + p.x.length) n <<= 1;
    var gr = new Float64Array(n), gi = new Float64Array(n), pr = new Float64Array(n), pim = new Float64Array(n);
    gr.set(g.x); pr.set(p.x);
    fft(gr, gi, false); fft(pr, pim, false);
    for (var i = 0; i < n; i++) {                 // G * conj(P), whitened so every pitch counts, not just the bass
      var r = gr[i] * pr[i] + gi[i] * pim[i], im = gi[i] * pr[i] - gr[i] * pim[i], m = Math.hypot(r, im) || 1;
      gr[i] = r / m; gi[i] = im / m;
    }
    fft(gr, gi, true);
    var maxLag = Math.round(maxLagSec * rate / step), best = 0, bestV = -Infinity;
    for (var lag = -maxLag; lag <= maxLag; lag++) {
      var v = gr[(lag + n) % n];
      if (v > bestV) { bestV = v; best = lag; }
    }
    var coarse = best * step, fine = coarse, fineV = -Infinity, start = Math.round(rate * 2), win = Math.min(rate * 20, perf.length - start - step * 2);
    for (lag = coarse - step; lag <= coarse + step; lag++) {
      var s = 0;
      for (i = start; i < start + win; i += 2) { var k = i + lag; if (k >= 0 && k < guide.length) s += guide[k] * perf[i]; }
      if (s > fineV) { fineV = s; fine = lag; }
    }
    return fine;
  }

  /* guide minus (gain * performance), with the gain that cancels the band best */
  function isolate(guide, perf, offset) {
    var n = Math.min(perf.length, guide.length - Math.max(0, offset)), gp = 0, pp = 0;
    for (var i = 0; i < n; i += 4) {
      var gi = i + offset; if (gi < 0 || gi >= guide.length) continue;
      gp += guide[gi] * perf[i]; pp += perf[i] * perf[i];
    }
    var gain = pp ? gp / pp : 1;
    var out = new Float32Array(n), eg = 0, eo = 0;
    for (i = 0; i < n; i++) {
      var g = guide[i + offset] || 0;
      out[i] = g - gain * perf[i];
      eg += g * g; eo += out[i] * out[i];
    }
    // how much of the guide track was the band: near 1 means the subtraction worked
    return { voice: out, gain: gain, cancelled: eg ? 1 - eo / eg : 0 };
  }

  /* YIN pitch for one frame; returns Hz or 0 */
  function yin(frame, rate, minHz, maxHz, thresh) {
    var maxTau = Math.floor(rate / minHz), minTau = Math.floor(rate / maxHz), W = frame.length - maxTau;
    if (W < 64) return 0;
    var d = new Float32Array(maxTau + 1), cm = new Float32Array(maxTau + 1), tau, i;
    for (tau = 1; tau <= maxTau; tau++) {
      var s = 0;
      for (i = 0; i < W; i++) { var diff = frame[i] - frame[i + tau]; s += diff * diff; }
      d[tau] = s;
    }
    var run = 0; cm[0] = 1;
    for (tau = 1; tau <= maxTau; tau++) { run += d[tau]; cm[tau] = run ? d[tau] * tau / run : 1; }
    for (tau = minTau; tau <= maxTau; tau++) {
      if (cm[tau] < thresh) {
        while (tau + 1 <= maxTau && cm[tau + 1] < cm[tau]) tau++;
        var a = cm[tau - 1] || cm[tau], b = cm[tau], c = cm[tau + 1] || cm[tau];
        var shift = (a - c) / (2 * (a - 2 * b + c) || 1);
        return rate / (tau + (isFinite(shift) ? shift : 0));
      }
    }
    return 0;
  }

  /* pitch every 20 ms, then notes: steady runs of the same semitone, at least 90 ms long */
  function notes(voice, rate, opts) {
    opts = opts || {};
    var target = 16000, step = Math.max(1, Math.round(rate / target)), r = rate / step;
    // low-pass, then keep every step-th sample (averaging stops high sounds folding down into fake low notes)
    var x = new Float32Array(Math.floor(voice.length / step)), a1 = 0, a2 = 0, k = Math.exp(-2 * Math.PI * 3000 / rate);
    for (var i = 0, j = 0; i < voice.length && j < x.length; i++) {
      a1 = (1 - k) * voice[i] + k * a1; a2 = (1 - k) * a1 + k * a2;      // two gentle one-pole filters
      if (i % step === step - 1) x[j++] = a2;
    }
    var hop = Math.round(r * 0.02), size = Math.round(r * 0.05), frames = [];
    var rmsAll = 0; for (i = 0; i < x.length; i += 8) rmsAll += x[i] * x[i]; rmsAll = Math.sqrt(rmsAll / (x.length / 8));
    var gate = rmsAll * (opts.gate || 0.35);
    for (var o = 0; o + size < x.length; o += hop) {
      var f = x.subarray(o, o + size), e = 0;
      for (i = 0; i < f.length; i += 2) e += f[i] * f[i];
      e = Math.sqrt(e / (f.length / 2));
      var hz = e > gate ? yin(f, r, 75, 1100, 0.15) : 0;
      frames.push(hz ? 69 + 12 * Math.log2(hz / 440) : 0);
      if (opts.onProgress && frames.length % 500 === 0) opts.onProgress(o / x.length);
    }
    // smooth: median of 5 to remove octave jumps and blips
    var sm = frames.map(function (v, k) {
      var w = frames.slice(Math.max(0, k - 2), k + 3).filter(Boolean).sort(function (a, b) { return a - b; });
      return v && w.length >= 3 ? w[Math.floor(w.length / 2)] : 0;
    });
    var out = [], cur = null, dt = 0.02;
    sm.forEach(function (m, k) {
      var midi = m ? Math.round(m) : 0;
      if (cur && midi && Math.abs(midi - cur.midi) <= 0 && k - cur.end <= 2) { cur.end = k; return; }
      if (cur) out.push(cur);
      cur = midi ? { start: k, end: k, midi: midi } : null;
    });
    if (cur) out.push(cur);
    return out.filter(function (n) { return (n.end - n.start + 1) * dt >= 0.09; })
      .map(function (n) { return { t: +(n.start * dt).toFixed(2), d: +((n.end - n.start + 1) * dt).toFixed(2), midi: n.midi }; });
  }

  /* the whole job. guide/perf: mono Float32Arrays at the same sample rate. Times come back in the performance track's clock. */
  function extract(guide, perf, rate, opts) {
    var offset = findOffset(guide, perf, rate);
    var iso = isolate(guide, perf, offset);
    var ns = notes(iso.voice, rate, opts);
    return { notes: ns, offset: offset / rate, cancelled: Math.round(iso.cancelled * 100) / 100 };
  }

  /* play notes as a soft rounded tone, scheduled against an AudioContext clock */
  function schedule(ctx, dest, list, startAt, fromSec, opts) {
    opts = opts || {};
    var nodes = [], vol = opts.volume == null ? 0.18 : opts.volume, shift = opts.transpose || 0;
    list.forEach(function (n) {
      if (n.t + n.d < fromSec) return;
      var t0 = startAt + Math.max(0, n.t - fromSec), dur = n.d - Math.max(0, fromSec - n.t);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (n.midi + shift - 69) / 12);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      g.gain.setValueAtTime(vol, t0 + Math.max(0.03, dur - 0.04));
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(g); g.connect(dest);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
      nodes.push(osc);
    });
    return { stop: function () { nodes.forEach(function (o) { try { o.stop(); } catch (e) {} }); } };
  }

  /* where the voices are, from the isolated voice track: stretches of sound, each marked sung (steady pitch) or spoken (pitch that wanders,
     or no clear pitch). Used to place the lines spoken over the music (Colleen: "the lines are in the guide vocals"). Times are on the
     performance track's clock, like the voice itself. */
  function voiceRegions(voice, rate) {
    var step = Math.max(1, Math.round(rate / 16000)), r = rate / step, x = new Float32Array(Math.floor(voice.length / step));
    for (var i = 0, j = 0; j < x.length; i += step, j++) x[j] = voice[i];
    var hop = Math.round(r * 0.02), size = Math.round(r * 0.04), fr = [];
    var all = 0; for (i = 0; i < x.length; i += 8) all += x[i] * x[i]; all = Math.sqrt(all / Math.max(1, x.length / 8));
    var gate = all * 0.45;
    for (var o = 0; o + size < x.length; o += hop) {
      var f = x.subarray(o, o + size), e = 0; for (i = 0; i < f.length; i += 2) e += f[i] * f[i]; e = Math.sqrt(e / (f.length / 2));
      var hz = e > gate ? yin(f, r, 75, 900, 0.2) : 0;
      fr.push({ on: e > gate, midi: hz ? 69 + 12 * Math.log2(hz / 440) : 0 });
    }
    var dt = hop / r, regions = [], k = 0;
    while (k < fr.length) {
      if (!fr[k].on) { k++; continue; }
      var s0 = k, last = k;
      while (k < fr.length && (fr[k].on || k - last < Math.round(0.3 / dt))) { if (fr[k].on) last = k; k++; }
      var len = (last - s0 + 1) * dt; if (len < 0.25) continue;
      var voiced = 0, steady = 0, prev = 0;
      for (var q = s0; q <= last; q++) { var m = fr[q].midi; if (m) { voiced++; if (prev && Math.abs(m - prev) < 0.6) steady++; } prev = m; }
      var sung = len > 0.6 && voiced / (last - s0 + 1) > 0.55 && steady / Math.max(1, voiced) > 0.6;
      regions.push({ s: +(s0 * dt).toFixed(2), e: +((last + 1) * dt).toFixed(2), sung: sung });
    }
    return regions;
  }
  /* lines (in script order, with their length in characters) onto the spoken stretches, in order: each line takes one to three stretches
     in a row, stretches can be left over (shouts, other talk), and the match follows how long each line should take to say */
  function alignLines(regions, lens) {
    var R = regions.filter(function (g) { return !g.sung; }), n = lens.length, m = R.length, INF = 1e9;
    if (!n) return [];
    var exp = lens.map(function (c) { return 0.3 + c / 14; }), SKIP = 0.6;
    var f = [], back = [];
    for (var i = 0; i <= n; i++) { f.push(new Array(m + 1).fill(INF)); back.push(new Array(m + 1).fill(null)); }
    f[0][0] = 0;
    for (var j = 1; j <= m; j++) { f[0][j] = f[0][j - 1] + SKIP; back[0][j] = [0, j - 1, 'skip']; }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        if (f[i][j - 1] + SKIP < f[i][j]) { f[i][j] = f[i][j - 1] + SKIP; back[i][j] = [i, j - 1, 'skip']; }
        for (var w = 1; w <= 3 && j - w >= 0; w++) {
          var a = R[j - w], b = R[j - 1], dur = b.e - a.s, gaps = 0;
          for (var q = j - w; q < j - 1; q++) gaps += R[q + 1].s - R[q].e;
          if (gaps > 1.2) continue;
          var c = f[i - 1][j - w] + Math.abs(dur - exp[i - 1]) / Math.max(exp[i - 1], 0.8) + gaps * 0.5;
          if (c < f[i][j]) { f[i][j] = c; back[i][j] = [i - 1, j - w, 'line', a.s]; }
        }
      }
    }
    var bj = 0; for (j = 0; j <= m; j++) if (f[n][j] < f[n][bj]) bj = j;
    if (f[n][bj] >= INF) return lens.map(function () { return null; });
    var out = new Array(n), ci = n, cj = bj;
    while (ci > 0 || cj > 0) { var bk = back[ci][cj]; if (!bk) break; if (bk[2] === 'line') out[ci - 1] = bk[3]; ci = bk[0]; cj = bk[1]; }
    return out;
  }

  /* lyric lines onto the sung stretches, in order (like alignLines, but each line can take up to four stretches and the length follows its syllables) */
  function alignLyrics(regions, syls) {
    var R = regions.filter(function (g) { return g.sung; }), n = syls.length, m = R.length, INF = 1e9;
    if (!n) return [];
    var exp = syls.map(function (k) { return 0.4 + k * 0.36; }), SKIP = 0.8;
    var f = [], back = [];
    for (var i = 0; i <= n; i++) { f.push(new Array(m + 1).fill(INF)); back.push(new Array(m + 1).fill(null)); }
    f[0][0] = 0;
    for (var j = 1; j <= m; j++) { f[0][j] = f[0][j - 1] + SKIP; back[0][j] = [0, j - 1]; }
    var SKIPLINE = 1.2;      // a line with no stretch of its own (a one-word piece sung in the same breath as its neighbor): filled in afterwards
    for (i = 1; i <= n; i++) { f[i][0] = f[i - 1][0] + SKIPLINE; back[i][0] = [i - 1, 0]; }
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) {
      if (f[i][j - 1] + SKIP < f[i][j]) { f[i][j] = f[i][j - 1] + SKIP; back[i][j] = [i, j - 1]; }
      if (f[i - 1][j] + SKIPLINE < f[i][j]) { f[i][j] = f[i - 1][j] + SKIPLINE; back[i][j] = [i - 1, j]; }
      for (var w = 1; w <= 4 && j - w >= 0; w++) {
        var a = R[j - w], b = R[j - 1], gaps = 0;
        for (var q = j - w; q < j - 1; q++) gaps += R[q + 1].s - R[q].e;
        if (gaps > 2) continue;
        var c = f[i - 1][j - w] + Math.abs((b.e - a.s) - exp[i - 1]) / Math.max(exp[i - 1], 1) + gaps * 0.3;
        if (c < f[i][j]) { f[i][j] = c; back[i][j] = [i - 1, j - w, a.s, b.e]; }
      }
    }
    var bj = 0; for (j = 0; j <= m; j++) if (f[n][j] < f[n][bj]) bj = j;
    var out = new Array(n).fill(null), ci = n, cj = bj;
    while (ci > 0 || cj > 0) { var bk = back[ci][cj]; if (!bk) break; if (bk.length === 4) out[ci - 1] = { t: bk[2], e: bk[3] }; ci = bk[0]; cj = bk[1]; }
    // a skipped line shares the stretch of the found line before it (or after it, at the start), by syllables
    for (i = 0; i < n; i++) {
      if (!out[i] || (out[i + 1] !== null && i + 1 < n) || i + 1 >= n) continue;
      var k = i + 1; while (k < n && !out[k]) k++;
      var grp = []; for (q = i; q < k; q++) grp.push(q);
      shareOut(grp);
    }
    if (n && !out[0]) { var f0 = out.findIndex(Boolean); if (f0 > 0) { var g0 = []; for (q = 0; q <= f0; q++) g0.push(q); shareOut(g0, f0); } }
    function shareOut(idx, from) {
      var src = out[from == null ? idx[0] : from], tot = 0, acc = 0;
      idx.forEach(function (q) { tot += syls[q] || 1; });
      idx.forEach(function (q) { var t0 = src.t + (src.e - src.t) * acc / tot; acc += syls[q] || 1; out[q] = { t: +t0.toFixed(2), e: +(src.t + (src.e - src.t) * acc / tot).toFixed(2) }; });
    }
    return out;
  }
  /* when each of k syllables starts inside one line: the sung notes that begin there, spread evenly (a held note or a run of notes on one
     syllable is fine); with too few notes, the line's time is shared out */
  function sylTimes(noteList, t, e, k) {
    if (!k) return [];
    var on = noteList.filter(function (x) { return x.t >= t - 0.05 && x.t < e; }).map(function (x) { return x.t; });
    if (!on.length || on[0] - t > 0.4) on.unshift(t);
    var out = [];
    for (var i = 0; i < k; i++) out.push(on.length >= k ? on[Math.round(i * (on.length - 1) / Math.max(1, k - 1))] : +(t + (e - t) * i / k).toFixed(2));
    for (i = 1; i < k; i++) if (out[i] <= out[i - 1]) out[i] = +(out[i - 1] + 0.05).toFixed(2);
    return out.map(function (v) { return +v.toFixed(2); });
  }

  var NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  function noteName(midi) { return NAMES[midi % 12] + (Math.floor(midi / 12) - 1); }

  var api = { voiceRegions: voiceRegions, alignLines: alignLines, alignLyrics: alignLyrics, sylTimes: sylTimes, extract: extract, findOffset: findOffset, isolate: isolate, notes: notes, toMono: toMono, schedule: schedule, noteName: noteName, yin: yin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Melody = api;
})(typeof window !== 'undefined' ? window : this);
