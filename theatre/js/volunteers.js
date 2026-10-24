/* asl.cool/theatre: Volunteer and donate (Colleen 2026-10-24: "add a volunteer my time, skills, funds, items, donations to the parent version of the
   app where adults can post what the production needs and allow the parents to sign up to provide anything they'd like").
   Teachers post needs (T.show.helpBoard.posts); families sign up from the parent version, or offer something not on the list.
   Privacy: a sign-up travels as a note sealed with the show key (Store.queueNote) and waits on the server until the teacher opens this page.
   The show (which every Company device can open) keeps only the first name and last initial and how much; the full name and how to reach them
   go into the vault, sealed with the teacher password (V.extra.help), so only the teachers see them.
   Money: the app never takes payments. A family pledges an amount, and the teacher's own "how to give" words say where it goes.
   Editing (Colleen 2026-10-24: "i need the ability to edit donations and volunteers"): every need and every sign-up has Edit (a sign-up's name and
   contact are changed in the vault; it can move to another need or be deleted).
   Company dinner (Colleen 2026-10-24: "coordinate a company dinner for our one tech rehearsal… more than one person… a way for them to communicate
   with one another through the app or email since a whole company dinner would be expensive for only one family but spread out it's fine"):
   a need of kind 'meal' with a list of things to bring (p.items [{ id, name, need }]). Its plan lives on a board (api.js board/<post id>, sealed
   with the show key, live for everyone): a family taps "I'll bring this" (a claim: what, how many, first name + last initial, their email only if
   they tick "share my email with the other families helping"), and the families who signed up chat there. The sign-up also goes to the teacher
   as a note, so the full name and contact reach the vault. A claim can be taken back from the device that made it ('unclaim').
   T.show.helpBoard = { give, posts: [{ id, kind, title, detail, need, when, closed, items }], signups: [{ id, post, offer, who, fam, qty, note, at, done, item }] } */
(function (root) {
  'use strict';
  /* "Main dish (serves 10) x 4" -> { name, need }; no number = 1 */
  function parseItems(text, old) {
    old = old || [];
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 20).map(function (l, i) {
      var m = l.match(/^(.*?)\s*[x×]\s*(\d{1,3})$/i), name = (m ? m[1] : l).replace(/[\s:,-]+$/, '').slice(0, 80), need = m ? Math.max(1, +m[2]) : 1;
      var was = old.find(function (o) { return o.name.toLowerCase() === name.toLowerCase(); });
      return { id: was ? was.id : 'i' + i + '-' + Math.random().toString(36).slice(2, 6), name: name, need: need };
    });
  }
  var itemsText = function (items) { return (items || []).map(function (i) { return i.name + (i.need > 1 ? ' x ' + i.need : ''); }).join('\n'); };
  /* the board's messages -> who brings what. A claim counts until the same device takes it back. */
  function tally(items, msgs) {
    var gone = {}, out = {};
    msgs.forEach(function (m) { if (m.t === 'unclaim' && m.ref) gone[m.ref + '|' + (m.did || '')] = true; });
    (items || []).forEach(function (i) { out[i.id] = { got: 0, who: [] }; });
    msgs.forEach(function (m) {
      if (m.t !== 'claim' || !out[m.item] || gone[m.cid + '|' + (m.did || '')]) return;
      var q = Math.max(1, Math.min(99, +m.qty || 1)); out[m.item].got += q; out[m.item].who.push({ who: m.who, qty: q, note: m.note || '', email: m.email || '', cid: m.cid, did: m.did, at: m._at });
    });
    return out;
  }
  var core = { parseItems: parseItems, itemsText: itemsText, tally: tally };
  root.HelpCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.T) return;
  var T = window.T, H = window.HelpCore, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var KINDS = [['time', '🕐', 'Time', 'Help at a rehearsal, a build day or a show'], ['skill', '🛠️', 'Skills', 'Sewing, building, painting, hair and makeup, photos'],
    ['funds', '💵', 'Funds', 'Money toward costumes, sets or the cast party'], ['item', '📦', 'Items to lend', 'Something we borrow and give back'],
    ['gift', '🎁', 'Donations', 'Snacks, supplies or things to keep'], ['meal', '🍽️', 'Company dinner', 'A shared meal: each family brings part of it']];
  var kindOf = function (k) { return KINDS.find(function (x) { return x[0] === k; }) || KINDS[0]; };
  var uid = function (p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var money = function (n) { return '$' + (+n || 0).toLocaleString('en-US'); };
  function B() { var b = T.show.helpBoard = T.show.helpBoard || {}; b.posts = b.posts || []; b.signups = b.signups || []; return b; }
  function got(p) { return B().signups.filter(function (s) { return s.post === p.id; }).reduce(function (t, s) { return t + (+s.qty || 1); }, 0); }
  function needText(p) {
    var g = got(p);
    if (p.kind === 'meal') return (p.items || []).length + ' things to bring · see who is bringing what';
    if (p.kind === 'funds') return money(g) + ' pledged' + (p.need ? ' of ' + money(p.need) : '');
    return p.need ? g + ' of ' + p.need + ' signed up' : (g ? g + ' signed up' : 'Anyone who can');
  }
  var full = function (p) { return p.need && p.kind !== 'funds' && p.kind !== 'meal' && got(p) >= p.need; };
  var whenText = function (p) { return p.when ? (T.prodDay ? T.prodDay(p.when) : p.when) : ''; };
  function shortName(n) { return T.shortName ? T.shortName(n) : String(n || '').split(' ')[0]; }
  var dev = function () { var d = T.ls('helpDev'); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 12); T.ls('helpDev', d); } return d; };
  var preview = function () { return !!(T.pass && T.pass.preview); };

  /* ---------- Families (the parent version): what the show needs, and sign up ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.help = function (args) {
    if (args && args[0] === 'dinner' && args[1]) return dinner(args[1], false);
    T.setBar('Volunteer and donate', '#/home');
    var b = B(), mine = T.ls('helpMine') || [];
    var open = b.posts.filter(function (p) { return !p.closed; });
    app.innerHTML = '<div class="card"><h2>' + sym('🤝') + 'Help the show</h2><p>These are the things our production needs. Sign up for anything you’d like to give: your time, a skill, money, something to lend, or a donation. Every bit helps.</p>' +
      '<p class="muted small">' + sym('🔒') + 'Your name and how to reach you go only to the teachers. Everyone else sees just your first name and last initial.</p></div>' +
      (mine.length ? '<div class="card"><h3>' + sym('✅') + 'You signed up for</h3>' + mine.map(function (m) { return '<div class="switch"><span>' + esc(m.what) + (m.qty ? ' <span class="muted small">(' + esc(m.qty) + ')</span>' : '') + '</span><span class="muted small">Thank you!</span></div>'; }).join('') + '</div>' : '') +
      KINDS.map(function (k) {
        var l = open.filter(function (p) { return p.kind === k[0]; }); if (!l.length) return '';
        return '<h3>' + sym(k[1]) + k[2] + '</h3>' + l.map(function (p) {
          return '<div class="card row" style="margin-bottom:10px;flex-wrap:wrap"><div class="grow"><b style="font-size:1.1em">' + esc(p.title) + '</b>' + (p.when ? ' <span class="tag">' + esc(whenText(p)) + '</span>' : '') +
            (p.detail ? '<br><span class="small">' + esc(p.detail) + '</span>' : '') + '<br><span class="muted small">' + esc(needText(p)) + '</span></div>' +
            (p.kind === 'meal' ? '<a class="btn primary" href="#/help/dinner/' + encodeURIComponent(p.id) + '">See the dinner plan</a>' : full(p) ? '<span class="tag">Filled, thank you!</span>' : '<button class="btn primary" data-p="' + esc(p.id) + '">I can help</button>') + '</div>';
        }).join('');
      }).join('') +
      (open.length ? '' : '<p class="card muted">Nothing is posted yet. Check back soon, or offer something below.</p>') +
      '<div class="card"><h3>' + sym('💡') + 'Offer something else</h3><p class="small">Have a skill, an item or time to give that isn’t listed? Tell us.</p><button class="btn" id="other">Make an offer</button></div>' +
      (b.give ? '<div class="card"><h3>' + sym('💵') + 'How to give money</h3><p>' + esc(b.give) + '</p></div>' : '');
    app.querySelectorAll('[data-p]').forEach(function (bt) { bt.onclick = function () { form(b.posts.find(function (p) { return p.id === bt.dataset.p; })); }; });
    document.getElementById('other').onclick = function () { form(null); };
  };
  /* the sign-up form; for a dinner item (it) it also puts a claim on the dinner board */
  function form(p, it, after) {
    var funds = p && p.kind === 'funds', meal = !!it, d = document.createElement('dialog'), last = T.ls('helpMe') || {};
    d.innerHTML = '<h2>' + (meal ? esc(it.name) : p ? esc(p.title) : 'Make an offer') + '</h2>' + (meal ? '<p class="muted small">' + esc(p.title) + (p.when ? ' · ' + esc(whenText(p)) : '') + '</p>' : '') +
      (p ? '' : '<label class="f">What kind<select id="vk">' + KINDS.filter(function (k) { return k[0] !== 'meal'; }).map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label><label class="f">What you can give<input id="vw" maxlength="120" placeholder="e.g. I can sew hems, or a folding table to lend"></label>') +
      '<label class="f">Your name<input id="vn" maxlength="80" autocomplete="name" value="' + esc(last.name || '') + '"></label>' +
      '<label class="f">How can the teachers reach you? (email or phone)<input id="vc" maxlength="120" autocomplete="email" value="' + esc(last.contact || ((T.googleContact && T.googleContact()) || {}).email || '') + '"></label>' +
      (funds ? '<label class="f">How much would you like to give? $<input id="vq" inputmode="decimal" maxlength="8"></label><p class="muted small">This is a promise, not a payment. The teachers will tell you how to give.</p>'
        : '<label class="f">How many? ' + (meal ? '' : '(people, hours or items; optional)') + '<input id="vq" inputmode="numeric" maxlength="3" placeholder="1"></label>') +
      '<label class="f">' + (meal ? 'What you’ll bring (optional)' : 'Anything we should know? (optional)') + '<input id="vo" maxlength="200"' + (meal ? ' placeholder="e.g. veggie lasagna, serves 12"' : '') + '></label>' +
      (meal ? '<label class="agree" style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" id="vsh" style="width:26px;height:26px;flex:none"' + (last.share ? ' checked' : '') + '><span>Share my email with the other families helping with this dinner, so we can plan together. <span class="muted small">(Without it, you can still talk in the app’s dinner chat.)</span></span></label>' : '') +
      '<p id="ve" class="err" role="alert"></p><div class="row end"><button class="btn" id="vx">Cancel</button><button class="btn primary" id="vs">Sign up</button></div>';
    document.body.appendChild(d); d.showModal();
    var close = function () { d.close(); d.remove(); };
    d.querySelector('#vx').onclick = close;
    d.querySelector('#vs').onclick = function () {
      var v = function (id) { var e = d.querySelector('#' + id); return e ? e.value.trim() : ''; };
      var name = v('vn'), what = meal ? it.name : p ? p.title : v('vw'), contact = v('vc'), share = meal && d.querySelector('#vsh').checked;
      if (!name) { d.querySelector('#ve').textContent = 'Please type your name.'; return; }
      if (!p && !what) { d.querySelector('#ve').textContent = 'Please say what you can give.'; return; }
      if (share && !/@/.test(contact)) { d.querySelector('#ve').textContent = 'To share your email, type it in the box above.'; return; }
      var qty = v('vq').replace(funds ? /[^\d.]/g : /[^\d]/g, '').slice(0, 8), sid = uid('s');
      if (!preview()) T.ls('helpMe', { name: name, contact: contact, share: share });
      var note = { type: 'volunteer', sid: sid, post: p ? p.id : '', item: meal ? it.id : '', offer: p ? null : { kind: v('vk'), title: what.slice(0, 120) }, name: name.slice(0, 80), contact: contact.slice(0, 120), qty: qty, note: v('vo').slice(0, 200), fam: T.me && T.me.id };
      Store.queueNote(T.key, note).catch(function () {});
      var claim = meal ? Store.boardPost(T.key, p.id, { t: 'claim', cid: sid, did: dev(), item: it.id, qty: +qty || 1, who: shortName(name), note: v('vo').slice(0, 200), email: share ? contact.slice(0, 120) : '', fam: T.me && T.me.id }) : Promise.resolve();
      claim.then(function () {
        if (!preview()) { var mine = T.ls('helpMine') || []; mine.push({ what: what + (meal ? ' (' + p.title + ')' : ''), qty: funds && qty ? money(qty) : qty, post: p ? p.id : '', cid: meal ? sid : '' }); T.ls('helpMine', mine); }
        close(); T.toast('Thank you! The teachers will be in touch.'); (after || T.studentPages.help)();
      }, function (e) { d.querySelector('#ve').textContent = e.message || 'Could not send. Check the internet and try again.'; });
    };
  }

  /* ---------- the Company dinner plan: who brings what, and the families' chat (families and the teacher) ---------- */
  function dinner(id, teacher) {
    var p = B().posts.find(function (x) { return x.id === id; });
    T.setBar('Company dinner', teacher ? '#/teacher/volunteers' : '#/help');
    if (!p) { app.innerHTML = '<p class="card">This dinner is not on the list anymore.</p>'; return; }
    app.innerHTML = '<p class="card muted">Opening the dinner plan…</p>';
    var msgs = [];
    function draw() {
      var t = H.tally(p.items, msgs), d = dev(), mineClaims = [];
      (p.items || []).forEach(function (i) { t[i.id].who.forEach(function (w) { if (w.did === d) mineClaims.push({ item: i, w: w }); }); });
      var joined = teacher || mineClaims.length > 0;
      var chat = msgs.filter(function (m) { return m.t === 'msg'; }), emails = {};
      msgs.forEach(function (m) { if (m.t === 'claim' && m.email) emails[m.email.toLowerCase()] = m.who; });
      app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('🍽️') + esc(p.title) + '</h2>' + (p.when ? '<p><b>' + esc(whenText(p)) + '</b></p>' : '') + (p.detail ? '<p>' + esc(p.detail) + '</p>' : '') +
        '<p class="small muted">Each family brings part of the dinner, so nobody pays for all of it. Tap <b>I’ll bring this</b> on anything still needed.</p></div>' +
        '<div class="card"><h3 style="margin-top:0">What we need</h3>' + (p.items || []).map(function (i) {
          var x = t[i.id], left = Math.max(0, i.need - x.got);
          return '<div class="switch" style="flex-wrap:wrap;cursor:default"><span class="grow"><b>' + esc(i.name) + '</b> <span class="tag ' + (left ? 'no-tag' : 'ok-tag') + '">' + (left ? x.got + ' of ' + i.need : '✓ Covered') + '</span>' +
            (x.who.length ? '<br><span class="small">' + x.who.map(function (w) { return esc(w.who) + (w.qty > 1 ? ' ×' + w.qty : '') + (w.note ? ' (' + esc(w.note) + ')' : '') + (w.did === d && !teacher ? ' <button class="btn small quiet" data-un="' + esc(w.cid) + '">Take back</button>' : '') + (teacher ? ' <button class="btn small quiet" data-rm="' + esc(w.cid) + '" title="Remove this claim">✕</button>' : ''); }).join(' · ') + '</span>' : '') + '</span>' +
            (teacher ? '' : '<button class="btn' + (left ? ' primary' : '') + '" data-it="' + esc(i.id) + '">' + (left ? 'I’ll bring this' : 'Bring one more') + '</button>') + '</div>';
        }).join('') + '</div>' +
        '<div class="card"><h3 style="margin-top:0">' + sym('💬') + 'Dinner chat</h3>' + (joined ?
          '<p class="small muted">For the families helping with this dinner' + (teacher ? ' (you can remove any message)' : '') + '. Everyone using the app can read it, so keep it to dinner plans.</p>' +
          (Object.keys(emails).length ? '<p class="small"><b>Emails shared by families helping:</b> ' + Object.keys(emails).map(function (e) { return esc(emails[e]) + ' <a href="mailto:' + esc(e) + '">' + esc(e) + '</a>'; }).join(' · ') +
            ' <a class="btn small" href="mailto:' + Object.keys(emails).map(encodeURIComponent).join(',') + '?subject=' + encodeURIComponent(p.title) + '">Email all of them</a></p>' : '') +
          (chat.length ? chat.map(function (m) { return '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>' + esc(m.who) + '</b> <span class="muted small">' + esc(new Date(m._at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</span>' + (teacher ? ' <button class="btn small quiet" data-del="' + esc(m._id) + '">Remove</button>' : '') + '<div style="white-space:pre-wrap">' + esc(m.text) + '</div></div>'; }).join('') : '<p class="muted">No messages yet. Say hi and what you’re planning to bring.</p>') +
          '<div class="row" style="margin-top:10px"><textarea id="dm" class="grow" maxlength="600" rows="2" style="min-height:56px;border-radius:12px;border:2px solid var(--line);background:var(--card);padding:8px" placeholder="Write to the other families…"></textarea><button class="btn primary" id="dsend">Send</button></div>'
          : '<p class="muted">Sign up for something above to join the chat with the other families helping.</p>') + '</div>';
      app.querySelectorAll('[data-it]').forEach(function (bt) { bt.onclick = function () { form(p, p.items.find(function (i) { return i.id === bt.dataset.it; }), load); }; });
      app.querySelectorAll('[data-un]').forEach(function (bt) { bt.onclick = function () {
        if (!confirm('Take this back? The other families will see it is needed again.')) return;
        Store.boardPost(T.key, p.id, { t: 'unclaim', ref: bt.dataset.un, did: d }).then(function () { if (!preview()) T.ls('helpMine', (T.ls('helpMine') || []).filter(function (m) { return m.cid !== bt.dataset.un; })); load(); }, function (e) { T.toast(e.message); });
      }; });
      app.querySelectorAll('[data-del]').forEach(function (bt) { bt.onclick = function () { Store.boardDel(T.proof, p.id, [bt.dataset.del]).then(load, function (e) { T.toast(e.message); }); }; });
      app.querySelectorAll('[data-rm]').forEach(function (bt) { bt.onclick = function () { var ids = msgs.filter(function (m) { return m.t === 'claim' && m.cid === bt.dataset.rm; }).map(function (m) { return m._id; }); if (confirm('Remove this from the dinner plan?')) Store.boardDel(T.proof, p.id, ids).then(load, function (e) { T.toast(e.message); }); }; });
      var send = document.getElementById('dsend');
      if (send) send.onclick = function () {
        var box = document.getElementById('dm'), text = box.value.trim(); if (!text) return;
        var who = teacher ? (T.show.mail && T.show.mail.sign) || 'Teacher' : (mineClaims[0] ? mineClaims[0].w.who : shortName((T.ls('helpMe') || {}).name || 'A family'));
        send.disabled = true;
        Store.boardPost(T.key, p.id, { t: 'msg', who: who, text: text.slice(0, 600), did: d }).then(function () { load(); }, function (e) { send.disabled = false; T.toast(e.message || 'Could not send.'); });
      };
    }
    function load() { return Store.boardGet(T.key, p.id).then(function (l) { msgs = l; draw(); }).catch(function () { msgs = []; draw(); T.toast('Could not load the newest plan. Check the internet.'); }); }
    load();
    var tick = setInterval(function () { if (!document.querySelector('dialog[open]') && !(document.getElementById('dm') || {}).value) load(); }, 30000);      // new messages every 30 seconds while the page is open
    T.cleanup.push(function () { clearInterval(tick); });
  }

  /* ---------- Teachers: post needs, see who signed up, edit both ---------- */
  /* sign-ups waiting on the server: only this page takes them in, so the contact goes straight into the vault */
  function pullSignups() {
    if (!T.proof || !T.withVault) return Promise.resolve(0);
    return Store.getNotes(T.key, T.proof).then(function (notes) {
      var mine = notes.filter(function (n) { return n.type === 'volunteer' && typeof n.sid === 'string' && n.name; });
      if (!mine.length) return 0;
      var b = B(), add = [];
      mine.forEach(function (n) {
        if (b.signups.some(function (s) { return s.id === n.sid; })) return;
        if (n.post && !b.posts.some(function (p) { return p.id === n.post; })) n.post = '';
        var offer = n.post ? null : { kind: KINDS.some(function (k) { return k[0] === (n.offer && n.offer.kind); }) ? n.offer.kind : 'gift', title: String((n.offer && n.offer.title) || 'An offer').slice(0, 120) };
        b.signups.push({ id: n.sid, post: n.post, item: String(n.item || '').slice(0, 40), offer: offer, who: shortName(String(n.name)), fam: n.fam || '', qty: String(n.qty || '').slice(0, 8), note: String(n.note || '').slice(0, 200), at: n._at });
        add.push(n);
      });
      return T.withVault(function (V) { var h = V.extra.help = V.extra.help || {}; add.forEach(function (n) { h[n.sid] = { name: String(n.name).slice(0, 80), contact: String(n.contact || '').slice(0, 120) }; }); })
        .then(function () { return add.length ? T.saveShow(add.length + ' new sign-up' + (add.length === 1 ? '' : 's')) : null; })
        .then(function () { return Store.clearNotes(T.proof, mine.map(function (n) { return n._id; })); })
        .then(function () { return add.length; });
    }).catch(function () { return 0; });
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.dinner = function (args) { dinner(args[0], true); };
  T.teacherPages.volunteers = function () {
    T.setBar('Volunteers and donations', '#/teacher');
    var contacts = {};
    function draw() {
      var b = B();
      var famName = function (id) { var a = (T.show.cast || []).find(function (x) { return x.id === id; }); return a ? a.name : ''; };
      var person = function (s) { var c = contacts[s.id]; return '<b>' + esc(c ? c.name : s.who) + '</b>' + (s.fam && famName(s.fam) ? ' <span class="muted small">(' + esc(famName(s.fam)) + '’s family)</span>' : '') + (c && c.contact ? ' · <span class="small">' + esc(c.contact) + '</span>' : ''); };
      var itemName = function (s) { var p = b.posts.find(function (x) { return x.id === s.post; }), i = p && (p.items || []).find(function (x) { return x.id === s.item; }); return i ? i.name : ''; };
      var signRow = function (s, funds) {
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow">' + person(s) + (itemName(s) ? ' · ' + esc(itemName(s)) : '') + (s.qty ? ' · ' + esc(funds ? money(s.qty) : s.qty) : '') + (s.note ? '<br><span class="muted small">' + esc(s.note) + '</span>' : '') + '</span>' +
          '<div class="seg" data-s="' + esc(s.id) + '">' + [['', 'Signed up'], ['got', funds ? 'Received' : 'Done'], ['thanked', 'Thanked']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + ((s.done || '') === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
          ' <button class="btn small noprint" data-es="' + esc(s.id) + '">Edit</button></div>';
      };
      var offers = b.signups.filter(function (s) { return !s.post; });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('🤝') + 'What the show needs</h2><p class="muted small">Families see these in the parent version of the app (Volunteer and donate) and sign up. Their full names and contacts are only here, locked with the teacher password; everyone else sees a first name and last initial. The app never takes payments.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><label class="f" style="margin:0">Kind<select id="nk">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f grow" style="margin:0">What we need<input id="nt" maxlength="120" placeholder="e.g. Sewing help for costume hems"></label></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><label class="f grow" style="margin:0">Details (optional)<input id="nd" maxlength="300" placeholder="When, where, sizes, what kind"></label>' +
        '<label class="f" style="margin:0;width:150px" id="nqw"><span id="nql">How many</span><input id="nq" inputmode="decimal" placeholder="any"></label><label class="f" style="margin:0">Date (optional)<input id="nw" type="date"></label></div>' +
        '<label class="f" id="niw" hidden>What to bring, one per line; “x 3” at the end when you need more than one<textarea id="ni" rows="6" placeholder="Main dish (serves 10) x 4\nSalad x 2\nRolls or bread x 2\nDrinks x 3\nDessert x 3\nPlates, cups, napkins, forks"></textarea></label>' +
        '<div class="row end"><button class="btn primary" id="nadd" data-save>Post it</button></div>' +
        '<label class="f" style="margin-top:12px">How families give money (shown with every Funds need)<input id="ng" maxlength="300" value="' + esc(b.give || '') + '" placeholder="e.g. Checks to LTHS Theatre Boosters, given to Ms. Elyse"></label>' +
        '<div class="row end"><button class="btn" onclick="print()">' + icon('print') + 'Print</button></div><p id="nst" class="muted small" role="status"></p></div>' +
        KINDS.map(function (k) {
          var l = b.posts.filter(function (p) { return p.kind === k[0]; }); if (!l.length) return '';
          return '<h3>' + sym(k[1]) + k[2] + '</h3>' + l.map(function (p) {
            var ss = b.signups.filter(function (s) { return s.post === p.id; });
            return '<div class="card" style="margin-bottom:10px' + (p.closed ? ';opacity:.6' : '') + '"><div class="row" style="flex-wrap:wrap"><div class="grow"><b>' + esc(p.title) + '</b>' + (p.when ? ' <span class="tag">' + esc(whenText(p)) + '</span>' : '') + (p.closed ? ' <span class="tag">closed</span>' : '') +
              (p.detail ? '<br><span class="small">' + esc(p.detail) + '</span>' : '') + '<br><span class="muted small">' + esc(needText(p)) + '</span>' +
              (p.kind === 'meal' ? '<br><span class="small">' + (p.items || []).map(function (i) { return esc(i.name) + (i.need > 1 ? ' ×' + i.need : ''); }).join(' · ') + '</span>' : '') + '</div>' +
              '<div class="noprint">' + (p.kind === 'meal' ? '<a class="btn small primary" href="#/teacher/dinner/' + encodeURIComponent(p.id) + '">Dinner plan and chat</a> ' : '') +
              '<button class="btn small" data-ep="' + esc(p.id) + '">Edit</button> <button class="btn small" data-close="' + esc(p.id) + '" data-save>' + (p.closed ? 'Open again' : 'Close') + '</button> <button class="btn small" data-del="' + esc(p.id) + '" data-save>Delete</button></div></div>' +
              (ss.length ? ss.map(function (s) { return signRow(s, p.kind === 'funds'); }).join('') : '<p class="muted small">No sign-ups yet.</p>') + '</div>';
          }).join('');
        }).join('') +
        (offers.length ? '<h3>' + sym('💡') + 'Offers not on the list</h3><div class="card">' + offers.map(function (s) { return '<div class="small muted">' + esc(kindOf(s.offer && s.offer.kind)[1] + ' ' + (s.offer ? s.offer.title : '')) + '</div>' + signRow(s, s.offer && s.offer.kind === 'funds'); }).join('') + '</div>' : '') +
        (b.posts.length ? '' : '<p class="card muted">Nothing posted yet. Post the first need above.</p>');
      var kindSel = document.getElementById('nk');
      kindSel.onchange = function () { var k = kindSel.value; document.getElementById('nql').textContent = k === 'funds' ? 'Goal $' : 'How many'; document.getElementById('niw').hidden = k !== 'meal'; document.getElementById('nqw').hidden = k === 'meal'; };
      document.getElementById('nadd').onclick = function () {
        var t = document.getElementById('nt').value.trim(); if (!t) { document.getElementById('nst').textContent = 'Type what you need first.'; return; }
        var k = kindSel.value, items = k === 'meal' ? H.parseItems(document.getElementById('ni').value) : undefined;
        if (k === 'meal' && !items.length) { document.getElementById('nst').textContent = 'List what families can bring, one per line.'; return; }
        var p = { id: uid('n'), kind: k, title: t.slice(0, 120), detail: document.getElementById('nd').value.trim().slice(0, 300),
          need: k === 'meal' ? 0 : Math.max(0, +document.getElementById('nq').value.replace(/[^\d.]/g, '') || 0), when: document.getElementById('nw').value || '', closed: false };
        if (items) p.items = items;
        B().posts.push(p); T.saveShow('Posted').then(draw);
      };
      document.getElementById('ng').onchange = function () { B().give = this.value.trim().slice(0, 300); T.saveShow('Saved'); };
      app.querySelectorAll('[data-close]').forEach(function (bt) { bt.onclick = function () { var p = B().posts.find(function (x) { return x.id === bt.dataset.close; }); p.closed = !p.closed; T.saveShow(p.closed ? 'Closed' : 'Open again').then(draw); }; });
      app.querySelectorAll('[data-del]').forEach(function (bt) { bt.onclick = function () {
        var b2 = B(), n = b2.signups.filter(function (s) { return s.post === bt.dataset.del; }).length;
        if (!confirm(n ? 'Delete this need? Its ' + n + ' sign-up' + (n === 1 ? '' : 's') + ' will move to “Offers not on the list.”' : 'Delete this need?')) return;
        var p = b2.posts.find(function (x) { return x.id === bt.dataset.del; });
        b2.signups.forEach(function (s) { if (s.post === p.id) { s.post = ''; s.offer = { kind: p.kind === 'meal' ? 'gift' : p.kind, title: p.title }; } });
        b2.posts = b2.posts.filter(function (x) { return x !== p; });
        (p.kind === 'meal' ? Store.boardDel(T.proof, p.id, 'all').catch(function () {}) : Promise.resolve()).then(function () { return T.saveShow('Deleted'); }).then(draw);
      }; });
      app.querySelectorAll('.seg[data-s] button').forEach(function (bt) { bt.onclick = function () { var s = B().signups.find(function (x) { return x.id === bt.parentNode.dataset.s; }); s.done = bt.dataset.v; T.saveShow('Saved').then(draw); }; });
      app.querySelectorAll('[data-ep]').forEach(function (bt) { bt.onclick = function () { editPost(B().posts.find(function (x) { return x.id === bt.dataset.ep; })); }; });
      app.querySelectorAll('[data-es]').forEach(function (bt) { bt.onclick = function () { editSignup(B().signups.find(function (x) { return x.id === bt.dataset.es; })); }; });
    }
    /* edit a need: its kind, words, how many, date, and (dinner) what to bring */
    function editPost(p) {
      if (!p) return;
      T.dialog('<h2>Edit this need</h2><label class="f">Kind<select id="ek">' + KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (p.kind === k[0] ? ' selected' : '') + '>' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f">What we need<input id="et" maxlength="120" value="' + esc(p.title) + '"></label><label class="f">Details<input id="ed" maxlength="300" value="' + esc(p.detail || '') + '"></label>' +
        '<label class="f" id="eqw"><span id="eql">' + (p.kind === 'funds' ? 'Goal $' : 'How many (0 = any)') + '</span><input id="eq" inputmode="decimal" value="' + esc(p.need || '') + '"></label>' +
        '<label class="f">Date<input id="ew" type="date" value="' + esc(p.when || '') + '"></label>' +
        '<label class="f" id="eiw">What to bring, one per line; “x 3” at the end for more than one<textarea id="ei" rows="6">' + esc(H.itemsText(p.items)) + '</textarea></label>' +
        '<p class="muted small" id="einote">Changing an item’s name starts it fresh on the dinner plan; families who signed up for the old one stay in the list below.</p>' +
        '<p id="ee" class="err" role="alert"></p><div class="row end"><button class="btn" id="ex">Cancel</button><button class="btn primary" id="es" data-save>Save</button></div>', function (d) {
        var sync = function () { var k = d.querySelector('#ek').value; d.querySelector('#eiw').hidden = d.querySelector('#einote').hidden = k !== 'meal'; d.querySelector('#eqw').hidden = k === 'meal'; d.querySelector('#eql').textContent = k === 'funds' ? 'Goal $' : 'How many (0 = any)'; };
        d.querySelector('#ek').onchange = sync; sync();
        d.querySelector('#ex').onclick = function () { d.close(); };
        d.querySelector('#es').onclick = function () {
          var t = d.querySelector('#et').value.trim(), k = d.querySelector('#ek').value; if (!t) { d.querySelector('#ee').textContent = 'Type what you need.'; return; }
          var items = k === 'meal' ? H.parseItems(d.querySelector('#ei').value, p.items) : null;
          if (k === 'meal' && !items.length) { d.querySelector('#ee').textContent = 'List what families can bring, one per line.'; return; }
          p.kind = k; p.title = t.slice(0, 120); p.detail = d.querySelector('#ed').value.trim().slice(0, 300); p.when = d.querySelector('#ew').value || '';
          p.need = k === 'meal' ? 0 : Math.max(0, +d.querySelector('#eq').value.replace(/[^\d.]/g, '') || 0);
          if (items) p.items = items; else delete p.items;
          T.saveShow('Saved').then(function () { d.close(); draw(); });
        };
      });
    }
    /* a dinner sign-up changed or deleted here: change its claim on the dinner plan too (same claim id and device, so the family can still take it back) */
    function syncClaim(oldPost, s, gone) {
      var was = B().posts.find(function (x) { return x.id === oldPost; }), now = B().posts.find(function (x) { return x.id === s.post; });
      var jobs = [];
      if (was && was.kind === 'meal') jobs.push(Store.boardGet(T.key, was.id).then(function (l) {
        var mine = l.filter(function (m) { return m.t === 'claim' && m.cid === s.id; }), keep = mine[0] || {};
        return (mine.length ? Store.boardDel(T.proof, was.id, mine.map(function (m) { return m._id; })) : Promise.resolve()).then(function () { return keep; });
      }));
      return Promise.all(jobs).then(function (r) {
        var keep = r[0] || {};
        if (gone || !now || now.kind !== 'meal' || !s.item) return;
        return Store.boardPost(T.key, now.id, { t: 'claim', cid: s.id, did: keep.did || '', item: s.item, qty: +s.qty || 1, who: s.who, note: s.note || '', email: keep.email || '', fam: s.fam || '' });
      }).catch(function () { T.toast('The dinner plan could not be updated. Check the internet.', 4000); });
    }
    /* edit a sign-up: name and contact (in the vault), how many, note, which need; or delete it */
    function editSignup(s) {
      if (!s) return;
      var c = contacts[s.id] || { name: s.who, contact: '' }, b = B();
      T.dialog('<h2>Edit this sign-up</h2><label class="f">Name<input id="sn" maxlength="80" value="' + esc(c.name) + '"></label>' +
        '<label class="f">How to reach them<input id="sc" maxlength="120" value="' + esc(c.contact || '') + '"></label>' +
        '<label class="f">How many (or $ for funds)<input id="sq" maxlength="8" value="' + esc(s.qty || '') + '"></label>' +
        '<label class="f">Note<input id="so" maxlength="200" value="' + esc(s.note || '') + '"></label>' +
        '<label class="f">For which need<select id="sp"><option value="">Offers not on the list</option>' + b.posts.map(function (p) { return '<option value="' + esc(p.id) + '"' + (s.post === p.id ? ' selected' : '') + '>' + esc(kindOf(p.kind)[1] + ' ' + p.title) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f" id="siw">Bringing<select id="si"></select></label>' +
        '<p id="se" class="err" role="alert"></p><div class="row end"><button class="btn" id="sdel" data-save>Delete sign-up</button><span class="grow"></span><button class="btn" id="sx">Cancel</button><button class="btn primary" id="ss" data-save>Save</button></div>', function (d) {
        var items = function () { var p = b.posts.find(function (x) { return x.id === d.querySelector('#sp').value; }); var l = p && p.kind === 'meal' ? p.items || [] : []; d.querySelector('#siw').hidden = !l.length; d.querySelector('#si').innerHTML = l.map(function (i) { return '<option value="' + esc(i.id) + '"' + (s.item === i.id ? ' selected' : '') + '>' + esc(i.name) + '</option>'; }).join(''); };
        d.querySelector('#sp').onchange = items; items();
        d.querySelector('#sx').onclick = function () { d.close(); };
        d.querySelector('#sdel').onclick = function () {
          if (!confirm('Delete this sign-up? Their name and contact are removed too.')) return;
          b.signups = b.signups.filter(function (x) { return x !== s; });
          syncClaim(s.post, s, true);
          T.withVault(function (V) { if (V.extra.help) delete V.extra.help[s.id]; }).then(function () { return T.saveShow('Sign-up deleted'); }).then(function () { d.close(); open().then(draw); });
        };
        d.querySelector('#ss').onclick = function () {
          var name = d.querySelector('#sn').value.trim(); if (!name) { d.querySelector('#se').textContent = 'Type a name.'; return; }
          var post = d.querySelector('#sp').value, p = b.posts.find(function (x) { return x.id === post; });
          s.who = shortName(name); s.qty = d.querySelector('#sq').value.replace(/[^\d.]/g, '').slice(0, 8); s.note = d.querySelector('#so').value.trim().slice(0, 200);
          var oldPost = s.post;
          if (post !== s.post) { if (!post && s.post) { var old = b.posts.find(function (x) { return x.id === s.post; }); s.offer = { kind: old && old.kind !== 'meal' ? old.kind : 'gift', title: old ? old.title : 'An offer' }; } if (post) s.offer = null; s.post = post; }
          if (p && p.kind === 'meal') s.item = d.querySelector('#si').value; else delete s.item;
          syncClaim(oldPost, s);
          T.withVault(function (V) { var h = V.extra.help = V.extra.help || {}; h[s.id] = { name: name.slice(0, 80), contact: d.querySelector('#sc').value.trim().slice(0, 120) }; })
            .then(function () { return T.saveShow('Sign-up saved'); }).then(function () { d.close(); open().then(draw); });
        };
      });
    }
    var open = function () { return T.openVault ? T.openVault().then(function (V) { contacts = (V.extra && V.extra.help) || {}; }) : Promise.resolve(); };
    draw();
    open().then(draw).then(pullSignups).then(function (n) { if (n) return open().then(draw); });
  };
})();
