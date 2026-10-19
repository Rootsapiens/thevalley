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
import palette from '../studio/art/palette.json';

const DT = 1 / 120;
const FOV = 70;
const TC_START = (16 * 60 + 41) * 60 + 12;   // camcorder clock: 16:41:12, nine minutes before sunset (world-bible)

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
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 2000);
camera.rotation.order = 'YXZ';
scene.add(camera);
const tBuild0 = performance.now();
const V = buildVillage(scene, renderer);
V.stats['ms:build'] = Math.round(performance.now() - tBuild0);
const SOLIDS = villageSolids();
const WORLD = SOLIDS.map(s => s.box);
const audio = villageAudio();

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
/** Static boxes within ~2.5 m of (x, z) plus the gate and door leaves that are solid right now and the loose props. No allocation. */
function nearWorld(x: number, z: number): Box[] {
  NEAR.length = 0; bpStamp++;
  for (let i = Math.floor((x - 2.5) / BP); i <= Math.floor((x + 2.5) / BP); i++) for (let j = Math.floor((z - 2.5) / BP); j <= Math.floor((z + 2.5) / BP); j++) {
    const a = bpGrid.get(bpKey(i, j)); if (!a) continue;
    for (const n of a) if (bpSeen[n] !== bpStamp) { bpSeen[n] = bpStamp; NEAR.push(WORLD[n]); }
  }
  for (const d of ENTS.doors) if (d.solid) NEAR.push(d.box);
  for (const p of ENTS.props) NEAR.push(p.box);
  return NEAR;
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
// F3 also marks where the Day 1 NPCs will stand (build step 2 prep, src/npcPlacement.ts): teal = placeable as specified,
// amber = an open item (no interior yet, floor undecided, inside a solid). One instanced draw, only while F3 is on.
const NPC_SPOTS = placeNpcs(1);
const npcMarks = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 1.3, 3, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), NPC_SPOTS.length);
{
  const m = new THREE.Matrix4(), ok = new THREE.Color(palette.ruptureTeal), open = new THREE.Color(palette.hudAmber);
  NPC_SPOTS.forEach((p, i) => { npcMarks.setMatrixAt(i, m.makeTranslation(p.x, p.y + 0.87, p.z)); npcMarks.setColorAt(i, p.issues.length ? open : ok); });
  npcMarks.visible = false; npcMarks.frustumCulled = false;
  scene.add(npcMarks);
}
const depthReady = compileShadowDepth();
// Stone and wood texture sets first (4 s at most), so their programs compile here with the maps bound, not in frame 1.
const tTex0 = performance.now();
await Promise.race([V.texturesReady, new Promise(r => setTimeout(r, 4000))]);
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
const promptAr = $('prompt-ar'), promptEn = $('prompt-en'), rec = $('rec'), tc = $('tc'), clips = $('clips');
const fade = $('fade'), title = $('title'), toast = $('toast');
$('title-stats').textContent = '';
let subTime = 0;
function subtitle(t: Text, seconds?: number) {
  subAr.textContent = t.ar; subEn.textContent = t.en;
  subTime = seconds ?? Math.max(4, 2.2 + t.en.length * 0.055);
}

// ---------- State ----------
let player: PlayerState = newPlayer(SPAWN);
let vs: VillageState = newVillageState();
let yaw = SPAWN_YAW, pitch = -0.03, storyTime = 0, endT = -1, introDone = false, turnbackCD = 0;
let target = -1, lastExamine = -1, zoomT = 0, useTarget = -1, buttonTarget = -1, lockT = 0, lockU = -1;
const hl = new Float32Array(EXAMINABLES.length);
const zoneOut: ('end' | 'turnback')[] = [];
const pb: Box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const eyeV = { x: 0, y: 0, z: 0 }, dirV = { x: 0, y: 0, z: 0 };

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
  if (e.code === 'KeyE') examine();
  if (e.code === 'KeyR' && endT > 9) restart();
  if (e.code === 'F3') { e.preventDefault(); devOn = !devOn; dev.style.display = devOn ? 'block' : 'none'; npcMarks.visible = devOn; }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let playing = false, dragLook = false;
function startPlay() {
  overlay.style.display = 'none';
  playing = true;
  audio.start();
  try {
    const p = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => { dragLook = true; showToast('MOUSE LOCK BLOCKED — DRAG TO LOOK'); });
  } catch { dragLook = true; }
}
overlay.addEventListener('click', startPlay);
renderer.domElement.addEventListener('click', () => { if (!document.pointerLockElement && !dragLook) startPlay(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) { dragLook = false; return; }
  if (!dragLook && endT < 0) { playing = false; overlay.style.display = 'flex'; }
});
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
let toastTime = 0;
function showToast(msg: string) { toast.textContent = msg; toastTime = 2.5; }

function readInput(): Input {
  const k = (c: string) => keys.has(c) ? 1 : 0;
  const free = endT < 0;
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
    if (useTarget >= 0) use(useTarget);
    else if (buttonTarget >= 0 && pressButton(ENTS, ENTS.buttons[buttonTarget])) drainEvents();
    return;
  }
  const e = EXAMINABLES[target];
  if (markExamined(vs, e.id)) { audio.play('chime'); clips.classList.remove('pulse'); void clips.offsetWidth; clips.classList.add('pulse'); }
  subtitle(e.line);
  lastExamine = target; zoomT = subTime;
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
  if (!introDone && storyTime > 1.4) { introDone = true; if (subTime <= 0) subtitle(LINES.intro, 6.5); }   // never cut off a line
  turnbackCD -= DT;
  // Entities first: props the player walks into move ahead of him (and set his pace), leaves swing and turn solid again
  // once he is clear, buttons recover.
  pushFrom(input.forward, input.strafe, input.yaw, input.walk, player.crouched, player.onGround && !flying, player.vel, push);
  input.speedScale = pushScale(ENTS, pb, push);   // same contact as the push itself, so decided before the props move
  tickEnts(ENTS, DT, pb, push, nearWorld, groundY);
  if (ENTS.events.length) drainEvents();
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
  } else step(player, input, nearWorld(player.pos.x, player.pos.z), DT, groundY);
  const r = TUNING.radius, h = height(player);
  pb.min.x = player.pos.x - r; pb.min.y = player.pos.y; pb.min.z = player.pos.z - r;
  pb.max.x = player.pos.x + r; pb.max.y = player.pos.y + h; pb.max.z = player.pos.z + r;
  for (const ev of zoneEvents(vs, pb, zoneOut)) {
    if (ev === 'end' && endT < 0) startEnd();
    if (ev === 'turnback' && turnbackCD <= 0 && endT < 0) { subtitle(LINES.turnback, 3.5); turnbackCD = 6; }
  }
}

const cave = bearingDir(MOUNTAIN.caveBearing);
const END = { yaw0: 0, pitch0: 0, yaw1: Math.atan2(-cave.x, -cave.z), pitch1: 0.05 };
function startEnd() {
  endT = 0;
  END.yaw0 = yaw; END.pitch0 = pitch;
  let d = END.yaw1 - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  END.yaw1 = yaw + d;
  subtitle(LINES.end, 6.2);
  if (document.pointerLockElement) document.exitPointerLock();
}
function restart() {
  player = newPlayer(SPAWN); vs = newVillageState();
  yaw = SPAWN_YAW; pitch = -0.03; storyTime = 0; endT = -1; introDone = false; turnbackCD = 0; zoomT = 0; subTime = 0; lockT = 0;
  flying = false; V.carpet.mesh.visible = false; flyV.x = flyV.y = flyV.z = 0;   // a restart lands without a glide
  END.yaw1 = Math.atan2(-cave.x, -cave.z);
  fade.style.opacity = '0'; title.classList.remove('show'); rec.classList.remove('stopped');
  playing = false; overlay.style.display = 'flex';
  resetEnts();
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
    + `npcs ${NPC_SPOTS.length} (${NPC_SPOTS.filter(p => p.issues.length).length} open)  trauma ${trauma.toFixed(2)}  bells ${bells}`;
}

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

  // End sequence: turn to the cave mouth, slow zoom, fade, title.
  let fovTarget = FOV;
  if (endT >= 0) {
    endT += dt;
    const k = ease(endT / 3.2);
    yaw = END.yaw0 + (END.yaw1 - END.yaw0) * k;
    pitch = END.pitch0 + (END.pitch1 - END.pitch0) * k;
    fovTarget = FOV - 32 * ease((endT - 1.5) / 5.5);
    if (endT > 7.0) { fade.style.opacity = '1'; rec.classList.add('stopped'); }
    if (endT > 8.8 && !title.classList.contains('show')) {
      title.classList.add('show');
      $('title-stats').textContent = `${vs.examined.length}/${EXAMINABLES.length} clips · ${Math.floor(storyTime / 60)}:${pad(Math.floor(storyTime % 60))}`;
      audio.play('drone');
    }
  } else if (zoomT > 0) {
    zoomT -= dt;
    if (target === lastExamine) fovTarget = FOV - 8;
  }
  fov += (fovTarget - fov) * Math.min(1, dt * (endT >= 0 ? 6 : 3));
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  const ride = flying ? 0.035 * Math.sin(t * 1.3) : 0, eyeY = flying ? CARPET_EYE + ride : eyeHeight(player);
  camera.rotation.set(pitch + swayP + sh * 0.05 * shake(t, 1), yaw + swayY + sh * 0.03 * shake(t, 2), -bobX * 0.15 + sh * 0.04 * shake(t, 3));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  camera.position.set(player.pos.x + cy * bobX, player.pos.y + eyeY + bobY - bobAmp * 0.5 - landDip, player.pos.z - sy * bobX);
  V.sky.position.copy(camera.position);
  if (flying) {   // the rug under the rider: banks into strafes, noses up when climbing
    const right = flyV.x * cy - flyV.z * sy;
    V.carpet.place(player.pos.x - sy * CARPET_AHEAD, player.pos.y + ride + 0.02, player.pos.z - cy * CARPET_AHEAD, yaw, -right * 0.025, flyV.y * 0.03, t);
  }

  // Look target (logical eye and view, without bob), highlight fade.
  eyeV.x = player.pos.x; eyeV.y = player.pos.y + eyeY; eyeV.z = player.pos.z;
  const cp = Math.cos(pitch);
  dirV.x = -sy * cp; dirV.y = Math.sin(pitch); dirV.z = -cy * cp;
  target = endT >= 0 ? -1 : pickExaminable(eyeV, dirV, EXAMINABLES, SOLIDS);
  useTarget = endT >= 0 || target >= 0 ? -1 : pickUsable(eyeV, dirV, SOLIDS);
  buttonTarget = endT >= 0 || target >= 0 || useTarget >= 0 ? -1 : pickExaminable(eyeV, dirV, BUTTONS, SOLIDS);
  for (let i = 0; i < EXAMINABLES.length; i++) {
    const h = V.highlights[i];
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
  if (target >= 0) {
    const e = EXAMINABLES[target];
    if (promptEn.textContent !== e.name.en) { promptAr.textContent = e.name.ar; promptEn.textContent = e.name.en; }
    prompt.classList.add('show');
    prompt.classList.toggle('seen', vs.examined.includes(e.id));
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
  if (vs.examined.length !== clipCount) { clipCount = vs.examined.length; clips.textContent = `${clipCount}/${EXAMINABLES.length}`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Test hook (Playwright, screenshots, measurements) ----------
declare global { interface Window { __game: unknown } }
window.__game = {
  state: () => ({
    level: 'village', examined: [...vs.examined], finished: vs.finished, target: target >= 0 ? EXAMINABLES[target].id : null,
    pos: { ...player.pos }, vel: { ...player.vel }, onGround: player.onGround, crouched: player.crouched, yaw, pitch, storyTime,
    endT, surface: surfaceAt(player.pos.x, player.pos.z), use: useTarget >= 0 ? USABLES[useTarget].id : null, mast: V.mastMat.visible, trauma,
    // Shape shared with Night Shift so generic e2e helpers keep working: no combat here.
    health: 100, weapon: 'none', hasNailer: false, mag: 0, reserve: 0, kills: 0, enemies: [],
    facility: { breakers: [], doorOpen: false, fired: [], finished: vs.finished },
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
  useTarget: () => (useTarget >= 0 ? USABLES[useTarget].id : null),
  pictures: () => V.pictures,
  carpet: () => { const c = V.carpet.mesh; return { flying, visible: c.visible, x: c.position.x, y: c.position.y, z: c.position.z, yaw: c.rotation.y }; },
  /** World point to CSS pixels (x right, y down) and NDC depth, through the last rendered camera. */
  project: (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z };
  },
  ground: (x: number, z: number) => groundY(x, z),
  audioPeaks: () => measureVillagePeaks(),
  press: (code: string) => keys.add(code),
  release: (code: string) => keys.delete(code),
  look: (y: number, p: number) => { yaw = y; pitch = p; },
  key: (code: string) => dispatchEvent(new KeyboardEvent('keydown', { code })),
  teleport: (x: number, y: number, z: number) => { player.pos = { x, y, z }; player.vel = { x: 0, y: 0, z: 0 }; },
  start: () => { overlay.style.display = 'none'; playing = true; },
};
