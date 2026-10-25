/* node theatre/dev/test-ladder.js — help on my lines (ladder.js): when the guide vocals give way to the band track (made-up times, no lyrics) */
const L = require('../js/ladder.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const near = (a, b) => Math.abs(a - b) < 1e-6;
// lines: 0 theirs 1–4 s, 1 mine 5–8 s (held note found: h 8.2), 2 mine right after 8.1–10, 3 theirs 12–14, 4 mine 15 s (no held note; theirs at 17.5)
const end = x => x.h != null ? x.h : Math.min(x.e, x.s[x.s.length - 1] + 2.5);
const lines = [{ t: 1, e: 4, s: [1, 2, 3] }, { t: 5, e: 8, s: [5, 6, 7], h: 8.2 }, { t: 8.1, e: 10, s: [8.1, 9] , h: 9.8 }, { t: 12, e: 14, s: [12, 13], h: 13.9 }, { t: 15, e: 20, s: [15, 16], h: null }, { t: 17.5, e: 19, s: [17.5, 18], h: 18.8 }, null];
const mineK = [false, true, true, false, true, false, false];
const sp = L.spans(lines, k => mineK[k], end);
console.log('spans', JSON.stringify(sp));
ok(sp.length === 2, 'two stretches: lines 2 and 3 run together, then line 5');
ok(near(sp[0][0], 4.85) && near(sp[0][1], 9.85), 'first stretch starts just before my first word and ends where my held note stops');
ok(near(sp[1][0], 14.85) && near(sp[1][1], 17.4), 'a guessed end stops before someone else’s next line');
ok(L.spans(lines, () => false, end).length === 0, 'no lines of my own: the singers never stop');
const p0 = L.plan(sp, 0);
ok(p0.guide === 1 && p0.changes.map(c => c.guide).join('') === '0101', 'from the start: singers, band on my lines, singers again');
const p1 = L.plan(sp, 6);
ok(p1.guide === 0 && p1.changes[0].t === sp[0][1] && p1.changes[0].guide === 1, 'starting in the middle of my line (loop, back 10 s, slider): band only right away');
ok(L.plan(sp, 30).changes.length === 0 && L.plan(sp, 30).guide === 1, 'after the last line: singers, nothing left to switch');
ok(L.level(0).n === 1 && L.level(9).n === 4 && L.level('2').n === 2, 'levels are 1 to 4');
ok(L.LEVELS.map(x => (x.hear ? 'H' : '-') + (x.see ? 'S' : '-')).join(' ') === 'HS -S H- --', 'steps: hear and see, see only, hear only, neither');
// the audio schedule on a fake gain pair
const ev = []; const param = n => ({ cancelScheduledValues() { ev.push([n, 'cancel']); }, setValueAtTime(v, t) { ev.push([n, 'set', v, +t.toFixed(3)]); }, linearRampToValueAtTime(v, t) { ev.push([n, 'ramp', v, +t.toFixed(3)]); } });
const ctx = { currentTime: 100 }, gg = { context: ctx, gain: param('guide') }, gp = { context: ctx, gain: param('band') };
L.schedule(gg, gp, sp, 0, 100.05, 1);
const g = ev.filter(e => e[0] === 'guide' && e[1] === 'ramp'), b = ev.filter(e => e[0] === 'band' && e[1] === 'ramp');
ok(g.length === 4 && near(g[0][3] - 100.05, 4.85 + L.FADE) && g[0][2] === 0 && b[0][2] === 1, 'guide fades out and the band fades in over ' + L.FADE * 1000 + ' ms at 4.85 s');
ok(g.every((e, i) => e[2] === b[i][2] ^ 1), 'the two tracks always add up to one (no dip, no doubling)');
process.exit(bad ? 1 : 0);
