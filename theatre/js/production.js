/* asl.cool/theatre Production. The class meets once every school day (one 45-minute period), and every student has a job every day
   (Colleen, 2026-10-21: "every student needs to have something to do on each calendar day of the school year"):
   - On stage, in one of the day's groups: Acting (scenes), Vocals (songs), Dance (songs), Run-through… Students go to the first group whose scenes or songs
     they are in, so they spend as much time on stage as possible; big group numbers take the whole ensemble and the small roles (see onFor in app.js);
   - Crew: a station the teacher assigns (Props, Set painting…). Every student except the biggest leads has a home crew and at least one crew day
     a week (Colleen: "at least 1 day a week, they're working on the set or costumes or props"); the app picks a day they are not needed on stage;
   - Several rehearsals run at once (Colleen: "a duet can be rehearsing while a chorus is practicing that song and dance while others who aren't in this scene
     are working on their crew position"): a song group can be split into principals (who sing) and chorus (the ensemble and small roles, who dance),
     and anyone not in a group that day goes to their home crew;
   - Practice in the app: for those with no crew (the leads), chosen for them (lines for a scene coming up, a song with the guide vocals…), so nobody is ever without a job;
   - or the teacher's own words.
   Weeks are shown to students one at a time ("Show this week to students"), so the teacher can change plans until then.
   Guests (cast.guest: performers who are not in the class, e.g. dancers recruited for tech week) have no daily job, crew or class attendance: they are in a group
   only on Run-through, Tech, Dress and Show days, or when the teacher calls them by hand.
   T.show.production = { term: { first, last, off [dates] }, shown [Monday dates], stations [{ id, name, desc }],
     days { date: { groups [{ id, focus, scenes, songs, everyone, where }], assign { actor: 'g:<group>' | 'st:<station>' | 'app' | 'custom' }, tasks { actor: text }, notes } },
     bookings [{ id, date, text }] (other events in our theatre: concerts, other shows; Colleen: watch for the set being in someone's way, or theirs in ours), venueName,
     crewHome { actor: station }, crewExempt [actor ids] (unset = actors who play a lead),
     conflicts [{ id, actor, date, why, from }], attendance { date: { actor: here|late|absent|excused } } }
   A conflict is a class day the student will be away; students send them from Today as encrypted notes (POST /theatre/api/notes). */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var FOCUS = [['acting', '🗣️', 'Acting'], ['vocals', '🎵', 'Vocals'], ['dance', '💃', 'Dance'], ['run', '🔁', 'Run-through'], ['tech', '💡', 'Tech'], ['dress', '👗', 'Dress rehearsal'], ['show', '🌟', 'Show'], ['trip', '🚌', 'Field trip'], ['photos', '📸', 'Costume and prop photos'], ['crew', '🛠️', 'Crew time'], ['share', '🎤', 'Show and tell'], ['watch', '🎬', 'Watch the movie']];
  var MARKS = [['here', '✅', 'Here'], ['late', '⏰', 'Late'], ['absent', '❌', 'Absent'], ['excused', '📝', 'Excused']];
  var focus = function (k) { return FOCUS.find(function (x) { return x[0] === k; }) || FOCUS[0]; };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  function P() {
    var p = T.show.production = T.show.production || {};
    p.term = p.term || { first: '', last: '', off: [] }; p.shown = p.shown || []; p.days = p.days || {}; p.stations = p.stations || [];
    p.conflicts = p.conflicts || []; p.attendance = p.attendance || {}; p.crewHome = p.crewHome || {};
    return p;
  }
  T.production = P;

  /* ---------- dates ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
  var addDays = function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  var today = function () { return ymd(new Date()); };
  var monday = function (s) { var d = parse(s), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return ymd(d); };
  function dayName(s, short) { return parse(s).toLocaleDateString('en-US', short ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric' }); }
  T.prodDay = dayName;
  /* class days: Monday to Friday from the first day to the last, minus the days off */
  function isClassDay(s) { var t = P().term, w = parse(s).getDay(); return !!t.first && s >= t.first && s <= t.last && w > 0 && w < 6 && t.off.indexOf(s) < 0; }
  function classDays() { var t = P().term, out = []; if (!t.first || !t.last) return out; for (var s = t.first; s <= t.last && out.length < 400; s = addDays(s, 1)) if (isClassDay(s)) out.push(s); return out; }
  function weekDays(mon) { var out = []; for (var i = 0; i < 5; i++) out.push(addDays(mon, i)); return out; }
  var shown = function (s) { return P().shown.indexOf(monday(s)) >= 0; };

  /* no-school dates pasted from a district calendar: one per line (or comma), ranges with a dash or "to".
     2026-11-26 · 11/26/2026 · 11/26/26 · 11/26 · Nov 26, 2026 · Thursday, November 26th · 12/21/2026 - 1/1/2027 · Dec 21 – Jan 1 · Dec 21-23 */
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function oneDate(txt, near) {
    var s = txt.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1'), y, m, d, mm;
    if ((mm = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
    else if ((mm = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) { m = +mm[1]; d = +mm[2]; y = mm[3] ? +mm[3] : null; }
    else if ((mm = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/))) { m = MONTHS.indexOf(mm[1]) + 1; d = +mm[2]; y = mm[3] ? +mm[3] : null; }
    else return null;
    if (y !== null && y < 100) y += 2000;
    if (y === null) {      // no year: the school year that starts at the first day of class (or a month before it)
      var base = parse(near || today()); base.setDate(base.getDate() - 31);
      y = new Date(base.getFullYear(), m - 1, d) >= base ? base.getFullYear() : base.getFullYear() + 1;
    }
    var dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 && dt.getDate() === d ? ymd(dt) : null;
  }
  function pasteDates(text, near) {
    var out = [], bad = [];
    text.split(/\n|;|,\s*(?=\d{1,2}\/)/).forEach(function (line) {
      line = line.replace(/\([^)]*\)/g, ' ').trim(); if (!line) return;
      var parts = line.split(/\s+(?:-|–|—|to|through|thru)\s+|\s*[–—]\s*|(?<=\d)-(?=\d{1,2}\/)|(?<=\d)-(?=[a-z])/i);
      var short = parts.length === 1 && /[a-z]{3}/i.test(line) && line.match(/^(.*?\d{1,2})-(\d{1,2})\s*$/);      // "Dec 21-23"
      if (short) parts = [short[1], short[2]];
      var a = oneDate(parts[0], near), b = parts[1] ? oneDate(parts[1], near) : null;
      if (parts[1] && a && !b && /^\s*\d{1,2}\s*$/.test(parts[1])) b = a.slice(0, 8) + pad(+parts[1]);
      if (!a) { if (/\d/.test(line)) bad.push(line); return; }
      if (b && b < a) { var t = a; a = b; b = t; }
      for (var s = a; s <= (b || a) && out.length < 400; s = addDays(s, 1)) if (out.indexOf(s) < 0) out.push(s);
    });
    return { dates: out.sort(), bad: bad };
  }
  T.pasteDates = pasteDates;
  /* "12/8/2026 Jazz Band Concert 7:30pm" -> { date, text }; ranges ("Dec 10 - Dec 12 One-Acts") give one booking per day */
  var DATE_RE = /(\d{4}-\d{1,2}-\d{1,2}|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i;
  function pasteBookings(text, near) {
    var out = [], bad = [];
    text.split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      var m = line.match(DATE_RE); if (!m) { bad.push(line); return; }
      var rest = line.slice(m.index + m[0].length), m2 = rest.match(new RegExp('^\\s*(?:-|–|—|to|through)\\s*' + DATE_RE.source, 'i'));
      var range = m[0] + (m2 ? ' - ' + m2[1] : ''), what = (line.slice(0, m.index) + ' ' + (m2 ? rest.slice(m2[0].length) : rest)).replace(/^[\s:,–—-]+|[\s:,–—-]+$/g, '').replace(/\s+/g, ' ');
      var r = pasteDates(range, near);
      if (!r.dates.length) { bad.push(line); return; }
      r.dates.forEach(function (d) { out.push({ date: d, text: what || 'Booked' }); });
    });
    return { list: out, bad: bad };
  }
  T.pasteBookings = pasteBookings;
  function bookingsOn(s) { return (P().bookings || []).filter(function (b) { return b.date === s; }); }
  var bookingLine = function (s, cls) { var l = bookingsOn(s); return l.length ? '<div class="' + (cls || 'small') + '" style="color:var(--warn)">⚠️ ' + esc(P().venueName || 'In our theatre') + ': ' + l.map(function (b) { return esc(b.text); }).join(' · ') + '</div>' : ''; };

  /* ---------- who does what ---------- */
  function cast() { return (T.show.cast || []).filter(function (a) { a.chars = a.chars || []; return a.name; }); }      // students with no role yet are here too
  function actor(id) { return (T.show.cast || []).find(function (a) { return a.id === id; }); }
  function plan(s) { return P().days[s]; }
  function newGroup(f) { return { id: uid('g'), focus: f || 'acting', scenes: [], songs: [], everyone: false, where: '', only: '' }; }
  var ONLY = { '': 'Everyone in it', principals: 'Principals only', chorus: 'Chorus only (ensemble and small roles)' };
  function blank() { return { groups: [], assign: {}, tasks: {}, notes: '' }; }
  /* the characters a group needs: everyone on stage in its scenes and songs (big numbers bring the ensemble and small roles) */
  function groupChars(g) {
    var all = T.O().characters.map(function (c) { return c.id; });
    if (g.everyone) return all;
    var ms = T.O().moments.filter(function (m) { return (g.scenes.indexOf(m.scene) >= 0 && !(g.focus === 'acting' && m.song)) || (m.song && g.songs.indexOf(m.song) >= 0); });      // an acting rehearsal of a scene calls its spoken parts, not its songs
    return all.filter(function (c) {
      var ch = T.charById(c), chorus = T.smallRole(ch) || (ch && ch.group === 'helpers');      // peer models go with the chorus: they model the dance
      if (g.only && (g.only === 'chorus') !== chorus) return false;
      return ms.some(function (m) { return T.onFor(m, c); });
    });
  }
  function groupWhat(g) {
    var bits = g.scenes.map(function (id) { var s = T.sceneById(id); return s ? 'Scene ' + s.num : ''; })
      .concat(g.songs.map(function (id) { var s = T.songById(id); return s ? '“' + s.title + '”' : ''; })).filter(Boolean);
    return g.everyone && !bits.length ? 'whole cast' : bits.join(', ');
  }
  function groupName(g) { if (g.callbacks) return 'Callbacks'; return focus(g.focus)[2] + (groupWhat(g) ? ': ' + groupWhat(g) : '') + (g.only ? ' (' + (g.only === 'chorus' ? 'chorus' : 'principals') + ')' : ''); }
  function away(a, s) { return P().conflicts.find(function (c) { return c.actor === a.id && c.date === s; }); }
  /* the app's practice ideas for one actor, most useful first (what is planned in the next two weeks), lines and songs taking turns */
  function practiceList(a, s) {
    var chars = a.chars, days = classDays().filter(function (d) { return d > s; }).slice(0, 10);
    var soonSc = {}, soonSo = {};
    days.forEach(function (d) { var r = plan(d); if (r) r.groups.forEach(function (g) { g.scenes.forEach(function (x) { soonSc[x] = 1; }); g.songs.forEach(function (x) { soonSo[x] = 1; }); }); });
    var lines = [], songs = [];
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      var n = src.items.filter(function (it) { return it.type === 'line' && T.isMine(it.who, sc, chars); }).length;
      if (n) lines.push({ soon: !!soonSc[sc.id], t: { type: 'practice', icon: '🗣️', text: 'Practice your lines: Scene ' + sc.num + ' (' + n + ' line' + (n === 1 ? '' : 's') + ')', href: '#/lines/' + sc.id + '/run' } });
    });
    T.O().songs.forEach(function (so) {
      var m = T.O().moments.find(function (x) { return x.song === so.id; });
      if (m && T.onStage(m, chars)) songs.push({ soon: !!soonSo[so.id], t: { type: 'practice', icon: '🎵', text: 'Sing along: “' + so.title + '” with the guide vocals', href: '#/song/' + so.id } });
    });
    var pick = function (l) { var x = l.filter(function (i) { return i.soon; }); return (x.length ? x : l).map(function (i) { return i.t; }); };
    var L = pick(lines), S = pick(songs), out = [];
    for (var i = 0; i < Math.max(L.length, S.length); i++) { if (L[i]) out.push(L[i]); if (S[i]) out.push(S[i]); }
    return out.length ? out : [{ type: 'practice', icon: '🎧', text: 'Listen to the whole show and follow the words', href: '#/listen' }, { type: 'practice', icon: '📖', text: 'The Story: read the scenes you are in', href: '#/story' }, { type: 'practice', icon: '👕', text: 'My Costumes: check what you wear and when', href: '#/costumes' }];
  }
  function autoGroup(a, r) { return r && r.groups.find(function (g) { if (g.half) { var kids = cast().filter(function (x) { return !x.guest; }), k = kids.indexOf(a); return k >= 0 && (k % 2 === 0) === (g.half === 'A'); } if (g.focus === 'trip') return g.everyone; if (g.callbacks) { var cb = (T.show.casting || {}).callbacks || {}; return Object.keys(cb).some(function (k) { return cb[k].indexOf(a.id) >= 0; }); } if (g.everyone && !g.only) return true; var cs = groupChars(g); return a.chars.some(function (c) { return cs.indexOf(c) >= 0; }); }); }
  /* the weekly crew day */
  var BIG_DAYS = ['run', 'tech', 'dress', 'show'];
  function exempt(a) { if (a.guest) return true; var x = P().crewExempt; return x ? x.indexOf(a.id) >= 0 : a.chars.some(function (c) { var ch = T.charById(c); return ch && ch.group === 'leads'; }); }
  function homeStation(a) { var id = P().crewHome[a.id]; return id && P().stations.find(function (x) { return x.id === id; }); }
  function crewDayOf(a, mon) {
    if (exempt(a) || !homeStation(a)) return null;
    var days = weekDays(mon).filter(function (d) { return isClassDay(d) && !away(a, d); });
    var how = function (d) { var r = plan(d); return r && r.assign && r.assign[a.id]; };
    if (!days.length || days.some(function (d) { return String(how(d) || '').slice(0, 3) === 'st:'; })) return null;      // none this week, or the teacher already set one
    var open = days.filter(function (d) { return !how(d); });
    if (open.some(function (d) { return !autoGroup(a, plan(d)); })) return null;      // a day off stage this week: crew that day anyway
    return open.length ? open[open.length - 1] : null;      // on stage every day: crew on the last open day of the week
  }
  /* one actor's job on one class day */
  function task(a, s) {
    var r = plan(s), cf = away(a, s), how = r && r.assign && r.assign[a.id];
    if (cf) return { type: 'away', icon: '🙋', text: 'Away' + (cf.why ? ': ' + cf.why : '') };
    if (a.guest && !how) {      // guests: only on the big rehearsal days
      var gg = autoGroup(a, r);
      return gg && BIG_DAYS.indexOf(gg.focus) >= 0 ? { type: 'stage', focus: gg.focus, icon: focus(gg.focus)[1], text: groupName(gg) + (gg.where ? ' · ' + gg.where : ''), group: gg.id } : { type: 'off', icon: '🏠', text: 'Guest: not called today' };
    }
    if (how === 'custom' && r.tasks && r.tasks[a.id]) return { type: 'custom', icon: '📝', text: r.tasks[a.id] };
    if (!how && crewDayOf(a, monday(s)) === s) { var hs = homeStation(a); return { type: 'crew', icon: '🛠️', text: 'Crew day: ' + hs.name + (hs.desc ? ' (' + hs.desc + ')' : '') }; }
    var g = how && how.slice(0, 2) === 'g:' ? r.groups.find(function (x) { return 'g:' + x.id === how; }) : (!how ? autoGroup(a, r) : null);
    if (g && g.focus === 'share') {      // show and tell (Colleen): groups perform for each other; small solo lines get their moment
      var spot = (r.spotlight || []).filter(function (c) { return a.chars.indexOf(c) >= 0; })[0], so = spot && T.soloSongOf && T.soloSongOf(spot);
      if (spot) return { type: 'stage', focus: 'share', icon: '🌟', text: 'Show and tell: you sing your solo line for the class!' + (so ? ' (“' + so.title + '”)' : ''), href: so ? '#/song/' + so.id : null, group: g.id };
      return { type: 'stage', focus: 'share', icon: '🎤', text: 'Show and tell: every group shows the class what it worked on' + (g.where ? ' · ' + g.where : ''), group: g.id };
    }
    if (g && g.focus === 'watch') return { type: 'watch', icon: '🎬', text: 'Watch the movie together' + (g.where ? ' · ' + g.where : ''), group: g.id };
    if (g && g.focus === 'crew') return { type: 'crew', icon: '🛠️', text: (g.where || 'Crew time') };
    if (g && g.focus === 'photos') return { type: 'photos', icon: '📸', text: 'Costume and prop photos: photograph your finished costumes and props' + (g.where ? ' · ' + g.where : ''), href: '#/photos', group: g.id };      // after the shopping trip (Colleen 2026-10-24)
    if (g && g.focus === 'trip') return { type: 'trip', icon: '🚌', text: 'Field trip' + (g.where ? ': ' + g.where : '') + ' · shop for the whole show', href: '#/shop', trip: true };
    if (g) return { type: 'stage', focus: g.focus, icon: focus(g.focus)[1], text: groupName(g) + (g.where ? ' · ' + g.where : ''), group: g.id };
    var st = how && how.slice(0, 3) === 'st:' && P().stations.find(function (x) { return 'st:' + x.id === how; });
    if (!how && !st && homeStation(a)) st = homeStation(a);      // not in a group today: with their crew
    if (st) return { type: 'crew', icon: '🛠️', text: 'Crew: ' + st.name + (st.desc ? ' (' + st.desc + ')' : '') };
    var all = practiceList(a, s), i = classDays().indexOf(s);
    return all[(i < 0 ? 0 : i) % all.length];
  }
  T.prodTask = task;
  /* shared with season.js (the semester plan and track calendars) */
  T.prod = { groupChars: groupChars, classDays: classDays, isClassDay: isClassDay, plan: plan, newGroup: newGroup, focus: focus, groupName: groupName, monday: monday, addDays: addDays, dayName: dayName, today: today, bookingsOn: function (s) { return (P().bookings || []).filter(function (b) { return b.date === s; }); } };

  /* ---------- days away sent from iPads ---------- */
  /* notes from iPads: each kind has a handler (here: conflict, video; casting.js adds audition). A handler returns true when it added something.
     Notes no handler knows are left on the server for the page that knows them. */
  T.noteHandlers = T.noteHandlers || {};
  T.noteHandlers.video = function (n) {      // a dance video link: waits for the teacher's OK
    if (!actor(n.actor) || !/^https:\/\//.test(n.url || '') || !T.songById(n.song)) return false;
    var V = T.show.videos = T.show.videos || [];
    if (V.some(function (v) { return v.url === n.url; })) return false;
    V.push({ id: uid('v'), song: n.song, title: String(n.title || 'Dance video').slice(0, 80), by: n.actor, url: String(n.url).slice(0, 500), ok: false, at: n._at });
    return true;
  };
  T.noteHandlers.conflict = function (n) {
    var p = P();
    if (!actor(n.actor) || !/^\d{4}-\d{2}-\d{2}$/.test(n.date || '') || p.conflicts.some(function (c) { return c.actor === n.actor && c.date === n.date; })) return false;
    p.conflicts.push({ id: uid('x'), actor: n.actor, date: n.date, why: String(n.why || '').slice(0, 200), from: 'student', sent: n._at });
    return true;
  };
  function pullNotes() {
    return Store.getNotes(T.key, T.proof).then(function (notes) {
      var added = 0, done = [];
      notes.forEach(function (n) {
        var h = T.noteHandlers[n.type];
        if (n._junk) { done.push(n._id); return; }
        if (!h) return;
        if (h(n)) added++;
        done.push(n._id);
      });
      if (!done.length) return 0;
      return (added ? T.saveShow(added + ' new note' + (added === 1 ? '' : 's') + ' from students') : Promise.resolve()).then(function () { return Store.clearNotes(T.proof, done); }).then(function () { return added; });
    });
  }
  T.pullNotes = pullNotes;

  /* ---------- Teacher: Production ---------- */
  var tab = 'week', week = null, startedAtSetup = false;
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.production = function (args) {
    if (args[0] === 'day') return dayPage(args[1]);
    if (args[0] === 'attend') return attendPage(args[1]);
    if (args[0] === 'callboard') return callboard(args[1]);
    overview();
    pullNotes().then(function (n) { if (n) overview(); }).catch(function () {});
  };
  function overview() {
    T.setBar('Production', '#/teacher');
    if (!P().term.first && !startedAtSetup) { tab = 'setup'; startedAtSetup = true; }      // first visit: start at the calendar; every tab still works after
    var vp = (T.show.videos || []).filter(function (v) { return !v.ok; }).length;
    var tabs = [['week', 'Week'], ['season', 'Semester plan'], ['tracks', 'Tracks'], ['time', 'Stage time'], ['away', 'Days away'], ['attendance', 'Attendance'], ['videos', 'Dance videos' + (vp ? ' (' + vp + ' new)' : '')], ['shop', 'Shopping'], ['perf', 'Performances'], ['setup', 'Calendar & crew']];
    var h = '<div class="row noprint" style="margin-bottom:14px"><div class="seg">' + tabs.map(function (t) { return '<button data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>';
    if (!cast().length) h += '<p class="card">Add the cast first (Teacher mode › Cast) so every Company member gets a job each day.</p>';
    h += { week: weekView, time: timeView, away: awayView, attendance: attendanceView, videos: videosView, setup: setupView, shop: function () { return T.shopView(); }, perf: function () { return T.perfView(); }, season: function () { return T.seasonView(); }, tracks: function () { return T.tracksView(); } }[tab]();
    app.innerHTML = h;
    app.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { tab = b.dataset.v; overview(); }; });
    app.querySelectorAll('[data-goto]').forEach(function (b) { b.onclick = function () { tab = b.dataset.goto; overview(); }; });
    if (tab === 'week' && !P().term.first) return;
    ({ week: wireWeek, away: wireAway, setup: wireSetup, videos: wireVideos, shop: function () { T.wireShop(overview); }, perf: function () { T.wirePerf(overview); }, season: function () { T.wireSeason(overview); }, tracks: function () { T.wireTracks(overview); } }[tab] || function () {})();
  }

  function setupView() {
    var p = P(), t = p.term, n = classDays().length;
    return '<div class="card"><h2>School calendar</h2><p class="muted">Class meets every school day, Monday to Friday, from the first day to the last, except the days off.</p>' +
      '<div class="row"><label class="f grow">First day of class<input type="date" id="t1" value="' + (t.first || '') + '"></label><label class="f grow">Last day of class<input type="date" id="t2" value="' + (t.last || '') + '"></label></div>' +
      '<label class="f">Paste the district’s no-school days<textarea id="t3" placeholder="One per line. Ranges work too:&#10;9/7/2026&#10;Nov 25 – Nov 27&#10;12/21/2026 - 1/1/2027"></textarea></label>' +
      '<p class="err" id="tm"></p>' +
      (t.off.length ? '<details><summary class="btn quiet small">' + t.off.length + ' days off saved</summary><p class="muted small">Tap one to make it a class day again.</p><div class="row">' + t.off.map(function (s) { return '<button class="btn small" data-off="' + s + '">' + esc(dayName(s, true)) + ' ✕</button>'; }).join('') + '</div></details>' : '') +
      '<p>' + (n ? '<b>' + n + ' class days</b>, about ' + Math.ceil(n / 5) + ' weeks' : 'Set the first and last day.') + '</p>' +
      '<div class="row end"><button class="btn primary" id="tsv" data-save>Save the calendar</button></div></div>' +
      '<div class="card"><h2>Bookings in our theatre</h2><p class="muted">Concerts, other shows, assemblies: anything that needs the stage. They show as ⚠️ on those days, so the set is never in someone’s way (or theirs in ours) during tech week.</p>' +
      '<label class="f">Our theatre<input id="vn" value="' + esc(p.venueName || '') + '" placeholder="e.g. Reber Center"></label>' +
      '<label class="f">Paste bookings, one per line<textarea id="bk" placeholder="12/8/2026 Jazz Band Concert 7:30pm&#10;Dec 3 Fanfares and Carols 7pm"></textarea></label><p class="err" id="bm"></p>' +
      ((p.bookings || []).length ? '<details><summary class="btn quiet small">' + p.bookings.length + ' bookings saved</summary>' + p.bookings.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (b) { return '<div class="switch"><span><b>' + esc(dayName(b.date, true)) + '</b> ' + esc(b.text) + '</span><button class="btn small quiet" data-rmbk="' + b.id + '">Remove</button></div>'; }).join('') + '</details>' : '') +
      '<div class="row end"><button class="btn primary" id="bksv" data-save>Save bookings</button></div></div>' +
      '<div class="card"><h2>Crew stations</h2><p class="muted">Jobs for Company members who are not on stage that day. Anyone without one practices in the app.</p>' +
      (p.stations.length ? p.stations.map(function (st) { return '<div class="switch"><span><b>' + esc(st.name) + '</b> <span class="muted small">' + esc(st.desc || '') + '</span></span><button class="btn small quiet" data-rmst="' + st.id + '">Remove</button></div>'; }).join('') : '<p class="muted">None yet.</p>') +
      '<div class="row"><label class="f grow" style="margin:0">Station<input id="sn" placeholder="e.g. Props"></label><label class="f grow" style="margin:0">What to do (optional)<input id="sd" placeholder="e.g. paint the lockers"></label><button class="btn" id="sadd" data-save>Add</button></div></div>' +
      (p.stations.length && cast().length ? '<div class="card"><h2>Everyone’s crew</h2><p class="muted">Each Company member works with their crew at least one day a week, on a day they are not needed on stage. Tick <b>Lead</b> for the biggest roles to skip the weekly crew day.</p>' +
        '<table class="tbl"><thead><tr><th>Company member</th><th>Crew</th><th>Lead</th></tr></thead><tbody>' + cast().map(function (a) {
          return '<tr><td>' + esc(a.name) + '</td><td><select data-home="' + a.id + '"><option value="">Choose…</option>' + p.stations.map(function (st) { return '<option value="' + st.id + '"' + (p.crewHome[a.id] === st.id ? ' selected' : '') + '>' + esc(st.name) + '</option>'; }).join('') + '</select></td>' +
            '<td><input type="checkbox" data-lead="' + a.id + '"' + (exempt(a) ? ' checked' : '') + ' aria-label="Lead"></td></tr>';
        }).join('') + '</tbody></table><div class="row end" style="margin-top:10px"><button class="btn" id="even">Fill in the rest evenly</button><button class="btn primary" id="hsv" data-save>Save crews</button></div></div>' : '');
  }
  function wireSetup() {
    var p = P();
    document.getElementById('bksv').onclick = function () {
      var r = pasteBookings(document.getElementById('bk').value, p.term.first || today());
      p.venueName = document.getElementById('vn').value.trim();
      p.bookings = (p.bookings || []).concat(r.list.filter(function (b) { return !(p.bookings || []).some(function (x) { return x.date === b.date && x.text === b.text; }); }).map(function (b) { return { id: uid('b'), date: b.date, text: b.text.slice(0, 120) }; }));
      T.saveShow(r.list.length ? r.list.length + ' bookings added' : 'Saved').then(function () { tab = 'setup'; overview(); if (r.bad.length) document.getElementById('bm').textContent = 'I could not find a date in: ' + r.bad.join(' · '); });
    };
    app.querySelectorAll('[data-rmbk]').forEach(function (b) { b.onclick = function () { p.bookings = p.bookings.filter(function (x) { return x.id !== b.dataset.rmbk; }); T.saveShow('Removed').then(overview); }; });
    document.getElementById('tsv').onclick = function () {
      var a = document.getElementById('t1').value, b = document.getElementById('t2').value, m = document.getElementById('tm');
      if (!a || !b || b < a) { m.textContent = 'Pick the first day and a last day after it.'; return; }
      var r = pasteDates(document.getElementById('t3').value, a);
      p.term.first = a; p.term.last = b;
      r.dates.forEach(function (s) { if (p.term.off.indexOf(s) < 0) p.term.off.push(s); }); p.term.off.sort();
      T.saveShow(r.dates.length ? r.dates.length + ' days off added' : 'Calendar saved').then(function () {
        tab = 'setup'; overview();
        if (r.bad.length) document.getElementById('tm').textContent = 'I could not read: ' + r.bad.join(' · ') + '. Type those another way (like 11/26/2026).';
      });
    };
    app.querySelectorAll('[data-off]').forEach(function (b) { b.onclick = function () { p.term.off = p.term.off.filter(function (s) { return s !== b.dataset.off; }); T.saveShow('Now a class day').then(overview); }; });
    document.getElementById('sadd').onclick = function () { var n = document.getElementById('sn').value.trim(); if (!n) return; p.stations.push({ id: uid('st'), name: n, desc: document.getElementById('sd').value.trim() }); T.saveShow('Station added').then(overview); };
    var hsv = document.getElementById('hsv');
    if (hsv) {
      var readCrew = function () {
        app.querySelectorAll('[data-home]').forEach(function (s) { if (s.value) p.crewHome[s.dataset.home] = s.value; else delete p.crewHome[s.dataset.home]; });
        p.crewExempt = Array.from(app.querySelectorAll('[data-lead]:checked')).map(function (c) { return c.dataset.lead; });
      };
      hsv.onclick = function () { readCrew(); T.saveShow('Crews saved').then(overview); };
      document.getElementById('even').onclick = function () {
        readCrew();
        var n = {}; p.stations.forEach(function (st) { n[st.id] = 0; }); cast().forEach(function (a) { if (n[p.crewHome[a.id]] !== undefined) n[p.crewHome[a.id]]++; });
        cast().forEach(function (a) { if (p.crewHome[a.id] || exempt(a)) return; var best = p.stations.slice().sort(function (x, y) { return n[x.id] - n[y.id]; })[0]; p.crewHome[a.id] = best.id; n[best.id]++; });
        overview();
      };
    }
    app.querySelectorAll('[data-rmst]').forEach(function (b) { b.onclick = function () { p.stations = p.stations.filter(function (x) { return x.id !== b.dataset.rmst; }); T.saveShow('Removed').then(overview); }; });
  }

  function weekView() {
    var p = P(), days = classDays();
    if (!p.term.first) return '<div class="card"><p>' + sym('📅') + 'Set the first and last day of class first, then each week shows here.</p><button class="btn primary" data-goto="setup">Go to Calendar & crew</button></div>';
    if (!week) { var t = today(); week = monday(days.find(function (d) { return d >= t; }) || days[0] || t); }
    var isShown = p.shown.indexOf(week) >= 0, people = cast();
    var h = '<div class="row" style="justify-content:center;margin-bottom:10px"><button class="round" id="pw" aria-label="Last week">' + icon('prev') + '</button><h2 style="margin:0;text-align:center">Week of ' + esc(dayName(week, true)) + '</h2><button class="round" id="nw" aria-label="Next week">' + icon('next') + '</button></div>' +
      '<div class="card row"><label class="switch grow" style="border:0"><span><b>Show this week to Company members</b><br><span class="muted small">' + (isShown ? 'Company members can see this week on Today.' : 'Hidden: Company members see “Coming soon” for these days.') + '</span></span><input type="checkbox" id="shw"' + (isShown ? ' checked' : '') + '></label>' +
      '<a class="btn small" href="#/teacher/production/callboard/' + week + '">Call board</a></div>';
    return h + weekDays(week).map(function (s) {
      if (!isClassDay(s)) return '<div class="card" style="opacity:.6">' + esc(dayName(s)) + ' · ' + (p.term.off.indexOf(s) >= 0 ? 'No school' : 'Not a class day') + '</div>';
      var r = plan(s), n = { stage: 0, crew: 0, practice: 0, away: 0, custom: 0, off: 0, trip: 0, watch: 0 };
      people.forEach(function (a) { n[task(a, s).type]++; });
      return '<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/teacher/production/day/' + s + '"><div class="row"><b class="grow">' + esc(dayName(s)) + '</b>' + (p.attendance[s] ? '<span class="tag">attendance ✓</span>' : '') + '</div>' + bookingLine(s) +
        (r && r.groups.length ? r.groups.map(function (g) { return '<div>' + sym(focus(g.focus)[1]) + esc(groupName(g)) + (g.where ? ' <span class="muted">· ' + esc(g.where) + '</span>' : '') + '</div>'; }).join('') : '<div class="muted">Not planned yet: Company members go to their crew (leads practice in the app)</div>') +
        '<div class="muted small">' + (n.trip ? n.trip + ' on the trip · ' : '') + n.stage + ' on stage · ' + n.crew + ' crew · ' + n.practice + ' practicing' + (n.custom ? ' · ' + n.custom + ' other' : '') + (n.away ? ' · <span class="err">' + n.away + ' away</span>' : '') + '</div></a>';
    }).join('');
  }
  function wireWeek() {
    var go = function (n) { week = addDays(week, 7 * n); overview(); };
    document.getElementById('pw').onclick = function () { go(-1); };
    document.getElementById('nw').onclick = function () { go(1); };
    document.getElementById('shw').onchange = function (e) {
      var p = P(); p.shown = p.shown.filter(function (w) { return w !== week; }); if (e.target.checked) p.shown.push(week);
      T.saveShow(e.target.checked ? 'Company members can see this week' : 'This week is hidden').then(overview);
    };
  }

  /* how each student's days are spent (planned days so far and ahead), to keep everyone on stage as much as possible */
  function timeView() {
    var days = classDays().filter(function (s) { return plan(s); }), cols = [['acting', '🗣️ Acting'], ['vocals', '🎵 Vocals'], ['dance', '💃 Dance'], ['other', '🎭 Other stage'], ['crew', '🛠️ Crew'], ['practice', '📱 App practice']];
    if (!days.length) return '<p class="card muted">Plan some days first. This shows how many days each Company member spends on stage, in each kind of group.</p>';
    var rows = cast().filter(function (a) { return !a.guest; }).map(function (a) {
      var c = { acting: 0, vocals: 0, dance: 0, other: 0, crew: 0, practice: 0, n: 0 };
      days.forEach(function (s) { var t = task(a, s); if (t.type === 'away') return; c.n++; if (t.type === 'stage') c[c[t.focus] !== undefined ? t.focus : 'other']++; else if (t.type === 'crew') c.crew++; else if (t.type === 'practice') c.practice++; });
      c.stage = c.acting + c.vocals + c.dance + c.other; return { a: a, c: c };
    }).sort(function (x, y) { return x.c.stage / (x.c.n || 1) - y.c.stage / (y.c.n || 1); });
    return '<p class="muted">The ' + days.length + ' planned days. Fewest days on stage first, so you can see who to bring in.</p><table class="tbl"><thead><tr><th>Company member</th><th>On stage</th>' + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (x) { var pct = x.c.n ? Math.round(100 * x.c.stage / x.c.n) : 0; return '<tr><td>' + esc(x.a.name) + '</td><td><b' + (pct < 50 ? ' class="err"' : '') + '>' + pct + '%</b></td>' + cols.map(function (c) { return '<td>' + x.c[c[0]] + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function awayView() {
    var list = P().conflicts.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }), now = today();
    var rows = function (l) {
      return l.map(function (c) {
        var a = actor(c.actor), r = plan(c.date), g = a && autoGroup(a, r);
        return '<tr><td>' + esc(dayName(c.date, true)) + '</td><td>' + (a ? esc(a.name) : '<span class="muted">(removed)</span>') + '</td><td>' + esc(c.why || '') + (c.from === 'student' ? ' <span class="tag">from iPad</span>' : '') + '</td>' +
          '<td>' + (g ? '<span class="err">Misses ' + esc(focus(g.focus)[2].toLowerCase()) + '</span>' : '') + '</td><td><button class="btn small quiet" data-del="' + c.id + '">Delete</button></td></tr>';
      }).join('');
    };
    var up = list.filter(function (c) { return c.date >= now; }), past = list.filter(function (c) { return c.date < now; });
    return '<div class="card"><h3>Add a day away</h3><div class="row"><label class="f grow" style="margin:0">Company member<select id="ca">' + cast().map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="margin:0">Day<input type="date" id="cd" value="' + today() + '"></label><label class="f grow" style="margin:0">Why (optional)<input id="cw" maxlength="200" placeholder="e.g. field trip"></label><button class="btn primary" id="cadd" data-save>Add</button></div></div>' +
      '<p class="muted">Company members can send their own from <b>Today</b> on their iPad. They show up here when you open Production.</p>' +
      (up.length ? '<table class="tbl"><thead><tr><th>Day</th><th>Who</th><th>Why</th><th></th><th></th></tr></thead><tbody>' + rows(up) + '</tbody></table>' : '<p>Nobody is away on a coming day.</p>') +
      (past.length ? '<details style="margin-top:14px"><summary class="btn quiet">Past (' + past.length + ')</summary><table class="tbl"><tbody>' + rows(past) + '</tbody></table></details>' : '');
  }
  function wireAway() {
    document.getElementById('cadd').onclick = function () {
      var a = document.getElementById('ca').value, d = document.getElementById('cd').value; if (!a || !d) { T.toast('Pick the Company member and the day.'); return; }
      if (!isClassDay(d)) { T.toast('That is not a class day.'); return; }
      if (P().conflicts.some(function (c) { return c.actor === a && c.date === d; })) { T.toast('Already there.'); return; }
      P().conflicts.push({ id: uid('x'), actor: a, date: d, why: document.getElementById('cw').value.trim(), from: 'teacher' });
      T.saveShow('Added').then(overview);
    };
    app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this?')) return; var p = P(); p.conflicts = p.conflicts.filter(function (c) { return c.id !== b.dataset.del; }); T.saveShow('Deleted').then(overview); }; });
  }
  function attendanceView() {
    var p = P(), now = today(), days = classDays().filter(function (s) { return s <= now; }).reverse();
    var cnt = {}; cast().filter(function (a) { return !a.guest; }).forEach(function (a) { cnt[a.id] = { here: 0, late: 0, absent: 0, excused: 0 }; });
    Object.keys(p.attendance).forEach(function (s) { var at = p.attendance[s]; Object.keys(at).forEach(function (id) { if (cnt[id] && cnt[id][at[id]] !== undefined) cnt[id][at[id]]++; }); });
    return '<div class="card"><h3>Take attendance</h3>' + (days.length ? '<div class="grid">' + days.slice(0, 10).map(function (s) {
      return '<a class="tile" style="min-height:90px" href="#/teacher/production/attend/' + s + '"><b>' + esc(dayName(s, true)) + '</b><span>' + (p.attendance[s] ? 'Taken ✓' : 'Not taken yet') + '</span></a>';
    }).join('') + '</div>' : '<p class="muted">No class days yet.</p>') + '</div>' +
      '<div class="card"><h3>So far</h3><table class="tbl"><thead><tr><th>Company member</th>' + MARKS.map(function (m) { return '<th>' + m[1] + ' ' + m[2] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      cast().filter(function (a) { return cnt[a.id]; }).map(function (a) { var c = cnt[a.id]; return '<tr><td>' + esc(a.name) + '</td>' + MARKS.map(function (m) { return '<td' + (m[0] === 'absent' && c.absent ? ' class="err"' : '') + '>' + c[m[0]] + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  /* dance videos: choreography recorded by students (or the teacher), one list per song. Students share a link to the video in their school
     Google Drive; it shows to the cast only after the teacher's OK. Only the link is stored, encrypted with the show. */
  function videosView() {
    var V = T.show.videos = T.show.videos || [], pend = V.filter(function (v) { return !v.ok; }), ok = V.filter(function (v) { return v.ok; });
    var row = function (v) { var a = actor(v.by), s = T.songById(v.song); return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(v.title) + '</b><br><span class="muted small">' + esc(s ? s.title : '') + (a ? ' · by ' + esc(a.name) : '') + '</span></span>' +
      '<a class="btn small" href="' + esc(v.url) + '" target="_blank" rel="noopener">Watch</a>' + (v.ok ? '' : '<button class="btn small primary" data-okv="' + v.id + '">Share with the cast</button>') + '<button class="btn small quiet" data-rmv="' + v.id + '">Remove</button></div>'; };
    return '<div class="card"><h3>Waiting for your OK</h3>' + (pend.length ? pend.map(row).join('') : '<p class="muted">Nothing new.</p>') + '</div>' +
      '<div class="card"><h3>Shared with the cast</h3>' + (ok.length ? ok.map(row).join('') : '<p class="muted">None yet. Company members share them from My Songs.</p>') + '</div>' +
      '<div class="card"><h3>Add one yourself</h3><div class="row"><label class="f grow" style="margin:0">Song<select id="vs">' + T.O().songs.map(function (s) { return '<option value="' + s.id + '">' + esc(s.title) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f grow" style="margin:0">Title<input id="vt" placeholder="e.g. Chorus, counts 1–32"></label></div><label class="f">Link<input id="vu" placeholder="https://drive.google.com/…"></label><div class="row end"><button class="btn primary" id="vadd" data-save>Add</button></div></div>';
  }
  function wireVideos() {
    var V = T.show.videos;
    app.querySelectorAll('[data-okv]').forEach(function (b) { b.onclick = function () { V.find(function (v) { return v.id === b.dataset.okv; }).ok = true; T.saveShow('Shared with the cast').then(overview); }; });
    app.querySelectorAll('[data-rmv]').forEach(function (b) { b.onclick = function () { if (!confirm('Remove this video link?')) return; T.show.videos = V.filter(function (v) { return v.id !== b.dataset.rmv; }); T.saveShow('Removed').then(overview); }; });
    document.getElementById('vadd').onclick = function () {
      var u = document.getElementById('vu').value.trim(); if (!/^https:\/\//.test(u)) { T.toast('Paste the link (it starts with https://).'); return; }
      V.push({ id: uid('v'), song: document.getElementById('vs').value, title: document.getElementById('vt').value.trim() || 'Dance video', by: '', url: u, ok: true });
      T.saveShow('Video added').then(overview);
    };
  }
  /* students: the dance videos for a song (on its page in My Songs), and sharing one */
  T.videoCard = function (songId) {
    var V = (T.show.videos || []).filter(function (v) { return v.ok && v.song === songId; });
    setTimeout(function () { var b = document.getElementById('sharev'); if (b) b.onclick = function () { shareVideo(songId); }; }, 0);
    return '<div class="card"><h3>' + sym('💃') + 'Dance videos</h3>' + (V.length ? V.map(function (v) { var a = actor(v.by); return '<div class="switch"><span><b>' + esc(v.title) + '</b>' + (a ? '<br><span class="muted small">by ' + esc(a.name) + '</span>' : '') + '</span><a class="btn small primary" href="' + esc(v.url) + '" target="_blank" rel="noopener">' + icon('play') + 'Watch</a></div>'; }).join('') : '<p class="muted">No dance videos for this song yet.</p>') +
      (T.me && T.me.id ? '<button class="btn small" id="sharev">Share a dance video</button>' : '') + '</div>';
  };
  function shareVideo(songId) {
    var box = document.createElement('dialog');
    box.innerHTML = '<h2>' + sym('💃') + 'Share a dance video</h2><ol><li>Put the video in your <b>school Google Drive</b>.</li><li>Tap <b>Share</b>, and let people at your school with the link view it.</li><li>Copy the link and paste it here.</li></ol>' +
      '<label class="f">What it shows<input id="t" maxlength="80" placeholder="e.g. Chorus moves, slow"></label><label class="f">Link<input id="u" placeholder="https://drive.google.com/…" autocapitalize="off"></label>' +
      '<p class="muted small">Your teacher watches it first, then shares it with the cast.</p><p class="err" id="m"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Send</button></div>';
    document.body.appendChild(box); box.showModal();
    var close = function () { box.close(); box.remove(); };
    box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    box.querySelector('#cn').onclick = close;
    box.querySelector('#ok').onclick = function () {
      var u = box.querySelector('#u').value.trim();
      if (!/^https:\/\//.test(u)) { box.querySelector('#m').textContent = 'Paste the link. It starts with https://'; return; }
      box.querySelector('#ok').disabled = true;
      Store.sendNote(T.key, { type: 'video', actor: T.me.id, song: songId, title: box.querySelector('#t').value.trim(), url: u }).then(function () { close(); T.toast('Sent! Your teacher will look at it.'); })
        .catch(function (e) { box.querySelector('#ok').disabled = false; box.querySelector('#m').textContent = e.message || 'It did not send.'; });
    };
  }

  /* one class day: the groups on stage, then a job for every student */
  function dayPage(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return overview();
    var r = JSON.parse(JSON.stringify(plan(s) || blank()));
    T.setBar(dayName(s, true), '#/teacher/production');
    var O = T.O(), p = P();
    function draw() {
      var people = cast();
      app.innerHTML = (isClassDay(s) ? '' : '<p class="card err">This is not a class day on your school calendar.</p>') + (bookingsOn(s).length ? '<div class="card">' + bookingLine(s, '') + '</div>' : '') +
        '<p class="muted">Each group works on its own scenes or songs (Acting, Vocals, Dance…). Every Company member goes to the first group they are in; big group numbers bring the whole ensemble and the small roles. Anyone left over gets crew or practice in the app.</p>' +
        r.groups.map(function (g, gi) {
          var n = people.filter(function (a) { return task(a, s).group === g.id; }).length;
          return '<div class="card" data-g="' + gi + '"><div class="row"><label class="f grow" style="margin:0">Group ' + (gi + 1) + '<select data-k="focus">' + FOCUS.map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === g.focus ? ' selected' : '') + '>' + f[1] + ' ' + f[2] + '</option>'; }).join('') + '</select></label>' +
            '<label class="f grow" style="margin:0">Where / with whom<input data-k="where" value="' + esc(g.where || '') + '" placeholder="e.g. Stage, choir room, with Ms. Lee"></label><span class="tag">' + n + ' Company members</span><button class="btn small quiet" data-delg>Remove</button></div>' +
            '<div class="row"><label class="switch grow" style="border:0"><span>Whole cast</span><input type="checkbox" data-k="everyone"' + (g.everyone ? ' checked' : '') + '></label>' +
            '<label class="f" style="margin:0">Who<select data-k="only">' + Object.keys(ONLY).map(function (k) { return '<option value="' + k + '"' + ((g.only || '') === k ? ' selected' : '') + '>' + ONLY[k] + '</option>'; }).join('') + '</select></label>' +
            (g.focus === 'trip' ? '<button class="btn small" data-halves>Two trips: half the class each</button>' : '') +
            (g.songs.length && !g.only ? '<button class="btn small" data-split title="Principals sing in one place while the chorus learns the dance in another">Split: singers + chorus dance</button>' : '') + '</div>' +
            (function () {      // talents in this group (from the audition sign-ups), so the choreography can use them
              var su = (T.show.casting || {}).signups || {}, who = people.filter(function (a) { return task(a, s).group === g.id && su[a.id] && su[a.id].excited; });
              return who.length && ['dance', 'run', 'share'].indexOf(g.focus) >= 0 ? '<p class="small" style="background:var(--hi);padding:6px 10px;border-radius:10px">' + sym('✨') + '<b>Talents here:</b> ' + who.map(function (a) { return esc(a.name) + ': ' + esc(su[a.id].excited); }).join(' · ') + '</p>' : '';
            })() +
            '<p class="muted small">Scenes</p><div class="row">' + O.scenes.map(function (sc) { return '<button type="button" class="btn small" data-sc="' + sc.id + '" aria-pressed="' + (g.scenes.indexOf(sc.id) >= 0) + '" title="' + esc(sc.place) + '">' + sc.num + '</button>'; }).join('') + '</div>' +
            '<p class="muted small" style="margin-top:10px">Songs <span class="small">(★ big number: the ensemble and small roles join)</span></p><div class="row">' + O.songs.map(function (so) { var m = O.moments.find(function (x) { return x.song === so.id; }); return '<button type="button" class="btn small" data-so="' + so.id + '" aria-pressed="' + (g.songs.indexOf(so.id) >= 0) + '">' + (m && m.big ? '★ ' : '') + esc(so.title) + '</button>'; }).join('') + '</div></div>';
        }).join('') +
        (r.groups.some(function (g) { return g.focus === 'share'; }) ? '<div class="card"><h3>🌟 Spotlight solos</h3><p class="muted small">Company members with a small solo line sing it for the class. Tap to choose.</p><div class="row">' +
          (T.soloists ? T.soloists() : []).map(function (x) { return '<button type="button" class="btn small" data-spot="' + x.c + '" aria-pressed="' + ((r.spotlight || []).indexOf(x.c) >= 0) + '">' + esc(T.charById(x.c).short) + ' <span class="muted small">' + esc(x.song.title) + '</span></button>'; }).join('') + '</div></div>' : '') +
        '<div class="row" style="margin-bottom:14px">' + FOCUS.filter(function (f) { return ['acting', 'vocals', 'dance', 'trip', 'photos', 'share'].indexOf(f[0]) >= 0; }).map(function (f) { return '<button class="btn" data-addg="' + f[0] + '">+ ' + f[1] + ' ' + f[2] + ' group</button>'; }).join('') + '</div>' +
        '<div class="card"><label class="f" style="margin:0">Note for everyone (they see it)<input id="nt" value="' + esc(r.notes || '') + '" placeholder="e.g. Wear shoes you can dance in."></label></div>' +
        '<div class="card"><h3>Every Company member’s job</h3>' + people.map(function (a) {
          var t = task(a, s), how = (r.assign || {})[a.id] || '';
          return '<div class="switch" style="flex-wrap:wrap"><span class="grow">' + T.face(a, 36) + ' <b>' + esc(a.name) + '</b><br><span class="muted small">' + sym(t.icon) + esc(t.text) + '</span></span>' +
            (t.type === 'away' ? '' : '<select data-job="' + a.id + '"><option value=""' + (how === '' ? ' selected' : '') + '>Automatic</option>' +
              r.groups.map(function (g, gi) { return '<option value="g:' + g.id + '"' + (how === 'g:' + g.id ? ' selected' : '') + '>Group ' + (gi + 1) + ': ' + esc(focus(g.focus)[2]) + '</option>'; }).join('') +
              p.stations.map(function (st) { return '<option value="st:' + st.id + '"' + (how === 'st:' + st.id ? ' selected' : '') + '>Crew: ' + esc(st.name) + '</option>'; }).join('') +
              '<option value="app"' + (how === 'app' ? ' selected' : '') + '>Practice in the app</option><option value="custom"' + (how === 'custom' ? ' selected' : '') + '>My own words…</option></select>') +
            (how === 'custom' ? '<input data-txt="' + a.id + '" value="' + esc((r.tasks || {})[a.id] || '') + '" placeholder="What should they do?" style="flex-basis:100%;min-height:48px;border:2px solid var(--line);border-radius:12px;padding:8px 12px;background:var(--card)">' : '') + '</div>';
        }).join('') + (p.stations.length ? '<div class="row" style="margin-top:10px"><button class="btn small" id="copy">Same crew jobs the rest of the week</button></div>' : '<p class="muted small">Add crew stations under Calendar & crew.</p>') + '</div>' +
        '<div class="dock"><div class="in"><a class="btn" href="#/teacher/production/attend/' + s + '" id="att">' + icon('check') + 'Attendance</a><button class="btn quiet" id="clr">Clear this day</button><button class="btn primary" data-save id="sv">Save</button></div></div>';
      var keep = function () {
        app.querySelectorAll('[data-g]').forEach(function (el) { var g = r.groups[+el.dataset.g]; g.focus = el.querySelector('[data-k=focus]').value; g.where = el.querySelector('[data-k=where]').value.trim(); g.only = el.querySelector('[data-k=only]').value; });
        r.notes = document.getElementById('nt').value.trim();
        app.querySelectorAll('[data-txt]').forEach(function (i) { r.tasks[i.dataset.txt] = i.value; });
      };
      var gOf = function (el) { return r.groups[+el.closest('[data-g]').dataset.g]; };
      app.querySelectorAll('[data-sc],[data-so]').forEach(function (b) { b.onclick = function () { keep(); var g = gOf(b), list = b.dataset.sc ? g.scenes : g.songs, v = b.dataset.sc || b.dataset.so, i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); draw(); }; });
      app.querySelectorAll('[data-k=everyone]').forEach(function (c) { c.onchange = function () { keep(); gOf(c).everyone = c.checked; draw(); }; });
      app.querySelectorAll('[data-k=focus],[data-k=only]').forEach(function (c) { c.onchange = function () { keep(); draw(); }; });
      /* two trips (Colleen: each teacher goes once with half the class, to a different store, on a different day). Halves mix the crews so both
         trips have costume and props people. The other half has class as usual that day. */
      app.querySelectorAll('[data-halves]').forEach(function (b) {
        b.onclick = function () {
          keep(); var g = gOf(b);
          var d = T.dialog('<h2>Two trips</h2><p class="muted">This day goes with ' + esc(g.where || 'this store') + '. The other half goes another day, to another store. Everyone else has class as usual.</p>' +
            '<label class="f">The other trip’s day<input type="date" id="d2" value="' + addDays(s, 1) + '"></label><label class="f">Where, and with whom<input id="w2" placeholder="e.g. Savers on Route 9, with Mr. Kim"></label>' +
            '<p class="err" id="m"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Split the class</button></div>');
          d.querySelector('#cn').onclick = function () { d.close(); };
          d.querySelector('#ok').onclick = function () {
            var s2 = d.querySelector('#d2').value; if (!s2 || s2 === s) { d.querySelector('#m').textContent = 'Pick a different day.'; return; }
            var kids = cast().filter(function (a) { return !a.guest; }).sort(function (x, y) { return String(p.crewHome[x.id] || '~').localeCompare(String(p.crewHome[y.id] || '~')) || x.name.localeCompare(y.name); });
            var r2 = p.days[s2] = p.days[s2] || blank(), g2 = newGroup('trip'); g2.where = d.querySelector('#w2').value.trim(); r2.groups.push(g2);
            g.everyone = false;
            kids.forEach(function (a, i) { if (i % 2 === 0) r.assign[a.id] = 'g:' + g.id; else { if (r.assign[a.id] === 'g:' + g.id) delete r.assign[a.id]; r2.assign[a.id] = 'g:' + g2.id; } });
            d.close(); save().then(function () { T.toast('Half the class on each trip'); draw(); });
          };
        };
      });
      app.querySelectorAll('[data-split]').forEach(function (b) {
        b.onclick = function () {
          keep(); var g = gOf(b), i = r.groups.indexOf(g), d = JSON.parse(JSON.stringify(g));
          g.focus = 'vocals'; g.only = 'principals'; d.id = uid('g'); d.focus = 'dance'; d.only = 'chorus'; d.where = '';
          r.groups.splice(i + 1, 0, d); draw();
        };
      });
      app.querySelectorAll('[data-delg]').forEach(function (b) {
        b.onclick = function () { keep(); var g = gOf(b); r.groups = r.groups.filter(function (x) { return x !== g; }); Object.keys(r.assign).forEach(function (k) { if (r.assign[k] === 'g:' + g.id) delete r.assign[k]; }); draw(); };
      });
      app.querySelectorAll('[data-addg]').forEach(function (b) { b.onclick = function () { keep(); var ng = newGroup(b.dataset.addg); if (ng.focus === 'share') { ng.everyone = true; ng.where = 'Everyone together'; } r.groups.push(ng); draw(); }; });
      app.querySelectorAll('[data-spot]').forEach(function (b) { b.onclick = function () { keep(); var c = b.dataset.spot, l = r.spotlight = r.spotlight || [], i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); draw(); }; });
      app.querySelectorAll('[data-job]').forEach(function (sel) {
        sel.onchange = function () {
          keep(); var id = sel.dataset.job;
          if (sel.value) r.assign[id] = sel.value; else delete r.assign[id];
          if (sel.value !== 'custom') delete r.tasks[id];
          draw(); var t = app.querySelector('[data-txt="' + id + '"]'); if (t) t.focus();
        };
      });
      var save = function () {
        keep();
        Object.keys(r.tasks).forEach(function (id) { if (!String(r.tasks[id]).trim()) { delete r.tasks[id]; if (r.assign[id] === 'custom') delete r.assign[id]; } });
        p.days[s] = r;
        return T.saveShow('Day saved').then(function () { r = JSON.parse(JSON.stringify(r)); });
      };
      var copy = document.getElementById('copy');
      if (copy) copy.onclick = function () {
        keep(); var n = 0;
        weekDays(monday(s)).filter(function (d) { return d > s && isClassDay(d); }).forEach(function (d) {
          var x = p.days[d] = p.days[d] || blank();
          Object.keys(r.assign).forEach(function (id) { if (r.assign[id].slice(0, 3) === 'st:') x.assign[id] = r.assign[id]; }); n++;
        });
        save().then(function () { T.toast('Crew jobs copied to ' + n + ' more day' + (n === 1 ? '' : 's')); });
      };
      document.getElementById('sv').onclick = function () { save().then(draw); };
      document.getElementById('att').onclick = function (e) { e.preventDefault(); save().then(function () { T.go('#/teacher/production/attend/' + s); }); };
      document.getElementById('clr').onclick = function () { if (!confirm('Clear the plan for ' + dayName(s) + '? Everyone will practice in the app.')) return; delete p.days[s]; T.saveShow('Cleared').then(function () { T.go('#/teacher/production'); }); };
    }
    draw();
  }

  /* attendance: every student, every class day; a day away starts as Excused */
  function attendPage(s) {
    T.setBar('Attendance', '#/teacher/production/day/' + s);
    var at = Object.assign({}, P().attendance[s] || {}), people = cast().filter(function (a) { return !a.guest || task(a, s).type !== 'off'; });      // guests only on days they are called
    people.forEach(function (a) { if (!at[a.id] && away(a, s)) at[a.id] = 'excused'; });
    function draw() {
      app.innerHTML = '<h2>' + esc(dayName(s)) + '</h2><div class="row noprint" style="margin-bottom:12px"><button class="btn small" id="allhere">' + icon('check') + 'Everyone else is here</button></div>' +
        people.map(function (a) {
          var t = task(a, s);
          return '<div class="card row" style="margin-bottom:10px">' + T.face(a, 48) + '<div class="grow"><b>' + esc(a.name) + '</b><br><span class="muted small">' + sym(t.icon) + esc(t.text) + '</span></div>' +
            '<div class="seg" data-a="' + a.id + '">' + MARKS.map(function (m) { return '<button type="button" data-v="' + m[0] + '" aria-pressed="' + (at[a.id] === m[0]) + '">' + sym(m[1]) + m[2] + '</button>'; }).join('') + '</div></div>';
        }).join('') +
        '<div class="dock"><div class="in"><span class="muted" id="cnt"></span><button class="btn primary" data-save id="sv">Save attendance</button></div></div>';
      document.getElementById('cnt').textContent = people.filter(function (a) { return at[a.id] === 'here' || at[a.id] === 'late'; }).length + ' of ' + people.length + ' here';
      app.querySelectorAll('.seg[data-a] button').forEach(function (b) { b.onclick = function () { var a = b.parentNode.dataset.a; at[a] = at[a] === b.dataset.v ? undefined : b.dataset.v; draw(); }; });
      document.getElementById('allhere').onclick = function () { people.forEach(function (a) { if (!at[a.id]) at[a.id] = 'here'; }); draw(); };
      document.getElementById('sv').onclick = function () { var c = {}; Object.keys(at).forEach(function (k) { if (at[k]) c[k] = at[k]; }); P().attendance[s] = c; T.saveShow('Attendance saved'); };
    }
    draw();
  }

  /* the call board: one week, every student's job each day, grouped; printable or on the projector */
  function callboard(mon) {
    mon = monday(mon || today());
    T.setBar('Call board', '#/teacher/production');
    var days = weekDays(mon).filter(isClassDay);
    app.innerHTML = '<div class="row noprint" style="justify-content:center;margin-bottom:10px"><a class="round" href="#/teacher/production/callboard/' + addDays(mon, -7) + '" aria-label="Last week">' + icon('prev') + '</a><b>Week of ' + esc(dayName(mon, true)) + '</b><a class="round" href="#/teacher/production/callboard/' + addDays(mon, 7) + '" aria-label="Next week">' + icon('next') + '</a><button class="btn small" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<h2 class="center">' + esc(T.O().title) + ' · Call board</h2>' + (P().shown.indexOf(mon) < 0 ? '<p class="center muted noprint">Company members cannot see this week yet.</p>' : '') +
      (days.length ? days.map(function (s) { return dayBoard(s); }).join('') : '<p class="center muted">No class days this week.</p>');
  }
  /* one day of the call board: everyone, grouped by where they are. pub (a parent's full calendar): who is away and private notes are left out */
  function dayBoard(s, pub) {
    var r = plan(s), groups = {}, order = [];
    cast().forEach(function (a) {
      var t = task(a, s); if (t.type === 'off' || (pub && (t.type === 'away' || t.type === 'custom'))) return;
      var k = t.type === 'trip' ? '🚌 ' + t.text : t.type === 'photos' ? '📸 Costume and prop photos' : t.type === 'stage' ? t.icon + ' ' + t.text : t.type === 'practice' ? '📱 Practice in the app' : t.type === 'crew' ? '🛠️ ' + t.text : t.type === 'away' ? '🙋 Away' : '📝 Other';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(t.type === 'custom' ? a.name + ' (' + t.text + ')' : a.name);
    });
    order.sort(function (x, y) { var rank = function (k) { return /^📱|^🙋|^🛠️|^📝/.test(k) ? 1 : 0; }; return rank(x) - rank(y); });
    return '<div class="card"><h3>' + esc(dayName(s)) + '</h3>' + bookingLine(s) + (r && r.notes && !pub ? '<p class="muted">' + esc(r.notes) + '</p>' : '') +
      (order.length ? order.map(function (k) { return '<p><b>' + esc(k) + ':</b> ' + groups[k].map(esc).join(' · ') + '</p>'; }).join('') : '<p class="muted">Nothing planned yet.</p>') + '</div>';
  }
  T.dayBoard = dayBoard;

  /* ---------- Students: Today ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.today = function () {
    T.setBar('Today', '#/home');
    var p = P(), me = T.me && actor(T.me.id), now = today();
    if (!me) { app.innerHTML = '<div class="card"><p>Your teacher has not put you on the cast list yet, so the app cannot show your jobs. For now, practice in My Songs or Practice Lines.</p></div>'; return; }
    if (!p.term.first) { app.innerHTML = '<div class="card"><p>Your teacher has not set up the class calendar yet.</p></div>'; return; }
    var days = classDays().filter(function (s) { return s >= now; }).slice(0, 15);
    var sent = (T.ls('sentAway') || []).filter(function (x) { return x.actor === me.id && x.date >= now; });
    var card = function (s, big) {
      if (!shown(s)) return '<div class="card" style="opacity:.7"><b>' + esc(dayName(s)) + '</b><br><span class="muted">Coming soon</span></div>';
      var t = task(me, s), r = plan(s), pend = !away(me, s) && sent.some(function (x) { return x.date === s; });
      return '<div class="card"' + (big ? ' style="border:3px solid ' + T.color(me.chars[0]) + '"' : '') + '>' + (big ? '<span class="tag">' + (s === now ? 'Today' : 'Next class') + '</span>' : '') +
        '<h3 style="margin-top:6px">' + esc(dayName(s)) + '</h3><p style="' + (big ? 'font-size:1.35em;font-weight:700;' : '') + 'margin:4px 0">' + sym(t.icon) + esc(t.text) + '</p>' +
        (r && r.notes ? '<p class="card" style="background:var(--hi);margin:8px 0">' + sym('📌') + esc(r.notes) + '</p>' : '') +
        '<div class="row" style="margin-top:8px">' + (t.href ? '<a class="btn' + (big ? ' primary' : ' small') + '" href="' + t.href + '">Start</a>' : '') +
        (t.type === 'away' ? '' : pend ? '<span class="tag">Sent: I’ll be away</span>' : '<button class="btn small quiet" data-away="' + s + '">I’ll be away</button>') + '</div></div>';
    };
    app.innerHTML = (days.length ? card(days[0], true) : '<div class="card"><p>No more class days this year. Bravo!</p></div>') +
      '<p class="center"><a class="btn" href="#/calendar">' + sym('🗓️') + 'My whole calendar</a></p>' + (T.perfCard ? T.perfCard() : '') + (T.studyNextCard ? T.studyNextCard() : '') +
      (days.length > 1 ? '<h2 style="margin-top:20px">Coming up</h2>' + days.slice(1).map(function (s) { return card(s, false); }).join('') : '');
    app.querySelectorAll('[data-away]').forEach(function (b) { b.onclick = function () { awayNote(b.dataset.away); }; });
  };
  function awayNote(s) {
    var box = document.createElement('dialog');
    box.innerHTML = '<h2>' + sym('🙋') + 'I’ll be away</h2><p><b>' + esc(dayName(s)) + '</b></p><label class="f">Why (you can skip this)<input id="w" maxlength="200" placeholder="e.g. doctor, field trip"></label>' +
      '<p class="err" id="m"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Send to my teacher</button></div>';
    document.body.appendChild(box); box.showModal();
    var close = function () { box.close(); box.remove(); };
    box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    box.querySelector('#cn').onclick = close;
    box.querySelector('#ok').onclick = function () {
      var n = { type: 'conflict', actor: T.me.id, date: s, why: box.querySelector('#w').value.trim() };
      box.querySelector('#ok').disabled = true;
      Store.sendNote(T.key, n).then(function () {
        var l = T.ls('sentAway') || []; l.push({ actor: n.actor, date: n.date }); T.ls('sentAway', l.slice(-40));
        close(); T.toast('Sent! Your teacher will see it.'); T.route();
      }).catch(function (e) { box.querySelector('#ok').disabled = false; box.querySelector('#m').textContent = e.message || 'It did not send. Check the Wi-Fi, or tell your teacher.'; });
    };
  }
})();
