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
    if (!T.Pages || !T.Pages.ready()) { app.innerHTML = '<div class="card"><p>The script pages are not ready yet. ' + (o.teacher ? 'Import the script PDF on the Script page first.' : 'Your teacher saves them when importing the script.') + '</p></div>'; return; }
    var sc = T.show.script, O = T.O(), adding = false;
    var st = Object.assign({ hl: o.teacher ? '' : 'mine', mine: true, dir: true }, T.ls('scriptView' + (o.teacher ? 'T' : '')) || {});
    var keep = function () { T.ls('scriptView' + (o.teacher ? 'T' : ''), st); };
    var chars = function () { return o.teacher ? (st.hl ? [st.hl] : []) : (st.hl === 'mine' && T.me ? T.me.chars || [] : []); };
    var dirNotes = function () { return (T.show.scriptNotes || []).filter(function (n) { return !n.del; }); };
    var myNotes = function () { if (o.teacher || !T.Progress) return []; var m = T.Progress.notes(); return Object.keys(m).map(function (k) { return m[k]; }).filter(function (n) { return !n.del; }); };

    var scenes = O.scenes.map(function (s) { var src = T.scriptScene(s), p = src && T.Pages.scenePages(src); return p && p.length ? { s: s, n: p[0] } : null; }).filter(Boolean);
    var hlPick = o.teacher ?
      '<label class="row" style="gap:6px"><span>Highlight</span><select id="hl"><option value="">Nobody</option>' + O.characters.map(function (c) { return '<option value="' + c.id + '"' + (st.hl === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' :
      (T.me && (T.me.chars || []).length ? '<label class="row" style="gap:6px"><input type="checkbox" id="hl"' + (st.hl === 'mine' ? ' checked' : '') + ' style="width:22px;height:22px"><span>Highlight my lines</span></label>' : '');
    app.innerHTML = '<div class="card noprint scriptbar"><div class="row" style="flex-wrap:wrap;gap:10px">' +
      '<label class="row" style="gap:6px"><span>Go to</span><select id="go"><option value="">Scene…</option>' + scenes.map(function (x) { return '<option value="' + x.n + '">Scene ' + esc(x.s.num) + (x.s.place ? ' · ' + esc(x.s.place) : '') + '</option>'; }).join('') + '</select></label>' +
      hlPick + '<span class="grow"></span>' +
      '<button class="btn" id="add" aria-pressed="false">' + sym('📝') + 'Add a note</button></div>' +
      '<div class="row small" style="gap:14px;margin-top:8px;flex-wrap:wrap">' +
      (o.teacher ? '<span class="muted">Your notes are director’s notes: everyone in the cast sees them.</span>' :
        '<label class="row" style="gap:6px"><input type="checkbox" id="smine"' + (st.mine ? ' checked' : '') + '><span class="snote-key"></span>My notes (only I see them)</label>' +
        '<label class="row" style="gap:6px"><input type="checkbox" id="sdir"' + (st.dir ? ' checked' : '') + '><span class="snote-key dir"></span>Director’s notes</label>') +
      '</div><p id="addhelp" class="muted small" hidden>Tap the spot on a page where the note goes.</p></div>' +
      '<div id="pages" class="pages scriptpages">' + sc.pages.map(function (p) { return '<div class="pdfpage" data-n="' + p.n + '" style="aspect-ratio:' + p.w + '/' + p.h + '"></div>'; }).join('') + '</div>';
    var host = document.getElementById('pages'), $ = function (id) { return document.getElementById(id); };

    /* highlights and pins (redrawn on every change; the page drawings stay) */
    function overlay() {
      host.querySelectorAll('.hl, .snote').forEach(function (e) { e.remove(); });
      var who = chars(), pct = function (v, d) { return (v / d * 100) + '%'; };
      if (who.length) O.scenes.forEach(function (scene) {
        var src = T.scriptScene(scene); if (!src) return;
        src.items.forEach(function (it) {
          if (it.type === 'line' && T.isMine(it.who, scene, who)) T.Pages.wordBoxes(it).forEach(function (b) { put(b, 'hl line mine'); });
          if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.box && l.who && T.isMine(l.who, scene, who)) put(l.box, 'hl song'); });
        });
      });
      function put(b, cls) { var pg = host.querySelector('.pdfpage[data-n="' + b.n + '"]'), sz = T.Pages.size(b.n); if (pg) pg.insertAdjacentHTML('beforeend', '<div class="' + cls + '" style="left:' + pct(b.x - 2, sz.w) + ';top:' + pct(b.y - 1, sz.h) + ';width:' + pct(b.w + 4, sz.w) + ';height:' + pct(b.h + 2, sz.h) + '"></div>'); }
      var pins = [];
      if (o.teacher || st.dir) dirNotes().forEach(function (n) { pins.push([n, true]); });
      if (!o.teacher && st.mine) myNotes().forEach(function (n) { pins.push([n, false]); });
      pins.forEach(function (x) {
        var n = x[0], pg = host.querySelector('.pdfpage[data-n="' + n.n + '"]'), sz = T.Pages.size(n.n); if (!pg) return;
        pg.insertAdjacentHTML('beforeend', '<button type="button" class="snote' + (x[1] ? ' dir' : '') + '" data-note="' + esc(n.id) + '" data-dir="' + (x[1] ? 1 : 0) + '" style="left:' + pct(n.x, sz.w) + ';top:' + pct(n.y, sz.h) + '" aria-label="' + (x[1] ? 'Director’s note' : 'My note') + ': ' + esc(n.text) + '"><span>' + esc(n.text) + '</span></button>');
      });
    }

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
    var at = T.ls('scriptAt' + (o.teacher ? 'T' : ''));
    if (at) { var el0 = host.querySelector('.pdfpage[data-n="' + at + '"]'); if (el0) el0.scrollIntoView(); }
    var sv = function () {
      var top = [].find.call(host.querySelectorAll('.pdfpage'), function (el) { return el.getBoundingClientRect().bottom > 80; });
      if (top) T.ls('scriptAt' + (o.teacher ? 'T' : ''), +top.dataset.n);
    }, svT = null, onScroll = function () { clearTimeout(svT); svT = setTimeout(sv, 400); };
    window.addEventListener('scroll', onScroll, { passive: true }); T.cleanup.push(function () { window.removeEventListener('scroll', onScroll); });

    $('go').onchange = function () { var el = host.querySelector('.pdfpage[data-n="' + this.value + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); this.value = ''; };
    if ($('hl')) $('hl').onchange = function () { st.hl = o.teacher ? this.value : (this.checked ? 'mine' : ''); keep(); overlay(); };
    if ($('smine')) $('smine').onchange = function () { st.mine = this.checked; keep(); overlay(); };
    if ($('sdir')) $('sdir').onchange = function () { st.dir = this.checked; keep(); overlay(); };
    $('add').onclick = function () { adding = !adding; this.setAttribute('aria-pressed', adding); $('addhelp').hidden = !adding; host.classList.toggle('adding', adding); };

    host.addEventListener('click', function (e) {
      var pin = e.target.closest('.snote');
      if (pin) { open(pin.dataset.note, pin.dataset.dir === '1'); return; }
      if (!adding) return;
      var pg = e.target.closest('.pdfpage'); if (!pg) return;
      var r = pg.getBoundingClientRect(), n = +pg.dataset.n, sz = T.Pages.size(n);
      var note = { id: newId(), n: n, x: Math.round((e.clientX - r.left) / r.width * sz.w), y: Math.round((e.clientY - r.top) / r.height * sz.h), text: '' };
      adding = false; $('add').setAttribute('aria-pressed', 'false'); $('addhelp').hidden = true; host.classList.remove('adding');
      edit(note, o.teacher, true);
    });

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
        '<p class="muted small">Page ' + esc((sc.pages.find(function (p) { return p.n === n.n; }) || {}).printed || n.n) + '</p>' +
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
  T.teacherPages.read = function () { view({ teacher: true, back: '#/teacher' }); };
})();
