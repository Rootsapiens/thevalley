// Build step 2: the village NPCs in play. Talk (E): an NPC's trigger lines from src/npcData.ts in authored order, only
// those whose conditions hold in the story state. Film (hold RMB): Lorenzo's camcorder, its battery and the footage
// log. Idle: breathing phase, glances, turning to the player. Pure, no Three.js (src/npcFigures.ts draws the actors).
import { ORDER, npcsAtDay, type NpcId, type NpcSpec, type NpcTrigger } from './npcData';
import { placeNpcs } from './npcPlacement';
import { FOUNTAIN } from './villageMap';
import { rayBox, rng, type Solid, type Text } from './village';
import type { Box, Vec3 } from './physics';

// ---------- Story state ----------
export interface Story {
  chapter: number;
  day: number;
  /** Binding events done (a prefix of ORDER). */
  events: readonly string[];
  flags: ReadonlySet<string>;
  medicalCheckComplete?: boolean;
}
/** Lorenzo's Day 1 (Ch1, village.md): Omar has been brought to post [6] in handcuffs, so the first five binding events
 *  are done (README event order). No story flag is set yet; Joseph's posters on pole [9] are not built. */
export const CH1_DAY1: Story = { chapter: 1, day: 1, events: ORDER.slice(0, 5), flags: new Set() };

/** True when every condition of the line holds. */
export function lineAllowed(t: NpcTrigger, s: Story): boolean {
  const w = t.when;
  if (!w) return true;
  if (w.chapter !== undefined) {
    const [a, b] = typeof w.chapter === 'number' ? [w.chapter, w.chapter] : w.chapter;
    if (s.chapter < a || s.chapter > b) return false;
  }
  if (w.day && (s.day < w.day[0] || s.day > w.day[1])) return false;
  if (w.events !== undefined && s.events.length < w.events) return false;
  if (w.flag !== undefined && !s.flags.has(w.flag)) return false;
  return true;
}
export const linesFor = (npc: NpcSpec, s: Story): NpcTrigger[] => npc.triggers.filter(t => lineAllowed(t, s));

/** The line E plays next: the first allowed line not heard yet, in authored order; once all are heard, the last one
 *  again. Marks it heard. null when the NPC has nothing to say in this story state. */
export function nextLine(npc: NpcSpec, s: Story, heard: Set<string>): NpcTrigger | null {
  const ls = linesFor(npc, s);
  if (!ls.length) return null;
  const t = ls.find(l => !heard.has(l.id)) ?? ls[ls.length - 1];
  heard.add(t.id);
  return t;
}
/** Every allowed line heard (the prompt ticks it off). */
export const talkedOut = (npc: NpcSpec, s: Story, heard: ReadonlySet<string>): boolean => linesFor(npc, s).every(l => heard.has(l.id));

// ---------- Cast: what Lorenzo sees (unnamed roles stay unnamed: he reads a role, not a name) ----------
export type Figure = 'priest' | 'officer' | 'chief' | 'farmer' | 'wife' | 'maryam' | 'omar' | 'elia' | 'man' | 'woman' | 'elder' | 'widow';
export interface CastEntry {
  label: Text;
  figure: Figure;
  /** Rest facing when the spec gives none (yaw 0): 'mountain' looks NE at it, 'group' turns to the nearest villager
   *  within 5 m, else to the fountain. */
  rest?: 'mountain' | 'group';
}
const VILLAGER: Text = { ar: 'قروي', en: 'Villager' }, VILLAGER_F: Text = { ar: 'قروية', en: 'Villager' };
const OFFICER: Text = { ar: 'شرطي', en: 'Police officer' };
export const CAST: Record<NpcId, CastEntry> = {
  npc_maryam: { label: { ar: 'مريم', en: 'Maryam' }, figure: 'maryam' },
  npc_omar: { label: { ar: 'رجل مكبّل اليدين', en: 'Handcuffed man' }, figure: 'omar' },
  npc_elia: { label: { ar: 'امرأة على الشرفة', en: 'Woman on the balcony' }, figure: 'elia' },
  npc_moreno: { label: { ar: 'رئيس الشرطة', en: 'Police chief' }, figure: 'chief' },
  npc_officer_1: { label: OFFICER, figure: 'officer' },
  npc_officer_2: { label: OFFICER, figure: 'officer' },
  npc_priest: { label: { ar: 'الكاهن', en: 'Priest' }, figure: 'priest' },
  npc_farmer: { label: { ar: 'المزارع', en: 'Farmer' }, figure: 'farmer', rest: 'mountain' },
  npc_farmers_wife: { label: { ar: 'زوجة المزارع', en: "Farmer's wife" }, figure: 'wife' },
  npc_square_villager_1: { label: VILLAGER, figure: 'man', rest: 'group' },
  npc_square_villager_2: { label: VILLAGER_F, figure: 'woman', rest: 'group' },
  npc_square_villager_3: { label: VILLAGER_F, figure: 'widow', rest: 'group' },
  npc_square_villager_4: { label: VILLAGER, figure: 'man', rest: 'group' },
  npc_square_villager_5: { label: VILLAGER, figure: 'man', rest: 'group' },
  npc_square_villager_6: { label: VILLAGER, figure: 'elder', rest: 'group' },
};

// ---------- Actors ----------
export interface Actor {
  id: NpcId;
  spec: NpcSpec;
  /** Index into the figure batch (stable for the session). */
  index: number;
  x: number; y: number; z: number;
  /** Facing at rest (radians, the camera's convention: 0 looks at -Z, -pi/2 east). */
  rest: number;
  seated: boolean;
  indoors: boolean;
  /** Body yaw, head yaw relative to the body, head pitch (+ up), now. */
  yaw: number; headYaw: number; headPitch: number;
  /** Idle glance target (head yaw, pitch) and the story time of the next one. */
  glance: number; glancePitch: number; nextGlance: number;
  /** Seconds left of the line being said, and its id. */
  talk: number; line: string | null;
  /** Breathing period (s) and phase, per actor. */
  breathT: number; breathP: number;
  rand: () => number;
}
export const STAND = { chest: 1.3, head: 1.62, half: 0.24, height: 1.78 };
export const SEAT = { chest: 0.9, head: 1.2, half: 0.32, height: 1.3 };
const deg = Math.PI / 180;
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz);
export const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The NPCs of a story state, standing where npcPlacement resolves them (floor y, room). NPCs whose spot still has an
 *  open placement issue (no interior, floor undecided, inside a solid) are left out rather than guessed. */
export function makeActors(s: Story): Actor[] {
  const opts = { chapter: s.chapter, events: s.events, medicalCheckComplete: s.medicalCheckComplete };
  const specs = npcsAtDay(s.day, opts), places = placeNpcs(s.day, opts);
  const ok = places.map((p, i) => ({ p, spec: specs[i] })).filter(q => !q.p.issues.length);
  const group = ok.filter(q => CAST[q.spec.id].rest === 'group');
  return ok.map(({ p, spec }, index) => {
    const cast = CAST[spec.id];
    let rest = spec.yaw;
    if (cast.rest === 'mountain') rest = yawTo(Math.sin(45 * deg), -Math.cos(45 * deg));
    else if (cast.rest === 'group') {
      let best: { x: number; z: number } = FOUNTAIN, bd = 5;
      for (const o of group) {
        const d = Math.hypot(o.p.x - p.x, o.p.z - p.z);
        if (o.p.id !== p.id && d < bd) { bd = d; best = o.p; }
      }
      rest = yawTo(best.x - p.x, best.z - p.z);
    }
    const seed = 0x9e3779b1 ^ (index * 2654435761);
    const rand = rng(seed >>> 0);
    return {
      id: spec.id, spec, index, x: p.x, y: p.y, z: p.z, rest, seated: spec.id === 'npc_omar' && spec.stage === 'police-post',
      indoors: p.room !== null, yaw: rest, headYaw: 0, headPitch: 0, glance: 0, glancePitch: 0, nextGlance: 1 + rand() * 4,
      talk: 0, line: null, breathT: 3.4 + rand() * 1.4, breathP: rand() * Math.PI * 2, rand,
    };
  });
}

/** Collision box of an actor (the player walks round them; the seated one with his chair). */
export function actorBox(a: Actor): Box {
  const k = a.seated ? SEAT : STAND;
  return { min: { x: a.x - k.half, y: a.y, z: a.z - k.half }, max: { x: a.x + k.half, y: a.y + k.height, z: a.z + k.half } };
}
/** Talk pick centre (chest) and its radius. */
export function actorChest(a: Actor, out: Vec3): Vec3 {
  out.x = a.x; out.y = a.y + (a.seated ? SEAT.chest : STAND.chest); out.z = a.z;
  return out;
}

/** Within this range an NPC turns to the player (farmer.md: "stops when the player is within 4 m, turns to face"). */
export const NEAR = 4;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Eases an angle toward a target at `rate` per second (exponential), never faster than `max` rad/s. */
function turn(a: number, target: number, dt: number, rate: number, max: number): number {
  const d = wrapA(target - a), s = clamp(d * Math.min(1, dt * rate), -max * dt, max * dt);
  return wrapA(a + s);
}

/** One idle/attention step (render rate). Near the player (or while speaking) the body turns to him and the head
 *  follows him within a neck's reach; otherwise the actor drifts back to rest and glances about: ahead, aside, or (out
 *  of doors) up at the mountain. Omar keeps his chair and his head down; he looks up only while he speaks. */
export function tickActor(a: Actor, dt: number, px: number, py: number, pz: number, t: number): void {
  const dx = px - a.x, dz = pz - a.z, d = Math.hypot(dx, dz), face = yawTo(dx, dz);
  const near = d < NEAR || a.talk > 0;
  a.yaw = turn(a.yaw, near && !a.seated ? face : a.rest, dt, 3, 2.4);
  if (t >= a.nextGlance) {
    const r = a.rand();
    if (r < 0.45) { a.glance = 0; a.glancePitch = 0; }
    else if (r < 0.8 || a.indoors) { a.glance = (a.rand() < 0.5 ? -1 : 1) * (0.25 + 0.55 * a.rand()); a.glancePitch = (a.rand() - 0.6) * 0.2; }
    else { a.glance = clamp(wrapA(yawTo(Math.sin(45 * deg), -Math.cos(45 * deg)) - a.rest), -1.0, 1.0); a.glancePitch = 0.12; }
    a.nextGlance = t + 2.5 + a.rand() * 4;
  }
  const headY = a.y + (a.seated ? SEAT.head : STAND.head);
  let hy = near ? clamp(wrapA(face - a.yaw), -1.1, 1.1) : a.glance;
  let hp = near ? clamp(Math.atan2(py + 1.64 - headY, Math.max(0.4, d)), -0.45, 0.35) : a.glancePitch;
  if (a.seated) {
    if (a.talk > 0) { hy *= 0.7; hp = clamp(hp, -0.15, 0.2); }
    else { hy *= 0.25; hp = -0.5; }
  }
  a.headYaw = turn(a.headYaw, hy, dt, 5, 3.5);
  a.headPitch = turn(a.headPitch, hp, dt, 4, 2.5);
  if (a.talk > 0) { a.talk = Math.max(0, a.talk - dt); if (a.talk === 0) a.line = null; }
}

// ---------- Lorenzo's camcorder ----------
/** Seconds of footage on a full battery. */
export const BATTERY_S = 300;
/** Seconds an NPC must stay in frame before the shot is logged. */
export const FRAME_HOLD = 1.0;
export interface FilmEntry { npc: NpcId; line: string | null; t: number }
export interface Film {
  rec: boolean;
  /** 0..1 */
  battery: number;
  framed: NpcId | null;
  held: number;
  /** One entry per NPC filmed, plus one per line an NPC was filmed saying (a testimony). */
  log: FilmEntry[];
}
export const newFilm = (): Film => ({ rec: false, battery: 1, framed: null, held: 0, log: [] });

/** One step: `hold` = RMB down, `framed` = the NPC under the lens (or null), `saying` = the line that NPC is saying now.
 *  Records only while held and charged; returns the entry logged this step, or null. */
export function filmTick(f: Film, dt: number, hold: boolean, framed: NpcId | null, saying: string | null, t: number): FilmEntry | null {
  f.rec = hold && f.battery > 0;
  if (!f.rec) { f.framed = null; f.held = 0; return null; }
  f.battery = f.battery - dt / BATTERY_S > 1e-9 ? f.battery - dt / BATTERY_S : 0;
  if (framed !== f.framed) { f.framed = framed; f.held = 0; }
  if (!framed) return null;
  f.held += dt;
  if (f.held < FRAME_HOLD) return null;
  if (f.log.some(e => e.npc === framed && e.line === saying)) return null;
  const e: FilmEntry = { npc: framed, line: saying, t };
  f.log.push(e);
  return e;
}
export const testimonies = (f: Film): number => f.log.filter(e => e.line !== null).length;

const _c: Vec3 = { x: 0, y: 0, z: 0 }, _d: Vec3 = { x: 0, y: 0, z: 0 };
/** Index of the actor under the lens: the nearest whose chest lies within `cone` radians of the view axis and `range`
 *  metres, with nothing solid in between (the actor's own box is skipped). -1 if none. No allocation. */
export function pickFramed(eye: Vec3, dir: Vec3, actors: readonly Actor[], solids: readonly Solid[], range = 14, cone = 0.14): number {
  let best = -1, bestD = Infinity;
  const cc = Math.cos(cone);
  for (let i = 0; i < actors.length; i++) {
    const c = actorChest(actors[i], _c);
    const vx = c.x - eye.x, vy = c.y - eye.y, vz = c.z - eye.z, d = Math.hypot(vx, vy, vz);
    if (d > range || d >= bestD || d < 0.3) continue;
    if ((vx * dir.x + vy * dir.y + vz * dir.z) / d < cc) continue;
    _d.x = vx / d; _d.y = vy / d; _d.z = vz / d;
    let blocked = false;
    for (const s of solids) {
      const b = s.box;
      if (c.x > b.min.x && c.x < b.max.x && c.y > b.min.y && c.y < b.max.y && c.z > b.min.z && c.z < b.max.z) continue;
      if (rayBox(eye, _d, b) < d - 0.35) { blocked = true; break; }
    }
    if (!blocked) { best = i; bestD = d; }
  }
  return best;
}
