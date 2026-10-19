// Pure round state machine: Ravens vs Village, 6 slots, freeze 5 s, round 2:00, first to 8, elimination, spectate.
import type { Phase, Team } from './protocol';

export const RULES = { slots: 6, freeze: 5, round: 120, roundEnd: 4, matchEnd: 10, winScore: 8 };

export interface Slot { id: number; team: Team; active: boolean; human: boolean; alive: boolean; kills: number; deaths: number; name: string }
export type RoomEvent =
  | { k: 'roundStart'; round: number }
  | { k: 'live' }
  | { k: 'round'; w: Team; why: 'elimination' | 'time' }
  | { k: 'match'; w: Team }
  | { k: 'kill'; a: number; v: number };

export interface Room {
  phase: Phase; timer: number; round: number; score: [number, number];
  slots: Slot[]; lastWinner: Team | null;
}

export function createRoom(): Room {
  const slots: Slot[] = [];
  for (let id = 0; id < RULES.slots; id++) slots.push({ id, team: (id % 2) as Team, active: false, human: false, alive: false, kills: 0, deaths: 0, name: '' });
  return { phase: 'waiting', timer: 0, round: 0, score: [0, 0], slots, lastWinner: null };
}

export function activate(r: Room, id: number, human: boolean, name: string): void {
  const s = r.slots[id];
  s.active = true; s.human = human; s.name = name; s.kills = 0; s.deaths = 0;
  s.alive = r.phase === 'freeze';          // joining mid-round means spectating until the next round
}
export function deactivate(r: Room, id: number): RoomEvent[] {
  const s = r.slots[id];
  s.active = false; s.human = false; s.alive = false;
  return r.phase === 'live' ? checkElimination(r) : [];
}

const count = (r: Room, t: Team, aliveOnly: boolean) => r.slots.filter(s => s.active && s.team === t && (!aliveOnly || s.alive)).length;
export const bothTeamsPresent = (r: Room) => count(r, 0, false) > 0 && count(r, 1, false) > 0;

function startRound(r: Room): RoomEvent[] {
  r.round++; r.phase = 'freeze'; r.timer = RULES.freeze; r.lastWinner = null;
  for (const s of r.slots) s.alive = s.active;
  return [{ k: 'roundStart', round: r.round }];
}

function endRound(r: Room, w: Team, why: 'elimination' | 'time'): RoomEvent[] {
  r.score[w]++; r.lastWinner = w;
  const ev: RoomEvent[] = [{ k: 'round', w, why }];
  if (r.score[w] >= RULES.winScore) { r.phase = 'matchEnd'; r.timer = RULES.matchEnd; ev.push({ k: 'match', w }); }
  else { r.phase = 'roundEnd'; r.timer = RULES.roundEnd; }
  return ev;
}

function checkElimination(r: Room, lastKillerTeam?: Team): RoomEvent[] {
  if (r.phase !== 'live') return [];
  const a0 = count(r, 0, true), a1 = count(r, 1, true);
  if (a0 > 0 && a1 > 0) return [];
  if (a0 === 0 && a1 === 0) return endRound(r, lastKillerTeam ?? 1, 'elimination');
  return endRound(r, a0 > 0 ? 0 : 1, 'elimination');
}

/** Registers a kill. Only counts while the round is live. */
export function kill(r: Room, killer: number, victim: number): RoomEvent[] {
  const v = r.slots[victim], a = r.slots[killer];
  if (r.phase !== 'live' || !v || !a || !v.alive) return [];
  v.alive = false; v.deaths++;
  if (killer !== victim) a.kills++;
  return [{ k: 'kill', a: killer, v: victim }, ...checkElimination(r, a.team)];
}

export function tick(r: Room, dt: number): RoomEvent[] {
  switch (r.phase) {
    case 'waiting':
      return bothTeamsPresent(r) ? startRound(r) : [];
    case 'freeze':
      if (!bothTeamsPresent(r)) { r.phase = 'waiting'; return []; }
      r.timer -= dt;
      if (r.timer <= 0) { r.phase = 'live'; r.timer = RULES.round; return [{ k: 'live' }]; }
      return [];
    case 'live':
      if (!bothTeamsPresent(r)) { r.phase = 'waiting'; return []; }
      r.timer -= dt;
      if (r.timer <= 0) { r.timer = 0; return endRound(r, 1, 'time'); }   // the defenders hold the square
      return checkElimination(r);
    case 'roundEnd':
      r.timer -= dt;
      if (r.timer > 0) return [];
      if (bothTeamsPresent(r)) return startRound(r);
      r.phase = 'waiting';
      return [];
    case 'matchEnd':
      r.timer -= dt;
      if (r.timer <= 0) {
        r.score = [0, 0]; r.round = 0; r.phase = 'waiting';
        for (const s of r.slots) { s.kills = 0; s.deaths = 0; }
      }
      return [];
  }
}

/** Who a dead player watches: the next living teammate after `current`, else any living player, else null. */
export function spectateTarget(r: Room, id: number, current: number | null = null): number | null {
  const me = r.slots[id];
  const pool = (team: Team | null) => r.slots.filter(s => s.active && s.alive && s.id !== id && (team === null || s.team === team));
  const mates = pool(me.team);
  const list = mates.length ? mates : pool(null);
  if (!list.length) return null;
  return (list.find(s => current !== null && s.id > current) ?? list[0]).id;
}
