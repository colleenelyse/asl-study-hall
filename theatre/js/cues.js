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
    play: function (num) {      // a music cue's music (the band track; the guide vocals if that is all there is)
      var id = T.Cues.trackId(num), t = (T.show.tracks || {})[id] || {}, kind = t.performance ? 'performance' : t.rehearsal ? 'rehearsal' : null;
      if (!kind) { T.toast('No music uploaded for MX' + num + ' yet.'); return null; }
      var a = new Audio();
      Store.getTrack(T.key, id, kind, t[kind].ver).then(function (b) { a.src = URL.createObjectURL(new Blob([b])); a.play(); });
      T.cleanup.push(function () { a.pause(); });
      return a;
    }
  };

  /* ---------- the cue sheet (teacher): every cue in order, filter, print ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.cues = function () {
    T.setBar('Cue sheet', '#/teacher');
    if (!T.Pages || !T.Pages.ready()) { app.innerHTML = '<div class="card"><p>Import the script PDF first.</p></div>'; return; }
    var st = Object.assign({ k: '', sug: true }, T.ls('cueSheet') || {}), sc = T.show.script;
    var pageOf = T.Pages.printed;
    function draw() {
      var list = T.cues().slice().sort(order), lab = T.cueLabel(list), nS = list.filter(function (c) { return c.sug; }).length;
      var rows = list.filter(function (c) { return (!st.k || c.k === st.k) && (st.sug || !c.sug); });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('💡') + 'Light, sound and music cues</h2>' +
        '<p class="muted small">LX light cues start at 5 (1–4 are for house cues), SX sound cues start at 1, MX music cues use the script’s numbers. Every blackout or scene change is a <b>Blue out</b>. ' +
        'Suggestions have a dashed outline until you accept them. Add, move and edit cues on <a href="#/teacher/read">Read the script</a>.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><div class="seg" id="kf">' + [['', 'All']].concat(Object.keys(KINDS).map(function (k) { return [k, k]; })).map(function (x) { return '<button type="button" data-v="' + x[0] + '" aria-pressed="' + (st.k === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        '<label class="row" style="gap:6px"><input type="checkbox" id="ss"' + (st.sug ? ' checked' : '') + '>Show suggestions</label><span class="grow"></span>' +
        '<button class="btn" id="mk">' + (list.length ? 'Suggest again' : 'Suggest cues from the script') + '</button>' +
        (nS ? '<button class="btn" id="acc">Accept all ' + nS + ' suggestions</button>' : '') +
        '<button class="btn primary" onclick="print()">' + icon('print') + 'Print</button></div><p id="st" class="muted small" role="status"></p></div>' +
        (rows.length ? '<table class="tbl cuesheet"><thead><tr><th>Cue</th><th>Page</th><th>What happens</th><th class="noprint"></th></tr></thead><tbody>' + rows.map(function (c) {
          return '<tr class="row-' + c.k + (c.sug ? ' sug' : '') + '"><td><b>' + lab[c.id] + '</b></td><td>' + esc(pageOf(c.n)) + '</td><td>' + esc(c.text) + (c.sug ? ' <span class="tag noprint">suggested</span>' : '') + '</td>' +
            '<td class="noprint">' + (c.k === 'MX' ? '<button class="btn small" data-play="' + c.mx + '">▶</button> ' : '') + '<a class="btn small" href="#/teacher/read/' + c.n + '">On the page</a></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="card muted">No cues yet. Press <b>Suggest cues from the script</b>.</p>');
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
    draw();
  };
})();
