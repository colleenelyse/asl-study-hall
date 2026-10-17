/* ASL Fingerspelling Practice: the games.
   Screens have their own addresses (#/, #/games, #/setup/<game>, #/play (the setup screen with the game under its settings), #/results, #/review, #/report, #/progress, #/chart, #/class, #/bingo).
   Progress is kept in this browser only (localStorage); nothing is sent anywhere except what the student chooses to email. */
(function () {
'use strict';
try{if(localStorage.getItem('aslNoShop'))document.documentElement.classList.add('noshop')}catch(e){}      // a password without Show the shop (asl.cool) keeps the shop hidden here

/* inside the ASL Study app (?embed=aslstudy), the word lists come from the teacher's sheet (ASL Study 3.81, Colleen): the app sends them
   ('fsp-words'), they are kept for this browser tab (sessionStorage), and every later load starts from them. Each list is used only when it
   looks right (a non-empty set of non-empty word lists); otherwise the built-in words (words.js, themes.js) stay. */
const SOLO = /[?&]solo=bingo\b/.test(location.search);
const EMBED = /[?&]embed=aslstudy\b/.test(location.search) && window.parent !== window;
const goodLists = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0 &&
  Object.keys(o).every(k => Array.isArray(o[k]) && o[k].length > 0 && o[k].every(w => typeof w === 'string' && w.trim() !== ''));
/* 3.96: the sheet's Silent Letters Words ([[word, level 1-4, meaning, note]]) and Look-Alike Words ({ 'M N S T': [[2 to 4 words]] }) tabs */
const goodTricky = a => Array.isArray(a) && a.length > 0 && a.every(x => Array.isArray(x) && typeof x[0] === 'string' && x[0].trim() !== '' && [1, 2, 3, 4].indexOf(+x[1]) >= 0);
const goodLook = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0 &&
  Object.keys(o).every(k => /^[A-Z]( [A-Z])+$/.test(k) && Array.isArray(o[k]) && o[k].every(set => Array.isArray(set) && set.length >= 2 && set.length <= 4 && set.every(w => typeof w === 'string' && w.trim() !== '')));
const goodDefs = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(k => typeof o[k] === 'string' && o[k].length <= 300);
const SHEET_KEY = 'fsp.sheetWords';
let sheetStart = '';      // the sheet lists this page was built from ('' = the built-in words)
if (EMBED) try {
  const raw = sessionStorage.getItem(SHEET_KEY), got = raw ? JSON.parse(raw) : null;
  if (got && (goodLists(got.proper) || goodLists(got.everyday) || goodTricky(got.tricky) || goodLook(got.look))) {
    if (goodLists(got.proper)) window.FS_WORDS = got.proper;
    if (goodLists(got.everyday)) window.FAMILIAR = got.everyday;
    if (goodTricky(got.tricky)) window.TRICKY = got.tricky.map(x => [String(x[0]), +x[1], String(x[2] || ''), String(x[3] || '')]);
    if (goodLook(got.look)) window.LOOK_GROUPS = Object.fromEntries(Object.entries(got.look).map(([k, sets]) => [k, { letters: k.replace(/ /g, ''), sets }]));
    if (goodDefs(got.defs)) window.FS_DEFS = Object.assign({}, window.FS_DEFS || {}, got.defs);      /* the teacher's own word descriptions (sheet Description column) */
    sheetStart = raw;
  }
} catch (e) {}

/* switches for later: ads (never during a word) and Google Analytics. Both off until the site is ready for them. */
const CFG = { ads: false, ga: '', only: 'numbers' };      /* TpT edition: one product's games only, never ads, never visitor counting */
/* one edition only (the TpT products, Colleen: fingerspelling and numbers sold separately or as a bundle): CFG.only or ?only=letters / ?only=numbers.
   The other edition's games, pages and menu links are hidden and their addresses go to #/games. */
const ONLY = CFG.only === 'both' ? '' : CFG.only || ((location.search.match(/[?&]only=(letters|numbers|both)\b/) || [])[1] || '').replace('both', '') || ((location.search.match(/[?&]only=both\b/) || EMBED) ? '' : 'letters');      /* Colleen: the fingerspelling link shows only fingerspelling, the numbers link only numbers; inside ASL Study (or ?only=both) both */
const NUM_PAGES = ['shownum', 'build', 'signnum', 'timeline', 'agepics', 'eventyear', 'math'], LETTER_PAGES = ['show', 'chart', 'class', 'bingo', 'letter', 'card'];
const offPage = (name, sub) => ONLY === 'letters' ? NUM_PAGES.indexOf(name) >= 0 || (name === 'setup' && /^(numbers|npick|nquiz|yread|ypick|aread|apick)$/.test(sub || '')) || (name === 'report' && sub === 'numbers') :
  ONLY === 'numbers' ? LETTER_PAGES.indexOf(name) >= 0 || (name === 'setup' && !/^(numbers|npick|nquiz|yread|ypick|aread|apick)$/.test(sub || '')) || (name === 'report' && sub === 'now') : false;

const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem('fsp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fsp.' + k, JSON.stringify(v)); } catch (e) {} }
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const letters = w => String(w).toUpperCase().replace(/[^A-Z]/g, '');
const lettersCount = w => letters(w).length;
const SPEEDS = ['Beginner', 'Intermediate', 'Advanced', 'Deaf'];
const speedName = k => SPEEDS[Math.round(k * 3)];
const perLetter = k => 1000 * Math.pow(125 / 1000, k);      // ms a letter, as the hand uses it (hand.js SPEED_SLOW / SPEED_FAST)
const lps = k => Math.round(1000 / perLetter(k) * 10) / 10;      // letters a second
const LIMITS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 0];      // 0 = No limit
const LEN_GROUPS = [[3, 4], [5, 6], [7, 8], [9, 11], [12, 15], [16, 99]];
const lenGroup = n => { const g = LEN_GROUPS.find(g => n >= g[0] && n <= g[1]) || LEN_GROUPS[0]; return g[1] === 99 ? g[0] + '+' : g[0] + '–' + g[1]; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick1 = a => a[Math.floor(Math.random() * a.length)];
const nice = c => c.charAt(0) + c.slice(1).toLowerCase();
const niceCat = c => c === c.toUpperCase() ? nice(c) : c;      // FOOD -> Food; Fruits & Vegetables stays as it is
const track = (name, params) => { if (CFG.ga && window.gtag) window.gtag('event', name, params || {}); };
const statBox = (v, lab) => '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(lab) + '</span></div>';

/* ---------- the games ---------- */
const GAMES = {      /* basics first, extras later (Colleen): letters, look-alike letters, simple words, then whole words, then the challenges */
  flash: { name: 'Letter Flash', icon: '⚡', about: 'One letter at a time. Type each letter you see. A quick warm-up.', tag: 'Start here' },
  pairs: { name: 'Look-Alike Letters', icon: '👀', about: 'M or N? A, S, T or E? Learn to tell apart the letters that look alike.' },
  sound: { name: 'Sound It Out', icon: '🔤', about: 'Short, simple words where every letter keeps its sound, so you can "hear" the letters. A great first word game.' },
  numbers: { section: 'numbers', name: 'Read the Number', icon: '🔢', about: 'The hand signs a number. Type it. Choose 0–20, the 20s, tens, multiples of 11 like 22 and 77, rocking numbers like 67 and 98, and every other two-digit number. People sign 16–19 in a variety of ways; practice them mixed or one way at a time.' },
  npick: { section: 'numbers', name: 'Pick the Number', icon: '👆', about: 'The hand signs a number. Pick it from four. Choose 0–20, the 20s, tens, multiples of 11 like 22 and 77, rocking numbers like 67 and 98, and every other two-digit number. People sign 16–19 in a variety of ways; practice them mixed or one way at a time.' },      /* Colleen: typing and picking are two games */
  nquiz: { section: 'numbers', name: 'Numbers Quiz', icon: '🎯', about: 'The hand signs a bigger number, with hundreds, thousands and millions. Choose the range, then type the number or pick it.' },
  yread: { section: 'years', name: 'Read the Year', icon: '📅', about: 'The hand signs a year. Type it. Choose teen years like 1776, 2000–2009, or 2010–2099.' },      /* years (Colleen, 2026-10-15) */
  ypick: { section: 'years', name: 'Pick the Year', icon: '🗓️', about: 'The hand signs a year. Pick it from four years that look alike when signed, like 1969 and 1996.' },
  aread: { section: 'ages', name: 'Read the Age', icon: '🎂', about: 'The hand signs an age, starting at the chin. Type it. Choose ages 1–9, 10–19, or 20–99.' },      /* ages (Colleen, 2026-10-15) */
  apick: { section: 'ages', name: 'Pick the Age', icon: '🧁', about: 'The hand signs an age, starting at the chin. Pick it from four ages that look alike when signed.' },
  pick: { name: 'Pick the Word', icon: '👆', about: 'Watch the word, then pick it from four that look alike. Great for beginners.' },
  type: { name: 'Read the Word', icon: '⌨️', about: 'The hand spells a word. Type what you saw.' },
  fill: { name: 'Fill in the Blanks', icon: '🌫️', about: 'Catch the first and last letters! A few letters in the middle are blurred. Put the word together.' },
  ladder: { name: 'Speed Ladder', icon: '🪜', about: 'Every right answer speeds the hand up; a miss slows it down. With hearts on, the game ends when you run out of hearts. How fast can you read?' },
  tricky: { name: 'Silent Letters & Strange Spellings', icon: '🤯', about: 'The opposite of Sound it out: words with ridiculous spellings, like pterodactyl. Four levels, from A Little Sneaky to English Has Lost Its Mind.' }
};
const CHOICE_GAMES = ['pick', 'pairs'];
const isNumGame = g => g === 'numbers' || g === 'npick' || g === 'nquiz' || g === 'yread' || g === 'ypick' || g === 'aread' || g === 'apick';
const isYear = g => g === 'yread' || g === 'ypick';
const isAge = g => g === 'aread' || g === 'apick';      // Read the Age and Pick the Age (signed with hand.signAge, the face behind the hand)      // Read the Year and Pick the Year (signed with hand.signYear)      // the number games: answers are numbers
const isNums = g => g === 'numbers' || g === 'npick';      // Read the Number (typed) and Pick the Number (picked): the same numbers and settings
const isChoice = g => CHOICE_GAMES.indexOf(g) >= 0 || g === 'npick' || g === 'ypick' || g === 'apick' || (g === 'nquiz' && S.nkind === 'pick');      // Numbers: typed or picked, the student's choice
const NUM_GROUPS = [      /* the numbers the hand can sign, in groups for the setup screen (Colleen: 22-99 and the rocking numbers added 2026-10-13) */
  ['0–20', Array.from({ length: 21 }, (_, i) => String(i))],
  ['The 20s', ['21', '22', '23', '24', '25', '26', '27', '28', '29']],
  ['Tens', ['30', '40', '50', '60', '70', '80', '90']],
  ['Multiples of 11', ['22', '33', '44', '55', '66', '77', '88', '99']],
  ['Rocking numbers', ['67', '68', '69', '76', '78', '79', '86', '87', '89', '96', '97', '98']],
  ['Other two-digit numbers', (() => { const o = []; for (let a = 3; a <= 9; a++) for (let b = 1; b <= 9; b++) { const n = a * 10 + b; if (a !== b && !(a >= 6 && b >= 6)) o.push(String(n)); } return o; })()]      /* 31-99 that are not doubles, rocking numbers or tens */
];
const NUMS = Array.from(new Set(NUM_GROUPS.flatMap(g => g[1])));      // 22 is in both The 20s and Multiples of 11
/* how a set of numbers is named on results and reports: whole groups by name, the rest one by one */
const numsLabel = list => { const left = new Set(list), parts = []; NUM_GROUPS.forEach(([name, g]) => { if (g.every(x => left.has(x))) { parts.push(name); g.forEach(x => left.delete(x)); } }); return parts.concat(NUMS.filter(x => left.has(x))).join(', '); };
const isNum = w => /^\d+$/.test(String(w));
const numKey = s => { const d = String(s).replace(/\D/g, ''); return d ? String(parseInt(d, 10)) : ''; };
const answerKey = (s, num) => num ? numKey(s) : letters(s);
/* Numbers quiz (Colleen): any number in a range, signed with all of her number rules (spoken order, HUNDRED, THOUSAND, MILLION) */
const Q_RANGES = [[0, 99], [0, 999], [0, 9999], [0, 99999], [0, 999999], [0, 999999999]];      /* Colleen: ranges end in 9s, so 0–999 never needs the THOUSAND hand */
const qRange = () => S.qrange === 'custom' ? [Math.max(0, Math.floor(+S.qmin || 0)), Math.min(999999999, Math.floor(+S.qmax || 0))] : (Q_RANGES[+S.qrange] || Q_RANGES[1]);
const nfmt = n => Number(n).toLocaleString('en-US');
const showW = w => /^\d{4,}$/.test(String(w)) && !(typeof R !== 'undefined' && R && isYear(R.game)) ? nfmt(w) : w;      // big numbers show with commas (1,464); years never do (1776)      // big numbers show with commas (1,464)
function quizItem(list) {
  const [lo, hi] = qRange(); let x, tries = 0;
  do { x = lo + Math.floor(Math.random() * (hi - lo + 1)); } while (tries++ < 20 && list.some(it => +it.w === x));      // no repeats in a round when there is room
  return { w: String(x), n: 1, teens: teensFor(), form: formFor() };
}
/* YEARS (Colleen, 2026-10-15): three kinds, as she signs them (hand.js yearParts). A round picks years of the kinds chosen. */
const YTYPES = [['teen', 'Teen years (1000–1999)', 1000, 1999], ['200x', '2000–2009', 2000, 2009], ['20xx', '2010–2099', 2010, 2099]];
function yearItem(list) {
  const kinds = YTYPES.filter(t => (S.ytypes || []).indexOf(t[0]) >= 0), use = kinds.length ? kinds : [YTYPES[0]]; let x, tries = 0;
  do { const T = pick1(use); x = T[2] + Math.floor(Math.random() * (T[3] - T[2] + 1)); } while (tries++ < 20 && list.some(it => +it.w === x));
  return { w: String(x), n: 1, form: 'year' };
}
/* Pick the Year: three wrong years that look alike when signed: the last two digits swapped (1969 / 1996), the same ending a century off
   (1865 / 1965), one digit off, ten years off */
function yearChoices(w) {
  const n = +w, out = new Set(), ok = x => x !== n && x >= 1000 && x <= 2099, a = Math.floor(n / 100), b = n % 100, tries = [];
  if (b >= 10 && b % 11) tries.push(a * 100 + (b % 10) * 10 + Math.floor(b / 10));
  tries.push(n + 100, n - 100, n + 10, n - 10, n + 1, n - 1);
  if (n >= 2001 && n <= 2009) tries.unshift(2000 + (n % 10) * 10, 1900 + n % 100);      // 2005 looks like 2050 (TWENTY FIFTY) and 1905
  tries.forEach((x, k) => { if (out.size < 3 && ok(x) && (k < 2 || Math.random() < 0.8)) out.add(x); });
  while (out.size < 3) { const x = n + Math.round((Math.random() - 0.5) * 60); if (ok(x)) out.add(x); }
  return shuffle([n].concat(Array.from(out))).map(String);
}
/* AGES (Colleen): ages 1-99 in three groups; a round picks ages from the groups chosen */
const ATYPES = [['1-9', 'Ages 1–9', 1, 9], ['10-19', 'Ages 10–19', 10, 19], ['20-99', 'Ages 20–99', 20, 99]];
function ageItem(list) {
  const kinds = ATYPES.filter(t => (S.atypes || []).indexOf(t[0]) >= 0), use = kinds.length ? kinds : ATYPES; let x, tries = 0;
  do { const T = pick1(use); x = T[2] + Math.floor(Math.random() * (T[3] - T[2] + 1)); } while (tries++ < 20 && list.length && +list[list.length - 1].w === x);
  return { w: String(x), n: 1, form: 'age', teens: teensFor() };
}
/* Pick the Age: three wrong ages that look alike when signed (the digits swapped, one more or less, ten more or less, the same shape as a single digit) */
function ageChoices(w) {
  const n = +w, out = new Set(), ok = x => x !== n && x >= 1 && x <= 99, tries = [];
  if (n >= 10 && n % 10 && Math.floor(n / 10) !== n % 10) tries.push((n % 10) * 10 + Math.floor(n / 10));
  if (n >= 11 && n <= 19) tries.push(n - 10); if (n <= 9) tries.push(n + 10);
  tries.push(n + 1, n - 1, n + 10, n - 10);
  tries.forEach((x, k) => { if (out.size < 3 && ok(x) && (k < 2 || Math.random() < 0.8)) out.add(x); });
  while (out.size < 3) { const x = 1 + Math.floor(Math.random() * 99); if (ok(x)) out.add(x); }
  return shuffle([n].concat(Array.from(out))).map(String);
}
/* Numbers quiz, picking: three wrong numbers that look close when signed (one digit changed, two digits swapped, a place off) */
function bigChoices(w) {
  const n = +w, d = String(n).split(''), out = new Set(), [lo, hi] = qRange(), ok = x => x !== n && x >= lo && x <= hi;
  const tries = [];
  for (let i = 0; i < d.length; i++) for (const k of [1, -1]) { const e = d.slice(); e[i] = String((+e[i] + k + 10) % 10); if (i || e[0] !== '0') tries.push(+e.join('')); }
  for (let i = 0; i + 1 < d.length; i++) { const e = d.slice(); [e[i], e[i + 1]] = [e[i + 1], e[i]]; if (e[0] !== '0') tries.push(+e.join('')); }
  [10, 100, 1000].forEach(k => { tries.push(n + k, n - k); });
  shuffle(tries).forEach(x => { if (out.size < 3 && ok(x)) out.add(x); });
  while (out.size < 3) { const x = lo + Math.floor(Math.random() * (hi - lo + 1)); if (ok(x)) out.add(x); if (hi - lo < 4) break; }
  return shuffle([n].concat(Array.from(out))).map(String);
}
const TEENS_NAME = { mix: 'Mixed', ten: '10 + number', twist: 'Twist' };
const HUND_NAME = { mix: 'Mixed', c: 'C', curl: 'Curl' };
const FORM_NAME = { mix: 'Mixed', alt: 'Formal', main: 'Slang' };      // 23 and 25: formal (L to the number) or slang (the middle finger bends) (Colleen)
const formFor = () => S.nform === 'mix' ? pick1(['alt', 'main']) : S.nform;
const teensFor = () => S.nteens === 'mix' ? pick1(['ten', 'twist']) : S.nteens;      // Mixed: each 16-19 picks a way at random (Colleen)
/* Numbers: three wrong choices that look close when signed (same hand shape, the teen or the single number, the numbers next to it) */
function numChoices(w) {
  const n = +w, pool = R && R.settings && R.settings.nums && R.settings.nums.length >= 4 ? NUMS : NUMS;
  const digits = x => String(x).split('').sort().join(''), grp = x => (NUM_GROUPS.find(g => g[1].indexOf(String(x)) >= 0) || [''])[0];
  const score = x => { x = +x; let sc = 3 + Math.random();
    if (String(x).split('').reverse().join('') === String(n) && x !== n) sc -= 3;      // 67 and 76
    if (digits(x) === digits(n)) sc -= 1;
    if (String(x).split('').some(c => String(n).indexOf(c) >= 0)) sc -= 1;      // shares a digit (7, 17, 77)
    if (Math.abs(x - n) === 10 || Math.abs(x - n) <= 2) sc -= 1;
    if (grp(x) === grp(n)) sc -= 0.5;
    if (n >= 6 && n <= 9 && x >= 6 && x <= 9 || n >= 16 && n <= 19 && x >= 16 && x <= 19 || n >= 11 && n <= 15 && x >= 11 && x <= 15) sc -= 1.5;      // same hand shape family
    return sc; };
  const wrong = pool.filter(x => +x !== n).map(x => ({ x, s: score(x) })).sort((a, b) => a.s - b.s).slice(0, 5);
  return shuffle([String(n)].concat(shuffle(wrong).slice(0, 3).map(r => r.x)));      // three of the five closest, so the choices change
}
/* letters that look alike when fingerspelled (for wrong answers in Pick the word, and the Look-alike drills) */
const LOOK = { A: 'SET', S: 'ATE', T: 'ASN', E: 'ASO', M: 'NT', N: 'MT', O: 'CE', C: 'O', R: 'UV', U: 'RV', V: 'UK', K: 'PV', P: 'KQ', G: 'HQ', H: 'GU', Q: 'GP', I: 'JY', J: 'I', Y: 'I', D: 'F', F: 'D', X: 'T' };
const PAIRS = Object.keys(window.LOOK_GROUPS || {});      // letter groups for Look-alike letters (themes.js)

/* ---------- settings ---------- */
const CATS = Object.keys(window.FS_WORDS || {});
const S = Object.assign({ speed: 0, limit: 8, count: 10, mode: 'plain', cats: CATS.slice(), one: false, showCount: false, assist: 'off', tone: '3', paper: 'no',
  levels: ['1'], scount: 10, pairs: ['M N S T', 'A E O'], pairkind: 'words', flash: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), flcount: 20, game: 'type', banks: { type: 'everyday', pick: 'everyday', ladder: 'everyday', pairs: 'everyday', fill: 'everyday', sound: 'everyday' }, tlevels: ['1'], tcount: 10, nums: NUMS.slice(), ncount: 20, nteens: 'mix', nform: 'mix', nkind: 'type', nhund: 'mix', hearts: '3', qrange: '1', qmin: 0, qmax: 1000, qcount: 10, fcats: ['K–2 level vocab', 'Grades 3–5 level vocab', 'Fruits & Vegetables', 'Animals', 'School', 'Careers', 'Holidays'] }, store.get('settings', {}));
if (!Array.isArray(S.ytypes) || !S.ytypes.length) S.ytypes = ['teen', '200x', '20xx'];
if (!Array.isArray(S.atypes) || !S.atypes.length) S.atypes = ['1-9', '10-19', '20-99'];      // ages: all three groups to start      // years: all three kinds to start
S.cats = S.cats.filter(c => CATS.indexOf(c) >= 0); if (!S.cats.length) S.cats = CATS.slice();
S.nums = (S.nums || []).filter(x => NUMS.indexOf(x) >= 0);
S.pairs = (S.pairs || []).filter(p => window.LOOK_GROUPS && window.LOOK_GROUPS[p]); if (!S.pairs.length) S.pairs = ['M N S T', 'A E O'].filter(p => window.LOOK_GROUPS[p]); if (!S.pairs.length) S.pairs = Object.keys(window.LOOK_GROUPS || {}).slice(0, 2);      // the sheet's groups may differ (3.96)      // old letter pairs became letter groups
/* the grade lists are vocabulary for that level, not words about school (Colleen): saved choices under the old names carry over */
const FCAT_RENAMED = { 'K–2': 'K–2 level vocab', 'Grades 3–5': 'Grades 3–5 level vocab', 'Grades 6–8': 'Grades 6–8 level vocab', 'High School': 'High school level vocab' };
S.fcats = (S.fcats || []).map(c => FCAT_RENAMED[c] || c);
{ const fc = Object.keys(window.FAMILIAR || {}); S.fcats = S.fcats.filter(c => fc.indexOf(c) >= 0); if (!S.fcats.length) S.fcats = fc.slice(0, 2); }      // lists from the teacher's sheet may have other names (ASL Study 3.81)
if (!GAMES[S.game]) S.game = 'type';
if (!S.bankV2) { S.banks = { type: 'everyday', pick: 'everyday', ladder: 'everyday', pairs: 'everyday', fill: 'everyday', sound: 'everyday' }; S.bankV2 = 1; }      /* once: everyone starts on everyday words (Colleen); a later choice of names sticks */
const saveS = () => store.set('settings', S);
saveS();

/* ---------- the hand ---------- */
const stage = $('#stage');
const hand = window.FSHand.create($('#hand'), { onError: () => { $('#loading').textContent = 'The hand could not load. Check your internet connection and reload the page.'; } });
hand.ready.then(() => { $('#loading').remove(); });
const assist = $('#assist');
const toneHex = () => S.tone === 'random' ? hand.dealTone() : hand.TONES[+S.tone] || hand.TONES[3];
hand.ready.then(() => hand.setTone(S.tone === 'random' ? hand.TONES[3] : toneHex()));
/* activities WITHOUT a Skin Tone picker (Colleen): a random tone each time, every tone used equally often (the hand's shuffled deck: all 7, then a
   new shuffle). Activities with the picker follow it. NOPICK is set by the router (one tone per visit); Charlie, events, timeline and math keep their own tone (AP.tone, EY.tone, TL.tone, MT.tone). */
let NOPICK = false;
const nextTone = () => NOPICK ? hand.dealTone() : toneHex();
const newTone = () => { if (!NOPICK && S.tone === 'random') hand.setTone(toneHex()); };      /* the picker's Random: a new tone each word, as before; without a picker the tone is set once per visit or round (Colleen: never swap in the middle of a game) */
let TONE_PAGE = '';
let speedNow = () => S.speed;
let spelling = null, stopFlag = false;
/* spells one word; blur = a Set of letter positions (0-based) to hide behind frosted glass (Fill in the blanks) */
async function spellWord(w, blur, teens, form) {
  await hand.ready;
  stopFlag = true; while (spelling) await spelling;      // finish (stop) the word before
  stopFlag = false;
  newTone();      // Random: a new tone before each word, never during one
  assist.textContent = ''; stage.classList.remove('frosted');
  if (isNum(w)) {      // a number (0-20) is signed, not spelled; the answer is never shown while it signs
    const per = Math.round(1000 * Math.pow(0.35, Math.max(0, speedNow())));      // Beginner 1 s a beat ... Deaf 0.35 s (the numbers' moves need more time than a letter)
    const so = { per, teens: teens || teensFor(), form: form || formFor(), hund: S.nhund === 'mix' ? undefined : S.nhund, stop: () => stopFlag };
    spelling = form === 'age' && hand.signAge && +w >= 1 && +w <= 99 ? hand.signAge(+w, so) : form === 'year' && hand.signYear && +w >= 1000 && +w <= 2099 ? hand.signYear(+w, so) : +w < 100 ? hand.sign(+w, so) : hand.signParts(bdBlocksFor(+w), so);      // a year is signed as a year (hand.js YEARS)      // bigger numbers in spoken order: 12,345 = 12 + THOUSAND + 3 + HUNDRED + 45
    try { await spelling; } finally { spelling = null; }
    return;
  }
  let n = -1;
  spelling = hand.spell(w, { speed: () => speedNow(), stop: () => stopFlag, onLetter: t => {
    if (t) n += t === 'ZZ' ? 2 : 1;
    const hide = !!(blur && t && (blur.has(n) || (t === 'ZZ' && blur.has(n - 1))));
    stage.classList.toggle('frosted', hide);
    assist.textContent = hide ? '' : t === '§' ? "'S" : (t || '');
  } });
  try { await spelling; } finally { spelling = null; assist.textContent = ''; stage.classList.remove('frosted'); }
}
const putStage = slotId => { const slot = document.getElementById(slotId); if (slot && stage.parentNode !== slot) slot.appendChild(stage); };
const parkStage = () => { if (stage.parentNode !== document.body) document.body.appendChild(stage); };

/* ---------- word pools ---------- */
function poolWords(opts) {
  opts = opts || {};
  const out = [];
  S.cats.forEach(c => (window.FS_WORDS[c] || []).forEach(w => {
    const n = lettersCount(w); if (n < (opts.min || 2)) return;
    if (S.limit && n > S.limit) return;
    if ((S.one || opts.one) && /\s/.test(w.trim())) return;
    out.push({ w, c, n });
  }));
  return out;
}
function soundWords() {
  const out = [];
  const names = bankOf('sound') === 'proper';      // students always choose: everyday words or names (names start with a capital letter in the list)
  S.levels.forEach(l => (window.SOUND_WORDS[l] || []).forEach(w => { if ((w.charAt(0) !== w.charAt(0).toLowerCase()) === names) out.push({ w, c: 'LEVEL ' + l, n: lettersCount(w) }); }));
  return out;
}
/* two kinds of words (Colleen): everyday words, even ones that have a sign (FAMILIAR, from her word search lists), and names and other words people really fingerspell (FS_WORDS) */
const bankOf = g => (S.banks && S.banks[g]) || 'everyday';      // everyday words are the default in every game (Colleen, 2026-10-14)
function everydayWords(min) {
  const out = [], seen = new Set();
  S.fcats.forEach(c => (window.FAMILIAR[c] || []).forEach(w => { const n = lettersCount(w), k = letters(w); if (n < (min || 2) || (S.limit && n > S.limit) || seen.has(k)) return; seen.add(k); out.push({ w, c, n }); }));
  return out;
}
function poolFor(game) {
  if (game === 'sound') return soundWords();
  if (game === 'tricky') return (window.TRICKY || []).filter(x => S.tlevels.indexOf(String(x[1])) >= 0).map(x => ({ w: x[0], c: 'LEVEL ' + x[1], n: lettersCount(x[0]), def: x[2], note: x[3] }));
  const everyday = bankOf(game) === 'everyday';
  if (game === 'fill') return everyday ? everydayWords(4) : poolWords({ one: true, min: 4 });
  if (game === 'pick') return everyday ? everydayWords(3) : poolWords({ min: 3 });
  if (game === 'pairs') return (everyday ? everydayWords(3) : poolWords({ one: true, min: 3 })).filter(x => x.n <= 9);
  return everyday ? everydayWords(2) : poolWords();
}

/* ---------- setup screen ---------- */
function segInit(id, key, after) {
  const el = document.getElementById(id);
  const mark = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S[key]));
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; S[key] = b.dataset.v; saveS(); mark(); if (after) after(); };
  mark(); return mark;
}
function segInitObj(id, obj, key, after) {
  const el = document.getElementById(id);
  const mark = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === obj[key]));
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; obj[key] = b.dataset.v; mark(); if (after) after(); };
  mark(); return mark;
}
function chipsInit(el, items, arr, label, after) {
  const draw = () => { el.innerHTML = items.map(x => '<button data-k="' + esc(x) + '" class="' + (S[arr].indexOf(x) >= 0 ? 'on' : '') + '">' + label(x) + '</button>').join(''); if (after) after(); };
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k, i = S[arr].indexOf(k); if (i >= 0) S[arr].splice(i, 1); else S[arr].push(k); saveS(); draw(); };
  draw(); return draw;
}
function gamesInit() {
  const BLURB = {"flash": "A quick warm-up: the hand shows one letter, you type it.", "pairs": "M or N? Learn to tell apart the letters that look alike.", "sound": "Short words that sound the way they’re spelled. A great first word game.", "pick": "Watch a word, then pick it from four that look alike.", "type": "The hand spells a word. Type what you saw.", "fill": "The middle letters blur. Catch the first and last, then put the word together.", "ladder": "Every right answer speeds the hand up. How fast can you read?", "tricky": "Words with wild spellings, like pterodactyl. Four levels of sneaky.", "numbers": "The hand signs a number. Type it. You choose which groups.", "npick": "The hand signs a number. Pick it from four that look alike.", "nquiz": "Big numbers with HUNDRED, THOUSAND and MILLION. Type or pick.", "yread": "The hand signs a year. Type it.", "ypick": "The hand signs a year. Pick it from look-alikes like 1969 and 1996.", "aread": "The hand signs an age from the chin. Type it.", "apick": "The hand signs an age. Pick it from four that look alike."};      /* short card lines (Colleen: make the descriptions better); the full text stays on each setup screen */
  const card = k => { const g = Object.assign({}, GAMES[k], { about: BLURB[k] || GAMES[k].about }); return '<a class="gcard" href="#/setup/' + k + '"><span class="gi" aria-hidden="true">' + g.icon + '</span>' + (g.tag ? '<span class="tag">' + esc(g.tag) + '</span>' : '') + '<b>' + esc(g.name) + '</b><span>' + esc(g.about) + '</span></a>'; };
  $('#g-grid').innerHTML = Object.keys(GAMES).filter(k => !GAMES[k].section).map(card).join('');
  $('#g-showfs').innerHTML = '<a class="gcard" href="#/show"><span class="gi" aria-hidden="true">🖐️</span><b>Show Me How to Spell</b><span>Type any word or name. The hand spells it.</span></a>';
  $('#g-exprfs').innerHTML = '<a class="gcard" href="reader.html" id="camcard"><span class="gi" aria-hidden="true">📷</span><b>Fingerspell to the Camera</b><span>Sign letters and words to your camera. It reads your hand and helps you fix it.</span></a>';      /* expressive (Colleen) */
  const cc = $('#camcard'); if (cc) cc.onclick = openCamera;
  $('#g-exprnum').innerHTML = '<a class="gcard" data-cam data-camnum href="reader.html?kind=numbers" id="camnumcard"><span class="gi" aria-hidden="true">📷</span><b>Sign Numbers to the Camera</b><span>Sign numbers to your camera: 0 to 9, moving numbers, rocking numbers, hundreds. It reads your hand and helps you fix it.</span></a>';      /* expressive: the camera reads the student's hand (Colleen, 2026-10-17: the sign-it-then-check-yourself games are gone now that the camera can check) */
  const cn = $('#camnumcard'); if (cn) cn.onclick = openCamera;
  $('#g-showgrid').innerHTML =      /* the Show Me tools together, between Learn and the games (Colleen) */
    '<a class="gcard" href="#/shownum"><span class="gi" aria-hidden="true">🖐️</span><b>Show Me Numbers</b><span>Type any number, even 1,250,000. The hand signs it.</span></a>' +
    '<a class="gcard" href="#/shownum/year"><span class="gi" aria-hidden="true">🕰️</span><b>Show Me Years</b><span>Type any year from 1000 to 2099. The hand signs it as a year.</span></a>' +
    '<a class="gcard" href="#/shownum/age"><span class="gi" aria-hidden="true">🎈</span><b>Show Me Ages</b><span>Type any age from 1 to 99. The hand signs it from the chin.</span></a>';
  $('#g-numgrid').innerHTML = Object.keys(GAMES).filter(k => GAMES[k].section === 'numbers').map(card).join('') +      // numbers in their own section (Colleen)
    '<a class="gcard" href="#/build"><span class="gi" aria-hidden="true">🧱</span><b>Build a Number</b><span>Snap number signs together, like 3 + HUNDRED + 45, then watch.</span></a>';
  $('#g-yeargrid').innerHTML = Object.keys(GAMES).filter(k => GAMES[k].section === 'years').map(card).join('') +      // years in their own section (Colleen)
    '';
  $('#g-numgrid').innerHTML += '<a class="gcard" href="#/math"><span class="gi" aria-hidden="true">➗</span><b>Math in ASL</b><span>The hand signs a math problem. Write it, solve it, or build it.</span></a>';
  $('#g-agegrid').innerHTML = Object.keys(GAMES).filter(k => GAMES[k].section === 'ages').map(card).join('') +      // ages in their own section (Colleen)
    '<a class="gcard" href="#/agepics"><span class="gi" aria-hidden="true">🧑</span><b>How Old Is ' + ((window.CHARLIE && window.CHARLIE.NAME) || 'Charlie') + '?</b><span>Look at ' + ((window.CHARLIE && window.CHARLIE.NAME) || 'Charlie') + ', watch four hands sign ages, and pick the one that fits.</span></a>';
  $('#g-yeargrid').innerHTML += '<a class="gcard" href="#/eventyear"><span class="gi" aria-hidden="true">📅</span><b>When Did It Happen?</b><span>See a historic event. Watch four hands sign years and pick the right one.</span></a>';
  $('#g-yeargrid').innerHTML += '<a class="gcard" href="#/timeline"><span class="gi" aria-hidden="true">🧭</span><b>Timeline</b><span>Put five signed years in order, then match each event to its year.</span></a>';
}
let drawCats, drawPool;
/* spacing rule for the activity cards (Colleen): one line if they all fit; otherwise the fewest even rows, centered (6 = 3 + 3, 5 = 3 + 2) */
function layoutGrids() { $$('.gamegrid').forEach(g => { const n = g.children.length; g.style.maxWidth = ''; const W = g.clientWidth; if (!n || !W) return; const MIN = W < 500 ? 140 : 180, GAP = 14, fit = Math.max(1, Math.floor((W + GAP) / (MIN + GAP))), rows = Math.ceil(n / fit); const per = Math.ceil(n / rows); g.style.setProperty('--per', per); g.style.maxWidth = (per * 250 + (per - 1) * GAP) + 'px'; }); }      /* the row is only as wide as its cards, so 6 = 3 + 3, never 4 + 2 */
if (window.ResizeObserver) { const ro = new ResizeObserver(() => layoutGrids()); setTimeout(() => $$('.gamegrid').forEach(g => ro.observe(g)), 0); } else window.addEventListener('resize', layoutGrids);
function setupInit() {
  $('#s-limit').innerHTML = LIMITS.map(n => '<option value="' + n + '">' + (n ? n + ' letters or fewer' : 'No limit') + '</option>').join('');
  $('#s-limit').value = String(S.limit); $('#s-count').value = String(S.count); $('#s-scount').value = String(S.scount); $('#s-flcount').value = String(S.flcount);
  $('#s-speed').value = Math.round(S.speed * 100);
  $('#s-one').checked = S.one;
  const counts = {}; CATS.forEach(c => counts[c] = (window.FS_WORDS[c] || []).length);
  drawPool = () => {
    const g = S.game; let n, msg;
    if (g === 'flash') { n = S.flash.length; msg = n ? n + ' letters chosen.' : 'Choose at least one letter.'; }
    else if (isNums(g)) { n = S.nums.length; msg = n ? n + ' numbers chosen.' : 'Choose at least one number.'; }
    else if (isYear(g)) { n = (S.ytypes || []).length; msg = n ? '' : 'Choose at least one kind of year.'; }
    else if (isAge(g)) { n = (S.atypes || []).length; msg = n ? '' : 'Choose at least one group of ages.'; }
    else if (g === 'nquiz') { const [lo, hi] = qRange(); n = hi >= lo ? 1 : 0; msg = n ? 'Numbers from ' + lo.toLocaleString('en-US') + ' to ' + hi.toLocaleString('en-US') + '.' : 'The highest number must be at least the lowest.'; }
    else if (g === 'pairs') { n = S.pairs.length; msg = n ? '' : 'Choose at least one pair.'; }
    else { n = poolFor(g).length; msg = n ? n + ' words match your choices.' : (g === 'sound' || g === 'tricky' ? 'Choose at least one level.' : g === 'fill' || bankOf(g) === 'everyday' ? 'No words match. Choose more word lists or a higher letter limit.' : 'No words match. Choose more categories or a higher letter limit.'); }
    $('#s-pool').textContent = msg; $('#s-go').disabled = !n;
    if (R && R.game === g && location.hash === '#/play') refreshRound();      // changed while playing: the next words follow the new settings
  };
  drawCats = chipsInit($('#s-cats'), CATS, 'cats', c => nice(c) + ' <small>' + counts[c] + '</small>', () => drawPool());
  $('#s-all').onclick = () => { S.cats = CATS.slice(); saveS(); drawCats(); };
  $('#s-none').onclick = () => { S.cats = []; saveS(); drawCats(); };
  const fc = Object.keys(window.FAMILIAR || {}); S.fcats = (S.fcats || []).filter(c => fc.indexOf(c) >= 0); if (!S.fcats.length) S.fcats = fc.slice(0, 2);
  const drawFc = chipsInit($('#s-fcats'), fc, 'fcats', c => esc(c) + ' <small>' + window.FAMILIAR[c].length + '</small>', () => drawPool());
  const drawPr = chipsInit($('#s-pairs'), PAIRS, 'pairs', p => p.split(' ').join(' · '), () => drawPool());
  chipsInit($('#s-ytypes'), YTYPES.map(t => t[0]), 'ytypes', k => esc(YTYPES.find(t => t[0] === k)[1]), () => drawPool());
  chipsInit($('#s-atypes'), ATYPES.map(t => t[0]), 'atypes', k => esc(ATYPES.find(t => t[0] === k)[1]), () => drawPool());
  const drawFl = chipsInit($('#s-flash'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), 'flash', x => x, () => drawPool());
  $('#s-fl-all').onclick = () => { S.flash = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); saveS(); drawFl(); };
  $('#s-fl-none').onclick = () => { S.flash = []; saveS(); drawFl(); };
  const nb = $('#s-nums');      /* one row of number chips for each group, each with its own Choose all */
  nb.innerHTML = NUM_GROUPS.map(([name], i) => '<p class="nmg"><b>' + esc(name) + '</b> <button class="link" data-g="' + i + '">Choose all</button><button class="link" data-g="' + i + '" data-off="1">Choose none</button></p><div class="chips letters" data-chips="' + i + '"></div>').join('');
  const drawNms = NUM_GROUPS.map(([, g], i) => chipsInit(nb.querySelector('[data-chips="' + i + '"]'), g, 'nums', x => x, () => drawPool()));
  const drawNm = () => drawNms.forEach(f => f());
  nb.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; const g = NUM_GROUPS[+b.dataset.g][1]; if (b.dataset.off) S.nums = S.nums.filter(x => g.indexOf(x) < 0); else g.forEach(x => { if (S.nums.indexOf(x) < 0) S.nums.push(x); }); saveS(); drawNm(); drawPool(); });      // each group: Choose all / Choose none (Colleen)
  $('#s-nm-all').onclick = () => { S.nums = NUMS.slice(); saveS(); drawNm(); };
  $('#s-nm-none').onclick = () => { S.nums = []; saveS(); drawNm(); };
  $('#s-ncount').value = String(S.ncount); $('#s-ncount').onchange = e => { S.ncount = +e.target.value || 20; saveS(); drawPool(); };
  segInit('s-nhund', 'nhund', () => drawPool());
  segInit('s-hearts', 'hearts');
  const qc = () => { $('#s-qcustom').hidden = S.qrange !== 'custom'; hand.helper(S.game === 'nquiz' && qRange()[1] >= 1000); };
  segInit('s-qrange', 'qrange', () => { if (S.qrange === 'custom' && !(+S.qmax > 0)) { S.qmin = 0; S.qmax = 999; } $('#s-qmin').value = S.qmin; $('#s-qmax').value = S.qmax; saveS(); qc(); drawPool(); }); qc();
  $('#s-qmin').value = S.qmin; $('#s-qmax').value = S.qmax;
  $('#s-qmin').oninput = e => { S.qmin = Math.max(0, Math.floor(+e.target.value || 0)); saveS(); drawPool(); };
  $('#s-qmax').oninput = e => { S.qmax = Math.min(999999999, Math.floor(+e.target.value || 0)); saveS(); qc(); drawPool(); };
  $('#s-qcount').value = String(S.qcount); $('#s-qcount').onchange = e => { S.qcount = +e.target.value || 10; saveS(); drawPool(); };
  segInit('s-nteens', 'nteens', () => drawPool()); segInit('s-nform', 'nform', () => drawPool()); segInit('s-nkind', 'nkind', () => drawPool());
  const tl = $('#s-tlevels');      // Silent Letters & Strange Spellings levels, by name
  tl.innerHTML = Object.keys(window.TRICKY_LEVELS || {}).map(k => '<button data-l="' + k + '">' + k + '. ' + esc(window.TRICKY_LEVELS[k]) + '</button>').join('');
  const markTL = () => tl.querySelectorAll('button').forEach(b => b.classList.toggle('on', S.tlevels.indexOf(b.dataset.l) >= 0));
  tl.onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = S.tlevels.indexOf(b.dataset.l); if (i >= 0) S.tlevels.splice(i, 1); else S.tlevels.push(b.dataset.l); saveS(); markTL(); drawPool(); }; markTL();
  const markAll = { levels: () => markL(), tlevels: markTL, pairs: () => drawPr(), fcats: () => drawFc() }, every = { levels: ['1', '2', '3'], tlevels: Object.keys(window.TRICKY_LEVELS || {}), pairs: PAIRS, fcats: fc };
  $$('[data-allnone]').forEach(b => b.onclick = () => { const k = b.dataset.allnone; S[k] = b.dataset.v === 'all' ? every[k].slice() : []; saveS(); markAll[k](); drawPool(); });      // Choose all / Choose none on every pick list (Colleen)
  $('#s-tcount').value = String(S.tcount); $('#s-tcount').onchange = e => { S.tcount = +e.target.value || 10; saveS(); drawPool(); };
  const lv = $('#s-levels'), markL = () => lv.querySelectorAll('button').forEach(b => b.classList.toggle('on', S.levels.indexOf(b.dataset.l) >= 0));
  lv.onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = S.levels.indexOf(b.dataset.l); if (i >= 0) S.levels.splice(i, 1); else S.levels.push(b.dataset.l); saveS(); markL(); drawPool(); }; markL();
  $('#s-limit').onchange = e => { S.limit = +e.target.value; saveS(); drawPool(); };
  $('#s-count').onchange = e => { S.count = +e.target.value || 10; saveS(); drawPool(); };
  $('#s-scount').onchange = e => { S.scount = +e.target.value || 10; saveS(); drawPool(); };
  $('#s-flcount').onchange = e => { S.flcount = +e.target.value || 20; saveS(); drawPool(); };
  $('#s-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); $('#p-speed').value = e.target.value; };
  $('#p-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); $('#s-speed').value = e.target.value; };      // the speed by the question (Colleen) and the setup slider stay together
  $('#s-one').onchange = e => { S.one = e.target.checked; saveS(); drawPool(); };
  S.countSeg = S.showCount ? 'on' : 'off'; segInit('s-countseg', 'countSeg', () => { S.showCount = S.countSeg === 'on'; saveS(); drawPool(); });      // letter count: a switch you can see (Colleen)
  $('#s-bank').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.banks = S.banks || {}; S.banks[S.game] = b.dataset.v; saveS(); setupShow(); };
  const fold = () => { $('#s-fields').hidden = !!S.fold; $('#s-fold').textContent = S.fold ? 'Show settings ▼' : 'Hide settings ▲'; $('#s-fold').setAttribute('aria-expanded', String(!S.fold)); };
  $('#s-fold').onclick = () => { S.fold = !S.fold; saveS(); fold(); }; fold();
  segInit('s-mode', 'mode'); segInit('s-assist', 'assist', () => drawPool()); segInit('s-paper', 'paper'); segInit('s-pairkind', 'pairkind');
  const tones = $('#s-tones');
  tones.innerHTML = hand.TONES.map((t, i) => '<button class="sw" data-t="' + i + '" aria-label="Skin tone ' + (i + 1) + '" style="background:#' + t.toString(16).padStart(6, '0') + '"></button>').join('') + '<button class="rnd" data-t="random">Random</button>';
  const markT = () => tones.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tone));
  tones.onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tone = b.dataset.t; saveS(); markT(); if (S.tone !== 'random') hand.ready.then(() => hand.setTone(toneHex())); };
  markT();
  $('#s-go').onclick = () => startRound(null);
}
function setupShow(game) {
  if (game && GAMES[game]) { S.game = game; saveS(); }
  const g = S.game;
  $('#s-title').textContent = GAMES[g].name; $('#s-about').textContent = GAMES[g].about;
  $('#s-ncount-lab').textContent = isYear(g) ? 'Years in a Round' : isAge(g) ? 'Ages in a Round' : 'Numbers in a Round';
  ageFace(isAge(g));      /* the face behind the hand for the age games (Colleen) */
  $('#s-speed-lab').textContent = g === 'ladder' ? 'Starting speed' : g === 'fill' ? 'Speed (this game plays a little slower than the speed you pick)' : 'Speed';
  const playing = !!(R && R.game === g && location.hash === '#/play');
  $('#game-area').hidden = !playing; $('#s-live').hidden = !playing; $('#s-go').textContent = playing ? 'Start over with these settings' : 'Start';
  $$('[data-screen=setup] [data-for]').forEach(el => { el.hidden = el.dataset.for.split(' ').indexOf(g) < 0 || (el.dataset.bank && el.dataset.bank !== bankOf(g)); });
  const b = $('#s-bank'); b.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === bankOf(g)));
  $('#s-bank-hint').textContent = g === 'sound' ? (bankOf(g) === 'everyday' ? 'Everyday words like sat, stop and sunset.' : 'Simple names like Pam, Brad and Benson.') : bankOf(g) === 'everyday' ? 'Regular words like apple, library and friend, even ones that have a sign.' : 'Names, brands, cities, movies and more: the words people really fingerspell.';
  $('#s-qcustom').hidden = S.qrange !== 'custom';
  hand.helper(g === 'nquiz' && qRange()[1] >= 1000);      /* the left hand waits in its corner when a quiz number may need THOUSAND or MILLION */
  drawPool();
}

/* ---------- making each question ---------- */
function swapAt(w, i, L) { const ch = w.charAt(i); return w.slice(0, i) + (ch === ch.toLowerCase() ? L.toLowerCase() : L) + w.slice(i + 1); }
/* three wrong answers for Pick the word: always REAL words (Colleen), the ones from the word lists that look most like the answer when fingerspelled:
   same length, same letters in the same places, and look-alike letters (M/N, A/S/T/E, R/U...) count as close */
function lookScore(a, b) {
  const A = letters(a), B = letters(b);
  let sc = Math.abs(A.length - B.length) * 1.5;
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const x = A[i], y = B[i]; if (!x || !y) continue; sc += x === y ? 0 : (LOOK[x] || '').indexOf(y) >= 0 ? 0.4 : 1; }
  if (A[0] !== B[0]) sc += 0.6;
  if ((a.trim().split(/\s+/).length) !== (b.trim().split(/\s+/).length)) sc += 2;
  return sc;
}
function lookAlikes(w, pool) {
  const all = bankOf('pick') === 'everyday' ? everydayAll() : properAll(), key = letters(w), seen = new Set([key]);
  const ranked = all.filter(x => { const k = letters(x); if (seen.has(k) || !k) return false; seen.add(k); return true; })
    .map(x => ({ x, s: lookScore(w, x) + Math.random() * 0.8 })).sort((a, b) => a.s - b.s);
  return shuffle(ranked.slice(0, 6)).slice(0, 3).map(r => r.x);      // three of the six closest, so the same word does not always get the same choices
}
const everydayAll = () => Object.keys(window.FAMILIAR || {}).flatMap(c => window.FAMILIAR[c]);
const properAll = () => Object.keys(window.FS_WORDS || {}).flatMap(c => window.FS_WORDS[c]);
/* Look-alike letters: four REAL words that differ only in easily confused letters (LOOK_GROUPS), or four look-alike letters on their own */
function pairTrial() {
  const gname = pick1(S.pairs), grp = window.LOOK_GROUPS[gname];
  if (S.pairkind === 'letters' || !grp.sets.length || (grp.sets.length < 2 && Math.random() < 0.5)) {
    const opts = shuffle(grp.letters.split('')).slice(0, 4), target = pick1(opts);
    return { w: target, opts, target, pair: gname, letter: true };
  }
  const set = pick1(grp.sets), target = pick1(set);
  return { w: target, opts: shuffle(set), target, pair: gname, n: lettersCount(target), c: '' };
}
/* Fill in the blanks: how many middle letters to blur (Colleen: depending on length), never the first or last */
/* Fill in the blanks is harder than real life (a missed letter can never be seen), so it plays about a third slower than the chosen speed (Colleen) */
const FILL_SLOWER = 0.15;      // about 1.35 times as long a letter
const blurCount = n => n <= 3 ? 0 : n <= 5 ? 1 : n <= 7 ? 2 : n <= 10 ? 3 : 4;
function blurSet(w) {      /* never two blurred letters in a row (Colleen) */
  const n = lettersCount(w), want = blurCount(n), mid = []; for (let i = 1; i < n - 1; i++) mid.push(i);
  let best = new Set();
  for (let t = 0; t < 30 && best.size < want; t++) { const out = new Set(); for (const i of shuffle(mid)) { if (out.size >= want) break; if (!out.has(i - 1) && !out.has(i + 1)) out.add(i); } if (out.size > best.size) best = out; }
  return best;
}

/* ---------- a round ---------- */
let R = null;      // the round being played
function startRound(fixedWords) {
  const g = S.game, pool = poolFor(g);
  let list;
  if (fixedWords) list = shuffle(fixedWords);
  else if (g === 'flash') { list = []; for (let i = 0; i < S.flcount; i++) { let L; do { L = pick1(S.flash); } while (S.flash.length > 1 && list.length && list[list.length - 1].w === L); list.push({ w: L, n: 1 }); } }
  else if (g === 'nquiz') { list = []; for (let i = 0; i < S.qcount; i++) list.push(quizItem(list)); }
  else if (isYear(g)) { list = []; for (let i = 0; i < S.ncount; i++) list.push(yearItem(list)); }
  else if (isAge(g)) { list = []; for (let i = 0; i < S.ncount; i++) list.push(ageItem(list)); }
  else if (isNums(g)) { list = []; for (let i = 0; i < S.ncount; i++) { let x; do { x = pick1(S.nums); } while (S.nums.length > 1 && list.length && list[list.length - 1].w === x); list.push({ w: x, n: 1, teens: teensFor(), form: formFor() }); } }
  else if (g === 'pairs') { list = []; for (let i = 0; i < S.count; i++) { let t; do { t = pairTrial(); } while (list.length && list[list.length - 1].w === t.w && S.pairs.length + 1 > 1 && Math.random() < 0.9); list.push(t); } }
  else if (g === 'ladder') list = shuffle(pool);
  else list = shuffle(pool).slice(0, g === 'sound' ? S.scount : g === 'tricky' ? S.tcount : S.count);
  if (!list.length) return;
  R = { game: g, list, i: -1, items: [], started: Date.now(), settings: JSON.parse(JSON.stringify(S)), review: !!fixedWords, pool };
  if (g === 'ladder') { R.lspeed = S.speed; R.top = null; R.hearts = S.hearts === 'off' ? 0 : +S.hearts || 3; R.lives = R.hearts || Infinity; }      /* Hearts: 1, 3 or 5, or off (no game over; End round finishes) (Colleen) */
  track('round_start', { game: g, speed: speedName(S.speed), words: list.length });
  if (location.hash === '#/play') { setupShow(g); playShow(); } else location.hash = '#/play';
}
/* the settings stay above the game (Colleen): a change while playing reshapes the words still to come; words already answered stay */
function refreshRound() {
  const g = R.game, done = R.list.slice(0, R.i + 1), used = new Set(done.map(x => letters(x.w)));
  R.pool = poolFor(g);
  if (g === 'ladder') R.list = done.concat(shuffle(R.pool.filter(x => !used.has(letters(x.w)))));
  else if (g === 'flash') { const more = []; for (let k = done.length; k < S.flcount && S.flash.length; k++) more.push({ w: pick1(S.flash), n: 1 }); R.list = done.concat(more); }
  else if (g === 'nquiz') { const more = []; for (let k = done.length; k < S.qcount; k++) more.push(quizItem(done.concat(more))); R.list = done.concat(more); }
  else if (isYear(g)) { const more = []; for (let k = done.length; k < S.ncount; k++) more.push(yearItem(done.concat(more))); R.list = done.concat(more); }
  else if (isAge(g)) { const more = []; for (let k = done.length; k < S.ncount; k++) more.push(ageItem(done.concat(more))); R.list = done.concat(more); }
  else if (isNums(g)) { const more = []; for (let k = done.length; k < S.ncount && S.nums.length; k++) more.push({ w: pick1(S.nums), n: 1, teens: teensFor(), form: formFor() }); R.list = done.concat(more); }
  else if (g === 'pairs') { const more = []; for (let k = done.length; k < S.count && S.pairs.length; k++) more.push(pairTrial()); R.list = done.concat(more); }
  else { const total = g === 'sound' ? S.scount : g === 'tricky' ? S.tcount : S.count; R.list = done.concat(shuffle(R.pool.filter(x => !used.has(letters(x.w)))).slice(0, Math.max(0, total - done.length))); }
  if (R.i >= 0) { const g2 = R.game; $('#p-count').textContent = g2 === 'ladder' ? 'Word ' + (R.i + 1) : (g2 === 'flash' ? 'Letter ' : isNumGame(g2) ? (isYear(g2) ? 'Year ' : isAge(g2) ? 'Age ' : 'Number ') : 'Word ') + (R.i + 1) + ' of ' + Math.max(R.list.length, R.i + 1); }
  assist.className = 'assist' + (S.assist === 'off' || g === 'flash' || g === 'pairs' || isNumGame(g) ? '' : ' ' + S.assist);
  if (R.i >= 0 && R.answered !== R.i) drawBlanks(R.list[R.i]);
}
function playShow() {
  if (!R) { location.hash = '#/games'; return; }
  const first = $('#game-area').hidden;
  $('#game-area').hidden = false; $('#s-live').hidden = false; $('#s-go').textContent = 'Start over with these settings';
  putStage('play-slot');
  if (first || R.i < 0) setTimeout(() => $('#game-area').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  const g = R.game;
  assist.className = 'assist' + (S.assist === 'off' || g === 'flash' || g === 'pairs' || isNumGame(g) ? '' : ' ' + S.assist);
  speedNow = g === 'ladder' ? () => R ? R.lspeed : S.speed : g === 'fill' ? () => S.speed - FILL_SLOWER : () => S.speed;
  $('#p-ladder').hidden = g !== 'ladder';
  if (R.i < 0) nextWord(); else drawWord();
}
function ladderBar() { if (!R || R.game !== 'ladder') return; $('#p-lspeed').textContent = speedName(R.lspeed) + ' · ' + lps(R.lspeed) + ' letters a second'; $('#p-lives').textContent = R.hearts ? '❤️'.repeat(Math.max(0, R.lives)) + '🤍'.repeat(R.hearts - Math.max(0, R.lives)) : 'No hearts: tap End round when you are done'; }
function drawBlanks(it) {
  const g = R.game;
  let blanks = '';
  if (g === 'fill') {      /* the first and last letters are given; a box for each letter between, to type what you saw while it spells (Colleen) */
    const L = letters(it.w), el = $('#p-blanks');
    el.innerHTML = '<span class="fbl">' + L.charAt(0) + '</span>' + Array.from({ length: L.length - 2 }, (_, i) => '<input class="fbox" maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Letter ' + (i + 2) + '" data-i="' + i + '">').join('') + '<span class="fbl">' + L.charAt(L.length - 1) + '</span>';
    if (R.cur && R.cur.blur) fboxes().forEach(b => { const on = R.cur.blur.has(+b.dataset.i + 1); b.classList.toggle('fblur', on); b.placeholder = on ? '?' : ''; if (on) b.setAttribute('aria-label', b.getAttribute('aria-label') + ', blurred'); });      // which boxes were blurred (Colleen)
    el.removeAttribute('aria-hidden'); return;
  }
  $('#p-blanks').setAttribute('aria-hidden', 'true');
  if (S.showCount && (g === 'type' || g === 'ladder' || g === 'sound' || g === 'tricky')) blanks = it.w.trim().split(/\s+/).map(x => '_'.repeat(lettersCount(x))).filter(Boolean).join(' ');      // a gap only where there is a real space
  $('#p-blanks').textContent = blanks;
}
function drawWord() {
  const g = R.game, it = R.list[R.i];
  $('#p-speedf').hidden = g === 'ladder'; $('#p-speed').value = Math.round(S.speed * 100);
  $('#p-count').textContent = g === 'ladder' ? 'Word ' + (R.i + 1) : (g === 'flash' ? 'Letter ' : isNumGame(g) ? (isYear(g) ? 'Year ' : isAge(g) ? 'Age ' : 'Number ') : 'Word ') + (R.i + 1) + ' of ' + R.list.length;
  ladderBar();
  $('#p-feedback').textContent = ''; $('#p-feedback').className = 'feedback'; $('#p-next').hidden = true; $('#p-meaning').hidden = true;
  const choice = isChoice(g);
  $('#p-typebox').hidden = choice; $('#p-choicebox').hidden = !choice;
  if (choice) {
    if (g === 'pick' && !it.shown) it.shown = shuffle([it.w].concat(lookAlikes(it.w, R.pool)));
    if (isNums(g) && !it.shown) it.shown = numChoices(it.w);
    if (g === 'nquiz' && !it.shown) it.shown = bigChoices(it.w);
    if (g === 'ypick' && !it.shown) it.shown = yearChoices(it.w);
    if (g === 'apick' && !it.shown) it.shown = ageChoices(it.w);
    const opts = g === 'pick' || isNumGame(g) ? it.shown : it.opts;
    $('#p-cask').textContent = isNumGame(g) ? (isYear(g) ? 'Which year did the hand sign?' : isAge(g) ? 'Which age did the hand sign?' : 'Which number did the hand sign?') : g === 'pairs' && it.letter ? 'Which letter did the hand spell?' : 'Which word did the hand spell?';      // Look-alike letters: four choices
    $('#p-choices').innerHTML = opts.map(o => '<button data-o="' + esc(o) + '">' + esc(showW(o).toUpperCase()) + '</button>').join('');
  } else {
    const a = $('#p-answer'); a.value = ''; a.disabled = false; a.hidden = g === 'fill';      // Fill in the blanks: the boxes only, no typing line (Colleen) a.maxLength = g === 'flash' ? 1 : isNums(g) || isAge(g) ? 2 : isYear(g) ? 4 : g === 'nquiz' ? 13 : 200; a.inputMode = isNumGame(g) ? 'numeric' : 'text';
    $('#p-ask').textContent = g === 'flash' ? 'Which letter? (just press the key)' : isNumGame(g) ? isYear(g) ? 'What year did the hand sign?' : isAge(g) ? 'What age did the hand sign?' : 'What number did the hand sign?' : g === 'fill' ? 'Type the missing letters. A ? box was blurred.' : 'What did the hand spell?';
    $('#p-check').hidden = g === 'flash'; $('#p-skip').hidden = false; $('#p-replay').hidden = false; $('#p-check').disabled = false;
  }
  drawBlanks(it);
  const clue = g === 'type' && S.mode === 'clue';
  $('#p-clue').hidden = !clue;
  if (clue) {      // the category's sign: its GIF once Colleen sends it (CAT_GIFS in words.js), its name until then
    const gif = (window.CAT_GIFS || {})[it.c];
    $('#p-clue-box').innerHTML = gif ? '<img src="' + esc(gif) + '" alt="' + esc(niceCat(it.c)) + ' (sign)">' : esc(niceCat(it.c));
  }
}
async function nextWord() {
  R.i++;
  if (R.game === 'ladder' && R.i >= R.list.length) R.list = R.list.concat(shuffle(R.pool));      // the ladder goes on until the hearts run out (or forever with hearts off)
  if (R.i >= R.list.length) return finishRound();
  const it = R.list[R.i];
  R.cur = { replays: 0, shownAt: Date.now(), blur: R.game === 'fill' ? blurSet(it.w) : null };
  drawWord();
  if (!isChoice(R.game)) setTimeout(answerFocus, 50);
  if (R.game === 'type' && S.mode === 'clue') await new Promise(r => setTimeout(r, 1400));      // the category first, then the word
  if (location.hash === '#/play' && R) { R.cur.shownAt = Date.now(); spellWord(it.w, R.cur.blur, it.teens, it.form); }
}
function letterDiff(right, chosen) {      // { mix: [right letter + letter chosen, ...], swaps: how many pairs of letters were exchanged }
  const a = letters(right), b = letters(chosen);
  if (!a || a.length !== b.length) return { mix: [], swaps: 0 };
  const left = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) left.push(i);
  /* Colleen (3.90): "if students invert 2 letters, it is unlikely that this was a letter mixup but a letter order mixup". Two places whose letters
     were exchanged (BRAD read as BARD, FORM as FROM; next to each other or not) are a letter-order slip, not a mix-up: they are dropped first. */
  let swaps = 0;
  for (let x = 0; x < left.length; x++) for (let y = x + 1; y < left.length; y++) { const i = left[x], j = left[y];
    if (a[i] === b[j] && a[j] === b[i]) { left.splice(y, 1); left.splice(x, 1); x--; swaps++; break; } }
  if (left.length > 2) return { mix: [], swaps: 0 };      // a whole different word is not a mix-up of letters
  return { mix: left.map(i => a[i] + b[i]), swaps };
}
const diffPairs = (right, chosen) => letterDiff(right, chosen).mix;      // which letters were mixed up: [right letter, letter chosen]
/* 3.90 (Colleen: "add letter order"): the words answered with two letters in the wrong order, [{ w, typed }] */
const orderList = items => items.filter(x => !x.ok && x.typed && !/^\d+$/.test(String(x.w)) && letterDiff(x.w, x.typed).swaps > 0);
const orderLine = (items, html) => { const o = orderList(items || []); if (!o.length) return '';
  const t = o.slice(0, 6).map(x => html ? '<b>' + esc(showW(x.w)) + '</b> read as <b>' + esc(x.typed) + '</b>' : showW(x.w) + ' read as ' + x.typed).join(html ? ' · ' : ', ');
  return 'Letter order slips: ' + t + (o.length > 6 ? (html ? ' · ' : ', ') + 'and ' + (o.length - 6) + ' more' : ''); };
function record(ok, typed, extra) {
  const it = R.list[R.i];
  const row = Object.assign({ w: it.w, c: it.c || '', n: it.n || lettersCount(it.w), ok, typed, replays: R.cur.replays, ms: Date.now() - R.cur.shownAt, speed: R.game === 'ladder' ? R.lspeed : S.speed }, extra || {});
  if (!ok && typed) row.mix = diffPairs(row.w, typed);
  R.items.push(row);
  track('word_answer', { game: R.game, ok, letters: row.n });
  if (R.game === 'ladder') {
    if (ok) { R.top = R.top === null ? R.lspeed : Math.max(R.top, R.lspeed); R.lspeed = Math.min(1, R.lspeed + 0.04 * (1 - 0.6 * R.lspeed)); }      /* gentler steps, smaller still near the top (Colleen: slower climb to the fast speeds) */
    else { R.lives--; R.lspeed = Math.max(0, R.lspeed - 0.06); }
    ladderBar();
  }
  return row;
}
function showFeedback(ok, skip, w) {
  const fb = $('#p-feedback');
  fb.className = 'feedback ' + (ok ? 'good' : 'bad');
  fb.innerHTML = (ok ? 'Yes!' : skip ? 'It was:' : 'Not quite. It was:') + (ok ? '' : '<span class="ans">' + esc(w.length === 1 ? w.toUpperCase() : showW(w)) + '</span>');
}
/* Silent Letters & Strange Spellings: after the answer, the meaning and a button to hear the word said (the device's own English voice) */
function showMeaning(it) {
  const m = $('#p-meaning');
  m.innerHTML = (it.def ? '<p><b>' + esc(it.w) + ':</b> ' + esc(it.def) + '</p>' : '') + (it.note ? '<p class="note">' + esc(it.note) + '</p>' : '') +
    ('speechSynthesis' in window ? '<button class="btn ghost" id="p-say">🔊 Hear it pronounced</button>' : '');
  m.hidden = false;
  const b = $('#p-say'); if (b) b.onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(it.w); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {} };
}
/* What does that word mean? (Colleen: "I was right, but is that a real word?"): after a word game answer, a short description from defs.js */
const defKey = w => String(w || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let DEFIDX = null;
function wordDef(w) {
  const D = window.FS_DEFS; if (!D) return ''; if (D[w]) return D[w];
  if (!DEFIDX) { DEFIDX = {}; Object.keys(D).forEach(k => { DEFIDX[defKey(k)] = D[k]; }); } return DEFIDX[defKey(w)] || '';
}
function showDef(w) {
  if (isNumGame(R.game) || R.game === 'flash' || R.game === 'pairs' || String(w).length < 2) return; const d = wordDef(w); if (!d) return;
  const m = $('#p-meaning'); m.innerHTML = '<p class="def"><span aria-hidden="true">📖</span> ' + esc(d) + '</p>'; m.hidden = false;
}
function afterAnswer() {
  const last = R.game === 'ladder' ? R.lives <= 0 : R.i + 1 >= R.list.length;
  if (R.game === 'flash') { setTimeout(() => { if (R && location.hash === '#/play') nextWord(); }, 650); return; }      // letters keep coming
  $('#p-next').hidden = false; $('#p-next').textContent = last ? 'See my results' : isNumGame(R.game) ? 'Next number' : 'Next word'; $('#p-next').focus();
  if (last && R.game === 'ladder') R.done = true;
}
function answerTyped(skip) {
  if (!R || R.answered === R.i) return;
  const it = R.list[R.i], typed = $('#p-answer').value.trim();
  if (!skip && !typed) { answerFocus(); return; }
  R.answered = R.i;
  const ok = !skip && answerKey(typed, isNumGame(R.game)) === answerKey(it.w, isNumGame(R.game));      // Numbers: only the digits count      // only the letters count: apostrophes, spaces, capitals and punctuation are allowed but never required (Colleen)
  record(ok, skip ? '' : typed);
  showFeedback(ok, skip, it.w);
  if (R.game === 'tricky') showMeaning(it); else showDef(it.w);
  fboxes().forEach(b => { b.disabled = true; }); $('#p-answer').disabled = true; $('#p-check').hidden = true; $('#p-skip').hidden = true; $('#p-replay').hidden = R.game === 'flash';
  afterAnswer();
}
function answerChoice(o) {
  if (!R || R.answered === R.i) return;
  R.answered = R.i;
  const num = isNumGame(R.game), it = R.list[R.i], right = R.game === 'pairs' ? it.target : it.w, ok = answerKey(o, num) === answerKey(right, num);
  record(ok, o, { w: right, pair: it.pair, picked: true });
  $$('#p-choices button').forEach(b => { b.disabled = true; if (answerKey(b.dataset.o, num) === answerKey(right, num)) b.classList.add('right'); else if (b.dataset.o === o) b.classList.add('wrong'); });
  showFeedback(ok, false, right); showDef(right);
  afterAnswer();
}
function finishRound() {
  stopFlag = true;
  const g = R.game, items = R.items, right = items.filter(x => x.ok).length, secs = Math.max(1, Math.round((Date.now() - R.started) / 1000));
  const avgLen = items.length ? Math.round(items.reduce((a, x) => a + x.n, 0) / items.length * 10) / 10 : 0;
  const res = { at: new Date().toISOString(), game: g, n: items.length, right, pct: items.length ? Math.round(right / items.length * 100) : 0, secs, wpm: Math.round(right / (secs / 60) * 10) / 10, avgLen,
    speed: Math.round(S.speed * 100) / 100, speedName: speedName(S.speed), limit: R.settings.limit, mode: R.settings.mode, paper: S.paper,
    cats: g === 'sound' ? 'Levels ' + R.settings.levels.sort().join(', ') : g === 'tricky' ? R.settings.tlevels.sort().map(l => window.TRICKY_LEVELS[l]).join(', ') : g === 'flash' ? R.settings.flash.length + ' letters' : isAge(g) ? 'Ages: ' + ATYPES.filter(t => (R.settings.atypes || []).indexOf(t[0]) >= 0).map(t => t[1].replace('Ages ', '')).join(', ') : isYear(g) ? 'Years: ' + YTYPES.filter(t => (R.settings.ytypes || []).indexOf(t[0]) >= 0).map(t => t[1]).join(', ') : isNums(g) ? numsLabel(R.settings.nums) + ' · 16–19: ' + TEENS_NAME[R.settings.nteens] + ' · 23, 25: ' + FORM_NAME[R.settings.nform || 'mix'] : g === 'nquiz' ? (() => { const r = R.settings.qrange === 'custom' ? [R.settings.qmin, R.settings.qmax] : (Q_RANGES[+R.settings.qrange] || Q_RANGES[1]); return nfmt(r[0]) + '–' + nfmt(r[1]); })() + ' · 16–19: ' + TEENS_NAME[R.settings.nteens] + ' · 23, 25: ' + FORM_NAME[R.settings.nform || 'mix'] + ' · HUNDRED: ' + HUND_NAME[R.settings.nhund || 'mix'] : g === 'pairs' ? R.settings.pairs.join(' ') : R.settings.cats.length === CATS.length ? 'All' : R.settings.cats.join(','),
    supports: [R.settings.one ? 'one word' : '', R.settings.showCount ? 'letter count' : '', R.settings.assist !== 'off' && g !== 'flash' && g !== 'pairs' && !isNumGame(g) ? R.settings.assist + ' letters' : ''].filter(Boolean).join(', '), review: R.review, items };
  res.bank = g === 'pairs' || g === 'flash' || g === 'tricky' || isNumGame(g) ? '' : bankOf(g); res.replays = items.reduce((a, x) => a + (x.replays || 0), 0);
  if (g === 'ladder') { res.top = R.top; res.topLps = R.top === null ? 0 : lps(R.top); res.topName = R.top === null ? '' : speedName(R.top); }
  if (g === 'flash') res.avgMs = items.length ? Math.round(items.reduce((a, x) => a + x.ms, 0) / items.length) : 0;
  if (items.length) { const all = store.get('sessions', []); all.push(res); store.set('sessions', all.slice(-400)); }
  store.set('last', res);
  sendToStudy(res, R);
  track('round_end', { game: g, pct: res.pct, words: res.n });
  R = null; location.hash = '#/results';
}
$('#p-check').onclick = () => answerTyped(false);
/* Fill in the Blanks boxes: one letter each, the cursor moves on by itself; what is typed goes into the answer (first + boxes + last) */
const fboxes = () => $$('#p-blanks .fbox');
const answerFocus = () => { const b = R && R.game === 'fill' ? fboxes().find(x => !x.value) || fboxes()[0] : null; (b || $('#p-answer')).focus(); };      // the first empty box in Fill in the blanks
const fboxSync = () => { const it = R && R.list[R.i]; if (!it || R.game !== 'fill') return; const L = letters(it.w), mid = fboxes().map(b => b.value).join(''); $('#p-answer').value = mid ? L.charAt(0) + mid + L.charAt(L.length - 1) : ''; };
$('#p-blanks').addEventListener('input', e => { const b = e.target.closest('.fbox'); if (!b) return; b.value = b.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase(); fboxSync(); if (b.value) { const nx = fboxes()[+b.dataset.i + 1]; if (nx) nx.focus(); } });
$('#p-blanks').addEventListener('keydown', e => { const b = e.target.closest('.fbox'); if (!b) return; const all = fboxes(), i = +b.dataset.i;
  if (e.key === 'Backspace' && !b.value && i) { e.preventDefault(); all[i - 1].value = ''; all[i - 1].focus(); fboxSync(); }
  else if (e.key === 'ArrowLeft' && i) all[i - 1].focus(); else if (e.key === 'ArrowRight' && all[i + 1]) all[i + 1].focus();
  else if (e.key === 'Enter') { e.preventDefault(); if (!$('#p-check').hidden) $('#p-check').click(); } });
$('#p-skip').onclick = () => { if (R && R.game === 'flash') { if (R.answered === R.i) return; R.answered = R.i; record(false, ''); showFeedback(false, true, R.list[R.i].w); $('#p-answer').disabled = true; afterAnswer(); } else answerTyped(true); };
$('#p-next').onclick = () => { if (R && R.done) finishRound(); else if (R) nextWord(); };
const replay = () => { if (!R) return; R.cur.replays++; spellWord(R.list[R.i].w, R.cur.blur, R.list[R.i].teens, R.list[R.i].form); if (!isChoice(R.game)) answerFocus(); };
$('#p-replay').onclick = replay; $('#p-replay2').onclick = replay;
$('#p-choices').onclick = e => { const b = e.target.closest('button'); if (b) answerChoice(b.dataset.o); };
$('#p-quit').onclick = () => { if (R && R.items.length) finishRound(); else { R = null; stopFlag = true; location.hash = '#/games'; } };
$('#p-answer').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (R && R.answered === R.i) $('#p-next').click(); else answerTyped(false); } });
$('#p-answer').addEventListener('input', e => {      // Letter flash: one key is the answer
  if (!R || R.game !== 'flash' || R.answered === R.i) return;
  const v = letters(e.target.value); if (!v) return;
  R.answered = R.i; const it = R.list[R.i], ok = v === it.w;
  record(ok, v); showFeedback(ok, false, it.w); e.target.disabled = true; afterAnswer();
});

/* ---------- ASL Study (Colleen): opened inside the ASL Study app (?embed=aslstudy), each finished round is sent to the app, which saves
   it under the student's school sign-in (running totals, points). Nothing is sent when the site is used on its own. ---------- */
if (EMBED) document.documentElement.classList.add('embedded');
function sendToStudy(res, round) {
  if (!EMBED || !res.items.length) return;
  const num = isNumGame(res.game), k = res.speed;      // k: the speed slider, 0 Beginner .. 1 Deaf
  const scale = Math.round((1 + 9 * Math.max(0, Math.min(1, k))) * 10) / 10;      // speed on a 1-10 scale (Colleen)
  const msg = { type: 'fsp-round', v: 1, kind: num ? 'numbers' : 'letters', game: res.game, name: GAMES[res.game] ? GAMES[res.game].name : res.game,
    rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), n: res.n, right: res.right, secs: res.secs, speed: scale,
    lps: num ? null : lps(k), top: res.game === 'ladder' && res.top !== null && res.top !== undefined ? res.topLps : null,
    letters: num ? 0 : res.items.reduce((a, x) => a + (x.ok ? (x.n || lettersCount(x.w)) : 0), 0),      // letters read correctly
    items: num ? [] : res.items.filter(x => x.c && !/^LEVEL/.test(x.c)).map(x => ({ w: x.w, c: x.c, ok: !!x.ok })).slice(0, 300) };
  if (num) msg.nums = res.items.slice(0, 60).map(x => [String(x.w), x.ok ? 1 : 0, String(x.typed || '').slice(0, 13)]);      // ASL Study 3.90 Class Problem Spots: each number, right or not, and the answer given
  else { msg.mix = mixList(res.items).slice(0, 30).map(x => [x.right, x.saw, x.times]);      // 3.90: the round's letter mix-ups [right, saw, times]
    const ord = orderList(res.items); msg.orderN = ord.length; msg.order = ord.slice(0, 20).map(x => [String(x.w).slice(0, 40), String(x.typed).slice(0, 40)]); }      // 3.90: letter order slips
  try { window.parent.postMessage(msg, '*'); } catch (e) {}
}
/* Fingerspell to the Camera inside ASL Study / the TpT sheet: the camera can't run inside the sheet's frame, so it opens in its own tab
   (like Say It); its check results come back here and go on to the sheet as an expressive round (Colleen) */
let CAMWIN = null;
function openCamera(e) {
  if (!EMBED) return; if (e) e.preventDefault();
  const num = !!(e && e.currentTarget && e.currentTarget.id === 'camnumcard');      /* the number camera (2026-10-17) */
  const u = 'reader.html?embed=aslstudy' + (num ? '&kind=numbers' : '') + (ONLY ? '&only=' + ONLY : '') + (STUDY.camtl !== undefined ? '&tl=' + STUDY.camtl : '');
  CAMWIN = window.open(u, '_blank');
  if (!CAMWIN) location.href = u;
}
window.addEventListener('message', e => {
  if (!EMBED || !CAMWIN || e.source !== CAMWIN || e.origin !== location.origin || !e.data || e.data.type !== 'fsp-cam-round') return;
  const m = Object.assign({}, e.data, { type: 'fsp-round' }); try { window.parent.postMessage(m, '*'); } catch (x) {}
});
window.addEventListener('message', e => {      /* the app can open a given game: { type: 'fsp-open', hash: '#/setup/type' } */
  if (!EMBED || e.source !== window.parent || !e.data) return;
  if (e.data.type === 'fsp-open' && /^#\/[\w/-]*$/.test(e.data.hash || '')) location.hash = e.data.hash;
  if (e.data.type === 'fsp-hello' && e.data.cam === false) document.body.classList.add('nocam');
  if (e.data.type === 'fsp-hello' && 'cam' in e.data && e.data.camnum !== true) document.body.classList.add('nocamnum');      /* the TpT sheets: the number camera only where it was bought (ASL Study sends no cam, so it keeps both) */      /* a TpT edition without the Expressive part: no camera activity (Colleen: the Plus edition has it) */
  if (e.data.type === 'fsp-hello' && e.data.camtl !== undefined && e.data.camtl !== null && e.data.camtl !== '') STUDY.camtl = Math.max(0, Math.min(60, +e.data.camtl || 0));      /* the teacher's camera time limit (Settings) */
  if (e.data.type === 'fsp-hello' && e.data.name) { STUDY.name = String(e.data.name).slice(0, 60); STUDY.cls = String(e.data.cls || '').slice(0, 80); STUDY.app = String(e.data.app || '').slice(0, 60); STUDY.level = String(e.data.level || '').slice(0, 40); if (!store.get('name', '')) store.set('name', STUDY.name); if (location.hash === '#/report') reportShow(); }
  if (e.data.type === 'fsp-compare-data' && CMP && CMP.kind === e.data.kind && CMP.state === 'loading') {      /* ASL Study 3.82: the program comparison for the diagnostic report */
    const d = e.data.data;
    if (e.data.error || !d || d.teacher) { CMP.state = 'error'; const msg = String(e.data.error || '').slice(0, 200); CMP.error = /^Teacher/.test(msg) ? msg : 'The program comparison could not load right now' + (msg ? ' (' + msg.replace(/\.$/, '') + ')' : '') + '. Make the report again in a minute.'; }
    else { CMP.state = 'ok'; CMP.data = d; }
    if (/^#\/report/.test(location.hash) && reportRedraw) reportRedraw();
    return;
  }
  if (e.data.type === 'fsp-words') {      /* ASL Study 3.81: the sheet's lists; a page built from other words reloads once to use them */
    const clean = { proper: goodLists(e.data.proper) ? e.data.proper : null, everyday: goodLists(e.data.everyday) ? e.data.everyday : null,
      tricky: goodTricky(e.data.tricky) ? e.data.tricky : null, look: goodLook(e.data.look) ? e.data.look : null, defs: goodDefs(e.data.defs) ? e.data.defs : null };
    if (!clean.proper && !clean.everyday && !clean.tricky && !clean.look) return;
    const s = JSON.stringify(clean);
    try {
      sessionStorage.setItem(SHEET_KEY, s);
      if (s !== sheetStart && sessionStorage.getItem(SHEET_KEY + '.reloaded') !== s) { sessionStorage.setItem(SHEET_KEY + '.reloaded', s); location.reload(); }
    } catch (x) {}
    return;
  }
  if (e.data.type === 'fsp-report-done') { const m = $('#rp-sent'); if (m) { m.hidden = false; m.className = 'alert' + (e.data.ok ? ' good' : ' bad'); m.textContent = e.data.msg || (e.data.ok ? 'Sent!' : 'Not sent.'); } const b = $('#rp-mail'); if (b) b.disabled = false; }
});
const STUDY = { name: '', cls: '', app: '', level: '' };
let CMP = null, reportRedraw = null;      // 3.82: { kind, at, state: 'loading' | 'ok' | 'error', data, error } for the round on the report page
if (EMBED) try { window.parent.postMessage({ type: 'fsp-ready' }, '*'); } catch (e) {}

/* ---------- results ---------- */
function mixList(items) {
  const m = {}; items.forEach(x => (!x.ok && x.typed && !/^\d+$/.test(String(x.w)) ? diffPairs(x.w, x.typed) : x.mix || []).forEach(p => { m[p] = (m[p] || 0) + 1; }));      // worked out again from the answer, so rounds saved before 3.90 follow the letter-swap rule too
  return Object.keys(m).sort((a, b) => m[b] - m[a]).map(p => ({ right: p[0], saw: p[1], times: m[p] }));
}
/* the products: Colleen's picks in admin (asl.cool/products.json), or else every product in her Shopify store, read straight from Shopify
   (aslstudyhall.com/products.json allows this): picture, name, price, description, link to the product on aslstudyhall.com */
async function aslProducts() {
  const strip = h => { const d = document.createElement('div'); d.innerHTML = String(h || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  try { const r = await fetch((/(^|\.)asl\.cool$/.test(location.hostname) ? '' : 'https:' + '/' + '/asl.cool') + '/products.json', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); if (d.source === 'admin' && d.products && d.products.length) return d.products; } } catch (e) {}
  try { const r = await fetch('https:' + '/' + '/aslstudyhall.com/products.json?limit=50'); if (r.ok) return ((await r.json()).products || []).map(x => { const v = (x.variants || [])[0] || {}, img = (x.images || [])[0];
    return { title: x.title || '', price: v.price ? '$' + (+v.price).toFixed(2) : '', img: img && img.src ? img.src : '', desc: strip(x.body_html).slice(0, 180), link: 'https:' + '/' + '/aslstudyhall.com/products/' + x.handle }; }); } catch (e) {}
  return [];
}
/* "Enjoying this? Teachers, take it further" (Colleen): after a round on the public site only (never inside ASL Study, never in the TpT products); featured products come from asl.cool/products.json (admin > Featured Products) */
let teachProducts = null;
async function teachCard() {
  const box = $('#r-teach'); if (!box) return;
  if (EMBED || CFG.only) { box.hidden = true; return; }
  box.hidden = false;
  if (teachProducts === null) teachProducts = await aslProducts();
  $('#r-products').innerHTML = teachProducts.slice(0, 6).map(x => '<a class="teach-product" href="' + esc(x.link) + '" target="_blank" rel="noopener">' + (x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy">' : '') + '<b>' + esc(x.title) + '</b>' + (x.price ? '<span>' + esc(x.price) + '</span>' : '') + '</a>').join('');
}
function resultsShow() {
  teachCard();
  const r = store.get('last', null);
  if (!r) { $('#r-score').textContent = 'No round yet'; $('#r-stats').innerHTML = ''; $('#r-words').innerHTML = ''; $('#r-extra').innerHTML = ''; return; }
  const g = r.game || 'type';
  $('#r-title').textContent = GAMES[g].name + ': results';
  $('#r-again').href = '#/setup/' + g;
  const mm = Math.floor(r.secs / 60), ss = r.secs % 60, time = mm + ':' + String(ss).padStart(2, '0');
  if (g === 'ladder') {
    $('#r-score').textContent = r.top === null ? 'Keep climbing!' : r.topLps + ' letters a second';
    $('#r-stats').innerHTML = statBox(r.topName || '—', 'top speed') + statBox(r.right + ' of ' + r.n, 'words right') + statBox(r.avgLen, 'letters per word') + statBox(time, 'time');
  } else if (isNumGame(g)) {
    $('#r-score').textContent = r.pct + '%';
    $('#r-stats').innerHTML = statBox(r.right + ' of ' + r.n, isYear(g) ? 'years right' : isAge(g) ? 'ages right' : 'numbers right') + statBox(r.speedName, 'speed') + statBox(time, 'time') + statBox(r.paper === 'yes' ? 'Yes' : 'No', 'used paper');
  } else if (g === 'flash') {
    $('#r-score').textContent = r.pct + '%';
    $('#r-stats').innerHTML = statBox(r.right + ' of ' + r.n, 'letters right') + statBox((r.avgMs / 1000).toFixed(1) + ' s', 'to answer (average)') + statBox(r.speedName, 'speed') + statBox(time, 'time');
  } else {
    $('#r-score').textContent = r.pct + '%';
    $('#r-stats').innerHTML = statBox(r.right + ' of ' + r.n, 'right') + (CHOICE_GAMES.indexOf(g) < 0 ? statBox(r.wpm, 'words right per minute') + statBox(r.avgLen, 'letters per word (average)') : '') +
      statBox(r.speedName, 'speed') + (g === 'type' || g === 'fill' || g === 'pick' ? statBox(r.limit ? r.limit + ' or fewer' : 'No limit', 'letter limit') : '') + statBox(time, 'time') + statBox(r.paper === 'yes' ? 'Yes' : 'No', 'used paper');
  }
  const mix = mixList(r.items);
  $('#r-extra').innerHTML = (mix.length ? '<h3>Letters You Mixed Up</h3><p>' + mix.slice(0, 8).map(m => '<b>' + m.right + '</b> read as <b>' + m.saw + '</b>' + (m.times > 1 ? ' (' + m.times + '×)' : '')).join(' · ') + '</p>' : '') +
    (orderList(r.items).length ? '<p>' + orderLine(r.items, true) + '</p>' : '');
  $('#r-review').textContent = isNumGame(g) ? (isYear(g) ? 'Review missed years' : isAge(g) ? 'Review missed ages' : 'Review missed numbers') : 'Review missed words';      // Colleen: number games say number, not word
  $('#r-words').innerHTML = r.items.map(x => '<li><span class="' + (x.ok ? 'ok' : 'no') + '">' + (x.ok ? '✓' : '✗') + '</span> ' + esc(showW(x.w)) + (x.ok ? '' : ' <span class="typed">' + (x.typed ? '(you ' + (CHOICE_GAMES.indexOf(g) >= 0 || x.picked ? 'picked ' : 'typed ') + esc(x.typed) + ')' : '(skipped)') + '</span>') + '</li>').join('');
  $('#r-review').hidden = !r.items.some(x => !x.ok) || g === 'flash' || g === 'pairs';      // Numbers: missed numbers can be watched again too
}

/* ---------- review missed words ---------- */
function reviewShow() {
  const r = store.get('last', null), miss = r ? r.items.filter(x => !x.ok) : [];
  putStage('review-slot'); assist.className = 'assist small'; speedNow = () => S.speed;
  $('#v-title').textContent = r && isYear(r.game) ? 'Missed years' : r && isAge(r.game) ? 'Missed ages' : r && isNumGame(r.game) ? 'Missed numbers' : 'Missed words'; $('#v-back').hidden = false;
  $('#v-list').innerHTML = miss.length ? miss.map((x, i) => '<button data-i="' + i + '">' + esc(x.w) + '</button>').join('') : '<p class="hint">No missed ' + (r && isNumGame(r.game) ? 'numbers' : 'words') + '. Nice!</p>';
  $('#v-list').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#v-list button').forEach(x => x.classList.toggle('on', x === b)); spellWord(miss[+b.dataset.i].w, null, teensFor()); };
  $('#v-again').hidden = false; $('#v-again').disabled = !miss.length;
  $('#v-again').onclick = () => { if (r) { S.game = r.game === 'ladder' ? 'type' : r.game; } startRound(miss.map(x => ({ w: x.w, c: x.c, n: x.n }))); };
}

/* ---------- report (to email or print), with a data code a teacher's sheet can read ---------- */
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function dataCode(r, name) {
  const d = { v: 1, game: r.game || 'type', name, at: r.at, n: r.n, right: r.right, pct: r.pct, secs: r.secs, wpm: r.wpm, avgLen: r.avgLen, speed: r.speed, limit: r.limit, mode: r.mode, paper: r.paper, cats: r.cats, supports: r.supports,
    top: r.top === undefined ? undefined : r.topLps, items: r.items.map(x => [x.w, x.ok ? 1 : 0, x.replays]) };
  return 'FSP1.' + b64(JSON.stringify(d));
}
/* The online report: the whole report travels inside the link (after #/view/), so no server is needed.
   It is squeezed with the browser's own compression when it can, so the QR code stays small enough to scan. */
const b64bytes = u8 => { let t = ''; u8.forEach(c => { t += String.fromCharCode(c); }); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64bytes = s => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u8 = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u8[i] = t.charCodeAt(i); return u8; };
async function squeeze(text, how) {
  const stream = new Blob([text]).stream().pipeThrough(how === 'in' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function packedReport(r, name) {
  return { v: 2, nm: name, g: r.game || 'type', at: r.at, n: r.n, rt: r.right, p: r.pct, s: r.secs, w: r.wpm, al: r.avgLen, sp: r.speed, li: r.limit, mo: r.mode, pa: r.paper,
    ca: r.cats, su: r.supports, b: r.bank, rp: r.replays, t: r.top, tl: r.topLps, tn: r.topName, am: r.avgMs, it: r.items.map(x => [x.w, x.ok ? 1 : 0, x.typed || '', x.replays || 0]) };
}
async function reportCode(r, name, cmp) {      /* cmp (inside ASL Study): the comparison travels in the link too, so the online report has the colors and percentiles (Colleen) */
  const pk = packedReport(r, name); if (cmp && cmp.state === 'ok' && cmp.data) { pk.c = cmp.data; pk.ap = STUDY.app || ''; }
  const json = JSON.stringify(pk);
  try { if (window.CompressionStream) return 'FSP2z.' + b64bytes(await squeeze(new TextEncoder().encode(json), 'in')); } catch (e) { /* fall through to the plain form */ }
  return 'FSP2.' + b64(json);
}
async function reportLink(r, name, cmp) { return location.origin + location.pathname + '#/view/' + await reportCode(r, name, cmp); }
async function readReportCode(code) {
  let d;
  if (code.indexOf('FSP2z.') === 0) d = JSON.parse(new TextDecoder().decode(await squeeze(unb64bytes(code.slice(6)), 'out')));
  else if (code.indexOf('FSP2.') === 0) d = JSON.parse(decodeURIComponent(escape(atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/')))));
  else return null;
  const items = (d.it || []).map(x => { const row = { w: x[0], ok: !!x[1], typed: x[2], replays: x[3] }; if (!row.ok && row.typed) row.mix = diffPairs(row.w, row.typed); return row; });
  return { name: d.nm || '', cmp: d.c && typeof d.c === 'object' ? { state: 'ok', data: d.c, at: d.at } : null, app: String(d.ap || ''), r: { game: d.g, at: d.at, n: d.n, right: d.rt, pct: d.p, secs: d.s, wpm: d.w, avgLen: d.al, speed: d.sp, speedName: speedName(d.sp), limit: d.li, mode: d.mo, paper: d.pa,
    cats: d.ca, supports: d.su, bank: d.b, replays: d.rp, top: d.t, topLps: d.tl, topName: d.tn, avgMs: d.am, items } };
}
/* Put the QR code for the online report into the report's QR box */
async function fillReportQR(sheet, r, name, cmp) {
  const box = sheet.querySelector('[data-qr]'); if (!box) return;
  try {
    const link = await reportLink(r, name, cmp);
    if (!window.QRCode) await loadScript('lib/qrcode.min.js');
    if (!sheet.contains(box)) return;          // the report was redrawn while this was getting ready
    box.innerHTML = ''; new window.QRCode(box, { text: link, width: 512, height: 512, correctLevel: window.QRCode.CorrectLevel.L });
    box.title = 'Scan to open this report online';
  } catch (e) { box.innerHTML = '<span class="rs-qrfail">This report is too long for a QR code. The emailed report has the link.</span>'; }
}

function reportLines(r) {
  const g = r.game || 'type', out = ['Game: ' + GAMES[g].name];
  if (g === 'ladder') out.push('Top speed: ' + (r.top === null ? 'none yet' : r.topLps + ' letters a second (' + r.topName + ')'));
  out.push('Score: ' + r.pct + '% (' + r.right + ' of ' + r.n + ')');
  if (CHOICE_GAMES.indexOf(g) < 0 && g !== 'flash' && !isNumGame(g)) out.push('Words right per minute: ' + r.wpm + ' (average ' + r.avgLen + ' letters a word)');
  if (g !== 'ladder') out.push('Speed: ' + r.speedName);
  if (isNumGame(g)) out.push((g === 'nquiz' ? 'Range: ' : 'Numbers: ') + r.cats);
  if (g === 'type' || g === 'fill' || g === 'pick') out.push('Letter limit: ' + (r.limit ? r.limit + ' or fewer' : 'No limit'));
  if (g === 'type') out.push('Mode: ' + (r.mode === 'clue' ? 'Category clue first' : 'Fingerspelling only'));
  out.push('Used paper: ' + (r.paper === 'yes' ? 'Yes' : 'No'));
  if (r.supports) out.push('Supports: ' + r.supports);
  if (orderList(r.items || []).length) out.push(orderLine(r.items, false));      // 3.90
  return out;
}
function reportText(r, name, link, cmp) {
  return ['ASL Fingerspelling Practice report', 'Name: ' + (name || '(no name)'), 'Date: ' + new Date(r.at).toLocaleString()].concat(reportLines(r), cmpLines(cmp, name, r),
    ['', 'Answers:'], r.items.map(x => (x.ok ? 'RIGHT  ' : 'MISSED ') + x.w + (x.ok ? '' : x.typed ? '  (answered ' + x.typed + ')' : '  (skipped)')),
    ['', 'Open this report online (teacher spreadsheets can read this link too):', link || dataCode(r, name)]).join('\n');
}

/* ---------- ASL Study 3.82 (Colleen): the diagnostic report. Inside the app the report reads like a standardized test report: the student on top,
   and below it how they compare with every student in their program level (ASL 1, ASL 2 ...) in all class periods (the app's api_fsCompare). ---------- */
const BANDS = [['Beginning', 'behind', 'below 20th'], ['Developing', 'near', '20th–39th'], ['Meeting', 'on', '40th–74th'], ['Exceeding', 'above', '75th and up']];
const bandOf = p => p < 20 ? 0 : p < 40 ? 1 : p < 75 ? 2 : 3;
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const CMP_NAMES = { letters: { top: 'Top Speed ladder speed', pct: '% right', perMin: 'Words right per minute', speed: 'Average speed (1–10)', minutes: 'Minutes practiced' },
  numbers: { pct: '% right', perMin: 'Numbers right per minute', speed: 'Average speed (1–10)', minutes: 'Minutes practiced' } };
const CMP_AREA = { top: 'speed', pct: 'accuracy', perMin: 'words a minute', minutes: 'practice time' };
const r1 = v => Math.round(v * 10) / 10;
const cmpVal = (k, v) => v === null || v === undefined ? '—' : k === 'top' ? r1(v).toFixed(1) + ' / sec' : k === 'pct' ? Math.round(v) + '%' : k === 'minutes' ? String(Math.round(v)) : String(r1(v));
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'This student';
const share = p => p >= 88 ? '9 in 10' : p >= 72 ? '3 in 4' : p >= 60 ? '2 in 3' : 'half of';
const standing = p => p >= 75 ? 'well above average' : p >= 60 ? 'above average' : p >= 40 ? 'about average' : p >= 20 ? 'a little below average' : 'below most of the class';
/* the plain-words summary and the next step, from the numbers (HTML with <b> for the report; the email takes the tags out) */
function cmpWords(d, name, r) {
  const first = firstName(name), L = d.level || 'the program', num = d.kind === 'numbers', ms = d.measures.filter(m => m.p !== null && m.p !== undefined);
  const core = ms.filter(m => m.core).sort((a, b) => b.p - a.p), best = core[0], worst = core[core.length - 1], mins = ms.find(m => m.k === 'minutes');
  const did = { top: 'reads fingerspelling faster than', pct: num ? 'reads numbers more accurately than' : 'reads fingerspelling more accurately than', perMin: num ? 'reads more numbers right a minute than' : 'reads more words right a minute than' };
  const detail = m => m.k === 'top' ? ' (top speed ' + cmpVal('top', m.me).replace(' / sec', '') + ' letters a second, ' + L + ' average ' + cmpVal('top', m.avg).replace(' / sec', '') + ')' : ' (' + cmpVal(m.k, m.me) + ', ' + L + ' average ' + cmpVal(m.k, m.avg) + ')';
  let sum = '';
  if (best && best.p >= 50) sum = first + ' ' + did[best.k] + ' about ' + share(best.p) + ' ' + L + ' students' + detail(best);
  else if (best) sum = first + '’s strongest area is ' + (num && best.k === 'perMin' ? 'numbers a minute' : CMP_AREA[best.k]) + ' (' + ordinal(best.p) + ' percentile' + detail(best).replace(' (', ': ');
  if (worst && worst !== best) sum += ' and is ' + standing(worst.p) + ' for ' + (num && worst.k === 'perMin' ? 'numbers a minute' : CMP_AREA[worst.k]) + '.';
  else if (sum) sum += '.';
  if (mins) sum += ' ' + first + (mins.p >= 75 ? ' practices more than most of the class.' : mins.p < 25 ? ' has practiced less than most of the class so far.' : ' practices about as much as the class.');
  const sp = Math.round((r.game === 'ladder' && r.top !== null && r.top !== undefined ? r.top : r.speed || 0) * 3), slower = SPEEDS[Math.max(0, sp - 1)], mix = mixList(r.items || []).slice(0, 2).map(x => x.right + '/' + x.saw);
  let next = '';
  if (!worst || worst.p >= 75) next = 'keep it up. ' + (num ? 'Try the <b>Numbers quiz</b> with a bigger range' : 'Try <b>Speed ladder</b> again and pass one more level, or try <b>Silent Letters &amp; Strange Spellings</b>') + ' for a challenge.';
  else if (worst.k === 'pct') next = 'accuracy is the area to grow. ' + (num ? 'Practice <b>Read the Number</b> at ' + slower + ' speed with a few numbers at a time' : mix.length ? 'Practice <b>Look-alike letters</b> (' + esc(mix.join(' and ')) + ' ' + (mix.length > 1 ? 'were' : 'was') + ' mixed up today) and <b>Read the word</b> at ' + slower + ' speed' : 'Practice <b>Read the word</b> at ' + slower + ' speed and watch a word again before you answer') + (worst.me !== null && worst.me >= 85 ? ' to keep % right above 85% while you speed up.' : ' to bring % right above 85%.');
  else if (worst.k === 'top') next = 'speed is the area to grow. Play <b>Speed ladder</b> a few times a week and try to pass one more level each time.';
  else next = (num ? 'numbers a minute' : 'words a minute') + ' is the area to grow. Play ' + (num ? '<b>Read the Number</b>' : '<b>Read the word</b>') + ' at a speed you get mostly right, and answer a little faster each round.';
  if (mins && mins.p < 25 && (!worst || worst.k !== 'minutes')) next += ' More practice time will help too: a few short rounds (5 to 10 minutes) each week.';
  return { sum, next: '<b>Next step:</b> ' + next };
}
/* 3.83 (Colleen: "so parents can see who's doing the work"): minutes spent, compared with the student's own class period, kept separate:
   all of ASL Study, fingerspelling, numbers. data.app = { cls, rows: [{ k, me, avg, n, p }] } from the app. */
const TIME_NAMES = { app: 'All of ASL Study (every activity)', fs: 'Fingerspelling games', num: 'Number games' };
/* the report bars are a percentile scale (Colleen: the graph must match the number): the line sits at the student's percentile, on the same four color zones as the Overall rating */
const pctAt = p => Math.max(1, Math.min(99, +p)).toFixed(0);
function timeHalf(d, name) {
  const a = d && d.app; if (!a || !a.rows || !a.rows.length) return '';
  const first = firstName(name), max = Math.max(1, ...a.rows.map(x => Math.max(x.me || 0, x.avg || 0))) * 1.3, at = v => Math.max(0, Math.min(98, 100 * v / max)).toFixed(0);
  const rows = a.rows.map(x => '<tr><td>' + esc(TIME_NAMES[x.k] || x.k) + '</td><td class="num"><b>' + x.me + ' min</b></td><td class="num">' + (x.avg === null ? '—' : x.avg + ' min') + '</td><td><div class="rs-bar">' +
    (x.p === null || x.p === undefined ? '' : '<span class="me" style="left:' + pctAt(x.p) + '%"></span>') + '</div></td><td class="num">' + (x.p === null ? '—' : '<span class="rs-pill p-' + BANDS[bandOf(x.p)][1] + '">' + ordinal(x.p) + '</span>') + '</td></tr>').join('');
  const all = a.rows.find(x => x.k === 'app'), line = all && all.p !== null ? first + ' has spent ' + all.me + ' minutes in ' + esc(STUDY.app || 'ASL Study') + ' so far, more than about ' + Math.round(all.p) + '% of ' + esc(a.cls) + ' (class average ' + all.avg + ' minutes).' : '';
  return '<h2 class="rs-h">Time Spent, Compared With ' + esc(a.cls) + ' (' + a.rows[0].n + ' Student' + (a.rows[0].n === 1 ? '' : 's') + ')</h2>' +
    '<table class="rs-cmp"><tr><th>Where</th><th>' + esc(first) + '</th><th>Class average</th><th>Where ' + esc(first) + ' falls</th><th>Percentile</th></tr>' + rows + '</table>' + (line ? '<p class="rs-sets">' + line + ' Time counts toward the class comparison only; it does not change the Overall rating.</p>' : '');
}
/* the comparison lines for the emailed report (Send to my teacher) */
function cmpLines(cmp, name, r) {
  if (!cmp || cmp.state !== 'ok' || !cmp.data || !cmp.data.me) return [];
  const d = cmp.data, L = d.level || 'all students', names = CMP_NAMES[d.kind] || CMP_NAMES.letters, out = ['', 'Compared with ' + L + ' (all classes, ' + d.n + ' student' + (d.n === 1 ? '' : 's') + '):'];
  d.measures.forEach(m => { if (m.me === null && m.avg === null) return; out.push(names[m.k] + ': ' + cmpVal(m.k, m.me) + ' (' + L + ' average ' + cmpVal(m.k, m.avg) + ')' + (m.p === null ? '' : ', ' + ordinal(m.p) + ' percentile')); });
  if (d.overall !== null) out.push('Overall: ' + d.band + ' (' + ordinal(d.overall) + ' percentile in ' + L + ')');
  if (d.small) out.push('Only ' + d.n + ' ' + L + ' student' + (d.n === 1 ? ' has' : 's have') + ' played ' + d.min + ' or more rounds so far, so this comparison is based on few students.');
  if (d.overall !== null) { const w = cmpWords(d, name, r || {}), plain = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); out.push(plain(w.sum), plain(w.next)); }
  if (d.app && d.app.rows) { out.push('', 'Time spent, compared with ' + d.app.cls + ' (' + d.app.rows[0].n + ' students):'); d.app.rows.forEach(x => out.push(TIME_NAMES[x.k] + ': ' + x.me + ' minutes (class average ' + (x.avg === null ? '—' : x.avg) + ')' + (x.p === null ? '' : ', ' + ordinal(x.p) + ' percentile'))); }
  return out;
}
/* the bottom half of the diagnostic report: compared with the program */
function cmpHalf(cmp, name, r) {
  const first = firstName(name), waitLevel = STUDY.level || 'program';
  if (!cmp || cmp.state === 'loading') return '<div class="rs-half"><p class="rs-wait">Loading the ' + esc(waitLevel) + ' comparison…</p></div>';
  if (cmp.state === 'error') return '<div class="rs-half"><p class="rs-note">' + esc(cmp.error) + '</p></div>';
  const d = cmp.data, L = d.level || 'all students', names = CMP_NAMES[d.kind] || CMP_NAMES.letters;
  if (!d.me) return '<div class="rs-half"><p class="rs-note">No saved ' + (d.kind === 'numbers' ? 'number' : 'fingerspelling') + ' rounds yet, so there is nothing to compare. Play at least ' + d.min + ' rounds here in ' + esc(STUDY.app || 'ASL Study') + ', then make your report again.</p></div>';
  const rows = d.measures.filter(m => m.me !== null || m.avg !== null).map(m => {
    const max = m.k === 'pct' ? 100 : m.k === 'speed' ? 10 : Math.max(m.me || 0, m.avg || 0, m.k === 'top' ? 1 : 0.5) * 1.3;
    const at = v => Math.max(0, Math.min(98, 100 * v / max)).toFixed(0);
    const bar = '<div class="rs-bar">' + (m.p === null || m.p === undefined ? '' : '<span class="me" style="left:' + pctAt(m.p) + '%"></span>') + '</div>';
    return '<tr><td>' + esc(names[m.k]) + '</td><td class="num"><b>' + esc(cmpVal(m.k, m.me)) + '</b></td><td class="num">' + esc(cmpVal(m.k, m.avg)) + '</td><td>' + bar + '</td><td class="num">' +
      (m.p === null ? '—' : '<span class="rs-pill p-' + BANDS[bandOf(m.p)][1] + '">' + ordinal(m.p) + '</span>') + '</td></tr>';
  }).join('');
  let out = '<div class="rs-half"><h2 class="rs-h">Compared With ' + esc(L) + ' (All Classes, ' + d.n + ' Student' + (d.n === 1 ? '' : 's') + ')</h2>' +
    (d.small ? '<p class="rs-small">Only ' + d.n + ' ' + esc(L) + ' student' + (d.n === 1 ? ' has' : 's have') + ' played ' + d.min + ' or more rounds so far, so this comparison is based on few students and may change a lot.</p>' : '') +
    (d.me.rounds < d.min ? '<p class="rs-small">' + esc(first) + ' has played ' + d.me.rounds + ' round' + (d.me.rounds === 1 ? '' : 's') + ' so far; the numbers settle down after a few more.</p>' : '') +
    '<table class="rs-cmp"><tr><th>Measure</th><th>' + esc(first) + '</th><th>' + esc(L) + ' average</th><th>Where ' + esc(first) + ' falls</th><th>Percentile</th></tr>' + rows + '</table>' + timeHalf(d, name);
  if (d.overall !== null) {
    const b = bandOf(d.overall), w = cmpWords(d, name, r);
    out += '<div class="rs-summary b-' + BANDS[b][1] + '"><p class="rs-verdict">Overall: ' + esc(d.band || BANDS[b][0]) + ' (' + ordinal(d.overall) + ' percentile in ' + esc(L) + ')</p>' +
      '<div class="rs-scale">' + BANDS.map((x, i) => '<span class="p-' + x[1] + (i === b ? ' on' : '') + '">' + x[0] + '<br>' + x[2] + '</span>').join('') + '</div>' +
      '<p>' + w.sum + '</p><p>' + w.next + '</p></div>';
  } else out += '<p class="rs-note">No other ' + esc(L) + ' students have played enough rounds to compare with yet.</p>';
  const core = d.kind === 'numbers' ? '% right and numbers right per minute' : 'top speed, % right and words right per minute';
  return out + '<p class="rs-foot">Averages and percentiles come from every ' + esc(L) + ' student’s running totals in ' + esc(STUDY.app || 'ASL Study') + ' as of this report (' + d.n + ' student' + (d.n === 1 ? '' : 's') + '; students with fewer than ' + d.min + ' rounds are left out). ' +
    'Percentile = the share of the other ' + esc(L) + ' students this student scored higher than; the line on each bar sits at that percentile (left = lowest, right = highest). Overall = the average of the percentiles for ' + core + '.' + (d.kind === 'numbers' ? '' : ' Letter flash is not counted.') + '</p></div>';
}
/* the report: one clean page with the student's name, and each number in its own box under a heading (Colleen). cmp (inside ASL Study only) makes it the diagnostic report. */
function reportSheet(r, name, cmp) {
  const g = r.game || 'type', when = new Date(r.at), mm = Math.floor(r.secs / 60), ss = r.secs % 60, time = mm + ':' + String(ss).padStart(2, '0');
  const box = (head, value, detail, main) => '<div class="rs-box' + (main ? ' main' : '') + '"><h3>' + esc(head) + '</h3><b>' + esc(value) + '</b>' + (detail ? '<span>' + esc(detail) + '</span>' : '') + '</div>';
  const unit = g === 'flash' ? 'letters' : 'words';
  // Results
  let results;
  if (g === 'ladder') results = box('Top speed', r.top === null ? '—' : r.topLps + ' / sec', r.top === null ? 'no level passed yet' : 'letters a second · ' + r.topName, true) + box('Words right', r.right + ' of ' + r.n) + box('Time', time);
  else if (g === 'flash') results = box('Score', r.pct + '%', r.right + ' of ' + r.n + ' letters right', true) + box('Average answer time', (r.avgMs / 1000).toFixed(1) + ' s', 'per letter') + box('Speed', r.speedName);
  else if (CHOICE_GAMES.indexOf(g) >= 0) results = box('Score', r.pct + '%', r.right + ' of ' + r.n + ' right', true) + box('Speed', r.speedName) + box('Time', time);
  else if (isNumGame(g)) results = box('Score', r.pct + '%', r.right + ' of ' + r.n + ' numbers right', true) + box('Speed', r.speedName) + box('Time', time);
  else results = box('Score', r.pct + '%', r.right + ' of ' + r.n + ' words right', true) + box('Words right per minute', r.wpm, r.avgLen ? 'average ' + r.avgLen + ' letters a word' : '') + box('Speed', r.speedName) + box('Time', time);
  if (r.replays) results += box('Watched again', r.replays, r.replays === 1 ? 'time' : 'times');
  // Settings
  const kind = r.bank === 'everyday' ? 'Everyday words' : r.bank === 'proper' ? 'Names & fingerspelled words' : '';
  const sets = [];
  if (kind) sets.push(['Word type', kind]);
  if (g === 'type' || g === 'fill' || g === 'pick' || g === 'ladder') sets.push(['Letter limit', r.limit ? r.limit + ' or fewer' : 'No limit']);
  if (g === 'type') sets.push(['Mode', r.mode === 'clue' ? 'Category clue first' : 'Fingerspelling only']);
  if (g === 'pairs') sets.push(['Letters', r.cats]);
  if (g === 'sound') sets.push(['Levels', String(r.cats).replace(/^Levels /, '')]);
  if (g === 'tricky') sets.push(['Levels', String(r.cats)]);
  if (g === 'flash') sets.push(['Letters', r.cats]);
  if (isNumGame(g)) { const c = String(r.cats).split(' · '); sets.push([g === 'nquiz' ? 'Range' : 'Numbers', c[0]]); c.slice(1).forEach(x => { const k = x.indexOf(': '); sets.push([x.slice(0, k), x.slice(k + 2)]); }); }
  sets.push(['Used paper', r.paper === 'yes' ? 'Yes' : 'No']);
  sets.push(['Supports', r.supports || 'None']);
  const settings = sets.map(x => box(x[0], x[1])).join('');
  const mix = mixList(r.items);
  const mixBox = mix.length ? '<div class="rs-box wide"><h3>Letters Mixed Up</h3><p class="rs-mix">' + mix.slice(0, 6).map(x => '<span><b>' + esc(x.right) + '</b> read as <b>' + esc(x.saw) + '</b>' + (x.times > 1 ? ' (' + x.times + '×)' : '') + '</span>').join('') + '</p></div>' : '';
  const bottom = '<div class="rs-bottom">' +
      '<div class="rs-box wide"><h3>' + (g === 'flash' ? 'Letters' : isNumGame(g) ? 'Numbers' : 'Words') + ' (' + r.right + ' of ' + r.n + ' Right)</h3>' +
        '<ol class="rs-words">' + r.items.map(x => '<li class="' + (x.ok ? 'ok' : 'no') + '">' + esc(showW(x.w)) + (x.ok ? '' : ' <span class="typed">' + (x.typed ? '(' + esc(x.typed) + ')' : '(skipped)') + '</span>') + '</li>').join('') + '</ol></div>' +
      '<div class="rs-box rs-qrbox"><h3>Online Report</h3><div class="rs-qr" data-qr><span class="rs-qrfail">Making the QR code…</span></div><span>Scan to open this report on a phone or computer.</span></div>' +
    '</div>';
  /* every report uses the diagnostic design (Colleen: "i don't want any report to use the old look"); outside ASL Study there is no class to compare with, so the bottom half is left off */
  // the diagnostic report (inside ASL Study)
  const num = isNumGame(g), d = cmp && cmp.state === 'ok' ? cmp.data : null, first = firstName(name);
  if (g === 'ladder') results = box('Top speed', r.top === null ? '—' : r.topLps + ' / sec', r.top === null ? 'no level passed yet' : 'letters a second · ' + r.topName, true) + box('Words right', r.right + ' of ' + r.n, r.pct + '% right') +
    box('Words right per minute', r.wpm, r.avgLen ? 'average ' + r.avgLen + ' letters a word' : '') + box('Time', time, r.replays ? 'watched again ' + r.replays + ' time' + (r.replays === 1 ? '' : 's') : '');
  const wt = sets.find(x => x[0] === 'Word type' || x[0] === 'Numbers' || x[0] === 'Range' || x[0] === 'Letters' || x[0] === 'Levels');
  const info = (lab, v) => '<div><small>' + esc(lab) + '</small>' + esc(v || '—') + '</div>';
  const rest = sets.filter(x => x !== wt).map(x => esc(x[0]) + ': <b>' + esc(x[1]) + '</b>').join(' · ');
  let sofar = '';
  if (d && d.me) {
    const m = k => d.measures.find(x => x.k === k) || {}, t = new Date(), today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    sofar = '<h2 class="rs-h">All of ' + esc(first) + '’s ' + (num ? 'Number Practice' : 'Fingerspelling') + ' So Far</h2><div class="rs-boxes four">' +
      box('Rounds', d.me.rounds, d.me.answered + (num ? ' numbers' : ' words') + ' answered') + box('% right', cmpVal('pct', m('pct').me), num ? 'all number games' : 'all games') +
      box('Average speed', cmpVal('speed', m('speed').me), 'on a 1–10 scale') + box('Minutes practiced', cmpVal('minutes', m('minutes').me), d.me.last ? 'last played ' + (d.me.last === today ? 'today' : d.me.last) : '') + '</div>';
  }
  return '<div class="rs-diag"><div class="rs-head"><div><div class="rs-kicker">' + (cmp ? esc(STUDY.app || 'ASL Study') + ' · ' + (num ? 'Numbers' : 'Fingerspelling') + ' Diagnostic' : 'ASL Fingerspelling Practice · ' + (num ? 'Numbers' : 'Fingerspelling')) + ' · Report</div><h1 class="rs-name' + (name ? '' : ' empty') + '">' + esc(name || 'Your name') + '</h1></div>' +
    '<div class="rs-date">' + esc(when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) + '<br>' + esc(when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</div></div>' +
    '<h2 class="rs-h">' + (cmp ? 'Student' : 'Round') + '</h2><div class="rs-info">' + (cmp ? info('Class', (d && d.cls) || STUDY.cls) + info('Program level', d ? d.level : cmp.state === 'loading' ? '…' : STUDY.level) : info('Speed', r.speedName) + info('Used paper', r.paper === 'yes' ? 'Yes' : 'No')) + info('Activity', GAMES[g].name) + info(wt ? wt[0] : 'Word type', wt ? wt[1] : '') + '</div>' +
    '<h2 class="rs-h">Today’s Results</h2><div class="rs-boxes four">' + results + '</div>' +
    (rest ? '<p class="rs-sets">Settings: ' + rest + '</p>' : '') +
    (mix.length ? '<p class="rs-sets">Letters mixed up: ' + mix.slice(0, 6).map(x => '<b>' + esc(x.right) + '</b> read as <b>' + esc(x.saw) + '</b>' + (x.times > 1 ? ' (' + x.times + '×)' : '')).join(' · ') + '</p>' : '') + (orderList(r.items).length ? '<p class="rs-sets">' + orderLine(r.items, true) + '</p>' : '') + bottom + (cmp ? sofar + cmpHalf(cmp, name, r) : '') + '</div>';
}
/* "My report" (Colleen: students can always open their current report compared with others): inside ASL Study, #/report/now (or /numbers)
   shows the student's running totals and the program comparison, without a round. */
function standingSheet(kind, name, cmp) {
  const num = kind === 'numbers', d = cmp && cmp.state === 'ok' ? cmp.data : null, first = firstName(name), when = new Date();
  const box = (head, value, detail) => '<div class="rs-box"><h3>' + esc(head) + '</h3><b>' + esc(value) + '</b>' + (detail ? '<span>' + esc(detail) + '</span>' : '') + '</div>';
  const info = (lab, v) => '<div><small>' + esc(lab) + '</small>' + esc(v || '—') + '</div>';
  let sofar = '';
  if (d && d.me) {
    const m = k => d.measures.find(x => x.k === k) || {}, top = m('top');
    sofar = '<h2 class="rs-h">All of ' + esc(first) + '’s ' + (num ? 'Number Practice' : 'Fingerspelling') + ' So Far</h2><div class="rs-boxes four">' +
      box('Rounds', d.me.rounds, d.me.answered + (num ? ' numbers' : ' words') + ' answered') + box('% right', cmpVal('pct', m('pct').me), num ? 'all number games' : 'all games') +
      (num ? box('Numbers right a minute', cmpVal('perMin', m('perMin').me), '') : box('Top Speed ladder', cmpVal('top', top.me), top.me ? 'letters a second' : 'play Speed ladder to add this')) +
      box('Minutes practiced', cmpVal('minutes', m('minutes').me), d.me.last ? 'last played ' + d.me.last : '') + '</div>';
  }
  const r = { game: num ? 'numbers' : '', items: [], speed: d && d.me ? Math.max(0, ((d.measures.find(x => x.k === 'speed') || {}).me || 1) - 1) / 9 : 0 };
  return '<div class="rs-diag"><div class="rs-head"><div><div class="rs-kicker">' + esc(STUDY.app || 'ASL Study') + ' · ' + (num ? 'Numbers' : 'Fingerspelling') + ' Progress · Report</div><h1 class="rs-name' + (name ? '' : ' empty') + '">' + esc(name || 'Your name') + '</h1></div>' +
    '<div class="rs-date">' + esc(when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) + '<br>' + esc(when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</div></div>' +
    '<h2 class="rs-h">Student</h2><div class="rs-info">' + info('Class', (d && d.cls) || STUDY.cls) + info('Program level', d ? d.level : STUDY.level) + info('Report', 'Where I stand now') + info('Counts', num ? 'All number games' : 'All fingerspelling games but Letter flash') + '</div>' +
    sofar + cmpHalf(cmp, name, r) + '</div>';
}
function reportShow() {
  const nowKind = EMBED && /^#\/report\/(now|numbers)$/.test(location.hash) ? (/numbers$/.test(location.hash) ? 'numbers' : 'letters') : '';
  const pick = $('#rp-kind'); if (pick) { pick.hidden = !nowKind || !!ONLY;      /* one product: no switch to the other one's report (Colleen) */ pick.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.k === nowKind)); }
  if (nowKind) return standingShow(nowKind);
  const r = store.get('last', null);
  $('#rp-name').value = store.get('name', ''); $('#rp-email').value = store.get('teacher', ''); $('#rp-need').hidden = true;
  if (EMBED && STUDY.name) { $('#rp-name').value = STUDY.name; $('#rp-name').readOnly = true; }      // 3.82: inside ASL Study the name comes from the student's sign-in
  if (EMBED && r && (!CMP || CMP.at !== r.at || CMP.state === 'error')) {      // 3.82: ask the app for the program comparison for this round's kind
    const kind = isNumGame(r.game) ? 'numbers' : 'letters', want = { kind, at: r.at, state: 'loading' }; CMP = want;
    try { window.parent.postMessage({ type: 'fsp-compare', kind }, '*'); } catch (e) {}
    setTimeout(() => { if (CMP === want && want.state === 'loading') { want.state = 'error'; want.error = 'The comparison did not load. Try making the report again in a minute.'; if (location.hash === '#/report' && reportRedraw) reportRedraw(); } }, 30000);
  }
  const draw = () => {
    const name = $('#rp-name').value.trim();
    $('#rp-sheet').innerHTML = r ? reportSheet(r, name, EMBED ? CMP : null) : '<p>Play a round first, then make your report here.</p>';
    if (r) fillReportQR($('#rp-sheet'), r, name, EMBED ? CMP : null);
  };
  reportRedraw = draw;
  draw();
  $('#rp-name').oninput = () => { store.set('name', $('#rp-name').value.trim()); $('#rp-need').hidden = true; draw(); };
  $('#rp-email').oninput = () => store.set('teacher', $('#rp-email').value.trim());
  const named = () => { if ($('#rp-name').value.trim()) return true; $('#rp-need').hidden = false; $('#rp-name').focus(); return false; };
  const parts = async () => { const name = $('#rp-name').value.trim(); return { to: $('#rp-email').value.trim(), su: 'Fingerspelling practice: ' + name + (r ? ' - ' + GAMES[r.game || 'type'].name + ' ' + (r.game === 'ladder' && r.top !== null ? r.topLps + ' letters a second' : r.pct + '%') : ''), body: r ? reportText(r, name, await reportLink(r, name, EMBED ? CMP : null), EMBED ? CMP : null) : '' }; };
  /* inside ASL Study (Colleen): the app knows the teacher and sends the report itself; the email box and "your email app" are not needed */
  $('#rp-email').closest('.field').hidden = EMBED; $('#rp-mailto').hidden = EMBED; $('#rp-mail').textContent = EMBED ? 'Send to my teacher' : 'Email to my teacher';
  if (EMBED && !$('#rp-name').value && STUDY.name) $('#rp-name').value = STUDY.name;
  if (EMBED) { $('#rp-mail').onclick = async () => { if (!r || !named()) return; const p = await parts(); const b = $('#rp-mail'); b.disabled = true; const m = $('#rp-sent'); m.hidden = false; m.className = 'alert'; m.textContent = 'Sending…'; m.textContent = 'Making the picture of your report…'; const img = await sheetPicture($('#rp-sheet')); if (!img) { b.disabled = false; m.className = 'alert bad'; m.textContent = 'The picture of your report could not be made. Wait a moment and tap Send again.'; return; } m.textContent = 'Sending…'; try { window.parent.postMessage({ type: 'fsp-report', subject: p.su, text: p.body, img }, '*'); } catch (e) { b.disabled = false; } }; }
  else $('#rp-mail').onclick = async () => { if (!r || !named()) return; const tab = window.open('', '_blank'); const p = await parts(); const url = 'https:' + '//mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(p.to) + '&su=' + encodeURIComponent(p.su) + '&body=' + encodeURIComponent(p.body); if (tab) { tab.opener = null; tab.location.href = url; } else window.open(url, '_blank', 'noopener'); };
  $('#rp-mailto').onclick = async e => { e.preventDefault(); if (!r || !named()) return; const p = await parts(); location.href = 'mailto:' + encodeURIComponent(p.to) + '?subject=' + encodeURIComponent(p.su) + '&body=' + encodeURIComponent(p.body); };
  $('#rp-print').onclick = () => {
    if (!r || !named()) return;
    document.body.classList.add('printing-report');
    const done = () => { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50); setTimeout(done, 60000);
  };
}

function standingShow(kind) {
  const name = STUDY.name || store.get('name', '');
  $('#rp-name').value = name; $('#rp-name').readOnly = true; $('#rp-need').hidden = true;
  $('#rp-email').closest('.field').hidden = true; $('#rp-mailto').hidden = true; $('#rp-mail').textContent = 'Send to my teacher';
  if (!CMP || CMP.at !== 'now-' + kind || CMP.state === 'error') {
    const want = { kind, at: 'now-' + kind, state: 'loading' }; CMP = want;
    try { window.parent.postMessage({ type: 'fsp-compare', kind }, '*'); } catch (e) {}
    setTimeout(() => { if (CMP === want && want.state === 'loading') { want.state = 'error'; want.error = 'The comparison did not load. Try again in a minute.'; if (reportRedraw) reportRedraw(); } }, 30000);
  }
  const draw = () => { $('#rp-sheet').innerHTML = standingSheet(kind, name, CMP); };
  reportRedraw = draw; draw();
  $('#rp-mail').onclick = async () => {
    if (!CMP || CMP.state !== 'ok') return;
    const lines = [(kind === 'numbers' ? 'Numbers' : 'Fingerspelling') + ' progress report: where I stand now', 'Name: ' + name, 'Date: ' + new Date().toLocaleString()].concat(cmpLines(CMP, name, { game: kind === 'numbers' ? 'numbers' : '', items: [] }));
    const b = $('#rp-mail'); b.disabled = true; const m = $('#rp-sent'); m.hidden = false; m.className = 'alert'; m.textContent = 'Sending…';
    m.textContent = 'Making the picture of your report…'; const img = await sheetPicture($('#rp-sheet'));
    if (!img) { b.disabled = false; m.className = 'alert bad'; m.textContent = 'The picture of your report could not be made. Wait a moment and tap Send again.'; return; }
    m.textContent = 'Sending…';
    try { window.parent.postMessage({ type: 'fsp-report', subject: (kind === 'numbers' ? 'Numbers' : 'Fingerspelling') + ' progress report: ' + name + (CMP.data.band ? ' - ' + CMP.data.band : ''), text: lines.join('\n'), img }, '*'); } catch (e) { b.disabled = false; }
  };
  $('#rp-print').onclick = () => { document.body.classList.add('printing-report'); const done = () => { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50); setTimeout(done, 60000); };
}

/* Send to my teacher (Colleen: the teacher opens the email and sees the whole report, not an attachment): a picture of the report sheet as shown,
   made here with html2canvas (cdnjs, loaded the first time), goes with the text; ASL Study puts the picture in the body of the email. */
let snapLib = null;
const snapLoad = () => snapLib || (snapLib = new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'lib/html2canvas.min.js'; sc.onload = ok; sc.onerror = () => { snapLib = null; bad(new Error('no picture')); }; document.head.appendChild(sc); }));
/* wait until the report is complete before the picture (Colleen: "today's batch didn't have all the info"): the class comparison and the QR code arrive a few seconds after the page */
async function sheetReady(el) {
  const until = Date.now() + 20000, wait = ms => new Promise(r => setTimeout(r, ms));
  while (Date.now() < until && ((CMP && CMP.state === 'loading') || [...el.querySelectorAll('.rs-qrfail')].some(x => /Making/.test(x.textContent)) || el.querySelector('.rs-wait'))) await wait(250);
  await wait(400);
}
async function sheetPicture(el) {
  try { await snapLoad(); await sheetReady(el); const cv = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 900 });
    const max = 1700; let out = cv; if (cv.width > max) { out = document.createElement('canvas'); out.width = max; out.height = Math.round(cv.height * max / cv.width); out.getContext('2d').drawImage(cv, 0, 0, out.width, out.height); }
    return out.toDataURL('image/jpeg', 0.9); } catch (e) { return ''; }      // no picture: the student is asked to try again
}

/* ---------- the online report (opened from a report's QR code or link) ---------- */
async function viewShow() {
  const code = location.hash.replace(/^#\/?view\/?/, ''), sheet = $('#vw-sheet');
  sheet.innerHTML = '<p>Opening the report…</p>';
  let got = null;
  try { got = await readReportCode(code); } catch (e) { got = null; }
  if (!got) { sheet.innerHTML = '<p>This report link is not complete. Ask the student to send it again, or scan the QR code on the printed report.</p>'; return; }
  if (got.app && !STUDY.app) STUDY.app = got.app;
  sheet.innerHTML = reportSheet(got.r, got.name, got.cmp);
  fillReportQR(sheet, got.r, got.name, got.cmp);
  $('#vw-print').onclick = () => {
    document.body.classList.add('printing-report');
    const done = () => { document.body.classList.remove('printing-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50); setTimeout(done, 60000);
  };
}

/* ---------- progress ---------- */
function progressShow() {
  const all = store.get('sessions', []).filter(s => !s.review);
  if (!all.length) { $('#g-body').innerHTML = '<p>No rounds yet. <a href="#/games">Play one</a> and your totals show up here.</p>'; return; }
  const wordGames = all.filter(s => ['type', 'sound', 'tricky', 'pick', 'fill', 'ladder'].indexOf(s.game || 'type') >= 0);
  const words = wordGames.flatMap(s => s.items.map(x => Object.assign({ sp: speedName(x.speed !== undefined ? x.speed : s.speed) }, x)));
  const tot = words.length, right = words.filter(x => x.ok).length;
  const table = (title, list, keyOf, order) => {
    const g = {}; list.forEach(x => { const k = keyOf(x); if (!k) return; (g[k] = g[k] || [0, 0]); g[k][0]++; if (x.ok) g[k][1]++; });
    const keys = (order || Object.keys(g).sort()).filter(k => g[k]); if (!keys.length) return '';
    return '<h3>' + title + '</h3><table class="t"><tr><th></th><th>Tries</th><th>Right</th><th></th></tr>' + keys.map(k => { const p = Math.round(g[k][1] / g[k][0] * 100); return '<tr><td>' + esc(k) + '</td><td>' + g[k][0] + '</td><td>' + p + '%</td><td><div class="bar"><i style="width:' + p + '%"></i></div></td></tr>'; }).join('') + '</table>';
  };
  const ladders = all.filter(s => s.game === 'ladder' && s.top !== null && s.top !== undefined), best = ladders.reduce((m, s) => Math.max(m, s.topLps), 0);
  const games = {}; all.forEach(s => { const k = GAMES[s.game || 'type'].name; games[k] = (games[k] || 0) + 1; });
  const mix = mixList(all.flatMap(s => s.items));
  $('#g-body').innerHTML = '<div class="stats">' + (tot ? statBox(Math.round(right / tot * 100) + '%', 'words right overall') + statBox(tot, 'words read') : '') + statBox(all.length, 'rounds') + (best ? statBox(best, 'top speed (letters a second)') : '') + '</div>' +
    (mix.length ? '<h3>Letters You Mix Up Most</h3><p>' + mix.slice(0, 10).map(m => '<b>' + m.right + '</b> read as <b>' + m.saw + '</b> (' + m.times + '×)').join(' · ') + '</p>' : '') +
    (ladders.length ? '<h3>Speed Ladder</h3><table class="t"><tr><th>Date</th><th>Top speed</th><th>Letters a second</th></tr>' + ladders.slice(-10).reverse().map(s => '<tr><td>' + esc(new Date(s.at).toLocaleDateString()) + '</td><td>' + esc(s.topName) + '</td><td>' + s.topLps + '</td></tr>').join('') + '</table>' : '') +
    table('By word length', words, x => lenGroup(x.n) + ' letters', LEN_GROUPS.map(g => (g[1] === 99 ? g[0] + '+' : g[0] + '–' + g[1]) + ' letters')) +
    table('By speed', words, x => x.sp, SPEEDS) + table('By category', words.filter(x => x.c && !/^LEVEL/.test(x.c)), x => niceCat(x.c)) +
    table('Letter flash', all.filter(s => s.game === 'flash').flatMap(s => s.items), x => x.w) +
    table('Numbers', all.filter(s => isNums(s.game)).flatMap(s => s.items), x => x.w, NUMS) +
    '<h3>Games Played</h3><table class="t">' + Object.keys(games).map(k => '<tr><td>' + esc(k) + '</td><td>' + games[k] + ' rounds</td></tr>').join('') + '</table>' +
    '<h3>Recent Rounds</h3><table class="t"><tr><th>Date</th><th>Game</th><th>Score</th><th>Speed</th></tr>' + all.slice(-10).reverse().map(s => '<tr><td>' + esc(new Date(s.at).toLocaleDateString()) + '</td><td>' + esc(GAMES[s.game || 'type'].name) + '</td><td>' + (s.game === 'ladder' ? (s.topLps || 0) + ' l/s' : s.pct + '%') + '</td><td>' + esc(s.speedName) + '</td></tr>').join('') + '</table>';
}
$('#g-reset').onclick = () => { if (confirm('Clear all your progress on this device? This cannot be undone.')) { store.set('sessions', []); store.set('last', null); progressShow(); } };

/* ---------- alphabet chart ---------- */
const ARROW = { J: '<path d="M30 18 C 30 60, 34 80, 55 82 C 70 83, 78 72, 80 62" />', Z: '<path d="M78 20 L 24 20 L 76 56 L 22 56" />' };
let chartDone = false;
async function chartShow() {
  if (chartDone) return;
  await hand.ready;
  const tone = hand.tone; hand.setTone(S.tone === 'random' ? hand.TONES[3] : toneHex());
  $('#c-grid').innerHTML = hand.letters.split('').map(c => '<button class="t" data-l="' + c + '" aria-label="Letter ' + c + (ARROW[c] ? ', moves' : '') + '"><span class="L">' + c + '</span><img alt="" src="' + hand.chartImage(c) + '">' +
    (ARROW[c] ? '<svg class="arr" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="ah' + c + '" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c2410c" stroke="none"/></marker></defs>' + ARROW[c].replace('/>', ' marker-end="url(#ah' + c + ')"/>') + '</svg>' : '') + '</button>').join('');
  hand.setTone(tone); chartDone = true;
  $('#c-grid').onclick = e => { const b = e.target.closest('button'); if (!b) return; location.hash = '#/letter/' + b.dataset.l; };
}
$('#c-print').onclick = () => window.print();

/* ---------- word lists typed, pasted or uploaded by a teacher (projector mode and Bingo) ---------- */
function cleanList(raw) {
  const seen = new Set(), out = []; let numbers = 0;
  raw.forEach(x => { const w = String(x === undefined || x === null ? '' : x).replace(/\s+/g, ' ').trim(); if (!w || !/[a-z]/i.test(w)) return; if (/[0-9]/.test(w)) { numbers++; return; } const k = letters(w); if (seen.has(k)) return; seen.add(k); out.push(w); });
  if (out.length && /^(words?|english|terms?|vocab(ulary)?)$/i.test(out[0])) out.shift();      // a heading row
  return { words: out, numbers };
}
function splitText(t) { return t.indexOf('\n') >= 0 ? t.split(/\r?\n/).map(l => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0].replace(/^"|"$/g, '')) : t.split(/[,;\t]/); }
function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
function wordList(el, key, onChange) {
  el.innerHTML = '<label class="lab">Your words <span class="msg">(one per line, or paste a column from a spreadsheet)</span><textarea spellcheck="false"></textarea></label>' +
    '<div class="row"><label class="btn ghost">Upload a spreadsheet<input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" hidden></label><span class="msg count"></span></div>';
  const ta = el.querySelector('textarea'), msg = el.querySelector('.count'), file = el.querySelector('input[type=file]');
  ta.value = store.get('list.' + key, '');
  const update = () => { const c = cleanList(splitText(ta.value)); store.set('list.' + key, ta.value); msg.textContent = c.words.length + ' words' + (c.numbers ? ' (' + c.numbers + ' with numbers left out: the hand cannot sign numbers yet)' : '') + '.'; if (onChange) onChange(c.words); return c.words; };
  ta.oninput = update;
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      let words;
      if (/\.xlsx?$/i.test(f.name)) {
        if (!window.XLSX) await loadScript('lib/xlsx.full.min.js');
        const wb = window.XLSX.read(await f.arrayBuffer(), { type: 'array' }), sh = wb.Sheets[wb.SheetNames[0]];
        words = window.XLSX.utils.sheet_to_json(sh, { header: 1 }).map(r => r[0]);
      } else words = splitText(await f.text());
      ta.value = cleanList(words).words.join('\n'); update();
    } catch (e) { msg.textContent = 'That file could not be read. Try saving it as .csv, or copy the words and paste them here.'; }
    file.value = '';
  };
  update();
  return { get: () => cleanList(splitText(ta.value)).words, update };
}

/* ---------- Show me how to spell: any word typed in ---------- */
function showInit() {
  S.showLetters = S.showLetters || 'off';      // starts off (Colleen)
  const word = $('#sh-word');
  word.value = store.get('showWord', '');
  const go = () => {
    const w = word.value.trim(); if (!w) { word.focus(); return; }
    store.set('showWord', w);
    const skipped = w.replace(/['\u2019.\-\s]/g, '').replace(/[a-z]/gi, '');
    $('#sh-note').textContent = /[0-9]/.test(w) ? 'Numbers are skipped: the hand spells letters only for now.' : skipped ? 'Symbols like ' + skipped.slice(0, 3) + ' are skipped.' : '';
    spellWord(w);
  };
  $('#sh-go').onclick = go; $('#sh-again').onclick = go;
  word.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  $('#sh-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
  segInit('sh-assist', 'showLetters', () => { assist.className = 'assist' + (S.showLetters === 'off' ? '' : ' ' + S.showLetters); });
  const tones = $('#sh-tones');
  tones.innerHTML = hand.TONES.map((t, i) => '<button class="sw" data-t="' + i + '" aria-label="Skin tone ' + (i + 1) + '" style="background:#' + t.toString(16).padStart(6, '0') + '"></button>').join('') + '<button class="rnd" data-t="random">Random</button>';
  const markT = () => tones.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === S.tone));
  tones.onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tone = b.dataset.t; saveS(); markT(); if (S.tone !== 'random') hand.ready.then(() => hand.setTone(toneHex())); };
  showInit.markT = markT; markT();
}
function showShow() {
  putStage('show-slot'); speedNow = () => S.speed;
  assist.className = 'assist' + (S.showLetters === 'off' ? '' : ' ' + S.showLetters);
  $('#sh-speed').value = Math.round(S.speed * 100); showInit.markT();
  setTimeout(() => $('#sh-word').focus(), 50);
  const q = decodeURIComponent((location.hash.split('/')[2] || '')).trim();      // a link like #/show/Colleen spells that word
  if (q) { $('#sh-word').value = q; spellWord(q); }
}

/* AGES (Colleen): the lower face behind the hand, drawn flat like her picture; its colors come from the hand's skin tone */
const mixHex = (a, b, k) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = i => Math.round(((x >> i) & 255) * (1 - k) + ((y >> i) & 255) * k); return '#' + [16, 8, 0].map(i => c(i).toString(16).padStart(2, '0')).join(''); };
/* the hand's skin as it looks on screen for each of the 7 tones (sampled from the rendered palm), so the face matches the hand */
const FACE_TONE = { '#c68c6c': '#e5bc9d', '#b27c5e': '#ddad8d', '#9c6a4f': '#d39e7d', '#87593f': '#c78f6e', '#6c4632': '#af7a60', '#513224': '#8e6150', '#3d251a': '#745246' };      /* from the rendered back of the hand and fingers, a little lighter (the palm was used before, so darker hands got a face far too light; found in the skin tone check) */
const FACE_CHIN_Y = 233, FACE_SCALE = 0.555;      /* the bottom of the chin where the fingertip lands; Colleen chose the soft, shaded face (style 2), a little bigger */
/* a shaded face (Colleen: "it doesn't look like it's part of the same person as the hand because it's so flat"): soft light and shadow like the
   3D hand, a nose, the groove above the lip, full lips with a soft shine, a rounded chin, a shaded neck, a faint skin texture; all from the hand's color */
function faceSvg(tone) {
  /* painted after the photo Colleen chose as the look (not copied): one soft wide curve from cheek to chin, only the round bottom of the nose,
     bright in the middle and shadowed at the sides, a deep soft shadow under the jaw, coral glossy lips, a wide neck and shoulders */
  const skin = mixHex(mixHex(FACE_TONE[tone] || mixHex(tone, '#ffffff', 0.45), tone, 0.15), '#f2a27e', 0.1), L = (parseInt(skin.slice(1, 3), 16) * 0.3 + parseInt(skin.slice(3, 5), 16) * 0.59 + parseInt(skin.slice(5, 7), 16) * 0.11) / 255, hi = mixHex(skin, '#fff6ee', 0.08 + 0.26 * L * L), lite = mixHex(skin, '#fff6ee', 0.04 + 0.12 * L * L);      /* darker skin gets a softer shine, so the face stays the same color as the hand */
  const shade = mixHex(skin, tone, 0.42), deep = mixHex(skin, '#4a2216', 0.42), dark = mixHex(skin, '#2a1209', 0.55);
  const lipTop = mixHex(mixHex(skin, '#c4584a', 0.5 * L + 0.1), tone, 0.12 + 0.3 * (1 - L)), lipLow = mixHex(mixHex(skin, '#d4705e', 0.48 * L + 0.08), tone, 0.25 * (1 - L)), line = mixHex(lipTop, '#2a120c', 0.42);
  const bl = (id, sd) => '<filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  const E = (cx, cy, rx, ry, c, o, f, rot) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + c + '" opacity="' + o + '" filter="url(#' + f + ')"' + (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + '/>';
  const P = (d, c, w, o, f) => '<path d="' + d + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round" opacity="' + o + '"' + (f ? ' filter="url(#' + f + ')"' : '') + '/>';
  const NECK = 'M200 380 C 205 640, 214 760, 165 850 C 320 905, 680 905, 835 850 C 786 760, 795 640, 800 380 Z';
  const FACE = 'M-90 -1400 C -110 -700, -100 -250, -40 20 C 30 280, 230 482, 500 482 C 770 482, 970 280, 1040 20 C 1100 -250, 1110 -700, 1090 -1400 Z';      /* one soft curve from cheek to chin */
  return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>' +
    '<radialGradient id="fr" gradientUnits="userSpaceOnUse" cx="480" cy="40" r="640"><stop offset="0" stop-color="' + hi + '"/><stop offset=".45" stop-color="' + lite + '"/><stop offset=".78" stop-color="' + skin + '"/><stop offset="1" stop-color="' + shade + '"/></radialGradient>' +
    '<linearGradient id="ng" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + mixHex(skin, shade, 0.75) + '"/><stop offset=".3" stop-color="' + mixHex(skin, shade, 0.25) + '"/><stop offset=".62" stop-color="' + mixHex(skin, shade, 0.25) + '"/><stop offset="1" stop-color="' + mixHex(skin, shade, 0.75) + '"/></linearGradient>'      /* the neck close to the face color (Colleen: a big color difference between the head and neck) */ +
    '<radialGradient id="sh" gradientUnits="userSpaceOnUse" cx="480" cy="1000" r="1500"><stop offset="0" stop-color="' + lite + '"/><stop offset=".5" stop-color="' + skin + '"/><stop offset="1" stop-color="' + shade + '"/></radialGradient>' +
    '<linearGradient id="nf" gradientUnits="userSpaceOnUse" x1="0" y1="420" x2="0" y2="2500"><stop offset="0" stop-color="#fff"/><stop offset=".85" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<mask id="nm" maskUnits="userSpaceOnUse" x="-3000" y="380" width="7000" height="2400"><rect x="-3000" y="380" width="7000" height="2400" fill="url(#nf)"/></mask>' +
    '<clipPath id="fc"><path d="' + FACE + '"/></clipPath>' +
    '<clipPath id="nc"><path d="' + NECK + '"/></clipPath>' +
    '<linearGradient id="lt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + lipTop + '"/><stop offset="1" stop-color="' + mixHex(lipTop, '#000000', 0.2) + '"/></linearGradient>' +
    '<radialGradient id="ll" cx="45%" cy="38%" r="68%"><stop offset="0" stop-color="' + mixHex(lipLow, '#ffffff', 0.12) + '"/><stop offset=".7" stop-color="' + lipLow + '"/><stop offset="1" stop-color="' + mixHex(lipLow, '#000000', 0.16) + '"/></radialGradient>' +
    bl('b4', 4) + bl('b8', 8) + bl('b16', 16) + bl('b30', 30) + bl('b60', 60) + bl('b90', 90) +
    '</defs><g transform="translate(500 ' + FACE_CHIN_Y + ') scale(' + FACE_SCALE + ') translate(-500 -482)">' +
    /* shoulders and a wide neck */
    '<g mask="url(#nm)"><path d="M200 380 C 205 640, 214 770, 120 860 C -40 945, -700 975, -1500 1130 L -1500 2700 L 2500 2700 L 2500 1130 C 1700 975, 1040 945, 880 860 C 786 770, 795 640, 800 380 Z" fill="' + mixHex(skin, shade, 0.25) + '"/>' +
    '<path d="' + NECK + '" fill="url(#ng)"/>' +
    '<g clip-path="url(#nc)"><path d="M150 400 C 300 560, 420 610, 505 612 C 600 610, 720 560, 850 400 L 850 690 C 700 740, 600 752, 505 752 C 410 752, 300 740, 150 690 Z" fill="' + dark + '" opacity=".2" filter="url(#b60)"/></g>' +      /* the deep soft shadow under the jaw */
    P('M40 990 C 180 958, 320 950, 448 972', deep, 22, .3, 'b16') + P('M960 990 C 820 958, 680 950, 552 972', deep, 24, .35, 'b16') + E(500, 985, 70, 40, deep, .3, 'b16') + '</g>' +
    /* a matching sweater (Colleen): light blue like the sleeve, a simple scoop neck with ribbing, a soft knit */
    (() => { const bz = (t, p0, p1, p2, p3) => p0 * (1 - t) ** 3 + 3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t * t * (1 - t) + p3 * t ** 3;
      const scoop = [[150, 858, 230, 1060, 350, 1130, 500, 1130], [500, 1130, 650, 1130, 770, 1060, 850, 858]];      /* the sweater's top edge covers the shoulders right up to the neckline (Colleen) */
      let ribs = ''; scoop.forEach(([x0, y0, x1, y1, x2, y2, x3, y3]) => { for (let i = 0; i <= 22; i++) { const t = i / 22, x = bz(t, x0, x1, x2, x3), y = bz(t, y0, y1, y2, y3), dx = bz(Math.min(1, t + .01), x0, x1, x2, x3) - x, dy = bz(Math.min(1, t + .01), y0, y1, y2, y3) - y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; ribs += 'M' + (x - nx * 26).toFixed(1) + ' ' + (y - ny * 26).toFixed(1) + 'L' + (x + nx * 26).toFixed(1) + ' ' + (y + ny * 26).toFixed(1); } });
      const SW = '#b9d3ea', SWs = '#93b4d4', SWd = '#7d9fc2';
      return '<defs><pattern id="knit" width="34" height="30" patternUnits="userSpaceOnUse"><path d="M3 4 L17 24 L31 4" stroke="' + SWd + '" stroke-width="4" fill="none" opacity=".35"/></pattern>' +
        '<radialGradient id="swg" gradientUnits="userSpaceOnUse" cx="500" cy="1300" r="1700"><stop offset="0" stop-color="' + SW + '"/><stop offset=".6" stop-color="' + SW + '"/><stop offset="1" stop-color="' + SWs + '"/></radialGradient></defs>' +
        '<path d="M-1500 1095 C -700 935, -120 895, 150 858 C 230 1060, 350 1130, 500 1130 C 650 1130, 770 1060, 850 858 C 1120 895, 1700 935, 2500 1095 L 2500 2700 L -1500 2700 Z" fill="url(#swg)"/>' +
        '<path d="M-1500 1095 C -700 935, -120 895, 150 858 C 230 1060, 350 1130, 500 1130 C 650 1130, 770 1060, 850 858 C 1120 895, 1700 935, 2500 1095 L 2500 2700 L -1500 2700 Z" fill="url(#knit)"/>' +
        '<path d="M150 858 C 230 1060, 350 1130, 500 1130 C 650 1130, 770 1060, 850 858" stroke="' + SWs + '" stroke-width="56" fill="none" stroke-linecap="round"/>' +      /* the ribbed neckband */
        '<path d="' + ribs + '" stroke="' + SWd + '" stroke-width="6" opacity=".55" stroke-linecap="round"/>' +
        '<path d="M150 858 C 230 1060, 350 1130, 500 1130 C 650 1130, 770 1060, 850 858" transform="translate(0 -26)" stroke="' + mixHex(SWs, '#000000', 0.25) + '" stroke-width="5" fill="none" opacity=".45"/>'; })() +
    /* the face: bright in the middle, the sides turning away into shadow */
    '<path d="' + FACE + '" fill="url(#fr)" filter="url(#b8)"/>' + '<g clip-path="url(#nc)">' + E(500, 470, 330, 34, mixHex(skin, shade, 0.3), .55, 'b30') + '</g>' +
    '<g clip-path="url(#fc)">' + E(-20, 0, 170, 520, deep, .45, 'b90') + E(1020, 20, 190, 540, deep, .55, 'b90') + E(500, 440, 380, 60, deep, .12, 'b60') + '</g>' +
    /* the round bottom of the nose: a lit tip, soft wings, nostrils as soft dark crescents */
    E(500, -60, 110, 85, hi, .5, 'b16') + E(488, -88, 40, 26, '#ffffff', .22, 'b8') +      /* the round tip, catching the light */
    P('M398 -60 C 372 -20, 380 20, 425 30', shade, 16, .6, 'b8') + P('M602 -60 C 628 -20, 620 20, 575 30', deep, 18, .65, 'b8') +      /* the wings */
    '<path d="M430 22 C 448 8, 470 10, 482 26 C 470 36, 446 36, 430 22 Z" fill="' + dark + '" opacity=".6" filter="url(#b4)"/>' +
    '<path d="M570 22 C 552 8, 530 10, 518 26 C 530 36, 554 36, 570 22 Z" fill="' + dark + '" opacity=".65" filter="url(#b4)"/>' +      /* nostrils */
    E(505, 60, 140, 34, deep, .45, 'b16') +      /* the shadow under the nose */
    E(480, 112, 10, 36, lite, .45, 'b8') + E(522, 112, 10, 36, shade, .45, 'b8') +      /* the groove above the lip */
    /* coral glossy lips */
    '<g transform="translate(500 175) scale(1.2) translate(-500 -175)">' +
    '<path d="M340 160 C 398 124, 442 108, 477 115 C 490 119, 495 126, 500 126 C 505 126, 510 119, 523 115 C 558 108, 602 124, 660 160 C 602 168, 546 171, 500 171 C 454 171, 398 168, 340 160 Z" fill="url(#lt)"/>' +
    '<path d="M346 166 C 406 176, 454 179, 500 179 C 546 179, 594 176, 654 166 C 616 238, 562 266, 500 268 C 438 266, 384 238, 346 166 Z" fill="url(#ll)"/>' +
    P('M330 161 C 400 173, 454 175, 500 175 C 546 175, 600 173, 670 161', line, 6, .55, 'b4') +
    E(450, 207, 40, 9, '#ffffff', .32, 'b8') + E(535, 214, 22, 6, '#ffffff', .22, 'b8') + E(555, 142, 30, 7, '#ffffff', .18, 'b8') + '</g>' +
    E(500, 312, 150, 32, deep, .5, 'b16') +      /* shadow under the lower lip */
    E(475, 405, 170, 62, hi, .5, 'b30') +      /* light on the chin */
    '</g></svg>';
}
const toneCss = v => typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : /^#[0-9a-f]{6}$/i.test(String(v)) ? v : '#87593f';
function ageFace(on) { const was = stage.classList.contains('agemode'); stage.classList.toggle('agemode', !!on); if (on) $('#ageface').innerHTML = faceSvg(toneCss(hand.tone)); if (!!on !== was && hand.ageView) hand.ready.then(() => hand.ageView(!!on)); }
$('#hand').addEventListener('fstone', e => { if (stage.classList.contains('agemode')) $('#ageface').innerHTML = faceSvg(toneCss(e.detail)); });
/* a year's parts as blocks: 17 + 76, or 2 + 0 → + 5 (the 0 that slides) */
const yearBlocks = y => (hand.yearParts ? hand.yearParts(y) || [] : []).map(([n, how]) => how === 'n' ? String(n) : '0 →');
const blocksHtml = (labels, now) => labels.map((t, i) => '<span class="blk' + (/[A-Z]/.test(t) ? ' h' : '') + (i === now ? ' now' : '') + '">' + esc(t) + '</span>').join('<span class="plus">+</span>');
/* ---------- Show me numbers (Colleen): type any number, the hand signs it with all of the number rules ---------- */
function snShow() { setTimeout(yearOnly, 0); const m = /^#\/shownum\/(year|age)/.exec(location.hash); if (m) { S.snas = m[1]; saveS(); } $$('#sn-as button').forEach(b => b.classList.toggle('on', b.dataset.v === S.snas)); hand.helper(S.snas === 'num'); ageFace(S.snas === 'age');      /* the extra hand is never needed for years (Colleen) */ putStage('shownum-slot'); speedNow = () => S.speed; assist.className = 'assist'; $('#sn-speed').value = Math.round(S.speed * 100); setTimeout(() => $('#sn-num').focus(), 50); }
function shownumInit() {
  const go = () => {
    const raw = $('#sn-num').value.trim(), digits = raw.replace(/[,\s]/g, '');
    if (!/^\d+$/.test(digits) || +digits > 999999999) { $('#sn-note').textContent = 'Type a whole number from 0 to 999,999,999 (commas are fine).'; $('#sn-blocks').innerHTML = ''; $('#sn-num').focus(); return; }
    const n = +digits, asYear = S.snas === 'year' && n >= 1000 && n <= 2099, asAge = S.snas === 'age' && n >= 1 && n <= 99, blocks = bdBlocksFor(n);
    hand.helper(!asYear && !asAge && n >= 1000);
    if (asAge) { $('#sn-note').textContent = 'Age ' + n; $('#sn-blocks').innerHTML = blocksHtml(n <= 9 ? ['chin + ' + n] : ['chin + 1', String(n)], -1);
      (async () => { await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false; newTone();
        const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
        spelling = hand.signAge(n, { per, teens: S.snteens === 'mix' ? teensFor() : S.snteens, form: S.snform === 'mix' ? formFor() : S.snform, stop: () => stopFlag }); try { await spelling; } finally { spelling = null; } })();
      return; }      // the left hand waits only for a number that needs THOUSAND or MILLION
    if (asYear) { $('#sn-note').textContent = String(n) + ' (signed as a year)'; const yb = yearBlocks(n), drawY = k => { $('#sn-blocks').innerHTML = blocksHtml(yb, k); }; drawY(-1);
      (async () => { await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false; newTone();
        const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
        spelling = hand.signYear(n, { per, form: S.snform === 'mix' ? formFor() : S.snform, stop: () => stopFlag, onPart: drawY }); try { await spelling; } finally { spelling = null; drawY(-1); } })();
      return; }
    if ((S.snas === 'year' && !asYear) || (S.snas === 'age' && !asAge)) $('#sn-note').textContent = nfmt(n) + (S.snas === 'year' ? ' (years go from 1000 to 2099' : ' (ages go from 1 to 99') + ', so this is signed as a number)'; else
    $('#sn-note').textContent = nfmt(n);
    const draw = playing => { $('#sn-blocks').innerHTML = blocks.map((t, i) => '<span class="blk' + (t === 'H' || t === 'T' || t === 'M' ? ' h' : '') + ((playing || []).indexOf(i) >= 0 ? ' now' : '') + '">' + bdName(t) + '</span>').join('<span class="plus">+</span>'); };
    draw();
    (async () => {
      await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false;
      newTone();
      const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
      spelling = hand.signParts(blocks, { per, teens: S.snteens === 'mix' ? teensFor() : S.snteens, form: S.snform === 'mix' ? formFor() : S.snform, hund: S.snhund === 'mix' ? undefined : S.snhund, stop: () => stopFlag, onPart: b => draw(b) });
      try { await spelling; } finally { spelling = null; draw(); }
    })();
  };
  $('#sn-go').onclick = go; $('#sn-again').onclick = go;
  $('#sn-num').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  $('#sn-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
  S.snteens = S.snteens || 'mix'; S.snform = S.snform || 'mix'; S.snhund = S.snhund || 'mix';
  segInit('sn-teens', 'snteens'); segInit('sn-form', 'snform'); segInit('sn-hund', 'snhund');
  if (!S.snas) S.snas = S.snyear ? 'year' : 'num';
  segInit('sn-as', 'snas', () => { yearOnly(); hand.helper(S.snas === 'num'); ageFace(S.snas === 'age'); });      // Show Me Numbers / Years / Ages (Colleen)      // Show Me Years (Colleen)
}

/* ---------- Sign the number (Colleen): a random number pops up for the student to sign, then the hand checks them ---------- */
const SG_BIG = [['100–999', 100, 999], ['1,000–9,999', 1000, 9999], ['10,000–999,999', 10000, 999999], ['Millions', 1000000, 999999999]];      // past 99, by size, like the quiz ranges
const SG = { n: null, count: 0 };
const SG_YEARS = YTYPES.map(t => ['Years ' + t[1].replace(/^Teen years \((.*)\)$/, '$1'), t[2], t[3]]);      // Sign the Year (Colleen)
const SG_AGES = ATYPES.map(t => [t[1], t[2], t[3]]);      // Sign the Age (Colleen)
const sgGroups = () => NUM_GROUPS.map(g => g[0]).concat(SG_BIG.map(g => g[0]), SG_YEARS.map(g => g[0]), SG_AGES.map(g => g[0]));
const sgNeedsHelper = () => S.sgroups.some(k => SG_BIG.some(g => g[0] === k && g[2] >= 1000));
function sgPick() {
  const k = pick1(S.sgroups.length ? S.sgroups : ['0–20']), big = SG_BIG.find(g => g[0] === k), yr = SG_YEARS.find(g => g[0] === k);
  const ag = SG_AGES.find(g => g[0] === k); SG.yearNext = !!yr; SG.ageNext = !!ag;
  if (ag) return ag[1] + Math.floor(Math.random() * (ag[2] - ag[1] + 1));
  if (yr) return yr[1] + Math.floor(Math.random() * (yr[2] - yr[1] + 1));
  if (big) return big[1] + Math.floor(Math.random() * (big[2] - big[1] + 1));
  return +pick1((NUM_GROUPS.find(g => g[0] === k) || NUM_GROUPS[0])[1]);
}
function sgCover(on) { $('#sg-cover').hidden = !on; $('#sg-check').hidden = !on; $('#sg-again').hidden = on; $('#sg-blocks').hidden = on; }
function sgNext() {
  stopFlag = true; let n, tries = 0; do { n = sgPick(); } while (n === SG.n && tries++ < 5);
  SG.n = n; SG.year = !!SG.yearNext; SG.age = !!SG.ageNext; SG.count++; ageFace(SG.age); $('#sg-num').textContent = SG.year ? String(n) : nfmt(n); sgCover(true);
  $('#sg-count').textContent = SG.count === 1 ? '' : SG.count - 1 + (SG.count === 2 ? ' number' : ' numbers') + ' signed so far.';
}
function sgPlay() {
  if (SG.n === null) return; sgCover(false);
  if (SG.age) { $('#sg-blocks').innerHTML = blocksHtml(SG.n <= 9 ? ['chin + ' + SG.n] : ['chin + 1', String(SG.n)], -1);
    (async () => { await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false; newTone();
      const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
      spelling = hand.signAge(SG.n, { per, teens: S.snteens === 'mix' ? pick1(['ten', 'twist']) : S.snteens, form: S.snform === 'mix' ? pick1(['alt', 'main']) : S.snform, stop: () => stopFlag }); try { await spelling; } finally { spelling = null; } })();
    return; }
  if (SG.year) { const yb = yearBlocks(SG.n), drawY = k => { $('#sg-blocks').innerHTML = blocksHtml(yb, k); }; drawY(-1);
    (async () => { await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false; newTone();
      const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
      spelling = hand.signYear(SG.n, { per, form: S.snform === 'mix' ? pick1(['alt', 'main']) : S.snform, stop: () => stopFlag, onPart: drawY }); try { await spelling; } finally { spelling = null; drawY(-1); } })();
    return; }
  const blocks = bdBlocksFor(SG.n), draw = playing => { $('#sg-blocks').innerHTML = blocks.map((t, i) => '<span class="blk' + (t === 'H' || t === 'T' || t === 'M' ? ' h' : '') + ((playing || []).indexOf(i) >= 0 ? ' now' : '') + '">' + bdName(t) + '</span>').join('<span class="plus">+</span>'); };
  draw();
  (async () => {
    await hand.ready; stopFlag = true; while (spelling) await spelling; stopFlag = false;
    newTone();
    const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
    spelling = hand.signParts(blocks, { per, teens: S.snteens === 'mix' ? pick1(['ten', 'twist']) : S.snteens, form: S.snform === 'mix' ? pick1(['alt', 'main']) : S.snform, hund: S.snhund === 'mix' ? undefined : S.snhund, stop: () => stopFlag, onPart: b => draw(b) });
    try { await spelling; } finally { spelling = null; draw(); }
  })();
}
let sgMarks = [];
const yearOnly = () => { const sn = document.querySelector('[data-screen=shownum]'), sg = document.querySelector('[data-screen=signnum]');      /* hide the 16–19, 23 & 25 and HUNDRED choices when only years are signed (Colleen) */
  if (sn) sn.dataset.yearonly = S.snas === 'year' ? '1' : ''; if (sg) sg.dataset.yearonly = S.sgroups.length && S.sgroups.every(k => SG_YEARS.some(g => g[0] === k)) ? '1' : ''; };
function sgShow() {
  if (/^#\/signnum\/year/.test(location.hash) && !S.sgroups.some(k => SG_YEARS.some(g => g[0] === k))) { S.sgroups = SG_YEARS.map(g => g[0]); saveS(); SG.n = null; if (window.__sgDraw) window.__sgDraw(); }
  if (/^#\/signnum\/age/.test(location.hash) && !S.sgroups.some(k => SG_AGES.some(g => g[0] === k))) { S.sgroups = SG_AGES.map(g => g[0]); saveS(); SG.n = null; if (window.__sgDraw) window.__sgDraw(); }      // Sign the Age: the age groups      // Sign the Year: the year groups
  putStage('signnum-slot'); hand.helper(sgNeedsHelper()); speedNow = () => S.speed; assist.className = 'assist';
  $('#sg-speed').value = Math.round(S.speed * 100); sgMarks.forEach(m => m());
  if (SG.n === null) sgNext(); else { sgCover(true); ageFace(SG.age); }
  yearOnly();
}
function signnumInit() {
  if (!Array.isArray(S.sgroups)) S.sgroups = ['0–20'];
  const hint = () => { yearOnly(); $('#sg-hint').textContent = S.sgroups.length ? '' : 'Choose at least one group (0–20 is used until you do).'; if (location.hash === '#/signnum') hand.helper(sgNeedsHelper()); };
  window.__sgDraw = chipsInit($('#sg-groups'), sgGroups(), 'sgroups', x => esc(x), hint);
  $('#sg-check').onclick = sgPlay; $('#sg-check2').onclick = sgPlay; $('#sg-again').onclick = sgPlay; $('#sg-next').onclick = sgNext;
  $('#sg-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
  S.snteens = S.snteens || 'mix'; S.snform = S.snform || 'mix'; S.snhund = S.snhund || 'mix';
  sgMarks = [segInit('sg-teens', 'snteens'), segInit('sg-form', 'snform'), segInit('sg-hund', 'snhund')];
  document.addEventListener('keydown', e => { if (location.hash !== '#/signnum' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (e.key === 'Enter') { e.preventDefault(); sgNext(); } else if (e.key === ' ') { e.preventDefault(); sgPlay(); } });
}

/* ONE SHARED SET OF SMALL HANDS (streamlined for school Chromebooks, Colleen): How Old Is Charlie?, When Did It Happen?, the Timeline and Math
   all use the same few light tile hands, moved into whichever page is open. Browsers allow only about 16 3D views at once; one set per page
   could pass that and blank the main hand. use: 'age' (the chin view), 'two' (the left hand too, for math signs), or plain. */
const TILES = [];
function tileHand(k, tile, use, tone) {
  if (!TILES[k]) { const c = document.createElement('canvas'); TILES[k] = { canvas: c, hand: window.FSHand.create(c, { tile: true }) }; }
  const T = TILES[k]; if (tile && T.canvas.parentNode !== tile) tile.appendChild(T.canvas);
  T.hand.ready.then(() => { T.hand.setTone(tone || nextTone()); if (T.hand.ageView) T.hand.ageView(use === 'age'); T.hand.helper(use === 'two'); });
  return T;
}
/* ---------- How old is Charlie? (Colleen, 2026-10-15): a picture of Charlie at one stage of life; four hands, each with the face behind it, sign four
   ages at once; the right one is any age in that stage's range; the three others come from stages at least 3 stages away from the picture's
   (so none of them could fit her) and at least 2 stages from each other ---------- */
const AP = { hands: [], cur: null, right: 0, tries: 0, last: -1, answered: false };
const uniqIds = (svg, pre) => svg.replace(/id="([^"]+)"/g, 'id="' + pre + '$1"').replace(/url\(#([^)]+)\)/g, 'url(#' + pre + '$1)');      // four faces on one page need their own names
function apRound() {
  const R0 = window.CHARLIE, n = R0.STAGES.length, ok = (a, b) => Math.abs(a - b) >= 3, apart = (a, b) => Math.abs(a - b) >= 2;
  let i, t = 0; do { i = Math.floor(Math.random() * n); } while (i === AP.last && t++ < 10); AP.last = i;
  let picks = null;
  for (let tries = 0; tries < 300 && !picks; tries++) { const c = shuffle([...Array(n).keys()].filter(x => ok(x, i))), got = [];
    for (const x of c) { if (got.length === 3) break; if (got.every(y => apart(x, y))) got.push(x); } if (got.length === 3) picks = got; }
  if (!picks) picks = shuffle([...Array(n).keys()].filter(x => ok(x, i))).slice(0, 3);
  const ageIn = st => { const [, , lo, hi] = R0.STAGES[st]; return lo + Math.floor(Math.random() * (hi - lo + 1)); };
  const right = ageIn(i), choices = shuffle([right].concat(picks.map(ageIn)));
  return { stage: i, right, choices };
}
function apHand(k, tile) {      /* each hand is made inside its tile (it measures its size when it is made), then reused */
  const T = tileHand(k, tile, 'age', AP.tone); AP.hands[k] = AP.hands[k] || {}; AP.hands[k].canvas = T.canvas; AP.hands[k].hand = T.hand;
}
function apDraw() {
  const R0 = window.CHARLIE, r = AP.cur = apRound(); AP.answered = false;
  $('#ap-title').textContent = 'How Old Is ' + R0.NAME + '?';
  $('#ap-pic').innerHTML = R0.picture(r.stage); $('#ap-msg').textContent = ''; $('#ap-next').hidden = true;
  const tone = AP.tone = hand.dealTone(), css = toneCss(tone);      /* a new tone each round, every tone equally often */
  const grid = $('#ap-grid'); $$('#ap-grid canvas').forEach(c => c.remove()); grid.innerHTML = '';
  r.choices.forEach((age, k) => {
    const tile = document.createElement('div'); tile.className = 'ap-choice'; tile.dataset.age = age; tile.setAttribute('role', 'button');
    tile.innerHTML = '<div class="ap-face">' + uniqIds(faceSvg(css), 'ap' + k) + '</div><span class="ap-tag">' + 'ABCD'[k] + '</span><span class="ap-tap">▶ tap</span>';
    tile.dataset.k = k; tile.setAttribute('aria-label', 'Watch hand ' + 'ABCD'[k]); tile.onclick = () => apWatch(k);
    const cell = document.createElement('div'); cell.className = 'ap-cell'; cell.appendChild(tile); cell.insertAdjacentHTML('beforeend', '<button class="btn ghost ap-pickbtn" data-k="' + k + '">Pick ' + 'ABCD'[k] + '</button>'); grid.appendChild(cell); apHand(k, tile); AP.hands[k].hand.ready.then(() => AP.hands[k].hand.setTone(tone));
  });
  $$('.ap-pickbtn').forEach(b => b.onclick = () => apPick($$('.ap-choice')[+b.dataset.k]));      /* each Pick button sits right under its hand (Colleen) */
}
const smooth = () => new Promise(res => { let last = performance.now(), good = 0; const t0 = last; (function f(now) { good = now - last < 60 ? good + 1 : 0; last = now; if (good >= 3 || now - t0 > 5000) res(); else requestAnimationFrame(f); })(last); });      /* waits until the screen is drawing smoothly again (four hands take a few seconds to load the first time) */
function apWatch(k) {      /* the student starts each hand, one at a time (Colleen: "just like on the timeline") */
  const R = AP.cur, H = AP.hands[k]; if (!R || !H || H.busy) return; H.busy = true;
  const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
  H.hand.ready.then(smooth).then(() => AP.cur === R && H.hand.signAge(R.choices[k], { per, teens: S.nteens === 'mix' ? teensFor() : S.nteens, form: formFor() })).finally(() => { H.busy = false; });
}
function apPick(tile) {
  if (AP.answered || !AP.cur) return; AP.answered = true; AP.tries++;
  const R0 = window.CHARLIE, st = R0.STAGES[AP.cur.stage], age = +tile.dataset.age, good = age === AP.cur.right; if (good) AP.right++;
  $$('.ap-pickbtn').forEach(b => { b.disabled = true; const bt = $$('.ap-choice')[+b.dataset.k]; if (+bt.dataset.age === AP.cur.right) b.classList.add('ok'); else if (bt === tile) b.classList.add('no'); }); $$('.ap-choice').forEach(t => { t.classList.add(+t.dataset.age === AP.cur.right ? 'ok' : t === tile ? 'no' : 'x'); t.insertAdjacentHTML('beforeend', '<span class="ap-age">' + t.dataset.age + '</span>'); });
  const span = st[2] === st[3] ? String(st[2]) : st[2] + ' to ' + st[3];
  $('#ap-msg').textContent = (good ? 'Right! ' : 'Not this time. The hand that fits signed ' + AP.cur.right + '. ') + R0.NAME + ' looks about ' + st[1] + ' here, so any age from ' + span + ' fits.';
  $('#ap-score').textContent = AP.right + ' of ' + AP.tries + ' right so far.'; $('#ap-next').hidden = false;
  if (good && window.confetti) window.confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
}
function apShow() { $('#ap-speed').value = Math.round(S.speed * 100); if (!AP.cur) setTimeout(apDraw, 50); else $$('#ap-grid .ap-choice').forEach((t, k) => tileHand(k, t, 'age', AP.tone)); }      /* the shared hands come back to this page */
function agepicsInit() {
  $('#ap-next').onclick = apDraw;
  $('#ap-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
}

/* ---------- Learn Numbers (Colleen, 2026-10-15): lessons in the order she taught the rules (dev/ASL-number-rules.md), grouped like the games.
   Each lesson: the rule in plain words, parts with examples the big hand signs when tapped, then five quick "pick what it signed" questions.
   An example is [label, value, kind, options, note]: kind 'n' a number, 'y' a year, 'a' an age, 'o' a math sign. ---------- */
const OPN = { '+': 'PLUS', '-': 'MINUS', 'x': 'TIMES', '/': 'DIVIDED BY', '=': 'EQUALS', '?': 'HOW MANY' };
const LESSONS = [
  { id: 'n0-20', name: '0–10', icon: '🖐️', about: 'The 0–9 handshapes and 10.', intro: 'Start here. These handshapes are the building blocks for every other number.', parts: [
    ['0–5', 'Show the number with your fingers. For 1–5 on their own, the palm faces you, the signer.', [0, 1, 2, 3, 4, 5]],
    ['6–9', 'The thumb touches one finger: 6 the pinky, 7 the ring finger, 8 the middle finger, 9 the pointer finger.', [6, 7, 8, 9]],
    ['10', 'A thumbs-up with a small, quick twist of the wrist.', [10]]], pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 'nteens', name: 'The teens', icon: '🧒', about: '11–19, and the two ways to sign 16–19.', intro: 'The teens each have their own movement. Watch for what the fingers do.', parts: [
    ['11 and 12', 'The finger (11) or two fingers (12) flick up from the thumb, twice.', [11, 12]],
    ['13, 14 and 15', 'Palm toward you, the fingers bend at the knuckles, twice. 13 uses two fingers with the thumb out, 14 four fingers, 15 four fingers with the thumb out.', [13, 14, 15]],
    ['16–19: two ways', 'People sign 16–19 in different ways. The most common is 10 + the number: a thumbs-up that flicks into the 6–9 shape. Another way is the twist: the 6–9 shape twists out.', [['16', 16, 'n', { teens: 'ten' }, '10 + 6'], ['16', 16, 'n', { teens: 'twist' }, 'twist'], ['17', 17, 'n', { teens: 'ten' }, '10 + 7'], ['17', 17, 'n', { teens: 'twist' }, 'twist'], ['18', 18, 'n', { teens: 'ten' }, '10 + 8'], ['19', 19, 'n', { teens: 'ten' }, '10 + 9']]]], pool: [11, 12, 13, 14, 15, 16, 17, 18, 19] },
  { id: 'n20s', name: 'The 20s', icon: '2️⃣', about: '20–29, and the formal and slang forms of 23 and 25.', intro: 'The 20s have their own signs. Watch each one closely.', parts: [
    ['20', 'The pointer finger and thumb pinch, twice.', [20]],
    ['21–29', 'Each of the 20s has its own sign. 22 is a double (see Doubles).', [21, 22, 24, 26, 27, 28, 29]],
    ['23 and 25: two forms', 'Both have a formal form and a slang form. You will see both.', [['23', 23, 'n', { form: 'alt' }, 'formal'], ['23', 23, 'n', { form: 'main' }, 'slang'], ['25', 25, 'n', { form: 'alt' }, 'formal'], ['25', 25, 'n', { form: 'main' }, 'slang']]]], pool: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
  { id: 'ntens', name: 'Tens', icon: '🔟', about: '30, 40, 50 … 90.', intro: 'Sign the first digit, then 0.', parts: [
    ['30–90', 'The first digit, then 0.', [30, 40, 50, 60, 70, 80, 90]]], pool: [30, 40, 50, 60, 70, 80, 90] },
  { id: 'ndoubles', name: 'Doubles', icon: '👯', about: '22, 33, 44 … 99: one handshape, placed twice.', intro: 'When both digits are the same, the hand makes that handshape once and places it twice.', parts: [
    ['22–99', 'The handshape, palm down but tipped: a firm placing, one arc toward the signer’s right, and a firm second placing. 11 has its own sign.', [22, 33, 44, 55, 66, 77, 88, 99]]], pool: [22, 33, 44, 55, 66, 77, 88, 99] },
  { id: 'nrocking', name: 'Rocking numbers', icon: '🔄', about: '67, 76, 89, 98 …: the wrist rocks between the two digits.', intro: 'When both digits are 6, 7, 8 or 9 and they are different, the hand rocks from the first digit to the second.', parts: [
    ['Going up: 67, 68, 69, 78, 79, 89', 'The thumb moves to the new finger while the wrist rocks. A small wrist movement, not the arm.', [67, 68, 69, 78, 79, 89]],
    ['Going down: 76, 86, 87, 96, 97, 98', 'The rock goes the other way.', [76, 86, 87, 96, 97, 98]],
    ['Not a double', 'Compare: 66 and 77 are doubles, not rocking numbers.', [66, 67, 77, 76]]], pool: [67, 68, 69, 76, 78, 79, 86, 87, 89, 96, 97, 98] },
  { id: 'ntwo', name: 'Other two-digit numbers', icon: '🔢', about: '34, 52, 81 …: one digit, then the other.', intro: 'Every other two-digit number is the first digit, then the second.', parts: [
    ['Digit, then digit', 'Sign the first digit, then the second, smoothly.', [34, 47, 58, 63, 72, 91]],
    ['1–5 inside a longer number', 'Inside a longer number, 1–5 face palm out (toward the person watching).', [31, 42, 53, 85, 94]]], pool: [34, 47, 58, 63, 72, 91, 31, 42, 53, 85, 94, 36, 49, 57] },
  { id: 'nhundreds', name: 'Hundreds', icon: '💯', about: 'The number of hundreds, HUNDRED, then the rest.', intro: 'Sign it the way it is said: the number of hundreds, HUNDRED, then the rest. No AND sign.', parts: [
    ['Exact hundreds', 'The number, then HUNDRED. HUNDRED is signed two ways: with a C, or with a curl.', [['100', 100, 'n', { hund: 'c' }, 'C'], ['100', 100, 'n', { hund: 'curl' }, 'curl'], 300, 500, 900]],
    ['Hundreds and more', 'Flow straight into the rest of the number. Special forms stay special: the 78 in 678 still rocks.', [105, 125, 219, 456, 678, 999]]], pool: [100, 200, 300, 500, 900, 105, 125, 219, 456, 678, 999] },
  { id: 'nthousands', name: 'Thousands and millions', icon: '🔟🔟', about: 'THOUSAND and MILLION use both hands.', intro: 'Sign it the way it is said: the number of thousands, THOUSAND, then the rest. Never sign zeros that are not said.', parts: [
    ['THOUSAND', 'The other hand is open, palm up. The signing hand, a flat bent B, touches its palm once.', [1000, 10000, 25000, 100000]],
    ['Thousands and more', 'Keep going after THOUSAND, in spoken order. 4,007 is FOUR THOUSAND SEVEN.', [1005, 2150, 4007, 5678]],
    ['MILLION', 'The THOUSAND touch, then a second touch farther out on the fingers.', [1000000, 2500000]]], pool: [1000, 10000, 25000, 1005, 2150, 4007, 5678, 1000000] },
  { id: 'nyears', name: 'Years', icon: '🕰️', about: 'Years are split in two, in three different ways.', intro: 'Years are not signed like big numbers. There is no THOUSAND. There are three kinds.', parts: [
    ['Years that start with a teen (1000–1999)', 'Two numbers. The first is always the 10 + number form (16–19 never twist in a year). The second is one two-digit number in its own form: 76 rocks, 22 is a double.', [['1776', 1776, 'y'], ['1865', 1865, 'y'], ['1922', 1922, 'y']]],
    ['01–09 and 00', '1906 is 19, then 0, then 6. 1900 is 19, then a 0 that slides to the side.', [['1906', 1906, 'y'], ['1900', 1900, 'y']]],
    ['2000–2009', '2 palm out, then a 0 that slides to the side, then the last digit palm out. 2000 has a longer slide.', [['2005', 2005, 'y'], ['2000', 2000, 'y']]],
    ['2010–2099', 'TWENTY, then the last two digits as one number (not single digits).', [['2026', 2026, 'y'], ['2017', 2017, 'y']]]], pool: [1492, 1776, 1865, 1906, 1900, 1969, 2000, 2005, 2008, 2017, 2026], kind: 'y' },
  { id: 'nages', name: 'Ages', icon: '🎂', about: 'Ages start at the chin.', intro: 'Every age starts at the chin, then pushes down and forward.', parts: [
    ['Ages 1–9', 'The number, palm out, the pointer finger on the center of the chin; then the hand pushes down and forward.', [['3', 3, 'a'], ['6', 6, 'a'], ['9', 9, 'a']]],
    ['Ages 10 and up', 'The 1 (palm in) starts on the chin, pushes down and forward, and forms the number with all the usual number rules.', [['13', 13, 'a'], ['21', 21, 'a'], ['47', 47, 'a'], ['76', 76, 'a']]]], pool: [2, 5, 8, 12, 16, 21, 34, 47, 76, 88], kind: 'a' },
  { id: 'nmath', name: 'Math signs', icon: '➗', about: 'PLUS, MINUS, TIMES, DIVIDED BY, EQUALS, HOW MANY.', intro: 'The six signs for math problems. All of them use both hands.', parts: [
    ['The four operations', 'PLUS, MINUS, TIMES and DIVIDED BY.', [['+', '+', 'o', null, 'plus'], ['−', '-', 'o', null, 'minus'], ['×', 'x', 'o', null, 'times'], ['÷', '/', 'o', null, 'divided by']]],
    ['Ending the problem', 'A problem ends with EQUALS or HOW MANY.', [['=', '=', 'o', null, 'equals'], ['?', '?', 'o', null, 'how many']]]], pool: ['+', '-', 'x', '/', '=', '?'], kind: 'o' }
];
/* Learn Fingerspelling (Colleen, 2026-10-15): the same kind of tutorials for the alphabet; look-alike groups are hers (themes.js LOOK_GROUPS). Kind 'l': the hand spells it. */
const LS = (str) => str.split(' ').map(c => [c, c, 'l']);
const LESSONS_FS = [
  { id: 'fa-i', name: 'A–I', icon: '🅰️', about: 'The first nine letters.', intro: 'Hold your hand up beside your shoulder, palm toward the person watching. Watch each handshape.', parts: [
    ['A, B, C', 'A is a fist with the thumb at the side. B is a flat hand with the thumb across the palm. C curves like the letter.', LS('A B C')],
    ['D, E, F', 'D points up with the other fingers touching the thumb. E curls the fingertips down over the thumb. F touches the pointer finger to the thumb.', LS('D E F')],
    ['G, H, I', 'G and H point sideways (G one finger, H two). I raises just the pinky.', LS('G H I')]], pool: 'ABCDEFGHI'.split(''), kind: 'l' },
  { id: 'fj-r', name: 'J–R', icon: '🔤', about: 'J through R.', intro: 'Keep your hand in one place. Only the handshape changes.', parts: [
    ['J, K, L', 'J draws a J with the pinky. K raises two fingers with the thumb between them. L is the shape of an L.', LS('J K L')],
    ['M, N, O', 'M tucks the thumb under three fingers, N under two. O rounds all the fingers to the thumb.', LS('M N O')],
    ['P, Q, R', 'P is like K pointing down. Q is like G pointing down. R crosses two fingers.', LS('P Q R')]], pool: 'JKLMNOPQR'.split(''), kind: 'l' },
  { id: 'fs-z', name: 'S–Z', icon: '🔠', about: 'S through Z.', intro: 'The last eight letters.', parts: [
    ['S, T, U', 'S is a fist with the thumb across the front. T tucks the thumb between two fingers. U holds two fingers up together.', LS('S T U')],
    ['V, W, X', 'V spreads two fingers, W three. X hooks the pointer finger.', LS('V W X')],
    ['Y, Z', 'Y holds out the thumb and pinky. Z draws a Z with the pointer finger.', LS('Y Z')]], pool: 'STUVWXYZ'.split(''), kind: 'l' },
  { id: 'fmove', name: 'Letters that move', icon: '〰️', about: 'J and Z draw their letter in the air.', intro: 'Every letter holds still except two.', parts: [
    ['J', 'Start with I (the pinky up) and draw a J.', LS('J I')],
    ['Z', 'Point and draw a Z.', LS('Z')]], pool: ['J', 'Z', 'I', 'D'], kind: 'l' },
  { id: 'flook', name: 'Look-alike letters', icon: '👀', about: 'Letters that look alike, side by side.', intro: 'These groups are easy to mix up. Watch for the small difference.', parts: Object.keys(window.LOOK_GROUPS || { 'M N S T': 1, 'A E O': 1, 'R U V W K': 1, 'K P G H': 1, 'I Y J': 1 }).map(k => [k, { 'M N S T': 'Watch where the thumb is: under three fingers, under two, across the front, or between two.', 'A E O': 'All three close the hand. Watch the thumb and the fingertips.', 'R U V W K': 'Count the fingers and watch if they cross, touch or spread.', 'K P G H': 'K and P are the same shape pointing up and down; G and H point sideways.', 'I Y J': 'The pinky is up in all three. Y adds the thumb; J moves.' }[k] || 'Watch closely.', LS(k)]),
    pool: 'MNSTAEORUVWKPGHIYJ'.split(''), kind: 'l' },
  { id: 'fwords', name: 'Spelling words', icon: '📝', about: 'Spelling a whole word smoothly.', intro: 'Spell a word in one smooth flow. Keep your hand still; only the handshapes change.', parts: [
    ['Short words', 'Each letter flows into the next, with no bounce between letters.', [['CAT', 'CAT', 'l'], ['DOG', 'DOG', 'l'], ['SUN', 'SUN', 'l'], ['MAP', 'MAP', 'l']]],
    ['Longer words', 'Keep the same steady rhythm all the way through.', [['TEACHER', 'TEACHER', 'l'], ['FRIEND', 'FRIEND', 'l'], ['PIZZA', 'PIZZA', 'l']]]], pool: ['CAT', 'COT', 'CUT', 'MAP', 'NAP', 'TAP', 'SUN', 'RUN'], kind: 'l' },
  { id: 'fdouble', name: 'Double letters', icon: '👯', about: 'Showing the same letter twice in a row.', intro: 'When a word has the same letter twice in a row, the second one has to look different from just holding the first.', parts: [
    ['Loosen and close', 'Most double letters: the fingers and thumb relax part of the way open, then close into the letter again.', [['BOOK', 'BOOK', 'l'], ['SEE', 'SEE', 'l'], ['MISS', 'MISS', 'l'], ['TOOTH', 'TOOTH', 'l']]],
    ['Slide', 'Some letters (B, C, D, E, G, H, I, L, O, P, R, U, V, W) can instead slide a little to the side for the second letter. Watch a few times; you will see both.', [['BALL', 'BALL', 'l'], ['APPLE', 'APPLE', 'l'], ['HELLO', 'HELLO', 'l'], ['COFFEE', 'COFFEE', 'l']]],
    ['ZZ', 'A popular slang option for ZZ: a bent V (two fingers) draws the Z once. Many people also draw two Z\u2019s.', [['PIZZA', 'PIZZA', 'l', { zz: 'v' }, 'slang'], ['PIZZA', 'PIZZA', 'l', { zz: 'two' }, 'two Z\u2019s']]],
    ['Double or not?', 'Compare a word with a double letter to one without.', [['BEE', 'BEE', 'l'], ['BE', 'BE', 'l'], ['TOO', 'TOO', 'l'], ['TO', 'TO', 'l']]]], pool: ['BOOK', 'LOOK', 'TOOK', 'BALL', 'BELL', 'BILL', 'SEE', 'BEE', 'TOO', 'TO', 'POOL', 'TOOL'], kind: 'l' }
];
const LN = { cur: null, busy: false, q: null, n: 0, right: 0 };
const lnDone = () => { try { return JSON.parse(localStorage.getItem('fs-learned') || '[]'); } catch (e) { return []; } };
const lnMark = id => { try { const d = lnDone(); if (d.indexOf(id) < 0) { d.push(id); localStorage.setItem('fs-learned', JSON.stringify(d)); } } catch (e) {} };
const lnEx = e => Array.isArray(e) ? { label: e[0], v: e[1], kind: e[2] || 'n', o: e[3] || {}, note: e[4] || '' } : { label: String(e).replace(/\B(?=(\d{3})+(?!\d))/g, ','), v: e, kind: 'n', o: {}, note: '' };
async function lnSign(x) {
  const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed))), o = Object.assign({ per, teens: 'ten', form: 'alt' }, x.o || {});
  if (x.kind === 'y') return hand.signYear(+x.v, o);
  if (x.kind === 'a') return hand.signAge(+x.v, o);
  if (x.kind === 'o') return hand.signOp(x.v, { per });
  if (x.kind === 'l') return hand.spell(String(x.v), Object.assign({ speed: () => S.speed }, x.o || {}));
  return +x.v < 100 ? hand.sign(+x.v, o) : hand.signParts(bdBlocksFor(+x.v), o);
}
async function lnPlay(x, btn) { if (LN.busy) return; LN.busy = true; if (btn) btn.classList.add('on'); try { await lnSign(x); } finally { LN.busy = false; if (btn) btn.classList.remove('on'); } }
const lnLabel = (L, v) => L.kind === 'o' ? OPN[v] : L.kind === 'y' || L.kind === 'a' || L.kind === 'l' ? String(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');      /* years never get a comma (Colleen) */
function lnAsk() {
  const L = LN.cur; if (!L || LN.busy) return; if (LN.n >= 5) return;
  const v = pick1(L.pool.filter(x => !LN.q || x !== LN.q.v)), others = shuffle(L.pool.filter(x => x !== v)).slice(0, 2);
  LN.q = { v, choices: shuffle([v].concat(others)), answered: false }; LN.n++;
  $('#ln-q').textContent = 'Question ' + LN.n + ' of 5: what did the hand sign?'; $('#ln-msg').textContent = ''; $('#ln-start').hidden = true; $('#ln-replay').hidden = false;
  $('#ln-choices').innerHTML = LN.q.choices.map(c => '<button class="btn ghost" data-v="' + esc(String(c)) + '">' + esc(lnLabel(L, c)) + '</button>').join('');
  $$('#ln-choices button').forEach(b => b.onclick = () => lnAnswer(b));
  lnPlay({ v, kind: L.kind || 'n', o: {} });
}
function lnAnswer(b) {
  const L = LN.cur, q = LN.q; if (!q || q.answered) return; q.answered = true; const good = b.dataset.v === String(q.v); if (good) LN.right++;
  $$('#ln-choices button').forEach(x => { x.disabled = true; if (x.dataset.v === String(q.v)) x.classList.add('ok'); }); if (!good) b.classList.add('no');
  if (LN.n < 5) { $('#ln-msg').textContent = (good ? 'Right! ' : 'It was ' + lnLabel(L, q.v) + '. ') + 'Next one coming…'; setTimeout(() => { if (LN.cur === L) lnAsk(); }, 1600); }
  else { $('#ln-msg').textContent = (good ? 'Right! ' : 'It was ' + lnLabel(L, q.v) + '. ') + 'You got ' + LN.right + ' of 5.' + (LN.right >= 4 ? ' Lesson done!' : ' Watch the examples again, then try once more.'); if (LN.right >= 4) { lnMark(L.id); if (window.confetti) window.confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } }); } $('#ln-start').hidden = false; $('#ln-start').textContent = 'Try again'; $('#ln-replay').hidden = true; }
}
function lnShow() {
  const id = (location.hash.split('/')[2] || ''), LIST = LESSONS_FS.some(l => l.id === id) ? LESSONS_FS : LESSONS, k = Math.max(0, LIST.findIndex(l => l.id === id)), L = LN.cur = LIST[k];
  putStage('learn-slot'); speedNow = () => S.speed; assist.className = 'assist'; $('#ln-speed').value = Math.round(S.speed * 100);
  hand.helper(L.id === 'nthousands' || L.id === 'nmath'); ageFace(L.id === 'nages');
  $('#ln-step').textContent = 'Lesson ' + (k + 1) + ' of ' + LIST.length; $('#ln-title').textContent = 'Focus on: ' + L.name; $('#ln-intro').textContent = L.intro;
  $('#ln-parts').innerHTML = L.parts.map((P, i) => '<div class="ln-part' + (P[3] === 'star' ? ' star' : '') + '"><h3>' + esc(P[0]) + '</h3><p>' + esc(P[1]) + '</p><div class="ln-ex" data-p="' + i + '">' + P[2].map((e, j) => { const x = lnEx(e); return '<button data-j="' + j + '" aria-label="Watch ' + esc(x.label + (x.note ? ' ' + x.note : '')) + '">▶ ' + esc(x.label) + (x.note ? '<small>' + esc(x.note) + '</small>' : '') + '</button>'; }).join('') + '</div></div>').join('');
  $$('#ln-parts .ln-ex button').forEach(b => b.onclick = () => lnPlay(lnEx(L.parts[+b.parentNode.dataset.p][2][+b.dataset.j]), b));
  LN.n = 0; LN.right = 0; LN.q = null; $('#ln-choices').innerHTML = ''; $('#ln-msg').textContent = ''; $('#ln-q').textContent = 'Tap Start. The hand signs; pick what it signed.'; $('#ln-start').hidden = false; $('#ln-start').textContent = 'Start'; $('#ln-replay').hidden = true;
  const prev = LIST[k - 1], next = LIST[k + 1];
  $('#ln-prev').href = prev ? '#/learn/' + prev.id : '#/games'; $('#ln-prev').textContent = prev ? '← ' + prev.name : '← Lessons';
  $('#ln-next').href = next ? '#/learn/' + next.id : '#/games'; $('#ln-next').textContent = next ? 'Next: ' + next.name + ' →' : 'Done: to the games →';
}
function learnInit() {
  [['#g-learngrid', LESSONS], ['#g-learnfs', LESSONS_FS]].forEach(([sel, LIST]) => { const g = $(sel); if (!g) return; const draw = () => { const d = lnDone(); g.innerHTML = '<span class="ln-focus">Tutorials — focus on:</span>' + LIST.map((L, i) => '<a class="ln-btn' + (d.indexOf(L.id) >= 0 ? ' done' : '') + '" href="#/learn/' + L.id + '" title="' + esc(L.about) + '" aria-label="Tutorial ' + (i + 1) + ': ' + esc(L.name) + '"><span aria-hidden="true">' + L.icon + '</span> ' + esc(L.name) + ' <span class="ln-go" aria-hidden="true">→</span></a>').join('');      /* reads as tutorials to open, not options to pick (Colleen) */      /* one heading, a button per topic (Colleen) */ }; draw(); window.addEventListener('hashchange', () => { if (/^#\/games/.test(location.hash)) draw(); }); });
  $('#ln-start').onclick = () => { if (LN.n >= 5) { LN.n = 0; LN.right = 0; } lnAsk(); };
  $('#ln-replay').onclick = () => { if (LN.q) lnPlay({ v: LN.q.v, kind: LN.cur.kind || 'n', o: {} }); };
  $('#ln-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
}

/* ---------- Math in ASL (Colleen, 2026-10-15; dev/ASL-number-rules.md "Math"): the hand signs a problem, a number, the operation (PLUS, MINUS,
   TIMES, DIVIDE), a number, then EQUALS or HOW MANY (mixed). Three styles: write the problem (what the hand signed), solve it, or pick the answer
   from four. Levels: Easy (+ and −, to 10), Medium (all four, to 20), Hard (all four, to 100), Custom (the student's operations and size).
   Shortcut buttons + − × ÷ = sit under the answer box; typed symbols work too, and / means divide. ---------- */
const MT = { cur: null, busy: false, right: 0, tries: 0, answered: false };
const MT_LEVELS = { easy: [['+', '-'], 10], medium: [['+', '-', 'x', '/'], 20], hard: [['+', '-', 'x', '/'], 100] };
const MT_SYM = { '+': '+', '-': '−', 'x': '×', '/': '÷' };
const mtSet = () => S.mtLevel === 'custom' ? [S.mtOps.length ? S.mtOps : ['+'], +S.mtMax || 10] : MT_LEVELS[S.mtLevel] || MT_LEVELS.easy;
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function mtMake(ops, max) {      /* whole numbers only: no answers below 0, division always comes out even; times uses factors up to 12 when the numbers go past 12 */
  const op = pick1(ops); let a, b, r;
  if (op === '+') { a = rint(1, max - 1); b = rint(1, max - a); r = a + b; }      /* no zeros (0 − 0 is too easy) */
  else if (op === '-') { a = rint(2, max); b = rint(1, a - 1); r = a - b; }
  else if (op === 'x') { const f = Math.min(max, 12); a = rint(1, f); b = rint(1, max <= 12 ? Math.max(1, Math.floor(max / a)) : f); r = a * b; }
  else { b = rint(1, Math.min(max, 12)); r = rint(1, Math.max(1, Math.floor(max / b))); a = b * r; }      /* the number divided stays within the level */
  return { a, op, b, r, end: Math.random() < 0.5 ? '=' : '?', eqFirst: Math.random() < 0.5 };      /* eqFirst: Insert the signs shows 12 = 7 + 5 instead of 7 + 5 = 12 */
}
const mtNorm = t => String(t).toLowerCase().replace(/\s+/g, '').replace(/[×*x]/g, 'x').replace(/[÷/]/g, '/').replace(/[−–—]/g, '-').replace(/[=?]+$/, '').replace(/^how many|howmany$/, '');
function mtTrue(v, p) {      /* Insert the signs: the three signed numbers in the order signed, one blank an operation and the other =, and true (any signs that work count) */
  const t = String(v).toLowerCase().replace(/\s+/g, '').replace(/[×*x]/g, 'x').replace(/[÷/]/g, '/').replace(/[−–—]/g, '-');
  const n = mtOrder(p), calc = (a, o, b) => ({ '+': a + b, '-': a - b, 'x': a * b, '/': b ? a / b : NaN })[o];
  let m = /^(\d+)([-+x\/])(\d+)=(\d+)$/.exec(t); if (m && +m[1] === n[0] && +m[3] === n[1] && +m[4] === n[2]) return calc(n[0], m[2], n[1]) === n[2];
  m = /^(\d+)=(\d+)([-+x\/])(\d+)$/.exec(t); if (m && +m[1] === n[0] && +m[2] === n[1] && +m[4] === n[2]) return calc(n[1], m[3], n[2]) === n[0];
  return false;
}
const mtOrder = p => p.eqFirst ? [p.r, p.a, p.b] : [p.a, p.b, p.r];
const mtText = p => p.a + ' ' + MT_SYM[p.op] + ' ' + p.b + (p.end === '=' ? ' EQUALS' : ' HOW MANY');      /* the message names the sign; typing = is optional */
function mtChoices(p) { const out = new Set([p.r]), near = [p.r + 1, p.r - 1, p.r + 2, p.r - 2, p.r + 10, p.r - 10, p.a + p.b, Math.abs(p.a - p.b), p.a * p.b]; shuffle(near).forEach(x => { if (out.size < 4 && x >= 0 && x !== p.r) out.add(x); }); while (out.size < 4) out.add(p.r + out.size + 3); return shuffle(Array.from(out)); }
const mtNum = (n, o) => n < 100 ? hand.sign(n, o) : hand.signParts(bdBlocksFor(n), o);
/* The problem is built on the page as a row (Colleen): (hand: a number) (operation) (hand: a number) (operation) (hand or answer). Each hand
   tile is its own small 3D hand that signs its part when tapped; ▶ Play all plays the row left to right. */
MT.hands = [];
function mtHand(k, tile, two) { const T = tileHand(k, tile, two ? 'two' : '', MT.tone); const H = MT.hands[k] = MT.hands[k] || {}; H.canvas = T.canvas; H.hand = T.hand; return H; }
function mtLayout(p) {      /* what each of the five spots holds */
  if (S.mtStyle === 'insert') { const n = mtOrder(p); return [{ num: n[0] }, { blank: true }, { num: n[1] }, { blank: true }, { num: n[2] }]; }
  if (S.mtStyle === 'build') return p.eqFirst ? [{ num: p.r }, { op: '=' }, { num: p.a }, { op: p.op }, { num: p.b }] : [{ num: p.a }, { op: p.op }, { num: p.b }, { op: '=' }, { num: p.r }];      /* the whole true sentence is signed; a box under each tile */
  return [{ num: p.a }, { op: p.op }, { num: p.b }, { op: p.end }, S.mtStyle === 'solve' ? { box: true } : S.mtStyle === 'pick' ? { q: true } : null].filter(Boolean);
}
function mtBuild() {
  const p = MT.cur, row = $('#mt-row'); row.innerHTML = ''; MT.spots = mtLayout(p); MT.sel = 1;
  row.style.gridTemplateColumns = 'repeat(' + MT.spots.length + ', 1fr)';
  MT.spots.forEach((sp, k) => {
    const t = document.createElement('div');
    if (S.mtStyle === 'build') { const cell = document.createElement('div'); cell.className = 'mt-cell'; cell.appendChild(t); const d = document.createElement('div'); d.className = 'mt-drop' + (sp.op ? ' op' : ''); d.dataset.k = k;
      if (sp.op) { d.setAttribute('role', 'button'); d.setAttribute('aria-label', 'Operation box ' + (k + 1)); d.onclick = () => { if (MT.answered) return; if (MT.pick) { d.textContent = MT.pick; MT.pick = null; $$('#mt-bank .chip-op').forEach(c => c.classList.remove('sel')); } else d.textContent = ''; }; }
      else d.innerHTML = '<input type="text" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Number ' + (k + 1) + '">';
      cell.appendChild(d); row.appendChild(cell); }
    else row.appendChild(t);
    if (sp.num !== undefined || sp.op) { t.className = 'mt-tile hand'; t.setAttribute('role', 'button'); t.setAttribute('aria-label', 'Watch part ' + (k + 1)); t.innerHTML = '<span class="ap-tap">▶ tap</span>'; mtHand(k, t, !!sp.op); t.onclick = () => mtRun(k); }
    else if (sp.blank) { t.className = 'mt-tile blank' + (k === MT.sel ? ' sel' : ''); t.textContent = ''; t.setAttribute('role', 'button'); t.setAttribute('aria-label', 'Blank'); t.onclick = () => { MT.sel = k; $$('#mt-row .blank').forEach(b => b.classList.toggle('sel', b === t)); }; }
    else if (sp.box) { t.className = 'mt-tile box'; t.innerHTML = '<input id="mt-box" type="text" inputmode="numeric" autocomplete="off" maxlength="6" aria-label="Your answer">'; t.querySelector('input').onkeydown = e => { if (e.key === 'Enter') mtAnswer(e.target.value); }; }
    else if (sp.q) { t.className = 'mt-tile box'; t.textContent = '?'; }
  });
}
function mtBank() {      /* Read and build: the five operation tiles in a mixed order; drag one into a box (or tap it, then tap the box) */
  const bank = $('#mt-bank'); MT.pick = null; bank.hidden = S.mtStyle !== 'build'; if (bank.hidden) { bank.innerHTML = ''; return; }
  bank.innerHTML = shuffle(['+', '−', '×', '÷', '=']).map(x => '<div class="chip-op" role="button" aria-label="Operation ' + x + '" data-v="' + x + '">' + x + '</div>').join('');
  $$('#mt-bank .chip-op').forEach(c => c.onpointerdown = e => {
    if (MT.answered) return; e.preventDefault(); const x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
    const move = ev => { if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { ghost = document.createElement('div'); ghost.className = 'mt-ghost'; ghost.textContent = c.dataset.v; document.body.appendChild(ghost); }
      if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; const el = document.elementFromPoint(ev.clientX, ev.clientY), d = el && el.closest('.mt-drop.op'); if (over && over !== d) over.classList.remove('hot'); over = d; if (d) d.classList.add('hot'); } };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      if (ghost) { ghost.remove(); if (over) { over.textContent = c.dataset.v; over.classList.remove('hot'); } }
      else { const was = MT.pick === c.dataset.v; MT.pick = was ? null : c.dataset.v; $$('#mt-bank .chip-op').forEach(x => x.classList.toggle('sel', !was && x === c)); } };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  });
}
const mtPer = () => Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
function mtPart(k) { const sp = MT.spots[k], H = MT.hands[k], per = mtPer(); if (!H) return Promise.resolve();
  return H.hand.ready.then(() => sp.op ? H.hand.signOp(sp.op, { per }) : sp.num < 100 ? H.hand.sign(sp.num, { per, teens: S.snteens === 'mix' ? teensFor() : S.snteens, form: formFor() }) : H.hand.signParts(bdBlocksFor(sp.num), { per })); }
async function mtRun(which) {
  if (!MT.cur || MT.busy) return; MT.busy = true; $('#mt-again').disabled = true;
  const tiles = $$('#mt-row .mt-tile'), list = which === undefined ? MT.spots.map((sp, k) => k).filter(k => MT.hands[k] && (MT.spots[k].num !== undefined || MT.spots[k].op)) : [which];
  try { for (const k of list) { tiles[k] && tiles[k].classList.add('on'); await mtPart(k); tiles[k] && tiles[k].classList.remove('on'); } }
  finally { MT.busy = false; $('#mt-again').disabled = false; if (MT.queued) { MT.queued = false; mtNew(); } }
}
const mtPlay = () => mtRun();
function mtNew() {
  if (MT.busy) { MT.queued = true; return; } const [ops, max] = mtSet(); MT.cur = mtMake(ops, max); MT.answered = false;
  const inp = $('#mt-in'); inp.value = ''; inp.className = ''; inp.disabled = false; $('#mt-check').disabled = false; $('#mt-check2').disabled = false; $('#mt-msg').textContent = '';
  if (!MT.tone) MT.tone = hand.dealTone(); mtBuild(); mtBank();      /* math: one tone for the whole visit */
  $('#mt-picks').innerHTML = S.mtStyle === 'pick' ? mtChoices(MT.cur).map(x => '<button class="btn ghost" data-v="' + x + '">' + x + '</button>').join('') : '';
  $$('#mt-picks button').forEach(b => b.onclick = () => mtAnswer(b.dataset.v, b));
  const R = MT.cur; Promise.all(MT.hands.filter(Boolean).map(H => H.hand.ready)).then(smooth).then(() => { if (MT.cur === R) mtPlay(); });
  if (S.mtStyle === 'write') setTimeout(() => inp.focus(), 50);
}
function mtAnswer(v, btn) {
  const p = MT.cur; if (!p || MT.answered) return;
  if (S.mtStyle === 'insert') { const t = $$('#mt-row .mt-tile'); if (t[1].textContent === '' || t[3].textContent === '') { $('#mt-msg').textContent = 'Fill both blanks first.'; return; } v = MT.spots.map((sp, k) => sp.blank ? t[k].textContent : sp.num).join(''); }
  if (S.mtStyle === 'solve' && v === undefined) v = ($('#mt-box') || {}).value || '';
  if (S.mtStyle === 'build') {
    const ds = $$('#mt-row .mt-drop'); if (ds.some(d => d.classList.contains('op') ? d.textContent === '' : d.querySelector('input').value.trim() === '')) { $('#mt-msg').textContent = 'Fill every box first.'; return; }
    let all = true; MT.answered = true; MT.tries++;
    ds.forEach((d, k) => { const sp = MT.spots[k], ok = sp.op ? ({ '+': '+', '−': '-', '×': 'x', '÷': '/', '=': '=' })[d.textContent] === sp.op : +d.querySelector('input').value.replace(/[^\d]/g, '') === sp.num; d.classList.add(ok ? 'ok' : 'no'); if (!ok) all = false; if (!sp.op) d.querySelector('input').disabled = true; });
    if (all) MT.right++; const p2 = MT.cur;
    $('#mt-msg').textContent = (all ? 'Right! ' : 'Not quite. ') + 'The hand signed ' + MT.spots.map(sp => sp.op ? (sp.op === '=' ? '=' : MT_SYM[sp.op]) : sp.num).join(' ') + '.';
    $('#mt-score').textContent = MT.right + ' of ' + MT.tries + ' right so far.'; $('#mt-check2').disabled = true;
    if (all && window.confetti) window.confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } }); return;
  }
  if (String(v).trim() === '') return;
  let good;
  if (S.mtStyle === 'write') { const t = String(v).toLowerCase().replace(/\s+/g, '').replace(/[×*x]/g, 'x').replace(/[÷/]/g, '/').replace(/[−–—]/g, '-'), m = /^(\d+)([-+x\/])(\d+)(?:=(\d*|\?)|\?)?$/.exec(t);      /* 4+2, 4+2=, 4+2=6 or 4+2=? all count; = never has to be typed (Colleen) */
    good = !!m && +m[1] === p.a && m[2] === p.op && +m[3] === p.b && (m[4] === undefined || m[4] === '' || m[4] === '?' || +m[4] === p.r); }
  else if (S.mtStyle === 'insert') good = mtTrue(v, p);
  else good = +String(v).replace(/[^\d]/g, '') === p.r && /\d/.test(v);
  MT.answered = true; MT.tries++; if (good) MT.right++;
  const last = $$('#mt-row .mt-tile'); if (S.mtStyle === 'insert') [1, 3].forEach(k => { last[k].classList.remove('sel'); last[k].classList.add(good ? 'ok' : 'no'); }); if (S.mtStyle === 'solve') { last[4].classList.add(good ? 'ok' : 'no'); const bx = $('#mt-box'); if (bx) bx.disabled = true; } if (S.mtStyle === 'pick' || S.mtStyle === 'solve') { last[last.length - 1].classList.add(good ? 'ok' : 'no'); if (S.mtStyle === 'pick') last[last.length - 1].textContent = p.r; }
  $('#mt-check2').disabled = true;
  const inp = $('#mt-in'); if (S.mtStyle === 'pick') { $$('#mt-picks button').forEach(b => { b.disabled = true; if (+b.dataset.v === p.r) b.classList.add('ok'); }); if (!good && btn) btn.classList.add('no'); } else { inp.classList.add(good ? 'ok' : 'no'); inp.disabled = true; $('#mt-check').disabled = true; }
  $('#mt-msg').textContent = S.mtStyle === 'insert' ? (good ? 'Right! ' : 'Not this time. ') + 'The hand signed ' + mtOrder(p).join(', ') + ': ' + (p.eqFirst ? p.r + ' = ' + p.a + ' ' + MT_SYM[p.op] + ' ' + p.b : p.a + ' ' + MT_SYM[p.op] + ' ' + p.b + ' = ' + p.r) + '.' : (good ? 'Right! ' : 'Not this time. ') + 'The hand signed ' + mtText(p) + '.' + (S.mtStyle === 'write' ? '' : ' The answer is ' + p.r + '.');
  $('#mt-score').textContent = MT.right + ' of ' + MT.tries + ' right so far.';
  if (good && window.confetti) window.confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
}
function mtDraw() {
  const lv = S.mtLevel, [ops, max] = mtSet();
  $('#mt-custom').hidden = lv !== 'custom';
  $('#mt-levelnote').textContent = lv === 'custom' ? '' : ops.map(o => MT_SYM[o]).join(' ') + ', numbers up to ' + max + '.';
  $('#mt-how').textContent = { write: 'Tap each hand to watch it sign. Then type the problem (like 7 + 5, 7 + 5 = or 7 + 5 = 12).', solve: 'Tap each hand to watch it sign. Then type the answer in the last box.', pick: 'Tap each hand to watch it sign. Then pick the answer.', insert: 'Tap each hand to watch it sign a number. One blank is an operation and the other is =. Tap a blank, then a sign button to fill it.', build: 'Tap each hand to watch it sign. Type each number in the box under its hand, and drag the right operation tile into each operation box.' }[S.mtStyle];
  $('#mt-answer').hidden = S.mtStyle !== 'write'; $('#mt-keys').hidden = S.mtStyle !== 'write' && S.mtStyle !== 'insert'; $('#mt-checkrow').hidden = S.mtStyle !== 'insert' && S.mtStyle !== 'solve' && S.mtStyle !== 'build'; $('#mt-bank').hidden = S.mtStyle !== 'build';
}
function mtShow() { MT.tone = hand.dealTone(); parkStage(); ageFace(false); speedNow = () => S.speed; $('#mt-speed').value = Math.round(S.speed * 100); mtDraw(); if (!MT.cur) setTimeout(mtNew, 300); else $$('#mt-row .mt-tile.hand').forEach(t => { const k = [...$('#mt-row').querySelectorAll('.mt-tile')].indexOf(t); tileHand(k, t, MT.spots[k] && MT.spots[k].op ? 'two' : '', MT.tone); }); }
function mathInit() {
  if (!S.mtStyle) S.mtStyle = 'solve'; if (!S.mtLevel) S.mtLevel = 'easy'; if (!Array.isArray(S.mtOps)) S.mtOps = ['+', '-']; if (!S.mtMax) S.mtMax = '10';
  segInit('mt-style', 'mtStyle', () => { mtDraw(); mtNew(); }); segInit('mt-level', 'mtLevel', () => { mtDraw(); mtNew(); }); segInit('mt-max', 'mtMax', mtDraw);
  chipsInit($('#mt-ops'), ['+', '-', 'x', '/'], 'mtOps', x => MT_SYM[x], mtDraw);
  $('#mt-go').onclick = mtNew; $('#mt-again').onclick = mtPlay; $('#mt-check').onclick = () => mtAnswer($('#mt-in').value);
  $('#mt-in').onkeydown = e => { if (e.key === 'Enter') mtAnswer($('#mt-in').value); };
  $('#mt-keys').onclick = e => { const b = e.target.closest('button'); if (!b || !b.dataset.k) return;
    if (S.mtStyle === 'insert') { if (MT.answered) return; const t = $$('#mt-row .mt-tile'), k = MT.sel; if (!t[k] || !MT.spots[k].blank) return; t[k].textContent = b.dataset.k; const other = k === 1 ? 3 : 1; if (t[other].textContent === '') { MT.sel = other; $$('#mt-row .blank').forEach(x => x.classList.toggle('sel', x === t[other])); } return; }
    const i = $('#mt-in'); i.value += b.dataset.k; i.focus(); };
  $('#mt-check2').onclick = () => mtAnswer();
  const mtClear = () => {      /* Colleen: a way to clear selections before checking */
    if (MT.answered || !MT.cur) return;
    if (S.mtStyle === 'insert') { const t = $$('#mt-row .mt-tile'); [1, 3].forEach(k => { if (t[k]) t[k].textContent = ''; }); MT.sel = 1; $$('#mt-row .blank').forEach(x => x.classList.toggle('sel', x === t[1])); }
    else if (S.mtStyle === 'build') { $$('#mt-row .mt-drop').forEach(d => { if (d.classList.contains('op')) d.textContent = ''; else d.querySelector('input').value = ''; }); MT.pick = null; $$('#mt-bank .chip-op').forEach(c => c.classList.remove('sel')); }
    else if (S.mtStyle === 'solve') { const b = $('#mt-box'); if (b) { b.value = ''; b.focus(); } }
    else { const i = $('#mt-in'); i.value = ''; i.focus(); }
    $('#mt-msg').textContent = '';
  };
  $('#mt-clear').onclick = mtClear; $('#mt-clear2').onclick = mtClear;
  $('#mt-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
}

/* ---------- When Did It Happen? (Colleen, 2026-10-15): an event (her picture, or a placeholder box with its name until the picture comes),
   four hands, each signing a year when tapped (one at a time, like the timeline). The four years: the right one, a possible one (the same
   times, 12-40 years off), a look-alike when signed (digits swapped, a century off, ten off), and one that could not be (300+ years off).
   Pictures go in fingerspelling-site/events/ and are named in themes.js EVENTS (img), the same as the timeline. ---------- */
const EY = { hands: [], cur: null, right: 0, tries: 0, used: [], answered: false };
const EY_NOW = new Date().getFullYear();
function eyChoices(n) {      /* returns [{ y, kind }] for the right year and three others, all different and from 1000 to this year */
  const ok = x => x >= 1000 && x <= Math.min(2099, EY_NOW) && x !== n, far = (x, l, d) => l.every(c => Math.abs(c.y - x) >= d), out = [{ y: n, kind: 'right' }];
  const a = Math.floor(n / 100), b = n % 100, look = [];
  if (b >= 10 && b % 11 && b % 10) look.push(a * 100 + (b % 10) * 10 + Math.floor(b / 10));      /* 1969 / 1996 */
  if (n >= 2001 && n <= 2009) look.push(1900 + b);      /* 2005 / 1905 */
  look.push(n + 100, n - 100, n + 10, n - 10);
  const L = shuffle(look.slice(0, 2)).concat(look.slice(2)).find(x => ok(x)); out.push({ y: L, kind: 'look' });
  let P, t = 0; do { P = n + (Math.random() < 0.5 ? -1 : 1) * (12 + Math.floor(Math.random() * 29)); } while (t++ < 200 && !(ok(P) && far(P, out, 5)));
  out.push({ y: P, kind: 'possible' });
  let U; t = 0; do { U = 1000 + Math.floor(Math.random() * (EY_NOW - 1000 + 1)); } while (t++ < 500 && !(ok(U) && Math.abs(U - n) >= 300 && far(U, out, 40)));
  out.push({ y: U, kind: 'far' });
  return shuffle(out);
}
function eyEvent() { const E = window.EVENTS || []; if (EY.used.length >= E.length) EY.used = []; let i; do { i = Math.floor(Math.random() * E.length); } while (EY.used.indexOf(i) >= 0); EY.used.push(i); return E[i]; }
function eyHand(k, tile) { const T = tileHand(k, tile, '', EY.tone); const H = EY.hands[k] = EY.hands[k] || {}; H.canvas = T.canvas; H.hand = T.hand; }
function eyDraw() {
  const e = eyEvent(), ch = eyChoices(e.year); EY.cur = { e, ch }; EY.answered = false;
  $('#ey-event').innerHTML = e.img ? '<img src="events/' + esc(e.img) + '" alt="' + esc(e.title) + '">' : '<div class="ey-ph"><span class="ic" aria-hidden="true">' + esc(e.icon || '📅') + '</span><b>' + esc(e.title) + '</b><small>picture coming</small></div>';
  $('#ey-msg').textContent = ''; $('#ey-next').hidden = true;
  const tone = EY.tone = hand.dealTone(), grid = $('#ey-grid'); grid.innerHTML = '';
  ch.forEach((c, k) => {
    const tile = document.createElement('div'); tile.className = 'ap-choice ey-choice'; tile.dataset.k = k; tile.setAttribute('role', 'button'); tile.setAttribute('aria-label', 'Watch hand ' + 'ABCD'[k]);
    tile.innerHTML = '<span class="ap-tag">' + 'ABCD'[k] + '</span><span class="ap-tap">▶ tap</span>'; tile.onclick = () => eyWatch(k);
    const cell = document.createElement('div'); cell.className = 'ap-cell'; cell.appendChild(tile); cell.insertAdjacentHTML('beforeend', '<button class="btn ghost ap-pickbtn" data-k="' + k + '">Pick ' + 'ABCD'[k] + '</button>'); grid.appendChild(cell);
    eyHand(k, tile); EY.hands[k].hand.ready.then(() => EY.hands[k].hand.setTone(tone));
  });
  $$('#ey-grid .ap-pickbtn').forEach(b => b.onclick = () => eyPick(+b.dataset.k));
}
function eyWatch(k) {
  const R = EY.cur, H = EY.hands[k]; if (!R || !H || H.busy) return; H.busy = true;
  H.hand.ready.then(smooth).then(() => EY.cur === R && H.hand.signYear(R.ch[k].y, { per: tlPer() })).finally(() => { H.busy = false; });
}
const EY_WHY = { right: 'the right year', possible: 'possible, the same times, but not it', look: 'looks alike when signed', far: 'way off' };
function eyPick(k) {
  if (EY.answered || !EY.cur) return; EY.answered = true; EY.tries++;
  const R = EY.cur, good = R.ch[k].kind === 'right'; if (good) EY.right++;
  $$('#ey-grid .ap-cell').forEach((cell, j) => { const c = R.ch[j], b = cell.querySelector('.ap-pickbtn'), t = cell.querySelector('.ap-choice'); b.disabled = true;
    if (c.kind === 'right') { b.classList.add('ok'); t.classList.add('ok'); } else if (j === k) { b.classList.add('no'); t.classList.add('no'); }
    t.insertAdjacentHTML('beforeend', '<span class="ap-age">' + c.y + '</span>'); cell.insertAdjacentHTML('beforeend', '<span class="ey-why">' + EY_WHY[c.kind] + '</span>'); });
  $('#ey-msg').textContent = (good ? 'Right! ' : 'Not this time. ') + R.e.title + ': ' + R.e.year + '.';
  $('#ey-score').textContent = EY.right + ' of ' + EY.tries + ' right so far.'; $('#ey-next').hidden = false;
  if (good && window.confetti) window.confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
}
function eyShow() { $('#ey-speed').value = Math.round(S.speed * 100); if (!EY.cur) setTimeout(eyDraw, 50); else $$('#ey-grid .ap-choice').forEach((t, k) => tileHand(k, t, '', EY.tone)); }
function eventyearInit() { $('#ey-next').onclick = eyDraw; $('#ey-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); }; }

/* ---------- Timeline (Colleen, 2026-10-15): 5 events, no year twice, fairly spread apart (two may be close). Proportional ticks on a line;
   below each tick a spot for a hand that signs a year, above it a spot for the event. Drag (or tap, then tap a spot), then Check. ---------- */
const TL = { n: 5, ev: [], hands: [], sel: null, drag: null };
function tlPick() {
  const bank = (window.EVENTS || []).filter(e => e.year >= 1000 && e.year <= 2099); if (bank.length < TL.n) return bank.slice().sort((a, b) => a.year - b.year);
  const ys = bank.map(e => e.year), close = Math.max(15, (Math.max(...ys) - Math.min(...ys)) / 25); let best = null;
  for (let t = 0; t < 400; t++) {
    const pick = [], used = new Set();
    for (const e of shuffle(bank)) { if (pick.length >= TL.n) break; if (!used.has(e.year)) { used.add(e.year); pick.push(e); } }
    pick.sort((a, b) => a.year - b.year);
    const tight = pick.slice(1).filter((e, i) => e.year - pick[i].year < close).length;
    if (tight <= 1) return pick;
    if (!best || tight < best.t) best = { pick, t: tight };
  }
  return best.pick;
}
const tlPer = () => Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
function tlHandItem(k, year) {
  const T = tileHand(k, null, '', TL.tone); const H = TL.hands[k] = TL.hands[k] || {}; H.canvas = T.canvas; H.hand = T.hand;
  const it = document.createElement('div'); it.className = 'tl-item tl-hand'; it.dataset.kind = 'hand'; it.dataset.year = year; it.dataset.k = k;
  it.setAttribute('aria-label', 'A hand signing a year. Tap to watch it.'); it.appendChild(TL.hands[k].canvas);
  it.insertAdjacentHTML('beforeend', '<span class="tl-play">▶ tap</span>'); return it;
}
function tlEventItem(e) {
  const it = document.createElement('div'); it.className = 'tl-item tl-ev'; it.dataset.kind = 'ev'; it.dataset.year = e.year;
  it.innerHTML = e.img ? '<img src="events/' + esc(e.img) + '" alt="' + esc(e.title) + '">' : '<span class="ic" aria-hidden="true">' + esc(e.icon || '📅') + '</span>' + esc(e.title);
  if (S.tlYears === 'show') it.insertAdjacentHTML('beforeend', '<span class="tl-yr">' + e.year + '</span>');      /* Colleen: a version with the year on each event (match the signed years to the events) */
  it.title = e.title; return it;
}
function tlNew() {
  TL.tone = hand.dealTone(); const ev = TL.ev = tlPick(); TL.sel = null; TL.checked = false; $('#tl-msg').textContent = ''; $('#tl-msg').className = 'hint'; $('#tl-show').hidden = true;
  const lo = ev[0].year, hi = ev[ev.length - 1].year, pct = y => 6 + 88 * (y - lo) / ((hi - lo) || 1);
  const W = $('#tl-board').clientWidth || 800, slot = Math.max(54, Math.min(W < 640 ? 84 : 118, Math.floor(W / ev.length) - 8)), minSep = Math.min(100 * (slot + 6) / W, 100 / ev.length);
  $('#tl-board').style.setProperty('--slot', slot + 'px');      /* the spots shrink to fit a narrow screen (a phone) */
  let xs = ev.map(e => pct(e.year));
  for (let it = 0; it < 60; it++) { for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < minSep) { const m = (xs[i] + xs[i - 1]) / 2; xs[i - 1] = m - minSep / 2; xs[i] = m + minSep / 2; }
    xs = xs.map(x => Math.min(100 - minSep / 2, Math.max(minSep / 2, x))); }      /* close years: the spots move apart; a dashed line still points to the true tick */
  $('#tl-axis').innerHTML = ev.map(e => '<span class="tick" style="left:' + pct(e.year).toFixed(2) + '%"></span>').join('');
  $('#tl-top').innerHTML = xs.map((x, i) => '<div class="tl-slot" data-kind="ev" data-i="' + i + '" style="left:' + x.toFixed(2) + '%" aria-label="Event spot ' + (i + 1) + '"></div>').join('');
  $('#tl-bottom').innerHTML = xs.map((x, i) => '<div class="tl-slot" data-kind="hand" data-i="' + i + '" style="left:' + x.toFixed(2) + '%" aria-label="Year spot ' + (i + 1) + '"></div>').join('');
  requestAnimationFrame(() => {      /* dashed lines from each tick to its two spots */
    const b = $('#tl-board').getBoundingClientRect(), ax = $('#tl-axis').getBoundingClientRect(), ay = ax.top - b.top + 2;
    TL.pts = []; $('#tl-links').innerHTML = ev.map((e, i) => { const tx = b.width * pct(e.year) / 100, top = $$('#tl-top .tl-slot')[i].getBoundingClientRect(), bot = $$('#tl-bottom .tl-slot')[i].getBoundingClientRect(); TL.pts[i] = [(tx + top.left - b.left + top.width / 2) / 2, (ay - 10 + top.bottom - b.top) / 2];      /* halfway up the line to the picture: close years keep their X's apart */
      return '<line data-i="' + i + '" x1="' + tx + '" y1="' + (ay - 10) + '" x2="' + (top.left - b.left + top.width / 2) + '" y2="' + (top.bottom - b.top) + '"/><line data-i="' + i + '" x1="' + tx + '" y1="' + (ay + 10) + '" x2="' + (bot.left - b.left + bot.width / 2) + '" y2="' + (bot.top - b.top) + '"/>'; }).join(''); tlPairMarks();
  });
  const handTray = $('#tl-hands'), evTray = $('#tl-events'); handTray.innerHTML = ''; evTray.innerHTML = '';
  shuffle(ev.map((e, k) => k)).forEach((k, j) => handTray.appendChild(tlHandItem(j, ev[k].year)));
  shuffle(ev).forEach(e => evTray.appendChild(tlEventItem(e)));
}
function tlPlay(it) { const H = TL.hands[+it.dataset.k]; if (!H || H.busy) return; H.busy = true; H.hand.ready.then(() => H.hand.signYear(+it.dataset.year, { per: tlPer() })).finally(() => { H.busy = false; }); }      // a second tap waits until the year is done
const tlFits = (it, t) => !!t && (t.dataset.kind || t.dataset.tray) === it.dataset.kind;
function tlTargetAt(x, y, it) { const el = document.elementFromPoint(x, y), t = el && el.closest('.tl-slot, .tl-tray'); return tlFits(it, t) ? t : null; }
function tlHot(t) { $$('.tl-slot.hot, .tl-tray.hot').forEach(x => x !== t && x.classList.remove('hot')); if (t) t.classList.add('hot'); }
function tlSelect(it) { $$('.tl-item.sel').forEach(x => x.classList.remove('sel')); TL.sel = it; if (it) it.classList.add('sel'); }
function tlPlace(it, t) {
  const from = it.parentElement;
  if (t.classList.contains('tl-slot')) { const other = t.querySelector('.tl-item'); if (other && other !== it) { if (from.classList.contains('tl-slot')) from.appendChild(other); else (other.dataset.kind === 'hand' ? $('#tl-hands') : $('#tl-events')).appendChild(other); } }
  t.appendChild(it); $$('.tl-slot.ok, .tl-slot.no').forEach(x => x.classList.remove('ok', 'no'));
}
function tlCheck() {
  let yr = 0, evn = 0, filled = 0;
  ['#tl-bottom', '#tl-top'].forEach(sel => $$(sel + ' .tl-slot').forEach((slot, i) => { const it = slot.querySelector('.tl-item'); slot.classList.remove('ok', 'no'); if (!it) return; filled++;
    const ok = +it.dataset.year === TL.ev[i].year; slot.classList.add(ok ? 'ok' : 'no'); if (ok) { if (sel === '#tl-bottom') yr++; else evn++; } }));
  const n = TL.ev.length;
  const msg = $('#tl-msg'); msg.classList.add('res'); msg.classList.toggle('allok', filled > 0 && yr === n && evn === n); msg.classList.toggle('some', filled > 0 && !(yr === n && evn === n));
  setTimeout(() => msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);      /* Colleen: the results were too easy to miss */
  $('#tl-msg').textContent = !filled ? 'Put the hands and the events on the timeline first.' : yr === n && evn === n ? 'All right! Every year and every event is in its place. 🎉' :
    'Checked! Years in the right spot: ' + yr + ' of ' + n + '. Events above the right year: ' + evn + ' of ' + n + '. Green ✓ is right; red ✗ needs another look.';
  TL.checked = true; tlPairMarks();
  $('#tl-show').hidden = false;
  if (yr === n && evn === n && window.confetti) window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
}
function tlPairMarks() {      /* after Check: each picture and the hand under it get a green line if they are the same year (even out of order), a red X if not (Colleen); redrawn with the lines */
  const svg = $('#tl-links'); if (!svg) return; svg.querySelectorAll('.tl-x').forEach(x => x.remove()); svg.querySelectorAll('line').forEach(l => l.classList.remove('pair-ok', 'pair-no')); if (!TL.checked) return;
  $$('#tl-top .tl-slot').forEach((slot, i) => { const e = slot.querySelector('.tl-item'), h = ($$('#tl-bottom .tl-slot')[i] || slot).querySelector('.tl-hand'); if (!e || !h || !TL.pts || !TL.pts[i]) return;
    const same = e.dataset.year === h.dataset.year; svg.querySelectorAll('line[data-i="' + i + '"]').forEach(l => l.classList.add(same ? 'pair-ok' : 'pair-no'));
    if (!same) { const [x, y] = TL.pts[i]; svg.insertAdjacentHTML('beforeend', '<g class="tl-x" transform="translate(' + x + ' ' + y + ')"><circle r="15"/><path d="M-7 -7 L7 7 M7 -7 L-7 7"/></g>'); } });
}
function tlReveal() { $$('.tl-ev').forEach(it => { if (!it.querySelector('.tl-yr')) it.insertAdjacentHTML('beforeend', '<span class="tl-yr">' + it.dataset.year + '</span>'); }); }      /* the years go on the event pictures, not the hands (Colleen) */
function tlShowScreen() { $('#tl-speed').value = Math.round(S.speed * 100); if (!TL.ev.length) setTimeout(tlNew, 30); else $$('.tl-hand[data-k]').forEach(it => { const T = tileHand(+it.dataset.k, null, '', TL.tone); it.insertBefore(T.canvas, it.firstChild); }); }
function timelineInit() {
  const root = document.querySelector('[data-screen=timeline]'); if (!root) return;
  if (!S.tlYears) S.tlYears = 'hide'; segInit('tl-yrs', 'tlYears', () => { if (!TL.busy) tlNew(); });
  root.addEventListener('pointerdown', e => { const it = e.target.closest('.tl-item'); if (!it) return; e.preventDefault(); TL.drag = { it, x0: e.clientX, y0: e.clientY, moved: false }; try { it.setPointerCapture(e.pointerId); } catch (x) {} });
  root.addEventListener('pointermove', e => { const d = TL.drag; if (!d) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return; const r = d.it.getBoundingClientRect(); d.dx = d.x0 - r.left; d.dy = d.y0 - r.top; d.moved = true; d.it.style.width = r.width + 'px'; d.it.style.height = r.height + 'px'; d.it.classList.add('dragging'); }
    d.it.style.left = (e.clientX - d.dx) + 'px'; d.it.style.top = (e.clientY - d.dy) + 'px'; tlHot(tlTargetAt(e.clientX, e.clientY, d.it)); });
  const end = e => { const d = TL.drag; if (!d) return; TL.drag = null; if (d.moved && TL.checked) { TL.checked = false; tlPairMarks(); }      /* moving a piece after Check clears the line marks */
    if (d.moved) { d.it.classList.remove('dragging'); ['left', 'top', 'width', 'height'].forEach(k => { d.it.style[k] = ''; }); const t = e.type === 'pointerup' ? tlTargetAt(e.clientX, e.clientY, d.it) : null; tlHot(null); if (t) tlPlace(d.it, t); tlSelect(null); return; }
    if (e.type !== 'pointerup') return;
    if (d.it.dataset.kind === 'hand') tlPlay(d.it);
    tlSelect(TL.sel === d.it ? null : d.it); };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('click', e => { if (e.target.closest('.tl-item') || !TL.sel) return; const t = e.target.closest('.tl-slot, .tl-tray'); if (tlFits(TL.sel, t)) { tlPlace(TL.sel, t); tlSelect(null); } });
  $('#tl-check').onclick = tlCheck; $('#tl-new').onclick = tlNew; $('#tl-show').onclick = tlReveal;
  $('#tl-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
}

/* ---------- Build a number (Colleen): blocks 0-99 and HUNDRED, lined up and played as one number ---------- */
const BD = { tokens: [] };
let bdMarks = [];
/* a group under 1000: [n] (0-99), [d, HUNDRED] or [d, HUNDRED, n] (d 1-9, n 1-99). Returns its value, or a message saying what is wrong */
function bdGroup(t) {
  if (!t.length) return { v: 0 };
  const h = t.indexOf('H');
  if (h < 0) return t.length === 1 ? { v: t[0] } : { bad: 'Two number blocks in a row need HUNDRED or THOUSAND between them (like 3 + HUNDRED + 45).' };
  if (h !== 1 || !(t[0] >= 1 && t[0] <= 9)) return { bad: 'HUNDRED goes right after a number from 1 to 9.' };
  if (t.lastIndexOf('H') !== h) return { bad: 'Use HUNDRED only once in each part.' };
  if (t.length > 3) return { bad: 'After HUNDRED, add just one block (1 to 99).' };
  if (t[2] === 0) return { bad: 'Leave out the 0: 300 is just 3 + HUNDRED.' };
  return { v: t[0] * 100 + (t.length === 3 ? t[2] : 0) };
}
/* the whole row: [group, MILLION]? [group, THOUSAND]? [group]? (Colleen's rules: spoken order, no zeroes that are not spoken) */
function bdThousands(t) {
  const k = t.indexOf('T');
  if (k < 0) return bdGroup(t);
  if (t.lastIndexOf('T') !== k) return { bad: 'Use THOUSAND only once.' };
  if (!k) return { bad: 'Put how many thousands before THOUSAND (like 5 + THOUSAND).' };
  const a = bdGroup(t.slice(0, k)), b = bdGroup(t.slice(k + 1));
  if (a.bad || b.bad) return { bad: a.bad || b.bad };
  if (!a.v) return { bad: 'Leave out the 0 before THOUSAND.' };
  if (t.length > k + 1 && b.v === 0) return { bad: 'Leave out the 0: 4,000 is just 4 + THOUSAND.' };
  return { v: a.v * 1000 + b.v };
}
function bdParse(t) {
  if (!t.length) return { v: null };
  const m = t.indexOf('M');
  if (m < 0) return bdThousands(t);
  if (t.lastIndexOf('M') !== m) return { bad: 'Use MILLION only once.' };
  if (!m) return { bad: 'Put how many millions before MILLION (like 2 + MILLION).' };
  if (t.indexOf('T') >= 0 && t.indexOf('T') < m) return { bad: 'MILLION comes before THOUSAND.' };
  const a = bdGroup(t.slice(0, m)), b = t.length > m + 1 ? bdThousands(t.slice(m + 1)) : { v: 0 };
  if (a.bad || b.bad) return { bad: a.bad || b.bad };
  if (!a.v) return { bad: 'Leave out the 0 before MILLION.' };
  if (t.length > m + 1 && b.v === 0) return { bad: 'Leave out the 0: 3,000,000 is just 3 + MILLION.' };
  return { v: a.v * 1000000 + b.v };
}
const bdCheck = t => bdParse(t).bad || '';
const bdValue = t => bdParse(t).v;
const bdName = n => n === 'H' ? 'HUNDRED' : n === 'T' ? 'THOUSAND' : n === 'M' ? 'MILLION' : String(n);
function bdDraw(playing, fromBlocks) {
  playing = playing || [];
  $('#bd-blocks').innerHTML = BD.tokens.length ? BD.tokens.map((t, i) => '<span class="blk' + (t === 'H' || t === 'T' || t === 'M' ? ' h' : '') + (playing.indexOf(i) >= 0 ? ' now' : '') + '">' + bdName(t) + '</span>').join('<span class="plus">+</span>') : '<span class="hint">Your blocks show up here.</span>';
  const bad = bdCheck(BD.tokens);
  $('#bd-note').textContent = bad; $('#bd-play').disabled = !BD.tokens.length || !!bad;
  $('#bd-total').textContent = BD.tokens.length && !bad ? '= ' + bdValue(BD.tokens).toLocaleString('en-US') : '';
  if (fromBlocks) { $('#bd-whole').value = BD.tokens.length && !bad ? String(bdValue(BD.tokens)) : ''; bdFitType(); }      /* built by hand: the typed box shows the number */
}
/* the blocks for a whole number 0-999, in spoken order: 345 = 3 + HUNDRED + 45 */
const bdUnder = n => n < 100 ? [n] : [Math.floor(n / 100), 'H'].concat(n % 100 ? [n % 100] : []);
const bdBlocksFor = n => { if (n < 1000) return bdUnder(n); const m = Math.floor(n / 1e6), th = Math.floor(n / 1000) % 1000, r = n % 1000;      /* 12,345 = 12 + THOUSAND + 3 + HUNDRED + 45 */
  return (m ? bdUnder(m).concat(['M']) : []).concat(th ? bdUnder(th).concat(['T']) : [], r ? bdUnder(r) : []); };
async function bdPlay() {
  if (!BD.tokens.length || bdCheck(BD.tokens)) return;
  await hand.ready;
  stopFlag = true; while (spelling) await spelling; stopFlag = false;
  newTone();
  const per = Math.round(1000 * Math.pow(0.35, Math.max(0, S.speed)));
  spelling = hand.signParts(BD.tokens.slice(), { per, teens: S.snteens === 'mix' ? pick1(['ten', 'twist']) : S.snteens, form: S.snform === 'mix' ? pick1(['alt', 'main']) : S.snform, hund: S.bdh === 'mix' ? undefined : S.bdh, stop: () => stopFlag, onPart: b => bdDraw(b) });
  try { await spelling; } finally { spelling = null; bdDraw(); }
}
function buildInit() {
  S.bdh = S.bdh || 'mix';
  $('#bd-pad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => '<button class="btn ghost" data-n="' + n + '">' + n + '</button>').join('');
  const add = t => { if (BD.tokens.length >= 12) return; BD.tokens.push(t); BD.lastPad = false; bdDraw(null, true); };
  /* number pad: a digit right after a one-digit block joins it (8 then 5 makes 85, Colleen); otherwise it starts a new block */
  $('#bd-pad').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; const d = +b.dataset.n, last = BD.tokens[BD.tokens.length - 1];
    if (typeof last === 'number' && last < 10 && BD.lastPad) { BD.tokens[BD.tokens.length - 1] = last * 10 + d; BD.lastPad = false; bdDraw(null, true); return; }
    add(d); BD.lastPad = true; };
  $('#bd-add').onclick = () => { const v = $('#bd-num').value.trim(); const n = +v; if (v === '' || !(n >= 0 && n <= 99) || n % 1) { $('#bd-num').focus(); return; } add(n); $('#bd-num').value = ''; };
  $('#bd-num').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#bd-add').click(); } });
  $('#bd-hund').onclick = () => add('H');
  $('#bd-thou').onclick = () => add('T');
  $('#bd-mill').onclick = () => add('M');
  $('#bd-back').onclick = () => { BD.tokens.pop(); BD.lastPad = false; bdDraw(null, true); };
  $('#bd-clear').onclick = () => { BD.tokens = []; bdDraw(null, true); };
  $('#bd-play').onclick = bdPlay;
  /* typing builds the blocks live (Colleen): 3840 shows 3, then 38, then 3 + HUNDRED + 84, then 3 + THOUSAND + 8 + HUNDRED + 40 */
  const typed = () => { const d = $('#bd-whole').value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 9); return d === '' ? null : +d; };
  $('#bd-whole').addEventListener('input', () => { bdFitType(); const n = typed(); BD.tokens = n === null ? [] : bdBlocksFor(n); BD.lastPad = false; bdDraw(); });
  $('#bd-show').onclick = () => { const n = typed(); if (n === null) { $('#bd-whole').focus(); return; } BD.tokens = bdBlocksFor(n); bdDraw(); bdPlay(); };
  $('#bd-whole').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#bd-show').click(); } });
  $('#bd-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
  S.snteens = S.snteens || 'mix'; S.snform = S.snform || 'mix'; bdMarks = [segInit('bd-teens', 'snteens'), segInit('bd-form', 'snform')];      // shared with Show Me Numbers and Sign the Number
  segInit('bd-hstyle', 'bdh');
  bdDraw();
}
/* the hand panel as tall as the two boxes, kept square so the hand is never stretched (Colleen) */
let bdRO = null;
function bdFitStage() {
  const card = $('[data-screen=build] .card.panel'), cols = $('[data-screen=build] .bd-cols'), slot = $('#build-slot'), wrap = $('[data-screen=build] .play');
  if (!card || !cols || !slot || !wrap) return;
  if (window.innerWidth <= 1000) { slot.style.width = ''; slot.style.marginTop = ''; return; }      /* stacked on narrow screens */
  const h = cols.getBoundingClientRect().height, max = wrap.getBoundingClientRect().width - 560;      /* leave the boxes their room */
  slot.style.width = Math.round(Math.max(260, Math.min(h, max))) + 'px';      /* square: as tall as the two boxes */
  slot.style.marginTop = Math.round(cols.getBoundingClientRect().top - card.getBoundingClientRect().top) + 'px';      /* lined up with the boxes */
}
/* longer numbers get a smaller font so they always fit in the box */
function bdFitType() { const el = $('#bd-whole'); let f = 40; el.style.fontSize = f + 'px'; while (f > 14 && el.scrollWidth > el.clientWidth) { f -= 2; el.style.fontSize = f + 'px'; } }      /* shrink until it fits */
function buildShow() { hand.helper(true); putStage('build-slot');
  if (!bdRO && window.ResizeObserver) { bdRO = new ResizeObserver(bdFitStage); bdRO.observe($('[data-screen=build] .bd-cols')); window.addEventListener('resize', bdFitStage); }
  setTimeout(bdFitStage, 30); speedNow = () => S.speed; assist.className = 'assist'; $('#bd-speed').value = Math.round(S.speed * 100); bdMarks.forEach(m => m()); bdDraw(); }

/* ---------- classroom projector mode ---------- */
const CL = { list: [], i: -1, shown: false };
let clWords;
function classInit() {
  clWords = wordList($('[data-list=class]'), 'class');
  const src = () => { $('#cl-cats-box').hidden = S.clsrc === 'list'; $('#cl-list-box').hidden = S.clsrc !== 'list'; };      // cats = names and fingerspelled words; everyday; list
  S.clsrc = S.clsrc || 'everyday'; segInit('cl-src', 'clsrc', src); src();
  $('#cl-start').onclick = () => {
    const words = S.clsrc === 'list' ? clWords.get() : S.clsrc === 'everyday' ? everydayWords(2).map(x => x.w) : poolWords().map(x => x.w);
    if (!words.length) { alert(S.clsrc === 'list' ? 'Type or paste some words first.' : 'No words match the game setup. Choose categories there first.'); return; }
    CL.list = shuffle(words); CL.i = -1; CL.shown = false;
    $('#cl-setup').hidden = true; $('#cl-run').hidden = false; $('#cl-done').innerHTML = ''; clNext();
  };
  $('#cl-next').onclick = clNext; $('#cl-again').onclick = () => { if (CL.i >= 0) spellWord(CL.list[CL.i]); };
  $('#cl-show').onclick = () => { CL.shown = !CL.shown; clDraw(); };
  $('#cl-stop').onclick = () => { stopFlag = true; $('#cl-setup').hidden = false; $('#cl-run').hidden = true; };
  $('#cl-speed').oninput = e => { S.speed = +e.target.value / 100; saveS(); };
}
function clDraw() {
  $('#cl-count').textContent = 'Word ' + (CL.i + 1) + ' of ' + CL.list.length;
  $('#cl-reveal').textContent = CL.shown ? CL.list[CL.i] : '';
  $('#cl-show').textContent = CL.shown ? 'Hide answer' : 'Show answer';
  $('#cl-done').innerHTML = CL.list.slice(0, CL.i).map(w => '<li>' + esc(w) + '</li>').join('') + (CL.i >= 0 ? '<li class="hid">(this word)</li>' : '');
}
function clNext() {
  if (CL.i + 1 >= CL.list.length) { CL.list = CL.list.concat(shuffle(CL.list)); }
  CL.i++; CL.shown = false; clDraw(); spellWord(CL.list[CL.i]);
}
function classShow() { putStage('class-slot'); assist.className = 'assist'; speedNow = () => S.speed; $('#cl-speed').value = Math.round(S.speed * 100); }

/* ---------- Bingo ---------- */
const BG = Object.assign({ title: '', sub: '', ncards: 30, size: 5, perpage: 2, font: '', header: 'BINGO', headerOwn: '', free: 'free', freetext: 'FREE', case: 'as', color: '#2F6BFF', caller: true, speed: 0, who: 'hand', numMode: 'teacher', seed: 0, called: [], shown: false }, store.get('bingo', {}));
if (!BG.v) { BG.font = ''; BG.perpage = BG.perpage || 2; BG.v = 2; }      // settings from a trial version go back to the standard look
const saveBG = () => store.set('bingo', BG);
let bgWords;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cellsOf = cfg => cfg.size * cfg.size - (cfg.free === 'free' && cfg.size % 2 ? 1 : 0);
const cells = () => cellsOf(BG);
/* each card's words come from the game number and the card number, so any card can be checked later without saving the cards */
function cardWords(no, words, cfg) {
  cfg = cfg || BG;
  const r = rng(cfg.seed * 1000 + no), a = words.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const need = cellsOf(cfg), pick = a.slice(0, need), grid = [];
  const mid = cfg.free === 'free' && cfg.size % 2 ? Math.floor(cfg.size * cfg.size / 2) : -1;
  for (let i = 0, k = 0; i < cfg.size * cfg.size; i++) grid.push(i === mid ? null : pick[k++]);
  return grid;
}
const caseOf = w => BG.case === 'upper' ? w.toUpperCase() : BG.case === 'lower' ? w.toLowerCase() : w;
const headerLetters = () => { const h = BG.header === 'custom' ? (BG.headerOwn || '').toUpperCase().replace(/[^A-Z]/g, '') : BG.header; return h && h.length === BG.size ? h.split('') : null; };
function cardHtml(no, words) {
  const grid = cardWords(no, words), H = headerLetters(), n = BG.size, fs = n === 3 ? 26 : n === 4 ? 20 : 16;
  const asl = BG.font === 'ASL', own = BG.font && !asl;      // ASL handshapes: only the words in the squares; the title, letters and FREE stay readable
  let h = '<div class="bcard' + (own ? ' ownfont' : '') + (asl ? ' aslfont' : '') + '" style="--bc:' + esc(BG.color) + (own ? ";font-family:'" + esc(BG.font) + "',Arial,sans-serif" : '') + '"><h4>' + esc(BG.title || 'Fingerspelling Bingo') + '</h4>' + (BG.sub ? '<div class="bsub">' + esc(BG.sub) + '</div>' : '') + '<table>';
  if (H) h += '<tr>' + H.map(L => '<th>' + L + '</th>').join('') + '</tr>';
  for (let r = 0; r < n; r++) { h += '<tr>'; for (let c = 0; c < n; c++) { const w = grid[r * n + c]; h += w === null ? '<td class="free" style="font-size:' + fs + 'px">' + esc(BG.freetext || 'FREE') + '</td>' : '<td style="font-size:' + Math.max(10, fs - Math.max(0, (w || '').length - 8)) + 'px">' + esc(caseOf(w || '')) + '</td>'; } h += '</tr>'; }
  return h + '</table><div class="bno">Card ' + no + '</div></div>';
}
function bingoInit() {
  bgWords = wordList($('[data-list=bingo]'), 'bingo', () => { bgMsg(''); bgPreview(); });
  const F = { 'bg-title': 'title', 'bg-sub': 'sub', 'bg-ncards': 'ncards', 'bg-size': 'size', 'bg-perpage': 'perpage', 'bg-font': 'font', 'bg-header': 'header', 'bg-header-own': 'headerOwn', 'bg-free': 'free', 'bg-freetext': 'freetext', 'bg-case': 'case', 'bg-color': 'color', 'bg-speed': 'speed' };
  Object.keys(F).forEach(id => { const el = document.getElementById(id); el.value = String(BG[F[id]]); el.oninput = el.onchange = () => { const k = F[id]; BG[k] = /^(ncards|size|perpage|speed)$/.test(k) ? +el.value : el.value; if (k === 'size' && BG.size !== 5 && BG.header === 'BINGO') { BG.header = ''; $('#bg-header').value = ''; } saveBG(); bgFields(); bgPreview(); }; });
  const markWho = segInitObj('bg-who', BG, 'who', () => { saveBG(); bgFields(); });
  const peek = on => { const w = BG.called[BG.called.length - 1]; $('#bg-reveal').textContent = on && w ? w : (BG.shown && w ? w : ''); $('#bg-reveal').classList.toggle('peek', on); };
  ['mousedown', 'touchstart'].forEach(ev => $('#bg-peek').addEventListener(ev, e => { e.preventDefault(); peek(true); }));
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => $('#bg-peek').addEventListener(ev, () => peek(false)));
  $('#bg-caller').checked = BG.caller; $('#bg-caller').onchange = e => { BG.caller = e.target.checked; saveBG(); };
  $('#bg-print').onclick = () => { if (!bgReady()) return; bgPrint(); };
  $('#bg-play').onclick = () => { if (!bgReady()) return; BG.liveWaiting = true; $('#bg-setup').hidden = true; $('#bg-run').hidden = false; window.scrollTo(0, 0); bgStage(); bgDraw(); };      // live: opens blank; the first word waits for Call a word
  $('#bg-back').onclick = () => { stopFlag = true; $('#bg-setup').hidden = false; $('#bg-run').hidden = true; parkStage(); };
  $('#bg-next').onclick = bgCall; $('#bg-again').onclick = () => { const w = BG.called[BG.called.length - 1]; if (w) spellWord(w); };
  $('#bg-show').onclick = () => { BG.shown = !BG.shown; saveBG(); bgDraw(); };
  $('#bg-check').onclick = bgCheck; $('#bg-cardno').addEventListener('keydown', e => { if (e.key === 'Enter') bgCheck(); });
  $('#bg-share').onclick = bgShare; $('#bg-share2').onclick = bgShare;
  $('#share-x').onclick = () => { $('#share-box').hidden = true; };
  $('#share-copy').onclick = () => { const i = $('#share-link'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } $('#share-copy').textContent = 'Copied!'; setTimeout(() => { $('#share-copy').textContent = 'Copy link'; }, 1500); };
  $('#bg-reset').onclick = () => { if (confirm('Start a new game with the same cards? The called words are cleared.')) { BG.called = []; BG.shown = false; saveBG(); bgDraw(); $('#bg-cardview').innerHTML = ''; } };
  bgFields(); bgPreview();
}
function bgFields() {
  const live = BG.who === 'live';
  $('#bg-speed-box').hidden = live;
  $('#bg-who-hint').textContent = live ? 'The teacher or a student fingerspells each word. Turn the projector off: the screen shows each word in big letters for the speller, picks the words at random and keeps track.' : 'The hand spells each word, so anyone can run the game. Great for substitutes.';
  $('#bg-header-own-box').hidden = BG.header !== 'custom'; $('#bg-freetext-box').hidden = BG.free !== 'free' || BG.size % 2 === 0; }
function bgReady() {
  const words = bgWords.get(), need = cells();
  if (words.length < need) { bgMsg('Not enough words to start. A ' + BG.size + ' × ' + BG.size + ' card needs at least ' + need + ' different words, and your list has ' + words.length + '. Add ' + (need - words.length) + ' more, or choose a smaller card size.'); return false; }
  const key = letters(words.join('|')).length + ':' + words.length + ':' + BG.size + BG.free;
  if (!BG.seed || BG.key !== key) { BG.seed = 100 + Math.floor(Math.random() * 9000); BG.key = key; BG.called = []; BG.shown = false; saveBG(); }      // new words: a new game number, so old cards are not mixed in
  bgMsg(''); return true;
}
function bgMsg(t) { const m = $('#bg-msg'); m.textContent = t; m.hidden = !t; if (t) m.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
/* the preview card has the size it prints: on a portrait page, 1 card fills it, 2 stack, 4 make a 2 x 2 grid (page 255 mm tall, 6 mm padding, 10 mm gaps) */
const PRINT_SIZE = { 1: [736, 918], 2: [736, 440], 4: [349, 440] };
function bgPreview() {
  const words = bgWords ? bgWords.get() : [], box = $('#bg-preview'); if (!BG.seed) BG.seed = 100;
  if (words.length < cells()) { box.style.width = ''; box.style.height = ''; box.innerHTML = '<p class="hint" style="padding:12px">The preview shows up once you have enough words.</p>'; return; }
  const sz = PRINT_SIZE[BG.perpage] || PRINT_SIZE[2], room = (box.parentNode.clientWidth || 600) - 52, k = Math.min(.6, room / sz[0]);      // shrunk to fit the screen, same shape
  box.style.width = Math.round(sz[0] * k) + 'px'; box.style.height = Math.round(sz[1] * k) + 'px';
  const draw = () => { box.innerHTML = '<div class="bhalf" style="width:' + sz[0] + 'px;height:' + sz[1] + 'px;transform:scale(' + k.toFixed(3) + ')">' + cardHtml(1, words) + '</div>'; };
  draw(); if (BG.font && document.fonts) document.fonts.load("700 20px '" + BG.font + "'").then(draw).catch(() => {});
}
async function bgPrint() {
  if (BG.font && document.fonts) { try { await document.fonts.load("700 20px '" + BG.font + "'"); } catch (e) {} }
  const words = bgWords.get(), per = BG.perpage || 2, n = Math.max(1, Math.min(300, BG.ncards)); let h = '';
  for (let i = 1; i <= n; i += per) { h += '<div class="ppage n' + per + '">'; for (let k = i; k < i + per && k <= n; k++) h += cardHtml(k, words); h += '</div>'; }
  if (BG.caller) h += '<div class="caller"><h4>' + esc(BG.title || 'Fingerspelling Bingo') + ': Caller\'s List</h4>' + words.slice().sort((a, b) => a.localeCompare(b)).map(w => '<div>☐ ' + esc(w) + '</div>').join('') + '</div>';
  $('#print-cards').innerHTML = h;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80); setTimeout(done, 60000);
}
function bgStage() { if (BG.who === 'live') parkStage(); else putStage('bingo-slot'); $('#bingo-slot').hidden = BG.who === 'live'; $('#bg-run').classList.toggle('solo', BG.who === 'live'); }
function bgDraw() {
  const live = BG.who === 'live';
  $('#bg-again').hidden = live; $('#bg-peek').hidden = true; $('#bg-show').hidden = live;      // live: the projector is off, so the word is simply shown to the teacher
  $('#bg-keys').textContent = live ? 'Keys: Enter = call the next word. Spell the word shown, then call the next one.' : 'Keys: Enter = call a word, Space = watch again, A = show the word.';
  $('#bg-called').parentNode.open = live;
  const words = bgWords.get();
  $('#bg-run-title').textContent = BG.title || 'Fingerspelling Bingo';
  $('#bg-count').textContent = BG.called.length + ' of ' + words.length + ' words called';
  const last = BG.called[BG.called.length - 1];
  $('#bg-reveal').textContent = live ? (BG.liveWaiting || !last ? '' : last) : (BG.shown && last ? last : '');
  $('#bg-livenote').hidden = !(live && (BG.liveWaiting || !last));
  $('#bg-show').textContent = BG.shown ? 'Hide the word' : 'Show the word';
  $('#bg-called').innerHTML = BG.called.map(w => '<li>' + esc(w) + '</li>').join('');
  $('#bg-next').disabled = BG.called.length >= words.length;
}
function bgCall() {
  const words = bgWords.get(), left = words.filter(w => BG.called.indexOf(w) < 0);
  if (!left.length) return;
  const w = pick1(left); BG.called.push(w); BG.shown = false; BG.liveWaiting = false; saveBG(); bgDraw(); if (BG.who !== 'live') spellWord(w);
}
function bgCheck() {
  const no = +$('#bg-cardno').value, words = bgWords.get(); if (!no) return;
  const grid = cardWords(no, words), n = BG.size, called = new Set(BG.called.map(letters));      // printed cards are 1, 2, 3...; digital cards have six-digit numbers
  const hit = grid.map(w => w === null || called.has(letters(w)));
  const lines = []; for (let r = 0; r < n; r++) lines.push([...Array(n).keys()].map(c => r * n + c)); for (let c = 0; c < n; c++) lines.push([...Array(n).keys()].map(r => r * n + c));
  lines.push([...Array(n).keys()].map(i => i * n + i)); lines.push([...Array(n).keys()].map(i => i * n + (n - 1 - i)));
  const bingo = lines.some(l => l.every(i => hit[i]));
  let h = '<div class="cardview"><table>'; for (let r = 0; r < n; r++) { h += '<tr>'; for (let c = 0; c < n; c++) { const w = grid[r * n + c]; h += '<td class="' + (hit[r * n + c] ? 'hit' : '') + '">' + esc(w === null ? (BG.freetext || 'FREE') : w) + '</td>'; } h += '</tr>'; }
  $('#bg-cardview').innerHTML = h + '</table><div class="verdict">' + (bingo ? '🎉 Card ' + no + ' has BINGO!' : 'Card ' + no + ': no Bingo yet.') + '</div></div>';
}
function bingoShow() { speedNow = () => BG.speed; assist.className = 'assist'; if (!$('#bg-run').hidden) bgStage(); else bgPreview(); }
window.addEventListener('resize', () => { if (/^#\/bingo/.test(location.hash) && !$('#bg-setup').hidden) bgPreview(); });

/* ---------- digital Bingo cards: the whole game travels in the link, so nothing is stored anywhere ---------- */
const b64u = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function packGame(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'z' + b64u(new Uint8Array(buf)); }
  return 'p' + b64u(raw);
}
async function unpackGame(code) {
  const kind = code.charAt(0), bytes = unb64u(code.slice(1));
  const raw = kind === 'z' ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
async function bgShare() {
  if (!bgReady()) return;
  segInitObj('share-mode', BG, 'numMode', () => { saveBG(); bgShare(); });
  const g = { t: BG.title, u: BG.sub, w: bgWords.get(), s: BG.seed, z: BG.size, f: BG.free, ft: BG.freetext, h: BG.header, ho: BG.headerOwn, c: BG.color, cs: BG.case, n: BG.numMode === 'random' ? 'r' : 't', fo: BG.font || '' };
  const link = location.href.split('#')[0] + '#/card/' + await packGame(g);
  $('#share-link').value = link; $('#share-box').hidden = false; $('#share-qr').innerHTML = 'Making the QR code…';
  $('#share-note').textContent = (BG.numMode === 'random' ? 'Each device picks a random card number from 1 to 999 and shows it at the bottom of the card. Two students can land on the same number; if they do, one taps Get a different number. ' : 'Give each student a different card number from 1 to 999 (seat numbers work well). They type it when they open the link. ') + 'To check a Bingo, type the student\'s number in Check a card. Paper cards use the same numbers, so do not hand out paper card 5 and digital card 5 in the same game.';
  try {
    if (!window.QRCode) await loadScript('lib/qrcode.min.js');
    $('#share-qr').innerHTML = ''; new window.QRCode($('#share-qr'), { text: link, width: 600, height: 600, correctLevel: window.QRCode.CorrectLevel.L });
  } catch (e) { $('#share-qr').innerHTML = '<p class="alert">This word list is too long for a QR code. Share the link instead (paste it into Google Classroom, Canvas or Schoology).</p>'; }
}
let SC = null;      // the student's card
async function cardShow(code) {
  $('#sc-bad').hidden = true; $('#sc-grid').innerHTML = '';
  let g; try { g = await unpackGame(code); } catch (e) { $('#sc-bad').hidden = false; return; }
  const cfg = { seed: g.s, size: g.z, free: g.f }, key = 'card.' + g.s + '.' + letters(g.w.join('')).length;
  const no = store.get(key, 0);      // card numbers 1 to 999, given out by the teacher so no two students share a card (Colleen); remembered after a reload
  SC = { g, cfg, key, no };
  $('#sc-title').textContent = g.t || 'Fingerspelling Bingo';
  const ok = v => v >= 1 && v <= 999;
  const askShow = () => { $('#sc-ask').hidden = false; $('#sc-body').hidden = true; $('#sc-no').textContent = ''; setTimeout(() => $('#sc-first').focus(), 50); };
  $('#sc-first-go').onclick = () => { const v = Math.floor(+$('#sc-first').value); if (!ok(v)) { $('#sc-first-bad').hidden = false; return; } $('#sc-first-bad').hidden = true; SC.no = v; store.set(key, v); $('#sc-ask').hidden = true; $('#sc-body').hidden = false; scDraw(); };
  $('#sc-first').onkeydown = e => { if (e.key === 'Enter') $('#sc-first-go').click(); };
  const pickRandom = () => { let v; do { v = 1 + Math.floor(Math.random() * 999); } while (v === SC.no); SC.no = v; store.set(key, v); };
  $('#sc-dup').hidden = g.n !== 'r';
  $('#sc-new').onclick = () => { pickRandom(); scDraw(); window.scrollTo(0, 0); };
  if (!ok(no) && g.n === 'r') pickRandom();      // the teacher chose random numbers: each device picks one from 1 to 999
  if (ok(SC.no)) { $('#sc-ask').hidden = true; $('#sc-body').hidden = false; scDraw(); } else askShow();
  $('#sc-clear').onclick = () => { store.set(SC.key + '.m.' + SC.no, []); scDraw(); };
  $('#sc-own-go').onclick = () => { const v = Math.floor(+$('#sc-own').value); if (v >= 1 && v <= 999) { SC.no = v; store.set(SC.key, v); $('#sc-own').value = ''; scDraw(); window.scrollTo(0, 0); } };
  $('#sc-own').onkeydown = e => { if (e.key === 'Enter') $('#sc-own-go').click(); };
}
/* each square shrinks its words until the longest one fits on a line and the words fit the square: words never break in the middle */
/* Bingo on a digital card: a full row, column or diagonal of markers (the free space counts) sets off confetti */
function scLineCount() {
  const n = SC.g.z, marks = new Set(store.get(SC.key + '.m.' + SC.no, [])), grid = cardWords(SC.no, SC.g.w, SC.cfg);
  const hit = grid.map((w, i) => w === null || marks.has(i)), lines = [];
  for (let r = 0; r < n; r++) lines.push([...Array(n).keys()].map(c => r * n + c));
  for (let c = 0; c < n; c++) lines.push([...Array(n).keys()].map(r => r * n + c));
  lines.push([...Array(n).keys()].map(i => i * n + i)); lines.push([...Array(n).keys()].map(i => i * n + (n - 1 - i)));
  return lines.filter(l => l.every(i => hit[i])).length;
}
function scBingo(celebrate) {
  const now = scLineCount(), more = now > (SC.lines || 0);
  $('#sc-bingo').hidden = now === 0;
  if (celebrate && more) confettiBurst(SC.g.c);
  SC.lines = now;
}
async function confettiBurst(color) {
  try {
    if (!window.confetti) await loadScript('lib/confetti.browser.min.js');
    const colors = [color || '#2F6BFF', '#FFC83D', '#14804D', '#ffffff', '#be185d'];
    window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors });
    setTimeout(() => window.confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0 }, colors }), 250);
    setTimeout(() => window.confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 1 }, colors }), 400);
  } catch (e) {}
}
let scCtx = null;
function scFit() {
  scCtx = scCtx || document.createElement('canvas').getContext('2d');
  $$('#sc-grid button').forEach(b => {
    const sp = b.querySelector('span') || b, wMax = b.clientWidth - 3, hMax = b.clientHeight - 3, words = sp.textContent.split(' ');
    let f = Math.min(17, Math.max(10, Math.floor(b.clientWidth / 4.5)));
    for (let guard = 0; guard < 30 && f > 6; guard++) {
      b.style.fontSize = f + 'px';
      const cs = getComputedStyle(b); scCtx.font = cs.fontWeight + ' ' + f + 'px ' + cs.fontFamily;
      const widest = Math.max(...words.map(t => scCtx.measureText(t).width));
      if (widest <= wMax && sp.offsetHeight <= hMax) break;
      f -= 1;
    }
  });
}
window.addEventListener('resize', () => { if (/^#\/card\//.test(location.hash) && SC) scFit(); });
function scDraw() {
  const { g, cfg, no } = SC, n = g.z, grid = cardWords(no, g.w, cfg), marks = new Set(store.get(SC.key + '.m.' + no, []));
  const H = (() => { const h = g.h === 'custom' ? (g.ho || '').toUpperCase().replace(/[^A-Z]/g, '') : g.h; return h && h.length === n ? h.split('') : null; })();
  const cs = w => g.cs === 'upper' ? w.toUpperCase() : g.cs === 'lower' ? w.toLowerCase() : w;
  $('#sc-title').textContent = g.t || 'Fingerspelling Bingo'; $('#sc-sub').textContent = g.u || '';
  $('#sc-no').textContent = 'Card ' + no;
  const el = $('#sc-grid'); el.style.setProperty('--bc', g.c || '#2F6BFF'); el.style.fontFamily = g.fo && g.fo !== 'ASL' ? "'" + g.fo + "', Arial, sans-serif" : ''; el.classList.toggle('aslfont', g.fo === 'ASL');
  if (g.fo && document.fonts && !SC.fontWait) { SC.fontWait = true; document.fonts.load("700 20px '" + g.fo + "'").then(() => scFit()).catch(() => {}); } el.style.gridTemplateColumns = 'repeat(' + n + ',minmax(0,1fr))';      // equal columns even with long words
  el.innerHTML = (H ? H.map(L => '<div class="sh">' + L + '</div>').join('') : '') + grid.map((w, i) => w === null
    ? '<button class="free on" data-i="' + i + '" aria-pressed="true">' + esc(g.ft || 'FREE') + '</button>'
    : '<button data-i="' + i + '" class="' + (marks.has(i) ? 'on' : '') + '" aria-pressed="' + marks.has(i) + '"><span>' + esc(cs(w)) + '</span></button>').join('');
  scFit();
  el.onclick = e => { const b = e.target.closest('button'); if (!b || b.classList.contains('free')) return; const i = +b.dataset.i, m = new Set(store.get(SC.key + '.m.' + SC.no, [])); if (m.has(i)) m.delete(i); else m.add(i); store.set(SC.key + '.m.' + SC.no, [...m]); b.classList.toggle('on'); b.setAttribute('aria-pressed', m.has(i)); scBingo(true); };
  el.style.setProperty('--bc', g.c || '#2F6BFF'); $('#sc-bingo').style.setProperty('--bc', g.c || '#2F6BFF');
  SC.lines = scLineCount(); scBingo(false);
}

/* teacher keys: Enter = next, Space = again, A = answer (only on the classroom screens, not while typing) */
document.addEventListener('keydown', e => {
  const h = location.hash; if (!/^#\/(class|bingo)/.test(h) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  const B = h.indexOf('bingo') >= 0, run = B ? !$('#bg-run').hidden : !$('#cl-run').hidden; if (!run) return;
  const k = e.key.toLowerCase();
  if (k === 'enter') { e.preventDefault(); (B ? $('#bg-next') : $('#cl-next')).click(); }
  else if (k === ' ') { e.preventDefault(); (B ? $('#bg-again') : $('#cl-again')).click(); }
  else if (k === 'a') (B ? $('#bg-show') : $('#cl-show')).click();
  else if (k === 'p' && B && BG.who === 'live' && !e.repeat) { const w = BG.called[BG.called.length - 1]; if (w) { $('#bg-reveal').textContent = w; $('#bg-reveal').classList.add('peek'); } }
});
document.addEventListener('keyup', e => { if (e.key.toLowerCase() === 'p' && /^#\/bingo/.test(location.hash) && BG.who === 'live') { const w = BG.called[BG.called.length - 1]; $('#bg-reveal').textContent = BG.shown && w ? w : ''; $('#bg-reveal').classList.remove('peek'); } });

/* ---------- screens ---------- */
const SHOW = { home: null, games: null, card: null, show: showShow, build: buildShow, shownum: snShow, signnum: sgShow, timeline: tlShowScreen, agepics: apShow, eventyear: eyShow, math: mtShow, learn: lnShow, setup: null, play: playShow, results: resultsShow, review: reviewShow, report: reportShow, view: viewShow, progress: progressShow, chart: chartShow, class: classShow, bingo: bingoShow };
function route() {
  const h = location.hash.replace(/^#\/?/, ''), parts = h.split('/'), name = parts[0] || 'home';
  if (offPage(name, parts[1])) { location.replace('#/games'); return; }
  if (SOLO && name !== 'bingo' && name !== 'card') { location.replace('#/bingo'); return; }      // Bingo on its own: only the Bingo maker and shared cards
  stopFlag = true;
  if (name !== 'build' && name !== 'shownum' && name !== 'signnum' && name !== 'learn') hand.helper(false);
  ageFace(false);      /* the age face shows only where ages are signed (its screen turns it back on) */      /* the left hand (for THOUSAND) waits in its corner only where a number might need it */
  if (name === 'letter') {      // a letter from the chart, with the hand
    showScreen('review'); putStage('review-slot'); assist.className = 'assist small'; speedNow = () => S.speed;
    $('#v-title').textContent = 'Letter ' + (parts[1] || ''); $('#v-back').hidden = true; $('#v-again').hidden = true;
    $('#v-list').innerHTML = '<button class="on">' + esc(parts[1] || '') + '</button> <a class="link" href="#/chart">Back to the alphabet</a>';
    $('#v-list').onclick = e => { if (e.target.closest('button')) spellWord(parts[1] || 'A'); }; spellWord(parts[1] || 'A'); return;
  }
  if (!SHOW.hasOwnProperty(name)) { location.hash = '#/'; return; }
  NOPICK = !/^(play|setup|show|review|results|report|card|home|games)$/.test(name);      /* these pages have (or follow) the Skin Tone picker */
  if (NOPICK && h !== TONE_PAGE) hand.ready.then(() => hand.setTone(hand.dealTone()));      /* one new tone per visit (a new lesson counts as a new visit) */
  TONE_PAGE = NOPICK ? h : '';
  showScreen(name === 'play' ? 'setup' : name);
  if (name === 'play' && R) setupShow(R.game);
  if (!/^(play|review|class|bingo|show|build|shownum|signnum|learn)$/.test(name)) parkStage();
  if (name === 'setup') setupShow(parts[1]);
  if (name === 'card') cardShow(h.slice(5));
  if (SHOW[name]) SHOW[name]();
  if (name === 'games' && /[?&]focus=numbers\b/.test(location.search)) setTimeout(() => { const g = $('#g-numgrid'), h = g && (g.previousElementSibling || g); if (h) h.scrollIntoView({ block: 'start' }); }, 50);      // asl.cool/numbers opens on the numbers games
  track('page_view', { page_title: name, page_location: name === 'view' ? location.href.split('#')[0] + '#/view' : location.href });   // never send a report (it holds a name) to the visit counter
}
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.dataset.screen === name));
  window.scrollTo(0, 0);
  $$('.ad').forEach(a => { a.hidden = !CFG.ads; if (CFG.ads) a.textContent = 'Advertisement'; });      // never on a game screen
}
gamesInit(); setupInit(); showInit(); shownumInit(); signnumInit(); timelineInit(); agepicsInit(); eventyearInit(); mathInit(); learnInit(); buildInit(); classInit(); bingoInit();
if (SOLO) {      /* asl.cool/bingo opens ?solo=bingo: Fingerspelling Bingo as its own teacher tool, without the practice site's menus (Colleen) */
  document.title = 'Fingerspelling Bingo'; document.body.classList.add('solo');
  const br = $('.top .brand'); if (br) { br.href = '#/bingo'; br.innerHTML = '<span class="logo" aria-hidden="true">🎱</span> Fingerspelling Bingo'; }
  $$('.top nav a').forEach((x, i) => { if (i) x.remove(); });
}
if (CFG.only) $$('.top nav a.tptlink').forEach(t => t.remove());      // the TpT products themselves (built with CFG.only) do not advertise the store
if (ONLY) {
  $$('[data-only]').forEach(x => { if (x.dataset.only !== ONLY) x.remove(); });
  $$('.top nav a').forEach(x => { const m = (x.getAttribute('href') || '').match(/^#\/(\w+)/); if (m && offPage(m[1])) x.remove(); });
  if (ONLY === 'numbers') { const br = $('.top .brand'); if (br) br.innerHTML = '<span class="logo" aria-hidden="true">🔢</span> ASL Numbers Practice'; document.title = 'ASL Numbers Practice'; }
}
window.addEventListener('hashchange', route);
route();
if (CFG.ga) { const s = document.createElement('script'); s.async = true; s.src = 'https:' + '//www.googletagmanager.com/gtag/js?id=' + CFG.ga; document.head.appendChild(s); window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag('js', new Date()); window.gtag('config', CFG.ga, { send_page_view: false }); }
window.FSP = { hand, S, BG, poolFor, letters, lookAlikes, blurSet, cardWords, reportLink, TL, AP, EY, eyChoices, MT, mtMake, mtNorm, mtTrue, LESSONS, LESSONS_FS, cur: () => R && R.list[R.i], round: () => R };      // for testing in the console
})();
