#!/usr/bin/env node
// Encode the Blender outputs in art-src/ into shipped files in public/art/, and print every measured number.
// Usage (project root): node scripts/blender/encode-art.mjs
// Inputs: art-src/valley-dusk-key.png (1920x1080), art-src/valley-sky-overscan.png (4224x2048, 64 px wrap margin per side),
//         art-src/tex/<name>_{albedo,normal,rough}.png (1024^2) from scripts/blender/village_textures.py.
// JPEG: 4:4:4 chroma on anything that wraps (4:2:0 chroma at the image border made the wrap edge the worst block edge).
// Checks: size/aspect, average colour -> nearest palette token CIE76 dE (same maths as scripts/check-art.mjs),
//         seam percentile of the wrap pair on the *decoded JPEG* (100 = a seam; seamless sits mid-distribution),
//         horizon row of the panorama, and the dist budget (5,242,880 B).
// Exit 0 when every check passes.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => path.join(root, 'art-src', p);
const pub = (p) => path.join(root, 'public', 'art', p);
const palette = JSON.parse(fs.readFileSync(path.join(root, 'studio/art/palette.json'), 'utf8'));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lab(c) {
  const [r, g, b] = c.map(lin);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const names = Object.keys(palette), labs = names.map((n) => lab(rgb(palette[n])));
const DE_LIMIT = 25, BUDGET = 5242880;

const TEX = ['dirt-road', 'grass-dry', 'wood-planks-barn', 'roof-tiles-red', 'stone-wall', 'hay', 'fence-wood'];
// Normal maps only where relief reads at game distance; roughness only where it varies (puddles on the road).
const NORMALS = new Set(['dirt-road', 'wood-planks-barn', 'roof-tiles-red', 'stone-wall']);
const ROUGH = new Set(['dirt-road']);

async function raw(file) { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, ...info }; }
function avg({ data, width, height, channels }) {
  const s = [0, 0, 0]; for (let i = 0; i < data.length; i += channels) for (let k = 0; k < 3; k++) s[k] += data[i + k];
  return s.map((v) => Math.round(v / (width * height)));
}
function nearest(a) { const l = lab(a); let bi = 0, bd = Infinity; labs.forEach((p, i) => { const d = dE(l, p); if (d < bd) { bd = d; bi = i; } }); return { token: names[bi], dE: bd }; }
/** Percentile of the wrap pair's mean |diff| among interior neighbour pairs, per axis. The wrap pair (last -> first)
 *  always straddles a JPEG 8x8 block edge, so it is ranked only against interior pairs that also straddle a block edge
 *  (x % 8 == 7) within 136 px of either border (local: a panorama is not stationary, the sun side is noisier).
 *  Otherwise block artefacts alone would read as a seam on smooth images. */
function seam({ data, width: w, height: h, channels: c }, axes = 'uv') {
  const px = (x, y, k) => data[(y * w + x) * c + k];
  const pairDiff = (a, b, vert) => { let s = 0; const n = vert ? h : w; for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) s += vert ? Math.abs(px(a, t, k) - px(b, t, k)) : Math.abs(px(t, a, k) - px(t, b, k)); return s / n; };
  const out = {};
  if (axes.includes('u')) { const p = []; for (let x = 7; x < w - 1; x += 8) if (x < 136 || x > w - 136) p.push(pairDiff(x, x + 1, true)); const wv = pairDiff(w - 1, 0, true); out.u = (100 * p.filter((d) => d < wv).length) / p.length; out.uLv = wv / 3; }
  if (axes.includes('v')) { const p = []; for (let y = 7; y < h - 1; y += 8) if (y < 136 || y > h - 136) p.push(pairDiff(y, y + 1, false)); const wv = pairDiff(h - 1, 0, false); out.v = (100 * p.filter((d) => d < wv).length) / p.length; out.vLv = wv / 3; }
  return out;
}

let fail = false;
const rows = [];
async function ship(out, pipeline, opts = {}) {
  const tmp = out + '.tmp';
  await pipeline.toFile(tmp); fs.renameSync(tmp, out);
  const r = await raw(out), a = avg(r), n = nearest(a), bytes = fs.statSync(out).size;
  const s = opts.seam ? seam(r, opts.seam) : null;
  const warn = [];
  if (opts.size && (r.width !== opts.size[0] || r.height !== opts.size[1])) warn.push(`size ${r.width}x${r.height} != ${opts.size.join('x')}`);
  if (opts.palette && n.dE > DE_LIMIT) warn.push(`dE>${DE_LIMIT}`);
  // A seam = the wrap pair is the worst block edge near the border AND visible (> 2 levels per channel on average).
  if (s && ['u', 'v'].some((a) => s[a] >= 99.5 && s[a + 'Lv'] > 2)) warn.push('seam');
  if (warn.length) fail = true;
  rows.push({ file: path.relative(root, out).replaceAll('\\', '/'), bytes, res: `${r.width}x${r.height}`, avg: `rgb(${a})`, nearest: n.token, dE: +n.dE.toFixed(1), seam: s ? Object.entries(s).map(([k, v]) => k.endsWith('Lv') ? `(${v.toFixed(2)} lv)` : `${k}${v.toFixed(1)}`).join(' ') : '', warn: warn.join('; ') });
}

fs.mkdirSync(pub(''), { recursive: true });
// 1) key art
if (fs.existsSync(src('valley-dusk-key.png')))
  await ship(pub('valley-dusk-key.jpg'), sharp(src('valley-dusk-key.png')).jpeg({ quality: 84, mozjpeg: true }), { size: [1920, 1080] });
// 2) panorama: crop the 64 px overscan on each side -> exact 360 deg, wraps at u = 0/1
if (fs.existsSync(src('valley-sky-overscan.png'))) {
  const m = await sharp(src('valley-sky-overscan.png')).metadata();
  const M = (m.width - 4096) / 2, H = m.height;
  // Overscan column M + x and column M + 4096 + x look the same way; they differ only by render noise (~1 level).
  // Cross-fade the M-px margins with their twins (weight 0.5 at the wrap -> 0 at M px) so u = 0 and u = 1 meet exactly.
  const { data: o } = await sharp(src('valley-sky-overscan.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W0 = m.width, out = Buffer.alloc(4096 * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < 4096; x++) {
    const a = (y * W0 + M + x) * 3;
    let twin = -1, wgt = 0;
    if (x < M) { twin = (y * W0 + M + 4096 + x) * 3; wgt = 0.5 * (1 - x / M); }
    else if (x >= 4096 - M) { twin = (y * W0 + M + x - 4096) * 3; wgt = 0.5 * (1 - (4095 - x) / M); }
    for (let k = 0; k < 3; k++) out[(y * 4096 + x) * 3 + k] = twin < 0 ? o[a + k] : Math.round(o[a + k] * (1 - wgt) + o[twin + k] * wgt);
  }
  await ship(pub('valley-sky.jpg'), sharp(out, { raw: { width: 4096, height: H, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }),
    { size: [4096, 2048], seam: 'u' });
}
// 3) textures
for (const t of TEX) {
  if (!fs.existsSync(src(`tex/${t}_albedo.png`))) continue;
  await ship(pub(`${t}.jpg`), sharp(src(`tex/${t}_albedo.png`)).jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' }), { size: [1024, 1024], seam: 'uv', palette: true });
  if (NORMALS.has(t)) await ship(pub(`${t}_normal.jpg`), sharp(src(`tex/${t}_normal.png`)).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' }), { size: [1024, 1024], seam: 'uv' });
  if (ROUGH.has(t)) await ship(pub(`${t}_rough.jpg`), sharp(src(`tex/${t}_rough.png`)).greyscale().jpeg({ quality: 85, mozjpeg: true }), { size: [1024, 1024], seam: 'uv' });
}
for (const r of rows) console.log(`${r.file}  ${r.res}  ${r.bytes} B  avg=${r.avg} nearest=${r.nearest} dE=${r.dE}${r.seam ? '  seam%=' + r.seam : ''}${r.warn ? '  FAIL: ' + r.warn : ''}`);
const texRows = rows.filter((r) => TEX.some((t) => r.file.endsWith(`/${t}.jpg`)));
if (texRows.length) { const w = texRows.reduce((a, b) => (b.dE > a.dE ? b : a)); console.log(`Worst texture palette drift: ${w.file} dE=${w.dE} (limit ${DE_LIMIT})`); }

// budget: dist = (dist minus its art/) + public/art
const dirSize = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0) : 0);
const artBytes = dirSize(pub('')), distBytes = dirSize(path.join(root, 'dist')), distArt = dirSize(path.join(root, 'dist', 'art'));
const projected = distBytes - distArt + artBytes;
console.log(`public/art total: ${artBytes} B (${fs.readdirSync(pub('')).length} files). dist now ${distBytes} B, projected after build ${projected} B / budget ${BUDGET} B -> ${projected <= BUDGET ? 'OK' : 'OVER'}`);
if (projected > BUDGET) fail = true;
process.exit(fail ? 1 : 0);
