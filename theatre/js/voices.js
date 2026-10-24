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
  var MODELS = [['eleven_v3', 'Most expressive: follows the tone notes'], ['eleven_multilingual_v2', 'Steady (no tone notes)'], ['eleven_flash_v2_5', 'Faster, about half the cost (no tone notes)']];
  /* the tone of a line (Colleen 2026-10-24: "inflection notes and get the tone right for each line. some lines are sarcastic"), as ElevenLabs v3
     audio tags like [sarcastic] [whispers]: the teacher's own note (T.show.tones[line id]); else the acting note in the line's parentheses,
     like "(sarcastically)"; else the feeling icon beside the line on the page, if it is for this character. '' = said plainly. */
  var TAG = { uninterested: 'bored', shocked: 'surprised', shushing: 'whispers', whispering: 'whispers', shouting: 'shouting', laughing: 'laughs', 'exhausted sigh': 'sighs', sighing: 'sighs' };
  var tagOf = function (word) { var w = String(word || '').toLowerCase().trim(); if (/^(quietly|softly)$/.test(w)) return '[whispers]'; return '[' + (TAG[w] || w.replace(/ically$/, 'ic').replace(/ily$/, 'y').replace(/(\w{3})ly$/, '$1')) + ']'; };      // sarcastically → sarcastic, angrily → angry
  var emoAll = null, emo = function () { return emoAll || (emoAll = T.Emotions.all()); };      // the feeling icons, read once per page
  function autoTone(it, scene) {
    var paren = [], m, re = /\(([^)]{2,40})\)/g;
    while ((m = re.exec(it.text || ''))) { var p = m[1].trim(); if (!/[A-Z]{2,}/.test(p) && !/^to\b|^at\b|^re\b|^beat\b|^pause\b|^then\b/i.test(p) && p.split(/\s+/).length <= 3) paren.push(tagOf(p.replace(/^(a little|very|so)\s+/i, ''))); }
    if (paren.length) return paren.slice(0, 2).join(' ');
    if (!T.Emotions || !T.Pages) return '';
    var bs = T.Pages.rawBoxes ? (it.boxes || (it.box ? [it.box] : [])) : [], ids = T.labelChars(it.who || '');
    var near = emo().filter(function (e) { return bs.some(function (b) { return b.n === e.n && e.y >= b.y - 14 && e.y <= b.y + b.h + 14; }) && (!(e.who || []).length || (e.who || []).some(function (c) { return ids.indexOf(c) >= 0; })); });
    var icon = near[0] && T.Emotions.ICON[near[0].icon];
    return icon ? tagOf(icon.name || icon.label || '') : '';
  }
  /* suggested tones (Colleen 2026-10-24: "i don't want the majority of lines to be said plainly"): imported from a tone guide (a CSV, see
     importTones), kept by line id only, as T.show.toneSugg[id] = [tags, strength]. Her own choice always wins; ✓ Looks right makes it hers. */
  var sugg = function (h) { return (T.show.toneSugg || {})[h]; };
  function toneOf(l) { var t = (T.show.tones || {})[l.h], g = sugg(l.h); return t != null ? t : g ? g[0] : autoTone(l.it, l.scene); }
  /* the words sent for a line, when the script reader got them wrong ("> >.", a tempo marking): kept on this computer only, never on the server */
  var fixes = function () { try { return JSON.parse(T.ls('sayText') || '{}'); } catch (e) { return {}; } };
  var wordsOf = function (l) { var f = fixes()[l.h]; return f != null ? f : LineCheck.spoken(l.it.text); };
  V.toneOf = toneOf;
  function allLines() {      // every spoken line: dialogue, and lines spoken inside songs (for Lines for AAC; the guide tracks already have them in rehearsal)
    var out = [];
    T.O().scenes.forEach(function (sc) {
      var src = T.scriptScene(sc); if (!src) return;
      src.items.forEach(function (it) {
        if (it.type === 'line') out.push({ it: it, scene: sc, h: V.id(it) });
        if (it.type === 'song') (it.lyrics || []).forEach(function (l) { if (l.spoken && l.who && String(l.text || '').trim()) out.push({ it: l, scene: sc, h: V.id(l), inSong: true }); });
      });
    });
    var seen = {};      // a line the script reader found both in the scene and inside the song is one line (made, and paid for, once)
    return out.filter(function (l) { if (seen[l.h]) return false; seen[l.h] = 1; return true; });
  }
  /* the voices for a line (Colleen 2026-10-24: group lines as "a small chorus"): one character, their voice; a group (JOCKS), ALL, or several
     names (TROY, GABRIELLA), up to three voices together: the named characters' or the group's own voice first, then the chorus voices */
  var CHORUS = ['__chorus1', '__chorus2', '__chorus3'];
  function voicesFor(it, map) {
    var all = T.labelChars(it.who), ids = all.filter(function (c) { return c !== '*'; });
    if (ids.length === 1 && all.length === 1 && T.charById(ids[0]) && T.charById(ids[0]).group !== 'ensemble') return map[ids[0]] ? [map[ids[0]]] : [];      // a character waits for its own voice
    var out = ids.map(function (c) { return map[c]; }).filter(Boolean);
    var crowd = all.indexOf('*') >= 0 || ids.some(function (c) { var x = T.charById(c); return !x || x.group === 'ensemble'; });      // ALL or a group: the chorus joins; named characters together: just their voices
    if (crowd) CHORUS.concat(['__group']).forEach(function (k) { if (map[k]) out.push(map[k]); });
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 3);
  }
  V.voicesFor = voicesFor;
  /* match the ElevenLabs voices to the characters by the names they were saved under ("HSM Troy", "HSM Ms. Darbus", "HSM Chorus 2") */
  function matchByName(voices, map) {
    var norm = function (s) { return String(s || '').toLowerCase().replace(/^hsm\s*[-:·]?\s*/, '').replace(/^(ms|mr|mrs)\.?\s+/, '').replace(/[^a-z0-9 ]/g, '').trim(); };
    var n = 0;
    voices.forEach(function (v) {
      var nm = norm(v.name), m = nm.match(/^chorus\s*(\d)$/);
      if (m && +m[1] >= 1 && +m[1] <= 3) { if (!map['__chorus' + m[1]]) { map['__chorus' + m[1]] = v.voice_id; n++; } return; }
      var c = T.O().characters.find(function (c) { return [c.short, c.name].concat(c.aliases || []).some(function (x) { var k = norm(x); return k && (k === nm || k.split(' ').pop() === nm || k.split(' ')[0] === nm); }); });
      if (c && !map[c.id]) { map[c.id] = v.voice_id; n++; }
    });
    return n;
  }
  /* three takes of a group line, layered a moment apart and spread left to right, as one sound file (WAV) */
  function mixChorus(bufs) {
    var ctx = T.audioCtx();
    return Promise.all(bufs.map(function (b) { return ctx.decodeAudioData(b.slice(0)); })).then(function (abs) {
      var rate = 44100, offs = [0, 0.05, 0.11], gains = [0.85, 0.72, 0.68], pans = [0, -0.45, 0.45];
      var len = Math.ceil(Math.max.apply(null, abs.map(function (a, i) { return a.duration + offs[i]; })) * rate) + rate * 0.1;
      var off = new OfflineAudioContext(2, len, rate);
      abs.forEach(function (a, i) { var s = off.createBufferSource(), g = off.createGain(), p = off.createStereoPanner(); s.buffer = a; g.gain.value = gains[i]; p.pan.value = pans[i]; s.connect(g); g.connect(p); p.connect(off.destination); s.start(offs[i]); });
      return off.startRendering();
    }).then(function (ab) {      // 16-bit stereo WAV
      var n = ab.length, out = new ArrayBuffer(44 + n * 4), d = new DataView(out), w = function (o, s) { for (var i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); d.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true); d.setUint32(24, ab.sampleRate, true); d.setUint32(28, ab.sampleRate * 4, true); d.setUint16(32, 4, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 4, true);
      var L = ab.getChannelData(0), R = ab.getChannelData(1), o = 44;
      for (var i = 0; i < n; i++) { [L[i], R[i]].forEach(function (x) { x = Math.max(-1, Math.min(1, x)); d.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }); }
      return out;
    });
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
    emoAll = null;
    var cfg = T.show.eleven = T.show.eleven || { voices: {}, model: 'eleven_v3', ok: false }, key = T.ls('xiKey') || '';
    var people = {}; (T.show.cast || []).forEach(function (a) { people[a.id] = a.name; });
    var chars = T.O().characters.filter(function (c) { return lines.some(function (l) { return T.labelChars(l.it.who).indexOf(c.id) >= 0; }); });
    var need = lines.filter(function (l) { var e = index.lines[l.h]; return !(e && e.tts) && voicesFor(l.it, cfg.voices).length; }), chars2 = need.reduce(function (a, l) { return a + cost(l, cfg); }, 0);
    app.innerHTML = (msg ? '<p class="card">' + esc(msg) + '</p>' : '') +
      '<div class="card"><h2>' + sym('🔊') + 'Every line, ' + lines.length + ' in all</h2><p><b>' + rec + '</b> recorded by Company members · <b>' + tts + '</b> made with ElevenLabs · <b>' + none + '</b> use the device voice.</p>' +
      '<p class="muted small">Company members rehearse with a castmate’s recording first, then ElevenLabs, then the device voice. Company members record in Practice Lines › a scene › Record my lines.</p></div>' +
      '<div class="card"><h3>Company members’ recordings</h3><label class="switch"><span><b>Check recordings before others hear them</b><br><span class="muted small">Off: a recording is in everyone’s rehearsals right away, and you can take any one down here.</span></span><input type="checkbox" id="chk"' + (index.check ? ' checked' : '') + '></label>' +
      (pending.length ? pending.slice().reverse().slice(0, 80).map(function (p) {
        var l = byH[p.h];
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(people[p.actor] || 'A student') + '</b> ' + (p.live ? '<span class="tag">everyone hears it</span>' : '<span class="tag">waiting for you</span>') + '<br><span class="small">' + (l ? 'Scene ' + l.scene.num + ': ' + esc(l.it.text.slice(0, 80)) : '(a line that changed)') + '</span></span>' +
          '<button class="btn small" data-play="' + p.h + '|' + p.actor + '">' + icon('play') + 'Play</button>' + (p.live ? '' : '<button class="btn small primary" data-ok="' + p.h + '|' + p.actor + '">OK</button>') + '<button class="btn small quiet" data-rm="' + p.h + '|' + p.actor + '">' + (p.live ? 'Take down' : 'Remove') + '</button></div>';
      }).join('') : '<p class="muted">No recordings yet.</p>') + '</div>' +
      '<div class="card"><h3>ElevenLabs voices</h3>' +
      '<label class="switch"><span><b>I have permission from Music Theatre International</b> to make audio of the script for my cast.</span><input type="checkbox" id="mti"' + (cfg.ok ? ' checked' : '') + '></label>' +
      '<label class="f">Your ElevenLabs API key <span class="muted small">(kept on this computer only)</span><input id="xk" type="password" autocomplete="off" value="' + esc(key) + '" placeholder="From elevenlabs.io › your profile › API keys"></label>' +
      '<div class="row"><button class="btn" id="lv"' + (key ? '' : ' disabled') + '>Load my voices</button><label class="f" style="margin:0">Quality<select id="md">' + MODELS.map(function (m) { return '<option value="' + m[0] + '"' + (cfg.model === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="margin:0">Feelings<select id="clr">' + CLARITY.map(function (c) { return '<option value="' + c[0] + '"' + (clarity() === +c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="muted small">Feelings: “A little clearer” sends each line’s feeling one step stronger than its Strength slider (normal goes as “very”), and never past “very” unless you chose “extremely”. Lines already made keep their old sound until you make them again.</p>' +
      '<div id="vmap"></div>' +
      '<p style="margin-top:12px">' + need.length + ' lines still to make, about <b>' + chars2.toLocaleString() + ' credits</b> if every one were made (tone notes included). The next step checks everything before anything is spent.</p>' +
      '<div class="row"><button class="btn primary" id="mk"' + (cfg.ok && key && need.length ? '' : ' disabled') + '>Check, then make lines…</button><span class="muted small" id="mkst"></span></div>' +
      '<p class="muted small">Names are said the way “How words are said” spells them (Teacher mode › Script). Only the script’s words are sent to ElevenLabs, never Company members’ names.</p></div>' + toneCard(lines, index, cfg);
    var $ = function (id) { return document.getElementById(id); };
    $('chk').onchange = function (e) { Store.setVoiceCheck(T.proof, e.target.checked).then(function () { T.toast(e.target.checked ? 'New recordings wait for your OK' : 'New recordings go live at once'); }); };
    app.querySelectorAll('[data-play]').forEach(function (b) { b.onclick = function () { var x = b.dataset.play.split('|'); Store.getPending(T.key, T.proof, x[0], x[1]).then(function (buf) { new Audio(URL.createObjectURL(new Blob([buf]))).play(); }).catch(function (e) { T.toast(e.message); }); }; });
    app.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { var x = b.dataset.ok.split('|'); Store.approve(T.proof, x[0], x[1]).then(T.teacherPages.voices); }; });
    app.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { if (!confirm('Take this recording down?')) return; var x = b.dataset.rm.split('|'); Store.reject(T.proof, x[0], x[1]).then(T.teacherPages.voices); }; });
    $('mti').onchange = function (e) { cfg.ok = e.target.checked; T.saveShow('Saved').then(function () { page(index, pending); }); };
    $('xk').onchange = function (e) { T.ls('xiKey', e.target.value.trim()); page(index, pending); };
    $('clr').onchange = function (e) { cfg.clarity = +e.target.value; T.saveShow('Feelings setting saved').then(function () { var y = window.scrollY; page(index, pending); window.scrollTo(0, y); }); };
    $('md').onchange = function (e) { cfg.model = e.target.value; T.saveShow('Saved').then(function () { page(index, pending); }); };
    var showMap = function (voices) {
      var opts = function (sel) { return '<option value="">Choose…</option>' + voices.map(function (v) { return '<option value="' + esc(v.voice_id) + '"' + (sel === v.voice_id ? ' selected' : '') + '>' + esc(v.name) + (v.labels && v.labels.accent ? ' · ' + esc(v.labels.accent) : '') + '</option>'; }).join(''); };
      $('vmap').innerHTML = '<table class="tbl" style="margin-top:10px"><thead><tr><th>Character</th><th>Voice</th><th></th></tr></thead><tbody>' +
        chars.concat([{ id: '__chorus1', name: 'Chorus voice 1' }, { id: '__chorus2', name: 'Chorus voice 2' }, { id: '__chorus3', name: 'Chorus voice 3' }]).map(function (c) {
          return '<tr><td>' + (/^__/.test(c.id) ? esc(c.name) + ' <span class="muted small">(group lines: up to 3 voices together)</span>' : T.chip(c.id)) + '</td><td><select data-vc="' + c.id + '">' + opts(cfg.voices[c.id]) + '</select></td><td><button class="btn small" data-pre="' + c.id + '">' + icon('play') + 'Sample</button></td></tr>';
        }).join('') + '</tbody></table>';
      app.querySelectorAll('[data-vc]').forEach(function (s) { s.onchange = function () { if (s.value) cfg.voices[s.dataset.vc] = s.value; else delete cfg.voices[s.dataset.vc]; T.saveShow('Voice saved'); }; });
      app.querySelectorAll('[data-pre]').forEach(function (b) { b.onclick = function () { var v = voices.find(function (x) { return x.voice_id === cfg.voices[b.dataset.pre]; }); if (v && v.preview_url) new Audio(v.preview_url).play(); else T.toast('Choose a voice first.'); }; });
    };
    $('lv').onclick = function () {
      fetch('https://' + 'api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': T.ls('xiKey') } }).then(function (r) { if (!r.ok) throw new Error('ElevenLabs said ' + r.status + '. Check the key.'); return r.json(); })
        .then(function (d) {
          var vs = d.voices || [], n = matchByName(vs, cfg.voices);      // voices saved as "HSM Troy" and so on go to their characters by themselves
          if (n) T.saveShow(n + ' voice' + (n === 1 ? '' : 's') + ' matched to characters by name').then(function () { page(index, pending, n + ' voices matched by their names. Check them below, then Make the missing lines.'); setTimeout(function () { showMap(vs); }, 0); });
          else showMap(vs);
        }).catch(function (e) { T.toast(e.message, 5000); });
    };
    $('mk').onclick = function () { preflight(lines, index, cfg, function () { T.teacherPages.voices(); }); };
    /* the tone of each line: check it, change it, make that line again */
    var tsel = $('tch'); if (tsel) tsel.onchange = function () { toneChar = tsel.value; page(index, pending); setTimeout(function () { var c = $('tonecard'); if (c) c.scrollIntoView(); }, 0); };
    var again = function (msg) { var y = window.scrollY; page(index, pending); window.scrollTo(0, y); if (msg) T.toast(msg, 6000); };
    $('texp').onclick = function () { exportTones(lines); };
    $('timp').onclick = function () { $('tfile').value = ''; $('tfile').click(); };
    $('tfile').onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var d = document.createElement('dialog'); d.className = 'tone-dlg';
        d.innerHTML = '<h2>Import “' + esc(f.name) + '”</h2><p>How should its tones come in?</p>' +
          '<label class="switch"><span><b>As suggestions</b><br><span class="muted small">Each shows “suggested” until you tap ✓ Looks right or change it. Your own choices stay.</span></span><input type="radio" name="tas" value="s" checked></label>' +
          '<label class="switch"><span><b>As my tones</b><br><span class="muted small">They replace the tones you chose for those lines.</span></span><input type="radio" name="tas" value="m"></label>' +
          (toneChar ? '<p class="muted small">If the file has no Character column, lines said by more than one character go to ' + esc((T.charById(toneChar) || {}).name || '') + ' (the character chosen now).</p>' : '') +
          '<p class="err" id="tim"></p><div class="row end"><button class="btn quiet" id="tix">Cancel</button><button class="btn primary" id="tio">Import</button></div>';
        document.body.appendChild(d); d.showModal();
        d.querySelector('#tix').onclick = function () { d.close(); d.remove(); };
        d.querySelector('#tio').onclick = function () {
          try {
            var r = importTones(txt, lines, d.querySelector('[name=tas]:checked').value === 'm');
            d.close(); d.remove();
            T.saveShow('Tones imported').then(function () { again(r.found + ' lines got a tone.' + (r.blank ? ' ' + r.blank + ' rows had no tone and were left as they were.' : '') + (r.missed.length ? ' ' + r.missed.length + ' rows did not match a line (first: “' + r.missed[0] + '”).' : '')); });
          } catch (e) { d.querySelector('#tim').textContent = e.message; }
        };
      });
    };
    var keep = function (h) { var g = sugg(h); if (!g) return; (T.show.tones = T.show.tones || {})[h] = g[0]; var L3 = T.show.toneLevel = T.show.toneLevel || {}; if (g[1] === 3) delete L3[h]; else L3[h] = g[1]; };
    app.querySelectorAll('[data-okt]').forEach(function (b) { b.onclick = function () { keep(b.dataset.okt); T.saveShow('Kept').then(function () { again(); }); }; });
    if ($('tall')) $('tall').onclick = function () { lines.forEach(function (l) { if (T.labelChars(l.it.who).indexOf(toneChar) >= 0 && !checked(l)) keep(l.h); }); T.saveShow('All kept').then(function () { again(); }); };
    app.querySelectorAll('[data-words]').forEach(function (b) { b.onclick = function () {
      var h = b.dataset.words, l = byH[h], f = fixes(), now = wordsOf(l);
      var v = prompt('The words ElevenLabs says for this line (the script itself does not change). Empty = back to the script’s words.', now);
      if (v == null) return; v = v.trim();
      if (!v || v === LineCheck.spoken(l.it.text)) delete f[h]; else f[h] = v;
      T.ls('sayText', JSON.stringify(f)); again('Words saved on this computer. ↻ Make again to hear them.');
    }; });
    app.querySelectorAll('[data-tone]').forEach(function (inp) { inp.onchange = function () { var T2 = T.show.tones = T.show.tones || {}; var v = inp.value.trim(); if (v && !/^\[/.test(v)) v = v.split(/\s*,\s*/).map(function (w) { return '[' + w.replace(/[\[\]]/g, '') + ']'; }).join(' '); T2[inp.dataset.tone] = v; inp.value = v; if (typeof sends === 'function') sends(inp.dataset.tone); T.saveShow('Tone saved: make the line again to hear it'); }; });
    var sends = function (h) { var sd = app.querySelector('[data-sends="' + h + '"]'), inp = app.querySelector('[data-tone="' + h + '"]'), r = app.querySelector('[data-lvl="' + h + '"]'); if (sd) sd.textContent = inp && inp.value ? 'Sends: ' + withLevel(inp.value, bump(r ? +r.value : 3)) : ''; };
    var toggle = function (inp, tag) { var cur = (inp.value.match(/\[[^\]]+\]/g) || []); var k = cur.indexOf(tag); if (k >= 0) cur.splice(k, 1); else cur.push(tag); inp.value = cur.join(' '); inp.onchange(); sends(inp.dataset.tone); };      // tones combine: [sarcastic] [slows down]
    app.querySelectorAll('[data-chip]').forEach(function (b) { b.onclick = function () { var h = b.dataset.chip.split('|')[0], tag = b.dataset.chip.split('|')[1]; toggle(app.querySelector('[data-tone="' + h + '"]'), tag); }; });
    app.querySelectorAll('[data-lvl]').forEach(function (r) {
      var h = r.dataset.lvl, show = function () { var n = app.querySelector('[data-lvlname="' + h + '"]'), sd = app.querySelector('[data-sends="' + h + '"]'), inp = app.querySelector('[data-tone="' + h + '"]'); if (n) n.textContent = LEVEL_NAME[+r.value]; if (sd) sd.textContent = inp && inp.value ? 'Sends: ' + withLevel(inp.value, bump(+r.value)) : ''; };
      r.oninput = show;
      r.onchange = function () { var L3 = T.show.toneLevel = T.show.toneLevel || {}; if (+r.value === 3) delete L3[h]; else L3[h] = +r.value; var T2 = T.show.tones = T.show.tones || {}; if (T2[h] == null) T2[h] = toneOf(byH[h]); show(); T.saveShow('Strength saved: make the line again to hear it'); };
    });
    app.querySelectorAll('[data-more]').forEach(function (b) { b.onclick = function () {
      var inp = app.querySelector('[data-tone="' + b.dataset.more + '"]'), l = byH[b.dataset.more];
      var have = function (t) { return (inp.value.match(/\[[^\]]+\]/g) || []).indexOf('[' + t + ']') >= 0; };
      var d = document.createElement('dialog'); d.className = 'tone-dlg';
      d.innerHTML = '<h2>Tone of this line</h2><p class="muted">“' + esc(LineCheck.spoken(l.it.text)) + '”</p><p class="muted small">Tap to add or take away; they combine. ElevenLabs also follows other plain words you type in brackets.</p>' +
        '<div class="row" style="margin:6px 0"><input id="tnew" placeholder="Add your own tone word, like “whiny” or “like a game show host”" class="grow"><button type="button" class="btn small" id="tadd">Add</button></div>' +
        (myTones().length ? [['My words', myTones()]] : []).concat(TONES).map(function (g) { return '<h3 style="margin:10px 0 4px">' + esc(g[0]) + '</h3><div class="row" style="flex-wrap:wrap;gap:4px">' + g[1].map(function (t) { return '<button type="button" class="btn small" data-t="' + esc(t) + '" aria-pressed="' + have(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>'; }).join('') +
        '<div class="row end" style="margin-top:12px"><button class="btn quiet" id="tclr">Said plainly</button><button class="btn primary" id="tok">Done</button></div>';
      document.body.appendChild(d); d.showModal();
      d.querySelectorAll('[data-t]').forEach(function (x) { x.onclick = function () { toggle(inp, '[' + x.dataset.t + ']'); x.setAttribute('aria-pressed', have(x.dataset.t)); }; });
      d.querySelector('#tclr').onclick = function () { inp.value = ''; inp.onchange(); d.close(); d.remove(); };
      d.querySelector('#tadd').onclick = function () {      // a new word: kept in the list for every line, and added to this one
        var w = d.querySelector('#tnew').value.replace(/[\[\]]/g, '').trim().toLowerCase(); if (!w) return;
        var L2 = T.show.toneWords = T.show.toneWords || []; if (L2.indexOf(w) < 0) L2.push(w);
        if (!have(w)) toggle(inp, '[' + w + ']'); else T.saveShow('Saved');
        d.close(); d.remove(); b.click();
      };
      d.querySelector('#tnew').onkeydown = function (e) { if (e.key === 'Enter') d.querySelector('#tadd').click(); };
      d.querySelector('#tok').onclick = function () { d.close(); d.remove(); };
      d.addEventListener('cancel', function () { d.remove(); });
    }; });
    app.querySelectorAll('[data-again]').forEach(function (b) { b.onclick = function () { var l = byH[b.dataset.again]; if (!voicesFor(l.it, cfg.voices).length) { T.toast('No ElevenLabs voice for this line yet: tap Load my voices in the ElevenLabs section above, and check that this character has a voice in its list.', 7000); var lv = document.getElementById('lv'); if (lv) lv.scrollIntoView({ block: 'center' }); return; } b.disabled = true; b.textContent = 'Making…'; makeLine(l, cfg).then(function () { return V.refresh(); }).then(function () { b.disabled = false; b.textContent = '↻ Make again'; var hb = app.querySelector('[data-hear="' + l.h + '"]'); if (hb) hb.disabled = false; T.toast('Made. Playing it now; tap ▶ to hear it again.'); return V.say(l.it, null, false); }).catch(function (e) { b.disabled = false; b.textContent = '↻ Make again'; T.toast(e.message, 6000); }); }; });
    app.querySelectorAll('[data-hear]').forEach(function (b) { b.onclick = function () { var l = byH[b.dataset.hear]; V.say(l.it, null, false); }; });
    if (key && Object.keys(cfg.voices).length) $('lv').click();
  }
  /* one line: its voice(s), its tone note (v3 only: other models would read the brackets out loud), a chorus mixed for group lines, saved sealed */
  /* exactly what is sent for a line, and what it costs (one credit a character, for each voice) */
  function sentText(l, cfg) { var tone = cfg.model === 'eleven_v3' ? withLevel(toneOf(l), bump(levelOf(l.h))) : ''; return (tone ? tone + ' ' : '') + T.pronounce(wordsOf(l)); }
  function cost(l, cfg) { var n = sentText(l, cfg).length * Math.max(1, voicesFor(l.it, cfg.voices).length); return cfg.model === 'eleven_flash_v2_5' ? Math.ceil(n / 2) : n; }
  function makeLine(l, cfg) {
    var lvl = levelOf(l.h), vids = voicesFor(l.it, cfg.voices), text = sentText(l, cfg);
    var settings = cfg.model === 'eleven_v3' ? { stability: lvl >= 4 ? 0 : lvl <= 2 ? 1 : 0.5 } : undefined;
    var say = function (vid) {
      return fetch('https://' + 'api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(vid) + '?output_format=mp3_44100_64', {
        method: 'POST', headers: { 'xi-api-key': T.ls('xiKey'), 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify(settings ? { text: text, model_id: cfg.model, voice_settings: settings } : { text: text, model_id: cfg.model })
      }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('ElevenLabs said ' + r.status + ': ' + t.slice(0, 120)); }); return r.arrayBuffer(); });
    };
    return vids.reduce(function (q, v) { return q.then(function (got) { return say(v).then(function (b) { return got.concat([b]); }); }); }, Promise.resolve([]))      // one at a time: the plan's rate limit
      .then(function (bs) { return bs.length > 1 ? mixChorus(bs) : bs[0]; })
      .then(function (b) { return Store.putVoice(T.key, T.proof, l.h, 'tts', b, Date.now().toString(36)); });
  }
  /* say any words in a character's ElevenLabs voice, to test how a name is said (Colleen 2026-10-24: "i can't get it to say darbus right":
     the Hear buttons in How words are said use the device's voice, not ElevenLabs'). Played, not saved. */
  V.elevenVoices = function () { var cfg = T.show.eleven || {}; return T.ls('xiKey') && cfg.voices ? cfg.voices : null; };
  V.tryWords = function (text, charId) {
    var cfg = T.show.eleven || {}, vid = (cfg.voices || {})[charId];
    if (!T.ls('xiKey')) return Promise.reject(new Error('Add your ElevenLabs key first (Teacher mode › Voices & recordings).'));
    if (!vid) return Promise.reject(new Error('That character has no ElevenLabs voice yet.'));
    return fetch('https://' + 'api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(vid) + '?output_format=mp3_44100_64', {
      method: 'POST', headers: { 'xi-api-key': T.ls('xiKey'), 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: text, model_id: cfg.model || 'eleven_v3' })
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('ElevenLabs said ' + r.status + ': ' + t.slice(0, 120)); }); return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (done) { var a = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/mpeg' }))); a.onended = done; a.onerror = done; a.play().catch(done); }); });
  };
  var toneChar = null;
  var CHIPS = ['[sarcastic]', '[excited]', '[whispers]', '[nervous]', '[annoyed]', '[sad]'];      // the quick ones on every line
  /* ElevenLabs v3 audio tags (Colleen 2026-10-24: "add more words to describe tone … anything elevenlabs will recognize"); v3 also follows
     other plain words in brackets, so the teacher can type her own */
  var TONES = [
    ['Happy feelings', ['happy', 'excited', 'thrilled', 'overjoyed', 'cheerful', 'delighted', 'giddy', 'proud', 'confident', 'hopeful', 'relieved', 'grateful', 'warm', 'loving', 'tender', 'sincere', 'amused', 'impressed', 'amazed', 'awestruck', 'inspired', 'triumphant', 'satisfied', 'content', 'friendly', 'encouraging', 'reassuring']],
    ['Hard feelings', ['sad', 'sorrowful', 'heartbroken', 'disappointed', 'crestfallen', 'regretful', 'guilty', 'ashamed', 'lonely', 'hurt', 'nervous', 'anxious', 'worried', 'scared', 'terrified', 'panicked', 'hesitant', 'unsure', 'embarrassed', 'awkward', 'shy', 'flustered', 'confused', 'puzzled', 'overwhelmed', 'stressed', 'defeated', 'resigned', 'tired', 'bored', 'uninterested']],
    ['Strong feelings', ['annoyed', 'irritated', 'frustrated', 'exasperated', 'impatient', 'angry', 'furious', 'outraged', 'indignant', 'defensive', 'jealous', 'envious', 'suspicious', 'skeptical', 'disbelieving', 'shocked', 'surprised', 'stunned', 'appalled', 'disgusted', 'offended', 'betrayed', 'desperate', 'pleading']],
    ['Attitude', ['sarcastic', 'dry', 'deadpan', 'flatly', 'mocking', 'teasing', 'playfully', 'mischievously', 'cheeky', 'sassy', 'smug', 'superior', 'condescending', 'snobby', 'bossy', 'dismissive', 'sweetly', 'sugary sweet', 'fake nice', 'innocently', 'dramatically', 'melodramatic', 'over the top', 'serious', 'stern', 'strict', 'firm', 'commanding', 'authoritative', 'determined', 'matter-of-fact', 'thoughtful', 'curious', 'calm', 'patient', 'gentle', 'casual', 'laid back', 'cool', 'eager', 'enthusiastic', 'competitive', 'conspiratorial', 'secretive', 'flirty', 'lovestruck']],
    ['Voice', ['whispers', 'whispering loudly', 'quietly', 'softly', 'under breath', 'muttering', 'mumbling', 'loudly', 'shouting', 'yelling', 'calling out', 'cheering', 'chanting', 'singsong', 'announcer voice', 'radio DJ voice', 'teacher voice', 'coach voice', 'sports announcer', 'storyteller voice', 'reading aloud', 'robotic', 'baby talk', 'out of breath', 'breathless', 'voice cracking', 'choked up', 'trembling voice', 'hoarse', 'nasal', 'deep voice', 'high-pitched', 'squeaky']],
    ['Reactions', ['laughs', 'laughs harder', 'starts laughing', 'chuckles', 'giggles', 'snickers', 'laughs nervously', 'laughing while talking', 'sighs', 'deep sigh', 'exhales', 'inhales sharply', 'gasps', 'gulps', 'scoffs', 'snorts', 'groans', 'grunts', 'huffs', 'tsk', 'sniffs', 'sniffles', 'crying', 'sobbing', 'clears throat', 'coughs', 'yawns', 'hums', 'whistles', 'woo', 'squeals']],
    ['Pace and timing', ['rushed', 'fast', 'rapid-fire', 'slowly', 'slows down', 'speeds up', 'drawn out', 'deliberately', 'one word at a time', 'stammers', 'stuttering', 'trailing off', 'hesitates', 'pause', 'short pause', 'long pause', 'dramatic pause', 'beat', 'jumping in', 'interrupting', 'cut off', 'all at once', 'overlapping']],
    ['Emphasis', ['emphatic', 'stressing every word', 'punchy', 'building excitement', 'getting louder', 'getting quieter', 'questioning', 'rhetorical question', 'exclaiming', 'like a secret', 'like an announcement', 'aside to the audience']]
  ];
  /* how strong (Colleen 2026-10-24: "a turn it up or down knob … a small happy excited or a jumping screaming excited"): 1 to 5, 3 = as written.
     The level's word goes before each feeling ([slightly excited], [extremely excited]); sounds and timing ([laughs], [pause]) stay as they are.
     It also sets v3's stability: strong lines are freer (0, Creative), soft ones steadier (1, Robust). */
  var LEVELS = [null, 'barely', 'slightly', '', 'very', 'extremely'], LEVEL_NAME = [null, 'barely', 'a little', 'normal', 'very', 'extremely'];
  var plain = {}; TONES.forEach(function (g) { if (/Reactions|Pace|Voice/.test(g[0])) g[1].forEach(function (t) { plain[t] = 1; }); });
  var levelOf = function (h) { var v = (T.show.toneLevel || {})[h]; if (v == null && (T.show.tones || {})[h] == null && sugg(h)) v = sugg(h)[1]; return v >= 1 && v <= 5 ? v : 3; };
  /* how clear the feelings are, for the whole show (Colleen 2026-10-24: the recordings are for students who find emotion, tone and faces hard;
     "slightly more expressive than a scene in a musical would be … not cartoonish not ridiculous but extra explicit"). It turns each line's
     strength word up one step when sent: normal goes as [very nervous], a little as [nervous]. 0 = as written; 1 = a little clearer (the
     default) stops at "very", so lines never reach "extremely" unless she chose it; 2 = much clearer may. The steadiness (stability) still
     follows her own strength, so the boost does not switch on v3's Creative mode, which can add odd sounds. */
  var CLARITY = [['0', 'As written'], ['1', 'A little clearer (for students who find feelings hard to read)'], ['2', 'Much clearer']];
  var clarity = function () { var c = (T.show.eleven || {}).clarity; return c == null ? 1 : +c; };
  function bump(v) { var c = clarity(); return !c ? v : c === 1 ? (v >= 4 ? v : v + 1) : Math.min(5, v + 1); }
  V.bump = bump;
  function withLevel(tone, lvl) {
    var w = LEVELS[lvl]; if (!w) return tone;
    return String(tone || '').replace(/\[([^\]]+)\]/g, function (m, t) { return plain[t.toLowerCase()] || /^(barely|slightly|very|extremely|a little)\b/i.test(t) ? m : '[' + w + ' ' + t + ']'; });
  }
  V.withLevel = withLevel;
  var myTones = function () { return (T.show.toneWords || []).slice(); };      // the teacher's own tone words (Add your own)
  V.TONES = TONES;
  /* ---------- checks before a run (Colleen 2026-10-24: "make sure that I don't run a whole bunch of lines with incorrect tones and waste a
     lot of credits … several checks before I execute a big project") ----------
     1. She picks what to make: one character, one scene, or everything still missing.
     2. Lines whose tone she has not checked, and lines whose words look wrong, are left out unless she ticks them in.
     3. The cost, her credits left (when her key may read them) and what is left after; a run that costs more than she has cannot start.
     4. A run starts with a few test lines (different characters and tones) and stops so she can listen; then it stops again after every
        batch. She can stop at any stop; nothing more is spent.
     5. A big run (over 2,000 credits) needs her to tick that she listened to test lines and they sound right. */
  function suspect(l) {      // words the script reader may have garbled: odd symbols, music words, a cut-off ending, too short, sung capitals
    if (fixes()[l.h] != null) return '';
    var w = LineCheck.spoken(l.it.text), letters = w.replace(/[^A-Za-z0-9]/g, '');
    if (/[<>{}|\\^~=_*#Ïï¨]/.test(w)) return 'odd symbols';
    if (/\b(a tempo|rit\.|rall\.|cresc\.|segue|vamp|underscore|fermata|colla voce)\b/i.test(w)) return 'music words in it';
    if (letters.length < 3 && !/^(no|oh|ok|me|hi|so|uh)$/i.test(letters)) return 'very short';
    if (letters.length > 12 && letters === letters.toUpperCase()) return 'sung words in capitals';
    if (/[A-Za-z]$/.test(w.trim())) return 'may be cut off';
    return '';
  }
  function credits() {
    return fetch('https://' + 'api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': T.ls('xiKey') } })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && d.character_limit != null ? { left: d.character_limit - d.character_count, limit: d.character_limit } : null; }).catch(function () { return null; });
  }
  function preflight(lines, index, cfg, after) {
    var todo = lines.filter(function (l) { return !made(l, index) && voicesFor(l.it, cfg.voices).length; });
    var chars = T.O().characters.filter(function (c) { return todo.some(function (l) { return T.labelChars(l.it.who).indexOf(c.id) >= 0; }); });
    var scenes = T.O().scenes.filter(function (sc) { return todo.some(function (l) { return l.scene === sc; }); });
    var noVoice = lines.filter(function (l) { return !made(l, index) && !voicesFor(l.it, cfg.voices).length; }).length;
    var acct = null, d = document.createElement('dialog'); d.className = 'tone-dlg';
    d.innerHTML = '<h2>Before making lines</h2><p class="muted">Nothing is spent until you tap Start. A run stops after a few test lines so you can listen, then after every batch.</p>' +
      '<div class="row"><label class="f grow">Whose lines<select id="pfc"><option value="">Everyone</option>' + chars.map(function (c) { return '<option value="' + c.id + '"' + (c.id === toneChar ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f grow">Which scene<select id="pfs"><option value="">Every scene</option>' + scenes.map(function (sc) { return '<option value="' + sc.id + '">Scene ' + sc.num + ' · ' + esc(sc.place) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="switch"><span>Include lines whose tone I have not checked yet <b id="pfu"></b></span><input type="checkbox" id="pfiu"></label>' +
      '<label class="switch"><span>Include lines whose words may be wrong <b id="pfw"></b></span><input type="checkbox" id="pfiw"></label>' +
      '<div class="row"><label class="f">Test lines first<select id="pft"><option value="3">3</option><option value="5" selected>5</option><option value="10">10</option></select></label><label class="f">Then stop to listen every<select id="pfb"><option value="10">10 lines</option><option value="25" selected>25 lines</option><option value="50">50 lines</option></select></label></div>' +
      '<div id="pfck"></div><div id="pfwl"></div>' +
      '<label class="switch" id="pfbig" hidden><span><b>I made a few test lines with these tones and listened: they sound right.</b><br><span class="muted small">Needed for a run over 2,000 credits.</span></span><input type="checkbox" id="pfok"></label>' +
      '<div class="row end"><button class="btn quiet" id="pfx">Cancel</button><button class="btn primary" id="pfgo">Start</button></div><div id="pfrun"></div>';
    document.body.appendChild(d); d.showModal();
    var $d = function (s) { return d.querySelector(s); }, run = [];
    var close = function () { d.close(); d.remove(); };
    d.addEventListener('cancel', function (e) { if (running) e.preventDefault(); else d.remove(); });
    var running = false;
    function pick() {
      var c = $d('#pfc').value, sc = $d('#pfs').value;
      var base = todo.filter(function (l) { return (!c || T.labelChars(l.it.who).indexOf(c) >= 0) && (!sc || l.scene.id === sc); });
      var unchecked = base.filter(function (l) { return !checked(l); }), odd = base.filter(function (l) { return suspect(l); });
      run = base.filter(function (l) { return ($d('#pfiu').checked || checked(l)) && ($d('#pfiw').checked || !suspect(l)); });
      var total = run.reduce(function (a, l) { return a + cost(l, cfg); }, 0), plainN = run.filter(function (l) { return !toneOf(l); }).length;
      $d('#pfu').textContent = '(' + unchecked.length + ')'; $d('#pfw').textContent = '(' + odd.length + ')';
      var ok = function (good, txt) { return '<li>' + (good ? '✅ ' : '⚠️ ') + txt + '</li>'; };
      var rest = acct ? acct.left - total : null;
      $d('#pfck').innerHTML = '<h3 style="margin:10px 0 4px">Checks</h3><ul class="plain" style="list-style:none;padding:0;margin:0;line-height:1.7">' +
        ok(cfg.model === 'eleven_v3', cfg.model === 'eleven_v3' ? 'Quality is “Most expressive”, so the tone notes are used.' : 'Quality is not “Most expressive”: the tone notes will NOT be used.') +
        '<li>🎭 Feelings: <b>' + esc(CLARITY[clarity()][1]) + '</b> (change it next to Quality).</li>' +
        ok(!noVoice, noVoice ? noVoice + ' lines have no voice yet and are not in this run.' : 'Every line has a voice.') +
        ok(!(unchecked.length && $d('#pfiu').checked), unchecked.length ? (($d('#pfiu').checked ? 'Includes ' : 'Leaves out ') + unchecked.length + ' lines whose tone you have not checked.') : 'You checked the tone of every line here.') +
        ok(!(odd.length && $d('#pfiw').checked), odd.length ? (($d('#pfiw').checked ? 'Includes ' : 'Leaves out ') + odd.length + ' lines whose words may be wrong (listed below; fix them with ✎ Words).') : 'No lines with odd-looking words.') +
        ok(!plainN, plainN ? plainN + ' lines will be said plainly (no tone).' : 'Every line has a tone.') +
        '<li>🧾 This run: <b>' + run.length + ' lines, about ' + total.toLocaleString() + ' credits</b>.</li>' +
        (acct ? ok(rest >= 0, 'Your ElevenLabs credits left: ' + acct.left.toLocaleString() + ' · after this run: <b>' + rest.toLocaleString() + '</b>' + (rest < 0 ? ' (not enough: choose fewer lines)' : '')) : '<li>ℹ️ Credits left could not be read. To see them here, give your API key the “User: Read” permission on elevenlabs.io.</li>') + '</ul>';
      $d('#pfwl').innerHTML = odd.length ? '<details><summary>Lines whose words may be wrong (' + odd.length + ')</summary><ul class="small">' + odd.map(function (l) { return '<li>Scene ' + l.scene.num + ', ' + esc(l.it.who) + ': “' + esc(LineCheck.spoken(l.it.text).slice(0, 70)) + '” <span class="muted">(' + suspect(l) + ')</span></li>'; }).join('') + '</ul></details>' : '';
      var big = total > 2000; $d('#pfbig').hidden = !big;
      $d('#pfgo').disabled = !run.length || (acct && rest < 0) || (big && !$d('#pfok').checked);
      $d('#pfgo').textContent = run.length ? 'Start: ' + Math.min(run.length, +$d('#pft').value) + ' test lines first' : 'Nothing to make';
    }
    ['#pfc', '#pfs', '#pfiu', '#pfiw', '#pft', '#pfb', '#pfok'].forEach(function (s) { $d(s).onchange = pick; });
    $d('#pfx').onclick = function () { close(); };
    pick(); credits().then(function (c) { acct = c; if (d.open && !running) pick(); });
    /* test lines first: spread over characters and tones, so one listen covers the most */
    function order(list, n) {
      var first = [], seenWho = {}, seenTone = {}, take = function (ok) { list.forEach(function (l) { var k = l.it.who, t = toneOf(l); if (first.length < n && first.indexOf(l) < 0 && ok(k, t)) { first.push(l); seenWho[k] = 1; seenTone[t] = 1; } }); };
      take(function (k, t) { return !seenWho[k] && !seenTone[t]; }); take(function (k) { return !seenWho[k]; }); take(function () { return true; });      // new voices and new tones first
      return first.concat(list.filter(function (l) { return first.indexOf(l) < 0; }));
    }
    $d('#pfgo').onclick = function () {
      running = true;
      var testN = +$d('#pft').value, batch = +$d('#pfb').value, q = order(run, testN), at = 0, spent = 0, stopNow = false;
      d.querySelectorAll('select,input,#pfgo,#pfx').forEach(function (x) { x.disabled = true; });
      var box = $d('#pfrun');
      function step(stopAt) {
        var made2 = [];
        box.innerHTML = '<p><b>Making…</b> <span id="pfn"></span></p><button class="btn small quiet" id="pfh">Stop</button>';
        $d('#pfh').onclick = function () { stopNow = true; };
        var go = function () {
          if (stopNow || at >= stopAt) return Promise.resolve();
          var l = q[at];
          return makeLine(l, cfg).then(function () { spent += cost(l, cfg); made2.push(l); at++; var n = $d('#pfn'); if (n) n.textContent = at + ' of ' + q.length + ' · about ' + spent.toLocaleString() + ' credits used'; return go(); });
        };
        go().then(function () { return V.refresh(); }).then(function () { listen(made2); }).catch(function (e) { box.innerHTML = '<p class="err">' + esc(e.message) + '</p><p>' + at + ' lines made (about ' + spent.toLocaleString() + ' credits). Nothing more will be made.</p><button class="btn" id="pfdone">Close</button>'; $d('#pfdone').onclick = function () { close(); after(); }; });
      }
      function listen(list) {
        var left = q.length - at;
        box.innerHTML = '<h3>' + (at <= testN ? 'Listen to the test lines' : 'Listen to this batch') + '</h3><p class="muted small">' + at + ' of ' + q.length + ' made, about ' + spent.toLocaleString() + ' credits used.' + (left ? ' Nothing more is spent until you tap Keep going.' : '') + '</p>' +
          list.map(function (l, i) { return '<div class="tone-row"><button type="button" class="btn small" data-pl="' + i + '">▶</button><div class="grow small"><b>' + esc(l.it.who) + '</b> ' + esc(withLevel(toneOf(l), bump(levelOf(l.h))) || '(plain)') + '<br>' + esc(wordsOf(l).slice(0, 90)) + '</div></div>'; }).join('') +
          '<div class="row end" style="margin-top:10px">' + (left ? '<button class="btn quiet" id="pfst">Something sounds wrong: stop here</button><button class="btn primary" id="pfkg">Sounds right: make the next ' + Math.min(batch, left) + '</button>' : '<button class="btn primary" id="pfdone">Done</button>') + '</div>';
        box.querySelectorAll('[data-pl]').forEach(function (b) { b.onclick = function () { T.Speech.stop(); V.say(list[+b.dataset.pl].it, null, false); }; });
        if ($d('#pfkg')) $d('#pfkg').onclick = function () { step(Math.min(q.length, at + batch)); };
        var fin = function () { T.Speech.stop(); close(); after(); T.toast(at + ' lines made, about ' + spent.toLocaleString() + ' credits.' + (q.length - at ? ' ' + (q.length - at) + ' were not made.' : ''), 7000); };
        if ($d('#pfst')) $d('#pfst').onclick = fin;
        if ($d('#pfdone')) $d('#pfdone').onclick = fin;
        box.scrollIntoView({ block: 'end' });
      }
      step(Math.min(q.length, testN));
    };
  }
  /* how far along: tones she has checked (her own, or a suggestion she said looks right) and lines made, for the show and one character */
  var checked = function (l) { return (T.show.tones || {})[l.h] != null; };
  var made = function (l, index) { var e = index.lines[l.h]; return !!(e && e.tts); };
  function bar(label, n, of, cls) { var pc = of ? Math.round(n / of * 100) : 0; return '<div class="pl"><span>' + label + '</span><b>' + n + ' of ' + of + ' · ' + pc + '%</b></div><div class="pb' + (cls ? ' ' + cls : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + of + '" aria-valuenow="' + n + '" aria-label="' + esc(label) + '"><i style="width:' + pc + '%"></i></div>'; }
  function toneCard(lines, index, cfg) {
    var chars = T.O().characters.filter(function (c) { return lines.some(function (l) { return T.labelChars(l.it.who).indexOf(c.id) >= 0; }); });
    if (!toneChar || !chars.some(function (c) { return c.id === toneChar; })) toneChar = chars[0] && chars[0].id;
    var linesOf = function (id) { return lines.filter(function (l) { return T.labelChars(l.it.who).indexOf(id) >= 0; }); };
    var mine = linesOf(toneChar), ch = T.charById(toneChar) || { name: '' }, fx = fixes();
    var open = mine.filter(function (l) { return !checked(l) && sugg(l.h); }).length, nSugg = Object.keys(T.show.toneSugg || {}).length;
    return '<div class="card" id="tonecard"><h3>' + sym('🎭') + 'The tone of each line</h3><p class="muted small">Each line is sent with a tone note in brackets, like [sarcastic] or [whispers] (only with “Most expressive”). A <span class="tag sugg">suggested</span> tone comes from a tone guide you imported; tap ✓ Looks right to keep it, or change it. Your own choices always win. Then ↻ Make again and ▶ listen.</p>' +
      (cfg.model !== 'eleven_v3' ? '<p class="err small">Pick “Most expressive” above so the tone notes are used.</p>' : '') +
      '<div class="tone-prog">' + bar('Whole show: tones checked', lines.filter(checked).length, lines.length) + bar('Whole show: lines made', lines.filter(function (l) { return made(l, index); }).length, lines.length, 'made') +
      bar(esc(ch.name) + ': tones checked', mine.filter(checked).length, mine.length) + bar(esc(ch.name) + ': lines made', mine.filter(function (l) { return made(l, index); }).length, mine.length, 'made') + '</div>' +
      '<div class="row"><button class="btn" id="timp">' + sym('⬆️') + 'Import a tone guide (CSV)</button><button class="btn quiet" id="texp">' + sym('⬇️') + 'Save all tones as a CSV</button><input type="file" id="tfile" accept=".csv,.tsv,.txt,text/csv" hidden></div>' +
      '<p class="muted small">' + (nSugg ? nSugg + ' lines have a suggested tone. ' : '') + 'A tone guide is a spreadsheet saved as CSV with a column for the line’s words and one for the tone (and, if you like, the character and the strength, 1 to 5 or “a little”, “very”). The words stay on this computer.</p>' +
      '<label class="f">Character<select id="tch">' + chars.map(function (c) { var L = linesOf(c.id), k = L.filter(checked).length; return '<option value="' + c.id + '"' + (c.id === toneChar ? ' selected' : '') + '>' + (k === L.length ? '✓ ' : '') + esc(c.name) + ' · ' + k + ' of ' + L.length + ' checked</option>'; }).join('') + '</select></label>' +
      (open ? '<div class="row"><button class="btn good" id="tall">✓ All ' + open + ' suggestions for ' + esc(ch.name) + ' look right</button></div>' : '') +
      mine.map(function (l) {
        var own = (T.show.tones || {})[l.h], g = sugg(l.h), t = toneOf(l), e = index.lines[l.h], fixed = fx[l.h] != null;
        var where = own != null ? '<span class="tag">✓ checked</span>' : g ? '<span class="tag sugg">suggested</span><button type="button" class="btn small good" data-okt="' + l.h + '">✓ Looks right</button>' : t ? '<span class="muted small">from the script</span>' : '';
        return '<div class="tone-row"><div class="grow"><span class="muted small">Scene ' + l.scene.num + (l.inSong ? ' · in a song' : '') + '</span><div>' + esc(wordsOf(l)) + (fixed ? ' <span class="muted small">(words fixed for ElevenLabs)</span>' : '') + '</div>' +
          '<div class="row" style="gap:4px;flex-wrap:wrap;margin-top:4px"><input data-tone="' + l.h + '" value="' + esc(t) + '" placeholder="said plainly" style="width:200px">' + where +
          CHIPS.map(function (c) { return '<button type="button" class="btn small quiet" data-chip="' + l.h + '|' + c + '">' + esc(c.slice(1, -1)) + '</button>'; }).join('') + '<button type="button" class="btn small" data-more="' + l.h + '">＋ More tones</button><button type="button" class="btn small quiet" data-words="' + l.h + '">✎ Words</button></div>' +
          '<div class="row tone-lvl" style="gap:8px;margin-top:4px"><label class="small">Strength <input type="range" min="1" max="5" step="1" data-lvl="' + l.h + '" value="' + levelOf(l.h) + '" aria-label="How strong"></label><span class="small" data-lvlname="' + l.h + '">' + LEVEL_NAME[levelOf(l.h)] + '</span>' +
          '<span class="muted small" data-sends="' + l.h + '">' + (t ? 'Sends: ' + esc(withLevel(t, bump(levelOf(l.h)))) : '') + '</span></div></div>' +
          '<div class="row" style="gap:4px"><button type="button" class="btn small" data-hear="' + l.h + '"' + (e && e.tts ? '' : ' disabled') + '>▶</button><button type="button" class="btn small" data-again="' + l.h + '">↻ Make again</button></div></div>';
      }).join('') + '</div>';
  }
  /* ---------- tone guides (Colleen 2026-10-24: "a bulk tone import feature so the complete CSV guide can be loaded into your app") ----------
     Reads a CSV (or tab-separated text pasted from a chat) and finds each row's line by its words, and its character when there is a column
     for it. Columns are found by their headings: the line ("Line", "Exact line…"), the tone ("Tone", "…tags…"), the character, the strength.
     Rows land as suggestions, or as her own tones when she chooses that. Nothing from the file is sent anywhere; only tags and line ids are saved. */
  function parseTable(txt) {
    txt = String(txt || '').replace(/^﻿/, '');
    var first = txt.split(/\r?\n/)[0] || '', sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && !cell) q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  var normT = function (s) { return String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').normalize('NFKD').replace(/[^a-z0-9]/g, ''); };
  var STRENGTH = { barely: 1, 'a little': 2, slightly: 2, little: 2, normal: 3, '': 3, medium: 3, very: 4, strong: 4, extremely: 5, 'very strong': 5 };
  function strengthOf(v) { v = String(v || '').toLowerCase().trim(); var n = parseInt(v, 10); if (n >= 1 && n <= 5) return n; return STRENGTH[v] != null ? STRENGTH[v] : 3; }
  function tagsOf(v) { v = String(v || '').trim(); if (!v || /^(plain|said plainly|none|-)$/i.test(v)) return ''; return /\[/.test(v) ? (v.match(/\[[^\]]+\]/g) || []).join(' ') : v.split(/\s*[,;]\s*/).filter(Boolean).map(function (w) { return '[' + w + ']'; }).join(' '); }
  function importTones(txt, lines, asMine) {
    var rows = parseTable(txt); if (rows.length < 2) throw new Error('That file has no rows.');
    var head = rows[0].map(function (h) { return h.toLowerCase().trim(); }), col = function (re, not) { for (var i = 0; i < head.length; i++) if (re.test(head[i]) && !(not && not.test(head[i]))) return i; return -1; };
    var cLine = col(/line|words|text|dialogue/, /number|tone|tag|status|#/), cTone = col(/tag|tone/, /strength|status|rationale/), cWho = col(/character|speaker|who|role/), cStr = col(/strength|level|intensity/);
    if (cLine < 0 || cTone < 0) throw new Error('The file needs a column called “Line” (the words) and one called “Tone”.');
    var who = function (l) { return T.labelChars(l.it.who).join(','); };
    var byText = {}; lines.forEach(function (l) { var k = normT(wordsOf(l)); (byText[k] = byText[k] || []).push(l); });
    var tones = T.show.tones = T.show.tones || {}, lv = T.show.toneLevel = T.show.toneLevel || {}, sg = T.show.toneSugg = T.show.toneSugg || {};
    var out = { found: 0, missed: [], blank: 0 };
    rows.slice(1).forEach(function (r) {
      var words = r[cLine] || '', k = normT(words), tag = tagsOf(r[cTone]), lvl = strengthOf(cStr >= 0 ? r[cStr] : ''), ids = cWho >= 0 && r[cWho] ? T.labelChars(r[cWho].trim()).join(',') : '';
      if (k.length < 2) return;
      var cand = byText[k] || lines.filter(function (l) { var t = normT(wordsOf(l)); return k.length >= 12 && (t.indexOf(k) === 0 || k.indexOf(t) === 0) && t.length >= 6; });
      if (ids) { var same = cand.filter(function (l) { return who(l) === ids; }); if (same.length) cand = same; }
      else if (cand.length > 1 && toneChar) { var his = cand.filter(function (l) { return T.labelChars(l.it.who).indexOf(toneChar) >= 0; }); if (his.length) cand = his; }      // no character column: the character on screen
      if (!cand.length) { out.missed.push(words.slice(0, 60)); return; }
      if (!tag) { out.blank++; return; }      // an empty tone in a guide is left alone (her wish: few lines said plainly)
      cand.forEach(function (l) {
        if (asMine) { tones[l.h] = tag; if (lvl === 3) delete lv[l.h]; else lv[l.h] = lvl; }
        else sg[l.h] = [tag, lvl];
        out.found++;
      });
    });
    return out;
  }
  function exportTones(lines) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Scene', 'Character', 'Line', 'Tone', 'Strength (1-5)', 'Checked']].concat(lines.map(function (l) { return [l.scene.num, l.it.who, wordsOf(l), toneOf(l), levelOf(l.h), checked(l) ? 'yes' : '']; }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv' })); a.download = (T.O().title || 'Show') + ' tones.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  V.importTones = importTones; V.parseTable = parseTable;
})();
