/* asl.cool/theatre Shopping: one list for the whole show (Colleen, 2026-10-21: a field trip to Goodwill, maybe two, each teacher with half the class,
   "to shop for costumes and props for the whole show, not just themselves").
   The list is built from the costumes (every piece, for every student who wears it, with their sizes) and the props (outline.props, or the teacher's own).
   Shopping in the community with a real list is community-based instruction, an evidence-based practice for students with disabilities.
   T.show.shop = { status { itemKey: { s: have|bought|skip, price, by, at } }, showSizes, budget }; T.show.props replaces outline.props once edited.
   On the trip, students tap Found it!; the note waits on the iPad until there is Wi-Fi (Store.queueNote), then Teacher mode takes it in.
   Added things (Colleen 2026-10-24: "when a teacher or mentor thinks of something we need to purchase, they can add it"; and one prop they plan to build
   with the materials to buy for it): T.show.shop.extra [{ id, name, qty, kind, note, build, by, mentor, at }] and T.show.shop.builds [{ id, name, who, note, by, mentor, at }].
   A teacher adds them on Production › Shopping; a Company Mentor adds them from the Shopping list page and they arrive as a note (type shopAdd).
   Homework (Colleen 2026-10-24: before the shopping day "each student compiling a list for their character of props and costumes they're looking for and an
   approximate budget"): every Company member builds a list for each of their characters on this iPad (ls shopHw), each thing with a guessed price and a total,
   and sends it (note type shopList). It joins the teacher's list as extra items with who (the character), est (the guess) and hw (actor|character).
   Photos (Colleen 2026-10-24): within 5 school days after the trip, Company members photograph each finished costume look and prop (a 📸 group in a day's
   plan, by rotation). Sealed with the show key (Store.putPhoto); each waits for the teacher's OK, then shows on My Costumes, the Costumes page, the shopping
   list and the Costume photos page, a reference for the costume crew, the cast and the Mentors. Production › Shopping shows who is still missing photos.
   Costume research (Colleen 2026-10-24: "doing research and bringing pictures of outfits they think their character would wear, not just pics of their character
   in the movie"): before the trip, 3 to 5 outfit pictures per character, each with one short reason (tap a reason, or type one), the same sealed photos with
   kind research (ref = the character). The teacher's choice board (kind board) gives outfit pictures to pick from for students who find research hard. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var STATUS = [['', 'Need'], ['have', 'Have it'], ['bought', 'Bought'], ['skip', 'Skip']];
  function S() { var s = T.show.shop = T.show.shop || {}; s.status = s.status || {}; return s; }
  function props() { return T.show.props || T.O().props || []; }
  function people(charId) { return (T.show.cast || []).filter(function (a) { return (a.chars || []).indexOf(charId) >= 0; }); }
  function money(n) { return '$' + (+n || 0).toFixed(2); }
  var KINDS = [['costume', '👕', 'Costumes'], ['prop', '🎒', 'Props'], ['set', '🎨', 'Set and paint'], ['makeup', '💄', 'Makeup and hair'], ['supply', '🧰', 'Supplies'], ['other', '🛒', 'Other']];
  function kindOf(k) { return KINDS.find(function (x) { return x[0] === k; }) || KINDS[5]; }
  function extra() { var s = S(); return (s.extra = s.extra || []); }
  function builds() { var s = S(); return (s.builds = s.builds || []); }
  function buildById(id) { return builds().find(function (b) { return b.id === id; }); }
  function actorById(id) { return (T.show.cast || []).find(function (a) { return a.id === id; }); }
  function nid(p) { return p + Math.random().toString(36).slice(2, 9); }
  function clean(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); }
  function byLabel(o) {
    if (!o.by && !o.mentor) return 'added by a teacher';
    var a = o.by && actorById(o.by);
    return 'added by ' + (a ? esc(T.shortName(a.name)) + (o.mentor ? ' (Mentor)' : '') : 'a Mentor');
  }
  /* one material on each line, kept as typed ("2 cans of red spray paint" reads better than "cans of red spray paint × 2") */
  function parseMaterials(text) {
    return String(text || '').split(/\n/).map(function (l) { return clean(l.replace(/^[\s•\-*]+/, ''), 100); }).filter(Boolean).slice(0, 30).map(function (l) { return { qty: 1, name: l }; });
  }
  /* add one thing or one build (with its materials) to the show; o = { cid, item: {name, qty, kind, note} } or { cid, build: {name, who, note}, materials: [{name, qty}] } */
  function addThing(o, meta) {
    var at = meta.at || Date.now(), by = meta.by || '', mentor = !!meta.mentor;
    var id = /^[a-z0-9-]{4,24}$/.test(o.cid || '') ? o.cid : nid('x-');
    if (extra().some(function (e) { return e.id === id; }) || builds().some(function (b) { return b.id === id; })) return false;
    if (o.build) {
      var name = clean(o.build.name, 100); if (!name) return false;
      var who = T.charById(o.build.who) ? o.build.who : '';
      builds().push({ id: id, name: name, who: who, note: clean(o.build.note, 200), by: by, mentor: mentor, at: at });
      (o.materials || []).slice(0, 30).forEach(function (m, i) { var n = clean(m && m.name, 100); if (n) extra().push({ id: id + '-' + i, name: n, qty: Math.min(999, Math.max(1, +m.qty || 1)), kind: 'prop', note: '', build: id, by: by, mentor: mentor, at: at }); });
      return true;
    }
    var it = o.item || {}, nm = clean(it.name, 100); if (!nm) return false;
    extra().push({ id: id, name: nm, qty: Math.min(999, Math.max(1, +it.qty || 1)), kind: kindOf(it.kind)[0], note: clean(it.note, 200), build: '', by: by, mentor: mentor, at: at });
    return true;
  }
  /* a Company Mentor: the Mentor password, or a cast member marked Mentor */
  /* a Company member who can make the homework list (not a parent) */
  function canList() { return !!(T.me && T.me.id && T.me.chars.length && !(T.pass && T.pass.who === 'parent')); }
  T.shopTile = function () { return T.shopCanAdd() ? 'Add what we need to buy' : canList() ? 'My list for the shopping day' : ''; };
  T.shopCanAdd = function () { return !!((T.pass && T.pass.who === 'helper') || (!T.pass && T.me && (actorById(T.me.id) || {}).company === 'mentor')); };
  /* every item to find: { key, kind, name, who (char), for (actor), sizes, qty, costume } */
  function items() {
    var out = [];
    (T.O().costumes || []).forEach(function (c) {
      var ppl = people(c.who), list = ppl.length ? ppl : [null];
      c.items.forEach(function (it, i) {
        list.forEach(function (a) { out.push({ key: 'c|' + c.id + '|' + i + '|' + (a ? a.id : '-'), kind: 'costume', name: it, costume: c.name, cid: c.id, who: c.who, actor: a, qty: 1, group: '1|' + c.who }); });
      });
    });
    props().forEach(function (p) { out.push({ key: 'p|' + p.id, kind: 'prop', name: p.name, who: p.who, qty: p.qty || 1, prop: p, group: '2|' + p.who }); });
    extra().forEach(function (e) {
      var b = e.build && buildById(e.build); if (e.build && !b) return;
      out.push({ key: 'x|' + e.id, kind: b ? 'build' : e.kind, name: e.name, who: b ? b.who : (e.who || ''), qty: e.qty || 1, extra: e, build: b, group: b ? '3|' + b.id : e.hw ? '5|' + e.who : '4|' + kindOf(e.kind)[0] });
    });
    return out;
  }
  /* the small grey line under a thing on the list */
  function subLine(it, teacher) {
    if (it.kind === 'costume') return esc(it.costume) + ' · ' + (it.actor ? esc(it.actor.name) + (it.actor.sizes && (teacher || S().showSizes) ? ' (' + esc(it.actor.sizes) + ')' : '') : 'not cast yet');
    if (it.build) return teacher ? '' : 'for the build: ' + esc(it.build.name);      // the teacher sees it inside the build's own card
    if (it.extra && it.extra.hw) { var a = actorById(it.extra.by); return esc(kindOf(it.extra.kind)[2].replace(/s$/, '')) + (it.extra.est ? ' · about ' + money(it.extra.est) : '') + (teacher && a ? ' · ' + esc(T.shortName(a.name)) + '’s list' : ''); }
    if (it.extra) return esc(kindOf(it.extra.kind)[2]) + (it.extra.note ? ' · ' + esc(it.extra.note) : '') + (teacher ? ' · ' + byLabel(it.extra) : '');
    return '';
  }
  function state(it) { var st = S().status[it.key] || {}; var pend = (T.ls('shopFound') || {})[it.key]; return { s: st.s || (pend ? 'bought' : ''), price: st.price || (pend && pend.price) || '', pending: !st.s && !!pend }; }

  T.noteHandlers = T.noteHandlers || {};
  T.noteHandlers.shop = function (n) {
    if (typeof n.key !== 'string' || n.key.length > 120) return false;
    var cur = S().status[n.key]; if (cur && cur.s === 'bought') return false;
    S().status[n.key] = { s: 'bought', price: String(n.price || '').replace(/[^\d.]/g, '').slice(0, 8), by: n.actor, at: n._at };
    return true;
  };
  T.noteHandlers.shopList = function (n) {      // a Company member's homework list for one character; sending again replaces it
    var a = n && actorById(n.actor);
    if (!a || !T.charById(n.char) || !Array.isArray(n.items)) return false;
    var hw = a.id + '|' + n.char, s = S(), keep = [];
    s.extra = extra().filter(function (e) {
      if (e.hw !== hw) return true;
      if (s.status['x|' + e.id]) { keep.push(e.name.toLowerCase()); return true; }      // already marked found / have / skip: stays
      return false;
    });
    n.items.slice(0, 40).forEach(function (r) {
      var nm = clean(r && r.name, 100); if (!nm || keep.indexOf(nm.toLowerCase()) >= 0) return;
      extra().push({ id: nid('h-'), name: nm, qty: 1, kind: r.kind === 'prop' ? 'prop' : 'costume', note: '', est: String(r.price || '').replace(/[^\d.]/g, '').slice(0, 8), build: '', who: n.char, hw: hw, by: a.id, mentor: false, at: n._at });
    });
    return true;
  };
  T.noteHandlers.shopAdd = function (n) {      // a Mentor added something to buy, or a build
    if (!n || (!n.item && !n.build)) return false;
    if (n.actor && !actorById(n.actor)) return false;
    return addThing(n, { by: n.actor || '', mentor: true, at: n._at });
  };

  /* the two forms, for teachers and Mentors (ids start with p, so one page can hold one set) */
  function addForms() {
    return '<div class="card noprint"><h3>' + sym('🛒') + 'Add something we need to buy</h3><div class="row" style="flex-wrap:wrap">' +
      '<label class="f grow" style="margin:0">What<input id="xn" maxlength="100" placeholder="e.g. Red basketball jerseys"></label>' +
      '<label class="f" style="margin:0;width:90px">How many<input id="xq" inputmode="numeric" value="1"></label>' +
      '<label class="f" style="margin:0">Kind<select id="xk">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + ' ' + k[2] + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="f">Note: size, color, where to look (you can skip this)<input id="xo" maxlength="200"></label>' +
      '<button class="btn primary" id="xadd" data-save>Add to the list</button></div>' +
      '<div class="card noprint"><h3>' + sym('🔨') + 'Plan a build</h3><p class="muted small">One thing the crew will make, and the materials to buy for it.</p><div class="row" style="flex-wrap:wrap">' +
      '<label class="f grow" style="margin:0">What we will build<input id="bn" maxlength="100" placeholder="e.g. The Science Fair volcano"></label>' +
      '<label class="f" style="margin:0">For<select id="bw"><option value="">The whole show</option>' + T.O().characters.map(function (c) { return '<option value="' + c.id + '">' + esc(c.short) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="f">Materials to buy, one on each line<textarea id="bm" rows="5" placeholder="2 cans of red spray paint&#10;Pool noodles&#10;1 roll of duct tape"></textarea></label>' +
      '<label class="f">Note (you can skip this)<input id="bo" maxlength="200"></label>' +
      '<button class="btn primary" id="badd" data-save>Add the build</button></div>';
  }
  /* read a form; done(o) gets { item } or { build, materials }, then the form is emptied */
  function wireForms(done) {
    var v = function (id) { return document.getElementById(id).value; };
    document.getElementById('xadd').onclick = function () {
      var n = clean(v('xn'), 100); if (!n) { T.toast('Type what we need first.'); return; }
      done({ cid: nid('x-'), item: { name: n, qty: Math.max(1, +v('xq') || 1), kind: v('xk'), note: clean(v('xo'), 200) } });
    };
    document.getElementById('badd').onclick = function () {
      var n = clean(v('bn'), 100); if (!n) { T.toast('Type what you will build first.'); return; }
      done({ cid: nid('b-'), build: { name: n, who: v('bw'), note: clean(v('bo'), 200) }, materials: parseMaterials(v('bm')) });
    };
  }

  /* ---------- Teacher: Production › Shopping ---------- */
  var filter = 'need';
  T.shopView = function () {
    var s = S(), all = items(), need = all.filter(function (it) { return !state(it).s; }).length;
    var spent = all.reduce(function (t, it) { var st = state(it); return t + (st.s === 'bought' ? +st.price || 0 : 0); }, 0);
    var guess = all.reduce(function (t, it) { return t + (it.extra && it.extra.hw && !state(it).s ? +it.extra.est || 0 : 0); }, 0);
    var list = all.filter(function (it) { return filter === 'all' || !state(it).s; });
    var byWho = {}; builds().forEach(function (b) { byWho['3|' + b.id] = []; });      // every build gets a card, even with nothing to buy yet
    list.forEach(function (it) { (byWho[it.group] = byWho[it.group] || []).push(it); });
    return '<div class="card"><div class="row"><b class="grow">' + need + ' of ' + all.length + ' still to find · spent ' + money(spent) + (s.budget ? ' of ' + money(s.budget) : '') + (guess ? ' · students’ lists guess ' + money(guess) + ' more' : '') + '</b>' +
      '<label class="f" style="margin:0">Budget $<input id="bud" inputmode="decimal" value="' + esc(s.budget || '') + '" style="width:110px;display:inline-block"></label><button class="btn small" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<label class="switch"><span>Show sizes on the Company members’ list</span><input type="checkbox" id="ssz"' + (s.showSizes ? ' checked' : '') + '></label>' +
      '<div class="seg noprint"><button data-f="need" aria-pressed="' + (filter === 'need') + '">Still to find</button><button data-f="all" aria-pressed="' + (filter === 'all') + '">Everything</button></div>' +
      '<p class="muted small">Field trips: in a day’s plan, add a 🚌 Field trip group. “Two trips: half the class each” sends each half on a different day. Company members open this list from Today.</p></div>' +
      Object.keys(byWho).sort().map(function (k) {
        var l = byWho[k], g = k.split('|'), head, foot = '';
        if (g[0] === '3') {
          var b = buildById(g[1]);
          head = sym('🔨') + 'Build: ' + esc(b.name) + (T.charById(b.who) ? ' · ' + T.chip(b.who) : '') + ' <button class="btn small noprint" data-delb="' + b.id + '" aria-label="Remove this build">✕</button>' +
            '<br><span class="muted small" style="font-weight:normal">' + (b.note ? esc(b.note) + ' · ' : '') + byLabel(b) + '</span>';
          foot = '<div class="row noprint" style="margin-top:8px"><input data-bmat="' + b.id + '" maxlength="100" placeholder="Add a material, e.g. 2 sheets of foam board" class="grow" style="min-height:44px;border:2px solid var(--line);border-radius:10px;padding:4px 8px;background:var(--card)"><button class="btn small" data-bmadd="' + b.id + '">Add</button></div>' +
            (l.length ? '' : '<p class="muted small">Nothing to buy for this build yet' + (filter === 'need' ? ', or it has all been found' : '') + '.</p>');
        } else if (g[0] === '4') { var kd = kindOf(g[1]); head = sym(kd[1]) + esc(kd[2]) + ' · added'; }
        else if (g[0] === '5') {
          var est = l.reduce(function (t, it) { return t + (+it.extra.est || 0); }, 0);
          head = sym('📝') + 'Homework list · ' + (T.charById(g[1]) ? T.chip(g[1]) : esc(g[1])) + (est ? ' <span class="muted small" style="font-weight:normal">about ' + money(est) + '</span>' : '');
        }
        else { var ch = T.charById(g[1]); head = (g[0] === '2' ? sym('🎒') + 'Props · ' : sym('👕') + 'Costumes · ') + (ch ? T.chip(g[1]) : esc(g[1])); }
        if (g[0] === '1') head += (T.O().costumes || []).filter(function (c) { return c.who === g[1]; }).map(function (c) { return T.photoSlot('costume', c.id); }).join('');
        if (g[0] === '3') head += T.photoSlot('build', g[1]);
        return '<div class="card"><h3>' + head + '</h3>' + l.map(function (it) {
          var st = state(it);
          return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(it.name) + '</b>' + (it.qty > 1 ? ' × ' + it.qty : '') +
            '<br><span class="muted small">' + subLine(it, true) + (st.pending ? ' · found on a trip' : '') + '</span>' + (it.prop ? T.photoSlot('prop', it.prop.id) : '') + '</span>' +
            '<div class="seg" data-k="' + esc(it.key) + '">' + STATUS.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (st.s === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
            '<input data-price="' + esc(it.key) + '" inputmode="decimal" placeholder="$" value="' + esc(st.price) + '" style="width:80px;min-height:44px;border:2px solid var(--line);border-radius:10px;padding:4px 8px;background:var(--card)">' +
            (it.extra ? '<button class="btn small noprint" data-delx="' + it.extra.id + '" aria-label="Remove ' + esc(it.name) + '">✕</button>' : '') + '</div>';
        }).join('') + foot + '</div>';
      }).join('') + '<div class="card noprint" id="phAdmin"><h3>' + sym('📸') + 'Costume and prop photos</h3><p class="muted">Loading…</p></div>' + addForms() +
      '<div class="card noprint"><h3>Add a prop</h3><div class="row"><label class="f grow" style="margin:0">What<input id="pn" placeholder="e.g. Lab beakers"></label><label class="f" style="margin:0">For<select id="pw">' +
      T.O().characters.map(function (c) { return '<option value="' + c.id + '">' + esc(c.short) + '</option>'; }).join('') + '</select></label><label class="f" style="margin:0;width:90px">How many<input id="pq" inputmode="numeric" value="1"></label><button class="btn primary" id="padd" data-save>Add</button></div>' +
      '<p class="muted small">To remove a starter prop, mark it Skip.</p></div>';
  };
  T.wireShop = function (redraw) {
    var s = S();
    var set = function (key, patch) { var cur = s.status[key] || {}; Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; }); if (!cur.s && !cur.price) delete s.status[key]; else s.status[key] = cur; };
    app.querySelectorAll('.seg[data-k] button').forEach(function (b) { b.onclick = function () { set(b.parentNode.dataset.k, { s: b.dataset.v }); T.saveShow('Saved').then(redraw); }; });
    app.querySelectorAll('[data-price]').forEach(function (inp) { inp.onchange = function () { set(inp.dataset.price, { price: inp.value.replace(/[^\d.]/g, '') }); T.saveShow('Saved'); }; });
    app.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { filter = b.dataset.f; redraw(); }; });
    document.getElementById('bud').onchange = function (e) { s.budget = e.target.value.replace(/[^\d.]/g, ''); T.saveShow('Budget saved').then(redraw); };
    document.getElementById('ssz').onchange = function (e) { s.showSizes = e.target.checked; T.saveShow('Saved'); };
    T.fillPhotos(app, true); photoAdmin(redraw);
    wireForms(function (o) { if (addThing(o, {})) T.saveShow(o.build ? 'Build added' : 'Added to the list').then(redraw); });
    var dropStatus = function (id) { delete s.status['x|' + id]; };
    app.querySelectorAll('[data-delx]').forEach(function (b) { b.onclick = function () {
      var id = b.dataset.delx; s.extra = extra().filter(function (e) { return e.id !== id; }); dropStatus(id); T.saveShow('Removed').then(redraw);
    }; });
    app.querySelectorAll('[data-delb]').forEach(function (b) { b.onclick = function () {
      var id = b.dataset.delb, bd = buildById(id), n = extra().filter(function (e) { return e.build === id; }).length;
      if (!confirm('Remove the build “' + bd.name + '”' + (n ? ' and its ' + n + ' material' + (n === 1 ? '' : 's') : '') + '?')) return;
      s.builds = builds().filter(function (x) { return x.id !== id; });
      s.extra = extra().filter(function (e) { if (e.build === id) { dropStatus(e.id); return false; } return true; });
      T.saveShow('Build removed').then(redraw);
    }; });
    app.querySelectorAll('[data-bmadd]').forEach(function (b) { b.onclick = function () {
      var id = b.dataset.bmadd, inp = app.querySelector('[data-bmat="' + id + '"]'), m = parseMaterials(inp.value)[0]; if (!m) return;
      extra().push({ id: id + '-' + Math.random().toString(36).slice(2, 6), name: m.name, qty: m.qty, kind: 'prop', note: '', build: id, by: '', mentor: false, at: Date.now() });
      T.saveShow('Material added').then(redraw);
    }; });
    document.getElementById('padd').onclick = function () {
      var n = document.getElementById('pn').value.trim(); if (!n) return;
      if (!T.show.props) T.show.props = JSON.parse(JSON.stringify(T.O().props || []));
      T.show.props.push({ id: 'p-' + Math.random().toString(36).slice(2, 8), name: n, who: document.getElementById('pw').value, qty: Math.max(1, +document.getElementById('pq').value || 1), scenes: [] });
      T.saveShow('Prop added').then(redraw);
    };
  };

  /* ---------- Students: the homework list for my character ---------- */
  function hwAll() { return T.ls('shopHw') || {}; }
  function hwMine() { var all = hwAll(); return all[T.me.id] || {}; }
  function hwSave(mine) { var all = hwAll(); all[T.me.id] = mine; T.ls('shopHw', all); }
  function hwTotal(rows) { return rows.reduce(function (t, r) { return t + (+r.price || 0); }, 0); }
  function homework() {
    var mine = hwMine();
    return T.me.chars.map(function (cid) {
      var d = mine[cid] || { rows: [] }, rows = d.rows.length ? d.rows : [{ name: '', kind: 'costume', price: '' }];
      return '<div class="card" data-hw="' + cid + '"><h2>' + sym('📝') + 'My list for ' + T.chip(cid) + '</h2>' +
        '<p>Homework before the shopping day: the costume pieces and props your character needs. Guess about what each one costs.</p>' +
        T.photoSlot('research', cid, 'My costume research pictures (look at them while you make the list):') +
        rows.map(function (r, i) {
          return '<div class="row" style="flex-wrap:wrap;margin-bottom:8px" data-i="' + i + '">' +
            '<input data-hn maxlength="100" class="grow" placeholder="e.g. Red basketball jersey" value="' + esc(r.name) + '" style="min-height:48px;min-width:180px;border:2px solid var(--line);border-radius:10px;padding:4px 10px;background:var(--card)">' +
            '<div class="seg" data-hk>' + [['costume', '👕 Costume'], ['prop', '🎒 Prop']].map(function (k) { return '<button type="button" data-v="' + k[0] + '" aria-pressed="' + ((r.kind || 'costume') === k[0]) + '">' + k[1] + '</button>'; }).join('') + '</div>' +
            '<label class="small">about $<input data-hp inputmode="decimal" placeholder="0" value="' + esc(r.price) + '" style="width:80px;min-height:48px;border:2px solid var(--line);border-radius:10px;padding:4px 8px;background:var(--card)"></label>' +
            '<button class="btn small" data-hx aria-label="Take this off my list">✕</button></div>';
        }).join('') +
        '<div class="row" style="flex-wrap:wrap"><button class="btn" data-hadd>＋ Add a thing</button><button class="btn" data-hfill>Fill in from the show’s lists</button>' +
        '<b class="grow" style="text-align:right">Total: about <span data-htot>' + money(hwTotal(rows)) + '</span></b></div>' +
        '<div class="row end" style="margin-top:10px"><span class="muted small grow">' + (d.sent ? 'Sent ' + new Date(d.sent).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '. Change it and send it again any time.' : 'Not sent yet.') + '</span>' +
        '<button class="btn primary" data-hsend>Send to my teacher</button></div></div>';
    }).join('');
  }
  function wireHomework() {
    app.querySelectorAll('[data-hw]').forEach(function (card) {
      var cid = card.dataset.hw;
      var read = function () {
        return Array.prototype.map.call(card.querySelectorAll('[data-i]'), function (row) {
          var on = row.querySelector('[data-hk] [aria-pressed="true"]');
          return { name: row.querySelector('[data-hn]').value, kind: on ? on.dataset.v : 'costume', price: row.querySelector('[data-hp]').value.replace(/[^\d.]/g, '') };
        });
      };
      var keep = function (rows, redraw) { var m = hwMine(); m[cid] = { rows: rows, sent: (m[cid] || {}).sent || 0 }; hwSave(m); if (redraw) T.studentPages.shop(); else card.querySelector('[data-htot]').textContent = money(hwTotal(rows)); };
      card.querySelectorAll('[data-hn],[data-hp]').forEach(function (inp) { inp.oninput = function () { keep(read()); }; });
      card.querySelectorAll('[data-hk] button').forEach(function (b) { b.onclick = function () { b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); keep(read()); }; });
      card.querySelectorAll('[data-hx]').forEach(function (b) { b.onclick = function () { var rows = read(); rows.splice(+b.closest('[data-i]').dataset.i, 1); keep(rows, true); }; });
      card.querySelector('[data-hadd]').onclick = function () { var rows = read(); rows.push({ name: '', kind: 'costume', price: '' }); keep(rows, true); };
      card.querySelector('[data-hfill]').onclick = function () {      // the show's costume plot and props for this character, minus what is already on the list
        var rows = read().filter(function (r) { return r.name.trim(); }), have = rows.map(function (r) { return r.name.trim().toLowerCase(); }), n = 0;
        var add = function (name, kind) { if (have.indexOf(name.toLowerCase()) < 0) { have.push(name.toLowerCase()); rows.push({ name: name, kind: kind, price: '' }); n++; } };
        (T.O().costumes || []).forEach(function (c) { if (c.who === cid) c.items.forEach(function (x) { add(x, 'costume'); }); });
        props().forEach(function (p) { if (p.who === cid) add(p.name, 'prop'); });
        keep(rows, true); T.toast(n ? 'Added ' + n + ' from the show’s lists. Take off what you already have at home.' : 'Everything from the show’s lists is already here.');
      };
      card.querySelector('[data-hsend]').onclick = function () {
        var rows = read().filter(function (r) { return r.name.trim(); });
        if (!rows.length) { T.toast('Add at least one thing first.'); return; }
        Store.queueNote(T.key, { type: 'shopList', actor: T.me.id, char: cid, items: rows }).catch(function () {});
        var m = hwMine(); m[cid] = { rows: rows, sent: Date.now() }; hwSave(m);
        T.toast('Sent to your teacher'); T.studentPages.shop();
      };
    });
  }

  /* ---------- Students: the shopping list on a field trip ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.shop = function () {
    T.setBar('Shopping list', '#/today');
    var s = S(), found = T.ls('shopFound') || {}, all = items().filter(function (it) { var st = state(it); return st.s !== 'have' && st.s !== 'skip'; });
    var mine = function (it) { return T.me && T.me.chars.indexOf(it.who) >= 0; };
    all.sort(function (a, b) { return (state(a).s ? 1 : 0) - (state(b).s ? 1 : 0) || (mine(b) ? 1 : 0) - (mine(a) ? 1 : 0) || a.kind.localeCompare(b.kind); });
    var left = all.filter(function (it) { return !state(it).s; }).length;
    var canAdd = T.shopCanAdd(), sent = (T.ls('shopSent') || []).filter(function (x) { return !extra().some(function (e) { return e.id === x.cid || e.build === x.cid; }) && !buildById(x.cid); });
    T.ls('shopSent', sent);      // forget the ones the teacher has taken in
    app.innerHTML = (canList() ? homework() : '') + (canAdd ? '<div class="card"><h2>' + sym('🛒') + 'Thought of something we need?</h2><p>Add it here. Your teacher sees it the next time they open the shopping list.</p>' +
      (sent.length ? '<p class="small"><b>Sent, waiting for your teacher:</b> ' + sent.map(function (x) { return esc(x.name); }).join(', ') + '</p>' : '') + '</div>' + addForms() : '') +
      '<div class="card"><h2>' + sym('🚌') + 'Our field trip</h2><ol class="big" style="font-size:1.05em;line-height:1.7">' +
      '<li>Ride with your group and your teacher.</li><li>Stay with your buddy in the store.</li><li>Look for things on this list. It is for <b>the whole show</b>, not only you.</li>' +
      '<li>Found one? Show your teacher, then tap <b>Found it!</b></li><li>Your teacher pays. Then we ride back to school.</li></ol>' +
      '<p class="muted small">No Wi-Fi in the store is OK: what you find is saved on this device and sent when you are back at school.</p></div>' +
      '<h3>' + left + ' things still to find</h3>' + all.map(function (it) {
        var st = state(it), ch = T.charById(it.who);
        return '<div class="card row" style="margin-bottom:10px;' + (st.s ? 'opacity:.55' : '') + '"><div class="grow"><b style="font-size:1.1em">' + esc(it.name) + '</b>' + (it.qty > 1 ? ' × ' + it.qty : '') +
          '<br><span class="small">' + (ch ? T.chip(it.who) : '') + (it.kind === 'costume' && it.actor ? ' for ' + esc(it.actor.name) + (s.showSizes && it.actor.sizes ? ' · <b>' + esc(it.actor.sizes) + '</b>' : '') : '') + (it.kind === 'prop' && !it.extra ? ' prop' : '') + (it.extra ? ' ' + subLine(it, false) : '') + '</span>' + (it.prop ? T.photoSlot('prop', it.prop.id) : it.cid ? T.photoSlot('costume', it.cid) : '') + '</div>' +
          (st.s ? '<span class="tag">' + (st.pending ? 'Found! (will send)' : 'Found') + '</span>' : '<button class="btn primary" data-found="' + esc(it.key) + '">✓ Found it!</button>') + '</div>';
      }).join('');
    if (canList()) wireHomework();
    T.fillPhotos(app);
    if (canAdd) wireForms(function (o) {
      var helperPass = T.pass && T.pass.who === 'helper';
      o.type = 'shopAdd'; o.actor = helperPass ? '' : T.me.id; o.mentor = true;
      var l = T.ls('shopSent') || []; l.push({ cid: o.cid, name: (o.build || o.item).name }); T.ls('shopSent', l.slice(-50));
      Store.queueNote(T.key, o).catch(function () {});
      T.toast('Sent to your teacher'); T.studentPages.shop();
    });
    app.querySelectorAll('[data-found]').forEach(function (b) {
      b.onclick = function () {
        var key = b.dataset.found, box = document.createElement('dialog');
        box.innerHTML = '<h2>' + sym('🎉') + 'You found it!</h2><label class="f">Price (you can skip this)<input id="pr" inputmode="decimal" placeholder="$"></label><div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Save</button></div>';
        document.body.appendChild(box); box.showModal();
        var close = function () { box.close(); box.remove(); };
        box.querySelector('#cn').onclick = close;
        box.querySelector('#ok').onclick = function () {
          var price = box.querySelector('#pr').value.replace(/[^\d.]/g, '');
          found[key] = { price: price }; T.ls('shopFound', found);
          Store.queueNote(T.key, { type: 'shop', key: key, price: price, actor: T.me && T.me.id }).catch(function () {});
          close(); T.toast('Nice find!'); T.studentPages.shop();
        };
      };
    });
  };
  /* ---------- Costume and prop photos ---------- */
  var PH = { list: null, at: 0 };
  function photoList(force) {
    if (PH.list && !force && Date.now() - PH.at < 60000) return Promise.resolve(PH.list);
    return Store.photoIndex().then(function (l) { PH.list = l; PH.at = Date.now(); return l; }, function () { return PH.list || []; });
  }
  function sentHere() { return T.ls('photoSent') || []; }      // photos this iPad sent: shown here while they wait for the teacher
  function okImg(o) { return o && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(o.img || ''); }
  T.photoSlot = function (kind, ref, label, del) { return '<div class="photo-slot" data-pk="' + kind + '" data-pr="' + esc(ref) + '"' + (label ? ' data-label="' + esc(label) + '"' : '') + (del ? ' data-del="1"' : '') + ' style="display:flex;flex-wrap:wrap;gap:8px"></div>'; };
  /* fill every photo spot on the page; teacher: waiting photos too */
  T.fillPhotos = function (root, teacher) {
    var slots = (root || app).querySelectorAll('.photo-slot'); if (!slots.length || !T.key || !window.Store) return;
    photoList().then(function (l) {
      var mine = sentHere();
      slots.forEach(function (sl) {
        var ps = l.filter(function (p) { return p.kind === sl.dataset.pk && p.ref === sl.dataset.pr && (!sl.dataset.only || p.id === sl.dataset.only) && (p.ok || teacher || mine.indexOf(p.id) >= 0); });
        if (!ps.length) return;
        sl.style.margin = '8px 0';
        sl.innerHTML = (sl.dataset.label ? '<p class="muted small" style="width:100%;margin:0">' + esc(sl.dataset.label) + '</p>' : '') + ps.map(function (p) { return '<figure data-ph="' + p.id + '" style="margin:0;width:120px"><div style="width:120px;height:120px;border-radius:10px;background:var(--line);overflow:hidden"></div>' + (p.ok ? '' : '<span class="tag small">' + (teacher ? 'Waiting for your OK' : 'Waiting for the teacher') + '</span>') + (teacher && sl.dataset.del ? '<button class="btn small" data-rm="' + p.id + '">✕ Remove</button>' : '') + '</figure>'; }).join('');
        sl.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { if (!confirm('Remove this picture?')) return; Store.photoDel(T.proof, b.dataset.rm).then(function () { PH.list = null; b.closest('figure').remove(); T.toast('Removed'); }, function (e) { T.toast(e.message); }); }; });
        ps.forEach(function (p) {
          Store.getPhoto(T.key, p.id).then(function (o) {
            var f = sl.querySelector('[data-ph="' + p.id + '"]'); if (!f || !okImg(o)) return;
            f.firstChild.innerHTML = '<img src="' + o.img + '" alt="' + esc(o.caption || 'Costume photo') + '" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">';
            if (o.caption) f.insertAdjacentHTML('beforeend', '<figcaption class="small">' + esc(o.caption) + '</figcaption>');
            f.firstChild.onclick = function () { bigPhoto(o); };
          }).catch(function () {});
        });
      });
    });
  };
  function bigPhoto(o) {
    var box = document.createElement('dialog');
    box.innerHTML = '<img src="' + o.img + '" alt="" style="max-width:100%;max-height:70vh;border-radius:12px;display:block;margin:0 auto">' + (o.caption ? '<p>' + esc(o.caption) + '</p>' : '') + '<div class="row end"><button class="btn primary">Close</button></div>';
    document.body.appendChild(box); box.showModal();
    box.querySelector('button').onclick = function () { box.close(); box.remove(); };
  }
  /* make a photo smaller on the iPad before it is sealed and sent (about 1280 px, JPEG) */
  function shrink(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.82, d = c.toDataURL('image/jpeg', q);
        while (d.length > 800000 && q > 0.4) { q -= 0.12; d = c.toDataURL('image/jpeg', q); }
        ok(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('That photo could not be opened.')); };
      img.src = url;
    });
  }
  /* what each character needs photographed: every costume look, every prop and every build that is theirs */
  function photoTargets(cid) {
    var out = [];
    (T.O().costumes || []).forEach(function (c) { if (c.who === cid) out.push({ kind: 'costume', ref: c.id, name: c.name, sub: c.items.join(', ') }); });
    props().forEach(function (p) { if (p.who === cid) out.push({ kind: 'prop', ref: p.id, name: p.name, sub: 'Prop' }); });
    builds().forEach(function (b) { if (b.who === cid) out.push({ kind: 'build', ref: b.id, name: b.name, sub: 'Build' }); });
    return out;
  }
  /* the photo days: 5 school days after the (last) field trip */
  function photoDue() {
    if (!T.prod) return null;
    var days = T.prod.classDays(), trips = days.filter(function (d) { var r = T.prod.plan(d); return r && (r.groups || []).some(function (g) { return g.focus === 'trip'; }); });
    if (!trips.length) return null;
    var last = trips[trips.length - 1], i = days.indexOf(last);
    return { trip: last, due: days[Math.min(days.length - 1, i + 5)] };
  }
  function nice(d) { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
  T.photosTile = function () { return canList() ? 'Photos of the finished costumes and props' : (T.me ? 'See the costumes and props' : ''); };

  T.studentPages.photos = function (args) {
    T.setBar('Costume photos', '#/home');
    if (args && args[0] === 'research') return researchPage();
    var all = args && args[0] === 'all', due = photoDue(), teach = !!T.proof, take = (canList() && !all) || teach;      // a teacher can add a photo for any character (Colleen), OK'd at once
    var head = '<div class="card"><h2>' + sym('📸') + 'Costume and prop photos</h2><p>After the shopping trip, take a photo of each finished costume and prop. The costume crew, the cast and the Mentors use them to get everything right at every rehearsal.</p>' +
      (due ? '<p><b>Take them by ' + esc(nice(due.due)) + '</b> (5 school days after the trip).</p>' : '') +
      photoTabs(all ? 'all' : 'mine') + '</div>';
    var chars = all || (teach && !canList()) || !T.me ? T.O().characters.map(function (c) { return c.id; }) : T.me.chars;
    app.innerHTML = head + '<div id="phList"><p class="muted">Loading…</p></div>';
    photoList(true).then(function (l) {
      var ok = function (t) { return l.some(function (p) { return p.kind === t.kind && p.ref === t.ref && (p.ok || sentHere().indexOf(p.id) >= 0); }); };
      var html = chars.map(function (cid) {
        var ts = photoTargets(cid); if (all && !teach) ts = ts.filter(function (t) { return l.some(function (p) { return p.ok && p.kind === t.kind && p.ref === t.ref; }); });
        if (!ts.length) return '';
        return '<h3>' + T.chip(cid) + '</h3>' + ts.map(function (t) {
          return '<div class="card" style="margin-bottom:10px"><div class="row"><div class="grow"><b>' + sym(t.kind === 'costume' ? '👕' : t.kind === 'prop' ? '🎒' : '🔨') + esc(t.name) + '</b><br><span class="muted small">' + esc(t.sub) + '</span></div>' +
            (take ? (ok(t) ? '<span class="tag">📸 Done</span> ' : '') + '<label class="btn' + (ok(t) ? '' : ' primary') + '">' + icon('camera') + (ok(t) ? 'Add another' : 'Take a photo') + '<input type="file" accept="image/*" capture="environment" hidden data-take="' + t.kind + '|' + t.ref + '|' + cid + '|' + esc(t.name) + '"></label>' : '') + '</div>' +
            T.photoSlot(t.kind, t.ref) + '</div>';
        }).join('');
      }).join('');
      document.getElementById('phList').innerHTML = html || '<div class="card"><p class="muted">' + (all ? 'No photos yet.' : canList() ? 'Nothing to photograph for your character yet.' : 'Photos are taken after the shopping trip, once you have a role in the show.') + '</p></div>';
      T.fillPhotos(app);
      app.querySelectorAll('[data-take]').forEach(function (inp) {
        inp.onchange = function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          var bits = inp.dataset.take.split('|');
          shrink(f).then(function (img) {
            var box = document.createElement('dialog');
            box.innerHTML = '<h2>' + sym('📸') + esc(bits.slice(3).join('|')) + '</h2><img src="' + img + '" alt="" style="max-width:100%;max-height:45vh;border-radius:12px;display:block;margin:0 auto">' +
              '<label class="f">What is in the photo? (you can skip this)<input id="cap" maxlength="160" placeholder="e.g. The jersey, shorts and sneakers together"></label>' +
              '<div class="row end"><button class="btn" id="cn">Take it again</button><button class="btn primary" id="ok">Send it</button></div>';
            document.body.appendChild(box); box.showModal();
            var close = function () { box.close(); box.remove(); inp.value = ''; };
            box.querySelector('#cn').onclick = close;
            box.querySelector('#ok').onclick = function () {
              var b = box.querySelector('#ok'); b.disabled = true; b.textContent = 'Sending…';
              var id = 'ph-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              sendPhoto(bits[0], bits[1], bits[2], img, clean(box.querySelector('#cap').value, 160)).then(function () { close(); T.studentPages.photos(args); }, function (e) { b.disabled = false; b.textContent = 'Send it'; T.toast(e.message); });
            };
          }, function (e) { T.toast(e.message); inp.value = ''; });
        };
      });
    });
  };

  function photoTabs(on) {
    return '<div class="seg">' + [['research', '#/photos/research', '🔍 Costume research'], ['mine', '#/photos', canList() ? '📸 My photos to take' : '📸 My character'], ['all', '#/photos/all', 'All the photos']].map(function (t) {
      return '<a class="btn small" href="' + t[1] + '" aria-pressed="' + (on === t[0]) + '">' + t[2] + '</a>'; }).join('') + '</div>';
  }
  /* seal and send one picture; this iPad remembers it so it shows here while it waits for the teacher */
  function sendPhoto(kind, ref, char, img, caption) {
    var id = 'ph-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var teach = !!T.proof;
    return Store.putPhoto(T.key, { id: id, actor: teach ? 'teacher' : (T.me && T.me.id) || 'none', kind: kind, ref: ref, char: char }, { caption: caption, img: img }).then(function () { return teach ? Store.photoOk(T.proof, id) : null; }).then(function () {
      var m = sentHere(); m.push(id); T.ls('photoSent', m.slice(-200)); PH.list = null;
      T.toast(teach ? 'Photo added.' : 'Sent! Your teacher will check it.');
    }, function (e) { throw new Error(navigator.onLine ? e.message : 'No Wi-Fi. Try again when you are back on the school Wi-Fi.'); });
  }

  /* ---------- Students: costume research (before the shopping trip) ---------- */
  var REASONS = ['🎨 The colors fit my character', '🏫 My character would wear this at school', '✨ It shows who my character is', '👥 It matches my character’s group', '💃 I can move and dance in it', '🛒 We could find it at a store like Goodwill'];
  /* one short reason for a picture: tap one (non-writers, AAC users) or type one */
  function reasonDialog(img, title, done) {
    var box = document.createElement('dialog');
    box.innerHTML = '<h2>' + sym('🔍') + esc(title) + '</h2><img src="' + img + '" alt="" style="max-width:100%;max-height:34vh;border-radius:12px;display:block;margin:0 auto">' +
      '<p><b>Why would your character wear this?</b> Tap one, or say it in your own words.</p><div class="row" style="flex-wrap:wrap">' +
      REASONS.map(function (r, i) { return '<button type="button" class="btn small" data-r="' + i + '" aria-pressed="false">' + esc(r) + '</button>'; }).join('') + '</div>' +
      '<label class="f">In my own words (you can skip this)<input id="own" maxlength="160"></label>' +
      '<div class="row end"><button class="btn" id="cn">Cancel</button><button class="btn primary" id="ok">Send it</button></div>';
    document.body.appendChild(box); box.showModal();
    var close = function () { box.close(); box.remove(); };
    box.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); }; });
    box.querySelector('#cn').onclick = function () { close(); done(null); };
    box.querySelector('#ok').onclick = function () {
      var picked = Array.prototype.filter.call(box.querySelectorAll('[data-r]'), function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return REASONS[+b.dataset.r].replace(/^\S+\s/, ''); });
      var own = clean(box.querySelector('#own').value, 160), why = clean(picked.concat(own ? [own] : []).join('. '), 300);
      if (!why) { T.toast('Tap a reason, or type one.'); return; }
      var b = box.querySelector('#ok'); b.disabled = true; b.textContent = 'Sending…';
      done(why, close, function () { b.disabled = false; b.textContent = 'Send it'; });
    };
  }
  function researchPage() {
    T.setBar('Costume photos', '#/home');
    var due = S().researchDue;
    app.innerHTML = '<div class="card"><h2>' + sym('🔍') + 'Costume research</h2><p>Find <b>3 to 5 pictures of outfits your character would wear</b>. Look for real clothes, not only pictures from the movie. For each one, tell why.</p>' +
      (due ? '<p><b>Due ' + esc(nice(due)) + '.</b></p>' : '') + '<p class="muted small">Then you use your pictures to make your list for the shopping day.</p>' + photoTabs('research') + '</div><div id="phList"><p class="muted">Loading…</p></div>';
    photoList(true).then(function (l) {
      var mine = sentHere(), can = canList();
      document.getElementById('phList').innerHTML = T.me.chars.map(function (cid) {
        var n = l.filter(function (p) { return p.kind === 'research' && p.char === cid && (p.actor === T.me.id || mine.indexOf(p.id) >= 0); }).length;
        var board = l.filter(function (p) { return p.kind === 'board' && p.ref === cid && p.ok; }).length;
        return '<div class="card"><div class="row" style="flex-wrap:wrap"><h3 class="grow">' + T.chip(cid) + ' <span class="tag">' + n + ' of 3–5' + (n >= 3 ? ' ✓' : '') + '</span></h3>' +
          (can ? '<label class="btn primary">' + icon('camera') + 'Add a picture<input type="file" accept="image/*" hidden data-research="' + cid + '"></label>' +
            (board ? '<button class="btn" data-board="' + cid + '">Pick from the choice board (' + board + ')</button>' : '') : '') + '</div>' +
          '<p class="muted small">A screenshot or a saved picture works. Ask your teacher or a Mentor if you would like help finding some.</p>' +
          T.photoSlot('research', cid) + '</div>';
      }).join('');
      T.fillPhotos(app);
      var send = function (cid, img) {
        reasonDialog(img, 'For ' + T.charById(cid).short, function (why, close, retry) {
          if (!why) return;
          sendPhoto('research', cid, cid, img, why).then(function () { close(); researchPage(); }, function (e) { retry(); T.toast(e.message); });
        });
      };
      app.querySelectorAll('[data-research]').forEach(function (inp) {
        inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; shrink(f).then(function (img) { inp.value = ''; send(inp.dataset.research, img); }, function (e) { inp.value = ''; T.toast(e.message); }); };
      });
      app.querySelectorAll('[data-board]').forEach(function (b) {
        b.onclick = function () {
          var cid = b.dataset.board, ps = l.filter(function (p) { return p.kind === 'board' && p.ref === cid && p.ok; });
          var box = document.createElement('dialog');
          box.innerHTML = '<h2>Pick an outfit for ' + esc(T.charById(cid).short) + '</h2><div class="row" style="flex-wrap:wrap" id="bg">' + ps.map(function (p) { return '<button class="btn" data-pick="' + p.id + '" style="width:130px;height:130px;padding:4px;overflow:hidden" aria-label="Pick this outfit"></button>'; }).join('') + '</div><div class="row end"><button class="btn" id="cn">Cancel</button></div>';
          document.body.appendChild(box); box.showModal();
          box.querySelector('#cn').onclick = function () { box.close(); box.remove(); };
          var imgs = {};
          ps.forEach(function (p) { Store.getPhoto(T.key, p.id).then(function (o) { if (!okImg(o)) return; imgs[p.id] = o.img; var t = box.querySelector('[data-pick="' + p.id + '"]'); if (t) t.innerHTML = '<img src="' + o.img + '" alt="' + esc(o.caption || 'Outfit') + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px">'; }); });
          box.querySelectorAll('[data-pick]').forEach(function (t) { t.onclick = function () { var img = imgs[t.dataset.pick]; if (!img) return; box.close(); box.remove(); send(cid, img); }; });
        };
      });
    });
  }

  /* ---------- Teacher: costume research turned in, and the choice board ---------- */
  function researchAdmin(l, redraw) {
    var s = S(), cast = (T.show.cast || []).filter(function (a) { return (a.chars || []).length; });
    var count = function (a) { return l.filter(function (p) { return p.kind === 'research' && p.actor === a.id; }).length; };
    var done = cast.filter(function (a) { return count(a) >= 3; }).length;
    return '<h3>' + sym('🔍') + 'Costume research</h3><div class="row" style="flex-wrap:wrap"><label class="f" style="margin:0">Due<input type="date" id="rdue" value="' + esc(s.researchDue || '') + '"></label>' +
      '<span class="grow">' + (cast.length ? '<b>' + done + ' of ' + cast.length + '</b> have turned in 3 or more pictures.' : '') + '</span></div>' +
      (cast.length ? '<div class="row" style="flex-wrap:wrap;margin:8px 0">' + cast.map(function (a) { var n = count(a); return '<span class="tag"' + (n >= 3 ? '' : ' style="opacity:.7"') + '>' + esc(T.shortName(a.name)) + ': ' + (n >= 3 ? n + ' ✓' : n ? n + ' so far' : 'not yet') + '</span>'; }).join(' ') + '</div>' : '') +
      '<p class="muted small">Students add pictures on Costume photos › 🔍 Costume research; each one waits for your OK above. Approved pictures show on My Costumes, your Costumes page and next to that character’s shopping homework list.</p>' +
      '<h3>Choice board</h3><p class="muted small">Outfit pictures for a character, for students who find research hard: they pick one and give a reason.</p>' +
      '<div class="row" style="flex-wrap:wrap"><label class="f" style="margin:0">For<select id="bch">' + T.O().characters.map(function (c) { return '<option value="' + c.id + '">' + esc(c.short) + '</option>'; }).join('') + '</select></label>' +
      '<label class="btn">Add pictures<input type="file" accept="image/*" multiple hidden id="bfile"></label></div>' +
      T.O().characters.map(function (c) { return l.some(function (p) { return p.kind === 'board' && p.ref === c.id; }) ? T.photoSlot('board', c.id, c.short, true) : ''; }).join('');
  }
  function wireResearchAdmin(box, redraw) {
    var s = S();
    box.querySelector('#rdue').onchange = function (e) { s.researchDue = e.target.value; T.saveShow('Due date saved'); };
    box.querySelector('#bfile').onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []), cid = box.querySelector('#bch').value;
      files.reduce(function (p, f) {
        return p.then(function () {
          return shrink(f).then(function (img) {
            var id = 'ph-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            return Store.putPhoto(T.key, { id: id, actor: 'teacher', kind: 'board', ref: cid, char: cid }, { caption: '', img: img }).then(function () { return Store.photoOk(T.proof, id); });
          });
        });
      }, Promise.resolve()).then(function () { T.toast('Added to the choice board'); PH.list = null; redraw(); }, function (err) { T.toast(err.message); });
    };
  }

  /* ---------- Teacher: photos waiting, and who still needs to take theirs ---------- */
  function photoAdmin(redraw) {
    var box = document.getElementById('phAdmin'); if (!box) return;
    photoList(true).then(function (l) {
      var wait = l.filter(function (p) { return !p.ok && p.kind !== 'board'; }), due = photoDue(), days = T.prod ? T.prod.classDays() : [], today = T.prod ? T.prod.today() : '';
      var played = {}; (T.show.cast || []).forEach(function (a) { (a.chars || []).forEach(function (c) { (played[c] = played[c] || []).push(a); }); });
      var missing = Object.keys(played).map(function (cid) {
        var miss = photoTargets(cid).filter(function (t) { return !l.some(function (p) { return p.kind === t.kind && p.ref === t.ref; }); });
        return miss.length ? '<div class="switch" style="flex-wrap:wrap"><span class="grow">' + T.chip(cid) + ' <span class="muted small">' + played[cid].map(function (a) { return esc(T.shortName(a.name)); }).join(', ') + '</span><br>' + miss.map(function (t) { return esc(t.name); }).join(' · ') + '</span></div>' : '';
      }).join('');
      var left = due && days.indexOf(due.due) >= 0 && today ? days.filter(function (d) { return d > today && d <= due.due; }).length : null;
      box.innerHTML = '<h3>' + sym('📸') + 'Costume and prop photos</h3>' +
        (due ? '<p>Due <b>' + esc(nice(due.due)) + '</b>, 5 school days after the field trip on ' + esc(nice(due.trip)) + (today > due.due ? (missing ? ' · <b>past due</b>' : '') : left != null ? ' · ' + left + ' school day' + (left === 1 ? '' : 's') + ' left' : '') + '.</p>' :
          '<p class="muted small">Put a 🚌 Field trip group in a day’s plan, and the photos are due 5 school days after it.</p>') +
        '<p class="muted small">In a day’s plan, add a 📸 Costume and prop photos group (pick scenes, or set jobs one by one) to take turns.</p>' +
        '<p><a class="btn" href="#/photos/all">' + sym('📸') + 'Add photos yourself</a> <span class="muted small">For any character’s costumes, props and builds; yours need no OK.</span></p>' +
        (wait.length ? '<h3>Waiting for your OK (' + wait.length + ')</h3>' + wait.map(function (p) {
          var a = actorById(p.actor);
          return '<div class="switch" style="flex-wrap:wrap" data-pw="' + p.id + '"><span class="grow">' + (T.charById(p.char) ? T.chip(p.char) : '') + ' <span class="muted small">' + (a ? 'from ' + esc(a.name) : '') + '</span>' + T.photoSlot(p.kind, p.ref) + '</span>' +
            '<button class="btn small primary" data-pok="' + p.id + '">✓ OK</button><button class="btn small" data-pdel="' + p.id + '">✕ Remove</button></div>';
        }).join('') : '') +
        researchAdmin(l, redraw) +
        (Object.keys(played).length ? (missing ? '<h3>Still to photograph</h3>' + missing : '<p><b>Every costume and prop has a photo.</b></p>') : '<p class="muted small">Once the cast list is in, this shows who still has photos to take.</p>');
      box.querySelectorAll('[data-pw]').forEach(function (row) { row.querySelector('.photo-slot').dataset.only = row.dataset.pw; });      // a waiting row shows only its own photo
      T.fillPhotos(box, true); wireResearchAdmin(box, redraw);
      box.querySelectorAll('[data-pok]').forEach(function (b) { b.onclick = function () { Store.photoOk(T.proof, b.dataset.pok).then(function () { T.toast('OK: everyone can see it'); PH.list = null; redraw(); }, function (e) { T.toast(e.message); }); }; });
      box.querySelectorAll('[data-pdel]').forEach(function (b) { b.onclick = function () { if (!confirm('Remove this photo?')) return; Store.photoDel(T.proof, b.dataset.pdel).then(function () { T.toast('Removed'); PH.list = null; redraw(); }, function (e) { T.toast(e.message); }); }; });
    });
  }

  if (window.Store && T.key) Store.flushNotes();
})();
