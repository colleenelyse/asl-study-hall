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

  /* ---------- Songs (#/teacher/songhub) and Captions (#/teacher/caphub), the same way (Colleen 2026-10-25: "build the step-by-step pages for
     Captions and Songs, like the Curtain call & Megamix page") ---------- */
  function songFacts() {
    var O = T.O(), songs = O.songs || [], tr = T.show.tracks || {}, lt = T.show.lyricTimes || {}, pi = T.show.sheetMelody || {}, U = T.show.underscore || {};
    return songs.map(function (so) { var t = tr[so.id] || {}; return { so: so, guide: !!t.rehearsal, band: !!t.performance, timed: !!lt[so.id], piano: !!(pi[so.id] && pi[so.id].notes && pi[so.id].notes.length), over: !!(U[so.id] && (U[so.id].cues || []).length) }; });
  }
  function songSteps() {
    var F = songFacts(), n = F.length, cnt = function (f) { return F.filter(f).length; };
    var tracks = cnt(function (x) { return x.guide && x.band; }), any = cnt(function (x) { return x.guide || x.band; }), timed = cnt(function (x) { return x.timed; }), piano = cnt(function (x) { return x.piano; }), over = cnt(function (x) { return x.over; });
    var nextTime = F.filter(function (x) { return (x.guide || x.band) && !x.timed; })[0];
    return [
      { st: level(tracks, n), title: 'Both tracks for every song', what: tracks + ' of ' + n + ' songs have the guide vocals and the band track' + (any > tracks ? ' (' + (any - tracks) + ' more have one of the two)' : '') + '. Drop a whole folder in at once.',
        buttons: btn('#/teacher/songs', 'Songs & tracks', tracks < n) },
      { st: level(timed, n), title: 'Lyrics timing', what: timed + ' of ' + n + ' songs timed. Captions, the follow-along lyrics, the teleprompter and the piano melody follow it. A song badly off? Its page clears the sung or the spoken lines in one go.',
        buttons: (nextTime ? btn('#/teacher/songs/lyrics/' + nextTime.so.id, 'Time the next one: #' + esc(nextTime.so.num) + ' ' + esc(nextTime.so.title), true) : '') + btn('#songtable', 'Every song below') },
      { st: over ? 'done' : 'todo', title: 'Lines over the music', what: over + ' song' + (over === 1 ? '' : 's') + ' with lines spoken over the music set. Only for songs where someone talks while the band plays.',
        buttons: btn('#songtable', 'Pick a song below') },
      { st: level(piano, timed || n), title: 'Piano melody', what: piano + ' of the ' + timed + ' timed songs have the singer’s notes as a soft piano (it needs the lyrics timing first). Company members can turn it on to learn the tune.',
        buttons: btn('#/teacher/songs', 'Make them on Songs & tracks') },
      { st: any ? 'some' : 'todo', title: 'Listen through', what: 'The songs in order for the Company, and the whole show with the lines for you. In Listen to the show, turn off the lines spoken during songs if the tracks already have them.',
        buttons: btn('#/listen', icon('play') + 'Play the whole show') + btn('#/teacher/listenshow', icon('play') + 'Listen to the show') }
    ];
  }
  T.teacherPages.songhub = function () {
    T.setBar('Songs', '#/teacher');
    var steps = songSteps(), done = steps.filter(function (x) { return x.st === 'done'; }).length, F = songFacts();
    var tick = function (on, label) { return on ? '<span class="gr-ok" title="' + label + '">✓</span>' : '<span class="gr-no" title="' + label + ': not yet">–</span>'; };
    app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🎵') + 'Songs</h2><p>Everything the songs need, in order. <b>' + done + ' of ' + steps.length + '</b> done.</p></div>' +
      '<div class="card gr-list">' + steps.map(function (x, i) { return row(x.st, (i + 1) + '. ' + x.title, x.what, x.buttons); }).join('') + '</div>' +
      '<div class="card" id="songtable" style="overflow-x:auto"><h3 style="margin-top:0">Every song</h3><table class="tbl small"><thead><tr><th style="text-align:left">Song</th><th>Guide</th><th>Band</th><th>Timing</th><th>Piano</th><th>Lines over music</th><th></th></tr></thead><tbody>' +
      F.map(function (x) { return '<tr><td><b>#' + esc(x.so.num) + '</b> ' + esc(x.so.title) + '</td><td class="center">' + tick(x.guide, 'Guide vocals') + '</td><td class="center">' + tick(x.band, 'Band track') + '</td><td class="center">' + tick(x.timed, 'Lyrics timing') + '</td><td class="center">' + tick(x.piano, 'Piano') + '</td><td class="center">' + tick(x.over, 'Lines over the music') + '</td>' +
        '<td>' + (x.guide || x.band ? btn('#/teacher/songs/lyrics/' + x.so.id, x.timed ? 'Timing' : 'Time it', !x.timed) + btn('#/teacher/songs/cues/' + x.so.id, 'Lines over') : btn('#/teacher/songs', 'Upload')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    app.querySelectorAll('a[href="#songtable"]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); document.getElementById('songtable').scrollIntoView({ behavior: 'smooth' }); }; });
  };
  function capSteps() {
    var F = songFacts(), n = F.length, timed = F.filter(function (x) { return x.timed; }).length, C = T.show.captions || {}, styles = Object.keys(C.prompt || {}).length, run = T.ls('capRun') === '1';
    return [
      { st: T.show.captionDoc ? 'done' : T.show.script ? 'some' : 'todo', title: 'Read through the captions and fix them', what: T.show.captionDoc ? 'Your edited caption script is in use.' : 'Made straight from the script. Fix words, who says it, missing lines, and lines split by syllables.',
        buttons: btn('#/teacher/captedit', 'Edit the captions', !T.show.captionDoc) },
      { st: level(timed, n), title: 'Lyrics timing (the songs’ captions follow it)', what: timed + ' of ' + n + ' songs timed. An untimed song’s words are cued by hand, one line at a time, and its music does not play from the runner.',
        buttons: btn('#/teacher/songhub', 'Songs', timed < n) },
      { st: C.size ? 'done' : 'todo', title: 'How they look, and each performer’s prompts', what: 'The audience strip at the top, the letter size for the back row, and Whole line or First words for each character (' + styles + ' set).',
        buttons: btn('#/teacher/captions', 'Looks and prompts', !C.size) },
      { st: T.show.captionDoc && timed ? 'some' : 'todo', title: 'Check them with the music', what: 'Play a song with its captions (pause, skip 10 s, drag, or start at any line), and step through the spoken lines.',
        buttons: btn('#/teacher/captions', icon('play') + 'Check them') },
      { st: run ? 'done' : 'todo', title: 'The show laptop: run them', what: run ? 'This laptop is ready to run the captions without Wi-Fi.' : 'One laptop, one operator, no QLab: save the tracks on the show laptop, then prove it with Wi-Fi off.',
        buttons: btn('#/teacher/caprun', 'Get the laptop ready', !run) + (run ? btn('#/captions-run', icon('play') + 'Open the runner') : '') }
    ];
  }
  T.teacherPages.caphub = function () {
    T.setBar('Captions', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › The script).</p>'; return; }
    var steps = capSteps(), done = steps.filter(function (x) { return x.st === 'done'; }).length;
    app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('💬') + 'Captions</h2><p>The audience captions and the performer teleprompter, from the script to the show laptop. <b>' + done + ' of ' + steps.length + '</b> done.</p></div>' +
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
      [level(nTr, songs.length), 'A track for every song', nTr + ' of ' + songs.length + ' songs have a track.', btn('#/teacher/songhub', 'Songs', nTr < songs.length)],
      [level(nLt, songs.length), 'Lyrics timing for every song', nLt + ' of ' + songs.length + ' songs timed. Captions, follow-along lyrics and the piano melody need it.', btn('#/teacher/songhub', 'Lyrics timing', nTr >= songs.length && nLt < songs.length)],
      ['todo', 'Voices for the lines', '<span data-gr-voices>Counting…</span>', btn('#/teacher/voices', 'Voices & recordings') + btn('#/teacher/listenshow', 'Listen to the show')],
      [cap, 'Captions checked', T.show.captionDoc ? 'Your edited caption script.' : 'Made straight from the script: read through them once.', btn('#/teacher/caphub', 'Captions', cap !== 'done')],
      [level(bDone, bows.length), 'Curtain call & Megamix', bDone + ' of ' + bows.length + ' steps done.', btn('#/teacher/bows', 'Curtain call & Megamix', bDone < bows.length)],
      [run ? 'done' : 'todo', 'The caption laptop ready', run ? 'This laptop can run the captions without Wi-Fi.' : 'On the laptop that runs the show, the week before.', btn('#/teacher/caphub', 'Captions')]
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
