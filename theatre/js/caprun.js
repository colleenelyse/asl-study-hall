/* asl.cool/theatre: Run the captions (Colleen 2026-10-25: "run the captions from the theatre app"; "almost like a powerpoint that once downloaded
   runs offline but seamlessly transitions from videos that play the music so the words stay aligned but also have the lines built in with no
   visual transition"; "the music should run on its own and run directly to the sound system, they will need to live press go for line timing for
   each line since that is variable. i also still want the full line or get me started version of the lines with a bail out button for anyone on
   get me started mode and goes up"; then: one laptop, one operator, with automatic Help).
   One laptop runs everything. The operator's view is on the laptop; two windows go to the projectors: the audience strip and the performer
   teleprompter, drawn live by the same code as the caption files (js/captions.js), so there are no videos and nothing to switch between.
   - Lines: GO as each line starts. The audience sees it; the performer view scrolls up one card, the next lines below.
   - Songs: GO at the song's cue starts its band track from this laptop (to the sound board) and the words follow the track's own clock.
     GO is off while the singing lasts, so a stray press can't skip a song; it comes back when the last lyric is done (the play-off keeps playing).
   - Help: the Help key shows every line whole on the performer view until the next GO. Automatic Help: when a First words line has been up
     longer than it takes to say it plus a few seconds, with no GO, the whole line appears by itself.
   - Offline: Teacher › Tech and the show › Run the captions gets the laptop ready on Wi-Fi (every band track and the fonts saved on it, the app
     saved by sw.js, the show already kept in IndexedDB). After that the runner, #/captions-run, opens with no Wi-Fi and no teacher password,
     so a Company Mentor or crew member can run it; the cast password unlocks the show as usual. It reopens at the last cue after a restart.
   Keys (a $20 presentation clicker sends these): GO = Space, →, ↓, Page Down, Enter; Back = ←, ↑, Page Up; Help = H, B or . (the clicker's
   blank-screen button); X = blackout. */
(function (root) {
  'use strict';
  /* how long a line takes to say: about 2.6 words a second, at least a second and a half */
  function expected(card) {
    var w = String((card && (card.full || card.text)) || '').replace(/♪/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1.5, w / 2.6);
  }
  /* Back never lands on a song (it would start the music again): it goes to the cue before it */
  function back(cues, i) { var j = i - 1; while (j >= 0 && cues[j].type === 'song') j--; return j; }
  function nextSong(cues, i) { for (var j = i + 1; j < cues.length && j <= i + 40; j++) if (cues[j].type === 'song') return j; return -1; }
  /* the cards coming up from cue j: up to two different lines, or a song's name */
  function upcoming(cues, j, keyOf) {
    var out = [], last = '';
    for (; j < cues.length && out.length < 2; j++) {
      var n = cues[j];
      if (n.type === 'song') { out.push({ text: '', song: '#' + n.song.num + ' ' + n.song.title }); break; }
      var k = keyOf(n.card); if (k !== last) { out.push(n.card); last = k; }
    }
    return out;
  }
  function clock(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2); }
  var KEYS = { go: [' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'], back: ['ArrowLeft', 'ArrowUp', 'PageUp'], help: ['h', 'H', 'b', 'B', '.'], black: ['x', 'X'] };
  function keyAction(k) { var out = null; Object.keys(KEYS).forEach(function (a) { if (KEYS[a].indexOf(k) >= 0) out = a; }); return out; }
  var core = { expected: expected, back: back, nextSong: nextSong, upcoming: upcoming, clock: clock, keyAction: keyAction };
  root.CapRunCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.T) return;
  var T = window.T, RC = window.CapRunCore, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var C = function () { return T.Captions; };
  var trackKind = function (id) { var tr = (T.show.tracks || {})[id] || {}; return tr.performance ? 'performance' : tr.rehearsal ? 'rehearsal' : null; };
  var ready = function () { return T.ls('capRun') === '1'; };

  /* ---------- Teacher › Run the captions: get this laptop ready ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.caprun = function () {
    T.setBar('Run the captions', '#/teacher/caphub');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › Script).</p>'; return; }
    var cues = C().build(), songs = cues.filter(function (c) { return c.type === 'song'; });
    var untimed = T.O().songs.filter(function (so) { return !songs.some(function (c) { return c.song.id === so.id; }); });
    var rows = songs.map(function (c) { var k = trackKind(c.song.id); return '<tr data-s="' + esc(c.song.id) + '"><td>#' + esc(c.song.num) + ' ' + esc(c.song.title) + '</td><td>' + (k === 'performance' ? 'Performance track' : k === 'rehearsal' ? '<span class="err">Guide-vocal track only</span>' : '<span class="err">No track: the words run without music</span>') + '</td><td class="st">' + (k ? '…' : '–') + '</td></tr>'; }).join('');
    app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🎬') + 'Run the captions from this laptop</h2>' +
      '<p>One laptop runs the show’s words: the <b>audience captions</b> on one projector, the <b>performer teleprompter</b> on the other, and the <b>band tracks</b> to the sound board. One operator presses GO for each line; songs run on their own. No QLab and no Wi-Fi needed once the laptop is ready.</p>' +
      '<p class="small muted">' + cues.length + ' cues: ' + songs.length + ' songs with music and ' + (cues.length - songs.length) + ' lines. Looks, letter sizes and each character’s Whole line / First words come from <a href="#/teacher/captions">Open captions</a>; the words from <a href="#/teacher/captedit">Edit the captions</a>.' +
      (untimed.length ? ' <span class="err">' + untimed.length + ' song' + (untimed.length === 1 ? ' has' : 's have') + ' no Lyrics timing yet (' + untimed.slice(0, 5).map(function (s) { return '#' + s.num; }).join(', ') + (untimed.length > 5 ? '…' : '') + '): their words are lines the operator GOes by hand, and their music does not play from here.</span>' : '') + '</p></div>' +
      '<div class="card"><h3 style="margin-top:0">1. Get this laptop ready (on Wi-Fi)</h3><p class="small">Saves every band track and the fonts on this laptop, and lets this laptop open the runner without a teacher password. Do it on the laptop that will run the show, the week before, and again after any change to the captions or tracks.</p>' +
      '<div class="row"><button class="btn primary" id="rgo">Get this laptop ready</button><span id="rmsg" class="small grow"></span></div>' +
      (songs.length ? '<table class="small" style="width:100%;margin-top:8px"><thead><tr><th style="text-align:left">Song</th><th style="text-align:left">Music</th><th>Saved</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') + '</div>' +
      '<div class="card"><h3 style="margin-top:0">2. Prove it works offline</h3><ol class="small" style="line-height:1.6"><li>Turn Wi-Fi off on this laptop.</li><li>Close the browser, open it again and go to <b>asl.cool/theatre/#/captions-run</b> (bookmark it).</li><li>Unlock with the cast password if it asks, open the screens and GO through a few lines and one song.</li><li>Leave Wi-Fi off for every show.</li></ol>' +
      '<p><a class="btn" href="#/captions-run">Open the runner</a></p></div>' +
      '<div class="card"><h3 style="margin-top:0">The setup</h3><ul class="small" style="line-height:1.6">' +
      '<li><b>Two projectors</b> plugged into the laptop (audience and performer). Some MacBook Airs can drive only one extra screen: check before the show, or use a DisplayLink adapter. Set them as separate displays (not mirrored) in System Settings › Displays.</li>' +
      '<li><b>Sound:</b> a cable from the laptop (a small USB audio box avoids hum) to the sound board. Pick it in System Settings › Sound › Output. The board sets the volume.</li>' +
      '<li><b>A presentation clicker</b> (about $20): its forward button is GO, back is Back, and its blank-screen button is Help.</li>' +
      '<li><b>Before each show:</b> plug in the charger, turn on Do Not Disturb, turn off sleep (System Settings › Lock Screen: never), and close other apps.</li>' +
      '<li><b>A backup:</b> a second laptop made ready the same way can take over at the same cue.</li></ul></div>';
    var msg = document.getElementById('rmsg');
    document.getElementById('rgo').onclick = function () {
      var b = this; b.disabled = true; msg.textContent = 'Saving…';
      var bad = 0;
      var keep = navigator.storage && navigator.storage.persist ? navigator.storage.persist().catch(function () {}) : Promise.resolve();
      keep.then(function () { return C().live.fonts(); }).then(function () {
        return songs.reduce(function (p, c) {
          return p.then(function () {
            var id = c.song.id, k = trackKind(id), td = app.querySelector('tr[data-s="' + id + '"] .st'); if (!k) return;
            td.textContent = 'Saving…';
            return Store.getTrack(T.key, id, k, T.show.tracks[id][k].ver).then(function (buf) { if (!buf) throw new Error('missing'); return T.audioCtx().decodeAudioData(buf.slice ? buf.slice(0) : buf); })
              .then(function (ab) { td.textContent = '✓ ' + RC.clock(ab.duration); }, function () { bad++; td.innerHTML = '<span class="err">✗ Not saved</span>'; });
          });
        }, Promise.resolve());
      }).then(function () {
        T.ls('capRun', '1');
        b.disabled = false;
        msg.innerHTML = bad ? '<span class="err">' + bad + ' track' + (bad === 1 ? '' : 's') + ' could not be saved. Check the Wi-Fi and try again.</span>' : '<b>✓ Ready.</b> This laptop can run the captions without Wi-Fi.';
      });
    };
  };

  /* ---------- the runner (#/captions-run) ---------- */
  var R = null;
  T.runCaptions = function () {
    T.setBar('Captions', '');
    if (!ready()) { app.innerHTML = '<div class="card"><h2>Captions</h2><p>This laptop isn’t ready to run the captions yet. A teacher sets it up on Wi-Fi: Teacher mode › Tech and the show › <b>Run the captions</b> › Get this laptop ready.</p></div>'; return; }
    if (!T.show.script) { app.innerHTML = '<p class="card">The script isn’t imported yet.</p>'; return; }
    var L = C().live, o0 = C().opt(), cues = C().build(), saved = +T.ls('capPos');
    R = { cues: cues, i: -1, armed: false, song: null, help: false, due: 0, black: false, from: null, goAt: 0, wins: {}, dec: {}, autoOn: T.ls('capAuto') !== '0', autoDelay: +T.ls('capDelay') || 3, flash: '', flashT: 0, shown: '' };
    app.innerHTML = '<div class="cr">' +
      '<div class="cr-top"><b id="crn">Before the show</b><span id="crsc" class="muted"></span><span class="grow"></span><span id="crclock" class="muted"></span></div>' +
      '<div class="cr-main"><div class="cr-now"><div class="cr-lab">NOW</div><div id="crnow" class="cr-big"></div><div id="crsong" class="cr-songbar" hidden><div class="cr-bar"><i id="crbar"></i></div><span id="crst" class="small"></span></div><div id="crauto" class="cr-auto small"></div></div>' +
      '<div class="cr-next"><div class="cr-lab">NEXT</div><div id="crnext" class="cr-mid"></div><div id="crlater" class="cr-later small"></div></div></div>' +
      '<div class="cr-btns"><button class="btn" id="crback">◀ Back</button><button class="btn primary cr-go" id="crgo">GO</button><button class="btn cr-help" id="crhelp" aria-pressed="false">HELP</button><button class="btn" id="crblack" aria-pressed="false">Blackout</button></div>' +
      '<div class="cr-flash" id="crflash" role="status"></div>' +
      '<div class="cr-prev"><figure><figcaption>Audience <span id="crwa" class="small"></span></figcaption><canvas id="crpa" width="480" height="270"></canvas></figure><figure><figcaption>Performers <span id="crwp" class="small"></span></figcaption><canvas id="crpp" width="270" height="270"></canvas></figure>' +
      '<div class="cr-side"><button class="btn primary" id="crwin">Open the two screens</button>' + (('getScreenDetails' in window) ? '<button class="btn" id="crplace">Put them on the projectors</button>' : '') + '<button class="btn quiet small" id="crswap">Swap screens</button>' +
      '<label class="f" style="margin:6px 0 0">Jump to a cue<select id="crjump"><option value="">Pick a cue…</option>' + cues.map(function (c, i) { return '<option value="' + i + '">' + c.n + ' · ' + esc(c.type === 'song' ? '♪ #' + c.song.num + ' ' + c.song.title : (c.card.name || '') + ' ' + String(c.card.text).slice(0, 44)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="margin:6px 0 0"><span><input type="checkbox" id="crauto1"' + (R.autoOn ? ' checked' : '') + '> Automatic Help after</span><select id="crdelay">' + [2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (R.autoDelay === n ? ' selected' : '') + '>' + n + ' seconds</option>'; }).join('') + '</select></label></div></div>' +
      '<p class="small muted">Keys: GO = Space, → or Page Down · Back = ← or Page Up · Help = H or B · Blackout = X. The clicker works the same. ' + (saved > 0 && saved < cues.length ? '<button class="btn small" id="crresume">Pick up at cue ' + cues[saved].n + '</button>' : '') + '</p></div>';
    var $ = function (id) { return document.getElementById(id); };
    var pa = $('crpa').getContext('2d'), pp = $('crpp').getContext('2d');
    var ctx = T.audioCtx();
    var t = function () { var s = R.song; return !s ? 0 : s.ab ? ctx.currentTime - s.t0 : (performance.now() - s.p0) / 1000; };

    function say(text) { R.flash = text; R.flashT = performance.now(); $('crflash').textContent = text; }
    function save() { T.ls('capPos', String(R.i)); }
    /* decode the next song ahead of time, so GO starts it at once */
    function decode(c) {
      var id = c.song.id, k = trackKind(id); if (!k) return Promise.resolve(null);
      if (!R.dec[id]) R.dec[id] = Store.getTrack(T.key, id, k, T.show.tracks[id][k].ver).then(function (buf) { return buf ? ctx.decodeAudioData(buf.slice ? buf.slice(0) : buf) : null; }).catch(function () { delete R.dec[id]; return null; });
      return R.dec[id];
    }
    function prepare() { var j = RC.nextSong(cues, R.i); Object.keys(R.dec).forEach(function (id) { if (j < 0 || cues[j].song.id !== id) delete R.dec[id]; }); if (j >= 0) decode(cues[j]); }
    function stopSong() { var s = R.song; if (s && s.src) { try { s.src.stop(); } catch (e) {} s.src.disconnect(); } R.song = null; }
    function playSong(c) {
      stopSong();
      var id = c.song.id, k = trackKind(id), off = k === 'rehearsal' && T.show.trackOffset && T.show.trackOffset[id] ? +T.show.trackOffset[id] : 0;
      var sa = C().songTimeline(c, o0, false), sp = C().songTimeline(c, o0, true), lyricEnd = sa.reduce(function (m, x) { return Math.max(m, x.b); }, 0);
      var s = R.song = { c: c, sa: sa, sp: sp, lyricEnd: lyricEnd, dur: lyricEnd + 3, ab: null, src: null, t0: 0, p0: performance.now(), loading: !!k };
      if (!k) { say('No track for this song: the words run without music.'); return; }
      decode(c).then(function (ab) {
        if (R.song !== s) return;
        s.loading = false;
        if (!ab) { s.p0 = performance.now(); say('The music could not load: the words run on their own.'); return; }
        ctx.resume && ctx.resume();
        s.ab = ab; s.dur = Math.max(lyricEnd, ab.duration - Math.max(0, off));
        s.src = ctx.createBufferSource(); s.src.buffer = ab; s.src.connect(ctx.destination); s.t0 = ctx.currentTime + 0.03;
        if (off >= 0) s.src.start(s.t0, off); else s.src.start(s.t0 - off, 0);
      });
    }
    var singing = function () { var s = R.song; return s && s.c === cues[R.i] && (s.loading || t() < s.lyricEnd); };
    function perfState() {      // what the performer view shows now (to scroll from)
      if (R.i < 0) return { cur: null, nexts: RC.upcoming(cues, 0, L.keyOf) };
      var c = cues[R.i];
      if (c.type === 'song') {
        if (R.armed || !R.song) return { cur: { who: '', name: 'Next', text: '♪ #' + c.song.num + ' ' + c.song.title, key: 'song' + R.i }, nexts: RC.upcoming(cues, R.i + 1, L.keyOf) };
        var tt = t(), seg = null; R.song.sp.forEach(function (x) { if (x.a <= tt && tt < x.b) seg = x; });
        if (seg) return seg.state;
        return { cur: null, nexts: RC.upcoming(cues, R.i + 1, L.keyOf) };
      }
      return C().stateFor(cues, R.i);
    }
    function land(i) {
      R.i = i; R.armed = false; R.help = false; R.goAt = performance.now();
      var c = cues[i];
      R.due = c && c.type === 'still' && R.autoOn && L.firstWords(c.card, o0) ? R.goAt + (RC.expected(c.card) + R.autoDelay) * 1000 : 0;
      save(); prepare(); R.shown = '';
    }
    function go() {
      if (singing()) { say('GO is off while they sing. It comes back when the last lyric is done.'); return; }
      var c = cues[R.i];
      if (c && c.type === 'song' && R.armed) { R.armed = false; R.from = null; playSong(c); R.goAt = performance.now(); R.shown = ''; return; }
      if (R.i >= cues.length - 1) { R.from = perfState(); R.i = cues.length; stopSong(); save(); R.shown = ''; say('End of the show.'); return; }
      R.from = perfState();
      var n = cues[R.i + 1];
      if (n.type === 'song') { R.from = null; land(R.i + 1); playSong(n); }
      else land(R.i + 1);      // a play-off still sounding keeps playing under the next line
    }
    function goBack() {
      if (R.i < 0) return;
      stopSong(); R.from = null;
      var j = RC.back(cues, Math.min(R.i, cues.length)); if (j < 0) { R.i = -1; R.help = false; R.due = 0; save(); R.shown = ''; return; }
      land(j); R.due = 0;
    }
    function jump(i) { stopSong(); R.from = null; land(i); if (cues[i].type === 'song') { R.armed = true; decode(cues[i]); say('♪ Ready: GO starts the song.'); } }
    function help() { R.help = R.help ? false : 'key'; R.due = 0; R.shown = ''; }
    function black() { R.black = !R.black; R.shown = ''; }
    var act = { go: go, back: goBack, help: help, black: black };
    function onKey(e) {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test((e.target && e.target.tagName) || '') && e.key !== 'PageDown' && e.key !== 'PageUp') return;
      var a = RC.keyAction(e.key); if (!a || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault(); if (e.repeat) return;
      act[a]();
    }
    document.addEventListener('keydown', onKey);

    /* the two screens: windows on the projectors, drawn from here */
    function openWin(kind) {
      var w = R.wins[kind];
      if (w && !w.closed) return w;
      w = window.open('', 'cap-' + kind, 'popup=yes,width=' + (kind === 'aud' ? 960 : 600) + ',height=' + (kind === 'aud' ? 540 : 600));
      if (!w) return null;
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + (kind === 'aud' ? 'Audience captions' : 'Performer teleprompter') + '</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{display:block;width:100vw;height:100vh}#tip{position:fixed;left:0;right:0;bottom:16px;text-align:center;color:#999;font:18px system-ui,sans-serif}</style></head><body><canvas></canvas><div id="tip">' + (kind === 'aud' ? 'AUDIENCE' : 'PERFORMERS') + ': drag this window to its projector, then click it to fill the screen.</div></body></html>');
      w.document.close();
      w.document.body.onclick = function () { var el = w.document.documentElement; if (!w.document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {}); };
      w.document.addEventListener('fullscreenchange', function () { var tip = w.document.getElementById('tip'); if (tip) tip.hidden = !!w.document.fullscreenElement; });
      w.addEventListener('keydown', onKey);
      w.document.body.style.cursor = 'none';
      R.wins[kind] = w; R.shown = '';
      return w;
    }
    $('crwin').onclick = function () { var a = openWin('aud'), p = openWin('perf'); if (!a || !p) say('The browser blocked a window. Allow pop-ups for asl.cool (the icon at the right of the address bar), then press again.'); window.focus(); };
    var swapped = false;
    function place() {
      return window.getScreenDetails().then(function (sd) {
        var others = sd.screens.filter(function (s) { return s !== sd.currentScreen; });
        if (!others.length) { say('Only one screen is plugged in. Plug in the projectors (set as separate displays, not mirrored).'); return; }
        var A = others[swapped ? 1 % others.length : 0], P = others[swapped ? 0 : 1 % others.length];
        [['aud', A], ['perf', P]].forEach(function (x) { var w = R.wins[x[0]]; if (w && !w.closed) { w.moveTo(x[1].availLeft, x[1].availTop); w.resizeTo(x[1].availWidth, x[1].availHeight); } });
        say(others.length < 2 ? 'Only one projector found: both windows are on it. Plug in the second one, or drag one back.' : 'Placed: audience on ' + (A.label || 'screen 1') + ', performers on ' + (P.label || 'screen 2') + '. Click each one to fill its screen.');
      }, function () { say('The browser did not allow moving the windows: drag them to the projectors instead.'); });
    }
    if ($('crplace')) $('crplace').onclick = function () { var a = openWin('aud'), p = openWin('perf'); if (!a || !p) { say('Allow pop-ups for asl.cool, then press again.'); return; } place(); };
    $('crswap').onclick = function () { swapped = !swapped; if ($('crplace') && window.getScreenDetails) place(); else say('Drag each window to the other projector.'); };
    $('crgo').onclick = function () { go(); this.blur(); };
    $('crback').onclick = function () { goBack(); this.blur(); };
    $('crhelp').onclick = function () { help(); this.blur(); };
    $('crblack').onclick = function () { black(); this.blur(); };
    $('crjump').onchange = function () { if (this.value !== '') jump(+this.value); this.value = ''; this.blur(); };
    $('crauto1').onchange = function () { R.autoOn = this.checked; T.ls('capAuto', this.checked ? '1' : '0'); if (!R.autoOn) R.due = 0; };
    $('crdelay').onchange = function () { R.autoDelay = +this.value; T.ls('capDelay', this.value); };
    if ($('crresume')) $('crresume').onclick = function () { var j = saved; if (cues[j].type === 'song') jump(j); else { land(j); R.due = 0; } this.remove(); };

    /* drawing: the canvases in js/captions.js, copied to the screens and the small previews */
    function blitTo(w, src) {
      if (!w || w.closed) return;
      var cvs = w.document.querySelector('canvas'); if (!cvs) return;
      var dpr = w.devicePixelRatio || 1, cw = Math.round(w.innerWidth * dpr), ch = Math.round(w.innerHeight * dpr);
      if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; }
      var g = cvs.getContext('2d'), k = Math.min(cw / src.width, ch / src.height), dw = src.width * k, dh = src.height * k;
      g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
    function cardText(c) { return c ? (c.type === 'song' ? '♪ #' + c.song.num + ' ' + c.song.title : (c.card.name ? c.card.name + ' ' : '') + String(c.card.full || c.card.text)) : ''; }
    var raf = 0, lastUi = '';
    function frame() {
      if (!document.getElementById('crgo')) return;
      var now = performance.now(), c = cues[R.i], o = R.help ? C().helpO(o0) : o0;
      if (R.due && !R.help && now >= R.due) { R.help = 'auto'; R.due = 0; R.shown = ''; }
      /* audience */
      var aud = null, songT = R.song && !R.armed ? t() : 0;
      if (!R.black && c) { if (c.type === 'still') aud = c.card; else if (R.song && R.song.c === c) aud = (L.at(R.song.sa, songT) || {}).card || null; }
      if (!R.black && !c && R.song) aud = (L.at(R.song.sa, t()) || {}).card || null;
      /* performers */
      var scrollE = R.from && c && c.type === 'still' ? Math.min(1, (now - R.goAt) / (L.SCROLL * 1000)) : 1;
      var key = [R.i, R.armed, R.black, R.help, aud ? aud.text : '', R.song && !R.armed && c && c.type === 'song' ? L.keyOf((R.song.sp.filter(function (x) { return x.a <= songT && songT < x.b; })[0] || {}).card) + Math.floor(songT * 30) : '', scrollE < 1 ? now : ''].join('|');
      if (key !== R.shown) {
        R.shown = key;
        L.audience(aud, o0);
        if (R.black) L.performer(null, o);
        else if (c && c.type === 'song' && R.song && R.song.c === c && !R.armed) { var sp = R.song.sp, last = sp.length ? sp[sp.length - 1].b : 0; if (songT < last) C().perfAt(sp, songT, o).draw(); else L.performer(perfState(), o); }
        else if (scrollE < 1) L.scroll(R.from, perfState(), L.ease(scrollE), o);
        else L.performer(perfState(), o);
        blitTo(R.wins.aud, L.cv); blitTo(R.wins.perf, L.cvP);
        pa.drawImage(L.cv, 0, 0, 480, 270); pp.drawImage(L.cvP, 0, 0, 270, 270);
      }
      /* the operator's view */
      var n = cues[R.i + 1], s = R.song, ui = [R.i, R.armed, R.black, R.help, s ? Math.floor(t() * 4) : '', R.due ? Math.ceil((R.due - now) / 1000) : '', R.wins.aud && !R.wins.aud.closed, R.wins.perf && !R.wins.perf.closed].join('|');
      if (ui !== lastUi) {
        lastUi = ui;
        $('crn').textContent = R.i < 0 ? 'Before the show · cue 1 of ' + cues.length + ' is next' : R.i >= cues.length ? 'End of the show' : 'Cue ' + c.n + ' of ' + cues.length;
        $('crsc').textContent = c ? ' · Scene ' + c.scene.num + (c.scene.place ? ', ' + c.scene.place : '') : '';
        $('crnow').innerHTML = R.black ? '<span class="err">BLACKOUT: both screens are black (X to bring them back)</span>' : c ? esc(cardText(c)) + (R.armed ? ' <span class="tag">GO starts the song</span>' : '') : '<span class="muted">Screens black. GO shows the first line.</span>';
        $('crnext').textContent = n ? cardText(n) : R.i >= cues.length ? '' : 'End of the show';
        $('crlater').innerHTML = [cues[R.i + 2], cues[R.i + 3]].filter(Boolean).map(function (x) { return esc(cardText(x).slice(0, 90)); }).join('<br>');
        var playing = s && c && s.c === c && !R.armed;
        $('crsong').hidden = !playing;
        if (playing) {
          var tt = t(); $('crbar').style.width = Math.min(100, tt / (s.dur || 1) * 100) + '%';
          $('crst').textContent = s.loading ? 'Loading the music…' : clockOf(tt) + ' / ' + clockOf(s.dur) + (tt < s.lyricEnd ? ' · GO is off until the singing ends (' + clockOf(s.lyricEnd - tt) + ')' : ' · singing done: GO for the next line');
        }
        $('crgo').classList.toggle('off', !!singing());
        $('crhelp').setAttribute('aria-pressed', !!R.help); $('crhelp').textContent = R.help === 'auto' ? 'HELP (auto) ON' : R.help ? 'HELP ON' : 'HELP';
        $('crblack').setAttribute('aria-pressed', R.black);
        $('crauto').textContent = R.due ? 'First words line: automatic Help in ' + Math.max(0, Math.ceil((R.due - now) / 1000)) + ' s unless GO' : R.help === 'auto' ? 'Automatic Help is showing the whole line. GO hides it.' : '';
        $('crwa').textContent = R.wins.aud && !R.wins.aud.closed ? '● on' : '○ not open'; $('crwp').textContent = R.wins.perf && !R.wins.perf.closed ? '● on' : '○ not open';
        $('crclock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      if (R.flash && now - R.flashT > 5000) { R.flash = ''; $('crflash').textContent = ''; }
      raf = requestAnimationFrame(frame);
    }
    var clockOf = RC.clock;
    /* keep the laptop awake while the runner is open */
    var lock = null; var wake = function () { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }, function () {}); };
    wake(); document.addEventListener('visibilitychange', wake);
    L.fonts().then(function () { R.shown = ''; frame(); });
    T.cleanup.push(function () {
      cancelAnimationFrame(raf); stopSong(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', wake);
      if (lock) lock.release().catch(function () {});
      Object.keys(R.wins).forEach(function (k) { var w = R.wins[k]; if (w && !w.closed) w.close(); });
    });
  };
})();
