// news-image-20261120-entry — main.ts
// Draws Friday 20 November 2026's world news as ONE 1024x1024 PNG
// newspaper-style front page. Node 22+ stdlib only (node:zlib, node:fs,
// node:path). No network at runtime. Fully deterministic.
//
// SIX STORIES — every one verified against reporting dated 20 Nov 2026.
// 1. Trump pushes the Iran war decision to 2027 — "no rush", "see what
//    happens" after Jan 1 — Reuters, 20 Nov 2026; The Times of India,
//    20 Nov 2026.
// 2. Cyclone Akvan makes landfall near Gopalpur, Odisha, around noon
//    Friday; over 3 lakh people evacuated, 423 rescue teams deployed —
//    The Hindu live updates, 20 Nov 2026; The Daily Jagran, 20 Nov 2026.
// 3. Anthropic's Nasdaq debut: shares open at $111.50, briefly top a
//    $2 trillion valuation, close at $97.17, up 17% — largest IPO on
//    record at $81.3bn — Reuters / AJP, 20 Nov 2026.
// 4. South Korea's exports pass $1 trillion for the first time;
//    President Lee Jae Myung hails the milestone — AJP, 20 Nov 2026
//    (the threshold was crossed on 19 Nov; Lee's praise is 20 Nov).
// 5. Houthi missile damages Riyadh's PIF Tower; Saudi Arabia confirms
//    damage to several floors, no injuries — Gulf Business / The Daily
//    Jagran, 20 Nov 2026 (strike on Thursday 19 Nov; Saudi photos and
//    confirmation published 20 Nov).
// 6. Trump pardons late baseball legend Pete Rose for tax crimes —
//    Reuters / CNN, reported 20 Nov 2026 (announced Thursday 19 Nov US
//    time). The pardon covers the tax case, not the Hall of Fame vote.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const buf = Buffer.alloc(W * H * 4);

type C = [number, number, number];
function rgb(r: number, g: number, b: number): C {
  return [r, g, b];
}
const PAPER = rgb(248, 244, 233);
const INK = rgb(18, 18, 18);
const RED = rgb(178, 34, 44);
const NAVY = rgb(28, 56, 108);
const TEAL = rgb(13, 115, 108);
const ORANGE = rgb(228, 118, 38);
const GOLD = rgb(212, 162, 30);
const GREY = rgb(92, 88, 80);
const LIGHT = rgb(234, 228, 215);
const SKY = rgb(176, 208, 232);
const SEA = rgb(22, 88, 118);
const WHITE = rgb(255, 255, 255);
const GREEN = rgb(24, 120, 60);

function px(x: number, y: number, c: C): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

function rect(x: number, y: number, w: number, h: number, c: C): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) px(i, j, c);
  }
}

function hline(x: number, y: number, w: number, c: C, t = 1): void {
  rect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: C, t = 1): void {
  rect(x, y, t, h, c);
}

// Bresenham line
function line(x0: number, y0: number, x1: number, y1: number, c: C, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (t === 1) px(x, y, c);
    else rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: C): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) px(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: C): void {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}

// filled triangle (scanline)
function tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: C): void {
  const minY = Math.min(y1, y2, y3);
  const maxY = Math.max(y1, y2, y3);
  const edges: Array<[number, number, number, number]> = [
    [x1, y1, x2, y2],
    [x2, y2, x3, y3],
    [x3, y3, x1, y1],
  ];
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) px(x, y, c);
    }
  }
}

// ------------------------------------------------------------------ font
// 5x7 bitmap font. Each glyph: 7 rows of 5 cells ('#' = on).
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '....#', '...#.', '..#..', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '\u2022': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawChar(x: number, y: number, ch: string, scale: number, c: C): void {
  const g = FONT[ch] ?? FONT['?'];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') rect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}

function drawText(x: number, y: number, s: string, scale: number, c: C): number {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx;
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: C): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Word-wrap `s` into lines no wider than maxW, drawn at (x, y).
// Returns the y just below the last line.
function drawWrapped(x: number, y: number, maxW: number, s: string, scale: number, c: C, leading?: number): number {
  const lh = leading ?? Math.round(7 * scale * 1.45);
  const words = s.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (textWidth(trial, scale) > maxW && line) {
      drawText(x, cy, line, scale, c);
      cy += lh;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) drawText(x, cy, line, scale, c);
  return cy + lh;
}

// ------------------------------------------------------------- PNG write
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function writePNG(path: string): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// =================================================================== page
rect(0, 0, W, H, PAPER);
// outer double border
rect(0, 0, W, 6, INK);
rect(0, H - 6, W, 6, INK);
rect(0, 0, 6, H, INK);
rect(W - 6, 0, 6, H, INK);
rect(14, 14, W - 28, 2, INK);
rect(14, H - 16, W - 28, 2, INK);

// ---- masthead
drawTextCentered(512, 34, 'THE WORLD TODAY', 7, INK);
drawTextCentered(512, 92, 'FRIDAY  20 NOVEMBER 2026', 3, RED);
hline(28, 128, W - 56, INK, 3);
hline(28, 134, W - 56, INK, 1);
drawText(28, 146, 'ONE DAY  -  ONE PAGE  -  SIX STORIES', 2, GREY);
drawText(1024 - 28 - textWidth('PRICE: THE NEWS ITSELF', 2), 146, 'PRICE: THE NEWS ITSELF', 2, GREY);

// ---- lead story: Iran decision (full width band, y 168..428)
const LY = 168;
rect(28, LY, W - 56, 260, NAVY);
// clock motif on the right half: a big clock face with hands at 10:10
// and a "2027" calendar strip beneath it
disc(822, 268, 62, WHITE);
ring(822, 268, 62, 3, GOLD);
ring(822, 268, 52, 2, NAVY);
disc(822, 268, 6, RED);
line(822, 268, 822 - 26, 268 - 30, INK, 4);
line(822, 268, 822 + 34, 268 - 22, INK, 4);
// tick marks
for (let a = 0; a < 12; a++) {
  const rad = (a * Math.PI) / 6;
  const x1 = Math.round(822 + 54 * Math.cos(rad));
  const y1 = Math.round(268 + 54 * Math.sin(rad));
  const x2 = Math.round(822 + 60 * Math.cos(rad));
  const y2 = Math.round(268 + 60 * Math.sin(rad));
  line(x1, y1, x2, y2, GOLD, 2);
}
// calendar strip
rect(700, 348, 244, 52, WHITE);
hline(700, 348, 244, INK, 2);
hline(700, 398, 244, INK, 2);
vline(700, 348, 52, INK, 2);
vline(942, 348, 52, INK, 2);
rect(702, 350, 240, 14, RED);
drawTextCentered(822, 366, '2027', 3, INK);
// small stars around the clock
for (const [sx, sy] of [[664, 210], [664, 330], [960, 210], [960, 330]] as const) {
  line(sx - 6, sy, sx + 6, sy, GOLD, 2);
  line(sx, sy - 6, sx, sy + 6, GOLD, 2);
}

drawText(48, LY + 18, 'LEAD  -  WASHINGTON', 2, GOLD);
drawText(48, LY + 48, 'IRAN DECISION', 6, WHITE);
drawText(48, LY + 96, 'PUSHED TO 2027', 6, WHITE);
drawText(48, LY + 152, 'Trump says no rush on', 3, WHITE);
drawText(48, LY + 182, 'Iran: "see what happens"', 3, WHITE);
drawText(48, LY + 212, 'after Jan 1.', 3, WHITE);
drawText(48, LY + 240, 'Source: Reuters, 20 Nov 2026', 1, rgb(200, 205, 220));

// ---- row A: two stories, y 448..664
const AY = 448;
const ACOL = 470;
// A1: Cyclone Akvan (left)
drawText(28, AY, 'WEATHER  -  INDIA', 2, RED);
drawText(28, AY + 26, 'CYCLONE AKVAN', 3, INK);
drawText(28, AY + 52, 'HITS ODISHA', 3, INK);
// spiral motif
ring(88, AY + 118, 34, 5, TEAL);
ring(88, AY + 118, 22, 5, TEAL);
ring(88, AY + 118, 10, 5, TEAL);
disc(88, AY + 118, 5, RED);
// rain lines
for (let i = 0; i < 4; i++) {
  line(150 + i * 24, AY + 96, 140 + i * 24, AY + 118, SEA, 3);
  line(150 + i * 24, AY + 126, 140 + i * 24, AY + 148, SEA, 3);
}
drawText(250, AY + 96, '300,000', 3, TEAL);
drawText(250, AY + 126, 'EVACUATED', 2, INK);
const endA1 = drawWrapped(
  28, AY + 156, ACOL,
  'Storm crosses the coast near Gopalpur around noon on Friday.',
  2, INK,
);
drawText(28, endA1 + 8, 'Source: The Hindu, 20 Nov 2026', 1, GREY);
vline(512, AY, 216, INK, 2);

// A2: Anthropic IPO (right)
drawText(536, AY, 'MARKETS  -  TECH', 2, RED);
drawText(536, AY + 26, 'ANTHROPIC DEBUT', 3, INK);
drawText(536, AY + 52, 'TOPS $2 TRILLION', 3, INK);
// share-price chart motif: axis + line rising to a peak, then easing
rect(536, AY + 88, 220, 56, INK);
line(548, AY + 132, 548, AY + 96, WHITE, 2);
line(548, AY + 132, 744, AY + 132, WHITE, 2);
line(552, AY + 128, 590, AY + 118, GREEN, 3);
line(590, AY + 118, 630, AY + 100, GREEN, 3);
line(630, AY + 100, 668, AY + 108, GOLD, 3);
line(668, AY + 108, 706, AY + 116, GOLD, 3);
disc(630, AY + 100, 5, GOLD);
drawText(716, AY + 92, '$111.50', 2, GOLD);
const endA2 = drawWrapped(
  536, AY + 156, ACOL,
  'Shares close at $97.17, up 17%, in the largest IPO on record.',
  2, INK,
);
drawText(536, endA2 + 8, 'Source: Reuters / AJP, 20 Nov 2026', 1, GREY);
hline(28, AY + 216, W - 56, INK, 2);

// ---- row B: three stories, y 684..916
const BY = 684;
const BCOL = 300;
// B1: South Korea exports
drawText(28, BY, 'ECONOMY  -  ASIA', 2, RED);
drawText(28, BY + 26, 'KOREA PASSES', 3, INK);
drawText(28, BY + 52, '$1 TRILLION', 3, INK);
// container ship motif
rect(28, BY + 112, 200, 10, INK);
tri(28, BY + 112, 228, BY + 112, 208, BY + 132, INK);
rect(48, BY + 82, 34, 30, RED);
rect(86, BY + 82, 34, 30, GOLD);
rect(124, BY + 82, 34, 30, NAVY);
rect(162, BY + 82, 34, 30, TEAL);
for (let x = 28; x < 228; x += 24) rect(x, BY + 140, 14, 5, SEA);
const endB1 = drawWrapped(
  28, BY + 164, BCOL,
  'Exports top $1 trillion for the first time; Lee hails the milestone.',
  2, INK,
);
drawText(28, endB1 + 8, 'Source: AJP, 20 Nov 2026', 1, GREY);
vline(348, BY, 232, INK, 1);

// B2: PIF Tower Riyadh
drawText(368, BY, 'MIDDLE EAST', 2, RED);
drawText(368, BY + 26, 'RIYADH TOWER', 3, INK);
drawText(368, BY + 52, 'HIT IN STRIKE', 3, INK);
// tower motif with burst at the top and broken windows
rect(448, BY + 104, 56, 56, NAVY);
rect(448, BY + 104, 56, 6, INK);
for (let r = 0; r < 4; r++) {
  for (let c2 = 0; c2 < 3; c2++) {
    rect(456 + c2 * 16, BY + 118 + r * 12, 8, 6, GOLD);
  }
}
rect(468, BY + 130, 8, 6, INK);
rect(484, BY + 142, 8, 6, INK);
disc(476, BY + 94, 14, ORANGE);
disc(476, BY + 94, 7, GOLD);
line(476, BY + 94, 448, BY + 78, ORANGE, 2);
line(476, BY + 94, 504, BY + 78, ORANGE, 2);
line(476, BY + 94, 476, BY + 76, ORANGE, 2);
const endB2 = drawWrapped(
  368, BY + 164, BCOL,
  'Houthi missile damages the PIF Tower; Saudi Arabia confirms it.',
  2, INK,
);
drawText(368, endB2 + 8, 'Source: Gulf Business, 20 Nov 2026', 1, GREY);
vline(688, BY, 232, INK, 1);

// B3: Pete Rose pardon
drawText(708, BY, 'SPORT  -  USA', 2, RED);
drawText(708, BY + 26, 'PETE ROSE', 3, INK);
drawText(708, BY + 52, 'PARDONED', 3, INK);
// baseball motif: ball with stitches + bat
disc(768, BY + 116, 30, WHITE);
ring(768, BY + 116, 30, 2, INK);
line(748, BY + 96, 756, BY + 136, RED, 2);
line(788, BY + 96, 780, BY + 136, RED, 2);
line(900, BY + 140, 948, BY + 108, INK, 6);
rect(940, BY + 102, 20, 8, INK);
drawText(820, BY + 100, '4,256', 2, INK);
drawText(820, BY + 122, 'HITS', 2, INK);
const endB3 = drawWrapped(
  708, BY + 164, BCOL,
  'Trump pardons baseball\'s hits leader for his 1990 tax case.',
  2, INK,
);
drawText(708, endB3 + 8, 'Source: Reuters, 20 Nov 2026', 1, GREY);

// ---- footer
hline(28, 936, W - 56, INK, 2);
drawTextCentered(
  512, 950,
  'SOURCES: REUTERS - THE HINDU - AJP - GULF BUSINESS - THE TIMES OF INDIA',
  2, INK,
);
drawTextCentered(
  512, 972,
  'ALL STORIES VERIFIED AGAINST REPORTING DATED 20 NOVEMBER 2026',
  2, GREY,
);

// ---- write
const outDir = process.env.MAKEFUN_OUTPUT_DIR || 'out';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
writePNG(outPath);
console.log('wrote', outPath, W + 'x' + H);
