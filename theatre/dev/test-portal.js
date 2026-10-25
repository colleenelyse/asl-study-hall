/* node theatre/dev/test-portal.js — the Family portal's rules (js/portal.js): forms cleaned, notes taken into the vault, the sizes check-again list */
const C = require('../js/portal.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const cast = [{ id: 'a1', name: 'Sam Lee' }, { id: 'a2', name: 'Ana Ruiz' }, { id: 'a3', name: 'Bo Kim' }], ids = cast.map(a => a.id);

ok(C.clean('fit', { answer: 'yes' }) === null, 'a yes without a signature is refused');
ok(C.clean('fit', { answer: 'self' }).answer === 'self', '"not needed" needs no signature');
ok(C.clean('fit', { answer: 'maybe', signer: 'X' }) === null, 'an unknown answer is refused');
const s = C.clean('sizes', { shirt: '  Youth   L ', bogus: 'x', shoe: 'W 7'.repeat(40), brands: 'Old Navy' });
ok(s.shirt === 'Youth L' && !s.bogus && s.shoe.length === 60 && s.brands === 'Old Navy', 'sizes: known fields only, tidied and kept short');
ok(C.clean('sizes', {}) === null && C.clean('sensory', { tags: ' ' }) === null, 'an empty form is refused');
ok(C.clean('sensory', { makeupOk: 'no', tags: 'cut out' }).makeupOk === 'no' && !C.clean('sensory', { makeupOk: 'lots', tags: 'a' }).makeupOk, 'sensory: makeup answer only from the list');
const items = C.DEF_COMMIT;
ok(C.clean('commit', { items, agree: items.map(() => true), signer: '' }) === null, 'commitment needs a signature');
ok(C.clean('commit', { items, agree: items.map((x, i) => i > 0), signer: 'Pat Lee' }) === null, 'commitment needs every box ticked');
ok(C.clean('commit', { items, agree: items.map(() => true), signer: 'Pat Lee', student: 'Sam', date: '2027-09-01' }).items.length === items.length, 'a full commitment is accepted');
const cc = C.clean('commit', { items, agree: items.map(() => true), signer: 'Pat Lee' });
ok(C.clean('commit', cc) && C.clean('commit', cc).signer === 'Pat Lee', 'a cleaned commitment is still accepted when the teacher takes it in');
ok(C.takeNote({ extra: {} }, {}, { type: 'portal', kind: 'commit', actor: 'a1', data: cc, _at: '2027-09-01' }, ids), 'a commitment note from a family is taken');
for (const k of C.KINDS) { const d = { fit: { answer: 'yes', signer: 'P' }, sizes: { shirt: 'M' }, sensory: { tags: 'x' }, commit: cc, video: { answer: 'yes', signer: 'P' }, contact: { email: 'p@x.org', opts: { general: true } }, conflicts: { answers: { '2027-12-04': 'no' }, notes: { '2027-12-04': 'wedding' } } }[k]; ok(C.clean(k, C.clean(k, d)) !== null, k + ': cleaning twice still passes (the family cleans, then the teacher)'); }
ok(C.clean('video', { answer: 'class', signer: 'Pat Lee' }).answer === 'class' && C.clean('video', { answer: 'no' }) === null, 'video permission: signed answers only');

const V = { extra: {} }, show = {};
ok(!C.takeNote(V, show, { type: 'portal', kind: 'sizes', actor: 'zz', data: { shirt: 'M' } }, ids), 'a note for someone not in the cast is dropped');
ok(!C.takeNote(V, show, { type: 'volunteer', kind: 'sizes', actor: 'a1', data: { shirt: 'M' } }, ids), 'other note types are not taken');
ok(C.takeNote(V, show, { type: 'portal', kind: 'sizes', actor: 'a1', data: { shirt: 'M' }, stamp: 2, _at: '2027-09-02T10:00:00Z' }, ids), 'a sizes note is taken');
ok(V.extra.portal.a1.sizes.shirt === 'M' && show.portal.got.a1.sizes === '2027-09-02', 'answers go to the vault; the show keeps only the date');
ok(JSON.stringify(show).indexOf('"M"') < 0, 'no sizes in the show');
C.takeNote(V, show, { type: 'portal', kind: 'sizes', actor: 'a1', data: { shirt: 'S' }, stamp: 1, _at: '2027-09-03' }, ids);
ok(V.extra.portal.a1.sizes.shirt === 'M', 'an older copy arriving late does not replace a newer one');
C.takeNote(V, show, { type: 'portal', kind: 'sizes', actor: 'a1', data: { shirt: 'L' }, stamp: 3, _at: '2027-09-04' }, ids);
ok(V.extra.portal.a1.sizes.shirt === 'L', 'sending again replaces it');
ok(JSON.stringify({ type: 'portal', kind: 'sensory', actor: 'a1', data: C.clean('sensory', Object.fromEntries(C.SENSE_FIELDS.map(f => [f[0], 'x'.repeat(240)]))), stamp: Date.now(), sent: '2027-09-01' }).length <= C.NOTE_MAX, 'a sensory form filled to the brim still fits in one note');

C.addSchool(V, show, 'a1', { at: '2027-09-13', by: 'Ms. E', ok: false, sizes: { shirt: 'M' } });
C.addSchool(V, show, 'a2', { at: '2027-09-13', ok: true, sizes: { shirt: 'S' } });
C.addSchool(V, show, 'a3', { at: '2027-09-14', ok: false, sizes: {} });
ok(C.checkAgain(cast, show.sizeCheck, '2027-09-13').length === 0, 'not on the list the same day');
let l = C.checkAgain(cast, show.sizeCheck, '2027-09-15');
ok(l.length === 2 && l[0].id === 'a1' && l[1].id === 'a3', 'Not enough shows the next day on, oldest first');
ok(C.checkAgain(cast, show.sizeCheck, '2027-09-20').length === 2, 'and keeps showing on later days');
C.addSchool(V, show, 'a1', { at: '2027-09-20', ok: true, sizes: { shirt: 'M', shoe: '7' } });
ok(C.checkAgain(cast, show.sizeCheck, '2027-09-21').map(x => x.id).join() === 'a3', 'off the list once marked Enough');
ok(V.extra.portal.a1.school.length === 2 && V.extra.portal.a1.school[0].ok, 'school records kept newest first');
ok(!show.sizeCheck.a1.sizes && JSON.stringify(show.sizeCheck).indexOf('shirt') < 0, 'the show keeps only the date and Enough');
ok(C.summary({ shirt: 'L', shoe: '8', shoeWidth: 'wide', brands: 'x' }, { shirt: 'M', waist: '28' }) === 'shirt M, waist 28, shoes 8 wide', 'shopping line: the school’s tag reading wins');
// show-week conflicts (audition week, before the cast list): answers to the vault, only the conflict dates in the show
const cf = C.clean('conflicts', { answers: { '2027-12-04': 'no', '2027-12-08': 'ok', 'bad': 'no', '2027-12-10': 'maybe' }, notes: { '2027-12-04': 'out of town', '2027-12-08': 'ignored' } });
ok(Object.keys(cf.answers).join() === '2027-12-04,2027-12-08' && cf.notes['2027-12-04'] === 'out of town' && !cf.notes['2027-12-08'], 'conflicts: only real dates and answers; a note only with a conflict');
ok(C.clean('conflicts', { answers: {} }) === null, 'conflicts: an empty form is refused');
const V2 = { extra: {} }, sh2 = {};
C.takeNote(V2, sh2, { type: 'portal', kind: 'conflicts', actor: 'a1', data: { answers: { '2027-12-04': 'no', '2027-12-08': 'ok' }, notes: { '2027-12-04': 'wedding' } }, _at: '2027-08-17' }, ids);
ok(sh2.portal.conflict.a1.dates.join() === '2027-12-04' && JSON.stringify(sh2).indexOf('wedding') < 0 && V2.extra.portal.a1.conflicts.notes['2027-12-04'] === 'wedding', 'the show keeps the conflict dates (for Casting); the family’s words stay in the vault');
C.takeNote(V2, sh2, { type: 'portal', kind: 'conflicts', actor: 'a1', data: { answers: { '2027-12-04': 'ok', '2027-12-08': 'ok' } }, _at: '2027-08-19' }, ids);
ok(sh2.portal.conflict.a1.dates.length === 0, 'sending again with no conflicts clears them');
ok(C.WEEK.some(w => w.date === '2027-12-08' && /3:30/.test(w.what)) && !C.WEEK.some(w => w.date === '2027-12-07') && C.DEF_COMMIT.some(t => /Wednesday, December 8/.test(t)) && !C.DEF_COMMIT.some(t => /December 7\b/.test(t)), 'the full dress is Wed Dec 8 (3:30–8 PM), plus Sat Dec 4');
process.exit(bad ? 1 : 0);
