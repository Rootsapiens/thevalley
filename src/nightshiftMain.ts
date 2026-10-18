// Chapter "Night Shift" (selected with ?level=nightshift). The default start is the village slice (src/villageMain.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { newPlayer, step, eyeHeight, height, TUNING, type Input, type PlayerState, type Box } from './physics';
import { nightShift, LINES, hex, type Surface } from './nightshift';
import { surfaceMaterial, tokenMaterial, glowMaterial, worldUVs, setAnisotropy, color } from './materials';
import {
  newArsenal, newDrifter, newShard, tickArsenal, fire, startReload, switchWeapon, updateDrifter, updateShard,
  updateBolt, giveNailer, radiusOf, SHARD, WEAPONS, type Drifter, type Ray, type Bolt,
} from './combat';
import { newFacility, use, checkTriggers, type Facility } from './facility';
import { serialize, parse } from './save';
import { sfx } from './audio';

const DT = 1 / 120;
const RUPTURE_AT = 7;        // seconds after start
const FALL_SAFE = 12;        // m/s landing speed before fall damage

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;   // static level: re-render the moon shadow only when the door/catwalk move
renderer.shadowMap.needsUpdate = true;
setAnisotropy(renderer.capabilities.getMaxAnisotropy());
document.getElementById('app')!.appendChild(renderer.domElement);

// Style guide: skyNight at zenith → fogHaze at the horizon, cold low moon key from upper-left at ~55°.
const scene = new THREE.Scene();
scene.background = color('skyNight');
scene.fog = new THREE.Fog(hex('fogHaze'), 14, 55);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);
const moonTint = color('fogHaze').lerp(new THREE.Color(1, 1, 1), 0.7);
scene.add(new THREE.HemisphereLight(moonTint, hex('hazardBlack'), 1.0));   // cool fill keeps shapes readable outside lamp pools
const moon = new THREE.DirectionalLight(moonTint, 0.9);
{
  const el = 55 * Math.PI / 180, az = 25 * Math.PI / 180;   // from the left (-x), slightly behind the start view
  moon.target.position.set(0, 0, -45);
  moon.position.set(-Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(90).add(moon.target.position);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 190 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);
}
const sky = (() => {
  const g = new THREE.SphereGeometry(150, 16, 8), p = g.getAttribute('position');
  const zen = color('skyNight'), hor = color('fogHaze'), c = new THREE.Color(), cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.copy(hor).lerp(zen, Math.pow(Math.max(0, p.getY(i) / 150), 0.6)).toArray(cols, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = 1;   // after the level so walls early-z reject it indoors
  scene.add(m);
  return m;
})();

// ---------- Level ----------
// Static solids are merged into one mesh per surface (one draw call each); moving ones stay separate.
const level = nightShift();
const solidMeshes: THREE.Mesh[] = [];
const byId = new Map<string, { mesh: THREE.Mesh; index: number }>();
const staticGeos = new Map<Surface, THREE.BufferGeometry[]>();
level.solids.forEach((s, i) => {
  const sx = s.box.max.x - s.box.min.x, sy = s.box.max.y - s.box.min.y, sz = s.box.max.z - s.box.min.z;
  const c = new THREE.Vector3((s.box.min.x + s.box.max.x) / 2, (s.box.min.y + s.box.max.y) / 2, (s.box.min.z + s.box.max.z) / 2);
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (!s.id) {
    g.translate(c.x, c.y, c.z);
    if (!staticGeos.has(s.surface)) staticGeos.set(s.surface, []);
    staticGeos.get(s.surface)!.push(worldUVs(g));
    return;
  }
  const mesh = new THREE.Mesh(worldUVs(g, c), surfaceMaterial(s.surface));
  mesh.position.copy(c);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  solidMeshes.push(mesh);
  byId.set(s.id, { mesh, index: i });
});
for (const [surface, geos] of staticGeos) {
  const mesh = new THREE.Mesh(mergeGeometries(geos), surfaceMaterial(surface));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  solidMeshes.push(mesh);
  for (const g of geos) g.dispose();
}
const lights = level.lights.map(l => {
  const p = new THREE.PointLight(l.color, l.tag === 'rupture' ? 0 : l.intensity, l.dist);
  p.position.set(l.pos.x, l.pos.y, l.pos.z);
  scene.add(p);
  return { light: p, def: l };
});

// Breakers: hazard-striped panel + unlit lamp, alarm red → sodium when on (palette has no green).
const lampOff = glowMaterial('emergencyRed'), lampOn = glowMaterial('sodium', 0.2);
const breakerMat = tokenMaterial('hazardYellow', 0.6, 0.1, 'hazardYellow', 0.2);   // self-lit so it reads in any light
const breakerLamps = level.usables.map(u => {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.45), breakerMat);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.12), lampOff);
  const side = u.pos.x > 0 ? -1 : 1;
  panel.receiveShadow = true;
  panel.position.set(u.pos.x, u.pos.y, u.pos.z);
  lamp.position.set(u.pos.x + side * 0.02, u.pos.y + 0.2, u.pos.z);
  scene.add(panel, lamp);
  return lamp;
});

// ---------- State ----------
let player: PlayerState = newPlayer(level.spawn);
let health = 100;
let arsenal = newArsenal(false);
let facility: Facility = newFacility(level.usables.length);
let enemies: Drifter[] = [];
let taken: string[] = [];
let storyTime = 0;
let kills = 0;
let yaw = level.spawnYaw, pitch = 0;
let eye = eyeHeight(player);
let hurtFlash = 0, shake = 0, doorLift = 0, collapseFall = 0;
const bolts: { b: Bolt; m: THREE.Mesh }[] = [];

function spawnEnemies(wake?: string) {
  level.enemies.forEach((e, i) => {
    if (e.wake !== wake || enemies.some(x => x.id === i)) return;
    enemies.push(e.kind === 'shard' ? newShard(i, e.pos) : newDrifter(i, e.pos));
  });
  syncEnemyMeshes();
}

let world: Box[] = [];
function rebuildWorld() {
  world = level.solids.filter(s =>
    !(s.id === 'floodgate' && facility.doorOpen) && !(s.id === 'catwalk-mid' && facility.fired.includes('t-catwalk')),
  ).map(s => s.box);
}

// ---------- Enemy visuals ----------
const drifterGeo = new THREE.IcosahedronGeometry(0.45, 0);
const shardGeo = new THREE.OctahedronGeometry(SHARD.radius, 0);
// Rupture creatures are teal (self-lit so they read against any lamp); every attack tell is alarm red / a teal flare.
const EM = {
  drifterIdle: tokenMaterial('ruptureTeal', 0.4, 0, 'ruptureTeal', 0.25, true),
  drifterHunt: tokenMaterial('ruptureTeal', 0.4, 0, 'ruptureTeal', 0.7, true),
  drifterTell: tokenMaterial('ruptureTeal', 0.4, 0, 'emergencyRed', 2.0, true),
  shardIdle: tokenMaterial('ruptureTeal', 0.3, 0.1, 'ruptureTeal', 0.45, true),
  shardCharge: tokenMaterial('ruptureTeal', 0.3, 0.1, 'ruptureTeal', 3.0, true),
};
const enemyMeshes = new Map<number, THREE.Mesh>();
function syncEnemyMeshes() {
  for (const m of enemyMeshes.values()) scene.remove(m);
  enemyMeshes.clear();
  for (const e of enemies) {
    const shard = e.kind === 'shard';
    const m = new THREE.Mesh(shard ? shardGeo : drifterGeo, shard ? EM.shardIdle : EM.drifterIdle);
    if (shard) m.scale.set(0.8, 1.8, 0.8);
    scene.add(m);
    enemyMeshes.set(e.id, m);
  }
}
const boltGeo = new THREE.SphereGeometry(SHARD.boltRadius, 6, 4);
const boltMat = glowMaterial('ruptureTeal', 0.45);

// ---------- Pickups ----------
const pickupGeo = { box: new THREE.BoxGeometry(0.4, 0.25, 0.3), nailer: new THREE.BoxGeometry(0.15, 0.2, 0.55) };
const pickupMat = {
  ammo: tokenMaterial('hazardYellow', 0.6, 0.1, 'hazardYellow', 0.25),
  health: tokenMaterial('concrete', 0.7, 0, 'concrete', 0.45),
  nailer: tokenMaterial('sodium', 0.55, 0.1, 'sodium', 0.25),
};
const pickupMeshes = level.pickups.map(p => {
  const m = new THREE.Mesh(p.kind === 'nailer' ? pickupGeo.nailer : pickupGeo.box, pickupMat[p.kind]);
  m.position.set(p.pos.x, p.pos.y, p.pos.z);
  if (p.kind === 'health') {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), glowMaterial('emergencyRed'));
    cross.position.y = 0.13; m.add(cross);
  }
  scene.add(m);
  return m;
});

// ---------- Viewmodels ----------
const wrenchVM = new THREE.Group();
{
  const metal = tokenMaterial('metal', 0.4, 0.3, 'metal', 0.15, true);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), metal);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.1), metal);
  jaw.position.z = -0.27;
  wrenchVM.add(handle, jaw);
}
const nailerVM = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.4), tokenMaterial('sodium', 0.55, 0.1, 'sodium', 0.1, true));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), tokenMaterial('hazardBlack', 0.8, 0));
  grip.position.set(0, -0.13, 0.1);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), tokenMaterial('metal', 0.5, 0.3));
  mag.position.set(0, -0.08, -0.08);
  nailerVM.add(body, grip, mag);
}
const vmRest = new THREE.Vector3(0.22, -0.2, -0.45);
const VIEWMODELS = [[wrenchVM, 'wrench'], [nailerVM, 'nailer']] as const;
for (const [g] of VIEWMODELS) {
  g.position.copy(vmRest);
  g.traverse(o => { o.receiveShadow = true; });   // no moonlight on the weapon indoors
  camera.add(g);
}
const flash = new THREE.PointLight(hex('sodium'), 0, 6);
flash.position.set(0.22, -0.15, -0.8);
camera.add(flash);
let kick = 0;

const impactGeo = new THREE.SphereGeometry(0.04, 4, 3);
const impactEnemy = glowMaterial('ruptureTeal', 0.4), impactWall = glowMaterial('hazardBlack');
const impacts: { m: THREE.Mesh; life: number }[] = [];
function addImpact(p: THREE.Vector3, mat: THREE.Material) {
  const m = new THREE.Mesh(impactGeo, mat);
  m.position.copy(p);
  scene.add(m);
  impacts.push({ m, life: 4 });
}

// ---------- UI ----------
const $ = (id: string) => document.getElementById(id)!;
for (const id of ['rec', 'prompt', 'title', 'fade', 'frame', 'vignette']) $(id).style.display = 'none';
$('overlay').innerHTML = '<h1>OMEGA VALLEY</h1><p>Chapter 1: Night Shift — click to play</p>'
  + '<p>WASD move · Mouse look · Space jump · Ctrl/C crouch · Shift walk</p>'
  + '<p>E use · LMB attack · 1 wrench · 2 nail driver · R reload · F5 quick save · F9 quick load · Esc release mouse</p>';
const hud = $('hud'), ammoEl = $('ammo'), deathEl = $('death'), hurtEl = $('hurt'), toast = $('toast'), sub = $('sub'), endEl = $('end'), overlay = $('overlay');
let toastTime = 0, subTime = 0;
function say(msg: string) { toast.textContent = msg; toastTime = 1.8; }
function subtitle(msg: string) { $('sub-ar').textContent = ''; $('sub-en').textContent = msg; subTime = 5; }

// ---------- Input ----------
const keys = new Set<string>();
let mouseDown = false, firePressed = false;
const fwd = new THREE.Vector3();

addEventListener('keydown', e => {
  if (e.code.startsWith('Control') || e.code === 'F5' || e.code === 'F9') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Digit1') switchWeapon(arsenal, 'wrench');
  if (e.code === 'Digit2') switchWeapon(arsenal, 'nailer');
  if (e.code === 'KeyR') { if (health <= 0 || facility.finished) restart(); else if (startReload(arsenal)) sfx.reload(); }
  if (e.code === 'KeyE') doUse();
  if (e.code === 'F5') quickSave();
  if (e.code === 'F9') quickLoad();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
// Pointer lock is blocked in some embedded browsers: fall back to drag-to-look.
let playing = false, dragLook = false;
function startPlay() {
  overlay.style.display = 'none';
  playing = true;
  try {
    const p = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => { dragLook = true; say('MOUSE LOCK BLOCKED — DRAG TO LOOK'); });
  } catch { dragLook = true; }
}
overlay.addEventListener('click', startPlay);
renderer.domElement.addEventListener('click', () => { if (!document.pointerLockElement && !dragLook) startPlay(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) { dragLook = false; return; }
  if (!dragLook) { playing = false; overlay.style.display = 'flex'; }
});
addEventListener('keydown', e => { if (e.code === 'Escape' && dragLook) { playing = false; overlay.style.display = 'flex'; } });
addEventListener('mousedown', e => { if (e.button === 0 && playing && e.target === renderer.domElement) { mouseDown = true; firePressed = true; } });
addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
addEventListener('wheel', () => switchWeapon(arsenal, arsenal.current === 'wrench' ? 'nailer' : 'wrench'));
addEventListener('mousemove', e => {
  if (!document.pointerLockElement && !(dragLook && playing && e.buttons)) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY * 0.0022));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function readInput(): Input {
  const k = (c: string) => keys.has(c) ? 1 : 0;
  const alive = health > 0 && !facility.finished;
  return {
    forward: alive ? k('KeyW') - k('KeyS') : 0,
    strafe: alive ? k('KeyD') - k('KeyA') : 0,
    jump: alive && keys.has('Space'),
    crouch: keys.has('ControlLeft') || keys.has('KeyC'),
    walk: keys.has('ShiftLeft'),
    yaw,
  };
}

function eyePos() { return { x: player.pos.x, y: player.pos.y + eyeHeight(player), z: player.pos.z }; }
function lookDir() { camera.getWorldDirection(fwd); return { x: fwd.x, y: fwd.y, z: fwd.z }; }

function doUse() {
  if (health <= 0) return;
  const r = use(facility, eyePos(), lookDir(), level.usables);
  for (const ev of r.events) handleEvent(ev);
  if (r.used) refreshBreakers();
}
function refreshBreakers() {
  facility.breakers.forEach((on, i) => { breakerLamps[i].material = on ? lampOn : lampOff; });
}

// ---------- Story events ----------
function handleEvent(ev: string) {
  switch (ev) {
    case 'rupture':
      shake = 1.6; sfx.rumble();
      spawnEnemies('rupture');
      lights.forEach(l => { if (l.def.tag === 'rupture') l.light.intensity = l.def.intensity; });
      break;
    case 'breaker-on': sfx.clunk(); say(`${LINES['breaker-on']} ${facility.breakers.filter(Boolean).length}/3`); return;
    case 'breaker-already': return;
    case 'door-open': sfx.rumble(); rebuildWorld(); break;
    case 'collapse': shake = 1.0; sfx.crash(); rebuildWorld(); break;
    case 'finish': showEnd(); break;
  }
  if (LINES[ev]) subtitle(LINES[ev]);
}

function showEnd() {
  const m = Math.floor(storyTime / 60), s = Math.floor(storyTime % 60);
  endEl.querySelector('p')!.textContent = `Time ${m}:${String(s).padStart(2, '0')} · Kills ${kills}/${level.enemies.length} · Health ${health}`;
  endEl.style.display = 'flex';
  document.exitPointerLock();
}

// ---------- Save / load ----------
function quickSave() {
  if (health <= 0 || facility.finished) return;
  try {
    localStorage.setItem('omega.quick', serialize({ player, health, yaw, pitch, arsenal, enemies, facility, taken, storyTime, kills }));
    say('QUICK SAVED');
  } catch { say('SAVE FAILED'); }
}
function quickLoad() {
  let text: string | null = null;
  try { text = localStorage.getItem('omega.quick'); } catch { /* storage blocked */ }
  const s = text ? parse(text) : null;
  if (!s || !s.facility) { say('NO QUICK SAVE'); return; }
  player = s.player; health = s.health; yaw = s.yaw; pitch = s.pitch; arsenal = s.arsenal; enemies = s.enemies;
  facility = s.facility; taken = s.taken ?? []; storyTime = s.storyTime ?? 0; kills = s.kills ?? 0;
  afterStateChange();
  say('QUICK LOADED');
}
function restart() {
  player = newPlayer(level.spawn); health = 100; yaw = level.spawnYaw; pitch = 0;
  arsenal = newArsenal(false); facility = newFacility(level.usables.length);
  enemies = []; taken = []; storyTime = 0; kills = 0;
  spawnEnemies(undefined);
  afterStateChange();
}
function afterStateChange() {
  for (const b of bolts) scene.remove(b.m);
  bolts.length = 0;
  rebuildWorld(); syncEnemyMeshes(); refreshBreakers();
  doorLift = facility.doorOpen ? 2.9 : 0;
  renderer.shadowMap.needsUpdate = true;
  collapseFall = facility.fired.includes('t-catwalk') ? 20 : 0;
  pickupMeshes.forEach((m, i) => { m.visible = !taken.includes(level.pickups[i].id); });
  lights.forEach(l => { if (l.def.tag === 'rupture') l.light.intensity = storyTime >= RUPTURE_AT ? l.def.intensity : 0; });
  deathEl.style.display = 'none'; endEl.style.display = 'none';
}

// ---------- Simulation tick ----------
function hurt(dmg: number) {
  if (health <= 0 || dmg <= 0) return;
  health = Math.max(0, health - dmg);
  hurtFlash = 1; sfx.hurt();
  if (health <= 0) { deathEl.style.display = 'flex'; }
}

function tick(input: Input) {
  if (facility.finished) return;
  const prevT = storyTime;
  storyTime += DT;
  if (prevT < 0.6 && storyTime >= 0.6) subtitle(LINES.intro);
  if (prevT < RUPTURE_AT && storyTime >= RUPTURE_AT) handleEvent('rupture');

  const vyBefore = player.vel.y, wasGround = player.onGround;
  step(player, input, world, DT);
  if (!wasGround && player.onGround && vyBefore < -FALL_SAFE) hurt(Math.round((-vyBefore - FALL_SAFE) * 4));
  tickArsenal(arsenal, DT);

  const pb: Box = {
    min: { x: player.pos.x - TUNING.radius, y: player.pos.y, z: player.pos.z - TUNING.radius },
    max: { x: player.pos.x + TUNING.radius, y: player.pos.y + height(player), z: player.pos.z + TUNING.radius },
  };
  if (health > 0) for (const ev of checkTriggers(facility, pb, level.triggers)) handleEvent(ev);

  const wantFire = firePressed || (arsenal.current === 'wrench' && mouseDown);
  if (wantFire && health > 0) {
    const d = lookDir();
    const ray: Ray = { o: eyePos(), d };
    const alive = enemies.filter(e => e.mode !== 'dead').length;
    const res = fire(arsenal, ray, enemies, world);
    if (res.fired) {
      firePressed = false; kick = 1;
      if (arsenal.current === 'nailer') { sfx.nail(); flash.intensity = 8; } else sfx.swing();
      if (res.hitDist !== undefined) {
        addImpact(new THREE.Vector3(ray.o.x, ray.o.y, ray.o.z).addScaledVector(fwd, res.hitDist - 0.02), res.hitEnemy !== undefined ? impactEnemy : impactWall);
        if (arsenal.current === 'wrench') sfx.thunk();
      }
      const nowAlive = enemies.filter(e => e.mode !== 'dead').length;
      if (nowAlive < alive) { kills += alive - nowAlive; sfx.drifterDie(); }
    } else if (res.empty) { sfx.empty(); firePressed = false; }
  }

  const target = {
    center: { x: player.pos.x, y: player.pos.y + height(player) * 0.6, z: player.pos.z },
    feet: player.pos, radius: TUNING.radius, height: height(player),
  };
  if (health > 0) for (const e of enemies) {
    const before = e.mode;
    if (e.kind === 'shard') {
      const b = updateShard(e, target, world, DT);
      if (b) { const m = new THREE.Mesh(boltGeo, boltMat); scene.add(m); bolts.push({ b, m }); sfx.zap(); }
    } else {
      hurt(updateDrifter(e, target, world, DT));
    }
    if (before !== e.mode) {
      if (before === 'idle') sfx.drifterAlert();
      if (e.mode === 'windup') sfx.drifterWindup();
    }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const r = updateBolt(bolts[i].b, target, world, DT);
    if (r === 'fly') continue;
    if (r === 'hit') hurt(SHARD.damage);
    scene.remove(bolts[i].m); bolts.splice(i, 1);
  }

  level.pickups.forEach((p, i) => {
    if (taken.includes(p.id) || health <= 0) return;
    if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) > 0.9 || Math.abs(p.pos.y - (player.pos.y + 0.5)) > 1.5) return;
    if (p.kind === 'ammo') {
      if (arsenal.reserve >= WEAPONS.nailer.maxReserve) return;
      arsenal.reserve = Math.min(WEAPONS.nailer.maxReserve, arsenal.reserve + 24); say('+24 NAILS');
    } else if (p.kind === 'health') {
      if (health >= 100) return;
      health = Math.min(100, health + 25); say('+25 HEALTH');
    } else {
      giveNailer(arsenal); say('NAIL DRIVER'); subtitle('A nail driver, still loaded. Press 1 and 2 to switch.');
    }
    taken.push(p.id); pickupMeshes[i].visible = false; sfx.pickup();
  });
}

// ---------- Render loop ----------
let acc = 0, last = performance.now();
const frameTimes: number[] = [];

function frame(now: number) {
  const ms = now - last;
  last = now;
  frameTimes.push(ms);
  if (frameTimes.length > 600) frameTimes.shift();
  const dt = Math.min(ms / 1000, 0.1);
  acc += dt;
  const input = readInput();
  while (acc >= DT) { tick(input); acc -= DT; }

  eye += (eyeHeight(player) - eye) * Math.min(1, ms / 60);
  shake = Math.max(0, shake - dt);
  const sh = shake * 0.04;
  camera.position.set(player.pos.x + (Math.random() - 0.5) * sh, player.pos.y + eye + (Math.random() - 0.5) * sh, player.pos.z);
  camera.rotation.set(pitch, yaw, health > 0 ? 0 : 0.5);
  sky.position.copy(camera.position);

  // Viewmodel bob / kick / reload dip
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const bobT = now / 1000 * 9;
  const bobA = player.onGround ? Math.min(speed / TUNING.runSpeed, 1) * 0.012 : 0;
  kick = Math.max(0, kick - dt * 6);
  for (const [g, id] of VIEWMODELS) {
    g.visible = arsenal.current === id && health > 0;
    g.position.set(vmRest.x + Math.cos(bobT / 2) * bobA, vmRest.y + Math.abs(Math.sin(bobT / 2)) * bobA - (arsenal.reloading > 0 ? 0.12 : 0), vmRest.z + kick * 0.06);
  }
  wrenchVM.rotation.set(-kick * 1.4, 0, -kick * 0.6);
  nailerVM.rotation.set(kick * 0.25, 0, 0);
  flash.intensity = Math.max(0, flash.intensity - dt * 120);

  // Door slides up, catwalk falls.
  const door = byId.get('floodgate')!.mesh, cw = byId.get('catwalk-mid')!.mesh;
  if (facility.doorOpen && doorLift < 2.9) { doorLift = Math.min(2.9, doorLift + dt * 1.2); renderer.shadowMap.needsUpdate = true; }
  door.position.y = 1.5 + doorLift;
  if (facility.fired.includes('t-catwalk') && collapseFall < 20) { collapseFall += dt * 12; renderer.shadowMap.needsUpdate = true; }
  cw.position.y = -0.15 - collapseFall; cw.rotation.z = Math.min(collapseFall * 0.15, 0.6);
  cw.visible = collapseFall < 20;

  // Lights: flicker after rupture, alarms pulse.
  const ruptured = storyTime >= RUPTURE_AT;
  for (const { light, def } of lights) {
    if (def.tag === 'flicker' && ruptured) light.intensity = def.intensity * (Math.random() < 0.06 ? 0.15 : 1);
    if (def.tag === 'alarm') light.intensity = ruptured ? def.intensity * (0.5 + 0.5 * Math.sin(now / 180)) : 0;
    if (def.tag === 'rupture' && ruptured) light.intensity = def.intensity * (0.8 + 0.2 * Math.sin(now / 400));
  }

  for (const e of enemies) {
    const m = enemyMeshes.get(e.id);
    if (!m) continue;
    m.visible = e.mode !== 'dead';
    const shard = e.kind === 'shard';
    m.position.set(e.pos.x, e.pos.y + (shard ? 0 : Math.sin(e.bob * 2) * 0.08), e.pos.z);
    m.rotation.y += dt * (e.mode === 'windup' ? 12 : shard ? 0.8 : 1.5);
    // Swap shared state materials (no per-enemy material, no allocation).
    if (shard) m.material = e.mode !== 'idle' && e.timer < 0.4 ? EM.shardCharge : EM.shardIdle;
    else {
      m.material = e.mode === 'windup' || e.mode === 'lunge' ? EM.drifterTell : e.mode === 'idle' ? EM.drifterIdle : EM.drifterHunt;
      m.scale.setScalar(e.mode === 'windup' ? 1.25 : 1);
    }
    void radiusOf;
  }
  for (const b of bolts) b.m.position.set(b.b.pos.x, b.b.pos.y, b.b.pos.z);
  for (let i = impacts.length - 1; i >= 0; i--) {
    impacts[i].life -= dt;
    if (impacts[i].life <= 0) { scene.remove(impacts[i].m); impacts.splice(i, 1); }
  }
  pickupMeshes.forEach(m => { m.rotation.y += dt; });

  renderer.render(scene, camera);

  hurtFlash = Math.max(0, hurtFlash - dt * 2.5);
  hurtEl.style.opacity = String(hurtFlash * 0.6);
  toastTime -= dt; toast.style.opacity = toastTime > 0 ? '1' : '0';
  subTime -= dt; sub.style.opacity = subTime > 0 ? '1' : '0';
  hud.innerHTML = `<span class="${health <= 25 ? 'low' : ''}">HEALTH ${health}</span>`;
  ammoEl.innerHTML = arsenal.current === 'nailer'
    ? `${arsenal.reloading > 0 ? 'RELOADING ' : ''}<b>${arsenal.mag}</b> / ${arsenal.reserve}`
    : 'WRENCH';
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);

// Test hook: read state + inject input for Playwright / walkthrough checks.
declare global { interface Window { __game: unknown } }
window.__game = {
  state: () => ({
    level: 'nightshift', examined: [] as string[],
    pos: { ...player.pos }, vel: { ...player.vel }, onGround: player.onGround, crouched: player.crouched,
    yaw, pitch, health, weapon: arsenal.current, hasNailer: arsenal.has.nailer, mag: arsenal.mag, reserve: arsenal.reserve,
    facility: JSON.parse(JSON.stringify(facility)), storyTime, kills,
    enemies: enemies.map(e => ({ id: e.id, kind: e.kind ?? 'drifter', pos: { ...e.pos }, health: e.health, mode: e.mode })),
  }),
  frameTimes: () => [...frameTimes],
  info: () => {
    const mats = new Set<THREE.Material>();
    scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) mats.add(m as THREE.Material); });
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length ?? 0, materials: mats.size };
  },
  press: (code: string) => keys.add(code),
  release: (code: string) => keys.delete(code),
  look: (y: number, p: number) => { yaw = y; pitch = p; },
  fire: () => { firePressed = true; },
  key: (code: string) => dispatchEvent(new KeyboardEvent('keydown', { code })),
  teleport: (x: number, y: number, z: number) => { player.pos = { x, y, z }; player.vel = { x: 0, y: 0, z: 0 }; },
  god: () => { health = 100000; },
};
