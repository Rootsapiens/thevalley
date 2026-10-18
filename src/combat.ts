// Pure combat logic: weapons, hitscan, Drifter AI. No Three.js.
import { overlaps, type Box, type Vec3 } from './physics';

// ---------- Rays ----------
export interface Ray { o: Vec3; d: Vec3 } // d normalized

/** Slab test. Returns distance along ray, or Infinity. */
export function rayBox(r: Ray, b: Box): number {
  let tmin = 0, tmax = Infinity;
  for (const a of ['x', 'y', 'z'] as const) {
    if (Math.abs(r.d[a]) < 1e-9) {
      if (r.o[a] < b.min[a] || r.o[a] > b.max[a]) return Infinity;
      continue;
    }
    let t1 = (b.min[a] - r.o[a]) / r.d[a], t2 = (b.max[a] - r.o[a]) / r.d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function raySphere(r: Ray, c: Vec3, radius: number): number {
  const ox = r.o.x - c.x, oy = r.o.y - c.y, oz = r.o.z - c.z;
  const b = ox * r.d.x + oy * r.d.y + oz * r.d.z;
  const cc = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - cc;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  if (t >= 0) return t;
  return cc <= 0 ? 0 : Infinity; // inside sphere
}

export function worldHit(r: Ray, world: Box[]): number {
  let best = Infinity;
  for (const b of world) best = Math.min(best, rayBox(r, b));
  return best;
}

export function lineOfSight(a: Vec3, b: Vec3, world: Box[]): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  return worldHit({ o: a, d: { x: dx / len, y: dy / len, z: dz / len } }, world) >= len;
}

// ---------- Enemies ----------
export type DrifterMode = 'idle' | 'chase' | 'windup' | 'lunge' | 'recover' | 'dead';

export interface Drifter {
  id: number;
  kind?: 'drifter' | 'shard';   // default drifter
  pos: Vec3;          // center
  health: number;
  mode: DrifterMode;
  timer: number;
  dir: Vec3;          // lunge direction
  hitThisLunge: boolean;
  bob: number;
}

export const DRIFTER = {
  radius: 0.45,
  health: 40,
  hover: 1.3,         // center height above its spawn floor
  sightRange: 16,
  chaseSpeed: 2.6,
  lungeRange: 4,
  windup: 0.45,
  lungeSpeed: 11,
  lungeTime: 0.35,
  recover: 1.0,
  damage: 15,
};

export function newDrifter(id: number, pos: Vec3): Drifter {
  return { id, pos: { ...pos }, health: DRIFTER.health, mode: 'idle', timer: 0, dir: { x: 0, y: 0, z: 0 }, hitThisLunge: false, bob: id * 1.7 };
}

function drifterBox(p: Vec3): Box {
  const r = DRIFTER.radius;
  return { min: { x: p.x - r, y: p.y - r, z: p.z - r }, max: { x: p.x + r, y: p.y + r, z: p.z + r } };
}

/** Try to move; axis-separated so drifters slide along walls. */
function moveDrifter(d: Drifter, v: Vec3, dt: number, world: Box[]): boolean {
  let blocked = false;
  for (const a of ['x', 'y', 'z'] as const) {
    const prev = d.pos[a];
    d.pos[a] += v[a] * dt;
    const bb = drifterBox(d.pos);
    if (world.some(w => overlaps(bb, w))) { d.pos[a] = prev; blocked = true; }
  }
  return blocked;
}

export interface Target { center: Vec3; feet: Vec3; radius: number; height: number }

function touches(d: Drifter, t: Target): boolean {
  const cy = Math.max(t.feet.y, Math.min(d.pos.y, t.feet.y + t.height));
  const dx = d.pos.x - t.feet.x, dy = d.pos.y - cy, dz = d.pos.z - t.feet.z;
  return Math.hypot(dx, dy, dz) < DRIFTER.radius + t.radius;
}

/** Advance one drifter. Returns damage dealt to the player this tick. */
export function updateDrifter(d: Drifter, t: Target, world: Box[], dt: number): number {
  if (d.mode === 'dead') return 0;
  d.timer -= dt;
  d.bob += dt;
  const to = { x: t.center.x - d.pos.x, y: t.center.y - d.pos.y, z: t.center.z - d.pos.z };
  const dist = Math.hypot(to.x, to.y, to.z);
  const sees = dist < DRIFTER.sightRange && lineOfSight(d.pos, t.center, world);

  switch (d.mode) {
    case 'idle':
      if (sees) d.mode = 'chase';
      return 0;
    case 'chase': {
      if (dist < DRIFTER.lungeRange && sees) {
        d.mode = 'windup'; d.timer = DRIFTER.windup;
        return 0;
      }
      const s = DRIFTER.chaseSpeed / Math.max(dist, 1e-6);
      // Mostly horizontal chase; drift toward chest height slowly.
      moveDrifter(d, { x: to.x * s, y: to.y * s * 0.5 + Math.sin(d.bob * 3) * 0.3, z: to.z * s }, dt, world);
      return 0;
    }
    case 'windup':
      if (d.timer <= 0) {
        const n = Math.max(dist, 1e-6);
        d.dir = { x: to.x / n, y: to.y / n, z: to.z / n };
        d.mode = 'lunge'; d.timer = DRIFTER.lungeTime; d.hitThisLunge = false;
      }
      return 0;
    case 'lunge': {
      const v = { x: d.dir.x * DRIFTER.lungeSpeed, y: d.dir.y * DRIFTER.lungeSpeed, z: d.dir.z * DRIFTER.lungeSpeed };
      const wall = moveDrifter(d, v, dt, world);
      let dmg = 0;
      if (!d.hitThisLunge && touches(d, t)) { d.hitThisLunge = true; dmg = DRIFTER.damage; }
      if (d.timer <= 0 || wall || d.hitThisLunge) { d.mode = 'recover'; d.timer = DRIFTER.recover; }
      return dmg;
    }
    case 'recover':
      if (d.timer <= 0) d.mode = 'chase';
      return 0;
  }
}

// ---------- Shard (stationary crystal, fires slow bolts) ----------
export const SHARD = { radius: 0.5, health: 60, range: 24, interval: 1.8, firstDelay: 0.8, boltSpeed: 9, boltRadius: 0.18, damage: 10, boltLife: 4 };

export interface Bolt { pos: Vec3; vel: Vec3; life: number }

export function newShard(id: number, pos: Vec3): Drifter {
  return { ...newDrifter(id, pos), kind: 'shard', health: SHARD.health };
}

export function radiusOf(e: Drifter): number {
  return e.kind === 'shard' ? SHARD.radius : DRIFTER.radius;
}

/** Shard: wakes on sight, then fires a bolt every interval while it sees the player. */
export function updateShard(e: Drifter, t: Target, world: Box[], dt: number): Bolt | null {
  if (e.mode === 'dead') return null;
  e.bob += dt;
  const to = { x: t.center.x - e.pos.x, y: t.center.y - e.pos.y, z: t.center.z - e.pos.z };
  const dist = Math.hypot(to.x, to.y, to.z);
  const sees = dist < SHARD.range && lineOfSight(e.pos, t.center, world);
  if (e.mode === 'idle') {
    if (sees) { e.mode = 'chase'; e.timer = SHARD.firstDelay; }
    return null;
  }
  e.timer -= dt;
  if (e.timer > 0 || !sees) return null;
  e.timer = SHARD.interval;
  const s = SHARD.boltSpeed / dist;
  const start = { x: e.pos.x + to.x / dist * (SHARD.radius + 0.2), y: e.pos.y + to.y / dist * (SHARD.radius + 0.2), z: e.pos.z + to.z / dist * (SHARD.radius + 0.2) };
  return { pos: start, vel: { x: to.x * s, y: to.y * s, z: to.z * s }, life: SHARD.boltLife };
}

/** Move a bolt. Returns 'hit' (damage player), 'gone' (wall/expired) or 'fly'. */
export function updateBolt(b: Bolt, t: Target, world: Box[], dt: number): 'hit' | 'gone' | 'fly' {
  b.life -= dt;
  b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.pos.z += b.vel.z * dt;
  const cy = Math.max(t.feet.y, Math.min(b.pos.y, t.feet.y + t.height));
  if (Math.hypot(b.pos.x - t.feet.x, b.pos.y - cy, b.pos.z - t.feet.z) < t.radius + SHARD.boltRadius) return 'hit';
  const r = SHARD.boltRadius;
  const bb = { min: { x: b.pos.x - r, y: b.pos.y - r, z: b.pos.z - r }, max: { x: b.pos.x + r, y: b.pos.y + r, z: b.pos.z + r } };
  if (b.life <= 0 || world.some(w => overlaps(bb, w))) return 'gone';
  return 'fly';
}

export function damageDrifter(d: Drifter, amount: number): void {
  if (d.mode === 'dead') return;
  d.health -= amount;
  if (d.health <= 0) { d.health = 0; d.mode = 'dead'; }
  else if (d.mode === 'idle') d.mode = 'chase'; // getting hit wakes it up
}

// ---------- Weapons ----------
export type WeaponId = 'wrench' | 'nailer';

export const WEAPONS = {
  wrench: { damage: 25, range: 1.7, cooldown: 0.5 },
  nailer: { damage: 12, range: 80, cooldown: 0.16, mag: 12, reload: 1.4, maxReserve: 96 },
};

export interface Arsenal {
  current: WeaponId;
  has: Record<WeaponId, boolean>;
  mag: number;
  reserve: number;
  cooldown: number;
  reloading: number;   // seconds left, 0 = not reloading
}

export function newArsenal(hasNailer = true): Arsenal {
  return { current: 'wrench', has: { wrench: true, nailer: hasNailer }, mag: 12, reserve: 36, cooldown: 0, reloading: 0 };
}

export function giveNailer(a: Arsenal): void {
  a.has.nailer = true;
  a.current = 'nailer'; a.cooldown = 0.3; a.reloading = 0;
}

export function tickArsenal(a: Arsenal, dt: number): void {
  a.cooldown = Math.max(0, a.cooldown - dt);
  if (a.reloading > 0) {
    a.reloading -= dt;
    if (a.reloading <= 0) {
      a.reloading = 0;
      const take = Math.min(WEAPONS.nailer.mag - a.mag, a.reserve);
      a.mag += take; a.reserve -= take;
    }
  }
}

export function switchWeapon(a: Arsenal, w: WeaponId): void {
  if (!a.has[w] || a.current === w) return;
  a.current = w; a.reloading = 0; a.cooldown = 0.25;
}

export function startReload(a: Arsenal): boolean {
  if (a.current !== 'nailer' || a.reloading > 0 || a.mag >= WEAPONS.nailer.mag || a.reserve <= 0) return false;
  a.reloading = WEAPONS.nailer.reload;
  return true;
}

export interface ShotResult { fired: boolean; hitEnemy?: number; hitDist?: number; empty?: boolean }

/** Fire the current weapon along a ray. Applies damage to enemies. */
export function fire(a: Arsenal, r: Ray, enemies: Drifter[], world: Box[]): ShotResult {
  if (a.cooldown > 0 || a.reloading > 0) return { fired: false };
  const w = a.current;
  if (w === 'nailer') {
    if (a.mag <= 0) { a.cooldown = 0.25; startReload(a); return { fired: false, empty: true }; }
    a.mag--;
  }
  const spec = WEAPONS[w];
  a.cooldown = spec.cooldown;
  const wallT = worldHit(r, world);
  let best = Math.min(spec.range, wallT), hit: Drifter | undefined;
  for (const e of enemies) {
    if (e.mode === 'dead') continue;
    const t = raySphere(r, e.pos, radiusOf(e) + (w === 'wrench' ? 0.2 : 0.05));
    if (t < best) { best = t; hit = e; }
  }
  if (hit) damageDrifter(hit, spec.damage);
  if (w === 'nailer' && a.mag === 0) startReload(a);
  return { fired: true, hitEnemy: hit?.id, hitDist: hit ? best : (wallT <= spec.range ? wallT : undefined) };
}
