/* asl.cool/theatre: pulling the tools together (Colleen 2026-10-25: "this feels like we've built a bunch of good tools but it feels a little
   disjointed"). Two pieces:
   - Getting ready (top of Teacher mode): every setup step in order, done / started / to do, each with a button straight to it; it folds away
     once you close it (ls readyOpen) and says how many are done.
   - Curtain call & Megamix (#/teacher/bows): one page with the five steps in order (the bow music and counting, the bow groups and times, the
     Megamix groups, the Megamix music and sections, rehearse), each with what is done and buttons to the pages that do it. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var MARK = { done: '✓', some: '◐', todo: '○' };
  var btn = function (href, label, primary) { return '<a class="btn small' + (primary ? ' primary' : '') + '" href="' + href + '">' + label + '</a>'; };
  function row(st, title, what, buttons) {
    return '<div class="gr-row ' + st + '"><span class="gr-mark" aria-label="' + (st === 'done' ? 'Done' : st === 'some' ? 'Started' : 'To do') + '">' + MARK[st] + '</span><div class="gr-body"><b>' + title + '</b><div class="small">' + what + '</div></div><div class="gr-btns">' + buttons + '</div></div>';
  }
  var level = function (n, of) { return !of ? 'todo' : n >= of ? 'done' : n > 0 ? 'some' : 'todo'; };

  /* ---------- the Curtain call & Megamix steps (also counted on the checklist) ---------- */
  function bowSteps() {
    var P = T.curtainPlan ? T.curtainPlan() : null, mu = T.curtainMusic ? T.curtainMusic() : null, saved = !!T.show.curtain, c = (P && P.counts) || {};
    var groups = (P && P.groups) || [], timed = groups.filter(function (g) { return T.bowTimeOf(g) != null; }).length;
    var M = T.Megamix && T.Megamix.status ? T.Megamix.status() : null;
    return [
      { st: mu && c.fit ? 'done' : mu ? 'some' : 'todo', title: 'The bow music and its counting',
        what: (mu ? 'Music: ' + esc(mu.name) + '. ' : 'No bow music yet. ') + (c.fit ? 'Counted from your taps: ' + c.bpm + ' beats a minute.' : c.bpm ? 'A steady ' + c.bpm + ' beats a minute (typed, not tapped).' : 'Not counted yet.'),
        buttons: btn('#/teacher/curtain', mu ? 'Change the music' : 'Pick or upload the music', !mu) + (mu ? btn('#/teacher/curtain/count', c.fit ? 'Count again' : 'Count the music', !c.fit) : '') + (c.fit ? btn('#/teacher/curtain/count/watch', icon('play') + 'Preview the counting') : '') },
      { st: saved && groups.length && timed === groups.length ? 'done' : timed ? 'some' : 'todo', title: 'The bow groups and when each one runs on',
        what: groups.length + ' groups, ' + timed + ' with a time' + (saved ? '' : ' (the suggested plan: Save it on the Curtain call page)') + '. Tap the run-on times while it plays, or type each group’s 8-count.',
        buttons: btn('#/teacher/curtain', 'Groups and times', saved && timed < groups.length || !saved) + (timed ? btn('#/teacher/curtain/run', icon('play') + 'Rehearse the bows') : '') },
      M ? { st: M.saved && !M.problems ? 'done' : M.saved ? 'some' : 'todo', title: 'The Megamix groups',
        what: M.sections + ' sections. ' + (M.saved ? (M.problems ? M.problems + ' thing' + (M.problems === 1 ? '' : 's') + ' to look at.' : 'Saved, nothing to look at.') : 'The suggestion is ready: look it over and Save.'),
        buttons: btn('#/teacher/megamix', 'Megamix groups', !M.saved) } : null,
      M ? { st: M.music && M.times >= M.sections ? 'done' : M.music || M.times ? 'some' : 'todo', title: 'The Megamix music and its sections',
        what: (M.music ? 'Music: ' + esc(M.music) + '. ' : 'No Megamix music yet. ') + M.times + ' of ' + M.sections + ' section starts marked. ' + (M.staging === 'stay' ? 'Everyone stays on stage; the dancing group comes downstage.' : 'Exits and entrances.'),
        buttons: btn('#/teacher/megamix', M.music ? 'Music and staging' : 'Pick the music', !M.music) + (M.music ? btn('#/teacher/megamix/mark', M.times ? 'Mark again' : 'Mark the sections', !M.times) : '') + (M.times ? btn('#/teacher/megamix/mark/watch', icon('play') + 'Preview the sections') : '') } : null,
      { st: timed && M && M.times ? 'done' : timed || (M && M.times) ? 'some' : 'todo', title: 'Rehearse it',
        what: 'On the projector: the bows, then the Megamix, with GET READY and GO. Each Company member practices both on their My bow page.',
        buttons: (timed ? btn('#/teacher/curtain/run', icon('play') + 'Rehearse the bows') : '') + (M && M.times ? btn('#/teacher/megamix/run', icon('play') + 'Rehearse the Megamix') : '') + btn('#/teacher/viewas', 'See a Company member’s My bow') }
    ].filter(Boolean);
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.bows = function () {
    T.setBar('Curtain call & Megamix', '#/teacher');
    var steps = bowSteps(), done = steps.filter(function (x) { return x.st === 'done'; }).length;
    app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🌟') + 'Curtain call & Megamix</h2><p>The bows to the short track, three groups by 8-count, then the whole Megamix in sections. Work down the steps; each one shows what is done. <b>' + done + ' of ' + steps.length + '</b> done.</p></div>' +
      '<div class="card gr-list">' + steps.map(function (x, i) { return row(x.st, (i + 1) + '. ' + x.title, x.what, x.buttons); }).join('') + '</div>';
  };

  /* ---------- Getting ready (top of Teacher mode) ---------- */
  T.readyList = function () {
    var O = T.O(), songs = O.songs || [], tr = T.show.tracks || {}, lt = T.show.lyricTimes || {};
    var chars = O.characters.filter(function (c) { return c.group !== 'helpers'; }), cast = (T.show.cast || []).filter(function (a) { return a.name && (a.chars || []).length; });
    var covered = chars.filter(function (c) { return cast.some(function (a) { return a.chars.indexOf(c.id) >= 0; }); }).length;
    var nTr = songs.filter(function (s) { return tr[s.id] && (tr[s.id].performance || tr[s.id].rehearsal); }).length, nLt = songs.filter(function (s) { return lt[s.id]; }).length;
    var prod = T.show.production, planned = prod && prod.days ? Object.keys(prod.days).length : 0;
    var bows = bowSteps(), bDone = bows.filter(function (x) { return x.st === 'done'; }).length;
    var cap = T.show.captionDoc ? 'done' : T.show.script ? 'some' : 'todo', run = T.ls('capRun') === '1';
    var steps = [
      [T.show.script ? 'done' : 'todo', 'Import the script', T.show.script ? T.show.script.scenes.length + ' scenes read.' : 'The actor’s script PDF, read on this computer.', btn('#/teacher/script', T.show.script ? 'Script' : 'Import it', !T.show.script)],
      [level(covered, chars.length), 'Cast the show', covered + ' of ' + chars.length + ' roles cast.', btn('#/teacher/casting', 'Casting', covered < chars.length) + btn('#/teacher/cast', 'Cast list')],
      [planned ? 'done' : 'todo', 'Plan the semester', planned ? planned + ' class days planned.' : 'The calendar and the day-by-day plan.', btn('#/teacher/production', 'Production', !planned)],
      [level(nTr, songs.length), 'A track for every song', nTr + ' of ' + songs.length + ' songs have a track.', btn('#/teacher/songs', 'Songs & tracks', nTr < songs.length)],
      [level(nLt, songs.length), 'Lyrics timing for every song', nLt + ' of ' + songs.length + ' songs timed. Captions, follow-along lyrics and the piano melody need it.', btn('#/teacher/songs', 'Lyrics timing', nTr >= songs.length && nLt < songs.length)],
      ['todo', 'Voices for the lines', '<span data-gr-voices>Counting…</span>', btn('#/teacher/voices', 'Voices & recordings') + btn('#/teacher/listenshow', 'Listen to the show')],
      [cap, 'Captions checked', T.show.captionDoc ? 'Your edited caption script.' : 'Made straight from the script: read through them once.', btn('#/teacher/captedit', 'Edit the captions', cap !== 'done') + btn('#/teacher/captions', 'Looks and sizes')],
      [level(bDone, bows.length), 'Curtain call & Megamix', bDone + ' of ' + bows.length + ' steps done.', btn('#/teacher/bows', 'Curtain call & Megamix', bDone < bows.length)],
      [run ? 'done' : 'todo', 'The caption laptop ready', run ? 'This laptop can run the captions without Wi-Fi.' : 'On the laptop that runs the show, the week before.', btn('#/teacher/caprun', 'Run the captions')]
    ];
    var done = steps.filter(function (x) { return x[0] === 'done'; }).length, open = T.ls('readyOpen') !== '0';
    setTimeout(voices, 30);
    return '<details class="card gr-list" id="gready"' + (open ? ' open' : '') + '><summary><b>' + sym('✅') + 'Getting ready</b> <span class="muted small">' + done + ' of ' + steps.length + ' done</span></summary>' +
      steps.map(function (x, i) { return '<div data-gr="' + i + '">' + row(x[0], (i + 1) + '. ' + x[1], x[2], x[3]) + '</div>'; }).join('') + '</details>';
  };
  /* the voices count needs the recordings list from the server: filled in after */
  function voices() {
    var box = document.getElementById('gready'); if (box) box.ontoggle = function () { T.ls('readyOpen', box.open ? '1' : '0'); };
    var el = document.querySelector('[data-gr-voices]'); if (!el || !T.Voices || !T.Voices.allLines || !T.show.script) { if (el) el.textContent = 'Import the script first.'; return; }
    T.Voices.load().then(function (ix) {
      var lines = T.Voices.allLines().filter(function (l) { return !T.Voices.muted(l.h); }), made = lines.filter(function (l) { var e = ix.lines[l.h]; return e && (e.tts || e.rec); }).length;
      var ok = lines.filter(function (l) { var e = ix.lines[l.h]; return e && e.tts && (T.show.voiceOk || {})[l.h] === e.tts; }).length;
      var st = level(made, lines.length), rowEl = el.closest('.gr-row');
      if (!document.body.contains(el)) return;
      el.textContent = made + ' of ' + lines.length + ' lines have a voice; ' + ok + ' approved by ear.';
      if (rowEl) { rowEl.className = 'gr-row ' + st; rowEl.querySelector('.gr-mark').textContent = MARK[st]; }
    }).catch(function () { el.textContent = 'Could not count the voices right now.'; });
  }
})();
