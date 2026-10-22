/* asl.cool/theatre: the mic plot (Colleen 2026-10-21: "a mic plot template assuming we have 8 body mics for the production that need to cover all
   spoken or sung lines").
   Who needs a mic: every character (or, once cast, every actor, so a doubled actor keeps one mic) with a spoken line or a sung lyric line under their
   own name. Group labels (ALL, JOCKS…) are sung by the chorus: area or choir mics, not body mics.
   The plan, scene by scene: the people with the most lines get a mic first; a mic is shared only by people who never speak in the same scene, and a
   handoff right at a scene change costs more than one with a scene in between (time to swap the pack). Anyone who will not fit is listed with a
   suggestion. The teacher can pin anyone to a mic (or to a handheld) and the rest is worked out around that.
   T.show.micPlot = { n: number of body mics, pin: { unit id: mic number | 'hand' } } */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };

  function units() {      // the people who wear mics: actors when cast (all their characters), otherwise characters
    var cast = (T.show.cast || []).filter(function (a) { return (a.chars || []).length; }), byChar = {}, list = [];
    if (cast.length) cast.forEach(function (a) { list.push({ id: a.id, name: a.name.split(' ')[0], chars: a.chars }); a.chars.forEach(function (c) { byChar[c] = a.id; }); });
    T.O().characters.forEach(function (c) { if (!byChar[c.id]) { byChar[c.id] = c.id; list.push({ id: c.id, name: c.short, chars: [c.id] }); } });
    return { list: list, byChar: byChar };
  }

  /* who speaks or sings in each scene: need[sceneIndex][unit] = { s: spoken lines, g: sung lines }, and the group singing per scene */
  function needs() {
    var U = units(), O = T.O(), groups = O.labelGroups || {}, map = T.show.labelMap || {};
    var per = O.scenes.map(function () { return {}; }), chorus = O.scenes.map(function () { return {}; });
    var count = function (i, label, kind) {
      var L = String(label || '').toUpperCase().trim(); if (!L) return;
      var ids = T.labelChars(L), ens = function (c) { var ch = T.charById(c); return !ch || ch.group === 'ensemble'; };      // Jocks, Students…: the chorus
      if (ids.indexOf('*') >= 0 || groups[L] || map[L] === '*' || ids.length > 3) { chorus[i][L] = (chorus[i][L] || 0) + 1; return; }
      if (ids.some(ens)) chorus[i][ids.filter(ens).map(function (c) { var ch = T.charById(c); return ch ? ch.name.toUpperCase() : c; }).join(', ')] = 1;
      ids.filter(function (c) { return !ens(c); }).forEach(function (c) { var u = U.byChar[c]; if (!u) return; var x = per[i][u] = per[i][u] || { s: 0, g: 0 }; x[kind]++; });
    };
    O.scenes.forEach(function (scene, i) {
      var src = T.scriptScene(scene); if (!src) return;
      src.items.forEach(function (it) {
        if (it.type === 'line') count(i, it.who, 's');
        if (it.type === 'song') (it.lyrics || []).forEach(function (l) { count(i, l.who || (it.singers || []).join(' & '), 'g'); });
      });
    });
    return { U: U, per: per, chorus: chorus };
  }

  /* the plan: grid[mic][scene] = unit id wearing it (null: free), holders, and who would not fit */
  function plan(N, pin) {
    var d = needs(), S = d.per.length, tot = {}, sc = {};
    d.U.list.forEach(function (u) { var s = [], t = 0; d.per.forEach(function (p, i) { if (p[u.id]) { s.push(i); t += p[u.id].s + p[u.id].g; } }); sc[u.id] = s; tot[u.id] = t; });
    var who = d.U.list.filter(function (u) { return sc[u.id].length; }).sort(function (a, b) { return tot[b.id] - tot[a.id]; });
    var speak = []; for (var m = 0; m < N; m++) speak.push(new Array(S).fill(null));
    var out = [], hand = [], place = function (u, m) { sc[u.id].forEach(function (i) { speak[m][i] = u.id; }); };
    var cost = function (u, m) {
      var row = speak[m], c = 0;
      for (var k = 0; k < sc[u.id].length; k++) if (row[sc[u.id][k]]) return Infinity;
      var tmp = row.slice(); sc[u.id].forEach(function (i) { tmp[i] = u.id; });
      var last = null, lastAt = -9;
      tmp.forEach(function (x, i) { if (!x) return; if (last && x !== last) c += i - lastAt <= 1 ? 4 : 1; last = x; lastAt = i; });
      return c;
    };
    // pinned people first, then everyone else by how much they say and sing
    who.filter(function (u) { return pin[u.id]; }).forEach(function (u) {
      if (pin[u.id] === 'hand') { hand.push(u); return; }
      var m = +pin[u.id] - 1; if (m >= 0 && m < N && cost(u, m) < Infinity) place(u, m); else out.push(u);
    });
    who.filter(function (u) { return !pin[u.id]; }).forEach(function (u) {
      var best = -1, bc = Infinity;
      for (var m = 0; m < N; m++) { var c = cost(u, m); if (c < bc) { bc = c; best = m; } }
      if (best < 0) out.push(u); else place(u, best);
    });
    // someone left out who says more than the people in their way: move those people (to another mic if they fit, or off) and give the mic to them
    var unplace = function (id, m) { speak[m] = speak[m].map(function (x) { return x === id ? null : x; }); };
    out.slice().sort(function (a, b) { return tot[b.id] - tot[a.id]; }).forEach(function (u) {
      var best = null;
      for (var m = 0; m < N; m++) {
        var inWay = []; sc[u.id].forEach(function (i) { var x = speak[m][i]; if (x && inWay.indexOf(x) < 0) inWay.push(x); });
        if (inWay.some(function (x) { return pin[x]; })) continue;
        var lost = inWay.reduce(function (a, x) { return a + tot[x]; }, 0);
        if (lost < tot[u.id] && (!best || lost < best.lost)) best = { m: m, inWay: inWay, lost: lost };
      }
      if (!best) return;
      best.inWay.forEach(function (x) { unplace(x, best.m); });
      place(u, best.m); out.splice(out.indexOf(u), 1);
      best.inWay.forEach(function (x) {
        var xu = who.find(function (w) { return w.id === x; }), bm = -1, bc = Infinity;
        for (var m = 0; m < N; m++) { var c = cost(xu, m); if (c < bc) { bc = c; bm = m; } }
        if (bm < 0) out.push(xu); else place(xu, bm);
      });
    });
    // still left out: wear different mics in different scenes (Colleen: keep going back to the same mic number whenever possible; if not, mixing is
    // fine). Each scene takes a free mic, the one used last time first; a change of mic only ever happens at a scene change.
    out.slice().forEach(function (u) {
      var pick = [], last = -1;
      for (var k = 0; k < sc[u.id].length; k++) {
        var i = sc[u.id][k], free = [];
        for (var m = 0; m < N; m++) if (!speak[m][i]) free.push(m);
        if (!free.length) return;
        var m2 = free.indexOf(last) >= 0 ? last : free.sort(function (a, b) { return mixCost(a, i) - mixCost(b, i); })[0];
        pick.push([m2, i]); last = m2;
      }
      pick.forEach(function (x) { speak[x[0]][x[1]] = u.id; });
      out.splice(out.indexOf(u), 1); u.split = true;
    });
    function mixCost(m, i) {      // a mic nobody needs near this scene is easiest to borrow
      var c = 0; for (var j = Math.max(0, i - 1); j <= Math.min(S - 1, i + 1); j++) if (speak[m][j]) c++;
      return c;
    }

    // who wears each mic in each scene: the next person to speak on it puts it on in the scene change before (or the last speaker keeps it)
    var wear = speak.map(function (row) {
      var w = row.slice(), cur = null, first = row.find(Boolean) || null;
      for (var i = 0; i < S; i++) { if (row[i]) cur = row[i]; w[i] = cur || first; }
      return w;
    });
    return { d: d, speak: speak, wear: wear, out: out, hand: hand, tot: tot, sc: sc, who: who };
  }
  T.micPlan = plan;

  /* the swaps, in show order (Colleen: written into each performer's track: give up or get a mic, when, where, and who is helping).
     A mic changes hands after the giver's last scene on it and before the next person's first scene; the helper meets them at the mic station. */
  function swaps() {
    var M = T.show.micPlot || { n: 8, pin: {} }, r = plan(M.n || 8, M.pin || {}), O = T.O(), names = {}, out = [];
    r.d.U.list.forEach(function (u) { names[u.id] = u.name; });
    r.speak.forEach(function (row, m) {
      var runs = []; row.forEach(function (u, i) { if (!u) return; var l = runs[runs.length - 1]; if (l && l.u === u) l.to = i; else runs.push({ u: u, from: i, to: i }); });
      runs.forEach(function (x, k) {
        var prev = runs[k - 1], next = runs[k + 1];
        out.push({ mic: m + 1, u: x.u, name: names[x.u], kind: 'get', at: prev ? x.from : -1, after: prev ? prev.to : -1, from: prev ? names[prev.u] : null, quick: !!prev && x.from - prev.to <= 1 });
        out.push({ mic: m + 1, u: x.u, name: names[x.u], kind: 'give', at: next ? x.to : S(O), before: next ? next.from : -1, to: next ? names[next.u] : null, quick: !!next && next.from - x.to <= 1 });
      });
    });
    return { list: out, where: M.where || 'the mic table, stage left', helper: helperName(M), scenes: O.scenes, plan: r };
  }
  var S = function (O) { return O.scenes.length; };
  function helperName(M) { var a = M.helper && (T.show.cast || []).find(function (x) { return x.id === M.helper; }); return a ? a.name.split(' ')[0] : (M.helperName || 'the mic helper'); }
  T.micSwaps = swaps;
  /* one person's mic steps: [{ scene index, before|after, text, quick }] (chars: their characters; actorId when cast) */
  T.micSteps = function (chars, actorId) {
    if (!T.show.script || !T.show.micPlot) return [];
    var w = swaps(), cast = (T.show.cast || []).some(function (a) { return (a.chars || []).length; }), O = T.O();      // units: actor ids when cast, character ids for roles not cast yet
    var mine = function (u) { return (cast && actorId && u === actorId) || chars.indexOf(u) >= 0; }, sn = function (i) { return O.scenes[i] ? 'Scene ' + O.scenes[i].num : ''; };
    var out = [], helping = w.plan.d.U.list.length && (T.show.micPlot.helper && T.show.micPlot.helper === actorId);
    w.list.forEach(function (x) {
      if (mine(x.u)) {
        if (x.kind === 'get') out.push(x.at < 0 ? { i: 0, when: 'before', mic: x.mic, text: 'Before the show: put on Mic ' + x.mic + ' (' + w.helper + ' helps you at ' + w.where + ').' } :
          { i: x.at, when: 'before', quick: x.quick, mic: x.mic, text: 'Before ' + sn(x.at) + ': get Mic ' + x.mic + ' from ' + w.helper + ' at ' + w.where + '. It was ' + x.from + '’s; it is ready after ' + sn(x.after) + '.' });
        else out.push(x.before < 0 ? { i: O.scenes.length - 1, when: 'after', mic: x.mic, text: 'After bows: give Mic ' + x.mic + ' back to ' + w.helper + ' at ' + w.where + '.' } :
          { i: x.at, when: 'after', quick: x.quick, mic: x.mic, text: 'After ' + sn(x.at) + ': take off Mic ' + x.mic + ' and give it to ' + w.helper + ' at ' + w.where + '. ' + x.to + ' wears it next (' + sn(x.before) + ').' });
      }
      if (helping && x.kind === 'give' && x.before >= 0) out.push({ i: x.at, when: 'after', quick: x.quick, mic: x.mic, text: 'Mic helper: after ' + sn(x.at) + ', take Mic ' + x.mic + ' from ' + x.name + ' at ' + w.where + ' and put it on ' + x.to + ' before ' + sn(x.before) + '.' });
    });
    return out;
  };

  T.teacherPages.mics = function () {
    T.setBar('Mic plot', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<div class="card"><p>Import the script first: the plot is worked out from who speaks and sings in each scene.</p></div>'; return; }
    var fresh = !T.show.micPlot, M = T.show.micPlot = T.show.micPlot || { n: 8, pin: {} }, O = T.O();
    if (fresh) T.saveShow('Mic plot made: performers see their mic swaps in My Schedule');
    var r = plan(M.n, M.pin), names = {}; r.d.U.list.forEach(function (u) { names[u.id] = u.name; });
    var swaps = 0; r.wear.forEach(function (row) { for (var i = 1; i < row.length; i++) if (row[i] && row[i - 1] && row[i] !== row[i - 1]) swaps++; });
    var lines = 0, covered = 0; r.who.forEach(function (u) { lines += r.tot[u.id]; if (r.out.indexOf(u) < 0 && r.hand.indexOf(u) < 0) covered += r.tot[u.id]; });
    var cell = function (m, i) {
      var w = r.wear[m][i], sp = r.speak[m][i], prev = i > 0 ? r.wear[m][i - 1] : null, x = sp && r.d.per[i][sp];
      if (!w) return '<td class="mic-free">—</td>';
      var swap = prev && prev !== w;
      return '<td class="' + (sp ? 'mic-on' : 'mic-wear') + (swap ? ' mic-swap' : '') + '">' + (swap ? '<span class="small">↻ swap</span><br>' : '') + '<b>' + esc(names[w]) + '</b>' +
        (x ? '<br><span class="small">' + (x.s ? x.s + ' spoken' : '') + (x.s && x.g ? ', ' : '') + (x.g ? x.g + ' sung' : '') + '</span>' : '<br><span class="small muted">wearing it</span>') + '</td>';
    };
    var cast = (T.show.cast || []).some(function (a) { return (a.chars || []).length; });
    app.innerHTML = '<div class="card noprint"><h2>' + sym('🎙️') + 'Mic plot</h2>' +
      '<p>Worked out from the script: who speaks or sings under their own name in each scene. ' + (cast ? 'By actor, so a doubled actor keeps one mic.' : 'By character for now; once the cast list is in, it plans by actor, so doubled roles keep one mic.') + '</p>' +
      '<div class="row" style="flex-wrap:wrap;gap:10px"><label class="row" style="gap:6px">Body mics <input id="mn" type="number" min="1" max="40" value="' + M.n + '" style="width:70px"></label>' +
      '<span class="tag">' + covered + ' of ' + lines + ' lines on a body mic</span><span class="tag">' + swaps + ' swaps</span>' + (r.out.length ? '<span class="tag" style="background:#ffd1d1;color:#5a0000">' + r.out.length + ' without a mic</span>' : '') +
      '<label class="row" style="gap:6px">Mic station <input id="mw" value="' + esc(M.where || 'the mic table, stage left') + '" style="width:210px"></label>' +
      '<label class="row" style="gap:6px">Mic helper <select id="mh"><option value="">' + esc(M.helperName || 'Someone on crew') + '</option>' + (T.show.cast || []).map(function (a) { return '<option value="' + esc(a.id) + '"' + (M.helper === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<span class="grow"></span><button class="btn primary" onclick="print()">' + icon('print') + 'Print</button></div>' +
      (function () {
        var over = O.scenes.map(function (sc, i) { return { s: sc, n: Object.keys(r.d.per[i]).length }; }).filter(function (x) { return x.n > M.n; });
        return over.length ? '<p class="err" style="margin-top:8px">' + sym('⚠️') + 'More people speak or sing than there are mics in ' + over.map(function (x) { return 'Scene ' + esc(x.s.num) + ' (' + x.n + ' people)'; }).join(', ') + ': someone there needs a handheld or a shared mic.</p>' : '';
      })() +
      '<p class="muted small">Bold: speaks or sings in that scene. “Wearing it”: keeps the mic on until the next swap. ↻ swap: the mic changes hands in the scene change before. Group singing (ALL, JOCKS…) is for area or choir mics.</p></div>' +
      '<h2 class="printonly">Mic plot · ' + esc(O.title) + '</h2>' +
      '<div style="overflow-x:auto"><table class="tbl micplot"><thead><tr><th>Scene</th>' + r.speak.map(function (x, m) { return '<th>Mic ' + (m + 1) + '</th>'; }).join('') + '<th>Group singing (area mics)</th></tr></thead><tbody>' +
      O.scenes.map(function (s, i) {
        var ch = Object.keys(r.d.chorus[i]);
        var off = r.out.concat(r.hand).filter(function (u) { return r.d.per[i][u.id]; });
        return '<tr><th>Scene ' + esc(s.num) + '<br><span class="small muted">' + esc(s.place || '') + '</span>' + (off.length ? '<br><span class="small">' + off.map(function (u) { return (r.hand.indexOf(u) >= 0 ? '🎤 ' : '⚠️ ') + esc(names[u.id]); }).join(', ') + '</span>' : '') + '</th>' +
          r.speak.map(function (x, m) { return cell(m, i); }).join('') + '<td class="small">' + esc(ch.map(function (c) { return c.charAt(0) + c.slice(1).toLowerCase(); }).join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      swapList() +
      '<h3>Each mic, in order</h3><ol class="miclist">' + r.speak.map(function (row, m) {
        var seq = []; r.wear[m].forEach(function (w, i) { if (w && (!seq.length || seq[seq.length - 1].w !== w)) seq.push({ w: w, from: i }); });
        return '<li><b>Mic ' + (m + 1) + ':</b> ' + (seq.length ? seq.map(function (x, k) { return esc(names[x.w]) + (k ? ' (from Scene ' + esc(O.scenes[x.from].num) + ')' : ''); }).join(' → ') : '<span class="muted">free</span>') + '</li>';
      }).join('') + '</ol>' +
      (r.who.some(function (u) { return u.split; }) ? '<p class="small">' + sym('🔀') + 'Changes mic numbers (always at a scene change): ' + r.who.filter(function (u) { return u.split; }).map(function (u) {
        return '<b>' + esc(names[u.id]) + '</b> (' + r.sc[u.id].map(function (i) { var m = r.speak.findIndex(function (row) { return row[i] === u.id; }); return 'Sc ' + esc(O.scenes[i].num) + ': Mic ' + (m + 1); }).join(', ') + ')';
      }).join('; ') + '</p>' : '') +
      (r.out.length || r.hand.length ? '<div class="card"><h3>Not on a body mic</h3><ul>' + r.hand.map(function (u) { return '<li>🎤 <b>' + esc(names[u.id]) + '</b>: handheld (pinned)</li>'; }).join('') +
        r.out.map(function (u) { return '<li>⚠️ <b>' + esc(names[u.id]) + '</b> (' + r.tot[u.id] + ' lines, Scene ' + r.sc[u.id].map(function (i) { return O.scenes[i].num; }).join(', ') + '): ' + suggest(u) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<div class="card noprint"><h3>Who needs a mic</h3><p class="muted small">Pin someone to a mic (or a handheld) and the plot is worked out again around them.</p><table class="tbl"><thead><tr><th>Who</th><th>Lines</th><th>Scenes</th><th>Mic</th></tr></thead><tbody>' +
      r.who.map(function (u) {
        var opts = '<option value="">Auto</option>' + r.speak.map(function (x, m) { return '<option value="' + (m + 1) + '"' + (String(M.pin[u.id]) === String(m + 1) ? ' selected' : '') + '>Mic ' + (m + 1) + '</option>'; }).join('') + '<option value="hand"' + (M.pin[u.id] === 'hand' ? ' selected' : '') + '>Handheld</option>';
        var mics = []; r.speak.forEach(function (row, m) { if (row.indexOf(u.id) >= 0) mics.push(m + 1); });
        var on = mics.length ? mics[0] - 1 : -1;
        return '<tr><td><b>' + esc(names[u.id]) + '</b>' + (cast ? '<br><span class="small muted">' + esc(u.chars.map(function (c) { return T.charById(c).short; }).join(', ')) + '</span>' : '') + '</td><td>' + r.tot[u.id] + '</td><td class="small">' + r.sc[u.id].map(function (i) { return O.scenes[i].num; }).join(', ') +
          '</td><td><select data-pin="' + esc(u.id) + '">' + opts + '</select> <span class="small muted">' + (on >= 0 ? 'now Mic ' + mics.join(' + ') : M.pin[u.id] === 'hand' ? '' : 'no mic') + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
    function swapList() {
      var w = T.micSwaps(), sn = function (i) { return 'Scene ' + O.scenes[i].num; };
      var list = w.list.filter(function (x) { return x.kind === 'give' && x.before >= 0; }).sort(function (a, b) { return a.at - b.at || a.mic - b.mic; });
      if (!list.length) return '';
      return '<h3>' + sym('↻') + 'Mic swaps (' + esc(w.helper) + ' at ' + esc(w.where) + ')</h3><p class="muted small noprint">These are written into each performer’s My Schedule' + (M.helper ? ' and the helper’s' : '') + '.</p>' +
        '<table class="tbl"><thead><tr><th>When</th><th>Mic</th><th>From</th><th>To</th><th>Needed by</th></tr></thead><tbody>' + list.map(function (x) {
          return '<tr' + (x.quick ? ' class="mic-quick"' : '') + '><td>After ' + sn(x.at) + (x.quick ? ' <b>⚡ quick</b>' : '') + '</td><td><b>Mic ' + x.mic + '</b></td><td>' + esc(x.name) + '</td><td>' + esc(x.to) + '</td><td>' + sn(x.before) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    function suggest(u) {
      var hint = u.chars.indexOf('jack') >= 0 ? 'he carries the announcement microphone, so a handheld works' : 'a handheld, or pin someone with fewer lines to a handheld to free a mic';
      return hint + '.';
    }
    document.getElementById('mw').onchange = function () { M.where = this.value.trim() || 'the mic table, stage left'; T.saveShow('Mic station saved').then(T.teacherPages.mics); };
    document.getElementById('mh').onchange = function () { if (this.value) M.helper = this.value; else delete M.helper; T.saveShow('Mic helper saved').then(T.teacherPages.mics); };
    document.getElementById('mn').onchange = function () { var v = Math.max(1, Math.min(40, parseInt(this.value, 10) || 8)); M.n = v; T.saveShow('Mic plot for ' + v + ' mics').then(T.teacherPages.mics); };
    app.querySelectorAll('[data-pin]').forEach(function (s) { s.onchange = function () { if (s.value) M.pin[s.dataset.pin] = s.value; else delete M.pin[s.dataset.pin]; T.saveShow('Mic plot saved').then(T.teacherPages.mics); }; });
  };
})();
