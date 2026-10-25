/* asl.cool/theatre: help on my own lines, step by step (Colleen 2026-10-24: "switch back and forth between the guide vocal and the performance
   track in a different configuration for each character. the idea being that students can hear other peoples lyrics but have to sing their own
   independently. this would be a step down support between hearing and seeing the lyric to seeing it only/hearing it only, then not seeing and
   not hearing it"). The song player plays both tracks at once, in step (they line up; T.show.trackOffset when set). On the student's own lines
   (T.isMine: the same rule as the lit-up lines, the red X and the piano's My part) the guide vocals fade out and the band track fades in, 50 ms,
   scheduled on the audio clock so it is exact even with the screen busy. Four levels:
     1 Hear it and see it   guide vocals all the way, my lines lit up (as before)
     2 See it only          band only on my lines, my lines lit up
     3 Hear it only         guide vocals all the way, my words covered on the music and in the lyrics
     4 On my own            band only on my lines, my words covered
   A teacher sets a student's starting level in Production › Mastery (T.show.ladder[actor id] = 2..4); the student can change it per song. */
(function (root) {
  'use strict';
  var LEVELS = [
    { n: 1, hear: true, see: true, icon: '👂👀', name: 'Hear it and see it', say: 'The singers sing my lines with me, and my lines light up.', teach: 'singers on their lines, their lines lit up' },
    { n: 2, hear: false, see: true, icon: '👀', name: 'See it only', say: 'The singers stop on my lines (only the band plays), and my lines light up.', teach: 'band only on their lines, their lines lit up' },
    { n: 3, hear: true, see: false, icon: '👂', name: 'Hear it only', say: 'The singers sing my lines with me, and my words are covered.', teach: 'singers on their lines, their words covered' },
    { n: 4, hear: false, see: false, icon: '⭐', name: 'On my own', say: 'Only the band plays on my lines, and my words are covered.', teach: 'band only on their lines, their words covered' }
  ];
  var level = function (n) { return LEVELS[Math.max(1, Math.min(4, +n || 1)) - 1]; };
  var FADE = 0.05;      // seconds: a short crossfade, so there are no clicks (the two tracks hold the same band, so it does not dip)
  var lastSyl = function (x) { return x.s && x.s.length ? x.s[x.s.length - 1] : x.t; };
  /* the stretches of the song (band track clock) when the student's own lines are sung: a little before the first word (the singer's breath)
     to where the singing stops, merged when they touch. A guessed end (no held note found) stops before someone else's next line. */
  function spans(lines, mine, end) {
    var out = [];
    lines.forEach(function (x, k) {
      if (!x || !mine(k)) return;
      var a = Math.max(0, x.t - 0.15), b = end(x) + 0.05;
      if (x.h == null) lines.forEach(function (y, j) { if (y && j !== k && !mine(j) && y.t > lastSyl(x) && y.t < b) b = Math.max(lastSyl(x) + 0.3, y.t - 0.1); });
      out.push([a, b]);
    });
    out.sort(function (p, q) { return p[0] - q[0]; });
    return out.reduce(function (m, s) { var p = m[m.length - 1]; if (p && s[0] <= p[1]) p[1] = Math.max(p[1], s[1]); else m.push(s.slice()); return m; }, []);
  }
  /* what the guide does from song time `at`: guide = 1 (singers) or 0 (band only) now, then each change after it */
  function plan(sp, at) {
    var inside = sp.some(function (s) { return s[0] <= at && at < s[1]; }), ch = [];
    sp.forEach(function (s) { if (s[0] > at) ch.push({ t: s[0], guide: 0 }); if (s[1] > at) ch.push({ t: s[1], guide: 1 }); });
    return { guide: inside ? 0 : 1, changes: ch };
  }
  /* set the two gains (gg: guide vocals, gp: band track) from song time `at`, which plays at audio time t0 */
  function schedule(gg, gp, sp, at, t0, vol) {
    vol = vol == null ? 1 : vol;
    var p = plan(sp, at), now = gg.context.currentTime;
    [gg, gp].forEach(function (g) { g.gain.cancelScheduledValues(0); });
    var set = function (v, t) { gg.gain.setValueAtTime(v * vol, t); gp.gain.setValueAtTime((1 - v) * vol, t); };
    var ramp = function (v, t) { gg.gain.linearRampToValueAtTime(v * vol, t); gp.gain.linearRampToValueAtTime((1 - v) * vol, t); };
    set(p.guide, Math.max(now, t0 - 0.01));
    p.changes.forEach(function (c) { var t = t0 + (c.t - at); set(1 - c.guide, t); ramp(c.guide, t + FADE); });
    return p;
  }
  var api = { LEVELS: LEVELS, level: level, spans: spans, plan: plan, schedule: schedule, FADE: FADE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  var T = root.T;
  function songItem(songId) {
    var so = T.songById(songId), sc = so && T.sceneById(so.scene), src = sc && T.scriptScene(sc);
    return src && { sc: sc, it: src.items.find(function (it) { return it.type === 'song' && String(it.num) === String(so.num); }) };
  }
  /* which lyric lines of the song are the student's (index → true) */
  api.mineLines = function (songId, chars) {
    var s = songItem(songId); if (!s || !s.it || !chars || !chars.length) return [];
    var mo = T.songMomentFor(s.sc, s.it.num);
    return s.it.lyrics.map(function (l) { return !!(l.who && T.isMine(l.who, s.sc, chars, mo)); });
  };
  api.mineSpans = function (songId, chars) {
    var lt = T.show.lyricTimes && T.show.lyricTimes[songId]; if (!lt) return [];
    var m = api.mineLines(songId, chars);
    return spans(lt.lines, function (k) { return !!m[k]; }, T.lineEnd);
  };
  api.ready = function (songId) { return !!(T.show.lyricTimes && T.show.lyricTimes[songId]); };
  api.forMe = function () { return T.me && T.show.ladder && T.show.ladder[T.me.id] || 1; };      // the starting level the teacher set
  /* cover the student's own words on the song's pages (levels 3 and 4) */
  api.cover = function (host, songId, chars, on) {
    host.querySelectorAll('.follow-hide').forEach(function (e) { e.remove(); });
    host.dataset.hidemine = on ? '1' : '0'; host._at = null;
    if (!on) return;
    var s = songItem(songId); if (!s || !s.it) return;
    var m = api.mineLines(songId, chars);
    s.it.lyrics.forEach(function (l, k) { if (m[k]) T.Pages.shapes(host, T.Pages.lyricBoxes(l), { cls: 'follow-hide', colors: ['#e9e6f2'], title: 'Your line: sing it from memory' }); });
  };
  root.T.Ladder = api;
})(typeof window !== 'undefined' ? window : this);
