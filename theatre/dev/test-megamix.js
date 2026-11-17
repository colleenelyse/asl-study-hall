/* node theatre/dev/test-megamix.js — Megamix groups (js/megamix.js) and the Megamix in the rehearsal plan (js/rehearsal-plan.js) */
global.window = {};
require('../js/show-hsm-jr.js');
const M = require('../js/megamix.js'), RP = require('../js/rehearsal-plan.js');
const S = window.DEFAULT_SHOW;
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok   ' : 'FAIL ', m); if (!c) bad++; };
const secs = M.sectionsOf(S), A = M.suggest(S), inSec = k => Object.keys(A).filter(c => A[c].includes(k));
const names = secs.map(s => s.name);
ok(names.join(' | ') === 'Start of Something New | What I’ve Been Looking For | Stick to the Status Quo | Bop to the Top | We’re All in This Together | Breaking Free and the big finish', 'six sections in her order, the last one everyone');
ok(Object.values(A).every(a => !M.adjacent(a)), 'nobody is in two sections in a row, so the groups change completely');
ok(['zeke', 'taylor', 'martha'].every(c => A[c].includes(2)), 'Status Quo is Zeke and Taylor’s (and Martha’s) big song: they do that section');
ok(['sharpay', 'ryan'].every(c => A[c].includes(3)) && ['troy', 'gabriella'].every(c => A[c].includes(4)), 'Sharpay and Ryan do Bop to the Top; Troy and Gabriella We’re All in This Together');
ok(['troy', 'gabriella', 'sharpay', 'ryan'].every(c => A[c].every(k => k >= 3)), 'the four leads sit out the first three sections');
const strong = S.megamix.strong, chorusOf = k => inSec(k).filter(c => !strong.includes(c) && !S.megamix.leads.includes(c));
ok([0, 1, 2, 3, 4].every(k => inSec(k).some(c => strong.includes(c)) && chorusOf(k).length >= 2), 'every section mixes the supporting characters with the chorus and minor featured roles');
const fresh = M.problems(S, A).filter(p => p.kind === 'new');
ok(fresh.length <= 2 && fresh.every(p => /What I’ve Been Looking For/.test(p.text)), 'nobody learns a song only for the Megamix, except two for What I’ve Been Looking For (only a few know it)');
ok(A.coach.length === 1 && A.coach[0] === 3, 'Coach Bolton does Bop to the Top, the only song he knows');
ok(M.problems(S, A).every(p => p.kind !== 'row' && p.kind !== 'empty' && p.kind !== 'lead'), 'no section is empty, no lead starts early');
// her changes win over the suggestion, and the warnings catch two in a row
const R0 = M.resolve(S, { assign: { zeke: [2, 3] } });
ok(R0.zeke.join() === '2,3' && M.problems(S, R0).some(p => p.kind === 'row' && p.cid === 'zeke'), 'a change she makes is kept, and two in a row is flagged');
ok(M.studentClashes(S, A, [{ id: 'a1', name: 'Pat', chars: ['zeke', 'sharpay'] }]).length === 1, 'a Company member who doubles roles in sections 3 and 4 is flagged');
const W = c => (c === 'jocks' ? 6 : 1), A6 = M.suggest(S, W);
ok(Object.values(A6).every(a => !M.adjacent(a)), 'with real cast sizes, still no two in a row');

// the plan: each section is taught to its own group, right after its original song
const off = ['2027-09-06', '2027-10-11', '2027-10-28', '2027-10-29'], days = [];
for (let d = new Date(2027, 7, 23); d <= new Date(2027, 10, 19); d.setDate(d.getDate() + 1)) {
  const w = d.getDay(), s = d.toISOString().slice(0, 10); if (w > 0 && w < 6 && off.indexOf(s) < 0) days.push({ date: s, min: s === '2027-09-22' ? 20 : w === 3 ? 35 : 48 });
}
const mx = M.forPlan(S, A);
const R = RP.plan(S, { days, megamix: mx, deadlines: { scene: '2027-10-08', vocals: '2027-09-30', dance: '2027-10-22' } });
ok(R.stats.problems.length === 0, 'with the Megamix sections: nobody in two places, nobody with nothing to do' + (R.stats.problems.length ? ' (' + R.stats.problems.slice(0, 3).join('; ') + ')' : ''));
const first = pred => R.days.findIndex(d => d.rooms.some(r => r.piece && pred(r)));
const late = [];
mx.sections.forEach((sec, k) => {
  if (sec.all) return;
  const id = 'm41D:' + sec.id, f = first(r => r.piece === id);
  // from the day every part of the original song's dance (featured and ensemble) has started
  const parts = Object.values(R.pieces).filter(q => q.type === 'song' && q.kind === 'D' && q.learn > 0 && !String(q.part).startsWith(':') && sec.from.includes(q.song.id));
  const starts = parts.map(q => first(r => r.piece === q.id)), src = starts.some(x => x < 0) ? -1 : Math.max(...starts);
  if (f < 0) late.push(sec.name + ' never taught');
  else if (src < 0 || f < src) late.push(sec.name + ' before its song');
  else if (f - src > 15) late.push(sec.name + ' ' + (f - src) + ' days after its song');
  const room = R.days[f] && R.days[f].rooms.find(r => r.piece === id);
  if (room && room.people.some(c => !sec.people.includes(c))) late.push(sec.name + ' taught to someone outside its group');
});
ok(late.length === 0, 'every section is taught to its own group after its original song, within three weeks of the song’s dance starting' + (late.length ? ': ' + late.join('; ') : ''));
ok(R.days.some(d => d.rooms.some(r => r.piece === 'm41D' || r.piece === 'm41V')), 'the last section (everyone) is rehearsed too');
process.exit(bad ? 1 : 0);
