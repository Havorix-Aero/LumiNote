// Generates the PWA icons and favicon so they can be regenerated without a design tool.
// Usage: node tools/generate-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../apps/web/public');

const BACKGROUND = [0x0f, 0x11, 0x15, 0xff];
const ACCENT = [0xf0, 0xb4, 0x29, 0xff];
const INK = [0x0f, 0x11, 0x15, 0xff];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** A luminous note: an accent page with ink lines and a spark. */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 100;
  const radius = 16 * s;

  const page = { left: 24 * s, top: 20 * s, right: 76 * s, bottom: 80 * s };
  const lines = [
    { y: 38 * s, from: 34 * s, to: 66 * s },
    { y: 50 * s, from: 34 * s, to: 66 * s },
    { y: 62 * s, from: 34 * s, to: 54 * s },
  ];
  const lineHalf = 2.4 * s;
  const spark = { x: 74 * s, y: 24 * s, r: 9 * s };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = BACKGROUND;

      const onPage = insideRoundedRect(
        px,
        py,
        page.left,
        page.top,
        page.right,
        page.bottom,
        radius,
      );
      if (onPage) color = ACCENT;

      if (onPage) {
        for (const line of lines) {
          if (
            px >= line.from &&
            px <= line.to &&
            py >= line.y - lineHalf &&
            py <= line.y + lineHalf
          ) {
            color = INK;
          }
        }
      }

      const dx = px - spark.x;
      const dy = py - spark.y;
      if (dx * dx + dy * dy <= spark.r * spark.r) color = ACCENT;

      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(publicDir, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(publicDir, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log('wrote', file);
}

writeFileSync(
  resolve(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#0f1115"/>
  <rect x="24" y="20" width="52" height="60" rx="10" fill="#f0b429"/>
  <g fill="#0f1115">
    <rect x="34" y="35.6" width="32" height="4.8" rx="2.4"/>
    <rect x="34" y="47.6" width="32" height="4.8" rx="2.4"/>
    <rect x="34" y="59.6" width="20" height="4.8" rx="2.4"/>
  </g>
  <circle cx="74" cy="24" r="9" fill="#f0b429"/>
</svg>
`,
);
console.log('wrote favicon.svg');
