/* asl.cool/theatre: real voices for every line (Colleen, 2026-10-21: ElevenLabs voices for every role once MTI says yes, and students recording
   their own lines; "as students record themselves saying their own lines, everyone can hear those recordings as they rehearse").
   Each line plays, in order of preference: a classmate's recording, the ElevenLabs version, the device's own voice. A student hears their own
   recording of their own lines at once (from this device), which is video self-modeling for the ear. Recordings go live for everyone unless the
   teacher turns on checking first; the teacher can take any one down.
   Line ids are a short hash of the line (speaker + start of the text), so nothing readable reaches the server's list. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  function hash(str) {      // cyrb53: a short, stable id for a line
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ('00000000' + (h2 >>> 0).toString(16)).slice(-8) + ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
  }
  var ix = { lines: {} }, ixP = null, playing = null;
  var V = T.Voices = {
    id: function (it) { return hash(T.lineKey(it)); },
    load: function () { if (!ixP) ixP = Store.voiceIndex().then(function (d) { ix = d || { lines: {} }; return ix; }); return ixP; },
    refresh: function () { ixP = null; return V.load(); },
    /* the audio for a line: my own fresh recording (this device), else a classmate's, else ElevenLabs */
    source: function (it, mine) {
      var h = V.id(it), e = ix.lines[h] || {};
      return Store.local.get('myrec:' + h).then(function (own) {
        if (own && mine) return { own: own };
        if (e.rec) return { h: h, src: 'rec', ver: e.rec.at };
        if (e.tts) return { h: h, src: 'tts', ver: e.tts };
        return null;
      });
    },
    has: function (it) { var e = ix.lines[V.id(it)]; return e ? (e.rec ? 'rec' : e.tts ? 'tts' : null) : null; },
    /* say a line: real audio when there is some, else the device voice. volume: for lines over the music */
    say: function (it, charId, mine, opts) {
      opts = opts || {};
      return V.load().then(function () { return V.source(it, mine); }).then(function (s) {
        if (!s) return T.Speech.say(LineCheck.spoken(it.text), charId, opts);
        var bytes = s.own ? Promise.resolve(s.own) : Store.getVoice(T.key, s.h, s.src, s.ver);
        return bytes.then(function (b) {
          if (!b) return T.Speech.say(LineCheck.spoken(it.text), charId, opts);
          return new Promise(function (done) {
            var url = URL.createObjectURL(new Blob([b])), a = new Audio(url), fin = false;
            a.playbackRate = Math.max(0.7, Math.min(1.3, T.prefs.rate || 1));
            var end = function () { if (fin) return; fin = true; URL.revokeObjectURL(url); if (playing === stop) playing = null; done(); };
            var stop = function () { a.pause(); end(); };
            playing = stop; a.onended = end; a.onerror = end;
            a.play().catch(end);
          });
        }).catch(function () { return T.Speech.say(LineCheck.spoken(it.text), charId, opts); });
      });
    },
    stop: function () { if (playing) playing(); }
  };
  var oldStop = T.Speech.stop;
  T.Speech.stop = function () { V.stop(); oldStop(); };

  /* ---------- Students: Record my lines ---------- */
  T.recordScene = function (scene) {
    var src = T.scriptScene(scene), me = T.me;
    T.setBar('Scene ' + scene.num + ' · Record', '#/lines/' + scene.id);
    if (!me.id) { app.innerHTML = '<div class="card"><p>Recording needs your name on the cast list. Ask your teacher.</p></div>'; return; }
    if (!window.MediaRecorder || !navigator.mediaDevices) { app.innerHTML = '<div class="card"><p>This device cannot record. Try a Chromebook or an iPad.</p></div>'; return; }
    var mine = src.items.filter(function (it) { return it.type === 'line' && T.isMine(it.who, scene, me.chars); }), at = 0, rec = null, chunks = [], take = null, timer = null;
    if (!mine.length) { app.innerHTML = '<div class="card"><p>You have no lines in this scene.</p></div>'; return; }
    V.load();
    function draw(msg) {
      var it = mine[at], h = V.id(it), st = V.has(it);
      Store.local.get('myrec:' + h).then(function (own) {
        app.innerHTML = '<div class="card"><p class="muted">Line ' + (at + 1) + ' of ' + mine.length + ' · ' + T.chip(me.chars[0]) + '</p>' +
          '<p class="big" style="font-size:1.45em;line-height:1.4">' + esc(it.text) + '</p>' +
          '<p class="small">' + (st === 'rec' ? sym('✅') + 'Your class hears a recording of this line.' : own ? sym('📱') + 'Your recording is saved on this device.' : sym('🎙️') + 'Not recorded yet.') + '</p>' +
          '<div class="row" style="margin:12px 0">' + (rec ? '<button class="btn primary mic" id="stop">' + icon('mic') + 'Stop</button>' : '<button class="btn primary" id="go">' + icon('mic') + (own || take ? 'Record again' : 'Record') + '</button>') +
          '<button class="btn" id="model">' + icon('speak') + 'Hear it first</button>' + (take || own ? '<button class="btn" id="mine">' + icon('play') + 'Play mine</button>' : '') + '</div>' +
          (take ? '<div class="row"><button class="btn good" id="keep">' + icon('check') + 'Keep it</button><button class="btn quiet" id="redo">Try again</button></div>' : '') +
          (msg ? '<p class="fb ' + (/not|could/i.test(msg) ? 'miss' : 'pass') + '">' + esc(msg) + '</p>' : '') + '</div>' +
          '<div class="row" style="justify-content:center"><button class="round" id="pv" aria-label="Last line"' + (at ? '' : ' disabled') + '>' + icon('prev') + '</button><b>' + (at + 1) + ' / ' + mine.length + '</b><button class="round" id="nx" aria-label="Next line"' + (at < mine.length - 1 ? '' : ' disabled') + '>' + icon('next') + '</button></div>' +
          '<p class="muted small center">Say it the way your character would. Up to 25 seconds. Your class will hear it when they rehearse.</p>';
        var $ = function (id) { return document.getElementById(id); };
        if ($('go')) $('go').onclick = start;
        if ($('stop')) $('stop').onclick = stopRec;
        $('model').onclick = function () { T.Speech.stop(); V.say(it, me.chars[0], false); };
        if ($('mine')) $('mine').onclick = function () { var b = take ? take.bytes : own; if (b) { var a = new Audio(URL.createObjectURL(new Blob([b]))); a.play(); } };
        if ($('keep')) $('keep').onclick = keep;
        if ($('redo')) $('redo').onclick = function () { take = null; start(); };
        $('pv').onclick = function () { if (at) { at--; take = null; draw(); } };
        $('nx').onclick = function () { if (at < mine.length - 1) { at++; take = null; draw(); } };
      });
    }
    function start() {
      T.Speech.stop();
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
        var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); });
        chunks = []; rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); }); clearTimeout(timer);
          new Blob(chunks, { type: rec.mimeType }).arrayBuffer().then(function (b) { rec = null; take = { bytes: b }; draw(); new Audio(URL.createObjectURL(new Blob([b]))).play().catch(function () {}); });
        };
        rec.start(); timer = setTimeout(stopRec, 25000); draw();
      }).catch(function () { rec = null; draw('The microphone is not allowed. Ask your teacher to turn it on for this site.'); });
    }
    function stopRec() { if (rec && rec.state === 'recording') rec.stop(); }
    function keep() {
      var it = mine[at], h = V.id(it), b = take.bytes;
      Store.local.set('myrec:' + h, b);      // I hear my own at once on this device
      Store.sendRecording(T.key, h, me.id, b).then(function (d) {
        take = null; V.refresh();
        var msg = d.live ? 'Saved! Your class will hear it.' : 'Saved! Your teacher will check it, then your class hears it.';
        if (at < mine.length - 1) { at++; draw(msg); } else draw(msg + ' That was your last line in this scene.');
      }).catch(function (e) { draw(e.message || 'It did not send. It is saved on this device; try Keep again with Wi-Fi.'); });
    }
    T.cleanup.push(function () { stopRec(); });
    draw();
  };

  /* ---------- Teacher: Voices & recordings ---------- */
  var MODELS = [['eleven_multilingual_v2', 'Best quality'], ['eleven_flash_v2_5', 'Faster, about half the cost']];
  function allLines() {
    var out = [];
    T.O().scenes.forEach(function (sc) { var src = T.scriptScene(sc); if (src) src.items.forEach(function (it) { if (it.type === 'line') out.push({ it: it, scene: sc, h: V.id(it) }); }); });
    return out;
  }
  function voiceFor(it, map) {      // the character's ElevenLabs voice; group lines (ALL, CLIQUES…) use the group voice
    var ids = T.labelChars(it.who).filter(function (c) { return c !== '*'; });
    if (ids.length === 1 && T.charById(ids[0]) && T.charById(ids[0]).group !== 'ensemble') return map[ids[0]] || null;      // a character waits for its own voice
    return map.__group || (ids[0] && map[ids[0]]) || null;      // ALL, CLIQUES, the chorus groups: the group voice
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.voices = function () {
    T.setBar('Voices & recordings', '#/teacher');
    app.innerHTML = '<p class="muted">Loading…</p>';
    Promise.all([V.refresh(), Store.pendingList(T.proof).catch(function () { return []; })]).then(function (r) { page(r[0], r[1]); });
  };
  function page(index, pending, msg) {
    var lines = allLines(), byH = {}; lines.forEach(function (l) { byH[l.h] = l; });
    var rec = lines.filter(function (l) { var e = index.lines[l.h]; return e && e.rec; }).length, tts = lines.filter(function (l) { var e = index.lines[l.h]; return e && e.tts; }).length;
    var none = lines.filter(function (l) { return !index.lines[l.h]; }).length;
    var cfg = T.show.eleven = T.show.eleven || { voices: {}, model: 'eleven_multilingual_v2', ok: false }, key = T.ls('xiKey') || '';
    var people = {}; (T.show.cast || []).forEach(function (a) { people[a.id] = a.name; });
    var chars = T.O().characters.filter(function (c) { return lines.some(function (l) { return T.labelChars(l.it.who).indexOf(c.id) >= 0; }); });
    var need = lines.filter(function (l) { var e = index.lines[l.h]; return !(e && e.tts) && voiceFor(l.it, cfg.voices); }), chars2 = need.reduce(function (a, l) { return a + T.pronounce(LineCheck.spoken(l.it.text)).length; }, 0);
    app.innerHTML = (msg ? '<p class="card">' + esc(msg) + '</p>' : '') +
      '<div class="card"><h2>' + sym('🔊') + 'Every line, ' + lines.length + ' in all</h2><p><b>' + rec + '</b> recorded by students · <b>' + tts + '</b> made with ElevenLabs · <b>' + none + '</b> use the device voice.</p>' +
      '<p class="muted small">Students rehearse with a classmate’s recording first, then ElevenLabs, then the device voice. Students record in Practice Lines › a scene › Record my lines.</p></div>' +
      '<div class="card"><h3>Students’ recordings</h3><label class="switch"><span><b>Check recordings before others hear them</b><br><span class="muted small">Off: a recording is in everyone’s rehearsals right away, and you can take any one down here.</span></span><input type="checkbox" id="chk"' + (index.check ? ' checked' : '') + '></label>' +
      (pending.length ? pending.slice().reverse().slice(0, 80).map(function (p) {
        var l = byH[p.h];
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(people[p.actor] || 'A student') + '</b> ' + (p.live ? '<span class="tag">everyone hears it</span>' : '<span class="tag">waiting for you</span>') + '<br><span class="small">' + (l ? 'Scene ' + l.scene.num + ': ' + esc(l.it.text.slice(0, 80)) : '(a line that changed)') + '</span></span>' +
          '<button class="btn small" data-play="' + p.h + '|' + p.actor + '">' + icon('play') + 'Play</button>' + (p.live ? '' : '<button class="btn small primary" data-ok="' + p.h + '|' + p.actor + '">OK</button>') + '<button class="btn small quiet" data-rm="' + p.h + '|' + p.actor + '">' + (p.live ? 'Take down' : 'Remove') + '</button></div>';
      }).join('') : '<p class="muted">No recordings yet.</p>') + '</div>' +
      '<div class="card"><h3>ElevenLabs voices</h3>' +
      '<label class="switch"><span><b>I have permission from Music Theatre International</b> to make audio of the script for my cast.</span><input type="checkbox" id="mti"' + (cfg.ok ? ' checked' : '') + '></label>' +
      '<label class="f">Your ElevenLabs API key <span class="muted small">(kept on this computer only)</span><input id="xk" type="password" autocomplete="off" value="' + esc(key) + '" placeholder="From elevenlabs.io › your profile › API keys"></label>' +
      '<div class="row"><button class="btn" id="lv"' + (key ? '' : ' disabled') + '>Load my voices</button><label class="f" style="margin:0">Quality<select id="md">' + MODELS.map(function (m) { return '<option value="' + m[0] + '"' + (cfg.model === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div id="vmap"></div>' +
      '<p style="margin-top:12px">' + need.length + ' lines still to make, about <b>' + chars2.toLocaleString() + ' characters</b>' + (cfg.model === 'eleven_flash_v2_5' ? ' (about ' + Math.round(chars2 / 2).toLocaleString() + ' credits)' : ' (about the same number of credits)') + '.</p>' +
      '<div class="row"><button class="btn primary" id="mk"' + (cfg.ok && key && need.length ? '' : ' disabled') + '>Make the missing lines</button><span class="muted small" id="mkst"></span></div>' +
      '<p class="muted small">Names are said the way “How words are said” spells them (Teacher mode › Script). Only the script’s words are sent to ElevenLabs, never students’ names.</p></div>';
    var $ = function (id) { return document.getElementById(id); };
    $('chk').onchange = function (e) { Store.setVoiceCheck(T.proof, e.target.checked).then(function () { T.toast(e.target.checked ? 'New recordings wait for your OK' : 'New recordings go live at once'); }); };
    app.querySelectorAll('[data-play]').forEach(function (b) { b.onclick = function () { var x = b.dataset.play.split('|'); Store.getPending(T.key, T.proof, x[0], x[1]).then(function (buf) { new Audio(URL.createObjectURL(new Blob([buf]))).play(); }).catch(function (e) { T.toast(e.message); }); }; });
    app.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { var x = b.dataset.ok.split('|'); Store.approve(T.proof, x[0], x[1]).then(T.teacherPages.voices); }; });
    app.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { if (!confirm('Take this recording down?')) return; var x = b.dataset.rm.split('|'); Store.reject(T.proof, x[0], x[1]).then(T.teacherPages.voices); }; });
    $('mti').onchange = function (e) { cfg.ok = e.target.checked; T.saveShow('Saved').then(function () { page(index, pending); }); };
    $('xk').onchange = function (e) { T.ls('xiKey', e.target.value.trim()); page(index, pending); };
    $('md').onchange = function (e) { cfg.model = e.target.value; T.saveShow('Saved').then(function () { page(index, pending); }); };
    var showMap = function (voices) {
      var opts = function (sel) { return '<option value="">Choose…</option>' + voices.map(function (v) { return '<option value="' + esc(v.voice_id) + '"' + (sel === v.voice_id ? ' selected' : '') + '>' + esc(v.name) + (v.labels && v.labels.accent ? ' · ' + esc(v.labels.accent) : '') + '</option>'; }).join(''); };
      $('vmap').innerHTML = '<table class="tbl" style="margin-top:10px"><thead><tr><th>Character</th><th>Voice</th><th></th></tr></thead><tbody>' +
        chars.concat([{ id: '__group', name: 'Group lines (ALL, CLIQUES…)' }]).map(function (c) {
          return '<tr><td>' + (c.id === '__group' ? esc(c.name) : T.chip(c.id)) + '</td><td><select data-vc="' + c.id + '">' + opts(cfg.voices[c.id]) + '</select></td><td><button class="btn small" data-pre="' + c.id + '">' + icon('play') + 'Sample</button></td></tr>';
        }).join('') + '</tbody></table>';
      app.querySelectorAll('[data-vc]').forEach(function (s) { s.onchange = function () { if (s.value) cfg.voices[s.dataset.vc] = s.value; else delete cfg.voices[s.dataset.vc]; T.saveShow('Voice saved'); }; });
      app.querySelectorAll('[data-pre]').forEach(function (b) { b.onclick = function () { var v = voices.find(function (x) { return x.voice_id === cfg.voices[b.dataset.pre]; }); if (v && v.preview_url) new Audio(v.preview_url).play(); else T.toast('Choose a voice first.'); }; });
    };
    $('lv').onclick = function () {
      fetch('https://' + 'api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': T.ls('xiKey') } }).then(function (r) { if (!r.ok) throw new Error('ElevenLabs said ' + r.status + '. Check the key.'); return r.json(); })
        .then(function (d) { showMap(d.voices || []); }).catch(function (e) { T.toast(e.message, 5000); });
    };
    $('mk').onclick = function () {
      if (!confirm('Make ' + need.length + ' lines with ElevenLabs (about ' + chars2.toLocaleString() + ' characters)?')) return;
      var st = $('mkst'), done = 0, stop = false, btn = this; btn.disabled = true; btn.textContent = 'Making…';
      st.innerHTML = '<button class="btn small quiet" id="halt">Stop</button>'; $('halt').onclick = function () { stop = true; };
      need.reduce(function (p, l) {
        return p.then(function () {
          if (stop) return;
          var vid = voiceFor(l.it, cfg.voices);
          return fetch('https://' + 'api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(vid) + '?output_format=mp3_44100_64', {
            method: 'POST', headers: { 'xi-api-key': T.ls('xiKey'), 'content-type': 'application/json', accept: 'audio/mpeg' },
            body: JSON.stringify({ text: T.pronounce(LineCheck.spoken(l.it.text)), model_id: cfg.model })
          }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('ElevenLabs said ' + r.status + ': ' + t.slice(0, 120)); }); return r.arrayBuffer(); })
            .then(function (b) { return Store.putVoice(T.key, T.proof, l.h, 'tts', b, Date.now().toString(36)); })
            .then(function () { done++; st.firstChild && (st.lastChild.textContent = ''); st.insertAdjacentText('beforeend', ' ' + done + ' of ' + need.length); });
        });
      }, Promise.resolve()).then(function () { T.teacherPages.voices(); T.toast(done + ' lines made'); }).catch(function (e) { T.toast(e.message, 6000); T.teacherPages.voices(); });
    };
    if (key && Object.keys(cfg.voices).length) $('lv').click();
  }
})();
