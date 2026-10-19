// Host and client sessions: glue between the sim and a transport. No DOM, no Three.js (unit-testable over loopback).
import { MpSim, type Difficulty } from './sim';
import { RULES } from '../net/room';
import { decode, encode, checkVersion, PROTOCOL_VERSION, type InputMsg, type Snap } from '../net/protocol';
import type { HostNet, ClientNet } from '../net/transport';

export const SIM_DT = 1 / 60;
const SNAP_EVERY = 3;   // 60 Hz sim / 3 = 20 Hz snapshots

export class HostSession {
  sim: MpSim;
  readonly localId = 0;
  private peers = new Map<string, number>();
  private acc = 0;
  /** Latest snapshot (the host renders from its own sim, but keeps events for the HUD). */
  last: Snap | null = null;
  constructor(private net: HostNet | null, name: string, opts: { bots: boolean; rng?: () => number; difficulty?: Difficulty }) {
    this.sim = new MpSim(opts.rng, opts.difficulty ?? 'easy');
    this.sim.addHuman(0, name || 'Host');
    if (opts.bots) for (let i = 1; i < RULES.slots; i++) this.sim.addBot(i);
    const botsOn = opts.bots;
    this.botsOn = botsOn;
    net?.onData((peer, raw) => this.onData(peer, raw));
    net?.onLeave(peer => this.onLeave(peer));
  }
  private botsOn: boolean;
  get code(): string { return this.net?.code ?? ''; }
  get humans(): number { return this.sim.room.slots.filter(s => s.active && s.human).length; }

  private pickSlot(): number {
    const room = this.sim.room;
    const hum = [0, 0];
    for (const s of room.slots) if (s.active && s.human) hum[s.team]++;
    const free = room.slots.filter(s => !s.human);
    if (!free.length) return -1;
    free.sort((a, b) => hum[a.team] - hum[b.team] || a.id - b.id);
    return free[0].id;
  }

  private onData(peer: string, raw: string): void {
    const d = decode(raw);
    if (!d.ok) return;                       // drop bad packets
    const m = d.msg;
    if (m.t === 'hello') {
      if (this.peers.has(peer)) return;
      const bad = checkVersion(m.v);
      if (bad) { this.net?.send(peer, encode({ t: 'reject', reason: bad })); return; }
      const id = this.pickSlot();
      if (id < 0) { this.net?.send(peer, encode({ t: 'reject', reason: 'room full (6 players)' })); return; }
      this.peers.set(peer, id);
      this.sim.addHuman(id, m.name || 'Player ' + (id + 1));
      this.net?.send(peer, encode({ t: 'welcome', v: PROTOCOL_VERSION, id }));
    } else if (m.t === 'in') {
      const id = this.peers.get(peer);
      if (id !== undefined) this.sim.setInput(id, m as InputMsg);
    }
  }
  private onLeave(peer: string): void {
    const id = this.peers.get(peer);
    if (id === undefined) return;
    this.peers.delete(peer);
    this.sim.remove(id);
    if (this.botsOn) this.sim.addBot(id);    // a bot takes the empty seat
  }

  /** Advance by real elapsed seconds; returns the snapshots sent this call. */
  advance(seconds: number): Snap[] {
    this.acc = Math.min(this.acc + seconds, 0.25);
    const out: Snap[] = [];
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.sim.step(SIM_DT);
      if (this.sim.tickNo % SNAP_EVERY === 0) {
        const s = this.sim.snapshot();
        this.last = s; out.push(s);
        this.net?.broadcast(encode(s));
      }
    }
    return out;
  }
  close(): void { this.net?.close(); }
}

export class ClientSession {
  id = -1;
  status: 'joining' | 'ready' | 'rejected' | 'closed' = 'joining';
  reason = '';
  snap: Snap | null = null;
  prev: Snap | null = null;
  snapAt = 0;
  prevAt = 0;
  /** Events accumulated until the UI drains them. */
  pendingEvents: Snap['ev'] = [];
  private seq = 0;
  private fire = false;
  constructor(private net: ClientNet, name: string, private now: () => number = () => performance.now()) {
    net.onData(raw => this.onData(raw));
    net.onClose(() => { if (this.status !== 'rejected') this.status = 'closed'; });
    net.send(encode({ t: 'hello', v: PROTOCOL_VERSION, name }));
  }
  private onData(raw: string): void {
    const d = decode(raw);
    if (!d.ok) return;
    const m = d.msg;
    if (m.t === 'welcome') { this.id = m.id; this.status = 'ready'; }
    else if (m.t === 'reject') { this.status = 'rejected'; this.reason = m.reason; }
    else if (m.t === 'snap') {
      if (this.snap && m.tick <= this.snap.tick) return;   // stale or duplicate
      this.prev = this.snap; this.prevAt = this.snapAt;
      this.snap = m; this.snapAt = this.now();
      this.pendingEvents.push(...m.ev);
    }
  }
  pull(): void { this.fire = true; }
  sendInput(i: Omit<InputMsg, 't' | 'seq' | 'fire'>): void {
    if (this.status !== 'ready') return;
    const msg: InputMsg = { t: 'in', seq: ++this.seq, ...i, fire: this.fire };
    this.fire = false;
    this.net.send(encode(msg));
  }
  close(): void { this.net.close(); }
}
