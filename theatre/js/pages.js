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
    src.items.forEach(function (it) { (it.boxes || []).forEach(function (b) { lo = Math.min(lo, b.n); hi = Math.max(hi, b.n); }); (it.lyrics || []).forEach(function (l) { T.Pages.lyricBoxes(l).forEach(function (b) { lo = Math.min(lo, b.n); hi = Math.max(hi, b.n); }); }); });
    var out = []; for (var n = lo; n <= hi && hi; n++) out.push(n); return out;
  }
  T.Pages.scenePages = scenePages;
  /* a line's rows as the script reader stored them (split, join and the piano go by these: each syllable's b is an index into them) */
  T.Pages.rawBoxes = function (l) { return l.boxes || (l.box ? [l.box] : []); };
  /* a line's rows as they light up (Colleen: "keep it only on words"): each row trimmed to the words in it, a row with no words left off,
     and the teacher's own ends from the Sections page (l.cut[k] = { x0, x1 } in PDF points, or 0 = this piece hidden). Spoken lines
     (no syllables) keep their rows. The same objects come back until the line changes. */
  var trimmed = new WeakMap();
  T.Pages.lyricBoxes = function (l) {
    var raw = T.Pages.rawBoxes(l), syl = l.syl || [], key = JSON.stringify(l.cut || null), c = trimmed.get(l);
    if (c && c.raw === raw && c.syl === syl && c.key === key && c.n === syl.length) return c.out;
    var out = [];
    raw.forEach(function (b, k) {
      var cut = l.cut && l.cut[k];
      if (cut === 0) return;
      var x0 = b.x, x1 = b.x + b.w;
      if (syl.length) {
        var mine = syl.filter(function (y) { return (y.b || 0) === k && y.x != null; });
        if (!mine.length && !cut) return;
        if (mine.length) { x0 = Math.min.apply(null, mine.map(function (y) { return y.x; })) - 1; x1 = Math.max.apply(null, mine.map(function (y) { return y.x + y.w; })) + 1; }
      }
      if (cut) { x0 = cut.x0; x1 = cut.x1; }
      out.push({ n: b.n, x: x0, y: b.y, w: Math.max(4, x1 - x0), h: b.h, k: k });
    });
    trimmed.set(l, { raw: raw, syl: syl, key: key, n: syl.length, out: out });
    return out;
  };
  /* one shape per line (Colleen 2026-10-23: "lines should be encased by one polygon that outlines the whole line… shaped to the space the
     line occupies on the page"): a line's printed rows on a page, joined into one outline like a text selection. Each row's band is kept to
     its own printed row, so neighboring lines never overlap. Returns the shapes (SVG over each page), in order. */
  var shapeN = 0, edges = new WeakMap();
  /* where each row of a section may reach on the left and right: halfway to the next section on the same printed row (Colleen: the end of one
     line's highlight ran over the first word of the next, making a dark overlap), so neighbors meet and never overlap */
  T.Pages.setNeighbors = function (lyrics) {
    var all = []; lyrics.forEach(function (l) { T.Pages.lyricBoxes(l).forEach(function (b) { all.push(b); }); });
    all.forEach(function (b) {
      var x0 = b.x - 3, x1 = b.x + b.w + 3, t = b.y + 0.5, bt = b.y + b.h - 0.5;
      all.forEach(function (o) {
        if (o === b || o.n !== b.n) return;
        if (Math.abs(o.y - b.y) > 2) {      // rows stacked tightly (spoken lines): meet halfway between them too
          if (o.x < b.x + b.w && b.x < o.x + o.w) {
            if (o.y < b.y && o.y + o.h > b.y) t = Math.max(t, (o.y + o.h + b.y) / 2 + 0.3);
            if (o.y > b.y && b.y + b.h > o.y) bt = Math.min(bt, (b.y + b.h + o.y) / 2 - 0.3);
          }
          return;
        }
        if (o.x + o.w / 2 < b.x + b.w / 2) x0 = Math.max(x0, (o.x + o.w + b.x) / 2 + 0.4);      // a neighbor to the left
        else x1 = Math.min(x1, (b.x + b.w + o.x) / 2 - 0.4);                                     // a neighbor to the right
      });
      edges.set(b, { x0: x0, x1: Math.max(x1, x0 + 2), t: t, b: bt });
    });
  };
  T.Pages.shapes = function (host, boxes, o) {
    o = o || {};
    var out = [], byPage = {};
    boxes.forEach(function (b) { (byPage[b.n] = byPage[b.n] || []).push(b); });
    Object.keys(byPage).forEach(function (n) {
      var page = host.querySelector('.pdfpage[data-n="' + n + '"]'); if (!page) return;
      var sz = T.Pages.size(+n), rows = byPage[n].slice().sort(function (a, b) { return a.y - b.y; });
      // rows that follow each other make one shape; a row far below (the next system) starts another
      var runs = [], cur = [];
      rows.forEach(function (r) { var p = cur[cur.length - 1]; if (p && r.y - (p.y + p.h) > p.h * 0.9) { runs.push(cur); cur = []; } cur.push(r); });
      if (cur.length) runs.push(cur);
      runs.forEach(function (run) {
        var band = run.map(function (r) { var e = edges.get(r) || { x0: r.x - 3, x1: r.x + r.w + 3, t: r.y + 0.5, b: r.y + r.h - 0.5 }; return { x0: e.x0, x1: e.x1, t: e.t, b: e.b }; });
        for (var i = 1; i < band.length; i++) { var m = (band[i - 1].b + band[i].t) / 2; band[i - 1].b = m; band[i].t = m; }      // rows meet, no seam
        var pts = [[band[0].x0, band[0].t], [band[0].x1, band[0].t]];
        band.forEach(function (r, i) { var nx = band[i + 1]; pts.push([r.x1, r.b]); if (nx) pts.push([nx.x1, r.b]); });
        var last = band[band.length - 1]; pts.push([last.x0, last.b]);
        for (var j = band.length - 1; j > 0; j--) { pts.push([band[j].x0, band[j].t]); pts.push([band[j - 1].x0, band[j].t]); }
        var id = 'sg' + (++shapeN), cs = o.colors || ['#ffe94d'];
        var fill = cs.length > 1 ? 'url(#' + id + ')' : cs[0];
        var grad = cs.length > 1 ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + cs.map(function (c, k) { return '<stop offset="' + (k / cs.length) + '" stop-color="' + c + '"/><stop offset="' + ((k + 1) / cs.length) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient></defs>' : '';
        var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + sz.w + ' ' + sz.h); svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('class', 'line-shape ' + (o.cls || '')); if (o.data) Object.keys(o.data).forEach(function (k) { svg.dataset[k] = o.data[k]; });
        svg.innerHTML = grad + '<path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z" fill="' + fill + '" stroke="' + cs[0] + '"/>' + (o.title ? '<title>' + T.esc(o.title) + '</title>' : '');
        page.appendChild(svg); out.push({ el: svg, page: page, top: band[0].t, left: band[0].x0, sz: sz });
      });
    });
    return out;
  };
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
  function draw(doc, n, width, scale, print) {      // print: draw without waiting for the screen (keeps going in a hidden tab)
    return doc.getPage(n).then(function (pg) {
      var vp1 = pg.getViewport({ scale: 1 }), s = width / vp1.width * (scale || window.devicePixelRatio || 1), vp = pg.getViewport({ scale: s });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      return pg.render({ canvasContext: c.getContext('2d'), viewport: vp, intent: print ? 'print' : 'display' }).promise.then(function () { return { canvas: c, k: s, w: vp1.width, h: vp1.height }; });
    });
  }

  T.Pages.draw = draw;

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

  /* ---------- follow along: a song's real pages with the lyric line being sung lit up in the singer's color ----------
     (Colleen: the music notation following along with the tracks, looking like the real script; 2026-10-23: no bouncing ball, "i like the
     highlighted phrases… match the highlight/icon color for each character"; the highlight comes a little before the line is sung, LEAD seconds,
     so the singer sees it in time; and the page stops scrolling by itself for a few seconds after the reader scrolls) */
  var LEAD = 0.4;      // Colleen 2026-10-23: ¾ second was too long
  T.LYRIC_LEAD = LEAD;
  var userScrolled = 0;
  ['wheel', 'touchmove'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = Date.now(); }, { passive: true }); });
  window.addEventListener('keydown', function (e) { if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(e.key)) userScrolled = Date.now(); });
  /* the singer's color for a lyric label: one character's color, several as stripes top to bottom (Colleen: the top half of the letters one
     color, the bottom the other), highlighter yellow for a chorus or group */
  function lyricColors(who) {
    var ids = who ? T.labelChars(String(who).toUpperCase()) : [];
    var cs = ids.filter(function (id) { var c = T.charById(id); return id !== '*' && c && c.group !== 'ensemble'; }).map(T.color)
      .filter(function (c, i, all) { return all.indexOf(c) === i; });      // one performer in two of the roles: one color
    return cs.length ? cs : ['#ffe94d'];      // a chorus or group: a highlighter yellow
  }
  T.lyricColors = lyricColors;
  /* when a line's singing is done: its end, but not long after its last syllable starts (a line timed by tapping ends where the next one starts) */
  function lineEnd(x) {      // h: where the singing really stops (found on Save, from the guide vocals); else a guess
    var last = x.s && x.s.length ? x.s[x.s.length - 1] : x.t;
    return x.h != null ? x.h : Math.min(x.e, last + 2.5);
  }
  T.lineEnd = lineEnd;
  function songItem(songId) {
    var so = T.songById(songId), sc = so && T.sceneById(so.scene), src = sc && T.scriptScene(sc);
    return src && src.items.find(function (it) { return it.type === 'song' && it.num === so.num; });
  }
  function songPages(it) {
    var lo = 1e9, hi = 0;
    var lyr = [].concat.apply([], it.lyrics.map(T.Pages.lyricBoxes));      // the song's own music (its cue can sit on the page before)
    (lyr.length ? lyr : it.boxes || []).forEach(function (b) { lo = Math.min(lo, b.n); hi = Math.max(hi, b.n); });
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
  /* the music scrolls along (Colleen 2026-10-23: "it doesn't do a good job scrolling down on the sheet music"): the line being sung (the one
     that started last) is kept about a third of the way down the screen, and in music with no words the next line comes into view before it
     starts. It moves only when the line drifts out of the comfortable band, smoothly, and waits 4 seconds after the reader scrolls. */
  function keepInView(host, it, lt, on, t, mine) {
    var now = Date.now(); if (now - (host._scrollAt || 0) < 700 || now - userScrolled < 4000) return;
    var k = on.length ? on.reduce(function (a, b) { return lt.lines[b].t > lt.lines[a].t ? b : a; }) : -1;
    if (k < 0) {      // nothing lit: the next line to be sung, if it is coming up soon
      var best = Infinity;
      lt.lines.forEach(function (x, j) { if (x && it.lyrics[j] && x.t > t && x.t - t < 6 && x.t < best && (!mine || mine(it.lyrics[j]))) { best = x.t; k = j; } });
      if (k < 0) return;
    }
    var b = T.Pages.lyricBoxes(it.lyrics[k])[0]; if (!b) return;
    var page = host.querySelector('.pdfpage[data-n="' + b.n + '"]'); if (!page) return;
    var r = page.getBoundingClientRect(), sz = T.Pages.size(b.n), y = r.top + b.y / sz.h * r.height;
    var dock = document.querySelector('.songdock, .lt-dock'), visH = window.innerHeight - (dock ? dock.getBoundingClientRect().height : 0);
    if (y > visH * 0.12 && y < visH * 0.55) return;
    host._scrollAt = now;
    window.scrollBy({ top: y - visH * 0.3, behavior: T.prefs.motion ? 'smooth' : 'auto' });
  }
  T.Follow = {
    ready: function (songId) { var lt = T.show.lyricTimes && T.show.lyricTimes[songId]; return !!(T.Pages.ready() && lt && songItem(songId)); },      // the ball (needs the lyrics timing)
    canShow: function (songId) { return !!(T.Pages && T.Pages.ready() && songItem(songId)); },      // the song's pages (need only the script PDF)
    /* show the song's pages in host (or reuse the pages already there, in a scene's page view) */
    mount: function (host, songId) {
      var it = songItem(songId); if (!it) return Promise.resolve();
      var pages = songPages(it), missing = pages.filter(function (n) { return !host.querySelector('.pdfpage[data-n="' + n + '"]'); });
      if (missing.length === pages.length) host.innerHTML = pages.map(function (n) { var sz = T.Pages.size(n); return '<div class="pdfpage" data-n="' + n + '" style="aspect-ratio:' + sz.w + '/' + sz.h + '"></div>'; }).join('');
      host.dataset.follow = songId; host._at = null;
      return paint(host, pages).catch(function () {});
    },
    /* light up the lyric line for time t (seconds, on the band track's clock), LEAD seconds before it is sung */
    update: function (host, songId, t) {
      var lt = T.show.lyricTimes && T.show.lyricTimes[songId], it = songItem(songId); if (!lt || !it) return;
      // every line being sung is lit: from LEAD before its first word until its singing is done (Colleen: a line stays lit until it is sung,
      // even when the next one lights up; off during music with no words)
      // "Only my lines" (Colleen 2026-10-23): the student's own lines only; ALL counts when they are on stage for the song, a group only for its members
      var mine = null;
      if (host.dataset.mine === '1' && T.me && T.me.chars && T.me.chars.length) {
        var so = T.songById(songId), sc = so && T.sceneById(so.scene), mo = sc && T.songMomentFor(sc, it.num);
        mine = function (l) { return !!(l.who && sc && T.isMine(l.who, sc, T.me.chars, mo)); };
      }
      var on = [];
      lt.lines.forEach(function (x, k) { if (x && it.lyrics[k] && x.t - LEAD <= t && t <= lineEnd(x) && (!mine || mine(it.lyrics[k]))) on.push(k); });
      keepInView(host, it, lt, on, t, mine);
      var key = on.join(','); if (host._at === key) return;
      host.querySelectorAll('.follow-line').forEach(function (e) { e.remove(); });
      if (!on.length) { host._at = null; return; }
      var pc = function (v, d) { return (v / d * 100) + '%'; }, newest = null, before = (host._at || '').split(',');
      if (host._nb !== it) { T.Pages.setNeighbors(it.lyrics); host._nb = it; }
      on.forEach(function (k) {
        var line = it.lyrics[k], cs = lyricColors(line.who), fill = cs.length > 1 ? 'linear-gradient(180deg,' + cs.map(function (c, q) { return c + ' ' + (q * 100 / cs.length) + '% ' + ((q + 1) * 100 / cs.length) + '%'; }).join(',') + ')' : cs[0];
        T.Pages.shapes(host, T.Pages.lyricBoxes(line), { cls: 'follow-line' + (line.spoken ? ' spoken' : ''), colors: cs }).forEach(function (sh, si) {      // one outline per line, on every staff it runs onto
          if (si === 0 && before.indexOf(String(k)) < 0) newest = sh.el;
        });
      });
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
        if (it.type === 'song') { var mo = T.songMomentFor(scene, it.num); (it.lyrics || []).forEach(function (l) { if (l.who && chars.length && T.isMine(l.who, scene, chars, mo)) T.Pages.lyricBoxes(l).forEach(function (b) { mineLyr.push(b); }); }); }
      });
      if (inScene) scenePages(src).forEach(function (n) { bandPages[n] = 'Scene ' + scene.num; });
    });
    var pages = pr.which === 'all' || !chars.length ? (sc.pages || []).map(function (p) { return p.n; }) : Object.keys(bandPages).map(Number).sort(function (a, b) { return a - b; });
    out.innerHTML = '<p class="muted noprint" id="mkp">Making ' + pages.length + ' pages…</p>';
    T.Pages.doc().then(function (doc) {
      var i = 0;
      return pages.reduce(function (p, n) {
        return p.then(function () {
          return draw(doc, n, 816, 1.6, true).then(function (r) {      // about 130 dpi on letter paper
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
