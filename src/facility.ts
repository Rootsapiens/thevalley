// Pure facility/story state: breakers, floodgate, one-shot triggers.
import { overlaps, type Box, type Vec3 } from './physics';

export interface Usable { id: string; pos: Vec3; kind: 'breaker'; index: number }
export interface Trigger { id: string; box: Box; event: string }

export interface Facility {
  breakers: boolean[];
  doorOpen: boolean;
  fired: string[];      // trigger ids already fired (one-shot)
  finished: boolean;
}

export const USE_RANGE = 1.8;

export function newFacility(breakerCount: number): Facility {
  return { breakers: Array(breakerCount).fill(false), doorOpen: false, fired: [], finished: false };
}

export interface UseResult { used?: Usable; events: string[] }

/** Player presses E at eye position looking along dir. Picks the nearest usable in range and in front. */
export function use(f: Facility, eye: Vec3, dir: Vec3, usables: Usable[]): UseResult {
  let best: Usable | undefined, bestD = Infinity;
  for (const u of usables) {
    const dx = u.pos.x - eye.x, dy = u.pos.y - eye.y, dz = u.pos.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > USE_RANGE || d < 1e-6) continue;
    if ((dx * dir.x + dy * dir.y + dz * dir.z) / d < 0.5) continue; // must roughly face it
    if (d < bestD) { bestD = d; best = u; }
  }
  if (!best) return { events: [] };
  const events: string[] = [];
  if (best.kind === 'breaker') {
    if (f.breakers[best.index]) return { used: best, events: ['breaker-already'] };
    f.breakers[best.index] = true;
    events.push('breaker-on');
    if (f.breakers.every(Boolean) && !f.doorOpen) { f.doorOpen = true; events.push('door-open'); }
  }
  return { used: best, events };
}

/** Fire one-shot triggers the player box overlaps. Returns their events in order. */
export function checkTriggers(f: Facility, player: Box, triggers: Trigger[]): string[] {
  const out: string[] = [];
  for (const t of triggers) {
    if (f.fired.includes(t.id) || !overlaps(player, t.box)) continue;
    f.fired.push(t.id);
    out.push(t.event);
    if (t.event === 'finish') f.finished = true;
  }
  return out;
}
