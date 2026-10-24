/* asl.cool/theatre: the semester plan, a rehearsal calendar for every track, and doubling ideas (Colleen, 2026-10-21: "create a rehearsal calendar
   based on the school calendar for each track", including the Jocks, Brainiacs and the other chorus groups; "even without knowing who is playing
   Sharpay ... you should still be able to populate that character's rehearsal calendar"; and if there are fewer students than roles, suggestions
   for one student to play two medium or small roles).
   Everything here works from characters, not students, so it is ready before the cast list.
   The plan: the audition weeks (Casting), then music first (a read-through and vocals), then scenes in show order with several rehearsals at once
   (an acting scene, a vocals group, the chorus learning a dance; the song that overlaps least with the scene is chosen), a Friday run of what has
   been learned so far (spaced practice), a last stretch that cleans what was rehearsed longest ago and runs each half, the runs week, and show week.
   Only empty days are filled; generated days carry gen: true so they can be cleared. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  var X = function () { return T.prod; };
  var P = function () { return T.production(); };
  function parse(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  var allChars = function () { return T.O().characters.map(function (c) { return c.id; }); };
  function onIn(m) { return allChars().filter(function (c) { return T.onFor(m, c); }); }

  /* ---------- what there is to rehearse ---------- */
  function units() {
    var O = T.O(), scenes = [], songs = [];
    O.scenes.forEach(function (s) {
      var talk = O.moments.filter(function (m) { return m.scene === s.id && !m.song; });
      if (!talk.length) return;
      var who = {}; talk.forEach(function (m) { onIn(m).forEach(function (c) { who[c] = 1; }); });
      var min = talk.reduce(function (a, m) { return a + (m.minutes || 1); }, 0);
      var src = T.scriptScene(s), nLines = src ? src.items.filter(function (it) { return it.type === 'line'; }).length : 0;
      scenes.push({ id: s.id, num: s.num, min: min, chars: Object.keys(who), need: Math.max(1, Math.min(4, Math.ceil(min / 1.5))), done: 0, last: -1,
        diff: min + nLines * 0.05 + Object.keys(who).length * 0.2 });      // how hard: length, lines, people
    });
    O.songs.forEach(function (so) {
      var m = O.moments.find(function (x) { return x.song === so.id; }); if (!m) return;
      var min = T.songMinutes(so), big = !!m.big || m.on === '*';
      songs.push({ diff: min + (big ? 2 : 0) + onIn(m).length * 0.1, id: so.id, title: so.title, min: min, big: big, chars: onIn(m), vneed: Math.max(2, Math.min(5, Math.ceil(min / 1.2))), dneed: big ? Math.max(2, Math.min(5, Math.ceil(min))) : 0, vdone: 0, ddone: 0, vlast: -1, dlast: -1 });
    });
    return { scenes: scenes, songs: songs };
  }
  var overlap = function (a, b) { return a.filter(function (c) { return b.indexOf(c) >= 0; }).length; };

  /* students with a small solo line (1 to 4 sung lines that are theirs alone), for the show-and-tell spotlight; leads are not included */
  function soloists() {
    var out = [];
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      src.items.forEach(function (it) {
        if (it.type !== 'song') return;
        var so = T.O().songs.find(function (s) { return s.num === it.num; }), n = {};
        it.lyrics.forEach(function (l) { var ids = T.labelChars(l.who); if (ids.length === 1 && ids[0] !== '*') n[ids[0]] = (n[ids[0]] || 0) + 1; });
        Object.keys(n).forEach(function (c) { var ch = T.charById(c); if (ch && (ch.group === 'featured' || ch.small) && n[c] <= 4 && so && !out.some(function (x) { return x.c === c; })) out.push({ c: c, song: so, lines: n[c] }); });      // the featured roles: one small solo that is a stretch
      });
    });
    return out;
  }
  T.soloists = soloists;
  T.soloSongOf = function (c) { var x = soloists().find(function (y) { return y.c === c; }); return x && x.song; };

  /* ---------- the plan ---------- */
  function defaultShowMonday() {
    var t = P().term; if (!t.last) return '';
    var d = parse(X().addDays(t.last, -7)), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1));
    return X().addDays(t.first, Math.round((d - parse(t.first)) / 864e5));
  }
  function layout(showMon, withAuditions, movieDays) {
    var days = X().classDays(), aud = withAuditions && T.starterDays ? Math.min(T.starterDays(movieDays), days.length) : 0;
    var before = days.filter(function (d) { return d < showMon; });
    var runs = before.slice(-5), work = before.slice(aud, Math.max(aud, before.length - 5));
    var show = days.filter(function (d) { return d >= showMon && d <= X().addDays(showMon, 4); });
    return { days: days, auditions: before.slice(0, aud), work: work, runs: runs, show: show };
  }
  function makePlan(showMon, withAuditions, movieDays) {
    var p = P(), L = layout(showMon, withAuditions, movieDays), U = units(), n = L.work.length, made = 0;
    if (withAuditions && T.applyStarter) made += T.applyStarter(movieDays);
    var split = T.showSplit ? T.showSplit() : Math.ceil(T.O().scenes.length / 2), sceneIds = T.O().scenes.map(function (s) { return s.id; });
    var where = { acting: (p.venueName || 'Stage'), vocals: 'Choir room', dance: 'Dance space', run: (p.venueName || 'Stage') };
    var g = function (focus, sc, so, extra) { return Object.assign({ id: uid('g'), focus: focus, scenes: sc || [], songs: so || [], everyone: false, where: where[focus] || '', only: '' }, extra || {}); };
    var p1 = Math.round(n * 0.2), p3 = Math.round(n * 0.75), readAt = 0;
    var readChunks = (function () { var out = [], cur = [], m = 0; U.scenes.forEach(function (s) { cur.push(s.id); m += s.min; if (m >= 10) { out.push(cur); cur = []; m = 0; } }); if (cur.length) out.push(cur); return out; })();
    /* hardest first (Colleen: learn the most difficult things first and keep rehearsing them as easier things are added) */
    var byDiff = function (a, b) { return b.diff - a.diff; };
    var nextScene = function (i) { return U.scenes.filter(function (s) { return s.done < s.need; }).sort(byDiff)[0] || U.scenes.slice().sort(function (a, b) { return a.last - b.last; })[0]; };
    /* review: among the hard things already learned, the one rehearsed longest ago */
    var reviewScene = function () { var l = U.scenes.filter(function (s) { return s.done > 0; }).sort(byDiff); l = l.slice(0, Math.max(3, Math.ceil(l.length / 2))); return l.sort(function (a, b) { return a.last - b.last; })[0]; };
    var reviewSong = function (kind) { var l = U.songs.filter(function (s) { return kind === 'v' ? s.vdone > 0 : s.ddone > 0; }).sort(byDiff); l = l.slice(0, Math.max(2, Math.ceil(l.length / 2))); return l.sort(function (a, b) { return kind === 'v' ? a.vlast - b.vlast : a.dlast - b.dlast; })[0]; };
    var pickSong = function (kind, avoid, i) {      // the next song still to teach, least overlap with today's scene; else the one rehearsed longest ago
      var todo = U.songs.filter(function (s) { return kind === 'v' ? s.vdone < s.vneed : s.dneed && s.ddone < s.dneed; }).sort(byDiff).slice(0, 3);
      var pool = todo.length ? todo : U.songs.filter(function (s) { return kind === 'v' || s.dneed; }).slice().sort(function (a, b) { return (kind === 'v' ? a.vlast - b.vlast : a.dlast - b.dlast); }).slice(0, 3);
      return pool.sort(function (a, b) { return overlap(a.chars, avoid) - overlap(b.chars, avoid); })[0];
    };
    var learned = function () { return U.scenes.filter(function (s) { return s.done > 0; }).map(function (s) { return s.id; }); };
    /* show and tell, every other Friday: groups show each other the week's work, and two students with small solo lines sing them (Colleen) */
    var solo = soloists(), soloAt = 0, fridays = 0, weekWork = [];
    var share = function () {
      var spot = solo.length ? [solo[soloAt++ % solo.length], solo[soloAt++ % solo.length]].filter(function (x, k, a) { return a.indexOf(x) === k; }).map(function (x) { return x.c; }) : [];
      var shown = weekWork.filter(function (x, k, a) { return a.indexOf(x) === k; }).slice(0, 4);
      var note = 'Show and tell: ' + (shown.length ? shown.join(', ') + ' show the class what they worked on.' : 'every group shows the class what it worked on.') + (spot.length ? ' 🌟 Spotlight: ' + spot.map(function (c) { return T.charById(c).short; }).join(' and ') + ' sing their solo lines.' : '');
      return { groups: [g('share', [], [], { everyone: true, where: 'Everyone together' })], note: note, spotlight: spot };
    };
    L.work.forEach(function (d, i) {
      var fri = parse(d).getDay() === 5, groups = [], note = '';
      if (fri) fridays++;
      if (fri && fridays % 2 === 0 && i < p3) { var sh = share(); weekWork = []; if (!p.days[d]) { p.days[d] = { groups: sh.groups, assign: {}, tasks: {}, notes: sh.note, gen: true, spotlight: sh.spotlight }; made++; } return; }
      if (i < p1) {      // music first, and read the script together
        if (readAt < readChunks.length) { var ch = readChunks[readAt++]; groups.push(g('acting', ch, [], { where: 'Table read' })); note = 'Read-through: Scene' + (ch.length > 1 ? 's ' + T.sceneById(ch[0]).num + '–' + T.sceneById(ch[ch.length - 1]).num : ' ' + T.sceneById(ch[0]).num) + '. ';
          var sv = pickSong('v', [], i); if (sv) { groups.push(g('vocals', [], [sv.id])); sv.vdone++; sv.vlast = i; note += 'Vocals: “' + sv.title + '”.'; weekWork.push('the “' + sv.title + '” singers'); } }
        else { var a1 = pickSong('v', [], i), a2 = a1 && pickSong('v', a1.chars, i); [a1, a2].filter(Boolean).forEach(function (s, k) { if (k && s === a1) return; groups.push(g('vocals', [], [s.id], { where: k ? 'Practice room' : 'Choir room' })); s.vdone++; s.vlast = i; }); note = 'Vocals: ' + groups.map(function (x) { return '“' + T.songById(x.songs[0]).title + '”'; }).join(' and ') + '.'; }
      } else if (i < p3) {      // scenes in order, with vocals and dance at the same time; Friday: run what we have learned
        if (fri && learned().length > 1) { var l = learned(); groups.push(g('run', l, [], { everyone: false })); note = 'Friday run: everything we have blocked so far (Scenes ' + T.sceneById(l[0]).num + '–' + T.sceneById(l[l.length - 1]).num + ').'; }
        else if (parse(d).getDay() === 3 && reviewScene()) {      // Wednesdays: go back over the hardest things learned so far
          var rs = reviewScene(), rv = reviewSong('v'), rd = reviewSong('d');
          groups.push(g('acting', [rs.id])); rs.done++; rs.last = i;
          if (rv) { groups.push(g('vocals', [], [rv.id], { only: rv.big ? 'principals' : '' })); rv.vdone++; rv.vlast = i; }
          if (rd) { groups.push(g('dance', [], [rd.id], { only: 'chorus' })); rd.ddone++; rd.dlast = i; }
          note = 'Review day (the hardest so far): Scene ' + rs.num + (rv ? ' · Vocals: “' + rv.title + '”' : '') + (rd ? ' · Dance: “' + rd.title + '”' : '') + '.';
        }
        else {
          var sc = nextScene(i); groups.push(g('acting', [sc.id])); sc.done++; sc.last = i;
          var v = pickSong('v', sc.chars, i); if (v) { groups.push(g('vocals', [], [v.id], { only: v.big ? 'principals' : '' })); v.vdone++; v.vlast = i; }      // the chorus learns big numbers in the dance group, so they still get crew days
          var dn = pickSong('d', sc.chars.concat(v ? v.chars : []), i); if (dn) { groups.push(g('dance', [], [dn.id], { only: 'chorus' })); dn.ddone++; dn.dlast = i; }
          note = 'Acting: Scene ' + sc.num + (v ? ' · Vocals: “' + v.title + '”' : '') + (dn ? ' · Dance: “' + dn.title + '” (chorus)' : '') + '.';
          weekWork.push('the Scene ' + sc.num + ' actors'); if (dn) weekWork.push('the “' + dn.title + '” dancers'); if (v) weekWork.push('the “' + v.title + '” singers');
        }
      } else {      // clean what was rehearsed longest ago; Wednesdays run the first half, Fridays the second half
        var wd = parse(d).getDay();
        if (wd === 3 || wd === 5) { var part = wd === 3 ? sceneIds.slice(0, split) : sceneIds.slice(split); groups.push(g('run', part)); note = (wd === 3 ? 'Run the first half' : 'Run the second half') + ' (Scenes ' + T.sceneById(part[0]).num + '–' + T.sceneById(part[part.length - 1]).num + ').'; }
        else {
          var old = U.scenes.slice().sort(function (a, b) { return a.last - b.last; })[0]; groups.push(g('acting', [old.id], [], { where: where.acting })); old.done++; old.last = i;
          var dv = pickSong('d', old.chars, i); if (dv) { groups.push(g('dance', [], [dv.id], { only: 'chorus' })); dv.ddone++; dv.dlast = i; }
          var vv = pickSong('v', old.chars.concat(dv ? dv.chars : []), i); if (vv) { groups.push(g('vocals', [], [vv.id], { only: vv.big ? 'principals' : '' })); vv.vdone++; vv.vlast = i; }
          note = 'Clean-up: Scene ' + old.num + (dv ? ' · Dance: “' + dv.title + '”' : '') + (vv ? ' · Vocals: “' + vv.title + '”' : '') + '.';
        }
      }
      if (!p.days[d] && groups.length) { p.days[d] = { groups: groups, assign: {}, tasks: {}, notes: note, gen: true }; made++; }
    });
    var runPlan = [['Run the first half, with props', sceneIds.slice(0, split)], ['Run the second half, with props', sceneIds.slice(split)], ['Full run in costume', sceneIds], ['Full run: costumes, props, mics', sceneIds], ['Full run, then notes', sceneIds]];
    L.runs.forEach(function (d, i) { if (!p.days[d]) { var r = runPlan[i] || runPlan[4]; p.days[d] = { groups: [g('run', r[1], [], { everyone: true })], assign: {}, tasks: {}, notes: 'Runs week: ' + r[0] + '.', gen: true }; made++; } });
    if (L.show.length && !p.days[showMon] && T.buildShowWeek) { T.buildShowWeek(showMon, [], X().addDays(showMon, 4), '19:00'); made += 4; }
    return made;
  }
  T.makeSemesterPlan = makePlan;

  /* ---------- the two-block plan (Colleen, 2026-10-24): every class day in two blocks, every track placed in every block ---------- */
  var minutesOf = function (d) { var t = P().term; if ((t.sip || []).indexOf(d) >= 0) return t.sipMin || 20; if (t.lateWd !== undefined && t.lateWd !== '' && parse(d).getDay() === +t.lateWd) return t.lateMin || 35; return t.minutes || 48; };
  T.periodMinutes = minutesOf;
  function makePlan2(showMon, withAuditions, movieDays) {
    var RP = T.RehearsalPlan; if (!RP) return makePlan(showMon, withAuditions, movieDays);
    var p = P(), L = layout(showMon, withAuditions, movieDays), made = 0, O = T.O();
    if (withAuditions && T.applyStarter) made += T.applyStarter(movieDays);
    if (!L.work.length) return made;
    var work = L.work, n = work.length, at = function (f) { return work[Math.min(n - 1, Math.round(n * f))]; };
    var fixed = {};
    /* days already planned by hand (and field trips) stay as they are; the planner works around them */
    work.forEach(function (d) {
      var r = p.days[d]; if (!r || r.gen) return;
      fixed[d] = r.groups.some(function (g) { return g.focus === 'trip'; }) ? { kind: 'trip', title: 'Field trip', mark: 'M', crewAll: true } : { kind: 'kept', title: r.notes || 'Planned by hand', mark: 'R' };
    });
    /* the first rehearsal week: the whole Company reads each act together (the first and third rehearsal days) */
    var split = T.showSplit ? T.showSplit() : Math.ceil(O.scenes.length / 2), ids = O.scenes.map(function (x) { return x.id; });
    var act1 = ids.slice(0, typeof split === 'number' ? split : Math.max(1, ids.indexOf(split))), act2 = ids.slice(act1.length);
    if (!fixed[work[0]]) fixed[work[0]] = { kind: 'tableread', title: 'Table read, Act 1 (the whole Company)', scenes: act1 };
    if (work[2] && !fixed[work[2]]) fixed[work[2]] = { kind: 'tableread', title: 'Table read, Act 2 (the whole Company)', scenes: act2 };
    var trip = work.find(function (d) { return fixed[d] && fixed[d].kind === 'trip'; });
    var plus = function (d, k) { return X().addDays(d, k); };
    var windows = { sizes: [work[Math.min(n - 1, 15)], work[Math.min(n - 1, 19)]] };
    if (trip) { windows.research = [plus(trip, -23), plus(trip, -12)]; windows.list = [plus(trip, -9), plus(trip, -5)]; windows.photos = [plus(trip, 1), plus(trip, 7)]; }
    var credit = withAuditions ? ['1', '40', '41'].map(function (num) { var so = O.songs.find(function (x) { return x.num === num; }); return so ? [{ id: so.id + 'V', done: 'learn' }, { id: so.id + 'D', done: 'learn' }] : []; }).reduce(function (a, b) { return a.concat(b); }, []) : [];
    var R = RP.plan(O, { days: work.map(function (d) { return { date: d, min: minutesOf(d) }; }), fixed: fixed, credit: credit, windows: windows, actSplit: act2[0],
      deadlines: { scene: at(0.6), vocals: at(0.45), dance: at(0.8) } });
    var KF = { A: 'acting', V: 'vocals', D: 'dance', R: 'run' }, all = O.characters.map(function (c) { return c.id; });
    R.days.forEach(function (D) {
      if (p.days[D.date] && !p.days[D.date].gen) return;      // keep what the teacher planned
      if (!D.rooms || (!D.rooms.length && !(D.groupC || []).length)) return;
      var groups = D.rooms.map(function (r) {
        var pc = R.pieces[r.piece], sc = [], so = [];
        if (pc) { if (pc.type === 'scene') sc = [pc.id]; else so = [pc.song.id]; }
        if (r.tableread) sc = r.tableread.slice();
        if (D.run && r.kind === 'R') D.run.pieces.forEach(function (id) { var q = R.pieces[id]; if (!q) return; if (q.type === 'scene') sc.push(q.id); else if (so.indexOf(q.song.id) < 0) so.push(q.song.id); });
        return { id: uid('g'), focus: KF[r.kind] || 'run', scenes: sc, songs: so, everyone: r.people.length >= all.length - 1, chars: r.people.slice(), block: r.block || 0, only: pc && pc.part === 'p' ? 'principals' : pc && pc.part === 'c' ? 'chorus' : '',
          where: r.room === 'AB' ? 'Both teachers together' : 'Room ' + r.room + ' (Teacher ' + r.room + ')', note: r.what };
      }).concat((D.groupC || []).map(function (g) {
        return { id: uid('g'), focus: 'card', scenes: [], songs: [], everyone: false, chars: g.people.slice(), block: g.block || 0, only: '', where: 'Group C',
          card: Object.assign({ kind: g.task, each: g.each || {} }, RP.CARDS[g.task] || {}) };
      }));
      p.days[D.date] = { groups: groups, assign: {}, tasks: {}, notes: (D.theme ? D.theme + ': ' : '') + (D.title || D.rooms.filter(function (r) { return r.piece; }).map(function (r) { return r.what; }).join(' · ')),
        gen: true, blocks: !!(D.blocks && D.blocks.length > 1), min: D.min, theme: D.theme || '', sizesCall: D.sizesCall || undefined };
      made++;
    });
    /* the last five class days before show week (Colleen's order): Act 1 stumble-through, Act 2 stumble-through, Act 1 dress, Act 2 dress, full dress */
    var g = function (focus, sc) { return { id: uid('g'), focus: focus, scenes: sc, songs: [], everyone: true, where: p.venueName || 'Stage', only: '' }; };
    var finals = [['run', act1, 'Act 1 stumble-through: no stopping, scripts allowed'], ['run', act2, 'Act 2 stumble-through: no stopping, scripts allowed'], ['dress', act1, 'Act 1 dress rehearsal'], ['dress', act2, 'Act 2 dress rehearsal'], ['dress', ids, 'Full dress rehearsal (needs time after school)']];
    L.runs.forEach(function (d, i) { if (p.days[d]) return; var f = finals[i] || finals[4]; p.days[d] = { groups: [g(f[0], f[1])], assign: {}, tasks: {}, notes: f[2] + '.', gen: true }; made++; });
    if (L.show.length && !p.days[showMon] && T.buildShowWeek) { T.buildShowWeek(showMon, [], X().addDays(showMon, 4), '19:00'); made += 4; }
    return made;
  }
  T.makeSemesterPlan2 = makePlan2;

  T.seasonView = function () {
    var p = P(), t = p.term;
    if (!t.first) return '<div class="card"><p>' + sym('📅') + 'Set the first and last day of class first (Calendar & crew).</p><button class="btn primary" data-goto="setup">Go to Calendar & crew</button></div>';
    var mon = p.showMonday || defaultShowMonday(), withAud = !(T.show.casting && T.show.casting.posted), movie = p.movieDays === undefined ? 3 : p.movieDays, L = layout(mon, withAud, movie);
    var order = units(); order.songs.sort(function (a, b) { return b.diff - a.diff; }); order.scenes.sort(function (a, b) { return b.diff - a.diff; });
    var gen = Object.keys(p.days).filter(function (d) { return p.days[d].gen; }).length;
    return '<div class="card"><h3>' + sym('🗓️') + 'Plan the semester</h3><p class="muted">Fills every empty class day from your school calendar, for every track, before anyone is cast. You can change any day after; days you already planned stay as they are.</p>' +
      '<label class="f">Monday of show week<input type="date" id="smon" value="' + mon + '"></label>' +
      '<label class="switch"><span>Start with the two audition weeks</span><input type="checkbox" id="saud"' + (withAud ? ' checked' : '') + '></label>' +
      (T.RehearsalPlan ? '<label class="f">Group C (students not in a teacher room) is led by<select id="sstaff"><option value="two"' + (p.staffing !== 'mentors' ? ' selected' : '') + '>Two teachers only: task cards students already know, in sight of an adult</option><option value="mentors"' + (p.staffing === 'mentors' ? ' selected' : '') + '>Trained Company Mentors</option></select></label>' +
        '<p class="muted small">Each day runs in two blocks (or one on short days): two teacher rooms and Group C, every track placed in every block, the weekday themes (Monday Character, Tuesday Music, Wednesday Scenes, Thursday Dance, Friday Perform), no track doing the same kind of work three days in a row, and a weekly crew day for all but the leads. Period lengths come from Calendar & crew.</p>' : '') +
      '<label class="f">🎬 Watch the movie: class periods, right after day one <span class="muted small">(about 98 minutes; 0 to skip)</span><input id="smov" inputmode="numeric" value="' + movie + '" style="width:90px"></label>' +
      '<details style="margin:6px 0"><summary class="btn quiet small">Teaching order: hardest first</summary><p class="muted small">Taught in this order, and the hardest ones come back on Wednesdays as easier things are added.</p><p class="small"><b>Songs:</b> ' + order.songs.map(function (x) { return esc(x.title); }).join(' → ') + '</p><p class="small"><b>Scenes:</b> ' + order.scenes.map(function (x) { return 'Scene ' + x.num; }).join(' → ') + '</p></details>' +
      '<table class="tbl" style="margin:8px 0"><tbody>' +
      '<tr><td>Audition weeks</td><td>' + L.auditions.length + ' days</td><td class="muted small">' + (L.auditions[0] ? esc(X().dayName(L.auditions[0], true)) + ' – ' + esc(X().dayName(L.auditions[L.auditions.length - 1], true)) : '') + '</td></tr>' +
      '<tr><td>Rehearsals (music first, then scenes with vocals and dance at the same time)</td><td>' + L.work.length + ' days</td><td class="muted small">' + (L.work[0] ? esc(X().dayName(L.work[0], true)) + ' – ' + esc(X().dayName(L.work[L.work.length - 1], true)) : '') + '</td></tr>' +
      '<tr><td>Runs week</td><td>' + L.runs.length + ' days</td><td class="muted small">' + (L.runs[0] ? esc(X().dayName(L.runs[0], true)) + ' – ' + esc(X().dayName(L.runs[L.runs.length - 1], true)) : '') + '</td></tr>' +
      '<tr><td>Show week</td><td>' + L.show.length + ' days</td><td class="muted small">' + (L.show[0] ? esc(X().dayName(L.show[0], true)) + ' – ' + esc(X().dayName(L.show[L.show.length - 1], true)) : '') + '</td></tr></tbody></table>' +
      '<div class="row"><button class="btn primary" id="splan" data-save>Plan the semester</button>' + (gen ? '<button class="btn quiet" id="sclear" data-save>Clear the ' + gen + ' planned days</button>' : '') + '</div>' +
      '<p class="muted small">Then look at <b>Tracks</b> for each character’s calendar, and <b>Stage time</b> to see the balance. Weeks still need “Show this week to Company members”.</p></div>';
  };
  T.wireSeason = function (redraw) {
    var p = P(), b = document.getElementById('splan'); if (!b) return;
    document.getElementById('smon').onchange = function (e) { p.showMonday = e.target.value; T.saveShow('Saved').then(redraw); };
    var stf = document.getElementById('sstaff'); if (stf) stf.onchange = function () { p.staffing = stf.value; T.saveShow('Saved: task cards now show the ' + (p.staffing === 'mentors' ? 'Mentor' : 'two-teacher') + ' version'); };
    b.onclick = function () {
      var mon = document.getElementById('smon').value; if (!mon || parse(mon).getDay() !== 1) { T.toast('Pick the Monday of show week.'); return; }
      p.showMonday = mon;
      p.movieDays = Math.max(0, Math.min(6, +document.getElementById('smov').value || 0));
      var st = document.getElementById('sstaff'); if (st) p.staffing = st.value;
      var n = (T.RehearsalPlan ? makePlan2 : makePlan)(mon, document.getElementById('saud').checked, p.movieDays);
      T.saveShow(n + ' days planned').then(redraw);
    };
    var c = document.getElementById('sclear'); if (c) c.onclick = function () { if (!confirm('Clear every day the semester plan made? Days you planned yourself stay.')) return; Object.keys(p.days).forEach(function (d) { if (p.days[d].gen) delete p.days[d]; }); T.saveShow('Cleared').then(redraw); };
  };

  /* ---------- a calendar for every track (by character) ---------- */
  function jobFor(c, d) {
    var r = X().plan(d); if (!r || !r.groups.length) return null;
    var g = r.groups.find(function (x) { if (x.half) return false; if (x.focus === 'trip') return x.everyone; if (x.everyone && !x.only) return true; return X().groupChars(x).indexOf(c) >= 0; });
    if (!g) { var h = r.groups.find(function (x) { return x.half; }); if (h) return { focus: 'vocals', text: 'Half the class: vocal selections (the other half: ' + X().groupName(r.groups[1] || h) + ')' }; return null; }
    return { focus: g.focus, text: X().groupName(g) + (g.where ? ' · ' + g.where : '') };
  }
  T.trackJob = jobFor;
  var track = null;
  T.tracksView = function () {
    var O = T.O(), days = X().classDays();
    if (!days.length) return '<div class="card"><p>Set the school calendar first (Calendar & crew).</p></div>';
    if (!track) track = O.characters[0].id;
    var stats = O.characters.map(function (c) {
      var n = { acting: 0, vocals: 0, dance: 0, run: 0, dress: 0, show: 0, other: 0, called: 0 }, gap = 0, cur = 0, started = false;
      days.forEach(function (d) { var j = jobFor(c.id, d); if (j && ['crew', 'trip', 'photos'].indexOf(j.focus) < 0) { n.called++; n[n[j.focus] !== undefined ? j.focus : 'other']++; started = true; cur = 0; } else if (started && X().plan(d)) { cur++; gap = Math.max(gap, cur); } });
      return { c: c, n: n, gap: gap };
    });
    var me = stats.find(function (x) { return x.c.id === track; });
    var weeks = {}; days.forEach(function (d) { (weeks[X().monday(d)] = weeks[X().monday(d)] || []).push(d); });
    return '<div class="card row noprint"><label class="f grow" style="margin:0">Track<select id="trk">' + O.groups.map(function (gr) {
        var list = O.characters.filter(function (c) { return c.group === gr.id; }); if (!list.length) return '';
        return '<optgroup label="' + esc(gr.name) + '">' + list.map(function (c) { return '<option value="' + c.id + '"' + (c.id === track ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></label><button class="btn small" onclick="print()">' + icon('print') + 'Print this calendar</button>' + (T.Pages && T.Pages.ready() ? '<a class="btn small" href="#/teacher/print/' + track + '">' + icon('print') + 'Highlighted script for this track</a>' : '') + '</div>' +
      '<div class="card"><h2>' + T.chip(track) + ' rehearsal calendar</h2><p>' + me.n.called + ' days called · 🗣️ ' + me.n.acting + ' acting · 🎵 ' + me.n.vocals + ' vocals · 💃 ' + me.n.dance + ' dance · 🔁 ' + (me.n.run + me.n.dress) + ' runs' +
      (me.gap >= 8 ? ' · <span class="err">' + me.gap + ' class days in a row without a call</span>' : '') + '</p><p class="muted small">Days without a call: crew, or practice in the app.</p>' +
      Object.keys(weeks).map(function (w) {
        return '<h3 style="margin:14px 0 4px">Week of ' + esc(X().dayName(w, true)) + (P().shown.indexOf(w) >= 0 ? '' : ' <span class="muted small">(not shown to Company members yet)</span>') + '</h3>' + weeks[w].map(function (d) {
          var j = jobFor(track, d), r = X().plan(d);
          return '<div class="switch" style="min-height:40px"><span style="min-width:120px"><b>' + esc(X().dayName(d, true)) + '</b></span><span class="grow">' + (j ? sym(X().focus(j.focus)[1]) + esc(j.text) : r ? '<span class="muted">' + sym('🛠️') + 'Crew or practice</span>' : '<span class="muted">Not planned yet</span>') + '</span></div>';
        }).join('');
      }).join('') + '</div>' +
      '<div class="card noprint"><h3>Every track at a glance</h3><p class="muted small">Days called, and the longest stretch of class days without a call (long stretches mean a track may forget its part).</p><table class="tbl"><thead><tr><th>Track</th><th>Called</th><th>🗣️</th><th>🎵</th><th>💃</th><th>🔁</th><th>Longest gap</th></tr></thead><tbody>' +
      stats.map(function (x) { return '<tr style="cursor:pointer" data-trk="' + x.c.id + '"><td>' + T.chip(x.c.id) + '</td><td>' + x.n.called + '</td><td>' + x.n.acting + '</td><td>' + x.n.vocals + '</td><td>' + x.n.dance + '</td><td>' + (x.n.run + x.n.dress) + '</td><td' + (x.gap >= 8 ? ' class="err"' : '') + '>' + x.gap + '</td></tr>'; }).join('') + '</tbody></table></div>';
  };
  T.wireTracks = function (redraw) {
    var s = document.getElementById('trk'); if (s) s.onchange = function () { track = s.value; redraw(); };
    app.querySelectorAll('[data-trk]').forEach(function (r) { r.onclick = function () { track = r.dataset.trk; redraw(); window.scrollTo(0, 0); }; });
  };

  /* ---------- students: my rehearsal calendar (only the weeks shown to students) ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.calendar = function () {
    T.setBar('My calendar', '#/today');
    var me = T.me && (T.show.cast || []).find(function (a) { return a.id === T.me.id; }), p = P(), t = X().today();
    /* everyone's day (Colleen: parents can "toggle on a full view of things like the calendar so they can see everything happening on a day") */
    var canAll = !!(T.pass && T.pass.fullCal), all = canAll && (T.ls('calAll') || !me);
    if (T.pass) T.setBar('Calendar', '#/home');
    if (!me && !canAll) { app.innerHTML = '<div class="card"><p>Your teacher has not put you on the class list yet.</p></div>'; return; }
    var days = X().classDays().filter(function (d) { return d >= t && p.shown.indexOf(X().monday(d)) >= 0; });
    var sw = canAll && me ? '<label class="switch card"><span><b>Show everyone</b><br><span class="muted small">Everything happening each day, not just ' + esc(T.me.name) + '’s part</span></span><input type="checkbox" id="calall"' + (all ? ' checked' : '') + '></label>' : '';
    app.innerHTML = '<h2>' + sym('🗓️') + (T.pass ? 'Calendar' : 'My calendar') + '</h2>' + sw + (!days.length ? '<div class="card"><p>Your teacher has not shown the next weeks yet.</p></div>' :
      all ? days.map(function (d) { return T.dayBoard(d, T.pass.who === 'parent'); }).join('') :
      days.map(function (d) { var j = T.prodTask(me, d); return '<div class="card row" style="margin-bottom:8px"><b style="min-width:150px">' + esc(X().dayName(d)) + '</b><span class="grow">' + sym(j.icon) + esc(j.text) + '</span>' + (j.href && !T.pass ? '<a class="btn small" href="' + j.href + '">Start</a>' : '') + '</div>'; }).join(''));
    var c = document.getElementById('calall'); if (c) c.onchange = function () { T.ls('calAll', c.checked); T.studentPages.calendar(); };
  };

  /* ---------- doubling: two roles for one student ---------- */
  function doubling() {
    var O = T.O(), ms = O.moments;
    var lines = {}; if (T.show.script) T.show.script.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'line') T.labelChars(it.who).forEach(function (c) { if (c !== '*') lines[c] = (lines[c] || 0) + 1; }); }); });
    var named = function (m, c) { return m.on !== '*' && m.on.indexOf(c) >= 0 && (m.out || []).indexOf(c) < 0; };
    var at = {}; O.characters.forEach(function (c) { at[c.id] = ms.map(function (m, i) { return named(m, c.id) ? i : -1; }).filter(function (i) { return i >= 0; }); });
    var cand = O.characters.filter(function (c) { return ['friends', 'adults', 'featured'].indexOf(c.group) >= 0 && at[c.id].length; });
    var pairs = [];
    cand.forEach(function (a, i) {
      cand.slice(i + 1).forEach(function (b) {
        if (at[a.id].some(function (k) { return at[b.id].indexOf(k) >= 0; })) return;      // on stage together
        var gap = 99; at[a.id].forEach(function (x) { at[b.id].forEach(function (y) { gap = Math.min(gap, Math.abs(x - y)); }); });
        var mins = 99; at[a.id].forEach(function (x) { at[b.id].forEach(function (y) { var lo = Math.min(x, y), hi = Math.max(x, y), s = 0; for (var k = lo + 1; k < hi; k++) s += ms[k].song ? T.songMinutes(T.songById(ms[k].song)) : (ms[k].minutes || 1); mins = Math.min(mins, s); }); });
        pairs.push({ a: a, b: b, la: lines[a.id] || 0, lb: lines[b.id] || 0, gap: gap, mins: mins });
      });
    });
    pairs.sort(function (x, y) { return (x.gap < 2) - (y.gap < 2) || (y.la + y.lb) - (x.la + x.lb); });      // medium roles first: those are the doubles that free up a student
    /* a featured role that is only on stage while an ensemble group is: a member of that group can play it */
    var fromGroup = [];
    O.characters.filter(function (c) { return c.group === 'featured' && at[c.id].length; }).forEach(function (c) {
      O.characters.filter(function (gr) { return gr.group === 'ensemble'; }).forEach(function (gr) { if (at[c.id].every(function (k) { return ms[k].on === '*' || named(ms[k], gr.id); })) fromGroup.push({ c: c, g: gr }); });      // the group is named in the scene, not just joining a big number
    });
    return { pairs: pairs, fromGroup: fromGroup, lines: lines };
  }
  T.doublingView = function () {
    var D = doubling(), O = T.O(), roles = O.characters.filter(function (c) { return ['leads', 'friends', 'adults', 'featured'].indexOf(c.group) >= 0; }).length;
    var kids = (T.show.cast || []).filter(function (a) { return !a.guest; }).length, short = roles - kids;
    var best = D.pairs.filter(function (x) { return x.gap >= 2; }).slice(0, 12), tight = D.pairs.filter(function (x) { return x.gap === 1; }).slice(0, 6);
    var row = function (x) { return '<tr><td>' + T.chip(x.a.id) + ' <span class="muted small">' + x.la + ' lines</span></td><td>' + T.chip(x.b.id) + ' <span class="muted small">' + x.lb + ' lines</span></td><td>' + (x.mins >= 99 ? '—' : 'about ' + Math.max(1, Math.round(x.mins)) + ' min') + '</td></tr>'; };
    var seen = {}, fg = D.fromGroup.filter(function (x) { if (seen[x.c.id]) return false; seen[x.c.id] = 1; return true; });
    return '<div class="card"><h3>' + sym('🎭') + 'Two roles, one Company member</h3><p>The show has <b>' + roles + ' named roles</b> (plus the groups)' + (kids ? ' and you have <b>' + kids + ' Company members</b>' + (short > 0 ? ': <b>' + short + ' roles</b> would need to be doubled, or given to Company members who are also in a group.' : '.') : '. Paste your class list to compare.') + '</p>' +
      '<p class="muted small">Pairs below are never on stage at the same time (the whole-cast numbers, where a doubled Company member just appears once, are left out). The time is the shortest break between them, for a costume change. Leads are left out on purpose.</p></div>' +
      (fg.length ? '<div class="card"><h3>Featured roles a group member can play</h3><p class="muted small">These are only on stage when their group is, so one Company member in the group plays the role for that moment.</p>' + fg.map(function (x) { return '<p>' + T.chip(x.c.id) + ' <span class="muted small">' + (D.lines[x.c.id] || 0) + ' lines</span> → a member of ' + T.chip(x.g.id) + '</p>'; }).join('') + '</div>' : '') +
      '<div class="card"><h3>Good pairs (time for a costume change)</h3>' + (best.length ? '<table class="tbl"><thead><tr><th>Role</th><th>and</th><th>Shortest break</th></tr></thead><tbody>' + best.map(row).join('') + '</tbody></table>' : '<p class="muted">None found.</p>') + '</div>' +
      (tight.length ? '<div class="card"><h3>Possible with a quick change</h3><p class="muted small">One goes off right before the other comes on.</p><table class="tbl"><tbody>' + tight.map(row).join('') + '</tbody></table></div>' : '');
  };
  T.doubling = doubling;
})();
