/* asl.cool/theatre: Listen to the show (Colleen 2026-10-25: "I have now made almost the entire show of spoken lines through my custom voices on
   11 labs. I'd like to start listening to what the playback will sound like"). Teacher mode › Music and voices.
   Every spoken line in show order, scene by scene, in its ElevenLabs recording (never a classmate's), with the words on screen; songs in their
   places (a few seconds of the track as a marker, the whole track, or skipped); lines not made yet read by the device voice or skipped.
   While it plays: 👂 Sounds right (approves the recording, as in Voices & recordings), ↻ Make again, 🚩 Flag (with a note) to fix later; flagged
   lines are a filter in Voices & recordings. Lines removed there are left out. Settings stay on this device. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var DEF = { songs: 'marker', missing: 'device', gap: 0.6, rate: 1 };
  var opts = function () { var o = T.ls('listenShow') || {}; Object.keys(DEF).forEach(function (k) { if (o[k] == null) o[k] = DEF[k]; }); return o; };
  /* the show as a list of steps: { kind: 'line', l: { it, scene, h, inSong }, who, text } or { kind: 'song', scene, so, it } */
  function steps() {
    var out = [], seen = {};
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      src.items.forEach(function (it) {
        var addLine = function (x, inSong) {
          var h = T.Voices.id(x); if (seen[h] || T.Voices.removed(h)) return; seen[h] = 1;
          var text = LineCheck.spoken(String(x.text || '')).trim(); if (!text.replace(/[^A-Za-z0-9]/g, '')) return;
          out.push({ kind: 'line', l: { it: x, scene: sc, h: h, inSong: inSong }, who: x.who || '', text: text, scene: sc });
        };
        if (it.type === 'line') addLine(it, false);
        if (it.type === 'song') {
          var so = T.O().songs.find(function (s) { return s.scene === sc.id && String(s.num) === String(it.num); });
          out.push({ kind: 'song', scene: sc, so: so, it: it });
          (it.lyrics || []).forEach(function (l) { if (l.spoken && l.who && String(l.text || '').trim()) addLine(l, true); });
        }
      });
    });
    return out;
  }
  var ix = { lines: {} }, list = [], at = 0, playing = false, token = 0, audio = null, url = null, songTimer = null;
  function stopSound() {
    token++; clearTimeout(songTimer);
    if (audio) { audio.pause(); audio.onended = null; }
    if (url) { URL.revokeObjectURL(url); url = null; }
    T.Speech.stop();
  }
  /* play bytes; resolves when done (or stopped) */
  function playBytes(bytes, rate, maxSec) {
    return new Promise(function (done) {
      url = URL.createObjectURL(new Blob([bytes])); audio = audio || new Audio();
      audio.src = url; audio.playbackRate = rate || 1;
      var fin = false, end = function () { if (fin) return; fin = true; clearTimeout(songTimer); done(); };
      audio.onended = end; audio.onerror = end;
      if (maxSec) songTimer = setTimeout(function () { audio.pause(); end(); }, maxSec * 1000);
      audio.play().catch(end);
    });
  }
  var wait = function (s) { return new Promise(function (ok) { setTimeout(ok, s * 1000); }); };
  function playStep(i, my) {
    var st = list[i], o = opts();
    if (st.kind === 'song') {
      if (o.songs === 'skip' || !st.so) return Promise.resolve();
      var tr = (T.show.tracks || {})[st.so.id] || {}, k = tr.rehearsal ? 'rehearsal' : tr.performance ? 'performance' : null;
      if (!k) return wait(1.2);      // no track yet: a short pause where the song goes
      return Store.getTrack(T.key, st.so.id, k, tr[k].ver).then(function (b) { if (my !== token || !b) return; return playBytes(b, 1, o.songs === 'marker' ? 8 : 0); }).catch(function () {});
    }
    var e = ix.lines[st.l.h];
    if (T.Voices.muted(st.l.h)) return wait(0.4);      // Off in playback: it is in the guide vocals
    if (e && e.tts) return Store.getVoice(T.key, st.l.h, 'tts', e.tts).then(function (b) { if (my !== token) return; if (b) return playBytes(b, o.rate); if (o.missing === 'device') return T.Speech.say(st.text, T.labelChars(st.who)[0]); }).catch(function () {});
    if (o.missing === 'device') return T.Speech.say(st.text, T.labelChars(st.who)[0], { rate: o.rate });
    return Promise.resolve();
  }
  function go(i) {
    stopSound(); at = Math.max(0, Math.min(list.length - 1, i)); draw();
    if (!playing) return;
    var my = token;
    var o = opts(), st = list[at];
    if (st.kind === 'line' && o.missing === 'skip' && !(ix.lines[st.l.h] && ix.lines[st.l.h].tts)) { setTimeout(function () { if (my === token && playing) next(); }, 0); return; }
    playStep(at, my).then(function () { if (my !== token || !playing) return; return wait(st.kind === 'song' ? 0.8 : +o.gap); }).then(function () { if (my === token && playing) next(); });
  }
  function next() { if (at >= list.length - 1) { playing = false; stopSound(); draw(); T.toast('The end of the show.'); return; } go(at + 1); }
  function sceneStart(dir) {
    var sc = list[at].scene, j = at;
    if (dir > 0) { while (j < list.length && list[j].scene === sc) j++; }
    else { while (j > 0 && list[j - 1].scene === sc) j--; if (j === at && j > 0) { var p = list[j - 1].scene; while (j > 0 && list[j - 1].scene === p) j--; } }
    go(Math.min(j, list.length - 1));
  }
  var save = function (m) { return T.saveShow(m); };
  function card(st, cls) {
    if (!st) return '<div class="ls-line ' + cls + ' empty"></div>';
    if (st.kind === 'song') return '<div class="ls-line ' + cls + ' song">♪ #' + esc(st.it.num) + ' ' + esc((st.so && st.so.title) || st.it.title || '') + '</div>';
    var e = ix.lines[st.l.h], ids = T.labelChars(st.who), c = ids.length === 1 && T.charById(ids[0]);
    return '<div class="ls-line ' + cls + '" style="--c:' + (c ? T.color(c.id) : 'var(--accent)') + '"><div class="ls-who">' + esc(c ? c.name : st.who) + (st.l.inSong ? ' · in the song' : '') + (T.Voices.muted(st.l.h) ? ' · <span class="tag">🔇 off in playback</span>' : e && e.tts ? '' : ' · <span class="tag">not made yet</span>') + '</div><div class="ls-text">' + esc(st.text) + '</div></div>';
  }
  function draw() {
    var st = list[at], o = opts(); if (!st) return;
    var e = st.kind === 'line' && ix.lines[st.l.h], ok = e && e.tts && (T.show.voiceOk || {})[st.l.h] === e.tts, fl = st.kind === 'line' && (T.show.voiceFlag || {})[st.l.h];
    var nLines = list.filter(function (x) { return x.kind === 'line'; }).length, nMade = list.filter(function (x) { return x.kind === 'line' && ix.lines[x.l.h] && ix.lines[x.l.h].tts; }).length;
    var scenes = []; list.forEach(function (x, i) { if (!scenes.length || scenes[scenes.length - 1].sc !== x.scene) scenes.push({ sc: x.scene, i: i }); });
    app.innerHTML = '<div class="card ls-top"><div class="row" style="flex-wrap:wrap;align-items:flex-end"><label class="f grow" style="margin:0">Scene<select id="lssc">' + scenes.map(function (s) { return '<option value="' + s.i + '"' + (s.sc === st.scene ? ' selected' : '') + '>Scene ' + s.sc.num + ' · ' + esc(s.sc.place) + '</option>'; }).join('') + '</select></label>' +
      '<span class="muted small">Step ' + (at + 1) + ' of ' + list.length + ' · ' + nMade + ' of ' + nLines + ' lines made</span></div>' +
      '<div class="ls-ctl"><button class="btn" id="lsps" title="Last scene">⏮ Scene</button><button class="btn" id="lsb" title="Back a line">◀ Back</button><button class="btn primary ls-play" id="lsp">' + (playing ? '⏸ Pause' : '▶ Play') + '</button><button class="btn" id="lsn" title="Skip this line">Skip ▶</button><button class="btn" id="lsns" title="Next scene">Scene ⏭</button></div></div>' +
      '<div class="ls-songoff">' + T.Voices.songSwitch() + '</div>' +
      '<div class="ls-stage">' + card(list[at - 2], 'past') + card(list[at - 1], 'past') + card(st, 'now') + card(list[at + 1], 'next') + card(list[at + 2], 'next') + '</div>' +
      (st.kind === 'line' ? '<div class="card ls-fix"><div class="row" style="flex-wrap:wrap">' +
        (e && e.tts ? (ok ? '<button class="btn good" id="lsok">👂 ✓ Approved</button>' : '<button class="btn" id="lsok">👂 Sounds right</button>') : '') +
        '<button class="btn' + (T.Voices.muted(st.l.h) ? ' good' : '') + '" id="lsmu" title="Already in the guide vocals? Turn it off in playback (it stays a line)">' + (T.Voices.muted(st.l.h) ? '🔇 Off in playback' : '🔈 On in playback') + '</button>' +
        '<button class="btn" id="lsag">↻ Make again</button><button class="btn' + (fl ? ' good' : '') + '" id="lsfl">🚩 ' + (fl ? 'Flagged: ' + esc(fl.note || 'to fix') : 'Flag to fix later') + '</button></div><p class="muted small">Flagged lines are listed in Voices & recordings › Show › Flagged to fix.</p></div>' : '') +
      '<details class="card"><summary>Settings</summary><div class="row" style="flex-wrap:wrap">' +
      '<label class="f">Songs<select id="lsso"><option value="marker"' + (o.songs === 'marker' ? ' selected' : '') + '>Play the first 8 seconds</option><option value="full"' + (o.songs === 'full' ? ' selected' : '') + '>Play the whole track</option><option value="skip"' + (o.songs === 'skip' ? ' selected' : '') + '>Skip songs</option></select></label>' +
      '<label class="f">Lines not made yet<select id="lsmi"><option value="device"' + (o.missing === 'device' ? ' selected' : '') + '>Read by the device voice</option><option value="skip"' + (o.missing === 'skip' ? ' selected' : '') + '>Skip them</option></select></label>' +
      '<label class="f">Pause between lines<select id="lsgp">' + [[0.2, 'Short'], [0.6, 'Medium'], [1.2, 'Long']].map(function (g) { return '<option value="' + g[0] + '"' + (+o.gap === g[0] ? ' selected' : '') + '>' + g[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Speed<select id="lsrt">' + [[0.9, 'A little slower'], [1, 'Normal'], [1.15, 'A little faster']].map(function (g) { return '<option value="' + g[0] + '"' + (+o.rate === g[0] ? ' selected' : '') + '>' + g[1] + '</option>'; }).join('') + '</select></label></div></details>';
    var $ = function (id) { return document.getElementById(id); };
    $('lsp').onclick = function () { playing = !playing; if (playing) go(at); else { stopSound(); draw(); } };
    T.Voices.wireSongSwitch(app, draw);
    $('lsb').onclick = function () { go(at - 1); };
    $('lsn').onclick = function () { go(at + 1); };
    $('lsps').onclick = function () { sceneStart(-1); };
    $('lsns').onclick = function () { sceneStart(1); };
    $('lssc').onchange = function () { go(+this.value); };
    var set = function (k, v) { var x = opts(); x[k] = v; T.ls('listenShow', x); };
    $('lsso').onchange = function () { set('songs', this.value); };
    $('lsmi').onchange = function () { set('missing', this.value); };
    $('lsgp').onchange = function () { set('gap', +this.value); };
    $('lsrt').onchange = function () { set('rate', +this.value); };
    if ($('lsok')) $('lsok').onclick = function () { var O = T.show.voiceOk = T.show.voiceOk || {}; if (O[st.l.h] === e.tts) delete O[st.l.h]; else O[st.l.h] = e.tts; save(O[st.l.h] ? 'Approved' : 'Marked not checked'); draw(); };
    if ($('lsmu')) $('lsmu').onclick = function () { T.Voices.setMuted(st.l.h, !T.Voices.muted(st.l.h)); draw(); };
    if ($('lsfl')) $('lsfl').onclick = function () {
      var F = T.show.voiceFlag = T.show.voiceFlag || {};
      if (F[st.l.h]) { if (confirm('Clear the flag on this line?')) { delete F[st.l.h]; save('Flag cleared'); draw(); } return; }
      var note = prompt('What needs fixing? (for example: too flat, wrong word, say “Darbus” differently). You can leave it empty.', '');
      if (note == null) return; F[st.l.h] = { note: note.trim(), at: new Date().toISOString() }; save('Flagged'); draw();
    };
    if ($('lsag')) $('lsag').onclick = function () {
      var b = this, cfg = T.show.eleven || {};
      if (!T.ls('xiKey') || !cfg.ok) { T.toast('Set up ElevenLabs in Voices & recordings first.', 5000); return; }
      if (!T.Voices.voicesFor(st.l.it, cfg.voices || {}).length) { T.toast('This character has no ElevenLabs voice yet.', 5000); return; }
      var was = playing; playing = false; stopSound(); b.disabled = true; b.textContent = 'Making…';
      T.Voices.makeLine(st.l).then(function () { return T.Voices.refresh(); }).then(function (d) { ix = d; draw(); T.toast('Made. Playing it.'); var my = token; return playStep(at, my); }).then(function () { if (was) { playing = true; next(); } })
        .catch(function (err) { b.disabled = false; b.textContent = '↻ Make again'; T.toast(err.message, 6000); });
    };
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.listenshow = function () {
    T.setBar('Listen to the show', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › The script).</p>'; return; }
    app.innerHTML = '<p class="muted">Loading…</p>';
    T.Voices.refresh().then(function (d) {
      ix = d; list = steps(); playing = false; at = Math.min(at, Math.max(0, list.length - 1));
      if (!list.length) { app.innerHTML = '<p class="card">No lines found.</p>'; return; }
      draw();
    });
    T.cleanup.push(function () { playing = false; stopSound(); });
  };
})();
