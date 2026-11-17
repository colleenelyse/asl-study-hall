/* asl.cool/theatre: touch and physical moments (Colleen 2026-10-24: "we have to have an early whole group lesson and practice with consent for
   physical touch. even if the script says so. we tap in with anyone before a scene where we touch"; "Troy twirls Gabriella, who bumps into Zeke -
   this will need some dedicated rehearsal time. look for other moments, primarily physical movements that have a smaller group of students than
   the scene that might need designated time").
   The show file lists the moments (show.bits, in our own words); the teacher can change each one (tap in or not, minutes on its own, hide) and
   add her own (choreography): T.show.moves = { set: { id: { touch, own, hide } }, add: [{ id, scene, song, chars, what, touch, own }] }.
   - tap in: the students in a moment see "Tap in first" on Today and their calendar, and the teacher sees it on the day plan, for every group
     rehearsing its scene or song (production.js);
   - own > 0: the semester plan gives it that many minutes with just those people, soon after its scene or dance is first staged (rehearsal-plan.js);
   - the consent lesson: a whole-Company day early in the semester plan (season.js, focus 'consent'). */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var M = function () { var m = T.show.moves = T.show.moves || {}; m.set = m.set || {}; m.add = m.add || []; return m; };
  var nameOf = function (c) { var x = T.charById(c); return x ? x.short || x.name : c; };
  function list() {
    var set = (T.show.moves && T.show.moves.set) || {};
    var D = window.DEFAULT_SHOW, bits = T.O().bits || (D && D.title === T.O().title ? D.bits : null) || [];      // a show saved before the list existed: the show file's
    var base = bits.map(function (b) { return Object.assign({}, b, set[b.id] || {}); });
    return base.concat(((T.show.moves && T.show.moves.add) || []).map(function (b) { return Object.assign({ mine: true }, b); }))
      .sort(function (a, b) { return sceneIx(a.scene) - sceneIx(b.scene); });
  }
  var sceneIx = function (id) { return T.O().scenes.findIndex(function (s) { return s.id === id; }); };
  /* is this student (their characters) in the moment? a group (the Jocks) counts for its members too */
  function hasMe(b, chars) { return b.chars.some(function (c) { return chars.indexOf(c) >= 0 || T.groupMembers(c).some(function (m) { return chars.indexOf(m) >= 0; }); }); }
  /* the touch moments a rehearsal group works on: its scenes, its songs. Not when nobody moves: a table read, a vocals rehearsal */
  var MOVING = ['acting', 'dance', 'run', 'dress', 'tech', 'show', 'share'];
  function touchIn(g, chars) {
    if (MOVING.indexOf(g.focus) < 0 || /table read/i.test(g.note || g.where || '')) return [];
    return list().filter(function (b) { return b.touch && !b.hide && (g.bit ? b.id === g.bit : (g.scenes || []).indexOf(b.scene) >= 0 || (b.song && (g.songs || []).indexOf(b.song) >= 0)) && (!chars || hasMe(b, chars)); });
  }
  function tapText(bs, chars, g) {
    if (!bs.length) return '';
    var who = []; bs.forEach(function (b) { b.chars.forEach(function (c) { if ((!chars || chars.indexOf(c) < 0) && who.indexOf(c) < 0) who.push(c); }); });
    var names = who.map(nameOf), list2 = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || '';
    return '🤝 Tap in first' + (chars && list2 ? ' with ' + list2 : '') + (g && g.bit ? '' : ': ' + bs.map(function (b) { return b.what; }).join('; '));
  }
  T.Moves = {
    list: list, touchIn: touchIn, tapText: tapText, hasMe: hasMe,
    forPlan: function () { return list().filter(function (b) { return !b.hide && b.own > 0; }); }
  };

  /* ---------- Teacher mode › Production › Touch & moments ---------- */
  var STEPS = ['Before a scene or song with touch, go to each person in it.', 'Say or show what the touch is: “For the twirl I hold your hand and turn you. Is that OK?”',
    'They answer yes, no, or “something else” (a high-five, an air hug, no touch). Thumbs up or down, a yes/no card or an AAC device all count.',
    'Every answer is OK, and it can change any day. A “no” changes the blocking, never the person.', 'After the scene, check out: “Was that OK?”'];
  var LESSON = ['What consent means on stage: the script says what happens, the people say how.', 'Our tap-in, step by step (the five steps above), shown by the teachers.',
    'Pairs practice tapping in for safe touches: a high-five, a handshake, a shoulder tap.', 'Practice saying or showing no, and hearing no with a smile: “Thanks for telling me.”',
    'Stage options instead of touch: an air hug, a hand hovering, a turn without holding on.', 'Our stop signal during a scene, and what everyone does when they see it.'];
  var MINS = [0, 5, 10, 15, 20, 30];
  T.movesView = function () {
    var O = T.O(), ls = list(), add = T.movesAdd || { scene: O.scenes[0].id, chars: [], touch: true, own: 10 };
    var sceneOpts = function (v) { return O.scenes.map(function (s) { return '<option value="' + s.id + '"' + (s.id === v ? ' selected' : '') + '>Scene ' + s.num + ': ' + esc(s.place) + '</option>'; }).join(''); };
    var songsOf = function (sc) { return O.songs.filter(function (so) { return so.scene === sc; }); };
    var row = function (b) {
      var sc = T.sceneById(b.scene), so = b.song && T.songById(b.song);
      return '<div class="switch" style="flex-wrap:wrap;gap:8px' + (b.hide ? ';opacity:.5' : '') + '"><span class="grow" style="min-width:240px"><b>Scene ' + (sc ? sc.num : '?') + (so ? ' · “' + esc(so.title) + '”' : '') + ':</b> ' + esc(b.what) +
        '<br><span class="small">' + b.chars.map(function (c) { return T.chip ? T.chip(c) : esc(nameOf(c)); }).join(' ') + (b.why ? ' <span class="muted">' + esc(b.why) + '</span>' : '') + '</span></span>' +
        '<label class="row small" style="gap:4px"><input type="checkbox" data-mv="touch" data-id="' + b.id + '"' + (b.touch ? ' checked' : '') + '>🤝 Tap in</label>' +
        '<label class="row small" style="gap:4px">On its own<select data-mv="own" data-id="' + b.id + '">' + MINS.map(function (m) { return '<option value="' + m + '"' + ((b.own || 0) === m ? ' selected' : '') + '>' + (m ? m + ' min' : 'no') + '</option>'; }).join('') + '</select></label>' +
        (b.mine ? '<button class="btn small quiet" data-mvdel="' + b.id + '">Delete</button>' : '<button class="btn small quiet" data-mvhide="' + b.id + '">' + (b.hide ? 'Show' : 'Hide') + '</button>') + '</div>';
    };
    return '<div class="card"><h3>' + sym('🤝') + 'Consent and touch</h3><p>Every touch is asked first, even when the script calls for it. The semester plan starts with a whole-Company lesson and practice (the second rehearsal day, after the first table read).</p>' +
      '<p><b>Tap in</b> before every scene or song with touch:</p><ol>' + STEPS.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<details><summary class="btn quiet small">The consent lesson (about 40 minutes)</summary><ol>' + LESSON.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></details></div>' +
      '<div class="card"><h3>' + sym('🎯') + 'Touch and physical moments</h3><p class="muted small">🤝 Tap in: the students in it see “Tap in first” on Today and their calendar, and you see it on the day plan, whenever its scene or song is rehearsed. ' +
      'On its own: the semester plan gives it that time with just these people, soon after its scene (or dance) is first staged. Make the semester plan again to use your changes.</p>' +
      (ls.length ? ls.map(row).join('') : '<p class="muted">No moments yet.</p>') + '</div>' +
      '<div class="card"><h3>Add a moment</h3><p class="muted small">For choreography and anything else: a lift, a partner turn, a fall, a run through the house.</p>' +
      '<label class="f">Scene<select id="mvsc">' + sceneOpts(add.scene) + '</select></label>' +
      (songsOf(add.scene).length ? '<label class="f">Song (if it happens in one)<select id="mvso"><option value="">Not in a song</option>' + songsOf(add.scene).map(function (so) { return '<option value="' + so.id + '"' + (so.id === add.song ? ' selected' : '') + '>' + esc(so.title) + '</option>'; }).join('') + '</select></label>' : '') +
      '<p class="muted small">Who</p><div class="row">' + O.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return '<button type="button" class="btn small" data-mvc="' + c.id + '" aria-pressed="' + (add.chars.indexOf(c.id) >= 0) + '">' + esc(c.short || c.name) + '</button>'; }).join('') + '</div>' +
      '<label class="f">What happens<input id="mvwhat" value="' + esc(add.what || '') + '" placeholder="e.g. Chad lifts Taylor at the end of the chorus"></label>' +
      '<div class="row"><label class="row small" style="gap:4px"><input type="checkbox" id="mvtouch"' + (add.touch ? ' checked' : '') + '>🤝 Tap in</label><label class="row small" style="gap:4px">On its own<select id="mvown">' + MINS.map(function (m) { return '<option value="' + m + '"' + (add.own === m ? ' selected' : '') + '>' + (m ? m + ' min' : 'no') + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" id="mvadd">Add</button></div><p class="err" id="mvmsg" role="alert"></p></div>';
  };
  T.wireMoves = function (redraw) {
    var m = function () { return M(); }, O = T.O();
    var add = T.movesAdd = T.movesAdd || { scene: O.scenes[0].id, chars: [], touch: true, own: 10 };
    var find = function (id) { return m().add.find(function (b) { return b.id === id; }); };
    var setOf = function (id) { var b = find(id); if (b) return b; return (m().set[id] = m().set[id] || {}); };
    app.querySelectorAll('[data-mv]').forEach(function (el) {
      el.onchange = function () { var o = setOf(el.dataset.id); if (el.dataset.mv === 'touch') o.touch = el.checked; else o.own = +el.value; T.saveShow('Saved'); };
    });
    app.querySelectorAll('[data-mvhide]').forEach(function (b) { b.onclick = function () { var o = setOf(b.dataset.mvhide); o.hide = !o.hide; T.saveShow('Saved').then(redraw); }; });
    app.querySelectorAll('[data-mvdel]').forEach(function (b) { b.onclick = function () { m().add = m().add.filter(function (x) { return x.id !== b.dataset.mvdel; }); T.saveShow('Deleted').then(redraw); }; });
    var keep = function () { var w = document.getElementById('mvwhat'), so = document.getElementById('mvso'), t = document.getElementById('mvtouch'), o = document.getElementById('mvown'); if (w) add.what = w.value; if (so) add.song = so.value; if (t) add.touch = t.checked; if (o) add.own = +o.value; };
    var sc = document.getElementById('mvsc'); if (sc) sc.onchange = function () { keep(); add.scene = sc.value; add.song = ''; redraw(); };
    app.querySelectorAll('[data-mvc]').forEach(function (b) { b.onclick = function () { var c = b.dataset.mvc, k = add.chars.indexOf(c); if (k >= 0) add.chars.splice(k, 1); else add.chars.push(c); b.setAttribute('aria-pressed', k < 0); }; });
    var go = document.getElementById('mvadd');
    if (go) go.onclick = function () {
      keep(); var msg = document.getElementById('mvmsg');
      if (!add.chars.length) { msg.textContent = 'Tap who is in it.'; return; }
      if (!String(add.what || '').trim()) { msg.textContent = 'Say what happens, in a few words.'; return; }
      m().add.push({ id: 'u' + Math.random().toString(36).slice(2, 8), scene: add.scene, song: add.song || undefined, chars: add.chars.slice(), what: add.what.trim().slice(0, 160), touch: !!add.touch, own: add.own || 0 });
      T.movesAdd = null; T.saveShow('Added').then(redraw);
    };
  };
})();
