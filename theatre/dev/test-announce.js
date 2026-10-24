/* node theatre/dev/test-announce.js — announcements (js/announce.js): who sees each one, newest first, and which are new (pop up once) */
const A = require('../js/announce.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const news = [{ id: 'old', at: '2027-08-01', title: 'Old family news' }, { id: 'b', at: '2027-09-10', title: 'Both', to: 'both' },
  { id: 's', at: '2027-09-12', title: 'Students', to: 'students' }, { id: 'p', at: '2027-09-11', title: 'Parents', to: 'parents' }];
ok(A.visible(news, 'student').map(n => n.id).join() === 's,b', 'Company members see theirs and everyone’s, newest first');
ok(A.visible(news, 'parent').map(n => n.id).join() === 'p,b,old', 'parents see theirs, everyone’s, and the news posted before announcements');
ok(A.unseen(news, 'student', [], '2027-09-13').map(n => n.id).join() === 's,b', 'new ones pop up');
ok(A.unseen(news, 'student', ['s', 'b'], '2027-09-13').length === 0, 'once seen, never again');
ok(A.unseen(news, 'parent', [], '2027-09-13').map(n => n.id).join() === 'p,b', 'on a new device only the last ' + A.DAYS + ' days pop up (the Notifications page keeps the rest)');
ok(A.unseen(news, 'parent', ['p'], '2027-09-13').map(n => n.id).join() === 'b', 'a new one after others were seen');
process.exit(bad ? 1 : 0);
