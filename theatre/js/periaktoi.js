/* asl.cool/theatre: Teacher mode › Tech and the show › Set and scene changes (Colleen 2026-10-25: "an animated version of this run plot that
   shows movement around the stage and turns to the correct facings and pairings ... from the front audience perspective, from the back in the
   crew's perspective, and from a birds eye view"). Phase 1: the stage, the 4 towers and 12 faces, flat and point facings, click a face to turn
   it to the audience, drag to move, the 17 scenes as saved states, and a played change from the scene before. Geometry: js/periaktoi-core.js.
   Art: img/set/<PK.FILES id>.png when it exists (her 12 mockups, 1:2), else a drawn placeholder. Saved in T.show.periaktoi (and this browser). */
(function () {
  'use strict';
  var T = window.T, PK = window.PK, esc = T.esc, app = document.getElementById('app');
  var TW = PK.TOWERS, P = null, cur = 0, sel = null, undo = [], redo = [], saveTimer = 0, LS = 'theatre-periaktoi';
  var V = { pics: true, zoom: 'towers', view: 'split', labels: true, spikes: true, paths: true, sweep: true, rim: true, routes: true, clear: false, speed: 1, loop: false };
  var anim = null;      // { from, to, ch, u, playing, dur, last }
  var COL = { A: '#ff8a5c', B: '#ffd25c', C: '#6fd3ff', D: '#c79bff' };
  var LIT = { full: 0, low: 0.5, dark: 0.85 };

  /* ---------- data ---------- */
  function load() {
    var local = null; try { local = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
    var shown = T.show.periaktoi;
    P = shown && (!local || (shown.stamp || 0) >= (local.stamp || 0)) ? JSON.parse(JSON.stringify(shown)) : local || PK.fresh();
    if (local && shown && (local.stamp || 0) > (shown.stamp || 0)) queueSave();      // changes made here that never reached the server
    if (!P.v || P.v < 2) { P = PK.fresh(); queueSave(); }      // plans from before the cafeteria update (test data only) start over
    if (P.v === 2) { PK.migrate(P); queueSave(); }      // the center lane between B and C (2026-10-25)
    if (P.practicals && P.practicals.D1 && P.practicals.D1.z === 6.5) P.practicals.D1.z = 5;
    if (P.practicals && P.practicals.C1 && !P.practicals.C1.show) { P.practicals.C1.h = 2; P.practicals.C1.show = 'cork'; if (P.practicals.C1.z === 5) P.practicals.C1.z = 47 / 12; }      // the real corkboard, drawn on her C1 wall      // the rim lines up with the printed target square in her D1 art
    if (cur >= P.scenes.length) cur = 0;
  }
  function label(i) {      // scene numbers; a moment inside a scene (the united tables) is "15b"
    var n = 0; for (var k = 0; k <= i; k++) if (!P.scenes[k].moment) n++;
    return P.scenes[i].moment ? n + 'b' : String(n);
  }
  function snap() { undo.push(JSON.stringify(P)); if (undo.length > 80) undo.shift(); redo = []; }
  function changed() {
    var sc = scene();      // a table on a spike preset moves the preset (so 9 and the start of 15 stay identical); linked scenes keep identical towers
    PK.TABLES.forEach(function (id) { var q = sc.tables && sc.tables[id]; if (q && q.spike && P.spikes[q.spike]) P.spikes[q.spike][id] = { x: q.x, y: q.y, rot: q.rot }; });
    PK.applySpikes(P); PK.applyLinks(P, sc);
    P.stamp = Date.now();
    try { localStorage.setItem(LS, JSON.stringify(P)); } catch (e) {}
    queueSave(); draw();
  }
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { T.show.periaktoi = JSON.parse(JSON.stringify(P)); T.saveShow('Set plan saved').catch(function () {}); }, 2500);
  }
  function step(back) {
    var a = back ? undo : redo, b = back ? redo : undo; if (!a.length) return;
    b.push(JSON.stringify(P)); P = JSON.parse(a.pop()); if (cur >= P.scenes.length) cur = P.scenes.length - 1;
    P.stamp = Date.now(); try { localStorage.setItem(LS, JSON.stringify(P)); } catch (e) {} queueSave(); draw();
  }
  var scene = function () { return P.scenes[cur]; };
  var prevScene = function () { return cur > 0 ? P.scenes[cur - 1] : null; };
  var st = function () { return P.stage; };
  var winds = function (t) { var w = P.towers[t]; return w.confirmed ? (w.wind === 'cw' ? 'clockwise' : 'counterclockwise') : null; };
  function setWant(t, want) { var s = scene().towers[t]; s.want = want; s.rot = PK.rotFor(P, t, want).rot; }
  function setRot(t, rot) { var s = scene().towers[t], f = PK.facing(P, t, rot); s.rot = PK.norm(rot); s.want = f.kind === 'angled' ? null : f.faces.join('+'); }

  /* ---------- art: her mockups when they exist, placeholders until then ---------- */
  var ART = {}, artList = null;      // img/set/index.json lists the mockups that have arrived, e.g. ["A1-East-High-Lockers.png", …]
  function art(id) {
    if (ART[id]) return ART[id];
    var a = ART[id] = { img: placeholder(id), real: false };
    if (!artList) artList = fetch('img/set/index.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    artList.then(function (list) {
      var mine = versions(list, id), pick = P.art && P.art[id]; a.versions = mine;      // a face can have several versions (D3-Academic-Corridor.jpg, D3-Academic-Corridor-v2.jpg…): her pick, else the plain one
      var f = mine.indexOf(pick) >= 0 ? pick : mine.find(function (n) { return n.indexOf(PK.FILES[id] + '.') === 0; }) || mine[0]; if (!f) return; a.file = f;
      if (a.versions.length > 1 && sel && document.getElementById('pkRight')) draw();
      var im = new Image(); im.onload = function () { a.img = fit(im, a); a.real = true; symbolArt(id); drawViews(); }; im.src = 'img/set/' + f;
    });
    return a;
  }
  function artUrl(id) { var a = art(id); return a.img.tagName === 'IMG' ? a.img.src : (a.url && a.urlFor === a.img ? a.url : (a.urlFor = a.img, a.url = a.img.toDataURL('image/jpeg', 0.7))); }
  function symbolArt(id) { var im = document.getElementById('pkArtImg-' + id); if (im) im.setAttribute('href', artUrl(id)); }
  function fit(im, a) {      // never stretched: a picture that is not 1:2 sits at its true shape on a dark face, and is flagged
    var r = im.width / im.height; a.ratio = r; a.off = Math.abs(r - 0.5) > 0.01;
    if (!a.off) return im;
    var c = document.createElement('canvas'), w = im.width, h = Math.round(w * 2); if (r < 0.5) { h = im.height; w = Math.round(h / 2); }
    c.width = w; c.height = h; var g = c.getContext('2d'); g.fillStyle = '#2a2833'; g.fillRect(0, 0, w, h);
    var dw = r < 0.5 ? h * r : w, dh = r < 0.5 ? h : w / r; g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
    g.fillStyle = '#ffcf6b'; g.font = 'bold ' + Math.round(w / 14) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('Not 1:2: re-export', w / 2, Math.max(w / 10, (h - dh) / 2 - w / 20));
    return c;
  }
  function versions(list, id) { return (list || []).filter(function (n) { return n.indexOf(PK.FILES[id]) === 0; }); }
  function placeholder(id) {
    var w = 240, h = 480, c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'), stripe = function () { g.fillStyle = '#9e1b2a'; g.fillRect(0, h * (1 - 40 / 96), w, h * 4 / 96); };      // crimson stripe, same height on every academic wall
    var wall = function (col) { g.fillStyle = col; g.fillRect(0, 0, w, h); };
    if (id === 'B2' || id === 'C2') {      // one 8-ft black-box picture split down the seam
      var both = document.createElement('canvas'); both.width = w * 2; both.height = h; var b = both.getContext('2d');
      b.fillStyle = '#111'; b.fillRect(0, 0, w * 2, h);
      b.fillStyle = '#5a0d16'; b.fillRect(0, 0, 70, h); b.fillRect(w * 2 - 70, 0, 70, h);
      var gr = b.createRadialGradient(w, h * 0.75, 10, w, h * 0.75, 200); gr.addColorStop(0, 'rgba(255,240,200,.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      b.fillStyle = gr; b.fillRect(0, 0, w * 2, h);
      b.fillStyle = '#2a2a2a'; b.fillRect(0, h * 0.9, w * 2, h * 0.1);
      g.drawImage(both, id === 'B2' ? 0 : w, 0, w, h, 0, 0, w, h);
    } else if (id === 'A1') { wall('#e9e1cf'); for (var i = 0; i < 8; i++) { g.fillStyle = i >= 2 && i < 6 ? '#b3121f' : '#8b95a1'; g.fillRect(8 + i * 28.5, h * 0.3, 25, h * 0.68); g.fillStyle = 'rgba(0,0,0,.35)'; for (var v = 0; v < 4; v++) g.fillRect(12 + i * 28.5, h * 0.33 + v * 6, 16, 2); } }
    else if (id === 'A2') { wall('#2f6b3a'); g.fillStyle = '#f4f7f2'; g.fillRect(30, h * 0.25, w - 60, h * 0.28); for (var k = 0; k < 9; k++) { g.fillStyle = k % 2 ? '#5fae4e' : '#3d8c3a'; g.beginPath(); g.arc(20 + k * 26, h * 0.82 - (k % 3) * 18, 22, 0, 7); g.fill(); } }
    else if (id === 'A3') { wall('#6b4425'); g.fillStyle = '#d9c7a5'; g.fillRect(20, h * 0.18, w - 40, h * 0.6); g.fillStyle = '#6b4425'; for (var s = 1; s < 4; s++) g.fillRect(20, h * 0.18 + s * h * 0.15, w - 40, 4); g.fillStyle = '#e0b43a'; for (var q = 0; q < 12; q++) { g.beginPath(); g.arc(40 + (q % 4) * 52, h * 0.27 + Math.floor(q / 4) * h * 0.15, 10, 0, 7); g.fill(); } }
    else if (id === 'B1') { wall('#e4dccb'); stripe(); g.fillStyle = '#7a5230'; g.fillRect(w * 0.125, h * (1 - 80 / 96), w * 0.75, h * 80 / 96); g.fillStyle = '#cfe3ef'; g.fillRect(w * 0.42, h * 0.25, w * 0.16, h * 0.18); g.fillStyle = '#d8c070'; g.fillRect(w * 0.75, h * 0.6, 12, 6); }
    else if (id === 'B3') { wall('#e9e4dc'); stripe(); g.fillStyle = '#2f5d2a'; g.beginPath(); g.arc(w * 0.2, h * 0.38, 42, 0, 7); g.fill(); g.fillStyle = '#b3121f'; g.beginPath(); g.arc(w * 0.2, h * 0.38, 26, 0, 7); g.fill(); g.fillStyle = '#cfc6b8'; g.fillRect(w * 0.44, 0, w * 0.12, h); g.fillStyle = '#b8bec4'; g.fillRect(w * 0.68, h * 0.62, w * 0.24, h * 0.14); }
    else if (id === 'C1') { wall('#e4dccb'); stripe(); g.fillStyle = '#b98b5a'; g.fillRect(w * 0.125, h * 0.25, w * 0.75, h * 0.25); g.fillStyle = '#fff'; g.fillRect(w * 0.2, h * 0.28, 40, 50); g.fillRect(w * 0.55, h * 0.3, 50, 40); }
    else if (id === 'C3') { wall('#ddd'); for (var j = 0; j < 6; j++) { g.fillStyle = '#b3121f'; g.fillRect(6 + j * 38.5, h * 0.12, 34, h * 0.86); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(12 + j * 38.5, h * 0.18, 20, 3); g.fillRect(12 + j * 38.5, h * 0.2, 20, 3); } }
    else if (id === 'D1') { wall('#e8d2a8'); g.fillStyle = '#9e1b2a'; g.fillRect(0, h * 0.62, w, h * 0.06); g.fillStyle = '#fff'; g.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.2); g.strokeStyle = '#b3121f'; g.lineWidth = 5; g.strokeRect(w * 0.38, h * 0.18, w * 0.24, h * 0.1); g.strokeStyle = '#ff6a00'; g.beginPath(); g.ellipse(w / 2, h * 0.32, 28, 7, 0, 0, 7); g.stroke(); }
    else if (id === 'D2') { wall('#cfcac2'); stripe(); g.fillStyle = '#e9f0f4'; g.fillRect(w * 0.12, h * 0.1, w * 0.3, h * 0.55); g.fillRect(w * 0.58, h * 0.1, w * 0.3, h * 0.55); }
    else { wall('#e4dccb'); stripe(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.setLineDash([8, 8]); g.strokeRect(20, 20, w - 40, h * 0.5); }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, w, 64); g.fillStyle = '#fff'; g.font = 'bold 34px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText(id, w / 2, 38);
    g.font = '15px sans-serif'; g.fillText(PK.SHORT[id] + ' (placeholder)', w / 2, 58);
    return c;
  }

  /* ---------- what is on stage right now (a scene, or part-way through a change) ---------- */
  function shown() {
    var sc = scene();
    if (!anim) {
      var tb = {}; PK.TABLES.forEach(function (id) { var x = sc.tables && sc.tables[id]; if (x) tb[id] = { x: x.x, y: x.y, rot: x.rot, k: x.state === 'deployed' ? 1 : 0, label: PK.TSTATE[x.state] }; });
      return { towers: sc.towers, tables: tb, items: sc.items || [], zones: sc.zones || [], lit: function (t) { return LIT[sc.towers[t].lit] || 0; } };
    }
    var a = P.scenes[anim.from], b = P.scenes[anim.to], u = anim.u, towers = {};
    anim.ch.moves.forEach(function (m) { var s = PK.between(P, m, u); towers[m.t] = s; });
    var tables = {}; anim.ch.tmoves.forEach(function (tm) { tables[tm.id] = PK.tableBetween(P, tm, u); });
    return { towers: towers, tables: tables, items: u < 0.5 ? a.items || [] : b.items || [], zones: u < 0.5 ? a.zones || [] : b.zones || [],
      lit: function (t) { var x = LIT[a.towers[t].lit] || 0, y = LIT[b.towers[t].lit] || 0; return x + (y - x) * u; } };
  }

  /* ---------- bird's-eye view (SVG in feet; svg y = −stage y, so the audience is at the bottom) ---------- */
  var svg = null, dyn = null;
  function bounds() { var s = st(), half = s.prosc / 2 + Math.max(s.sideDeck, s.wing) + 2; return { x0: -half, x1: half, y0: -(s.curtain + 6), y1: s.apron + 4 }; }
  function overheadStatic() {
    var s = st(), b = bounds(), c = s.prosc / 2, out = [];
    var pts = []; for (var i = 0; i <= 60; i++) { var x = -c + 2 * c * i / 60; pts.push(x.toFixed(2) + ',' + (-PK.frontY(s, x)).toFixed(2)); }
    out.push('<rect x="' + b.x0 + '" y="' + b.y0 + '" width="' + (b.x1 - b.x0) + '" height="' + (b.y1 - b.y0) + '" fill="#0d0c14"/>');
    out.push('<rect x="' + (-c) + '" y="' + (-s.curtain - 5) + '" width="' + 2 * c + '" height="5" fill="url(#pkHatch)"/><text x="0" y="' + (-s.curtain - 2.2) + '" class="pk-t dim" text-anchor="middle">behind the main curtain (closed)</text>');
    out.push('<rect x="' + (-c - s.wing) + '" y="' + (-s.curtain - 5) + '" width="' + s.wing + '" height="' + (s.curtain + 5) + '" fill="#17151f"/><rect x="' + c + '" y="' + (-s.curtain - 5) + '" width="' + s.wing + '" height="' + (s.curtain + 5) + '" fill="#17151f"/>');
    out.push('<text x="' + (-c - s.wing / 2) + '" y="' + (-s.curtain - 1) + '" class="pk-t dim" text-anchor="middle">SR wing</text><text x="' + (c + s.wing / 2) + '" y="' + (-s.curtain - 1) + '" class="pk-t dim" text-anchor="middle">SL wing</text>');
    out.push('<polygon class="pk-deck" points="' + (-c) + ',' + (-s.curtain) + ' ' + pts.join(' ') + ' ' + c + ',' + (-s.curtain) + '"/>');
    out.push('<rect class="pk-deck" x="' + (-c - s.sideDeck) + '" y="0" width="' + s.sideDeck + '" height="' + s.edgeSide + '"/><rect class="pk-deck" x="' + c + '" y="0" width="' + s.sideDeck + '" height="' + s.edgeSide + '"/>');
    var grid = [];
    for (var gx = Math.ceil(-c - s.sideDeck); gx <= c + s.sideDeck; gx++) grid.push('<line x1="' + gx + '" y1="' + (-s.curtain) + '" x2="' + gx + '" y2="' + s.apron + '" class="' + (gx % 5 ? 'pk-g' : 'pk-g5') + '"/>');
    for (var gy = Math.ceil(-s.curtain); gy <= s.apron; gy++) grid.push('<line x1="' + (-c - s.sideDeck) + '" y1="' + gy + '" x2="' + (c + s.sideDeck) + '" y2="' + gy + '" class="' + (gy % 5 ? 'pk-g' : 'pk-g5') + '"/>');
    out.push('<clipPath id="pkDeckClip"><polygon points="' + (-c) + ',' + (-s.curtain) + ' ' + pts.join(' ') + ' ' + c + ',' + (-s.curtain) + '"/><rect x="' + (-c - s.sideDeck) + '" y="0" width="' + (2 * c + 2 * s.sideDeck) + '" height="' + s.edgeSide + '"/></clipPath>');
    out.push('<g clip-path="url(#pkDeckClip)">' + grid.join('') + '</g>');
    out.push('<line x1="0" y1="' + (-s.curtain) + '" x2="0" y2="' + s.apron + '" class="pk-cl"/>');
    out.push('<line x1="' + (-c) + '" y1="0" x2="' + c + '" y2="0" class="pk-pl"/><text x="' + (c - 0.6) + '" y="-0.3" class="pk-t dim" text-anchor="end">PL</text>');
    out.push('<line x1="' + (-c) + '" y1="' + (-s.curtain) + '" x2="' + c + '" y2="' + (-s.curtain) + '" class="pk-drape"/><text x="' + (-c + 0.6) + '" y="' + (-s.curtain - 0.35) + '" class="pk-t red">Main curtain (grand drape), ' + PK.ft(s.curtain) + ' upstage of PL</text>');
    out.push('<line x1="' + (-c - s.wing) + '" y1="0" x2="' + (-c) + '" y2="0" class="pk-wall"/><line x1="' + c + '" y1="0" x2="' + (c + s.wing) + '" y2="0" class="pk-wall"/>');
    out.push('<text x="' + (-c - 0.4) + '" y="-0.6" class="pk-t dim" text-anchor="end">proscenium</text><text x="' + (c + 0.4) + '" y="-0.6" class="pk-t dim">proscenium</text>');
    out.push('<defs>' + ['A', 'B', 'C', 'D'].map(function (t) { return [1, 2, 3].map(function (k) { var id = t + k; return '<symbol id="pkArt-' + id + '" viewBox="0 0 240 480" preserveAspectRatio="xMidYMid slice"><image id="pkArtImg-' + id + '" href="' + artUrl(id) + '" width="240" height="480" preserveAspectRatio="xMidYMid slice"/></symbol>'; }).join(''); }).join('') + '</defs>');
    out.push('<g id="pkZones"></g>');
    out.push('<text x="0" y="' + (s.apron + 2.6) + '" class="pk-t big" text-anchor="middle">▼ AUDIENCE (downstage edge) ▼</text>');
    out.push('<text x="' + (b.x0 + 0.8) + '" y="' + (s.apron + 2.6) + '" class="pk-t">STAGE RIGHT (A side) · house left</text><text x="' + (b.x1 - 0.8) + '" y="' + (s.apron + 2.6) + '" class="pk-t" text-anchor="end">STAGE LEFT (D side) · house right</text>');
    out.push('<text x="0" y="' + (b.y0 + 1.2) + '" class="pk-t dim" text-anchor="middle">▲ UPSTAGE ▲</text>');
    return out.join('');
  }
  function zonesSvg(zones) {
    var s = st(), c = s.prosc / 2, on = function (z) { return zones.indexOf(z) >= 0 ? ' on' : ''; };
    return '<rect class="pk-zone hort' + on('hort') + '" x="' + (-c - s.sideDeck) + '" y="0" width="' + s.sideDeck + '" height="' + s.edgeSide + '"/><text x="' + (-c - s.sideDeck / 2) + '" y="' + (s.edgeSide / 2 + 0.3) + '" class="pk-t" text-anchor="middle">Horticulture HQ</text>' +
      '<rect class="pk-zone nye' + on('nye') + '" x="' + c + '" y="0" width="' + s.sideDeck + '" height="' + s.edgeSide + '"/><text x="' + (c + s.sideDeck / 2) + '" y="' + (s.edgeSide / 2 + 0.3) + '" class="pk-t" text-anchor="middle">NYE karaoke</text>' +
      '<line x1="' + (c + 0.3) + '" y1="0.15" x2="' + (c + s.sideDeck - 0.3) + '" y2="0.15" class="pk-shimmer' + on('nye') + '"/>';
  }
  var pt = function (p) { return p.x.toFixed(3) + ',' + (-p.y).toFixed(3); };
  function overheadDyn() {
    var s = st(), sh = shown(), out = [], prev = !anim && prevScene(), Rr = PK.R(s);
    document.getElementById('pkZones').innerHTML = zonesSvg(sh.zones);
    if (V.spikes) Object.keys(P.spikes || {}).forEach(function (k) { var sp = P.spikes[k], col = sp.tape === 'green' ? '#5fd38a' : '#5aa9ff';
      PK.TABLES.forEach(function (id) { var q = sp[id]; if (!q) return; var a = q.rot * Math.PI / 180, L = P.tables[id].open.l / 2 - 0.6, x1 = q.x - Math.cos(a) * L, y1 = q.y - Math.sin(a) * L, x2 = q.x + Math.cos(a) * L, y2 = q.y + Math.sin(a) * L;
        out.push('<g class="pk-tspike"><line x1="' + x1 + '" y1="' + (-y1) + '" x2="' + x2 + '" y2="' + (-y2) + '" stroke="' + col + '" marker-end="url(#pkArrow)"/><text x="' + q.x + '" y="' + (-q.y - 0.35) + '" class="pk-t" text-anchor="middle" fill="' + col + '" style="fill:' + col + '">' + id + ' · ' + esc(k) + '</text></g>'); }); });
    if (V.spikes) P.scenes.forEach(function (sc) { TW.forEach(function (t) { var q = sc.towers[t]; out.push('<g class="pk-spike"><path d="M' + (q.x - 0.25) + ',' + (-q.y) + 'h0.5M' + q.x + ',' + (-q.y - 0.25) + 'v0.5" stroke="' + COL[t] + '"/></g>'); }); });
    if (V.paths && prev) TW.forEach(function (t) {
      var a = prev.towers[t], b = sh.towers[t], g = PK.geom(P, t, a, s);
      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01 || Math.abs(PK.norm(a.rot - b.rot)) > 0.5) {
        out.push('<polygon class="pk-ghost" points="' + g.poly.map(pt).join(' ') + '" stroke="' + COL[t] + '"/>');
        if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01) out.push('<line class="pk-path" x1="' + a.x + '" y1="' + (-a.y) + '" x2="' + b.x + '" y2="' + (-b.y) + '" stroke="' + COL[t] + '" marker-end="url(#pkArrow)"/>');
      }
    });
    (P.storage || []).forEach(function (z) { out.push('<rect class="pk-store" x="' + (z.x - z.w / 2) + '" y="' + (-z.y - z.d / 2) + '" width="' + z.w + '" height="' + z.d + '"/><text x="' + z.x + '" y="' + (-z.y + 0.25) + '" class="pk-t store" text-anchor="middle">' + esc(z.name) + '</text>'); });
    if ((V.routes || PK.TABLES.indexOf(sel) >= 0) && prev && !anim) PK.change(P, prev, scene()).tmoves.forEach(function (tm) {
      if (tm.dist && (V.routes || sel === tm.id)) out.push('<polyline class="pk-route' + (sel === tm.id ? ' sel' : '') + '" points="' + tm.route.map(pt).join(' ') + '" marker-end="url(#pkArrow)"/>');
      if (sel === tm.id && tm.own) (tm.to.via || []).forEach(function (w, i) { out.push('<circle class="pk-wp" data-wp="' + i + '" cx="' + w.x + '" cy="' + (-w.y) + '" r="0.4"><title>Drag this bend</title></circle>'); });
    });
    if (V.routes && anim) anim.ch.tmoves.forEach(function (tm) { if (tm.dist) out.push('<polyline class="pk-route" points="' + tm.route.map(pt).join(' ') + '"/>'); });
    PK.TABLES.forEach(function (id) {
      var x = sh.tables[id]; if (!x) return;
      var f = PK.tableFoot(P, id, x, x.k), spec = P.tables[id];
      if (V.clear) out.push('<polygon class="pk-tpad" points="' + f.pad.map(pt).join(' ') + '"/>');
      out.push('<g class="pk-table' + (x.k > 0.5 ? ' open' : '') + (sel === id ? ' sel' : '') + '" data-table="' + id + '"><polygon points="' + f.poly.map(pt).join(' ') + '"/><text x="' + x.x + '" y="' + (-x.y + 0.25) + '" class="pk-t" text-anchor="middle">' + (id === 'T1' ? 'T1' : 'T2') + '</text>' +
        (anim || sel === id ? '<text x="' + x.x + '" y="' + (-x.y - f.w / 2 - 0.3) + '" class="pk-t dim" text-anchor="middle">' + esc(spec.name + ': ' + x.label) + '</text>' : '') + '</g>');
    });
    (sh.items || []).forEach(function (it) {
      out.push('<g class="pk-item' + (sel === it.id ? ' sel' : '') + '" data-item="' + it.id + '" transform="translate(' + it.x + ',' + (-it.y) + ') rotate(' + (-(it.rot || 0)) + ')"><rect x="' + (-it.w / 2) + '" y="' + (-it.d / 2) + '" width="' + it.w + '" height="' + it.d + '" rx="0.15"/><text y="0.25" class="pk-t" text-anchor="middle">' + esc(it.name) + '</text></g>');
    });
    TW.forEach(function (t) {
      var q = sh.towers[t], g = PK.geom(P, t, q, s), dim = sh.lit(t), isSel = sel === t;
      if (V.sweep || isSel && !anim) out.push('<circle class="pk-sweep' + (g.sweep > Rr + 0.01 ? ' rim' : '') + '" cx="' + q.x + '" cy="' + (-q.y) + '" r="' + g.sweep + '"><title>' + t + ' sweeps this circle when it turns' + (g.sweep > Rr + 0.01 ? ' (its rim included)' : '') + '</title></circle>');
      out.push('<g class="pk-tower' + (isSel ? ' sel' : '') + '" data-t="' + t + '"><polygon points="' + g.poly.map(pt).join(' ') + '" fill="' + mix(COL[t], dim) + '" class="pk-body"/>');
      if (V.pics) g.faces.forEach(function (f) {      // a strip of the face's own picture along the outside of its edge (cropped from the middle, never stretched)
        var L = Math.hypot(f.r.x - f.l.x, f.r.y - f.l.y), ang = Math.atan2(-(f.r.y - f.l.y), f.r.x - f.l.x) * 180 / Math.PI;
        out.push('<use href="#pkArt-' + f.id + '" x="0" y="0.06" width="' + L + '" height="0.7" transform="translate(' + f.l.x + ',' + (-f.l.y) + ') rotate(' + ang + ')" opacity="' + (1 - dim * 0.7) + '" class="pk-pic"/>');
      });
      g.faces.forEach(function (f) {
        var toAud = Math.abs(f.a) < 89.5, lo = V.pics ? 1.15 : 0.75, lx = f.c.x + f.n.x * lo, ly = f.c.y + f.n.y * lo;
        out.push('<line data-face="' + f.id + '" x1="' + f.l.x + '" y1="' + (-f.l.y) + '" x2="' + f.r.x + '" y2="' + (-f.r.y) + '" class="pk-face' + (toAud ? ' aud' : '') + '"/>');
        out.push('<line data-face="' + f.id + '" x1="' + f.l.x + '" y1="' + (-f.l.y) + '" x2="' + f.r.x + '" y2="' + (-f.r.y) + '" class="pk-hit"/>');
        if (V.labels) out.push('<text x="' + lx + '" y="' + (-ly + 0.25) + '" class="pk-t face' + (toAud ? ' aud' : '') + '" text-anchor="middle">' + f.id + '</text>');
      });
      if (V.rim) g.prot.forEach(function (pq) {
        out.push('<polygon class="pk-protp' + (pq.rim ? ' rim' : '') + '" points="' + pq.poly.map(pt).join(' ') + '"><title>' + esc(P.practicals[pq.id].name) + '</title></polygon>');
        if (pq.rim) { var rc = { x: pq.mid.x + pq.n.x * (pq.d - 0.75), y: pq.mid.y + pq.n.y * (pq.d - 0.75) }; out.push('<circle class="pk-rim" cx="' + rc.x + '" cy="' + (-rc.y) + '" r="0.75"/>'); }
      });
      out.push('<text x="' + q.x + '" y="' + (-q.y + 0.45) + '" class="pk-letter" text-anchor="middle">' + t + '</text>');
      if (isSel && !anim) { var k = PK.dir(q.rot), kx = q.x + k.x * (Rr + 0.9), ky = q.y + k.y * (Rr + 0.9);
        out.push('<line x1="' + q.x + '" y1="' + (-q.y) + '" x2="' + kx + '" y2="' + (-ky) + '" class="pk-knobline"/><circle data-knob="' + t + '" cx="' + kx + '" cy="' + (-ky) + '" r="0.45" class="pk-knob"><title>Drag to turn (snaps every 30°; hold Option for any angle)</title></circle>'); }
      out.push('</g>');
    });
    dyn.innerHTML = out.join('');
  }
  function mix(hex, dark) {      // the tower's color, darker when its light is down
    var n = parseInt(hex.slice(1), 16), k = 0.55 * (1 - dark) + 0.12;
    return 'rgb(' + [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * k); }).join(',') + ')';
  }

  /* ---------- audience and crew views (canvas, simple perspective from the same data) ---------- */
  function front(cv, crew) {
    if (!cv) return;
    var s = st(), sh = shown(), W = cv.clientWidth * (window.devicePixelRatio || 1); if (!W) return;
    var c = s.prosc / 2, whole = V.zoom === 'stage', halfW = whole ? c + s.sideDeck + 1 : 14;
    var camY = crew ? s.curtain + s.crew : -(s.apron + s.house), sign = crew ? -1 : 1, line = PK.towerLine(scene());
    var depth = function (y) { return Math.max(0.5, (y - camY) * sign); };
    var refD = depth(line), F = (W * 0.48) * refD / halfW, m = W * 0.035;
    var hz = m + (s.height + 1.6 - s.eye) * F / refD;      // the tops of the towers sit just under the top edge
    var nearY = crew ? line + 1.5 : (whole ? -s.apron : line - 10);
    var H = Math.round(hz + s.eye * F / depth(nearY) + m);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var g = cv.getContext('2d'), pr = function (x, y, z) { var d = depth(y); return { x: W / 2 + sign * x * F / d, y: hz - (z - s.eye) * F / d }; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#07060b'; g.fillRect(0, 0, W, H);
    var poly = function (pts, fill, stroke) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
    if (!crew) poly([pr(-c, s.curtain, 0), pr(c, s.curtain, 0), pr(c, s.curtain, 22), pr(-c, s.curtain, 22)], '#4a0d14');      // the main curtain
    var deck = [pr(-c, s.curtain, 0)]; for (var i = 0; i <= 40; i++) { var x = -c + 2 * c * i / 40; deck.push(pr(x, PK.frontY(s, x), 0)); } deck.push(pr(c, s.curtain, 0));
    poly(deck, '#2b2620', '#5b5040');
    poly([pr(-c - s.sideDeck, 0, 0), pr(-c, 0, 0), pr(-c, -s.edgeSide, 0), pr(-c - s.sideDeck, -s.edgeSide, 0)], '#2b2620', '#5b5040');
    poly([pr(c, 0, 0), pr(c + s.sideDeck, 0, 0), pr(c + s.sideDeck, -s.edgeSide, 0), pr(c, -s.edgeSide, 0)], '#2b2620', '#5b5040');
    if (!crew) {      // the proscenium wall, the side-area backdrops
      poly([pr(-c - s.sideDeck - 3, 0, 0), pr(-c, 0, 0), pr(-c, 0, 22), pr(c, 0, 22), pr(c, 0, 0), pr(c + s.sideDeck + 3, 0, 0), pr(c + s.sideDeck + 3, 0, 30), pr(-c - s.sideDeck - 3, 0, 30)], '#16141c');
      var zs = sh.zones;
      poly([pr(c + 0.3, 0, 0), pr(c + s.sideDeck - 0.3, 0, 0), pr(c + s.sideDeck - 0.3, 0, 10), pr(c + 0.3, 0, 10)], zs.indexOf('nye') >= 0 ? '#c9c4d6' : '#2a2833');
      poly([pr(-c - s.sideDeck + 0.3, 0, 0), pr(-c - 0.3, 0, 0), pr(-c - 0.3, 0, 10), pr(-c - s.sideDeck + 0.3, 0, 10)], zs.indexOf('hort') >= 0 ? '#3f7a45' : '#22302a');
    } else {
      g.fillStyle = '#8a86a0'; g.font = Math.round(W * 0.016) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('▼ the audience is out there, past the front edge ▼', W / 2, pr(0, -s.apron, 0).y + W * 0.03);
    }
    var cam = { x: 0, y: camY }, draws = [];
    TW.forEach(function (t) {
      var q = sh.towers[t], gm = PK.geom(P, t, q, s), lit = sh.lit(t);
      gm.faces.forEach(function (f) {
        if (f.n.x * (cam.x - f.c.x) + f.n.y * (cam.y - f.c.y) <= 0.01 || (f.c.y - camY) * sign < 1) return;      // facing away from this camera, or behind it
        draws.push({ d: Math.hypot(f.c.x - cam.x, f.c.y - cam.y), f: function () { face(g, pr, f, s, lit, t); } });
      });
      gm.prot.forEach(function (pq) { if (pq.show !== 'cork') return;      // the real corkboard, mounted over the printed wall
        if (pq.n.x * (cam.x - pq.mid.x) + pq.n.y * (cam.y - pq.mid.y) <= 0.01) return;
        var hw = pq.w / 2, at = function (k, z) { return pr(pq.mid.x + pq.ax.x * hw * k + pq.n.x * pq.d, pq.mid.y + pq.ax.y * hw * k + pq.n.y * pq.d, z); };
        draws.push({ d: Math.hypot(pq.mid.x - cam.x, pq.mid.y - cam.y) - 0.05, f: function () { var lo = pq.z - pq.h / 2, hi = pq.z + pq.h / 2, q = [at(-1, hi), at(1, hi), at(1, lo), at(-1, lo)];
          g.beginPath(); q.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); g.fillStyle = '#b98b5a'; g.fill(); g.lineWidth = Math.max(2, W * 0.003); g.strokeStyle = '#6b4425'; g.stroke();
          if (lit > 0.01) { g.fillStyle = 'rgba(0,0,0,' + lit + ')'; g.fill(); } } }); });
      gm.prot.forEach(function (pq) { if (!pq.rim) return; var rc = { x: pq.mid.x + pq.n.x * (pq.d - 0.75), y: pq.mid.y + pq.n.y * (pq.d - 0.75) };
        draws.push({ d: Math.hypot(rc.x - cam.x, rc.y - cam.y), f: function () { var ring = []; for (var a = 0; a < 24; a++) { var q2 = a / 24 * Math.PI * 2; ring.push(pr(rc.x + 0.75 * Math.cos(q2), rc.y + 0.75 * Math.sin(q2), pq.z)); }
          g.beginPath(); ring.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); g.strokeStyle = 'rgba(255,106,0,' + (1 - lit * 0.8) + ')'; g.lineWidth = Math.max(2, W * 0.003); g.stroke(); } }); });
      draws.push({ d: Math.hypot(q.x - cam.x, q.y - cam.y) - 0.01, f: function () { if (!V.labels) return; var p = pr(q.x, q.y, s.height + 0.6); g.fillStyle = COL[t]; g.font = 'bold ' + Math.round(W * 0.022) + 'px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText(t, p.x, p.y); } });
    });
    (sh.items || []).forEach(function (it) {
      if ((it.y - camY) * sign < 2) return;
      draws.push({ d: Math.hypot(it.x - cam.x, it.y - cam.y), f: function () { box(g, pr, PK.rectPoly(it.x, it.y, it.w, it.d, it.rot), it.kind === 'plants' ? 2.5 : 1.5, it.kind === 'plants' ? '#3d7a3a' : '#6c6480'); } });
    });
    PK.TABLES.forEach(function (id) { var x = sh.tables[id]; if (!x || (x.y - camY) * sign < 2) return; var f = PK.tableFoot(P, id, x, x.k);
      draws.push({ d: Math.hypot(x.x - cam.x, x.y - cam.y), f: function () { box(g, pr, f.poly, f.h, '#9a8a70'); if (V.labels) { var p = pr(x.x, x.y, f.h + 0.4); g.fillStyle = '#fff'; g.font = Math.round(W * 0.012) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(id, p.x, p.y); } } }); });
    draws.sort(function (a, b) { return b.d - a.d; }).forEach(function (x) { x.f(); });
    if (V.labels) {
      g.font = Math.round(W * 0.015) + 'px sans-serif'; g.fillStyle = '#cfc9e6';
      g.textAlign = 'left'; g.fillText(crew ? 'STAGE LEFT (D side)' : 'STAGE RIGHT (A side)', W * 0.015, H - W * 0.012);
      g.textAlign = 'right'; g.fillText(crew ? 'STAGE RIGHT (A side)' : 'STAGE LEFT (D side)', W * 0.985, H - W * 0.012);
    }
  }
  function face(g, pr, f, s, dark, t) {
    var A = art(f.id).img, iw = A.width, ih = A.height, N = 24;
    for (var i = 0; i < N; i++) {
      var u0 = i / N, u1 = (i + 1) / N, p0 = { x: f.l.x + (f.r.x - f.l.x) * u0, y: f.l.y + (f.r.y - f.l.y) * u0 }, p1 = { x: f.l.x + (f.r.x - f.l.x) * u1, y: f.l.y + (f.r.y - f.l.y) * u1 };
      var t0 = pr(p0.x, p0.y, s.height), t1 = pr(p1.x, p1.y, s.height), b0 = pr(p0.x, p0.y, 0), b1 = pr(p1.x, p1.y, 0);
      g.save(); g.beginPath(); g.moveTo(t0.x, t0.y); g.lineTo(t1.x, t1.y); g.lineTo(b1.x, b1.y); g.lineTo(b0.x, b0.y); g.closePath(); g.clip();
      var sw = iw / N, ext = 1.04;
      g.setTransform((t1.x - t0.x) / sw * ext, (t1.y - t0.y) / sw * ext, (b0.x - t0.x) / ih, (b0.y - t0.y) / ih, t0.x, t0.y);
      g.drawImage(A, Math.min(iw - sw, i * sw), 0, sw, ih, 0, 0, sw, ih);
      g.restore();
    }
    var q = [pr(f.l.x, f.l.y, s.height), pr(f.r.x, f.r.y, s.height), pr(f.r.x, f.r.y, 0), pr(f.l.x, f.l.y, 0)];
    g.beginPath(); q.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath();
    if (dark > 0.01) { g.fillStyle = 'rgba(0,0,0,' + dark + ')'; g.fill(); }
    g.strokeStyle = V.labels ? COL[t] : 'rgba(0,0,0,.6)'; g.lineWidth = V.labels ? 2 : 1; g.stroke();
  }
  function box(g, pr, poly, h, col) {      // a simple solid: its outline from this camera
    var pts = []; poly.forEach(function (p) { pts.push(pr(p.x, p.y, 0), pr(p.x, p.y, h)); });
    var hull = convex(pts); g.beginPath(); hull.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = '#000'; g.stroke();
    var top = poly.map(function (p) { return pr(p.x, p.y, h); }); g.beginPath(); top.forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.closePath(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
  }
  function convex(p) {
    p = p.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    var cr = function (o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }, lo = [], up = [];
    p.forEach(function (q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    p.slice().reverse().forEach(function (q) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function drawViews() {
    if (!document.getElementById('pkCenter')) return;
    overheadDyn(); front(document.getElementById('pkAud'), false); front(document.getElementById('pkCrew'), true);
    var sc = document.getElementById('pkScrub'); if (sc && anim) sc.value = Math.round(anim.u * 1000);
  }

  /* ---------- the page ---------- */
  function sceneSummary(sc) { return TW.map(function (t) { var f = PK.facing(P, t, sc.towers[t].rot); return (sc.towers[t].lit === 'dark' ? '<s>' : '') + f.label.replace('+', '|') + (sc.towers[t].lit === 'dark' ? '</s>' : ''); }).join(' · '); }
  function draw() {
    if (!document.getElementById('pkCenter')) return;
    var sc = scene(), checks = PK.sceneChecks(P, sc), prev = prevScene();
    var ch = prev ? PK.change(P, prev, sc) : null;
    document.getElementById('pkScenes').innerHTML = P.scenes.map(function (x, i) {
      var bad = PK.sceneChecks(P, x).some(function (m) { return m.lv === 'bad'; }) || (i && PK.change(P, P.scenes[i - 1], x).warn.some(function (m) { return m.lv === 'bad'; }));
      return '<button class="pk-sc' + (i === cur ? ' on' : '') + (x.moment ? ' moment' : '') + '" data-sc="' + i + '"><b>' + label(i) + '</b> ' + esc(x.name) + (bad ? ' <span class="pk-bad" title="Something to check">⚠</span>' : '') + '<small>' + sceneSummary(x) + '</small></button>';
    }).join('');
    document.getElementById('pkSel').innerHTML = P.scenes.map(function (x, i) { return '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + label(i) + '. ' + esc(x.name) + '</option>'; }).join('');
    document.getElementById('pkRight').innerHTML = scenePanel(sc) + (sel && TW.indexOf(sel) >= 0 ? towerPanel(sel) : sel && PK.TABLES.indexOf(sel) >= 0 ? tablePanel(sel) : sel ? itemPanel(sel) : '<p class="pk-help">Click a tower to select it. Click one of its faces (the colored edges) to turn that face to the audience. Drag a tower to move it; drag the round knob to turn it.</p>');
    document.getElementById('pkBottom').innerHTML = changePanel(ch, checks);
    document.getElementById('pkUndo').disabled = !undo.length; document.getElementById('pkRedo').disabled = !redo.length;
    document.getElementById('pkPlay').disabled = !prev && !anim;
    wirePanels();
    if (V.view === 'ledger') { var lg = document.querySelector('.pk-ledger'); if (lg) { lg.outerHTML = ledgerHtml(); document.getElementById('pkCsv').onclick = ledgerCsv; } }
    drawViews();
  }
  function scenePanel(sc) {
    var src = sc.same && P.scenes.find(function (x) { return x.id === sc.same; });
    return '<div class="pk-box"><label class="pk-f">' + (sc.moment ? 'Moment ' + label(cur) + ' (inside the scene, in full view)' : 'Scene ' + label(cur)) + '<input id="pkName" value="' + esc(sc.name) + '"></label>' +
      (sc.moment ? '<label class="pk-f">At this musical or choreographic cue<input id="pkCue" value="' + esc(sc.cue || '') + '" placeholder="e.g. after the second chorus"></label>' : '') +
      (src ? '<p class="pk-help small">🔗 Towers are identical to scene ' + label(P.scenes.indexOf(src)) + ' (' + esc(src.name) + '): changing them here changes both. <button id="pkUnlink" class="pk-mini">Unlink</button></p>' : '') +
      (cur ? '<label class="pk-f">Tables in the change into this ' + (sc.moment ? 'moment' : 'scene') + '<select id="pkOrder"><option value="T1"' + ((sc.tableOrder || 'T1') === 'T1' ? ' selected' : '') + '>Table 1 first, then Table 2</option><option value="T2"' + (sc.tableOrder === 'T2' ? ' selected' : '') + '>Table 2 first, then Table 1</option><option value="together"' + (sc.tableOrder === 'together' ? ' selected' : '') + '>Both at once</option></select></label>' : '') +
      '<label class="pk-f">Notes<textarea id="pkNotes" rows="3">' + esc(sc.notes || '') + '</textarea></label>' +
      '<div class="pk-row"><label><input type="checkbox" data-zone="hort"' + ((sc.zones || []).indexOf('hort') >= 0 ? ' checked' : '') + '> Horticulture HQ area</label><label><input type="checkbox" data-zone="nye"' + ((sc.zones || []).indexOf('nye') >= 0 ? ' checked' : '') + '> NYE karaoke area</label></div>' +
      '<div class="pk-row"><button data-add="table">+ Table</button><button data-add="plants">+ Plants</button><button data-add="prop">+ Other piece</button></div>' +
      '<div class="pk-row"><button id="pkDup">Duplicate scene</button><button id="pkUp" ' + (cur ? '' : 'disabled') + '>Move up</button><button id="pkDown"' + (cur < P.scenes.length - 1 ? '' : ' disabled') + '>Move down</button><button id="pkDel"' + (P.scenes.length > 1 ? '' : ' disabled') + '>Delete</button></div></div>';
  }
  function towerPanel(t) {
    var s = scene().towers[t], f = PK.facing(P, t, s.rot), w = winds(t);
    var opts = [t + '1', t + '2', t + '3'].map(function (id) { return '<option value="' + id + '"' + (f.label === id ? ' selected' : '') + '>Flat: ' + id + ' ' + esc(PK.SHORT[id]) + '</option>'; });
    [[1, 2], [2, 3], [1, 3]].forEach(function (p) { var want = t + p[0] + '+' + t + p[1], r = PK.rotFor(P, t, want); opts.push('<option value="' + want + '"' + (f.kind === 'point' && f.faces.slice().sort().join('+') === want ? ' selected' : '') + '>Point: ' + r.left + ' (left) | ' + r.right + ' (right)</option>'); });
    if (f.kind === 'angled') opts.unshift('<option selected>Angled ' + Math.round(s.rot) + '°: ' + esc(f.label) + '</option>');
    var seg = function (k, vals, names) { return '<div class="pk-seg">' + vals.map(function (v, i) { return '<button data-' + k + '="' + v + '"' + (s[k] === v ? ' class="on"' : '') + '>' + names[i] + '</button>'; }).join('') + '</div>'; };
    return '<div class="pk-box" style="border-color:' + COL[t] + '"><h3 style="color:' + COL[t] + '">Tower ' + t + '</h3>' +
      '<p class="pk-help">The audience sees: <b>' + (f.kind === 'flat' ? f.faces[0] + ' (flat)' : f.kind === 'point' ? f.faces[0] + ' on the left, ' + f.faces[1] + ' on the right (point)' : esc(f.label)) + '</b></p>' +
      '<label class="pk-f">Facing<select id="pkWant">' + opts.join('') + '</select></label>' +
      '<div class="pk-row"><button data-turn="60" title="Q">⟲ 60°</button><button data-turn="-60" title="E">⟳ 60°</button><button data-turn="120" title="Shift+Q">⟲ 120°</button><button data-turn="-120" title="Shift+E">⟳ 120°</button></div>' +
      '<p class="pk-help small">⟲ ⟳ = counterclockwise / clockwise as seen from above. In your triangle diagram: <b>' + PK.diagramAngle(P, t, s.rot) + '°</b> (0° = ' + t + '2 flat to the audience, counting ' + (P.diagram && P.diagram.dir === 'ccw' ? 'counterclockwise' : 'clockwise') + ').</p>' +
      '<div class="pk-row"><label class="pk-f half">Across (− = stage right)<input id="pkX" value="' + PK.ft(s.x) + '"></label><label class="pk-f half">Up/downstage of PL (− = downstage)<input id="pkY" value="' + PK.ft(s.y) + '"></label></div>' +
      '<div class="pk-f">Light' + seg('lit', ['full', 'low', 'dark'], ['Full', 'Low', 'Dark']) + '</div>' +
      '<div class="pk-f">Part in the scene' + seg('role', ['featured', 'supporting', 'masking'], ['Featured', 'Supporting', 'Masking / dark']) + '</div>' +
      '<div class="pk-f">Wheels' + seg('lock', [true, false], ['Locked', 'Rolling']) + '</div>' +
      '<details' + ([1, 2, 3].some(function (k) { return (art(t + k).versions || []).length > 1; }) ? ' open' : '') + '><summary>Faces on ' + t + '</summary><ul class="pk-faces">' + [1, 2, 3].map(function (k) { var A = art(t + k), id = t + k;
        return '<li><b>' + id + '</b> ' + esc(PK.FACES[id]) + (A.real && /concept/.test(A.file || '') ? ' <i>(concept stand-in until your final arrives)</i>' : '') + (A.real ? (A.off ? ' <b class="pk-bad">⚠ this picture is ' + (Math.round(A.ratio * 100) / 100) + ' : 1, not 1:2; shown without stretching. Re-export it at 1:2 (e.g. 1200 × 2400).</b>' : '') : ' <i>(placeholder art)</i>') + ((A.versions || []).length > 1 ? '<br>Version <select data-art="' + id + '">' + A.versions.map(function (f, i) { return '<option value="' + esc(f) + '"' + (f === A.file ? ' selected' : '') + '>' + (i + 1) + ': ' + esc(f.replace(PK.FILES[id], '').replace(/^-/, '').replace(/\.\w+$/, '') || 'main') + '</option>'; }).join('') + '</select>' : '') + '</li>'; }).join('') + '</ul>' +
      '<p class="pk-help small">Face order around ' + t + ': ' + (w ? '1 → 2 → 3 go <b>' + w + '</b> seen from above (confirmed).' : 'taken from your triangle diagram (' + (P.towers[t].wind === 'cw' ? 'clockwise' : 'counterclockwise') + '); not checked on the real tower yet. Confirm it in Stage & towers.') + '</p></details></div>';
  }
  function tablePanel(id) {
    var ts = scene().tables[id], spec = P.tables[id], f = PK.tableFoot(P, id, ts);
    return '<div class="pk-box" style="border-color:#c9b48a"><h3 style="color:#e6d3a8">' + esc(spec.name) + '</h3>' +
      '<label class="pk-f">In this scene<select id="pkTState">' + Object.keys(PK.TSTATE).map(function (k) { return '<option value="' + k + '"' + (ts.state === k ? ' selected' : '') + '>' + PK.TSTATE[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="pk-f">Spike preset<select id="pkTSpike"><option value="">(none)</option>' + Object.keys(P.spikes || {}).map(function (k) { return '<option value="' + k + '"' + (ts.spike === k ? ' selected' : '') + '>' + esc(k) + ': ' + esc(P.spikes[k].note || '') + '</option>'; }).join('') + '</select></label>' +
      (ts.spike ? '<p class="pk-help small">On ' + esc(ts.spike) + ' (' + esc(P.spikes[ts.spike].tape) + ' tape, arrow and table number). Moving it here moves that spike in every scene that uses it.</p>' : '') +
      '<label class="pk-f">Storage area<select id="pkTZone"><option value="">(not in a storage area)</option>' + (P.storage || []).map(function (z) { return '<option value="' + z.id + '"' + (ts.zone === z.id ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="pk-row"><label class="pk-f half">Across (− = stage right)<input id="pkTX" value="' + PK.ft(ts.x) + '"></label><label class="pk-f half">Up/downstage of PL<input id="pkTY" value="' + PK.ft(ts.y) + '"></label></div>' +
      '<div class="pk-row"><button id="pkTRot" title="R">Turn 90°</button>' + (cur ? '<button id="pkTPrev">Same spot as the scene before</button>' : '') + '</div>' +
      (cur ? '<div class="pk-f">Route into this scene: <b>' + (ts.via && ts.via.length ? 'your own (' + ts.via.length + ' bend' + (ts.via.length === 1 ? '' : 's') + ', drag the dots)' : 'automatic') + '</b><div class="pk-row"><button id="pkWpAdd">+ Add a bend</button>' + (ts.via && ts.via.length ? '<button id="pkWpDel">Remove last bend</button><button id="pkWpAuto">Automatic route</button>' : '') + '</div></div>' : '') +
      '<p class="pk-help small">Footprint now: ' + PK.ft(f.l) + ' × ' + PK.ft(f.w) + (ts.state === 'deployed' ? ' open' : ' folded') + '. Enters through the ' + (spec.gap === 'CD' ? 'C–D' : 'A–B') + ' opening.' + (spec.stand.open || spec.stand.folded ? ' <b>Sizes are stand-ins until measured</b> (⚙ Equipment).' : '') + '</p></div>';
  }
  function itemPanel(id) {
    var it = (scene().items || []).find(function (x) { return x.id === id; }); if (!it) return '';
    return '<div class="pk-box"><h3>' + esc(it.name) + '</h3><label class="pk-f">Name<input id="pkIName" value="' + esc(it.name) + '"></label>' +
      '<div class="pk-row"><label class="pk-f half">Width<input id="pkIW" value="' + PK.ft(it.w) + '"></label><label class="pk-f half">Depth<input id="pkID" value="' + PK.ft(it.d) + '"></label></div>' +
      '<div class="pk-row"><button id="pkIRot">Turn 90°</button><button id="pkIDel">Remove</button></div></div>';
  }
  function changePanel(ch, checks) {
    var crewN = P.crew || 4, out = [];
    var list = (ch ? ch.warn : []).concat(checks.filter(function (m) { return m.lv !== 'info' || sel && m.t.indexOf(sel) >= 0 || m.turn; }));
    if (!ch) out.push('<p class="pk-help">This is the first scene: what the audience sees when the show starts (the preset).</p>');
    else {
      var prev = prevScene(), moved = ch.moves.filter(function (m) { return m.dist || m.turn; });
      out.push('<h3>Change into ' + (scene().moment ? 'moment ' : 'scene ') + label(cur) + ' (from ' + label(cur - 1) + '. ' + esc(prev.name) + ')</h3><div class="pk-row"><span>This change is</span><div class="pk-seg"><button data-status="proposed"' + (scene().status !== 'tested' ? ' class="on"' : '') + '>Proposed (on paper)</button><button data-status="tested"' + (scene().status === 'tested' ? ' class="on"' : '') + '>Tested on the real stage</button></div></div>');
      out.push('<table class="pk-tab"><tr><th>Tower</th><th>Was showing</th><th>Now showing</th><th>Travel</th><th>Turn</th></tr>' + ch.moves.map(function (m) {
        var w = winds(m.t), dirW = !m.turn ? '' : w ? (m.turn > 0 ? ' counterclockwise' : ' clockwise') + ' from above' : ' <span class="pk-dim">(direction waits for the face order)</span>';
        return '<tr' + (m.dist || m.turn ? '' : ' class="pk-dim"') + '><td style="color:' + COL[m.t] + '"><b>' + m.t + '</b></td><td>' + m.fromFace.replace('+', ' | ') + '</td><td>' + m.toFace.replace('+', ' | ') + '</td><td>' + (m.dist ? PK.ft(m.dist) : 'stays') + '</td><td>' + (m.turn ? Math.abs(Math.round(m.turn)) + '°' + dirW : 'no turn') + '</td></tr>';
      }).join('') + '</table>');
      if (ch.tmoves.length) out.push('<table class="pk-tab"><tr><th>Table</th><th>Was</th><th>Now</th><th>Route</th><th>Steps</th></tr>' + ch.tmoves.map(function (m) {
        var spec = P.tables[m.id], inView = m.from.state === 'deployed' && m.to.state === 'deployed' && m.dist, tr = Math.abs(Math.round(PK.norm(m.to.rot - m.from.rot)));
        var steps = inView ? ['students clear the table and its path', 'release', 'roll ' + PK.ft(m.dist), tr ? 'turn ' + tr + '°' : '', 'onto ' + (m.to.spike || 'its spike'), 'secure and check it is stable'].filter(Boolean)
          : [m.fold ? 'clear performers, fold, secure' : '', m.dist ? 'roll ' + PK.ft(m.dist) + (m.via ? ' through the ' + m.via.split('').join('–') + ' opening' : '') : '', m.open ? 'unfold, lock, secure' : ''].filter(Boolean);
        return '<tr' + (steps.length ? '' : ' class="pk-dim"') + '><td><b>' + esc(spec.name) + '</b></td><td>' + PK.TSTATE[m.from.state] + '</td><td>' + PK.TSTATE[m.to.state] + '</td><td>' + (m.dist ? PK.ft(m.dist) : 'stays') + '</td><td>' + (steps.join(', then ') || '—') + (spec.crew > 1 && steps.length ? ' <span class="pk-dim">(' + spec.crew + ' people' + (spec.stand.crew ? ', stand-in' : '') + ')</span>' : '') + '</td></tr>';
      }).join('') + '</table>');
      out.push('<p class="pk-help">' + moved.length + ' of 4 towers change · ' + Math.round(ch.total) + '° of turning · ' + PK.ft(ch.travel) + ' of travel. Fewest moves is not automatically best: the picture matters more.</p>');
      out.push('<div class="pk-row"><span>Crew of</span><div class="pk-seg">' + [2, 3, 4].map(function (n) { return '<button data-crew="' + n + '"' + (crewN === n ? ' class="on"' : '') + '>' + n + '</button>'; }).join('') + '</div></div>');
      out.push('<ul class="pk-crew">' + PK.crewJobs(P, ch, crewN).map(function (c) {
        var jobs = c.jobs.map(function (m) { return m.t + ': ' + [m.dist ? 'roll ' + PK.ft(m.dist) : '', m.turn ? 'turn ' + Math.abs(Math.round(m.turn)) + '° to ' + m.toFace.replace('+', ' | ') : ''].filter(Boolean).join(', then '); })
          .concat(c.tjobs.map(function (m) { return P.tables[m.id].name + ': ' + (m.open ? 'bring in and unfold' : m.fold ? 'fold and take out' : 'move'); }));
        return '<li><b>' + c.name + '</b> (' + c.towers.map(function (x) { return P.tables[x] ? P.tables[x].name : x; }).join(' + ') + '): ' + (jobs.join('; ') || 'nothing this change') + '</li>';
      }).join('') + '</ul>');
    }
    var bad = list.filter(function (m) { return m.lv === 'bad'; }).length;
    out.unshift('<p class="pk-ready ' + (bad ? 'no' : 'yes') + '">' + (bad ? '⚠ ' + label(cur) + ' is not ready: ' + bad + ' thing' + (bad === 1 ? '' : 's') + ' to fix below.' : '✓ ' + label(cur) + ': no clashes found by the checks.') + '</p>');
    if (list.length) out.push('<ul class="pk-warn">' + list.map(function (m) { return '<li class="' + m.lv + '">' + (m.lv === 'bad' ? '⚠ ' : 'ⓘ ') + esc(m.msg) + '</li>'; }).join('') + '</ul>');
    out.push('<p class="pk-help small">Checks are advice from simple geometry, not proof: test every change on the real stage.</p>');
    return out.join('');
  }
  function wirePanels() {
    var $ = function (id) { return document.getElementById(id); }, sc = scene();
    app.querySelectorAll('[data-sc]').forEach(function (b) { b.onclick = function () { stop(); cur = +b.dataset.sc; draw(); }; });
    var nm = $('pkName'); if (nm) nm.onchange = function () { snap(); sc.name = nm.value.trim() || sc.name; changed(); };
    if ($('pkCue')) $('pkCue').onchange = function () { snap(); sc.cue = this.value.trim(); changed(); };
    if ($('pkUnlink')) $('pkUnlink').onclick = function () { snap(); delete sc.same; changed(); };
    if ($('pkOrder')) $('pkOrder').onchange = function () { snap(); sc.tableOrder = this.value; stop(); changed(); };
    var nt = $('pkNotes'); if (nt) nt.onchange = function () { snap(); sc.notes = nt.value; changed(); };
    app.querySelectorAll('[data-zone]').forEach(function (cb) { cb.onchange = function () { snap(); var z = sc.zones = (sc.zones || []).filter(function (x) { return x !== cb.dataset.zone; }); if (cb.checked) z.push(cb.dataset.zone); changed(); }; });
    app.querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () {
      snap(); var k = b.dataset.add, it = { id: 'i' + Math.random().toString(36).slice(2, 7), kind: k, name: k === 'table' ? 'Folding table' : k === 'plants' ? 'Plants' : 'Set piece', x: 0, y: -8, w: k === 'table' ? 6 : 3, d: k === 'table' ? 2.5 : 2, rot: 0 };
      (sc.items = sc.items || []).push(it); sel = it.id; changed(); }; });
    if ($('pkDup')) $('pkDup').onclick = function () { snap(); var c = JSON.parse(JSON.stringify(sc)); c.id = 's' + Date.now().toString(36); c.name += ' (copy)'; P.scenes.splice(cur + 1, 0, c); cur++; changed(); };
    if ($('pkUp')) $('pkUp').onclick = function () { snap(); P.scenes.splice(cur - 1, 0, P.scenes.splice(cur, 1)[0]); cur--; changed(); };
    if ($('pkDown')) $('pkDown').onclick = function () { snap(); P.scenes.splice(cur + 1, 0, P.scenes.splice(cur, 1)[0]); cur++; changed(); };
    if ($('pkDel')) $('pkDel').onclick = function () { if (!confirm('Delete scene ' + (cur + 1) + ', ' + sc.name + '? (Undo brings it back.)')) return; snap(); P.scenes.splice(cur, 1); cur = Math.min(cur, P.scenes.length - 1); changed(); };
    if (sel && TW.indexOf(sel) >= 0) {
      var t = sel, s = sc.towers[t];
      $('pkWant').onchange = function () { if (!/^[A-D]\d/.test(this.value)) return; snap(); setWant(t, this.value); changed(); };
      app.querySelectorAll('[data-turn]').forEach(function (b) { b.onclick = function () { snap(); setRot(t, s.rot + +b.dataset.turn); changed(); }; });
      var pos = function (id, k) { $(id).onchange = function () { var v = PK.parseFt(this.value); if (v == null) { T.toast('Type feet and inches, like 7\' 6"'); return draw(); } snap(); s[k] = v; changed(); }; };
      pos('pkX', 'x'); pos('pkY', 'y');
      app.querySelectorAll('[data-art]').forEach(function (x) { x.onchange = function () { snap(); P.art = P.art || {}; P.art[x.dataset.art] = x.value; delete ART[x.dataset.art]; art(x.dataset.art); changed(); }; });
      ['lit', 'role', 'lock'].forEach(function (k) { app.querySelectorAll('[data-' + k + ']').forEach(function (b) { b.onclick = function () { snap(); var v = b.dataset[k]; s[k] = k === 'lock' ? v === 'true' : v; changed(); }; }); });
    } else if (sel && PK.TABLES.indexOf(sel) >= 0) {
      var tb = sc.tables[sel], tid = sel;
      $('pkTState').onchange = function () { snap(); tb.state = this.value; if (tb.state !== 'deployed') delete tb.spike; changed(); };
      $('pkTSpike').onchange = function () { snap(); if (this.value) { var sp = P.spikes[this.value][tid]; tb.spike = this.value; tb.state = 'deployed'; tb.x = sp.x; tb.y = sp.y; tb.rot = sp.rot; tb.zone = ''; } else delete tb.spike; changed(); };
      $('pkTZone').onchange = function () { snap(); tb.zone = this.value; delete tb.spike; var z = (P.storage || []).find(function (q) { return q.id === tb.zone; }); if (z) { tb.x = z.x; tb.y = z.y; if (tb.state === 'deployed') tb.state = 'stored'; } changed(); };
      var tpos = function (id, k) { $(id).onchange = function () { var v = PK.parseFt(this.value); if (v == null) return draw(); snap(); tb[k] = v; changed(); }; };
      tpos('pkTX', 'x'); tpos('pkTY', 'y');
      $('pkTRot').onclick = function () { snap(); tb.rot = ((tb.rot || 0) + 90) % 360; changed(); };
      if ($('pkWpAdd')) $('pkWpAdd').onclick = function () {
        snap(); var ch = PK.change(P, P.scenes[cur - 1], sc).tmoves.find(function (m) { return m.id === tid; }), r = ch.route;
        if (!tb.via || !tb.via.length) tb.via = r.slice(1, -1).map(function (q) { return { x: q.x, y: q.y }; });      // start from the automatic route
        var pts = [P.scenes[cur - 1].tables[tid]].concat(tb.via, [tb]), best = 0, bl = -1;
        for (var i = 1; i < pts.length; i++) { var L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (L > bl) { bl = L; best = i; } }
        tb.via.splice(best - 1, 0, { x: Math.round((pts[best].x + pts[best - 1].x)) / 2, y: Math.round((pts[best].y + pts[best - 1].y)) / 2 }); changed(); };
      if ($('pkWpDel')) $('pkWpDel').onclick = function () { snap(); tb.via.pop(); if (!tb.via.length) delete tb.via; changed(); };
      if ($('pkWpAuto')) $('pkWpAuto').onclick = function () { snap(); delete tb.via; changed(); };
      if ($('pkTPrev')) $('pkTPrev').onclick = function () { snap(); sc.tables[tid] = JSON.parse(JSON.stringify(P.scenes[cur - 1].tables[tid])); changed(); };
    } else if (sel) {
      var it = (sc.items || []).find(function (x) { return x.id === sel; });
      if (it) {
        $('pkIName').onchange = function () { snap(); it.name = this.value.trim() || it.name; changed(); };
        $('pkIW').onchange = function () { var v = PK.parseFt(this.value); if (v > 0) { snap(); it.w = v; changed(); } };
        $('pkID').onchange = function () { var v = PK.parseFt(this.value); if (v > 0) { snap(); it.d = v; changed(); } };
        $('pkIRot').onclick = function () { snap(); it.rot = ((it.rot || 0) + 90) % 180; changed(); };
        $('pkIDel').onclick = function () { snap(); sc.items = sc.items.filter(function (x) { return x !== it; }); sel = null; changed(); };
      }
    }
    app.querySelectorAll('[data-status]').forEach(function (b) { b.onclick = function () { snap(); sc.status = b.dataset.status; changed(); }; });
    app.querySelectorAll('[data-crew]').forEach(function (b) { b.onclick = function () { snap(); P.crew = +b.dataset.crew; changed(); }; });
  }

  /* ---------- playing a change ---------- */
  function duration(ch) {
    var each = ch.moves.map(function (m) { var a = m.dist / 1.2, b = Math.abs(m.turn) / 40; return P.turnWhen === 'during' ? Math.max(a, b) : a + b; });
    return Math.max(2, Math.max.apply(null, each) + 0.6);
  }
  function play() {
    if (anim && !anim.playing) { anim.playing = true; anim.last = 0; requestAnimationFrame(tick); return setPlayBtn(); }
    if (anim) { anim.playing = false; return setPlayBtn(); }
    if (!cur) return;
    var ch = PK.change(P, P.scenes[cur - 1], scene());
    anim = { from: cur - 1, to: cur, ch: ch, u: 0, playing: true, dur: duration(ch), last: 0 };
    setPlayBtn(); requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!anim || !anim.playing) return;
    if (anim.last) anim.u = Math.min(1, anim.u + (now - anim.last) / 1000 * V.speed / anim.dur);
    anim.last = now; drawViews();
    if (anim.u >= 1) { if (V.loop) { anim.u = 0; anim.last = 0; setTimeout(function () { if (anim) requestAnimationFrame(tick); }, 700); return; } anim.playing = false; setPlayBtn(); setTimeout(function () { if (anim && !anim.playing && anim.u >= 1) stop(); }, 900); return; }
    requestAnimationFrame(tick);
  }
  function stop() { if (!anim) return; anim = null; setPlayBtn(); draw(); }
  function setPlayBtn() { var b = document.getElementById('pkPlay'); if (b) b.textContent = anim && anim.playing ? '❚❚ Pause' : anim ? '▶ Resume' : '▶ Play the change'; var s = document.getElementById('pkScrub'); if (s) s.value = anim ? Math.round(anim.u * 1000) : 1000; }

  /* ---------- pointer: select, drag, turn ---------- */
  function svgPt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x, y: -q.y }; }
  var box0 = null;
  function setBox(b) { svg.setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h); }
  function getBox() { var v = svg.viewBox.baseVal; return { x: v.x, y: v.y, w: v.width, h: v.height }; }
  function wirePointer() {
    var drag = null; box0 = getBox();
    if (V.box) setBox(V.box);
    svg.addEventListener('wheel', function (e) {      // zoom around the pointer
      e.preventDefault(); var b = getBox(), p = svgPt(e), k = Math.exp(e.deltaY * 0.0015), w = Math.max(8, Math.min(box0.w * 1.2, b.w * k)), f = w / b.w;
      V.box = { x: p.x - (p.x - b.x) * f, y: -p.y - (-p.y - b.y) * f, w: w, h: b.h * f }; setBox(V.box);
    }, { passive: false });
    svg.addEventListener('pointerdown', function (e) {
      stop();
      var el = e.target, tbEl = el.closest('[data-table]'), tEl = el.closest('[data-t]'), knob = el.dataset.knob, faceId = el.dataset.face, itEl = el.closest('[data-item]'), p = svgPt(e), sc = scene();
      if (el.dataset.wp != null && PK.TABLES.indexOf(sel) >= 0) drag = { kind: 'item', it: sc.tables[sel].via[+el.dataset.wp], dx: 0, dy: 0, x0: e.clientX, y0: e.clientY, wp: true };
      else if (knob) drag = { kind: 'turn', t: knob };
      else if (tbEl) { sel = tbEl.dataset.table; var tq = sc.tables[sel]; drag = { kind: 'item', it: tq, table: true, dx: tq.x - p.x, dy: tq.y - p.y, x0: e.clientX, y0: e.clientY }; }
      else if (tEl) { sel = tEl.dataset.t; var s = sc.towers[sel]; drag = { kind: 'move', t: sel, dx: s.x - p.x, dy: s.y - p.y, face: faceId, x0: e.clientX, y0: e.clientY }; }
      else if (itEl) { sel = itEl.dataset.item; var it = sc.items.find(function (x) { return x.id === sel; }); drag = { kind: 'item', it: it, dx: it.x - p.x, dy: it.y - p.y, x0: e.clientX, y0: e.clientY }; }
      else { drag = { kind: 'pan', x0: e.clientX, y0: e.clientY, b: getBox(), sx: svg.getScreenCTM().a }; svg.setPointerCapture(e.pointerId); return; }
      drag.snapped = false; svg.setPointerCapture(e.pointerId); draw(); e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (drag.kind === 'pan') { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5 && !drag.moving) return; drag.moving = true;
        V.box = { x: drag.b.x - (e.clientX - drag.x0) / drag.sx, y: drag.b.y - (e.clientY - drag.y0) / drag.sx, w: drag.b.w, h: drag.b.h }; setBox(V.box); return; }
      var p = svgPt(e), sc = scene(), g = e.altKey ? 0 : st().grid, rd = function (v) { return g ? Math.round(v / g) * g : Math.round(v * 100) / 100; };
      if ((drag.kind === 'move' || drag.kind === 'item') && !drag.moving && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      if (!drag.snapped) { snap(); drag.snapped = true; }
      if (drag.kind === 'turn') { var s = sc.towers[drag.t], a = Math.atan2(p.x - s.x, -(p.y - s.y)) * 180 / Math.PI; if (!e.altKey) a = Math.round(a / 30) * 30; setRot(drag.t, a); }
      else if (drag.kind === 'move') { drag.moving = true; var q = sc.towers[drag.t]; q.x = rd(p.x + drag.dx); q.y = rd(p.y + drag.dy); }
      else { drag.moving = true; drag.it.x = rd(p.x + drag.dx); drag.it.y = rd(p.y + drag.dy); if (drag.table) drag.it.zone = ''; }
      if (drag.wp) { draw(); return; }
      drawViews();
    });
    var end = function () {
      if (!drag) return; var d = drag; drag = null;
      if (d.kind === 'pan') { if (!d.moving) { sel = null; draw(); } return; }
      if (d.kind === 'move' && !d.moving && d.face) {      // a click on a face: turn it to the audience
        var s = scene().towers[d.t], f = PK.facing(P, d.t, s.rot);
        if (!(f.kind === 'flat' && f.faces[0] === d.face)) { snap(); setWant(d.t, d.face); changed(); return; }
      }
      if (d.snapped) changed(); else draw();
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  }
  function keys(e) {
    if (!document.getElementById('pkCenter')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    var k = e.key, sc = scene(), mod = e.metaKey || e.ctrlKey;
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); stop(); step(!e.shiftKey); return; }
    if (mod) return;
    if (k === '[' || k === ']') { stop(); cur = Math.max(0, Math.min(P.scenes.length - 1, cur + (k === ']' ? 1 : -1))); draw(); return; }
    if (k === ' ') { e.preventDefault(); play(); return; }
    if (k === 'Tab') { e.preventDefault(); sel = TW[(TW.indexOf(sel) + (e.shiftKey ? 3 : 1)) % 4] || 'A'; draw(); return; }
    if (k === 'Escape') { sel = null; draw(); return; }
    if (sel && PK.TABLES.indexOf(sel) >= 0 && k.toLowerCase() === 'r') { snap(); sc.tables[sel].rot = ((sc.tables[sel].rot || 0) + 90) % 360; changed(); return; }
    if (!sel || TW.indexOf(sel) < 0) return;
    var s = sc.towers[sel], g = st().grid * (e.shiftKey ? 4 : 1);
    var nudge = { ArrowLeft: [-g, 0], ArrowRight: [g, 0], ArrowUp: [0, g], ArrowDown: [0, -g] }[k];
    if (nudge) { e.preventDefault(); stop(); snap(); s.x += nudge[0]; s.y += nudge[1]; changed(); return; }
    if (/^[qe]$/i.test(k)) { stop(); snap(); setRot(sel, s.rot + (k.toLowerCase() === 'q' ? 1 : -1) * (e.shiftKey ? 120 : 60)); changed(); return; }
    if (/^[123]$/.test(k)) { stop(); snap(); setWant(sel, sel + k); changed(); return; }
    if (k.toLowerCase() === 'l') { snap(); s.lit = s.lit === 'full' ? 'low' : s.lit === 'low' ? 'dark' : 'full'; changed(); }
  }

  /* ---------- Stage & towers settings, export, import ---------- */
  function settings() {
    var s = st(), F = [['prosc', 'Proscenium opening (wall to wall)'], ['curtain', 'Main curtain (grand drape): upstage of PL'], ['apron', 'Deck depth at center: PL to the curved front edge'], ['edgeSide', 'Deck depth at the proscenium walls'],
      ['sideDeck', 'Side decks past each proscenium wall (Horticulture HQ / NYE)'], ['wing', 'Wing space behind each wall'], ['face', 'Tower face width'], ['height', 'Tower height'], ['grid', 'Snap grid'], ['clear', 'Gap to keep (towers, drape)'], ['house', 'Audience view: seat distance in front of the front edge'], ['crew', 'Crew view: distance upstage of the drape']];
    T.dialog('<h2>Stage & towers</h2><p class="muted small">Feet and inches, like 25\' 6". Placeholders are marked; type over them when you have the real numbers.</p>' +
      F.map(function (f) { return '<label class="f">' + f[1] + (s.placeholder && s.placeholder[f[0]] ? ' <i>(placeholder)</i>' : '') + '<input data-st="' + f[0] + '" value="' + PK.ft(s[f[0]]) + '"></label>'; }).join('') +
      '<h3>Face order on each tower</h3><p class="muted small">Look down on the tower from above: do faces 1 → 2 → 3 go clockwise or counterclockwise? This decides which face shows on the left in a point and which way each turn goes. Until you tick "confirmed", the planner never names a turning direction.</p>' +
      TW.map(function (t) { var w = P.towers[t]; return '<div class="row"><b style="min-width:2em">' + t + '</b><select data-wind="' + t + '"><option value="ccw"' + (w.wind !== 'cw' ? ' selected' : '') + '>counterclockwise</option><option value="cw"' + (w.wind === 'cw' ? ' selected' : '') + '>clockwise</option></select><label><input type="checkbox" data-conf="' + t + '"' + (w.confirmed ? ' checked' : '') + '> confirmed</label></div>'; }).join('') +
      '<h3>Your triangle diagram</h3><p class="muted small">0° = face 2 flat to the audience. Its angles count: <select id="stDiag"><option value="cw"' + (P.diagram && P.diagram.dir === 'ccw' ? '' : ' selected') + '>clockwise</option><option value="ccw"' + (P.diagram && P.diagram.dir === 'ccw' ? ' selected' : '') + '>counterclockwise</option></select> (seen from above). Each tower shows its angle in these numbers.</p>' +
      '<div class="row" style="margin-top:14px"><button class="btn primary" id="stOk">Save</button><button class="btn" id="stNo">Cancel</button><button class="btn" id="stReset">Start over with the 17-scene library…</button></div>', function (d) {
      d.querySelector('#stNo').onclick = function () { d.close(); };
      d.querySelector('#stReset').onclick = function () { if (!confirm('Replace every scene with the starting 17-scene library? (Undo brings yours back.)')) return; snap(); P.spikes = PK.spikeDefaults(P); P.scenes = PK.library(P); cur = 0; sel = null; d.close(); rebuild(); changed(); };
      d.querySelector('#stOk').onclick = function () {
        snap();
        d.querySelectorAll('[data-st]').forEach(function (i) { var v = PK.parseFt(i.value), k = i.dataset.st; if (v != null && v >= 0 && Math.abs(v - s[k]) > 1e-6) { s[k] = v; if (s.placeholder) delete s.placeholder[k]; } });
        d.querySelectorAll('[data-wind]').forEach(function (x) { var t = x.dataset.wind; if (P.towers[t].wind !== x.value) { P.towers[t].wind = x.value; PK.rewind(P, t); } });
        d.querySelectorAll('[data-conf]').forEach(function (x) { P.towers[x.dataset.conf].confirmed = x.checked; });
        P.diagram = { dir: d.querySelector('#stDiag').value, confirmed: true };
        d.close(); rebuild(); changed();
      };
    });
  }
  /* the equipment panel: real measurements go here as they come in (nothing is made up: unmeasured values say "stand-in") */
  function equipment() {
    var inp = function (k, v, stand) { return '<input data-eq="' + k + '" value="' + (typeof v === 'number' ? PK.ft(v) : esc(v || '')) + '"' + (stand ? ' class="stand" title="stand-in until measured"' : '') + '>'; };
    var tab = PK.TABLES.map(function (id) { var t = P.tables[id], S = t.stand;
      return '<h3>' + esc(t.name) + '</h3><div class="pk-eq">' +
        '<label>Make / model' + inp(id + '.model', t.model, S.model) + '</label>' +
        '<label>Open length' + inp(id + '.open.l', t.open.l, S.open) + '</label><label>Open width' + inp(id + '.open.w', t.open.w, S.open) + '</label><label>Open height' + inp(id + '.open.h', t.open.h, S.open) + '</label>' +
        '<label>Folded length (footprint)' + inp(id + '.folded.l', t.folded.l, S.folded) + '</label><label>Folded width (footprint)' + inp(id + '.folded.w', t.folded.w, S.folded) + '</label><label>Folded height' + inp(id + '.folded.h', t.folded.h, S.folded) + '</label>' +
        '<label>Clearance all around' + inp(id + '.clear', t.clear) + '</label><label>Crew needed<input data-eq="' + id + '.crew" value="' + t.crew + '"' + (S.crew ? ' class="stand"' : '') + '></label>' +
        '<label>Seconds to unfold<input data-eq="' + id + '.openSecs" value="' + t.openSecs + '"' + (S.secs ? ' class="stand"' : '') + '></label><label>Seconds to fold<input data-eq="' + id + '.closeSecs" value="' + t.closeSecs + '"' + (S.secs ? ' class="stand"' : '') + '></label>' +
        '<label>Enters through<select data-eq="' + id + '.gap"><option value="AB"' + (t.gap === 'AB' ? ' selected' : '') + '>A–B opening</option><option value="CD"' + (t.gap === 'CD' ? ' selected' : '') + '>C–D opening</option></select></label></div>'; }).join('');
    var pr = Object.keys(P.practicals).map(function (id) { var q = P.practicals[id];
      return '<h3>' + id + ': ' + esc(q.name) + '</h3><div class="pk-eq"><label>Sticks out from the face' + inp('p.' + id + '.d', q.d, true) + '</label><label>Width' + inp('p.' + id + '.w', q.w, true) + '</label><label>Height of its middle' + inp('p.' + id + '.z', q.z, true) + '</label><label>Across the face (0 = left edge, 1 = right)<input data-eq="p.' + id + '.u" value="' + q.u + '"></label></div>'; }).join('');
    var zones = (P.storage || []).map(function (z, i) { return '<div class="pk-eq"><label>Name<input data-eq="z.' + i + '.name" value="' + esc(z.name) + '"></label><label>Kind<select data-eq="z.' + i + '.kind">' + Object.keys(PK.ZKIND).map(function (k) { return '<option value="' + k + '"' + (z.kind === k ? ' selected' : '') + '>' + PK.ZKIND[k] + '</option>'; }).join('') + '</select></label><label>What hides it (masking)<input data-eq="z.' + i + '.masking" value="' + esc(z.masking || '') + '"></label><label>Center across' + inp('z.' + i + '.x', z.x) + '</label><label>Center up/downstage' + inp('z.' + i + '.y', z.y) + '</label><label>Width' + inp('z.' + i + '.w', z.w) + '</label><label>Depth' + inp('z.' + i + '.d', z.d) + '</label></div>'; }).join('');
    T.dialog('<h2>Equipment</h2><p class="muted small">Type real measurements as you get them (feet and inches, like 2\' 6"). Yellow boxes are stand-ins, not real sizes; they are only there so the planner can draw something. Nothing here is a structural approval.</p>' + tab +
      '<h2>Physical pieces on the faces</h2><p class="muted small">Everything else on the faces is printed. The rim moves with D and its sweep is checked even when D1 faces away from the audience. Its mounting needs review by your technical theatre staff and a qualified person; the rim is a prop, not for dunking or hanging.</p>' + pr +
      '<h2>Storage areas</h2>' + zones + '<p><button class="btn" id="eqZone">+ Storage area</button></p>' +
      '<div class="row" style="margin-top:14px"><button class="btn primary" id="eqOk">Save</button><button class="btn" id="eqNo">Cancel</button></div>', function (d) {
      d.querySelector('#eqNo').onclick = function () { d.close(); };
      d.querySelector('#eqZone').onclick = function () { snap(); P.storage.push({ id: 'z' + Date.now().toString(36), name: 'New storage area', kind: 'parking', x: 0, y: -12, w: 6, d: 4, masking: '' }); d.close(); changed(); equipment(); };
      d.querySelector('#eqOk').onclick = function () {
        snap();
        d.querySelectorAll('[data-eq]').forEach(function (i) {
          var path = i.dataset.eq.split('.'), v = i.value.trim(), obj, key;
          if (path[0] === 'p') { obj = P.practicals[path[1]]; key = path[2]; }
          else if (path[0] === 'z') { obj = P.storage[+path[1]]; key = path[2]; }
          else { obj = P.tables[path[0]]; key = path[1]; if (path.length === 3) { obj = obj[path[1]]; key = path[2]; } }
          var num = key === 'u' || key === 'crew' || /Secs$/.test(key) ? parseFloat(v) : PK.parseFt(v);
          var isText = key === 'model' || key === 'name' || key === 'gap' || key === 'kind' || key === 'masking', nv = isText ? v : num;
          if (!isText && (nv == null || isNaN(nv))) return;
          if (obj[key] === nv || (!isText && Math.abs(obj[key] - nv) < 1e-6)) return;
          obj[key] = nv;
          if (P.tables[path[0]]) { var S = P.tables[path[0]].stand; if (path[1] === 'open' || path[1] === 'folded') S[path[1]] = false; else if (/Secs$/.test(key)) S.secs = false; else if (key in S) S[key] = false; }
        });
        d.close(); changed();
      };
    });
  }
  function exportJson() {
    var b = new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'periaktoi-plan-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }
  function importJson(file) {
    file.text().then(function (txt) {
      var x = JSON.parse(txt); if (!x || !x.scenes || !x.stage || !x.towers) throw new Error('That file is not a periaktoi plan.');
      snap(); P = x; cur = 0; sel = null; rebuild(); changed(); T.toast('Plan loaded (Undo goes back)');
    }).catch(function (e) { T.toast(e.message || 'That file could not be read.', 4000); });
  }

  /* ---------- the 17-scene ledger and the preliminary movement score ---------- */
  function ledgerRows() {
    return P.scenes.map(function (sc, i) {
      var ch = i ? PK.change(P, P.scenes[i - 1], sc) : null, bad = PK.sceneChecks(P, sc).concat(ch ? ch.warn : []).filter(function (m) { return m.lv === 'bad'; }).length;
      var tw = TW.map(function (t) { var q = sc.towers[t]; return { t: t, face: PK.facing(P, t, q.rot).label.replace('+', ' | '), at: PK.ft(q.x) + ', ' + PK.ft(q.y), lit: q.lit, lock: q.lock ? 'locked' : 'rolling' }; });
      var tb = PK.TABLES.map(function (id) { var q = sc.tables[id]; return { id: id, state: PK.TSTATE[q.state], at: PK.ft(q.x) + ', ' + PK.ft(q.y), zone: ((P.storage || []).find(function (z) { return z.id === q.zone; }) || {}).name || '', route: q.via && q.via.length ? 'own route' : 'automatic route', spike: q.spike || '' }; });
      var score = ch ? PK.crewJobs(P, ch, P.crew || 4).filter(function (c) { return c.jobs.length || c.tjobs.length; }).map(function (c) {
        return c.name + ': ' + c.jobs.map(function (m) { return m.t + ' ' + [m.dist ? 'roll ' + PK.ft(m.dist) : '', m.turn ? 'turn ' + Math.abs(Math.round(m.turn)) + '° to ' + m.toFace.replace('+', ' | ') : ''].filter(Boolean).join(', then '); })
          .concat(c.tjobs.map(function (m) { return P.tables[m.id].name + ' ' + (m.open ? 'in and unfold' : m.fold ? 'fold and out' : 'move'); })).join('; ');
      }) : [];
      return { n: i + 1, sc: sc, tw: tw, tb: tb, items: (sc.items || []).map(function (x) { return x.name; }), bad: bad, score: score, status: sc.status === 'tested' ? 'tested on stage' : 'proposed' };
    });
  }
  function ledgerHtml() {
    var rows = ledgerRows();
    return '<div class="pk-view pk-ledger"><div class="pk-vt">Every scene: where every tower and table is (proposed until tested on the real stage; sizes marked stand-in are not measured)</div><div class="pk-row" style="padding:6px 10px"><button id="pkCsv">Download the ledger (spreadsheet)</button><span class="pk-help small">Crew of ' + (P.crew || 4) + ' (change it under any scene change).</span></div>' +
      '<table class="pk-tab"><tr><th>#</th><th>Scene</th>' + TW.map(function (t) { return '<th style="color:' + COL[t] + '">' + t + '</th>'; }).join('') + '<th>Table 1</th><th>Table 2</th><th>Change into it: preliminary movement score</th><th>Status</th></tr>' +
      rows.map(function (r) {
        return '<tr' + (r.sc.moment ? ' class="pk-moment"' : '') + '><td>' + label(r.n - 1) + '</td><td><b>' + esc(r.sc.name) + '</b>' + (r.items.length ? '<br><span class="pk-dim">' + esc(r.items.join(', ')) + '</span>' : '') + '</td>' +
          r.tw.map(function (x) { return '<td>' + x.face + '<br><span class="pk-dim">' + x.at + ' · ' + x.lit + '</span></td>'; }).join('') +
          r.tb.map(function (x) { return '<td>' + x.state + '<br><span class="pk-dim">' + (x.spike ? esc(x.spike) : x.zone ? esc(x.zone) : x.at) + '</span></td>'; }).join('') +
          '<td>' + (r.score.length ? r.score.map(esc).join('<br>') : r.n === 1 ? 'Preset' : '<span class="pk-dim">nothing moves</span>') + '</td><td>' + r.status + (r.bad ? '<br><span class="pk-bad">⚠ ' + r.bad + ' to fix</span>' : '') + '</td></tr>';
      }).join('') + '</table></div>';
  }
  function ledgerCsv() {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, lines = [];
    lines.push(['Scene', 'Name'].concat([].concat.apply([], TW.map(function (t) { return [t + ' showing', t + ' position (across, up/downstage)', t + ' light', t + ' wheels']; })), ['Table 1', 'Table 1 position', 'Table 1 storage', 'Table 1 route', 'Table 2', 'Table 2 position', 'Table 2 storage', 'Table 2 route', 'Other pieces', 'Movement score (change into this scene)', 'Status', 'Problems found', 'Notes']).map(q).join(','));
    ledgerRows().forEach(function (r) {
      lines.push([label(r.n - 1), r.sc.name + (r.sc.cue ? ' (at: ' + r.sc.cue + ')' : '')].concat([].concat.apply([], r.tw.map(function (x) { return [x.face, x.at, x.lit, x.lock]; })), [].concat.apply([], r.tb.map(function (x) { return [x.state, x.at, x.zone, x.route]; })), [r.items.join('; '), r.score.join(' / '), r.status, r.bad, r.sc.notes || '']).map(q).join(','));
    });
    var b = new Blob([lines.join('\n')], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'periaktoi-ledger.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- the page frame ---------- */
  function rebuild() {
    var b = bounds(); if (V.box && V.boxFor !== JSON.stringify(st())) V.box = null; V.boxFor = JSON.stringify(st());
    var views = { over: '<div class="pk-view" id="pkOverWrap"><div class="pk-vt">Bird’s-eye (from above, audience at the bottom) · scroll to zoom, drag the floor to pan <button id="pkFit" class="pk-mini">Fit</button></div><svg id="pkOver" viewBox="' + b.x0 + ' ' + b.y0 + ' ' + (b.x1 - b.x0) + ' ' + (b.y1 - b.y0) + '"><defs><pattern id="pkHatch" width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1" stroke="#2a2633" stroke-width="0.3"/></pattern><marker id="pkArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ddd"/></marker></defs>' + overheadStatic() + '<g id="pkDyn"></g></svg></div>',
      aud: '<div class="pk-view"><div class="pk-vt">Audience view (from the house: A on the left)</div><canvas id="pkAud"></canvas></div>',
      crew: '<div class="pk-view"><div class="pk-vt">Crew view (from upstage, looking out at the audience: mirrored, <b>D is on your left</b>)</div><canvas id="pkCrew"></canvas></div>' };
    var v = V.view, html = v === 'ledger' ? ledgerHtml() : v === 'split' ? views.over + '<div class="pk-two">' + views.aud + views.crew + '</div>' : views[v];
    document.getElementById('pkCenter').innerHTML = html;
    app.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('on', x.dataset.view === v); });
    svg = document.getElementById('pkOver'); dyn = document.getElementById('pkDyn');
    if (!svg) { svg = document.createElementNS('http:' + '//www.w3.org/2000/svg', 'svg'); dyn = document.createElementNS('http:' + '//www.w3.org/2000/svg', 'g'); dyn.id = 'pkDyn'; svg.appendChild(dyn); var z = document.createElementNS('http:' + '//www.w3.org/2000/svg', 'g'); z.id = 'pkZones'; svg.appendChild(z); svg.id = 'pkOverHidden'; svg.style.display = 'none'; document.getElementById('pkCenter').appendChild(svg); }
    else wirePointer();
    if (document.getElementById('pkFit')) document.getElementById('pkFit').onclick = function () { V.box = null; setBox(box0); };
    if (document.getElementById('pkCsv')) document.getElementById('pkCsv').onclick = ledgerCsv;
    draw();
  }
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.set = function () {
    T.setBar('Set and scene changes', '#/teacher');
    load(); stop(); sel = null;
    document.body.classList.add('pk-wide');
    app.innerHTML = '<div class="pk">' +
      '<div class="pk-top"><button id="pkPrev" title="[">‹</button><select id="pkSel"></select><button id="pkNext" title="]">›</button>' +
      '<button id="pkPlay" class="pk-primary" title="Space">▶ Play the change</button><input type="range" id="pkScrub" min="0" max="1000" value="1000" title="Scrub through the change">' +
      '<select id="pkSpeed" title="Speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select>' +
      '<select id="pkWhen" title="When towers turn"><option value="during">Turn while rolling</option><option value="before">Turn, then roll</option><option value="after">Roll, then turn</option></select>' +
      '<label class="pk-chk"><input type="checkbox" id="pkLoop"> Loop</label>' +
      '<span class="pk-gap"></span><div class="pk-seg"><button data-view="over">Bird’s-eye</button><button data-view="aud">Audience</button><button data-view="crew">Crew</button><button data-view="split">All three</button><button data-view="ledger">Ledger</button></div>' +
      '<select id="pkZoom" title="Audience and crew views"><option value="towers">Front views: the towers</option><option value="stage">Front views: the whole stage</option></select>' +
      '<div class="pk-seg"><button id="pkLabels">Technical</button><button id="pkPreview">Show preview</button></div>' +
      '<details class="pk-show"><summary>Show ▾</summary><div>' + [['pics', 'Panel pictures on the map'], ['spikes', 'Spike marks'], ['paths', 'Tower paths'], ['sweep', 'Turning circles'], ['rim', 'Rim and practicals'], ['routes', 'Table routes'], ['clear', 'Table clearance']].map(function (o) { return '<label class="pk-chk"><input type="checkbox" data-show="' + o[0] + '"' + (V[o[0]] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div></details>' +
      '<button id="pkUndo" title="⌘Z">↶</button><button id="pkRedo" title="⇧⌘Z">↷</button><button id="pkSet">⚙ Stage & towers</button><button id="pkEq">⚙ Equipment</button><button id="pkExp">Export</button><label class="pk-btn">Import<input type="file" id="pkImp" accept=".json,application/json" hidden></label></div>' +
      '<div class="pk-main"><aside class="pk-left" id="pkScenes"></aside><section class="pk-center" id="pkCenter"></section><aside class="pk-right" id="pkRight"></aside></div>' +
      '<div class="pk-bottom" id="pkBottom"></div>' +
      '<p class="pk-help small">Keys: [ ] scenes · Space play · Tab next tower · arrows nudge (Shift ×4) · Q / E turn 60° (Shift 120°) · 1 2 3 show that face flat · L light · ⌘Z undo. Option while dragging: no snapping. Saved in the show and on this computer; Export keeps a copy.</p></div>';
    var $ = function (id) { return document.getElementById(id); };
    $('pkPrev').onclick = function () { stop(); cur = Math.max(0, cur - 1); draw(); };
    $('pkNext').onclick = function () { stop(); cur = Math.min(P.scenes.length - 1, cur + 1); draw(); };
    $('pkSel').onchange = function () { stop(); cur = +this.value; draw(); };
    $('pkPlay').onclick = play;
    $('pkScrub').oninput = function () { if (!cur) return; if (!anim) { var ch = PK.change(P, P.scenes[cur - 1], scene()); anim = { from: cur - 1, to: cur, ch: ch, u: 0, playing: false, dur: duration(ch), last: 0 }; } anim.playing = false; anim.u = this.value / 1000; setPlayBtn(); drawViews(); };
    $('pkSpeed').onchange = function () { V.speed = +this.value; };
    $('pkWhen').value = P.turnWhen || 'during'; $('pkWhen').onchange = function () { snap(); P.turnWhen = this.value; stop(); changed(); };
    $('pkZoom').value = V.zoom; $('pkZoom').onchange = function () { V.zoom = this.value; drawViews(); };
    $('pkLoop').onchange = function () { V.loop = this.checked; };
    app.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { V.view = b.dataset.view; rebuild(); }; });
    var lab = function () { $('pkLabels').classList.toggle('on', V.labels); $('pkPreview').classList.toggle('on', !V.labels); };
    $('pkLabels').onclick = function () { V.labels = true; lab(); drawViews(); }; $('pkPreview').onclick = function () { V.labels = false; lab(); drawViews(); }; lab();
    app.querySelectorAll('[data-show]').forEach(function (cb) { cb.onchange = function () { V[cb.dataset.show] = cb.checked; drawViews(); }; });
    $('pkUndo').onclick = function () { stop(); step(true); }; $('pkRedo').onclick = function () { stop(); step(false); };
    $('pkSet').onclick = settings; $('pkEq').onclick = equipment; $('pkExp').onclick = exportJson; $('pkImp').onchange = function () { if (this.files[0]) importJson(this.files[0]); this.value = ''; };
    document.addEventListener('keydown', keys);
    var rs = function () { drawViews(); }; window.addEventListener('resize', rs);
    T.cleanup.push(function () { document.removeEventListener('keydown', keys); window.removeEventListener('resize', rs); document.body.classList.remove('pk-wide'); anim = null; });
    rebuild();
  };
})();
