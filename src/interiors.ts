// Furnished interiors (build step 2, from Aktham's studio/art/furniture-manifest.md): Maryam's kitchen [7], the police
// post in the old school [6], the café [5], and the eight smaller village homes. Pure data, no Three.js: where each CC0 model of public/models stands
// (bottom centre on the floor, or `y` above it; yaw is three's rotation.y and the model's front is +Z, so 0 faces south,
// pi/2 east, pi north, -pi/2 west), which pieces are solid, and the lamps that light each room in the bake.
// src/furniture.ts draws them; village.ts makes the solid ones collide; villageTown.ts bakes the lamps.
import { BUILDINGS, type Rect } from './villageMap';

/** Footprints from the manifest: w (x), d (z), h, metres, front +Z. */
export const MODELS = {
  table_kitchen_long: [2.406, 1.137, 0.959],
  table_plain: [1.134, 0.706, 0.8],
  chair_wood_a: [0.432, 0.54, 0.956],
  chair_wood_b: [0.639, 0.662, 1.264],
  daybed: [1.973, 0.855, 1.127],
  cupboard: [1.195, 0.617, 1.182],
  shelf_small: [0.511, 0.367, 1.125],
  shelf_tall_worn: [1.374, 0.581, 2.063],
  stove_barrel: [0.593, 0.59, 0.857],
  chest_wood: [0.949, 0.527, 0.624],
  bench_church: [1.165, 0.497, 0.889],
  crate_small: [0.821, 0.408, 0.348],
  bucket_wood: [0.367, 0.341, 0.552],
  basket_wicker: [0.347, 0.255, 0.201],
  jug: [0.276, 0.168, 0.211],
  bowl_wood: [0.313, 0.31, 0.094],
  cutting_board: [0.45, 0.247, 0.041],
  pot_brass: [0.301, 0.3, 0.291],
  jar_ceramic: [0.217, 0.222, 0.308],
  bar_counter: [3.767, 0.803, 1.05],
  cafe_table_round: [0.796, 0.796, 0.746],
  cafe_chair: [0.58, 0.602, 1.034],
  cafe_barstool: [0.49, 0.491, 0.752],
  barrel_wine: [0.742, 0.756, 0.872],
  clock_wall: [0.321, 0.047, 0.322],
  rug_rect: [2.512, 1.472, 0.016],
  nightstand: [0.505, 0.509, 0.616],
  wardrobe: [0.776, 0.562, 2.0],
  stool_wood: [0.385, 0.406, 0.579],
  rug_round: [1.472, 1.472, 0.016],
} as const satisfies Record<string, readonly [number, number, number]>;
export type Model = keyof typeof MODELS;
/** Pieces the player walks over or that sit on something (never solid). */
const LOOSE: ReadonlySet<Model> = new Set<Model>(['jug', 'bowl_wood', 'cutting_board', 'pot_brass', 'jar_ceramic', 'basket_wicker', 'clock_wall', 'rug_rect', 'rug_round']);

export interface Item { model: Model; x: number; z: number; yaw: number; /** Height above the floor (on a table, on a wall). */ y?: number }
/** A lamp: its glass at (x, floor + dy, z); `hang` draws a cord to the ceiling. Its baked pool: strength k, falloff r m. */
export interface Lamp { x: number; dy: number; z: number; hang: boolean; k?: number; r?: number }
/** `fill`: the room's even warm light in the bake (the lamps' bounce off walls and ceiling), besides the pools. */
export interface Interior { building: string; items: Item[]; lamps: Lamp[]; fill?: number }

const E = Math.PI / 2, W = -Math.PI / 2, N = Math.PI, S = 0;
/** Local depth starts at the existing doorway. The first 2 m and centre lane stay free for entry. */
function villageHome(id: string, variant: number): Interior {
  const b = BUILDINGS.find(v => v.id === id)!;
  const d = b.doors[0];
  const p = (u: number, v: number): Pick<Item, 'x' | 'z'> => d.face === 'w' ? { x: b.x0 + u, z: d.at + v }
    : d.face === 'e' ? { x: b.x1 - u, z: d.at + v }
      : d.face === 'n' ? { x: d.at + v, z: b.z0 + u } : { x: d.at + v, z: b.z1 - u };
  const place = (model: Model, u: number, v: number, yaw = S, y?: number): Item => ({ model, ...p(u, v), yaw, ...(y === undefined ? {} : { y }) });
  const far = Math.min(6.1, (d.face === 'w' || d.face === 'e' ? b.x1 - b.x0 : b.z1 - b.z0) - 1.5);
  const table = variant % 3 === 0 ? 'table_kitchen_long' : 'table_plain';
  const tableYaw = d.face === 'n' || d.face === 's' ? E : S;
  const items: Item[] = [
    place('rug_round', far - 1, -1.7),
    place(table, far - 1, -1.7, tableYaw),
    place('chair_wood_a', far - 2.15, -1.7, d.face === 'w' ? E : d.face === 'e' ? W : N),
    place('daybed', far - 0.3, 1.7, tableYaw),
    place('nightstand', far - 1.9, 2.8),
    place(variant % 2 ? 'wardrobe' : 'cupboard', far + 0.85, -2.8, tableYaw),
    place(variant % 2 ? 'stove_barrel' : 'chest_wood', 2.1, 2.6),
    place(variant % 2 ? 'shelf_small' : 'stool_wood', 2.2, -2.6),
    place('jug', far - 1, -1.7, S, table === 'table_plain' ? 0.8 : 0.959),
    place('basket_wicker', 3.3, 2.8),
  ];
  return { building: id, items, lamps: [{ ...p(4.4, 0), dy: 2.15, hang: true, k: 1.6, r: 3.3 }], fill: 0.22 };
}
export const INTERIORS: Interior[] = [
  {
    // Maryam's kitchen: the long table under the lamp she keeps lit, the cupboard on the west wall, a shelf by the window.
    // The stove (with its fire door) stays the town builder's. She stands inside the south door, facing the table.
    building: 'maryam',
    items: [
      { model: 'rug_rect', x: 74.4, z: 9.9, yaw: S },
      { model: 'table_kitchen_long', x: 74.4, z: 9.9, yaw: S },
      { model: 'chair_wood_a', x: 72.75, z: 9.9, yaw: E }, { model: 'chair_wood_a', x: 76.05, z: 9.9, yaw: W },
      { model: 'chair_wood_a', x: 73.8, z: 8.85, yaw: S },
      { model: 'jug', x: 74.0, z: 9.7, yaw: 0.4, y: 0.959 }, { model: 'bowl_wood', x: 74.85, z: 10.05, yaw: 0, y: 0.959 },
      { model: 'cutting_board', x: 75.2, z: 9.6, yaw: 0.2, y: 0.959 },
      { model: 'cupboard', x: 71.28, z: 9.3, yaw: E },
      { model: 'basket_wicker', x: 71.35, z: 10.75, yaw: 0.3 },
      { model: 'shelf_small', x: 73.0, z: 6.66, yaw: S },
      { model: 'bucket_wood', x: 77.95, z: 6.85, yaw: 0 },
    ],
    lamps: [{ x: 74.4, dy: 2.1, z: 9.9, hang: true, k: 1.9, r: 2.6 }],
    fill: 0.18,
  },
  {
    // The police post [6]: Moreno's table with the map (west of his spot, so he reads it with his back to the door),
    // his chair; Omar's chair stands in line with the door (his figure brings it). Files on the shelf, the stove, the
    // evidence chest, a bench to wait on.
    building: 'school',
    items: [
      { model: 'table_plain', x: -16.6, z: 45.0, yaw: E },
      { model: 'chair_wood_b', x: -17.45, z: 45.0, yaw: E },
      { model: 'shelf_tall_worn', x: -15.0, z: 41.26, yaw: S },
      { model: 'chest_wood', x: -12.7, z: 41.25, yaw: S },
      { model: 'crate_small', x: -12.75, z: 41.95, yaw: S },
      { model: 'stove_barrel', x: -18.6, z: 41.5, yaw: E },
      // Northern office bay: two desks and filing storage, clear of Moreno's conversation spot.
      { model: 'table_plain', x: -17.1, z: 39.1, yaw: E },
      { model: 'chair_wood_a', x: -18.1, z: 39.1, yaw: E },
      { model: 'table_plain', x: -12.7, z: 39.1, yaw: W },
      { model: 'chair_wood_b', x: -11.75, z: 39.1, yaw: W },
      { model: 'cupboard', x: -18.72, z: 49.6, yaw: E },
      { model: 'bench_church', x: -15.0, z: 53.78, yaw: N },
      { model: 'daybed', x: -12.55, z: 50.35, yaw: E }, // medical cot for the guarded check after Omar is brought in
      // The barred southern bay is a holding cell, visible from the public room.
      { model: 'daybed', x: -17.7, z: 56.85, yaw: N },
      { model: 'bucket_wood', x: -11.9, z: 57.4, yaw: 0 },
      { model: 'jar_ceramic', x: -16.85, z: 45.35, yaw: 0, y: 0.8 },
    ],
    lamps: [{ x: -15.0, dy: 2.1, z: 39.3, hang: true, k: 1.6, r: 3.0 }, { x: -16.6, dy: 2.0, z: 45.0, hang: true, k: 2.0, r: 3.0 }, { x: -14.2, dy: 2.1, z: 50.5, hang: true, k: 1.6, r: 3.0 }, { x: -15.0, dy: 2.1, z: 56.8, hang: true, k: 1.2, r: 2.5 }],
    fill: 0.3,
  },
  {
    // The café-shop [5]: the bar along the back (south) wall with the shelf behind it and stools in front; four round
    // tables with two chairs each, west and east of the door's line; wine barrels in the corner; the clock.
    building: 'cafe',
    items: [
      { model: 'bar_counter', x: 12.0, z: 67.75, yaw: N },
      { model: 'shelf_tall_worn', x: 12.0, z: 68.74, yaw: N },
      { model: 'cafe_barstool', x: 10.8, z: 66.85, yaw: 0 }, { model: 'cafe_barstool', x: 12.0, z: 66.85, yaw: 0.5 },
      { model: 'cafe_barstool', x: 13.2, z: 66.85, yaw: -0.3 },
      { model: 'jug', x: 11.1, z: 67.7, yaw: 0, y: 1.05 }, { model: 'pot_brass', x: 13.3, z: 67.75, yaw: 0, y: 1.05 },
      { model: 'cafe_table_round', x: 3.2, z: 63.6, yaw: 0 },
      { model: 'cafe_chair', x: 3.2, z: 62.75, yaw: S }, { model: 'cafe_chair', x: 3.2, z: 64.45, yaw: N },
      { model: 'cafe_table_round', x: 3.4, z: 67.0, yaw: 0 },
      { model: 'cafe_chair', x: 2.55, z: 67.0, yaw: E }, { model: 'cafe_chair', x: 4.25, z: 67.0, yaw: W },
      { model: 'cafe_table_round', x: 16.5, z: 63.6, yaw: 0 },
      { model: 'cafe_chair', x: 16.5, z: 62.75, yaw: S }, { model: 'cafe_chair', x: 16.5, z: 64.45, yaw: N },
      { model: 'cafe_table_round', x: 16.6, z: 67.0, yaw: 0 },
      { model: 'cafe_chair', x: 15.75, z: 67.0, yaw: E }, { model: 'cafe_chair', x: 17.45, z: 67.0, yaw: W },
      { model: 'barrel_wine', x: 1.45, z: 68.55, yaw: 0 }, { model: 'barrel_wine', x: 18.5, z: 68.5, yaw: 0.6 },
      { model: 'clock_wall', x: 7.0, z: 69.03, yaw: N, y: 2.0 },
    ],
    lamps: [{ x: 4.0, dy: 2.15, z: 65.2, hang: true, k: 2.2, r: 3.4 }, { x: 10.0, dy: 2.15, z: 64.6, hang: true, k: 2.2, r: 3.4 }, { x: 16.2, dy: 2.15, z: 65.2, hang: true, k: 2.2, r: 3.4 }],
    fill: 0.55,
  },
  ...(['priest', 'house-e1', 'house-sw1', 'house-se1', 'house-s1', 'house-s2', 'house-sw2', 'house-s3'] as const)
    .map((id, i) => villageHome(id, i)),
];

/** The building of an interior. */
export const interiorBuilding = (id: string) => BUILDINGS.find(b => b.id === id)!;

/** Floor rectangle an item covers (its footprint turned by yaw; quarter turns swap w and d). */
export function itemRect(it: Item): Rect {
  const [w, d] = MODELS[it.model], c = Math.abs(Math.cos(it.yaw)), s = Math.abs(Math.sin(it.yaw));
  const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  return { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz };
}
export const isSolid = (it: Item) => !LOOSE.has(it.model) && !it.y;

/** Collision boxes of the solid pieces: the turned footprint from the floor to the model's height. */
export function furnitureBoxes(): { building: string; model: Model; min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[] {
  const out: ReturnType<typeof furnitureBoxes> = [];
  for (const r of INTERIORS) {
    const b = interiorBuilding(r.building);
    for (const it of r.items) {
      if (!isSolid(it)) continue;
      const q = itemRect(it);
      out.push({ building: r.building, model: it.model, min: { x: q.x0, y: b.floor, z: q.z0 }, max: { x: q.x1, y: b.floor + MODELS[it.model][2], z: q.z1 } });
    }
  }
  return out;
}
