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
        bold: bold > n / 2, italic: italic > n / 2, glyphs: glyphs, size: first.size || 12, lyric: lyric
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
    var speakers = {}, lastSong = null, lastSongItem = null, singerNow = '', pendingHeading = null, printed = null;
    var dialogueX = null;

    function emit(item) {
      if (!scene) return null;
      item.page = printed != null ? printed : null;
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
          lastSongItem = emit({ type: 'song', num: num, title: title, singers: [], lyrics: [] });
          singerNow = '';
          lastSong = num; block = null;
        } else if (!isSong && opts.keepCues) {
          emit({ type: 'cue', num: num, title: title });
        }
      }
    }

    var pageMap = [];                // [pdf page, printed number] pairs from running heads/footers
    var prevStave = false;

    for (var pi = 0; pi < pages.length && !done; pi++) {
      var page = pages[pi], lines = toLines(page), music = isMusicPage(lines);
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

        if (music) {
          if (/#\s?\d/.test(t)) cues(t);
          var lyr = line.lyric ? cleanLyric(line.lyric) : '';
          var lyricLike = lyr.replace(/[^A-Za-z]/g, '').length >= 2 && !line.italic && !/^\(/.test(lyr) && !/^[A-Z][A-Z .’',&]+:/.test(lyr);
          if (line.glyphs && !lyricLike) { prevStave = true; continue; }
          if (lyricLike && (prevStave || line.glyphs) && lastSongItem) {
            lastSongItem.lyrics.push({ who: singerNow, text: lyr, page: printed });
            prevStave = false;
            continue;
          }
          if (/^[\d\s+]*$/.test(t) || line.size >= 16) continue;          // measure numbers, the song's title banner
          // singer labels over the staves: "9 TROY:" "+ GABRIELLA, TROY:"
          var lab = t.match(/^[\d\s+]*\(?([A-Z][A-Z .’',&]*?[A-Z.])(?:\s+\d+)?\)?:\s*$/);
          if (lab && (line.size < 10 || line.bold)) {
            if (lastSongItem) splitNames(lab[1]).forEach(function (nm) { if (lastSongItem.singers.indexOf(nm) < 0) lastSongItem.singers.push(nm); });
            singerNow = lab[1].trim();
            continue;
          }
          if (prevStave) { prevStave = false; continue; }                   // anything else right under a stave
          var startsDirM = /^\(/.test(t);
          if (depth > 0 || startsDirM || line.italic) {
            if (block && block.type === 'dir' && block._open) block.text += ' ' + t;
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
            continue;
          }
          if (block && block.type === 'line' && block.overMusic) { block.text += ' ' + t; continue; }
          continue;                                                          // anything else on a music page: skip
        }

        // a centered bold name always starts a new speech, even if a ( was left open
        var midX = (line.x0 + line.x1) / 2;
        if (depth > 0 && line.bold && isCaps(t) && t.length <= 42 && Math.abs(midX - page.width / 2) < page.width * 0.12) depth = 0;

        // stage directions: anything inside ( ), or an indented italic line
        var startsDir = /^\(/.test(t);
        if (depth > 0 || startsDir || (line.italic && dialogueX != null && line.x0 > dialogueX + 12)) {
          if (block && block.type === 'dir' && block._open) block.text += ' ' + t;
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
          speaker = t.replace(/\s+/g, ' ');
          speakers[speaker] = (speakers[speaker] || 0) + 1;
          block = null;
          continue;
        }

        // dialogue
        if (dialogueX == null || line.x0 < dialogueX) dialogueX = line.x0;
        if (!speaker) { block = emit({ type: 'dir', text: t }); continue; }
        if (block && block.type === 'line' && block.who === speaker) {
          block.text = /-$/.test(block.text) && /^[a-z]/.test(t) ? block.text.slice(0, -1) + t : block.text + ' ' + t;
        } else {
          block = emit({ type: 'line', who: speaker, text: t });
        }
      }
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
      s.items.forEach(function (it) { delete it._open; it.text && (it.text = it.text.replace(/\s+/g, ' ').trim()); });
    });
    return { scenes: scenes, speakers: speakers };
  }

  /* pdf.js page -> the plain shape parse() expects. Call after page.getOperatorList() so font names resolve. */
  async function fromPdfJs(pdf, onProgress) {
    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n);
      var vp = page.getViewport({ scale: 1 });
      try { await page.getOperatorList(); } catch (e) {}
      var tc = await page.getTextContent();
      var items = tc.items.filter(function (it) { return it.str !== undefined; }).map(function (it) {
        var tr = it.transform, size = Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]);
        var font = '';
        try { var fo = page.commonObjs.get(it.fontName); font = (fo && (fo.name || fo.loadedName)) || ''; } catch (e) {}
        if (!font && tc.styles && tc.styles[it.fontName]) font = tc.styles[it.fontName].fontFamily || '';
        return { str: it.str, x: tr[4], y: vp.height - tr[5], w: it.width, size: size, font: font };
      });
      pages.push({ num: n, width: vp.width, height: vp.height, items: items });
      if (onProgress) onProgress(n, pdf.numPages);
    }
    return pages;
  }

  var api = { parse: parse, fromPdfJs: fromPdfJs, splitNames: splitNames, _toLines: toLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScriptParser = api;
})(typeof window !== 'undefined' ? window : this);
