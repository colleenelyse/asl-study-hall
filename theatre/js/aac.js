/* asl.cool/theatre: Lines for AAC. For students who speak with an AAC device, cast in roles where speech timing matters less.
   First built as text to copy into a device's text-to-speech (2026-10-24). Changed the same day (Colleen: "people no longer want to download
   the text and use text to speech. i want them to have access to download my eventual eleven labs files to be used on the aac by character.
   i don't have them all created yet, but plan for this eventuality"): every line is a sound file made with ElevenLabs in the character's voice
   (Teacher mode › Music and voices › Voices & recordings), numbered in show order, to load onto the device's buttons. Lines not made yet show
   ⏳ and come in by themselves once they are made.
   The teacher sees every character (#/teacher/aac) and marks which Company members use an AAC device (T.show.aacUsers[actor id] = true);
   those students, and their families, get "My AAC lines" (#/aac) with their own characters' files. Nothing is sent anywhere. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var clean = function (s) { return LineCheck.spoken(s).replace(/\s*[—–-]{1,2}\s*$/, '—').trim(); };
  var JSZIP = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  /* every spoken line in show order, with who says it: [{ scene, it, text, who, ids }] */
  function spokenLines() {
    var out = [];
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      src.items.forEach(function (it) {
        if (it.type === 'line') out.push({ scene: sc, it: it, text: clean(it.text), who: it.who, ids: T.labelChars(it.who) });
        if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.spoken) out.push({ scene: sc, it: l, text: clean(l.text), who: l.who, ids: T.labelChars(l.who), inSong: it.title || ('#' + it.num) }); });
      });
    });
    var seen = {};      // the same line found in the scene and inside the song: once
    return out.filter(function (x) { var k = x.who + '|' + x.text; if (!x.text || seen[k]) return false; seen[k] = 1; return true; });
  }
  /* a character's lines (a group's lines count for its members), each with the line before it as the cue */
  function linesFor(c) {
    var all = spokenLines(), out = [];
    all.forEach(function (x, i) {
      if (x.ids.indexOf('*') >= 0) return;
      if (T.Voices && T.Voices.removed && T.Voices.removed(T.Voices.id(x.it))) return;      // removed in Voices & recordings: not a real line
      if (!T.isMine(x.who, x.scene, [c])) return;
      var prev = all[i - 1] && all[i - 1].scene === x.scene ? all[i - 1] : null;
      out.push({ x: x, cue: prev ? prev.text.split(/\s+/).slice(-6).join(' ') : '', cueWho: prev ? prev.who : '', group: T.labelChars(x.who).length > 1 });
    });
    return out;
  }
  function soloSung(c) {      // roles that speak and never sing a line alone: easiest to play with an AAC device
    var n = 0;
    T.O().scenes.forEach(function (sc) { var src = T.scriptScene(sc); if (src) src.items.forEach(function (it) { if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (!l.spoken && l.who) { var ids = T.labelChars(l.who); if (ids.length === 1 && ids[0] === c) n++; } }); }); });
    return n;
  }
  /* the ElevenLabs file of a line: { h, ver } when made */
  var made = function (ix, l) { var h = T.Voices.id(l.x.it), e = ix.lines[h]; return e && e.tts ? { h: h, ver: e.tts } : null; };
  var getBytes = function (m) { return Store.getVoice(T.key, m.h, 'tts', m.ver); };
  var isWav = function (b) { return new Uint8Array(b.slice ? b.slice(0, 4) : b)[0] === 0x52; };      // group lines are a chorus (WAV)
  var fileName = function (ch, i, l, b) { return ch.short + ' ' + ('0' + (i + 1)).slice(-2) + ' - ' + l.x.text.split(/\s+/).slice(0, 6).join(' ').replace(/[^\w’' -]/g, '').trim() + (isWav(b) ? '.wav' : '.mp3'); };
  function listText(ch, L, ix) {
    return ch.name + ' (' + T.O().title + '): lines for an AAC device\n\nEach number is a sound file. Put them on the device in order, one button per line.\n\n' +
      L.map(function (l, i) { return (i + 1) + '. ' + (made(ix, l) ? '' : '(not made yet) ') + l.x.text + (l.cue ? '\n    after ' + (l.cueWho || '') + ': "… ' + l.cue + '"' : '\n    starts the scene') + (l.group ? '\n    said together with others' : ''); }).join('\n') + '\n';
  }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function loadZip() { return window.JSZip ? Promise.resolve(window.JSZip) : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = JSZIP; s.onload = function () { ok(window.JSZip); }; s.onerror = function () { no(new Error('The zip helper could not load. Check the Wi-Fi.')); }; document.head.appendChild(s); }); }
  /* one character's card: status, Download all (zip), the lines with ▶ and ⬇ */
  function charCard(c, ix) {
    var ch = T.charById(c), L = linesFor(c), have = L.filter(function (l) { return made(ix, l); }).length;
    return '<div class="card" data-char="' + c + '"><h3>' + T.chip(c) + ' · ' + L.length + ' line' + (L.length === 1 ? '' : 's') + '</h3>' +
      '<p>' + (have === L.length && L.length ? sym('✅') + '<b>All ' + L.length + ' lines are ready.</b>' : sym('⏳') + '<b>' + have + ' of ' + L.length + ' lines are ready.</b> The rest appear here once they are made.') + '</p>' +
      '<div class="row noprint"><button class="btn primary" data-zip="' + c + '"' + (have ? '' : ' disabled') + '>' + sym('⬇️') + (!have ? 'No sound files ready yet' : 'Download ' + (have === L.length ? 'all ' : 'the ' + have + ' ready ') + 'sound file' + (have === 1 ? '' : 's')) + '</button><button class="btn quiet" data-list="' + c + '">' + sym('📄') + 'The list of lines</button><button class="btn quiet" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<p class="muted small noprint" data-msg="' + c + '">One zip file: the lines numbered in show order (' + esc(ch.short) + ' 01, 02 …) and a list of what each one says and when it comes. Put them on the device in order, one button per line.</p>' +
      L.map(function (l, i) {
        var sc = l.x.scene, newScene = !i || L[i - 1].x.scene !== sc, m = made(ix, l);
        return (newScene ? '<h4 style="margin:14px 0 4px">Scene ' + sc.num + ' · ' + esc(sc.place) + '</h4>' : '') +
          '<div class="aac-line"><span class="aac-n">' + (i + 1) + '</span><div class="grow">' + (l.cue ? '<div class="muted small">After ' + esc(l.cueWho || '') + ': “… ' + esc(l.cue) + '”</div>' : '<div class="muted small">Starts the scene</div>') +
          '<div class="aac-text">' + esc(l.x.text) + '</div>' + (l.x.inSong ? '<div class="muted small">' + sym('🎵') + 'Spoken during the song, over the music: keep it on time</div>' : '') + (l.group ? '<div class="muted small">' + sym('👥') + 'Said together with others</div>' : '') + '</div>' +
          (m ? '<button class="btn small noprint" data-play="' + c + '|' + i + '">' + icon('play') + 'Play</button><button class="btn small noprint" data-one="' + c + '|' + i + '">' + sym('⬇️') + 'Save</button>' : '<span class="tag noprint" title="Made in Voices & recordings">⏳ not made yet</span>') + '</div>';
      }).join('') + '</div>';
  }
  function wire(ix) {
    var cache = {};
    var L = function (c) { return cache[c] || (cache[c] = linesFor(c)); };
    app.querySelectorAll('[data-play]').forEach(function (b) { b.onclick = function () { var p = b.dataset.play.split('|'), l = L(p[0])[+p[1]], m = made(ix, l); getBytes(m).then(function (bytes) { if (!bytes) throw new Error('That file did not load.'); new Audio(URL.createObjectURL(new Blob([bytes]))).play(); }).catch(function (e) { T.toast(e.message); }); }; });
    app.querySelectorAll('[data-one]').forEach(function (b) { b.onclick = function () { var p = b.dataset.one.split('|'), i = +p[1], l = L(p[0])[i], m = made(ix, l), ch = T.charById(p[0]); getBytes(m).then(function (bytes) { if (!bytes) throw new Error('That file did not load.'); download(new Blob([bytes], { type: isWav(bytes) ? 'audio/wav' : 'audio/mpeg' }), fileName(ch, i, l, bytes)); }).catch(function (e) { T.toast(e.message); }); }; });
    app.querySelectorAll('[data-list]').forEach(function (b) { b.onclick = function () { var c = b.dataset.list, ch = T.charById(c); download(new Blob([listText(ch, L(c), ix)], { type: 'text/plain' }), ch.short + ' - list of lines.txt'); }; });
    app.querySelectorAll('[data-zip]').forEach(function (b) { b.onclick = function () {
      var c = b.dataset.zip, ch = T.charById(c), lines = L(c), msg = app.querySelector('[data-msg="' + c + '"]'), folder = ch.short + ' AAC lines';
      b.disabled = true;
      loadZip().then(function (Z) {
        var zip = new Z(), got = 0;
        zip.file(folder + '/00 - list of lines.txt', listText(ch, lines, ix));
        return lines.reduce(function (p, l, i) {
          var m = made(ix, l); if (!m) return p;
          return p.then(function () { return getBytes(m); }).then(function (bytes) { if (bytes) { zip.file(folder + '/' + fileName(ch, i, l, bytes), bytes); got++; } msg.textContent = 'Gathering ' + got + '…'; });
        }, Promise.resolve()).then(function () { msg.textContent = 'Making the zip file…'; return zip.generateAsync({ type: 'blob' }); }).then(function (blob) { download(blob, folder + '.zip'); msg.textContent = 'Downloaded ' + folder + '.zip: ' + got + ' sound files and the list.'; b.disabled = false; });
      }).catch(function (e) { b.disabled = false; msg.textContent = e.message || 'It could not be downloaded.'; });
    }; });
  }
  /* ---------- Teacher: every character ---------- */
  var pick = null;
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.aac = function () {
    T.setBar('Lines for AAC', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › The script).</p>'; return; }
    app.innerHTML = '<p class="muted">Loading…</p>';
    T.Voices.refresh().then(function (ix) {
      var O = T.O(), info = O.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return { c: c, n: linesFor(c.id).length, solo: soloSung(c.id) }; }).filter(function (x) { return x.n; });
      var easy = info.filter(function (x) { return !x.solo; }), rest = info.filter(function (x) { return x.solo; });
      if (!pick || !info.some(function (x) { return x.c.id === pick; })) pick = (easy[0] || info[0]).c.id;
      var opt = function (x) { var L = linesFor(x.c.id), have = L.filter(function (l) { return made(ix, l); }).length; return '<option value="' + x.c.id + '"' + (x.c.id === pick ? ' selected' : '') + '>' + esc(x.c.name) + ' · ' + have + ' of ' + x.n + ' ready' + (x.solo ? ' · sings ' + x.solo + ' solo line' + (x.solo === 1 ? '' : 's') : '') + '</option>'; };
      var users = T.show.aacUsers || {}, cast = (T.show.cast || []).filter(function (a) { return a.chars && a.chars.length; });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('💬') + 'Lines for AAC</h2><p class="muted">Each character’s lines as sound files in their ElevenLabs voice, numbered in show order, to put on an AAC device’s buttons. Make the lines in Music and voices › Voices & recordings; they show up here as they are made.</p>' +
        '<label class="f">Character<select id="ach">' + (easy.length ? '<optgroup label="Lines, and no solo singing">' + easy.map(opt).join('') + '</optgroup>' : '') + '<optgroup label="Also sings solo lines">' + rest.map(opt).join('') + '</optgroup></select></label>' +
        '<details' + (cast.length ? '' : ' open') + '><summary><b>Who uses an AAC device</b> (' + Object.keys(users).length + ')</summary><p class="muted small">They (and their families) see “My AAC lines” on their home page, with their own characters’ sound files.</p>' +
        (cast.length ? '<div class="row" style="flex-wrap:wrap">' + cast.map(function (a) { return '<label class="chip-check"><input type="checkbox" data-user="' + a.id + '"' + (users[a.id] ? ' checked' : '') + '> ' + esc(a.name) + ' <span class="muted small">(' + a.chars.map(function (c) { var x = T.charById(c); return x ? esc(x.short) : ''; }).join(', ') + ')</span></label>'; }).join('') + '</div>' : '<p class="muted small">Add the cast first (Casting and the cast › Cast).</p>') + '</details></div>' +
        charCard(pick, ix);
      document.getElementById('ach').onchange = function () { pick = this.value; T.teacherPages.aac(); };
      app.querySelectorAll('[data-user]').forEach(function (cb) { cb.onchange = function () { var u = T.show.aacUsers = T.show.aacUsers || {}; if (cb.checked) u[cb.dataset.user] = true; else delete u[cb.dataset.user]; T.saveShow(cb.checked ? 'They will see My AAC lines' : 'Saved'); }; });
      wire(ix);
    }).catch(function (e) { app.innerHTML = '<p class="card err">' + esc(e.message || 'The recordings list did not load.') + '</p>'; });
  };
  /* ---------- Company member (and family): my own lines ---------- */
  T.aacTile = function () { return !!(T.me && T.me.id && T.show.aacUsers && T.show.aacUsers[T.me.id] && T.show.script && (T.me.chars || []).length); };
  T.studentPages = T.studentPages || {};
  T.studentPages.aac = function () {
    T.setBar('My AAC lines', '#/');
    if (!T.aacTile()) { app.innerHTML = '<p class="card">Your teacher has not set up AAC lines for you.</p>'; return; }
    app.innerHTML = '<p class="muted">Loading…</p>';
    T.Voices.load().then(function (ix) {
      var chars = T.me.chars.filter(function (c) { return linesFor(c).length; });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('💬') + 'My lines for my AAC device</h2><p class="muted">Each of your lines as a sound file in your character’s voice, numbered in show order. Download them and put one on each button, in order. Lines your teacher has not made yet show ⏳; check back for them.</p></div>' +
        (chars.length ? chars.map(function (c) { return charCard(c, ix); }).join('') : '<p class="card">You have no spoken lines.</p>');
      wire(ix);
    }).catch(function (e) { app.innerHTML = '<p class="card err">' + esc(e.message || 'Your lines did not load.') + '</p>'; });
  };
})();
