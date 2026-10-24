/* Script reader for Broadway Junior style actor's scripts (MTI layout):
   - a speaker's name sits alone on its own line, centered, in capitals (often bold)
   - dialogue runs full width from the left margin
   - stage directions are indented and wrapped in ( ), usually italic
   - "SCENE 4: GYM – MONDAY, 8:30 A.M." starts a scene
   - "#9 – GET'CHA HEAD IN THE GAME" inside a direction is a music cue
   - pages of sheet music are skipped; a song becomes one "song" item that points to its track
   Input is plain text positions, so it works with pdf.js in the browser and with any test harness.
   It runs entirely on the teacher's own device; nothing is uploaded unencrypted. */
(function (root) {
  'use strict';

  var MUSIC_GLYPH = /[œ‰Œ¿Ó∑ˆ˙»«Ä≈¬∫]/;
  var MUSIC_GLYPH_ALL = /[œ‰Œ¿Ó∑ˆ˙»«Ä≈¬∫]/g;

  /* "Some - thing new __" printed under notes -> "Something new" */
  function cleanLyric(s) {
    return s.replace(MUSIC_GLYPH_ALL, ' ').replace(/_+/g, ' ').replace(/\s+-\s*|\s*-\s+/g, '').replace(/[–—]\s*$/, '')
      .replace(/\s+([,.!?;:])/g, '$1').replace(/(\w)\s+(n['’]t|['’](?:s|ll|re|ve|d|m))\b/g, '$1$2').replace(/\s+/g, ' ').trim()
      .replace(/(\w)\s+(er|ly|ta|na|al|y|e|ty|ry|ny|ble|tion|ing)\b(?=[\s,.!?;:]|$)/gi, '$1$2')          // a word's last syllable
      .replace(/\b(ev|un|re|pe|se|bi|hi|si|ri|de|ec|ti|be|pre|con|dis|ex)\s+(?=[a-z’']{2,})/g, '$1');      // a word's first syllable
  }
  var CUE = /#\s?(\d{1,3}[A-Z]?)\s*[–—-]\s*([A-Z0-9][A-Z0-9’'!?,&\/ ()–-]*)/g;
  var SCENE = /^SCENE\s+(\d{1,3})\s*[:.–-]\s*(.*)$/;

  function isCaps(s) {
    var letters = s.replace(/[^A-Za-z]/g, '');
    return letters.length >= 2 && letters === letters.toUpperCase();
  }
  function parenDelta(s) {
    var d = 0;
    for (var i = 0; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') d--; }
    return d;
  }

  /* items -> lines: one entry per printed line, left to right */
  function toLines(page) {
    var items = page.items.filter(function (it) { return it.str && it.str.trim(); })
      .slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var lines = [];
    items.forEach(function (it) {
      var tol = Math.max(2, (it.size || 12) * 0.3);
      var line = null;
      for (var i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
        if (Math.abs(lines[i].y - it.y) <= tol) { line = lines[i]; break; }
      }
      if (!line) { line = { y: it.y, parts: [] }; lines.push(line); }
      line.parts.push(it);
    });
    return lines.map(function (l) {
      l.parts.sort(function (a, b) { return a.x - b.x; });
      // measure numbers printed small beside lyrics are not words
      var big = Math.max.apply(null, l.parts.map(function (p) { return p.size || 12; }));
      var kept = l.parts.filter(function (p) { return !(/^[\d\s\-–+:]+$/.test(p.str) && (p.size || 12) < big * 0.8); });
      if (kept.length) l.parts = kept;
      var text = '', last = null, fonts = {}, bold = 0, italic = 0, glyphs = 0, n = 0;
      l.parts.forEach(function (p) {
        if (last) {
          var gap = p.x - (last.x + (last.w || 0));
          if (gap > (p.size || 12) * 0.12 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += ' ';
        }
        text += p.str;
        last = p;
        var f = (p.font || '').toLowerCase(), len = p.str.length;
        n += len;
        if (/bold|black|heavy|semibold/.test(f)) bold += len;
        if (/italic|oblique/.test(f)) italic += len;
        if (MUSIC_GLYPH.test(p.str)) glyphs++;
      });
      var lyricParts = l.parts.filter(function (p) { return (p.size || 12) < 14 && /[A-Za-z]/.test(p.str.replace(MUSIC_GLYPH_ALL, '')); });
      var lyric = lyricParts.map(function (p) { return p.str; }).join(' ');
      var first = l.parts[0], end = last.x + (last.w || 0);
      return {
        y: l.y, x0: first.x, x1: end, text: text.replace(/\s+/g, ' ').trim(),
        bold: bold > n / 2, italic: italic > n / 2, glyphs: glyphs, size: first.size || 12, lyric: lyric,
        parts: l.parts.map(function (p) { return { x: p.x, str: p.str, size: p.size || 12 }; }),
        syl: [].concat.apply([], lyricParts.map(function (p) {      // where each sung word or syllable sits (for the bouncing ball); an item holding two words is split by its letters
          var str = p.str.replace(MUSIC_GLYPH_ALL, ' '), w = p.w || 0, out = [], re = /[A-Za-z’'][A-Za-z’',.!?]*/g, m;
          while ((m = re.exec(str))) out.push({ x: +(p.x + w * m.index / Math.max(1, str.length)).toFixed(1), w: +(w * m[0].length / Math.max(1, str.length)).toFixed(1), t: m[0] });
          return out;
        }))
      };
    });
  }

  function isMusicPage(lines) {
    var g = 0;
    lines.forEach(function (l) { g += l.glyphs; });
    return g >= 6;
  }

  /* a printed page number from a header or footer line, e.g. "8 Disney's High School Musical JR." */
  function pageFurniture(line, page) {
    var nearEdge = line.y > page.height * 0.9 || line.y < page.height * 0.07;
    if (!nearEdge || line.text.length > 90 || SCENE.test(line.text)) return null;      // a scene can start at the very top of a page
    var m = line.text.match(/^(\d{1,3})\b/) || line.text.match(/\b(\d{1,3})$/);
    // a running head or footer has the page number; anything else this close is only furniture right at the edge (the last line of dialogue can sit near the footer)
    if (!m && line.y < page.height * 0.955 && line.y > page.height * 0.045) return null;
    return { printed: m ? +m[1] : null };
  }

  function splitNames(s) {
    return s.split(/\s*(?:,|&|\bAND\b)\s*/).map(function (x) { return x.replace(/^\+\s*/, '').trim(); }).filter(Boolean);
  }

  function parse(pages, opts) {
    opts = opts || {};
    var songNums = opts.songNumbers ? opts.songNumbers.map(String) : null;
    var stop = opts.stopPatterns || [/^actor[’']?s glossary$/i, /^show glossary$/i, /^credits and copyrights$/i];
    var scenes = [], scene = null, speaker = null, block = null, depth = 0, done = false;
    var speakers = {}, lastSong = null, lastSongItem = null, singerNow = '', singerLabs = [], nameFrag = null, pendingHeading = null, printed = null;
    var LAB = /^[\d\s+]*\(?([A-Z][A-Z .’',&]*?[A-Z.])(?:\s+\d+)?\)?:\s*$/;
    /* a lyric line, split where a singer label above it starts (Colleen: "many sung syllables were missed": a name printed partway along the staff
       starts that singer there, so the words before it still belong to the one before) */
    /* bracketed systems (Colleen 2026-10-23: staves joined by a bracket at the left are sung at the same time, so their lyrics go in order left to
       right across the system, and each staff keeps its own singer): where a line sits, the system's lyrics held until the system is done */
    var curPage = null, sysBuf = [], sysKey = null, singerByIdx = {}, labsByStaff = {};
    var trackOn = false, spokenLyric = null;      // the song's title banner has passed: the track is playing (spoken lines join the song's sections)
    function staffAt(y, below) {      // the staff a lyric sits under (below = false: the staff a label sits over)
      var sys = curPage && curPage.systems; if (!sys) return null;
      for (var a = 0; a < sys.length; a++) for (var b = 0; b < sys[a].staves.length; b++) {
        var st = sys[a].staves[b];
        if (below ? (y > st.bottom && y - st.bottom < 75) : (y < st.top && st.top - y < 45)) {
          var better = !below ? null : sys.some(function (x) { return x.staves.some(function (o) { return o !== st && y > o.bottom && o.bottom > st.bottom; }); });
          if (!better) return { sys: sys[a], st: st, idx: b, key: curPage.num + ':' + sys[a].top.toFixed(1), staffKey: curPage.num + ':' + st.top.toFixed(1), many: sys[a].staves.length > 1 };
        }
      }
      return null;
    }
    function flushSys() {
      if (!sysBuf.length) return;
      var song = sysBuf[0].song;
      sysBuf.sort(function (a, b) { return a.e.box.x - b.e.box.x || a.k - b.k; }).forEach(function (x) { song.lyrics.push(x.e); });
      sysBuf = []; sysKey = null;
    }
    function addLyric(e, loc, k) {
      if (!loc || !loc.many) { flushSys(); lastSongItem.lyrics.push(e); return; }
      if (sysKey !== loc.key || (sysBuf.length && sysBuf[0].song !== lastSongItem)) flushSys();
      sysKey = loc.key; sysBuf.push({ e: e, k: sysBuf.length + k, song: lastSongItem });
    }
    function pushLyric(line, lyr) {
      var loc = staffAt(line.y, true), syl = line.syl || [], labs = singerLabs; singerLabs = [];
      if (loc) { labs = (labsByStaff[loc.staffKey] || []).concat(labs); delete labsByStaff[loc.staffKey]; }
      var before = singerNow;
      if (loc && loc.many && singerByIdx[loc.idx] != null) singerNow = singerByIdx[loc.idx];      // each staff of a system keeps its own singer
      if (!labs.length || !syl.length) {
        var parts0 = loc && loc.many ? phrases(syl) : [syl];
        parts0.forEach(function (ps, k) { var e = entry(singerNow, ps, parts0.length > 1 ? null : lyr); if (e) addLyric(e, loc, k); });
        if (loc && loc.many) { singerByIdx[loc.idx] = singerNow; singerNow = singerByIdx[0] != null ? singerByIdx[0] : before; }      // after a system, the top staff's singer carries on
        return;
      }
      var cur = singerNow;
      labs.forEach(function (l) { if (l.plus && cur && splitNames(cur).indexOf(l.name) < 0) l.name = cur + ', ' + l.name; cur = l.name; });      // "+ TROY:" joins whoever is singing
      var runs = [];
      syl.forEach(function (x) {
        var who = singerNow || labs[0].name;
        labs.forEach(function (l) { if (x.x + x.w >= l.x - 4) who = l.name; });
        var r = runs[runs.length - 1]; if (r && r.who === who) r.syl.push(x); else runs.push({ who: who, syl: [x] });
      });
      var k = 0;
      runs.forEach(function (r) { (loc && loc.many ? phrases(r.syl) : [r.syl]).forEach(function (ps) { var e = entry(r.who, ps); if (e) addLyric(e, loc, k++); }); });
      singerNow = labs[labs.length - 1].name;
      if (loc && loc.many) { singerByIdx[loc.idx] = singerNow; singerNow = singerByIdx[0] != null ? singerByIdx[0] : singerNow; }
    }
    /* one lyric entry from a run of syllables (text: the line's own words when it is the whole line) */
    function entry(who, ps, text) {
      if (!ps.length) return text ? { who: who, text: text, page: printed, box: box, syl: [] } : null;
      var a = ps[0], z = ps[ps.length - 1], t = text || cleanLyric(ps.map(function (x) { return x.t; }).join(' '));
      if (!t.replace(/[^A-Za-z]/g, '').length) return null;
      return { who: who, text: t, page: printed, box: text ? box : { n: box.n, x: +(a.x - 1).toFixed(1), y: box.y, w: +(z.x + z.w - a.x + 2).toFixed(1), h: box.h }, syl: ps.map(strip) };
    }
    /* in a system of several staves, a staff's words broken by rests are separate phrases (the other staff can sing in between) */
    function phrases(ps) {
      var out = [], cur = [];
      ps.forEach(function (x, i) { var prev = ps[i - 1]; if (prev && x.x - (prev.x + prev.w) > 48) { out.push(cur); cur = []; } cur.push(x); });
      if (cur.length) out.push(cur);
      return out.length ? out : [ps];
    }
    var strip = function (x) { return { x: x.x, w: x.w, t: x.t }; };
    var dialogueX = null;

    /* where each item sits on the PDF page (pdf page number, x, y from the top, width, height), so the app can highlight the real pages */
    var box = null, nameBox = null;
    var addBox = function (it) { if (it && box) (it.boxes = it.boxes || []).push(box); };
    function emit(item) {
      if (!scene) return null;
      item.page = printed != null ? printed : null;
      if (item.type === 'line' && nameBox) { item.boxes = [nameBox]; item.named = 1; nameBox = null; }
      addBox(item);
      scene.items.push(item);
      return item;
    }
    function cues(text, musicNext) {
      CUE.lastIndex = 0;
      var m;
      while ((m = CUE.exec(text))) {
        var num = m[1], title = m[2].replace(/\s+[A-Z]$/, '').replace(/[\s,(–-]+$/, '').trim();
        var isSong = songNums ? songNums.indexOf(num) >= 0 : false;
        if (isSong && lastSong !== num) {
          flushSys();
          lastSongItem = emit({ type: 'song', num: num, title: title, singers: [], lyrics: [] });
          singerNow = ''; singerLabs = []; singerByIdx = {}; labsByStaff = {}; trackOn = false; spokenLyric = null;
          lastSong = num; block = null;
        } else if (!isSong && opts.keepCues) {
          emit({ type: 'cue', num: num, title: title });
        }
      }
    }

    var pageMap = [];                // [pdf page, printed number] pairs from running heads/footers
    var prevStave = false;

    for (var pi = 0; pi < pages.length && !done; pi++) {
      var page = pages[pi], lines = toLines(page), music = isMusicPage(lines); curPage = page;
      // a page that is part music, part script (a song ends and the scene goes on): below the last staff and its lyrics is ordinary script
      var lastStave = music ? Math.max.apply(null, lines.filter(function (l) { return l.glyphs; }).map(function (l) { return l.y; }).concat([0])) : 0;
      // …and above the first song banner or staff (a scene's last lines before the song starts on the same page)
      var firstMusic = music ? Math.min.apply(null, lines.filter(function (l) { return l.glyphs || l.size >= 16; }).map(function (l) { return l.y - l.size; }).concat([1e9])) : 0;
      lines = lines.filter(function (l) {
        if (stop.some(function (re) { return re.test(l.text); })) return true;      // the glossary heading sits at the top of its page
        var f = pageFurniture(l, page);
        if (f) {
          if (f.printed != null && l.text.replace(/[^A-Za-z]/g, '').length >= 8) pageMap.push([page.num, f.printed]);
          return false;
        }
        return true;
      });
      printed = page.num;              // pdf page for now; turned into printed numbers at the end
      prevStave = false;
      if (music) depth = 0;            // an unclosed ( on sheet music never spills onto the next page
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li], t = line.text;
        box = { n: page.num, x: +line.x0.toFixed(1), y: +(line.y - line.size * 0.95).toFixed(1), w: +(line.x1 - line.x0).toFixed(1), h: +(line.size * 1.25).toFixed(1) };
        if (stop.some(function (re) { return re.test(t); })) { done = true; break; }

        if (pendingHeading) {          // a scene heading that wrapped to a second line
          if (isCaps(t) && t.length < 60 && !/^\(/.test(t)) { scene.place += ' ' + t; pendingHeading = null; continue; }
          pendingHeading = null;
        }
        var sm = t.match(SCENE);
        if (sm) {
          scene = { num: +sm[1], heading: t, place: sm[2].trim(), page: page.num, items: [] };
          scenes.push(scene);
          speaker = null; block = null; depth = 0; lastSong = null;
          if (/[–—-]\s*$/.test(t)) pendingHeading = true;
          continue;
        }
        if (!scene) continue;

        if (music && !(line.y > lastStave + 45 && !prevStave) && !(line.y < firstMusic - 4 && !/^[A-Z][A-Z .’',&]+:/.test(t))) {
          if (/#\s?\d/.test(t)) cues(t);
          var lyr = line.lyric ? cleanLyric(line.lyric) : '';
          // the words on the line (music symbols left out): singer labels, or the first half of a label split over two lines ("SHARPAY," / "RYAN:")
          var words = (line.parts || []).filter(function (p) { return p.size < 14 && p.str.trim() && !/^[\d\s+\-–]+$/.test(p.str); });
          var labs = words.map(function (p) { var m = p.str.trim().match(LAB); return m ? { name: m[1].trim(), x: p.x, plus: /^[\d\s]*\+/.test(p.str) } : null; });
          var fragLine = words.length && words.every(function (p) { return /^\+?\s*\(?[A-Z][A-Z .’'&]*[A-Z.]\)?,$/.test(p.str.trim()); });
          var labLine = words.length && labs.every(Boolean);
          if (words.length && !labLine) {      // one label printed in pieces ("MS." "DARBUS:")
            var joined = words.map(function (p) { return p.str.trim(); }).join(' '), jm = joined.match(LAB);
            if (jm) { labs = [{ name: jm[1].trim(), x: words[0].x, plus: /^[\d\s]*\+/.test(joined) }]; labLine = true; }
          }
          var lyricLike = !fragLine && !labLine && lyr.replace(/[^A-Za-z]/g, '').length >= 2 && !line.italic && !/^\(/.test(lyr) && !/^\(/.test(t) && !/#\s?\d+\s*[–-]/.test(t) && !/^[A-Z][A-Z .’',&]+:/.test(lyr);      // "(#22 – …" right under a staff is a stage direction
          if (line.glyphs && !lyricLike) { prevStave = true; continue; }
          if (lyricLike && (prevStave || line.glyphs) && lastSongItem) {
            pushLyric(line, lyr); addBox(lastSongItem);
            prevStave = false;
            continue;
          }
          if (line.size >= 16 && !labLine && !fragLine && /[A-Za-z]{3}/.test(t) && lastSongItem) trackOn = true;      // the song's title: the track starts here
          if (/^[\d\s+]*$/.test(t) || (line.size >= 16 && !labLine && !fragLine)) continue;          // measure numbers, the song's title banner (a label beside a big time signature still counts)
          // singer labels over the staves: "9 TROY:" "+ GABRIELLA, TROY:"
          // one or more labels on the line, each where it starts along the staff (a time signature or sharp on the same line doesn't matter)
          if (fragLine) { nameFrag = { name: words.map(function (p) { return p.str.trim().replace(/^\+\s*/, '').replace(/^\(/, ''); }).join(' '), x: words[0].x, plus: /^\+/.test(words[0].str.trim()) }; continue; }
          if (labLine) {
            var found = labs.map(function (l) {
              if (nameFrag && Math.abs(nameFrag.x - l.x) < 30) { l = { name: nameFrag.name + ' ' + l.name, x: Math.min(nameFrag.x, l.x), plus: nameFrag.plus || l.plus }; nameFrag = null; }
              return l;
            });
            found.forEach(function (f) { if (lastSongItem) splitNames(f.name).forEach(function (nm) { if (lastSongItem.singers.indexOf(nm) < 0) lastSongItem.singers.push(nm); }); });
            var under = staffAt(line.y, false);
            if (under) labsByStaff[under.staffKey] = (labsByStaff[under.staffKey] || []).concat(found).sort(function (a, b) { return a.x - b.x; });
            else singerLabs = singerLabs.concat(found).sort(function (a, b) { return a.x - b.x; });
            continue;
          }
          var dirLike = /^\(/.test(t) || /#\s?\d+\s*[–-]/.test(t);
          if (prevStave) { prevStave = false; if (!dirLike) continue; }        // anything else right under a stave (but a stage direction there counts)
          var startsDirM = /^\(/.test(t);
          if (depth > 0 || startsDirM || line.italic) {
            if (block && block.type === 'dir' && block._open) { block.text += ' ' + t; addBox(block); }
            else block = emit({ type: 'dir', text: t, _open: true });
            depth = Math.max(0, depth + parenDelta(t));
            if (depth === 0 && block) block._open = false;
            cues(t);
            continue;
          }
          var said = t.match(/^([A-Z][A-Z .’',&]+?):\s+(\S.*)$/);       // "TROY: words" spoken over music
          if (said) {
            speaker = said[1].trim(); speakers[speaker] = (speakers[speaker] || 0) + 1;
            block = emit({ type: 'line', who: speaker, text: said[2], overMusic: true });
            // Colleen 2026-10-23: lines spoken after the song's title are over the track: they get timed and lit up with the song's sections
            if (trackOn && lastSongItem) { spokenLyric = { who: speaker, text: said[2], page: printed, box: box, syl: [], spoken: true }; addLyric(spokenLyric, null, 0); }
            else spokenLyric = null;
            continue;
          }
          if (block && block.type === 'line' && block.overMusic) {
            block.text += ' ' + t; addBox(block);
            if (spokenLyric) { spokenLyric.text += ' ' + t; spokenLyric.boxes = (spokenLyric.boxes || [spokenLyric.box]).concat([box]); }
            continue;
          }
          continue;                                                          // anything else on a music page: skip
        }

        // a centered bold name always starts a new speech, even if a ( was left open
        var midX = (line.x0 + line.x1) / 2;
        if (depth > 0 && line.bold && isCaps(t) && t.length <= 42 && Math.abs(midX - page.width / 2) < page.width * 0.12) depth = 0;

        // stage directions: anything inside ( ), or an indented italic line
        var startsDir = /^\(/.test(t);
        if (depth > 0 || startsDir || (line.italic && dialogueX != null && line.x0 > dialogueX + 12)) {
          if (block && block.type === 'dir' && block._open) { block.text += ' ' + t; addBox(block); }
          else block = emit({ type: 'dir', text: t, _open: true });
          depth = Math.max(0, depth + parenDelta(t));
          if (depth === 0 && block) block._open = false;
          cues(t);
          continue;
        }

        // a speaker: short capitals line, centered or bold
        var center = (line.x0 + line.x1) / 2, mid = page.width / 2;
        if (isCaps(t) && t.length <= 42 && !/[:;!?]$/.test(t) && !/#\d/.test(t) &&
            (Math.abs(center - mid) < page.width * 0.12 || line.bold) && line.x0 > page.width * 0.2) {
          speaker = t.replace(/\s+/g, ' '); nameBox = box;
          speakers[speaker] = (speakers[speaker] || 0) + 1;
          block = null;
          continue;
        }

        // dialogue
        if (dialogueX == null || line.x0 < dialogueX) dialogueX = line.x0;
        if (!speaker) { block = emit({ type: 'dir', text: t }); continue; }
        if (block && block.type === 'line' && block.who === speaker) {
          block.text = /-$/.test(block.text) && /^[a-z]/.test(t) ? block.text.slice(0, -1) + t : block.text + ' ' + t; addBox(block);
        } else {
          block = emit({ type: 'line', who: speaker, text: t });
        }
      }
      flushSys();      // a system never runs past the end of a page
    }

    // pdf page -> printed page: the offset most running heads agree on
    var offs = {}, best = 0, bestN = 0;
    pageMap.forEach(function (pr) { var o = pr[0] - pr[1]; offs[o] = (offs[o] || 0) + 1; if (offs[o] > bestN) { bestN = offs[o]; best = o; } });
    var toPrinted = function (n) { return n == null ? null : (bestN ? n - best : n); };
    scenes.forEach(function (s) {
      s.page = toPrinted(s.page);
      s.items.forEach(function (it) { it.page = toPrinted(it.page); });
    });

    // a song cued in the closing direction of a scene opens the next scene
    for (var si = 0; si < scenes.length - 1; si++) {
      var its = scenes[si].items;
      for (var k = its.length - 1; k >= 0; k--) {
        if (its[k].type === 'song') {
          var tail = its.slice(k + 1);
          if (tail.every(function (x) { return x.type === 'dir'; })) {
            var song = its.splice(k, 1)[0], nx = scenes[si + 1].items;
            nx.splice(nx.length && nx[0].type === 'dir' ? 1 : 0, 0, song);
          }
          break;
        }
        if (its[k].type === 'line') break;
      }
    }

    scenes.forEach(function (s) {
      s.items.forEach(function (it) { delete it._open; it.text && (it.text = it.text.replace(/\s+/g, ' ').trim()); if (it.type === 'song') it.lyrics = poetic(it.lyrics); });
    });
    return { scenes: scenes, speakers: speakers, pages: pages.map(function (pg) { return { n: pg.num, w: pg.width, h: pg.height }; }) };
  }

  /* pdf.js page -> the plain shape parse() expects. Call after page.getOperatorList() so font names resolve. */
  /* the music on a page, from its drawing: staves (five evenly spaced long level lines) and systems (staves joined by a bracket or line at the
     left: sung at the same time, read left to right; Colleen 2026-10-23). Thin rectangles count as lines; big ones are clipping, not drawing. */
  function geometry(ops, OPS, vp) {
    var ctm = [1, 0, 0, 1, 0, 0], stack = [], segs = [];
    var mul = function (a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; };
    var ap = function (m, x, y) { return vp.convertToViewportPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]); };
    ops.fnArray.forEach(function (f, i) {
      var a = ops.argsArray[i];
      if (f === OPS.save) stack.push(ctm.slice());
      else if (f === OPS.restore) ctm = stack.pop() || ctm;
      else if (f === OPS.transform) ctm = mul(ctm, a);
      else if (f === OPS.constructPath) {
        var k = 0, cur = null, args = a[1];
        a[0].forEach(function (op) {
          if (op === OPS.moveTo) { cur = ap(ctm, args[k], args[k + 1]); k += 2; }
          else if (op === OPS.lineTo) { var p = ap(ctm, args[k], args[k + 1]); k += 2; if (cur) segs.push([cur, p]); cur = p; }
          else if (op === OPS.rectangle) {
            var p0 = ap(ctm, args[k], args[k + 1]), p1 = ap(ctm, args[k] + args[k + 2], args[k + 1] + args[k + 3]); k += 4;
            if (Math.abs(p1[1] - p0[1]) < 1.6) segs.push([[p0[0], (p0[1] + p1[1]) / 2], [p1[0], (p0[1] + p1[1]) / 2]]);
            else if (Math.abs(p1[0] - p0[0]) < 1.6) segs.push([[(p0[0] + p1[0]) / 2, p0[1]], [(p0[0] + p1[0]) / 2, p1[1]]]);
          }
          else if (op === OPS.curveTo) k += 6; else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
        });
      }
    });
    var hs = segs.filter(function (s) { return Math.abs(s[0][1] - s[1][1]) < 0.5 && Math.abs(s[0][0] - s[1][0]) > 60 && s[0][1] > -5 && s[0][1] < vp.height + 5; })
      .map(function (s) { return { y: s[0][1], x0: Math.min(s[0][0], s[1][0]), x1: Math.max(s[0][0], s[1][0]) }; }).sort(function (a, b) { return a.y - b.y; });
    // staff lines run (nearly) the width of the music; beams and the like are shorter level lines that would break the even spacing
    var longest = Math.max.apply(null, hs.map(function (h) { return h.x1 - h.x0; }).concat([0]));
    hs = hs.filter(function (h) { return h.x1 - h.x0 > Math.min(160, longest * 0.45); });
    var ys = []; hs.forEach(function (h) { var l = ys[ys.length - 1]; if (!l || h.y - l.y > 0.8) ys.push({ y: h.y, x0: h.x0, x1: h.x1 }); else { l.x0 = Math.min(l.x0, h.x0); l.x1 = Math.max(l.x1, h.x1); } });
    var staves = [];
    for (var i = 0; i + 4 < ys.length; i++) {
      var g = ys.slice(i, i + 5), sp = (g[4].y - g[0].y) / 4, even = g.every(function (l, j) { return j === 0 || Math.abs(l.y - g[j - 1].y - sp) < 0.6; });
      if (even && sp > 2 && sp < 12) { staves.push({ top: g[0].y, bottom: g[4].y, space: sp, x0: g[0].x0, x1: g[0].x1, bars: [] }); i += 4; }
    }
    var ups = segs.filter(function (s) { return Math.abs(s[0][0] - s[1][0]) < 0.6; }).map(function (s) { return { x: s[0][0], y0: Math.min(s[0][1], s[1][1]), y1: Math.max(s[0][1], s[1][1]) }; });
    // barlines: an upright line across the whole staff (in a bracketed system it runs through all its staves)
    ups.forEach(function (u) { staves.forEach(function (st) { if (u.y0 <= st.top + 1 && u.y1 >= st.bottom - 1 && u.y1 - u.y0 < 260 && u.x > st.x0 + 8 && st.bars.indexOf(u.x) < 0) st.bars.push(u.x); }); });
    staves.forEach(function (st) { st.bars.sort(function (a, b) { return a - b; }); });
    // systems: a tall line at the left edge of the staves joins the staves it spans
    var systems = staves.map(function (st) { return { top: st.top, bottom: st.bottom, staves: [st] }; });
    ups.forEach(function (u) {
      if (u.y1 - u.y0 < 30) return;
      var inSpan = systems.filter(function (sy) { return sy.staves.some(function (st) { return u.x < st.x0 + 6 && u.x > st.x0 - 12 && st.top >= u.y0 - 3 && st.bottom <= u.y1 + 3; }); });
      if (inSpan.length < 2) return;
      var merged = { top: Math.min.apply(null, inSpan.map(function (x) { return x.top; })), bottom: Math.max.apply(null, inSpan.map(function (x) { return x.bottom; })), staves: [].concat.apply([], inSpan.map(function (x) { return x.staves; })).sort(function (a, b) { return a.top - b.top; }) };
      systems = systems.filter(function (x) { return inSpan.indexOf(x) < 0; }).concat([merged]);
    });
    systems.sort(function (a, b) { return a.top - b.top; });
    return { staves: staves, systems: systems };
  }

  /* a song's words as lines of a poem (Colleen 2026-10-23: "dividing the song as you would if it were written like poetry. the end word of a
     phrase meant to complete a rhyme scheme should be the last word in a line"): the words in singing order, a line ending after a word with
     ending punctuation (. ! ? ; :), after a comma or dash once the line has 5 syllables, when the singer changes, or after 16 syllables. A line
     can run from one staff onto the next: it then has several boxes (lyric.boxes; lyric.box is the first), and each syllable knows its box (b). */
  function poetic(list) {
    var out = [], cur = null;
    var close = function () { if (cur) { var e = finishLine(cur); if (e) out.push(e); } cur = null; };
    list.forEach(function (e) {
      if (!e.syl || !e.syl.length || e.syl.some(function (x) { return x.t == null; })) { close(); out.push(e); return; }
      // a rest or a held note: a gap after a word much wider than this staff's usual space between words
      var gaps = e.syl.slice(1).map(function (x, k) { return x.x - (e.syl[k].x + e.syl[k].w); }).sort(function (a, b) { return a - b; });
      var usual = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0, wide = Math.max(28, usual * 2.4);
      e.syl.forEach(function (x, k) {
        var w = String(x.t || '');
        if (cur && cur.who !== e.who) close();
        if (cur && cur.n >= 3 && /^[A-Z]/.test(w) && !/^I(?![a-z])/.test(w) && !/^O(h|oh)?\b/.test(w)) close();      // a capital starts a line of the poem
        if (!cur) cur = { who: e.who, page: e.page, parts: [], n: 0 };
        var p = cur.parts[cur.parts.length - 1];
        if (!p || p.src !== e) { p = { src: e, syl: [] }; cur.parts.push(p); }
        p.syl.push(x); cur.n++;
        var next = e.syl[k + 1], rest = next && next.x - (x.x + x.w) > wide;
        if (/[.!?;:]["”’')]*$/.test(w) || (/[,–—]["”’')]*$/.test(w) && cur.n >= 5) || (rest && cur.n >= 3) || cur.n >= 24 || (cur.n >= 18 && rest)) close();
      });
    });
    close();
    return out;
  }
  function finishLine(cur) {
    var boxes = [], syl = [];
    cur.parts.forEach(function (p) {
      var b = p.src.box, a = p.syl[0], z = p.syl[p.syl.length - 1];
      var bx = { n: b.n, x: +(a.x - 1).toFixed(1), y: b.y, w: +(z.x + z.w - a.x + 2).toFixed(1), h: b.h }, last = boxes[boxes.length - 1];
      if (last && last.n === bx.n && Math.abs(last.y - bx.y) < 1) { var x1 = Math.max(last.x + last.w, bx.x + bx.w); last.x = Math.min(last.x, bx.x); last.w = +(x1 - last.x).toFixed(1); }
      else boxes.push(bx);
      p.syl.forEach(function (x) { syl.push({ x: x.x, w: x.w, t: x.t, b: boxes.length - 1 }); });
    });
    var text = cleanLyric(syl.map(function (x) { return x.t; }).join(' '));
    if (!text.replace(/[^A-Za-z]/g, '').length) return null;
    var e = { who: cur.who, text: text, page: cur.page, box: boxes[0], syl: syl };
    if (boxes.length > 1) e.boxes = boxes;
    return e;
  }

  async function fromPdfJs(pdf, onProgress) {
    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n);
      var vp = page.getViewport({ scale: 1 });
      var geo = null;
      try { var ops = await page.getOperatorList(); var OPS = (root.pdfjsLib && root.pdfjsLib.OPS) || null; if (OPS) geo = geometry(ops, OPS, vp); } catch (e) {}
      var tc = await page.getTextContent();
      var items = tc.items.filter(function (it) { return it.str !== undefined; }).map(function (it) {
        var tr = it.transform, size = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]);
        var font = '';
        try { var fo = page.commonObjs.get(it.fontName); font = (fo && (fo.name || fo.loadedName)) || ''; } catch (e) {}
        if (!font && tc.styles && tc.styles[it.fontName]) font = tc.styles[it.fontName].fontFamily || '';
        var pt = vp.convertToViewportPoint(tr[4], tr[5]);      // pages can have an offset origin (this script's start 20.88 points in)
        return { str: it.str, x: pt[0], y: pt[1], w: it.width, size: size, font: font };
      });
      pages.push({ num: n, width: vp.width, height: vp.height, items: items, systems: geo && geo.systems.length ? geo.systems.map(function (sy) { return { top: sy.top, bottom: sy.bottom, staves: sy.staves.map(function (st) { return { top: st.top, bottom: st.bottom, bars: st.bars.filter(function (b, i, a) { return !i || b - a[i - 1] > 4; }) }; }) }; }) : null });
      if (onProgress) onProgress(n, pdf.numPages);
    }
    return pages;
  }

  /* the reader's version: change it whenever the reading changes, and teacher mode re-reads the saved PDF on its own (Colleen: "why do i
     have to keep reimporting the pdf?") */
  var VERSION = '2026-10-23.2';
  var api = { parse: parse, fromPdfJs: fromPdfJs, splitNames: splitNames, geometry: geometry, cleanLyric: cleanLyric, VERSION: VERSION, _toLines: toLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScriptParser = api;
})(typeof window !== 'undefined' ? window : this);
