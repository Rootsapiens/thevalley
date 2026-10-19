import { describe, it, expect } from 'vitest';
import { MpSim, DIFFICULTY, botAimError, hitscan, lookDir, nav, spawnFor, SOLIDS, GROUND, BOUNDS, PROTECT, HUMAN_HP, REGEN_DELAY } from '../src/mp/sim';
import { findPath, isFree } from '../src/mp/nav';
import { RULES } from '../src/net/room';

const seeded = () => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const run = (sim: MpSim, sec: number) => { for (let t = 0; t < sec - 1e-9; t += 1 / 60) sim.step(1 / 60); };
const duel = (diff: 'easy' | 'medium' | 'hard' = 'easy') => {   // human (Ravens, 0) vs one bot (Village, 1), no other seats
  const sim = new MpSim(seeded(), diff); sim.addHuman(0, 'h'); sim.addBot(1);
  return sim;
};

describe('fair bots', () => {
  it('easy bots hit at most ~45% from 20 m once fully settled (Monte Carlo through the real hitscan)', () => {
    const rnd = seeded(), T = DIFFICULTY.easy, err = botAimError(T, 99);
    const target = { id: 1, pos: { x: 0, y: 0, z: 0 }, crouched: false };
    let hits = 0; const n = 4000;
    for (let i = 0; i < n; i++) {
      const r = err * Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
      const d = lookDir(Math.PI + r * Math.cos(a), Math.atan2(1.2 - 1.64, 20) + r * Math.sin(a));
      if (hitscan([0, 1.64, -20], d, [target], [])) hits++;
    }
    expect(hits / n).toBeLessThan(0.46);
    expect(hits / n).toBeGreaterThan(0.2);
  });
  it('aim error shrinks with time on target and harder tiers are sharper and faster', () => {
    const T = DIFFICULTY.easy;
    expect(botAimError(T, 0)).toBeGreaterThan(botAimError(T, 1)); expect(botAimError(T, 1)).toBeGreaterThan(botAimError(T, 10) - 1e-9);
    expect(DIFFICULTY.hard.floor).toBeLessThan(DIFFICULTY.easy.floor);
    expect(DIFFICULTY.hard.react[1]).toBeLessThan(DIFFICULTY.easy.react[0]);
    expect(DIFFICULTY.easy.react).toEqual([0.6, 1.0]);
    expect(DIFFICULTY.easy.damage).toBeLessThan(34);
  });
  it('no shots during freeze; a bot waits its reaction time before the first shot', () => {
    const sim = duel();
    // put them in the open facing each other
    sim.bodies[0].pos.x = 10; sim.bodies[0].pos.z = 41; sim.bodies[1].pos.x = 30; sim.bodies[1].pos.z = 41;
    run(sim, RULES.freeze - 0.5);
    expect(sim.events.filter(e => e.k === 'shot')).toHaveLength(0);
    run(sim, 0.6);                                   // live now
    sim.bodies[0].pos.x = 10; sim.bodies[0].pos.z = 41; sim.bodies[1].pos.x = 30; sim.bodies[1].pos.z = 41;
    sim.events = [];
    run(sim, 0.5);
    expect(sim.events.filter(e => e.k === 'shot')).toHaveLength(0);   // < 0.6 s since spotting
  });
  it('humans have 150 HP, spawn protection absorbs shots for 3 s, then damage lands; regen after 4 s', () => {
    const sim = duel();
    expect(sim.hp[0]).toBe(HUMAN_HP); expect(sim.hp[1]).toBe(100);
    run(sim, RULES.freeze + 0.1);
    expect(sim.prot[0]).toBeGreaterThan(PROTECT - 0.2);
    sim.bodies[0].pos.x = 10; sim.bodies[0].pos.z = 41; sim.bodies[1].pos.x = 30; sim.bodies[1].pos.z = 41;
    const aimAt1 = () => { sim.ctl[0].yaw = -Math.PI / 2; sim.ctl[0].pitch = Math.atan2(1.2 - 1.64, 20); };
    aimAt1(); sim.setInput(0, { ...sim.ctl[0], fwd: 0, str: 0, jump: false, crouch: false, fire: false });
    sim.brains[1] = null;   // the target stands still and does not shoot
    sim.ctl[1].yaw = Math.PI / 2;
    const shootOnce = () => { aimAt1(); sim.ctl[0].fire = true; run(sim, 0.35); };
    shootOnce(); shootOnce();
    expect(sim.hp[1]).toBe(100);                      // protected
    run(sim, PROTECT);
    const before = sim.hp[1]; shootOnce(); shootOnce();
    expect(sim.hp[1]).toBeLessThan(before);
    // human regen: damage the human, wait
    sim.hp[0] = 100; sim.sinceHit[0] = 0; run(sim, REGEN_DELAY - 0.5); expect(sim.hp[0]).toBe(100);
    run(sim, 3); expect(sim.hp[0]).toBeGreaterThan(100);
  });
});

describe('village map and waypoint graph', () => {
  it('spawns are free, on the ground, and the graph links the two sides', () => {
    for (let id = 0; id < 6; id++) { const s = spawnFor(id); expect(isFree(SOLIDS, GROUND, s.x, s.z, 0.4)).toBe(true); expect(s.x).toBeGreaterThan(BOUNDS.x0); expect(s.x).toBeLessThan(BOUNDS.x1); }
    const N = nav(); expect(N.nodes.length).toBeGreaterThan(60);
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
      const p = findPath(N, spawnFor(a), spawnFor(b)); expect(p, `${a}->${b}`).not.toBeNull();
      for (const q of p!) expect(isFree(SOLIDS, GROUND, q.x, q.z)).toBe(true);
    }
  });
  it('a cut graph gives no path', () => {
    const N = nav();
    expect(findPath({ nodes: N.nodes, adj: N.nodes.map(() => []) }, spawnFor(0), spawnFor(1))).toBeNull();
  });
  it('bots in a 5-bot match keep moving: nobody sits in one place for 20 s of live time', () => {
    const sim = new MpSim(seeded(), 'easy'); sim.addHuman(0, 'h'); for (let i = 1; i < 6; i++) sim.addBot(i);
    run(sim, RULES.freeze + PROTECT + 1);
    const p0 = sim.bodies.map(b => ({ x: b.pos.x, z: b.pos.z }));
    run(sim, 20);
    for (let i = 1; i < 6; i++) if (sim.room.slots[i].alive) expect(Math.hypot(sim.bodies[i].pos.x - p0[i].x, sim.bodies[i].pos.z - p0[i].z)).toBeGreaterThan(1.5);
  });
});

