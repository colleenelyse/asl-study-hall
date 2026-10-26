/* node theatre/dev/test-curtain-fit.js — Count the music (js/curtain.js fitCounts): her taps averaged into one steady beat, with her phrases */
const src = require('fs').readFileSync(__dirname + '/../js/curtain.js', 'utf8');
const body = src.slice(src.indexOf('  function fitCounts'), src.indexOf('  /* 8-count n (from 1) starts on beat ones[n-1]'));
const fitCounts = new Function(body + '; return fitCounts;')();
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok   ' : 'FAIL ', m); if (!c) bad++; };
const beat = 60 / 116; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
/* a song: 8-counts, with one 4-count transition after the 10th */
const lens = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 8, 8, 8, 8, 8, 8, 8, 8, 8], song = []; let k = 0;
lens.forEach(L => { for (let c = 0; c < L; c++) { song.push([0.04 + k * beat, c === 0 ? 1 : 0]); k++; } });
const jit = list => list.map(x => [x[0] + rnd() * 0.1, x[1]]);
let f = fitCounts(jit(song));
ok(Math.abs(f.bpm - 116) < 0.15 && Math.abs(f.first - 0.04) < 0.03, 'taps a little early or late average out to the tempo (' + f.bpm + ') and count 1 (' + f.first + ')');
ok(f.ones.length === 20 && f.ones[10] === 80 && f.ones[11] === 84 && f.ones[19] === 148, 'the 4-count transition stays 4 counts: every 8-count after it starts in the right place');
ok(f.notes.length === 1 && f.notes[0].n === 11 && f.notes[0].kind === 'four', 'and it is pointed out as a 4-count (8-count 11)');
const missedCount = jit(song).filter((x, i) => i !== 37 && i !== 100);
f = fitCounts(missedCount);
ok(f.ones.length === 20 && f.ones[12] === 92, 'a missed count is filled in: nothing after it moves');
const missedOne = jit(song).map((x, i) => i === 40 ? [x[0], 0] : x);
f = fitCounts(missedOne);
ok(f.ones.length === 20 && f.filled === 1 && f.ones[5] === 40, 'a missed 1 (tapped as 2-8) is put back');
const slip = jit(song).concat([[10.31, 0], [20.0, 0]]);
f = fitCounts(slip);
ok(Math.abs(f.bpm - 116) < 0.15 && f.off >= 1 && f.ones.length === 20, 'a stray tap is left out (' + f.off + ')');
const early = jit(song).map((x, i) => i === 48 ? [x[0] - beat, 1] : x);
f = fitCounts(early);
ok(f.notes.some(n => n.kind === 'odd'), 'a 1 tapped a count early shows up as a 7 or 9 to check');
ok(fitCounts([[1, 1], [2, 1]]) === null, 'needs enough taps');
// the two speeds: double time makes each tapped count two counts
const sp = src.slice(src.indexOf('  function speedUp(c)'), src.indexOf('  var E = function (P)'));
const speedUp = new Function(sp + '; return speedUp;')();
const tapped = { bpm: 58, first: 0.04, ones: [0, 8, 16, 20, 28] };
const d = speedUp(Object.assign({ double: true }, tapped));
ok(d.bpm === 116 && JSON.stringify(d.ones) === JSON.stringify([0, 8, 16, 24, 32, 40, 48, 56, 64]), 'double time: twice the tempo, each tapped 8-count becomes two, the 4-count transition one (' + d.ones.join(',') + ')');
ok(speedUp(tapped) === tapped, 'as tapped: unchanged');
process.exit(bad ? 1 : 0);
