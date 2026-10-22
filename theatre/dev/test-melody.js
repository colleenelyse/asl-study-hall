/* node theatre/dev/test-melody.js — a made-up tune over chords and drums; the guide track starts 137 ms late */
const M = require('../js/melody.js');
const rate = 44100, N = rate * 8; let seed = 7; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647 - 0.5);
const tune = [[1, .5, 64], [1.5, .5, 67], [2, 1, 69], [3.2, .4, 67], [3.6, .4, 65], [4, 1.2, 64], [5.5, .5, 62], [6, 1, 60]];
const acc = new Float32Array(N), mel = new Float32Array(N);
for (let i = 0; i < N; i++) { const t = i / rate; let s = 0; for (const m of [48, 52, 55]) s += .12 * Math.sin(2 * Math.PI * 440 * 2 ** ((m - 69) / 12) * t); acc[i] = s; }
for (let h = 0.3; h < 8; h += 0.25 + (rnd() + 0.5) * 0.5) { const i0 = Math.floor(h * rate); for (let j = 0; j < .03 * rate; j++) acc[i0 + j] += rnd() * .8 * (1 - j / (.03 * rate)); }
for (const [t0, d, m] of tune) { const f = 440 * 2 ** ((m - 69) / 12); let ph = 0; for (let i = Math.floor(t0 * rate); i < (t0 + d) * rate; i++) { const t = i / rate; ph += 2 * Math.PI * f * (1 + .006 * Math.sin(2 * Math.PI * 5.5 * t)) / rate; let s = 0; for (let h = 1; h <= 4; h++) s += Math.sin(h * ph) / h; mel[i] += .2 * s; } }
const off = Math.round(.137 * rate), guide = new Float32Array(N + off), perf = new Float32Array(N);
for (let i = 0; i < N; i++) { perf[i] = acc[i] + rnd() * .002; guide[i + off] = acc[i] * 1.05 + mel[i] + rnd() * .002; }
const r = M.extract(guide, perf, rate);
console.log('offset', r.offset.toFixed(3), 'band cancelled', r.cancelled);
console.log('expected', tune.map(x => x[2] + '@' + x[0]).join(' '));
console.log('found   ', r.notes.map(n => n.midi + '@' + n.t).join(' '));
