// Chapter 1 slice "Arrival" (الوصول): the farmer's empty barn at the north edge of the village, Day 1 at dusk,
// now inside the full village blockout (src/villageMap.ts: the village.md grid, terrain, buildings, gates).
// Player is Lorenzo (لورينزو), first person, no combat: walk, look, E to examine or use, follow the hoofprints.
// Pure data + logic, no Three.js (src/villageScene.ts builds the visuals from these same numbers).
// Axes: x east, y up, z south. Yaw 0 looks at -Z (north); the mountain is NE. Ground top is y = 0.
// Sizes follow studio/world/regions/village.md: barn [1] 20 x 20 m, 22 stalls, 4 m doors; farmhouse [2] and
// trough [W] west of the barn; rail fences 1.2 m (not jumpable). Compass per studio/world/decisions-noor.md: mountain and cave NE (45 deg),
// sun setting WSW (240 deg). The hoofprints leave the barn and cross the pasture at 45 deg to the wall gap.
import { overlaps, type Box, type Vec3 } from './physics';
import {
  BUILDINGS, GATES, WALLS, STONES, BACK_STEPS, MARYAM_YARD, FOUNTAIN, BENCH, TRANSFORMER, POLES_10KV, POLE_SQUARE, POLICE_CAR,
  GRAVES, OLIVES, TOWN_PINES, TRAIL_END, ROAD_SOUTH, groundY, groundRange, fenceRuns, streamX, streamHalf, waterY, slicePineKept,
  type Building, type DoorSpec, type Face, type Rect,
} from './villageMap';
export { groundY } from './villageMap';

export interface Text { ar: string; en: string }
export interface Solid { box: Box; tag?: 'invisible' }
export interface Examinable {
  id: string;
  name: Text;
  line: Text;
  pos: Vec3;      // look target (centre of the pick sphere)
  r: number;      // pick sphere radius
  from: Vec3;     // a standing spot it can be examined from (tests use it)
}
export interface Zone { id: string; box: Box }
export type Surface = 'dirt' | 'wood' | 'straw' | 'stone';

const deg = Math.PI / 180;
/** Unit xz direction for a compass bearing (0 = north = -Z, 90 = east = +X). */
export const bearingDir = (b: number) => ({ x: Math.sin(b * deg), z: -Math.cos(b * deg) });

// ---------- Layout (shared with villageScene.ts) ----------
export const BARN = {
  x0: -10, x1: 10, z0: -10, z1: 10, wall: 0.5, plinth: 0.9, eave: 5.2, ridge: 9.4, overhang: 0.6,
  door: { x0: -2, x1: 2, h: 4.2, leaf: 2.0 },          // north doors, two leaves swung out 90 degrees
  back: { x0: -0.65, x1: 0.65, h: 2.2 },               // south man-door (from the farm track)
};
/** 11 tie stalls per side, facing the outer walls. Mangers on the manger line, feed alleys behind them. */
export const STALLS = { perSide: 11, z0: -8.25, w: 1.5, aisle: 2, partitionFrom: 3.0, manger: 5.4, mangerBack: 6.0 };
export const POSTS_Z = [-8, -4, 0, 4, 8];                // interior posts on x = +-6.15, under the tie beams
export const LOFT = { x0: -9.5, x1: -6.3, z0: -4, z1: 9.5, y: 3.0 };
export const FARMHOUSE = { x0: -25, x1: -15, z0: -5, z1: 5 };
export const HOUSES = [
  { x0: -24, x1: -16, z0: 12, z1: 19.5 },                // H1, south-west, at the village edge
  { x0: 25, x1: 32, z0: 15, z1: 22.5 },                  // H2, south-east, past the fence (keeps the NE view open)
];
export const TROUGH = { x0: -14, x1: -12, z0: 6.0, z1: 6.7, h: 0.7 };
export const KENNEL = { x0: -14.2, x1: -13.0, z0: -4.6, z1: -3.6, h: 1.0 };
export const SHRINE = { x: 22.55, z: -37.3, w: 0.5 };
/** Cross fence in front of the barn, then the lane: north, a dogleg east, north again to the wall gap. */
export const FENCE_Z = -13.5;
export const FENCES: [number, number, number, number][] = [   // x0, z0, x1, z1 (axis-aligned)
  [-28, FENCE_Z, -3, FENCE_Z], [3, FENCE_Z, 28, FENCE_Z],   // cross fence; the pasture opens at x in [-3, 3]
  [-14, -38.5, -14, FENCE_Z],  // pasture west
  [28, -38.5, 28, FENCE_Z],    // pasture east
  [-28, FENCE_Z, -28, 26.5],   // west boundary
  [22, FENCE_Z, 22, 26.5],     // east boundary
];
export const NORTH_WALL_Z = -38.5;                          // dry-stone wall; the gap is x in [22, 28]
export const GAP = { x0: 22, x1: 28 };
/** Leafless trees (trunk collision). */
export const TREES = [{ x: -20, z: -22, h: 8.5 }, { x: 18, z: -4, h: 7 }];
/** The slice's garden wall and farm-track stop closed the barn corner to the south. In the full village the
 *  churchyard stands there, so both are gone (the scene still draws their random numbers, see villageScene). */
export const SOUTH_WALL_Z = 27;
export const TRACK = { x0: -3, x1: 3 };
/** The slice's west and east boundary fences now stop where the farmyard opens onto the row-8 lane. */
const FENCE_END: Record<number, number> = { [-28]: 19.5, 22: 17.5 };
export const fencesNow = (): [number, number, number, number][] =>
  FENCES.map(([x0, z0, x1, z1]) => (x0 === x1 && FENCE_END[x0] !== undefined ? [x0, z0, x1, Math.min(z1, FENCE_END[x0])] : [x0, z0, x1, z1]));
/** H3: the cottage east of the barn (the slice's background house, in the opening shot), now walkable around. */
export const H3 = { x0: 24, x1: 31, z0: 6, z1: 13 };
/** The slice's pine ring (villageScene buildTrees), replayed on the same random sequence so trunks get collision:
 *  rng(77), two draws per try, one more in the thinning band, then the height and the 16 draws pine() makes. */
export const SLICE_PINES = (() => {
  const R = rng(77), out: { x: number; z: number; h: number }[] = [], d = 180 / Math.PI;
  let placed = 0;
  for (let k = 0; k < 600 && placed < 150; k++) {
    const a = R() * Math.PI * 2, dist = 34 + 86 * R();
    const x = Math.sin(a) * dist, z = -Math.cos(a) * dist - 5;
    const b = ((Math.atan2(x - 14, -(z + 27)) * d) + 360) % 360, northView = b > 0 && b < 95;
    const fromSpawn = ((Math.atan2(x - 4, -(z - 21.5)) * d) + 360) % 360;
    if (northView || (fromSpawn > 22 && fromSpawn < 68)) continue;
    if (x > -30 && x < 32 && z > -45 && z < 30) continue;
    if (x > -40 && x < 35 && z > 28 && z < 55 && R() < 0.7) continue;
    const h = (9 + 8 * R()) * (northView ? 0.7 : 1);
    for (let i = 0; i < 16; i++) R();
    out.push({ x, z, h }); placed++;
  }
  return out;
})();

/** Late dusk (16:41, sunset 16:50): the sun sits 4 deg above the WSW hills and lights the mountain face across the
 *  valley. Long shadows point ENE, the way the hoofprints go. */
export const SUN = { bearing: 240, elevation: 4 };
export const MOUNTAIN = { bearing: 45, caveBearing: 45 };

/** Opening shot: the barn on the left, the sunlit mountain over the pasture on the right. */
export const SPAWN: Vec3 = { x: 4, y: 0.01, z: 21.5 };
export const SPAWN_YAW = -22 * Math.PI / 180;

// ---------- Collision ----------
export function villageSolids(): Solid[] {
  const s: Solid[] = [];
  const add = (x0: number, z0: number, x1: number, z1: number, h: number, y = 0, tag?: 'invisible') =>
    s.push({ box: { min: { x: Math.min(x0, x1), y, z: Math.min(z0, z1) }, max: { x: Math.max(x0, x1), y: y + h, z: Math.max(z0, z1) } }, tag });
  // No ground box: the terrain sampler (groundY, flat y = 0 across the barn corner) is the ground everywhere.

  // Barn shell (plinth + boards are one solid per wall run), doorways left open.
  const B = BARN, t = B.wall, H = 6;
  add(B.x0, B.z0, B.door.x0, B.z0 + t, H);
  add(B.door.x1, B.z0, B.x1, B.z0 + t, H);
  add(B.x0, B.z1 - t, B.back.x0, B.z1, H);
  add(B.back.x1, B.z1 - t, B.x1, B.z1, H);
  add(B.x0, B.z0, B.x0 + t, B.z1, H);
  add(B.x1 - t, B.z0, B.x1, B.z1, H);
  // Door leaves swung out 90 degrees (they frame the lane), and the man-door leaf swung out.
  add(B.door.x0 - 0.1, B.z0 - B.door.leaf, B.door.x0, B.z0, B.door.h);
  add(B.door.x1, B.z0 - B.door.leaf, B.door.x1 + 0.1, B.z0, B.door.h);
  add(B.back.x1 - 0.03, B.z1, B.back.x1 + 0.1, B.z1 + 1.2, B.back.h);

  // Stalls: partitions (x 3.0..5.4), mangers (5.4..6.0), interior posts.
  const S = STALLS;
  for (const side of [-1, 1]) {
    for (let i = 0; i <= S.perSide; i++) {
      const z = S.z0 + i * S.w;
      add(side * S.partitionFrom, z - 0.05, side * S.manger, z + 0.05, 1.3);
    }
    add(side * S.manger, S.z0 - 0.05, side * S.mangerBack, -S.z0 + 0.05, 1.1);
    for (const z of POSTS_Z) add(side * 6.03, z - 0.125, side * 6.28, z + 0.125, B.eave);
  }
  // West alley: hay bale stack under the loft. East alley: feed bin and sacks.
  add(-9.5, -2.0, -7.6, 9.5, 1.4);
  add(-6.75, -4.75, -6.35, -4.3, 3.1);                                   // loft ladder foot
  add(8.1, -9.5, 9.5, -8.4, 0.9);                                      // feed bin
  add(8.3, -7.9, 9.5, -6.6, 0.7);                                        // sacks

  // Farm buildings and yard props.
  for (const h of [FARMHOUSE, ...HOUSES, H3]) add(h.x0, h.z0, h.x1, h.z1, 7);
  add(TROUGH.x0, TROUGH.z0, TROUGH.x1, TROUGH.z1, TROUGH.h);
  add(KENNEL.x0, KENNEL.z0, KENNEL.x1, KENNEL.z1, KENNEL.h);
  add(SHRINE.x - SHRINE.w / 2, SHRINE.z - SHRINE.w / 2, SHRINE.x + SHRINE.w / 2, SHRINE.z + SHRINE.w / 2, 1.5);

  // Rail fences (1.3 m solid: the 1.16 m jump cannot clear them).
  for (const [x0, z0, x1, z1] of fencesNow()) add(x0 - 0.08, z0 - 0.08, x1 + 0.08, z1 + 0.08, 1.3);
  // North dry-stone wall with the gap, on past the pasture as the paddock's north side.
  add(-28, NORTH_WALL_Z - 0.3, GAP.x0, NORTH_WALL_Z + 0.3, 1.3);
  add(GAP.x1, NORTH_WALL_Z - 0.3, 62.6, NORTH_WALL_Z + 0.3, 1.3);
  for (const t of TREES) add(t.x - 0.25, t.z - 0.25, t.x + 0.25, t.z + 0.25, 3);
  // Invisible stops past the end trigger on the mountain path.
  add(GAP.x0, -44.5, GAP.x1, -44, 3, 0, 'invisible');
  add(GAP.x0 - 0.5, -44, GAP.x0, NORTH_WALL_Z, 3, 0, 'invisible');
  add(GAP.x1, -44, GAP.x1 + 0.5, NORTH_WALL_Z, 3, 0, 'invisible');
  townSolids(s);
  return s;
}

// ---------- Town collision (src/villageMap.ts) ----------
/** A box between two absolute heights. */
const yb = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number): Box =>
  ({ min: { x: Math.min(x0, x1), y: y0, z: Math.min(z0, z1) }, max: { x: Math.max(x0, x1), y: y1, z: Math.max(z0, z1) } });
/** A thin run (fence or wall) split into pieces of at most `seg` metres, each standing on the terrain under it. */
function runBoxes(out: Solid[], x0: number, z0: number, x1: number, z1: number, half: number, h: number, seg: number) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / seg));
  for (let i = 0; i < n; i++) {
    const ax = x0 + (x1 - x0) * i / n, az = z0 + (z1 - z0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n, bz = z0 + (z1 - z0) * (i + 1) / n;
    const r: Rect = { x0: Math.min(ax, bx) - half, x1: Math.max(ax, bx) + half, z0: Math.min(az, bz) - half, z1: Math.max(az, bz) + half };
    const [lo, hi] = groundRange(r);
    out.push({ box: yb(r.x0, r.z0, r.x1, r.z1, lo - 0.6, hi + h) });
  }
}
export const WALL_T = 0.45;   // shell thickness of the enterable buildings
/** Door opening in a wall, as a world rect slab of the given thickness. */
export function doorRect(b: Rect, d: DoorSpec, thick: number): Rect {
  const h = d.w / 2;
  if (d.face === 'n') return { x0: d.at - h, x1: d.at + h, z0: b.z0, z1: b.z0 + thick };
  if (d.face === 's') return { x0: d.at - h, x1: d.at + h, z0: b.z1 - thick, z1: b.z1 };
  if (d.face === 'w') return { x0: b.x0, x1: b.x0 + thick, z0: d.at - h, z1: d.at + h };
  return { x0: b.x1 - thick, x1: b.x1, z0: d.at - h, z1: d.at + h };
}
const FACE_OUT: Record<Face, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
/** Door sill on the wall line and the ground just outside it. */
export function doorStep(b: Building, d: DoorSpec): { x: number; z: number; ground: number; rise: number; out: [number, number] } {
  const o = FACE_OUT[d.face];
  const x = d.face === 'n' || d.face === 's' ? d.at : d.face === 'e' ? b.x1 : b.x0;
  const z = d.face === 'e' || d.face === 'w' ? d.at : d.face === 's' ? b.z1 : b.z0;
  const ground = groundY(x + o[0] * 1.2, z + o[1] * 1.2);
  return { x, z, ground, rise: b.floor - ground, out: o };
}
export interface Tread extends Rect { top: number }
/** Stone steps down from a door whose sill sits above the ground outside: one tread per <= 0.2 m, 0.36 m deep. */
export function doorSteps(b: Building, d: DoorSpec): Tread[] {
  const st = doorStep(b, d);
  if (st.rise < 0.12) return [];
  const n = Math.ceil(st.rise / 0.2) - 1, out: Tread[] = [], [ox, oz] = st.out, w = d.w / 2 + 0.35;
  for (let i = 0; i < n; i++) {
    const cx = st.x + ox * (0.2 + i * 0.36), cz = st.z + oz * (0.2 + i * 0.36);
    out.push({ x0: ox ? cx - 0.18 : cx - w, x1: ox ? cx + 0.18 : cx + w, z0: oz ? cz - 0.18 : cz - w, z1: oz ? cz + 0.18 : cz + w,
      top: b.floor - st.rise * (i + 1) / (n + 1) });
  }
  return out;
}

// ---------- Lit lamps (villageScene builds the fixtures and one point light per lamp) ----------
/** The two bracket lanterns hang on the barn's z = 0 posts, over the mangers. */
export const LANTERN_SIDE = { x: 5.6, y: 2.45, z: 0 };
export interface Lamp { x: number; y: number; z: number; intensity: number; range: number; street?: boolean }
/** [0] the barn's hanging lantern (rope from the z = -4 tie beam, ends at y = 3.0), [1-2] the bracket lanterns,
 *  [3] the street lamp's head on the transformer pole [9] (villageTown: arm to x - 1.35, z - 0.42, glass at +5.48). */
export const LAMPS: Lamp[] = [
  { x: 0, y: 2.7, z: -4, intensity: 5, range: 8 },
  { x: -LANTERN_SIDE.x, y: LANTERN_SIDE.y, z: LANTERN_SIDE.z, intensity: 3, range: 7 },
  { x: LANTERN_SIDE.x, y: LANTERN_SIDE.y, z: LANTERN_SIDE.z, intensity: 3, range: 7 },
  { x: TRANSFORMER.x - 1.35, y: groundY(TRANSFORMER.x, TRANSFORMER.z) + 5.3, z: TRANSFORMER.z - 0.42, intensity: 36, range: 12, street: true },
];

// ---------- Church interior (shared by the builder in villageTown.ts and the collision below) ----------
export interface ChurchPicture { name: string; x: number; y: number; zWall: number; nz: 1 | -1; w: number; h: number; gilt: boolean }
export interface ChurchLayout { cz: number; pews: Rect[]; columns: { x: number; z: number }[]; altar: Rect; pictures: ChurchPicture[] }
export const COLUMN_R = 0.3;
/** Church windows sit at x0 + len * (i + 0.5) / 4 on both long walls (villageTown windowsOf); the south door takes the
 *  west window's place. Pews stand either side of a 1.8 m aisle and face the altar at the east end; the engaged columns
 *  stand at the piers between the windows (none in front of the door); a framed picture hangs under each lower window:
 *  the three Joseph stills on the north wall, the two Michelangelo drawings (aspect kept) on the south wall. */
export function churchLayout(b: Building): ChurchLayout {
  const cz = (b.z0 + b.z1) / 2, zn = b.z0 + WALL_T, zs = b.z1 - WALL_T, door = b.doors[0];
  const win = (i: number) => b.x0 + (b.x1 - b.x0) * (i + 0.5) / 4;
  const pews: Rect[] = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const x = b.x0 + 3.2 + i * 1.7, za = cz + s * 0.9, zb = cz + s * 2.65;
    pews.push({ x0: x - 0.02, x1: x + 0.46, z0: Math.min(za, zb) - 0.04, z1: Math.max(za, zb) + 0.04 });
  }
  const columns: { x: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const x = (win(i) + win(i + 1)) / 2;
    columns.push({ x, z: zn + 0.65 });
    if (Math.abs(x - door.at) > door.w / 2 + 0.6) columns.push({ x, z: zs - 0.65 });
  }
  // Centre at eye level (floor + 1.65), lowered if the frame (7 cm) and the lamp above it (12 cm) would reach the window.
  const y = (h: number) => Math.min(b.floor + 1.65, b.floor + 2.4 - 0.23 - h / 2);
  const pictures: ChurchPicture[] = [
    ...['church_steps', 'great_hall', 'yard'].map((name, i) => ({ name, x: win(i), y: y(0.9), zWall: zn, nz: 1 as const, w: 1.6, h: 0.9, gilt: false })),
    { name: 'mary', x: win(1), y: y(0.96), zWall: zs, nz: -1, w: 1.2, h: 0.96, gilt: true },              // 768 x 615 source
    { name: 'crucifixion', x: win(2), y: y(1.1), zWall: zs, nz: -1, w: 1.1 * 2 / 3, h: 1.1, gilt: true }, // 512 x 768 source
  ];
  return { cz, pews, columns, altar: { x0: b.x1 - 2.6, x1: b.x1 - 1.6, z0: cz - 1.2, z1: cz + 1.2 }, pictures };
}

export function townSolids(s: Solid[]) {
  // Buildings: solid blocks; the enterable ones are shells with an interior floor and door gaps (doors fill them).
  for (const b of BUILDINGS) {
    const top = b.floor + b.eave + (b.kind === 'tower' ? 7 : 0.5);
    if (!b.hollow) s.push({ box: yb(b.x0, b.z0, b.x1, b.z1, b.base, top) });
    else {
      const t = WALL_T, gaps = b.doors.map(d => doorRect(b, d, t));
      const wall = (r: Rect) => {
        const alongX = r.x1 - r.x0 > r.z1 - r.z0;
        let pieces: Rect[] = [r];
        for (const g of gaps) pieces = pieces.flatMap(p => {
          if (g.x1 <= p.x0 || g.x0 >= p.x1 || g.z1 <= p.z0 || g.z0 >= p.z1) return [p];
          return (alongX ? [{ ...p, x1: g.x0 }, { ...p, x0: g.x1 }] : [{ ...p, z1: g.z0 }, { ...p, z0: g.z1 }])
            .filter(q => q.x1 - q.x0 > 0.02 && q.z1 - q.z0 > 0.02);
        });
        for (const p of pieces) s.push({ box: yb(p.x0, p.z0, p.x1, p.z1, b.base, top) });
      };
      wall({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + t }); wall({ x0: b.x0, x1: b.x1, z0: b.z1 - t, z1: b.z1 });
      wall({ x0: b.x0, x1: b.x0 + t, z0: b.z0 + t, z1: b.z1 - t }); wall({ x0: b.x1 - t, x1: b.x1, z0: b.z0 + t, z1: b.z1 - t });
      s.push({ box: yb(b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, b.base, b.floor) });                 // interior floor
      s.push({ box: yb(b.x0, b.z0, b.x1, b.z1, b.floor + b.eave - 0.25, top + 0.5) });               // ceiling
      for (const g of gaps) s.push({ box: yb(g.x0, g.z0, g.x1, g.z1, b.base, b.floor) });            // sills
      if (b.kind === 'church') {   // pews, columns and the altar are solid
        const L = churchLayout(b);
        for (const p of L.pews) s.push({ box: yb(p.x0, p.z0, p.x1, p.z1, b.floor, b.floor + 1.0) });
        for (const c of L.columns) s.push({ box: yb(c.x - COLUMN_R, c.z - COLUMN_R, c.x + COLUMN_R, c.z + COLUMN_R, b.floor, b.floor + b.eave) });
        s.push({ box: yb(L.altar.x0 - 0.06, L.altar.z0 - 0.1, L.altar.x1 + 0.06, L.altar.z1 + 0.1, b.floor, b.floor + 1.08) });   // with cloth and frontal
      }
    }
    for (const d of b.doors) for (const st of doorSteps(b, d)) s.push({ box: yb(st.x0, st.z0, st.x1, st.z1, st.top - 1.5, st.top) });
  }
  // Tower base: the ladder up the north wall (climbing comes with Chapter 3).
  const T = BUILDINGS.find(b => b.id === 'tower')!;
  s.push({ box: yb(T.x0 + 1.7, T.z0 + WALL_T, T.x1 - 1.7, T.z0 + WALL_T + 0.3, T.floor, T.floor + 3.2) });
  // Fences (1.3 m: the 1.16 m jump cannot clear them) and dry-stone walls (1.0 m: it can).
  for (const r of fenceRuns()) runBoxes(s, r.x0, r.z0, r.x1, r.z1, 0.08, r.edge ? 3.0 : 1.3, 4);
  for (const w of WALLS) runBoxes(s, w.x0, w.z0, w.x1, w.z1, w.thick / 2, w.h, 1.5);
  // Maryam's yard: the retaining wall on the stream side (the fence stands on it) and the 6 steps at the back gate.
  const Y = MARYAM_YARD;
  s.push({ box: yb(Y.x1, Y.z0, Y.x1 + 0.3, 6.4, groundY(Y.x1 + 0.6, 4) - 0.6, Y.y) });
  s.push({ box: yb(Y.x1, 8.6, Y.x1 + 0.3, Y.z1, groundY(Y.x1 + 0.6, 15) - 0.6, Y.y) });
  for (const st of BACK_STEPS) s.push({ box: yb(st.x0, st.z0, st.x1, st.z1, st.top - 2, st.top) });
  for (const z of [6.2, 8.8]) s.push({ box: yb(Y.x1 + 0.25, z - 0.2, BACK_STEPS[5].x1, z + 0.2, groundY(95, z) - 0.6, Y.y + 0.15) });
  // Square: the fountain basin [4], the iron bench, the transformer pole [9], the line poles, the police car.
  s.push({ box: yb(FOUNTAIN.x - FOUNTAIN.r, FOUNTAIN.z - FOUNTAIN.r, FOUNTAIN.x + FOUNTAIN.r, FOUNTAIN.z + FOUNTAIN.r, -0.5, FOUNTAIN.h) });
  s.push({ box: yb(BENCH.x - BENCH.len / 2, BENCH.z - 0.25, BENCH.x + BENCH.len / 2, BENCH.z + 0.25, -0.5, 0.48) });
  for (const [x, z] of [[TRANSFORMER.x, TRANSFORMER.z], [POLE_SQUARE.x, POLE_SQUARE.z], ...POLES_10KV] as [number, number][]) {
    const g = groundY(x, z);
    s.push({ box: yb(x - 0.18, z - 0.18, x + 0.18, z + 0.18, g - 0.5, g + 8) });
  }
  {
    const c = POLICE_CAR, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), hl = 2.15, hw = 0.85;
    const ex = Math.abs(cs) * hw + Math.abs(sn) * hl, ez = Math.abs(sn) * hw + Math.abs(cs) * hl;
    s.push({ box: yb(c.x - ex, c.z - ez, c.x + ex, c.z + ez, -0.5, 1.45) });
  }
  for (const g of GRAVES) s.push({ box: yb(g.x - 0.3, g.z - 0.12, g.x + 0.3, g.z + 0.12, -0.5, g.kind === 'cross' ? 1.1 : 0.75) });
  for (const t of OLIVES) { const g = groundY(t.x, t.z); s.push({ box: yb(t.x - 0.22, t.z - 0.22, t.x + 0.22, t.z + 0.22, g - 0.5, g + 2.2) }); }
  for (const t of [...TOWN_PINES, ...SLICE_PINES.filter(p => p.x > -76 && p.x < 126 && p.z > -21 && p.z < 111 && slicePineKept(p.x, p.z))]) {
    const g = groundY(t.x, t.z), r = Math.max(0.2, t.h * 0.025);
    s.push({ box: yb(t.x - r, t.z - r, t.x + r, t.z + r, g - 0.5, g + t.h * 0.3) });
  }
  // Stream [8]: the water is closed except the 1.2 m corridor over the stepping stones; the stones carry the player.
  const CZ0 = 11.9, CZ1 = 13.1;
  for (let z = -24; z < 114; z += 2) {
    const z1 = z + 2;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 4; k++) { const zz = z + k / 2; lo = Math.min(lo, streamX(zz) - streamHalf(zz)); hi = Math.max(hi, streamX(zz) + streamHalf(zz)); }
    const w = waterY(z) - 1.2;
    const piece = (a: number, b: number) => { if (b - a > 0.01) s.push({ box: yb(lo + 0.15, a, hi - 0.15, b, w, w + 5), tag: 'invisible' }); };
    if (z1 <= CZ0 || z >= CZ1) piece(z, z1); else { piece(z, CZ0); piece(CZ1, z1); }
  }
  for (const st of STONES) s.push({ box: yb(st.x - st.sx / 2, st.z - st.sz / 2, st.x + st.sx / 2, st.z + st.sz / 2, st.top - 1.2, st.top) });
  // Map edges the fences leave open: the ravine north and south, past the trail end, down the valley road.
  s.push({ box: yb(96, -20.6, 113, -20.2, -12, 3), tag: 'invisible' });
  s.push({ box: yb(96, 110.2, 113, 110.6, -14, 3), tag: 'invisible' });
  s.push({ box: yb(125.1, 10, 125.6, 15, -8, 3), tag: 'invisible' });
  s.push({ box: yb(33.5, 110.6, 41.5, 111, -3, 3), tag: 'invisible' });
}

// ---------- Usable gates and doors (E) ----------
export interface Usable {
  id: string;
  kind: 'gate' | 'door';
  name: Text;
  locked: boolean;
  pos: Vec3;          // pick centre
  r: number;          // pick sphere radius
  from: Vec3;         // a standing spot it can be used from (tests)
  hinge: { x: number; z: number };
  w: number;          // leaf width
  h: number;          // leaf height
  y: number;          // leaf bottom
  yaw0: number;       // closed leaf yaw: the leaf runs from the hinge along (cos yaw, -sin yaw) in xz
  swing: number;      // yaw added when fully open
  closed: Box;        // collision while closed
}
const NAMES: Record<string, Text> = {
  'door-church': { ar: 'باب الكنيسة', en: 'Church door' },
  'door-tower': { ar: 'باب البرج', en: 'Tower door' },
  'door-maryam': { ar: 'باب بيت مريم', en: "Maryam's door" },
};
const DOOR_NAME: Text = { ar: 'باب', en: 'Door' };
export const LOCKED_LINE: Text = { ar: 'مقفل.', en: 'Locked.' };

function makeUsables(): Usable[] {
  const out: Usable[] = [];
  for (const g of GATES) {
    const gy = groundY(g.x, g.z), h = g.w > 2 ? 1.25 : 1.1;
    const hinge = g.alongX ? { x: g.x - g.w / 2, z: g.z } : { x: g.x, z: g.z - g.w / 2 };
    // Stand on the side the gate is usually approached from: the lane side (south) for the farm and yard gates,
    // the field side for the pasture gate, the yard side for the back gate.
    const side = g.id === 'gate-farm-n' ? 1 : g.id === 'gate-back' ? -1 : 1;
    const from = g.alongX ? { x: g.x + 0.3, y: 0, z: g.z + side * 2.2 } : { x: g.x - 2.2, y: 0, z: g.z + 0.3 };
    from.y = groundY(from.x, from.z) + 0.01;
    const ends = g.alongX ? [groundY(g.x - g.w / 2, g.z), groundY(g.x + g.w / 2, g.z)] : [groundY(g.x, g.z - g.w / 2), groundY(g.x, g.z + g.w / 2)];
    const lo = Math.min(gy, ...ends), hi = Math.max(gy, ...ends);
    out.push({ id: g.id, kind: 'gate', name: g.name, locked: false, pos: { x: g.x, y: gy + 0.8, z: g.z }, r: Math.min(1.1, g.w / 2), from,
      hinge, w: g.w, h, y: gy, yaw0: g.alongX ? 0 : -Math.PI / 2, swing: g.swing,
      closed: g.alongX ? yb(g.x - g.w / 2, g.z - 0.1, g.x + g.w / 2, g.z + 0.1, lo - 0.5, hi + 1.3) : yb(g.x - 0.1, g.z - g.w / 2, g.x + 0.1, g.z + g.w / 2, lo - 0.5, hi + 1.3) });
  }
  for (const b of BUILDINGS) for (const d of b.doors) {
    const st = doorStep(b, d), [ox, oz] = st.out, steps = doorSteps(b, d);
    const reach = 1.4 + steps.length * 0.36;
    const from = { x: st.x + ox * reach, y: 0, z: st.z + oz * reach };
    from.y = groundY(from.x, from.z) + 0.01;
    const pos = { x: st.x + ox * 0.1, y: b.floor + Math.min(1.3, d.h * 0.55), z: st.z + oz * 0.1 };
    if (d.use === 'locked') {
      out.push({ id: `locked-${b.id}`, kind: 'door', name: DOOR_NAME, locked: true, pos, r: Math.min(0.75, d.w / 2 + 0.1), from,
        hinge: { x: st.x, z: st.z }, w: d.w, h: d.h, y: b.floor, yaw0: 0, swing: 0, closed: yb(0, -99, 0, 0, -99, -99) });
      continue;
    }
    // Leaf hinged on the left jamb seen from outside, swinging 100 degrees inward; closed, it fills the shell gap.
    const g = doorRect(b, d, WALL_T), mid = WALL_T / 2;
    const hinge = d.face === 's' ? { x: d.at - d.w / 2, z: b.z1 - mid } : d.face === 'n' ? { x: d.at + d.w / 2, z: b.z0 + mid }
      : d.face === 'e' ? { x: b.x1 - mid, z: d.at + d.w / 2 } : { x: b.x0 + mid, z: d.at - d.w / 2 };
    const yaw0 = d.face === 's' ? 0 : d.face === 'n' ? Math.PI : d.face === 'e' ? Math.PI / 2 : -Math.PI / 2;
    out.push({ id: d.id!, kind: 'door', name: NAMES[d.id!] ?? DOOR_NAME, locked: false, pos, r: Math.min(0.8, d.w / 2 + 0.05), from, hinge, w: d.w, h: d.h,
      y: b.floor, yaw0, swing: 1.75, closed: yb(g.x0, g.z0, g.x1, g.z1, b.floor - 0.4, b.floor + d.h) });
  }
  return out;
}
export const USABLES: Usable[] = makeUsables();

/** Collision of a leaf at `open` (0 closed .. 1 open): a thin box around the swung leaf. Writes into `out`. */
export function leafBox(u: Usable, open: number, out: Box): Box {
  const yaw = u.yaw0 + u.swing * open, dx = Math.cos(yaw) * u.w, dz = -Math.sin(yaw) * u.w;
  out.min.x = Math.min(u.hinge.x, u.hinge.x + dx) - 0.035; out.max.x = Math.max(u.hinge.x, u.hinge.x + dx) + 0.035;
  out.min.z = Math.min(u.hinge.z, u.hinge.z + dz) - 0.035; out.max.z = Math.max(u.hinge.z, u.hinge.z + dz) + 0.035;
  out.min.y = u.y - 0.4; out.max.y = u.y + u.h;
  return out;
}

/** Index of the usable the player is looking at (same picking rules as examinables), or -1. */
export function pickUsable(eye: Vec3, dir: Vec3, solids: Solid[], range = EXAMINE_RANGE): number {
  return pickExaminable(eye, dir, USABLES as unknown as Examinable[], solids, range);
}

// ---------- Town zones ----------
/** The herd trail past the stepping stones: the road to the mountain and the cave mouth ends the playable area. */
export const TRAIL_END_ZONE: Zone = { id: 'end', box: yb(TRAIL_END.x0, TRAIL_END.z0, TRAIL_END.x1, TRAIL_END.z1, -12, 3) };

/** Reaching the mountain path ends the slice. */
export const END_ZONE: Zone = { id: 'end', box: { min: { x: GAP.x0, y: 0, z: -41.5 }, max: { x: GAP.x1, y: 3, z: NORTH_WALL_Z - 0.2 } } };
/** Walking back down the valley road at the south edge: Lorenzo turns himself round (repeatable). */
export const TURNBACK_ZONE: Zone = {
  id: 'turnback', box: { min: { x: ROAD_SOUTH.x0, y: -6, z: ROAD_SOUTH.z0 }, max: { x: ROAD_SOUTH.x1, y: 3, z: ROAD_SOUTH.z1 } },
};

// ---------- Lines (Lorenzo, talking to his camera) ----------
export const LINES: Record<'intro' | 'turnback' | 'end' | 'title' | 'chapter', Text> = {
  intro: {
    ar: 'اليوم الأول. جئتُ أبحث عن رجلٍ مفقود… والجميع هنا يريدون أن يحدّثوني عن أبقارٍ مفقودة.',
    en: 'Day one. I came looking for a missing man… and everyone here wants to tell me about missing cows.',
  },
  turnback: {
    ar: 'الطريق ينزل إلى الوادي… لم أنتهِ هنا بعد.',
    en: "The road goes back down the valley… I'm not done here yet.",
  },
  end: {
    ar: 'إلى هناك ذهبت كلّها. إن لم أصوّره… فكأنه لم يحدث.',
    en: "That's where they all went. If I don't film it… it never happened.",
  },
  title: { ar: 'وادي أوميغا', en: 'OMEGA VALLEY' },
  chapter: { ar: 'الفصل الأول — الوصول', en: 'Chapter 1 — Arrival' },
};

const ex = (id: string, name: Text, line: Text, pos: Vec3, r: number, from: Vec3): Examinable => ({ id, name, line, pos, r, from });
const S0 = STALLS.z0, SW = STALLS.w;
const stallZ = (i: number) => S0 + (i + 0.5) * SW;   // centre of stall i (0 = north end)

export const EXAMINABLES: Examinable[] = [
  ex('bar', { ar: 'عارضة الباب', en: 'Door bar' }, {
    ar: 'العارضة مرفوعة ومسنودة إلى الجدار. لم تُكسر… رُفعت. مَن فتح هذا الباب لم يكن مستعجلاً.',
    en: "The bar's been lifted off and leaned on the wall. Not snapped — lifted. Whoever opened this wasn't in a hurry.",
  }, { x: 2.75, y: 1.1, z: -9.3 }, 0.45, { x: 1.2, y: 0.01, z: -8.4 }),
  ex('chalk', { ar: 'كتابة بالطباشير', en: 'Chalk on the door' }, {
    ar: '«الغربان». وسهم يشير جنوباً، نحو القرية. لكن كل أثر هنا يذهب في الاتجاه المعاكس.',
    en: "'The Ravens.' And an arrow pointing south, back to the village. Every print out here goes the other way.",
  }, { x: -2.13, y: 1.65, z: -11.0 }, 0.5, { x: -3.6, y: 0.01, z: -11.0 }),
  ex('prints', { ar: 'آثار الحوافر', en: 'Hoofprints' }, {
    ar: 'آثار حوافر. عشرات الحيوانات في خطٍّ واحد، كأنها تمشي على حبل. كلّها متّجهة نحو الجبل.',
    en: 'Hoofprints. Dozens of animals in one line, like they were walking a rope. All of them heading for the mountain.',
  }, { x: 0.15, y: 0.02, z: -12.6 }, 0.7, { x: 0.3, y: 0.01, z: -10.9 }),
  ex('halter', { ar: 'الرَّسَن', en: 'Rope halter' }, {
    ar: 'ما زال مشدوداً بالإبزيم ومربوطاً بالحلقة. لم ينقطع… إنه فارغ فقط. كأنها انسلّت منه.',
    en: "Still buckled. Still tied to the ring. It didn't snap — it's just empty. Like she slipped out of it.",
  }, { x: 5.2, y: 0.62, z: stallZ(3) }, 0.38, { x: 3.4, y: 0.01, z: stallZ(3) }),
  ex('feed', { ar: 'المعلف', en: 'Manger' }, {
    ar: 'ممتلئ. تبنٌ طازج، لم تنقص منه لقمة. الحيوان الجائع لا يترك طعامه.',
    en: "Full. Fresh hay, not a mouthful gone. Hungry animals don't walk away from food.",
  }, { x: -5.7, y: 0.85, z: stallZ(6) }, 0.5, { x: -3.9, y: 0.01, z: stallZ(6) }),
  ex('straw', { ar: 'فرشة القش', en: 'Straw bedding' }, {
    ar: 'ما زال شكلها مطبوعاً في القش. هنا كانت نائمة… ثم نهضت، ولم تعد.',
    en: 'You can still see her shape in the straw. She was lying right here… then she got up, and never came back.',
  }, { x: -4.0, y: 0.08, z: stallZ(4) }, 0.6, { x: -1.4, y: 0.01, z: stallZ(4) }),
  ex('tally', { ar: 'لوح العدّ', en: 'Tally board' }, {
    ar: 'اثنان وعشرون رأساً، بالطباشير على العمود. واثنتان وعشرون حظيرة فارغة. لم يجد في قلبه ما يكفي ليمسحها.',
    en: "Twenty-two head, chalked on the post. Twenty-two empty stalls. He hasn't had the heart to rub it out.",
  }, { x: 2.87, y: 1.5, z: S0 }, 0.3, { x: 1.2, y: 0.01, z: S0 }),
  ex('trough', { ar: 'الحوض الحجري', en: 'Stone trough' }, {
    ar: 'جافّ تماماً. إمّا أنّ أحداً لم يملأه منذ أيام… أو أنها شربته كلّه قبل أن ترحل.',
    en: "Bone dry. Either nobody's filled it in days… or they drank it empty before they left.",
  }, { x: -13, y: 0.6, z: 6.35 }, 0.7, { x: -13, y: 0.01, z: 8.0 }),
  ex('dog', { ar: 'سلسلة الكلب', en: 'Dog chain' }, {
    ar: 'الطوق ما زال مقفلاً، ومشبوكاً بالسلسلة. حتى الكلب ذهب.',
    en: "The collar's still buckled. Still clipped to the chain. Even the dog went.",
  }, { x: -12.35, y: 0.06, z: -2.3 }, 0.45, { x: -11.4, y: 0.01, z: -1.2 }),
  ex('tv', { ar: 'نافذة بيت المزرعة', en: 'Farmhouse window' }, {
    ar: 'تلفاز بالأبيض والأسود يعمل في الداخل. المزارع ما زال يبحث في الخارج، وزوجته تُبقي الضوء مضاءً له.',
    en: "A black-and-white TV's on in there. The farmer's still out searching. His wife keeps the light on for him.",
  }, { x: -14.92, y: 1.55, z: -2.0 }, 0.55, { x: -13.4, y: 0.01, z: -1.3 }),
  ex('fence', { ar: 'السياج', en: 'Rail fence' }, {
    ar: 'ولا عارضة واحدة في غير مكانها. لم تهرب عنوةً… خرجت تمشي، في صفٍّ واحد، مباشرةً نحو الجبل.',
    en: "Not one rail out of place. They didn't break out. They walked out — single file, straight for the mountain.",
  }, { x: 5.6, y: 0.8, z: -13.5 }, 0.6, { x: 5.6, y: 0.01, z: -15.2 }),
  ex('shrine', { ar: 'مزار على الطريق', en: 'Roadside shrine' }, {
    ar: 'أحدهم أشعل شمعة هنا اليوم. هنا، على طريق الجبل… لا في الكنيسة.',
    en: 'Somebody lit a candle here today. Out here, on the mountain path — not down in the church.',
  }, { x: SHRINE.x + 0.14, y: 1.25, z: SHRINE.z }, 0.33, { x: 24.0, y: 0.01, z: -36.4 }),
];

// ---------- Hoofprint trail ----------
/** Control points: from the back stalls up the aisle, out of the north door, up the lane, through the wall gap, toward the mountain. */
export const TRAIL_CTRL: [number, number][] = [
  [0.3, 8.6], [0.5, 2.0], [0.4, -5.5], [0.1, -9.0], [0.3, -12.5], [1.2, -14.8], [3.0, -16.6], [8.2, -21.7], [13.9, -27.5], [19.6, -33.1],
  [25.0, -38.6], [30.5, -44.0], [40.0, -53.6], [52.0, -65.6],
];

/** Centripetal-free uniform Catmull-Rom through TRAIL_CTRL, resampled every `step` metres (arc length). */
export function trailPoints(step = 0.25): { x: number; z: number }[] {
  const P = TRAIL_CTRL, dense: { x: number; z: number }[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  dense.push({ x: P[P.length - 1][0], z: P[P.length - 1][1] });
  const out = [dense[0]];
  let acc = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    acc += d;
    while (acc >= step) {
      acc -= step;
      const u = 1 - acc / d;
      out.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u });
    }
  }
  return out;
}

// ---------- Footstep surface ----------
export function surfaceAt(x: number, z: number): Surface {
  if (x > BARN.x0 + 0.2 && x < BARN.x1 - 0.2 && z > BARN.z0 + 0.2 && z < BARN.z1 - 0.2) {
    const ax = Math.abs(x);
    if (ax > STALLS.aisle && ax < STALLS.manger && Math.abs(z) < -STALLS.z0) return 'straw';
    if (x < -7.4 && z > -2.5) return 'straw';                           // loose hay under the loft
    return 'wood';
  }
  if (x > -15 && x < -10.2 && z > -6.5 && z < 9.5) return 'stone';      // flagstones in the farmyard
  return 'dirt';
}

// ---------- Examine (pure picking with line of sight) ----------
export const EXAMINE_RANGE = 3.0;

/** Ray/AABB slab test. Returns entry distance along d, or Infinity. */
export function rayBox(o: Vec3, d: Vec3, b: Box): number {
  let t0 = 0, t1 = Infinity;
  for (const a of ['x', 'y', 'z'] as const) {
    const inv = 1 / d[a];
    let tn = (b.min[a] - o[a]) * inv, tf = (b.max[a] - o[a]) * inv;
    if (tn > tf) { const k = tn; tn = tf; tf = k; }
    if (tn > t0) t0 = tn;
    if (tf < t1) t1 = tf;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

const inside = (p: Vec3, b: Box) => p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z;

/** Index of the examinable the player is looking at (nearest sphere hit within range, not behind a solid), or -1.
 *  No allocation: safe to call every frame. */
export function pickExaminable(eye: Vec3, dir: Vec3, list: Examinable[], solids: Solid[], range = EXAMINE_RANGE): number {
  let best = -1, bestT = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const vx = e.pos.x - eye.x, vy = e.pos.y - eye.y, vz = e.pos.z - eye.z;
    const along = vx * dir.x + vy * dir.y + vz * dir.z;
    if (along <= 0) continue;
    const perp2 = vx * vx + vy * vy + vz * vz - along * along;
    if (perp2 > e.r * e.r) continue;
    const tHit = along - Math.sqrt(e.r * e.r - perp2);
    if (tHit > range || tHit >= bestT) continue;
    let blocked = false;
    for (const s of solids) {
      if (inside(e.pos, s.box) || inside(eye, s.box)) continue;
      if (rayBox(eye, dir, s.box) < tHit - 0.02) { blocked = true; break; }
    }
    if (!blocked) { best = i; bestT = tHit; }
  }
  return best;
}

// ---------- Slice state ----------
export interface VillageState { examined: string[]; finished: boolean }
export const newVillageState = (): VillageState => ({ examined: [], finished: false });

/** Marks an examinable seen. Returns true the first time. */
export function markExamined(s: VillageState, id: string): boolean {
  if (s.examined.includes(id)) return false;
  s.examined.push(id);
  return true;
}

/** Zone events for a player box: 'end' once (sets finished), 'turnback' whenever inside. Pass `out` to reuse an array. */
export function zoneEvents(s: VillageState, player: Box, out: ('end' | 'turnback')[] = []): ('end' | 'turnback')[] {
  out.length = 0;
  if (!s.finished && (overlaps(player, END_ZONE.box) || overlaps(player, TRAIL_END_ZONE.box))) { s.finished = true; out.push('end'); }
  if (overlaps(player, TURNBACK_ZONE.box)) out.push('turnback');
  return out;
}

/** Deterministic PRNG (mulberry32) so the procedural set dressing is identical every run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
