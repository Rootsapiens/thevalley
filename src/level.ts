import { box, type Box } from './physics';

export interface Solid { box: Box; color: number }

// M0 test room: maintenance hall with stairs, a crate, a low duct and a ledge.
type P = { x: number; y: number; z: number };

export function testRoom(): { solids: Solid[]; spawn: P; drifters: P[]; ammo: P[] } {
  const concrete = 0x6b6f72, wall = 0x8a8d7f, metal = 0x4a5560, hazard = 0xc8a23a, crate = 0x7a5a35;
  const s: Solid[] = [
    { box: box(0, -1, 0, 40, 1, 40), color: concrete },          // floor
    { box: box(0, 8, 0, 40, 1, 40), color: 0x3a3d40 },           // ceiling
    { box: box(0, 0, -20, 40, 8, 1), color: wall },              // walls
    { box: box(0, 0, 20, 40, 8, 1), color: wall },
    { box: box(-20, 0, 0, 1, 8, 40), color: wall },
    { box: box(20, 0, 0, 1, 8, 40), color: wall },
    { box: box(6, 0, -4, 2, 1.2, 2), color: crate },             // crate: jump-up height
    { box: box(-8, 1.0, 6, 6, 3, 1), color: metal },             // duct: crouch under (gap 1.0 m)
    { box: box(-8, 0, 6.6, 6, 1.0, 0.2), color: hazard },        // (low lip, visual guide)
    { box: box(12, 0, 10, 8, 3, 8), color: metal },              // ledge platform
  ];
  // Stairs up to the ledge (top 3 m, front face z=6): 7 steps of 3/7 m, under step height 0.45.
  const steps = 7, rise = 3 / steps;
  for (let i = 0; i < steps; i++) {
    s.push({ box: box(12, 0, 6 - (steps - i) * 0.7 + 0.35, 3, rise * (i + 1), 0.7), color: hazard });
  }
  // Wall slab with a doorway, to test sliding along walls.
  s.push({ box: box(-4, 0, -10, 10, 8, 0.5), color: wall });
  s.push({ box: box(8, 0, -10, 10, 8, 0.5), color: wall });
  return {
    solids: s,
    spawn: { x: 0, y: 0.01, z: 8 },
    // Drifter centers (hover height ~1.3 m above their floor).
    drifters: [
      { x: -6, y: 1.3, z: -15 },
      { x: 8, y: 1.3, z: -16 },
      { x: 12, y: 4.3, z: 12 },   // on the ledge
    ],
    ammo: [{ x: 6, y: 1.4, z: -4 }, { x: -14, y: 0.2, z: 14 }],
  };
}
