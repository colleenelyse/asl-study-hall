/* asl.cool/theatre Shopping: one list for the whole show (Colleen, 2026-10-21: a field trip to Goodwill, maybe two, each teacher with half the class,
   "to shop for costumes and props for the whole show, not just themselves").
   The list is built from the costumes (every piece, for every student who wears it, with their sizes) and the props (outline.props, or the teacher's own).
   Shopping in the community with a real list is community-based instruction, an evidence-based practice for students with disabilities.
   T.show.shop = { status { itemKey: { s: have|bought|skip, price, by, at } }, showSizes, budget }; T.show.props replaces outline.props once edited.
   On the trip, students tap Found it!; the note waits on the iPad until there is Wi-Fi (Store.queueNote), then Teacher mode takes it in. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, icon = T.icon, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var STATUS = [['', 'Need'], ['have', 'Have it'], ['bought', 'Bought'], ['skip', 'Skip']];
  function S() { var s = T.show.shop = T.show.shop || {}; s.status = s.status || {}; return s; }
  function props() { return T.show.props || T.O().props || []; }
  function people(charId) { return (T.show.cast || []).filter(function (a) { return (a.chars || []).indexOf(charId) >= 0; }); }
  function money(n) { return '$' + (+n || 0).toFixed(2); }
  /* every item to find: { key, kind, name, who (char), for (actor), sizes, qty, costume } */
  function items() {
    var out = [];
    (T.O().costumes || []).forEach(function (c) {
      var ppl = people(c.who), list = ppl.length ? ppl : [null];
      c.items.forEach(function (it, i) {
        list.forEach(function (a) { out.push({ key: 'c|' + c.id + '|' + i + '|' + (a ? a.id : '-'), kind: 'costume', name: it, costume: c.name, who: c.who, actor: a, qty: 1 }); });
      });
    });
    props().forEach(function (p) { out.push({ key: 'p|' + p.id, kind: 'prop', name: p.name, who: p.who, qty: p.qty || 1, prop: p }); });
    return out;
  }
  function state(it) { var st = S().status[it.key] || {}; var pend = (T.ls('shopFound') || {})[it.key]; return { s: st.s || (pend ? 'bought' : ''), price: st.price || (pend && pend.price) || '', pending: !st.s && !!pend }; }

  T.noteHandlers = T.noteHandlers || {};
  T.noteHandlers.shop = function (n) {
    if (typeof n.key !== 'string' || n.key.length > 120) return false;
    var cur = S().status[n.key]; if (cur && cur.s === 'bought') return false;
    S().status[n.key] = { s: 'bought', price: String(n.price || '').replace(/[^\d.]/g, '').slice(0, 8), by: n.actor, at: n._at };
    return true;
  };

  /* ---------- Teacher: Production › Shopping ---------- */
  var filter = 'need';
  T.shopView = function () {
    var s = S(), all = items(), need = all.filter(function (it) { return !state(it).s; }).length;
    var spent = all.reduce(function (t, it) { var st = state(it); return t + (st.s === 'bought' ? +st.price || 0 : 0); }, 0);
    var list = all.filter(function (it) { return filter === 'all' || !state(it).s; });
    var byWho = {}; list.forEach(function (it) { var k = it.kind + '|' + it.who; (byWho[k] = byWho[k] || []).push(it); });
    return '<div class="card"><div class="row"><b class="grow">' + need + ' of ' + all.length + ' still to find · spent ' + money(spent) + (s.budget ? ' of ' + money(s.budget) : '') + '</b>' +
      '<label class="f" style="margin:0">Budget $<input id="bud" inputmode="decimal" value="' + esc(s.budget || '') + '" style="width:110px;display:inline-block"></label><button class="btn small" onclick="print()">' + icon('print') + 'Print</button></div>' +
      '<label class="switch"><span>Show sizes on the Company members’ list</span><input type="checkbox" id="ssz"' + (s.showSizes ? ' checked' : '') + '></label>' +
      '<div class="seg noprint"><button data-f="need" aria-pressed="' + (filter === 'need') + '">Still to find</button><button data-f="all" aria-pressed="' + (filter === 'all') + '">Everything</button></div>' +
      '<p class="muted small">Field trips: in a day’s plan, add a 🚌 Field trip group. “Two trips: half the class each” sends each half on a different day. Company members open this list from Today.</p></div>' +
      Object.keys(byWho).sort().map(function (k) {
        var l = byWho[k], it0 = l[0], ch = T.charById(it0.who);
        return '<div class="card"><h3>' + (it0.kind === 'prop' ? sym('🎒') + 'Props · ' : sym('👕') + 'Costumes · ') + (ch ? T.chip(it0.who) : esc(it0.who)) + '</h3>' + l.map(function (it) {
          var st = state(it);
          return '<div class="switch" style="flex-wrap:wrap"><span class="grow"><b>' + esc(it.name) + '</b>' + (it.qty > 1 ? ' × ' + it.qty : '') +
            '<br><span class="muted small">' + (it.kind === 'costume' ? esc(it.costume) + ' · ' + (it.actor ? esc(it.actor.name) + (it.actor.sizes ? ' (' + esc(it.actor.sizes) + ')' : '') : 'not cast yet') : '') + (st.pending ? ' · found on a trip' : '') + '</span></span>' +
            '<div class="seg" data-k="' + esc(it.key) + '">' + STATUS.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (st.s === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
            '<input data-price="' + esc(it.key) + '" inputmode="decimal" placeholder="$" value="' + esc(st.price) + '" style="width:80px;min-height:44px;border:2px solid var(--line);border-radius:10px;padding:4px 8px;background:var(--card)"></div>';
        }).join('') + '</div>';
      }).join('') +
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
    document.getElementById('padd').onclick = function () {
      var n = document.getElementById('pn').value.trim(); if (!n) return;
      if (!T.show.props) T.show.props = JSON.parse(JSON.stringify(T.O().props || []));
      T.show.props.push({ id: 'p-' + Math.random().toString(36).slice(2, 8), name: n, who: document.getElementById('pw').value, qty: Math.max(1, +document.getElementById('pq').value || 1), scenes: [] });
      T.saveShow('Prop added').then(redraw);
    };
  };

  /* ---------- Students: the shopping list on a field trip ---------- */
  T.studentPages = T.studentPages || {};
  T.studentPages.shop = function () {
    T.setBar('Shopping list', '#/today');
    var s = S(), found = T.ls('shopFound') || {}, all = items().filter(function (it) { var st = state(it); return st.s !== 'have' && st.s !== 'skip'; });
    var mine = function (it) { return T.me && T.me.chars.indexOf(it.who) >= 0; };
    all.sort(function (a, b) { return (state(a).s ? 1 : 0) - (state(b).s ? 1 : 0) || (mine(b) ? 1 : 0) - (mine(a) ? 1 : 0) || a.kind.localeCompare(b.kind); });
    var left = all.filter(function (it) { return !state(it).s; }).length;
    app.innerHTML = '<div class="card"><h2>' + sym('🚌') + 'Our field trip</h2><ol class="big" style="font-size:1.05em;line-height:1.7">' +
      '<li>Ride with your group and your teacher.</li><li>Stay with your buddy in the store.</li><li>Look for things on this list. It is for <b>the whole show</b>, not only you.</li>' +
      '<li>Found one? Show your teacher, then tap <b>Found it!</b></li><li>Your teacher pays. Then we ride back to school.</li></ol>' +
      '<p class="muted small">No Wi-Fi in the store is OK: what you find is saved on this iPad and sent when you are back at school.</p></div>' +
      '<h3>' + left + ' things still to find</h3>' + all.map(function (it) {
        var st = state(it), ch = T.charById(it.who);
        return '<div class="card row" style="margin-bottom:10px;' + (st.s ? 'opacity:.55' : '') + '"><div class="grow"><b style="font-size:1.1em">' + esc(it.name) + '</b>' + (it.qty > 1 ? ' × ' + it.qty : '') +
          '<br><span class="small">' + (ch ? T.chip(it.who) : '') + (it.kind === 'costume' && it.actor ? ' for ' + esc(it.actor.name) + (s.showSizes && it.actor.sizes ? ' · <b>' + esc(it.actor.sizes) + '</b>' : '') : '') + (it.kind === 'prop' ? ' prop' : '') + '</span></div>' +
          (st.s ? '<span class="tag">' + (st.pending ? 'Found! (will send)' : 'Found') + '</span>' : '<button class="btn primary" data-found="' + esc(it.key) + '">✓ Found it!</button>') + '</div>';
      }).join('');
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
  if (window.Store && T.key) Store.flushNotes();
})();
