/* node theatre/dev/test-line-check.js  — sample lines are made up, not from any script */
const C = require('../js/line-check.js');
const cases = [
  ["I can't believe you signed us up for the science competition!", 'i cannot believe you signed us up for the science competition', 'pass'],
  ["We have practice after school, so don't be late.", 'practice is after school dont be late', 'pass'],
  ["We have practice after school, so don't be late.", 'we have practice after school so be late', 'close'],
  ['Gabriella, wait up!', 'gabriela wait up', 'pass'],
  ['Kelsi wrote the whole musical herself.', 'kelsey wrote the musical by herself', 'pass'],
  ["(to Chad) The game starts at seven o'clock tonight.", 'the game is at 7 tonight', 'pass'],
  ['My mom moved us here for her job.', 'my mother moved here because of her job', 'pass'],
  ["I can't believe you signed us up for the science competition!", 'i believe we should go to lunch', 'miss'],
  ['The game starts at seven tonight.', '', 'silent']
];
let bad = 0;
for (const [t, h, want] of cases) { const r = C.check(t, h); const ok = r.verdict === want; if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', r.verdict, r.score, '|', h); }
process.exit(bad ? 1 : 0);
