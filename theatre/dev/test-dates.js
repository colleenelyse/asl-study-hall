/* node theatre/dev/test-dates.js — reading a pasted district calendar (Production > Calendar & crew) */
const src = require('fs').readFileSync(require('path').join(__dirname, '../js/production.js'), 'utf8');
const pad = n => (n < 10 ? '0' : '') + n, ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }, addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }, today = () => ymd(new Date()), T = {};
eval(src.match(/var MONTHS[\s\S]*?T.pasteDates = pasteDates;/)[0]);
const r = pasteDates('Labor Day 9/7/2026\nThanksgiving Break: Nov 25 – Nov 27\nWinter Break 12/21/2026 - 1/1/2027\nDec 21-23\nMonday, January 18th (MLK Day)\n2027-03-22 to 2027-03-26\n5/31\n10/9-10/12\nnot a date\nTeacher Institute 13/45/2026', '2026-08-20');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
ok(r.dates.length === 27, '27 days off (' + r.dates.length + ')');
ok(r.dates.includes('2027-05-31') && !r.dates.includes('2026-05-31'), 'a date with no year falls in this school year');
ok(['2026-11-25', '2026-11-26', '2026-11-27'].every(d => r.dates.includes(d)), 'Nov 25 – Nov 27');
ok(r.dates.includes('2027-01-01') && r.dates.includes('2026-12-24'), 'a range across New Year');
ok(r.dates.includes('2027-03-26'), 'a range of full dates');
ok(r.bad.length === 1 && /13\/45/.test(r.bad[0]), 'an impossible date is reported, not guessed');
process.exit(bad ? 1 : 0);
