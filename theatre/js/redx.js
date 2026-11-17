/* asl.cool/theatre: "Not my turn" (Colleen, 2026-10-24: "a red x over the screen when singing is happening but they should NOT be singing ... it's
   common that developing students will just want to sing every line in a song and that's not appropriate"). While a song plays, the lyrics timing
   (T.show.lyricTimes) says which lines are being sung right now; when none of them is the student's (T.isMine: their character, their group, or
   ALL while they are on stage), a big red X covers the screen; when one is theirs, a green frame says "Sing!". Nothing shows in music with no
   words. Turned on with a switch on the song page; a teacher can turn it on for a student (T.show.redx[actor id]), so it starts on for them. */
(function () {
  'use strict';
  var T = window.T;
  var el = null, last = '';
  function songItem(songId) {
    var so = T.songById(songId), sc = so && T.sceneById(so.scene), src = sc && T.scriptScene(sc);
    return src && { so: so, sc: sc, it: src.items.find(function (it) { return it.type === 'song' && String(it.num) === String(so.num); }) };
  }
  var end = function (x) { return T.lineEnd ? T.lineEnd(x) : (x.e || x.t + 3); };
  /* 'mine' (one of the lines being sung is theirs), 'not' (lines are being sung, none of them theirs), '' (no words right now, or unknown) */
  function state(songId, t, chars) {
    var lt = T.show.lyricTimes && T.show.lyricTimes[songId], s = songItem(songId);
    if (!lt || !s || !s.it || !chars || !chars.length) return '';
    var mo = T.songMomentFor(s.sc, s.it.num), any = false, mine = false, unknown = false;
    lt.lines.forEach(function (x, k) {
      var l = s.it.lyrics[k]; if (!x || !l || t < x.t || t > end(x)) return;
      any = true;
      if (!l.who) unknown = true;
      else if (T.isMine(l.who, s.sc, chars, mo)) mine = true;
    });
    return mine ? 'mine' : any && !unknown ? 'not' : '';
  }
  function show(st) {
    if (st === last) return; last = st;
    if (!el) {
      el = document.createElement('div'); el.className = 'redx'; el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<div class="redx-x" aria-hidden="true"></div><div class="redx-say"></div>';
      document.body.appendChild(el);
    }
    el.dataset.st = st;
    el.querySelector('.redx-say').textContent = st === 'not' ? 'Not your line: listen' : st === 'mine' ? 'Sing!' : '';
  }
  function hide() { last = ''; if (el) { el.remove(); el = null; } }
  var ready = function (songId) { return !!(T.show.lyricTimes && T.show.lyricTimes[songId]); };
  var forMe = function () { return !!(T.me && T.show.redx && T.show.redx[T.me.id]); };      // the teacher turned it on for this student
  T.RedX = { state: state, show: show, hide: hide, ready: ready, forMe: forMe };
})();
