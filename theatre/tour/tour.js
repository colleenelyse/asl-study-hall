/* asl.cool/theatre/tour: the try-it pieces. Made-up sample show ("The Bake Sale"), made-up students; nothing is saved or sent.
   Practice Lines uses the app's own checker (../js/line-check.js). Feeling pictures are Colleen's (../img/emotions/). */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = { get: function (k) { try { return localStorage.getItem('tour:' + k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem('tour:' + k, v); } catch (e) {} } };
  function pressed(group, btn) { $$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); }); }

  /* ---------- read aloud (the device's voice) ---------- */
  var synth = window.speechSynthesis, voice = null;
  function pickVoice() {
    if (!synth) return;
    var vs = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    var good = vs.filter(function (v) { return /premium|enhanced|natural|google/i.test(v.name); });
    voice = good[0] || vs[0] || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  function say(text, opts) {
    opts = opts || {};
    return new Promise(function (done) {
      if (!synth) { setTimeout(done, Math.min(4000, 400 + text.length * 55)); return; }
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = opts.rate || 0.95; u.pitch = opts.pitch || 1;
      var fin = false, end = function () { if (!fin) { fin = true; done(); } };
      u.onend = end; u.onerror = end;
      setTimeout(end, 1500 + text.length * 120);      // some browsers never fire onend
      synth.speak(u);
    });
  }
  var SAYS = {
    why: 'Theatre tools assume every actor can read and practice alone. Rehearsal apps expect actors to read a script, follow a printed schedule and practice by themselves. So students with disabilities end up depending on an adult for every line, every cue and every entrance. This app is built around the actual show and the actual student.'
  };
  $$('[data-say]').forEach(function (b) { b.onclick = function () { say(SAYS[b.dataset.say]); }; });

  /* ---------- top bar progress ---------- */
  var prog = $('#prog');
  addEventListener('scroll', function () { var h = document.body.scrollHeight - innerHeight; prog.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%'; }, { passive: true });

  /* ---------- Make it fit ---------- */
  var FONTS = { atk: "'Atkinson Hyperlegible', system-ui, sans-serif", lex: "'Lexend', system-ui, sans-serif", and: "'Andika', system-ui, sans-serif", comic: "'Comic Neue', system-ui, sans-serif" };
  var fit = $('#fitPanel'), fitBtn = $('#fitBtn');
  function openFit(open) { fit.hidden = !open; fitBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) $('button', fit).focus(); }
  fitBtn.onclick = function () { openFit(fit.hidden); };
  $('#fitClose').onclick = function () { openFit(false); fitBtn.focus(); };
  $$('[data-open-fit]').forEach(function (b) { b.onclick = function () { openFit(true); }; });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!fit.hidden) openFit(false); closePop(); } });
  function apply(opt, v) {
    if (opt === 'scale') root.style.setProperty('--scale', v);
    else if (opt === 'font') root.style.setProperty('--font-body', FONTS[v] || FONTS.atk);
    else if (opt === 'ls') root.style.setProperty('--ls', v);
    else if (opt === 'theme') { if (v) root.setAttribute('data-theme', v); else root.removeAttribute('data-theme'); }
    else if (opt === 'contrast') root.setAttribute('data-contrast', v);
    else if (opt === 'motion') root.setAttribute('data-motion', v);
  }
  $$('.seg[data-opt]').forEach(function (g) {
    var opt = g.dataset.opt, saved = store.get(opt);
    $$('button', g).forEach(function (b) {
      if (saved !== null && b.dataset.v === saved) { pressed(g, b); apply(opt, saved); }
      b.onclick = function () { pressed(g, b); apply(opt, b.dataset.v); store.set(opt, b.dataset.v); };
    });
  });

  /* ---------- Practice Lines ---------- */
  var SCENE = [
    { who: 'ROSA', c: 'rosa', text: 'The bake sale starts in ten minutes, and the oven just stopped working!' },
    { who: 'THEO', c: 'theo', text: "Don't panic. My grandma has an oven, and she lives across the street.", mine: true },
    { who: 'ROSA', c: 'rosa', text: 'Then what are we waiting for? Grab the trays!' },
    { who: 'THEO', c: 'theo', text: "I'll carry the cupcakes. You bring the frosting.", mine: true }
  ];
  var pl = { i: -1, help: 0, strict: 'medium', running: false, tries: 0 };
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  function lineText(l, k) {
    if (!l.mine || k < pl.i || !pl.running) return esc(l.text);
    if (k > pl.i) return '<span class="hidden-line">' + (pl.help === 0 ? esc(l.text) : '· · ·') + '</span>';
    if (pl.help === 0) return esc(l.text);
    if (pl.help === 1) return esc(LineCheck.hint(l.text, pl.tries ? 2 : 1));
    return '<span class="hidden-line">' + LineCheck.spoken(l.text).split(/\s+/).map(function () { return '____'; }).join(' ') + '</span>';
  }
  function drawLines() {
    $$('[data-help]').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.help === pl.help ? 'true' : 'false'); });
    $('#plLines').innerHTML = SCENE.map(function (l, k) {
      var cls = 'ln ' + (l.mine ? 'mine' : 'other') + (k === pl.i ? ' now' : '') + (pl.running && k > pl.i ? ' dim' : '');
      return '<div class="' + cls + '"><span class="who">' + l.who + (l.mine ? ' · you' : '') + '</span>' + lineText(l, k) + '</div>';
    }).join('');
  }
  function turnUi() {
    var l = SCENE[pl.i];
    if (!l || !l.mine) { $('#plTurn').innerHTML = ''; return; }
    $('#plTurn').innerHTML = '<div class="row" style="margin-top:12px">' +
      (SR ? '<button class="btn primary mic" id="plMic">🎤 Say my line</button>' : '') +
      '<button class="btn good" id="plDid">✓ I did it</button><button class="btn small" id="plHint">💡 Hint</button><button class="btn small" id="plSay">🔊 Say it for me</button></div>' +
      '<form class="typed" id="plType"><input id="plIn" autocomplete="off" aria-label="Type your line" placeholder="…or type your line"><button class="btn small">Check</button></form>' +
      (SR ? '' : '<p class="small muted">This browser has no speech recognition, so type or tap "I did it". Chromebooks and iPads listen.</p>');
    if ($('#plMic')) $('#plMic').onclick = listen;
    $('#plDid').onclick = function () { verdict({ verdict: 'pass' }, true); };
    $('#plHint').onclick = function () { pl.tries++; pl.help = Math.max(pl.help, 1); drawLines(); };
    $('#plSay').onclick = function () { pl.tries++; say(LineCheck.spoken(l.text)); };
    $('#plType').onsubmit = function (e) { e.preventDefault(); var v = $('#plIn').value.trim(); if (v) check(v); };
  }
  function verdict(r, did) {
    var box = $('#plVerdict'), l = SCENE[pl.i];
    if (r.verdict === 'silent') { box.innerHTML = '<div class="verdict close">I didn\'t catch any words. Try again.</div>'; return; }
    if (r.verdict === 'pass') {
      box.innerHTML = '<div class="verdict pass">🎉 ' + (did ? 'Great. On to the next line.' : 'Got it! On to the next line.') + '</div>';
      if (!pl.tries) pl.help = Math.min(2, pl.help + 1);      // fade: said without help, so the next line gets less help
      stopRec(); setTimeout(next, 1100);
    } else if (r.verdict === 'close') {
      pl.tries++;
      box.innerHTML = '<div class="verdict close">🙂 Almost! ' + (r.flipped ? 'Check for a "not". ' : '') + (r.missing && r.missing.length ? 'Listen for: <b>' + esc(r.missing.slice(0, 2).join(', ')) + '</b>' : 'Try once more.') + '</div>';
    } else {
      pl.tries++; if (pl.help === 2) pl.help = 1;      // steps back after a miss: hidden becomes a hint
      box.innerHTML = '<div class="verdict miss">Not quite. Here is a hint: <b>' + esc(LineCheck.hint(l.text, pl.tries > 1 ? 2 : 1)) + '</b></div>';
      drawLines();
    }
  }
  function check(heard) {
    var r = LineCheck.check(SCENE[pl.i].text, heard, { strictness: pl.strict });
    $('#plVerdict').innerHTML = '<p class="small muted">Heard: “' + esc(heard) + '”</p>';
    setTimeout(function () { verdict(r); }, 250);
  }
  function stopRec() { if (rec) { try { rec.abort(); } catch (e) {} rec = null; } var m = $('#plMic'); if (m) m.classList.remove('listening'); }
  function listen() {
    stopRec(); if (synth) synth.cancel();
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 3;
    var m = $('#plMic'); m.classList.add('listening'); m.textContent = '🎤 Listening…';
    rec.onresult = function (e) { var a = e.results[0], best = a[0].transcript; check(best); };
    rec.onerror = function (e) { $('#plVerdict').innerHTML = '<div class="verdict close">' + (e.error === 'not-allowed' ? 'The microphone is blocked here. Type your line or tap "I did it".' : 'I didn\'t hear that. Try again, type it, or tap "I did it".') + '</div>'; };
    rec.onend = function () { var b = $('#plMic'); if (b) { b.classList.remove('listening'); b.textContent = '🎤 Say my line'; } };
    try { rec.start(); } catch (e) {}
  }
  function next() {
    pl.i++; pl.tries = 0; $('#plVerdict').innerHTML = '';
    if (pl.i >= SCENE.length) { pl.running = false; drawLines(); $('#plTurn').innerHTML = ''; $('#plVerdict').innerHTML = '<div class="verdict pass">🌟 Scene done! In the app this practice is counted, and "Study next" suggests what to practice tomorrow.</div>'; $('#plStart').disabled = false; return; }
    drawLines(); turnUi();
    var l = SCENE[pl.i];
    if (!l.mine) say(l.text).then(function () { if (pl.running && SCENE[pl.i] === l) setTimeout(next, 350); });
  }
  $('#plStart').onclick = function () { pl.running = true; pl.i = -1; this.disabled = true; next(); };
  $('#plReset').onclick = function () { stopRec(); if (synth) synth.cancel(); pl.running = false; pl.i = -1; $('#plStart').disabled = false; $('#plTurn').innerHTML = ''; $('#plVerdict').innerHTML = ''; drawLines(); };
  $$('[data-help]').forEach(function (b) { b.onclick = function () { pl.help = +b.dataset.help; pressed(b.parentNode, b); drawLines(); }; });
  $$('[data-strict]').forEach(function (b) { b.onclick = function () { pl.strict = b.dataset.strict; pressed(b.parentNode, b); }; });
  drawLines();

  /* ---------- script page highlights ---------- */
  var HL = { theo: ['#e3d6fb', '#7a4ad8'], rosa: ['#fbd3d5', '#d9363e'], june: ['#cdeedd', '#1f8a5a'] };
  function highlight(c) {
    $$('#paper .dl').forEach(function (s) {
      var on = s.dataset.c === c;
      s.classList.toggle('hl', on);
      s.style.setProperty('--hlc', HL[s.dataset.c][0]); s.style.setProperty('--hld', HL[s.dataset.c][1]);
    });
  }
  $$('#hlPick button').forEach(function (b) { b.onclick = function () { pressed(b.parentNode, b); highlight(b.dataset.c); }; });
  highlight('theo');
  /* feeling pictures in the gray strip and director's notes in the left margin, beside the line they belong to */
  function placeMargin() {
    var paper = $('#paper');
    $$('.feelicon, .note', paper).forEach(function (el) { el.remove(); });
    $$('[data-feel]', paper).forEach(function (ln) {
      var f = ln.dataset.feel.split('|'), el = document.createElement('div');
      el.className = 'feelicon'; el.style.top = (ln.offsetTop + ln.offsetHeight / 2 - 26) + 'px';
      el.innerHTML = '<img src="../img/emotions/' + f[0] + '.png" alt="">' + esc(f[1]);
      paper.appendChild(el);
    });
    $$('[data-note]', paper).forEach(function (ln) {
      var el = document.createElement('div');
      el.className = 'note'; el.style.top = ln.offsetTop + 'px'; el.title = ln.dataset.note; el.textContent = '✎';
      el.setAttribute('role', 'img'); el.setAttribute('aria-label', ln.dataset.note);
      paper.appendChild(el);
    });
  }
  placeMargin(); addEventListener('resize', placeMargin);
  if (document.fonts) document.fonts.ready.then(placeMargin);

  /* ---------- the song with the red X ---------- */
  var SONG = [      // [start s, who, words]: made-up lyrics
    [0.0, 'all', 'Flour on the counter and the clock on the wall,'],
    [3.2, 'all', 'Somebody open up the door for us all!'],
    [6.4, 'rosa', 'I had a plan and it fell on the floor,'],
    [9.6, 'theo', 'So knock, knock, knock on a brand new door.'],
    [12.8, 'rosa', 'Will it be sweet? Will it be fine?'],
    [16.0, 'theo', 'One tray at a time, one tray at a time.'],
    [19.2, 'all', 'Open the door! Open the door!']
  ];
  var SONG_LEN = 23.2, NOTES = [60, 64, 67, 72, 67, 64, 65, 69, 72, 69, 65, 62, 67, 71, 74, 71, 67, 64, 60, 64, 67, 72, 76, 72, 67, 60, 64, 67, 72, 67, 64, 60];
  var song = { me: 'theo', playing: false, t0: 0, raf: 0, ctx: null, nodes: [] };
  $('#lyrics').innerHTML = SONG.map(function (l, k) { return '<div class="lyr ' + l[1] + '" data-k="' + k + '"><span class="who">' + l[1].toUpperCase() + '</span>' + esc(l[2]) + '</div>'; }).join('');
  function mineAt(who) { return who === 'all' || who === song.me; }
  function tick() {
    var t = song.playing ? (song.ctx.currentTime - song.t0) : 0, cur = -1;
    SONG.forEach(function (l, k) { if (t >= l[0] - 0.3) cur = k; });
    if (t > SONG_LEN) { stopSong(); return; }
    $$('#lyrics .lyr').forEach(function (el, k) { el.classList.toggle('lit', k === cur); el.classList.toggle('dimmed', cur >= 0 && k !== cur); });
    var who = cur >= 0 ? SONG[cur][1] : null, red = $('#redxOn').checked && song.playing && who && !mineAt(who);
    $('#redx').hidden = !red; $('#sing').hidden = !(song.playing && who && mineAt(who) && $('#redxOn').checked);
    $('#songPos').style.width = Math.min(100, t / SONG_LEN * 100) + '%';
    $('#songTime').textContent = '0:' + String(Math.floor(t)).padStart(2, '0');
    if (song.playing) song.raf = requestAnimationFrame(tick);
  }
  function tone(ctx, midi, at, dur, gain) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur + 0.05); song.nodes.push(o);
  }
  function playSong() {
    var AC = window.AudioContext || window.webkitAudioContext;
    song.ctx = song.ctx || (AC ? new AC() : null);
    if (!song.ctx) return;
    song.ctx.resume(); song.nodes = [];
    var t0 = song.ctx.currentTime + 0.15, beat = 0.4;
    song.t0 = t0;
    for (var b = 0; b * beat < SONG_LEN; b++) {
      tone(song.ctx, NOTES[b % NOTES.length], t0 + b * beat, 0.5, 0.09);
      if (b % 2 === 0) tone(song.ctx, NOTES[(b >> 3) * 8 % NOTES.length] - 24, t0 + b * beat, 0.7, 0.07);
    }
    song.playing = true; $('#songPlay').textContent = '■ Stop'; tick();
  }
  function stopSong() {
    song.playing = false; cancelAnimationFrame(song.raf);
    song.nodes.forEach(function (o) { try { o.stop(); } catch (e) {} }); song.nodes = [];
    $('#songPlay').textContent = '▶ Play'; $('#redx').hidden = true; $('#sing').hidden = true;
    $$('#lyrics .lyr').forEach(function (el) { el.classList.remove('lit', 'dimmed'); });
    $('#songPos').style.width = '0'; $('#songTime').textContent = '0:00';
  }
  $('#songPlay').onclick = function () { if (song.playing) stopSong(); else playSong(); };
  $$('#songMe button').forEach(function (b) { b.onclick = function () { song.me = b.dataset.me; pressed(b.parentNode, b); }; });

  /* ---------- React to That! (a few of Colleen's announcements) ---------- */
  var FEEL = {
    excited: ['Excited', '21_cheering', 'big smile, arms up, jumping, clapping'],
    sad: ['Sad', '12_disappointed_slump', 'shoulders drooping, frowning, looking down, moving slowly'],
    panic: ['Scared', '34_terrified_panic', 'wide eyes, stepping back, hands over mouth, body tense'],
    annoyed: ['Annoyed', '06_annoyed_cross_arms', 'eye roll, flat mouth, arms crossed, a big sigh'],
    stunned: ['Surprised', '08_shocked_gasp', 'wide eyes, open mouth, eyebrows up, a sudden jump back'],
    embarrassed: ['Embarrassed', '10_shy_blushing', 'looking down, covering your face, an awkward smile'],
    proud: ['Proud', '16_proud_confident', 'standing tall, a confident smile, hands on hips'],
    relieved: ['Relieved', '32_calm_open_arms', 'a deep sigh, shoulders relaxing, hand over your heart, a smile'],
    confused: ['Confused', '07_confused_questioning', 'head tilted, one eyebrow up, scratching your head, looking around']
  };
  var BANK = [
    ['Everybody gets free ice cream!', 'excited'], ['The field trip has been canceled.', 'sad'], ['There’s a spider crawling up your back!', 'panic'],
    ['You have to start the whole project over.', 'annoyed'], ['I just saw a real dinosaur outside!', 'stunned'], ['You have toilet paper stuck to your shoe.', 'embarrassed'],
    ['You got a perfect score on the hardest test!', 'proud'], ['The missing dog was found, and she’s okay!', 'relieved'], ['The instructions say to put the square inside the circle.', 'confused']
  ];
  var rx = { kind: 'show', k: -1, busy: false };
  function pic(id, extra, tag) {
    var f = FEEL[id]; tag = tag || 'div';
    return '<' + tag + ' class="feel ' + (extra || '') + '"' + (tag === 'button' ? ' data-f="' + id + '"' : '') + '><img src="../img/emotions/' + f[1] + '.png" alt=""><b>' + f[0] + '</b>' + (tag === 'button' ? '' : '<span class="how">' + f[2] + '</span>') + '</' + tag + '>';
  }
  function others(id) { var ks = Object.keys(FEEL).filter(function (k) { return k !== id; }); ks.sort(function () { return Math.random() - 0.5; }); return ks.slice(0, 2); }
  function reactNext() {
    if (rx.busy) return;
    rx.busy = true; rx.k = (rx.k + 1) % BANK.length;
    var a = BANK[rx.k], f = a[1], showMe = $('#showMe').checked && rx.kind === 'show';
    $('#rNext').disabled = true;
    $('#rBody').innerHTML = showMe ? '<p class="small muted">Show Me: here is the feeling first.</p><div class="feel-pics">' + pic(f) + '</div>' : '';
    $('#rAnn').textContent = '🔊 Listen…';
    say(a[0]).then(function () {
      $('#rAnn').textContent = a[0];
      if (rx.kind === 'show') {
        $('#rBody').innerHTML = '<div class="go">React!</div>' + (showMe ? '<div class="feel-pics">' + pic(f) + '</div>' : '');
        setTimeout(function () {
          $('#rBody').innerHTML = '<p class="head" style="margin-top:4px">What fits?</p><div class="feel-pics">' + pic(f, 'right') + '</div>' +
            '<p class="small" style="margin-top:12px">Did your face show it?</p><div class="row" style="justify-content:center"><button class="btn small">Yes</button><button class="btn small">Some</button><button class="btn small">Not yet</button></div>';
          $$('#rBody .row .btn').forEach(function (b) { b.onclick = function () { $$('#rBody .row .btn').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
          rx.busy = false; $('#rNext').disabled = false; $('#rNext').textContent = '▶ Next';
        }, 2600);
      } else {
        var opts = [f].concat(others(f)).sort(function () { return Math.random() - 0.5; });
        $('#rBody').innerHTML = '<p class="head">Which feeling fits?</p><div class="feel-pics">' + opts.map(function (o) { return pic(o, '', 'button'); }).join('') + '</div>';
        $$('#rBody button.feel').forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.f === f;
            $$('#rBody button.feel').forEach(function (x) { x.classList.add(x.dataset.f === f ? 'right' : 'wrong'); x.disabled = true; });
            $('#rBody').insertAdjacentHTML('beforeend', '<p class="head" style="margin-top:10px">' + (ok ? '✓ Yes! ' : 'This one fits: ') + FEEL[f][0] + '.</p><p class="small muted">' + FEEL[f][2] + '</p>');
          };
        });
        rx.busy = false; $('#rNext').disabled = false; $('#rNext').textContent = '▶ Next';
      }
    });
  }
  $('#rNext').onclick = reactNext;
  $$('[data-kind]').forEach(function (b) { b.onclick = function () { rx.kind = b.dataset.kind; pressed(b.parentNode, b); }; });

  /* ---------- bows: chime, then GO ---------- */
  var BOWS = [['Ensemble', '#e8a317', 'stage right'], ['Friends', '#1f8a5a', 'stage left'], ['Rosa and June', '#d9363e', 'stage right'], ['Theo', '#7a4ad8', 'stage left']];
  var bows = { timer: [], ctx: null };
  function chime(bell) {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    var ctx = bows.ctx = bows.ctx || new AC(); ctx.resume();
    [bell ? 784 : 1047, bell ? 1175 : 1319].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + i * (bell ? 0 : 0.18);
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(bell ? 0.25 : 0.12, at + 0.01); g.gain.exponentialRampToValueAtTime(0.001, at + (bell ? 1.6 : 0.9));
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 1.8);
    });
  }
  function goStop() { bows.timer.forEach(clearTimeout); bows.timer = []; $('#goStop').hidden = true; $('#goStart').disabled = false; var g = $('#goBox'); g.style.background = ''; g.innerHTML = '<div><div class="head" style="font-size:1.2em">Rehearse the bows</div><p class="small" style="opacity:.8">Sample groups: Ensemble, Friends, Rosa and June, Theo</p></div>'; }
  $('#goStart').onclick = function () {
    var g = $('#goBox'); this.disabled = true; $('#goStop').hidden = false;
    BOWS.forEach(function (b, i) {
      var at = i * 6500;
      bows.timer.push(setTimeout(function () { chime(false); g.style.background = '#1d1a2e'; g.innerHTML = '<div><div class="small" style="opacity:.8">Get ready</div><div class="head" style="font-size:1.8em;color:' + b[1] + '">' + b[0] + '</div><div class="small">from ' + b[2] + '</div></div>'; }, at));
      bows.timer.push(setTimeout(function () { chime(true); g.style.background = b[1]; g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); g.innerHTML = '<div><div class="go">GO</div><div class="head" style="font-size:1.4em">' + b[0] + '</div><div>Walk on from ' + b[2] + ' and bow</div></div>'; }, at + 4000));
    });
    bows.timer.push(setTimeout(function () { goStop(); g.innerHTML = '<div><div class="head" style="font-size:1.5em">🎶 Now the whole Company dances the finale</div><p class="small" style="opacity:.8">Then the Company bow, crew included.</p></div>'; }, BOWS.length * 6500 + 1500));
  };
  $('#goStop').onclick = goStop;

  /* ---------- progress table + mastery checks ---------- */
  var KIDS = [['Maya R.', 'Theo', 86, ''], ['Jordan T.', 'Rosa', 92, ''], ['Sam L.', 'June', 41, 'Scene 4 under 60% after 3 tries'], ['Ana P.', 'Ensemble', 74, ''], ['Eli W.', 'Ensemble', 23, '"Sugar Rush" rated 😟']];
  $('#progRows').innerHTML = KIDS.map(function (k) {
    return '<tr><td><b>' + k[0] + '</b><div class="small muted">' + k[1] + '</div></td><td><div class="row" style="flex-wrap:nowrap;gap:8px"><div class="meter' + (k[2] < 50 ? ' low' : '') + '"><i style="width:' + k[2] + '%"></i></div><span class="small">' + k[2] + '%</span></div></td><td class="small">' + (k[3] ? '⚠️ ' + esc(k[3]) : '<span class="muted">-</span>') + '</td></tr>';
  }).join('');
  $$('.chk').forEach(function (c) { c.onclick = function () { var on = !c.classList.contains('on'); c.classList.toggle('on', on); c.textContent = on ? '✓' : ''; c.setAttribute('aria-pressed', on ? 'true' : 'false'); }; });

  /* ---------- the announcement pop-up ---------- */
  var pop = $('#popup'), popFrom = null;
  function closePop() { if (pop.hidden) return; pop.hidden = true; if (synth) synth.cancel(); if (popFrom) popFrom.focus(); }
  $('#annDemo').onclick = function () { popFrom = this; pop.hidden = false; $('#popOk').focus(); };
  $('#popOk').onclick = closePop;
  $('#popSay').onclick = function () { say($('#popH').textContent + ' ' + $('.popup p').textContent); };
  pop.onclick = function (e) { if (e.target === pop) closePop(); };
})();
