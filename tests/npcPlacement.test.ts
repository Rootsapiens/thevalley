import { describe, it, expect } from 'vitest';
import { placeNpcs } from '../src/npcPlacement';
import { npcsAtDay } from '../src/npcData';

// Build step 2 prep: the Day 1 cast resolved against the village as built. The open list below is the work left before
// the NPCs can stand in the game; it changes only when the data or the geometry does (then update it on purpose).
describe('NPC placement prep (build step 2)', () => {
  it('stands every Day 1 NPC on its floor, clear of the solids, except the open items listed', () => {
    const ps = placeNpcs(1);
    expect(ps.map(p => p.id)).toEqual(npcsAtDay(1).map(n => n.id));
    const open = Object.fromEntries(ps.filter(p => p.issues.length).map(p => [p.id, p.issues]));
    expect(open).toEqual({
      npc_moreno: ['inside school, which has no interior yet', 'floor height not decided'],
      npc_officer_1: ['stands inside a solid'],                     // overlaps the police car's box beside it
      npc_officer_2: ['inside school, which has no interior yet', 'floor height not decided'],
      npc_farmers_wife: ['inside farmhouse, which has no interior yet', 'floor height not decided'],
    });
    for (const p of ps.filter(q => !q.issues.length)) expect(Number.isFinite(p.y), p.id).toBe(true);
  });

  it('puts Maryam on her house floor and the priest inside the church', () => {
    const by = Object.fromEntries(placeNpcs(1).map(p => [p.id, p]));
    expect(by.npc_maryam.room).toBe('maryam');
    expect(by.npc_maryam.y).toBeCloseTo(-3.88, 1);
    expect(by.npc_priest.room).toBe('church');
  });
});
