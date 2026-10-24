/* asl.cool/theatre: Volunteer and donate (Colleen 2026-10-24: "add a volunteer my time, skills, funds, items, donations to the parent version of the
   app where adults can post what the production needs and allow the parents to sign up to provide anything they'd like").
   Teachers post needs (T.show.helpBoard.posts); families sign up from the parent version, or offer something not on the list.
   Privacy: a sign-up travels as a note sealed with the show key (Store.queueNote) and waits on the server until the teacher opens this page.
   The show (which every Company iPad can open) keeps only the first name and last initial and how much; the full name and how to reach them
   go into the vault, sealed with the teacher password (V.extra.help), so only the teachers see them.
   Money: the app never takes payments. A family pledges an amount, and the teacher's own "how to give" words say where it goes.
   T.show.helpBoard = { give, posts: [{ id, kind, title, detail, need, when, closed }], signups: [{ id, post, offer, who, fam, qty, note, at, done }] } */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var KINDS = [['time', '🕐', 'Time', 'Help at a rehearsal, a build day or a show'], ['skill', '🛠️', 'Skills', 'Sewing, building, painting, hair and makeup, photos'],
    ['funds', '💵', 'Funds', 'Money toward costumes, sets or the cast party'], ['item', '📦', 'Items to lend', 'Something we borrow and give back'],
    ['gift', '🎁', 'Donations', 'Snacks, supplies or things to keep']];
  var kindOf = function (k) { return KINDS.find(function (x) { return x[0] === k; }) || KINDS[0]; };
  var uid = function (p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var money = function (n) { return '$' + (+n || 0).toLocaleString('en-US'); };
  function B() { var b = T.show.helpBoard = T.show.helpBoard || {}; b.posts = b.posts || []; b.signups = b.signups || []; return b; }
  function got(p) { return B().signups.filter(function (s) { return s.post === p.id; }).reduce(function (t, s) { return t + (+s.qty || 1); }, 0); }
  function needText(p) {
    var g = got(p);
    if (p.kind === 'funds') return money(g) + ' pledged' + (p.need ? ' of ' + money(p.need) : '');
    return p.need ? g + ' of ' + p.need + ' signed up' : (g ? g + ' signed up' : 'Anyone who can');
  }
  var full = function (p) { return p.need && p.kind !== 'funds' && got(p) >= p.need; };
  var whenText = function (p) { return p.when ? (T.prodDay ? T.prodDay(p.when) : p.when) : ''; };
  function shortName(n) { return T.shortName ? T.shortName(n) : String(n || '').split(' ')[0]; }

  /* ---------- Families (the parent version): what the show needs, and sign up ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.help = function () {
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
            (full(p) ? '<span class="tag">Filled, thank you!</span>' : '<button class="btn primary" data-p="' + esc(p.id) + '">I can help</button>') + '</div>';
        }).join('');
      }).join('') +
      (open.length ? '' : '<p class="card muted">Nothing is posted yet. Check back soon, or offer something below.</p>') +
      '<div class="card"><h3>' + sym('💡') + 'Offer something else</h3><p class="small">Have a skill, an item or time to give that isn’t listed? Tell us.</p><button class="btn" id="other">Make an offer</button></div>' +
      (b.give ? '<div class="card"><h3>' + sym('💵') + 'How to give money</h3><p>' + esc(b.give) + '</p></div>' : '');
    app.querySelectorAll('[data-p]').forEach(function (bt) { bt.onclick = function () { form(b.posts.find(function (p) { return p.id === bt.dataset.p; })); }; });
    document.getElementById('other').onclick = function () { form(null); };
  };
  function form(p) {
    var funds = p && p.kind === 'funds', d = document.createElement('dialog');
    d.innerHTML = '<h2>' + (p ? esc(p.title) : 'Make an offer') + '</h2>' +
      (p ? '' : '<label class="f">What kind<select id="vk">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label><label class="f">What you can give<input id="vw" maxlength="120" placeholder="e.g. I can sew hems, or a folding table to lend"></label>') +
      '<label class="f">Your name<input id="vn" maxlength="80" autocomplete="name"></label>' +
      '<label class="f">How can the teachers reach you? (email or phone)<input id="vc" maxlength="120" autocomplete="email"></label>' +
      (funds ? '<label class="f">How much would you like to give? $<input id="vq" inputmode="decimal" maxlength="8"></label><p class="muted small">This is a promise, not a payment. The teachers will tell you how to give.</p>'
        : '<label class="f">How many? (people, hours or items; optional)<input id="vq" inputmode="numeric" maxlength="4" placeholder="1"></label>') +
      '<label class="f">Anything we should know? (optional)<input id="vo" maxlength="200"></label><p id="ve" class="err" role="alert"></p>' +
      '<div class="row end"><button class="btn" id="vx">Cancel</button><button class="btn primary" id="vs">Sign up</button></div>';
    document.body.appendChild(d); d.showModal();
    var close = function () { d.close(); d.remove(); };
    d.querySelector('#vx').onclick = close;
    d.querySelector('#vs').onclick = function () {
      var v = function (id) { var e = d.querySelector('#' + id); return e ? e.value.trim() : ''; };
      var name = v('vn'), what = p ? p.title : v('vw');
      if (!name) { d.querySelector('#ve').textContent = 'Please type your name.'; return; }
      if (!p && !what) { d.querySelector('#ve').textContent = 'Please say what you can give.'; return; }
      var qty = v('vq').replace(funds ? /[^\d.]/g : /[^\d]/g, '').slice(0, 8);
      var note = { type: 'volunteer', sid: uid('s'), post: p ? p.id : '', offer: p ? null : { kind: v('vk'), title: what.slice(0, 120) }, name: name.slice(0, 80), contact: v('vc').slice(0, 120), qty: qty, note: v('vo').slice(0, 200), fam: T.me && T.me.id };
      Store.queueNote(T.key, note).catch(function () {});
      var mine = T.ls('helpMine') || []; mine.push({ what: what, qty: funds && qty ? money(qty) : qty }); T.ls('helpMine', mine);
      close(); T.toast('Thank you! The teachers will be in touch.'); T.studentPages.help();
    };
  }

  /* ---------- Teachers: post needs, see who signed up ---------- */
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
        b.signups.push({ id: n.sid, post: n.post, offer: offer, who: shortName(String(n.name)), fam: n.fam || '', qty: String(n.qty || '').slice(0, 8), note: String(n.note || '').slice(0, 200), at: n._at });
        add.push(n);
      });
      return T.withVault(function (V) { var h = V.extra.help = V.extra.help || {}; add.forEach(function (n) { h[n.sid] = { name: String(n.name).slice(0, 80), contact: String(n.contact || '').slice(0, 120) }; }); })
        .then(function () { return add.length ? T.saveShow(add.length + ' new sign-up' + (add.length === 1 ? '' : 's')) : null; })
        .then(function () { return Store.clearNotes(T.proof, mine.map(function (n) { return n._id; })); })
        .then(function () { return add.length; });
    }).catch(function () { return 0; });
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.volunteers = function () {
    T.setBar('Volunteers and donations', '#/teacher');
    var contacts = {};
    function draw() {
      var b = B();
      var famName = function (id) { var a = (T.show.cast || []).find(function (x) { return x.id === id; }); return a ? a.name : ''; };
      var person = function (s) { var c = contacts[s.id]; return '<b>' + esc(c ? c.name : s.who) + '</b>' + (s.fam && famName(s.fam) ? ' <span class="muted small">(' + esc(famName(s.fam)) + '’s family)</span>' : '') + (c && c.contact ? ' · <span class="small">' + esc(c.contact) + '</span>' : ''); };
      var signRow = function (s, funds) {
        return '<div class="switch" style="flex-wrap:wrap"><span class="grow">' + person(s) + (s.qty ? ' · ' + esc(funds ? money(s.qty) : s.qty) : '') + (s.note ? '<br><span class="muted small">' + esc(s.note) + '</span>' : '') + '</span>' +
          '<div class="seg" data-s="' + esc(s.id) + '">' + [['', 'Signed up'], ['got', funds ? 'Received' : 'Done'], ['thanked', 'Thanked']].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + ((s.done || '') === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
      };
      var offers = b.signups.filter(function (s) { return !s.post; });
      app.innerHTML = '<div class="card noprint"><h2>' + sym('🤝') + 'What the show needs</h2><p class="muted small">Families see these in the parent version of the app (Volunteer and donate) and sign up. Their full names and contacts are only here, locked with the teacher password; everyone else sees a first name and last initial. The app never takes payments.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><label class="f" style="margin:0">Kind<select id="nk">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label>' +
        '<label class="f grow" style="margin:0">What we need<input id="nt" maxlength="120" placeholder="e.g. Sewing help for costume hems"></label></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px"><label class="f grow" style="margin:0">Details (optional)<input id="nd" maxlength="300" placeholder="When, where, sizes, what kind"></label>' +
        '<label class="f" style="margin:0;width:150px"><span id="nql">How many</span><input id="nq" inputmode="decimal" placeholder="any"></label><label class="f" style="margin:0">Date (optional)<input id="nw" type="date"></label>' +
        '<button class="btn primary" id="nadd" data-save>Post it</button></div>' +
        '<label class="f" style="margin-top:12px">How families give money (shown with every Funds need)<input id="ng" maxlength="300" value="' + esc(b.give || '') + '" placeholder="e.g. Checks to LTHS Theatre Boosters, given to Ms. Elyse"></label>' +
        '<div class="row end"><button class="btn" onclick="print()">' + icon('print') + 'Print</button></div><p id="nst" class="muted small" role="status"></p></div>' +
        KINDS.map(function (k) {
          var l = b.posts.filter(function (p) { return p.kind === k[0]; }); if (!l.length) return '';
          return '<h3>' + sym(k[1]) + k[2] + '</h3>' + l.map(function (p) {
            var ss = b.signups.filter(function (s) { return s.post === p.id; });
            return '<div class="card" style="margin-bottom:10px' + (p.closed ? ';opacity:.6' : '') + '"><div class="row" style="flex-wrap:wrap"><div class="grow"><b>' + esc(p.title) + '</b>' + (p.when ? ' <span class="tag">' + esc(whenText(p)) + '</span>' : '') + (p.closed ? ' <span class="tag">closed</span>' : '') +
              (p.detail ? '<br><span class="small">' + esc(p.detail) + '</span>' : '') + '<br><span class="muted small">' + esc(needText(p)) + '</span></div>' +
              '<div class="noprint"><button class="btn small" data-close="' + esc(p.id) + '" data-save>' + (p.closed ? 'Open again' : 'Close') + '</button> <button class="btn small" data-del="' + esc(p.id) + '" data-save>Delete</button></div></div>' +
              (ss.length ? ss.map(function (s) { return signRow(s, p.kind === 'funds'); }).join('') : '<p class="muted small">No sign-ups yet.</p>') + '</div>';
          }).join('');
        }).join('') +
        (offers.length ? '<h3>' + sym('💡') + 'Offers not on the list</h3><div class="card">' + offers.map(function (s) { return '<div class="small muted">' + esc(kindOf(s.offer && s.offer.kind)[1] + ' ' + (s.offer ? s.offer.title : '')) + '</div>' + signRow(s, s.offer && s.offer.kind === 'funds'); }).join('') + '</div>' : '') +
        (b.posts.length ? '' : '<p class="card muted">Nothing posted yet. Post the first need above.</p>');
      var kindSel = document.getElementById('nk');
      kindSel.onchange = function () { document.getElementById('nql').textContent = kindSel.value === 'funds' ? 'Goal $' : 'How many'; };
      document.getElementById('nadd').onclick = function () {
        var t = document.getElementById('nt').value.trim(); if (!t) { document.getElementById('nst').textContent = 'Type what you need first.'; return; }
        B().posts.push({ id: uid('n'), kind: kindSel.value, title: t.slice(0, 120), detail: document.getElementById('nd').value.trim().slice(0, 300),
          need: Math.max(0, +document.getElementById('nq').value.replace(/[^\d.]/g, '') || 0), when: document.getElementById('nw').value || '', closed: false });
        T.saveShow('Posted').then(draw);
      };
      document.getElementById('ng').onchange = function () { B().give = this.value.trim().slice(0, 300); T.saveShow('Saved'); };
      app.querySelectorAll('[data-close]').forEach(function (bt) { bt.onclick = function () { var p = B().posts.find(function (x) { return x.id === bt.dataset.close; }); p.closed = !p.closed; T.saveShow(p.closed ? 'Closed' : 'Open again').then(draw); }; });
      app.querySelectorAll('[data-del]').forEach(function (bt) { bt.onclick = function () {
        var b2 = B(), n = b2.signups.filter(function (s) { return s.post === bt.dataset.del; }).length;
        if (!confirm(n ? 'Delete this need? Its ' + n + ' sign-up' + (n === 1 ? '' : 's') + ' will move to “Offers not on the list.”' : 'Delete this need?')) return;
        var p = b2.posts.find(function (x) { return x.id === bt.dataset.del; });
        b2.signups.forEach(function (s) { if (s.post === p.id) { s.post = ''; s.offer = { kind: p.kind, title: p.title }; } });
        b2.posts = b2.posts.filter(function (x) { return x !== p; }); T.saveShow('Deleted').then(draw);
      }; });
      app.querySelectorAll('.seg[data-s] button').forEach(function (bt) { bt.onclick = function () { var s = B().signups.find(function (x) { return x.id === bt.parentNode.dataset.s; }); s.done = bt.dataset.v; T.saveShow('Saved').then(draw); }; });
    }
    draw();
    var open = function () { return T.openVault ? T.openVault().then(function (V) { contacts = (V.extra && V.extra.help) || {}; }) : Promise.resolve(); };
    open().then(draw).then(pullSignups).then(function (n) { if (n) return open().then(draw); });
  };
})();
