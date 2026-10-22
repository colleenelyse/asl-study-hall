/* asl.cool/theatre Performances (Production › Performances):
   - the performances, with times, ticket links (a free general-admission ticketing site) and "relaxed performance" notes; the cast sees them on Today;
   - Plan show week (Colleen, 2026-10-21): Act 1 dress, Act 2 dress, full run (each in the regular class period), then the in-school shows; any evening for families;
   - the school-day version: the show worked down to a 45-minute bell-to-bell period for the in-school shows (classes come with their teachers), with
     cut moments bridged by a narrator reading our plain-language story; evening shows keep everything. MTI's license usually needs written
     permission for cuts, so the page says to ask first.
   T.show.production.performances = [{ id, date, time, kind: school|evening, relaxed, tickets, notes }]
   T.show.production.schoolCut = { target (minutes of show), cut [moment ids] } */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  var BRIDGE = 0.4;      // minutes a narrator bridge takes
  function P() { var p = T.production(); p.performances = p.performances || []; return p; }
  function cutSet() { var c = P().schoolCut; return c && c.cut && c.cut.length ? c.cut : null; }      // the cut moment ids, or null
  T.schoolCut = cutSet;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
  var addDays = function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  function time12(t) { if (!t) return ''; var a = t.split(':'), h = +a[0]; return (h % 12 || 12) + (a[1] === '00' ? '' : ':' + a[1]) + (h < 12 ? ' AM' : ' PM'); }
  function mins(m) { return m.song ? T.songMinutes(T.songById(m.song)) : (m.minutes || 1); }
  function label(m) { var s = T.sceneById(m.scene), so = m.song && T.songById(m.song); return 'Scene ' + s.num + ' · ' + (so ? '🎵 ' + so.title : '🗣️ ' + s.place); }

  /* ---------- the school-day version ---------- */
  /* how long a version runs: the moments kept (talking scaled by a timed run, songs from the tracks) + scene changes + optional narrator bridges */
  function cfg() { var p = P(); var c = p.schoolCut = p.schoolCut || {}; if (!c.target) c.target = 40; c.cut = c.cut || []; if (c.changeSecs === undefined) c.changeSecs = 15; return c; }
  /* a song with an uploaded track has its real length; everything else is a guess, scaled to match a timed full run */
  function known(m) { var t = m.song && T.show.tracks && T.show.tracks[m.song]; return !!(t && ((t.performance && t.performance.dur) || (t.rehearsal && t.rehearsal.dur))); }
  function scale() {
    var c = cfg(); if (!c.timed) return 1;
    var ms = T.O().moments, fixed = 0, guess = 0;
    ms.forEach(function (m) { if (known(m)) fixed += mins(m); else guess += mins(m); });
    var changes = (T.O().scenes.length - 1) * c.changeSecs / 60, left = c.timed - fixed - changes;
    return guess > 0 && left > 0 ? left / guess : 1;
  }
  var len = function (m) { return known(m) ? mins(m) : mins(m) * scale(); };
  function lengthOf(cut) {
    var c = cfg(), k = scale(), ms = T.O().moments, total = 0, gap = false, scenesIn = {};
    ms.forEach(function (m) {
      if (cut.indexOf(m.id) >= 0) { if (!gap && c.bridges) total += BRIDGE; gap = true; return; }
      total += known(m) ? mins(m) : mins(m) * k; gap = false; scenesIn[m.scene] = 1;
    });
    total += Math.max(0, Object.keys(scenesIn).length - 1) * c.changeSecs / 60;
    return Math.round(total * 10) / 10;
  }
  /* only the show's own ranked cut ideas, in order, until it fits (never more: the teacher chooses anything beyond them) */
  function suggest(target) {
    var ideas = T.O().cutIdeas || [], cut = [];
    for (var i = 0; i < ideas.length && lengthOf(cut) > target; i++) cut = cut.concat(ideas[i].moments);
    return cut;
  }
  T.cutView = function () {
    var c = cfg(), ms = T.O().moments, ideas = T.O().cutIdeas || [], notes = T.O().cutNotes || [];
    var full = lengthOf([]), now = lengthOf(c.cut), over = now > c.target, prev = false;
    return '<div class="card"><h3>' + sym('🏫') + 'School-day version (45 minutes, bell to bell)</h3>' +
      '<p class="muted">For the in-school shows. Untick a moment to cut it from the school-day show; evening shows keep everything. Students see both versions in My Schedule.</p>' +
      '<p class="small" style="color:var(--warn)">⚠️ Ask Music Theatre International for written permission before performing a shortened version: their license usually does not allow cuts without it.</p>' +
      notes.map(function (n) { return '<p class="small">' + sym('💡') + esc(n) + '</p>'; }).join('') +
      '<div class="row"><label class="f" style="margin:0">Minutes of show<br><span class="muted small">(the period minus seating and bows)</span><input id="tg" inputmode="numeric" value="' + c.target + '" style="width:90px"></label>' +
      '<label class="f" style="margin:0">Seconds per scene change<input id="cs" inputmode="numeric" value="' + c.changeSecs + '" style="width:90px"></label>' +
      '<label class="f" style="margin:0">Timed full run (minutes)<br><span class="muted small">after a real run-through</span><input id="tr" inputmode="decimal" value="' + (c.timed || '') + '" placeholder="not yet" style="width:90px"></label>' +
      '<label class="switch" style="border:0"><span>Narrator bridges<br><span class="muted small">for bigger cuts</span></span><input type="checkbox" id="br"' + (c.bridges ? ' checked' : '') + '></label></div>' +
      '<p style="font-size:1.2em;margin:10px 0"><b style="color:var(' + (over ? '--bad' : '--good') + ')">School-day version: about ' + now + ' min</b> of ' + c.target + ' · full show about ' + full + ' min' + (c.timed ? '' : ' <span class="muted small">(rough guesses until you time a full run, or upload the tracks)</span>') + '</p>' +
      (over && c.timed ? '<p class="small" style="color:var(--bad)">Still about ' + Math.round((now - c.target) * 10) / 10 + ' min over. Try faster scene changes first (lower the seconds above as they improve), then choose more cuts under Every moment.</p>' : '') +
      (ideas.length ? '<div class="card" style="margin:10px 0"><b>Cut options, best first</b>' + ideas.map(function (x, i) { var on = x.moments.every(function (id) { return c.cut.indexOf(id) >= 0; }); return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + (i + 1) + '. ' + esc(x.name) + '</b> <span class="muted small">' + esc(x.saves) + '</span><br><span class="small">' + esc(x.why) + '</span></span><button class="btn small" data-idea="' + i + '" aria-pressed="' + on + '">' + (on ? 'Cut ✓' : 'Cut it') + '</button></div>'; }).join('') + '</div>' : '') +
      '<div class="row" style="margin:10px 0"><button class="btn" id="sug" data-save>Suggest cuts to fit</button><button class="btn quiet" id="none" data-save>Keep everything</button></div>' +
      '<details><summary class="btn quiet small">Every moment</summary><table class="tbl"><thead><tr><th>Keep</th><th>Moment</th><th>Min</th><th>Who</th></tr></thead><tbody>' + ms.map(function (m) {
        var cut = c.cut.indexOf(m.id) >= 0, s = T.sceneById(m.scene), row = '';
        if (cut && !prev && c.bridges) row = '<tr><td></td><td colspan="3" class="small" style="color:var(--muted)">' + sym('📖') + 'Narrator bridge: “' + esc((s.story || '').split('. ')[0].replace(/\.$/, '')) + '.”</td></tr>';
        prev = cut;
        var who = m.on === '*' ? 'Whole cast' : m.on.length + ' characters' + (m.big ? ' + ensemble' : '');
        return row + '<tr style="' + (cut ? 'opacity:.5' : '') + '"><td><input type="checkbox" data-keep="' + m.id + '"' + (cut ? '' : ' checked') + ' aria-label="Keep in the school-day show" style="width:28px;height:28px"></td><td>' + esc(label(m)) + (m.big ? ' ★' : '') + '</td><td>' + (Math.round(len(m) * 10) / 10) + '</td><td class="small">' + esc(who) + '</td></tr>';
      }).join('') + '</tbody></table></details></div>';
  };
  T.wireCut = function (redraw) {
    var c = cfg(), num = function (id, f) { document.getElementById(id).onchange = function (e) { f(e.target.value); T.saveShow('Saved').then(redraw); }; };
    num('tg', function (v) { c.target = Math.max(10, +v || 40); });
    num('cs', function (v) { c.changeSecs = Math.max(0, +v || 0); });
    num('tr', function (v) { c.timed = +v > 0 ? +v : 0; });
    document.getElementById('br').onchange = function (e) { c.bridges = e.target.checked; T.saveShow('Saved').then(redraw); };
    document.getElementById('sug').onclick = function () { c.cut = suggest(c.target); T.saveShow('About ' + lengthOf(c.cut) + ' minutes').then(redraw); };
    document.getElementById('none').onclick = function () { c.cut = []; T.saveShow('Everything is back in').then(redraw); };
    app.querySelectorAll('[data-idea]').forEach(function (b) { b.onclick = function () { var ids = T.O().cutIdeas[+b.dataset.idea].moments, on = ids.every(function (id) { return c.cut.indexOf(id) >= 0; }); c.cut = c.cut.filter(function (x) { return ids.indexOf(x) < 0; }); if (!on) c.cut = c.cut.concat(ids); T.saveShow(on ? 'Back in' : 'Cut from the school-day show').then(redraw); }; });
    app.querySelectorAll('[data-keep]').forEach(function (b) { b.onchange = function () { var id = b.dataset.keep; c.cut = c.cut.filter(function (x) { return x !== id; }); if (!b.checked) c.cut.push(id); T.saveShow('Saved').then(redraw); }; });
  };
  T.cutLength = lengthOf; T.suggestCut = suggest;

  /* ---------- performances ---------- */
  T.perfView = function () {
    var p = P(), list = p.performances.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    return '<div class="card"><h3>' + sym('🌟') + 'Performances</h3><p class="muted">The cast sees these on Today, with the ticket link to share with their families.</p>' +
      (list.length ? list.map(function (x) {
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(T.prodDay(x.date)) + ' · ' + esc(time12(x.time)) + '</b> ' + (x.kind === 'school' ? '<span class="tag">In school (school-day version)</span>' : '<span class="tag">Evening</span>') + (x.relaxed ? ' <span class="tag">Relaxed</span>' : '') +
          (x.tickets ? '<br><a class="small" href="' + esc(x.tickets) + '" target="_blank" rel="noopener">' + esc(x.tickets) + '</a>' : '<br><span class="muted small">no ticket link yet</span>') + (x.notes ? '<br><span class="small">' + esc(x.notes) + '</span>' : '') + '</span>' +
          '<button class="btn small" data-editp="' + x.id + '">Edit</button></div>';
      }).join('') : '<p class="muted">None yet. Add them one by one, or use Plan show week.</p>') +
      '<div class="row" style="margin-top:10px"><button class="btn" id="addp">Add a performance</button><button class="btn primary" id="plansw">Plan show week</button></div></div>' + T.cutView();
  };
  function editPerf(x) {
    var isNew = !x; x = x ? JSON.parse(JSON.stringify(x)) : { id: uid('pf'), date: '', time: '19:00', kind: 'evening', relaxed: false, tickets: '', notes: '' };
    var d = T.dialog('<h2>' + (isNew ? 'Add a performance' : 'Performance') + '</h2><div class="row"><label class="f grow">Day<input type="date" id="pd" value="' + x.date + '"></label><label class="f grow">Time<input type="time" id="pt" value="' + x.time + '"></label></div>' +
      '<div class="switch"><span>Kind</span><div class="seg" id="pk"><button type="button" data-v="school" aria-pressed="' + (x.kind === 'school') + '">In school</button><button type="button" data-v="evening" aria-pressed="' + (x.kind === 'evening') + '">Evening</button></div></div>' +
      '<label class="switch"><span><b>Relaxed performance</b><br><span class="muted small">House lights partly up, softer sound, moving and talking are fine.</span></span><input type="checkbox" id="pr"' + (x.relaxed ? ' checked' : '') + '></label>' +
      '<label class="f">Ticket link (free general admission)<input id="pl" value="' + esc(x.tickets) + '" placeholder="https://…"></label>' +
      '<label class="f">Note for the cast (optional)<input id="pn" value="' + esc(x.notes) + '" placeholder="e.g. Call time 5:30 in the Reber Center"></label>' +
      '<div class="row end">' + (isNew ? '' : '<button class="btn quiet" id="del">Delete</button><span class="grow"></span>') + '<button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Save</button></div>');
    d.querySelectorAll('#pk button').forEach(function (b) { b.onclick = function () { x.kind = b.dataset.v; d.querySelectorAll('#pk button').forEach(function (y) { y.setAttribute('aria-pressed', y === b); }); }; });
    d.querySelector('#cn').onclick = function () { d.close(); };
    var done = function (msg) { T.saveShow(msg).then(function () { d.close(); T.route(); }); };
    if (!isNew) d.querySelector('#del').onclick = function () { if (!confirm('Delete this performance?')) return; P().performances = P().performances.filter(function (y) { return y.id !== x.id; }); done('Deleted'); };
    d.querySelector('#ok').onclick = function () {
      x.date = d.querySelector('#pd').value; x.time = d.querySelector('#pt').value; x.relaxed = d.querySelector('#pr').checked; x.notes = d.querySelector('#pn').value.trim();
      var t = d.querySelector('#pl').value.trim(); if (t && !/^https:\/\//.test(t)) { T.toast('The ticket link starts with https://'); return; } x.tickets = t;
      if (!x.date) { T.toast('Pick the day.'); return; }
      var l = P().performances, i = l.findIndex(function (y) { return y.id === x.id; }); if (i >= 0) l[i] = x; else l.push(x);
      done('Saved');
    };
  }
  /* Act 1 dress, Act 2 dress, full run, in-school shows, and an evening show; the show splits where half its minutes have gone by (at a scene change) */
  function planShowWeek() {
    var p = P(), t = p.term;
    var guess = t.last ? (function () { var d = parse(addDays(t.last, -7)), w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return ymd(d); })() : '';
    var d = T.dialog('<h2>Plan show week</h2><p class="muted">Monday: Act 1 dress · Tuesday: Act 2 dress · Wednesday: full run · Thursday: in-school shows · and an evening show. All in the regular class period; you can change any day after.</p>' +
      '<label class="f">Monday of show week<input type="date" id="mo" value="' + guess + '"></label><label class="f">Evening show<input type="date" id="ev"></label><label class="f">Evening show time<input type="time" id="et" value="19:00"></label>' +
      '<label class="f">In-school show times (comma between, e.g. 9:10, 10:55)<input id="st" placeholder="9:10, 10:55"></label>' +
      '<p class="err" id="m"></p><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Plan it</button></div>');
    d.querySelector('#mo').onchange = function (e) { if (e.target.value) d.querySelector('#ev').value = addDays(e.target.value, 4); };
    if (guess) d.querySelector('#ev').value = addDays(guess, 4);
    d.querySelector('#cn').onclick = function () { d.close(); };
    d.querySelector('#ok').onclick = function () {
      var mo = d.querySelector('#mo').value; if (!mo || parse(mo).getDay() !== 1) { d.querySelector('#m').textContent = 'Pick a Monday.'; return; }
      var scenes = T.O().scenes.map(function (s) { return s.id; }), ms = T.O().moments, total = ms.reduce(function (a, m) { return a + mins(m); }, 0), run = 0, split = scenes.length;
      for (var i = 0; i < ms.length; i++) { run += mins(ms[i]); if (run >= total / 2) { split = scenes.indexOf(ms[i].scene) + 1; break; } }
      var g = function (focus, sc) { return { id: uid('g'), focus: focus, scenes: sc, songs: [], everyone: true, where: 'Reber Center stage', only: '' }; };
      var first = T.sceneById(scenes[0]).num, mid = T.sceneById(scenes[split - 1]).num, last = T.sceneById(scenes[scenes.length - 1]).num;
      var plan = [
        [mo, [g('dress', scenes.slice(0, split))], 'Act 1 dress rehearsal (Scenes ' + first + '–' + mid + '): full costume, mics, props. Everyone not on stage is backstage crew.'],
        [addDays(mo, 1), [g('dress', scenes.slice(split))], 'Act 2 dress rehearsal (Scenes ' + (mid + 1) + '–' + last + '): full costume, mics, props.'],
        [addDays(mo, 2), [g('dress', scenes)], 'Full run: the school-day version, start to finish, like a real show.'],
        [addDays(mo, 3), [g('show', scenes)], 'In-school performances! Classes come to watch. Call time: the start of class.']
      ];
      plan.forEach(function (x) { p.days[x[0]] = { groups: x[1], assign: {}, tasks: {}, notes: x[2] }; });
      (d.querySelector('#st').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) {
        var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i); if (!m) return; var h = +m[1]; if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12; if (!m[3] && h < 7) h += 12;
        p.performances.push({ id: uid('pf'), date: addDays(mo, 3), time: pad(h) + ':' + (m[2] || '00'), kind: 'school', relaxed: false, tickets: '', notes: 'School-day version' });
      });
      var ev = d.querySelector('#ev').value; if (ev) p.performances.push({ id: uid('pf'), date: ev, time: d.querySelector('#et').value || '19:00', kind: 'evening', relaxed: false, tickets: '', notes: '' });
      if (p.shown.indexOf(mo) < 0) p.shown.push(mo);
      T.saveShow('Show week planned').then(function () { d.close(); T.route(); });
    };
  }
  T.wirePerf = function (redraw) {
    document.getElementById('addp').onclick = function () { editPerf(null); };
    document.getElementById('plansw').onclick = planShowWeek;
    app.querySelectorAll('[data-editp]').forEach(function (b) { b.onclick = function () { editPerf(P().performances.find(function (x) { return x.id === b.dataset.editp; })); }; });
    T.wireCut(redraw);
  };

  /* ---------- students: our performances (Today) ---------- */
  T.perfCard = function () {
    var p = T.show.production; if (!p || !(p.performances || []).length) return '';
    var today = ymd(new Date()), list = p.performances.filter(function (x) { return x.date >= today; }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
    if (!list.length) return '';
    return '<div class="card"><h3>' + sym('🌟') + 'Our performances</h3>' + list.map(function (x) {
      return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(T.prodDay(x.date)) + ' · ' + esc(time12(x.time)) + '</b> ' + (x.kind === 'school' ? '<span class="tag">In school</span>' : '<span class="tag">Evening: families welcome</span>') + (x.relaxed ? ' <span class="tag">Relaxed</span>' : '') +
        (x.notes ? '<br><span class="small">' + esc(x.notes) + '</span>' : '') + '</span>' + (x.tickets ? '<a class="btn small primary" href="' + esc(x.tickets) + '" target="_blank" rel="noopener">Free tickets</a>' : '') + '</div>';
    }).join('') + (list.some(function (x) { return x.tickets; }) ? '<p class="muted small">Share the ticket link with your family. Tickets are free.</p>' : '') + '</div>';
  };
})();
