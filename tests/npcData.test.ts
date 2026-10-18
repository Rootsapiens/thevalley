import { describe, it, expect } from 'vitest';
import { eventOrderOk, NPCS, npcsAtDay, ORDER, type NpcSpec } from '../src/npcData';

const all: NpcSpec[] = Object.values(NPCS);
const triggers = all.flatMap(n => n.triggers.map(t => ({ npc: n.id, ...t })));

describe('NPC data (studio/npc)', () => {
  it('has exactly 15 unique NPC ids, each matching its record key', () => {
    expect(all.length).toBe(15);
    expect(new Set(all.map(n => n.id)).size).toBe(15);
    for (const [key, spec] of Object.entries(NPCS)) {
      expect(spec.id, key).toBe(key);
    }
  });

  it('has finite positions, and y = 0 wherever the floor is not known', () => {
    for (const n of all) {
      const p = n.position;
      expect(Number.isFinite(p.x), `${n.id} x`).toBe(true);
      expect(Number.isFinite(p.y), `${n.id} y`).toBe(true);
      expect(Number.isFinite(p.z), `${n.id} z`).toBe(true);
      expect(Number.isFinite(n.yaw), `${n.id} yaw`).toBe(true);
      if (!n.floorKnown) expect(p.y, `${n.id} floorKnown false`).toBe(0);
    }
  });

  it('marks only npc_omar as cuffed', () => {
    const cuffed = all.filter(n => n.cuffed).map(n => n.id);
    expect(cuffed).toEqual(['npc_omar']);
  });

  it('keeps npc_elia out of Day 1', () => {
    expect(NPCS.npc_elia.spawnDay).toBeGreaterThanOrEqual(2);
    expect(npcsAtDay(1).map(n => n.id)).not.toContain('npc_elia');
    expect(npcsAtDay(1).map(n => n.id)).not.toContain('npc_omar');
  });

  it('gates Omar and Elia by story events as well as day and chapter', () => {
    const cafeOmar = npcsAtDay(1, { chapter: 1, events: ORDER.slice(0, 1) })
      .find(n => n.id === 'npc_omar');
    expect(cafeOmar?.stage).toBe('cafe-before-attack');

    const foundOmar = npcsAtDay(1, { chapter: 1, events: ORDER.slice(0, 4) })
      .find(n => n.id === 'npc_omar');
    expect(foundOmar?.stage).toBe('mountain-found');
    expect(foundOmar?.cuffed).toBe(false);

    const afterTransport = npcsAtDay(1, { chapter: 1, events: ORDER.slice(0, 5) });
    expect(afterTransport.map(n => n.id)).toContain('npc_omar');
    expect(afterTransport.find(n => n.id === 'npc_omar')?.stage).toBe('police-post');
    expect(afterTransport.find(n => n.id === 'npc_omar')?.cuffed).toBe(true);
    const afterMedicalCheck = npcsAtDay(1, {
      chapter: 1,
      events: ORDER.slice(0, 5),
      medicalCheckComplete: true,
    });
    expect(afterMedicalCheck.find(n => n.id === 'npc_omar')?.cuffed).toBe(false);

    const beforeAssignment = npcsAtDay(2, { chapter: 1, events: ORDER.slice(0, 5) });
    expect(beforeAssignment.map(n => n.id)).not.toContain('npc_elia');
    const afterAssignment = npcsAtDay(2, { chapter: 1, events: ORDER.slice(0, 6) });
    expect(afterAssignment.map(n => n.id)).toContain('npc_elia');
    expect(afterAssignment.find(n => n.id === 'npc_omar')?.cuffed).toBe(false);
    expect(afterAssignment.find(n => n.id === 'npc_omar')?.stage).toBe('cafe-upstairs');
    expect(afterAssignment.find(n => n.id === 'npc_elia')?.stage).toBe('cafe-balcony');

    expect(npcsAtDay(2, { chapter: 3, events: ORDER }).map(n => n.id)).not.toContain('npc_elia');
  });

  it('marks every proposed trigger as proposed and never reuses its text as canon', () => {
    const canonLines = new Set(triggers.filter(t => t.status === 'canon').map(t => t.line));
    for (const t of triggers) {
      expect(['canon', 'proposed'], t.id).toContain(t.status);
      if (t.status === 'proposed') {
        expect(canonLines.has(t.line), `${t.id} proposed line typed as canon`).toBe(false);
      }
    }
    expect(new Set(triggers.map(t => t.id)).size, 'trigger ids unique').toBe(triggers.length);
  });

  it('exposes the binding event order from the README', () => {
    expect(ORDER.length).toBe(7);
    expect(ORDER.indexOf('Omar escapes, loses memory')).toBeLessThan(ORDER.indexOf('Taken to post [6] in handcuffs'));
    expect(ORDER.indexOf('Moreno assigns Elia the cover mission')).toBeLessThan(
      ORDER.indexOf('Elia appears on the cafe balcony (Day 2)'),
    );
  });

  it('accepts only a valid prefix of the binding event order', () => {
    expect(eventOrderOk([...ORDER])).toBe(true);
    expect(eventOrderOk(ORDER.slice(0, 5))).toBe(true);
    expect(eventOrderOk([ORDER[1], ORDER[0], ...ORDER.slice(2)])).toBe(false);
    expect(eventOrderOk([...ORDER, 'Unlisted event'])).toBe(false);
  });

  it('keeps the farmer and wife reference line unattributed', () => {
    expect(triggers.some(t => t.line === "They didn't break out. They walked out.")).toBe(false);
  });

  it('uses the farmhouse yard pad plus the specified kitchen floor offset', () => {
    expect(NPCS.npc_maryam.position.y).toBe(-3.88);
  });
});
