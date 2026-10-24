/* asl.cool/theatre: parents sign in with Google (Colleen 2026-10-24: "require parents to sign in with a google account and use that email for
   communicsation"). Any Google account works (Gmail, or a Google account made with the email a family already uses).
   - A parent password the teacher marks "Needs Google sign-in" (Teacher › Emails) is left out of the show the server gives everyone; after
     "Sign in with Google" the Worker checks Google's token (signature, this app's Client ID, not expired, verified email; api.js googleClaims) and
     hands over that password's key wrap (POST gpass). The parent password still has to be typed: both are needed.
   - The Google email is remembered on the device (ls gEmail) and, once the parent picks their Company member, sent sealed to the teacher as that
     family's contact (portal.js kind 'contact', google: true), so news and notification emails (mail.js) go to it. It is kept only in the
     teacher's vault. Several parents can sign in for one Company member (one contact per address).
   - A device that opened a Google-only password before is locked again until someone signs in with Google (T.usePass in app.js).
   - The local test server sets THEATRE_DEV_GOOGLE and the Client ID "dev": then a typed email stands in for Google. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var gis = null;
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    return gis || (gis = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https:' + '//accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = function () { gis = null; no(new Error('Could not reach Google. Check the internet.')); }; document.head.appendChild(s); }));
  }
  function claims(token) {
    if (/^dev:/.test(token)) return { email: token.slice(4), name: '' };
    try { return JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; }
  }
  var HOW = '<details style="margin-top:10px"><summary><b>No Google account?</b> Make a free one with the email you already use</summary><ol class="small" style="margin:8px 0 0 18px">' +
    '<li>Go to <a href="https:' + '//accounts.google.com/signup" target="_blank" rel="noopener">accounts.google.com/signup</a>.</li>' +
    '<li>Type your first and last name, then your birthday. Tap <b>Next</b>.</li>' +
    '<li>When it offers a Gmail address, tap <b>Use your existing email</b> and type the email you already use.</li>' +
    '<li>Google sends a code to that email. Type it in, choose a password, and finish.</li>' +
    '<li>Come back here and tap <b>Sign in with Google</b>. You don’t need Gmail: your own email works.</li></ol></details>';
  /* the unlock page: the parents' part, above the password box */
  T.parentGoogleBox = function () {
    if (!T.saved || !T.saved.gated) return '';
    var em = T.ls('gEmail');
    return '<div class="card" id="gpar" style="background:var(--hi)"><h3 style="margin-top:0">' + sym('👪') + 'Parents and families: sign in with Google first</h3>' +
      (em ? '<p>✅ Signed in as <b>' + esc(em.email) + '</b>. Now type the parent password below. <button type="button" class="btn small quiet" id="gout">Not you?</button></p>' :
        '<p class="small">We ask parents to sign in so we know who you are and can send you news and reminders by email. We use only your email address, and only the teachers can see it.</p>' +
        '<div id="gbtn" style="min-height:44px"></div><p id="gmsg" class="small" role="status"></p>' + HOW) + '</div>';
  };
  T.parentGoogleWire = function () {
    var out = document.getElementById('gout'); if (out) out.onclick = function () { T.ls('gEmail', null); T.route(); };
    var box = document.getElementById('gbtn'); if (!box) return;
    var msg = document.getElementById('gmsg');
    var got = function (token) {
      msg.textContent = 'Checking…';
      Store.gpass(token).then(function (d) {
        var e = T.saved.enc, have = (e.more || []).map(function (m) { return m.id; });
        e.more = (e.more || []).concat((d.more || []).filter(function (m) { return have.indexOf(m.id) < 0; }));
        var c = claims(token); T.ls('gEmail', { email: String(c.email || '').toLowerCase(), name: String(c.name || '').slice(0, 80) });
        T.route();
      }).catch(function (er) { msg.textContent = er.message || String(er); });
    };
    Store.google().then(function (g) {
      if (!g || !g.clientId) { box.innerHTML = '<p class="err small">Google sign-in is not set up yet. Tell the teacher.</p>'; return; }
      if (g.clientId === 'dev') {
        box.innerHTML = '<div class="row"><input id="gdev" type="email" placeholder="Test: type an email (local test server only)" class="grow" style="min-height:44px"><button type="button" class="btn" id="gdgo">Sign in (test)</button></div>';
        document.getElementById('gdgo').onclick = function () { var v = document.getElementById('gdev').value.trim(); if (v) got('dev:' + v); };
        return;
      }
      return loadGis().then(function () {
        google.accounts.id.initialize({ client_id: g.clientId, callback: function (r) { got(r.credential); } });
        google.accounts.id.renderButton(box, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with' });
      });
    }).catch(function (er) { box.textContent = er.message || String(er); });
  };
  /* the family's contact: the signed-in Google email, sent once per Company member (news and changes for them; the parent can change it) */
  T.googleContact = function () { return T.ls('gEmail'); };

  /* ---------- Teacher › Emails: the Google sign-in card ---------- */
  T.googleCard = function (host) {
    if (!host) return;
    host.innerHTML = '<div class="card"><p class="muted">Checking Google sign-in…</p></div>';
    Store.google().then(function (g) {
      g = g || { clientId: '' };
      var parents = (T.show.passes || []).filter(function (p) { return p.who === 'parent'; });
      host.innerHTML = '<div class="card"><h3 style="margin-top:0">' + sym('👪') + 'Parents sign in with Google</h3>' +
        '<p class="small">A parent password marked here also needs <b>Sign in with Google</b> (any Google account). Their Google email becomes the family’s email for news and notifications (they choose what in the Family portal). Several parents can sign in for one Company member.</p>' +
        '<label class="f">Google Client ID<input id="gcid" value="' + esc(g.clientId || '') + '" placeholder="…apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>' +
        '<details class="small"><summary>How to make the Client ID (one time, about 10 minutes)</summary><ol style="margin:8px 0 0 18px">' +
        '<li>Go to <a href="https:' + '//console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">console.cloud.google.com/apis/credentials</a>, signed in to the Google account you want to own it (your personal account works best: the school’s may not allow it).</li>' +
        '<li>Make a project when it asks (name it “Theatre”).</li><li><b>OAuth consent screen</b>: User type <b>External</b>; app name “Theatre”; your email for support and contact; Save. Add no scopes. Then <b>Publish app</b> (it only asks for name and email, so Google doesn’t need to review it).</li>' +
        '<li><b>Credentials › Create credentials › OAuth client ID</b>: type <b>Web application</b>; under <b>Authorized JavaScript origins</b> add <code>https:' + '//asl.cool</code>. Create.</li>' +
        '<li>Copy the <b>Client ID</b> (it ends in .apps.googleusercontent.com) into the box above and Save.</li></ol></details>' +
        (parents.length ? '<h4>Which parent passwords need it</h4>' + parents.map(function (p) { return '<label class="switch"><span>' + esc(p.name) + (p.off ? ' <span class="tag">turned off</span>' : '') + '</span><input type="checkbox" data-gp="' + esc(p.id) + '"' + (p.google ? ' checked' : '') + '></label>'; }).join('') : '<p class="small muted">No parent password yet (Passwords & backup › Add a password › Parent).</p>') +
        '<div class="row end"><button class="btn primary" id="gsave" data-save>Save</button></div><p id="gst" class="small" role="status"></p></div>';
      document.getElementById('gsave').onclick = function () {
        var cid = document.getElementById('gcid').value.trim(), st = document.getElementById('gst'), on = [];
        host.querySelectorAll('[data-gp]').forEach(function (c) { var p = T.show.passes.find(function (x) { return x.id === c.dataset.gp; }); if (c.checked) { p.google = true; on.push(p.id); } else delete p.google; });
        if (on.length && !cid) { st.textContent = 'Paste the Client ID first: without it parents could not sign in.'; return; }
        st.textContent = 'Saving…';
        Store.setGoogle(T.proof, { clientId: cid, gated: on }).then(function () { return T.saveShow(on.length ? 'Parents now sign in with Google' : 'Saved'); })
          .then(function () { T.googleCard(host); }, function (e) { st.textContent = e.message || String(e); });
      };
    }).catch(function (e) { host.innerHTML = '<p class="card err">' + esc(e.message || e) + '</p>'; });
  };
})();
