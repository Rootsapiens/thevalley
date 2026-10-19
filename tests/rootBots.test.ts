import { describe, it, expect } from 'vitest';
import { lineOfSight, type Ray } from '../src/combat';
import { overlaps, type Box } from '../src/physics';
import {
  ROOT, CASTER, RIG, KNOT, newBot, newBots, tickBots, shockBot, hearShot, botPose, newPose, lashTip, torsoToWorld, rayBot,
  castShot, newCaster, newShot, tickCaster, reloadCaster, segmentBox, gone, ROOT_SPAWNS, ARENA_START,
  type RootBot, type BotEvent, type Prey, type BotWorld,
} from '../src/rootBots';

const DT = 1 / 120;
const flat = () => 0;
const world = (boxes: Box[] = []): BotWorld => ({
  los: (ax, ay, az, bx, by, bz) => lineOfSight({ x: ax, y: ay, z: az }, { x: bx, y: by, z: bz }, boxes),
  near: () => boxes,
  ground: flat,
});
const prey = (x: number, z: number, y = 0): Prey => ({ x, y, z, r: 0.35, h: 1.8 });
/** A walker standing (risen) at (x, z), facing the point (fx, fz). */
function standing(id: number, x: number, z: number, fx: number, fz: number, scale = 1): RootBot {
  const b = newBot(id, x, z, Math.atan2(-(fx - x), -(fz - z)), scale, flat);
  b.mode = 'stalk'; b.rise = 1;
  return b;
}
function run(bots: RootBot[], p: Prey, w: BotWorld, seconds: number, ev: BotEvent[] = [], each?: (t: number) => void): BotEvent[] {
  for (let i = 0; i < Math.round(seconds / DT); i++) { tickBots(bots, p, w, DT, ev); each?.(i * DT); }
  return ev;
}
/** Ticks until an event of `type` appears; returns the time it took (Infinity if it never did). */
function until(bots: RootBot[], p: Prey, w: BotWorld, type: BotEvent['type'], max = 10, ev: BotEvent[] = []): number {
  for (let i = 1; i <= Math.round(max / DT); i++) {
    const n = ev.length;
    tickBots(bots, p, w, DT, ev);
    if (ev.slice(n).some(e => e.type === type)) return i * DT;
  }
  return Infinity;
}
const idleGlow = (b: RootBot) => { const s = { ...b, mode: 'stalk' as const, t: 0, vx: 0, vz: 0 }; return botPose(s, newPose()).glow; };

describe('root walkers: waking', () => {
  it('a dormant walker wakes only when it sees the player within sight range', () => {
    const b = newBot(0, 0, 0, 0, 1, flat);
    expect(run([b], prey(0, -10), world(), 0.3).map(e => e.type)).toEqual(['wake']);
    expect(b.mode).toBe('wake');

    const wall: Box = { min: { x: -5, y: 0, z: -5.2 }, max: { x: 5, y: 3, z: -4.8 } };
    const hidden = newBot(0, 0, 0, 0, 1, flat);
    expect(run([hidden], prey(0, -10), world([wall]), 2)).toEqual([]);
    expect(hidden.mode).toBe('dormant');

    const far = newBot(0, 0, 0, 0, 1, flat);
    expect(run([far], prey(0, -(ROOT.sight + 2)), world(), 2)).toEqual([]);
  });

  it('the caster wakes dormant walkers within hearing, not the far ones', () => {
    const near = newBot(0, 0, 0, 0, 1, flat), farB = newBot(1, ROOT.hear + 3, 0, 0, 1, flat), ev: BotEvent[] = [];
    hearShot([near, farB], 0, 0, ev);
    expect(near.mode).toBe('wake');
    expect(farB.mode).toBe('dormant');
    expect(ev).toEqual([{ type: 'wake', id: 0, damage: 0 }]);
  });

  it('uproots, then stalks at walking pace, never faster than ROOT.speed', () => {
    const b = newBot(0, 0, 0, 0, 1, flat), p = prey(0, -14), w = world();
    run([b], p, w, ROOT.wake + 0.1);
    expect(b.mode).toBe('stalk');
    expect(b.rise).toBe(1);
    const z0 = b.z;
    let fastest = 0;
    run([b], p, w, 2, [], () => { fastest = Math.max(fastest, Math.hypot(b.vx, b.vz)); });
    expect(z0 - b.z).toBeGreaterThan(ROOT.speed * 2 * 0.85);
    expect(fastest).toBeLessThanOrEqual(ROOT.speed + 1e-9);
  });
});

describe('root walkers: every attack has a tell', () => {
  it('0.6 s of tell (rears back, lash arm high, knot flares) before the lash, and no damage during it', () => {
    const b = standing(0, 0, 0, 0, -3), p = prey(0, -3), w = world(), ev: BotEvent[] = [];
    const glow0 = idleGlow(b);
    expect(until([b], p, w, 'tell', 2, ev)).toBeLessThan(0.1);
    // Halfway through the tell the pose is the telegraph.
    run([b], p, w, ROOT.tell * 0.8, ev);
    const pose = botPose(b, newPose());
    expect(pose.armR).toBeLessThan(-1.5);
    expect(pose.lean).toBeGreaterThan(0.15);
    expect(pose.glow).toBeGreaterThan(glow0 + 0.3);
    const tLash = until([b], p, w, 'lash', 1, ev) + ROOT.tell * 0.8;
    expect(Math.abs(tLash - ROOT.tell)).toBeLessThanOrEqual(DT + 1e-9);
    const types = ev.map(e => e.type);
    expect(types.indexOf('tell')).toBeLessThan(types.indexOf('lash'));
    expect(types).not.toContain('hit');
  });

  it('the lash hits a player standing in reach once, for ROOT.damage, at 6 m/s', () => {
    const b = standing(0, 0, 0, 0, -3), p = prey(0, -3), w = world(), ev: BotEvent[] = [];
    until([b], p, w, 'lash', 3, ev);
    const tHit = until([b], p, w, 'hit', 1, ev);
    // From the shoulder to the player's surface (radius + lash tip) at the canon speed, within a tick.
    const shoulder = torsoToWorld(botPose(b, newPose()), RIG.shoulder.x, RIG.shoulder.y, 0, { x: 0, y: 0, z: 0 });
    const gap = Math.hypot(p.x - shoulder.x, p.z - shoulder.z) - p.r - ROOT.lashR;
    expect(tHit).toBeGreaterThan(gap / ROOT.lashSpeed - 0.05);
    expect(tHit).toBeLessThan(gap / ROOT.lashSpeed + 0.08);
    run([b], p, w, 1, ev);
    expect(ev.filter(e => e.type === 'hit')).toEqual([{ type: 'hit', id: 0, damage: ROOT.damage }]);
  });

  it('beyond the 4 m reach the lash falls short', () => {
    const b = standing(0, 0, 0, 0, -4.9), p = prey(0, -4.9), w = world(), ev: BotEvent[] = [];
    b.mode = 'tell'; b.t = DT;   // forced: a walker would not start a tell this far out
    run([b], p, w, 1.2, ev);
    expect(ev.map(e => e.type)).toEqual(['lash']);
    expect(b.lash).toBe(0);      // pulled back again
  });

  it('the lash is aimed when the tell ends: a sidestep then makes it miss', () => {
    const b = standing(0, 0, 0, 0, -3), p = prey(0, -3), w = world(), ev: BotEvent[] = [];
    until([b], p, w, 'lash', 3, ev);
    p.x += 1.4;
    run([b], p, w, 1, ev);
    expect(ev.map(e => e.type)).not.toContain('hit');
  });

  it('what you see is what hits you: the drawn lash tip is the logical tip (any yaw, scale, height)', () => {
    let checked = 0;
    for (const [fx, fz, py, scale] of [[0, -3, 0, 1], [2.2, 1.9, 0.6, 1.08], [-2.5, -1, -0.4, 0.93]] as const) {
      const b = standing(0, 0, 0, fx, fz, scale), p = prey(fx, fz, py), w = world(), ev: BotEvent[] = [];
      p.r = 0.01; p.h = 0.01;   // a thin target so the lash runs out to its full reach
      p.x = fx + 0.6;           // and misses
      until([b], p, w, 'lash', 3, ev);
      for (const dt of [0.1, 0.25, 0.4]) {
        run([b], p, w, dt);
        if (b.mode !== 'lash') break;
        const pose = botPose(b, newPose());
        const o = torsoToWorld(pose, RIG.shoulder.x, RIG.shoulder.y, 0, { x: 0, y: 0, z: 0 });
        const tip = lashTip(pose, { x: 0, y: 0, z: 0 });
        const L = Math.max(b.lash, RIG.arm * b.scale);
        expect(Math.hypot(tip.x - (o.x + b.dx * L), tip.y - (o.y + b.dy * L), tip.z - (o.z + b.dz * L))).toBeLessThan(1e-9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });
});

describe('root walkers: electricity pushes them back (world-bible §4)', () => {
  it('a shock cancels the tell, flashes the walker and knocks it back along the shot', () => {
    const b = standing(0, 0, 0, 0, -3), p = prey(0, -3), w = world(), ev: BotEvent[] = [];
    until([b], p, w, 'tell', 2, ev);
    expect(shockBot(b, 25, 0, 1, ev)).toBe(false);   // shot from the player's side, travelling +z
    expect(b.mode).toBe('flinch');
    expect(b.flash).toBe(1);
    const z0 = b.z;
    run([b], p, w, ROOT.flinch, ev);
    expect(b.z).toBeGreaterThan(z0 + 0.2);
    expect(ev.map(e => e.type)).toEqual(['tell', 'flinch']);
  });

  it('the first drop under half health drives it back; then it comes back at 1 m/s, once', () => {
    const b = standing(0, 0, 0, 0, -6), p = prey(0, -6), w = world(), ev: BotEvent[] = [];
    shockBot(b, 25, 0, 1, ev);
    run([b], p, w, ROOT.flinch + 0.05, ev);
    expect(b.mode).toBe('stalk');
    shockBot(b, 25, 0, 1, ev);
    expect(b.health).toBe(50);
    const d0 = Math.hypot(b.x - p.x, b.z - p.z);
    run([b], p, w, ROOT.flinch + 0.05, ev);
    expect(b.mode).toBe('retreat');
    run([b], p, w, ROOT.retreat, ev);
    expect(Math.hypot(b.x - p.x, b.z - p.z)).toBeGreaterThan(d0 + ROOT.retreatSpeed * ROOT.retreat * 0.8);
    expect(b.mode).toBe('stalk');
    let fastest = 0;
    run([b], p, w, ROOT.backTime * 0.9, ev, () => { fastest = Math.max(fastest, Math.hypot(b.vx, b.vz)); });
    expect(fastest).toBeLessThanOrEqual(ROOT.back + 1e-9);
    expect(fastest).toBeGreaterThan(ROOT.back * 0.8);
    shockBot(b, 10, 0, 1, ev);
    run([b], p, w, ROOT.flinch + 0.05, ev);
    expect(ev.filter(e => e.type === 'retreat').length).toBe(1);
  });

  it('death at zero health: no more attacks, no more hits, it topples and sinks out of sight', () => {
    const b = standing(0, 0, 0, 0, -3), p = prey(0, -3), w = world(), ev: BotEvent[] = [];
    expect(shockBot(b, ROOT.health, 0, 1, ev)).toBe(true);
    expect(b.mode).toBe('dead');
    expect(shockBot(b, 25, 0, 1, ev)).toBe(false);
    const ray: Ray = { o: { x: 0, y: 1.2, z: -3 }, d: { x: 0, y: 0, z: 1 } };
    expect(rayBot(ray, b, { t: 0, knot: false }).t).toBe(Infinity);
    run([b], p, w, ROOT.fall * 0.5, ev);
    expect(botPose(b, newPose()).topple).toBeGreaterThan(0.5);
    run([b], p, w, 4, ev);
    expect(gone(b)).toBe(true);
    expect(botPose(b, newPose()).y).toBeLessThan(-2);
    expect(ev.map(e => e.type)).toEqual(['dead']);
  });
});

describe('root walkers: steering', () => {
  it('a pack keeps apart, never overlaps the player, and at most two attack at once', () => {
    const p = prey(0, 0), w = world();
    const bots = [[-6, 2], [6, 1], [0, 7], [-4, -6]].map(([x, z], i) => standing(i, x, z, 0, 0));
    let most = 0, closest = Infinity, toPlayer = Infinity;
    run(bots, p, w, 8, [], t => {
      most = Math.max(most, bots.filter(b => b.mode === 'tell' || b.mode === 'lash').length);
      if (t < 1) return;
      for (const a of bots) {
        toPlayer = Math.min(toPlayer, Math.hypot(a.x - p.x, a.z - p.z));
        for (const c of bots) if (a !== c) closest = Math.min(closest, Math.hypot(a.x - c.x, a.z - c.z));
      }
    });
    expect(most).toBe(ROOT.maxAttackers);
    expect(closest).toBeGreaterThan(ROOT.radius * 2);
    expect(toPlayer).toBeGreaterThanOrEqual(ROOT.radius + p.r);
  });

  it('slides round a wall instead of walking through it', () => {
    const wall: Box = { min: { x: -1.5, y: 0, z: -3.2 }, max: { x: 1.5, y: 2.5, z: -2.8 } };
    const b = standing(0, 0, 0, 0, -8), p = prey(0, -8), w = world([wall]);
    b.sees = true; b.losT = 99;   // it knows where he is
    let inside = false;
    run([b], p, w, 8, [], () => {
      const r = ROOT.radius;
      if (overlaps({ min: { x: b.x - r, y: b.y + ROOT.step, z: b.z - r }, max: { x: b.x + r, y: b.y + 1.9, z: b.z + r } }, wall)) inside = true;
    });
    expect(inside).toBe(false);
    expect(b.z).toBeLessThan(-4);   // got round it
  });

  it('is deterministic: the same fight twice is the same to the last bit', () => {
    const fight = () => {
      const bots = newBots(flat), p = prey(ARENA_START.x, ARENA_START.z), w = world(), ev: BotEvent[] = [];
      run(bots, p, w, 3, ev);
      shockBot(bots[0], 25, 1, 0, ev);
      run(bots, p, w, 3, ev);
      return JSON.stringify({ bots, ev });
    };
    expect(fight()).toBe(fight());
  });

  it('spawns are spread out in front of the arena start', () => {
    expect(ROOT_SPAWNS.length).toBeGreaterThanOrEqual(3);
    expect(ROOT_SPAWNS.length).toBeLessThanOrEqual(Math.min(5, ROOT.max));
    for (const [i, s] of ROOT_SPAWNS.entries()) {
      expect(s.x - ARENA_START.x).toBeGreaterThan(8);   // east of the start, which faces east
      for (const o of ROOT_SPAWNS.slice(i + 1)) expect(Math.hypot(s.x - o.x, s.z - o.z)).toBeGreaterThan(ROOT.separation * 3);
    }
  });
});

describe('spark caster', () => {
  it('six charges, a cooldown, the crank from the reserve; a spent jar clicks', () => {
    const c = newCaster(), ray: Ray = { o: { x: 0, y: 1.6, z: 0 }, d: { x: 0, y: 0, z: -1 } }, shot = newShot(), ev: BotEvent[] = [];
    let fired = 0;
    for (let i = 0; i < 400 && fired < CASTER.mag; i++) { if (castShot(c, ray, [], Infinity, ev, shot).fired) fired++; tickCaster(c, DT); }
    expect(fired).toBe(CASTER.mag);
    expect(c.mag).toBe(0);
    expect(c.reloading).toBeGreaterThan(0);                       // cranks by itself after the last charge
    expect(castShot(c, ray, [], Infinity, ev, shot).fired).toBe(false);
    let charged = false;
    for (let i = 0; i < Math.ceil(CASTER.reload / DT) + 1; i++) charged = tickCaster(c, DT) || charged;
    expect(charged).toBe(true);
    expect([c.mag, c.reserve]).toEqual([CASTER.mag, CASTER.reserve - CASTER.mag]);
    expect(reloadCaster(c)).toBe(false);                          // full
    c.mag = 0; c.reserve = 0; c.cooldown = 0;
    const s = castShot(c, ray, [], Infinity, ev, shot);
    expect([s.fired, s.empty, c.reloading]).toEqual([false, true, 0]);
  });

  it('a shot cannot come faster than the cooldown', () => {
    const c = newCaster(), ray: Ray = { o: { x: 0, y: 1.6, z: 0 }, d: { x: 0, y: 0, z: -1 } }, shot = newShot();
    const times: number[] = [];
    for (let i = 0; i < 120; i++) { if (castShot(c, ray, [], Infinity, [], shot).fired) times.push(i * DT); tickCaster(c, DT); }
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(CASTER.cooldown - 1e-9);
  });

  it('hitscan: the knot doubles the damage, the body takes the base, a wall in front stops it, the nearer walker takes it', () => {
    const shot = newShot(), ev: BotEvent[] = [];
    const aim = (b: RootBot, x: number, y: number, z: number, from: { x: number; y: number; z: number }): Ray => {
      const d = { x: x - from.x, y: y - from.y, z: z - from.z }, n = Math.hypot(d.x, d.y, d.z);
      void b;
      return { o: from, d: { x: d.x / n, y: d.y / n, z: d.z / n } };
    };
    const eye = { x: 0, y: 1.64, z: 10 };
    const b = standing(0, 0, 0, eye.x, eye.z);
    const k = torsoToWorld(botPose(b, newPose()), 0, KNOT.y, KNOT.z, { x: 0, y: 0, z: 0 });
    let s = castShot(newCaster(), aim(b, k.x, k.y, k.z, eye), [b], Infinity, ev, shot);
    expect([s.fired, s.bot, s.knot, b.health]).toEqual([true, 0, true, ROOT.health - CASTER.damage * CASTER.knot]);

    const c = standing(0, 0, 0, eye.x, eye.z);
    s = castShot(newCaster(), aim(c, 0, 0.95, 0, eye), [c], Infinity, ev, shot);
    expect([s.bot, s.knot, c.health]).toEqual([0, false, ROOT.health - CASTER.damage]);

    const d = standing(0, 0, 0, eye.x, eye.z);
    s = castShot(newCaster(), aim(d, 0, 1.2, 0, eye), [d], 3, ev, shot);
    expect([s.fired, s.bot, s.t, d.health]).toEqual([true, -1, 3, ROOT.health]);

    const far = standing(1, 0, -3, eye.x, eye.z), nearB = standing(2, 0, 0, eye.x, eye.z);
    s = castShot(newCaster(), aim(nearB, 0, 1.0, 0, eye), [far, nearB], Infinity, ev, shot);
    expect([s.bot, far.health, nearB.health]).toEqual([2, ROOT.health, ROOT.health - CASTER.damage]);
  });

  it('segmentBox: entry fraction, inside is 0, misses are Infinity', () => {
    const b: Box = { min: { x: 1, y: -1, z: -1 }, max: { x: 2, y: 1, z: 1 } };
    expect(segmentBox(0, 0, 0, 4, 0, 0, b)).toBeCloseTo(0.25, 12);
    expect(segmentBox(1.5, 0, 0, 4, 0, 0, b)).toBe(0);
    expect(segmentBox(0, 2, 0, 4, 0, 0, b)).toBe(Infinity);
    expect(segmentBox(0, 0, 0, 0.5, 0, 0, b)).toBe(Infinity);   // stops short
    expect(segmentBox(3, 0, 0, -4, 0, 0, b)).toBeCloseTo(0.25, 12);
  });
});
