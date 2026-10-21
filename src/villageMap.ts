// Full village blockout from studio/world/regions/village.md (1 cell = 5 m, 40 x 26 cells, north up).
// Pure data + terrain, no Three.js: src/village.ts builds collision from it, src/villageScene.ts the visuals.
// World axes as in village.ts: x east, y up, z south, metres. The grid is anchored on barn [1], which village.md
// puts at cols 13-16, rows 2-5: cell (c, r) covers x 5c-75 .. 5c-70, z 5r-20 .. 5r-15.
// The barn corner (approved slice: barn, farmhouse, yard, pasture, north wall and gap) keeps its own numbers in
// village.ts; where it and the grid disagree the slice wins and the deviation is listed in DEVIATIONS.

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export type Face = 'n' | 's' | 'e' | 'w';

/** village.md grid, verbatim (rows 00-25, cols 0-39). */
export const GRID = [
  '^^^^^^^#----------------:---,,,,,,,~~^^^',
  '^^^^^^^#|,,,,,,,,,,,,,,,:,,|,,,,,,,~~,^^',
  '^^^^^^^#|,,,,BBBB,,,,,,,:,,|,,,,,,,~~,,^',
  '^^^^^^^#|2H,,B1BB,,,,,,,:,,|,,,,,,,~~,,^',
  '^^^^^^^#|HH..BBBB,,,,,,,:,,|------,~~,,^',
  '^^^^^^^#|....BBBB,,,,,,,:,,||7HB.:,~~,,^',
  '^^^^^^^#|.W..,,,,,,,,,,,:,,||HHB.|,8o:::',
  '^^^^^^^#----------------:---|....|,~~,,^',
  'ttttttt#,,,,,,,,,,,,,,,,:,,,--:---,~~,,^',
  'ttttttt#,,,++++3CCCC.HH,:,,,,,:,,,,~~,,^',
  'ttttttt#,,,++++.CCCC.HH,:,,,,,:,,,,~~,,^',
  'ttttttt#,,,,,,...........::::::,,,,~~,,^',
  'ttttttt#,,,6S............,HH,,,,,,,~~,,^',
  'ttttttt#,,,SS......4.....,HH,,,,,,,~~,,^',
  'ttttttt#,,,SS............,,,,,,,,,,~~,,^',
  'ttttttt#,,,,,............,,,,,,,,,,~~,,^',
  'ttttttt#,,,,HH,5KKK,,,=9,HH,,,,,,,,~~,,^',
  'ttttttt#,,,,HH,KKKK,,,=,,HH,,,,,,,,~~,,^',
  'ttttttt#,,BBB,,,,,,,,,=,,,,,,,,,,,,~~,,^',
  'ttttttt#,,BBB,,,,,HH,,=,,,,BBB,,,,,~~,,^',
  'ttttttt#,,BBB,,,,,HH,,=,HH,BBB,,,,,~~,,^',
  'ttttttt#,,,,,,,,,,,,,,=,HH,BBB,,,,,~~,,^',
  'ttttttt#,,,,HH,,,,,,,,=,,,,,,,,,,,,~~,,^',
  'ttttttt#,,,,HH,,,,,,,,=,,,HH,,,,,,,~~,,^',
  'ttttttt#,,,,,,,,,,,,,,=,,,HH,,,,,,,~~,,^',
  'ttttttt#,,,,,,,,,,,,,,=,,,,,,,,,,,,~~,,^',
];
export const CELL = 5;
export const ORIGIN = { x: -75, z: -20 };
/** World rect of the cells (c0..c1, r0..r1), inclusive. */
export const cells = (c0: number, r0: number, c1 = c0, r1 = r0): Rect =>
  ({ x0: ORIGIN.x + c0 * CELL, x1: ORIGIN.x + (c1 + 1) * CELL, z0: ORIGIN.z + r0 * CELL, z1: ORIGIN.z + (r1 + 1) * CELL });
export const cellCentre = (c: number, r: number) => ({ x: ORIGIN.x + (c + 0.5) * CELL, z: ORIGIN.z + (r + 0.5) * CELL });
/** The playable map (grid bounds). The barn corner's pasture and wall lie north of it. */
export const MAP: Rect = cells(0, 0, 39, 25);

// ---------- Terrain ----------
// Elevations (y = 0 is the core at about 900 m): the core shelf is flat (barn corner, church, square); east of
// x = 50 the ground falls 12 % toward the stream; the stream runs in a 2 m ravine; the east bank rises toward the
// mountain; west of the dry-stone wall the olive terraces climb in 0.42 m steps. The valley road falls 2.5 % south.
export const SLOPE = { x0: 50, k: 0.12, southZ: 62, southK: 0.025 };
export const TERRACE = { x0: -41.5, step: 7.5, rise: 0.42, ramp: 0.9 };
/** Stream centreline, half width and water level. 5 m of water at the stepping stones (z = 12.5). */
export const streamX = (z: number) => 104.5 + 1.1 * Math.sin((z + 20) / 17) + 0.5 * Math.sin((z + 20) / 7.3 + 1);
export const streamHalf = (z: number) => 2.5 + 0.5 * Math.sin((z - 12.5) / 13);
export const waterY = (z: number) => -8.3 - 0.008 * (z - 12.5);
/** The west bank (5.5 m) and the east bank (6.5 m) stay under 35 deg; past it the east bank climbs out of the
 *  village's evening shadow into the last sun, toward the mountain, and levels off at the valley floor (-2.5 m). */
export const BANK = { west: 5.5, east: 6.5, eastRise: 3.0, eastK: 0.15, floor: -2.5 };
/** Maryam's yard [7] is levelled: a 1.2 m retaining wall on the stream side, 6 stone steps at the back gate. */
export const MARYAM_YARD: Rect & { y: number } = { x0: 67.5, x1: 92.5, z0: 2.5, z1: 22.5, y: -3.9 };
const smooth01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Natural ground before the stream and the yard pad (used for building floors and the pad blend). */
export function slopeY(x: number, z: number): number {
  let y = 0;
  if (x < TERRACE.x0) {
    const u = TERRACE.x0 - x, k = Math.floor(u / TERRACE.step);
    y = TERRACE.rise * (k + smooth01((u - k * TERRACE.step) / TERRACE.ramp));
  } else if (x > SLOPE.x0) y = -SLOPE.k * (x - SLOPE.x0);
  if (z > SLOPE.southZ) y -= SLOPE.southK * (z - SLOPE.southZ);
  return y;
}

/** Terrain height at (x, z): the physics ground and the ground mesh both sample this. Allocation-free. */
export function groundY(x: number, z: number): number {
  let y = slopeY(x, z);
  // Maryam's levelled yard: 3 m banks to the west, north and south, a retaining wall to the east.
  const Y = MARYAM_YARD;
  if (x > Y.x0 - 3 && x < Y.x1 + 0.25 && z > Y.z0 - 3 && z < Y.z1 + 3) {
    const wx = x > Y.x1 ? 1 - (x - Y.x1) / 0.25 : smooth01((x - (Y.x0 - 3)) / 3);
    const wz = smooth01(Math.min(z - (Y.z0 - 3), Y.z1 + 3 - z) / 3);
    y += (Y.y - y) * Math.min(wx, wz);
  }
  // Ravine: the west bank falls from the slope to the water's edge, the bed dips 0.55 m, the east bank climbs.
  if (x < 93) return y;
  const c = streamX(z), hw = streamHalf(z), w = waterY(z), d = x - c;
  if (d > -(hw + BANK.west)) {
    if (d < -hw) {
      const t = smooth01((d + hw + BANK.west) / BANK.west);
      y += (w + 0.06 - y) * t;
    } else if (d <= hw) {
      const u = d / hw;
      y = w - 0.06 - 0.55 * (1 - u * u);
    } else if (d < hw + BANK.east) {
      y = w + 0.06 + BANK.eastRise * smooth01((d - hw) / BANK.east);
    } else {
      y = Math.min(BANK.floor, w + 0.06 + BANK.eastRise + BANK.eastK * (d - hw - BANK.east));
    }
  }
  return y;
}

/** Lowest and highest terrain under a rectangle (corners, edge midpoints, centre). */
export function groundRange(r: Rect): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const fx of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) {
    const g = groundY(r.x0 + (r.x1 - r.x0) * fx, r.z0 + (r.z1 - r.z0) * fz);
    lo = Math.min(lo, g); hi = Math.max(hi, g);
  }
  return [lo, hi];
}

// ---------- Buildings ----------
export interface Text { ar: string; en: string }
export interface DoorSpec {
  face: Face;
  at: number;          // centre along the wall (world x for n/s walls, world z for e/w walls)
  w: number; h: number;
  use: 'open' | 'locked';
  id?: string;         // usable doors (open) have an id
}
export type Kind = 'house' | 'barn' | 'church' | 'tower' | 'school' | 'cafe' | 'shed';
export interface Building extends Rect {
  id: string;
  kind: Kind;
  landmark?: number;   // the village.md digit that stands in one of its cells
  cells?: [number, number, number, number];   // grid cells (c0, r0, c1, r1) it stands for (conformance tests)
  eave: number;        // wall height above the floor
  ridgeAlongX: boolean;
  roof: 'gable' | 'lean' | 'pyramid';
  doors: DoorSpec[];
  lit: number;         // share of windows lit warm (evening), 0..1
  hollow?: boolean;    // enterable shell
  floor: number;       // floor level (computed from the terrain)
  base: number;        // plinth bottom (lowest terrain under the footprint)
}
const bld = (b: Omit<Building, 'floor' | 'base'>): Building => {
  const [lo, hi] = groundRange(b);
  return { ...b, floor: hi + 0.02, base: lo - 0.4 };
};
const D = (face: Face, at: number, use: 'open' | 'locked' = 'locked', id?: string, w = 1.0, h = 2.1): DoorSpec => ({ face, at, w, h, use, id });

/** Every building of the village core outside the barn corner (barn [1], the farmhouse [2] and three houses are
 *  built by the slice code in village.ts / villageScene.ts). Footprints sit 0.5-1 m inside their cells. */
export const BUILDINGS: Building[] = [
  // North row: the church block (graveyard, tower [3], nave, yard, priest's house).
  bld({ id: 'tower', kind: 'tower', landmark: 3, cells: [15, 9, 15, 9], x0: 0, x1: 5, z0: 25, z1: 30, eave: 15, ridgeAlongX: true, roof: 'pyramid',
    doors: [D('s', 2.5, 'open', 'door-tower', 1.15, 2.2)], lit: 0, hollow: true }),
  bld({ id: 'church', kind: 'church', cells: [16, 9, 19, 10], x0: 5, x1: 24, z0: 26.5, z1: 35, eave: 7.5, ridgeAlongX: true, roof: 'gable',
    doors: [D('s', 9.5, 'open', 'door-church', 1.7, 2.9)], lit: 1, hollow: true }),
  bld({ id: 'priest', kind: 'house', cells: [21, 9, 22, 10], x0: 30.5, x1: 39.5, z0: 26.5, z1: 34, eave: 5.6, ridgeAlongX: true, roof: 'gable',
    doors: [D('w', 30, 'open', 'door-priest', 1.2)], lit: 0.5, hollow: true }),
  // The square's west side: the old school, now the police post [6].
  // Enterable since build step 2: Moreno's table and Omar's chair inside (src/interiors.ts).
  bld({ id: 'school', kind: 'school', landmark: 6, cells: [11, 11, 12, 15], x0: -19.5, x1: -10.5, z0: 37.5, z1: 58.5, eave: 6.8, ridgeAlongX: false, roof: 'gable',
    doors: [D('e', 47.5, 'open', 'door-post', 1.5, 2.6)], lit: 0.35, hollow: true }),
  // East of the square.
  bld({ id: 'house-e1', kind: 'house', cells: [26, 12, 27, 13], x0: 55.5, x1: 64, z0: 41, z1: 49, eave: 5.2, ridgeAlongX: false, roof: 'gable',
    doors: [D('w', 45, 'open', 'door-house-e1', 1.2)], lit: 0.5, hollow: true }),
  // South side: the café-shop [5] with rooms upstairs, then the houses and barns down the valley road.
  bld({ id: 'cafe', kind: 'cafe', landmark: 5, cells: [15, 16, 18, 17], x0: 0.5, x1: 19.5, z0: 60.5, z1: 69.5, eave: 6.6, ridgeAlongX: true, roof: 'gable',
    doors: [D('n', 7, 'open', 'door-cafe', 1.4, 2.4)], lit: 0.7, hollow: true }),
  bld({ id: 'house-sw1', kind: 'house', cells: [12, 16, 13, 17], x0: -14.5, x1: -6, z0: 60.5, z1: 68.5, eave: 5.0, ridgeAlongX: true, roof: 'gable',
    doors: [D('n', -9, 'open', 'door-house-sw1', 1.2)], lit: 0.4, hollow: true }),
  bld({ id: 'house-se1', kind: 'house', cells: [25, 16, 26, 17], x0: 50.5, x1: 59, z0: 60.5, z1: 69, eave: 5.4, ridgeAlongX: true, roof: 'gable',
    doors: [D('w', 64, 'open', 'door-house-se1', 1.2)], lit: 0.6, hollow: true }),
  bld({ id: 'house-s1', kind: 'house', cells: [18, 19, 19, 20], x0: 15.5, x1: 24.5, z0: 75.5, z1: 83.5, eave: 5.0, ridgeAlongX: false, roof: 'gable',
    doors: [D('e', 79, 'open', 'door-house-s1', 1.2)], lit: 0.3, hollow: true }),
  bld({ id: 'house-s2', kind: 'house', cells: [24, 20, 25, 21], x0: 45.5, x1: 54, z0: 80.5, z1: 89, eave: 4.8, ridgeAlongX: true, roof: 'gable',
    doors: [D('w', 84, 'open', 'door-house-s2', 1.2)], lit: 0.5, hollow: true }),
  bld({ id: 'house-sw2', kind: 'house', cells: [12, 22, 13, 23], x0: -14.5, x1: -6, z0: 90.5, z1: 99, eave: 4.6, ridgeAlongX: false, roof: 'gable',
    doors: [D('e', 94, 'open', 'door-house-sw2', 1.2)], lit: 0.3, hollow: true }),
  bld({ id: 'house-s3', kind: 'house', cells: [26, 23, 27, 24], x0: 55.5, x1: 64, z0: 95.5, z1: 104, eave: 5.0, ridgeAlongX: true, roof: 'gable',
    doors: [D('w', 99, 'open', 'door-house-s3', 1.2)], lit: 0.4, hollow: true }),
  bld({ id: 'barn-w', kind: 'barn', cells: [10, 18, 12, 20], x0: -24.5, x1: -10.5, z0: 70.5, z1: 84.5, eave: 5.0, ridgeAlongX: false, roof: 'gable',
    doors: [D('e', 77.5, 'locked', undefined, 3.6, 3.8)], lit: 0 }),
  bld({ id: 'barn-e', kind: 'barn', cells: [27, 19, 29, 21], x0: 60.5, x1: 74.5, z0: 75.5, z1: 89.5, eave: 5.0, ridgeAlongX: false, roof: 'gable',
    doors: [D('w', 82.5, 'locked', undefined, 3.6, 3.8)], lit: 0 }),
  // Maryam's house [7]: the last house before the stream, kitchen lit; the lean-to cow shed against its east wall.
  bld({ id: 'maryam', kind: 'house', landmark: 7, cells: [29, 5, 30, 6], x0: 70.5, x1: 80, z0: 6, z1: 14.5, eave: 5.0, ridgeAlongX: true, roof: 'gable',
    doors: [D('s', 74, 'open', 'door-maryam', 1.15, 2.1)], lit: 0.6, hollow: true }),
  bld({ id: 'shed', kind: 'shed', cells: [31, 5, 31, 6], x0: 80, x1: 84.5, z0: 6.5, z1: 14, eave: 2.6, ridgeAlongX: false, roof: 'lean',
    doors: [], lit: 0 }),
];
// Floors of the yard buildings sit on the yard pad.
for (const b of BUILDINGS) if (b.id === 'maryam' || b.id === 'shed') { b.floor = MARYAM_YARD.y + 0.02; b.base = Math.min(b.base, MARYAM_YARD.y - 0.4); }

// ---------- Fences (rail, 1.2 m: not jumpable) and dry-stone walls (#, 1.0 m: jumpable) ----------
export interface Run { x0: number; z0: number; x1: number; z1: number; edge?: boolean }
export interface Gate { id: string; x: number; z: number; w: number; alongX: boolean; swing: number; name: Text }
/** Usable gates (the `:` cells in a fence line). Hinge at the low end of the opening; `swing` is the open yaw
 *  (radians, positive = counter-clockwise seen from above). */
export const GATES: Gate[] = [
  { id: 'gate-farm-s', x: 47.5, z: 17.5, w: 3.2, alongX: true, swing: 1.75, name: { ar: 'بوابة المزرعة', en: 'Farm gate' } },
  { id: 'gate-farm-n', x: 47.5, z: -13.5, w: 3.2, alongX: true, swing: 1.75, name: { ar: 'بوابة المرعى', en: 'Pasture gate' } },
  { id: 'gate-maryam', x: 77.5, z: 22.5, w: 1.4, alongX: true, swing: 1.6, name: { ar: 'بوابة الفناء', en: 'Yard gate' } },
  { id: 'gate-back', x: 92.5, z: 7.5, w: 1.3, alongX: false, swing: -1.6, name: { ar: 'البوابة الخلفية', en: 'Back gate' } },
];
/** Rail fences of the full village (the barn corner's own fences stay in village.ts FENCES). Openings for the
 *  gates are cut by fenceRuns(). */
export const TOWN_FENCES: Run[] = [
  // Farm enclosure (grid rows 0-7, cols 8-27): north fence east of the slice pasture, east fence, south fence.
  { x0: 28, z0: -13.5, x1: 62.5, z1: -13.5 },
  { x0: 62.5, z0: -38.5, x1: 62.5, z1: 17.5 },
  { x0: 22, z0: 17.5, x1: 25, z1: 17.5 }, { x0: 32, z0: 17.5, x1: 62.5, z1: 17.5 },
  // Maryam's yard (rows 4-8, cols 28-33).
  { x0: 67.5, z0: 2.5, x1: 92.5, z1: 2.5 }, { x0: 67.5, z0: 2.5, x1: 67.5, z1: 22.5 },
  { x0: 92.5, z0: 2.5, x1: 92.5, z1: 22.5 }, { x0: 67.5, z0: 22.5, x1: 92.5, z1: 22.5 },
  // Map boundary (edge: 3 m of collision, so no one balances along its top from the jumpable wall): west, north
  // (both sides of the farm), east bank, south (the road leaves through it).
  { x0: -75, z0: -20, x1: -75, z1: 110, edge: true }, { x0: -75, z0: -20, x1: -28, z1: -20, edge: true }, { x0: -28, z0: -20, x1: -28, z1: -13.5, edge: true },
  { x0: 62.5, z0: -20, x1: 97, z1: -20, edge: true }, { x0: 112, z0: -20, x1: 125, z1: -20, edge: true },
  { x0: 125, z0: -20, x1: 125, z1: 10.5, edge: true }, { x0: 125, z0: 14.5, x1: 125, z1: 110, edge: true },
  { x0: -75, z0: 110, x1: 34, z1: 110, edge: true }, { x0: 41, z0: 110, x1: 97, z1: 110, edge: true }, { x0: 112, z0: 110, x1: 125, z1: 110, edge: true },
];
/** Splits fence runs around the gate openings. */
export function fenceRuns(): Run[] {
  const out: Run[] = [];
  for (const r of TOWN_FENCES) {
    let parts: Run[] = [r];
    for (const g of GATES) {
      parts = parts.flatMap(p => {
        const alongX = p.z0 === p.z1;
        if (alongX !== g.alongX) return [p];
        if (alongX ? Math.abs(p.z0 - g.z) > 0.01 : Math.abs(p.x0 - g.x) > 0.01) return [p];
        const a = alongX ? Math.min(p.x0, p.x1) : Math.min(p.z0, p.z1), b = alongX ? Math.max(p.x0, p.x1) : Math.max(p.z0, p.z1);
        const c = alongX ? g.x : g.z, h = g.w / 2;
        if (c + h <= a || c - h >= b) return [p];
        const res: Run[] = [];
        if (c - h - a > 0.05) res.push(alongX ? { x0: a, z0: p.z0, x1: c - h, z1: p.z0, edge: p.edge } : { x0: p.x0, z0: a, x1: p.x0, z1: c - h, edge: p.edge });
        if (b - (c + h) > 0.05) res.push(alongX ? { x0: c + h, z0: p.z0, x1: b, z1: p.z0, edge: p.edge } : { x0: p.x0, z0: c + h, x1: p.x0, z1: b, edge: p.edge });
        return res;
      });
    }
    out.push(...parts);
  }
  return out;
}

export interface Wall extends Run { h: number; thick: number; cap?: boolean }
/** Dry-stone walls. The grid's `#` wall (col 7) is 1.0 m: a 1.16 m jump clears it. */
export const WALLS: Wall[] = [
  { x0: -37.5, z0: -20, x1: -37.5, z1: 110, h: 1.0, thick: 0.6 },
  // Graveyard: low wall with an opening east toward the church yard.
  { x0: -20, z0: 26.5, x1: -0.5, z1: 26.5, h: 1.0, thick: 0.5 }, { x0: -20, z0: 26.5, x1: -20, z1: 35, h: 1.0, thick: 0.5 },
  { x0: -20, z0: 35, x1: -2.5, z1: 35, h: 1.0, thick: 0.5 },
  // Maryam's retaining wall (stream side) is part of the yard: built with the yard.
];

// ---------- Paths and surfaces ----------
export interface Path { pts: [number, number][]; w: number; kind: 'road' | 'path' | 'lane' | 'trail' }
export const SQUARE: Rect = { x0: -9.5, x1: 50, z0: 35.5, z1: 60 };
export const PATHS: Path[] = [
  { kind: 'road', w: 5, pts: [[37.5, 58], [37.5, 70], [37.6, 90], [37.4, 118]] },                       // valley road
  { kind: 'path', w: 2.2, pts: [[47.5, -14], [47.5, 17.5], [47.5, 24], [47.2, 36]] },                    // footpath col 24
  { kind: 'path', w: 2.0, pts: [[49, 37.5], [62, 37.5], [77.5, 37.5], [77.5, 23]] },                     // to Maryam's gate
  { kind: 'lane', w: 2.6, pts: [[-36, 23.4], [-28, 23.6], [0, 23.6], [22, 23.6], [36, 23.8], [47.5, 23.5]] }, // row-8 lane
  { kind: 'path', w: 2.0, pts: [[27.2, 24.2], [27.2, 30.5], [27.0, 35.8]] },                             // church east yard to the square
  { kind: 'trail', w: 1.6, pts: [[107.8, 12.5], [112, 12.4], [118, 12.6], [126, 12.5], [140, 3], [160, -14]] }, // herd trail
];

// ---------- Stream crossing [8] ----------
/** 7 stepping stones across 5 m of water at row 6, centres 0.6 m apart. */
export const STONES = (() => {
  const z = 12.5, c = streamX(z), w = waterY(z);
  return Array.from({ length: 7 }, (_, i) => ({ x: c - 1.8 + i * 0.6, z: z + [0.04, -0.06, 0.05, -0.03, 0.06, -0.05, 0.02][i], top: w + [0.2, 0.25, 0.18, 0.24, 0.2, 0.26, 0.21][i], sx: 0.5, sz: 0.8 }));
})();
/** The 6 stone steps down the retaining wall at the back gate, east toward the stream. */
export const BACK_STEPS = Array.from({ length: 6 }, (_, i) => ({ x0: 92.75 + i * 0.42, x1: 92.75 + (i + 1) * 0.42, z0: 6.4, z1: 8.6, top: MARYAM_YARD.y - (i + 1) * 0.2 }));

// ---------- Props ----------
export const FOUNTAIN = { x: 22.5, z: 47.5, r: 1.7, h: 0.62 };                 // [4]
export const BENCH = { x: 22.5, z: 51.6, len: 1.8, yaw: 0 };
export const TRANSFORMER = { x: 41.6, z: 61.4 };                                // [9], street lamp hangs on it
export const POLES_10KV: [number, number][] = [[41.4, 75], [41.5, 90], [41.3, 105], [41.4, 120], [41.6, 136]];
export const POLE_SQUARE = { x: 0.2, z: 38.4 };                                 // the slice's farm line ends here
export const POLICE_CAR = { x: -7.2, z: 44.2, yaw: 0.12 };
export const GRAVES = (() => {
  const g: { x: number; z: number; kind: 'cross' | 'stone' }[] = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) g.push({ x: -17.6 + i * 2.6 + (r % 2) * 0.5, z: 28.6 + r * 2.3, kind: (r + i) % 3 === 0 ? 'cross' : 'stone' });
  return g;
})();

// ---------- Trees ----------
/** Olive trees in rows on the terraces (cols 0-6, rows 8-25); pines on the NW slope, the NE corner and the east edge. */
export const OLIVES = (() => {
  const t: { x: number; z: number; s: number }[] = [];
  for (let k = 0; k < 5; k++) for (let z = 24; z < 108; z += 6.2) {
    const x = TERRACE.x0 - 3.6 - k * TERRACE.step + ((z * 7) % 3 - 1.5) * 0.35;
    if (x < -73.5) continue;
    t.push({ x, z: z + (k % 2) * 3.1, s: 0.8 + ((k * 13 + z) % 7) / 18 });
  }
  return t;
})();
export const PINE_AREAS: (Rect & { n: number })[] = [
  { x0: -74, x1: -41, z0: -19, z1: 18, n: 38 },      // NW slope (cols 0-6, rows 0-7)
  { x0: 113, x1: 124, z0: -19, z1: 6, n: 9 },        // NE corner
  { x0: 117, x1: 124.5, z0: 19, z1: 108, n: 16 },    // east edge (col 39)
];

// ---------- Scatter rules (grass, stray trees) ----------
const PATH_SEGS = PATHS.flatMap(p => p.pts.slice(1).map((b, i) => {
  const a = p.pts[i], m = p.w / 2 + 2;
  return { a, b, w: p.w, kind: p.kind, x0: Math.min(a[0], b[0]) - m, x1: Math.max(a[0], b[0]) + m, z0: Math.min(a[1], b[1]) - m, z1: Math.max(a[1], b[1]) + m };
}));
/** Distance from (x, z) to the edge of the nearest path (negative on the path); exact below 2 m, else >= 2. */
export function pathDist(x: number, z: number, kind?: Path['kind']): number {
  let d = Infinity;
  for (const s of PATH_SEGS) {
    if ((kind && s.kind !== kind) || x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const [ax, az] = s.a, [bx, bz] = s.b, vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t) - s.w / 2);
  }
  return d;
}
const inRect = (x: number, z: number, r: Rect, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
export const CHURCH_YARDS: Rect[] = [{ x0: 0, x1: 5, z0: 30, z1: 35.5 }, { x0: 24, x1: 30.5, z0: 26, z1: 35.5 }];
/** True where grass tufts and trees must not stand: buildings, cobbles, paths, the water, Maryam's yard. */
export function townBlocked(x: number, z: number): boolean {
  if (BUILDINGS.some(b => inRect(x, z, b, 0.4))) return true;
  if (inRect(x, z, SQUARE) || CHURCH_YARDS.some(r => inRect(x, z, r))) return true;
  if (pathDist(x, z) < 0.3) return true;
  if (Math.abs(x - streamX(z)) < streamHalf(z) + 0.3) return true;
  return inRect(x, z, MARYAM_YARD, 0.2);
}
/** The slice's pine ring: keep only trees outside the village or in its pine woods (cols 0-6, rows 0-7). */
export function slicePineKept(x: number, z: number): boolean {
  const inMap = x > MAP.x0 - 2 && x < MAP.x1 + 2 && z > MAP.z0 - 2 && z < MAP.z1 + 2;
  if (!inMap) return !(x > 20 && x < 140 && z > -60 && z < -20) && Math.abs(x - streamX(z)) > 10;
  return x < -42 && z < 19 && !townBlocked(x, z);
}
const mulberry = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** Pines of the village woods (deterministic): NW slope, NE corner, east edge. Height in metres. */
export const TOWN_PINES = (() => {
  const r = mulberry(4242), out: { x: number; z: number; h: number }[] = [];
  for (const A of PINE_AREAS) {
    let placed = 0;
    for (let q = 0; q < A.n * 8 && placed < A.n; q++) {
      const x = A.x0 + (A.x1 - A.x0) * r(), z = A.z0 + (A.z1 - A.z0) * r(), h = 9 + 6 * r();
      if (townBlocked(x, z) || (Math.abs(z - 12.5) < 4.5 && x > 108) || out.some(p => Math.hypot(p.x - x, p.z - z) < 2.6)) continue;
      out.push({ x, z, h }); placed++;
    }
  }
  return out;
})();

// ---------- Zones ----------
/** End of the playable area on the herd trail, 15 m past the stones: the road to the mountain and the cave mouth. */
export const TRAIL_END: Rect = { x0: 120.5, x1: 124.6, z0: 10.6, z1: 14.4 };
/** Down the valley road at the south edge: Lorenzo turns round. */
export const ROAD_SOUTH: Rect = { x0: 34, x1: 41, z0: 106.5, z1: 110 };

/** Deviations from village.md, each with its reason (listed in the report and checked by the conformance test). */
export const DEVIATIONS = [
  'barn corner (approved slice) keeps its own farmhouse, trough, kennel, H1/H2/H3 and fences; grid row 7 fence west of x=22 left out (it would cross the opening shot)',
  'slice pasture, north wall and gap stay north of grid row 0 (the north path to the ford)',
  'elevation: west edge +2.1 m, core 0, stream -8.3 m (village.md: 920 -> 870 m): Noor\'s 4-degree sun must clear the WSW ground from the core',
  'buildings sit 0.5-1 m inside their cells; church tower door and nave door face the square',
];
