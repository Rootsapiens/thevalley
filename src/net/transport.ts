// Transports for the host-authoritative multiplayer. Everything above this file speaks strings only.
//  - PeerJS (free public cloud relay does the signaling; game data flows over a WebRTC DataChannel)
//  - BroadcastChannel (two tabs of one browser: used by the e2e test and for same-machine play)
//  - in-memory loopback (unit tests)

export const ROOM_PREFIX = 'omegavalley-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O/1/I/L

export function makeCode(rnd: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)];
  return s;
}
export function normaliseCode(s: string): string | null {
  const c = s.trim().toUpperCase().replace(/^OMEGAVALLEY-/, '');
  return c.length === 5 && [...c].every(ch => CODE_CHARS.includes(ch)) ? c : null;
}
export const peerIdFor = (code: string) => ROOM_PREFIX + code;

export interface HostNet {
  code: string;
  onJoin(cb: (peer: string) => void): void;
  onLeave(cb: (peer: string) => void): void;
  onData(cb: (peer: string, data: string) => void): void;
  send(peer: string, data: string): void;
  broadcast(data: string): void;
  close(): void;
}
export interface ClientNet {
  onData(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  send(data: string): void;
  close(): void;
}
export type NetKind = 'peerjs' | 'local';

// ---------- in-memory loopback ----------
type Cb<A extends unknown[]> = (...a: A) => void;
export class LoopbackHub {
  private hosts = new Map<string, MemHost>();
  host(code: string): HostNet {
    if (this.hosts.has(code)) throw new Error('code in use');
    const h = new MemHost(code, () => this.hosts.delete(code));
    this.hosts.set(code, h);
    return h;
  }
  join(code: string): ClientNet {
    const h = this.hosts.get(code);
    if (!h) throw new Error('room not found');
    return h.attach();
  }
}
class MemHost implements HostNet {
  private joins: Cb<[string]>[] = []; private leaves: Cb<[string]>[] = []; private datas: Cb<[string, string]>[] = [];
  private clients = new Map<string, MemClient>(); private n = 0;
  constructor(readonly code: string, private dispose: () => void) {}
  onJoin(cb: Cb<[string]>) { this.joins.push(cb); }
  onLeave(cb: Cb<[string]>) { this.leaves.push(cb); }
  onData(cb: Cb<[string, string]>) { this.datas.push(cb); }
  send(peer: string, data: string) { const c = this.clients.get(peer); if (c) queueMicrotask(() => c.recv(data)); }
  broadcast(data: string) { for (const id of this.clients.keys()) this.send(id, data); }
  close() { for (const c of this.clients.values()) c.remoteClosed(); this.clients.clear(); this.dispose(); }
  attach(): ClientNet {
    const id = 'c' + (++this.n);
    const c = new MemClient(
      d => queueMicrotask(() => this.datas.forEach(f => f(id, d))),
      () => { if (this.clients.delete(id)) this.leaves.forEach(f => f(id)); });
    this.clients.set(id, c);
    queueMicrotask(() => this.joins.forEach(f => f(id)));
    return c;
  }
}
class MemClient implements ClientNet {
  private datas: Cb<[string]>[] = []; private closes: Cb<[]>[] = []; private closed = false;
  constructor(private up: (d: string) => void, private leave: () => void) {}
  onData(cb: Cb<[string]>) { this.datas.push(cb); }
  onClose(cb: Cb<[]>) { this.closes.push(cb); }
  send(d: string) { if (!this.closed) this.up(d); }
  recv(d: string) { if (!this.closed) this.datas.forEach(f => f(d)); }
  remoteClosed() { if (!this.closed) { this.closed = true; this.closes.forEach(f => f()); } }
  close() { if (!this.closed) { this.closed = true; this.leave(); } }
}

// ---------- BroadcastChannel (same browser, different tabs) ----------
interface BcMsg { to: string; from: string; kind: 'join' | 'ack' | 'data' | 'leave' | 'hostclose'; data?: string }
const chName = (code: string) => 'ov-mp-' + code;

export function bcHost(code: string): HostNet {
  const ch = new BroadcastChannel(chName(code));
  const joins: Cb<[string]>[] = [], leaves: Cb<[string]>[] = [], datas: Cb<[string, string]>[] = [];
  const peers = new Set<string>();
  const post = (m: Omit<BcMsg, 'from'>) => ch.postMessage({ ...m, from: 'host' } satisfies BcMsg);
  ch.onmessage = ev => {
    const m = ev.data as BcMsg;
    if (!m || m.to !== 'host') return;
    if (m.kind === 'join') {
      post({ to: m.from, kind: 'ack' });
      if (!peers.has(m.from)) { peers.add(m.from); joins.forEach(f => f(m.from)); }
    } else if (m.kind === 'data' && peers.has(m.from) && typeof m.data === 'string') datas.forEach(f => f(m.from, m.data!));
    else if (m.kind === 'leave' && peers.delete(m.from)) leaves.forEach(f => f(m.from));
  };
  return {
    code,
    onJoin: cb => { joins.push(cb); }, onLeave: cb => { leaves.push(cb); }, onData: cb => { datas.push(cb); },
    send: (peer, data) => post({ to: peer, kind: 'data', data }),
    broadcast: data => { for (const p of peers) post({ to: p, kind: 'data', data }); },
    close: () => { for (const p of peers) post({ to: p, kind: 'hostclose' }); ch.close(); },
  };
}
export function bcJoin(code: string, timeoutMs = 3000): Promise<ClientNet> {
  return new Promise((resolve, reject) => {
    const ch = new BroadcastChannel(chName(code));
    const me = 'c' + Math.random().toString(36).slice(2, 8);
    const datas: Cb<[string]>[] = [], closes: Cb<[]>[] = [];
    let acked = false, closed = false;
    const post = (kind: BcMsg['kind'], data?: string) => ch.postMessage({ to: 'host', from: me, kind, data } satisfies BcMsg);
    const fail = (e: string) => { clearInterval(iv); clearTimeout(to); ch.close(); reject(new Error(e)); };
    ch.onmessage = ev => {
      const m = ev.data as BcMsg;
      if (!m || m.to !== me) return;
      if (m.kind === 'ack' && !acked) {
        acked = true; clearInterval(iv); clearTimeout(to);
        resolve({
          onData: cb => { datas.push(cb); }, onClose: cb => { closes.push(cb); },
          send: d => { if (!closed) post('data', d); },
          close: () => { if (!closed) { closed = true; post('leave'); ch.close(); } },
        });
      } else if (m.kind === 'data' && typeof m.data === 'string') datas.forEach(f => f(m.data!));
      else if (m.kind === 'hostclose' && !closed) { closed = true; closes.forEach(f => f()); ch.close(); }
    };
    const iv = setInterval(() => post('join'), 250);
    const to = setTimeout(() => fail('room not found'), timeoutMs);
    post('join');
  });
}

// ---------- PeerJS ----------
// Minimal structural types so the app compiles without importing peerjs eagerly (it is loaded on demand).
interface PConn { on(ev: string, cb: (...a: never[]) => void): void; send(d: unknown): void; close(): void; open: boolean; peer: string }
interface PPeer { on(ev: string, cb: (...a: never[]) => void): void; connect(id: string, o?: unknown): PConn; destroy(): void }

async function newPeer(id?: string): Promise<PPeer> {
  const { Peer } = await import('peerjs');
  return (id ? new Peer(id) : new Peer()) as unknown as PPeer;
}

export async function peerHost(openTimeoutMs = 10_000): Promise<HostNet> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const peer = await newPeer(peerIdFor(code));
    const res = await new Promise<'ok' | 'taken' | string>(resolve => {
      const to = setTimeout(() => resolve('relay unreachable'), openTimeoutMs);
      peer.on('open', (() => { clearTimeout(to); resolve('ok'); }) as never);
      peer.on('error', ((e: { type?: string; message?: string }) => { clearTimeout(to); resolve(e.type === 'unavailable-id' ? 'taken' : (e.message ?? 'peer error')); }) as never);
    });
    if (res === 'taken') { peer.destroy(); continue; }
    if (res !== 'ok') { peer.destroy(); throw new Error(res); }
    const joins: Cb<[string]>[] = [], leaves: Cb<[string]>[] = [], datas: Cb<[string, string]>[] = [];
    const conns = new Map<string, PConn>();
    peer.on('connection', ((c: PConn) => {
      c.on('open', (() => { conns.set(c.peer, c); joins.forEach(f => f(c.peer)); }) as never);
      c.on('data', ((d: unknown) => { if (typeof d === 'string') datas.forEach(f => f(c.peer, d)); }) as never);
      const gone = () => { if (conns.delete(c.peer)) leaves.forEach(f => f(c.peer)); };
      c.on('close', gone as never); c.on('error', gone as never);
    }) as never);
    return {
      code,
      onJoin: cb => { joins.push(cb); }, onLeave: cb => { leaves.push(cb); }, onData: cb => { datas.push(cb); },
      send: (p, d) => { const c = conns.get(p); if (c && c.open) c.send(d); },
      broadcast: d => { for (const c of conns.values()) if (c.open) c.send(d); },
      close: () => peer.destroy(),
    };
  }
  throw new Error('could not reserve a room code');
}

export async function peerJoin(code: string, timeoutMs = 12_000): Promise<ClientNet> {
  const peer = await newPeer();
  return new Promise<ClientNet>((resolve, reject) => {
    const fail = (e: string) => { clearTimeout(to); peer.destroy(); reject(new Error(e)); };
    const to = setTimeout(() => fail('could not connect (relay or NAT)'), timeoutMs);
    peer.on('error', ((e: { type?: string; message?: string }) => fail(e.type === 'peer-unavailable' ? 'room not found' : (e.message ?? 'peer error'))) as never);
    peer.on('open', (() => {
      const c = peer.connect(peerIdFor(code), { reliable: true, serialization: 'raw' });
      const datas: Cb<[string]>[] = [], closes: Cb<[]>[] = [];
      c.on('open', (() => {
        clearTimeout(to);
        resolve({
          onData: cb => { datas.push(cb); }, onClose: cb => { closes.push(cb); },
          send: d => { if (c.open) c.send(d); },
          close: () => peer.destroy(),
        });
      }) as never);
      c.on('data', ((d: unknown) => { if (typeof d === 'string') datas.forEach(f => f(d)); }) as never);
      c.on('close', (() => closes.forEach(f => f())) as never);
    }) as never);
  });
}

export const openHost = (kind: NetKind): Promise<HostNet> =>
  kind === 'local' ? Promise.resolve(bcHost(makeCode())) : peerHost();
export const openClient = (kind: NetKind, code: string): Promise<ClientNet> =>
  kind === 'local' ? bcJoin(code) : peerJoin(code);
