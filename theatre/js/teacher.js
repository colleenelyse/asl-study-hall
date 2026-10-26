/* asl.cool/theatre Teacher mode: setup, script import (the PDF is read on this device only), cast, who is on stage,
   costumes, songs and tracks, passwords and backup. Every save needs the teacher password (sent as proof, never as the password). */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (x) { return '<span class="sym" aria-hidden="true">' + x + '</span> '; };
  var PDFJS = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 8); };
  T.proof = null;

  function save(msg) {
    var btns = app.querySelectorAll('[data-save]'); btns.forEach(function (b) { b.disabled = true; });
    return Store.save(T.key, T.show, T.saved, { proof: T.proof }).then(function (s) { T.saved = s; T.toast(msg || 'Saved for everyone'); if (T.mailAfterSave) T.mailAfterSave(); })      // mail.js: anything new to email about?
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
    if (T.show && !T.proof && T.pass) {      // a parent or helper password: only the teacher pages its checklist allows, to look at
      if (T.passTeach(page, parts.slice(1)) && (T.teacherPages || {})[page]) {
        T.teacherPages[page](parts.slice(1)); window.scrollTo(0, 0);
        var bk = document.getElementById('back'); if (bk) { bk.hidden = false; bk.dataset.to = '#/home'; }      // back to their home, not to Teacher mode
        return;
      }
    }
    if (!T.show || !T.proof) return signIn();
    var fn = { '': home, menu: menuPage, script: scriptPage, cast: castPage, stage: stagePage, costumes: costumePage, songs: songsPage, passwords: passwordsPage }[page] || (T.teacherPages || {})[page];
    if (page === 'setup') return home();
    // the script was read by an older reader: re-read it first (on the home page), whatever page was opened (a bookmark, or a page left open)
    if (page && needsReread()) { T.toast('Updating how the script is read first (about a minute)…', 4000); location.replace('#/teacher'); return; }
    (fn || home)(parts.slice(1));
    window.scrollTo(0, 0);
  };

  function setupPage() {
    T.setBar('Teacher setup', '#/');
    if (T.loadError) { app.innerHTML = '<div class="card"><p class="err">' + esc(T.loadError) + '</p><p>Check the internet connection, then reload.</p></div>'; return; }
    app.innerHTML = '<form class="card" id="f" style="max-width:640px;margin:auto"><h2>Set up the show</h2>' +
      '<p>Show: <b>' + esc(window.DEFAULT_SHOW.title) + '</b></p>' +
      '<p class="muted">Two passwords. Company members use the <b>cast password</b> to open the show on their devices. The <b>teacher password</b> is only for you: it is needed to change anything. Nobody can get these back, so write them down.</p>' +
      '<label class="f">Cast password (for the Company)<input id="c1" type="text" autocomplete="off" autocapitalize="off" minlength="4" required></label>' +
      '<label class="f">Teacher password<input id="t1" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="f">Teacher password again<input id="t2" type="password" autocomplete="new-password" required></label>' +
      '<label class="f">Setup code (only for the first setup)<input id="sc" type="text" autocomplete="off" autocapitalize="characters" required placeholder="XXXX-XXXX-XXXX"></label>' +
      '<p class="err" id="msg" role="alert"></p><div class="row end"><button class="btn primary" type="submit">Set up</button></div></form>';
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault();
      var c1 = val('c1'), t1 = val('t1'), t2 = val('t2'), msg = document.getElementById('msg');
      if (t1 !== t2) { msg.textContent = 'The two teacher passwords are not the same.'; return; }
      if (c1 === t1) { msg.textContent = 'Use a different password for Company members and for you.'; return; }
      msg.textContent = 'Setting up…';
      var doc = { v: 1, outline: clone(window.DEFAULT_SHOW), script: null, labelMap: {}, cast: [], melody: {}, tracks: {} };
      Store.sealVault(t1, { teacher: t1, cast: c1, extra: {} }).then(function (v) { doc.vault = v; return Store.newShowKey(); }).then(function (key) {
        return Store.save(key, doc, null, { castPw: c1, newTeacherPw: t1, setup: val('sc') || undefined }).then(function (saved) {
          T.key = key; T.show = doc; T.saved = saved; Store.remember(key);
          T.tpw = t1;
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
    setTimeout(function () { var box = document.getElementById(T.show ? 'tp' : 'cp'); if (box) box.focus({ preventScroll: true }); }, 50);      // ready to type (Colleen)
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault();
      var msg = document.getElementById('msg'); msg.textContent = 'Checking…';
      var open = T.show && T.pass ? Store.decryptShow(T.key, T.saved.enc).then(function (doc) { T.show = doc; T.pass = null; T.setMe(T.ls('me')); }) :      // a parent's or helper's iPad: the full show (full names) for the teacher
        T.show ? Promise.resolve() : Store.unlock(T.saved.enc, val('cp')).then(function (key) {
        return Store.decryptShow(key, T.saved.enc).then(function (doc) { T.key = key; T.show = doc; Store.remember(key); T.setMe(T.ls('me')); });
      }).catch(function () { throw new Error('That is not the cast password.'); });
      open.then(function () { return Store.proof(val('tp'), T.saved.vsalt); })
        .then(function (p) { return Store.checkTeacher(p).then(function () { T.proof = p; T.tpw = val('tp'); T.route(); }); })
        .catch(function (err) { msg.textContent = err.message; });
    };
  }

  /* a script saved without its pages (a re-import whose PDF upload failed) while the PDF is still on the server: reconnect it */
  function recoverPdf() {
    var sc = T.show.script; if (!sc || sc.pdfVer || !sc.pages || recoverPdf.tried) return; recoverPdf.tried = true;
    var ctl = new AbortController();
    fetch('/theatre/api/pdf', { cache: 'no-store', signal: ctl.signal }).then(function (r) {
      ctl.abort(); if (!r.ok) return;
      sc.pdfVer = 'r' + Date.now().toString(36);
      return save('Script pages reconnected').then(function () { if (/^#\/teacher\/?$/.test(location.hash)) home(); });
    }).catch(function () {});
  }
  /* the script was read by an older reader: read the saved PDF again here (the same as importing it again, keeping the speaker names,
     key words, singer fixes and edited songs), then save */
  function needsReread() { var sc = T.show && T.show.script; return !!(sc && T.Pages && T.Pages.ready() && sc.reader !== ScriptParser.VERSION); }
  function rereadScript(force) {
    var sc = T.show.script; if (!sc || rereadScript.busy || !T.Pages || !T.Pages.ready() || (sc.reader === ScriptParser.VERSION && !force)) return;
    rereadScript.busy = true;
    var note = function (t) { var el = document.getElementById('reread'); if (el) { el.innerHTML = t; el.hidden = !t; } };
    T.Pages.doc().then(function (pdf) {
      return ScriptParser.fromPdfJs(pdf, function (n, N) { note(sym('🔄') + 'Updating how the script is read (the app got better at it)… page ' + n + ' of ' + N); });
    }).then(function (pages) {
      var r = ScriptParser.parse(pages, { songNumbers: T.O().songs.map(function (s) { return s.num; }) });
      var n = applyImport(r, sc.file, null, true);
      return save('Script re-read: ' + n + ' lines').then(function () { rereadScript.busy = false; note(sym('✅') + 'The script was read again with the newest reader (' + n + ' lines). Songs whose lines changed need their lyrics timing found again (Songs & tracks).'); });
    }).catch(function (e) { note(''); rereadScript.busy = false; T.toast('Could not re-read the script: ' + (e.message || e), 5000); });
  }
  /* Teacher mode in tiers (Colleen 2026-10-24: "start categorizing all the cards on the theatre app dashboard with some tiered menus for
     clarity"): the home page shows a few big groups; each opens a page with its own cards. Every card lives in one group. */
  var MENUS = [
    { id: 'script', icon: 'book', name: 'The script', sub: 'Import it, read it, who is on stage when' },
    { id: 'people', icon: 'star', name: 'Casting and the cast', sub: 'Sign-ups, callbacks, the cast list' },
    { id: 'rehearse', icon: 'sched', name: 'Rehearsals', sub: 'The plan, attendance, progress, warmups, bows, partner classes' },
    { id: 'music', icon: 'songs', name: 'Music and voices', sub: 'Tracks, ElevenLabs voices, lines for AAC' },
    { id: 'tech', icon: 'bulb', name: 'Tech and the show', sub: 'Cues, stage manager script, mics, open captions' },
    { id: 'costumes', icon: 'shirt', name: 'Costumes', sub: 'Costumes and sizes' },
    { id: 'family', icon: 'hand', name: 'Families and helpers', sub: 'Family portal, announcements, emails, volunteers, Tech Week Crew' },
    { id: 'app', icon: 'lock', name: 'The app', sub: 'View as, app use, passwords and backup' }
  ];
  var lastAll = null;
  /* a page opened from a group goes back to that group, not to the top of Teacher mode */
  var lastMenu = null, setBar0 = T.setBar;
  T.setBar = function (title, back) {
    var h = location.hash;
    if (back === '#/teacher' && lastMenu && /^#\/teacher\/./.test(h) && !/^#\/teacher\/menu\//.test(h)) back = '#/teacher/menu/' + lastMenu;
    return setBar0.apply(this, [title, back].concat([].slice.call(arguments, 2)));
  };
  function menuTile(m, all) {
    var n = all.filter(function (x) { return x[0] === m.id; }).length; if (!n) return '';
    return '<a class="tile menu" href="#/teacher/menu/' + m.id + '">' + icon(m.icon) + '<b>' + m.name + '</b><span>' + (m.id === 'family' ? '<span id="famwait">' + m.sub + '</span>' : m.sub) + '</span><span class="menu-n">' + n + ' page' + (n === 1 ? '' : 's') + ' ›</span></a>';
  }
  function menuPage(args) {
    var m = MENUS.find(function (x) { return x.id === args[0]; }); if (!m) return home();
    if (!lastAll) { home(); if (!lastAll) return; }
    lastMenu = m.id; T.setBar(m.name, '#/teacher');
    app.innerHTML = '<div class="tiles">' + lastAll.filter(function (x) { return x[0] === m.id; }).map(function (x) { return x[1]; }).join('') + '</div>' +
      '<p class="muted small center" style="margin-top:16px">' + MENUS.filter(function (x) { return x.id !== m.id; }).map(function (x) { return '<a href="#/teacher/menu/' + x.id + '">' + x.name + '</a>'; }).join(' · ') + '</p>';
    if (m.id === 'family' && T.portalWaiting) T.portalWaiting().then(function (n) { var el = document.getElementById('famwait'); if (n && el) el.textContent = n + ' new family form' + (n === 1 ? '' : 's') + ' waiting'; });
  }
  function home() {
    lastMenu = null;
    recoverPdf();
    setTimeout(rereadScript, 300);
    T.setBar('Teacher mode', '#/');
    var O = T.O(), sc = T.show.script, nLines = 0;
    if (sc) sc.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'line') nLines++; }); });
    var trk = T.show.tracks || {}, nTr = O.songs.filter(function (s) { return trk[s.id] && trk[s.id].performance; }).length;
    var t = function (href, ic, name, sub) { return '<a class="tile" href="' + href + '">' + icon(ic) + '<b>' + name + '</b><span>' + sub + '</span></a>'; };
    var all = [
      ['script', t('#/teacher/script', 'book', 'Script', sc ? nLines + ' lines in ' + sc.scenes.length + ' scenes' : 'Import the PDF')],
      ['script', (sc ? t('#/teacher/read', 'book', 'Read the script', 'The real pages, with director’s notes') : '')],
      ['tech', (sc ? t('#/teacher/cues', 'bulb', 'Cue sheet', (T.cues ? T.cues().length : 0) + ' light, sound and music cues') : '')],
      ['tech', (sc ? t('#/teacher/smscript', 'print', 'Stage manager script', 'The real pages with every cue') : '')],
      ['tech', t('#/teacher/set', 'stage', 'Set and scene changes', 'Periaktoi: 4 towers, 12 faces, 2 tables, every scene change')],
      ['tech', (T.show.script ? t('#/teacher/mics', 'speak', 'Mic plot', (T.micSettings ? T.micSettings().n : 8) + ' body mics') : '')],
      ['people', t('#/teacher/cast', 'star', 'Cast', (T.show.cast || []).length + ' actors')],
      ['app', t('#/teacher/viewas', 'stage', 'View as', 'See the app as a student, a track or a parent')],
      ['rehearse', t('#/teacher/curtain', 'star', 'Curtain call', 'Bow groups in 8-counts, the countdown, rehearse')],
      ['rehearse', t('#/teacher/megamix', 'songs', 'Megamix groups', 'Who does which section: groups change between songs; the leads rest at first')],
      ['rehearse', t('#/teacher/partners', 'sched', 'Partner classes', esc(T.partnersSummary ? T.partnersSummary() : 'Sessions with other classes, and calendar invitations'))],
      ['music', t('#/teacher/aac', 'speak', 'Lines for AAC', 'Each character’s lines as ElevenLabs sound files for an AAC device')],
      ['tech', (T.show.script ? t('#/teacher/captions', 'speak', 'Open captions', 'Song videos and line pictures for QLab: audience strip and performer view') : '')],
      ['tech', (T.show.script ? t('#/teacher/caprun', 'bulb', 'Run the captions', T.ls('capRun') === '1' ? 'This laptop is ready: open the runner' : 'One laptop, one operator, no QLab: get it ready') : '')],
      ['tech', (T.show.script ? t('#/teacher/captedit', 'book', 'Edit the captions', T.show.captionDoc ? 'Your edited caption script' : 'Fix words, who says it, missing lines') : '')],
      ['script', t('#/teacher/stage', 'sched', 'On stage', 'Who is on stage when')],
      ['costumes', t('#/teacher/costumes', 'shirt', 'Costumes', (O.costumes || []).length + ' costumes')],
      ['rehearse', t('#/teacher/react', 'star', 'React to That!', '149 announcements for warmups')],
      ['family', t('#/teacher/announce', 'bulb', 'Announcements', 'For Company members and parents; they pop up once')],
      ['family', t('#/teacher/family', 'hand', 'Family portal', '<span id="famwait">Consent, sizes, sensory needs, commitment, news</span>')],
      ['family', t('#/teacher/emails', 'speak', 'Emails', T.show.mail && T.show.mail.on ? 'Notification emails are on' : 'Set up notification emails')],
      ['costumes', t('#/teacher/sizes', 'shirt', 'Sizes', 'Recorded at school, with Enough / Not enough')],
      ['family', t('#/teacher/crew', 'hand', 'Tech Week Crew', (function (n) { return n ? n + ' application' + (n === 1 ? '' : 's') : 'Applications to help in tech and show week'; })(((T.show.crew || {}).people || []).length))],
      ['costumes', t('#/teacher/profiles', 'shirt', 'Shopping profiles', 'Each Company member’s sizes, roles and sensory needs, for the shopping trip')],
      ['family', t('#/teacher/volunteers', 'hand', 'Volunteers and donations', ((T.show.helpBoard || {}).posts || []).filter(function (p) { return !p.closed; }).length + ' needs posted')],
      ['music', t('#/teacher/songs', 'songs', 'Songs & tracks', nTr + ' of ' + O.songs.length + ' tracks')],
      ['music', t('#/teacher/voices', 'speak', 'Voices & recordings', 'ElevenLabs and Company members’ recordings')],
      ['music', (T.show.script ? t('#/teacher/listenshow', 'play', 'Listen to the show', 'Every line in order, in its voice; fix as you listen') : '')],
      ['rehearse', t('#/teacher/progress', 'check', 'Progress', 'Who practiced what')],
      ['app', t('#/teacher/usage', 'check', 'App use', 'Which pages people use most')],
      ['people', t('#/teacher/casting', 'star', 'Casting', 'Sign-ups, callbacks, cast list')],
      ['rehearse', t('#/teacher/production', 'sched', 'Production', 'Rehearsals, who is called, attendance')],
      ['app', t('#/teacher/passwords', 'lock', 'Passwords & backup', 'Change, download, restore')],
    ].filter(function (x) { return x[1]; });
    lastAll = all;
    app.innerHTML = T.showBanner() + '<p class="card small" id="reread"' + (T.show.script && T.Pages && T.Pages.ready() && T.show.script.reader !== ScriptParser.VERSION ? '' : ' hidden') + '>' + sym('🔄') + 'Updating how the script is read…</p><p class="muted">Last saved ' + (T.saved.updated ? new Date(T.saved.updated).toLocaleString() : 'never') + '</p>' + (T.sizeReminder ? T.sizeReminder('home') : '') + '<div class="tiles">' + MENUS.map(function (m) { return menuTile(m, all); }).join('') +
      '</div><p class="center" style="margin-top:20px"><a class="btn" href="#/who">See it as a Company member</a></p>';
    if (T.portalMigrate) T.portalMigrate();      // portal.js: the full dress moved to Wed Dec 8 (once)
    if (T.syncReminders) setTimeout(function () { T.syncReminders().catch(function () {}); if (T.reminderPrompt) T.reminderPrompt(); }, 1500);      // mail.js: reminder emails (asks for the teacher's OK first), to the school-account script
    if (T.portalWaiting) T.portalWaiting().then(function (n) { var el = document.getElementById('famwait'); if (n && el) el.textContent = n + ' new family form' + (n === 1 ? '' : 's') + ' waiting'; });
  }

  /* ---------- Script: import and review ---------- */
  T.loadPdfJs = function () { return loadPdfJs(); };
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
      (sc ? '<p class="muted small">Now: ' + esc(sc.file || 'script') + ', read ' + new Date(sc.imported).toLocaleDateString() + (sc.reader ? ' (reader ' + esc(sc.reader) + ')' : '') + '. Importing again replaces the lines and keeps your key words.</p>' : '') +
      (sc && T.Pages && T.Pages.ready() ? '<p class="row"><button class="btn small" id="reread2">Re-read the saved script now</button><span class="muted small">Reads the saved PDF again with the newest reader; your speaker names, singer fixes and edited songs stay.</span></p>' : '') + '</div>' +
      '<div id="labels"></div>' + (sc ? '<h2>Scenes</h2><div class="grid">' + T.O().scenes.map(function (s) {
        var x = T.scriptScene(s), n = x ? x.items.filter(function (it) { return it.type === 'line'; }).length : 0;
        return '<a class="tile" style="min-height:90px" href="#/teacher/script/' + s.id + '"><b>Scene ' + s.num + '</b><span>' + esc(s.place) + ' · ' + n + ' lines</span></a>';
      }).join('') + '</div>' : '');
    if (sc) labelsCard();
    sayCard();
    var rr = document.getElementById('reread2'); if (rr) rr.onclick = function () { rr.disabled = true; T.go('#/teacher'); setTimeout(function () { rereadScript(true); }, 400); };
    document.getElementById('pdf').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var prog = document.getElementById('prog'); prog.textContent = 'Opening…';
      var keep = null;
      f.arrayBuffer().then(function (buf) {
        keep = buf.slice(0);      // pdf.js takes the original; this copy is saved (sealed) for the page view
        return T.readScript(new Uint8Array(buf), function (n, N) { prog.textContent = 'Reading page ' + n + ' of ' + N + '…'; });
      }).then(function (r) { applyImport(r, f.name, keep); prog.textContent = ''; })
        .catch(function (err) { prog.textContent = ''; T.toast(err.message || 'That PDF would not open.', 4000); });
    };
  }
  /* the new parse replaces the lines; key words the teacher added carry over when the line is the same */
  /* the teacher's singer fixes back onto a song's lines (w: { "index|words": who }). The same line number and words first; when lines moved
     (new lines found earlier in the song), by the shift of the nearest fix that did match, and only onto the same words. Never by words alone:
     two staves often sing the same words with different singers (Colleen 2026-10-24: "they still need to maintain their character colors"). */
  T.applyWhoFixes = function (lyrics, w) {
    var keys = Object.keys(w || {}).map(function (k) { var c = k.indexOf('|'); return { i: +k.slice(0, c), text: k.slice(c + 1), who: w[k] }; }).filter(function (k) { return !isNaN(k.i); });
    var done = {}, placed = [];
    keys.forEach(function (k) { var l = lyrics[k.i]; if (l && l.text === k.text) { l.who = k.who; done[k.i] = 1; k.ok = 1; placed.push({ i: k.i, d: 0 }); } });
    var count = function (text, list) { return list.filter(function (x) { return x.text === text; }).length; };
    keys.forEach(function (k) {      // words that appear once in the song and once among the fixes: a sure match, and its shift
      if (k.ok || count(k.text, keys) !== 1 || count(k.text, lyrics) !== 1) return;
      var j = lyrics.findIndex(function (l) { return l.text === k.text; }); if (j < 0 || done[j]) return;
      lyrics[j].who = k.who; done[j] = 1; k.ok = 1; placed.push({ i: k.i, d: j - k.i });
    });
    keys.forEach(function (k) {
      if (k.ok || !placed.length) return;
      var near = placed.reduce(function (a, b) { return Math.abs(b.i - k.i) < Math.abs(a.i - k.i) ? b : a; }), j = k.i + near.d;
      if (lyrics[j] && lyrics[j].text === k.text && !done[j]) { lyrics[j].who = k.who; done[j] = 1; k.ok = 1; }
    });
  };
  function applyImport(r, fileName, pdfBytes, quiet) {
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
    // lyrics timing is kept per lyric line: a song whose lines now read differently needs its timing found again
    // songs whose sections the teacher edited (Sections on the music) stay as she left them
    var K = T.show.lyricKeep || {}, oldSongs = {}, keptMoved = {};
    (T.show.script ? T.show.script.scenes : []).forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'song') oldSongs[it.num] = it; }); });
    r.scenes.forEach(function (s) { s.items.forEach(function (it) {
      if (!(it.type === 'song' && K[it.num] && oldSongs[it.num])) return;
      var kept = oldSongs[it.num].lyrics.slice(), keys = kept.map(function (l) { return (l.who || '') + '|' + l.text; });
      kept.forEach(function (l) { if (!l.spoken && ScriptParser.fixLyricText) l.text = ScriptParser.fixLyricText(l.text); });      // words cut into syllables by the older reader, joined (2026-10-24.2)
      var so = O.songs.find(function (x) { return String(x.num) === String(it.num); }), lt = so && T.show.lyricTimes && T.show.lyricTimes[so.id];
      // spoken lines over the music the newer reader found and this edited song does not have yet: in, in page order
      var at = function (l) { return l.box ? l.box.n * 10000 + l.box.y : 1e9; };
      it.lyrics.forEach(function (l) {
        if (!l.spoken || keys.indexOf((l.who || '') + '|' + l.text) >= 0) return;
        var k = kept.findIndex(function (o) { return at(o) > at(l); }); k = k < 0 ? kept.length : k;
        kept.splice(k, 0, l); if (lt && lt.lines) lt.lines.splice(k, 0, null);      // its timing stays; the new line waits for a time
        kept.forEach(function (o, q) { if (o.sync && q > k && q - o.sync < k) o.sync++; });
        keptMoved[it.num] = true;
      });
      it.lyrics = kept;
    }); });
    var lyrN = function (scenes) { var o = {}; (scenes || []).forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'song') o[it.num] = (o[it.num] || '') + it.lyrics.map(function (l) { return l.who + '|' + l.text; }).join('/'); }); }); return o; };      // the song's lines in order: a change in their words or order needs new timing
    var was = lyrN(T.show.script && T.show.script.scenes), now = lyrN(r.scenes), LT = T.show.lyricTimes || {};
    /* a song whose lines read differently keeps its timing line by line (Colleen's timing is a lot of work): each line finds its old self by the
       same singer and words, the same place on the page, or the same words; only lines with no match wait for a new time */
    var newSongs = {}; r.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'song') newSongs[it.num] = it; }); });
    O.songs.forEach(function (so) {
      if (!LT[so.id] || was[so.num] === now[so.num] || keptMoved[so.num]) return;
      var ol = oldSongs[so.num] ? oldSongs[so.num].lyrics : [], nl = newSongs[so.num] ? newSongs[so.num].lyrics : [], ot = LT[so.id].lines || [], used = {};
      var fb = function (l) { var b = l.boxes ? l.boxes[0] : l.box; return b || null; };
      var find = function (test) { for (var i = 0; i < ol.length; i++) if (!used[i] && ot[i] && test(ol[i])) { used[i] = 1; return i; } return -1; };
      var kept = 0, lines = nl.map(function (l) {
        var b = fb(l), i = find(function (o) { return (o.who || '') + '|' + o.text === (l.who || '') + '|' + l.text; });
        if (i < 0 && b) i = find(function (o) { var c = fb(o); return c && c.n === b.n && Math.abs(c.y - b.y) < 3 && Math.abs(c.x - b.x) < 14; });
        if (i < 0) i = find(function (o) { return o.text === l.text; });
        if (i < 0) return null;
        kept++; return ot[i];
      });
      if (!kept) { delete LT[so.id]; if (T.show.sheetMelody) delete T.show.sheetMelody[so.id]; return; }
      LT[so.id].lines = lines;
    });
    // the teacher's singer fixes (Lyrics timing): the same line (by number and words), or the same words anywhere in that song
    var W = T.show.lyricWho || {};
    r.scenes.forEach(function (s) { s.items.forEach(function (it) {
      var w = it.type === 'song' && W[it.num]; if (!w) return;
      T.applyWhoFixes(it.lyrics, w);
    }); });
    var oldPdf = T.show.script && T.show.script.pdfVer;      // the saved pages keep working until the new ones are saved
    T.show.script = { scenes: r.scenes, imported: new Date().toISOString(), file: fileName, pages: r.pages, pdfVer: oldPdf || undefined, reader: ScriptParser.VERSION };
    var n = 0; r.scenes.forEach(function (s) { s.items.forEach(function (it) { if (it.type === 'line') n++; }); });
    if (quiet) return n;
    T.toast('Read ' + r.scenes.length + ' scenes and ' + n + ' lines. Check the speaker names, then Save.', 4000);
    scriptPage([]);
    var b = document.createElement('div'); b.className = 'card'; b.innerHTML = '<div class="row"><b class="grow">Not saved yet.</b><button class="btn primary" data-save>Save the script</button></div>';
    app.insertBefore(b, app.firstChild);
    b.querySelector('button').onclick = function () {
      var ver = Date.now().toString(36), btn = this; btn.disabled = true; btn.textContent = 'Saving the pages…';
      (pdfBytes ? Store.putPdf(T.key, T.proof, pdfBytes, ver).then(function () { T.show.script.pdfVer = ver; }, function (e) { T.toast('The page view could not be saved: ' + e.message, 5000); }) : Promise.resolve())
        .then(function () { return save(T.show.script.pdfVer ? 'Script and pages saved' : 'Script saved'); }).then(function () { b.remove(); }, function () { btn.disabled = false; btn.textContent = 'Save the script'; });
    };
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
        '<button class="btn" id="sh">Hear</button><button class="btn primary" id="sa" data-save>Add</button></div>' +
        '<p class="muted small">Hear uses this device’s own voice. ElevenLabs may say the same spelling differently: test it below.</p>' + elevenTest();
      box.querySelectorAll('[data-hear]').forEach(function (b) { b.onclick = function () { T.Speech.stop(); T.Speech.say(b.dataset.hear); }; });
      box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { var k = b.dataset.del; if (base[k]) mine[k] = ''; else delete mine[k]; save('Removed').then(draw); }; });
      box.querySelector('#sh').onclick = function () { var w = box.querySelector('#sw').value.trim(), l = box.querySelector('#sl').value.trim(); T.Speech.stop(); T.Speech.say(l || w); };
      wireEleven();
      box.querySelector('#sa').onclick = function () { var w = box.querySelector('#sw').value.trim(), l = box.querySelector('#sl').value.trim(); if (!w || !l) return; mine[w] = l; save('Added').then(draw); };
    }
    /* try spellings in a real ElevenLabs voice: each one said in a sentence, one after another, with "Use this one" */
    var tries = [];
    function elevenTest() {
      var V = T.Voices, vs = V && V.elevenVoices();
      var who = T.O().characters.filter(function (c) { return vs && vs[c.id]; });
      if (!who.length) return '<div class="card" style="margin-top:12px;box-shadow:none;border:1px dashed var(--line)"><h3>Test in an ElevenLabs voice</h3><p class="muted small">Open Teacher mode › Voices & recordings on this computer, add your key and tap Load my voices; then you can test spellings here in the real voices.</p></div>';
      return '<div class="card" style="margin-top:12px;box-shadow:none;border:1px dashed var(--line)"><h3>Test in an ElevenLabs voice</h3>' +
        '<p class="muted small">Type the word and a few ways to spell it, with / between them. Each is said in a sentence in the voice you pick (about 30 credits each). Tap Use this one for the best, then remake lines that have the word.</p>' +
        '<div class="row"><label class="f grow" style="margin:0">Voice<select id="ev">' + who.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f grow" style="margin:0">Word<input id="ew" placeholder="Darbus"></label></div>' +
        '<label class="f">Spellings to try<input id="es" placeholder="Darbuss / Dar-buss / DAR-bus"></label>' +
        '<label class="f">Sentence <span class="muted small">(the word goes where * is)</span><input id="et" value="Good morning, Ms. *. I will see you after class."></label>' +
        '<div class="row"><button class="btn primary" id="eg">Hear each in ElevenLabs</button><span class="muted small" id="em"></span></div><div id="er"></div></div>';
    }
    function wireEleven() {
      var g = box.querySelector('#eg'); if (!g) return;
      var ew = box.querySelector('#ew'), es = box.querySelector('#es'), et = box.querySelector('#et'), m = box.querySelector('#em'), out = box.querySelector('#er');
      var showTries = function () {
        out.innerHTML = tries.map(function (t, i) { return '<div class="switch"><span class="grow"><b>' + esc(t.sp) + '</b><br><span class="muted small">Sent: ' + esc(t.sent) + '</span></span><button class="btn small" data-again="' + i + '">▶ Again</button><button class="btn small good" data-use="' + i + '">Use this one</button></div>'; }).join('');
        out.querySelectorAll('[data-again]').forEach(function (b) { b.onclick = function () { var t = tries[+b.dataset.again]; b.disabled = true; T.Voices.tryWords(t.sent, t.who).then(function () { b.disabled = false; }, function (e) { b.disabled = false; T.toast(e.message, 6000); }); }; });
        out.querySelectorAll('[data-use]').forEach(function (b) { b.onclick = function () { var t = tries[+b.dataset.use]; mine[t.word] = t.sp; save(t.word + ' will be said as “' + t.sp + '”. Make its lines again to hear it.').then(function () { tries = []; draw(); }); }; });
      };
      g.onclick = function () {
        var word = ew.value.trim(), who = box.querySelector('#ev').value, sps = es.value.split('/').map(function (x) { return x.trim(); }).filter(Boolean), sentence = et.value.indexOf('*') >= 0 ? et.value : '*. ' + et.value;
        if (!word) { m.textContent = 'Type the word first.'; return; }
        if (!sps.length) sps = [word];
        tries = []; g.disabled = true;
        sps.reduce(function (p, sp, i) {
          return p.then(function () {
            m.textContent = 'Saying ' + (i + 1) + ' of ' + sps.length + ': ' + sp;
            var had = Object.prototype.hasOwnProperty.call(mine, word), old = mine[word];
            mine[word] = sp; var sent = T.pronounce(sentence.replace(/\*/g, word));      // exactly what a real line would send with this spelling
            if (had) mine[word] = old; else delete mine[word];
            tries.push({ word: word, sp: sp, sent: sent, who: who }); showTries();
            return T.Voices.tryWords(sent, who);
          });
        }, Promise.resolve()).then(function () { g.disabled = false; m.textContent = 'Tap ▶ Again to compare, then Use this one.'; }, function (e) { g.disabled = false; m.textContent = e.message; });
      };
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
    app.innerHTML = '<div class="card"><label class="f">Plain-language story (Company members hear this in The Story)<textarea id="story">' + esc(scene.story || '') + '</textarea></label>' +
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
    app.innerHTML = '<div class="row"><h2 class="grow">Cast</h2><button class="btn" id="groups">Who sings with the groups</button><button class="btn" id="roster">Paste a class list</button><button class="btn primary" id="add">Add an actor</button></div>' +
      '<p class="muted">Company members tap their picture in the app. Photos are made small and saved encrypted. Tap someone to set <b>Artist</b> or <b>Mentor</b>.</p>' +
      [['artist', 'Company Artists'], ['mentor', 'Company Mentors'], ['', 'Not marked yet']].map(function (g) {
        var list = cast.filter(function (c) { return (T.COMPANY[c.company] ? c.company : '') === g[0]; });
        return list.length ? (cast.some(function (c) { return T.COMPANY[c.company]; }) ? '<h3 style="margin-top:14px">' + g[1] + ' <span class="muted small">(' + list.length + ')</span></h3>' : '') + '<div class="choose">' + list.map(personBtn).join('') + '</div>' : '';
      }).join('') + (cast.length ? '' : '<p>No actors yet. Paste your class list when you get it: Company members can start (the whole show, the story, crews) before they have roles. Until then, Company members pick a character.</p>');
    document.getElementById('roster').onclick = function () {
      var d = dialog('<h2>Paste a class list</h2><p class="muted">One Company member per line, the way they like to be called. Add <b>Artist</b> or <b>Mentor</b> on the line (after a tab or a comma) to mark them. “Last, First” is turned around. A school email on the line (after a tab or a comma) is saved for Sign in with Google, as a scrambled code. Names already on the list get their email added. Give them roles later (tap a Company member).</p>' +
        '<label class="f">Names<textarea id="nl" style="min-height:240px"></textarea></label><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok" data-save>Add them</button></div>');
      d.querySelector('#cn').onclick = function () { d.close(); };
      d.querySelector('#ok').onclick = function () {
        var n = 0, e = 0, jobs = [];
        d.querySelector('#nl').value.split('\n').forEach(function (line) {
          var em = (line.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/) || [])[0];
          var co = (line.match(/(?:^|[\t,;\s])(artist|mentor)\s*$/i) || line.match(/[\t,;]\s*(artist|mentor)\s*(?=[\t,;]|$)/i) || [])[1];      // “Artist” or “Mentor” on the line
          if (co) line = line.replace(new RegExp('[\\t,;\\s]*' + co + '\\s*(?=[\\t,;]|$)', 'i'), '');
          var nm = line.replace(em || '\u0000', '').replace(/[<>]/g, '').replace(/[\t,;\s]+$/, '').replace(/\t.*$/, '').trim(); if (!nm) return;
          var m = nm.match(/^([^,]+),\s*(.+)$/); if (m) nm = m[2] + ' ' + m[1];
          var a = cast.find(function (c) { return c.name.toLowerCase() === nm.toLowerCase(); });
          if (!a) { a = { id: uid('a'), name: nm, chars: [], photo: '', access: Object.assign({}, T.DEF_ACCESS) }; cast.push(a); n++; }
          if (co) a.company = co.toLowerCase();
          if (em) jobs.push(T.emailHash(em).then(function (h) { a.emailHash = h; a.emailHint = emailHint(em); e++; }));
        });
        if (!n && !jobs.length) { d.close(); return; }
        Promise.all(jobs).then(function () { return save(n + ' Company members added' + (e ? ', ' + e + ' school emails saved' : '')); }).then(function () { d.close(); castPage(); });
      };
    };
    document.getElementById('add').onclick = function () { editActor(null); };
    document.getElementById('groups').onclick = groupsDialog;
    app.querySelectorAll('.person').forEach(function (b) { b.onclick = function () { editActor(cast.find(function (c) { return c.id === b.dataset.id; })); }; });
  }
  function personBtn(c) {
    return '<button class="person" data-id="' + esc(c.id) + '">' + T.face(c) + '<b>' + esc(c.name) + '</b>' + T.companyTag(c) + '<span>' + (c.chars || []).map(function (id) { var x = T.charById(id); return x ? esc(x.short) : ''; }).join(', ') + ((c.chars || []).length ? '' : '<i>No role yet</i>') + (c.guest ? ' · <b>guest</b>' : '') + (c.emailHash ? ' · ✉️' : '') + '</span></button>';
  }
  /* who sings with each group when the script names the group (a JOCKS line is Chad's and Zeke's too; a CHAD line is only Chad's) */
  function groupsDialog() {
    var O = T.O(), groups = O.characters.filter(function (c) { return c.group === 'ensemble'; }), named = O.characters.filter(function (c) { return c.group !== 'ensemble'; });
    var cur = {}; groups.forEach(function (g) { cur[g.id] = T.groupMembers(g.id).slice(); });
    var d = dialog('<h2>Who sings with the groups</h2><p class="muted">When the script says a group (JOCKS), these characters sing it too. When it names a character (CHAD), only that character does.</p>' +
      groups.map(function (g) { return '<p style="margin:12px 0 4px"><b>' + esc(g.name) + '</b></p><div class="row" style="flex-wrap:wrap;gap:6px">' + named.map(function (c) {
        return '<label class="chip-check"><input type="checkbox" data-g="' + g.id + '" value="' + c.id + '"' + (cur[g.id].indexOf(c.id) >= 0 ? ' checked' : '') + '>' + T.chip(c.id) + '</label>'; }).join('') + '</div>'; }).join('') +
      '<div class="row end" style="margin-top:14px"><button class="btn" id="gx">Cancel</button><button class="btn primary" id="gok" data-save>Save</button></div>');
    d.querySelector('#gx').onclick = function () { d.close(); };
    d.querySelector('#gok').onclick = function () {
      var G = {}; groups.forEach(function (g) { var m = Array.from(d.querySelectorAll('input[data-g="' + g.id + '"]:checked')).map(function (x) { return x.value; }); if (m.length) G[g.id] = m; });
      T.show.groupMembers = G; save('Group singers saved').then(function () { d.close(); });
    };
  }
  /* a hint the teacher can recognize, not the address: "j•••@school.org" */
  function emailHint(em) { var p = em.toLowerCase().split('@'); return p[0].charAt(0) + '•••@' + p[1]; }
  function editActor(a) {
    var isNew = !a; a = a ? clone(a) : { id: uid('a'), name: '', chars: [], photo: '', access: Object.assign({}, T.DEF_ACCESS) };
    a.access = Object.assign({}, T.DEF_ACCESS, a.access || {});
    var O = T.O(), A = a.access;
    var seg = function (k, opts) { return '<div class="seg" data-k="' + k + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (A[k] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    var sw = function (k, label) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-k="' + k + '"' + (A[k] ? ' checked' : '') + '></label>'; };
    var d = dialog('<h2>' + (isNew ? 'Add an actor' : 'Edit actor') + '</h2>' +
      '<div class="row">' + '<span id="ph">' + T.face(a, 80) + '</span><label class="btn small">Photo<input type="file" accept="image/*" id="pf" hidden></label><button class="btn small quiet" id="pr">No photo</button></div>' +
      '<label class="f">Name<input id="nm" value="' + esc(a.name) + '" autocomplete="off"></label>' +
      '<div class="switch"><span><b>In the Company</b></span><div class="seg" id="co">' + [['artist', 'Artist'], ['mentor', 'Mentor'], ['', 'Not set']].map(function (o) { return '<button type="button" data-co="' + o[0] + '" aria-pressed="' + ((a.company || '') === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="f">School email (for Sign in with Google)<input id="em" type="email" autocomplete="off" autocapitalize="off" placeholder="' + (a.emailHash ? 'saved (' + esc(a.emailHint || 'hidden') + '): type a new one to change it' : 'e.g. jsmith@school.org') + '"></label>' +
      (a.emailHash ? '<label class="switch"><span>Remove the saved school email</span><input type="checkbox" id="emx"></label>' : '') +
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
    d.querySelectorAll('#co button').forEach(function (b) { b.onclick = function () { if (b.dataset.co) a.company = b.dataset.co; else delete a.company; d.querySelectorAll('#co button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
    d.querySelectorAll('.seg[data-k] button').forEach(function (b) { b.onclick = function () { A[b.parentNode.dataset.k] = b.dataset.v; b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
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
      var em = d.querySelector('#em').value.trim(), rm = d.querySelector('#emx');
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { T.toast('That email does not look right.'); return; }
      if (rm && rm.checked) { delete a.emailHash; delete a.emailHint; }
      (em ? T.emailHash(em).then(function (h) { a.emailHash = h; a.emailHint = emailHint(em); }) : Promise.resolve()).then(function () {
        var i = cast.findIndex(function (c) { return c.id === a.id; }); if (i >= 0) cast[i] = a; else cast.push(a);
        return save();
      }).then(function () { d.close(); castPage(); if (T.me && T.me.id === a.id) T.setMe({ cast: a.id }); });
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
    /* starter looks added or changed in the show file after this show was saved (Colleen 2026-10-24: Rebels, Brainiacs, Jocks); the teacher picks each one */
    var D = window.DEFAULT_SHOW, keep = O.costumeKeep = O.costumeKeep || [], sig = function (c) { return c.id + '|' + c.name + '|' + c.items.join(','); };
    var news = D && D.title === O.title ? (D.costumes || []).filter(function (d) {
      var mine = O.costumes.find(function (x) { return x.id === d.id; });
      return keep.indexOf(sig(d)) < 0 && (!mine || sig(mine) !== sig(d));
    }) : [];
    app.innerHTML = '<div class="row"><h2 class="grow">Costumes</h2><button class="btn primary" id="add">Add a costume</button></div>' + (T.sizeReminder ? T.sizeReminder('costumes') : '') +
      (news.length ? '<div class="card"><h3>New starter looks</h3><p class="muted small">These were added or changed in the show\u2019s starting costume list after you set up your show. Pick the ones you want; your own changes stay unless you choose \u201cUse this.\u201d</p>' + news.map(function (d) {
        var mine = O.costumes.find(function (x) { return x.id === d.id; });
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow">' + T.chip(d.who) + ' <b>' + esc(d.name) + '</b>: ' + esc(d.items.join(', ')) +
          (mine ? '<br><span class="muted small">Yours now: ' + esc(mine.name) + ': ' + esc(mine.items.join(', ')) + '</span>' : '<br><span class="muted small">New</span>') + '</span>' +
          '<button class="btn small primary" data-use="' + esc(d.id) + '" data-save>Use this</button> <button class="btn small" data-keep="' + esc(d.id) + '" data-save>' + (mine ? 'Keep mine' : 'Not for us') + '</button></div>';
      }).join('') + '</div>' : '') +
      O.characters.map(function (c) {
        var list = O.costumes.filter(function (x) { return x.who === c.id; });
        if (!list.length) return '';
        return '<div class="card"><h3>' + T.chip(c.id) + '</h3>' + (T.photoSlot ? T.photoSlot('research', c.id, 'Costume research pictures') : '') + list.map(function (x) {
          return '<div class="switch" style="cursor:pointer" data-id="' + esc(x.id) + '"><span><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.items.join(', ')) + '</span></span><span class="muted small">' + x.moments.length + ' moments</span></div>' + (T.photoSlot ? T.photoSlot('costume', x.id) : '');
        }).join('') + '</div>';
      }).join('');
    if (T.fillPhotos) T.fillPhotos(app, true);
    document.getElementById('add').onclick = function () { editCostume(null); };
    app.querySelectorAll('[data-use]').forEach(function (b) { b.onclick = function () {
      var d = news.find(function (x) { return x.id === b.dataset.use; }), i = O.costumes.findIndex(function (x) { return x.id === d.id; });
      if (i >= 0) { O.costumes[i].name = d.name; O.costumes[i].items = d.items.slice(); } else O.costumes.push(JSON.parse(JSON.stringify(d)));      // a changed look keeps your moments
      save().then(costumePage);
    }; });
    app.querySelectorAll('[data-keep]').forEach(function (b) { b.onclick = function () { keep.push(sig(news.find(function (x) { return x.id === b.dataset.keep; }))); save().then(costumePage); }; });
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
  function songsPage(args) {
    if (args && args[0] === 'cues' && T.songById(args[1])) return cuesPage(args[1]);
    if (args && args[0] === 'lyrics' && T.songById(args[1])) return lyricsPage(args[1]);
    T.setBar('Songs & tracks', '#/teacher');
    var O = T.O(), tr = T.show.tracks = T.show.tracks || {}, mel = T.show.melody = T.show.melody || {};
    var links = O.links || {};
    app.innerHTML = '<div class="card"><p>Upload each song’s <b>rehearsal track</b> (with the guide vocals) and <b>performance track</b> (band only). They are saved encrypted, for this cast. MP3 works best (24 MB at most).</p>' +
      '<p class="row">' + (links.rehearsalFolder ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(links.rehearsalFolder) + '">Rehearsal tracks folder</a>' : '') + (links.performanceFolder ? '<a class="btn small" target="_blank" rel="noopener" href="' + esc(links.performanceFolder) + '">Performance tracks folder</a>' : '') + '</p>' +
      '<p class="muted small">Then <b>Make melody line</b> works out the tune from the two tracks, so Company members can hear a soft tone instead of the singers.</p>' +
      '<p class="row"><label class="btn">Add many band tracks<input type="file" multiple accept="audio/*,.mp3,.m4a,.wav" data-many="performance" hidden></label>' +
      '<label class="btn">Add many guide-vocal tracks<input type="file" multiple accept="audio/*,.mp3,.m4a,.wav" data-many="rehearsal" hidden></label>' +
      '<span class="muted small">Pick a whole folder’s files: each goes to its music number from the start of its name (07_Announcement Transition 1.mp3 is #7), songs and scene-change music alike.</span></p>' +
      '<p class="row"><button class="btn" id="allpiano">🎹 Piano melody for every song</button><span class="muted small">The singer’s notes read from the sheet music, timed by the lyrics timing. Company members turn it on in the song player.</span></p>' +
      '<p class="row"><button class="btn primary" id="alllyr">Find lyrics timing for every song</button><span class="muted small">For the sheet music with a moving guide. Songs that already have a ✓ are left alone.</span></p></div>' +
      '<table class="tbl"><thead><tr><th>Song</th><th>Rehearsal (guide vocals)</th><th>Performance</th><th>Melody line</th></tr></thead><tbody>' + O.songs.map(function (s) {
        var t = tr[s.id] || {}, cell = function (kind) {
          var x = t[kind];
          return '<td>' + (x ? '<span class="tag">' + T.clock(x.dur) + '</span> ' : '<span class="muted small">none</span> ') +
            '<label class="btn small">' + (x ? 'Replace' : 'Upload') + '<input type="file" accept="audio/*,.mp3,.m4a,.wav" data-s="' + s.id + '" data-k="' + kind + '" hidden></label></td>';
        };
        var m = mel[s.id];
        return '<tr><td><b>#' + esc(s.num) + '</b> ' + esc(s.title) + '</td>' + cell('rehearsal') + cell('performance') +
          '<td>' + (m ? '<span class="tag">' + m.notes.length + ' notes</span> ' : '') + '<button class="btn small" data-mel="' + s.id + '"' + (t.rehearsal && t.performance ? '' : ' disabled title="Upload both tracks first"') + '>' + (m ? 'Make again' : 'Make melody line') + '</button>' +
          ' <button class="btn small" data-piano="' + s.id + '"' + (T.show.lyricTimes && T.show.lyricTimes[s.id] ? '' : ' disabled title="Find the lyrics timing first"') + '>' + (T.show.sheetMelody && T.show.sheetMelody[s.id] ? '🎹 Piano ✓ ' + T.show.sheetMelody[s.id].notes.length + ' notes' : '🎹 Piano from the sheet music') + '</button>' +
          ' <a class="btn small" href="#/teacher/songs/lyrics/' + s.id + '">' + (T.show.lyricTimes && T.show.lyricTimes[s.id] ? 'Lyrics timing ✓' : 'Lyrics timing') + '</a>' +
          ' <a class="btn small" href="#/teacher/songs/cues/' + s.id + '">' + (T.show.underscore && T.show.underscore[s.id] ? 'Lines over the music ✓' : 'Lines over the music') + '</a></td></tr>';
      }).join('') + '</tbody></table>' + changeMusic() + '<p id="st" class="muted" role="status"></p>';
    function changeMusic() {
      if (!T.Cues) return '';
      var nums = T.Cues.musicNumbers(), songNums = O.songs.map(function (s) { return String(s.num); });
      var list = Object.keys(nums).filter(function (n) { return songNums.indexOf(n) < 0; }).sort(function (a, b) { return a - b; });
      if (!list.length) return '';
      return '<h3 style="margin-top:20px">Scene-change music (MX cues)</h3><p class="muted small">Each MX cue in the script plays the music connected here (songs use their own tracks above). The cue sheet, Read the script and the stage manager script show which cues have music.</p><table class="tbl"><thead><tr><th>Music</th><th>Band track (performance)</th><th>Guide vocals</th><th></th></tr></thead><tbody>' + list.map(function (n) {
        var id = 'mx' + n, t = tr[id] || {}, cell = function (k) { return '<td>' + (t[k] ? '<span class="tag">' + T.clock(t[k].dur) + '</span> <span class="muted small">' + esc(t[k].name || '') + '</span> ' : '<span class="muted small">none</span> ') +
          '<label class="btn small">' + (t[k] ? 'Replace' : 'Upload') + '<input type="file" accept="audio/*,.mp3,.m4a,.wav" data-s="' + id + '" data-k="' + k + '" hidden></label></td>'; };
        return '<tr><td><b>MX' + n + '</b> ' + esc(nums[n]) + '</td>' + cell('performance') + cell('rehearsal') + '<td>' + (t.performance || t.rehearsal ? '<button class="btn small" data-mxplay="' + n + '">▶</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
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
        }).then(function () { if (location.hash === '#/teacher/songs') songsPage(); }).catch(function (e) { st.textContent = ''; T.toast(e.message || 'That file would not open as audio.', 4000); });
      };
    });
    app.querySelectorAll('button[data-piano]').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.piano; b.disabled = true; st.textContent = 'Reading the notes on the sheet music…';
        makePiano(id).then(function (n) { return save(n + ' piano notes saved'); }).then(function () { songsPage(); })
          .catch(function (e) { b.disabled = false; st.textContent = ''; T.toast(e.message || 'Could not read the notes.', 5000); });
      };
    });
    document.getElementById('allpiano').onclick = function () {
      var b = this, todo = O.songs.filter(function (s) { return T.show.lyricTimes && T.show.lyricTimes[s.id]; }), done = 0, miss = [];
      if (!todo.length) { T.toast('Find the lyrics timing first (the button below).', 4000); return; }
      b.disabled = true;
      todo.reduce(function (p, s, k) {
        return p.then(function () { st.textContent = 'Reading the notes for “' + s.title + '” (' + (k + 1) + ' of ' + todo.length + ')…'; return makePiano(s.id).then(function (n) { if (n) done++; else miss.push(s.title); }, function () { miss.push(s.title); }); });
      }, Promise.resolve()).then(function () { return save('Piano melody saved for ' + done + ' songs'); }).then(function () {
        songsPage(); document.getElementById('st').textContent = 'Piano melody for ' + done + ' of ' + todo.length + ' songs.' + (miss.length ? ' Not read: ' + miss.join(', ') + '.' : '');
      });
    };
    app.querySelectorAll('input[data-many]').forEach(function (inp) {
      inp.onchange = function () {
        var kind = inp.dataset.many, files = [].slice.call(inp.files), nums = T.Cues ? T.Cues.musicNumbers() : {}, done = 0, skip = [];
        inp.value = '';
        /* the music number in a file name: at the start ("07_…"), after # or No., or the first number on its own ("HSMJR - 03 - Playoff") */
        var guess = function (name) {
          var b = name.replace(/\.[a-z0-9]+$/i, ''), m = b.match(/^0*(\d{1,2})(?!\d)/) || b.match(/(?:#|no\.?\s*|track\s*)0*(\d{1,2})(?!\d)/i) || b.match(/(?:^|[^\d])0*(\d{1,2})(?!\d)/);
          var n = m && m[1], so = n && O.songs.find(function (s) { return String(s.num) === n; });
          return so ? so.id : n && nums[n] ? 'mx' + n : '';
        };
        var opts = O.songs.map(function (s) { return [s.id, '#' + s.num + ' ' + s.title]; }).concat(Object.keys(nums).filter(function (n) { return !O.songs.some(function (s) { return String(s.num) === n; }); }).sort(function (a, b) { return a - b; }).map(function (n) { return ['mx' + n, 'MX' + n + ' ' + nums[n]]; }));
        var dlg = document.createElement('dialog'); document.body.appendChild(dlg);
        dlg.innerHTML = '<h2>Connect the ' + (kind === 'performance' ? 'band' : 'guide-vocal') + ' tracks</h2><p class="muted small">Check that each file goes to the right music number. Pick Skip for any file you don’t want.</p>' +
          '<div style="max-height:55vh;overflow:auto">' + files.map(function (f, i) { var g = guess(f.name); return '<div class="switch" style="flex-wrap:wrap"><span class="grow small">' + esc(f.name) + '</span><select data-fi="' + i + '"><option value="">Skip</option>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === g ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }).join('') + '</div>' +
          '<div class="row end" style="margin-top:10px"><button class="btn quiet" id="bx">Cancel</button><button class="btn primary" id="bu">Upload</button></div>';
        dlg.showModal(); dlg.addEventListener('close', function () { dlg.remove(); });
        dlg.querySelector('#bx').onclick = function () { dlg.close(); };
        dlg.querySelector('#bu').onclick = function () {
        var plan = files.map(function (f, i) { var id = dlg.querySelector('[data-fi="' + i + '"]').value; return id ? { f: f, id: id } : (skip.push(f.name), null); }).filter(Boolean);
        dlg.close();
        if (!plan.length) { T.toast('No files were connected to a music number.', 4000); return; }
        plan.reduce(function (p, x, i) {
          return p.then(function () {
            st.textContent = 'Uploading ' + x.f.name + ' (' + (i + 1) + ' of ' + plan.length + ')…';
            return x.f.arrayBuffer().then(function (buf) {
              return T.audioCtx().decodeAudioData(buf.slice(0)).then(function (ab) {
                var ver = Date.now().toString(36);
                return Store.putTrack(T.key, T.proof, x.id, kind, buf, ver).then(function () {
                  tr[x.id] = tr[x.id] || {}; tr[x.id][kind] = { ver: ver, dur: Math.round(ab.duration * 10) / 10, size: x.f.size, name: x.f.name };
                  if (mel[x.id]) delete mel[x.id]; done++;
                });
              });
            }).catch(function () { skip.push(x.f.name); });
          });
        }, Promise.resolve()).then(function () { return save(done + ' tracks saved'); }).then(function () {
          if (location.hash !== '#/teacher/songs') return;
          songsPage(); document.getElementById('st').textContent = done + ' of ' + files.length + ' tracks saved.' + (skip.length ? ' Not used: ' + skip.join(', ') + '.' : '');
        });
        };
      };
    });
    var mxPlaying = null;
    app.querySelectorAll('[data-mxplay]').forEach(function (b) { b.onclick = function () { if (mxPlaying) { mxPlaying.pause(); mxPlaying = null; return; } mxPlaying = T.Cues.play(b.dataset.mxplay); }; });
    T.cleanup.push(function () { if (mxPlaying) mxPlaying.pause(); });
    document.getElementById('alllyr').onclick = function () {
      var L = T.show.lyricTimes = T.show.lyricTimes || {}, b = this;
      var todo = O.songs.filter(function (s) { var t = tr[s.id] || {}, it = lyricItem(s.id); return t.rehearsal && t.performance && it && it.lyrics.length && !L[s.id]; });
      if (!todo.length) { T.toast('Every song with both tracks and lyrics already has its timing.', 4000); return; }
      b.disabled = true; var done = 0, miss = [];
      todo.reduce(function (p, s, k) {
        return p.then(function () {
          st.textContent = 'Listening to “' + s.title + '” (' + (k + 1) + ' of ' + todo.length + ')… about a minute each.';
          return autoLyrics(s.id).then(function (r) {
            if (!r.n) { miss.push(s.title); return; }
            var ly = lyricItem(s.id).lyrics;      // sections that start together take their partner's start
            ly.forEach(function (l, i) { var p = l.sync && r.lines[i - l.sync]; if (p) r.lines[i] = { t: p.t, e: p.e, s: Melody.sylTimes([], p.t, p.e, (l.syl && l.syl.length) || 1) }; });
            L[s.id] = { kind: 'performance', lines: r.lines }; done++; return makePiano(s.id).catch(function () {});
          }, function () { miss.push(s.title); });
        });
      }, Promise.resolve()).then(function () {
        return save('Lyrics timing saved for ' + done + ' song' + (done === 1 ? '' : 's'));
      }).then(function () {
        songsPage(); document.getElementById('st').textContent = 'Saved ' + done + ' of ' + todo.length + '.' + (miss.length ? ' Not found: ' + miss.join(', ') + ' (open its Lyrics timing to tap it by hand).' : '') + ' Open any song’s Lyrics timing to Test and nudge.';
      });
    };
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

  /* lines spoken over a song's music: which lines, and when in the track. Found from the guide vocals (the voices left when the band track is
     taken away, spoken stretches matched to the lines in order), or tapped by hand while the track plays; nudge, test, save. Times are on the
     performance track's clock. */
  function cuesPage(songId) {
    var song = T.songById(songId), scene = T.sceneById(song.scene), src = T.scriptScene(scene), tr = (T.show.tracks || {})[songId] || {};
    T.setBar('Lines over the music', '#/teacher/songs');
    if (!src) { app.innerHTML = '<p class="card">Import the script first.</p>'; return; }
    if (!tr.performance && !tr.rehearsal) { app.innerHTML = '<p class="card">Upload this song’s tracks first.</p>'; return; }
    var U = T.show.underscore = T.show.underscore || {}, saved = U[songId] || { kind: 'performance', cues: [] };
    var kind = tr.performance ? 'performance' : 'rehearsal', mel = T.show.melody && T.show.melody[songId], off = (mel && mel.offset) || 0;
    var lines = src.items.filter(function (it) { return it.type === 'line'; }), times = {}, ticked = {};
    lines.forEach(function (it) { var k = T.lineKey(it), c = saved.cues.find(function (x) { return x.key === k; }); if (c) { ticked[k] = 1; times[k] = saved.kind === kind ? c.t : c.t + (saved.kind === 'performance' ? off : -off); } else if (it.overMusic) ticked[k] = 1; });
    var audio = new Audio(), url = null, loaded = false;
    var load = function (k) { return Store.getTrack(T.key, songId, k, tr[k].ver).then(function (b) { if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(new Blob([b])); audio.src = url; loaded = true; }); };
    T.cleanup.push(function () { audio.pause(); if (url) URL.revokeObjectURL(url); });
    function draw(msg) {
      app.innerHTML = '<div class="card"><h2>' + sym('🎵') + esc(song.title) + ' · Scene ' + scene.num + '</h2><p class="muted">Tick the lines that are spoken while this song’s music plays. Then let the app find them in the guide vocals, or play the track and tap <b>Now</b> as each line starts. In Practice Lines the track then plays inside the run, and these lines come on cue.</p>' +
        '<div class="row"><button class="btn primary" id="find"' + (tr.rehearsal && tr.performance ? '' : ' disabled title="Needs both tracks"') + '>Find them in the guide vocals</button><span class="muted small" id="msg">' + (msg || '') + '</span></div></div>' +
        '<div class="card"><div class="row"><button class="round" id="pl" aria-label="Play">' + icon(audio.paused ? 'play' : 'pause') + '</button><button class="btn small" id="bk">Back 3 s</button><b id="tm" class="grow">' + T.clock(audio.currentTime) + '</b>' +
        '<button class="btn primary" id="now">Now: next line</button></div><p class="muted small">Tapping uses the band track’s clock. Space = Now.</p></div>' +
        '<div class="card">' + lines.map(function (it, i) {
          var k = T.lineKey(it), on = !!ticked[k], t = times[k];
          return '<div class="switch" style="flex-wrap:wrap"><label style="display:flex;gap:10px;align-items:center;flex:1;cursor:pointer"><input type="checkbox" data-tick="' + i + '"' + (on ? ' checked' : '') + ' style="width:26px;height:26px"><span><b>' + esc(it.who) + '</b> ' + esc(it.text.slice(0, 90)) + (it.text.length > 90 ? '…' : '') + (it.overMusic ? ' <span class="tag">in the music pages</span>' : '') + '</span></label>' +
            (on ? '<span class="row" style="gap:4px"><button class="btn small" data-nudge="' + i + '|-0.25">−</button><b style="min-width:58px;text-align:center">' + (t == null ? '—' : t.toFixed(2) + ' s') + '</b><button class="btn small" data-nudge="' + i + '|0.25">+</button><button class="btn small" data-test="' + i + '"' + (t == null ? ' disabled' : '') + '>Test</button></span>' : '') + '</div>';
        }).join('') + '</div><div class="dock"><div class="in"><button class="btn quiet" id="clr">Clear all times</button><button class="btn primary" id="sv" data-save>Save</button></div></div>';
      var $ = function (id) { return document.getElementById(id); };
      $('pl').onclick = function () { (loaded ? Promise.resolve() : load(kind)).then(function () { if (audio.paused) audio.play(); else audio.pause(); draw(); }); };
      $('bk').onclick = function () { audio.currentTime = Math.max(0, audio.currentTime - 3); };
      $('now').onclick = tapNow;
      $('clr').onclick = function () { times = {}; draw(); };
      $('sv').onclick = function () {
        var cues = lines.filter(function (it) { var k = T.lineKey(it); return ticked[k] && times[k] != null; }).map(function (it) { var k = T.lineKey(it); return { key: k, t: +(kind === 'performance' ? times[k] : times[k] - off).toFixed(2) }; });
        if (cues.length) U[songId] = { kind: 'performance', cues: cues }; else delete U[songId];
        save(cues.length + ' lines over the music saved');
      };
      $('find').onclick = find;
      app.querySelectorAll('[data-tick]').forEach(function (b) { b.onchange = function () { var k = T.lineKey(lines[+b.dataset.tick]); if (b.checked) ticked[k] = 1; else { delete ticked[k]; delete times[k]; } draw(); }; });
      app.querySelectorAll('[data-nudge]').forEach(function (b) { b.onclick = function () { var x = b.dataset.nudge.split('|'), k = T.lineKey(lines[+x[0]]); times[k] = Math.max(0, (times[k] || 0) + +x[1]); draw(); }; });
      app.querySelectorAll('[data-test]').forEach(function (b) { b.onclick = function () { var k = T.lineKey(lines[+b.dataset.test]); (loaded ? Promise.resolve() : load(kind)).then(function () { audio.currentTime = Math.max(0, times[k] - 2); audio.play(); draw(); }); }; });
    }
    function tapNow() {
      var next = lines.find(function (it) { var k = T.lineKey(it); return ticked[k] && times[k] == null; });
      if (!next || audio.paused) { T.toast(audio.paused ? 'Play the track first.' : 'Every ticked line has a time.'); return; }
      times[T.lineKey(next)] = +audio.currentTime.toFixed(2); draw();
    }
    function find() {
      var ctx = T.audioCtx(), m = document.getElementById('msg'), want = lines.filter(function (it) { return ticked[T.lineKey(it)]; });
      if (!want.length) { T.toast('Tick the lines first.'); return; }
      m.textContent = 'Loading both tracks…';
      var get = function (k) { return Store.getTrack(T.key, songId, k, tr[k].ver).then(function (b) { return ctx.decodeAudioData(b); }); };
      Promise.all([get('rehearsal'), get('performance')]).then(function (r) {
        m.textContent = 'Listening for the spoken lines… (this can take a minute)';
        return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () {
          var g = Melody.toMono(r[0]), p = Melody.toMono(r[1]), rate = r[0].sampleRate;
          var offS = Melody.findOffset(g, p, rate), iso = Melody.isolate(g, p, offS);
          var regions = Melody.voiceRegions(iso.voice, rate), found = Melody.alignLines(regions, want.map(function (it) { return LineCheck.spoken(it.text).length; }));
          var n = 0; want.forEach(function (it, i) { if (found[i] != null) { times[T.lineKey(it)] = found[i]; n++; } });
          if (kind !== 'performance') want.forEach(function (it) { var k = T.lineKey(it); if (times[k] != null) times[k] += offS / rate; });
          draw('Found ' + n + ' of ' + want.length + ' lines (' + regions.filter(function (x) { return !x.sung; }).length + ' spoken stretches heard). Use Test to check each one, nudge with − and +, then Save.');
        });
      }).catch(function (e) { m.textContent = ''; T.toast(e.message || 'Could not read the tracks.', 4000); });
    }
    draw();
    var tick = setInterval(function () { var el = document.getElementById('tm'); if (el) el.textContent = T.clock(audio.currentTime) + ' (' + audio.currentTime.toFixed(1) + ' s)'; }, 200);
    T.cleanup.push(function () { clearInterval(tick); });
    var kh = function (e) { if (e.key === ' ' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); tapNow(); } };
    document.addEventListener('keydown', kh); T.cleanup.push(function () { document.removeEventListener('keydown', kh); });
  }

  /* when each lyric line (and syllable) is sung, for the bouncing ball on the real pages: found in the guide vocals (the singing left when the
     band track is taken away, lyric lines matched in order to sung stretches, syllables to the sung notes), or tapped by hand; nudge, test, save.
     T.show.lyricTimes[song] = { kind: 'performance', lines: [{ t, e, s: [syllable starts] }] } on the band track's clock, in the script's lyric order. */
  /* the piano melody from the sheet music (sheet-melody.js), made from the lyrics timing */
  function makePiano(songId) {
    return SheetMelody.make(songId).then(function (notes) {
      var P = T.show.sheetMelody = T.show.sheetMelody || {};
      if (notes.length) P[songId] = { notes: notes, made: Date.now() }; else delete P[songId];
      return notes.length;
    });
  }
  T.makePiano = makePiano;

  function lyricItem(songId) {
    var song = T.songById(songId), scene = song && T.sceneById(song.scene), src = scene && T.scriptScene(scene);
    return src && src.items.find(function (it) { return it.type === 'song' && it.num === song.num; });
  }
  var lyrCount = function (l) { return (l.syl && l.syl.length) || l.text.split(/\s+/).length; };
  /* finds when each lyric line is sung, from the two tracks: { n found, lines on the band track's clock (null where not found) } */
  function autoLyrics(songId) {
    var tr = T.show.tracks[songId], ctx = T.audioCtx(), lines = lyricItem(songId).lyrics;
    var get = function (k) { return Store.getTrack(T.key, songId, k, tr[k].ver).then(function (b) { return ctx.decodeAudioData(b); }); };
    return Promise.all([get('rehearsal'), get('performance')]).then(function (r) {
      return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () {
        var g = Melody.toMono(r[0]), p = Melody.toMono(r[1]), rate = r[0].sampleRate, offS = Melody.findOffset(g, p, rate), iso = Melody.isolate(g, p, offS);
        var regions = Melody.voiceRegions(iso.voice, rate), notes = Melody.notes(iso.voice, rate), al = Melody.alignLyrics(regions, lines.map(lyrCount)), n = 0;
        var out = al.map(function (x, i) { if (!x) return null; n++; return { t: x.t, e: x.e, s: Melody.sylTimes(notes, x.t, x.e, lyrCount(lines[i])) }; });
        return { n: n, off: offS / rate, lines: out.map(function (x) { return x && { t: +x.t.toFixed(2), e: +x.e.toFixed(2), s: x.s.map(function (v) { return +v.toFixed(2); }) }; }) };
      });
    });
  }

  /* where the singing of each line really stops (Colleen 2026-10-23: lines ending on a long note went dark too soon): the sung stretch in the
     guide vocals that holds the line's last word, so a held note stays lit and the light still goes off in music with no words. Saved as h
     (band track's clock); T.lineEnd uses it. If singing runs straight into the next line, a line stays lit until just after the next one starts. */
  var regionCache = {};
  function voiceRegionsFor(songId) {
    var tr = T.show.tracks[songId]; if (!tr || !tr.rehearsal || !tr.performance) return Promise.resolve(null);
    var key = songId + '|' + tr.rehearsal.ver + '|' + tr.performance.ver; if (regionCache[key]) return Promise.resolve(regionCache[key]);
    var ctx = T.audioCtx(), get = function (k) { return Store.getTrack(T.key, songId, k, tr[k].ver).then(function (b) { return ctx.decodeAudioData(b); }); };
    return Promise.all([get('rehearsal'), get('performance')]).then(function (r) {
      var g = Melody.toMono(r[0]), p = Melody.toMono(r[1]), rate = r[0].sampleRate, iso = Melody.isolate(g, p, Melody.findOffset(g, p, rate));
      return (regionCache[key] = Melody.voiceRegions(iso.voice, rate));
    });
  }
  function addHolds(songId, lines) {      // lines on the band track's clock; each gets h where the singing of it stops
    return voiceRegionsFor(songId).then(function (regs) {
      if (!regs || !regs.length) return;
      lines.forEach(function (x) {
        if (!x || x.hm) return; delete x.h;      // a stop set by hand stays
        var last = x.s && x.s.length ? x.s[x.s.length - 1] : x.t;
        var next = lines.filter(function (y) { return y && y !== x && y.t > last + 0.05; }).reduce(function (m, y) { return Math.min(m, y.t); }, Infinity);
        var reg = regs.find(function (g) { return g.s - 0.2 <= last && last <= g.e + 0.2; }) || regs.find(function (g) { return g.s > last && g.s < last + 0.6; });
        if (!reg) return;
        var end = Math.min(reg.e, next + 1, last + 12);
        x.h = +Math.max(end, last + 0.4).toFixed(2);
      });
    }).catch(function () {});
  }
  T.addHolds = addHolds;

  function lyricsPage(songId) {
    var song = T.songById(songId), scene = T.sceneById(song.scene), src = T.scriptScene(scene), tr = (T.show.tracks || {})[songId] || {};
    var item = src && src.items.find(function (it) { return it.type === 'song' && it.num === song.num; });
    T.setBar('Lyrics timing', '#/teacher/songs');
    if (!item || !item.lyrics.length) { app.innerHTML = '<p class="card">This song has no lyrics in the script. Import the script first.</p>'; return; }
    if (!tr.performance && !tr.rehearsal) { app.innerHTML = '<p class="card">Upload this song’s tracks first.</p>'; return; }
    /* Colleen: "play the guide vocal version so i can hear it". The page plays the guide vocals when they are here; the times are shown and tapped
       on that track's clock and saved on the band track's clock (what the piano, the bouncing ball and the song player use). off = how far the
       guide track runs ahead of the band track, worked out once from the two recordings (T.show.trackOffset). */
    var L = T.show.lyricTimes = T.show.lyricTimes || {}, mel = T.show.melody && T.show.melody[songId];
    var TO = T.show.trackOffset = T.show.trackOffset || {};
    var off = TO[songId] != null ? TO[songId] : mel && mel.offset != null ? mel.offset : null;
    var lines = item.lyrics, cnt = function (l) { return (l.syl && l.syl.length) || l.text.split(/\s+/).length; };
    var kind = tr.rehearsal ? 'rehearsal' : 'performance', audio = new Audio(), url = null, loaded = false;
    var shiftX = function (x, d) { if (!x) return x; var y = { t: x.t + d, e: x.e + d, s: (x.s || []).map(function (v) { return v + d; }) }; if (x.h != null) y.h = x.h + d; if (x.hm) y.hm = true; return y; };
    var saved = (L[songId] && L[songId].lines) ? JSON.parse(JSON.stringify(L[songId].lines)) : null;
    var times = lines.map(function () { return null; });
    var showSaved = function () { if (saved) times = saved.map(function (x) { return shiftX(x, kind === 'rehearsal' ? off : 0); }); };
    if (kind === 'performance' || !tr.performance) { if (off == null) off = 0; showSaved(); }
    else if (off != null) showSaved();
    else {      // line the two tracks up once (a few seconds), then show the saved times on the guide's clock
      var ctx0 = T.audioCtx(), get0 = function (k) { return Store.getTrack(T.key, songId, k, tr[k].ver).then(function (b) { return ctx0.decodeAudioData(b); }); };
      Promise.all([get0('rehearsal'), get0('performance')]).then(function (r) {
        var g = Melody.toMono(r[0]), p = Melody.toMono(r[1]), rate = r[0].sampleRate;
        off = +(Melody.findOffset(g, p, rate) / rate).toFixed(3); TO[songId] = off; showSaved();
        if (location.hash === '#/teacher/songs/lyrics/' + songId) draw();
      }).catch(function () { off = 0; showSaved(); if (location.hash === '#/teacher/songs/lyrics/' + songId) draw(); });
    }
    var load = function () {      // ready to jump to a time once it resolves (a jump before the track is loaded would be lost)
      return Store.getTrack(T.key, songId, kind, tr[kind].ver).then(function (b) {
        url = URL.createObjectURL(new Blob([b])); audio.src = url; loaded = true;
        return new Promise(function (ok) { if (audio.readyState >= 1) ok(); else audio.addEventListener('loadedmetadata', function () { ok(); }, { once: true }); });
      });
    };
    var spread = function (i) {      // syllables of a tapped line shared out until the next line
      var t = times[i].t, e = times[i].e || ((times[i + 1] && times[i + 1].t) || t + cnt(lines[i]) * 0.45), k = cnt(lines[i]);
      times[i].e = +e.toFixed(2); times[i].s = Melody.sylTimes([], t, e, k);
    };
    T.cleanup.push(function () { audio.pause(); if (url) URL.revokeObjectURL(url); });
    /* Colleen: "impossible to keep up with when the button is at the top and i have to scroll". The player sits in a bar fixed to the bottom of
       the screen (play, back, the time, Now with the words of the next line to tap, Save); while the track plays, the line being sung lights up
       and scrolls to the middle of the screen. */
    var view = 'timing', selSec = null, edited = false;
    /* sections that start together (a bracket: "Woh!" and "Get-" on one beat): a paired section (lyric.sync = how many sections back its
       partner is) always takes its partner's start; Now skips it */
    /* timing the sung lines and the spoken lines in separate passes (Colleen: "i can't program timing for both at the same time") */
    var timeKind = T.ls('timeKind') || 'all';      // part0 top, part1 middle (three staves only), part2 bottom (Colleen: two staves are top and bottom)
    /* one part at a time (Colleen 2026-10-24: "a whole vertical line of joined brackets… simultaneous but different singing… focus on one at a
       time and then reference those times for other syllables on the same note"): which staff of a bracketed system each line is sung on, read
       from the PDF's drawing (works for edited songs too). part 0 = the top staff; lines on a staff of their own count as part 0. */
    var geo = {}, geoP = null, maxParts = 1;
    function loadGeo() {
      if (geoP) return geoP;
      var need = {}; lines.forEach(function (l) { T.Pages.rawBoxes(l).forEach(function (b) { need[b.n] = 1; }); });
      geoP = Promise.all([T.loadPdfJs(), T.Pages.doc()]).then(function (r) {
        return Promise.all(Object.keys(need).map(function (n) {
          return r[1].getPage(+n).then(function (pg) { return pg.getOperatorList().then(function (ops) { geo[n] = ScriptParser.geometry(ops, r[0].OPS, pg.getViewport({ scale: 1 })).systems; }); });
        }));
      }).then(function () { Object.keys(geo).forEach(function (n) { geo[n].forEach(function (sy) { maxParts = Math.max(maxParts, sy.staves.length); }); }); });
      return geoP;
    }
    function sysAt(n, y) {      // the system and staff a lyric at (page n, y = top of its words) is sung on
      var best = null;
      (geo[n] || []).forEach(function (sy) { sy.staves.forEach(function (st, k) { var d = y - st.bottom; if (d > -4 && d < 75 && (!best || d < best.d)) best = { d: d, key: n + ':' + sy.top.toFixed(1), part: k === 0 ? 0 : k === sy.staves.length - 1 ? 2 : 1, many: sy.staves.length > 1 }; }); });
      return best;
    }
    function partOf(l) { var b = T.Pages.rawBoxes(l)[0]; return b ? sysAt(b.n, b.y) : null; }
    var kindOk = function (i) {
      var l = lines[i]; if (!l || timeKind === 'all') return true;
      if (timeKind === 'sung' || timeKind === 'spoken') return (timeKind === 'spoken') === !!l.spoken;
      if (l.spoken) return false;
      var want = +timeKind.slice(4), p = partOf(l);
      return p ? (p.many ? p.part === want : want === 0) : want === 0;      // a staff of its own counts as the top
    };
    var nextOpen = function () {      // the first untimed line after where the song is (Colleen: cleared lines below her spot, and Now went back to an earlier line)
      var open = function (x, i) { return !x && !(lines[i] && lines[i].sync) && kindOk(i); };
      var pos = audio.paused && seekTo != null ? seekTo : audio.currentTime, last = -1;
      times.forEach(function (x, i) { if (x && x.t <= pos + 0.3) last = i; });
      for (var i = last + 1; i < times.length; i++) if (open(times[i], i)) return i;
      return times.findIndex(open);
    };
    var applySync = function () {
      lines.forEach(function (l, i) {
        var p = l.sync && times[i - l.sync]; if (!p) return;
        var old = times[i];
        if (old) { var d = p.t - old.t; times[i] = { t: p.t, e: Math.max(old.e + d, p.t + 0.3), s: (old.s || []).map(function (v) { return v + d; }) }; }
        else times[i] = { t: p.t, e: p.e, s: Melody.sylTimes([], p.t, p.e, (l.syl && l.syl.length) || l.text.split(/\s+/).length) };
      });
    };
    /* Undo (Colleen: "what if i used the merge lyrics incorrectly. there's no undo button"): a copy of the sections, their singers and times
       before each change */
    var history = [];
    var snapshot = function () { history.push({ lines: JSON.parse(JSON.stringify(lines)), times: JSON.parse(JSON.stringify(times)), edited: edited }); if (history.length > 60) history.shift(); };
    var undo = function () {
      var h = history.pop(); if (!h) return;
      fixAt = null; fixOld = null;      // Undo ends a fix; the line gets back the time it had
      lines.splice.apply(lines, [0, lines.length].concat(h.lines)); times = h.times; edited = h.edited || true;
      T.toast('Undone. Press Save to keep it.');
      if (view === 'sections') { overlay(); secBar(); } else draw();
    };
    var slider = function () { return '<input type="range" class="lt-pos" id="ltpos" min="0" max="' + (audio.duration > 0 ? audio.duration.toFixed(1) : (tr[kind].dur || 0)) + '" step="0.1" value="' + audio.currentTime.toFixed(1) + '" aria-label="Where in the song">'; };
    var wireSlider = function () {
      var r = document.getElementById('ltpos'); if (!r) return;
      r.oninput = function () { r.dragging = true; var el = document.getElementById('tm'); if (el) el.textContent = T.clock(+r.value) + ' (' + (+r.value).toFixed(1) + ' s)'; };
      r.onchange = function () {
        r.dragging = false;
        if (audio.paused) { seekTo = +r.value; return; }      // a paused track starts from here when play is pressed
        audio.currentTime = +r.value; lastRow = -1; follow(true);
      };
    };
    var seekTo = null;
    var playPause = function () {
      if (off == null) { T.toast('One moment: lining up the two tracks.'); return; }
      (loaded ? Promise.resolve() : load()).then(function () {
        if (audio.paused) { if (seekTo != null) { audio.currentTime = seekTo; seekTo = null; } audio.play(); } else audio.pause();
        var b = document.getElementById('pl'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); }
      });
    };
    var undoBtn = function (id) { return '<button class="btn small" id="' + id + '"' + (history.length ? '' : ' disabled') + ' title="Undo the last change">↶ Undo</button>'; };
    var tabs = function () { if (wide() && splitOn) return '<div class="row" style="margin:6px 0 8px"><span class="muted small grow">The music with every section is beside the list.</span><button type="button" class="btn small" id="splitoff">One at a time</button></div>'; return (wide() ? '<button type="button" class="btn small" id="spliton" style="float:right">⇆ Side by side</button>' : '') + '<div class="seg" style="margin:6px 0 8px"><button type="button" data-view="timing" aria-pressed="' + (view === 'timing') + '">⏱ Timing</button><button type="button" data-view="sections" aria-pressed="' + (view === 'sections') + '">🎼 Sections on the music</button></div>'; };
    var wireTabs = function () {
      var so = document.getElementById('splitoff'), sn = document.getElementById('spliton');
      if (so) so.onclick = function () { splitOn = false; T.ls('ltSplit', false); draw(); };
      if (sn) sn.onclick = function () { splitOn = true; T.ls('ltSplit', true); view = 'timing'; draw(); };
      app.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { view = b.dataset.view; selSec = null; draw(); }; }); };
    function draw(msg) {
      if (view === 'sections') return drawSections();
      var nxt = fixAt != null ? fixAt : nextOpen();
      var H = '<div class="card"><h2>' + sym('🎵') + esc(song.title) + '</h2>' + tabs() + '<p class="muted small">When each lyric line is sung (for the lit-up lines and the piano). Tap <b>Now</b> right as the first word is sung; the line lights up a moment (0.4 second) before that for the singers. Let the app find them, or play and press <b>Now</b> (or Space) as each line starts. Then <b>Test</b> a line, nudge it with − and +, and Save.</p>' +
        '<div class="row"><button class="btn primary" id="find"' + (tr.rehearsal && tr.performance ? '' : ' disabled title="Needs both tracks"') + '>Find them in the guide vocals</button><button class="btn" id="addmiss" title="A whole line the app missed: type its words and it finds them on the pages">＋ Add a missing line</button><span class="muted small" id="msg">' + (msg || '') + '</span></div>' +
        '<p class="muted small">' + (kind === 'rehearsal' ? sym('🎤') + 'Playing the guide vocals (with the singers).' : 'Playing the band track (upload the guide vocals to hear the singers).') + (kind === 'rehearsal' && off == null ? ' <b>Lining up the two tracks…</b>' : '') + '</p></div>' +
        '<div class="row" style="margin:0 0 8px"><b>Time:</b> <div class="seg" id="tkind">' + [['all', 'Everything'], ['sung', '🎵 Sung lines'], ['spoken', '🗣 Spoken lines']].concat(maxParts > 1 ? [['part0', '⬆ Top part']].concat(maxParts > 2 ? [['part1', 'Middle part']] : []).concat([['part2', '⬇ Bottom part']]) : []).map(function (o) { return '<button type="button" data-tk="' + o[0] + '" aria-pressed="' + (timeKind === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div><span class="muted small">Now goes only to the lines you pick; the others keep their times.</span>' + (/^part/.test(timeKind) ? ' <button type="button" class="btn small" id="partwho" title="Set who sings every line of this part in the brackets">✎ Who sings this part</button>' : '') + (/^part/.test(timeKind) ? ' <button type="button" class="btn small primary" id="fillparts" title="Every other part in the brackets takes its times from this part, note by note">⤵ Fill the other parts from this one</button>' : '') + '</div>' +
        '<div class="row" style="margin:0 0 8px"><b>ALL in this song:</b> <span class="muted small grow">' + esc(allWhoText()) + '</span><button type="button" class="btn small" id="allwho">👥 Who is ALL?</button></div>' +
        '<div class="card lt-list">' + lines.map(function (l, i) {
          var x = times[i];
          return '<div class="switch lt-row' + (i === nxt ? ' lt-next' : '') + (kindOk(i) ? '' : ' lt-other') + '" data-row="' + i + '" style="flex-wrap:wrap"><span class="grow"><span class="muted small">' + (i + 1) + ' · </span><button type="button" class="lt-who" data-who="' + i + '" title="Change who sings this">' + esc(l.who || 'Who sings this?') + ' ✎</button>' + ' <button type="button" class="btn small quiet" data-words="' + i + '" title="Change the words of this line (add words that were missed)">✎ Words</button>' + (l.spoken ? ' <span class="tag">🗣 spoken</span>' : '') + (l.sync ? ' <span class="tag" title="Starts together with section ' + (i + 1 - l.sync) + '">⇄ with ' + (i + 1 - l.sync) + '</span>' : '') + '<br>' + (l.spoken ? '<i>' + esc(l.text) + '</i>' : esc(l.text)) + '</span>' +
            '<span class="row" style="gap:4px"><button class="btn small" data-nudge="' + i + '|-0.2" aria-label="Earlier">−</button>' + timeBox('data-tin="' + i + '"', x) + '<button class="btn small" data-nudge="' + i + '|0.2" aria-label="Later">+</button><button class="btn small" data-test="' + i + '"' + (x ? '' : ' disabled') + '>Test</button>' + endBox('data-hin="' + i + '"', x) + '<button class="btn small quiet" data-from="' + i + '" title="Retime from here: play from just before this line; each Now sets the next line, to the end of the song">⏩</button><button class="btn small quiet" data-show="' + i + '" title="Show this line on the sheet music">📍</button><button class="btn small quiet" data-del="' + i + '" title="Delete this line (it is not a lyric or a spoken line)">🗑</button><button class="btn small" data-fix="' + i + '" title="Clears this line’s time and plays from 3 seconds before; tap Now when it starts. The lines after it keep their times.">🎯 Fix</button><button class="btn small quiet" data-clear="' + i + '"' + (x ? '' : ' disabled') + ' title="Clear this line’s time">✕ Clear</button></span></div>';
        }).join('') + '</div><div class="lt-space"></div>' +
        '<div class="dock lt-dock"><div class="in">' +
          (stopsOn ? '<div class="lt-stops" id="stops"><span class="muted small">Play, and tap a line the moment its singing stops. Lines you skip keep the automatic end.</span></div>' : '') +
          '<div class="lt-next-words" id="ltnext"' + (stopsOn ? ' hidden' : '') + '>' + (nxt < 0 ? sym('✅') + 'Every line has a time. Use 🎯 Fix on a line to change it.' : '<span class="muted small">' + (fixAt != null ? (fixRun ? '⏩ Retiming · line ' + (nxt + 1) + ' (each Now sets the next line, to the end; Done fixing when you are finished)' : fixOld || !times[nxt] ? '🎯 Fixing · line ' + (nxt + 1) : '🎯 Line ' + (nxt + 1) + ' keeps its time. Tap Now only to redo it too, or press Done fixing') : 'Next to tap · line ' + (nxt + 1)) + '</span><br>' + esc(lines[nxt].text)) + '</div>' +
          slider() + '<div class="row lt-controls"><button class="round" id="pl" aria-label="Play">' + icon(audio.paused ? 'play' : 'pause') + '</button><button class="btn small" id="bk">Back 3 s</button><b id="tm" class="lt-time">' + T.clock(audio.currentTime) + '</b>' +
          (stopsOn ? '' : '<button class="btn primary lt-now" id="now"' + (nxt < 0 ? ' disabled' : '') + '>Now</button>') + '<button class="btn small' + (stopsOn ? ' primary' : '') + '" id="stopsb" title="Play the song and tap each line when its singing stops">✋ ' + (stopsOn ? 'Done setting stops' : 'Set the stops') + '</button>' + (fixAt != null ? '<button class="btn small" id="fixdone">Done fixing</button>' : '') + '<span class="grow"></span>' + undoBtn('undo1') + '<button class="btn small quiet" id="clr">Clear all timing</button><button class="btn primary" id="sv" data-save>Save</button></div>' +
        '</div></div>';
      var split = wide() && splitOn && T.Follow && T.Follow.canShow(songId);
      if (!split) app.innerHTML = H;
      else {
        var cut = H.indexOf('<div class="dock lt-dock">'), left = H.slice(0, cut), dock = H.slice(cut);
        var keepY = window.scrollY, lt = document.getElementById('ltleft');
        if (lt && document.getElementById('secpages')) {      // the music stays; only the list and the player bar are drawn again
          lt.innerHTML = left; var old = app.querySelector('.lt-dock'); if (old) old.outerHTML = dock; else app.insertAdjacentHTML('beforeend', dock);
          window.scrollTo(0, keepY);
        } else {
          app.innerHTML = '<div class="lt-split"><div class="lt-left" id="ltleft">' + left + '</div><div class="lt-right" id="ltright"><div id="secbar" class="lt-secbar"></div><div id="secpages" class="pages"></div></div></div>' + dock;
          var host = document.getElementById('secpages');
          T.Follow.mount(host, songId);
          host.addEventListener('click', function (e) { var b = e.target.closest('.sec-box, .sec-num'); if (!b) return; selSec = +b.dataset.sec; overlay(); secBar(); var r = pickRow(); if (r) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
        }
        litKey = ''; overlay(); secBar(); pickRow();
      }
      var $ = function (id) { return document.getElementById(id); };
      wireTabs(); lastRow = -1; follow(true, true); wireSlider();
      $('undo1').onclick = undo;
      $('allwho').onclick = pickAll;
      $('pl').onclick = playPause;
      $('bk').onclick = function () { audio.currentTime = Math.max(0, audio.currentTime - 3); };
      if ($('now')) $('now').onclick = tap; $('find').onclick = find; $('addmiss').onclick = addMissing;
      $('stopsb').onclick = function () { stopsOn = !stopsOn; if (stopsOn) fixAt = null; draw(); };
      $('clr').onclick = function () { if (!confirm('Clear the timing of every line in this song? (↶ Undo brings it back.)')) return; snapshot(); fixAt = null; fixOld = null; times = lines.map(function () { return null; }); draw(); };
      $('sv').onclick = function () {
        if (off == null) { T.toast('One moment: lining up the two tracks.'); return; }
        if (fixAt != null) endFix();
        applySync();
        var base = function (v) { return kind === 'performance' ? v : v - off; };
        if (!times.some(Boolean)) { delete L[songId]; return save('Cleared'); }
        L[songId] = { kind: 'performance', lines: times.map(function (x) { return x ? { t: +base(x.t).toFixed(2), e: +base(x.e).toFixed(2), s: x.s.map(function (v) { return +base(v).toFixed(2); }) , h: x.hm ? +base(x.h).toFixed(2) : undefined, hm: x.hm || undefined } : null; }) };
        if (edited) { (T.show.lyricKeep = T.show.lyricKeep || {})[song.num] = true; edited = false; }
        T.toast('Saving… (finding where each line’s singing ends)', 3000);
        addHolds(songId, L[songId].lines).then(function () { if (kind === 'rehearsal') L[songId].lines.forEach(function (x, i) { if (x && times[i] && !times[i].hm) { if (x.h != null) times[i].h = x.h + off; else delete times[i].h; } }); else L[songId].lines.forEach(function (x, i) { if (x && times[i] && !times[i].hm) { if (x.h != null) times[i].h = x.h; else delete times[i].h; } }); })
          .then(function () { return makePiano(songId).catch(function () {}); }).then(function () { return save('Lyrics timing saved (and the piano melody with it)'); }).then(function () { view = 'sections'; selSec = null; draw(); });
      };
      app.querySelectorAll('[data-nudge]').forEach(function (b) { b.onclick = function () { var q = b.dataset.nudge.split('|'), x = times[+q[0]]; if (!x) return; snapshot(); var d = +q[1]; x.t += d; x.e += d; if (x.h != null) x.h += d; x.s = x.s.map(function (v) { return v + d; }); applySync(); draw(); }; });
      app.querySelectorAll('[data-fix]').forEach(function (b) { b.onclick = function () { fixLine(+b.dataset.fix); }; });
      if ($('fillparts')) $('fillparts').onclick = fillParts;
      if ($('partwho')) $('partwho').onclick = partSinger;
      if (!geoP) loadGeo().then(function () { if (timeKind === 'part1' && maxParts < 3) timeKind = 'part2'; if (maxParts > 1 && location.hash.indexOf('/lyrics/' + songId) > 0) draw(); });
      app.querySelectorAll('[data-tk]').forEach(function (b) { b.onclick = function () { timeKind = b.dataset.tk; T.ls('timeKind', timeKind); fixAt = null; draw(); }; });
      app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.del; delSec(i); if (selSec != null && selSec >= lines.length) selSec = null; draw(); T.toast('Line ' + (i + 1) + ' deleted. ↶ Undo brings it back; Save keeps it.', 4000); }; });
      app.querySelectorAll('[data-from]').forEach(function (b) { b.onclick = function () { runFrom(+b.dataset.from); }; });
      app.querySelectorAll('[data-show]').forEach(function (b) { b.onclick = function () { selSec = +b.dataset.show; if (isSplit()) { overlay(); secBar(); pickRow(); showSec(selSec, true); return; } audio.pause(); view = 'sections'; draw(); }; });
      app.querySelectorAll('[data-hin]').forEach(function (inp) { inp.onchange = function () { if (typeEnd(+inp.dataset.hin, inp.value)) draw(); else inp.value = fmtH(times[+inp.dataset.hin]); }; });
      app.querySelectorAll('[data-tin]').forEach(function (inp) { inp.onchange = function () { if (typeTime(+inp.dataset.tin, inp.value)) draw(); else inp.value = fmtT(times[+inp.dataset.tin]); }; });
      app.querySelectorAll('[data-clear]').forEach(function (b) { b.onclick = function () { clearLine(+b.dataset.clear); draw(); }; });
      if ($('fixdone')) $('fixdone').onclick = function () { endFix(); audio.pause(); draw(); };
      app.querySelectorAll('[data-who]').forEach(function (b) { b.onclick = function () { pickSinger(+b.dataset.who); }; });
      app.querySelectorAll('[data-words]').forEach(function (b) { b.onclick = function () { editWords(+b.dataset.words); }; });
      app.querySelectorAll('[data-test]').forEach(function (b) { b.onclick = function () { var x = times[+b.dataset.test]; (loaded ? Promise.resolve() : load()).then(function () { seekTo = null; audio.currentTime = Math.max(0, x.t - 1); audio.play(); var pb = document.getElementById('pl'); if (pb) pb.innerHTML = icon('pause'); }); }; });
    }
    /* Sections on the music (Colleen: after Save, "show all the highlights i added in their sections simultaneously… edit the names, colors,
       starts and stops"): the song's real pages with every section lit up in its singer's colors and numbered. Tap one to edit it in the bar
       at the bottom: who sings it (the color follows), its start (− + Test, or Fix), and which words it covers (start a new section at a word,
       or join it with the one before or after). Edited songs are kept as they are when the script is imported again (T.show.lyricKeep). */
    /* side by side (Colleen 2026-10-23: "the timings coding page on one panel and the sheet music right beside it… instead of toggling back and
       forth"): on a wide screen the list is on the left and the song's pages with every section on the right; tapping a section picks its line on
       the left, 📍 on a line shows its section on the right, the lines being sung light up on the music and it scrolls along. */
    var wide = function () { return window.innerWidth >= 1000; };
    var splitOn = T.ls('ltSplit') !== false;
    function isSplit() { return wide() && splitOn && !!document.getElementById('ltleft'); }
    function refresh() { if (isSplit()) draw(); else { overlay(); secBar(); } }
    function pickRow() {      // the selected section's line in the list
      app.querySelectorAll('.lt-row.lt-pick').forEach(function (r) { r.classList.remove('lt-pick'); });
      var r = selSec != null && app.querySelector('.lt-row[data-row="' + selSec + '"]'); if (r) r.classList.add('lt-pick');
      return r;
    }
    function showSec(i, pulse) {      // bring section i into view in the music panel
      var pane = document.getElementById('ltright'), n = pane && pane.querySelector('.sec-num[data-sec="' + i + '"]'); if (!n) return;
      var pr = pane.getBoundingClientRect(), nr = n.getBoundingClientRect(), y = nr.top - pr.top;
      if (pulse || y < 60 || y > pr.height * 0.7) pane.scrollTo({ top: pane.scrollTop + y - pr.height * 0.35, behavior: T.prefs.motion && !pulse ? 'smooth' : 'auto' });
      if (pulse) { n.classList.remove('sec-find'); void n.offsetWidth; n.classList.add('sec-find'); }
    }
    var litKey = '', paneScrollAt = 0;
    function lightMusic(onNow) {      // the lines being sung, lit on the music panel
      var pane = document.getElementById('ltright'); if (!pane) return;
      var key = onNow.join(','); if (key === litKey) return; litKey = key;
      pane.querySelectorAll('.sec-box.sec-on').forEach(function (e) { e.classList.remove('sec-on'); });
      onNow.forEach(function (k) { pane.querySelectorAll('.sec-box[data-sec="' + k + '"]').forEach(function (e) { e.classList.add('sec-on'); }); });
      if (onNow.length && Date.now() - paneScrollAt > 700) { paneScrollAt = Date.now(); showSec(onNow[onNow.length - 1]); }
    }
    function drawSections() {
      if (wide() && splitOn) { view = 'timing'; return draw(); }
      app.innerHTML = '<div class="card noprint"><h2>' + sym('🎵') + esc(song.title) + '</h2>' + tabs() +
        '<p class="muted small">Every section, lit up in its singer’s colors and numbered. Tap one to change who sings it, when it starts, or where it starts and ends. Then Save.</p>' +
        '<p class="row"><button class="btn small" id="sreset">Reset this song</button><span class="muted small" id="sresetmsg">Puts the sections back the way the script reads them (your ✎ singer fixes stay). Then find the timing again.</span></p></div>' +
        '<div id="secpages" class="pages"></div><div class="lt-space"></div><div class="dock lt-dock"><div class="in" id="secbar"></div></div>';
      wireTabs();
      document.getElementById('sreset').onclick = resetSong;
      var host = document.getElementById('secpages');
      if (!T.Follow || !T.Follow.canShow(songId)) { host.innerHTML = '<p class="card muted">The script pages are not saved yet: import the script PDF first.</p>'; return secBar(); }
      T.Follow.mount(host, songId); overlay(); secBar();
      if (selSec != null) setTimeout(function () { var n = host.querySelector('.sec-num[data-sec="' + selSec + '"]'); if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('sec-find'); } }, 120);      // 📍 from the Timing list (the pages keep their size while they draw)
      host.addEventListener('click', function (e) { var b = e.target.closest('.sec-box, .sec-num'); if (b) { selSec = +b.dataset.sec; overlay(); secBar(); } });
    }
    function overlay(dragging) {
      var host = document.getElementById('secpages'); if (!host) return;
      host.querySelectorAll(dragging ? '.sec-box, .sec-num' : '.sec-box, .sec-num, .sec-h, .sec-x').forEach(function (e) { e.remove(); });
      T.Pages.setNeighbors(lines);      // neighbors on a row meet halfway
      var pc = function (v, d) { return (v / d * 100) + '%'; };
      lines.forEach(function (l, i) {
        var cs = T.lyricColors(l.who), fill = cs.length > 1 ? 'linear-gradient(180deg,' + cs.map(function (c, k) { return c + ' ' + (k * 100 / cs.length) + '% ' + ((k + 1) * 100 / cs.length) + '%'; }).join(',') + ')' : cs[0];
        T.Pages.shapes(host, T.Pages.lyricBoxes(l), { cls: 'sec-box' + (i === selSec ? ' sel' : '') + (times[i] ? '' : ' untimed') + (l.spoken ? ' spoken' : ''), colors: cs, data: { sec: i }, title: (i + 1) + ' · ' + (l.who || '') + ' · ' + l.text }).forEach(function (sh, si) {
          if (si) return;      // the section's number, at the start of its first part
          var num = document.createElement('span'); num.className = 'sec-num'; num.textContent = i + 1; num.dataset.sec = i;
          num.style.cssText = 'left:' + pc(sh.left, sh.sz.w) + ';top:' + pc(sh.top + 6, sh.sz.h);
          sh.page.appendChild(num);
        });
      });
      if (selSec != null && lines[selSec] && !dragging) handles(host, selSec);
    }
    /* the selected section's ends (Colleen: "i don't have the ability to shorten this highlight to keep it only on words"): drag the round
       handle at either end of a piece, or ✕ to take a piece away (a stray box with no words). Kept in l.cut, so a re-import keeps it. */
    function handles(host, i) {
      host.querySelectorAll('.sec-h, .sec-x').forEach(function (e) { e.remove(); });
      var l = lines[i], shown = T.Pages.lyricBoxes(l);
      shown.forEach(function (b) {
        var page = host.querySelector('.pdfpage[data-n="' + b.n + '"]'); if (!page) return;
        var sz = T.Pages.size(b.n), pc = function (v, d) { return (v / d * 100) + '%'; }, mid = b.y + b.h / 2;
        ['x0', 'x1'].forEach(function (side) {
          var h = document.createElement('span'); h.className = 'sec-h'; h.title = 'Drag to move this end';
          h.style.cssText = 'left:' + pc(side === 'x0' ? b.x : b.x + b.w, sz.w) + ';top:' + pc(mid, sz.h);
          h.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation(); snapshot(); h.setPointerCapture(e.pointerId);
            var cut = l.cut = l.cut || {}, raf = 0;
            var move = function (ev) {
              var r = page.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * sz.w;
              var c = cut[b.k] || { x0: b.x, x1: b.x + b.w };
              c = side === 'x0' ? { x0: Math.min(x, c.x1 - 4), x1: c.x1 } : { x0: c.x0, x1: Math.max(x, c.x0 + 4) };
              cut[b.k] = { x0: +c.x0.toFixed(1), x1: +c.x1.toFixed(1) };
              h.style.left = pc(cut[b.k][side], sz.w);
              if (!raf) raf = requestAnimationFrame(function () { raf = 0; overlay(true); });
            };
            var up = function () { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); edited = true; overlay(); secBar(); };
            h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
          });
          page.appendChild(h);
        });
        if (shown.length > 1) {
          var x = document.createElement('button'); x.type = 'button'; x.className = 'sec-x'; x.textContent = '✕'; x.title = 'Take this piece away';
          x.style.cssText = 'left:' + pc(b.x + b.w, sz.w) + ';top:' + pc(b.y, sz.h);
          x.onclick = function (e) { e.stopPropagation(); snapshot(); (l.cut = l.cut || {})[b.k] = 0; edited = true; overlay(); secBar(); };
          page.appendChild(x);
        }
      });
    }
    function secBar() {
      var bar = document.getElementById('secbar'); if (!bar) return;
      var i = selSec, l = i != null ? lines[i] : null, x = i != null ? times[i] : null, toks = l ? (l.syl || []).map(function (y) { return y.t; }) : [];
      if (isSplit() && !l) { bar.innerHTML = '<p class="muted small" style="margin:4px 0">Tap a section on the music to change it: who sings it, where it starts and ends, join or split it.</p>'; return; }
      bar.innerHTML = (isSplit() ? '' : slider()) + (!l ? '<div class="row lt-controls"><button class="round" id="pl" aria-label="Play">' + icon(audio.paused ? 'play' : 'pause') + '</button><b id="tm" class="lt-time">' + T.clock(audio.currentTime) + '</b><span class="grow muted">Tap a section on the music to edit it.</span>' + undoBtn('undo2') + '<button class="btn primary" id="sv2" data-save>Save</button></div>' :
        '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b>Section ' + (i + 1) + '</b><button type="button" class="lt-who" id="swho">' + esc(l.who || 'Who sings this?') + ' ✎</button>' +
          '<span class="grow"></span><button class="btn small" id="snm">−</button>' + timeBox('id="stin"', x) + '<button class="btn small" id="snp">+</button><button class="btn small" id="stest"' + (x ? '' : ' disabled') + '>Test</button><button class="btn small" id="sfix">🎯 Fix</button><button class="btn small quiet" id="sclr"' + (x ? '' : ' disabled') + '>✕ Clear time</button></div>' +
        '<div class="sec-words">' + (toks.length && toks.every(function (t) { return t != null; }) ? toks.map(function (t, k) { return k ? '<button type="button" class="sec-word" data-split="' + k + '" title="Start a new section here">' + esc(t) + '</button>' : '<span class="sec-word first">' + esc(t) + '</span>'; }).join('') + ' <span class="muted small">(tap a word to start a new section there)</span>' : esc(l.text)) + '</div>' +
        '<p class="muted small" style="margin:4px 0">Drag the round handles at the ends of the highlight to shorten or stretch it' + (T.Pages.lyricBoxes(l).length > 1 ? '; ✕ takes a piece away' : '') + '.' + (l.cut ? ' <button class="btn small quiet" id="sfit">Fit to the words again</button>' : '') + '</p>' +
        '<div class="row lt-controls"><button class="btn small" id="swords">✎ Edit the words</button><button class="btn small" id="sdel">🗑 Delete</button><button class="btn small" id="sjp"' + (i > 0 ? '' : ' disabled') + '>⤒ Join with ' + (i) + '</button><button class="btn small" id="sjn"' + (i < lines.length - 1 ? '' : ' disabled') + '>Join with ' + (i + 2) + ' ⤓</button>' + joinMenu(i) + '<span class="grow"></span>' + undoBtn('undo2') + '<button class="btn small quiet" id="sdone">Done</button><button class="btn primary" id="sv2" data-save>Save</button></div>');
      var $ = function (id) { return document.getElementById(id); };
      $('sv2').onclick = function () { var b = $('sv'); if (b) b.click(); else saveSections(); };
      $('undo2').onclick = function () { undo(); if (selSec != null && selSec >= lines.length) selSec = null; refresh(); };
      wireSlider();
      if ($('pl')) $('pl').onclick = playPause;
      if (!l) return;
      $('sdone').onclick = function () { selSec = null; refresh(); };
      $('swords').onclick = function () { editWords(i); };
      if ($('sfit')) $('sfit').onclick = function () { snapshot(); delete l.cut; edited = true; refresh(); };
      $('swho').onclick = function () { pickSinger(i, function () { refresh(); }); };
      $('snm').onclick = function () { nudge(i, -0.2); }; $('snp').onclick = function () { nudge(i, 0.2); };
      $('stest').onclick = function () { (loaded ? Promise.resolve() : load()).then(function () { seekTo = null; audio.currentTime = Math.max(0, x.t - 1); audio.play(); }); };
      $('sfix').onclick = function () { view = 'timing'; fixLine(i); };
      $('stin').onchange = function () { if (typeTime(i, this.value)) { refresh(); } else this.value = fmtT(times[i]); };
      $('sclr').onclick = function () { clearLine(i); refresh(); };
      $('sjp').onclick = function () { joinSec(i - 1); selSec = i - 1; refresh(); };
      $('sjn').onclick = function () { joinSec(i); refresh(); };
      if ($('sjw')) $('sjw').onchange = function () { var j = +this.value; if (isNaN(j)) return; joinPair(i, j); selSec = Math.min(i, j); refresh(); };
      $('sdel').onclick = function () { delSec(i); selSec = null; refresh(); T.toast('Section deleted. ↶ Undo brings it back; Save keeps it.'); };
      bar.querySelectorAll('[data-split]').forEach(function (b) { b.onclick = function () { splitSec(i, +b.dataset.split); selSec = i + 1; refresh(); }; });
      if (isSplit()) { ['sv2', 'undo2'].forEach(function (id) { var e = $(id); if (e) e.remove(); }); bar.classList.add('compact'); }      // the player bar below has Undo and Save
    }
    function saveSections() { $sv(); }
    function joinMenu(i) {      // the sections near this one, the same singer's first
      var near = []; for (var k = Math.max(0, i - 6); k <= Math.min(lines.length - 1, i + 6); k++) if (k !== i && Math.abs(k - i) > 1) near.push(k);
      if (!near.length) return '';
      var same = function (k) { return String(lines[k].who || '') === String(lines[i].who || ''); };
      near.sort(function (p, q) { return (same(q) - same(p)) || Math.abs(p - i) - Math.abs(q - i); });
      return '<select id="sjw" class="btn small" aria-label="Join with another section"><option value="">Join with…</option>' + near.map(function (k) {
        return '<option value="' + k + '">' + (k + 1) + ' · ' + esc(lines[k].who || '?') + ' · ' + esc(String(lines[k].text || '').slice(0, 28)) + '</option>'; }).join('') + '</select>';
    }
    /* the song's sections as the script reader makes them (the saved PDF read again), the timing cleared to find again */
    function resetSong() {
      if (!confirm('Put “' + song.title + '” back the way the script reads it? Its sections and their timing are replaced; your ✎ singer fixes stay.')) return;
      var m = document.getElementById('sresetmsg'), btn = document.getElementById('sreset'); btn.disabled = true;
      T.Pages.doc().then(function (pdf) { return ScriptParser.fromPdfJs(pdf, function (n, N) { if (m) m.textContent = 'Reading the script… page ' + n + ' of ' + N; }); }).then(function (pages) {
        var r = ScriptParser.parse(pages, { songNumbers: T.O().songs.map(function (x) { return x.num; }) });
        var fresh = null; r.scenes.forEach(function (sc) { sc.items.forEach(function (it) { if (it.type === 'song' && String(it.num) === String(song.num)) fresh = it; }); });
        if (!fresh) throw new Error('This song was not found in the script.');
        var W = (T.show.lyricWho || {})[song.num] || {};
        T.applyWhoFixes(fresh.lyrics, W);
        snapshot();
        lines.splice.apply(lines, [0, lines.length].concat(fresh.lyrics));
        times = lines.map(function () { return null; });
        if (T.show.lyricKeep) delete T.show.lyricKeep[song.num];
        delete L[songId]; if (T.show.sheetMelody) delete T.show.sheetMelody[songId];
        edited = false; selSec = null;
        return save('“' + song.title + '” reset to the script. Find its timing again.');
      }).then(function () { view = 'timing'; draw('Reset to the way the script reads it. Press “Find them in the guide vocals” (or tap Now) to time it again.'); })
        .catch(function (e) { btn.disabled = false; if (m) m.textContent = ''; T.toast(e.message || 'Could not reset the song.', 5000); });
    }
    var $sv = function () {      // the same as Save on the Timing tab
      if (off == null) { T.toast('One moment: lining up the two tracks.'); return; }
      applySync();
      var base = function (v) { return kind === 'performance' ? v : v - off; };
      L[songId] = { kind: 'performance', lines: times.map(function (x) { return x ? { t: +base(x.t).toFixed(2), e: +base(x.e).toFixed(2), s: (x.s || []).map(function (v) { return +base(v).toFixed(2); }) , h: x.hm ? +base(x.h).toFixed(2) : undefined, hm: x.hm || undefined } : null; }) };
      if (edited) { (T.show.lyricKeep = T.show.lyricKeep || {})[song.num] = true; edited = false; }
      addHolds(songId, L[songId].lines).then(function () { return makePiano(songId).catch(function () {}); }).then(function () { return save('Saved (and the piano melody with it)'); }).then(function () { overlay(); secBar(); });
    };
    function nudge(i, d) { var x = times[i]; if (!x) return; snapshot(); x.t += d; x.e += d; if (x.h != null) x.h += d; x.s = x.s.map(function (v) { return v + d; }); applySync(); secBar(); }
    /* a section's boxes from its syllables (each knows which box it sits in) */
    function boxesFor(syl, boxesOf) {
      var out = [], idx = [];
      syl.forEach(function (y) {
        var b = boxesOf(y), k = idx.findIndex(function (q) { return q === b || (q.n === b.n && Math.abs(q.y - b.y) < 1); });
        if (k < 0) { idx.push(b); out.push({ n: b.n, y: b.y, h: b.h, x: y.x - 1, x1: y.x + y.w + 1 }); k = out.length - 1; }
        else { out[k].x = Math.min(out[k].x, y.x - 1); out[k].x1 = Math.max(out[k].x1, y.x + y.w + 1); }
        y.b = k;
      });
      return out.map(function (b) { return { n: b.n, x: +b.x.toFixed(1), y: b.y, w: +(b.x1 - b.x).toFixed(1), h: b.h }; });
    }
    function setLine(l, syl, boxesOf) {
      var bx = boxesFor(syl, boxesOf);
      l.syl = syl; l.box = bx[0]; if (bx.length > 1) l.boxes = bx; else delete l.boxes; delete l.cut;
      l.text = ScriptParser.cleanLyric(syl.map(function (y) { return y.t; }).join(' '));
    }
    function splitSec(i, k) {
      snapshot();
      var l = lines[i], old = T.Pages.rawBoxes(l), of = function (y) { return old[y.b || 0]; };
      var a = l.syl.slice(0, k).map(function (y) { return Object.assign({}, y); }), b = l.syl.slice(k).map(function (y) { return Object.assign({}, y); });
      var bOf = b.map(of), aOf = a.map(of);
      var n2 = { who: l.who, page: l.page };
      setLine(l, a, function (y) { return aOf[a.indexOf(y)]; }); setLine(n2, b, function (y) { return bOf[b.indexOf(y)]; });
      lines.splice(i + 1, 0, n2);
      var x = times[i], t2 = null;
      if (x) { var sk = x.s && x.s[k] != null ? x.s[k] : x.t; t2 = { t: sk, e: x.e, s: (x.s || []).slice(k) }; times[i] = { t: x.t, e: sk, s: (x.s || []).slice(0, k) }; }
      times.splice(i + 1, 0, t2); edited = true;
    }
    /* a whole line the script reader missed (Colleen 2026-10-24: "if a whole line is missing, i need a way to add it and have you find it on the
       pages"): she types its words and where it goes; the song's pages are read again (the words printed under the notes, syllable by syllable)
       and the words are found there, in reading order, also across staves and onto the next page. Of several places with those words, the one
       not already a section and closest to where it belongs wins. Not found: the shortest start of it that is found (drag its end to finish),
       or added without a place on the music. */
    /* letters only, for matching: joined letters some PDFs use (ﬁ, ﬂ) and accents come apart first */
    var letters = function (s) { return String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z]/g, ''); };
    var GLYPH = /[œ‰Œ¿Ó∑ˆ˙»«Ä≈¬∫]/g;
    var mctx = null, textW = function (str) { if (!mctx) { mctx = document.createElement('canvas').getContext('2d'); mctx.font = '10px "Times New Roman", serif'; } return mctx.measureText(str).width; };      // where each word sits inside a printed run
    function songRows() {      // every printed row of words on the song's pages (and the page before and after): [{ n, y, h, toks: [{ x, w, t, l }] }]
      var ns = []; lines.forEach(function (l) { T.Pages.rawBoxes(l).forEach(function (b) { ns.push(b.n); }); });
      var lo = Math.max(1, Math.min.apply(null, ns) - 1), hi = Math.max.apply(null, ns) + 1;
      return T.Pages.doc().then(function (pdf) {
        var want = []; for (var n = lo; n <= Math.min(hi, pdf.numPages); n++) want.push(n);
        return Promise.all(want.map(function (n) {
          return pdf.getPage(n).then(function (pg) {
            var vp = pg.getViewport({ scale: 1 });
            return pg.getTextContent().then(function (tc) {
              /* every text item, any size (spoken lines and titles too), split into words where it holds several; items on one baseline make a row */
              var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) { var tr = it.transform, pt = vp.convertToViewportPoint(tr[4], tr[5]); return { str: it.str, x: pt[0], y: pt[1], w: it.width || 0, size: Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]) || 12 }; })
                .sort(function (p, q) { return p.y - q.y || p.x - q.x; });
              var rows = [];
              items.forEach(function (it) {
                var tol = Math.max(2, it.size * 0.3), row = null;
                for (var i = rows.length - 1; i >= 0 && i >= rows.length - 3; i--) if (Math.abs(rows[i].y0 - it.y) <= tol) { row = rows[i]; break; }
                if (!row) { row = { y0: it.y, size: it.size, items: [] }; rows.push(row); }
                row.items.push(it);
              });
              return rows.map(function (r) {
                var toks = [];
                r.items.sort(function (p, q) { return p.x - q.x; }).forEach(function (p) {
                  var str = p.str.replace(GLYPH, ' '), re = /[^\s\-–—_]+/g, m, full = textW(str) || 1;
                  while ((m = re.exec(str))) { var lt = letters(m[0]); if (lt) toks.push({ x: +(p.x + p.w * textW(str.slice(0, m.index)) / full).toFixed(1), w: +(p.w * textW(m[0]) / full).toFixed(1), t: m[0], l: lt }); }
                });
                return { n: n, y: +(r.y0 - r.size * 0.95).toFixed(1), h: +(r.size * 1.25).toFixed(1), toks: toks };
              }).filter(function (r) { return r.toks.length && r.toks.some(function (t) { return t.l.length >= 3; }); });      // a row of single letters is music symbols, not words
            });
          });
        })).then(function (pages) { return [].concat.apply([], pages); });
      });
    }
    var isLabel = function (t) { var w = t.t.replace(/[:.,]$/, ''); return w.length > 1 && /^[A-Z][A-Z.’'&]*$/.test(w); };      // a singer's name printed on the staff
    /* the printed syllables from a start, following the line onto later rows (skipping a name printed at a row's start), until `n` letters are
       read or the words stop matching. fuzzy: keep reading while the letters roughly agree (a typo, a missed word). */
    function walk(rows, ri, ti, target, fuzzy) {
      var path = [], got = '', r = ri, k = ti, hops = 0;
      var agree = function (s) { if (!fuzzy) return target.indexOf(s) === 0; return lev(target.slice(0, s.length), s) <= Math.max(1, Math.ceil(s.length * 0.25)); };
      while (got.length < target.length && r < rows.length) {
        var t = rows[r].toks[k];
        if (!t) {      // the end of a row: go on in one of the next rows, at its first syllable after any printed name
          var nx = -1, nk = 0;
          for (var q = r + 1; q < Math.min(rows.length, r + 7) && nx < 0; q++) {
            var j = 0; while (rows[q].toks[j] && isLabel(rows[q].toks[j]) && !agree(got + rows[q].toks[j].l)) j++;
            if (rows[q].toks[j] && agree(got + rows[q].toks[j].l)) { nx = q; nk = j; }
          }
          if (nx < 0 || ++hops > 4) break; r = nx; k = nk; continue;
        }
        if (!agree(got + t.l)) break;
        path.push({ x: t.x, w: t.w, t: t.t, _o: { n: rows[r].n, y: rows[r].y, h: rows[r].h } }); got += t.l; k++;
      }
      return { path: path, got: got };
    }
    function lev(a, b) {      // letters that differ (edits) between two strings
      var m = a.length, n = b.length, d = []; for (var i = 0; i <= n; i++) d[i] = i;
      for (var x = 1; x <= m; x++) { var prev = d[0]; d[0] = x; for (var y = 1; y <= n; y++) { var c = d[y]; d[y] = Math.min(d[y] + 1, d[y - 1] + 1, prev + (a[x - 1] === b[y - 1] ? 0 : 1)); prev = c; } }
      return d[n];
    }
    function nameBefore(row, ti) { var nm = []; for (var q = ti - 1; q >= 0 && isLabel(row.toks[q]); q--) nm.unshift(row.toks[q].t.replace(/[:.,]$/, '')); return nm.join(' '); }
    function matchAt(rows, target, fuzzy) {      // every place the letters of target are printed, in reading order; a line may go on to later rows
      var found = [];
      rows.forEach(function (row, ri) {
        row.toks.forEach(function (tk, ti) {
          if (fuzzy ? lev(target.slice(0, tk.l.length), tk.l) > Math.floor(tk.l.length * 0.34) : target.indexOf(tk.l) !== 0) return;
          var w = walk(rows, ri, ti, target, fuzzy);
          if (!w.path.length) return;
          if (!fuzzy && w.got !== target) return;
          if (fuzzy) { if (w.got.length < target.length * 0.8) return; w.path.miss = lev(target, w.got) / target.length; if (w.path.miss > 0.25) return; }
          w.path.name = nameBefore(row, ti); found.push(w.path);
        });
      });
      return found;
    }
    /* where typed words are printed: the place not already another section, nearest to where the line belongs (between the sections before and
       after it); self: the section being changed, whose own place counts as free. { best, part } (part: only that start was found), or {} */
    function findPlace(words, at, self) {
      return songRows().then(function (rows) {
        var others = lines.filter(function (l, k) { return k !== self; });
        var used = function (path) { return others.some(function (l) { var bs = T.Pages.rawBoxes(l); return path.some(function (y) { return bs.some(function (b) { return b.n === y._o.n && Math.abs(b.y - y._o.y) < 2 && y.x >= b.x - 1 && y.x + y.w <= b.x + b.w + 1; }); }); }); };
        var key = function (b) { return b ? b.n * 10000 + b.y : null; };
        var here = self != null ? key(T.Pages.rawBoxes(lines[self])[0]) : null;
        var prev = at >= 0 && lines[at] ? key(T.Pages.rawBoxes(lines[at])[0]) : null, nxt = lines[at + 1] ? key(T.Pages.rawBoxes(lines[at + 1])[0]) : null;
        var score = function (path) {
          var k = key(path[0]._o), d0 = 0;
          if (here != null) d0 = Math.abs(k - here);      // a section being changed stays near where it was
          else { if (prev != null && k < prev) d0 += prev - k; if (nxt != null && k > nxt) d0 += k - nxt; }
          return (used(path) ? 1e7 : 0) + d0;
        };
        var ws = words.split(/\s+/), part = null, best = null, near = false;
        var pick = function (found) { return found.sort(function (a, b) { return (score(a) + (a.miss || 0) * 5000) - (score(b) + (b.miss || 0) * 5000); })[0]; };
        var all = matchAt(rows, letters(words));
        if (all.length) best = pick(all);
        if (!best || score(best) >= 1e7) {      // not printed exactly as typed: the same words with a few letters different (a typo, goin' / going)
          var fz = matchAt(rows, letters(words), true).filter(function (p) { return score(p) < 1e7; });
          if (fz.length) { best = pick(fz); near = true; }
        }
        for (var m = ws.length - 1; m >= Math.min(3, ws.length) && !best; m--) {      // only the start of it is printed as typed
          var found = matchAt(rows, letters(ws.slice(0, m).join(' ')));
          if (found.length) { best = pick(found); part = ws.slice(0, m).join(' '); }
        }
        return { best: best, part: part, near: near, taken: !!(best && score(best) >= 1e7) };
      });
    }
    var placeNote = function (r, n) {
      var pg = r.best ? T.Pages.printed(T.Pages.rawBoxes(lines[n])[0] ? T.Pages.rawBoxes(lines[n])[0].n : 0) : null;
      return r.pointed ? 'Placed where you pointed on page ' + pg + '.' : r.part ? 'Found the start (“' + r.part + '”) on page ' + pg + '. Drag the end of its highlight to the last word.' :
        r.near ? 'Found words very close to those on page ' + pg + ' (“' + lines[n].text + '”).' : 'Found it on page ' + pg + '.';
    };
    var notFound = 'Those words were not found on this song’s pages. Tap 👆 Point to it on the music, and tap its first and last word.';
    /* a new section from a place on the music (found or pointed to) */
    function insertLine(at, words, spoke, r) {
      snapshot();
      var named = r.best && r.best.name && T.labelChars(r.best.name).length ? r.best.name : '';
      var l = { who: named || (lines[at] || lines[0] || {}).who || '', page: (lines[at] || lines[0] || {}).page };
      setLine(l, r.best, function (y) { return y._o; }); r.best.forEach(function (y) { delete y._o; });
      if (r.part && words) l.text = ScriptParser.cleanLyric(words);
      kindTo(l, spoke, words);
      lines.splice(at + 1, 0, l); times.splice(at + 1, 0, null);
      lines.forEach(function (x, k) { if (x.sync && k > at + 1 && k - x.sync <= at + 1) x.sync++; });      // pairs that reach across the new line still find their partner
      edited = true; selSec = at + 1;
      T.toast(placeNote(r, at + 1) + ' Added as line ' + (at + 2) + '. Check who sings it (✎), time it with 🎯 Fix, then Save.', 8000);
      draw();
    }
    function addMissing() {
      if (!(T.Pages && T.Pages.ready())) { T.toast('The script pages are not saved yet: import the script PDF first.', 5000); return; }
      var after = selSec != null ? selSec : fixAt != null ? fixAt : Math.max(-1, nextOpen() - 1), spoke = !!(lines[after] && lines[after].spoken);      // like the line before it, to start
      var d = dialog('<h2>Add a missing line</h2><p class="muted">Type the words of the line the way they are printed. The app finds them on this song’s pages and adds them as a section, lit up on the music. Or point to it on the music.</p>' +
        '<label class="f">The words<textarea id="mw" style="min-height:80px" placeholder="e.g. Stick to the stuff you know"></textarea></label>' +
        '<div class="switch"><span>It is</span><div class="seg" id="mk"><button type="button" data-sp="0" aria-pressed="' + !spoke + '">🎵 Sung</button><button type="button" data-sp="1" aria-pressed="' + spoke + '">🗣 Spoken</button></div></div>' +
        '<label class="f">Where it goes<select id="ma"><option value="-1">At the start, before line 1</option>' + lines.map(function (l, i) { return '<option value="' + i + '"' + (i === after ? ' selected' : '') + '>After line ' + (i + 1) + ': ' + esc(String(l.text || '').slice(0, 40)) + '</option>'; }).join('') + '</select></label>' +
        '<p class="err" id="mm"></p><div class="row end"><button class="btn quiet" id="mx">Cancel</button><button class="btn" id="mpt">👆 Point to it on the music</button><button class="btn primary" id="mok">Find it and add it</button></div>');
      d.querySelector('#mx').onclick = function () { d.close(); };
      wireKind(d, '#mk', function (v) { spoke = v; });
      d.querySelector('#mpt').onclick = function () {
        var words = d.querySelector('#mw').value.trim(), at = +d.querySelector('#ma').value; d.close();
        pointOnMusic('Add a line after line ' + (at + 1), function (path) { insertLine(at, words, spoke, { best: path, pointed: true }); });
      };
      d.querySelector('#mok').onclick = function () {
        var words = d.querySelector('#mw').value.trim(), at = +d.querySelector('#ma').value, msg = d.querySelector('#mm'), btn = this;
        if (letters(words).length < 2) { msg.textContent = 'Type the words of the line first, or point to it on the music.'; return; }
        btn.disabled = true; msg.textContent = 'Looking on the pages…';
        findPlace(words, at, null).then(function (r) {
          btn.disabled = false;
          if (r.taken) { msg.textContent = r.part ? 'Only the start (“' + r.part + '”) was found, and it is already a section. Check the rest, or point to it on the music.' : 'Those words are already a section on the music (use 📍 to find it).'; return; }
          if (!r.best) { msg.textContent = notFound; return; }
          d.close(); insertLine(at, words, spoke, r);
        }).catch(function (e) { btn.disabled = false; msg.textContent = e.message || 'The pages could not be read.'; });
      };
    }
    /* change a section's words (Colleen 2026-10-24: "the ability to edit a line that you found since you missed some words"): she types the
       whole line as it should be; the words are found again on the pages near where the section was, and the section takes their place on the
       music (more words or fewer), or she points to it. Who sings it stays; its start stays and the syllables are shared out again. */
    function editWords(i) {
      var l = lines[i]; if (!l) return;
      var d = dialog('<h2>The words of line ' + (i + 1) + '</h2><p class="muted">Type the whole line the way it is printed, with any words that were missed. The app finds them on the pages near where this line is and fits its highlight to them. Or point to it on the music.</p>' +
        '<label class="f">The words<textarea id="ew" style="min-height:80px">' + esc(l.text || '') + '</textarea></label>' +
        '<div class="switch"><span>It is</span><div class="seg" id="ek"><button type="button" data-sp="0" aria-pressed="' + !l.spoken + '">🎵 Sung</button><button type="button" data-sp="1" aria-pressed="' + !!l.spoken + '">🗣 Spoken</button></div></div>' +
        '<label class="switch"><span>Only change the words shown in the list (leave the highlight as it is)</span><input type="checkbox" id="eonly"></label>' +
        '<p class="err" id="em"></p><div class="row end"><button class="btn quiet" id="ex">Cancel</button><button class="btn" id="ept">👆 Point to it on the music</button><button class="btn primary" id="eok">Find them and change the line</button></div>');
      d.querySelector('#ex').onclick = function () { d.close(); };
      var spoke = !!l.spoken; wireKind(d, '#ek', function (v) { spoke = v; });
      var apply = function (words, r) {
        snapshot();
        setLine(l, r.best, function (y) { return y._o; }); r.best.forEach(function (y) { delete y._o; });
        if (r.part && words) l.text = ScriptParser.cleanLyric(words);
        kindTo(l, spoke, words);
        var x = times[i]; if (x) x.s = Melody.sylTimes([], x.t, x.e, l.spoken ? 0 : l.syl.length);
        edited = true; selSec = i;
        T.toast(placeNote(r, i) + ' Line ' + (i + 1) + ' now covers those words. Check its time with Test, then Save.', 7000);
        refreshAfter();
      };
      d.querySelector('#ept').onclick = function () { var words = d.querySelector('#ew').value.trim(); d.close(); pointOnMusic('Line ' + (i + 1), function (path) { apply(words !== l.text ? words : '', { best: path, pointed: true }); }); };
      d.querySelector('#eok').onclick = function () {
        var words = d.querySelector('#ew').value.trim(), msg = d.querySelector('#em'), btn = this;
        if (letters(words).length < 2) { msg.textContent = 'Type the words of the line.'; return; }
        if (d.querySelector('#eonly').checked || !(T.Pages && T.Pages.ready())) {
          snapshot(); l.text = ScriptParser.cleanLyric(words); kindTo(l, spoke, words); edited = true; d.close(); T.toast('Line ' + (i + 1) + ' changed. Save keeps it.'); refreshAfter(); return;
        }
        btn.disabled = true; msg.textContent = 'Looking on the pages…';
        findPlace(words, i - 1, i).then(function (r) {
          btn.disabled = false;
          if (!r.best) { msg.textContent = notFound; return; }
          if (r.taken) { msg.textContent = 'Those words are already another section on the music. Join the two lines instead (on the music: tap the line, then Join).'; return; }
          d.close(); apply(words, r);
        }).catch(function (e) { btn.disabled = false; msg.textContent = e.message || 'The pages could not be read.'; });
      };
    }
    /* point to it on the music (when typing does not find it): every printed word on the song's pages can be tapped; tap the line's first word,
       then its last. A line on two rows takes the rest of the first row and the start of the last. */
    function pointOnMusic(title, done) {
      var box = document.createElement('div'); box.className = 'pick-music';
      box.innerHTML = '<div class="pick-bar"><b>' + esc(title) + '</b><span class="grow" id="pkmsg">Loading the pages…</span><button class="btn small" id="pkx">Cancel</button></div><div class="pages" id="pkpages"></div>';
      document.body.appendChild(box);
      var host = box.querySelector('#pkpages'), close = function () { box.remove(); }, msg = function (t) { box.querySelector('#pkmsg').textContent = t; };
      box.querySelector('#pkx').onclick = close;
      T.cleanup.push(close);
      Promise.all([T.Follow.mount(host, songId), songRows()]).then(function (r) {
        var rows = r[1], first = null, pc = function (v, dd) { return (v / dd * 100) + '%'; };
        msg('Tap the first word of the line.');
        rows.forEach(function (row, ri) {
          var page = host.querySelector('.pdfpage[data-n="' + row.n + '"]'); if (!page) return;
          var sz = T.Pages.size(row.n);
          row.toks.forEach(function (t, ti) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'pick-tok'; b.title = t.t; b.setAttribute('aria-label', t.t);
            b.style.cssText = 'left:' + pc(t.x - 1, sz.w) + ';top:' + pc(row.y, sz.h) + ';width:' + pc(Math.max(t.w, 5) + 2, sz.w) + ';height:' + pc(row.h, sz.h);
            b.onclick = function () {
              if (!first) { first = { ri: ri, ti: ti }; b.classList.add('on'); msg('Now tap the last word of the line (tap the same word for a one-word line).'); return; }
              var a = first, z = { ri: ri, ti: ti };
              if (z.ri < a.ri || (z.ri === a.ri && z.ti < a.ti)) { var tmp = a; a = z; z = tmp; }
              var path = [], add = function (rr, k) { var x = rows[rr].toks[k]; path.push({ x: x.x, w: x.w, t: x.t, _o: { n: rows[rr].n, y: rows[rr].y, h: rows[rr].h } }); }, k;
              if (a.ri === z.ri) for (k = a.ti; k <= z.ti; k++) add(a.ri, k);
              else { for (k = a.ti; k < rows[a.ri].toks.length; k++) add(a.ri, k); for (k = 0; k <= z.ti; k++) add(z.ri, k); }
              path.name = nameBefore(rows[a.ri], a.ti);
              close(); done(path);
            };
            page.appendChild(b);
          });
        });
      }).catch(function (e) { msg(e.message || 'The pages could not be read.'); });
    }
    /* sung or spoken (Colleen 2026-10-24: "when i add a line, i need to be able to specify if its spoken or sung"). A spoken line keeps its place
       on the page (its rows) but no syllables, like the spoken lines the script reader finds: it lights up whole, and the piano skips it. */
    function wireKind(d, sel, set) { d.querySelectorAll(sel + ' [data-sp]').forEach(function (b) { b.onclick = function () { set(b.dataset.sp === '1'); d.querySelectorAll(sel + ' [data-sp]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; }); }
    function kindTo(l, spoken, words) {
      if (spoken) { l.spoken = true; if (l.syl && l.syl.length) { var bs = T.Pages.rawBoxes(l); if (bs.length) { l.box = bs[0]; if (bs.length > 1) l.boxes = bs; } } l.syl = []; l.text = String(words || l.text).replace(/\s+/g, ' ').trim(); }
      else delete l.spoken;
    }
    /* who ALL is in this song (by character, by Company member, or both): used wherever lines are matched to a student (their lines lit up,
       the piano's My part, the red X, printed highlights). Nobody picked: everyone on stage in the song, as before. */
    function allWhoText() {
      var aw = (T.show.allWho || {})[songId]; if (!aw || !((aw.chars || []).length || (aw.cast || []).length)) return 'everyone on stage in this song';
      var cast = T.show.cast || [];
      return (aw.chars || []).map(function (c) { var x = T.charById(c); return x ? x.short : c; }).concat((aw.cast || []).map(function (id) { var a = cast.find(function (x) { return x.id === id; }); return a ? a.name : null; }).filter(Boolean)).join(', ');
    }
    function pickAll() {
      var O = T.O(), aw = (T.show.allWho || {})[songId] || {}, cast = (T.show.cast || []).filter(function (a) { return a.name && !a.guest; });
      var box = function (attr, id, label, on) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" ' + attr + '="' + id + '"' + (on ? ' checked' : '') + '></label>'; };
      var d = dialog('<h2>Who is ALL in “' + esc(song.title) + '”?</h2><p class="muted">Lines marked ALL count for these people only (their lines light up, the piano’s My part, the red X, printed highlights). Pick characters, Company members, or both, for groupings like auditions. Pick nobody for everyone on stage in the song.</p>' +
        '<h3>Characters</h3>' + O.groups.map(function (g) { var l = O.characters.filter(function (c) { return c.group === g.id; }); return l.length ? '<p class="muted small" style="margin:8px 0 2px">' + esc(g.name) + '</p><div class="choose" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">' + l.map(function (c) { return box('data-ac', c.id, T.chip(c.id), (aw.chars || []).indexOf(c.id) >= 0); }).join('') + '</div>' : ''; }).join('') +
        '<h3 style="margin-top:14px">Company members</h3>' + (cast.length ? '<div class="choose" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">' + cast.map(function (a) { return box('data-am', a.id, esc(a.name), (aw.cast || []).indexOf(a.id) >= 0); }).join('') + '</div>' : '<p class="muted small">No Company members on the cast list yet.</p>') +
        '<div class="row end" style="margin-top:12px"><button class="btn quiet" id="anone">Everyone on stage</button><button class="btn quiet" id="ax">Cancel</button><button class="btn primary" id="aok">Save</button></div>');
      var put = function (v) { var A = T.show.allWho = T.show.allWho || {}; if (v) A[songId] = v; else delete A[songId]; d.close(); save(v ? 'ALL in this song saved' : 'ALL is everyone on stage again').then(function () { draw(); }); };
      d.querySelector('#ax').onclick = function () { d.close(); };
      d.querySelector('#anone').onclick = function () { put(null); };
      d.querySelector('#aok').onclick = function () {
        var ch = Array.from(d.querySelectorAll('[data-ac]:checked')).map(function (x) { return x.dataset.ac; }), cm = Array.from(d.querySelectorAll('[data-am]:checked')).map(function (x) { return x.dataset.am; });
        put(ch.length || cm.length ? { chars: ch, cast: cm } : null);
      };
    }
    function refreshAfter() { if (view === 'sections') { overlay(); secBar(); } else draw(); }
    function delSec(i) {      // a section that is not a lyric (a stray box): gone, and the pairs after it still point at their partners
      snapshot(); removeAt(i);
    }
    function removeAt(i) {
      lines.forEach(function (l, k) { if (l.sync && k > i) { if (k - l.sync === i) delete l.sync; else if (k - l.sync < i) l.sync--; } });
      lines.splice(i, 1); times.splice(i, 1); edited = true;
    }
    /* join two sections that are not side by side (Colleen: "i need to join 15 with 13… the problem seems to be the simultaneous singing
       parts": two staves sung together take turns in the numbering, so one singer's words are every other section) */
    function joinPair(i, j) {
      var lo = Math.min(i, j), hi = Math.max(i, j), a = lines[lo], b = lines[hi]; if (!a || !b || lo === hi) return;
      if (hi === lo + 1) return joinSec(lo);
      snapshot();
      var ab = T.Pages.rawBoxes(a), bb = T.Pages.rawBoxes(b);
      var syl = a.syl.map(function (y) { return Object.assign({}, y, { _o: ab[y.b || 0] }); }).concat(b.syl.map(function (y) { return Object.assign({}, y, { _o: bb[y.b || 0] }); }));
      setLine(a, syl, function (y) { return y._o; }); syl.forEach(function (y) { delete y._o; });
      var x = times[lo], y2 = times[hi], n = syl.length;
      times[lo] = x && y2 ? { t: x.t, e: Math.max(x.e, y2.e), s: (x.s || []).concat(y2.s || []) } : x || y2 ? (function (z) { var t = { t: z.t, e: z.e }; t.s = Melody.sylTimes([], t.t, t.e, n); return t; })(x || y2) : null;
      removeAt(hi);
    }
    function joinSec(i) {
      var a = lines[i], b = lines[i + 1]; if (!a || !b) return;
      snapshot();
      var ab = T.Pages.rawBoxes(a), bb = T.Pages.rawBoxes(b);
      var syl = a.syl.map(function (y) { return Object.assign({}, y, { _o: ab[y.b || 0] }); }).concat(b.syl.map(function (y) { return Object.assign({}, y, { _o: bb[y.b || 0] }); }));
      setLine(a, syl, function (y) { return y._o; }); syl.forEach(function (y) { delete y._o; });
      lines.splice(i + 1, 1);
      var x = times[i], y2 = times[i + 1];
      times[i] = x && y2 ? { t: x.t, e: y2.e, s: (x.s || []).concat(y2.s || []) } : x || y2;
      times.splice(i + 1, 1); edited = true;
    }
    var lastRow = -1, fixAt = null, fixOld = null;      // fixOld: the fixed line's time before it was cleared (its syllable timing is kept, and it comes back if it is not tapped)      // fixAt: the line the next Now goes to while fixing (then the lines after it, in order)
    function follow(force, quiet) {      // light up the line being sung and keep it in the middle of the screen; outline the next line to tap
      var t = audio.currentTime, cur = -1;
      var onNow = [];
      if (!audio.paused || force) times.forEach(function (x, i) { if (x && x.t - (T.LYRIC_LEAD || 0) <= t) { cur = i; if (t <= T.lineEnd(x)) onNow.push(i); } });      // lit up a little early and until sung, like the song player
      if (audio.paused && !force) { app.querySelectorAll('.lt-row.lt-on').forEach(function (r) { r.classList.remove('lt-on'); }); return; }      // paused: nothing stays lit (Colleen: a line stayed highlighted)
      if (quiet && audio.paused) return;      // a redraw while paused keeps the page where it is (Colleen: every click jumped back to one line)
      var nxt = fixAt != null ? fixAt : nextOpen(), row = nxt >= 0 && (cur < 0 || nxt <= cur + 1) ? nxt : cur;
      app.querySelectorAll('.lt-row.lt-on').forEach(function (r) { r.classList.remove('lt-on'); });
      if (!audio.paused) onNow.forEach(function (k) { var on = app.querySelector('.lt-row[data-row="' + k + '"]'); if (on) on.classList.add('lt-on'); });
      if (isSplit()) lightMusic(audio.paused ? [] : onNow);
      if (row !== lastRow && row >= 0) {
        var el = app.querySelector('.lt-row[data-row="' + row + '"]');
        if (el && (!force || nxt >= 0)) el.scrollIntoView({ block: 'center', behavior: T.prefs.motion ? 'smooth' : 'auto' });
        lastRow = row;
      }
    }
    function tap() {
      var fixing = fixAt != null, i = fixing ? fixAt : nextOpen();
      if (i < 0 || audio.paused) { T.toast(audio.paused ? 'Play the track first.' : 'Every line has a time. Use 🎯 Fix on a line to change it.'); return; }
      snapshot();
      var t = +audio.currentTime.toFixed(2), old = fixing ? fixOld || times[i] : times[i];
      if (fixing && old) {      // move the line, keeping its own syllable timing (the piano follows it), and don't let it run into the next line
        var d = t - old.t, next = times.slice(i + 1).find(Boolean);
        times[i] = { t: t, e: +Math.min(old.e + d, next ? next.t : old.e + d).toFixed(2), s: (old.s || []).map(function (v) { return +(v + d).toFixed(2); }) };
        if (times[i].e <= t) { times[i].e = +(t + 0.5).toFixed(2); spread(i); }
      } else { times[i] = { t: t }; spread(i); }
      var prev = times.slice(0, i).reverse().find(Boolean);
      if (prev && prev.e > t) { prev.e = t; prev.s = prev.s.map(function (v) { return Math.min(v, t - 0.05); }); }
      applySync();
      if (fixing) { var nx = i + 1; while (nx < lines.length && (lines[nx].sync || !kindOk(nx))) nx++; fixOld = null; fixAt = nx < lines.length ? nx : null; }      // Colleen: the next tap overrides the next line, but it is not cleared ahead of time      // keep playing: the next tap fixes the line after it (untouched lines keep their times)
      draw();
    }
    /* who sings a line, when the script reader got it wrong: kept in T.show.lyricWho so a re-import keeps it */
    function pickSinger(i, then) {
      var l = lines[i], O = T.O(), ids = T.labelChars(String(l.who || '').toUpperCase()), all = ids.indexOf('*') >= 0;
      var d = dialog('<h2>Who sings line ' + (i + 1) + '?</h2><p class="muted">“' + esc(l.text) + '”</p><div class="choose" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">' +
        O.characters.map(function (c) { return '<label class="switch"><span>' + T.chip(c.id) + '</span><input type="checkbox" value="' + c.id + '"' + (!all && ids.indexOf(c.id) >= 0 ? ' checked' : '') + '></label>'; }).join('') + '</div>' +
        '<label class="switch"><span><b>Everyone (ALL)</b></span><input type="checkbox" id="wall"' + (all ? ' checked' : '') + '></label>' +
        '<div class="row end"><button class="btn quiet" id="wx">Cancel</button><button class="btn primary" id="wok">OK</button></div>');
      d.querySelector('#wx').onclick = function () { d.close(); };
      d.querySelector('#wok').onclick = function () {
        var pick = Array.from(d.querySelectorAll('input[type=checkbox][value]:checked')).map(function (x) { return T.charById(x.value); });
        var who = d.querySelector('#wall').checked ? 'ALL' : pick.map(function (c) { return ((c.aliases || [])[0] || c.name).toUpperCase(); }).join(', ');
        if (!who) { T.toast('Pick who sings it.'); return; }
        snapshot(); l.who = who;
        var W = T.show.lyricWho = T.show.lyricWho || {}; (W[song.num] = W[song.num] || {})[i + '|' + l.text] = who;
        d.close(); save('Singer saved').then(function () { if (then) then(); else draw(); });
      };
    }
    /* fixing a line (Colleen: "when i enter fix mode, it should clear the timing and start fresh"): its old time is cleared, so nothing
       lights up or shows from it while the song plays, and Now gives it a fresh one. Done fixing before tapping puts the old time back. */
    function startFix(i) { endFix(); fixAt = i; fixOld = times[i] || null; times[i] = null; applySync(); }
    function endFix() { if (fixAt != null && fixOld && !times[fixAt]) { times[fixAt] = fixOld; applySync(); } fixAt = null; fixOld = null; fixRun = false; }
    /* retime from here (Colleen: "pick up at a certain place in the song and keep marking time through the end of the track"): play from just
       before line i; each Now gives the next line its new time and moves on, nothing is cleared ahead */
    var fixRun = false;
    function runFrom(i) {
      endFix(); fixAt = i; fixRun = true;
      var known = times[i] || times.slice(0, i).reverse().find(Boolean);
      (loaded ? Promise.resolve() : load()).then(function () { seekTo = null; audio.currentTime = Math.max(0, (known ? known.t : 0) - 3); audio.play(); draw(); });
    }
    /* typed times (Colleen: "i want to be able to type in timings too"): seconds (47.15) or minutes:seconds (0:47.15) */
    function fmtT(x) { return x ? x.t.toFixed(2) : ''; }
    function timeBox(attr, x) { return '<input ' + attr + ' class="lt-tin" type="text" inputmode="decimal" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" spellcheck="false" value="' + fmtT(x) + '" placeholder="—" aria-label="Start time in seconds" title="Type a time: 47.15 or 0:47.15">'; }
    function typeTime(i, v) {
      v = String(v || '').trim(); if (!v) return false;
      var m = v.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)\s*s?$/); if (!m) { T.toast('Type seconds (47.15) or minutes and seconds (0:47.15).', 4000); return false; }
      var t = +(((+m[1] || 0) * 60) + +m[2]).toFixed(2), x = times[i];
      snapshot();
      if (x) { var d = t - x.t; times[i] = { t: t, e: +(x.e + d).toFixed(2), s: (x.s || []).map(function (s) { return +(s + d).toFixed(2); }) }; }      // the whole line moves, its syllables with it
      else { times[i] = { t: t }; spread(i); }
      if (fixAt === i) { fixAt = null; fixOld = null; }
      applySync(); return true;
    }
    /* when each line's light goes off (Colleen 2026-10-23: "a way to specify when the highlighter turns off for each line… watch it back and add
       cut off times… in a round"): h is the stop, hm marks one set by hand (Save keeps it; the guide vocals fill only the others) */
    var stopsOn = false, stopsKey = '';
    function fmtH(x) { return x && x.hm && x.h != null ? x.h.toFixed(2) : ''; }
    function endBox(attr, x) { return '<input ' + attr + ' class="lt-tin lt-hin" type="text" inputmode="decimal" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other" spellcheck="false" value="' + fmtH(x) + '" placeholder="Ends: auto" aria-label="When the light goes off, in seconds" title="When this line’s light goes off. Empty: automatic."' + (x ? '' : ' disabled') + '>'; }
    function typeEnd(i, v) {
      var x = times[i]; if (!x) return false;
      v = String(v || '').trim();
      snapshot();
      if (!v) { delete x.h; delete x.hm; return true; }      // back to the automatic end
      var m = v.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)\s*s?$/); if (!m) { T.toast('Type seconds (52.4) or minutes and seconds (0:52.4).', 4000); return false; }
      var h = +(((+m[1] || 0) * 60) + +m[2]).toFixed(2);
      if (h <= x.t) { T.toast('The light has to go off after the line starts (' + x.t.toFixed(2) + ' s).', 4000); return false; }
      x.h = h; x.hm = true; return true;
    }
    function drawStops() {      // a button for each line that has started in the last few seconds and has no stop yet
      var box = document.getElementById('stops'); if (!box) return;
      var nowT = function () { return seekTo != null && audio.paused ? seekTo : audio.currentTime; }, t = nowT(), open = [];
      times.forEach(function (x, i) { if (x && x.t - (T.LYRIC_LEAD || 0) <= t && (t - x.t < 6 || t <= T.lineEnd(x) + 3) && t - x.t < 20 && !(x.hm && x.h <= t)) open.push(i); });      // lit now, or just went dark
      var key = open.join(','); if (key === stopsKey) return; stopsKey = key;
      box.innerHTML = (open.length ? open.map(function (i) { var cs = T.lyricColors(lines[i].who); return '<button type="button" class="btn lt-stop" data-stop="' + i + '" style="border-color:' + T.deepShade(cs[0]) + ';background:' + T.pastel(cs[0]) + '"><b>' + (i + 1) + '</b> ' + esc(lines[i].who || '') + ' · ' + esc(String(lines[i].text).slice(0, 26)) + ' <b>⏹</b></button>'; }).join('') : '<span class="muted small">Play, and tap a line the moment its singing stops. Lines you skip keep the automatic end.</span>');
      box.querySelectorAll('[data-stop]').forEach(function (b) { b.onclick = function () {
        var i = +b.dataset.stop, x = times[i]; if (!x) return; snapshot();
        x.h = +Math.max(nowT(), x.t + 0.2).toFixed(2); x.hm = true; stopsKey = ''; drawStops();
        var hin = app.querySelector('[data-hin="' + i + '"]'); if (hin) hin.value = fmtH(x);
      }; });
    }
    /* the other parts take their times from the timed part, syllable by syllable: a word on the same note (the same place along the staff) gets
       the same time; between notes, by position; past the ends, at the pace of the nearest notes */
    /* who sings a whole part of the brackets (Colleen: "assign different lines to different actors in songs where harmonies exist"): pick once,
       every line of this part in the brackets takes it (kept through a re-read, like a ✎ fix) */
    function partSinger() {
      var want = +timeKind.slice(4), idx = [];
      lines.forEach(function (l, i) { var p = partOf(l); if (!l.spoken && p && p.many && p.part === want) idx.push(i); });
      if (!idx.length) { T.toast('This song has no lines in that part of a bracket.'); return; }
      pickSinger(idx[0], function () {
        var who = lines[idx[0]].who, W = T.show.lyricWho = T.show.lyricWho || {}, Ws = W[song.num] = W[song.num] || {};
        idx.forEach(function (i) { lines[i].who = who; Ws[i + '|' + lines[i].text] = who; });
        save(idx.length + ' lines in this part: ' + who + '. Save the timing to make the piano again.').then(function () { draw(); });
      });
    }
    function fillParts() {
      var want = +timeKind.slice(4), anchors = {}, n = 0, skipped = 0;
      var sylSys = function (l, y) { var bs = T.Pages.rawBoxes(l), b = bs[y.b || 0] || bs[0]; return b ? sysAt(b.n, b.y) : null; };
      lines.forEach(function (l, i) {
        var x = times[i], p = partOf(l); if (!x || !x.s || l.spoken || !p || !p.many || p.part !== want) return;
        (l.syl || []).forEach(function (y, k) { var q = sylSys(l, y); if (q && x.s[k] != null) (anchors[q.key] = anchors[q.key] || []).push({ x: y.x + y.w / 2, t: x.s[k] }); });
      });
      Object.keys(anchors).forEach(function (k) { anchors[k].sort(function (a, b) { return a.x - b.x; }); });
      var at = function (A, x) {
        for (var j = 0; j < A.length; j++) if (Math.abs(A[j].x - x) < 4) return A[j].t;      // the same note
        var lo = null, hi = null; A.forEach(function (a) { if (a.x <= x) lo = a; if (a.x > x && !hi) hi = a; });
        if (lo && hi) return lo.t + (hi.t - lo.t) * (x - lo.x) / (hi.x - lo.x);
        var a = lo ? A[A.length - 2] : A[0], b = lo ? A[A.length - 1] : A[1];
        var pace = a && b && b.x !== a.x ? (b.t - a.t) / (b.x - a.x) : 0.012;
        var e = lo || hi; return e.t + (x - e.x) * pace;
      };
      snapshot();
      lines.forEach(function (l, i) {
        var p = partOf(l); if (l.spoken || !p || !p.many || p.part === want || !(l.syl || []).length) return;
        var s2 = l.syl.map(function (y) { var q = sylSys(l, y), A = q && anchors[q.key]; return A && A.length ? +at(A, y.x + y.w / 2).toFixed(2) : null; });
        if (s2.some(function (v) { return v == null; })) { skipped++; return; }
        for (var k = 1; k < s2.length; k++) if (s2[k] <= s2[k - 1]) s2[k] = +(s2[k - 1] + 0.05).toFixed(2);
        var gap = s2.length > 1 ? (s2[s2.length - 1] - s2[0]) / (s2.length - 1) : 0.5;
        times[i] = { t: s2[0], e: +(s2[s2.length - 1] + Math.max(0.3, gap)).toFixed(2), s: s2 }; n++;
      });
      applySync(); draw();
      T.toast(n ? n + ' lines in the other parts timed from this part' + (skipped ? ' (' + skipped + ' had no timed notes above or below them yet)' : '') + '. ↶ Undo puts them back.' : 'Time this part first (its lines in the brackets), then fill the others.', 6000);
    }
    function clearLine(i) { snapshot(); if (fixAt === i) { fixAt = null; fixOld = null; } times[i] = null; applySync(); }
    function fixLine(i) {
      snapshot();
      var known = times[i] || times.slice(0, i).reverse().find(Boolean);
      startFix(i);
      (loaded ? Promise.resolve() : load()).then(function () { audio.currentTime = Math.max(0, (known ? known.t : 0) - 3); audio.play(); draw(); });
    }
    function find() {
      snapshot();
      var ctx = T.audioCtx(), m = document.getElementById('msg');
      m.textContent = 'Listening to the singing… (this can take a minute)';
      autoLyrics(songId).then(function (r) {
        off = +r.off.toFixed(3); TO[songId] = off;      // found on the band track's clock; this page plays the guide vocals
        times = r.lines.map(function (x) { return shiftX(x, off); }); applySync();
        draw('Found ' + r.n + ' of ' + lines.length + ' lines. Use Test to check them, nudge with − and +, then Save.');
      }).catch(function (e) { m.textContent = ''; T.toast(e.message || 'Could not read the tracks.', 4000); });
    }
    draw();
    var tk = setInterval(function () {
      var r = document.getElementById('ltpos');
      var now = seekTo != null && audio.paused ? seekTo : audio.currentTime;
      if (r && !r.dragging) { if (audio.duration > 0 && +r.max !== +audio.duration.toFixed(1)) r.max = audio.duration.toFixed(1); r.value = now; }
      var el = document.getElementById('tm'); if (el && !(r && r.dragging)) el.textContent = T.clock(now) + ' (' + now.toFixed(1) + ' s)';
      follow(false);
      if (stopsOn) drawStops();
    }, 200);
    audio.addEventListener('ended', function () { var pb = document.getElementById('pl'); if (pb) pb.innerHTML = icon('play'); });
    T.cleanup.push(function () { clearInterval(tk); });
    var kh = function (e) { if (e.key === ' ' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); tap(); } };
    document.addEventListener('keydown', kh); T.cleanup.push(function () { document.removeEventListener('keydown', kh); });
  }

  /* ---------- Passwords & backup ---------- */
  function passwordsPage() {
    T.setBar('Passwords & backup', '#/teacher');
    setTimeout(function () {
      var f = document.getElementById('sif'); if (!f) return;
      document.getElementById('sitest').onclick = function () { T.testSignin(); };
      f.onsubmit = function (e) { e.preventDefault(); };      // (the Google Client ID fields were taken out: Colleen does not use one)
    }, 0);
    var S = T.show.signin || {}, withEmail = (T.show.cast || []).filter(function (c) { return c.emailHash; }).length;
    app.innerHTML = '<div id="pwlist"></div><form class="card" id="sif"><h2>School sign-in</h2><p class="muted">Company members signed into their school Google account are found on the cast list by the app’s own school sign-in page (like ASL Study Hall), by their school email (saved only as a scrambled code). They still type the cast password once on each device.</p>' +
      '<p class="small">' + withEmail + ' of ' + (T.show.cast || []).length + ' Company members have a school email saved (Cast › tap a Company member, or paste the class list with emails).</p>' +
      '<div class="row end"><button type="button" class="btn" id="sitest">Test the school sign-in</button></div>' +
      '<p class="small muted">Test it any time, even before there is a cast: it goes to the school sign-in page and back. The first time, Google asks you to allow it; press Allow.</p></form>' +
      '<form class="card" id="cf"><h2>Cast password</h2><p class="muted">Devices that already remember the show stay open. Use Settings › Lock this device on any you want closed.</p>' +
      '<label class="f">New cast password<input id="nc" type="text" autocomplete="off" autocapitalize="off" minlength="4" required></label><div class="row end"><button class="btn primary" data-save>Change the cast password</button></div></form>' +
      '<form class="card" id="tf"><h2>Teacher password</h2><label class="f">New teacher password<input id="nt1" type="password" minlength="8" autocomplete="new-password" required></label>' +
      '<label class="f">Again<input id="nt2" type="password" autocomplete="new-password" required></label><div class="row end"><button class="btn primary" data-save>Change the teacher password</button></div></form>' +
      '<div class="card"><h2>Backup</h2><p>The backup file is encrypted: it needs the cast password it had when you made it.</p><div class="row"><button class="btn" id="dl">Download a backup</button>' +
      '<label class="btn">Restore a backup<input type="file" id="ul" accept=".json,application/json" hidden></label></div></div>';
    document.getElementById('cf').onsubmit = function (e) {
      e.preventDefault();
      var c = val('nc');
      withVault(function (V) { V.cast = c; }).then(function () { return Store.save(T.key, T.show, T.saved, { proof: T.proof, castPw: c }); })
        .then(function (s) { T.saved = s; T.toast('Cast password changed'); passwordsPage(); }).catch(function (er) { T.toast(er.message, 4000); });
    };
    document.getElementById('tf').onsubmit = function (e) {
      e.preventDefault();
      var a = val('nt1'); if (a !== val('nt2')) { T.toast('The two passwords are not the same.'); return; }
      openVault().then(function (V) { V.teacher = a; return Store.sealVault(a, V); }).then(function (v) { T.show.vault = v; return Store.save(T.key, T.show, T.saved, { proof: T.proof, newTeacherPw: a }); })      // the list is locked with the new teacher password
        .then(function (s) { T.saved = s; T.tpw = a; return Store.proof(a, s.vsalt); })
        .then(function (p) { T.proof = p; T.toast('Teacher password changed'); passwordsPage(); }).catch(function (er) { T.toast(er.message, 4000); });
    };
    passwordList();
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

  /* ---------- App use: anonymous counts of which pages get used, by kind of password (Colleen 2026-10-23: "see which portions are used
     most and are worth considering building out"). Months are added up on the server; no names. ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.usage = function () {
    T.setBar('App use', '#/teacher');
    app.innerHTML = '<div class="card"><p class="muted">Loading…</p></div>';
    var NAMES = {}; T.STUDENT_PAGES.forEach(function (x) { NAMES[x[0]] = x[1]; }); T.TEACH_PAGES.forEach(function (x) { NAMES['t-' + x[0]] = x[1].replace(/ \(.*\)$/, '') + ' (view only)'; });
    Object.assign(NAMES, { home: 'Home page', who: 'Picking a Company member', settings: 'Settings', song: 'A song (playing it)', listen: 'Listening to a scene', unlock: 'Opening the show' });
    var KINDS = [['parent', 'Parents'], ['helper', 'Company Mentors (Mentor password)'], ['student', 'The Company (cast password)']];
    Store.usage(T.proof).then(function (months) {
      var ms = Object.keys(months).sort().reverse();
      if (!ms.length) { app.innerHTML = '<div class="card"><h2>App use</h2><p class="muted">Nothing counted yet. Each page people open, and the minutes they spend on it, are added up here by month (no names).</p></div>'; return; }
      var pick = T.ls('useMonth'); if (ms.indexOf(pick) < 0 && pick !== 'all') pick = ms[0];
      var data = {};
      (pick === 'all' ? ms : [pick]).forEach(function (m) { var M = months[m] || {}; Object.keys(M).forEach(function (k) { var d = data[k] = data[k] || {}; Object.keys(M[k]).forEach(function (p) { var x = d[p] = d[p] || [0, 0]; x[0] += M[k][p][0]; x[1] += M[k][p][1]; }); }); });
      var label = function (m) { return new Date(m + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
      var mins = function (s) { return s < 60 ? (s ? '<1 min' : '—') : Math.round(s / 60) + ' min'; };
      app.innerHTML = '<div class="card"><div class="row"><h2 class="grow" style="margin:0">App use</h2><select id="um">' + ms.map(function (m) { return '<option value="' + m + '"' + (m === pick ? ' selected' : '') + '>' + label(m) + '</option>'; }).join('') + '<option value="all"' + (pick === 'all' ? ' selected' : '') + '>All months</option></select></div>' +
        '<p class="muted small">How often each page was opened and how many minutes people spent on it (counted only while someone is using it), by kind of password. No names: just totals.</p></div>' +
        KINDS.filter(function (k) { return data[k[0]]; }).map(function (k) {
          var rows = Object.keys(data[k[0]]).map(function (p) { return { p: p, n: data[k[0]][p][0], s: data[k[0]][p][1] }; }).sort(function (a, b) { return b.s - a.s || b.n - a.n; });
          var top = rows[0] ? rows[0].s || 1 : 1;
          return '<div class="card"><h3>' + k[1] + '</h3><table class="tbl"><thead><tr><th>Page</th><th>Opened</th><th>Time</th><th style="width:35%"></th></tr></thead><tbody>' + rows.map(function (r) {
            return '<tr><td>' + esc(NAMES[r.p] || r.p) + '</td><td>' + r.n + '×</td><td>' + mins(r.s) + '</td><td><div style="height:10px;border-radius:5px;background:var(--accent);width:' + Math.max(2, Math.round(r.s / top * 100)) + '%"></div></td></tr>';
          }).join('') + '</tbody></table></div>';
        }).join('');
      document.getElementById('um').onchange = function () { T.ls('useMonth', this.value); T.teacherPages.usage(); };
    }).catch(function (e) { app.innerHTML = '<div class="card"><p class="err">' + esc(e.message) + '</p></div>'; });
  };

  /* ---------- every password, in full (Colleen 2026-10-23: "view a list of all passwords setup fully", and "add other passwords for access
     for other types of people like parents, peer helpers") ----------
     The passwords themselves are kept in T.show.vault, sealed with the teacher password: students' and parents' iPads carry it but cannot open it.
     Each other password wraps the same show key (Store.save addPw / dropPw); what it opens is its checklist in T.show.passes. */
  function openVault() {
    if (!T.tpw) return Promise.reject(new Error('Open Teacher mode again to see the passwords.'));
    var base = { teacher: T.tpw, cast: '', extra: {} };
    if (!T.show.vault) return Promise.resolve(base);
    return Store.openVault(T.tpw, T.show.vault).then(function (V) { V.extra = V.extra || {}; V.teacher = T.tpw; return V; }, function () { return base; });      // sealed with an older teacher password: start again
  }
  function withVault(change) {      // change the list and seal it again (saved with the next save)
    return openVault().then(function (V) { change(V); return Store.sealVault(T.tpw, V); }).then(function (v) { T.show.vault = v; });
  }
  T.openVault = openVault; T.withVault = withVault;      // volunteers.js keeps families' contacts here
  var PRESETS = {
    parent: { who: 'parent', pages: ['today', 'schedule', 'calendar', 'songs', 'lines', 'costumes', 'story', 'script', 'photos', 'help'], fullCal: true, teach: [] },
    helper: { who: 'helper', pages: ['today', 'schedule', 'calendar', 'lines', 'songs', 'costumes', 'story', 'script', 'print', 'shop', 'photos'], fullCal: true, teach: ['callboard', 'cues', 'mics'] },
    student: { who: 'student', pages: T.STUDENT_PAGES.map(function (x) { return x[0]; }), fullCal: false, teach: [] }
  };
  var WHO = { student: 'Picks their own picture (a Company member; practice is saved)', parent: 'A parent: picks their Company member once (first names and last initials only; practice is not saved to them)', helper: 'A Company Mentor: can switch between Artists (practice is saved for the Artist, marked “with a Mentor”)' };
  function passSummary(p) {
    var pages = (p.pages || []).map(function (k) { var x = T.STUDENT_PAGES.find(function (y) { return y[0] === k; }); return x ? x[1] : k; });
    var teach = (p.teach || []).map(function (k) { var x = T.TEACH_PAGES.find(function (y) { return y[0] === k; }); return x ? x[1].replace(/ \(.*\)$/, '') : k; });
    return esc(WHO[p.who] || '') + '<br><span class="muted small">' + esc(pages.join(', ') || 'No Company pages') + (p.fullCal ? ' · full calendar' : '') +
      (teach.length ? ' · view only: ' + esc(teach.join(', ')) : '') + '</span>';
  }
  function passwordList() {
    var box = document.getElementById('pwlist'); if (!box) return;
    var hide = T.ls('pwHide');
    box.innerHTML = '<div class="card"><p class="muted">Opening the list of passwords…</p></div>';
    openVault().then(function (V) {
      var shown = function (pw, id) {
        if (!pw) return '<span class="muted small">Not kept here yet.</span> <input id="' + id + '" type="text" autocomplete="off" autocapitalize="off" placeholder="Type it once" style="max-width:150px"> <button class="btn small" data-keep="' + id + '">Keep</button>';
        return '<code class="pw">' + (hide ? '••••••••' : esc(pw)) + '</code> <button class="btn small quiet" data-copy="' + esc(pw) + '">Copy</button>';
      };
      var passes = T.show.passes || [];
      box.innerHTML = '<div class="card"><div class="row"><h2 class="grow" style="margin:0">All passwords</h2><button class="btn small quiet" id="pwhide">' + (hide ? '👁 Show them' : 'Hide them') + '</button><button class="btn primary" id="pwadd">+ Add a password</button></div>' +
        '<p class="muted small">Only Teacher mode can show these (they are locked with your teacher password). Turning a password off, or deleting it, locks every device that opened the show with it the next time it opens.</p>' +
        '<table class="tbl"><thead><tr><th>Who</th><th>What it opens</th><th>Password</th><th></th></tr></thead><tbody>' +
        '<tr><td><b>Teacher</b></td><td>Teacher mode: everything, and saving</td><td>' + shown(V.teacher, 'kt') + '</td><td></td></tr>' +
        '<tr><td><b>Cast</b></td><td>Everything the Company sees (full names)</td><td>' + shown(V.cast, 'kc') + '</td><td></td></tr>' +
        passes.map(function (p) {
          return '<tr' + (p.off ? ' style="opacity:.55"' : '') + '><td><b>' + esc(p.name) + '</b>' + (p.off ? '<br><span class="tag">turned off</span>' : '') + '</td><td>' + passSummary(p) + '</td><td>' + shown(V.extra[p.id], 'kx-' + p.id) + '</td>' +
            '<td style="white-space:nowrap"><button class="btn small" data-pedit="' + p.id + '">Edit</button> <button class="btn small quiet" data-poff="' + p.id + '">' + (p.off ? 'Turn on' : 'Turn off') + '</button> <button class="btn small quiet" data-pdel="' + p.id + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table>' + (passes.length ? '' : '<p class="muted small">No other passwords yet. Add one for parents, Company Mentors, or anyone else, and choose what it opens.</p>') + '</div>';
      document.getElementById('pwhide').onclick = function () { T.ls('pwHide', !hide); passwordList(); };
      document.getElementById('pwadd').onclick = function () { editPass(null, V); };
      box.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { navigator.clipboard.writeText(b.dataset.copy).then(function () { T.toast('Copied'); }); }; });
      box.querySelectorAll('[data-pedit]').forEach(function (b) { b.onclick = function () { editPass(passes.find(function (p) { return p.id === b.dataset.pedit; }), V); }; });
      box.querySelectorAll('[data-poff]').forEach(function (b) { b.onclick = function () { var p = passes.find(function (x) { return x.id === b.dataset.poff; }); p.off = !p.off; save(p.off ? '“' + p.name + '” turned off' : '“' + p.name + '” turned on').then(passwordList); }; });
      box.querySelectorAll('[data-pdel]').forEach(function (b) {
        b.onclick = function () {
          var p = passes.find(function (x) { return x.id === b.dataset.pdel; });
          if (!confirm('Delete the password “' + p.name + '”? Devices that opened the show with it are locked the next time they open.')) return;
          T.show.passes = passes.filter(function (x) { return x !== p; });
          withVault(function (W) { delete W.extra[p.id]; }).then(function () { return Store.save(T.key, T.show, T.saved, { proof: T.proof, dropPw: p.id }); })
            .then(function (s) { T.saved = s; T.toast('Deleted'); passwordList(); }).catch(function (er) { T.toast(er.message, 4000); });
        };
      });
      box.querySelectorAll('[data-keep]').forEach(function (b) {      // a password made before the list existed: type it once, checked before it is kept
        b.onclick = function () {
          var id = b.dataset.keep, pw = val(id); if (!pw) return;
          var check = id === 'kc' ? Store.unlock(T.saved.enc, pw) : Store.unlockAny(T.saved.enc, pw).then(function (r) { if (r.access !== id.slice(3)) throw 0; });
          check.then(function () { return withVault(function (W) { if (id === 'kc') W.cast = pw; else W.extra[id.slice(3)] = pw; }); }, function () { throw new Error('That is not the password. Try again.'); })
            .then(function () { return save('Kept in the list'); }).then(passwordList).catch(function (er) { T.toast(er.message, 4000); });
        };
      });
    }).catch(function (er) { box.innerHTML = '<div class="card"><p class="err">' + esc(er.message) + '</p></div>'; });
  }
  function makePw() {
    var w = ['maple', 'tiger', 'comet', 'river', 'piano', 'lemon', 'rocket', 'cactus', 'panda', 'violet', 'sunny', 'falcon', 'banjo', 'otter', 'pepper', 'meadow'];
    var r = crypto.getRandomValues(new Uint32Array(3));
    return w[r[0] % w.length] + '-' + w[r[1] % w.length] + '-' + (10 + r[2] % 90);
  }
  function editPass(p, V) {
    var isNew = !p, cur = p ? JSON.parse(JSON.stringify(p)) : Object.assign({ name: '' }, JSON.parse(JSON.stringify(PRESETS.parent)));
    var oldPw = p ? V.extra[p.id] || '' : '';
    var box = function (name, val, label, on) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-' + name + '="' + val + '"' + (on ? ' checked' : '') + '></label>'; };
    var d = dialog('<h2>' + (isNew ? 'Add a password' : 'Edit “' + esc(p.name) + '”') + '</h2>' +
      '<label class="f">Name (who uses it)<input id="pn" value="' + esc(cur.name) + '" placeholder="Parents, Mentors…" autocomplete="off"></label>' +
      '<label class="f">Password' + (isNew ? '' : ' (change it, or leave it)') + '<span class="row"><input id="pp" class="grow" type="text" autocomplete="off" autocapitalize="off" value="' + esc(isNew ? makePw() : oldPw) + '"' + (isNew || oldPw ? '' : ' placeholder="Not kept here: type a new one to change it"') + '><button type="button" class="btn small" id="pmk">Make one</button></span></label>' +
      '<p class="small"><b>Start from:</b> <button type="button" class="btn small" data-preset="parent">Parent</button> <button type="button" class="btn small" data-preset="helper">Company Mentor</button> <button type="button" class="btn small" data-preset="student">Company member</button></p>' +
      '<div id="pck"></div><p class="err" id="pmsg" role="alert"></p>' +
      '<div class="row end"><button class="btn" id="pcn">Cancel</button><button class="btn primary" id="pok">' + (isNew ? 'Add it' : 'Save') + '</button></div>');
    var draw = function () {
      d.querySelector('#pck').innerHTML = '<h3>Who uses it</h3>' + Object.keys(WHO).map(function (k) { return '<label class="switch"><span>' + esc(WHO[k]) + '</span><input type="radio" name="pwho" value="' + k + '"' + (cur.who === k ? ' checked' : '') + '></label>'; }).join('') +
        '<h3>Company pages it opens</h3>' + T.STUDENT_PAGES.map(function (x) { return box('pg', x[0], esc(x[1]), (cur.pages || []).indexOf(x[0]) >= 0); }).join('') +
        box('fc', '1', '<b>Full calendar</b>: a “Show everyone” switch to see everything happening each day' + (cur.who === 'parent' ? ' (who is away and private notes stay hidden)' : ''), cur.fullCal) +
        '<h3>Teacher pages it can look at (never change)</h3>' + T.TEACH_PAGES.map(function (x) { return box('tp', x[0], esc(x[1]), (cur.teach || []).indexOf(x[0]) >= 0); }).join('');
      d.querySelectorAll('[name=pwho]').forEach(function (r) { r.onchange = function () { read(); cur.who = r.value; draw(); }; });
    };
    var read = function () {
      var q = function (sel) { return [].slice.call(d.querySelectorAll(sel)).filter(function (x) { return x.checked; }); };
      var w = q('[name=pwho]')[0]; if (w) cur.who = w.value;
      cur.pages = q('[data-pg]').map(function (x) { return x.dataset.pg; }); cur.teach = q('[data-tp]').map(function (x) { return x.dataset.tp; });
      cur.fullCal = !!q('[data-fc]').length;
    };
    draw();
    d.querySelector('#pmk').onclick = function () { d.querySelector('#pp').value = makePw(); };
    d.querySelectorAll('[data-preset]').forEach(function (b) { b.onclick = function () { Object.assign(cur, JSON.parse(JSON.stringify(PRESETS[b.dataset.preset]))); if (!d.querySelector('#pn').value.trim()) d.querySelector('#pn').value = { parent: 'Parents', helper: 'Company Mentors', student: 'Company members' }[b.dataset.preset]; draw(); }; });
    d.querySelector('#pcn').onclick = function () { d.close(); };
    d.querySelector('#pok').onclick = function () {
      read();
      var name = d.querySelector('#pn').value.trim(), pw = d.querySelector('#pp').value.trim(), msg = d.querySelector('#pmsg');
      if (!name) { msg.textContent = 'Give it a name (who uses it).'; return; }
      var change = pw && pw !== oldPw;
      if (isNew && !pw) { msg.textContent = 'Type a password, or press Make one.'; return; }
      if (change && pw.length < 4) { msg.textContent = 'Use at least 4 characters.'; return; }
      var used = [V.teacher, V.cast].concat(Object.keys(V.extra).filter(function (k) { return !p || k !== p.id; }).map(function (k) { return V.extra[k]; }));
      if (change && used.indexOf(pw) >= 0) { msg.textContent = 'That password is already used. Each kind of person needs a different one.'; return; }
      msg.textContent = 'Saving…'; d.querySelector('#pok').disabled = true;
      var id = p ? p.id : 'p' + Math.random().toString(36).slice(2, 8);
      (change ? Store.unlockAny(T.saved.enc, pw).then(function (r) { if (r.access !== id) throw new Error('That password is already used. Each kind of person needs a different one.'); }, function () {}) : Promise.resolve())      // also catches one this list does not know yet
        .then(function () {
          var rec = { id: id, name: name, who: cur.who, pages: cur.pages, teach: cur.teach, fullCal: cur.fullCal, off: p ? p.off : false };
          T.show.passes = (T.show.passes || []).filter(function (x) { return x.id !== id; }); T.show.passes.push(rec);
          return change ? withVault(function (W) { W.extra[id] = pw; }) : null;
        })
        .then(function () { return Store.save(T.key, T.show, T.saved, { proof: T.proof, addPw: change ? { id: id, pw: pw } : null }); })
        .then(function (s) { T.saved = s; d.close(); T.toast(isNew ? '“' + name + '” added' : 'Saved'); passwordList(); })
        .catch(function (er) { msg.textContent = er.message; d.querySelector('#pok').disabled = false; });
    };
  }
})();
