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

  var NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  function noteName(midi) { return NAMES[midi % 12] + (Math.floor(midi / 12) - 1); }

  var api = { extract: extract, findOffset: findOffset, isolate: isolate, notes: notes, toMono: toMono, schedule: schedule, noteName: noteName, yin: yin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Melody = api;
})(typeof window !== 'undefined' ? window : this);
