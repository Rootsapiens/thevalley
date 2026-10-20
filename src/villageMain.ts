// Chapter 1 slice "Arrival": Lorenzo at the farmer's empty barn, Day 1, 16:41, inside the full village blockout.
// Walk, look, E to examine or to use gates, doors and the bell rope, push the barn's pail and stool, follow the hoofprints
// to the mountain path or cross the stepping stones to the herd trail. Fixed 120 Hz simulation (src/physics.ts, entities
// in src/entities.ts) on the terrain, render every frame.
import * as THREE from 'three';
import { newPlayer, step, eyeHeight, height, TUNING, type Input, type PlayerState, type Box } from './physics';
import {
  villageSolids, EXAMINABLES, LINES, SPAWN, SPAWN_YAW, MOUNTAIN, BARN, pickExaminable, surfaceAt, zoneEvents,
  newVillageState, markExamined, bearingDir, groundY, USABLES, leafBox, pickUsable, LOCKED_LINE, BELL_ROPE, PROPS,
  type VillageState, type Text, type Examinable,
} from './village';
import { makeDoor, makeButton, makeProp, useDoor, pressButton, tickEnts, pushFrom, pushScale, easeIO, type Ents, type Push } from './entities';
import { BUILDINGS, streamX, streamHalf } from './villageMap';
import { buildVillage, FOG_COLOR } from './villageScene';
import { villageAudio, measureVillagePeaks } from './villageAudio';
import { setAnisotropy } from './materials';
import { placeNpcs } from './npcPlacement';
import { CH1_DAY1, CAST, FRAME_HOLD, makeActors, actorBox, actorChest, tickActor, nextLine, talkedOut, startMaryamSearch, newFilm, filmTick, pickFramed, testimonies, type Story, type Actor } from './npcTalk';
import { buildNpcFigures } from './npcFigures';
import { buildFurniture } from './furniture';
import { buildPrologueRoots } from './prologueRoots';
import { buildPrologueCow } from './prologueCow';
import { buildPrologueHall } from './prologueHall';
import { buildEastValley } from './eastValley';
import { buildSouthFarmland } from './southFarmland';
import { buildChapterTwo } from './chapterTwo';
import { buildChapterThree } from './chapterThree';
import { ORDER } from './npcData';
import { createArena } from './arena';
import { ARENA_START, segmentBox } from './rootBots';
import palette from '../studio/art/palette.json';

const DT = 1 / 120;
const FOV = 70;
const TC_START = new URLSearchParams(location.search).get('chapter') === '3'
  ? (5 * 60 + 5) * 60   // Ch3 starts at 05:05; the five-minute deadline and camcorder clock meet at 05:10.
  : (16 * 60 + 41) * 60 + 12;   // Ch1/2 camcorder clock: 16:41:12, nine minutes before sunset (world-bible)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.debug.checkShaderErrors = import.meta.env.DEV;   // production skips the synchronous shader-log readback
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;     // the set is static: the sun's shadow map renders once
renderer.shadowMap.needsUpdate = true;
setAnisotropy(renderer.capabilities.getMaxAnisotropy());
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.009);
const QUERY = new URLSearchParams(location.search);
const CHAPTER_TWO_MODE = QUERY.get('chapter') === '2';
const CHAPTER_THREE_MODE = QUERY.get('chapter') === '3';
const PROLOGUE_MODE = QUERY.get('prologue') === '1';
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 2000);
camera.rotation.order = 'YXZ';
scene.add(camera);
const cameraLamp = CHAPTER_TWO_MODE ? new THREE.SpotLight('#e7d6ae', 0, 28, Math.PI / 5.5, 0.58, 1.35) : null;
const cameraLampTarget = CHAPTER_TWO_MODE ? new THREE.Object3D() : null;
if (cameraLamp && cameraLampTarget) { scene.add(cameraLamp, cameraLampTarget); cameraLamp.target = cameraLampTarget; }
const tBuild0 = performance.now();
const V = buildVillage(scene, renderer, CHAPTER_TWO_MODE);
const EAST_VALLEY = buildEastValley(scene, V.terrainHeight);
const SOUTH_FARMLAND = PROLOGUE_MODE ? null : buildSouthFarmland(scene, V.terrainHeight);
const CH2_WORLD = CHAPTER_TWO_MODE ? buildChapterTwo(scene, V.terrainHeight) : null;
const CH3_WORLD = CHAPTER_THREE_MODE ? buildChapterThree(scene) : null;
if (CH3_WORLD) camera.add(CH3_WORLD.grabbingHands);
if (CH2_WORLD) EXAMINABLES.push(...CH2_WORLD.examinables);
V.stats['ms:build'] = Math.round(performance.now() - tBuild0);
const SOLIDS = villageSolids({ eastValleyOpen: CHAPTER_TWO_MODE, southFarmlandOpen: !PROLOGUE_MODE });
// The tower's original ladder blocker is removed only in Chapter 3, where the playable four-flight ladder replaces it.
if (CHAPTER_THREE_MODE) {
  for (let i = SOLIDS.length - 1; i >= 0; i--) {
    const b = SOLIDS[i].box;
    if (Math.abs(b.min.x - 1.7) < 0.02 && Math.abs(b.max.x - 3.3) < 0.02 && b.min.z > 25.4 && b.min.z < 25.8 && b.max.y < 3.3) SOLIDS.splice(i, 1);
  }
}
SOLIDS.push(...EAST_VALLEY.solids.map(box => ({ box })));
if (SOUTH_FARMLAND) SOLIDS.push(...SOUTH_FARMLAND.solids.map(box => ({ box })));
if (CH2_WORLD) SOLIDS.push(...CH2_WORLD.solids.map(box => ({ box })));
const ARENA_ON = QUERY.get('arena') === '1' || QUERY.get('roots') === '1';
const STORY_DAY = CHAPTER_TWO_MODE || CHAPTER_THREE_MODE ? 3 : QUERY.get('day') === '2' ? 2 : 1;
const prologueRoots = PROLOGUE_MODE ? buildPrologueRoots(scene) : null;
const prologueCow = PROLOGUE_MODE ? buildPrologueCow(scene, groundY) : null;
const prologueHall = PROLOGUE_MODE ? buildPrologueHall(scene) : null;
const OPENING_LINE: Text = PROLOGUE_MODE
  ? { ar: 'عليّ أن أعيد البقرة إلى البيت.', en: 'I have to bring the cow home.' }
  : CHAPTER_THREE_MODE ? { ar: 'القرية تسهر في الكنيسة.', en: 'The village keeps vigil in the church.' }
  : LINES.intro;
// ---------- NPCs (build step 2): Lorenzo's Day 1 cast where npcPlacement stands them; solid, so he walks round them.
// The arena sandbox (?arena=1) keeps its square to itself: no cast there. ----------
const story: Story & { flags: Set<string> } = {
  ...CH1_DAY1,
  chapter: CHAPTER_TWO_MODE ? 2 : CHAPTER_THREE_MODE ? 3 : 1,
  day: PROLOGUE_MODE ? 1 : STORY_DAY,
  events: PROLOGUE_MODE ? [] : CHAPTER_TWO_MODE || CHAPTER_THREE_MODE ? ORDER : STORY_DAY === 2 ? ORDER.slice(0, 6) : CH1_DAY1.events,
  flags: new Set<string>(),
  prologue: PROLOGUE_MODE,
  medicalCheckComplete: STORY_DAY >= 2,
};
const ACTORS = ARENA_ON ? [] : makeActors(story);
const ACTOR_STARTS = ACTORS.map(a => ({ x: a.x, y: a.y, z: a.z, stage: a.spec.stage, rest: a.rest, indoors: a.indoors, cuffed: a.spec.cuffed }));
const MOVING_ACTORS = ACTORS.filter(a => a.spec.stage === 'prologue-search' || a.id === 'npc_maryam');
const MOVING_BOXES = MOVING_ACTORS.map(actorBox);
if (prologueCow) MOVING_BOXES.push(prologueCow.box);
const MOVING_RAY_SOLIDS = MOVING_BOXES.map(box => ({ box }));
for (const a of ACTORS) if (!MOVING_ACTORS.includes(a)) SOLIDS.push({ box: actorBox(a) });
const NPCF = buildNpcFigures(scene, ACTORS, V.env);
// Furnished rooms (src/interiors.ts): Maryam's kitchen, the police post, the café; one merged draw per room in view.
const FURN = buildFurniture(scene, renderer, V.env);
V.stats['npc:tris'] = NPCF.stats.tris;
const TALK_RANGE = 3.2;
const TALKABLE_ACTORS = ACTORS.filter(a => a.spec.talkable !== false);
const actorLabel = (a: Actor): Text => a.id === 'npc_omar' && !a.spec.cuffed
  ? { ar: 'عمر', en: 'Omar' } : CAST[a.id].label;
const NPC_PICKS: Examinable[] = TALKABLE_ACTORS.map(a => ({ id: a.id, name: actorLabel(a), line: actorLabel(a), pos: actorChest(a, { x: 0, y: 0, z: 0 }), r: a.seated ? 0.5 : 0.42, from: { x: a.x, y: a.y, z: a.z } }));
function syncNpcPicks() {
  for (let i = 0; i < TALKABLE_ACTORS.length; i++) {
    const a = TALKABLE_ACTORS[i], pick = NPC_PICKS[i];
    actorChest(a, pick.pos);
    pick.from.x = a.x; pick.from.y = a.y; pick.from.z = a.z;
  }
}
const WORLD = SOLIDS.map(s => s.box);
const SIGHT_SOLIDS = SOLIDS.concat(MOVING_RAY_SOLIDS);
const audio = villageAudio();
// ---------- Arena (opt-in, ?arena=1 or ?roots=1): root walkers in the square and the spark caster, src/arena.ts. Off by
// default: in Chapter 1 Lorenzo is unarmed, and the slice runs exactly as without it. ----------
const arena = ARENA_ON ? createArena({
  scene, camera, canvas: renderer.domElement, env: V.env, audio, ground: groundY,
  near: (x, z) => nearWorld(x, z, false), segment: segmentHit, live: () => playing && endT < 0,
  respawn: () => { player = newPlayer(START); yaw = START_YAW; pitch = -0.03; }, toast: m => showToast(m),
}) : null;
const START = arena ? { x: ARENA_START.x, y: ARENA_START.y, z: ARENA_START.z }
  : PROLOGUE_MODE ? { x: 0, y: 0, z: 1.8 }
  : CHAPTER_THREE_MODE ? { x: 9.5, y: 0.01, z: 37.2 } : SPAWN;
// Chapter 2's opening objective sends Lorenzo east. The shared Chapter 1 opening yaw points
// into the barn's south wall from SPAWN, so use an east-facing camera for this direct chapter entry.
const START_YAW = arena ? ARENA_START.yaw : CHAPTER_TWO_MODE ? -Math.PI / 2 : PROLOGUE_MODE || CHAPTER_THREE_MODE ? 0 : SPAWN_YAW;
let prologueCowFound = false, prologueRespawns = 0, prologueSafeClock = 0;
let prologueSafePoint = { x: START.x, y: START.y, z: START.z, yaw: START_YAW, pitch: -0.03, cow: 0 };

// ---------- Broadphase: static boxes bucketed on a 4 m grid; each tick the physics sees only the boxes near the player ----------
const BP = 4, bpGrid = new Map<number, number[]>(), bpKey = (i: number, j: number) => i * 4099 + j;
WORLD.forEach((b, n) => {
  for (let i = Math.floor(b.min.x / BP); i <= Math.floor(b.max.x / BP); i++) for (let j = Math.floor(b.min.z / BP); j <= Math.floor(b.max.z / BP); j++) {
    const k = bpKey(i, j); let a = bpGrid.get(k); if (!a) bpGrid.set(k, a = []); a.push(n);
  }
});
const bpSeen = new Uint32Array(WORLD.length);
let bpStamp = 0;
const NEAR: Box[] = [];
/** Static boxes within ~2.5 m of (x, z) plus the gate and door leaves that are solid right now and the loose props
 *  (and the arena's walkers unless `bots` is false: their own movement). No allocation. */
function nearWorld(x: number, z: number, bots = true): Box[] {
  NEAR.length = 0; bpStamp++;
  for (let i = Math.floor((x - 2.5) / BP); i <= Math.floor((x + 2.5) / BP); i++) for (let j = Math.floor((z - 2.5) / BP); j <= Math.floor((z + 2.5) / BP); j++) {
    const a = bpGrid.get(bpKey(i, j)); if (!a) continue;
    for (const n of a) if (bpSeen[n] !== bpStamp) { bpSeen[n] = bpStamp; NEAR.push(WORLD[n]); }
  }
  for (const d of ENTS.doors) if (d.solid) NEAR.push(d.box);
  for (const p of ENTS.props) NEAR.push(p.box);
  for (const b of MOVING_BOXES) NEAR.push(b);
  if (bots && arena) arena.boxes(NEAR);
  return NEAR;
}
const INVIS = Uint8Array.from(SOLIDS, s => (s.tag === 'invisible' ? 1 : 0));
/** First solid along a→b as a fraction of the way (Infinity when clear): the static boxes in the broadphase cells the
 *  segment crosses (2D DDA; invisible clip boxes skipped), the solid door leaves and the props. The arena's line of
 *  sight and hitscan. No allocation. */
function segmentHit(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let best = Infinity, i = Math.floor(ax / BP), j = Math.floor(az / BP);
  const i1 = Math.floor(bx / BP), j1 = Math.floor(bz / BP), si = Math.sign(dx), sj = Math.sign(dz);
  const tdx = dx ? Math.abs(BP / dx) : Infinity, tdz = dz ? Math.abs(BP / dz) : Infinity;
  let tx = dx ? ((si > 0 ? (i + 1) * BP : i * BP) - ax) / dx : Infinity, tz = dz ? ((sj > 0 ? (j + 1) * BP : j * BP) - az) / dz : Infinity;
  bpStamp++;
  for (let n = 0; n < 1024; n++) {
    const a = bpGrid.get(bpKey(i, j));
    if (a) for (const k of a) if (bpSeen[k] !== bpStamp) { bpSeen[k] = bpStamp; if (!INVIS[k]) best = Math.min(best, segmentBox(ax, ay, az, dx, dy, dz, WORLD[k])); }
    if ((i === i1 && j === j1) || Math.min(tx, tz) > best) break;
    if (tx < tz) { tx += tdx; i += si; } else { tz += tdz; j += sj; }
  }
  for (const d of ENTS.doors) if (d.solid) best = Math.min(best, segmentBox(ax, ay, az, dx, dy, dz, d.box));
  for (const p of ENTS.props) best = Math.min(best, segmentBox(ax, ay, az, dx, dy, dz, p.box));
  for (const b of MOVING_BOXES) best = Math.min(best, segmentBox(ax, ay, az, dx, dy, dz, b));
  return best;
}

function syncMovingActorBoxes() {
  for (let i = 0; i < MOVING_ACTORS.length; i++) {
    const next = actorBox(MOVING_ACTORS[i]), box = MOVING_BOXES[i];
    Object.assign(box.min, next.min);
    Object.assign(box.max, next.max);
  }
}

// ---------- Entities: gates and doors (index = USABLES index), the bell rope, the pail and the stool ----------
const ENTS: Ents = { doors: [], buttons: [], props: [], events: [] };
function resetEnts() {
  ENTS.doors = USABLES.map(u => makeDoor(u.id, (t, out) => leafBox(u, t, out), { locked: u.locked }));
  ENTS.buttons = [makeButton(BELL_ROPE.id, BELL_ROPE.target, { wait: 5, press: 0.9 })];
  ENTS.props = PROPS.map(p => makeProp(p.id, { ...p.pos, y: groundY(p.pos.x, p.pos.z) }, p.half, { follow: p.follow, drag: p.drag }));
  ENTS.events.length = 0;
}
resetEnts();
const BUTTONS = [BELL_ROPE] as unknown as Examinable[];
const leafObj = USABLES.map(u => V.leaves.find(l => l.id === u.id)?.obj ?? null);
const push: Push = { x: 0, z: 0, speed: 0, vx: 0, vz: 0 };
const scrapeT = new Float32Array(PROPS.length);
let bells = 0;
/** Entity events to sounds (and the locked prompt). */
function drainEvents() {
  for (const ev of ENTS.events) {
    if (ev.type === 'locked') { audio.play('rattle'); lockT = 1.6; lockU = USABLES.findIndex(u => u.id === ev.id); }
    else if (ev.type === 'blocked') audio.play('latch', undefined, 0.4);
    else if (ev.type === 'open' || ev.type === 'close') { audio.play('latch', undefined, 0.9); audio.play('creak', undefined, 0.35); }
    else if (ev.type === 'shut') audio.play('latch', undefined, 0.7);
    else if (ev.type === 'fire' && ev.target === 'bell') { bells++; audio.play('bell', 0.35); }
    else if (ev.type === 'bump') audio.play('bump', ev.id === 'pail' ? 1 : 0, Math.min(1.5, ev.speed / 2));
  }
  ENTS.events.length = 0;
}
const HOLLOW = BUILDINGS.filter(b => b.hollow);
/** compileAsync skips the sun's shadow pass, which draws every caster with three's internal MeshDepthMaterial. This
 *  stand-in has the same program key (BackSide from shadowSide, no map, no fog, one shadowed directional light, linear
 *  output into a render target), so frame 1 takes the linked program from the cache. It needs no textures, so it
 *  links during the texture wait. Never dispose it: that would release the shared program. */
function compileShadowDepth(): Promise<unknown> {
  const s = new THREE.Scene(), light = new THREE.DirectionalLight(), rt = new THREE.WebGLRenderTarget(1, 1);
  light.castShadow = true;
  s.add(light, new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshDepthMaterial({ side: THREE.BackSide })));
  renderer.setRenderTarget(rt);
  const p = renderer.compileAsync(s, camera);
  renderer.setRenderTarget(null);
  rt.dispose();
  return p;
}
// F3 draws the NPC collision boxes (teal) and the spots of the story's NPCs that are still open (amber: no interior
// yet, floor undecided, inside a solid; src/npcPlacement.ts), which are left out of the scene. One line draw, F3 only.
const NPC_OPEN = placeNpcs(story.day, { chapter: story.chapter, prologue: story.prologue, events: story.events }).filter(p => p.issues.length);
const npcMarks = (() => {
  const pos: number[] = [], col: number[] = [], ok = new THREE.Color(palette.ruptureTeal), open = new THREE.Color(palette.hudAmber);
  const boxes: [Box, THREE.Color][] = [...ACTORS.map(a => [actorBox(a), ok] as [Box, THREE.Color]),
    ...NPC_OPEN.map(p => [{ min: { x: p.x - 0.24, y: p.y, z: p.z - 0.24 }, max: { x: p.x + 0.24, y: p.y + 1.78, z: p.z + 0.24 } }, open] as [Box, THREE.Color])];
  for (const [b, c] of boxes) {
    const X = [b.min.x, b.max.x], Y = [b.min.y, b.max.y], Z = [b.min.z, b.max.z];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      pos.push(X[0], Y[i], Z[j], X[1], Y[i], Z[j], X[i], Y[0], Z[j], X[i], Y[1], Z[j], X[i], Y[j], Z[0], X[i], Y[j], Z[1]);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }));
  l.visible = false; l.frustumCulled = false;
  scene.add(l);
  return l;
})();
const depthReady = compileShadowDepth();
// Stone and wood texture sets and the furniture first (4 s at most), so their programs compile here with the maps
// bound, not in frame 1 (the furniture's program links with a stand-in map either way).
const tTex0 = performance.now();
await Promise.race([Promise.all([V.texturesReady, FURN.ready, EAST_VALLEY.ready, CH2_WORLD?.ready ?? Promise.resolve()]), new Promise(r => setTimeout(r, 4000))]);
renderer.shadowMap.needsUpdate = true;
V.stats['east:instances'] = EAST_VALLEY.stats.instances;
V.stats['east:meshes'] = EAST_VALLEY.stats.meshes;
void FURN.ready.then(() => Object.assign(V.stats, { 'furn:tris': FURN.stats.tris, 'furn:models': FURN.stats.models, 'furn:cells': FURN.stats.cells, 'ms:furn': FURN.stats.ms }));
V.stats['ms:tex'] = Math.round(performance.now() - tTex0);
// Every program (outlines and the shadow depth pass included) compiles before the first frame. Async: the driver
// links in parallel (KHR_parallel_shader_compile) and the page stays responsive meanwhile.
for (const h of V.highlights) h.group.visible = true;
const tCompile0 = performance.now();
await Promise.all([renderer.compileAsync(scene, camera), depthReady]);
V.stats['ms:compile'] = Math.round(performance.now() - tCompile0);
for (const h of V.highlights) h.group.visible = false;

// ---------- UI ----------
const $ = (id: string) => document.getElementById(id)!;
for (const id of ['hud', 'ammo', 'end', 'death', 'hurt']) $(id).style.display = 'none';
document.body.classList.add('village');
const overlay = $('overlay'), sub = $('sub'), subAr = $('sub-ar'), subEn = $('sub-en'), prompt = $('prompt');
if (PROLOGUE_MODE || STORY_DAY === 2 || CHAPTER_TWO_MODE || CHAPTER_THREE_MODE) $('story-objective').style.display = 'block';
if (PROLOGUE_MODE) {
  $('objective-ar').textContent = 'اعثر على البقرة في الحظيرة';
  $('objective-en').textContent = 'Find the cow in the barn';
}
const evidenceLedger = $('evidence-ledger');
if (!PROLOGUE_MODE && STORY_DAY === 1 && !CHAPTER_TWO_MODE && !CHAPTER_THREE_MODE) evidenceLedger.style.display = 'block';
if (STORY_DAY === 2 && !PROLOGUE_MODE) {
  // This unvoiced objective card communicates Moreno's already-approved assignment; it is not NPC dialogue.
  $('objective-ar').textContent = 'قابل إيليا؛ كلّفها مورينو بالتظاهر بأنها حبيبة عمر';
  $('objective-en').textContent = "Meet Elia. Moreno assigned her to pose as Omar's girlfriend.";
} else if (CHAPTER_TWO_MODE) {
  $('objective-ar').textContent = 'اتبع الطريق شرقاً نحو المحجر';
  $('objective-en').textContent = 'Follow the road east toward the quarry';
} else if (CHAPTER_THREE_MODE) {
  $('objective-ar').textContent = 'تحدّث إلى القسيس. الموعد النهائي 05:10';
  $('objective-en').textContent = 'Talk to the priest · deadline 05:10 · 05:00';
}
function setStoryObjective(ar: string, en: string) {
  $('objective-ar').textContent = ar;
  $('objective-en').textContent = en;
}
function setChapterTwoStage(stage: number) {
  if (!CHAPTER_TWO_MODE || stage <= chapterTwoStage) return;
  chapterTwoStage = stage;
  const objectives: Record<number, [string, string]> = {
    1: ['اعثر على بوابة منجم الغربان', "Find the Ravens' mine gate"],
    2: ['اتبع سلك المصابيح إلى الداخل', 'Follow the string-light cable inside'],
    3: ['اعثر على المسجّل في المستودع', 'Find the recorder in the depot'],
    4: ['واصل إلى القاعة', 'Continue to the Hall'],
    5: ['صوّر يوسف والحيوانات', 'Film Joseph and the animals'],
    6: ['اخرج من فم الكهف', 'Exit through the cave mouth'],
  };
  const objective = objectives[stage];
  if (objective) setStoryObjective(objective[0], objective[1]);
}
const promptAr = $('prompt-ar'), promptEn = $('prompt-en'), rec = $('rec'), tc = $('tc'), clips = $('clips');
const fade = $('fade'), title = $('title'), toast = $('toast'), subWho = $('sub-who'), subWhoAr = $('sub-who-ar'), subWhoEn = $('sub-who-en'), recLabel = $('rec-label');
const batt = $('batt'), battFill = $('batt-fill'), focus = $('focus');
$('title-stats').textContent = '';
let subTime = 0;
/** Shows a line (AR over EN); `who` names the speaker (an NPC), none for Lorenzo's own lines. */
function subtitle(t: Text, seconds?: number, who?: Text) {
  subAr.textContent = t.ar; subEn.textContent = t.en;
  subWhoAr.textContent = who ? who.ar : ''; subWhoEn.textContent = who ? who.en : ''; subWho.classList.toggle('on', !!who);
  subTime = seconds ?? Math.max(4, 2.2 + t.en.length * 0.055);
}

// ---------- State ----------
let player: PlayerState = newPlayer(START);
let vs: VillageState = newVillageState();
let yaw = START_YAW, pitch = -0.03, storyTime = 0, endT = -1, introDone = false, turnbackCD = 0;
let target = -1, lastExamine = -1, zoomT = 0, useTarget = -1, buttonTarget = -1, lockT = 0, lockU = -1, npcTarget = -1;
// Talk: the lines heard so far (the order cursor, src/npcTalk.ts nextLine) and a log for the tests. Film: hold RMB.
const heard = new Set<string>(), talkLog: { npc: string; line: string; t: number }[] = [];
let maryamQuestionedAt = -Infinity;
let prologueAttackT = -1, prologueHallEntered = false;
let dayTwoTransitionAt = -1, chapterTwoTransitionAt = -1, medicalCheckAt = -1;
let chapterTwoStage = 0, chapterTwoRecorderFound = false, chapterTwoHallFilmed = false, chapterTwoFilmHold = 0, chapterTwoHazardClock = -1;
let chapterTwoHazardWarned = false, chapterTwoComplete = false;
let chapterThreeStage = 0, chapterThreeClimbing = false, chapterThreeSeized = false, chapterThreeUploadHold = 0, chapterThreeUploadAttempts = 0;
let chapterThreeDeadline = 300, chapterThreeUploaded = false, chapterThreeUploadFailed = false, chapterThreeVehicleAt = -1;
let film = newFilm(), filmHeld = false;
const familyPhotoShown = new Set<string>(), ch1TestimonyKeys = new Set<string>();
let familyPhotoAt = -1;
const hl = new Float32Array(EXAMINABLES.length);
const zoneOut: ('end' | 'turnback')[] = [];
const pb: Box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const eyeV = { x: 0, y: 0, z: 0 }, dirV = { x: 0, y: 0, z: 0 };
const _cameraForward = new THREE.Vector3(), _toHall = new THREE.Vector3();

// ---------- Input ----------
const keys = new Set<string>();
// Secret word: type "sinafly" to ride the flying carpet (V.carpet), type it again to land. The rider sits: eye 0.95 m
// above the rug, which reaches 2 m ahead, so its front edge and tassels show at the bottom of the frame.
let typed = '', flying = false;
const flyV = { x: 0, y: 0, z: 0 }, CARPET_EYE = 0.95, CARPET_AHEAD = 0.75;
function setFlying(on: boolean) {
  flying = on;
  if (on) { flyV.x = player.vel.x; flyV.y = Math.max(0, player.vel.y); flyV.z = player.vel.z; }
  else { player.vel.x = flyV.x; player.vel.y = flyV.y; player.vel.z = flyV.z; }   // glide off, then fall
  V.carpet.mesh.visible = on;
  showToast(on ? 'FLY MODE ON' : 'FLY MODE OFF');
}
addEventListener('keydown', e => {
  if (e.code.startsWith('Control') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.key && e.key.length === 1) {
    typed = (typed + e.key.toLowerCase()).slice(-12);
    if (typed.endsWith('sinafly')) { typed = ''; if (endT < 0) setFlying(!flying); }
  }
  if (e.code === 'KeyP' && !PROLOGUE_MODE && STORY_DAY === 1 && !CHAPTER_TWO_MODE && !CHAPTER_THREE_MODE) {
    const witness = npcTarget >= 0 ? TALKABLE_ACTORS[npcTarget] : null;
    const eligible = witness && /^(npc_farmer|npc_farmers_wife|npc_priest|npc_officer_[12]|npc_square_villager_[1-6])$/.test(witness.id);
    if (!eligible) showToast('AIM AT A VILLAGER TO SHOW THE FAMILY PHOTO');
    else if (witness && eligible && !familyPhotoShown.has(witness.id)) {
      familyPhotoShown.add(witness.id); familyPhotoAt = storyTime + 1.8;
      showToast(`PHOTO SHOWN — ${actorLabel(witness).en.toUpperCase()}`); audio.play('chime');
      updateEvidenceLedger();
    } else showToast('PHOTO ALREADY SHOWN TO THIS PERSON');
  }
  if (e.code === 'KeyE') {
    if (CHAPTER_TWO_MODE && !chapterTwoRecorderFound) {
      const recorderIndex = EXAMINABLES.findIndex(item => item.id === 'ch2-recorder');
      const recorder = EXAMINABLES[recorderIndex];
      if (recorder && Math.hypot(player.pos.x - recorder.pos.x, player.pos.z - recorder.pos.z) <= 2.2) {
        target = recorderIndex; examine(); return;
      }
    }
    if (CHAPTER_THREE_MODE && chapterThreeStage === 0) {
      const priest = TALKABLE_ACTORS.find(a => a.id === 'npc_priest' && Math.hypot(a.x - player.pos.x, a.z - player.pos.z) < 3.2);
      if (priest) { talk(priest); return; }
    }
    examine();
  }
  if (e.code === 'KeyR' && endT > 9) {
    if (PROLOGUE_MODE) {
      sessionStorage.setItem('ov-prologue-complete', '1');
      location.search = '';
    } else if (CHAPTER_TWO_MODE) location.search = '?chapter=3';
    else restart();
  }
  if (e.code === 'F3') { e.preventDefault(); devOn = !devOn; dev.style.display = devOn ? 'block' : 'none'; npcMarks.visible = devOn; }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); filmHeld = false; });
// Lorenzo's camera: hold the right button to record. The page's context menu never opens over the game.
addEventListener('mousedown', e => { if (e.button === 2 && playing) filmHeld = true; });
addEventListener('mouseup', e => { if (e.button === 2) filmHeld = false; });
addEventListener('contextmenu', e => e.preventDefault());
let playing = false, dragLook = false, pointerLockPending = false;
function fallBackToDragLook() {
  if (document.pointerLockElement) { pointerLockPending = false; dragLook = false; return; }
  pointerLockPending = false; dragLook = true;
  if (playing) { overlay.style.display = 'none'; showToast('MOUSE LOCK BLOCKED — DRAG TO LOOK'); }
}
function startPlay() {
  overlay.style.display = 'none';
  playing = true; dragLook = false; pointerLockPending = true;
  audio.start();
  try {
    const p = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p?.then) p.then(() => {
      if (document.pointerLockElement) { pointerLockPending = false; dragLook = false; }
      else fallBackToDragLook();
    }).catch(fallBackToDragLook);
    else setTimeout(fallBackToDragLook, 900);
    setTimeout(fallBackToDragLook, 1200);
  } catch { fallBackToDragLook(); }
}
overlay.addEventListener('click', startPlay);
renderer.domElement.addEventListener('click', () => { if (!document.pointerLockElement && !dragLook) startPlay(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) { pointerLockPending = false; dragLook = false; return; }
  if (pointerLockPending) return;
  if (!dragLook && endT < 0) { playing = false; overlay.style.display = 'flex'; }
});
document.addEventListener('pointerlockerror', fallBackToDragLook);
addEventListener('keydown', e => { if (e.code === 'Escape' && dragLook) { playing = false; overlay.style.display = 'flex'; } });
addEventListener('mousemove', e => {
  if (endT >= 0) return;
  if (!document.pointerLockElement && !(dragLook && playing && e.buttons)) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.0022));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
arena?.start();
let toastTime = 0;
function showToast(msg: string) { toast.textContent = msg; toastTime = 2.5; }

function readInput(): Input {
  const k = (c: string) => keys.has(c) ? 1 : 0;
  const free = endT < 0 && !arena?.down();
  return {
    forward: free ? k('KeyW') - k('KeyS') + k('ArrowUp') - k('ArrowDown') : 0,
    strafe: free ? k('KeyD') - k('KeyA') : 0,
    jump: free && keys.has('Space'),
    crouch: free && (keys.has('ControlLeft') || keys.has('KeyC')),
    walk: !keys.has('ShiftLeft') && !keys.has('ShiftRight'),   // Lorenzo walks; Shift jogs
    yaw,
  };
}

// ---------- Examine / use ----------
function examine() {
  if (endT >= 0) return;
  if (target < 0) {
    if (npcTarget >= 0) talk(TALKABLE_ACTORS[npcTarget]);
    else if (useTarget >= 0) use(useTarget);
    else if (buttonTarget >= 0 && pressButton(ENTS, ENTS.buttons[buttonTarget])) drainEvents();
    return;
  }
  const e = EXAMINABLES[target];
  if (markExamined(vs, e.id)) { audio.play('chime'); clips.classList.remove('pulse'); void clips.offsetWidth; clips.classList.add('pulse'); }
  subtitle(e.line);
  lastExamine = target; zoomT = subTime;
  if (CHAPTER_TWO_MODE && e.id === 'ch2-recorder') {
    chapterTwoRecorderFound = true;
    setChapterTwoStage(4);
    if (player.pos.x > 323) setChapterTwoStage(5);
    showToast('RECORDER ADDED TO EVIDENCE');
  }
}
/** E on an NPC: the next line it has for this story state (src/npcTalk.ts), under the speaker's role. It turns to
 *  Lorenzo and nods along while the line is up. A press during a line moves on to the next one. */
function talk(a: Actor) {
  const line = nextLine(a.spec, story, heard);
  if (!line) return;
  subtitle({ ar: line.ar, en: line.line }, undefined, actorLabel(a));
  for (const o of ACTORS) if (o !== a) { o.talk = 0; o.line = null; }
  a.talk = subTime; a.line = line.id;
  talkLog.push({ npc: a.id, line: line.id, t: storyTime });
  if (a.id === 'npc_maryam' && line.id === 'maryam_door') {
    story.flags.add('maryam_questioned');
    maryamQuestionedAt = storyTime;
  }
  if (CHAPTER_THREE_MODE && a.id === 'npc_priest' && line.id === 'priest_ladder') {
    chapterThreeStage = 1;
    setStoryObjective('ادخل برج الجرس المجاور، واصعد السلّم الشمالي', 'Enter the bell tower beside the church; climb its north ladder');
  }
  if (a.id === 'npc_maryam' && line.id === 'maryam_confirmed_missing' && startMaryamSearch(a)) {
    story.flags.add('joseph_late_confirmed');
    const gate = ENTS.doors.find(d => d.id === 'gate-maryam');
    if (gate) gate.goal = 1;
  }
  if (a.id === 'npc_omar' && line.id === 'omar_mountain' && story.day === 1 && a.spec.cuffed) {
    medicalCheckAt = storyTime + subTime + 2.5;
  }
  if (story.day === 2 && a.id === 'npc_elia' && line.id === 'elia_photos') {
    story.flags.add('elia_cover_introduced');
    setStoryObjective('اسأل عمر عن المرأة على الشرفة', 'Ask Omar about the woman on the balcony');
  }
  if (story.day === 2 && a.id === 'npc_omar' && line.id === 'omar_watcher') {
    $('story-objective').style.display = 'none';
    showToast('DAY 2 STORY BEAT COMPLETE');
    chapterTwoTransitionAt = storyTime + subTime + 0.8;
  }
  // Moreno's first briefing closes Day 1 only after Lorenzo has heard Omar. The ordered prefix advances to
  // assignment event 6; the Day 2 reload then places Elia on the built café balcony and removes Omar's cuffs.
  if (a.id === 'npc_moreno' && line.id === 'moreno_said' && story.day === 1 && story.medicalCheckComplete && story.events.length >= 5
      && talkLog.some(e => e.npc === 'npc_omar')) {
    dayTwoTransitionAt = storyTime + subTime + 0.65;
  }
}
function updateEvidenceLedger() {
  $('evidence-photo').textContent = `الصورة: ${Math.min(4, familyPhotoShown.size)}/4 · Photo: ${Math.min(4, familyPhotoShown.size)}/4`;
  $('evidence-testimonies').textContent = `الإفادات: ${Math.min(3, ch1TestimonyKeys.size)}/3 · Statements: ${Math.min(3, ch1TestimonyKeys.size)}/3`;
}
/** E on a gate or door: swing it (0.75 s), or rattle it if locked. A leaf never closes on the player. Locked: the prompt
 *  under the crosshair reads "Locked." at once (not a spoken line, so it never waits for or cuts the subtitle channel). */
function use(u: number) {
  useDoor(ENTS, ENTS.doors[u], pb);
  drainEvents();
}

// ---------- Simulation ----------
function tick(input: Input) {
  storyTime += DT;
  $('family-photo-card').style.display = storyTime < familyPhotoAt ? 'flex' : 'none';
  SOUTH_FARMLAND?.tick(DT);
  if (medicalCheckAt > 0 && storyTime >= medicalCheckAt) {
    medicalCheckAt = -1; story.medicalCheckComplete = true;
    const omar = ACTORS.find(a => a.id === 'npc_omar');
    if (omar) { omar.spec.cuffed = false; NPCF.setCuffed(ACTORS); }
    showToast('GUARDED MEDICAL CHECK COMPLETE');
  }
  if (dayTwoTransitionAt > 0 && storyTime >= dayTwoTransitionAt) {
    fade.style.opacity = '1';
    if (storyTime >= dayTwoTransitionAt + 1.8) location.search = '?day=2';
  }
  if (chapterTwoTransitionAt > 0 && storyTime >= chapterTwoTransitionAt) {
    fade.style.opacity = '1';
    if (storyTime >= chapterTwoTransitionAt + 1.8) location.search = '?chapter=2';
  }
  if (!introDone && storyTime > 1.4) { introDone = true; if (subTime <= 0 && !CHAPTER_TWO_MODE && !CHAPTER_THREE_MODE) subtitle(OPENING_LINE, 6.5); }   // never cut off a line
  if (maryamQuestionedAt > -Infinity && storyTime - maryamQuestionedAt >= 8) story.flags.add('maryam_waited_without_joseph');
  turnbackCD -= DT;
  // Entities first: props the player walks into move ahead of him (and set his pace), leaves swing and turn solid again
  // once he is clear, buttons recover.
  pushFrom(input.forward, input.strafe, input.yaw, input.walk, player.crouched, player.onGround && !flying, player.vel, push);
  input.speedScale = pushScale(ENTS, pb, push);   // same contact as the push itself, so decided before the props move
  tickEnts(ENTS, DT, pb, push, nearWorld, groundY);
  if (ENTS.events.length) drainEvents();
  if (!flying && CHAPTER_THREE_MODE && !chapterThreeClimbing && chapterThreeStage >= 1 && player.pos.y < 0.2
      && Math.abs(player.pos.x - CH3_WORLD!.ladderX) < 0.85 && Math.abs(player.pos.z - CH3_WORLD!.ladderZ) < 1.0 && input.forward > 0.1) {
    chapterThreeClimbing = true;
    player.pos.x = CH3_WORLD!.ladderX; player.pos.z = CH3_WORLD!.ladderZ; player.pos.y = 0;
    player.vel.x = player.vel.y = player.vel.z = 0;
    showToast('FLIGHT 1 / 4');
  }
  if (flying) {
    // Carpet flight: WASD steers in the look direction (7 m/s), Space climbs, Ctrl or C descends (4 m/s); speed eases in
    // and out over about half a second. No walls while flying; the terrain is the floor.
    const sn = Math.sin(input.yaw), cs = Math.cos(input.yaw), k = Math.min(1, DT * 2.5);
    const up = (input.jump ? 1 : 0) - (keys.has('ControlLeft') || keys.has('KeyC') ? 1 : 0);
    flyV.x += ((-sn * input.forward + cs * input.strafe) * 7 - flyV.x) * k;
    flyV.z += ((-cs * input.forward - sn * input.strafe) * 7 - flyV.z) * k;
    flyV.y += (up * 4 - flyV.y) * k;
    player.pos.x += flyV.x * DT; player.pos.y += flyV.y * DT; player.pos.z += flyV.z * DT;
    const g = groundY(player.pos.x, player.pos.z);
    if (player.pos.y < g) { player.pos.y = g; flyV.y = Math.max(0, flyV.y); }
    player.vel.x = player.vel.y = player.vel.z = 0; player.onGround = false;
  } else if (CHAPTER_THREE_MODE && chapterThreeClimbing) {
    player.pos.y = Math.max(0, Math.min(CH3_WORLD!.topY, player.pos.y + input.forward * 1.35 * DT));
    player.vel.x = player.vel.y = player.vel.z = 0; player.onGround = player.pos.y <= 0;
  } else {
    step(player, input, nearWorld(player.pos.x, player.pos.z), DT, V.terrainHeight);
  }
  if (PROLOGUE_MODE && endT < 0) prologueCow?.tick(DT, player.pos.x, player.pos.z);
  if (PROLOGUE_MODE && endT < 0 && prologueCow) {
    const cowPos = prologueCow.position();
    if (!prologueCowFound && Math.hypot(player.pos.x - cowPos.x, player.pos.z - cowPos.z) <= 8) {
      prologueCowFound = true;
      setStoryObjective('اتبع البقرة وآثار الحوافر نحو المجرى', 'Follow the cow and hoofprints toward the stream');
      showToast('COW FOUND — FOLLOW THE HOOFPRINTS');
    }
    const g = V.terrainHeight(player.pos.x, player.pos.z);
    const invalid = !Number.isFinite(player.pos.x + player.pos.y + player.pos.z)
      || player.pos.y < g - 3
      || player.pos.x < -80 || player.pos.x > 250 || player.pos.z < -110 || player.pos.z > 180;
    if (invalid) {
      player.pos.x = prologueSafePoint.x; player.pos.y = prologueSafePoint.y; player.pos.z = prologueSafePoint.z;
      player.vel.x = player.vel.y = player.vel.z = 0; player.onGround = true;
      yaw = prologueSafePoint.yaw; pitch = prologueSafePoint.pitch;
      prologueCow.restore(prologueSafePoint.cow); prologueRespawns++;
      showToast('RETURNED TO LAST SAFE POINT'); audio.play('groan');
    } else {
      prologueSafeClock -= DT;
      if (prologueSafeClock <= 0 && player.onGround && Math.abs(player.pos.y - g) < 0.18) {
        prologueSafePoint = { x: player.pos.x, y: g, z: player.pos.z, yaw, pitch, cow: prologueCow.checkpoint() };
        prologueSafeClock = 2.0;
      }
    }
  }
  const r = TUNING.radius, h = height(player);
  pb.min.x = player.pos.x - r; pb.min.y = player.pos.y; pb.min.z = player.pos.z - r;
  pb.max.x = player.pos.x + r; pb.max.y = player.pos.y + h; pb.max.z = player.pos.z + r;
  if (CHAPTER_TWO_MODE && CH2_WORLD && endT < 0) {
    const x = player.pos.x, z = player.pos.z;
    if (x > 228) setChapterTwoStage(1);
    if (x > 255 && Math.abs(z - 40) < 8) setChapterTwoStage(2);
    if (x > 274 && Math.abs(z - 40) < 8) setChapterTwoStage(3);
    if (chapterTwoRecorderFound && x > 323) setChapterTwoStage(5);

    const hazardZone = x > 292 && x < 301 && Math.abs(z - 40) < 1.9;
    if (hazardZone) {
      if (chapterTwoHazardClock < 0) { chapterTwoHazardClock = 0; chapterTwoHazardWarned = false; }
      chapterTwoHazardClock += DT;
      if (chapterTwoHazardClock >= 4) { chapterTwoHazardClock -= 4; chapterTwoHazardWarned = false; }
      const warning = chapterTwoHazardClock < 0.6, lashing = chapterTwoHazardClock >= 0.6 && chapterTwoHazardClock < 0.95;
      if (warning && !chapterTwoHazardWarned) { audio.play('rootcreak'); chapterTwoHazardWarned = true; }
      CH2_WORLD.setHazard(warning, lashing, chapterTwoStage >= 6);
      if (lashing && Math.abs(x - 296.7) < 1.05) {
        player.pos.x = 287.2; player.pos.y = V.terrainHeight(player.pos.x, z); player.pos.z = z;
        player.vel.x = player.vel.y = player.vel.z = 0; player.onGround = true;
        chapterTwoHazardClock = -1; chapterTwoHazardWarned = false;
        showToast('ROOT STRIKE — BACK TO THE SAFE GALLERY'); audio.play('groan');
      }
    } else if (chapterTwoHazardClock >= 0) {
      chapterTwoHazardClock = -1; chapterTwoHazardWarned = false;
      CH2_WORLD.setHazard(false, false, chapterTwoStage >= 6);
    }
    if (chapterTwoStage >= 5 && x > 373 && Math.abs(z - 42) < 7 && !chapterTwoComplete) {
      if (chapterTwoStage < 6) setChapterTwoStage(6);
      chapterTwoComplete = true; $('story-objective').style.display = 'none';
      showToast(chapterTwoHallFilmed ? 'CHAPTER 2 COMPLETE · FOOTAGE SECURED' : 'CHAPTER 2 COMPLETE · FOOTAGE MISSED'); startEnd();
    }
  }
  if (CHAPTER_THREE_MODE && CH3_WORLD && chapterThreeClimbing && endT < 0) {
    const reached = Math.floor((player.pos.y + 0.001) / 5);
    if (reached >= 1 && chapterThreeStage < 2) { chapterThreeStage = 2; showToast('FLIGHT 2 / 4'); }
    if (reached >= 2 && chapterThreeStage < 3) { chapterThreeStage = 3; showToast('FLIGHT 3 / 4'); }
    if (reached >= 3 && chapterThreeStage < 4) { chapterThreeStage = 4; showToast('FLIGHT 4 / 4'); }
    if (player.pos.y >= CH3_WORLD.topY - 0.01 && chapterThreeStage < 5) {
      chapterThreeStage = 5;
      setStoryObjective('ارفع اللقطات قبل الساعة 05:10 — اضغط E باستمرار', 'Upload the footage before 05:10 — hold E');
      showToast('TOP LANDING — SIGNAL WINDOW OPEN');
    }
    if (chapterThreeStage >= 5 && !chapterThreeUploaded && !chapterThreeUploadFailed && chapterThreeDeadline > 0) {
      const atUpload = Math.hypot(player.pos.x - CH3_WORLD.upload.x, player.pos.z - CH3_WORLD.upload.z) < 1.8;
      if (atUpload && keys.has('KeyE') && chapterThreeDeadline > 0) {
        chapterThreeUploadHold += DT;
        if (chapterThreeUploadHold >= 20) {
          chapterThreeUploaded = true; chapterThreeVehicleAt = storyTime;
          setStoryObjective('وصلت الإشارة. الكاميرا أصبحت دليلاً.', 'Signal sent. The camera is now evidence.');
          CH3_WORLD.showVehicles(); audio.play('drone'); showToast('SIGNAL SENT — VEHICLES ON THE VALLEY ROAD');
        }
      } else if (chapterThreeUploadHold > 0) {
        chapterThreeUploadAttempts++;
        chapterThreeUploadHold = 0;
        if (chapterThreeUploadAttempts >= 2) { chapterThreeUploadFailed = true; setStoryObjective('انقطع الإرسال. انتظر وصول المركبات.', 'Upload failed. Vehicles are coming.'); showToast('UPLOAD INTERRUPTED — WINDOW LOST'); }
        else showToast('UPLOAD INTERRUPTED — ONE RETRY LEFT');
      }
      const seconds = Math.ceil(chapterThreeDeadline);
      $('objective-en').textContent = `Upload before 05:10 · hold E (${Math.floor(chapterThreeUploadHold)} / 20 s) · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }
  if (CHAPTER_THREE_MODE && CH3_WORLD && playing && !chapterThreeUploaded) {
    chapterThreeDeadline = Math.max(0, chapterThreeDeadline - DT);
    if (chapterThreeStage < 5) $('objective-en').textContent = `Talk to the priest · deadline 05:10 · ${String(Math.floor(chapterThreeDeadline / 60)).padStart(2, '0')}:${String(Math.floor(chapterThreeDeadline % 60)).padStart(2, '0')}`;
    if (chapterThreeDeadline <= 0 && chapterThreeVehicleAt < 0) {
      chapterThreeUploadFailed = true; chapterThreeVehicleAt = storyTime; CH3_WORLD.showVehicles();
      setStoryObjective('فات الموعد. المركبات تقترب.', '05:10 passed. Vehicles arrive.');
      showToast('05:10 — VEHICLES ARRIVE, SIGNAL NOT SENT');
    }
  }
  if (CHAPTER_THREE_MODE && (chapterThreeUploaded || chapterThreeUploadFailed) && chapterThreeVehicleAt >= 0 && storyTime - chapterThreeVehicleAt >= 4 && endT < 0) startEnd();
  for (const ev of zoneEvents(vs, pb, zoneOut, !CHAPTER_TWO_MODE && !CHAPTER_THREE_MODE)) {
    if (ev === 'end' && endT < 0) {
      if (PROLOGUE_MODE && prologueAttackT < 0) {
        prologueAttackT = 0;
        audio.play('rootcreak');
      } else if (!PROLOGUE_MODE) startEnd();
    }
    if (ev === 'turnback' && turnbackCD <= 0 && endT < 0) { subtitle(LINES.turnback, 3.5); turnbackCD = 6; }
  }
  if (PROLOGUE_MODE && prologueAttackT >= 0 && endT < 0) {
    prologueAttackT += DT;
    prologueRoots?.grow(player.pos.x, player.pos.y, player.pos.z, yaw, prologueAttackT);
    if (prologueAttackT >= 1.8) {
      audio.play('groan');
      startEnd();
    }
  }
  arena?.tick(DT, player, h);
}

const cave = bearingDir(MOUNTAIN.caveBearing);
const END = { yaw0: 0, pitch0: 0, yaw1: Math.atan2(-cave.x, -cave.z), pitch1: 0.05 };
function startEnd() {
  endT = 0;
  END.yaw0 = yaw; END.pitch0 = pitch;
  if (CHAPTER_THREE_MODE) { END.yaw1 = Math.PI; END.pitch1 = -0.08; }
  let d = END.yaw1 - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  END.yaw1 = yaw + d;
  if (!PROLOGUE_MODE && !CHAPTER_TWO_MODE && !CHAPTER_THREE_MODE) subtitle(LINES.end, 6.2);
  if (document.pointerLockElement) document.exitPointerLock();
}
function restart() {
  player = newPlayer(START); vs = newVillageState();
  if (PROLOGUE_MODE) {
    prologueCowFound = false; prologueRespawns = 0; prologueSafeClock = 0;
    prologueSafePoint = { x: START.x, y: START.y, z: START.z, yaw: START_YAW, pitch: -0.03, cow: 0 };
    prologueCow?.reset();
    $('objective-ar').textContent = 'اعثر على البقرة في الحظيرة'; $('objective-en').textContent = 'Find the cow in the barn';
  }
  yaw = START_YAW; pitch = -0.03; storyTime = 0; endT = -1; introDone = false; turnbackCD = 0; zoomT = 0; subTime = 0; lockT = 0;
  flying = false; V.carpet.mesh.visible = false; flyV.x = flyV.y = flyV.z = 0;   // a restart lands without a glide
  END.yaw1 = Math.atan2(-cave.x, -cave.z);
  fade.style.opacity = '0'; title.classList.remove('show'); rec.classList.remove('stopped');
  playing = false; overlay.style.display = 'flex';
  resetEnts();
  heard.clear(); talkLog.length = 0; film = newFilm(); filmHeld = false; story.flags.clear(); maryamQuestionedAt = -Infinity;
  familyPhotoShown.clear(); ch1TestimonyKeys.clear(); familyPhotoAt = -1; updateEvidenceLedger();
  medicalCheckAt = dayTwoTransitionAt = -1; story.medicalCheckComplete = STORY_DAY >= 2; NPCF.setCuffed(ACTORS);
  chapterThreeStage = 0; chapterThreeClimbing = false; chapterThreeSeized = false; chapterThreeUploadHold = 0; chapterThreeUploadAttempts = 0; chapterThreeDeadline = 300;
  chapterThreeUploaded = false; chapterThreeUploadFailed = false; chapterThreeVehicleAt = -1;
  CH3_WORLD?.resetVehicles();
  if (CH3_WORLD) { CH3_WORLD.grabbingHands.visible = false; CH3_WORLD.grabbingHands.position.y = 0; }
  chapterTwoStage = chapterTwoFilmHold = 0; chapterTwoRecorderFound = chapterTwoHallFilmed = false;
  chapterTwoHazardClock = -1; chapterTwoHazardWarned = chapterTwoComplete = false;
  CH2_WORLD?.setHazard(false, false, false);
  for (let i = 0; i < ACTORS.length; i++) {
    const a = ACTORS[i], start = ACTOR_STARTS[i];
    a.x = start.x; a.y = start.y; a.z = start.z; a.spec.stage = start.stage; a.rest = start.rest; a.indoors = start.indoors; a.spec.cuffed = start.cuffed;
    a.searchWaypoint = 1; a.searchDirection = 1; a.searchPause = start.stage === 'prologue-search' ? 1 : 0;
    a.walkPhase = 0; a.walkWeight = 0; a.maryamMoving = false;
    a.yaw = a.rest; a.headYaw = a.headPitch = 0; a.talk = 0; a.line = null;
  }
  arena?.reset();
}

// ---------- Frame ----------
let acc = 0, last = performance.now();
const frameTimes: number[] = [];
let bobPhase = 0, bobAmp = 0, landDip = 0, landVel = 0, wasGround = true, lastVy = 0, fov = FOV, trauma = 0;
let indoor = 0, gustPrev = 0, gustRising = false, creakCD = 3, dogAt = 7 + Math.random() * 6;
const tvBase = V.tvMat.color.clone();
const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** Smooth camera-shake noise in -1..1 (two incommensurate sines per channel k). */
const shake = (t: number, k: number) => (Math.sin(t * 37.0 + k * 1.7) + 0.6 * Math.sin(t * 53.3 + k * 4.1)) / 1.6;
const pad = (n: number) => (n < 10 ? '0' : '') + n;
let tcFrame = -1, clipCount = -1;
// F3 dev overlay: frame-time percentiles, CPU ms per frame, draw calls, triangles, player and look state.
const cpuTimes = new Float32Array(240);
let cpuI = 0, devOn = false;
const dev = document.createElement('pre');
dev.style.cssText = 'position:fixed;right:40px;top:30px;margin:0;color:#FFB000;font:12px Consolas,monospace;background:rgba(7,9,12,.7);padding:8px;display:none;pointer-events:none;z-index:5';
document.body.appendChild(dev);
function devOverlay() {
  const f = frameTimes.slice(-240).sort((a, b) => a - b), c = Array.from(cpuTimes).sort((a, b) => a - b);
  const p = (a: ArrayLike<number>, q: number) => a[Math.min(a.length - 1, Math.floor(q * a.length))].toFixed(1);
  dev.textContent = `frame p50 ${p(f, 0.5)}  p95 ${p(f, 0.95)} ms\ncpu   p50 ${p(c, 0.5)}  p95 ${p(c, 0.95)} ms\n`
    + `calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}\n`
    + `pos ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(2)} ${player.pos.z.toFixed(1)}  ${player.onGround ? 'ground' : player.sliding ? 'slide' : 'air'}  ${surfaceAt(player.pos.x, player.pos.z)}`
    + `  grid ${Math.floor((player.pos.x + 75) / 5)},${Math.floor((player.pos.z + 20) / 5)}\n`
    + `look ${target >= 0 ? EXAMINABLES[target].id : useTarget >= 0 ? USABLES[useTarget].id : buttonTarget >= 0 ? BELL_ROPE.id : '-'}  examined ${vs.examined.length}/${EXAMINABLES.length}  near ${NEAR.length}  t ${storyTime.toFixed(1)}
`
    + `npcs ${ACTORS.length} (${NPC_OPEN.length} open)  trauma ${trauma.toFixed(2)}  bells ${bells}
`
    + `npc ${devNpc()}
`
    + `film ${film.rec ? 'REC' : 'stby'}  battery ${(film.battery * 100).toFixed(0)}%  framed ${film.framed ?? '-'} ${film.held.toFixed(1)}s  log ${film.log.length} (${testimonies(film)} said)`
    + (arena ? '\n' + arena.dev() : '');
}

/** AI state of the NPC under the crosshair, else the nearest one (F3). */
function devNpc(): string {
  let a: Actor | null = npcTarget >= 0 ? TALKABLE_ACTORS[npcTarget] : null;
  if (!a) { let bd = Infinity; for (const o of ACTORS) { const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z); if (d < bd) { bd = d; a = o; } } }
  if (!a) return '-';
  const d = Math.hypot(a.x - player.pos.x, a.z - player.pos.z);
  return `${a.id} ${d.toFixed(1)}m  yaw ${a.yaw.toFixed(2)} (rest ${a.rest.toFixed(2)})  head ${a.headYaw.toFixed(2)} ${a.headPitch.toFixed(2)}  ${a.talk > 0 ? 'talk ' + a.line : d < 4 ? 'attend' : 'idle'}`;
}
const _chest = { x: 0, y: 0, z: 0 }, _proj = new THREE.Vector3();
let recShown = false, battShown = -1;

function frame(now: number) {
  const c0 = performance.now();
  const ms = now - last;
  last = now;
  frameTimes.push(ms);
  if (frameTimes.length > 600) frameTimes.shift();
  const dt = Math.min(ms / 1000, 0.1), t = now / 1000;
  acc += dt;
  const input = readInput();
  while (acc >= DT) { tick(input); acc -= DT; }

  // Head bob from distance walked; one footstep per half cycle, at the bottom of the bob (heel strike).
  const speed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && speed > 0.3) {
    const before = Math.floor(bobPhase / Math.PI);
    bobPhase += speed * dt / (0.75 + 0.12 * speed) * Math.PI;
    if (Math.floor(bobPhase / Math.PI) !== before) audio.play('step', surfaceAt(player.pos.x, player.pos.z), 0.65 + 0.12 * speed);
  }
  bobAmp += ((player.onGround ? Math.min(speed / 3, 1.7) * 0.024 : 0) - bobAmp) * Math.min(1, dt * 8);
  // Landing: the knees take it (landDip spring), the surface answers, and a hard one shakes the camera (trauma, felt as
  // trauma squared, so a jump is a nudge and a 3 m drop a jolt).
  if (player.onGround && !wasGround && lastVy < -3) {
    landVel = Math.min(0.9, -lastVy * 0.09);
    audio.play('step', surfaceAt(player.pos.x, player.pos.z), Math.min(1.6, 1.0 - lastVy * 0.04));
    trauma = Math.min(1, trauma + Math.max(0, (-lastVy - 3.5) / 10));
  }
  trauma = Math.max(0, trauma - dt * 1.5);
  const sh = trauma * trauma;
  wasGround = player.onGround; lastVy = player.vel.y;
  landVel -= (landDip * 140 + landVel * 14) * dt; landDip += landVel * dt;
  const bobY = bobAmp * Math.abs(Math.sin(bobPhase)), bobX = bobAmp * 0.45 * Math.sin(bobPhase);

  // Handheld camera: slow, small, a little more when moving. Lorenzo is filming.
  const hand = 1 + Math.min(speed / 3, 1.5);
  const swayP = (Math.sin(t * 0.71) * 0.6 + Math.sin(t * 1.37 + 1) * 0.4) * 0.0022 * hand;
  const swayY = (Math.sin(t * 0.53 + 2) * 0.6 + Math.sin(t * 1.11) * 0.4) * 0.0026 * hand;

  // End sequence: turn to the cave, fade into the Hall reveal, then show the continuation prompt.
  let fovTarget = FOV;
  if (endT >= 0) {
    endT += dt;
    if (CHAPTER_THREE_MODE && endT >= 4.1 && !chapterThreeSeized) {
      chapterThreeSeized = true; filmHeld = false; film.rec = false; rec.classList.add('stopped');
      CH3_WORLD!.grabbingHands.visible = true;
      document.body.classList.remove('filming'); audio.play('groan'); showToast('CAMERA SEIZED — LORENZO DETAINED');
    }
    const k = ease(endT / 3.2);
    yaw = END.yaw0 + (END.yaw1 - END.yaw0) * k;
    pitch = END.pitch0 + (END.pitch1 - END.pitch0) * k;
    fovTarget = FOV - 32 * ease((endT - 1.5) / 5.5);
    if (endT > 7.0) {
      rec.classList.add('stopped');
      if (PROLOGUE_MODE && endT >= 7.5 && !prologueHallEntered) {
        prologueHallEntered = true;
        prologueRoots?.hide();
        const entry = prologueHall?.enter();
        if (entry) {
          player.pos.x = entry.x; player.pos.y = entry.y; player.pos.z = entry.z;
          player.vel.x = player.vel.y = player.vel.z = 0; player.onGround = true;
          yaw = END.yaw0 = END.yaw1 = entry.yaw; pitch = END.pitch0 = END.pitch1 = -0.03;
        }
      }
      if (PROLOGUE_MODE) {
        fade.style.opacity = String(1 - ease((endT - 7.5) / 0.7));
        prologueHall?.tick(endT - 7.5);
      } else fade.style.opacity = '1';
    }
    if (endT > 9.1 && !title.classList.contains('show')) {
      title.classList.add('show');
      $('title-stats').textContent = PROLOGUE_MODE
        ? 'THE ROOTS TAKE JOSEPH · R TO CONTINUE AS LORENZO'
        : CHAPTER_TWO_MODE ? `CHAPTER 2 COMPLETE · FOOTAGE ${chapterTwoHallFilmed ? 'SECURED' : 'MISSED'} · R TO CONTINUE`
        : CHAPTER_THREE_MODE ? chapterThreeUploaded ? 'SIGNAL · CAMERA SEIZED · LORENZO DETAINED' : 'SIGNAL MISSED · CAMERA SEIZED · LORENZO DETAINED'
        : `${vs.examined.length}/${EXAMINABLES.length} clips · ${Math.floor(storyTime / 60)}:${pad(Math.floor(storyTime % 60))}`;
      audio.play('drone');
    }
  } else if (zoomT > 0) {
    zoomT -= dt;
    if (target === lastExamine) fovTarget = FOV - 8;
  }
  if (film.rec && endT < 0) fovTarget = Math.min(fovTarget, FOV - 14);   // the viewfinder's tighter lens
  fov += (fovTarget - fov) * Math.min(1, dt * (endT >= 0 ? 6 : 3));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  const ride = flying ? 0.035 * Math.sin(t * 1.3) : 0, eyeY = flying ? CARPET_EYE + ride : eyeHeight(player);
  camera.rotation.set(pitch + swayP + sh * 0.05 * shake(t, 1), yaw + swayY + sh * 0.03 * shake(t, 2), -bobX * 0.15 + sh * 0.04 * shake(t, 3));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  camera.position.set(player.pos.x + cy * bobX, player.pos.y + eyeY + bobY - bobAmp * 0.5 - landDip, player.pos.z - sy * bobX);
  if (CHAPTER_THREE_MODE && endT >= 4.1) {
    const seized = ease((endT - 4.1) / 0.8);
    CH3_WORLD!.grabbingHands.visible = true;
    CH3_WORLD!.grabbingHands.position.y = -0.65 + 0.58 * seized;
    camera.position.y -= 1.05 * seized;
    camera.rotation.x += 0.68 * seized + 0.025 * Math.sin(t * 43) * (1 - seized * 0.35);
    camera.rotation.z += 0.06 * seized + 0.018 * Math.cos(t * 37) * (1 - seized * 0.35);
  }
  if (cameraLamp && cameraLampTarget) {
    const forward = camera.getWorldDirection(_cameraForward);
    cameraLamp.position.copy(camera.position).addScaledVector(forward, 0.12);
    cameraLampTarget.position.copy(camera.position).addScaledVector(forward, 20);
    cameraLamp.intensity = film.rec && endT < 0 ? 42 : 0;
  }
  V.sky.position.copy(camera.position);
  if (flying) {   // the rug under the rider: banks into strafes, noses up when climbing
    const right = flyV.x * cy - flyV.z * sy;
    V.carpet.place(player.pos.x - sy * CARPET_AHEAD, player.pos.y + ride + 0.02, player.pos.z - cy * CARPET_AHEAD, yaw, -right * 0.025, flyV.y * 0.03, t);
  }

  // Look target (logical eye and view, without bob), highlight fade.
  eyeV.x = player.pos.x; eyeV.y = player.pos.y + eyeY; eyeV.z = player.pos.z;
  const cp = Math.cos(pitch);
  dirV.x = -sy * cp; dirV.y = Math.sin(pitch); dirV.z = -cy * cp;
  if (arena) {   // fire along the logical view; the punch, the hurt roll and the fall go on top of the camera
    arena.frame(dt, eyeV, dirV, bobX, bobY);
    camera.rotation.x += arena.view.pitch; camera.rotation.z += arena.view.roll; camera.position.y -= arena.view.drop;
    trauma = Math.min(1, trauma + arena.trauma());
  }
  target = endT >= 0 ? -1 : pickExaminable(eyeV, dirV, EXAMINABLES, SOLIDS);
  npcTarget = endT >= 0 || target >= 0 ? -1 : pickExaminable(eyeV, dirV, NPC_PICKS, SIGHT_SOLIDS, TALK_RANGE);
  if (CHAPTER_THREE_MODE && chapterThreeStage === 0 && target < 0) {
    const priest = TALKABLE_ACTORS.findIndex(a => a.id === 'npc_priest' && Math.hypot(a.x - player.pos.x, a.z - player.pos.z) < 3.2);
    if (priest >= 0) npcTarget = priest; // near the altar, E stays easy without precise head aim
  }
  useTarget = endT >= 0 || target >= 0 || npcTarget >= 0 ? -1 : pickUsable(eyeV, dirV, SOLIDS);
  buttonTarget = endT >= 0 || target >= 0 || npcTarget >= 0 || useTarget >= 0 ? -1 : pickExaminable(eyeV, dirV, BUTTONS, SOLIDS);
  for (let i = 0; i < EXAMINABLES.length; i++) {
    const h = V.highlights[i];
    if (!h) continue; // Chapter-specific evidence points may not have a baked village highlight mesh.
    hl[i] += ((i === target ? 1 : 0) - hl[i]) * Math.min(1, dt * (i === target ? 10 : 6));
    h.group.visible = hl[i] > 0.01;
    if (!h.group.visible) continue;
    const seen = vs.examined.includes(EXAMINABLES[i].id) ? 0.6 : 1;
    const pulse = 0.82 + 0.18 * Math.sin(t * 4.2);
    h.glow.opacity = 0.085 * hl[i] * pulse * seen;
    if (h.hull) {
      h.hull.uniforms.uAlpha.value = 0.5 * hl[i] * pulse * seen;
      h.hull.uniforms.uThick.value = Math.min(0.03, Math.max(0.006, camera.position.distanceTo(h.center) * 0.0042));
    }
  }
  if (CHAPTER_THREE_MODE && chapterThreeStage >= 5 && !chapterThreeUploaded && !chapterThreeUploadFailed && endT < 0 && Math.hypot(player.pos.x - CH3_WORLD!.upload.x, player.pos.z - CH3_WORLD!.upload.z) < 1.8) {
    promptAr.textContent = 'اضغط E باستمرار لرفع اللقطات'; promptEn.textContent = `Hold E to upload · ${Math.floor(chapterThreeUploadHold)} / 20 s`;
    prompt.classList.add('show'); prompt.classList.remove('seen', 'locked');
  } else if (target >= 0) {
    const e = EXAMINABLES[target];
    if (promptEn.textContent !== e.name.en) { promptAr.textContent = e.name.ar; promptEn.textContent = e.name.en; }
    prompt.classList.add('show');
    prompt.classList.toggle('seen', vs.examined.includes(e.id));
    prompt.classList.remove('locked');
  } else if (npcTarget >= 0) {
    const a = TALKABLE_ACTORS[npcTarget], n = actorLabel(a);
    if (promptEn.textContent !== n.en || promptAr.textContent !== n.ar) { promptAr.textContent = n.ar; promptEn.textContent = n.en; }
    prompt.classList.add('show');
    prompt.classList.toggle('seen', talkedOut(a.spec, story, heard));
    prompt.classList.remove('locked');
  } else if (useTarget >= 0) {
    const locked = lockT > 0 && lockU === useTarget, name = locked ? LOCKED_LINE : USABLES[useTarget].name;
    if (promptEn.textContent !== name.en) { promptAr.textContent = name.ar; promptEn.textContent = name.en; }
    prompt.classList.add('show');
    prompt.classList.remove('seen');
    prompt.classList.toggle('locked', locked);
  } else if (buttonTarget >= 0) {
    const n = BELL_ROPE.name;
    if (promptEn.textContent !== n.en) { promptAr.textContent = n.ar; promptEn.textContent = n.en; }
    prompt.classList.add('show');
    prompt.classList.remove('seen', 'locked');
  } else prompt.classList.remove('show');
  for (let u = 0; u < USABLES.length; u++) { const o = leafObj[u]; if (o) o.rotation.y = USABLES[u].yaw0 + USABLES[u].swing * easeIO(ENTS.doors[u].open); }
  // Props follow their entities and scrape while they slide; the bell rope dips with its press.
  for (let i = 0; i < ENTS.props.length; i++) {
    const p = ENTS.props[i], m = V.props[i].mesh, sp = Math.hypot(p.vel.x, p.vel.z);
    m.position.set(p.pos.x, p.pos.y, p.pos.z);
    scrapeT[i] -= dt;
    if (sp > 0.25 && scrapeT[i] <= 0) { audio.play('scrape', p.id === 'pail' ? 1 : 0, Math.min(1.3, 0.4 + sp / 2)); scrapeT[i] = 0.09 + 0.12 / sp; }
  }
  V.bellRope.position.y = BELL_ROPE.pos.y - 0.35 * Math.sin(Math.PI * ENTS.buttons[0].t);

  // Far landmarks: inside the barn corner the ridges stand exactly where the slice put them; walking out into the
  // village they shift with the camera, so the valley sides act ~450 m away and the mountain ~2.8 km (village.md).
  {
    const ox = camera.position.x - Math.min(28, Math.max(-28, camera.position.x));
    const oz = camera.position.z - Math.min(27, Math.max(-42, camera.position.z));
    const oy = groundY(player.pos.x, player.pos.z);
    V.nearRing.position.set(ox * 0.49, oy * 0.49, oz * 0.49);
    V.farRing.position.set(ox * 0.83, oy * 0.83, oz * 0.83);
  }
  V.waterTime.value = t;
  {
    const d = Math.abs(player.pos.x - streamX(player.pos.z)) - streamHalf(player.pos.z);
    const s = Math.max(0, 1 - Math.max(0, d) / 38);
    audio.stream(endT > 7 ? 0 : s * s);
  }

  // Wind, gusts, the swaying east door leaf and its creak, the distant dog.
  const gust = Math.min(1, Math.max(0, 0.5 + 0.3 * Math.sin(t * 0.69) + 0.2 * Math.sin(t * 0.27 + 1.3) + 0.06 * Math.sin(t * 2.3)));
  const inBarn = player.pos.x > BARN.x0 && player.pos.x < BARN.x1 && player.pos.z > BARN.z0 && player.pos.z < BARN.z1;
  audio.barn(inBarn, PROLOGUE_MODE && prologueAttackT < 0 && endT < 0);
  const inside = inBarn || HOLLOW.some(b => player.pos.x > b.x0 && player.pos.x < b.x1 && player.pos.z > b.z0 && player.pos.z < b.z1 && player.pos.y < b.floor + 3);
  indoor += ((inside ? 1 : 0) - indoor) * Math.min(1, dt * 2);
  audio.wind(gust, indoor, endT > 7 ? Math.max(0, 1 - (endT - 7) / 3) : 1);
  V.eastLeaf.rotation.y = -(gust - 0.5) * 0.035;
  const rising = gust > gustPrev;
  creakCD -= dt;
  if (gustRising && !rising && gust > 0.62 && creakCD < 0) {
    const d = Math.hypot(player.pos.x - 2, player.pos.z - (BARN.z0 - 1));
    if (d < 24) audio.play('creak', undefined, (1 - d / 24) * (0.5 + 0.5 * gust));
    creakCD = 3.5;
  }
  gustRising = rising; gustPrev = gust;
  if (storyTime > dogAt && endT < 0) {
    const rel = Math.atan2(60 - player.pos.x, -(90 - player.pos.z)) - yaw;
    audio.play('dog', -Math.sin(rel));
    dogAt = storyTime + 11 + Math.random() * 14;
  }

  // Practicals: the TV's flicker, the candle, the ridge mast blinking every 1.5 s.
  const flick = 0.55 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 3.7) + 0.2 * Math.sin(t * 23.0) * (Math.sin(t * 0.9) > 0.7 ? 1 : 0.2);
  V.tvMat.color.setRGB(tvBase.r * flick, tvBase.g * flick, tvBase.b * (flick * 0.9 + 0.1));
  V.flame.scale.set(1, 1 + 0.18 * Math.sin(t * 13.0) * Math.sin(t * 7.3), 1);
  V.flameMat.opacity = 0.85 + 0.15 * Math.sin(t * 17.0);
  V.mastMat.visible = (t % 1.5) < 0.22;

  V.dustTime.value = t;

  // NPCs: attention and idle (src/npcTalk.ts), then posed on the GPU (src/npcFigures.ts).
  for (const a of ACTORS) {
    tickActor(a, dt, player.pos.x, player.pos.y, player.pos.z, storyTime);
    if (a.spec.stage === 'maryam-square') story.flags.add('maryam_reached_square');
  }
  syncMovingActorBoxes();
  syncNpcPicks();
  NPCF.update(ACTORS, t);
  // Camera: while RMB is held (and charged) Lorenzo records; an NPC held in frame for a second is logged, and again for
  // each line it is filmed saying (a testimony).
  {
    const live = filmHeld && playing && endT < 0;
    const fi = live && film.battery > 0 ? pickFramed(eyeV, dirV, ACTORS, SIGHT_SOLIDS) : -1, fa = fi >= 0 ? ACTORS[fi] : null;
    const was = film.rec;
    const got = filmTick(film, dt, live, fa ? fa.id : null, fa ? fa.line : null, storyTime);
    if (film.rec !== was) audio.play('rec', film.rec ? 1 : 0);
    if (live && !film.rec) { showToast('BATTERY EMPTY'); filmHeld = false; }   // held with no charge left
    if (CHAPTER_TWO_MODE && CH2_WORLD && chapterTwoStage === 5 && film.rec) {
      _toHall.copy(CH2_WORLD.hallTarget).sub(camera.position);
      const distance = _toHall.length();
      const framedHall = distance < 28 && camera.getWorldDirection(_cameraForward).dot(_toHall.divideScalar(distance)) > 0.965;
      chapterTwoFilmHold = framedHall ? chapterTwoFilmHold + dt : 0;
      if (chapterTwoFilmHold >= 1.0) {
        chapterTwoHallFilmed = true; setChapterTwoStage(6); CH2_WORLD.setHazard(false, false, true);
        showToast('JOSEPH AND THE ANIMALS FILMED'); audio.play('chime');
      }
    } else if (CHAPTER_TWO_MODE && chapterTwoStage === 5 && !film.rec) chapterTwoFilmHold = 0;
    if (got) {
      if (!PROLOGUE_MODE && STORY_DAY === 1 && got.line) {
        ch1TestimonyKeys.add(`${got.npc}:${got.line}`);
        updateEvidenceLedger();
      }
      audio.play('chime');
      const filmedActor = ACTORS.find(a => a.id === got.npc);
      const n = filmedActor ? actorLabel(filmedActor) : CAST[got.npc].label;
      showToast(`${got.line ? 'TESTIMONY' : 'FILMED'} — ${n.en.toUpperCase()}`);
    }
    if (film.rec && fa) {
      actorChest(fa, _chest);
      const top = fa.y + (fa.seated ? 1.35 : 1.85), bottom = fa.y;
      _proj.set(_chest.x, top, _chest.z).project(camera); const y0 = (1 - _proj.y) / 2 * innerHeight;
      _proj.set(_chest.x, bottom, _chest.z).project(camera); const y1 = (1 - _proj.y) / 2 * innerHeight, x = (_proj.x + 1) / 2 * innerWidth;
      const h = Math.max(24, y1 - y0) * 1.08, w = h * 0.55;
      focus.style.transform = `translate(${(x - w / 2).toFixed(0)}px, ${(y0 - h * 0.04).toFixed(0)}px)`;
      focus.style.width = `${w.toFixed(0)}px`; focus.style.height = `${h.toFixed(0)}px`;
      focus.classList.add('show');
      focus.classList.toggle('locked', film.held >= FRAME_HOLD);
    } else focus.classList.remove('show');
  }

  renderer.render(scene, camera);
  cpuTimes[cpuI++ % cpuTimes.length] = performance.now() - c0;
  if (devOn && (cpuI & 15) === 0) devOverlay();

  // HUD: subtitles, REC timecode (25 fps), clip counter.
  subTime -= dt; lockT -= dt;
  sub.style.opacity = subTime > 0 ? '1' : '0';
  toastTime -= dt; toast.style.opacity = toastTime > 0 ? '1' : '0';
  if (endT < 7) {
    const total = TC_START + storyTime, s = Math.floor(total), f = Math.floor((total - s) * 25);
    if (s * 25 + f !== tcFrame) {
      tcFrame = s * 25 + f;
      tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
    }
    rec.classList.toggle('blink', (t % 1) > 0.5);
  }
  if (film.rec !== recShown) { recShown = film.rec; rec.classList.toggle('live', film.rec); recLabel.textContent = film.rec ? 'REC' : 'STBY'; document.body.classList.toggle('filming', film.rec); }
  const bp = Math.ceil(film.battery * 100);
  if (bp !== battShown) { battShown = bp; battFill.style.width = `${bp}%`; batt.title = `${bp}%`; batt.classList.toggle('low', bp <= 15); }
  if (vs.examined.length !== clipCount) { clipCount = vs.examined.length; clips.textContent = `${clipCount}/${EXAMINABLES.length}`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Test hook (Playwright, screenshots, measurements) ----------
declare global { interface Window { __game: unknown } }
window.__game = {
  state: () => ({
    level: 'village', chapter: CHAPTER_THREE_MODE ? 3 : CHAPTER_TWO_MODE ? 2 : 1,
    chapterTwo: { stage: chapterTwoStage, recorder: chapterTwoRecorderFound, hallFilmed: chapterTwoHallFilmed, complete: chapterTwoComplete,
      routeGround: [V.terrainHeight(258, 40), V.terrainHeight(278, 40), V.terrainHeight(300, 40), V.terrainHeight(339, 42), V.terrainHeight(376, 42)] },
    chapterThree: { stage: chapterThreeStage, climbing: chapterThreeClimbing, deadline: chapterThreeDeadline, uploadHold: chapterThreeUploadHold,
      uploadAttempts: chapterThreeUploadAttempts, uploaded: chapterThreeUploaded, failed: chapterThreeUploadFailed, seized: chapterThreeSeized,
      priestDistance: (() => { const p = TALKABLE_ACTORS.find(a => a.id === 'npc_priest'); return p ? Math.hypot(p.x - player.pos.x, p.z - player.pos.z) : null; })(),
      priestTalkable: TALKABLE_ACTORS.some(a => a.id === 'npc_priest') },
    regions: { east: EAST_VALLEY.stats, southFarmland: SOUTH_FARMLAND?.stats ?? null },
    examined: [...vs.examined], finished: vs.finished, target: target >= 0 ? EXAMINABLES[target].id : null,
    chapterOneEvidence: { photoRoles: [...familyPhotoShown], photoCount: familyPhotoShown.size, testimonyKeys: [...ch1TestimonyKeys], testimonyCount: ch1TestimonyKeys.size,
      ledgerVisible: evidenceLedger.style.display !== 'none', photoCardVisible: $('family-photo-card').style.display !== 'none' },
    prologue: PROLOGUE_MODE ? { cowFound: prologueCowFound, cowProgress: prologueCow?.progress() ?? 0,
      cowPosition: prologueCow?.position() ?? null, cowCheckpoint: prologueCow?.checkpoint() ?? 0, respawns: prologueRespawns, safePoint: { ...prologueSafePoint } } : null,
    story: { day: story.day, events: [...story.events], flags: [...story.flags], medicalCheckComplete: story.medicalCheckComplete },
    endingTitleVisible: title.classList.contains('show'), endingText: $('title-stats').textContent,
    pos: { ...player.pos }, vel: { ...player.vel }, onGround: player.onGround, crouched: player.crouched, yaw, pitch, storyTime,
    endT, surface: surfaceAt(player.pos.x, player.pos.z), use: useTarget >= 0 ? USABLES[useTarget].id : null, mast: V.mastMat.visible, trauma,
    npc: npcTarget >= 0 ? TALKABLE_ACTORS[npcTarget].id : null, talked: talkLog.map(e => ({ ...e })),
    film: { rec: film.rec, battery: film.battery, framed: film.framed, held: film.held, log: film.log.map(e => ({ ...e })) },
    // Shape shared with Night Shift so generic e2e helpers keep working: no combat here.
    health: 100, weapon: 'none', hasNailer: false, mag: 0, reserve: 0, kills: 0, enemies: [],
    facility: { breakers: [], doorOpen: false, fired: [], finished: vs.finished },
    ...(arena ? arena.state() : {}),   // ?arena=1: health, the caster, the walkers as enemies, and arena details
  }),
  frameTimes: () => [...frameTimes],
  cpuTimes: () => Array.from(cpuTimes),
  info: () => {
    const mats = new Set<THREE.Material>();
    scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) mats.add(m as THREE.Material); });
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length ?? 0,
      materials: mats.size, buckets: V.stats, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  },
  examinables: () => EXAMINABLES.map(e => ({ id: e.id, pos: e.pos, from: e.from })),
  usables: () => USABLES.map((u, i) => ({ id: u.id, kind: u.kind, locked: u.locked, pos: u.pos, from: u.from, open: ENTS.doors[i].open, solid: ENTS.doors[i].solid })),
  ents: () => ({ bells, props: ENTS.props.map(p => ({ id: p.id, pos: { ...p.pos }, vel: { ...p.vel } })), buttons: ENTS.buttons.map(b => ({ id: b.id, t: b.t, cool: b.cool })) }),
  buttonTarget: () => (buttonTarget >= 0 ? BELL_ROPE.id : null),
  npcs: () => ACTORS.map(a => ({ id: a.id, x: a.x, y: a.y, z: a.z, rest: a.rest, yaw: a.yaw, headYaw: a.headYaw, headPitch: a.headPitch, seated: a.seated, talk: a.talk, line: a.line, label: actorLabel(a) })),
  /** The furnished rooms: build stats, and on request the texture atlas as a PNG data URL (stills, debugging). */
  furniture: (atlas = false) => ({ ...FURN.stats, rooms: FURN.rooms.map(m => m.geometry.getAttribute('position').count),
    atlas: atlas ? ((FURN.rooms[0].material as THREE.MeshStandardMaterial).map?.image as HTMLCanvasElement | undefined)?.toDataURL?.() ?? null : null }),
  /** Sets a story flag (e.g. 'posters') so flag-gated lines can be checked. */
  flag: (name: string) => { story.flags.add(name); },
  useTarget: () => (useTarget >= 0 ? USABLES[useTarget].id : null),
  pictures: () => V.pictures,
  carpet: () => { const c = V.carpet.mesh; return { flying, visible: c.visible, x: c.position.x, y: c.position.y, z: c.position.z, yaw: c.rotation.y }; },
  /** World point to CSS pixels (x right, y down) and NDC depth, through the last rendered camera. */
  project: (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z };
  },
  ground: (x: number, z: number) => V.terrainHeight(x, z),
  audioPeaks: () => measureVillagePeaks(),
  press: (code: string) => keys.add(code),
  release: (code: string) => keys.delete(code),
  look: (y: number, p: number) => { yaw = y; pitch = p; },
  key: (code: string) => dispatchEvent(new KeyboardEvent('keydown', { code })),
  /** Advances the fixed gameplay simulation without render-frame throttling for state inspection. */
  advance: (seconds: number) => { const n = Math.max(0, Math.ceil(seconds / DT)), input = readInput(); for (let i = 0; i < n; i++) tick(input); },
  /** Places the end sequence at a point in its timeline for deterministic camera-seizure state inspection. */
  seekEnd: (seconds: number) => { endT = Math.max(0, seconds); },
  teleport: (x: number, y: number, z: number) => { player.pos = { x, y, z }; player.vel = { x: 0, y: 0, z: 0 }; },
  start: () => { overlay.style.display = 'none'; playing = true; },
};
if (arena) Object.assign(window.__game as object, { god: () => arena.god() });   // measurements: walkers on, Lorenzo never down
