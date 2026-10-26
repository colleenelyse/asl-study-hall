/* asl.cool/theatre: Megamix groups (Colleen 2026-10-25: "let's be smart about working on sections of the megamix that can overlap the original song
   learning … do this in groups until the last section"; "optimize who learns what so that someone who learns status quo for the show isn't expected
   to learn bop to the top only for the megamix. however this will also lead to some overlap and people needing to be put in one or another when they
   know two in a row so that we can have full group shifts between song sections"; "status quo is zeke and taylors big song so they should do that
   section. apply this logic too"; solo lines need not be sung by the right actor, the track has the vocals, "so everyone can just have fun and dance").
   The sections come from the show file (megamix: { song, sections: [{ id, name, from: [song ids], stars: [char ids], all }] }).
   The suggestion: each character does the sections of their own big songs (stars); everyone else does one section they already know from the show,
   the lightest one first, so the groups come out even; nobody is in two sections in a row; the last section is everyone.
   Teacher › Rehearsals › Megamix groups (#/teacher/megamix): the grid (who knows what, who does what), tap to change, warnings, the groups by
   section (characters and, once cast, the Company members); T.show.megamix = { assign: { charId: [section index] } } keeps her changes.
   The rehearsal plan (js/rehearsal-plan.js, cfg.megamix from forPlan) teaches each section to its group right after its original song. */
(function (root) {
  'use strict';
  function sectionsOf(S) { return (S && S.megamix && S.megamix.sections) || []; }
  var isHelper = function (c) { return c.group === 'helpers'; };
  /* who sings a song in the show: on its list, or a small role in a big number (the planner's own rule) */
  function knower(S) {
    var small = function (c) { return !!c && (c.group === 'ensemble' || c.group === 'featured' || !!c.small); };
    var ch = function (id) { return S.characters.find(function (c) { return c.id === id; }); };
    return function (cid, songId) {
      var m = (S.moments || []).find(function (x) { return x.song === songId; }); if (!m) return false;
      if ((m.out || []).indexOf(cid) >= 0) return false;
      if (m.on === '*' || (m.on || []).indexOf(cid) >= 0) return true;
      return !!m.big && small(ch(cid));
    };
  }
  function knows(S, cid, k) { var sec = sectionsOf(S)[k], kn = knower(S); return !!sec && sec.from.some(function (id) { return kn(cid, id); }); }
  var adjacent = function (list) { var l = list.slice().sort(function (a, b) { return a - b; }); for (var i = 1; i < l.length; i++) if (l[i] - l[i - 1] === 1) return [l[i - 1], l[i]]; return null; };
  /* weight(cid): how many Company members play it (an ensemble group counts as several before casting). opts.strong: the more capable performers
     (her bow Group 2), placed first and spread so every section has some; the leads (mx.leads) are in no section before mx.leadsFrom */
  function suggest(S, weight, opts) {
    var mx = S.megamix || {}, secs = sectionsOf(S), out = {}, load = secs.map(function () { return 0; }), strongN = secs.map(function () { return 0; });
    var strong = (opts && opts.strong) || mx.strong || [], leads = mx.leads || [], from = mx.leadsFrom || 0;
    var W = weight || function (cid) { var c = S.characters.find(function (x) { return x.id === cid; }); return c && c.group === 'ensemble' ? 3 : 1; };
    var groupIdx = secs.map(function (s, k) { return s.all ? -1 : k; }).filter(function (k) { return k >= 0; });
    var allowed = function (cid) { return groupIdx.filter(function (k) { return leads.indexOf(cid) < 0 || k >= from; }); };
    var put = function (cid, k) { (out[cid] = out[cid] || []).push(k); load[k] += W(cid); if (strong.indexOf(cid) >= 0) strongN[k]++; };
    var chars = S.characters.filter(function (c) { return !isHelper(c); }).map(function (c) { return c.id; });
    chars.forEach(function (cid) {
      var ok = allowed(cid), keep = [];
      groupIdx.filter(function (k) { return (secs[k].stars || []).indexOf(cid) >= 0 && ok.indexOf(k) >= 0; })
        .forEach(function (k) { if (!keep.some(function (j) { return Math.abs(j - k) === 1; })) keep.push(k); });      // two big songs in a row: the first
      keep.forEach(function (k) { put(cid, k); });
    });
    var rest = chars.filter(function (cid) { return !out[cid]; }).map(function (cid) {
      var ok = allowed(cid), can = ok.filter(function (k) { return knows(S, cid, k); });
      return { cid: cid, can: can.length ? can : ok, w: W(cid), strong: strong.indexOf(cid) >= 0 };
    }).sort(function (a, b) { return (b.strong - a.strong) || a.can.length - b.can.length || b.w - a.w; });
    rest.forEach(function (r) {
      var best = r.can.slice().sort(function (a, b) { return (r.strong ? strongN[a] - strongN[b] : 0) || load[a] - load[b] || a - b; })[0];
      if (best != null) put(r.cid, best);
    });
    /* a mix in every section: a section with fewer than two chorus or minor featured roles (only a few people know its song, like What I've
       Been Looking For) borrows them from the fullest section; they learn it for the Megamix, the price of a good mix */
    var chorusIn = function (k) { return Object.keys(out).filter(function (c) { return out[c].indexOf(k) >= 0 && strong.indexOf(c) < 0 && leads.indexOf(c) < 0; }); };
    groupIdx.forEach(function (k) {
      for (var guard = 0; chorusIn(k).length < 2 && guard < 4; guard++) {
        var donors = rest.filter(function (r) { var a = out[r.cid] || []; return !r.strong && leads.indexOf(r.cid) < 0 && a.length === 1 && a[0] !== k && allowed(r.cid).indexOf(k) >= 0 && chorusIn(a[0]).length > 2; })
          .sort(function (x, y) { return load[out[y.cid][0]] - load[out[x.cid][0]] || x.w - y.w; });
        if (!donors.length) break;
        var d = donors[0], was = out[d.cid][0]; load[was] -= d.w; out[d.cid] = []; put(d.cid, k);
      }
    });
    return out;
  }
  /* the plan as it stands: her changes over the suggestion */
  function resolve(S, saved, weight, opts) {
    var sug = suggest(S, weight, opts), mine = (saved && saved.assign) || {}, out = {};
    Object.keys(sug).forEach(function (cid) { out[cid] = mine[cid] ? mine[cid].slice() : sug[cid]; });
    Object.keys(mine).forEach(function (cid) { if (!out[cid] && S.characters.some(function (c) { return c.id === cid; })) out[cid] = mine[cid].slice(); });
    return out;
  }
  /* what to look at: in two sections in a row, a section they don't know from the show, nobody in a section, in no section */
  function problems(S, assign) {
    var secs = sectionsOf(S), out = [], nm = function (cid) { var c = S.characters.find(function (x) { return x.id === cid; }); return c ? (c.short || c.name) : cid; };
    Object.keys(assign).forEach(function (cid) {
      var a = assign[cid], two = adjacent(a);
      if (two) out.push({ kind: 'row', cid: cid, text: nm(cid) + ' is in ' + secs[two[0]].name + ' and ' + secs[two[1]].name + ', two sections in a row.' });
      a.forEach(function (k) { if (secs[k] && !secs[k].all && !knows(S, cid, k)) out.push({ kind: 'new', cid: cid, text: nm(cid) + ' learns ' + secs[k].name + ' only for the Megamix.' }); });
      if (!a.length) out.push({ kind: 'none', cid: cid, text: nm(cid) + ' is only in the last section.' });
      var mx = S.megamix || {}; if ((mx.leads || []).indexOf(cid) >= 0 && a.some(function (k) { return k < (mx.leadsFrom || 0); })) out.push({ kind: 'lead', cid: cid, text: nm(cid) + ' is a lead in an early section (the leads rest until ' + secs[mx.leadsFrom].name + ').' });
    });
    secs.forEach(function (s, k) { if (!s.all && !Object.keys(assign).some(function (cid) { return assign[cid].indexOf(k) >= 0; })) out.push({ kind: 'empty', text: 'Nobody is in ' + s.name + '.' }); });
    return out;
  }
  /* a Company member who plays more than one character does all their sections: is that two in a row? */
  function studentClashes(S, assign, cast) {
    var secs = sectionsOf(S);
    return (cast || []).map(function (a) {
      var ks = []; (a.chars || []).forEach(function (c) { (assign[c] || []).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); });
      var two = adjacent(ks); return two ? { id: a.id, name: a.name, text: a.name + ' (' + (a.chars || []).join(', ') + ') is in ' + secs[two[0]].name + ' and ' + secs[two[1]].name + ', two in a row.' } : null;
    }).filter(Boolean);
  }
  /* for the rehearsal planner: each section with its people (characters); the last one everyone */
  function forPlan(S, assign) {
    var secs = sectionsOf(S); if (!secs.length) return null;
    return { song: S.megamix.song, sections: secs.map(function (s, k) { return { id: s.id, name: s.name, from: s.from.slice(), all: !!s.all, people: s.all ? null : Object.keys(assign).filter(function (cid) { return assign[cid].indexOf(k) >= 0; }) }; }) };
  }
  var core = { sectionsOf: sectionsOf, knows: knows, suggest: suggest, resolve: resolve, problems: problems, studentClashes: studentClashes, forPlan: forPlan, adjacent: adjacent };
  root.MegamixCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.T) return;
  var T = window.T, MC = window.MegamixCore, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  /* the outline as saved, or the show file's for a show saved before the Megamix sections existed (the same show) */
  function S() { var O = T.O(), D = window.DEFAULT_SHOW; return O.megamix ? O : (D && D.title === O.title && D.megamix ? Object.assign({}, O, { megamix: D.megamix }) : O); }
  var castOf = function (cid) { return (T.show.cast || []).filter(function (a) { return a.name && (a.chars || []).indexOf(cid) >= 0; }); };
  var weight = function (cid) { var n = castOf(cid).length; if (n) return n; var c = T.charById(cid); return c && c.group === 'ensemble' ? 3 : 1; };
  /* the more capable performers: her bow Group 2 (Curtain call), else the show file's list */
  var opts = function () { var P = T.curtainPlan ? T.curtainPlan() : null, g = P && P.groups && P.groups[1]; return g && g.chars && g.chars.length ? { strong: g.chars } : {}; };
  function assignNow() { return MC.resolve(S(), T.show.megamix, weight, opts()); }
  T.Megamix = {
    forPlan: function () { var s = S(); return MC.sectionsOf(s).length ? MC.forPlan(s, assignNow()) : null; },
    /* a Company member's sections (index list) for My bow */
    mine: function (me) { var a = assignNow(), ks = []; (me.chars || []).forEach(function (c) { (a[c] || []).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); }); return { sections: MC.sectionsOf(S()), ks: ks.sort(function (x, y) { return x - y; }) }; }
  };

  T.teacherPages = T.teacherPages || {};
  T.teacherPages.megamix = function () {
    T.setBar('Megamix groups', '#/teacher');
    var s = S(), secs = MC.sectionsOf(s);
    if (!secs.length) { app.innerHTML = '<div class="card"><p>This show’s file has no Megamix sections.</p></div>'; return; }
    var saved = JSON.parse(JSON.stringify(T.show.megamix || { assign: {} })); saved.assign = saved.assign || {};
    var song = T.songById ? T.songById(s.megamix.song) : null;
    var COL = ['#2f6fd1', '#24935d', '#c03aa8', '#d9822b', '#7a4fd6', '#c8962b'];
    function draw() {
      var A = MC.resolve(s, saved, weight, opts()), sug = MC.suggest(s, weight, opts()), probs = MC.problems(s, A), clash = MC.studentClashes(s, A, T.show.cast);
      var groups = (s.groups || []).filter(function (g) { return g.id !== 'helpers'; });
      var chars = s.characters.filter(function (c) { return c.group !== 'helpers'; });
      var head = '<tr><th style="text-align:left">Who</th>' + secs.map(function (x, k) { return '<th style="color:' + COL[k % COL.length] + '">' + (k + 1) + '. ' + esc(x.name) + '</th>'; }).join('') + '</tr>';
      var row = function (c) {
        var a = A[c.id] || [], changed = !!saved.assign[c.id], n = castOf(c.id);
        return '<tr><td>' + T.chip(c.id) + (n.length ? ' <span class="muted small">' + esc(n.map(function (x) { return T.shortName ? T.shortName(x.name) : x.name; }).join(', ')) + '</span>' : '') + (changed ? ' <button class="btn small quiet" data-undo="' + c.id + '" title="Back to the suggestion">↺</button>' : '') + '</td>' +
          secs.map(function (x, k) {
            if (x.all) return '<td class="mx-c mx-all" title="Everyone">●</td>';
            var on = a.indexOf(k) >= 0, kn = MC.knows(s, c.id, k), star = (x.stars || []).indexOf(c.id) >= 0;
            return '<td class="mx-c"><button type="button" class="mx-b' + (on ? ' on' : '') + (kn ? ' kn' : '') + '" data-mx="' + c.id + '|' + k + '" aria-pressed="' + on + '" style="' + (on ? 'background:' + COL[k % COL.length] + ';border-color:' + COL[k % COL.length] : '') + '" aria-label="' + esc(c.short || c.name) + ' in ' + esc(x.name) + '">' + (on ? (star ? '★' : '✓') : kn ? '·' : '') + '</button></td>';
          }).join('') + '</tr>';
      };
      var count = function (k) { var n = 0; chars.forEach(function (c) { if ((A[c.id] || []).indexOf(k) >= 0) n += weight(c.id); }); return n; };
      app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🎶') + 'Megamix groups</h2>' +
        '<p>' + esc(song ? song.title : 'The Megamix') + ' in ' + secs.length + ' sections. Before the last one, each section is done by a group that already knows that song from the show, and the groups change completely between sections. The last section is everyone. The track has the vocals, so anyone can be in any section: nobody needs to sing their own solo.</p>' +
        '<p class="small muted">★ their big song · ✓ in this section · · knows this song from the show. Tap a box to put someone in or take them out. The rehearsal plan teaches each section to its group right after the original song.</p></div>' +
        (probs.length || clash.length ? '<div class="card" style="border-left:6px solid #d9822b"><h3 style="margin-top:0">' + sym('⚠️') + 'To look at</h3><ul class="small">' + probs.concat(clash).map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + '</ul></div>' : '<div class="card" style="border-left:6px solid #24935d"><p style="margin:0">' + sym('✅') + 'Nobody is in two sections in a row, and everyone does songs they know.</p></div>') +
        '<div class="card" style="overflow-x:auto"><table class="mx-t small"><thead>' + head + '<tr><td class="muted">' + ((T.show.cast || []).length ? 'Company members' : 'About (before casting)') + '</td>' + secs.map(function (x, k) { return '<td class="muted" style="text-align:center">' + (x.all ? 'all' : count(k)) + '</td>'; }).join('') + '</tr></thead><tbody>' +
        groups.map(function (g) { var cs = chars.filter(function (c) { return c.group === g.id; }); return cs.length ? '<tr><td colspan="' + (secs.length + 1) + '" class="mx-g">' + esc(g.name) + '</td></tr>' + cs.map(row).join('') : ''; }).join('') +
        chars.filter(function (c) { return !groups.some(function (g) { return g.id === c.group; }); }).map(row).join('') + '</tbody></table></div>' +
        '<div class="card"><h3 style="margin-top:0">The groups</h3>' + secs.map(function (x, k) {
          var who = x.all ? 'Everyone' : chars.filter(function (c) { return (A[c.id] || []).indexOf(k) >= 0; }).map(function (c) { var n = castOf(c.id); return esc(c.short || c.name) + (n.length ? ' <span class="muted">(' + esc(n.map(function (q) { return T.shortName ? T.shortName(q.name) : q.name; }).join(', ')) + ')</span>' : ''); }).join(', ');
          return '<p style="margin:6px 0"><b style="color:' + COL[k % COL.length] + '">' + (k + 1) + '. ' + esc(x.name) + '</b>' + (x.note ? ' <span class="muted small">(' + esc(x.note) + ')</span>' : '') + '<br>' + (who || '<span class="muted">nobody yet</span>') + '</p>';
        }).join('') + '</div>' +
        '<div class="dock"><div class="in"><button class="btn quiet" id="mxall">Back to the suggestion</button><button class="btn quiet" onclick="print()">' + icon('print') + 'Print</button><button class="btn primary" id="mxsv" data-save>Save</button></div></div>';
      app.querySelectorAll('[data-mx]').forEach(function (b) { b.onclick = function () {
        var q = b.dataset.mx.split('|'), cid = q[0], k = +q[1], cur = (A[cid] || []).slice(), i = cur.indexOf(k);
        if (i >= 0) cur.splice(i, 1); else cur.push(k);
        cur.sort(function (x, y) { return x - y; });
        if (JSON.stringify(cur) === JSON.stringify(sug[cid] || [])) delete saved.assign[cid]; else saved.assign[cid] = cur;
        draw();
      }; });
      app.querySelectorAll('[data-undo]').forEach(function (b) { b.onclick = function () { delete saved.assign[b.dataset.undo]; draw(); }; });
      document.getElementById('mxall').onclick = function () { if (Object.keys(saved.assign).length && !confirm('Go back to the suggested groups? Your changes here are replaced (Save to keep it).')) return; saved.assign = {}; draw(); };
      document.getElementById('mxsv').onclick = function () { T.show.megamix = saved; T.saveShow('Megamix groups saved'); };
    }
    draw();
  };
})();
