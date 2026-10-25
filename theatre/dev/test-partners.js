/* node theatre/dev/test-partners.js — Partner classes (js/partners.js): calendar invitations for partner-class sessions */
const PC = require('../js/partners.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const cls = { id: 'c1', name: 'Dance Arts' };
const P = { us: { me: 'Colleen', meEmail: 'me@school.org', co: 'Pat', coEmail: 'pat@school.org' }, cls: { c1: { teacher: 'Ms. Sidoti', email: 'sidoti@school.org' } } };
const s = { id: 'ps1', cls: 'c1', date: '2027-09-14', start: '10:05', end: '10:53', where: 'Dance studio', title: '', goal: 'Teach counts 1–32 of Get’cha Head in the Game; film the tutorial', plan: 'Warm-up, small groups, film', seq: 0 };

ok(PC.problems(s).length === 0, 'a full session has no problems');
ok(PC.problems(Object.assign({}, s, { goal: '' })).some(p => /objective/.test(p)), 'the objective is required');
ok(PC.problems(Object.assign({}, s, { end: '10:00' })).some(p => /after the start/.test(p)), 'the end must be after the start');
ok(PC.problems(Object.assign({}, s, { cls: '' })).length === 1, 'a class must be picked');

ok(PC.guests(cls, P).join() === 'me@school.org,pat@school.org,sidoti@school.org', 'all three teachers are guests');
ok(PC.guests(cls, { us: { meEmail: 'me@school.org', coEmail: 'ME@school.org' }, cls: { c1: { email: 'not an email' } } }).join() === 'me@school.org', 'no duplicates, no bad emails');

const u = PC.gcalUrl(s, cls, P);
ok(u.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&'), 'Google Calendar new-event link');
ok(u.includes('dates=20270914T100500%2F20270914T105300') && u.includes('ctz=America%2FChicago'), 'date and times in Chicago time');
ok(u.includes('add=me%40school.org%2Cpat%40school.org%2Csidoti%40school.org'), 'guests added');
ok(decodeURIComponent(u).includes('Objective: Teach counts 1–32'), 'the objective is in the details');
ok(decodeURIComponent(u).includes('Teachers: Colleen, Pat, Ms. Sidoti'), 'the teachers are named');

const f = PC.ics([{ s, cls }], P, new Date(Date.UTC(2027, 7, 1, 12, 0, 0)));
const lines = f.split('\r\n');
ok(lines[0] === 'BEGIN:VCALENDAR' && f.endsWith('END:VCALENDAR\r\n'), 'a calendar file');
ok(f.includes('DTSTART;TZID=America/Chicago:20270914T100500') && f.includes('DTEND;TZID=America/Chicago:20270914T105300'), 'start and end with the time zone');
ok(f.includes('BEGIN:VTIMEZONE') && f.includes('UID:ps1@asl.cool') && f.includes('DTSTAMP:20270801T120000Z'), 'time zone, a fixed id, a stamp');
ok((f.match(/ATTENDEE;/g) || []).length === 3 && f.includes('ORGANIZER;CN=Colleen:mailto:me@school.org'), 'three attendees and the organizer');
ok(f.includes('TRIGGER:-P1D') && f.includes('TRIGGER:-PT30M'), 'reminders the day before and 30 minutes before');
ok(lines.every(l => Buffer.byteLength(l, 'utf8') <= 75), 'every line is 75 octets or fewer');
const unfolded = f.replace(/\r\n /g, '');
ok(unfolded.includes('SUMMARY:Dance Arts + Adaptive Theatre Arts') && unfolded.includes('Get’cha Head in the Game\\; film the tutorial'), 'folded lines come back whole; ; is escaped');
ok(unfolded.includes('LOCATION:Dance studio'), 'the place');

ok(PC.status(s) === 'new', 'not sent yet');
const sent = Object.assign({}, s, { sent: { at: '2027-09-01', hash: PC.hashOf(s) } });
ok(PC.status(sent) === 'sent', 'sent');
ok(PC.status(Object.assign({}, sent, { start: '10:15' })) === 'changed', 'changing the time after sending marks it changed');
ok(PC.status(Object.assign({}, sent, { goal: 'Something else' })) === 'changed', 'changing the objective marks it changed');
ok(PC.status(Object.assign({}, sent, { seq: 3 })) === 'sent', 'the update number alone does not');
ok(PC.time12('13:05') === '1:05 PM' && PC.time12('00:30') === '12:30 AM', '12-hour times');
process.exit(bad ? 1 : 0);
