/* asl.cool/theatre: the Family portal (Colleen 2026-10-24: "look at the parent side of the app as a portal for communication and information
   collection in addition to gaining consent"), and the sizes recorded at school.
   Families (the parent version): what needs their answer, news from the teacher, and four forms for their Company member:
     fit     permission for a teacher to help with trying on clothes on the shopping trip (yes, signed / no, then detailed sizes / not needed);
     sizes   detailed clothing and accessory sizes (every family, not only those who say no);
     sensory sensory and clothing needs and preferences;
     commit  the show-week commitment (school every day of the final weeks, the full dress after school, every performance), checked and signed;
     video   permission to film rehearsals (dance numbers, scene runs) and share them inside the class, for learning (yes / teaching only / no).
   Privacy: a form travels as a note sealed with the show key (Store.queueNote) and waits on the server until a teacher opens Family portal or
   Sizes, which take it into the vault (V.extra.portal[actor][kind], sealed with the teacher password): nobody with the cast or a parent password
   can read the answers, sizes or sensory notes. The show keeps only WHEN each form came in (T.show.portal.got[actor][kind] = 'YYYY-MM-DD'),
   so a family sees "Sent" on any device. Who needs help trying on is a teacher's mark in the vault (fitNeed), never in the show, so every family
   sees the fitting question, worded "only if…", with "Not needed" as an answer.
   Sizes at school (Teacher › Sizes): an adult reads the tags on what a Company member is wearing and records the sizes in the vault
   (V.extra.portal[actor].school, newest first) with Enough / Not enough; the show keeps only T.show.sizeCheck[actor] = { at, ok }. Anyone
   Not enough is on the "Check again" list from the next day on (Teacher home, Costumes, Sizes) until a newer record says Enough.
   T.show.portal = { news: [{ id, at, title, text }], got: { actor: { kind: date } }, fitText, videoText, commitItems: [text], sizesFrom: date } */
(function (root) {
  'use strict';
  /* ---------- the rules, without the page (dev/test-portal.js runs these in node) ---------- */
  var KINDS = ['fit', 'sizes', 'sensory', 'commit', 'video', 'contact'];
  var MAIL_OPTS = [['general', 'News and requests from the teacher (volunteer needs, show dates, reminders)'], ['mine', 'Changes for my Company member (a new role, song or solo, new dance videos, the week’s plan)'],
    ['copies', 'A copy of every email my Company member gets from the app']];
  var SIZE_FIELDS = [
    ['height', 'Height', 'e.g. 5 ft 2 in'], ['weight', 'Weight (optional, helps with fit)', 'e.g. 110 lb'],
    ['shirt', 'Shirt / top', 'e.g. Youth L, Adult S, Women’s M'], ['undershirt', 'Undershirt / camisole', 'e.g. Adult S'],
    ['pants', 'Pants size', 'e.g. Boys 14 slim, Women’s 6, Men’s 30×30'], ['waist', 'Waist (inches)', 'e.g. 28'], ['inseam', 'Inseam (inches)', 'e.g. 29'],
    ['skirt', 'Skirt', 'e.g. Girls 12, Women’s 4'], ['dress', 'Dress', 'e.g. Juniors 5, Women’s 6 petite'], ['shorts', 'Shorts', 'e.g. Youth M'],
    ['tights', 'Tights / leggings', 'e.g. Girls M/L, Women’s A/B'], ['socks', 'Socks', 'e.g. Adult M'],
    ['shoe', 'Shoe size', 'e.g. Women’s 7, Men’s 9, Kids 4'], ['shoeWidth', 'Shoe width', 'e.g. regular, wide (W), narrow'],
    ['hat', 'Hat / head (around the forehead, inches)', 'e.g. 22 in, or S/M'], ['gloves', 'Gloves (if any)', 'e.g. Youth L'],
    ['jacket', 'Jacket / blazer / sweater', 'e.g. Youth XL'], ['brands', 'Brands or stores that fit well', 'e.g. Old Navy slim jeans, Target kids'],
    ['note', 'Anything else about fit', 'e.g. long arms, prefers stretchy waists, wears a brace on one leg']];
  var SENSE_FIELDS = [
    ['fabricsYes', 'Fabrics or feels that are comfortable', 'e.g. soft cotton, worn-in T-shirts, fleece'],
    ['fabricsNo', 'Fabrics or feels to avoid', 'e.g. wool, scratchy lace, stiff denim, sequins'],
    ['tags', 'Tags and seams', 'e.g. tags cut out, seamless socks, no seams at the toes'],
    ['fit', 'Tight or loose', 'e.g. likes snug leggings, nothing tight at the waist or neck'],
    ['textures', 'Other textures, sounds or smells', 'e.g. velcro sounds, hairspray smell, crinkly fabric'],
    ['makeup', 'Makeup: sensitivities or allergies', 'e.g. sensitive skin, allergic to latex sponges, only a little blush'],
    ['hair', 'Hair', 'e.g. no hairspray, gentle brushing, OK with a hat, no wigs'],
    ['changing', 'Changing clothes', 'e.g. needs privacy, needs extra time, needs help with buttons'],
    ['allergies', 'Allergies (fabrics, latex, adhesives, foods at the show)', 'e.g. latex, nickel snaps'],
    ['helps', 'What helps when it is too much', 'e.g. noise-cancelling headphones, a break in the hallway, a weighted lap pad'],
    ['other', 'Anything else that helps', '']];
  var MAKEUP = [['yes', 'Yes, stage makeup is OK'], ['some', 'Some (a little, or only certain things)'], ['no', 'No makeup, please'], ['ask', 'Not sure: let’s talk']];
  var FIT = { yes: 'Yes: a teacher may help', no: 'No, thank you: I’ll give detailed sizes', self: 'Not needed: tries on clothes on their own' };
  var DEF_FIT = 'On the costume shopping trip (Wednesday, October 13, 2027), Company members try on clothes before we buy them. Some Company members need an adult’s help to try on clothes: for example with buttons, zippers or shoes, getting clothes on and off, or checking the fit. With your permission, a teacher or school staff member may help your child try on clothes in the store’s fitting room. Saying no is completely fine. If you say no, please fill in the detailed sizes form so we can buy clothes that fit without a fitting.';
  var VIDEO = { yes: 'Yes: film and share inside the class', class: 'Film for teaching only, not shared with the Company', no: 'No filming, please' };
  var DEF_VIDEO = 'To help everyone learn, we film rehearsals such as dance numbers and scene runs. The videos are for teaching only: the Company and the teachers watch them in the app (locked with the show’s password) or in the school’s Google Drive to practice. They are never posted publicly or on social media, and they are deleted after the show.';
  var DEF_COMMIT = [
    'My Company member will make it a priority to be at school every day of the final rehearsal weeks, Monday, November 29 through Friday, December 10, 2027 (dress rehearsals happen in class).',
    'My Company member will be at the one required after-school rehearsal: the full dress rehearsal on Tuesday, December 7, 2027, after school.',
    'My Company member will be at every performance: the school-day show on Thursday, December 9, 2027, and the evening shows on Friday, December 10 and Saturday, December 11, 2027, at 7:00 PM.',
    'We will tell the teacher as early as we can if something makes one of these dates impossible.'];
  var NOTE_MAX = 3600;      // the server takes a sealed note up to 5000 characters: about 3700 characters of form
  var str = function (v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); };
  var isDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); };
  /* a form, cleaned: only known fields, kept short; null when it cannot be accepted */
  function clean(kind, d) {
    d = d || {};
    if (kind === 'fit') {
      if (!FIT[d.answer]) return null;
      var f = { answer: d.answer, signer: str(d.signer, 80), date: isDate(d.date) ? d.date : '', note: str(d.note, 300) };
      if (d.answer !== 'self' && !f.signer) return null;      // yes and no are signed
      return f;
    }
    if (kind === 'sizes' || kind === 'sensory') {
      var out = {}, any = false;
      (kind === 'sizes' ? SIZE_FIELDS : SENSE_FIELDS).forEach(function (x) {
        var v = str(d[x[0]], /^(brands|note)$/.test(x[0]) || kind === 'sensory' ? 240 : 60); if (v) { out[x[0]] = v; any = true; }
      });
      if (kind === 'sensory' && d.makeupOk && MAKEUP.some(function (m) { return m[0] === d.makeupOk; })) { out.makeupOk = d.makeupOk; any = true; }
      if (kind === 'sizes' && d.who) out.who = str(d.who, 60);
      return any ? out : null;
    }
    if (kind === 'video') {
      if (!VIDEO[d.answer] || !str(d.signer, 80)) return null;
      return { answer: d.answer, signer: str(d.signer, 80), date: isDate(d.date) ? d.date : '', note: str(d.note, 300) };
    }
    if (kind === 'contact') {      // email updates (mail.js): no box ticked = stop emails to this address
      var em = str(d.email, 120);
      if (!/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(em)) return null;
      var o = {}; MAIL_OPTS.forEach(function (x) { o[x[0]] = !!(d.opts && d.opts[x[0]] === true); });
      return { email: em, name: str(d.name, 80), opts: o, dev: str(d.dev, 24), google: d.google === true };
    }
    if (kind === 'commit') {
      var items = Array.isArray(d.items) ? d.items.map(function (x) { return str(x, 400); }).filter(Boolean).slice(0, 12) : [];
      if (!items.length || !d.agree || d.agree.length !== items.length || !d.agree.every(function (a) { return a === true; })) return null;
      var c = { items: items, agree: items.map(function () { return true; }), signer: str(d.signer, 80), student: str(d.student, 80), date: isDate(d.date) ? d.date : '' };
      return c.signer ? c : null;
    }
    return null;
  }
  /* a note from a family's device, taken into the vault (V.extra.portal) and the show's "when it came in" list. true = accepted */
  function takeNote(V, show, n, castIds) {
    if (!n || n.type !== 'portal' || KINDS.indexOf(n.kind) < 0 || typeof n.actor !== 'string' || castIds.indexOf(n.actor) < 0) return false;
    var data = clean(n.kind, n.data); if (!data) return false;
    var at = isDate(String(n._at || '').slice(0, 10)) ? String(n._at).slice(0, 10) : (n.sent && isDate(n.sent) ? n.sent : '');
    var P = V.extra.portal = V.extra.portal || {}, r = P[n.actor] = P[n.actor] || {};
    if (r[n.kind] && r[n.kind].stamp && n.stamp && r[n.kind].stamp > n.stamp) return true;      // an older copy arrived after a newer one
    data.at = at; data.stamp = typeof n.stamp === 'number' ? n.stamp : 0;
    if (n.kind === 'contact') {      // one address per device (a family's phone), or per address; sending again from that device replaces it
      var low = data.email.toLowerCase();
      r.contacts = (r.contacts || []).filter(function (c) { return !(data.dev && c.dev === data.dev) && c.email.toLowerCase() !== low; });
      if (MAIL_OPTS.some(function (x) { return data.opts[x[0]]; })) r.contacts.push(data);
      r.contacts = r.contacts.slice(-6);
      r.contact = { at: at, stamp: data.stamp };
    } else r[n.kind] = data;
    var sp = show.portal = show.portal || {}, g = sp.got = sp.got || {}; (g[n.actor] = g[n.actor] || {})[n.kind] = at || 'yes';
    return true;
  }
  /* Teacher › Sizes: a school record (newest first, five kept); the show keeps only the date and Enough / Not enough */
  function addSchool(V, show, actor, rec) {
    var P = V.extra.portal = V.extra.portal || {}, r = P[actor] = P[actor] || {};
    var sizes = clean('sizes', rec.sizes) || {};
    var x = { at: rec.at, by: str(rec.by, 60), ok: rec.ok === true, sizes: sizes, note: str(rec.note, 240) };
    r.school = [x].concat(r.school || []).slice(0, 5);
    (show.sizeCheck = show.sizeCheck || {})[actor] = { at: rec.at, ok: x.ok };
    return x;
  }
  /* who to check again: their newest school record says Not enough and was made before today (the next class day on, until Enough) */
  function checkAgain(cast, sizeCheck, today) {
    sizeCheck = sizeCheck || {};
    return (cast || []).filter(function (a) { var s = sizeCheck[a.id]; return s && s.ok === false && s.at < today; })
      .map(function (a) { return { id: a.id, name: a.name, at: sizeCheck[a.id].at }; })
      .sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : String(a.name).localeCompare(String(b.name)); });
  }
  /* a short line for the shopping list (cast[].sizes), from the parent's and the school's sizes (the school's tag reading wins) */
  function summary(parent, school) {
    var m = Object.assign({}, parent || {}, school || {}), keys = [['shirt', 'shirt'], ['pants', 'pants'], ['waist', 'waist'], ['inseam', 'inseam'], ['dress', 'dress'], ['skirt', 'skirt'], ['shoe', 'shoes'], ['shoeWidth', ''], ['hat', 'hat']];
    var out = []; keys.forEach(function (k) { if (!m[k[0]]) return; if (k[0] === 'shoeWidth') { if (out.length && /^shoes /.test(out[out.length - 1])) out[out.length - 1] += ' ' + m.shoeWidth; return; } out.push(k[1] + ' ' + m[k[0]]); });
    return out.join(', ').slice(0, 160);
  }
  var core = { KINDS: KINDS, SIZE_FIELDS: SIZE_FIELDS, SENSE_FIELDS: SENSE_FIELDS, MAKEUP: MAKEUP, MAIL_OPTS: MAIL_OPTS, FIT: FIT, DEF_FIT: DEF_FIT, VIDEO: VIDEO, DEF_VIDEO: DEF_VIDEO, DEF_COMMIT: DEF_COMMIT, NOTE_MAX: NOTE_MAX,
    clean: clean, takeNote: takeNote, addSchool: addSchool, checkAgain: checkAgain, summary: summary };
  root.PortalCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.T) return;
  var T = window.T, C = window.PortalCore, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var today = function () { return ymd(new Date()); };
  var day = function (s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''; var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  var uid = function (p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  function SP() { var p = T.show.portal = T.show.portal || {}; p.news = p.news || []; p.got = p.got || {}; return p; }
  var fitText = function () { return SP().fitText || C.DEF_FIT; };
  var videoText = function () { return SP().videoText || C.DEF_VIDEO; };
  var commitItems = function () { return SP().commitItems && SP().commitItems.length ? SP().commitItems : C.DEF_COMMIT; };
  var css = document.createElement('style');
  css.textContent = '.todo{display:flex;align-items:center;gap:14px;padding:12px 4px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;min-height:var(--tap)}.todo:last-child{border-bottom:0}' +
    '.todo .st{margin-left:auto;white-space:nowrap}.todo .big{font-size:1.6em}.ok-tag{background:#d9f2df;color:#14532d}.no-tag{background:#fde2e1;color:#7f1d1d}' +
    '.sz-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);gap:6px 10px;align-items:center}.tblwrap{overflow-x:auto;max-width:100%}.sz-grid input{width:100%;min-width:0;box-sizing:border-box;min-height:44px;padding:6px 10px;border-radius:10px;border:2px solid var(--line);background:var(--card)}' +
    '.sz-grid .hd{font-weight:700;font-size:.85em}.agree{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);font-weight:400}.agree input{width:28px;height:28px;flex:none;margin-top:2px}' +
    '.consent{white-space:pre-wrap;background:var(--hi);border-radius:14px;padding:14px}@media(max-width:560px){.sz-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sz-grid .hd.pv{display:none}.sz-grid .pv{grid-column:1/-1;margin-top:-4px}}';
  document.head.appendChild(css);

  /* ---------- Families ---------- */
  /* what this device sent (so "Sent" shows at once, before a teacher takes it in), and the family's own copy to change later */
  function sentOn(actor) { var s = T.ls('portalSent') || {}; return s[actor] || {}; }
  function draft(actor, kind, v) {
    var d = T.ls('portalDraft') || {}, k = actor + '|' + kind;
    if (v === undefined) return d[k] || null;
    if (v === null) delete d[k]; else d[k] = v; T.ls('portalDraft', d);
  }
  function status(actor) {
    var g = (SP().got[actor]) || {}, s = sentOn(actor), out = {};
    C.KINDS.forEach(function (k) { out[k] = g[k] || s[k] || ''; });
    return out;
  }
  var ITEMS = [['fit', '👕', 'Fitting permission', 'For the shopping trip: may a teacher help with trying on clothes?'],
    ['sizes', '📏', 'Clothing sizes', 'Detailed sizes, so costumes fit'], ['sensory', '🧸', 'Sensory and clothing needs', 'Fabrics, tags, makeup, hair, what helps'],
    ['commit', '📅', 'Show-week commitment', 'The dates we need everyone, checked and signed'],
    ['video', '🎥', 'Rehearsal video permission', 'Filming dance rehearsals and scene runs, for learning'],
    ['contact', '📧', 'Email updates', 'News, changes for your Company member, copies of their emails']];
  /* the top of a family's home page: what needs their answer, and the newest news */
  /* a parent signed in with Google: that email becomes the family's contact for this Company member, once (news and changes; they can change it) */
  function autoContact(a) {
    var g = T.googleContact && T.googleContact(); if (!a || !g || !g.email) return;
    var d = draft(a, 'contact'); if (d && d.email === g.email) return;
    var dev = T.ls('portalDev'); if (!dev) { dev = 'd' + Math.random().toString(36).slice(2, 12); T.ls('portalDev', dev); }
    var data = { name: g.name || '', email: g.email, opts: { general: true, mine: true, copies: false }, dev: dev, google: true }, c = C.clean('contact', data); if (!c) return;
    Store.queueNote(T.key, { type: 'portal', kind: 'contact', actor: a, data: c, stamp: Date.now(), sent: today() }).catch(function () {});
    var s = T.ls('portalSent') || {}; (s[a] = s[a] || {}).contact = today(); T.ls('portalSent', s); draft(a, 'contact', data);
  }
  T.portalHome = function () {
    var a = T.me && T.me.id; autoContact(a); var st = a ? status(a) : {}, news = SP().news.slice().sort(function (x, y) { return y.at < x.at ? -1 : 1; });
    var left = ITEMS.filter(function (x) { return !st[x[0]]; }).length;
    return '<div class="card"><h2 style="margin-top:0">' + sym('📝') + (a ? (left ? 'Needs your answer' : 'All answered, thank you!') : 'Family forms') + '</h2>' +
      (a ? '<p class="muted small">' + (left ? left + ' of ' + ITEMS.length + ' still to do. ' : '') + 'Your answers go only to the teachers, locked; you can change them any time.</p>' +
        ITEMS.map(function (x) {
          return '<a class="todo" href="#/family/' + x[0] + '"><span class="big" aria-hidden="true">' + x[1] + '</span><span><b>' + x[2] + '</b><br><span class="muted small">' + x[3] + '</span></span>' +
            '<span class="st">' + (st[x[0]] ? '<span class="tag ok-tag">✓ Sent' + (/^\d{4}/.test(st[x[0]]) ? ' ' + esc(day(st[x[0]])) : '') + '</span>' : '<span class="tag no-tag">To do</span>') + '</span></a>';
        }).join('')
        : '<p>These forms are for each Company member. Once the class list is in the app, tap <b>Settings</b> and pick your Company member by name.</p>') + '</div>' +
      '<div class="card"><h2 style="margin-top:0">' + sym('📣') + 'News from the teacher</h2>' + (news.length ? news.slice(0, 3).map(newsItem).join('') +
        (news.length > 3 ? '<p><a class="btn" href="#/family/news">All news (' + news.length + ')</a></p>' : '') : '<p class="muted">Nothing yet. News from the teacher will show here.</p>') + '</div>' +
      '<h3>The show</h3>';
  };
  function newsItem(n) { return '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>' + esc(n.title) + '</b> <span class="muted small">' + esc(day(n.at)) + '</span>' + (n.text ? '<div style="white-space:pre-wrap">' + esc(n.text) + '</div>' : '') + '</div>'; }

  T.studentPages = T.studentPages || {};
  T.studentPages.family = function (args) {
    var k = args[0] || '';
    if (k === 'news') { T.setBar('News', '#/home'); app.innerHTML = '<div class="card">' + (SP().news.slice().sort(function (x, y) { return y.at < x.at ? -1 : 1; }).map(newsItem).join('') || '<p class="muted">Nothing yet.</p>') + '</div>'; return; }
    if (!T.me || !T.me.id) { T.setBar('Family forms', '#/home'); app.innerHTML = '<p class="card">Pick your Company member first: tap <b>Settings</b>, then choose your Company member by name. (Before the class list is in the app, the forms wait.)</p>'; return; }
    if (k === 'fit') return fitForm();
    if (k === 'sizes') return sizesForm();
    if (k === 'sensory') return senseForm();
    if (k === 'commit') return commitForm();
    if (k === 'video') return videoForm();
    if (k === 'contact') return contactForm();
    T.go('#/home');
  };
  function send(kind, data, okMsg) {
    var a = T.me.id, d = C.clean(kind, data);
    if (!d) return Promise.reject(new Error(kind === 'commit' ? 'Please tick every box and type your name.' : kind === 'contact' ? 'That email address doesn’t look right.' : kind === 'fit' || kind === 'video' ? 'Please choose an answer, and type your name to sign.' : 'Please fill in at least one box.'));
    var note = { type: 'portal', kind: kind, actor: a, data: d, stamp: Date.now(), sent: today() };
    if (JSON.stringify(note).length > C.NOTE_MAX) return Promise.reject(new Error('That is a little too long to send. Please shorten the longest answers.'));
    return Store.queueNote(T.key, note).catch(function () {}).then(function () {
      var s = T.ls('portalSent') || {}; (s[a] = s[a] || {})[kind] = today(); T.ls('portalSent', s);
      draft(a, kind, data); T.toast(okMsg || 'Sent to the teachers. Thank you!', 3000); T.go('#/home');
    });
  }
  function shell(title, intro, body) {
    T.setBar(title, '#/home');
    var sentAt = status(T.me.id)[{ 'Fitting permission': 'fit', 'Clothing sizes': 'sizes', 'Sensory and clothing needs': 'sensory', 'Show-week commitment': 'commit', 'Rehearsal video permission': 'video', 'Email updates': 'contact' }[title]];
    app.innerHTML = '<form class="card" id="pf" style="max-width:760px;margin:auto"><p class="muted small">For <b>' + esc(T.me.name) + '</b> · ' + sym('🔒') + 'only the teachers can read this.' +
      (sentAt ? ' <span class="tag ok-tag">✓ Sent' + (/^\d{4}/.test(sentAt) ? ' ' + esc(day(sentAt)) : '') + '</span> Sending again replaces it.' : '') + '</p>' + intro + body +
      '<p id="pe" class="err" role="alert"></p><div class="row end"><a class="btn" href="#/home">Cancel</a><button class="btn primary" type="submit">Send to the teachers</button></div>' +
      '<p class="muted small" style="margin-top:14px">A copy of what you type stays on this device so you can change it later. <button type="button" class="btn small quiet" id="forget">Clear my copy on this device</button></p></form>';
    var f = document.getElementById('pf');
    document.getElementById('forget').onclick = function () { C.KINDS.forEach(function (k) { draft(T.me.id, k, null); }); T.toast('Your copy on this device is cleared.'); T.route(); };
    return f;
  }
  function fail(e) { var p = document.getElementById('pe'); if (p) p.textContent = e.message || String(e); }
  var v = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };

  function fitForm() {
    var d = draft(T.me.id, 'fit') || {};
    var f = shell('Fitting permission', '<h2 style="margin-top:0">' + sym('👕') + 'Help with trying on clothes</h2><p class="consent">' + esc(fitText()) + '</p>',
      '<fieldset style="border:0;padding:0;margin:14px 0"><legend><b>Your answer</b></legend>' + Object.keys(C.FIT).map(function (k) {
        return '<label class="agree"><input type="radio" name="fa" value="' + k + '"' + (d.answer === k ? ' checked' : '') + '><span>' + esc(C.FIT[k]) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<div id="sig"><label class="f">Parent or guardian: type your full name to sign<input id="fs" maxlength="80" autocomplete="name" value="' + esc(d.signer || '') + '"></label>' +
      '<label class="f">Date<input id="fd" type="date" value="' + esc(d.date || today()) + '"></label></div>' +
      '<label class="f">Anything we should know? (optional)<input id="fn" maxlength="300" value="' + esc(d.note || '') + '" placeholder="e.g. please let her try things on with the door open a crack"></label>' +
      '<p id="nohint" class="card small" hidden>' + sym('📏') + 'Thank you. Please also fill in <a href="#/family/sizes">Clothing sizes</a> in as much detail as you can, so we can buy without a fitting.</p>');
    var sync = function () { var a = (f.querySelector('input[name=fa]:checked') || {}).value; document.getElementById('sig').hidden = a === 'self'; document.getElementById('nohint').hidden = a !== 'no'; };
    f.querySelectorAll('input[name=fa]').forEach(function (r) { r.onchange = sync; }); sync();
    f.onsubmit = function (e) {
      e.preventDefault();
      var a = (f.querySelector('input[name=fa]:checked') || {}).value;
      send('fit', { answer: a, signer: v('fs'), date: v('fd'), note: v('fn') }, a === 'no' ? 'Sent. Please fill in Clothing sizes next.' : null).then(function () { if (a === 'no') T.go('#/family/sizes'); }, fail);
    };
  }
  function videoForm() {
    var d = draft(T.me.id, 'video') || {};
    var f = shell('Rehearsal video permission', '<h2 style="margin-top:0">' + sym('🎥') + 'Filming rehearsals</h2><p class="consent">' + esc(videoText()) + '</p>',
      '<fieldset style="border:0;padding:0;margin:14px 0"><legend><b>Your answer</b></legend>' + Object.keys(C.VIDEO).map(function (k) {
        return '<label class="agree"><input type="radio" name="va" value="' + k + '"' + (d.answer === k ? ' checked' : '') + '><span>' + esc(C.VIDEO[k]) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<label class="f">Parent or guardian: type your full name to sign<input id="vs" maxlength="80" autocomplete="name" value="' + esc(d.signer || '') + '"></label>' +
      '<label class="f">Date<input id="vd" type="date" value="' + esc(d.date || today()) + '"></label>' +
      '<label class="f">Anything we should know? (optional)<input id="vn" maxlength="300" value="' + esc(d.note || '') + '" placeholder="e.g. OK to film, but please keep their face out of shared videos"></label>');
    f.onsubmit = function (e) { e.preventDefault(); send('video', { answer: (f.querySelector('input[name=va]:checked') || {}).value, signer: v('vs'), date: v('vd'), note: v('vn') }).catch(fail); };
  }
  function contactForm() {
    var d = draft(T.me.id, 'contact') || { opts: { general: true, mine: true } }, dev = T.ls('portalDev'), g = T.googleContact && T.googleContact();
    if (g && g.email) { d.email = g.email; d.name = d.name || g.name; }
    if (!dev) { dev = 'd' + Math.random().toString(36).slice(2, 12); T.ls('portalDev', dev); }
    var f = shell('Email updates', '<h2 style="margin-top:0">' + sym('📧') + 'Email updates</h2><p>Get an email when there is something new, with a link straight to it in the app. Each person who wants emails can sign up from their own phone. ' +
      'To stop, untick every box and send, or use “Stop these emails” at the bottom of any email.</p>',
      '<label class="f">Your name<input id="mn" maxlength="80" autocomplete="name" value="' + esc(d.name || '') + '"></label>' +
      '<label class="f">Your email' + (g && g.email ? ' <span class="muted small">(from your Google sign-in)</span>' : '') + '<input id="me" type="email" maxlength="120" autocomplete="email" value="' + esc(d.email || '') + '"' + (g && g.email ? ' readonly' : '') + '></label>' +
      '<fieldset style="border:0;padding:0;margin:14px 0"><legend><b>Email me about</b></legend>' + C.MAIL_OPTS.map(function (x) {
        return '<label class="agree"><input type="checkbox" data-o="' + x[0] + '"' + (d.opts && d.opts[x[0]] ? ' checked' : '') + '><span>' + esc(x[1]) + '</span></label>';
      }).join('') + '</fieldset>');
    f.onsubmit = function (e) {
      e.preventDefault(); var o = {}; f.querySelectorAll('[data-o]').forEach(function (c) { o[c.dataset.o] = c.checked; });
      if (!/@/.test(v('me'))) { fail(new Error('Please type your email address.')); return; }
      send('contact', { name: v('mn'), email: v('me').trim(), opts: o, dev: dev, google: !!(g && g.email && g.email === v('me').trim().toLowerCase()) }, C.MAIL_OPTS.some(function (x) { return o[x[0]]; }) ? 'Thank you! Emails will come to ' + v('me').trim() + '.' : 'Sent: no more emails to that address.').catch(fail);
    };
  }
  function sizesForm() {
    var d = draft(T.me.id, 'sizes') || {};
    var f = shell('Clothing sizes', '<h2 style="margin-top:0">' + sym('📏') + 'Clothing and accessory sizes</h2><p>Every family is encouraged to fill this in, even if a teacher will help with trying on. The more detail, the better the costumes fit. ' +
      'Tip: look at the tags on clothes that fit well now. Leave anything blank that you don’t know.</p>',
      C.SIZE_FIELDS.map(function (x) { return '<label class="f">' + esc(x[1]) + '<input id="s_' + x[0] + '" maxlength="' + (/^(brands|note)$/.test(x[0]) ? 240 : 60) + '" value="' + esc(d[x[0]] || '') + '" placeholder="' + esc(x[2]) + '"></label>'; }).join(''));
    f.onsubmit = function (e) { e.preventDefault(); var o = {}; C.SIZE_FIELDS.forEach(function (x) { o[x[0]] = v('s_' + x[0]); }); send('sizes', o).catch(fail); };
  }
  function senseForm() {
    var d = draft(T.me.id, 'sensory') || {};
    var f = shell('Sensory and clothing needs', '<h2 style="margin-top:0">' + sym('🧸') + 'Sensory and clothing needs</h2><p>We highly encourage every family to share this. Costumes, makeup, lights and a busy backstage can be a lot; ' +
      'knowing what feels good and what to avoid helps us plan costumes and show days that work for your Company member. Skip anything that doesn’t apply.</p>',
      '<fieldset style="border:0;padding:0;margin:14px 0"><legend><b>Stage makeup</b></legend>' + C.MAKEUP.map(function (m) {
        return '<label class="agree"><input type="radio" name="mk" value="' + m[0] + '"' + (d.makeupOk === m[0] ? ' checked' : '') + '><span>' + esc(m[1]) + '</span></label>';
      }).join('') + '</fieldset>' +
      C.SENSE_FIELDS.map(function (x) { return '<label class="f">' + esc(x[1]) + '<textarea id="n_' + x[0] + '" maxlength="240" rows="2" style="min-height:70px" placeholder="' + esc(x[2]) + '">' + esc(d[x[0]] || '') + '</textarea></label>'; }).join(''));
    f.onsubmit = function (e) { e.preventDefault(); var o = { makeupOk: (f.querySelector('input[name=mk]:checked') || {}).value }; C.SENSE_FIELDS.forEach(function (x) { o[x[0]] = v('n_' + x[0]); }); send('sensory', o).catch(fail); };
  }
  function commitForm() {
    var d = draft(T.me.id, 'commit') || {}, items = commitItems(), same = d.items && d.items.join('\n') === items.join('\n');
    var f = shell('Show-week commitment', '<h2 style="margin-top:0">' + sym('📅') + 'Our show-week commitment</h2><p>A show only works when everyone is there. Please read each line with your Company member and tick it.</p>',
      items.map(function (t, i) { return '<label class="agree"><input type="checkbox" data-i="' + i + '"' + (same && d.agree && d.agree[i] ? ' checked' : '') + '><span>' + esc(t) + '</span></label>'; }).join('') +
      '<label class="f">Parent or guardian: type your full name to sign<input id="cs" maxlength="80" autocomplete="name" value="' + esc(d.signer || '') + '"></label>' +
      '<label class="f">Company member’s name (they can type it, or you can type it with them)<input id="cm" maxlength="80" value="' + esc(d.student || '') + '"></label>' +
      '<label class="f">Date<input id="cd" type="date" value="' + esc(d.date || today()) + '"></label>');
    f.onsubmit = function (e) {
      e.preventDefault();
      var agree = items.map(function (t, i) { return f.querySelector('input[data-i="' + i + '"]').checked; });
      send('commit', { items: items, agree: agree, signer: v('cs'), student: v('cm'), date: v('cd') }).catch(fail);
    };
  }

  /* ---------- Teachers ---------- */
  T.teacherPages = T.teacherPages || {};
  var castIds = function () { return (T.show.cast || []).map(function (a) { return a.id; }); };
  /* forms waiting on the server: taken in only on Family portal and Sizes, so the answers go straight into the vault */
  function pull() {
    if (!T.proof || !T.withVault) return Promise.resolve(0);
    return Store.getNotes(T.key, T.proof).then(function (notes) {
      var mine = notes.filter(function (n) { return n.type === 'portal'; }).sort(function (a, b) { return (a.stamp || 0) - (b.stamp || 0); });
      if (!mine.length) return 0;
      var n = 0, ids = castIds(), done = [];
      // a form for someone no longer in the cast is cleared; one this page cannot read otherwise stays on the server (never lost)
      return T.withVault(function (V) { mine.forEach(function (x) { if (C.takeNote(V, T.show, x, ids)) { n++; done.push(x._id); } else if (ids.indexOf(x.actor) < 0) done.push(x._id); }); })
        .then(function () { return n ? T.saveShow(n + ' new family form' + (n === 1 ? '' : 's')) : null; })
        .then(function () { return done.length ? Store.clearNotes(T.proof, done) : null; })
        .then(function () { return n; });
    }).catch(function () { return 0; });
  }
  T.portalWaiting = function () {      // how many family forms are waiting (Teacher home tile)
    if (!T.proof) return Promise.resolve(0);
    return Store.getNotes(T.key, T.proof).then(function (l) { return l.filter(function (n) { return n.type === 'portal'; }).length; }).catch(function () { return 0; });
  };
  var openP = function () { return T.openVault ? T.openVault().then(function (V) { return (V.extra && V.extra.portal) || {}; }) : Promise.resolve({}); };
  var cast = function () { return (T.show.cast || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); };
  function mark(v, okText) { return v ? '<span class="tag ok-tag">' + esc(okText || '✓') + '</span>' : '<span class="muted small">—</span>'; }

  T.teacherPages.family = function () {
    T.setBar('Family portal', '#/teacher');
    var P = {}, filt = T.ls('famFilter') || 'all';
    function draw() {
      var sp = SP(), list = cast().filter(function (a) { return filt === 'all' || a.company === filt; });
      var cnt = function (k) { return list.filter(function (a) { return P[a.id] && P[a.id][k]; }).length; };
      var need = list.filter(function (a) { return P[a.id] && P[a.id].fitNeed; });
      var fitOf = function (a) { var f = P[a.id] && P[a.id].fit; return f ? { yes: '✓ Yes', no: 'No: sizes', self: 'Not needed' }[f.answer] : ''; };
      app.innerHTML = '<div class="card noprint"><h2 style="margin-top:0">' + sym('🏠') + 'What families see</h2><p class="muted small">Parent passwords open a portal: five forms for their Company member (fitting permission, clothing sizes, sensory and clothing needs, the show-week commitment, rehearsal video permission), a sign-up for email updates (see Emails), your news, then the show pages. ' +
        'Answers come here locked with the teacher password; nobody with the cast or a parent password can read them.</p></div>' +
        '<div class="card"><h2 style="margin-top:0">' + sym('📣') + 'News for families</h2><div class="noprint"><label class="f">Headline<input id="nt" maxlength="100" placeholder="e.g. Shopping trip on Wednesday!"></label>' +
        '<label class="f">Message<textarea id="nx" maxlength="1200" placeholder="What families need to know"></textarea></label><div class="row end"><button class="btn primary" id="np" data-save>Post</button></div></div>' +
        (sp.news.length ? sp.news.slice().sort(function (x, y) { return y.at < x.at ? -1 : 1; }).map(function (n) { return '<div class="row" style="border-bottom:1px solid var(--line);padding:6px 0"><div class="grow"><b>' + esc(n.title) + '</b> <span class="muted small">' + esc(day(n.at)) + '</span><div class="small" style="white-space:pre-wrap">' + esc(n.text) + '</div></div><button class="btn small quiet noprint" data-nd="' + esc(n.id) + '" data-save>Delete</button></div>'; }).join('') : '<p class="muted">No news posted yet.</p>') + '</div>' +
        '<div class="card"><div class="row" style="flex-wrap:wrap"><h2 class="grow" style="margin:0">' + sym('📝') + 'Answers</h2><div class="seg noprint" id="ff">' + [['all', 'Everyone'], ['artist', 'Artists'], ['mentor', 'Mentors']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (filt === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<button class="btn noprint" onclick="print()">' + icon('print') + 'Print</button></div>' +
        '<p class="small">Sizes ' + cnt('sizes') + ' of ' + list.length + ' · Sensory ' + cnt('sensory') + ' · Commitment signed ' + cnt('commit') + ' of ' + list.length + ' · Video permission ' + cnt('video') + ' (' + list.filter(function (a) { return P[a.id] && P[a.id].video && P[a.id].video.answer === 'no'; }).length + ' no filming) · Fitting permission (needs help): ' +
        need.filter(function (a) { return P[a.id].fit && P[a.id].fit.answer === 'yes'; }).length + ' yes, ' + need.filter(function (a) { return P[a.id].fit && P[a.id].fit.answer !== 'yes'; }).length + ' no, ' + need.filter(function (a) { return !P[a.id].fit; }).length + ' not answered</p>' +
        (list.length ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Company member</th><th>Parents (email)</th><th title="Mark the Company members who need help trying on clothes. Only teachers see this mark.">Needs help trying on</th><th>Fitting</th><th>Sizes</th><th>Sensory</th><th>Commitment</th><th>Video</th><th class="noprint"></th></tr></thead><tbody>' +
          list.map(function (a) {
            var r = P[a.id] || {}, f = fitOf(a);
            return '<tr><td><b>' + esc(a.name) + '</b> ' + T.companyTag(a) + '</td><td class="small">' + ((r.contacts || []).map(function (c) { return esc(c.email) + (c.google ? ' <span class="tag ok-tag" title="Signed in with Google">G ✓</span>' : ''); }).join('<br>') || '<span class="muted">—</span>') + '</td><td><input type="checkbox" data-need="' + esc(a.id) + '" aria-label="Needs help trying on: ' + esc(a.name) + '"' + (r.fitNeed ? ' checked' : '') + '></td>' +
              '<td>' + (f ? '<span class="tag ' + (r.fit.answer === 'yes' ? 'ok-tag' : '') + '">' + esc(f) + '</span>' : r.fitNeed ? '<span class="tag no-tag">Not answered</span>' : '<span class="muted small">—</span>') + '</td>' +
              '<td>' + mark(r.sizes, '✓ ' + day(r.sizes && r.sizes.at)) + '</td><td>' + mark(r.sensory, '✓ ' + day(r.sensory && r.sensory.at)) + '</td>' +
              '<td>' + (r.commit ? '<span class="tag ok-tag">✓ Signed</span>' + (r.commit.items.join('\n') !== commitItems().join('\n') ? '<br><span class="muted small">an earlier wording</span>' : '') : '<span class="tag no-tag">Not yet</span>') + '</td>' +
              '<td>' + (r.video ? '<span class="tag ' + (r.video.answer === 'no' ? 'no-tag' : 'ok-tag') + '">' + esc({ yes: '✓ Film and share', class: 'Teaching only', no: 'No filming' }[r.video.answer]) + '</span>' : '<span class="tag no-tag">Not yet</span>') + '</td>' +
              '<td class="noprint"><button class="btn small" data-see="' + esc(a.id) + '">See</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted">Add the Company on the Cast page first.</p>') + '</div>' +
        '<div class="card noprint"><h2 style="margin-top:0">' + sym('✏️') + 'The wording families see</h2>' +
        '<label class="f">Fitting permission<textarea id="wf" rows="6">' + esc(fitText()) + '</textarea></label>' +
        '<label class="f">Rehearsal video permission<textarea id="wv" rows="5">' + esc(videoText()) + '</textarea></label>' +
        '<label class="f">Show-week commitment: one line for each box they tick<textarea id="wc" rows="7">' + esc(commitItems().join('\n')) + '</textarea></label>' +
        '<p class="muted small">Families who signed an earlier wording keep their signature; the Answers table marks it “an earlier wording.”</p>' +
        '<div class="row end"><button class="btn" id="wreset">Back to the starting words</button><button class="btn primary" id="wsave" data-save>Save the wording</button></div></div>';
      document.getElementById('np').onclick = function () {
        var t = v('nt').trim(); if (!t) { T.toast('Type a headline first.'); return; }
        SP().news.push({ id: uid('n'), at: today(), title: t.slice(0, 100), text: v('nx').trim().slice(0, 1200) }); T.saveShow('Posted for families').then(draw);
      };
      app.querySelectorAll('[data-nd]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this news?')) return; SP().news = SP().news.filter(function (n) { return n.id !== b.dataset.nd; }); T.saveShow('Deleted').then(draw); }; });
      app.querySelectorAll('#ff button').forEach(function (b) { b.onclick = function () { filt = b.dataset.v; T.ls('famFilter', filt); draw(); }; });
      app.querySelectorAll('[data-need]').forEach(function (c) { c.onchange = function () {
        var id = c.dataset.need, on = c.checked;
        T.withVault(function (V) { var Q = V.extra.portal = V.extra.portal || {}, r = Q[id] = Q[id] || {}; if (on) r.fitNeed = true; else delete r.fitNeed; P = Q; })
          .then(function () { return T.saveShow(on ? 'Marked: needs help trying on' : 'Mark taken off'); }).then(draw);
      }; });
      app.querySelectorAll('[data-see]').forEach(function (b) { b.onclick = function () { detail((T.show.cast || []).find(function (a) { return a.id === b.dataset.see; }), P[b.dataset.see] || {}); }; });
      document.getElementById('wsave').onclick = function () {
        var sp2 = SP(), ft = v('wf').trim(), ci = v('wc').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        if (ft && ft !== C.DEF_FIT) sp2.fitText = ft.slice(0, 2000); else delete sp2.fitText;
        var vt = v('wv').trim(); if (vt && vt !== C.DEF_VIDEO) sp2.videoText = vt.slice(0, 2000); else delete sp2.videoText;
        if (ci.length && ci.join('\n') !== C.DEF_COMMIT.join('\n')) sp2.commitItems = ci.slice(0, 12).map(function (x) { return x.slice(0, 400); }); else delete sp2.commitItems;
        T.saveShow('Wording saved').then(draw);
      };
      document.getElementById('wreset').onclick = function () { document.getElementById('wf').value = C.DEF_FIT; document.getElementById('wv').value = C.DEF_VIDEO; document.getElementById('wc').value = C.DEF_COMMIT.join('\n'); };
    }
    app.innerHTML = '<p class="card muted">Opening the family answers…</p>';
    openP().then(function (x) { P = x; draw(); }).then(pull).then(function (n) { if (n) return openP().then(function (x) { P = x; draw(); T.toast(n + ' new family form' + (n === 1 ? '' : 's') + ' taken in'); }); })
      .catch(function (e) { app.innerHTML = '<p class="card err">' + esc(e.message || e) + '</p>'; });
  };
  /* everything a family sent for one Company member, and the school's size records */
  function detail(a, r) {
    if (!a) return;
    var rows = function (fields, o) { return fields.filter(function (x) { return o && o[x[0]]; }).map(function (x) { return '<tr><th style="width:40%">' + esc(x[1]) + '</th><td>' + esc(o[x[0]]) + '</td></tr>'; }).join(''); };
    var f = r.fit, c = r.commit, sz = r.sizes, se = r.sensory, mk = se && C.MAKEUP.find(function (m) { return m[0] === se.makeupOk; });
    T.dialog('<h2>' + esc(a.name) + '</h2>' +
      '<h3>' + sym('👕') + 'Fitting permission' + (r.fitNeed ? ' <span class="tag">needs help trying on</span>' : '') + '</h3>' + (f ? '<p><b>' + esc(C.FIT[f.answer]) + '</b>' + (f.signer ? '<br>Signed: ' + esc(f.signer) + (f.date ? ', ' + esc(day(f.date)) : '') : '') + (f.note ? '<br>' + esc(f.note) : '') + '<br><span class="muted small">Came in ' + esc(day(f.at)) + '</span></p>' : '<p class="muted">Not answered.</p>') +
      '<h3>' + sym('📏') + 'Sizes from the family</h3>' + (sz ? '<table class="tbl">' + rows(C.SIZE_FIELDS, sz) + '</table><p class="muted small">Came in ' + esc(day(sz.at)) + '</p>' : '<p class="muted">Not sent.</p>') +
      '<h3>' + sym('🧸') + 'Sensory and clothing needs</h3>' + (se ? '<table class="tbl">' + (mk ? '<tr><th style="width:40%">Stage makeup</th><td>' + esc(mk[1]) + '</td></tr>' : '') + rows(C.SENSE_FIELDS, se) + '</table><p class="muted small">Came in ' + esc(day(se.at)) + '</p>' : '<p class="muted">Not sent.</p>') +
      '<h3>' + sym('📅') + 'Show-week commitment</h3>' + (c ? '<ul>' + c.items.map(function (t) { return '<li>✓ ' + esc(t) + '</li>'; }).join('') + '</ul><p>Signed: ' + esc(c.signer) + (c.student ? ' and ' + esc(c.student) : '') + (c.date ? ', ' + esc(day(c.date)) : '') + '</p>' : '<p class="muted">Not signed yet.</p>') +
      '<h3>' + sym('🎥') + 'Rehearsal video permission</h3>' + (r.video ? '<p><b>' + esc(C.VIDEO[r.video.answer]) + '</b><br>Signed: ' + esc(r.video.signer) + (r.video.date ? ', ' + esc(day(r.video.date)) : '') + (r.video.note ? '<br>' + esc(r.video.note) : '') + '</p>' : '<p class="muted">Not answered.</p>') +
      '<h3>' + sym('🏫') + 'Sizes recorded at school</h3>' + ((r.school || []).length ? r.school.map(function (s) { return '<p><b>' + esc(day(s.at)) + '</b> ' + (s.ok ? '<span class="tag ok-tag">Enough</span>' : '<span class="tag no-tag">Not enough</span>') + (s.by ? ' · ' + esc(s.by) : '') + '</p><table class="tbl">' + rows(C.SIZE_FIELDS, s.sizes) + '</table>' + (s.note ? '<p class="small">' + esc(s.note) + '</p>' : ''); }).join('') : '<p class="muted">None yet.</p>') +
      '<div class="row end noprint"><button class="btn" onclick="print()">' + icon('print') + 'Print</button><button class="btn primary" id="dx">Close</button></div>', function (d) { d.querySelector('#dx').onclick = function () { d.close(); }; });
  }

  /* ---------- Sizes recorded at school ---------- */
  /* the reminder: on Teacher home and Costumes (from the sizes week on), and on the Sizes page */
  T.sizeReminder = function (where) {
    if (!T.show || !T.show.cast || !T.show.cast.length) return '';
    var t = today(), again = C.checkAgain(T.show.cast, T.show.sizeCheck, t), sc = T.show.sizeCheck || {};
    var from = SP().sizesFrom || '2027-09-13', none = T.show.cast.filter(function (a) { return !sc[a.id] && !a.guest; });
    if (where !== 'sizes' && t < from && !again.length) return '';
    if (!again.length && !(none.length && where === 'home')) return '';
    return '<div class="card" style="border-left:6px solid var(--bad)"><h3 style="margin-top:0">' + sym('📏') + (again.length ? 'Check sizes again today' : 'Sizes still to record') + '</h3>' +
      (again.length ? '<p class="small">These sizes were marked <b>Not enough</b>. Read the tags on what they are wearing today and record them again until they are marked Enough.</p><p>' +
        again.map(function (x) { return '<a class="tag no-tag" style="margin:3px;text-decoration:none" href="#/teacher/sizes/' + encodeURIComponent(x.id) + '">' + esc(x.name) + ' · since ' + esc(day(x.at)) + '</a>'; }).join(' ') + '</p>' : '') +
      (none.length && where === 'home' ? '<p class="small muted">' + none.length + ' Company member' + (none.length === 1 ? ' has' : 's have') + ' no sizes recorded at school yet.</p>' : '') +
      (where === 'sizes' ? '' : '<p><a class="btn" href="#/teacher/sizes">Open Sizes</a></p>') + '</div>';
  };
  T.teacherPages.sizes = function (args) {
    T.setBar('Sizes', '#/teacher');
    var P = {};
    function draw() {
      var sc = T.show.sizeCheck || {};
      app.innerHTML = '<div class="card noprint"><h2 style="margin-top:0">' + sym('📏') + 'Sizes recorded at school</h2><p class="small">An adult reads the size tags on the clothes a Company member is wearing that day and records them. ' +
        'Mark <b>Enough</b> when we have what we need to shop, or <b>Not enough</b> to check again: they show on the “Check sizes again” list on Teacher mode’s home page and Costumes from the next day until they are marked Enough. ' +
        'Sizes from the family (Family portal) show beside each box.</p>' +
        '<label class="f" style="max-width:260px">Show the reminder from<input type="date" id="sf" value="' + esc(SP().sizesFrom || '2027-09-13') + '"></label></div>' +
        T.sizeReminder('sizes') +
        '<div class="card"><div class="row"><h2 class="grow" style="margin:0">The Company</h2><button class="btn noprint" onclick="print()">' + icon('print') + 'Print</button></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Company member</th><th>At school</th><th>From the family</th><th>For the shopping list</th><th class="noprint"></th></tr></thead><tbody>' +
        cast().filter(function (a) { return !a.guest; }).map(function (a) {
          var s = sc[a.id], r = P[a.id] || {};
          return '<tr><td><b>' + esc(a.name) + '</b> ' + T.companyTag(a) + '</td><td>' + (s ? (s.ok ? '<span class="tag ok-tag">Enough</span>' : '<span class="tag no-tag">Not enough</span>') + ' <span class="muted small">' + esc(day(s.at)) + '</span>' : '<span class="muted small">Not yet</span>') + '</td>' +
            '<td>' + (r.sizes ? '<span class="tag ok-tag">✓ ' + esc(day(r.sizes.at)) + '</span>' : '<span class="muted small">—</span>') + '</td><td class="small">' + esc(a.sizes || '') + '</td>' +
            '<td class="noprint"><button class="btn small primary" data-rec="' + esc(a.id) + '">Record sizes</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      document.getElementById('sf').onchange = function () { if (this.value) SP().sizesFrom = this.value; else delete SP().sizesFrom; T.saveShow('Saved'); };
      app.querySelectorAll('[data-rec]').forEach(function (b) { b.onclick = function () { record(b.dataset.rec); }; });
    }
    function record(id) {
      var a = (T.show.cast || []).find(function (x) { return x.id === id; }); if (!a) return;
      var r = P[id] || {}, par = r.sizes || {}, last = (r.school || [])[0], prev = last ? last.sizes : {}, ok = null;
      var fields = C.SIZE_FIELDS.filter(function (x) { return x[0] !== 'brands'; });
      T.dialog('<h2>' + esc(a.name) + '</h2><p class="small">Read the tags on what they are wearing today. Last time’s sizes are filled in; change what the tags say.' + (last ? ' <span class="muted">Last recorded ' + esc(day(last.at)) + (last.ok ? ' (Enough)' : ' (Not enough)') + '.</span>' : '') + '</p>' +
        '<div class="sz-grid"><span class="hd">Size</span><span class="hd">At school today</span><span class="hd pv">From the family</span>' +
        fields.map(function (x) { return '<label for="z_' + x[0] + '">' + esc(x[1].replace(/ \(.*\)$/, '')) + '</label><input id="z_' + x[0] + '" maxlength="' + (x[0] === 'note' ? 240 : 60) + '" value="' + esc(prev[x[0]] || '') + '"><span class="small pv">' + (par[x[0]] ? '<span class="muted">Family: </span>' + esc(par[x[0]]) : '<span class="muted">—</span>') + '</span>'; }).join('') +
        '</div>' + (par.brands ? '<p class="small"><b>Brands that fit well (family):</b> ' + esc(par.brands) + '</p>' : '') +
        '<label class="f">Recorded by<input id="zb" maxlength="60" value="' + esc(T.ls('sizeBy') || '') + '" placeholder="e.g. Ms. Elyse"></label>' +
        '<div class="switch"><span><b>Do we have enough to shop?</b></span><div class="seg" id="zok"><button type="button" data-v="1" aria-pressed="false">Enough</button><button type="button" data-v="0" aria-pressed="false">Not enough: check again</button></div></div>' +
        '<label class="switch"><span>Also update the short sizes line on the shopping list</span><input type="checkbox" id="zsum" checked></label>' +
        '<p id="ze" class="err" role="alert"></p><div class="row end"><button class="btn" id="zx">Cancel</button><button class="btn primary" id="zs" data-save>Save</button></div>', function (d) {
        d.querySelectorAll('#zok button').forEach(function (b) { b.onclick = function () { ok = b.dataset.v === '1'; d.querySelectorAll('#zok button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
        d.querySelector('#zx').onclick = function () { d.close(); };
        d.querySelector('#zs').onclick = function () {
          if (ok === null) { d.querySelector('#ze').textContent = 'Choose Enough or Not enough.'; return; }
          var sizes = {}; fields.forEach(function (x) { sizes[x[0]] = d.querySelector('#z_' + x[0]).value; });
          var by = d.querySelector('#zb').value.trim(), sum = d.querySelector('#zsum').checked; T.ls('sizeBy', by);
          T.withVault(function (V) { var x = C.addSchool(V, T.show, id, { at: today(), by: by, ok: ok, sizes: sizes }); if (sum) { var line = C.summary(par, x.sizes); if (line) a.sizes = line; } P = V.extra.portal; })
            .then(function () { return T.saveShow(ok ? 'Saved: Enough' : 'Saved: check again next class'); }).then(function () { d.close(); draw(); }, function (e) { d.querySelector('#ze').textContent = e.message || e; });
        };
      });
    }
    app.innerHTML = '<p class="card muted">Opening the sizes…</p>';
    openP().then(function (x) { P = x; draw(); if (args && args[0]) record(args[0]); }).then(pull).then(function (n) { if (n) return openP().then(function (x) { P = x; if (!document.querySelector('dialog[open]')) draw(); }); })
      .catch(function (e) { app.innerHTML = '<p class="card err">' + esc(e.message || e) + '</p>'; });
  };
})();
