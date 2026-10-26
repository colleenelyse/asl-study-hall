/* asl.cool/theatre: the curtain call (Colleen 2026-10-24: bows with "auditory and visual cuing for when each group enters", each performer sees
   "their bow as part of their overall track and who they're bowing with"; "fairly few groups"; entrances "alternate starting from sr"; and
   "bows should happen to some underscoring and then the megamix happens after everyone is on stage … we don't want bowing and clapping over
   the music performance").
   A few bow groups in the usual order (the Company groups, then supporting roles, then featured, then the leads), each walking on and bowing
   over the bow music (instrumental underscoring) when the group before them steps back; then the whole Company, on stage, performs the
   Megamix; then one Company bow with the crew in the line. Each group's moment is a time in the bow music (tapped by the teacher while it
   plays, or spread evenly), so the app can chime "get ready" and show a big GO.
   The bow music: the band track of any song, or a track the teacher uploads (stored as the track '__bows', 'performance').
   T.show.curtain = { music: { song } | { own: ver }, groups: [{ id, name, chars, cast, at (seconds in the bow music), from, row, note }],
   finale: song id (the Megamix), company: { note }, trench: 'stage' | 'pit', crew: true }. Not saved yet: the defaults below.
   Changed 2026-10-25 (Colleen: "we're going to bow to we're all in this together with vocals and we'll set how many 8 counts before each group
   goes. each student should be able to listen to the song and see a timer countdown until they run on to bow and see a big red x over the
   screen, then a brief get ready, then a green GO at the right measure in the music"; "i'm not sure if i want to use the performance track, the
   guide vocal, the recording from the movie"; "remove the practice with the megamix"): the bow music can be a song's band track OR its guide
   vocals (music.kind), or an uploaded recording; P.counts = { bpm, first } (count 1 of the first 8-count, in bow seconds) and each group's
   g.eights (8-counts after that) give its moment (timeOf); a finale song is optional (none by default). My bow shows the countdown.
   Changed 2026-10-25 (Colleen's plan, a table by 8-count: "Intro 1-2 Hold; Intro 3-6 Group 1 Bows; Troy verse 7-10 Group 2 Bows; Gabriella verse
   11-14 Group 3 Bows; Chorus- everyone dances! 15-end Do the choreo for the chorus; Boogie during fade out"): the page counts 8-counts the way she
   does, from 1 (a group "starts on 8-count 3" is g.eights 2); each group can name its part of the music (g.music); P.parts are the other rows
   [{ eight, music, what }] (Hold, the chorus choreo, the boogie); "The bows, 8-count by 8-count" shows her table back. And ("i want the 8 counts
   counted visually on the screen as an option … a big label of what 8 count we're on and a smaller incremental 1-8 count because some students
   will remember i go on 7"): P.counts.show turns on a counter (8-count N, big; 1 to 8 lighting up) in Rehearse and Practice my bow; each
   device can switch it with the 🔢 8-counts switch (ls bowCounts). */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var FROM = ['Stage right', 'Stage left', 'Both sides', 'Upstage center'], ROWS = ['Back row', 'Middle row', 'Front row', 'Front, center'];
  var sideFor = function (i) { return i % 2 ? 'Stage left' : 'Stage right'; };      // entrances take turns, starting stage right (Colleen)
  var COLORS = ['#2f6fd1', '#24935d', '#c03aa8', '#d9822b', '#7a4fd6', '#c8323c'];
  var uid = function () { return 'b' + Math.random().toString(36).slice(2, 8); };

  function finaleSong() {      // a song everyone performs after the bows ('' = none): for HSM JR the Megamix, in sections (js/megamix.js)
    var c = T.show.curtain, so = c && c.finale ? T.songById(c.finale) : null;
    return so || null;      // the Megamix is back after the bows (Colleen 2026-10-25: "the full mega mix after we use the short track i just sent you for bows first")
  }
  /* the plan: saved, or the defaults */
  function plan() {
    var c = T.show.curtain; if (c && c.groups && c.music) return c;
    var O = T.O(), has = function (id) { return !!T.charById(id); }, fin = finaleSong();
    var g = function (name, chars, row) { return { id: uid(), name: name, chars: chars.filter(has), cast: [], at: null, row: row, note: '' }; };
    var groups;
    /* HSM JR, Colleen's bow order (2026-10-25): "1 — Chorus & Minor Featured Roles … 3–6; 2 — Supporting Characters … 7–10; 3 — Four Leads … 11–14;
       Entire Cast: Everyone performs the chorus choreography 15–end" */
    if (O.id === 'hsm-jr') groups = [
      g('Chorus and minor featured roles', ['jocks', 'cheer', 'brainiacs', 'thespians', 'partykids', 'rebels', 'students', 'kratnoff', 'drummajor', 'cathy', 'cyndra', 'james', 'susan'], 'Back row'),
      g('Supporting characters', ['chad', 'taylor', 'kelsi', 'zeke', 'martha', 'darbus', 'coach', 'tenny', 'moderator', 'jack'], 'Middle row'),
      g('The four leads', ['troy', 'gabriella', 'sharpay', 'ryan'], 'Front, center')];
    else groups = ['ensemble', 'featured', 'adults', 'friends', 'leads'].map(function (gid, i) {
      var cs = O.characters.filter(function (c) { return c.group === gid; }).map(function (c) { return c.id; });
      return cs.length ? g((O.groups.find(function (x) { return x.id === gid; }) || {}).name || gid, cs, ROWS[Math.min(i, 3)]) : null;
    }).filter(Boolean);
    groups.forEach(function (x, i) { x.from = sideFor(i); });
    if (O.id === 'hsm-jr') {
      groups[2].from = 'Both sides'; groups[2].sides = { 'c:sharpay': 'Stage right', 'c:ryan': 'Stage left', 'c:troy': 'Stage right', 'c:gabriella': 'Stage left' };      // the pairs meet in the middle
      [[2, 'Intro'], [6, 'Troy verse'], [10, 'Gabriella verse']].forEach(function (x, i) { groups[i].eights = x[0]; groups[i].music = x[1]; });
    }
    /* HSM JR: the bows go over the band track of #32 (We're All in This Together), Colleen's choice: a repeat of it in the full show, and its
       only use in the abridged school-day show */
    var m32 = O.id === 'hsm-jr' && O.songs.find(function (s) { return String(s.num) === '32'; });
    var mmx = O.id === 'hsm-jr' && O.songs.find(function (s) { return String(s.num) === '41'; });
    return { music: { song: (c && c.music && c.music.song) || (m32 && m32.id) || (O.songs[O.songs.length - 1] || {}).id, kind: 'rehearsal', start: 0, loop: true }, finale: mmx ? mmx.id : '', crew: true, trench: 'stage', groups: groups, counts: O.id === 'hsm-jr' ? { bpm: 116, first: 0, show: false } : { bpm: null, first: 0, show: false },      // 116: her bow recording's tempo
      parts: O.id === 'hsm-jr' ? [{ eight: 1, music: 'Intro', what: 'Hold' }, { eight: 15, music: 'Chorus', what: 'Everyone performs the chorus choreography' }, { eight: 21, music: 'Fade-out', what: 'Boogie!' }] : [],
      company: { note: 'Everyone in one line: one bow together, then point to the band and the crew.' } };
  }
  T.curtainPlan = plan;
  /* the 8-count counter for any song's player (app.js): counts = T.songCounts(id), t = the band track's clock */
  T.BeatCount = {
    at: function (counts, t) { return counts ? eightAt({ counts: counts }, t) : null; },
    grid: function (counts) { var e = speedUp(counts) || {}; return { first: +e.first || 0, beat: 60 / +e.bpm }; },      // Snap to the beat on Lyrics timing
    html: '<div class="bow-8" data-b8box><div class="bow-8-n" data-b8n></div><div class="bow-8-beats">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div></div>',
    draw: function (host, counts, t) {
      var box = host && host.querySelector('[data-b8box]'); if (!box) return;
      var at = counts ? eightAt({ counts: counts }, t) : null;
      box.querySelector('[data-b8n]').textContent = at ? '8-count ' + at.n : 'Count 1 is coming';
      box.querySelectorAll('.bow-8-beats span').forEach(function (x, i) { x.className = at && i < at.beat ? (i === at.beat - 1 ? 'now' : 'past') : ''; });
    }
  };
  T.curtainMusic = function () { var P = plan(); return P && P.music ? music(P) : null; };      // the song list shows the bow track (app.js)
  /* the bow music: which track, and how to load it */
  function music(P) {
    var m = P.music || {};
    if (m.own) return { id: '__bows', kind: 'performance', ver: m.own, name: 'your bow recording' };
    var so = m.song && T.songById(m.song), tr = so && (T.show.tracks || {})[so.id];
    if (!tr || !(tr.performance || tr.rehearsal)) return null;
    var kind = m.kind && tr[m.kind] ? m.kind : tr.performance ? 'performance' : 'rehearsal';      // band track or guide vocals, as picked
    return { id: so.id, kind: kind, ver: tr[kind].ver, name: (kind === 'rehearsal' ? 'the guide vocals of “' : 'the band track of “') + so.title + '”' };
  }
  /* when a group goes, in bow seconds: by 8-counts when the tempo is set, else the time set for it */
  /* her counts, tapped through the whole song (Colleen 2026-10-25: "i want to be able to tap the ones and the counts for you to help you count on
     rhythm all the way through the song. i'd tap 1 on all the ones and tap the 2-8s, then one again for the beginning of the next phrase"):
     P.counts.taps = [[seconds, 1 for a one / 0 for 2-8], …]. When there are taps, every 8-count starts on her tapped 1 and each count is her tap,
     so a recording that speeds up or slows down stays in step; past her last tap, it carries on at her average. Else the steady tempo (bpm, first). */
  function mapOf(P) {
    if (!(P.counts && P.counts.raw)) return null;      // her taps are averaged into a steady beat (fitCounts); raw tap-following only if asked
    var tp = (P.counts && P.counts.taps) || [], ones = [], beats = [];
    tp.forEach(function (x) { beats.push(x[0]); if (x[1]) ones.push(x[0]); });
    if (ones.length < 2) return null;
    var len = (ones[ones.length - 1] - ones[0]) / (ones.length - 1);
    return { ones: ones, beats: beats, len: len };
  }
  /* averaging her taps (Colleen 2026-10-25: "take some averages from my taps on the whole song to fix obvious errors or things that i tapped slightly
     off, base the rhythm in averages since the tempo is consistent all the way through"): one steady beat fitted to every tap (least squares).
     First the 1s give a rough tempo; each tap is matched to the nearest beat of it (so an extra or missing tap does not shift the rest); taps more
     than a quarter of a beat off are left out as mistakes, and the line is fitted again. Returns { bpm, first, used, off, badOnes } or null. */
  function fitCounts(taps) {
    /* (and Colleen 2026-10-25: "if i missed one count can't it figure out where it is. there's also one instance of a 4 count transition"):
       the beat is steady, but the phrases come from her 1s, so a 4-count transition keeps every later 8-count in place, and a missed count or a
       missed 1 is filled in. ones = the beat number (0 = her first 1) where each 8-count starts. */
    taps = (taps || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    if (taps.filter(function (x) { return x[1]; }).length < 2 || taps.length < 6) return null;
    var line = function (pts) { var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0; pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; }); var d = n * sxx - sx * sx; if (!d) return null; var m = (n * sxy - sx * sy) / d; return { m: m, b: (sy - m * sx) / n }; };
    /* a first guess at the beat: the usual gap between taps */
    var gaps = []; for (var i = 1; i < taps.length; i++) { var g = taps[i][0] - taps[i - 1][0]; if (g > 0.2 && g < 2) gaps.push(g); }
    if (!gaps.length) return null;
    gaps.sort(function (a, b) { return a - b; });
    var m = gaps[Math.floor(gaps.length / 2)], k = 0, pts = [[0, taps[0][0]]];
    for (i = 1; i < taps.length; i++) { var step = Math.round((taps[i][0] - taps[i - 1][0]) / m); if (step < 1) continue; k += step; pts.push([k, taps[i][0]]); }      // a skipped count moves on two beats
    var fit = line(pts); if (!fit || fit.m <= 0) return null;
    var used = [], off = 0;
    for (var round = 0; round < 3; round++) {
      used = []; off = 0; var seen = {};
      taps.forEach(function (x) { var kk = Math.round((x[0] - fit.b) / fit.m), r = x[0] - (fit.b + kk * fit.m); if (Math.abs(r) <= fit.m * 0.25 && !seen[kk]) { seen[kk] = 1; used.push([kk, x[0]]); } else off++; });
      var f2 = used.length >= 4 ? line(used) : null; if (!f2 || f2.m <= 0) break; fit = f2;
    }
    var beatOf = function (t) { return Math.round((t - fit.b) / fit.m); };
    var ones = [], hit = {};
    taps.forEach(function (x) { if (!x[1]) return; var kk = beatOf(x[0]); if (Math.abs(x[0] - (fit.b + kk * fit.m)) <= fit.m * 0.35 && !hit[kk]) { hit[kk] = 1; ones.push(kk); } });
    ones.sort(function (a, b) { return a - b; });
    var k0 = ones[0], filled = 0, notes = [];
    ones = ones.map(function (x) { return x - k0; });
    /* a phrase of 16 or 24 counts: a 1 was missed; put it back every 8 */
    var out = [ones[0]];
    for (i = 1; i < ones.length; i++) { var L = ones[i] - out[out.length - 1]; while (L > 8 && L % 8 === 0) { out.push(out[out.length - 1] + 8); filled++; L -= 8; } out.push(ones[i]); }
    var last = taps[taps.length - 1][0], lastBeat = beatOf(last) - k0;
    while (lastBeat - out[out.length - 1] >= 8) { out.push(out[out.length - 1] + 8); filled++; }      // she stopped tapping 1s but kept going
    var lens = out.map(function (x, j) { return out[j + 1] != null ? out[j + 1] - x : null; });
    lens.forEach(function (L, j) { if (L == null || L === 8) return; notes.push({ n: j + 1, len: L, kind: L === 4 ? 'four' : (L === 7 || L === 9) ? 'odd' : 'other' }); });
    var beat = fit.m, first = fit.b + k0 * fit.m;
    return { bpm: +(60 / beat).toFixed(2), first: +Math.max(0, first).toFixed(3), ones: out, used: used.length, off: off, filled: filled, notes: notes, taps: taps.length };
  }
  /* 8-count n (from 1) starts on beat ones[n-1]; past her last 1, every 8 beats */
  /* the two speeds (Colleen 2026-10-25: "i also want to have 2 speed options. the speed i used for bows was the slower speed. it could be sped up
     double time and be the counts used. i want to be able to toggle between both"): counts.double = each tapped count is two counts, so the
     8-counts come twice as often (a tapped 4-count transition is one 8-count). Everything reads the counts through E(P). */
  function speedUp(c) {
    if (!c || !c.double || !(+c.bpm > 0)) return c;
    var o = c.ones, o2 = null;
    if (o && o.length) { o2 = []; o.forEach(function (k, i) { var a = 2 * k, b = o[i + 1] != null ? 2 * o[i + 1] : a + 16; for (var x = a; x < b; x += 8) o2.push(x); }); }
    return Object.assign({}, c, { bpm: +c.bpm * 2, ones: o2 });
  }
  var E = function (P) { return speedUp((P && P.counts) || {}) || {}; };
  var beatSec = function (P) { var c = E(P); return +c.bpm > 0 ? 60 / +c.bpm : null; };
  var onesOf = function (P) { var o = E(P).ones; return o && o.length ? o : null; };
  var eightSec = function (P) { var m = mapOf(P); if (m) return m.len; var c = E(P); return +c.bpm > 0 ? 8 * 60 / +c.bpm : null; };
  var firstOne = function (P) { var m = mapOf(P); return m ? m.ones[0] : +E(P).first || 0; };
  /* when 8-count n (from 1) starts */
  function startOf(P, n) {
    var m = mapOf(P), e = eightSec(P); if (!e) return null;
    if (m) return +(n <= m.ones.length ? m.ones[n - 1] : m.ones[m.ones.length - 1] + (n - m.ones.length) * m.len).toFixed(2);
    var O = onesOf(P), bs = beatSec(P);
    if (O && bs) { var kb = n <= O.length ? O[n - 1] : O[O.length - 1] + (n - O.length) * 8; return +((+E(P).first || 0) + kb * bs).toFixed(2); }
    return +((+E(P).first || 0) + (n - 1) * e).toFixed(2);
  }
  function timeOf(g, P) { var e = eightSec(P); return e && g.eights != null && g.eights !== '' ? startOf(P, +g.eights + 1) : g.at; }
  T.bowTimeOf = function (g) { return timeOf(g, plan()); };
  /* 8-counts numbered from 1, as she counts them: 8-count n starts n - 1 8-counts after count 1 */
  function eightAt(P, t) {
    var e = eightSec(P); if (!e) return null;
    var m = mapOf(P);
    if (m) {
      if (t < m.ones[0] - 0.05) return null;
      var last = m.ones[m.ones.length - 1], lastBeat = m.beats[m.beats.length - 1];
      if (t > Math.max(last + m.len, lastBeat + m.len / 8)) { var s2 = t - last, k = Math.floor(s2 / m.len); return { n: m.ones.length + k, beat: Math.min(8, Math.floor((s2 - k * m.len) / (m.len / 8)) + 1) }; }      // past her taps: her average
      var i = 0; while (i + 1 < m.ones.length && m.ones[i + 1] <= t + 0.05) i++;
      var b = m.beats.filter(function (x) { return x >= m.ones[i] - 0.01 && x <= t + 0.05; }).length;
      return { n: i + 1, beat: Math.max(1, Math.min(8, b)) };
    }
    var s = t - (+E(P).first || 0); if (s < 0) return null;
    var O = onesOf(P), bs = beatSec(P);
    if (O && bs) {      // her phrases: a 4-count transition is 4 counts
      var kb = Math.floor(s / bs + 0.02), i = 0; while (i + 1 < O.length && O[i + 1] <= kb) i++;
      if (i === O.length - 1 && kb - O[i] >= 8) { var extra = Math.floor((kb - O[i]) / 8); return { n: O.length + extra, beat: (kb - O[i]) % 8 + 1 }; }
      return { n: i + 1, beat: Math.min(8, kb - O[i] + 1) };
    }
    var n = Math.floor(s / e); return { n: n + 1, beat: Math.min(8, Math.floor((s - n * e) / (e / 8)) + 1) };
  }
  var startN = function (g) { return g.eights != null && g.eights !== '' ? +g.eights + 1 : null; };
  /* her table: every group and every other part, by the 8-count it starts on; each runs to the one before the next row */
  function rowsOf(P) {
    var r = P.groups.map(function (g, i) { return { n: startN(g), music: g.music || '', what: 'Group ' + (i + 1) + ' bows: ' + g.name, color: COLORS[i % COLORS.length], gi: i }; })
      .concat((P.parts || []).map(function (p) { return { n: p.eight, music: p.music || '', what: p.what || '', part: p }; }))
      .filter(function (x) { return x.n != null && x.n > 0; }).sort(function (a, b) { return a.n - b.n || (a.part ? 1 : -1); });
    r.forEach(function (x, i) { var nx = r[i + 1]; x.to = nx ? Math.max(x.n, nx.n - 1) : null; });
    return r;
  }
  function rowAt(P, t) { var at = eightAt(P, t), cur = null; if (!at) return null; rowsOf(P).forEach(function (x) { if (x.n <= at.n) cur = x; }); return cur; }
  /* the counter on the screen: the 8-count big, its 1 to 8 lighting up under it, and what this part of the music is */
  var countsOn = function (P) { var v = T.ls('bowCounts'); return v ? v === '1' : !!(P.counts && P.counts.show); };
  var counterHTML = '<div class="bow-8" data-b8box hidden><div class="bow-8-sec" data-b8sec></div><div class="bow-8-n" data-b8n></div><div class="bow-8-beats">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div></div>';
  var counterSwitch = function (P) { return '<label class="switch" style="border:0"><span>🔢 8-counts</span><input type="checkbox" data-b8on' + (countsOn(P) ? ' checked' : '') + '></label>'; };
  function counterDraw(host, P, t) {
    var box = host.querySelector('[data-b8box]'); if (!box) return;
    var on = countsOn(P) && !!eightSec(P); box.hidden = !on; if (!on) return;
    var at = eightAt(P, t), row = rowAt(P, t);
    host.querySelector('[data-b8n]').textContent = at ? '8-count ' + at.n : 'Count 1 is coming';
    host.querySelector('[data-b8sec]').textContent = row ? [row.music, row.what].filter(Boolean).join(' · ') : '';
    host.querySelectorAll('.bow-8-beats span').forEach(function (x, i) { x.className = at && i < at.beat ? (i === at.beat - 1 ? 'now' : 'past') : ''; });
  }
  function counterWire(host, P, redraw) { var c = host.querySelector('[data-b8on]'); if (c) c.onchange = function () { T.ls('bowCounts', c.checked ? '1' : '0'); redraw(); }; }
  /* which bow group a student (or a track) is in: a doubled student bows with their biggest role (the later group) */
  function groupOf(chars, actorId) {
    var P = plan(), hit = -1;
    P.groups.forEach(function (g, i) { if ((chars || []).some(function (c) { return g.chars.indexOf(c) >= 0; }) || (actorId && (g.cast || []).indexOf(actorId) >= 0)) hit = i; });
    return hit;
  }
  T.bowGroupOf = groupOf;
  function membersOf(g, gi) {      // the Company members who bow in group gi (a doubled student only in their own group), or its characters before casting
    var cast = (T.show.cast || []).filter(function (a) { return a.name && (a.chars || []).length; });
    var people = cast.filter(function (a) { return (a.chars || []).some(function (c) { return g.chars.indexOf(c) >= 0; }) || (g.cast || []).indexOf(a.id) >= 0; })
      .filter(function (a) { return gi == null || groupOf(a.chars, a.id) === gi; });
    return people.length ? people.map(function (a) { return { name: a.name, a: a }; }) : g.chars.map(function (c) { var x = T.charById(c); return { name: x ? x.short : c, c: c }; });
  }
  /* each person's entrance side (Colleen 2026-10-25: "the ability for 2 people to bow at the same time but enter from opposite sides"):
     g.sides['a:<actor>'] or g.sides['c:<character>'], else the group's side */
  var keyOf = function (m) { return m.a ? 'a:' + m.a.id : 'c:' + m.c; };
  function sideOfMember(g, m) { var S = g.sides || {}; if (m.a) { if (S['a:' + m.a.id]) return S['a:' + m.a.id]; var c = (m.a.chars || []).find(function (x) { return S['c:' + x] && g.chars.indexOf(x) >= 0; }); if (c) return S['c:' + c]; } return S[keyOf(m)] || g.from; }
  function mySide(g, me) { var S = g.sides || {}; if (me.id && S['a:' + me.id]) return S['a:' + me.id]; var c = (me.chars || []).find(function (x) { return S['c:' + x]; }); return c ? S['c:' + c] : g.from; }
  function groupSides(g, gi) { var out = []; membersOf(g, gi).forEach(function (m) { var x = sideOfMember(g, m); if (out.indexOf(x) < 0) out.push(x); }); return out.length ? out.join(' and ') : g.from; }
  var listenFor = function (P, i) {
    var g = P.groups[i];
    if (eightSec(P) && g && g.eights != null && g.eights !== '') return 'on 8-count ' + startN(g) + ' (about ' + T.clock(timeOf(g, P)) + ' into the song)';
    if (g && g.at != null) { var ea = eightAt(P, g.at); return 'at ' + T.clock(g.at) + ' into the song' + (ea ? ' (8-count ' + ea.n + ', count ' + ea.beat + ')' : ''); }      // a tapped time
    return i === 0 ? 'the bow music starts' : P.groups[i - 1].name + ' bow and step back';
  };

  /* ---------- the sounds: a soft two-note "get ready" and a bell for GO (Web Audio, over the track) ---------- */
  function tone(freqs, dur, vol) {
    var ctx = T.audioCtx(), t0 = ctx.currentTime;
    freqs.forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      var s = t0 + i * dur; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol || 0.25, s + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s + dur * 1.6);
      o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + dur * 1.7);
    });
  }
  var READY = function () { tone([660, 880], 0.18, 0.18); }, GO = function () { tone([1046, 1318, 1568], 0.12, 0.3); };
  /* the bow music on its own clock (Colleen: "use track 32 fading in at roughly 15 seconds and loop it if necessary"): bow time 0 is `start`
     seconds into the track; it fades in over 2.5 seconds; at the end of the track it goes back to `start` and keeps going, so bow times run on.
     { audio, ready, time(), seek(bow time), play(), pause() } */
  function loadAudio(mu, P) {
    var audio = new Audio(), url = null, m = (P && P.music) || {}, start = Math.max(0, +m.start || 0), loop = m.loop !== false, laps = 0, fadeT = 0;
    var span = function () { return Math.max(1, (audio.duration || 60) - start); };
    var ready = Store.getTrack(T.key, mu.id, mu.kind, mu.ver).then(function (b) { if (!b) throw new Error('The bow music would not load.'); url = URL.createObjectURL(new Blob([b])); audio.src = url; return new Promise(function (ok) { if (audio.readyState >= 1) ok(); else audio.addEventListener('loadedmetadata', ok, { once: true }); }); })
      .then(function () { audio.currentTime = start; });
    var fade = function () { clearInterval(fadeT); audio.volume = 0; var v = 0; fadeT = setInterval(function () { v = Math.min(1, v + 0.04); audio.volume = v; if (v >= 1) clearInterval(fadeT); }, 100); };
    var wrap = function () { if (loop && audio.duration && audio.currentTime >= audio.duration - 0.2) { laps++; audio.currentTime = start; } };
    audio.addEventListener('timeupdate', wrap);
    audio.addEventListener('ended', function () { if (!loop) return; laps++; audio.currentTime = start; audio.play(); });
    var api = {
      audio: audio, ready: ready, start: start, span: span,
      time: function () { return laps * span() + Math.max(0, audio.currentTime - start); },
      seek: function (bt) { bt = Math.max(0, bt); laps = loop ? Math.floor(bt / span()) : 0; audio.currentTime = start + (loop ? bt % span() : Math.min(bt, span())); },
      play: function () { if (api.time() < 1) fade(); else audio.volume = 1; return audio.play(); },
      pause: function () { audio.pause(); }
    };
    T.cleanup.push(function () { audio.pause(); clearInterval(fadeT); if (url) URL.revokeObjectURL(url); });
    return api;
  }

  /* the navigation bar (Colleen 2026-10-25: "i also want a play pause and navigation bar on this page"): drag to any moment in the bow music */
  function seekBar(host, A, onSeek) {
    var r = host.querySelector('[data-seek]'); if (!r) return function () {};
    var dragging = false;
    A.ready.then(function () { r.max = Math.max(1, (A.audio.duration || 60) - A.start).toFixed(1); });
    r.oninput = function () { dragging = true; onSeek(+r.value, true); };
    r.onchange = function () { dragging = false; onSeek(+r.value, false); };
    return function (t) { if (!dragging) r.value = Math.min(+r.max || t, t); };
  }
  var seekHTML = '<input type="range" data-seek min="0" max="100" step="0.1" value="0" class="grow" style="min-width:160px" aria-label="Where in the bow music">';
  /* ---------- the player: the bow music with cues (the teacher's Rehearse, a student's Practice my bow) ---------- */
  function player(host, opts) {
    var P = plan(), mu = music(P);
    if (!mu) { host.innerHTML = '<p class="card">' + (T.me ? 'Your teacher has not picked the bow music yet.' : 'Pick the bow music first (Teacher › Curtain call).') + '</p>'; return; }
    var cues = P.groups.map(function (g, i) { return { i: i, g: g, t: timeOf(g, P), color: COLORS[i % COLORS.length], label: 'Group ' + (i + 1) + ': ' + g.name, from: groupSides(g, i) }; })
      .filter(function (c) { return c.t != null && (!opts.only || opts.only.indexOf(c.i) >= 0); });
    if (!cues.length) { host.innerHTML = '<p class="card">' + (T.me ? 'Your teacher has not set the bow times yet.' : 'Set when each group goes first: “Set the times while it plays” (Teacher › Curtain call).') + '</p>'; return; }
    var A = loadAudio(mu, P), audio = A.audio, raf = 0, fired = {}, readied = {};
    host.innerHTML = '<div class="bow-stage">' + counterHTML + '<div class="bow-next" id="bnext"></div><div class="bow-go" id="bgo" hidden></div><div class="bow-lyric muted" id="bmus">' + sym('🎵') + esc(mu.name) + '</div></div>' +
      '<div class="row" style="margin-top:10px;flex-wrap:wrap;align-items:center"><button class="round big" id="bpl" aria-label="Play">' + icon('play') + '</button><button class="btn small" id="bbk">Back 10 s</button>' + seekHTML + '<b id="btm" class="lt-time">0:00</b></div><div class="row" style="flex-wrap:wrap">' +
      (opts.starts ? cues.map(function (c) { return '<button class="btn small" data-bfrom="' + c.t + '">From group ' + (c.i + 1) + '</button>'; }).join('') : '') +
      '<label class="switch" style="border:0"><span>🔔 Chimes</span><input type="checkbox" id="bch" checked></label>' + counterSwitch(P) + '</div>';
    var $ = function (id) { return host.querySelector('#' + id); }, chimes = function () { return $('bch') && $('bch').checked; };
    var last = cues[cues.length - 1].t, bar = function () {};
    function frame() {
      var t = A.time();
      $('btm').textContent = T.clock(t); counterDraw(host, P, t); bar(t);
      cues.forEach(function (c) {
        /* a yellow GET READY 3 seconds before (Colleen 2026-10-25: "put up a 'get ready' yellow screen 3 seconds before that") */
        if (t >= c.t - 3 && t < c.t) {
          if (!readied[c.i]) { readied[c.i] = 1; if (chimes()) READY(); }
          var gr = $('bgo'); gr.hidden = false; gr.style.background = '#f2c200'; gr.style.color = '#1d1a2e'; gr.innerHTML = '<div>GET READY</div><div class="bow-go-who">' + esc(c.label) + ' · ' + Math.ceil(c.t - t) + '</div><div class="bow-go-from">from ' + esc(c.from) + '</div>';
        }
        if (!fired[c.i] && t >= c.t && t < c.t + 3) {
          fired[c.i] = 1; if (chimes()) GO();
          var go = $('bgo'); go.hidden = false; go.style.background = c.color; go.style.color = '#fff'; go.innerHTML = '<div>GO!</div><div class="bow-go-who">' + esc(c.label) + '</div><div class="bow-go-from">from ' + esc(c.from) + '</div>';
          setTimeout(function () { if ($('bgo')) $('bgo').hidden = true; }, 3000);
        }
      });
      var next = cues.find(function (c) { return c.t > t; }), nx = $('bnext');
      if (next) { var s = Math.ceil(next.t - t); nx.style.borderColor = next.color; nx.innerHTML = '<div class="muted small">Next</div><div class="bow-next-who" style="color:' + next.color + '">' + esc(next.label) + '</div><div>From ' + esc(next.from) + ' · ' + (eightSec(P) && startN(next.g) ? 'goes ' : 'when ') + esc(listenFor(P, next.i)) + '</div><div class="bow-count">' + (s <= 10 ? s : '') + '</div>'; }
      else if (t > last + 3 && rowAt(P, t) && rowAt(P, t).part) { var rp = rowAt(P, t); nx.style.borderColor = '#18233a'; nx.innerHTML = '<div class="muted small">' + esc(rp.music || 'Now') + '</div><div class="bow-next-who">' + sym('🌟') + esc(rp.what) + '</div>'; }
      else if (t > last + 3) { var fs = finaleSong(); nx.innerHTML = '<div class="bow-next-who">' + sym('🌟') + (fs ? 'Everyone is on stage. Roll right into ' + esc(fs.title) + '!' : 'Everyone is on stage.') + '</div>' + (P.endBow ? '<div class="muted">At the very end, the Company bow: ' + esc(P.company.note || '') + '</div>' : ''); }
      if (opts.stopAfter != null && t > opts.stopAfter) { audio.pause(); }
      if (!audio.paused) raf = requestAnimationFrame(frame);
    }
    function setPP() { var b = $('bpl'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); } }
    function seek(t) { fired = {}; readied = {}; cues.forEach(function (c) { if (c.t < t) { fired[c.i] = 1; readied[c.i] = 1; } }); A.seek(Math.max(0, t)); }
    $('bpl').onclick = function () { A.ready.then(function () { if (audio.paused) { if (opts.startAt != null && A.time() === 0) seek(opts.startAt); A.play(); raf = requestAnimationFrame(frame); } else audio.pause(); setPP(); }); };
    $('bbk').onclick = function () { A.ready.then(function () { seek(Math.max(0, A.time() - 10)); frame(); }); };
    host.querySelectorAll('[data-bfrom]').forEach(function (b) { b.onclick = function () { A.ready.then(function () { seek(+b.dataset.bfrom - 8); A.play(); setPP(); raf = requestAnimationFrame(frame); }); }; });
    audio.addEventListener('pause', function () { setPP(); frame(); }); audio.addEventListener('ended', function () { setPP(); frame(); });
    counterWire(host, P, frame);
    bar = seekBar(host, A, function (t, drag) { A.ready.then(function () { seek(t); if (audio.paused) frame(); }); });
    T.cleanup.push(function () { cancelAnimationFrame(raf); });
    frame();
  }

  /* ---------- Teacher › Curtain call ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.curtain = function (args) {
    if (args && args[0] === 'run') return runPage();
    if (args && args[0] === 'count') return countPage(args[1] === 'watch');
    T.setBar('Curtain call', '#/teacher/bows');
    var P = JSON.parse(JSON.stringify(plan())), O = T.O(), fin = finaleSong();
    var withTracks = O.songs.filter(function (s) { var t = (T.show.tracks || {})[s.id]; return t && (t.performance || t.rehearsal); });
    var sel = function (attr, list, v) { return '<select ' + attr + '>' + list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    var fmt = function (t) { return t == null ? '' : Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4); };
    var parse = function (s) { s = String(s || '').trim(); if (!s) return null; var m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/); var v = m ? +m[1] * 60 + +m[2] : +s; return isNaN(v) ? null : Math.max(0, +v.toFixed(1)); };
    var tap = null;      // setting the times while the music plays: { audio, k }
    function draw() {
      var mu = music(P);
      fin = P.finale ? T.songById(P.finale) || null : null;      // the song picked on this page, saved or not
      var e8 = eightSec(P), cur = P.music || {};
      var opt = function (sId, kind, label) { var on = !cur.own && cur.song === sId && (cur.kind || 'performance') === kind; return '<option value="' + kind + ':' + sId + '"' + (on ? ' selected' : '') + '>' + label + '</option>'; };
      app.innerHTML = '<div class="card"><h2>' + sym('🌟') + 'Curtain call</h2><p class="muted">Each group runs on and bows to the bow music at its own moment, set in 8-counts' + (fin ? '; when the bow music ends, everyone rolls straight into “' + esc(fin.title) + '”' : '') + (P.endBow ? '; at the very end, the Company bow' : '') + '. Each performer sees their bow under <b>My bow</b>, with a countdown, a red X until their turn, Get ready, and GO.</p>' +
        '<div class="row"><label class="f grow" style="margin:0">Bow music<select id="mus"><option value="">Pick…</option>' + withTracks.map(function (s) { var t = (T.show.tracks || {})[s.id]; return (t.rehearsal ? opt(s.id, 'rehearsal', 'Guide vocals (with singers): ' + esc(s.title)) : '') + (t.performance ? opt(s.id, 'performance', 'Band track (no singers): ' + esc(s.title)) : ''); }).join('') + (cur.own ? '<option value="own" selected>Your own recording (uploaded)</option>' : '') + '</select></label>' +
        '<label class="btn" style="margin:0">' + sym('⬆️') + 'Upload a recording<input type="file" id="upl" accept="audio/*" hidden></label></div>' +
        (mu ? '<div class="row bow-listen" style="align-items:center;flex-wrap:wrap;margin-top:6px"><button class="round" id="lpl" aria-label="Play">' + icon('play') + '</button><button class="btn small" id="lbk">Back 10 s</button>' + seekHTML + '<b id="ltm" class="lt-time">0:00</b><span id="l8" class="small muted"></span></div>' : '') +
        '<p class="muted small">Try each and decide later: switching does not lose the 8-counts (check the tempo and count 1 again for a different recording). Before using a cast recording or the movie soundtrack in a performance, check that your license allows it.</p>' +
        (mu ? '' : '<p class="err">' + sym('⚠️') + 'Pick or upload the bow music.</p>') +
        '<div class="row"><label class="f" style="margin:0">Start this far into the track (seconds)<input id="mstart" inputmode="decimal" value="' + ((P.music && P.music.start) || 0) + '" style="width:90px"></label><span class="muted small">It fades in from there (0 = from the very start).</span>' +
        '<label class="switch" style="border:0"><span>Loop it if the bows run longer</span><input type="checkbox" id="mloop"' + (!P.music || P.music.loop !== false ? ' checked' : '') + '></label></div>' +
        '<div class="bow-counts"><h3 style="margin:10px 0 4px">' + sym('🔢') + 'Counting in 8s</h3>' +
        (P.counts && P.counts.fit ? '<p style="margin:4px 0">' + sym('✅') + '<b>Counted from your taps:</b> a steady ' + P.counts.bpm + ' beats a minute' + (P.counts.double ? ' (counted in double time: ' + Math.round(P.counts.bpm * 2) + ')' : '') + ', count 1 at ' + fmt(P.counts.first) + ' (the average of ' + P.counts.fit.used + ' taps' + (P.counts.fit.off ? '; ' + P.counts.fit.off + ' that were clearly off were left out' : '') + (P.counts.fit.filled ? '; ' + P.counts.fit.filled + ' missed 1' + (P.counts.fit.filled === 1 ? '' : 's') + ' filled in' : '') + ').' + ((P.counts.fit.fours || []).length ? ' 8-count ' + P.counts.fit.fours.join(', ') + ' ' + (P.counts.fit.fours.length === 1 ? 'is a 4-count transition' : 'are 4-count transitions') + '.' : '') + '</p>' : '') +
        '<div class="row" style="flex-wrap:wrap;align-items:center">' + (mu && P.counts && P.counts.fit ? '<button class="btn primary" id="cprev">' + icon('play') + 'Preview the counting</button>' : '') + (mu ? '<button class="btn' + (P.counts && P.counts.fit ? '' : ' primary') + '" id="cnt">' + sym('👆') + (P.counts && P.counts.fit ? 'Count the music again' : 'Count the music: tap the 1s and the 2–8s') + '</button>' : '') + '<span class="muted small grow">' + (e8 ? 'One 8-count ≈ ' + e8.toFixed(2) + ' seconds.' : '') + '</span></div>' +
        (mapOf(P) ? '' : '<details style="margin-top:6px"><summary class="small">' + (P.counts && P.counts.fit ? 'Or change the tempo by hand' : 'Or type a steady tempo') + '</summary><div class="row" style="flex-wrap:wrap;align-items:flex-end"><label class="f" style="margin:0">Tempo (beats a minute)<input id="cbpm" inputmode="decimal" value="' + (P.counts && P.counts.bpm || '') + '" placeholder="e.g. 120" style="width:90px"></label>' +
        '<label class="f" style="margin:0">Count 1 of the first 8 is at<input id="cfirst" value="' + fmt(P.counts && P.counts.first != null ? P.counts.first : 0) + '" style="width:90px"></label>' +
        (mu ? '<button class="btn" id="tapbeat">' + sym('👏') + 'Tap the beat while it plays</button>' : '') + '</div></details>') +
        '<label class="switch" style="border:0;margin-top:6px"><span>Show the 8-counts on the screen when they practice: a big “8-count 7” and 1 to 8 lighting up <span class="muted small">(each device can also switch it)</span></span><input type="checkbox" id="cshow"' + (P.counts && P.counts.show ? ' checked' : '') + '></label></div>' +
        '<div class="row" style="margin-top:8px">' + (mu ? '<button class="btn primary" id="taps">' + sym('⏱') + 'Tap the run-on times while it plays</button><button class="btn" id="even">Spread them evenly</button>' : '') + '<button class="btn" id="rehb">' + icon('play') + 'Rehearse the bows</button><button class="btn quiet" onclick="print()">' + icon('print') + 'Print the bow plan</button></div><p class="muted small" id="tapmsg"></p></div>' +
        P.groups.map(function (g, i) {
          return '<div class="card bow-card" data-g="' + i + '" style="border-left:8px solid ' + COLORS[i % COLORS.length] + '"><div class="row"><b>Group ' + (i + 1) + '</b><input data-k="name" value="' + esc(g.name) + '" class="grow" aria-label="Group name">' +
            '<button class="btn small quiet" data-up="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Earlier">↑</button><button class="btn small quiet" data-down="' + i + '"' + (i < P.groups.length - 1 ? '' : ' disabled') + ' aria-label="Later">↓</button><button class="btn small quiet" data-del="' + i + '">Remove</button></div>' +
            '<div class="row">' + (e8 ? '<label class="f" style="margin:0">Starts on 8-count<span class="row" style="gap:4px"><button type="button" class="btn small" data-e8="' + i + '|-1" aria-label="One 8-count earlier">−</button><input data-k="eights" inputmode="numeric" value="' + (startN(g) != null ? startN(g) : '') + '" style="width:64px"><button type="button" class="btn small" data-e8="' + i + '|1" aria-label="One 8-count later">+</button><span class="muted small">= ' + (timeOf(g, P) != null ? T.clock(timeOf(g, P)) : '–') + '</span></span>' + (g.eights == null && g.at != null ? '<span class="small">Tapped: ' + fmt(g.at) + (eightAt(P, g.at) ? ' (8-count ' + eightAt(P, g.at).n + ', count ' + eightAt(P, g.at).beat + ')' : '') + '. Type an 8-count to use that instead.</span>' : '') + '</label>' :
              '<label class="f" style="margin:0">Goes at (in the bow music)<span class="row" style="gap:4px"><button type="button" class="btn small" data-nudge="' + i + '|-0.5" aria-label="Earlier">−</button><input data-k="at" value="' + fmt(g.at) + '" placeholder="0:00" style="width:80px"><button type="button" class="btn small" data-nudge="' + i + '|0.5" aria-label="Later">+</button></span></label>') +
            '<label class="f" style="margin:0">Music<input data-k="music" value="' + esc(g.music || '') + '" placeholder="e.g. Troy verse" style="width:140px"></label><label class="f" style="margin:0">Enters from' + sel('data-k="from"', FROM, g.from) + '</label><label class="f" style="margin:0">Stands' + sel('data-k="row"', ROWS, g.row) + '</label>' +
            '<label class="f grow" style="margin:0">Note for them<input data-k="note" value="' + esc(g.note || '') + '" placeholder="e.g. hands joined, bow on 3"></label></div>' +
            '<p class="muted small" style="margin:4px 0">Goes ' + (eightSec(P) && g.eights != null ? '' : 'when ') + esc(listenFor(P, i)) + '. (Times count from where the bow music starts.)</p>' +
            '<details><summary class="small">Who: ' + esc(membersOf(g).map(function (m) { return m.name; }).join(', ') || 'nobody yet') + '</summary><div class="row" style="flex-wrap:wrap;margin-top:6px">' +
            O.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return '<label class="chipbox"><input type="checkbox" data-ch="' + c.id + '"' + (g.chars.indexOf(c.id) >= 0 ? ' checked' : '') + '> ' + T.chip(c.id) + '</label>'; }).join('') + '</div>' +
            '<p class="muted small" style="margin:8px 0 4px">Who enters from where (two people can come from opposite sides on the same count):</p><div class="row" style="flex-wrap:wrap;gap:6px">' +
              membersOf(g, i).map(function (m) { var k = keyOf(m), v = sideOfMember(g, m); if (v === g.from && !(g.sides || {})[k]) v = ''; return '<label class="chipbox">' + (m.a ? esc(m.name) : T.chip(m.c)) + ' <select data-side="' + i + '|' + esc(k) + '"><option value="">Same as the group (' + esc(g.from) + ')</option>' + FROM.filter(function (x) { return x !== 'Both sides'; }).map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>' +
            ((T.show.cast || []).length ? '<p class="muted small" style="margin:8px 0 4px">Also these Company members (whatever their role):</p><div class="row" style="flex-wrap:wrap">' + (T.show.cast || []).filter(function (a) { return a.name; }).map(function (a) { return '<label class="chipbox"><input type="checkbox" data-am="' + a.id + '"' + ((g.cast || []).indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + esc(a.name) + '</label>'; }).join('') + '</div>' : '') + '</details></div>';
        }).join('') +
        '<div class="row"><button class="btn" id="addg">+ Add a group</button></div>' +
        '<div class="card bow-card" style="border-left:8px solid #8a8f9c"><b>' + sym('🎶') + 'The other parts of the music</b><p class="muted small" style="margin:4px 0 8px">What everyone does when no group is bowing: a hold, the chorus choreography, the boogie during the fade-out. Each starts on an 8-count and runs until the next row.</p>' +
          (P.parts || []).map(function (p, k) { return '<div class="row" data-part="' + k + '" style="flex-wrap:wrap;gap:8px;align-items:flex-end"><label class="f" style="margin:0">Starts on 8-count<input data-pk="eight" inputmode="numeric" value="' + (p.eight || '') + '" style="width:64px"></label><label class="f" style="margin:0">Music<input data-pk="music" value="' + esc(p.music || '') + '" placeholder="e.g. Chorus" style="width:140px"></label><label class="f grow" style="margin:0">What happens<input data-pk="what" value="' + esc(p.what || '') + '" placeholder="e.g. Everyone dances the chorus choreo"></label><button class="btn small quiet" data-pdel="' + k + '">Remove</button></div>'; }).join('') +
          '<div class="row" style="margin-top:8px"><button class="btn small" id="addp">+ Add a part</button></div></div>' +
        (e8 ? '<div class="card"><h3 style="margin-top:0">' + sym('📋') + 'The bows, 8-count by 8-count</h3>' + (rowsOf(P).length ? '<table class="small" style="width:100%"><thead><tr><th style="text-align:left">Music</th><th style="text-align:left">8-counts</th><th style="text-align:left">What happens</th><th style="text-align:right">Starts at</th></tr></thead><tbody>' +
          (rowsOf(P)[0].n > 1 ? '<tr><td></td><td>1–' + (rowsOf(P)[0].n - 1) + '</td><td class="muted">(nothing set: hold)</td><td style="text-align:right">' + T.clock(firstOne(P)) + '</td></tr>' : '') +
          rowsOf(P).map(function (x) { return '<tr><td>' + esc(x.music) + '</td><td>' + x.n + (x.to == null ? '–end' : x.to > x.n ? '–' + x.to : '') + '</td><td>' + (x.color ? '<span style="color:' + x.color + ';font-weight:700">' + esc(x.what) + '</span>' : esc(x.what)) + '</td><td style="text-align:right">' + T.clock(startOf(P, x.n)) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Give the groups and parts their 8-counts.</p>') + '</div>' : '') +
        /* what comes after the bows (Colleen 2026-10-26: "this does not exactly reflect how i want this to run. the bows happen and then we roll into
           the megamix"): the song right after the bow music, then an optional Company bow at the very end (P.endBow, off unless she turns it on) */
        '<div class="card bow-card" style="border-left:8px solid #18233a"><b>Then: roll straight into ' + (fin ? esc(fin.title) : 'the next song') + '</b>' +
        '<p class="muted small" style="margin:4px 0 8px">When the bow music ends, everyone is on stage and this starts right away.' + (fin && T.Megamix ? ' Its groups and sections: <a href="#/teacher/bows">Curtain call &amp; Megamix</a>.' : '') + '</p>' +
        '<div class="row"><label class="f grow" style="margin:0">Right after the bows<select id="fin"><option value="">Nothing: the show ends with the bows</option>' + O.songs.map(function (s) { return '<option value="' + s.id + '"' + (fin && s.id === fin.id ? ' selected' : '') + '>' + esc(s.title) + '</option>'; }).join('') + '</select></label></div>' +
        '<label class="switch"><span>A Company bow at the very end' + (fin ? ', after ' + esc(fin.title) : '') + '</span><input type="checkbox" id="cend"' + (P.endBow ? ' checked' : '') + '></label>' +
        (!P.endBow ? '' : '<label class="f">The Company bow<input id="cnote" value="' + esc(P.company.note || '') + '"></label>' +
        '<label class="switch"><span>The crew (in blacks) joins the line for the Company bow</span><input type="checkbox" id="ccrew"' + (P.crew !== false ? ' checked' : '') + '></label>' +
        (T.charById('trench') ? '<div class="switch"><span>The Trench Crew</span><div class="seg" id="ctr"><button type="button" data-tr="stage" aria-pressed="' + (P.trench !== 'pit') + '">Comes up for the Company bow</button><button type="button" data-tr="pit" aria-pressed="' + (P.trench === 'pit') + '">Bows from the pit</button></div></div>' : '')) + '</div>' +
        '<div class="dock"><div class="in"><button class="btn quiet" id="reset">Back to the suggested groups</button><button class="btn primary" id="sv" data-save>Save</button></div></div>';
      var keep = function () {
        app.querySelectorAll('.bow-card[data-g]').forEach(function (el) {
          var g = P.groups[+el.dataset.g], q = function (k) { return el.querySelector('[data-k="' + k + '"]'); };
          g.name = q('name').value.trim() || g.name; g.from = q('from').value; g.row = q('row').value; g.note = q('note').value.trim();
          if (q('at')) g.at = parse(q('at').value);
          if (q('eights')) { var ev = q('eights').value.trim(); g.eights = ev === '' || isNaN(+ev) ? null : Math.max(0, Math.round(+ev) - 1); }
          g.music = q('music').value.trim().slice(0, 60);
          g.chars = Array.from(el.querySelectorAll('[data-ch]:checked')).map(function (x) { return x.dataset.ch; });
          g.cast = Array.from(el.querySelectorAll('[data-am]:checked')).map(function (x) { return x.dataset.am; });
          var sd = {}; el.querySelectorAll('[data-side]').forEach(function (x) { if (x.value) sd[x.dataset.side.split('|').slice(1).join('|')] = x.value; }); g.sides = sd;
        });
        var ms = +document.getElementById('mstart').value; P.music = Object.assign({}, P.music, { start: isNaN(ms) ? 0 : Math.max(0, ms), loop: document.getElementById('mloop').checked });
        var c0 = P.counts || {}, bE = document.getElementById('cbpm'), fE = document.getElementById('cfirst'), bpm = bE ? +bE.value : +c0.bpm;
        P.counts = { bpm: bpm > 20 && bpm < 300 ? +bpm.toFixed(2) : null, first: fE ? parse(fE.value) || 0 : +c0.first || 0, show: document.getElementById('cshow').checked, taps: c0.taps, fit: c0.fit };
        if (c0.ones && !(c0.fit && (P.counts.bpm !== +c0.bpm || Math.abs(P.counts.first - (+c0.first || 0)) > 0.05))) P.counts.ones = c0.ones;
        if (c0.fit && (P.counts.bpm !== +c0.bpm || Math.abs(P.counts.first - (+c0.first || 0)) > 0.05)) delete P.counts.fit;      // changed by hand: a plain steady 8
        P.parts = Array.from(app.querySelectorAll('[data-part]')).map(function (el) { var v = function (k) { return el.querySelector('[data-pk="' + k + '"]').value.trim(); }; var n = Math.round(+v('eight')); return { eight: n > 0 ? n : null, music: v('music').slice(0, 60), what: v('what').slice(0, 120) }; }).filter(function (x) { return x.eight || x.what; });
        P.finale = document.getElementById('fin').value; P.endBow = document.getElementById('cend').checked;
        if (document.getElementById('cnote')) { P.company.note = document.getElementById('cnote').value.trim(); P.crew = document.getElementById('ccrew').checked; }
      };
      var $ = function (id) { return document.getElementById(id); };
      /* listen to the bow music here: play / pause, back 10 s, drag to any moment; shows the 8-count while it plays */
      if ($('lpl')) (function () {
        var A = null, raf = 0, host = $('lpl').parentNode, bar = function () {};
        var tick = function () { if (!A || !$('ltm')) return; var t = A.time(), e = eightAt(P, t); $('ltm').textContent = T.clock(t); $('l8').textContent = e ? '8-count ' + e.n + ', count ' + e.beat : ''; bar(t); if (!A.audio.paused) raf = requestAnimationFrame(tick); };
        var get = function () { if (!A) { keep(); A = loadAudio(mu, P); A.audio.addEventListener('pause', function () { var b = $('lpl'); if (b) b.innerHTML = icon('play'); tick(); }); bar = seekBar(host, A, function (t) { A.ready.then(function () { A.seek(t); tick(); }); }); T.cleanup.push(function () { cancelAnimationFrame(raf); }); } return A; };
        $('lpl').onclick = function () { var a = get(), b = this; a.ready.then(function () { if (a.audio.paused) { a.play(); b.innerHTML = icon('pause'); raf = requestAnimationFrame(tick); } else a.pause(); }, function (e) { T.toast(e.message, 5000); }); };
        $('lbk').onclick = function () { var a = get(); a.ready.then(function () { a.seek(Math.max(0, a.time() - 10)); tick(); }); };
        host.querySelector('[data-seek]').addEventListener('pointerdown', get, { once: true });      // dragging first also loads the music
      })();
      $('mus').onchange = function () { keep(); var v = this.value, k = v.split(':')[0]; if (k === 'rehearsal' || k === 'performance') P.music = { song: v.slice(k.length + 1), kind: k, start: P.music && P.music.start, loop: !P.music || P.music.loop !== false }; draw(); };
      if ($('cbpm')) $('cbpm').onchange = $('cfirst').onchange = function () { keep(); draw(); };
      /* where she sees her counting (Colleen 2026-10-25: "where can i see the counted bow now that i tapped it. there should be a button on the
         programming page to preview it"): the music with the counting big and a click on every beat */
      if ($('cprev')) $('cprev').onclick = function () { keep(); T.show.curtain = P; T.saveShow('Curtain call saved').then(function () { location.hash = '#/teacher/curtain/count/watch'; }); };
      if ($('cnt')) $('cnt').onclick = function () { keep(); T.show.curtain = P; T.saveShow('Curtain call saved').then(function () { location.hash = '#/teacher/curtain/count'; }); };
      app.querySelectorAll('[data-e8]').forEach(function (b) { b.onclick = function () { keep(); var q = b.dataset.e8.split('|'), g = P.groups[+q[0]]; g.eights = Math.max(0, (g.eights || 0) + +q[1]); draw(); }; });
      app.querySelectorAll('[data-k="eights"]').forEach(function (s2) { s2.onchange = function () { keep(); draw(); }; });
      /* the tempo and count 1: the music plays; tap along to the beat (8 or more taps give the tempo), then tap on a "1" */
      if ($('tapbeat')) $('tapbeat').onclick = function () {
        keep(); var A = loadAudio(mu, P), taps = [];
        var bar = document.createElement('div'); bar.className = 'dock'; bar.innerHTML = '<div class="in"><span class="grow" id="tbmsg">Tap Beat along with the music (8 taps or more), then tap “This is 1” on a count of 1.</span><button class="btn primary lt-now" id="tbbeat">Beat</button><button class="btn" id="tbone">This is 1</button><button class="btn quiet" id="tbstop">Done</button></div>';
        document.body.appendChild(bar);
        var msg = function (t) { var e = document.getElementById('tbmsg'); if (e) e.textContent = t; };
        var end = function () { A.audio.pause(); bar.remove(); draw(); T.toast('Tempo and count 1 set. Save to keep them.'); };
        A.ready.then(function () { A.seek(0); A.play(); });
        document.getElementById('tbbeat').onclick = function () {
          taps.push(A.time()); if (taps.length > 16) taps.shift();
          if (taps.length >= 4) { var d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); P.counts = Object.assign({}, P.counts, { bpm: +(60 / d).toFixed(1) }); msg('Tempo ' + P.counts.bpm + ' beats a minute (' + taps.length + ' taps). Keep tapping, or tap “This is 1” on a 1.'); }
        };
        document.getElementById('tbone').onclick = function () { P.counts = Object.assign({}, P.counts, { first: +A.time().toFixed(2) }); msg('Count 1 set at ' + T.clock(P.counts.first) + '. Tap Done, or tap again to change it.'); };
        document.getElementById('tbstop').onclick = end;
        T.cleanup.push(function () { bar.remove(); A.audio.pause(); });
      };
      $('upl').onchange = function () {
        var f = this.files[0]; if (!f) return; keep(); var m = $('tapmsg'); m.textContent = 'Uploading ' + f.name + '…'; T.toast('Uploading ' + f.name + '…', 4000);
        f.arrayBuffer().then(function (buf) { return T.audioCtx().decodeAudioData(buf.slice(0)).then(function (ab) { var ver = Date.now().toString(36); return Store.putTrack(T.key, T.proof, '__bows', 'performance', buf, ver).then(function () { var trs = T.show.tracks = T.show.tracks || {}; trs.__bows = { performance: { ver: ver, dur: Math.round(ab.duration * 10) / 10, size: f.size, name: f.name } }; P.music = { own: ver, start: 0, loop: false }; T.show.curtain = P; return T.saveShow('Bow music uploaded').then(function () { draw(); T.toast('Your recording is the bow music now (saved). Loop is off, since it fades out.'); }); }); }); })
          .catch(function (e) { m.textContent = 'That file could not be used: ' + (e.message || 'not an audio file') + '.'; T.toast('The recording did not upload: ' + (e.message || 'not an audio file') + '. The bow music has not changed.', 8000); });
      };
      app.querySelectorAll('[data-side]').forEach(function (x) { x.onchange = function () { keep(); draw(); }; });
      app.querySelectorAll('[data-ch],[data-am]').forEach(function (s) { s.onchange = function () { keep(); draw(); }; });
      app.querySelectorAll('[data-k="at"]').forEach(function (s) { s.onchange = function () { keep(); draw(); }; });
      app.querySelectorAll('[data-nudge]').forEach(function (b) { b.onclick = function () { keep(); var q = b.dataset.nudge.split('|'), g = P.groups[+q[0]]; g.at = Math.max(0, +((g.at || 0) + +q[1]).toFixed(1)); draw(); }; });
      app.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { keep(); var i = +b.dataset.up, x = P.groups.splice(i, 1)[0]; P.groups.splice(i - 1, 0, x); draw(); }; });
      app.querySelectorAll('[data-down]').forEach(function (b) { b.onclick = function () { keep(); var i = +b.dataset.down, x = P.groups.splice(i, 1)[0]; P.groups.splice(i + 1, 0, x); draw(); }; });
      app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { keep(); P.groups.splice(+b.dataset.del, 1); draw(); }; });
      app.querySelectorAll('[data-tr]').forEach(function (b) { b.onclick = function () { keep(); P.trench = b.dataset.tr; draw(); }; });
      $('addp').onclick = function () { keep(); var last = rowsOf(P).slice(-1)[0]; (P.parts = P.parts || []).push({ eight: last ? (last.n + 4) : 1, music: '', what: '' }); draw(); };
      app.querySelectorAll('[data-pdel]').forEach(function (b) { b.onclick = function () { keep(); P.parts.splice(+b.dataset.pdel, 1); draw(); }; });
      app.querySelectorAll('[data-pk="eight"]').forEach(function (x) { x.onchange = function () { keep(); draw(); }; });
      $('fin').onchange = $('cend').onchange = function () { keep(); draw(); };      // the card's title and its Company bow fields follow
      $('addg').onclick = function () { keep(); P.groups.push({ id: uid(), name: 'New group', chars: [], cast: [], at: null, from: sideFor(P.groups.length), row: ROWS[0], note: '' }); draw(); };
      $('sv').onclick = function () { keep(); T.show.curtain = P; T.saveShow('Curtain call saved'); };
      /* Rehearse plays the saved plan: save what is on the page first, so it is what plays */
      $('rehb').onclick = function () { keep(); T.show.curtain = P; T.saveShow('Curtain call saved').then(function () { location.hash = '#/teacher/curtain/run'; }); };
      /* back to the suggested groups keeps the music (an uploaded recording stays the bow music), its start and loop */
      $('reset').onclick = function () { if (!confirm('Go back to the suggested bow groups? The groups and their timing are replaced; your bow music stays. (Save to keep it.)')) return; keep(); var mus = P.music, keepC = T.show.curtain; delete T.show.curtain; P = JSON.parse(JSON.stringify(plan())); if (mus && (mus.own || mus.song)) P.music = mus; if (keepC) T.show.curtain = keepC; draw(); };
      /* spread evenly: the groups share the bow music, a little in from the start, leaving room at the end for the last bow */
      if ($('even')) $('even').onclick = function () {
        keep(); var A = loadAudio(mu, P), m = $('tapmsg'); m.textContent = 'Reading the length of the music…';
        A.ready.then(function () {
          var d = A.span(), n = P.groups.length, e = eightSec(P);
          if (e) { var total = Math.floor((d - firstOne(P) - 6) / e); P.groups.forEach(function (g, i) { g.eights = Math.max(0, Math.round(total * i / n)); }); }
          else P.groups.forEach(function (g, i) { g.at = +(2 + (d - 6) * i / n).toFixed(1); });
          draw(); T.toast('Spread over ' + T.clock(d) + ' of music. Save to keep it.');
        });
      };
      /* tap the times: the music plays; each tap of Now sets the next group's moment */
      if ($('taps')) $('taps').onclick = function () {
        keep(); var A = loadAudio(mu, P), k = 0, m = $('tapmsg');
        var bar = document.createElement('div'); bar.className = 'dock'; bar.innerHTML = '<div class="in"><b id="tapwho"></b><span class="grow"></span><button class="btn primary lt-now" id="tapnow">Now</button><button class="btn" id="tapstop">Stop</button></div>';
        document.body.appendChild(bar);
        var show = function () { var w = document.getElementById('tapwho'); if (w) w.textContent = k < P.groups.length ? 'Tap Now (or Space) on the count when Group ' + (k + 1) + ' (' + P.groups[k].name + ') runs on' : 'All set.'; };
        var end = function () { A.audio.pause(); bar.remove(); document.removeEventListener('keydown', key); draw(); T.toast('Times set. Rehearse to check them, then Save.'); };
        show(); m.textContent = 'Loading the music…';
        A.ready.then(function () { m.textContent = ''; A.seek(0); A.play(); });
        /* the moment she taps is count 1 of their run (Colleen 2026-10-25: "the time i select for the bow track will be the 1 count of the time they
           should be running"); with a tempo it snaps to the nearest beat, and to the 8-count when it lands on a 1 */
        var tapNow = function () {
          if (k >= P.groups.length) return end();
          var g = P.groups[k], t = A.time(), e = eightSec(P);
          var mp = mapOf(P);
          if (mp) { var near = mp.beats.reduce(function (a, x) { return Math.abs(x - t) < Math.abs(a - t) ? x : a; }, mp.beats[0]), oi = mp.ones.indexOf(near); if (Math.abs(near - t) < mp.len / 8 && oi >= 0) { g.eights = oi; g.at = null; } else { g.eights = null; g.at = +(Math.abs(near - t) < mp.len / 8 ? near : t).toFixed(2); } }
          else if (e) { var beat = e / 8, first = +P.counts.first || 0, b = Math.round((t - first) / beat), O = onesOf(P), oi = O ? O.indexOf(b) : (b >= 0 && b % 8 === 0 ? b / 8 : -1);
            if (oi < 0 && O && b > O[O.length - 1] && (b - O[O.length - 1]) % 8 === 0) oi = O.length - 1 + (b - O[O.length - 1]) / 8;
            if (oi >= 0) { g.eights = oi; g.at = null; } else { g.eights = null; g.at = +(first + b * beat).toFixed(2); } }
          else { g.eights = null; g.at = +t.toFixed(1); }
          k++; show(); if (k >= P.groups.length) setTimeout(end, 800);
        };
        document.getElementById('tapnow').onclick = tapNow;
        var key = function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapNow(); } };
        document.addEventListener('keydown', key); T.cleanup.push(function () { document.removeEventListener('keydown', key); });
        document.getElementById('tapstop').onclick = end;
        T.cleanup.push(function () { bar.remove(); });
      };
    }
    draw();
  };
  /* ---------- Count the music: tap 1 on every count 1 and 2–8 on the other counts, all the way through ----------
     (Colleen 2026-10-25: "stack the buttons with 1 on top and tap 2-8 on the bottom one"). Keys: 1 (or J) for a one, Space (or F) for 2–8.
     "Start at" re-taps from any 8-count: the taps before it are kept. Then ("i want to be able to watch back the counts you think are right and mark
     errors"): Watch back plays the music with the app's counting, big, and a click on every beat (the 1 louder); Mark wrong (or X) marks the
     8-count playing; tap any 8-count in the list to fix it: its 1 a count earlier or later, watch from there, or tap again from there. */
  /* the bows (the Curtain call page) */
  function countPage(autoWatch) {
    var P = JSON.parse(JSON.stringify(plan())), mu = music(P);
    if (!mu) { T.setBar('Count the music', '#/teacher/curtain'); app.innerHTML = '<p class="card">Pick or upload the bow music first (Teacher › Curtain call).</p>'; return; }
    countPageFor({ title: 'Count the music', back: '#/teacher/curtain', heading: 'Count the bow music', mu: mu, loadP: Object.assign({}, P, { music: Object.assign({}, P.music, { loop: false }) }), off: 0, counts: P.counts || {},
      save: function (c) { var Pn = JSON.parse(JSON.stringify(plan())); Pn.counts = Object.assign({}, Pn.counts, c); T.show.curtain = Pn; return T.saveShow('Your counting is saved'); } }, autoWatch);
  }
  /* any song (Colleen 2026-10-25: "i feel like the music counter where i tap out the rhythm might be useful for all songs"): T.show.songCounts[songId],
     on the band track's clock (what the song player plays), so a count tapped to the guide vocals is moved by the gap between the two tracks */
  T.songCounts = function (songId) { var c = (T.show.songCounts || {})[songId]; return c && +c.bpm > 0 ? c : null; };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.songcount = function (args) {
    var id = args && args[0], so = T.songById(id), tr = (T.show.tracks || {})[id] || {}, TO = (T.show.trackOffset || {})[id];
    if (!so || !(tr.rehearsal || tr.performance)) { T.setBar('Count the music', '#/teacher/songhub'); app.innerHTML = '<p class="card">Upload this song’s tracks first (Teacher › Songs).</p>'; return; }
    var kind = tr.rehearsal && (TO != null || !tr.performance) ? 'rehearsal' : 'performance';
    countPageFor({ title: 'Count: ' + so.title, back: '#/teacher/songhub', heading: 'Count “' + so.title + '”', mu: { id: id, kind: kind, ver: tr[kind].ver, name: kind === 'rehearsal' ? 'the guide vocals' : 'the band track' },
      loadP: { music: { start: 0, loop: false } }, off: kind === 'rehearsal' && tr.performance ? +TO || 0 : 0, counts: (T.show.songCounts || {})[id] || {},
      save: function (c) { var all = T.show.songCounts = T.show.songCounts || {}; all[id] = Object.assign({}, all[id], c); return T.saveShow('Counting saved for ' + so.title); } }, args[1] === 'watch');
  };
  function countPageFor(opt, autoWatch) {
    T.setBar(opt.title, opt.back);
    var C0 = opt.counts || {}, P = { counts: C0 }, mu = opt.mu, off = +opt.off || 0, dbl = !!C0.double;
    var taps = (C0.taps || []).slice(), edits = C0.fit && C0.ones ? { ones: C0.ones.slice() } : null, marks = {}, sel = -1;
    var from = '', mode = '', A0 = loadAudio(Object.assign({}, mu), opt.loadP), raf = 0, flash = 0, lastBeat = null;
    /* the counts' clock: the band track (a guide track runs `off` seconds ahead of it) */
    var A = { audio: A0.audio, ready: A0.ready, play: A0.play, pause: A0.pause, time: function () { return A0.time() - off; }, seek: function (t) { A0.seek(Math.max(0, t + off)); } };
    var onesT = function (list) { return list.filter(function (x) { return x[1]; }).map(function (x) { return x[0]; }); };
    /* the counting as it stands: her taps averaged, with her fixes */
    var cur = function () { var f = fitCounts(taps); if (!f) return null; if (edits && edits.ones) f.ones = edits.ones.slice(); return f; };
    var Q = function (f) { return Object.assign({}, P, { counts: { bpm: f.bpm, first: f.first, ones: f.ones } }); };      // as tapped (the list and the fixes)
    var QW = function (f) { return { counts: { bpm: f.bpm, first: f.first, ones: f.ones, double: dbl } }; };      // as watched: the speed she picked
    var startT = function (f, n) { return startOf(Q(f), n); };
    var lenOf = function (f, i) { return f.ones[i + 1] != null ? f.ones[i + 1] - f.ones[i] : null; };
    app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('👆') + esc(opt.heading || 'Count the music') + '</h2><p class="small muted">Playing ' + esc(mu.name) + '.</p><p><b>1. Tap:</b> press <b>Start</b> and tap along all the way through: <b>1</b> on every count of 1, <b>2–8</b> on every other count. The app averages your taps into one steady beat; a missed count is filled in, and a short phrase (a 4-count transition) stays short.</p>' +
      '<p><b>2. Check:</b> press <b>Watch back</b>: the music plays with the app’s counting and a click on every beat. When it’s wrong, press <b>Mark wrong</b> (or X), then fix that 8-count in the list.</p>' +
      '<p class="small muted">Keys: <b>1</b> for a one, <b>Space</b> for 2–8, <b>X</b> to mark. Tapping again from an 8-count keeps everything before it.</p>' +
      '<div class="switch"><span><b>Speed of the counts</b><br><span class="muted small">Tap at whichever speed is easy. Double time makes each of your counts two counts, so the 8-counts come twice as fast.</span></span><div class="seg" id="cspd"><button type="button" data-spd="0" aria-pressed="' + !dbl + '">As I tapped</button><button type="button" data-spd="1" aria-pressed="' + dbl + '">Double time</button></div></div>' +
      '<div class="row" style="flex-wrap:wrap;align-items:flex-end"><button class="btn primary" id="cgo">' + icon('play') + 'Start tapping</button><label class="f" style="margin:0">from<select id="cfrom"></select></label><button class="btn" id="cwatch">' + icon('play') + 'Watch back</button><b id="ctm" class="lt-time">0:00</b></div></div>' +
      '<div class="cnt-show" id="cshowbox" hidden><div class="cnt-show-n" id="cbig"></div><div class="bow-8-beats" id="cdots">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div><button class="btn cnt-mark" id="cmark">✗ Mark wrong</button></div>' +
      '<div class="cnt-pads" id="cpads"><button class="cnt-one" id="pone" disabled>1</button><button class="cnt-beat" id="pbeat" disabled>2 – 8</button></div>' +
      '<div class="card"><div class="row" style="flex-wrap:wrap"><b class="grow" id="csum"></b><button class="btn quiet" id="cclr">Clear all</button><button class="btn primary" id="csave" data-save>Save my counting</button></div><div id="cfix"></div><div id="clist" class="small cnt-list"></div></div>';
    var $ = function (id) { return document.getElementById(id); };
    function list() {
      var f = cur(), o = onesT(taps);
      $('csum').innerHTML = !o.length ? 'Nothing tapped yet' : !f ? o.length + ' 1s tapped: keep going' : 'Steady beat: <span style="font-size:1.2em">' + f.bpm + ' beats a minute</span>' + (dbl ? ' tapped, <b>' + Math.round(f.bpm * 2) + ' in double time</b>' : '') + ', count 1 at ' + T.clock(f.first) + ' · ' + f.used + ' of ' + f.taps + ' taps used' + (f.off ? ', ' + f.off + ' left out' : '') + (f.filled ? ', ' + f.filled + ' missed 1' + (f.filled === 1 ? '' : 's') + ' filled in' : '') + (edits ? ' · with your fixes' : '') + (dbl ? '<br><span class="small muted">The list below is your 8-counts as you tapped them; Watch back counts in double time.</span>' : '');
      $('clist').innerHTML = f ? f.ones.map(function (k, i) {
        var L = lenOf(f, i), cls = marks[i + 1] ? 'mark' : L == null || L === 8 ? '' : L === 4 ? 'four' : 'odd';
        return '<button type="button" class="cnt-item ' + cls + (sel === i ? ' sel' : '') + '" data-n="' + i + '">' + (marks[i + 1] ? '✗ ' : '') + '8-count ' + (i + 1) + ' · ' + T.clock(startT(f, i + 1)) + (L != null && L !== 8 ? ' · ' + L + ' counts' : '') + '</button>';
      }).join('') + (f.ones.some(function (k, i) { var L = lenOf(f, i); return L != null && L !== 8 && L !== 4; }) ? '<p class="cnt-note">Orange: not 8 counts (and not a 4-count transition). Watch it back: a 1 may be a count early or late.</p>' : '') : '';
      $('cfrom').innerHTML = '<option value="">the beginning</option>' + (f ? f.ones.map(function (k, i) { return '<option value="' + i + '"' + (from === String(i) ? ' selected' : '') + '>8-count ' + (i + 1) + '</option>'; }).join('') : '');
      app.querySelectorAll('.cnt-item').forEach(function (b) { b.onclick = function () { sel = +b.dataset.n; from = String(sel); list(); fixBar(); }; });
      fixBar();
    }
    /* fixing one 8-count: move its 1, watch it, tap it again, unmark */
    function fixBar() {
      var f = cur(), box = $('cfix'); if (!f || sel < 0 || sel >= f.ones.length) { box.innerHTML = ''; return; }
      var n = sel + 1;
      box.innerHTML = '<div class="cnt-fix"><b>8-count ' + n + '</b> starts at ' + T.clock(startT(f, n)) + (lenOf(f, sel) != null ? ', ' + lenOf(f, sel) + ' counts' : '') + '<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">' +
        '<button class="btn small" id="fe"' + (sel === 0 ? ' disabled' : '') + '>◀ Its 1 a count earlier</button><button class="btn small" id="fl">Its 1 a count later ▶</button>' +
        '<button class="btn small" id="fw">' + icon('play') + 'Watch from here</button><button class="btn small" id="ft">Tap again from here</button>' + (marks[n] ? '<button class="btn small quiet" id="fu">Unmark</button>' : '') + '</div></div>';
      var move = function (d) {
        var g = cur(), O = g.ones.slice(), v = O[sel] + d;
        if ((sel > 0 && v <= O[sel - 1]) || (O[sel + 1] != null && v >= O[sel + 1])) { T.toast('That would run into the next 8-count.'); return; }
        if (sel === 0) { T.toast('The first 1 is where the counting starts: tap again from the beginning to move it.'); return; }
        O[sel] = v; edits = { ones: O }; delete marks[n]; list();
      };
      $('fe').onclick = function () { move(-1); }; $('fl').onclick = function () { move(1); };
      $('fw').onclick = function () { watch(startT(cur(), n) - 3); };
      $('ft').onclick = function () { from = String(sel); startTap(); };
      if ($('fu')) $('fu').onclick = function () { delete marks[n]; list(); };
    }
    /* a soft click on every beat while watching back, louder on 1 */
    var click = function (one) { var ctx = T.audioCtx(), t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = one ? 1568 : 1046; g.gain.setValueAtTime(one ? 0.35 : 0.18, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06); o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 0.07); };
    function tick() {
      var t = A.time(); $('ctm').textContent = T.clock(t);
      var f = cur(), at = f ? eightAt(QW(f), t) : null;
      if (mode === 'watch') {
        $('cbig').textContent = at ? '8-count ' + at.n : 'Count 1 is coming';
        $('cdots').querySelectorAll('span').forEach(function (x, i) { x.className = at && i < at.beat ? (i === at.beat - 1 ? 'now' : 'past') : ''; });
        var key = at ? at.n + ':' + at.beat : null;
        if (key && key !== lastBeat) { lastBeat = key; click(at.beat === 1); }
      }
      if (!A.audio.paused) raf = requestAnimationFrame(tick);
    }
    function stop() { A.pause(); mode = ''; $('cgo').innerHTML = icon('play') + 'Start tapping'; $('cwatch').innerHTML = icon('play') + 'Watch back'; $('pone').disabled = $('pbeat').disabled = true; $('cshowbox').hidden = true; $('cpads').hidden = false; list(); }
    function startTap() {
      A.ready.then(function () {
        if (mode) stop();
        var f = cur(), cut = from !== '' && f && f.ones[+from] != null ? startT(f, +from + 1) : 0;
        taps = taps.filter(function (x) { return x[0] < cut - 0.12; });      // keep what comes before; tap again from there
        edits = null; Object.keys(marks).forEach(function (k) { if (+k > +from) delete marks[k]; });
        mode = 'tap'; $('cpads').hidden = false; $('cshowbox').hidden = true;
        A.seek(Math.max(0, cut - 4)); A.play(); $('cgo').innerHTML = icon('pause') + 'Stop';
        $('pone').disabled = $('pbeat').disabled = false; $('pone').focus(); raf = requestAnimationFrame(tick); list();
      }, function (e) { T.toast(e.message, 5000); });
    }
    function watch(at) {
      if (!cur()) { T.toast('Tap the music first.'); return; }
      A.ready.then(function () {
        if (mode) stop();
        mode = 'watch'; lastBeat = null; $('cpads').hidden = true; $('cshowbox').hidden = false;
        A.seek(Math.max(0, at || 0)); A.play(); $('cwatch').innerHTML = icon('pause') + 'Stop'; raf = requestAnimationFrame(tick);
      });
    }
    var tap = function (one) {
      if (mode !== 'tap' || A.audio.paused) return;
      var t = +A.time().toFixed(3); taps.push([t, one ? 1 : 0]);
      var b = $(one ? 'pone' : 'pbeat'); b.classList.add('hit'); clearTimeout(flash); flash = setTimeout(function () { b.classList.remove('hit'); }, 90);
      if (one) list();
    };
    var mark = function () { if (mode !== 'watch') return; var f = cur(), at = f ? eightAt(Q(f), A.time()) : null; if (!at) return; marks[at.n] = 1; sel = at.n - 1; T.toast('8-count ' + at.n + (dbl ? ' (as tapped)' : '') + ' marked', 1500); list(); };
    app.querySelectorAll('[data-spd]').forEach(function (b) { b.onclick = function () { dbl = b.dataset.spd === '1'; app.querySelectorAll('[data-spd]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); lastBeat = null; list(); }; });
    $('pone').onclick = function () { tap(true); }; $('pbeat').onclick = function () { tap(false); }; $('cmark').onclick = mark;
    var key = function (e) {
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === '1' || e.key === 'j' || e.key === 'J') { e.preventDefault(); tap(true); }
      else if (e.key === ' ' || e.key === 'f' || e.key === 'F') { e.preventDefault(); tap(false); }
      else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); mark(); }
    };
    document.addEventListener('keydown', key);
    T.cleanup.push(function () { document.removeEventListener('keydown', key); cancelAnimationFrame(raf); });
    $('cgo').onclick = function () { if (mode === 'tap') stop(); else { from = $('cfrom').value; startTap(); } };
    $('cwatch').onclick = function () { if (mode === 'watch') stop(); else { var f = cur(), v = $('cfrom').value; watch(v !== '' && f ? startT(f, +v + 1) - 3 : 0); } };
    $('cfrom').onchange = function () { from = this.value; };
    A.audio.addEventListener('ended', stop);
    $('cclr').onclick = function () { if (taps.length && !confirm('Clear all your taps?')) return; taps = []; edits = null; marks = {}; sel = -1; list(); };
    if (autoWatch && cur()) setTimeout(function () { watch(0); }, 60);      // Preview the counting (Curtain call page)
    $('csave').onclick = function () {
      var f = cur(); if (!f) { T.toast('Tap at least two 1s first.'); return; }
      if (mode) stop();
      opt.save({ taps: taps.slice().sort(function (a, b) { return a[0] - b[0]; }), bpm: f.bpm, first: f.first, ones: f.ones, double: dbl, raw: undefined,
        fit: { used: f.used, off: f.off, filled: f.filled, fixed: !!edits, fours: f.ones.map(function (k, i) { return lenOf(f, i) === 4 ? i + 1 : 0; }).filter(Boolean), at: new Date().toISOString().slice(0, 10) } })
        .then(function () { location.hash = opt.back; });
    };
    list();
  }
  function runPage() {
    T.setBar('Rehearse the bows', '#/teacher/curtain');
    var fin = finaleSong(), P0 = plan();
    app.innerHTML = '<div class="card noprint"><h2>' + sym('🌟') + 'Rehearse the bows</h2><p class="muted">Put this on the projector. The bow music plays; four seconds before each group goes, a soft chime, and when it is their turn a bell and a big GO in the group’s color. ' + (fin ? 'When the bow music ends, roll straight into ' + esc(fin.title) + '.' : '') + (P0.endBow ? ' At the very end, the Company bow.' : '') + '</p></div><div id="bhost"></div>' +
      (fin ? '<p class="center" style="margin-top:12px"><a class="btn" href="#/song/' + fin.id + '">' + sym('🎵') + 'Then: ' + esc(fin.title) + '</a></p>' : '');
    player(document.getElementById('bhost'), { starts: true });
  }

  /* ---------- Students: My bow ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.bow = function () {
    T.setBar('My bow', '#/home');
    var me = T.me, P = plan(), gi = me ? groupOf(me.chars, me.id) : -1, fin = finaleSong();
    if (gi < 0) { app.innerHTML = '<div class="card"><h2>' + sym('🌟') + 'My bow</h2><p>' + (me && me.chars.length ? 'Your teacher has not put your role in a bow group yet.' : 'You will see your bow once you have a role.') + '</p><p>Everyone bows together at the end: ' + esc(P.company.note || '') + '</p></div>'; return; }
    var g = P.groups[gi], col = COLORS[gi % COLORS.length], after = eightSec(P) ? rowsOf(P).filter(function (x) { return x.part && x.n > (startN(g) || 0); }) : [];
    var others = membersOf(g, gi).filter(function (m) { return !(m.a && me.id && m.a.id === me.id) && !(m.c && me.chars.indexOf(m.c) >= 0); });
    app.innerHTML = '<div class="card bow-mine" style="border-left:10px solid ' + col + '"><div class="muted">Your bow</div><h2 style="color:' + col + ';margin:2px 0 10px">Group ' + (gi + 1) + ' of ' + P.groups.length + ': ' + esc(g.name) + '</h2>' +
      '<div class="bow-steps">' +
      '<div><span class="bow-n">1</span><b>Go</b><br>' + (eightSec(P) && g.eights != null ? '' : 'when ') + esc(listenFor(P, gi)) + '</div>' +
      '<div><span class="bow-n">2</span><b>Run on from</b><br>' + esc(mySide(g, me)) + '</div>' +
      '<div><span class="bow-n">3</span><b>Bow, then stand in the</b><br>' + esc(g.row) + '</div>' +
      after.map(function (x, k) { return '<div><span class="bow-n">' + (4 + k) + '</span><b>8-count ' + x.n + (x.music ? ': ' + esc(x.music) : '') + '</b><br>' + esc(x.what) + '</div>'; }).join('') +
      (fin ? '<div><span class="bow-n">' + (4 + after.length) + '</span><b>Roll straight into</b><br>' + esc(fin.title) + (T.Megamix ? ' (your sections are below)' : '') + '</div>' : '') +
      (P.endBow ? '<div><span class="bow-n">' + (4 + after.length + (fin ? 1 : 0)) + '</span><b>Company bow</b><br>' + esc(P.company.note || 'everyone bows together') + '</div>' : '') + '</div>' +
      (g.note ? '<p class="card" style="background:var(--hi);margin-top:10px">' + sym('📌') + esc(g.note) + '</p>' : '') +
      '<h3 style="margin-top:14px">You bow with</h3><div class="row" style="flex-wrap:wrap">' + (others.length ? others.map(function (m) { var sd = sideOfMember(g, m), diff = sd !== mySide(g, me) ? ' <span class="muted small">from ' + esc(sd.toLowerCase()) + '</span>' : ''; return (m.a ? '<span class="chip">' + T.face(m.a, 28) + ' ' + esc(m.name) + '</span>' : T.chip(m.c)) + diff; }).join(' ') : '<span class="muted">just you</span>') + '</div>' +
      '<p class="muted small" style="margin-top:10px">Before you: ' + (gi ? P.groups.slice(0, gi).map(function (x) { return esc(x.name); }).join(' · ') : 'nobody, your group goes first!') + '</p></div>' +
      megamixCard(me) +
      '<div class="card"><h3>' + sym('🔔') + 'Practice my bow</h3><p class="muted small">Listen to the song. A red X means not yet; GET READY counts you in; GO means run on now.</p><div id="bhost"></div>' +
'</div>';
    countdown(document.getElementById('bhost'), gi);
    if (T.Megamix && T.Megamix.practice && document.getElementById('mxhost')) T.Megamix.practice(document.getElementById('mxhost'), me);
  };
  /* the Megamix after the bows (js/megamix.js): which sections are mine, in order; the last one is everyone */
  function megamixCard(me) {
    if (!T.Megamix || !me) return '';
    var m = T.Megamix.mine(me); if (!m.sections.length) return '';
    return '<div class="card"><h3>' + sym('🎶') + 'My Megamix</h3><p class="muted small">' + (T.Megamix.words().away === 'Upstage' ? 'After the bows, the whole Company stays on stage for the Megamix. In your sections, come downstage and dance; in the others, stay upstage, clap on 2 and 4 and cheer them on.' : 'After the bows, the Company performs the Megamix in sections. Be on stage for yours; rest offstage for the others.') + '</p><ol class="mx-mine">' +
      m.sections.map(function (x, k) { var on = x.all || m.ks.indexOf(k) >= 0; return '<li class="' + (on ? 'on' : 'off') + '">' + (on ? '<b>' + esc(x.name) + '</b>' + (x.all ? ' <span class="muted small">(everyone)</span>' : '') : '<span class="muted">' + esc(x.name) + ': ' + (T.Megamix.words().away === 'Upstage' ? 'upstage' : 'offstage') + '</span>') + '</li>'; }).join('') + '</ol><h4 style="margin:12px 0 6px">Practice my Megamix</h4><div id="mxhost"></div></div>';
  }
  /* Practice my bow: the song plays with a countdown to my moment; a big red X until it is close, a yellow GET READY for the last 3 seconds
     (3… 2… 1…), then a big green GO with a bell on count 1, then where to stand */
  function countdown(host, gi) {
    var P = plan(), mu = music(P), g = P.groups[gi], t0 = timeOf(g, P), e8 = eightSec(P), beat = e8 ? e8 / 8 : null;
    if (!mu) { host.innerHTML = '<p class="card">Your teacher has not picked the bow music yet.</p>'; return; }
    if (t0 == null) { host.innerHTML = '<p class="card">Your teacher has not set when your group goes yet.</p>'; return; }
    var cbar = function () {}, ready = 3, A = loadAudio(mu, P), audio = A.audio, raf = 0, said = {}, side = T.me ? mySide(g, T.me) : g.from;
    host.innerHTML = counterHTML + '<div class="bowcd wait" id="bcd" aria-live="polite"><div class="bowcd-x" aria-hidden="true">✕</div><div class="bowcd-big" id="bcdbig"></div><div class="bowcd-small" id="bcdsmall"></div></div>' +
      '<div class="row" style="margin-top:10px;flex-wrap:wrap;align-items:center"><button class="round big" id="bcpl" aria-label="Play">' + icon('play') + '</button>' + seekHTML + '<b id="bctm" class="lt-time">0:00</b></div><div class="row" style="flex-wrap:wrap"><button class="btn" id="bctop">From the top of the song</button><button class="btn" id="bcnear">Just before my turn</button>' +
      '<label class="switch" style="border:0"><span>🔔 Sounds</span><input type="checkbox" id="bcsnd" checked></label>' + counterSwitch(P) + '</div>';
    var $ = function (id) { return host.querySelector('#' + id); }, snd = function () { return $('bcsnd') && $('bcsnd').checked; };
    var mmss = function (x) { x = Math.max(0, Math.ceil(x)); return Math.floor(x / 60) + ':' + ('0' + x % 60).slice(-2); };
    function frame() {
      if (!$('bcd')) return;
      var t = A.time(), left = t0 - t, box = $('bcd'), big = $('bcdbig'), small = $('bcdsmall');
      $('bctm').textContent = T.clock(t); counterDraw(host, P, t); cbar(t);
      if (left > ready) {
        box.className = 'bowcd wait'; big.textContent = mmss(left);
        var at8 = eightAt(P, t), n8 = e8 ? (at8 ? Math.max(0, (startN(g) || 0) - at8.n) : (startN(g) || Math.ceil((t0 - firstOne(P)) / e8))) : 0;      // counted from count 1 of the first 8
        small.textContent = e8 && startN(g) ? 'You go on 8-count ' + startN(g) + ' · ' + n8 + ' to go' : e8 ? n8 + ' eight-counts to go' : 'until you run on';
      } else if (left > 0) {
        box.className = 'bowcd ready'; if (!said.r) { said.r = 1; if (snd()) READY(); }
        big.textContent = 'GET READY'; small.textContent = Math.ceil(left) + '…';
      } else if (left > -3) {
        box.className = 'bowcd go'; if (!said.g) { said.g = 1; if (snd()) GO(); }
        big.textContent = 'GO!'; small.textContent = 'Run on from ' + side;
      } else {
        var rp = rowAt(P, t);
        if (rp && rp.part && rp.n > (startN(g) || 0)) { box.className = 'bowcd go'; big.textContent = rp.what; small.textContent = rp.music ? rp.music + ' · 8-count ' + rp.n : '8-count ' + rp.n; }
        else { box.className = 'bowcd done'; big.textContent = '🙇 Bow!'; small.textContent = 'Then stand in the ' + g.row.toLowerCase(); }
      }
      if (!audio.paused) raf = requestAnimationFrame(frame);
    }
    function setPP() { var b = $('bcpl'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); } }
    var from = function (bt) { said = {}; A.ready.then(function () { A.seek(Math.max(0, bt)); if (audio.paused) A.play(); raf = requestAnimationFrame(frame); setPP(); }); };
    $('bcpl').onclick = function () { A.ready.then(function () { if (audio.paused) { if (A.time() === 0) said = {}; A.play(); raf = requestAnimationFrame(frame); } else audio.pause(); setPP(); }); };
    $('bctop').onclick = function () { from(0); };
    $('bcnear').onclick = function () { from(t0 - ready - 12); };
    audio.addEventListener('pause', function () { setPP(); frame(); });
    cbar = seekBar(host, A, function (t) { A.ready.then(function () { said = {}; A.seek(t); if (audio.paused) frame(); }); });
    counterWire(host, P, frame);
    T.cleanup.push(function () { cancelAnimationFrame(raf); });
    frame();
  }
})();
