// SHARED SCRIPT: the font menu at the top of every page.
// Used by every page: index.html, troubleshooting.html, save-as-pdf.html, hearing-loss-simulator.html,
// cochlear-implant-simulator.html, ear-quiz.html (Parts of the Ear), credits.html, teachers.html and privacy.html.
// Each page loads it near the end, in the same place its own copy used to be. Change it here and every page changes.
// ---------- THE FONT MENU (the choice is shared by every page, like the colors) ----------
// The first one is the default: whatever font this computer normally uses, so nothing has to download.
(function () {
  const FONTS = [
    ['',         "This device's font",              "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"],
    ['atkinson', 'Atkinson Hyperlegible',           "'Atkinson Hyperlegible', Arial, sans-serif"],
    ['lexend',   'Lexend',                          "'Lexend', Arial, sans-serif"],
    ['inter',    'Inter',                           "'Inter', Arial, sans-serif"],
    ['source',   'Source Sans',                     "'Source Sans 3', Arial, sans-serif"],
    ['nunito',   'Nunito (rounded)',                "'Nunito', ui-rounded, 'Trebuchet MS', Arial, sans-serif"],
    ['literata', 'Literata (book style)',           "'Literata', Georgia, serif"],
    ['dyslexic', 'OpenDyslexic (dyslexia-friendly)', "'OpenDyslexic', Arial, sans-serif"]
  ];
  const fontButton = document.getElementById('fontButton'), fontMenu = document.getElementById('fontMenu');
  function saved() { try { return localStorage.getItem('simulatorFont') || ''; } catch (problem) { return ''; } }
  // The fonts that come from Google are downloaded only once one of them is wanted, so they never slow down the first look at the page
  function loadGoogleFonts() {
    if (document.getElementById('googleFonts')) return;
    const sheet = document.createElement('link');
    sheet.id = 'googleFonts';
    sheet.rel = 'stylesheet';
    sheet.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Inter:wght@400;600;700;800&family=Lexend:wght@400;600;700;800&family=Literata:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Source+Sans+3:wght@400;600;700;800&display=swap';
    document.head.appendChild(sheet);
  }
  function useFont(key, keep) {
    const font = FONTS.find((each) => each[0] === key) || FONTS[0];
    if (font[0] && font[0] !== 'dyslexic') loadGoogleFonts();     // OpenDyslexic comes with the site, so it needs nothing from Google
    document.body.style.fontFamily = font[2];
    fontButton.textContent = font[1];
    fontButton.style.fontFamily = font[2];
    fontMenu.querySelectorAll('button').forEach((choice) => choice.setAttribute('aria-selected', choice.dataset.font === font[0] ? 'true' : 'false'));
    if (keep) { try { localStorage.setItem('simulatorFont', font[0]); } catch (problem) { /* not allowed here */ } }
    window.dispatchEvent(new Event('resize'));      // lets anything that measures text fit itself again
  }
  function openMenu(open) {
    fontMenu.hidden = !open;
    fontButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) loadGoogleFonts();                   // the menu shows each name in its own font
    if (open) (fontMenu.querySelector('[aria-selected="true"]') || fontMenu.querySelector('button')).focus();
  }
  FONTS.forEach((font) => {
    const choice = document.createElement('button');
    choice.type = 'button'; choice.setAttribute('role', 'option'); choice.dataset.font = font[0];
    choice.textContent = font[1];
    choice.style.fontFamily = font[2];             // each name is shown in its own font
    choice.onclick = () => { useFont(font[0], true); openMenu(false); fontButton.focus(); };
    fontMenu.appendChild(choice);
  });
  fontButton.onclick = () => openMenu(fontMenu.hidden);
  document.addEventListener('click', (press) => { if (!press.target.closest('.fontPick')) openMenu(false); });
  fontMenu.addEventListener('keydown', (press) => {
    const choices = Array.from(fontMenu.querySelectorAll('button')), spot = choices.indexOf(document.activeElement);
    if (press.key === 'Escape') { press.stopPropagation(); openMenu(false); fontButton.focus(); }     // (stopPropagation: Escape here only closes this menu, and on the simulator pages does not also stop the sound)
    if (press.key === 'ArrowDown') { press.preventDefault(); choices[Math.min(choices.length - 1, spot + 1)].focus(); }
    if (press.key === 'ArrowUp')   { press.preventDefault(); choices[Math.max(0, spot - 1)].focus(); }
  });
  useFont(saved(), false);
})();
