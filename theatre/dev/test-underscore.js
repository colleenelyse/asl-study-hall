/* node theatre/dev/test-underscore.js — find spoken lines in a voice track: made-up "speech" (noisy, wandering pitch) and "singing" (steady notes) */
const M = require('../js/melody.js');
const rate = 22050, N = rate * 20, v = new Float32Array(N); let seed = 3; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647 - 0.5);
const speech = (t0, d) => { let ph = 0; for (let i = Math.floor(t0 * rate); i < (t0 + d) * rate; i++) { const t = i / rate, f = 140 + 60 * Math.sin(2 * Math.PI * 3.1 * t) + 30 * Math.sin(2 * Math.PI * 7.3 * t); ph += 2 * Math.PI * f / rate; v[i] += .3 * (Math.sin(ph) + .5 * Math.sin(2 * ph)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t)) + rnd() * .05; } };
const sing = (t0, d, midi) => { const f = 440 * 2 ** ((midi - 69) / 12); for (let i = Math.floor(t0 * rate); i < (t0 + d) * rate; i++) { const t = i / rate; v[i] += .3 * (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(4 * Math.PI * f * t)); } };
// lines: 40 chars at 1.0 s, a shout at 4 s (not a line), 70 chars at 6 s, then singing 10-14 s, 25 chars at 15.5 s
speech(1.0, 3.0); speech(4.6, 0.4); speech(6.0, 5.3 - 0.3); sing(11.5, 1.5, 64); sing(13.1, 1.2, 67); speech(15.5, 2.0);
for (let i = 0; i < N; i++) v[i] += rnd() * .004;
const regions = M.voiceRegions(v, rate), times = M.alignLines(regions, [40, 70, 25]);
console.log('regions', regions.map(r => r.s + '-' + r.e + (r.sung ? ' sung' : '')).join(' | '));
console.log('times', times.join(', '));
const want = [1.0, 6.0, 15.5]; let bad = 0;
times.forEach((t, i) => { const ok = t !== null && Math.abs(t - want[i]) < 0.3; console.log(ok ? 'ok  ' : 'FAIL', 'line', i + 1, 'at', t, 'expected', want[i]); if (!ok) bad++; });
const sungOk = regions.filter(r => r.sung).length >= 1; console.log(sungOk ? 'ok  ' : 'FAIL', 'the singing is marked sung'); if (!sungOk) bad++;
process.exit(bad ? 1 : 0);
