#!/usr/bin/env node
// Usage: node scripts/export-village-json.mjs [out.json]   (from project root; default unreal/data/village-barn.json)
// Exports the approved barn slice from src/village.ts (read-only: it only imports the module) for the UE5 trial
// import scripts in unreal/scripts/. Next to out.json it also writes the full village blockout for build_village.py:
//   village-town.json   buildings, town solids (by group), paths, square, trees, stream, landmark checks
//   village-terrain.glb groundY() over the village map at 1 m (glTF: metres, +Y up = game space; UE imports to cm, +Z up)
// Units stay in game space: metres, x east, y up, z south. The UE side converts.
// Loader: Node >= 22.18 strips TypeScript types natively; a resolve hook adds the '.ts' the src/ imports omit.
// Fallback: Vite's runnerImport (already a devDependency). No new packages.
// Exit: 0 ok, 1 export or self-check failed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import module from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.argv[2] ?? 'unreal/data/village-barn.json');
const srcFile = path.join(root, 'src', 'village.ts');

if (typeof module.registerHooks === 'function') {
  module.registerHooks({
    resolve(spec, ctx, next) {
      if (/^\.\.?\//.test(spec) && !path.extname(spec) && ctx.parentURL?.endsWith('.ts')) {
        const cand = new URL(spec + '.ts', ctx.parentURL);
        if (fs.existsSync(fileURLToPath(cand))) return next(cand.href, ctx);
      }
      return next(spec, ctx);
    },
  });
}

async function load(file = srcFile) {
  try {
    return { mod: await import(pathToFileURL(file).href), loader: `node ${process.version} type stripping` };
  } catch (e) {
    const { runnerImport } = await import('vite');
    const r = await runnerImport(file);
    return { mod: r.module, loader: `vite runnerImport (native failed: ${String(e.message).split('\n')[0]})` };
  }
}

const { mod: V, loader } = await load();
const { mod: M } = await load(path.join(root, 'src', 'villageMap.ts'));

// ---------- Helpers ----------
const r3 = (n) => Math.round(n * 1000) / 1000;
const v3 = (p) => ({ x: r3(p.x), y: r3(p.y), z: r3(p.z) });
const boxOut = (b) => ({ min: v3(b.min), max: v3(b.max) });
const sha = crypto.createHash('sha256');
for (const f of ['village.ts', 'villageMap.ts', 'physics.ts']) sha.update(fs.readFileSync(path.join(root, 'src', f)));

/** The approved slice (decisions-noor.md item 2, ~50 x 65 m play area plus the mountain-path stop). */
const SLICE = { x0: -30, x1: 34, z0: -46, z1: 28 };
const inSlice = (x, z) => x >= SLICE.x0 && x <= SLICE.x1 && z >= SLICE.z0 && z <= SLICE.z1;

// The slice solids are villageSolids() minus the townSolids() tail it appends (same order, same count).
const all = V.villageSolids();
const town = []; V.townSolids(town);
const slice = all.slice(0, all.length - town.length);

const B = V.BARN, eps = 1e-6;
const near = (a, b, t = 0.12) => Math.abs(a - b) <= t;
const sameRect = (b, r) => near(b.min.x, r.x0, 0.01) && near(b.max.x, r.x1, 0.01) && near(b.min.z, r.z0, 0.01) && near(b.max.z, r.z1, 0.01);
const fences = V.fencesNow();
function classify(s) {
  const b = s.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, h = b.max.y - b.min.y;
  const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
  if (s.tag === 'invisible') return 'blocker';
  const inBarn = cx > B.x0 - eps && cx < B.x1 + eps && cz > B.z0 - eps && cz < B.z1 + eps;
  if (inBarn && (near(b.min.x, B.x0, 0.01) || near(b.max.x, B.x1, 0.01) || near(b.min.z, B.z0, 0.01) || near(b.max.z, B.z1, 0.01)) && h >= 5.9) return 'barn-shell';
  if (cz < B.z0 && cz > B.z0 - B.door.leaf - 0.01 && Math.abs(cx) <= B.door.x1 + 0.2) return 'barn-door';
  if (cz > B.z1 && Math.abs(cx - B.back.x1) < 0.2) return 'barn-door';
  if (inBarn && Math.abs(cx) > V.STALLS.partitionFrom - 0.01 && Math.abs(cx) < V.STALLS.mangerBack + 0.3 && h <= V.BARN.eave + 0.01) {
    if (h >= V.BARN.eave - 0.01) return 'barn-post';
    return h > 1.2 ? 'stall' : 'manger';
  }
  if (inBarn) return 'barn-prop';
  if ([V.FARMHOUSE, ...V.HOUSES, V.H3].some((r) => sameRect(b, r))) return 'building';
  if (sameRect(b, V.TROUGH) || sameRect(b, V.KENNEL)) return 'yard-prop';
  if (near(cx, V.SHRINE.x, 0.01) && near(cz, V.SHRINE.z, 0.01)) return 'shrine';
  if (V.TREES.some((t) => near(cx, t.x, 0.01) && near(cz, t.z, 0.01))) return 'tree';
  if (near(cz, V.NORTH_WALL_Z, 0.01) && sz <= 0.61) return 'stone-wall';
  if (fences.some(([x0, z0, x1, z1]) => near(b.min.x, Math.min(x0, x1) - 0.08, 0.01) && near(b.max.z, Math.max(z0, z1) + 0.08, 0.01)) && Math.min(sx, sz) <= 0.17) return 'fence';
  return 'misc';
}
const boxes = slice.map((s) => ({ group: classify(s), ...boxOut(s.box) }));

// Ground under the slice, sampled every 2 m (the barn corner is flat at y = 0; the town slopes start east).
const STEP = 2, nx = Math.round((SLICE.x1 - SLICE.x0) / STEP) + 1, nz = Math.round((SLICE.z1 - SLICE.z0) / STEP) + 1;
const heights = [];
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) heights.push(r3(V.groundY(SLICE.x0 + i * STEP, SLICE.z0 + j * STEP)));

const deg = Math.PI / 180;
const spawnBearing = r3(-V.SPAWN_YAW / deg);   // yaw 0 looks north (-Z), positive turns left: bearing = -yaw
const text = (t) => ({ en: t.en, ar: t.ar });

// Independent JS implementation of the UE conversion (cm, +Z up, X east, Y south). unreal/scripts/ov_units.py must agree.
const toUE = (p) => ({ x: r3(p.x * 100), y: r3(p.z * 100), z: r3(p.y * 100) });
const shrine = { x: V.SHRINE.x, y: 0, z: V.SHRINE.z };

const data = {
  schema: 'omega-valley/village-barn@1',
  source: { file: 'src/village.ts', sha256: sha.digest('hex').slice(0, 16), loader: loader.startsWith('node') ? 'node-strip-types' : 'vite-runnerImport' },
  units: { length: 'm', axes: 'x east, y up, z south (right-handed, Three.js)', yaw: 'rad; 0 looks north (-z), positive turns left', bearing: 'deg; 0 north, 90 east' },
  ueConversion: { length: 'cm = m * 100', axes: 'UE X = x (east), UE Y = z (south), UE Z = y (up)', yaw: 'UE yaw deg = bearing - 90' },
  slice: SLICE,
  lighting: {
    sun: { ...V.SUN, colorTemperatureK: 2000, note: 'decisions-noor.md item 1: warm orange sun, cool blue sky and fog; mountain face brightest' },
    mountain: V.MOUNTAIN,
    fogHaze: '#2A3440', skyNight: '#0B1220',
  },
  landmarks: {
    caveMouth: { bearing: V.MOUNTAIN.caveBearing, distanceM: 2800, riseM: 280, widthM: 40, ref: 'world-bible.md: 2.8 km NE, 1,180 m vs village ~900 m, 40 m arch' },
    peak: { bearing: V.MOUNTAIN.bearing, riseM: 1450, ref: 'world-bible.md: peak 2,350 m' },
  },
  spawn: { pos: v3(V.SPAWN), yaw: Math.round(V.SPAWN_YAW * 1e6) / 1e6, bearing: spawnBearing, eyeHeight: r3(1.8 - 0.16), fovDeg: 70 },
  layout: {
    barn: B, stalls: V.STALLS, postsZ: V.POSTS_Z, loft: V.LOFT, farmhouse: V.FARMHOUSE, houses: V.HOUSES, h3: V.H3,
    trough: V.TROUGH, kennel: V.KENNEL, shrine: V.SHRINE, fenceZ: V.FENCE_Z, northWallZ: V.NORTH_WALL_Z, gap: V.GAP, trees: V.TREES,
    fences,
  },
  boxes,
  ground: { x0: SLICE.x0, z0: SLICE.z0, step: STEP, nx, nz, min: Math.min(...heights), max: Math.max(...heights), heights },
  examinables: V.EXAMINABLES.map((e) => ({ id: e.id, name: text(e.name), line: text(e.line), pos: v3(e.pos), r: e.r, from: v3(e.from) })),
  trail: { ctrl: V.TRAIL_CTRL, step: 0.5, points: V.trailPoints(0.5).map((p) => [r3(p.x), r3(p.z)]) },
  zones: { end: boxOut(V.END_ZONE.box) },
  checks: {
    landmark: { name: 'shrine', game: shrine, ueCm: toUE(shrine) },
    barnNorthDoor: { game: { x: 0, y: 0, z: B.z0 }, ueCm: toUE({ x: 0, y: 0, z: B.z0 }) },
    sunLightUE: { pitch: -V.SUN.elevation, yaw: r3(((V.SUN.bearing + 180 - 90) % 360 + 540) % 360 - 180), note: 'light travels away from the sun: bearing 60 (ENE), down 4 deg' },
    spawnYawUE: r3(spawnBearing - 90),
  },
};

// ---------- Self-checks (fail loudly instead of writing a bad file) ----------
const fail = [];
const counts = boxes.reduce((m, b) => ((m[b.group] = (m[b.group] ?? 0) + 1), m), {});
if (counts['barn-shell'] !== 6) fail.push(`barn-shell ${counts['barn-shell']} != 6`);
if (counts.stall !== 2 * (V.STALLS.perSide + 1)) fail.push(`stall partitions ${counts.stall}`);
if (data.examinables.length < 12) fail.push(`examinables ${data.examinables.length} < 12`);
if (V.SUN.bearing !== 240 || V.SUN.elevation !== 4 || V.MOUNTAIN.bearing !== 45) fail.push('SUN/MOUNTAIN differ from decisions-noor.md');
if (counts.misc) fail.push(`${counts.misc} unclassified boxes`);
if (data.checks.landmark.ueCm.x !== 2255 || data.checks.landmark.ueCm.y !== -3730) fail.push('shrine conversion');
if (fail.length) { console.error('export-village-json: FAILED\n  ' + fail.join('\n  ')); process.exit(1); }

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
const rel = path.relative(root, out).replaceAll('\\', '/');
console.log(`${rel}: ${boxes.length} boxes ${JSON.stringify(counts)}, ${data.examinables.length} examinables, ` +
  `${data.trail.points.length} trail pts, ground ${data.ground.min}..${data.ground.max} m (${loader})`);

// ---------- Full village blockout (build_village.py): village-town.json + village-terrain.glb ----------
const townOut = path.join(path.dirname(out), 'village-town.json');
const glbOut = path.join(path.dirname(out), 'village-terrain.glb');
const MAPR = M.MAP;
const within = (b, x, z, m = 0) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
const near2 = (list, x, z, t) => list.some((p) => Math.hypot(p.x - x, p.z - z) <= t);
function townGroup(s) {
  const b = s.box, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, h = b.max.y - b.min.y;
  const bl = M.BUILDINGS.find((q) => within(q, cx, cz, 0.05));
  if (bl) return { group: 'building', id: bl.id, kind: bl.kind };
  if (M.BUILDINGS.some((q) => within(q, cx, cz, 2.0)) && h <= 1.6 && Math.max(sx, sz) <= 3.5) return { group: 'step' };
  if (near2(M.OLIVES, cx, cz, 0.05) || near2(M.TOWN_PINES, cx, cz, 0.05) || near2(V.SLICE_PINES, cx, cz, 0.05)) return { group: 'tree' };
  if (near2(M.GRAVES, cx, cz, 0.05)) return { group: 'grave' };
  if (sx <= 0.37 && sz <= 0.37 && h >= 7) return { group: 'pole' };
  if (Math.min(sx, sz) <= 0.17) return { group: 'fence' };
  if (M.WALLS.some((w) => within({ x0: Math.min(w.x0, w.x1), x1: Math.max(w.x0, w.x1), z0: Math.min(w.z0, w.z1), z1: Math.max(w.z0, w.z1) }, cx, cz, 0.4))) return { group: 'wall' };
  if (M.STONES.some((st) => Math.hypot(st.x - cx, st.z - cz) < 0.05)) return { group: 'stone' };
  return { group: 'prop' };
}
const townList = []; V.townSolids(townList);
const townSolidsOut = townList.filter((s) => s.tag !== 'invisible').map((s) => ({ ...townGroup(s), ...boxOut(s.box) }));
// Terrain grid: 1 m over the map, plus a flat skirt ring 400 m out at the edge heights (no visible end of the world).
const xs = [MAPR.x0 - 400], zs = [MAPR.z0 - 400];
for (let x = MAPR.x0; x <= MAPR.x1 + 1e-9; x += 1) xs.push(x);
for (let z = MAPR.z0; z <= MAPR.z1 + 1e-9; z += 1) zs.push(z);
xs.push(MAPR.x1 + 400); zs.push(MAPR.z1 + 400);
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
const H = (x, z) => V.groundY(cl(x, MAPR.x0, MAPR.x1), cl(z, MAPR.z0, MAPR.z1));
const NX = xs.length, NZ = zs.length, pos = new Float32Array(NX * NZ * 3), nrm = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
let hmin = Infinity, hmax = -Infinity;
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const k = j * NX + i, x = xs[i], z = zs[j], y = H(x, z);
  pos.set([x, y, z], k * 3); uv.set([x / 2, z / 2], k * 2);
  hmin = Math.min(hmin, y); hmax = Math.max(hmax, y);
  const e = 0.5, dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
  nrm.set([-dx / l, 1 / l, -dz / l], k * 3);
}
const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
let q = 0;
for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
  const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
  idx.set([a, c, b, b, c, d], q); q += 6;            // counter-clockwise seen from +Y (glTF front face)
}
function writeGlb(file) {
  const parts = [pos, nrm, uv, idx].map((t) => Buffer.from(t.buffer, t.byteOffset, t.byteLength));
  const views = []; let off = 0;
  for (const p of parts) { views.push({ buffer: 0, byteOffset: off, byteLength: p.length }); off += p.length; }
  const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < pos.length; k += 3) for (let c = 0; c < 3; c++) { mins[c] = Math.min(mins[c], pos[k + c]); maxs[c] = Math.max(maxs[c], pos[k + c]); }
  const n = NX * NZ;
  const gltf = {
    asset: { version: '2.0', generator: 'scripts/export-village-json.mjs' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'VillageTerrain' }],
    meshes: [{ name: 'VillageTerrain', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min: mins, max: maxs },
      { bufferView: 1, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: n, type: 'VEC2' },
      { bufferView: 3, componentType: 5125, count: idx.length, type: 'SCALAR' },
    ],
    bufferViews: views, buffers: [{ byteLength: off }],
  };
  let json = Buffer.from(JSON.stringify(gltf));
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const bin = Buffer.concat(parts);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, json, bh, bin]));
  return { min: mins, max: maxs };
}
const bounds = writeGlb(glbOut);
const tower = M.BUILDINGS.find((b) => b.id === 'tower');
const towerC = { x: (tower.x0 + tower.x1) / 2, y: tower.floor, z: (tower.z0 + tower.z1) / 2 };
const streamS = []; for (let z = MAPR.z0; z <= MAPR.z1; z += 2) streamS.push([z, r3(M.streamX(z)), r3(M.streamHalf(z)), r3(M.waterY(z))]);
const townData = {
  schema: 'omega-valley/village-town@1', source: data.source, units: data.units, map: MAPR,
  terrain: { file: path.basename(glbOut), step: 1, skirtM: 400, nx: NX, nz: NZ, minY: r3(hmin), maxY: r3(hmax), boundsM: { min: bounds.min.map(r3), max: bounds.max.map(r3) } },
  buildings: M.BUILDINGS.map((b) => ({ ...b, floor: r3(b.floor), base: r3(b.base) })),
  solids: townSolidsOut,
  paths: M.PATHS, square: M.SQUARE, fountain: M.FOUNTAIN, policeCar: M.POLICE_CAR,
  trees: { olives: M.OLIVES.map((t) => ({ x: r3(t.x), z: r3(t.z), s: r3(t.s), y: r3(V.groundY(t.x, t.z)) })),
    pines: [...M.TOWN_PINES, ...V.SLICE_PINES].map((t) => ({ x: r3(t.x), z: r3(t.z), h: r3(t.h), y: r3(V.groundY(t.x, t.z)) })) },
  stream: { cols: ['z', 'x', 'half', 'waterY'], rows: streamS },
  checks: { tower: { game: v3(towerC), ueCm: toUE(towerC) }, terrainUeCm: { min: toUE({ x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] }), max: toUE({ x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] }) } },
};
const tc = townSolidsOut.reduce((m, b) => ((m[b.group] = (m[b.group] ?? 0) + 1), m), {});
fs.writeFileSync(townOut, JSON.stringify(townData, null, 1) + '\n');
console.log(`${path.relative(root, townOut).split(path.sep).join('/')}:${M.BUILDINGS.length} buildings, ${townSolidsOut.length} solids ${JSON.stringify(tc)}, ` +
  `terrain ${NX}x${NZ} (${r3(hmin)}..${r3(hmax)} m) -> ${path.basename(glbOut)} ${(fs.statSync(glbOut).size / 1e6).toFixed(2)} MB`);
