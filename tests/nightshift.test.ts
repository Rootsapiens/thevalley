import { describe, it, expect } from 'vitest';
import { newPlayer, step, height, eyeHeight, TUNING, type Input, type PlayerState, type Box } from '../src/physics';
import { nightShift } from '../src/nightshift';
import { newFacility, use, checkTriggers } from '../src/facility';

const DT = 1 / 120;
const L = nightShift();
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0 };

function worldFor(doorOpen: boolean, collapsed: boolean): Box[] {
  return L.solids.filter(s => !(s.id === 'floodgate' && doorOpen) && !(s.id === 'catwalk-mid' && collapsed)).map(s => s.box);
}
function pbox(p: PlayerState): Box {
  return { min: { x: p.pos.x - TUNING.radius, y: p.pos.y, z: p.pos.z - TUNING.radius },
           max: { x: p.pos.x + TUNING.radius, y: p.pos.y + height(p), z: p.pos.z + TUNING.radius } };
}
function run(p: PlayerState, input: Partial<Input>, world: Box[], seconds: number, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { step(p, { ...idle, ...input }, world, DT); each?.(); }
}

describe('Night Shift walkthrough', () => {
  it('spawn settles on the floor', () => {
    const p = newPlayer(L.spawn);
    run(p, {}, worldFor(false, false), 0.5);
    expect(p.onGround).toBe(true);
  });

  it('fallen pipe blocks standing, crouch passes to the nailer', () => {
    const w = worldFor(false, false);
    const a = newPlayer(L.spawn);
    run(a, { forward: 1 }, w, 4);
    expect(a.pos.z).toBeGreaterThan(-11.5);
    const b = newPlayer(L.spawn);
    run(b, { forward: 1, crouch: true }, w, 15);
    expect(b.pos.z).toBeLessThan(-26); // reached the nailer pickup area
  });

  it('floodgate blocks the way until all 3 breakers are on', () => {
    const f = newFacility(3);
    const p = newPlayer({ x: 0, y: 0.01, z: -46 });
    run(p, { forward: 1 }, worldFor(f.doorOpen, false), 2);
    expect(p.pos.z).toBeGreaterThan(-50.1);

    const spots = [
      { x: -9.2, y: 0.01, z: -34, yaw: Math.PI / 2 },
      { x: -9.2, y: 0.01, z: -46, yaw: Math.PI / 2 },
      { x: 9.2, y: 2.41, z: -46.5, yaw: -Math.PI / 2 },
    ];
    for (const s of spots) {
      const q = newPlayer(s);
      run(q, {}, worldFor(false, false), 0.3);
      const eye = { x: q.pos.x, y: q.pos.y + eyeHeight(q), z: q.pos.z };
      const dir = { x: -Math.sin(s.yaw), y: -0.3, z: -Math.cos(s.yaw) };
      const n = Math.hypot(dir.x, dir.y, dir.z);
      use(f, eye, { x: dir.x / n, y: dir.y / n, z: dir.z / n }, L.usables);
    }
    expect(f.breakers).toEqual([true, true, true]);
    expect(f.doorOpen).toBe(true);
  });

  it('gantry breaker is reachable by walking up the stairs', () => {
    const p = newPlayer({ x: 8, y: 0.01, z: -32 });
    run(p, { forward: 1 }, worldFor(false, false), 1.4);
    expect(p.pos.y).toBeGreaterThan(2.3);
  });

  it('catwalk collapses and drops the player into the spillway', () => {
    const f = newFacility(3); f.doorOpen = true;
    const p = newPlayer({ x: 0, y: 0.01, z: -49 });
    let collapsed = false;
    run(p, { forward: 1 }, worldFor(true, false), 3, () => {
      if (!collapsed && checkTriggers(f, pbox(p), L.triggers).includes('collapse')) collapsed = true;
    });
    expect(collapsed).toBe(true);
    const q = newPlayer(p.pos);
    run(q, {}, worldFor(true, true), 2);
    expect(q.pos.y).toBeLessThan(-5.9);
    expect(q.onGround).toBe(true);
  });

  it('spillway stairs lead up to the exit and finish the chapter', () => {
    const f = newFacility(3); f.doorOpen = true; f.fired.push('t-catwalk');
    const p = newPlayer({ x: 0, y: -5.99, z: -76 });
    run(p, { forward: 1 }, worldFor(true, true), 5, () => { checkTriggers(f, pbox(p), L.triggers); });
    expect(f.finished).toBe(true);
  });

  it('every enemy and pickup spawns outside solids', () => {
    const w = worldFor(false, false);
    const inside = (pt: { x: number; y: number; z: number }) =>
      w.some(b => pt.x > b.min.x && pt.x < b.max.x && pt.y > b.min.y && pt.y < b.max.y && pt.z > b.min.z && pt.z < b.max.z);
    for (const e of L.enemies) expect(inside(e.pos), JSON.stringify(e)).toBe(false);
    for (const k of L.pickups) expect(inside(k.pos), k.id).toBe(false);
  });
});
