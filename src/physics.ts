// Pure movement + collision. No Three.js here so it is unit-testable.
// Solids are axis-aligned boxes. An optional terrain sampler (height of the ground under x, z) adds smooth
// slopes: the player walks up anything flatter than MAX_SLOPE, slides off anything steeper, and stays glued
// to the ground (and to stair treads) on the way down. No allocation per step.

export interface Vec3 { x: number; y: number; z: number }
export interface Box { min: Vec3; max: Vec3 }
/** Terrain height under (x, z). Must be cheap and allocation-free: it is sampled a few times per step. */
export type Ground = (x: number, z: number) => number;

export interface Input {
  forward: number; // -1..1
  strafe: number;  // -1..1 (right positive)
  jump: boolean;
  crouch: boolean;
  walk: boolean;
  yaw: number;     // radians
  /** Scales the target ground speed (1 when absent): pushing a prop slows the player to the prop's pace. */
  speedScale?: number;
}

export interface PlayerState {
  pos: Vec3;       // feet position
  vel: Vec3;
  onGround: boolean;
  crouched: boolean;
  /** On terrain steeper than the walkable limit: no friction, no jump, glued while it slides down the fall line. */
  sliding?: boolean;
}

export const TUNING = {
  radius: 0.35,
  standHeight: 1.8,
  crouchHeight: 1.0,
  eyeOffset: 0.16,      // eye is this far below head
  runSpeed: 6.0,        // m/s ground target
  walkSpeed: 3.0,
  crouchSpeed: 2.2,
  groundAccel: 10,      // quake-style accel factor
  airAccel: 1.5,
  airSpeedCap: 1.2,     // quake-style air wish cap (enables air strafing)
  friction: 6,
  stopSpeed: 1.5,
  gravity: 20,
  jumpSpeed: 6.8,
  stepHeight: 0.45,
  maxSlope: 40,         // degrees: steepest terrain the player can walk up or stand on
};
const SLOPE_TAN = Math.tan(TUNING.maxSlope * Math.PI / 180);

export function newPlayer(pos: Vec3): PlayerState {
  return { pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, onGround: false, crouched: false };
}

export function height(p: PlayerState): number {
  return p.crouched ? TUNING.crouchHeight : TUNING.standHeight;
}

export function eyeHeight(p: PlayerState): number {
  return height(p) - TUNING.eyeOffset;
}

const _pb: Box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
function playerBox(x: number, y: number, z: number, h: number, out: Box = _pb): Box {
  const r = TUNING.radius;
  out.min.x = x - r; out.min.y = y; out.min.z = z - r;
  out.max.x = x + r; out.max.y = y + h; out.max.z = z + r;
  return out;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.min.x < b.max.x && a.max.x > b.min.x &&
         a.min.y < b.max.y && a.max.y > b.min.y &&
         a.min.z < b.max.z && a.max.z > b.min.z;
}

function blocked(x: number, y: number, z: number, h: number, world: Box[]): boolean {
  const pb = playerBox(x, y, z, h);
  for (const b of world) if (overlaps(pb, b)) return true;
  return false;
}

/** Move along one axis, resolving against the world. Returns true if hit. */
function sweepAxis(p: PlayerState, axis: 'x' | 'y' | 'z', delta: number, world: Box[]): boolean {
  if (delta === 0) return false;
  const h = height(p);
  p.pos[axis] += delta;
  const pb = playerBox(p.pos.x, p.pos.y, p.pos.z, h);
  let hit = false;
  for (const b of world) {
    if (!overlaps(pb, b)) continue;
    hit = true;
    const r = axis === 'y' ? 0 : TUNING.radius;
    if (axis === 'y') {
      p.pos.y = delta > 0 ? b.min.y - h - 1e-4 : b.max.y + 1e-4;
    } else if (delta > 0) {
      p.pos[axis] = b.min[axis] - r - 1e-4;
    } else {
      p.pos[axis] = b.max[axis] + r + 1e-4;
    }
    pb.min[axis] = p.pos[axis] - r; pb.max[axis] = p.pos[axis] + (axis === 'y' ? h : r);
  }
  return hit;
}

const _trial: PlayerState = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: false, crouched: false };

function horizontalMove(p: PlayerState, dx: number, dz: number, world: Box[]): void {
  const sx0 = p.pos.x, sy0 = p.pos.y, sz0 = p.pos.z;
  const hitX = sweepAxis(p, 'x', dx, world);
  const hitZ = sweepAxis(p, 'z', dz, world);
  if (!(hitX || hitZ) || !p.onGround) {
    if (hitX) p.vel.x = 0;
    if (hitZ) p.vel.z = 0;
    return;
  }
  // Try a step-up: lift, move, drop back down.
  const h = height(p);
  if (!blocked(sx0, sy0 + TUNING.stepHeight, sz0, h, world)) {
    const trial = _trial;
    trial.pos.x = sx0; trial.pos.y = sy0 + TUNING.stepHeight; trial.pos.z = sz0;
    trial.crouched = p.crouched;
    const sx = sweepAxis(trial, 'x', dx, world);
    const sz = sweepAxis(trial, 'z', dz, world);
    sweepAxis(trial, 'y', -TUNING.stepHeight, world);
    const gained = Math.hypot(trial.pos.x - sx0, trial.pos.z - sz0);
    const plain = Math.hypot(p.pos.x - sx0, p.pos.z - sz0);
    if (gained > plain + 1e-3) {
      p.pos.x = trial.pos.x; p.pos.y = trial.pos.y; p.pos.z = trial.pos.z;
      if (sx) p.vel.x = 0;
      if (sz) p.vel.z = 0;
      return;
    }
  }
  if (hitX) p.vel.x = 0;
  if (hitZ) p.vel.z = 0;
}

function applyFriction(p: PlayerState, dt: number): void {
  const speed = Math.hypot(p.vel.x, p.vel.z);
  if (speed < 1e-4) { p.vel.x = 0; p.vel.z = 0; return; }
  const control = Math.max(speed, TUNING.stopSpeed);
  const drop = control * TUNING.friction * dt;
  const scale = Math.max(speed - drop, 0) / speed;
  p.vel.x *= scale; p.vel.z *= scale;
}

function accelerate(p: PlayerState, wx: number, wz: number, wishSpeed: number, accel: number, dt: number, cap: number): void {
  const capped = Math.min(wishSpeed, cap);
  const current = p.vel.x * wx + p.vel.z * wz;
  const add = capped - current;
  if (add <= 0) return;
  const amount = Math.min(accel * wishSpeed * dt, add);
  p.vel.x += amount * wx; p.vel.z += amount * wz;
}

/** True when the terrain rises from (x0, z0) to (x1, z1) more steeply than the walkable limit, above the feet. */
function tooSteep(ground: Ground, feet: number, x0: number, z0: number, x1: number, z1: number): boolean {
  const g1 = ground(x1, z1);
  if (g1 <= feet + 1e-4) return false;
  const run = Math.hypot(x1 - x0, z1 - z0);
  return g1 - Math.max(feet, ground(x0, z0)) > run * SLOPE_TAN + 1e-4;
}

/** Terrain slope limit after the box move: keep the axis that is walkable (slide along the bank), drop the other. */
function limitSlope(p: PlayerState, ground: Ground, x0: number, z0: number): void {
  const x1 = p.pos.x, z1 = p.pos.z, y = p.pos.y;
  if (!tooSteep(ground, y, x0, z0, x1, z1)) return;
  const okX = !tooSteep(ground, y, x0, z0, x1, z0), okZ = !tooSteep(ground, y, x0, z0, x0, z1);
  if (okX && (!okZ || Math.abs(x1 - x0) >= Math.abs(z1 - z0))) { p.pos.z = z0; p.vel.z = 0; return; }
  if (okZ) { p.pos.x = x0; p.vel.x = 0; return; }
  p.pos.x = x0; p.pos.z = z0; p.vel.x = 0; p.vel.z = 0;
}

/** Terrain gradient magnitude (rise per metre) at (x, z). */
export function slopeAt(ground: Ground, x: number, z: number): number {
  const e = 0.2;
  return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e);
}

export function step(p: PlayerState, input: Input, world: Box[], dt: number, ground?: Ground): void {
  // Crouch: going down is instant, standing up needs headroom.
  if (input.crouch && !p.crouched) {
    p.crouched = true;
  } else if (!input.crouch && p.crouched) {
    if (!blocked(p.pos.x, p.pos.y, p.pos.z, TUNING.standHeight, world)) p.crouched = false;
  }

  // Wish direction from yaw. Forward = -Z at yaw 0 (Three.js camera convention).
  const sin = Math.sin(input.yaw), cos = Math.cos(input.yaw);
  let wx = -sin * input.forward + cos * input.strafe;
  let wz = -cos * input.forward - sin * input.strafe;
  const len = Math.hypot(wx, wz);
  if (len > 1e-4) { wx /= len; wz /= len; } else { wx = 0; wz = 0; }
  const maxSpeed = (p.crouched ? TUNING.crouchSpeed : input.walk ? TUNING.walkSpeed : TUNING.runSpeed) * (input.speedScale ?? 1);
  const wishSpeed = len > 1e-4 ? maxSpeed : 0;

  const wasGround = p.onGround, wasSliding = !!p.sliding;
  p.sliding = false;
  let jumped = false;
  if (p.onGround) {
    if (input.jump) {
      p.vel.y = TUNING.jumpSpeed;
      p.onGround = false;
      jumped = true;
    } else {
      applyFriction(p, dt);
    }
  }
  if (p.onGround) accelerate(p, wx, wz, wishSpeed, TUNING.groundAccel, dt, Infinity);
  else accelerate(p, wx, wz, wishSpeed, TUNING.airAccel * 10, dt, TUNING.airSpeedCap);

  p.vel.y -= TUNING.gravity * dt;

  const x0 = p.pos.x, z0 = p.pos.z;
  horizontalMove(p, p.vel.x * dt, p.vel.z * dt, world);
  if (ground) limitSlope(p, ground, x0, z0);

  const falling = p.vel.y <= 0;
  const yBefore = p.pos.y;
  const hitY = sweepAxis(p, 'y', p.vel.y * dt, world);
  if (hitY) {
    p.onGround = falling;
    p.vel.y = 0;
  } else {
    // Stay glued when walking down small slopes/steps.
    p.onGround = false;
    if (falling && blocked(p.pos.x, p.pos.y - 0.05, p.pos.z, height(p), world)) p.onGround = true;
  }
  if (!ground) return;

  // Terrain: land on it, glue to it going downhill, slide off anything steeper than the limit.
  const g = ground(p.pos.x, p.pos.z);
  if (p.pos.y <= g) {
    p.pos.y = g;
    if (p.vel.y < 0) p.vel.y = 0;
    p.onGround = true;
  } else if (!p.onGround && (wasGround || wasSliding) && !jumped && falling) {
    const run = Math.hypot(p.pos.x - x0, p.pos.z - z0);
    const tan = wasSliding ? Math.max(SLOPE_TAN, slopeAt(ground, p.pos.x, p.pos.z)) : SLOPE_TAN;
    // Stair treads first (boxes within a step below), then the terrain within the walkable slope.
    const reachBox = Math.min(TUNING.stepHeight, yBefore - g);
    if (reachBox > 0.05 && blocked(p.pos.x, p.pos.y - reachBox, p.pos.z, height(p), world)) {
      sweepAxis(p, 'y', -reachBox, world);
      p.onGround = true; p.vel.y = 0;
    } else if (p.pos.y - g <= 0.06 + run * tan * 1.25) {
      p.pos.y = g; p.onGround = true; p.vel.y = 0;
    }
  }
  if (p.onGround && p.pos.y <= g + 1e-3) {
    const s = slopeAt(ground, p.pos.x, p.pos.z);
    if (s > SLOPE_TAN * 1.05) {
      // Too steep to stand on: slide down the fall line (gravity along the slope), glued to the surface.
      const e = 0.2, gx = ground(p.pos.x + e, p.pos.z) - ground(p.pos.x - e, p.pos.z), gz = ground(p.pos.x, p.pos.z + e) - ground(p.pos.x, p.pos.z - e);
      const n = Math.hypot(gx, gz) || 1, a = TUNING.gravity * s / Math.sqrt(1 + s * s) * dt;
      p.vel.x -= gx / n * a; p.vel.z -= gz / n * a;
      p.onGround = false; p.sliding = true;
    }
  }
}

export function box(x: number, y: number, z: number, sx: number, sy: number, sz: number): Box {
  return {
    min: { x: x - sx / 2, y, z: z - sz / 2 },
    max: { x: x + sx / 2, y: y + sy, z: z + sz / 2 },
  };
}
