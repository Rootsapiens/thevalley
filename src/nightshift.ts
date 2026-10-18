// Chapter 1 "Night Shift": locker room → tunnel → control room → catwalk → spillway → exit.
// Coordinates: forward is -Z. y is the bottom of each box (see physics.box).
import { box, type Box, type Vec3 } from './physics';
import type { Usable, Trigger } from './facility';
import palette from '../studio/art/palette.json';

/** Palette token (studio/art/palette.json is the source of truth). */
export type Token = keyof typeof palette;
export const hex = (t: Token): number => parseInt(palette[t].slice(1), 16);

/** Level surface → palette token. src/materials.ts adds roughness/metalness/texture per surface. */
export const C = {
  concrete: 'concrete', wetConcrete: 'concreteDark', ceiling: 'concreteDark', wall: 'wallPaint', tunnel: 'metal',
  metal: 'metal', grating: 'metal', catwalk: 'metal', panel: 'metal', locker: 'metal',
  hazard: 'hazardYellow', rust: 'rust', pipe: 'rust', door: 'rust',
} as const satisfies Record<string, Token>;
export type Surface = keyof typeof C;

export interface Solid { box: Box; surface: Surface; color: number; id?: string }
export interface Pickup { id: string; pos: Vec3; kind: 'ammo' | 'nailer' | 'health' }
export interface EnemySpawn { kind: 'drifter' | 'shard'; pos: Vec3; wake?: string } // wake: event that spawns it
export interface Light { pos: Vec3; color: number; intensity: number; dist: number; tag?: string }

export interface Level {
  solids: Solid[];
  spawn: Vec3;
  spawnYaw: number;
  usables: Usable[];
  triggers: Trigger[];
  pickups: Pickup[];
  enemies: EnemySpawn[];
  lights: Light[];
}

const trig = (id: string, event: string, x: number, y: number, z: number, sx: number, sy: number, sz: number): Trigger =>
  ({ id, event, box: box(x, y, z, sx, sy, sz) });

export function nightShift(): Level {
  const s: Solid[] = [];
  const add = (surface: Surface, x: number, y: number, z: number, sx: number, sy: number, sz: number, id?: string) =>
    s.push({ box: box(x, y, z, sx, sy, sz), surface, color: hex(C[surface]), id });

  // ---- Upper floor (start room, tunnel, control room, door platform) ----
  add('concrete', 0, -1, -25, 24, 1, 64);              // x[-12,12] z[-57,7]

  // ---- Locker room x[-4,4] z[0,7], h=4 ----
  add('wall', 0, 0, 7.25, 8.5, 4, 0.5);
  add('wall', -4.25, 0, 3.5, 0.5, 4, 7.5);
  add('wall', 4.25, 0, 3.5, 0.5, 4, 7.5);
  add('wall', -2.75, 0, -0.25, 2.5, 4, 0.5);
  add('wall', 2.75, 0, -0.25, 2.5, 4, 0.5);
  add('wall', 0, 3, -0.25, 3, 1, 0.5);                  // lintel
  add('ceiling', 0, 4, 3.5, 9, 0.5, 8);
  for (let i = 0; i < 5; i++) add('locker', -3.6, 0, 1.2 + i * 1.1, 0.7, 2, 1.0);   // lockers
  add('metal', 2.5, 0, 5, 2, 0.8, 0.6);                 // bench

  // ---- Maintenance tunnel x[-1.5,1.5] z[-30,0], h=3 ----
  add('tunnel', -1.75, 0, -15, 0.5, 3, 30);
  add('tunnel', 1.75, 0, -15, 0.5, 3, 30);
  add('ceiling', 0, 3, -15, 4, 0.5, 30);
  add('pipe', 0, 1.15, -12, 3, 0.6, 0.8);               // fallen pipe: crouch under (1.15 m gap)
  add('pipe', -1.2, 2.4, -15, 0.4, 0.4, 30);            // ceiling pipes (decor, inside wall line)
  add('hazard', 1.25, 0, -6, 0.4, 0.5, 0.6);            // crate
  add('hazard', 1.25, 0, -21, 0.4, 0.5, 0.6);

  // ---- Control room x[-10,10] z[-50,-30], h=6 ----
  add('wall', -5.75, 0, -29.75, 8.5, 6, 0.5);
  add('wall', 5.75, 0, -29.75, 8.5, 6, 0.5);
  add('wall', 0, 3, -29.75, 3, 3, 0.5);
  add('wall', -10.25, 0, -40, 0.5, 6, 21);
  add('wall', 10.25, 0, -40, 0.5, 6, 21);
  add('wall', -5.75, 0, -50.25, 8.5, 6, 0.5);
  add('wall', 5.75, 0, -50.25, 8.5, 6, 0.5);
  add('wall', 0, 3, -50.25, 3, 3, 0.5);
  add('door', 0, 0, -50.25, 3, 3, 0.4, 'floodgate');    // opens when all breakers are on
  add('ceiling', 0, 6, -40, 21, 0.5, 21);
  add('panel', -3, 0, -40, 6, 1.0, 1.4);                // control desk
  add('metal', 3.5, 0, -44, 1.2, 1.2, 1.2);             // crate cover
  add('metal', -6, 0, -36, 1.2, 1.2, 1.2);
  // Gantry along the right wall + stairs (6 × 0.4 m)
  add('grating', 8, 0, -43, 4, 2.4, 10);                // x[6,10] z[-48,-38], top 2.4
  for (let i = 0; i < 6; i++) add('hazard', 8, 0, -38 + (6 - i) * 0.7 - 0.35, 3, 0.4 * (i + 1), 0.7);

  // ---- Door platform x[-3,3] z[-56,-50.5] ----
  add('wall', -3.25, 0, -53.5, 0.5, 6, 6);
  add('wall', 3.25, 0, -53.5, 0.5, 6, 6);

  // ---- Spillway canyon x[-10,10] z[-96,-56], floor y=-6 ----
  add('wetConcrete', 0, -7, -76, 22, 1, 42);
  add('concrete', -10.25, -6, -76, 0.5, 14, 42);
  add('concrete', 10.25, -6, -76, 0.5, 14, 42);
  add('concrete', -6.5, -6, -56.25, 7, 6, 0.5);         // front wall under the platform, minus catwalk gap
  add('concrete', 6.5, -6, -56.25, 7, 6, 0.5);
  add('concrete', 0, -6, -56.25, 6, 5.7, 0.5);
  add('concrete', 0, -6, -96.25, 20, 12, 0.5);
  // Catwalk (top at y=0)
  add('catwalk', 0, -0.3, -58, 2, 0.3, 4);
  add('catwalk', 0, -0.3, -65, 2, 0.3, 10, 'catwalk-mid'); // collapses
  add('catwalk', 0, -0.3, -75, 2, 0.3, 10);
  // Spillway cover + exit stairs (15 × 0.4 m) to the exit platform
  add('rust', -5, -6, -70, 2, 1.4, 3);
  add('rust', 5, -6, -82, 3, 1.4, 2);
  for (let i = 0; i < 15; i++) add('hazard', 0, -6, -90 + (15 - i) * 0.7 - 0.35, 4, 0.4 * (i + 1), 0.7);
  add('concrete', 0, -6, -93, 6, 6, 6);                 // exit platform x[-3,3] z[-96,-90], top 0
  add('door', 0, 0, -95.9, 2.5, 3, 0.2);                // exit door (decor; the trigger ends the chapter)

  return {
    solids: s,
    spawn: { x: 0, y: 0.01, z: 5 },
    spawnYaw: 0,
    usables: [
      { id: 'breaker-a', kind: 'breaker', index: 0, pos: { x: -9.8, y: 1.4, z: -34 } },
      { id: 'breaker-b', kind: 'breaker', index: 1, pos: { x: -9.8, y: 1.4, z: -46 } },
      { id: 'breaker-c', kind: 'breaker', index: 2, pos: { x: 9.8, y: 3.8, z: -46.5 } },
    ],
    triggers: [
      trig('t-tunnel', 'enter-tunnel', 0, 0, -2, 3, 3, 1),
      trig('t-control', 'enter-control', 0, 0, -31.5, 3, 3, 1),
      trig('t-catwalk', 'collapse', 0, 0, -62, 2, 3, 2),
      trig('t-spillway', 'land-spillway', 0, -6, -76, 20, 2, 40),
      trig('t-exit', 'finish', 0, 0, -94, 6, 3, 3),
    ],
    pickups: [
      { id: 'nailer', kind: 'nailer', pos: { x: 0, y: 0.3, z: -26 } },
      { id: 'ammo-1', kind: 'ammo', pos: { x: -8, y: 0.2, z: -31.5 } },
      { id: 'ammo-2', kind: 'ammo', pos: { x: 9, y: 2.6, z: -40 } },
      { id: 'ammo-3', kind: 'ammo', pos: { x: 7, y: -5.8, z: -66 } },
      { id: 'health-1', kind: 'health', pos: { x: -2, y: 1.15, z: -40 } },
      { id: 'health-2', kind: 'health', pos: { x: -7, y: -5.8, z: -88 } },
    ],
    enemies: [
      { kind: 'drifter', pos: { x: 0, y: 1.3, z: -20 }, wake: 'rupture' },
      { kind: 'drifter', pos: { x: -6, y: 1.3, z: -46 } },
      { kind: 'drifter', pos: { x: 2, y: 1.6, z: -47 } },
      { kind: 'shard', pos: { x: 7, y: 3.2, z: -47.3 } },
      { kind: 'drifter', pos: { x: 5, y: -4.7, z: -74 } },
      { kind: 'drifter', pos: { x: -4, y: -4.7, z: -86 } },
      { kind: 'shard', pos: { x: -8, y: -4.6, z: -84 } },
    ],
    // Style guide: sodium overhead practicals, emergencyRed wall-mounted rims, ruptureTeal only from the rupture.
    lights: [
      { pos: { x: 0, y: 3.5, z: 3.5 }, color: hex('sodium'), intensity: 30, dist: 10, tag: 'flicker' },
      { pos: { x: 0, y: 2.6, z: -8 }, color: hex('sodium'), intensity: 12, dist: 9 },
      { pos: { x: 1.3, y: 2.4, z: -22 }, color: hex('emergencyRed'), intensity: 12, dist: 9, tag: 'alarm' },
      { pos: { x: 0, y: 5.5, z: -40 }, color: hex('sodium'), intensity: 60, dist: 22, tag: 'flicker' },
      { pos: { x: 9.7, y: 5, z: -46 }, color: hex('emergencyRed'), intensity: 15, dist: 10, tag: 'alarm' },
      { pos: { x: 0, y: 4, z: -53 }, color: hex('sodium'), intensity: 16, dist: 12 },
      { pos: { x: 0, y: 2, z: -70 }, color: hex('ruptureTeal'), intensity: 40, dist: 30, tag: 'rupture' },
      { pos: { x: 0, y: -1, z: -88 }, color: hex('sodium'), intensity: 28, dist: 18 },
    ],
  };
}

export const LINES: Record<string, string> = {
  intro: 'INTERCOM: Night shift, Gravity Well Two test begins in ten seconds. Clear the lower decks.',
  rupture: 'INTERCOM: — containment fault — all personnel evacuate via the spillway —',
  'enter-control': 'INTERCOM: Floodgate on emergency lock. Restore power at three breakers.',
  'breaker-on': 'BREAKER ON',
  'door-open': 'INTERCOM: Floodgate power restored. Gate opening.',
  collapse: 'The catwalk gives way!',
  'land-spillway': 'INTERCOM: Spillway exit is at the far end. Take the stairs up to the— (static)',
  finish: 'CHAPTER 1 COMPLETE — NIGHT SHIFT',
};
