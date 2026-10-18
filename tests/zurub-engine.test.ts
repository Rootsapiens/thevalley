import { describe, it, expect } from 'vitest';
import { serialize, parse, SAVE_VERSION, type GameSnapshot } from '../src/save';
import { newPlayer } from '../src/physics';
import { newArsenal, newDrifter, damageDrifter } from '../src/combat';

const snap = (): GameSnapshot => ({
  player: newPlayer({ x: 1, y: 2, z: 3 }),
  health: 80, yaw: 0.5, pitch: -0.2,
  arsenal: newArsenal(),
  enemies: [newDrifter(1, { x: 4, y: 0, z: 5 })],
  taken: ['key', 'medkit'], storyTime: 12.5, kills: 3,
});

describe('save validation edge cases', () => {
  it('round-trips optional fields', () => {
    const s = snap();
    expect(parse(serialize(s))).toEqual(s);
  });
  it('rejects data missing required parts', () => {
    for (const k of ['player', 'enemies', 'arsenal'] as const) {
      const s: any = snap();
      delete s[k];
      expect(parse(JSON.stringify({ version: SAVE_VERSION, data: s }))).toBeNull();
    }
  });
  it('rejects null, non-object data and non-array enemies', () => {
    expect(parse('null')).toBeNull();
    expect(parse(JSON.stringify({ version: SAVE_VERSION, data: 'x' }))).toBeNull();
    expect(parse(JSON.stringify({ version: SAVE_VERSION, data: { ...snap(), enemies: {} } }))).toBeNull();
  });
});

describe('damageDrifter edge cases', () => {
  it('overkill clamps health to 0 and kills', () => {
    const d = newDrifter(1, { x: 0, y: 0, z: 0 });
    damageDrifter(d, 1e6);
    expect(d.health).toBe(0);
    expect(d.mode).toBe('dead');
  });
  it('a non-lethal hit wakes an idle drifter but keeps it alive', () => {
    const d = newDrifter(2, { x: 0, y: 0, z: 0 });
    d.mode = 'idle';
    damageDrifter(d, 1);
    expect(d.mode).toBe('chase');
    expect(d.health).toBeGreaterThan(0);
  });
});
