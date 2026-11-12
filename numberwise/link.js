/* ASL Study link for ASL Spellbound / ASL NumberWise (dev/build-phone-apps.py, 2026-11-12, ASL Study 4.482).
   Colleen: "i want students to be able to use the app as a logged in ASL student ... so their interaction can count toward their study hall account's progress".
   Only on asl.cool (her students); the copies for buyers never show it. A student signs in once (Google, school email, or a code), the same way as
   asl.cool/app, and keeps the same sign-in (localStorage asl-app-tok, shared with asl.cool/app in the same browser). Every finished round is sent to
   ASL Study through the app door as api_fsRound, exactly what ASL Study saves when the games run inside it. Rounds wait on the phone (pa-door-q)
   until ASL Study has them, so no Wi-Fi loses nothing; ASL Study never counts the same round (rid) twice. Nothing is sent when not signed in.
   window.PALINK = { door, main, back } is written by the builder before this file. */
(function () {
  var C = window.PALINK || {};
  var on = !!C.door && (/(^|\.)asl\.cool$/.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
  window.paLinkOn = function () { return on; };
  if (!on) { window.paLinked = function () { return false; }; return; }
  var TK = 'asl-app-tok', QK = 'pa-door-q', busy = false;
  var HOME = navigator.standalone === true || (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function tok() { return get(TK, ''); }
  function email() { var p = tok().split('~'); return p.length >= 4 ? p[2] : ''; }
  function call(fn, args) {
    return fetch(C.door, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args, app: C.back || '', home: HOME ? 1 : 0 }) })      /* 4.487 which app; opened from the Home Screen? */
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && 'e' in j) throw new Error(j.e); return j ? j.r : null; });
  }
  function toast(t) {
    var el = document.getElementById('pa-toast'); if (!el) { el = document.createElement('div'); el.id = 'pa-toast'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9500;background:#1B1E3C;color:#fff;padding:10px 16px;border-radius:999px;font:700 15px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:90vw;text-align:center';
      document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function changed() { try { window.dispatchEvent(new Event('pa-link')); } catch (e) {} }
  /* the round, shaped exactly as ASL Study's fsSave sends it */
  function shape(m) {
    return { kind: m.kind, game: String(m.game || ''), name: String(m.name || ''), rid: String(m.rid || ''), n: m.n, right: m.right, secs: m.secs, speed: m.speed, lps: m.lps, top: m.top, letters: m.letters,
      items: Array.isArray(m.items) ? m.items.slice(0, 300).map(function (x) { return { w: String((x && x.w) || ''), c: String((x && x.c) || ''), ok: !!(x && x.ok) }; }) : [],
      mix: m.mix, lens: m.lens, nums: m.nums, order: m.order, orderN: m.orderN, exp: m.exp, pron: m.pron, pace: m.pace, pacer: m.pacer, spd: m.spd, xprac: m.xprac };
  }
  function queue() { var q = []; try { q = JSON.parse(get(QK, '[]')); } catch (e) {} return Array.isArray(q) ? q : []; }
  function flush() {
    if (busy || !tok()) return; var q = queue(); if (!q.length) return;
    if (navigator.onLine === false) return;
    var me = email(), mine = q.filter(function (x) { return x.who === me; });
    if (mine.length !== q.length) put(QK, JSON.stringify(mine));      /* rounds played by someone else on this phone are never sent under this sign-in */
    if (!mine.length) return;
    busy = true; var m = mine[0], body = Object.assign({}, m); delete body.who;
    call('api_fsRound', [tok(), body]).then(function (r) {
      busy = false; put(QK, JSON.stringify(queue().filter(function (x) { return x.rid !== m.rid; })));
      var sent = document.getElementById('rd-sent');
      if (r && r.teacher) toast('Teacher preview: not saved');
      else if (r && r.saved) { toast('✓ Saved to ASL Study Hall'); if (sent) sent.textContent = '✓ Saved to ASL Study Hall.'; }
      flush();
    }).catch(function (e) {
      busy = false; var msg = String((e && e.message) || e);
      if (/APPSIGNIN|sign-in ran out|sign in again/i.test(msg)) { put(TK, null); changed(); toast('Sign in again so your practice counts (⚙️ Settings).'); return; }
      if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) { setTimeout(flush, 30000); return; }      /* no internet: try again later */
      put(QK, JSON.stringify(queue().filter(function (x) { return x.rid !== m.rid; })));      /* ASL Study said no (an activity turned off): don't keep asking */
      toast(msg.slice(0, 120)); flush();
    });
  }
  window.paLinked = function () { return !!tok(); };
  window.paRound = function (m) {
    if (!tok() || !m) return; var p = shape(m); p.who = email(); if (!p.rid) p.rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var q = queue().filter(function (x) { return x.rid !== p.rid; }).concat([p]).slice(-60); put(QK, JSON.stringify(q)); flush();
  };
  window.paLink = {
    email: email, signedIn: function () { return !!tok(); },
    google: function () { location.href = C.main + '?app=signin&back=' + encodeURIComponent(C.back || ''); },
    signIn: function (o) { return (o.claim ? call('api_appClaim', [o.claim]) : call('api_appSignIn', [o])).then(function (r) { put(TK, r.tok); changed(); toast('✓ Signed in. Your practice now counts in ASL Study Hall.'); flush(); return r; }); },
    signOut: function () { put(TK, null); changed(); toast('Signed out. Practice stays on this phone only.'); },
    says: function () { return call('api_appSays', [tok()]).then(function () { put('pa-says-' + (C.back || ''), '1'); changed(); toast('✓ Thanks! Your teacher can see it.'); }); },      /* 4.489 "I added this app to my Home Screen" */
    said: function () { return get('pa-says-' + (C.back || ''), '') === '1'; }
  };
  if (window.__paClaim) { var c = window.__paClaim; window.__paClaim = ''; window.paLink.signIn({ claim: c }).catch(function (e) { toast(String(e.message || e)); }); }      /* back from the Google sign-in */
  addEventListener('online', flush); setTimeout(flush, 1500);
  addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
})();
