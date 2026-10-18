#!/usr/bin/env node
// Usage: node scripts/export-village-json.mjs [out.json]   (from project root; default unreal/data/village-barn.json)
// Exports the approved barn slice from src/village.ts (read-only: it only imports the module) for the UE5 trial
// import scripts in unreal/scripts/. Units stay in game space: metres, x east, y up, z south. The UE side converts.
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

async function load() {
  try {
    return { mod: await import(pathToFileURL(srcFile).href), loader: `node ${process.version} type stripping` };
  } catch (e) {
    const { runnerImport } = await import('vite');
    const r = await runnerImport(srcFile);
    return { mod: r.module, loader: `vite runnerImport (native failed: ${String(e.message).split('\n')[0]})` };
  }
}

const { mod: V, loader } = await load();

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
