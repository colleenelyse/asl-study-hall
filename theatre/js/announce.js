/* asl.cool/theatre: announcements and notifications (Colleen 2026-10-24: "Both student and parent portals should have announcements section, but new
   announcements should also pop up on the home screen as notifications the first time a student or parent opens the app after the notification has
   been added. The notifications tab will store past notifications for people to go back and reference if they need to.")
   The teacher writes one (Teacher › Announcements) and picks who sees it: Company members, parents, or both. It is the same list as the parents'
   news (T.show.portal.news, each { id, at, title, text, to: 'students' | 'parents' | 'both' }; one with no `to`, posted before, is for parents).
   - Home: an Announcements section (students: here; parents: in the Family portal part, portal.js) and a Notifications tile with how many are new.
   - Pop-up: the first time someone opens the home page after an announcement went up, one card shows every new one in big text, with
     🔊 Read it to me and a single "Got it". Seen is kept on the device per person (ls annSeen: { 'student:<actor>' | 'parent:<google email or actor>':
     [ids] }); on a new device only the last 21 days pop up. Teacher previews (View as) show it without marking it seen.
   - #/notifications: every past announcement for them, newest first. */
(function (root) {
  'use strict';
  var DAYS = 21;
  function visible(news, kind) { return (news || []).filter(function (n) { var to = n.to || 'parents'; return to === 'both' || (kind === 'parent' ? to === 'parents' : to === 'students'); }).slice().sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : (a.id < b.id ? 1 : -1); }); }
  function unseen(news, kind, seen, today) {
    var from = new Date(today + 'T00:00:00'); from.setDate(from.getDate() - DAYS);
    var cut = from.getFullYear() + '-' + String(from.getMonth() + 1).padStart(2, '0') + '-' + String(from.getDate()).padStart(2, '0');
    return visible(news, kind).filter(function (n) { return (seen || []).indexOf(n.id) < 0 && n.at >= cut; });
  }
  var core = { visible: visible, unseen: unseen, DAYS: DAYS };
  root.AnnounceCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.T) return;
  var T = window.T, A = window.AnnounceCore, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var day = function (s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); };
  var uid = function () { return 'n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var news = function () { return ((T.show && T.show.portal) || {}).news || []; };
  var kind = function () { return T.pass && T.pass.who === 'parent' ? 'parent' : 'student'; };
  function person() {
    if (kind() === 'parent') { var g = T.googleContact && T.googleContact(); return 'parent:' + ((g && g.email) || (T.me && T.me.id) || 'family'); }
    return 'student:' + ((T.me && (T.me.id || T.me.chars.join('+'))) || 'me');
  }
  function seen() { var s = T.ls('annSeen') || {}; return s[person()] || []; }
  function markSeen(ids) {
    if (T.pass && T.pass.preview) return;      // the teacher's preview (viewas.js) changes nothing
    var s = T.ls('annSeen') || {}, k = person(); s[k] = (s[k] || []).concat(ids).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(-300); T.ls('annSeen', s);
  }
  var newOnes = function () { return A.unseen(news(), kind(), seen(), today()); };
  function item(n, big) {
    return '<div class="ann' + (big ? ' big' : '') + '"><div class="ann-t">' + esc(n.title) + '</div><div class="muted small">' + esc(day(n.at)) + '</div>' + (n.text ? '<div class="ann-x">' + esc(n.text) + '</div>' : '') + '</div>';
  }
  var css = document.createElement('style');
  css.textContent = '.ann{padding:10px 0;border-bottom:1px solid var(--line)}.ann:last-child{border-bottom:0}.ann-t{font-weight:700;font-size:1.1em}.ann-x{white-space:pre-wrap;margin-top:4px}' +
    '.ann.big .ann-t{font-size:1.5em;line-height:1.25}.ann.big .ann-x{font-size:1.25em;line-height:1.5}dialog.annpop{max-width:min(720px,94vw)}dialog.annpop .gotit{width:100%;min-height:72px;font-size:1.4em;margin-top:16px}';
  document.head.appendChild(css);
  function sayAll(list) { var t = list.map(function (n) { return n.title + '. ' + (n.text || ''); }).join(' '); if (T.Speech) T.Speech.say(t, null); }

  /* the pop-up, from the home page */
  T.announcePopup = function () {
    if (!T.show || !T.me || document.querySelector('dialog.annpop')) return;
    var list = newOnes(); if (!list.length) return;
    var d = document.createElement('dialog'); d.className = 'annpop'; d.setAttribute('aria-labelledby', 'annh');
    d.innerHTML = '<h2 id="annh" style="margin-top:0">' + sym('📣') + (list.length === 1 ? 'New announcement' : list.length + ' new announcements') + '</h2>' + list.map(function (n) { return item(n, true); }).join('') +
      '<button class="btn" id="annsay" type="button">' + sym('🔊') + 'Read it to me</button><button class="btn primary gotit" id="anngot" type="button">Got it</button>';
    document.body.appendChild(d); d.showModal();
    var close = function () { if (T.Speech) T.Speech.stop(); markSeen(list.map(function (n) { return n.id; })); d.close(); d.remove(); var t = document.getElementById('anncount'); if (t) t.textContent = 'All announcements'; };
    d.querySelector('#annsay').onclick = function () { sayAll(list); };
    d.querySelector('#anngot').onclick = close;
    d.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    setTimeout(function () { d.querySelector('#anngot').focus(); }, 30);
  };
  /* the home page: the tile's words, and the students' Announcements section (parents have theirs in the Family portal part) */
  T.annTile = function () { var n = newOnes().length; return '<span id="anncount">' + (n ? n + ' new' : 'All announcements') + '</span>'; };
  T.announceSection = function () {
    var list = A.visible(news(), kind()).slice(0, 2); if (!list.length) return '';
    return '<div class="card"><h2 style="margin-top:0">' + sym('📣') + 'Announcements</h2>' + list.map(function (n) { return item(n); }).join('') +
      '<p><a class="btn" href="#/notifications">All notifications</a></p></div>';
  };
  T.annList = function (k) { return A.visible(news(), k || kind()); };
  T.studentPages = T.studentPages || {};
  T.studentPages.notifications = function () {
    T.setBar('Notifications', '#/home');
    var list = A.visible(news(), kind()), fresh = newOnes().map(function (n) { return n.id; });
    app.innerHTML = '<div class="card"><div class="row"><h2 class="grow" style="margin:0">' + sym('📣') + 'Announcements</h2>' + (list.length ? '<button class="btn" id="nsay">' + sym('🔊') + 'Read them to me</button>' : '') + '</div>' +
      (list.length ? list.map(function (n) { return (fresh.indexOf(n.id) >= 0 ? '<span class="tag">New</span>' : '') + item(n); }).join('') : '<p class="muted">Nothing yet. Announcements from your teacher will show here.</p>') + '</div>';
    if (list.length) document.getElementById('nsay').onclick = function () { sayAll(list); };
    if (fresh.length) markSeen(fresh);
  };

  /* ---------- Teacher › Announcements ---------- */
  var TO = [['both', 'Company members and parents'], ['students', 'Company members only'], ['parents', 'Parents only']];
  var toName = function (t) { return { both: 'Everyone', students: 'Company members', parents: 'Parents' }[t || 'parents']; };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.announce = function () {
    T.setBar('Announcements', '#/teacher');
    var to = T.ls('annTo') || 'both';
    function draw() {
      var P = T.show.portal = T.show.portal || {}; P.news = P.news || [];
      app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('📣') + 'Write an announcement</h2><p class="small muted">It pops up on their home page the first time they open the app after you post it (big text, read aloud if they tap 🔊, one “Got it” button), and stays on their Notifications page.' + (T.show.mail && T.show.mail.on ? ' After you post, you can also send it as an email.' : '') + '</p>' +
        '<label class="f">Headline<input id="at" maxlength="100" placeholder="e.g. Costume pieces due Friday"></label>' +
        '<label class="f">Message<textarea id="ax" maxlength="1200" placeholder="What they need to know"></textarea></label>' +
        '<div class="switch"><span><b>Who sees it</b></span><div class="seg" id="ato">' + TO.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (to === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="row end"><button class="btn primary" id="apost" data-save>Post it</button></div></div>' +
        '<div class="card"><h2 style="margin-top:0">Posted</h2>' + (P.news.length ? A.visible(P.news.map(function (n) { return Object.assign({}, n, { to: 'both' }); }), 'student').map(function (n0) {
          var n = P.news.find(function (x) { return x.id === n0.id; });
          return '<div class="row" style="border-bottom:1px solid var(--line);padding:6px 0"><div class="grow"><b>' + esc(n.title) + '</b> <span class="tag">' + esc(toName(n.to)) + '</span> <span class="muted small">' + esc(day(n.at)) + '</span><div class="small" style="white-space:pre-wrap">' + esc(n.text || '') + '</div></div><button class="btn small quiet" data-ad="' + esc(n.id) + '" data-save>Delete</button></div>';
        }).join('') : '<p class="muted">Nothing posted yet.</p>') + '</div>';
      app.querySelectorAll('#ato button').forEach(function (b) { b.onclick = function () { to = b.dataset.v; T.ls('annTo', to); app.querySelectorAll('#ato button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }; });
      document.getElementById('apost').onclick = function () {
        var t = document.getElementById('at').value.trim(); if (!t) { T.toast('Type a headline first.'); return; }
        P.news.push({ id: uid(), at: today(), title: t.slice(0, 100), text: document.getElementById('ax').value.trim().slice(0, 1200), to: to });
        T.saveShow('Posted for ' + toName(to).toLowerCase()).then(draw);
      };
      app.querySelectorAll('[data-ad]').forEach(function (b) { b.onclick = function () { if (!confirm('Delete this announcement? It disappears from everyone’s Notifications.')) return; P.news = P.news.filter(function (n) { return n.id !== b.dataset.ad; }); T.saveShow('Deleted').then(draw); }; });
    }
    draw();
  };
})();
