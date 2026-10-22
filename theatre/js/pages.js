/* asl.cool/theatre: the real script pages (Colleen: "make it look like the pdf and highlight on that instead of completely changing the format").
   The teacher's PDF is kept sealed (Store.getPdf); pdf.js draws the pages on the device; the script reader saved where every line and lyric sits
   (item.boxes, lyric.box: pdf page n, x, y from the top, w, h, in PDF points).
   - In Practice Lines: the pages of a scene, others' lines light yellow, mine green, the current line strongest; hidden or hint lines get a cover.
   - My script (print): colored highlights for my lines and the lyrics I sing, and a colored band down the edge of pages in my scenes and songs,
     for a student or for any track (so the teacher can print one for every track on day one). Printed in color, or saved as a PDF from the print window. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var docP = null, docVer = null;
  T.Pages = {
    ready: function () { var s = T.show && T.show.script; return !!(s && s.pdfVer && s.pages && s.scenes.some(function (x) { return x.items.some(function (it) { return it.boxes; }); })); },
    doc: function () {
      var v = T.show.script.pdfVer;
      if (docP && docVer === v) return docP;
      docVer = v;
      docP = Promise.all([T.loadPdfJs(), Store.getPdf(T.key, v)]).then(function (r) { if (!r[1]) throw new Error('The script pages are not saved yet.'); return r[0].getDocument({ data: new Uint8Array(r[1]) }).promise; });
      docP.catch(function () { docP = null; });
      return docP;
    },
    size: function (n) { return (T.show.script.pages || []).find(function (p) { return p.n === n; }) || { w: 612, h: 792 }; }
  };
  /* the pdf pages a scene covers (from its first box to its last, so its sheet music is included) */
  function scenePages(src) {
    var lo = 1e9, hi = 0;
    src.items.forEach(function (it) { (it.boxes || []).forEach(function (b) { lo = Math.min(lo, b.n); hi = Math.max(hi, b.n); }); (it.lyrics || []).forEach(function (l) { if (l.box) { lo = Math.min(lo, l.box.n); hi = Math.max(hi, l.box.n); } }); });
    var out = []; for (var n = lo; n <= hi && hi; n++) out.push(n); return out;
  }
  T.Pages.scenePages = scenePages;
  /* the page number printed on a pdf page (from the script reader's items), or the pdf page number */
  var printedMap = null, printedFor = null;
  T.Pages.printed = function (n) {
    var sc = T.show.script; if (!sc) return n;
    if (printedFor !== sc) { printedFor = sc; printedMap = {}; sc.scenes.forEach(function (x) { x.items.forEach(function (it) { (it.boxes || []).forEach(function (b) { if (it.page != null && printedMap[b.n] == null) printedMap[b.n] = it.page; }); }); }); }
    return printedMap[n] != null ? printedMap[n] : n;
  };
  /* a line's boxes without the character's name (Colleen: highlight the line, not the name). The name is the first box when it sits on its own row;
     for scripts imported before 'named' was kept: a short, centered first box of two or more. */
  T.Pages.wordBoxes = function (it) {
    var b = it.boxes || []; if (it.type !== 'line' || b.length < 2 && !it.named) return b;
    if (it.named) return b.slice(1);
    var sz = T.Pages.size(b[0].n), mid = b[0].x + b[0].w / 2;
    return b[0].w < sz.w * 0.35 && Math.abs(mid - sz.w / 2) < sz.w * 0.12 ? b.slice(1) : b;
  };
  /* one page drawn into a canvas at a width in CSS pixels */
  function draw(doc, n, width, scale) {
    return doc.getPage(n).then(function (pg) {
      var vp1 = pg.getViewport({ scale: 1 }), s = width / vp1.width * (scale || window.devicePixelRatio || 1), vp = pg.getViewport({ scale: s });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { return { canvas: c, k: s, w: vp1.width, h: vp1.height }; });
    });
  }

  /* ---------- Practice Lines: a scene as real pages, with highlight boxes over them ---------- */
  T.Pages.renderScene = function (host, src, items, o) {
    var pages = scenePages(src);
    host.innerHTML = '<p class="muted center" id="pgload">Loading the script pages…</p>' + pages.map(function (n) { var sz = T.Pages.size(n); return '<div class="pdfpage" data-n="' + n + '" style="aspect-ratio:' + sz.w + '/' + sz.h + '"></div>'; }).join('');
    var pct = function (b, sz) { return 'left:' + (b.x / sz.w * 100) + '%;top:' + (b.y / sz.h * 100) + '%;width:' + (b.w / sz.w * 100) + '%;height:' + (b.h / sz.h * 100) + '%'; };
    // highlight boxes first, so they work while the pages load
    items.forEach(function (x) {
      var it = x.it; if (it.type !== 'line' && it.type !== 'song' && !(it.type === 'dir' && o.dirs)) return;
      var cls = 'hl item ' + (it.type === 'line' ? 'line' + (x.mine ? ' mine' : '') : it.type), cover = it.type === 'line' && o.cover ? o.cover(x) : '';
      var boxes = it.type === 'song' ? (it.boxes || []).slice(0, 1) : T.Pages.wordBoxes(it), first = true;      // the name is left plain
      boxes.forEach(function (b) {
        var pg = host.querySelector('.pdfpage[data-n="' + b.n + '"]'); if (!pg) return;
        var cv = !!cover, txt = cv && first ? cover : ''; first = false;
        pg.insertAdjacentHTML('beforeend', '<div class="' + cls + (cv ? ' cover' : '') + '" data-i="' + x.i + '" style="' + pct(b, T.Pages.size(b.n)) + '">' + (txt ? '<span>' + txt + '</span>' : '') + '</div>');
      });
    });
    return T.Pages.doc().then(function (doc) {
      var w = Math.min(host.clientWidth || 800, 900), l = document.getElementById('pgload'); if (l) l.remove();
      return pages.reduce(function (p, n) {
        return p.then(function () {
          var el = host.querySelector('.pdfpage[data-n="' + n + '"]'); if (!el || !document.body.contains(el)) return;
          return draw(doc, n, w).then(function (r) { r.canvas.className = 'pdfcanvas'; el.insertBefore(r.canvas, el.firstChild); });
        });
      }, Promise.resolve());
    }).catch(function (e) { var l = document.getElementById('pgload'); if (l) l.textContent = e.message || 'The pages would not load.'; });
  };

  /* ---------- follow along: a song's real pages, the lyric line being sung, and a bouncing ball over each syllable ----------
     (Colleen: the music notation following along with the tracks, a bouncing ball, looking like the real script) */
  function songItem(songId) {
    var so = T.songById(songId), sc = so && T.sceneById(so.scene), src = sc && T.scriptScene(sc);
    return src && src.items.find(function (it) { return it.type === 'song' && it.num === so.num; });
  }
  function songPages(it) {
    var lo = 1e9, hi = 0;
    (it.boxes || []).concat(it.lyrics.map(function (l) { return l.box; }).filter(Boolean)).forEach(function (b) { lo = Math.min(lo, b.n); hi = Math.max(hi, b.n); });
    var out = []; for (var n = lo; n <= hi && hi; n++) out.push(n); return out;
  }
  function paint(host, pages) {      // draw pages into placeholders that are there and still empty
    return T.Pages.doc().then(function (doc) {
      var w = Math.min(host.clientWidth || 800, 900);
      return pages.reduce(function (p, n) {
        return p.then(function () {
          var el = host.querySelector('.pdfpage[data-n="' + n + '"]'); if (!el || el.querySelector('canvas') || !document.body.contains(el)) return;
          return draw(doc, n, w).then(function (r) { r.canvas.className = 'pdfcanvas'; el.insertBefore(r.canvas, el.firstChild); });
        });
      }, Promise.resolve());
    });
  }
  T.Follow = {
    ready: function (songId) { var lt = T.show.lyricTimes && T.show.lyricTimes[songId]; return !!(T.Pages.ready() && lt && songItem(songId)); },
    /* show the song's pages in host (or reuse the pages already there, in a scene's page view) */
    mount: function (host, songId) {
      var it = songItem(songId); if (!it) return Promise.resolve();
      var pages = songPages(it), missing = pages.filter(function (n) { return !host.querySelector('.pdfpage[data-n="' + n + '"]'); });
      if (missing.length === pages.length) host.innerHTML = pages.map(function (n) { var sz = T.Pages.size(n); return '<div class="pdfpage" data-n="' + n + '" style="aspect-ratio:' + sz.w + '/' + sz.h + '"></div>'; }).join('');
      host.dataset.follow = songId; host._at = null;
      return paint(host, pages).catch(function () {});
    },
    /* move the highlight and the ball to time t (seconds, on the band track's clock) */
    update: function (host, songId, t) {
      var lt = T.show.lyricTimes && T.show.lyricTimes[songId], it = songItem(songId); if (!lt || !it) return;
      var i = -1; lt.lines.forEach(function (x, k) { if (x && x.t <= t) i = k; });
      var x = lt.lines[i], line = it.lyrics[i];
      if (!x || !line || !line.box || t > x.e + 1.5) { host.querySelectorAll('.follow-line, .ball').forEach(function (e) { e.remove(); }); host._at = null; return; }
      var j = 0; x.s.forEach(function (v, k) { if (v <= t) j = k; });
      var key = i + ':' + j; if (host._at === key) return;
      var page = host.querySelector('.pdfpage[data-n="' + line.box.n + '"]'); if (!page) return;
      var sz = T.Pages.size(line.box.n), b = line.box, pc = function (v, d) { return (v / d * 100) + '%'; };
      var hl = page.querySelector('.follow-line'); if (!hl) { host.querySelectorAll('.follow-line').forEach(function (e) { e.remove(); }); hl = document.createElement('div'); hl.className = 'follow-line'; page.appendChild(hl); }
      hl.style.cssText = 'left:' + pc(b.x - 4, sz.w) + ';top:' + pc(b.y - 2, sz.h) + ';width:' + pc(b.w + 8, sz.w) + ';height:' + pc(b.h + 4, sz.h);
      var syl = (line.syl || [])[Math.min(j, (line.syl || []).length - 1)];
      var ball = page.querySelector('.ball'); if (!ball) { host.querySelectorAll('.ball').forEach(function (e) { e.remove(); }); ball = document.createElement('div'); ball.className = 'ball'; page.appendChild(ball); }
      if (syl) { ball.style.left = pc(syl.x + syl.w / 2, sz.w); ball.style.top = pc(b.y - 11, sz.h); ball.classList.remove('hop'); void ball.offsetWidth; ball.classList.add('hop'); }
      if (!host._at || host._at.split(':')[0] !== String(i)) hl.scrollIntoView({ block: 'center', behavior: T.prefs.motion ? 'smooth' : 'auto' });
      host._at = key;
    }
  };

  /* ---------- My script (print) ---------- */
  var COLORS = { green: '#5fd068', yellow: '#ffe14d', pink: '#ff8fc7', blue: '#7cc4ff', orange: '#ffb35c', purple: '#c7a0ff' };
  function printPage(who) {      // who: { name, chars, back }
    var pr = Object.assign({ lines: 'green', lyrics: 'blue', band: 'purple', which: 'mine' }, T.ls('printPrefs') || {});
    T.setBar('My script', who.back);
    if (!T.Pages.ready()) { app.innerHTML = '<div class="card"><p>The script pages are not ready yet. Your teacher saves them when importing the script.</p></div>'; return; }
    var sw = function (k, label) { return '<div class="switch" style="flex-wrap:wrap"><span>' + label + '</span><div class="row">' + Object.keys(COLORS).map(function (c) { return '<button type="button" class="swatch" data-pk="' + k + '" data-c="' + c + '" aria-pressed="' + (pr[k] === c) + '" aria-label="' + c + '" title="' + c + '" style="--sw:' + COLORS[c] + '"></button>'; }).join('') + '</div></div>'; };
    app.innerHTML = '<div class="card noprint"><h2>' + sym('🖍️') + 'Highlighted script: ' + esc(who.name) + '</h2>' + (who.chars.length ? '<p>' + who.chars.map(T.chip).join('') + '</p>' : '') +
      '<div class="switch"><span>Pages</span><div class="seg" data-pk="which"><button type="button" data-v="mine" aria-pressed="' + (pr.which === 'mine') + '">Only the scenes I am in</button><button type="button" data-v="all" aria-pressed="' + (pr.which === 'all') + '">The whole script</button></div></div>' +
      sw('lines', 'My lines') + sw('lyrics', 'Lyrics I sing') + sw('band', 'Edge band on my scenes and songs') +
      '<div class="row end" style="margin-top:10px"><button class="btn primary" id="mk">' + icon('print') + 'Make it</button></div><p class="muted small">Then print in color, or choose “Save as PDF” in the print window. For your cast only.</p></div><div id="out"></div>';
    app.querySelectorAll('[data-pk] [data-v], .swatch[data-pk]').forEach(function (b) { b.onclick = function () { var k = b.dataset.pk || b.parentNode.dataset.pk; pr[k] = b.dataset.c || b.dataset.v; T.ls('printPrefs', pr); printPage(who); }; });
    document.getElementById('mk').onclick = function () { make(who, pr); };
  }
  function make(who, pr) {
    var out = document.getElementById('out'), btn = document.getElementById('mk'); btn.disabled = true;
    var sc = T.show.script, chars = who.chars, mineLines = [], mineLyr = [], bandPages = {};
    T.O().scenes.forEach(function (scene) {
      var src = T.scriptScene(scene); if (!src) return;
      var inScene = chars.length && T.O().moments.some(function (m) { return m.scene === scene.id && T.onStage(m, chars); });
      src.items.forEach(function (it) {
        if (it.type === 'line' && chars.length && T.isMine(it.who, scene, chars)) T.Pages.wordBoxes(it).forEach(function (b) { mineLines.push(b); });
        if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.box && l.who && chars.length && T.isMine(l.who, scene, chars)) mineLyr.push(l.box); });
      });
      if (inScene) scenePages(src).forEach(function (n) { bandPages[n] = 'Scene ' + scene.num; });
    });
    var pages = pr.which === 'all' || !chars.length ? (sc.pages || []).map(function (p) { return p.n; }) : Object.keys(bandPages).map(Number).sort(function (a, b) { return a - b; });
    out.innerHTML = '<p class="muted noprint" id="mkp">Making ' + pages.length + ' pages…</p>';
    T.Pages.doc().then(function (doc) {
      var i = 0;
      return pages.reduce(function (p, n) {
        return p.then(function () {
          return draw(doc, n, 816, 1.6).then(function (r) {      // about 130 dpi on letter paper
            var ctx = r.canvas.getContext('2d'), k = r.k;
            ctx.globalCompositeOperation = 'multiply';
            var fill = function (list, color) { ctx.fillStyle = color; list.forEach(function (b) { if (b.n === n) ctx.fillRect(b.x * k - 2, b.y * k - 1, b.w * k + 4, b.h * k + 2); }); };
            fill(mineLines, COLORS[pr.lines]); fill(mineLyr, COLORS[pr.lyrics]);
            ctx.globalCompositeOperation = 'source-over';
            if (bandPages[n]) { ctx.fillStyle = COLORS[pr.band]; ctx.fillRect(r.canvas.width - 22 * k / 1.6, 0, 22 * k / 1.6, r.canvas.height); }
            var img = new Image(); img.className = 'printpage'; img.alt = 'Page'; img.src = r.canvas.toDataURL('image/jpeg', 0.85);
            out.appendChild(img); r.canvas.width = r.canvas.height = 0;
            var m = document.getElementById('mkp'); if (m) m.textContent = 'Making pages… ' + (++i) + ' of ' + pages.length;
          });
        });
      }, Promise.resolve()).then(function () {
        var m = document.getElementById('mkp'); if (m) m.outerHTML = '<div class="row noprint" style="margin:10px 0"><button class="btn primary" onclick="print()">' + icon('print') + 'Print</button><span class="muted small">' + pages.length + ' pages</span></div>';
        btn.disabled = false;
      });
    }).catch(function (e) { out.innerHTML = '<p class="err">' + esc(e.message || 'The pages would not load.') + '</p>'; btn.disabled = false; });
  }
  T.studentPages = T.studentPages || {};
  T.studentPages.print = function () { printPage({ name: T.me.name, chars: T.me.chars, back: '#/home' }); };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.print = function (args) {      // #/teacher/print/<character or student id>
    var c = T.charById(args[0]), a = (T.show.cast || []).find(function (x) { return x.id === args[0]; });
    if (c) return printPage({ name: c.name + ' track', chars: [c.id], back: '#/teacher/production' });
    if (a) return printPage({ name: a.name, chars: a.chars || [], back: '#/teacher/cast' });
    T.go('#/teacher/production');
  };
})();
