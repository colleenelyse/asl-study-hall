/* asl.cool/theatre: light, sound and music cues on the real script pages (Colleen 2026-10-21).
   Her rules: light cues are LX, numbered from 5 at the top of the show (1–4 are kept for house cues); sound cues are SX, numbered from 1;
   music cues are MX with the number the script gives them (#7 – ANNOUNCEMENT TRANSITION 1 is MX7). Every blackout or scene change is a "Blue out".
   For songs she puts a light cue when the song starts and between each verse, chorus, bridge or clear change of mood.
   T.show.cues = { list: [{ id, k: 'LX'|'SX'|'MX', n page, y (PDF points from the top), text, sug (a suggestion not yet accepted), mx (MX number) }] }
   LX and SX numbers follow the order on the pages, so adding one in the middle renumbers the ones after it.
   Suggestions come from the script reader: "#N – TITLE" in a stage direction, sound words (school bell, whistle, phone rings…), light words
   (blackout, spotlight, split scene, flashback), scene starts and ends, and for songs: the start, the end, a new singer group, the return of
   lines already sung (a chorus), and a break of 3.5 s or more in the singing (when the song's lyrics timing is saved).
   Scene-change music (the transition tracks) is uploaded as tracks 'mx<N>', so a music cue can play its music. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var newId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var LX_FIRST = 5, SX_FIRST = 1;
  var KINDS = { LX: 'Light', SX: 'Sound', MX: 'Music' };

  var SOUND = /\b(school bell|bells? rings?|whistle blows|blows (?:his|her) whistle|whistle|buzzer|phone rings|rings|ringing|gong|applause|loud cheer|marching band|knock(?:s|ing)?|crash(?:es)?|horn)\b/i;
  var LIGHT = [
    [/\b(black ?out|lights? (?:go )?out|lights? fade(?: out)?|fade to black)\b/i, function () { return 'Blue out'; }],
    [/\bspot ?light\b/i, function () { return 'Spotlight'; }],
    [/\bsplit scene\b/i, function () { return 'Split scene: light both sides'; }],
    [/\bflashback\b/i, function () { return 'Flashback look'; }],
    [/\blights? (?:up|rise|shift|change)\b/i, function (m) { return 'Lights: ' + m[0].toLowerCase(); }]
  ];
  var clean = function (s) { return s.replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim(); };
  var title = function (s) { return clean(s).toLowerCase().replace(/(^|[\s(–-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); };

  /* a music number's name: the song's own title when it is a song (a stage direction can break mid-title) */
  function musicTitle(num, txt) { var so = T.O().songs.find(function (x) { return String(x.num) === String(num); }); return so ? so.title : title(txt); }
  function soundName(w, txt) {
    w = w.toLowerCase();
    if (/ring/.test(w)) return /phone/i.test(txt) ? 'Phone rings' : 'Bell rings';
    if (/whistle/.test(w)) return 'Whistle';
    if (/knock/.test(w)) return 'Knock';
    if (/crash/.test(w)) return 'Crash';
    return title(w);
  }

  /* where an item sits: its first box */
  var at = function (it) { var b = (it.boxes || [])[0] || (it.lyrics && it.lyrics[0] && it.lyrics[0].box); return b ? { n: b.n, y: b.y } : null; };
  var atEnd = function (it) { var bs = it.boxes || [], b = bs[bs.length - 1]; if (it.lyrics && it.lyrics.length) { var lb = it.lyrics[it.lyrics.length - 1].box; if (lb && (!b || lb.n > b.n || (lb.n === b.n && lb.y > b.y))) b = lb; } return b ? { n: b.n, y: b.y + b.h } : null; };

  function suggest() {
    var out = [], O = T.O(), lt = T.show.lyricTimes || {};
    var add = function (k, pos, text, extra) { if (pos) out.push(Object.assign({ id: newId(), k: k, n: pos.n, y: Math.max(0, Math.round(pos.y)), text: text, sug: 1 }, extra || {})); };
    O.scenes.forEach(function (scene) {
      var src = T.scriptScene(scene); if (!src || !src.items.length) return;
      var first = src.items.find(at); if (!first) return;
      var p0 = at(first); add('LX', { n: p0.n, y: p0.y - 14 }, 'Lights up: Scene ' + scene.num + (scene.place ? ' · ' + scene.place : ''));
      src.items.forEach(function (it) {
        var pos = at(it); if (!pos) return;
        if (it.type === 'dir') {
          var re = /#\s?(\d+)\s*[–-]\s*([^.#!]+!?)/g, m, titles = [];
          while ((m = re.exec(it.text))) { titles.push(m[2]); add('MX', pos, musicTitle(m[1], m[2]), { mx: +m[1] }); }
          var sm = it.text.match(SOUND), snd = sm && soundName(sm[1], it.text);
          if (sm && !titles.some(function (t) { return t.toLowerCase().indexOf(snd.toLowerCase()) >= 0; })) add('SX', pos, snd);
          LIGHT.forEach(function (L) { var lm = it.text.match(L[0]); if (lm) add('LX', pos, L[1](lm)); });
        }
        if (it.type === 'song') songCues(it, scene, add, lt);
      });
      var last = src.items.slice().reverse().find(atEnd);
      add('LX', { n: atEnd(last).n, y: atEnd(last).y + 4 }, 'Blue out: scene change');
    });
    out.sort(order);
    // two light cues at almost the same spot: keep the first (a blackout and a scene end, say)
    return out.filter(function (c, i) { var p = out.slice(0, i).reverse().find(function (d) { return d.k === c.k; }); return !p || p.n !== c.n || Math.abs(p.y - c.y) > 12 || c.k === 'MX'; });
  }

  /* a light cue when the song starts, between its sections, and at its end */
  function songCues(it, scene, add, lt) {
    var so = T.O().songs.find(function (s) { return s.scene === scene.id && String(s.num) === String(it.num); });
    var L = it.lyrics || [], times = so && lt[so.id] && lt[so.id].lines, name = so ? so.title : 'the song';
    var p0 = at(it); add('LX', p0, 'Song starts: ' + name);
    var norm = function (t) { return t.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); };
    var seen = {}, lastWho = null, since = 99, prevRepeat = false;
    L.forEach(function (l, i) {
      var k = norm(l.text), why = null, rep = k.length > 6 && seen[k];
      if (i > 0) {
        var gap = times && times[i] && times[i - 1] && times[i].t - times[i - 1].e;
        var nextRep = L[i + 1] && seen[norm(L[i + 1].text)];
        if (gap >= 3.5 && since >= 2) why = 'After the music break';
        else if (rep && nextRep && !prevRepeat && since >= 6) why = 'Chorus';      // two lines in a row that were sung before: a chorus coming back
        else if (l.who && lastWho && l.who !== lastWho && since >= 6) why = 'New section: ' + title(l.who);
      }
      if (why && l.box) { add('LX', { n: l.box.n, y: l.box.y - 4 }, why); since = 0; } else since++;
      prevRepeat = !!rep; if (k.length > 6) seen[k] = 1; if (l.who) lastWho = l.who;
    });
    var e = atEnd(it); if (e) add('LX', e, 'Song ends (button): ' + name);
  }

  function order(a, b) { return a.n - b.n || a.y - b.y; }
  /* the numbers: LX from 5 and SX from 1 in page order; MX from the script */
  T.cueLabel = function (list) {
    var lx = LX_FIRST, sx = SX_FIRST, lab = {};
    list.slice().sort(order).forEach(function (c) { lab[c.id] = c.k + (c.k === 'LX' ? lx++ : c.k === 'SX' ? sx++ : (c.mx != null ? c.mx : '?')); });
    return lab;
  };
  T.cues = function () { return (T.show.cues && T.show.cues.list) || []; };
  T.Cues = {
    suggest: suggest, KINDS: KINDS, order: order,
    /* new suggestions, keeping every cue that was added by hand or accepted */
    refresh: function () {
      var keep = T.cues().filter(function (c) { return !c.sug; }), fresh = suggest();
      fresh = fresh.filter(function (c) { return !keep.some(function (k) { return k.k === c.k && k.n === c.n && Math.abs(k.y - c.y) < 14; }); });
      T.show.cues = { list: keep.concat(fresh).sort(order), made: Date.now() };
      return fresh.length;
    },
    musicNumbers: function () {      // every "#N – TITLE" in the script: { num: title }
      var out = {};
      T.O().scenes.forEach(function (scene) { var src = T.scriptScene(scene); if (src) src.items.forEach(function (it) { if (it.type !== 'dir') return; var re = /#\s?(\d+)\s*[–-]\s*([^.#!]+!?)/g, m; while ((m = re.exec(it.text))) if (!out[m[1]]) out[m[1]] = title(m[2]); }); });
      return out;
    },
    trackId: function (num) { var so = T.O().songs.find(function (s) { return String(s.num) === String(num); }); return so ? so.id : 'mx' + num; },
    /* the music connected to MX<num>: { kind, name, dur } or null */
    music: function (num) { var t = (T.show.tracks || {})[T.Cues.trackId(num)] || {}, kind = t.performance ? 'performance' : t.rehearsal ? 'rehearsal' : null; return kind ? { kind: kind, name: t[kind].name || '', dur: t[kind].dur } : null; },
    musicText: function (num) { var m = T.Cues.music(num); return m ? (m.kind === 'performance' ? 'band track' : 'guide vocals only') + ' ' + T.clock(m.dur) : 'no music connected yet'; },
    play: function (num) {      // a music cue's music (the band track; the guide vocals if that is all there is)
      var id = T.Cues.trackId(num), t = (T.show.tracks || {})[id] || {}, kind = t.performance ? 'performance' : t.rehearsal ? 'rehearsal' : null;
      if (!kind) { T.toast('No music uploaded for MX' + num + ' yet.'); return null; }
      var a = new Audio();
      Store.getTrack(T.key, id, kind, t[kind].ver).then(function (b) { a.src = URL.createObjectURL(new Blob([b])); a.play(); });
      T.cleanup.push(function () { a.pause(); });
      return a;
    }
  };

  /* ---------- the stage manager script (Colleen: "the original pdf with text added over the top"; light cues yellow, music pink, sound blue) ----------
     every page of the real script, a little smaller, with a cue column down the left: each cue's number and words on its color, a line to the spot,
     and that line of the script highlighted in the cue's color. Printed, or saved as a PDF from the print window. */
  var SM_COLOR = { LX: '#ffe14d', MX: '#ff9fd0', SX: '#8fd3ff', SC: '#7ee08a', PR: '#ffb35c', ST: '#3ccfbd', CO: '#ff7f7f' };      // props orange, set pieces teal, costume red: none used by the cues on the left (Colleen 2026-10-24)
  T.Cues.COLOR = SM_COLOR;
  /* a scene change (Colleen: scene changes in green): the Blue out at a scene's end, and the Lights up that starts the next scene */
  var isChange = function (c) { return c.k === 'LX' && /^(blue out: scene change|lights up: scene)/i.test(c.text); };
  T.Cues.isChange = isChange;
  var colorOf = function (c) { return SM_COLOR[isChange(c) ? 'SC' : c.k]; };
  T.teacherPages.smscript = function () {
    T.setBar('Stage manager script', '#/teacher/cues');
    if (!T.Pages || !T.Pages.ready()) { app.innerHTML = '<div class="card"><p>The script pages are not saved yet. Go to <a href="#/teacher/script">Script</a>, choose the PDF, and press <b>Save the script</b> (wait for “Script and pages saved”).</p></div>'; return; }
    var st = Object.assign({ sug: true, notes: false, props: true, costume: true }, T.ls('smScript') || {}), nS = T.cues().filter(function (c) { return c.sug; }).length;
    app.innerHTML = '<div class="card noprint"><h2>' + sym('📋') + 'Stage manager script</h2>' +
      '<p>The real script with every cue written beside it: <span class="tag" style="background:' + SM_COLOR.LX + ';color:#1d1a2e">LX light</span> <span class="tag" style="background:' + SM_COLOR.MX + ';color:#1d1a2e">MX music</span> <span class="tag" style="background:' + SM_COLOR.SX + ';color:#1d1a2e">SX sound</span> <span class="tag" style="background:' + SM_COLOR.SC + ';color:#1d1a2e">scene change</span> <span class="tag" style="background:' + SM_COLOR.PR + ';color:#1d1a2e">props</span> <span class="tag" style="background:' + SM_COLOR.ST + ';color:#1d1a2e">set pieces</span> <span class="tag" style="background:' + SM_COLOR.CO + ';color:#1d1a2e">costume</span>, and the line where each one happens highlighted in its color.</p>' +
      '<label class="row" style="gap:6px"><input type="checkbox" id="sg"' + (st.sug ? ' checked' : '') + '>Include the ' + nS + ' suggested cues not accepted yet</label>' +
      '<label class="row" style="gap:6px"><input type="checkbox" id="pp"' + (st.props ? ' checked' : '') + '>Include props and set pieces (how many, and who)</label>' +
      '<label class="row" style="gap:6px"><input type="checkbox" id="cc"' + (st.costume ? ' checked' : '') + '>Highlight costume notes</label>' +
      '<label class="row" style="gap:6px"><input type="checkbox" id="dn"' + (st.notes ? ' checked' : '') + '>Include the director’s notes</label>' +
      '<div class="row end" style="margin-top:10px"><button class="btn primary" id="mk">' + icon('print') + 'Make it</button></div><p class="muted small">It takes a minute or two for the whole script. Then print, or choose “Save as PDF” in the print window. For your cast and crew only.</p></div><div id="out"></div>';
    var keep = function () { T.ls('smScript', st); };
    document.getElementById('sg').onchange = function () { st.sug = this.checked; keep(); };
    document.getElementById('dn').onchange = function () { st.notes = this.checked; keep(); };
    document.getElementById('pp').onchange = function () { st.props = this.checked; keep(); };
    document.getElementById('cc').onchange = function () { st.costume = this.checked; keep(); };
    document.getElementById('mk').onclick = function () { makeSM(st, this); };
  };
  /* props, set pieces and costume notes (needs.js), with the teacher's own counts and the ones she marked not needed */
  function needsList() {
    var r = T.Needs.fromShow(), ov = (T.show.needs || {});
    r.items = r.items.filter(function (it) { return !(ov[it.key] && ov[it.key].off); });
    r.items.forEach(function (it) { it.show = howMany(it, ov[it.key]); });
    return r;
  }
  T.Cues.needs = needsList;
  T.Cues.pageWords = function (doc, n) { return pageWords(doc, n); };      // shared with Read the script (script-view.js)
  T.Cues.wordRects = function (runs, word, y) { return wordRects(runs, word, y); };
  function howMany(it, o) {
    if (o && o.count) return String(o.count);
    var n = Math.max(it.count, it.listQty || 0);
    return n + (it.eachOf.length ? ' + one for each of the ' + it.eachOf.map(function (g) { var c = T.charById(g); return c ? c.short : g; }).join(', ') : '');
  }
  function whoText(ids) { return ids.map(function (id) { var c = T.charById(id); return c ? c.short : id; }).join(', ') || 'set dressing'; }
  function makeSM(st, btn) {
    var out = document.getElementById('out'), sc = T.show.script, list = T.cues().filter(function (c) { return st.sug || !c.sug; }), lab = T.cueLabel(T.cues());
    var notes = st.notes ? (T.show.scriptNotes || []).filter(function (n) { return !n.del; }) : [];
    var pages = (sc.pages || []).map(function (p) { return p.n; });
    var need = (st.props || st.costume) && T.Needs ? needsList() : { items: [], costume: [] }, marks = [];
    if (st.props) need.items.forEach(function (it) { it.spots.forEach(function (s) { marks.push({ n: s.n, y: s.y, word: s.word, color: it.kind === 'set' ? SM_COLOR.ST : SM_COLOR.PR, head: it.kind === 'set' ? 'SET' : 'PROP', text: it.name + ' · ' + whoText(s.who.length ? s.who : it.who) + ' (' + it.show + ' in all)' }); }); });
    if (st.costume) need.costume.forEach(function (c) { marks.push({ n: c.n, y: c.y, word: c.word, color: SM_COLOR.CO, head: 'COSTUME', text: '“' + c.text + '”' + (c.who.length ? ' · ' + whoText(c.who) : c.said.length ? ' (said by ' + whoText(c.said) + ')' : '') }); });
    btn.disabled = true; out.innerHTML = '<p class="muted noprint" id="mkp">Making ' + pages.length + ' pages…</p>';
    var W = 1100, COL = 250, GAP = 18, RCOL = marks.length ? 230 : 0;      // props, set and costume go in their own column on the right (Colleen: not with the cues)
    /* prompt-book style (Colleen's samples): cues on the same line are one call ("LX 22 / SX 2 GO [what happens]"), and every call gets a
       Standby before it: right after the call before (when it is within about a page), else about 200 points ahead */
    var calls = [];
    list.slice().sort(order).forEach(function (c) { var last = calls[calls.length - 1]; if (last && last.n === c.n && Math.abs(last.y - c.y) < 8) last.cues.push(c); else calls.push({ n: c.n, y: c.y, cues: [c] }); });
    var standbys = {}, pageH = function (n) { return T.Pages.size(n).h; };
    var gapOf = function (a, b) { var d = 0; for (var q = a.n; q < b.n; q++) d += pageH(q); return d + b.y - a.y; };
    /* calls close together (within about 150 points) share one standby, like "Standby LX 10–14 · SX 4–6" */
    var clusters = [];
    calls.forEach(function (cl) { var last = clusters[clusters.length - 1]; if (last && gapOf(last[last.length - 1], cl) < 150) last.push(cl); else clusters.push([cl]); });
    clusters.forEach(function (cs, j) {
      var first = cs[0], prev = clusters[j - 1], at;
      if (prev) { var pl = prev[prev.length - 1]; if (gapOf(pl, first) < 480) at = { n: pl.n, y: pl.y + 16 }; }
      if (!at) at = first.y - 200 >= 30 ? { n: first.n, y: first.y - 200 } : (pages.indexOf(first.n - 1) >= 0 ? { n: first.n - 1, y: pageH(first.n - 1) - 90 } : { n: first.n, y: Math.max(20, first.y - 60) });
      var key = at.n + ':' + Math.round(at.y), all = [].concat.apply([], cs.map(function (c) { return c.cues; }));
      (standbys[key] = standbys[key] || { n: at.n, y: at.y, cues: [] }).cues = standbys[key].cues.concat(all);
    });
    var ranges = function (cs) {      // "LX 10–14 · SX 4–6 · MX 7"
      var by = {};
      cs.forEach(function (c) { var m = String(lab[c.id]).match(/^([A-Z]+)(.*)$/); (by[m[1]] = by[m[1]] || []).push(m[2]); });
      return ['LX', 'SX', 'MX'].filter(function (k) { return by[k]; }).map(function (k) {
        var nums = by[k].map(Number).filter(function (x) { return !isNaN(x); }).sort(function (a, b) { return a - b; }), out = [], i = 0;
        while (i < nums.length) { var a = nums[i]; while (i + 1 < nums.length && nums[i + 1] === nums[i] + 1) i++; out.push(a === nums[i] ? String(a) : a + '–' + nums[i]); i++; }
        return k + ' ' + (out.join(', ') || by[k].join(', '));
      }).join(' · ');
    };
    T.Pages.doc().then(function (doc) {
      var i = 0;
      return pages.reduce(function (p, n) {
        return p.then(function () {
          var sz = T.Pages.size(n), pw = W - COL - GAP - 10 - (RCOL ? RCOL + GAP : 0);
          var hasMarks = marks.some(function (x) { return x.n === n && x.word; });
          return Promise.all([T.Pages.draw(doc, n, pw, 1, true), hasMarks ? pageWords(doc, n) : null]).then(function (both) {
            var r = both[0], runs = both[1];
            var k = r.canvas.width / sz.w, ph = r.canvas.height, H = Math.max(ph + 20, Math.round(W * 11 / 8.5));
            var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            var ctx = cv.getContext('2d'), ox = COL + GAP, oy = 10;
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(r.canvas, ox, oy);
            var mine = calls.filter(function (c) { return c.n === n && c.cues.some(function (q) { return list.indexOf(q) >= 0; }); });
            var here = marks.filter(function (x) { return x.n === n; });
            // the line where each call happens: a light tint in its color (multiply keeps the words black) and a rule under it, as in a prompt book
            ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55;
            var lit = [];
            mine.forEach(function (c) { c.cues.forEach(function (q) { lit.push({ y: c.y, color: colorOf(q) }); }); });
            here.forEach(function (x) {      // props, set and costume: only their own words (Colleen), else the line
              x.rects = runs && x.word ? wordRects(runs, x.word, x.y) : [];
              if (x.rects.length) x.rects.forEach(function (q) { ctx.fillStyle = x.color; ctx.fillRect(ox + (q.x - 1) * k, oy + q.y * k, (q.w + 2) * k, q.h * k); });
              else lit.push({ y: x.y, color: x.color });
            });
            lit.sort(function (a, b) { return a.y - b.y; });
            var groups = []; lit.forEach(function (c) { var g = groups[groups.length - 1]; if (g && Math.abs(g[0].y - c.y) < 8) { if (!g.some(function (x) { return x.color === c.color; })) g.push(c); } else groups.push([c]); });
            groups.forEach(function (g) { var h = 15 / g.length; g.forEach(function (c, j) { ctx.fillStyle = c.color; ctx.fillRect(ox + 40 * k, oy + (g[0].y - 2 + j * h) * k, (sz.w - 70) * k, h * k); }); });
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#555'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('STAGE MANAGER · page ' + T.Pages.printed(n), 10, 24);
            /* entries: { y, kind: 'go' | 'sb' | 'note' | 'mark', chips: [[text, color]], text } */
            var left = mine.map(function (c) {
              var desc = c.cues.map(function (q) { return q.text + (q.k === 'MX' ? ' · ' + T.Cues.musicText(q.mx) : ''); }).filter(function (t, i2, a) { return a.indexOf(t) === i2; }).join('; ');
              return { y: c.y, kind: 'go', chips: c.cues.map(function (q) { return [String(lab[q.id]).replace(/^([A-Z]+)/, '$1 '), colorOf(q)]; }), text: '[' + desc + ']' };
            }).concat(Object.keys(standbys).map(function (key) { return standbys[key]; }).filter(function (sb) { return sb.n === n && sb.cues.some(function (q) { return list.indexOf(q) >= 0; }); })
              .map(function (sb) { return { y: sb.y, kind: 'sb', chips: [], text: 'Standby ' + ranges(sb.cues.filter(function (q) { return list.indexOf(q) >= 0; })) }; }))
              .concat(notes.filter(function (x) { return x.n === n; }).map(function (x) { return { y: x.y, kind: 'note', chips: [['NOTE', '#e3d4ff']], text: x.text }; }));
            var right = here.map(function (x) { var q = x.rects && x.rects[x.rects.length - 1]; return { y: x.y, kind: 'mark', chips: [[x.head, x.color]], text: x.text, to: q ? { x: q.x + q.w, y: q.y + q.h } : null }; });
            var column = function (list2, x0, w, lineX, fromRight) {
              var bottom = 34;
              list2.sort(function (a, b) { return a.y - b.y || (a.kind === 'sb' ? -1 : 1); }).forEach(function (c) {
                ctx.font = (c.kind === 'sb' ? 'italic ' : '') + '15px system-ui, sans-serif';
                var lines = wrap(ctx, c.text, w - (c.kind === 'sb' ? 44 : 24)), head = c.chips.length ? 24 : 0, h = head + lines.length * 18 + 8, ty = oy + c.y * k, top = Math.max(ty - 12, bottom + 6);
                if (c.kind === 'sb') { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; round(ctx, x0, top, w - 8, h, h / 2); ctx.stroke(); }
                var x = x0 + 8;
                c.chips.forEach(function (ch) { ctx.font = '800 15px system-ui, sans-serif'; var tw = ctx.measureText(ch[0]).width; ctx.fillStyle = ch[1]; round(ctx, x - 3, top + 3, tw + 6, 21, 4); ctx.fill(); ctx.fillStyle = '#1d1a2e'; ctx.fillText(ch[0], x, top + 19); x += tw + 9; });
                if (c.kind === 'go') { ctx.font = '900 16px system-ui, sans-serif'; ctx.fillStyle = '#1d1a2e'; ctx.fillText('GO', x, top + 19); }
                ctx.fillStyle = '#1d1a2e'; ctx.font = (c.kind === 'sb' ? 'italic 600 ' : '') + '15px system-ui, sans-serif';
                lines.forEach(function (l, j) { ctx.fillText(l, x0 + (c.kind === 'sb' ? 14 : 8), top + head + 16 + j * 18); });
                if (c.kind !== 'sb') {      // a rule under the entry, then on to its line in the script
                  var ry = top + h - 2; ctx.strokeStyle = '#1d1a2e'; ctx.lineWidth = 1.5; ctx.beginPath();
                  if (fromRight && c.to) { ctx.moveTo(x0 + w - 8, ry); ctx.lineTo(x0, ry); ctx.lineTo(ox + c.to.x * k, oy + c.to.y * k); }      // straight to the words
                  else if (fromRight) { ctx.moveTo(x0 + w - 8, ry); ctx.lineTo(x0, ry); ctx.lineTo(lineX, ty + 13 * k); ctx.lineTo(lineX - (sz.w - 70) * k * 0.25, ty + 13 * k); }
                  else { ctx.moveTo(x0, ry); ctx.lineTo(x0 + w - 8, ry); ctx.lineTo(lineX, ty + 13 * k); ctx.lineTo(lineX + (sz.w - 70) * k, ty + 13 * k); }
                  ctx.stroke();
                }
                bottom = top + h;
              });
            };
            column(left, 6, COL, ox + 40 * k, false);      // cues, standbys and notes on the left
            if (RCOL && right.length) column(right, ox + r.canvas.width + GAP, RCOL, ox + (sz.w - 30) * k, true);      // props, set and costume on the right
            var img = new Image(); img.className = 'printpage'; img.alt = 'Page ' + T.Pages.printed(n); img.src = cv.toDataURL('image/jpeg', 0.85);
            out.appendChild(img); r.canvas.width = r.canvas.height = 0; cv.width = cv.height = 0;
            var m = document.getElementById('mkp'); if (m) m.textContent = 'Making pages… ' + (++i) + ' of ' + pages.length;
          });
        });
      }, Promise.resolve()).then(function () {
        var m = document.getElementById('mkp'); if (m) m.outerHTML = '<div class="row noprint" style="margin:10px 0"><button class="btn primary" onclick="print()">' + icon('print') + 'Print</button><span class="muted small">' + pages.length + ' pages · ' + list.length + ' cues</span></div>';
        btn.disabled = false;
      });
    }).catch(function (e) { out.innerHTML = '<p class="err">' + esc(e.message || 'The pages would not load.') + '</p>'; btn.disabled = false; });
  }
  /* the words on a PDF page with their places (points from the top-left, like the reader's boxes) */
  function pageWords(doc, n) {
    return doc.getPage(n).then(function (pg) {
      var vp = pg.getViewport({ scale: 1 });
      return pg.getTextContent().then(function (tc) {
        return tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
          var pt = vp.convertToViewportPoint(i.transform[4], i.transform[5]), size = Math.hypot(i.transform[2], i.transform[3]) || i.height || 10;
          return { s: i.str, x: pt[0], base: pt[1], w: i.width, size: size };
        });
      });
    }).catch(function () { return null; });
  }
  /* where some words sit near a line: the whole phrase inside one run of text, else each word on its own (a phrase broken over two lines) */
  function wordRects(runs, word, y) {
    var near = runs.filter(function (r) { return r.base > y - 30 && r.base < y + 45; }).sort(function (a, b) { return Math.abs(a.base - y - 10) - Math.abs(b.base - y - 10); });
    /* letters differ in width: measure the run in a book font and share its real width out by that (better than by letter count) */
    var mctx = wordRects.ctx || (wordRects.ctx = document.createElement('canvas').getContext('2d')); mctx.font = '20px "Times New Roman", Georgia, serif';
    var rectIn = function (r, a, len) { var whole = mctx.measureText(r.s).width || 1, k2 = r.w / whole, x0 = mctx.measureText(r.s.slice(0, a)).width * k2, x1 = mctx.measureText(r.s.slice(0, a + len)).width * k2; return { x: r.x + x0, y: r.base - r.size * 0.82, w: x1 - x0, h: r.size * 1.08 }; };
    var lw = word.toLowerCase();
    for (var i = 0; i < near.length; i++) { var at = near[i].s.toLowerCase().indexOf(lw); if (at >= 0) return [rectIn(near[i], at, word.length)]; }
    var out = [];
    word.split(/\s+/).filter(function (t) { return t.length > 1; }).forEach(function (t) {
      var lt = t.toLowerCase(), r = near.find(function (q) { return q.s.toLowerCase().indexOf(lt) >= 0; });
      if (r) out.push(rectIn(r, r.s.toLowerCase().indexOf(lt), t.length));
    });
    return out;
  }
  function wrap(ctx, text, w) {
    var out = [], line = '';
    text.split(/\s+/).forEach(function (word) { var t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; });
    if (line) out.push(line); return out.slice(0, 4);
  }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* ---------- the cue sheet (teacher): every cue in order, filter, print ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.cues = function () {
    T.setBar('Cue sheet', '#/teacher');
    if (!T.Pages || !T.Pages.ready()) { app.innerHTML = '<div class="card"><p>The script pages are not saved yet. Go to <a href="#/teacher/script">Script</a>, choose the PDF, and press <b>Save the script</b> (wait for “Script and pages saved”).</p></div>'; return; }
    var st = Object.assign({ k: '', sug: true }, T.ls('cueSheet') || {}), sc = T.show.script;
    var pageOf = T.Pages.printed;
    function draw() {
      var list = T.cues().slice().sort(order), lab = T.cueLabel(list), nS = list.filter(function (c) { return c.sug; }).length;
      var rows = list.filter(function (c) { return (!st.k || c.k === st.k) && (st.sug || !c.sug); });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('💡') + 'Light, sound and music cues</h2>' +
        '<p class="muted small">LX light cues start at 5 (1–4 are for house cues), SX sound cues start at 1, MX music cues use the script’s numbers. Every blackout or scene change is a <b>Blue out</b>. ' +
        'Suggestions have a dashed outline until you accept them. Add, move and edit cues on <a href="#/teacher/read">Read the script</a>.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><div class="seg" id="kf">' + [['', 'All']].concat(Object.keys(KINDS).map(function (k) { return [k, k]; })).concat([['PR', 'Props & set'], ['CO', 'Costume notes']]).map(function (x) { return '<button type="button" data-v="' + x[0] + '" aria-pressed="' + (st.k === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<label class="row" style="gap:6px"><input type="checkbox" id="ss"' + (st.sug ? ' checked' : '') + '>Show suggestions</label><span class="grow"></span>' +
        '<button class="btn" id="mk">' + (list.length ? 'Suggest again' : 'Suggest cues from the script') + '</button>' +
        (nS ? '<button class="btn" id="acc">Accept all ' + nS + ' suggestions</button>' : '') +
        '<a class="btn" href="#/teacher/smscript">' + sym('📋') + 'Stage manager script</a>' +
        '<button class="btn primary" onclick="print()">' + icon('print') + 'Print</button></div><p id="st" class="muted small" role="status"></p></div>' +
        (st.k === 'PR' ? propsTable() : st.k === 'CO' ? costumeTable() : rows.length ? '<table class="tbl cuesheet"><thead><tr><th>Cue</th><th>Page</th><th>What happens</th><th class="noprint"></th></tr></thead><tbody>' + rows.map(function (c) {
          return '<tr class="row-' + (isChange(c) ? 'SC' : c.k) + (c.sug ? ' sug' : '') + '"><td><b>' + lab[c.id] + '</b></td><td>' + esc(pageOf(c.n)) + '</td><td>' + esc(c.text) + (c.k === 'MX' ? ' <span class="tag">' + esc(T.Cues.musicText(c.mx)) + '</span>' + (T.Cues.music(c.mx) ? '' : ' <a class="small noprint" href="#/teacher/songs">Connect music</a>') : '') + (c.sug ? ' <span class="tag noprint">suggested</span>' : '') + '</td>' +
            '<td class="noprint">' + (c.k === 'MX' ? '<button class="btn small" data-play="' + c.mx + '">▶</button> ' : '') + '<a class="btn small" href="#/teacher/read/' + c.n + '">On the page</a></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="card muted">No cues yet. Press <b>Suggest cues from the script</b>.</p>');
      app.querySelectorAll('[data-ncount]').forEach(function (inp) { inp.onchange = function () { var o = need(inp.dataset.ncount), v = Math.max(0, Math.round(+inp.value || 0)); if (v) o.count = v; else delete o.count; T.saveShow('Saved').then(draw); }; });
      app.querySelectorAll('[data-noff]').forEach(function (b) { b.onclick = function () { var o = need(b.dataset.noff); o.off = !o.off; T.saveShow(o.off ? 'Marked not needed' : 'Back on the list').then(draw); }; });
      app.querySelectorAll('#kf [data-v]').forEach(function (b) { b.onclick = function () { st.k = b.dataset.v; T.ls('cueSheet', st); draw(); }; });
      document.getElementById('ss').onchange = function () { st.sug = this.checked; T.ls('cueSheet', st); draw(); };
      document.getElementById('mk').onclick = function () {
        if (T.cues().some(function (c) { return c.sug; }) && !confirm('Replace the suggestions you have not accepted yet? Cues you accepted or added stay.')) return;
        var n = T.Cues.refresh(); T.saveShow(n + ' cues suggested').then(draw);
      };
      var acc = document.getElementById('acc'); if (acc) acc.onclick = function () { T.cues().forEach(function (c) { delete c.sug; }); T.saveShow('All cues accepted').then(draw); };
      var playing = null;
      app.querySelectorAll('[data-play]').forEach(function (b) { b.onclick = function () { if (playing) { playing.pause(); playing = null; return; } playing = T.Cues.play(b.dataset.play); }; });
    }
    function need(key) { var N = T.show.needs = T.show.needs || {}; return (N[key] = N[key] || {}); }
    function chips(ids) { return ids.map(function (id) { return T.charById(id) ? T.chip(id) : esc(id); }).join(' ') || '<span class="muted">set dressing</span>'; }
    function propsTable() {
      if (!T.show.script) return '<p class="card muted">Add the script first.</p>';
      var all = T.Needs.fromShow().items, ov = T.show.needs || {};
      all.sort(function (a, b) { return ((ov[a.key] || {}).off ? 1 : 0) - ((ov[b.key] || {}).off ? 1 : 0); });
      return '<p class="muted small noprint">Found in the stage directions, plus your props list (Production › Shopping). <b>How many</b>: one for each person who has their own (“his phone”), or the number in the words; type your own number to change it. Who is the person named just before it in the directions.</p>' +
        ['prop', 'set'].map(function (kind) {
          var l = all.filter(function (it) { return it.kind === kind; }); if (!l.length) return '';
          return '<h3>' + (kind === 'prop' ? sym('🎒') + 'Props' : sym('🪑') + 'Set pieces') + '</h3><table class="tbl cuesheet"><thead><tr><th>' + (kind === 'prop' ? 'Prop' : 'Set piece') + '</th><th>How many</th><th>Who</th><th>Scenes</th><th class="noprint"></th></tr></thead><tbody>' + l.map(function (it) {
            var o = ov[it.key] || {};
            return '<tr class="row-' + (kind === 'set' ? 'ST' : 'PR') + (o.off ? ' sug' : '') + '"><td><b>' + esc(it.name) + '</b>' + (o.off ? ' <span class="tag">not needed</span>' : '') + (it.onlyList ? '<br><span class="muted small">from your props list (not in the directions)</span>' : '') + '</td>' +
              '<td><span class="printonly">' + esc(howMany(it, o)) + '</span><span class="noprint"><input data-ncount="' + esc(it.key) + '" inputmode="numeric" value="' + esc(o.count || '') + '" placeholder="' + esc(String(Math.max(it.count, it.listQty || 0))) + '" style="width:64px;min-height:40px;border:2px solid var(--line);border-radius:10px;padding:2px 8px;background:var(--card)">' +
              (it.eachOf.length && !o.count ? ' <span class="small">+ one for each of the ' + esc(whoText(it.eachOf)) + '</span>' : '') + (it.listQty && it.listQty !== it.count && !o.count ? '<br><span class="muted small">props list: ' + it.listQty + ' · directions: ' + it.count + '</span>' : '') + '</span></td>' +
              '<td>' + chips(it.who) + '</td><td>' + esc(it.scenes.join(', ')) + '</td>' +
              '<td class="noprint"><button class="btn small" data-noff="' + esc(it.key) + '">' + (o.off ? 'Needed after all' : 'Not needed') + '</button>' + (it.spots[0] ? ' <a class="btn small" href="#/teacher/read/' + it.spots[0].n + '">On the page</a>' : '') + '</td></tr>';
          }).join('') + '</tbody></table>';
        }).join('');
    }
    function costumeTable() {
      if (!T.show.script) return '<p class="card muted">Add the script first.</p>';
      var l = T.Needs.fromShow().costume;
      return '<p class="muted small noprint">Every place the script mentions clothing (wearing, glasses, jerseys, costumes…), in the directions and in the lines. On the stage manager script they are highlighted in red. Your costume plot is on the Costumes page.</p>' +
        (l.length ? '<table class="tbl cuesheet"><thead><tr><th>Scene</th><th>Page</th><th>The script says</th><th>Who</th><th class="noprint"></th></tr></thead><tbody>' + l.map(function (c) {
          return '<tr class="row-CO"><td>' + esc(c.num) + '</td><td>' + esc(pageOf(c.n)) + '</td><td>“' + esc(c.text) + '”</td><td>' + (c.who.length ? chips(c.who) : c.said.length ? '<span class="small">said by</span> ' + chips(c.said) : '') + '</td><td class="noprint"><a class="btn small" href="#/teacher/read/' + c.n + '">On the page</a></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="card muted">The script does not mention clothing anywhere.</p>');
    }
    draw();
  };
})();
