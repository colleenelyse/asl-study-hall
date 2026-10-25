// The two-block planner (js/rehearsal-plan.js) on HSM JR and a fall calendar: nobody in two places, nobody without a job,
// no third day in a row of one kind, mostly on theme, every scene blocked and every song taught.
global.window = {};
require('../js/show-hsm-jr.js');
const RP = require('../js/rehearsal-plan.js');
const S = window.DEFAULT_SHOW;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const off = ['2027-09-06', '2027-10-11', '2027-10-28', '2027-10-29'], days = [];
for (let d = new Date(2027, 7, 23); d <= new Date(2027, 10, 19); d.setDate(d.getDate() + 1)) {
  const w = d.getDay(), s = d.toISOString().slice(0, 10); if (w > 0 && w < 6 && off.indexOf(s) < 0) days.push({ date: s, min: s === '2027-09-22' ? 20 : w === 3 ? 35 : 48 });
}
const R = RP.plan(S, { days, fixed: { '2027-10-13': { kind: 'trip', title: 'Shopping trip', mark: 'M', crewAll: true } }, windows: { sizes: ['2027-09-13', '2027-09-17'], photos: ['2027-10-14', '2027-10-20'] },
  deadlines: { scene: '2027-10-08', vocals: '2027-09-30', dance: '2027-10-22' } });
ok(R.days.length === days.length, days.length + ' days planned');
ok(R.stats.problems.length === 0, 'every block: nobody in two places, nobody with nothing to do' + (R.stats.problems.length ? ' (' + R.stats.problems.slice(0, 3).join('; ') + ')' : ''));
ok(Object.values(R.stats.tracks).every(t => t.threeInARow === 0), 'no track does the same kind of work three days in a row');
const TH = { 1: 'A', 2: 'V', 3: 'A', 4: 'D' }; let on = 0, tot = 0;
R.days.forEach(d => { if (d.kind === 'work' && TH[d.wd]) d.rooms.forEach(r => { if (r.piece) { tot++; if (r.kind === TH[d.wd]) on++; } }); });
ok(on / tot >= 0.7, 'teacher rooms on the day’s theme: ' + Math.round(on / tot * 100) + '%');
const notStarted = R.stats.pieces.filter(p => p.learn > 0 && p.sessions === 0 && !/Reprise|Megamix|Wildcat/.test(p.label));
ok(notStarted.length === 0, 'every scene blocked and every song taught' + (notStarted.length ? ': missing ' + notStarted.map(p => p.label + ' ' + p.kind).join(', ') : ''));
const sized = new Set(); R.days.forEach(d => { (d.groupC || []).forEach(g => { if (g.task === 'sizes') g.people.forEach(c => sized.add(c)); }); (d.sizesCall || []).forEach(c => sized.add(c)); });
ok(sized.size === R.all.length, 'the sizes station reaches every track in its week');
// physical moments with a few people (S.bits): each gets its own time, soon after its scene or dance is first staged, and nothing else breaks
const R2 = RP.plan(S, { days, bits: S.bits, deadlines: { scene: '2027-10-08', vocals: '2027-09-30', dance: '2027-10-22' } });
ok(R2.stats.problems.length === 0, 'with the moments: nobody in two places, nobody with nothing to do' + (R2.stats.problems.length ? ' (' + R2.stats.problems.slice(0, 3).join('; ') + ')' : ''));
const firstDay = id => R2.days.findIndex(d => d.rooms.some(r => r.piece === id));
const own = S.bits.filter(b => b.own > 0), bp = id => R2.stats.pieces.find(p => p.id === 'bit:' + id);
const missed = own.filter(b => !bp(b.id) || bp(b.id).done < b.own);
ok(missed.length === 0, own.length + ' moments each get their minutes on their own' + (missed.length ? ': missing ' + missed.map(b => b.id + ' ' + (bp(b.id) ? bp(b.id).done : '-')).join(', ') : ''));
const par = b => b.song ? (R2.pieces[b.song + 'Dp'] ? b.song + 'Dp' : b.song + 'D') : b.scene;
const late = own.filter(b => { const f = firstDay('bit:' + b.id), fp = firstDay(par(b)); return !(fp >= 0 && f > fp && f - fp <= 15); });
ok(late.length === 0, 'each moment comes after its scene or dance is first staged, within three weeks' + (late.length ? ': ' + late.map(b => b.id + ' ' + firstDay(par(b)) + '→' + firstDay('bit:' + b.id)).join(', ') : ''));
const ns2 = R2.stats.pieces.filter(p => p.learn > 0 && p.sessions === 0 && !/Reprise|Megamix|Wildcat/.test(p.label));
ok(ns2.length === 0, 'with the moments: still every scene blocked and every song taught');
const twirl = R2.days.find(d => d.rooms.some(r => r.piece === 'bit:b9')), tr = twirl && twirl.rooms.find(r => r.piece === 'bit:b9');
ok(tr && tr.people.slice().sort().join() === 'gabriella,sharpay,troy,zeke', 'the twirl into the cake is rehearsed with just Troy, Gabriella, Zeke and Sharpay (' + (twirl ? twirl.date : 'never') + ')');
process.exit(fails ? 1 : 0);
