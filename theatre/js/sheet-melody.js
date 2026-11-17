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

  /* one page: staves { top, bottom, space, bars: [x] }, beams, ties/slurs (arcs), stems, systems, and the music-font characters { ch, x, y, size } */
  async function readPage(pdf, n, lib) {
    var page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 }), ops = await page.getOperatorList();
    var geo = ScriptParser.geometry(ops, lib.OPS, vp);      // staff lines, barlines, beams, ties, stems (shared with the script reader)
    var tc = await page.getTextContent(), glyphs = [];
    tc.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var tr = it.transform, size = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]);
      if (size < 15) return;      // the music font is set big; words and measure numbers are small
      var p = vp.convertToViewportPoint(tr[4], tr[5]), str = it.str, w = it.width || 0;
      for (var c = 0; c < str.length; c++) if (str[c] !== ' ') glyphs.push({ ch: str[c], x: p[0] + w * c / Math.max(1, str.length), y: p[1], size: size });
    });
    return { staves: geo.staves, systems: geo.systems, beams: geo.beams || [], arcs: geo.arcs || [], stems: geo.stems || [], glyphs: glyphs };
  }

  /* what is on one staff, left to right (Colleen 2026-10-24: "improve the piano reader (octaves, beats, ties)"):
     notes { x, midi, beats, tie (held on from the note before) } and rests { x, rest: true, beats }.
     A note's length: whole w = 4 beats, half ˙ = 2, filled œ = 1, halved for each beam across its stem or flag on it (j eighth, r sixteenth),
     and half again for a dot after it. A tie is a curve from one note to the next on the same pitch. */
  var RESTS = { 'Œ': 1, 'Ó': 2, '‰': 0.5, '≈': 0.25, '∑': 4 };
  function staffNotes(st, pg) {
    var glyphs = pg.glyphs, lo = st.top - st.space * 5, hi = st.bottom + st.space * 5;
    var mine = glyphs.filter(function (g) { return g.y > lo && g.y < hi && g.x > st.x0 - 2 && g.x < st.x1 + 2; });
    var half = st.space / 2, headW = st.space * 1.25, out = [];
    var heads = mine.filter(function (g) { return HEADS[g.ch]; }).sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    var beforeNote = function (g) { return heads.some(function (h) { return h.x - g.x > 1 && h.x - g.x < 16 && Math.abs(g.y - h.y) < st.space * 0.7; }); };
    var keySigns = mine.filter(function (g) { return /[#b]/.test(g.ch) && !beforeNote(g); }).sort(function (a, b) { return a.x - b.x; });
    var keys = [];
    keySigns.forEach(function (g) { var k = keys[keys.length - 1]; if (k && g.x - k.last < 12 && k.ch === g.ch) { k.count++; k.last = g.x; } else keys.push({ x: g.x, last: g.x, ch: g.ch, count: 1 }); });
    keys.forEach(function (k) { k.key = {}; (k.ch === '#' ? SHARPS : FLATS).slice(0, k.count).forEach(function (l) { k.key[l] = k.ch === '#' ? 1 : -1; }); });
    var keyAt = function (x) { var key = {}; keys.forEach(function (k) { if (k.x < x) key = k.key; }); return key; };
    var barOf = function (x) { var b = 0; st.bars.forEach(function (bx) { if (bx < x) b++; }); return b; };
    var stemOf = function (h) {      // the stem on the note's right (up) or left (down) side, and where it ends
      var best = null;
      pg.stems.forEach(function (u) {
        var side = Math.abs(u.x - (h.x + headW)) < 2.6 ? 'up' : Math.abs(u.x - h.x) < 2.6 ? 'down' : null; if (!side) return;
        if (u.y0 > h.y + st.space || u.y1 < h.y - st.space * 1.2) return;
        var end = Math.abs(u.y0 - h.y) > Math.abs(u.y1 - h.y) ? u.y0 : u.y1;
        if (!best || Math.abs(end - h.y) > Math.abs(best.end - h.y)) best = { x: u.x, end: end };
      });
      return best;
    };
    var acc = {};
    heads.forEach(function (h) {
      var step = Math.round((st.bottom - h.y) / half);      // 0 = E4 on the bottom line of a treble staff
      var d = 2 + step, oct = 4 + Math.floor(d / 7), letter = ((d % 7) + 7) % 7, key = keyAt(h.x), bar = barOf(h.x);
      var a = mine.find(function (g) { return /[#bn]/.test(g.ch) && g.x < h.x - 1 && g.x > h.x - 16 && Math.abs(g.y - h.y) < st.space * 0.7; });
      if (a) acc[bar + ':' + step] = a.ch === '#' ? 1 : a.ch === 'b' ? -1 : 0;
      var alter = acc[bar + ':' + step] != null ? acc[bar + ':' + step] : (key[letter] || 0);
      var midi = 12 * (oct + 1) + STEP_MIDI[letter] + alter;
      var beats = h.ch === 'w' ? 4 : h.ch === '˙' ? 2 : 1;
      if (h.ch === 'œ') {
        var sm = stemOf(h), cuts = 0;
        if (sm) {
          pg.beams.forEach(function (b) {
            if (sm.x < b.x0 - 1.5 || sm.x > b.x1 + 1.5) return;
            var yb = b.y0 + (b.y1 - b.y0) * (sm.x - b.x0) / Math.max(1, b.x1 - b.x0);
            if (Math.abs(yb - sm.end) < st.space * 1.7) cuts++;
          });
          if (!cuts) mine.forEach(function (g) { if ((g.ch === 'j' || g.ch === 'J') && Math.abs(g.x - sm.x) < 5) cuts = Math.max(cuts, 1); if ((g.ch === 'r' || g.ch === 'R') && Math.abs(g.x - sm.x) < 5) cuts = Math.max(cuts, 2); });
        }
        beats = 1 / Math.pow(2, Math.min(cuts, 3));
      }
      if (mine.some(function (g) { return g.ch === '.' && g.x > h.x + headW * 0.6 && g.x < h.x + headW + 9 && Math.abs(g.y - h.y) < st.space * 0.8; })) beats *= 1.5;
      var prev = out[out.length - 1];
      if (prev && !prev.rest && Math.abs(prev.x - h.x) < 3) { if (midi > prev.midi) prev.midi = midi; return; }      // a chord: the top note
      out.push({ x: h.x, y: h.y, midi: midi, beats: beats, head: h.ch });
    });
    mine.forEach(function (g) {
      if (!RESTS[g.ch] || g.y < st.top - st.space || g.y > st.bottom + st.space) return;
      var b = RESTS[g.ch]; if (mine.some(function (q) { return q.ch === '.' && q.x > g.x + 2 && q.x < g.x + 12 && Math.abs(q.y - g.y) < st.space; })) b *= 1.5;
      out.push({ x: g.x, rest: true, beats: b });
    });
    out.sort(function (a, b) { return a.x - b.x; });
    // ties: a curve from just after one note to the next note on the same pitch
    for (var k = 1; k < out.length; k++) {
      var p0 = out[k - 1], p1 = out[k]; if (p0.rest || p1.rest || p0.midi !== p1.midi) continue;
      if (pg.arcs.some(function (c) { return c.x0 > p0.x - 2 && c.x0 < p0.x + headW + 7 && c.x1 > p1.x - 6 && c.x1 < p1.x + headW + 2 && Math.abs(c.y - p0.y) < st.space * 2.4; })) p1.tie = true;
    }
    return out;
  }

  /* low voices sing parts written in treble clef an octave lower (the show's lowVoices, or the teacher's own list) */
  function octaveFor(who) {
    var T = root.T, ids = T.labelChars(String(who || '').toUpperCase()).filter(function (c) { return c !== '*'; });
    var low = (T.show && T.show.lowVoices) || T.O().lowVoices || (root.DEFAULT_SHOW || {}).lowVoices || [];
    return ids.length && ids.every(function (c) { return low.indexOf(c) >= 0; }) ? -12 : 0;
  }

  /* the piano notes for a song, every part: { t, d, midi, p (staff of its bracket, 0 = top), w (who sings it) }.
     Each staff's notes are laid out by their beats between the sung syllables (from the lyrics timing), so held notes ring and rests are silent. */
  async function make(songId) {
    var T = root.T, so = T.songById(songId), scene = so && T.sceneById(so.scene), src = scene && T.scriptScene(scene);
    var item = src && src.items.find(function (it) { return it.type === 'song' && String(it.num) === String(so.num); });
    var lt = T.show.lyricTimes && T.show.lyricTimes[songId];
    if (!item || !item.lyrics.length) throw new Error('No lyrics for this song in the script.');
    if (!lt) throw new Error('Find this song’s lyrics timing first.');
    var lib = await T.loadPdfJs(), pdf = await T.Pages.doc(), pages = {}, staffs = {};
    for (var i = 0; i < item.lyrics.length; i++) {
      var l = item.lyrics[i], tm = lt.lines[i];
      var bxs = l.boxes || (l.box ? [l.box] : []);
      if (l.spoken || !bxs.length || !tm || !tm.s || !tm.s.length) continue;
      for (var bi = 0; bi < bxs.length; bi++) {
        var bx = bxs[bi];
        if (!pages[bx.n]) pages[bx.n] = await readPage(pdf, bx.n, lib);
        var pg = pages[bx.n], base = bx.y + bx.h;
        var st = pg.staves.filter(function (s) { return s.bottom < base && base - s.bottom < s.space * 12; }).sort(function (a, b) { return b.bottom - a.bottom; })[0];
        if (!st) continue;
        var sy = (l.syl || []).map(function (s, k) { return { cx: s.x + s.w / 2, t: tm.s[k], b: s.b || 0 }; }).filter(function (s) { return s.t != null && s.b === bi; });
        if (!sy.length) continue;
        var key = bx.n + ':' + st.top.toFixed(1), S = staffs[key];
        if (!S) {
          var sys = (pg.systems || []).find(function (q) { return q.staves.indexOf(st) >= 0; });
          S = staffs[key] = { st: st, pg: pg, part: sys ? sys.staves.indexOf(st) : 0, syl: [], lines: [] };
        }
        sy.forEach(function (q) { S.syl.push(q); });
        S.lines.push({ who: l.who, x0: Math.min.apply(null, sy.map(function (q) { return q.cx; })) - 30, x1: Math.max.apply(null, sy.map(function (q) { return q.cx; })) + 60, e: tm.h != null ? tm.h : tm.e });
      }
    }
    // the song's pace, for notes before the first or after the last sung syllable on a staff
    var paces = [], notes = [];
    var layout = Object.keys(staffs).map(function (key) {
      var S = staffs[key], ev = staffNotes(S.st, S.pg);
      if (!ev.length) return null;
      var minX = Math.min.apply(null, S.lines.map(function (L) { return L.x0; })), maxX = Math.max.apply(null, S.lines.map(function (L) { return L.x1; }));
      ev = ev.filter(function (e) { return e.x > minX && e.x < maxX; });
      var b = 0; ev.forEach(function (e) { e.b = b; b += e.beats; });
      var anchors = [];
      ev.forEach(function (e) {
        if (e.rest || e.tie) return;
        var hit = S.syl.find(function (q) { return Math.abs(q.cx - (e.x + S.st.space * 0.6)) < 9; });
        if (hit && (!anchors.length || hit.t > anchors[anchors.length - 1].t + 0.02)) anchors.push({ b: e.b, t: hit.t });
      });
      for (var k = 1; k < anchors.length; k++) if (anchors[k].b > anchors[k - 1].b) paces.push((anchors[k].t - anchors[k - 1].t) / (anchors[k].b - anchors[k - 1].b));
      return { S: S, ev: ev, anchors: anchors };
    }).filter(Boolean);
    paces.sort(function (a, b) { return a - b; });
    var pace = paces.length ? paces[Math.floor(paces.length / 2)] : 0.5;      // seconds per beat (the middle value)
    layout.forEach(function (Lo) {
      var A = Lo.anchors; if (!A.length) return;
      var timeAt = function (b) {      // beats on this staff -> seconds, through the sung syllables
        for (var k = 1; k < A.length; k++) if (b <= A[k].b) { var a0 = A[k - 1], a1 = A[k]; return a0.t + (a1.t - a0.t) * (b - a0.b) / Math.max(0.001, a1.b - a0.b); }
        var last = A[A.length - 1], first = A[0];
        return b < first.b ? first.t - (first.b - b) * pace : last.t + (b - last.b) * pace;
      };
      var evs = Lo.ev;
      evs.forEach(function (e, k) {
        if (e.rest || e.tie) return;
        var beats = e.beats, j = k + 1;
        while (j < evs.length && evs[j].tie && !evs[j].rest) { beats += evs[j].beats; j++; }      // tied notes ring as one
        var t = timeAt(e.b), end = timeAt(e.b + beats);
        var L = Lo.S.lines.find(function (x) { return e.x >= x.x0 && e.x <= x.x1; }) || Lo.S.lines[0];
        if (t > (L.e || Infinity) + 0.3) return;      // past the end of the singing (instrumental notes on the vocal staff)
        notes.push({ t: +t.toFixed(2), d: +Math.max(0.12, Math.min(end - t, 4)).toFixed(2), midi: e.midi + octaveFor(L.who), p: Lo.S.part, w: L.who || '' });
      });
    });
    notes.sort(function (a, b) { return a.t - b.t || a.p - b.p; });
    return notes;
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

  root.SheetMelody = { make: make, schedule: schedule, octaveFor: octaveFor, _readPage: readPage, _staffNotes: staffNotes };
})(typeof window !== 'undefined' ? window : this);
