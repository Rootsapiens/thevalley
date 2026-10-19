// The village's opt-in combat sandbox (?arena=1 or ?roots=1; off by default, because in Chapter 1 Lorenzo is an
// unarmed journalist). Four root walkers grow in the east half of the square. Lorenzo carries a spark caster: a fence
// energiser and a jar capacitor wired to two copper prongs, cranked to charge (electricity is the one thing that pushes
// the roots back, world-bible §4). Hitscan arc, hit marker, view punch and kick, impact sparks and bark chips, a
// 40-60 ms hitstop, the muzzle light; every walker attack has a tell. The rules are in src/rootBots.ts (pure); this
// file is the glue: figures, input, HUD, sound and feedback. Nothing here allocates per frame.
import * as THREE from 'three';
import palette from '../studio/art/palette.json';
import type { Ray } from './combat';
import { TUNING, type Box, type Ground, type PlayerState, type Vec3 } from './physics';
import {
  ROOT, ROOT_SPAWNS, CASTER, newBots, tickBots, castShot, newShot, newCaster, tickCaster, reloadCaster, hearShot, botPose, newPose,
  torsoToWorld, gone, type RootBot, type BotEvent, type BotWorld, type Prey,
} from './rootBots';
import { buildRootFigures, buildCaster, ELECTRIC, KNOT_GLOW } from './rootFigures';
import type { villageAudio } from './villageAudio';

export interface ArenaCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  env: THREE.Texture;
  audio: ReturnType<typeof villageAudio>;
  ground: Ground;
  /** Static solids, door leaves and props near (x, z), without the walkers (for their own movement). */
  near(x: number, z: number): Box[];
  /** First solid along a→b as a fraction of the way, Infinity when clear (invisible clip boxes ignored). */
  segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
  /** True while the game takes input (pointer captured, no end sequence). */
  live(): boolean;
  /** Puts the player back at the arena start. */
  respawn(): void;
  toast(msg: string): void;
}

export interface Arena {
  /** Fixed step (120 Hz): the walkers against the player. */
  tick(dt: number, player: PlayerState, height: number): void;
  /** Per frame, before render: firing, feedback, figures, viewmodel and HUD. eye/dir: the logical view (no bob). */
  frame(dt: number, eye: Vec3, dir: Vec3, bobX: number, bobY: number): void;
  /** Appends the living walkers' boxes (the player collides with them). */
  boxes(out: Box[]): void;
  /** Camera offsets this frame: view punch (pitch, roll, rad) and the fall when taken (drop, m). */
  view: { pitch: number; roll: number; drop: number };
  /** Camera trauma added since the last call. */
  trauma(): number;
  down(): boolean;
  /** Input listeners and the HUD; call once the page's own UI is set up. */
  start(): void;
  reset(): void;
  dev(): string;
  state(): Record<string, unknown>;
  god(): void;
}

const P = (t: keyof typeof palette) => new THREE.Color(palette[t]);
const DUST = P('concrete').lerp(P('rust'), 0.35), CHIP = P('rust').lerp(P('hazardBlack'), 0.45), SPARK = P('hudAmber');
const DEG = Math.PI / 180;
const PUNCH = 2.2;          // degrees of view punch per shot (up), dropped GoldSrc-style
const HITSTOP = 0.04, KILLSTOP = 0.06;

/** A small pool of points (sparks or dust and chips): position, velocity, gravity, a floor, a fade. */
class Particles {
  readonly points: THREE.Points;
  private readonly pos: Float32Array; private readonly col: Float32Array; private readonly vel: Float32Array;
  private readonly life: Float32Array; private readonly span: Float32Array; private readonly grav: Float32Array;
  private readonly floor: Float32Array; private readonly alpha: Float32Array;
  private n = 0;
  constructor(scene: THREE.Scene, private readonly cap: number, size: number, additive: boolean) {
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap); this.span = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.floor = new Float32Array(cap); this.alpha = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, depthWrite: false, toneMapped: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false; this.points.matrixAutoUpdate = false;
    scene.add(this.points);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, c: THREE.Color, k: number, a: number, grav: number, floor: number) {
    if (this.n >= this.cap) return;
    const i = this.n++, v = i * 3, q = i * 4;
    this.pos[v] = x; this.pos[v + 1] = y; this.pos[v + 2] = z;
    this.vel[v] = vx; this.vel[v + 1] = vy; this.vel[v + 2] = vz;
    this.col[q] = c.r * k; this.col[q + 1] = c.g * k; this.col[q + 2] = c.b * k; this.col[q + 3] = a;
    this.life[i] = this.span[i] = life; this.grav[i] = grav; this.floor[i] = floor; this.alpha[i] = a;
  }
  private kill(i: number) {
    const j = --this.n;
    if (i === j) return;
    this.pos.copyWithin(i * 3, j * 3, j * 3 + 3); this.vel.copyWithin(i * 3, j * 3, j * 3 + 3); this.col.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.life[i] = this.life[j]; this.span[i] = this.span[j]; this.grav[i] = this.grav[j]; this.floor[i] = this.floor[j]; this.alpha[i] = this.alpha[j];
  }
  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      if ((this.life[i] -= dt) <= 0) { this.kill(i); continue; }
      const v = i * 3;
      this.vel[v + 1] -= this.grav[i] * dt;
      this.pos[v] += this.vel[v] * dt; this.pos[v + 1] += this.vel[v + 1] * dt; this.pos[v + 2] += this.vel[v + 2] * dt;
      if (this.pos[v + 1] < this.floor[i]) { this.pos[v + 1] = this.floor[i]; this.vel[v] *= 0.35; this.vel[v + 2] *= 0.35; this.vel[v + 1] *= -0.2; }
      this.col[i * 4 + 3] = this.alpha[i] * Math.min(1, 3 * this.life[i] / this.span[i]);
      i++;
    }
    const g = this.points.geometry, pa = g.getAttribute('position') as THREE.BufferAttribute, ca = g.getAttribute('color') as THREE.BufferAttribute;
    pa.clearUpdateRanges(); pa.addUpdateRange(0, this.n * 3); pa.needsUpdate = true;
    ca.clearUpdateRanges(); ca.addUpdateRange(0, this.n * 4); ca.needsUpdate = true;
    g.setDrawRange(0, this.n);
    this.points.visible = this.n > 0;
  }
  clear() { this.n = 0; this.points.visible = false; }
}

/** The arc from the prongs to what it hits: a jagged ribbon (a bright core inside a faint glow), re-forked every frame
 *  for the 90 ms it lives, turned to face the camera. */
class Arc {
  readonly mesh: THREE.Mesh;
  private readonly N = 14;
  private readonly pos: Float32Array; private readonly col: Float32Array; private readonly pts: Float32Array;
  private life = 0;
  private readonly a = new THREE.Vector3(); private readonly b = new THREE.Vector3();
  constructor(scene: THREE.Scene) {
    const N = this.N, V = N * 4;
    this.pos = new Float32Array(V * 3); this.col = new Float32Array(V * 3); this.pts = new Float32Array(N * 3);
    const idx: number[] = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < N - 1; i++) { const q = r * N * 2 + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  fire(from: THREE.Vector3, to: THREE.Vector3, cam: THREE.Vector3) { this.a.copy(from); this.b.copy(to); this.life = 0.09; this.shape(cam); this.mesh.visible = true; }
  update(dt: number, cam: THREE.Vector3) {
    if (this.life <= 0 || (this.life -= dt) <= 0) { this.mesh.visible = false; return; }
    this.shape(cam);
  }
  hide() { this.life = 0; this.mesh.visible = false; }
  private shape(cam: THREE.Vector3) {
    const N = this.N, a = this.a, b = this.b, P = this.pts;
    let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    // Two axes across the arc for the forks.
    let ux = -dz, uz = dx, uy = 0;
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    if (Math.hypot(dx, dz) < 1e-3) { ux = 1; uy = 0; uz = 0; }
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    const amp = Math.min(0.24, 0.015 + len * 0.022);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1), e = Math.sin(Math.PI * s), p = (Math.random() * 2 - 1) * amp * e, q = (Math.random() * 2 - 1) * amp * e;
      P[i * 3] = a.x + dx * len * s + ux * p + vx * q; P[i * 3 + 1] = a.y + dy * len * s + uy * p + vy * q; P[i * 3 + 2] = a.z + dz * len * s + uz * p + vz * q;
    }
    const fade = Math.min(1, this.life / 0.06);
    for (let r = 0; r < 2; r++) {
      const w = r ? 0.011 : 0.0028, k = (r ? 0.35 : 1.6) * fade;   // widths per metre from the eye: a steady line on screen
      for (let i = 0; i < N; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        // Across = direction x (point - camera): the ribbon faces the eye.
        const cx = px - cam.x, cy = py - cam.y, cz = pz - cam.z;
        let sx = dy * cz - dz * cy, sy = dz * cx - dx * cz, sz = dx * cy - dy * cx;
        const sl = (Math.hypot(sx, sy, sz) || 1) / (w * Math.min(8, Math.hypot(cx, cy, cz))); sx /= sl; sy /= sl; sz /= sl;
        const o = (r * N * 2 + i * 2) * 3;
        this.pos[o] = px - sx; this.pos[o + 1] = py - sy; this.pos[o + 2] = pz - sz;
        this.pos[o + 3] = px + sx; this.pos[o + 4] = py + sy; this.pos[o + 5] = pz + sz;
        for (let c = 0; c < 2; c++) { this.col[o + c * 3] = ELECTRIC.r * k; this.col[o + c * 3 + 1] = ELECTRIC.g * k; this.col[o + c * 3 + 2] = ELECTRIC.b * k; }
      }
    }
    const g = this.mesh.geometry;
    g.getAttribute('position').needsUpdate = true; g.getAttribute('color').needsUpdate = true;
  }
}

export function createArena(ctx: ArenaCtx): Arena {
  const { scene, camera, audio } = ctx;
  let bots: RootBot[] = newBots(ctx.ground);
  let caster = newCaster();
  let health = 100, kills = 0, shots = 0, hits = 0, knots = 0, marks = 0, down = false, downT = 0, invulnerable = false;
  let stop = 0, queued = 0, held = false, punch = 0, rollP = 0, kick = 0, hurtK = 0, markT = 0, markKill = false, traumaAdd = 0, flashT = 0, regrow = -1;
  let yawNow = 0, pitchNow = 0, lastYaw = 0, lastPitch = 0, swX = 0, swY = 0, clock = 0;
  const view = { pitch: 0, roll: 0, drop: 0 };
  const events: BotEvent[] = [];
  const prey: Prey = { x: 0, y: 0, z: 0, r: TUNING.radius, h: TUNING.standHeight };
  const poses = bots.map(() => newPose()), dustT = new Float32Array(bots.length);
  const boxes: Box[] = bots.map(() => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
  const shot = newShot(), ray: Ray = { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 0, z: -1 } };
  const world: BotWorld = {
    los: (ax, ay, az, bx, by, bz) => !(ctx.segment(ax, ay, az, bx, by, bz) <= 1),
    near: (x, z) => ctx.near(x, z),
    ground: ctx.ground,
  };

  // ---------- Figures, viewmodel, light, arc, particles (all built before the shader warm-up) ----------
  const F = buildRootFigures(scene, bots.length, ctx.env);
  const C = buildCaster(ctx.env);
  // Lower right, the prongs angled in at the crosshair; the muzzle stays inside the player's radius (never through a wall).
  const REST = new THREE.Vector3(0.14, -0.115, -0.19), AIM = { x: 0.08, y: 0.12 };
  C.group.position.copy(REST); C.group.rotation.set(AIM.x, AIM.y, 0); C.group.scale.setScalar(0.7);
  camera.add(C.group);
  const light = new THREE.PointLight(ELECTRIC, 0, 9, 2);
  light.position.set(0.1, -0.06, -0.42);
  camera.add(light);
  const arc = new Arc(scene);
  const sparks = new Particles(scene, 96, 0.035, true), chips = new Particles(scene, 192, 0.05, false);
  const _mw = new THREE.Vector3(), _hp = new THREE.Vector3(), _v: Vec3 = { x: 0, y: 0, z: 0 }, _jar = new THREE.Color();
  /** Makes every arena material part of the warm-up compile (then hidden again by the first frame). */
  for (const o of [arc.mesh, sparks.points, chips.points, C.flash]) o.visible = true;
  function syncBoxes() {
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i], x = boxes[i], r = ROOT.radius;
      x.min.x = b.x - r; x.max.x = b.x + r; x.min.z = b.z - r; x.max.z = b.z + r; x.min.y = b.y - 0.5; x.max.y = b.y + 1.9 * b.scale;
    }
  }
  syncBoxes();

  // ---------- Sound placement ----------
  const pan = (x: number, z: number) => { const dx = x - prey.x, dz = z - prey.z, d = Math.hypot(dx, dz) || 1; return (dx * Math.cos(yawNow) - dz * Math.sin(yawNow)) / d; };
  const near = (x: number, z: number) => Math.max(0.15, Math.min(1, 1.25 - Math.hypot(x - prey.x, z - prey.z) / 22));

  function dustAt(x: number, y: number, z: number, n: number, spread: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      chips.spawn(x + Math.cos(a) * r, y + Math.random() * 0.3, z + Math.sin(a) * r, Math.cos(a) * 0.4, 0.5 + Math.random() * 0.6, Math.sin(a) * 0.4,
        0.9 + Math.random() * 0.6, DUST, 1, 0.55, 0.8, y - 0.02);
    }
  }
  function drain() {
    for (const e of events) {
      const b = bots[e.id];
      if (e.type === 'wake') { audio.play('groan', pan(b.x, b.z), near(b.x, b.z)); dustAt(b.x, b.y, b.z, 16, 0.5); }
      else if (e.type === 'tell') audio.play('rootcreak', pan(b.x, b.z), near(b.x, b.z));
      else if (e.type === 'lash') audio.play('lash', pan(b.x, b.z), near(b.x, b.z));
      else if (e.type === 'retreat') audio.play('groan', pan(b.x, b.z), 0.6 * near(b.x, b.z));
      else if (e.type === 'hit' && !down) {
        if (!invulnerable) health = Math.max(0, health - e.damage);
        hurtK = 1; traumaAdd += 0.45;
        rollP += (pan(b.x, b.z) >= 0 ? -3 : 3); punch -= 1.5;   // the head thrown away from the lash
        audio.play('hurt');
        if (health <= 0) { down = true; downT = 0; held = false; audio.play('hurt', undefined, 1.4); }
      }
    }
    events.length = 0;
  }

  /** Distance along the ray to the terrain, Infinity if it stays above it within max. */
  function groundT(o: Vec3, d: Vec3, max: number): number {
    let prev = 0;
    for (let s = 0.5; ; s += 0.5) {
      const t = Math.min(s, max);
      if (o.y + d.y * t < ctx.ground(o.x + d.x * t, o.z + d.z * t)) {
        let lo = prev, hi = t;
        for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (o.y + d.y * m < ctx.ground(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; }
        return hi;
      }
      if (t >= max) return Infinity;
      prev = t;
    }
  }

  function fire(eye: Vec3, dir: Vec3) {
    queued = 0;
    ray.o.x = eye.x; ray.o.y = eye.y; ray.o.z = eye.z; ray.d.x = dir.x; ray.d.y = dir.y; ray.d.z = dir.z;
    const R = CASTER.range, f = ctx.segment(eye.x, eye.y, eye.z, eye.x + dir.x * R, eye.y + dir.y * R, eye.z + dir.z * R);
    let wallT = f <= 1 ? f * R : Infinity;
    wallT = Math.min(wallT, groundT(eye, dir, Math.min(wallT, R)));
    const cranking = caster.reloading > 0;
    castShot(caster, ray, bots, wallT, events, shot);
    if (!shot.fired) {
      if (shot.empty) audio.play('empty');
      if (!cranking && caster.reloading > 0) audio.play('crank', CASTER.reload);
      return;
    }
    shots++;
    hearShot(bots, prey.x, prey.z, events);
    punch += PUNCH; kick = 1; flashT = 0.05; light.intensity = 14; traumaAdd += 0.04;
    C.flash.rotation.z = Math.random() * Math.PI; C.flash.scale.setScalar(0.75 + Math.random() * 0.6);
    audio.play('spark');
    const t = Math.min(shot.t, R);
    _hp.set(eye.x + dir.x * t, eye.y + dir.y * t, eye.z + dir.z * t);
    camera.updateMatrixWorld(true);
    C.muzzle.getWorldPosition(_mw);
    arc.fire(_mw, _hp, camera.position);
    if (shot.bot >= 0) {
      const b = bots[shot.bot];
      hits++; marks++; if (shot.knot) knots++;
      markT = shot.killed ? 0.4 : 0.16; markKill = shot.killed || shot.knot;
      stop = shot.killed ? KILLSTOP : HITSTOP;
      for (let i = 0; i < 12; i++) sparks.spawn(_hp.x, _hp.y, _hp.z, -dir.x * 2 + (Math.random() - 0.5) * 5, Math.random() * 3.5, -dir.z * 2 + (Math.random() - 0.5) * 5,
        0.2 + Math.random() * 0.25, i % 3 ? ELECTRIC : SPARK, 2.2, 1, 9.8, b.y);
      for (let i = 0; i < (shot.killed ? 18 : 9); i++) chips.spawn(_hp.x, _hp.y, _hp.z, -dir.x * 1.5 + (Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, -dir.z * 1.5 + (Math.random() - 0.5) * 3,
        0.8 + Math.random() * 0.8, i % 4 ? CHIP : DUST, 1, 1, 9.8, b.y);
      audio.play('zap', pan(b.x, b.z), near(b.x, b.z));
      if (shot.killed) { kills++; audio.play('rootdie', pan(b.x, b.z), near(b.x, b.z)); dustAt(b.x, b.y, b.z, 22, 0.8); }
    } else if (t < R) {
      const gy = ctx.ground(_hp.x, _hp.z);
      for (let i = 0; i < 8; i++) sparks.spawn(_hp.x - dir.x * 0.03, _hp.y - dir.y * 0.03, _hp.z - dir.z * 0.03, -dir.x * 2.5 + (Math.random() - 0.5) * 4,
        Math.random() * 3, -dir.z * 2.5 + (Math.random() - 0.5) * 4, 0.15 + Math.random() * 0.2, i % 2 ? ELECTRIC : SPARK, 2, 1, 9.8, gy);
      for (let i = 0; i < 3; i++) chips.spawn(_hp.x - dir.x * 0.05, _hp.y - dir.y * 0.05, _hp.z - dir.z * 0.05, (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, DUST, 1, 0.5, 1.5, gy);
    }
    if (!cranking && caster.reloading > 0) audio.play('crank', CASTER.reload);   // the last charge: it cranks by itself
    drain();
  }

  function reset() {
    bots = newBots(ctx.ground); caster = newCaster(); health = 100; kills = shots = hits = knots = marks = 0; down = false; downT = 0;
    stop = queued = punch = rollP = kick = hurtK = markT = flashT = 0; held = false; regrow = -1; view.drop = 0;
    sparks.clear(); chips.clear(); arc.hide(); events.length = 0; dustT.fill(0);
    syncBoxes();
    if (dom) { dom.death.style.display = 'none'; dom.shown = ''; dom.hp = -1; }
  }

  // ---------- HUD (made in start(), after the page hides the Night Shift HUD) ----------
  let dom: { hud: HTMLElement; ammo: HTMLElement; hurt: HTMLElement; death: HTMLElement; mark: HTMLElement; shown: string; hp: number; hurtShown: number; markShown: number } | null = null;
  function start() {
    const css = document.createElement('style');
    css.textContent = [
      'body.arena #crosshair { width: 4px; height: 4px; margin: -2px; opacity: .9; border-radius: 0; }',
      '#hitmark { position: fixed; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; opacity: 0; }',
      '#hitmark i { position: absolute; left: -1px; top: -1px; width: 2px; height: 7px; background: #efe9da; transform-origin: 1px 1px; box-shadow: 0 0 3px #07090C; }',
      '#hitmark i:nth-child(1) { transform: rotate(45deg) translateY(5px); } #hitmark i:nth-child(2) { transform: rotate(135deg) translateY(5px); }',
      '#hitmark i:nth-child(3) { transform: rotate(225deg) translateY(5px); } #hitmark i:nth-child(4) { transform: rotate(315deg) translateY(5px); }',
      '#hitmark.kill i { background: #FFB000; height: 10px; }',
      '#ammo small { font-size: 12px; letter-spacing: 3px; opacity: .75; margin-right: 10px; }',
    ].join('\n');
    document.head.appendChild(css);
    document.body.classList.add('arena');
    const mark = document.createElement('div');
    mark.id = 'hitmark'; mark.innerHTML = '<i></i><i></i><i></i><i></i>';
    document.body.appendChild(mark);
    const $ = (id: string) => document.getElementById(id)!;
    dom = { hud: $('hud'), ammo: $('ammo'), hurt: $('hurt'), death: $('death'), mark, shown: '', hp: -1, hurtShown: -1, markShown: -1 };
    for (const e of [dom.hud, dom.ammo, dom.hurt]) e.style.display = '';
    dom.death.querySelector('h2')!.textContent = 'TAKEN BY THE ROOTS';
    dom.death.querySelector('p')!.textContent = 'أخذته الجذور · R — try again';
    const help = document.createElement('p');
    help.textContent = 'ARENA · root walkers in the square · LMB fire the spark caster · R crank it';
    $('overlay').appendChild(help);
    addEventListener('mousedown', e => { if (e.button === 0 && !down && ctx.live() && e.target === ctx.canvas) { queued = 0.18; held = true; } });
    addEventListener('mouseup', e => { if (e.button === 0) held = false; });
    addEventListener('blur', () => { held = false; });
    addEventListener('keydown', e => {
      if (e.code !== 'KeyR' || e.repeat) return;
      if (down) { if (downT > 0.6) { ctx.respawn(); reset(); } return; }
      if (ctx.live() && reloadCaster(caster)) audio.play('crank', CASTER.reload);
    });
  }

  function hud(dt: number) {
    if (!dom) return;
    if (health !== dom.hp) { dom.hp = health; dom.hud.innerHTML = `<span class="${health <= 25 ? 'low' : ''}">HEALTH ${health}</span>`; }
    const a = caster.reloading > 0 ? '<small>SPARK CASTER</small>CRANKING…' : `<small>SPARK CASTER</small><b>${caster.mag}</b> / ${caster.reserve}`;
    if (a !== dom.shown) { dom.shown = a; dom.ammo.innerHTML = a; }
    hurtK = Math.max(0, hurtK - dt * 2.2);
    const h = Math.round(hurtK * 55) / 100;
    if (h !== dom.hurtShown) { dom.hurtShown = h; dom.hurt.style.opacity = String(h); }
    markT = Math.max(0, markT - dt);
    const m = markT > 0 ? Math.round(Math.min(1, markT / 0.06) * 100) / 100 : 0;
    if (m !== dom.markShown) {
      dom.markShown = m;
      dom.mark.style.opacity = String(m);
      dom.mark.style.transform = `scale(${(1 + markT * 2.2).toFixed(2)})`;
      dom.mark.classList.toggle('kill', markKill);
    }
    if (down && downT > 0.6 && dom.death.style.display !== 'flex') dom.death.style.display = 'flex';
  }

  return {
    view,
    tick(dt, player, height) {
      prey.x = player.pos.x; prey.y = player.pos.y; prey.z = player.pos.z; prey.h = height;
      if (stop > 0 || !ctx.live()) return;   // hitstop: the walkers hold still; paused behind the overlay and the end
      tickBots(bots, prey, world, dt, events);
      if (events.length) drain();
      syncBoxes();
      if (bots.every(gone)) {   // the roots come back: they grow again where they stood
        if (regrow < 0) { regrow = 5; ctx.toast('THE ROOTS WITHDRAW'); }
        if ((regrow -= dt) <= 0 && ROOT_SPAWNS.every(s => Math.hypot(s.x - prey.x, s.z - prey.z) > 3)) {   // never inside him
          regrow = -1; bots = newBots(ctx.ground); syncBoxes();
          caster.reserve = Math.max(caster.reserve, CASTER.reserve);
          ctx.toast('THE ROOTS RETURN');
        }
      }
    },
    frame(dt, eye, dir, bobX, bobY) {
      clock += dt;
      yawNow = Math.atan2(-dir.x, -dir.z); pitchNow = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      const live = ctx.live() && !down;
      stop = Math.max(0, stop - dt);
      tickCaster(caster, dt);
      queued = Math.max(0, queued - dt);
      if (live && (queued > 0 || held) && caster.cooldown <= 0 && caster.reloading <= 0) fire(eye, dir);
      // View punch, dropped like GoldSrc's: (10 + half the angle) degrees per second.
      punch = Math.sign(punch) * Math.max(0, Math.abs(punch) - (10 + Math.abs(punch) * 0.5) * dt);
      rollP = Math.sign(rollP) * Math.max(0, Math.abs(rollP) - (10 + Math.abs(rollP) * 0.5) * dt);
      if (down) { downT += dt; view.drop = Math.min(1.15, view.drop + dt * 2.4); }
      view.pitch = punch * DEG; view.roll = rollP * DEG + (down ? 0.45 * Math.min(1, downT * 2) : 0);

      // Walkers: pose, then the batch. The tell sheds dust from the crown and shoulders (with the creak, the canon tell).
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (gone(b)) { F.set(i, null, 0); continue; }
        const p = botPose(b, poses[i]);
        F.set(i, p, b.y);
        if (b.mode === 'tell' && stop <= 0) {
          dustT[i] += dt;
          for (; dustT[i] > 0.03; dustT[i] -= 0.03) {
            torsoToWorld(p, (Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3, _v);
            chips.spawn(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3, 1.2, DUST, 1.1, 0.7, 1.2, b.y);
          }
        }
      }
      const pdt = stop > 0 ? 0 : dt;   // the hitstop freezes the debris too
      sparks.update(pdt); chips.update(pdt);
      arc.update(dt, camera.position);

      // Viewmodel: bob, sway against the turn, kick on the shot, the crank's dip; the jar shows the charge left.
      const dy = Math.atan2(Math.sin(yawNow - lastYaw), Math.cos(yawNow - lastYaw)), dp = pitchNow - lastPitch;
      lastYaw = yawNow; lastPitch = pitchNow;
      const k = Math.min(1, dt * 12), inv = 1 / Math.max(dt, 1e-3);
      swX += (Math.max(-0.018, Math.min(0.018, -dy * inv * 0.004)) - swX) * k;
      swY += (Math.max(-0.014, Math.min(0.014, -dp * inv * 0.004)) - swY) * k;
      kick = Math.max(0, kick - dt * 8);
      const rl = caster.reloading > 0 ? Math.sin(Math.PI * (1 - caster.reloading / CASTER.reload)) : 0;
      C.group.position.set(REST.x + bobX * 0.5 + swX, REST.y - bobY * 0.35 + swY - rl * 0.03 + kick * 0.006, REST.z + kick * 0.03);
      C.group.rotation.set(AIM.x + kick * 0.16 + rl * 0.25, AIM.y + swX * 3, -rl * 0.35 - swX * 2);
      C.crank.rotation.x = caster.reloading > 0 ? (1 - caster.reloading / CASTER.reload) * Math.PI * 8 : 0;
      C.group.visible = !down;
      const charge = caster.mag / CASTER.mag, pulse = caster.reloading > 0 ? 0.55 + 0.45 * Math.sin(clock * 38) : 1;
      C.jar.color.copy(_jar.copy(KNOT_GLOW).multiplyScalar(0.1 + 0.55 * charge * pulse));
      C.flash.visible = flashT > 0; flashT -= dt;
      light.intensity = light.intensity > 0.05 ? light.intensity * Math.exp(-dt * 45) : 0;
      hud(dt);
    },
    boxes(out) { for (let i = 0; i < bots.length; i++) if (bots[i].mode !== 'dead') out.push(boxes[i]); },
    trauma() { const t = traumaAdd; traumaAdd = 0; return t; },
    down: () => down,
    start,
    reset,
    god() { invulnerable = true; },
    dev() {
      let s = `arena hp ${health}${down ? ' DOWN' : ''}  caster ${caster.mag}/${caster.reserve}${caster.reloading > 0 ? ' crank' : ''}  shots ${shots} hits ${hits} knots ${knots} kills ${kills}  stop ${(stop * 1000).toFixed(0)} ms\nroots`;
      for (const b of bots) s += `  ${b.id}:${b.mode} ${b.health} ${Math.hypot(b.x - prey.x, b.z - prey.z).toFixed(1)}m${b.sees ? ' los' : ''}`;
      return s;
    },
    state() {
      const chest = (b: RootBot) => { const v = torsoToWorld(botPose(b, newPose()), 0, 1.3, -0.05, { x: 0, y: 0, z: 0 }); return { x: v.x, y: v.y, z: v.z }; };
      return {
        health, weapon: 'caster', hasNailer: false, mag: caster.mag, reserve: caster.reserve, kills,
        enemies: bots.map(b => ({ id: b.id, kind: 'root', pos: chest(b), health: b.health, mode: b.mode })),
        arena: {
          shots, hits, knots, marks, down, reloading: caster.reloading > 0, hitstop: stop, tris: F.stats.tris,
          bots: bots.map(b => ({ id: b.id, mode: b.mode, health: b.health, x: b.x, y: b.y, z: b.z, yaw: b.yaw, rise: b.rise, lash: b.lash, chest: chest(b) })),
        },
      };
    },
  };
}
