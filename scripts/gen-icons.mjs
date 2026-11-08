// Generates the PWA PNG icons (mirrors public/icons/icon.svg) without extra dependencies.
// Usage: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x0f, 0x5d, 0x5a];
const FG = [0xff, 0xff, 0xff];

/** Shapes in a 512-unit design space. */
function shapes(maskable) {
  // Maskable icons need content inside the central 80 % safe zone.
  const s = maskable ? 0.78 : 1;
  const c = (v) => 256 + (v - 256) * s;
  return {
    radius: maskable ? 0 : 112,
    ring: { cx: 256, cy: 256, r: 150 * s, w: 28 * s },
    dots: [
      [256, 256, 46],
      [176, 178, 16],
      [340, 196, 12],
      [322, 338, 18],
      [188, 330, 10],
    ].map(([x, y, r]) => [c(x), c(y), r * s]),
  };
}

function coverage(x, y, sh) {
  // returns [bgAlpha, fgOn]
  const r = sh.radius;
  if (r > 0) {
    const qx = Math.max(r - x, 0, x - (512 - r));
    const qy = Math.max(r - y, 0, y - (512 - r));
    if (qx * qx + qy * qy > r * r) return [0, false];
  }
  const d = Math.hypot(x - sh.ring.cx, y - sh.ring.cy);
  if (Math.abs(d - sh.ring.r) <= sh.ring.w / 2) return [1, true];
  for (const [cx, cy, cr] of sh.dots) if (Math.hypot(x - cx, y - cy) <= cr) return [1, true];
  return [1, false];
}

function render(size, maskable) {
  const sh = shapes(maskable);
  const ss = 4; // supersampling
  const px = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) {
    px[j * (size * 4 + 1)] = 0;
    for (let i = 0; i < size; i++) {
      let a = 0, f = 0;
      for (let sj = 0; sj < ss; sj++)
        for (let si = 0; si < ss; si++) {
          const x = ((i + (si + 0.5) / ss) / size) * 512;
          const y = ((j + (sj + 0.5) / ss) / size) * 512;
          const [ba, on] = coverage(x, y, sh);
          a += ba;
          if (on) f += 1;
        }
      const n = ss * ss;
      const fr = a ? f / a : 0;
      const o = j * (size * 4 + 1) + 1 + i * 4;
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(BG[k] * (1 - fr) + FG[k] * fr);
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, size, px);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, false));
writeFileSync('public/icons/icon-512.png', render(512, false));
writeFileSync('public/icons/icon-maskable-512.png', render(512, true));
console.log('Icons written to public/icons/');
