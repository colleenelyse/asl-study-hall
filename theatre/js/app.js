/* asl.cool/theatre: the student screens (iPad first). Teacher mode is in teacher.js.
   T.show is the decrypted show: { v, outline (scenes, songs, characters, moments, costumes), script (from the teacher's PDF),
   labelMap (script speaker labels -> character ids), cast [{ id, name, chars, photo, access }], melody { songId: {notes, offset} },
   tracks { songId: { rehearsal|performance: { ver, dur, size } } } }. */
(function () {
  'use strict';
  var T = window.T = { show: null, key: null, saved: null, me: null, routes: {} };
  var app = document.getElementById('app');

  /* ---------- small helpers ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  T.esc = esc;
  function ls(k, v) {
    try { if (v === undefined) { var s = localStorage.getItem('theatre:' + k); return s ? JSON.parse(s) : null; } localStorage.setItem('theatre:' + k, JSON.stringify(v)); } catch (e) { return null; }
  }
  T.ls = ls;
  function toast(msg, ms) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }
  T.toast = toast;
  function mins(m) { if (!m) return ''; var r = Math.max(1, Math.round(m)); return r === 1 ? 'about 1 minute' : 'about ' + r + ' minutes'; }
  function clock(sec) { sec = Math.max(0, sec || 0); var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  T.clock = clock;

  var ICON = {
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    lines: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    sched: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    songs: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    shirt: '<path d="M8 3l-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4c-1 2-2 3-4 3S9 5 8 3z"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
    prev: '<path d="M18 5L9 12l9 7zM6 5v14"/>',
    next: '<path d="M6 5l9 7-9 7zM18 5v14"/>',
    back10: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 15"/>',
    speak: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    skip: '<path d="M5 5l8 7-8 7zM13 5l8 7-8 7z"/>',
    loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    stage: '<path d="M3 4h18v3c-3 2-6 2-9 0-3 2-6 2-9 0z"/><path d="M5 7v13M19 7v13M3 20h18"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'
  };
  function icon(name, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || '') + '</svg>'; }
  T.icon = icon;
  /* keyboards (Chromebooks): one handler per page, removed when the page changes; never while typing in a box */
  function keys(map) {
    var h = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target.tagName || '')) || document.querySelector('dialog[open]')) return;
      var k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key, f = map[k];
      if (f) { e.preventDefault(); f(); }
    };
    document.addEventListener('keydown', h); T.cleanup.push(function () { document.removeEventListener('keydown', h); });
  }
  var hasKeys = matchMedia('(pointer: fine)').matches;
  function keyHint(text) { return hasKeys ? '<p class="muted small noprint" style="text-align:center">' + sym('⌨️') + text + '</p>' : ''; }
  var SCENE_SYM = { school: '🏫', class: '📚', hall: '🎒', ball: '🏀', lab: '🧪', stage: '🎭', mic: '🎤', lunch: '🍎', plant: '🌱', trophy: '🏆', party: '🎉' };
  function sym(s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; }

  /* ---------- the show ---------- */
  var O = function () { return T.show.outline; };
  T.O = O;
  var SPIKE = ['#d6336c', '#1c7ed6', '#e8590c', '#2f9e44', '#7048e8', '#0c8599', '#c2255c', '#5c940d', '#ae3ec9', '#f08c00', '#1971c2', '#e03131', '#087f5b', '#9c36b5', '#d9480f', '#364fc7'];
  function charById(id) { return O().characters.find(function (c) { return c.id === id; }); }
  T.charById = charById;
  /* a character's color; a performer who plays several roles keeps one color in all of them (Colleen 2026-10-23): their main role's (the
     first of their roles with a color picked for it, so a lead's color wins), or their first role's */
  function color(id) {
    var a = T.show && (T.show.cast || []).find(function (x) { return (x.chars || []).length > 1 && x.chars.indexOf(id) >= 0; });
    if (a) { var main = a.chars.find(function (c) { return roleColor(c, true); }) || a.chars[0]; return roleColor(main); }
    return roleColor(id);
  }
  function roleColor(id, pickedOnly) {
    var c = charById(id); if (c && c.color) return c.color;
    var D = window.DEFAULT_SHOW, d = D && D.title === O().title && D.characters.find(function (x) { return x.id === id; });      // a show saved before the colors were picked
    if (d && d.color) return d.color;
    if (pickedOnly) return null;
    var i = O().characters.findIndex(function (x) { return x.id === id; }); return SPIKE[(i < 0 ? 0 : i) % SPIKE.length]; }
  T.color = color;
  function chip(id) { var c = charById(id); return '<span class="chip" style="--c:' + color(id) + '">' + esc(c ? c.short : id) + '</span>'; }
  T.chip = chip;
  function sceneById(id) { return O().scenes.find(function (s) { return s.id === id; }); }
  function songById(id) { return O().songs.find(function (s) { return s.id === id; }); }
  T.sceneById = sceneById; T.songById = songById;
  function scriptScene(scene) { var sc = T.show.script; return sc && sc.scenes.find(function (s) { return s.num === scene.num; }); }
  T.scriptScene = scriptScene;

  /* a script label ("TROY", "ALL", "TROY, GABRIELLA") -> character ids; '*' = everyone on stage */
  function labelChars(label) {
    var L = String(label || '').toUpperCase().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    var map = T.show.labelMap || {};
    if (map[L]) return map[L] === '*' ? ['*'] : map[L];
    var g = O().labelGroups || {};
    if (g[L]) return g[L] === '*' ? ['*'] : g[L];
    var one = function (n) { var c = O().characters.find(function (c) { return (c.aliases || []).indexOf(n) >= 0 || c.short.toUpperCase() === n || c.name.toUpperCase() === n; }); return c ? c.id : null; };
    var hit = one(L); if (hit) return [hit];
    var out = [];
    ScriptParser.splitNames(L).forEach(function (n) { var m = map[n] || g[n]; if (m === '*') out.push('*'); else if (m) out = out.concat(m); else { var x = one(n); if (x) out.push(x); } });
    return out;
  }
  T.labelChars = labelChars;
  /* big group numbers (big: true) take everyone in the ensemble and every small role, so students are on stage as much as possible;
     out: characters the teacher took off (a costume change, or another reason) */
  function smallRole(c) { return !!c && (c.group === 'ensemble' || c.group === 'featured' || !!c.small); }
  function onFor(m, c) {
    if ((m.out || []).indexOf(c) >= 0) return false;
    if (m.on === '*' || m.on.indexOf(c) >= 0) return true;
    return !!m.big && smallRole(charById(c));
  }
  function onStage(moment, chars) { return chars.some(function (c) { return onFor(moment, c); }); }
  T.onStage = onStage; T.onFor = onFor; T.smallRole = smallRole;
  function inScene(scene, chars) { return O().moments.some(function (m) { return m.scene === scene.id && onStage(m, chars); }); }
  /* is this label me? ALL counts when I am on stage: for a sung line, on stage for that song (moment); for a spoken line, anywhere in the scene
     (Colleen 2026-10-22: Gabriella's script lit up the auditioners' ALL lines in "Auditions", a song she is not in) */
  function isMine(label, scene, chars, moment) {
    chars = chars || T.me.chars;
    var ids = labelChars(label);
    if (ids.indexOf('*') >= 0) return moment ? onStage(moment, chars) : inScene(scene, chars);
    return ids.some(function (id) { return chars.indexOf(id) >= 0 || groupMembers(id).some(function (c) { return chars.indexOf(c) >= 0; }); });      // a group: its members too
  }
  T.isMine = isMine;
  /* the named characters who sing with a group (Chad and Zeke with the Jocks): the teacher's list, or the show file's for a show saved before */
  function groupMembers(id) {
    var G = T.show && T.show.groupMembers, D = window.DEFAULT_SHOW;
    if (!G && D && D.title === O().title) G = D.groupMembers;
    return (G && G[id]) || [];
  }
  T.groupMembers = groupMembers;
  function myLines(scene) { var s = scriptScene(scene); if (!s) return 0; return s.items.filter(function (it) { return it.type === 'line' && isMine(it.who, scene); }).length; }
  function songMoment(song) { return O().moments.find(function (m) { return m.song === song.id; }); }
  /* the moment of a song item in a scene's script (by its number) */
  T.songMomentFor = function (scene, num) { var so = O().songs.find(function (x) { return x.scene === scene.id && String(x.num) === String(num); }); return so ? songMoment(so) : null; };
  function iSing(song, scene) {
    var s = scene && scriptScene(scene), item = s && s.items.find(function (it) { return it.type === 'song' && it.num === song.num; });
    if (!item) return null;
    var mo = songMoment(song);
    return item.singers.some(function (l) { return isMine(l, scene, null, mo); }) || item.lyrics.some(function (l) { return l.who && isMine(l.who, scene, null, mo); });
  }
  function songMinutes(song) { var t = T.show.tracks && T.show.tracks[song.id], d = t && ((t.performance && t.performance.dur) || (t.rehearsal && t.rehearsal.dur)); return d ? d / 60 : song.minutes || 3; }
  T.songMinutes = songMinutes;
  function momentMinutes(m) { return m.song ? songMinutes(songById(m.song)) : (m.minutes || 1); }

  /* the script split into talking stretches, matched with the scene's talking moments in order */
  function talkSegments(scene) {
    var s = scriptScene(scene); if (!s) return null;
    var segs = [[]];
    s.items.forEach(function (it) { if (it.type === 'song') segs.push([]); else segs[segs.length - 1].push(it); });
    segs = segs.filter(function (g) { return g.some(function (it) { return it.type === 'line'; }); });
    var talks = O().moments.filter(function (m) { return m.scene === scene.id && !m.song; });
    var out = {};
    talks.forEach(function (m, i) { out[m.id] = segs.length === talks.length ? segs[i] : (i === 0 ? [].concat.apply([], segs) : []); });
    return out;
  }
  function costumeFor(momentId, chars) {
    return (O().costumes || []).find(function (c) { return chars.indexOf(c.who) >= 0 && c.moments.indexOf(momentId) >= 0; });
  }

  /* ---------- preferences (this iPad) ---------- */
  var DEF_PREFS = { size: 1, contrast: false, theme: 'auto', rate: 1, symbols: true, motion: true, font: 'atkinson', spacing: 'normal', lines: 'normal', accent: '', tint: '' };
  T.prefs = Object.assign({}, DEF_PREFS, ls('prefs') || {});
  /* reading fonts: Atkinson Hyperlegible (made for low vision), Lexend (made for reading fluency), Andika (made for new readers), Comic Neue, the device's own */
  var FONTS = { atkinson: ["'Atkinson Hyperlegible'", "'Lexend'"], lexend: ["'Lexend'", "'Lexend'"], andika: ["'Andika'", "'Andika'"], comic: ["'Comic Neue'", "'Comic Neue'"], system: ['system-ui', 'system-ui'] };
  var ACCENTS = { purple: '#6b3fd4', blue: '#1f5fbf', teal: '#0f7b7b', green: '#2f7d32', orange: '#b8500f', pink: '#b8336a' };
  var TINTS = { cream: '#fbf5e4', blue: '#e8f1fb', yellow: '#fbf6cf', green: '#e9f5e6', pink: '#fbecf1', gray: '#eeeeee' };
  T.FONTS = FONTS; T.ACCENTS = ACCENTS; T.TINTS = TINTS;
  function applyPrefs() {
    var p = T.prefs, r = document.documentElement;
    r.style.setProperty('--scale', p.size);
    r.dataset.contrast = p.contrast ? '1' : '0';
    if (p.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = p.theme;
    r.dataset.dark = (p.theme === 'dark' || (p.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '1' : '0';
    r.dataset.motion = p.motion ? '1' : '0';
    document.body.classList.toggle('symbols-off', !p.symbols);
    var f = FONTS[p.font] || FONTS.atkinson;
    r.style.setProperty('--font-body', f[0] + ', system-ui, sans-serif'); r.style.setProperty('--font-head', f[1] + ', system-ui, sans-serif');
    r.style.setProperty('--ls', p.spacing === 'wide' ? '0.06em' : 'normal'); r.style.setProperty('--ws', p.spacing === 'wide' ? '0.16em' : 'normal');
    r.style.setProperty('--lh', p.lines === 'tall' ? '1.9' : '1.5');
    if (ACCENTS[p.accent]) { r.dataset.accent = p.accent; r.style.setProperty('--accent-pick', ACCENTS[p.accent]); } else delete r.dataset.accent;
    if (TINTS[p.tint]) { r.dataset.tint = p.tint; r.style.setProperty('--tint', TINTS[p.tint]); } else delete r.dataset.tint;
  }
  /* settings follow the student (a shared iPad, or their own Chromebook): saved for this device and for the signed-in student */
  T.savePrefs = function () { ls('prefs', T.prefs); if (T.me && T.me.id) ls('prefs:' + T.me.id, T.prefs); applyPrefs(); };
  T.loadPrefsFor = function (id) { var mine = id && ls('prefs:' + id); if (mine) { T.prefs = Object.assign({}, DEF_PREFS, mine); applyPrefs(); } };
  applyPrefs();
  /* the show's look (show file: theme), on every page and before unlocking (the public show file has it too) */
  function showTheme() {      // the loaded show's theme; a show saved before themes existed takes it from the show file when it is the same show
    var D = window.DEFAULT_SHOW, out = T.show && T.show.outline;
    if (out) return out.theme || (D && D.title === out.title ? D.theme : null);
    return D && D.theme;
  }
  T.showTheme = showTheme;
  function applyTheme() {
    var th = showTheme(), r = document.documentElement;
    if (th) r.dataset.show = th.id; else delete r.dataset.show;
    var m = document.getElementById('themecolor'); if (m) m.content = th && th.color ? th.color : '#1d1a2e';
  }
  T.applyTheme = applyTheme; applyTheme();
  /* the banner on the home pages: the show's title on its school colors, with a basketball and a spotlight (drawn for this app) */
  T.showBanner = function () {
    var th = showTheme(); if (!th) return '';
    return '<div class="showhero" role="img" aria-label="' + esc(O().title) + '">' +
      '<svg class="showhero-art" viewBox="0 0 120 120" aria-hidden="true"><path class="beam" d="M60 0 L20 120 H100 Z"/>' +
      '<circle cx="60" cy="74" r="30" class="ball"/><path class="seam" d="M30 74 H90 M60 44 V104 M39 53 C52 64 52 84 39 95 M81 53 C68 64 68 84 81 95"/>' +
      '<path class="star" d="M22 22 l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/><path class="star" d="M98 30 l2 5 5 .5-4 3.5 1 5-4-2.5-4 2.5 1-5-4-3.5 5-.5z"/></svg>' +
      '<div class="showhero-text"><div class="showhero-kicker">' + esc(th.presents || '') + '</div><div class="showhero-title">' + esc(O().title) + '</div>' +
      (th.cheer ? '<div class="showhero-cheer">' + esc(th.cheer) + '</div>' : '') + '</div></div>';
  };

  var DEF_ACCESS = { show: 'auto', echo: false, didIt: false, mic: true, sayForMe: true, strict: 'medium' };
  T.DEF_ACCESS = DEF_ACCESS;
  /* ---------- other passwords (Colleen 2026-10-23: parents, peer helpers…) ----------
     T.show.passes: [{ id, name, off, who: 'student' | 'parent' | 'helper', pages: [student pages], teach: [teacher pages, view only],
     fullCal }]. Practice: never recorded for parents; a helper's is the student's, marked (progress.js). The password that opened this iPad is remembered (ls passId); T.pass is its checklist, or null for the cast password. */
  T.pass = null;
  T.STUDENT_PAGES = [['today', 'Today (my job in class)'], ['schedule', 'My Schedule'], ['calendar', 'My calendar'], ['lines', 'Practice Lines'], ['songs', 'My Songs'],
    ['costumes', 'My Costumes'], ['story', 'The Story'], ['script', 'The Script'], ['print', 'Print my script'], ['auditions', 'Auditions'], ['shop', 'Shopping list'], ['react', 'React to That! (reaction practice)'], ['help', 'Volunteer and donate (for families)'], ['photos', 'Costume and prop photos']];
  T.TEACH_PAGES = [['callboard', 'Call board (who is where, each day)'], ['read', 'The script (teacher view)'], ['cues', 'Cue sheet'], ['smscript', 'Stage manager script'], ['mics', 'Mic plot']];
  /* in the Company (Colleen 2026-10-23): a.company is 'artist' (Company Artist) or 'mentor' (Company Mentor), or not set yet */
  T.COMPANY = { artist: 'Artist', mentor: 'Mentor' };
  T.companyTag = function (a) { return a && T.COMPANY[a.company] ? '<span class="tag co-' + a.company + '">' + T.COMPANY[a.company] + '</span>' : ''; };
  T.shortName = function (n) { var w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[0] + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.' : w[0] || ''; };
  T.usePass = function () {      // false: this iPad's password was turned off or deleted
    var id = ls('passId'); T.pass = null;
    if (!id) return true;
    var p = (T.show.passes || []).find(function (x) { return x.id === id; });
    if (!p || p.off) return false;
    T.pass = p;
    if (p.who === 'parent') (T.show.cast || []).forEach(function (a) { a.name = T.shortName(a.name); });      // first name and last initial for parents (this copy is never saved: parents cannot save)
    return true;
  };
  var PAGE_OF = { song: 'songs', listen: 'songs' };
  T.passAllows = function (page) {
    if (page === 'family') return !!(T.pass && T.pass.who === 'parent');      // the Family portal forms (portal.js): every parent password, nobody else
    if (!T.pass || !page || ['home', 'who', 'settings', 'unlock'].indexOf(page) >= 0) return true;
    return (T.pass.pages || []).indexOf(PAGE_OF[page] || page) >= 0;
  };
  T.passTeach = function (page, args) {      // a teacher page this password may look at (never change)
    if (!T.pass) return false;
    var k = page === 'production' && args && args[0] === 'callboard' ? 'callboard' : page;
    return (T.pass.teach || []).indexOf(k) >= 0;
  };
  function setMe(sel) {
    T.me = null;
    if (!sel || !T.show) return;
    if (sel.cast) {
      var c = (T.show.cast || []).find(function (x) { return x.id === sel.cast; });
      if (c) { T.me = { id: c.id, name: c.name, chars: (c.chars || []).slice(), photo: c.photo, access: Object.assign({}, DEF_ACCESS, c.access || {}) }; T.loadPrefsFor(c.id); }
    } else if (sel.char && charById(sel.char)) {
      var ch = charById(sel.char);
      T.me = { id: null, name: ch.short, chars: [ch.id], access: Object.assign({}, DEF_ACCESS, ls('access') || {}) };
    }
  }
  function face(person, size) {
    var c = person.chars && person.chars[0] ? color(person.chars[0]) : 'var(--accent)';
    var initials = String(person.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    return '<span class="face" style="--c:' + c + (size ? ';width:' + size + 'px;height:' + size + 'px;font-size:' + (size / 2.6) + 'px' : '') + '">' +
      (person.photo ? '<img src="' + esc(person.photo) + '" alt="">' : esc(initials)) + '</span>';
  }
  T.face = face;

  /* ---------- speech: a different voice for each character ---------- */
  /* Speech: only the device's good English voices (Colleen, 2026-10-21: the voices were "terrible", because a 27-character show was being handed
     every voice, joke voices included). Premium / Enhanced / natural voices first; a small pool; gentle pitch changes between characters.
     Words go through pronounce() first: the show's name list (outline.say), the teacher's own list (T.show.say), and a few clean-ups. */
  var JOKE = /bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|hysterical|deranged|pipe organ/i;
  function voiceScore(v) {
    var n = v.name, sc = 0;
    if (/premium|enhanced|natural|neural|siri|wavenet|studio/i.test(n)) sc += 20;
    if (/google/i.test(n)) sc += 8;
    if (/^en[-_]US/i.test(v.lang)) sc += 4; else if (/^en[-_](GB|AU|CA|IE|NZ)/i.test(v.lang)) sc += 3; else sc += 1;
    if (/^(samantha|aaron|nicky|ava|allison|susan|tom|alex|evan|zoe|nathan|joelle|noelle|daniel|serena|karen|moira|tessa|kate|oliver)\b/i.test(n)) sc += 5;
    if (/compact/i.test(n)) sc -= 6;
    return sc;
  }
  var Speech = T.Speech = {
    voices: [], all: [],
    load: function () {
      if (!('speechSynthesis' in window)) return;
      var en = speechSynthesis.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang) && !JOKE.test(v.name); });
      en.sort(function (a, b) { return voiceScore(b) - voiceScore(a); });
      Speech.all = en;
      var pick = T.prefs.voice && en.find(function (v) { return v.name === T.prefs.voice; });
      /* my voice (Colleen: each student picks the voice that says their own lines, so they learn to listen for it); nobody else uses it */
      var mineName = Speech.myVoiceName(), mine = mineName && en.find(function (v) { return v.name === mineName; });
      Speech.mineVoice = mine || null;
      var pool = en.slice(0, 6);
      if (pick) pool = [pick].concat(pool.filter(function (v) { return v !== pick; }));
      Speech.voices = T.prefs.oneVoice ? pool.slice(0, 1) : pool;
      /* characters who would have had my voice get the most similar one left: same accent, not already in use if possible */
      Speech.sub = null;
      if (mine) {
        var lang = function (v) { return String(v.lang).slice(0, 5).toLowerCase(); };
        var free = en.filter(function (v) { return v !== mine && Speech.voices.indexOf(v) < 0; }), used = Speech.voices.filter(function (v) { return v !== mine; });
        Speech.sub = free.find(function (v) { return lang(v) === lang(mine); }) || used.find(function (v) { return lang(v) === lang(mine); }) || free[0] || used[0] || null;
      }
    },
    mine: [],
    myVoiceName: function () { return T.me ? ls('myVoice:' + (T.me.id || T.me.chars[0] || 'me')) : null; },
    setMyVoice: function (name) { if (T.me) ls('myVoice:' + (T.me.id || T.me.chars[0] || 'me'), name || null); Speech.load(); },
    /* the narrator is the first voice; characters share the pool, told apart by a gentle pitch change */
    voiceFor: function (charId) {
      if (charId && Speech.mineVoice && Speech.mine.indexOf(charId) >= 0) return { voice: Speech.mineVoice, pitch: 1 };
      var i = charId ? O().characters.findIndex(function (c) { return c.id === charId; }) + 1 : 0, n = Speech.voices.length;
      var steps = [1, 0.92, 1.08, 0.96, 1.04], v = n ? Speech.voices[i % n] : null;
      if (v && v === Speech.mineVoice && Speech.sub) v = Speech.sub;      // my voice is only mine
      return { voice: v, pitch: charId ? steps[Math.floor(i / Math.max(1, n)) % steps.length] : 1 };
    },
    say: function (text, charId, opts) {
      opts = opts || {};
      text = pronounce(text);
      return new Promise(function (done) {
        if (!('speechSynthesis' in window) || !text) return done();
        var u = new SpeechSynthesisUtterance(text), v = opts.mine && Speech.mineVoice ? { voice: Speech.mineVoice, pitch: 1 } : Speech.voiceFor(charId), finished = false;
        if (v.voice) u.voice = v.voice;
        u.lang = (v.voice && v.voice.lang) || 'en-US';
        u.pitch = v.pitch; u.rate = (opts.rate || T.prefs.rate || 1) * 0.95;
        var end = function () { if (!finished) { finished = true; clearTimeout(guard); done(); } };
        u.onend = end; u.onerror = end;
        // Safari sometimes never says "ended"; a generous guess at the length
        var guard = setTimeout(end, 2500 + text.length * 110 / (u.rate || 1));
        Speech.current = end;
        speechSynthesis.speak(u);
      });
    },
    stop: function () { if ('speechSynthesis' in window) speechSynthesis.cancel(); if (Speech.current) { var c = Speech.current; Speech.current = null; c(); } }
  };
  function sayList() { var out = {}, a = (T.show && T.O().say) || {}, b = (T.show && T.show.say) || {}; Object.keys(a).forEach(function (k) { out[k] = a[k]; }); Object.keys(b).forEach(function (k) { out[k] = b[k]; }); return out; }
  function pronounce(text) {
    var t = String(text || '');
    var list = sayList();
    Object.keys(list).sort(function (x, y) { return y.length - x.length; }).forEach(function (w) {
      if (!list[w]) return;
      t = t.replace(new RegExp('(^|[^A-Za-z’\'])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^A-Za-z])', 'gi'), function (m, pre) { return pre + list[w]; });
    });
    return t.replace(/\bMs\./gi, 'Miz').replace(/\bMr\./gi, 'Mister').replace(/\bMrs\./gi, 'Missus')
      .replace(/\s*[—–]+\s*/g, ', ').replace(/\.{3}|…/g, ', ').replace(/_+/g, ' ')
      .replace(/\b([A-Z]{2,})\b/g, function (w) { return /^(OK|TV|DJ|USA|I)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(); })      // shouting caps: say the word, do not spell it
      .replace(/^[,\s]+/, '').replace(/\s+/g, ' ').trim();
  }
  T.pronounce = pronounce;
  if ('speechSynthesis' in window) { Speech.load(); speechSynthesis.onvoiceschanged = Speech.load; }

  /* ---------- listening (iPad Safari: webkitSpeechRecognition, needs https) ---------- */
  var Rec = function () { return window.SpeechRecognition || window.webkitSpeechRecognition; };
  T.canListen = !!Rec();
  function listen(onStart) {
    return new Promise(function (done) {
      var R = Rec(), r = new R(), alts = [], interim = '', ended = false;
      r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
      r.onresult = function (e) {
        interim = '';
        for (var i = 0; i < e.results.length; i++) {
          var res = e.results[i];
          if (res.isFinal) for (var j = 0; j < res.length; j++) alts.push(res[j].transcript);
          else interim += res[0].transcript;
        }
      };
      var finish = function () { if (ended) return; ended = true; clearTimeout(t); try { r.stop(); } catch (e) {} if (!alts.length && interim) alts.push(interim); done(alts); };
      r.onend = finish; r.onerror = finish;
      var t = setTimeout(finish, 12000);
      listen.stop = finish;
      try { r.start(); if (onStart) onStart(); } catch (e) { finish(); }
    });
  }

  /* ---------- routing ---------- */
  var titleEl = document.getElementById('title'), backBtn = document.getElementById('back'), meBtn = document.getElementById('mebtn');
  function setBar(title, back) {
    titleEl.textContent = title; document.title = title === 'Theatre' ? 'Theatre' : title + ' · Theatre'; applyTheme();
    backBtn.hidden = !back; backBtn.dataset.to = back || '';
    meBtn.hidden = !T.me; meBtn.innerHTML = T.me ? face(T.me, 40) : '';
  }
  T.setBar = setBar;
  backBtn.onclick = function () { location.hash = backBtn.dataset.to; };
  meBtn.onclick = function () { location.hash = '#/settings'; };
  T.cleanup = [];
  function route() {
    T.cleanup.forEach(function (f) { try { f(); } catch (e) {} }); T.cleanup = [];
    Speech.mine = T.me ? T.me.chars.slice() : []; Speech.load();
    Speech.stop();
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    var page = parts[0] || '';
    if (page === 'signin') { ls('signinCode', parts[1] || 'none'); history.replaceState(null, '', location.pathname + '#/'); page = ''; parts = []; }      // back from the school sign-in page
    if (page === 'teacher') return T.routes.teacher(parts.slice(1));
    if (!T.show) return unlockPage();
    if (applySignin()) return;
    if (!T.me && page !== 'settings') return whoPage();
    if (!T.passAllows(page)) page = 'home';
    var fn = { '': homePage, home: homePage, who: whoPage, lines: linesPage, schedule: schedulePage, songs: songsPage, song: songPage, costumes: costumesPage, story: storyPage, settings: settingsPage, unlock: unlockPage, listen: listenPage }[page] || (T.studentPages || {})[page];
    (fn || homePage)(parts.slice(1));
    app.scrollTop = 0; window.scrollTo(0, 0);
  }
  T.route = route;

  /* which parts of the app get used, counted anonymously by kind of password (student, parent, helper): page opens and active seconds,
     sent in small batches and added up by month on the server (theatre/api.js usage). No name, student or device goes with them.
     Teacher mode is not counted. Report: Teacher mode › App use. */
  var use = { k: null, page: null, pages: {}, last: Date.now() };
  function usePage() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), page = parts[0] || 'home';
    if (!T.show || !T.key || T.proof) return null;
    if (page === 'teacher') { if (!T.pass) return null; page = 't-' + (parts[1] === 'production' && parts[2] === 'callboard' ? 'callboard' : parts[1] || 'home'); }
    return page.replace(/[^a-z-]/g, '').slice(0, 24) || null;
  }
  function useKind() { return T.pass ? T.pass.who : 'student'; }
  function useAdd(p, opens, secs) { if (!p) return; var x = use.pages[p] = use.pages[p] || [0, 0]; x[0] += opens; x[1] += secs; }
  function useSend() {
    if (!use.k || !Object.keys(use.pages).length || !navigator.onLine) return;
    Store.sendUsage(use.k, use.pages); use.pages = {};
  }
  window.addEventListener('hashchange', function () {
    var p = usePage(); if (!p) return;
    if (use.k && use.k !== useKind()) useSend();
    use.k = useKind(); use.page = p; useAdd(p, 1, 0);
  });
  ['pointerdown', 'keydown'].forEach(function (e) { document.addEventListener(e, function () { use.last = Date.now(); }, true); });
  setInterval(function () {      // seconds on a page: only while it is showing and someone touched it in the last two minutes (or a track is playing)
    var p = usePage(); if (!p || document.visibilityState !== 'visible') return;
    if (Date.now() - use.last < 120000 || (T.Progress && T.Progress.playing)) { use.k = useKind(); useAdd(p, 0, 10); }
  }, 10000);
  setInterval(useSend, 60000);
  setTimeout(function () { var p = usePage(); if (p) { use.k = useKind(); use.page = p; useAdd(p, 1, 0); } }, 3000);      // the page the app opened on
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') useSend(); });
  T.go = function (h) { if (location.hash === h) route(); else location.hash = h; };
  window.addEventListener('hashchange', route);

  /* ---------- Unlock ---------- */
  function unlockPage() {
    setBar('Theatre');
    if (!T.saved) {
      app.innerHTML = '<div class="card center" style="max-width:560px;margin:40px auto"><h2>' + sym('🎭') + 'Theatre</h2>' +
        (T.loadError ? '<p class="err">' + esc(T.loadError) + '</p>' : '<p>The show is not set up yet.</p><p class="muted">Teacher: set up the show and choose the passwords.</p>') +
        '<p><a class="btn primary" href="#/teacher/setup">Teacher setup</a></p></div>';
      return;
    }
    app.innerHTML = '<form class="card" id="unlock" style="max-width:560px;margin:40px auto"><h2>' + sym('🎭') + 'Welcome to the show!</h2>' +
      '<p>Type the <b>password</b> your teacher gave you.</p>' +
      '<label class="f">Password<input type="password" id="pw" autocomplete="current-password" autocapitalize="off" spellcheck="false" required></label>' +
      '<label class="switch"><span>Remember on this iPad</span><input type="checkbox" id="keep" checked></label>' +
      '<p class="err" id="msg" role="alert"></p><div class="row end"><button class="btn primary" type="submit">' + icon('lock') + 'Open</button></div>' +
      (T.saved.offline ? '<p class="muted small">No internet right now. Using the copy saved on this iPad.</p>' : '') + '</form>' +
      '<p class="center"><a href="#/teacher" class="muted">Teacher mode</a></p>';
    var f = document.getElementById('unlock');
    setTimeout(function () { var box = document.getElementById('pw'); if (box) box.focus({ preventScroll: true }); }, 50);      // ready to type
    f.onsubmit = function (e) {
      e.preventDefault();
      var pw = document.getElementById('pw').value, msg = document.getElementById('msg'), btn = f.querySelector('button');
      btn.disabled = true; msg.textContent = 'Opening…';
      Store.unlockAny(T.saved.enc, pw).then(function (r) {
        return Store.decryptShow(r.key, T.saved.enc).then(function (doc) {
          T.show = doc;
          if ((ls('passId') || null) !== r.access) ls('me', null);      // a different kind of password on this iPad: pick again
          ls('passId', r.access);
          if (!T.usePass()) { T.show = null; ls('passId', null); msg.textContent = 'That password is turned off. Ask your teacher.'; btn.disabled = false; return; }
          T.key = r.key;
          if (document.getElementById('keep').checked) Store.remember(r.key);
          setMe(ls('me')); T.go(T.me ? '#/home' : '#/who');
        });
      }).catch(function () { msg.textContent = 'That is not the password. Try again.'; btn.disabled = false; });
    };
    setTimeout(function () { var p = document.getElementById('pw'); if (p) p.focus(); }, 50);
  }

  /* ---------- Who are you? ---------- */
  /* School sign-in (Colleen 2026-10-23: "cant it tell from the cast list and the school account logged in who they are"): Sign in with
     Google (the teacher's Client ID and school domain in T.show.signin), the account's email matched to the cast list. Emails are kept
     only as a scrambled code (T.emailHash), never readable in the show. The cast password still unlocks the show once on each device. */
  T.emailHash = function (email) {
    var b = new TextEncoder().encode('theatre:' + String(email || '').trim().toLowerCase());
    return crypto.subtle.digest('SHA-256', b).then(function (h) { return Array.from(new Uint8Array(h)).map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); });
  };
  /* the school's own sign-in page (an Apps Script web app in Colleen's school account, like ASL Study Hall): it knows the school account
     Chrome is signed into and sends the student back here with the scrambled code of their email (#/signin/<code>) */
  var SIGNIN_PAGE = 'https:' + '//script.google.com/a/macros/d204.lths.net/s/AKfycbyPT5T6gQ6nB-fEqI7QkZ7eu-wSmQ9TGSiFu5iCJUHGoOcznJncTDeWo3OLz2k0Y4CPEA/exec';
  function signinPage() { var S = T.show && T.show.signin; return (S && S.page) || SIGNIN_PAGE; }
  T.testSignin = function () { ls('signinTest', 1); location.href = signinPage() + '?r=' + encodeURIComponent(location.origin + location.pathname); };
  function goSignin() { try { sessionStorage.setItem('signinTried', '1'); } catch (e) {} location.href = signinPage() + '?r=' + encodeURIComponent(location.origin + location.pathname); }
  function applySignin() {      // a code came back: find the student on the cast list and remember them on this device
    var code = ls('signinCode'); if (!code) return false;
    ls('signinCode', null);
    if (ls('signinTest')) {      // the teacher's test from Passwords & backup: say what happened and go back there
      ls('signinTest', null);
      var who = code !== 'none' && (T.show.cast || []).find(function (c) { return c.emailHash === code; });
      T.toast(code === 'none' ? 'The school sign-in page could not read the school account. Make sure Chrome is signed into your school Google account, then try again.' :
        '✅ The school sign-in works: Google told the app who you are.' + (who ? ' You are on the cast as ' + who.name + '.' : ' (Your email is not on the cast list, which is fine until there is a cast.)'), 9000);
      location.replace('#/teacher/passwords'); return true;
    }
    if (code === 'none') { T.toast('The school account could not be read. Tap your picture instead.', 5000); return false; }
    var a = (T.show.cast || []).find(function (c) { return c.emailHash === code; });
    if (!a) { T.toast('Your school account is not on the cast list yet. Tap your picture and tell your teacher.', 6000); return false; }
    var sel = { cast: a.id, school: 1 }; ls('me', sel); setMe(sel); location.replace('#/home'); return true;
  }
  var gsiP = null;
  function loadGsi() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    return gsiP || (gsiP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https:' + '//accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = function () { gsiP = null; no(new Error('Could not reach Google. Check the internet.')); }; document.head.appendChild(s); }));
  }
  function schoolSignIn(box) {
    var S = T.show.signin; if (!S || !S.clientId || !box) return;
    loadGsi().then(function () {
      google.accounts.id.initialize({ client_id: S.clientId, hd: S.domain || undefined, auto_select: true, callback: function (resp) {
        var p = {}; try { p = JSON.parse(decodeURIComponent(escape(atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) {}
        var email = String(p.email || '').toLowerCase();
        if (!email || p.email_verified === false) { T.toast('Google did not share an email. Tap your picture instead.', 5000); return; }
        if (S.domain && email.split('@')[1] !== S.domain.toLowerCase()) { T.toast('Use your school account (@' + S.domain + ').', 5000); return; }
        T.emailHash(email).then(function (h) {
          var a = (T.show.cast || []).find(function (c) { return c.emailHash === h; });
          if (!a) { T.toast('Your school account is not on the cast list yet. Tap your picture below and tell your teacher.', 6000); return; }
          var sel = { cast: a.id, google: 1 }; ls('me', sel); setMe(sel); T.go('#/home');
        });
      } });
      google.accounts.id.renderButton(box, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with' });
      google.accounts.id.prompt();      // signs right in when this device has used it before
    }).catch(function (e) { box.textContent = e.message; });
  }
  function whoPage(args) {
    setBar('Who are you?', T.me ? '#/home' : '');
    var cast = (T.show.cast || []).filter(function (c) { return c.name; });      // before casting, students are on the list with no role yet
    if (T.pass && T.pass.who === 'helper' && cast.some(function (c) { return c.company === 'artist'; }) && !(args && args[0] === 'all')) cast = cast.filter(function (c) { return c.company === 'artist'; });      // a Mentor works with an Artist
    var pickChars = (args && args[0] === 'character') || !cast.length;
    var hasEmails = !pickChars && cast.some(function (c) { return c.emailHash; });
    var google = hasEmails && T.show.signin && T.show.signin.clientId;
    // the school sign-in page: tried once by itself (a quick hop to Google and back), and a button to try again
    var tried = false; try { tried = sessionStorage.getItem('signinTried') === '1'; } catch (e) {}
    if (hasEmails && !T.me && !tried && !google && !(T.pass && T.pass.who !== 'student')) { goSignin(); return; }
    var h = hasEmails ? '<div class="card center"><h2>Sign in with your school account</h2><p class="muted">The app finds you on the cast list.</p>' +
      (google ? '<div id="gsi" style="display:flex;justify-content:center;min-height:44px"></div>' : '<button class="btn primary" id="schoolin">Use my school account</button>') + '</div>' : '';
    var pw = T.pass && T.pass.who;
    if (pw === 'parent' || pw === 'helper') { h = ''; setBar(pw === 'parent' ? 'Your Company member' : 'Working with an Artist', T.me ? '#/home' : ''); }      // not their own picture: no school sign-in
    h += pw === 'parent' ? '<h2>Which Company member is yours?</h2><p class="muted">Tap your Company member' + (pickChars ? '’s character' : '') + '. You can change it later in Settings.</p>' :
      pw === 'helper' ? '<h2>Which Artist are you working with today?</h2><p class="muted">Tap the Artist' + (pickChars ? '’s character' : '') + '. Switch any time from the home page.</p>' :
      '<h2>' + (pickChars ? 'Pick your character' : hasEmails ? 'Or tap your picture' : 'Who are you?') + '</h2><p class="muted">Tap your ' + (pickChars ? 'character' : 'picture') + '.</p>';
    if (!pickChars) {
      h += '<div class="choose">' + cast.map(function (c) {
        return '<button class="person" data-cast="' + esc(c.id) + '">' + face(c) + '<b>' + esc(c.name) + '</b><span>' + ((c.chars || []).map(function (id) { var x = charById(id); return x ? esc(x.short) : ''; }).join(', ') || 'Role coming soon') + '</span></button>';
      }).join('') + '</div><p class="center"><a href="#/who/character" class="btn quiet">I am not on the list: pick a character</a></p>';
    } else {
      O().groups.forEach(function (g) {
        var list = O().characters.filter(function (c) { return c.group === g.id; });
        if (!list.length) return;
        h += '<h3 style="margin-top:18px">' + esc(g.name) + '</h3><div class="choose">' + list.map(function (c) {
          return '<button class="person" data-char="' + esc(c.id) + '">' + face({ name: c.short, chars: [c.id] }) + '<b>' + esc(c.short) + '</b></button>';
        }).join('') + '</div>';
      });
      if (cast.length) h += '<p class="center"><a href="#/who" class="btn quiet">Back to the cast list</a></p>';
    }
    app.innerHTML = h;
    if (google) schoolSignIn(document.getElementById('gsi'));
    var si = document.getElementById('schoolin'); if (si) si.onclick = goSignin;
    app.querySelectorAll('.person').forEach(function (b) {
      b.onclick = function () {
        var sel = b.dataset.cast ? { cast: b.dataset.cast } : { char: b.dataset.char };
        ls('me', sel); setMe(sel); T.go('#/home');
      };
    });
  }

  /* ---------- Actor home ---------- */
  function homePage() {
    setBar(O().title);
    var who = T.me.chars.map(chip).join('');
    var pw = T.pass && T.pass.who, teach = T.pass ? T.TEACH_PAGES.filter(function (x) { return T.passTeach(x[0] === 'callboard' ? 'production' : x[0], x[0] === 'callboard' ? ['callboard'] : []); }) : [];
    app.innerHTML = T.showBanner() + '<div class="row" style="margin-bottom:16px">' + face(T.me, 72) +
      '<div class="grow"><h2 style="margin:0">' + (pw === 'parent' ? 'Following ' + esc(T.me.name) : pw === 'helper' ? 'Working with ' + esc(T.me.name) : 'Hi, ' + esc(T.me.name) + '!') + '</h2><div>' + who + '</div></div>' +
      (pw === 'helper' ? '<a class="btn" href="#/who">Switch Artist</a>' : '') + '</div>' +
      (T.pass ? '<p class="muted small">' + esc(T.pass.name || '') + ' · view only' + (pw === 'helper' ? ' · practice here is saved for ' + esc(T.me.name) + ', marked “with a Mentor”' : '') + '</p>' : '') +
      (pw === 'parent' && T.portalHome ? T.portalHome() : '') +      // parents: what needs their answer and the teacher's news first
      '<div class="tiles">' +
      tile('#/today', 'sched', 'Today', 'My job in class') +
      (T.auditionsTile && T.auditionsTile() ? tile('#/auditions', 'star', 'Auditions', T.show.casting.posted ? 'The cast list is up!' : T.show.casting.callbacksShown ? 'Callbacks' : 'Sign up and practice') : '') +
      tile('#/schedule', 'stage', 'My Schedule', 'When I am on stage') +
      tile('#/lines', 'lines', 'Practice Lines', 'Listen and say my lines') +
      tile('#/songs', 'songs', 'My Songs', 'Sing with the tracks') +
      tile('#/costumes', 'shirt', 'My Costumes', 'What I wear') +
      (T.shopTile && T.shopTile() ? tile('#/shop', 'shirt', 'Shopping list', T.shopTile()) : '') +
      (T.photosTile && T.photosTile() ? tile('#/photos', 'camera', 'Costume photos', T.photosTile()) : '') +
      tile('#/react', 'star', 'React to That!', 'Practice reacting') +
      (pw === 'parent' ? tile('#/help', 'hand', 'Volunteer and donate', 'What the show needs') : '') +
      tile('#/story', 'book', 'The Story', 'What happens') +
      (T.Pages && T.Pages.ready() ? tile('#/script', 'book', 'The Script', 'The real pages, with my notes') : '') +
      (T.Pages && T.Pages.ready() && T.me.chars.length ? tile('#/print', 'print', 'My script', 'Print it with my highlights') : '') +
      (T.pass && T.passAllows('calendar') && !T.passAllows('today') ? tile('#/calendar', 'sched', 'Calendar', 'What is happening each day') : '') +
      tile('#/settings', 'gear', 'Settings', 'Text size, colors, voice') +
      '</div>' + (teach.length ? '<h3 style="margin-top:18px">Show pages (view only)</h3><div class="tiles">' + teach.map(function (x) { return '<a class="tile" href="#/teacher/' + (x[0] === 'callboard' ? 'production/callboard' : x[0]) + '">' + icon('book') + '<b>' + esc(x[1].replace(/ \(.*\)$/, '')) + '</b></a>'; }).join('') + '</div>' : '') + (T.show.script ? '' : '<p class="card muted" style="margin-top:18px">Your teacher has not added the script yet, so lines and lyrics are not here yet.</p>');
  }
  function tile(href, ic, name, sub) { if (!T.passAllows(href.replace(/^#\//, '').split('/')[0])) return ''; return '<a class="tile" href="' + href + '">' + icon(ic) + '<b>' + name + '</b><span>' + sub + '</span></a>'; }

  /* ---------- Practice Lines ---------- */
  function linesPage(args) {
    if (!args[0]) return sceneList();
    var scene = sceneById(args[0]); if (!scene) return sceneList();
    if (!args[1]) return modePick(scene);
    if (args[1] === 'record' && T.recordScene) return T.recordScene(scene);
    return practice(scene, args[1] === 'run' ? 'run' : 'listen', args[2]);      // args[2]: practice as another character (an audition side)
  }
  function sceneList() {
    setBar('Practice Lines', '#/home');
    if (!T.show.script) { app.innerHTML = '<div class="card"><p>The script is not here yet. Your teacher adds it in Teacher mode.</p></div>'; return; }
    app.innerHTML = (T.studyNextCard ? T.studyNextCard() : '') + '<h2>Pick a scene</h2><div class="grid">' + O().scenes.map(function (s) {
      var n = myLines(s), mine = inScene(s, T.me.chars);
      return '<a class="tile" style="min-height:120px;align-items:flex-start;text-align:left' + (mine ? ';border-color:' + color(T.me.chars[0]) : ';opacity:.75') + '" href="#/lines/' + s.id + '">' +
        '<b>' + sym(SCENE_SYM[s.icon] || '🎬') + 'Scene ' + s.num + '</b><span style="color:var(--ink)">' + esc(s.place) + '</span>' +
        '<span>' + (n ? '<span class="tag">' + n + ' line' + (n === 1 ? '' : 's') + ' for you</span>' : mine ? 'You are on stage' : 'You are not in this scene') + '</span></a>';
    }).join('') + '</div>';
  }
  function modePick(scene) {
    setBar('Scene ' + scene.num, '#/lines');
    var n = myLines(scene);
    app.innerHTML = '<h2>' + sym(SCENE_SYM[scene.icon] || '🎬') + 'Scene ' + scene.num + ': ' + esc(scene.place) + '</h2><p class="muted">' + esc(scene.story) + '</p>' +
      '<div class="tiles" style="margin-top:16px">' +
      tile('#/lines/' + scene.id + '/listen', 'speak', 'Listen', 'Hear the whole scene') +
      (n ? tile('#/lines/' + scene.id + '/run', 'mic', 'Run my role', 'The app stops for your ' + n + ' line' + (n === 1 ? '' : 's')) : '') +
      (n && T.me.id ? tile('#/lines/' + scene.id + '/record', 'mic', 'Record my lines', 'Your class hears your voice') : '') +
      '</div>';
  }

  function practice(scene, mode, asChar) {
    var myChars = asChar && charById(asChar) ? [asChar] : T.me.chars;
    Speech.mine = myChars.slice();
    setBar('Scene ' + scene.num + (mode === 'run' ? (asChar ? ' · as ' + charById(asChar).short : ' · My lines') : ' · Listen'), asChar ? '#/auditions' : '#/lines/' + scene.id);
    var src = scriptScene(scene);
    if (!src) { app.innerHTML = '<div class="card">This scene is not in the script yet.</div>'; return; }
    var acc = T.me.access;
    var opt = Object.assign({ names: true, dirs: false, show: acc.show, echo: acc.echo, didIt: acc.didIt || !T.canListen, strict: acc.strict, view: 'pages' }, ls('practice') || {});
    var pagesOn = function () { return opt.view === 'pages' && T.Pages && T.Pages.ready(); };      // the real script pages, highlighted
    if (!T.canListen) opt.didIt = true;
    var items = src.items.map(function (it, i) {
      var chars = it.type === 'line' ? labelChars(it.who).filter(function (c) { return c !== '*'; }) : [];
      return { i: i, it: it, chars: chars, mine: it.type === 'line' && isMine(it.who, scene, myChars) };
    });
    /* lines spoken over a song's music (Teacher mode › Songs & tracks › Lines over the music): the track plays inside the run and those lines
       happen on cue without stopping it (Colleen: "lines over the music ... play while the track is also playing") */
    var songOf = function (it) { return O().songs.find(function (s) { return s.num === it.num; }); };
    var trackOf = function (song) { var t = song && T.show.tracks && T.show.tracks[song.id]; return t && (t.rehearsal || t.performance) ? t : null; };
    items.forEach(function (x) {
      if (x.it.type !== 'song') return;
      var song = songOf(x.it), u = song && T.show.underscore && T.show.underscore[song.id];
      x.song = song; x.cues = [];
      if (u) u.cues.forEach(function (c) { var y = items.find(function (z) { return z.it.type === 'line' && T.lineKey(z.it) === c.key; }); if (y) { y.cuedBy = x.i; x.cues.push({ y: y, t: c.t }); } });
      x.cueKind = u ? u.kind : 'performance';
      x.cues.sort(function (a, b) { return a.t - b.t; });
    });
    var songStop = null;
    var cur = 0, playing = false, gen = 0, hintLevel = 0;
    /* Fade (the default): each of my lines starts shown, then a hint once I say it without help, then hidden; it steps back when I need help.
       Prompting with prompt fading is one of the evidence-based practices for autistic learners (NCAEP 2020). Kept on this iPad. */
    var fadeKey = 'fade:' + (T.me.id || myChars[0]) + ':' + (asChar ? asChar + ':' : '') + scene.id, fade = ls(fadeKey) || {};
    var fk = function (x) { return x.it.who + '|' + x.it.text.slice(0, 48); };
    function showFor(x) { return opt.show === 'auto' ? ['line', 'hint', 'hidden'][fade[fk(x)] || 0] : opt.show; }
    function fadeStep(x, d) { if (opt.show !== 'auto') return; fade[fk(x)] = Math.max(0, Math.min(2, (fade[fk(x)] || 0) + d)); ls(fadeKey, fade); }

    function lineText(x) {
      if (mode === 'run' && x.mine && !x.done) {
        if (showFor(x) === 'hidden') return '<span class="muted">(your line)</span>';
        if (showFor(x) === 'hint') return '<span class="blank">' + esc(LineCheck.hint(x.it.text, 1)) + '</span>';
      }
      return esc(x.it.text);
    }
    function whoName(label) {
      var ids = labelChars(label);
      if (ids.length === 1 && ids[0] !== '*') return charById(ids[0]).short;
      return label.replace(/\b([A-Z])([A-Z']+)/g, function (m, a, b) { return a + b.toLowerCase(); });
    }
    var dockHtml = function () {
      return '<div class="dock"><div class="in"><button class="round" id="pv" aria-label="Back one line">' + icon('prev') + '</button>' +
        '<button class="round big" id="pp" aria-label="Play">' + icon('play') + '</button>' +
        '<button class="round" id="nx" aria-label="Next line">' + icon('next') + '</button></div></div>' +
        keyHint('Space: play or pause · ← →: back or next' + (mode === 'run' ? ' · Enter: I got it · X: not yet · H: hint · S: say it for me' : ''));
    };
    function wireDock() {
      renderOpts();
      document.getElementById('pp').onclick = function () { playing ? pause() : play(); };
      document.getElementById('pv').onclick = function () { jump(prevIdx(cur)); };
      document.getElementById('nx').onclick = function () { jump(nextIdx(cur)); };
    }
    function render() {
      if (pagesOn()) {
        app.innerHTML = '<div class="card noprint" id="opts"></div><div id="pages" class="pages"></div><div id="songdock" class="songdock noprint"></div>' + dockHtml();
        var host = document.getElementById('pages');
        T.Pages.renderScene(host, src, items, { dirs: opt.dirs, cover: function (x) {
          if (mode !== 'run' || !x.mine || x.done) return '';
          var s = showFor(x); return s === 'hidden' ? '(your line)' : s === 'hint' ? esc(LineCheck.hint(x.it.text, 1)) : '';
        } }).then(function () { mark(); });
        host.addEventListener('click', function (e) { var h = e.target.closest('.hl'); if (h) jump(+h.dataset.i); });
        wireDock(); mark();
        return;
      }
      app.innerHTML = '<div class="card noprint" id="opts"></div><div class="script" id="script">' + items.map(function (x) {
        var it = x.it, c = x.chars[0] ? color(x.chars[0]) : 'var(--line)';
        if (it.type === 'dir') return opt.dirs ? '<div class="item dir" data-i="' + x.i + '">' + esc(it.text) + '</div>' : '';
        if (it.type === 'cue') return '';
        if (it.type === 'song') {
          var song = O().songs.find(function (s) { return s.num === it.num; });
          return '<div class="item song" data-i="' + x.i + '"><h3>' + sym('🎵') + 'Song: ' + esc(song ? song.title : it.title) + '</h3>' +
            '<div>' + it.singers.map(function (l) { var ids = labelChars(l); return ids.length === 1 && ids[0] !== '*' ? chip(ids[0]) : '<span class="chip">' + esc(whoName(l)) + '</span>'; }).join('') + '</div>' +
            (song ? '<p class="row noprint" style="margin-top:8px"><a class="btn small" href="#/song/' + song.id + '">' + icon('songs') + 'Open in My Songs</a></p>' : '') + '</div>';
        }
        return '<div class="item line' + (x.mine ? ' mine' : '') + '" data-i="' + x.i + '" style="--c:' + c + '"><div class="who">' + esc(whoName(it.who)) + '</div><div class="text">' + lineText(x) + '</div></div>';
      }).join('') + '</div>' + dockHtml();
      app.querySelectorAll('.item').forEach(function (el) { el.onclick = function (e) { if (e.target.closest('a')) return; jump(+el.dataset.i); }; });
      wireDock();
      mark();
    }
    function renderOpts() {
      var o = document.getElementById('opts');
      var sw = function (k, label) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-k="' + k + '"' + (opt[k] ? ' checked' : '') + '></label>'; };
      o.innerHTML = (T.Pages && T.Pages.ready() ? '<div class="row" style="margin-bottom:6px"><div class="seg" data-k="view"><button type="button" data-v="pages" aria-pressed="' + (opt.view === 'pages') + '">📄 Script pages</button><button type="button" data-v="lines" aria-pressed="' + (opt.view !== 'pages') + '">☰ Lines</button></div></div>' : '') +
        '<details' + (mode === 'run' ? '' : '') + '><summary class="btn quiet small" style="display:inline-flex">' + icon('gear') + 'Options</summary>' +
        sw('names', 'Say names before each line') + sw('dirs', 'Read stage directions') +
        (mode === 'run' ? '<div class="switch"><span>My line on the screen</span><div class="seg" data-k="show">' + [['auto', 'Fade'], ['line', 'Show'], ['hint', 'Hint'], ['hidden', 'Hide']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (opt.show === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div>' +
          sw('echo', 'Echo first (the app says it, then I say it)') + (T.canListen ? sw('didIt', 'Use an “I did it” button instead of the microphone') : '') : '') +
        '<div class="switch"><span>Speed</span><div class="seg" data-k="rate">' + [[0.7, 'Slow'], [1, 'Normal'], [1.25, 'Fast']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (+T.prefs.rate === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div></details>';
      o.querySelectorAll('input[data-k]').forEach(function (inp) { inp.onchange = function () { opt[inp.dataset.k] = inp.checked; ls('practice', { names: opt.names, dirs: opt.dirs, show: opt.show, echo: opt.echo, didIt: opt.didIt, view: opt.view }); var keep = cur; pause(); render(); cur = keep; mark(); document.querySelector('#opts details').open = true; }; });
      o.querySelectorAll('.seg button').forEach(function (b) {
        b.onclick = function () {
          var k = b.parentNode.dataset.k;
          if (k === 'rate') { T.prefs.rate = +b.dataset.v; T.savePrefs(); } else { opt[k] = b.dataset.v; ls('practice', { names: opt.names, dirs: opt.dirs, show: opt.show, echo: opt.echo, didIt: opt.didIt, view: opt.view }); }
          var keep = cur; pause(); render(); cur = keep; mark(); var dt = document.querySelector('#opts details'); if (dt && k !== 'view') dt.open = true;
        };
      });
    }
    function visible(i) { var x = items[i]; return x && x.it.type !== 'cue' && (x.it.type !== 'dir' || opt.dirs); }
    function nextIdx(i) { for (var j = i + 1; j < items.length; j++) if (visible(j)) return j; return items.length; }
    function prevIdx(i) { for (var j = i - 1; j >= 0; j--) if (visible(j)) return j; return 0; }
    function mark() {
      app.querySelectorAll('.item.now').forEach(function (e) { e.classList.remove('now'); });
      var els = app.querySelectorAll('.item[data-i="' + cur + '"]');
      els.forEach(function (e) { e.classList.add('now'); });
      if (els[0]) els[0].scrollIntoView({ block: 'center', behavior: T.prefs.motion ? 'smooth' : 'auto' });
    }
    function setPP() { var b = document.getElementById('pp'); if (b) { b.innerHTML = icon(playing ? 'pause' : 'play'); b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); } }
    function pause() { playing = false; gen++; Speech.stop(); if (listen.stop) listen.stop(); if (songStop) songStop(); closeTurn(); setPP(); }
    if (T.Voices) T.Voices.load();      // which lines have real voices
    function play() { if (cur >= items.length) cur = 0; if (!visible(cur)) cur = nextIdx(cur); if (items[cur] && items[cur].it.type === 'song' && !trackOf(items[cur].song)) cur = nextIdx(cur); playing = true; setPP(); step(++gen); }
    function jump(i) { var was = playing; pause(); cur = Math.max(0, Math.min(i, items.length - 1)); if (!visible(cur)) cur = nextIdx(cur); mark(); if (was) play(); }
    function advance(g) { if (g !== gen) return; cur = nextIdx(cur); mark(); if (cur >= items.length) { playing = false; setPP(); toast('That is the end of the scene!'); return; } step(g); }
    function step(g) {
      if (g !== gen) return;
      var x = items[cur]; if (!x) return;
      mark();
      var it = x.it;
      if (it.type === 'dir') return Speech.say(LineCheck.spoken(it.text) || it.text.replace(/[()]/g, ''), null).then(function () { advance(g); });
      if (it.type === 'song') { if (trackOf(x.song)) return playSong(x, g); playing = false; setPP(); toast('Song time! Open it in My Songs, or tap Next.', 3500); return; }
      if (mode === 'run' && x.mine) return myTurn(x, g);
      var text = LineCheck.spoken(it.text);
      var name = opt.names ? whoName(it.who) + '. ' : '';
      (name ? Speech.say(name, null) : Promise.resolve()).then(function () { return g === gen && (T.Voices ? T.Voices.say(it, x.chars[0], x.mine) : Speech.say(text, x.chars[0])); }).then(function () { advance(g); });
    }

    /* ---- a song inside the run: the track plays here, and its lines over the music come on cue ---- */
    function playSong(x, g) {
      var t = trackOf(x.song), kind = (ls('runSinger') !== false && t.rehearsal) || !t.performance ? 'rehearsal' : 'performance';
      var mel = T.show.melody && T.show.melody[x.song.id], off = (mel && mel.offset) || 0;
      var adj = kind === x.cueKind ? 0 : (x.cueKind === 'performance' ? -off : off);      // the guide track runs `offset` seconds behind the band track
      var el = document.getElementById('songdock') || app.querySelector('.item[data-i="' + x.i + '"]'), bar = document.createElement('div'); bar.className = 'row noprint songbar'; bar.style.marginTop = '10px';
      if (el) { var old = el.querySelector('.songbar'); if (old) old.remove(); el.appendChild(bar); }
      bar.innerHTML = '<span class="muted">Loading the track…</span>';
      var audio = new Audio(), url = null, timer = null, fired = 0, alive = true, lastCue = x.i;
      x.cues.forEach(function (c) { lastCue = Math.max(lastCue, c.y.i); });
      songStop = function () { alive = false; clearInterval(timer); audio.pause(); if (url) URL.revokeObjectURL(url); songStop = null; bar.remove(); };
      var finish = function () { if (!alive) return; songStop(); if (g !== gen) return; closeTurn(); cur = lastCue; advance(g); };
      Store.getTrack(T.key, x.song.id, kind, t[kind].ver).then(function (b) {
        if (!alive || g !== gen) return;
        url = URL.createObjectURL(new Blob([b])); audio.src = url;
        bar.innerHTML = '<b class="grow">' + sym('🎵') + '<span id="stime">0:00</span></b>' +
          (t.rehearsal && t.performance ? '<label class="switch" style="border:0;min-height:0"><span class="small">With the singers</span><input type="checkbox" id="ssing"' + (kind === 'rehearsal' ? ' checked' : '') + '></label>' : '') +
          '<button class="btn small" id="sskip">' + icon('skip') + 'Skip the song</button>';
        bar.querySelector('#sskip').onclick = function (e) { e.stopPropagation(); finish(); };
        var ss = bar.querySelector('#ssing'); if (ss) ss.onchange = function (e) { e.stopPropagation(); ls('runSinger', ss.checked); var at = audio.currentTime; songStop(); x.resumeAt = at; playSong(x, g); };
        bar.onclick = function (e) { e.stopPropagation(); };
        audio.onended = finish;
        audio.onloadedmetadata = function () { if (x.resumeAt) { try { audio.currentTime = x.resumeAt; } catch (e) {} x.resumeAt = 0; } };
        audio.play().catch(function () { toast('Tap Play to start the song.'); });
        timer = setInterval(function () {
          if (!alive) return;
          var now = audio.currentTime, tm = bar.querySelector('#stime'); if (tm) tm.textContent = T.clock(now) + ' / ' + T.clock(audio.duration || 0);
          while (fired < x.cues.length && now + adj >= x.cues[fired].t) cue(x.cues[fired++].y);
          if (pagesOn() && T.Follow && T.Follow.ready(x.song.id)) T.Follow.update(document.getElementById('pages'), x.song.id, kind === 'performance' ? now : now - off);      // the ball on the scene's own pages
        }, 100);
      }).catch(function () { bar.innerHTML = '<span class="err">The track would not load.</span>'; });
      function cue(y) {
        cur = y.i; mark();
        if (mode === 'run' && y.mine) return myTurn(y, g, true);
        audio.volume = 0.35;      // the music dips while the line is read
        (T.Voices ? T.Voices.say(y.it, y.chars[0], y.mine) : Speech.say(LineCheck.spoken(y.it.text), y.chars[0])).then(function () { audio.volume = 1; });
      }
    }

    /* ---- my turn ---- */
    var turnEl = null;
    function closeTurn() { if (turnEl) { turnEl.remove(); turnEl = null; } }
    function myTurn(x, g, overMusic) {      // overMusic: during a song; the music keeps going and the run does not wait
      var sh = showFor(x), helped = false, recorded = false;
      var rec = function (ok) { if (recorded || asChar || !T.Progress) return; recorded = true; T.Progress.line(scene.id, x.it, ok); };      // like flashcards: the first try counts
      hintLevel = sh === 'hint' ? 1 : 0;
      var c = color(myChars.find(function (id) { return x.chars.indexOf(id) >= 0; }) || myChars[0]);
      closeTurn();
      turnEl = document.createElement('div'); turnEl.className = 'turn'; turnEl.style.setProperty('--c', c);
      document.body.appendChild(turnEl);
      var spokenLine = LineCheck.spoken(x.it.text);
      function shown() {
        if (sh === 'line' || hintLevel >= 3) return esc(x.it.text);
        if (hintLevel === 0) return '<span class="muted">Your line! ' + (sh === 'hidden' ? 'Can you remember it?' : '') + '</span>';
        return '<span class="blank">' + esc(LineCheck.hint(x.it.text, hintLevel)) + '</span>';
      }
      function draw(fb, listening) {
        if (g !== gen || !turnEl) return;
        turnEl.innerHTML = '<div class="in"><div class="row"><b class="grow" style="font-family:var(--font-head)">' + sym('⭐') + 'Your turn!</b>' + chip(myChars.find(function (id) { return x.chars.indexOf(id) >= 0; }) || myChars[0]) + '</div>' +
          '<div class="say">' + shown() + '</div>' + (fb || '') +
          '<div class="row">' +
          (opt.didIt ? '<button class="btn primary" data-a="did">' + icon('check') + 'I got it</button><button class="btn" data-a="miss">✗ Not yet</button>'
            : '<button class="btn primary' + (listening ? ' mic' : '') + '" data-a="mic"' + (listening ? ' disabled' : '') + '>' + icon('mic') + (listening ? 'Listening…' : 'Say it') + '</button><button class="btn" data-a="did">' + icon('hand') + 'I did it</button>') +
          (sh !== 'line' && hintLevel < 3 ? '<button class="btn" data-a="hint">' + icon('bulb') + 'Hint</button>' : '') +
          (T.me.access.sayForMe !== false ? '<button class="btn" data-a="for">' + icon('speak') + 'Say it for me</button>' : '') +
          '<button class="btn quiet" data-a="skip">' + icon('skip') + 'Skip</button></div></div>';
        turnEl.querySelectorAll('button[data-a]').forEach(function (b) { b.onclick = function () { act(b.dataset.a); }; });
      }
      function done(msg) {
        x.done = true;
        var el = app.querySelector('.item[data-i="' + x.i + '"] .text'); if (el) el.innerHTML = esc(x.it.text);
        app.querySelectorAll('.hl.cover[data-i="' + x.i + '"]').forEach(function (c) { c.classList.remove('cover'); c.innerHTML = ''; });
        closeTurn(); if (msg) toast(msg, 1400);
        if (overMusic) return;
        setTimeout(function () { advance(g); }, msg ? 700 : 0);
      }
      function act(a) {
        if (g !== gen) return;
        if (a === 'did') { rec(!helped); fadeStep(x, helped ? 0 : 1); return done('Nice!'); }
        if (a === 'miss') { rec(false); helped = true; fadeStep(x, -1); hintLevel = 3; return draw('<div class="fb close">That is OK! Here is the line. Say it once more, then tap I got it.</div>'); }
        if (a === 'skip') return done();
        if (a === 'hint') { helped = true; hintLevel = Math.min(3, hintLevel + 1); return draw(); }
        if (a === 'for') { rec(false); fadeStep(x, -1); Speech.stop(); return (T.Voices ? T.Voices.say(x.it, x.chars[0] || myChars[0], true) : Speech.say(spokenLine, x.chars[0] || myChars[0])).then(function () { if (g === gen) done(); }); }
        if (a === 'mic') {
          Speech.stop();
          draw('', true);
          listen().then(function (alts) {
            if (g !== gen) return;
            var best = { verdict: 'silent', score: 0 };
            alts.forEach(function (h) { var r = LineCheck.check(x.it.text, h, { strictness: opt.strict, keyWords: x.it.keyWords }); if (r.score > best.score || best.verdict === 'silent') best = r; });
            if (best.verdict === 'pass') { rec(!helped); fadeStep(x, helped ? 0 : 1); chime(true); draw('<div class="fb pass">' + sym('🎉') + 'You got it!</div>'); setTimeout(function () { done(); }, 1100); return; }
            if (best.verdict === 'close') { rec(false); helped = true; hintLevel = Math.max(hintLevel, 1); return draw('<div class="fb close">So close! You missed: ' + esc(best.missing.join(', ') || 'a word') + (best.flipped ? ' (listen for “not”)' : '') + '</div>'); }
            if (best.verdict === 'silent') return draw('<div class="fb silent">I did not hear you. Tap Say it and try again.</div>');
            rec(false); helped = true; if (sh === 'hidden') fadeStep(x, -1);
            hintLevel = Math.min(3, hintLevel + 1);
            draw('<div class="fb miss">Not quite. Here is a hint. Try again!</div>');
          });
        }
      }
      draw();
      if (overMusic) { if (!opt.didIt) act('mic'); return; }
      if (opt.echo) {
        draw('<div class="fb close">' + sym('👂') + 'Listen, then say it after me.</div>');
        (T.Voices ? T.Voices.say(x.it, x.chars[0] || myChars[0], true) : Speech.say(spokenLine, x.chars[0] || myChars[0])).then(function () { if (g !== gen) return; draw(); if (!opt.didIt) act('mic'); });
      } else if (!opt.didIt) {
        Speech.say('Your line!', null, { rate: 1.1 }).then(function () { if (g === gen) act('mic'); });
      }
    }
    render();
    T.cleanup.push(function () { pause(); });
    var press = function (a) { var b = turnEl && turnEl.querySelector('[data-a="' + a + '"]'); if (b && !b.disabled) b.click(); };
    keys({ Space: function () { if (!turnEl) document.getElementById('pp').click(); }, ArrowRight: function () { document.getElementById('nx').click(); }, ArrowLeft: function () { document.getElementById('pv').click(); },
      Enter: function () { press('did'); }, x: function () { press('miss'); }, n: function () { press('miss'); }, h: function () { press('hint'); }, m: function () { press('mic'); }, s: function () { press('for'); } });
  }
  var actx = null;
  function audioCtx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
  T.audioCtx = audioCtx;
  function chime(good) {
    try {
      var ctx = audioCtx(), t = ctx.currentTime;
      (good ? [72, 76, 79] : [60]).forEach(function (m, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
        g.gain.setValueAtTime(0, t + i * .09); g.gain.linearRampToValueAtTime(.15, t + i * .09 + .02); g.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .5);
        o.connect(g); g.connect(ctx.destination); o.start(t + i * .09); o.stop(t + i * .09 + .55);
      });
    } catch (e) {}
  }

  /* ---------- My Schedule ---------- */
  function buildSchedule(chars, skip) {      // skip: moment ids cut from this version (the school-day show)
    var ms = O().moments.filter(function (m) { return !skip || skip.indexOf(m.id) < 0; }), out = [], prevCostume = null;
    var segCache = {};
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], scene = sceneById(m.scene);
      if (onStage(m, chars)) {
        var card = { on: true, moment: m, scene: scene, minutes: momentMinutes(m) };
        if (m.song) { var song = songById(m.song); card.song = song; card.sing = iSing(song, scene); }
        else {
          if (!(m.scene in segCache)) segCache[m.scene] = talkSegments(scene);
          var seg = segCache[m.scene] && segCache[m.scene][m.id];
          card.lines = seg ? seg.filter(function (it) { return it.type === 'line' && isMine(it.who, scene, chars); }).length : null;
        }
        card.costume = costumeFor(m.id, chars);
        if (card.costume && prevCostume && card.costume.id !== prevCostume.id && out.length && !out[out.length - 1].on) out[out.length - 1].change = card.costume;
        else if (card.costume && prevCostume && card.costume.id !== prevCostume.id) card.quickChange = card.costume;
        if (card.costume) prevCostume = card.costume;
        out.push(card);
      } else {
        var last = out[out.length - 1];
        if (last && !last.on) { last.minutes += momentMinutes(m); last.moments.push(m); }
        else out.push({ on: false, minutes: momentMinutes(m), moments: [m], scene: scene });
      }
    }
    // before my first entrance: "change into" my first costume
    var first = out.find(function (c) { return c.on; });
    if (out[0] && !out[0].on && first && first.costume) out[0].change = first.costume;
    // mic swaps (mic plot): "before" goes on my first step in that scene, "after" on my last step in that scene (or the nearest one)
    if (T.micSteps) T.micSteps(chars, T.me && T.me.id).forEach(function (x) {
      var idx = function (c) { return O().scenes.indexOf(c.scene); }, pick = null;
      if (x.when === 'before') pick = out.find(function (c) { return idx(c) >= x.i; }) || out[out.length - 1];
      else { for (var k = out.length - 1; k >= 0; k--) if (idx(out[k]) <= x.i) { pick = out[k]; break; } pick = pick || out[0]; }
      if (pick) (pick[x.when === 'before' ? 'micBefore' : 'micAfter'] = pick[x.when === 'before' ? 'micBefore' : 'micAfter'] || []).push(x);
    });
    return out;
  }
  T.buildSchedule = buildSchedule;
  function schedCard(c, n) {
    if (!c.on) {
      return '<div class="card off"><div class="head">' + sym('🚪') + '<div><div class="do">Off stage</div><div class="muted">' + mins(c.minutes) + '</div></div></div>' +
        (c.change ? '<div class="change">' + sym('👕') + 'Change into: ' + esc(c.change.name) + '</div>' : '') + micHtml(c) + '</div>';
    }
    var s = c.scene, what, place = c.moment.where && T.me.chars.map(function (id) { return c.moment.where[id]; }).filter(Boolean)[0];
    if (c.song) what = sym('🎵') + (c.sing ? 'Singing “' + esc(c.song.title) + '”' : (place ? 'In the song “' : 'On stage for the song “') + esc(c.song.title) + '”');
    else what = sym('🗣️') + (c.lines ? 'Acting · ' + c.lines + ' line' + (c.lines === 1 ? '' : 's') : 'Acting (no lines: listen and react)');
    return '<div class="card on" style="--c:' + color(T.me.chars[0]) + '"><div class="head">' + sym(SCENE_SYM[s.icon] || '🎬') + '<div class="grow"><div class="muted small">Step ' + n + ' · Scene ' + s.num + ' · ' + esc(s.place) + '</div><div class="do">' + what + '</div></div></div>' +
      (place ? '<p>' + sym('📍') + '<b>' + esc(place) + '</b></p>' : '') +
      (c.quickChange ? '<div class="change">' + sym('⚡') + 'Quick change first!</div>' : '') +
      (c.costume ? '<p>' + sym('👕') + 'Wearing: <b>' + esc(c.costume.name) + '</b></p>' : '') +
      micHtml(c) + '<p class="muted small">' + mins(c.minutes) + '</p></div>';
  }
  function micHtml(c) {
    return (c.micBefore || []).concat(c.micAfter || []).map(function (x) { return '<div class="change mic-step">' + sym(x.quick ? '⚡' : '🎙️') + (x.quick ? '<b>Quick mic swap!</b> ' : '') + esc(x.text) + '</div>'; }).join('');
  }
  function schedulePage() {
    setBar('My Schedule', '#/home');
    if (!T.me.chars.length) { app.innerHTML = '<div class="card"><p>' + sym('🎭') + 'Your schedule for the show appears here when your teacher gives you your role.</p><p><a class="btn primary" href="#/today">See what to do today</a></p></div>'; return; }
    var cut = T.schoolCut && T.schoolCut(), version = (cut && ls('schedVersion')) || 'evening';
    var list = buildSchedule(T.me.chars, version === 'school' ? cut : null);
    var view = ls('schedView') || 'steps', at = 0;
    var mineCut = cut ? O().moments.filter(function (m) { return cut.indexOf(m.id) >= 0 && onStage(m, T.me.chars); }) : [];
    function draw() {
      var h = '<div class="row noprint" style="margin-bottom:14px"><div class="seg">' +
        '<button data-v="steps" aria-pressed="' + (view === 'steps') + '">One step at a time</button><button data-v="list" aria-pressed="' + (view === 'list') + '">Whole show</button></div>' +
        (cut ? '<div class="seg" style="margin-left:8px"><button data-ver="evening" aria-pressed="' + (version === 'evening') + '">Evening show</button><button data-ver="school" aria-pressed="' + (version === 'school') + '">School-day show</button></div>' : '') +
        '<span class="grow"></span><button class="btn small" id="print">' + icon('print') + 'Print</button></div>';
      if (view === 'steps') {
        var a = list[at], b = list[at + 1];
        h += '<div class="firstthen"><div><div class="firstthen-lbl lbl">First</div>' + schedCard(a, at + 1) + '</div><div><div class="lbl">Then</div>' + (b ? schedCard(b, at + 2) : '<div class="card">' + sym('👏') + '<b>Bows! The show is over.</b></div>') + '</div></div>' +
          '<div class="row" style="justify-content:center;margin-top:16px"><button class="round" id="sp" aria-label="Back">' + icon('prev') + '</button><b>' + (at + 1) + ' of ' + list.length + '</b><button class="round" id="sn" aria-label="Next">' + icon('next') + '</button></div>';
      } else h += '<div class="sched">' + list.map(function (c, i) { return schedCard(c, i + 1); }).join('') + '</div>';
      app.innerHTML = '<h2 class="row">' + esc(T.me.name) + ' ' + T.me.chars.map(chip).join('') + '</h2>' + h;
      app.querySelectorAll('.seg button[data-v]').forEach(function (bt) { bt.onclick = function () { view = bt.dataset.v; ls('schedView', view); draw(); }; });
      app.querySelectorAll('.seg button[data-ver]').forEach(function (bt) { bt.onclick = function () { ls('schedVersion', bt.dataset.ver); schedulePage(); }; });
      if (version === 'school' && mineCut.length) app.insertAdjacentHTML('afterbegin', '<div class="card" style="background:var(--warn-bg)">' + sym('🏫') + '<b>In the school-day show, these are left out:</b> ' + mineCut.map(function (m) { return esc(m.song ? songById(m.song).title : 'Scene ' + sceneById(m.scene).num + ' (' + sceneById(m.scene).place + ')'); }).join(', ') + '. They are back in for the evening show.</div>');
      document.getElementById('print').onclick = function () { view = 'list'; draw(); setTimeout(function () { window.print(); }, 50); };
      var sp = document.getElementById('sp'), sn = document.getElementById('sn');
      if (sp) { sp.disabled = at === 0; sp.onclick = function () { at = Math.max(0, at - 1); draw(); }; sn.disabled = at >= list.length - 1; sn.onclick = function () { at = Math.min(list.length - 1, at + 1); draw(); }; }
      app.querySelectorAll('.lbl').forEach(function (l) { l.style.cssText = 'font:700 .8em Lexend,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px'; });
    }
    draw();
  }

  /* ---------- My Songs ---------- */
  function mySongs() {
    return O().songs.map(function (song) {
      var m = songMoment(song), scene = sceneById(song.scene);
      return { song: song, scene: scene, on: m ? onStage(m, T.me.chars) : false, sing: iSing(song, scene) };
    });
  }
  function songsPage() {
    setBar('My Songs', '#/home');
    var list = mySongs(), mine = list.filter(function (x) { return x.on || x.sing; }), rest = list.filter(function (x) { return !(x.on || x.sing); });
    var row = function (x) {
      var t = T.show.tracks && T.show.tracks[x.song.id];
      return '<a class="tile" style="min-height:110px;align-items:flex-start;text-align:left" href="#/song/' + x.song.id + '"><b>' + sym('🎵') + esc(x.song.title) + '</b>' +
        '<span>Scene ' + x.scene.num + ' · ' + (x.sing ? '<span class="tag">You sing</span>' : x.on ? 'You are on stage' : 'Not in this one') + (t && (t.performance || t.rehearsal) ? '' : ' · no track yet') + '</span></a>';
    };
    app.innerHTML = '<div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">My songs</h2><a class="btn primary" href="#/listen">' + icon('play') + 'Play the whole show</a></div><div class="grid">' + (mine.map(row).join('') || '<p>No songs for you. Enjoy the show!</p>') + '</div>' +
      (rest.length ? '<details style="margin-top:20px"><summary class="btn quiet">The other songs</summary><div class="grid" style="margin-top:12px">' + rest.map(row).join('') + '</div></details>' : '');
  }
  function songPage(args) {
    var song = songById(args[0]); if (!song) return songsPage();
    var scene = sceneById(song.scene);
    setBar(song.title, '#/songs');
    var trk = (T.show.tracks && T.show.tracks[song.id]) || {}, mel = T.show.melody && T.show.melody[song.id];
    var s = scriptScene(scene), item = s && s.items.find(function (it) { return it.type === 'song' && it.num === song.num; });
    var st = Object.assign({ guide: true, melody: false, vol: 0.9, follow: true }, ls('songOpts') || {});
    if (T.RedX && T.RedX.forMe() && st.redx === undefined) st.redx = true;      // the teacher turned the red X on for this student
    var canFollow = T.Follow && T.Follow.ready(song.id);      // the sung line lit up (needs the lyrics timing)
    var canSheet = T.Follow && T.Follow.canShow(song.id);      // the song's real sheet music pages (need only the script PDF)
    var lyr = item && item.lyrics.length ? item.lyrics.map(function (l) {
      var mine = l.who && isMine(l.who, scene, null, songMoment(song));
      return '<div class="lyric' + (mine ? ' mine' : '') + (l.spoken ? ' spoken' : '') + '">' + (l.who ? '<span class="who">' + esc(l.who) + (l.spoken ? ' 🗣' : '') + '</span>' : '') + esc(l.text) + '</div>';
    }).join('') : '<p class="muted">' + (T.show.script ? 'No lyrics for this song in the script.' : 'Lyrics appear after your teacher adds the script.') + '</p>';
    var piano = T.show.sheetMelody && T.show.sheetMelody[song.id];      // the singer's notes read from the sheet music, played as a piano
    var has = { perf: !!trk.performance, guide: !!trk.rehearsal, mel: !!((piano && piano.notes.length) || (mel && mel.notes && mel.notes.length)) };
    app.innerHTML = '<h2>' + sym('🎵') + esc(song.title) + '</h2><p class="muted">Scene ' + scene.num + ' · ' + esc(scene.place) + '</p>' +
      '<div class="card player" id="pl">' + (has.perf || has.guide ? '<p id="ld">Loading the track…</p>' : '<p>Your teacher has not added the track for this song yet.</p>') + '</div>' +
      (canSheet ? '<div class="row noprint" style="margin:0 0 8px;flex-wrap:wrap"><label class="switch" style="flex:1"><span>' + sym('🎼') + 'Sheet music' + (canFollow ? ', the sung line lit up' : '') + '</span><input type="checkbox" id="showsheet"' + (st.follow ? ' checked' : '') + '></label>' +
        (canFollow && T.me && T.me.chars && T.me.chars.length ? '<label class="switch" style="flex:1"><span>' + sym('⭐') + 'Only my lines light up</span><input type="checkbox" id="mineonly"' + (st.mineOnly ? ' checked' : '') + '></label>' : '') + '</div>' +
        '<div id="follow" class="pages" style="margin-bottom:14px"' + (st.follow ? '' : ' hidden') + '></div>' +
        (canFollow ? '' : '<p class="muted small">' + sym('⚪') + 'The sung line lights up once your teacher finds this song’s lyrics timing.</p>') :
        item && item.lyrics.length ? '<p class="muted small">' + sym('🎼') + 'The real sheet music shows here once your teacher imports the script PDF.</p>' : '') +
      '<div class="card"><h3>Lyrics</h3><div class="lyrics">' + lyr + '</div><p class="muted small">' + esc(O().licenseNote || '') + '</p></div>' + (T.videoCard ? T.videoCard(song.id) : '');
    // the sheet music shows right away, with or without a track
    var fh0 = document.getElementById('follow'), ss = document.getElementById('showsheet'), mo1 = document.getElementById('mineonly');
    if (fh0) fh0.dataset.mine = st.mineOnly ? '1' : '0';
    if (mo1) mo1.onchange = function () { st.mineOnly = mo1.checked; ls('songOpts', st); fh0.dataset.mine = st.mineOnly ? '1' : '0'; fh0._at = null; };
    if (fh0 && st.follow) T.Follow.mount(fh0, song.id);
    if (ss) ss.onchange = function () { st.follow = ss.checked; ls('songOpts', st); fh0.hidden = !st.follow; if (st.follow) T.Follow.mount(fh0, song.id); };
    if (!(has.perf || has.guide)) return;
    var P = { buf: {}, playing: false, pos: 0, t0: 0, nodes: [], loopA: null, loopB: null, offset: (mel && mel.offset) || 0 };
    var ctx = audioCtx();
    var load = function (kind) {
      return trk[kind] ? Store.getTrack(T.key, song.id, kind, trk[kind].ver).then(function (b) { return b && ctx.decodeAudioData(b.slice ? b.slice(0) : b); }).catch(function (e) { console.warn(e); return null; }) : Promise.resolve(null);
    };
    Promise.all([load('performance'), load('rehearsal')]).then(function (r) {
      P.buf.perf = r[0]; P.buf.guide = r[1];
      if (!P.buf.perf && !P.buf.guide) { document.getElementById('pl').innerHTML = '<p class="err">The track would not load. Check the Wi-Fi and try again.</p>'; return; }
      if (!P.buf.perf) st.guide = true;
      if (!P.buf.guide) st.guide = false;
      ui();
    });
    var dur = function () { return (P.buf.perf || P.buf.guide).duration; };
    var now = function () { return P.playing ? P.pos + (ctx.currentTime - P.t0) : P.pos; };
    /* the piano's parts (Colleen 2026-10-24: "isolate and assign different lines to different actors in songs where harmonies exist"): each
       note knows its staff in the bracket (p, 0 = top) and who sings it (w). My part: the student's own notes clear, the others soft. */
    var pianoParts = piano && piano.notes ? piano.notes.reduce(function (m, n) { return Math.max(m, (n.p || 0) + 1); }, 1) : 1;
    var songScene = T.sceneById(song.scene), songItemNum = song.num;
    function noteMine(n) { if (!T.me || !T.me.chars || !T.me.chars.length || !n.w) return false; var mo = T.songMomentFor ? T.songMomentFor(songScene, songItemNum) : null; return T.isMine(n.w, songScene, T.me.chars, mo); }
    function pianoPlay(at) {
      var mode = st.piano || 'mine', ns = piano.notes, parts = [];
      if (mode === 'mine' && ns.some(noteMine)) { parts.push([ns.filter(noteMine), 0.34]); parts.push([ns.filter(function (n) { return !noteMine(n); }), 0.07]); }
      else if (mode === 'all') parts.push([ns, 0.22]);
      else parts.push([ns.filter(function (n) { return !n.p; }), 0.3]);      // the melody: the top part
      var runs = parts.map(function (x) { return SheetMelody.schedule(ctx, P.master, x[0], P.t0, at, { volume: x[1] }); });
      return { stop: function () { runs.forEach(function (r) { r.stop(); }); } };
    }
    function stopNodes() { P.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); P.nodes = []; if (P.mel) { P.mel.stop(); P.mel = null; } }
    function start(at) {
      stopNodes();
      at = Math.max(0, Math.min(at, dur() - 0.05));
      P.pos = at; P.t0 = ctx.currentTime + 0.05; P.playing = true; if (T.Progress) T.Progress.playing = true;
      P.gp = ctx.createGain(); P.gg = ctx.createGain(); P.master = ctx.createGain(); P.master.gain.value = st.vol;
      P.gp.connect(P.master); P.gg.connect(P.master); P.master.connect(ctx.destination);
      P.gp.gain.value = st.guide && P.buf.guide ? 0 : 1; P.gg.gain.value = st.guide ? 1 : 0;
      if (P.buf.perf) { var a = ctx.createBufferSource(); a.buffer = P.buf.perf; a.connect(P.gp); a.start(P.t0, at); P.nodes.push(a); }
      if (P.buf.guide) { var g = ctx.createBufferSource(); g.buffer = P.buf.guide; g.connect(P.gg); var gat = P.buf.perf ? at + P.offset : at; if (gat >= 0) g.start(P.t0, gat); else g.start(P.t0 - gat, 0); P.nodes.push(g); }
      if (st.melody && has.mel) P.mel = piano && piano.notes.length ? pianoPlay(at) : Melody.schedule(ctx, P.master, mel.notes, P.t0, at, { volume: 0.22 });
      tick(); drawBtns();
    }
    function pause() { if (!P.playing) return; P.pos = now(); P.playing = false; if (T.Progress) T.Progress.playing = false; stopNodes(); drawBtns(); if (T.RedX) T.RedX.hide(); }
    function tick() {
      cancelAnimationFrame(P.raf);
      var f = function () {
        var t = now();
        if (P.playing && P.loopB != null && t >= P.loopB) { start(P.loopA || 0); return; }
        if (P.playing && t >= dur()) { pause(); P.pos = 0; if (!P.asked && T.askSongRating) { P.asked = true; T.askSongRating(song.id); } }
        if (P.playing) P.most = Math.max(P.most || 0, t / dur());
        var r = document.getElementById('pos'); if (r && !r.dragging) r.value = t;
        var fh = document.getElementById('follow'); if (fh && st.follow) T.Follow.update(fh, song.id, t);
        if (T.RedX && T.me && T.me.chars) T.RedX.show(st.redx && P.playing ? T.RedX.state(song.id, t, T.me.chars) : '');
        var tm = document.getElementById('tm'); if (tm) tm.textContent = clock(t) + ' / ' + clock(dur());
        if (P.playing) P.raf = requestAnimationFrame(f);
      };
      f();
    }
    function drawBtns() { var b = document.getElementById('spp'); if (b) { b.innerHTML = icon(P.playing ? 'pause' : 'play'); b.setAttribute('aria-label', P.playing ? 'Pause' : 'Play'); } }
    function ui() {
      var sw = function (k, label, ok, note) { return '<label class="switch"><span>' + label + (ok ? '' : ' <span class="muted small">(' + note + ')</span>') + '</span><input type="checkbox" data-k="' + k + '"' + (st[k] && ok ? ' checked' : '') + (ok ? '' : ' disabled') + '></label>'; };
      /* Colleen: "very difficult to stop the song while watching… because of the automatic page scrolling and the music controls being at the
         top": play, back and where-in-the-song sit in a bar fixed to the bottom of the screen */
      var dk = document.getElementById('songbar'); if (!dk) { dk = document.createElement('div'); dk.id = 'songbar'; dk.className = 'dock song-dock'; app.appendChild(dk); app.insertAdjacentHTML('beforeend', '<div class="song-dock-space"></div>'); }
      dk.innerHTML = '<div class="in"><button class="round" id="sb" aria-label="Back 10 seconds">' + icon('back10') + '</button><button class="round big" id="spp" aria-label="Play">' + icon('play') + '</button>' +
        '<input type="range" id="pos" min="0" max="' + dur().toFixed(2) + '" step="0.1" value="0" aria-label="Where in the song"><span class="time" id="tm"></span></div>';
      document.getElementById('pl').innerHTML = keyHint('Space: play or pause · ←: back 10 seconds') +
        sw('guide', 'Guide vocals (hear the singers)', !!(P.buf.guide && P.buf.perf), P.buf.guide ? 'only the guide track is here' : 'no guide track yet') +
        (T.RedX && T.me && T.me.chars && T.me.chars.length ? sw('redx', '❌ Red X when it is not my turn to sing', T.RedX.ready(song.id), 'needs the lyrics timing') : '') +
        sw('melody', piano && piano.notes.length ? 'Piano melody (the singer’s notes from the sheet music)' : 'Melody line (a soft tone with the tune)', has.mel, 'not made yet') +
        (piano && piano.notes.length && (pianoParts > 1 || piano.notes.some(function (n) { return n.w; })) ? '<div class="switch"><span>Piano plays</span><div class="seg" id="pianoseg">' + [['mine', 'My part'], ['all', 'All parts'], ['top', 'Melody only']].map(function (o) { return '<button type="button" data-pm="' + o[0] + '" aria-pressed="' + ((st.piano || 'mine') === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' : '') +
        '<label class="switch"><span>Volume</span><input type="range" id="vol" min="0" max="1" step="0.05" value="' + st.vol + '" style="max-width:240px"></label>' +
        '<div class="row" style="margin-top:10px">' + icon('loop') + '<button class="btn small" id="la">Loop from here</button><button class="btn small" id="lb">to here</button><button class="btn small quiet" id="lc">No loop</button><span class="muted small" id="lt"></span></div>';
      document.getElementById('spp').onclick = function () { P.playing ? pause() : start(P.pos); };
      document.getElementById('sb').onclick = function () { var t = Math.max(0, now() - 10); if (P.playing) start(t); else { P.pos = t; tick(); } };
      var pos = document.getElementById('pos');
      pos.oninput = function () { pos.dragging = true; document.getElementById('tm').textContent = clock(+pos.value) + ' / ' + clock(dur()); };
      pos.onchange = function () { pos.dragging = false; if (P.playing) start(+pos.value); else { P.pos = +pos.value; tick(); } };
      app.querySelectorAll('[data-pm]').forEach(function (b) { b.onclick = function () { st.piano = b.dataset.pm; ls('songOpts', st); app.querySelectorAll('[data-pm]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); if (P.playing && st.melody) start(now()); }; });
      document.getElementById('vol').oninput = function (e) { st.vol = +e.target.value; if (P.master) P.master.gain.value = st.vol; ls('songOpts', st); };
      app.querySelectorAll('#pl input[data-k]').forEach(function (inp) {
        inp.onchange = function () {
          st[inp.dataset.k] = inp.checked; ls('songOpts', st);
          if (inp.dataset.k === 'guide' && P.playing) { var t = ctx.currentTime; P.gp.gain.setTargetAtTime(st.guide ? 0 : 1, t, 0.05); P.gg.gain.setTargetAtTime(st.guide ? 1 : 0, t, 0.05); }
          if (inp.dataset.k === 'melody' && P.playing) start(now());
          if (inp.dataset.k === 'redx' && !st.redx && T.RedX) T.RedX.hide();
          if (inp.dataset.k === 'follow') { var fh = document.getElementById('follow'); if (fh) { fh.hidden = !st.follow; if (st.follow) T.Follow.mount(fh, song.id); } }
        };
      });
      var lt = function () { document.getElementById('lt').textContent = P.loopB != null ? 'Looping ' + clock(P.loopA || 0) + ' to ' + clock(P.loopB) : P.loopA != null ? 'Loop starts at ' + clock(P.loopA) : ''; };
      document.getElementById('la').onclick = function () { P.loopA = now(); if (P.loopB != null && P.loopB <= P.loopA) P.loopB = null; lt(); };
      document.getElementById('lb').onclick = function () { var t = now(); if (t > (P.loopA || 0) + 1) { P.loopB = t; lt(); if (P.playing) start(P.loopA || 0); } };
      document.getElementById('lc').onclick = function () { P.loopA = P.loopB = null; lt(); };
      tick();
    }
    keys({ Space: function () { var b = document.getElementById('spp'); if (b) b.click(); }, ArrowLeft: function () { var b = document.getElementById('sb'); if (b) b.click(); } });
    T.cleanup.push(function () { pause(); cancelAnimationFrame(P.raf); if (T.RedX) T.RedX.hide(); if (!P.asked && (P.most || 0) > 0.6 && T.askSongRating) T.askSongRating(song.id); });
  }

  /* ---------- Listen to the whole show ----------
     Every song in show order, again and again, with the singers (rehearsal tracks) or band only. Hearing the show many times makes it familiar and
     predictable (and gives students who learn language in whole phrases, such as many with echolalia, the exact phrases to learn).
     An <audio> element, so it keeps playing with the iPad's screen off. */
  function listenPage() {
    setBar('Play the whole show', '#/songs');
    var tr = T.show.tracks || {}, st = Object.assign({ singers: true, repeat: true }, ls('listenOpts') || {});
    var list = O().songs.filter(function (s) { var t = tr[s.id]; return t && (t.rehearsal || t.performance); });
    if (!list.length) { app.innerHTML = '<div class="card"><p>Your teacher has not added the tracks yet.</p></div>'; return; }
    var at = 0, url = null, audio = new Audio(), alive = true;
    audio.preload = 'auto';
    function kindFor(s) { var t = tr[s.id]; return st.singers ? (t.rehearsal ? 'rehearsal' : 'performance') : (t.performance ? 'performance' : 'rehearsal'); }
    function lyricsFor(s) {
      var scene = sceneById(s.scene), src = scene && scriptScene(scene), item = src && src.items.find(function (it) { return it.type === 'song' && it.num === s.num; });
      return item && item.lyrics.length ? item.lyrics.map(function (l) { var mine = l.who && isMine(l.who, scene, null, songMoment(s)); return '<div class="lyric' + (mine ? ' mine' : '') + '">' + esc(l.text) + '</div>'; }).join('') : '<p class="muted">No lyrics yet.</p>';
    }
    function load(i, autoplay) {
      at = (i + list.length) % list.length; draw();
      var s = list[at], k = kindFor(s);
      Store.getTrack(T.key, s.id, k, tr[s.id][k].ver).then(function (b) {
        if (!alive || list[at] !== s) return;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' }));
        audio.src = url; if (autoplay) audio.play().catch(function () {});
      }).catch(function () { toast('That track would not load.'); });
    }
    audio.onended = function () { if (at < list.length - 1 || st.repeat) load(at + 1, true); };
    audio.onplay = audio.onpause = function () { if (T.Progress) T.Progress.playing = !audio.paused; var b = document.getElementById('lp'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); } };
    function draw() {
      var s = list[at], scene = sceneById(s.scene);
      app.innerHTML = '<div class="card center"><p class="muted">Song ' + (at + 1) + ' of ' + list.length + ' · Scene ' + scene.num + '</p><h2>' + sym('🎵') + esc(s.title) + '</h2>' +
        '<div class="row" style="justify-content:center"><button class="round" id="lb" aria-label="Last song">' + icon('prev') + '</button><button class="round big" id="lp" aria-label="Play">' + icon(audio.paused ? 'play' : 'pause') + '</button><button class="round" id="ln" aria-label="Next song">' + icon('next') + '</button></div>' +
        '<label class="switch"><span>With the singers</span><input type="checkbox" data-k="singers"' + (st.singers ? ' checked' : '') + '></label>' +
        '<label class="switch"><span>Start again after the last song</span><input type="checkbox" data-k="repeat"' + (st.repeat ? ' checked' : '') + '></label></div>' +
        '<div class="card"><div class="lyrics">' + lyricsFor(s) + '</div></div>' +
        '<div class="card"><h3>All the songs</h3>' + list.map(function (x, i) { return '<button class="btn quiet small" style="display:flex;width:100%;justify-content:flex-start' + (i === at ? ';background:var(--hi)' : '') + '" data-i="' + i + '">' + (i + 1) + '. ' + esc(x.title) + '</button>'; }).join('') + '</div>';
      document.getElementById('lp').onclick = function () { if (!audio.src) return load(at, true); if (audio.paused) audio.play(); else audio.pause(); };
      document.getElementById('lb').onclick = function () { load(at - 1, !audio.paused || !audio.src); };
      document.getElementById('ln').onclick = function () { load(at + 1, !audio.paused || !audio.src); };
      app.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { load(+b.dataset.i, true); }; });
      app.querySelectorAll('input[data-k]').forEach(function (c) { c.onchange = function () { st[c.dataset.k] = c.checked; ls('listenOpts', st); if (c.dataset.k === 'singers') { var t = audio.currentTime, playing = !audio.paused; load(at, playing); audio.addEventListener('loadedmetadata', function f() { audio.removeEventListener('loadedmetadata', f); try { audio.currentTime = t; } catch (e) {} }); } }; });
    }
    draw();
    keys({ Space: function () { document.getElementById('lp').click(); }, ArrowRight: function () { document.getElementById('ln').click(); }, ArrowLeft: function () { document.getElementById('lb').click(); } });
    T.cleanup.push(function () { alive = false; audio.pause(); if (url) URL.revokeObjectURL(url); });
  }

  /* ---------- My Costumes ---------- */
  function costumesPage() {
    setBar('My Costumes', '#/home');
    var list = (O().costumes || []).filter(function (c) { return T.me.chars.indexOf(c.who) >= 0; });
    var order = O().moments.map(function (m) { return m.id; });
    list.sort(function (a, b) { return Math.min.apply(null, a.moments.map(function (m) { return order.indexOf(m); })) - Math.min.apply(null, b.moments.map(function (m) { return order.indexOf(m); })); });
    if (!list.length) { app.innerHTML = '<div class="card"><p>No costumes listed for you yet. Ask your teacher.</p></div>'; return; }
    app.innerHTML = '<h2>' + sym('👕') + 'My costumes</h2><div class="grid">' + list.map(function (c) {
      var got = ls('check:' + c.id) || [];
      var scenes = []; c.moments.forEach(function (mid) { var m = O().moments.find(function (x) { return x.id === mid; }); if (m) { var s = sceneById(m.scene); if (scenes.indexOf(s.num) < 0) scenes.push(s.num); } });
      scenes.sort(function (a, b) { return a - b; });
      return '<div class="card" style="border-top:8px solid ' + color(c.who) + '">' + (c.photo ? '<img src="' + esc(c.photo) + '" alt="" style="width:100%;border-radius:12px;margin-bottom:8px">' : '') +
        '<h3>' + esc(c.name) + '</h3>' + chip(c.who) + (T.photoSlot ? T.photoSlot('costume', c.id) : '') +
        '<div style="margin-top:8px">' + c.items.map(function (it, i) { return '<label class="switch"><span>' + esc(it) + '</span><input type="checkbox" data-c="' + esc(c.id) + '" data-i="' + i + '"' + (got.indexOf(i) >= 0 ? ' checked' : '') + '></label>'; }).join('') + '</div>' +
        '<p class="muted small">Wear it in scene' + (scenes.length === 1 ? ' ' : 's ') + scenes.join(', ') + '</p></div>';
    }).join('') + '</div>';
    if (T.photoSlot) app.insertAdjacentHTML('beforeend', T.me.chars.map(function (c) { return T.photoSlot('research', c, 'Costume research pictures for ' + T.charById(c).short); }).join(''));
    if (T.fillPhotos) T.fillPhotos(app);
    app.querySelectorAll('input[data-c]').forEach(function (inp) {
      inp.onchange = function () { var k = 'check:' + inp.dataset.c, got = ls(k) || [], i = +inp.dataset.i; got = got.filter(function (x) { return x !== i; }); if (inp.checked) got.push(i); ls(k, got); };
    });
  }

  /* ---------- The Story ---------- */
  function storyPage() {
    setBar('The Story', '#/home');
    var who = function (s) { return O().characters.map(function (c) { return c.id; }).filter(function (id) { return O().moments.some(function (m) { return m.scene === s.id && onFor(m, id); }); }); };
    app.innerHTML = '<h2>' + sym('📖') + esc(O().title) + '</h2><div class="row noprint" style="margin-bottom:12px"><button class="btn" id="readall">' + icon('speak') + 'Read it all to me</button><a class="btn quiet" href="#who-is-who">Who is who</a></div>' +
      O().scenes.map(function (s) {
        var ids = who(s), mine = ids.filter(function (id) { return T.me.chars.indexOf(id) >= 0; });
        return '<div class="card" data-s="' + s.id + '"' + (mine.length ? ' style="border-left:10px solid ' + color(mine[0]) + '"' : '') + '><div class="row"><h3 class="grow">' + sym(SCENE_SYM[s.icon] || '🎬') + 'Scene ' + s.num + ': ' + esc(s.place) + '</h3><button class="btn small noprint" data-read="' + s.id + '">' + icon('speak') + 'Read</button></div>' +
          '<p class="muted small">' + esc(s.when) + (mine.length ? ' · <span class="tag">You are in this scene</span>' : '') + '</p><p>' + esc(s.story) + '</p>' +
          (s.sensory && s.sensory.length ? '<p class="small"><b>' + sym('⚠️') + 'Heads up:</b> ' + s.sensory.map(esc).join(' · ') + '</p>' : '') +
          '<div>' + ids.map(chip).join('') + '</div></div>';
      }).join('') +
      '<h2 id="who-is-who" style="margin-top:28px">Who is who</h2><div class="grid">' + O().characters.map(function (c) {
        return '<div class="card"' + (T.me.chars.indexOf(c.id) >= 0 ? ' style="border:3px solid ' + color(c.id) + '"' : '') + '>' + chip(c.id) + '<p>' + esc(c.desc) + '</p></div>';
      }).join('') + '</div>';
    var reading = 0;
    var text = function (s) { return 'Scene ' + s.num + '. ' + s.place + '. ' + s.story + (s.sensory && s.sensory.length ? ' Heads up: ' + s.sensory.join('. ') + '.' : ''); };
    app.querySelectorAll('[data-read]').forEach(function (b) { b.onclick = function () { var r = ++reading; Speech.stop(); var s = sceneById(b.dataset.read); if (r === reading) Speech.say(text(s)); }; });
    document.getElementById('readall').onclick = function () {
      var r = ++reading; Speech.stop();
      var i = 0, next = function () {
        if (r !== reading || i >= O().scenes.length) return;
        var s = O().scenes[i++], el = app.querySelector('[data-s="' + s.id + '"]');
        if (el) el.scrollIntoView({ block: 'center', behavior: T.prefs.motion ? 'smooth' : 'auto' });
        Speech.say(text(s)).then(next);
      };
      next();
    };
    T.cleanup.push(function () { reading++; });
  }

  /* ---------- Settings ---------- */
  function settingsPage() {
    setBar('Settings', T.me ? '#/home' : '#/');
    var p = T.prefs;
    var seg = function (k, opts) { return '<div class="seg" data-k="' + k + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (String(p[k]) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    app.innerHTML = '<h2>' + icon('gear') + ' Settings</h2><div class="card">' +
      '<div class="switch"><span>Text size</span>' + seg('size', [[1, 'A'], [1.2, 'A+'], [1.4, 'A++'], [1.7, 'A+++']]) + '</div>' +
      '<div class="switch"><span>Colors</span>' + seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]) + '</div>' +
      '<div class="switch" style="flex-wrap:wrap"><span>Reading font</span><div class="seg" data-k="font">' + [['atkinson', 'Atkinson', "'Atkinson Hyperlegible'"], ['lexend', 'Lexend', "'Lexend'"], ['andika', 'Andika', "'Andika'"], ['comic', 'Comic Neue', "'Comic Neue'"], ['system', 'Plain', 'system-ui']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (p.font === o[0]) + '" style="font-family:' + o[2] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="switch"><span>Space between letters</span>' + seg('spacing', [['normal', 'Normal'], ['wide', 'Wide']]) + '</div>' +
      '<div class="switch"><span>Space between lines</span>' + seg('lines', [['normal', 'Normal'], ['tall', 'Tall']]) + '</div>' +
      '<div class="switch" style="flex-wrap:wrap"><span>Main color</span><div class="row">' + [['', 'Standard', (showTheme() && showTheme().color) || '#6b3fd4']].concat(Object.keys(ACCENTS).map(function (k) { return [k, k, ACCENTS[k]]; })).map(function (o) { return '<button type="button" class="swatch" data-accent="' + o[0] + '" aria-pressed="' + ((p.accent || '') === o[0]) + '" aria-label="' + o[1] + '" title="' + o[1] + '" style="--sw:' + o[2] + '"></button>'; }).join('') + '</div></div>' +
      '<div class="switch" style="flex-wrap:wrap"><span>Page color <span class="muted small">(light mode)</span></span><div class="row">' + [['', 'White', '#f7f4ee']].concat(Object.keys(TINTS).map(function (k) { return [k, k, TINTS[k]]; })).map(function (o) { return '<button type="button" class="swatch" data-tint="' + o[0] + '" aria-pressed="' + ((p.tint || '') === o[0]) + '" aria-label="' + o[1] + '" title="' + o[1] + '" style="--sw:' + o[2] + '"></button>'; }).join('') + '</div></div>' +
      '<label class="switch"><span>High contrast</span><input type="checkbox" data-b="contrast"' + (p.contrast ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Picture symbols</span><input type="checkbox" data-b="symbols"' + (p.symbols ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Movement and animation</span><input type="checkbox" data-b="motion"' + (p.motion ? ' checked' : '') + '></label>' +
      '<div class="switch"><span>Read-aloud speed</span>' + seg('rate', [[0.7, 'Slow'], [1, 'Normal'], [1.25, 'Fast']]) + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn small" id="test">' + icon('speak') + 'Test the voice</button></div></div>' +
      (T.me ? '<div class="card"><h3>' + sym('🗣️') + 'My voice</h3><p class="muted small">Pick the voice that says <b>your</b> lines when the app reads the scene, so you learn to listen for it. No other character will use it.</p><div class="row">' +
        Speech.all.slice(0, 14).map(function (v) { return '<button type="button" class="btn small" data-myvoice="' + esc(v.name) + '" aria-pressed="' + (Speech.mineVoice === v) + '">' + esc(v.name.replace(/\s*\(.*\)$/, '')) + '</button>'; }).join('') +
        (Speech.mineVoice ? '<button type="button" class="btn small quiet" data-myvoice="">No special voice</button>' : '') + '</div></div>' : '') +
      '<div class="card"><h3>Story voice</h3><p class="muted small">Tap a voice to hear it and use it. It reads the story and the stage directions; the other characters share the best few voices.</p><div class="row">' +
      Speech.all.slice(0, 14).map(function (v) { return '<button type="button" class="btn small" data-voice="' + esc(v.name) + '" aria-pressed="' + (Speech.voices[0] === v) + '">' + esc(v.name.replace(/\s*\(.*\)$/, '')) + '</button>'; }).join('') + '</div>' +
      '<label class="switch"><span>Same voice for every character</span><input type="checkbox" data-b="oneVoice"' + (p.oneVoice ? ' checked' : '') + '></label>' +
      '<details><summary class="btn quiet small">Get better voices (free)</summary><p class="small"><b>iPad:</b> Settings › Accessibility › Spoken Content › Voices › English. Download voices marked <b>Enhanced</b> or <b>Premium</b> (for example Ava, Zoe, Evan, Nathan). Then come back here and pick one.</p>' +
      '<p class="small"><b>Mac:</b> System Settings › Accessibility › Spoken Content › System voice › Manage Voices. Safari shows the new voices; some other browsers do not.</p></details></div>' +
      (T.me ? '<div class="card"><div class="row">' + face(T.me, 56) + '<div class="grow"><b>' + esc(T.me.name) + '</b><br>' + T.me.chars.map(chip).join('') + '</div><a class="btn" href="#/who">Change</a></div></div>' : '') +
      '<div class="card"><div class="row"><a class="btn" href="#/teacher">Teacher mode</a><span class="grow"></span><button class="btn quiet" id="forget">' + icon('lock') + 'Lock this iPad</button></div></div>';
    app.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { var k = b.parentNode.dataset.k; p[k] = ['size', 'rate'].indexOf(k) >= 0 ? +b.dataset.v : b.dataset.v; T.savePrefs(); settingsPage(); }; });
    app.querySelectorAll('[data-accent]').forEach(function (b) { b.onclick = function () { p.accent = b.dataset.accent; T.savePrefs(); settingsPage(); }; });
    app.querySelectorAll('[data-tint]').forEach(function (b) { b.onclick = function () { p.tint = b.dataset.tint; T.savePrefs(); settingsPage(); }; });
    app.querySelectorAll('input[data-b]').forEach(function (inp) { inp.onchange = function () { p[inp.dataset.b] = inp.checked; T.savePrefs(); if (inp.dataset.b === 'oneVoice') Speech.load(); }; });
    document.getElementById('test').onclick = function () { Speech.stop(); Speech.say('Break a leg! This is how fast I will read.'); };
    app.querySelectorAll('[data-myvoice]').forEach(function (b) {
      b.onclick = function () {
        var n = b.dataset.myvoice; Speech.setMyVoice(n); Speech.stop();
        if (n) Speech.say('Hi! This is my voice. I am ' + (T.me.chars[0] && charById(T.me.chars[0]) ? charById(T.me.chars[0]).short : T.me.name) + '.', T.me.chars[0] || null, { mine: true });
        settingsPage();
      };
    });
    app.querySelectorAll('[data-voice]').forEach(function (b) { b.onclick = function () { p.voice = b.dataset.voice; T.savePrefs(); Speech.load(); Speech.stop(); Speech.say('Hi! I am ' + b.dataset.voice.replace(/\s*\(.*\)$/, '') + '. Break a leg!'); settingsPage(); }; });
    document.getElementById('forget').onclick = function () {
      if (!confirm('Lock this iPad? The cast password will be needed again.')) return;
      Store.forget().then(function () { ls('me', null); T.show = null; T.key = null; T.me = null; T.go('#/'); });
    };
  }

  /* ---------- start ---------- */
  T.reload = function () {
    return Store.fetchShow().then(function (saved) {
      T.saved = saved;
      if (!saved) return;
      return (T.key ? Promise.resolve(T.key) : Store.rememberedKey()).then(function (key) {
        if (!key) return;
        return Store.decryptShow(key, saved.enc).then(function (doc) {
          T.key = key; T.show = doc;
          if (!T.usePass()) { T.key = null; T.show = null; T.pass = null; ls('passId', null); ls('me', null); return Store.forget(); }      // its password was turned off or deleted: lock this iPad
          setMe(ls('me'));
        })
          .catch(function () { T.key = null; T.show = null; return Store.forget(); });      // the cast password changed
      });
    }).catch(function (e) { T.loadError = e.message; });
  };
  T.setMe = setMe;
  window.addEventListener('load', function () { setTimeout(function () { if (window.Store) Store.flushNotes(); }, 1500); });
  T.reload().then(route);

  /* a new version on asl.cool: the page is one long-lived app, so tell the user and reload on a tap (Colleen could not see an update until she reloaded) */
  (function watchForUpdates() {
    var files = ['index.html', 'js/app.js', 'js/teacher.js', 'js/production.js'], tags = null;
    var check = function () {
      if (!navigator.onLine) return;
      Promise.all(files.map(function (f) { return fetch(f, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.headers.get('etag') || r.headers.get('last-modified') || ''; }).catch(function () { return ''; }); }))
        .then(function (now) {
          if (!tags) { tags = now; return; }
          if (now.some(function (t, i) { return t && tags[i] && t !== tags[i]; }) && !document.getElementById('updbar')) {
            var b = document.createElement('button'); b.id = 'updbar'; b.className = 'btn primary updbar'; b.textContent = 'A new version is ready. Tap to update.';
            b.onclick = function () { location.reload(); }; document.body.appendChild(b);
          }
        });
    };
    check(); setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  })();
})();
