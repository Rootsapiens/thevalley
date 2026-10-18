import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { newPlayer, step, overlaps, type Input, type Box } from '../src/physics';
import { villageSolids, churchLayout, COLUMN_R, LAMPS, LANTERN_SIDE, WALL_T, BARN, POSTS_Z, groundY } from '../src/village';
import { BUILDINGS, TRANSFORMER } from '../src/villageMap';

// The church interior (owner's grand-church request, rebuilt so it shows) and the lit lamps. churchLayout is shared by
// the builder (villageTown.ts) and the collision, so these checks hold for what is drawn and what is solid.
const B = BUILDINGS.find(b => b.kind === 'church')!;
const L = churchLayout(B);
const door = B.doors[0];
const win = (i: number) => B.x0 + (B.x1 - B.x0) * (i + 0.5) / 4;   // villageTown windowsOf, church: 4 per long wall
const WIN_Y0 = B.floor + 2.4;                                        // church windows: floor + 2.4, 2.6 tall
const zn = B.z0 + WALL_T, zs = B.z1 - WALL_T;
const WORLD = villageSolids().map(s => s.box);
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: true, yaw: 0 };
const flat = (r: { x0: number; x1: number; z0: number; z1: number }, y0 = 0, y1 = 9): Box =>
  ({ min: { x: r.x0, y: y0, z: r.z0 }, max: { x: r.x1, y: y1, z: r.z1 } });

describe('Church interior', () => {
  it('hangs every picture flat on an inner wall, inside the nave, under its window and clear of the door', () => {
    expect(L.pictures.map(p => p.name)).toEqual(['church_steps', 'great_hall', 'yard', 'mary', 'crucifixion']);
    for (const p of L.pictures) {
      expect(p.zWall, p.name).toBeCloseTo(p.nz > 0 ? zn : zs, 6);              // on the inner face, not inside the wall
      expect(p.x - p.w / 2 - 0.07, p.name).toBeGreaterThan(B.x0 + WALL_T);      // frame inside the end walls
      expect(p.x + p.w / 2 + 0.07, p.name).toBeLessThan(B.x1 - WALL_T);
      expect(p.y + p.h / 2 + 0.07 + 0.12, p.name).toBeLessThan(WIN_Y0);         // frame and lamp under the window
      expect(p.y - p.h / 2, p.name).toBeGreaterThan(B.floor + 1.0);             // above the pew backs
      expect(Math.max(p.w, p.h), p.name).toBeGreaterThanOrEqual(0.95);          // readable from the aisle (3.8 m)
      if (p.nz < 0) expect(Math.abs(p.x - door.at), p.name).toBeGreaterThan(door.w / 2 + p.w / 2 + 0.1);
      expect([0, 1, 2].some(i => Math.abs(win(i) - p.x) < 1e-9), `${p.name} centred under a window`).toBe(true);
    }
  });

  it('keeps each picture at its image aspect (the drawings were stretched to 16:9 before)', async () => {
    for (const p of L.pictures) {
      const m = await sharp(`public/art/photos/${p.name}.jpg`).metadata();
      expect(Math.abs(p.w / p.h - m.width! / m.height!), `${p.name} ${m.width}x${m.height}`).toBeLessThan(0.02);
    }
  });

  it('stands the columns at the window piers, out of the door, the pews and the pictures', () => {
    expect(L.columns.length).toBe(5);   // 3 north, 2 south: the south door takes the west pier
    for (const c of L.columns) {
      const box = flat({ x0: c.x - COLUMN_R, x1: c.x + COLUMN_R, z0: c.z - COLUMN_R, z1: c.z + COLUMN_R });
      for (const p of L.pews) expect(overlaps(box, flat(p)), `column ${c.x.toFixed(2)},${c.z.toFixed(2)} in a pew`).toBe(false);
      for (const p of L.pictures) expect(Math.abs(c.x - p.x), `column in front of ${p.name}`).toBeGreaterThan(p.w / 2 + COLUMN_R);
      expect(Math.abs(c.x - door.at) > door.w / 2 + COLUMN_R || c.z < (B.z0 + B.z1) / 2, 'column in the door').toBe(true);
    }
  });

  it('lets Lorenzo walk in at the south door, up between the pews and along the aisle to the altar', () => {
    const p = newPlayer({ x: door.at - 0.25, y: groundY(door.at, B.z1 + 1.2) + 0.01, z: B.z1 + 1.2 });
    const route = [[door.at - 0.25, L.cz + 0.5], [L.altar.x0 - 0.9, L.cz]];
    let wp = 0, ticks = 0;
    while (ticks++ < 120 * 40) {
      const [tx, tz] = route[wp];
      if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 0.3) { if (wp === route.length - 1) break; wp++; }
      step(p, { ...idle, forward: 1, yaw: Math.atan2(-(route[wp][0] - p.pos.x), -(route[wp][1] - p.pos.z)) }, WORLD, 1 / 120, groundY);
    }
    expect(Math.hypot(route[1][0] - p.pos.x, route[1][1] - p.pos.z), `stuck at (${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)})`).toBeLessThan(0.3);
    expect(p.pos.y).toBeLessThan(B.floor + 0.05);   // walked on the floor, never up onto a pew
  });

  it('makes the pews, columns and altar solid', () => {
    const at = (x: number, z: number) => WORLD.some(w => overlaps(flat({ x0: x - 0.01, x1: x + 0.01, z0: z - 0.01, z1: z + 0.01 }, B.floor + 0.3, B.floor + 0.31), w));
    const pew = L.pews[0], col = L.columns[0];
    expect(at((pew.x0 + pew.x1) / 2, (pew.z0 + pew.z1) / 2)).toBe(true);
    expect(at(col.x, col.z)).toBe(true);
    expect(at((L.altar.x0 + L.altar.x1) / 2, L.cz)).toBe(true);
    expect(at(L.altar.x0 - 1.0, L.cz)).toBe(false);   // the aisle in front of the altar is free
  });
});

describe('Lit lamps', () => {
  it('puts the street light just under the lamp head on the transformer pole', () => {
    const s = LAMPS.filter(l => l.street);
    expect(s.length).toBe(1);
    const tg = groundY(TRANSFORMER.x, TRANSFORMER.z), glass = tg + 5.48;   // villageTown: the head's glass pane
    expect(s[0].x).toBeCloseTo(TRANSFORMER.x - 1.35, 6);
    expect(s[0].z).toBeCloseTo(TRANSFORMER.z - 0.42, 6);
    expect(glass - s[0].y).toBeGreaterThan(0.1);
    expect(glass - s[0].y).toBeLessThan(0.3);
  });

  it('hangs the barn lanterns inside the barn: one on the z = -4 rope, two on brackets at the z = 0 posts', () => {
    const barn = LAMPS.filter(l => !l.street);
    expect(barn.length).toBe(3);
    for (const l of barn) {
      expect(Math.abs(l.x)).toBeLessThan(BARN.x1 - BARN.wall);
      expect(Math.abs(l.z)).toBeLessThan(BARN.z1 - BARN.wall);
      expect(l.y).toBeGreaterThan(2.2);
      expect(l.y + 0.3).toBeLessThan(BARN.eave);
    }
    expect(barn[0]).toMatchObject({ x: 0, z: -4 });
    expect(barn[0].y + 0.3).toBeCloseTo(3.0, 6);           // the bail meets the rope's end
    expect(POSTS_Z).toContain(LANTERN_SIDE.z);
    const postFace = 6.15 - 0.125;
    expect(postFace - LANTERN_SIDE.x).toBeGreaterThan(0.3);  // off the post, so it does not scorch it
    expect(postFace - LANTERN_SIDE.x).toBeLessThan(0.6);
  });
});
