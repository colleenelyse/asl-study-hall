/* asl.cool/theatre: View as (Colleen, 2026-10-24: "easily switch from different views for different students in their tracks or a parent view
   specific to each cast member"). In Teacher mode, see the app exactly as one Company member sees it (their Today, songs, lines, calendar…),
   as a track before casting (a character), or as that Company member's parent (the parent pages and the Family portal). A bar at the bottom
   switches person or view, or goes back to Teacher mode. While previewing nothing is sent or saved for the student: notes, practice records,
   recordings, photos and usage counts are held back (Store functions are swapped for no-ops until the preview ends). Never saved to the
   iPad: a reload ends the preview. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc;
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var saved = null, held = null, cur = null, bar = null;
  var HOLD = ['sendNote', 'queueNote', 'putProgress', 'sendRecording', 'putPhoto', 'sendUsage'];
  function hold(on) {
    if (on && !held) { held = {}; HOLD.forEach(function (k) { if (!Store[k]) return; held[k] = Store[k]; Store[k] = function () { if (k !== 'sendUsage') T.toast('Preview: nothing is sent or saved for this student.'); return Promise.resolve({}); }; }); }
    else if (!on && held) { Object.keys(held).forEach(function (k) { Store[k] = held[k]; }); held = null; }
  }
  /* a parent sees what your parent password opens (the first parent password that is on); none yet: the usual family pages */
  function parentPass() {
    var p = (T.show.passes || []).find(function (x) { return x.who === 'parent' && !x.off; });
    return Object.assign({}, p || { id: 'preview', name: 'Parent', pages: ['today', 'calendar', 'songs', 'costumes', 'story', 'help', 'photos', 'shop'], fullCal: true }, { who: 'parent', preview: true });
  }
  function nameOf(v) {
    if (v.cast) { var a = (T.show.cast || []).find(function (x) { return x.id === v.cast; }); return a ? a.name : '?'; }
    var c = T.charById(v.char); return c ? c.short + ' (the track)' : '?';
  }
  function start(v) {
    if (!T.show || !T.proof) { T.toast('Open Teacher mode first.'); return; }
    if (!saved) saved = { me: T.me, pass: T.pass };
    cur = v;
    T.setMe(v.cast ? { cast: v.cast } : { char: v.char });
    if (!T.me) { stop(); T.toast('That Company member is not on the cast list.'); return; }
    T.pass = v.kind === 'parent' ? parentPass() : null;
    hold(true); draw(); T.go('#/home');
  }
  function stop(to) {
    var s = saved; saved = null; cur = null; hold(false);
    T.me = s ? s.me : null; T.pass = s ? s.pass : null;
    if (T.resetPrefs) T.resetPrefs();
    draw(); T.go(to || '#/teacher');
  }
  T.viewAs = { start: start, stop: stop, active: function () { return !!cur; }, now: function () { return cur; } };

  /* the bar: who, which view, switch, back */
  function options(sel) {
    var cast = (T.show.cast || []).filter(function (a) { return a.name; });
    var h = cast.length ? '<optgroup label="Company members">' + cast.map(function (a) { var v = 'c:' + a.id; return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(a.name) + ((a.chars || []).length ? ' · ' + a.chars.map(function (c) { var x = T.charById(c); return x ? x.short : ''; }).join(', ') : '') + '</option>'; }).join('') + '</optgroup>' : '';
    return h + '<optgroup label="Tracks (before casting)">' + T.O().characters.map(function (c) { var v = 't:' + c.id; return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + esc(c.short) + '</option>'; }).join('') + '</optgroup>';
  }
  function draw() {
    if (!cur) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'viewas-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Preview'); document.body.appendChild(bar); }
    var sel = cur.cast ? 'c:' + cur.cast : 't:' + cur.char;
    bar.innerHTML = '<span class="viewas-tag">' + sym('👁️') + 'Preview</span>' +
      '<label class="viewas-who"><span class="vh">Person or track</span><select id="vaWho">' + options(sel) + '</select></label>' +
      '<div class="seg" role="group" aria-label="View"><button type="button" data-vk="student" aria-pressed="' + (cur.kind !== 'parent') + '">Student</button><button type="button" data-vk="parent" aria-pressed="' + (cur.kind === 'parent') + '"' + (cur.cast ? '' : ' disabled title="A parent view needs a Company member"') + '>Parent</button></div>' +
      '<button type="button" class="btn small" id="vaOut">Back to Teacher mode</button>';
    bar.querySelector('#vaWho').onchange = function (e) { var v = e.target.value, k = cur.kind; start(v.charAt(0) === 'c' ? { kind: k, cast: v.slice(2) } : { kind: 'student', char: v.slice(2) }); };
    bar.querySelectorAll('[data-vk]').forEach(function (b) { b.onclick = function () { start(Object.assign({}, cur, { kind: b.dataset.vk })); }; });
    bar.querySelector('#vaOut').onclick = function () { stop(); };
    place();
  }
  function place() { if (bar) bar.classList.toggle('above-dock', !!document.querySelector('.dock')); }
  window.addEventListener('hashchange', function () {
    if (!cur) return;
    if (/^#\/teacher/.test(location.hash)) { stop(location.hash); return; }      // into Teacher mode: the preview ends
    setTimeout(place, 50);
  });

  /* Teacher › View as: pick a person (or a track) and a view */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.viewas = function () {
    T.setBar('View as', '#/teacher');
    var app = document.getElementById('app'), cast = (T.show.cast || []).filter(function (a) { return a.name; });
    app.innerHTML = '<div class="card"><h2>' + sym('👁️') + 'See the app as someone else</h2><p class="muted">Pick a Company member to see exactly what they see, or what their parent sees. Before casting, pick a track (a character). A bar at the bottom switches person or view; “Back to Teacher mode” ends it. Nothing is sent or saved for them while you look.</p></div>' +
      (cast.length ? '<h3>Company members</h3><div class="choose">' + cast.map(function (a) {
        return '<div class="person" style="cursor:default">' + T.face(a, 56) + '<b>' + esc(a.name) + '</b><span>' + ((a.chars || []).map(function (c) { var x = T.charById(c); return x ? esc(x.short) : ''; }).join(', ') || 'Role coming soon') + '</span>' +
          '<div class="row" style="justify-content:center;margin-top:6px"><button class="btn small" data-va="student" data-c="' + a.id + '">Student</button><button class="btn small" data-va="parent" data-c="' + a.id + '">Parent</button></div></div>';
      }).join('') + '</div>' : '<p class="card muted">No Company members yet: pick a track below.</p>') +
      '<h3 style="margin-top:18px">Tracks</h3>' + T.O().groups.map(function (g) {
        var list = T.O().characters.filter(function (c) { return c.group === g.id; }); if (!list.length) return '';
        return '<p class="muted small" style="margin:10px 0 4px">' + esc(g.name) + '</p><div class="row">' + list.map(function (c) { return '<button class="btn small" data-vt="' + c.id + '">' + esc(c.short) + '</button>'; }).join('') + '</div>';
      }).join('');
    app.querySelectorAll('[data-va]').forEach(function (b) { b.onclick = function () { start({ kind: b.dataset.va, cast: b.dataset.c }); }; });
    app.querySelectorAll('[data-vt]').forEach(function (b) { b.onclick = function () { start({ kind: 'student', char: b.dataset.vt }); }; });
  };
})();
