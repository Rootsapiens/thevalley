import { describe, it, expect } from 'vitest';
import { NPCS, ORDER, type NpcSpec } from '../src/npcData';
import {
  CH1_DAY1, CAST, linesFor, nextLine, talkedOut, makeActors, tickActor, newFilm, filmTick, pickFramed, actorBox, actorChest, testimonies,
  wrapA, BATTERY_S, FRAME_HOLD, NEAR, type Story, type Actor,
} from '../src/npcTalk';
import { villageSolids, EXAMINABLES, USABLES, BELL_ROPE } from '../src/village';
import { overlaps, TUNING } from '../src/physics';

// Build step 2: talking to the village NPCs (E), their attention and idle, and Lorenzo's camera (hold RMB).
const story = (over: Partial<Story> = {}): Story => ({ ...CH1_DAY1, flags: new Set<string>(), ...over });
const ids = (npc: NpcSpec, s: Story) => linesFor(npc, s).map(t => t.id);
const say = (npc: NpcSpec, s: Story, heard: Set<string>, n: number) => Array.from({ length: n }, () => nextLine(npc, s, heard)?.id ?? null);
const actor = (id: string, s = story()) => makeActors(s).find(a => a.id === id)!;

describe('NPC talk (src/npcTalk.ts)', () => {
  it('gives every trigger an Arabic and an English line', () => {
    for (const n of Object.values(NPCS)) for (const t of n.triggers) {
      expect(t.line.trim().length, t.id).toBeGreaterThan(0);
      expect(/[؀-ۿ]/.test(t.ar), `${t.id} ar`).toBe(true);
    }
  });

  it("stands Lorenzo's Day 1 cast (Omar at the post, Elia not yet) and each has a line", () => {
    const actors = makeActors(story());
    expect(actors.length).toBe(14);
    expect(actors.map(a => a.id)).toContain('npc_omar');
    expect(actors.map(a => a.id)).not.toContain('npc_elia');
    for (const a of actors) {
      expect(ids(a.spec, story()).length, a.id).toBeGreaterThan(0);
      expect(CAST[a.id].label.ar.length * CAST[a.id].label.en.length, a.id).toBeGreaterThan(0);
    }
    const omar = actors.find(a => a.id === 'npc_omar')!;
    expect(omar.seated && omar.spec.cuffed && omar.spec.stage === 'police-post').toBe(true);
  });

  it('plays the lines in authored order, then repeats the last one', () => {
    const v = NPCS.npc_square_villager_1, heard = new Set<string>();
    expect(say(v, story(), heard, 3)).toEqual(['npc_square_villager_1_animals', 'npc_square_villager_1_omar', 'npc_square_villager_1_omar']);
    expect(talkedOut(v, story(), heard)).toBe(true);
    expect(say(NPCS.npc_moreno, story(), new Set(), 3)).toEqual(['moreno_reporter', 'moreno_said', 'moreno_said']);
    expect(say(NPCS.npc_priest, story(), new Set(), 3)).toEqual(['priest_altar', 'priest_ladder', 'priest_ladder']);
  });

  it('respects the binding events: before Omar is found nobody speaks of him and the door guard has nothing to say', () => {
    const before = story({ events: ORDER.slice(0, 3) });
    expect(ids(NPCS.npc_square_villager_3, before)).toEqual(['npc_square_villager_3_animals']);
    expect(ids(NPCS.npc_moreno, before)).toEqual(['moreno_reporter']);
    expect(nextLine(NPCS.npc_officer_2, before, new Set())).toBeNull();
    expect(makeActors(before).map(a => a.id)).not.toContain('npc_omar');
  });

  it('respects flags: Maryam and the priest speak of the posters only once Lorenzo has seen them', () => {
    const heard = new Set<string>();
    expect(say(NPCS.npc_maryam, story(), heard, 2)).toEqual(['maryam_door', 'maryam_door']);
    expect(talkedOut(NPCS.npc_maryam, story(), heard)).toBe(true);
    const seen = story({ flags: new Set(['posters']) });
    expect(talkedOut(NPCS.npc_maryam, seen, heard)).toBe(false);
    expect(say(NPCS.npc_maryam, seen, heard, 1)).toEqual(['maryam_posters']);
    expect(say(NPCS.npc_priest, seen, new Set(), 3)).toEqual(['priest_altar', 'priest_ladder', 'priest_mother']);
  });

  it('keeps lines of other chapters and days out of Chapter 1, Day 1', () => {
    const all = Object.values(NPCS).flatMap(n => ids(n, story()));
    for (const id of ['maryam_gate', 'moreno_report', 'omar_watcher', 'elia_rest', 'elia_photos', 'elia_remember']) expect(all, id).not.toContain(id);
    expect(ids(NPCS.npc_maryam, story({ chapter: 4, day: 8 }))).toEqual(['maryam_gate']);
    expect(ids(NPCS.npc_moreno, story({ chapter: 3, day: 3 }))).toEqual(['moreno_report']);
  });

  it("carries Noor's line review (studio/world/npc-line-review.md): the cut line is gone, the changed ones are in", () => {
    const lines = Object.values(NPCS).flatMap(n => n.triggers);
    expect(lines.map(t => t.id)).not.toContain('wife_cow');
    expect(lines.find(t => t.id === 'farmer_light')!.line).toBe("I'm going back out before it gets dark.");
    expect(lines.find(t => t.id === 'maryam_door')!.ar).toBe('هل رأيتَ ابني جوزيف؟ كان سريره فارغاً هذا الصباح.');
    expect(lines.find(t => t.id === 'priest_altar')!.ar).toBe('عُد إلى بيتك. وابتعد عن الجبل.');   // characters.md [ref]
  });
});

describe('NPC actors', () => {
  it('stand clear of the village solids and of each other', () => {
    const solids = villageSolids().map(s => s.box), actors = makeActors(story());
    for (const a of actors) {
      const b = actorBox(a);
      expect(solids.some(s => overlaps(b, s)), a.id).toBe(false);
      for (const o of actors) if (o !== a) expect(overlaps(b, actorBox(o)), `${a.id} / ${o.id}`).toBe(false);
    }
  });

  it('leave every examine, use and button standing spot clear (the tours stand there)', () => {
    const actors = makeActors(story()), r = TUNING.radius;
    for (const f of [...EXAMINABLES, ...USABLES, BELL_ROPE].map(e => ({ id: e.id, ...e.from }))) {
      const body = { min: { x: f.x - r, y: f.y, z: f.z - r }, max: { x: f.x + r, y: f.y + 1.8, z: f.z + r } };
      for (const a of actors) expect(overlaps(body, actorBox(a)), `${f.id} / ${a.id}`).toBe(false);
    }
  });

  it(`turn to the player within ${NEAR} m, no faster than 2.4 rad/s, and back to rest when he leaves`, () => {
    const a = actor('npc_officer_1'), px = a.x + 2, pz = a.z + 1.5, face = Math.atan2(-(px - a.x), -(pz - a.z));
    let prev = a.yaw, maxRate = 0;
    for (let i = 0; i < 240; i++) {
      tickActor(a, 1 / 60, px, a.y, pz, i / 60);
      maxRate = Math.max(maxRate, Math.abs(wrapA(a.yaw - prev)) * 60); prev = a.yaw;
    }
    expect(Math.abs(wrapA(a.yaw - face))).toBeLessThan(0.05);
    expect(maxRate).toBeLessThanOrEqual(2.4 + 1e-6);
    expect(Math.abs(a.headYaw)).toBeLessThan(0.1);   // body square to him, head straight
    for (let i = 0; i < 300; i++) tickActor(a, 1 / 60, a.x + 40, a.y, a.z, 4 + i / 60);
    expect(Math.abs(wrapA(a.yaw - a.rest))).toBeLessThan(0.05);
  });

  it('keep the seated, cuffed man in his chair: his head stays down unless he speaks', () => {
    const a = actor('npc_omar');
    for (let i = 0; i < 180; i++) tickActor(a, 1 / 60, a.x + 1.5, a.y, a.z - 1, i / 60);
    expect(a.yaw).toBe(a.rest);
    expect(a.headPitch).toBeLessThan(-0.4);
    a.talk = 3; a.line = 'omar_mountain';
    for (let i = 0; i < 60; i++) tickActor(a, 1 / 60, a.x + 1.5, a.y, a.z - 1, 3 + i / 60);
    expect(a.headPitch).toBeGreaterThan(-0.2);
  });

  it('glance about at rest, the same way every run', () => {
    const run = () => { const a = actor('npc_square_villager_2'), out: number[] = []; for (let i = 0; i < 1200; i++) { tickActor(a, 1 / 60, 500, 0, 500, i / 60); if (i % 60 === 0) out.push(+a.headYaw.toFixed(4)); } return out; };
    const r = run();
    expect(r).toEqual(run());
    expect(new Set(r).size).toBeGreaterThan(3);
  });
});

describe("Lorenzo's camera", () => {
  it(`records only while held and charged; a full battery is ${BATTERY_S} s of footage`, () => {
    const f = newFilm();
    filmTick(f, 1, false, null, null, 0);
    expect(f.rec).toBe(false); expect(f.battery).toBe(1);
    for (let t = 0; t < BATTERY_S - 1; t++) filmTick(f, 1, true, null, null, t);
    expect(f.rec).toBe(true); expect(f.battery).toBeCloseTo(1 / BATTERY_S, 6);
    filmTick(f, 1, true, null, null, BATTERY_S); filmTick(f, 1, true, null, null, BATTERY_S + 1);
    expect(f.battery).toBe(0); expect(f.rec).toBe(false);
  });

  it(`logs an NPC after ${FRAME_HOLD} s in frame, once, and again for each line it is filmed saying`, () => {
    const f = newFilm(), dt = 1 / 60;
    let got = 0;
    for (let i = 0; i < 50; i++) if (filmTick(f, dt, true, 'npc_priest', null, i * dt)) got++;
    expect(got).toBe(0);
    for (let i = 50; i < 200; i++) if (filmTick(f, dt, true, 'npc_priest', null, i * dt)) got++;
    expect(got).toBe(1);
    expect(filmTick(f, dt, true, 'npc_priest', 'priest_altar', 4)).toEqual({ npc: 'npc_priest', line: 'priest_altar', t: 4 });
    filmTick(f, dt, true, 'npc_farmer', null, 5);              // a new subject restarts the hold
    expect(filmTick(f, dt, true, 'npc_farmer', null, 5.1)).toBeNull();
    expect(f.log.length).toBe(2); expect(testimonies(f)).toBe(1);
  });

  it('frames the NPC on the view axis, and not one behind a wall', () => {
    const solids = villageSolids(), actors = makeActors(story()), i = actors.findIndex(a => a.id === 'npc_priest'), a: Actor = actors[i];
    const c = actorChest(a, { x: 0, y: 0, z: 0 });
    const aim = (ex: number, ey: number, ez: number) => { const d = Math.hypot(c.x - ex, c.y - ey, c.z - ez); return { x: (c.x - ex) / d, y: (c.y - ey) / d, z: (c.z - ez) / d }; };
    const inside = { x: 17.5, y: a.y + 1.64, z: 30.75 };
    expect(pickFramed(inside, aim(inside.x, inside.y, inside.z), actors, solids)).toBe(i);
    expect(pickFramed(inside, { x: 0, y: 0, z: -1 }, actors, solids)).toBe(-1);   // looking away
    const outside = { x: 20.5, y: 1.64, z: 40 };                                    // south of the church wall
    expect(pickFramed(outside, aim(outside.x, outside.y, outside.z), actors, solids)).toBe(-1);
  });
});
