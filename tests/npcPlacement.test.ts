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
    expect(open).toEqual({});   // studio/npc/decisions-noor-npc.md: the four open spots were moved outside / clear of the car
    for (const p of ps.filter(q => !q.issues.length)) expect(Number.isFinite(p.y), p.id).toBe(true);
  });

  it('puts Maryam on her house floor, the priest inside the church and Moreno in the post', () => {
    const by = Object.fromEntries(placeNpcs(1).map(p => [p.id, p]));
    expect(by.npc_maryam.room).toBe('maryam');
    expect(by.npc_maryam.y).toBeCloseTo(-3.88, 1);
    expect(by.npc_priest.room).toBe('church');
    expect(by.npc_moreno.room).toBe('school');   // inside post [6] since it has an interior (src/interiors.ts)
  });
});
