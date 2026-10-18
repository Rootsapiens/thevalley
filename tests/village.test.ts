import { describe, it, expect } from 'vitest';
import { newPlayer, step, eyeHeight, height, overlaps, TUNING, type Input, type PlayerState, type Box } from '../src/physics';
import {
  villageSolids, EXAMINABLES, LINES, SPAWN, SPAWN_YAW, END_ZONE, TURNBACK_ZONE, MOUNTAIN, trailPoints, bearingDir,
  pickExaminable, surfaceAt, zoneEvents, newVillageState, markExamined, rng, SUN,
} from '../src/village';
/** Main route on foot: farm track, back door, aisle, north door, then the hoofprints across the pasture to the gap. */
const ROUTE = [[0, 12], [0, -9], [0, -13], [1.5, -15], [25, -38.6], [25.2, -40.5]];

const DT = 1 / 120;
const SOLIDS = villageSolids();
const WORLD = SOLIDS.map(s => s.box);
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: true, yaw: 0 };
const ARABIC = /[؀-ۿ]/;
const BANNED = /half-?life|black mesa|gordon|freeman|\bxen\b|\bhev\b|combine|headcrab|crowbar|g-man|lambda|barney|vortigaunt|resonance cascade|valve/i;

function pbox(p: PlayerState): Box {
  return { min: { x: p.pos.x - TUNING.radius, y: p.pos.y, z: p.pos.z - TUNING.radius },
           max: { x: p.pos.x + TUNING.radius, y: p.pos.y + height(p), z: p.pos.z + TUNING.radius } };
}
const free = (x: number, z: number) => {
  const b: Box = { min: { x: x - TUNING.radius, y: 0.01, z: z - TUNING.radius }, max: { x: x + TUNING.radius, y: 1.81, z: z + TUNING.radius } };
  return !WORLD.some(w => overlaps(b, w));
};

describe('Village slice data', () => {
  it('has 8-12 examinables, each with Arabic + English name and line, unique ids', () => {
    expect(EXAMINABLES.length).toBeGreaterThanOrEqual(8);
    expect(EXAMINABLES.length).toBeLessThanOrEqual(12);
    expect(new Set(EXAMINABLES.map(e => e.id)).size).toBe(EXAMINABLES.length);
    for (const e of EXAMINABLES) {
      for (const t of [e.name, e.line]) {
        expect(t.ar.trim().length, e.id).toBeGreaterThan(0);
        expect(t.en.trim().length, e.id).toBeGreaterThan(0);
        expect(ARABIC.test(t.ar), `${e.id} ar is Arabic`).toBe(true);
        expect(ARABIC.test(t.en), `${e.id} en has no Arabic`).toBe(false);
      }
      expect(e.line.en.length, `${e.id} fits a two-line subtitle`).toBeLessThanOrEqual(130);
    }
    for (const [k, t] of Object.entries(LINES)) {
      expect(ARABIC.test(t.ar), k).toBe(true);
      expect(t.en.length, k).toBeGreaterThan(0);
    }
  });

  it('uses no banned names (brief section 1)', () => {
    const all = JSON.stringify({ EXAMINABLES, LINES });
    expect(BANNED.test(all)).toBe(false);
  });

  it('every examinable can be examined from its standing spot (in range, facing it, line of sight)', () => {
    for (const [i, e] of EXAMINABLES.entries()) {
      const p = newPlayer(e.from);
      for (let k = 0; k < 30; k++) step(p, idle, WORLD, DT);
      expect(p.onGround, e.id).toBe(true);
      expect(Math.hypot(p.pos.x - e.from.x, p.pos.z - e.from.z), `${e.id} spot is free`).toBeLessThan(0.01);
      const eye = { x: p.pos.x, y: p.pos.y + eyeHeight(p), z: p.pos.z };
      const d = { x: e.pos.x - eye.x, y: e.pos.y - eye.y, z: e.pos.z - eye.z };
      const n = Math.hypot(d.x, d.y, d.z);
      expect(pickExaminable(eye, { x: d.x / n, y: d.y / n, z: d.z / n }, EXAMINABLES, SOLIDS), e.id).toBe(i);
    }
  });

  it('cannot examine through walls: the halter is not pickable from outside the barn', () => {
    const eye = { x: 11.2, y: 1.64, z: -3.0 };
    const halter = EXAMINABLES.find(e => e.id === 'halter')!;
    const d = { x: halter.pos.x - eye.x, y: halter.pos.y - eye.y, z: halter.pos.z - eye.z };
    const n = Math.hypot(d.x, d.y, d.z);
    expect(pickExaminable(eye, { x: d.x / n, y: d.y / n, z: d.z / n }, EXAMINABLES, SOLIDS, 10)).toBe(-1);
  });

  it('spawn, every examine spot and the end zone are connected on foot (grid flood fill, player-sized)', () => {
    const h = 0.25, x0 = -28, z0 = -44, nx = Math.round(58 / h), nz = Math.round(72 / h);
    const cell = (x: number, z: number) => [Math.round((x - x0) / h), Math.round((z - z0) / h)] as const;
    const seen = new Uint8Array(nx * nz);
    const [sx, sz] = cell(SPAWN.x, SPAWN.z);
    const q = [sx + sz * nx];
    seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop()!, cx = c % nx, cz = (c - cx) / nx;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = cx + dx, az = cz + dz;
        if (ax < 0 || az < 0 || ax >= nx || az >= nz || seen[ax + az * nx]) continue;
        if (!free(x0 + ax * h, z0 + az * h)) { seen[ax + az * nx] = 2; continue; }
        seen[ax + az * nx] = 1;
        q.push(ax + az * nx);
      }
    }
    const reach = (x: number, z: number) => { const [a, b] = cell(x, z); return seen[a + b * nx] === 1; };
    for (const e of EXAMINABLES) expect(reach(e.from.x, e.from.z), e.id).toBe(true);
    expect(reach((END_ZONE.box.min.x + END_ZONE.box.max.x) / 2, END_ZONE.box.max.z - 0.5)).toBe(true);
    // The play space is closed: nothing outside the fences/walls is reachable.
    expect(reach(-27.9 - 0.3, 0)).toBe(false);
    expect(reach(10, -46)).toBe(false);
    expect(reach(25, -46)).toBe(false);
    expect(reach(0, 28.5)).toBe(false);
  });

  it('hoofprint trail is continuous, starts in the barn, never crosses a solid, reaches the end zone, always heads toward the mountain', () => {
    const t = trailPoints(0.25);
    const m = bearingDir(MOUNTAIN.bearing);
    expect(Math.abs(t[0].x) < 2 && t[0].z > -10 && t[0].z < 10).toBe(true);
    let reachedEnd = -1;
    for (let i = 1; i < t.length; i++) {
      const dx = t[i].x - t[i - 1].x, dz = t[i].z - t[i - 1].z;
      expect(Math.hypot(dx, dz)).toBeLessThan(0.26);
      expect(dx * m.x + dz * m.z, `segment ${i} heads toward the mountain`).toBeGreaterThan(0);
      const b = END_ZONE.box;
      if (reachedEnd < 0 && t[i].x > b.min.x && t[i].x < b.max.x && t[i].z > b.min.z && t[i].z < b.max.z) reachedEnd = i;
    }
    expect(reachedEnd).toBeGreaterThan(0);
    const point: Box = { min: { x: 0, y: 0.05, z: 0 }, max: { x: 0, y: 0.06, z: 0 } };
    for (const p of t.slice(0, reachedEnd)) {
      point.min.x = point.max.x = p.x; point.min.z = point.max.z = p.z;
      point.max.x += 1e-3; point.max.z += 1e-3;
      expect(WORLD.some(w => overlaps(point, w)), `print at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(false);
    }
  });

  it('headless walk: spawn → barn back door → aisle → north door → lane → wall gap ends the slice', () => {
    const route = ROUTE;
    const p = newPlayer(SPAWN);
    const s = newVillageState();
    let wp = 0, ticks = 0, ended = false, yaw = SPAWN_YAW;
    while (ticks++ < 120 * 60 && !ended) {
      const [tx, tz] = route[wp];
      if (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 0.4 && wp < route.length - 1) wp++;
      yaw = Math.atan2(-(route[wp][0] - p.pos.x), -(route[wp][1] - p.pos.z));
      step(p, { ...idle, forward: 1, yaw }, WORLD, DT);
      if (zoneEvents(s, pbox(p)).includes('end')) ended = true;
    }
    expect(ended, `stuck at (${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}) heading to waypoint ${wp}`).toBe(true);
    expect(s.finished).toBe(true);
    const seconds = ticks * DT;
    expect(seconds).toBeGreaterThan(20);   // walking pace (3 m/s): the straight route is ~80 m
    expect(seconds).toBeLessThan(40);
  });

  it('no stretch of the route runs more than 15 m without an examinable or a hoofprint (Noor)', () => {
    const t = trailPoints(0.5), pts = [[SPAWN.x, SPAWN.z], ...ROUTE];
    let run = 0, worst = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
      for (let k = 1; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        const covered = EXAMINABLES.some(e => Math.hypot(e.pos.x - x, e.pos.z - z) < 4) || t.some(p => Math.hypot(p.x - x, p.z - z) < 2);
        run = covered ? 0 : run + Math.hypot(bx - ax, bz - az) / n;
        worst = Math.max(worst, run);
      }
    }
    expect(worst).toBeLessThanOrEqual(15);
  });

  it('long shadows point along the tracks: sun opposite the mountain within 30 deg, low', () => {
    const shadow = (SUN.bearing + 180) % 360;
    expect(Math.abs(((shadow - MOUNTAIN.bearing + 540) % 360) - 180)).toBeLessThanOrEqual(30);
    expect(SUN.elevation).toBeLessThanOrEqual(6);
  });

  it('walking back to the village fires turnback and an invisible stop holds the player', () => {
    const p = newPlayer({ x: 0, y: 0.01, z: 23.5 });
    const s = newVillageState();
    let turned = 0;
    for (let i = 0; i < 120 * 6; i++) {
      step(p, { ...idle, forward: 1, yaw: Math.PI }, WORLD, DT);
      if (zoneEvents(s, pbox(p)).includes('turnback')) turned++;
    }
    expect(turned).toBeGreaterThan(0);
    expect(p.pos.z).toBeLessThan(TURNBACK_ZONE.box.max.z + 0.5);
    expect(s.finished).toBe(false);
  });

  it('footstep surfaces: wood aisle, straw stalls, stone yard, dirt lane', () => {
    expect(surfaceAt(0, 0)).toBe('wood');
    expect(surfaceAt(4, 0)).toBe('straw');
    expect(surfaceAt(-12.5, 2)).toBe('stone');
    expect(surfaceAt(0, -18)).toBe('dirt');
  });

  it('examined list records each item once; rng is deterministic', () => {
    const s = newVillageState();
    expect(markExamined(s, 'halter')).toBe(true);
    expect(markExamined(s, 'halter')).toBe(false);
    expect(s.examined).toEqual(['halter']);
    const a = rng(7), b = rng(7);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });
});
