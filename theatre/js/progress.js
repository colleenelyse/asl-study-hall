/* asl.cool/theatre practice data, like Colleen's flashcard app (2026-10-21): students mark each of their lines right or wrong, rate the lyrics and the dance
   after a song, and get "Study next" suggestions; the teacher sees who has practiced everything they are in, who practices most, who is struggling where,
   and who was away when something of theirs was taught.
   A student's record: { v, lines { sceneId: { lineKey: [right, wrong, lastDay] } }, songs { songId: { l: [rating 1-3, day], d: [rating 0-3, day] (0 = no dance), plays } },
   time { day: { lines, songs, listen } (seconds) } }. Kept on the iPad (localStorage) and saved sealed to asl.cool (Store.putProgress), so it follows the
   student to another iPad and the teacher can read it. Suggestions favor what is coming up in class soon and what was missed most: retrieval practice
   and spacing (Dunlosky et al. 2013) are among the best-supported ways to learn. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var day = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var lineKey = function (it) { return it.who + '|' + it.text.slice(0, 48); };
  T.lineKey = lineKey;

  /* ---------- this student's record ---------- */
  var rec = null, recFor = null, dirty = false, timer = null, merged = false;
  function blank() { return { v: 1, lines: {}, songs: {}, time: {} }; }
  function me() { return T.me && T.me.id && !(T.pass && T.pass.who === 'parent') ? T.me.id : null; }      // nothing is recorded on a parent's iPad (Colleen 2026-10-23); a helper's practice is the student's, marked
  function get() {
    var id = me(); if (!id) return null;
    if (recFor !== id) { rec = T.ls('progress:' + id) || blank(); recFor = id; merged = false; mergeServer(); }
    return rec;
  }
  /* the server copy (another iPad) and this one: keep the larger counts and the later ratings */
  function mergeServer() {
    var id = me(); if (!id || merged || !T.key) return; merged = true;
    Store.getProgress(T.key, id).then(function (o) {
      if (!o || recFor !== id) return;
      Object.keys(o.lines || {}).forEach(function (sc) { var a = rec.lines[sc] = rec.lines[sc] || {}; Object.keys(o.lines[sc]).forEach(function (k) { var x = o.lines[sc][k], y = a[k]; a[k] = !y ? x : [Math.max(x[0], y[0]), Math.max(x[1], y[1]), x[2] > y[2] ? x[2] : y[2]]; }); });
      Object.keys(o.songs || {}).forEach(function (so) { var x = o.songs[so], y = rec.songs[so] = rec.songs[so] || {}; ['l', 'd'].forEach(function (k) { if (x[k] && (!y[k] || x[k][1] > y[k][1])) y[k] = x[k]; }); y.plays = Math.max(x.plays || 0, y.plays || 0); });
      Object.keys(o.notes || {}).forEach(function (k) { var x = o.notes[k], y = (rec.notes = rec.notes || {})[k]; if (!y || x.at > y.at) rec.notes[k] = x; });      // notes on the script: the later edit wins
      Object.keys(o.time || {}).forEach(function (d) { var x = o.time[d], y = rec.time[d] = rec.time[d] || {}; Object.keys(x).forEach(function (k) { y[k] = Math.max(x[k] || 0, y[k] || 0); }); });
      T.ls('progress:' + id, rec);
    }).catch(function () {});
  }
  function touch() {
    var id = me(); if (!id) return;
    T.ls('progress:' + id, rec); dirty = true;
    clearTimeout(timer); timer = setTimeout(push, 20000);
  }
  function push() {
    var id = me(); if (!dirty || !id || !T.key || !rec) return;
    dirty = false; clearTimeout(timer);
    Store.putProgress(T.key, id, rec).catch(function () { dirty = true; });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push(); });
  window.addEventListener('online', push);

  var P = T.Progress = {
    /* a line of mine: right (true) or wrong (false), once per turn */
    line: function (sceneId, it, ok) {
      var r = get(); if (!r) return;
      var sc = r.lines[sceneId] = r.lines[sceneId] || {}, k = lineKey(it), x = sc[k] || [0, 0, ''];
      x[ok ? 0 : 1]++; x[2] = day(); sc[k] = x; touch();
    },
    rateSong: function (songId, lyrics, dance) {
      var r = get(); if (!r) return;
      var s = r.songs[songId] = r.songs[songId] || {};
      if (lyrics) s.l = [lyrics, day()];
      if (dance !== null && dance !== undefined) s.d = [dance, day()];
      s.plays = (s.plays || 0) + 1; touch();
    },
    addTime: function (kind, secs) {
      var r = get(); if (!r) return;
      var t = r.time[day()] = r.time[day()] || {}; t[kind] = (t[kind] || 0) + secs;
      if (T.pass && T.pass.who === 'helper') t.helped = (t.helped || 0) + secs;      // part of that time was with a peer helper
      touch();
    },
    /* my notes on the script pages: { id: { n page, x, y (PDF points), text, at, del } } (a deleted note is kept as del so other iPads learn of it) */
    notes: function () { var r = get(); return r ? r.notes || {} : {}; },
    saveNote: function (note) { var r = get(); if (!r) return; note.at = Date.now(); (r.notes = r.notes || {})[note.id] = note; touch(); push(); },
    playing: false,
    record: get
  };

  /* time: counted only while a practice page is open and the student is doing something (or audio is playing) */
  var lastTouch = Date.now();
  ['pointerdown', 'keydown'].forEach(function (e) { document.addEventListener(e, function () { lastTouch = Date.now(); }, true); });
  setInterval(function () {
    if (document.visibilityState !== 'visible' || !me()) return;
    var page = (location.hash.match(/^#\/(\w+)/) || [])[1], kind = page === 'lines' ? 'lines' : page === 'song' ? 'songs' : page === 'listen' ? 'listen' : null;
    if (kind && (P.playing || Date.now() - lastTouch < 120000)) P.addTime(kind, 5);
  }, 5000);

  /* after a song: how well do I know it? (the song page calls this when the track ends, or when leaving after most of it) */
  T.askSongRating = function (songId) {
    var song = T.songById(songId); if (!song || !me()) return;
    var faces = [[1, '😟', 'Still learning'], [2, '🙂', 'Getting there'], [3, '🤩', 'I know it!']];
    var box = document.createElement('dialog'), pick = { l: 0, d: -1 };
    var draw = function () {
      box.innerHTML = '<h2>' + sym('🎵') + esc(song.title) + '</h2>' +
        '<p><b>How well do you know the words?</b></p><div class="row">' + faces.map(function (f) { return '<button type="button" class="btn" data-l="' + f[0] + '" aria-pressed="' + (pick.l === f[0]) + '">' + f[1] + ' ' + f[2] + '</button>'; }).join('') + '</div>' +
        '<p style="margin-top:14px"><b>And the dance?</b></p><div class="row">' + faces.map(function (f) { return '<button type="button" class="btn" data-d="' + f[0] + '" aria-pressed="' + (pick.d === f[0]) + '">' + f[1] + ' ' + f[2] + '</button>'; }).join('') +
        '<button type="button" class="btn quiet" data-d="0" aria-pressed="' + (pick.d === 0) + '">No dance for me</button></div>' +
        '<div class="row end" style="margin-top:16px"><button class="btn quiet" id="sk">Skip</button><button class="btn primary" id="ok"' + (pick.l && pick.d >= 0 ? '' : ' disabled') + '>Save</button></div>';
      box.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { pick.l = +b.dataset.l; draw(); }; });
      box.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { pick.d = +b.dataset.d; draw(); }; });
      box.querySelector('#sk').onclick = function () { box.close(); box.remove(); };
      box.querySelector('#ok').onclick = function () { P.rateSong(songId, pick.l, pick.d); box.close(); box.remove(); T.toast(pick.l === 3 && pick.d !== 1 ? 'Awesome!' : 'Saved. Keep going!'); };
    };
    document.body.appendChild(box); draw(); box.showModal();
  };

  /* ---------- what one student has and has not practiced (used by the student and the teacher) ---------- */
  function analyze(a, r) {
    r = r || blank();
    var chars = a.chars || [], out = { scenes: [], songs: [], seconds: 0, week: 0 };
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      var mine = src.items.filter(function (it) { return it.type === 'line' && T.isMine(it.who, sc, chars); });
      if (!mine.length) return;
      var got = r.lines[sc.id] || {}, right = 0, wrong = 0, done = 0, last = '';
      mine.forEach(function (it) { var x = got[lineKey(it)]; if (x) { done++; right += x[0]; wrong += x[1]; if (x[2] > last) last = x[2]; } });
      out.scenes.push({ scene: sc, total: mine.length, done: done, right: right, wrong: wrong, mastery: right + wrong ? right / (right + wrong) : null, last: last });
    });
    T.O().songs.forEach(function (so) {
      var m = T.O().moments.find(function (x) { return x.song === so.id; });
      if (!m || !T.onStage(m, chars)) return;
      var x = r.songs[so.id] || {};
      out.songs.push({ song: so, lyrics: x.l ? x.l[0] : 0, dance: x.d ? x.d[0] : null, last: x.l ? x.l[1] : '' });
    });
    var wk = day(new Date(Date.now() - 7 * 864e5));
    out.helped = 0;
    Object.keys(r.time || {}).forEach(function (d) { var t = r.time[d], s = (t.lines || 0) + (t.songs || 0) + (t.listen || 0); out.seconds += s; out.helped += t.helped || 0; if (d >= wk) out.week += s; });
    var parts = out.scenes.length + out.songs.length;
    out.coverage = parts ? (out.scenes.filter(function (x) { return x.done === x.total; }).length + out.songs.filter(function (x) { return x.lyrics; }).length) / parts : 1;
    out.struggles = out.scenes.filter(function (x) { return x.right + x.wrong >= 3 && x.mastery < 0.6; }).map(function (x) { return 'Scene ' + x.scene.num + ' (' + Math.round(x.mastery * 100) + '% right)'; })
      .concat(out.songs.filter(function (x) { return x.lyrics === 1 || x.dance === 1; }).map(function (x) { return '“' + x.song.title + '” (' + (x.lyrics === 1 ? 'words' : 'dance') + ')'; }));
    return out;
  }
  T.analyzeProgress = analyze;
  /* scenes and songs coming up in class (the next 10 class days), to study first */
  function soon() {
    var p = T.show.production, out = { scenes: {}, songs: {} }; if (!p || !p.days) return out;
    var t = day(); Object.keys(p.days).filter(function (d) { return d >= t; }).sort().slice(0, 10).forEach(function (d) {
      (p.days[d].groups || []).forEach(function (g) { (g.scenes || []).forEach(function (x) { if (!out.scenes[x]) out.scenes[x] = d; }); (g.songs || []).forEach(function (x) { if (!out.songs[x]) out.songs[x] = d; }); });
    });
    return out;
  }
  var when = function (d) { var a = d.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString('en-US', { weekday: 'long' }); };
  /* the student's top three things to study, with the reason */
  T.studyNext = function () {
    var a = (T.show.cast || []).find(function (x) { return x.id === me(); }); if (!a || !(a.chars || []).length) return [];
    var an = analyze(a, get()), up = soon(), list = [], today = day();
    var since = function (d) { if (!d) return 30; var a2 = d.split('-'); return Math.min(30, Math.round((Date.now() - new Date(+a2[0], +a2[1] - 1, +a2[2])) / 864e5)); };
    an.scenes.forEach(function (x) {
      var miss = x.total - x.done, need = miss / x.total * 2 + (x.mastery === null ? 1 : (1 - x.mastery) * 3) + since(x.last) / 15 + (up.scenes[x.scene.id] ? 3 : 0);
      var why = up.scenes[x.scene.id] ? 'Coming up ' + (up.scenes[x.scene.id] === today ? 'today' : 'on ' + when(up.scenes[x.scene.id])) : x.done === 0 ? 'Not practiced yet' : x.mastery !== null && x.mastery < 0.8 ? 'You got ' + Math.round(x.mastery * 100) + '% right so far' : miss ? miss + ' line' + (miss === 1 ? '' : 's') + ' not tried yet' : 'Keep it fresh';
      list.push({ need: need, icon: '🗣️', text: 'Lines: Scene ' + x.scene.num, why: why, href: '#/lines/' + x.scene.id + '/run' });
    });
    an.songs.forEach(function (x) {
      var need = (x.lyrics ? (3 - x.lyrics) : 2.5) + (x.dance ? (3 - x.dance) : 0) + since(x.last) / 15 + (up.songs[x.song.id] ? 3 : 0);
      var why = up.songs[x.song.id] ? 'Coming up ' + (up.songs[x.song.id] === today ? 'today' : 'on ' + when(up.songs[x.song.id])) : !x.lyrics ? 'Not rated yet' : x.lyrics < 3 ? 'You rated the words ' + x.lyrics + ' of 3' : x.dance && x.dance < 3 ? 'You rated the dance ' + x.dance + ' of 3' : 'Keep it fresh';
      list.push({ need: need, icon: '🎵', text: 'Song: “' + x.song.title + '”', why: why, href: '#/song/' + x.song.id });
    });
    return list.sort(function (p, q) { return q.need - p.need; }).slice(0, 3);
  };
  T.studyNextCard = function () {
    var l = T.studyNext(); if (!l.length) return '';
    return '<div class="card"><h3>' + sym('📌') + 'Study next</h3>' + l.map(function (x) { return '<a class="switch" style="text-decoration:none;color:inherit" href="' + x.href + '"><span>' + sym(x.icon) + '<b>' + esc(x.text) + '</b><br><span class="muted small">' + esc(x.why) + '</span></span><span class="btn small">Start</span></a>'; }).join('') + '</div>';
  };

  /* ---------- Teacher: Progress ---------- */
  var sortBy = 'help';
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.progress = function (args) {
    T.setBar('Progress', '#/teacher');
    app.innerHTML = '<p class="muted">Loading everyone’s practice…</p>';
    Store.allProgress(T.key, T.proof).then(function (all) {
      var by = {}; all.forEach(function (x) { by[x.actor] = x.rec; });
      if (args[0]) return detail(args[0], by[args[0]]);
      table(by);
    }).catch(function (e) { app.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  };
  var mins = function (s) { return Math.round(s / 60) + ' min'; };
  /* days a student was away when something of theirs was worked on in class, and whether they have practiced it since */
  function missed(a, an, r) {
    var p = T.show.production; if (!p || !p.days || !T.prodTask) return [];
    var out = [], t = day();
    Object.keys(p.days).filter(function (d) { return d < t || d === t; }).sort().forEach(function (d) {
      var at = (p.attendance || {})[d] || {}, away = at[a.id] === 'absent' || at[a.id] === 'excused' || (p.conflicts || []).some(function (c) { return c.actor === a.id && c.date === d; });
      if (!away) return;
      (p.days[d].groups || []).forEach(function (g) {
        if (g.focus === 'trip') return;
        g.scenes.forEach(function (sid) { var x = an.scenes.find(function (y) { return y.scene.id === sid; }); if (x) out.push({ date: d, what: g.focus + ' · Scene ' + x.scene.num, caught: !!x.last && x.last > d }); });
        g.songs.forEach(function (sid) { var x = an.songs.find(function (y) { return y.song.id === sid; }); if (x) out.push({ date: d, what: g.focus + ' · “' + x.song.title + '”', caught: !!x.last && x.last > d }); });
      });
    });
    return out;
  }
  function table(by) {
    var rows = (T.show.cast || []).filter(function (a) { return !a.guest && (a.chars || []).length; }).map(function (a) {
      var r = by[a.id], an = analyze(a, r), ms = missed(a, an, r);
      return { a: a, an: an, missed: ms.filter(function (m) { return !m.caught; }), hasData: !!r };
    });
    var sorts = { help: function (x, y) { return (y.an.struggles.length + y.missed.length) - (x.an.struggles.length + x.missed.length) || x.an.coverage - y.an.coverage; },
      done: function (x, y) { return y.an.coverage - x.an.coverage; }, time: function (x, y) { return y.an.seconds - x.an.seconds; } };
    rows.sort(sorts[sortBy]);
    var all = rows.filter(function (x) { return x.an.coverage >= 1; });
    app.innerHTML = '<div class="row" style="margin-bottom:12px"><div class="seg">' + [['help', 'Needs help first'], ['done', 'Most done'], ['time', 'Most practice']].map(function (s) { return '<button data-s="' + s[0] + '" aria-pressed="' + (sortBy === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      (all.length ? '<div class="card">' + sym('🏅') + '<b>Practiced everything they are in:</b> ' + all.map(function (x) { return esc(x.a.name); }).join(', ') + '</div>' : '') +
      '<table class="tbl"><thead><tr><th>Student</th><th>Practiced</th><th>Time (7 days / all)</th><th>Struggling with</th><th>Missed in class, not caught up</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var pct = Math.round(x.an.coverage * 100);
        return '<tr style="cursor:pointer" data-a="' + x.a.id + '"><td>' + T.face(x.a, 32) + ' <b>' + esc(x.a.name) + '</b></td><td><b' + (pct < 50 ? ' class="err"' : '') + '>' + pct + '%</b>' + (x.hasData ? '' : '<br><span class="muted small">no practice yet</span>') + '</td>' +
          '<td>' + mins(x.an.week) + ' / ' + mins(x.an.seconds) + (x.an.helped ? '<br><span class="muted small">' + mins(x.an.helped) + ' with a helper</span>' : '') + '</td><td>' + (x.an.struggles.length ? '<span class="err">' + x.an.struggles.slice(0, 3).map(esc).join('<br>') + '</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (x.missed.length ? x.missed.slice(0, 3).map(function (m) { return esc(T.prodDay ? T.prodDay(m.date, true) : m.date) + ': ' + esc(m.what); }).join('<br>') : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') + '</tbody></table><p class="muted small">Practice counts on the iPads: lines marked right or wrong, songs rated after singing, minutes on practice pages. A missed day counts as caught up once they practice that scene or song in the app afterward.</p>';
    app.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { sortBy = b.dataset.s; table(by); }; });
    app.querySelectorAll('[data-a]').forEach(function (tr) { tr.onclick = function () { T.go('#/teacher/progress/' + tr.dataset.a); }; });
  }
  function detail(id, r) {
    var a = (T.show.cast || []).find(function (x) { return x.id === id; }); if (!a) return;
    T.setBar(a.name, '#/teacher/progress');
    var an = analyze(a, r), ms = missed(a, an, r), face = ['', '😟', '🙂', '🤩'];
    app.innerHTML = '<div class="card row">' + T.face(a, 56) + '<div class="grow"><h2 style="margin:0">' + esc(a.name) + '</h2>' + (a.chars || []).map(T.chip).join('') + '</div><div><b>' + Math.round(an.coverage * 100) + '%</b> practiced<br>' + mins(an.week) + ' this week' + (an.helped ? '<br><span class="muted small">' + mins(an.helped) + ' with a helper (all time)</span>' : '') + '</div></div>' +
      '<div class="card"><h3>Lines</h3><table class="tbl"><thead><tr><th>Scene</th><th>Tried</th><th>Right</th><th>Last practiced</th></tr></thead><tbody>' + an.scenes.map(function (x) {
        return '<tr><td>Scene ' + x.scene.num + ' · ' + esc(x.scene.place) + '</td><td>' + x.done + ' of ' + x.total + '</td><td' + (x.mastery !== null && x.mastery < 0.6 ? ' class="err"' : '') + '>' + (x.mastery === null ? '—' : Math.round(x.mastery * 100) + '% (' + x.right + ' ✓ ' + x.wrong + ' ✗)') + '</td><td>' + esc(x.last || 'never') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Songs</h3><table class="tbl"><thead><tr><th>Song</th><th>Words</th><th>Dance</th><th>Last rated</th></tr></thead><tbody>' + an.songs.map(function (x) {
        return '<tr><td>' + esc(x.song.title) + '</td><td>' + (x.lyrics ? face[x.lyrics] + ' ' + x.lyrics + '/3' : '—') + '</td><td>' + (x.dance === 0 ? 'no dance' : x.dance ? face[x.dance] + ' ' + x.dance + '/3' : '—') + '</td><td>' + esc(x.last || 'never') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (ms.length ? '<div class="card"><h3>Days away</h3>' + ms.map(function (m) { return '<p>' + esc(T.prodDay ? T.prodDay(m.date) : m.date) + ': ' + esc(m.what) + ' · ' + (m.caught ? '✅ practiced since' : '<span class="err">not practiced since</span>') + '</p>'; }).join('') + '</div>' : '');
  }
})();
