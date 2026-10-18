import type { PlayerState } from './physics';
import type { Arsenal, Drifter } from './combat';
import type { Facility } from './facility';

export const SAVE_VERSION = 1;

export interface GameSnapshot {
  player: PlayerState;
  health: number;
  yaw: number;
  pitch: number;
  arsenal: Arsenal;
  enemies: Drifter[];
  facility?: Facility;
  taken?: string[];
  storyTime?: number;
  kills?: number;
}

export function serialize(s: GameSnapshot): string {
  return JSON.stringify({ version: SAVE_VERSION, data: s });
}

/** Returns null for anything we don't understand: bad JSON or unknown version. */
export function parse(text: string): GameSnapshot | null {
  try {
    const o = JSON.parse(text);
    if (!o || o.version !== SAVE_VERSION || typeof o.data !== 'object') return null;
    const d = o.data as GameSnapshot;
    if (!d.player?.pos || !Array.isArray(d.enemies) || !d.arsenal) return null;
    return d;
  } catch {
    return null;
  }
}
