// Generates the origami-style animal artwork (SVG) and every app icon (PNG) from
// one set of polygon definitions. No dependencies: includes a tiny polygon
// rasterizer and PNG encoder.  Run:  node scripts/art.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------- colours */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const shades = (base) => ({ b: base, l: mix(base, '#ffffff', 0.16), d: mix(base, '#000000', 0.16), x: mix(base, '#000000', 0.3) });
const STROKE = '#10131f';

/* ------------------------------------------------------------- helpers */
const P = (pts, s = 'b') => ({ pts, s });
function strip(center, widths, startShade = 0) {
  // center: [[x,y]...]; widths per point -> quads, each split into 2 triangles (a fold)
  const n = center.length;
  const norm = center.map((p, k) => {
    const a = center[Math.max(0, k - 1)], b = center[Math.min(n - 1, k + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [-dy / L, dx / L];
  });
  const L = center.map((p, k) => [p[0] + norm[k][0] * widths[k] / 2, p[1] + norm[k][1] * widths[k] / 2]);
  const R = center.map((p, k) => [p[0] - norm[k][0] * widths[k] / 2, p[1] - norm[k][1] * widths[k] / 2]);
  const out = [];
  for (let k = 0; k < n - 1; k++) {
    const alt = (k + startShade) % 2 === 0;
    out.push(P([L[k], L[k + 1], R[k + 1], R[k]], alt ? 'b' : 'l'));
  }
  return out;
}
function curl(x, y, angle, seg, n, turn, acc, w0, w1, shrink = 0.035) {
  const pts = [[x, y]];
  let a = angle;
  for (let k = 0; k < n; k++) {
    a += turn + acc * k;
    const r = (a * Math.PI) / 180, len = seg * (1 - k * shrink);
    x += Math.cos(r) * len; y += Math.sin(r) * len;
    pts.push([x, y]);
  }
  const widths = pts.map((_, k) => w0 + ((w1 - w0) * k) / (pts.length - 1));
  return strip(pts, widths);
}
const mirror = (polys) => polys.map((p) => P(p.pts.map(([x, y]) => [200 - x, y]), p.s));

/* -------------------------------------------------------------- animals */
const ART = {};

ART.eagle = { color: '#5d7d4b', polys: (() => {
  const tips = [[24, 84], [24, 56], [38, 34], [60, 20], [86, 18], [108, 26]];
  const bases = [[70, 126], [80, 118], [90, 110], [100, 103], [110, 97], [120, 93]];
  const wing = [];
  void tips; void bases;
  // Wing: leading edge from shoulder S to wingtip W, feathers hanging down-left from it.
  const S = [118, 96], W = [30, 20], f = [-0.82, 0.57];
  const ts = [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1], lens = [26, 42, 52, 54, 48, 36, 14];
  const B = ts.map((t) => [S[0] + (W[0] - S[0]) * t, S[1] + (W[1] - S[1]) * t]);
  const T = B.map((b, k) => [b[0] + f[0] * lens[k], b[1] + f[1] * lens[k]]);
  for (let k = 0; k < B.length - 1; k++) wing.push(P([B[k], B[k + 1], T[k + 1], T[k]], k % 2 ? 'l' : 'b'));
  const fq = [[150, 70], [170, 56], [186, 62], [186, 76]], fb = [[124, 104], [136, 98], [146, 98], [152, 104]];
  const wing2 = [];
  for (let k = 0; k < fq.length - 1; k++) wing2.push(P([fb[k], fq[k], fq[k + 1], fb[k + 1]], k % 2 ? 'd' : 'b'));
  return [
    ...wing2, ...wing,
    P([[70, 126], [120, 93], [126, 112]], 'd'),
    P([[70, 126], [126, 112], [112, 146], [96, 140]], 'b'),
    P([[120, 93], [148, 104], [140, 126], [126, 112]], 'l'),
    P([[126, 112], [140, 126], [112, 146]], 'd'),
    // head
    P([[140, 104], [152, 92], [160, 110]], 'l'),
    P([[152, 92], [168, 96], [160, 110]], 'b'),
    P([[168, 96], [182, 104], [176, 114], [160, 110]], 'l'),
    P([[176, 114], [182, 104], [184, 120]], 'd'),
    P([[148, 104], [160, 110], [146, 124]], 'b'),
    // tail
    P([[96, 140], [52, 150], [54, 164], [104, 150]], 'b'),
    P([[104, 150], [54, 164], [70, 176], [112, 156]], 'l'),
    // legs + talons
    P([[110, 146], [120, 148], [116, 170], [108, 170]], 'd'),
    P([[126, 140], [136, 136], [136, 166], [128, 166]], 'd'),
    P([[104, 170], [120, 170], [100, 180]], 'b'),
    P([[124, 166], [140, 166], [146, 176]], 'b')
  ];
})() };

ART.octopus = { color: '#a6afba', polys: (() => {
  const ring = [[100, 14], [118, 18], [131, 30], [137, 48], [134, 66], [124, 80], [112, 89], [100, 91], [88, 89], [76, 80], [66, 66], [63, 48], [69, 30], [82, 18]];
  const c = [100, 50];
  const head = ring.map((p, k) => P([c, p, ring[(k + 1) % ring.length]], ['l', 'b', 'd', 'b'][k % 4]));
  const left = [
    ...curl(72, 72, 172, 12, 8, 8, 4.5, 15, 5),
    ...curl(76, 84, 142, 13, 8, 4, 4.2, 15, 5),
    ...curl(86, 90, 114, 13, 8, 3, 4.0, 14, 5),
    ...curl(96, 92, 97, 14, 8, 1, 3.6, 13, 5)
  ];
  return [
    ...left, ...mirror(left), ...head,
    P([[84, 64], [91, 58], [98, 64], [91, 70]], 'x'),
    P([[102, 64], [109, 58], [116, 64], [109, 70]], 'x')
  ];
})() };

ART.snake = { color: '#e4e04a', polys: (() => {
  const body = [[10, 150], [30, 134], [50, 150], [74, 126], [98, 150], [122, 122], [144, 142], [160, 116], [162, 90], [170, 74]];
  const widths = [4, 9, 12, 15, 18, 20, 21, 21, 20, 18];
  return [
    ...strip(body, widths),
    P([[160, 72], [178, 60], [198, 74], [182, 88], [166, 86]], 'l'),
    P([[178, 60], [198, 74], [182, 74]], 'b'),
    P([[180, 68], [185, 66], [184, 71]], 'x')
  ];
})() };

ART.bird = { color: '#9a4be0', polys: [
  // wing (raised)
  P([[96, 122], [70, 34], [118, 104]], 'l'),
  P([[118, 104], [70, 34], [150, 108]], 'b'),
  P([[120, 106], [138, 70], [154, 108]], 'd'),
  // body
  P([[54, 152], [118, 112], [100, 140]], 'b'),
  P([[118, 112], [160, 104], [150, 126], [100, 140]], 'l'),
  P([[100, 140], [150, 126], [124, 150]], 'd'),
  // head + beak
  P([[156, 104], [172, 94], [176, 112], [160, 116]], 'b'),
  P([[172, 94], [196, 102], [176, 112]], 'l'),
  // tail
  P([[60, 148], [14, 156], [72, 138]], 'b'),
  P([[58, 152], [24, 182], [80, 146]], 'l')
] };

ART.dolphin = { color: '#8eaac6', polys: [
  P([[22, 112], [48, 100], [50, 112]], 'l'),
  P([[48, 100], [76, 84], [84, 104], [50, 112]], 'b'),
  P([[76, 84], [118, 86], [100, 108], [84, 104]], 'l'),
  P([[118, 86], [152, 112], [130, 122], [100, 108]], 'b'),
  P([[50, 112], [84, 104], [100, 108], [70, 122]], 'd'),
  P([[70, 122], [100, 108], [130, 122], [112, 130]], 'b'),
  P([[98, 87], [122, 60], [118, 90]], 'd'),
  P([[80, 116], [74, 140], [98, 120]], 'd'),
  P([[130, 122], [152, 112], [168, 148], [156, 152]], 'l'),
  P([[156, 152], [168, 148], [190, 142], [172, 158]], 'b'),
  P([[156, 152], [172, 158], [152, 178]], 'd'),
  P([[60, 96], [65, 94], [64, 99]], 'x')
] };

ART.wolf = { color: '#a37b98', polys: [
  // head (howling, muzzle up-right)
  P([[128, 92], [140, 66], [150, 82]], 'b'),
  P([[140, 66], [136, 50], [148, 58]], 'd'),
  P([[140, 66], [148, 58], [158, 62], [150, 82]], 'l'),
  P([[148, 58], [148, 48], [158, 62]], 'b'),
  P([[158, 62], [178, 42], [170, 58]], 'l'),
  P([[158, 62], [170, 58], [164, 74], [150, 82]], 'd'),
  // neck / chest
  P([[128, 92], [150, 82], [148, 110]], 'l'),
  P([[128, 92], [148, 110], [138, 132], [124, 128]], 'b'),
  // body
  P([[68, 100], [128, 92], [124, 128], [96, 112]], 'l'),
  P([[68, 100], [96, 112], [82, 132], [62, 122]], 'b'),
  P([[96, 112], [124, 128], [108, 134], [82, 132]], 'd'),
  // tail
  P([[66, 104], [38, 124], [26, 156], [44, 150], [62, 122]], 'b'),
  P([[50, 116], [26, 156], [38, 128]], 'l'),
  // legs
  P([[124, 128], [138, 132], [142, 172], [133, 172]], 'd'),
  P([[110, 132], [122, 132], [122, 172], [114, 172]], 'b'),
  P([[80, 130], [96, 128], [90, 150], [98, 172], [89, 172], [80, 150]], 'd'),
  P([[62, 122], [80, 130], [70, 150], [74, 172], [65, 172], [58, 148]], 'b')
] };

ART.turtle = { color: '#3fb6a8', polys: [
  // shell
  P([[48, 118], [70, 82], [86, 118]], 'b'),
  P([[70, 82], [100, 62], [86, 118]], 'l'),
  P([[100, 62], [114, 118], [86, 118]], 'b'),
  P([[100, 62], [130, 82], [114, 118]], 'l'),
  P([[130, 82], [152, 118], [114, 118]], 'b'),
  P([[86, 118], [100, 100], [114, 118]], 'd'),
  P([[44, 118], [156, 118], [150, 128], [50, 128]], 'd'),
  // head
  P([[150, 116], [170, 100], [176, 114], [158, 124]], 'b'),
  P([[170, 100], [190, 104], [176, 114]], 'l'),
  // legs + tail
  P([[126, 126], [144, 126], [150, 146], [134, 146]], 'b'),
  P([[58, 126], [76, 126], [70, 146], [54, 146]], 'b'),
  P([[50, 120], [30, 128], [50, 128]], 'l'),
  P([[180, 104], [184, 106], [180, 108]], 'x')
] };

/* ----------------------------------------------------------------- SVG */
function svg(name) {
  const { color, polys } = ART[name];
  const sh = shades(color);
  const body = polys.map((p) => `<polygon points="${p.pts.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(' ')}" fill="${p.s === 'x' ? STROKE : sh[p.s]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${name}"><g stroke="${STROKE}" stroke-opacity=".85" stroke-width="1.7" stroke-linejoin="round">${body}</g></svg>\n`;
}

/* ---------------------------------------------------------- rasterizer */
function canvas(w, h, bg) {
  const px = new Float32Array(w * h * 4);
  if (bg) { const c = hex(bg); for (let i = 0; i < w * h; i++) { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 1; } }
  return { w, h, px };
}
function inside(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
function fill(cv, pts, color, alpha = 1, S = 4) {
  const c = hex(color);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(cv.w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(cv.h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let hit = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) if (inside(pts, x + (sx + 0.5) / S, y + (sy + 0.5) / S)) hit++;
    if (!hit) continue;
    const a = (hit / (S * S)) * alpha, i = (y * cv.w + x) * 4;
    const da = cv.px[i + 3], oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) cv.px[i + k] = oa ? (c[k] * a + cv.px[i + k] * da * (1 - a)) / oa : 0;
    cv.px[i + 3] = oa;
  }
}
function line(cv, a, b, w, color, alpha) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
  fill(cv, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color, alpha);
}
function roundRect(cv, x, y, w, h, r, color) {
  const pts = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  fill(cv, pts, color);
}
function drawArt(cv, name, scale, ox, oy) {
  const { color, polys } = ART[name];
  const sh = shades(color);
  const T = ([x, y]) => [ox + x * scale, oy + y * scale];
  polys.forEach((p) => {
    const pts = p.pts.map(T);
    fill(cv, pts, p.s === 'x' ? STROKE : sh[p.s]);
    pts.forEach((q, k) => line(cv, q, pts[(k + 1) % pts.length], Math.max(1, 1.7 * scale), STROKE, 0.85));
  });
}

/* ----------------------------------------------------------------- PNG */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(cv) {
  const raw = Buffer.alloc((cv.w * 4 + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) {
    raw[y * (cv.w * 4 + 1)] = 0;
    for (let x = 0; x < cv.w; x++) {
      const i = (y * cv.w + x) * 4, o = y * (cv.w * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(cv.px[i]); raw[o + 1] = Math.round(cv.px[i + 1]); raw[o + 2] = Math.round(cv.px[i + 2]); raw[o + 3] = Math.round(cv.px[i + 3] * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* -------------------------------------------------------------- outputs */
const NAVY = '#151a2e', TILE = '#0f1220';
function icon(size, { rounded = true, pad = 0.1, bg = NAVY } = {}) {
  const cv = canvas(size, size, rounded ? null : bg);
  if (rounded) roundRect(cv, 0, 0, size, size, size * 0.22, bg);
  const inner = size * (1 - pad * 2);
  drawArt(cv, 'bird', inner / 200, size * pad - inner * 0.02, size * pad + inner * 0.04);
  return png(cv);
}
function foreground(size) { // Android adaptive icon foreground: transparent, art in the central 66%
  const cv = canvas(size, size);
  const inner = size * 0.6;
  drawArt(cv, 'bird', inner / 200, (size - inner) / 2, (size - inner) / 2 + inner * 0.03);
  return png(cv);
}

const write = (rel, data) => { const f = join(root, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); console.log('wrote', rel); };

Object.keys(ART).forEach((n) => write(`assets/art/${n}.svg`, svg(n)));
write('icons/icon-192.png', icon(192));
write('icons/icon-512.png', icon(512));
write('icons/maskable-512.png', icon(512, { rounded: false, pad: 0.2 }));
write('icons/apple-touch-icon.png', icon(180, { rounded: false, pad: 0.12 }));
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  write(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, icon(Math.round(48 * k), { pad: 0.1 }));
  write(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, foreground(Math.round(108 * k)));
}
write('android/app/src/main/res/drawable-xxhdpi/splash.png', icon(288, { pad: 0.1 }));
