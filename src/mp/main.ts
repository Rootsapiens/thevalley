// Standalone multiplayer entry (mp.html). Ravens vs Village in a walled village square, host-authoritative.
// Query: ?net=local uses BroadcastChannel between tabs (tests); ?bots=0 leaves empty seats empty.
import * as THREE from 'three';
import { newPlayer, step as physStep, eyeHeight, type PlayerState } from '../physics';
import { openHost, openClient, normaliseCode, type NetKind, type ClientNet } from '../net/transport';
import { TEAM_NAMES, type GameEvent, type Phase, type PSnap } from '../net/protocol';
import { HostSession, ClientSession } from './session';
import { SOLIDS, GROUND, EXTRA_COVER, spawnFor, type Difficulty } from './sim';
import { buildVillage, SUN_DIR, FOG_COLOR } from '../villageScene';
import { setAnisotropy } from '../materials';
import { Figure, setCharEnv } from './chars';

const Q = new URLSearchParams(location.search);
const NET: NetKind = Q.get('net') === 'local' ? 'local' : 'peerjs';
const BOTS = Q.get('bots') !== '0';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- three scene: the real village (src/villageScene.ts, read-only), lit and skied by its own builder ----------
const renderer = new THREE.WebGLRenderer({ antialias: !Q.has('lowfx'), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.debug.checkShaderErrors = import.meta.env.DEV;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;     // the village is static: the sun's shadow map renders once
renderer.shadowMap.needsUpdate = true;
setAnisotropy(renderer.capabilities.getMaxAnisotropy());
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.009);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 2000);
camera.rotation.order = 'YXZ';
const V = buildVillage(scene, renderer);
setCharEnv(V.env);
// The sun's shadow frustum was cut for the barn corner; move it over the square.
V.sun.target.position.set(20, 0, 48);
V.sun.position.copy(V.sun.target.position).addScaledVector(SUN_DIR, 90);
V.sun.shadow.camera.top = 20; V.sun.shadow.camera.bottom = -8;
V.sun.updateMatrixWorld(); V.sun.target.updateMatrixWorld(); V.sun.shadow.camera.updateProjectionMatrix();
// Market stalls and carts: the extra cover the sim collides with.
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9, envMap: V.env, envMapIntensity: 1.5, emissive: 0x2a1c10 }), roof = new THREE.MeshStandardMaterial({ color: 0x9a3a2a, roughness: 0.9, envMap: V.env, emissive: 0x2a100c });
  for (const b of EXTRA_COVER) {
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const y0 = GROUND(cx, cz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(cx, y0 + h / 2, cz); m.castShadow = m.receiveShadow = true; scene.add(m);
    const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.1, d + 0.2), roof); t.position.set(cx, y0 + h + 0.05, cz); scene.add(t);
  }
}

interface Slot3D { fig: Figure; human: boolean; x: number; z: number }
const figures = new Map<number, Slot3D>();
// viewmodel
const vm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.18), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.6, envMap: null }));
vm.position.set(0.14, -0.14, -0.45); camera.add(vm); scene.add(camera);

// ---------- audio (own synthesis, kept quiet) ----------
let actx: AudioContext | null = null;
function bang(vol: number): void {
  try {
    actx ??= new AudioContext();
    const n = Math.floor(actx.sampleRate * 0.09), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = actx.createBufferSource(), g = actx.createGain();
    g.gain.value = Math.min(0.3, vol); src.buffer = buf; src.connect(g).connect(actx.destination); src.start();
  } catch { /* audio is optional */ }
}

// ---------- state ----------
interface View { i: number; n: string; x: number; y: number; z: number; yw: number; pt: number; hp: number; a: boolean; h: boolean; tm: 0 | 1; k: number; d: number }
let host: HostSession | null = null;
let client: ClientSession | null = null;
let clientNet: ClientNet | null = null;
let myId = -1;
let started = false;
let yaw = 0, pitch = 0;
let fireLatch = false;
const keys = new Set<string>();
const pred: PlayerState = newPlayer({ x: 0, y: 0, z: 0 });
let spec = -1;
const tracers: { line: THREE.Line; life: number }[] = [];
const feed: { t: number; s: string }[] = [];
let bannerText = '', bannerUntil = 0;
const nameOf = (id: number) => views().find(v => v.i === id)?.n ?? '#' + id;

function views(): View[] {
  if (host) {
    const out: View[] = [];
    for (const s of host.sim.room.slots) {
      if (!s.active) continue;
      const b = host.sim.bodies[s.id], c = host.sim.ctl[s.id];
      out.push({ i: s.id, n: s.name, x: b.pos.x, y: b.pos.y, z: b.pos.z, yw: c.yaw, pt: c.pitch, hp: host.sim.hp[s.id], a: s.alive, h: s.human, tm: s.team, k: s.kills, d: s.deaths });
    }
    return out;
  }
  const c = client;
  if (!c?.snap) return [];
  const a = c.prev, b = c.snap;
  const span = Math.max(1, c.snapAt - c.prevAt);
  const u = a ? Math.max(0, Math.min(1, (performance.now() - c.snapAt) / span)) : 1;
  return b.p.map((p: PSnap) => {
    const q = a?.p.find(o => o.i === p.i);
    if (!q || !q.a || !p.a) return { ...p };
    // Interpolate from the previous snapshot towards the newest one: one interval of delay, smooth motion.
    const t = u, lerp = (m: number, n: number) => m + (n - m) * t;
    return { ...p, x: lerp(q.x, p.x), y: lerp(q.y, p.y), z: lerp(q.z, p.z) };
  });
}
function game(): { phase: Phase; tl: number; rd: number; sc: [number, number] } {
  if (host) { const r = host.sim.room; return { phase: r.phase, tl: r.timer, rd: r.round, sc: r.score }; }
  const s = client?.snap;
  return s ? { phase: s.ph, tl: s.tl, rd: s.rd, sc: s.sc } : { phase: 'waiting', tl: 0, rd: 0, sc: [0, 0] };
}

function onEvents(evs: GameEvent[]): void {
  const now = performance.now();
  for (const e of evs) {
    if (e.k === 'shot') {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.x, e.y, e.z), new THREE.Vector3(e.tx, e.ty, e.tz)]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: e.hit ? 0xff5030 : 0xffe080 }));
      scene.add(line); tracers.push({ line, life: 0.08 });
      figures.get(e.i)?.fig.shoot();
      const me = views().find(v => v.i === myId);
      const dist = me ? Math.hypot(me.x - e.x, me.z - e.z) : 10;
      bang(0.3 / (1 + dist * 0.15));
    } else if (e.k === 'kill') {
      feed.push({ t: now + 5000, s: `${nameOf(e.a)} eliminated ${nameOf(e.v)}` });
    } else if (e.k === 'round') {
      bannerText = `${TEAM_NAMES[e.w].toUpperCase()} WIN THE ROUND`; bannerUntil = now + 3500;
    } else if (e.k === 'match') {
      bannerText = `${TEAM_NAMES[e.w].toUpperCase()} WIN THE MATCH`; bannerUntil = now + 8000;
    }
  }
}

// ---------- lobby ----------
const setStatus = (s: string) => { $('status').textContent = s; };
const difficulty = (): Difficulty => { const v = Q.get('diff') ?? $<HTMLSelectElement>('diff').value; return v === 'medium' || v === 'hard' ? v : 'easy'; };
const playerName = () => ($<HTMLInputElement>('name').value.trim() || 'Player') .slice(0, 16);
function enterGame(): void {
  started = true; $('menu').style.display = 'none';
  const sp = spawnFor(myId); yaw = sp.yaw; pitch = 0;
  pred.pos.x = sp.x; pred.pos.y = 0; pred.pos.z = sp.z;
}
async function startHost(withNet: boolean): Promise<void> {
  setStatus(withNet ? 'Contacting the relay...' : 'Starting...');
  try {
    const net = withNet ? await openHost(NET) : null;
    host = new HostSession(net, playerName(), { bots: BOTS, difficulty: difficulty() });
    net?.onJoin(() => { /* the hello handshake does the work */ });
    myId = 0; enterGame();
    $('room').textContent = withNet ? `ROOM ${host.code}  (share this code, max 6)` : 'SOLO';
  } catch (e) { setStatus('Could not host: ' + (e as Error).message); setButtons(true); }
}
async function startJoin(): Promise<void> {
  const code = normaliseCode($<HTMLInputElement>('code').value);
  if (!code) { setStatus('Enter the 5-character room code.'); setButtons(true); return; }
  setStatus('Joining ' + code + '...');
  try {
    clientNet = await openClient(NET, code);
    client = new ClientSession(clientNet, playerName());
    const t0 = performance.now();
    await new Promise<void>((res, rej) => {
      const iv = setInterval(() => {
        if (client!.status === 'ready') { clearInterval(iv); res(); }
        else if (client!.status === 'rejected') { clearInterval(iv); rej(new Error(client!.reason)); }
        else if (performance.now() - t0 > 8000) { clearInterval(iv); rej(new Error('host did not answer')); }
      }, 50);
    });
    myId = client.id; enterGame();
    $('room').textContent = `ROOM ${code}`;
  } catch (e) {
    client = null; clientNet?.close(); clientNet = null;
    setStatus('Could not join: ' + (e as Error).message); setButtons(true);
  }
}
function setButtons(on: boolean): void { for (const id of ['host', 'solo', 'join']) $<HTMLButtonElement>(id).disabled = !on; }
$('host').onclick = () => { setButtons(false); void startHost(true); };
$('solo').onclick = () => { setButtons(false); void startHost(false); };
$('join').onclick = () => { setButtons(false); void startJoin(); };

// ---------- input ----------
addEventListener('keydown', e => { keys.add(e.code); });
addEventListener('keyup', e => { keys.delete(e.code); });
addEventListener('blur', () => keys.clear());
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0022; pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0022));
});
renderer.domElement.addEventListener('mousedown', () => {
  if (!started) return;
  if (document.pointerLockElement !== renderer.domElement) {
    try { void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {}); } catch { /* headless */ }
    return;
  }
  trigger();
});
function trigger(): void { fireLatch = true; client?.pull(); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
function axes(): { fwd: number; str: number; jump: boolean; crouch: boolean } {
  return {
    fwd: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    str: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    jump: keys.has('Space'), crouch: keys.has('KeyC') || keys.has('ControlLeft'),
  };
}

// ---------- fixed loops ----------
let lastSim = performance.now();
setInterval(() => {   // simulation and net run on a timer, independent of rendering speed or tab visibility
  const now = performance.now(), dt = (now - lastSim) / 1000; lastSim = now;
  if (!started) return;
  if (host) {
    const a = axes();
    host.sim.setInput(0, { fwd: a.fwd, str: a.str, yaw, pitch, jump: a.jump, crouch: a.crouch, fire: fireLatch });
    fireLatch = false;
    for (const s of host.advance(dt)) onEvents(s.ev);
  }
}, 8);
setInterval(() => {
  if (!started || !client) return;
  const a = axes();
  client.sendInput({ fwd: a.fwd, str: a.str, yaw, pitch, jump: a.jump, crouch: a.crouch });
  const pe = client.pendingEvents; if (pe.length) { client.pendingEvents = []; onEvents(pe); }
  if (client.status === 'closed') { bannerText = 'DISCONNECTED FROM HOST'; bannerUntil = performance.now() + 60_000; }
}, 33);

// ---------- render ----------
let lastFrame = performance.now();
const frameMs: number[] = [];
function frame(): void {
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000); frameMs.push(now - lastFrame); if (frameMs.length > 600) frameMs.shift(); lastFrame = now;
  const vs = views();
  const me = vs.find(v => v.i === myId);
  const g = game();
  // client-side prediction of the local body, softly pulled back to the host's truth
  if (client && me) {
    if (me.a) {
      const a = axes(), frozen = g.phase === 'freeze' || g.phase === 'waiting';
      physStep(pred, { forward: frozen ? 0 : a.fwd, strafe: frozen ? 0 : a.str, jump: !frozen && a.jump, crouch: a.crouch, walk: false, yaw }, SOLIDS, dt, GROUND);
      const ex = me.x - pred.pos.x, ez = me.z - pred.pos.z, err = Math.hypot(ex, ez);
      if (err > 2 || frozen) { pred.pos.x = me.x; pred.pos.z = me.z; pred.pos.y = me.y; pred.vel.x = pred.vel.z = 0; }
      else { pred.pos.x += ex * 0.12; pred.pos.z += ez * 0.12; }
    } else { pred.pos.x = me.x; pred.pos.y = me.y; pred.pos.z = me.z; }
  }
  // spectate target
  let camFrom: { x: number; y: number; z: number; yw: number; pt: number; eye: number } | null = null;
  if (me && me.a) {
    const b = host ? host.sim.bodies[0] : pred;
    camFrom = { x: b.pos.x, y: b.pos.y, z: b.pos.z, yw: yaw, pt: pitch, eye: eyeHeight(b) };
    spec = -1;
  } else if (me) {
    const alive = vs.filter(v => v.a && v.i !== myId);
    const mates = alive.filter(v => v.tm === me.tm);
    const pool = mates.length ? mates : alive;
    if (!pool.some(v => v.i === spec)) spec = pool[0]?.i ?? -1;
    const t = pool.find(v => v.i === spec);
    if (t) camFrom = { x: t.x, y: t.y, z: t.z, yw: t.yw, pt: t.pt, eye: 1.64 };
    else camFrom = { x: me.x, y: me.y + 6, z: me.z, yw: yaw, pt: -0.8, eye: 0 };
  }
  if (camFrom) { camera.position.set(camFrom.x, camFrom.y + camFrom.eye, camFrom.z); camera.rotation.set(camFrom.pt, camFrom.yw, 0); }
  vm.visible = !!me?.a;
  V.sky.position.copy(camera.position);
  V.waterTime.value = now / 1000; V.dustTime.value = now / 1000;
  // figures: animated bodies, idle/walk/run by speed, shoot on fire, death on kill
  const seen = new Set<number>();
  for (const v of vs) {
    seen.add(v.i);
    let f = figures.get(v.i);
    if (f && (f.human !== v.h || f.fig.team !== v.tm)) { scene.remove(f.fig.group); f.fig.dispose(); figures.delete(v.i); f = undefined; }
    if (!f) { f = { fig: new Figure(v.i, v.tm, v.h), human: v.h, x: v.x, z: v.z }; scene.add(f.fig.group); figures.set(v.i, f); }
    const speed = dt > 0 ? Math.hypot(v.x - f.x, v.z - f.z) / dt : 0;
    f.x = v.x; f.z = v.z;
    f.fig.update(dt, v.a ? Math.min(speed, 8) : 0, v.a);
    f.fig.group.visible = v.i !== myId && v.i !== spec && (v.a || f.fig.wasAlive);   // never the body the camera sits in
    f.fig.group.position.set(v.x, v.y, v.z); f.fig.group.rotation.y = v.yw;
  }
  for (const [id, f] of figures) if (!seen.has(id)) { scene.remove(f.fig.group); f.fig.dispose(); figures.delete(id); }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.life -= dt;
    if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); tracers.splice(i, 1); }
  }
  hud(vs, me, g, now);
  renderer.render(scene, camera);
}
function hud(vs: View[], me: View | undefined, g: ReturnType<typeof game>, now: number): void {
  if (!started) return;
  const mm = Math.floor(Math.max(0, g.tl) / 60), ss = Math.floor(Math.max(0, g.tl) % 60);
  const label = g.phase === 'waiting' ? 'WAITING FOR PLAYERS' : g.phase === 'freeze' ? `GET READY ${Math.ceil(g.tl)}` : g.phase === 'live' ? `${mm}:${String(ss).padStart(2, '0')}` : g.phase === 'matchEnd' ? 'MATCH OVER' : 'ROUND OVER';
  $('top').innerHTML = `RAVENS <b>${g.sc[0]}</b> : <b>${g.sc[1]}</b> VILLAGE &nbsp; ROUND ${g.rd} &nbsp; ${label}`;
  $('hp').textContent = me ? (me.a ? `HP ${Math.round(me.hp)}` : `ELIMINATED - watching ${vs.find(v => v.i === spec)?.n ?? '-'}`) : '';
  while (feed.length && feed[0].t < now) feed.shift();
  $('feed').innerHTML = feed.map(f => f.s).join('<br>');
  $('banner').textContent = now < bannerUntil ? bannerText : '';
}
renderer.setAnimationLoop(frame);

// ---------- test hook ----------
(window as unknown as { __mp: unknown }).__mp = {
  state: () => {
    const vs = views(), g = game();
    return {
      mode: host ? 'host' : client ? 'client' : 'menu', net: NET, code: host?.code ?? '', status: started ? (client?.status ?? 'ready') : 'menu',
      id: myId, phase: g.phase, timeLeft: g.tl, round: g.rd, score: g.sc, players: vs,
      me: vs.find(v => v.i === myId) ?? null, yaw, pitch,
    };
  },
  look: (y: number, p: number) => { yaw = y; pitch = p; },
  fire: () => trigger(),
  /** 95th percentile of the last 600 frame intervals, in ms. */
  frameP95: () => { const a = [...frameMs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.95)] : 0; },
};
