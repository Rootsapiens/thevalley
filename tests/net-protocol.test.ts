import { describe, it, expect } from 'vitest';
import { encode, decode, checkVersion, PROTOCOL_VERSION, type Msg } from '../src/net/protocol';

const snap = {
  t: 'snap', tick: 9, ph: 'live', tl: 101.5, rd: 3, sc: [2, 1],
  p: [{ i: 0, n: 'Ada', x: 1.5, y: 0, z: -3, yw: 0.5, pt: -0.1, hp: 66, a: true, h: true, tm: 0, k: 1, d: 0 }],
  ev: [{ k: 'kill', a: 0, v: 1 }, { k: 'shot', i: 0, x: 0, y: 1, z: 0, tx: 5, ty: 1, tz: 5, hit: true }, { k: 'round', w: 1, why: 'time' }, { k: 'match', w: 0 }],
} as const;
const msgs = [
  { t: 'hello', v: PROTOCOL_VERSION, name: 'Bo' },
  { t: 'welcome', v: PROTOCOL_VERSION, id: 3 },
  { t: 'reject', reason: 'room full' },
  { t: 'in', seq: 4, fwd: 1, str: -1, yaw: 1.2, pitch: 0.1, jump: false, crouch: true, fire: true },
  snap,
] as unknown as Msg[];

describe('protocol', () => {
  it.each(msgs.map(m => [m.t, m] as const))('round trips %s', (_n, m) => {
    const d = decode(encode(m));
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.msg).toEqual(m);
  });
  it.each([
    ['not json', '{nope'], ['array', '[]'], ['null', 'null'], ['unknown type', '{"t":"x"}'],
    ['missing field', '{"t":"in","seq":1}'], ['string version', '{"t":"hello","v":"1","name":"a"}'],
    ['bad phase', JSON.stringify({ ...snap, ph: 'party' })],
    ['bad team', JSON.stringify({ ...snap, p: [{ ...snap.p[0], tm: 5 }] })],
    ['bad event', JSON.stringify({ ...snap, ev: [{ k: 'nuke' }] })], ['too large', 'x'.repeat(20000)],
  ])('rejects %s', (_n, raw) => { expect(decode(raw).ok).toBe(false); });
  it('rejects non-strings', () => { expect(decode(42).ok).toBe(false); expect(decode(undefined).ok).toBe(false); });
  it('clamps input axes', () => {
    const d = decode(JSON.stringify({ t: 'in', seq: 1, fwd: 50, str: -50, yaw: 0, pitch: 0, jump: false, crouch: false, fire: false }));
    expect(d.ok && d.msg.t === 'in' && d.msg.fwd === 1 && d.msg.str === -1).toBe(true);
  });
  it('checks the version', () => {
    expect(checkVersion(PROTOCOL_VERSION)).toBeNull();
    expect(checkVersion(PROTOCOL_VERSION + 1)).toMatch(/version mismatch/);
  });
});
