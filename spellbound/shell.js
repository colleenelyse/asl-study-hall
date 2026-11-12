/* Phone app shell for ASL Spellbound / ASL Numberwise (dev/build-phone-apps.py, 2026-11-12).
   PAPP = { name, tabs: [[hash, icon, label]], ver } is written by the builder before this file. Progress stays in this phone's storage (no sign-in). */
(function () {
  var P = window.PAPP || {}, H = document.documentElement, $ = function (s) { return document.querySelector(s); };
  H.classList.add('papp');
  if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = '#/games';      // the app opens on its games, not the web site's welcome page (the page's head already does this before the games load)

  var top = $('header.top'), brand = top && top.querySelector('.brand');
  if (brand) brand.innerHTML = '<img class="pa-ic" src="icon-180.png" alt=""> <span>' + P.name + '</span>';
  if (brand) brand.setAttribute('href', '#/games');
  if (top) top.insertAdjacentHTML('beforeend', '<button id="pa-gear" type="button" aria-label="Settings">⚙️</button>');

  var tabs = document.createElement('nav'); tabs.id = 'pa-tabs'; tabs.setAttribute('aria-label', P.name);
  tabs.innerHTML = P.tabs.map(function (t) { return '<a href="' + t[0] + '"><span class="i" aria-hidden="true">' + t[1] + '</span>' + t[2] + '</a>'; }).join('');
  document.body.appendChild(tabs);
  function mark() {
    if (!location.hash || location.hash === '#' || location.hash === '#/') { location.replace('#/games'); return; }      // any link back to the welcome page goes to Games
    var h = location.hash, best = null;
    P.tabs.forEach(function (t, i) { if (h === t[0] || h.indexOf(t[0] + '/') === 0) best = i; });
    if (best === null && /^#\/(setup|results|review|report|learn|math|signnum|eventyear|agepics|clocks|timeline|build|card|mail|clawq|bingo|letter)/.test(h)) best = 0;      // inside a game: Games stays lit
    [].forEach.call(tabs.children, function (a, i) { a.classList.toggle('on', i === best); });
    H.classList.toggle('pa-play', /^#\/play/.test(h));      // playing: the whole screen for the game
    setTimeout(function () { if (document.title !== P.name) document.title = P.name; }, 0);      // the games set their own title
  }
  window.addEventListener('hashchange', mark); mark();

  var sheet = document.createElement('div'); sheet.id = 'pa-sheet'; sheet.hidden = true;
  sheet.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="Settings"><div class="row2"><h2>Settings</h2><button class="x" type="button" aria-label="Close">✕</button></div>' +
    '<section id="pa-acct" hidden></section>' +
    '<div id="pa-look-slot"></div>' +
    '<div class="links"><button type="button" id="pa-help">📲 How to put this app on your home screen</button><a href="privacy.html">🔒 Privacy</a></div>' +
    '<p class="ver">' + P.name + ' · your progress is saved on this phone only.' + (P.ver ? ' · ' + P.ver : '') + '</p></div>';
  document.body.appendChild(sheet);
  var look = $('#look'); if (look) $('#pa-look-slot').appendChild(look);
  function close() { sheet.hidden = true; }
  $('#pa-gear').onclick = function () { sheet.hidden = false; };
  sheet.onclick = function (e) { if (e.target === sheet || e.target.closest('.x')) close(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  $('#pa-help').onclick = function () { close(); if (window.paSteps) window.paSteps(true); };

  /* 4.482 ASL Study sign-in (link.js; only on asl.cool): in Settings, and a card on top of Games until the student signs in or says no thanks */
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  /* Google's own four-color G, so the button looks like the Google sign-in students already know (Colleen, 2026-11-12) */
  var GLOGO = '<svg class="pa-glogo" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  function signForm(id) {
    return '<button class="pa-btn pa-g" type="button" data-pa="google">' + GLOGO + '<span>Sign in with Google</span></button>' +
      '<form class="pa-row" data-pa="email"><input type="text" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="or your school email" aria-label="School email"><button class="pa-btn" type="submit">Sign in</button></form>' +
      '<form class="pa-row" data-pa="code"><input type="text" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" placeholder="or a code" aria-label="Code"><button class="pa-btn ghost" type="submit">Use code</button></form>' +
      '<p class="pa-err" id="' + id + '-err" hidden></p>';
  }
  function wire(box, id) {
    box.querySelectorAll('[data-pa]').forEach(function (el) {
      var k = el.getAttribute('data-pa'), err = function (m) { var e = document.getElementById(id + '-err'); if (e) { e.hidden = !m; e.textContent = m || ''; } };
      if (k === 'google') el.onclick = function () { window.paLink.google(); };
      if (k === 'out') el.onclick = function () { window.paLink.signOut(); };
      if (k === 'later') el.onclick = function () { try { localStorage.setItem('pa-link-later', '1'); } catch (e) {} paintAcct(); };
      if (k === 'email' || k === 'code') el.onsubmit = function (e) { e.preventDefault(); var v = el.querySelector('input').value.trim(); if (!v) return; err('');
        var b = el.querySelector('button'); b.disabled = true;
        window.paLink.signIn(k === 'email' ? { email: v } : /^\d{6}$/.test(v) ? { claim: v } : { code: v }).catch(function (x) { err(String(x.message || x)); }).then(function () { b.disabled = false; }); };
    });
  }
  function paintAcct() {
    var acct = document.getElementById('pa-acct'), card = document.getElementById('pa-linkcard');
    if (!(window.paLinkOn && window.paLinkOn())) { if (acct) acct.hidden = true; if (card) card.remove(); return; }
    var inn = window.paLink.signedIn(), later = false; try { later = localStorage.getItem('pa-link-later') === '1'; } catch (e) {}
    acct.hidden = false;
    acct.innerHTML = '<h3>ASL Study</h3>' + (inn ? '<p>✓ Signed in as <b>' + esc(window.paLink.email()) + '</b>. Your practice here counts in ASL Study.</p><button class="pa-btn ghost" type="button" data-pa="out">Sign out</button>'
      : '<p>In an ASL class that uses ASL Study? Sign in so your practice here counts toward your ASL Study progress.</p>' + signForm('pa-acct'));
    wire(acct, 'pa-acct');
    var games = document.querySelector('[data-screen="games"]');
    if (inn || later) { if (card) card.remove(); return; }
    if (!card && games) { card = document.createElement('div'); card.id = 'pa-linkcard'; games.insertBefore(card, games.firstChild); }
    if (card) { card.innerHTML = '<p><b>Are you an ASL student in the app creator\'s class?</b> Sign in so this practice counts in ASL Study.</p>' + signForm('pa-card') + '<button class="pa-link" type="button" data-pa="later">No thanks, just practice</button>'; wire(card, 'pa-card'); }
  }
  window.addEventListener('pa-link', paintAcct); paintAcct();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
