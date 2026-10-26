/* node theatre/dev/test-curtain-fit.js — Count the music (js/curtain.js fitCounts): her taps averaged into one steady beat */
const src = require('fs').readFileSync(__dirname + '/../js/curtain.js', 'utf8');
const body = src.slice(src.indexOf('  function fitCounts'), src.indexOf('  var eightSec = function (P) { var m = mapOf(P);'));
const fitCounts = new Function(body + '; return fitCounts;')();
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok   ' : 'FAIL ', m); if (!c) bad++; };
const beat = 60 / 116; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const taps = []; for (let k = 0; k < 22 * 8; k++) taps.push([0.04 + k * beat + rnd() * 0.1, k % 8 === 0 ? 1 : 0]);
let f = fitCounts(taps);
ok(Math.abs(f.bpm - 116) < 0.15 && Math.abs(f.first - 0.04) < 0.03, 'taps a little early or late average out to the real tempo (' + f.bpm + ') and count 1 (' + f.first + ')');
const messy = taps.filter((x, i) => i !== 40 && i !== 41).concat([[10.31, 0], [20.0, 1]]);
f = fitCounts(messy);
ok(Math.abs(f.bpm - 116) < 0.15 && f.off >= 1 && f.badOnes === 1, 'missing taps, a stray tap and a 1 on the wrong count do not throw it off (' + f.bpm + ', ' + f.off + ' left out)');
const slowStart = taps.map(x => [x[0] + 3, x[1]]);
ok(Math.abs(fitCounts(slowStart).first - 3.04) < 0.03, 'count 1 can be anywhere in the recording');
ok(fitCounts([[1, 1]]) === null, 'needs at least two 1s');
process.exit(bad ? 1 : 0);
