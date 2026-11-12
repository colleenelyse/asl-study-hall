/* "How Old Is Charlie?" (Colleen, 2026-10-15): one character at 13 stages of life (Colleen's pictures). Each stage owns a range of ages, and together the
   ranges cover every age from 1 to 99, so any age can be the answer. Charlie keeps the same face, skin and dark curly hair (going gray) at every age. */
window.CHARLIE = (function () {
  const NAME = 'Charlie';
  const STAGES = [      /* [key, the age in Colleen's picture, lowest right answer, highest right answer]; together they cover every age 1-99 */
    ['1', 1, 1, 2], ['3', 3, 3, 5], ['8', 8, 6, 10], ['13', 13, 11, 14], ['17', 17, 15, 19], ['25', 25, 20, 29], ['35', 35, 30, 39], ['45', 45, 40, 49],
    ['55', 55, 50, 59], ['65', 65, 60, 69], ['75', 75, 70, 79], ['85', 85, 80, 89], ['95', 95, 90, 99]
  ];
  const SKIN = '#c68a62', SKIN_SH = '#a86f4c', SKIN_HI = '#dba37d', BLUSH = '#d98272', LIP = '#a9564c', EYE = '#2b1a12', LINE = '#8f5a3d';
  const HAIR = ['#2e1c12', '#2e1c12', '#2e1c12', '#2e1c12', '#33200f', '#3a2618', '#4f3d31', '#857c74', '#b3aea7', '#d6d3cf', '#ebe9e6'];
  const BG = ['#fde8d7', '#e3f1fb', '#e8e4fb', '#fbe3ea', '#e2f4ec', '#fdf0d5', '#e6eefb', '#f3e6f7', '#e5f3f1', '#f8ebe0', '#ecebf6'];
  const TOP = ['#f6b8c8', '#4fa3e0', '#7d6bd6', '#e0546c', '#2f9e7a', '#e5a52f', '#3f6fc8', '#9a5bb5', '#3c9a92', '#c97a4a', '#6d6aa8'];
  const P = (d, fill, extra) => '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>';
  const S = (d, stroke, w, extra) => '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';
  const E = (cx, cy, rx, ry, fill, extra) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra || '') + '/>';
  function curls(cx, cy, rx, ry, n, r, color, seed, a0, a1) {      /* a cloud of round curls around an ellipse (or along part of it, from angle a0 to a1) */
    let out = '', s = seed || 1; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280, A0 = a0 === undefined ? 0 : a0, A1 = a1 === undefined ? Math.PI * 2 : a1;
    for (let i = 0; i < n; i++) { const a = A0 + (i / (a1 === undefined ? n : n - 1)) * (A1 - A0), rr = r * (0.8 + rnd() * 0.45); out += '<circle cx="' + (cx + Math.cos(a) * rx).toFixed(1) + '" cy="' + (cy + Math.sin(a) * ry).toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + color + '"/>'; }
    return out;
  }
  function svg(i) {
    const k = STAGES[i][0], hair = HAIR[i], top = TOP[i], old = i >= 6, older = i >= 7, oldest = i >= 9;
    /* head shape and where the face sits: a baby's head is big and round with the features low; a grown face is longer */
    const H = [ { cx: 150, cy: 158, rx: 76, ry: 74, eyeY: 170, eyeDx: 26, eyeR: 9.5, noseY: 188, mouthY: 206, sh: 50 },
                { cx: 150, cy: 148, rx: 62, ry: 70, eyeY: 152, eyeDx: 24, eyeR: 8, noseY: 172, mouthY: 190, sh: 70 },
                { cx: 150, cy: 140, rx: 56, ry: 70, eyeY: 138, eyeDx: 22, eyeR: 7, noseY: 162, mouthY: 182, sh: 86 } ][Math.min(i, 2)] ||
              { cx: 150, cy: 136, rx: 55 - (oldest ? 3 : 0), ry: 72, eyeY: 132, eyeDx: 22, eyeR: 6.5, noseY: 158, mouthY: 180, sh: 96 };
    const { cx, cy, rx, ry, eyeY, eyeDx, eyeR, noseY, mouthY, sh } = H;
    let o = '<svg viewBox="0 0 300 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + NAME + '">';
    o += '<rect width="300" height="320" rx="26" fill="' + BG[i] + '"/>';
    /* hair behind the head */
    if (k === 'teen' || k === '20s') o += P('M' + (cx - rx - 14) + ' ' + (cy - 10) + ' C ' + (cx - rx - 30) + ' 260, ' + (cx - 70) + ' 300, ' + (cx - 40) + ' 300 L ' + (cx + 40) + ' 300 C ' + (cx + 70) + ' 300, ' + (cx + rx + 30) + ' 260, ' + (cx + rx + 14) + ' ' + (cy - 10) + ' Z', hair) + curls(cx, cy + 40, rx + 22, 95, 22, 18, hair, 3);
    if (k === '30s') o += curls(cx, cy + 20, rx + 18, 70, 20, 17, hair, 5);
    if (k === '90s') o += E(cx, cy - ry - 8, 26, 20, hair);      /* a small bun */
    /* shoulders and clothes */
    const sw = sh + 40, bodyTop = cy + ry - 6;
    o += P('M' + (cx - sw) + ' 320 C ' + (cx - sw) + ' ' + (bodyTop + 50) + ', ' + (cx - sw * 0.55) + ' ' + (bodyTop + 22) + ', ' + cx + ' ' + (bodyTop + 22) + ' C ' + (cx + sw * 0.55) + ' ' + (bodyTop + 22) + ', ' + (cx + sw) + ' ' + (bodyTop + 50) + ', ' + (cx + sw) + ' 320 Z', top);
    /* neck */
    o += P('M' + (cx - 20) + ' ' + (cy + ry - 30) + ' L ' + (cx - 21) + ' ' + (bodyTop + 26) + ' C ' + (cx - 10) + ' ' + (bodyTop + 34) + ', ' + (cx + 10) + ' ' + (bodyTop + 34) + ', ' + (cx + 21) + ' ' + (bodyTop + 26) + ' L ' + (cx + 20) + ' ' + (cy + ry - 30) + ' Z', SKIN_SH);
    if (k === 'baby') o += P('M' + (cx - 40) + ' ' + (bodyTop + 24) + ' Q ' + cx + ' ' + (bodyTop + 52) + ' ' + (cx + 40) + ' ' + (bodyTop + 24) + ' L ' + (cx + 34) + ' ' + (bodyTop + 22) + ' Q ' + cx + ' ' + (bodyTop + 38) + ' ' + (cx - 34) + ' ' + (bodyTop + 22) + ' Z', '#ffffff', ' opacity=".9"');      /* a bib collar */
    if (k === '70s') for (let j = -4; j <= 4; j++) o += E(cx + j * 9, bodyTop + 30 + Math.abs(j) * -1.6 + j * j * 0.4, 4.2, 4.2, '#f5f1ea');      /* pearls */
    if (oldest) o += P('M' + (cx - sw) + ' 320 C ' + (cx - sw + 6) + ' ' + (bodyTop + 40) + ', ' + (cx - 40) + ' ' + (bodyTop + 28) + ', ' + (cx - 14) + ' 320 Z M' + (cx + sw) + ' 320 C ' + (cx + sw - 6) + ' ' + (bodyTop + 40) + ', ' + (cx + 40) + ' ' + (bodyTop + 28) + ', ' + (cx + 14) + ' 320 Z', '#ffffff', ' opacity=".35"');      /* a cardigan */
    /* ears and head */
    o += E(cx - rx + 2, eyeY + 12, 9, 13, SKIN_SH) + E(cx + rx - 2, eyeY + 12, 9, 13, SKIN_SH);
    if (i >= 2 && i <= 8) o += '<circle cx="' + (cx - rx + 1) + '" cy="' + (eyeY + 26) + '" r="3.2" fill="#f2c94c"/><circle cx="' + (cx + rx - 1) + '" cy="' + (eyeY + 26) + '" r="3.2" fill="#f2c94c"/>';      /* earrings */
    o += E(cx, cy, rx, ry, SKIN);
    o += E(cx - rx * 0.35, cy - ry * 0.35, rx * 0.45, ry * 0.35, SKIN_HI, ' opacity=".45"');      /* light on the forehead */
    if (oldest) o += P('M' + (cx - rx + 6) + ' ' + (cy + 10) + ' Q ' + (cx - rx * 0.6) + ' ' + (cy + ry * 0.8) + ' ' + cx + ' ' + (cy + ry - 2) + ' Q ' + (cx + rx * 0.6) + ' ' + (cy + ry * 0.8) + ' ' + (cx + rx - 6) + ' ' + (cy + 10), SKIN_SH, ' opacity=".35"');      /* softer jaw */
    /* hair on top and around the face */
    if (k === 'baby') o += curls(cx, cy - ry + 6, 16, 6, 6, 9, hair, 2);
    else if (k === 'child') { o += P('M' + (cx - rx) + ' ' + (cy - 6) + ' C ' + (cx - rx) + ' ' + (cy - ry - 20) + ', ' + (cx + rx) + ' ' + (cy - ry - 20) + ', ' + (cx + rx) + ' ' + (cy - 6) + ' C ' + (cx + rx - 8) + ' ' + (cy - ry + 10) + ', ' + (cx - rx + 8) + ' ' + (cy - ry + 10) + ', ' + (cx - rx) + ' ' + (cy - 6) + ' Z', hair); o += curls(cx - rx - 10, cy - ry + 4, 14, 14, 10, 13, hair, 4) + curls(cx + rx + 10, cy - ry + 4, 14, 14, 10, 13, hair, 6) + '<circle cx="' + (cx - rx + 2) + '" cy="' + (cy - ry + 18) + '" r="5" fill="#f4d03f"/><circle cx="' + (cx + rx - 2) + '" cy="' + (cy - ry + 18) + '" r="5" fill="#f4d03f"/>'; }      /* two puffs with hair ties */
    else {
      const len = { teen: 1, '20s': 1, '30s': 0.75, '40s': 0.55, '50s': 0.5, '60s': 0.35, '70s': 0.32, '80s': 0.3, '90s': 0.2 }[k];
      o += curls(cx, cy - ry * 0.42, rx + 4, ry * 0.62, 14, 15, hair, 7 + i, Math.PI * 1.02, Math.PI * 1.98);      /* curls along the top only, above the forehead */
      o += P('M' + (cx - rx - 6) + ' ' + (cy + 4) + ' C ' + (cx - rx - 8) + ' ' + (cy - ry - 18) + ', ' + (cx + rx + 8) + ' ' + (cy - ry - 18) + ', ' + (cx + rx + 6) + ' ' + (cy + 4) + ' C ' + (cx + rx - 4) + ' ' + (cy - ry * 0.55) + ', ' + (cx - rx + 4) + ' ' + (cy - ry * 0.55) + ', ' + (cx - rx - 6) + ' ' + (cy + 4) + ' Z', hair);
      if (len >= 0.5) o += curls(cx - rx - 4, cy + ry * len * 0.6, 8, ry * len * 0.55, 6, 13, hair, 9) + curls(cx + rx + 4, cy + ry * len * 0.6, 8, ry * len * 0.55, 6, 13, hair, 11);
      if (k === '50s') o += S('M' + (cx - 6) + ' ' + (cy - ry - 12) + ' C ' + (cx - 24) + ' ' + (cy - ry - 4) + ', ' + (cx - rx + 6) + ' ' + (cy - ry * 0.75) + ', ' + (cx - rx - 2) + ' ' + (cy - ry * 0.4), '#c4bdb5', 7, ' opacity=".85"');      /* the first gray streak, in the hair */      /* the first gray streak */
    }
    /* eyebrows, eyes, smile lines */
    const browY = eyeY - (i === 0 ? 18 : 16), bc = i >= 8 ? '#9a918a' : '#2e1c12';
    o += S('M' + (cx - eyeDx - 11) + ' ' + (browY + 2) + ' Q ' + (cx - eyeDx) + ' ' + (browY - 4) + ' ' + (cx - eyeDx + 11) + ' ' + (browY + 1), bc, i === 0 ? 2 : 3.2);
    o += S('M' + (cx + eyeDx - 11) + ' ' + (browY + 1) + ' Q ' + (cx + eyeDx) + ' ' + (browY - 4) + ' ' + (cx + eyeDx + 11) + ' ' + (browY + 2), bc, i === 0 ? 2 : 3.2);
    [-1, 1].forEach(sd => { const ex = cx + sd * eyeDx;
      o += E(ex, eyeY, eyeR * 1.15, eyeR * (oldest ? 0.75 : 0.95), '#ffffff') + '<circle cx="' + ex + '" cy="' + (eyeY + 0.5) + '" r="' + (eyeR * 0.72) + '" fill="' + EYE + '"/><circle cx="' + (ex + eyeR * 0.25) + '" cy="' + (eyeY - eyeR * 0.3) + '" r="' + (eyeR * 0.22) + '" fill="#fff"/>';
      if (i >= 3) o += S('M' + (ex - eyeR * 1.2) + ' ' + (eyeY - eyeR * 0.6) + ' Q ' + ex + ' ' + (eyeY - eyeR * 1.35) + ' ' + (ex + eyeR * 1.2) + ' ' + (eyeY - eyeR * 0.6), EYE, 2.2);      /* lashes / lid */
      if (old) { o += S('M' + (ex + sd * eyeR * 1.4) + ' ' + (eyeY - 2) + ' l ' + (sd * 7) + ' -3 M' + (ex + sd * eyeR * 1.4) + ' ' + (eyeY + 3) + ' l ' + (sd * 7) + ' 2', LINE, 1.6, ' opacity=".7"'); }      /* crow's feet */
      if (older) o += S('M' + (ex - eyeR) + ' ' + (eyeY + eyeR * 1.3) + ' Q ' + ex + ' ' + (eyeY + eyeR * 1.9) + ' ' + (ex + eyeR) + ' ' + (eyeY + eyeR * 1.3), LINE, 1.6, ' opacity=".6"');      /* under the eyes */
    });
    if (older) o += S('M' + (cx - 26) + ' ' + (cy - ry * 0.62) + ' q 26 -6 52 0 M' + (cx - 20) + ' ' + (cy - ry * 0.5) + ' q 20 -5 40 0', LINE, 1.6, ' opacity=".55"');      /* forehead lines */
    /* nose, cheeks, mouth */
    o += S('M' + (cx - 6) + ' ' + noseY + ' Q ' + cx + ' ' + (noseY + 5) + ' ' + (cx + 6) + ' ' + noseY, SKIN_SH, 3) + E(cx, noseY - 6, i === 0 ? 5 : 6, 7, SKIN_HI, ' opacity=".5"');
    o += E(cx - eyeDx - 6, mouthY - 10, 13, 8, BLUSH, ' opacity="' + (i <= 2 ? '.55' : '.3') + '"') + E(cx + eyeDx + 6, mouthY - 10, 13, 8, BLUSH, ' opacity="' + (i <= 2 ? '.55' : '.3') + '"');
    if (i >= 5) o += S('M' + (cx - 22) + ' ' + (noseY + 2) + ' Q ' + (cx - 30) + ' ' + (mouthY - 4) + ' ' + (cx - 24) + ' ' + (mouthY + 4) + ' M' + (cx + 22) + ' ' + (noseY + 2) + ' Q ' + (cx + 30) + ' ' + (mouthY - 4) + ' ' + (cx + 24) + ' ' + (mouthY + 4), LINE, 1.8, ' opacity="' + (older ? '.65' : '.4') + '"');      /* smile lines */
    const mw = i === 0 ? 11 : 16;
    o += P('M' + (cx - mw) + ' ' + mouthY + ' Q ' + cx + ' ' + (mouthY + (i === 0 ? 8 : 12)) + ' ' + (cx + mw) + ' ' + mouthY + ' Q ' + cx + ' ' + (mouthY + 3) + ' ' + (cx - mw) + ' ' + mouthY + ' Z', i === 0 ? '#c0675b' : LIP);
    if (k === 'child') o += '<rect x="' + (cx - 7) + '" y="' + (mouthY + 1) + '" width="5" height="4" fill="#fff"/><rect x="' + (cx + 2) + '" y="' + (mouthY + 1) + '" width="5" height="4" fill="#fff"/>';      /* two front teeth showing */
    if (oldest) o += S('M' + (cx - 10) + ' ' + (mouthY + 14) + ' q 10 4 20 0', LINE, 1.4, ' opacity=".5"');
    /* glasses from her 50s */
    if (i >= 6) { const gc = i >= 9 ? '#7a5c8a' : '#5b4636'; [-1, 1].forEach(sd => { o += '<rect x="' + (cx + sd * eyeDx - 14) + '" y="' + (eyeY - 11) + '" width="28" height="22" rx="9" fill="#ffffff" fill-opacity=".12" stroke="' + gc + '" stroke-width="2.6"/>'; }); o += S('M' + (cx - eyeDx + 14) + ' ' + (eyeY - 2) + ' Q ' + cx + ' ' + (eyeY - 7) + ' ' + (cx + eyeDx - 14) + ' ' + (eyeY - 2), gc, 2.4); }
    if (k === 'teen') o += S('M' + (cx - 12) + ' ' + (mouthY + 4) + ' L ' + (cx + 12) + ' ' + (mouthY + 4), '#c9d2da', 1.6, ' opacity=".9"');      /* braces */
    return o + '</svg>';
  }
  /* Colleen's own pictures of Charlie go in the people/ folder; list each file here by stage key (like '14': 'people/charlie-14.png').
     A stage with no picture yet shows the drawing above. */
  const PICS = { '1': ['people/charlie-1.webp'], '3': ['people/charlie-3.webp'], '8': ['people/charlie-8.webp'], '13': ['people/charlie-13.webp'], '17': ['people/charlie-17.webp'],
    '25': ['people/charlie-25.webp', 'people/charlie-25-b.webp'], '35': ['people/charlie-35.webp', 'people/charlie-35-b.webp'], '45': ['people/charlie-45.webp', 'people/charlie-45-b.webp'],
    '55': ['people/charlie-55.webp', 'people/charlie-55-b.webp'], '65': ['people/charlie-65.webp'], '75': ['people/charlie-75.webp'], '85': ['people/charlie-85.webp'], '95': ['people/charlie-95.webp'] };      /* Colleen's pictures (2026-10-15); two at some ages, one picked each round */
  const picture = i => { const L = PICS[STAGES[i][0]]; return L ? '<img src="' + L[Math.floor(Math.random() * L.length)] + '" alt="' + NAME + ' at one time of life">' : svg(i); };
  return { NAME, STAGES, svg, picture, PICS, stageOf: age => STAGES.findIndex(s => age >= s[2] && age <= s[3]) };
})();
