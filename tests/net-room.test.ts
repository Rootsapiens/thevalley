import { describe, it, expect } from 'vitest';
import { createRoom, activate, deactivate, tick, kill, spectateTarget, RULES, type Room } from '../src/net/room';

function ready(): Room {   // slots 0,2,4 Ravens; 1,3,5 Village
  const r = createRoom();
  for (let i = 0; i < 6; i++) activate(r, i, false, 'p' + i);
  return r;
}
const run = (r: Room, sec: number) => { for (let t = 0; t < sec - 1e-9; t += 0.1) tick(r, 0.1); };

describe('room', () => {
  it('waits until both teams have players', () => {
    const r = createRoom(); activate(r, 0, true, 'a');
    run(r, 5); expect(r.phase).toBe('waiting');
    activate(r, 1, true, 'b'); tick(r, 0.1);
    expect(r.phase).toBe('freeze'); expect(r.round).toBe(1);
  });
  it('freeze 5 s then live 2:00', () => {
    const r = ready(); tick(r, 0.1);
    run(r, RULES.freeze - 0.5); expect(r.phase).toBe('freeze');
    run(r, 1); expect(r.phase).toBe('live'); expect(r.timer).toBeGreaterThan(RULES.round - 1);
  });
  it('kills do not count during freeze', () => {
    const r = ready(); tick(r, 0.1);
    expect(kill(r, 0, 1)).toEqual([]); expect(r.slots[1].alive).toBe(true);
  });
  it('elimination ends the round and scores it', () => {
    const r = ready(); run(r, 6);
    kill(r, 0, 1); kill(r, 0, 3);
    expect(r.phase).toBe('live');
    const ev = kill(r, 2, 5);
    expect(ev.some(e => e.k === 'round' && e.w === 0)).toBe(true);
    expect(r.score).toEqual([1, 0]); expect(r.phase).toBe('roundEnd');
    expect(r.slots[0].kills).toBe(2);
    run(r, RULES.roundEnd + 0.3); expect(r.phase).toBe('freeze'); expect(r.round).toBe(2);
    expect(r.slots.every(s => s.alive)).toBe(true);
  });
  it('time out goes to the Village', () => {
    const r = ready(); run(r, 6 + RULES.round + 0.5);
    expect(r.score).toEqual([0, 1]);
  });
  it('first to 8 wins the match, then resets', () => {
    const r = ready();
    for (let n = 0; n < 8; n++) {
      run(r, 6);
      for (const v of [1, 3, 5]) kill(r, 0, v);
      if (n < 7) run(r, RULES.roundEnd + 0.3);
    }
    expect(r.score).toEqual([8, 0]); expect(r.phase).toBe('matchEnd');
    run(r, RULES.matchEnd + 0.3);
    expect(r.score[0] + r.score[1]).toBeLessThanOrEqual(0);
  });
  it('mid-round joiner spectates; if a team empties the round returns to waiting', () => {
    const r = createRoom();
    activate(r, 0, true, 'a'); activate(r, 1, true, 'b'); activate(r, 2, true, 'c'); run(r, 6);
    activate(r, 3, true, 'late'); expect(r.slots[3].alive).toBe(false);
    deactivate(r, 1); tick(r, 0.1);
    expect(r.slots[3].active).toBe(true);
    expect(r.phase).toBe('roundEnd'); expect(r.score).toEqual([1, 0]);   // the last living Village player left
    deactivate(r, 3); run(r, RULES.roundEnd + 0.3);
    expect(r.phase).toBe('waiting');
  });
  it('dead players spectate a living teammate, else anyone, else nobody', () => {
    const r = ready(); run(r, 6);
    kill(r, 1, 0);
    expect(spectateTarget(r, 0)).toBe(2);
    expect(spectateTarget(r, 0, 2)).toBe(4);
    expect(spectateTarget(r, 0, 4)).toBe(2);
    kill(r, 1, 2); kill(r, 1, 4);   // whole team gone: the round ends but the dead can still follow the winners
    expect(spectateTarget(r, 0)).toBe(1);
  });
  it('a second kill on the same victim is ignored', () => {
    const r = ready(); run(r, 6);
    expect(kill(r, 0, 1).length).toBe(1); expect(kill(r, 2, 1)).toEqual([]); expect(r.slots[1].deaths).toBe(1);
  });
});
