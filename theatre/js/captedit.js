/* asl.cool/theatre: Edit the captions (Colleen 2026-10-24: "i need a place where i can edit this captioning document and add back missing lines
   and combine lines and reassign lines to characters where it's wrong, delete things that were incorrectly picked up as text, etc- give me a
   menu that lets me do all of that. try and think of any way i might need to edit text").
   Edits go into the caption copy (T.show.captionDoc, see captions.js), so the script, voices, tones and practice are not changed. The copy is
   made from the script the first time something is edited. Every change saves itself; Undo goes back one step at a time (this visit).
   For each line: change the words; who says it; sung or spoken (in songs); split it at the cursor; join it with the next; add a line after;
   move it up or down (into the next or last scene at the ends); delete it; turn it into a sound caption ([door slams]). In songs, a line's
   time can be typed or nudged; joined and split lines keep their times. Whole document: find and replace, add a sound caption, show only
   one scene, search, start over from the script. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var undo = [], view = { scene: null, q: '' }, saveT = null;
  var C = function () { return T.Captions; };
  var draft = null;      // the copy shown before the first edit: the same one is saved by the first edit, so every line keeps its id
  function shown() { return T.show.captionDoc || draft || (draft = C().docFromScript()); }
  function doc() { if (!T.show.captionDoc) { T.show.captionDoc = shown(); draft = null; } return T.show.captionDoc; }
  function snap() { undo.push(JSON.stringify(doc())); if (undo.length > 40) undo.shift(); }
  function save(msg) { clearTimeout(saveT); saveT = setTimeout(function () { T.saveShow(msg || 'Captions saved'); }, 500); }
  function changed(msg, redraw) { save(msg); if (redraw !== false) draw(); }
  var fmt = function (s) { if (s == null) return ''; var m = Math.floor(s / 60), x = s - m * 60; return m + ':' + (x < 10 ? '0' : '') + x.toFixed(1); };
  var parseT = function (v) { var m = String(v).trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/); return m ? (+(m[1] || 0)) * 60 + (+m[2]) : null; };
  /* who can say a line: every character, the groups, everyone; the label is what the script would print */
  function whoOptions(cur) {
    var O = T.O(), opts = [['', '(no name)']], seen = {};
    O.characters.filter(function (c) { return c.group !== 'helpers'; }).forEach(function (c) { var lab = (c.aliases && c.aliases[0]) || c.name.toUpperCase(); seen[lab.toUpperCase()] = 1; opts.push([lab, c.name]); });
    opts.push(['ALL', 'Everyone (ALL)']); seen.ALL = 1;
    if (cur && !seen[String(cur).toUpperCase()]) opts.push([cur, cur + ' (as read)']);
    opts.push(['__more', 'Several or other…']);
    return opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]).toUpperCase() === String(cur || '').toUpperCase() ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  /* find a row (or a song line) by id: { list, i, item, scene, song } */
  function locate(id) {
    var d = doc(), out = null;
    d.scenes.forEach(function (sc, si) { sc.rows.forEach(function (r, i) {
      if (r.id === id) out = { list: sc.rows, i: i, item: r, scene: sc, si: si };
      if (r.k === 'song') r.lines.forEach(function (l, j) { if (l.id === id) out = { list: r.lines, i: j, item: l, scene: sc, si: si, song: r }; });
    }); });
    return out;
  }
  var timeOf = function (song, l) { return C().lineTime(song.songId, l); };
  function fixTimes(song, l) { var x = timeOf(song, l); if (x) { l.t = x.t; l.e = x.end; } delete l.li; }      // keep the time it has now, as its own
  /* ---------- the actions ---------- */
  var ACT = {
    split: function (L, ta) {
      var it = L.item, txt = ta ? ta.value : it.text, at = ta ? ta.selectionStart : 0;
      if (!(at > 0 && at < txt.length)) { var mid = Math.floor(txt.length / 2), sp = txt.indexOf(' ', mid); at = sp > 0 ? sp : txt.lastIndexOf(' ', mid); }
      if (!(at > 0)) { T.toast('Put the cursor where the line should split.'); return; }
      snap();
      var a = txt.slice(0, at).trim(), b = txt.slice(at).trim(), nu = JSON.parse(JSON.stringify(it)); nu.id = C().rid(); it.text = a; nu.text = b;
      if (L.song) { var x = timeOf(L.song, it); if (x) { var cut = x.t + (x.end - x.t) * (a.length / Math.max(1, a.length + b.length)); it.t = x.t; it.e = cut; nu.t = cut; nu.e = x.end; delete it.li; delete nu.li; } }
      L.list.splice(L.i + 1, 0, nu); changed('Split into two lines');
    },
    join: function (L) {
      var nx = L.list[L.i + 1];
      if (!nx || (nx.k && nx.k !== L.item.k)) { T.toast('There is no line right after this one to join.'); return; }
      snap();
      var it = L.item;
      if (nx.who && it.who && nx.who.toUpperCase() !== it.who.toUpperCase()) it.who = it.who + ', ' + nx.who;
      it.text = (it.text + ' ' + nx.text).replace(/\s+/g, ' ').trim();
      if (L.song) {
        var a = timeOf(L.song, it), b = timeOf(L.song, nx);
        if (it.li && nx.li && it.t == null && nx.t == null) it.li = it.li.concat(nx.li);
        else if (a || b) { it.t = (a || b).t; it.e = (b || a).end; delete it.li; }
      }
      L.list.splice(L.i + 1, 1); changed('Joined');
    },
    add: function (L) {
      snap();
      var it = L.item, nu = { id: C().rid(), who: it.who || '', text: '' };
      if (L.song) { nu.spoken = !!it.spoken; var x = timeOf(L.song, it), nx = L.list[L.i + 1], y = nx && timeOf(L.song, nx); if (x) { nu.t = Math.max(x.t + 0.5, x.end); nu.e = y ? Math.max(nu.t + 0.5, y.t) : nu.t + 2; } }
      else nu.k = it.k === 'sfx' ? 'line' : it.k;
      L.list.splice(L.i + 1, 0, nu); focusId = nu.id; changed('Line added: type its words');
    },
    up: function (L) { move(L, -1); },
    down: function (L) { move(L, 1); },
    del: function (L) { snap(); L.list.splice(L.i, 1); changed('Deleted (Undo brings it back)'); },
    sfx: function (L) { snap(); var it = L.item; if (L.song) { T.toast('In a song, delete the line instead, or change its words.'); undo.pop(); return; } it.k = it.k === 'sfx' ? 'line' : 'sfx'; if (it.k === 'sfx' && !/^\[.*\]$/.test(it.text)) it.text = '[' + it.text.replace(/^\(|\)$/g, '') + ']'; changed(it.k === 'sfx' ? 'Now a sound caption' : 'Now a spoken line'); },
    sung: function (L) { snap(); L.item.spoken = !L.item.spoken; changed(L.item.spoken ? 'Spoken (no ♪)' : 'Sung (♪)'); },
    earlier: function (L) { nudge(L, -0.25); },
    later: function (L) { nudge(L, 0.25); }
  };
  function nudge(L, by) { if (!L.song) return; var x = timeOf(L.song, L.item); if (!x) { T.toast('This line has no time yet: type one.'); return; } snap(); L.item.t = Math.max(0, x.t + by); L.item.e = Math.max(L.item.t + 0.3, x.end + by); delete L.item.li; changed('Moved ' + (by < 0 ? 'earlier' : 'later') + ' by ¼ second'); }
  function move(L, dir) {
    var j = L.i + dir; snap();
    if (j >= 0 && j < L.list.length) { var x = L.list.splice(L.i, 1)[0]; L.list.splice(j, 0, x); if (L.song) { fixTimes(L.song, x); } changed('Moved'); return; }
    if (L.song) { undo.pop(); T.toast('A song line stays in its song. Cut its words and add them where they go.'); return; }
    var d = doc(), to = d.scenes[L.si + dir]; if (!to) { undo.pop(); return; }
    var y = L.list.splice(L.i, 1)[0]; if (dir < 0) to.rows.push(y); else to.rows.unshift(y);
    changed('Moved to Scene ' + to.num);
  }
  var focusId = null;
  /* ---------- the page ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.captedit = function () { if (!T.show.captionDoc) draft = null; draw(true); };
  function draw(first) {
    T.setBar('Edit the captions', '#/teacher/caphub');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › The script).</p>'; return; }
    var d = shown(), q = view.q.toLowerCase(), y = window.scrollY;
    if (view.scene == null) view.scene = d.scenes[0] ? d.scenes[0].id : '';      // one scene at a time: the whole show is over a thousand lines
    var match = function (t) { return !q || String(t || '').toLowerCase().indexOf(q) >= 0; };
    var nRows = 0;
    var row = function (it, song) {
      if (!match(it.text) && !match(it.who)) return '';
      nRows++;
      var x = song && C().lineTime(song.songId, it), sfx = it.k === 'sfx';
      return '<div class="ce-row' + (sfx ? ' sfx' : '') + (song && !it.spoken ? ' sung' : '') + '" data-id="' + it.id + '">' +
        (sfx ? '<span class="tag">Sound</span>' : '<select data-who aria-label="Who says it">' + whoOptions(it.who) + '</select>') +
        '<textarea data-text rows="1" aria-label="Words">' + esc(it.text) + '</textarea>' +
        '<div class="ce-acts">' +
        (song ? '<button type="button" class="btn small quiet" data-a="sung" title="Sung or spoken">' + (it.spoken ? '🗣 Spoken' : '♪ Sung') + '</button><span class="ce-time"><button type="button" class="btn small quiet" data-a="earlier" title="¼ second earlier">◀</button><input data-time value="' + esc(x ? fmt(x.t) : '') + '" placeholder="m:ss.s" aria-label="When it starts" title="When it starts on the band track"><button type="button" class="btn small quiet" data-a="later" title="¼ second later">▶</button></span>' : '') +
        '<button type="button" class="btn small quiet" data-a="split" title="Split at the cursor">✂ Split</button>' +
        '<button type="button" class="btn small quiet" data-a="join" title="Join with the next line">⤓ Join next</button>' +
        '<button type="button" class="btn small quiet" data-a="add" title="Add a line after this one">＋ Line after</button>' +
        '<button type="button" class="btn small quiet" data-a="up" title="Move up">↑</button><button type="button" class="btn small quiet" data-a="down" title="Move down">↓</button>' +
        (song ? '' : '<button type="button" class="btn small quiet" data-a="sfx" title="A sound, not words">' + (sfx ? '🗣 Words' : '🔔 Sound') + '</button>') +
        '<button type="button" class="btn small quiet" data-a="del" title="Delete">🗑</button></div></div>';
    };
    var body = d.scenes.filter(function (sc) { return !view.scene || sc.id === view.scene; }).map(function (sc) {
      var inner = sc.rows.map(function (r) {
        if (r.k !== 'song') return row(r);
        var ls = r.lines.map(function (l) { return row(l, r); }).join('');
        return (ls || !q) ? '<div class="ce-song"><h4>♪ #' + esc(r.num) + ' ' + esc(r.title) + (r.lines.some(function (l) { return C().lineTime(r.songId, l); }) ? '' : ' <span class="muted small">(no Lyrics timing yet: these become stills)</span>') + '</h4>' + ls + '</div>' : '';
      }).join('');
      return (inner || !q) ? '<section class="ce-scene"><h3>Scene ' + sc.num + ' · ' + esc(sc.place || '') + ' <button type="button" class="btn small quiet" data-addto="' + sc.id + '">＋ Line at the start</button> <button type="button" class="btn small quiet" data-sfxto="' + sc.id + '">＋ Sound</button></h3>' + inner + '</section>' : '';
    }).join('');
    app.innerHTML = '<div class="card noprint"><h2>' + sym('✏️') + 'Edit the captions</h2><p class="muted small">Fix anything the script reader got wrong. Changes are only for captions: the script, voices and practice stay as they are. Everything saves by itself.' + (T.show.captionDoc ? '' : ' <b>Nothing edited yet:</b> the captions are made straight from the script.') + '</p>' +
      '<div class="row" style="flex-wrap:wrap;align-items:flex-end"><label class="f" style="margin:0">Scene<select id="ces"><option value="">Every scene (slower)</option>' + d.scenes.map(function (sc) { return '<option value="' + sc.id + '"' + (view.scene === sc.id ? ' selected' : '') + '>Scene ' + sc.num + ' · ' + esc(sc.place || '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="f grow" style="margin:0;min-width:220px">Show lines with<input id="ceq" value="' + esc(view.q) + '" placeholder="words or a name"></label>' +
      '<button class="btn" id="ceu"' + (undo.length ? '' : ' disabled') + '>↶ Undo</button><button class="btn" id="cefr">Find and replace</button><button class="btn" id="cejn" title="Joins words the sheet music cut into syllables (sta tus → status) in every song">Join split words</button><a class="btn" href="#/teacher/captions">See the captions</a><button class="btn quiet" id="cer">Start over from the script</button></div>' +
      '<details class="small" style="margin-top:8px"><summary>How to…</summary><ul>' +
      '<li><b>Fix words:</b> type in the box. Joined-up or split words, spelling, a word the reader missed.</li>' +
      '<li><b>Wrong person:</b> pick who says it. “Several or other…” for two names (TROY, GABRIELLA) or a name not on the list.</li>' +
      '<li><b>A missing line:</b> ＋ Line after (or ＋ Line at the start of a scene), then type it.</li>' +
      '<li><b>One line read as two:</b> ⤓ Join next. <b>Two lines read as one:</b> click where they part, then ✂ Split.</li>' +
      '<li><b>Not words at all</b> (a stage direction, a page number, music marks): 🗑. <b>A sound the audience should know about:</b> 🔔 Sound makes it a caption like [door slams].</li>' +
      '<li><b>In the wrong place:</b> ↑ ↓ (at the top or bottom of a scene it moves into the next one).</li>' +
      '<li><b>Songs:</b> ♪ Sung / 🗣 Spoken; type when a line starts (minutes:seconds on the band track) or nudge it ◀ ▶ by a quarter second. Retiming the song in Lyrics timing still moves lines you have not timed by hand.</li></ul></details></div>' +
      (body || '<p class="card muted">No lines match.</p>');
    if (!first) window.scrollTo(0, y);
    wire();
    if (focusId) { var f = app.querySelector('[data-id="' + focusId + '"] [data-text]'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } focusId = null; }
    app.querySelectorAll('[data-text]').forEach(grow);
  }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
  function wire() {
    var $ = function (id) { return document.getElementById(id); };
    $('ces').onchange = function () { view.scene = this.value; draw(true); };
    var qt = null; $('ceq').oninput = function () { var v = this.value; clearTimeout(qt); qt = setTimeout(function () { view.q = v; draw(); var e = $('ceq'); e.focus(); e.setSelectionRange(v.length, v.length); }, 350); };
    $('ceu').onclick = function () { var s = undo.pop(); if (!s) return; T.show.captionDoc = JSON.parse(s); changed('Undone'); };
    $('cer').onclick = function () { if (!confirm('Start over from the script? Every caption edit is lost (Undo can bring them back while this page is open).')) return; snap(); T.show.captionDoc = C().docFromScript(); changed('Captions made again from the script'); };
    $('cefr').onclick = findReplace;
    $('cejn').onclick = function () {      // the script reader's word joiner, run on this copy (it does not change when the reader improves)
      snap(); var n = 0;
      doc().scenes.forEach(function (sc) { sc.rows.forEach(function (r) { if (r.k === 'song') r.lines.forEach(function (l) { var t = ScriptParser.fixLyricText(l.text); if (t !== l.text) { l.text = t; n++; } }); }); });
      if (!n) { undo.pop(); T.toast('No split words found.'); return; }
      changed(n + ' song lines fixed (Undo puts them back)');
    };
    app.querySelectorAll('[data-addto],[data-sfxto]').forEach(function (b) { b.onclick = function () {
      snap(); var sc = doc().scenes.find(function (x) { return x.id === (b.dataset.addto || b.dataset.sfxto); });
      var nu = b.dataset.sfxto ? { id: C().rid(), k: 'sfx', text: '[]' } : { id: C().rid(), k: 'line', who: '', text: '' };
      sc.rows.unshift(nu); focusId = nu.id; changed(b.dataset.sfxto ? 'Sound caption added: type the sound inside [ ]' : 'Line added: type its words');
    }; });
    app.querySelectorAll('.ce-row').forEach(function (el) {
      var id = el.dataset.id, ta = el.querySelector('[data-text]'), who = el.querySelector('[data-who]'), tm = el.querySelector('[data-time]');
      ta.oninput = function () { grow(ta); };
      ta.onchange = function () { var L = locate(id); if (!L) return; snap(); L.item.text = ta.value.replace(/\s+/g, ' ').trim(); changed('Saved', false); };
      if (who) who.onchange = function () {
        var L = locate(id); if (!L) return; var v = who.value;
        if (v === '__more') { v = prompt('Who says it? Type the names as the script does, with commas: TROY, GABRIELLA', L.item.who || ''); if (v == null) { draw(); return; } v = v.trim().toUpperCase(); }
        snap(); L.item.who = v; changed('Now said by ' + (v || 'no one named'));
      };
      if (tm) tm.onchange = function () {
        var L = locate(id); if (!L || !L.song) return; var v = parseT(tm.value); if (v == null) { T.toast('Type the time as minutes:seconds, like 1:23.5'); return; }
        snap(); var x = timeOf(L.song, L.item), len = x ? Math.max(0.5, x.end - x.t) : 2; L.item.t = v; L.item.e = v + len; delete L.item.li; changed('Time set');
      };
      el.querySelectorAll('[data-a]').forEach(function (b) { b.onmousedown = function (e) { e.preventDefault(); }; b.onclick = function () {      // keep the cursor in the words for Split
        var L = locate(id); if (!L) return;
        if (ta.value.replace(/\s+/g, ' ').trim() !== L.item.text) { L.item.text = ta.value.replace(/\s+/g, ' ').trim(); }
        ACT[b.dataset.a](L, ta);
      }; });
    });
  }
  function findReplace() {
    var dl = document.createElement('dialog'); dl.className = 'tone-dlg';
    dl.innerHTML = '<h2>Find and replace</h2><p class="muted small">In every caption’s words. Whole words only, unless you untick it.</p>' +
      '<label class="f">Find<input id="frf"></label><label class="f">Replace with<input id="frr"></label>' +
      '<label class="switch"><span>Whole words only</span><input type="checkbox" id="frw" checked></label><label class="switch"><span>Match capital letters</span><input type="checkbox" id="frc"></label>' +
      '<p id="frm" class="small"></p><div class="row end"><button class="btn quiet" id="frx">Close</button><button class="btn" id="frn">Count them</button><button class="btn primary" id="fra">Replace all</button></div>';
    document.body.appendChild(dl); dl.showModal();
    var q = function (s) { return dl.querySelector(s); };
    var re = function () { var f = q('#frf').value; if (!f) return null; var e = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(q('#frw').checked ? '(^|[^A-Za-z’\'])(' + e + ')(?=$|[^A-Za-z’\'])' : '()(' + e + ')', q('#frc').checked ? 'g' : 'gi'); };
    var each = function (fn) { doc().scenes.forEach(function (sc) { sc.rows.forEach(function (r) { if (r.k === 'song') r.lines.forEach(fn); else fn(r); }); }); };
    var count = function () { var r = re(), n = 0; if (!r) return 0; each(function (it) { n += (String(it.text).match(r) || []).length; }); return n; };
    q('#frx').onclick = function () { dl.close(); dl.remove(); };
    q('#frn').onclick = function () { q('#frm').textContent = count() + ' found.'; };
    q('#fra').onclick = function () {
      var r = re(), n = count(); if (!r || !n) { q('#frm').textContent = 'Nothing found.'; return; }
      snap(); var w = q('#frr').value; each(function (it) { it.text = String(it.text).replace(r, function (m, pre) { return pre + w; }); });
      q('#frm').textContent = 'Replaced ' + n + '.'; changed('Replaced ' + n);
    };
    dl.addEventListener('cancel', function () { dl.remove(); });
  }
})();
