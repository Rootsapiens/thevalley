#!/usr/bin/env node
// Usage: node scripts/export-npcs.ts [out.json]   (from project root; default unreal/data/village-npcs.json)
//        npx vite-node scripts/export-npcs.ts      (same result, if vite-node is installed)
// Exports the village NPC records from src/npcData.ts (read-only: it only imports the module) for
// unreal/scripts/place_npcs.py. Units stay in game space: metres, x east, y up, z south; yaw in radians
// (0 looks north, + turns left). The UE side converts with ov_units.py. Node >= 22.18 strips the TS types natively.
// No timestamp in the output, so re-running on unchanged data leaves the file byte-identical.
// Exit: 0 ok, 1 self-check failed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NPCS, ORDER } from '../src/npcData.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.argv[2] ?? 'unreal/data/village-npcs.json');
const srcRel = 'src/npcData.ts';
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, srcRel))).digest('hex').slice(0, 16);

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const npcs = Object.values(NPCS).map(n => ({
  id: n.id,
  role: n.role,
  spawnDay: n.spawnDay,
  position: { x: r3(n.position.x), y: r3(n.position.y), z: r3(n.position.z) },
  yaw: r3(n.yaw),
  floorKnown: n.floorKnown,
  cuffed: n.cuffed,
  triggers: n.triggers.map(t => ({ id: t.id, line: t.line, status: t.status })),
}));

// Same mapping as unreal/scripts/ov_units.py loc(): UE X = game x, UE Y = game z, UE Z = game y (cm).
// place_npcs.py and test_place_npcs.py check that Python agrees with this number.
const sample = npcs.find(n => n.id === 'npc_farmer')!;
const p = sample.position;
const data = {
  source: { file: srcRel, sha256: sha, exporter: 'scripts/export-npcs.ts' },
  units: 'game metres, x east, y up, z south; yaw radians, 0 = north, + = left',
  order: [...ORDER],
  npcs,
  checks: {
    count: npcs.length,
    sample: { id: sample.id, game: p, ueCm: { x: r3(p.x * 100), y: r3(p.z * 100), z: r3(p.y * 100) } },
  },
};

const fail: string[] = [];
const ids = npcs.map(n => n.id);
if (npcs.length !== 15) fail.push(`expected 15 NPCs, got ${npcs.length}`);
if (new Set(ids).size !== ids.length) fail.push('duplicate NPC ids');
for (const n of npcs) {
  if (![n.position.x, n.position.y, n.position.z, n.yaw].every(Number.isFinite)) fail.push(`${n.id}: non-finite position or yaw`);
  if (!Number.isInteger(n.spawnDay) || n.spawnDay < 1) fail.push(`${n.id}: bad spawnDay`);
}
if (data.checks.sample.ueCm.x !== -1250 || data.checks.sample.ueCm.y !== 850) fail.push('farmer conversion');
if (fail.length) {
  console.error('export-npcs: FAILED\n  ' + fail.join('\n  '));
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
const unknown = npcs.filter(n => !n.floorKnown).map(n => n.id);
console.log(`${path.relative(root, out)}: ${npcs.length} NPCs, ${unknown.length} floor_to_confirm (${unknown.join(', ')}), source ${sha}`);
