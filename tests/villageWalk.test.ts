import { describe, it, expect } from 'vitest';
import { newPlayer, step, overlaps, slopeAt, TUNING, type Box, type Input, type PlayerState } from '../src/physics';
import {
  villageSolids, USABLES, leafBox, pickUsable, SPAWN, END_ZONE, TRAIL_END_ZONE, TURNBACK_ZONE, EXAMINABLES, BARN, FARMHOUSE, groundY,
} from '../src/village';
import {
  GRID, BUILDINGS, GATES, WALLS, STONES, FOUNTAIN, TRANSFORMER, PATHS, SQUARE, MAP, DEVIATIONS, cellCentre, cells, streamX, streamHalf, waterY,
  type Rect,
} from '../src/villageMap';

// Full village blockout (src/villageMap.ts): conformance with studio/world/regions/village.md, reachability on foot
// (player-sized 2.5D flood fill over terrain and boxes), physics walks to every landmark, random-walk invariants.
const DT = 1 / 120;
const SOLIDS = villageSolids();
const STATIC = SOLIDS.map(s => s.box);
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: true, yaw: 0 };
const R = TUNING.radius, H = TUNING.standHeight, MAXT = Math.tan(TUNING.maxSlope * Math.PI / 180);
const leaves = (open: boolean) => USABLES.filter(u => !u.locked).map(u => leafBox(u, open ? 1 : 0, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
const inRect = (x: number, z: number, r: Rect, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;

/** Boxes bucketed on a 4 m grid, so a test can ask for the boxes near a point quickly. */
function hashed(boxes: Box[]) {
  const m = new Map<number, Box[]>(), C = 4;
  for (const b of boxes) for (let i = Math.floor(b.min.x / C); i <= Math.floor(b.max.x / C); i++) for (let j = Math.floor(b.min.z / C); j <= Math.floor(b.max.z / C); j++) {
    const k = i * 4099 + j; let a = m.get(k); if (!a) m.set(k, a = []); a.push(b);
  }
  const out: Box[] = [], seen = new Set<Box>();
  return (x: number, z: number, r = 2.5) => {
    out.length = 0; seen.clear();
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++)
      for (const b of m.get(i * 4099 + j) ?? []) if (!seen.has(b)) { seen.add(b); out.push(b); }
    return out;
  };
}

/** 2.5D flood fill from the spawn. A cell holds the height the player stands at (terrain or a box top reachable
 *  with `climb`: 0.45 m on foot, 1.1 m with a jump). Terrain moves respect the 40 deg slope limit. */
function flood(boxes: Box[], climb = TUNING.stepHeight, h = 0.4) {
  const near = hashed(boxes), X0 = -80, Z0 = -48, NX = Math.round(210 / h), NZ = Math.round(164 / h);
  const hgt = new Float32Array(NX * NZ).fill(NaN), parent = new Int32Array(NX * NZ).fill(-1);
  const support = (x: number, z: number, y0: number) => {
    let s = groundY(x, z);
    for (const b of near(x, z, 1)) if (x - R < b.max.x && x + R > b.min.x && z - R < b.max.z && z + R > b.min.z && b.max.y <= y0 + climb + 1e-6 && b.max.y > s) s = b.max.y;
    return s;
  };
  const free = (x: number, y: number, z: number) => {
    for (const b of near(x, z, 1)) if (x - R < b.max.x && x + R > b.min.x && y + 0.02 < b.max.y && y + H > b.min.y && z - R < b.max.z && z + R > b.min.z) return false;
    return true;
  };
  const si = Math.round((SPAWN.x - X0) / h), sj = Math.round((SPAWN.z - Z0) / h), s0 = si + sj * NX;
  hgt[s0] = support(SPAWN.x, SPAWN.z, 0.5);
  const q = [s0];
  while (q.length) {
    const c = q.shift()!, ci = c % NX, cj = (c - ci) / NX, y0 = hgt[c];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = ni + nj * NX;
      if (!Number.isNaN(hgt[n])) continue;
      const x = X0 + ni * h, z = Z0 + nj * h, y = support(x, z, y0), onTerrain = Math.abs(y - groundY(x, z)) < 1e-3;
      if (y > y0 + (onTerrain && climb <= TUNING.stepHeight ? MAXT * h + 0.01 : climb + 1e-3)) continue;
      if (onTerrain && slopeAt(groundY, x, z) > MAXT * 1.05) continue;
      if (!free(x, y, z)) continue;
      hgt[n] = y; parent[n] = c; q.push(n);
    }
  }
  const idx = (x: number, z: number) => Math.round((x - X0) / h) + Math.round((z - Z0) / h) * NX;
  const at = (x: number, z: number) => !Number.isNaN(hgt[idx(x, z)]);
  const nearAt = (x: number, z: number, r = 0.8) => { for (let dx = -r; dx <= r + 1e-9; dx += h) for (let dz = -r; dz <= r + 1e-9; dz += h) if (at(x + dx, z + dz)) return true; return false; };
  /** Cell path from the spawn to the reachable cell nearest (x, z), as world points. */
  const path = (x: number, z: number) => {
    let best = -1, bd = Infinity;
    for (let dx = -1.2; dx <= 1.2 + 1e-9; dx += h) for (let dz = -1.2; dz <= 1.2 + 1e-9; dz += h) {
      const k = idx(x + dx, z + dz); if (k >= 0 && k < hgt.length && !Number.isNaN(hgt[k]) && Math.hypot(dx, dz) < bd) { bd = Math.hypot(dx, dz); best = k; }
    }
    const pts: { x: number; z: number }[] = [];
    for (let c = best; c >= 0; c = parent[c]) pts.push({ x: X0 + (c % NX) * h, z: Z0 + Math.floor(c / NX) * h });
    return pts.reverse();
  };
  let count = 0; for (const v of hgt) if (!Number.isNaN(v)) count++;
  return { at, nearAt, path, area: count * h * h };
}

/** Walks the real physics along waypoints; returns where it stalled (null when it arrived). */
function walk(path: { x: number; z: number }[], boxes: Box[], maxSeconds = 160): string | null {
  const near = hashed(boxes), p = newPlayer({ x: path[0].x, y: groundY(path[0].x, path[0].z) + 0.01, z: path[0].z });
  const wps = path.filter((_, i) => i % 2 === 0 || i === path.length - 1);
  let w = 0, best = Infinity, since = 0;
  for (let t = 0; t < maxSeconds * 120; t++) {
    const tg = wps[w], d = Math.hypot(tg.x - p.pos.x, tg.z - p.pos.z);
    if (d < 0.45) { if (w === wps.length - 1) return null; w++; best = Infinity; since = 0; continue; }
    if (d < best - 0.05) { best = d; since = 0; } else if (++since > 120 * 3) return `stuck at (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)}) heading to (${tg.x.toFixed(1)}, ${tg.z.toFixed(1)}), waypoint ${w}/${wps.length}`;
    step(p, { ...idle, forward: 1, yaw: Math.atan2(-(tg.x - p.pos.x), -(tg.z - p.pos.z)) }, near(p.pos.x, p.pos.z), DT, groundY);
  }
  return `timed out at (${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)})`;
}

const LANDMARKS: Record<string, { x: number; z: number }> = {
  '1 barn (north door)': { x: 0, z: -11.5 }, '2 farmhouse door': { x: -13.6, z: 2.2 }, '3 bell tower (inside)': { x: 2.5, z: 29 },
  '4 fountain': { x: 22.5, z: 44.6 }, '5 cafe door': { x: 7, z: 58.8 }, '6 police post door': { x: -9.2, z: 47.5 },
  '7 Maryam (kitchen)': { x: 75, z: 11 }, '8 stones (east bank)': { x: 110.2, z: 12.5 }, '9 transformer pole': { x: 41.6, z: 59.4 },
  'church nave': { x: 14, z: 30.5 }, 'trail end (road to the mountain)': { x: 122.5, z: 12.5 }, 'valley road south': { x: 37.5, z: 107.5 },
  'mountain path end (slice)': { x: 25, z: -39.6 },
};

describe('Village map conformance (studio/world/regions/village.md)', () => {
  it('reads the 40 x 26 grid verbatim and lists its deviations', () => {
    expect(GRID.length).toBe(26);
    for (const row of GRID) expect(row.length).toBe(40);
    expect(DEVIATIONS.length).toBeGreaterThan(0);
    expect(cells(13, 2, 16, 5)).toEqual({ x0: BARN.x0, x1: BARN.x1, z0: BARN.z0, z1: BARN.z1 });   // anchored on barn [1]
  });

  it('every numbered landmark stands in its digit cell', () => {
    const where: Record<string, Rect> = {
      1: BARN, 2: FARMHOUSE, 3: BUILDINGS.find(b => b.landmark === 3)!, 5: BUILDINGS.find(b => b.landmark === 5)!,
      6: BUILDINGS.find(b => b.landmark === 6)!, 7: BUILDINGS.find(b => b.landmark === 7)!,
      4: { x0: FOUNTAIN.x - FOUNTAIN.r, x1: FOUNTAIN.x + FOUNTAIN.r, z0: FOUNTAIN.z - FOUNTAIN.r, z1: FOUNTAIN.z + FOUNTAIN.r },
      8: { x0: STONES[0].x, x1: STONES[6].x, z0: STONES[0].z - 0.5, z1: STONES[0].z + 0.5 },
      9: { x0: TRANSFORMER.x - 0.3, x1: TRANSFORMER.x + 0.3, z0: TRANSFORMER.z - 0.3, z1: TRANSFORMER.z + 0.3 },
    };
    GRID.forEach((row, r) => [...row].forEach((ch, c) => {
      if (!/\d/.test(ch)) return;
      const cell = cells(c, r), rect = where[ch];
      expect(rect, `landmark ${ch}`).toBeTruthy();
      const overlap = rect.x0 < cell.x1 + 2.6 && rect.x1 > cell.x0 - 2.6 && rect.z0 < cell.z1 + 2.6 && rect.z1 > cell.z0 - 2.6;
      expect(overlap, `landmark ${ch} at cell (${c}, ${r})`).toBe(true);
    }));
  });

  it('every house, barn, church, school and cafe cell outside the barn corner is covered by a building, and each building sits on its cells', () => {
    const corner = (c: number, r: number) => c >= 8 && c <= 21 && r <= 7;   // approved slice: its own farmhouse/houses
    GRID.forEach((row, r) => [...row].forEach((ch, c) => {
      if (!/[HBCSK]/.test(ch) || corner(c, r) || (ch === 'B' && c >= 13 && c <= 16 && r >= 2 && r <= 5)) return;
      const { x, z } = cellCentre(c, r);
      expect(BUILDINGS.some(b => inRect(x, z, b, 1.6)), `'${ch}' cell (${c}, ${r})`).toBe(true);
    }));
    for (const b of BUILDINGS) {
      const [c0, r0, c1, r1] = b.cells!;
      const want = cells(c0, r0, c1, r1);
      expect(b.x0 >= want.x0 - 0.01 && b.x1 <= want.x1 + 0.01 && b.z0 >= want.z0 - 0.01 && b.z1 <= want.z1 + 0.01, b.id).toBe(true);
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expect(/[HBCSK\d.]/.test(GRID[r][c]), `${b.id} cell (${c}, ${r}) is '${GRID[r][c]}'`).toBe(true);
    }
  });

  it('gates stand on the gate cells, the stream fills its cells, the # wall is col 7 and 1.0 m, the road follows col 22', () => {
    for (const [c, r] of [[24, 0], [24, 7], [30, 8], [33, 5]]) {
      const { x, z } = cellCentre(c, r);
      // The north gate stands on the slice's cross fence (z -13.5), 4 m inside its row-0 cell (a listed deviation).
      expect(GATES.some(g => Math.hypot(g.x - x, g.z - z) < 4.1), `gate at (${c}, ${r})`).toBe(true);
    }
    GRID.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '~') return;
      const { x, z } = cellCentre(c, r);
      expect(Math.abs(x - streamX(z)) - streamHalf(z), `stream cell (${c}, ${r})`).toBeLessThan(3.2);
    }));
    const wall = WALLS[0];
    expect(wall.x0).toBeCloseTo(cellCentre(7, 0).x, 1);
    expect(wall.h).toBeLessThanOrEqual(1.0);
    const road = PATHS.find(p => p.kind === 'road')!;
    expect(road.w).toBe(5);
    for (let r = 16; r <= 25; r++) expect(Math.abs(road.pts[1][0] - cellCentre(22, r).x)).toBeLessThan(1.5);
    expect(SQUARE.x1 - SQUARE.x0).toBeGreaterThanOrEqual(50);
    expect(SQUARE.z1 - SQUARE.z0).toBeGreaterThanOrEqual(24);
  });

  it('7 stepping stones, 0.6 m apart, across 5 m of water', () => {
    expect(STONES.length).toBe(7);
    for (let i = 1; i < 7; i++) expect(STONES[i].x - STONES[i - 1].x).toBeCloseTo(0.6, 5);
    expect(streamHalf(STONES[0].z) * 2).toBeCloseTo(5, 1);
    for (const s of STONES) expect(s.top).toBeGreaterThan(waterY(s.z));
  });
});

describe('Full village on foot', () => {
  const closed = [...STATIC, ...leaves(false)], open = [...STATIC, ...leaves(true)];
  const fClosed = flood(closed), fOpen = flood(open), fJump = flood(open, 1.1);

  it('with gates and doors open, every landmark, both ends of the playable area and every examine spot are reachable from the spawn', () => {
    for (const [k, p] of Object.entries(LANDMARKS)) expect(fOpen.nearAt(p.x, p.z), k).toBe(true);
    for (const e of EXAMINABLES) expect(fOpen.nearAt(e.from.x, e.from.z, 0.4), e.id).toBe(true);
    expect(fOpen.area).toBeGreaterThan(12000);
  });

  it('closed gates and doors really close: yard, nave, tower, kitchen, field and paddock are shut', () => {
    for (const [k, x, z] of [['yard', 85, 18], ['nave', 14, 30.5], ['tower', 2.5, 29], ['kitchen', 75, 11], ['east field', 40, 5], ['paddock', 45, -25]] as const) {
      expect(fClosed.at(x, z), `${k} closed`).toBe(false);
      expect(fOpen.at(x, z), `${k} open`).toBe(true);
    }
  });

  it('the map is closed even to jumps: nothing outside the fences, walls, stream and stops is reachable', () => {
    for (const [x, z] of [[-77, 50], [-60, -23], [20, 112.5], [37.5, 112], [127.5, 40], [127.5, 12.5], [104.5, 40], [104.5, 0], [10, -46], [25, -45.5], [80, -22]])
      expect(fJump.at(x, z), `(${x}, ${z})`).toBe(false);
  });

  it('the dry-stone wall (#) is jumpable: the olive terraces and the pine wood are reached with a jump, not on foot', () => {
    expect(fOpen.at(-55, 60)).toBe(false);
    expect(fJump.at(-55, 60)).toBe(true);
    expect(fJump.at(-55, 0)).toBe(true);
  });

  it('physics walks from the spawn reach every landmark without getting stuck', () => {
    for (const [k, p] of Object.entries(LANDMARKS)) {
      const path = fOpen.path(p.x, p.z);
      expect(path.length, k).toBeGreaterThan(2);
      expect(walk(path, open), k).toBeNull();
    }
  }, 120_000);
});

describe('Village mechanics', () => {
  const open = [...STATIC, ...leaves(true)], nearOpen = hashed(open);
  const run = (p: PlayerState, input: Partial<Input>, seconds: number, boxes = nearOpen, onTick?: () => void) => {
    for (let t = 0; t < seconds * 120; t++) { step(p, { ...idle, ...input }, boxes(p.pos.x, p.pos.z), DT, groundY); onTick?.(); }
  };

  it('crossing the stepping stones keeps the player on the stones (no fall into the water), even strafing', () => {
    const z = STONES[0].z, x0 = streamX(z) - streamHalf(z) - 0.6;
    for (const strafe of [0, 1, -1]) {
      const p = newPlayer({ x: x0, y: groundY(x0, z) + 0.01, z });
      let low = Infinity;
      // Walk to the first stone, then cross pushing sideways against the corridor.
      for (let t = 0; t < 4 * 120; t++) {
        const on = p.pos.x > STONES[0].x - 0.2;
        step(p, { ...idle, forward: 1, strafe: on ? strafe * 0.6 : 0, yaw: -Math.PI / 2 }, nearOpen(p.pos.x, p.pos.z), DT, groundY);
        if (p.pos.x > STONES[0].x - 0.1 && p.pos.x < STONES[6].x + 0.1) low = Math.min(low, p.pos.y);
      }
      expect(p.pos.x, `strafe ${strafe}`).toBeGreaterThan(streamX(z) + streamHalf(z) + 0.3);
      expect(low, `strafe ${strafe}`).toBeGreaterThan(Math.min(...STONES.map(s => s.top)) - 0.05);
    }
  });

  it('the water cannot be entered off the stones', () => {
    for (const z of [-10, 30, 70]) {
      const x = streamX(z) - streamHalf(z) - 4, p = newPlayer({ x, y: groundY(x, z) + 0.01, z });
      run(p, { forward: 1, yaw: -Math.PI / 2 }, 6);
      expect(p.pos.x, `z ${z}`).toBeLessThan(streamX(z) - streamHalf(z) + 0.2);
      expect(p.pos.y).toBeGreaterThan(waterY(z));
    }
  });

  it('a running jump clears the 1.0 m dry-stone wall; the 1.2 m rail fence and the 1.3 m north wall stop it', () => {
    const jumpAt = (x0: number, z: number, yaw: number, at: (p: PlayerState) => boolean) => {
      const p = newPlayer({ x: x0, y: groundY(x0, z) + 0.01, z });
      let jumped = false;
      for (let t = 0; t < 4 * 120; t++) {
        const j = !jumped && at(p);
        if (j) jumped = true;
        step(p, { ...idle, forward: 1, walk: false, jump: j, yaw }, nearOpen(p.pos.x, p.pos.z), DT, groundY);
      }
      return p;
    };
    expect(jumpAt(-33, 50, Math.PI / 2, p => p.pos.x < -36.3).pos.x).toBeLessThan(-39);           // # wall, westward
    expect(jumpAt(-70, 50, Math.PI / 2, p => p.pos.x < -73.6).pos.x).toBeGreaterThan(-75);         // boundary fence
    expect(jumpAt(10, -30, 0, p => p.pos.z < -37.2).pos.z).toBeGreaterThan(-38.5);                  // north wall
  });

  it('gates and doors: usable from their spot, closed leaves block the opening, open leaves clear it', () => {
    for (const [i, u] of USABLES.entries()) {
      const eye = { x: u.from.x, y: u.from.y + 1.64, z: u.from.z };
      const d = { x: u.pos.x - eye.x, y: u.pos.y - eye.y, z: u.pos.z - eye.z }, n = Math.hypot(d.x, d.y, d.z);
      expect(pickUsable(eye, { x: d.x / n, y: d.y / n, z: d.z / n }, SOLIDS), u.id).toBe(i);
      const fb: Box = { min: { x: u.from.x - R, y: u.from.y + 0.01, z: u.from.z - R }, max: { x: u.from.x + R, y: u.from.y + H, z: u.from.z + R } };
      expect(STATIC.some(b => overlaps(fb, b)), `${u.id} spot is free`).toBe(false);
      if (u.locked) continue;
      // The middle of the opening, a little above the sill.
      const mx = u.hinge.x + Math.cos(u.yaw0) * u.w / 2, mz = u.hinge.z - Math.sin(u.yaw0) * u.w / 2;
      const probe: Box = { min: { x: mx - 0.05, y: u.y + 0.5, z: mz - 0.05 }, max: { x: mx + 0.05, y: u.y + 0.6, z: mz + 0.05 } };
      expect(overlaps(probe, leafBox(u, 0, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } })), `${u.id} closed`).toBe(true);
      expect(overlaps(probe, leafBox(u, 1, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } })), `${u.id} open`).toBe(false);
    }
    expect(USABLES.filter(u => u.kind === 'gate').length).toBe(4);
    expect(USABLES.filter(u => !u.locked && u.kind === 'door').map(u => u.id).sort()).toEqual(['door-cafe', 'door-church', 'door-maryam', 'door-post', 'door-tower']);
  });

  it('random walks (run, jump, crouch, turn) never sink into the ground, never end inside a solid, never leave the map', () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const starts = [[4, 21.5], [20, 45], [37.5, 80], [-30, 0], [80, 18], [100.5, 30], [112, 12.5], [47.5, 0], [-55, 60], [60, 100]];
    let ticks = 0;
    for (const [sx, sz] of starts) for (let k = 0; k < 4; k++) {
      const p = newPlayer({ x: sx, y: groundY(sx, sz) + 0.01, z: sz });
      let input: Input = { ...idle };
      for (let t = 0; t < 20 * 120; t++, ticks++) {
        if (t % 90 === 0) input = { forward: rnd() < 0.8 ? 1 : -1, strafe: rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0, jump: rnd() < 0.25, crouch: rnd() < 0.1, walk: rnd() < 0.5, yaw: rnd() * Math.PI * 2 };
        const near = nearOpen(p.pos.x, p.pos.z);
        step(p, input, near, DT, groundY);
        const g = groundY(p.pos.x, p.pos.z);
        if (p.pos.y < g - 0.01) throw new Error(`sank at (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)}), ground ${g.toFixed(2)}`);
        const pb: Box = { min: { x: p.pos.x - R + 0.002, y: p.pos.y + 0.002, z: p.pos.z - R + 0.002 }, max: { x: p.pos.x + R - 0.002, y: p.pos.y + (p.crouched ? 1.0 : 1.8) - 0.002, z: p.pos.z + R - 0.002 } };
        const hit = near.find(b => overlaps(pb, b));
        if (hit) throw new Error(`inside a solid at (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)}): ${JSON.stringify(hit)}`);
        if (!(p.pos.x > MAP.x0 && p.pos.x < MAP.x1 + 0.6 && p.pos.z > -45 && p.pos.z < MAP.z1 + 1.2)) throw new Error(`left the map at (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
      }
    }
    expect(ticks).toBe(10 * 4 * 20 * 120);
  }, 60_000);

  it('the zones: trail end and mountain path end the walk, the road south turns back', () => {
    for (const z of [TRAIL_END_ZONE, END_ZONE]) expect(z.box.max.x - z.box.min.x).toBeGreaterThan(2);
    expect(inRect(37.5, 108, { x0: TURNBACK_ZONE.box.min.x, x1: TURNBACK_ZONE.box.max.x, z0: TURNBACK_ZONE.box.min.z, z1: TURNBACK_ZONE.box.max.z })).toBe(true);
  });
});
