/* asl.cool/theatre: the curtain call (Colleen 2026-10-24: bows with "auditory and visual cuing for when each group enters", each performer sees
   "their bow as part of their overall track and who they're bowing with"; "fairly few groups"; entrances "alternate starting from sr"; and
   "bows should happen to some underscoring and then the megamix happens after everyone is on stage … we don't want bowing and clapping over
   the music performance").
   A few bow groups in the usual order (the Company groups, then supporting roles, then featured, then the leads), each walking on and bowing
   over the bow music (instrumental underscoring) when the group before them steps back; then the whole Company, on stage, performs the
   Megamix; then one Company bow with the crew in the line. Each group's moment is a time in the bow music (tapped by the teacher while it
   plays, or spread evenly), so the app can chime "get ready" and show a big GO.
   The bow music: the band track of any song, or a track the teacher uploads (stored as the track '__bows', 'performance').
   T.show.curtain = { music: { song } | { own: ver }, groups: [{ id, name, chars, cast, at (seconds in the bow music), from, row, note }],
   finale: song id (the Megamix), company: { note }, trench: 'stage' | 'pit', crew: true }. Not saved yet: the defaults below. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var FROM = ['Stage right', 'Stage left', 'Both sides', 'Upstage center'], ROWS = ['Back row', 'Middle row', 'Front row', 'Front, center'];
  var sideFor = function (i) { return i % 2 ? 'Stage left' : 'Stage right'; };      // entrances take turns, starting stage right (Colleen)
  var COLORS = ['#2f6fd1', '#24935d', '#c03aa8', '#d9822b', '#7a4fd6', '#c8323c'];
  var uid = function () { return 'b' + Math.random().toString(36).slice(2, 8); };

  function finaleSong() {
    var c = T.show.curtain, O = T.O();
    return (c && c.finale && T.songById(c.finale)) || O.songs.find(function (s) { return /bows|megamix|curtain/i.test(s.title); }) || O.songs[O.songs.length - 1];
  }
  /* the plan: saved, or the defaults */
  function plan() {
    var c = T.show.curtain; if (c && c.groups && c.music) return c;
    var O = T.O(), has = function (id) { return !!T.charById(id); }, fin = finaleSong();
    var g = function (name, chars, row) { return { id: uid(), name: name, chars: chars.filter(has), cast: [], at: null, row: row, note: '' }; };
    var groups;
    if (O.id === 'hsm-jr') groups = [
      g('The Company groups', ['students', 'partykids', 'cheer', 'rebels', 'thespians', 'drummajor', 'cathy', 'cyndra', 'james', 'susan', 'jocks', 'brainiacs'], 'Back row'),
      g('The grown-ups and the friends', ['darbus', 'coach', 'tenny', 'moderator', 'jack', 'kratnoff', 'chad', 'zeke', 'taylor', 'martha', 'kelsi'], 'Middle row'),
      g('Sharpay and Ryan', ['sharpay', 'ryan'], 'Front, center'),
      g('Troy and Gabriella', ['troy', 'gabriella'], 'Front, center')];
    else groups = ['ensemble', 'featured', 'adults', 'friends', 'leads'].map(function (gid, i) {
      var cs = O.characters.filter(function (c) { return c.group === gid; }).map(function (c) { return c.id; });
      return cs.length ? g((O.groups.find(function (x) { return x.id === gid; }) || {}).name || gid, cs, ROWS[Math.min(i, 3)]) : null;
    }).filter(Boolean);
    groups.forEach(function (x, i) { x.from = sideFor(i); });
    /* HSM JR: the bows go over the band track of #32 (We're All in This Together), Colleen's choice: a repeat of it in the full show, and its
       only use in the abridged school-day show */
    var m32 = O.id === 'hsm-jr' && O.songs.find(function (s) { return String(s.num) === '32'; });
    return { music: { song: (c && c.music && c.music.song) || (m32 && m32.id) || (fin && fin.id) }, finale: fin && fin.id, crew: true, trench: 'stage', groups: groups,
      company: { note: 'After the Megamix, everyone in one line: one bow together, then point to the band and the crew.' } };
  }
  T.curtainPlan = plan;
  /* the bow music: which track, and how to load it */
  function music(P) {
    var m = P.music || {};
    if (m.own) return { id: '__bows', kind: 'performance', ver: m.own, name: 'your bow music' };
    var so = m.song && T.songById(m.song), tr = so && (T.show.tracks || {})[so.id];
    if (!tr || !(tr.performance || tr.rehearsal)) return null;
    var kind = tr.performance ? 'performance' : 'rehearsal';
    return { id: so.id, kind: kind, ver: tr[kind].ver, name: 'the band track of “' + so.title + '”' };
  }
  /* which bow group a student (or a track) is in: a doubled student bows with their biggest role (the later group) */
  function groupOf(chars, actorId) {
    var P = plan(), hit = -1;
    P.groups.forEach(function (g, i) { if ((chars || []).some(function (c) { return g.chars.indexOf(c) >= 0; }) || (actorId && (g.cast || []).indexOf(actorId) >= 0)) hit = i; });
    return hit;
  }
  T.bowGroupOf = groupOf;
  function membersOf(g, gi) {      // the Company members who bow in group gi (a doubled student only in their own group), or its characters before casting
    var cast = (T.show.cast || []).filter(function (a) { return a.name && (a.chars || []).length; });
    var people = cast.filter(function (a) { return (a.chars || []).some(function (c) { return g.chars.indexOf(c) >= 0; }) || (g.cast || []).indexOf(a.id) >= 0; })
      .filter(function (a) { return gi == null || groupOf(a.chars, a.id) === gi; });
    return people.length ? people.map(function (a) { return { name: a.name, a: a }; }) : g.chars.map(function (c) { var x = T.charById(c); return { name: x ? x.short : c, c: c }; });
  }
  var listenFor = function (P, i) { return i === 0 ? 'the bow music starts' : P.groups[i - 1].name + ' bow and step back'; };

  /* ---------- the sounds: a soft two-note "get ready" and a bell for GO (Web Audio, over the track) ---------- */
  function tone(freqs, dur, vol) {
    var ctx = T.audioCtx(), t0 = ctx.currentTime;
    freqs.forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      var s = t0 + i * dur; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol || 0.25, s + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s + dur * 1.6);
      o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + dur * 1.7);
    });
  }
  var READY = function () { tone([660, 880], 0.18, 0.18); }, GO = function () { tone([1046, 1318, 1568], 0.12, 0.3); };
  function loadAudio(mu) {
    var audio = new Audio(), url = null;
    var p = Store.getTrack(T.key, mu.id, mu.kind, mu.ver).then(function (b) { if (!b) throw new Error('The bow music would not load.'); url = URL.createObjectURL(new Blob([b])); audio.src = url; return new Promise(function (ok) { if (audio.readyState >= 1) ok(); else audio.addEventListener('loadedmetadata', ok, { once: true }); }); });
    T.cleanup.push(function () { audio.pause(); if (url) URL.revokeObjectURL(url); });
    return { audio: audio, ready: p };
  }

  /* ---------- the player: the bow music with cues (the teacher's Rehearse, a student's Practice my bow) ---------- */
  function player(host, opts) {
    var P = plan(), mu = music(P);
    if (!mu) { host.innerHTML = '<p class="card">' + (T.me ? 'Your teacher has not picked the bow music yet.' : 'Pick the bow music first (Teacher › Curtain call).') + '</p>'; return; }
    var cues = P.groups.map(function (g, i) { return { i: i, g: g, t: g.at, color: COLORS[i % COLORS.length], label: 'Group ' + (i + 1) + ': ' + g.name, from: g.from }; })
      .filter(function (c) { return c.t != null && (!opts.only || opts.only.indexOf(c.i) >= 0); });
    if (!cues.length) { host.innerHTML = '<p class="card">' + (T.me ? 'Your teacher has not set the bow times yet.' : 'Set when each group goes first: “Set the times while it plays” (Teacher › Curtain call).') + '</p>'; return; }
    var A = loadAudio(mu), audio = A.audio, raf = 0, fired = {}, readied = {};
    host.innerHTML = '<div class="bow-stage"><div class="bow-next" id="bnext"></div><div class="bow-go" id="bgo" hidden></div><div class="bow-lyric muted" id="bmus">' + sym('🎵') + esc(mu.name) + '</div></div>' +
      '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="round big" id="bpl" aria-label="Play">' + icon('play') + '</button><button class="btn small" id="bbk">Back 10 s</button><b id="btm" class="lt-time">0:00</b>' +
      (opts.starts ? cues.map(function (c) { return '<button class="btn small" data-bfrom="' + c.t + '">From group ' + (c.i + 1) + '</button>'; }).join('') : '') +
      '<label class="switch" style="border:0"><span>🔔 Chimes</span><input type="checkbox" id="bch" checked></label></div>';
    var $ = function (id) { return host.querySelector('#' + id); }, chimes = function () { return $('bch') && $('bch').checked; };
    var last = cues[cues.length - 1].t;
    function frame() {
      var t = audio.currentTime;
      $('btm').textContent = T.clock(t);
      cues.forEach(function (c) {
        if (!readied[c.i] && t >= c.t - 4 && t < c.t) { readied[c.i] = 1; if (chimes()) READY(); }
        if (!fired[c.i] && t >= c.t && t < c.t + 3) {
          fired[c.i] = 1; if (chimes()) GO();
          var go = $('bgo'); go.hidden = false; go.style.background = c.color; go.innerHTML = '<div>GO!</div><div class="bow-go-who">' + esc(c.label) + '</div><div class="bow-go-from">from ' + esc(c.from) + '</div>';
          setTimeout(function () { if ($('bgo')) $('bgo').hidden = true; }, 3000);
        }
      });
      var next = cues.find(function (c) { return c.t > t; }), nx = $('bnext');
      if (next) { var s = Math.ceil(next.t - t); nx.style.borderColor = next.color; nx.innerHTML = '<div class="muted small">Next</div><div class="bow-next-who" style="color:' + next.color + '">' + esc(next.label) + '</div><div>From ' + esc(next.from) + ' · when ' + esc(listenFor(P, next.i)) + '</div><div class="bow-count">' + (s <= 10 ? s : '') + '</div>'; }
      else if (t > last + 3) nx.innerHTML = '<div class="bow-next-who">' + sym('🌟') + 'Everyone is on stage. Now the Megamix!</div><div class="muted">Then the Company bow: ' + esc(P.company.note || '') + '</div>';
      if (opts.stopAfter != null && t > opts.stopAfter) { audio.pause(); }
      if (!audio.paused) raf = requestAnimationFrame(frame);
    }
    function setPP() { var b = $('bpl'); if (b) { b.innerHTML = icon(audio.paused ? 'play' : 'pause'); b.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); } }
    function seek(t) { fired = {}; readied = {}; cues.forEach(function (c) { if (c.t < t) { fired[c.i] = 1; readied[c.i] = 1; } }); audio.currentTime = Math.max(0, t); }
    $('bpl').onclick = function () { A.ready.then(function () { if (audio.paused) { if (opts.startAt != null && audio.currentTime === 0) seek(opts.startAt); audio.play(); raf = requestAnimationFrame(frame); } else audio.pause(); setPP(); }); };
    $('bbk').onclick = function () { A.ready.then(function () { seek(Math.max(0, audio.currentTime - 10)); frame(); }); };
    host.querySelectorAll('[data-bfrom]').forEach(function (b) { b.onclick = function () { A.ready.then(function () { seek(+b.dataset.bfrom - 8); audio.play(); setPP(); raf = requestAnimationFrame(frame); }); }; });
    audio.addEventListener('pause', function () { setPP(); frame(); }); audio.addEventListener('ended', function () { setPP(); frame(); });
    T.cleanup.push(function () { cancelAnimationFrame(raf); });
    frame();
  }

  /* ---------- Teacher › Curtain call ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.curtain = function (args) {
    if (args && args[0] === 'run') return runPage();
    T.setBar('Curtain call', '#/teacher');
    var P = JSON.parse(JSON.stringify(plan())), O = T.O(), fin = finaleSong();
    var withTracks = O.songs.filter(function (s) { var t = (T.show.tracks || {})[s.id]; return t && (t.performance || t.rehearsal); });
    var sel = function (attr, list, v) { return '<select ' + attr + '>' + list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    var fmt = function (t) { return t == null ? '' : Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4); };
    var parse = function (s) { s = String(s || '').trim(); if (!s) return null; var m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/); var v = m ? +m[1] * 60 + +m[2] : +s; return isNaN(v) ? null : Math.max(0, +v.toFixed(1)); };
    var tap = null;      // setting the times while the music plays: { audio, k }
    function draw() {
      var mu = music(P);
      app.innerHTML = '<div class="card"><h2>' + sym('🌟') + 'Curtain call</h2><p class="muted">Each group walks on and bows over the bow music (no singing), when the group before them steps back. Once everyone is on stage, the whole Company performs “' + esc(fin ? fin.title : 'the finale') + '”, then the Company bow. Each performer sees their bow under <b>My bow</b>, with Practice my bow.</p>' +
        '<div class="row"><label class="f grow" style="margin:0">Bow music<select id="mus"><option value="">Pick…</option>' + withTracks.map(function (s) { return '<option value="s:' + s.id + '"' + (P.music && P.music.song === s.id && !P.music.own ? ' selected' : '') + '>Band track: ' + esc(s.title) + '</option>'; }).join('') + (P.music && P.music.own ? '<option value="own" selected>Your own bow music (uploaded)</option>' : '') + '</select></label>' +
        '<label class="btn" style="margin:0">' + sym('⬆️') + 'Upload bow music<input type="file" id="upl" accept="audio/*" hidden></label></div>' +
        (mu ? '' : '<p class="err">' + sym('⚠️') + 'Pick or upload the bow music (instrumental).</p>') +
        '<div class="row" style="margin-top:8px">' + (mu ? '<button class="btn primary" id="taps">' + sym('⏱') + 'Set the times while it plays</button><button class="btn" id="even">Spread them evenly</button>' : '') + '<a class="btn" href="#/teacher/curtain/run">' + icon('play') + 'Rehearse the bows</a><button class="btn quiet" onclick="print()">' + icon('print') + 'Print the bow plan</button></div><p class="muted small" id="tapmsg"></p></div>' +
        P.groups.map(function (g, i) {
          return '<div class="card bow-card" data-g="' + i + '" style="border-left:8px solid ' + COLORS[i % COLORS.length] + '"><div class="row"><b>Group ' + (i + 1) + '</b><input data-k="name" value="' + esc(g.name) + '" class="grow" aria-label="Group name">' +
            '<button class="btn small quiet" data-up="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="Earlier">↑</button><button class="btn small quiet" data-down="' + i + '"' + (i < P.groups.length - 1 ? '' : ' disabled') + ' aria-label="Later">↓</button><button class="btn small quiet" data-del="' + i + '">Remove</button></div>' +
            '<div class="row"><label class="f" style="margin:0">Goes at (in the bow music)<span class="row" style="gap:4px"><button type="button" class="btn small" data-nudge="' + i + '|-0.5" aria-label="Earlier">−</button><input data-k="at" value="' + fmt(g.at) + '" placeholder="0:00" style="width:80px"><button type="button" class="btn small" data-nudge="' + i + '|0.5" aria-label="Later">+</button></span></label>' +
            '<label class="f" style="margin:0">Enters from' + sel('data-k="from"', FROM, g.from) + '</label><label class="f" style="margin:0">Stands' + sel('data-k="row"', ROWS, g.row) + '</label>' +
            '<label class="f grow" style="margin:0">Note for them<input data-k="note" value="' + esc(g.note || '') + '" placeholder="e.g. hands joined, bow on 3"></label></div>' +
            '<p class="muted small" style="margin:4px 0">Goes when ' + esc(listenFor(P, i)) + '.</p>' +
            '<details><summary class="small">Who: ' + esc(membersOf(g).map(function (m) { return m.name; }).join(', ') || 'nobody yet') + '</summary><div class="row" style="flex-wrap:wrap;margin-top:6px">' +
            O.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return '<label class="chipbox"><input type="checkbox" data-ch="' + c.id + '"' + (g.chars.indexOf(c.id) >= 0 ? ' checked' : '') + '> ' + T.chip(c.id) + '</label>'; }).join('') + '</div>' +
            ((T.show.cast || []).length ? '<p class="muted small" style="margin:8px 0 4px">Also these Company members (whatever their role):</p><div class="row" style="flex-wrap:wrap">' + (T.show.cast || []).filter(function (a) { return a.name; }).map(function (a) { return '<label class="chipbox"><input type="checkbox" data-am="' + a.id + '"' + ((g.cast || []).indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + esc(a.name) + '</label>'; }).join('') + '</div>' : '') + '</details></div>';
        }).join('') +
        '<div class="row"><button class="btn" id="addg">+ Add a group</button></div>' +
        '<div class="card bow-card" style="border-left:8px solid #18233a"><b>Then: the Megamix, and the Company bow</b>' +
        '<div class="row"><label class="f grow" style="margin:0">The song everyone performs once they are on stage<select id="fin">' + O.songs.map(function (s) { return '<option value="' + s.id + '"' + (fin && s.id === fin.id ? ' selected' : '') + '>' + esc(s.title) + '</option>'; }).join('') + '</select></label></div>' +
        '<label class="f">The Company bow, after it<input id="cnote" value="' + esc(P.company.note || '') + '"></label>' +
        '<label class="switch"><span>The crew (in blacks) joins the line for the Company bow</span><input type="checkbox" id="ccrew"' + (P.crew !== false ? ' checked' : '') + '></label>' +
        (T.charById('trench') ? '<div class="switch"><span>The Trench Crew</span><div class="seg" id="ctr"><button type="button" data-tr="stage" aria-pressed="' + (P.trench !== 'pit') + '">Comes up for the Company bow</button><button type="button" data-tr="pit" aria-pressed="' + (P.trench === 'pit') + '">Bows from the pit</button></div></div>' : '') + '</div>' +
        '<div class="dock"><div class="in"><button class="btn quiet" id="reset">Back to the suggested groups</button><button class="btn primary" id="sv" data-save>Save</button></div></div>';
      var keep = function () {
        app.querySelectorAll('.bow-card[data-g]').forEach(function (el) {
          var g = P.groups[+el.dataset.g], q = function (k) { return el.querySelector('[data-k="' + k + '"]'); };
          g.name = q('name').value.trim() || g.name; g.from = q('from').value; g.row = q('row').value; g.note = q('note').value.trim(); g.at = parse(q('at').value);
          g.chars = Array.from(el.querySelectorAll('[data-ch]:checked')).map(function (x) { return x.dataset.ch; });
          g.cast = Array.from(el.querySelectorAll('[data-am]:checked')).map(function (x) { return x.dataset.am; });
        });
        P.finale = document.getElementById('fin').value; P.company.note = document.getElementById('cnote').value.trim(); P.crew = document.getElementById('ccrew').checked;
      };
      var $ = function (id) { return document.getElementById(id); };
      $('mus').onchange = function () { keep(); var v = this.value; if (v.slice(0, 2) === 's:') P.music = { song: v.slice(2) }; draw(); };
      $('upl').onchange = function () {
        var f = this.files[0]; if (!f) return; keep(); var m = $('tapmsg'); m.textContent = 'Uploading ' + f.name + '…';
        f.arrayBuffer().then(function (buf) { return T.audioCtx().decodeAudioData(buf.slice(0)).then(function () { var ver = Date.now().toString(36); return Store.putTrack(T.key, T.proof, '__bows', 'performance', buf, ver).then(function () { P.music = { own: ver }; draw(); T.toast('Bow music uploaded. Save to keep it.'); }); }); })
          .catch(function (e) { m.textContent = 'That file could not be used: ' + (e.message || 'not an audio file') + '.'; });
      };
      app.querySelectorAll('[data-ch],[data-am]').forEach(function (s) { s.onchange = function () { keep(); draw(); }; });
      app.querySelectorAll('[data-k="at"]').forEach(function (s) { s.onchange = function () { keep(); draw(); }; });
      app.querySelectorAll('[data-nudge]').forEach(function (b) { b.onclick = function () { keep(); var q = b.dataset.nudge.split('|'), g = P.groups[+q[0]]; g.at = Math.max(0, +((g.at || 0) + +q[1]).toFixed(1)); draw(); }; });
      app.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { keep(); var i = +b.dataset.up, x = P.groups.splice(i, 1)[0]; P.groups.splice(i - 1, 0, x); draw(); }; });
      app.querySelectorAll('[data-down]').forEach(function (b) { b.onclick = function () { keep(); var i = +b.dataset.down, x = P.groups.splice(i, 1)[0]; P.groups.splice(i + 1, 0, x); draw(); }; });
      app.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { keep(); P.groups.splice(+b.dataset.del, 1); draw(); }; });
      app.querySelectorAll('[data-tr]').forEach(function (b) { b.onclick = function () { keep(); P.trench = b.dataset.tr; draw(); }; });
      $('addg').onclick = function () { keep(); P.groups.push({ id: uid(), name: 'New group', chars: [], cast: [], at: null, from: sideFor(P.groups.length), row: ROWS[0], note: '' }); draw(); };
      $('sv').onclick = function () { keep(); T.show.curtain = P; T.saveShow('Curtain call saved'); };
      $('reset').onclick = function () { if (!confirm('Go back to the suggested bow groups? Your changes here are replaced (Save to keep it).')) return; var keepC = T.show.curtain; delete T.show.curtain; P = JSON.parse(JSON.stringify(plan())); if (keepC) T.show.curtain = keepC; draw(); };
      /* spread evenly: the groups share the bow music, a little in from the start, leaving room at the end for the last bow */
      if ($('even')) $('even').onclick = function () {
        keep(); var A = loadAudio(mu), m = $('tapmsg'); m.textContent = 'Reading the length of the music…';
        A.ready.then(function () { var d = A.audio.duration || 60, n = P.groups.length; P.groups.forEach(function (g, i) { g.at = +(2 + (d - 6) * i / n).toFixed(1); }); draw(); T.toast('Spread over ' + T.clock(d) + ' of music. Save to keep it.'); });
      };
      /* tap the times: the music plays; each tap of Now sets the next group's moment */
      if ($('taps')) $('taps').onclick = function () {
        keep(); var A = loadAudio(mu), k = 0, m = $('tapmsg');
        var bar = document.createElement('div'); bar.className = 'dock'; bar.innerHTML = '<div class="in"><b id="tapwho"></b><span class="grow"></span><button class="btn primary lt-now" id="tapnow">Now</button><button class="btn" id="tapstop">Stop</button></div>';
        document.body.appendChild(bar);
        var show = function () { var w = document.getElementById('tapwho'); if (w) w.textContent = k < P.groups.length ? 'Tap Now when Group ' + (k + 1) + ' (' + P.groups[k].name + ') should walk on' : 'All set.'; };
        var end = function () { A.audio.pause(); bar.remove(); draw(); T.toast('Times set. Rehearse to check them, then Save.'); };
        show(); m.textContent = 'Loading the music…';
        A.ready.then(function () { m.textContent = ''; A.audio.currentTime = 0; A.audio.play(); });
        document.getElementById('tapnow').onclick = function () { if (k >= P.groups.length) return end(); P.groups[k].at = +A.audio.currentTime.toFixed(1); k++; show(); if (k >= P.groups.length) setTimeout(end, 800); };
        document.getElementById('tapstop').onclick = end;
        T.cleanup.push(function () { bar.remove(); });
      };
    }
    draw();
  };
  function runPage() {
    T.setBar('Rehearse the bows', '#/teacher/curtain');
    var fin = finaleSong();
    app.innerHTML = '<div class="card noprint"><h2>' + sym('🌟') + 'Rehearse the bows</h2><p class="muted">Put this on the projector. The bow music plays; four seconds before each group goes, a soft chime, and when it is their turn a bell and a big GO in the group’s color. Once everyone is on stage: the Megamix, then the Company bow.</p></div><div id="bhost"></div>' +
      (fin ? '<p class="center" style="margin-top:12px"><a class="btn" href="#/song/' + fin.id + '">' + sym('🎵') + 'Then: ' + esc(fin.title) + '</a></p>' : '');
    player(document.getElementById('bhost'), { starts: true });
  }

  /* ---------- Students: My bow ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.bow = function () {
    T.setBar('My bow', '#/home');
    var me = T.me, P = plan(), gi = me ? groupOf(me.chars, me.id) : -1, fin = finaleSong();
    if (gi < 0) { app.innerHTML = '<div class="card"><h2>' + sym('🌟') + 'My bow</h2><p>' + (me && me.chars.length ? 'Your teacher has not put your role in a bow group yet.' : 'You will see your bow once you have a role.') + '</p><p>Everyone bows together at the end: ' + esc(P.company.note || '') + '</p></div>'; return; }
    var g = P.groups[gi], col = COLORS[gi % COLORS.length];
    var others = membersOf(g, gi).filter(function (m) { return !(m.a && me.id && m.a.id === me.id) && !(m.c && me.chars.indexOf(m.c) >= 0); });
    app.innerHTML = '<div class="card bow-mine" style="border-left:10px solid ' + col + '"><div class="muted">Your bow</div><h2 style="color:' + col + ';margin:2px 0 10px">Group ' + (gi + 1) + ' of ' + P.groups.length + ': ' + esc(g.name) + '</h2>' +
      '<div class="bow-steps">' +
      '<div><span class="bow-n">1</span><b>Go when</b><br>' + esc(listenFor(P, gi)) + '<br><span class="muted small">(the bow music is playing; nobody sings yet)</span></div>' +
      '<div><span class="bow-n">2</span><b>Walk on from</b><br>' + esc(g.from) + '</div>' +
      '<div><span class="bow-n">3</span><b>Bow, then stand in the</b><br>' + esc(g.row) + '</div>' +
      '<div><span class="bow-n">4</span><b>Then everyone performs</b><br>' + esc(fin ? fin.title : 'the finale') + '</div>' +
      '<div><span class="bow-n">5</span><b>Company bow</b><br>' + esc(P.company.note || 'everyone bows together') + '</div></div>' +
      (g.note ? '<p class="card" style="background:var(--hi);margin-top:10px">' + sym('📌') + esc(g.note) + '</p>' : '') +
      '<h3 style="margin-top:14px">You bow with</h3><div class="row" style="flex-wrap:wrap">' + (others.length ? others.map(function (m) { return m.a ? '<span class="chip">' + T.face(m.a, 28) + ' ' + esc(m.name) + '</span>' : T.chip(m.c); }).join('') : '<span class="muted">just you</span>') + '</div>' +
      '<p class="muted small" style="margin-top:10px">Before you: ' + (gi ? P.groups.slice(0, gi).map(function (x) { return esc(x.name); }).join(' · ') : 'nobody, your group goes first!') + '</p></div>' +
      '<div class="card"><h3>' + sym('🔔') + 'Practice my bow</h3><p class="muted small">The bow music starts a little before your turn. A soft chime means “get ready”; the bell and GO mean walk on now.</p><div id="bhost"></div>' +
      (fin ? '<p style="margin-top:10px"><a class="btn" href="#/song/' + fin.id + '">' + sym('🎵') + 'Then practice ' + esc(fin.title) + '</a></p>' : '') + '</div>';
    var t0 = g.at;
    player(document.getElementById('bhost'), { only: [gi], startAt: t0 != null ? Math.max(0, t0 - 12) : 0, stopAfter: t0 != null ? t0 + 10 : null });
  };
})();
