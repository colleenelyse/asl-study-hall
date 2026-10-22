/* asl.cool/theatre Production: rehearsal calendar, who is called, attendance, conflicts (Teacher mode),
   and My Rehearsals for students (when am I called; "I can't come" sends an encrypted note the teacher's page picks up).
   T.show.production = { rehearsals: [{ id, date 'YYYY-MM-DD', start 'HH:MM', end, place, kind, scenes [ids], songs [ids], everyone, add [actor ids], remove [actor ids], notes }],
                         conflicts: [{ id, actor, date, start, end, why, from }], attendance: { rehearsalId: { actorId: here|late|absent|excused } } } */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var KINDS = [['rehearsal', '🎭', 'Rehearsal'], ['music', '🎵', 'Music'], ['dance', '💃', 'Dance'], ['run', '🔁', 'Run-through'], ['tech', '💡', 'Tech'], ['dress', '👗', 'Dress rehearsal'], ['show', '🌟', 'Show']];
  var MARKS = [['here', '✅', 'Here'], ['late', '⏰', 'Late'], ['absent', '❌', 'Absent'], ['excused', '📝', 'Excused']];
  var kind = function (k) { return KINDS.find(function (x) { return x[0] === k; }) || KINDS[0]; };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  function P() { var p = T.show.production = T.show.production || {}; p.rehearsals = p.rehearsals || []; p.conflicts = p.conflicts || []; p.attendance = p.attendance || {}; return p; }
  T.production = P;

  /* ---------- dates and times ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
  var today = function () { return ymd(new Date()); };
  function dayName(s, short) { return parse(s).toLocaleDateString('en-US', short ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric' }); }
  function time(t) { if (!t) return ''; var a = t.split(':'), h = +a[0]; return (h % 12 || 12) + (a[1] === '00' ? '' : ':' + a[1]) + (h < 12 ? ' AM' : ' PM'); }
  function span(x) { return x.start ? time(x.start) + (x.end ? '–' + time(x.end) : '') : 'All day'; }
  T.prodDay = dayName; T.prodSpan = span;
  function byTime(a, b) { return (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')); }
  /* a conflict that touches this rehearsal (no times = the whole day) */
  function overlaps(c, r) { return c.date === r.date && (!c.start || !r.start || (c.start < (r.end || '23:59') && (c.end || '23:59') > r.start)); }

  /* ---------- who is called ---------- */
  function cast() { return (T.show.cast || []).filter(function (a) { return a.chars && a.chars.length; }); }
  function calledChars(r) {
    if (r.everyone) return T.O().characters.map(function (c) { return c.id; });
    var ids = [];
    T.O().moments.forEach(function (m) {
      if (r.scenes.indexOf(m.scene) < 0 && (!m.song || r.songs.indexOf(m.song) < 0)) return;
      (m.on === '*' ? T.O().characters.map(function (c) { return c.id; }) : m.on).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    });
    return ids;
  }
  function called(r) {
    var chars = calledChars(r);
    return cast().filter(function (a) {
      if ((r.remove || []).indexOf(a.id) >= 0) return false;
      return r.everyone || (r.add || []).indexOf(a.id) >= 0 || a.chars.some(function (c) { return chars.indexOf(c) >= 0; });
    });
  }
  T.prodCalled = called;
  function conflictsFor(r) { var ids = called(r).map(function (a) { return a.id; }); return P().conflicts.filter(function (c) { return ids.indexOf(c.actor) >= 0 && overlaps(c, r); }); }
  function actor(id) { return (T.show.cast || []).find(function (a) { return a.id === id; }); }
  function what(r) {
    var bits = r.scenes.map(function (id) { var s = T.sceneById(id); return s ? 'Scene ' + s.num : ''; })
      .concat(r.songs.map(function (id) { var s = T.songById(id); return s ? '“' + s.title + '”' : ''; })).filter(Boolean);
    return r.everyone && !bits.length ? 'Whole cast' : bits.join(', ') || 'To be planned';
  }

  /* ---------- student notes (conflicts sent from iPads) ---------- */
  function pullNotes() {
    return Store.getNotes(T.key, T.proof).then(function (notes) {
      if (!notes.length) return 0;
      var added = 0, p = P();
      notes.forEach(function (n) {
        if (n._junk || n.type !== 'conflict' || !actor(n.actor) || !/^\d{4}-\d{2}-\d{2}$/.test(n.date || '')) return;
        var dup = p.conflicts.some(function (c) { return c.actor === n.actor && c.date === n.date && (c.start || '') === (n.start || ''); });
        if (!dup) { p.conflicts.push({ id: uid('x'), actor: n.actor, date: n.date, start: n.start || '', end: n.end || '', why: String(n.why || '').slice(0, 200), from: 'student', sent: n._at }); added++; }
      });
      var ids = notes.map(function (n) { return n._id; });
      return (added ? T.saveShow(added + ' new conflict' + (added === 1 ? '' : 's') + ' from students') : Promise.resolve()).then(function () { return Store.clearNotes(T.proof, ids); }).then(function () { return added; });
    });
  }

  /* ---------- Teacher: Production ---------- */
  var view = T.ls('prodView') || 'calendar', month = null;
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.production = function (args) {
    if (args[0] === 'r') return rehearsalPage(args[1]);
    if (args[0] === 'attend') return attendPage(args[1]);
    if (args[0] === 'callboard') return callboard(args[1]);
    overview();
    pullNotes().then(function (n) { if (n) overview(); }).catch(function () {});
  };
  function overview() {
    T.setBar('Production', '#/teacher');
    var p = P(), now = today();
    var tabs = [['calendar', 'Calendar'], ['list', 'List'], ['conflicts', 'Conflicts'], ['attendance', 'Attendance']];
    var h = '<div class="row noprint" style="margin-bottom:14px"><div class="seg">' + tabs.map(function (t) { return '<button data-v="' + t[0] + '" aria-pressed="' + (view === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><span class="grow"></span>' +
      '<button class="btn small" id="add">Add a rehearsal</button><button class="btn small" id="many">Add many</button><a class="btn small" href="#/teacher/production/callboard">Call board</a></div>';
    if (!cast().length) h += '<p class="card">Add the cast first (Teacher mode › Cast) so the app knows who to call.</p>';
    if (view === 'calendar') h += calendar();
    if (view === 'list') {
      var up = p.rehearsals.filter(function (r) { return r.date >= now; }).sort(byTime), past = p.rehearsals.filter(function (r) { return r.date < now; }).sort(byTime).reverse();
      h += (up.length ? up.map(card).join('') : '<p class="muted">No rehearsals coming up.</p>') +
        (past.length ? '<details style="margin-top:16px"><summary class="btn quiet">Past rehearsals (' + past.length + ')</summary>' + past.map(card).join('') + '</details>' : '');
    }
    if (view === 'conflicts') h += conflictsView();
    if (view === 'attendance') h += attendanceView();
    app.innerHTML = h;
    app.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { view = b.dataset.v; T.ls('prodView', view); overview(); }; });
    document.getElementById('add').onclick = function () { newRehearsal(now); };
    document.getElementById('many').onclick = addMany;
    app.querySelectorAll('[data-r]').forEach(function (el) { el.onclick = function (e) { e.preventDefault(); T.go('#/teacher/production/r/' + el.dataset.r); }; });
    app.querySelectorAll('[data-day]').forEach(function (el) { el.onclick = function (e) { if (e.target.closest('[data-r]')) return; newRehearsal(el.dataset.day); }; });
    var mv = function (d) { var m = month || now.slice(0, 7), y = +m.slice(0, 4), mo = +m.slice(5) - 1 + d; month = ymd(new Date(y, mo, 1)).slice(0, 7); overview(); };
    if (document.getElementById('pm')) { document.getElementById('pm').onclick = function () { mv(-1); }; document.getElementById('nm').onclick = function () { mv(1); }; }
    if (view === 'conflicts') wireConflicts();
  }
  function card(r) {
    var k = kind(r.kind), cf = conflictsFor(r), n = called(r).length;
    return '<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/teacher/production/r/' + r.id + '" data-r="' + r.id + '"><div class="row"><b class="grow">' + sym(k[1]) + esc(dayName(r.date)) + '</b><span class="muted">' + esc(span(r)) + '</span></div>' +
      '<div>' + esc(k[2]) + (r.place ? ' · ' + esc(r.place) : '') + ' · ' + esc(what(r)) + '</div>' +
      '<div class="muted small">' + n + ' called' + (cf.length ? ' · <span class="err">' + cf.length + ' conflict' + (cf.length === 1 ? '' : 's') + '</span>' : '') + (P().attendance[r.id] ? ' · attendance taken' : '') + '</div></a>';
  }
  function calendar() {
    var m = month || today().slice(0, 7), first = parse(m + '-01'), start = new Date(first); start.setDate(1 - first.getDay());
    var label = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), now = today();
    var h = '<div class="row" style="justify-content:center;margin-bottom:10px"><button class="round" id="pm" aria-label="Last month">' + icon('prev') + '</button><h2 style="margin:0;min-width:220px;text-align:center">' + esc(label) + '</h2><button class="round" id="nm" aria-label="Next month">' + icon('next') + '</button></div>' +
      '<div class="cal"><div class="cal-h">Sun</div><div class="cal-h">Mon</div><div class="cal-h">Tue</div><div class="cal-h">Wed</div><div class="cal-h">Thu</div><div class="cal-h">Fri</div><div class="cal-h">Sat</div>';
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i); var ds = ymd(d);
      if (i >= 35 && d.getMonth() !== first.getMonth()) break;
      var rs = P().rehearsals.filter(function (r) { return r.date === ds; }).sort(byTime);
      var cf = P().conflicts.filter(function (c) { return c.date === ds; }).length;
      h += '<div class="cal-d' + (d.getMonth() !== first.getMonth() ? ' out' : '') + (ds === now ? ' today' : '') + '" data-day="' + ds + '" title="Add a rehearsal on ' + esc(dayName(ds)) + '"><span class="n">' + d.getDate() + '</span>' +
        rs.map(function (r) { var c = conflictsFor(r).length; return '<a href="#/teacher/production/r/' + r.id + '" data-r="' + r.id + '" class="cal-r">' + kind(r.kind)[1] + ' ' + esc(time(r.start) || kind(r.kind)[2]) + (c ? ' <b class="err">!' + c + '</b>' : '') + '</a>'; }).join('') +
        (cf && !rs.length ? '<span class="muted small">' + cf + ' away</span>' : '') + '</div>';
    }
    return h + '</div><p class="muted small">Tap a day to add a rehearsal. <b class="err">!2</b> means two called actors have a conflict.</p>';
  }
  function conflictsView() {
    var list = P().conflicts.slice().sort(byTime), now = today();
    var rows = function (l) {
      return l.map(function (c) {
        var a = actor(c.actor), hit = P().rehearsals.filter(function (r) { return overlaps(c, r) && called(r).some(function (x) { return x.id === c.actor; }); });
        return '<tr><td>' + esc(dayName(c.date, true)) + '<br><span class="muted small">' + esc(span(c)) + '</span></td><td>' + (a ? T.face(a, 32) + ' ' + esc(a.name) : '<span class="muted">(removed)</span>') + '</td><td>' + esc(c.why || '') + (c.from === 'student' ? ' <span class="tag">from iPad</span>' : '') + '</td>' +
          '<td>' + (hit.length ? '<span class="err">Misses ' + hit.map(function (r) { return esc(kind(r.kind)[2].toLowerCase()); }).join(', ') + '</span>' : '<span class="muted">No rehearsal called</span>') + '</td><td><button class="btn small quiet" data-del="' + c.id + '">Delete</button></td></tr>';
      }).join('');
    };
    var up = list.filter(function (c) { return c.date >= now; }), past = list.filter(function (c) { return c.date < now; });
    return '<div class="card"><h3>Add a conflict</h3><div class="row"><label class="f grow" style="margin:0">Actor<select id="ca">' + cast().map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="margin:0">Day<input type="date" id="cd" value="' + today() + '"></label><label class="f" style="margin:0">From<input type="time" id="cs"></label><label class="f" style="margin:0">To<input type="time" id="ce"></label></div>' +
      '<label class="f">Why (optional)<input id="cw" maxlength="200" placeholder="Leave the times empty for the whole day"></label><div class="row end"><button class="btn primary" id="cadd" data-save>Add</button></div></div>' +
      '<p class="muted">Students can send their own from <b>My Rehearsals</b> on their iPad. They show up here when you open Production.</p>' +
      (up.length ? '<table class="tbl"><thead><tr><th>When</th><th>Who</th><th>Why</th><th>Rehearsal</th><th></th></tr></thead><tbody>' + rows(up) + '</tbody></table>' : '<p>No conflicts coming up.</p>') +
      (past.length ? '<details style="margin-top:14px"><summary class="btn quiet">Past (' + past.length + ')</summary><table class="tbl"><tbody>' + rows(past) + '</tbody></table></details>' : '');
  }
  function wireConflicts() {
    var add = document.getElementById('cadd');
    if (add) add.onclick = function () {
      var a = document.getElementById('ca').value, d = document.getElementById('cd').value; if (!a || !d) { T.toast('Pick the actor and the day.'); return; }
      var s = document.getElementById('cs').value, e = document.getElementById('ce').value;
      if (s && e && e <= s) { T.toast('The end time is before the start time.'); return; }
      P().conflicts.push({ id: uid('x'), actor: a, date: d, start: s, end: s ? e : '', why: document.getElementById('cw').value.trim(), from: 'teacher' });
      T.saveShow('Conflict added').then(overview);
    };
    app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this conflict?')) return; var p = P(); p.conflicts = p.conflicts.filter(function (c) { return c.id !== b.dataset.del; }); T.saveShow('Deleted').then(overview); }; });
  }
  function attendanceView() {
    var p = P(), list = p.rehearsals.filter(function (r) { return r.date <= today(); }).sort(byTime).reverse();
    var cnt = {}; cast().forEach(function (a) { cnt[a.id] = { here: 0, late: 0, absent: 0, excused: 0, called: 0 }; });
    p.rehearsals.forEach(function (r) { var at = p.attendance[r.id]; if (!at) return; called(r).forEach(function (a) { if (!cnt[a.id]) return; cnt[a.id].called++; if (at[a.id]) cnt[a.id][at[a.id]]++; }); });
    return '<div class="card"><h3>Take attendance</h3>' + (list.length ? '<div class="grid">' + list.slice(0, 8).map(function (r) {
      return '<a class="tile" style="min-height:90px" href="#/teacher/production/attend/' + r.id + '"><b>' + sym(kind(r.kind)[1]) + esc(dayName(r.date, true)) + '</b><span>' + (p.attendance[r.id] ? 'Taken ✓' : 'Not taken yet') + '</span></a>';
    }).join('') + '</div>' : '<p class="muted">No rehearsals yet today or before.</p>') + '</div>' +
      '<div class="card"><h3>So far</h3><table class="tbl"><thead><tr><th>Actor</th><th>Called</th>' + MARKS.map(function (m) { return '<th>' + m[1] + ' ' + m[2] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      cast().map(function (a) { var c = cnt[a.id]; return '<tr><td>' + esc(a.name) + '</td><td>' + c.called + '</td>' + MARKS.map(function (m) { return '<td' + (m[0] === 'absent' && c.absent ? ' class="err"' : '') + '>' + c[m[0]] + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function newRehearsal(date) {
    var last = P().rehearsals.slice().sort(byTime).pop() || {};
    T.prodDraft = { id: uid('r'), date: date, start: last.start || '15:30', end: last.end || '17:00', place: last.place || '', kind: 'rehearsal', scenes: [], songs: [], everyone: false, add: [], remove: [], notes: '' };
    T.go('#/teacher/production/r/new');
  }
  function addMany() {
    var d = T.dialog('<h2>Add many rehearsals</h2><p class="muted">The same days each week. You can pick the scenes for each one after.</p>' +
      '<div class="row"><label class="f grow">First day<input type="date" id="a1" value="' + today() + '"></label><label class="f grow">Last day<input type="date" id="a2"></label></div>' +
      '<p><b>Every</b></p><div class="row">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (n, i) { return '<label class="btn small"><input type="checkbox" value="' + i + '"' + (i === 1 || i === 3 ? ' checked' : '') + '> ' + n + '</label>'; }).join('') + '</div>' +
      '<div class="row"><label class="f grow">From<input type="time" id="a3" value="15:30"></label><label class="f grow">To<input type="time" id="a4" value="17:00"></label></div>' +
      '<label class="f">Where<input id="a5" placeholder="e.g. Auditorium"></label>' +
      '<label class="f">What kind<select id="a6">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label>' +
      '<label class="switch"><span>Call the whole cast</span><input type="checkbox" id="a7"></label>' +
      '<p class="err" id="am"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Add them</button></div>');
    d.querySelector('#cn').onclick = function () { d.close(); };
    d.querySelector('#ok').onclick = function () {
      var a = d.querySelector('#a1').value, b = d.querySelector('#a2').value, days = Array.from(d.querySelectorAll('input[type=checkbox][value]:checked')).map(function (x) { return +x.value; });
      var msg = d.querySelector('#am');
      if (!a || !b || b < a) { msg.textContent = 'Pick a first day and a last day after it.'; return; }
      if (!days.length) { msg.textContent = 'Pick at least one day of the week.'; return; }
      var out = [], cur = parse(a), end = parse(b);
      while (cur <= end && out.length < 200) {
        if (days.indexOf(cur.getDay()) >= 0) out.push({ id: uid('r'), date: ymd(cur), start: d.querySelector('#a3').value, end: d.querySelector('#a4').value, place: d.querySelector('#a5').value.trim(), kind: d.querySelector('#a6').value, scenes: [], songs: [], everyone: d.querySelector('#a7').checked, add: [], remove: [], notes: '' });
        cur.setDate(cur.getDate() + 1);
      }
      if (!out.length) { msg.textContent = 'None of those days fall between the two dates.'; return; }
      var have = P().rehearsals.map(function (r) { return r.date + r.start; });
      out = out.filter(function (r) { return have.indexOf(r.date + r.start) < 0; });
      P().rehearsals = P().rehearsals.concat(out);
      T.saveShow(out.length + ' rehearsals added').then(function () { d.close(); view = 'list'; overview(); });
    };
  }

  /* one rehearsal: when, what, who is called (with conflicts) */
  function rehearsalPage(id) {
    /* edit a copy; Save puts it in the show */
    var src = id === 'new' ? T.prodDraft : P().rehearsals.find(function (x) { return x.id === id; }); if (!src) return overview();
    var r = JSON.parse(JSON.stringify(src)), isNew = id === 'new';
    var put = function () {
      var p = P(), i = p.rehearsals.findIndex(function (x) { return x.id === r.id; });
      if (i >= 0) p.rehearsals[i] = r; else p.rehearsals.push(r);
      return T.saveShow('Rehearsal saved').then(function () { if (isNew) { isNew = false; history.replaceState(null, '', '#/teacher/production/r/' + r.id); } r = JSON.parse(JSON.stringify(r)); });
    };
    T.setBar(dayName(r.date, true), '#/teacher/production');
    var O = T.O();
    function draw() {
      var people = called(r), cf = conflictsFor(r), chars = calledChars(r);
      var notCalled = cast().filter(function (a) { return people.indexOf(a) < 0; });
      app.innerHTML = '<div class="card"><div class="row"><label class="f grow" style="margin:0">Day<input type="date" id="dt" value="' + r.date + '"></label><label class="f" style="margin:0">From<input type="time" id="st" value="' + (r.start || '') + '"></label><label class="f" style="margin:0">To<input type="time" id="en" value="' + (r.end || '') + '"></label></div>' +
        '<div class="row"><label class="f grow">Where<input id="pl" value="' + esc(r.place || '') + '" placeholder="e.g. Auditorium"></label><label class="f grow">What kind<select id="kd">' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === r.kind ? ' selected' : '') + '>' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label></div></div>' +
        '<div class="card"><h3>What we will work on</h3><label class="switch"><span>Call the whole cast</span><input type="checkbox" id="ev"' + (r.everyone ? ' checked' : '') + '></label>' +
        '<p class="muted small">Scenes</p><div class="row">' + O.scenes.map(function (s) { return '<button type="button" class="btn small" data-sc="' + s.id + '" aria-pressed="' + (r.scenes.indexOf(s.id) >= 0) + '" title="' + esc(s.place) + '">' + s.num + '</button>'; }).join('') + '</div>' +
        '<p class="muted small" style="margin-top:12px">Songs</p><div class="row">' + O.songs.map(function (s) { return '<button type="button" class="btn small" data-so="' + s.id + '" aria-pressed="' + (r.songs.indexOf(s.id) >= 0) + '">' + esc(s.title) + '</button>'; }).join('') + '</div></div>' +
        '<div class="card"><h3>Called (' + people.length + ')</h3>' + (cf.length ? '<div class="fb miss">' + cf.map(function (c) { var a = actor(c.actor); return esc(a ? a.name : '?') + ' can’t come ' + esc(c.start ? span(c) : '(all day)') + (c.why ? ': ' + esc(c.why) : ''); }).join('<br>') + '</div>' : '') +
        (people.length ? '<div class="choose">' + people.map(function (a) {
          var away = cf.some(function (c) { return c.actor === a.id; }), forChars = a.chars.filter(function (c) { return chars.indexOf(c) >= 0; });
          return '<div class="person" style="min-height:0' + (away ? ';border-color:var(--bad)' : '') + '">' + T.face(a, 56) + '<b>' + esc(a.name) + '</b><span>' + (forChars.length ? forChars.map(function (c) { return esc(T.charById(c).short); }).join(', ') : 'added by you') + (away ? ' · <b class="err">conflict</b>' : '') + '</span><button class="btn small quiet" data-rm="' + a.id + '">Not called</button></div>';
        }).join('') + '</div>' : '<p class="muted">Nobody yet. Pick scenes or songs, or add people.</p>') +
        (notCalled.length ? '<div class="row" style="margin-top:12px"><label class="f grow" style="margin:0">Also call<select id="ad"><option value="">Choose…</option>' + notCalled.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label></div>' : '') + '</div>' +
        '<div class="card"><label class="f" style="margin:0">Notes for the cast (they see these)<textarea id="nt" style="min-height:80px" placeholder="e.g. Bring your script and a pencil. Wear shoes you can dance in.">' + esc(r.notes || '') + '</textarea></label></div>' +
        '<div class="dock"><div class="in"><button class="btn quiet" id="del">Delete</button><a class="btn" href="#/teacher/production/attend/' + r.id + '" id="att">' + icon('check') + 'Attendance</a><button class="btn primary" data-save id="sv">Save</button></div></div>';
      var keep = function () {
        r.date = document.getElementById('dt').value || r.date; r.start = document.getElementById('st').value; r.end = document.getElementById('en').value;
        r.place = document.getElementById('pl').value.trim(); r.kind = document.getElementById('kd').value; r.notes = document.getElementById('nt').value.trim();
      };
      app.querySelectorAll('[data-sc],[data-so]').forEach(function (b) {
        b.onclick = function () { keep(); var list = b.dataset.sc ? r.scenes : r.songs, v = b.dataset.sc || b.dataset.so, i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); draw(); };
      });
      document.getElementById('ev').onchange = function (e) { keep(); r.everyone = e.target.checked; draw(); };
      app.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { keep(); var id = b.dataset.rm; r.add = (r.add || []).filter(function (x) { return x !== id; }); if (called(r).some(function (a) { return a.id === id; })) r.remove = (r.remove || []).concat([id]); draw(); }; });
      var ad = document.getElementById('ad'); if (ad) ad.onchange = function () { keep(); var id = ad.value; if (!id) return; r.remove = (r.remove || []).filter(function (x) { return x !== id; }); if (!called(r).some(function (a) { return a.id === id; })) r.add = (r.add || []).concat([id]); draw(); };
      document.getElementById('sv').onclick = function () {
        keep(); if (r.start && r.end && r.end <= r.start) { T.toast('The end time is before the start time.'); return; }
        put().then(function () { T.setBar(dayName(r.date, true), '#/teacher/production'); draw(); });
      };
      document.getElementById('att').onclick = function (e) { e.preventDefault(); keep(); put().then(function () { T.go('#/teacher/production/attend/' + r.id); }); };
      document.getElementById('del').onclick = function () {
        if (isNew) { T.go('#/teacher/production'); return; }
        if (!confirm('Delete the ' + kind(r.kind)[2].toLowerCase() + ' on ' + dayName(r.date) + '?')) return;
        var p = P(); p.rehearsals = p.rehearsals.filter(function (x) { return x.id !== r.id; }); delete p.attendance[r.id];
        T.saveShow('Deleted').then(function () { T.go('#/teacher/production'); });
      };
    }
    draw();
  }

  /* attendance: big buttons, one row per called actor; a conflict suggests Excused */
  function attendPage(id) {
    var r = P().rehearsals.find(function (x) { return x.id === id; }); if (!r) return overview();
    T.setBar('Attendance', '#/teacher/production/r/' + r.id);
    var at = Object.assign({}, P().attendance[r.id] || {}), cf = conflictsFor(r);
    var people = called(r).concat(cast().filter(function (a) { return at[a.id] && !called(r).some(function (x) { return x.id === a.id; }); }));
    cf.forEach(function (c) { if (!at[c.actor]) at[c.actor] = 'excused'; });
    function draw() {
      app.innerHTML = '<h2>' + sym(kind(r.kind)[1]) + esc(dayName(r.date)) + '</h2><p class="muted">' + esc(span(r)) + (r.place ? ' · ' + esc(r.place) : '') + ' · ' + esc(what(r)) + '</p>' +
        '<div class="row noprint" style="margin-bottom:12px"><button class="btn small" id="allhere">' + icon('check') + 'Everyone else is here</button></div>' +
        people.map(function (a) {
          var c = cf.find(function (x) { return x.actor === a.id; });
          return '<div class="card row" style="margin-bottom:10px">' + T.face(a, 48) + '<div class="grow"><b>' + esc(a.name) + '</b>' + (c ? '<br><span class="muted small">Conflict: ' + esc(c.why || span(c)) + '</span>' : '') + '</div>' +
            '<div class="seg" data-a="' + a.id + '">' + MARKS.map(function (m) { return '<button type="button" data-v="' + m[0] + '" aria-pressed="' + (at[a.id] === m[0]) + '">' + sym(m[1]) + m[2] + '</button>'; }).join('') + '</div></div>';
        }).join('') + (people.length ? '' : '<p>Nobody is called for this one.</p>') +
        '<div class="dock"><div class="in"><span class="muted" id="cnt"></span><button class="btn primary" data-save id="sv">Save attendance</button></div></div>';
      var n = people.filter(function (a) { return at[a.id] === 'here' || at[a.id] === 'late'; }).length;
      document.getElementById('cnt').textContent = n + ' of ' + people.length + ' here';
      app.querySelectorAll('.seg[data-a] button').forEach(function (b) { b.onclick = function () { var a = b.parentNode.dataset.a; at[a] = at[a] === b.dataset.v ? undefined : b.dataset.v; draw(); }; });
      document.getElementById('allhere').onclick = function () { people.forEach(function (a) { if (!at[a.id]) at[a.id] = 'here'; }); draw(); };
      document.getElementById('sv').onclick = function () {
        var clean = {}; Object.keys(at).forEach(function (k) { if (at[k]) clean[k] = at[k]; });
        P().attendance[r.id] = clean; T.saveShow('Attendance saved');
      };
    }
    draw();
  }

  /* the call board: one week, big and printable (or on the projector) */
  function callboard(from) {
    T.setBar('Call board', '#/teacher/production');
    var start = from ? parse(from) : new Date(); start.setDate(start.getDate() - start.getDay());
    var end = new Date(start); end.setDate(start.getDate() + 6);
    var a = ymd(start), b = ymd(end);
    var list = P().rehearsals.filter(function (r) { return r.date >= a && r.date <= b; }).sort(byTime);
    var prev = new Date(start); prev.setDate(start.getDate() - 7); var next = new Date(start); next.setDate(start.getDate() + 7);
    app.innerHTML = '<div class="row noprint" style="justify-content:center;margin-bottom:10px"><a class="round" href="#/teacher/production/callboard/' + ymd(prev) + '" aria-label="Last week">' + icon('prev') + '</a><b>Week of ' + esc(dayName(a, true)) + '</b><a class="round" href="#/teacher/production/callboard/' + ymd(next) + '" aria-label="Next week">' + icon('next') + '</a><button class="btn small" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<h2 class="center">' + esc(T.O().title) + ' · Call board</h2>' +
      (list.length ? list.map(function (r) {
        var people = called(r), away = conflictsFor(r).map(function (c) { return c.actor; });
        return '<div class="card"><h3>' + sym(kind(r.kind)[1]) + esc(dayName(r.date)) + ' · ' + esc(span(r)) + (r.place ? ' · ' + esc(r.place) : '') + '</h3><p><b>' + esc(kind(r.kind)[2]) + ':</b> ' + esc(what(r)) + '</p>' +
          '<p style="font-size:1.15em">' + (r.everyone ? '<b>Whole cast</b>' : people.map(function (x) { return esc(x.name) + (away.indexOf(x.id) >= 0 ? ' <span class="muted">(away)</span>' : ''); }).join(' · ') || '<span class="muted">Nobody called</span>') + '</p>' + (r.notes ? '<p class="muted">' + esc(r.notes) + '</p>' : '') + '</div>';
      }).join('') : '<p class="center muted">No rehearsals this week.</p>');
  }

  /* ---------- Students: My Rehearsals ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.rehearsals = function () {
    T.setBar('My Rehearsals', '#/home');
    var p = P(), me = T.me, now = today();
    if (!me.id) { app.innerHTML = '<div class="card"><p>Your teacher has not put you on the cast list yet, so the app cannot tell when you are called.</p></div>'; return; }
    var mine = p.rehearsals.filter(function (r) { return r.date >= now && called(r).some(function (a) { return a.id === me.id; }); }).sort(byTime);
    var sent = (T.ls('sentConflicts') || []).filter(function (s) { return s.actor === me.id && s.date >= now && !p.conflicts.some(function (c) { return c.actor === me.id && c.date === s.date && (c.start || '') === (s.start || ''); }); });
    var myCf = p.conflicts.filter(function (c) { return c.actor === me.id && c.date >= now; }).concat(sent.map(function (s) { return Object.assign({ pending: true }, s); })).sort(byTime);
    app.innerHTML = '<h2>' + sym('📅') + 'When I am called</h2>' +
      (mine.length ? mine.map(function (r, i) {
        var away = myCf.find(function (c) { return overlaps(c, r); });
        var links = r.scenes.map(function (id) { var s = T.sceneById(id); return s ? '<a class="btn small" href="#/lines/' + s.id + '">' + icon('lines') + 'Scene ' + s.num + '</a>' : ''; })
          .concat(r.songs.map(function (id) { var s = T.songById(id); return s ? '<a class="btn small" href="#/song/' + s.id + '">' + icon('songs') + esc(s.title) + '</a>' : ''; })).join('');
        return '<div class="card"' + (i === 0 ? ' style="border:3px solid ' + T.color(me.chars[0]) + '"' : '') + '>' + (i === 0 ? '<span class="tag">Next</span>' : '') +
          '<h3 style="margin-top:6px">' + sym(kind(r.kind)[1]) + esc(dayName(r.date)) + '</h3><p class="big" style="font-size:1.3em;margin:4px 0">' + esc(span(r)) + (r.place ? ' · ' + esc(r.place) : '') + '</p>' +
          '<p>' + esc(kind(r.kind)[2]) + ': ' + esc(what(r)) + '</p>' + (r.notes ? '<p class="card" style="background:var(--hi);margin:8px 0">' + sym('📌') + esc(r.notes) + '</p>' : '') +
          (links ? '<p class="muted small">Practice first:</p><div class="row">' + links + '</div>' : '') +
          '<div class="row" style="margin-top:10px">' + (away ? '<span class="tag">' + (away.pending ? 'Sent: you can’t come' : 'Your teacher knows you can’t come') + '</span>' : '<button class="btn small" data-cant="' + r.id + '">I can’t come</button>') + '</div></div>';
      }).join('') : '<div class="card"><p>You are not called for any rehearsals right now.</p></div>') +
      '<div class="card"><h3>' + sym('🙋') + 'Days I can’t come</h3>' + (myCf.length ? myCf.map(function (c) { return '<p>' + esc(dayName(c.date)) + ' · ' + esc(span(c)) + (c.why ? ' · ' + esc(c.why) : '') + (c.pending ? ' <span class="muted small">(sent)</span>' : '') + '</p>'; }).join('') : '<p class="muted">None.</p>') +
      '<button class="btn" id="other">Tell my teacher about a day I can’t come</button></div>';
    app.querySelectorAll('[data-cant]').forEach(function (b) { b.onclick = function () { var r = p.rehearsals.find(function (x) { return x.id === b.dataset.cant; }); cantCome({ date: r.date, start: r.start, end: r.end }); }; });
    document.getElementById('other').onclick = function () { cantCome({ date: now }); };
  };
  function cantCome(pre) {
    var box = document.createElement('dialog');
    box.innerHTML = '<h2>' + sym('🙋') + 'I can’t come</h2><label class="f">Day<input type="date" id="d" value="' + pre.date + '" min="' + today() + '"></label>' +
      '<label class="switch"><span>The whole day</span><input type="checkbox" id="all"' + (pre.start ? '' : ' checked') + '></label>' +
      '<div class="row" id="tm"' + (pre.start ? '' : ' hidden') + '><label class="f grow">From<input type="time" id="s" value="' + (pre.start || '') + '"></label><label class="f grow">To<input type="time" id="e" value="' + (pre.end || '') + '"></label></div>' +
      '<label class="f">Why (you can skip this)<input id="w" maxlength="200" placeholder="e.g. doctor, game, family"></label>' +
      '<p class="err" id="m"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Send to my teacher</button></div>';
    document.body.appendChild(box); box.showModal();
    var close = function () { box.close(); box.remove(); };
    box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    box.querySelector('#all').onchange = function (e) { box.querySelector('#tm').hidden = e.target.checked; };
    box.querySelector('#cn').onclick = close;
    box.querySelector('#ok').onclick = function () {
      var all = box.querySelector('#all').checked, n = { type: 'conflict', actor: T.me.id, date: box.querySelector('#d').value, start: all ? '' : box.querySelector('#s').value, end: all ? '' : box.querySelector('#e').value, why: box.querySelector('#w').value.trim() };
      if (!n.date) { box.querySelector('#m').textContent = 'Pick the day.'; return; }
      box.querySelector('#ok').disabled = true;
      Store.sendNote(T.key, n).then(function () {
        var s = T.ls('sentConflicts') || []; s.push({ actor: n.actor, date: n.date, start: n.start, end: n.end, why: n.why }); T.ls('sentConflicts', s.slice(-30));
        close(); T.toast('Sent! Your teacher will see it.'); T.route();
      }).catch(function (e) { box.querySelector('#ok').disabled = false; box.querySelector('#m').textContent = e.message || 'It did not send. Check the Wi-Fi, or tell your teacher.'; });
    };
  }
})();
