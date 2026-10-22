/* asl.cool/theatre Teacher mode: setup, script import (the PDF is read on this device only), cast, who is on stage,
   costumes, songs and tracks, passwords and backup. Every save needs the teacher password (sent as proof, never as the password). */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var PDFJS = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  T.proof = null;

  function save(msg) {
    var btns = app.querySelectorAll('[data-save]'); btns.forEach(function (b) { b.disabled = true; });
    return Store.save(T.key, T.show, T.saved, { proof: T.proof }).then(function (s) { T.saved = s; T.toast(msg || 'Saved for everyone'); })
      .catch(function (e) { T.toast(e.message, 4000); throw e; })
      .finally(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }
  T.saveShow = save;
  T.dialog = function (h, f) { return dialog(h, f); };
  function dialog(html, onOpen) {
    var d = document.createElement('dialog'); d.innerHTML = html; document.body.appendChild(d);
    var shut = d.close.bind(d);
    d.close = function () { shut(); d.remove(); };
    d.addEventListener('cancel', function (e) { e.preventDefault(); d.close(); });      // Esc
    d.showModal(); if (onOpen) onOpen(d);
    return d;
  }
  function photoFromFile(file, size) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, size / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { no(new Error('That picture would not open.')); };
      img.src = url;
    });
  }

  /* ---------- the way in ---------- */
  T.routes.teacher = function (parts) {
    var page = parts[0] || '';
    if (!T.saved) return setupPage();
    if (!T.show || !T.proof) return signIn();
    var fn = { '': home, script: scriptPage, cast: castPage, stage: stagePage, costumes: costumePage, songs: songsPage, passwords: passwordsPage }[page] || (T.teacherPages || {})[page];
    if (page === 'setup') return home();
    (fn || home)(parts.slice(1));
    window.scrollTo(0, 0);
  };

  function setupPage() {
    T.setBar('Teacher setup', '#/');
    if (T.loadError) { app.innerHTML = '<div class="card"><p class="err">' + esc(T.loadError) + '</p><p>Check the internet connection, then reload.</p></div>'; return; }
    app.innerHTML = '<form class="card" id="f" style="max-width:640px;margin:auto"><h2>Set up the show</h2>' +
      '<p>Show: <b>' + esc(window.DEFAULT_SHOW.title) + '</b></p>' +
      '<p class="muted">Two passwords. Students use the <b>cast password</b> to open the show on their iPads. The <b>teacher password</b> is only for you: it is needed to change anything. Nobody can get these back, so write them down.</p>' +
      '<label class="f">Cast password (for students)<input id="c1" type="text" autocomplete="off" autocapitalize="off" minlength="4" required></label>' +
      '<label class="f">Teacher password<input id="t1" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="f">Teacher password again<input id="t2" type="password" autocomplete="new-password" required></label>' +
      '<details><summary class="muted small">Setup code (only if you were given one)</summary><label class="f">Setup code<input id="sc" type="text" autocomplete="off"></label></details>' +
      '<p class="err" id="msg" role="alert"></p><div class="row end"><button class="btn primary" type="submit">Set up</button></div></form>';
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault();
      var c1 = val('c1'), t1 = val('t1'), t2 = val('t2'), msg = document.getElementById('msg');
      if (t1 !== t2) { msg.textContent = 'The two teacher passwords are not the same.'; return; }
      if (c1 === t1) { msg.textContent = 'Use a different password for students and for you.'; return; }
      msg.textContent = 'Setting up…';
      var doc = { v: 1, outline: clone(window.DEFAULT_SHOW), script: null, labelMap: {}, cast: [], melody: {}, tracks: {} };
      Store.newShowKey().then(function (key) {
        return Store.save(key, doc, null, { castPw: c1, newTeacherPw: t1, setup: val('sc') || undefined }).then(function (saved) {
          T.key = key; T.show = doc; T.saved = saved; Store.remember(key);
          return Store.proof(t1, saved.vsalt).then(function (p) { T.proof = p; T.go('#/teacher'); });
        });
      }).catch(function (err) { msg.textContent = err.message; });
    };
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function signIn() {
    T.setBar('Teacher mode', '#/');
    app.innerHTML = '<form class="card" id="f" style="max-width:560px;margin:40px auto"><h2>Teacher mode</h2>' +
      (T.show ? '' : '<label class="f">Cast password<input id="cp" type="password" autocapitalize="off" required></label>') +
      '<label class="f">Teacher password<input id="tp" type="password" autocomplete="current-password" required></label>' +
      '<p class="err" id="msg" role="alert"></p><div class="row end"><button class="btn primary" type="submit">Open Teacher mode</button></div></form>';
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault();
      var msg = document.getElementById('msg'); msg.textContent = 'Checking…';
      var open = T.show ? Promise.resolve() : Store.unlock(T.saved.enc, val('cp')).then(function (key) {
        return Store.decryptShow(key, T.saved.enc).then(function (doc) { T.key = key; T.show = doc; Store.remember(key); T.setMe(T.ls('me')); });
      }).catch(function () { throw new Error('That is not the cast password.'); });
      open.then(function () { return Store.proof(val('tp'), T.saved.vsalt); })
        .then(function (p) { return Store.checkTeacher(p).then(function () { T.proof = p; T.route(); }); })
        .catch(function (err) { msg.textContent = err.message; });
    };
  }

  function home() {
    T.setBar('Teacher mode', '#/');
    var O = T.O(), sc = T.show.script, nLines = 0;
    if (sc) sc.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'line') nLines++; }); });
    var trk = T.show.tracks || {}, nTr = Object.keys(trk).filter(function (k) { return trk[k].performance; }).length;
    var t = function (href, ic, name, sub) { return '<a class="tile" href="' + href + '">' + icon(ic) + '<b>' + name + '</b><span>' + sub + '</span></a>'; };
    app.innerHTML = '<h2>' + esc(O.title) + '</h2><p class="muted">Last saved ' + (T.saved.updated ? new Date(T.saved.updated).toLocaleString() : 'never') + '</p><div class="tiles">' +
      t('#/teacher/script', 'book', 'Script', sc ? nLines + ' lines in ' + sc.scenes.length + ' scenes' : 'Import the PDF') +
      t('#/teacher/cast', 'star', 'Cast', (T.show.cast || []).length + ' actors') +
      t('#/teacher/stage', 'sched', 'On stage', 'Who is on stage when') +
      t('#/teacher/costumes', 'shirt', 'Costumes', (O.costumes || []).length + ' costumes') +
      t('#/teacher/songs', 'songs', 'Songs & tracks', nTr + ' of ' + O.songs.length + ' tracks') +
      t('#/teacher/casting', 'star', 'Casting', 'Sign-ups, callbacks, cast list') +
      t('#/teacher/production', 'sched', 'Production', 'Rehearsals, who is called, attendance') +
      t('#/teacher/passwords', 'lock', 'Passwords & backup', 'Change, download, restore') +
      '</div><p class="center" style="margin-top:20px"><a class="btn" href="#/who">See it as a student</a></p>';
  }

  /* ---------- Script: import and review ---------- */
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = function () { no(new Error('Could not load the PDF reader. Check the internet.')); };
      document.head.appendChild(s);
    });
  }
  /* read a script PDF (bytes) on this device: pdf.js -> ScriptParser */
  T.readScript = function (bytes, onProgress) {
    return loadPdfJs().then(function (lib) { return lib.getDocument({ data: bytes }).promise; })
      .then(function (pdf) { return ScriptParser.fromPdfJs(pdf, onProgress); })
      .then(function (pages) { return ScriptParser.parse(pages, { songNumbers: T.O().songs.map(function (s) { return s.num; }) }); });
  };
  function scriptPage(args) {
    if (args[0]) return sceneEdit(args[0]);
    T.setBar('Script', '#/teacher');
    var sc = T.show.script;
    app.innerHTML = '<div class="card"><h2>Import the script</h2><p>Choose the actor’s script PDF. It is read on this computer only; the lines are saved encrypted, for this cast.</p>' +
      '<label class="btn primary">' + icon('book') + 'Choose the PDF<input type="file" id="pdf" accept="application/pdf,.pdf" hidden></label> <span id="prog" class="muted"></span>' +
      (sc ? '<p class="muted small">Now: ' + esc(sc.file || 'script') + ', imported ' + new Date(sc.imported).toLocaleDateString() + '. Importing again replaces the lines and keeps your key words.</p>' : '') + '</div>' +
      '<div id="labels"></div>' + (sc ? '<h2>Scenes</h2><div class="grid">' + T.O().scenes.map(function (s) {
        var x = T.scriptScene(s), n = x ? x.items.filter(function (it) { return it.type === 'line'; }).length : 0;
        return '<a class="tile" style="min-height:90px" href="#/teacher/script/' + s.id + '"><b>Scene ' + s.num + '</b><span>' + esc(s.place) + ' · ' + n + ' lines</span></a>';
      }).join('') + '</div>' : '');
    if (sc) labelsCard();
    sayCard();
    document.getElementById('pdf').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var prog = document.getElementById('prog'); prog.textContent = 'Opening…';
      f.arrayBuffer().then(function (buf) {
        return T.readScript(new Uint8Array(buf), function (n, N) { prog.textContent = 'Reading page ' + n + ' of ' + N + '…'; });
      }).then(function (r) { applyImport(r, f.name); prog.textContent = ''; })
        .catch(function (err) { prog.textContent = ''; T.toast(err.message || 'That PDF would not open.', 4000); });
    };
  }
  /* the new parse replaces the lines; key words the teacher added carry over when the line is the same */
  function applyImport(r, fileName) {
    var old = T.show.script, keys = {};
    if (old) old.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.keyWords) keys[it.who + '|' + it.text] = it.keyWords; }); });
    r.scenes.forEach(function (s) { s.items.forEach(function (it) { var k = keys[it.who + '|' + it.text]; if (k) it.keyWords = k; }); });
    var O = T.O();
    // scenes the outline does not have yet (a different show): add them, with one talking moment each
    r.scenes.forEach(function (s) {
      if (O.scenes.some(function (x) { return x.num === s.num; })) return;
      var id = 's' + s.num, parts = s.place.split(/\s+[–—-]\s+/);
      O.scenes.push({ id: id, num: s.num, place: titleCase(parts[0] || s.place), when: titleCase(parts[1] || ''), page: s.page, icon: 'stage', story: '', sensory: [] });
      var on = [];
      s.items.forEach(function (it) { if (it.type === 'line') T.labelChars(it.who).forEach(function (c) { if (c !== '*' && on.indexOf(c) < 0) on.push(c); }); });
      O.moments.push({ id: uid('k'), scene: id, minutes: 2, on: on });
    });
    O.scenes.sort(function (a, b) { return a.num - b.num; });
    T.show.script = { scenes: r.scenes, imported: new Date().toISOString(), file: fileName };
    var n = 0; r.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'line') n++; }); });
    T.toast('Read ' + r.scenes.length + ' scenes and ' + n + ' lines. Check the speaker names, then Save.', 4000);
    scriptPage([]);
    var b = document.createElement('div'); b.className = 'card'; b.innerHTML = '<div class="row"><b class="grow">Not saved yet.</b><button class="btn primary" data-save>Save the script</button></div>';
    app.insertBefore(b, app.firstChild);
    b.querySelector('button').onclick = function () { save('Script saved').then(function () { b.remove(); }); };
  }
  function titleCase(s) { return String(s).toLowerCase().replace(/(^|[\s/(-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(A|P)\.m\./gi, function (m) { return m.toUpperCase(); }); }
  /* how the read-aloud voice says words it gets wrong: the show's list plus the teacher's own (T.show.say; an empty value turns one off) */
  function sayCard() {
    var box = document.createElement('div'); box.className = 'card'; app.appendChild(box);
    var mine = T.show.say = T.show.say || {}, base = T.O().say || {};
    function draw() {
      var all = {}; Object.keys(base).forEach(function (k) { all[k] = base[k]; }); Object.keys(mine).forEach(function (k) { all[k] = mine[k]; });
      box.innerHTML = '<h2>How words are said</h2><p class="muted">If the read-aloud voice says a name or word wrong, spell it the way it sounds. Tap Hear to check.</p>' +
        '<table class="tbl"><thead><tr><th>Word</th><th>Say it like</th><th></th></tr></thead><tbody>' + Object.keys(all).filter(function (k) { return all[k]; }).sort().map(function (k) {
          return '<tr><td>' + esc(k) + '</td><td>' + esc(all[k]) + '</td><td><button class="btn small" data-hear="' + esc(k) + '">Hear</button> <button class="btn small quiet" data-del="' + esc(k) + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="row" style="margin-top:10px"><label class="f grow" style="margin:0">Word<input id="sw" placeholder="e.g. Gabriella"></label><label class="f grow" style="margin:0">Say it like<input id="sl" placeholder="e.g. Gabby ella"></label>' +
        '<button class="btn" id="sh">Hear</button><button class="btn primary" id="sa" data-save>Add</button></div>';
      box.querySelectorAll('[data-hear]').forEach(function (b) { b.onclick = function () { T.Speech.stop(); T.Speech.say(b.dataset.hear); }; });
      box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { var k = b.dataset.del; if (base[k]) mine[k] = ''; else delete mine[k]; save('Removed').then(draw); }; });
      box.querySelector('#sh').onclick = function () { var w = box.querySelector('#sw').value.trim(), l = box.querySelector('#sl').value.trim(); T.Speech.stop(); T.Speech.say(l || w); };
      box.querySelector('#sa').onclick = function () { var w = box.querySelector('#sw').value.trim(), l = box.querySelector('#sl').value.trim(); if (!w || !l) return; mine[w] = l; save('Added').then(draw); };
    }
    draw();
  }
  /* every speaker and singer label in the script, and which characters it means */
  function labelsCard() {
    var counts = {};
    T.show.script.scenes.forEach(function (s) {
      s.items.forEach(function (it) {
        var add = function (l) { l = String(l || '').toUpperCase().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); if (l) counts[l] = (counts[l] || 0) + 1; };
        if (it.type === 'line') add(it.who);
        if (it.type === 'song') { it.singers.forEach(add); it.lyrics.forEach(function (l) { add(l.who); }); }
      });
    });
    var labels = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var box = document.getElementById('labels');
    var row = function (l) {
      var ids = T.labelChars(l), set = (T.show.labelMap || {})[l];
      var shown = ids.indexOf('*') >= 0 ? '<span class="chip">Everyone on stage</span>' : ids.length ? ids.map(T.chip).join('') : set ? '<span class="muted">not a character</span>' : '<span class="err">Who is this?</span>';
      return '<tr><td><b>' + esc(l) + '</b></td><td class="muted">' + counts[l] + '</td><td>' + shown + '</td><td><button class="btn small" data-l="' + esc(l) + '">Change</button></td></tr>';
    };
    box.innerHTML = '<div class="card"><h2>Speaker names</h2><p class="muted">Each name in the script, and the character(s) it means. A name like “TROY, CHAD” counts for both.</p>' +
      '<table class="tbl"><thead><tr><th>In the script</th><th>Times</th><th>Means</th><th></th></tr></thead><tbody>' + labels.map(row).join('') + '</tbody></table>' +
      '<div class="row end" style="margin-top:12px"><button class="btn primary" data-save id="sv">Save</button></div></div>';
    document.getElementById('sv').onclick = function () { save(); };
    box.querySelectorAll('button[data-l]').forEach(function (b) { b.onclick = function () { mapLabel(b.dataset.l, function () { labelsCard(); }); }; });
  }
  function mapLabel(l, then) {
    var ids = T.labelChars(l), O = T.O();
    var d = dialog('<h2>“' + esc(l) + '” means…</h2><div class="choose" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">' +
      O.characters.map(function (c) { return '<label class="switch"><span>' + T.chip(c.id) + '</span><input type="checkbox" value="' + c.id + '"' + (ids.indexOf(c.id) >= 0 ? ' checked' : '') + '></label>'; }).join('') + '</div>' +
      '<label class="switch"><span><b>Everyone on stage</b></span><input type="checkbox" id="all"' + (ids.indexOf('*') >= 0 ? ' checked' : '') + '></label>' +
      '<label class="f">Or a new character named<input id="nc" type="text" placeholder="e.g. Waiter"></label>' +
      '<div class="row end"><button class="btn quiet" id="auto">Use the automatic match</button><button class="btn" id="none">Not a character</button><button class="btn primary" id="ok">OK</button></div>');
    var map = T.show.labelMap = T.show.labelMap || {};
    var close = function () { d.close(); then(); };
    d.querySelector('#auto').onclick = function () { delete map[l]; close(); };
    d.querySelector('#none').onclick = function () { map[l] = []; close(); };
    d.querySelector('#ok').onclick = function () {
      var nc = d.querySelector('#nc').value.trim();
      if (nc) { var id = uid('c'); O.characters.push({ id: id, name: nc, short: nc, group: 'featured', aliases: [l], desc: '' }); }
      if (d.querySelector('#all').checked) map[l] = '*';
      else { var pick = Array.from(d.querySelectorAll('input[type=checkbox][value]:checked')).map(function (x) { return x.value; }); if (nc) pick.push(id); map[l] = pick; }
      close();
    };
  }
  function sceneEdit(sceneId) {
    var scene = T.sceneById(sceneId), src = scene && T.scriptScene(scene);
    if (!src) return scriptPage([]);
    T.setBar('Scene ' + scene.num + ' lines', '#/teacher/script');
    app.innerHTML = '<div class="card"><label class="f">Plain-language story (students hear this in The Story)<textarea id="story">' + esc(scene.story || '') + '</textarea></label>' +
      '<label class="f">Heads up (sensory warnings, one per line)<textarea id="sens" style="min-height:80px">' + esc((scene.sensory || []).join('\n')) + '</textarea></label></div>' +
      '<p class="muted">Tap a line to fix it, or to add key words that must be said.</p><div class="script">' + src.items.map(function (it, i) {
        if (it.type === 'dir') return '<div class="item dir" data-i="' + i + '">' + esc(it.text) + '</div>';
        if (it.type === 'cue') return '';
        if (it.type === 'song') return '<div class="item song" data-i="' + i + '"><b>Song #' + esc(it.num) + ': ' + esc(it.title) + '</b> · ' + it.lyrics.length + ' lyric lines · singers: ' + esc(it.singers.join(', ')) + '</div>';
        var ids = T.labelChars(it.who);
        return '<div class="item line" data-i="' + i + '" style="--c:' + (ids[0] && ids[0] !== '*' ? T.color(ids[0]) : 'var(--line)') + '"><div class="who">' + esc(it.who) + (it.keyWords ? ' · key words: ' + esc(it.keyWords.join(', ')) : '') + '</div><div class="text">' + esc(it.text) + '</div></div>';
      }).join('') + '</div><div class="dock"><div class="in"><button class="btn primary" data-save id="sv">Save</button></div></div>';
    document.getElementById('sv').onclick = function () {
      scene.story = val('story'); scene.sensory = document.getElementById('sens').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      save();
    };
    app.querySelectorAll('.item').forEach(function (el) { el.onclick = function () { editItem(src, +el.dataset.i, function () { var st = val('story'), se = document.getElementById('sens').value; sceneEdit(sceneId); document.getElementById('story').value = st; document.getElementById('sens').value = se; }); }; });
  }
  function editItem(src, i, then) {
    var it = src.items[i];
    var body = it.type === 'song'
      ? '<label class="f">Who sings (names as in the script, comma between)<input id="sg" value="' + esc(it.singers.join(', ')) + '"></label>' +
        '<label class="f">Lyrics (one line each; start with WHO: to say who sings it)<textarea id="ly" style="min-height:320px">' + esc(it.lyrics.map(function (l) { return (l.who ? l.who + ': ' : '') + l.text; }).join('\n')) + '</textarea></label>'
      : '<label class="f">' + (it.type === 'line' ? 'Speaker (as in the script)' : 'Type') + (it.type === 'line' ? '<input id="who" value="' + esc(it.who) + '">' : '<input value="Stage direction" disabled>') + '</label>' +
        '<label class="f">Text<textarea id="tx">' + esc(it.text) + '</textarea></label>' +
        (it.type === 'line' ? '<label class="f">Key words that must be said (comma between)<input id="kw" value="' + esc((it.keyWords || []).join(', ')) + '"></label>' : '');
    var d = dialog('<h2>Edit</h2>' + body + '<div class="row end"><button class="btn quiet" id="del">Delete</button><span class="grow"></span><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">OK</button></div>');
    d.querySelector('#cn').onclick = function () { d.close(); };
    d.querySelector('#del').onclick = function () { if (confirm('Delete this?')) { src.items.splice(i, 1); d.close(); then(); } };
    d.querySelector('#ok').onclick = function () {
      if (it.type === 'song') {
        it.singers = d.querySelector('#sg').value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
        it.lyrics = d.querySelector('#ly').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
          var m = s.match(/^([A-Z][A-Z .’',&]*?):\s*(.*)$/); return m ? { who: m[1], text: m[2] } : { who: '', text: s };
        });
      } else {
        it.text = d.querySelector('#tx').value.trim();
        if (it.type === 'line') {
          it.who = d.querySelector('#who').value.trim().toUpperCase();
          var kw = d.querySelector('#kw').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          if (kw.length) it.keyWords = kw; else delete it.keyWords;
        }
      }
      d.close(); then();
    };
  }

  /* ---------- Cast ---------- */
  function castPage() {
    T.setBar('Cast', '#/teacher');
    var cast = T.show.cast = T.show.cast || [];
    app.innerHTML = '<div class="row"><h2 class="grow">Cast</h2><button class="btn" id="roster">Paste a class list</button><button class="btn primary" id="add">Add an actor</button></div>' +
      '<p class="muted">Students tap their picture on the iPad. Photos are made small and saved encrypted.</p><div class="choose">' + cast.map(function (c) {
        return '<button class="person" data-id="' + esc(c.id) + '">' + T.face(c) + '<b>' + esc(c.name) + '</b><span>' + (c.chars || []).map(function (id) { var x = T.charById(id); return x ? esc(x.short) : ''; }).join(', ') + ((c.chars || []).length ? '' : '<i>No role yet</i>') + (c.guest ? ' · <b>guest</b>' : '') + '</span></button>';
      }).join('') + '</div>' + (cast.length ? '' : '<p>No actors yet. Paste your class list when you get it: students can start (the whole show, the story, crews) before they have roles. Until then, students pick a character.</p>');
    document.getElementById('roster').onclick = function () {
      var d = dialog('<h2>Paste a class list</h2><p class="muted">One student per line, the way they like to be called. “Last, First” is turned around. Names already on the list are skipped. Give them roles later (tap a student).</p>' +
        '<label class="f">Names<textarea id="nl" style="min-height:240px"></textarea></label><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Add them</button></div>');
      d.querySelector('#cn').onclick = function () { d.close(); };
      d.querySelector('#ok').onclick = function () {
        var have = cast.map(function (c) { return c.name.toLowerCase(); }), n = 0;
        d.querySelector('#nl').value.split('\n').forEach(function (line) {
          var nm = line.replace(/\t.*$/, '').trim(); if (!nm) return;
          var m = nm.match(/^([^,]+),\s*(.+)$/); if (m) nm = m[2] + ' ' + m[1];
          if (have.indexOf(nm.toLowerCase()) >= 0) return;
          have.push(nm.toLowerCase()); cast.push({ id: uid('a'), name: nm, chars: [], photo: '', access: Object.assign({}, T.DEF_ACCESS) }); n++;
        });
        if (!n) { d.close(); return; }
        save(n + ' students added').then(function () { d.close(); castPage(); });
      };
    };
    document.getElementById('add').onclick = function () { editActor(null); };
    app.querySelectorAll('.person').forEach(function (b) { b.onclick = function () { editActor(cast.find(function (c) { return c.id === b.dataset.id; })); }; });
  }
  function editActor(a) {
    var isNew = !a; a = a ? clone(a) : { id: uid('a'), name: '', chars: [], photo: '', access: Object.assign({}, T.DEF_ACCESS) };
    a.access = Object.assign({}, T.DEF_ACCESS, a.access || {});
    var O = T.O(), A = a.access;
    var seg = function (k, opts) { return '<div class="seg" data-k="' + k + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (A[k] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    var sw = function (k, label) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-k="' + k + '"' + (A[k] ? ' checked' : '') + '></label>'; };
    var d = dialog('<h2>' + (isNew ? 'Add an actor' : 'Edit actor') + '</h2>' +
      '<div class="row">' + '<span id="ph">' + T.face(a, 80) + '</span><label class="btn small">Photo<input type="file" accept="image/*" id="pf" hidden></label><button class="btn small quiet" id="pr">No photo</button></div>' +
      '<label class="f">Name<input id="nm" value="' + esc(a.name) + '" autocomplete="off"></label>' +
      '<label class="f">Sizes, for costume shopping (optional)<input id="sz" value="' + esc(a.sizes || '') + '" placeholder="e.g. shirt M, pants 10, shoes 7"></label>' +
      '<label class="switch"><span><b>Guest</b> (not in the class, e.g. a dancer who joins for tech week): only on run-through, tech, dress and show days, or days you call them</span><input type="checkbox" id="gu"' + (a.guest ? ' checked' : '') + '></label>' +
      '<p><b>Plays</b></p><div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:4px 10px">' + O.characters.map(function (c) {
        return '<label class="switch"><span>' + T.chip(c.id) + '</span><input type="checkbox" value="' + c.id + '"' + (a.chars.indexOf(c.id) >= 0 ? ' checked' : '') + '></label>';
      }).join('') + '</div>' +
      '<p style="margin-top:14px"><b>Practice Lines for this actor</b></p>' +
      '<div class="switch"><span>My line on the screen</span>' + seg('show', [['auto', 'Fade'], ['line', 'Show'], ['hint', 'Hint'], ['hidden', 'Hide']]) + '</div>' +
      sw('echo', 'Echo first (the app says the line, then the actor repeats it)') +
      sw('didIt', '“I did it” button instead of the microphone (AAC, sign, or no mic)') +
      sw('sayForMe', 'Allow “Say it for me”') +
      '<div class="switch"><span>How close it must be</span>' + seg('strict', [['loose', 'Loose'], ['medium', 'Medium'], ['exact', 'Exact']]) + '</div>' +
      '<div class="row end" style="margin-top:14px">' + (isNew ? '' : '<button class="btn quiet" id="del">Remove</button><span class="grow"></span>') + '<button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Save</button></div>');
    d.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { A[b.parentNode.dataset.k] = b.dataset.v; b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
    d.querySelectorAll('input[data-k]').forEach(function (inp) { inp.onchange = function () { A[inp.dataset.k] = inp.checked; }; });
    d.querySelector('#pf').onchange = function (e) { var f = e.target.files[0]; if (f) photoFromFile(f, 240).then(function (u) { a.photo = u; d.querySelector('#ph').innerHTML = T.face(a, 80); }).catch(function (er) { T.toast(er.message); }); };
    d.querySelector('#pr').onclick = function () { a.photo = ''; d.querySelector('#ph').innerHTML = T.face(a, 80); };
    d.querySelector('#cn').onclick = function () { d.close(); };
    var cast = T.show.cast;
    if (!isNew) d.querySelector('#del').onclick = function () { if (!confirm('Remove ' + a.name + ' from the cast?')) return; T.show.cast = cast.filter(function (c) { return c.id !== a.id; }); save().then(function () { d.close(); castPage(); }); };
    d.querySelector('#ok').onclick = function () {
      a.name = d.querySelector('#nm').value.trim();
      if (d.querySelector('#gu').checked) a.guest = true; else delete a.guest;
      a.sizes = d.querySelector('#sz').value.trim(); if (!a.sizes) delete a.sizes;
      a.chars = Array.from(d.querySelectorAll('input[type=checkbox][value]:checked')).map(function (x) { return x.value; });
      if (!a.name) { T.toast('Type a name.'); return; }
      var i = cast.findIndex(function (c) { return c.id === a.id; }); if (i >= 0) cast[i] = a; else cast.push(a);
      save().then(function () { d.close(); castPage(); if (T.me && T.me.id === a.id) T.setMe({ cast: a.id }); });
    };
  }

  /* ---------- On stage grid ---------- */
  function stagePage() {
    T.setBar('On stage', '#/teacher');
    var O = T.O();
    var head = O.moments.map(function (m) {
      var s = T.sceneById(m.scene), song = m.song && T.songById(m.song);
      return '<th title="' + esc('Scene ' + s.num + ' · ' + (song ? song.title : 'talking')) + '">' + s.num + '<br>' + (song ? '🎵' : '🗣️') + '</th>';
    }).join('');
    app.innerHTML = '<p class="muted">Tap a box to put a character on stage for that moment (🗣️ talking, 🎵 a song). <b>★ Big number</b>: everyone in the ensemble and every small role is on stage for that song; tap a box to take someone off (a costume change). The minutes row is how long each talking part takes; song lengths come from the tracks.</p>' +
      '<div class="onstage"><table><thead><tr><th>Scene</th>' + head + '</tr></thead><tbody>' +
      '<tr><th title="Everyone in the ensemble and every small role joins">Big number</th>' + O.moments.map(function (m, j) { return '<td>' + (m.song ? '<button data-big="' + j + '" aria-pressed="' + !!m.big + '" aria-label="Big number">' + (m.big ? '★' : '') + '</button>' : '') + '</td>'; }).join('') + '</tr>' +
      '<tr><th>Minutes</th>' + O.moments.map(function (m, j) { return '<td>' + (m.song ? '<span class="muted">' + Math.round(T.songMinutes(T.songById(m.song))) + '</span>' : '<input inputmode="decimal" data-min="' + j + '" value="' + (m.minutes || 1) + '" aria-label="Minutes">') + '</td>'; }).join('') + '</tr>' +
      O.characters.map(function (c) {
        return '<tr style="--c:' + T.color(c.id) + '"><th>' + T.chip(c.id) + '</th>' + O.moments.map(function (m, j) {
          var on = T.onFor(m, c.id);
          return '<td><button data-c="' + c.id + '" data-j="' + j + '" aria-pressed="' + on + '" aria-label="' + esc(c.short) + ', moment ' + (j + 1) + '"></button></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><div class="dock"><div class="in"><button class="btn primary" data-save id="sv">Save</button></div></div>';
    app.querySelectorAll('.onstage td button').forEach(function (b) {
      b.onclick = function () {
        var m = O.moments[+b.dataset.j], id = b.dataset.c, was = T.onFor(m, id);
        m.out = (m.out || []).filter(function (x) { return x !== id; });
        if (was) { if (m.on !== '*' && m.on.indexOf(id) >= 0) m.on.splice(m.on.indexOf(id), 1); if (T.onFor(m, id)) m.out.push(id); }
        else if (!T.onFor(m, id)) { if (m.on === '*') m.out = m.out.filter(function (x) { return x !== id; }); else m.on.push(id); }
        if (!m.out.length) delete m.out;
        b.setAttribute('aria-pressed', T.onFor(m, id));
      };
    });
    app.querySelectorAll('button[data-big]').forEach(function (b) { b.onclick = function () { var m = O.moments[+b.dataset.big]; m.big = !m.big; if (!m.big) delete m.big; stagePage(); }; });
    app.querySelectorAll('input[data-min]').forEach(function (inp) { inp.onchange = function () { var v = parseFloat(inp.value); if (v > 0) O.moments[+inp.dataset.min].minutes = v; }; });
    document.getElementById('sv').onclick = function () { save(); };
  }

  /* ---------- Costumes ---------- */
  function costumePage() {
    T.setBar('Costumes', '#/teacher');
    var O = T.O(); O.costumes = O.costumes || [];
    app.innerHTML = '<div class="row"><h2 class="grow">Costumes</h2><button class="btn primary" id="add">Add a costume</button></div>' +
      O.characters.map(function (c) {
        var list = O.costumes.filter(function (x) { return x.who === c.id; });
        if (!list.length) return '';
        return '<div class="card"><h3>' + T.chip(c.id) + '</h3>' + list.map(function (x) {
          return '<div class="switch" style="cursor:pointer" data-id="' + esc(x.id) + '"><span><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.items.join(', ')) + '</span></span><span class="muted small">' + x.moments.length + ' moments</span></div>';
        }).join('') + '</div>';
      }).join('');
    document.getElementById('add').onclick = function () { editCostume(null); };
    app.querySelectorAll('[data-id]').forEach(function (el) { el.onclick = function () { editCostume(O.costumes.find(function (x) { return x.id === el.dataset.id; })); }; });
  }
  function editCostume(x) {
    var O = T.O(), isNew = !x; x = x ? clone(x) : { id: uid('c-'), who: O.characters[0].id, name: '', items: [], moments: [] };
    var d = dialog('<h2>' + (isNew ? 'Add a costume' : 'Edit costume') + '</h2>' +
      '<label class="f">Character<select id="who">' + O.characters.map(function (c) { return '<option value="' + c.id + '"' + (c.id === x.who ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Costume name<input id="nm" value="' + esc(x.name) + '"></label>' +
      '<label class="f">Pieces (one per line)<textarea id="it">' + esc(x.items.join('\n')) + '</textarea></label>' +
      '<div class="row"><span id="ph">' + (x.photo ? '<img src="' + esc(x.photo) + '" alt="" style="height:80px;border-radius:10px">' : '') + '</span><label class="btn small">Photo<input type="file" accept="image/*" id="pf" hidden></label></div>' +
      '<p><b>Worn during</b> <span class="muted small">(moments when this character is on stage)</span></p><div id="ms" style="max-height:240px;overflow:auto"></div>' +
      '<div class="row end" style="margin-top:14px">' + (isNew ? '' : '<button class="btn quiet" id="del">Delete</button><span class="grow"></span>') + '<button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Save</button></div>');
    var drawMoments = function () {
      var who = d.querySelector('#who').value;
      d.querySelector('#ms').innerHTML = O.moments.filter(function (m) { return T.onStage(m, [who]); }).map(function (m) {
        var s = T.sceneById(m.scene), song = m.song && T.songById(m.song);
        return '<label class="switch"><span>Scene ' + s.num + ' · ' + (song ? '🎵 ' + esc(song.title) : '🗣️ talking') + '</span><input type="checkbox" value="' + m.id + '"' + (x.moments.indexOf(m.id) >= 0 ? ' checked' : '') + '></label>';
      }).join('') || '<p class="muted">This character is not on stage yet (see On stage).</p>';
    };
    drawMoments();
    d.querySelector('#who').onchange = drawMoments;
    d.querySelector('#pf').onchange = function (e) { var f = e.target.files[0]; if (f) photoFromFile(f, 480).then(function (u) { x.photo = u; d.querySelector('#ph').innerHTML = '<img src="' + u + '" alt="" style="height:80px;border-radius:10px">'; }); };
    d.querySelector('#cn').onclick = function () { d.close(); };
    if (!isNew) d.querySelector('#del').onclick = function () { if (!confirm('Delete this costume?')) return; O.costumes = O.costumes.filter(function (c) { return c.id !== x.id; }); save().then(function () { d.close(); costumePage(); }); };
    d.querySelector('#ok').onclick = function () {
      x.who = d.querySelector('#who').value; x.name = d.querySelector('#nm').value.trim() || 'Costume';
      x.items = d.querySelector('#it').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      x.moments = Array.from(d.querySelectorAll('#ms input:checked')).map(function (i) { return i.value; });
      var i = O.costumes.findIndex(function (c) { return c.id === x.id; }); if (i >= 0) O.costumes[i] = x; else O.costumes.push(x);
      save().then(function () { d.close(); costumePage(); });
    };
  }

  /* ---------- Songs & tracks ---------- */
  function songsPage() {
    T.setBar('Songs & tracks', '#/teacher');
    var O = T.O(), tr = T.show.tracks = T.show.tracks || {}, mel = T.show.melody = T.show.melody || {};
    var links = O.links || {};
    app.innerHTML = '<div class="card"><p>Upload each song’s <b>rehearsal track</b> (with the guide vocals) and <b>performance track</b> (band only). They are saved encrypted, for this cast. MP3 works best (24 MB at most).</p>' +
      '<p class="row">' + (links.rehearsalFolder ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(links.rehearsalFolder) + '">Rehearsal tracks folder</a>' : '') + (links.performanceFolder ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(links.performanceFolder) + '">Performance tracks folder</a>' : '') + '</p>' +
      '<p class="muted small">Then <b>Make melody line</b> works out the tune from the two tracks, so students can hear a soft tone instead of the singers.</p></div>' +
      '<table class="tbl"><thead><tr><th>Song</th><th>Rehearsal (guide vocals)</th><th>Performance</th><th>Melody line</th></tr></thead><tbody>' + O.songs.map(function (s) {
        var t = tr[s.id] || {}, cell = function (kind) {
          var x = t[kind];
          return '<td>' + (x ? '<span class="tag">' + T.clock(x.dur) + '</span> ' : '<span class="muted small">none</span> ') +
            '<label class="btn small">' + (x ? 'Replace' : 'Upload') + '<input type="file" accept="audio/*,.mp3,.m4a,.wav" data-s="' + s.id + '" data-k="' + kind + '" hidden></label></td>';
        };
        var m = mel[s.id];
        return '<tr><td><b>#' + esc(s.num) + '</b> ' + esc(s.title) + '</td>' + cell('rehearsal') + cell('performance') +
          '<td>' + (m ? '<span class="tag">' + m.notes.length + ' notes</span> ' : '') + '<button class="btn small" data-mel="' + s.id + '"' + (t.rehearsal && t.performance ? '' : ' disabled title="Upload both tracks first"') + '>' + (m ? 'Make again' : 'Make melody line') + '</button></td></tr>';
      }).join('') + '</tbody></table><p id="st" class="muted" role="status"></p>';
    var st = document.getElementById('st');
    app.querySelectorAll('input[type=file][data-s]').forEach(function (inp) {
      inp.onchange = function () {
        var f = inp.files[0], id = inp.dataset.s, kind = inp.dataset.k; if (!f) return;
        st.textContent = 'Reading ' + f.name + '…';
        f.arrayBuffer().then(function (buf) {
          return T.audioCtx().decodeAudioData(buf.slice(0)).then(function (ab) {
            var ver = Date.now().toString(36);
            st.textContent = 'Uploading ' + f.name + ' (' + (f.size / 1e6).toFixed(1) + ' MB)…';
            return Store.putTrack(T.key, T.proof, id, kind, buf, ver).then(function () {
              tr[id] = tr[id] || {}; tr[id][kind] = { ver: ver, dur: Math.round(ab.duration * 10) / 10, size: f.size, name: f.name };
              if (mel[id]) delete mel[id];      // the old melody line was for the old track
              return save('Track saved');
            });
          });
        }).then(function () { songsPage(); }).catch(function (e) { st.textContent = ''; T.toast(e.message || 'That file would not open as audio.', 4000); });
      };
    });
    app.querySelectorAll('button[data-mel]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.mel, t = tr[id], ctx = T.audioCtx();
        st.textContent = 'Loading both tracks…'; b.disabled = true;
        var get = function (k) { return Store.getTrack(T.key, id, k, t[k].ver).then(function (buf) { return ctx.decodeAudioData(buf); }); };
        Promise.all([get('rehearsal'), get('performance')]).then(function (r) {
          st.textContent = 'Working out the melody… this can take a minute.';
          return new Promise(function (ok) { setTimeout(ok, 60); }).then(function () {
            var res = Melody.extract(Melody.toMono(r[0]), Melody.toMono(r[1]), r[0].sampleRate);
            mel[id] = { notes: res.notes, offset: res.offset };
            st.textContent = 'Found ' + res.notes.length + ' notes (the band cancelled out ' + Math.round(res.cancelled * 100) + '%).';
            return save('Melody line saved');
          });
        }).then(function () { var keep = st.textContent; songsPage(); document.getElementById('st').textContent = keep; })
          .catch(function (e) { b.disabled = false; st.textContent = ''; T.toast(e.message || 'Could not make the melody line.', 4000); });
      };
    });
  }

  /* ---------- Passwords & backup ---------- */
  function passwordsPage() {
    T.setBar('Passwords & backup', '#/teacher');
    app.innerHTML = '<form class="card" id="cf"><h2>Cast password</h2><p class="muted">iPads that already remember the show stay open. Use Settings › Lock this iPad on any you want closed.</p>' +
      '<label class="f">New cast password<input id="nc" type="text" autocomplete="off" autocapitalize="off" minlength="4" required></label><div class="row end"><button class="btn primary" data-save>Change the cast password</button></div></form>' +
      '<form class="card" id="tf"><h2>Teacher password</h2><label class="f">New teacher password<input id="nt1" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<label class="f">Again<input id="nt2" type="password" autocomplete="new-password" required></label><div class="row end"><button class="btn primary" data-save>Change the teacher password</button></div></form>' +
      '<div class="card"><h2>Backup</h2><p>The backup file is encrypted: it needs the cast password it had when you made it.</p><div class="row"><button class="btn" id="dl">Download a backup</button>' +
      '<label class="btn">Restore a backup<input type="file" id="ul" accept=".json,application/json" hidden></label></div></div>';
    document.getElementById('cf').onsubmit = function (e) {
      e.preventDefault();
      Store.save(T.key, T.show, T.saved, { proof: T.proof, castPw: val('nc') }).then(function (s) { T.saved = s; T.toast('Cast password changed'); document.getElementById('nc').value = ''; }).catch(function (er) { T.toast(er.message, 4000); });
    };
    document.getElementById('tf').onsubmit = function (e) {
      e.preventDefault();
      var a = val('nt1'); if (a !== val('nt2')) { T.toast('The two passwords are not the same.'); return; }
      Store.save(T.key, T.show, T.saved, { proof: T.proof, newTeacherPw: a }).then(function (s) { T.saved = s; return Store.proof(a, s.vsalt); })
        .then(function (p) { T.proof = p; T.toast('Teacher password changed'); e.target.reset(); }).catch(function (er) { T.toast(er.message, 4000); });
    };
    document.getElementById('dl').onclick = function () {
      var blob = new Blob([JSON.stringify({ theatreBackup: 1, saved: T.saved.updated, enc: T.saved.enc })], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'theatre-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    };
    document.getElementById('ul').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var b = JSON.parse(t); if (!b.theatreBackup || !b.enc) throw new Error('That is not a theatre backup.');
        var pw = prompt('The cast password this backup had:'); if (!pw) return;
        return Store.unlock(b.enc, pw).then(function (k) { return Store.decryptShow(k, b.enc); }).catch(function () { throw new Error('That cast password does not open this backup.'); })
          .then(function (doc) { if (!confirm('Replace the show with the backup from ' + new Date(b.saved).toLocaleString() + '?')) return; T.show = doc; return save('Backup restored'); });
      }).catch(function (er) { T.toast(er.message, 4000); });
    };
  }
})();
