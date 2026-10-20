import { describe, it, expect } from 'vitest';
import manifest from '../studio/art/furniture-manifest.md?raw';
import { INTERIORS, MODELS, itemRect, isSolid, furnitureBoxes, interiorBuilding, type Model } from '../src/interiors';
import { villageSolids, USABLES, WALL_T, leafBox } from '../src/village';
import { placeNpcs } from '../src/npcPlacement';
import { CH1_DAY1, makeActors, actorBox } from '../src/npcTalk';
import { overlaps, TUNING, type Box } from '../src/physics';

// Build step 2: the furnished rooms (Maryam's kitchen, the police post, the café) with Aktham's CC0 models.
const GLBS = Object.keys(import.meta.glob('../public/models/*.glb'));
const box = (r: { x0: number; x1: number; z0: number; z1: number }, y0: number, y1: number): Box => ({ min: { x: r.x0, y: y0, z: r.z0 }, max: { x: r.x1, y: y1, z: r.z1 } });

describe('furnished interiors (src/interiors.ts)', () => {
  it('uses only models from the manifest, at the manifest footprints', () => {
    for (const m of Object.keys(MODELS) as Model[]) {
      expect(GLBS, m).toContain(`../public/models/${m}.glb`);
      const row = manifest.split('\n').find((l: string) => l.startsWith(`| ${m}.glb |`));
      expect(row, m).toBeTruthy();
      const [w, d, h] = row!.split('|')[7].trim().split('x').map(Number);
      expect([w, d, h], m).toEqual([...MODELS[m]]);
      expect(/\| CC0 \|/.test(row!), `${m} CC0`).toBe(true);
    }
  });

  it('keeps every piece inside its room, and the solid ones apart', () => {
    for (const r of INTERIORS) {
      const b = interiorBuilding(r.building);
      expect(b.hollow, r.building).toBe(true);
      const solid = r.items.filter(isSolid).map(it => ({ it, q: itemRect(it) }));
      for (const it of r.items) {
        const q = itemRect(it);
        expect(q.x0 >= b.x0 + WALL_T - 0.01 && q.x1 <= b.x1 - WALL_T + 0.01 && q.z0 >= b.z0 + WALL_T - 0.01 && q.z1 <= b.z1 - WALL_T + 0.01, `${r.building} ${it.model} at ${it.x},${it.z}`).toBe(true);
      }
      for (const a of solid) for (const c of solid) if (a !== c) expect(overlaps(box(a.q, 0, 1), box(c.q, 0, 1)), `${a.it.model} / ${c.it.model}`).toBe(false);
      for (const L of r.lamps) expect(L.dy).toBeLessThan(2.6);
    }
  });

  it('is solid in the collision world, clear of the door leaves and of the NPCs that stand inside', () => {
    const all = villageSolids().map(s => s.box), f = furnitureBoxes();
    for (const q of f) expect(all.some(s => s.min.x === q.min.x && s.max.z === q.max.z), q.model).toBe(true);
    for (const u of USABLES.filter(v => v.id === 'door-post' || v.id === 'door-cafe' || v.id === 'door-maryam')) {
      for (let t = 0; t <= 1; t += 0.1) {
        const lb = leafBox(u, t, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
        for (const q of f) expect(overlaps(lb, q), `${u.id} at ${t.toFixed(1)} / ${q.model}`).toBe(false);
      }
    }
    const actors = makeActors(CH1_DAY1);
    for (const a of actors) for (const q of f) expect(overlaps(actorBox(a), q), `${a.id} / ${q.model}`).toBe(false);
    const by = Object.fromEntries(placeNpcs(1, { events: CH1_DAY1.events }).map(p => [p.id, p]));
    expect([by.npc_moreno.room, by.npc_omar.room, by.npc_maryam.room]).toEqual(['school', 'school', 'maryam']);
    expect([by.npc_moreno.issues, by.npc_omar.issues]).toEqual([[], []]);
  });

  it('lets Lorenzo walk from each door to everyone inside and round the room (player-sized flood fill)', () => {
    const solids = [...villageSolids().map(s => s.box), ...makeActors(CH1_DAY1).map(actorBox)], r = TUNING.radius, h = 0.1;
    const targets: Record<string, [number, number][]> = {
      maryam: [[74.0, 12.9], [74.4, 8.4], [77.5, 11.5]], school: [[-14.4, 45.0], [-13.9, 47.5], [-15.0, 52.5], [-17.8, 47.0]], cafe: [[7.0, 62.5], [12.0, 66.0], [3.2, 65.4], [16.6, 65.3]],
    };
    for (const room of INTERIORS) {
      const b = interiorBuilding(room.building), d = b.doors[0], x0 = b.x0, z0 = b.z0, nx = Math.ceil((b.x1 - b.x0) / h), nz = Math.ceil((b.z1 - b.z0) / h);
      const near = solids.filter(s => s.max.x > b.x0 - 1 && s.min.x < b.x1 + 1 && s.max.z > b.z0 - 1 && s.min.z < b.z1 + 1 && s.max.y > b.floor + 0.3 && s.min.y < b.floor + 1.7);
      const free = (i: number, j: number) => { const x = x0 + (i + 0.5) * h, z = z0 + (j + 0.5) * h; return !near.some(s => overlaps({ min: { x: x - r, y: b.floor + 0.35, z: z - r }, max: { x: x + r, y: b.floor + 1.7, z: z + r } }, s)); };
      // Start just inside the doorway.
      const sx = d.face === 'e' ? b.x1 - WALL_T - 0.4 : d.at, sz = d.face === 's' ? b.z1 - WALL_T - 0.4 : d.face === 'n' ? b.z0 + WALL_T + 0.4 : d.at;
      const seen = new Uint8Array(nx * nz), q = [[Math.floor((sx - x0) / h), Math.floor((sz - z0) / h)]];
      expect(free(q[0][0], q[0][1]), `${room.building} doorway`).toBe(true);
      seen[q[0][0] + q[0][1] * nx] = 1;
      while (q.length) {
        const [i, j] = q.pop()!;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, c = j + dj;
          if (a < 0 || c < 0 || a >= nx || c >= nz || seen[a + c * nx] || !free(a, c)) continue;
          seen[a + c * nx] = 1; q.push([a, c]);
        }
      }
      for (const [x, z] of targets[room.building]) expect(seen[Math.floor((x - x0) / h) + Math.floor((z - z0) / h) * nx], `${room.building} reach (${x}, ${z})`).toBe(1);
    }
  });
});
