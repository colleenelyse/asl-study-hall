/* asl.cool/theatre: the whole script as the real PDF pages, with notes pinned anywhere on a page (Colleen 2026-10-21: "i want both modes to be
   able to see the actual pdf and add notes").
   - Students (#/script): their own lines highlighted green; their notes (yellow) are theirs alone, saved with their practice record
     (T.Progress.saveNote), so they follow them to another iPad; the director's notes (purple) show for everyone.
   - Teacher (#/teacher/read): highlight any character's lines; her notes are the director's notes, saved in the show for the whole cast.
   Pages are drawn only near the screen and dropped when far away, so a 100-page script stays light on a Chromebook. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var newId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  function ask(html, onOpen) {
    var d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal(); if (onOpen) onOpen(d); return d;
  }

  function view(o) {      // o: { teacher, back }
    T.setBar('The script', o.back);
    if (!T.Pages || !T.Pages.ready()) { app.innerHTML = '<div class="card"><p>The script pages are not ready yet. ' + (o.teacher ? 'Go to <a href="#/teacher/script">Script</a>, choose the PDF, and press <b>Save the script</b> (wait for “Script and pages saved”).' : 'Your teacher saves them when importing the script.') + '</p></div>'; return; }
    var sc = T.show.script, O = T.O(), adding = false;
    var st = Object.assign({ hl: o.teacher ? '' : 'mine', mine: true, dir: true, cues: !!o.teacher, feel: true }, T.ls('scriptView' + (o.teacher ? 'T' : '')) || {});
    var keep = function () { T.ls('scriptView' + (o.teacher ? 'T' : ''), st); };
    var chars = function () { return o.teacher ? (st.hl ? [st.hl] : []) : (st.hl === 'mine' && T.me ? T.me.chars || [] : []); };
    var dirNotes = function () { return (T.show.scriptNotes || []).filter(function (n) { return !n.del; }); };
    var myNotes = function () { if (o.teacher || !T.Progress) return []; var m = T.Progress.notes(); return Object.keys(m).map(function (k) { return m[k]; }).filter(function (n) { return !n.del; }); };

    // where each scene starts: its heading sits just above its first item
    var scenes = O.scenes.map(function (s) {
      var src = T.scriptScene(s), it = src && src.items.find(function (x) { return x.boxes && x.boxes.length; });
      return it ? { s: s, n: it.boxes[0].n, y: Math.max(0, it.boxes[0].y - 52) } : null;
    }).filter(Boolean);
    var hlPick = o.teacher ?
      '<label class="row" style="gap:6px"><span>Highlight</span><select id="hl"><option value="">Nobody</option>' + O.characters.map(function (c) { return '<option value="' + c.id + '"' + (st.hl === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' :
      (T.me && (T.me.chars || []).length ? '<label class="row" style="gap:6px"><input type="checkbox" id="hl"' + (st.hl === 'mine' ? ' checked' : '') + ' style="width:22px;height:22px"><span>Highlight my lines</span></label>' : '');
    app.innerHTML = '<div class="card noprint scriptbar"><div class="row" style="flex-wrap:wrap;gap:10px">' +
      '<label class="row" style="gap:6px"><span>Go to</span><select id="go"><option value="">Scene…</option>' + scenes.map(function (x) { return '<option value="' + x.n + ':' + x.y + '">Scene ' + esc(x.s.num) + (x.s.place ? ' · ' + esc(x.s.place) : '') + '</option>'; }).join('') + '</select></label>' +
      hlPick + '<span class="grow"></span>' +
      '<button class="btn" id="add" aria-pressed="false">' + sym('📝') + 'Add a note</button>' +
      (o.teacher && T.Emotions ? '<button class="btn" id="addf" aria-pressed="false">' + sym('🙂') + 'Add a feeling</button>' : '') +
      (o.teacher ? '<button class="btn" id="addc" aria-pressed="false">' + sym('💡') + 'Add a cue</button><a class="btn" href="#/teacher/cues">Cue sheet</a>' : '') + '</div>' +
      '<div class="row small" style="gap:14px;margin-top:8px;flex-wrap:wrap">' +
      (o.teacher ? '<span class="muted">Your notes are director’s notes: everyone in the cast sees them.</span>' :
        '<label class="row" style="gap:6px"><input type="checkbox" id="smine"' + (st.mine ? ' checked' : '') + '><span class="snote-key"></span>My notes (only I see them)</label>' +
        '<label class="row" style="gap:6px"><input type="checkbox" id="sdir"' + (st.dir ? ' checked' : '') + '><span class="snote-key dir"></span>Director’s notes</label>') +
      '<label class="row" style="gap:6px"><input type="checkbox" id="scue"' + (st.cues ? ' checked' : '') + '><span class="cue-key"></span>Light, sound and music cues</label>' +
      (T.Emotions ? '<label class="row" style="gap:6px"><input type="checkbox" id="sfeel"' + (st.feel ? ' checked' : '') + '>' + sym('🙂') + 'Feeling pictures</label>' : '') +
      '</div><p id="addhelp" class="muted small" hidden>Tap the spot on a page where the note goes.</p></div>' +
      '<div id="pages" class="pages scriptpages">' + sc.pages.map(function (p) { return '<div class="pdfpage" data-n="' + p.n + '" style="aspect-ratio:' + p.w + '/' + p.h + '"></div>'; }).join('') + '</div>';
    var host = document.getElementById('pages'), $ = function (id) { return document.getElementById(id); };

    /* highlights and pins (redrawn on every change; the page drawings stay) */
    function overlay() {
      host.querySelectorAll('.hl, .snote, .cue, .feel').forEach(function (e) { e.remove(); });
      host.classList.toggle('withcues', !!st.cues);
      host.classList.toggle('withfeel', !!(st.feel && T.Emotions));
      var lastY = {};      // icons close together stack downward instead of covering each other (about 50 points apart)
      if (st.feel && T.Emotions) T.Emotions.all().sort(function (a, b) { return a.n - b.n || a.y - b.y; }).map(function (f) {
        var y = f.y; if (lastY[f.n] != null && y < lastY[f.n] + 50) y = lastY[f.n] + 50; lastY[f.n] = y; return Object.assign({}, f, { y: y });
      }).forEach(function (f) {      // feeling pictures just right of the page
        var pg = host.querySelector('.pdfpage[data-n="' + f.n + '"]'), sz = T.Pages.size(f.n), ic = T.Emotions.ICON[f.icon]; if (!pg || !ic) return;
        pg.insertAdjacentHTML('beforeend', '<button type="button" class="feel" data-feel="' + esc(f.id) + '" style="top:' + (f.y / sz.h * 100) + '%" aria-label="Feeling: ' + esc(ic.name) + '" title="' + esc(ic.name) + '"><img src="' + ic.file + '" alt=""></button>');
      });
      var who = chars(), pct = function (v, d) { return (v / d * 100) + '%'; };
      if (who.length) O.scenes.forEach(function (scene) {
        var src = T.scriptScene(scene); if (!src) return;
        src.items.forEach(function (it) {
          if (it.type === 'line' && T.isMine(it.who, scene, who)) T.Pages.wordBoxes(it).forEach(function (b) { put(b, 'hl line mine'); });
          if (it.type === 'song') { var mo = T.songMomentFor(scene, it.num); (it.lyrics || []).forEach(function (l) { if (l.who && T.isMine(l.who, scene, who, mo)) T.Pages.lyricBoxes(l).forEach(function (b) { put(b, 'hl song'); }); }); }
        });
      });
      function put(b, cls) { var pg = host.querySelector('.pdfpage[data-n="' + b.n + '"]'), sz = T.Pages.size(b.n); if (pg) pg.insertAdjacentHTML('beforeend', '<div class="' + cls + '" style="left:' + pct(b.x - 2, sz.w) + ';top:' + pct(b.y - 1, sz.h) + ';width:' + pct(b.w + 4, sz.w) + ';height:' + pct(b.h + 2, sz.h) + '"></div>'); }
      var pins = [];
      if (o.teacher || st.dir) dirNotes().forEach(function (n) { pins.push([n, true]); });
      if (!o.teacher && st.mine) myNotes().forEach(function (n) { pins.push([n, false]); });
      if (st.cues) { var cl = T.cues(), lab = T.cueLabel(cl); cl.forEach(function (c) {
        var pg = host.querySelector('.pdfpage[data-n="' + c.n + '"]'), sz = T.Pages.size(c.n); if (!pg) return;
        pg.insertAdjacentHTML('beforeend', '<button type="button" class="cue cue-' + (T.Cues.isChange(c) ? 'SC' : c.k) + (c.sug ? ' sug' : '') + '" data-cue="' + esc(c.id) + '" style="top:' + pct(c.y, sz.h) + '" aria-label="' + lab[c.id] + ': ' + esc(c.text) + '"><b>' + lab[c.id] + '</b><span> ' + esc(c.text) + '</span></button>');
      }); }
      requestAnimationFrame(unstack);
      pins.forEach(function (x) {
        var n = x[0], pg = host.querySelector('.pdfpage[data-n="' + n.n + '"]'), sz = T.Pages.size(n.n); if (!pg) return;
        pg.insertAdjacentHTML('beforeend', '<button type="button" class="snote' + (x[1] ? ' dir' : '') + '" data-note="' + esc(n.id) + '" data-dir="' + (x[1] ? 1 : 0) + '" style="left:' + pct(n.x, sz.w) + ';top:' + pct(n.y, sz.h) + '" aria-label="' + (x[1] ? 'Director’s note' : 'My note') + ': ' + esc(n.text) + '"><span>' + esc(n.text) + '</span></button>');
      });
    }

    /* cues at the same spot: stack them downward so each can be read and tapped */
    function unstack() {
      host.querySelectorAll('.pdfpage').forEach(function (pg) {
        var cs = [].slice.call(pg.querySelectorAll('.cue')); if (cs.length < 2) return;
        cs.forEach(function (c) { c.style.marginTop = ''; });
        cs.sort(function (a, b) { return a.offsetTop - b.offsetTop; });
        var bottom = -1e9;
        cs.forEach(function (c) { var top = c.offsetTop - c.offsetHeight / 2; if (top < bottom + 2) { c.style.marginTop = (bottom + 2 - top) + 'px'; top = bottom + 2; } bottom = top + c.offsetHeight; });
      });
    }
    var onResize = function () { unstack(); }; window.addEventListener('resize', onResize); T.cleanup.push(function () { window.removeEventListener('resize', onResize); });

    /* draw pages near the screen, drop far ones */
    var w = Math.min(host.clientWidth || 800, 900), drawing = {};
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        var el = e.target, n = +el.dataset.n, c = el.querySelector('canvas');
        if (e.isIntersecting && !c && !drawing[n]) {
          drawing[n] = 1;
          T.Pages.doc().then(function (doc) { return doc.getPage(n).then(function (pg) {
            var vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: w / vp1.width * Math.min(window.devicePixelRatio || 1, 2) });
            var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); cv.className = 'pdfcanvas';
            return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { if (document.body.contains(el) && !el.querySelector('canvas')) el.insertBefore(cv, el.firstChild); });
          }); }).catch(function (er) { el.innerHTML = '<p class="err" style="padding:20px">' + esc(er.message || 'This page would not load.') + '</p>'; }).finally(function () { delete drawing[n]; });
        } else if (!e.isIntersecting && c) { c.width = c.height = 0; c.remove(); }
      });
    }, { rootMargin: '1000px 0px' });
    host.querySelectorAll('.pdfpage').forEach(function (el) { io.observe(el); });
    T.cleanup.push(function () { io.disconnect(); });
    overlay();

    /* where I left off */
    var at = o.page || T.ls('scriptAt' + (o.teacher ? 'T' : ''));
    if (at) setTimeout(function () { goTo(at, 0); }, 60);      // after the router's scroll to the top
    var sv = function () {
      var top = [].find.call(host.querySelectorAll('.pdfpage'), function (el) { return el.getBoundingClientRect().bottom > 80; });
      if (top) T.ls('scriptAt' + (o.teacher ? 'T' : ''), +top.dataset.n);
    }, svT = null, onScroll = function () { clearTimeout(svT); svT = setTimeout(sv, 400); };
    window.addEventListener('scroll', onScroll, { passive: true }); T.cleanup.push(function () { window.removeEventListener('scroll', onScroll); });

    /* a spot on a page (pdf points from the top) to the top of the screen, just under the title bar */
    function goTo(n, y, smooth) {
      var el = host.querySelector('.pdfpage[data-n="' + n + '"]'); if (!el) return;
      var bar = document.getElementById('bar'), top = el.getBoundingClientRect().top + window.scrollY + (y || 0) / T.Pages.size(n).h * el.offsetHeight - (bar ? bar.offsetHeight : 0) - 6;
      window.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
    }
    $('go').onchange = function () { var v = this.value.split(':'); if (v[0]) goTo(+v[0], +v[1], true); this.value = ''; };
    if ($('hl')) $('hl').onchange = function () { st.hl = o.teacher ? this.value : (this.checked ? 'mine' : ''); keep(); overlay(); };
    if ($('smine')) $('smine').onchange = function () { st.mine = this.checked; keep(); overlay(); };
    if ($('sdir')) $('sdir').onchange = function () { st.dir = this.checked; keep(); overlay(); };
    if ($('scue')) $('scue').onchange = function () { st.cues = this.checked; keep(); overlay(); };
    if ($('sfeel')) $('sfeel').onchange = function () { st.feel = this.checked; keep(); overlay(); };
    var setAdding = function (v, msg) { adding = v; $('add').setAttribute('aria-pressed', v === 'note'); if ($('addf')) $('addf').setAttribute('aria-pressed', v === 'feel'); if ($('addc')) $('addc').setAttribute('aria-pressed', v === 'cue' || !!(v && v.move)); $('addhelp').hidden = !v; if (msg) $('addhelp').textContent = msg; host.classList.toggle('adding', !!v); };
    $('add').onclick = function () { setAdding(adding === 'note' ? false : 'note', 'Tap the spot on a page where the note goes.'); };
    if ($('addc')) $('addc').onclick = function () { setAdding(adding === 'cue' ? false : 'cue', 'Tap the line on a page where the cue goes (it goes in the left margin).'); };
    if ($('addf')) $('addf').onclick = function () { setAdding(adding === 'feel' ? false : 'feel', 'Tap the line on a page where the feeling goes (it goes just right of the page).'); if (!st.feel) { st.feel = true; keep(); if ($('sfeel')) $('sfeel').checked = true; overlay(); } };

    host.addEventListener('click', function (e) {
      var pin = e.target.closest('.snote'), cue = e.target.closest('.cue'), fe = e.target.closest('.feel');
      if (fe && !adding) { feelOpen(fe.dataset.feel); return; }
      if (pin && !adding) { open(pin.dataset.note, pin.dataset.dir === '1'); return; }
      if (cue && !adding) { cueOpen(cue.dataset.cue); return; }
      if (!adding) return;
      var pg = e.target.closest('.pdfpage'); if (!pg) return;
      var r = pg.getBoundingClientRect(), n = +pg.dataset.n, sz = T.Pages.size(n);
      var x = Math.round((e.clientX - r.left) / r.width * sz.w), y = Math.round((e.clientY - r.top) / r.height * sz.h), mode = adding;
      setAdding(false);
      if (mode === 'note') edit({ id: newId(), n: n, x: x, y: y, text: '' }, o.teacher, true);
      else if (mode === 'cue') cueEdit({ id: newId(), k: 'LX', n: n, y: y, text: '' }, true);
      else if (mode === 'feel') feelPick(null, function (icon) { T.Emotions.add(n, y, icon); T.saveShow('Feeling added').then(overlay); });
      else if (mode.move) { var c = T.cues().find(function (q) { return q.id === mode.move; }); if (c) { c.n = n; c.y = y; T.show.cues.list.sort(T.Cues.order); T.saveShow('Cue moved').then(overlay); } }
    });

    /* feeling pictures: everyone sees the name; the teacher changes or removes one */
    function feelPick(current, done) {
      var d = ask('<h2>' + sym('🙂') + 'Pick a feeling</h2>' + T.Emotions.picker(current) + '<div class="row end" style="margin-top:10px"><button class="btn quiet" id="fx">Cancel</button></div>');
      d.querySelector('#fx').onclick = function () { d.close(); };
      d.querySelectorAll('[data-icon]').forEach(function (b) { b.onclick = function () { d.close(); done(b.dataset.icon); }; });
    }
    function feelOpen(id) {
      var f = T.Emotions.all().find(function (x) { return x.id === id; }); if (!f) return;
      var ic = T.Emotions.ICON[f.icon];
      var d = ask('<div style="text-align:center"><img src="' + ic.file + '" alt="" style="height:160px"><h2 style="margin:8px 0">' + esc(ic.name) + '</h2>' +
        (f.auto && f.note ? '<p class="muted small">The script says “' + esc(f.note) + '” here.</p>' : '') +
        (o.teacher ? '' : '<p class="small"><a href="#/react">Practice feelings in React to That!</a></p>') + '</div>' +
        '<div class="row end" style="flex-wrap:wrap">' + (o.teacher ? '<button class="btn quiet" id="fd">Remove</button><button class="btn" id="fc">Change</button>' : '') + '<button class="btn primary" id="fk">Close</button></div>');
      d.querySelector('#fk').onclick = function () { d.close(); };
      if (!o.teacher) return;
      d.querySelector('#fd').onclick = function () { d.close(); T.Emotions.remove(f); T.saveShow('Feeling removed').then(overlay); };
      d.querySelector('#fc').onclick = function () { d.close(); feelPick(f.icon, function (icon) { T.Emotions.change(f, icon); T.saveShow('Feeling changed').then(overlay); }); };
    }

    /* cues: anyone can read them; the teacher accepts, edits, moves and deletes */
    function cueOpen(id) {
      var c = T.cues().find(function (q) { return q.id === id; }); if (!c) return;
      var lab = T.cueLabel(T.cues())[c.id], player = null;
      var d = ask('<h2>' + sym(c.k === 'LX' ? '💡' : c.k === 'SX' ? '🔔' : '🎵') + lab + (c.sug ? ' <span class="tag">suggested</span>' : '') + '</h2><p>' + esc(c.text) + '</p>' +
        '<div class="row end" style="flex-wrap:wrap">' + (c.k === 'MX' ? '<button class="btn" id="cp">▶ Play the music</button>' : '') +
        (o.teacher ? '<button class="btn quiet" id="cd">Delete</button><button class="btn" id="cm">Move</button><button class="btn" id="ce">Edit</button>' + (c.sug ? '<button class="btn" id="ca">Accept</button>' : '') : '') +
        '<button class="btn primary" id="cc">Close</button></div>');
      d.addEventListener('close', function () { if (player) player.pause(); });
      d.querySelector('#cc').onclick = function () { d.close(); };
      if (d.querySelector('#cp')) d.querySelector('#cp').onclick = function () { if (player) { player.pause(); player = null; return; } player = T.Cues.play(c.mx); };
      if (!o.teacher) return;
      d.querySelector('#cd').onclick = function () { d.close(); T.show.cues.list = T.cues().filter(function (q) { return q.id !== c.id; }); T.saveShow(lab + ' deleted').then(overlay); };
      d.querySelector('#cm').onclick = function () { d.close(); setAdding({ move: c.id }, 'Tap the new spot for ' + lab + '.'); };
      d.querySelector('#ce').onclick = function () { d.close(); cueEdit(c, false); };
      if (d.querySelector('#ca')) d.querySelector('#ca').onclick = function () { d.close(); delete c.sug; T.saveShow(lab + ' accepted').then(overlay); };
    }
    function cueEdit(c, isNew) {
      var d = ask('<h2>' + sym('💡') + (isNew ? 'New cue' : 'Edit cue') + '</h2>' +
        '<div class="seg" id="ck">' + Object.keys(T.Cues.KINDS).map(function (k) { return '<button type="button" data-v="' + k + '" aria-pressed="' + (c.k === k) + '">' + k + ' · ' + T.Cues.KINDS[k] + '</button>'; }).join('') + '</div>' +
        '<p id="cmx"' + (c.k === 'MX' ? '' : ' hidden') + '><label>Music number from the script <input id="cn" type="number" min="1" style="width:90px" value="' + (c.mx != null ? c.mx : '') + '"></label></p>' +
        '<p class="muted small">LX and SX numbers follow the order on the pages (LX from 5, SX from 1).</p>' +
        '<textarea id="ct" rows="3" maxlength="300" style="width:100%" placeholder="What happens: Blue out, Lights up, School bell…">' + esc(c.text) + '</textarea>' +
        '<div class="row end" style="margin-top:10px"><button class="btn quiet" id="cx">Cancel</button><button class="btn primary" id="cs">Save</button></div>');
      var k = c.k;
      d.querySelectorAll('#ck [data-v]').forEach(function (b) { b.onclick = function () { k = b.dataset.v; d.querySelectorAll('#ck [data-v]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); d.querySelector('#cmx').hidden = k !== 'MX'; }; });
      d.querySelector('#cx').onclick = function () { d.close(); };
      d.querySelector('#cs').onclick = function () {
        var t = d.querySelector('#ct').value.trim(), mx = parseInt(d.querySelector('#cn').value, 10);
        if (!t) { T.toast('Say what happens.'); return; }
        if (k === 'MX' && !(mx > 0)) { T.toast('Give the music number from the script.'); return; }
        c.k = k; c.text = t; delete c.sug; if (k === 'MX') c.mx = mx; else delete c.mx;
        T.show.cues = T.show.cues || { list: [] };
        if (isNew) T.show.cues.list.push(c);
        T.show.cues.list.sort(T.Cues.order); d.close();
        T.saveShow('Cue saved').then(overlay);
      };
    }

    function find(id, dir) { return dir ? (T.show.scriptNotes || []).find(function (n) { return n.id === id; }) : (T.Progress.notes()[id]); }
    function store(note, dir) {
      if (dir) {
        var list = T.show.scriptNotes = T.show.scriptNotes || [], i = list.findIndex(function (n) { return n.id === note.id; });
        note.at = Date.now(); if (i < 0) list.push(note); else list[i] = note;
        T.show.scriptNotes = list.filter(function (n) { return !n.del; });
        return T.saveShow(note.del ? 'Note deleted' : 'Note saved for the whole cast').then(overlay);
      }
      T.Progress.saveNote(note); T.toast(note.del ? 'Note deleted' : 'Note saved'); overlay(); return Promise.resolve();
    }
    function open(id, dir) {
      var n = find(id, dir); if (!n) return;
      var mine = dir ? o.teacher : !o.teacher;
      var d = ask('<h2>' + sym(dir ? '🎬' : '📝') + (dir ? 'Director’s note' : 'My note') + '</h2><p style="white-space:pre-wrap">' + esc(n.text) + '</p>' +
        '<p class="muted small">Page ' + esc(T.Pages.printed(n.n)) + '</p>' +
        '<div class="row end">' + (mine ? '<button class="btn quiet" id="nd">Delete</button><button class="btn" id="ne">Edit</button>' : '') + '<button class="btn primary" id="nc">Close</button></div>');
      d.querySelector('#nc').onclick = function () { d.close(); };
      if (mine) {
        d.querySelector('#ne').onclick = function () { d.close(); edit(Object.assign({}, n), dir, false); };
        d.querySelector('#nd').onclick = function () { d.close(); store(Object.assign({}, n, { del: 1 }), dir); };
      }
    }
    function edit(note, dir, isNew) {
      var d = ask('<h2>' + sym(dir ? '🎬' : '📝') + (isNew ? 'New note' : 'Edit note') + '</h2>' +
        '<p class="muted small">' + (dir ? 'Everyone in the cast sees this note.' : 'Only you see this note.') + '</p>' +
        '<textarea id="nt" rows="4" maxlength="600" style="width:100%" placeholder="' + (dir ? 'Blocking, a reminder, a cut…' : 'A reminder, how to say it, where to stand…') + '">' + esc(note.text) + '</textarea>' +
        '<div class="row end" style="margin-top:10px"><button class="btn quiet" id="nx">Cancel</button><button class="btn primary" id="ns">Save</button></div>', function (dd) { dd.querySelector('#nt').focus(); });
      d.querySelector('#nx').onclick = function () { d.close(); };
      d.querySelector('#ns').onclick = function () {
        var t = d.querySelector('#nt').value.trim(); if (!t) { d.close(); return; }
        note.text = t; d.close(); store(note, dir);
      };
    }
  }

  T.studentPages = T.studentPages || {};
  T.studentPages.script = function () { view({ teacher: false, back: '#/home' }); };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.read = function (args) { view({ teacher: true, back: '#/teacher', page: args && +args[0] || null }); };
})();
