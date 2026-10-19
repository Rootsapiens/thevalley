import { describe, it, expect } from 'vitest';
import { LoopbackHub, bcHost, bcJoin, makeCode, normaliseCode } from '../src/net/transport';
import { HostSession, ClientSession } from '../src/mp/session';
import { encode, PROTOCOL_VERSION } from '../src/net/protocol';
import { lookDir, hitscan, spawnFor, SOLIDS } from '../src/mp/sim';
import { RULES } from '../src/net/room';

const adv = (h: HostSession, sec: number) => { for (let t = 0; t < sec; t += 0.1) h.advance(0.1); };
const flush = () => new Promise(r => setTimeout(r, 5));

describe('codes', () => {
  it('makes 5-char codes without ambiguous letters and normalises input', () => {
    for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    expect(normaliseCode(' abcde ')).toBe('ABCDE'); expect(normaliseCode('omegavalley-abcde')).toBe('ABCDE');
    expect(normaliseCode('ab0de')).toBeNull(); expect(normaliseCode('abc')).toBeNull();
  });
});

describe('loopback transport', () => {
  it('delivers both ways and reports join/leave', async () => {
    const hub = new LoopbackHub(), h = hub.host('ABCDE');
    const log: string[] = [];
    h.onJoin(p => log.push('join ' + p)); h.onLeave(p => log.push('leave ' + p)); h.onData((p, d) => log.push(`${p}:${d}`));
    const c = hub.join('ABCDE'); c.onData(d => log.push('c:' + d));
    c.send('hi'); await flush(); h.broadcast('yo'); await flush(); c.close(); await flush();
    expect(log).toEqual(['join c1', 'c1:hi', 'c:yo', 'leave c1']);
    expect(() => hub.join('ZZZZZ')).toThrow();
  });
});

describe('BroadcastChannel transport', () => {
  it('joins by code and exchanges data; unknown room times out', async () => {
    const h = bcHost('BCTST'); const got: string[] = [];
    h.onData((_p, d) => { got.push(d); h.broadcast('pong'); });
    const c = await bcJoin('BCTST'); const back: string[] = []; c.onData(d => back.push(d));
    c.send('ping'); await new Promise(r => setTimeout(r, 50));
    expect(got).toEqual(['ping']); expect(back).toEqual(['pong']);
    c.close(); h.close();
    await expect(bcJoin('NOONE', 300)).rejects.toThrow(/room not found/);
  });
});

describe('host + client session over loopback', () => {
  const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  it('a client joins, shoots the host, the round and score update', async () => {
    const hub = new LoopbackHub(), net = hub.host('ROOM1');
    const host = new HostSession(net, 'Host', { bots: false, rng: seeded() });
    const cli = new ClientSession(hub.join('ROOM1'), 'Guest', () => 0);
    await flush();
    expect(cli.status).toBe('ready'); expect(cli.id).toBe(1);          // Village seat
    adv(host, RULES.freeze + 0.5);
    expect(host.sim.room.phase).toBe('live');
    // The guest (Village, south) aims at the host (Ravens, north) and pulls the trigger until it drops.
    const me = spawnFor(1), foe = spawnFor(0);
    const yaw = Math.atan2(-(foe.x - me.x), -(foe.z - me.z));
    const pitch = Math.atan2(1.2 - 1.64, Math.hypot(foe.x - me.x, foe.z - me.z));
    for (let i = 0; i < 6 && host.sim.room.phase === 'live'; i++) {
      cli.pull(); cli.sendInput({ fwd: 0, str: 0, yaw, pitch, jump: false, crouch: false });
      await flush(); adv(host, 0.4);
    }
    expect(host.sim.room.phase).toBe('roundEnd');
    expect(host.sim.room.score).toEqual([0, 1]);
    await flush(); host.advance(0.1); await flush();
    expect(cli.snap?.sc).toEqual([0, 1]);
    expect(cli.snap?.p.find(p => p.i === 1)?.k).toBe(1);
  });

  it('refuses a wrong protocol version and a seventh player', async () => {
    const hub = new LoopbackHub(), net = hub.host('ROOM2');
    const host = new HostSession(net, 'H', { bots: true });
    const raw = hub.join('ROOM2'); const replies: string[] = []; raw.onData(d => replies.push(d));
    raw.send(encode({ t: 'hello', v: PROTOCOL_VERSION + 9, name: 'old' })); await flush();
    expect(replies[0]).toMatch(/version mismatch/);
    const clients = [1, 2, 3, 4, 5].map(i => new ClientSession(hub.join('ROOM2'), 'c' + i)); await flush();
    expect(clients.map(c => c.status)).toEqual(Array(5).fill('ready'));
    expect(new Set(clients.map(c => c.id)).size).toBe(5);
    const extra = new ClientSession(hub.join('ROOM2'), 'extra'); await flush();
    expect(extra.status).toBe('rejected'); expect(extra.reason).toMatch(/full/);
    expect(host.humans).toBe(6);
  });

  it('ignores garbage packets and a leaving player is replaced by a bot', async () => {
    const hub = new LoopbackHub(), net = hub.host('ROOM3');
    const host = new HostSession(net, 'H', { bots: true });
    const c = hub.join('ROOM3'); c.send('garbage'); c.send('{"t":"in"}'); await flush();
    const cli = new ClientSession(hub.join('ROOM3'), 'g'); await flush();
    expect(host.sim.room.slots[cli.id].human).toBe(true);
    cli.close(); await flush();
    expect(host.sim.room.slots[1].active).toBe(true); expect(host.sim.room.slots[1].human).toBe(false);
  });
});

describe('hitscan and bots', () => {
  it('walls block shots; targets are hit with head bonus', () => {
    const o: [number, number, number] = [0, 1.6, -10];
    const t = { id: 3, pos: { x: 0, y: 0, z: 0 }, crouched: false };
    expect(hitscan(o, lookDir(0, 0), [t])).toBeNull();
    expect(hitscan(o, lookDir(Math.PI, 0), [t])?.id).toBe(3);
    expect(hitscan(o, lookDir(Math.PI, 0), [t])?.head).toBe(true);
    expect(hitscan([0, 1, -10], lookDir(Math.PI, 0), [{ ...t, pos: { x: 0, y: 0, z: 30 } }], [{ min: { x: -5, y: 0, z: 5 }, max: { x: 5, y: 3, z: 6 } }])).toBeNull();
    expect(SOLIDS.length).toBeGreaterThan(4);
  });
  it('bodies stand on the flat ground and bots stay inside the walls', () => {
    const hub = new LoopbackHub(), host = new HostSession(hub.host('FLOOR'), 'H', { bots: true });
    adv(host, 20);
    for (const b of host.sim.bodies) { expect(Math.abs(b.pos.y)).toBeLessThan(0.05); expect(Math.abs(b.pos.x)).toBeLessThan(22); expect(Math.abs(b.pos.z)).toBeLessThan(22); }
  });
  it('a bot match runs 90 s of game time without NaN and scores rounds', () => {
    const hub = new LoopbackHub(), host = new HostSession(hub.host('BOTSX'), 'H', { bots: true });
    for (let i = 0; i < 60 * 90; i++) host.advance(1 / 60);
    for (const b of host.sim.bodies) expect(Number.isFinite(b.pos.x + b.pos.y + b.pos.z)).toBe(true);
    const sl = host.sim.room.slots;
    expect(sl.reduce((n, s) => n + s.kills, 0)).toBeGreaterThan(0);
  });
});
