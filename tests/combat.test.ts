import { describe, it, expect } from 'vitest';
import {
  rayBox, raySphere, lineOfSight, newDrifter, updateDrifter, damageDrifter, newArsenal, fire,
  tickArsenal, startReload, switchWeapon, DRIFTER, WEAPONS, type Ray, type Target,
} from '../src/combat';
import { box, newPlayer } from '../src/physics';
import { serialize, parse, SAVE_VERSION } from '../src/save';

const DT = 1 / 120;
const fwd = (z = 0): Ray => ({ o: { x: 0, y: 1.6, z }, d: { x: 0, y: 0, z: -1 } });
const target = (x = 0, z = 0): Target => ({ center: { x, y: 1.1, z }, feet: { x, y: 0, z }, radius: 0.35, height: 1.8 });

describe('rays', () => {
  it('hits a box in front and misses one behind', () => {
    expect(rayBox(fwd(), box(0, 0, -5, 2, 4, 1))).toBeCloseTo(4.5);
    expect(rayBox(fwd(), box(0, 0, 5, 2, 4, 1))).toBe(Infinity);
  });
  it('hits a sphere at the right distance', () => {
    expect(raySphere(fwd(), { x: 0, y: 1.6, z: -10 }, 0.5)).toBeCloseTo(9.5);
    expect(raySphere(fwd(), { x: 3, y: 1.6, z: -10 }, 0.5)).toBe(Infinity);
  });
  it('line of sight is blocked by a wall', () => {
    const wall = box(0, 0, -5, 4, 4, 0.5);
    expect(lineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -10 }, [wall])).toBe(false);
    expect(lineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -10 }, [])).toBe(true);
  });
});

describe('nail driver', () => {
  it('semi-auto: cooldown blocks the next shot', () => {
    const a = newArsenal(); switchWeapon(a, 'nailer'); a.cooldown = 0;
    expect(fire(a, fwd(), [], []).fired).toBe(true);
    expect(fire(a, fwd(), [], []).fired).toBe(false);
  });
  it('damages a drifter and a wall stops the nail', () => {
    const a = newArsenal(); switchWeapon(a, 'nailer'); a.cooldown = 0;
    const d = newDrifter(0, { x: 0, y: 1.6, z: -8 });
    fire(a, fwd(), [d], []);
    expect(d.health).toBe(DRIFTER.health - WEAPONS.nailer.damage);
    tickArsenal(a, 1);
    const d2 = newDrifter(1, { x: 0, y: 1.6, z: -8 });
    fire(a, fwd(), [d2], [box(0, 0, -4, 4, 4, 0.5)]);
    expect(d2.health).toBe(DRIFTER.health);
  });
  it('empties the mag then auto-reloads from reserve', () => {
    const a = newArsenal(); switchWeapon(a, 'nailer');
    const startReserve = a.reserve;
    for (let i = 0; i < 12; i++) { tickArsenal(a, 1); fire(a, fwd(), [], []); }
    expect(a.mag).toBe(0);
    expect(a.reloading).toBeGreaterThan(0);
    tickArsenal(a, WEAPONS.nailer.reload + 0.01);
    expect(a.mag).toBe(12);
    expect(a.reserve).toBe(startReserve - 12);
  });
  it('manual reload does nothing on a full mag or with the wrench', () => {
    const a = newArsenal();
    expect(startReload(a)).toBe(false);
    switchWeapon(a, 'nailer');
    expect(startReload(a)).toBe(false);
  });
});

describe('wrench', () => {
  it('hits within range only', () => {
    const a = newArsenal();
    const near = newDrifter(0, { x: 0, y: 1.6, z: -1.5 });
    const far = newDrifter(1, { x: 0, y: 1.6, z: -4 });
    fire(a, fwd(), [far], []);
    expect(far.health).toBe(DRIFTER.health);
    tickArsenal(a, 1);
    fire(a, fwd(), [near], []);
    expect(near.health).toBe(DRIFTER.health - WEAPONS.wrench.damage);
  });
});

describe('drifter', () => {
  it('stays idle without line of sight, wakes when it sees the player', () => {
    const d = newDrifter(0, { x: 0, y: 1.3, z: -10 });
    const wall = box(0, 0, -5, 6, 4, 0.5);
    updateDrifter(d, target(), [wall], DT);
    expect(d.mode).toBe('idle');
    updateDrifter(d, target(), [], DT);
    expect(d.mode).toBe('chase');
  });
  it('chases, winds up, lunges and deals damage exactly once per lunge', () => {
    const d = newDrifter(0, { x: 0, y: 1.3, z: -10 });
    let dmg = 0; const modes = new Set<string>();
    for (let i = 0; i < 120 * 6; i++) { dmg += updateDrifter(d, target(), [], DT); modes.add(d.mode); if (d.mode === 'recover') break; }
    expect([...modes]).toEqual(expect.arrayContaining(['chase', 'windup', 'lunge', 'recover']));
    expect(dmg).toBe(DRIFTER.damage);
  });
  it('a lunge can be dodged by moving sideways', () => {
    const d = newDrifter(0, { x: 0, y: 1.3, z: -3 });
    let t = target(); let dmg = 0;
    for (let i = 0; i < 240; i++) {
      if (d.mode === 'lunge') t = target(3, 0); // sidestep after the lunge starts
      dmg += updateDrifter(d, t, [], DT);
      if (d.mode === 'recover') break;
    }
    expect(dmg).toBe(0);
  });
  it('dies at 0 health, and a hit wakes an idle drifter', () => {
    const d = newDrifter(0, { x: 0, y: 1.3, z: -10 });
    damageDrifter(d, 5);
    expect(d.mode).toBe('chase');
    damageDrifter(d, 100);
    expect(d.mode).toBe('dead');
    expect(updateDrifter(d, target(0, -10), [], DT)).toBe(0);
  });
  it('does not fly through walls while chasing', () => {
    const d = newDrifter(0, { x: 0, y: 1.3, z: -10 });
    d.mode = 'chase';
    const wall = box(0, 0, -6, 2, 4, 0.5);
    for (let i = 0; i < 600; i++) updateDrifter(d, target(), [wall], DT);
    expect(d.pos.z).toBeLessThan(-6.25 - DRIFTER.radius + 1e-3);
  });
});

describe('save', () => {
  it('round-trips a snapshot', () => {
    const snap = {
      player: newPlayer({ x: 1, y: 2, z: 3 }), health: 77, yaw: 1, pitch: -0.2,
      arsenal: newArsenal(), enemies: [newDrifter(0, { x: 4, y: 1.3, z: 5 })],
    };
    snap.enemies[0].mode = 'chase';
    expect(parse(serialize(snap))).toEqual(snap);
  });
  it('refuses unknown versions and garbage', () => {
    expect(parse(JSON.stringify({ version: SAVE_VERSION + 1, data: {} }))).toBeNull();
    expect(parse('not json')).toBeNull();
    expect(parse('{}')).toBeNull();
  });
});
