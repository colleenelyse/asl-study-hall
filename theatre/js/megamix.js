/* asl.cool/theatre: Megamix groups (Colleen 2026-10-25: "let's be smart about working on sections of the megamix that can overlap the original song
   learning … do this in groups until the last section"; "optimize who learns what so that someone who learns status quo for the show isn't expected
   to learn bop to the top only for the megamix. however this will also lead to some overlap and people needing to be put in one or another when they
   know two in a row so that we can have full group shifts between song sections"; "status quo is zeke and taylors big song so they should do that
   section. apply this logic too"; solo lines need not be sung by the right actor, the track has the vocals, "so everyone can just have fun and dance").
   The sections come from the show file (megamix: { song, sections: [{ id, name, from: [song ids], stars: [char ids], all }] }).
   The suggestion: each character does the sections of their own big songs (stars); everyone else does one section they already know from the show,
   the lightest one first, so the groups come out even; nobody is in two sections in a row; the last section is everyone.
   Teacher › Rehearsals › Megamix groups (#/teacher/megamix): the grid (who knows what, who does what), tap to change, warnings, the groups by
   section (characters and, once cast, the Company members); T.show.megamix = { assign: { charId: [section index] } } keeps her changes.
   The rehearsal plan (js/rehearsal-plan.js, cfg.megamix from forPlan) teaches each section to its group right after its original song. */
(function (root) {
  'use strict';
  function sectionsOf(S) { return (S && S.megamix && S.megamix.sections) || []; }
  var isHelper = function (c) { return c.group === 'helpers'; };
  /* who sings a song in the show: on its list, or a small role in a big number (the planner's own rule) */
  function knower(S) {
    var small = function (c) { return !!c && (c.group === 'ensemble' || c.group === 'featured' || !!c.small); };
    var ch = function (id) { return S.characters.find(function (c) { return c.id === id; }); };
    return function (cid, songId) {
      var m = (S.moments || []).find(function (x) { return x.song === songId; }); if (!m) return false;
      if ((m.out || []).indexOf(cid) >= 0) return false;
      if (m.on === '*' || (m.on || []).indexOf(cid) >= 0) return true;
      return !!m.big && small(ch(cid));
    };
  }
  function knows(S, cid, k) { var sec = sectionsOf(S)[k], kn = knower(S); return !!sec && sec.from.some(function (id) { return kn(cid, id); }); }
  var adjacent = function (list) { var l = list.slice().sort(function (a, b) { return a - b; }); for (var i = 1; i < l.length; i++) if (l[i] - l[i - 1] === 1) return [l[i - 1], l[i]]; return null; };
  /* weight(cid): how many Company members play it (an ensemble group counts as several before casting). opts.strong: the more capable performers
     (her bow Group 2), placed first and spread so every section has some; the leads (mx.leads) are in no section before mx.leadsFrom */
  function suggest(S, weight, opts) {
    var mx = S.megamix || {}, secs = sectionsOf(S), out = {}, load = secs.map(function () { return 0; }), strongN = secs.map(function () { return 0; });
    var strong = (opts && opts.strong) || mx.strong || [], leads = mx.leads || [], from = mx.leadsFrom || 0;
    var W = weight || function (cid) { var c = S.characters.find(function (x) { return x.id === cid; }); return c && c.group === 'ensemble' ? 3 : 1; };
    var groupIdx = secs.map(function (s, k) { return s.all ? -1 : k; }).filter(function (k) { return k >= 0; });
    var allowed = function (cid) { return groupIdx.filter(function (k) { return leads.indexOf(cid) < 0 || k >= from; }); };
    var put = function (cid, k) { (out[cid] = out[cid] || []).push(k); load[k] += W(cid); if (strong.indexOf(cid) >= 0) strongN[k]++; };
    var chars = S.characters.filter(function (c) { return !isHelper(c); }).map(function (c) { return c.id; });
    chars.forEach(function (cid) {
      var ok = allowed(cid), keep = [];
      groupIdx.filter(function (k) { return (secs[k].stars || []).indexOf(cid) >= 0 && ok.indexOf(k) >= 0; })
        .forEach(function (k) { if (!keep.some(function (j) { return Math.abs(j - k) === 1; })) keep.push(k); });      // two big songs in a row: the first
      keep.forEach(function (k) { put(cid, k); });
    });
    var rest = chars.filter(function (cid) { return !out[cid]; }).map(function (cid) {
      var ok = allowed(cid), can = ok.filter(function (k) { return knows(S, cid, k); });
      return { cid: cid, can: can.length ? can : ok, w: W(cid), strong: strong.indexOf(cid) >= 0 };
    }).sort(function (a, b) { return (b.strong - a.strong) || a.can.length - b.can.length || b.w - a.w; });
    rest.forEach(function (r) {
      var best = r.can.slice().sort(function (a, b) { return (r.strong ? strongN[a] - strongN[b] : 0) || load[a] - load[b] || a - b; })[0];
      if (best != null) put(r.cid, best);
    });
    /* a mix in every section: a section with fewer than two chorus or minor featured roles (only a few people know its song, like What I've
       Been Looking For) borrows them from the fullest section; they learn it for the Megamix, the price of a good mix */
    var chorusIn = function (k) { return Object.keys(out).filter(function (c) { return out[c].indexOf(k) >= 0 && strong.indexOf(c) < 0 && leads.indexOf(c) < 0; }); };
    groupIdx.forEach(function (k) {
      for (var guard = 0; chorusIn(k).length < 2 && guard < 4; guard++) {
        var donors = rest.filter(function (r) { var a = out[r.cid] || []; return !r.strong && leads.indexOf(r.cid) < 0 && a.length === 1 && a[0] !== k && allowed(r.cid).indexOf(k) >= 0 && chorusIn(a[0]).length > 2; })
          .sort(function (x, y) { return load[out[y.cid][0]] - load[out[x.cid][0]] || x.w - y.w; });
        if (!donors.length) break;
        var d = donors[0], was = out[d.cid][0]; load[was] -= d.w; out[d.cid] = []; put(d.cid, k);
      }
    });
    return out;
  }
  /* the plan as it stands: her changes over the suggestion */
  function resolve(S, saved, weight, opts) {
    var sug = suggest(S, weight, opts), mine = (saved && saved.assign) || {}, out = {};
    Object.keys(sug).forEach(function (cid) { out[cid] = mine[cid] ? mine[cid].slice() : sug[cid]; });
    Object.keys(mine).forEach(function (cid) { if (!out[cid] && S.characters.some(function (c) { return c.id === cid; })) out[cid] = mine[cid].slice(); });
    return out;
  }
  /* what to look at: in two sections in a row, a section they don't know from the show, nobody in a section, in no section */
  function problems(S, assign) {
    var secs = sectionsOf(S), out = [], nm = function (cid) { var c = S.characters.find(function (x) { return x.id === cid; }); return c ? (c.short || c.name) : cid; };
    Object.keys(assign).forEach(function (cid) {
      var a = assign[cid], two = adjacent(a);
      if (two) out.push({ kind: 'row', cid: cid, text: nm(cid) + ' is in ' + secs[two[0]].name + ' and ' + secs[two[1]].name + ', two sections in a row.' });
      a.forEach(function (k) { if (secs[k] && !secs[k].all && !knows(S, cid, k)) out.push({ kind: 'new', cid: cid, text: nm(cid) + ' learns ' + secs[k].name + ' only for the Megamix.' }); });
      if (!a.length) out.push({ kind: 'none', cid: cid, text: nm(cid) + ' is only in the last section.' });
      var mx = S.megamix || {}; if ((mx.leads || []).indexOf(cid) >= 0 && a.some(function (k) { return k < (mx.leadsFrom || 0); })) out.push({ kind: 'lead', cid: cid, text: nm(cid) + ' is a lead in an early section (the leads rest until ' + secs[mx.leadsFrom].name + ').' });
    });
    secs.forEach(function (s, k) { if (!s.all && !Object.keys(assign).some(function (cid) { return assign[cid].indexOf(k) >= 0; })) out.push({ kind: 'empty', text: 'Nobody is in ' + s.name + '.' }); });
    return out;
  }
  /* a Company member who plays more than one character does all their sections: is that two in a row? */
  function studentClashes(S, assign, cast) {
    var secs = sectionsOf(S);
    return (cast || []).map(function (a) {
      var ks = []; (a.chars || []).forEach(function (c) { (assign[c] || []).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); });
      var two = adjacent(ks); return two ? { id: a.id, name: a.name, text: a.name + ' (' + (a.chars || []).join(', ') + ') is in ' + secs[two[0]].name + ' and ' + secs[two[1]].name + ', two in a row.' } : null;
    }).filter(Boolean);
  }
  /* for the rehearsal planner: each section with its people (characters); the last one everyone */
  function forPlan(S, assign) {
    var secs = sectionsOf(S); if (!secs.length) return null;
    return { song: S.megamix.song, sections: secs.map(function (s, k) { return { id: s.id, name: s.name, from: s.from.slice(), all: !!s.all, people: s.all ? null : Object.keys(assign).filter(function (cid) { return assign[cid].indexOf(k) >= 0; }) }; }) };
  }
  var core = { sectionsOf: sectionsOf, knows: knows, suggest: suggest, resolve: resolve, problems: problems, studentClashes: studentClashes, forPlan: forPlan, adjacent: adjacent };
  root.MegamixCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.T) return;
  var T = window.T, MC = window.MegamixCore, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  /* the outline as saved, or the show file's for a show saved before the Megamix sections existed (the same show) */
  function S() { var O = T.O(), D = window.DEFAULT_SHOW; return O.megamix ? O : (D && D.title === O.title && D.megamix ? Object.assign({}, O, { megamix: D.megamix }) : O); }
  var castOf = function (cid) { return (T.show.cast || []).filter(function (a) { return a.name && (a.chars || []).indexOf(cid) >= 0; }); };
  var weight = function (cid) { var n = castOf(cid).length; if (n) return n; var c = T.charById(cid); return c && c.group === 'ensemble' ? 3 : 1; };
  /* the more capable performers: her bow Group 2 (Curtain call), else the show file's list */
  var opts = function () { var P = T.curtainPlan ? T.curtainPlan() : null, g = P && P.groups && P.groups[1]; return g && g.chars && g.chars.length ? { strong: g.chars } : {}; };
  function assignNow() { return MC.resolve(S(), T.show.megamix, weight, opts()); }
  T.Megamix = {
    forPlan: function () { var s = S(); return MC.sectionsOf(s).length ? MC.forPlan(s, assignNow()) : null; },
    /* a Company member's sections (index list) for My bow */
    words: function () { return WORD(); },
    mine: function (me) { var a = assignNow(), ks = []; (me.chars || []).forEach(function (c) { (a[c] || []).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); }); }); return { sections: MC.sectionsOf(S()), ks: ks.sort(function (x, y) { return x - y; }) }; }
  };

  /* ---------- the timing (Colleen 2026-10-25: tap while it plays) ----------
     T.show.megamix.music = { kind: 'rehearsal' | 'performance' } (the Megamix's own track: with vocals, or the band) or { own: ver } (an upload,
     stored as the track '__megamix'); .times = [seconds into that music where each section starts]. The moment she taps is when that group runs
     on (count 1); a yellow GET READY comes 3 seconds before, then a green GO, and the group before clears off. */
  var COL = ['#2f6fd1', '#24935d', '#c03aa8', '#d9822b', '#7a4fd6', '#c8962b'];
  function musicOf(m) {
    m = m || (T.show.megamix || {}).music || {};
    if (m.own) return { id: '__megamix', kind: 'performance', ver: m.own, name: 'your Megamix recording' };
    var id = (S().megamix || {}).song, tr = (T.show.tracks || {})[id] || {}, k = m.kind && tr[m.kind] ? m.kind : tr.rehearsal ? 'rehearsal' : tr.performance ? 'performance' : null;
    return k ? { id: id, kind: k, ver: tr[k].ver, name: k === 'rehearsal' ? 'the Megamix with vocals' : 'the Megamix band track' } : null;
  }
  function audioFor(mu) {
    var a = new Audio(), url = null;
    var ready = Store.getTrack(T.key, mu.id, mu.kind, mu.ver).then(function (b) { if (!b) throw new Error('The Megamix music would not load.'); url = URL.createObjectURL(new Blob([b])); a.src = url; return new Promise(function (ok) { if (a.readyState >= 1) ok(); else a.addEventListener('loadedmetadata', ok, { once: true }); }); });
    T.cleanup.push(function () { a.pause(); if (url) URL.revokeObjectURL(url); });
    return { audio: a, ready: ready };
  }
  var GET_READY = 3, GO_FOR = 3;
  /* the staging (Colleen 2026-10-25: "everyone can stay on stage and the people who are dancing just pull downstage and then return upstage for the
     next group to take a turn. i'd love to do exits and entrances but that feels complicated to teach"): 'stay' (the default) or 'exits' */
  var stay = function () { return ((T.show.megamix || {}).staging || 'stay') !== 'exits'; };
  var WORD = function () { return stay() ? { go: 'Move downstage!', off: 'BACK UPSTAGE', offLong: 'Walk back upstage in your lane; the next group comes down', away: 'Upstage', waiting: 'upstage: background moves', clears: 'goes back upstage', on: 'Dancing downstage', done: 'Upstage for the rest, then everyone dances the finish' } :
    { go: 'GO on!', off: 'CLEAR OFF', offLong: 'Walk off now, quickly and quietly', away: 'Offstage', waiting: 'offstage', clears: 'clears off', on: 'On stage', done: 'You are done until the Company bow' }; };
  /* what happens at time t: the section on now, and the change coming (or just made) */
  function moment(times, t) {
    var k = -1; times.forEach(function (x, i) { if (x != null && x <= t) k = i; });
    var n = -1; for (var j = k + 1; j < times.length; j++) if (times[j] != null) { n = j; break; }
    return { k: k, next: n, toNext: n >= 0 ? times[n] - t : null, since: k >= 0 ? t - times[k] : null };
  }
  function namesOf(k, A, secs) {
    if (secs[k].all) return 'Everyone';
    return S().characters.filter(function (c) { return (A[c.id] || []).indexOf(k) >= 0; }).map(function (c) { var n = castOf(c.id); return (c.short || c.name) + (n.length ? ' (' + n.map(function (q) { return T.shortName ? T.shortName(q.name) : q.name; }).join(', ') + ')' : ''); }).join(', ');
  }
  var READY_TONE = function () { tone([660, 880], 0.18, 0.18); }, GO_TONE = function () { tone([1046, 1318, 1568], 0.12, 0.3); };
  function tone(freqs, dur, vol) {
    var ctx = T.audioCtx(), t0 = ctx.currentTime;
    freqs.forEach(function (f, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; var s0 = t0 + i * dur; g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(vol, s0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s0 + dur * 1.6); o.connect(g); g.connect(ctx.destination); o.start(s0); o.stop(s0 + dur * 1.7); });
  }
  /* the shared player: play/pause, back 10 s, start a few seconds before any section; frame(t) draws */
  function playerBar(host, mu, times, secs, frame) {
    var P = audioFor(mu), a = P.audio, raf = 0;
    host.insertAdjacentHTML('beforeend', '<div class="row" style="margin-top:10px;flex-wrap:wrap;gap:6px"><button class="round big" data-mxp aria-label="Play">' + icon('play') + '</button><button class="btn small" data-mxb>Back 10 s</button><b class="lt-time" data-mxt>0:00</b>' +
      secs.map(function (x, k) { return times[k] != null ? '<button class="btn small" data-mxfrom="' + times[k] + '">' + (k + 1) + '. ' + esc(x.name.split(' ').slice(0, 3).join(' ')) + '</button>' : ''; }).join('') +
      '<label class="switch" style="border:0"><span>🔔 Sounds</span><input type="checkbox" data-mxs checked></label></div>');
    var q = function (sel) { return host.querySelector(sel); };
    var tick = function () { var t = a.currentTime; q('[data-mxt]').textContent = T.clock(t); frame(t, !!(q('[data-mxs]') && q('[data-mxs]').checked)); if (!a.paused) raf = requestAnimationFrame(tick); };
    var setPP = function () { var b = q('[data-mxp]'); if (b) { b.innerHTML = icon(a.paused ? 'play' : 'pause'); b.setAttribute('aria-label', a.paused ? 'Play' : 'Pause'); } };
    q('[data-mxp]').onclick = function () { P.ready.then(function () { if (a.paused) { a.play(); raf = requestAnimationFrame(tick); } else a.pause(); setPP(); }, function (e) { T.toast(e.message, 5000); }); };
    q('[data-mxb]').onclick = function () { P.ready.then(function () { a.currentTime = Math.max(0, a.currentTime - 10); tick(); }); };
    host.querySelectorAll('[data-mxfrom]').forEach(function (b) { b.onclick = function () { P.ready.then(function () { a.currentTime = Math.max(0, +b.dataset.mxfrom - 8); a.play(); setPP(); raf = requestAnimationFrame(tick); }); }; });
    a.addEventListener('pause', function () { setPP(); tick(); });
    T.cleanup.push(function () { cancelAnimationFrame(raf); });
    tick();
    return P;
  }
  /* Teacher › Megamix groups › Rehearse (#/teacher/megamix/run): for the projector */
  function runPage() {
    T.setBar('Rehearse the Megamix', '#/teacher/megamix');
    var s = S(), secs = MC.sectionsOf(s), M = T.show.megamix || {}, times = M.times || [], mu = musicOf(), A = assignNow();
    if (!mu || !times.some(function (x) { return x != null; })) { app.innerHTML = '<div class="card"><p>Pick the Megamix music and tap when each section starts first (Teacher › Megamix groups › Timing).</p></div>'; return; }
    app.innerHTML = '<div class="card noprint"><h2 style="margin-top:0">' + sym('🎶') + 'Rehearse the Megamix</h2><p class="muted">Put this on the projector. Three seconds before each section, a yellow GET READY with who dances next; then GO, and the group before ' + WORD().clears + '.</p></div>' +
      '<div class="bow-stage"><div class="bow-next" data-now></div><div class="bow-go" data-big hidden></div></div><div data-bar></div>';
    var said = {}, now = app.querySelector('[data-now]'), big = app.querySelector('[data-big]');
    playerBar(app.querySelector('[data-bar]'), mu, times, secs, function (t, snd) {
      var m = moment(times, t);
      now.style.borderColor = m.k >= 0 ? COL[m.k % COL.length] : '#888';
      now.innerHTML = m.k >= 0 ? '<div class="muted small">' + (stay() ? 'Dancing downstage now' : 'On stage now') + '</div><div class="bow-next-who" style="color:' + COL[m.k % COL.length] + '">' + (m.k + 1) + '. ' + esc(secs[m.k].name) + '</div><div class="small">' + esc(namesOf(m.k, A, secs)) + '</div>' : '<div class="muted">Before the Megamix</div>';
      if (m.next >= 0) now.innerHTML += '<div class="small" style="margin-top:6px">Next: ' + (m.next + 1) + '. ' + esc(secs[m.next].name) + ' at ' + T.clock(times[m.next]) + '</div>';
      if (m.next >= 0 && m.toNext <= GET_READY) {
        if (!said['r' + m.next]) { said['r' + m.next] = 1; if (snd) READY_TONE(); }
        big.hidden = false; big.style.background = '#f2c200'; big.style.color = '#1d1a2e';
        big.innerHTML = '<div>GET READY</div><div class="bow-go-who">' + (m.next + 1) + '. ' + esc(secs[m.next].name) + ' · ' + Math.ceil(m.toNext) + '</div><div class="bow-go-from">' + esc(namesOf(m.next, A, secs)) + '</div>';
      } else if (m.k >= 0 && m.since < GO_FOR) {
        if (!said['g' + m.k]) { said['g' + m.k] = 1; if (snd) GO_TONE(); }
        big.hidden = false; big.style.background = COL[m.k % COL.length]; big.style.color = '#fff';
        big.innerHTML = '<div>GO!</div><div class="bow-go-who">' + (m.k + 1) + '. ' + esc(secs[m.k].name) + '</div><div class="bow-go-from">' + (m.k > 0 && !secs[m.k].all ? 'Group ' + m.k + ' ' + WORD().clears : secs[m.k].all ? (stay() ? 'Everyone dances!' : 'Everyone on!') : '') + '</div>';
      } else { big.hidden = true; if (m.since != null && m.since > GO_FOR + 1) { said['r' + m.k] = 1; } }
      if (m.k < 0 || m.since > 1) Object.keys(said).forEach(function (x) { var n = +x.slice(1); if (n > m.k + 0 && times[n] > t + GET_READY) delete said[x]; });      // going back replays the cues
    });
  }
  /* My Megamix practice (My bow): the music with my own cues: a red X offstage, a yellow GET READY 3 seconds before my section, a green GO,
     a blue ON STAGE while my section lasts, an orange CLEAR OFF when it ends */
  function practice(host, me) {
    var s = S(), secs = MC.sectionsOf(s), M = T.show.megamix || {}, times = M.times || [], mu = musicOf();
    if (!mu || !times.some(function (x) { return x != null; })) { host.innerHTML = '<p class="muted small">Your teacher has not set the Megamix timing yet.</p>'; return; }
    var mine = T.Megamix.mine(me).ks, onIn = function (k) { return k >= 0 && (secs[k].all || mine.indexOf(k) >= 0); }, said = {};
    host.innerHTML = '<div class="bowcd wait" data-cd aria-live="polite"><div class="bowcd-x" aria-hidden="true">✕</div><div class="bowcd-big" data-cdb></div><div class="bowcd-small" data-cds></div></div>';
    var box = host.querySelector('[data-cd]'), bigE = host.querySelector('[data-cdb]'), small = host.querySelector('[data-cds]');
    var mmss = function (x) { x = Math.max(0, Math.ceil(x)); return Math.floor(x / 60) + ':' + ('0' + x % 60).slice(-2); };
    playerBar(host, mu, times, secs, function (t, snd) {
      var m = moment(times, t), nextMine = -1;
      for (var j = m.k + 1; j < secs.length; j++) if (times[j] != null && onIn(j)) { nextMine = j; break; }
      if (onIn(m.k)) {
        if (m.since < GO_FOR) { box.className = 'bowcd go'; if (!said['g' + m.k]) { said['g' + m.k] = 1; if (snd) GO_TONE(); } bigE.textContent = 'GO!'; small.textContent = WORD().go + ' ' + (m.k + 1) + '. ' + secs[m.k].name; }
        else { box.className = 'bowcd done'; bigE.textContent = WORD().on; small.textContent = (m.k + 1) + '. ' + secs[m.k].name + (m.next >= 0 && !onIn(m.next) ? ' · ' + WORD().off.toLowerCase() + ' in ' + mmss(m.toNext) : ''); }
        return;
      }
      if (m.k >= 1 && onIn(m.k - 1) && m.since < GO_FOR) { box.className = 'bowcd clear'; bigE.textContent = WORD().off; small.textContent = WORD().offLong; return; }
      if (nextMine < 0) { box.className = 'bowcd wait'; bigE.textContent = m.k >= 0 ? WORD().away : ''; small.textContent = WORD().done; return; }
      var left = times[nextMine] - t;
      if (left <= GET_READY) { box.className = 'bowcd ready'; if (!said['r' + nextMine]) { said['r' + nextMine] = 1; if (snd) READY_TONE(); } bigE.textContent = 'GET READY'; small.textContent = Math.ceil(left) + '…'; }
      else { box.className = 'bowcd wait'; bigE.textContent = mmss(left); small.textContent = (stay() && m.k >= 0 ? 'Upstage: clap and cheer · ' : '') + 'until ' + (nextMine + 1) + '. ' + secs[nextMine].name; if (left > GET_READY + 1) { delete said['r' + nextMine]; delete said['g' + nextMine]; } }
    });
  }
  T.Megamix.practice = practice;

  T.teacherPages = T.teacherPages || {};
  T.teacherPages.megamix = function (args) {
    if (args && args[0] === 'run') return runPage();
    T.setBar('Megamix groups', '#/teacher');
    var s = S(), secs = MC.sectionsOf(s);
    if (!secs.length) { app.innerHTML = '<div class="card"><p>This show’s file has no Megamix sections.</p></div>'; return; }
    var saved = JSON.parse(JSON.stringify(T.show.megamix || { assign: {} })); saved.assign = saved.assign || {};
    var song = T.songById ? T.songById(s.megamix.song) : null;
    var COL = ['#2f6fd1', '#24935d', '#c03aa8', '#d9822b', '#7a4fd6', '#c8962b'];
    function draw() {
      var A = MC.resolve(s, saved, weight, opts()), sug = MC.suggest(s, weight, opts()), probs = MC.problems(s, A), clash = MC.studentClashes(s, A, T.show.cast);
      var groups = (s.groups || []).filter(function (g) { return g.id !== 'helpers'; });
      var chars = s.characters.filter(function (c) { return c.group !== 'helpers'; });
      var head = '<tr><th style="text-align:left">Who</th>' + secs.map(function (x, k) { return '<th style="color:' + COL[k % COL.length] + '">' + (k + 1) + '. ' + esc(x.name) + '</th>'; }).join('') + '</tr>';
      var row = function (c) {
        var a = A[c.id] || [], changed = !!saved.assign[c.id], n = castOf(c.id);
        return '<tr><td>' + T.chip(c.id) + (n.length ? ' <span class="muted small">' + esc(n.map(function (x) { return T.shortName ? T.shortName(x.name) : x.name; }).join(', ')) + '</span>' : '') + (changed ? ' <button class="btn small quiet" data-undo="' + c.id + '" title="Back to the suggestion">↺</button>' : '') + '</td>' +
          secs.map(function (x, k) {
            if (x.all) return '<td class="mx-c mx-all" title="Everyone">●</td>';
            var on = a.indexOf(k) >= 0, kn = MC.knows(s, c.id, k), star = (x.stars || []).indexOf(c.id) >= 0;
            return '<td class="mx-c"><button type="button" class="mx-b' + (on ? ' on' : '') + (kn ? ' kn' : '') + '" data-mx="' + c.id + '|' + k + '" aria-pressed="' + on + '" style="' + (on ? 'background:' + COL[k % COL.length] + ';border-color:' + COL[k % COL.length] : '') + '" aria-label="' + esc(c.short || c.name) + ' in ' + esc(x.name) + '">' + (on ? (star ? '★' : '✓') : kn ? '·' : '') + '</button></td>';
          }).join('') + '</tr>';
      };
      var count = function (k) { var n = 0; chars.forEach(function (c) { if ((A[c.id] || []).indexOf(k) >= 0) n += weight(c.id); }); return n; };
      app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🎶') + 'Megamix groups</h2>' +
        '<p>' + esc(song ? song.title : 'The Megamix') + ' in ' + secs.length + ' sections. Before the last one, each section is done by a group that already knows that song from the show, and the groups change completely between sections. The last section is everyone. The track has the vocals, so anyone can be in any section: nobody needs to sing their own solo.</p>' +
        '<p class="small muted">★ their big song · ✓ in this section · · knows this song from the show. Tap a box to put someone in or take them out. The rehearsal plan teaches each section to its group right after the original song.</p></div>' +
        (probs.length || clash.length ? '<div class="card" style="border-left:6px solid #d9822b"><h3 style="margin-top:0">' + sym('⚠️') + 'To look at</h3><ul class="small">' + probs.concat(clash).map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + '</ul></div>' : '<div class="card" style="border-left:6px solid #24935d"><p style="margin:0">' + sym('✅') + 'Nobody is in two sections in a row, and everyone does songs they know.</p></div>') +
        '<div class="card" style="overflow-x:auto"><table class="mx-t small"><thead>' + head + '<tr><td class="muted">' + ((T.show.cast || []).length ? 'Company members' : 'About (before casting)') + '</td>' + secs.map(function (x, k) { return '<td class="muted" style="text-align:center">' + (x.all ? 'all' : count(k)) + '</td>'; }).join('') + '</tr></thead><tbody>' +
        groups.map(function (g) { var cs = chars.filter(function (c) { return c.group === g.id; }); return cs.length ? '<tr><td colspan="' + (secs.length + 1) + '" class="mx-g">' + esc(g.name) + '</td></tr>' + cs.map(row).join('') : ''; }).join('') +
        chars.filter(function (c) { return !groups.some(function (g) { return g.id === c.group; }); }).map(row).join('') + '</tbody></table></div>' +
        '<div class="card"><h3 style="margin-top:0">The groups</h3>' + secs.map(function (x, k) {
          var who = x.all ? 'Everyone' : chars.filter(function (c) { return (A[c.id] || []).indexOf(k) >= 0; }).map(function (c) { var n = castOf(c.id); return esc(c.short || c.name) + (n.length ? ' <span class="muted">(' + esc(n.map(function (q) { return T.shortName ? T.shortName(q.name) : q.name; }).join(', ')) + ')</span>' : ''); }).join(', ');
          return '<p style="margin:6px 0"><b style="color:' + COL[k % COL.length] + '">' + (k + 1) + '. ' + esc(x.name) + '</b>' + (x.note ? ' <span class="muted small">(' + esc(x.note) + ')</span>' : '') + '<br>' + (who || '<span class="muted">nobody yet</span>') + '</p>';
        }).join('') + '</div>' +
        timingCard() +
        '<div class="dock"><div class="in"><button class="btn quiet" id="mxall">Back to the suggestion</button><button class="btn quiet" onclick="print()">' + icon('print') + 'Print</button><button class="btn primary" id="mxsv" data-save>Save</button></div></div>';
      app.querySelectorAll('[data-mx]').forEach(function (b) { b.onclick = function () {
        var q = b.dataset.mx.split('|'), cid = q[0], k = +q[1], cur = (A[cid] || []).slice(), i = cur.indexOf(k);
        if (i >= 0) cur.splice(i, 1); else cur.push(k);
        cur.sort(function (x, y) { return x - y; });
        if (JSON.stringify(cur) === JSON.stringify(sug[cid] || [])) delete saved.assign[cid]; else saved.assign[cid] = cur;
        draw();
      }; });
      app.querySelectorAll('[data-undo]').forEach(function (b) { b.onclick = function () { delete saved.assign[b.dataset.undo]; draw(); }; });
      document.getElementById('mxall').onclick = function () { if (Object.keys(saved.assign).length && !confirm('Go back to the suggested groups? Your changes here are replaced (Save to keep it).')) return; saved.assign = {}; draw(); };
      document.getElementById('mxsv').onclick = function () { T.show.megamix = saved; T.saveShow('Megamix groups saved'); };
      wireTiming();
    }
    /* the timing card: the music, the section starts (tap while it plays, or type, ± half a second) */
    function timingCard() {
      var tr = (T.show.tracks || {})[s.megamix.song] || {}, m = saved.music || {}, mu = musicOf(m), times = saved.times || [];
      var opt = function (v, label, on) { return '<option value="' + v + '"' + (on ? ' selected' : '') + '>' + label + '</option>'; };
      var fmt = function (t) { return t == null ? '' : Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4); };
      return '<div class="card"><h3 style="margin-top:0">' + sym('⏱') + 'Timing</h3><p class="small muted">Play the Megamix and tap Now the moment each section’s group should start (that is their count 1). Everyone gets a yellow GET READY 3 seconds before, then GO, and the group before ' + WORD().clears + '.</p>' +
        '<div class="switch"><span><b>Staging</b></span><div class="seg" id="mxstg"><button type="button" data-stg="stay" aria-pressed="' + ((saved.staging || 'stay') !== 'exits') + '">Everyone stays on stage: the dancing group comes downstage</button><button type="button" data-stg="exits" aria-pressed="' + (saved.staging === 'exits') + '">Exits and entrances</button></div></div>' +
        '<div class="row" style="flex-wrap:wrap"><label class="f grow" style="margin:0">Megamix music<select id="mxmu">' + opt('', 'Pick…', !mu) +
        (tr.rehearsal ? opt('rehearsal', 'With vocals (guide track)', !m.own && mu && mu.kind === 'rehearsal') : '') + (tr.performance ? opt('performance', 'Band track (no singers)', !m.own && mu && mu.kind === 'performance') : '') +
        (m.own ? opt('own', 'Your own recording (uploaded)', true) : '') + '</select></label><label class="btn" style="margin:0">' + sym('⬆️') + 'Upload a recording<input type="file" id="mxup" accept="audio/*" hidden></label></div>' +
        (mu ? '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn primary" id="mxtap">' + sym('⏱') + 'Tap the section starts while it plays</button>' + ((saved.times || []).some(function (x) { return x != null; }) ? '<a class="btn" href="#/teacher/megamix/run">' + icon('play') + 'Rehearse the Megamix</a>' : '') + '</div>' : '<p class="err small">Pick or upload the Megamix music.</p>') +
        '<div style="margin-top:8px">' + secs.map(function (x, k) { return '<div class="row" style="gap:6px;align-items:center;margin:4px 0"><b style="color:' + COL[k % COL.length] + ';min-width:16em">' + (k + 1) + '. ' + esc(x.name) + '</b><button type="button" class="btn small" data-tn="' + k + '|-0.5" aria-label="Half a second earlier">−</button><input data-tt="' + k + '" value="' + fmt(times[k]) + '" placeholder="0:00" style="width:80px" aria-label="When ' + esc(x.name) + ' starts"><button type="button" class="btn small" data-tn="' + k + '|0.5" aria-label="Half a second later">+</button></div>'; }).join('') + '</div>' +
        '<p class="small muted" id="mxmsg">Changing the music? Tap the times again: each recording has its own timing. Save to keep them.</p></div>';
    }
    function wireTiming() {
      var $ = function (id) { return document.getElementById(id); };
      var parse = function (v) { v = String(v || '').trim(); if (!v) return null; var m = v.match(/^(\d+):(\d+(?:\.\d+)?)$/), x = m ? +m[1] * 60 + +m[2] : +v; return isNaN(x) ? null : Math.max(0, +x.toFixed(2)); };
      app.querySelectorAll('[data-stg]').forEach(function (b) { b.onclick = function () { saved.staging = b.dataset.stg; T.show.megamix = Object.assign({}, T.show.megamix || {}, { staging: saved.staging }); draw(); }; });
      $('mxmu').onchange = function () { if (this.value === 'own') return; saved.music = this.value ? { kind: this.value } : {}; draw(); };
      $('mxup').onchange = function () {
        var f = this.files[0]; if (!f) return; $('mxmsg').textContent = 'Uploading ' + f.name + '…';
        f.arrayBuffer().then(function (buf) { return T.audioCtx().decodeAudioData(buf.slice(0)).then(function () { var ver = Date.now().toString(36); return Store.putTrack(T.key, T.proof, '__megamix', 'performance', buf, ver).then(function () { saved.music = { own: ver }; draw(); T.toast('Megamix music uploaded. Save to keep it.'); }); }); })
          .catch(function (e) { $('mxmsg').textContent = 'That file could not be used: ' + (e.message || 'not an audio file') + '.'; });
      };
      app.querySelectorAll('[data-tt]').forEach(function (x) { x.onchange = function () { (saved.times = saved.times || [])[+x.dataset.tt] = parse(x.value); draw(); }; });
      app.querySelectorAll('[data-tn]').forEach(function (b) { b.onclick = function () { var q = b.dataset.tn.split('|'), k = +q[0], T0 = saved.times = saved.times || []; T0[k] = Math.max(0, +((T0[k] || 0) + +q[1]).toFixed(2)); draw(); }; });
      var tb = $('mxtap'); if (!tb) return;
      tb.onclick = function () {
        var mu = musicOf(saved.music), P = audioFor(mu), k = 0, times = (saved.times = (saved.times || []).slice());
        var bar = document.createElement('div'); bar.className = 'dock'; bar.innerHTML = '<div class="in"><b id="mxwho" class="grow"></b><b id="mxclk" class="lt-time"></b><button class="btn primary lt-now" id="mxnow">Now</button><button class="btn quiet" id="mxstop">Done</button></div>';
        document.body.appendChild(bar);
        var show = function () { var w = document.getElementById('mxwho'); if (w) w.textContent = k < secs.length ? 'Tap Now (or Space) when ' + (k + 1) + '. ' + secs[k].name + ' starts' : 'All set.'; };
        var raf = 0, clk = function () { var c = document.getElementById('mxclk'); if (c) c.textContent = T.clock(P.audio.currentTime); raf = requestAnimationFrame(clk); };
        var key = function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); now(); } };
        var end = function () { P.audio.pause(); cancelAnimationFrame(raf); document.removeEventListener('keydown', key); bar.remove(); draw(); T.toast('Section times set. Rehearse to check them, then Save.'); };
        var now = function () { if (k >= secs.length) return end(); times[k] = +P.audio.currentTime.toFixed(2); saved.times = times; k++; show(); if (k >= secs.length) setTimeout(end, 800); };
        document.getElementById('mxnow').onclick = now; document.getElementById('mxstop').onclick = end; document.addEventListener('keydown', key);
        T.cleanup.push(function () { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); bar.remove(); });
        show(); P.ready.then(function () { P.audio.currentTime = 0; P.audio.play(); clk(); }, function (e) { T.toast(e.message, 5000); end(); });
      };
    }
    draw();
  };
})();
