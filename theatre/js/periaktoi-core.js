/* asl.cool/theatre: periaktoi geometry and the starting scene library (no page code here, so node can test it: dev/test-periaktoi.js).
   Stage coordinates are in feet: x = 0 on the center line, growing toward STAGE LEFT (audience right); y = 0 on the plaster line (PL),
   growing UPSTAGE, negative on the apron and pit cover. Angles are degrees, counterclockwise as seen from above, 0 = toward the audience.
   A tower's `rot` is the angle face 1 points to; face k (0, 1, 2) points to rot + w·k·120, where w = +1 when the faces go 1 → 2 → 3
   counterclockwise seen from above and −1 when clockwise (each tower's winding is a setting until Colleen confirms the build).
   T.show.periaktoi = { v, stamp, stage, towers: { A: { wind, confirmed } }, crew, turnWhen, tables: { T1: spec }, storage: [ zone ], practicals: { D1: {…} },
   scenes: [ { id, name, notes, zones, needTables, towers: { A: { x, y, rot, want, lit, role, lock } }, tables: { T1: { state, x, y, rot, zone } },
   items: [ { id, kind, name, x, y, w, d, rot } ] } ] }   want = 'A1' (flat) or 'B1+B3' (point) or null (free) */
(function () {
  'use strict';
  var TOWERS = ['A', 'B', 'C', 'D'];
  var FACES = {
    A1: 'East High lockers (Sharpay’s working locker, 4 red lockers)', A2: 'Botanical biology / chemistry classroom (whiteboard printed on the vinyl)', A3: 'Wood trophy case and school displays',
    B1: 'Academic wall with the practical classroom door', B2: 'Black-box theatre, LEFT half', B3: 'Wildcat head (moss look), pier, water fountain (all printed)',
    C1: 'Academic wall with the real cork bulletin board', C2: 'Black-box theatre, RIGHT half', C3: 'Red athletic lockers / corridor',
    D1: 'Gym wall: real 18″ rim, backboard printed', D2: 'Neutral wall, two tall frosted windows (printed)', D3: 'Academic corridor (design pending)'
  };
  var SHORT = { A1: 'Lockers', A2: 'Bio/chem', A3: 'Trophy case', B1: 'Door', B2: 'Black box L', B3: 'Wildcat', C1: 'Corkboard', C2: 'Black box R', C3: 'Athletic lockers', D1: 'Hoop', D2: 'Windows', D3: 'Corridor' };
  var FILES = { A1: 'A1-East-High-Lockers', A2: 'A2-Botanical-Classroom', A3: 'A3-Trophy-Case', B1: 'B1-Classroom-Door', B2: 'B2-Black-Box-Left', B3: 'B3-Wildcat-Fountain',
    C1: 'C1-Bulletin-Board', C2: 'C2-Black-Box-Right', C3: 'C3-Athletic-Lockers', D1: 'D1-Gym-Hoop', D2: 'D2-Frosted-Windows', D3: 'D3-Academic-Corridor' };
  /* the only physical pieces on the faces (Colleen's corrected inventory, 2026-10-25); everything else is printed. Sizes are stand-ins until measured:
     u = where along the face (0 = its left edge, 1 = its right edge, as you look at it), w = width, d = how far it sticks out, z = height of its middle */
  var PRACTICALS = {
    A1: { name: 'Sharpay’s working locker door', u: 0.5, w: 1, d: 0.1, z: 4 },
    B1: { name: 'Working classroom door (36″ × 80″)', u: 0.5, w: 3, d: 0.1, z: 3.33 },
    C1: { name: 'Framed corkboard 36″ × 24″', u: 0.5, w: 3, d: 0.15, z: 5 },
    D1: { name: 'Real 18″ basketball rim (backboard printed)', u: 0.5, w: 1.5, d: 2, z: 6.5, rim: true }
  };
  var PROTRUDE = {}; Object.keys(PRACTICALS).forEach(function (k) { PROTRUDE[k] = PRACTICALS[k].name; });
  var R3 = Math.sqrt(3);

  function stageDefaults() {
    return {      // * = placeholder until the ground plan's numbers are typed in
      prosc: 51,          // proscenium opening, wall to wall (Colleen: about 51 ft)
      curtain: 1 + 10 / 12,      // main curtain (grand drape), upstage of PL: lineset 2, 1′10″
      apron: 20,          // PL to the curved front edge on the center line, pit cover included (Colleen: about 20 ft)
      edgeSide: 5,        // PL to the front edge at each proscenium wall (Colleen: about 5 ft)
      sideDeck: 8,        // * how far the deck reaches past each proscenium wall (Horticulture HQ stage right, NYE karaoke stage left)
      wing: 12,           // * wing space behind each proscenium wall
      face: 4, height: 8, // tower faces 4 ft × 8 ft
      grid: 0.5,          // snap: 6 in
      clear: 0.5,         // * gap to keep between towers, and from the drape
      curtainGap: 8,      // * how wide the main curtain opens at center (Colleen: it opens at center for the tables)
      aisle: 3,           // * the narrowest path actors need between a table's bench and anything else
      eye: 5, house: 30,  // audience view camera: eye height and distance in front of PL
      crew: 4,            // crew view camera: distance upstage of the drape (tables stored right in front of it are left out of the picture)
      placeholder: { sideDeck: true, wing: true, clear: true, curtainGap: true, aisle: true }
    };
  }
  function R(st) { return st.face / R3; }            // center to a corner
  function r(st) { return st.face / (2 * R3); }      // center to the middle of a face
  function norm(a) { a = a % 360; if (a <= -180) a += 360; if (a > 180) a -= 360; return Math.round(a * 1000) / 1000; }
  function w(P, t) { return (P.towers && P.towers[t] && P.towers[t].wind === 'cw') ? -1 : 1; }
  function faceAngle(P, t, rot, k) { return norm(rot + w(P, t) * k * 120); }
  function dir(a) { var q = a * Math.PI / 180; return { x: Math.sin(q), y: -Math.cos(q) }; }      // stage x, y of the direction a (0 = toward the audience = −y)
  /* the rotation that shows one face flat, or two faces as a point: { rot, left, right } (left/right as the audience sees them) */
  function rotFor(P, t, want) {
    var ids = String(want || '').split('+'), k = ids.map(function (f) { return +f.slice(1) - 1; });
    if (ids.length === 1) return { rot: norm(-w(P, t) * k[0] * 120), left: ids[0], right: null };
    var a = k[0], b = k[1];
    if ((((b - a) * w(P, t)) % 3 + 3) % 3 !== 1) { var x = a; a = b; b = x; }      // a is the face whose normal sits 120° clockwise of b's: it shows on the audience's left
    return { rot: norm(-60 - w(P, t) * a * 120), left: t + (a + 1), right: t + (b + 1) };
  }
  /* Colleen's triangle diagram: 0° = face 2 flat to the audience; P.diagram.dir = which way its angles count, seen from above (not confirmed) */
  function diagramAngle(P, t, rot) {
    var a = rot + w(P, t) * 120, s = P.diagram && P.diagram.dir === 'cw' ? -1 : 1;
    return ((Math.round(s * a) % 360) + 360) % 360;
  }
  /* what the audience sees at a rotation: 'flat' A1, 'point' A1|A3 (left|right), or 'angled' */
  function facing(P, t, rot) {
    var out = [];
    for (var k = 0; k < 3; k++) { var a = faceAngle(P, t, rot, k); out.push({ id: t + (k + 1), a: a }); }
    var flat = out.find(function (f) { return Math.abs(f.a) < 0.5; });
    if (flat) return { kind: 'flat', faces: [flat.id], label: flat.id };
    var L = out.find(function (f) { return Math.abs(f.a + 60) < 0.5; }), Rt = out.find(function (f) { return Math.abs(f.a - 60) < 0.5; });
    if (L && Rt) return { kind: 'point', faces: [L.id, Rt.id], label: L.id + '+' + Rt.id };
    var vis = out.filter(function (f) { return Math.abs(f.a) < 90; }).sort(function (p, q) { return p.a - q.a; });      // the audience's left first
    return { kind: 'angled', faces: vis.map(function (f) { return f.id; }), label: vis.map(function (f) { return f.id; }).join('/') + ' (angled ' + Math.round(rot) + '°)' };
  }
  /* corners in stage feet, and each face's two ends (l = the face's own left edge, as seen by someone looking at that face) */
  function geom(P, t, s, st) {
    var Rr = R(st), faces = [];
    for (var k = 0; k < 3; k++) {
      var a = faceAngle(P, t, s.rot, k), dl = dir(a - 60), dr = dir(a + 60), dn = dir(a);
      faces.push({ id: t + (k + 1), k: k, a: a, l: { x: s.x + Rr * dl.x, y: s.y + Rr * dl.y }, r: { x: s.x + Rr * dr.x, y: s.y + Rr * dr.y }, n: dn,
        c: { x: s.x + r(st) * dn.x, y: s.y + r(st) * dn.y } });
    }
    var pts = []; faces.forEach(function (f) { [f.l, f.r].forEach(function (p) { if (!pts.some(function (q) { return Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6; })) pts.push(p); }); });
    var prot = [];
    faces.forEach(function (f) {
      var pr = P.practicals && P.practicals[f.id]; if (!pr || !(pr.d > 0)) return;
      var ax = { x: f.r.x - f.l.x, y: f.r.y - f.l.y }, L = Math.hypot(ax.x, ax.y); ax.x /= L; ax.y /= L;
      var m = { x: f.l.x + ax.x * L * pr.u, y: f.l.y + ax.y * L * pr.u }, hw = pr.w / 2;
      var a = { x: m.x - ax.x * hw, y: m.y - ax.y * hw }, b = { x: m.x + ax.x * hw, y: m.y + ax.y * hw };
      prot.push({ id: f.id, rim: pr.rim, mid: m, d: pr.d, z: pr.z, w: pr.w, n: f.n, poly: [a, b, { x: b.x + f.n.x * pr.d, y: b.y + f.n.y * pr.d }, { x: a.x + f.n.x * pr.d, y: a.y + f.n.y * pr.d }] });
    });
    var sweep = R(st); prot.forEach(function (q) { q.poly.forEach(function (p) { sweep = Math.max(sweep, Math.hypot(p.x - s.x, p.y - s.y)); }); });
    return { faces: faces, poly: pts, prot: prot, sweep: sweep };
  }

  /* ---------- checks (advisory: they never block anything) ---------- */
  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
    return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
  }
  function inPoly(p, poly) {
    var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; }
    return c;
  }
  function polyDist(p, poly) { if (inPoly(p, poly)) return 0; var m = Infinity; for (var i = 0; i < poly.length; i++) m = Math.min(m, segDist(p, poly[i], poly[(i + 1) % poly.length])); return m; }
  function touching(a, b) {      // two footprints that only meet edge to edge (tables joined end to end)
    var shrink = function (P0) { var cx = 0, cy = 0; P0.forEach(function (p) { cx += p.x; cy += p.y; }); cx /= P0.length; cy /= P0.length; return P0.map(function (p) { var dx = p.x - cx, dy = p.y - cy, L = Math.hypot(dx, dy) || 1; return { x: p.x - dx / L * 0.05, y: p.y - dy / L * 0.05 }; }); };
    return !polysOverlap(shrink(a), shrink(b));
  }
  function polysOverlap(a, b) {      // separating axis test for two convex polygons
    var polys = [a, b];
    for (var n = 0; n < 2; n++) { var P0 = polys[n];
      for (var i = 0; i < P0.length; i++) { var p1 = P0[i], p2 = P0[(i + 1) % P0.length], ax = { x: -(p2.y - p1.y), y: p2.x - p1.x };
        var mm = polys.map(function (Q) { var lo = Infinity, hi = -Infinity; Q.forEach(function (q) { var v = q.x * ax.x + q.y * ax.y; lo = Math.min(lo, v); hi = Math.max(hi, v); }); return [lo, hi]; });
        if (mm[0][1] <= mm[1][0] + 1e-6 || mm[1][1] <= mm[0][0] + 1e-6) return false; } }
    return true;
  }
  /* the front edge of the deck: a circular arc through (±prosc/2, −edgeSide) and (0, −apron); straight past the proscenium walls */
  function frontY(st, x) {
    var c = st.prosc / 2, s = Math.max(0.01, st.apron - st.edgeSide), rad = (c * c + s * s) / (2 * s);
    if (Math.abs(x) >= c) return -st.edgeSide;
    return -(st.apron - rad + Math.sqrt(rad * rad - x * x));
  }
  /* ---------- the two cafeteria tables (Colleen 2026-10-25: tracked through storage, preset, entry, unfolding, use, folding and removal) ---------- */
  var TABLES = ['T1', 'T2'];
  var TSTATE = { stored: 'Stored (folded)', preset: 'Preset (folded, near its entrance)', parked: 'Parked (folded, temporary)', deployed: 'Deployed (open, secured)' };
  var ZKIND = { upstage: 'Upstage storage', wing: 'Side wing', preset: 'Concealed preset', parking: 'Temporary parking' };
  function tableDefaults() {      // every size is a stand-in until the school's tables are measured; `stand` lists what has not been measured
    var t = function (name, gap) { return { name: name, model: '', open: { l: 8, w: 2.5, h: 2.5 }, bench: 1.25, folded: { l: 5, w: 2.5, h: 6 }, clear: 0.5, crew: 2, openSecs: 20, closeSecs: 20, gap: gap, stand: { model: true, open: true, bench: true, folded: true, crew: true, secs: true } }; };
    return { T1: t('Table 1', 'BC'), T2: t('Table 2', 'BC') };      // long tables with attached benches; open width = tabletop + a bench each side
  }
  function towerLine(sc) { return TOWERS.reduce(function (a, t) { return a + sc.towers[t].y; }, 0) / 4; }
  function rectPoly(x, y, l, w, rot) {
    var a = (rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) { var dx = k[0] * l / 2, dy = k[1] * w / 2; return { x: x + dx * c - dy * s, y: y + dx * s + dy * c }; });
  }
  function tableFoot(P, id, ts, k) {      // k: 0 = folded, 1 = open (in between while unfolding)
    var spec = P.tables[id], open = k == null ? (ts.state === 'deployed' ? 1 : 0) : k;
    var ow = spec.open.w + 2 * (spec.bench || 0), l = spec.folded.l + (spec.open.l - spec.folded.l) * open, w = spec.folded.w + (ow - spec.folded.w) * open;
    return { poly: rectPoly(ts.x, ts.y, l, w, ts.rot), pad: rectPoly(ts.x, ts.y, l + 2 * spec.clear, w + 2 * spec.clear, ts.rot), l: l, w: w, h: spec.folded.h + (spec.open.h - spec.folded.h) * open };
  }
  /* the opening a table goes through: between the two towers named by its gap, at the towers' line */
  function gapInfo(P, sc, id) {
    var spec = P.tables[id], pair = spec.gap === 'CD' ? ['C', 'D'] : spec.gap === 'BC' ? ['B', 'C'] : ['A', 'B'], st = P.stage;
    var gl = geom(P, pair[0], sc.towers[pair[0]], st), gr = geom(P, pair[1], sc.towers[pair[1]], st);
    var all = function (g) { return g.poly.concat([].concat.apply([], g.prot.map(function (q) { return q.poly; }))); };
    var x0 = Math.max.apply(null, all(gl).map(function (p) { return p.x; })), x1 = Math.min.apply(null, all(gr).map(function (p) { return p.x; }));
    return { pair: pair, x: (x0 + x1) / 2, y: (sc.towers[pair[0]].y + sc.towers[pair[1]].y) / 2, width: x1 - x0, need: spec.folded.w + 2 * spec.clear };
  }
  /* where a table travels in a change: straight, or through its gap when it crosses the towers' line */
  function tableRoute(P, id, a, b, sc) {
    if (b.via && b.via.length) return [{ x: a.x, y: a.y }].concat(b.via.map(function (p) { return { x: p.x, y: p.y }; }), [{ x: b.x, y: b.y }]);      // her own route
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    var st = P.stage, c = st.prosc / 2, line = towerLine(sc);
    var where = function (p) { return Math.abs(p.x) > c && p.y > 0 ? 'wing' : p.y > st.curtain ? 'behind' : 'deck'; };
    var wa = where(a), wb = where(b);
    if (wa !== 'deck' && wa === wb && (wa === 'behind' || a.x * b.x > 0)) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];      // both offstage on the same side
    var exit = function (p, w) {      // offstage → the deck just downstage of the main curtain
      if (w === 'wing') { var k = p.x < 0 ? -1 : 1; return [{ x: k * (c + 1), y: st.curtain / 2 }, { x: k * (c - 1), y: st.curtain / 2 }]; }      // the slot between the proscenium wall and the curtain
      if (w === 'behind') { var half = Math.max(0, st.curtainGap / 2 - P.tables[id].folded.w / 2 - P.tables[id].clear), gx = Math.max(-half, Math.min(half, p.x)); return [{ x: gx, y: st.curtain + 1.5 }, { x: gx, y: st.curtain - 0.6 }]; }      // through the curtain's center opening
      return [];
    };
    var head = [{ x: a.x, y: a.y }].concat(exit(a, wa)), tail = exit(b, wb).reverse().concat([{ x: b.x, y: b.y }]);
    var from = head[head.length - 1], to = tail[0], mid = [];
    if ((from.y > line) !== (to.y > line) && P.tables[id].gap) {      // crossing the towers' line: through its opening
      var g = gapInfo(P, sc, id), up = from.y > line, back = Math.min(st.curtain - 0.6, Math.max(g.y + 2.6, line + 2.6)), front = g.y - r(st) - P.tables[id].folded.l / 2 - P.tables[id].clear - 0.5;      // straightened out before it enters the opening
      mid = up ? [{ x: g.x, y: back }, { x: g.x, y: front }] : [{ x: g.x, y: front }, { x: g.x, y: back }];
    }
    return head.concat(mid, tail);
  }
  function alongRoute(pts, u) {
    var L = [], tot = 0; for (var i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); L.push(d); tot += d; }
    if (!tot) return { x: pts[0].x, y: pts[0].y, a: null };
    var want = Math.max(0, Math.min(1, u)) * tot;
    for (i = 0; i < L.length; i++) { if (want <= L[i] || i === L.length - 1) { var q = L[i] ? Math.min(1, want / L[i]) : 1, A = pts[i], B = pts[i + 1]; return { x: A.x + (B.x - A.x) * q, y: A.y + (B.y - A.y) * q, a: Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI }; } want -= L[i]; }
  }
  function solids(P, sc) {      // every tower footprint and practical, for collision checks
    var out = [];
    TOWERS.forEach(function (t) { var g = geom(P, t, sc.towers[t], P.stage); out.push({ who: t, poly: g.poly }); g.prot.forEach(function (q) { out.push({ who: t, what: q.rim ? t + '’s rim' : t + '’s ' + (P.practicals[q.id].name || 'practical'), poly: q.poly }); }); });
    var c = P.stage.prosc / 2, y = P.stage.curtain;      // the closed main curtain, and the proscenium walls
    var g = (P.stage.curtainGap || 0) / 2;      // the curtain opens at center for the tables
    out.push({ who: 'curtain', what: 'the main curtain', poly: [{ x: -c, y: y }, { x: -g, y: y }, { x: -g, y: y + 0.2 }, { x: -c, y: y + 0.2 }] });
    out.push({ who: 'curtain', what: 'the main curtain', poly: [{ x: g, y: y }, { x: c, y: y }, { x: c, y: y + 0.2 }, { x: g, y: y + 0.2 }] });
    [-1, 1].forEach(function (k) { out.push({ who: 'wall', what: 'the proscenium wall', poly: [{ x: k * c, y: -1 }, { x: k * (c + P.stage.wing), y: -1 }, { x: k * (c + P.stage.wing), y: 0 }, { x: k * c, y: 0 }] }); });
    return out;
  }

  /* ---------- checks (advisory: they never block anything) ---------- */
  function sceneChecks(P, sc) {
    var st = P.stage, out = [], G = {};
    TOWERS.forEach(function (t) { G[t] = geom(P, t, sc.towers[t], st); });
    var hit = function (a, b) { return polysOverlap(a, b); };
    for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) {
      var a = TOWERS[i], b = TOWERS[j];
      if (hit(G[a].poly, G[b].poly)) out.push({ lv: 'bad', t: [a, b], msg: a + ' and ' + b + ' overlap.' });
      G[a].prot.forEach(function (q) { if (hit(q.poly, G[b].poly)) out.push({ lv: 'bad', t: [a, b], msg: a + '’s ' + (q.rim ? 'rim' : 'practical') + ' runs into ' + b + '.' }); });
      G[b].prot.forEach(function (q) { if (hit(q.poly, G[a].poly)) out.push({ lv: 'bad', t: [a, b], msg: b + '’s ' + (q.rim ? 'rim' : 'practical') + ' runs into ' + a + '.' }); });
    }
    for (i = 0; i < 3; i++) if (sc.towers[TOWERS[i]].x > sc.towers[TOWERS[i + 1]].x) out.push({ lv: 'bad', t: [TOWERS[i], TOWERS[i + 1]], msg: 'Order: ' + TOWERS[i] + ' must stay to the audience’s left of ' + TOWERS[i + 1] + ' (always A — B — C — D).' });
    TOWERS.forEach(function (t) {
      var s = sc.towers[t], g = G[t];
      var back = Math.max.apply(null, g.poly.map(function (p) { return p.y; }));
      g.prot.forEach(function (q) { if (q.poly.some(function (p) { return p.y > st.curtain - 0.01; })) out.push({ lv: 'bad', t: [t], msg: t + '’s ' + (q.rim ? 'rim' : 'practical') + ' reaches past the main curtain line.' }); });
      if (back > st.curtain - 0.01) out.push({ lv: 'bad', t: [t], msg: t + ' reaches past the main curtain line (' + ft(st.curtain) + ' upstage of PL).' });
      if (g.poly.some(function (p) { return p.y < frontY(st, p.x); })) out.push({ lv: 'bad', t: [t], msg: t + ' is past the front edge of the deck.' });
      if (Math.abs(s.x) > st.prosc / 2 + st.sideDeck) out.push({ lv: 'warn', t: [t], msg: t + ' is in the wing. All four towers stay on stage in every scene.' });
      var rim = g.prot.some(function (q) { return q.rim; }) ? ' (its rim sweeps a circle ' + ft(2 * g.sweep) + ' across)' : '';
      if (s.y + g.sweep > st.curtain - st.clear + 1e-6) out.push({ lv: 'info', turn: t, t: [t], msg: t + ' can’t turn where it stands' + rim + ': it would brush the main curtain. Bring it ' + ft(s.y + g.sweep - st.curtain + st.clear) + ' downstage first.' });
      else TOWERS.forEach(function (o) { if (o === t || out.some(function (m) { return m.turn === t; })) return; if (polyDist(s, G[o].poly) < g.sweep + st.clear - 1e-6) out.push({ lv: 'info', turn: t, t: [t, o], msg: t + ' can’t turn where it stands' + rim + ': ' + o + ' is inside its turning circle.' }); });
    });
    var sol = solids(P, sc), feet = {};
    (P.tables ? TABLES : []).forEach(function (id) {
      var ts = sc.tables && sc.tables[id], spec = P.tables[id]; if (!ts) { out.push({ lv: 'bad', t: [id], msg: spec.name + ' has no saved spot in this scene.' }); return; }
      var f = feet[id] = tableFoot(P, id, ts);
      sol.forEach(function (o) { if (hit(f.poly, o.poly)) out.push({ lv: 'bad', t: [id, o.who], msg: spec.name + ' (' + (ts.state === 'deployed' ? 'open' : 'folded') + ') overlaps ' + (o.what || o.who) + '.' }); });
      if (sc.needTables && ts.state !== 'deployed') out.push({ lv: 'bad', t: [id], msg: 'Not ready: ' + spec.name + ' must be in place, unfolded and secured for this scene.' });
      if (ts.state === 'deployed' && f.poly.some(function (p) { return p.y < frontY(st, p.x) || p.y > st.curtain; })) out.push({ lv: 'bad', t: [id], msg: spec.name + ' is open off the deck.' });
    });
    if (feet.T1 && feet.T2 && hit(feet.T1.poly, feet.T2.poly) && !touching(feet.T1.poly, feet.T2.poly)) out.push({ lv: 'bad', t: ['T1', 'T2'], msg: 'Table 1 and Table 2 overlap.' });
    formation(P, sc, feet, sol, out);
    return out;
  }
  /* open tables: room for actors around the benches, and the open floor left for dancing (approximate) */
  function formation(P, sc, feet, sol, out) {
    var st = P.stage, open = TABLES.filter(function (id) { return feet[id] && sc.tables[id].state === 'deployed'; });
    if (!open.length) return;
    var gapTo = function (a, b) { var m = Infinity; a.forEach(function (p) { m = Math.min(m, polyDist(p, b)); }); b.forEach(function (p) { m = Math.min(m, polyDist(p, a)); }); return m; };
    open.forEach(function (id) {
      var f = feet[id].poly, name = P.tables[id].name;
      sol.forEach(function (o) { if (o.who === 'curtain' || o.who === 'wall') return; var d = gapTo(f, o.poly); if (d > 0.01 && d < st.aisle) out.push({ lv: 'warn', t: [id, o.who], msg: 'Only ' + ft(d) + ' between ' + name + '’s bench and ' + (o.what || o.who) + '; actors need ' + ft(st.aisle) + (st.placeholder && st.placeholder.aisle ? ' (placeholder)' : '') + '.' }); });
    });
    if (open.length === 2) { var a = feet[open[0]].poly, b = feet[open[1]].poly, d = gapTo(a, b);
      if (touching(a, b) && d < 0.05) out.push({ lv: 'info', t: open, msg: 'The tables are joined end to end: one long table.' });
      else if (d < st.aisle) out.push({ lv: 'warn', t: open, msg: 'The aisle between the tables is ' + ft(d) + '; actors need ' + ft(st.aisle) + '.' });
      else out.push({ lv: 'info', t: open, msg: 'Aisle between the tables: ' + ft(d) + '.' }); }
    var front = Math.min.apply(null, TOWERS.map(function (t) { return Math.min.apply(null, geom(P, t, sc.towers[t], st).poly.map(function (p) { return p.y; })); })), cells = 0, free = 0, c = st.prosc / 2;
    for (var x = -c + 0.25; x < c; x += 0.5) for (var y = front - 0.25; y > frontY(st, x); y -= 0.5) { cells++; var p = { x: x, y: y };
      if (!open.some(function (id) { return inPoly(p, feet[id].pad); })) free++; }
    out.push({ lv: 'info', t: open, msg: 'Open floor in front of the towers for dancing: about ' + Math.round(free * 0.25) + ' sq ft (of ' + Math.round(cells * 0.25) + '), outside the tables and their clearance.' });
    return out;
  }
  function ft(v) {      // 7.5 → 7′ 6″
    var neg = v < 0; v = Math.abs(v); var f = Math.floor(v + 1e-6), i = Math.round((v - f) * 12 * 2) / 2;
    if (i >= 12) { f++; i = 0; }
    return (neg ? '−' : '') + f + '′' + (i ? ' ' + i + '″' : '');
  }
  function parseFt(s) {      // 7' 6"  7 6  7.5  -2'  → feet
    s = String(s).trim().replace(/[−–]/g, '-'); if (!s) return null;
    var m = s.match(/^(-?)\s*(\d+(?:\.\d+)?)\s*(?:'|′|ft|feet)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|in)?)?$/);
    if (!m) return null; var v = +m[2] + (m[3] ? +m[3] / 12 : 0); return m[1] ? -v : v;
  }

  /* ---------- a change from one scene to the next ---------- */
  function change(P, from, to) {
    var st = P.stage, moves = [], tmoves = [];
    TOWERS.forEach(function (t) {
      var a = from.towers[t], b = to.towers[t], d = Math.hypot(b.x - a.x, b.y - a.y), turn = norm(b.rot - a.rot);
      moves.push({ t: t, from: a, to: b, dist: d < 0.01 ? 0 : d, turn: Math.abs(turn) < 0.5 ? 0 : turn, fromFace: facing(P, t, a.rot).label, toFace: facing(P, t, b.rot).label });
    });
    (P.tables ? TABLES : []).forEach(function (id) {
      var a = from.tables && from.tables[id], b = to.tables && to.tables[id]; if (!a || !b) return;
      var open = a.state !== 'deployed' && b.state === 'deployed', fold = a.state === 'deployed' && b.state !== 'deployed';
      var route = tableRoute(P, id, a, b, open ? to : from), len = 0, own = !!(b.via && b.via.length); for (var i = 1; i < route.length; i++) len += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
      var order = to.tableOrder || 'T1', span = order === 'together' ? [0, 1] : (order === id ? [0, 0.5] : [0.5, 1]);
      tmoves.push({ id: id, span: span, from: a, to: b, route: route, dist: len < 0.01 ? 0 : len, open: open, fold: fold, own: own, via: !own && route.some(function (p) { return Math.abs(p.y - towerLine(open ? to : from)) < 3 && Math.abs(p.x - gapInfo(P, open ? to : from, id).x) < 0.01; }) ? P.tables[id].gap : '' });
    });
    var warn = [];
    moves.forEach(function (m) {
      if (!m.turn) return;
      ['from', 'to'].forEach(function (when) {      // where it turns: before travel (at the start) or after (at the end); 'during' is checked at both
        if (P.turnWhen === 'before' && when === 'to' && m.dist) return;
        if (P.turnWhen === 'after' && when === 'from' && m.dist) return;
        var at = m[when], sw = geom(P, m.t, at, st).sweep, rim = geom(P, m.t, at, st).prot.some(function (q) { return q.rim; }) ? ' (rim included)' : '';
        moves.forEach(function (o) { if (o.t === m.t) return;
          var g = geom(P, o.t, o[when], st);
          if (polyDist(at, g.poly) < sw - 1e-6) warn.push({ lv: 'bad', t: [m.t, o.t], msg: m.t + ' would hit ' + o.t + rim + ' while turning ' + (when === 'from' ? 'at its old spot' : 'at its new spot') + '. Separate them before ' + m.t + ' turns.' }); });
        if (at.y + sw > st.curtain) warn.push({ lv: 'bad', t: [m.t], msg: m.t + rim + ' would brush the main curtain while turning.' });
        tmoves.forEach(function (tm) { if (tm.dist) return; var f = tableFoot(P, tm.id, tm.to); if (f.poly.some(function (p) { return Math.hypot(p.x - at.x, p.y - at.y) < sw; })) warn.push({ lv: 'bad', t: [m.t, tm.id], msg: m.t + rim + ' would hit ' + P.tables[tm.id].name + ' while turning.' }); });
      });
    });
    tmoves.forEach(function (tm) {
      if (!tm.dist) return;
      var spec = P.tables[tm.id], sc = tm.open ? to : from, sol = solids(P, sc), bad = {}, inView = tm.from.state === 'deployed' && tm.to.state === 'deployed';
      for (var k = 0; k <= 60; k++) {      // slide the table (folded, or open with its benches) plus its clearance along the route
        var q = tableBetween(P, tm, k / 60); if ((k === 0 && tm.from.state === 'deployed' && !inView) || (k === 60 && tm.to.state === 'deployed' && !inView)) continue;
        var pad = tableFoot(P, tm.id, q, q.k).pad;
        sol.forEach(function (o) { if (!bad[o.what || o.who] && polysOverlap(pad, o.poly)) bad[o.what || o.who] = 1; });
        tmoves.forEach(function (o) { if (o.id <= tm.id || bad.both) return; var oq = tableBetween(P, o, k / 60), of = tableFoot(P, o.id, oq, oq.k), mine = tableFoot(P, tm.id, q, q.k);
          var fa = tableFoot(P, tm.id, tm.to).poly, fb = tableFoot(P, o.id, o.to).poly, joins = polysOverlap(fa, fb) && touching(fa, fb);      // they end joined end to end: only a real overlap counts
          if (polysOverlap(joins ? mine.poly : mine.pad, of.poly) && !touching(mine.poly, of.poly)) { bad.both = 1; warn.push({ lv: 'bad', t: [tm.id, o.id], msg: spec.name + ' and ' + P.tables[o.id].name + ' come within ' + ft(spec.clear) + ' of each other while moving (about ' + Math.round(k / 60 * 100) + '% of the way through). Change the order, a path or a spike.' }); } });
      }
      Object.keys(bad).forEach(function (w) { if (w === 'both') return; warn.push({ lv: 'bad', t: [tm.id], msg: spec.name + '’s route (' + (inView ? 'open, benches included' : 'folded') + ', with ' + ft(spec.clear) + ' clearance) runs into ' + w + (inView ? '' : tm.open ? ' after the towers have moved' : ' before the towers move') + '.' }); });
      if (tm.via) { var g = gapInfo(P, sc, tm.id); warn.push({ lv: g.width + 1e-6 < g.need ? 'bad' : 'info', t: [tm.id], msg: 'The ' + g.pair.join('–') + ' opening is ' + ft(g.width) + ' wide; folded ' + spec.name + ' needs ' + ft(g.need) + ' (' + ft(spec.folded.w) + ' + ' + ft(spec.clear) + ' each side' + (spec.stand.folded ? ', stand-in size' : '') + ').' }); }
    });
    var seen = {}; warn = warn.filter(function (x) { return seen[x.msg] ? false : (seen[x.msg] = true); });
    return { moves: moves, tmoves: tmoves, warn: warn, total: moves.reduce(function (s, m) { return s + Math.abs(m.turn); }, 0), travel: moves.reduce(function (s, m) { return s + m.dist; }, 0) };
  }
  /* crews of 2, 3 or 4: who moves which tower and table (B and C stay with one person or a pair, because of the black-box seam) */
  var CREWS = {
    2: [{ name: 'Crew 1 (stage right)', t: ['A', 'B', 'T1'] }, { name: 'Crew 2 (stage left)', t: ['C', 'D', 'T2'] }],
    3: [{ name: 'Crew 1 (stage right)', t: ['A', 'T1'] }, { name: 'Crew 2 (center)', t: ['B', 'C'] }, { name: 'Crew 3 (stage left)', t: ['D', 'T2'] }],
    4: [{ name: 'Crew 1', t: ['A', 'T1'] }, { name: 'Crew 2', t: ['B'] }, { name: 'Crew 3', t: ['C'] }, { name: 'Crew 4', t: ['D', 'T2'] }]
  };
  function crewJobs(P, ch, n) {
    return (CREWS[n] || CREWS[4]).map(function (c) {
      var jobs = ch.moves.filter(function (m) { return c.t.indexOf(m.t) >= 0 && (m.dist || m.turn); });
      var tj = (ch.tmoves || []).filter(function (m) { return c.t.indexOf(m.id) >= 0 && (m.dist || m.open || m.fold); });
      return { name: c.name, towers: c.t, jobs: jobs, tjobs: tj, steps: jobs.reduce(function (s, m) { return s + (m.dist ? 1 : 0) + (m.turn ? 1 : 0); }, 0) + tj.length };
    });
  }
  /* the state of one tower part-way through a change (u from 0 to 1) */
  function between(P, m, u) {
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    var um = u, ur = u;
    if (m.dist && m.turn) {
      if (P.turnWhen === 'before') { ur = u * 2; um = u * 2 - 1; }
      else if (P.turnWhen === 'after') { um = u * 2; ur = u * 2 - 1; }
    }
    um = ease(um); ur = ease(ur);
    return { x: m.from.x + (m.to.x - m.from.x) * um, y: m.from.y + (m.to.y - m.from.y) * um, rot: m.from.rot + m.turn * ur };
  }
  /* a table part-way through a change: folding first when it leaves, unfolding last when it arrives */
  function tableBetween(P, tm, u) {
    if (tm.span) u = Math.max(0, Math.min(1, (u - tm.span[0]) / (tm.span[1] - tm.span[0])));      // its own part of the change
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, k = tm.from.state === 'deployed' ? 1 : 0, um = u, label;
    if (tm.fold) { k = 1 - ease(u / 0.25); um = (u - 0.25) / 0.75; label = u < 0.25 ? 'folding' : u < 1 ? 'returning' : TSTATE[tm.to.state]; }
    else if (tm.open) { um = u / 0.75; k = ease((u - 0.75) / 0.25); label = u < 0.6 ? 'in transit' : u < 0.75 ? 'positioning' : u < 1 ? 'unfolding' : 'deployed'; }
    else if (tm.from.state === 'deployed' && tm.to.state === 'deployed') {      // an open table moved in view (CF-SEPARATE → CF-UNITED): clear, release, move and turn, secure
      var turn = norm(tm.to.rot - tm.from.rot), R0 = tm.route, last = R0.length - 1, pp, ut, phase;
      if (turn && last >= 2) {      // roll to its turning spot (the last bend), turn there, then slide onto the spike
        var head = R0.slice(0, last), tail = R0.slice(last - 1);
        if (u < 0.4) { pp = alongRoute(head, ease(u / 0.4)); ut = 0; phase = 'moving'; } else if (u < 0.7) { pp = R0[last - 1]; ut = ease((u - 0.4) / 0.3); phase = 'turning'; } else { pp = alongRoute(tail, ease((u - 0.7) / 0.3)); ut = 1; phase = 'moving'; }
      } else { ut = turn ? ease(u * 2) : 1; pp = alongRoute(R0, turn ? ease(u * 2 - 1) : ease(u)); phase = turn && u < 0.5 ? 'turning' : 'moving'; }      // turn on its spot, then travel
      return { x: pp.x, y: pp.y, rot: tm.from.rot + turn * ut, k: 1, label: u <= 0 ? 'clear performers, release' : u < 1 ? phase + ' (crew only)' : 'secured' };
    }
    else label = tm.dist && u > 0 && u < 1 ? 'in transit' : TSTATE[tm.to.state];
    var p = alongRoute(tm.route, ease(um)), rot = tm.dist && um > 0 && um < 1 && p.a != null ? p.a : (um >= 1 ? tm.to.rot : tm.from.rot);
    return { x: p.x, y: p.y, rot: rot || 0, k: k, label: label };
  }

  /* ---------- the starting library: Colleen's 17 candidate states (2026-10-25 brief). Not final. ---------- */
  function library(P) {
    var st = P.stage, sw = Math.max.apply(null, TOWERS.map(function (t) { return geom(P, t, { x: 0, y: 0, rot: 0 }, st).sweep; }));
    var y = Math.round((st.curtain - st.clear - sw) * 4) / 4 - 0.25;      // along the drape, with room for the widest sweep (D's rim) to turn
    var X = { A: -8.5, B: -2.5, C: 2.5, D: 8.5 }, seam = st.face / 2;
    var S = function (num, name, spec, extra) {
      var towers = {};
      TOWERS.forEach(function (t) {
        var v = spec[t] || {}; if (typeof v === 'string') v = { want: v };
        var s = { x: v.x != null ? v.x : X[t], y: v.y != null ? v.y : y, want: v.want || null, lit: v.lit || (v.want ? 'full' : 'dark'), role: v.role || (v.want ? 'featured' : 'masking'), lock: true };
        towers[t] = s;
      });
      return Object.assign({ id: 's' + num + (extra && extra.alt ? 'b' : ''), num: num, name: name, towers: towers, items: [], notes: '' }, extra || {});
    };
    var hall = { A: 'A1', B: 'B1+B3', C: 'C1', D: 'D2+D3' };
    var cafe = { A: { want: 'A1+A3', x: -12.75 }, B: { want: 'B3', x: -4.25 }, C: { want: 'C3', x: 4.25 }, D: { want: 'D2+D3', x: 12.75 } };      // B and C apart: a center lane for the tables from upstage center (Colleen 2026-10-25); A and D out to match
    var box = { B: { want: 'B2', x: -seam }, C: { want: 'C2', x: seam } };
    var L = [
      S(1, 'East High / New Year’s Eve', hall, { notes: 'Signature hallway, plus the karaoke vignette in the stage-left side area (shimmer curtain).', zones: ['nye'] }),
      S(2, 'Homeroom', { A: 'A3', B: 'B1', C: 'C1', D: 'D2' }),
      S(3, 'Main hallway', hall),
      S(4, 'Gym', { B: 'B3', C: 'C3', D: 'D1' }),
      S(5, 'Bio / chem classroom', { A: 'A2', B: 'B1' }),
      S(6, 'Theatre / detention', box, { notes: 'Painting furniture.', items: [{ id: 'pt', kind: 'prop', name: 'Painting furniture', x: 0, y: -5, w: 4, d: 2, rot: 0 }] }),
      S(7, 'Theatre / auditions', box),
      S(8, 'Hallway / callback list', hall, { notes: 'Darbus vignette: C turns C2 → C1 and locks; she posts and fusses with the callback list, then exits. Never send her through a turning tower.' }),
      S(9, 'Cafeteria', cafe, { notes: 'Stick to the Status Quo. A and D shift outward. Tables on CF-SEPARATE: side by side, lengths running up and downstage.', needTables: true, spike: 'CF-SEPARATE' }),
      S(10, 'Horticulture HQ', { A: { want: 'A2', x: -st.prosc / 2 + 3, y: -2.6 } }, { notes: 'A2 at the stage-right proscenium, with plants.', zones: ['hort'], items: [{ id: 'pl', kind: 'prop', name: 'Plants', x: -st.prosc / 2 - 2, y: -3, w: 3, d: 2, rot: 0 }] }),
      S(11, 'Study hall', { A: 'A3', B: 'B1', C: 'C1', D: 'D2' }, { notes: 'Adjustable.' }),
      S(12, 'Gym', { B: 'B3', C: 'C3', D: 'D1' }),
      S(13, 'Locker room / science (split)', { A: 'A2', C: 'C3' }),
      S(14, 'Theatre', box),
      S(15, 'Cafeteria', cafe, { notes: 'We’re All in This Together, opening: exactly the scene 9 picture (same towers, CF-SEPARATE).', needTables: true, spike: 'CF-SEPARATE', same: 's9' }),
      S(15, 'Cafeteria — united (at a cue you choose)', cafe, { alt: true, moment: true, cue: '', needTables: true, spike: 'CF-UNITED', same: 's9',
        notes: 'Part of the choreography, in full view, not a hidden change. 1 Students clear the tables and their paths. 2 Trained table movers release the tables. 3 Each table turns 90° and travels its own path. 4 They arrive end to end (CF-UNITED). 5 Secured and checked stable. 6 Performers come back to the long sides and the ends, so it reads as one communal table (La Vie Bohème). Nobody sits, stands or rides on a moving table.' }),
      S(16, 'Science — theatre — gym (all at once)', { A: 'A2', B: box.B, C: box.C, D: 'D1' }, { notes: 'Non-negotiable: A2 science, B2+C2 theatre, D1 gym at the same time. Tables out; watch the hoop.' }),
      S(17, 'Gym / finale / bows', { B: 'B3', C: 'C3', D: 'D1' })
    ];
    var prev = null;      // a tower not named in a scene stays dark where it was, showing the same face(s)
    L.forEach(function (sc) {
      TOWERS.forEach(function (t) { var s = sc.towers[t]; if (!s.want && prev) { var p = prev.towers[t]; s.x = p.x; s.y = p.y; s.want = p.want; } });
      if (!sc.towers.A.want) sc.towers.A.want = 'A1';
      TOWERS.forEach(function (t) { var s = sc.towers[t]; if (!s.want) s.want = t + '1'; s.rot = rotFor(P, t, s.want).rot; });
      sc.tables = {};      // both tables have a saved spot in every scene: in storage, or open on their spike marks for the cafeteria
      TABLES.forEach(function (id, n) {
        var home = P.storage[0], sp = sc.spike && P.spikes[sc.spike][id], f = P.tables[id].folded;      // stored one behind the other, straight up the center lane: Table 1 in front (first in), Table 2 behind
        var hy = st.curtain + st.clear + f.l / 2 + (n ? f.l + 1 : 0);
        sc.tables[id] = sp ? { state: 'deployed', x: sp.x, y: sp.y, rot: sp.rot, zone: '', spike: sc.spike, via: sc.spike === 'CF-UNITED' ? [{ x: sp.x + (n ? 4 : -2), y: sp.y }] : undefined } : { state: 'stored', x: home.x, y: hy, rot: 90, zone: home.id };
      });
      if (prev && prev.needTables && !sc.needTables) sc.tableOrder = 'T2';      // going back to storage: Table 2 to the far spot first, then Table 1 in front of it
      prev = sc;
    });
    return L;
  }
  function storageDefaults(st) {      // provisional homes: the two wings, and the strip between the towers and the main curtain (Colleen's first choice)
    var c = st.prosc / 2, back = st.curtain;
    return [
      { id: 'upc', name: 'Upstage center, behind the main curtain', kind: 'upstage', x: 0, y: back + 6, w: 8, d: 11.5, masking: 'Hidden by the closed main curtain, which opens at center for the tables' },
      { id: 'srw', name: 'Stage-right wing', kind: 'wing', x: -c - 4, y: 4, w: 6, d: 6, masking: 'Offstage; hidden by the proscenium wall (assumed)' },
      { id: 'slw', name: 'Stage-left wing', kind: 'wing', x: c + 4, y: 4, w: 6, d: 6, masking: 'Offstage; hidden by the proscenium wall (assumed)' },
      { id: 'up', name: 'Behind the towers (upstage)', kind: 'upstage', x: 0, y: back - 0.6, w: 24, d: 1.2, masking: 'Hidden only while the towers stand in front of it (to test)' }
    ];
  }
  /* table spike presets: a marked spot AND direction for each table (tape color, arrow and table number on the floor) */
  function spikeDefaults(P) {
    var t = P.tables.T1, L = t.open.l, y = -10.5;
    return {
      'CF-SEPARATE': { name: 'CF-SEPARATE', tape: 'blue', note: 'Scene 9, and scene 15 opening', T1: { x: -4.5, y: y, rot: 90 }, T2: { x: 4.5, y: y, rot: 90 } },
      'CF-UNITED': { name: 'CF-UNITED', tape: 'green', note: 'Scene 15, the long banquet table', T1: { x: -L / 2, y: y - 3.5, rot: 0 }, T2: { x: L / 2, y: y - 3.5, rot: 0 } }
    };
  }
  /* a table on a spike preset always stands exactly on it, and scenes linked with `same` keep identical towers */
  function applySpikes(P) { P.scenes.forEach(function (sc) { TABLES.forEach(function (id) { var q = sc.tables && sc.tables[id], sp = q && q.spike && P.spikes && P.spikes[q.spike]; if (sp && sp[id]) { q.x = sp[id].x; q.y = sp[id].y; q.rot = sp[id].rot; q.state = 'deployed'; } }); }); }
  function applyLinks(P, edited) {
    var byId = {}; P.scenes.forEach(function (sc) { byId[sc.id] = sc; });
    if (edited && edited.same && byId[edited.same]) byId[edited.same].towers = JSON.parse(JSON.stringify(edited.towers));      // an edit to a linked scene changes the original too
    P.scenes.forEach(function (sc) { if (sc.same && byId[sc.same] && sc !== byId[sc.same]) sc.towers = JSON.parse(JSON.stringify(byId[sc.same].towers)); });
  }
  /* a plan saved before the center lane (v2): only values still at the old defaults move to the new ones; her own edits stay */
  function migrate(P) {
    if (P.v !== 2) return P;
    var F = fresh(), near = function (a, b) { return Math.abs(a - b) < 1e-6; };
    var oldX = { A: -11, B: -2.5, C: 2.5, D: 11 };
    P.scenes.forEach(function (sc) {
      var nf = F.scenes.find(function (x) { return x.id === sc.id; }); if (!nf) return;
      if (sc.spike === 'CF-SEPARATE' || sc.spike === 'CF-UNITED') TOWERS.forEach(function (t) { if (near(sc.towers[t].x, oldX[t])) sc.towers[t].x = nf.towers[t].x; });
      TABLES.forEach(function (id) { var q = sc.tables && sc.tables[id]; if (q && q.zone === 'upc' && near(Math.abs(q.x), 3)) { q.x = nf.tables[id].x; q.y = nf.tables[id].y; } });
      if (!sc.tableOrder && nf.tableOrder) sc.tableOrder = nf.tableOrder;
    });
    ['CF-SEPARATE', 'CF-UNITED'].forEach(function (k) { var o = P.spikes && P.spikes[k], n = F.spikes[k]; if (!o) return;
      TABLES.forEach(function (id) { var old = k === 'CF-SEPARATE' ? -8.5 : -13; if (o[id] && near(o[id].y, old)) o[id].y = n[id].y; }); });
    var up = (P.storage || []).find(function (z) { return z.id === 'upc'; }), nu = F.storage.find(function (z) { return z.id === 'upc'; });
    if (up && near(up.w, 12) && near(up.d, 7)) { up.y = nu.y; up.w = nu.w; up.d = nu.d; }
    if (P.stage && P.stage.crew === 12) P.stage.crew = 4;
    P.v = 3; applySpikes(P); applyLinks(P);
    return P;
  }
  function fresh() {      // diagram: Colleen 2026-10-25, her triangle diagram spins clockwise and 0° = face 2 flat to the audience
    var P = { v: 3, stage: stageDefaults(), towers: {}, crew: 4, turnWhen: 'during', diagram: { dir: 'cw', confirmed: true }, tables: tableDefaults(), practicals: JSON.parse(JSON.stringify(PRACTICALS)) };
    TOWERS.forEach(function (t) { P.towers[t] = { wind: 'cw', confirmed: false, from: 'diagram' }; });      // her diagram (D 300° = D2+D3) implies clockwise; the real towers are not checked yet
    P.storage = storageDefaults(P.stage);
    P.spikes = spikeDefaults(P);
    P.scenes = library(P);
    return P;
  }
  /* the winding changed: towers that were set to show particular faces keep showing them */
  function rewind(P, t) { P.scenes.forEach(function (sc) { var s = sc.towers[t]; if (s.want) s.rot = rotFor(P, t, s.want).rot; }); }

  var PK = { migrate: migrate, diagramAngle: diagramAngle, applySpikes: applySpikes, applyLinks: applyLinks, spikeDefaults: spikeDefaults, ZKIND: ZKIND, TABLES: TABLES, TSTATE: TSTATE, PRACTICALS: PRACTICALS, tableFoot: tableFoot, tableRoute: tableRoute, tableBetween: tableBetween, gapInfo: gapInfo, rectPoly: rectPoly, towerLine: towerLine, TOWERS: TOWERS, FACES: FACES, SHORT: SHORT, FILES: FILES, PROTRUDE: PROTRUDE, CREWS: CREWS, stageDefaults: stageDefaults, R: R, r: r, norm: norm, dir: dir,
    faceAngle: faceAngle, rotFor: rotFor, facing: facing, geom: geom, sceneChecks: sceneChecks, change: change, crewJobs: crewJobs, between: between,
    library: library, fresh: fresh, rewind: rewind, ft: ft, parseFt: parseFt, frontY: frontY, polysOverlap: polysOverlap, polyDist: polyDist };
  if (typeof module !== 'undefined' && module.exports) module.exports = PK; else window.PK = PK;
})();
