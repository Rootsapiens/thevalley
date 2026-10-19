// Multiplayer wire protocol: plain JSON strings over a DataChannel. Pure, no DOM, no Three.js.
// decode() never throws: a bad packet comes back as { ok: false } and the caller drops it.

export const PROTOCOL_VERSION = 1;
export type Team = 0 | 1;   // 0 = Ravens, 1 = Village
export const TEAM_NAMES = ['Ravens', 'Village'] as const;

export type Phase = 'waiting' | 'freeze' | 'live' | 'roundEnd' | 'matchEnd';
export const PHASES: readonly Phase[] = ['waiting', 'freeze', 'live', 'roundEnd', 'matchEnd'];

export interface Hello { t: 'hello'; v: number; name: string }
export interface Welcome { t: 'welcome'; v: number; id: number }
export interface Reject { t: 'reject'; reason: string }
/** Client input, sent ~30 Hz. fire = a trigger pull happened since the last packet. */
export interface InputMsg { t: 'in'; seq: number; fwd: number; str: number; yaw: number; pitch: number; jump: boolean; crouch: boolean; fire: boolean }
export interface PSnap { i: number; n: string; x: number; y: number; z: number; yw: number; pt: number; hp: number; a: boolean; h: boolean; tm: Team; k: number; d: number }
export type GameEvent =
  | { k: 'kill'; a: number; v: number }
  | { k: 'shot'; i: number; x: number; y: number; z: number; tx: number; ty: number; tz: number; hit: boolean }
  | { k: 'round'; w: Team; why: string }
  | { k: 'match'; w: Team };
export interface Snap { t: 'snap'; tick: number; ph: Phase; tl: number; rd: number; sc: [number, number]; p: PSnap[]; ev: GameEvent[] }
export type Msg = Hello | Welcome | Reject | InputMsg | Snap;

export type Decoded = { ok: true; msg: Msg } | { ok: false; error: string };

export function encode(m: Msg): string { return JSON.stringify(m); }

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown, max = 64): x is string => typeof x === 'string' && x.length <= max;
const bool = (x: unknown): x is boolean => typeof x === 'boolean';
const bad = (error: string): Decoded => ({ ok: false, error });
const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

function okPlayer(p: unknown): p is PSnap {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return num(o.i) && str(o.n, 24) && num(o.x) && num(o.y) && num(o.z) && num(o.yw) && num(o.pt) && num(o.hp)
    && bool(o.a) && bool(o.h) && (o.tm === 0 || o.tm === 1) && num(o.k) && num(o.d);
}
function okEvent(e: unknown): e is GameEvent {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  switch (o.k) {
    case 'kill': return num(o.a) && num(o.v);
    case 'shot': return num(o.i) && num(o.x) && num(o.y) && num(o.z) && num(o.tx) && num(o.ty) && num(o.tz) && bool(o.hit);
    case 'round': return (o.w === 0 || o.w === 1) && str(o.why, 16);
    case 'match': return o.w === 0 || o.w === 1;
    default: return false;
  }
}

export function decode(raw: unknown): Decoded {
  if (typeof raw !== 'string') return bad('not a string');
  if (raw.length > 16_384) return bad('too large');
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return bad('not json'); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return bad('not an object');
  const m = o as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      if (!num(m.v) || !str(m.name, 24)) return bad('bad hello');
      return { ok: true, msg: { t: 'hello', v: m.v, name: m.name } };
    case 'welcome':
      if (!num(m.v) || !num(m.id)) return bad('bad welcome');
      return { ok: true, msg: { t: 'welcome', v: m.v, id: m.id } };
    case 'reject':
      if (!str(m.reason, 96)) return bad('bad reject');
      return { ok: true, msg: { t: 'reject', reason: m.reason } };
    case 'in':
      if (!num(m.seq) || !num(m.fwd) || !num(m.str) || !num(m.yaw) || !num(m.pitch) || !bool(m.jump) || !bool(m.crouch) || !bool(m.fire)) return bad('bad input');
      return { ok: true, msg: { t: 'in', seq: m.seq, fwd: clamp1(m.fwd), str: clamp1(m.str), yaw: m.yaw, pitch: m.pitch, jump: m.jump, crouch: m.crouch, fire: m.fire } };
    case 'snap': {
      if (!num(m.tick) || !PHASES.includes(m.ph as Phase) || !num(m.tl) || !num(m.rd)) return bad('bad snap');
      if (!Array.isArray(m.sc) || m.sc.length !== 2 || !num(m.sc[0]) || !num(m.sc[1])) return bad('bad score');
      if (!Array.isArray(m.p) || m.p.length > 8 || !m.p.every(okPlayer)) return bad('bad players');
      if (!Array.isArray(m.ev) || m.ev.length > 64 || !m.ev.every(okEvent)) return bad('bad events');
      return { ok: true, msg: { t: 'snap', tick: m.tick, ph: m.ph as Phase, tl: m.tl, rd: m.rd, sc: [m.sc[0], m.sc[1]], p: m.p, ev: m.ev } };
    }
    default: return bad('unknown type');
  }
}

/** Host-side handshake check. Returns a reject reason, or null when the client may join. */
export function checkVersion(v: number): string | null {
  return v === PROTOCOL_VERSION ? null : `version mismatch (host ${PROTOCOL_VERSION}, you ${v})`;
}
