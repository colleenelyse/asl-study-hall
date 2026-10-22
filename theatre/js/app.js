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
  var SCENE_SYM = { school: '🏫', class: '📚', hall: '🎒', ball: '🏀', lab: '🧪', stage: '🎭', mic: '🎤', lunch: '🍎', plant: '🌱', trophy: '🏆', party: '🎉' };
  function sym(s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; }

  /* ---------- the show ---------- */
  var O = function () { return T.show.outline; };
  T.O = O;
  var SPIKE = ['#d6336c', '#1c7ed6', '#e8590c', '#2f9e44', '#7048e8', '#0c8599', '#c2255c', '#5c940d', '#ae3ec9', '#f08c00', '#1971c2', '#e03131', '#087f5b', '#9c36b5', '#d9480f', '#364fc7'];
  function charById(id) { return O().characters.find(function (c) { return c.id === id; }); }
  T.charById = charById;
  function color(id) { var c = charById(id); if (c && c.color) return c.color; var i = O().characters.findIndex(function (x) { return x.id === id; }); return SPIKE[(i < 0 ? 0 : i) % SPIKE.length]; }
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
  /* is this label me? ALL counts when I am in the scene */
  function isMine(label, scene, chars) {
    chars = chars || T.me.chars;
    var ids = labelChars(label);
    if (ids.indexOf('*') >= 0) return inScene(scene, chars);
    return ids.some(function (id) { return chars.indexOf(id) >= 0; });
  }
  T.isMine = isMine;
  function myLines(scene) { var s = scriptScene(scene); if (!s) return 0; return s.items.filter(function (it) { return it.type === 'line' && isMine(it.who, scene); }).length; }
  function songMoment(song) { return O().moments.find(function (m) { return m.song === song.id; }); }
  function iSing(song, scene) {
    var s = scene && scriptScene(scene), item = s && s.items.find(function (it) { return it.type === 'song' && it.num === song.num; });
    if (!item) return null;
    return item.singers.some(function (l) { return isMine(l, scene); }) || item.lyrics.some(function (l) { return l.who && isMine(l.who, scene); });
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
  var DEF_PREFS = { size: 1, contrast: false, theme: 'auto', rate: 1, symbols: true, motion: true };
  T.prefs = Object.assign({}, DEF_PREFS, ls('prefs') || {});
  function applyPrefs() {
    var p = T.prefs, r = document.documentElement;
    r.style.setProperty('--scale', p.size);
    r.dataset.contrast = p.contrast ? '1' : '0';
    if (p.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = p.theme;
    r.dataset.dark = (p.theme === 'dark' || (p.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) ? '1' : '0';
    r.dataset.motion = p.motion ? '1' : '0';
    document.body.classList.toggle('symbols-off', !p.symbols);
  }
  T.savePrefs = function () { ls('prefs', T.prefs); applyPrefs(); };
  applyPrefs();

  var DEF_ACCESS = { show: 'auto', echo: false, didIt: false, mic: true, sayForMe: true, strict: 'medium' };
  T.DEF_ACCESS = DEF_ACCESS;
  function setMe(sel) {
    T.me = null;
    if (!sel || !T.show) return;
    if (sel.cast) {
      var c = (T.show.cast || []).find(function (x) { return x.id === sel.cast; });
      if (c) T.me = { id: c.id, name: c.name, chars: (c.chars || []).slice(), photo: c.photo, access: Object.assign({}, DEF_ACCESS, c.access || {}) };
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
  var Speech = T.Speech = {
    voices: [],
    load: function () {
      if (!('speechSynthesis' in window)) return;
      var all = speechSynthesis.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang); });
      // the plain, clear voices first (novelty voices last)
      var odd = /bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;
      Speech.voices = all.filter(function (v) { return !odd.test(v.name); }).concat(all.filter(function (v) { return odd.test(v.name); }));
    },
    voiceFor: function (charId) {
      var i = charId ? O().characters.findIndex(function (c) { return c.id === charId; }) + 1 : 0, n = Speech.voices.length;
      return { voice: n ? Speech.voices[i % n] : null, pitch: charId ? 0.8 + ((i * 3) % 7) * 0.08 : 1 };
    },
    say: function (text, charId, opts) {
      opts = opts || {};
      return new Promise(function (done) {
        if (!('speechSynthesis' in window) || !text) return done();
        var u = new SpeechSynthesisUtterance(text), v = Speech.voiceFor(charId), finished = false;
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
    titleEl.textContent = title; document.title = title === 'Theatre' ? 'Theatre' : title + ' · Theatre';
    backBtn.hidden = !back; backBtn.dataset.to = back || '';
    meBtn.hidden = !T.me; meBtn.innerHTML = T.me ? face(T.me, 40) : '';
  }
  T.setBar = setBar;
  backBtn.onclick = function () { location.hash = backBtn.dataset.to; };
  meBtn.onclick = function () { location.hash = '#/settings'; };
  T.cleanup = [];
  function route() {
    T.cleanup.forEach(function (f) { try { f(); } catch (e) {} }); T.cleanup = [];
    Speech.stop();
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    var page = parts[0] || '';
    if (page === 'teacher') return T.routes.teacher(parts.slice(1));
    if (!T.show) return unlockPage();
    if (!T.me && page !== 'settings') return whoPage();
    var fn = { '': homePage, home: homePage, who: whoPage, lines: linesPage, schedule: schedulePage, songs: songsPage, song: songPage, costumes: costumesPage, story: storyPage, settings: settingsPage, unlock: unlockPage, listen: listenPage }[page] || (T.studentPages || {})[page];
    (fn || homePage)(parts.slice(1));
    app.scrollTop = 0; window.scrollTo(0, 0);
  }
  T.route = route;
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
      '<p>Type the <b>cast password</b>. Your teacher has it.</p>' +
      '<label class="f">Cast password<input type="password" id="pw" autocomplete="current-password" autocapitalize="off" spellcheck="false" required></label>' +
      '<label class="switch"><span>Remember on this iPad</span><input type="checkbox" id="keep" checked></label>' +
      '<p class="err" id="msg" role="alert"></p><div class="row end"><button class="btn primary" type="submit">' + icon('lock') + 'Open</button></div>' +
      (T.saved.offline ? '<p class="muted small">No internet right now. Using the copy saved on this iPad.</p>' : '') + '</form>' +
      '<p class="center"><a href="#/teacher" class="muted">Teacher mode</a></p>';
    var f = document.getElementById('unlock');
    f.onsubmit = function (e) {
      e.preventDefault();
      var pw = document.getElementById('pw').value, msg = document.getElementById('msg'), btn = f.querySelector('button');
      btn.disabled = true; msg.textContent = 'Opening…';
      Store.unlock(T.saved.enc, pw).then(function (key) {
        return Store.decryptShow(key, T.saved.enc).then(function (doc) {
          T.key = key; T.show = doc;
          if (document.getElementById('keep').checked) Store.remember(key);
          setMe(ls('me')); T.go(T.me ? '#/home' : '#/who');
        });
      }).catch(function () { msg.textContent = 'That is not the cast password. Try again.'; btn.disabled = false; });
    };
    setTimeout(function () { var p = document.getElementById('pw'); if (p) p.focus(); }, 50);
  }

  /* ---------- Who are you? ---------- */
  function whoPage(args) {
    setBar('Who are you?', T.me ? '#/home' : '');
    var cast = (T.show.cast || []).filter(function (c) { return c.name; });      // before casting, students are on the list with no role yet
    var pickChars = (args && args[0] === 'character') || !cast.length;
    var h = '<h2>' + (pickChars ? 'Pick your character' : 'Who are you?') + '</h2><p class="muted">Tap your ' + (pickChars ? 'character' : 'picture') + '.</p>';
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
    app.innerHTML = '<div class="row" style="margin-bottom:16px">' + face(T.me, 72) +
      '<div><h2 style="margin:0">Hi, ' + esc(T.me.name) + '!</h2><div>' + who + '</div></div></div>' +
      '<div class="tiles">' +
      tile('#/today', 'sched', 'Today', 'My job in class') +
      tile('#/schedule', 'stage', 'My Schedule', 'When I am on stage') +
      tile('#/lines', 'lines', 'Practice Lines', 'Listen and say my lines') +
      tile('#/songs', 'songs', 'My Songs', 'Sing with the tracks') +
      tile('#/costumes', 'shirt', 'My Costumes', 'What I wear') +
      tile('#/story', 'book', 'The Story', 'What happens') +
      tile('#/settings', 'gear', 'Settings', 'Text size, colors, voice') +
      '</div>' + (T.show.script ? '' : '<p class="card muted" style="margin-top:18px">Your teacher has not added the script yet, so lines and lyrics are not here yet.</p>');
  }
  function tile(href, ic, name, sub) { return '<a class="tile" href="' + href + '">' + icon(ic) + '<b>' + name + '</b><span>' + sub + '</span></a>'; }

  /* ---------- Practice Lines ---------- */
  function linesPage(args) {
    if (!args[0]) return sceneList();
    var scene = sceneById(args[0]); if (!scene) return sceneList();
    if (!args[1]) return modePick(scene);
    return practice(scene, args[1] === 'run' ? 'run' : 'listen');
  }
  function sceneList() {
    setBar('Practice Lines', '#/home');
    if (!T.show.script) { app.innerHTML = '<div class="card"><p>The script is not here yet. Your teacher adds it in Teacher mode.</p></div>'; return; }
    app.innerHTML = '<h2>Pick a scene</h2><div class="grid">' + O().scenes.map(function (s) {
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
      '</div>';
  }

  function practice(scene, mode) {
    setBar('Scene ' + scene.num + (mode === 'run' ? ' · My lines' : ' · Listen'), '#/lines/' + scene.id);
    var src = scriptScene(scene);
    if (!src) { app.innerHTML = '<div class="card">This scene is not in the script yet.</div>'; return; }
    var acc = T.me.access;
    var opt = Object.assign({ names: true, dirs: false, show: acc.show, echo: acc.echo, didIt: acc.didIt || !T.canListen, strict: acc.strict }, ls('practice') || {});
    if (!T.canListen) opt.didIt = true;
    var items = src.items.map(function (it, i) {
      var chars = it.type === 'line' ? labelChars(it.who).filter(function (c) { return c !== '*'; }) : [];
      return { i: i, it: it, chars: chars, mine: it.type === 'line' && isMine(it.who, scene) };
    });
    var cur = 0, playing = false, gen = 0, hintLevel = 0;
    /* Fade (the default): each of my lines starts shown, then a hint once I say it without help, then hidden; it steps back when I need help.
       Prompting with prompt fading is one of the evidence-based practices for autistic learners (NCAEP 2020). Kept on this iPad. */
    var fadeKey = 'fade:' + (T.me.id || T.me.chars[0]) + ':' + scene.id, fade = ls(fadeKey) || {};
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
    function render() {
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
      }).join('') + '</div>' +
        '<div class="dock"><div class="in"><button class="round" id="pv" aria-label="Back one line">' + icon('prev') + '</button>' +
        '<button class="round big" id="pp" aria-label="Play">' + icon('play') + '</button>' +
        '<button class="round" id="nx" aria-label="Next line">' + icon('next') + '</button></div></div>';
      renderOpts();
      app.querySelectorAll('.item').forEach(function (el) { el.onclick = function (e) { if (e.target.closest('a')) return; jump(+el.dataset.i); }; });
      document.getElementById('pp').onclick = function () { playing ? pause() : play(); };
      document.getElementById('pv').onclick = function () { jump(prevIdx(cur)); };
      document.getElementById('nx').onclick = function () { jump(nextIdx(cur)); };
      mark();
    }
    function renderOpts() {
      var o = document.getElementById('opts');
      var sw = function (k, label) { return '<label class="switch"><span>' + label + '</span><input type="checkbox" data-k="' + k + '"' + (opt[k] ? ' checked' : '') + '></label>'; };
      o.innerHTML = '<details' + (mode === 'run' ? '' : '') + '><summary class="btn quiet small" style="display:inline-flex">' + icon('gear') + 'Options</summary>' +
        sw('names', 'Say names before each line') + sw('dirs', 'Read stage directions') +
        (mode === 'run' ? '<div class="switch"><span>My line on the screen</span><div class="seg" data-k="show">' + [['auto', 'Fade'], ['line', 'Show'], ['hint', 'Hint'], ['hidden', 'Hide']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (opt.show === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div>' +
          sw('echo', 'Echo first (the app says it, then I say it)') + (T.canListen ? sw('didIt', 'Use an “I did it” button instead of the microphone') : '') : '') +
        '<div class="switch"><span>Speed</span><div class="seg" data-k="rate">' + [[0.7, 'Slow'], [1, 'Normal'], [1.25, 'Fast']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (+T.prefs.rate === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div></div></details>';
      o.querySelectorAll('input[data-k]').forEach(function (inp) { inp.onchange = function () { opt[inp.dataset.k] = inp.checked; ls('practice', { names: opt.names, dirs: opt.dirs, show: opt.show, echo: opt.echo, didIt: opt.didIt }); var keep = cur; pause(); render(); cur = keep; mark(); document.querySelector('#opts details').open = true; }; });
      o.querySelectorAll('.seg button').forEach(function (b) {
        b.onclick = function () {
          var k = b.parentNode.dataset.k;
          if (k === 'rate') { T.prefs.rate = +b.dataset.v; T.savePrefs(); } else { opt[k] = b.dataset.v; ls('practice', { names: opt.names, dirs: opt.dirs, show: opt.show, echo: opt.echo, didIt: opt.didIt }); }
          var keep = cur; pause(); render(); cur = keep; mark(); document.querySelector('#opts details').open = true;
        };
      });
    }
    function visible(i) { var x = items[i]; return x && x.it.type !== 'cue' && (x.it.type !== 'dir' || opt.dirs); }
    function nextIdx(i) { for (var j = i + 1; j < items.length; j++) if (visible(j)) return j; return items.length; }
    function prevIdx(i) { for (var j = i - 1; j >= 0; j--) if (visible(j)) return j; return 0; }
    function mark() {
      app.querySelectorAll('.item.now').forEach(function (e) { e.classList.remove('now'); });
      var el = app.querySelector('.item[data-i="' + cur + '"]');
      if (el) { el.classList.add('now'); el.scrollIntoView({ block: 'center', behavior: T.prefs.motion ? 'smooth' : 'auto' }); }
    }
    function setPP() { var b = document.getElementById('pp'); if (b) { b.innerHTML = icon(playing ? 'pause' : 'play'); b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); } }
    function pause() { playing = false; gen++; Speech.stop(); if (listen.stop) listen.stop(); closeTurn(); setPP(); }
    function play() { if (cur >= items.length) cur = 0; if (!visible(cur)) cur = nextIdx(cur); if (items[cur] && items[cur].it.type === 'song') cur = nextIdx(cur); playing = true; setPP(); step(++gen); }
    function jump(i) { var was = playing; pause(); cur = Math.max(0, Math.min(i, items.length - 1)); if (!visible(cur)) cur = nextIdx(cur); mark(); if (was) play(); }
    function advance(g) { if (g !== gen) return; cur = nextIdx(cur); mark(); if (cur >= items.length) { playing = false; setPP(); toast('That is the end of the scene!'); return; } step(g); }
    function step(g) {
      if (g !== gen) return;
      var x = items[cur]; if (!x) return;
      mark();
      var it = x.it;
      if (it.type === 'dir') return Speech.say(LineCheck.spoken(it.text) || it.text.replace(/[()]/g, ''), null).then(function () { advance(g); });
      if (it.type === 'song') { playing = false; setPP(); toast('Song time! Open it in My Songs, or tap Next.', 3500); return; }
      if (mode === 'run' && x.mine) return myTurn(x, g);
      var text = LineCheck.spoken(it.text);
      var name = opt.names ? whoName(it.who) + '. ' : '';
      Speech.say(name ? name : '', null).then(function () { return g === gen && Speech.say(text, x.chars[0]); }).then(function () { advance(g); });
    }

    /* ---- my turn ---- */
    var turnEl = null;
    function closeTurn() { if (turnEl) { turnEl.remove(); turnEl = null; } }
    function myTurn(x, g) {
      var sh = showFor(x), helped = false;
      hintLevel = sh === 'hint' ? 1 : 0;
      var c = color(T.me.chars.find(function (id) { return x.chars.indexOf(id) >= 0; }) || T.me.chars[0]);
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
        turnEl.innerHTML = '<div class="in"><div class="row"><b class="grow" style="font-family:Lexend">' + sym('⭐') + 'Your turn!</b>' + chip(T.me.chars.find(function (id) { return x.chars.indexOf(id) >= 0; }) || T.me.chars[0]) + '</div>' +
          '<div class="say">' + shown() + '</div>' + (fb || '') +
          '<div class="row">' +
          (opt.didIt ? '<button class="btn primary" data-a="did">' + icon('hand') + 'I did it</button>'
            : '<button class="btn primary' + (listening ? ' mic' : '') + '" data-a="mic"' + (listening ? ' disabled' : '') + '>' + icon('mic') + (listening ? 'Listening…' : 'Say it') + '</button><button class="btn" data-a="did">' + icon('hand') + 'I did it</button>') +
          (sh !== 'line' && hintLevel < 3 ? '<button class="btn" data-a="hint">' + icon('bulb') + 'Hint</button>' : '') +
          (T.me.access.sayForMe !== false ? '<button class="btn" data-a="for">' + icon('speak') + 'Say it for me</button>' : '') +
          '<button class="btn quiet" data-a="skip">' + icon('skip') + 'Skip</button></div></div>';
        turnEl.querySelectorAll('button[data-a]').forEach(function (b) { b.onclick = function () { act(b.dataset.a); }; });
      }
      function done(msg) {
        x.done = true;
        var el = app.querySelector('.item[data-i="' + x.i + '"] .text'); if (el) el.innerHTML = esc(x.it.text);
        closeTurn(); if (msg) toast(msg, 1400);
        setTimeout(function () { advance(g); }, msg ? 700 : 0);
      }
      function act(a) {
        if (g !== gen) return;
        if (a === 'did') { fadeStep(x, helped ? 0 : 1); return done('Nice!'); }
        if (a === 'skip') return done();
        if (a === 'hint') { helped = true; hintLevel = Math.min(3, hintLevel + 1); return draw(); }
        if (a === 'for') { fadeStep(x, -1); Speech.stop(); return Speech.say(spokenLine, x.chars[0] || T.me.chars[0]).then(function () { if (g === gen) done(); }); }
        if (a === 'mic') {
          Speech.stop();
          draw('', true);
          listen().then(function (alts) {
            if (g !== gen) return;
            var best = { verdict: 'silent', score: 0 };
            alts.forEach(function (h) { var r = LineCheck.check(x.it.text, h, { strictness: opt.strict, keyWords: x.it.keyWords }); if (r.score > best.score || best.verdict === 'silent') best = r; });
            if (best.verdict === 'pass') { fadeStep(x, helped ? 0 : 1); chime(true); draw('<div class="fb pass">' + sym('🎉') + 'You got it!</div>'); setTimeout(function () { done(); }, 1100); return; }
            if (best.verdict === 'close') { helped = true; hintLevel = Math.max(hintLevel, 1); return draw('<div class="fb close">So close! You missed: ' + esc(best.missing.join(', ') || 'a word') + (best.flipped ? ' (listen for “not”)' : '') + '</div>'); }
            if (best.verdict === 'silent') return draw('<div class="fb silent">I did not hear you. Tap Say it and try again.</div>');
            helped = true; if (sh === 'hidden') fadeStep(x, -1);
            hintLevel = Math.min(3, hintLevel + 1);
            draw('<div class="fb miss">Not quite. Here is a hint. Try again!</div>');
          });
        }
      }
      draw();
      if (opt.echo) {
        draw('<div class="fb close">' + sym('👂') + 'Listen, then say it after me.</div>');
        Speech.say(spokenLine, x.chars[0] || T.me.chars[0]).then(function () { if (g !== gen) return; draw(); if (!opt.didIt) act('mic'); });
      } else if (!opt.didIt) {
        Speech.say('Your line!', null, { rate: 1.1 }).then(function () { if (g === gen) act('mic'); });
      }
    }
    render();
    T.cleanup.push(function () { pause(); });
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
  function buildSchedule(chars) {
    var ms = O().moments, out = [], prevCostume = null;
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
    // after my last exit: done (except bows)
    return out;
  }
  T.buildSchedule = buildSchedule;
  function schedCard(c, n) {
    if (!c.on) {
      return '<div class="card off"><div class="head">' + sym('🚪') + '<div><div class="do">Off stage</div><div class="muted">' + mins(c.minutes) + '</div></div></div>' +
        (c.change ? '<div class="change">' + sym('👕') + 'Change into: ' + esc(c.change.name) + '</div>' : '') + '</div>';
    }
    var s = c.scene, what;
    if (c.song) what = sym('🎵') + (c.sing ? 'Singing “' + esc(c.song.title) + '”' : 'On stage for the song “' + esc(c.song.title) + '”');
    else what = sym('🗣️') + (c.lines ? 'Acting · ' + c.lines + ' line' + (c.lines === 1 ? '' : 's') : 'Acting (no lines: listen and react)');
    return '<div class="card on" style="--c:' + color(T.me.chars[0]) + '"><div class="head">' + sym(SCENE_SYM[s.icon] || '🎬') + '<div class="grow"><div class="muted small">Step ' + n + ' · Scene ' + s.num + ' · ' + esc(s.place) + '</div><div class="do">' + what + '</div></div></div>' +
      (c.quickChange ? '<div class="change">' + sym('⚡') + 'Quick change first!</div>' : '') +
      (c.costume ? '<p>' + sym('👕') + 'Wearing: <b>' + esc(c.costume.name) + '</b></p>' : '') +
      '<p class="muted small">' + mins(c.minutes) + '</p></div>';
  }
  function schedulePage() {
    setBar('My Schedule', '#/home');
    if (!T.me.chars.length) { app.innerHTML = '<div class="card"><p>' + sym('🎭') + 'Your schedule for the show appears here when your teacher gives you your role.</p><p><a class="btn primary" href="#/today">See what to do today</a></p></div>'; return; }
    var list = buildSchedule(T.me.chars);
    var view = ls('schedView') || 'steps', at = 0;
    function draw() {
      var h = '<div class="row noprint" style="margin-bottom:14px"><div class="seg">' +
        '<button data-v="steps" aria-pressed="' + (view === 'steps') + '">One step at a time</button><button data-v="list" aria-pressed="' + (view === 'list') + '">Whole show</button></div>' +
        '<span class="grow"></span><button class="btn small" id="print">' + icon('print') + 'Print</button></div>';
      if (view === 'steps') {
        var a = list[at], b = list[at + 1];
        h += '<div class="firstthen"><div><div class="firstthen-lbl lbl">First</div>' + schedCard(a, at + 1) + '</div><div><div class="lbl">Then</div>' + (b ? schedCard(b, at + 2) : '<div class="card">' + sym('👏') + '<b>Bows! The show is over.</b></div>') + '</div></div>' +
          '<div class="row" style="justify-content:center;margin-top:16px"><button class="round" id="sp" aria-label="Back">' + icon('prev') + '</button><b>' + (at + 1) + ' of ' + list.length + '</b><button class="round" id="sn" aria-label="Next">' + icon('next') + '</button></div>';
      } else h += '<div class="sched">' + list.map(function (c, i) { return schedCard(c, i + 1); }).join('') + '</div>';
      app.innerHTML = '<h2 class="row">' + esc(T.me.name) + ' ' + T.me.chars.map(chip).join('') + '</h2>' + h;
      app.querySelectorAll('.seg button').forEach(function (bt) { bt.onclick = function () { view = bt.dataset.v; ls('schedView', view); draw(); }; });
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
    var st = Object.assign({ guide: true, melody: false, vol: 0.9 }, ls('songOpts') || {});
    var lyr = item && item.lyrics.length ? item.lyrics.map(function (l) {
      var mine = l.who && isMine(l.who, scene);
      return '<div class="lyric' + (mine ? ' mine' : '') + '">' + (l.who ? '<span class="who">' + esc(l.who) + '</span>' : '') + esc(l.text) + '</div>';
    }).join('') : '<p class="muted">' + (T.show.script ? 'No lyrics for this song in the script.' : 'Lyrics appear after your teacher adds the script.') + '</p>';
    var has = { perf: !!trk.performance, guide: !!trk.rehearsal, mel: !!(mel && mel.notes && mel.notes.length) };
    app.innerHTML = '<h2>' + sym('🎵') + esc(song.title) + '</h2><p class="muted">Scene ' + scene.num + ' · ' + esc(scene.place) + '</p>' +
      '<div class="card player" id="pl">' + (has.perf || has.guide ? '<p id="ld">Loading the track…</p>' : '<p>Your teacher has not added the track for this song yet.</p>') + '</div>' +
      '<div class="card"><h3>Lyrics</h3><div class="lyrics">' + lyr + '</div><p class="muted small">' + esc(O().licenseNote || '') + '</p></div>' + (T.videoCard ? T.videoCard(song.id) : '');
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
    function stopNodes() { P.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); P.nodes = []; if (P.mel) { P.mel.stop(); P.mel = null; } }
    function start(at) {
      stopNodes();
      at = Math.max(0, Math.min(at, dur() - 0.05));
      P.pos = at; P.t0 = ctx.currentTime + 0.05; P.playing = true;
      P.gp = ctx.createGain(); P.gg = ctx.createGain(); P.master = ctx.createGain(); P.master.gain.value = st.vol;
      P.gp.connect(P.master); P.gg.connect(P.master); P.master.connect(ctx.destination);
      P.gp.gain.value = st.guide && P.buf.guide ? 0 : 1; P.gg.gain.value = st.guide ? 1 : 0;
      if (P.buf.perf) { var a = ctx.createBufferSource(); a.buffer = P.buf.perf; a.connect(P.gp); a.start(P.t0, at); P.nodes.push(a); }
      if (P.buf.guide) { var g = ctx.createBufferSource(); g.buffer = P.buf.guide; g.connect(P.gg); var gat = P.buf.perf ? at + P.offset : at; if (gat >= 0) g.start(P.t0, gat); else g.start(P.t0 - gat, 0); P.nodes.push(g); }
      if (st.melody && has.mel) P.mel = Melody.schedule(ctx, P.master, mel.notes, P.t0, at, { volume: 0.22 });
      tick(); drawBtns();
    }
    function pause() { if (!P.playing) return; P.pos = now(); P.playing = false; stopNodes(); drawBtns(); }
    function tick() {
      cancelAnimationFrame(P.raf);
      var f = function () {
        var t = now();
        if (P.playing && P.loopB != null && t >= P.loopB) { start(P.loopA || 0); return; }
        if (P.playing && t >= dur()) { pause(); P.pos = 0; }
        var r = document.getElementById('pos'); if (r && !r.dragging) r.value = t;
        var tm = document.getElementById('tm'); if (tm) tm.textContent = clock(t) + ' / ' + clock(dur());
        if (P.playing) P.raf = requestAnimationFrame(f);
      };
      f();
    }
    function drawBtns() { var b = document.getElementById('spp'); if (b) { b.innerHTML = icon(P.playing ? 'pause' : 'play'); b.setAttribute('aria-label', P.playing ? 'Pause' : 'Play'); } }
    function ui() {
      var sw = function (k, label, ok, note) { return '<label class="switch"><span>' + label + (ok ? '' : ' <span class="muted small">(' + note + ')</span>') + '</span><input type="checkbox" data-k="' + k + '"' + (st[k] && ok ? ' checked' : '') + (ok ? '' : ' disabled') + '></label>'; };
      document.getElementById('pl').innerHTML =
        '<div class="row" style="justify-content:center"><button class="round" id="sb" aria-label="Back 10 seconds">' + icon('back10') + '</button><button class="round big" id="spp" aria-label="Play">' + icon('play') + '</button><span class="time" id="tm"></span></div>' +
        '<input type="range" id="pos" min="0" max="' + dur().toFixed(2) + '" step="0.1" value="0" aria-label="Where in the song">' +
        sw('guide', 'Guide vocals (hear the singers)', !!(P.buf.guide && P.buf.perf), P.buf.guide ? 'only the guide track is here' : 'no guide track yet') +
        sw('melody', 'Melody line (a soft tone with the tune)', has.mel, 'not made yet') +
        '<label class="switch"><span>Volume</span><input type="range" id="vol" min="0" max="1" step="0.05" value="' + st.vol + '" style="max-width:240px"></label>' +
        '<div class="row" style="margin-top:10px">' + icon('loop') + '<button class="btn small" id="la">Loop from here</button><button class="btn small" id="lb">to here</button><button class="btn small quiet" id="lc">No loop</button><span class="muted small" id="lt"></span></div>';
      document.getElementById('spp').onclick = function () { P.playing ? pause() : start(P.pos); };
      document.getElementById('sb').onclick = function () { var t = Math.max(0, now() - 10); if (P.playing) start(t); else { P.pos = t; tick(); } };
      var pos = document.getElementById('pos');
      pos.oninput = function () { pos.dragging = true; document.getElementById('tm').textContent = clock(+pos.value) + ' / ' + clock(dur()); };
      pos.onchange = function () { pos.dragging = false; if (P.playing) start(+pos.value); else { P.pos = +pos.value; tick(); } };
      document.getElementById('vol').oninput = function (e) { st.vol = +e.target.value; if (P.master) P.master.gain.value = st.vol; ls('songOpts', st); };
      app.querySelectorAll('#pl input[data-k]').forEach(function (inp) {
        inp.onchange = function () {
          st[inp.dataset.k] = inp.checked; ls('songOpts', st);
          if (inp.dataset.k === 'guide' && P.playing) { var t = ctx.currentTime; P.gp.gain.setTargetAtTime(st.guide ? 0 : 1, t, 0.05); P.gg.gain.setTargetAtTime(st.guide ? 1 : 0, t, 0.05); }
          if (inp.dataset.k === 'melody' && P.playing) start(now());
        };
      });
      var lt = function () { document.getElementById('lt').textContent = P.loopB != null ? 'Looping ' + clock(P.loopA || 0) + ' to ' + clock(P.loopB) : P.loopA != null ? 'Loop starts at ' + clock(P.loopA) : ''; };
      document.getElementById('la').onclick = function () { P.loopA = now(); if (P.loopB != null && P.loopB <= P.loopA) P.loopB = null; lt(); };
      document.getElementById('lb').onclick = function () { var t = now(); if (t > (P.loopA || 0) + 1) { P.loopB = t; lt(); if (P.playing) start(P.loopA || 0); } };
      document.getElementById('lc').onclick = function () { P.loopA = P.loopB = null; lt(); };
      tick();
    }
    T.cleanup.push(function () { pause(); cancelAnimationFrame(P.raf); });
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
      return item && item.lyrics.length ? item.lyrics.map(function (l) { var mine = l.who && isMine(l.who, scene); return '<div class="lyric' + (mine ? ' mine' : '') + '">' + esc(l.text) + '</div>'; }).join('') : '<p class="muted">No lyrics yet.</p>';
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
    audio.onplay = audio.onpause = function () { var b = document.getElementById('lp'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); } };
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
        '<h3>' + esc(c.name) + '</h3>' + chip(c.who) +
        '<div style="margin-top:8px">' + c.items.map(function (it, i) { return '<label class="switch"><span>' + esc(it) + '</span><input type="checkbox" data-c="' + esc(c.id) + '" data-i="' + i + '"' + (got.indexOf(i) >= 0 ? ' checked' : '') + '></label>'; }).join('') + '</div>' +
        '<p class="muted small">Wear it in scene' + (scenes.length === 1 ? ' ' : 's ') + scenes.join(', ') + '</p></div>';
    }).join('') + '</div>';
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
      '<label class="switch"><span>High contrast</span><input type="checkbox" data-b="contrast"' + (p.contrast ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Picture symbols</span><input type="checkbox" data-b="symbols"' + (p.symbols ? ' checked' : '') + '></label>' +
      '<label class="switch"><span>Movement and animation</span><input type="checkbox" data-b="motion"' + (p.motion ? ' checked' : '') + '></label>' +
      '<div class="switch"><span>Read-aloud speed</span>' + seg('rate', [[0.7, 'Slow'], [1, 'Normal'], [1.25, 'Fast']]) + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn small" id="test">' + icon('speak') + 'Test the voice</button></div></div>' +
      (T.me ? '<div class="card"><div class="row">' + face(T.me, 56) + '<div class="grow"><b>' + esc(T.me.name) + '</b><br>' + T.me.chars.map(chip).join('') + '</div><a class="btn" href="#/who">Change</a></div></div>' : '') +
      '<div class="card"><div class="row"><a class="btn" href="#/teacher">Teacher mode</a><span class="grow"></span><button class="btn quiet" id="forget">' + icon('lock') + 'Lock this iPad</button></div></div>';
    app.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { var k = b.parentNode.dataset.k; p[k] = k === 'theme' ? b.dataset.v : +b.dataset.v; T.savePrefs(); settingsPage(); }; });
    app.querySelectorAll('input[data-b]').forEach(function (inp) { inp.onchange = function () { p[inp.dataset.b] = inp.checked; T.savePrefs(); }; });
    document.getElementById('test').onclick = function () { Speech.stop(); Speech.say('Break a leg! This is how fast I will read.'); };
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
        return Store.decryptShow(key, saved.enc).then(function (doc) { T.key = key; T.show = doc; setMe(ls('me')); })
          .catch(function () { T.key = null; T.show = null; return Store.forget(); });      // the cast password changed
      });
    }).catch(function (e) { T.loadError = e.message; });
  };
  T.setMe = setMe;
  T.reload().then(route);
})();
