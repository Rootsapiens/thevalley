// Host-side multiplayer simulation. Pure (no DOM, no Three.js): the room state machine, one physics body per slot
// (src/physics.ts), a hitscan pistol and simple bots. The host steps it at a fixed dt; clients only render snapshots.
import { newPlayer, step as physStep, eyeHeight, box, TUNING, type Box, type PlayerState, type Input } from '../physics';
import { createRoom, activate, deactivate, tick as roomTick, kill, RULES, type Room, type RoomEvent } from '../net/room';
import type { GameEvent, PSnap, Snap, InputMsg } from '../net/protocol';

// ---------- arena: a walled village square ----------
export const ARENA_HALF = 22;
const W = 1, WH = 4;
export const COVER: Box[] = [
  box(-8, 0, 0, 3, 1.4, 3),      // well
  box(8, 0, 0, 3, 1.4, 3),       // cart
  box(-13, 0, 9, 4, 1.4, 1.2),   // low wall
  box(13, 0, -9, 4, 1.4, 1.2),
  box(-16, 0, -8, 5, 4, 6),      // chapel
  box(16, 0, 9, 6, 4, 5),        // house
  box(-4, 0, -7, 1.2, 2.2, 1.2), // pillars
  box(4, 0, 7, 1.2, 2.2, 1.2),
  box(0, 0, 12, 2.5, 1.0, 1), box(0, 0, -12, 2.5, 1.0, 1),   // low crates in the central lane
];
export const WALLS: Box[] = [
  box(0, 0, -ARENA_HALF - W / 2, ARENA_HALF * 2 + 2 * W, WH, W),
  box(0, 0, ARENA_HALF + W / 2, ARENA_HALF * 2 + 2 * W, WH, W),
  box(-ARENA_HALF - W / 2, 0, 0, W, WH, ARENA_HALF * 2),
  box(ARENA_HALF + W / 2, 0, 0, W, WH, ARENA_HALF * 2),
];
export const SOLIDS: Box[] = [...WALLS, ...COVER];
export const FLAT = () => 0;   // flat ground at y = 0

/** Spawn for slot id: Ravens (even ids) on the north edge, Village (odd ids) on the south, facing the middle. */
export function spawnFor(id: number): { x: number; z: number; yaw: number } {
  const k = id >> 1, x = [0, -5, 5][k] ?? 0;
  return id % 2 === 0 ? { x, z: -ARENA_HALF + 3.5, yaw: Math.PI } : { x, z: ARENA_HALF - 3.5, yaw: 0 };
}

// ---------- weapon ----------
export const PISTOL = { damage: 34, headMul: 2.5, cooldown: 0.28, range: 80, spread: 0.012 };
export const HEAD_Y = 1.45;

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

/** Distance along the ray to the nearest world solid (Infinity if none within range). */
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

interface BotBrain { goal: { x: number; z: number } | null; repath: number; seen: number; target: number; stuck: number; lx: number; lz: number; skill: number }

export class MpSim {
  room: Room = createRoom();
  bodies: PlayerState[] = [];
  hp: number[] = [];
  ctl: Controls[] = [];
  cool: number[] = [];
  brains: (BotBrain | null)[] = [];
  tickNo = 0;
  /** Events produced since the last drain (kills, shots, round results). */
  events: GameEvent[] = [];
  constructor(private rng: () => number = Math.random) {
    for (let i = 0; i < RULES.slots; i++) {
      const s = spawnFor(i);
      this.bodies.push(newPlayer({ x: s.x, y: 0, z: s.z }));
      this.hp.push(100); this.ctl.push({ ...idle(), yaw: s.yaw }); this.cool.push(0); this.brains.push(null);
    }
  }

  addHuman(id: number, name: string): void {
    activate(this.room, id, true, name); this.brains[id] = null;
    if (this.room.slots[id].alive) this.respawn(id);
  }
  addBot(id: number): void {
    activate(this.room, id, false, 'Bot ' + (id + 1));
    this.brains[id] = { goal: null, repath: 0, seen: 0, target: -1, stuck: 0, lx: 0, lz: 0, skill: 0.6 + this.rng() * 0.4 };
    if (this.room.slots[id].alive) this.respawn(id);
  }
  remove(id: number): void { this.push(deactivate(this.room, id)); this.brains[id] = null; }

  setInput(id: number, m: Pick<InputMsg, 'fwd' | 'str' | 'yaw' | 'pitch' | 'jump' | 'crouch' | 'fire'>): void {
    const c = this.ctl[id];
    c.fwd = m.fwd; c.str = m.str; c.yaw = m.yaw; c.pitch = Math.max(-1.5, Math.min(1.5, m.pitch));
    c.jump = m.jump; c.crouch = m.crouch; c.fire = c.fire || m.fire;   // a pull is latched until a tick consumes it
  }

  private respawn(id: number): void {
    const s = spawnFor(id), b = this.bodies[id];
    b.pos.x = s.x; b.pos.y = 0; b.pos.z = s.z; b.vel.x = b.vel.y = b.vel.z = 0; b.crouched = false; b.onGround = false;
    this.hp[id] = 100; this.ctl[id].yaw = s.yaw; this.ctl[id].pitch = 0; this.cool[id] = 0;
    const br = this.brains[id]; if (br) { br.goal = null; br.target = -1; br.seen = 0; }
  }

  private push(evs: RoomEvent[]): void {
    for (const e of evs) {
      if (e.k === 'roundStart') { for (const s of this.room.slots) if (s.active) this.respawn(s.id); }
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

  private shoot(id: number): void {
    const c = this.ctl[id], sp = this.rng, spread = PISTOL.spread;
    const d = lookDir(c.yaw + (sp() - 0.5) * 2 * spread, c.pitch + (sp() - 0.5) * 2 * spread);
    const o = this.eye(id);
    const hit = hitscan(o, d, this.targets(id));
    const wall = Math.min(worldHit(o, d), PISTOL.range);
    const t = hit ? hit.t : wall;
    this.events.push({ k: 'shot', i: id, x: o[0], y: o[1] - 0.15, z: o[2], tx: o[0] + d[0] * t, ty: o[1] + d[1] * t, tz: o[2] + d[2] * t, hit: !!hit });
    if (hit) {
      this.hp[hit.id] -= Math.round(PISTOL.damage * (hit.head ? PISTOL.headMul : 1));
      if (this.hp[hit.id] <= 0) { this.hp[hit.id] = 0; this.push(kill(this.room, id, hit.id)); }
    }
  }

  private botThink(id: number, dt: number): void {
    const br = this.brains[id]!, c = this.ctl[id], b = this.bodies[id], me = this.room.slots[id];
    c.fire = false; c.jump = false; c.crouch = false;
    // Look for the nearest enemy in the open.
    const o = this.eye(id);
    let best = -1, bd = Infinity;
    for (const s of this.room.slots) {
      if (!s.active || !s.alive || s.team === me.team) continue;
      const e = this.bodies[s.id], dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 40 || dist >= bd) continue;
      const tgt: [number, number, number] = [e.pos.x, e.pos.y + 1.2, e.pos.z];
      const dir: [number, number, number] = [tgt[0] - o[0], tgt[1] - o[1], tgt[2] - o[2]];
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      dir[0] /= len; dir[1] /= len; dir[2] /= len;
      if (worldHit(o, dir) > len) { best = s.id; bd = dist; }
    }
    if (best >= 0) {
      if (br.target !== best) { br.target = best; br.seen = 0; }
      br.seen += dt;
      const e = this.bodies[best];
      const dx = e.pos.x - b.pos.x, dz = e.pos.z - b.pos.z, dy = e.pos.y + 1.2 - o[1];
      const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const turn = (3 + 3 * br.skill) * dt;
      c.yaw += clampAbs(angDiff(wantYaw, c.yaw), turn);
      c.pitch += clampAbs(wantPitch - c.pitch, turn);
      c.fwd = 0; c.str = Math.sin(this.tickNo / 40 + id) > 0 ? 0.6 : -0.6;     // strafe while shooting
      const aimed = Math.abs(angDiff(wantYaw, c.yaw)) < 0.06 / br.skill;
      if (br.seen > 0.5 / br.skill && aimed && this.cool[id] <= 0) c.fire = this.rng() < 0.5 + 0.4 * br.skill;
      return;
    }
    br.target = -1; br.seen = 0;
    // Wander to random points, turn towards the goal.
    br.repath -= dt;
    if (!br.goal || br.repath <= 0 || Math.hypot(br.goal.x - b.pos.x, br.goal.z - b.pos.z) < 1.5) {
      br.goal = { x: (this.rng() * 2 - 1) * (ARENA_HALF - 3), z: (this.rng() * 2 - 1) * (ARENA_HALF - 3) };
      br.repath = 3 + this.rng() * 4;
    }
    const gx = br.goal.x - b.pos.x, gz = br.goal.z - b.pos.z;
    c.yaw += clampAbs(angDiff(Math.atan2(-gx, -gz), c.yaw), 4 * dt);
    c.pitch *= 0.9; c.fwd = 1; c.str = 0;
    // Stuck on cover: pick a new goal.
    br.stuck += dt;
    if (br.stuck > 1) {
      if (Math.hypot(b.pos.x - br.lx, b.pos.z - br.lz) < 0.6) br.goal = null;
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
      if (this.brains[id]) { if (s.alive && live) this.botThink(id, dt); else this.ctl[id].fire = false; }
      if (!s.alive) { this.ctl[id].fire = false; continue; }
      const c = this.ctl[id];
      const inp: Input = { forward: frozen ? 0 : c.fwd, strafe: frozen ? 0 : c.str, jump: !frozen && c.jump, crouch: c.crouch, walk: false, yaw: c.yaw };
      physStep(this.bodies[id], inp, SOLIDS, dt, FLAT);
      this.cool[id] = Math.max(0, this.cool[id] - dt);
      if (c.fire) {
        c.fire = false;
        if (live && this.cool[id] <= 0) { this.cool[id] = PISTOL.cooldown; this.shoot(id); }
      }
    }
  }

  snapshot(): Snap {
    const p: PSnap[] = [];
    for (const s of this.room.slots) {
      if (!s.active) continue;
      const b = this.bodies[s.id], c = this.ctl[s.id];
      p.push({ i: s.id, n: s.name, x: r2(b.pos.x), y: r2(b.pos.y), z: r2(b.pos.z), yw: r2(c.yaw), pt: r2(c.pitch), hp: this.hp[s.id], a: s.alive, h: s.human, tm: s.team, k: s.kills, d: s.deaths });
    }
    const ev = this.events; this.events = [];
    return { t: 'snap', tick: this.tickNo, ph: this.room.phase, tl: r2(this.room.timer), rd: this.room.round, sc: [...this.room.score], p, ev };
  }
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const clampAbs = (x: number, m: number) => Math.max(-m, Math.min(m, x));
const angDiff = (a: number, b: number) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
