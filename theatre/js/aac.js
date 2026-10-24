/* asl.cool/theatre: Lines for AAC (Colleen 2026-10-24: "make it easy to copy and paste these lines into an aac", for students who use AAC devices,
   cast in roles where the timing of speech matters less: lines, not lyrics). One character at a time: every spoken line in show order (dialogue,
   and lines spoken inside songs), each with the words just before it (the cue), stage directions taken out (they are not said). Copy one line,
   copy them all, or save a text file, to paste into the student's AAC device. Lines that have an ElevenLabs recording can be downloaded as
   sound files too (the character's own voice, for devices that play recorded messages). The words come from the script imported on this
   device; nothing is sent anywhere. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var clean = function (s) { return LineCheck.spoken(s).replace(/\s*[—–-]{1,2}\s*$/, '—').trim(); };
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
    return out.filter(function (x) { return x.text; });
  }
  /* a character's lines (a group's lines count for its members), each with the line before it as the cue */
  function linesFor(c) {
    var all = spokenLines(), out = [];
    all.forEach(function (x, i) {
      if (x.ids.indexOf('*') >= 0) return;
      if (!T.isMine(x.who, x.scene, [c])) return;
      var prev = all[i - 1] && all[i - 1].scene === x.scene ? all[i - 1] : null;
      out.push({ x: x, cue: prev ? prev.text.split(/\s+/).slice(-6).join(' ') : '', cueWho: prev ? prev.who : '' });
    });
    return out;
  }
  /* roles that speak and never sing a line alone: easiest to play with an AAC device */
  function soloSung(c) {
    var n = 0;
    T.O().scenes.forEach(function (sc) { var src = T.scriptScene(sc); if (src) src.items.forEach(function (it) { if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (!l.spoken && l.who) { var ids = T.labelChars(l.who); if (ids.length === 1 && ids[0] === c) n++; } }); }); });
    return n;
  }
  var pick = null;
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.aac = function () {
    T.setBar('Lines for AAC', '#/teacher');
    if (!T.show.script) { app.innerHTML = '<p class="card">Import the script first (Teacher mode › Script).</p>'; return; }
    var O = T.O(), info = O.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return { c: c, n: linesFor(c.id).length, solo: soloSung(c.id) }; }).filter(function (x) { return x.n; });
    var easy = info.filter(function (x) { return !x.solo; }), rest = info.filter(function (x) { return x.solo; });
    if (!pick || !info.some(function (x) { return x.c.id === pick; })) pick = (easy[0] || info[0]).c.id;
    var L = linesFor(pick), ch = T.charById(pick), plain = L.map(function (l) { return l.x.text; }).join('\n');
    var opt = function (x) { return '<option value="' + x.c.id + '"' + (x.c.id === pick ? ' selected' : '') + '>' + esc(x.c.name) + ' · ' + x.n + ' line' + (x.n === 1 ? '' : 's') + (x.solo ? ' · sings ' + x.solo + ' solo line' + (x.solo === 1 ? '' : 's') : '') + '</option>'; };
    app.innerHTML = '<div class="card noprint"><h2>' + sym('💬') + 'Lines for AAC</h2><p class="muted">Every line a character says, in show order, ready to copy into an AAC device. Stage directions are taken out; the words just before each line are its cue.</p>' +
      '<label class="f">Character<select id="ach">' + (easy.length ? '<optgroup label="Lines, and no solo singing">' + easy.map(opt).join('') + '</optgroup>' : '') + '<optgroup label="Also sings solo lines">' + rest.map(opt).join('') + '</optgroup></select></label>' +
      '<div class="row"><button class="btn primary" id="call">' + sym('📋') + 'Copy all ' + L.length + ' lines</button><button class="btn" id="ctxt">' + sym('⬇️') + 'Save as a text file</button><button class="btn" id="aud" hidden>' + sym('🔊') + 'Save the recorded lines</button><button class="btn quiet" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<p class="muted small" id="amsg">Paste them into the device’s message list or a new page of buttons, one button per line, in order. Copy all puts one line on each row.</p></div>' +
      '<div class="card"><h3>' + T.chip(pick) + ' · ' + L.length + ' lines</h3>' + L.map(function (l, i) {
        var sc = l.x.scene, newScene = !i || L[i - 1].x.scene !== sc;
        return (newScene ? '<h4 style="margin:14px 0 4px">Scene ' + sc.num + ' · ' + esc(sc.place) + '</h4>' : '') +
          '<div class="aac-line"><span class="aac-n">' + (i + 1) + '</span><div class="grow">' + (l.cue ? '<div class="muted small">After ' + esc(l.cueWho || '') + ': “… ' + esc(l.cue) + '”</div>' : '<div class="muted small">Starts the scene</div>') +
          '<div class="aac-text">' + esc(l.x.text) + '</div>' + (l.x.inSong ? '<div class="muted small">' + sym('🎵') + 'Spoken during the song, over the music: keep it on time</div>' : '') + '</div>' +
          '<button class="btn small noprint" data-cp="' + i + '">' + sym('📋') + 'Copy</button></div>';
      }).join('') + '</div>';
    var copy = function (text, what) {
      var done = function () { T.toast(what + ' copied. Paste it into the AAC device.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); }); else { fallback(text); done(); }
    };
    function fallback(text) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); }
    document.getElementById('ach').onchange = function () { pick = this.value; T.teacherPages.aac(); };
    document.getElementById('call').onclick = function () { copy(plain, L.length + ' lines'); };
    app.querySelectorAll('[data-cp]').forEach(function (b) { b.onclick = function () { copy(L[+b.dataset.cp].x.text, 'Line ' + (+b.dataset.cp + 1)); }; });
    document.getElementById('ctxt').onclick = function () {
      var txt = ch.name + ' (' + O.title + ')\n\n' + L.map(function (l, i) { return (i + 1) + '. ' + l.x.text; }).join('\n') + '\n';
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = ch.short + ' lines.txt'; document.body.appendChild(a); a.click(); a.remove();
    };
    /* the ElevenLabs recordings of these lines, one sound file each, numbered in order (for devices that play recorded messages) */
    if (T.Voices) T.Voices.load().then(function () {
      var have = L.filter(function (l) { return l.x.it && T.Voices.has(l.x.it) === 'tts'; }), b = document.getElementById('aud'); if (!b || !have.length) return;
      b.hidden = false; b.innerHTML = sym('🔊') + 'Save the ' + have.length + ' recorded lines';
      b.onclick = function () {
        var m = document.getElementById('amsg'); b.disabled = true;
        have.reduce(function (p, l) {
          return p.then(function () {
            var i = L.indexOf(l);
            return T.Voices.source(l.x.it, false).then(function (src) { return src && src.src === 'tts' ? Store.getVoice(T.key, src.h, 'tts', src.ver) : null; }).then(function (bytes) {
              if (!bytes) return;
              var wav = new Uint8Array(bytes.slice ? bytes.slice(0, 4) : bytes)[0] === 0x52, a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: wav ? 'audio/wav' : 'audio/mpeg' })); a.download = ch.short + ' ' + ('0' + (i + 1)).slice(-2) + ' - ' + l.x.text.split(/\s+/).slice(0, 5).join(' ').replace(/[^\w’' -]/g, '') + (wav ? '.wav' : '.mp3');      // group lines are a chorus (WAV)
              document.body.appendChild(a); a.click(); a.remove(); m.textContent = 'Saved ' + (have.indexOf(l) + 1) + ' of ' + have.length + '…';
              return new Promise(function (ok) { setTimeout(ok, 350); });
            });
          });
        }, Promise.resolve()).then(function () { b.disabled = false; m.textContent = 'Saved ' + have.length + ' sound files, numbered in order.'; }).catch(function (e) { b.disabled = false; m.textContent = e.message || 'They could not be saved.'; });
      };
    });
  };
})();
