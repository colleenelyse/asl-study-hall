/* node theatre/dev/test-periaktoi.js — periaktoi geometry (js/periaktoi-core.js): facings, the face order, checks, table routes */
const PK = require('../js/periaktoi-core.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const P = PK.fresh(), S = n => P.scenes.filter(s => !s.moment)[n - 1];
ok(P.scenes.filter(s => !s.moment).length === 17 && P.scenes.some(s => s.moment && s.spike === 'CF-UNITED'), '17 scenes in the starting library, plus the united-tables moment in 15');
ok(P.scenes.every(s => PK.TOWERS.every((t, i) => i === 0 || s.towers[PK.TOWERS[i - 1]].x < s.towers[t].x)), 'A — B — C — D left to right in every scene');
ok(P.scenes.every(s => PK.TABLES.every(id => s.tables && s.tables[id] && s.tables[id].state)), 'both tables have a saved spot and state in every scene');
const lab = n => PK.TOWERS.map(t => PK.facing(P, t, S(n).towers[t].rot)).map(f => f.kind + ':' + f.faces.slice().sort().join('+')).join(' ');
ok(lab(3) === 'flat:A1 point:B1+B3 flat:C1 point:D2+D3', 'hallway: A1 flat, B1+B3 point, C1 flat, D2+D3 point');
ok(lab(9) === 'point:A1+A3 flat:B3 flat:C3 point:D2+D3', 'cafeteria: A1+A3 point, B3, C3, D2+D3 point');
ok(lab(16) === 'flat:A2 flat:B2 flat:C2 flat:D1', 'scene 16: A2, B2, C2, D1');
ok(Math.abs(S(7).towers.C.x - S(7).towers.B.x - P.stage.face) < 1e-9, 'B2 + C2 meet at an exact seam');
// the face order decides which face is on the audience's left in a point, never which faces show
const w0 = P.towers.B.wind, r1 = PK.rotFor(P, 'B', 'B1+B3'); P.towers.B.wind = w0 === 'cw' ? 'ccw' : 'cw'; const r2 = PK.rotFor(P, 'B', 'B1+B3'); P.towers.B.wind = w0;
ok(r1.left !== r2.left && [r1.left, r1.right].sort().join() === 'B1,B3' && [r2.left, r2.right].sort().join() === 'B1,B3', 'switching B’s face order swaps left and right in its point, same two faces');
for (const t of PK.TOWERS) for (const k of [1, 2, 3]) { const f = PK.facing(P, t, PK.rotFor(P, t, t + k).rot); if (f.kind !== 'flat' || f.faces[0] !== t + k) ok(false, t + k + ' flat'); }
ok(true, 'every one of the 12 faces can be turned flat to the audience');
const ch = PK.change(P, S(8), S(9));
ok(ch.moves.find(m => m.t === 'D').turn === 0, '8 → 9: D keeps D2+D3 (no turn), only rolls outward');
ok(ch.tmoves.every(m => m.open && m.dist > 0), '8 → 9: both tables come in and unfold');
ok(ch.warn.some(w => /opening is/.test(w.msg)), '8 → 9: the A–B and C–D openings are measured against the folded table');
const d = PK.geom(P, 'D', S(4).towers.D, P.stage);
ok(d.sweep > PK.R(P.stage) + 0.5, 'D’s rim makes its turning circle bigger than the bare tower’s');
const tb = PK.tableFoot(P, 'T1', { x: 0, y: 0, rot: 0, state: 'deployed' }), tf = PK.tableFoot(P, 'T1', { x: 0, y: 0, rot: 0, state: 'stored' });
ok(tb.l === P.tables.T1.open.l && tf.l === P.tables.T1.folded.l, 'a table’s footprint changes when it folds');
const mid = PK.tableBetween(P, ch.tmoves[0], 0.25), end = PK.tableBetween(P, ch.tmoves[0], 1);
ok(mid.k === 0 && end.k === 1 && end.label === 'deployed', 'a table travels folded and unfolds only at the end');
ok(PK.ft(7.5) === '7′ 6″' && PK.parseFt('7\' 6"') === 7.5 && PK.parseFt('-2') === -2, 'feet and inches');
ok(Math.abs(PK.frontY(P.stage, 0) + 23.7) < 1e-9 && Math.abs(PK.frontY(P.stage, 24.9) + 19.4) < 1e-9 && Math.abs(PK.frontY(P.stage, 30) + 7) < 1e-9, 'the front edge traced from the Reber plan: 23′ 8″ from PL at center, 19′ 5″ at the walls; side decks 5 ft in front of the 2-ft wall');
ok(PK.diagramAngle(P, 'A', S(9).towers.A.rot) === 180 && PK.diagramAngle(P, 'B', S(3).towers.B.rot) === 180 && PK.diagramAngle(P, 'D', S(9).towers.D.rot) === 300, 'her diagram (0° = face 2 flat, clockwise): A 180° = A1+A3, B 180° = B1+B3, D 300° = D2+D3');
ok(JSON.stringify(S(9).towers) === JSON.stringify(S(15).towers) && S(15).same === 's9', 'scenes 9 and 15 have identical towers, linked');
ok(['T1', 'T2'].every(id => S(9).tables[id].spike === 'CF-SEPARATE' && S(15).tables[id].spike === 'CF-SEPARATE' && S(9).tables[id].rot === 90), '9 and the start of 15 use the same CF-SEPARATE spikes, lengths up and downstage');
const uni = P.scenes.find(s => s.moment && s.spike === 'CF-UNITED'), cu = PK.change(P, S(15), uni);
ok(uni.tables.T1.rot === 0 && cu.tmoves.every(m => m.from.state === 'deployed' && m.to.state === 'deployed'), 'CF-UNITED: the open tables turn 90° to run parallel to the curtain, in view');
ok(!cu.warn.some(w => w.lv === 'bad'), 'separate → united: no clashes with the stand-in sizes (one table at a time)');
ok(PK.sceneChecks(P, uni).some(m => /joined end to end/.test(m.msg)), 'CF-UNITED reads as one long table');
const wide = PK.tableFoot(P, 'T1', { x: 0, y: 0, rot: 0, state: 'deployed' }).w; ok(Math.abs(wide - (P.tables.T1.open.w + 2 * P.tables.T1.bench)) < 1e-9, 'the open footprint includes both benches');
const lane = PK.gapInfo(P, S(9), 'T1'); ok(lane.pair.join('') === 'BC' && lane.width >= lane.need, 'cafeteria: B and C stand apart, a center lane wide enough for a folded table');
ok(P.scenes.every((sc, i) => !i || !PK.change(P, P.scenes[i - 1], sc).warn.some(w => w.lv === 'bad')), 'no clashes in any change with the stand-in sizes');
const old = JSON.parse(JSON.stringify(PK.fresh())); old.v = 2; old.scenes.forEach(sc => { if (sc.spike) { sc.towers.A.x = -11; sc.towers.B.x = -2.5; sc.towers.C.x = 2.5; sc.towers.D.x = 11; } });
PK.migrate(old); ok(old.v === 3 && old.scenes.find(x => x.id === 's9').towers.B.x === -4.25, 'a saved plan from before the lane gets the lane');
ok(['s4', 's12', 's17'].every(id => PK.facing(P, 'B', P.scenes.find(x => x.id === id).towers.B.rot).label === 'B1'), 'the gym shows the doorway (B1) on B');
const Q = PK.fresh(), lit0 = JSON.stringify(Q.scenes.map(sc => PK.TOWERS.map(t => sc.towers[t].lit !== 'dark' ? Math.round(sc.towers[t].rot) : null))), r = PK.fewerTurns(Q); PK.applyTurns(Q, r);
ok(JSON.stringify(Q.scenes.map(sc => PK.TOWERS.map(t => sc.towers[t].lit !== 'dark' ? Math.round(sc.towers[t].rot) : null))) === lit0, 'smarter turns never change a lit scene');
ok(r.after.turns <= r.before.turns && r.after.degrees <= r.before.degrees && r.after.inDark >= r.before.inDark, 'smarter turns: no more turning, more of it in the dark');
const R = PK.fresh(); let ahead = true;
R.scenes.forEach((sc, i) => { if (!i) return; PK.TOWERS.forEach(t => { const q = sc.towers[t]; if (q.lit === 'dark' && R.scenes[i - 1].towers[t].lit !== 'dark') { let k = i; while (k < R.scenes.length && R.scenes[k].towers[t].lit === 'dark') k++; if (k < R.scenes.length && Math.abs(PK.norm(q.rot - R.scenes[k].towers[t].rot)) > 0.5) ahead = false; } }); });
ok(ahead, 'set up ahead: a tower that goes dark is already turned for its next lit scene');
ok(R.scenes.every((sc, i) => !i || PK.change(R, R.scenes[i - 1], sc).moves.every(m => Math.abs(m.turn) <= 180)), 'every turn takes the short way');
// home bases and line-ups (Colleen 2026-10-25)
{ const Q = PK.fresh(), H = Q.home, near = (a, b) => Math.abs(a - b) < 0.02;
  ok(near(H.B.x - H.A.x, 8) && near(H.C.x - H.B.x, 8) && near(H.D.x - H.C.x, 8) && near(H.B.x + H.C.x, 0), 'home bases: evenly spaced, 4 ft between the points when face on, centered');
  const sc = JSON.parse(JSON.stringify(Q.scenes[0]));
  PK.lineUp(Q, sc, 'aroundC'); const g = t => PK.geom(Q, t, sc.towers[t], Q.stage).poly;
  ok(near(sc.towers.C.x, H.C.x) && !PK.polysOverlap(g('B'), g('C')) && PK.polyDist(g('B').reduce((a, p) => p.x > a.x ? p : a), g('C')) < 0.02 && PK.polyDist(g('D').reduce((a, p) => p.x < a.x ? p : a), g('C')) < 0.02, 'B and D close in on C: points touch, no overlap, C stays home');
  PK.lineUp(Q, sc, 'unitBC'); const xs = g('B').concat(g('C')).map(p => p.x);
  ok(near(Math.min(...xs) + Math.max(...xs), 0) && !PK.polysOverlap(g('B'), g('C')) && PK.polyDist(g('B').reduce((a, p) => p.x > a.x ? p : a), g('C')) < 0.02, 'B + C as one unit, centered, points touching');
  PK.lineUp(Q, sc, 'home'); ok(['A', 'B', 'C', 'D'].every(t => near(sc.towers[t].x, H[t].x)), 'all home');
  const a = Q.scenes[0], b = Q.scenes[1];
  ok(b.same === 's1' && b.sub && JSON.stringify(a.towers) === JSON.stringify(b.towers), 'scene 1 is 1a and 1b: the same set');
  b.towers.A.lit = 'low'; PK.applyLinks(Q, b); ok(a.towers.A.lit === 'full' && b.towers.A.lit === 'low', '1a and 1b keep their own lighting'); }
// lighting areas (her drawing, 2026-10-25)
{ const Q = PK.fresh(), sc = Q.scenes[2];
  ok(Q.lights.length === 7 && ['sr', 'left', 'center', 'right', 'sl', 'allL', 'allR'].every(id => Q.lights.some(a => a.id === id)), 'seven lighting areas from her drawing');
  PK.lineUp(Q, sc, 'home'); sc.areas = ['left']; PK.lightTowers(Q, sc);
  ok(sc.towers.A.lit === 'full' && sc.towers.D.lit === 'dark', 'only the left area up: A is lit, D goes dark');
  sc.areas = ['allR']; PK.lightTowers(Q, sc); ok(sc.towers.D.lit === 'full' && sc.towers.C.lit === 'full' && sc.towers.A.lit === 'dark', 'all of right lights C and D'); }
process.exit(bad ? 1 : 0);
