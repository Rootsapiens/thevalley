import { describe, it, expect } from 'vitest';
import { newPlayer, step, TUNING, type Box, type Input, type PlayerState } from '../src/physics';
import { makeDoor, makeButton, makeProp, useDoor, pressButton, tickEnts, pushFrom, pushScale, fire, type Ents, type Push } from '../src/entities';
import { villageSolids, PROPS, BELL_ROPE, USABLES, leafBox, groundY } from '../src/village';

const DT = 1 / 120;
const flat = () => 0;
const box = (x0: number, z0: number, x1: number, z1: number, y1 = 3): Box => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
const pbox = (p: PlayerState, out: Box = box(0, 0, 0, 0)): Box => {
  const r = TUNING.radius;
  out.min.x = p.pos.x - r; out.min.y = p.pos.y; out.min.z = p.pos.z - r;
  out.max.x = p.pos.x + r; out.max.y = p.pos.y + TUNING.standHeight; out.max.z = p.pos.z + r;
  return out;
};
const ents = (o: Partial<Ents> = {}): Ents => ({ doors: [], buttons: [], props: [], events: [], ...o });
/** The game's tick order (villageMain): entities with the last player box, then the player at the pushing pace. */
function run(e: Ents, p: PlayerState, input: Input, seconds: number, statics: Box[]) {
  const pb = pbox(p), push: Push = { x: 0, z: 0, speed: 0, vx: 0, vz: 0 };
  const world = () => [...statics, ...e.doors.filter(d => d.solid).map(d => d.box), ...e.props.map(q => q.box)];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    pushFrom(input.forward, input.strafe, input.yaw, input.walk, p.crouched, p.onGround, p.vel, push);
    const pace = pushScale(e, pb, push);   // decided on the same contact as the push itself, before the props move
    tickEnts(e, DT, pb, push, world, flat);
    step(p, { ...input, speedScale: pace }, world(), DT, flat);
    pbox(p, pb);
  }
}
const walk = (yaw: number): Input => ({ forward: 1, strafe: 0, jump: false, crouch: false, walk: true, yaw });
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: true, yaw: 0 };

describe('Doors (func_door_rotating)', () => {
  // A 1 m leaf hinged at the origin, swinging from along +x (shut) to along -z (open).
  const leaf = (t: number, out: Box) => { const a = t * Math.PI / 2, x = Math.cos(a), z = -Math.sin(a);
    out.min.x = Math.min(0, x) - 0.035; out.max.x = Math.max(0, x) + 0.035; out.min.z = Math.min(0, z) - 0.035; out.max.z = Math.max(0, z) + 0.035;
    out.min.y = 0; out.max.y = 2; return out; };

  it('swings open in its swing time, turns solid only once the player is clear, and shuts with a latch', () => {
    const d = makeDoor('d', leaf), e = ents({ doors: [d] }), far = box(5, 5, 5.7, 5.7), inLeaf = box(-0.2, -0.8, 0.2, -0.4);
    useDoor(e, d, far);
    expect(e.events).toEqual([{ type: 'open', id: 'd' }]);
    expect(d.solid).toBe(false);
    // Standing where the open leaf comes to rest: it swings through him (never pushes) and stays open, not solid.
    for (let i = 0; i < 0.74 / DT; i++) tickEnts(e, DT, inLeaf, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [], flat);
    expect(d.open).toBeLessThan(1);
    for (let i = 0; i < 0.1 / DT; i++) tickEnts(e, DT, inLeaf, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [], flat);
    expect(d.open).toBe(1);
    expect(d.solid).toBe(false);
    tickEnts(e, DT, far, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [], flat);
    expect(d.solid).toBe(true);
    e.events.length = 0;
    useDoor(e, d, far);
    for (let i = 0; i < 0.8 / DT; i++) tickEnts(e, DT, far, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [], flat);
    expect(e.events.map(v => v.type)).toEqual(['close', 'shut']);
  });

  it('will not shut on the player and rattles when locked', () => {
    const d = makeDoor('d', leaf), e = ents({ doors: [d] });
    d.open = 1; d.goal = 1;
    useDoor(e, d, box(0.3, -0.2, 0.7, 0.2));   // standing in the shut leaf's place
    expect(e.events).toEqual([{ type: 'blocked', id: 'd' }]);
    expect(d.goal).toBe(1);
    const l = makeDoor('l', leaf, { locked: true }), e2 = ents({ doors: [l] });
    useDoor(e2, l, box(5, 5, 6, 6));
    expect(e2.events).toEqual([{ type: 'locked', id: 'l' }]);
    expect(l.goal).toBe(0);
    expect(l.solid).toBe(false);   // a locked leaf is drawn shut; its wall or block is the collision
  });

  it('builds one door entity per village gate and door, shut and solid unless locked', () => {
    const ds = USABLES.map(u => makeDoor(u.id, (t, out) => leafBox(u, t, out), { locked: u.locked }));
    expect(ds.length).toBe(USABLES.length);
    for (const [i, d] of ds.entries()) { expect(d.open).toBe(0); expect(d.solid).toBe(!USABLES[i].locked); }
  });
});

describe('Buttons (func_button)', () => {
  it('fires its target once, sinks and comes back, and rests before it can be pressed again', () => {
    const b = makeButton('rope', 'bell', { wait: 5, press: 0.9 }), e = ents({ buttons: [b] });
    expect(pressButton(e, b)).toBe(true);
    expect(e.events).toEqual([{ type: 'press', id: 'rope' }, { type: 'fire', id: 'rope', target: 'bell' }]);
    expect(pressButton(e, b)).toBe(false);
    const nobody = box(50, 50, 51, 51), still: Push = { x: 0, z: 0, speed: 0, vx: 0, vz: 0 };
    for (let i = 0; i < 0.45 / DT; i++) tickEnts(e, DT, nobody, still, () => [], flat);
    expect(b.t).toBeGreaterThan(0.45); expect(b.t).toBeLessThan(0.55);   // half way down and back
    for (let i = 0; i < 4.6 / DT; i++) tickEnts(e, DT, nobody, still, () => [], flat);
    expect(b.t).toBe(1);
    expect(pressButton(e, b)).toBe(true);
  });

  it('opens a door through its targetname, locked or not', () => {
    const leaf = (_t: number, out: Box) => out, d = makeDoor('gate', leaf, { locked: true, targetname: 'g' });
    const e = ents({ doors: [d], buttons: [makeButton('lever', 'g')] });
    pressButton(e, e.buttons[0]);
    expect(d.goal).toBe(1);
    fire(e, 'g');
    expect(d.goal).toBe(0);
  });

  it('hangs the bell rope inside the tower base, reachable from its standing spot', () => {
    expect(Math.hypot(BELL_ROPE.pos.x - BELL_ROPE.from.x, BELL_ROPE.pos.z - BELL_ROPE.from.z)).toBeLessThan(2.5);
    expect(BELL_ROPE.top - BELL_ROPE.pos.y).toBeGreaterThan(1.5);
    const solids = villageSolids().map(s => s.box);
    const at = (x: number, y: number, z: number) => solids.some(b => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z);
    expect(at(BELL_ROPE.pos.x, BELL_ROPE.pos.y, BELL_ROPE.pos.z)).toBe(false);
    expect(at(BELL_ROPE.from.x, BELL_ROPE.from.y + 1, BELL_ROPE.from.z)).toBe(false);
  });
});

describe('Pushable props (func_pushable)', () => {
  it('moves ahead of the player at its pace; he follows without climbing it', () => {
    const pr = makeProp('pail', { x: 0, y: 0, z: -1 }, { x: 0.16, y: 0.16, z: 0.16 }, { follow: 0.75, drag: 7 });
    const e = ents({ props: [pr] }), p = newPlayer({ x: 0, y: 0, z: 0 });
    p.onGround = true;
    run(e, p, walk(0), 1, []);   // yaw 0 walks toward -z; contact after ~0.2 s
    const z1 = pr.pos.z;
    run(e, p, walk(0), 2, []);
    const pace = (z1 - pr.pos.z) / 2;
    expect(pace).toBeGreaterThan(TUNING.walkSpeed * 0.7);    // pushing pace: the pail's follow (0.75) of walking
    expect(pace).toBeLessThan(TUNING.walkSpeed * 0.8);
    expect(p.pos.y).toBe(0);                                  // never stepped up onto the 0.32 m pail
    expect(Math.abs(pr.pos.x)).toBeLessThan(1e-9);            // straight ahead, along the face pushed
    expect(pr.pos.z - p.pos.z).toBeGreaterThan(-(TUNING.radius + 0.16) - 0.03);   // still in front, still touching
  });

  it('slides out and stops when let go, stops dead against a wall (even fast), and never passes through it', () => {
    const pr = makeProp('stool', { x: 0, y: 0, z: 0 }, { x: 0.17, y: 0.22, z: 0.17 }, { drag: 8 });
    const e = ents({ props: [pr] }), wall = box(-2, -3.2, 2, -3.0), nobody = box(50, 50, 51, 51);
    pr.vel.z = -2;
    for (let i = 0; i < 1 / DT; i++) tickEnts(e, DT, nobody, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [wall], flat);
    expect(Math.abs(pr.vel.z)).toBe(0);
    expect(pr.pos.z).toBeCloseTo(-(2 * 2) / (2 * 8), 1);   // v^2 / 2a
    pr.vel.z = -40;                                          // 33 cm per tick against a 20 cm wall
    for (let i = 0; i < 0.5 / DT; i++) tickEnts(e, DT, nobody, { x: 0, z: 0, speed: 0, vx: 0, vz: 0 }, () => [wall], flat);
    expect(pr.pos.z).toBeGreaterThan(-3.0 + 0.17 - 1e-3);
    expect(e.events.some(v => v.type === 'bump')).toBe(true);
  });

  it('is not pushed by a player standing on it or in the air', () => {
    const pr = makeProp('stool', { x: 0, y: 0, z: -1 }, { x: 0.17, y: 0.22, z: 0.17 }), e = ents({ props: [pr] });
    const onTop: Box = { min: { x: -0.35, y: 0.44, z: -1.35 }, max: { x: 0.35, y: 2.24, z: -0.65 } };
    tickEnts(e, DT, onTop, { x: 0, z: -1, speed: 3, vx: 0, vz: -3 }, () => [], flat);
    expect(pr.vel.z).toBe(0);
    const p = newPlayer({ x: 0, y: 0, z: -0.47 }), out: Push = { x: 0, z: 0, speed: 0, vx: 0, vz: 0 };
    pushFrom(1, 0, 0, true, false, false, p.vel, out);
    expect(out.speed).toBe(0);
    expect(pushScale(e, pbox(p), out)).toBe(1);
  });

  it('is deterministic', () => {
    const go = () => {
      const pr = makeProp('pail', { x: 0.1, y: 0, z: -1 }, { x: 0.16, y: 0.16, z: 0.16 }), e = ents({ props: [pr] }), p = newPlayer({ x: 0, y: 0, z: 0 });
      p.onGround = true;
      run(e, p, walk(0.3), 2, [box(-3, -2.4, 3, -2.2)]);
      run(e, p, idle, 1, [box(-3, -2.4, 3, -2.2)]);
      return [pr.pos.x, pr.pos.z, p.pos.x, p.pos.z];
    };
    expect(go()).toEqual(go());
  });

  it('starts the barn pail and stool loose in the east alley, clear of the solids and each other', () => {
    const solids = villageSolids().map(s => s.box), ps = PROPS.map(s => makeProp(s.id, { ...s.pos, y: groundY(s.pos.x, s.pos.z) }, s.half));
    for (const pr of ps) for (const b of solids) {
      const hit = pr.box.min.x < b.max.x && pr.box.max.x > b.min.x && pr.box.min.y < b.max.y && pr.box.max.y > b.min.y && pr.box.min.z < b.max.z && pr.box.max.z > b.min.z;
      expect(hit, `${pr.id} starts inside a solid`).toBe(false);
    }
    const [a, b] = ps;
    expect(a.box.max.x < b.box.min.x || b.box.max.x < a.box.min.x || a.box.max.z < b.box.min.z || b.box.max.z < a.box.min.z).toBe(true);
  });
});
