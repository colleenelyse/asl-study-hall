/* node theatre/dev/test-lyrics.js — find sung lyric lines and their syllables in a voice track (a made-up tune) */
const M = require('../js/melody.js');
const rate = 22050, N = rate * 20, v = new Float32Array(N); let seed = 5; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647 - 0.5);
const note = (t0, d, midi) => { const f = 440 * 2 ** ((midi - 69) / 12); for (let i = Math.floor(t0 * rate); i < (t0 + d) * rate; i++) { const t = i / rate, env = Math.min(1, (t - t0) * 30, (t0 + d - t) * 30); v[i] += .3 * env * (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(4 * Math.PI * f * t)); } };
// line 1: 5 syllables from 1.0 s; line 2: 4 syllables from 5.0 s; line 3: 6 syllables from 10.0 s; a spoken bit at 8 s
const lines = [[1.0, [64, 67, 69, 67, 64]], [5.0, [62, 64, 65, 64]], [10.0, [60, 62, 64, 65, 67, 69]]];
lines.forEach(([t0, ns]) => ns.forEach((m, i) => note(t0 + i * 0.45, 0.4, m)));
let ph = 0; for (let i = 8 * rate; i < 8.8 * rate; i++) { const t = i / rate, f = 150 + 60 * Math.sin(2 * Math.PI * 3.3 * t); ph += 2 * Math.PI * f / rate; v[i] += .25 * Math.sin(ph) + rnd() * .04; }
for (let i = 0; i < N; i++) v[i] += rnd() * .003;
const regions = M.voiceRegions(v, rate), notes = M.notes(v, rate), al = M.alignLyrics(regions, [5, 4, 6]);
console.log('sung regions', regions.filter(r => r.sung).map(r => r.s + '-' + r.e).join(' | '));
console.log('lines', al.map(x => x && (x.t + '-' + x.e)).join(' | '));
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
[1.0, 5.0, 10.0].forEach((t, i) => ok(al[i] && Math.abs(al[i].t - t) < 0.25, 'line ' + (i + 1) + ' starts near ' + t + ' (' + (al[i] && al[i].t) + ')'));
const st = M.sylTimes(notes, al[2].t, al[2].e, 6); console.log('line 3 syllables', st.join(' '));
ok(st.every((t, i) => Math.abs(t - (10 + i * 0.45)) < 0.2), 'each syllable of line 3 lands on its note');
process.exit(bad ? 1 : 0);
