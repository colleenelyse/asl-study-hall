/* asl.cool/theatre: the daily rehearsal planner (Colleen, 2026-10-24). Plans every class day in two blocks, for every track (character or group),
   so nobody ever spends a block with nothing to do:
   - two teacher rooms (Room A, Room B); each room either keeps one group for the whole period (new choreography, a long scene being blocked)
     or splits into Block 1 and Block 2 and students switch (Troy can block a scene in Block 1 and learn basketball choreography in Block 2);
   - Group C: everyone not in a teacher room has a task card with a "done when" (lines, a sing-through, a dance review with the class video,
     a movie lab before a big number is staged, crew, costume research…). Two versions of every card: with two teachers only (self-run tasks
     the students already know, in sight of an adult) and with Company Mentors (a trained Mentor leads the group);
   - the weekday themes (Monday Character, Tuesday Music, Wednesday Scenes, Thursday Dance, Friday Perform), about 3 of every 4 teacher rooms;
   - no track does the same kind of work three days in a row; a weekly crew day for everyone but the four leads; music before dance;
     the hardest whole-group numbers first and back again and again.
   Works in the browser (T.RehearsalPlan) and in node (module.exports), from the show file alone, so it is ready before casting.
   plan(show, cfg) -> { days: [...], stats }. cfg: { days: [{ date, min }], fixed: { date: day }, leads: [ids], windows: {...} } */
(function (root) {
  'use strict';
  var KIND = { A: 'Acting', V: 'Vocals', D: 'Dance', R: 'Run', M: 'Group C' };
  var THEME = { 1: 'A', 2: 'V', 3: 'A', 4: 'D' };
  var THEME_NAME = { 1: 'Character Monday', 2: 'Music Tuesday', 3: 'Scene Work Wednesday', 4: 'Dance Thursday', 5: 'Full-Out Friday' };
  /* numbers where the ensemble reacts in the background: a movie lab (watch a short clip, name the background reactions) before they are first staged */
  var MOVIE = { m1: 'the first-day-of-school opening', m9: 'the basketball practice (teammates without the ball)', m16: 'the auditions (the students waiting their turn)', m21: 'the cafeteria (everyone reacting to each confession)', m38: 'the callbacks (the crowd that runs in from the gym and the lab)', s16: 'the championship game and the scholastic decathlon' };

  function plan(S, cfg) {
    var smallRole = function (c) { return !!c && (c.group === 'ensemble' || c.group === 'featured' || !!c.small); };
    var charById = function (id) { return S.characters.find(function (c) { return c.id === id; }); };
    var ALL = S.characters.filter(function (c) { return c.group !== 'helpers'; }).map(function (c) { return c.id; });
    var onFor = function (m, c) { if ((m.out || []).indexOf(c) >= 0) return false; if (m.on === '*' || m.on.indexOf(c) >= 0) return true; return !!m.big && smallRole(charById(c)); };
    var onOf = function (m) { return ALL.filter(function (c) { return onFor(m, c); }); };
    var name = function (c) { var x = charById(c); return x ? (x.short || x.name) : c; };
    var LEADS = cfg.leads || S.characters.filter(function (c) { return c.group === 'leads'; }).map(function (c) { return c.id; });
    var days = cfg.days.map(function (d, i) { var w = new Date(d.date + 'T12:00').getDay(); return { i: i, date: d.date, wd: w, min: d.min || 48 }; });
    var N = days.length;
    var sceneOrder = S.scenes.map(function (s) { return s.id; });
    var sceneOf = function (songId) { var so = S.songs.find(function (x) { return x.id === songId; }); return so && so.scene; };
    var songMin = function (so) { return so.minutes || 3; };

    /* ---------- the pieces ---------- */
    var pieces = [];
    S.scenes.forEach(function (sc) {
      var talk = S.moments.filter(function (m) { return m.scene === sc.id && !m.song; }); if (!talk.length) return;
      var who = {}; talk.forEach(function (m) { onOf(m).forEach(function (c) { who[c] = 1; }); });
      var min = talk.reduce(function (a, m) { return a + (m.minutes || 1); }, 0), ppl = Object.keys(who);
      pieces.push({ id: sc.id, type: 'scene', kind: 'A', sc: sc, label: 'Scene ' + sc.num + ' (' + sc.place + ')', short: 'Scene ' + sc.num, people: ppl, min: min,
        learn: Math.max(12, min * 8), polish: min * 5, done: 0, last: -99, n: 0, diff: min + ppl.length * 0.25, order: sceneOrder.indexOf(sc.id) });
    });
    S.songs.forEach(function (so) {
      var m = S.moments.find(function (x) { return x.song === so.id; }); if (!m) return;
      var ppl = onOf(m), big = !!m.big, min = songMin(so), whole = m.on === '*';
      var base = { song: so, sc: S.scenes.find(function (s) { return s.id === so.scene; }), min: min, big: big, order: sceneOrder.indexOf(so.scene) + 0.5, last: -99, n: 0, done: 0 };
      var mk = function (kind, part, people, learn, polish, extra) {
        var p = Object.assign({}, base, { id: so.id + kind + (part || ''), type: 'song', kind: kind, part: part || '', people: people, learn: learn, polish: polish,
          label: (part === 'p' ? 'featured singers: ' : part === 'c' ? 'ensemble: ' : '') + '“' + so.title + '”', diff: min + (big ? 2 : 0) + people.length * 0.12 }, extra || {});
        p.short = '“' + so.title + '”' + (part === 'p' ? ' (featured)' : part === 'c' ? ' (ensemble)' : '');
        pieces.push(p); return p;
      };
      if (big && !whole) {
        var prin = ppl.filter(function (c) { return !smallRole(charById(c)); }), cho = ppl.filter(function (c) { return smallRole(charById(c)); });
        var vp = mk('V', 'p', prin, min * 5, 0), vc = mk('V', 'c', cho, min * 6, 0);
        var va = mk('V', '', ppl, 0, min * 4, { needs: [vp, vc], together: true });
        var dp = mk('D', 'p', prin, min * 4, 0, { after: vp }), dc = mk('D', 'c', cho, min * 8, 0, { after: vc });
        mk('D', '', ppl, 0, min * 5, { needs: [dp, dc], after: va, together: true });
      } else {
        var v = mk('V', '', ppl, min * (whole ? 9 : big ? 7 : 5), min * 3, { whole: whole });
        mk('D', '', ppl, min * (whole ? 12 : big ? 8 : 4), min * 4, { after: v, whole: whole });
      }
    });
    /* physical moments with a few people (cfg.bits, moves.js: a twirl into a bump, a stage fall, a run through the house): rehearsed on their own,
       just those people, soon after their scene (or song) is first staged */
    (cfg.bits || []).forEach(function (b) {
      var sc = S.scenes.find(function (x) { return x.id === b.scene; }), ppl = (b.chars || []).filter(function (c) { return ALL.indexOf(c) >= 0; });
      if (!sc || !(b.own > 0) || !ppl.length) return;
      pieces.push({ id: 'bit:' + b.id, type: 'bit', kind: 'A', sc: sc, bit: b, label: 'Moment: ' + b.what + ' (Scene ' + sc.num + ')', short: 'Moment (Scene ' + sc.num + '): ' + b.what,
        people: ppl, min: 1, learn: b.own, polish: Math.round(b.own / 2), done: 0, last: -99, n: 0, diff: 1.5, order: sceneOrder.indexOf(b.scene) + 0.2,
        parent: b.song ? b.song + 'D' : b.scene });
    });
    var byId = {}; pieces.forEach(function (p) { byId[p.id] = p; });
    pieces.forEach(function (p) { if (p.type === 'bit') p.parent = byId[p.parent + 'p'] || byId[p.parent] || null; });      // a big number: the featured part's dance
    Object.keys(cfg.hold || {}).forEach(function (k) { if (byId[k]) byId[k].hold = cfg.hold[k]; });
    (cfg.credit || []).forEach(function (c) { var p = byId[c.id]; if (p) { p.done = c.done === 'learn' ? p.learn : c.done; p.n = 1; p.last = 0; } });
    var learned = function (p) { return p.done >= p.learn; };
    var i0 = 0;
    var ready = function (p) {      // music before dance; both halves before putting a number together
      if (p.hold && days[i0].date < p.hold) return false;
      if (p.type === 'bit' && p.parent && !(p.parent.done > 0)) return false;      // a moment comes after its scene (or dance) is first staged
      if (p.after && p.after.done < p.after.learn * 0.5 && !(p.after.together && p.after.n)) return false;
      if (p.needs && p.needs.some(function (q) { return q.done < q.learn * 0.6; })) return false;
      return true;
    };

    /* ---------- what each track did ---------- */
    var log = {}, crew = {}, lastTask = {}, movieDone = {}, cBlocks = {}, streak = {}, sized = {};
    ALL.forEach(function (c) { log[c] = []; crew[c] = {}; cBlocks[c] = 0; streak[c] = 0; });
    var weekOf = function (i) { var d = new Date(days[i].date + 'T12:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10); };
    var kindsOn = function (c, i) { return log[c][i] || ''; };
    var third = function (c, i, k) { return i >= 2 && kindsOn(c, i - 1).indexOf(k) >= 0 && kindsOn(c, i - 2).indexOf(k) >= 0; };
    var needsCrew = function (c, i) { return LEADS.indexOf(c) < 0 && !crew[c][weekOf(i)]; };
    var mark = function (i, people, k) { people.forEach(function (c) { if (log[c] && (log[c][i] || '').indexOf(k) < 0) log[c][i] = (log[c][i] || '') + k; }); };
    function varietyCost(people, kind, i) {
      var c = 0; people.forEach(function (p) { if (kindsOn(p, i - 1).indexOf(kind) >= 0) c += 1; if (kindsOn(p, i - 2).indexOf(kind) >= 0) c += 0.5; });
      return c / Math.max(1, people.length);
    }

    /* first sessions: every scene blocked, every song taught by about 45% of the class days, every dance started by about 60% */
    var at = function (d) { var k = days.findIndex(function (x) { return x.date >= d; }); return k < 0 ? N : k; };
    var deadline = function (p) { var dl = cfg.deadlines || {}; return p.type === 'scene' ? (dl.scene ? at(dl.scene) : N * 0.45) : p.kind === 'V' ? (dl.vocals ? at(dl.vocals) : N * 0.4) : (dl.dance ? at(dl.dance) : N * 0.6); };

    /* ---------- one teacher room ---------- */
    function value(p, people, i, theme, blockMin) {
      var frac = i / N, rem = p.learn ? Math.max(0, p.learn - p.done) / p.learn : 0, pol = p.polish ? Math.max(0, p.learn + p.polish - p.done) / (p.learn + p.polish) : 0;
      var v = (p.kind === theme ? ({ 1: 22, 2: 24, 3: 30, 4: 24 })[days[i].wd] || 20 : 0) + rem * (12 + 30 * frac) + pol * 6 + p.diff * (1 - frac) * 0.8 + Math.min(i - p.last, 12) * 0.35;
      if (rem > 0 && p.done === 0 && p.type !== 'bit') { var dl = deadline(p); v += 60 * Math.pow(Math.min(1, i / dl), 3); }      // never started, and its deadline is coming
      if (p.type === 'bit' && rem > 0) v += 30 + (p.parent ? Math.min(i - p.parent.last, 10) * 2 : 0);      // its scene or dance has been staged: now the moment
      if (p.big && rem === 0) v += Math.min(i - p.last, 10) * 0.6;      // the hardest numbers keep coming back
      if (rem === 0 && pol === 0) v -= 8;      // done: only as a review
      v -= varietyCost(people, p.kind, i) * 3;
      v -= people.filter(function (c) { return needsCrew(c, i); }).length * [0, 0, 0, 0.3, 0.9, 2][days[i].wd] * 0.4;
      v += people.length * 0.15;      // stage time for as many as possible
      people.forEach(function (c) { if (streak[c] >= 1) v += streak[c] * 2.5; });      // whoever has had no teacher room for days comes first
      if (p.last === i - 1) v -= 3;      // not the same thing as yesterday
      return v;
    }
    function callable(p, free, i) {      // who in this piece can come: free now, and not a third day of this kind
      var ok = p.people.filter(function (c) { return free.indexOf(c) >= 0 && !third(c, i, p.kind); });
      if ((p.type === 'scene' || p.type === 'bit') && ok.length < p.people.length) return null;      // a scene (or a moment) needs every actor
      if (ok.length < Math.min(2, p.people.length) || ok.length < p.people.length * 0.6) return null;
      return ok;
    }
    var wantsLong = function (p) {
      if (p.type === 'scene') return p.done === 0 && p.min >= 2.5 || p.min >= 5;
      if (p.kind === 'D') return p.done < p.learn * 0.5 && (p.part === 'c' || p.whole);
      if (p.kind === 'V') return p.done === 0 && p.min >= 3.5 && p.part === 'c';
      return false;
    };
    function pick(free, i, theme, blockMin, avoid, bonusFor) {
      var best = null;
      pieces.forEach(function (p) {
        if (avoid.indexOf(p) >= 0 || !ready(p) || p.whole) return;
        var ppl = callable(p, free, i); if (!ppl) return;
        var v = value(p, ppl, i, theme, blockMin) + (bonusFor ? ppl.filter(function (c) { return bonusFor.indexOf(c) >= 0; }).length * 1.2 : 0);
        if (!best || v > best.v) best = { p: p, people: ppl, v: v };
      });
      return best;
    }
    function bestPair(free, i, theme, blockMin, bonusFor) {
      var best = null, cands = [];
      pieces.forEach(function (p) { if (!ready(p)) return; var ppl = callable(p, free, i); if (ppl) cands.push({ p: p, people: ppl, v: value(p, ppl, i, theme, blockMin) + (bonusFor ? ppl.filter(function (c) { return bonusFor.indexOf(c) >= 0; }).length * 1.2 : 0) }); });
      cands.sort(function (a, b) { return b.v - a.v; });
      cands.forEach(function (x) { if (x.p.whole && x.people.length < free.length) return; if (x.p.whole || x.people.length >= ALL.length * 0.45) { var s = x.v * 1.6 + 4; if (!best || s > best.s) best = { x: x, y: null, s: s, both: true }; } });      // a big scene or number: both teachers together
      cands.slice(0, 40).forEach(function (x) {
        if (x.p.whole) return;
        cands.forEach(function (y) {
          if (y.p.whole) return;
          if (y.p === x.p || (y.p.song && x.p.song && y.p.song === x.p.song && y.p.kind === x.p.kind && (!y.p.part || !x.p.part))) return;
          var left = free.filter(function (c) { return x.people.indexOf(c) < 0; }), p2 = callable(y.p, left, i); if (!p2) return;
          var s = x.v + value(y.p, p2, i, theme, blockMin) + (bonusFor ? p2.filter(function (c) { return bonusFor.indexOf(c) >= 0; }).length * 1.2 : 0);
          if (!best || s > best.s) best = { x: x, y: { p: y.p, people: p2 }, s: s };
        });
      });
      return best;
    }
    function credit(p, people, i, mins) { p.done += mins; p.n++; p.last = i; if (p.needs) p.needs.forEach(function (q) { q.done += mins * 0.4; }); }

    /* ---------- Group C ---------- */
    function inWindow(w, d) { return w && d >= w[0] && d <= w[1]; }
    function cTask(c, i, bmin, b, dayRooms) {
      var d = days[i].date, W = cfg.windows || {}, opts = [];
      var mine = pieces.filter(function (p) { return p.people.indexOf(c) >= 0; });
      if (inWindow(W.sizes, d) && !sized[c]) { sized[c] = 1; return { task: 'sizes' }; }      // the sizes station: every track once, the follow-up list in the app does the rest
      if (inWindow(W.photos, d) && needsCrew(c, i)) return { task: 'photos' };
      if (needsCrew(c, i) && (days[i].wd >= 3 || b === 2) && bmin >= 12) return { task: 'crew' };
      /* movie lab: a number with a background crowd is staged in the next two class days */
      var soon = soonKeys(i);

      if (inWindow(W.research, d) && !lastTask[c + 'research']) return { task: 'research' };
      if (inWindow(W.list, d) && !lastTask[c + 'list']) return { task: 'list' };
      var prev = lastTask[c] || '';
      var need = function (p) { return Math.min(1, p.done / (p.learn + (p.polish || 0))) + (i - p.last <= 1 ? 0 : -0.05 * Math.min(i - p.last, 6)); };      // least secure first, and not just rehearsed
      var byNeed = function (a, b) { return need(a) - need(b); };
      var sc = mine.filter(function (p) { return p.type === 'scene' && (p.done > 0 || p.read && soon.indexOf(p.id) >= 0); }).sort(byNeed)[0];
      var sg = mine.filter(function (p) { return p.kind === 'V' && p.done > 0; }).sort(byNeed)[0];
      var dn = mine.filter(function (p) { return p.kind === 'D' && p.done > 0; }).sort(byNeed)[0];
      if (sc) opts.push({ task: 'lines', piece: sc, k: 'A' });
      if (sg) opts.push({ task: 'sing', piece: sg, k: 'V' });
      if (dn) opts.push({ task: 'dance', piece: dn, k: 'D' });
      opts.push({ task: 'react', k: 'R' });
      /* not the same kind as today's teacher room or the last Group C task, and not a third day of it */
      var today = dayRooms.filter(function (r) { return r.people.indexOf(c) >= 0; }).map(function (r) { return r.kind; });
      var ok = opts.filter(function (o) { return o.task !== prev && today.indexOf(o.k) < 0 && !(o.k && third(c, i, o.k)); });
      return (ok[0] || opts.filter(function (o) { return o.task !== prev; })[0] || opts[0]);
    }

    /* what is about to be staged: a number whose dance is ready to start, a big scene not blocked yet */
    function soonKeys(i) {
      var k = [];
      pieces.forEach(function (p) {
        if (p.kind === 'D' && p.done === 0 && ready(p) && p.song && MOVIE[p.song.id]) k.push(p.song.id);
        if (p.type === 'scene' && p.done === 0 && (MOVIE[p.id] || i > N * 0.2)) k.push(p.id);
      });
      return k;
    }
    var movieUsed = {}, movieKey = function (p) { var k = p.song ? p.song.id : p.id; if (!MOVIE[k] || movieUsed[k] || !(p.kind === 'D' || p.type === 'scene')) return null; movieUsed[k] = 1; return k; };

    /* ---------- the days ---------- */
    var out = [];
    var fixed = cfg.fixed || {};
    var fridays = 0;
    days.forEach(function (day, i) {
      i0 = i;
      var D = { day: i + 1, date: day.date, wd: day.wd, min: day.min, theme: '', rooms: [], groupC: [], title: '', kind: 'work' };
      var f = fixed[day.date];
      if (f && f.kind !== 'tableread') {
        Object.assign(D, f, { kind: f.kind || 'special' });
        if (f.credit) f.credit.forEach(function (c) { var p = byId[c[0]]; if (p) credit(p, [], i, c[1]); });
        ALL.forEach(function (c) { log[c][i] = f.mark || 'R'; });
        if (f.crewAll) ALL.forEach(function (c) { crew[c][weekOf(i)] = 1; });
        if (f.photos) ALL.forEach(function (c) { if (LEADS.indexOf(c) < 0) crew[c][weekOf(i)] = 1; });
        out.push(D); return;
      }
      var theme = day.min <= 20 ? '' : THEME[day.wd] || '';
      D.theme = day.wd === 5 ? THEME_NAME[5] : THEME_NAME[day.wd];
      var firstOfWeek = !days[i - 1] || weekOf(i - 1) !== weekOf(i);
      D.warmup = firstOfWeek && day.wd <= 2 && day.min >= 48 ? 'company' : day.min <= 35 ? 'react' : { 2: 'vocal', 4: 'body', 5: 'energy', 1: 'company' }[day.wd] || 'company';
      var blocks;
      if (day.min <= 20) blocks = [];
      else if (day.min <= 35) blocks = [{ b: 1, from: 7, to: 30 }];
      else if (D.warmup === 'company') blocks = [{ b: 1, from: 13, to: 27 }, { b: 2, from: 29, to: 42 }];
      else if (day.wd === 4) blocks = [{ b: 1, from: 12, to: 26 }, { b: 2, from: 28, to: 40 }];
      else blocks = [{ b: 1, from: 10, to: 25 }, { b: 2, from: 27, to: 41 }];
      D.blocks = blocks;
      var rooms = [], groupC = [];
      var len = function (bl) { return bl.to - bl.from; };

      /* Friday: perform the week's work full out, without stopping (or an act's scenes every other Friday), then notes */
      if (day.wd === 5 && day.min >= 48 && !(f && f.kind === 'tableread')) {
        fridays++;
        var wk = out.filter(function (x) { return x.kind === 'work' && weekOf(x.day - 1) === weekOf(i); });
        /* a song is run as the whole number (sung and danced) once its parts are half learned; otherwise the part that was worked */
        var runItem = function (p) {
          if (p.type === 'bit') return null;      // runs with its scene
          if (p.type === 'scene') return p.done >= p.learn * 0.5 ? p : null;
          var whole = pieces.find(function (q) { return q.song === p.song && q.kind === 'D' && !q.part; });
          var parts = pieces.filter(function (q) { return q.song === p.song && q.part; });
          if (whole && parts.every(function (q) { return q.done >= q.learn * 0.5; }) && (whole.together || whole.done >= whole.learn * 0.5)) return whole;
          return p.done >= p.learn * 0.5 ? p : null;
        };
        var worked = []; wk.forEach(function (x) { x.rooms.forEach(function (r) { var p = byId[r.piece] && runItem(byId[r.piece]); if (p && worked.indexOf(p) < 0) worked.push(p); }); });
        var runSet, runTitle;
        var blockedScenes = pieces.filter(function (p) { return p.type === 'scene' && p.done >= p.learn * 0.8; });
        if (fridays >= 4 && fridays % 2 === 0 && blockedScenes.length >= 3) {      // an act's scenes, in order, with their learned songs
          var act = (fridays / 2) % 2 === 0 ? 1 : 2, split = cfg.actSplit || 's12';
          var inAct = function (p) { var o = p.order; return act === 1 ? o < sceneOrder.indexOf(split) : o >= sceneOrder.indexOf(split); };
          var sc2 = blockedScenes.filter(inAct); if (sc2.length < 2) sc2 = blockedScenes;
          var songsIn = pieces.filter(function (p) { return p.type === 'song' && !p.part && p.kind === 'D' && runItem(p) === p && sc2.some(function (s) { return s.sc && p.sc && s.sc.id === p.sc.id; }); });
          runSet = sc2.concat(songsIn); runTitle = 'Act ' + act + ' run: everything blocked so far';
        } else { runSet = worked; runTitle = 'Full out: this week’s work in show order'; }
        runSet = runSet.filter(function (p, k, a) { return a.indexOf(p) === k; }).sort(function (a, b) { return a.order - b.order; });
        /* keep what fits in about 24 minutes of running (a song or scene takes about 1.5 times its length with entrances) */
        var t = 0, keep = []; runSet.forEach(function (p) { var m = (p.type === 'scene' ? p.min : p.min) * 1.5; if (t + m <= 24 || !keep.length) { keep.push(p); t += m; } });
        var ppl = []; keep.forEach(function (p) { p.people.forEach(function (c) { if (ppl.indexOf(c) < 0) ppl.push(c); }); });
        keep.forEach(function (p) { if (p.type === 'scene') { p.done += p.min * 2; p.last = i; } else { p.done += p.min * 1.5; p.last = i; } });
        D.kind = 'friday'; D.title = runTitle;
        D.run = { pieces: keep.map(function (p) { return p.id; }), people: ppl, minutes: Math.round(t) };
        rooms.push({ room: 'AB', block: 0, piece: null, kind: 'R', people: ppl, what: runTitle, run: keep.map(function (p) { return p.short; }) });
        mark(i, ppl, 'R');
        var rest = ALL.filter(function (c) { return ppl.indexOf(c) < 0; });
        var crewers = rest.filter(function (c) { return needsCrew(c, i); }), watchers = rest.filter(function (c) { return crewers.indexOf(c) < 0; });
        if (crewers.length) { groupC.push({ block: 0, task: 'runcrew', people: crewers }); crewers.forEach(function (c) { crew[c][weekOf(i)] = 1; }); mark(i, crewers, 'M'); }
        if (watchers.length) { groupC.push({ block: 0, task: 'notes', people: watchers }); mark(i, watchers, 'M'); }
        D.rooms = rooms; D.groupC = groupC; out.push(D); return;
      }
      if (day.min <= 20) {
        D.kind = 'short'; D.title = 'Early dismissal: one activity for the whole Company';
        var fin = pieces.filter(function (p) { return p.whole && p.kind === 'D'; }).sort(function (a, b) { return a.last - b.last; })[0];
        rooms.push({ room: 'AB', block: 0, piece: fin ? fin.id : null, kind: 'R', people: ALL.slice(), what: fin ? 'Sing and dance ' + fin.short + ' once, full out, then one note' : 'Warm-up and one run of the finale' });
        if (fin) { fin.done += 4; fin.last = i; }
        mark(i, ALL, 'R'); D.rooms = rooms; out.push(D); return;
      }
      if (f && f.kind === 'tableread') {      // the first rehearsal week: the whole Company reads an act together
        D.kind = 'work'; D.title = f.title;
        var sc3 = pieces.filter(function (p) { return p.type === 'scene' && f.scenes.indexOf(p.id) >= 0; });
        sc3.forEach(function (p) { p.read = true; });
        rooms.push({ room: 'AB', block: 0, piece: null, kind: 'A', people: ALL.slice(), what: f.title, tableread: f.scenes });
        mark(i, ALL, 'A'); D.rooms = rooms; out.push(D); return;
      }

      /* Block 1: the best pair of rooms; a room keeps its group for the whole period when the work needs it */
      var b1 = blocks[0], b2 = blocks[1];
      var pr = bestPair(ALL.slice(), i, theme, len(b1));
      var used1 = [];
      [[pr && pr.both ? 'AB' : 'A', pr && pr.x], ['B', pr && pr.y]].forEach(function (r) {
        if (!r[1]) return;
        var p = r[1].p, long = !!b2 && wantsLong(p) && !p.whole;
        rooms.push({ room: r[0], block: long ? 0 : 1, piece: p.id, kind: p.kind, people: r[1].people, what: p.short, stage: p.done === 0 ? 'new' : learned(p) ? 'polish' : 'continue', movie: movieKey(p) });
        credit(p, r[1].people, i, long ? len(b1) + len(b2) + 2 : len(b1)); mark(i, r[1].people, p.kind); used1 = used1.concat(r[1].people);
      });
      var free1 = ALL.filter(function (c) { return used1.indexOf(c) < 0; });
      /* Block 2 for rooms that switch */
      var free2 = [];
      if (b2) {
        var longPeople = []; rooms.forEach(function (r) { if (r.block === 0) longPeople = longPeople.concat(r.people); });
        var lastBefore = !days[i + 1] || days[i + 1].wd === 5 || weekOf(i + 1) !== weekOf(i);
        var crewNow = lastBefore ? ALL.filter(function (c) { return needsCrew(c, i) && longPeople.indexOf(c) < 0; }) : [];      // the weekly crew day, before the week runs out
        var avail = ALL.filter(function (c) { return longPeople.indexOf(c) < 0 && crewNow.indexOf(c) < 0; });
        var open = ['A', 'B'].filter(function (R) { return !rooms.some(function (r) { return r.room.indexOf(R) >= 0 && r.block === 0; }); });
        var avoid = rooms.map(function (r) { return byId[r.piece]; });
        var got = [];
        if (open.length === 2) {
          var pr2 = bestPair(avail, i, theme, len(b2), free1);
          if (pr2) { got.push([pr2.both ? 'AB' : 'A', pr2.x]); if (pr2.y) got.push(['B', pr2.y]); }
        } else if (open.length === 1) {
          var one = pick(avail, i, theme, len(b2), avoid, free1); if (one) got.push([open[0], one]);
        }
        got.forEach(function (g) {
          var p = g[1].p;
          rooms.push({ room: g[0], block: 2, piece: p.id, kind: p.kind, people: g[1].people, what: p.short, stage: p.done === 0 ? 'new' : learned(p) ? 'polish' : 'continue', movie: movieKey(p) });
          credit(p, g[1].people, i, len(b2)); mark(i, g[1].people, p.kind);
        });
        var used2 = []; rooms.forEach(function (r) { if (r.block !== 1) used2 = used2.concat(r.people); });
        free2 = ALL.filter(function (c) { return used2.indexOf(c) < 0; });
      }
      /* Group C: a task card for every track not in a teacher room, block by block */
      var dayRooms = rooms.slice();
      var cFor = function (free, b, bmin) {
        var gs = {};
        free.forEach(function (c) {
          var t = cTask(c, i, bmin, b, dayRooms), key = t.task;
          var g = gs[key] = gs[key] || { block: b, task: t.task, people: [], each: {} };
          g.people.push(c); if (t.piece) g.each[c] = t.piece.id;
          lastTask[c] = t.task; if (t.task === 'research' || t.task === 'list') lastTask[c + t.task] = 1;
          if (t.task === 'crew' || t.task === 'photos') crew[c][weekOf(i)] = 1;
          if (t.task === 'movie') movieDone[c + t.key] = 1;
          cBlocks[c]++;
        });
        Object.keys(gs).forEach(function (k) { groupC.push(gs[k]); });
      };
      if (b2) {
        /* free in both blocks: one task for the whole period when it is crew (a real crew day), else one task per block */
        var both = free1.filter(function (c) { return free2.indexOf(c) >= 0; });
        var crewBoth = both.filter(function (c) { return needsCrew(c, i) || inWindow((cfg.windows || {}).photos, day.date) && LEADS.indexOf(c) < 0; });
        if (crewBoth.length) {
          var photo = inWindow((cfg.windows || {}).photos, day.date);
          groupC.push({ block: 0, task: photo ? 'photos' : 'crew', people: crewBoth }); crewBoth.forEach(function (c) { crew[c][weekOf(i)] = 1; lastTask[c] = 'crew'; cBlocks[c] += 2; });
        }
        cFor(free1.filter(function (c) { return crewBoth.indexOf(c) < 0; }), 1, len(b1));
        cFor(free2.filter(function (c) { return crewBoth.indexOf(c) < 0; }), 2, len(b2));
      } else cFor(free1, 1, len(b1));
      ALL.forEach(function (c) { if (!log[c][i]) log[c][i] = 'M'; streak[c] = rooms.some(function (r) { return r.people.indexOf(c) >= 0; }) ? 0 : streak[c] + 1; });
      D.rooms = rooms; D.groupC = groupC; out.push(D);
    });

    /* the sizes station: anyone it never reached is called from their room for two minutes on its last day */
    var Wz = (cfg.windows || {}).sizes;
    if (Wz) {
      var inW = out.filter(function (D) { return D.date >= Wz[0] && D.date <= Wz[1] && (D.kind === 'work' || D.kind === 'friday'); });
      var miss = ALL.filter(function (c) { return !sized[c]; });
      if (inW.length && miss.length) inW[inW.length - 1].sizesCall = miss;
    }

    /* ---------- checks ---------- */
    var stats = { problems: [], tracks: {}, pieces: pieces.map(function (p) { return { id: p.id, label: p.short, kind: p.kind, done: Math.round(p.done), learn: p.learn, polish: p.polish, sessions: p.n, people: p.people.length }; }) };
    out.forEach(function (D) {
      var nb = D.blocks && D.blocks.length ? D.blocks.length : 1;
      for (var b = 1; b <= nb; b++) {
        var seen = {};
        D.rooms.concat(D.groupC || []).forEach(function (r) {
          if (r.block && r.block !== b) return;
          r.people.forEach(function (c) { if (seen[c]) stats.problems.push('Day ' + D.day + ' block ' + b + ': ' + c + ' in two places'); seen[c] = 1; });
        });
        if (D.kind === 'work' || D.kind === 'friday') ALL.forEach(function (c) { if (!seen[c]) stats.problems.push('Day ' + D.day + ' block ' + b + ': ' + c + ' has nothing to do'); });
      }
    });
    ALL.forEach(function (c) {
      var seq = log[c].map(function (x) { return x || '-'; }), n = { A: 0, V: 0, D: 0, R: 0, M: 0 }, run3 = 0;
      seq.forEach(function (x, k) { 'AVDRM'.split('').forEach(function (K) { if (x.indexOf(K) >= 0) n[K]++; }); if (k >= 2 && out[k].kind === 'work') 'AVD'.split('').forEach(function (K) { if (x.indexOf(K) >= 0 && seq[k - 1].indexOf(K) >= 0 && seq[k - 2].indexOf(K) >= 0 && out[k - 1].kind === 'work' && out[k - 2].kind === 'work') run3++; }); });
      var weeks = {}, crewWeeks = 0; out.forEach(function (D, k) { weeks[weekOf(k)] = 1; }); Object.keys(weeks).forEach(function (w) { if (crew[c][w]) crewWeeks++; });
      stats.tracks[c] = { name: name(c), n: n, threeInARow: run3, crewWeeks: crewWeeks, cBlocks: cBlocks[c], seq: seq.join(' ') };
    });
    return { days: out, stats: stats, pieces: byId, names: name, all: ALL, leads: LEADS };
  }

  /* Group C task cards: what students do, in two versions (two teachers only; with a trained Mentor), and what "done" looks like */
  var CARDS = {
    lines: { name: 'Lines', two: 'Lines with a partner in the app (Practice Lines › Run my role): the app reads the cues, you answer (say it, sign it or use AAC).', mentors: 'Lines with a Mentor: the Mentor reads the cues, the Artist answers; then Run my role in the app.', done: 'runs the scene once with two prompts or fewer' },
    sing: { name: 'Sing-through', two: 'Sing-through with headphones: My Songs, the lit-up words and the guide vocals.', mentors: 'Mentor-led sing-through around one speaker: the Mentor points to the line and sings beside the Artists.', done: 'sings (or signs or mouths) the chorus with the words hidden, once' },
    dance: { name: 'Dance review', two: 'Dance review from the class video on a Chromebook, with a partner.', mentors: 'A Mentor teaches it back from the class video, then the group shows it.', done: 'shows the first 16 counts to a partner or a teacher' },
    crew: { name: 'Crew', two: 'Crew in sight of an adult, no power tools: sort and label props, paint with washable paint, check the props list in the app.', mentors: 'Crew with a Mentor crew lead: build, paint, sort props and costumes; an adult checks in each block; tools only with an adult.', done: 'today’s crew checklist item is ticked off in the app' },
    photos: { name: 'Photo crew (this week’s crew day)', two: 'Photograph the costumes and props from the shopping trip; upload them in the app (My Costumes and Props photos).', mentors: 'A Mentor runs the photo table: one item at a time, photographed, labeled, uploaded.', done: 'every item from your list has a photo in the app' },
    research: { name: 'Costume research', two: 'Find one or two outfit pictures for your character and say why each fits (upload them in My Costumes).', mentors: 'A Mentor helps search; the Artist chooses and says or picks the reason.', done: 'pictures uploaded, each with a reason' },
    list: { name: 'Shopping list', two: 'Add three things your character needs to the shopping list, each with a guessed price.', mentors: 'A Mentor helps look up prices; the Artist picks and types or says them.', done: 'three items on the list with prices' },
    sizes: { name: 'Sizes station', two: 'An adult runs the sizes station privately at a table in the back of Room A: read the size tags on the clothes the student is wearing today (shirt, pants or skirt, shoes) and ask what fits well; record them in the app’s student sizes page and tick Enough or Not enough. Nobody measures a student’s body; students who would rather not are fine.', mentors: 'An adult runs the sizes station privately; a Mentor brings students over one at a time and goes back to the group (Mentors never see or record another student’s sizes). The adult reads the tags on today’s clothes, asks what fits well, and records it in the app with Enough or Not enough.', done: 'sizes recorded and marked Enough; Not enough goes on tomorrow’s follow-up list in the app' },
    react: { name: 'React to That!', two: 'React to That! in the app, Level 3 role cards (Show it; camera mirror if you like).', mentors: 'A Mentor runs React to That! with the role cards for the group.', done: 'shows three reactions; a partner names each feeling' },
    runcrew: { name: 'Run crew (this week’s crew day)', two: 'Run crew for today’s run: the props table, scene changes, the run-order card, holding scripts.', mentors: 'Run crew with a Mentor stage manager: props table, scene changes, run-order card.', done: 'every prop set and put back; every change on time' },
    notes: { name: 'Notes team', two: 'Watch the run with glow and grow cards: one group each.', mentors: 'Watch the run with glow and grow cards; a Mentor helps write or pick the words.', done: 'two glows and a grow for your group, written or picked' },
  };

  var api = { plan: plan, KIND: KIND, THEME_NAME: THEME_NAME, MOVIE: MOVIE, CARDS: CARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.T) root.T.RehearsalPlan = api;
  else if (root) root.RehearsalPlan = api;
})(typeof window !== 'undefined' ? window : this);
