/* node theatre/dev/test-periaktoi.js — periaktoi geometry (js/periaktoi-core.js): facings, the face order, checks, table routes */
const PK = require('../js/periaktoi-core.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const P = PK.fresh(), S = n => P.scenes[n - 1];
ok(P.scenes.length === 17, '17 scenes in the starting library');
ok(P.scenes.every(s => PK.TOWERS.every((t, i) => i === 0 || s.towers[PK.TOWERS[i - 1]].x < s.towers[t].x)), 'A — B — C — D left to right in every scene');
ok(P.scenes.every(s => PK.TABLES.every(id => s.tables && s.tables[id] && s.tables[id].state)), 'both tables have a saved spot and state in every scene');
const lab = n => PK.TOWERS.map(t => PK.facing(P, t, S(n).towers[t].rot)).map(f => f.kind + ':' + f.faces.slice().sort().join('+')).join(' ');
ok(lab(3) === 'flat:A1 point:B1+B3 flat:C1 point:D2+D3', 'hallway: A1 flat, B1+B3 point, C1 flat, D2+D3 point');
ok(lab(9) === 'point:A1+A3 flat:B3 flat:C3 point:D2+D3', 'cafeteria: A1+A3 point, B3, C3, D2+D3 point');
ok(lab(16) === 'flat:A2 flat:B2 flat:C2 flat:D1', 'scene 16: A2, B2, C2, D1');
ok(Math.abs(S(7).towers.C.x - S(7).towers.B.x - P.stage.face) < 1e-9, 'B2 + C2 meet at an exact seam');
// the face order decides which face is on the audience's left in a point, never which faces show
const r1 = PK.rotFor(P, 'B', 'B1+B3'); P.towers.B.wind = 'cw'; const r2 = PK.rotFor(P, 'B', 'B1+B3'); P.towers.B.wind = 'ccw';
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
const mid = PK.tableBetween(P, ch.tmoves[0], 0.5), end = PK.tableBetween(P, ch.tmoves[0], 1);
ok(mid.k === 0 && end.k === 1 && end.label === 'deployed', 'a table travels folded and unfolds only at the end');
ok(PK.ft(7.5) === '7′ 6″' && PK.parseFt('7\' 6"') === 7.5 && PK.parseFt('-2') === -2, 'feet and inches');
ok(Math.abs(PK.frontY(P.stage, 0) + 20) < 1e-9 && Math.abs(PK.frontY(P.stage, 25.5) + 5) < 1e-9, 'the front edge: 20 ft at center, 5 ft at the proscenium');
process.exit(bad ? 1 : 0);
