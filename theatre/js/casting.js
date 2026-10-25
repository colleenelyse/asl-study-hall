/* asl.cool/theatre Casting: audition sign-ups (from students' iPads), audition notes, callbacks, and the cast list, so a class that only gets its roster
   a week before school can start on day one (Colleen, 2026-10-21). Also "Plan the first two weeks": whole-cast warm-up days, then audition days.
   T.show.casting = { open, callbacksShown, posted (date the cast list went up),
     signups { actor: { roles [char ids, first choice first], any, excited (one thing they are really excited to do on stage: Colleen, to work talents in), vocal { song, part } (a short vocal selection they choose), lines|solo|dance: yes|maybe|notyet, how: class|video|buddy|aac, helps, pronouns, at } },
     notes { actor: { acting|singing|dance: 0-3, tags [], text, consider [char ids] } }, callbacks { char: [actor ids] }, draft { char: [actor ids] } }
   Students send sign-ups as encrypted notes (type 'audition'); Teacher mode › Casting takes them in. Nothing about gender is asked or used:
   any student can play any role. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var COMFORT = [['yes', 'Yes!'], ['maybe', 'Maybe'], ['notyet', 'Not yet']];
  var HOW = [['class', '🎭 In class'], ['video', '📹 Record a video'], ['buddy', '👯 With a buddy'], ['aac', '💬 With my talker or sign']];
  var EXCITED = ['A cartwheel', 'A cool dance move', 'Hit a big high note', 'Make people laugh', 'Tumbling or flips', 'Beatbox', 'Sign it in ASL', 'Play an instrument', 'A funny voice', 'A big dramatic moment'];
  var TAGS = ['Clear voice', 'Big energy', 'Funny', 'Strong singer', 'Moves well', 'Great listener', 'Leader', 'Brave', 'Needs a buddy', 'Loves backstage'];
  function C() {
    var c = T.show.casting = T.show.casting || {};
    c.signups = c.signups || {}; c.notes = c.notes || {}; c.callbacks = c.callbacks || {}; c.draft = c.draft || {};
    return c;
  }
  T.casting = C;
  function students() { return (T.show.cast || []).filter(function (a) { return a.name && !a.guest; }); }
  function actor(id) { return (T.show.cast || []).find(function (a) { return a.id === id; }); }
  /* roles a student can ask for: everyone but the Trench Crew (a peer job, not an audition role) */
  function roles() { return T.O().characters.filter(function (c) { return c.group !== 'helpers'; }); }
  var named = function (c) { return c.group !== 'ensemble' && c.group !== 'helpers'; };
  /* the audition side for a role: the scene where the character has the most lines (groups: their first song) */
  function side(charId) {
    var best = null, n = 0;
    T.O().scenes.forEach(function (s) {
      var src = T.scriptScene(s); if (!src) return;
      var k = src.items.filter(function (it) { return it.type === 'line' && T.labelChars(it.who).indexOf(charId) >= 0; }).length;
      if (k > n) { n = k; best = s; }
    });
    var inSong = function (named) { return T.O().songs.find(function (so) { var m = T.O().moments.find(function (x) { return x.song === so.id; }); return m && (named ? Array.isArray(m.on) && m.on.indexOf(charId) >= 0 : T.onFor(m, charId)); }); };
    var song = inSong(true) || inSong(false);      // a song the character is named in (not just the whole-cast numbers)
    return { scene: best, lines: n, song: song };
  }
  T.auditionSide = side;

  T.noteHandlers = T.noteHandlers || {};
  T.noteHandlers.audition = function (n) {
    if (!actor(n.actor) || !Array.isArray(n.roles)) return false;
    var ok = function (v) { return COMFORT.some(function (c) { return c[0] === v; }) ? v : 'maybe'; };
    C().signups[n.actor] = { roles: n.roles.filter(function (r) { return T.charById(r); }).slice(0, 6), any: !!n.any, lines: ok(n.lines), solo: ok(n.solo), dance: ok(n.dance),
      vocal: n.vocal && T.songById(n.vocal.song) ? { song: n.vocal.song, part: String(n.vocal.part || '').slice(0, 120) } : null,
      how: HOW.some(function (h) { return h[0] === n.how; }) ? n.how : 'class', excited: String(n.excited || '').slice(0, 150), helps: String(n.helps || '').slice(0, 300), pronouns: String(n.pronouns || '').slice(0, 30), at: n._at };
    return true;
  };

  /* ---------- Teacher: Casting ---------- */
  var tab = 'signups';
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.casting = function (args) {
    if (args[0] === 'student') return notesPage(args[1]);
    overview();
    (T.pullNotes ? T.pullNotes() : Promise.resolve(0)).then(function (n) { if (n) overview(); }).catch(function () {});
    if (T.loadConflictNotes) T.loadConflictNotes().then(function () { if (/^#\/teacher\/casting/.test(location.hash) && !document.querySelector('dialog[open]')) T.route(); });      // the families' words about each conflict
  };
  function overview() {
    T.setBar('Casting', '#/teacher');
    var c = C(), tabs = [['signups', 'Sign-ups'], ['notes', 'Audition notes'], ['callbacks', 'Callbacks'], ['cast', 'Cast list'], ['double', 'Doubling'], ['start', 'First two weeks']];
    var h = '<div class="row noprint" style="margin-bottom:14px"><div class="seg">' + tabs.map(function (t) { return '<button data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>';
    if (!students().length) h += '<p class="card">Paste your class list first (Teacher mode › Cast › Paste a class list).</p>';
    h += { signups: signupsView, notes: notesView, callbacks: callbacksView, cast: castView, start: startView, double: function () { return T.doublingView(); } }[tab]();
    app.innerHTML = h;
    app.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { tab = b.dataset.v; overview(); }; });
    ({ signups: wireSignups, callbacks: wireCallbacks, cast: wireCast, start: wireStart, notes: wireNotes }[tab] || function () {})();
    app.querySelectorAll('[data-stu]').forEach(function (el) { el.onclick = function () { T.go('#/teacher/casting/student/' + el.dataset.stu); }; });
  }
  /* show-week conflicts from families (portal.js; Colleen 2026-10-25: decide case by case, but "make it known to the team when casting") */
  var cf = function (a) { return T.conflictBadge ? T.conflictBadge(a.id) : ''; }, cfm = function (a) { return T.conflictMark ? T.conflictMark(a.id) : ''; };
  var cfWarn = function (id) { var a = actor(id), t = T.conflictText && T.conflictText(id); if (a && t) T.toast('⚠️ ' + a.name + ' has a show-week conflict: ' + t, 7000); };
  var chips = function (ids) { return ids.map(function (id) { return T.charById(id) ? T.chip(id) : ''; }).join(''); };
  var comfortTxt = function (s) { var w = { yes: 'yes', maybe: 'maybe', notyet: 'not yet' }; return 'Lines: ' + w[s.lines] + ' · Solo singing: ' + w[s.solo] + ' · Dancing: ' + w[s.dance]; };

  function signupsView() {
    var c = C(), list = students(), done = list.filter(function (a) { return c.signups[a.id]; }), not = list.filter(function (a) { return !c.signups[a.id]; });
    return '<div class="card row"><label class="switch grow" style="border:0"><span><b>Auditions are open</b><br><span class="muted small">' + (c.open ? 'Company members see Auditions in the app and can sign up.' : 'Company members cannot sign up yet.') + '</span></span><input type="checkbox" id="open"' + (c.open ? ' checked' : '') + '></label></div>' +
      '<h3>' + done.length + ' of ' + list.length + ' signed up</h3>' +
      (done.some(function (a) { return c.signups[a.id].excited; }) ? '<div class="card"><h3>' + sym('✨') + 'Talents to use</h3><p class="muted small">What each Company member is excited to do on stage. Work them into the choreography and staging; they also show on the Dance groups in Production.</p>' +
        done.filter(function (a) { return c.signups[a.id].excited; }).map(function (a) { return '<p><b>' + esc(a.name) + ':</b> ' + esc(c.signups[a.id].excited) + '</p>'; }).join('') + '</div>' : '') +
      done.map(function (a) {
        var s = c.signups[a.id];
        return '<div class="card" style="cursor:pointer" data-stu="' + a.id + '"><div class="row">' + T.face(a, 44) + '<div class="grow"><b>' + esc(a.name) + '</b>' + (s.pronouns ? ' <span class="muted small">(' + esc(s.pronouns) + ')</span>' : '') + cf(a) +
          '<br>' + chips(s.roles) + (s.any ? '<span class="tag">Any role is OK</span>' : '') + '</div></div>' +
          (s.excited ? '<p class="small">' + sym('✨') + 'Excited to: <b>' + esc(s.excited) + '</b></p>' : '') +
          (s.vocal && T.songById(s.vocal.song) ? '<p class="small">' + sym('🎤') + 'Vocal selection: <b>' + esc(T.songById(s.vocal.song).title) + '</b>' + (s.vocal.part ? ', ' + esc(s.vocal.part) : '') + '</p>' : '') +
          '<p class="muted small">' + comfortTxt(s) + ' · Audition: ' + esc((HOW.find(function (h) { return h[0] === s.how; }) || HOW[0])[1]) + '</p>' + (s.helps ? '<p class="small">' + sym('💛') + esc(s.helps) + '</p>' : '') + '</div>';
      }).join('') +
      (not.length ? '<details><summary class="btn quiet">Not signed up yet (' + not.length + ')</summary><p>' + not.map(function (a) { return '<button class="btn small" data-stu="' + a.id + '">' + esc(a.name) + '</button>'; }).join(' ') + '</p><p class="muted small">Tap a name to sign them up yourself.</p></details>' : '');
  }
  function wireNotes() {
    var c = C(), t = null;
    document.getElementById('qv').onclick = function () { quick = !quick; overview(); };
    app.querySelectorAll('[data-q] button').forEach(function (b) {
      b.onclick = function () {
        var x = b.parentNode.dataset.q.split('|'), n = c.notes[x[0]] = c.notes[x[0]] || { acting: 0, singing: 0, dance: 0, tags: [], text: '', consider: [] }, v = +b.dataset.v;
        n[x[1]] = n[x[1]] === v ? 0 : v;
        b.parentNode.querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', +y.dataset.v === n[x[1]]); });
        clearTimeout(t); t = setTimeout(function () { T.saveShow('Notes saved'); }, 1500);
      };
    });
  }
  function wireSignups() {
    document.getElementById('open').onchange = function (e) { C().open = e.target.checked; T.saveShow(e.target.checked ? 'Auditions are open' : 'Auditions are closed').then(overview); };
  }

  /* quick notes while the whole cast learns a number (the week-1 audition): one row each, tap the stars, saved as you go */
  var quick = false;
  function quickView() {
    var c = C();
    var seg = function (a, k) { var n = c.notes[a.id] || {}; return '<div class="seg" data-q="' + a.id + '|' + k + '">' + [1, 2, 3].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (n[k] === v) + '">' + '★'.repeat(v) + '</button>'; }).join('') + '</div>'; };
    return '<p class="muted">Tap stars while they learn the number; it saves as you go. Scores are only for you.</p><table class="tbl"><thead><tr><th>Company member</th><th>🎵 Singing</th><th>💃 Dance</th><th>🗣️ Acting / energy</th></tr></thead><tbody>' +
      students().map(function (a) { return '<tr><td>' + T.face(a, 32) + ' ' + esc(a.name) + cfm(a) + '</td><td>' + seg(a, 'singing') + '</td><td>' + seg(a, 'dance') + '</td><td>' + seg(a, 'acting') + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function notesView() {
    var c = C();
    if (quick) return '<div class="row" style="margin-bottom:10px"><button class="btn small" id="qv">Back to Company members</button></div>' + quickView();
    return '<div class="row" style="margin-bottom:10px"><button class="btn primary" id="qv">Quick notes during a group number</button></div><p class="muted">Or tap a Company member to write notes while they audition. Scores are 1 to 3 and are only for you.</p><div class="choose">' + students().map(function (a) {
      var n = c.notes[a.id], s = c.signups[a.id];
      return '<button class="person" data-stu="' + a.id + '" style="min-height:0">' + T.face(a, 56) + '<b>' + esc(a.name) + '</b><span>' +
        (n ? '🗣️' + (n.acting || '–') + ' 🎵' + (n.singing || '–') + ' 💃' + (n.dance || '–') : 'No notes yet') + (s ? '' : ' · not signed up') + (cfm(a) ? ' · ⚠️ show-week conflict' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  /* one student: their sign-up (editable, for students who could not do it themselves) and the teacher's notes */
  function notesPage(id) {
    var a = actor(id); if (!a) return overview();
    T.setBar(a.name, '#/teacher/casting');
    var c = C(), s = JSON.parse(JSON.stringify(c.signups[id] || { roles: [], any: true, lines: 'maybe', solo: 'maybe', dance: 'maybe', how: 'class', helps: '', pronouns: '' }));
    var n = JSON.parse(JSON.stringify(c.notes[id] || { acting: 0, singing: 0, dance: 0, tags: [], text: '', consider: [] }));
    function draw() {
      var stars = function (k, label) { return '<div class="switch"><span>' + label + '</span><div class="seg" data-score="' + k + '">' + [1, 2, 3].map(function (v) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (n[k] === v) + '">' + '★'.repeat(v) + '</button>'; }).join('') + '</div></div>'; };
      app.innerHTML = '<div class="card"><div class="row">' + T.face(a, 64) + '<div class="grow"><h2 style="margin:0">' + esc(a.name) + '</h2>' + (s.pronouns ? '<span class="muted">' + esc(s.pronouns) + '</span>' : '') + '<div>' + cf(a) + '</div></div></div>' +
        '<p><b>Wants:</b> ' + (s.roles.length ? chips(s.roles) : '<span class="muted">no roles picked</span>') + (s.any ? ' <span class="tag">Any role is OK</span>' : '') + '</p>' +
        (s.excited ? '<p>' + sym('✨') + 'Excited to: <b>' + esc(s.excited) + '</b></p>' : '') +
        (s.vocal && T.songById(s.vocal.song) ? '<p>' + sym('🎤') + 'Vocal selection: <b>' + esc(T.songById(s.vocal.song).title) + '</b>' + (s.vocal.part ? ', ' + esc(s.vocal.part) : '') + '</p>' : '') +
        '<p class="muted small">' + comfortTxt(s) + '</p>' + (s.helps ? '<p>' + sym('💛') + esc(s.helps) + '</p>' : '') +
        '<details><summary class="btn quiet small">Change their sign-up</summary>' + signupForm(s, 't') + '</details></div>' +
        '<div class="card"><h3>Audition notes</h3>' + stars('acting', '🗣️ Acting') + stars('singing', '🎵 Singing') + stars('dance', '💃 Dance') +
        '<p class="muted small" style="margin-top:10px">Quick notes</p><div class="row">' + TAGS.map(function (t) { return '<button type="button" class="btn small" data-tag="' + esc(t) + '" aria-pressed="' + (n.tags.indexOf(t) >= 0) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
        '<label class="f">Notes<textarea id="tx" style="min-height:90px">' + esc(n.text) + '</textarea></label>' +
        '<p class="muted small">Think about them for</p><div class="row">' + roles().map(function (ch) { return '<button type="button" class="btn small" data-con="' + ch.id + '" aria-pressed="' + (n.consider.indexOf(ch.id) >= 0) + '">' + esc(ch.short) + '</button>'; }).join('') + '</div></div>' +
        '<div class="dock"><div class="in"><button class="btn primary" data-save id="sv">Save</button></div></div>';
      wireForm(s, 't', draw);
      app.querySelectorAll('[data-score] button').forEach(function (b) { b.onclick = function () { keep(); var k = b.parentNode.dataset.score, v = +b.dataset.v; n[k] = n[k] === v ? 0 : v; draw(); }; });
      app.querySelectorAll('[data-tag]').forEach(function (b) { b.onclick = function () { keep(); var t = b.dataset.tag, i = n.tags.indexOf(t); if (i >= 0) n.tags.splice(i, 1); else n.tags.push(t); draw(); }; });
      app.querySelectorAll('[data-con]').forEach(function (b) { b.onclick = function () { keep(); var t = b.dataset.con, i = n.consider.indexOf(t); if (i >= 0) n.consider.splice(i, 1); else n.consider.push(t); draw(); }; });
      document.getElementById('sv').onclick = function () {
        keep(); readForm(s, 't');
        c.notes[id] = n; if (s.roles.length || s.any || c.signups[id]) c.signups[id] = s;
        T.saveShow('Saved');
      };
    }
    var keep = function () { n.text = document.getElementById('tx').value; };
    draw();
  }

  /* the sign-up form, shared by students (prefix 's') and the teacher's page (prefix 't') */
  function signupForm(s, p) {
    var seg = function (k, label) { return '<div class="switch"><span>' + label + '</span><div class="seg" data-' + p + 'c="' + k + '">' + COMFORT.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (s[k] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; };
    return '<p><b>Roles</b> <span class="muted small">(tap up to 6; the first one you tap is your first choice)</span></p>' +
      T.O().groups.filter(function (g) { return g.id !== 'helpers'; }).map(function (g) {
        var list = roles().filter(function (c) { return c.group === g.id; }); if (!list.length) return '';
        return '<p class="muted small" style="margin:10px 0 4px">' + esc(g.name) + '</p><div class="row">' + list.map(function (c) {
          var i = s.roles.indexOf(c.id);
          return '<button type="button" class="btn small" data-' + p + 'role="' + c.id + '" aria-pressed="' + (i >= 0) + '" title="' + esc(c.desc) + '">' + (i >= 0 ? (i + 1) + '. ' : '') + esc(c.short) + '</button>';
        }).join('') + '</div>';
      }).join('') +
      '<label class="switch" style="margin-top:10px"><span><b>Any role is OK with me</b></span><input type="checkbox" id="' + p + 'any"' + (s.any ? ' checked' : '') + '></label>' +
      seg('lines', '🗣️ Speaking lines') + seg('solo', '🎤 Singing by myself') + seg('dance', '💃 Dancing') +
      '<div class="switch"><span>How I want to audition</span><div class="seg" data-' + p + 'how>' + HOW.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (s.how === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<p style="margin-top:12px"><b>' + sym('🎤') + 'My vocal selection</b> <span class="muted small">(about 30 seconds of any song from the show. You can also sing it with a buddy, or show it with sign.)</span></p>' +
      '<div class="row"><label class="f grow" style="margin:0">Song<select id="' + p + 'vs"><option value="">Choose…</option>' + T.O().songs.map(function (so) { return '<option value="' + so.id + '"' + (s.vocal && s.vocal.song === so.id ? ' selected' : '') + '>' + esc(so.title) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f grow" style="margin:0">Which part<input id="' + p + 'vp" maxlength="120" value="' + esc(s.vocal ? s.vocal.part : '') + '" placeholder="e.g. the first verse"></label></div>' +
      (s.vocal && s.vocal.song ? '<p><a class="btn small" href="#/song/' + s.vocal.song + '">' + icon('songs') + 'Practice it</a></p>' : '') +
      '<label class="f">' + sym('✨') + 'One thing I am really excited to do on stage<input id="' + p + 'exc" maxlength="150" value="' + esc(s.excited || '') + '" placeholder="Anything! A cartwheel, a joke, a high note…"></label>' +
      '<div class="row" style="margin-top:-4px">' + EXCITED.map(function (x) { return '<button type="button" class="btn small quiet" data-' + p + 'exc="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<label class="f">Things that help me (you can skip this)<input id="' + p + 'helps" maxlength="300" value="' + esc(s.helps) + '" placeholder="e.g. going first, a quiet room, my headphones, seeing the words"></label>' +
      '<label class="f">My pronouns (you can skip this)<input id="' + p + 'pro" maxlength="30" value="' + esc(s.pronouns) + '"></label>';
  }
  function readForm(s, p) {
    var any = document.getElementById(p + 'any'); if (!any) return;
    s.any = any.checked; s.excited = document.getElementById(p + 'exc').value.trim(); s.helps = document.getElementById(p + 'helps').value.trim(); s.pronouns = document.getElementById(p + 'pro').value.trim();
    var vs = document.getElementById(p + 'vs').value; s.vocal = vs ? { song: vs, part: document.getElementById(p + 'vp').value.trim() } : null;
  }
  function wireForm(s, p, redraw) {
    var keepForm = function () { readForm(s, p); };
    var reopen = function () { var dt = app.querySelector('details'); var o = dt && dt.open; redraw(); if (o) { var d2 = app.querySelector('details'); if (d2) d2.open = true; } };
    app.querySelectorAll('[data-' + p + 'role]').forEach(function (b) { b.onclick = function () { keepForm(); var r = b.getAttribute('data-' + p + 'role'), i = s.roles.indexOf(r); if (i >= 0) s.roles.splice(i, 1); else if (s.roles.length < 6) s.roles.push(r); reopen(); }; });
    app.querySelectorAll('[data-' + p + 'c] button').forEach(function (b) { b.onclick = function () { keepForm(); s[b.parentNode.getAttribute('data-' + p + 'c')] = b.dataset.v; reopen(); }; });
    var vsel = document.getElementById(p + 'vs'); if (vsel) vsel.onchange = function () { keepForm(); reopen(); };
    app.querySelectorAll('[data-' + p + 'exc]').forEach(function (b) { b.onclick = function () { var inp = document.getElementById(p + 'exc'); inp.value = b.getAttribute('data-' + p + 'exc'); }; });
    app.querySelectorAll('[data-' + p + 'how] button').forEach(function (b) { b.onclick = function () { keepForm(); s.how = b.dataset.v; reopen(); }; });
  }

  function callbacksView() {
    var c = C(), list = roles().filter(named);
    return '<div class="card row"><label class="switch grow" style="border:0"><span><b>Show callbacks to Company members</b><br><span class="muted small">Company members called back see which roles and what to practice.</span></span><input type="checkbox" id="cbs"' + (c.callbacksShown ? ' checked' : '') + '></label><button class="btn small" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<p class="muted">★ wanted this role · ✓ in your “think about them for”.</p>' +
      list.map(function (ch) {
        var cb = c.callbacks[ch.id] || [], sd = side(ch.id);
        var want = students().filter(function (a) { var s = c.signups[a.id], n = c.notes[a.id]; return (s && s.roles.indexOf(ch.id) >= 0) || (n && n.consider.indexOf(ch.id) >= 0); });
        var others = students().filter(function (a) { return cb.indexOf(a.id) < 0; });
        var mark = function (a) { var s = c.signups[a.id], n = c.notes[a.id]; return (s && s.roles.indexOf(ch.id) >= 0 ? '★' : '') + (n && n.consider.indexOf(ch.id) >= 0 ? '✓' : ''); };
        return '<div class="card"><div class="row"><h3 class="grow">' + T.chip(ch.id) + '</h3><span class="muted small">' + (sd.scene ? 'Side: Scene ' + sd.scene.num : '') + (sd.song ? ' · Song: ' + esc(sd.song.title) : '') + '</span></div>' +
          '<div class="row">' + cb.map(function (id) { var a = actor(id); return a ? '<button class="btn small" aria-pressed="true" data-cbrm="' + ch.id + '|' + id + '">' + esc(a.name) + ' ' + mark(a) + cfm(a) + ' ✕</button>' : ''; }).join('') + '</div>' +
          (want.filter(function (a) { return cb.indexOf(a.id) < 0; }).length ? '<p class="muted small">Suggested: ' + want.filter(function (a) { return cb.indexOf(a.id) < 0; }).map(function (a) { return '<button class="btn small quiet" data-cbadd="' + ch.id + '|' + a.id + '">+ ' + esc(a.name) + ' ' + mark(a) + cfm(a) + '</button>'; }).join('') + '</p>' : '') +
          '<label class="f" style="margin:6px 0 0">Add<select data-cbsel="' + ch.id + '"><option value="">Choose…</option>' + others.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + ' ' + mark(a) + cfm(a) + '</option>'; }).join('') + '</select></label></div>';
      }).join('');
  }
  function wireCallbacks() {
    var c = C();
    var add = function (ch, id) { var l = c.callbacks[ch] = c.callbacks[ch] || []; if (l.indexOf(id) < 0) l.push(id); cfWarn(id); T.saveShow('Callback added').then(overview); };
    document.getElementById('cbs').onchange = function (e) { c.callbacksShown = e.target.checked; T.saveShow(e.target.checked ? 'Company members can see callbacks' : 'Callbacks hidden').then(overview); };
    app.querySelectorAll('[data-cbadd]').forEach(function (b) { b.onclick = function () { var x = b.dataset.cbadd.split('|'); add(x[0], x[1]); }; });
    app.querySelectorAll('[data-cbsel]').forEach(function (sel) { sel.onchange = function () { if (sel.value) add(sel.dataset.cbsel, sel.value); }; });
    app.querySelectorAll('[data-cbrm]').forEach(function (b) { b.onclick = function () { var x = b.dataset.cbrm.split('|'); c.callbacks[x[0]] = (c.callbacks[x[0]] || []).filter(function (i) { return i !== x[1]; }); T.saveShow('Removed').then(overview); }; });
  }

  /* the cast list: a draft until it is posted; posting gives every student their roles */
  function castView() {
    var c = C(), d = c.draft, list = students();
    if (!Object.keys(d).length) list.forEach(function (a) { (a.chars || []).forEach(function (ch) { (d[ch] = d[ch] || []).push(a.id); }); });      // start from the roles students already have
    var roleOf = function (a) { return Object.keys(d).filter(function (ch) { return d[ch].indexOf(a.id) >= 0; }); };
    var none = list.filter(function (a) { return !roleOf(a).length; });
    return (T.conflictSummary ? T.conflictSummary() : '') + '<div class="card"><p>' + (c.posted ? sym('✅') + 'Posted ' + new Date(c.posted).toLocaleDateString() + '. Changes here go to Company members when you post again.' : 'This is a draft. Company members see it only when you post it.') + '</p>' +
      '<div class="row"><button class="btn" id="auto">Fill in a draft for me</button><button class="btn" id="ens">Put everyone without a role in the ensemble</button><span class="grow"></span><button class="btn primary" id="post" data-save>Post the cast list</button></div>' +
      (none.length ? '<p class="err" style="margin-top:10px">' + none.length + ' student' + (none.length === 1 ? '' : 's') + ' without a role: ' + none.map(function (a) { return esc(a.name); }).join(', ') + '</p>' : '<p style="margin-top:10px">' + sym('🎉') + '<b>Everyone has a role.</b></p>') + '</div>' +
      T.O().groups.map(function (g) {
        var chs = T.O().characters.filter(function (ch) { return ch.group === g.id; }); if (!chs.length) return '';
        return '<h3 style="margin-top:18px">' + esc(g.name) + '</h3>' + chs.map(function (ch) {
          var who = d[ch.id] || [];
          return '<div class="switch" style="flex-wrap:wrap"><span style="min-width:140px">' + T.chip(ch.id) + '</span><span class="grow">' + who.map(function (id) { var a = actor(id); return a ? '<button class="btn small" aria-pressed="true" data-rm="' + ch.id + '|' + id + '">' + esc(a.name) + cfm(a) + ' ✕</button>' : ''; }).join(' ') + '</span>' +
            '<select data-add="' + ch.id + '"><option value="">+ Add…</option>' + list.filter(function (a) { return who.indexOf(a.id) < 0; }).map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + (roleOf(a).length ? '' : ' (no role yet)') + cfm(a) + '</option>'; }).join('') + '</select></div>';
        }).join('');
      }).join('');
  }
  function wireCast() {
    var c = C(), d = c.draft, list = students();
    var redraw = function () { T.saveShow('Draft saved').then(overview); };
    app.querySelectorAll('[data-add]').forEach(function (sel) { sel.onchange = function () { if (!sel.value) return; (d[sel.dataset.add] = d[sel.dataset.add] || []).push(sel.value); cfWarn(sel.value); redraw(); }; });
    app.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { var x = b.dataset.rm.split('|'); d[x[0]] = (d[x[0]] || []).filter(function (i) { return i !== x[1]; }); if (!d[x[0]].length) delete d[x[0]]; redraw(); }; });
    var has = function (a) { return Object.keys(d).some(function (ch) { return d[ch].indexOf(a.id) >= 0; }); };
    /* a starting point, never the final word: named roles go to callbacks first, then first choices, highest notes first; one named role each */
    document.getElementById('auto').onclick = function () {
      if (Object.keys(d).length && !confirm('Fill in the empty roles? Roles you already filled stay.')) return;
      var score = function (a) { var n = c.notes[a.id] || {}; return (n.acting || 0) + (n.singing || 0) + (n.dance || 0); };
      var namedTaken = function (a) { return Object.keys(d).some(function (ch) { var x = T.charById(ch); return x && named(x) && d[ch].indexOf(a.id) >= 0; }); };
      roles().filter(named).forEach(function (ch) {
        if (d[ch.id] && d[ch.id].length) return;
        var pool = (c.callbacks[ch.id] || []).map(actor).filter(Boolean);
        if (!pool.length) pool = list.filter(function (a) { var s = c.signups[a.id]; return s && s.roles.indexOf(ch.id) >= 0; });
        pool = pool.filter(function (a) { return !namedTaken(a); }).sort(function (x, y) {
          var px = (c.signups[x.id] || { roles: [] }).roles.indexOf(ch.id), py = (c.signups[y.id] || { roles: [] }).roles.indexOf(ch.id);
          return (px < 0 ? 9 : px) - (py < 0 ? 9 : py) || score(y) - score(x);
        });
        if (pool[0]) d[ch.id] = [pool[0].id];
      });
      fillEnsemble(); redraw();
    };
    document.getElementById('ens').onclick = function () { fillEnsemble(); redraw(); };
    /* everyone without a role joins an ensemble group: one they asked for, else the smallest group */
    function fillEnsemble() {
      var ens = T.O().characters.filter(function (ch) { return ch.group === 'ensemble'; });
      list.forEach(function (a) {
        if (has(a)) return;
        var s = c.signups[a.id], want = s && s.roles.map(T.charById).find(function (ch) { return ch && ch.group === 'ensemble'; });
        var pick = want || ens.slice().sort(function (x, y) { return (d[x.id] || []).length - (d[y.id] || []).length; })[0];
        if (pick) (d[pick.id] = d[pick.id] || []).push(a.id);
      });
    }
    document.getElementById('post').onclick = function () {
      var none = list.filter(function (a) { return !has(a); });
      if (none.length && !confirm(none.length + ' Company member(s) still have no role. Post anyway?')) return;
      if (!confirm('Post the cast list? Every Company member’s roles will be set from this list, and they will see it in the app.')) return;
      list.forEach(function (a) { a.chars = Object.keys(d).filter(function (ch) { return d[ch].indexOf(a.id) >= 0; }); });
      c.posted = new Date().toISOString(); c.open = false;
      T.saveShow('The cast list is posted!').then(overview);
    };
  }

  /* ---------- the first two weeks, before anyone has a role ----------
     Week 1 builds the company: whole-cast vocals and dance on the big numbers everyone will be in, a read-through, crew tours.
     Week 2 is auditions: prep, auditions in class (or by video, or with a buddy), callbacks. A predictable routine and a preview of what is coming
     (priming) make the first days easier for everyone. Every day stays editable in Production. */
  function startView() {
    var P = T.production(), first = P.term.first;
    if (!first) return '<p class="card">Set the first and last day of class first (Production › Calendar & crew).</p>';
    var days = starter(), has = days.filter(function (x) { return P.days[x.date]; }).length;
    return '<div class="card"><h3>Plan the first two weeks</h3><p class="muted">Week 1 teaches the numbers everyone is in, starting with the finale, and that is the audition: you watch and take notes while they learn (Audition notes › Quick notes). Week 2 adds a short vocal selection each Company member chooses (half the class each day), then callbacks. Every day stays editable in Production.</p>' +
      days.map(function (x) { return '<p><b>' + esc(T.prodDay(x.date)) + ':</b> ' + esc(x.label) + '</p>'; }).join('') +
      (has ? '<p class="err">' + has + ' of these days already have a plan; those stay as they are.</p>' : '') +
      '<div class="row end"><button class="btn primary" id="plan" data-save>Plan these days</button></div></div>';
  }
  var SONG = function (n) { var s = T.O().songs.find(function (x) { return x.num === n; }); return s ? s.id : null; };
  function starter(movie) {
    var P = T.production(), out = [], d = P.term.first; movie = Math.max(0, movie === undefined ? (P.movieDays === undefined ? 3 : P.movieDays) : movie || 0);
    var classDays = []; for (var i = 0; classDays.length < 10 + movie && i < 60; i++) { var s = addDays(d, i), w = parseD(s).getDay(); if (s <= P.term.last && w > 0 && w < 6 && P.term.off.indexOf(s) < 0) classDays.push(s); }
    var g = function (focus, songs, where) { return { id: 'g' + Math.random().toString(36).slice(2, 8), focus: focus, scenes: [], songs: songs.filter(Boolean), everyone: true, where: where || '', only: '' }; };
    /* Colleen: teach the whole-cast numbers in week 1 and use that as the audition (time spent learning what everyone needs for the show anyway),
       starting with the finale, plus a short vocal selection each student chooses. */
    var both = function (n, where) { return [g('vocals', [SONG(n)], where), g('dance', [SONG(n)])]; };
    var plan = [
      ['Welcome! Learn the finale: “Megamix (Bows)” (vocals)', [g('vocals', [SONG('41')])], 'Welcome to the company! We start with the finale, because everyone is in it. This week’s songs are your audition: just learn with us and have fun.'],
      ['Finale dance: “Megamix (Bows)”', [g('dance', [SONG('41')])], 'Wear shoes you can move in. Watching your teacher, or a buddy, is a great way to learn the moves.'],
      ['“We’re All in This Together” (vocals)', [g('vocals', [SONG('40')])], 'Another song the whole cast sings.'],
      ['“Wildcat Cheer” (dance and cheer)', [g('dance', [SONG('1')])], 'The opening number! Loud, proud, and together.'],
      ['Run all three songs, then crew tours', [g('run', [SONG('41'), SONG('40'), SONG('1')])], 'We run the songs we learned, then visit each crew (set, costumes, props).'],
      ['Pick your vocal selection, and finale review', [g('vocals', [SONG('41')])], 'Open Auditions in the app: pick your roles and about 30 seconds of any song from the show. Practice it with My Songs (the loop button helps).'],
      ['Vocal selections (half the class) · finale dance for everyone else', [g('vocals', [], 'your vocal selection, one at a time with the teacher'), g('dance', [SONG('41')])], 'Vocal selections today for half of us. Every audition is a good audition!', 'A'],
      ['Vocal selections (the other half) · finale dance for everyone else', [g('vocals', [], 'your vocal selection, one at a time with the teacher'), g('dance', [SONG('41')])], 'Vocal selections today for the other half. Take a deep breath: you have got this!', 'B'],
      ['Callbacks (reading scenes) · everyone else: “We’re All in This Together”', [Object.assign(g('acting', [], 'Stage'), { everyone: false, callbacks: true }), g('vocals', [SONG('40')])], 'Callbacks are in the app. Not called back? That is OK: everyone gets a role.'],
      ['Run the whole-cast numbers · the cast list goes up!', [g('run', [SONG('41'), SONG('40'), SONG('1')])], 'Great work this week! Look for the cast list in the app after class.']
    ];
    /* Colleen: watch the movie early, after the title is announced (day one) and before rehearsals begin in earnest */
    for (var mv = movie; mv > 0; mv--) plan.splice(1, 0, ['Watch the movie (part ' + mv + ' of ' + movie + ')', [g('watch', [], 'Everyone together')], 'We watch the movie together! Notice how each character changes, and listen for your favorite song.']);
    classDays.forEach(function (s, i) { var p = plan[i]; if (p) out.push({ date: s, label: p[0], groups: p[1], notes: p[2], half: p[3] }); });
    return out;
  }
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function parseD(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function addDays(s, n) { var x = parseD(s); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function wireStart() {
    var b = document.getElementById('plan'); if (!b) return;
    b.onclick = function () { var n = T.applyStarter(); T.saveShow(n + ' days planned; week 1 is shown to students').then(overview); };
  }
  /* the two audition weeks into the plan (empty days only); works before the class list: halves and crew tours are worked out each day */
  T.applyStarter = function (movie) {
    var P = T.production(), n = 0, firstMon = null;
    starter(movie).forEach(function (x, i) {
      if (P.days[x.date]) return;
      if (x.half) { x.groups[0].everyone = false; x.groups[0].half = x.half; x.groups[1].everyone = true; }      // vocal selections: half the class each day
      if (!x.groups.length) x.groups = [{ id: 'g' + Math.random().toString(36).slice(2, 8), focus: 'crew', scenes: [], songs: [], everyone: true, where: 'Crew tours: set, costumes, props', only: '' }];
      P.days[x.date] = { groups: x.groups, assign: {}, tasks: {}, notes: x.notes }; n++;
      if (i === 0) firstMon = x.date;
    });
    if (firstMon) { var d0 = parseD(firstMon), w = d0.getDay(); d0.setDate(d0.getDate() - (w === 0 ? 6 : w - 1)); var mon = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate()); if (P.shown.indexOf(mon) < 0) P.shown.push(mon); }
    return n;
  };
  T.starterDays = function (movie) { return starter(movie).length; };

  /* ---------- Students: Auditions ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.auditions = function () {
    T.setBar('Auditions', '#/home');
    var c = C(), me = T.me && actor(T.me.id);
    if (c.posted) {
      var mine = me ? me.chars : [];
      app.innerHTML = '<div class="card center"><h2>' + sym('🎉') + 'The cast list is up!</h2>' + (mine.length ? '<p style="font-size:1.3em">You are: ' + chips(mine) + '</p><p>Congratulations! Look at My Schedule to see when you are on stage.</p>' : '<p>Ask your teacher about your role.</p>') + '</div>' +
        '<div class="card"><h3>The whole cast</h3>' + T.O().characters.map(function (ch) { var who = students().filter(function (a) { return a.chars.indexOf(ch.id) >= 0; }); return who.length ? '<p>' + T.chip(ch.id) + ' ' + who.map(function (a) { return esc(a.name); }).join(', ') + '</p>' : ''; }).join('') + '</div>';
      return;
    }
    if (!me) { app.innerHTML = '<div class="card"><p>Your name is not on the class list yet. Tell your teacher.</p></div>'; return; }
    var h = '';
    if (c.callbacksShown) {
      var mineCb = Object.keys(c.callbacks).filter(function (ch) { return c.callbacks[ch].indexOf(me.id) >= 0; });
      h += '<div class="card"><h3>' + sym('📣') + 'Callbacks</h3>' + (mineCb.length ? '<p>You have a callback for: ' + chips(mineCb) + '</p>' + mineCb.map(sideCard).join('') : '<p>You do not have a callback, and that is OK! Everyone gets a role in this show.</p>') + '</div>';
    }
    if (c.open) {
      var sent = T.ls('audition:' + me.id), s = sent || { roles: [], any: true, lines: 'maybe', solo: 'maybe', dance: 'maybe', how: 'class', helps: '', pronouns: '' };
      if (c.signups[me.id] && !sent) s = JSON.parse(JSON.stringify(c.signups[me.id]));
      h += '<div class="card"><h2>' + sym('🎭') + 'Sign up for auditions</h2><p class="muted">Every Company member gets a role. Tap a role to read about it; pick the ones you would love to play.</p>' + signupForm(s, 's') +
        '<p class="err" id="m"></p><div class="row end"><button class="btn primary" id="send">' + (sent || c.signups[me.id] ? 'Send my changes' : 'Send my sign-up') + '</button></div></div>';
      if (s.roles.length) h += '<div class="card"><h3>' + sym('📄') + 'Practice for your audition</h3>' + s.roles.map(sideCard).join('') + '</div>';
      app.innerHTML = h;
      var redraw = function () { T.ls('audition:' + me.id, s); T.studentPages.auditions(); };
      wireForm(s, 's', function () { T.ls('audition:' + me.id, s); redraw(); });
      document.getElementById('send').onclick = function () {
        readForm(s, 's');
        if (!s.roles.length && !s.any) { document.getElementById('m').textContent = 'Pick at least one role, or turn on “Any role is OK”.'; return; }
        this.disabled = true;
        Store.sendNote(T.key, Object.assign({ type: 'audition', actor: me.id }, s)).then(function () { T.ls('audition:' + me.id, s); T.toast('Sent! Break a leg!'); redraw(); })
          .catch(function (e) { document.getElementById('send').disabled = false; document.getElementById('m').textContent = e.message || 'It did not send. Check the Wi-Fi.'; });
      };
      return;
    }
    app.innerHTML = h || '<div class="card"><p>' + sym('🎭') + 'Auditions are not open yet. Your teacher will tell you when!</p><p><a class="btn" href="#/listen">Listen to the whole show</a> <a class="btn" href="#/story">Read the story</a></p></div>';
  };
  function sideCard(charId) {
    var ch = T.charById(charId); if (!ch) return '';
    var sd = side(charId);
    return '<div class="card" style="border-left:8px solid ' + T.color(charId) + '"><b>' + esc(ch.name) + '</b><p class="small">' + esc(ch.desc) + '</p><div class="row">' +
      (sd.scene && sd.lines ? '<a class="btn small" href="#/lines/' + sd.scene.id + '/run/' + charId + '">' + icon('mic') + 'Practice Scene ' + sd.scene.num + ' as ' + esc(ch.short) + '</a>' : '') +
      (sd.song ? '<a class="btn small" href="#/song/' + sd.song.id + '">' + icon('songs') + esc(sd.song.title) + '</a>' : '') + '</div></div>';
  }
  T.auditionsTile = function () { var c = T.show.casting; return !!(c && (c.open || c.callbacksShown || (c.posted && Date.now() - new Date(c.posted) < 14 * 864e5))); };
})();
