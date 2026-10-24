/* asl.cool/theatre: the piano melody, read from the real sheet music (Colleen 2026-10-21: "a piano to plunk out the vocal notes for the singer to
   follow. it should use the top line of the music that has lyrics. if there's a part of the song that has no lyrics, there should be no piano notes
   outside of what's provided in the recording").
   - Staves: the five staff lines are drawn as lines in the PDF (read from the page's drawing, following its moves), barlines as short uprights.
   - Notes: noteheads are characters in the Maestro music font (œ filled, ˙ half, w whole); ¿ is a rhythm-only mark for spoken words, so it is
     skipped. A note's height on its staff gives its pitch (every staff in this script is treble clef); the key signature (sharps or flats after
     the clef) and accidentals before a note (until the next barline) change it. In a chord, the top note.
   - Which notes: only the staff a lyric line sits under (the vocal staff: only sung notes, and rests where the singers rest). When two vocal
     staves are sung at the same time (harmony), the upper one.
   - When: each sung syllable is timed by the song's lyrics timing (T.show.lyricTimes); a note above a syllable starts with it, other notes on
     the line are placed between by their position. So the piano follows the recording and is silent where nobody sings.
   T.show.sheetMelody[songId] = { notes: [{ t, d, midi }] } on the band track's clock, like the lyrics timing. */
(function (root) {
  'use strict';
  var HEADS = { 'œ': 1.2, '˙': 2.6, 'w': 4.5 };      // notehead -> the longest it can ring (seconds)
  var STEP_MIDI = [0, 2, 4, 5, 7, 9, 11];            // C D E F G A B
  var SHARPS = [3, 0, 4, 1, 5, 2, 6], FLATS = [6, 2, 5, 1, 4, 0, 3];      // F C G D A E B / B E A D G C F as letters 0=C … 6=B

  /* one page: staves { top, bottom, space, bars: [x] } and the music-font characters { ch, x, y, size } */
  async function readPage(pdf, n, lib) {
    var page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 }), ops = await page.getOperatorList();
    var staves = ScriptParser.geometry(ops, lib.OPS, vp).staves;      // staff lines and barlines (shared with the script reader)
    var tc = await page.getTextContent(), glyphs = [];
    tc.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var tr = it.transform, size = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]);
      if (size < 15) return;      // the music font is set big; words and measure numbers are small
      var p = vp.convertToViewportPoint(tr[4], tr[5]), str = it.str, w = it.width || 0;
      for (var c = 0; c < str.length; c++) if (str[c] !== ' ') glyphs.push({ ch: str[c], x: p[0] + w * c / Math.max(1, str.length), y: p[1], size: size });
    });
    return { staves: staves, glyphs: glyphs };
  }

  /* the notes on one staff, left to right: { x, midi, head } (the top note of a chord) */
  function staffNotes(st, glyphs) {
    var lo = st.top - st.space * 5, hi = st.bottom + st.space * 5;
    var mine = glyphs.filter(function (g) { return g.y > lo && g.y < hi && g.x > st.x0 - 2 && g.x < st.x1 + 2; });
    var half = st.space / 2, out = [];
    var heads = mine.filter(function (g) { return HEADS[g.ch]; }).sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    // an accidental sits just before a notehead at its height; any other sharps or flats are a key signature (after the clef, or a key
    // change partway along the staff), in force from there on
    var beforeNote = function (g) { return heads.some(function (h) { return h.x - g.x > 1 && h.x - g.x < 16 && Math.abs(g.y - h.y) < st.space * 0.7; }); };
    var keySigns = mine.filter(function (g) { return /[#b]/.test(g.ch) && !beforeNote(g); }).sort(function (a, b) { return a.x - b.x; });
    var keys = [];      // [{ x, key }]: a run of sharps or flats close together is one key signature
    keySigns.forEach(function (g) { var k = keys[keys.length - 1]; if (k && g.x - k.last < 12 && k.ch === g.ch) { k.count++; k.last = g.x; } else keys.push({ x: g.x, last: g.x, ch: g.ch, count: 1 }); });
    keys.forEach(function (k) { k.key = {}; (k.ch === '#' ? SHARPS : FLATS).slice(0, k.count).forEach(function (l) { k.key[l] = k.ch === '#' ? 1 : -1; }); });
    var keyAt = function (x) { var key = {}; keys.forEach(function (k) { if (k.x < x) key = k.key; }); return key; };
    var barOf = function (x) { var b = 0; st.bars.forEach(function (bx) { if (bx < x) b++; }); return b; };
    var acc = {};      // "bar:step" -> -1 0 1 for the rest of the bar
    heads.forEach(function (h) {
      var step = Math.round((st.bottom - h.y) / half);      // 0 = E4 on the bottom line of a treble staff
      var d = 2 + step, oct = 4 + Math.floor(d / 7), letter = ((d % 7) + 7) % 7, key = keyAt(h.x);
      var bar = barOf(h.x);
      var a = mine.find(function (g) { return /[#bn]/.test(g.ch) && g.x < h.x - 1 && g.x > h.x - 16 && Math.abs(g.y - h.y) < st.space * 0.7; });
      if (a) acc[bar + ':' + step] = a.ch === '#' ? 1 : a.ch === 'b' ? -1 : 0;
      var alter = acc[bar + ':' + step] != null ? acc[bar + ':' + step] : (key[letter] || 0);
      var midi = 12 * (oct + 1) + STEP_MIDI[letter] + alter;
      var prev = out[out.length - 1];
      if (prev && Math.abs(prev.x - h.x) < 3) { if (midi > prev.midi) { prev.midi = midi; } return; }      // a chord: the top note
      out.push({ x: h.x, midi: midi, head: h.ch });
    });
    return out;
  }

  /* the piano notes for a song. Needs the script pages, the song's lyrics and its lyrics timing. */
  async function make(songId) {
    var T = root.T, so = T.songById(songId), scene = so && T.sceneById(so.scene), src = scene && T.scriptScene(scene);
    var item = src && src.items.find(function (it) { return it.type === 'song' && String(it.num) === String(so.num); });
    var lt = T.show.lyricTimes && T.show.lyricTimes[songId];
    if (!item || !item.lyrics.length) throw new Error('No lyrics for this song in the script.');
    if (!lt) throw new Error('Find this song’s lyrics timing first.');
    var lib = await T.loadPdfJs(), pdf = await T.Pages.doc(), pages = {};
    var lines = [];
    for (var i = 0; i < item.lyrics.length; i++) {
      var l = item.lyrics[i], tm = lt.lines[i];
      var bxs = l.boxes || (l.box ? [l.box] : []);
      if (!bxs.length || !tm || !tm.s || !tm.s.length) continue;
      for (var bi = 0; bi < bxs.length; bi++) {      // a line of the poem can run onto the next staff: each part under its own staff
        var bx = bxs[bi];
        if (!pages[bx.n]) pages[bx.n] = await readPage(pdf, bx.n, lib);
        var pg = pages[bx.n], base = bx.y + bx.h;
        var st = pg.staves.filter(function (s) { return s.bottom < base && base - s.bottom < s.space * 12; }).sort(function (a, b) { return b.bottom - a.bottom; })[0];      // the staff right above
        if (!st) continue;
        var sy = (l.syl || []).map(function (s, k) { return { cx: s.x + s.w / 2, t: tm.s[k], b: s.b || 0 }; }).filter(function (s) { return s.t != null && s.b === bi; });
        if (!sy.length) continue;
        lines.push({ i: i + bi / 10, st: st, n: bx.n, syl: sy, t: sy[0].t, e: bi === bxs.length - 1 ? tm.e : sy[sy.length - 1].t + 0.6, glyphs: pg.glyphs, x0: bx.x - 4, x1: bx.x + bx.w + 4 });
      }
    }
    // harmony: two vocal staves sung at the same time -> keep the upper one
    lines = lines.filter(function (a) {
      return !lines.some(function (b) { return b !== a && b.n === a.n && b.st !== a.st && b.st.top < a.st.top && b.t < a.e - 0.2 && a.t < b.e - 0.2 && a.st.top - b.st.bottom < a.st.space * 14; });
    });
    var used = {}, notes = [];
    lines.forEach(function (L) {
      var key = L.n + ':' + L.st.top.toFixed(1) + ':' + L.t.toFixed(1) + ':' + (L.x0 || 0).toFixed(0);
      if (used[key]) return; used[key] = 1;
      var ns = staffNotes(L.st, L.glyphs).filter(function (nt) { return L.x0 == null || (nt.x > L.x0 - 14 && nt.x < L.x1 + 30); }); if (!ns.length || !L.syl.length) return;
      // time each note: above a syllable -> that syllable; otherwise between its neighbours by position
      var anchors = L.syl.slice().sort(function (a, b) { return a.cx - b.cx; });
      var rate = anchors.length > 1 ? Math.max(0.004, (anchors[anchors.length - 1].t - anchors[0].t) / Math.max(1, anchors[anchors.length - 1].cx - anchors[0].cx)) : 0.02;
      ns.forEach(function (nt) {
        var hit = anchors.find(function (a) { return Math.abs(a.cx - (nt.x + 3.5)) < 9; });
        var t;
        if (hit) t = hit.t;
        else {
          var before = anchors.filter(function (a) { return a.cx < nt.x; }).pop(), after = anchors.find(function (a) { return a.cx > nt.x; });
          if (before && after) t = before.t + (after.t - before.t) * (nt.x - before.cx) / Math.max(1, after.cx - before.cx);
          else if (before) t = Math.min(before.t + (nt.x - before.cx) * rate, L.e || Infinity);
          else t = Math.max(after.t - (after.cx - nt.x) * rate, L.t - 1.5);
        }
        notes.push({ t: t, midi: nt.midi, head: nt.head, anchored: !!hit });
      });
    });
    notes.sort(function (a, b) { return a.t - b.t; });
    // lengths: until the next note, no longer than the notehead allows
    var out = [];
    notes.forEach(function (n, k) {
      if (out.length && Math.abs(out[out.length - 1].t - n.t) < 0.05) return;
      var next = notes.slice(k + 1).find(function (m) { return m.t > n.t + 0.05; });
      var d = Math.min(HEADS[n.head] || 1.2, next ? next.t - n.t : HEADS[n.head] || 1.2);
      var prev = out[out.length - 1];
      if (prev && !n.anchored && prev.midi === n.midi && n.t - (prev.t + prev.d) < 0.08) { prev.d = +(n.t + d - prev.t).toFixed(2); return; }      // a tie
      out.push({ t: +n.t.toFixed(2), d: +Math.max(0.12, d).toFixed(2), midi: n.midi });
    });
    return out;
  }

  /* a plunked piano: a few partials, a quick strike and a ringing decay */
  function schedule(ctx, dest, list, startAt, fromSec, opts) {
    opts = opts || {};
    var nodes = [], vol = opts.volume == null ? 0.25 : opts.volume;
    list.forEach(function (n) {
      if (n.t + n.d < fromSec) return;
      var t0 = startAt + Math.max(0, n.t - fromSec), dur = Math.min(n.d, 2.2) - Math.max(0, fromSec - n.t), f = 440 * Math.pow(2, (n.midi - 69) / 12);
      if (dur <= 0.02) return;
      var g = ctx.createGain(); g.connect(dest);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      g.gain.setTargetAtTime(vol * 0.35, t0 + 0.01, 0.25);
      g.gain.setTargetAtTime(0, t0 + dur, 0.06);
      [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine'], [4.02, 0.05, 'sine']].forEach(function (p) {
        var o = ctx.createOscillator(), og = ctx.createGain(); o.type = p[2]; o.frequency.value = f * p[0]; og.gain.value = p[1];
        o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + dur + 0.4); nodes.push(o);
      });
    });
    return { stop: function () { nodes.forEach(function (o) { try { o.stop(); } catch (e) {} }); } };
  }

  root.SheetMelody = { make: make, schedule: schedule, _readPage: readPage, _staffNotes: staffNotes };
})(typeof window !== 'undefined' ? window : this);
