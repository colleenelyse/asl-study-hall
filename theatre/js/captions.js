/* asl.cool/theatre: open captions for QLab (Colleen 2026-10-24: open captions "with things commonly available in a high school": a long thin
   strip at the bottom of the auditorium's movie screen, lowered a few feet, just above the stage, so Deaf audience members see the words and
   the show together; and a performer view on the back wall or a black sheet from the catwalk, white text on black. She runs sound in QLab:
   "structure the captions for the songs as videos that work seamlessly with still text cued by an operator … lines without consistent timing
   … cued live"; the performer view "even earlier … to let them see what's coming up").
   Songs: one video per song for each view, starting at 0:00 of the band track, timed from Lyrics timing (T.show.lyricTimes, band track
   clock). In QLab, put the video cue in a group with the song's audio cue and fire them together.
   Dialogue: one picture per caption card (PNG), numbered in cue order, for the caption operator to GO on each line.
   The audience view is 1920×1080 and the performer view a 1080×1080 square, black except the words. Everything is made on this computer from the script imported here; nothing is uploaded. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var W = 1920, H = 1080, FPS = 30;
  var MUXER = 'https:' + '//cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js', JSZIP = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  var DEF = { pos: 'top', size: 56, dist: 50, picW: 16, style: 'full', cueN: 4, color: '#ffffff', lead: 2, nudge: 0, names: true };
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
  /* the performer view is a square (Colleen 2026-10-24: "the actors will have a whole large square for projection space so theirs does not need
     to be in a strip … make the text as large and as clear as possible") */
  var PS = 1080, cvP = document.createElement('canvas'); cvP.width = PS; cvP.height = PS;
  var cxP = cvP.getContext('2d');
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
    if (!card || card.song || styleOf(card.who, o) !== 'cue') return { card: card && !card.song ? { key: card.key, who: card.who, name: card.pname != null ? card.pname : card.name, color: card.color, sung: card.sung, text: card.full || card.text } : card, big: 1 };
    var w = (card.full || card.text).replace(/^♪\s*|\s*♪$/g, '').split(' '), short = w.slice(0, o.cueN).join(' ') + (w.length > o.cueN ? ' …' : '');
    return { card: { key: card.key, who: card.who, name: card.pname || card.name, color: card.color, text: (card.sung ? '♪ ' : '') + short }, big: 1.55 };
  }
  /* the performer view looks like the practice app (Colleen 2026-10-24: "the interface that the students use as their teleprompter should look
     like what they were used to seeing in the practice app … borrowing colors of characters in pastels"; "match color and font but prioritize
     visibility so maybe the font should be thicker or bold"): each line a rounded card with the character's color as a stripe on the left, the
     speaker's name above in Lexend capitals, the words in Atkinson Hyperlegible, here bold; the line now has a ring, as in Practice Lines;
     the next line is the card under it, dimmer. On black with pastel colors and a dark tint inside the card, so the back wall stays dim. */
  var mix = function (hex, to, k) { var n = parseInt(String(hex || '#ffd84d').slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return 'rgb(' + c.map(function (v) { return Math.round(v + (to - v) * k); }).join(',') + ')'; };
  /* the same color the practice app gives the character (T.color: her picked colors, else the app's own set, one color for a doubled actor);
     a line for several characters takes the first one's; ALL and the Music card are gold */
  var baseColor = function (who) { var ids = T.labelChars(who || '').filter(function (c) { return c !== '*'; }); return ids.length && T.color ? T.color(ids[0]) : '#e0b100'; };
  var round = function (x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); };
  /* the performer view scrolls like Practice Lines (Colleen 2026-10-24: "is it possible for the actor view to look like it's scrolling so they
     can always see what's coming. i liked that layout"): the line just said at the top (dim, half off the edge), the line now big with its
     ring, the next two lines below (dimmer, the last one running off the bottom). Each GO moves the list up one card; in song videos the cards
     glide up (SCROLL seconds) as each new line comes. A state is { cur, nexts: [..] } of cards. The line just said does not stay:
     "the just said spot should be off the top of the screen very quickly", so it leaves upward in the first half of the scroll. */
  var SCROLL = 0.45, M0 = 36;
  var keyOf = function (card) { return card ? card.key || (card.who || '') + '|' + (card.full || card.text) : ''; };
  function measure(c, card, w, px) {
    var name = String(card.name || '').replace(/:$/, ''), pad = Math.round(px * 0.35), stripe = Math.max(18, Math.round(px * 0.22)), namePx = Math.max(24, Math.round(px * 0.42)), hName = name ? namePx * 1.45 : 0, lh = px * 1.18;
    c.font = '700 ' + px + 'px "Atkinson Hyperlegible", Arial, sans-serif';
    var rs = [], cur = '', room = w - stripe - pad * 2;
    String(card.text).split(' ').forEach(function (x) { var t = cur ? cur + ' ' + x : x; if (c.measureText(t).width > room && cur) { rs.push(cur); cur = x; } else cur = t; }); if (cur) rs.push(cur);
    return { name: name, px: px, pad: pad, stripe: stripe, namePx: namePx, hName: hName, lh: lh, rs: rs, h: pad * 2 + hName + rs.length * lh - (lh - px), ok: !rs.some(function (r) { return c.measureText(r).width > room; }) };
  }
  function fitPx(c, card, w, max, maxH) {      // the largest letters (24 to max) that fit in maxH
    var lo = 24, hi = max, best = 24;
    while (hi - lo > 2) { var mid = Math.floor((lo + hi) / 2), f = measure(c, card, w, mid); if (f.ok && f.h <= maxH) { best = mid; lo = mid; } else hi = mid; }
    return best;
  }
  function drawCardAt(c, it) {
    var card = it.card, f = measure(c, card, it.w, it.px), x = it.x, y = it.y, w = it.w, h = f.h, r = Math.round(f.px * 0.3);
    var col = baseColor(card.who), pastel = mix(col, 255, 0.5), tint = mix(col, 0, 0.72);      // a pastel stripe, name and ring; the card a dark shade of the same color, so it shows on the wall
    var rr = function (X, Y, Wd, Hd, R) { c.beginPath(); if (c.roundRect) c.roundRect(X, Y, Wd, Hd, R); else c.rect(X, Y, Wd, Hd); };
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, it.alpha));
    rr(x, y, w, h, r); c.fillStyle = tint; c.fill();
    c.save(); rr(x, y, w, h, r); c.clip(); c.fillStyle = pastel; c.fillRect(x, y, f.stripe, h); c.restore();
    if (it.ring > 0) { c.globalAlpha = Math.max(0, Math.min(1, it.alpha * it.ring)); rr(x - 7, y - 7, w + 14, h + 14, r + 7); c.lineWidth = 7; c.strokeStyle = pastel; c.stroke(); c.globalAlpha = Math.max(0, Math.min(1, it.alpha)); }
    c.textBaseline = 'top';
    var tx = x + f.stripe + f.pad;
    if (f.name) { c.font = '700 ' + f.namePx + 'px Lexend, "Atkinson Hyperlegible", Arial, sans-serif'; if ('letterSpacing' in c) c.letterSpacing = Math.round(f.namePx * 0.06) + 'px'; c.fillStyle = pastel; c.fillText(f.name.toUpperCase(), tx, y + f.pad); if ('letterSpacing' in c) c.letterSpacing = '0px'; }
    c.font = '700 ' + f.px + 'px "Atkinson Hyperlegible", Arial, sans-serif'; c.fillStyle = it.color;
    f.rs.forEach(function (row, i) { c.fillText(row, tx, y + f.pad + f.hName + i * f.lh); });
    c.restore();
    return h;
  }
  var songCard = function (c) { return c && c.song ? { who: '', name: 'Next', text: '♪ ' + c.song, full: '♪ ' + c.song } : c; };
  /* where each card goes for a state */
  function perfLayout(state, o) {
    var c = cxP, w = PS - M0 * 2, items = [], y;
    var put = function (card, yy, px, alpha, ring) { items.push({ key: keyOf(card), card: card, x: M0, y: yy, w: w, px: px, alpha: alpha, ring: ring, color: o.color }); return measure(c, card, w, px).h; };
    var P = function (card) { return card ? forPrompt(songCard(card), o) : null; };
    var cu = P(state.cur), nx = (state.nexts || []).filter(Boolean).map(P);
    y = M0;
    if (cu) { var cpx = fitPx(c, cu.card, w, cu.big > 1 ? 240 : 190, PS * (nx.length ? 0.56 : 0.86)); y += put(cu.card, y, cpx, 1, 1) + 40; }
    nx.forEach(function (n, i) { var max = i ? 60 : 80, npx = Math.max(36, fitPx(c, n.card, w, max, Math.max(120, PS - y - M0))); y += put(n.card, y, npx, i ? 0.35 : 0.6, 0) + 26; });
    return items;
  }
  function drawItems(items) { cxP.fillStyle = '#000'; cxP.fillRect(0, 0, PS, PS); items.forEach(function (it) { if (it.y < PS && it.alpha > 0.01) drawCardAt(cxP, it); }); }
  function drawPerformer(state, o) { drawItems(state ? perfLayout(state, o) : []); }
  /* between two states: each card moves from where it was to where it goes; new cards rise from below, the old top card leaves upward */
  function drawScroll(s0, s1, e, o) {
    var A = perfLayout(s0, o), B = perfLayout(s1, o), lerp = function (p, q) { return p + (q - p) * e; }, out = [];
    B.forEach(function (b) {
      var a = A.find(function (x) { return x.key === b.key; });
      if (!a) a = { y: b.y + 160, px: b.px, alpha: 0, ring: 0 };
      out.push({ key: b.key, card: b.card, x: b.x, w: b.w, color: b.color, y: lerp(a.y, b.y), px: Math.round(lerp(a.px, b.px)), alpha: lerp(a.alpha, b.alpha), ring: lerp(a.ring, b.ring) });
    });
    var fast = Math.min(1, e * 2);      // the line just said is gone in the first half
    A.forEach(function (a) { if (!B.some(function (b) { return b.key === a.key; })) { var h = measure(cxP, a.card, a.w, a.px).h; out.unshift({ key: a.key, card: a.card, x: a.x, w: a.w, color: a.color, y: a.y - (a.y + h + 20) * fast, px: a.px, alpha: a.alpha * (1 - fast * 0.5), ring: a.ring * (1 - fast) }); } });
    drawItems(out);
  }
  var ease = function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  /* a song's performer picture at time t: { key, draw } (key changes only when the picture does) */
  function perfAt(segs, t, o) {
    var j = -1; for (var i = 0; i < segs.length; i++) if (segs[i].a <= t && t < segs[i].b) { j = i; break; }
    if (j < 0) return { key: 'none', draw: function () { drawPerformer(null, o); } };
    var into = t - segs[j].a, dur = Math.min(SCROLL, (segs[j].b - segs[j].a) * 0.8);      // fast lines: a quicker scroll
    if (j > 0 && into < dur) { var e = ease(into / dur); return { key: j + ':' + Math.round(e * 60), draw: function () { drawScroll(segs[j - 1].state, segs[j].state, e, o); } }; }
    return { key: String(j), draw: function () { drawPerformer(segs[j].state, o); } };
  }
  /* the fonts must be loaded before the canvas can draw with them */
  var fontsP = null;
  function fontsReady() { if (!fontsP) fontsP = document.fonts ? Promise.all(['700 60px "Atkinson Hyperlegible"', '600 60px "Atkinson Hyperlegible"', '700 30px Lexend'].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve(); return fontsP; }
  /* ---------- the show as caption cues ---------- */
  function cardsFor(who, text, sung, o, prevWho) {
    var t = nice(LineCheck.spoken(String(text || '')).replace(/\s*[—–-]{1,2}\s*$/, '—')); if (!t.replace(/[^A-Za-z0-9]/g, '')) return [];      // stage directions in parentheses are not said
    if (sung) t = '♪ ' + t + ' ♪';
    var name = o.names && who && (!sung || who !== prevWho) ? whoName(who) + ':' : '', base = { who: who, name: name, color: whoColor(who), sung: sung };
    var rs = rows(t, o.size, W - 160, name ? nameW(base, o.size) : 0), out = [];
    for (var i = 0; i < rs.length; i += 2) out.push({ who: who, name: i ? '' : name, pname: o.names && who ? whoName(who) : '', full: t, color: base.color, sung: sung, text: rs.slice(i, i + 2).join(' '), rows: rs.slice(i, i + 2), share: rs.slice(i, i + 2).join(' ').length });      // full, pname: the performer view always shows the whole line and who says it
    return out;
  }
  /* ---------- the caption script ----------
     Captions come from an editable copy (Colleen 2026-10-24: "a place where i can edit this captioning document and add back missing lines and
     combine lines and reassign lines to characters … delete things that were incorrectly picked up as text"): T.show.captionDoc, made from the
     script the first time it is edited (js/captedit.js). Until then the script itself is used. The copy is
     { scenes: [{ id, num, place, rows: [row] }] }; a row is { id, k: 'line', who, text } (spoken, cued by GO), { id, k: 'sfx', text } (a sound,
     like [door slams]), or { id, k: 'song', songId, num, title, lines: [{ id, who, text, spoken, li: [lyric line numbers], t?, e? }] }.
     A song line keeps li, its line(s) in Lyrics timing, so retiming the song moves its captions; t/e (seconds, band track) when she set them. */
  var rid = function () { return 'r' + Math.random().toString(36).slice(2, 9); };
  function docFromScript() {
    var doc = { v: 1, made: new Date().toISOString(), scenes: [] };
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      var songHash = {}, rows = [];
      src.items.forEach(function (it) { if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.spoken && l.who) songHash[T.Voices ? T.Voices.id(l) : l.text] = 1; }); });
      src.items.forEach(function (it) {
        if (it.type === 'line') {
          if (T.Voices && songHash[T.Voices.id(it)]) return;      // the same line read inside the song: it is in the song
          var words = LineCheck.spoken(it.text); if (!words.replace(/[^A-Za-z0-9]/g, '')) return;
          rows.push({ id: rid(), k: 'line', who: it.who || '', text: words });
        }
        if (it.type === 'song') {
          var so = T.O().songs.find(function (x) { return x.scene === sc.id && String(x.num) === String(it.num); });
          rows.push({ id: rid(), k: 'song', songId: so && so.id, num: it.num, title: (so && so.title) || it.title || '', lines: (it.lyrics || []).map(function (l, k) { return { id: rid(), who: l.who || '', text: LineCheck.spoken(String(l.text || '')).trim() || String(l.text || ''), spoken: !!l.spoken, li: [k] }; }) });
        }
      });
      doc.scenes.push({ id: sc.id, num: sc.num, place: sc.place, rows: rows });
    });
    return doc;
  }
  var theDoc = function () { return T.show.captionDoc || docFromScript(); };
  /* a song line's time: her own, else from Lyrics timing (the first of its lines to the end of the last) */
  function lineTime(songId, l) {
    if (l.t != null) return { t: l.t, end: l.e != null ? l.e : l.t + 2 };
    var lt = songId && T.show.lyricTimes && T.show.lyricTimes[songId], L = lt && lt.lines; if (!L || !l.li || !l.li.length) return null;
    var x0 = L[l.li[0]], xN = L[l.li[l.li.length - 1]]; if (!x0 || x0.t == null) return null;
    return { t: x0.t, end: xN && xN.t != null ? T.lineEnd(xN) : T.lineEnd(x0) };
  }
  function build() {
    var o = opt(), cues = [], n = 0, doc = theDoc();
    doc.scenes.forEach(function (ds) {
      var sc = T.O().scenes.find(function (x) { return x.id === ds.id; }) || { id: ds.id, num: ds.num, place: ds.place };
      ds.rows.forEach(function (r) {
        if (r.k === 'line') cardsFor(r.who, r.text, false, o).forEach(function (c) { cues.push({ n: ++n, type: 'still', scene: sc, card: c }); });
        if (r.k === 'sfx' && r.text) cardsFor('', r.text, false, o).forEach(function (c) { c.sfx = true; cues.push({ n: ++n, type: 'still', scene: sc, card: c }); });
        if (r.k === 'song') {
          var so = T.O().songs.find(function (x) { return x.id === r.songId; }) || { id: r.songId, num: r.num, title: r.title };
          var timed = r.lines.some(function (l) { return lineTime(r.songId, l); });
          if (timed) cues.push({ n: ++n, type: 'song', scene: sc, song: so, lines: r.lines });
          else { var prev = null; r.lines.forEach(function (l) { cardsFor(l.who, l.text, !l.spoken, o, prev).forEach(function (c) { cues.push({ n: ++n, type: 'still', scene: sc, card: c, untimed: so.title }); }); prev = l.who; }); }      // no Lyrics timing yet: stills, cued by hand
        }
      });
    });
    return cues;
  }
  /* a song's caption timeline: [{ a, b, card }] in band-track seconds; the performer's starts `lead` seconds earlier and runs to the next */
  function songTimeline(cue, o, performer) {
    var L = cue.lines || [], tl = L.map(function (l) { return lineTime(cue.song.id, l); }), segs = [], prev = null;
    L.forEach(function (l, k) {
      var x = tl[k]; if (!x) return;
      var cards = cardsFor(l.who, l.text, !l.spoken, o, prev); prev = l.who;
      var nxt = null; for (var j = k + 1; j < tl.length; j++) if (tl[j]) { nxt = tl[j].t; break; }
      var a = x.t, end = x.end, b = Math.min(nxt != null ? nxt : end + 2, end + 1.2);
      if (nxt != null && b > nxt) b = nxt;
      var tot = cards.reduce(function (s, c) { return s + c.share; }, 0) || 1, at = a;
      cards.forEach(function (c) { var d = (b - a) * c.share / tot; segs.push({ a: at, b: at + d, card: c, nextStart: nxt }); at += d; });
    });
    var nud = +o.nudge || 0;
    segs.forEach(function (s) { s.a += nud; s.b += nud; });
    if (!performer) return segs;
    /* the performer's view: one step per line (not per audience caption), `lead` seconds early, held until the next line comes */
    /* every line moves into the lit-up spot the same `lead` seconds before it is sung (Colleen 2026-10-24: "a line should scroll up on the
       student screen a uniform moment before it's sung"); before the first line, and in a long break, the lit-up card is "♪ Music ♪", so no
       line is lit up through the intro ("the first number just has the first line highlighted for the whole intro") */
    var lead = +o.lead || 0, D = [], out = [], nMusic = 0;
    segs.forEach(function (s) { var d = D[D.length - 1]; if (d && keyOf(d.card) === keyOf(s.card)) d.end = s.b; else D.push({ card: s.card, a: s.a, end: s.b }); });
    var music = function () { var k = ++nMusic; return { who: '', name: '', text: '♪ Music ♪', full: '♪ Music ♪', key: 'music ' + k }; };
    var up = function (j) { return [D[j] && D[j].card, D[j + 1] && D[j + 1].card].filter(Boolean); };
    var startOf = function (j) { return Math.max(0, D[j].a - lead); };
    if (D.length && startOf(0) > 0.3) out.push({ a: 0, card: null, state: { cur: music(), nexts: up(0) } });
    D.forEach(function (d, j) {
      var a = startOf(j), prevA = out.length ? out[out.length - 1].a : -1;
      if (a <= prevA) a = prevA + 0.05;      // two lines at the same moment: one after the other
      out.push({ a: a, card: d.card, state: { cur: d.card, nexts: up(j + 1) } });
      var nextA = D[j + 1] ? startOf(j + 1) : null;
      if (nextA != null && nextA - (d.end + 0.6) > 4) out.push({ a: d.end + 0.6, card: null, state: { cur: music(), nexts: up(j + 1) } });      // a long break in the singing
    });
    out.forEach(function (x, j) { x.b = out[j + 1] ? out[j + 1].a : (D.length ? D[D.length - 1].end + 2 : 3); });
    return out;
  }
  var at = function (segs, t) { for (var i = 0; i < segs.length; i++) if (segs[i].a <= t && t < segs[i].b) return segs[i]; return null; };

  /* ---------- video (H.264 MP4, plays in QLab) ---------- */
  function codec() {
    if (!window.VideoEncoder) return Promise.reject(new Error('This browser cannot make videos. Use Chrome (or Edge) on a recent computer.'));
    var tries = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'];
    return tries.reduce(function (p, c) { return p.then(function (got) { return got || VideoEncoder.isConfigSupported({ codec: c, width: 1920, height: 1080, bitrate: 2e6, framerate: FPS }).then(function (r) { return r.supported ? c : null; }, function () { return null; }); }); }, Promise.resolve(null))
      .then(function (c) { if (!c) throw new Error('This computer cannot make H.264 video in the browser. Try Chrome on a Mac.'); return c; });
  }
  function makeVideo(cue, o, performer, prog) {
    var segs = songTimeline(cue, o, performer), last = segs.reduce(function (m, s) { return Math.max(m, s.b); }, 0), dur = last + 3, frames = Math.ceil(dur * FPS);
    return Promise.all([load(MUXER, 'Mp4Muxer'), codec()]).then(function (r) {
      var vw = performer ? PS : W, vh = performer ? PS : H, src = performer ? cvP : cv;
      var M = r[0], muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: vw, height: vh, frameRate: FPS }, fastStart: 'in-memory' }), err = null;
      var enc = new VideoEncoder({ output: function (ch, meta) { muxer.addVideoChunk(ch, meta); }, error: function (e) { err = e; } });
      enc.configure({ codec: r[1], width: vw, height: vh, bitrate: 2e6, framerate: FPS, latencyMode: 'quality' });
      var i = 0, shown = undefined;
      function more() {
        if (err) return Promise.reject(err);
        var stop = Math.min(frames, i + 60);
        for (; i < stop; i++) {
          var t = i / FPS;
          if (performer) { var pf = perfAt(segs, t, o); if (pf.key !== shown) { pf.draw(); shown = pf.key; } }
          else { var s = at(segs, t), key = s ? s.card.text : ''; if (key !== shown) { drawAudience(s && s.card, o); shown = key; } }
          var f = new VideoFrame(src, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
          enc.encode(f, { keyFrame: i % (FPS * 2) === 0 }); f.close();
        }
        if (prog) prog(i / frames);
        if (i >= frames) return enc.flush().then(function () { muxer.finalize(); return new Blob([muxer.target.buffer], { type: 'video/mp4' }); });
        return new Promise(function (ok) { (function wait() { if (enc.encodeQueueSize > 20) setTimeout(wait, 5); else ok(); })(); }).then(more);
      }
      return more();
    });
  }
  var png = function (canvas) { return new Promise(function (ok) { (canvas || cv).toBlob(ok, 'image/png'); }); };
  /* the performer's picture for still cue i: this line, then the next two different lines (a long line is two audience captions), or the song */
  function stateFor(cues, i) {
    var c = cues[i], nexts = [], last = c.card;
    for (var j = i + 1; j < cues.length && nexts.length < 2; j++) {
      var n = cues[j];
      if (n.type === 'song') { nexts.push({ text: '', song: '#' + n.song.num + ' ' + n.song.title }); break; }
      if (keyOf(n.card) !== keyOf(last)) { nexts.push(n.card); last = n.card; }
    }
    return { cur: c.card, nexts: nexts };
  }

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
  /* ---------- QLab (Colleen 2026-10-24: "build the QLab script that creates the caption cues automatically") ----------
     Two files go in the captions folder: "QLab cue list.txt" (one cue a row, tab-separated) and "Build QLab cues.applescript", which she
     opens in Script Editor and runs with her QLab workspace open. It makes:
       • a cue list "Captions" for the caption operator: per spoken line a Group (fire all) holding a Stop for the caption before it and the
         line's audience and performer pictures; at each song a Stop cue named "♪ … GO when the song starts" (clears the last caption);
       • a cue list "Song captions": per song a Group holding its two videos, to drag into that song's audio group in her sound list, so the
         captions start with the music.
     Stages: the cues are named AUD … and PERF …; the script tries to set QLab 5 stages "Audience" and "Performer" and, if it cannot, says so
     (select the AUD cues, set the stage once in the inspector). It never deletes or changes her other cues. */
  function qlabData(cues) {
    var clean = function (t) { return String(t || '').replace(/[\t\r\n]+/g, ' ').trim(); };
    return ['kind\tnumber\tname\taudience\tperformer'].concat(cues.map(function (c) {
      if (c.type === 'song') return ['song', 'C' + c.n, clean('♪ #' + c.song.num + ' ' + c.song.title + ' captions'), 'Song videos/' + fileOf(c, 'audience'), 'Song videos/' + fileOf(c, 'performer')].join('\t');
      return ['still', 'C' + c.n, clean('S' + c.scene.num + ' ' + (c.card.name || whoName(c.card.who) + ':') + ' ' + c.card.text).slice(0, 70), 'Audience stills/' + fileOf(c, 'audience'), 'Performer stills/' + fileOf(c, 'performer')].join('\t');
    })).join('\n') + '\n';
  }
  var QLAB_SCRIPT = [
    '-- Build the caption cues in QLab 5 (made by asl.cool/theatre › Open captions).',
    '-- 1. Open your show in QLab 5.  2. Open this file in Script Editor.  3. Press Run (▶).  4. Pick your captions folder.',
    '-- It adds two cue lists, "Captions" and "Song captions". It does not change or delete any of your other cues.',
    'use scripting additions',
    'property stageTrouble : false',
    'set theFolder to choose folder with prompt "Pick the captions folder (the one with Audience stills, Performer stills and Song videos)"',
    'set base to POSIX path of theFolder',
    'try',
    '\tset raw to read (POSIX file (base & "QLab cue list.txt")) as «class utf8»',
    'on error',
    '\tdisplay dialog "That folder has no QLab cue list.txt. Pick the folder the app made." buttons {"OK"} default button 1',
    '\treturn',
    'end try',
    'set rowsList to paragraphs of raw',
    'set made to 0',
    'set missingFiles to 0',
    'set songCount to 0',
    'set prevG to missing value',
    'set AppleScript\'s text item delimiters to tab',
    'tell application id "com.figure53.QLab.5"',
    '\tactivate',
    '\ttell front workspace',
    '\t\tset capList to my listNamed("Captions")',
    '\t\tset songList to my listNamed("Song captions")',
    '\t\trepeat with ln in rowsList',
    '\t\t\tset cols to text items of (ln as text)',
    '\t\t\tif (count of cols) ≥ 5 and item 1 of cols is not "kind" then',
    '\t\t\t\tset rowKind to item 1 of cols',
    '\t\t\t\tset capName to item 3 of cols',
    '\t\t\t\tif rowKind is "song" then',
    '\t\t\t\t\t-- in the Captions list: a Stop that clears the last caption, GO when the song starts',
    '\t\t\t\t\tset current cue list to capList',
    '\t\t\t\t\tmake type "Stop"',
    '\t\t\t\t\tset s to last item of (selected as list)',
    '\t\t\t\t\tset q name of s to capName & " · GO when the song starts"',
    '\t\t\t\t\tset q number of s to ""',
    '\t\t\t\t\tif prevG is not missing value then set cue target of s to prevG',
    '\t\t\t\t\tset current cue list to songList',
    '\t\t\t\t\tset songCount to songCount + 1',
    '\t\t\t\telse',
    '\t\t\t\t\tset current cue list to capList',
    '\t\t\t\tend if',
    '\t\t\t\tmake type "Group"',
    '\t\t\t\tset g to last item of (selected as list)',
    '\t\t\t\tset q number of g to item 2 of cols',
    '\t\t\t\tset q name of g to capName',
    '\t\t\t\tmy fireAll(g)',
    '\t\t\t\tif rowKind is "still" and prevG is not missing value then',
    '\t\t\t\t\tmake type "Stop"',
    '\t\t\t\t\tset s to last item of (selected as list)',
    '\t\t\t\t\tset cue target of s to prevG',
    '\t\t\t\t\tset q name of s to "clear the caption before"',
    '\t\t\t\t\tset q number of s to ""',
    '\t\t\t\t\tmove cue id (uniqueID of s) of parent of s to end of g',
    '\t\t\t\tend if',
    '\t\t\t\trepeat with k from 4 to 5',
    '\t\t\t\t\tset p to base & (item k of cols)',
    '\t\t\t\t\tif my fileExists(p) then',
    '\t\t\t\t\t\tmake type "Video"',
    '\t\t\t\t\t\tset v to last item of (selected as list)',
    '\t\t\t\t\t\tset file target of v to (POSIX file p)',
    '\t\t\t\t\t\tif k is 4 then',
    '\t\t\t\t\t\t\tset q name of v to "AUD " & capName',
    '\t\t\t\t\t\t\tmy putOnStage(v, "Audience")',
    '\t\t\t\t\t\telse',
    '\t\t\t\t\t\t\tset q name of v to "PERF " & capName',
    '\t\t\t\t\t\t\tmy putOnStage(v, "Performer")',
    '\t\t\t\t\t\tend if',
    '\t\t\t\t\t\tmove cue id (uniqueID of v) of parent of v to end of g',
    '\t\t\t\t\telse',
    '\t\t\t\t\t\tset missingFiles to missingFiles + 1',
    '\t\t\t\t\tend if',
    '\t\t\t\tend repeat',
    '\t\t\t\tif rowKind is "still" then set prevG to g',
    '\t\t\t\tset made to made + 1',
    '\t\t\tend if',
    '\t\tend repeat',
    '\t\tset current cue list to capList',
    '\tend tell',
    'end tell',
    'set msg to "Made " & made & " caption cues (" & songCount & " songs in the Song captions list)."',
    'if missingFiles > 0 then set msg to msg & return & return & missingFiles & " files were not in the folder, so those cues have no picture or video yet (make them in the app, then run this again on a new copy of the show)."',
    'if stageTrouble then set msg to msg & return & return & "The stages could not be set by the script. In QLab: search for AUD, select those cues, and set their stage to Audience in the inspector; then the same for PERF and Performer."',
    'set msg to msg & return & return & "Next: drag each group in Song captions into that song\'s audio group in your sound list, so the captions start with the music."',
    'display dialog msg buttons {"OK"} default button 1',
    '',
    'on listNamed(capName)',
    '\ttell application id "com.figure53.QLab.5"',
    '\t\ttell front workspace',
    '\t\t\ttry',
    '\t\t\t\treturn first cue list whose q name is capName',
    '\t\t\tend try',
    '\t\t\tmake type "cue list"',
    '\t\t\tset L to last cue list',
    '\t\t\tset q name of L to capName',
    '\t\t\treturn L',
    '\t\tend tell',
    '\tend tell',
    'end listNamed',
    'on fireAll(g)',
    '\ttell application id "com.figure53.QLab.5"',
    '\t\tset mode of g to timeline',
    '\tend tell',
    'end fireAll',
    'on putOnStage(v, capName)',
    '\ttell application id "com.figure53.QLab.5"',
    '\t\ttry',
    '\t\t\tset stage name of v to capName',
    '\t\t\tif stage name of v is not capName then set stageTrouble to true',
    '\t\ton error',
    '\t\t\tset stageTrouble to true',
    '\t\tend try',
    '\tend tell',
    'end putOnStage',
    'on fileExists(p)',
    '\ttry',
    '\t\t(POSIX file p) as alias',
    '\t\treturn true',
    '\ton error',
    '\t\treturn false',
    '\tend try',
    'end fileExists',
    ''].join('\n');
  var qlabFiles = function (cues) { return [['QLab cue list.txt', new Blob([qlabData(cues)], { type: 'text/plain' })], ['Build QLab cues.applescript', new Blob([QLAB_SCRIPT], { type: 'text/plain' })]]; };
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
      '<p><a class="btn small" href="#/teacher/captedit">✏️ Edit the captions</a> <span class="muted small">' + (T.show.captionDoc ? 'Using your edited caption script.' : 'Made straight from the script (nothing edited yet).') + '</span></p><p><b>' + cues.length + ' cues</b>: ' + songs.length + ' song videos and ' + stills.length + ' stills.' + (untimed.length ? ' <span class="err">' + untimed.length + ' songs have no Lyrics timing yet, so their lines are stills you cue by hand' + '</span> (' + untimed.slice(0, 4).map(function (s) { return '#' + s.num; }).join(', ') + (untimed.length > 4 ? '…' : '') + ').' : '') + '</p></div>' +
      '<div class="card"><h3>How they look</h3><div class="row" style="flex-wrap:wrap">' +
      '<label class="f">Audience strip' + sel('cpos', o.pos, [['top', 'At the top of the picture'], ['bottom', 'At the bottom'], ['middle', 'In the middle']]) + '</label>' +
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
      '<div class="cap-prev"><figure><figcaption>Audience strip</figcaption><canvas id="pa" width="' + W + '" height="' + H + '"></canvas></figure><figure><figcaption>Performer view</figcaption><canvas id="pp" width="' + PS + '" height="' + PS + '"></canvas></figure></div>' +
      '<div class="row"><button class="btn" id="pv">◀</button><span id="pn" class="grow center small"></span><button class="btn" id="nx">▶ Next cue</button></div>' +
      (songs.length ? '<div class="row"><label class="f grow" style="margin:0">Try a song with its band track' + sel('psong', preview.song || songs[0].song.id, songs.map(function (c) { return [c.song.id, '#' + c.song.num + ' ' + esc(c.song.title)]; })) + '</label><button class="btn primary" id="pplay">▶ Play with captions</button></div>' : '') + '</div>' +
      '<div class="card"><h3>Make the files</h3><p class="muted small">Chrome asks for a folder (make a new one, like “HSM captions”); other browsers download one zip file. Song videos take a little while each.</p>' +
      '<div class="row" style="flex-wrap:wrap"><button class="btn primary" id="xall">Make everything</button><button class="btn" id="xsong">Just the song videos</button><button class="btn" id="xone">Just the song above (to test in QLab)</button><button class="btn" id="xst">Just the stills</button><button class="btn quiet" id="xcsv">Just the cue sheet</button><button class="btn quiet" id="xql">Just the QLab script</button></div><p id="xmsg" class="small"></p><div class="pb" id="xbar" hidden style="height:12px;border-radius:6px;background:var(--line);overflow:hidden"><i style="display:block;height:100%;width:0;background:var(--accent)"></i></div></div>' +
      '<div class="card"><h3>In QLab</h3><ol class="small" style="line-height:1.6">' +
      '<li>Make two video surfaces: <b>Audience</b> (the projector on the movie screen) and <b>Performer</b> (the back-wall projector).</li>' +
      '<li>For each song: a Group cue set to “start all children simultaneously”, holding the song’s audio cue, its audience video (Audience surface) and its performer video (Performer surface).</li>' +
      '<li>For each spoken line: a Group cue holding its audience picture and performer picture, each set to hold, with the cue before it faded out. Your operator presses GO as the line starts.</li>' +
      '<li><b>Let the script build it:</b> with your show open in QLab 5, open <b>Build QLab cues.applescript</b> (in the captions folder) in Script Editor, press Run ▶, and pick the captions folder. It adds a <b>Captions</b> list (a group for every line: GO as the line starts) and a <b>Song captions</b> list. Then drag each song’s group into that song’s audio group in your sound list. The first time, your Mac asks to let Script Editor control QLab: say OK. A whole show takes several minutes.</li>' +
      '<li>The cue sheet (CSV) lists every cue in order with its files, if you would rather build by hand.</li>' +
      '<li>The caption operator can run the Captions list from a second QLab window or QLab Remote on an iPad, with their own GO.</li>' +
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
    var blit = function (ctx) { ctx.drawImage(ctx === pp ? cvP : cv, 0, 0); };
    function show(i) {
      preview.i = Math.max(0, Math.min(cues.length - 1, i)); var c = cues[preview.i]; if (!c) return;
      var card;
      if (c.type === 'song') { var s = songTimeline(c, o, false)[0], sp = songTimeline(c, o, true)[0]; drawAudience(s && s.card, o); blit(pa); drawPerformer(sp && sp.state, o); blit(pp); }
      else { card = c.card; drawAudience(card, o); blit(pa); drawPerformer(stateFor(cues, preview.i), o); blit(pp); }
      $('pn').textContent = 'Cue ' + c.n + ' of ' + cues.length + ' · Scene ' + c.scene.num + (c.type === 'song' ? ' · ♪ song video (first line shown)' : ' · still');
    }
    $('pv').onclick = function () { show(preview.i - 1); };
    $('nx').onclick = function () { show(preview.i + 1); };
    fontsReady().then(function () { show(preview.i); });
    if ($('pplay')) {
      $('psong').onchange = function () { preview.song = this.value; };
      $('pplay').onclick = function () {
        if (stopPlay) { stopPlay(); return; }
        var id = $('psong').value, c = songs.find(function (x) { return x.song.id === id; }), tr = (T.show.tracks || {})[id] || {}, k = tr.performance ? 'performance' : tr.rehearsal ? 'rehearsal' : null, b = this;
        var sa = songTimeline(c, o, false), sp = songTimeline(c, o, true), ctx = T.audioCtx(), t0 = null, src = null, raf = 0;
        var tick = function () {
          var t = t0 == null ? 0 : ctx.currentTime - t0 + (k === 'rehearsal' && T.show.trackOffset && T.show.trackOffset[id] ? -T.show.trackOffset[id] : 0);
          var s = at(sa, t), p = at(sp, t); drawAudience(s && s.card, o); blit(pa); perfAt(sp, t, o).draw(); blit(pp);
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
      return fontsReady().then(function () { return sink(title); }).then(function (out) {
        return list.reduce(function (p, c) {
          return p.then(function () {
            if (c.type === 'song') {
              var base = done;
              msg.textContent = 'Making the videos for #' + c.song.num + ' ' + c.song.title + '…';
              return makeVideo(c, o, false, function (f) { bar.firstChild.style.width = Math.round((base + f * 10) / steps * 100) + '%'; }).then(function (v) { return out.put('Song videos/' + fileOf(c, 'audience'), v); })
                .then(function () { return makeVideo(c, o, true, function (f) { bar.firstChild.style.width = Math.round((base + 10 + f * 10) / steps * 100) + '%'; }); }).then(function (v) { return out.put('Song videos/' + fileOf(c, 'performer'), v); }).then(function () { step(20); });
            }
            drawAudience(c.card, o);
            return png().then(function (b) { return out.put('Audience stills/' + fileOf(c, 'audience'), b); }).then(function () {
              drawPerformer(stateFor(cues, cues.indexOf(c)), o);
              return png(cvP);
            }).then(function (b) { return out.put('Performer stills/' + fileOf(c, 'performer'), b); }).then(function () { step(1); if (done % 20 === 0) msg.textContent = 'Stills: ' + done + ' of ' + steps + '…'; });
          });
        }, Promise.resolve()).then(function () { return withCsv ? out.put('Cue sheet.csv', cueSheet(cues)).then(function () { return qlabFiles(cues).reduce(function (p, f) { return p.then(function () { return out.put(f[0], f[1]); }); }, Promise.resolve()); }) : null; }).then(function () { return out.done(); });
      }).then(function (m) { busy(false); msg.textContent = m + ' ' + list.length + ' cues.'; show(preview.i); }, function (e) { busy(false); msg.textContent = e.name === 'AbortError' ? 'Stopped: no folder was picked.' : (e.message || 'Something went wrong.'); show(preview.i); });
    }
    $('xall').onclick = function () { run(cues, true); };
    $('xsong').onclick = function () { run(songs, true); };
    $('xst').onclick = function () { run(stills, true); };
    $('xone').onclick = function () { var id = $('psong') ? $('psong').value : ''; var c = songs.find(function (x) { return x.song.id === id; }); if (c) run([c], false); else msg.textContent = 'No song with Lyrics timing yet.'; };
    $('xql').onclick = function () { busy(true); sink((T.O().title || 'Show') + ' QLab script').then(function (out) { return qlabFiles(cues).reduce(function (p, f) { return p.then(function () { return out.put(f[0], f[1]); }); }, Promise.resolve()).then(function () { return out.done(); }); }).then(function (m) { busy(false); msg.textContent = m + ' Put these two files in the same folder as the pictures and videos.'; }, function (e) { busy(false); msg.textContent = e.name === 'AbortError' ? 'Stopped: no folder was picked.' : e.message; }); };
    $('xcsv').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(cueSheet(cues)); a.download = (T.O().title || 'Show') + ' caption cue sheet.csv'; document.body.appendChild(a); a.click(); a.remove(); };
  };
  T.Captions = { docFromScript: docFromScript, lineTime: lineTime, rid: rid, perfAt: perfAt, stateFor: stateFor, cvP: cvP, qlabData: qlabData, QLAB_SCRIPT: QLAB_SCRIPT, build: build, songTimeline: songTimeline, nice: nice, makeVideo: makeVideo, opt: opt };
})();
