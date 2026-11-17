/* asl.cool/theatre: Partner classes (Colleen 2026-10-25: "use the app to generate a calendar invitation to share with me, the co teacher, and the teacher
   of a class we're partnering with for when their class is scheduled to come partner with their class and the objective of the session";
   "this is meant to help avoid forgotten or confused appointment days").
   Teacher › Rehearsals › Partner classes (#/teacher/partners): the partner classes (Dance Arts, Choir, Film & TV…) and each session they come:
   date, start and end, where, the objective and what happens. Each session makes an invitation for the two teachers and the partner teacher:
   "Google Calendar" opens a new event with everything filled in and the three guests added (she presses Save, and Google sends the invites);
   ".ics" is a calendar file for Outlook or Apple Calendar, with reminders the day before and 30 minutes before.
   A session remembers when it was sent; changing its date, time, place or objective afterwards marks it "Changed since sent", so an old
   invitation never quietly disagrees with the plan.
   Privacy: the classes and sessions are in the show (Company devices can read them: no names or emails there); the teachers' names and emails
   are in the vault (V.extra.partners), sealed with the teacher password.
   T.show.partners = { time: { start, end }, classes: [{ id, name }], sessions: [{ id, cls, date, start, end, where, title, goal, plan, seq, sent: { at, hash } }] }
   V.extra.partners = { us: { me, meEmail, co, coEmail }, cls: { <class id>: { teacher, email } } } */
(function (root) {
  'use strict';
  var TZ = 'America/Chicago';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var compact = function (d, t) { return String(d).replace(/-/g, '') + 'T' + String(t || '00:00').replace(':', '') + '00'; };
  function clean(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); }
  function okEmail(e) { return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(e || '').trim()); }
  function time12(t) { if (!t) return ''; var p = t.split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' AM' : ' PM'); }
  function longDay(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function shortDay(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  /* what a session's invitation depends on: when this changes after it was sent, the invitation is out of date */
  function hashOf(s) {
    var str = [s.cls, s.date, s.start, s.end, s.where, s.title, s.goal, s.plan].join('\u0001'), h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function status(s) { return !s.sent ? 'new' : s.sent.hash === hashOf(s) ? 'sent' : 'changed'; }
  function title(s, cls) { return s.title || ((cls ? cls.name : 'Partner class') + ' + Adaptive Theatre Arts'); }
  /* the invitation's words. P = { us, cls } from the vault */
  function details(s, cls, P) {
    var us = (P && P.us) || {}, pc = (P && P.cls && cls && P.cls[cls.id]) || {};
    var names = [us.me, us.co, pc.teacher].filter(Boolean);
    return [
      (cls ? cls.name : 'A partner class') + ' and LTHS Adaptive Theatre Arts, working together.',
      '\nObjective: ' + (s.goal || ''),
      s.plan ? '\nWhat happens: ' + s.plan : '',
      s.where ? '\nWhere: ' + s.where : '',
      '\nWhen: ' + longDay(s.date) + ', ' + time12(s.start) + ' to ' + time12(s.end),
      names.length ? '\nTeachers: ' + names.join(', ') : '',
      '\nIf this day or time no longer works, please reply' + (us.me ? ' to ' + us.me : '') + ' so we can move it.'
    ].filter(function (x) { return x !== ''; }).join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function guests(cls, P) {
    var us = (P && P.us) || {}, pc = (P && P.cls && cls && P.cls[cls.id]) || {};
    var seen = {};
    return [us.meEmail, us.coEmail, pc.email].filter(function (e) { e = String(e || '').trim().toLowerCase(); if (!okEmail(e) || seen[e]) return false; seen[e] = 1; return true; });
  }
  /* Google Calendar's "new event" page with everything filled in; the guests get the invitation when she presses Save */
  function gcalUrl(s, cls, P) {
    var q = [['action', 'TEMPLATE'], ['text', title(s, cls)], ['dates', compact(s.date, s.start) + '/' + compact(s.date, s.end)], ['ctz', TZ],
      ['details', details(s, cls, P)], ['location', s.where || ''], ['add', guests(cls, P).join(',')]];
    return 'https:' + '/' + '/calendar.google.com/calendar/render?' + q.filter(function (x) { return x[1]; }).map(function (x) { return x[0] + '=' + encodeURIComponent(x[1]); }).join('&');
  }
  /* ---------- the .ics file (RFC 5545) ---------- */
  function icsText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {      // lines longer than 75 octets continue on the next line after a space
    var out = [], cur = '', n = 0;
    Array.from(line).forEach(function (ch) {
      var b = unescape(encodeURIComponent(ch)).length;
      if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
      cur += ch; n += b;
    });
    out.push(cur);
    return out.join('\r\n ');
  }
  var VTZ = ['BEGIN:VTIMEZONE', 'TZID:' + TZ, 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST',
    'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE'];
  function stamp(now) { var d = now || new Date(); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  /* list = [{ s, cls }]; P from the vault */
  function ics(list, P, now) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//asl.cool//Theatre partner classes//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'].concat(VTZ);
    list.forEach(function (x) {
      var s = x.s, cls = x.cls, us = (P && P.us) || {}, pc = (P && P.cls && cls && P.cls[cls.id]) || {};
      L.push('BEGIN:VEVENT', 'UID:' + s.id + '@asl.cool', 'SEQUENCE:' + (s.seq || 0), 'DTSTAMP:' + stamp(now),
        'DTSTART;TZID=' + TZ + ':' + compact(s.date, s.start), 'DTEND;TZID=' + TZ + ':' + compact(s.date, s.end),
        'SUMMARY:' + icsText(title(s, cls)), 'DESCRIPTION:' + icsText(details(s, cls, P)));
      if (s.where) L.push('LOCATION:' + icsText(s.where));
      if (okEmail(us.meEmail)) L.push('ORGANIZER;CN=' + icsText(us.me || us.meEmail) + ':mailto:' + us.meEmail.trim());
      [[us.me, us.meEmail], [us.co, us.coEmail], [pc.teacher, pc.email]].forEach(function (g) {
        if (okEmail(g[1])) L.push('ATTENDEE;CN=' + icsText(g[0] || g[1]) + ';ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:' + g[1].trim());
      });
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title(s, cls)) + ' tomorrow', 'TRIGGER:-P1D', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title(s, cls)) + ' in 30 minutes', 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  /* a session as typed -> problems (empty = fine) */
  function problems(s) {
    var p = [];
    if (!s.cls) p.push('Pick the partner class.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) p.push('Pick the date.');
    if (!/^\d{2}:\d{2}$/.test(s.start || '') || !/^\d{2}:\d{2}$/.test(s.end || '')) p.push('Set the start and end times.');
    else if (s.end <= s.start) p.push('The end time has to be after the start time.');
    if (!clean(s.goal, 10)) p.push('Write the objective: what the session is for.');
    return p;
  }
  var core = { TZ: TZ, hashOf: hashOf, status: status, title: title, details: details, guests: guests, gcalUrl: gcalUrl, ics: ics, fold: fold, problems: problems, okEmail: okEmail, time12: time12, shortDay: shortDay, clean: clean };
  root.PartnerCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.T) return;
  var T = window.T, PC = window.PartnerCore, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var SUGGEST = ['Dance Arts', 'Dance Fitness', 'Choir', 'Film & TV Production', 'Digital Photo Art', 'Graphic Design', 'Fashion & Interior Design', 'Advanced Engineering Design', 'Woodworking', 'Drawing & Painting', 'Music Design & Technology', 'TCD Cosmetology'];
  var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  function D() { var p = T.show.partners = T.show.partners || {}; p.time = p.time || { start: '', end: '' }; p.classes = p.classes || []; p.sessions = p.sessions || []; return p; }
  var clsById = function (id) { return D().classes.find(function (c) { return c.id === id; }); };
  var nid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  function download(text, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function fileName(s, cls) { return ((cls ? cls.name : 'Partner') + ' ' + s.date).replace(/[^A-Za-z0-9 -]+/g, '').replace(/\s+/g, '-') + '.ics'; }
  /* the Teacher home tile: the next session, and how many invitations still need sending */
  T.partnersSummary = function () {
    var p = T.show.partners; if (!p || !(p.sessions || []).length) return 'Sessions with other classes, and calendar invitations';
    var up = p.sessions.filter(function (s) { return s.date >= todayStr(); }).sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
    var todo = up.filter(function (s) { return PC.status(s) !== 'sent'; }).length, nx = up[0], c = nx && (p.classes || []).find(function (x) { return x.id === nx.cls; });
    return (nx ? 'Next: ' + PC.shortDay(nx.date) + ', ' + (c ? c.name : '') : 'No sessions coming up') + (todo ? ' · ' + todo + ' invitation' + (todo === 1 ? '' : 's') + ' to send' : '');
  };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.partners = function () {
    T.setBar('Partner classes', '#/teacher');
    var P = null, showPast = false;
    T.openVault().then(function (V) { P = V.extra.partners || {}; P.us = P.us || {}; P.cls = P.cls || {}; draw(); }, function (e) { app.innerHTML = '<div class="card"><p>' + esc(e.message || String(e)) + '</p></div>'; });
    function saveVault(f, msg) { return T.withVault(function (V) { var x = V.extra.partners = V.extra.partners || {}; x.us = x.us || {}; x.cls = x.cls || {}; f(x); P = x; }).then(function () { return T.saveShow(msg); }); }
    function row(s) {
      var c = clsById(s.cls), st = PC.status(s), pc = (c && P.cls[c.id]) || {};
      var tag = st === 'sent' ? '<span class="tag" style="background:#e5f4e4;color:#1d5c2a">✓ Sent ' + esc(PC.shortDay(s.sent.at)) + '</span>' : st === 'changed' ? '<span class="tag" style="background:#fbebeb;color:#8a1c1c">Changed since sent: send the update</span>' : '<span class="tag" style="background:#f9eeda;color:#7a4b00">Not sent yet</span>';
      return '<div class="card" style="margin:10px 0"><div class="row" style="flex-wrap:wrap;gap:6px;align-items:baseline"><b style="font-size:1.1em">' + esc(PC.shortDay(s.date)) + ', ' + esc(PC.time12(s.start)) + '–' + esc(PC.time12(s.end)) + '</b> <span>' + esc(c ? c.name : '(class deleted)') + (pc.teacher ? ' · ' + esc(pc.teacher) : '') + '</span> ' + tag + '</div>' +
        '<p style="margin:6px 0"><b>Objective:</b> ' + esc(s.goal || '') + '</p>' + (s.plan ? '<p class="small" style="margin:4px 0;white-space:pre-wrap">' + esc(s.plan) + '</p>' : '') + (s.where ? '<p class="small muted" style="margin:4px 0">📍 ' + esc(s.where) + '</p>' : '') +
        '<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn primary" data-g="' + esc(s.id) + '">' + icon('sched') + 'Google Calendar invitation</button><button class="btn" data-i="' + esc(s.id) + '">.ics file (Outlook, Apple)</button>' +
        (st !== 'sent' ? '<button class="btn" data-sent="' + esc(s.id) + '" data-save>✓ I sent it</button>' : '') + '<button class="btn quiet" data-e="' + esc(s.id) + '">Edit</button><button class="btn quiet" data-d="' + esc(s.id) + '" data-save>Delete</button></div></div>';
    }
    function draw() {
      var d = D(), us = P.us, now = todayStr();
      var up = d.sessions.filter(function (s) { return s.date >= now; }).sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
      var past = d.sessions.filter(function (s) { return s.date < now; }).sort(function (a, b) { return (b.date + b.start).localeCompare(a.date + a.start); });
      var noUs = !PC.okEmail(us.meEmail);
      app.innerHTML =
        '<div class="card"><h2 style="margin-top:0">' + sym('🤝') + 'Partner classes</h2><p class="small muted">Add a session each time a partner class comes to work with the Company. Each one makes a calendar invitation for you, your co-teacher and the partner teacher, with the date, time, place and the objective, so nobody forgets the day or mixes it up. Names and emails are locked with the teacher password.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn primary" id="padd"' + (d.classes.length ? '' : ' disabled') + '>+ Add a session</button>' + (up.length ? '<button class="btn" id="pall">All coming sessions (.ics)</button>' : '') + '</div>' +
        (d.classes.length ? '' : '<p class="small">First add a partner class below.</p>') + (noUs ? '<p class="small" style="color:#8a1c1c">Add your own email below, so the invitations include you.</p>' : '') + '</div>' +
        '<h3>Coming up</h3>' + (up.length ? up.map(row).join('') : '<p class="muted">No sessions coming up.</p>') +
        (past.length ? '<p><button class="btn quiet small" id="ppast">' + (showPast ? 'Hide' : 'Show') + ' past sessions (' + past.length + ')</button></p>' + (showPast ? past.map(row).join('') : '') : '') +
        '<div class="card"><h3 style="margin-top:0">Partner classes</h3>' + (d.classes.length ? d.classes.map(function (c) {
          var pc = P.cls[c.id] || {}, n = d.sessions.filter(function (s) { return s.cls === c.id; }).length;
          return '<div class="row" style="border-bottom:1px solid var(--line);padding:6px 0;gap:8px"><div class="grow"><b>' + esc(c.name) + '</b> <span class="muted small">' + esc(pc.teacher || 'no teacher yet') + (pc.email ? ' · ' + esc(pc.email) : '') + ' · ' + n + ' session' + (n === 1 ? '' : 's') + '</span></div><button class="btn small quiet" data-ce="' + esc(c.id) + '">Edit</button><button class="btn small quiet" data-cd="' + esc(c.id) + '" data-save>Delete</button></div>';
        }).join('') : '<p class="muted">None yet.</p>') + '<div class="row" style="margin-top:8px"><button class="btn" id="cadd">+ Add a partner class</button></div></div>' +
        '<div class="card"><h3 style="margin-top:0">On every invitation</h3><div class="row" style="flex-wrap:wrap;gap:12px">' +
        '<label class="f grow">Your name<input id="ume" maxlength="80" value="' + esc(us.me || '') + '"></label><label class="f grow">Your school email<input id="umeE" type="email" maxlength="120" value="' + esc(us.meEmail || '') + '"></label></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:12px"><label class="f grow">Co-teacher’s name<input id="uco" maxlength="80" value="' + esc(us.co || '') + '"></label><label class="f grow">Co-teacher’s email<input id="ucoE" type="email" maxlength="120" value="' + esc(us.coEmail || '') + '"></label></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:12px"><label class="f">Our class starts<input id="ts" type="time" value="' + esc(d.time.start || '') + '"></label><label class="f">and ends<input id="te" type="time" value="' + esc(d.time.end || '') + '"></label><span class="small muted grow">New sessions start with these times.</span></div>' +
        '<div class="row end"><button class="btn primary" id="usave" data-save>Save</button></div></div>';
      document.getElementById('usave').onclick = function () {
        var me = PC.clean(document.getElementById('ume').value, 80), meE = document.getElementById('umeE').value.trim(), co = PC.clean(document.getElementById('uco').value, 80), coE = document.getElementById('ucoE').value.trim();
        if ((meE && !PC.okEmail(meE)) || (coE && !PC.okEmail(coE))) { T.toast('One of those emails doesn’t look right.'); return; }
        d.time = { start: document.getElementById('ts').value, end: document.getElementById('te').value };
        saveVault(function (x) { x.us = { me: me, meEmail: meE, co: co, coEmail: coE }; }, 'Saved').then(draw, function (e) { T.toast(e.message || String(e), 6000); });
      };
      document.getElementById('cadd').onclick = function () { classDialog(null); };
      var pa = document.getElementById('padd'); if (pa) pa.onclick = function () { sessionDialog(null); };
      var pl = document.getElementById('pall'); if (pl) pl.onclick = function () { download(PC.ics(up.map(function (s) { return { s: s, cls: clsById(s.cls) }; }), P), 'Partner-sessions.ics'); };
      var pp = document.getElementById('ppast'); if (pp) pp.onclick = function () { showPast = !showPast; draw(); };
      app.querySelectorAll('[data-ce]').forEach(function (b) { b.onclick = function () { classDialog(clsById(b.dataset.ce)); }; });
      app.querySelectorAll('[data-cd]').forEach(function (b) { b.onclick = function () {
        var c = clsById(b.dataset.cd), n = d.sessions.filter(function (s) { return s.cls === c.id; }).length;
        if (!confirm('Delete ' + c.name + (n ? ' and its ' + n + ' session' + (n === 1 ? '' : 's') : '') + '? Invitations already sent stay in people’s calendars: delete those there.')) return;
        d.classes = d.classes.filter(function (x) { return x.id !== c.id; }); d.sessions = d.sessions.filter(function (s) { return s.cls !== c.id; });
        saveVault(function (x) { delete x.cls[c.id]; }, 'Deleted').then(draw);
      }; });
      var find = function (id) { return d.sessions.find(function (s) { return s.id === id; }); };
      app.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () {
        var s = find(b.dataset.g), c = clsById(s.cls);
        window.open(PC.gcalUrl(s, c, P), '_blank', 'noopener');
        T.toast('In Google Calendar, check the guests, press Save, then Send. Then come back and press “I sent it”.', 9000);
      }; });
      app.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () {
        var s = find(b.dataset.i), c = clsById(s.cls);
        download(PC.ics([{ s: s, cls: c }], P), fileName(s, c));
        T.toast('Open the file to add it to your calendar, or attach it to an email to the others. Then press “I sent it”.', 9000);
      }; });
      app.querySelectorAll('[data-sent]').forEach(function (b) { b.onclick = function () { var s = find(b.dataset.sent); s.sent = { at: todayStr(), hash: PC.hashOf(s) }; T.saveShow('Marked sent').then(draw); }; });
      app.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { sessionDialog(find(b.dataset.e)); }; });
      app.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () {
        var s = find(b.dataset.d);
        if (!confirm('Delete this session?' + (s.sent ? ' The invitation you sent stays in everyone’s calendar: delete or cancel it there too.' : ''))) return;
        d.sessions = d.sessions.filter(function (x) { return x.id !== s.id; }); T.saveShow('Deleted').then(draw);
      }; });
    }
    function classDialog(c) {
      var pc = (c && P.cls[c.id]) || {};
      T.dialog('<h2 style="margin-top:0">' + (c ? 'Edit ' + esc(c.name) : 'Add a partner class') + '</h2>' +
        '<label class="f">Class<input id="cn" maxlength="80" list="csug" value="' + esc(c ? c.name : '') + '" placeholder="e.g. Dance Arts"><datalist id="csug">' + SUGGEST.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></label>' +
        '<label class="f">Teacher’s name<input id="ct" maxlength="80" value="' + esc(pc.teacher || '') + '"></label>' +
        '<label class="f">Teacher’s school email<input id="ce" type="email" maxlength="120" value="' + esc(pc.email || '') + '"></label>' +
        '<p class="small muted">The name and email are locked with the teacher password; Company devices never see them.</p>' +
        '<div class="row end"><button class="btn quiet" id="cx">Cancel</button><button class="btn primary" id="cs" data-save>Save</button></div>', function (dl) {
        dl.querySelector('#cx').onclick = function () { dl.close(); };
        dl.querySelector('#cs').onclick = function () {
          var name = PC.clean(dl.querySelector('#cn').value, 80), t = PC.clean(dl.querySelector('#ct').value, 80), e = dl.querySelector('#ce').value.trim();
          if (!name) { T.toast('Type the class name.'); return; }
          if (e && !PC.okEmail(e)) { T.toast('That email doesn’t look right.'); return; }
          var d = D(), cc = c || { id: nid('c') };
          cc.name = name; if (!c) d.classes.push(cc);
          saveVault(function (x) { x.cls[cc.id] = { teacher: t, email: e }; }, name + ' saved').then(function () { dl.close(); T.teacherPages.partners.redraw(); }, function (er) { T.toast(er.message || String(er), 6000); });
        };
      });
    }
    function sessionDialog(s) {
      var d = D(), x = s ? Object.assign({}, s) : { cls: d.classes.length === 1 ? d.classes[0].id : '', date: '', start: d.time.start || '', end: d.time.end || '', where: '', title: '', goal: '', plan: '' };
      T.dialog('<h2 style="margin-top:0">' + (s ? 'Edit the session' : 'Add a session') + '</h2>' +
        '<label class="f">Partner class<select id="sc"><option value="">Pick one</option>' + d.classes.map(function (c) { return '<option value="' + esc(c.id) + '"' + (x.cls === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="row" style="flex-wrap:wrap;gap:12px"><label class="f">Date<input id="sd" type="date" value="' + esc(x.date) + '"></label><label class="f">Starts<input id="ss" type="time" value="' + esc(x.start) + '"></label><label class="f">Ends<input id="se" type="time" value="' + esc(x.end) + '"></label></div>' +
        '<label class="f">Where<input id="sw" maxlength="120" value="' + esc(x.where) + '" placeholder="e.g. the auditorium stage, or the dance studio"></label>' +
        '<label class="f">Objective (what the session is for) <span class="need">*</span><textarea id="sg" maxlength="500" placeholder="e.g. The dancers teach the Company the first half of Get’cha Head in the Game">' + esc(x.goal) + '</textarea></label>' +
        '<label class="f">What happens, what to bring (optional)<textarea id="sp" maxlength="1000" placeholder="e.g. Warm-up together, teach counts 1–32 in small groups, film the tutorial video. Bring: speaker, phone tripod">' + esc(x.plan) + '</textarea></label>' +
        '<label class="f">Invitation title (optional)<input id="st" maxlength="120" value="' + esc(x.title) + '" placeholder="Partner class + Adaptive Theatre Arts"></label>' +
        (s && s.sent ? '<p class="small" style="color:#7a4b00">This invitation was already sent. If you change the day, time, place or objective, send the update afterward.</p>' : '') +
        '<p id="serr" class="err" role="alert"></p><div class="row end"><button class="btn quiet" id="sx">Cancel</button><button class="btn primary" id="sv" data-save>Save</button></div>', function (dl) {
        dl.querySelector('#sx').onclick = function () { dl.close(); };
        dl.querySelector('#sv').onclick = function () {
          var v = function (id) { return dl.querySelector(id).value; };
          var y = { cls: v('#sc'), date: v('#sd'), start: v('#ss'), end: v('#se'), where: PC.clean(v('#sw'), 120), goal: PC.clean(v('#sg'), 500), plan: String(v('#sp')).trim().slice(0, 1000), title: PC.clean(v('#st'), 120) };
          var bad = PC.problems(y); if (bad.length) { dl.querySelector('#serr').textContent = bad.join(' '); return; }
          if (s) { var was = PC.hashOf(s); Object.assign(s, y); if (s.sent && PC.hashOf(s) !== was) s.seq = (s.seq || 0) + 1; }
          else d.sessions.push(Object.assign({ id: nid('ps'), seq: 0 }, y));
          T.saveShow(s ? 'Session saved' : 'Session added').then(function () { dl.close(); T.teacherPages.partners.redraw(); }, function (er) { T.toast(er.message || String(er), 6000); });
        };
      });
    }
    T.teacherPages.partners.redraw = function () { if (P) draw(); };
  };
})();
