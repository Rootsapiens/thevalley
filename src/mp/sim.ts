// Host-side multiplayer simulation. Pure (no DOM, no Three.js): the room state machine, one physics body per slot
// (src/physics.ts), a hitscan pistol and bots that walk a waypoint graph. The play area is the village square: collision
// comes read-only from src/village.ts (villageSolids) and the terrain from groundY.
import { newPlayer, step as physStep, eyeHeight, box, TUNING, type Box, type PlayerState, type Input } from '../physics';
import { villageSolids, groundY } from '../village';
import { createRoom, activate, deactivate, tick as roomTick, kill, RULES, type Room, type RoomEvent } from '../net/room';
import type { GameEvent, PSnap, Snap, InputMsg } from '../net/protocol';
import { buildNav, findPath, nearestNode, type Nav, type Pt } from './nav';

// ---------- map: the village square and its surroundings ----------
export const BOUNDS = { x0: -9, x1: 50, z0: 34, z1: 62 };
export const GROUND = groundY;

/** Market stalls and carts added as cover (the square itself is bare). Kept clear of the spawn lanes z = 41, 47.5, 54. */
export const EXTRA_COVER: Box[] = [
  box(9, 0, 44.5, 3.2, 1.4, 1.2), box(9, 0, 51, 3.2, 1.4, 1.2),
  box(15, 0, 38.5, 1.4, 1.5, 3), box(15, 0, 57, 1.4, 1.5, 3),
  box(32, 0, 44.5, 3.2, 1.4, 1.2), box(32, 0, 51, 3.2, 1.4, 1.2),
  box(30, 0, 38.5, 1.4, 1.5, 3), box(30, 0, 57, 1.4, 1.5, 3),
  box(22.5, 0, 42, 2.4, 1.3, 1.4), box(22.5, 0, 53.5, 2.4, 1.3, 1.4),
];

function overlapsBounds(b: Box): boolean {
  return b.max.x > BOUNDS.x0 - 1 && b.min.x < BOUNDS.x1 + 1 && b.max.z > BOUNDS.z0 - 1 && b.min.z < BOUNDS.z1 + 1;
}
/** Invisible walls along the play area's edge. */
const EDGE: Box[] = [
  { min: { x: BOUNDS.x0 - 2, y: -20, z: BOUNDS.z0 - 2 }, max: { x: BOUNDS.x1 + 2, y: 40, z: BOUNDS.z0 } },
  { min: { x: BOUNDS.x0 - 2, y: -20, z: BOUNDS.z1 }, max: { x: BOUNDS.x1 + 2, y: 40, z: BOUNDS.z1 + 2 } },
  { min: { x: BOUNDS.x0 - 2, y: -20, z: BOUNDS.z0 }, max: { x: BOUNDS.x0, y: 40, z: BOUNDS.z1 } },
  { min: { x: BOUNDS.x1, y: -20, z: BOUNDS.z0 }, max: { x: BOUNDS.x1 + 2, y: 40, z: BOUNDS.z1 } },
];
export const SOLIDS: Box[] = [
  ...villageSolids().filter(s => s.tag !== 'invisible' && overlapsBounds(s.box)).map(s => s.box),
  ...EXTRA_COVER, ...EDGE,
];

/** Spawn for slot id: Ravens (even ids) on the west edge, Village (odd ids) on the east, facing the middle. */
export function spawnFor(id: number): { x: number; z: number; yaw: number } {
  const z = [41, 54, 47.5][id >> 1] ?? 47.5;
  return id % 2 === 0 ? { x: -6, z, yaw: -Math.PI / 2 } : { x: 47, z, yaw: Math.PI / 2 };
}

let navCache: Nav | null = null;
export const nav = (): Nav => (navCache ??= buildNav(SOLIDS, GROUND, BOUNDS, 3));

// ---------- difficulty ----------
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface BotTuning {
  react: [number, number];   // seconds between spotting an enemy and the first shot
  floor: number;             // aim error (rad, uniform in a disc) once fully settled
  start: number;             // aim error at the moment of spotting
  tau: number;               // seconds for the error to shrink by e
  damage: number; cooldown: number; turn: number; fireP: number;
}
export const DIFFICULTY: Record<Difficulty, BotTuning> = {
  easy: { react: [0.6, 1.0], floor: 0.045, start: 0.18, tau: 1.6, damage: 12, cooldown: 0.6, turn: 2.2, fireP: 0.6 },
  medium: { react: [0.4, 0.7], floor: 0.032, start: 0.14, tau: 1.3, damage: 16, cooldown: 0.45, turn: 3.2, fireP: 0.75 },
  hard: { react: [0.25, 0.45], floor: 0.02, start: 0.1, tau: 1.0, damage: 22, cooldown: 0.32, turn: 4.5, fireP: 0.9 },
};
/** Aim error of a bot that has had an enemy in sight for `t` seconds. */
export const botAimError = (d: BotTuning, t: number) => Math.max(d.floor, d.start * Math.exp(-t / d.tau));

// ---------- weapon ----------
export const PISTOL = { damage: 34, headMul: 2.5, botHeadMul: 1.5, cooldown: 0.28, range: 80, spread: 0.012 };
export const HEAD_Y = 1.45;
export const HUMAN_HP = 150, BOT_HP = 100, REGEN_DELAY = 4, REGEN_RATE = 6, PROTECT = 3;

function rayBox(o: [number, number, number], d: [number, number, number], b: Box): number {
  let t0 = 0, t1 = Infinity;
  const mn = [b.min.x, b.min.y, b.min.z], mx = [b.max.x, b.max.y, b.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity; continue; }
    let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
    if (a > c) { const t = a; a = c; c = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0;
}
export const lookDir = (yaw: number, pitch: number): [number, number, number] =>
  [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

/** Distance along the ray to the nearest world solid (Infinity if none). */
export function worldHit(o: [number, number, number], d: [number, number, number], solids: Box[] = SOLIDS): number {
  let best = Infinity;
  for (const b of solids) best = Math.min(best, rayBox(o, d, b));
  return best;
}

export interface Target { id: number; pos: { x: number; y: number; z: number }; crouched: boolean }
export interface Hit { id: number; t: number; head: boolean }
/** Hitscan: nearest living target the ray reaches before any solid. */
export function hitscan(o: [number, number, number], d: [number, number, number], targets: Target[], solids: Box[] = SOLIDS, range = PISTOL.range): Hit | null {
  const wall = Math.min(worldHit(o, d, solids), range);
  let best: Hit | null = null;
  for (const t of targets) {
    const h = t.crouched ? TUNING.crouchHeight : TUNING.standHeight, r = TUNING.radius;
    const t0 = rayBox(o, d, { min: { x: t.pos.x - r, y: t.pos.y, z: t.pos.z - r }, max: { x: t.pos.x + r, y: t.pos.y + h, z: t.pos.z + r } });
    if (t0 < wall && (!best || t0 < best.t)) {
      const hy = o[1] + d[1] * t0;
      best = { id: t.id, t: t0, head: hy - t.pos.y > (t.crouched ? 0.7 : HEAD_Y) };
    }
  }
  return best;
}

// ---------- sim ----------
export interface Controls { fwd: number; str: number; yaw: number; pitch: number; jump: boolean; crouch: boolean; fire: boolean }
const idle = (): Controls => ({ fwd: 0, str: 0, yaw: 0, pitch: 0, jump: false, crouch: false, fire: false });

interface BotBrain {
  path: Pt[]; pi: number; repath: number; target: number;
  seen: number;       // seconds the current target has been in sight
  react: number;      // reaction delay drawn when the target was spotted
  stuck: number; lx: number; lz: number;
}

export class MpSim {
  room: Room = createRoom();
  bodies: PlayerState[] = [];
  hp: number[] = [];
  maxHp: number[] = [];
  ctl: Controls[] = [];
  cool: number[] = [];
  /** Seconds of spawn protection left, and seconds since the slot last took damage. */
  prot: number[] = [];
  sinceHit: number[] = [];
  brains: (BotBrain | null)[] = [];
  tickNo = 0;
  /** Events produced since the last drain (kills, shots, round results). */
  events: GameEvent[] = [];
  constructor(private rng: () => number = Math.random, public difficulty: Difficulty = 'easy') {
    for (let i = 0; i < RULES.slots; i++) {
      const s = spawnFor(i);
      this.bodies.push(newPlayer({ x: s.x, y: GROUND(s.x, s.z), z: s.z }));
      this.hp.push(BOT_HP); this.maxHp.push(BOT_HP); this.ctl.push({ ...idle(), yaw: s.yaw });
      this.cool.push(0); this.prot.push(0); this.sinceHit.push(99); this.brains.push(null);
    }
  }
  private get tune(): BotTuning { return DIFFICULTY[this.difficulty]; }

  addHuman(id: number, name: string): void {
    activate(this.room, id, true, name); this.brains[id] = null; this.maxHp[id] = HUMAN_HP;
    if (this.room.slots[id].alive) this.respawn(id); else this.hp[id] = HUMAN_HP;
  }
  addBot(id: number): void {
    activate(this.room, id, false, 'Bot ' + (id + 1)); this.maxHp[id] = BOT_HP;
    this.brains[id] = { path: [], pi: 0, repath: 0, target: -1, seen: 0, react: 1, stuck: 0, lx: 0, lz: 0 };
    if (this.room.slots[id].alive) this.respawn(id); else this.hp[id] = BOT_HP;
  }
  remove(id: number): void { this.push(deactivate(this.room, id)); this.brains[id] = null; }

  setInput(id: number, m: Pick<InputMsg, 'fwd' | 'str' | 'yaw' | 'pitch' | 'jump' | 'crouch' | 'fire'>): void {
    const c = this.ctl[id];
    c.fwd = m.fwd; c.str = m.str; c.yaw = m.yaw; c.pitch = Math.max(-1.5, Math.min(1.5, m.pitch));
    c.jump = m.jump; c.crouch = m.crouch; c.fire = c.fire || m.fire;   // a pull is latched until a tick consumes it
  }

  private respawn(id: number): void {
    const s = spawnFor(id), b = this.bodies[id];
    b.pos.x = s.x; b.pos.y = GROUND(s.x, s.z); b.pos.z = s.z; b.vel.x = b.vel.y = b.vel.z = 0; b.crouched = false; b.onGround = false;
    this.hp[id] = this.maxHp[id]; this.ctl[id].yaw = s.yaw; this.ctl[id].pitch = 0; this.cool[id] = 0;
    this.prot[id] = PROTECT; this.sinceHit[id] = 99;
    const br = this.brains[id]; if (br) { br.path = []; br.pi = 0; br.target = -1; br.seen = 0; br.repath = 0; }
  }

  private push(evs: RoomEvent[]): void {
    for (const e of evs) {
      if (e.k === 'roundStart') { for (const s of this.room.slots) if (s.active) this.respawn(s.id); }
      else if (e.k === 'live') { for (const s of this.room.slots) if (s.active) this.prot[s.id] = PROTECT; }   // 3 s of grace once shooting is allowed
      else if (e.k === 'kill') this.events.push({ k: 'kill', a: e.a, v: e.v });
      else if (e.k === 'round') this.events.push({ k: 'round', w: e.w, why: e.why });
      else if (e.k === 'match') this.events.push({ k: 'match', w: e.w });
    }
  }

  /** Eye position of a slot. */
  eye(id: number): [number, number, number] {
    const b = this.bodies[id];
    return [b.pos.x, b.pos.y + eyeHeight(b), b.pos.z];
  }

  private targets(except: number): Target[] {
    const out: Target[] = [];
    for (const s of this.room.slots) if (s.active && s.alive && s.id !== except) out.push({ id: s.id, pos: this.bodies[s.id].pos, crouched: this.bodies[s.id].crouched });
    return out;
  }

  /** Fires slot `id`. `err` is a bot's aim error in radians (uniform in a disc); humans get the pistol's own spread. */
  private shoot(id: number, err = 0): void {
    const c = this.ctl[id], sp = this.rng, bot = !this.room.slots[id].human;
    let dy: number, dp: number;
    if (bot) { const r = err * Math.sqrt(sp()), a = sp() * Math.PI * 2; dy = r * Math.cos(a); dp = r * Math.sin(a); }
    else { dy = (sp() - 0.5) * 2 * PISTOL.spread; dp = (sp() - 0.5) * 2 * PISTOL.spread; }
    const d = lookDir(c.yaw + dy, c.pitch + dp);
    const o = this.eye(id);
    this.prot[id] = 0;                                          // shooting ends your own spawn protection
    const hit = hitscan(o, d, this.targets(id));
    const wall = Math.min(worldHit(o, d), PISTOL.range);
    const t = hit ? hit.t : wall;
    this.events.push({ k: 'shot', i: id, x: o[0], y: o[1] - 0.15, z: o[2], tx: o[0] + d[0] * t, ty: o[1] + d[1] * t, tz: o[2] + d[2] * t, hit: !!hit });
    if (!hit) return;
    const v = hit.id;
    if (this.prot[v] > 0) return;                               // protected: the shot is absorbed
    const dmg = bot ? this.tune.damage * (hit.head ? PISTOL.botHeadMul : 1) : PISTOL.damage * (hit.head ? PISTOL.headMul : 1);
    this.hp[v] -= Math.round(dmg); this.sinceHit[v] = 0;
    if (this.hp[v] <= 0) { this.hp[v] = 0; this.push(kill(this.room, id, v)); }
  }

  private botThink(id: number, dt: number): void {
    const br = this.brains[id]!, c = this.ctl[id], b = this.bodies[id], me = this.room.slots[id], T = this.tune;
    c.fire = false; c.jump = false; c.crouch = false;
    // Nearest enemy in the open.
    const o = this.eye(id);
    let best = -1, bd = Infinity;
    for (const s of this.room.slots) {
      if (!s.active || !s.alive || s.team === me.team) continue;
      const e = this.bodies[s.id], dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 38 || dist >= bd) continue;
      const dir: [number, number, number] = [dx, e.pos.y + 1.2 - o[1], dz];
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      dir[0] /= len; dir[1] /= len; dir[2] /= len;
      if (worldHit(o, dir) > len) { best = s.id; bd = dist; }
    }
    if (best >= 0) {
      if (br.target !== best) { br.target = best; br.seen = 0; br.react = T.react[0] + this.rng() * (T.react[1] - T.react[0]); }
      br.seen += dt;
      const e = this.bodies[best];
      const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, dy = e.pos.y + 1.2 - o[1];
      const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const turn = T.turn * dt;
      if (br.seen > br.react * 0.5) {          // the first half of the reaction time is spent noticing, not turning
        c.yaw += clampAbs(angDiff(wantYaw, c.yaw), turn);
        c.pitch += clampAbs(wantPitch - c.pitch, turn);
      }
      const adv = bd > 14;                                                          // close the distance, shooting less accurately on the move
      c.fwd = adv ? 1 : 0; c.str = Math.sin(this.tickNo / 40 + id) > 0 ? 0.6 : -0.6;
      const aimed = Math.abs(angDiff(wantYaw, c.yaw)) < 0.08 && Math.abs(wantPitch - c.pitch) < 0.08;
      if (br.seen > br.react && aimed && this.cool[id] <= 0 && this.rng() < T.fireP * dt * 30) {
        c.fire = true;
        this.cool[id] = T.cooldown;
        this.shoot(id, botAimError(T, br.seen - br.react) * (adv ? 1.5 : 1));
        c.fire = false;
      }
      return;
    }
    br.target = -1; br.seen = 0;
    // Walk the waypoint graph to a random destination, biased towards the other half of the map.
    br.repath -= dt;
    if (br.pi >= br.path.length || br.repath <= 0) {
      const N = nav();
      const goalNode = this.rng() < 0.6
        ? nearestNode(N, { x: me.team === 0 ? BOUNDS.x1 - 12 + this.rng() * 8 : BOUNDS.x0 + 4 + this.rng() * 8, z: BOUNDS.z0 + this.rng() * (BOUNDS.z1 - BOUNDS.z0) })
        : Math.floor(this.rng() * N.nodes.length);
      br.path = findPath(N, { x: b.pos.x, z: b.pos.z }, N.nodes[goalNode]) ?? []; br.pi = 0;
      br.repath = 8 + this.rng() * 6;
    }
    const wp = br.path[br.pi];
    if (wp) {
      const gx = wp.x - b.pos.x, gz = wp.z - b.pos.z;
      if (Math.hypot(gx, gz) < 1.0) br.pi++;
      c.yaw += clampAbs(angDiff(Math.atan2(-gx, -gz), c.yaw), 6 * dt);
      c.pitch *= 0.9; c.fwd = Math.abs(angDiff(Math.atan2(-gx, -gz), c.yaw)) < 0.6 ? 1 : 0; c.str = 0;
    } else { c.fwd = 0; }
    // No progress for a second: drop the path and plan a new one.
    br.stuck += dt;
    if (br.stuck > 1) {
      if (c.fwd > 0 && Math.hypot(b.pos.x - br.lx, b.pos.z - br.lz) < 0.5) { br.path = []; br.pi = 0; }
      br.stuck = 0; br.lx = b.pos.x; br.lz = b.pos.z;
    }
  }

  /** Advance one fixed step. */
  step(dt: number): void {
    this.tickNo++;
    this.push(roomTick(this.room, dt));
    const live = this.room.phase === 'live';
    const frozen = this.room.phase === 'freeze';
    for (const s of this.room.slots) {
      if (!s.active) continue;
      const id = s.id;
      if (this.brains[id]) { if (s.alive && live) this.botThink(id, dt); else { this.ctl[id].fire = false; this.ctl[id].fwd = 0; this.ctl[id].str = 0; } }
      if (!s.alive) { this.ctl[id].fire = false; continue; }
      const c = this.ctl[id];
      this.prot[id] = Math.max(0, this.prot[id] - (live ? dt : 0));
      this.sinceHit[id] += dt;
      if (s.human && this.sinceHit[id] > REGEN_DELAY && this.hp[id] < this.maxHp[id]) this.hp[id] = Math.min(this.maxHp[id], this.hp[id] + REGEN_RATE * dt);
      const inp: Input = { forward: frozen ? 0 : c.fwd, strafe: frozen ? 0 : c.str, jump: !frozen && c.jump, crouch: c.crouch, walk: false, yaw: c.yaw };
      physStep(this.bodies[id], inp, SOLIDS, dt, GROUND);
      this.cool[id] = Math.max(0, this.cool[id] - dt);
      if (c.fire) {
        c.fire = false;
        if (live && this.cool[id] <= 0 && s.human) { this.cool[id] = PISTOL.cooldown; this.shoot(id); }
      }
    }
  }

  snapshot(): Snap {
    const p: PSnap[] = [];
    for (const s of this.room.slots) {
      if (!s.active) continue;
      const b = this.bodies[s.id], c = this.ctl[s.id];
      p.push({ i: s.id, n: s.name, x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z), yw: r2(c.yaw), pt: r2(c.pitch), hp: Math.round(this.hp[s.id]), a: s.alive, h: s.human, tm: s.team, k: s.kills, d: s.deaths });
    }
    const ev = this.events.slice(-60); this.events = [];
    return { t: 'snap', tick: this.tickNo, ph: this.room.phase, tl: r2(this.room.timer), rd: this.room.round, sc: [...this.room.score], p, ev };
  }
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const clampAbs = (x: number, m: number) => Math.max(-m, Math.min(m, x));
const angDiff = (a: number, b: number) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
