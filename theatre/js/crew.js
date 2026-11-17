/* asl.cool/theatre: the Tech Week Crew questionnaire (Colleen 2026-10-25: "a questionnaire mostly for availability for peer volunteers for tech/show
   week jobs"; "the initial survey should be available without a password at all").
   The form is a page of its own, asl.cool/theatre/crew/ (crew/index.html + js/crew-form.js), open to anyone with the link. It asks:
   how they heard about us (tick any: the invited groups, The Lion, Recommended by [a name], Other [typed]); each show-week rehearsal,
   the Thursday school-day shows (can you miss the whole day?) and each evening show: I can be there / Maybe / I can't, every date answered, and a
   reason for Maybe or I can't; the ways to help (read the list, tick any); a few sentences about themselves (the main answer); what they would
   NOT enjoy or not be good at; food allergies for the Company dinners; comments.
   Privacy: the questions and the teacher's PUBLIC key are on the server (api.js crew/form, nothing about anyone). The answers are sealed in the
   volunteer's browser with that key (RSA-OAEP wraps a fresh AES-GCM key) and wait in api.js crew/in; only this page, in Teacher mode, opens them
   with the private key kept in the vault (V.extra.crew.priv, teacher password). Name, email, the write-ups, reasons and food go into the vault
   (V.extra.crew.people); the show keeps only first name + last initial, the answers per date, the ways to help and where they come from
   (T.show.crew.people), so the grid works and Company devices learn nothing private.
   T.show.crew = { form: { intro, due, open, rehearsals, thu, shows, jobs, groups }, need: { dateId: n }, people: [{ id, short, at, src: [group ids, rec, other], ans: { dateId: y|m|n },
   jobs: [ids], guest }] }. A person's id comes from their email, so sending the form again replaces the earlier answers. */
(function (root) {
  'use strict';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var DEF_REH = '12/4/2027 Sat, Dec 4, 12–5 PM: long rehearsal, the whole show with every moving part\n12/6/2027 Mon, Dec 6, 3:30–8 PM: stumble-through (dinner with the Company)\n12/8/2027 Wed, Dec 8, 3:30–8 PM: final dress rehearsal (dinner with the Company)';
  var DEF_THU = '12/9/2027 Thu, Dec 9: our two in-school shows (setup 1st period, shows 2nd and 6th period, lunch with the Company)';
  var DEF_SHOWS = '12/10/2027 Fri, Dec 10: evening show, 5 PM call, 7 PM curtain\n12/11/2027 Sat, Dec 11: evening show, 5 PM call, 7 PM curtain';
  var DEF_JOBS = ['Lighting', 'Sound', 'Captioning (running the captions during the show)', 'Hair', 'Makeup', 'Costumes (dressing, quick changes, repairs)',
    'Run crew / set crew (moving sets and props in scene changes)', '1:1 on-stage support (beside a Company member on stage)', 'Dance support in front of the stage',
    'Backstage and green room supervision (for actors who are offstage)', 'Props', 'Front of house (ushers, programs, tickets and concessions sales)',
    'Photos or video (at the Saturday rehearsal and the weekday evening rehearsals)', 'Assistant stage manager', 'Program or poster design',
    'I don’t know, but I want to help!'].join('\n');
  var OLD_INTRO = 'Our adaptive theatre class is putting on a musical, and we need a crew for tech week and show week. Tell us when you can come and how you would like to help. No experience needed!';
  /* an application (Colleen 2026-10-25: "let's make this 'an application' to help with the understanding that not everyone will be called to service- but they might") */
  var DEF_INTRO = 'Our adaptive theatre class is putting on a musical, and we are building a crew for tech week and show week. Apply to help! No experience needed. We can’t take everyone, so we will choose a crew that fits what the show needs. If you aren’t chosen at first, we may still call on you as the show comes together.';
  /* How did you hear about us? (Colleen 2026-10-25: "include all invited groups, the lion newspaper (assuming we get an early article), recommended by,
     and an other button that allows for typing"): tick any; the groups are editable on her page; Recommended by and Other always come last, each with a box */
  var DEF_GROUPS = ['Adaptive PE Leaders', 'Adaptive Art Leader', 'Adaptive Culinary Leader', 'Adaptive Tech Leader', 'Adaptive Music Leader', 'Best Buddies', 'Theatre Board', 'NHS',
    'Theatre: Stage Tech', 'Choir', 'Dance Arts', 'Fashion & Interior Design', 'Film & TV', 'Digital Photo', 'Graphic Design', 'Marketing', 'TCD Cosmetology (Technology Center of DuPage)', 'The Lion (school newspaper)'].join('\n');
  var SOURCES = [['ape', 'Adaptive PE'], ['art', 'Art'], ['cul', 'Culinary'], ['board', 'Theatre Board'], ['rec', 'A teacher recommended me'], ['other', 'Other']];      // the first version (one choice): read old answers only
  var CHOICE = { y: 'I can be there', m: 'Maybe', n: 'I can’t' };
  var THU_CHOICE = { y: 'Yes, I can miss the whole day', m: 'Maybe', n: 'No, I can’t' };
  function def() { return { intro: DEF_INTRO, due: '', open: true, rehearsals: DEF_REH, thu: DEF_THU, shows: DEF_SHOWS, jobs: DEF_JOBS, groups: DEF_GROUPS }; }
  /* "12/4/2027 words" or "2027-12-04 words", one per line; "(optional)" at the end: no answer needed. Same-day lines get b, c… */
  function parseDates(text) {
    var out = [], bad = [], seen = {};
    String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
      var m = l.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*[-–:,]?\s*(.*)$/), d;
      if (m) d = m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
      else { m = l.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–:,]?\s*(.*)$/); if (m) d = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(+m[1]) + '-' + pad(+m[2]); }
      if (!d || isNaN(new Date(d + 'T12:00:00')) || +d.slice(5, 7) > 12 || +d.slice(8) > 31 || !m[4].trim()) { bad.push(l); return; }
      var what = m[4].trim().slice(0, 200), opt = /\(optional\)\s*$/i.test(what), n = seen[d] = (seen[d] || 0) + 1;
      out.push({ id: n > 1 ? d + String.fromCharCode(96 + n) : d, date: d, what: what.replace(/\s*\(optional\)\s*$/i, ''), optional: opt });
    });
    return { dates: out, bad: bad };
  }
  var datesText = function (l) { return l.map(function (x) { var a = x.date.split('-'); return +a[1] + '/' + +a[2] + '/' + a[0] + ' ' + x.what + (x.optional ? ' (optional)' : ''); }).join('\n'); };
  function slug(s) { return String(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'job'; }
  function parseJobs(text) { var seen = {}; return String(text || '').split('\n').map(function (l) { return l.trim().slice(0, 120); }).filter(Boolean).slice(0, 40).map(function (n) { var id = slug(n); while (seen[id]) id += '2'; seen[id] = 1; return { id: id, name: n }; }); }
  /* what the public page shows (no one's answers in it): the form words -> lists */
  function publicForm(f, title) {
    return { v: 1, title: title || 'Our show', intro: f.intro || '', due: f.due || '', open: f.open !== false,
      rehearsals: parseDates(f.rehearsals).dates, thu: parseDates(f.thu).dates.slice(0, 1), shows: parseDates(f.shows).dates, jobs: parseJobs(f.jobs), groups: parseJobs(f.groups == null ? DEF_GROUPS : f.groups).filter(function (g) { return g.id !== 'rec' && g.id !== 'other'; }) };
  }
  var allDates = function (P) { return [].concat(P.rehearsals || [], P.thu || [], P.shows || []); };
  var isThu = function (P, id) { return (P.thu || []).some(function (x) { return x.id === id; }); };
  var str = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
  /* the answers, tidied: only known dates and jobs, every text cut to size */
  function clean(P, a) {
    a = a || {}; var ans = {}, why = {}, ids = {};
    allDates(P).forEach(function (d) { var v = (a.ans || {})[d.id]; if (v === 'y' || v === 'm' || v === 'n') { ans[d.id] = v; if (v !== 'y' && str((a.why || {})[d.id], 200)) why[d.id] = str(a.why[d.id], 200); } });
    (P.jobs || []).forEach(function (j) { ids[j.id] = 1; });
    var gs = {}; (P.groups || []).forEach(function (g) { gs[g.id] = 1; }); gs.rec = gs.other = 1;
    var src = (Array.isArray(a.src) ? a.src : []).filter(function (x, i, l) { return gs[x] && l.indexOf(x) === i; }).slice(0, 40);
    return { v: 2, name: str(a.name, 80), grade: str(a.grade, 12), email: str(a.email, 120).toLowerCase(), src: src, recBy: src.indexOf('rec') >= 0 ? str(a.recBy, 80) : '', other: src.indexOf('other') >= 0 ? str(a.other, 120) : '',
      ans: ans, why: why, jobs: (a.jobs || []).filter(function (j) { return ids[j]; }).slice(0, 40), story: str(a.story, 2000), notFor: str(a.notFor, 600), food: str(a.food, 300), comments: str(a.comments, 600) };
  }
  /* what is still missing: ['name', 'email', 'src', 'recBy', 'other', 'date:<id>', 'why:<id>', 'story'] */
  function missing(P, a) {
    var out = [];
    if (!a.name || a.name.split(/\s+/).length < 2) out.push('name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email || '')) out.push('email');
    var src = a.src || [];
    if (!src.length) out.push('src');
    if (src.indexOf('rec') >= 0 && !a.recBy) out.push('recBy');
    if (src.indexOf('other') >= 0 && !a.other) out.push('other');
    allDates(P).forEach(function (d) {
      var v = (a.ans || {})[d.id];
      if (!v) { if (!d.optional) out.push('date:' + d.id); }
      else if (v !== 'y' && !(a.why || {})[d.id]) out.push('why:' + d.id);
    });
    if (String(a.story || '').length < 20) out.push('story');
    return out;
  }
  /* a person's id from their email (the same person sending again replaces their answers) */
  function personId(email) { var s = String(email || '').trim().toLowerCase(), h1 = 0x811c9dc5, h2 = 0; for (var i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0; h2 = (h2 * 31 + s.charCodeAt(i)) >>> 0; } return 'v' + h1.toString(36) + h2.toString(36); }
  function shortName(n) { var w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[0] + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.' : w[0] || ''; }
  /* the show's copy: nothing private */
  function showCopy(a, at) { return { id: personId(a.email), short: shortName(a.name), at: at || '', src: a.src, ans: a.ans, jobs: a.jobs }; }
  /* how they heard, in words: "Best Buddies, NHS, Recommended by Ms. Lee, Other: a poster" (the name and the Other words are in the vault) */
  function srcName(p, priv, P) {
    priv = priv || {};
    if (typeof p.src === 'string') { var s = SOURCES.find(function (x) { return x[0] === p.src; }); return s ? s[1] + (priv.srcText ? ': ' + priv.srcText : '') : ''; }      // the first version
    return (p.src || []).map(function (id) {
      if (id === 'rec') return 'Recommended by ' + (priv.recBy || '…');
      if (id === 'other') return 'Other' + (priv.other ? ': ' + priv.other : '');
      var g = ((P || {}).groups || []).find(function (x) { return x.id === id; }); return g ? g.name : '';
    }).filter(Boolean).join(', ');
  }
  /* per date: how many can come, maybe, can't, no answer; sel = Selected applicants who can come (status from the vault);
     short = fewer Selected who can come than needed */
  function tally(P, people, need, job, status) {
    status = status || {};
    var list = (people || []).filter(function (p) { return !job || (p.jobs || []).indexOf(job) >= 0; });
    return allDates(P).map(function (d) {
      var c = { id: d.id, date: d.date, what: d.what, y: 0, m: 0, n: 0, none: 0, sel: 0, need: +((need || {})[d.id]) || 0 };
      list.forEach(function (p) { var v = (p.ans || {})[d.id]; if (v) c[v]++; else c.none++; if (v === 'y' && status[p.id] === 'yes') c.sel++; });
      c.short = c.need > 0 && c.sel < c.need; return c;
    });
  }
  var statusName = function (st) { var x = STATUS.find(function (s) { return s[0] === (st || ''); }); return x ? x[1] : 'Not decided'; };
  var STATUS = [['', 'Not decided'], ['yes', 'Selected'], ['later', 'Maybe later'], ['no', 'Not this time']];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayShort(d) { var x = new Date(d + 'T12:00:00'); return DOW[x.getDay()] + ' ' + (x.getMonth() + 1) + '/' + x.getDate(); }
  function csvCell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
  /* the spreadsheet, made in the teacher's browser: one row per volunteer, A–Z */
  function csv(P, people, priv) {
    priv = priv || {}; var ds = allDates(P), jobs = P.jobs || [];
    var head = ['Name', 'Status', 'Grade', 'Email', 'How they heard about us'].concat(ds.map(function (d) { return dayShort(d.date) + ': ' + d.what; }), ['Ways to help', 'About them', 'Would NOT enjoy / not good at', 'Food allergies', 'Comments', 'Private note', 'Answered']);
    var rows = (people || []).slice().sort(function (a, b) { var x = (priv[a.id] || {}).name || a.short, y = (priv[b.id] || {}).name || b.short; return x.localeCompare(y); }).map(function (p) {
      var q = priv[p.id] || {};
      return [q.name || p.short, statusName(q.status), q.grade || '', q.email || '', srcName(p, q, P)].concat(ds.map(function (d) { var v = (p.ans || {})[d.id], w = (q.why || {})[d.id]; return v ? (isThu(P, d.id) ? THU_CHOICE : CHOICE)[v] + (w ? ': ' + w : '') : 'No answer'; }),
        [(p.jobs || []).map(function (j) { var x = jobs.find(function (y) { return y.id === j; }); return x ? x.name : ''; }).filter(Boolean).join('; '), q.story || '', q.notFor || '', q.food || '', q.comments || '', q.note || '', p.at ? String(p.at).slice(0, 10) : '']);
    });
    return '﻿' + [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }
  var core = { statusName: statusName, OLD_INTRO: OLD_INTRO, STATUS: STATUS, def: def, parseDates: parseDates, datesText: datesText, parseJobs: parseJobs, publicForm: publicForm, allDates: allDates, isThu: isThu, clean: clean, missing: missing,
    personId: personId, shortName: shortName, showCopy: showCopy, srcName: srcName, tally: tally, dayShort: dayShort, csv: csv, SOURCES: SOURCES, DEF_GROUPS: DEF_GROUPS, CHOICE: CHOICE, THU_CHOICE: THU_CHOICE };
  /* sealing (browser and node 20+): seal with the public key; open with the private key */
  var te = new TextEncoder(), td = new TextDecoder();
  function b64(bytes) { var s = '', a = new Uint8Array(bytes); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  var RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
  core.newKeys = function () {
    return crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])
      .then(function (k) { return Promise.all([crypto.subtle.exportKey('jwk', k.publicKey), crypto.subtle.exportKey('jwk', k.privateKey)]); })
      .then(function (r) { return { pub: { kty: r[0].kty, n: r[0].n, e: r[0].e, alg: r[0].alg }, priv: r[1] }; });
  };
  core.seal = function (pubJwk, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12)), aes;
    return Promise.all([crypto.subtle.importKey('jwk', Object.assign({ ext: true }, pubJwk), RSA, false, ['encrypt']), crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])])
      .then(function (r) { aes = r[1]; return Promise.all([crypto.subtle.exportKey('raw', aes).then(function (raw) { return crypto.subtle.encrypt(RSA, r[0], raw); }), crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aes, te.encode(JSON.stringify(obj)))]); })
      .then(function (r) { return { k: b64(r[0]), iv: b64(iv), data: b64(r[1]) }; });
  };
  core.open = function (privJwk, box) {
    return crypto.subtle.importKey('jwk', privJwk, RSA, false, ['decrypt']).then(function (pk) { return crypto.subtle.decrypt(RSA, pk, unb64(box.k)); })
      .then(function (raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); })
      .then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.data)); })
      .then(function (b) { return JSON.parse(td.decode(b)); });
  };
  root.CrewCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- Teacher mode › Families and helpers › Tech Week Crew ---------- */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.T || !window.Store) return;
  var T = window.T, C = window.CrewCore, esc = T.esc, icon = T.icon, app = document.getElementById('app'), API = '/theatre/api/';
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  function S() { var c = T.show.crew = T.show.crew || {}; c.form = c.form || C.def(); if (c.form.intro === C.OLD_INTRO) c.form.intro = C.def().intro; c.need = c.need || {}; c.people = c.people || []; return c; }      // the first wording becomes the application wording
  var formUrl = function () { return location.origin + '/theatre/crew/'; };
  var P = function () { return C.publicForm(S().form, T.O().title); };
  var jsonOf = function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); return d; }); };
  /* the keys: made once, the private one kept in the vault */
  function keys() {
    return T.openVault().then(function (V) {
      var c = V.extra.crew; if (c && c.priv && c.pub) return c;
      return C.newKeys().then(function (k) { return T.withVault(function (W) { W.extra.crew = Object.assign(W.extra.crew || {}, k); }).then(function () { return T.saveShow('Crew form keys made'); }).then(function () { return k; }); });
    });
  }
  function publish() {
    return keys().then(function (k) { return fetch(API + 'crew/form', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proof: T.proof, form: Object.assign(P(), { pub: k.pub }) }) }).then(jsonOf); })
      .then(function () { S().published = JSON.stringify(P()); });
  }
  /* take in new answers: open them, private parts into the vault, the rest into the show, then clear them from the server */
  function pull() {
    if (!T.proof) return Promise.resolve(0);
    return fetch(API + 'crew/in', { headers: { 'x-proof': T.proof }, cache: 'no-store' }).then(jsonOf).then(function (d) {
      var list = d.answers || []; if (!list.length) return 0;
      return keys().then(function (k) {
        return Promise.all(list.map(function (x) { return C.open(k.priv, x.box).then(function (a) { return { id: x.id, at: x.at, a: C.clean(P(), a) }; }, function () { return { id: x.id, junk: true }; }); }));
      }).then(function (got) {
        var good = got.filter(function (g) { return !g.junk && g.a.email && g.a.name; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; }), c = S();
        return T.withVault(function (V) {
          var vc = V.extra.crew = V.extra.crew || {}, pp = vc.people = vc.people || {};
          good.forEach(function (g) {
            var s = C.showCopy(g.a, g.at), i = c.people.findIndex(function (p) { return p.id === s.id; });
            if (i >= 0) { s.guest = c.people[i].guest; c.people[i] = s; } else c.people.push(s);
            var was = pp[s.id] || {}; pp[s.id] = { status: was.status || '', note: was.note || '', name: g.a.name, grade: g.a.grade, email: g.a.email, recBy: g.a.recBy, other: g.a.other, why: g.a.why, story: g.a.story, notFor: g.a.notFor, food: g.a.food, comments: g.a.comments };
          });
        }).then(function () { return good.length ? T.saveShow(good.length + ' new crew answer' + (good.length === 1 ? '' : 's')) : null; })
          .then(function () { return fetch(API + 'crew/in', { method: 'DELETE', headers: { 'x-proof': T.proof, 'content-type': 'application/json' }, body: JSON.stringify({ ids: got.map(function (g) { return g.id; }) }) }); })
          .then(function () { return good.length; });
      });
    });
  }
  T.crewPull = pull;
  /* reminder emails (mail.js remList): each date a volunteer said they can come, to the email they gave */
  T.crewSignups = function (vm) {
    var priv = (vm.crew || {}).people || {}, Pf = P(), ds = C.allDates(Pf);
    var out = [];
    S().people.forEach(function (p) {
      var q = priv[p.id]; if (!q || !q.email || q.status !== 'yes') return;      // only applicants she selected
      ds.forEach(function (d) { if ((p.ans || {})[d.id] === 'y') out.push({ to: q.email, name: q.name, date: d.date, title: 'Tech Week Crew', what: d.what, page: 'crew/' }); });
    });
    return out;
  };

  T.teacherPages = T.teacherPages || {};
  var job = '', show = '', heard = '', priv = {};
  var stOf = function (id) { return (priv[id] || {}).status || ''; };
  var statusMap = function () { var m = {}; Object.keys(priv).forEach(function (id) { m[id] = priv[id].status || ''; }); return m; };
  var stTag = function (st) { return '<span class="tag" style="' + (st === 'yes' ? 'background:var(--good);color:#fff' : st === 'no' ? 'background:var(--line)' : st === 'later' ? 'background:var(--warn-bg)' : '') + '">' + esc(C.statusName(st)) + '</span>'; };
  T.teacherPages.crew = function () {
    T.setBar('Tech Week Crew', '#/teacher');
    app.innerHTML = '<p class="muted">Opening…</p>';
    var load = function () { return T.openVault().then(function (V) { priv = ((V.extra.crew || {}).people) || {}; }); };
    var first = S().published === JSON.stringify(P()) ? Promise.resolve() : publish().catch(function (e) { T.toast('The form could not be updated: ' + (e.message || e), 6000); });
    first.then(load).then(draw).then(pull).then(function (n) { if (n) return load().then(draw); }).catch(function (e) { T.toast(e.message || String(e), 6000); });
  };
  function mark(v) { return v === 'y' ? '<span style="color:var(--good);font-weight:700" title="Can be there">✓</span>' : v === 'm' ? '<span style="color:var(--warn);font-weight:700" title="Maybe">?</span>' : v === 'n' ? '<span style="color:var(--bad);font-weight:700" title="Can’t">✕</span>' : '<span class="muted">·</span>'; }
  function draw() {
    var c = S(), Pf = P(), ds = C.allDates(Pf), f = c.form, people = c.people.filter(function (p) { return (!job || (p.jobs || []).indexOf(job) >= 0) && (!show || stOf(p.id) === (show === 'none' ? '' : show)) && (!heard || (Array.isArray(p.src) ? p.src : []).indexOf(heard) >= 0); });
    people.sort(function (a, b) { return ((priv[a.id] || {}).name || a.short).localeCompare((priv[b.id] || {}).name || b.short); });
    var t = C.tally(Pf, c.people, c.need, job, statusMap());
    app.innerHTML =
      '<div class="card"><h2>' + sym('🛠️') + 'Tech Week Crew applications</h2><p>Students apply to help with tech week and show week: when they can come and how they would like to help. <b>No password:</b> anyone with the link can apply. You choose the crew: mark each applicant Selected, Maybe later or Not this time. Nobody is emailed automatically.</p>' +
      '<p><a href="' + esc(formUrl()) + '" target="_blank" rel="noopener"><b>' + esc(formUrl()) + '</b></a></p><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn small" id="cpy">Copy the link</button><a class="btn small" href="' + esc(formUrl()) + '" target="_blank" rel="noopener">Open the form</a></div>' +
      '<label class="switch"><span><b>Applications are open</b> (off: the form says applications are closed)</span><input type="checkbox" id="opn"' + (f.open !== false ? ' checked' : '') + '></label>' +
      '<p class="muted small">' + sym('🔒') + 'Answers are locked in the volunteer’s browser so only Teacher mode can open them. Names, emails and what they write stay in the teacher-only list; the show keeps first name + last initial and the answers per date.</p></div>' +

      '<div class="card"><h3>' + sym('📅') + 'Who can come, and gaps to fill</h3><p class="small">Type how many people you need on each date. A date is red until enough <b>Selected</b> applicants can come.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Selected, can come</th><th>All who can come</th><th>Maybe</th><th>Can’t</th><th>Need</th></tr></thead><tbody>' +
      t.map(function (x) { return '<tr' + (x.short ? ' style="background:var(--bad-bg)"' : '') + '><td><b>' + esc(C.dayShort(x.date)) + '</b> <span class="small">' + esc(x.what) + '</span></td><td><b>' + x.sel + '</b>' + (x.short ? ' <span class="tag" style="background:var(--bad);color:#fff">' + (x.need - x.sel) + ' short</span>' : '') + '</td><td>' + x.y + '</td><td>' + x.m + '</td><td>' + x.n + '</td><td><input data-need="' + esc(x.id) + '" inputmode="numeric" maxlength="3" style="width:64px" value="' + (x.need || '') + '"></td></tr>'; }).join('') +
      '</tbody></table></div></div>' +

      '<div class="card"><div class="row" style="flex-wrap:wrap;gap:8px"><h3 class="grow" style="margin:0">' + sym('👥') + 'Applicants (' + c.people.length + ')</h3><label class="small">Show <select id="show">' + [['', 'Everyone'], ['yes', 'Selected'], ['later', 'Maybe later'], ['none', 'Not decided'], ['no', 'Not this time']].map(function (o) { var n = c.people.filter(function (p) { return !o[0] || stOf(p.id) === (o[0] === 'none' ? '' : o[0]); }).length; return '<option value="' + o[0] + '"' + (show === o[0] ? ' selected' : '') + '>' + o[1] + ' (' + n + ')</option>'; }).join('') + '</select></label><label class="small">Way to help <select id="job"><option value="">Everyone</option>' + Pf.jobs.map(function (j) { var n = c.people.filter(function (p) { return (p.jobs || []).indexOf(j.id) >= 0; }).length; return '<option value="' + esc(j.id) + '"' + (job === j.id ? ' selected' : '') + '>' + esc(j.name.replace(/\s*\(.*\)$/, '')) + ' (' + n + ')</option>'; }).join('') + '</select></label><label class="small">Heard from <select id="heard"><option value="">Anywhere</option>' + Pf.groups.concat([{ id: 'rec', name: 'Recommended by someone' }, { id: 'other', name: 'Other' }]).map(function (g) { var n = c.people.filter(function (p) { return Array.isArray(p.src) && p.src.indexOf(g.id) >= 0; }).length; return '<option value="' + esc(g.id) + '"' + (heard === g.id ? ' selected' : '') + '>' + esc(g.name) + ' (' + n + ')</option>'; }).join('') + '</select></label>' +
      '<button class="btn small noprint" id="mails">Copy these emails</button><button class="btn small noprint" id="csv">⬇ Spreadsheet</button><button class="btn small noprint" onclick="print()">' + icon('print') + 'Print</button><button class="btn small noprint" id="chk">Check for new answers</button></div>' +
      (people.length ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th>' + ds.map(function (d) { return '<th title="' + esc(d.what) + '">' + esc(C.dayShort(d.date)) + '</th>'; }).join('') + '<th>Ways to help</th></tr></thead><tbody>' +
        people.map(function (p) {
          var q = priv[p.id] || {};
          return '<tr><td><button class="btn quiet small" data-who="' + esc(p.id) + '" style="padding:4px 6px;text-align:left"><b>' + esc(q.name || p.short) + '</b></button>' + ' ' + stTag(q.status) + (p.guest ? ' <span class="tag">on the cast list</span>' : '') + '<br><span class="muted small">' + esc(C.srcName(p, q, Pf)) + '</span>' + (q.note ? '<br><span class="small">📝 ' + esc(q.note.length > 60 ? q.note.slice(0, 60) + '…' : q.note) + '</span>' : '') + '</td>' +
            ds.map(function (d) { var w = (q.why || {})[d.id]; return '<td' + (w ? ' title="' + esc(w) + '"' : '') + '>' + mark((p.ans || {})[d.id]) + (w ? ' <span class="small">💬</span>' : '') + '</td>'; }).join('') +
            '<td class="small">' + (p.jobs || []).map(function (j) { var x = Pf.jobs.find(function (y) { return y.id === j; }); return x ? esc(x.name.replace(/\s*\(.*\)$/, '')) : ''; }).filter(Boolean).join(', ') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="muted small">✓ can be there · ? maybe · ✕ can’t · 💬 they wrote why. Tap a name for everything they wrote.</p>'
        : '<p class="muted">' + (job || show || heard ? 'No one here yet.' : 'No applications yet. Share the link with the adaptive PE, art and culinary teachers and the Theatre Board.') + '</p>') + '</div>' +

      '<details class="card noprint"><summary><b>' + sym('✏️') + 'The questions</b></summary>' +
      '<label class="f">Welcome words at the top<textarea id="fi" maxlength="800">' + esc(f.intro) + '</textarea></label>' +
      '<label class="f">Please answer by (optional)<input type="date" id="fd" value="' + esc(f.due || '') + '"></label>' +
      '<label class="f">Rehearsals, one per line (date, then the words; add “(optional)” at the end if an answer isn’t needed)<textarea id="fr">' + esc(f.rehearsals) + '</textarea></label>' +
      '<label class="f">The in-school show day (they are asked if they can miss the whole school day)<input id="ft" value="' + esc(f.thu) + '"></label>' +
      '<label class="f">Evening shows, one per line<textarea id="fs">' + esc(f.shows) + '</textarea></label>' +
      '<label class="f">Ways to help, one per line<textarea id="fj" style="min-height:240px">' + esc(f.jobs) + '</textarea></label>' +
      '<label class="f">How did you hear about us? Groups, one per line (“Recommended by” and “Other”, each with a box to type in, are always added at the end)<textarea id="fg" style="min-height:240px">' + esc(f.groups == null ? C.DEF_GROUPS : f.groups) + '</textarea></label>' +
      '<p id="fe" class="err" role="alert"></p><div class="row end"><button class="btn" id="fdef">Back to the starting questions</button><button class="btn primary" id="fsv">Save and update the form</button></div>' +
      '<p class="muted small">Every date must be answered (I can be there / Maybe / I can’t), and Maybe or I can’t needs a reason. Changing a date’s words keeps the answers; changing the date itself starts that date fresh.</p></details>';

    document.getElementById('cpy').onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(formUrl()) : Promise.reject()).then(function () { T.toast('Link copied'); }, function () { T.toast(formUrl(), 6000); }); };
    document.getElementById('opn').onchange = function () { f.open = this.checked; publish().then(function () { return T.saveShow(f.open ? 'The crew form is open' : 'The crew form is closed'); }).catch(function (e) { T.toast(e.message || String(e), 6000); }); };
    app.querySelectorAll('[data-need]').forEach(function (inp) { inp.onchange = function () { var v = Math.max(0, Math.min(200, parseInt(inp.value, 10) || 0)); if (v) c.need[inp.dataset.need] = v; else delete c.need[inp.dataset.need]; T.saveShow('Saved').then(draw); }; });
    document.getElementById('job').onchange = function () { job = this.value; draw(); };
    document.getElementById('show').onchange = function () { show = this.value; draw(); };
    document.getElementById('heard').onchange = function () { heard = this.value; draw(); };
    document.getElementById('mails').onclick = function () {      // to email the people shown, by hand (Colleen writes to them herself)
      var list = people.map(function (p) { return (priv[p.id] || {}).email; }).filter(Boolean).join(', ');
      if (!list) { T.toast('No emails here'); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(list) : Promise.reject()).then(function () { T.toast(people.length + ' email' + (people.length === 1 ? '' : 's') + ' copied: paste them into an email'); }, function () { T.dialog('<h2>Emails</h2><textarea style="width:100%;min-height:120px" readonly>' + esc(list) + '</textarea><div class="row end"><button class="btn primary" id="mx">Close</button></div>', function (d) { d.querySelector('#mx').onclick = function () { d.close(); }; }); });
    };
    document.getElementById('csv').onclick = function () {
      var url = URL.createObjectURL(new Blob([C.csv(Pf, c.people, priv)], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
      a.href = url; a.download = 'tech-week-crew-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    };
    document.getElementById('chk').onclick = function () { var b = this; b.disabled = true; pull().then(function (n) { T.toast(n ? n + ' new' : 'Nothing new yet'); return T.openVault(); }).then(function (V) { priv = ((V.extra.crew || {}).people) || {}; draw(); }, function (e) { b.disabled = false; T.toast(e.message || String(e), 6000); }); };
    app.querySelectorAll('[data-who]').forEach(function (b) { b.onclick = function () { person(c.people.find(function (p) { return p.id === b.dataset.who; })); }; });
    var v = function (id) { return document.getElementById(id).value; };
    document.getElementById('fdef').onclick = function () { var d = C.def(); ['fi', 'fr', 'ft', 'fs', 'fj', 'fg'].forEach(function (id, i) { document.getElementById(id).value = d[['intro', 'rehearsals', 'thu', 'shows', 'jobs', 'groups'][i]]; }); };
    document.getElementById('fsv').onclick = function () {
      var bad = [].concat(C.parseDates(v('fr')).bad, C.parseDates(v('ft')).bad, C.parseDates(v('fs')).bad), err = document.getElementById('fe');
      if (bad.length) { err.textContent = 'These lines need a date first, like 12/4/2027: ' + bad.join(' · '); return; }
      if (!C.parseJobs(v('fj')).length) { err.textContent = 'Add at least one way to help.'; return; }
      f.intro = v('fi').trim().slice(0, 800); f.due = v('fd'); f.rehearsals = v('fr'); f.thu = v('ft'); f.shows = v('fs'); f.jobs = v('fj'); f.groups = v('fg');
      publish().then(function () { return T.saveShow('The crew form is updated'); }).then(draw, function (e) { err.textContent = e.message || String(e); });
    };
  }
  function person(p) {
    if (!p) return;
    var q = priv[p.id] || {}, Pf = P(), c = S();
    var d = T.dialog('<h2>' + esc(q.name || p.short) + '</h2><p class="small">' + esc([q.grade ? 'Grade ' + q.grade : '', q.email].filter(Boolean).join(' · ')) + (p.at ? '<br><span class="muted">Answered ' + esc(new Date(p.at).toLocaleDateString()) + '</span>' : '') + '</p>' +
      '<div class="noprint" style="background:var(--hi);padding:10px 12px;border-radius:12px;margin:8px 0"><b>Your decision</b> <span class="muted small">(only teachers see this)</span><div class="seg" role="group" id="pst" style="margin:6px 0">' + C.STATUS.map(function (o) { return '<button type="button" data-st="' + o[0] + '" aria-pressed="' + ((q.status || '') === o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="f" style="margin:6px 0">Private note<textarea id="pnote" maxlength="600" style="min-height:70px">' + esc(q.note || '') + '</textarea></label><div class="row end"><button class="btn small primary" id="psv">Save</button></div></div>' +
      '<h3>When they can come</h3><ul>' + C.allDates(Pf).map(function (x) { var a = (p.ans || {})[x.id], w = (q.why || {})[x.id]; return '<li>' + mark(a) + ' <b>' + esc(C.dayShort(x.date)) + '</b> ' + esc(x.what) + (a ? ': ' + esc((C.isThu(Pf, x.id) ? C.THU_CHOICE : C.CHOICE)[a]) : ': no answer') + (w ? '<br><i>“' + esc(w) + '”</i>' : '') + '</li>'; }).join('') + '</ul>' +
      '<h3>How they heard about us</h3><p>' + (esc(C.srcName(p, q, Pf)) || '<span class="muted">No answer</span>') + '</p>' +
      '<h3>Ways to help</h3><p>' + ((p.jobs || []).map(function (j) { var x = Pf.jobs.find(function (y) { return y.id === j; }); return x ? esc(x.name) : ''; }).filter(Boolean).join('<br>') || '<span class="muted">None ticked</span>') + '</p>' +
      '<h3>About them</h3><p style="white-space:pre-wrap">' + esc(q.story || '') + '</p>' +
      (q.notFor ? '<h3>Would NOT enjoy / not good at</h3><p style="white-space:pre-wrap">' + esc(q.notFor) + '</p>' : '') +
      (q.food ? '<h3>Food allergies</h3><p>' + esc(q.food) + '</p>' : '') + (q.comments ? '<h3>Comments</h3><p style="white-space:pre-wrap">' + esc(q.comments) + '</p>' : '') +
      '<div class="row end noprint" style="flex-wrap:wrap;gap:8px"><button class="btn" id="pdel">Delete</button>' + (p.guest ? '' : '<button class="btn" id="pgu">Add to the cast list as a Guest</button>') + '<button class="btn" onclick="print()">' + icon('print') + 'Print</button><button class="btn primary" id="px">Close</button></div>' +
      (p.guest ? '' : '<p class="muted small noprint">A Guest is on the call board and in attendance only on run-through, tech, dress and show days.</p>'), function (dl) {
      dl.querySelector('#px').onclick = function () { dl.close(); };
      var st = q.status || '';
      dl.querySelectorAll('#pst button').forEach(function (b) { b.onclick = function () { st = b.dataset.st; dl.querySelectorAll('#pst button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
      dl.querySelector('#psv').onclick = function () {
        var note = dl.querySelector('#pnote').value.trim().slice(0, 600);
        T.withVault(function (V) { var vc = V.extra.crew = V.extra.crew || {}, pp = vc.people = vc.people || {}; pp[p.id] = Object.assign(pp[p.id] || {}, { status: st, note: note }); })
          .then(function () { priv[p.id] = Object.assign(priv[p.id] || {}, { status: st, note: note }); return T.saveShow((q.name || p.short) + ': ' + C.statusName(st)); }).then(function () { dl.close(); draw(); }, function (e) { T.toast(e.message || String(e), 6000); });
      };
      dl.querySelector('#pdel').onclick = function () {
        if (!confirm('Delete ' + (q.name || p.short) + '’s application?')) return;
        c.people = c.people.filter(function (x) { return x.id !== p.id; });
        T.withVault(function (V) { var vc = V.extra.crew || {}; if (vc.people) delete vc.people[p.id]; }).then(function () { return T.saveShow('Deleted'); }).then(function () { delete priv[p.id]; dl.close(); draw(); });
      };
      var g = dl.querySelector('#pgu');
      if (g) g.onclick = function () {
        var a = { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: q.name || p.short, chars: [], photo: '', access: Object.assign({}, T.DEF_ACCESS), guest: true, crew: p.id };
        (T.show.cast = T.show.cast || []).push(a); p.guest = a.id;
        T.saveShow((q.name || p.short) + ' is on the cast list as a Guest').then(function () { dl.close(); draw(); });
      };
    });
    return d;
  }
})();
