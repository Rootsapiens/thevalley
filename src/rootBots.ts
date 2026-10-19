// Root walkers and the spark caster: the rules of the village's opt-in combat sandbox (?arena=1, src/arena.ts).
// Living roots that walk (studio/world/world-bible.md §4): what the roots take turns to wood, so a walker is bark and
// root with no blood; an electric shock forces the roots back for a moment, and when the current stops they come back
// at 1 m/s. Every attack has a tell: a creak and falling dust 0.6 s before a lash that reaches 4 m at 6 m/s.
// One finite state machine per walker (dormant, wake, stalk, tell, lash, recover, flinch, retreat, dead) with cached
// line of sight, seek/arrive/separation steering and at most two attackers at once. The pose the figure batch draws
// (src/rootFigures.ts) comes from the same state, and the lash and the hit volumes are read off that pose, so what you
// see is what hits you and what you can hit. Pure: no Three.js, no allocation in the tick.
import { raySphere, type Ray } from './combat';
import type { Box, Ground, Vec3 } from './physics';

export const ROOT = {
  max: 6,              // walkers the figure batch holds
  radius: 0.4,         // collision radius against the world and the player
  health: 100,
  sight: 16,           // a dormant walker wakes when it sees the player this close
  hear: 12,            // ... or when the caster fires this close
  wake: 0.8,           // uprooting, s
  speed: 1.8,          // stalking, m/s (Lorenzo walks 3, jogs 6)
  back: 1.0,           // canon: after a shock the roots come back at 1 m/s ...
  backTime: 2.5,       // ... for this long
  turn: 3.5,           // rad/s
  strike: 3.4,         // the tell starts inside this distance (feet to feet), inside the reach
  reach: 4.0,          // canon: a lash reaches 4 m (from the shoulder)
  lashSpeed: 6.0,      // canon: and strikes at 6 m/s
  tell: 0.6,           // canon: a creak and falling dust 0.6 s before it strikes
  recover: 0.8,        // standing open after a lash
  retract: 0.35,       // the lash pulls back in this long
  damage: 15,          // per lash
  lashR: 0.3,          // lash tip radius against the player
  maxAttackers: 2,     // at most this many in tell or lash at once; the rest hold outside the reach
  flinch: 0.3,         // stagger after a shock (it cancels a tell or a lash)
  knock: 2.4,          // knock-back speed of a shock, m/s, decaying over the flinch
  retreat: 1.4,        // the strong shock (first time under half health) drives it back this long
  retreatSpeed: 2.4,
  separation: 1.4,     // walkers keep this far apart
  losEvery: 0.2,       // line of sight is re-tested this often per walker (staggered by id)
  fall: 0.9,           // death: the roots let go and the body topples ...
  sink: 2.2,           // ... and sinks into the ground over this long
  dormantSink: 0.55,   // rooted: this deep in the ground, hunched
  step: 0.45,          // kerbs and door steps lower than this do not block a walker
};

/** The walker's rest frame (feet at the origin, facing -Z, its right is +X), shared with the figure shader. */
export const RIG = {
  hip: 0.95,                       // torso pivot height (on the axis)
  shoulder: { x: 0.28, y: 1.5 },   // right shoulder; the left mirrors x
  leg: { x: 0.14, y: 0.92 },       // right hip joint; the left mirrors x
  arm: 0.78,                       // shoulder to the finger roots, along -Y at rest (where the lash leaves the hand)
};
/** Hit volumes in the rest frame: legs, belly, chest, head (the last three turn with the torso), and the knot in the
 *  chest that glows and takes double damage. */
const BODY = [
  { y: 0.55, z: 0, r: 0.34, torso: false },
  { y: 1.08, z: 0, r: 0.3, torso: true },
  { y: 1.4, z: 0, r: 0.3, torso: true },
  { y: 1.78, z: -0.02, r: 0.26, torso: true },
];
export const KNOT = { y: 1.33, z: -0.25, r: 0.13 };
/** The torso while the lash is out: leaning in, the right shoulder forward. */
const STRIKE = { lean: -0.22, twist: 0.3 };

export type BotMode = 'dormant' | 'wake' | 'stalk' | 'tell' | 'lash' | 'recover' | 'flinch' | 'retreat' | 'dead';
export type BotEventType = 'wake' | 'tell' | 'lash' | 'hit' | 'flinch' | 'retreat' | 'dead';
export interface BotEvent { type: BotEventType; id: number; damage: number }

export interface RootBot {
  id: number;
  x: number; y: number; z: number;   // feet
  yaw: number;                       // facing; forward is (-sin yaw, -cos yaw), as the camera
  scale: number;
  vx: number; vz: number;            // walking velocity this tick (walk cycle)
  kx: number; kz: number;            // knock-back velocity of the last shock
  health: number;
  mode: BotMode;
  t: number;                         // time left in the mode; time since death when dead
  age: number;                       // seconds awake or rooted (sway, shudder)
  rise: number;                      // 0 rooted in the ground .. 1 standing
  stride: number;                    // walk cycle phase, rad
  sees: boolean; losT: number;       // cached line of sight to the player, time to the next test
  dx: number; dy: number; dz: number; // lash direction (world, unit), fixed when the tell ends
  ap: number; ay: number;            // right arm pitch and yaw that lay it along the lash
  lash: number;                      // lash length from the shoulder, m
  struck: boolean;                   // this lash has hit
  retreated: boolean;                // the strong shock has happened
  pending: boolean;                  // retreat after this flinch
  back: number;                      // seconds of slow return left
  flash: number;                     // electric flash 0..1
  detour: number;                    // seconds of sidestepping round an obstacle left (sign = side)
}

/** The player as the walkers see him: feet, radius, height. */
export interface Prey { x: number; y: number; z: number; r: number; h: number }
export interface BotWorld {
  /** True when nothing solid lies between the two points. */
  los(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean;
  /** Solid boxes near (x, z) for a walker's own movement (no walkers in it). */
  near(x: number, z: number): Box[];
  ground: Ground;
}

// ---------- The arena: where Lorenzo starts and where the walkers grow (the east half of the square, clear of NPCs) ----------
export const ARENA_START = { x: 29, y: 0.01, z: 50, yaw: -Math.PI / 2, pitch: -0.03 };
export const ROOT_SPAWNS: readonly { x: number; z: number; yaw: number; scale: number }[] = [
  { x: 40, z: 47, yaw: Math.PI / 2, scale: 1.0 },
  { x: 37.5, z: 57.5, yaw: 2.2, scale: 0.93 },
  { x: 44.5, z: 53.5, yaw: 1.9, scale: 1.08 },
  { x: 46, z: 41, yaw: 1.2, scale: 0.97 },
];

export function newBot(id: number, x: number, z: number, yaw: number, scale: number, ground: Ground): RootBot {
  return {
    id, x, y: ground(x, z), z, yaw, scale, vx: 0, vz: 0, kx: 0, kz: 0, health: ROOT.health, mode: 'dormant', t: 0, age: 0, rise: 0,
    stride: 0, sees: false, losT: (id * 0.05) % ROOT.losEvery, dx: 0, dy: 0, dz: -1, ap: 0, ay: 0, lash: 0, struck: false,
    retreated: false, pending: false, back: 0, flash: 0, detour: 0,
  };
}
export const newBots = (ground: Ground): RootBot[] => ROOT_SPAWNS.map((s, i) => newBot(i, s.x, s.z, s.yaw, s.scale, ground));

// ---------- Pose ----------
export interface Pose {
  x: number; y: number; z: number; yaw: number; scale: number;
  lean: number; twist: number; roll: number; topple: number;   // torso about the hip (lean > 0 rears back); body about the feet
  armL: number; armR: number; armRYaw: number; spreadL: number; spreadR: number;   // arm swing > 0 is forward
  legL: number; legR: number;
  lash: number;    // lash length from the shoulder, rest units
  glow: number; flash: number;
}
export const newPose = (): Pose => ({
  x: 0, y: 0, z: 0, yaw: 0, scale: 1, lean: 0, twist: 0, roll: 0, topple: 0, armL: 0, armR: 0, armRYaw: 0, spreadL: 0, spreadR: 0,
  legL: 0, legR: 0, lash: 0, glow: 0, flash: 0,
});

// Rotations as in the shader (three's conventions): rotY(a) turns -Z towards -X, rotX(a) turns -Y towards -Z.
function rotX(a: number, v: Vec3) { const c = Math.cos(a), s = Math.sin(a), y = v.y; v.y = c * y - s * v.z; v.z = s * y + c * v.z; }
function rotY(a: number, v: Vec3) { const c = Math.cos(a), s = Math.sin(a), x = v.x; v.x = c * x + s * v.z; v.z = -s * x + c * v.z; }
function rotZ(a: number, v: Vec3) { const c = Math.cos(a), s = Math.sin(a), x = v.x; v.x = c * x - s * v.y; v.y = s * x + c * v.y; }
const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A rest-frame point of the body to the world: scale, topple about the feet, yaw, then the feet. */
export function bodyToWorld(p: Pose, v: Vec3): Vec3 {
  v.x *= p.scale; v.y *= p.scale; v.z *= p.scale;
  rotX(p.topple, v); rotY(p.yaw, v);
  v.x += p.x; v.y += p.y; v.z += p.z;
  return v;
}
/** A rest-frame point carried by the torso: roll, lean and twist about the hip, then the body. */
export function torsoToWorld(p: Pose, x: number, y: number, z: number, out: Vec3): Vec3 {
  out.x = x; out.y = y - RIG.hip; out.z = z;
  rotZ(p.roll, out); rotX(p.lean, out); rotY(p.twist, out);
  out.y += RIG.hip;
  return bodyToWorld(p, out);
}
/** A rest-frame point on the right arm (or the lash): spread, swing and yaw about the shoulder, then the torso. */
export function armRToWorld(p: Pose, x: number, y: number, z: number, out: Vec3): Vec3 {
  out.x = x - RIG.shoulder.x; out.y = y - RIG.shoulder.y; out.z = z;
  rotZ(p.spreadR, out); rotX(p.armR, out); rotY(p.armRYaw, out);
  return torsoToWorld(p, out.x + RIG.shoulder.x, out.y + RIG.shoulder.y, out.z, out);
}
/** The lash tip as drawn: down the right arm's axis from the shoulder, never shorter than the arm. */
export function lashTip(p: Pose, out: Vec3): Vec3 {
  return armRToWorld(p, RIG.shoulder.x, RIG.shoulder.y - Math.max(p.lash, RIG.arm), 0, out);
}

/** What the figure batch draws for this walker now. No allocation. */
export function botPose(b: RootBot, o: Pose): Pose {
  const a = b.age, s = b.stride, ph = b.id * 1.7;
  const walk = Math.min(1, Math.hypot(b.vx, b.vz) / ROOT.speed);
  let lean = -0.18, twist = 0, roll = 0.03 * Math.sin(a * 0.9 + ph) + 0.07 * Math.sin(s) * walk, topple = 0;
  let lift = 0.05 * Math.abs(Math.cos(s)) * walk;
  let armL = 0.15 - 0.35 * Math.sin(s) * walk, armR = 0.15 + 0.35 * Math.sin(s) * walk, armRYaw = 0, spreadL = -0.12, spreadR = 0.12;
  const legL = 0.5 * Math.sin(s) * walk;
  let glow = 0.4 + 0.12 * Math.sin(a * 2.3 + ph);
  switch (b.mode) {
    case 'tell': {   // rears back, the lash arm raised up and out (it reads from the front), a shudder, the knot flares
      const u = Math.min(1, (1 - b.t / ROOT.tell) / 0.45), k = 1 - (1 - u) * (1 - u) * (1 - u);   // up fast, then held
      lean = mix(lean, 0.3, k); twist = -0.2 * k; roll += 0.06 * k * Math.sin(a * 57);
      armR = mix(armR, -2.64, k); spreadR = mix(spreadR, 0.75, k); armL = mix(armL, 0.7, k); glow = mix(glow, 1.1, k);
      break;
    }
    case 'lash':
      lean = STRIKE.lean; twist = STRIKE.twist; roll = 0; armR = b.ap; armRYaw = b.ay; spreadR = 0; armL = -0.5; glow = 1.3;
      break;
    case 'recover': {
      const k = ease(b.t / ROOT.recover);
      lean = mix(lean, STRIKE.lean, k); twist = STRIKE.twist * k; roll *= 1 - k; armR = mix(armR, b.ap, k); armRYaw = b.ay * k;
      spreadR = mix(spreadR, 0, k); armL = mix(armL, -0.5, k); glow = mix(glow, 1.3, k);
      break;
    }
    case 'flinch': {   // the current through it: thrown back, arms flung out, a fast shake
      const k = b.t / ROOT.flinch;
      lean = mix(lean, 0.55, k); twist = 0.12 * k * Math.sin(a * 53); roll += 0.12 * k * Math.sin(a * 71);
      armL = mix(armL, -0.7, k); armR = mix(armR, -0.7, k); spreadL -= 0.9 * k; spreadR += 0.9 * k; glow = mix(glow, 0.15, k);
      break;
    }
    case 'dead': {     // the roots let go: it topples back, then sinks into the ground
      const f = ease(b.t / ROOT.fall);
      topple = 1.45 * f; lean = mix(lean, 0.4, f); armL = mix(armL, -1.3, f); armR = mix(armR, -1.1, f); spreadL -= 0.5 * f; spreadR += 0.6 * f;
      glow *= Math.max(0, 1 - b.t * 2.5);
      lift -= 2.6 * Math.max(0, b.t - ROOT.fall * 0.6) / ROOT.sink;
      break;
    }
  }
  const sunk = 1 - ease(b.rise);
  o.x = b.x; o.y = b.y + lift - ROOT.dormantSink * sunk; o.z = b.z; o.yaw = b.yaw; o.scale = b.scale;
  o.lean = mix(lean, -0.62, sunk); o.twist = twist; o.roll = roll; o.topple = topple;
  o.armL = mix(armL, 0.4, sunk); o.armR = mix(armR, 0.4, sunk); o.armRYaw = armRYaw; o.spreadL = spreadL; o.spreadR = spreadR;
  o.legL = legL * (1 - sunk); o.legR = -legL * (1 - sunk);
  o.lash = b.lash / b.scale; o.glow = glow * mix(1, 0.35, sunk); o.flash = b.flash;
  return o;
}

/** Gone: dead and sunk out of sight. */
export const gone = (b: RootBot) => b.mode === 'dead' && b.t > ROOT.fall * 0.6 + ROOT.sink;

// ---------- Simulation ----------
const _p = newPose(), _o: Vec3 = { x: 0, y: 0, z: 0 }, _d: Vec3 = { x: 0, y: 0, z: 0 };
const attackers = (bots: readonly RootBot[]) => { let n = 0; for (const o of bots) if (o.mode === 'tell' || o.mode === 'lash') n++; return n; };

function turnTo(b: RootBot, target: number, rate: number, dt: number) {
  const d = wrap(target - b.yaw), m = rate * dt;
  b.yaw = wrap(b.yaw + Math.max(-m, Math.min(m, d)));
}
function blockedAt(b: RootBot, x: number, z: number, near: readonly Box[]): boolean {
  const r = ROOT.radius, y0 = b.y + ROOT.step, y1 = b.y + 1.9;
  for (const s of near) if (x - r < s.max.x && x + r > s.min.x && z - r < s.max.z && z + r > s.min.z && y0 < s.max.y && y1 > s.min.y) return true;
  return false;
}
/** Closer to the player than a walker may stand, and closer than it was. */
function into(p: Prey, x: number, z: number, d0: number): boolean {
  const d = Math.hypot(p.x - x, p.z - z);
  return d < ROOT.radius + p.r + 0.05 && d < d0;
}
/** Axis-separated move (slides along walls), never into the player. Returns the distance moved. */
function moveBot(b: RootBot, vx: number, vz: number, p: Prey, w: BotWorld, dt: number): number {
  const near = w.near(b.x, b.z), x0 = b.x, z0 = b.z, d0 = Math.hypot(p.x - x0, p.z - z0);
  let x = x0 + vx * dt;
  if (blockedAt(b, x, z0, near) || into(p, x, z0, d0)) x = x0;
  let z = z0 + vz * dt;
  if (blockedAt(b, x, z, near) || into(p, x, z, d0)) z = z0;
  b.x = x; b.z = z; b.vx = (x - x0) / dt; b.vz = (z - z0) / dt;
  const moved = Math.hypot(x - x0, z - z0);
  b.stride += moved * 3.4;
  return moved;
}
function separation(b: RootBot, bots: readonly RootBot[], out: Vec3) {
  for (const o of bots) {
    if (o === b || o.mode === 'dead') continue;
    const ox = b.x - o.x, oz = b.z - o.z, d = Math.hypot(ox, oz);
    if (d < ROOT.separation && d > 1e-6) { const k = (1 - d / ROOT.separation) * 1.6; out.x += ox / d * k; out.z += oz / d * k; }
  }
}
/** Seek the player and arrive at the edge of the strike (or outside the reach when two already attack), keep apart. */
function stalk(b: RootBot, bots: readonly RootBot[], p: Prey, w: BotWorld, dt: number, ex: number, ez: number, dist: number) {
  const stop = attackers(bots) < ROOT.maxAttackers ? ROOT.strike * 0.75 : ROOT.reach + 0.8;
  _d.x = 0; _d.z = 0;
  if (dist > 1e-6) { const k = Math.max(-0.6, Math.min(1, (dist - stop) / 1.2)); _d.x = ex / dist * k; _d.z = ez / dist * k; }
  separation(b, bots, _d);
  if (b.detour !== 0) {   // round an obstacle: mostly sideways for a moment
    const sg = Math.sign(b.detour), tx = -_d.z * sg, tz = _d.x * sg;
    _d.x = _d.x * 0.3 + tx; _d.z = _d.z * 0.3 + tz;
    b.detour -= sg * dt; if (Math.sign(b.detour) !== sg) b.detour = 0;
  }
  const n = Math.hypot(_d.x, _d.z);
  if (n > 1) { _d.x /= n; _d.z /= n; }
  const speed = b.back > 0 ? ROOT.back : ROOT.speed, want = Math.min(1, n) * speed * dt;
  const got = moveBot(b, _d.x * speed, _d.z * speed, p, w, dt);
  if (want > 1e-4 && got < want * 0.3 && b.detour === 0) b.detour = (b.id % 2 ? 1 : -1) * 0.8;
}
/** The strike: the arm and the lash point from the right shoulder (strike pose) at the player's chest, where he is now. */
function startLash(b: RootBot, p: Prey) {
  b.mode = 'lash'; b.lash = 0; b.struck = false; b.vx = b.vz = 0;
  torsoToWorld(botPose(b, _p), RIG.shoulder.x, RIG.shoulder.y, 0, _o);
  let dx = p.x - _o.x, dy = p.y + p.h * 0.62 - _o.y, dz = p.z - _o.z;
  const n = Math.hypot(dx, dy, dz) || 1;
  dx /= n; dy /= n; dz /= n;
  b.dx = dx; b.dy = dy; b.dz = dz;
  // Undo the body yaw and the strike torso (roll and topple are 0), then solve the shoulder for -Y along the lash.
  _d.x = dx; _d.y = dy; _d.z = dz;
  rotY(-b.yaw, _d); rotY(-STRIKE.twist, _d); rotX(-STRIKE.lean, _d);
  b.ap = Math.acos(Math.max(-1, Math.min(1, -_d.y))); b.ay = Math.atan2(-_d.x, -_d.z);
}
function wakeBot(b: RootBot, ev: BotEvent[]) {
  b.mode = 'wake'; b.t = ROOT.wake;
  ev.push({ type: 'wake', id: b.id, damage: 0 });
}

/** One walker, one fixed step. Events (wake, tell, lash, hit with its damage, retreat) go to `ev`. */
export function updateBot(b: RootBot, bots: readonly RootBot[], p: Prey, w: BotWorld, dt: number, ev: BotEvent[]): void {
  if (b.mode === 'dead') { b.t += dt; b.lash = Math.max(0, b.lash - ROOT.reach / ROOT.retract * dt); return; }
  b.age += dt;
  b.flash = Math.max(0, b.flash - dt * 5);
  if (b.mode !== 'dormant') b.rise = Math.min(1, b.rise + dt / ROOT.wake);
  if (b.mode !== 'lash') b.lash = Math.max(0, b.lash - ROOT.reach / ROOT.retract * dt);
  const ex = p.x - b.x, ez = p.z - b.z, dist = Math.hypot(ex, ez), face = Math.atan2(-ex, -ez);
  b.losT -= dt;
  if (b.losT <= 0) {
    b.losT += ROOT.losEvery;
    b.sees = dist < 30 && w.los(b.x, b.y + 1.7 * b.scale, b.z, p.x, p.y + p.h * 0.8, p.z);
  }
  switch (b.mode) {
    case 'dormant':
      if (b.sees && dist < ROOT.sight) wakeBot(b, ev);
      break;
    case 'wake':
      b.t -= dt; turnTo(b, face, ROOT.turn * 0.5, dt);
      if (b.t <= 0) b.mode = 'stalk';
      break;
    case 'stalk':
      b.back = Math.max(0, b.back - dt);
      if (dist < ROOT.strike && b.sees && b.rise >= 1 && Math.abs(wrap(face - b.yaw)) < 0.6 && attackers(bots) < ROOT.maxAttackers) {
        b.mode = 'tell'; b.t = ROOT.tell; b.vx = b.vz = 0;
        ev.push({ type: 'tell', id: b.id, damage: 0 });
        break;
      }
      stalk(b, bots, p, w, dt, ex, ez, dist);
      turnTo(b, face, ROOT.turn, dt);
      break;
    case 'tell':
      b.t -= dt; turnTo(b, face, ROOT.turn * 0.6, dt);
      if (b.t <= 0) { startLash(b, p); ev.push({ type: 'lash', id: b.id, damage: 0 }); }
      break;
    case 'lash': {
      const from = b.lash;
      b.lash = Math.min(ROOT.reach, b.lash + ROOT.lashSpeed * dt);
      if (!b.struck) {
        torsoToWorld(botPose(b, _p), RIG.shoulder.x, RIG.shoulder.y, 0, _o);
        const n = Math.max(1, Math.ceil((b.lash - from) / 0.1));   // swept: the tip never skips the player
        for (let i = 1; i <= n && !b.struck; i++) {
          const L = from + (b.lash - from) * i / n, tx = _o.x + b.dx * L, ty = _o.y + b.dy * L, tz = _o.z + b.dz * L;
          const cy = Math.max(p.y, Math.min(ty, p.y + p.h));
          if (Math.hypot(tx - p.x, ty - cy, tz - p.z) < p.r + ROOT.lashR) { b.struck = true; ev.push({ type: 'hit', id: b.id, damage: ROOT.damage }); }
        }
      }
      if (b.struck || b.lash >= ROOT.reach) { b.mode = 'recover'; b.t = ROOT.recover; }
      break;
    }
    case 'recover':
      b.t -= dt;
      if (b.t <= 0) b.mode = 'stalk';
      break;
    case 'flinch': {
      b.t -= dt;
      const k = Math.max(0, b.t / ROOT.flinch);
      moveBot(b, b.kx * k, b.kz * k, p, w, dt);
      if (b.t <= 0) {
        if (b.pending) { b.pending = false; b.mode = 'retreat'; b.t = ROOT.retreat; ev.push({ type: 'retreat', id: b.id, damage: 0 }); }
        else b.mode = 'stalk';
      }
      break;
    }
    case 'retreat': {
      b.t -= dt;
      _d.x = dist > 1e-6 ? -ex / dist : 0; _d.z = dist > 1e-6 ? -ez / dist : 0;
      separation(b, bots, _d);
      const n = Math.hypot(_d.x, _d.z) || 1;
      moveBot(b, _d.x / n * ROOT.retreatSpeed, _d.z / n * ROOT.retreatSpeed, p, w, dt);
      turnTo(b, face, ROOT.turn, dt);
      if (b.t <= 0) { b.mode = 'stalk'; b.back = ROOT.backTime; }
      break;
    }
  }
  b.y = w.ground(b.x, b.z);
}

export function tickBots(bots: readonly RootBot[], p: Prey, w: BotWorld, dt: number, ev: BotEvent[]): void {
  for (const b of bots) updateBot(b, bots, p, w, dt, ev);
}

/** An electric hit: the damage, the flash, and the roots forced back (it cancels a tell or a lash; the first time it
 *  drops under half health it retreats, then comes back at 1 m/s). Returns true when it kills. */
export function shockBot(b: RootBot, damage: number, dirX: number, dirZ: number, ev: BotEvent[]): boolean {
  if (b.mode === 'dead') return false;
  b.health = Math.max(0, b.health - damage);
  b.flash = 1;
  b.vx = b.vz = 0;
  if (b.health <= 0) {
    b.mode = 'dead'; b.t = 0;
    ev.push({ type: 'dead', id: b.id, damage });
    return true;
  }
  const n = Math.hypot(dirX, dirZ) || 1;
  b.kx = dirX / n * ROOT.knock; b.kz = dirZ / n * ROOT.knock;
  b.pending = !b.retreated && b.health <= ROOT.health / 2;
  if (b.pending) b.retreated = true;
  b.mode = 'flinch'; b.t = ROOT.flinch;
  ev.push({ type: 'flinch', id: b.id, damage });
  return false;
}

/** The caster's crack wakes the dormant walkers within ROOT.hear of the shooter. */
export function hearShot(bots: readonly RootBot[], x: number, z: number, ev: BotEvent[]): void {
  for (const b of bots) if (b.mode === 'dormant' && Math.hypot(b.x - x, b.z - z) < ROOT.hear) wakeBot(b, ev);
}

// ---------- The spark caster: a fence energiser and a jar capacitor wired to two copper prongs, cranked to charge ----------
export const CASTER = { damage: 25, knot: 2, range: 70, cooldown: 0.3, mag: 6, reserve: 36, reload: 1.3 };
export interface Caster { mag: number; reserve: number; cooldown: number; reloading: number }
export const newCaster = (): Caster => ({ mag: CASTER.mag, reserve: CASTER.reserve, cooldown: 0, reloading: 0 });

/** Cooldown and the crank. Returns true on the tick the jar is charged again. */
export function tickCaster(c: Caster, dt: number): boolean {
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.reloading <= 0) return false;
  c.reloading -= dt;
  if (c.reloading > 0) return false;
  c.reloading = 0;
  const take = Math.min(CASTER.mag - c.mag, c.reserve);
  c.mag += take; c.reserve -= take;
  return true;
}
/** Starts cranking (R, or by itself after the last charge). False when full, empty of cells, or already cranking. */
export function reloadCaster(c: Caster): boolean {
  if (c.reloading > 0 || c.mag >= CASTER.mag || c.reserve <= 0) return false;
  c.reloading = CASTER.reload;
  return true;
}

export interface Shot { fired: boolean; empty: boolean; bot: number; knot: boolean; killed: boolean; t: number }
export const newShot = (): Shot => ({ fired: false, empty: false, bot: -1, knot: false, killed: false, t: Infinity });
const _hit = { t: Infinity, knot: false }, _q = newPose(), _c: Vec3 = { x: 0, y: 0, z: 0 };

/** The first surface of a walker along the ray (Infinity when none), and whether it is the knot. Read off the pose. */
export function rayBot(r: Ray, b: RootBot, out: { t: number; knot: boolean }): { t: number; knot: boolean } {
  out.t = Infinity; out.knot = false;
  if (b.mode === 'dead') return out;
  botPose(b, _q);
  for (const s of BODY) {
    if (s.torso) torsoToWorld(_q, 0, s.y, s.z, _c);
    else { _c.x = 0; _c.y = s.y; _c.z = s.z; bodyToWorld(_q, _c); }
    out.t = Math.min(out.t, raySphere(r, _c, s.r * b.scale));
  }
  const t = raySphere(r, torsoToWorld(_q, 0, KNOT.y, KNOT.z, _c), KNOT.r * b.scale);
  if (t <= out.t && t < Infinity) { out.t = t; out.knot = true; }
  return out;
}

/** Fires the caster along the ray: hitscan against the walkers, stopped by the world at `wallT` (from the caller's
 *  broadphase). Applies the shock. A spent jar clicks and starts the crank. */
export function castShot(c: Caster, r: Ray, bots: readonly RootBot[], wallT: number, ev: BotEvent[], out: Shot): Shot {
  out.fired = out.empty = out.knot = out.killed = false; out.bot = -1; out.t = Infinity;
  if (c.cooldown > 0 || c.reloading > 0) return out;
  if (c.mag <= 0) { out.empty = true; c.cooldown = 0.25; reloadCaster(c); return out; }
  c.mag--; c.cooldown = CASTER.cooldown; out.fired = true;
  let best = Math.min(wallT, CASTER.range), hit: RootBot | null = null, knot = false;
  for (const b of bots) {
    rayBot(r, b, _hit);
    if (_hit.t < best) { best = _hit.t; hit = b; knot = _hit.knot; }
  }
  out.t = best;
  if (hit) { out.bot = hit.id; out.knot = knot; out.killed = shockBot(hit, CASTER.damage * (knot ? CASTER.knot : 1), r.d.x, r.d.z, ev); }
  if (c.mag === 0) reloadCaster(c);
  return out;
}

/** Slab test of the segment a + s d, s in [0, 1], against a box: the entry fraction, 0 when it starts inside, or
 *  Infinity. No allocation (the village's broadphase runs it for line of sight and the hitscan). */
export function segmentBox(ax: number, ay: number, az: number, dx: number, dy: number, dz: number, b: Box): number {
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-12) { if (ax < b.min.x || ax > b.max.x) return Infinity; }
  else {
    let u = (b.min.x - ax) / dx, v = (b.max.x - ax) / dx;
    if (u > v) { const w = u; u = v; v = w; }
    if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity;
  }
  if (Math.abs(dy) < 1e-12) { if (ay < b.min.y || ay > b.max.y) return Infinity; }
  else {
    let u = (b.min.y - ay) / dy, v = (b.max.y - ay) / dy;
    if (u > v) { const w = u; u = v; v = w; }
    if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity;
  }
  if (Math.abs(dz) < 1e-12) { if (az < b.min.z || az > b.max.z) return Infinity; }
  else {
    let u = (b.min.z - az) / dz, v = (b.max.z - az) / dz;
    if (u > v) { const w = u; u = v; v = w; }
    if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity;
  }
  return t0;
}
