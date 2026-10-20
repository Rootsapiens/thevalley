// Build step 2 prep: where each NPC of a story moment stands in the village as built. Pure, no Three.js: it resolves
// the floor under each spec position (an enterable building's floor, else the terrain), checks the spot against the
// collision world, and lists what still blocks placing that NPC, so open items stay visible instead of being guessed.
// Positions and the open floor heights come from src/npcData.ts (studio/npc/README.md); nothing here moves an NPC.
import { npcsAtDay, type NpcId, type NpcDayOptions } from './npcData';
import { villageSolids, groundY, BARN, FARMHOUSE, HOUSES, H3 } from './village';
import { BUILDINGS } from './villageMap';
import { overlaps, TUNING, type Box } from './physics';

export interface NpcPlacement {
  id: NpcId; x: number; y: number; z: number; yaw: number;
  /** The building the spot is in, or null outdoors. */
  room: string | null;
  /** Empty when the NPC can be placed as specified. */
  issues: string[];
}

interface Footprint { id: string; x0: number; x1: number; z0: number; z1: number; floor: number; interior: boolean }
/** Every building footprint: the town's (villageMap) and the slice's barn corner (the barn is open inside; the farmhouse
 *  and the three slice houses are solid blocks). */
const FOOTPRINTS: Footprint[] = [
  ...BUILDINGS.map(b => ({ id: b.id, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, floor: b.floor, interior: !!b.hollow })),
  { id: 'barn', x0: BARN.x0, x1: BARN.x1, z0: BARN.z0, z1: BARN.z1, floor: 0, interior: true },
  { id: 'farmhouse', ...FARMHOUSE, floor: 0, interior: false },
  ...[...HOUSES, H3].map((h, i) => ({ id: `slice-house-${i + 1}`, ...h, floor: 0, interior: false })),
];

let SOLIDS: Box[] | null = null;
export function placeNpcs(day: number, options: NpcDayOptions = {}): NpcPlacement[] {
  const solids = SOLIDS ??= villageSolids().map(s => s.box);
  return npcsAtDay(day, options).map(n => {
    const { x, z } = n.position, issues: string[] = [];
    const f = FOOTPRINTS.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) ?? null;
    if (f && !f.interior) issues.push(`inside ${f.id}, which has no interior yet`);
    const balcony = n.stage === 'cafe-balcony' ? n.position.y : null;
    const y = balcony ?? (f ? f.floor : groundY(x, z));
    if (!n.floorKnown) issues.push('floor height not decided');
    else if (Math.abs(n.position.y - y) > 0.25) issues.push(`spec y ${n.position.y} but the floor is at ${y.toFixed(2)}`);
    const r = TUNING.radius, body: Box = { min: { x: x - r, y: y + 0.05, z: z - r }, max: { x: x + r, y: y + 1.75, z: z + r } };
    if ((!f || f.interior) && solids.some(s => overlaps(body, s))) issues.push('stands inside a solid');
    return { id: n.id, x, y, z, yaw: n.yaw, room: f ? f.id : null, issues };
  });
}
