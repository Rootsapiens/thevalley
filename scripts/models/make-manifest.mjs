// node scripts/models/make-manifest.mjs  -> studio/art/furniture-manifest.md + CREDITS.md lines (idempotent)
// Needs scripts/models/last-report.json (written by convert.py) and the Poly Haven author list.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const rep = JSON.parse(fs.readFileSync(path.join(root, 'scripts/models/last-report.json'), 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.join(root, 'scripts/models/spec.json'), 'utf8'));
const ph = await (await fetch('https://api.polyhaven.com/assets?t=models')).json();
const what = {
  table_kitchen_long: 'long painted kitchen/dining table', table_plain: 'small plain wooden table', chair_wood_a: 'painted wooden chair',
  chair_wood_b: 'painted wooden chair, tall back', stool_wood: 'painted wooden stool', stool_rustic: 'rustic round stool', nightstand: 'bedside table',
  wardrobe: 'tall painted wardrobe (rescaled to 2.0 m)', cupboard: 'painted cupboard / dresser', shelf_small: 'small painted shelf unit',
  shelf_tall_worn: 'tall worn bookshelf (put jars/books on it)', shelf_display: 'wooden display shelves', bed_old_frame: 'old iron bed frame (add a mattress)',
  daybed: 'vintage day bed', sideboard_long: 'long wooden sideboard', chest_wood: 'wooden treasure/storage chest', stove_barrel: 'barrel wood stove',
  stove_masonry: 'masonry heater / tiled stove', jug: 'painted ceramic jug', pot_clay: 'clay cooking pot', jar_ceramic: 'ceramic jar / vase',
  bucket_wood: 'wooden bucket', basket_wicker: 'wicker basket with lid', bowl_wood: 'wooden bowl', pot_enamel: 'enamel pot', pot_brass: 'brass pot',
  cutting_board: 'wooden cutting board', broom: 'wooden broom', bottles_wine: 'row of wine bottles', lamp_oil: 'vintage oil lamp (emissive flame)',
  lantern_wood: 'wooden lantern (glass is 25% alpha)', lantern_brass: 'brass storm lantern', chandelier_lantern: 'lantern chandelier (origin = top, hang from ceiling)',
  candlestick: 'turned wooden candlestick', candleholders_brass: 'brass candelabra set', barrel_wood: 'wooden barrel', barrel_wine: 'wine barrel',
  crate_small: 'wooden crate (long)', crate_large: 'wooden crate (large)', cafe_table_round: 'round cafe table', cafe_table_low: 'low cafe table',
  cafe_chair: 'cafe chair', cafe_barstool: 'bar stool', stool_folding: 'folding wooden stool', side_table: 'side table', bench_church: 'painted bench (church pew)',
  mirror_ornate: 'ornate wall mirror (origin = back face)', clock_wall: 'wall clock (origin = back face)', spinning_wheel: 'spinning wheel',
  rug_rect: 'rug, rectangular (flat colour, Kenney)', rug_round: 'rug, round (flat colour, Kenney)', table_cloth: 'table with cloth (Kenney)',
  kitchen_counter: 'kitchen counter module (Kenney, recoloured wood)', kitchen_sink: 'kitchen sink module (Kenney, recoloured wood)',
  bar_counter: 'bar counter: long sideboard scaled to 1.05 m height',
};
const rows = []; const credits = [];
let total = 0;
for (const e of spec) {
  const r = rep[e.out]; if (!r) throw new Error('missing ' + e.out);
  const [k, id] = e.src.split(':');
  const url = k === 'ph' ? `https://polyhaven.com/a/${id}` : 'https://kenney.nl/assets/furniture-kit';
  const author = k === 'ph' ? Object.keys(ph[id].authors).join(', ') : 'Kenney';
  const file = `public/models/${e.out}.glb`;
  const bytes = fs.statSync(path.join(root, file)).size; total += bytes;
  rows.push(`| ${e.out}.glb | ${what[e.out]} | ${url} | CC0 | ${r.tris} | ${bytes} | ${r.w}x${r.d}x${r.h} | ${e.room.replace('cafe', 'cafe')} |`);
  credits.push(`${file} | ${k === 'ph' ? 'Poly Haven' : 'Kenney Furniture Kit 2.0'} (${id}), CC0, by ${author}; decimated/recentred/textures shrunk with scripts/models/convert.py, 2026-10-19 | ${url} | ${author} (CC0)`);
}
const md = `# Furniture manifest (CC0, ready-made)

All files: \`public/models/*.glb\`, meters, +Y up, origin at bottom-centre of the footprint (exceptions in the description), front faces +Z (Poly Haven convention, check once in game).
Only the base-colour texture is kept (256 or 512 px JPEG, no normal/ORM maps) to stay under the 6 MB cap; roughness/metalness are constants.
Rebuild: \`node scripts/models/fetch-polyhaven.mjs <ids>\`, then \`blender -b -P scripts/models/convert.py -- <repo_root>\`, then \`node scripts/models/make-manifest.mjs\`.
Raw downloads (untrusted data, never executed): \`art-src/models/polyhaven/\`, \`art-src/models/kenney/\`.
Sources: Poly Haven (CC0, https://polyhaven.com/license) and Kenney Furniture Kit 2.0 (CC0, https://kenney.nl/assets/furniture-kit). No attribution is required; CREDITS.md credits the authors anyway.
Known gap: no ready-made CC0 stone fireplace or bed with mattress was found; use stove_masonry / stove_barrel and bed_old_frame (+ rug/pillow boxes). vintage_wooden_drawer_01 (Poly Haven) has a broken accessor and was skipped.

Total: ${spec.length} files, ${total} bytes (${(total / 1048576).toFixed(2)} MiB).

| file | what it is | source URL | license | triangles | bytes | footprint w x d x h (m) | suggested room |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
fs.writeFileSync(path.join(root, 'studio/art/furniture-manifest.md'), md);
let c = fs.readFileSync(path.join(root, 'CREDITS.md'), 'utf8');
let added = 0;
for (const line of credits) { const p = line.split(' | ')[0]; if (!c.includes(p + ' |')) { if (!c.endsWith('\n')) c += '\n'; c += line + '\n'; added++; } }
fs.writeFileSync(path.join(root, 'CREDITS.md'), c);
console.log('files', spec.length, 'bytes', total, 'credits added', added);
