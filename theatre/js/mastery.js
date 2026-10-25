/* asl.cool/theatre: Mastery (Colleen, 2026-10-24: "students should be marked off as having mastered show parts like vocals on a song, choreo on a
   song. special attention should be drawn to material that has been taught but that students haven't shown mastery of").
   For every Company member: the singing and the dance of each song they are in, and the lines and blocking of each scene they speak in.
   Taught = a past class day put them in a group working on it (vocals, dance, acting, a run or a dress rehearsal). A teacher checks it off when the
   student shows it (sung, signed or with AAC; seated dance versions count). "Needs attention" lists what was taught and not yet shown, most-taught first.
   T.show.mastery = { actor id: { 'm21:V': 'date', 'm21:D': 'date', 's5:A': 'date' } }; T.show.redx = { actor id: true } (the red X starts on, redx.js);
   T.show.ladder = { actor id: 2..4 } (the starting step of help on their own lines, ladder.js) */
(function () {
  'use strict';
  var T = window.T, esc = T.esc;
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var KIND = { V: 'Singing', D: 'Dance', A: 'Lines and blocking' };
  var pick = null, only = 'attention';
  var M = function () { return T.show.mastery = T.show.mastery || {}; };
  var cast = function () { return (T.show.cast || []).filter(function (a) { return !a.guest && (a.chars || []).length; }); };
  /* the material one student needs to know */
  function materialFor(a) {
    var O = T.O(), out = [];
    O.songs.forEach(function (so) {
      var m = O.moments.find(function (x) { return x.song === so.id; });
      if (m && T.onStage(m, a.chars)) { out.push({ key: so.id + ':V', id: so.id, kind: 'V', label: '“' + so.title + '”' }); out.push({ key: so.id + ':D', id: so.id, kind: 'D', label: '“' + so.title + '”' }); }
    });
    O.scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      if (src.items.some(function (it) { return it.type === 'line' && T.isMine(it.who, sc, a.chars); })) out.push({ key: sc.id + ':A', id: sc.id, kind: 'A', label: 'Scene ' + sc.num });
    });
    return out;
  }
  /* how many past class days put this student in a group working on each piece */
  function taught(a, upTo) {
    var p = T.show.production, out = {}; if (!p || !p.days || !T.prod) return out;
    Object.keys(p.days).filter(function (d) { return d <= upTo; }).forEach(function (d) {
      (p.days[d].groups || []).forEach(function (g) {
        if (['vocals', 'dance', 'acting', 'run', 'dress'].indexOf(g.focus) < 0) return;
        if (!a.chars.some(function (c) { return T.prod.groupChars(g).indexOf(c) >= 0; })) return;
        var add = function (k) { var x = out[k] = out[k] || { n: 0, last: '' }; x.n++; x.last = d; };
        g.songs.forEach(function (sid) { if (g.focus === 'vocals' || g.focus === 'run' || g.focus === 'dress') add(sid + ':V'); if (g.focus === 'dance' || g.focus === 'run' || g.focus === 'dress') add(sid + ':D'); });
        g.scenes.forEach(function (sid) { if (g.focus !== 'vocals' && g.focus !== 'dance') add(sid + ':A'); });
      });
    });
    return out;
  }
  function rows() {
    var t = T.prod ? T.prod.today() : new Date().toISOString().slice(0, 10), out = [];
    cast().forEach(function (a) {
      var tg = taught(a, t), mine = M()[a.id] || {};
      materialFor(a).forEach(function (m) { out.push(Object.assign({ a: a, done: mine[m.key] || '', taught: tg[m.key] || null }, m)); });
    });
    return out;
  }
  T.masteryRows = rows;
  T.masteryView = function () {
    var R = rows(); if (!cast().length) return '<div class="card"><p>Add the cast first (Teacher mode › Cast).</p></div>';
    var need = R.filter(function (r) { return r.taught && !r.done; });
    var byPiece = {}; need.forEach(function (r) { var k = r.key; (byPiece[k] = byPiece[k] || { r: r, who: [], n: 0 }).who.push(r); byPiece[k].n = Math.max(byPiece[k].n, r.taught.n); });
    var att = Object.keys(byPiece).map(function (k) { return byPiece[k]; }).sort(function (x, y) { return y.n - x.n; });
    var keys = {}; R.forEach(function (r) { keys[r.key] = r; });
    var opts = Object.keys(keys).sort(function (x, y) { return keys[x].kind.localeCompare(keys[y].kind) || keys[x].label.localeCompare(keys[y].label, undefined, { numeric: true }); });
    if (!pick || !keys[pick]) pick = (att[0] && att[0].r.key) || opts[0];
    var inIt = R.filter(function (r) { return r.key === pick; });
    var total = R.length, done = R.filter(function (r) { return r.done; }).length;
    return '<div class="card"><h3>' + sym('✅') + 'Mastery</h3><p class="muted">Check off each part when a Company member shows it on their own: the singing (sung, signed or with AAC), the dance (seated versions count), and the lines and blocking of each scene they speak in.</p>' +
      '<p><b>' + done + ' of ' + total + '</b> parts shown so far.</p></div>' +
      '<div class="card" style="border:3px solid var(--warn)"><h3>' + sym('⚠️') + 'Taught, not shown yet (' + need.length + ')</h3>' +
      (att.length ? '<p class="muted small">Most-taught first: these have had the most class time. Plan a review, a Group C task card, or a check-off at the next rehearsal.</p>' + att.map(function (x) {
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(KIND[x.r.kind]) + ': ' + esc(x.r.label) + '</b> <span class="muted small">taught up to ' + x.n + ' time' + (x.n === 1 ? '' : 's') + '</span><br><span class="small">' + x.who.map(function (r) { return esc(r.a.name); }).join(' · ') + '</span></span><button class="btn small" data-pick="' + esc(x.r.key) + '">Check off</button></div>';
      }).join('') : '<p class="muted">Nothing waiting: everything taught so far has been shown.</p>') + '</div>' +
      '<div class="card" id="chk"><h3>Check off</h3><label class="f">Part<select id="mpick">' + ['V', 'D', 'A'].map(function (k) {
        return '<optgroup label="' + KIND[k] + '">' + opts.filter(function (o) { return keys[o].kind === k; }).map(function (o) { return '<option value="' + esc(o) + '"' + (o === pick ? ' selected' : '') + '>' + esc(keys[o].label) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></label>' +
      inIt.map(function (r) {
        var st = r.done ? '<span class="tag" style="background:var(--ok,#2bb673);color:#fff">✓ Shown ' + esc(T.prodDay ? T.prodDay(r.done, true) : r.done) + '</span>' : r.taught ? '<span class="tag" style="background:var(--warn);color:#fff">Taught ' + r.taught.n + '×, not shown</span>' : '<span class="tag">Not taught yet</span>';
        return '<div class="switch"><span class="grow">' + (T.face ? T.face(r.a, 36) + ' ' : '') + '<b>' + esc(r.a.name) + '</b> ' + st + '</span><button class="btn small' + (r.done ? ' quiet' : ' primary') + '" data-m="' + r.a.id + '" data-k="' + esc(r.key) + '">' + (r.done ? 'Undo' : '✓ Shown it') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="card"><h3>' + sym('❌') + 'Red X when it is not their turn</h3><p class="muted small">On the song page, a red X covers the screen while other people’s lines are sung, and a green frame says “Sing!” on their own lines (it needs the song’s lyrics timing). Turn it on for the students who sing every line; they can still switch it off.</p>' +
      cast().map(function (a) { return '<label class="switch"><span>' + esc(a.name) + '</span><input type="checkbox" data-rx="' + a.id + '"' + (T.show.redx && T.show.redx[a.id] ? ' checked' : '') + '></label>'; }).join('') + '</div>' +
      (T.Ladder ? '<div class="card"><h3>' + sym('🪜') + 'Help on their own lines</h3><p class="muted small">Where each Company member starts on the song page: ' + T.Ladder.LEVELS.map(function (L) { return L.n + '. ' + esc(L.name) + ' (' + esc(L.teach) + ')'; }).join('; ') + '. Hearing or not hearing the singers needs a song’s lyrics timing and both tracks. They can still change it on each song.</p>' +
        cast().map(function (a) { var v = (T.show.ladder && T.show.ladder[a.id]) || 1; return '<label class="switch"><span>' + esc(a.name) + '</span><select data-ld="' + a.id + '">' + T.Ladder.LEVELS.map(function (L) { return '<option value="' + L.n + '"' + (L.n === v ? ' selected' : '') + '>' + L.n + '. ' + esc(L.name) + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>' : '');
  };
  T.wireMastery = function (redraw) {
    var app = document.getElementById('app');
    var sel = document.getElementById('mpick'); if (sel) sel.onchange = function () { pick = sel.value; redraw(); };
    app.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { pick = b.dataset.pick; redraw(); var c = document.getElementById('chk'); if (c) c.scrollIntoView({ block: 'start' }); }; });
    app.querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = function () {
        var m = M()[b.dataset.m] = M()[b.dataset.m] || {}, k = b.dataset.k;
        if (m[k]) delete m[k]; else m[k] = T.prod ? T.prod.today() : new Date().toISOString().slice(0, 10);
        T.saveShow(m[k] ? 'Checked off' : 'Undone').then(redraw);
      };
    });
    app.querySelectorAll('[data-ld]').forEach(function (c) { c.onchange = function () { var r = T.show.ladder = T.show.ladder || {}; if (+c.value > 1) r[c.dataset.ld] = +c.value; else delete r[c.dataset.ld]; T.saveShow('Saved'); }; });
    app.querySelectorAll('[data-rx]').forEach(function (c) { c.onchange = function () { var r = T.show.redx = T.show.redx || {}; if (c.checked) r[c.dataset.rx] = true; else delete r[c.dataset.rx]; T.saveShow('Saved'); }; });
  };
})();
