/* asl.cool/theatre: open captions for QLab (Colleen 2026-10-24: open captions "with things commonly available in a high school": a long thin
   strip at the bottom of the auditorium's movie screen, lowered a few feet, just above the stage, so Deaf audience members see the words and
   the show together; and a performer view on the back wall or a black sheet from the catwalk, white text on black. She runs sound in QLab:
   "structure the captions for the songs as videos that work seamlessly with still text cued by an operator … lines without consistent timing
   … cued live"; the performer view "even earlier … to let them see what's coming up").
   Songs: one video per song for each view, starting at 0:00 of the band track, timed from Lyrics timing (T.show.lyricTimes, band track
   clock). In QLab, put the video cue in a group with the song's audio cue and fire them together.
   Dialogue: one picture per caption card (PNG), numbered in cue order, for the caption operator to GO on each line.
   Both views are 1920×1080, black except the words. Everything is made on this computer from the script imported here; nothing is uploaded. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var W = 1920, H = 1080, FPS = 30;
  var MUXER = 'https:' + '//cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js', JSZIP = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  var DEF = { pos: 'bottom', size: 56, dist: 50, picW: 16, style: 'full', cueN: 4, color: '#ffffff', lead: 2, nudge: 0, names: true };
  var opt = function () { var o = T.show.captions || {}, out = {}; Object.keys(DEF).forEach(function (k) { out[k] = o[k] != null ? o[k] : DEF[k]; }); return out; };
  function load(src, name) { return window[name] ? Promise.resolve(window[name]) : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = function () { ok(window[name]); }; s.onerror = function () { no(new Error('A helper could not load. Check the Wi-Fi.')); }; document.head.appendChild(s); }); }

  /* lyrics are printed in capitals: captions read better in sentence case, with I and the characters' names capitalized */
  var names = null;
  function nice(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (/[a-z]/.test(s) || !/[A-Z]/.test(s)) return s;
    if (!names) { names = {}; T.O().characters.forEach(function (c) { [c.short, c.name].concat(c.aliases || []).join(' ').split(/\s+/).forEach(function (w) { if (/^[A-Za-z]{3,}$/.test(w)) names[w.toLowerCase()] = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }); }); }
    s = s.toLowerCase().replace(/\b(i)(?=\b|['’])/g, 'I').replace(/[a-z]+/g, function (w) { return names[w] || w; });
    return s.replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  var whoName = function (who) { var ids = T.labelChars(who || '').filter(function (c) { return c !== '*'; }); if (ids.length === 1 && T.charById(ids[0])) return T.charById(ids[0]).short.toUpperCase(); return String(who || '').toUpperCase(); };
  var whoColor = function (who) { var ids = T.labelChars(who || ''), c = ids.length === 1 && T.charById(ids[0]); return c && c.color ? T.lightShade ? T.lightShade(c.color) : lighten(c.color) : '#ffd84d'; };
  function lighten(hex) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.round(v + (255 - v) * 0.45); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }      // character colors, lighter so they read on black

  /* ---------- drawing ---------- */
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var cx = cv.getContext('2d');
  var font = function (px, bold) { return (bold ? '700 ' : '600 ') + px + 'px "Atkinson Hyperlegible", Arial, sans-serif'; };
  /* break words into rows that fit; the first row starts after the speaker's name */
  function rows(text, px, maxW, lead) {
    cx.font = font(px); var out = [], cur = '', first = true;
    String(text).split(' ').forEach(function (w) {
      var tryS = cur ? cur + ' ' + w : w, room = maxW - (first ? lead : 0);
      if (cx.measureText(tryS).width > room && cur) { out.push(cur); cur = w; first = false; } else cur = tryS;
    });
    if (cur) out.push(cur);
    return out;
  }
  /* a card: { who, text, sung } ready to draw (the text already split to fit) */
  function nameW(card, px) { if (!card.name) return 0; cx.font = font(px, true); return cx.measureText(card.name + '  ').width; }
  function drawRows(card, rs, px, y, color, dim) {
    var lh = px * 1.28, nw = nameW(card, px);
    rs.forEach(function (r, i) {
      cx.font = font(px); var tw = cx.measureText(r).width + (i === 0 ? nw : 0), x = (W - tw) / 2;
      if (i === 0 && card.name) { cx.font = font(px, true); cx.fillStyle = dim ? '#8a8a8a' : card.color; cx.fillText(card.name, x, y + i * lh); x += nw; cx.font = font(px); }
      cx.fillStyle = dim ? '#8a8a8a' : color; cx.fillText(r, x, y + i * lh);
    });
  }
  function drawAudience(card, o) {
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    if (!card) return;
    var px = o.size, lh = px * 1.28, stripH = lh * 2 + px * 0.5, top = o.pos === 'top' ? px * 0.5 : o.pos === 'middle' ? (H - stripH) / 2 : H - stripH - px * 0.4;
    var rs = card.rows; cx.textBaseline = 'top';
    drawRows(card, rs, px, top + px * 0.25 + (rs.length === 1 ? lh / 2 : 0), o.color);
  }
  /* performer prompts, per character (Colleen 2026-10-24: "build both … I might even choose to mix and match the styles per performer. some
     might do better with bigger text but once they get started they can keep going and some will need to read the whole thing and will have
     to deal with slightly smaller text"): 'full' = the whole line; 'cue' = only its first few words, much bigger. T.show.captions.prompt[char]. */
  function styleOf(who, o) { var ids = T.labelChars(who || '').filter(function (c) { return c !== '*'; }), p = (T.show.captions || {}).prompt || {}; return ids.length === 1 && p[ids[0]] ? p[ids[0]] : o.style; }
  function forPrompt(card, o) {
    if (!card || card.song || styleOf(card.who, o) !== 'cue') return { card: card, big: 1 };
    var w = card.text.replace(/^♪\s*|\s*♪$/g, '').split(' '), short = w.slice(0, o.cueN).join(' ') + (w.length > o.cueN ? ' …' : '');
    return { card: { who: card.who, name: card.name, color: card.color, text: (card.sung ? '♪ ' : '') + short }, big: 1.55 };
  }
  function drawPerformer(card0, next0, o) {
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.textBaseline = 'top';
    var f1 = forPrompt(card0, o), f2 = forPrompt(next0, o), card = f1.card, next = f2.card;
    var px = Math.round(o.size * 1.15 * f1.big);
    if (card) { var r1 = rows(card.text, px, W - 160, nameW(card, px)); drawRows(card, r1.slice(0, f1.big > 1 ? 2 : 4), px, 90, o.color); }
    if (next) {
      var px2 = Math.round(o.size * 1.15 * 0.8 * f2.big), r2 = rows(next.text, px2, W - 200, nameW(next, px2));
      cx.font = font(Math.round(px2 * 0.6), true); cx.fillStyle = '#6f6f6f'; cx.fillText(next.song ? 'NEXT · ♪ ' + next.song : 'NEXT', (W - cx.measureText(next.song ? 'NEXT · ♪ ' + next.song : 'NEXT').width) / 2, H * 0.56);
      drawRows(next, r2.slice(0, 3), px2, H * 0.56 + px2 * 0.9, o.color, true);
    }
  }

  /* ---------- the show as caption cues ---------- */
  function cardsFor(who, text, sung, o, prevWho) {
    var t = nice(text); if (!t) return [];
    if (sung) t = '♪ ' + t + ' ♪';
    var name = o.names && who && (!sung || who !== prevWho) ? whoName(who) + ':' : '', base = { who: who, name: name, color: whoColor(who), sung: sung };
    var rs = rows(t, o.size, W - 160, name ? nameW(base, o.size) : 0), out = [];
    for (var i = 0; i < rs.length; i += 2) out.push({ who: who, name: i ? '' : name, color: base.color, sung: sung, text: rs.slice(i, i + 2).join(' '), rows: rs.slice(i, i + 2), share: rs.slice(i, i + 2).join(' ').length });
    return out;
  }
  function build() {
    var o = opt(), cues = [], n = 0;
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      var songHash = {};
      src.items.forEach(function (it) { if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.spoken && l.who) songHash[T.Voices ? T.Voices.id(l) : l.text] = 1; }); });
      src.items.forEach(function (it) {
        if (it.type === 'line') {
          if (T.Voices && songHash[T.Voices.id(it)]) return;      // the same line read inside the song: it is in the song's video
          var words = LineCheck.spoken(it.text); if (!words.replace(/[^A-Za-z0-9]/g, '')) return;
          cardsFor(it.who, words, false, o).forEach(function (c) { cues.push({ n: ++n, type: 'still', scene: sc, card: c }); });
        }
        if (it.type === 'song') {
          var so = T.O().songs.find(function (x) { return x.scene === sc.id && String(x.num) === String(it.num); });
          var lt = so && T.show.lyricTimes && T.show.lyricTimes[so.id];
          if (lt && lt.lines && lt.lines.length) cues.push({ n: ++n, type: 'song', scene: sc, song: so, it: it, lt: lt });
          else {      // no Lyrics timing yet: the song's lines as stills, cued by hand
            var prev = null;
            (it.lyrics || []).forEach(function (l) { cardsFor(l.who, l.text, !l.spoken, o, prev).forEach(function (c) { cues.push({ n: ++n, type: 'still', scene: sc, card: c, untimed: so && so.title }); }); prev = l.who; });
          }
        }
      });
    });
    return cues;
  }
  /* a song's caption timeline: [{ a, b, card }] in band-track seconds; the performer's starts `lead` seconds earlier and runs to the next */
  function songTimeline(cue, o, performer) {
    var L = cue.it.lyrics || [], tl = cue.lt.lines, segs = [], prev = null;
    L.forEach(function (l, k) {
      var x = tl[k]; if (!x || x.t == null) return;
      var cards = cardsFor(l.who, l.text, !l.spoken, o, prev); prev = l.who;
      var nxt = null; for (var j = k + 1; j < tl.length; j++) if (tl[j] && tl[j].t != null) { nxt = tl[j].t; break; }
      var a = x.t, end = T.lineEnd(x), b = Math.min(nxt != null ? nxt : end + 2, end + 1.2);
      if (nxt != null && b > nxt) b = nxt;
      var tot = cards.reduce(function (s, c) { return s + c.share; }, 0) || 1, at = a;
      cards.forEach(function (c) { var d = (b - a) * c.share / tot; segs.push({ a: at, b: at + d, card: c, nextStart: nxt }); at += d; });
    });
    var nud = +o.nudge || 0;
    segs.forEach(function (s) { s.a += nud; s.b += nud; });
    if (!performer) return segs;
    var lead = +o.lead || 0;
    return segs.map(function (s, i) {      // show it early, keep it up until the next one appears (unless a long break)
      var n2 = segs[i + 1], a = Math.max(0, s.a - lead), b = n2 ? Math.max(a + 0.3, n2.a - lead) : s.b;
      if (n2 && n2.a - s.b > 4) b = s.b;
      return { a: a, b: b, card: s.card, next: n2 && n2.card };
    });
  }
  var at = function (segs, t) { for (var i = 0; i < segs.length; i++) if (segs[i].a <= t && t < segs[i].b) return segs[i]; return null; };

  /* ---------- video (H.264 MP4, plays in QLab) ---------- */
  function codec() {
    if (!window.VideoEncoder) return Promise.reject(new Error('This browser cannot make videos. Use Chrome (or Edge) on a recent computer.'));
    var tries = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'];
    return tries.reduce(function (p, c) { return p.then(function (got) { return got || VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 2e6, framerate: FPS }).then(function (r) { return r.supported ? c : null; }, function () { return null; }); }); }, Promise.resolve(null))
      .then(function (c) { if (!c) throw new Error('This computer cannot make H.264 video in the browser. Try Chrome on a Mac.'); return c; });
  }
  function makeVideo(cue, o, performer, prog) {
    var segs = songTimeline(cue, o, performer), last = segs.reduce(function (m, s) { return Math.max(m, s.b); }, 0), dur = last + 3, frames = Math.ceil(dur * FPS);
    return Promise.all([load(MUXER, 'Mp4Muxer'), codec()]).then(function (r) {
      var M = r[0], muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' }), err = null;
      var enc = new VideoEncoder({ output: function (ch, meta) { muxer.addVideoChunk(ch, meta); }, error: function (e) { err = e; } });
      enc.configure({ codec: r[1], width: W, height: H, bitrate: 2e6, framerate: FPS, latencyMode: 'quality' });
      var i = 0, shown = undefined;
      function more() {
        if (err) return Promise.reject(err);
        var stop = Math.min(frames, i + 60);
        for (; i < stop; i++) {
          var t = i / FPS, s = at(segs, t), key = s ? s.card.text + '|' + (s.next ? s.next.text : '') : '';
          if (key !== shown) { if (performer) drawPerformer(s && s.card, s && s.next, o); else drawAudience(s && s.card, o); shown = key; }
          var f = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
          enc.encode(f, { keyFrame: i % (FPS * 2) === 0 }); f.close();
        }
        if (prog) prog(i / frames);
        if (i >= frames) return enc.flush().then(function () { muxer.finalize(); return new Blob([muxer.target.buffer], { type: 'video/mp4' }); });
        return new Promise(function (ok) { (function wait() { if (enc.encodeQueueSize > 20) setTimeout(wait, 5); else ok(); })(); }).then(more);
      }
      return more();
    });
  }
  var png = function () { return new Promise(function (ok) { cv.toBlob(ok, 'image/png'); }); };
  var pad = function (n, k) { return ('0000' + n).slice(-(k || 3)); };
  var safe = function (s) { return String(s || '').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); };
  var fileOf = function (c, view) { return c.type === 'song' ? 'Cue ' + pad(c.n) + ' - Song ' + c.song.num + ' ' + safe(c.song.title) + ' - ' + view + '.mp4' : 'Cue ' + pad(c.n) + ' - S' + pad(c.scene.num, 2) + ' ' + safe(whoName(c.card.who)) + ' - ' + view + '.png'; };

  /* where the files go: a folder she picks (Chrome), else one zip file */
  function sink(title) {
    if (window.showDirectoryPicker) return window.showDirectoryPicker({ mode: 'readwrite' }).then(function (root) {
      var dirs = {};
      var dir = function (p) { return dirs[p] || (dirs[p] = p.split('/').reduce(function (d, part) { return d.then(function (h) { return h.getDirectoryHandle(part, { create: true }); }); }, Promise.resolve(root))); };
      return { put: function (path, blob) { var parts = path.split('/'), name = parts.pop(); return dir(parts.join('/')).then(function (d) { return d.getFileHandle(name, { create: true }); }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(blob).then(function () { return w.close(); }); }); }, done: function () { return Promise.resolve('Saved in the folder you picked.'); } };
    });
    return load(JSZIP, 'JSZip').then(function (Z) {
      var zip = new Z();
      return { put: function (path, blob) { zip.file(path, blob); return Promise.resolve(); }, done: function () { return zip.generateAsync({ type: 'blob' }).then(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = title + '.zip'; document.body.appendChild(a); a.click(); a.remove(); return 'Downloaded ' + title + '.zip.'; }); } };
    });
  }
  function cueSheet(cues) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rowsOut = [['Cue', 'Scene', 'Type', 'Who', 'Caption', 'Audience file', 'Performer file', 'How it runs']];
    cues.forEach(function (c) {
      if (c.type === 'song') rowsOut.push([c.n, c.scene.num, 'Song video', '', '♪ #' + c.song.num + ' ' + c.song.title, 'Song videos/' + fileOf(c, 'audience'), 'Song videos/' + fileOf(c, 'performer'), 'Group with the song’s audio cue; fire together (starts at 0:00 of the band track)']);
      else rowsOut.push([c.n, c.scene.num, 'Still', c.card.who, (c.card.name ? c.card.name + ' ' : '') + c.card.text, 'Audience stills/' + fileOf(c, 'audience'), 'Performer stills/' + fileOf(c, 'performer'), c.untimed ? 'Operator GO (song “' + c.untimed + '” has no Lyrics timing yet)' : 'Operator GO when the line starts']);
    });
    return new Blob(['﻿' + rowsOut.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv' });
  }

  /* ---------- the page ---------- */
  var preview = { i: 0, song: '' }, stopPlay = null;
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.captions = function () {
    T.setBar('Open captions', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › Script).</p>'; return; }
    var o = opt(), cues = build(), songs = cues.filter(function (c) { return c.type === 'song'; }), stills = cues.filter(function (c) { return c.type === 'still'; });
    var untimed = T.O().songs.filter(function (so) { return !(T.show.lyricTimes && T.show.lyricTimes[so.id]); });
    var sel = function (id, v, list) { return '<select id="' + id + '">' + list.map(function (x) { return '<option value="' + x[0] + '"' + (String(v) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; };
    app.innerHTML = '<div class="card"><h2>' + sym('💬') + 'Open captions</h2><p class="muted">Captions for QLab: a video for each song (timed from Lyrics timing) and a picture for each spoken line (your caption operator GOes on each one). Two versions of everything: the <b>audience strip</b> for the screen above the stage, and the <b>performer view</b> for the back wall, which shows each line early with the next one below it.</p>' +
      '<p><b>' + cues.length + ' cues</b>: ' + songs.length + ' song videos and ' + stills.length + ' stills.' + (untimed.length ? ' <span class="err">' + untimed.length + ' songs have no Lyrics timing yet, so their lines are stills you cue by hand' + '</span> (' + untimed.slice(0, 4).map(function (s) { return '#' + s.num; }).join(', ') + (untimed.length > 4 ? '…' : '') + ').' : '') + '</p></div>' +
      '<div class="card"><h3>How they look</h3><div class="row" style="flex-wrap:wrap">' +
      '<label class="f">Audience strip' + sel('cpos', o.pos, [['bottom', 'At the bottom of the picture'], ['top', 'At the top'], ['middle', 'In the middle']]) + '</label>' +
      '<label class="f">Letter size <span class="muted small">(1080p pixels)</span><input id="csize" type="number" min="24" max="140" step="2" value="' + o.size + '" style="width:90px"></label>' +
      '<label class="f">Color' + sel('ccol', o.color, [['#ffffff', 'White'], ['#fff3a8', 'Pale yellow']]) + '</label>' +
      '<label class="f">Performer view, early by' + sel('clead', o.lead, [[1, '1 second'], [2, '2 seconds'], [3, '3 seconds'], [4, '4 seconds']]) + '</label>' +
      '<label class="f">Song timing nudge' + sel('cnud', o.nudge, [[-0.5, '½ s earlier'], [-0.25, '¼ s earlier'], [0, 'As timed'], [0.25, '¼ s later'], [0.5, '½ s later']]) + '</label>' +
      '<label class="f">Speaker names' + sel('cnam', o.names ? 1 : 0, [[1, 'Shown'], [0, 'Not shown']]) + '</label></div>' +
      '<div class="row" style="flex-wrap:wrap;align-items:flex-end"><label class="f" style="margin:0">Back row, feet from the screen<input id="cdist" type="number" min="10" max="200" value="' + o.dist + '" style="width:90px"></label><label class="f" style="margin:0">Width of the projected picture, feet<input id="cpw" type="number" min="3" max="80" step="0.5" value="' + o.picW + '" style="width:90px"></label><span class="small grow" id="crec"></span><button class="btn small" id="cuse">Use this size</button></div>' +
      '<p class="muted small">Size guide: capital letters about 1 inch tall for every 15–20 feet to the back row. Measure the picture’s width with the projector on. Everything is black except the words, so mask the projector lens to the strip with black tape to stop the gray glow.</p>' +
      '<h3 style="margin-top:14px">Performer prompts</h3><p class="muted small">Pick a style for each character. <b>Whole line</b>: the full line in medium letters. <b>First words</b>: only the first ' + o.cueN + ' words, in much bigger letters, to get them started. The line coming up next uses its speaker’s style too.</p>' +
      '<div class="row" style="flex-wrap:wrap"><label class="f">Everyone else' + sel('cstyle', o.style, [['full', 'Whole line'], ['cue', 'First words']]) + '</label><label class="f">First words: how many' + sel('ccuen', o.cueN, [[3, '3 words'], [4, '4 words'], [5, '5 words'], [6, '6 words']]) + '</label></div>' +
      '<details><summary>Each character (' + Object.keys((T.show.captions || {}).prompt || {}).length + ' set)</summary><div class="cap-who">' + T.O().characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { var v = ((T.show.captions || {}).prompt || {})[c.id] || ''; return '<label class="f" style="margin:0">' + T.chip(c.id) + '<select data-pst="' + c.id + '"><option value="">Same as everyone</option><option value="full"' + (v === 'full' ? ' selected' : '') + '>Whole line</option><option value="cue"' + (v === 'cue' ? ' selected' : '') + '>First words</option></select></label>'; }).join('') + '</div></details>' +
      '<div class="cap-prev"><figure><figcaption>Audience strip</figcaption><canvas id="pa" width="' + W + '" height="' + H + '"></canvas></figure><figure><figcaption>Performer view</figcaption><canvas id="pp" width="' + W + '" height="' + H + '"></canvas></figure></div>' +
      '<div class="row"><button class="btn" id="pv">◀</button><span id="pn" class="grow center small"></span><button class="btn" id="nx">▶ Next cue</button></div>' +
      (songs.length ? '<div class="row"><label class="f grow" style="margin:0">Try a song with its band track' + sel('psong', preview.song || songs[0].song.id, songs.map(function (c) { return [c.song.id, '#' + c.song.num + ' ' + esc(c.song.title)]; })) + '</label><button class="btn primary" id="pplay">▶ Play with captions</button></div>' : '') + '</div>' +
      '<div class="card"><h3>Make the files</h3><p class="muted small">Chrome asks for a folder (make a new one, like “HSM captions”); other browsers download one zip file. Song videos take a little while each.</p>' +
      '<div class="row" style="flex-wrap:wrap"><button class="btn primary" id="xall">Make everything</button><button class="btn" id="xsong">Just the song videos</button><button class="btn" id="xone">Just the song above (to test in QLab)</button><button class="btn" id="xst">Just the stills</button><button class="btn quiet" id="xcsv">Just the cue sheet</button></div><p id="xmsg" class="small"></p><div class="pb" id="xbar" hidden style="height:12px;border-radius:6px;background:var(--line);overflow:hidden"><i style="display:block;height:100%;width:0;background:var(--accent)"></i></div></div>' +
      '<div class="card"><h3>In QLab</h3><ol class="small" style="line-height:1.6">' +
      '<li>Make two video surfaces: <b>Audience</b> (the projector on the movie screen) and <b>Performer</b> (the back-wall projector).</li>' +
      '<li>For each song: a Group cue set to “start all children simultaneously”, holding the song’s audio cue, its audience video (Audience surface) and its performer video (Performer surface).</li>' +
      '<li>For each spoken line: a Group cue holding its audience picture and performer picture, each set to hold, with the cue before it faded out. Your operator presses GO as the line starts.</li>' +
      '<li>The cue sheet (CSV) lists every cue in order with its files. Open it in Sheets or Excel while you build.</li>' +
      '<li>Check your QLab license: using two video outputs at once may need a QLab video license (they can be rented for just the show days).</li></ol></div>';
    var $ = function (id) { return document.getElementById(id); };
    var set = function (k, v) { var c = T.show.captions = T.show.captions || {}; c[k] = v; T.saveShow('Saved').then(T.teacherPages.captions); };
    $('cpos').onchange = function () { set('pos', this.value); };
    $('csize').onchange = function () { set('size', Math.max(24, Math.min(140, +this.value || 56))); };
    /* the letter size for the room: capitals (about 0.7 of the font size) 1 inch per 17.5 feet; the picture's width sets inches per pixel */
    var rec = function () { var d = +$('cdist').value || 50, w = +$('cpw').value || 16, inch = d / 17.5, px = Math.round(inch / (0.7 * w * 12 / W) / 2) * 2; return { inch: inch, px: Math.max(24, Math.min(140, px)), now: 0.7 * o.size * w * 12 / W }; };
    var showRec = function () { var r = rec(); $('crec').innerHTML = 'For this room: capitals about <b>' + r.inch.toFixed(1) + ' in</b> tall → size <b>' + r.px + '</b>. Size ' + o.size + ' makes them about ' + r.now.toFixed(1) + ' in.'; };
    $('cdist').oninput = $('cpw').oninput = showRec; showRec();
    $('cdist').onchange = function () { var c = T.show.captions = T.show.captions || {}; c.dist = +this.value; T.saveShow('Saved'); };
    $('cpw').onchange = function () { var c = T.show.captions = T.show.captions || {}; c.picW = +this.value; T.saveShow('Saved'); };
    $('cuse').onclick = function () { set('size', rec().px); };
    $('ccol').onchange = function () { set('color', this.value); };
    $('clead').onchange = function () { set('lead', +this.value); };
    $('cnud').onchange = function () { set('nudge', +this.value); };
    $('cnam').onchange = function () { set('names', this.value === '1'); };
    $('cstyle').onchange = function () { set('style', this.value); };
    $('ccuen').onchange = function () { set('cueN', +this.value); };
    app.querySelectorAll('[data-pst]').forEach(function (s2) { s2.onchange = function () { var c = T.show.captions = T.show.captions || {}, p = c.prompt = c.prompt || {}; if (s2.value) p[s2.dataset.pst] = s2.value; else delete p[s2.dataset.pst]; T.saveShow('Saved').then(function () { show(preview.i); }); }; });
    /* preview: step through the cues (a song shows its first line) */
    var pa = $('pa').getContext('2d'), pp = $('pp').getContext('2d');
    var blit = function (ctx) { ctx.drawImage(cv, 0, 0); };
    function show(i) {
      preview.i = Math.max(0, Math.min(cues.length - 1, i)); var c = cues[preview.i]; if (!c) return;
      var card, next = cues[preview.i + 1];
      if (c.type === 'song') { var s = songTimeline(c, o, false)[0], sp = songTimeline(c, o, true)[0]; drawAudience(s && s.card, o); blit(pa); drawPerformer(sp && sp.card, sp && sp.next, o); blit(pp); }
      else { card = c.card; drawAudience(card, o); blit(pa); drawPerformer(card, next ? (next.type === 'song' ? { text: '', song: '#' + next.song.num + ' ' + next.song.title } : next.card) : null, o); blit(pp); }
      $('pn').textContent = 'Cue ' + c.n + ' of ' + cues.length + ' · Scene ' + c.scene.num + (c.type === 'song' ? ' · ♪ song video (first line shown)' : ' · still');
    }
    $('pv').onclick = function () { show(preview.i - 1); };
    $('nx').onclick = function () { show(preview.i + 1); };
    show(preview.i);
    if ($('pplay')) {
      $('psong').onchange = function () { preview.song = this.value; };
      $('pplay').onclick = function () {
        if (stopPlay) { stopPlay(); return; }
        var id = $('psong').value, c = songs.find(function (x) { return x.song.id === id; }), tr = (T.show.tracks || {})[id] || {}, k = tr.performance ? 'performance' : tr.rehearsal ? 'rehearsal' : null, b = this;
        var sa = songTimeline(c, o, false), sp = songTimeline(c, o, true), ctx = T.audioCtx(), t0 = null, src = null, raf = 0;
        var tick = function () {
          var t = t0 == null ? 0 : ctx.currentTime - t0 + (k === 'rehearsal' && T.show.trackOffset && T.show.trackOffset[id] ? -T.show.trackOffset[id] : 0);
          var s = at(sa, t), p = at(sp, t); drawAudience(s && s.card, o); blit(pa); drawPerformer(p && p.card, p && p.next, o); blit(pp);
          $('pn').textContent = '♪ #' + c.song.num + ' · ' + Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2); raf = requestAnimationFrame(tick);
        };
        stopPlay = function () { cancelAnimationFrame(raf); try { src && src.stop(); } catch (e) {} stopPlay = null; b.textContent = '▶ Play with captions'; };
        T.cleanup.push(function () { if (stopPlay) stopPlay(); });
        b.textContent = '■ Stop';
        if (!k) { t0 = ctx.currentTime; T.toast('No track for this song: the captions run on their own.'); tick(); return; }
        Store.getTrack(T.key, id, k, tr[k].ver).then(function (buf) { return ctx.decodeAudioData(buf.slice ? buf.slice(0) : buf); }).then(function (ab) { src = ctx.createBufferSource(); src.buffer = ab; src.connect(ctx.destination); t0 = ctx.currentTime + 0.1; src.start(t0); tick(); })
          .catch(function (e) { T.toast(e.message || 'The track did not load.', 5000); if (stopPlay) stopPlay(); });
      };
    }
    /* making the files */
    var msg = $('xmsg'), bar = $('xbar');
    var busy = function (on) { app.querySelectorAll('[id^=x]').forEach(function (x) { if (x.tagName === 'BUTTON') x.disabled = on; }); bar.hidden = !on; };
    function run(list, withCsv) {
      var title = (T.O().title || 'Show') + ' captions', done = 0, steps = list.reduce(function (s, c) { return s + (c.type === 'song' ? 20 : 1); }, 0) || 1;
      var step = function (w) { done += w; bar.firstChild.style.width = Math.round(done / steps * 100) + '%'; };
      busy(true); msg.textContent = 'Starting…';
      return sink(title).then(function (out) {
        return list.reduce(function (p, c) {
          return p.then(function () {
            if (c.type === 'song') {
              var base = done;
              msg.textContent = 'Making the videos for #' + c.song.num + ' ' + c.song.title + '…';
              return makeVideo(c, o, false, function (f) { bar.firstChild.style.width = Math.round((base + f * 10) / steps * 100) + '%'; }).then(function (v) { return out.put('Song videos/' + fileOf(c, 'audience'), v); })
                .then(function () { return makeVideo(c, o, true, function (f) { bar.firstChild.style.width = Math.round((base + 10 + f * 10) / steps * 100) + '%'; }); }).then(function (v) { return out.put('Song videos/' + fileOf(c, 'performer'), v); }).then(function () { step(20); });
            }
            var next = cues[cues.indexOf(c) + 1];
            drawAudience(c.card, o);
            return png().then(function (b) { return out.put('Audience stills/' + fileOf(c, 'audience'), b); }).then(function () {
              drawPerformer(c.card, next ? (next.type === 'song' ? { text: '', song: '#' + next.song.num + ' ' + next.song.title } : next.card) : null, o);
              return png();
            }).then(function (b) { return out.put('Performer stills/' + fileOf(c, 'performer'), b); }).then(function () { step(1); if (done % 20 === 0) msg.textContent = 'Stills: ' + done + ' of ' + steps + '…'; });
          });
        }, Promise.resolve()).then(function () { return withCsv ? out.put('Cue sheet.csv', cueSheet(cues)) : null; }).then(function () { return out.done(); });
      }).then(function (m) { busy(false); msg.textContent = m + ' ' + list.length + ' cues.'; show(preview.i); }, function (e) { busy(false); msg.textContent = e.name === 'AbortError' ? 'Stopped: no folder was picked.' : (e.message || 'Something went wrong.'); show(preview.i); });
    }
    $('xall').onclick = function () { run(cues, true); };
    $('xsong').onclick = function () { run(songs, true); };
    $('xst').onclick = function () { run(stills, true); };
    $('xone').onclick = function () { var id = $('psong') ? $('psong').value : ''; var c = songs.find(function (x) { return x.song.id === id; }); if (c) run([c], false); else msg.textContent = 'No song with Lyrics timing yet.'; };
    $('xcsv').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(cueSheet(cues)); a.download = (T.O().title || 'Show') + ' caption cue sheet.csv'; document.body.appendChild(a); a.click(); a.remove(); };
  };
  T.Captions = { build: build, songTimeline: songTimeline, nice: nice, makeVideo: makeVideo, opt: opt };
})();
