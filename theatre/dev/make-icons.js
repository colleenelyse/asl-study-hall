/* node theatre/dev/make-icons.js — draws the app icon (a gold star on purple) as PNGs, no libraries */
const fs = require('fs'), zlib = require('zlib'), path = require('path');
function png(size, file, pad) {
  const px = Buffer.alloc(size * size * 4), cx = size / 2, cy = size / 2 + size * 0.02, R = size * (0.5 - pad) * 0.92, r = R * 0.45;
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  const inStar = (x, y) => { let c = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inStar(x + (sx + .5) / 4, y + (sy + .5) / 4)) n++;
    const t = n / 16, o = (y * size + x) * 4;
    px[o] = Math.round(0x6b * (1 - t) + 0xff * t); px[o + 1] = Math.round(0x3f * (1 - t) + 0xc8 * t); px[o + 2] = Math.round(0xd4 * (1 - t) + 0x3d * t); px[o + 3] = 255;
  }
  const raw = Buffer.alloc((size * 4 + 1) * size); for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const dir = path.join(__dirname, '../img');
png(192, path.join(dir, 'icon-192.png'), 0.1); png(512, path.join(dir, 'icon-512.png'), 0.1); png(512, path.join(dir, 'icon-maskable-512.png'), 0.2); png(180, path.join(dir, 'apple-touch-icon.png'), 0.1);
console.log('icons written');
