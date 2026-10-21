// Full-village visuals around the approved barn corner: every building, fence, wall, gate leaf and prop of
// src/villageMap.ts, the stream and its stepping stones [8], the square, terraces and trees, the ground colour
// for roads and paths, the far terrain, and the sun-height map that shadows everything outside the slice's
// shadow-map window. The geometry kit (put, boxG, slateRoof, ...) is passed in from villageScene.ts.
import * as THREE from 'three';
import {
  BUILDINGS, WALLS, PATHS, SQUARE, STONES, BACK_STEPS, MARYAM_YARD, FOUNTAIN, BENCH, TRANSFORMER, POLES_10KV, POLE_SQUARE,
  POLICE_CAR, GRAVES, OLIVES, TOWN_PINES, TERRACE, CHURCH_YARDS, streamX, streamHalf, waterY, fenceRuns, groundY, pathDist,
  type Building, type Face, type Rect, type Path,
} from './villageMap';
import { townBlocked } from './villageMap';
export { townBlocked, slicePineKept } from './villageMap';
import { USABLES, WALL_T, doorRect, doorSteps, BARN, FARMHOUSE, HOUSES, H3, NORTH_WALL_Z, GAP, rng, churchLayout, COLUMN_R, type Usable } from './village';
import type { Kit } from './villageScene';
import { INTERIORS, interiorBuilding } from './interiors';

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rectDist = (x: number, z: number, r: Rect) => { const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1); return Math.sqrt(dx * dx + dz * dz); };

// ---------- Spatial lookups for the bake (4 m buckets) ----------
type FP = Rect & { k: number };
const GC = 4;
function bucketize<T extends Rect>(items: T[], pad: number): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const it of items) for (let i = Math.floor((it.x0 - pad) / GC); i <= Math.floor((it.x1 + pad) / GC); i++)
    for (let j = Math.floor((it.z0 - pad) / GC); j <= Math.floor((it.z1 + pad) / GC); j++) {
      const k = i * 4099 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(it);
    }
  return m;
}
const EMPTY: never[] = [];
const FP_ITEMS: FP[] = [
  ...BUILDINGS.map(b => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, k: 0.5 })),
  { x0: FOUNTAIN.x - FOUNTAIN.r, x1: FOUNTAIN.x + FOUNTAIN.r, z0: FOUNTAIN.z - FOUNTAIN.r, z1: FOUNTAIN.z + FOUNTAIN.r, k: 0.75 },
  ...WALLS.map(w => ({ x0: Math.min(w.x0, w.x1) - w.thick / 2, x1: Math.max(w.x0, w.x1) + w.thick / 2, z0: Math.min(w.z0, w.z1) - w.thick / 2, z1: Math.max(w.z0, w.z1) + w.thick / 2, k: 0.7 })),
];
const FP_GRID = bucketize(FP_ITEMS, 1.9);
const FENCE_ITEMS: Rect[] = fenceRuns().map(r => ({ x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1), z0: Math.min(r.z0, r.z1), z1: Math.max(r.z0, r.z1) }));
const FENCE_GRID = bucketize(FENCE_ITEMS, 0.5);
/** Town footprints (buildings, the fountain, walls) whose ground-contact shadow can reach (x, z). */
export const townFootprints = (x: number, z: number): FP[] => FP_GRID.get(Math.floor(x / GC) * 4099 + Math.floor(z / GC)) ?? EMPTY;
/** Town fence runs near (x, z). */
export const townFenceRuns = (x: number, z: number): Rect[] => FENCE_GRID.get(Math.floor(x / GC) * 4099 + Math.floor(z / GC)) ?? EMPTY;

// ---------- Interiors (sky occlusion inside the enterable shells) ----------
interface Opening { x: number; y: number; z: number; a: number; nx: number; nz: number }
interface Room { r: Rect; y0: number; y1: number; open: Opening[]; base: number }
const ROOMS: Room[] = BUILDINGS.filter(b => b.hollow).map(b => {
  const t = WALL_T, open: Opening[] = [];
  for (const d of b.doors) {
    const g = doorRect(b, d, t), o = d.face === 'n' ? [0, -1] : d.face === 's' ? [0, 1] : d.face === 'e' ? [1, 0] : [-1, 0];
    open.push({ x: (g.x0 + g.x1) / 2, y: b.floor + d.h / 2, z: (g.z0 + g.z1) / 2, a: d.w * d.h * 0.5, nx: o[0], nz: o[1] });
  }
  for (const w of windowsOf(b)) open.push({ x: w.x, y: w.y + w.h / 2, z: w.z, a: w.w * w.h * 0.35, nx: w.o[0], nz: w.o[1] });
  const ceil = b.kind === 'tower' ? 3.3 : b.kind === 'church' ? b.eave + (b.z1 - b.z0) * 0.37 : 2.7;
  return { r: { x0: b.x0 + t * 0.6, x1: b.x1 - t * 0.6, z0: b.z0 + t * 0.6, z1: b.z1 - t * 0.6 }, y0: b.floor - 0.2, y1: b.floor + ceil, open, base: b.kind === 'church' ? 0.2 : 0.16 };
});
/** For a point inside an enterable building: a function giving its sky occlusion; otherwise null. */
export function townInteriors(x: number, y: number, z: number): ((x: number, y: number, z: number, nx: number, ny: number, nz: number) => number) | null {
  for (const R of ROOMS) {
    if (x > R.r.x0 && x < R.r.x1 && z > R.r.z0 && z < R.r.z1 && y > R.y0 && y < R.y1) {
      return (px, py, pz, nx, ny, nz) => {
        let ao = R.base;
        for (const o of R.open) {
          const vx = o.x - px, vy = o.y - py, vz = o.z - pz, d = Math.hypot(vx, vy, vz) || 1;
          const cosO = Math.max(0, -(o.nx * vx + o.nz * vz) / d), cosS = Math.max(0, (nx * vx + ny * vy + nz * vz) / d);
          ao += 1.6 * o.a / (o.a + Math.PI * d * d) * (0.3 + 0.7 * cosO) * (0.35 + 0.65 * cosS);
        }
        return Math.min(1, ao);
      };
    }
  }
  return null;
}

// ---------- Warm light inside the church (bake: the bounce channel) ----------
const CHURCH = BUILDINGS.find(b => b.kind === 'church')!, CHURCH_L = churchLayout(CHURCH);
const LAMP_ROOMS = INTERIORS.map(r => ({ b: interiorBuilding(r.building), lamps: r.lamps, fill: r.fill ?? 0.1 }));
/** The furnished rooms' lamps (src/interiors.ts: Maryam's kitchen lamp, the post's, the café's): warm pools, ~2.4 m
 *  falloff. The priest is in tonight: a low warm fill, the altar candles' glow (falls off over ~2 m) and each picture
 *  lamp's pool on its wall. Baked into the vertices like the barn's sun bounce (villageScene bakeAt), so it costs nothing. */
export function townWarm(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  for (const { b: M, lamps, fill } of LAMP_ROOMS) {
    if (!(x > M.x0 && x < M.x1 && z > M.z0 && z < M.z1)) continue;
    let w = fill;
    for (const L of lamps) {
      const vx = L.x - x, vy = M.floor + L.dy - y, vz = L.z - z, d = Math.hypot(vx, vy, vz) || 1;
      w += (L.k ?? 1.25) * (0.35 + 0.65 * Math.max(0, (nx * vx + ny * vy + nz * vz) / d)) * Math.exp(-d / (L.r ?? 2.4));
    }
    return w;
  }
  const B = CHURCH, L = CHURCH_L;
  if (!(x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1)) return 0;
  const vx = (L.altar.x0 + L.altar.x1) / 2 - x, vy = B.floor + 1.4 - y, vz = L.cz - z, d = Math.hypot(vx, vy, vz) || 1;
  let w = 0.2 + 1.5 * (0.35 + 0.65 * Math.max(0, (nx * vx + ny * vy + nz * vz) / d)) * Math.exp(-d / 2.2);
  for (const p of L.pictures) {
    const out = (z - p.zWall) * p.nz;
    if (out < -0.01 || out > 0.3 || nz * p.nz < 0.5) continue;   // the wall around the picture and the faces on it
    const dx = (x - p.x) / (p.w * 0.8), dy = (y - p.y - p.h * 0.25) / (p.h * 1.1);
    w += 0.8 * Math.exp(-(dx * dx + dy * dy));
  }
  return w;
}

// ---------- Windows of a building (shared by the bake and the builder) ----------
interface Win { x: number; z: number; y: number; w: number; h: number; face: Face; o: [number, number]; light: 'warm' | 'dim' | 'dark' }
function windowsOf(b: Building): Win[] {
  const r = rng(Math.round(b.x0 * 31 + b.z0 * 17) >>> 0), out: Win[] = [];
  const faces: Face[] = ['n', 's', 'e', 'w'];
  const storeys = b.kind === 'church' ? [b.floor + 2.4] : b.kind === 'tower' || b.kind === 'shed' ? [] : b.eave >= 4.5 ? [b.floor + 1.0, b.floor + b.eave * 0.6] : [b.floor + 1.0];
  for (const f of faces) {
    const alongX = f === 'n' || f === 's', a = alongX ? b.x0 : b.z0, len = alongX ? b.x1 - b.x0 : b.z1 - b.z0;
    const n = b.kind === 'church' ? (alongX ? 4 : 0) : Math.max(1, Math.floor((len - 1.5) / 3.2));
    const o: [number, number] = f === 'n' ? [0, -1] : f === 's' ? [0, 1] : f === 'e' ? [1, 0] : [-1, 0];
    for (const [si, y] of storeys.entries()) for (let i = 0; i < n; i++) {
      const u = a + len * (i + 0.5) / n;
      if (b.kind === 'church' && f === 's' && Math.abs(u - b.doors[0].at) < 2.2) continue;
      if (si === 0 && b.doors.some(d => d.face === f && Math.abs(d.at - u) < d.w / 2 + 0.9)) continue;
      if (b.kind === 'barn' && si > 0) continue;
      const w = b.kind === 'church' ? 0.9 : b.kind === 'cafe' && si === 0 && f === 'n' ? 2.4 : 0.85;
      const h = b.kind === 'church' ? 2.6 : b.kind === 'cafe' && si === 0 && f === 'n' ? 1.6 : 1.05;
      const lit = r() < b.lit ? 'warm' : r() < 0.45 ? 'dim' : 'dark';
      out.push({ x: alongX ? u : f === 'e' ? b.x1 : b.x0, z: alongX ? (f === 's' ? b.z1 : b.z0) : u, y, w, h, face: f, o, light: b.kind === 'church' ? 'warm' : lit });
    }
  }
  return out;
}

// ---------- Ground colour of the town (applied after the slice's colour, outside the barn corner) ----------
export function townGroundColor(x: number, z: number, n1: number, n2: number, out: THREE.Color, C: Record<'gravel' | 'mud' | 'cobble' | 'mudWet', THREE.Color>) {
  let road = 0, mud = 0;
  for (const kind of ['road', 'path', 'trail'] as const) {
    const d = pathDist(x, z, kind);
    if (d > 1.6) continue;
    const k = 1 - smooth(-0.4, 0.9 + n1 * 0.6, d);
    if (kind === 'road') road = Math.max(road, k); else mud = Math.max(mud, k * (kind === 'trail' ? 0.85 : 1));
  }
  const cobble = Math.max(1 - smooth(0, 0.6, rectDist(x, z, SQUARE)), ...CHURCH_YARDS.map(r => 1 - smooth(0, 0.5, rectDist(x, z, r))));
  if (x > MARYAM_YARD.x0 + 0.3 && x < MARYAM_YARD.x1 - 0.3 && z > MARYAM_YARD.z0 + 0.3 && z < MARYAM_YARD.z1 - 0.3) mud = Math.max(mud, 0.7);
  const d = x < 90 ? 99 : Math.abs(x - streamX(z)) - streamHalf(z), wet = d < 6 ? (1 - smooth(0.2, 6, d)) * 0.9 : 0;
  if (road > 0) out.lerp(_t.copy(C.gravel).multiplyScalar(0.85 + 0.3 * n2), road);
  if (mud > 0) out.lerp(_t.copy(C.mud).multiplyScalar(0.85 + 0.3 * n2), Math.min(1, mud));
  if (cobble > 0) out.lerp(_t.copy(C.cobble).multiplyScalar((Math.sin(x * 5.1) * Math.sin(z * 4.7) > 0.2 ? 0.9 : 1.06) * (0.82 + 0.36 * n2)), cobble);
  if (wet > 0) out.lerp(C.mudWet, wet * (0.6 + 0.4 * n1));
}
const _t = new THREE.Color();

// ---------- Far terrain ----------
/** Terrain beyond the village: the same ground, with soft fields to the north and the valley floor east. */
export function farY(x: number, z: number, bump: number): number {
  const inside = x > -78 && x < 128 && z > -40 && z < 114;
  return groundY(x, z) + (inside ? 0 : bump * smooth(0, 30, Math.max(-78 - x, x - 128, -40 - z, z - 114)));
}

// ---------- Sun-height map: shadows of the terrain and the building masses outside the shadow-map window ----------
export interface SunHeights { data: Uint16Array; w: number; h: number; x0: number; z0: number; cell: number }
/** For every ground cell, the height a point must clear to see the sun (bearing 240, elevation 4 deg). R: terrain and
 *  building masses, G: terrain only. Swept column by column toward the light, with linear interpolation. */
export function sunHeightMap(sunElevDeg: number): SunHeights {
  const cell = 0.25, x0 = -96, z0 = -64, x1 = 148, z1 = 126, w = Math.round((x1 - x0) / cell), h = Math.round((z1 - z0) / cell);
  const occ = new Float32Array(w * h), ter = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const g = groundY(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell); occ[i + j * w] = g; ter[i + j * w] = g; }
  const stamp = (r: Rect, top: (x: number, z: number) => number) => {
    const i0 = Math.max(0, Math.floor((r.x0 - x0) / cell)), i1 = Math.min(w - 1, Math.ceil((r.x1 - x0) / cell));
    const j0 = Math.max(0, Math.floor((r.z0 - z0) / cell)), j1 = Math.min(h - 1, Math.ceil((r.z1 - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const t = top(x, z); if (t > occ[i + j * w]) occ[i + j * w] = t;
    }
  };
  const IN = 0.18;   // inset: a wall never shadows its own face
  const gable = (b: Rect, floor: number, eave: number, rise: number, alongX: boolean) => stamp({ x0: b.x0 + IN, x1: b.x1 - IN, z0: b.z0 + IN, z1: b.z1 - IN }, (x, z) => {
    const half = alongX ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2, d = alongX ? Math.abs(z - (b.z0 + b.z1) / 2) : Math.abs(x - (b.x0 + b.x1) / 2);
    return floor + eave + rise * Math.max(0, 1 - d / half);
  });
  // The slice's buildings (barn [1], farmhouse, H1-H3): ridge rises from house() and the barn's own numbers.
  gable(BARN, 0, BARN.eave, BARN.ridge - BARN.eave, false);
  gable(FARMHOUSE, 0, 6.0, 5 * 0.75, false);
  gable(HOUSES[0], 0, 4.6, 3.75 * 0.75, true);
  gable(HOUSES[1], 0, 5.0, 3.5 * 0.75, false);
  gable(H3, 0, 4.4, 3.5 * 0.75, false);
  for (const b of BUILDINGS) {
    if (b.kind === 'tower') { stamp({ x0: b.x0 + IN, x1: b.x1 - IN, z0: b.z0 + IN, z1: b.z1 - IN }, () => b.floor + 22); continue; }
    const half = b.ridgeAlongX ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2;
    gable(b, b.floor, b.eave, b.roof === 'lean' ? 0.6 : half * (b.kind === 'church' ? 0.8 : 0.75), b.ridgeAlongX);
  }
  for (const wl of WALLS) {
    const r = { x0: Math.min(wl.x0, wl.x1) - wl.thick / 2 + 0.05, x1: Math.max(wl.x0, wl.x1) + wl.thick / 2 - 0.05, z0: Math.min(wl.z0, wl.z1) - wl.thick / 2 + 0.05, z1: Math.max(wl.z0, wl.z1) + wl.thick / 2 - 0.05 };
    stamp(r, (x, z) => groundY(x, z) + wl.h);
  }
  stamp({ x0: -28, x1: 62.6, z0: NORTH_WALL_Z - 0.25, z1: NORTH_WALL_Z + 0.25 }, (x, z) => (x > GAP.x0 && x < GAP.x1 ? groundY(x, z) : groundY(x, z) + 1.0));
  // Sweep toward the light: the cell one column west and 0.577 rows south feeds each cell (sun at bearing 240).
  const step = cell / Math.cos(30 * Math.PI / 180), drop = step * Math.tan(sunElevDeg * Math.PI / 180), dz = step * 0.5 / cell;
  const H = new Float32Array(w * h), T = new Float32Array(w * h);
  for (let j = 0; j < h; j++) { H[j * w] = occ[j * w]; T[j * w] = ter[j * w]; }
  for (let i = 1; i < w; i++) for (let j = 0; j < h; j++) {
    const jf = j + dz, ja = Math.min(h - 1, Math.floor(jf)), jb = Math.min(h - 1, ja + 1), f = jf - Math.floor(jf);
    const hp = H[i - 1 + ja * w] * (1 - f) + H[i - 1 + jb * w] * f - drop, tp = T[i - 1 + ja * w] * (1 - f) + T[i - 1 + jb * w] * f - drop;
    H[i + j * w] = Math.max(occ[i + j * w], hp); T[i + j * w] = Math.max(ter[i + j * w], tp);
  }
  const data = new Uint16Array(w * h * 2);
  for (let k = 0; k < w * h; k++) { data[k * 2] = THREE.DataUtils.toHalfFloat(H[k]); data[k * 2 + 1] = THREE.DataUtils.toHalfFloat(T[k]); }
  return { data, w, h, x0, z0, cell };
}

// ---------- The town builder ----------
/** A framed picture's lit face: centre, size and facing (+1 faces south, -1 north). */
export interface Picture { name: string; x: number; y: number; z: number; w: number; h: number; nz: number }
export interface TownScene { leaves: { id: string; obj: THREE.Object3D }[]; waterTime: { value: number }; pictures: Picture[] }

export function buildTown(k: Kit, scene: THREE.Scene, leafMat: THREE.Material): TownScene {
  const { put, boxG, boxMM, cylG, COL, mix, P } = k;
  const rr = k.rr, R = k.R;
  const cS = (c: THREE.Color, s: number) => c.clone().multiplyScalar(s);
  const pictures: Picture[] = [];
  // Stained glass (palette only): amber, red, a deep blue from the night sky, a sea green.
  const GLASS = [P('hudAmber'), P('emergencyRed'), P('skyNight').multiplyScalar(40), mix('ruptureTeal', 'wallPaint', 0.5)];
  let glassN = 0;

  // ----- Buildings -----
  for (const b of BUILDINGS) {
    if (b.kind === 'tower') { tower(b); continue; }
    if (b.kind === 'church') { church(b); continue; }
    if (b.kind === 'barn') { barnSmall(b); continue; }
    if (b.kind === 'shed') { shed(b); continue; }
    house(b);
  }

  function plinth(b: Building, tone: number, top = b.floor + 0.4) {
    put('stone', boxMM(b.x0 - 0.06, b.base, b.z0 - 0.06, b.x1 + 0.06, top, b.z1 + 0.06, 0.8), cS(COL.stone, tone * 0.78));
    put('lit', boxMM(b.x0 - 0.1, top - 0.02, b.z0 - 0.1, b.x1 + 0.1, top + 0.06, b.z1 + 0.1, 2), COL.stoneDry);
  }
  function quoins(b: Building, top: number, tone: number) {
    for (const [qx, qz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
      for (let y = b.floor + 0.4; y < top - 0.3; y += 0.34) {
        const a = R() < 0.5 ? 0.42 : 0.28, c = a === 0.42 ? 0.28 : 0.42;
        put('lit', boxG(qx, y + 0.17, qz, a + 0.02, 0.34, c + 0.02), cS(COL.stone, tone * rr(0.95, 1.06)));
      }
    }
  }
  function roof(b: Building, detail: 0 | 1, sarking = false) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, half = (b.ridgeAlongX ? b.z1 - b.z0 : b.x1 - b.x0) / 2;
    const ridge = b.floor + b.eave + half * (b.kind === 'church' ? 0.8 : 0.75);
    k.slateRoof({ cx, cz, span: half, len: (b.ridgeAlongX ? b.x1 - b.x0 : b.z1 - b.z0) / 2, eave: b.floor + b.eave, ridge, alongX: b.ridgeAlongX, over: 0.45, gable: 0.35, detail, sarking });
    for (const e of [-1, 1]) {
      const t = b.ridgeAlongX ? cx + e * ((b.x1 - b.x0) / 2 - 0.25) : cz + e * ((b.z1 - b.z0) / 2 - 0.25);
      put('stone', k.gableG(b.ridgeAlongX, b.ridgeAlongX ? cz : cx, t, half, b.floor + b.eave, ridge, 0.5), cS(COL.stone, 0.95));
    }
    return ridge;
  }
  function windows(b: Building) {
    for (const w of windowsOf(b)) {
      k.windowAt(w.face, w.x, w.z, w.y, w.w, w.h, w.light, b.kind !== 'church' && b.kind !== 'cafe');
      if (b.kind === 'church') { stainedGlass(w); continue; }
      if (b.hollow) {   // the inside face of the pane, so the room reads from within
        const t = WALL_T + 0.02, ix = w.x - w.o[0] * t, iz = w.z - w.o[1] * t;
        // From inside, the glass shows the dusk outside: a cool, dim blue, brighter toward the sunset side.
        put('glow', w.face === 'n' || w.face === 's' ? boxG(ix, w.y + w.h / 2, iz, w.w, w.h, 0.02) : boxG(ix, w.y + w.h / 2, iz, 0.02, w.h, w.w),
          mix('skyNight', 'fogHaze', 0.55, w.face === 's' || w.face === 'w' ? 2.6 : 1.9));
      }
    }
  }
  /** A church window seen from inside: 3 x 6 panes of glass glowing with the dusk behind them (one main colour per
   *  window, a few panes of the next colours), and the lead cames standing 2 cm proud of the glass. Long walls only. */
  function stainedGlass(w: Win) {
    const iz = w.z - w.o[1] * (WALL_T + 0.02), into = -w.o[1], r = rng(Math.round(w.x * 97 + w.z * 13) >>> 0);
    const main = glassN++ % 4, pw = w.w / 3, ph = w.h / 6, x0 = w.x - w.w / 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
      const a = r(), c = a < 0.25 ? GLASS[(main + 1 + Math.floor(a * 12)) % 4] : GLASS[main];
      put('glow', boxG(x0 + (i + 0.5) * pw, w.y + (j + 0.5) * ph, iz, pw, ph, 0.02), cS(c, (j === 5 ? 1.25 : 0.85 + 0.3 * r()) * 1.1));
    }
    const lead = cS(COL.iron, 0.5), cz = iz + into * 0.02;
    for (let i = 0; i <= 3; i++) put('lit', boxG(x0 + i * pw, w.y + w.h / 2, cz, 0.03, w.h + 0.03, 0.015), lead);
    for (let j = 0; j <= 6; j++) put('lit', boxG(w.x, w.y + j * ph, cz, w.w + 0.03, 0.03, 0.015), lead);
  }
  /** Plank door with frame, lintel and sill at the building's floor (static: locked doors and the usable doors' frames). */
  function doorStatic(b: Building, face: Face, at: number, w: number, h: number, leaf: boolean) {
    const ax = face === 'n' || face === 's', o = face === 'n' || face === 'w' ? -1 : 1;
    const x = ax ? at : face === 'e' ? b.x1 : b.x0, z = ax ? (face === 's' ? b.z1 : b.z0) : at, y = b.floor;
    if (leaf) for (let q = 0; q < 4; q++) {
      const u = -w / 2 + (q + 0.5) * w / 4, tone = cS(COL.timber, rr(0.55, 0.75));
      put('lit', ax ? boxG(x + u, y + h / 2, z + o * 0.035, w / 4 - 0.008, h, 0.05) : boxG(x + o * 0.035, y + h / 2, z + u, 0.05, h, w / 4 - 0.008), tone);
    }
    if (leaf) put('lit', ax ? boxG(x + w * 0.33, y + 1.0, z + o * 0.09, 0.04, 0.04, 0.05) : boxG(x + o * 0.09, y + 1.0, z + w * 0.33, 0.05, 0.04, 0.04), COL.iron);
    for (const s of [-1, 1]) put('lit', ax ? boxG(x + s * (w / 2 + 0.06), y + h / 2, z + o * 0.06, 0.12, h, 0.14) : boxG(x + o * 0.06, y + h / 2, z + s * (w / 2 + 0.06), 0.14, h, 0.12), COL.timberDark);
    put('lit', ax ? boxG(x, y + h + 0.1, z + o * 0.06, w + 0.4, 0.2, 0.16) : boxG(x + o * 0.06, y + h + 0.1, z, 0.16, 0.2, w + 0.4), COL.stoneDry);
    put('lit', ax ? boxG(x, y - 0.03, z + o * 0.2, w + 0.3, 0.1, 0.4) : boxG(x + o * 0.2, y - 0.03, z, 0.4, 0.1, w + 0.3), COL.stoneDry);
  }
  function steps(b: Building) {
    for (const d of b.doors) for (const st of doorSteps(b, d)) {
      const g = groundY((st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2);
      put('lit', boxMM(st.x0, g - 0.3, st.z0, st.x1, st.top, st.z1, 1), cS(COL.stoneDry, rr(0.85, 1.05)));
    }
  }
  function house(b: Building) {
    const tone = rr(0.86, 1.08), top = b.floor + b.eave;
    plinth(b, tone);
    if (!b.hollow) put('stone', boxMM(b.x0, b.floor + 0.4, b.z0, b.x1, top, b.z1, 0.8), cS(COL.stone, tone));
    else shell(b, tone);
    quoins(b, top, tone);
    roof(b, b.kind === 'house' || b.kind === 'cafe' ? 1 : 0, false);
    windows(b);
    for (const d of b.doors) doorStatic(b, d.face, d.at, d.w, d.h, d.use === 'locked');
    steps(b);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (b.kind !== 'school') k.chimney(b.ridgeAlongX ? cx + (b.x1 - b.x0) * 0.25 : cx, b.ridgeAlongX ? cz : cz - (b.z1 - b.z0) * 0.22, top + 0.8, 2.4);
    if (b.kind === 'school') {   // the old school's bell-cote on the ridge and a plain name board over the door
      const ridge = top + ((b.x1 - b.x0) / 2) * 0.75;
      put('stone', boxG(cx, ridge + 0.6, b.z0 + 2.2, 0.9, 1.4, 0.4), COL.stone);
      put('lit', cylG(cx, ridge + 0.55, b.z0 + 2.2, cx, ridge + 0.95, b.z0 + 2.2, 0.16, 0.24, 8), COL.iron);
      put('lit', boxG(b.x1 + 0.06, b.floor + 3.1, b.doors[0].at, 0.06, 0.55, 2.6), cS(COL.timberDark, 0.9));
    }
    if (b.kind === 'cafe') cafeExtras(b);
    if (b.id === 'maryam') maryamInterior(b);
    if (b.kind === 'school') policePostInterior(b);
  }
  function policePostInterior(b: Building) {
    const floor = b.floor, cellZ = b.z1 - 3.1;
    // The expanded south bay is a barred holding cell; its collision is in townSolids.
    put('lit', boxG((b.x0 + b.x1) / 2, floor + 2.45, cellZ, b.x1 - b.x0 - 0.9, 0.12, 0.14), COL.iron);
    put('lit', boxG((b.x0 + b.x1) / 2, floor + 0.08, cellZ, b.x1 - b.x0 - 0.9, 0.12, 0.14), COL.iron);
    for (let x = b.x0 + 0.48; x < b.x1 - 0.3; x += 0.52)
      put('lit', cylG(x, floor + 0.1, cellZ, x, floor + 2.42, cellZ, 0.035, 0.035, 5), COL.iron);
    // A notice board and pinned administrative sheets face the entrance. No story text is added.
    const boardZ = b.doors[0].at + 3.45, boardX = b.x1 - WALL_T - 0.05;
    put('lit', boxG(boardX, floor + 1.55, boardZ, 0.08, 1.05, 2.25), COL.timberDark);
    for (const z of [boardZ - 0.63, boardZ, boardZ + 0.63]) {
      put('lit', boxG(boardX - 0.05, floor + 1.58, z, 0.012, 0.73, 0.47), cS(COL.chalk, 0.88));
      for (let line = 0; line < 3; line++)
        put('lit', boxG(boardX - 0.06, floor + 1.78 - line * 0.12, z, 0.012, 0.025, 0.32), cS(COL.iron, 0.75));
    }
  }
  /** Hollow stone shell (enterable): four walls with door gaps, a floor and a ceiling at 2.7 m. */
  function shell(b: Building, tone: number, top = b.floor + b.eave, ceil = 2.7) {
    const t = WALL_T, gaps = b.doors.map(d => ({ d, r: doorRect(b, d, t) }));
    const slab = (r: Rect) => {
      const alongX = r.x1 - r.x0 > r.z1 - r.z0;
      let parts: Rect[] = [r];
      for (const { r: g } of gaps) parts = parts.flatMap(p => (g.x1 <= p.x0 || g.x0 >= p.x1 || g.z1 <= p.z0 || g.z0 >= p.z1) ? [p]
        : (alongX ? [{ ...p, x1: g.x0 }, { ...p, x0: g.x1 }] : [{ ...p, z1: g.z0 }, { ...p, z0: g.z1 }]).filter(q => q.x1 - q.x0 > 0.02 && q.z1 - q.z0 > 0.02));
      for (const p of parts) put('stone', boxMM(p.x0, b.floor + 0.4, p.z0, p.x1, top, p.z1, 0.8), cS(COL.stone, tone));
    };
    slab({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + t }); slab({ x0: b.x0, x1: b.x1, z0: b.z1 - t, z1: b.z1 });
    slab({ x0: b.x0, x1: b.x0 + t, z0: b.z0 + t, z1: b.z1 - t }); slab({ x0: b.x1 - t, x1: b.x1, z0: b.z0 + t, z1: b.z1 - t });
    for (const { d, r } of gaps) put('stone', boxMM(r.x0, b.floor + d.h + 0.2, r.z0, r.x1, top, r.z1, 0.8), cS(COL.stone, tone));   // over the door
    // Floor boards / flags and the ceiling.
    put('lit', boxMM(b.x0 + t, b.floor - 0.1, b.z0 + t, b.x1 - t, b.floor + 0.01, b.z1 - t, 1.2), b.kind === 'church' || b.kind === 'tower' ? cS(COL.stoneDry, 0.85) : cS(COL.timber, 0.7));
    if (ceil > 0) put('lit', boxMM(b.x0 + t, b.floor + ceil, b.z0 + t, b.x1 - t, b.floor + ceil + 0.12, b.z1 - t, 1.2), cS(COL.timberDark, 0.9));
  }
  function church(b: Building) {
    const tone = 0.97, top = b.floor + b.eave;
    plinth(b, tone);
    shell(b, tone, top, 0);
    quoins(b, top, tone);
    roof(b, 1, true);
    windows(b);
    for (const d of b.doors) doorStatic(b, d.face, d.at, d.w, d.h, false);
    steps(b);
    // Interior (churchLayout, village.ts, shared with the collision): pews either side of the aisle facing the altar,
    // engaged columns at the window piers, the altar with its gilded frontal, candles and gold cross, and a framed
    // picture under each lower window, each under a small brass picture lamp. The priest is in tonight.
    const L = churchLayout(b), cz = L.cz, f = b.floor;
    const gilt = mix('hudAmber', 'concrete', 0.3, 0.95), giltDeep = mix('hudAmber', 'rust', 0.35, 0.8), brass = mix('hudAmber', 'metal', 0.5, 0.8), gold = mix('hudAmber', 'concrete', 0.3, 1.6);
    for (const p of L.pews) {
      const x = p.x0 + 0.02, z0 = p.z0 + 0.04, z1 = p.z1 - 0.04;
      put('lit', boxMM(x, f + 0.42, z0, x + 0.42, f + 0.48, z1, 1), cS(COL.timber, 0.75));                   // seat
      put('lit', boxMM(x - 0.02, f + 0.48, z0, x + 0.06, f + 1.0, z1, 1), cS(COL.timberDark, 1));             // back, west edge
      for (const e of [z0, z1]) put('lit', boxMM(x - 0.02, f, e - 0.04, x + 0.46, f + 0.9, e + 0.04, 1), COL.timberDark);
    }
    for (const c of L.columns) {
      const top = f + b.eave - 0.45;
      put('stone', cylG(c.x, f + 0.3, c.z, c.x, top, c.z, COLUMN_R, COLUMN_R - 0.03, 12), cS(COL.stone, 1.05));
      put('lit', boxMM(c.x - 0.38, f, c.z - 0.38, c.x + 0.38, f + 0.3, c.z + 0.38, 1), COL.stoneDry);         // base
      put('lit', boxMM(c.x - 0.36, top, c.z - 0.36, c.x + 0.36, top + 0.2, c.z + 0.36, 1), gilt);              // gilded capital
      put('stone', boxMM(c.x - 0.4, top + 0.2, c.z - 0.4, c.x + 0.4, f + b.eave, c.z + 0.4, 1), cS(COL.stone, 0.95));
    }
    const A = L.altar, ax = (A.x0 + A.x1) / 2;
    put('stone', boxMM(A.x0, f, A.z0, A.x1, f + 1.05, A.z1, 0.8), cS(COL.stone, 1.1));
    put('lit', boxMM(A.x0 - 0.06, f + 1.05, A.z0 - 0.1, A.x1 + 0.06, f + 1.08, A.z1 + 0.1, 1), cS(COL.candle, 0.9));   // cloth
    put('lit', boxMM(A.x0 - 0.05, f + 0.08, A.z0 + 0.1, A.x0, f + 1.0, A.z1 - 0.1, 1), gilt);                          // gilded frontal,
    for (const [y0, y1, z0, z1] of [[0.08, 0.14, A.z0 + 0.1, A.z1 - 0.1], [0.94, 1.0, A.z0 + 0.1, A.z1 - 0.1], [0.14, 0.94, A.z0 + 0.1, A.z0 + 0.16],
      [0.14, 0.94, A.z1 - 0.16, A.z1 - 0.1], [0.3, 0.86, cz - 0.04, cz + 0.04], [0.62, 0.7, cz - 0.24, cz + 0.24]]) {   // its border and cross
      put('lit', boxMM(A.x0 - 0.065, f + y0, z0, A.x0 - 0.04, f + y1, z1, 1), giltDeep);
    }
    for (const dz of [-0.9, -0.45, 0.45, 0.9]) {
      put('lit', cylG(ax, f + 1.08, cz + dz, ax, f + 1.32, cz + dz, 0.025, 0.025, 6), COL.candle);
      put('glow', boxG(ax, f + 1.37, cz + dz, 0.03, 0.07, 0.03), COL.windowWarm);
    }
    put('lit', boxG(ax, f + 1.1, cz, 0.16, 0.04, 0.16), gilt);                       // gold cross on the altar: foot,
    put('glow', boxG(ax, f + 1.47, cz, 0.05, 0.74, 0.05), gold);                     // upright,
    put('glow', boxG(ax, f + 1.62, cz, 0.05, 0.05, 0.38), gold);                     // arms (across the nave)
    put('lit', boxMM(b.x1 - 0.55, f + 2.2, cz - 0.05, b.x1 - 0.48, f + 4.4, cz + 0.05, 1), COL.timberDark);   // cross on the east wall
    put('lit', boxMM(b.x1 - 0.55, f + 3.6, cz - 0.6, b.x1 - 0.48, f + 3.72, cz + 0.6, 1), COL.timberDark);
    // Pictures: backing board, a moulding standing 2 cm proud of the picture (no coplanar faces), the picture lamp.
    // The picture is unlit (MeshBasic) and tinted by the lamp: warm, brighter at the top.
    for (const pic of L.pictures) {
      const { x, y, w, h, nz } = pic, d = (t: number) => pic.zWall + nz * t, m = 0.07, fb = pic.gilt ? 'lit' : 'wood';
      const frame = pic.gilt ? gilt : cS(COL.timberDark, 1);
      put('lit', boxMM(x - w / 2 - 0.03, y - h / 2 - 0.03, d(0), x + w / 2 + 0.03, y + h / 2 + 0.03, d(0.02), 1), cS(COL.timberDark, 0.6));
      put(fb, boxMM(x - w / 2 - m, y + h / 2 - 0.01, d(0), x + w / 2 + m, y + h / 2 + m, d(0.05), 1), frame);
      put(fb, boxMM(x - w / 2 - m, y - h / 2 - m, d(0), x + w / 2 + m, y - h / 2 + 0.01, d(0.05), 1), frame);
      put(fb, boxMM(x - w / 2 - m, y - h / 2 + 0.01, d(0), x - w / 2 + 0.01, y + h / 2 - 0.01, d(0.05), 1), frame);
      put(fb, boxMM(x + w / 2 - 0.01, y - h / 2 + 0.01, d(0), x + w / 2 + m, y + h / 2 - 0.01, d(0.05), 1), frame);
      const ly = y + h / 2 + m + 0.05;
      put('lit', boxMM(x - 0.02, ly, d(0), x + 0.02, ly + 0.03, d(0.2), 1), brass);                                 // arm
      put('lit', boxMM(x - w * 0.3, ly, d(0.15), x + w * 0.3, ly + 0.07, d(0.25), 1), brass);                       // hood
      put('glow', boxMM(x - w * 0.28, ly - 0.006, d(0.16), x + w * 0.28, ly, d(0.24), 1), COL.windowWarm);          // its light
      const g = new THREE.PlaneGeometry(w, h);
      if (nz < 0) g.rotateY(Math.PI);   // rotate about its own centre first, then place: faces into the nave, image the right way round
      g.translate(x, y, d(0.03));
      const pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const t = 0.74 + 0.26 * (pos.getY(i) - (y - h / 2)) / h;
        col[i * 3] = t; col[i * 3 + 1] = t * 0.96; col[i * 3 + 2] = t * 0.88;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: k.texture(`${import.meta.env.BASE_URL}art/photos/${pic.name}.jpg`), vertexColors: true }));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      pictures.push({ name: pic.name, x, y, z: d(0.03), w, h, nz });
    }
  }
  function tower(b: Building) {
    const tone = 0.95, shaft = b.floor + b.eave, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    plinth(b, tone, b.floor + 0.3);
    shell(b, tone, b.floor + 3.4, 3.3);
    put('stone', boxMM(b.x0, b.floor + 3.4, b.z0, b.x1, shaft, b.z1, 0.8), cS(COL.stone, tone));
    quoins(b, shaft, tone);
    put('lit', boxMM(b.x0 - 0.15, shaft - 0.05, b.z0 - 0.15, b.x1 + 0.15, shaft + 0.15, b.z1 + 0.15, 2), COL.stoneDry);
    // Belfry: corner piers, dark arched openings, the bell.
    const bt = shaft + 3.5;
    for (const [px, pz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) put('stone', boxG(px + (px < cx ? 0.55 : -0.55), (shaft + bt) / 2, pz + (pz < cz ? 0.55 : -0.55), 1.1, bt - shaft, 1.1, 0, 0, 0, 0.8), cS(COL.stone, tone));
    put('lit', boxMM(b.x0 + 1.1, shaft, b.z0 + 1.1, b.x1 - 1.1, bt, b.z1 - 1.1, 2), P('ink').multiplyScalar(1.2));
    for (const s of [-1, 1]) {
      put('stone', boxMM(b.x0 + 1.1, shaft + 2.4, cz + s * 2.45 - 0.05, b.x1 - 1.1, bt, cz + s * 2.45 + 0.05, 1), cS(COL.stone, tone));
      put('stone', boxMM(cx + s * 2.45 - 0.05, shaft + 2.4, b.z0 + 1.1, cx + s * 2.45 + 0.05, bt, b.z1 - 1.1, 1), cS(COL.stone, tone));
    }
    put('lit', cylG(cx, shaft + 0.6, cz, cx, shaft + 1.7, cz, 0.62, 0.36, 10), cS(COL.iron, 1.6));
    put('lit', boxMM(b.x0 - 0.2, bt, b.z0 - 0.2, b.x1 + 0.2, bt + 0.25, b.z1 + 0.2, 2), COL.stoneDry);
    const cone = new THREE.ConeGeometry(3.75, b.floor + 22 - bt - 0.25, 4, 1);
    cone.rotateY(Math.PI / 4); cone.translate(cx, (bt + 0.25 + b.floor + 22) / 2, cz);
    put('lit', cone, COL.slate);
    put('lit', cylG(cx, b.floor + 22, cz, cx, b.floor + 23.4, cz, 0.04, 0.04, 4), COL.iron);
    put('lit', boxG(cx, b.floor + 23.0, cz, 0.6, 0.05, 0.05), COL.iron);
    for (const d of b.doors) doorStatic(b, d.face, d.at, d.w, d.h, false);
    steps(b);
    // Ladder up the north wall to the hatch (4 flights of about 5 m start here; climbing comes with Chapter 3).
    const lx0 = cx - 0.3, lx1 = cx + 0.3, lz = b.z0 + WALL_T + 0.12;
    for (const lx of [lx0, lx1]) put('lit', cylG(lx, b.floor, lz, lx, b.floor + 3.35, lz, 0.035, 0.035, 4), COL.timberWarm);
    for (let q = 1; q < 11; q++) put('lit', cylG(lx0, b.floor + q * 0.3, lz, lx1, b.floor + q * 0.3, lz, 0.02, 0.02, 4), COL.timberWarm);
    put('lit', boxMM(cx - 0.45, b.floor + 3.29, b.z0 + 0.5, cx + 0.45, b.floor + 3.3, b.z0 + 1.3, 1), P('ink').multiplyScalar(1.1));
  }
  function barnSmall(b: Building) {
    const tone = rr(0.85, 1.0), wallTop = b.floor + b.eave;
    put('stone', boxMM(b.x0 - 0.05, b.base, b.z0 - 0.05, b.x1 + 0.05, b.floor + 1.1, b.z1 + 0.05, 0.8), cS(COL.stone, tone * 0.85));
    put('lit', boxMM(b.x0 + 0.08, b.floor + 1.1, b.z0 + 0.08, b.x1 - 0.08, wallTop, b.z1 - 0.08, 2), cS(COL.timberDark, 0.7));
    const P0 = b.floor + 1.1, half = (b.ridgeAlongX ? b.z1 - b.z0 : b.x1 - b.x0) / 2, ridge = wallTop + half * 0.62;
    const gt = (u: number, c: number) => wallTop + (ridge - wallTop) * Math.max(0, 1 - Math.abs(u - c) / half) - 0.05;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    k.boards('z', b.x0, -1, b.z0, b.z1, () => P0, b.ridgeAlongX ? () => wallTop : u => gt(u, cz), COL.timber, 0.12);
    k.boards('z', b.x1, 1, b.z0, b.z1, () => P0, b.ridgeAlongX ? () => wallTop : u => gt(u, cz), COL.timber, 0.12);
    k.boards('x', b.z0, -1, b.x0, b.x1, () => P0, b.ridgeAlongX ? u => gt(u, cx) : () => wallTop, COL.timber, 0.12);
    k.boards('x', b.z1, 1, b.x0, b.x1, () => P0, b.ridgeAlongX ? u => gt(u, cx) : () => wallTop, COL.timber, 0.12);
    k.slateRoof({ cx, cz, span: half, len: (b.ridgeAlongX ? b.x1 - b.x0 : b.z1 - b.z0) / 2, eave: wallTop, ridge, alongX: b.ridgeAlongX, over: 0.5, gable: 0.4, detail: 0 });
    for (const d of b.doors) {
      const ax = d.face === 'n' || d.face === 's', o = d.face === 'n' || d.face === 'w' ? -1 : 1;
      const x = ax ? d.at : d.face === 'e' ? b.x1 : b.x0, z = ax ? (d.face === 's' ? b.z1 : b.z0) : d.at;
      for (let q = 0; q < 10; q++) {
        const u = -d.w / 2 + (q + 0.5) * d.w / 10;
        put('lit', ax ? boxG(x + u, b.floor + d.h / 2, z + o * 0.08, d.w / 10 - 0.01, d.h, 0.06) : boxG(x + o * 0.08, b.floor + d.h / 2, z + u, 0.06, d.h, d.w / 10 - 0.01), cS(COL.timber, rr(0.6, 0.85)));
      }
      for (const y of [0.5, d.h - 0.5]) put('lit', ax ? boxG(x, b.floor + y, z + o * 0.13, d.w, 0.14, 0.04) : boxG(x + o * 0.13, b.floor + y, z, 0.04, 0.14, d.w), COL.timberDark);
      put('lit', ax ? boxG(x, b.floor + 1.2, z + o * 0.16, 0.5, 0.05, 0.03) : boxG(x + o * 0.16, b.floor + 1.2, z, 0.03, 0.05, 0.5), COL.iron);   // chained shut
    }
    steps(b);
  }
  function shed(b: Building) {
    const top = b.floor + b.eave, low = top - 0.7;
    put('lit', boxMM(b.x0, b.floor - 0.4, b.z0, b.x1, b.floor + 0.25, b.z1, 1), COL.stoneDry);
    k.boards('z', b.x1, 1, b.z0, b.z1, () => b.floor + 0.25, () => low, COL.timber, 0.25);
    k.boards('x', b.z0, -1, b.x0, b.x1, () => b.floor + 0.25, u => top - (top - low) * (u - b.x0) / (b.x1 - b.x0), COL.timber, 0.25);
    k.boards('x', b.z1, 1, b.x0, b.x1, () => b.floor + 0.25, u => top - (top - low) * (u - b.x0) / (b.x1 - b.x0), COL.timber, 0.25);
    put('lit', boxMM(b.x0 + 0.1, b.floor + 0.25, b.z0 + 0.1, b.x1 - 0.1, low, b.z1 - 0.1, 2), cS(COL.timberDark, 0.5));
    const slope = Math.atan2(top - low, b.x1 - b.x0), L = Math.hypot(top - low, b.x1 - b.x0) + 0.6;
    for (let z = b.z0 - 0.3; z < b.z1 + 0.3; z += 0.62) put('lit', boxG((b.x0 + b.x1) / 2 + 0.25, (top + low) / 2 + 0.06, z + 0.3, L, 0.04, 0.6, 0, 0, -slope, 2), cS(COL.slate, rr(0.75, 1.1)));
    // Half door on the yard side; inside, the cow's empty stall.
    put('lit', boxMM(b.x1 + 0.02, b.floor + 0.25, 9.6, b.x1 + 0.08, b.floor + 1.3, 10.9, 1), cS(COL.timber, 0.65));
  }
  function cafeExtras(b: Building) {
    // Upstairs balcony on the square side (Elia's, from Day 2), and two tables out on the cobbles.
    const z = b.z0, y = b.floor + 3.25;
    put('lit', boxMM(b.x0 + 3, y - 0.12, z - 1.2, b.x0 + 11, y, z, 1), cS(COL.timber, 0.85));
    for (let x = b.x0 + 3.2; x <= b.x0 + 10.8; x += 1.9) {
      put('lit', cylG(x, y - 0.75, z - 0.02, x, y - 0.12, z - 1.1, 0.05, 0.05, 4), COL.timberDark);
      put('lit', cylG(x, y, z - 1.12, x, y + 1.0, z - 1.12, 0.04, 0.04, 4), COL.timberDark);
    }
    put('lit', boxMM(b.x0 + 3, y + 0.95, z - 1.17, b.x0 + 11, y + 1.05, z - 1.07, 1), COL.timberDark);
    for (let x = b.x0 + 3.1; x < b.x0 + 10.9; x += 0.14) put('lit', boxMM(x, y, z - 1.14, x + 0.04, y + 0.95, z - 1.1, 1), COL.timber);
    // Player stair up from the north square to the balcony, aligned with its east end.
    const steps = 17, depth = 0.22, rise = 3.25 / steps, x0 = b.x0 + 8.6;
    for (let i = 0; i < steps; i++) {
      const top = b.floor + rise * (i + 1), z0 = z - 5.1 + i * depth;
      put('lit', boxMM(x0, top - 0.18, z0, x0 + 1.55, top, z0 + depth, 1), COL.timber);
    }
    put('lit', boxMM(b.x0 + 1, b.floor + 2.55, z - 0.9, b.x0 + 14, b.floor + 2.62, z, 2), cS(COL.rope, 0.55));   // awning
    for (const [tx, tz] of [[b.x0 + 2.6, z - 2.6], [b.x0 + 12.5, z - 2.4]]) {
      put('lit', cylG(tx, b.floor, tz, tx, b.floor + 0.72, tz, 0.04, 0.04, 6), COL.iron);
      put('lit', cylG(tx, b.floor + 0.72, tz, tx, b.floor + 0.75, tz, 0.38, 0.38, 10), cS(COL.timber, 0.8));
      for (const s of [-1, 1]) {
        const cxx = tx + s * 0.7;
        put('lit', boxMM(cxx - 0.2, b.floor + 0.44, tz - 0.2, cxx + 0.2, b.floor + 0.48, tz + 0.2, 1), cS(COL.timber, 0.75));
        put('lit', boxMM(cxx + s * 0.18, b.floor + 0.48, tz - 0.2, cxx + s * 0.2, b.floor + 0.92, tz + 0.2, 1), cS(COL.timber, 0.7));
        for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) put('lit', boxMM(cxx + lx - 0.02, b.floor, tz + lz - 0.02, cxx + lx + 0.02, b.floor + 0.44, tz + lz + 0.02, 1), COL.iron);
      }
    }
  }
  function maryamInterior(b: Building) {
    // The stove with its fire door (Ch4: she sits by it). The table, chairs and cupboard are models (src/interiors.ts).
    const y = b.floor;
    put('lit', boxMM(b.x1 - 1.3, y, b.z0 + WALL_T + 0.05, b.x1 - WALL_T - 0.05, y + 0.85, b.z0 + 1.3, 1), cS(COL.iron, 1.3));   // stove
    put('lit', cylG(b.x1 - 0.85, y + 0.85, b.z0 + 0.85, b.x1 - 0.85, y + 2.68, b.z0 + 0.85, 0.07, 0.07, 6), COL.iron);
    put('glow', boxG(b.x1 - 1.0, y + 0.45, b.z0 + 1.32, 0.3, 0.12, 0.02), COL.windowWarm);                           // the fire door
  }
  // Lamps of the furnished rooms (src/interiors.ts; Maryam's is the one she keeps lit): a cord from the ceiling boards
  // and the warm glass. Their light is baked (townWarm).
  for (const r of INTERIORS) {
    const b = interiorBuilding(r.building);
    for (const L of r.lamps) {
      if (L.hang) put('lit', cylG(L.x, b.floor + 2.7, L.z, L.x, b.floor + L.dy + 0.05, L.z, 0.006, 0.006, 3), COL.rope);
      put('glow', boxG(L.x, b.floor + L.dy, L.z, 0.16, 0.1, 0.16), COL.windowWarm);
    }
  }

  // ----- Fences, walls, gates -----
  for (const r of fenceRuns()) k.railFence(r.x0, r.z0, r.x1, r.z1);
  for (const w of WALLS) wallRun(w.x0, w.z0, w.x1, w.z1, w.h, w.thick);
  function wallRun(x0: number, z0: number, x1: number, z1: number, h: number, thick: number, coarse = false) {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0), a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1), c = alongX ? z0 : x0;
    const at = (u: number) => groundY(alongX ? u : c, alongX ? c : u);
    for (let y = 0; y < h - 0.25; y += coarse ? 0.34 : 0.26) {
      let u = a0 + rr(-0.2, 0);
      while (u < a1) {
        const w = coarse ? rr(0.55, 1.0) : rr(0.3, 0.62), ue = Math.min(u + w, a1);
        if (ue - u > 0.08) {
          const m = (u + ue) / 2, g = at(m), sy = coarse ? rr(0.28, 0.35) : rr(0.2, 0.26);
          const col = cS(COL.stoneDry, rr(0.7, 1.15));
          put('lit', alongX ? boxG(m, g + y + sy / 2, c + rr(-0.03, 0.03), ue - u - 0.02, sy, thick - rr(0, 0.08), rr(-0.04, 0.04), rr(-0.05, 0.05), rr(-0.05, 0.05))
            : boxG(c + rr(-0.03, 0.03), g + y + sy / 2, m, thick - rr(0, 0.08), sy, ue - u - 0.02, rr(-0.04, 0.04), rr(-0.05, 0.05), rr(-0.05, 0.05)), col);
        }
        u += w;
      }
    }
    for (let u = a0; u < a1; u += 1.2) {
      const ue = Math.min(u + 1.2, a1), m = (u + ue) / 2, g = at(m);
      put('lit', alongX ? boxG(m, g + h - 0.1, c, ue - u, 0.2, thick * 0.92, 0, 0, 0, 3) : boxG(c, g + h - 0.1, m, thick * 0.92, 0.2, ue - u, 0, 0, 0, 3), cS(COL.stoneDry, rr(0.75, 0.95)));
    }
  }
  // Terrace walls under the olives (0.42 m risers) and the retaining wall of Maryam's yard.
  for (let q = 0; q < 5; q++) {
    const x = TERRACE.x0 - q * TERRACE.step - TERRACE.ramp * 0.5;
    if (x < -74.5) continue;
    for (let z = 20; z < 109; z += 6) {
      const g0 = groundY(x - 0.6, z + 3);
      put('lit', boxMM(x - 0.5, g0 - 0.5, z, x + 0.15, g0 + 0.04, z + 6, 2), cS(COL.stoneDry, rr(0.7, 0.95)));
    }
  }
  {
    const Y = MARYAM_YARD;
    for (let z = Y.z0; z < Y.z1 - 0.01; z += 1.0) {
      if (z + 1.0 > 6.4 && z < 8.6) continue;
      const g = groundY(Y.x1 + 0.6, z + 0.5);
      put('stone', boxMM(Y.x1 - 0.05, g - 0.3, z, Y.x1 + 0.32, Y.y + 0.05, Math.min(z + 1.0, Y.z1), 0.6), cS(COL.stone, rr(0.8, 0.95)));
    }
    for (const st of BACK_STEPS) put('lit', boxMM(st.x0, st.top - 0.4, st.z0, st.x1 + 0.02, st.top, st.z1, 1), cS(COL.stoneDry, rr(0.85, 1.05)));
    for (const z of [6.2, 8.8]) put('stone', boxMM(Y.x1 + 0.25, groundY(94, z) - 0.3, z - 0.2, BACK_STEPS[5].x1, Y.y + 0.15, z + 0.2, 0.6), cS(COL.stone, 0.85));
    // Yard: woodpile against the shed, a bench by the door, a washing line.
    for (let q = 0; q < 26; q++) put('lit', cylG(86.4 + (q % 9) * 0.32, Y.y + 0.15 + Math.floor(q / 9) * 0.27, 6.9, 86.4 + (q % 9) * 0.32, Y.y + 0.15 + Math.floor(q / 9) * 0.27, 7.9, 0.13, 0.13, 6), cS(COL.timberWarm, rr(0.6, 0.9)));
    put('lit', boxMM(71.6, Y.y + 0.42, 15.0, 73.2, Y.y + 0.47, 15.4, 1), cS(COL.timber, 0.8));
    for (const lx of [71.7, 73.1]) put('lit', boxMM(lx - 0.04, Y.y, 15.0, lx + 0.04, Y.y + 0.42, 15.4, 1), COL.timberDark);
    for (const lx of [80.5, 88.5]) put('lit', cylG(lx, Y.y, 19.8, lx, Y.y + 2.0, 19.8, 0.05, 0.05, 5), COL.timberDark);
    put('noshadow', k.tubeG([[80.5, Y.y + 1.95, 19.8], [84.5, Y.y + 1.75, 19.8], [88.5, Y.y + 1.95, 19.8]], 0.006, 16), COL.rope);
  }

  // ----- Usable leaves (gates and doors): each its own pivot so it can swing -----
  const leaves: { id: string; obj: THREE.Object3D }[] = [];
  const leafM = new THREE.Matrix4();
  for (const u of USABLES) {
    if (u.locked) continue;
    // Built at the closed pose in world space (so the bake sees where it really stands), then moved to pivot space.
    const geos: THREE.BufferGeometry[] = [];
    leafM.makeRotationY(u.yaw0).setPosition(u.hinge.x, 0, u.hinge.z);
    k.redirect(geos);
    if (u.kind === 'gate') gateLeaf(u); else doorLeaf(u);
    k.redirect(null);
    const g = k.merge(geos).applyMatrix4(leafM.clone().invert());
    const pivot = new THREE.Object3D();
    pivot.position.set(u.hinge.x, 0, u.hinge.z);
    pivot.rotation.y = u.yaw0;
    const mesh = new THREE.Mesh(g, leafMat);
    mesh.receiveShadow = true; mesh.castShadow = false;
    pivot.add(mesh);
    scene.add(pivot);
    leaves.push({ id: u.id, obj: pivot });
    // Gate posts either side of the opening (static).
    if (u.kind === 'gate') for (const s of [0, 1]) {
      const ax = Math.cos(u.yaw0), az = -Math.sin(u.yaw0), px = u.hinge.x + ax * (s * u.w + (s ? 0.12 : -0.12)), pz = u.hinge.z + az * (s * u.w + (s ? 0.12 : -0.12));
      const g0 = groundY(px, pz);
      put('lit', boxG(px, g0 + 0.75, pz, 0.2, 1.7, 0.2, 0, rr(0, 0.2), 0, 0.6), cS(COL.timberDark, 1));
    }
  }
  /** Leaf parts in pivot space (x along the leaf from the hinge, y world height, z thin), placed by leafM. */
  function putL(g: THREE.BufferGeometry, col: THREE.Color) { put('lit', g.applyMatrix4(leafM), col); }
  function gateLeaf(u: Usable) {
    const L = u.w - 0.06, y = u.y;
    for (const t of [0.04, L - 0.04]) putL(boxG(t, y + u.h / 2 + 0.05, 0, 0.09, u.h - 0.1, 0.07), COL.timberDark);
    for (const hy of [0.3, 0.7, 1.08].filter(v => v < u.h)) putL(boxG(L / 2, y + hy, 0, L, 0.09, 0.05), cS(COL.timber, rr(0.8, 1.05)));
    const ang = Math.atan2(0.7, L - 0.1);
    putL(boxG(L / 2, y + 0.65, 0.03, Math.hypot(L - 0.1, 0.72), 0.08, 0.04, 0, 0, ang), cS(COL.timber, 0.85));
    putL(boxG(0.02, y + 0.9, 0.05, 0.12, 0.05, 0.05), COL.iron);
    putL(boxG(0.02, y + 0.3, 0.05, 0.12, 0.05, 0.05), COL.iron);
    putL(boxG(L - 0.05, y + 0.95, -0.05, 0.1, 0.06, 0.04), COL.iron);
  }
  function doorLeaf(u: Usable) {
    const L = u.w - 0.04, y = u.y + 0.01, h = u.h - 0.02;
    const n = Math.max(3, Math.round(L / 0.22));
    for (let q = 0; q < n; q++) putL(boxG((q + 0.5) * L / n, y + h / 2, 0, L / n - 0.006, h, 0.06), cS(COL.timber, rr(0.55, 0.75)));
    for (const hy of [0.35, h - 0.35]) putL(boxG(L / 2, y + hy, -0.05, L - 0.08, 0.12, 0.03), COL.timberDark);
    putL(boxG(L - 0.14, y + 1.0, 0.06, 0.04, 0.04, 0.06), COL.iron);
    putL(boxG(L - 0.14, y + 1.0, -0.07, 0.04, 0.04, 0.06), COL.iron);
  }

  // ----- The square: fountain [4], bench, bucket and rope, transformer pole [9] with the street lamp, the car -----
  {
    const F = FOUNTAIN;
    for (let q = 0; q < 8; q++) {
      const a = q / 8 * Math.PI * 2 + Math.PI / 8, x = F.x + Math.cos(a) * (F.r - 0.18), z = F.z + Math.sin(a) * (F.r - 0.18);
      put('stone', boxG(x, F.h / 2, z, 0.34, F.h, 2 * F.r * Math.tan(Math.PI / 8) + 0.06, 0, -a, 0, 0.6), cS(COL.stone, 1.12));
      put('lit', boxG(F.x + Math.cos(a) * (F.r - 0.16), F.h + 0.04, F.z + Math.sin(a) * (F.r - 0.16), 0.44, 0.08, 2 * F.r * Math.tan(Math.PI / 8) + 0.1, 0, -a, 0), cS(COL.stoneDry, 1.15));
    }
    put('lit', cylG(F.x, -0.1, F.z, F.x, 0.14, F.z, F.r - 0.3, F.r - 0.3, 8), cS(COL.stoneDry, 0.7));
    put('stone', boxG(F.x, 0.8, F.z, 0.42, 1.6, 0.42, 0, 0.3, 0, 0.6), cS(COL.stone, 1.05));
    put('lit', boxG(F.x, 1.64, F.z, 0.56, 0.1, 0.56, 0, 0.3, 0), COL.stoneDry);
    put('lit', cylG(F.x + 0.18, 1.05, F.z + 0.06, F.x + 0.55, 0.98, F.z + 0.18, 0.025, 0.02, 6), COL.iron);
    // Bucket on the rim and its rope coiled to the ring on the pillar.
    put('lit', cylG(F.x - 1.2, F.h + 0.06, F.z - 0.9, F.x - 1.2, F.h + 0.36, F.z - 0.9, 0.13, 0.16, 10), cS(COL.iron, 1.5));
    put('lit', k.tubeG([[F.x - 1.2, F.h + 0.42, F.z - 0.9], [F.x - 0.8, F.h + 0.3, F.z - 0.55], [F.x - 0.25, 1.15, F.z - 0.2], [F.x - 0.2, 1.2, F.z]], 0.012, 14), COL.rope);
    // Iron bench.
    const B = BENCH;
    for (const s of [-1, 1]) {
      put('lit', boxG(B.x + s * (B.len / 2 - 0.08), 0.24, B.z, 0.05, 0.48, 0.5), COL.iron);
      put('lit', boxG(B.x + s * (B.len / 2 - 0.08), 0.7, B.z + 0.22, 0.05, 0.5, 0.05), COL.iron);
    }
    for (let q = 0; q < 4; q++) put('lit', boxG(B.x, 0.46, B.z - 0.18 + q * 0.12, B.len, 0.03, 0.09), cS(COL.timber, rr(0.75, 0.95)));
    for (let q = 0; q < 2; q++) put('lit', boxG(B.x, 0.66 + q * 0.18, B.z + 0.24, B.len, 0.08, 0.03), cS(COL.timber, rr(0.75, 0.95)));
    // Transformer pole [9]: crossarm, insulators, the can, the only street lamp, Joseph's missing posters (Ch1).
    const T = TRANSFORMER, tg = groundY(T.x, T.z);
    put('lit', cylG(T.x, tg - 0.4, T.z, T.x + 0.04, tg + 9.2, T.z, 0.16, 0.12, 7), COL.timberDark);
    put('lit', boxG(T.x, tg + 8.6, T.z, 1.8, 0.12, 0.12), COL.timberDark);
    for (const o of [-0.8, 0, 0.8]) put('lit', cylG(T.x + o, tg + 8.66, T.z, T.x + o, tg + 8.86, T.z, 0.04, 0.03, 6), cS(COL.chalk, 0.5));
    put('lit', boxG(T.x, tg + 6.6, T.z + 0.3, 0.6, 0.12, 0.7), COL.iron);
    put('lit', cylG(T.x, tg + 6.66, T.z + 0.42, T.x, tg + 7.6, T.z + 0.42, 0.26, 0.26, 10), cS(COL.iron, 1.3));
    put('lit', cylG(T.x, tg + 5.4, T.z, T.x - 1.3, tg + 5.65, T.z - 0.4, 0.035, 0.03, 5), COL.iron);
    put('lit', boxG(T.x - 1.35, tg + 5.55, T.z - 0.42, 0.34, 0.1, 0.24), COL.iron);
    put('glow', boxG(T.x - 1.35, tg + 5.48, T.z - 0.42, 0.22, 0.03, 0.15), cS(COL.windowWarm, 1.4));
    for (const [a, y, c] of [[0.3, 1.55, 0.93], [2.0, 1.45, 0.86], [4.1, 1.62, 0.9]] as const) {
      const px = T.x + Math.cos(a) * 0.17, pz = T.z + Math.sin(a) * 0.17;
      put('lit', boxG(px, tg + y, pz, 0.01, 0.42, 0.3, 0, -a, rr(-0.04, 0.04)), cS(COL.chalk, c * 0.75));
      put('lit', boxG(px + Math.cos(a) * 0.006, tg + y + 0.06, pz + Math.sin(a) * 0.006, 0.006, 0.17, 0.13, 0, -a, 0), cS(COL.timberDark, 0.6));
    }
    // 10 kV line along the valley road to [9], and the square pole where the farm line from the slice ends.
    const tops: [number, number, number][] = [[T.x, tg + 8.7, T.z]];
    for (const [x, z] of POLES_10KV) {
      const g = groundY(x, z);
      put('lit', cylG(x, g - 0.4, z, x, g + 9.0, z, 0.15, 0.11, 6), COL.timberDark);
      put('lit', boxG(x, g + 8.6, z, 1.8, 0.12, 0.12), COL.timberDark);
      tops.push([x, g + 8.7, z]);
    }
    for (let q = 0; q < tops.length - 1; q++) for (const o of [-0.8, 0, 0.8]) {
      const [ax, ay, az] = tops[q], [bx, by, bz] = tops[q + 1], pts: [number, number, number][] = [];
      for (let s = 0; s <= 8; s++) { const t = s / 8; pts.push([ax + o + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.45, az + (bz - az) * t]); }
      put('noshadow', k.tubeG(pts, 0.008, 16), COL.iron);
    }
    const S = POLE_SQUARE, sg = groundY(S.x, S.z);
    put('lit', cylG(S.x, sg - 0.3, S.z, S.x + 0.04, sg + 7.4, S.z, 0.13, 0.1, 6), COL.timberDark);
    put('lit', boxG(S.x, sg + 7.0, S.z, 1.2, 0.1, 0.1), COL.timberDark);
    const pts: [number, number, number][] = [];
    for (let s = 0; s <= 10; s++) { const t = s / 10; pts.push([S.x + (T.x - S.x) * t, 6.95 + (tg + 6.9 - 6.95) * t - Math.sin(t * Math.PI) * 0.8, S.z + (T.z - S.z) * t]); }
    put('noshadow', k.tubeG(pts, 0.01, 24), COL.iron);
    // Police car outside the post [6] (Ch1: Moreno and two officers inside).
    const C = POLICE_CAR, cs = Math.cos(C.yaw), sn = Math.sin(C.yaw);
    const at = (lx: number, ly: number, lz: number): [number, number, number] => [C.x + lx * cs + lz * sn, ly, C.z - lx * sn + lz * cs];
    const body = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: THREE.Color) => { const [x, y, z] = at(lx, ly, lz); put('lit', boxG(x, y, z, sx, sy, sz, 0, C.yaw, 0, 1.2), col); };
    const white = cS(COL.chalk, 0.62), navy = mix('skyNight', 'metal', 0.35, 1.6);
    body(0, 0.62, 0, 1.66, 0.5, 4.3, white);
    body(0, 0.44, 0, 1.68, 0.14, 4.32, navy);
    body(0, 1.07, -0.15, 1.5, 0.42, 2.2, white);
    body(0, 1.08, -0.15, 1.52, 0.3, 2.0, cS(COL.glass, 1.2));
    body(0, 1.33, -0.05, 0.9, 0.1, 0.24, navy);
    for (const [wx, wz] of [[-0.78, -1.35], [0.78, -1.35], [-0.78, 1.35], [0.78, 1.35]]) {
      const [x, , z] = at(wx, 0, wz);
      put('lit', cylG(x - cs * 0.11, 0.31, z + sn * 0.11, x + cs * 0.11, 0.31, z - sn * 0.11, 0.31, 0.31, 10), P('hazardBlack').multiplyScalar(2));
    }
  }

  // ----- Graveyard: headstones and iron crosses, a cypress at the corner -----
  for (const g of GRAVES) {
    const tilt = rr(-0.06, 0.06);
    if (g.kind === 'stone') put('stone', boxG(g.x, 0.36, g.z, 0.56, 0.72, 0.12, tilt, 0, rr(-0.04, 0.04), 0.6), cS(COL.stone, rr(0.85, 1.1)));
    else { put('lit', boxG(g.x, 0.55, g.z, 0.06, 1.1, 0.06, tilt), COL.iron); put('lit', boxG(g.x, 0.82, g.z, 0.5, 0.06, 0.06, tilt), COL.iron); }
    put('lit', boxG(g.x, 0.03, g.z + 0.7, 0.62, 0.06, 1.3), cS(COL.stoneDry, rr(0.6, 0.8)));
  }
  for (const [x, z, h] of [[-18.6, 33.6, 9], [-2.6, 28.4, 7.5]] as const) {
    put('lit', cylG(x, -0.2, z, x, h * 0.15, z, 0.16, 0.12, 5), COL.bark);
    const c = new THREE.ConeGeometry(0.95, h * 0.9, 7, 1); c.translate(x, h * 0.55, z);
    put('lit', c, cS(COL.pine, 0.85));
  }

  // ----- Trees: olives on the terraces, pines in the woods -----
  for (const t of OLIVES) {
    const g = groundY(t.x, t.z), s = t.s;
    const lean = rr(-0.25, 0.25);
    put('lit', cylG(t.x, g - 0.2, t.z, t.x + lean, g + 1.3 * s, t.z + rr(-0.2, 0.2), 0.2 * s, 0.13 * s, 6), cS(COL.bark, 1.15));
    for (let q = 0; q < 3; q++) {
      const ico = new THREE.IcosahedronGeometry(1, 0);
      ico.scale(rr(1.0, 1.5) * s, rr(0.6, 0.85) * s, rr(1.0, 1.5) * s);
      ico.rotateY(R() * 3); ico.translate(t.x + lean + rr(-0.7, 0.7) * s, g + (1.6 + rr(0, 0.7)) * s, t.z + rr(-0.7, 0.7) * s);
      put('foliage', ico, mix('wallPaint', 'concrete', 0.35, rr(0.42, 0.55)));
    }
  }
  for (const p of TOWN_PINES) k.pine(p.x, p.z, p.h);

  // ----- Stream [8]: water ribbon, bank rocks, the seven stepping stones -----
  const waterTime = { value: 0 };
  {
    const pos: number[] = [], idx: number[] = [], NA = 5;
    let row = 0;
    for (let z = -110; z <= 190; z += 1.25, row++) {
      const c = streamX(z), hw = streamHalf(z) + 0.35, y = waterY(z);
      for (let a = 0; a <= NA; a++) pos.push(c - hw + 2 * hw * a / NA, y, z);
      if (row > 0) for (let a = 0; a < NA; a++) { const p = (row - 1) * (NA + 1) + a, q = row * (NA + 1) + a; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const water = new THREE.MeshStandardMaterial({ color: mix('fogHaze', 'skyNight', 0.45, 1.25), roughness: 0.1, metalness: 0, envMapIntensity: 1.0 });
    water.onBeforeCompile = s => {
      s.uniforms.uTime = waterTime;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWP;')
        .replace('#include <normal_fragment_begin>', [
          '#include <normal_fragment_begin>',
          'vec2 q = vWP.xz * vec2(1.7, 0.9) + vec2(0.0, uTime * 0.9);',
          'vec2 rip = vec2(sin(q.x * 2.1 + sin(q.y * 1.3)), cos(q.y * 2.7 + sin(q.x * 1.9))) * 0.07 + vec2(sin(vWP.z * 6.0 + uTime * 3.1), cos(vWP.x * 5.0 - uTime * 2.3)) * 0.03;',
          'normal = normalize(normal + (viewMatrix * vec4(rip.x, 0.0, rip.y, 0.0)).xyz);',
        ].join('\n'));
    };
    k.waterMaterial(water);
    const mesh = new THREE.Mesh(g, water);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }
  for (let q = 0; q < 220; q++) {
    const z = rr(-60, 160), side = R() < 0.5 ? -1 : 1, c = streamX(z), hw = streamHalf(z);
    if (Math.abs(z - 12.5) < 2.2) continue;
    const x = c + side * (hw + rr(-0.3, 1.6)), s = rr(0.18, 0.6);
    const ico = new THREE.IcosahedronGeometry(1, 0);
    ico.scale(s * rr(1, 1.6), s * rr(0.45, 0.8), s * rr(1, 1.6)); ico.rotateY(R() * 3);
    ico.translate(x, Math.max(groundY(x, z), waterY(z) - 0.1) + s * 0.15, z);
    put('lit', ico, cS(COL.stoneDry, rr(0.55, 0.85)));
  }
  for (const st of STONES) {
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const p = ico.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y > 0.3 ? 0.3 + (y - 0.3) * 0.25 : y); }
    ico.computeVertexNormals();
    ico.scale(st.sx * 0.55, 0.62, st.sz * 0.55); ico.rotateY(rr(-0.3, 0.3));
    ico.translate(st.x, st.top - 0.62 * (0.3 + 0.7 * 0.25) + 0.005, st.z);
    put('stone', ico, cS(COL.stone, rr(1.0, 1.15)));
    // A pale ring of broken water round each stone, the current piling against its upstream side.
    put('glow', k.ellipseG(st.x, waterY(st.z) + 0.012, st.z - 0.06, st.sz * 0.62, st.sx * 0.66, Math.PI / 2, 12), mix('concrete', 'fogHaze', 0.4, 0.42));
  }
  // Hoofprints over the east bank: the herd crossed here too, all heading for the mountain.
  {
    const trail = PATHS.find(p => p.kind === 'trail') as Path, wetC = cS(COL.mudWet, 0.8);
    for (let s = 0; s < trail.pts.length - 1; s++) {
      const [ax, az] = trail.pts[s], [bx, bz] = trail.pts[s + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bx - ax), -(bz - az));
      for (let d = 0; d < L; d += 0.37) {
        const t = d / L, x = ax + (bx - ax) * t + rr(-0.12, 0.12), z = az + (bz - az) * t + rr(-0.12, 0.12);
        if (x > 125.5) break;
        const py = yaw + rr(-0.12, 0.12), sc = rr(0.85, 1.15), g = groundY(x, z) + 0.008;
        for (const hh of [-1, 1]) put('prints', k.ellipseG(x + Math.cos(py) * hh * 0.033 * sc, g, z - Math.sin(py) * hh * 0.033 * sc, 0.062 * sc, 0.027 * sc, py + hh * 0.08, 7), cS(wetC, rr(0.4, 0.6)));
      }
    }
  }
  // Tufts across the town's grass (the slice keeps its own near the barn).
  for (let q = 0; q < 5200; q++) {
    const x = rr(-74, 124), z = rr(-19, 109);
    if (x > -38 && x < 32 && z > -62 && z < 38) continue;
    if (townBlocked(x, z) || Math.abs(x - streamX(z)) < streamHalf(z) + 1.2) continue;
    k.tuft(x, z, rr(0.7, 1.3), cS(mix('wallPaint', 'rust', 0.38, 0.5).lerp(mix('wallPaint', 'hudAmber', 0.3, 0.46), R()), 1.25));
  }
  return { leaves, waterTime, pictures };
}
