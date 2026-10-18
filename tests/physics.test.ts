import { describe, it, expect } from 'vitest';
import { newPlayer, step, box, TUNING, type Input, type PlayerState, type Box } from '../src/physics';
import { testRoom } from '../src/level';

const DT = 1 / 120;
const idle: Input = { forward: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0 };
const floor = box(0, -1, 0, 100, 1, 100);

function run(p: PlayerState, input: Partial<Input>, world: Box[], seconds: number) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(p, { ...idle, ...input }, world, DT);
}

describe('movement', () => {
  it('lands on the floor and stays grounded', () => {
    const p = newPlayer({ x: 0, y: 2, z: 0 });
    run(p, {}, [floor], 1);
    expect(p.onGround).toBe(true);
    expect(p.pos.y).toBeCloseTo(0, 2);
  });

  it('reaches run speed ~6 m/s within 0.5 s', () => {
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, {}, [floor], 0.1);
    run(p, { forward: 1 }, [floor], 0.5);
    const s = Math.hypot(p.vel.x, p.vel.z);
    expect(s).toBeGreaterThan(5.5);
    expect(s).toBeLessThanOrEqual(TUNING.runSpeed + 1e-6);
    expect(p.pos.z).toBeLessThan(0); // forward is -Z at yaw 0
  });

  it('stops from run speed in under 0.5 s', () => {
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, { forward: 1 }, [floor], 1);
    let t = 0;
    while (Math.hypot(p.vel.x, p.vel.z) > 0.05 && t < 2) { step(p, idle, [floor], DT); t += DT; }
    expect(t).toBeLessThan(0.5);
  });

  it('does not pass through a wall, even at speed', () => {
    const wall = box(0, 0, -3, 10, 4, 0.2);
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, { forward: 1 }, [floor, wall], 3);
    expect(p.pos.z).toBeGreaterThan(wall.max.z);
  });

  it('slides along a wall when moving diagonally', () => {
    const wall = box(0, 0, -2, 20, 4, 0.2);
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, { forward: 1, strafe: 1 }, [floor, wall], 2);
    expect(p.pos.x).toBeGreaterThan(3);
  });

  it('jumps about 1.1 m and lands', () => {
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, {}, [floor], 0.1);
    let peak = 0;
    step(p, { ...idle, jump: true }, [floor], DT);
    for (let i = 0; i < 240; i++) { step(p, idle, [floor], DT); peak = Math.max(peak, p.pos.y); }
    expect(peak).toBeGreaterThan(1.0);
    expect(peak).toBeLessThan(1.3);
    expect(p.onGround).toBe(true);
  });

  it('walks up stairs below step height', () => {
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    const stairs = [floor, box(0, 0, -2, 4, 0.4, 1), box(0, 0, -3, 4, 0.8, 1), box(0, 0, -9, 4, 1.2, 11)]; // long landing so we don't walk off the top
    run(p, { forward: 1 }, stairs, 1.5);
    expect(p.pos.y).toBeGreaterThan(1.1);
  });

  it('cannot walk up a 1 m block without jumping', () => {
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, { forward: 1 }, [floor, box(0, 0, -3, 4, 1, 4)], 1.5);
    expect(p.pos.y).toBeLessThan(0.1);
  });

  it('crouches under a 1.0 m gap and cannot stand up inside it', () => {
    const duct = box(0, 1.05, -4, 4, 2, 4);
    const p = newPlayer({ x: 0, y: 0, z: 0 });
    run(p, { forward: 1 }, [floor, duct], 1.5);
    expect(p.pos.z).toBeGreaterThan(-2.1); // blocked when standing
    run(p, { forward: 1, crouch: true }, [floor, duct], 1.0);
    expect(p.pos.z).toBeLessThan(-2.5);
    run(p, {}, [floor, duct], 0.2); // released crouch while under duct
    expect(p.crouched).toBe(true);
  });

  it('test room: spawn is clear and player settles on the floor', () => {
    const room = testRoom();
    const p = newPlayer(room.spawn);
    run(p, {}, room.solids.map(s => s.box), 1);
    expect(p.onGround).toBe(true);
  });
});

describe('terrain (heightfield sampler)', () => {
  // Ground rising toward -Z (forward at yaw 0) at a given angle, flat before z = 0.
  const ramp = (deg: number) => { const k = Math.tan(deg * Math.PI / 180); return (_x: number, z: number) => Math.max(0, -z) * k; };
  const runT = (p: PlayerState, input: Partial<Input>, world: Box[], ground: (x: number, z: number) => number, seconds: number, onTick?: () => void) => {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) { step(p, { ...idle, ...input }, world, DT, ground); onTick?.(); }
  };

  it('walks up a 20 deg slope at nearly full speed, feet on the ground every tick', () => {
    const g = ramp(20), p = newPlayer({ x: 0, y: 0, z: 2 });
    runT(p, {}, [], g, 0.2);
    let air = 0;
    runT(p, { forward: 1 }, [], g, 2, () => { if (!p.onGround) air++; });
    expect(air).toBe(0);
    expect(p.pos.y).toBeCloseTo(g(p.pos.x, p.pos.z), 3);
    expect(p.pos.z).toBeLessThan(-8);
  });

  it('cannot walk up a 55 deg bank, and slides along it when moving diagonally', () => {
    const g = ramp(55), p = newPlayer({ x: 0, y: 0, z: 2 });
    runT(p, { forward: 1 }, [], g, 2);
    expect(p.pos.y).toBeLessThan(0.1);
    expect(p.pos.z).toBeGreaterThan(-0.2);
    runT(p, { forward: 1, strafe: 1 }, [], g, 2);
    expect(p.pos.x).toBeGreaterThan(3);
    expect(p.pos.y).toBeLessThan(0.1);
  });

  it('stays glued walking and running down a 30 deg slope (no air ticks, no bounce)', () => {
    const g = ramp(30), p = newPlayer({ x: 0, y: g(0, -12), z: -12 });
    runT(p, {}, [], g, 0.3);
    let air = 0;
    runT(p, { forward: -1 }, [], g, 1.6, () => { if (!p.onGround) air++; });
    expect(air).toBe(0);
    expect(p.pos.z).toBeGreaterThan(-4);
  });

  it('slides off terrain steeper than the walkable limit', () => {
    const g = ramp(60), p = newPlayer({ x: 0, y: g(0, -4) + 0.01, z: -4 });
    runT(p, {}, [], g, 1.5);
    expect(p.pos.z).toBeGreaterThan(-0.5);
  });

  it('jumps off a slope and lands back on it', () => {
    const g = ramp(15), p = newPlayer({ x: 0, y: g(0, -5), z: -5 });
    runT(p, {}, [], g, 0.2);
    step(p, { ...idle, jump: true }, [], DT, g);
    expect(p.onGround).toBe(false);
    runT(p, {}, [], g, 1.0);
    expect(p.onGround).toBe(true);
    expect(p.pos.y).toBeCloseTo(g(p.pos.x, p.pos.z), 3);
  });

  it('walks down stair treads (0.2 m risers) without leaving the ground', () => {
    const flat = () => -5;
    const stairs = [0, 1, 2, 3, 4].map(i => box(0, -5, -i * 0.4 - 0.2, 3, 1 - i * 0.2 + 4, 0.4));
    stairs.push(box(0, -5, -6, 3, 4, 8)); // landing at y = -1 below the bottom tread
    const p = newPlayer({ x: 0, y: 0.01, z: 0.6 });
    stairs.push(box(0, -5, 1.5, 3, 5, 2)); // top landing at y = 0
    runT(p, {}, stairs, flat, 0.2);
    let air = 0;
    runT(p, { forward: 1, walk: true }, stairs, flat, 1.5, () => { if (!p.onGround) air++; });
    expect(p.pos.y).toBeCloseTo(-1, 1);
    expect(air).toBeLessThanOrEqual(2);
  });

  it('a box above the terrain still holds the player (no glue through solids)', () => {
    const g = () => -3, slab = box(0, -1, 0, 10, 1, 10);
    const p = newPlayer({ x: 0, y: 0.5, z: 0 });
    runT(p, { forward: 1 }, [slab], g, 0.5);
    expect(p.pos.y).toBeCloseTo(0, 2);
    expect(p.onGround).toBe(true);
  });
});
