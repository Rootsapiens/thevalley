// Entities in the GoldSrc manner: doors and gates that swing (func_door_rotating), buttons that fire a target
// (func_button), and props the player can push (func_pushable). Pure logic, no Three.js, fixed timestep: villageMain
// builds them from the map data, ticks them at 120 Hz before the player moves, draws their meshes from this state and
// turns their events into sounds. No allocation per tick.
import { overlaps, TUNING, type Box, type Vec3 } from './physics';

export interface Door {
  kind: 'door'; id: string; targetname?: string; locked: boolean;
  /** Swing 0 (shut) .. 1 (open), eased by easeIO for the leaf angle; goal is where it is heading. */
  open: number; goal: 0 | 1;
  /** Solid while at rest and clear of the player; a moving leaf never pushes anyone. */
  solid: boolean;
  /** Seconds for a full swing. */
  swing: number;
  /** Collision box at the last rest position. */
  box: Box;
  leafAt: (t: number, out: Box) => Box;
}
export interface Button {
  kind: 'button'; id: string; target: string;
  /** Press animation 0..1 (1 = idle again) and the seconds left before it can be pressed again. */
  t: number; cool: number; wait: number; press: number;
}
export interface Prop {
  kind: 'prop'; id: string;
  /** Bottom centre; half extents of its box. */
  pos: Vec3; half: { x: number; y: number; z: number };
  vel: Vec3;
  /** Share of the pusher's walking speed it moves at (lighter = closer to 1), and its slide-out deceleration (m/s^2). */
  follow: number; drag: number;
  box: Box;
}
export type EntEvent =
  | { type: 'locked' | 'blocked' | 'open' | 'close' | 'shut' | 'press'; id: string }
  | { type: 'fire'; id: string; target: string }
  | { type: 'bump'; id: string; speed: number };
export interface Ents { doors: Door[]; buttons: Button[]; props: Prop[]; events: EntEvent[] }

export const easeIO = (t: number) => t * t * (3 - 2 * t);
const newBox = (): Box => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });

export function makeDoor(id: string, leafAt: (t: number, out: Box) => Box, o: { locked?: boolean; swing?: number; targetname?: string } = {}): Door {
  return { kind: 'door', id, targetname: o.targetname, locked: !!o.locked, open: 0, goal: 0, solid: !o.locked, swing: o.swing ?? 0.75, box: leafAt(0, newBox()), leafAt };
}
export function makeButton(id: string, target: string, o: { wait?: number; press?: number } = {}): Button {
  return { kind: 'button', id, target, t: 1, cool: 0, wait: o.wait ?? 4, press: o.press ?? 0.9 };
}
export function makeProp(id: string, pos: Vec3, half: { x: number; y: number; z: number }, o: { follow?: number; drag?: number } = {}): Prop {
  const p: Prop = { kind: 'prop', id, pos: { ...pos }, half: { ...half }, vel: { x: 0, y: 0, z: 0 }, follow: o.follow ?? 0.7, drag: o.drag ?? 6, box: newBox() };
  propBox(p);
  return p;
}
function propBox(p: Prop) {
  p.box.min.x = p.pos.x - p.half.x; p.box.max.x = p.pos.x + p.half.x;
  p.box.min.y = p.pos.y; p.box.max.y = p.pos.y + p.half.y * 2;
  p.box.min.z = p.pos.z - p.half.z; p.box.max.z = p.pos.z + p.half.z;
}

const _shut = newBox();
/** E on a door or gate: a locked one rattles; an open leaf only closes if it would not shut on the player. */
export function useDoor(e: Ents, d: Door, player: Box): void {
  if (d.locked) { e.events.push({ type: 'locked', id: d.id }); return; }
  if (d.goal === 1 && d.open > 0.98 && overlaps(player, d.leafAt(0, _shut))) { e.events.push({ type: 'blocked', id: d.id }); return; }
  d.goal = d.goal ? 0 : 1;
  d.solid = false;
  e.events.push({ type: d.goal ? 'open' : 'close', id: d.id });
}
/** E on a button: it sinks (its press animation), fires its target, and rests `wait` seconds. False while resting. */
export function pressButton(e: Ents, b: Button): boolean {
  if (b.cool > 0) return false;
  b.t = 0; b.cool = b.wait;
  e.events.push({ type: 'press', id: b.id }, { type: 'fire', id: b.id, target: b.target });
  fire(e, b.target);
  return true;
}
/** Fires a target: doors with that targetname toggle (locked ones too: a lock is for hands, not for the mechanism). */
export function fire(e: Ents, target: string): void {
  for (const d of e.doors) if (d.targetname === target) {
    d.goal = d.goal ? 0 : 1; d.solid = false;
    e.events.push({ type: d.goal ? 'open' : 'close', id: d.id });
  }
}

/** The push the player gives this tick: unit wish direction on the ground (speed 0 in the air), its speed, and the
 *  player's current horizontal velocity (a prop never moves slower than he walks into it, so he cannot catch it up). */
export interface Push { x: number; z: number; speed: number; vx: number; vz: number }

/**
 * One tick. Props first: a prop the player leans on (within 3 cm, not standing on it) and walks into takes the push speed
 * times its `follow`, along the face he pushes. It is moved before the player, who walks at that same speed while he
 * pushes (see pushScale), so he follows it without climbing it. Then props slide out, slowed by `drag`, and stop
 * against the world, the solid leaves and each other (axis-separated, 120 Hz, boxes thicker than a tick's travel).
 * Then doors swing and buttons recover.
 */
export function tickEnts(e: Ents, dt: number, player: Box, push: Push, world: (x: number, z: number) => Box[], ground: (x: number, z: number) => number): void {
  for (const p of e.props) {
    const axis = pushAxis(p, player, push);
    if (axis) {   // pushed: straight along the face's normal, at the pace (or faster if he is still faster), no drag
      const s = axis === 'x' ? Math.sign(p.pos.x - (player.min.x + player.max.x) / 2) : Math.sign(p.pos.z - (player.min.z + player.max.z) / 2);
      const into = (axis === 'x' ? push.x : push.z) * s, now = Math.max(0, (axis === 'x' ? push.vx : push.vz) * s);
      p.vel[axis] = Math.max(into * push.speed * p.follow, now) * s;
      p.vel[axis === 'x' ? 'z' : 'x'] = 0;
    } else {
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (sp > 0) { const k = Math.max(0, sp - p.drag * dt) / sp; p.vel.x *= k; p.vel.z *= k; }
    }
    const near = world(p.pos.x, p.pos.z);
    moveProp(e, p, 'x', p.vel.x * dt, near, player);
    moveProp(e, p, 'z', p.vel.z * dt, near, player);
    p.pos.y = ground(p.pos.x, p.pos.z);
    propBox(p);
  }
  for (const d of e.doors) {
    if (d.locked && d.goal === 0 && d.open === 0) continue;
    if (d.open !== d.goal) {
      d.open = d.goal ? Math.min(1, d.open + dt / d.swing) : Math.max(0, d.open - dt / d.swing);
      if (d.open === d.goal) { d.leafAt(easeIO(d.goal), d.box); if (d.goal === 0) e.events.push({ type: 'shut', id: d.id }); }
    } else if (!d.solid && !overlaps(player, d.box)) d.solid = true;
  }
  for (const b of e.buttons) {
    b.cool = Math.max(0, b.cool - dt);
    b.t = Math.min(1, b.t + dt / b.press);
  }
}

/** The face of the prop the player is pushing ('x' or 'z'), or null: touching within 3 cm, beside it (not on top),
 *  on the ground and walking into that face. */
export function pushAxis(p: Prop, player: Box, push: Push): 'x' | 'z' | null {
  if (push.speed <= 0) return null;
  const g = 0.03;
  if (!(player.min.x - g < p.box.max.x && player.max.x + g > p.box.min.x && player.min.z - g < p.box.max.z && player.max.z + g > p.box.min.z)) return null;
  if (player.min.y > p.box.max.y - 0.05 || player.max.y < p.box.min.y) return null;   // standing on it, or under it
  const ox = Math.min(player.max.x + g - p.box.min.x, p.box.max.x - player.min.x + g);
  const oz = Math.min(player.max.z + g - p.box.min.z, p.box.max.z - player.min.z + g);
  const axis = ox < oz ? 'x' : 'z';
  const s = axis === 'x' ? Math.sign(p.pos.x - (player.min.x + player.max.x) / 2) : Math.sign(p.pos.z - (player.min.z + player.max.z) / 2);
  return (axis === 'x' ? push.x : push.z) * s > 0.2 ? axis : null;
}
/** Speed factor for the player this tick: the slowest prop he is pushing sets his pace; 1 when he pushes nothing.
 *  Call it before tickEnts, on the same contact the push is decided on (after the props move he may be 3 cm off). */
export function pushScale(e: Ents, player: Box, push: Push): number {
  let k = 1;
  for (const p of e.props) if (pushAxis(p, player, push)) k = Math.min(k, p.follow);
  return k;
}

function moveProp(e: Ents, p: Prop, axis: 'x' | 'z', d: number, world: Box[], player: Box) {
  if (d === 0) return;
  const before = p.pos[axis];
  p.pos[axis] += d;
  propBox(p);
  const clamp = (b: Box) => {
    if (!overlaps(p.box, b)) return false;
    p.pos[axis] = d > 0 ? b.min[axis] - p.half[axis] - 1e-4 : b.max[axis] + p.half[axis] + 1e-4;
    propBox(p);
    return true;
  };
  let hit = false;
  for (const b of world) if (b !== p.box && clamp(b)) hit = true;
  for (const o of e.props) if (o !== p && clamp(o.box)) hit = true;
  for (const dd of e.doors) if (dd.solid && clamp(dd.box)) hit = true;
  if (overlaps(p.box, player)) { p.pos[axis] = before; propBox(p); hit = true; }   // never into the player
  if (hit) {
    const v = Math.abs(p.vel[axis]);
    if (v > 0.8) e.events.push({ type: 'bump', id: p.id, speed: v });
    p.vel[axis] = 0;
  }
}

/** Unit wish direction and speed from the movement keys (same convention as physics step): what a push carries. */
export function pushFrom(forward: number, strafe: number, yaw: number, walk: boolean, crouched: boolean, onGround: boolean, vel: Vec3, out: Push): Push {
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  out.vx = vel.x; out.vz = vel.z;
  let x = -sn * forward + cs * strafe, z = -cs * forward - sn * strafe;
  const len = Math.hypot(x, z);
  if (len < 1e-4 || !onGround) { out.x = 0; out.z = 0; out.speed = 0; return out; }
  x /= len; z /= len;
  out.x = x; out.z = z;
  out.speed = crouched ? TUNING.crouchSpeed : walk ? TUNING.walkSpeed : TUNING.runSpeed;
  return out;
}
