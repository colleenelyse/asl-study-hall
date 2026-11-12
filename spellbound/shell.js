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

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
