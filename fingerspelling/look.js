/* Colors, Text size and Font, shared with the Hearing and the Ear site (both live at colleenelyse.github.io, so they share saved settings):
   localStorage simulatorColors = dark | light | contrast, simulatorText = '' | big, simulatorFont = a font key below.
   Nothing saved yet: this site keeps its own light look and fonts. */
(function () {
  const FONTS = [
    ['', "Standard", null],
    ['atkinson', 'Atkinson Hyperlegible', "'Atkinson Hyperlegible', Arial, sans-serif"],
    ['lexend', 'Lexend', "'Lexend', Arial, sans-serif"],
    ['inter', 'Inter', "'Inter', Arial, sans-serif"],
    ['source', 'Source Sans', "'Source Sans 3', Arial, sans-serif"],
    ['nunito', 'Nunito (rounded)', "'Nunito', ui-rounded, 'Trebuchet MS', Arial, sans-serif"],
    ['literata', 'Literata (book style)', "'Literata', Georgia, serif"],
    ['dyslexic', 'OpenDyslexic (dyslexia-friendly)', "'OpenDyslexic', Arial, sans-serif"]
  ];
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  function loadFonts(key) {
    if (key === 'dyslexic' && !document.getElementById('dysFont')) {
      const st = document.createElement('style'); st.id = 'dysFont';
      const base = 'https://colleenelyse.github.io/Hearingandcis/';      // OpenDyslexic comes with the Hearing site
      st.textContent = "@font-face{font-family:'OpenDyslexic';src:url('" + base + "OpenDyslexic-Regular.otf')}@font-face{font-family:'OpenDyslexic';font-weight:700;src:url('" + base + "OpenDyslexic-Bold.otf')}";
      document.head.appendChild(st);
    } else if (key && !document.getElementById('lookFonts')) {
      const l = document.createElement('link'); l.id = 'lookFonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Inter:wght@400;600;700;800&family=Lexend:wght@400;600;700;800&family=Literata:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Source+Sans+3:wght@400;600;700;800&display=swap';
      document.head.appendChild(l);
    }
  }
  function apply() {
    const c = get('simulatorColors'), t = get('simulatorText'), f = get('simulatorFont') || '';
    document.body.classList.toggle('dark', c === 'dark');
    document.body.classList.toggle('contrast', c === 'contrast');
    document.body.classList.toggle('big', t === 'big');
    const font = FONTS.find(x => x[0] === f) || FONTS[0];
    if (font[2]) { loadFonts(font[0]); document.documentElement.style.setProperty('--body', font[2]); document.documentElement.style.setProperty('--display', font[2]); }
    else { document.documentElement.style.removeProperty('--body'); document.documentElement.style.removeProperty('--display'); }
    const sc = document.getElementById('lookColors'), st = document.getElementById('lookText'), sf = document.getElementById('lookFont');
    if (sc) sc.value = ['dark', 'contrast'].indexOf(c) >= 0 ? c : 'light'; if (st) st.value = t === 'big' ? 'big' : ''; if (sf) sf.value = font[0];
    window.dispatchEvent(new Event('resize'));
  }
  window.FSLook = { apply };
  document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('look'); if (!box) return apply();
    box.innerHTML = '<label>Colors: <select id="lookColors"><option value="light">Light</option><option value="dark">Dark</option><option value="contrast">High contrast</option></select></label>' +
      '<label>Text size: <select id="lookText"><option value="">Normal</option><option value="big">Large</option></select></label>' +
      '<label>Font: <select id="lookFont">' + FONTS.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select></label>';
    document.getElementById('lookColors').onchange = e => { put('simulatorColors', e.target.value); apply(); };
    document.getElementById('lookText').onchange = e => { put('simulatorText', e.target.value); apply(); };
    document.getElementById('lookFont').onchange = e => { put('simulatorFont', e.target.value); apply(); };
    apply();
  });
  window.addEventListener('storage', e => { if (/^simulator/.test(e.key || '')) apply(); });      // a change in another tab (the Hearing site) shows here too
})();
