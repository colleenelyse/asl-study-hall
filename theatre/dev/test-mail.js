/* node theatre/dev/test-mail.js — notification emails (js/mail.js): what is new since the last snapshot, who gets what, the email itself;
   the parents' email sign-up (portal.js, kind contact); the unsubscribe code matches the school-account script's (mail-script/Code.gs) */
const C = require('../js/mail.js'), Pc = require('../js/portal.js'), crypto = require('crypto'), fs = require('fs'), path = require('path');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const O = { songs: [{ id: 's1', title: 'Bop to the Top' }, { id: 's2', title: 'Auditions' }], characters: [{ id: 'troy', name: 'Troy Bolton', group: 'leads' }, { id: 'ens', name: 'Students', group: 'ensemble' }],
  moments: [{ song: 's1', on: ['troy'] }, { song: 's2', on: ['ens'] }, { on: '*' }] };
const h = { O, onStage: (m, chars) => m.on === '*' || chars.some(c => m.on.indexOf(c) >= 0), soloSongs: chars => chars.includes('troy') ? ['s1'] : [], dayName: d => d, time12: t => t };
const show = { cast: [{ id: 'a1', name: 'Sam Lee', chars: [], company: 'artist' }, { id: 'a2', name: 'Ana Ruiz', chars: [], company: 'mentor' }, { id: 'g', name: 'Guest', guest: true, chars: [] }],
  portal: { news: [] }, helpBoard: { posts: [] }, videos: [], production: { shown: [], performances: [] } };
const seen = C.snapshot(show, h);
ok(!seen.cast.g, 'guests are left out');
ok(C.diff(seen, C.snapshot(show, h), show, h).length === 0, 'nothing new, no emails');
show.portal.news.push({ id: 'n1', title: 'Shopping Wednesday', text: 'Bring water' });
show.cast[0].chars = ['troy']; show.cast[1].chars = ['ens'];
show.videos.push({ id: 'v1', song: 's1', ok: false });
let ev = C.diff(seen, C.snapshot(show, h), show, h);
ok(ev.some(e => e.kind === 'news' && e.title === 'Shopping Wednesday'), 'new news is found');
ok(!ev.some(e => e.kind === 'video'), 'a video waiting for the OK is not news');
const role = ev.find(e => e.kind === 'role');
ok(role && role.actors[0] === 'a1' && /Sam has a role: Troy Bolton/.test(role.title) && /Bop to the Top/.test(role.text), 'a new role, with its songs');
ok(!ev.some(e => e.kind === 'song' && e.actors[0] === 'a1') && !ev.some(e => e.kind === 'solo' && e.actors[0] === 'a1'), 'a new role does not also send its songs one by one');
ok(ev.some(e => e.kind === 'role' && e.actors[0] === 'a2'), 'ensemble roles count too');
const s2 = C.snapshot(show, h);
show.videos[0].ok = true; show.production.shown.push('2027-09-13');
O.moments[1].on = ['ens', 'troy'];      // Troy joins Auditions (Sam), and Ana gets a solo line
h.soloSongs = chars => chars.includes('troy') ? ['s1'] : chars.includes('ens') ? ['s2'] : [];
ev = C.diff(s2, C.snapshot(show, h), show, h);
ok(ev.some(e => e.kind === 'video' && e.actors.join() === 'a1'), 'an OK’d dance video goes to the people in that song');
ok(ev.some(e => e.kind === 'week'), 'a week shown on the calendar');
ok(ev.some(e => e.kind === 'song' && e.actors[0] === 'a1' && /Auditions/.test(e.title) && !/chorus/.test(e.title)), 'added to a musical number');
ok(ev.some(e => e.kind === 'solo' && e.actors[0] === 'a2' && /solo line in “Auditions”/.test(e.title)), 'a new solo line');
show.cast[1].chars = []; ok(!C.diff(C.snapshot(show, h), C.snapshot(show, h), show, h).length, 'snapshots are steady');

const P = { cast: show.cast, student: { a1: 'sam@school.org' },
  contacts: { a1: [{ email: 'pat@home.com', name: 'Pat Lee', opts: { general: true, mine: false, copies: true } }, { email: 'kim@home.com', name: 'Kim', opts: { general: false, mine: true, copies: false } }],
    a2: [{ email: 'Pat@Home.com', name: 'Pat Lee', opts: { general: true } }] } };
const news = { id: 'news:n1', kind: 'news', title: 'Shopping', text: 'x', page: '#/home', actors: null };
let r = C.plan([news], { 'news:n1': { a: false, m: false, p: true } }, P);
ok(r.length === 1 && r[0].to === 'pat@home.com', 'news to parents who want news, once per address (two Company members, one email)');
r = C.plan([news], { 'news:n1': { a: true, m: false, p: false } }, P);
ok(r.map(x => x.to).sort().join() === 'pat@home.com,sam@school.org' && r.find(x => x.to === 'pat@home.com').items[0].copyOf === 'Sam', 'Artists get it; a parent who asked for copies gets a copy');
const vid = { id: 'video:v1', kind: 'video', title: 'New dance video', text: '', page: '#/song/s1', actors: ['a1'] };
r = C.plan([news, vid], { 'news:n1': { p: true }, 'video:v1': { a: true, p: true } }, P);
const pat = r.find(x => x.to === 'pat@home.com'), kim = r.find(x => x.to === 'kim@home.com');
ok(pat.items.length === 2 && kim.items.length === 1 && kim.items[0].e.kind === 'video', 'one email per person with everything new for them; "changes for my Company member" gets the video');
ok(C.plan([news], { 'news:n1': { a: false, m: false, p: false } }, P).length === 0, 'nobody ticked, nobody emailed');
ok(C.plan([vid], { 'video:v1': { m: true } }, P).length === 0, 'Mentors ticked: an Artist’s video goes to nobody');
const mail = C.compose(pat, { title: 'High School Musical JR.', base: 'https://asl.cool/theatre/', sign: 'Ms. E', unsub: 'https://script.google.com/x?u=ab' });
ok(mail.subject === 'High School Musical JR.: 2 updates' && /Hello Pat,/.test(mail.text) && /https:\/\/asl\.cool\/theatre\/#\/song\/s1/.test(mail.text) && /Stop these emails: https/.test(mail.text), 'the email: subject, hello, a link for each item, how to stop');
ok(!/<script/i.test(C.compose({ to: 'a@b.co', name: '<script>', items: [{ e: { title: '<b>x', text: '', page: '#/' }, copyOf: '' }] }, { title: 'T', base: '/', unsub: 'u' }).html), 'the HTML email escapes what was typed');

ok(Pc.clean('contact', { email: 'pat@gmail.com', opts: { general: true }, google: true }).google === true && Pc.clean('contact', { email: 'pat@gmail.com', opts: {}, google: 'yes' }).google === false, 'sign-up: the Google mark is kept only as true');
ok(Pc.clean('contact', { email: 'nope', opts: { general: true } }) === null, 'sign-up: a bad address is refused');
const V = { extra: {} }, sh = {};
Pc.takeNote(V, sh, { type: 'portal', kind: 'contact', actor: 'a1', data: { email: 'pat@home.com', name: 'Pat', opts: { general: true }, dev: 'd1' }, stamp: 1 }, ['a1']);
Pc.takeNote(V, sh, { type: 'portal', kind: 'contact', actor: 'a1', data: { email: 'kim@home.com', name: 'Kim', opts: { mine: true }, dev: 'd2' }, stamp: 2 }, ['a1']);
ok(V.extra.portal.a1.contacts.length === 2, 'two family members from two phones');
Pc.takeNote(V, sh, { type: 'portal', kind: 'contact', actor: 'a1', data: { email: 'pat.new@home.com', name: 'Pat', opts: { general: true, copies: true }, dev: 'd1' }, stamp: 3 }, ['a1']);
ok(V.extra.portal.a1.contacts.map(c => c.email).sort().join() === 'kim@home.com,pat.new@home.com', 'the same phone changing its address replaces it');
Pc.takeNote(V, sh, { type: 'portal', kind: 'contact', actor: 'a1', data: { email: 'kim@home.com', opts: {}, dev: 'd2' }, stamp: 4 }, ['a1']);
ok(V.extra.portal.a1.contacts.length === 1 && sh.portal.got.a1.contact, 'no boxes ticked = no more emails to that address');
ok(JSON.stringify(sh).indexOf('@') < 0, 'no addresses in the show');

// reminders before the dates families committed to
const pd = C.parseDates('12/7/2027 Full dress rehearsal, after school\n2027-12-10 – Evening show at 7:00 PM\nsoon: the cast party\n13/45/2027 nope');
ok(pd.dates.length === 2 && pd.dates[0].date === '2027-12-07' && pd.dates[1].what === 'Evening show at 7:00 PM' && pd.bad.length === 2, 'show-week dates typed one per line; unreadable lines are listed back');
ok(C.parseDates(C.datesText(C.DEF_DATES)).dates.length === C.DEF_DATES.length, 'the starting dates read back the same');
const R = { today: '2027-11-30', days: [7, 2, 1], horizon: 35, title: 'HSM JR.', base: 'https://asl.cool/theatre/', sign: 'Ms. E',
  dates: [{ date: '2027-12-07', what: 'The full dress rehearsal, after school' }, { date: '2027-12-01', what: 'Too soon' }],
  families: [{ actor: 'a1', name: 'Sam', committed: true, contacts: [{ email: 'pat@x.org', name: 'Pat Lee' }] }, { actor: 'a2', name: 'Ana', committed: true, contacts: [{ email: 'pat@x.org', name: 'Pat Lee' }] },
    { actor: 'a3', name: 'Bo', committed: false, contacts: [{ email: 'bo@x.org' }] }],
  signups: [{ to: 'pat@x.org', name: 'Pat Lee', date: '2027-12-07', title: 'Company dinner', what: 'bringing Main dish', qty: '2', note: 'lasagna', page: '#/help/dinner/n1' }, { to: '555-1234', name: 'Kim', date: '2027-12-07', title: 'Ushers' }] };
const rem = C.reminders(R);
ok(rem.map(r => r.on).sort().join() === '2027-12-05,2027-12-06', '2 days and 1 day before; a week before has already passed; nothing for a date too soon');
ok(rem.every(r => r.to === 'pat@x.org'), 'only families who signed the commitment (or signed up), only to email addresses');
const r1 = rem.find(r => r.on === '2027-12-06');
ok(/tomorrow/.test(r1.subject) && /The full dress rehearsal, after school \(Sam and Ana\)/.test(r1.text) && /Company dinner”: bringing Main dish ×2 \(lasagna\)/.test(r1.text), 'one email per family per date: both Company members, and what they are bringing');
ok(/Stop these emails: \{UNSUB\}/.test(r1.text) && /https:\/\/asl\.cool\/theatre\/#\/today/.test(r1.text), 'a link to the app and a way to stop them');
ok(C.reminders(R).map(r => r.id).join() === rem.map(r => r.id).join() && rem[0].id !== rem[1].id, 'the same reminder keeps its id (so the script never sends it twice)');
ok(C.reminders(Object.assign({}, R, { horizon: 5 })).length === 1, 'only the next month or so is scheduled at a time');
// the teacher's OK first (asked when Teacher mode opens), and suggested dates
const all = C.reminders(Object.assign({}, R, { today: '2027-11-25' }));
let wg = C.remGroups(all, {}, '2027-11-25', 7);
ok(wg.length && wg.every(g => g.on <= '2027-12-02') && wg[0].on === '2027-11-29' && wg[0].gk === '2027-12-01|2', 'waiting for an OK: the reminders sending in the next week, soonest first');
const g7 = wg.find(g => g.gk === '2027-12-07|7');
ok(g7 && g7.to.length === 1 && g7.whats.includes('The full dress rehearsal, after school') && g7.whats.includes('Volunteer and dinner sign-ups'), 'one line per date and lead time: who and what it is about');
ok(!C.remGroups(all, { '2027-12-07|7': 'yes' }, '2027-11-25', 7).some(g => g.gk === '2027-12-07|7') && !C.remGroups(all, { '2027-12-07|7': 'no' }, '2027-11-25', 7).some(g => g.gk === '2027-12-07|7'), 'once answered (yes or no), it does not ask again');
const allFam = C.reminders(Object.assign({}, R, { today: '2027-11-25', dates: [{ date: '2027-12-10', what: 'Evening show at 7 PM (all families)' }] }));
ok(allFam.some(r => r.to === 'bo@x.org') && !/all families/.test(allFam[0].text), 'a date marked “(all families)” goes to families who did not sign the commitment too');
const showS = { production: { performances: [{ id: 'p1', date: '2027-12-10', time: '19:00', kind: 'evening' }, { id: 'p2', date: '2027-12-09', time: '10:00', kind: 'school' }, { id: 'p3', date: '2027-12-07', kind: 'school' }],
  days: { '2027-10-13': { groups: [{ focus: 'trip', where: 'Target' }] }, '2027-10-14': { groups: [{ focus: 'acting' }] } } } };
const sg = C.suggest(showS, [{ date: '2027-12-07', what: 'Dress' }], '2027-10-01', 75, ['2027-12-09']);
ok(sg.map(x => x.date).join() === '2027-10-13,2027-12-10' && /Field trip to Target \(all families\)/.test(sg[0].what) && sg[1].what === 'Evening show at 7 PM (all families)', 'suggested dates: field trips and performances not on the list yet (and not turned down)');
// reminders for forms still To do (sent on their own; parents and the Company member; siblings together; the day after too)
const FR = { today: '2027-08-10', days: [7, 2, 1, -1], horizon: 35, title: 'HSM JR.', base: 'https://asl.cool/theatre/', sign: 'Ms. E',
  due: { conflicts: '2027-08-19', sizes: '2027-09-10', contact: '2027-08-27' }, labels: { conflicts: 'Show-week conflicts', sizes: 'Clothing sizes' },
  kids: [{ actor: 'a1', name: 'Sam', done: { sizes: true }, parents: [{ email: 'pat@x.org', name: 'Pat Lee' }], student: 'sam@school.org' },
    { actor: 'a2', name: 'Ana', done: {}, parents: [{ email: 'pat@x.org', name: 'Pat Lee' }], student: '' },
    { actor: 'a3', name: 'Bo', done: { conflicts: true, sizes: true }, parents: [{ email: 'bo@x.org' }] }] };
const fr = C.formReminders(FR);
ok(!fr.some(r => r.to === 'bo@x.org'), 'form reminders: nobody whose forms are all turned in');
const p12 = fr.find(r => r.to === 'pat@x.org' && r.on === '2027-08-12');
ok(p12 && /Sam: Show-week conflicts/.test(p12.text) && /Ana: Show-week conflicts/.test(p12.text) && !/Clothing sizes/.test(p12.text), 'brothers and sisters in one email; only forms still To do');
ok(/https:\/\/asl\.cool\/theatre\/#\/family\/open\/a1\/family\/conflicts/.test(p12.text) && /Stop these emails: \{UNSUB\}/.test(p12.text), 'a link that opens that child’s form, and a way to stop');
ok(fr.filter(r => r.to === 'pat@x.org' && /Show-week conflicts/.test(r.text)).map(r => r.on).join() === '2027-08-12,2027-08-17,2027-08-18,2027-08-20', '7, 2, 1 days before and the day after');
ok(/past due/.test(fr.find(r => r.to === 'pat@x.org' && r.on === '2027-08-20').subject), 'the day after: "past due"');
const st = fr.find(r => r.to === 'sam@school.org');
ok(st && /remind your parent or guardian/.test(st.text) && !/family\/open/.test(st.text), 'the Company member is asked to remind a parent (no form link they cannot open)');
ok(!fr.some(r => /Email updates/.test(r.text)) && fr.every(r => r.on > '2027-08-10' && r.on <= '2027-09-14'), 'no reminder for a form without a label; only the coming weeks');
ok(C.formReminders(Object.assign({}, FR, { today: '2027-08-21' })).filter(r => /Show-week conflicts/.test(r.text)).length === 0, 'nothing more once the day after has passed');
// the unsubscribe code: browser HMAC (hex) == the script's computeHmacSha256Signature turned to hex (signed bytes)
const gs = fs.readFileSync(path.join(__dirname, '../mail-script/Code.gs'), 'utf8'), hex_ = eval('(' + gs.match(/function hex_\(bytes\) \{[\s\S]*?\n/)[0].replace(/^function hex_/, 'function') + ')');
const signed = [...crypto.createHmac('sha256', 'k1').update('pat@home.com').digest()].map(b => b > 127 ? b - 256 : b);
ok(hex_(signed) === crypto.createHmac('sha256', 'k1').update('pat@home.com').digest('hex'), 'the script’s unsubscribe code matches the app’s');
process.exit(bad ? 1 : 0);
