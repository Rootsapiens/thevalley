// Village slice visuals. Everything static is procedural geometry merged into a few meshes (one per material).
// Each vertex carries a baked pair: sky occlusion (scales only indirect light, so the low sun stays crisp and the
// barn interior goes dim) and a warm bounce term from the sunlit aisle. The sun shadow map is rendered once.
// No textures except public/art/wall-painted.png (retinted to limestone for dressed-stone walls).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import palette from '../studio/art/palette.json';
import type { Token } from './nightshift';
import { worldUVs, villageSet, TILE_M } from './materials';
import { VILLAGE_TEX, NORMAL_Y } from './villageTextures';
import {
  BARN, STALLS, POSTS_Z, LOFT, FARMHOUSE, HOUSES, TROUGH, KENNEL, SHRINE, FENCES, NORTH_WALL_Z, GAP, SOUTH_WALL_Z,
  TRACK, SUN, MOUNTAIN, EXAMINABLES, TRAIL_CTRL, TREES, trailPoints, rng, bearingDir, fencesNow, H3, groundY, SLICE_PINES,
  LAMPS, LANTERN_SIDE, PROPS, BELL_ROPE,
} from './village';
import { townFootprints, townFenceRuns, townInteriors, townWarm, buildTown, townBlocked, slicePineKept, townGroundColor, sunHeightMap, type TownScene } from './villageTown';

const deg = Math.PI / 180;
const P = (t: Token) => new THREE.Color(palette[t]);
/** Palette-derived colour: lerp two tokens (linear), then scale. Every colour in the slice comes from palette.json. */
const mix = (a: Token, b: Token, t: number, k = 1) => P(a).lerp(P(b), t).multiplyScalar(k);

export const COL = {
  timber: mix('rust', 'concrete', 0.55, 0.8),
  timberDark: mix('rust', 'hazardBlack', 0.45, 1.05),
  timberWarm: mix('rust', 'hudAmber', 0.18, 0.85),
  slate: mix('metal', 'concreteDark', 0.35, 0.62),
  stone: mix('concrete', 'sodium', 0.1, 0.95),
  stoneDry: mix('concrete', 'rust', 0.2, 0.72),
  mud: mix('rust', 'concreteDark', 0.62, 0.5),
  mudWet: mix('rust', 'hazardBlack', 0.6, 0.32),
  grassA: mix('wallPaint', 'rust', 0.38, 0.5),
  grassB: mix('wallPaint', 'hudAmber', 0.3, 0.46),
  hay: mix('hudAmber', 'concrete', 0.5, 0.8),
  hayDark: mix('hudAmber', 'rust', 0.55, 0.5),
  pine: mix('wallPaint', 'ink', 0.62, 0.75),
  bark: mix('rust', 'ink', 0.55, 0.62),
  rope: mix('hudAmber', 'concrete', 0.62, 0.95),
  iron: mix('metal', 'hazardBlack', 0.5, 1),
  leather: mix('rust', 'hazardBlack', 0.3, 0.75),
  hessian: mix('hudAmber', 'concrete', 0.72, 0.62),
  shutter: P('wallPaint').multiplyScalar(0.75),
  chalk: new THREE.Color(1, 1, 1),
  windowWarm: mix('sodium', 'hudAmber', 0.4, 2.2),
  windowDim: mix('sodium', 'rust', 0.4, 0.9),
  glass: P('ink').multiplyScalar(1.4),
  candle: mix('hudAmber', 'concrete', 0.75, 1.1),
  gravel: mix('concrete', 'rust', 0.25, 0.6),
  cobble: mix('concrete', 'sodium', 0.08, 0.66),
};

// ---------- Sun and sky ----------
export const SUN_DIR = new THREE.Vector3(
  Math.sin(SUN.bearing * deg) * Math.cos(SUN.elevation * deg), Math.sin(SUN.elevation * deg), -Math.cos(SUN.bearing * deg) * Math.cos(SUN.elevation * deg),
).normalize();
const SKY = {
  zenith: P('skyNight').multiplyScalar(7.5),
  horizon: mix('fogHaze', 'skyNight', 0.35, 3.6),
  warm: mix('sodium', 'rust', 0.15, 1.5),
  glow: mix('hudAmber', 'concrete', 0.35, 2.2),
  below: mix('fogHaze', 'hazardBlack', 0.4, 1.2),
  bandPow: 8,
  fogWarm: 0.32, fogGlow: 0.2,
};
/** Fog colour for a horizontal view direction (mirrors the GLSL in patchBake). */
function fogAt(dx: number, dz: number, out: THREE.Color): THREE.Color {
  const l = Math.hypot(dx, dz) || 1, hx = dx / l, hz = dz / l, sl = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  const band = Math.pow(Math.max(0, (hx * SUN_DIR.x + hz * SUN_DIR.z) / sl * 0.5 + 0.5), SKY.bandPow);
  const cs = Math.max(0, hx * SUN_DIR.x + hz * SUN_DIR.z);
  const g = Math.pow(cs, 28) * 0.9 + Math.pow(cs, 7) * 0.16;
  out.copy(SKY.horizon);
  out.r += SKY.warm.r * band * SKY.fogWarm + SKY.glow.r * g * SKY.fogGlow;
  out.g += SKY.warm.g * band * SKY.fogWarm + SKY.glow.g * g * SKY.fogGlow;
  out.b += SKY.warm.b * band * SKY.fogWarm + SKY.glow.b * g * SKY.fogGlow;
  return out;
}
export const FOG_COLOR = SKY.horizon.clone();
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function skyColor(dx: number, dy: number, dz: number, out: THREE.Color): THREE.Color {
  const h = dy;
  out.copy(SKY.horizon).lerp(SKY.zenith, Math.pow(Math.min(1, Math.max(0, h)), 0.55));
  const hl = Math.hypot(dx, dz) || 1, sl = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  const cosH = (dx * SUN_DIR.x + dz * SUN_DIR.z) / (hl * sl);
  const band = Math.pow(Math.max(0, cosH * 0.5 + 0.5), SKY.bandPow) * Math.exp(-Math.max(h, 0) * 7);
  out.r += SKY.warm.r * band; out.g += SKY.warm.g * band; out.b += SKY.warm.b * band;
  const cs = Math.max(0, dx * SUN_DIR.x + dy * SUN_DIR.y + dz * SUN_DIR.z) / (Math.hypot(dx, dy, dz) || 1);
  const g = Math.pow(cs, 28) * 0.9 + Math.pow(cs, 7) * 0.16;
  out.r += SKY.glow.r * g; out.g += SKY.glow.g * g; out.b += SKY.glow.b * g;
  if (h < 0) out.lerp(SKY.below, smooth(0, 0.25, -h));
  return out;
}

// ---------- Noise ----------
function hash2(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, z: number) => 0.5 * vnoise(x, z) + 0.3 * vnoise(x * 2.07, z * 2.07) + 0.2 * vnoise(x * 4.3, z * 4.3);

// ---------- Baked indirect light ----------
const roofY = (x: number) => BARN.ridge - (BARN.ridge - BARN.eave) / 10 * Math.abs(x);
const FOOTPRINTS = [
  { x0: BARN.x0, x1: BARN.x1, z0: BARN.z0, z1: BARN.z1, k: 0.45 }, ...[FARMHOUSE, ...HOUSES].map(h => ({ ...h, k: 0.45 })),
  { ...TROUGH, k: 0.7 }, { ...KENNEL, k: 0.7 },
];
export const rectDist = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) => {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.sqrt(dx * dx + dz * dz);
};

// Single source of truth for both the rendered mesh and physics outside the authored village map.
const SLICE_WALK = [
  { x0: -28, x1: 22, z0: -13.5, z1: 27 },
  { x0: -14, x1: 28, z0: -38.5, z1: -13.5 },
  { x0: 20, x1: 60, z0: -75, z1: -38 },
];
function sliceHeight(x: number, z: number): number {
  let d = Infinity;
  for (const r of SLICE_WALK) d = Math.min(d, rectDist(x, z, r));
  const far = Math.max(0, Math.hypot(x, z + 5) - 70);
  return smooth(1.0, 6, d) * (fbm(x * 0.07, z * 0.07) - 0.45) * 1.2
    + (x < -40 ? (-40 - x) * 0.05 : 0) * smooth(0, 30, d) + far * 0.02;
}
export function villageTerrainHeight(x: number, z: number): number {
  if (z < NORTH_WALL_Z - 0.1 || (x > -28 && x < -14.1 && z < -13.6)) return sliceHeight(x, z);
  if (x < -28 && z < -20) { const w = smooth(-27, -20.5, z); return sliceHeight(x, z) * (1 - w) + groundY(x, z) * w; }
  const inMap = x > -77 && x < 127 && z > -22 && z < 112;
  return groundY(x, z) + (inMap ? 0 : smooth(0, 25, Math.max(-77 - x, x - 127, -22 - z, z - 112)) * (fbm(x * 0.07, z * 0.07) - 0.45) * 2.4);
}
/** Ground-contact occluders near a point: the slice's own list plus the town's (bucketed on a 4 m grid). */
let FENCES_NOW: [number, number, number, number][] = [];
let groundGeo: THREE.BufferGeometry | null = null;
let bakingGround = false;   // terrain vertices: no wall-foot darkening on steep banks

/** [sky occlusion, warm bounce] for a vertex. Openings are treated as area lights: form factor A / (A + pi d^2).
 *  Heights are taken above the terrain, so the same rules hold on the slopes of the full village. */
export function bakeAt(x: number, y: number, z: number, nx: number, ny: number, nz: number, out: [number, number]): void {
  let ao = 1, bounce = 0;
  const inBarn = x > BARN.x0 + 0.04 && x < BARN.x1 - 0.04 && z > BARN.z0 + 0.04 && z < BARN.z1 - 0.04 && y < roofY(x) - 0.01;
  const room = inBarn ? null : townInteriors(x, y, z);
  if (room) {
    ao = room(x, y, z, nx, ny, nz);
    bounce = townWarm(x, y, z, nx, ny, nz);
  } else if (inBarn) {
    const open = (cx: number, cy: number, cz: number, A: number, facing: number) => {
      const vx = cx - x, vy = cy - y, vz = cz - z, d = Math.hypot(vx, vy, vz) || 1;
      const cosDoor = Math.max(0, facing * -vz / d);
      const cosSurf = Math.max(0, (nx * vx + ny * vy + nz * vz) / d);
      return A / (A + Math.PI * d * d) * (0.25 + 0.75 * cosDoor) * (0.35 + 0.65 * cosSurf);
    };
    ao = 0.2 + 1.8 * open(0, 2.1, BARN.z0, 16.8, 1) + 1.4 * open(0, 1.1, BARN.z1, 2.9, -1);
    if (x < LOFT.x1 && z > LOFT.z0 && y < LOFT.y) ao *= 0.6;
    if (Math.abs(x) > STALLS.aisle && Math.abs(x) < STALLS.mangerBack && y < 1.2) ao *= 0.85;
    ao = Math.min(1, ao);
    // Warm light bouncing off the sun slits on the floor near the west wall's south half (the farmhouse shades the rest).
    const dw = Math.max(0, x - BARN.x0 - 1), dz = Math.max(0, 2.5 - z);
    bounce = 0.22 * Math.exp(-(dw / 6 + dz / 3)) * Math.exp(-Math.max(0, y - 0.3) / 4.5) * (0.55 + 0.45 * (1 - Math.max(0, ny)));
  } else {
    const g = groundY(x, z), hy = y - g;
    if (ny < 0.7 && hy < 1.4 && !bakingGround) ao *= 0.62 + 0.38 * smooth(0, 1.4, hy);
    if (ny < -0.5) ao *= 0.55;
    if (ny > 0.7 && hy < 0.1) {
      for (const f of FOOTPRINTS) ao *= f.k + (1 - f.k) * smooth(0, 1.8, rectDist(x, z, f));
      for (const [x0, z0, x1, z1] of FENCES_NOW) {
        const d = rectDist(x, z, { x0, x1, z0, z1 });
        ao *= 0.8 + 0.2 * smooth(0, 0.45, d);
      }
      for (const f of townFootprints(x, z)) ao *= f.k + (1 - f.k) * smooth(0, 1.8, rectDist(x, z, f));
      for (const r of townFenceRuns(x, z)) ao *= 0.8 + 0.2 * smooth(0, 0.45, rectDist(x, z, r));
    }
  }
  out[0] = ao; out[1] = bounce;
}

// ---------- Geometry buckets ----------
export type BucketId = 'lit' | 'stone' | 'wood' | 'wet' | 'prints' | 'foliage' | 'chalk' | 'glow' | 'noshadow';
const buckets: Record<BucketId, THREE.BufferGeometry[]> = { lit: [], stone: [], wood: [], wet: [], prints: [], foliage: [], chalk: [], glow: [], noshadow: [] };
let redirect: THREE.BufferGeometry[] | null = null;
let exTag: string | null = null;
const exGeos = new Map<string, { geo: THREE.BufferGeometry; chalk: boolean }[]>();
const _bake: [number, number] = [1, 0];
const _c = new THREE.Color();
/** Slice geometry the full village replaces (its garden wall, background houses, church stand-in, stray pines and
 *  tufts) is still built, so every random number the slice draws stays in sequence and the barn corner comes out
 *  vertex-for-vertex as approved; it lands here and is thrown away. */
const discardBin: THREE.BufferGeometry[] = [];
let clip: ((x: number, z: number) => boolean) | null = null;
function discarding(fn: () => void) { const was = redirect; redirect = discardBin; fn(); redirect = was; }
function clipping(test: (x: number, z: number) => boolean, fn: () => void) { clip = test; fn(); clip = null; }

type ColorFn = (x: number, y: number, z: number) => THREE.Color;
/** Adds a primitive to a bucket. Geometry stays indexed (BoxGeometry's shared face corners carry identical
 *  attributes, so the triangles and pixels are the same as non-indexed, with a third fewer vertices to bake,
 *  merge and transform); non-indexed inputs get a trivial index so every bucket merges as indexed. */
function put(b: BucketId, src: THREE.BufferGeometry, col: THREE.Color | ColorFn, jitter = 0, r?: () => number) {
  const g = src;
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), n = pos.count;
  if (clip) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { const x = pos.getX(i), z = pos.getZ(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    if (clip((x0 + x1) / 2, (z0 + z1) / 2)) { if (jitter && r) r(); g.dispose(); return; }
  }
  if (redirect === discardBin) { if (jitter && r) r(); g.dispose(); return; }
  const c = new Float32Array(n * 3), k = new Float32Array(n * 2);
  const j = jitter && r ? 1 + (r() * 2 - 1) * jitter : 1;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cc = typeof col === 'function' ? col(x, y, z) : col;
    c[i * 3] = cc.r * j; c[i * 3 + 1] = cc.g * j; c[i * 3 + 2] = cc.b * j;
    bakeAt(x, y, z, nor.getX(i), nor.getY(i), nor.getZ(i), _bake);
    k[i * 2] = _bake[0]; k[i * 2 + 1] = _bake[1];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('bake', new THREE.BufferAttribute(k, 2));
  if (b === 'stone' || b === 'wood') { if (!g.userData.boardUV) worldUVs(g); }   // boards keep their per-board UVs
  else if (b !== 'chalk' && g.getAttribute('uv')) g.deleteAttribute('uv');
  if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
  if (!g.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  if (redirect) redirect.push(g); else buckets[b].push(g);
  if (exTag) {
    const h = new THREE.BufferGeometry();
    h.setAttribute('position', pos.clone());
    h.setAttribute('normal', nor.clone());
    h.setIndex(g.index!.clone());
    if (b === 'chalk') h.setAttribute('uv', g.getAttribute('uv').clone());
    exGeos.get(exTag)!.push({ geo: h, chalk: b === 'chalk' });
  }
}
const triCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
function tagged(id: string, fn: () => void) {
  if (!exGeos.has(id)) exGeos.set(id, []);
  exTag = id; fn(); exTag = null;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
/** Box centred at (cx, cy, cz). Rotation order YXZ (tilts are local, then yaw). Segmented every `seg` metres for the bake. */
function boxG(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0, seg = 2): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz, Math.max(1, Math.ceil(sx / seg)), Math.max(1, Math.ceil(sy / seg)), Math.max(1, Math.ceil(sz / seg)));
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(cx, cy, cz); _m.compose(_p, _q, _s);
  return g.applyMatrix4(_m);
}
/** Box from min corner to max corner (axis-aligned). */
const boxMM = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, seg = 2) =>
  boxG((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 0, 0, 0, seg);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function cylG(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1 = r0, seg = 6): THREE.BufferGeometry {
  _a.set(ax, ay, az); _b.set(bx, by, bz).sub(_a);
  const len = _b.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, Math.max(1, Math.ceil(len / 2)));
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(_up, _b.normalize());
  _m.compose(_a, _q, _s);
  return g.applyMatrix4(_m);
}
function tubeG(pts: [number, number, number][], r: number, segs = 16, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, segs, r, 3, closed);
}
/** Flat ellipse on the ground plane at height y, long axis along `yaw` (0 = -Z). */
function ellipseG(x: number, y: number, z: number, a: number, b: number, yaw: number, seg = 8): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, seg);
  g.rotateX(-Math.PI / 2);
  g.scale(b, 1, a);
  g.rotateY(yaw);
  return g.translate(x, y, z);
}

// ---------- Builders ----------
let R = rng(1);
const rr = (a: number, b: number) => a + (b - a) * R();

/** Plank texture (village_textures.py planks()): 8 boards across each 2 m tile, board k centred at u = k / 8, its gap at
 *  u = (k +- 0.5) / 8. World UVs put those gaps every 0.25 m across boards 0.19-0.29 m wide, so ~90% of boards showed a
 *  false seam (rajaie-village-textures.md). boardUVs maps each board box into one texture board, inset from its gaps,
 *  and slides it along the grain; both picks come from a hash of the board's position, so the slice's random sequence
 *  (and with it every other vertex of the approved barn corner) is untouched. */
export const PLANK_BOARDS = 8, PLANK_INSET = 0.1;
const hashF = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
export function boardUVs(g: THREE.BufferGeometry, key: number, h: number): THREE.BufferGeometry {
  const uv = g.getAttribute('uv'), k = Math.floor(hashF(key) * PLANK_BOARDS) % PLANK_BOARDS;
  const half = (0.5 - PLANK_INSET) / PLANK_BOARDS, v0 = Math.floor(hashF(key + 7.31) * 64) / 16;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, k / PLANK_BOARDS + (uv.getX(i) * 2 - 1) * half, v0 + uv.getY(i) * h / TILE_M);
  uv.needsUpdate = true;
  g.userData.boardUV = true;
  return g;
}

/** Vertical boards along a wall line. axis 'x': wall runs along x at z = fixed; 'z': runs along z at x = fixed.
 *  `out` is the outward normal sign. `bottom(u)` / `top(u)` give the board span; return null to skip. */
function boards(axis: 'x' | 'z', fixed: number, out: number, from: number, to: number,
  bottom: (u: number) => number | null, top: (u: number) => number, col = COL.timber, gapChance = 0.22) {
  let u = from;
  while (u < to - 0.02) {
    const w = Math.min(rr(0.19, 0.29), to - u);
    const gap = R() < gapChance ? rr(0.02, 0.045) : 0.004;
    const mid = u + w / 2, y0 = bottom(mid);
    if (y0 !== null) {
      const y1 = top(mid) - rr(0, 0.02), yb = y0 - rr(0, 0.03), h = y1 - yb;
      const c = fixed - out * 0.045, tilt = rr(-0.006, 0.006);
      const tone = R() < 0.12 ? rr(0.62, 0.78) : rr(0.86, 1.12);
      _c.copy(col).multiplyScalar(tone);
      const g = axis === 'x' ? boxG(mid, yb + h / 2, c, w - 0.004, h, 0.045, 0, 0, tilt, 1.6) : boxG(c, yb + h / 2, mid, 0.045, h, w - 0.004, tilt, 0, 0, 1.6);
      put('wood', boardUVs(g, mid * 3.7 + fixed * 1.3 + (axis === 'x' ? 0 : 0.37), h), _c.clone());
    }
    u += w + gap;
  }
}

/** Slate roof. Ridge along z (slopes face +-x) unless alongX. detail 1: individual slates (+ sarking, rafters); 0: course strips. */
function slateRoof(o: { cx: number; cz: number; span: number; len: number; eave: number; ridge: number; alongX: boolean;
  over: number; gable: number; detail: 0 | 1; sarking?: boolean }) {
  const slope = Math.atan2(o.ridge - o.eave, o.span), cosA = Math.cos(slope), sinA = Math.sin(slope);
  const slopeLen = (o.span + o.over) / cosA, spacing = o.detail ? (o.sarking ? 0.3 : 0.36) : 0.42, slen = spacing * 1.7;
  const sw0 = o.sarking ? 0.34 : 0.45, sw1 = o.sarking ? 0.58 : 0.75;
  const L0 = -o.len - o.gable, L1 = o.len + o.gable;
  for (const side of [-1, 1]) {
    // World point for (s down-slope from ridge, t along ridge, h above the roof plane).
    const at = (s: number, t: number, h: number): [number, number, number] => {
      const d = s * cosA + h * sinA, y = o.ridge - s * sinA + h * cosA;
      return o.alongX ? [o.cx + t, y, o.cz + side * d] : [o.cx + side * d, y, o.cz + t];
    };
    const rot = (extra: number): [number, number, number] => o.alongX ? [side * (slope - extra), 0, 0] : [0, 0, -side * (slope - extra)];
    for (let s = 0; s < slopeLen; s += spacing) {
      if (o.detail) {
        let t = L0 + (Math.floor(s / spacing) % 2) * rr(0.1, 0.25);
        while (t < L1 - 0.05) {
          const w = Math.min(rr(sw0, sw1), L1 - t), l = slen + rr(-0.04, 0.03);
          const [x, y, z] = at(s + l / 2, t + w / 2, 0.02 + 0.012);
          const [rx, , rz] = rot(0.035);
          const jit = rr(-0.012, 0.012);
          _c.copy(COL.slate).multiplyScalar(rr(0.78, 1.18));
          put('lit', o.alongX ? boxG(x, y, z, w - 0.012, 0.022, l, rx, jit, 0, 1) : boxG(x, y, z, l, 0.022, w - 0.012, jit, 0, rz, 1), _c.clone());
          t += w;
        }
      } else {
        const [x, y, z] = at(s + slen / 2, 0, 0.02);
        const [rx, , rz] = rot(0.04);
        _c.copy(COL.slate).multiplyScalar(rr(0.8, 1.12));
        put('lit', o.alongX ? boxG(x, y, z, L1 - L0, 0.03, slen, rx, 0, 0, 3) : boxG(x, y, z, slen, 0.03, L1 - L0, 0, 0, rz, 3), _c.clone());
      }
    }
    // Barge boards along the gable edges.
    for (const t of [L0 + 0.03, L1 - 0.03]) {
      const [ax, ay, az] = at(0, t, 0.05), [bx, by, bz] = at(slopeLen, t, 0.05);
      put('lit', cylG(ax, ay, az, bx, by, bz, 0.11, 0.11, 4), COL.timberDark);   // covers the slate ends against the low sun
    }
    if (o.sarking) {
      // Boarded underside (seen from inside the barn) and rafters every metre.
      for (let s = 0; s < (o.span - 0.3) / cosA; s += 0.3) {
        let t = -o.len + 0.3 + rr(0, 2) - 2;
        while (t < o.len - 0.3) {
          const l = Math.min(rr(3.2, 6.0), o.len - 0.3 - t);
          if (l > 0.2) {
            const [x, y, z] = at(s + 0.15, t + l / 2, -0.015);
            _c.copy(COL.timber).multiplyScalar(rr(0.6, 0.85));
            put('lit', o.alongX ? boxG(x, y, z, l, 0.03, 0.285, side * slope, 0, 0, 2.5) : boxG(x, y, z, 0.285, 0.03, l, 0, 0, -side * slope, 2.5), _c.clone());
          }
          t += l;
        }
      }
      for (let t = -o.len + 0.5; t <= o.len - 0.4; t += 1.0) {
        const [ax, ay, az] = at(0.1, t, -0.12), [bx, by, bz] = at((o.span - 0.35) / cosA, t, -0.12);
        put('lit', cylG(ax, ay, az, bx, by, bz, 0.07, 0.07, 4), COL.timberDark);
      }
    }
  }
  // Ridge cap.
  const [rx0, ry0, rz0] = o.alongX ? [o.cx + L0, o.ridge + 0.04, o.cz] : [o.cx, o.ridge + 0.04, o.cz + L0];
  const [rx1, ry1, rz1] = o.alongX ? [o.cx + L1, o.ridge + 0.04, o.cz] : [o.cx, o.ridge + 0.04, o.cz + L1];
  put('lit', cylG(rx0, ry0, rz0, rx1, ry1, rz1, 0.13, 0.13, 4), COL.slate.clone().multiplyScalar(0.8));
}

/** Gable triangle (stone) between eave and ridge on a wall at the given plane. */
function gableG(alongX: boolean, c: number, t: number, half: number, eave: number, ridge: number, thick: number): THREE.BufferGeometry {
  const shape = new THREE.Shape([new THREE.Vector2(-half, eave), new THREE.Vector2(half, eave), new THREE.Vector2(0, ridge)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  // Ridge along x: the gable sits at x = t and spans z around c. Ridge along z: it sits at z = t and spans x.
  if (alongX) { g.rotateY(Math.PI / 2); return g.translate(t, 0, c); }
  return g.translate(c, 0, t);
}

function windowAt(face: 'n' | 's' | 'e' | 'w', wx: number, wz: number, y0: number, w: number, h: number, light: 'warm' | 'dim' | 'dark' | 'tv', shutters = true) {
  const n = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face], along = n[0] === 0 ? 'x' : 'z';
  const px = wx + n[0] * 0.02, pz = wz + n[1] * 0.02;
  const frame = (dx: number, dy: number, sx: number, sy: number) => along === 'x'
    ? put('lit', boxG(px + dx, y0 + dy, pz + n[1] * 0.02, sx, sy, 0.08), COL.timberDark)
    : put('lit', boxG(px + n[0] * 0.02, y0 + dy, pz + dx, 0.08, sy, sx), COL.timberDark);
  frame(0, -0.04, w + 0.16, 0.08); frame(0, h + 0.04, w + 0.16, 0.08);
  frame(-w / 2 - 0.04, h / 2, 0.08, h); frame(w / 2 + 0.04, h / 2, 0.08, h);
  frame(0, h / 2, 0.04, h); frame(0, h * 0.55, w, 0.04);
  const pane = along === 'x' ? boxG(px, y0 + h / 2, pz - n[1] * 0.01, w, h, 0.02) : boxG(px - n[0] * 0.01, y0 + h / 2, pz, 0.02, h, w);
  if (light === 'tv') return pane;
  if (light === 'dark') put('wet', pane, COL.glass);
  else put('glow', pane, light === 'warm' ? COL.windowWarm : COL.windowDim);
  if (shutters) for (const s of [-1, 1]) {
    const beta = rr(0.12, 0.5), hinge = s * (w / 2 + 0.1), cb = Math.cos(beta), sb = Math.sin(beta);
    _c.copy(COL.shutter).multiplyScalar(rr(0.8, 1.1));
    if (along === 'x') {
      const dx = s * cb, dz = n[1] * sb;
      put('lit', boxG(px + hinge + dx * w / 4, y0 + h / 2, pz + n[1] * 0.06 + dz * w / 4, w / 2, h + 0.06, 0.035, 0, Math.atan2(-dz, dx), 0), _c.clone());
    } else {
      const dx = n[0] * sb, dz = s * cb;
      put('lit', boxG(px + n[0] * 0.06 + dx * w / 4, y0 + h / 2, pz + hinge + dz * w / 4, 0.035, h + 0.06, w / 2, 0, Math.atan2(dx, dz), 0), _c.clone());
    }
  }
  return null;
}

function house(h: { x0: number; x1: number; z0: number; z1: number }, eave: number, alongX: boolean, detail: 0 | 1,
  extras: (cx: number, cz: number) => void) {
  const cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2, sx = h.x1 - h.x0, sz = h.z1 - h.z0;
  const tone = rr(0.88, 1.08);
  put('stone', boxG(cx, eave / 2, cz, sx, eave, sz, 0, 0, 0, 0.7), COL.stone.clone().multiplyScalar(tone));
  const half = (alongX ? sz : sx) / 2, ridge = eave + half * 0.75;
  for (const e of [-1, 1]) {
    const t = alongX ? cx + e * (sx / 2 - 0.25) : cz + e * (sz / 2 - 0.25);
    put('stone', gableG(alongX, alongX ? cz : cx, t, half, eave, ridge, 0.5), COL.stone.clone().multiplyScalar(tone));
  }
  // Corner quoins and a plinth course.
  for (const [qx, qz] of [[h.x0, h.z0], [h.x1, h.z0], [h.x0, h.z1], [h.x1, h.z1]]) {
    for (let y = 0.0; y < eave - 0.3; y += 0.34) {
      const a = R() < 0.5 ? 0.42 : 0.28, b = a === 0.42 ? 0.28 : 0.42;
      put('lit', boxG(qx, y + 0.17, qz, a + 0.02, 0.34, b + 0.02), COL.stone.clone().multiplyScalar(tone * rr(0.95, 1.06)));
    }
  }
  slateRoof({ cx, cz, span: half, len: (alongX ? sx : sz) / 2, eave, ridge, alongX, over: 0.45, gable: 0.35, detail });
  extras(cx, cz);
}

function chimney(x: number, z: number, y0: number, h: number) {
  put('stone', boxG(x, y0 + h / 2, z, 0.7, h, 0.7, 0, 0, 0, 0.7), COL.stone.clone().multiplyScalar(0.9));
  put('lit', boxG(x, y0 + h + 0.05, z, 0.85, 0.1, 0.85), COL.stoneDry);
  put('lit', boxG(x, y0 + h + 0.25, z, 0.5, 0.3, 0.12), COL.slate);
}

function door(face: 'n' | 's' | 'e' | 'w', x: number, z: number, w = 1.0, h = 2.1) {
  const ax = face === 'n' || face === 's';
  const o = face === 'n' ? -1 : face === 's' ? 1 : face === 'e' ? 1 : -1;
  for (let k = 0; k < 4; k++) {
    const u = -w / 2 + (k + 0.5) * w / 4, tone = COL.timber.clone().multiplyScalar(rr(0.62, 0.8));
    put('lit', ax ? boxG(x + u, h / 2, z + o * 0.035, w / 4 - 0.008, h, 0.05) : boxG(x + o * 0.035, h / 2, z + u, 0.05, h, w / 4 - 0.008), tone);
  }
  for (const y of [0.35, h - 0.35]) put('lit', ax ? boxG(x, y, z + o * 0.07, w - 0.08, 0.12, 0.03) : boxG(x + o * 0.07, y, z, 0.03, 0.12, w - 0.08), COL.timberDark);
  put('lit', ax ? boxG(x + w * 0.35, 1.0, z + o * 0.09, 0.03, 0.03, 0.05) : boxG(x + o * 0.09, 1.0, z + w * 0.35, 0.05, 0.03, 0.03), COL.iron);
  if (ax) {
    put('lit', boxG(x, 0.08, z + o * 0.3, w + 0.5, 0.16, 0.55), COL.stoneDry);
    put('lit', boxG(x, h + 0.1, z + o * 0.06, w + 0.3, 0.16, 0.14), COL.timberDark);
  } else {
    put('lit', boxG(x + o * 0.3, 0.08, z, 0.55, 0.16, w + 0.5), COL.stoneDry);
    put('lit', boxG(x + o * 0.06, h + 0.1, z, 0.14, 0.16, w + 0.3), COL.timberDark);
  }
}

/** Rail fence: posts every ~2.4 m, three split rails with a little sag and tilt. */
function railFence(x0: number, z0: number, x1: number, z1: number, skipFirst = false) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.4)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : rr(-0.15, 0.15);
    pts.push([x0 + (x1 - x0) * t + (alongX ? j : 0), z0 + (z1 - z0) * t + (alongX ? 0 : j)]);
  }
  for (const [i, [px, pz]] of pts.entries()) {
    if (skipFirst && i === 0) continue;
    const h = rr(1.3, 1.42);
    _c.copy(COL.timber).multiplyScalar(rr(0.72, 1.0));
    put('lit', boxG(px, h / 2 - 0.05 + groundY(px, pz), pz, 0.13, h, 0.13, rr(-0.03, 0.03), rr(0, 1.5), rr(-0.03, 0.03), 0.6), _c.clone());
  }
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ga = groundY(ax, az), gb = groundY(bx, bz);
    for (const y of [0.38, 0.78, 1.18]) {
      const ya = y + rr(-0.04, 0.04), yb = y + rr(-0.04, 0.04);
      _c.copy(COL.timber).multiplyScalar(rr(0.75, 1.1));
      put('lit', cylG(ax, ya + ga, az, bx, yb + gb, bz, rr(0.045, 0.06), rr(0.045, 0.06), 5), _c.clone());
    }
  }
}

/** Dry-stone wall: irregular stones in courses with a row of upright capstones. */
function dryWall(x0: number, x1: number, z: number, h: number, thick = 0.6, coarse = false) {
  for (let y = 0; y < h - 0.25; y += coarse ? 0.36 : 0.24) {
    let x = x0 + rr(-0.2, 0);
    while (x < x1) {
      const w = coarse ? rr(0.6, 1.1) : rr(0.28, 0.62);
      const xe = Math.min(x + w, x1);
      if (xe - x > 0.08) {
        _c.copy(COL.stoneDry).multiplyScalar(rr(0.7, 1.2));
        put('lit', boxG((x + xe) / 2, y + (coarse ? 0.18 : 0.12) + groundY((x + xe) / 2, z), z + rr(-0.03, 0.03), xe - x - 0.02, coarse ? rr(0.3, 0.37) : rr(0.2, 0.25), thick - rr(0, 0.08), rr(-0.04, 0.04), rr(-0.05, 0.05), rr(-0.05, 0.05)), _c.clone());
      }
      x += w;
    }
  }
  let x = x0;
  if (coarse) {
    // Cap course in pieces so it follows the ground where the wall runs onto the east slope.
    for (let u = x0; u < x1 - 0.01; u += 3) {
      const ue = Math.min(x1, u + 3);
      put('lit', boxG((u + ue) / 2, h - 0.1 + groundY((u + ue) / 2, z), z, ue - u, 0.2, thick * 0.9, 0, 0, 0, 3), COL.stoneDry.clone().multiplyScalar(0.85));
    }
    return;
  }
  while (x < x1) {
    const w = rr(0.1, 0.18);
    _c.copy(COL.stoneDry).multiplyScalar(rr(0.7, 1.1));
    put('lit', boxG(x + w / 2, h - 0.12 + groundY(x + w / 2, z), z, w, rr(0.24, 0.34), thick * 0.9, 0, 0, rr(-0.18, 0.18)), _c.clone());
    x += w + 0.01;
  }
}

function pine(x: number, z: number, h: number) {
  const gy = groundY(x, z);
  put('lit', cylG(x, -0.2 + gy, z, x, h * 0.35 + gy, z, h * 0.025, h * 0.018, 5), COL.bark);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const y0 = h * (0.18 + i * 0.19), y1 = y0 + h * (0.42 - i * 0.04), r = h * (0.24 - i * 0.045);
    _c.copy(COL.pine).multiplyScalar(rr(0.8, 1.15));
    const g = new THREE.ConeGeometry(r, y1 - y0, 7, 1);
    g.rotateY(R() * 3); g.translate(x + rr(-0.1, 0.1), (y0 + y1) / 2 + gy, z + rr(-0.1, 0.1));
    put('lit', g, _c.clone());
  }
}

/** Leafless tree (late November) by recursive branching. */
function bareTree(x: number, z: number, h: number) {
  const branch = (ax: number, ay: number, az: number, dx: number, dy: number, dz: number, len: number, r: number, depth: number) => {
    const bx = ax + dx * len, by = ay + dy * len, bz = az + dz * len;
    put('lit', cylG(ax, ay, az, bx, by, bz, r, r * 0.68, depth > 2 ? 6 : 4), COL.bark);
    if (depth === 0) return;
    const kids = depth > 1 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const yaw = R() * Math.PI * 2, spread = rr(0.35, 0.75);
      let nx = dx + Math.cos(yaw) * spread, ny = dy + rr(0.05, 0.4), nz = dz + Math.sin(yaw) * spread;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      branch(bx, by, bz, nx, ny, nz, len * rr(0.62, 0.78), r * 0.68, depth - 1);
    }
  };
  branch(x, -0.1, z, 0.05, 1, 0.02, h * 0.38, h * 0.035, 4);
}

/** Grass tuft: a few thin blades (double-sided material), normals pointing up so they shade like the ground. */
function tuft(x: number, z: number, s: number, col: THREE.Color) {
  const n = 4, pos: number[] = [], nor: number[] = [], idx: number[] = [], gy = groundY(x, z);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, lean = rr(0.05, 0.35) * s, h = rr(0.18, 0.42) * s, w = 0.03 * s;
    const ca = Math.cos(a), sa = Math.sin(a), bx = x + rr(-0.06, 0.06), bz = z + rr(-0.06, 0.06);
    const k = pos.length / 3;
    pos.push(bx - sa * w, gy, bz + ca * w, bx + sa * w, gy, bz - ca * w, bx + ca * lean, h + gy, bz + sa * lean);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    idx.push(k, k + 1, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  put('foliage', g, col.clone().multiplyScalar(rr(0.8, 1.25)));
}

// ---------- The barn ----------
function buildBarn() {
  const B = BARN, slope = (B.ridge - B.eave) / 10;
  const top = (u: number) => B.ridge - slope * Math.abs(u) - 0.05;
  // Dressed-stone plinth with a cap course.
  const plinth = (x0: number, z0: number, x1: number, z1: number) => {
    put('stone', boxMM(x0, 0, z0, x1, B.plinth, z1, 0.6), COL.stone.clone().multiplyScalar(rr(0.92, 1.04)));
    put('lit', boxMM(x0 - 0.03, B.plinth, z0 - 0.03, x1 + 0.03, B.plinth + 0.07, z1 + 0.03, 1.5), COL.stoneDry);
  };
  plinth(B.x0, B.z0, B.door.x0, B.z0 + 0.5); plinth(B.door.x1, B.z0, B.x1, B.z0 + 0.5);
  plinth(B.x0, B.z1 - 0.5, B.back.x0, B.z1); plinth(B.back.x1, B.z1 - 0.5, B.x1, B.z1);
  plinth(B.x0, B.z0 + 0.5, B.x0 + 0.5, B.z1 - 0.5); plinth(B.x1 - 0.5, B.z0 + 0.5, B.x1, B.z1 - 0.5);
  // Board walls on the plinth: long walls to the eave, gables to the roof line, gaps where light gets in.
  const P0 = B.plinth + 0.07;
  boards('z', B.x0, -1, B.z0, B.z1, () => P0, () => B.eave);
  boards('z', B.x1, 1, B.z0, B.z1, () => P0, () => B.eave);
  boards('x', B.z0, -1, B.x0, B.x1, u => (u > B.door.x0 - 0.12 && u < B.door.x1 + 0.12) ? B.door.h + 0.25 : P0, top, COL.timber, 0.3);
  boards('x', B.z1, 1, B.x0, B.x1, u => (u > B.back.x0 - 0.08 && u < B.back.x1 + 0.08) ? B.back.h + 0.15 : P0, top);
  for (const gz of [B.z0 - 0.035, B.z1 + 0.035]) for (const sd of [-1, 1]) {
    const run = 10.3, L = Math.hypot(run, slope * run);
    put('lit', boxG(sd * run / 2, B.ridge - slope * run / 2 - 0.2, gz, L, 0.32, 0.05, 0, 0, -sd * Math.atan(slope)), COL.timberDark);
  }
  // Corner posts, wall plates, girts.
  for (const [x, z] of [[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]) put('lit', boxMM(x - 0.12, P0, z - 0.12, x + 0.12, B.eave, z + 0.12), COL.timberDark);
  for (const s of [-1, 1]) {
    put('lit', boxG(s * 9.82, B.eave - 0.1, 0, 0.22, 0.22, 20), COL.timberDark);
    for (const y of [2.1, 3.7]) put('lit', boxG(s * 9.86, y, 0, 0.1, 0.16, 19.4), COL.timberDark);
  }
  for (const z of [-9.86, 9.86]) for (const y of [2.1, 3.7]) {
    put('lit', boxMM(-9.8, y - 0.08, z - 0.05, z < 0 ? B.door.x0 - 0.15 : B.back.x0 - 0.1, y + 0.08, z + 0.05), COL.timberDark);
    put('lit', boxMM(z < 0 ? B.door.x1 + 0.15 : B.back.x1 + 0.1, y - 0.08, z - 0.05, 9.8, y + 0.08, z + 0.05), COL.timberDark);
  }
  // Frame: posts, tie beams, king posts, braces, ridge beam.
  for (const z of POSTS_Z) {
    for (const s of [-1, 1]) {
      put('lit', boxG(s * 6.15, (B.eave - 0.15) / 2, z, 0.25, B.eave - 0.15, 0.25, 0, 0, 0, 1), COL.timberDark);
      put('lit', cylG(s * 6.15, 3.9, z, s * 7.6, B.eave - 0.2, z, 0.06, 0.06, 4), COL.timberDark);
      put('lit', cylG(s * 6.15, 3.9, z, s * 4.7, B.eave - 0.2, z, 0.06, 0.06, 4), COL.timberDark);
    }
    put('lit', boxG(0, B.eave - 0.05, z, 19.7, 0.26, 0.24, 0, 0, 0, 1), COL.timberDark);
    put('lit', boxG(0, (B.eave + B.ridge) / 2, z, 0.2, B.ridge - B.eave - 0.2, 0.2, 0, 0, 0, 1), COL.timberDark);
  }
  put('lit', boxG(0, B.ridge - 0.15, 0, 0.2, 0.22, 20), COL.timberDark);
  slateRoof({ cx: 0, cz: 0, span: 10, len: 10, eave: B.eave, ridge: B.ridge, alongX: false, over: B.overhang, gable: 0.4, detail: 1, sarking: true });

  // North door frame, lintel, bar brackets, threshold.
  for (const s of [-1, 1]) {
    put('lit', boxMM(s * 2.0 - 0.12, 0, B.z0 - 0.06, s * 2.0 + 0.12, B.door.h + 0.05, B.z0 + 0.3), COL.timberDark);
    put('lit', boxG(s * 2.18, 1.2, B.z0 + 0.42, 0.08, 0.1, 0.16), COL.iron);
  }
  put('lit', boxMM(-2.4, B.door.h, B.z0 - 0.08, 2.4, B.door.h + 0.26, B.z0 + 0.3), COL.timberDark);
  put('lit', boxMM(-2, -0.03, B.z0, 2, 0.025, B.z0 + 0.5), COL.stoneDry);
  // Loft hay door on the north gable and the hoist beam at the apex.
  put('lit', boxMM(-0.95, 6.0, B.z0 - 0.09, 0.95, 6.1, B.z0 - 0.02), COL.timberDark);
  put('lit', boxMM(-0.95, 7.7, B.z0 - 0.09, 0.95, 7.8, B.z0 - 0.02), COL.timberDark);
  for (const s of [-1, 1]) put('lit', boxMM(s * 0.95 - 0.05, 6.0, B.z0 - 0.09, s * 0.95 + 0.05, 7.8, B.z0 - 0.02), COL.timberDark);
  put('lit', boxMM(-0.1, 8.7, B.z0 - 1.3, 0.1, 8.95, B.z0 + 0.2), COL.timberDark);
  put('lit', new THREE.TorusGeometry(0.11, 0.025, 4, 10).rotateY(Math.PI / 2).translate(0, 8.55, B.z0 - 1.15), COL.iron);
  put('lit', cylG(0, 8.45, B.z0 - 1.18, 0.02, 5.4, B.z0 - 1.2, 0.012, 0.012, 4), COL.rope);
  // Back (south) man-door frame and leaf, swung out against the track side.
  for (const s of [-1, 1]) put('lit', boxMM(s * 0.65 - 0.08, 0, B.z1 - 0.3, s * 0.65 + 0.08, B.back.h + 0.05, B.z1 + 0.06), COL.timberDark);
  put('lit', boxMM(-0.8, B.back.h, B.z1 - 0.3, 0.8, B.back.h + 0.16, B.z1 + 0.08), COL.timberDark);
  for (let i = 0; i < 5; i++) put('lit', boxMM(0.66, 0.02, B.z1 + 0.02 + i * 0.235, 0.71, B.back.h - 0.05, B.z1 + 0.25 + i * 0.235), COL.timber.clone().multiplyScalar(rr(0.8, 1)));
  put('lit', boxMM(-0.65, -0.03, B.z1 - 0.5, 0.65, 0.025, B.z1), COL.stoneDry);

  // West door leaf (static; the chalk is on its west face). East leaf is built separately (it sways).
  doorLeaf(-1);
  tagged('chalk', () => {
    const g = new THREE.PlaneGeometry(1.5, 1.5);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
    g.rotateY(-Math.PI / 2); g.translate(B.door.x0 - 0.084, 1.75, B.z0 - 1.02);
    put('chalk', g, COL.chalk);
  });

  // Floor boards over the whole interior (lengthwise, staggered joints).
  for (let x = -9.5; x < 9.5 - 0.05;) {
    const w = Math.min(rr(0.2, 0.3), 9.5 - x);
    let z = -9.5 - rr(0, 2);
    while (z < 9.5) {
      const z0 = Math.max(z, -9.5), z1 = Math.min(z + rr(1.8, 3.4), 9.5);
      const worn = Math.abs(x + w / 2) < 1.4 ? 0.62 : 0.8;
      _c.copy(COL.timber).multiplyScalar(worn * rr(0.82, 1.1));
      put('lit', boxMM(x + 0.003, -0.02, z0, x + w - 0.003, 0.02, z1, 2.5), _c.clone());
      z = z1 + 0.004;
    }
    x += w;
  }

  // Stalls: partitions, posts, mangers with hay, rings with slack halters, straw bedding.
  const S = STALLS;
  for (const s of [-1, 1]) {
    for (let i = 0; i <= S.perSide; i++) {
      const z = S.z0 + i * S.w;
      for (const y of [0.27, 0.62, 0.97]) {
        _c.copy(COL.timber).multiplyScalar(rr(0.75, 1.05));
        put('lit', boxG(s * (S.partitionFrom + S.manger) / 2, y + rr(-0.02, 0.02), z, S.manger - S.partitionFrom, 0.24, 0.05, rr(-0.008, 0.008), 0, rr(-0.01, 0.01), 0.8), _c.clone());
      }
      put('lit', boxG(s * S.partitionFrom, 0.68, z, 0.14, 1.36, 0.14, 0, 0, 0, 0.7), COL.timberDark);
      put('lit', boxG(s * S.partitionFrom, 1.39, z, 0.18, 0.06, 0.18), COL.timberDark);
      put('lit', boxG(s * (S.manger - 0.05), 0.58, z, 0.1, 1.16, 0.1, 0, 0, 0, 0.7), COL.timberDark);
    }
    for (let i = 0; i < S.perSide; i++) {
      const z0 = S.z0 + i * S.w, zc = z0 + S.w / 2;
      // Manger trough.
      const mx = s * (S.manger + S.mangerBack) / 2;
      put('lit', boxG(mx, 0.3, zc, 0.6, 0.05, S.w, 0, 0, 0, 0.8), COL.timberDark);
      put('lit', boxG(s * (S.manger + 0.025), 0.59, zc, 0.05, 0.56, S.w, 0, 0, 0, 0.8), COL.timber.clone().multiplyScalar(rr(0.8, 1)));
      put('lit', boxG(s * (S.mangerBack - 0.025), 0.69, zc, 0.05, 0.76, S.w, 0, 0, 0, 0.8), COL.timber.clone().multiplyScalar(rr(0.8, 1)));
      put('lit', boxG(mx, 0.14, zc, 0.5, 0.28, 0.2), COL.timberDark);
      const hay = () => {
        for (let k = 0; k < 5; k++) put('lit', boxG(mx + rr(-0.12, 0.12), rr(0.5, 0.66), z0 + rr(0.2, S.w - 0.2), rr(0.3, 0.45), rr(0.18, 0.3), rr(0.35, 0.6), rr(-0.3, 0.3), rr(0, 3), rr(-0.3, 0.3)), COL.hay.clone().multiplyScalar(rr(0.75, 1.1)));
        for (let k = 0; k < 14; k++) put('lit', boxG(mx + rr(-0.25, 0.25), rr(0.65, 0.8), z0 + rr(0.1, S.w - 0.1), 0.008, 0.008, rr(0.2, 0.35), rr(-0.6, 0.6), rr(0, 3), 0), COL.hay.clone().multiplyScalar(rr(0.85, 1.25)));
      };
      if (s === -1 && i === 6) tagged('feed', hay); else hay();
      // Tie ring and the slack halter: rope from the ring down to the buckled halter lying in the straw.
      const halter = () => {
        const rx = s * (S.manger - 0.03), lift = R() < 0.3 ? rr(0.15, 0.3) : 0;
        put('lit', new THREE.TorusGeometry(0.05, 0.009, 4, 10).rotateY(Math.PI / 2).translate(rx, 0.8, zc), COL.iron);
        const hx = s * rr(4.55, 4.85), hz = zc + rr(-0.2, 0.2);
        put('lit', tubeG([[rx, 0.76, zc], [s * (S.manger - 0.1), 0.5 + lift, zc + 0.04], [s * (S.manger - 0.32), 0.14 + lift * 0.5, zc + 0.08], [hx + s * 0.18, 0.07, hz + 0.05]], 0.011, 14), COL.rope);
        const loop = (cx: number, cz: number, ra: number, rb: number, y: number) => {
          const pts: [number, number, number][] = [];
          for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pts.push([cx + Math.cos(a) * ra, y + Math.sin(a * 2) * 0.012, cz + Math.sin(a) * rb]); }
          put('lit', tubeG(pts, 0.011, 14, true), COL.rope);
        };
        loop(hx, hz, 0.19, 0.13, 0.075);
        loop(hx - s * 0.2, hz + 0.1, 0.1, 0.08, 0.07);
        put('lit', boxG(hx + s * 0.16, 0.08, hz - 0.08, 0.04, 0.012, 0.03), COL.iron);
      };
      if (s === 1 && i === 3) tagged('halter', halter); else halter();
      // Straw bedding.
      const imprint = s === -1 && i === 4;
      const ox = s * 4.0, oz = zc, ea = 0.95, eb = 0.5;
      const inOval = (x: number, z: number) => ((x - ox) / ea) ** 2 + ((z - oz) / eb) ** 2 < 1;
      put('lit', boxG(s * 3.75, 0.035, zc, 3.1, 0.03, S.w - 0.1, 0, 0, 0, 1), COL.hayDark.clone().multiplyScalar(rr(0.8, 1.05)));
      const strands = () => {
        for (let k = 0; k < 36; k++) {
          const x = s * rr(2.2, 5.3), z = z0 + rr(0.08, S.w - 0.08);
          if (imprint && inOval(x, z)) continue;
          put('lit', boxG(x, rr(0.055, 0.085), z, 0.009, 0.007, rr(0.18, 0.36), rr(-0.12, 0.12), R() * Math.PI, rr(-0.1, 0.1)), COL.hay.clone().multiplyScalar(rr(0.65, 1.2)));
        }
        for (let k = 0; k < 6; k++) {
          const x = s * rr(2.4, 5.1), z = z0 + rr(0.2, S.w - 0.2);
          if (imprint && inOval(x, z)) continue;
          put('lit', boxG(x, 0.06, z, rr(0.25, 0.45), rr(0.04, 0.08), rr(0.2, 0.35), 0, R() * 3, 0), COL.hay.clone().multiplyScalar(rr(0.6, 0.9)));
        }
      };
      strands();
      if (imprint) tagged('straw', () => {
        put('lit', ellipseG(ox, 0.054, oz, eb, ea, Math.PI / 2, 20), COL.hayDark.clone().multiplyScalar(0.62));
        for (let k = 0; k < 70; k++) {
          const a = R() * Math.PI * 2, rad = rr(1.0, 1.25);
          const x = ox + Math.cos(a) * ea * rad, z = oz + Math.sin(a) * eb * rad;
          if (Math.abs(z - zc) > S.w / 2 - 0.06) continue;
          put('lit', boxG(x, rr(0.07, 0.12), z, 0.009, 0.007, rr(0.2, 0.34), rr(-0.25, 0.25), Math.atan2(-Math.sin(a) * eb, Math.cos(a) * ea) + rr(-0.4, 0.4), 0), COL.hay.clone().multiplyScalar(rr(0.8, 1.25)));
        }
      });
    }
  }
  // Tally board on the first east aisle post: 22 chalk strokes, nobody rubbed them out.
  tagged('tally', () => {
    put('lit', boxG(S.partitionFrom - 0.085, 1.5, S.z0, 0.025, 0.36, 0.5), P('hazardBlack').multiplyScalar(1.6));
    const g = new THREE.PlaneGeometry(0.46, 0.32);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + uv.getX(i) * 0.5, 0.18 + uv.getY(i) * 0.64);
    g.rotateY(-Math.PI / 2); g.translate(S.partitionFrom - 0.1, 1.5, S.z0);
    put('chalk', g, COL.chalk);
  });
  // Door bar, lifted off its brackets and leaned on the wall beside the door.
  tagged('bar', () => put('lit', cylG(2.78, 0.0, B.z0 + 0.95, 2.66, 2.5, B.z0 + 0.17, 0.065, 0.065, 4), COL.timberWarm));

  // Loft over the west alley, ladder, hay bales below and above.
  for (let z = LOFT.z0; z < LOFT.z1; z += 0.6) put('lit', boxG((LOFT.x0 + LOFT.x1) / 2, LOFT.y - 0.1, z + 0.3, LOFT.x1 - LOFT.x0, 0.16, 0.08), COL.timberDark);
  for (let z = LOFT.z0; z < LOFT.z1 - 0.05;) {
    const w = Math.min(rr(0.2, 0.28), LOFT.z1 - z);
    put('lit', boxMM(LOFT.x0, LOFT.y - 0.02, z + 0.003, LOFT.x1 + rr(-0.05, 0.05), LOFT.y + 0.03, z + w - 0.003, 1), COL.timber.clone().multiplyScalar(rr(0.7, 0.95)));
    z += w;
  }
  put('lit', boxG(LOFT.x1 - 0.1, LOFT.y - 0.2, (LOFT.z0 + LOFT.z1) / 2, 0.2, 0.24, LOFT.z1 - LOFT.z0), COL.timberDark);
  for (const sx of [-6.77, -6.33]) put('lit', cylG(sx, 0, -4.7, sx, 3.75, -3.95, 0.035, 0.035, 4), COL.timberWarm);
  for (let k = 1; k < 12; k++) { const t = k / 12; put('lit', cylG(-6.77, 3.75 * t, -4.7 + 0.75 * t, -6.33, 3.75 * t, -4.7 + 0.75 * t, 0.022, 0.022, 4), COL.timberWarm); }
  const bale = (x: number, y: number, z: number, along: 'x' | 'z') => {
    const [sx, sz] = along === 'z' ? [0.48, 0.92] : [0.92, 0.48];
    put('lit', boxG(x, y + 0.22, z, sx - 0.02, 0.43, sz - 0.02, rr(-0.02, 0.02), rr(-0.04, 0.04), 0), COL.hay.clone().multiplyScalar(rr(0.7, 1.0)));
    for (const o of [-0.22, 0.22]) put('lit', along === 'z' ? boxG(x, y + 0.22, z + o, sx + 0.004, 0.44, 0.012) : boxG(x + o, y + 0.22, z, 0.012, 0.44, sz + 0.004), COL.hayDark.clone().multiplyScalar(0.6));
  };
  for (let z = -1.6; z < 9.4; z += 0.93) for (let lvl = 0; lvl < 3; lvl++) {
    if (lvl === 2 && R() < 0.3) continue;
    bale(-7.85, lvl * 0.45, z + rr(-0.03, 0.03), 'z');
    bale(-8.35, lvl * 0.45, z + rr(-0.03, 0.03), 'z');
  }
  put('lit', boxMM(-9.5, 0, -2, -8.6, 1.35, 9.5), COL.hay.clone().multiplyScalar(0.55));
  for (let z = -3.4; z < 9.2; z += 0.93) for (let lvl = 0; lvl < 2; lvl++) {
    if (R() < 0.25) continue;
    bale(-7.3 + rr(-0.05, 0.05), LOFT.y + 0.03 + lvl * 0.45, z, 'z');
    bale(-8.3, LOFT.y + 0.03 + lvl * 0.45, z, 'z');
  }
  for (let k = 0; k < 40; k++) put('lit', boxG(rr(-7.55, -6.6), rr(0.04, 0.1), rr(-2, 9), rr(0.15, 0.4), rr(0.03, 0.12), rr(0.15, 0.5), 0, R() * 3, 0), COL.hay.clone().multiplyScalar(rr(0.55, 0.95)));

  // East alley: feed bin, sacks, pail and stool, pitchfork, harness pegs, a hanging lantern (unlit).
  put('lit', boxMM(8.1, 0, -9.5, 9.5, 0.86, -8.4, 1), COL.timber.clone().multiplyScalar(0.85));
  put('lit', boxG(8.8, 0.9, -8.95, 1.44, 0.06, 1.14, 0.02, 0, 0), COL.timberDark);
  for (let k = 0; k < 4; k++) put('lit', boxG(8.6 + (k % 2) * 0.55, 0.3 + Math.floor(k / 2) * 0.32, -7.55 + (k % 2) * 0.55, 0.5, 0.42, 0.62, rr(-0.1, 0.1), rr(-0.4, 0.4), rr(-0.15, 0.15)), COL.hessian.clone().multiplyScalar(rr(0.85, 1.1)));
  // The pail and the stool are loose props now (village.ts PROPS, built in buildVillage).
  put('lit', cylG(9.3, 0.05, -2.0, 9.7, 2.0, -2.2, 0.022, 0.022, 4), COL.timberWarm);
  for (const o of [-0.08, 0, 0.08]) put('lit', cylG(9.3 + o * 0.2, 0.05, -2.0 + o, 9.22 + o * 0.2, 0.35, -2.0 + o, 0.006, 0.006, 3), COL.iron);
  for (const z of [2, 3.2, 4.4]) {
    put('lit', cylG(9.85, 2.0, z, 9.6, 2.06, z, 0.025, 0.025, 4), COL.timberDark);
    if (z !== 3.2) put('lit', new THREE.TorusGeometry(0.22, 0.03, 5, 12).rotateY(Math.PI / 2).translate(9.68, 1.8, z), z === 2 ? COL.rope : COL.leather);
  }
  put('lit', cylG(0, B.eave - 0.15, -4, 0, 3.0, -4, 0.008, 0.008, 3), COL.rope);
  // The lantern on the rope's end is built lit with the other lamps (buildVillage, LAMPS[0]).
}

function doorLeaf(side: -1 | 1) {
  const B = BARN, hx = side < 0 ? B.door.x0 : B.door.x1, out = side < 0 ? -1 : 1;
  for (let z = B.z0; z > B.z0 - B.door.leaf + 0.05;) {
    const w = Math.min(0.25, z - (B.z0 - B.door.leaf));
    _c.copy(COL.timber).multiplyScalar(rr(0.85, 1.12));
    put('lit', boxMM(hx + out * 0.02, 0.06, z - w + 0.004, hx + out * 0.08, B.door.h - 0.02, z - 0.004, 1), _c.clone());
    z -= w;
  }
  const inner = hx - out * 0.01;
  for (const y of [0.55, 3.55]) put('lit', boxMM(inner - 0.03, y - 0.1, B.z0 - B.door.leaf + 0.05, inner + 0.03, y + 0.1, B.z0 - 0.05), COL.timberDark);
  put('lit', cylG(inner, 0.62, B.z0 - 0.15, inner, 3.45, B.z0 - B.door.leaf + 0.15, 0.05, 0.05, 4), COL.timberDark);
  for (const y of [0.55, 3.55]) put('lit', boxMM(hx + out * 0.08, y - 0.04, B.z0 - 1.25, hx + out * 0.095, y + 0.04, B.z0 + 0.02), COL.iron);
}

// ---------- Farm, houses, village edge ----------
function buildFarm() {
  // Farmhouse: two storeys, ridge along z, timber balcony on the yard (east) side.
  house(FARMHOUSE, 6.0, false, 1, (cx, cz) => {
    const ex = FARMHOUSE.x1;
    door('e', ex, 2.2, 1.0, 2.15);
    tagged('tv', () => { tvWindow = windowAt('e', ex, -2.0, 0.95, 0.9, 1.05, 'tv', true); });
    windowAt('e', ex, -2.6, 3.75, 0.8, 1.1, 'warm');
    windowAt('e', ex, 2.4, 3.75, 0.8, 1.1, 'dark');
    windowAt('s', -20, FARMHOUSE.z1, 1.0, 0.9, 1.1, 'dim');
    windowAt('n', -20.5, FARMHOUSE.z0, 3.8, 0.7, 0.9, 'dark');
    windowAt('w', FARMHOUSE.x0, 0, 3.8, 0.8, 1.0, 'warm', false);
    // Balcony: deck, joists on brackets, rail.
    put('lit', boxMM(ex, 3.1, -4, ex + 1.15, 3.22, 4), COL.timber.clone().multiplyScalar(0.85));
    for (let z = -3.8; z <= 3.8; z += 1.9) {
      put('lit', cylG(ex + 0.02, 2.35, z, ex + 1.05, 3.08, z, 0.05, 0.05, 4), COL.timberDark);
      put('lit', cylG(ex + 1.1, 3.22, z, ex + 1.1, 4.2, z, 0.04, 0.04, 4), COL.timberDark);
    }
    put('lit', boxMM(ex + 1.05, 4.15, -4, ex + 1.15, 4.25, 4), COL.timberDark);
    for (let z = -3.9; z <= 3.9; z += 0.14) put('lit', boxMM(ex + 1.08, 3.22, z, ex + 1.12, 4.15, z + 0.04), COL.timber);
    chimney(cx - 1.2, cz + 3.2, 6.5, 3.6);
  });
  house(HOUSES[0], 4.6, true, 1, (cx, cz) => {
    door('s', cx + 1.5, HOUSES[0].z1, 1.0, 2.05);
    windowAt('s', cx - 1.6, HOUSES[0].z1, 1.0, 0.9, 1.1, 'warm');
    windowAt('e', HOUSES[0].x1, cz, 1.0, 0.8, 1.0, 'dark');
    windowAt('n', cx, HOUSES[0].z0, 1.1, 0.8, 1.0, 'dim');
    chimney(cx + 2.5, cz, 6.2, 2.2);
  });
  house(HOUSES[1], 5.0, false, 1, (cx, cz) => {
    door('w', HOUSES[1].x0, cz + 1.8, 1.0, 2.05);
    windowAt('w', HOUSES[1].x0, cz - 1.5, 1.0, 0.85, 1.1, 'warm');
    windowAt('w', HOUSES[1].x0, cz - 1.5, 3.4, 0.7, 0.9, 'dark');
    windowAt('s', cx, HOUSES[1].z1, 1.0, 0.9, 1.0, 'dark');
    windowAt('n', cx, HOUSES[1].z0, 1.0, 0.8, 1.0, 'dim');
    chimney(cx, cz - 2, 7.4, 2.0);
  });
  // Village beyond the garden wall (not reachable): houses, the church and its 22 m bell tower.
  const bg = [{ x0: -21, x1: -12, z0: 32, z1: 39, e: 5.0, ax: true }, { x0: -36, x1: -29, z0: 18, z1: 27, e: 4.6, ax: false },
    { x0: 25, x1: 32, z0: 29, z1: 36, e: 5.2, ax: true }, { x0: 24, x1: 31, z0: 6, z1: 13, e: 4.4, ax: false }];
  // Full village: only H3 (in the opening shot) stays; the other stand-ins and the church make way for the town.
  for (const h of bg) {
    const draw = () => house(h, h.e, h.ax, 0, (cx, cz) => {
      if (h.ax) windowAt('n', cx - 1.5, h.z0, 1.1, 0.8, 1.0, R() < 0.6 ? 'warm' : 'dim', false);
      else windowAt(cx > 0 ? 'w' : 'e', cx > 0 ? h.x0 : h.x1, cz, 1.1, 0.8, 1.0, 'warm', false);
    });
    if (h.x0 === H3.x0 && h.z0 === H3.z0) draw(); else discarding(draw);
  }
  discarding(() => {
    house({ x0: 6, x1: 16, z0: 33, z1: 52 }, 8.5, false, 0, () => {});
    put('stone', boxMM(-1.5, 0, 32, 3.5, 22, 37, 0.7), COL.stone.clone().multiplyScalar(0.95));
    for (const [fx, fz, sx, sz] of [[1, 31.9, 1.4, 0.1], [1, 37.1, 1.4, 0.1], [-1.6, 34.5, 0.1, 1.4], [3.6, 34.5, 0.1, 1.4]]) put('lit', boxG(fx, 19.6, fz, sx, 2.2, sz), P('ink'));
    const spire = new THREE.ConeGeometry(3.6, 4.5, 4, 1);
    spire.rotateY(Math.PI / 4); spire.translate(1, 24.25, 34.5);
    put('lit', spire, COL.slate);
    put('lit', boxMM(-1.7, 22, 31.8, 3.7, 22.2, 37.2), COL.stoneDry);
  });

  // Yard: flagstones, trough, kennel, dog chain and collar.
  for (let x = -15; x < -10.3;) {
    const w = rr(0.6, 0.95);
    for (let z = -6.5 + rr(0, 0.4); z < 9.5;) {
      const d = rr(0.55, 0.9);
      if (R() > 0.06) put('lit', boxG(x + w / 2, -0.005, z + d / 2, w - 0.04, 0.04, d - 0.04, rr(-0.01, 0.01), rr(-0.04, 0.04), rr(-0.01, 0.01)), COL.stoneDry.clone().multiplyScalar(rr(0.75, 1.1)));
      z += d;
    }
    x += w;
  }
  tagged('trough', () => {
    const T = TROUGH;
    put('lit', boxMM(T.x0, 0, T.z0, T.x1, 0.12, T.z1), COL.stoneDry.clone().multiplyScalar(0.9));
    put('lit', boxMM(T.x0, 0.12, T.z0, T.x0 + 0.1, T.h, T.z1), COL.stoneDry);
    put('lit', boxMM(T.x1 - 0.1, 0.12, T.z0, T.x1, T.h, T.z1), COL.stoneDry);
    put('lit', boxMM(T.x0 + 0.1, 0.12, T.z0, T.x1 - 0.1, T.h, T.z0 + 0.1), COL.stoneDry);
    put('lit', boxMM(T.x0 + 0.1, 0.12, T.z1 - 0.1, T.x1 - 0.1, T.h, T.z1), COL.stoneDry);
    put('lit', boxMM(T.x0 + 0.1, 0.12, T.z0 + 0.1, T.x1 - 0.1, 0.16, T.z1 - 0.1), COL.stoneDry.clone().multiplyScalar(0.6));
  });
  const K = KENNEL;
  put('lit', boxMM(K.x0, 0, K.z0, K.x1, 0.75, K.z1, 1), COL.timber.clone().multiplyScalar(0.8));
  const kroof = new THREE.ConeGeometry(0.85, 0.4, 4, 1); kroof.rotateY(Math.PI / 4); kroof.scale(1, 1, 0.75); kroof.translate((K.x0 + K.x1) / 2, 0.95, (K.z0 + K.z1) / 2);
  put('lit', kroof, COL.slate);
  put('lit', boxG(K.x1 + 0.005, 0.3, (K.z0 + K.z1) / 2, 0.01, 0.45, 0.4), P('ink'));
  tagged('dog', () => {
    put('lit', cylG(K.x1 + 0.15, 0, -3.6, K.x1 + 0.15, 0.18, -3.6, 0.03, 0.02, 5), COL.iron);
    const links: [number, number, number][] = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14; links.push([K.x1 + 0.15 + (-12.35 - K.x1 - 0.15) * t + Math.sin(t * 9) * 0.05, 0.03, -3.6 + (-2.3 + 3.6) * t]); }
    for (let k = 0; k < links.length - 1; k++) {
      const [ax, , az] = links[k], [bx, , bz] = links[k + 1];
      put('lit', new THREE.TorusGeometry(0.03, 0.007, 3, 6).scale(1.5, 1, 1).rotateX(k % 2 ? Math.PI / 2 : 0).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, 0.025, (az + bz) / 2), COL.iron);
    }
    put('lit', new THREE.TorusGeometry(0.13, 0.022, 4, 14).scale(1, 0.35, 1).translate(-12.3, 0.03, -2.25), COL.leather);
    put('lit', boxG(-12.17, 0.035, -2.25, 0.05, 0.03, 0.06), COL.iron.clone().multiplyScalar(1.5));
  });
  // Utility poles: one wire into the farmhouse.
  const poles: [number, number][] = [[-7, 26.2], [-13.4, 9.9]];
  for (const [x, z] of poles) {
    put('lit', cylG(x, -0.3, z, x + 0.05, 7.4, z, 0.13, 0.1, 6), COL.timberDark);
    put('lit', boxG(x, 7.0, z, 1.4, 0.12, 0.12, 0, Math.atan2(9.9 - 26.2, -13.4 + 7), 0), COL.timberDark);
  }
  const wire = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number) => {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t]); }
    put('noshadow', tubeG(pts, 0.01, 24), COL.iron);
  };
  wire(-7, 6.95, 26.2, -13.4, 6.95, 9.9, 0.6);
  wire(-13.4, 6.95, 9.9, FARMHOUSE.x1, 5.2, 3.6, 0.5);
  wire(-7, 6.95, 26.2, 0.2, 6.95, 38.4, 0.6);   // to the square pole (the town carries it on to the transformer [9])
}

function buildFences() {
  // The examinable stretch of the cross fence is built as its own section so it can be outlined.
  for (const [x0, z0, x1, z1] of FENCES) {
    if (x0 === 3 && x1 === 28) {
      railFence(3, z0, 4.4, z0);
      tagged('fence', () => railFence(4.4, z0, 6.8, z0, true));
      railFence(6.8, z0, 28, z0, true);
    } else if (x0 === x1 && (x0 === -28 || x0 === 22)) {
      // The yard's side fences now stop where the farmyard opens onto the lane (village.ts fencesNow).
      const zEnd = (fencesNow().find(f => f[0] === x0 && f[2] === x0) ?? [0, 0, 0, z1])[3] + 0.15;
      clipping((_x, z) => z > zEnd, () => railFence(x0, z0, x1, z1));
    } else railFence(x0, z0, x1, z1);
  }
  dryWall(-28, GAP.x0, NORTH_WALL_Z, 1.0);
  dryWall(GAP.x1, 40, NORTH_WALL_Z, 1.0);
  dryWall(-60, -28.2, NORTH_WALL_Z - 0.4, 1.0, 0.6, true);
  dryWall(40.2, 70, NORTH_WALL_Z - 0.4, 1.0, 0.6, true);
  discarding(() => {   // the slice's garden wall: the churchyard stands there now
    dryWall(-28, TRACK.x0, SOUTH_WALL_Z, 1.4, 0.55);
    dryWall(TRACK.x1, 22, SOUTH_WALL_Z, 1.4, 0.55);
  });
  // Roadside shrine at the gap: stone pillar, niche facing the lane, a candle someone lit today.
  tagged('shrine', () => {
    const { x, z } = SHRINE, lime = COL.stone.clone().multiplyScalar(1.3);
    put('lit', boxG(x, 0.06, z, 0.5, 0.12, 0.5), COL.stoneDry);
    put('lit', boxG(x, 0.56, z, 0.34, 0.9, 0.34, 0, 0, 0, 0.5), lime);
    put('lit', boxG(x + 0.02, 1.03, z, 0.56, 0.06, 0.56), COL.stoneDry.clone().multiplyScalar(1.2));
    put('lit', boxG(x - 0.22, 1.35, z, 0.08, 0.6, 0.52), lime);
    for (const o of [-0.22, 0.22]) put('lit', boxG(x, 1.35, z + o, 0.52, 0.6, 0.08), lime);
    put('lit', boxG(x, 1.68, z, 0.58, 0.06, 0.58), lime);
    put('lit', boxG(x - 0.175, 1.36, z, 0.01, 0.46, 0.36), P('ink').multiplyScalar(1.6));
    put('lit', boxG(x - 0.165, 1.37, z, 0.015, 0.27, 0.2), mix('hudAmber', 'rust', 0.55, 0.55));
    put('lit', boxG(x - 0.16, 1.37, z, 0.012, 0.21, 0.14), mix('rust', 'ink', 0.4, 0.8));
    for (const sd of [-1, 1]) put('lit', boxG(x, 1.79, z + sd * 0.16, 0.7, 0.035, 0.4, -sd * 0.55, 0, 0), COL.slate);
    put('lit', boxG(x, 2.05, z, 0.03, 0.3, 0.03), COL.iron);
    put('lit', boxG(x, 2.1, z, 0.03, 0.03, 0.16), COL.iron);
    put('lit', cylG(x + 0.12, 1.06, z, x + 0.12, 1.15, z, 0.02, 0.018, 8), COL.candle);
    put('lit', ellipseG(x + 0.12, 1.061, z + 0.02, 0.045, 0.035, 0.3, 8), COL.candle);
  });
}

/** Ground: a fine grid around the play space (vertex colours: grass, mud lane, ruts) and a coarse outer plane. */
function buildGround(height: (x: number, z: number) => number = villageTerrainHeight) {
  const lane: [number, number][] = TRAIL_CTRL.slice(3);
  const segDist = (x: number, z: number, pts: [number, number][]) => {
    let d = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const ex = x - ax - vx * t, ez = z - az - vz * t;
      d = Math.min(d, Math.sqrt(ex * ex + ez * ez));
    }
    return d;
  };
  const town = { gravel: COL.gravel, mud: COL.mud, cobble: COL.cobble, mudWet: COL.mudWet };
  const color = (x: number, z: number, out: THREE.Color) => {
    const n1 = fbm(x * 0.13, z * 0.13), n2 = vnoise(x * 0.9, z * 0.9);
    out.copy(COL.grassA).lerp(COL.grassB, n1).multiplyScalar(0.82 + 0.36 * n2);
    const dl = segDist(x, z, lane);
    let m = 1 - smooth(1.4, 2.9 + n1, dl);
    m = Math.max(m, 1 - smooth(1.0, 2.2, Math.abs(x) + (z < 10 || z > 27 ? 99 : 0)));   // farm track, barn to the lane
    m = Math.max(m, 1 - smooth(1.2, 2.6, Math.abs(z - 23.6)) * (x > -36 && x < 47.5 ? 1 : 0)); // village road (row-8 lane)
    m = Math.max(m, x > -15.5 && x < -9.8 && z > -7 && z < 10 ? 1 : 0);
    m = Math.max(m, 1 - smooth(0.4, 1.6, rectDist(x, z, { x0: BARN.x0, x1: BARN.x1, z0: BARN.z0, z1: BARN.z1 })));
    m = Math.max(m, 1 - smooth(2.5, 5.5, Math.hypot(x, z + 12)));
    if (m > 0) {
      _c.copy(COL.mud).multiplyScalar(0.85 + 0.3 * n2);
      out.lerp(_c, Math.min(1, m));
      if (dl < 1.2 && z < -13.5) {
        out.lerp(COL.mudWet, 0.35 * (1 - dl / 1.2));
      }
    }
    if (!(x > -28 && x < 28 && z > -40 && z < 27) && x > -86 && x < 136 && z > -70 && z < 122) townGroundColor(x, z, n1, n2, out, town);
    return out;
  };
  /** Indexed terrain grid (its own mesh: too many vertices to merge non-indexed). The barn corner keeps the slice's
   *  0.7 m lattice (x from -40, z from -66), so its vertices land where they always were. */
  const grid = (x0: number, z0: number, nx: number, nz: number, dx: number, dz: number, hole?: { x0: number; x1: number; z0: number; z1: number }) => {
    const g = new THREE.PlaneGeometry(nx * dx, nz * dz, nx, nz);
    g.rotateX(-Math.PI / 2); g.translate(x0 + nx * dx / 2, 0, z0 + nz * dz / 2);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const under = hole && x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1;
      pos.setY(i, height(x, z) - (under ? 0.25 : 0));
    }
    g.computeVertexNormals();
    return g;
  };
  const DX = 74 / 106, DZ = 106 / 151;   // the slice's inner ground spacing
  const fine = grid(-40 - 60 * DX, -66, 307, 263, DX, DZ);
  const fb = { x0: -40 - 60 * DX, x1: -40 + 247 * DX, z0: -66, z1: -66 + 263 * DZ };
  // Keep the quarry, mine and cave route on the same 2.8 m terrain lattice as East Valley; the coarse mesh
  // remains underneath as distant scenery, but must not show through the playable Chapter 2 ground.
  const mid = grid(-200, -180, 220, 160, 2.8, 2.8, fb);
  const coarse = grid(-600, -600, 100, 100, 12, 12, { x0: -200, x1: 416, z0: -180, z1: 268 });
  const cache = new THREE.Color();
  groundGeo = mergeGeometries([fine, mid, coarse])!;
  for (const g of [fine, mid, coarse]) g.dispose();
  {
    const pos = groundGeo.getAttribute('position'), nor = groundGeo.getAttribute('normal'), n = pos.count;
    const c = new Float32Array(n * 3), bk = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      color(x, z, cache).toArray(c, i * 3);
      if (x > -86 && x < 136 && z > -70 && z < 122) {
        bakingGround = true;
        bakeAt(x, y, z, nor.getX(i), nor.getY(i), nor.getZ(i), _bake);
        bakingGround = false;
      } else { _bake[0] = 1; _bake[1] = 0; }
      bk[i * 2] = _bake[0]; bk[i * 2 + 1] = _bake[1];
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    groundGeo.setAttribute('bake', new THREE.BufferAttribute(bk, 2));
    groundGeo.deleteAttribute('uv');
  }

  // Hoofprints: one trodden line, many animals superimposed, every print pointing the way they walked.
  const t = trailPoints(0.11);
  const wetC = COL.mudWet.clone().multiplyScalar(0.8);
  const exP = EXAMINABLES.find(e => e.id === 'prints')!.pos;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 2 + pass; i < t.length - 1; i += 3) {
      const a = t[i - 1], b = t[i + 1];
      const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      const side = (Math.floor(i / 3) % 2 ? 1 : -1) * rr(0.08, 0.16);
      const px = t[i].x + Math.cos(yaw) * side + rr(-0.05, 0.05), pz = t[i].z - Math.sin(yaw) * side + rr(-0.05, 0.05);
      const indoor = pz > BARN.z0 + 0.3;
      if (indoor && R() < 0.55) continue;
      const y = indoor ? 0.024 : 0.006, py = yaw + rr(-0.12, 0.12);
      const s = rr(0.85, 1.15);
      const add = () => {
        for (const h of [-1, 1]) {
          const ox = Math.cos(py) * h * 0.033 * s, oz = -Math.sin(py) * h * 0.033 * s;
          put('prints', ellipseG(px + ox, y, pz + oz, 0.062 * s, 0.027 * s, py + h * 0.08, 7), indoor ? COL.mud.clone().multiplyScalar(0.5) : wetC.clone().multiplyScalar(rr(0.4, 0.6)));
        }
      };
      if (Math.hypot(px - exP.x, pz - exP.z) < 0.75) tagged('prints', add); else add();
    }
  }
  // Puddles in the ruts and by the door.
  const puddles: [number, number, number][] = [];   // flat dark patches read as holes in grazing light
  for (const [x, z, r] of puddles) {
    const g = new THREE.CircleGeometry(1, 14);
    const pos = g.getAttribute('position');
    for (let i = 1; i < pos.count; i++) { const k = 0.7 + 0.5 * vnoise(x * 3 + i * 0.7, z * 3); pos.setXY(i, pos.getX(i) * k * r * 1.6, pos.getY(i) * k * r); }
    g.rotateX(-Math.PI / 2); g.rotateY(rr(-0.3, 0.3)); g.translate(x, 0.004, z);
    put('prints', g, COL.mudWet.clone().multiplyScalar(0.42));
    put('prints', ellipseG(x, 0.002, z, r * 1.25, r * 1.9, Math.PI / 2 + rr(-0.3, 0.3), 14), COL.mudWet.clone().multiplyScalar(0.55));
  }
  // Grass tufts: pastures, fence lines, verges. Never on the trodden line.
  for (let k = 0; k < 2600; k++) {
    const x = rr(-38, 32), z = rr(-62, 38);
    if (x > BARN.x0 - 0.6 && x < BARN.x1 + 0.6 && z > BARN.z0 - 0.6 && z < BARN.z1 + 0.6) continue;
    if ([FARMHOUSE, ...HOUSES].some(h => rectDist(x, z, h) < 0.3)) continue;
    const c = color(x, z, cache);
    const mud = segDist(x, z, lane) < 2.6 || Math.abs(x) < 2.2 && z > 10 || Math.abs(z - 23.6) < 2.2 || (x > -15.5 && x < -9.8 && z > -7 && z < 10);
    if (mud && R() < 0.92) continue;
    const s = rr(0.7, 1.3), col = c.clone().lerp(COL.grassB, 0.35).multiplyScalar(1.25);
    if (townBlocked(x, z)) discarding(() => tuft(x, z, s, col)); else tuft(x, z, s, col);
  }
}

function buildTrees() {
  R = rng(77);
  let placed = 0;
  for (let k = 0; k < 600 && placed < 150; k++) {
    const a = R() * Math.PI * 2, d = rr(34, 120);
    const x = Math.sin(a) * d, z = -Math.cos(a) * d - 5;
    const b = ((Math.atan2(x - 14, -(z + 27)) / deg) + 360) % 360;
    const northView = b > 0 && b < 95;
    const fromSpawn = ((Math.atan2(x - 4, -(z - 21.5)) / deg) + 360) % 360;   // opening shot looks NE from the spawn
    if (northView || (fromSpawn > 22 && fromSpawn < 68)) continue;
    if (x > -30 && x < 32 && z > -45 && z < 30) continue;
    if (x > -40 && x < 35 && z > 28 && z < 55 && R() < 0.7) continue;
    const h = rr(9, 17) * (northView ? 0.7 : 1);
    const twin = SLICE_PINES[placed];   // village.ts replays this ring for trunk collision: it must agree
    if (!twin || Math.abs(twin.x - x) + Math.abs(twin.z - z) + Math.abs(twin.h - h) > 1e-9) console.warn('pine ring and SLICE_PINES disagree at', placed);
    if (slicePineKept(x, z)) pine(x, z, h); else discarding(() => pine(x, z, h));   // same numbers drawn either way
    placed++;
  }
  for (const t of TREES) bareTree(t.x, t.z, t.h);
  R = rng(5);
}

// ---------- Distant silhouettes (unlit, colour-graded by hand: base = fog, ridge = cool, rim = warm toward the sun) ----------
/** Value noise around the horizon: sampled on a circle so bearing 0 and 360 match. */
const ringNoise = (b: number, freq: number, seed: number) => vnoise(Math.cos(b * deg) * freq + seed, Math.sin(b * deg) * freq - seed);
interface RingLook { shade: THREE.Color; lit: THREE.Color; snow: THREE.Color; snowLine: number; haze: number; litK: number }
/** A 360 deg ridge strip. Each column is lit by how squarely its village-facing side faces the sun (Lambert on the
 *  horizontal), broken up by gully noise; the foot fades into the fog colour for that bearing. */
function ridgeRing(radius: number, heightAt: (b: number) => number, o: RingLook): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const fr = [0, 0.3, 0.6, 0.82, 0.94, 1], rows = fr.length, cols = 480;
  const c = new THREE.Color(), hz = new THREE.Color(), sn = new THREE.Color(), sl = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  for (let i = 0; i <= cols; i++) {
    const b = i / cols * 360, h = heightAt(b), d = bearingDir(b);
    const lambert = Math.max(0, (-d.x * SUN_DIR.x - d.z * SUN_DIR.z) / sl);
    const gully = 0.6 + 0.8 * ringNoise(b, 70, 2.2);
    fogAt(d.x, d.z, hz);
    for (let r = 0; r < rows; r++) {
      const y = r === 0 ? -40 : h * fr[r];
      pos.push(d.x * radius, y, d.z * radius);
      if (r === 0) c.copy(hz);
      else {
        c.copy(o.shade).lerp(o.lit, Math.min(1, lambert * o.litK * gully * (0.45 + 0.55 * fr[r])));
        if (y > o.snowLine) c.lerp(sn.copy(o.snow).multiplyScalar(0.25 + 0.75 * lambert), smooth(o.snowLine, o.snowLine + 18, y) * (0.55 + 0.3 * gully));
        c.lerp(hz, o.haze * (1 - fr[r] * 0.6));
      }
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < cols; i++) for (let r = 0; r < rows - 1; r++) {
    const a = i * rows + r, b = (i + 1) * rows + r;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

// ---------- Highlights ----------
export interface Highlight { group: THREE.Group; hull: THREE.ShaderMaterial | null; glow: THREE.MeshBasicMaterial; center: THREE.Vector3 }
function makeHighlight(id: string, chalkTex: THREE.Texture): Highlight {
  const parts = exGeos.get(id) ?? [];
  const allChalk = parts.length > 0 && parts.every(p => p.chalk);
  const geos = parts.map(p => { if (!allChalk && p.geo.getAttribute('uv')) p.geo.deleteAttribute('uv'); return p.geo; });
  const merged = mergeGeometries(geos)!;
  merged.computeBoundingBox();
  const size = merged.boundingBox!.getSize(new THREE.Vector3()), center = merged.boundingBox!.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  group.visible = false;
  const glow = new THREE.MeshBasicMaterial({
    color: mix('hudAmber', 'concrete', 0.35, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: false, alphaMap: allChalk ? chalkTex : null,
  });
  group.add(new THREE.Mesh(merged, glow));
  let hull: THREE.ShaderMaterial | null = null;
  if (Math.min(size.x, size.y, size.z) > 0.04 && !allChalk) {
    const src = new THREE.BufferGeometry();
    src.setAttribute('position', merged.getAttribute('position'));
    const hg = mergeVertices(src, 1e-3);
    hg.computeVertexNormals();
    hull = new THREE.ShaderMaterial({
      uniforms: { uThick: { value: 0.012 }, uColor: { value: mix('hudAmber', 'concrete', 0.25, 1) }, uAlpha: { value: 0 } },
      vertexShader: 'uniform float uThick; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uThick, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; void main(){ gl_FragColor = vec4(uColor, uAlpha); }',
      side: THREE.BackSide, transparent: true, depthWrite: false,
    });
    group.add(new THREE.Mesh(hg, hull));
  }
  for (const p of parts) if (p.geo !== merged) p.geo.dispose();
  return { group, hull, glow, center };
}

// ---------- Chalk texture (runtime canvas: the Arabic word, the wrong-way arrow, 22 tally strokes) ----------
function chalkTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d')!;
  const r = rng(11);
  g.clearRect(0, 0, 1024, 512);
  g.strokeStyle = g.fillStyle = 'rgba(235,232,222,0.5)';
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.font = '700 150px "Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Sans Arabic", Arial, sans-serif';
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(256, 190); g.rotate(-0.06);
  for (let k = 0; k < 6; k++) g.fillText('الغربان', (r() - 0.5) * 5, (r() - 0.5) * 5);
  g.restore();
  // Arrow pointing right on a west-facing door = south, back toward the village.
  const wob = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    for (let k = 0; k < 3; k++) {
      g.lineWidth = w * (0.7 + r() * 0.5);
      g.beginPath(); g.moveTo(x0 + (r() - 0.5) * 4, y0 + (r() - 0.5) * 4);
      g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + (r() - 0.5) * 10, x1 + (r() - 0.5) * 4, y1 + (r() - 0.5) * 4);
      g.stroke();
    }
  };
  wob(110, 360, 400, 352, 14); wob(400, 352, 340, 312, 13); wob(400, 352, 345, 398, 13);
  // Tally: four gates of five and two strokes = 22.
  const gates = [[560, 120], [710, 120], [860, 120], [560, 300], [710, 300]];
  gates.forEach(([gx, gy], i) => {
    const n = i < 4 ? 4 : 2;
    for (let k = 0; k < n; k++) wob(gx + k * 26, gy + r() * 6, gx + k * 26 + (r() - 0.5) * 8, gy + 130 + r() * 6, 9);
    if (i < 4) wob(gx - 12, gy + 105, gx + 92, gy + 25, 8);
  });
  // Chalk grain: punch tiny holes.
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(0,0,0,${0.4 + r() * 0.6})`; g.fillRect(r() * 1024, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5); }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

// ---------- Material patch: baked occlusion/bounce on indirect light only ----------
const BOUNCE = mix('sodium', 'concrete', 0.45, 0.55);
const FOG_UNIFORMS = {
  uSun: { value: SUN_DIR }, uWarm: { value: SKY.warm.clone().multiplyScalar(SKY.fogWarm) },
  uGlow: { value: SKY.glow.clone().multiplyScalar(SKY.fogGlow) }, uBandPow: { value: SKY.bandPow },
};
/** Sun visibility outside the slice's shadow-map window: the sun-height map (villageTown.sunHeightMap), sampled a
 *  little off the surface along its normal. Inside the window the shadow map rules, as approved, and only the
 *  terrain channel adds the crest's shade; the two blend over the window's last few metres. */
const SUN_H = { uSunH: { value: null as THREE.Texture | null }, uSunHRect: { value: new THREE.Vector4(0, 0, 1, 1) } };
const SHM_GLSL = [
  'uniform sampler2D uSunH;',
  'uniform vec4 uSunHRect;',
  'vec2 sunHeightVis( vec3 wp, vec3 wn ) {',
  '  vec3 p = wp + wn * 0.35;',
  '  vec2 uv = ( p.xz - uSunHRect.xy ) * uSunHRect.zw;',
  '  if ( uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0 ) return vec2( 1.0 );',
  '  vec2 h = texture2D( uSunH, uv ).rg;',
  '  return vec2( smoothstep( -0.16, 0.16, p.y - h.x ), smoothstep( -0.16, 0.16, p.y - h.y ) );',
  '}',
].join('\n');
const LIGHTS_SHM = THREE.ShaderChunk.lights_fragment_begin
  .replace('vec3 geometryNormal = normal;', 'vec3 geometryNormal = normal;\nvec2 shmVis = sunHeightVis( vWPos, normalize( ( vec4( geometryNormal, 0.0 ) * viewMatrix ).xyz ) );')
  .replace(/directLight\.color \*= \( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap\[ i \], ([^;]*) \) : 1\.0;/, (_m, args: string) => [
    '{',
    `  float smv = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], ${args} ) : 1.0;`,
    '  vec3 sc = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;',
    '  float inW = smoothstep( 0.0, 0.04, min( min( sc.x, 1.0 - sc.x ), min( sc.y, 1.0 - sc.y ) ) ) * smoothstep( 0.0, 0.03, sc.z ) * smoothstep( 0.0, 0.03, 1.0 - sc.z );',
    '  directLight.color *= mix( shmVis.x, min( smv, shmVis.y ), inW );',
    '}',
  ].join('\n'));
if (!LIGHTS_SHM.includes('shmVis.x, min( smv')) throw new Error('three.js lights chunk changed: sun-height patch did not apply');

/** A vertex-stage extension of the baked material (the NPC batch poses its figures with it): declarations, code after
 *  the object normal is read, and code after the position is read (before the bake and world position are taken). */
export interface BakeExtra { key: string; uniforms: Record<string, THREE.IUniform>; head: string; normal: string; position: string }
export function patchBake(m: THREE.MeshStandardMaterial, x?: BakeExtra): THREE.MeshStandardMaterial {
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, FOG_UNIFORMS, SUN_H, { uBounce: { value: BOUNCE } }, x?.uniforms);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 bake;\nvarying vec2 vBake;\nvarying vec3 vWPos;\n' + (x?.head ?? ''))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + (x?.normal ?? ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (x?.position ?? '') + '\nvBake = bake;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBake;\nvarying vec3 vWPos;\nuniform vec3 uBounce, uSun, uWarm, uGlow;\nuniform float uBandPow;\n' + SHM_GLSL)
      .replace('#include <lights_fragment_begin>', LIGHTS_SHM)
      .replace('#include <aomap_fragment>', [
        'reflectedLight.indirectDiffuse *= vBake.x;',
        'reflectedLight.indirectSpecular *= vBake.x * vBake.x;',
        'reflectedLight.indirectDiffuse += uBounce * vBake.y * material.diffuseColor;',
      ].join('\n'))
      .replace('#include <fog_fragment>', [
        '#ifdef USE_FOG',
        '  float fogF = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
        '  vec3 hd = normalize( vec3( vWPos.x - cameraPosition.x, 0.0, vWPos.z - cameraPosition.z ) + vec3( 1e-5 ) );',
        '  float cosH = dot( hd.xz, normalize( uSun.xz ) );',
        '  float cs = max( dot( hd, uSun ), 0.0 );',
        '  vec3 fogC = fogColor + uWarm * pow( max( cosH * 0.5 + 0.5, 0.0 ), uBandPow ) + uGlow * ( pow( cs, 28.0 ) * 0.9 + pow( cs, 7.0 ) * 0.16 );',
        '  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogF );',
        '#endif',
      ].join('\n'));
  };
  const key = x ? 'village-bake-' + x.key : 'village-bake';
  m.customProgramCacheKey = () => key;
  return m;
}

// ---------- Flying carpet ("sinafly"): one mesh, a woven pattern in vertex colours, rippled on the CPU ----------
export interface Carpet {
  mesh: THREE.Mesh;
  /** Places the carpet (centre at x, y, z, heading yaw), banks it and runs the ripple. No allocation. */
  place: (x: number, y: number, z: number, yaw: number, roll: number, tilt: number, t: number) => void;
}
const CARPET_W = 1.5, CARPET_L = 2.5;
function makeCarpet(env: THREE.Texture, renderer: THREE.WebGLRenderer, aniso: number): Carpet {
  const W = CARPET_W, L = CARPET_L;
  const rug = new THREE.PlaneGeometry(W, L, 24, 40);
  rug.rotateX(-Math.PI / 2);   // flat, length along z
  const parts: THREE.BufferGeometry[] = [rug];
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const t = new THREE.BoxGeometry(0.035, 0.012, 0.13).translate(-W / 2 + 0.11 + i * (W - 0.22) / 8, 0, s * (L / 2 + 0.06));
    const uv = t.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.01, 0.01);   // tassels sample the gold border
    parts.push(t);
  }
  const g = mergeGeometries(parts)!;
  const pos = g.getAttribute('position'), base = Float32Array.from(pos.array as Float32Array);
  // The weave, drawn once: gold border, navy rules, a red-and-gold zigzag band, a red field with a gold lattice and
  // a navy medallion with a gold star (palette colours; CSS hex is sRGB, as getHexString returns).
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const c2 = cv.getContext('2d')!, hex = (c: THREE.Color) => '#' + c.getHexString();
  const RED = hex(P('emergencyRed').multiplyScalar(0.55)), GOLD = hex(mix('hudAmber', 'hazardYellow', 0.4, 0.8)), NAVY = hex(P('skyNight').multiplyScalar(26)), CREAM = hex(P('concrete').multiplyScalar(1.1));
  const rect = (i: number, col: string) => { c2.fillStyle = col; c2.fillRect(i, i, 256 - 2 * i, 512 - 2 * i); };
  const diamond = (x: number, y: number, w: number, h: number, col: string) => { c2.fillStyle = col; c2.beginPath(); c2.moveTo(x, y - h); c2.lineTo(x + w, y); c2.lineTo(x, y + h); c2.lineTo(x - w, y); c2.closePath(); c2.fill(); };
  rect(0, GOLD); rect(9, NAVY); rect(13, RED);
  c2.fillStyle = GOLD;   // zigzag band between 13 and 37 px from the edge
  for (let k = 0; k < 2; k++) for (let u = 13; u < (k ? 499 : 243); u += 16) {
    const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => { c2.beginPath(); c2.moveTo(ax, ay); c2.lineTo(bx, by); c2.lineTo(cx, cy); c2.fill(); };
    if (k === 0) { tri(u, 13, u + 8, 37, u + 16, 13); tri(u, 499, u + 8, 475, u + 16, 499); }
    else { tri(13, u, 37, u + 8, 13, u + 16); tri(243, u, 219, u + 8, 243, u + 16); }
  }
  rect(37, NAVY); rect(41, RED);
  for (let y = 60; y < 460; y += 34) for (let x = 60; x < 200; x += 34) diamond(x + ((y / 34) & 1) * 17, y, 4, 6, GOLD);
  diamond(128, 256, 70, 130, CREAM); diamond(128, 256, 64, 120, NAVY); diamond(128, 256, 38, 70, GOLD); diamond(128, 256, 16, 30, RED);
  for (const [x, y] of [[41, 41], [215, 41], [41, 471], [215, 471]]) diamond(x, y, 26, 40, NAVY);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
  renderer.initTexture(tex);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMap: env, envMapIntensity: 2.2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.order = 'YXZ';
  mesh.visible = false;
  const arr = pos.array as Float32Array;
  return {
    mesh,
    place(x, y, z, yaw, roll, tilt, t) {
      mesh.position.set(x, y, z);
      mesh.rotation.set(tilt, yaw, roll);
      // A slow travelling wave down the length, stronger toward the back and the edges.
      for (let i = 0; i < arr.length; i += 3) {
        const bx = base[i], bz = base[i + 2];
        arr[i + 1] = base[i + 1] + 0.035 * Math.sin(t * 2.4 + bz * 2.6) * (0.4 + 0.6 * (bz / L + 0.5)) + 0.012 * Math.sin(t * 3.1 + bx * 4.0);
      }
      pos.needsUpdate = true;
    },
  };
}

// ---------- Public build ----------
let tvWindow: THREE.BufferGeometry | null = null;

export interface VillageScene {
  sun: THREE.DirectionalLight;
  sky: THREE.Mesh;
  highlights: Highlight[];
  eastLeaf: THREE.Object3D;
  tvMat: THREE.MeshBasicMaterial;
  flameMat: THREE.MeshBasicMaterial;
  flame: THREE.Mesh;
  mastMat: THREE.MeshBasicMaterial;
  dustTime: { value: number };
  stats: Record<string, number>;
  /** Swinging gate and door leaves (pivot at the hinge), by usable id. */
  leaves: TownScene['leaves'];
  waterTime: { value: number };
  /** Valley sides and the mountain: moved each frame by the parallax field (see villageMain). */
  nearRing: THREE.Object3D;
  farRing: THREE.Object3D;
  /** Resolves (never rejects) once the stone and wood texture sets have loaded or failed (null), after their binds ran,
   *  and every kit texture (the church pictures) has loaded and been uploaded, or failed. */
  texturesReady: Promise<void>;
  /** The church pictures' faces (tests and stills). */
  pictures: TownScene['pictures'];
  /** The "sinafly" carpet: in the scene (hidden) from the start, so its program compiles in the warm-up. */
  carpet: Carpet;
  /** Loose props (village.ts PROPS): each mesh's origin is its bottom centre, moved by its entity. */
  props: { id: string; mesh: THREE.Mesh }[];
  /** The bell rope: its rest position; pulled down by moving the mesh in y. */
  bellRope: THREE.Mesh;
  /** The sky's PMREM environment (the NPC batch shares it). */
  env: THREE.Texture;
  /** Ground sampler used by the rendered mesh, including the low-amplitude outer-valley relief. */
  terrainHeight: (x: number, z: number) => number;
}

/** The scene's geometry kit, handed to the town builders (villageTown.ts) at build time. */
export interface Kit {
  put: typeof put; boxG: typeof boxG; boxMM: typeof boxMM; cylG: typeof cylG; tubeG: typeof tubeG; ellipseG: typeof ellipseG;
  gableG: typeof gableG; slateRoof: typeof slateRoof; windowAt: typeof windowAt; chimney: typeof chimney; railFence: typeof railFence;
  pine: typeof pine; tuft: typeof tuft; boards: typeof boards;
  COL: typeof COL; mix: typeof mix; P: typeof P;
  R: () => number; rr: (a: number, b: number) => number;
  redirect: (to: THREE.BufferGeometry[] | null) => void;
  merge: (g: THREE.BufferGeometry[]) => THREE.BufferGeometry;
  /** An sRGB colour texture, mipmapped and anisotropic, uploaded as soon as it loads; texturesReady waits for it. */
  texture: (url: string) => THREE.Texture;
  waterMaterial: (m: THREE.MeshStandardMaterial) => void;
}

export function buildVillage(scene: THREE.Scene, renderer: THREE.WebGLRenderer, chapterTwo = false): VillageScene {
  // In Chapter 2, the mine track drops through a broad open cut before entering the lower gallery.
  // This same sampler drives the terrain mesh, player physics, mine floor, props, and collision placement.
  const terrainHeight = chapterTwo ? (x: number, z: number) => {
    const along = smooth(258, 278, x) * (1 - smooth(352, 375, x));
    const across = 1 - smooth(4.2, 7.2, Math.abs(z - 40));
    return villageTerrainHeight(x, z) - 7 * along * across;
  } : villageTerrainHeight;
  for (const k of Object.keys(buckets) as BucketId[]) buckets[k].length = 0;
  exGeos.clear();
  FENCES_NOW = fencesNow();
  R = rng(5);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const phase: Record<string, number> = {};
  let prevTris = 0;
  let tPrev = performance.now();
  const mark = (n: string) => {
    const t = buckets.lit.reduce((a, g) => a + triCount(g), 0);
    phase['lit:' + n] = t - prevTris; prevTris = t;
    const now = performance.now(); phase['ms:' + n] = Math.round(now - tPrev); tPrev = now;
  };
  buildBarn(); mark('barn');
  buildFarm(); mark('farm');
  buildFences(); mark('fences');
  buildGround(terrainHeight); mark('ground');
  buildTrees(); mark('trees');

  // Materials: one per bucket.
  const lit = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  lit.shadowSide = THREE.BackSide;

  // The full village around the barn corner (villageTown.ts), on its own random numbers after every slice builder.
  R = rng(9001);
  let waterMat: THREE.MeshStandardMaterial | null = null;
  const kitTex: Promise<void>[] = [], texLoader = new THREE.TextureLoader();
  const texture = (url: string) => {
    let done!: () => void;
    kitTex.push(new Promise<void>(r => { done = r; }));
    const t = texLoader.load(url, tex => { renderer.initTexture(tex); done(); }, undefined, () => done());
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return t;
  };
  const kit: Kit = {
    put, boxG, boxMM, cylG, tubeG, ellipseG, gableG, slateRoof, windowAt, chimney, railFence, pine, tuft, boards, COL, mix, P,
    R: () => R(), rr, redirect: to => { redirect = to; }, merge: g => mergeGeometries(g)!, waterMaterial: m => { waterMat = m; }, texture,
  };
  const town = buildTown(kit, scene, lit);
  mark('town');
  // Lit lamps (owner request): the barn's hanging lantern (its glass now glows), two lanterns on brackets at the z = 0
  // posts, and the street lamp's head on the transformer pole [9]. Fixtures go into the merged buckets (no extra draw
  // calls); each has one point light (no shadows) at its glass. Positions are pinned by tests/village.test.ts.
  const lantern = (x: number, y: number, z: number) => {
    put('glow', boxG(x, y, z, 0.12, 0.2, 0.12), COL.windowWarm);
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put('lit', boxG(x + dx * 0.068, y, z + dz * 0.068, 0.016, 0.26, 0.016), COL.iron);
    put('lit', boxG(x, y + 0.15, z, 0.17, 0.05, 0.17), COL.iron);
    put('lit', boxG(x, y - 0.12, z, 0.17, 0.04, 0.17), COL.iron);
    put('lit', cylG(x, y + 0.175, z, x, y + 0.3, z, 0.008, 0.008, 3), COL.iron);
  };
  lantern(LAMPS[0].x, LAMPS[0].y, LAMPS[0].z);   // on the rope from the z = -4 tie beam
  for (const s of [-1, 1]) {
    const x = s * LANTERN_SIDE.x, y = LANTERN_SIDE.y;
    lantern(x, y, LANTERN_SIDE.z);
    put('lit', boxMM(s * 6.02, y + 0.3, LANTERN_SIDE.z - 0.02, x - s * 0.02, y + 0.33, LANTERN_SIDE.z + 0.02, 1), COL.iron);   // bracket
  }
  for (const L of LAMPS) {
    const pl = new THREE.PointLight(L.street ? P('sodium') : mix('sodium', 'hudAmber', 0.5), L.intensity, L.range, 2);
    pl.position.set(L.x, L.y, L.z);
    scene.add(pl);
  }
  const ground = new THREE.Mesh(groundGeo!, lit);
  ground.receiveShadow = true; ground.matrixAutoUpdate = false;
  scene.add(ground);
  // Sun-height map: shadows of the terrain and the building masses everywhere outside the shadow-map window.
  {
    const shm = sunHeightMap(SUN.elevation);
    const t = new THREE.DataTexture(shm.data, shm.w, shm.h, THREE.RGFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    SUN_H.uSunH.value = t;
    SUN_H.uSunHRect.value.set(shm.x0, shm.z0, 1 / (shm.w * shm.cell), 1 / (shm.h * shm.cell));
  }
  mark('sunmap');
  const base = new THREE.Color(VILLAGE_TEX['stone-wall'].base);
  const stone = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, color: base }));
  stone.shadowSide = THREE.BackSide;
  // Vertex colours hold the target colour; once the texture arrives, divide by its authored base so the average matches.
  for (const g of buckets.stone) {
    const c = g.getAttribute('color');
    for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) / base.r, c.getY(i) / base.g, c.getZ(i) / base.b);
  }
  villageSet('stone-wall').then(set => {
    if (!set) return; // no file: keep the flat colour
    stone.map = set.map; stone.normalMap = set.normal; stone.normalScale.y = NORMAL_Y; stone.color.setRGB(1, 1, 1); stone.needsUpdate = true;
  });
  // Barn boards: same divide-by-base trick as the stone, on the plank set.
  const woodBase = new THREE.Color(VILLAGE_TEX['wood-planks-barn'].base);
  const wood = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, color: woodBase }));
  wood.shadowSide = THREE.BackSide;
  for (const g of buckets.wood) {
    const c = g.getAttribute('color');
    for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) / woodBase.r, c.getY(i) / woodBase.g, c.getZ(i) / woodBase.b);
  }
  villageSet('wood-planks-barn').then(set => {
    if (!set) return; // no file: keep the flat colour
    wood.map = set.map; wood.normalMap = set.normal; wood.normalScale.y = NORMAL_Y; wood.color.setRGB(1, 1, 1); wood.needsUpdate = true;
  });
  // Same shared promises, subscribed after the two binds above, so both binds have run by the time this resolves.
  const texturesReady = Promise.all([villageSet('stone-wall'), villageSet('wood-planks-barn'), ...kitTex]).then(() => {});
  const wet = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const foliage = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
  const chalkTex = chalkTexture(maxAniso);
  const chalk = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, map: chalkTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  const glowM = new THREE.MeshBasicMaterial({ vertexColors: true });
  const noshadow = lit;
  const prints = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));

  // Sky dome + matching environment map (cool zenith, warm glow behind the mountain).
  const skyGeo = new THREE.SphereGeometry(800, 64, 32);
  {
    const p = skyGeo.getAttribute('position'), cols = new Float32Array(p.count * 3), c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); skyColor(v.x, v.y, v.z, c).toArray(cols, i * 3); }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = 1;
  scene.add(sky);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), new THREE.MeshBasicMaterial({ color: mix('hudAmber', 'concrete', 0.12, 6), fog: false, depthWrite: false }));
  disc.position.copy(SUN_DIR).multiplyScalar(780);
  disc.lookAt(0, 0, 0);
  disc.renderOrder = 1;
  sky.add(disc);
  mark('materials');
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  const env = pm.fromScene(envScene, 0.04, 1, 2000).texture;
  for (const [m, k] of [[lit, 2.4], [stone, 2.4], [wood, 2.4], [foliage, 2.0], [chalk, 2.0], [wet, 1.0], [prints, 0.3]] as const) { m.envMap = env; m.envMapIntensity = k; }
  const wm = waterMat as THREE.MeshStandardMaterial | null;
  if (wm) { wm.envMap = env; wm.envMapIntensity = 2.6; }
  pm.dispose();
  mark('envmap');
  const carpet = makeCarpet(env, renderer, maxAniso);
  scene.add(carpet.mesh);
  // Loose props and the bell rope: own meshes on the lit material (moved at runtime), built through put() so they carry
  // the same colour and bake attributes as the merged world. Props cast no shadow (the sun's map is static).
  const own = (build: () => void, at: { x: number; y: number; z: number }) => {
    const parts: THREE.BufferGeometry[] = [];
    redirect = parts; build(); redirect = null;
    const g = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    g.translate(-at.x, -at.y, -at.z);
    const m = new THREE.Mesh(g, lit);
    m.position.set(at.x, at.y, at.z); m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const props = PROPS.map(s => ({ id: s.id, mesh: own(() => {
    const { x, y, z } = s.pos;
    if (s.id === 'pail') {
      put('lit', cylG(x, y, z, x, y + 0.3, z, 0.13, 0.16, 14), COL.iron.clone().multiplyScalar(1.4));
      put('lit', new THREE.TorusGeometry(0.16, 0.01, 4, 18).rotateX(Math.PI / 2).translate(x, y + 0.3, z), COL.iron);
      put('lit', new THREE.TorusGeometry(0.155, 0.006, 4, 12, Math.PI).translate(x, y + 0.3, z), COL.iron);   // handle
    } else {
      put('lit', cylG(x, y + 0.39, z, x, y + 0.44, z, 0.17, 0.17, 14), COL.timber);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.3;
        put('lit', cylG(x + Math.cos(a) * 0.15, y, z + Math.sin(a) * 0.15, x + Math.cos(a) * 0.08, y + 0.4, z + Math.sin(a) * 0.08, 0.022, 0.018, 5), COL.timberDark);
      }
    }
  }, s.pos) }));
  const B0 = BELL_ROPE.pos;
  const bellRope = own(() => {
    put('lit', cylG(B0.x, B0.y + 0.27, B0.z, B0.x, BELL_ROPE.top + 0.45, B0.z, 0.012, 0.012, 5), COL.rope);      // up through the ceiling
    for (let i = 0; i < 6; i++) {   // the striped woollen sally
      put('lit', cylG(B0.x, B0.y - 0.27 + i * 0.09, B0.z, B0.x, B0.y - 0.18 + i * 0.09, B0.z, 0.036, 0.036, 10), i % 2 ? P('concrete').multiplyScalar(1.15) : P('emergencyRed').multiplyScalar(0.7));
    }
    put('lit', cylG(B0.x, B0.y - 0.35, B0.z, B0.x, B0.y - 0.27, B0.z, 0.012, 0.012, 5), COL.rope);
  }, B0);
  const stats: Record<string, number> = { ...phase };
  const mk = (id: BucketId, m: THREE.Material, cast: boolean, receive: boolean) => {
    if (!buckets[id].length) return null;
    const g = mergeGeometries(buckets[id])!;
    for (const b of buckets[id]) b.dispose();
    stats[id] = triCount(g) | 0;
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return mesh;
  };

  // East door leaf: built on its own so it can sway on its hinge.
  const leafGeos: THREE.BufferGeometry[] = [];
  redirect = leafGeos; doorLeaf(1); redirect = null;
  const leafGeo = mergeGeometries(leafGeos)!;
  leafGeo.translate(-(BARN.door.x1 + 0.05), 0, -BARN.z0);
  const leaf = new THREE.Mesh(leafGeo, lit);
  leaf.position.set(BARN.door.x1 + 0.05, 0, BARN.z0);
  leaf.castShadow = leaf.receiveShadow = true;
  scene.add(leaf);

  // TV window: its own flickering material.
  const tvMat = new THREE.MeshBasicMaterial({ color: mix('fogHaze', 'concrete', 0.7, 2) });
  scene.add(new THREE.Mesh(tvWindow!, tvMat));

  const highlights = EXAMINABLES.map(e => makeHighlight(e.id, chalkTex));
  for (const h of highlights) scene.add(h.group);

  mk('lit', lit, true, true);
  mk('stone', stone, true, true);
  mk('wood', wood, true, true);
  mk('noshadow', noshadow, false, true);
  mk('wet', wet, false, true);
  mk('prints', prints, false, true);
  mk('foliage', foliage, false, true);
  mk('chalk', chalk, false, true);
  mk('glow', glowM, false, false);
  mark('merge');
  Object.assign(stats, phase);

  // Candle flame: a small double cone, flickered per frame.
  const flameMat = new THREE.MeshBasicMaterial({ color: mix('hudAmber', 'concrete', 0.2, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const fg = new THREE.SphereGeometry(0.016, 8, 6); fg.scale(1, 2.4, 1);
  const flame = new THREE.Mesh(fg, flameMat);
  flame.position.set(SHRINE.x + 0.12, 1.185, SHRINE.z);
  scene.add(flame);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: mix('sodium', 'hudAmber', 0.5, 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.add(halo);



  // Mountains: near valley sides, then the mountain itself (NNE) with the cave mouth, and the ridge mast to the west.
  // Near valley sides stay below 3 deg in the WSW so the sun clears them; the west ridge carries the mast.
  // The west ridge peaks due west (the mast, village.md: 450 m W, 110 m up) and dips in the WSW where the sun sets.
  const nearH = (b: number) => 4 + 5 * ringNoise(b, 3, 3.1) + 2 * ringNoise(b, 17, 7.7) + 50 * Math.exp(-((angDiff(b, 276) / 14) ** 2))
    + 18 * Math.exp(-((angDiff(b, 293) / 13) ** 2)) + 9 * (ringNoise(b, 64, 5.5) - 0.5) * Math.exp(-((angDiff(b, 280) / 22) ** 2))
    + 20 * Math.exp(-((angDiff(b, 130) / 34) ** 2)) + 12 * Math.exp(-((angDiff(b, 190) / 20) ** 2))
    + 8 * Math.exp(-((angDiff(b, 20) / 14) ** 2)) + 6 * Math.exp(-((angDiff(b, 70) / 10) ** 2));
  const near = ridgeRing(230, nearH, { shade: mix('fogHaze', 'ink', 0.5, 1.0), lit: mix('wallPaint', 'sodium', 0.4, 0.5), snow: P('ink'), snowLine: 999, haze: 0.25, litK: 0.8 });
  const far = ridgeRing(470, b => {
    const m = 125 * Math.exp(-((angDiff(b, MOUNTAIN.bearing) / 12) ** 2)) + 70 * Math.exp(-((angDiff(b, MOUNTAIN.bearing - 23) / 10) ** 2))
      + 62 * Math.exp(-((angDiff(b, MOUNTAIN.bearing + 27) / 13) ** 2)) + 30 * Math.exp(-((angDiff(b, -15) / 16) ** 2))
      + 25 * Math.exp(-((angDiff(b, 110) / 18) ** 2));
    const rock = (6 * ringNoise(b, 28, 4.2) + 3 * ringNoise(b, 92, 9.1)) * Math.min(1, m / 60);
    return 14 + 6 * ringNoise(b, 3.4, 1.3) + m + rock;
  }, { shade: mix('fogHaze', 'skyNight', 0.3, 1.25), lit: mix('sodium', 'rust', 0.45, 1.0), snow: mix('hudAmber', 'concrete', 0.5, 2.3), snowLine: 95, haze: 0.32, litK: 1.15 });
  const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  // Cave mouth: the black arch low on the mountain face.
  const arch = new THREE.Shape();
  arch.moveTo(-6, 0); arch.lineTo(-6, 3); arch.absarc(0, 3, 6, Math.PI, 0, true); arch.lineTo(6, 0); arch.lineTo(-6, 0);
  const ag = new THREE.ShapeGeometry(arch, 8);
  const cd = bearingDir(MOUNTAIN.caveBearing);
  ag.rotateY(-MOUNTAIN.caveBearing * deg); ag.translate(cd.x * 466, 46, cd.z * 466);
  const ac = new Float32Array(ag.getAttribute('position').count * 3);
  const ink = P('ink');
  for (let i = 0; i < ac.length; i += 3) { ac[i] = ink.r; ac[i + 1] = ink.g; ac[i + 2] = ink.b; }
  ag.setAttribute('color', new THREE.BufferAttribute(ac, 3)); ag.deleteAttribute('uv'); ag.deleteAttribute('normal');
  // Two rings, so each can carry its own parallax (villageMain): the valley sides act ~450 m away, the mountain ~2.8 km.
  const nearRing = new THREE.Mesh(near, ringMat);
  const farRing = new THREE.Mesh(mergeGeometries([far, ag])!, ringMat);
  nearRing.renderOrder = farRing.renderOrder = 0;
  scene.add(nearRing, farRing);
  // Ridge mast (landmark c): the lattice top and its red light show over the west ridge; the slope hides the rest.
  const mastMat = new THREE.MeshBasicMaterial({ color: P('emergencyRed').multiplyScalar(3), fog: false });
  const md = bearingDir(273), mh = nearH(273);
  const mast = new THREE.Mesh(new THREE.SphereGeometry(0.75, 6, 4), mastMat);
  mast.position.set(md.x * 226, mh + 11.6, md.z * 226);
  nearRing.add(mast);
  const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.7, 18, 4), new THREE.MeshBasicMaterial({ color: mix('fogHaze', 'ink', 0.55, 0.9), fog: false }));
  mastPole.position.set(md.x * 226.5, mh + 2, md.z * 226.5);
  nearRing.add(mastPole);

  // Sun: warm, very low, from behind the mountain. Static shadow map, rendered once.
  const sun = new THREE.DirectionalLight(mix('sodium', 'hudAmber', 0.25, 1), 3.0);
  sun.target.position.set(0, 0, -7);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 90);
  sun.castShadow = true;
  const size = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
  sun.shadow.mapSize.set(size, size);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 14, bottom: -5, near: 30, far: 160 });
  sun.shadow.bias = -0.00005;
  sun.shadow.normalBias = 0.012;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);

  // Soft sky fill keeps the village characters readable in the low dusk light
  // while leaving the warm directional sun responsible for the scene's shadows.
  const skyFill = new THREE.HemisphereLight('#d7c9ae', '#26312d', 0.28);
  skyFill.position.set(0, 18, 0);
  scene.add(skyFill);

  // Dust motes: drift and the doorway-light falloff run in the vertex shader (no per-frame CPU work or buffer uploads).
  const N = 420, dp = new Float32Array(N * 3), dph = new Float32Array(N);
  for (let i = 0; i < N; i++) { dp[i * 3] = rr(-2.6, 2.6); dp[i * 3 + 1] = rr(0.2, 4.0); dp[i * 3 + 2] = rr(-9.6, 1); dph[i] = R() * 100; }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('phase', new THREE.BufferAttribute(dph, 1));
  const sprite = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const g = cv.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  })();
  const dustTime = { value: 0 };
  const dm = new THREE.PointsMaterial({ size: 0.03, map: sprite, color: mix('hudAmber', 'concrete', 0.3, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  dm.onBeforeCompile = sh => {
    sh.uniforms.uTime = dustTime; sh.uniforms.uSun = { value: SUN_DIR };
    sh.uniforms.uDoor = { value: new THREE.Vector4(BARN.door.x0, BARN.door.x1, BARN.door.h, BARN.z0) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uSun;\nuniform vec4 uDoor;\nattribute float phase;\nvarying float vLit;')
      .replace('#include <begin_vertex>', [
        'vec3 transformed = position + vec3( sin( uTime * 0.13 + phase ) * 0.35, sin( uTime * 0.09 + phase * 1.7 ) * 0.25, cos( uTime * 0.11 + phase ) * 0.35 );',
        'float dn = length( vec2( transformed.x * 0.6, transformed.z - uDoor.w ) );',
        'vLit = exp( -dn / 4.0 ) * step( transformed.y, uDoor.z ) * ( 0.5 + 0.5 * sin( uTime * 1.3 + phase * 5.0 ) ) * 0.35;',
      ].join('\n'));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vLit;');
  };
  const dust = new THREE.Points(dg, dm);
  dust.frustumCulled = false;
  scene.add(dust);

  return { sun, sky, highlights, eastLeaf: leaf, tvMat, flameMat, flame, mastMat, dustTime, stats, leaves: town.leaves, waterTime: town.waterTime, nearRing, farRing, texturesReady, pictures: town.pictures, carpet, props, bellRope, env, terrainHeight };
}
