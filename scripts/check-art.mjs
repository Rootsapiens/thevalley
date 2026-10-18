#!/usr/bin/env node
// Usage: node scripts/check-art.mjs   (from project root)
// Exit: 0 ok, 1 check failed, 2 pngjs missing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const palette = JSON.parse(fs.readFileSync(path.join(root, 'studio/art/palette.json'), 'utf8'));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function lab(c) {
  const [r, g, b] = c.map(lin);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// HUD contrast: amber on the darkest background token
const names = Object.keys(palette);
const darkest = names.reduce((m, k) => (lum(rgb(palette[k])) < lum(rgb(palette[m])) ? k : m));
const ratio = contrast(rgb(palette.hudAmber), rgb(palette[darkest]));
console.log(`HUD contrast: hudAmber ${palette.hudAmber} on ${darkest} ${palette[darkest]} = ${ratio.toFixed(2)}:1 (need >= 4.5)`);
let fail = ratio < 4.5;
if (fail) console.log('FAIL: HUD contrast');

let PNG;
try {
  const m = await import('pngjs');
  PNG = (m.default ?? m).PNG;
} catch {
  console.error('pngjs is not installed. Run: npm i -D pngjs');
  process.exit(2);
}

const dir = path.join(root, 'art-incoming');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')) : [];
if (!files.length) console.log('art-incoming/: no PNGs yet.');
const labs = names.map((n) => lab(rgb(palette[n])));
const LIMIT = 25;
let worst = null;
for (const f of files) {
  const { width, height, data } = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  let r = 0, g = 0, b = 0, n = 0, semi = 0, clear = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) { clear++; continue; }
    if (a < 255) semi++;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  const hasAlpha = clear + semi > 0;
  if (!n) { console.log(`${f}: ${width}x${height} fully transparent  FAIL`); fail = true; continue; }
  const avg = [r / n, g / n, b / n].map(Math.round);
  const al = lab(avg);
  let bi = 0, bd = Infinity;
  labs.forEach((l, i) => { const d = dE(al, l); if (d < bd) { bd = d; bi = i; } });
  if (!worst || bd > worst.d) worst = { f, d: bd };
  const tex = /(floor|wall|grating|stripe|corrugated|pipe|panel|concrete)/.test(f);
  const warn = [];
  if (tex && (width !== 1024 || height !== 1024)) warn.push('texture not 1024x1024');
  if (tex && hasAlpha) warn.push('texture has alpha');
  if (hasAlpha && semi / (n + clear) > 0.02) warn.push(`halo ${((100 * semi) / (n + clear)).toFixed(1)}% semi-transparent`);
  if (bd > LIMIT) warn.push(`dE>${LIMIT}`);
  if (warn.length) fail = true;
  console.log(`${f}: ${width}x${height} alpha=${hasAlpha} semi=${semi} avg=rgb(${avg}) nearest=${names[bi]} dE=${bd.toFixed(1)}${warn.length ? '  FAIL: ' + warn.join('; ') : ''}`);
}
if (worst) console.log(`Worst palette drift: ${worst.f} dE=${worst.d.toFixed(1)}`);
process.exit(fail ? 1 : 0);
