/* node theatre/dev/test-crew.js — the Tech Week Crew questionnaire (js/crew.js): dates, required answers, the show's copy, the gaps, the spreadsheet, sealing */
const C = require('../js/crew.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
(async () => {
  const P = C.publicForm(C.def(), 'HSM JR');
  ok(P.rehearsals.length === 3 && P.thu.length === 1 && P.shows.length === 2 && P.rehearsals[0].id === '2027-12-04' && P.thu[0].id === '2027-12-09', 'the starting dates: 3 rehearsals, the school-day shows, 2 evening shows');
  ok(P.jobs.some(j => /^Front of house/.test(j.name) && /concessions/.test(j.name)) && P.jobs[P.jobs.length - 1].name === 'I don’t know, but I want to help!' && new Set(P.jobs.map(j => j.id)).size === P.jobs.length, 'ways to help: her list, ids unique, "I don’t know" last');
  const pd = C.parseDates('12/4/2027 Orientation (optional)\n2027-12-04 Rehearsal\nnot a date\n13/40/2027 bad');
  ok(pd.dates.length === 2 && pd.dates[0].optional && pd.dates[0].what === 'Orientation' && pd.dates[1].id === '2027-12-04b' && pd.bad.length === 2, 'one per line; "(optional)"; two on one day; bad lines listed');
  ok(C.parseDates(C.datesText(pd.dates)).dates.every((d, i) => d.id === pd.dates[i].id && d.optional === pd.dates[i].optional), 'and back to text');
  const raw = { name: '  Jamie Rivera ', email: 'JR@School.org', src: ['rec', 'best-buddies', 'best-buddies', 'nope'], recBy: '', other: 'ignored', ans: { '2027-12-04': 'y', '2027-12-06': 'm', 'junk': 'y' }, why: { '2027-12-04': 'ignored', '2027-12-06': '' }, jobs: ['props', 'nope'], story: 'short' };
  let a = C.clean(P, raw), miss = C.missing(P, a);
  ok(a.src.join() === 'rec,best-buddies' && !a.other && a.name === 'Jamie Rivera' && a.email === 'jr@school.org' && !a.ans.junk && !a.why['2027-12-04'] && a.jobs.join() === 'props', 'clean: trimmed, lower-case email, only known dates and jobs, no reason kept for "I can be there"');
  ok(miss.includes('recBy') && miss.includes('why:2027-12-06') && miss.includes('date:2027-12-08') && miss.includes('date:2027-12-09') && miss.includes('story') && !miss.includes('name'), 'missing: who recommended them, a reason for Maybe, every date, the write-up');
  ok(C.missing(P, C.clean(P, { name: 'Jamie', email: 'x' })).includes('name') && C.missing(P, C.clean(P, { name: 'Jamie', email: 'x' })).includes('email') && C.missing(P, C.clean(P, {})).includes('src'), 'first and last name, an email and where they heard are required');
  ok(C.missing(P, C.clean(P, { src: ['other'] })).includes('other') && !C.missing(P, C.clean(P, { src: ['nhs'] })).includes('other') && !C.missing(P, C.clean(P, { src: ['nhs'] })).includes('src'), '"Other" needs typing; a group does not');
  ok(P.groups.length === 17 && P.groups[0].name === 'Adaptive PE Leaders' && P.groups.some(g => g.name === 'The Lion (school newspaper)') && P.groups.some(g => g.name === 'Best Buddies') && C.publicForm(Object.assign(C.def(), { groups: 'NHS\nChoir' }), 'x').groups.length === 2 && C.publicForm({ rehearsals: '', thu: '', shows: '', jobs: 'Props' }, 'x').groups.length === 17, 'the invited groups: her list, editable; an older saved form gets the list');
  const full = Object.assign({}, raw, { recBy: 'Ms. Lee', ans: { '2027-12-04': 'y', '2027-12-06': 'm', '2027-12-08': 'n', '2027-12-09': 'y', '2027-12-10': 'y', '2027-12-11': 'y' }, why: { '2027-12-06': 'work until 5', '2027-12-08': 'game' }, story: 'I like building things and I ran props for the spring play.', notFor: 'Being on stage', food: 'peanuts' });
  a = C.clean(P, full);
  ok(C.missing(P, a).length === 0, 'everything answered: nothing missing');
  const P2 = C.publicForm(Object.assign(C.def(), { rehearsals: '12/1/2027 Orientation (optional)\n' + C.def().rehearsals }), 'x');
  ok(C.missing(P2, a).length === 0, 'an optional date may be left blank');
  const s = C.showCopy(a, '2027-11-01T10:00:00Z');
  ok(s.src.join() === 'rec,best-buddies' && C.srcName(s, { recBy: 'Ms. Lee' }, P) === 'Recommended by Ms. Lee, Best Buddies' && C.srcName({ src: 'art' }, {}, P) === 'Art' && s.short === 'Jamie R.' && !JSON.stringify(s).match(/jr@school|Rivera|peanuts|work until|Ms\. Lee|props for the spring|stage/i) && s.id === C.personId('jr@SCHOOL.org '), 'the show’s copy has no email, full name, reasons, write-ups or food; same id for the same email');
  const t = C.tally(P, [s, { id: 'b', ans: { '2027-12-04': 'n' }, jobs: [] }], { '2027-12-04': 3 });
  ok(t[0].y === 1 && t[0].n === 1 && t[0].short && t[1].m === 1 && t[2].none === 1 && !t[1].short, 'gaps: can come / maybe / can’t / no answer, short against the number needed');
  ok(C.tally(P, [s, { id: 'b', ans: { '2027-12-04': 'y' }, jobs: [] }], {}, 'props')[0].y === 1, 'filter by a way to help');
  const ts = C.tally(P, [s, { id: 'b', ans: { '2027-12-04': 'y' }, jobs: [] }, { id: 'c', ans: { '2027-12-04': 'y' }, jobs: [] }], { '2027-12-04': 2 }, '', { [s.id]: 'yes', b: 'later', c: 'yes' });
  ok(ts[0].y === 3 && ts[0].sel === 2 && !ts[0].short && C.tally(P, [s], { '2027-12-04': 1 }, '', {})[0].short, 'gaps count only Selected applicants who can come');
  ok(C.statusName('yes') === 'Selected' && C.statusName('later') === 'Maybe later' && C.statusName('no') === 'Not this time' && C.statusName() === 'Not decided', 'decisions: Selected / Maybe later / Not this time / Not decided');
  ok(/Apply to help/.test(C.def().intro) && /can’t take everyone/.test(C.def().intro) && C.def().intro !== C.OLD_INTRO, 'the welcome words say it is an application and not everyone is chosen');
  const csv = C.csv(P, [s], { [s.id]: { name: 'Jamie Rivera', email: 'jr@school.org', recBy: 'Ms. Lee', why: a.why, story: '=HYPERLINK("x")', notFor: 'Being on stage', food: 'peanuts', status: 'later', note: 'strong with props' } });
  ok(csv.charCodeAt(0) === 0xfeff && /"Jamie Rivera"/.test(csv) && /"Maybe: work until 5"/.test(csv) && /"Yes, I can miss the whole day"/.test(csv) && /"Recommended by Ms. Lee, Best Buddies"/.test(csv) && /"'=HYPERLINK/.test(csv) && /Being on stage/.test(csv) && /"Maybe later"/.test(csv) && /strong with props/.test(csv), 'spreadsheet: one row each, reasons, Thursday wording, which teacher, formulas made safe');
  if (globalThis.crypto && crypto.subtle) {
    const k = await C.newKeys(), box = await C.seal(k.pub, a);
    ok(!JSON.stringify(box).includes('Rivera') && (await C.open(k.priv, box)).story === a.story, 'sealed with the public key; only the private key opens it');
    const k2 = await C.newKeys(); let opened = true; try { await C.open(k2.priv, box); } catch (e) { opened = false; }
    ok(!opened, 'another key cannot open it');
  }
  process.exit(bad ? 1 : 0);
})();
