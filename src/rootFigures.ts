// Root walkers in one draw call (and one for their contact shadows), posed in the vertex shader like the NPC batch
// (src/npcFigures.ts): bark-and-root bodies merged from low-poly primitives, per vertex (walker, part, glow), five vec4
// per walker from the pose in src/rootBots.ts. Seven parts: pelvis, torso (with the head, the crown of bare twigs and
// the knot), two arms, two legs, and the lash, which the shader stretches from the right hand to the tip. The knot
// glows sap amber; the whole body flashes cold when shocked. Also the spark caster's viewmodel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import palette from '../studio/art/palette.json';
import type { Token } from './nightshift';
import { bakeAt, patchBake } from './villageScene';
import { rng, groundY } from './village';
import { ROOT, RIG, KNOT, type Pose } from './rootBots';

const P = (t: Token) => new THREE.Color(palette[t]);
const mix = (a: Token, b: Token, t: number, k = 1) => P(a).lerp(P(b), t).multiplyScalar(k);
const BARK = mix('rust', 'hazardBlack', 0.52, 1.05), DARK = mix('rust', 'hazardBlack', 0.72, 0.95);
const TIP = mix('rust', 'concrete', 0.5, 0.9), MOSS = mix('wallPaint', 'hazardBlack', 0.4, 0.85), SAP = mix('sodium', 'rust', 0.35, 0.9);
/** Emissive, linear HDR: the knot's sap glow, and the cold flash of a shock (also the arc and the muzzle light). */
export const KNOT_GLOW = mix('sodium', 'hudAmber', 0.3, 0.95);
export const ELECTRIC = P('ruptureTeal').lerp(new THREE.Color(1, 1, 1), 0.6);
const TAU = Math.PI * 2;

type V3 = [number, number, number];
interface Piece { g: THREE.BufferGeometry; c: THREE.Color; part: number; glow: number }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
class Kit {
  out: Piece[] = [];
  constructor(private shade: () => number) {}
  /** Every piece a shade apart, so the bark is never one flat colour. */
  put(g: THREE.BufferGeometry, c: THREE.Color, part: number, glow = 0) {
    g.deleteAttribute('uv');
    this.out.push({ g, c: c.clone().multiplyScalar(1 + this.shade()), part, glow });
  }
  seg(a: V3, b: V3, r0: number, r1: number, c: THREE.Color, part: number, sides = 6) {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]).sub(_a);
    const len = _b.length();
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1).translate(0, len / 2, 0);
    _q.setFromUnitVectors(_up, _b.normalize());
    this.put(g.applyMatrix4(_m.compose(_a, _q, _one)), c, part);
  }
  ball(at: V3, r: number, c: THREE.Color, part: number, sc: V3 = [1, 1, 1], w = 7, h = 5, glow = 0) {
    this.put(new THREE.SphereGeometry(r, w, h).scale(sc[0], sc[1], sc[2]).translate(at[0], at[1], at[2]), c, part, glow);
  }
  /** A gnarled burl: a low sphere pushed in and out by a hash of each vertex position (seam copies move together). */
  lump(at: V3, r: number, c: THREE.Color, part: number, sc: V3) {
    const g = new THREE.SphereGeometry(r, 8, 6), pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const h = Math.sin(Math.round(x * 300) * 12.9898 + Math.round(y * 300) * 78.233 + Math.round(z * 300) * 37.719) * 43758.5453;
      const k = 1 + 0.24 * (h - Math.floor(h) - 0.5);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    this.put(g.scale(sc[0], sc[1], sc[2]).translate(at[0], at[1], at[2]), c, part);
  }
}

/** One walker in its rest frame (feet at the origin, facing -Z, its right +X); parts as in the shader. */
function walker(k: Kit, r: () => number) {
  const j = (s: number) => (r() - 0.5) * 2 * s;
  const SX = RIG.shoulder.x, SY = RIG.shoulder.y;
  // Legs (4 left, 5 right) from the hip joints; roots splay from each foot into the ground.
  for (const s of [-1, 1]) {
    const part = s < 0 ? 4 : 5;
    const hip: V3 = [s * RIG.leg.x, RIG.leg.y + 0.04, 0], knee: V3 = [s * (0.17 + j(0.02)), 0.5, -0.07 + j(0.02)], ank: V3 = [s * (0.19 + j(0.02)), 0.09, 0.02];
    k.seg(hip, knee, 0.12, 0.085, BARK, part, 7); k.ball(knee, 0.092, DARK, part); k.seg(knee, ank, 0.085, 0.06, BARK, part, 7);
    k.seg([s * 0.2, 0.86, -0.04], [s * 0.13, 0.36, -0.1 + j(0.02)], 0.028, 0.014, TIP, part, 4);
    k.seg([s * 0.09, 0.88, 0.06], [s * 0.24, 0.32, 0.07 + j(0.02)], 0.03, 0.016, DARK, part, 4);   // a strand wound down the leg
    for (let i = 0; i < 4; i++) {
      const a = (i / 4 + j(0.08)) * TAU, L = 0.22 + r() * 0.14;
      k.seg(ank, [ank[0] + Math.sin(a) * L, -0.05, ank[2] - Math.cos(a) * L], 0.045, 0.01, i % 2 ? TIP : BARK, part, 5);
    }
  }
  k.lump([0, 0.95, 0.01], 0.18, DARK, 0, [1.35, 0.75, 1.05]);   // the pelvis knot where the legs join
  // Torso (1): roots twisted into a trunk, wider at the shoulders, moss on them.
  k.seg([0, 0.9, 0], [0, 1.56, 0.04], 0.18, 0.26, BARK, 1, 8);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + j(0.2);
    k.seg([Math.sin(a) * 0.14, 0.9, Math.cos(a) * 0.11], [Math.sin(a + 1.3) * 0.19, 1.52, Math.cos(a + 1.3) * 0.14 + 0.03], 0.05, 0.042, i % 2 ? DARK : BARK, 1, 5);
  }
  k.ball([0, 1.5, 0.03], 1, BARK, 1, [0.34, 0.12, 0.17], 8, 5);
  for (const s of [-1, 1]) if (r() < 0.7) k.ball([s * (0.14 + j(0.04)), 1.55, 0.07], 0.07, MOSS, 1, [1.4, 0.5, 1.1], 6, 4);
  // The knot in the chest (it glows, it takes double damage), sunk in a ring of dark bark.
  k.ball([0, KNOT.y, KNOT.z + 0.08], 0.14, DARK, 1, [1.15, 1.1, 0.55]);
  k.ball([0, KNOT.y, KNOT.z + 0.03], 0.1, SAP, 1, [1, 1.05, 0.75], 8, 6, 1);
  // A faceless burl of a head and a crown of bare, forked twigs.
  k.seg([0, 1.54, 0.03], [0, 1.68, 0], 0.09, 0.075, BARK, 1, 6);
  k.lump([0, 1.77, -0.02], 0.155, BARK, 1, [0.9, 1.1, 0.95]);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + j(0.25), up = 0.55 + r() * 0.5, L = 0.32 + r() * 0.3;
    const b0: V3 = [Math.sin(a) * 0.07, 1.86, Math.cos(a) * 0.06 - 0.02];
    const tip: V3 = [b0[0] + Math.sin(a) * L * Math.cos(up), b0[1] + L * Math.sin(up), b0[2] + Math.cos(a) * L * Math.cos(up)];
    k.seg(b0, tip, 0.032, 0.01, BARK, 1, 4);
    const f = 0.45 + r() * 0.2, fk: V3 = [b0[0] + (tip[0] - b0[0]) * f, b0[1] + (tip[1] - b0[1]) * f, b0[2] + (tip[2] - b0[2]) * f];
    k.seg(fk, [tip[0] + Math.sin(a + 0.9) * L * 0.4, tip[1] + 0.04, tip[2] + Math.cos(a + 0.9) * L * 0.4], 0.016, 0.006, TIP, 1, 3);
  }
  // Arms (2 left, 3 right): straight down from the shoulder at rest (the pose swings them), long root fingers.
  for (const s of [-1, 1]) {
    const part = s < 0 ? 2 : 3, x = s * SX, sh: V3 = [x, SY, 0], el: V3 = [x, SY - 0.38, 0], wr: V3 = [x, SY - RIG.arm + 0.04, 0];
    k.ball(sh, 0.088, DARK, part);
    k.seg(sh, el, 0.085, 0.065, BARK, part, 6); k.ball(el, 0.07, DARK, part); k.seg(el, wr, 0.065, 0.05, BARK, part, 6);
    k.seg([x + s * 0.05, SY - 0.05, 0.04], [x - s * 0.02, SY - 0.6, 0.05], 0.025, 0.012, DARK, part, 4);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + j(0.3), L = 0.2 + r() * 0.12 + (s > 0 ? 0.06 : 0);
      k.seg(wr, [x + Math.sin(a) * 0.08, wr[1] - L, Math.cos(a) * 0.08 - 0.02], 0.026, 0.006, i % 2 ? TIP : BARK, part, 4);
    }
  }
  // The lash (6): a unit root down -Y from the shoulder pivot; the shader runs it from the hand out to the tip.
  k.put(new THREE.CylinderGeometry(0.06, 0.014, 1, 6, 12).translate(0, -0.5, 0), BARK, 6);
}

// ---------- The batch shader (same rotations as src/rootBots.ts) ----------
const f3 = (n: number) => n.toFixed(4);
const HEAD = [
  'attribute vec2 rbPart;', 'attribute float rbGlow;', 'varying vec2 vRbE;',
  ...['A', 'B', 'C', 'D', 'E'].map(n => `uniform vec4 uRb${n}[ ${ROOT.max} ];`),
  'mat3 rbRx( float a ) { float c = cos( a ), s = sin( a ); return mat3( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c ); }',
  'mat3 rbRy( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c ); }',
  'mat3 rbRz( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0 ); }',
].join('\n');
// uRbA = (x, y, z, yaw); uRbB = (lean, twist, roll, topple); uRbC = (armL, armR, legL, legR);
// uRbD = (armR yaw, spreadL, spreadR, lash length); uRbE = (knot glow, shock flash, scale, -)
const NORMAL = [
  'int rbI = int( rbPart.x + 0.5 ), rbP = int( rbPart.y + 0.5 );',
  'vec4 rbA = uRbA[ rbI ], rbB = uRbB[ rbI ], rbC = uRbC[ rbI ], rbD = uRbD[ rbI ], rbE = uRbE[ rbI ];',
  'mat3 rbT = rbRy( rbB.y ) * rbRx( rbB.x ) * rbRz( rbB.z );',
  'mat3 rbW = rbRy( rbA.w ) * rbRx( rbB.w );',
  'mat3 rbL = mat3( 1.0 );',
  'vec3 rbPv = vec3( 0.0 );',
  `if ( rbP == 2 ) { rbL = rbRx( rbC.x ) * rbRz( rbD.y ); rbPv = vec3( ${f3(-RIG.shoulder.x)}, ${f3(RIG.shoulder.y)}, 0.0 ); }`,
  `else if ( rbP == 3 || rbP == 6 ) { rbL = rbRy( rbD.x ) * rbRx( rbC.y ) * rbRz( rbD.z ); rbPv = vec3( ${f3(RIG.shoulder.x)}, ${f3(RIG.shoulder.y)}, 0.0 ); }`,
  `else if ( rbP == 4 ) { rbL = rbRx( rbC.z ); rbPv = vec3( ${f3(-RIG.leg.x)}, ${f3(RIG.leg.y)}, 0.0 ); }`,
  `else if ( rbP == 5 ) { rbL = rbRx( rbC.w ); rbPv = vec3( ${f3(RIG.leg.x)}, ${f3(RIG.leg.y)}, 0.0 ); }`,
  'bool rbUp = rbP == 1 || rbP == 2 || rbP == 3 || rbP == 6;',
  'objectNormal = rbL * objectNormal;',
  'if ( rbUp ) objectNormal = rbT * objectNormal;',
  'objectNormal = rbW * objectNormal;',
].join('\n');
const POSITION = [
  'vec3 rbV = transformed;',
  // The lash's rest geometry runs y 0..-1 from the pivot: lay it from the hand (arm length) to the tip, with a slight
  // bow that is zero at both ends (the tip stays where src/rootBots.ts lashTip puts it).
  `if ( rbP == 6 ) { float rbS = -rbV.y, rbLen = max( rbD.w, ${f3(RIG.arm)} ); rbV = vec3( rbV.x + 0.45 * rbS * ( 1.0 - rbS ) * ( rbLen - ${f3(RIG.arm)} ), -mix( ${f3(RIG.arm)}, rbLen, rbS ), rbV.z ) + rbPv; }`,
  'rbV = rbL * ( rbV - rbPv ) + rbPv;',
  `if ( rbUp ) rbV = rbT * ( rbV - vec3( 0.0, ${f3(RIG.hip)}, 0.0 ) ) + vec3( 0.0, ${f3(RIG.hip)}, 0.0 );`,
  'transformed = rbW * ( rbV * rbE.z ) + rbA.xyz;',
  'vRbE = vec2( rbGlow * rbE.x, rbE.y );',
].join('\n');

export interface RootFigures {
  mesh: THREE.Mesh;
  shadows: THREE.Mesh;
  /** Poses slot i for this frame (null hides it); gy is the ground under it. No allocation. */
  set(i: number, p: Pose | null, gy: number): void;
  stats: { tris: number; verts: number };
}

export function buildRootFigures(scene: THREE.Scene, n: number, env: THREE.Texture): RootFigures {
  if (n > ROOT.max) throw new Error(`rootFigures: ${n} walkers > ROOT.max ${ROOT.max}`);
  const vec = () => Array.from({ length: ROOT.max }, () => new THREE.Vector4(0, -100, 0, 0));
  const U = { uRbA: { value: vec() }, uRbB: { value: vec() }, uRbC: { value: vec() }, uRbD: { value: vec() }, uRbE: { value: vec() } };
  for (const v of U.uRbE.value) v.set(0, 0, 0, 0);
  // Bake (sky occlusion, bounce) at a standing rest pose in the open square: the walkers move, so no spot is theirs.
  const RX = 40, RZ = 48, RY = groundY(RX, RZ), bake: [number, number] = [1, 0];
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng(1013 + 7919 * i), k = new Kit(() => (r() - 0.5) * 0.16);
    walker(k, r);
    for (const pc of k.out) {
      const g = pc.g, pos = g.getAttribute('position'), nor = g.getAttribute('normal'), cnt = pos.count;
      const col = new Float32Array(cnt * 3), bk = new Float32Array(cnt * 2), part = new Float32Array(cnt * 2), glow = new Float32Array(cnt);
      for (let v = 0; v < cnt; v++) {
        bakeAt(RX + pos.getX(v), RY + pos.getY(v), RZ + pos.getZ(v), nor.getX(v), nor.getY(v), nor.getZ(v), bake);
        bk[v * 2] = bake[0]; bk[v * 2 + 1] = bake[1];
        col[v * 3] = pc.c.r; col[v * 3 + 1] = pc.c.g; col[v * 3 + 2] = pc.c.b;
        part[v * 2] = i; part[v * 2 + 1] = pc.part; glow[v] = pc.glow;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('bake', new THREE.BufferAttribute(bk, 2));
      g.setAttribute('rbPart', new THREE.BufferAttribute(part, 2));
      g.setAttribute('rbGlow', new THREE.BufferAttribute(glow, 1));
      geos.push(g);
    }
  }
  const geo = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  const mat = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    { key: 'roots', uniforms: U, head: HEAD, normal: NORMAL, position: POSITION });
  const bakeCompile = mat.onBeforeCompile, UF = { uRbKnot: { value: KNOT_GLOW }, uRbFlash: { value: P('ruptureTeal').lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.45) } };
  mat.onBeforeCompile = (s, renderer) => {
    bakeCompile.call(mat, s, renderer);
    Object.assign(s.uniforms, UF);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRbE;\nuniform vec3 uRbKnot, uRbFlash;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRbKnot * vRbE.x + uRbFlash * vRbE.y;');
  };
  mat.envMap = env; mat.envMapIntensity = 1.6;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;            // posed in the vertex shader: the CPU bounds are the rest pose at the origin
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = true;             // the static sun map is drawn without them; they take its shade
  scene.add(mesh);

  // Contact shadows: a soft dark disc under each, moved and scaled in the vertex shader. One transparent draw.
  const S = { value: Array.from({ length: ROOT.max }, () => new THREE.Vector4(0, -100, 0, 0)) };
  const discs = Array.from({ length: n }, (_, i) => {
    const g = new THREE.CircleGeometry(0.62, 18).rotateX(-Math.PI / 2);
    const cnt = g.getAttribute('position').count, c = new Float32Array(cnt * 4);
    for (let v = 0; v < cnt; v++) c[v * 4 + 3] = v === 0 ? 0.55 : 0;
    g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    g.setAttribute('rbIdx', new THREE.BufferAttribute(new Float32Array(cnt).fill(i), 1));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    return g;
  });
  const dmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  dmat.onBeforeCompile = s => {
    s.uniforms.uRbS = S;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float rbIdx;\nuniform vec4 uRbS[ ${ROOT.max} ];`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 rbS = uRbS[ int( rbIdx + 0.5 ) ];\ntransformed = transformed * rbS.w + rbS.xyz;');
  };
  dmat.customProgramCacheKey = () => 'root-discs';
  const shadows = new THREE.Mesh(mergeGeometries(discs)!, dmat);
  for (const g of discs) g.dispose();
  shadows.matrixAutoUpdate = false; shadows.frustumCulled = false;
  scene.add(shadows);

  return {
    mesh, shadows,
    stats: { tris: (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3, verts: geo.getAttribute('position').count },
    set(i, p, gy) {
      if (!p) { U.uRbA.value[i].set(0, -100, 0, 0); U.uRbE.value[i].set(0, 0, 0, 0); S.value[i].set(0, -100, 0, 0); return; }
      U.uRbA.value[i].set(p.x, p.y, p.z, p.yaw);
      U.uRbB.value[i].set(p.lean, p.twist, p.roll, p.topple);
      U.uRbC.value[i].set(p.armL, p.armR, p.legL, p.legR);
      U.uRbD.value[i].set(p.armRYaw, p.spreadL, p.spreadR, p.lash);
      U.uRbE.value[i].set(p.glow, p.flash, p.scale, 0);
      S.value[i].set(p.x, gy + 0.015, p.z, p.scale * Math.max(0, 1 - Math.max(0, gy - p.y) / 1.2) * (1 - 0.3 * Math.min(1, p.topple)));
    },
  };
}

// ---------- The spark caster (viewmodel, camera space, -Z forward) ----------
export interface CasterModel {
  group: THREE.Group;              // the arena places, kicks and sways it
  crank: THREE.Object3D;           // turns about x while cranking
  jar: THREE.MeshBasicMaterial;    // the capacitor jar's glow: charge left
  flash: THREE.Mesh;               // the arc between the prongs, a frame or two per shot
  muzzle: THREE.Object3D;          // where the arc leaves
}
/** A cattle-fence energiser and a glass jar capacitor bolted to a wooden stock, a copper coil, two copper prongs the
 *  spark jumps between, a crank on the right side. Built from boxes and cylinders, two materials (wood, metal). */
export function buildCaster(env: THREE.Texture): CasterModel {
  const WOOD = mix('rust', 'hazardBlack', 0.25, 1.1), WOOD_D = mix('rust', 'hazardBlack', 0.5, 1.0), COPPER = mix('rust', 'sodium', 0.4, 1.15);
  const VARNISH = mix('rust', 'hazardBlack', 0.65, 0.9), BRASS = mix('hazardYellow', 'rust', 0.45, 0.95), IRON = mix('metal', 'hazardBlack', 0.45, 1.0);
  const lists = { wood: [] as THREE.BufferGeometry[], metal: [] as THREE.BufferGeometry[], crank: [] as THREE.BufferGeometry[] };
  type L = keyof typeof lists;
  const add = (l: L, g: THREE.BufferGeometry, c: THREE.Color) => {
    g.deleteAttribute('uv');
    const n = g.getAttribute('position').count, col = new Float32Array(n * 3), bk = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; bk[i * 2] = 1; bk[i * 2 + 1] = 0.5; }   // open sky and a warm bounce: held up in front, never crushed black
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('bake', new THREE.BufferAttribute(bk, 2));
    lists[l].push(g);
  };
  const box = (l: L, c: THREE.Color, s: V3, at: V3, rx = 0) => add(l, new THREE.BoxGeometry(s[0], s[1], s[2]).rotateX(rx).translate(at[0], at[1], at[2]), c);
  const cylZ = (l: L, c: THREE.Color, r: number, len: number, at: V3, sides = 12) =>
    add(l, new THREE.CylinderGeometry(r, r, len, sides).rotateX(-Math.PI / 2).translate(at[0], at[1], at[2]), c);
  const rod = (l: L, c: THREE.Color, a: V3, b: V3, r0: number, r1: number) => {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]).sub(_a);
    const len = _b.length(), g = new THREE.CylinderGeometry(r1, r0, len, 6, 1).translate(0, len / 2, 0);
    _q.setFromUnitVectors(_up, _b.normalize());
    add(l, g.applyMatrix4(_m.compose(_a, _q, _one)), c);
  };
  box('wood', WOOD, [0.046, 0.05, 0.17], [0, 0, -0.045]);                // the stock
  box('wood', WOOD_D, [0.036, 0.1, 0.05], [0, -0.06, 0.03], 0.3);        // the grip, raked back
  for (let i = 0; i < 7; i++) cylZ('metal', i % 2 ? VARNISH : COPPER, 0.021, 0.0112, [0, 0.04, -0.035 - i * 0.0115]);   // coil windings
  for (const z of [-0.028, -0.118]) cylZ('metal', BRASS, 0.025, 0.006, [0, 0.04, z]);
  for (const s of [-1, 1]) {   // the prongs
    rod('metal', COPPER, [s * 0.014, 0.04, -0.12], [s * 0.005, 0.04, -0.2], 0.005, 0.0035);
    add('metal', new THREE.SphereGeometry(0.0065, 6, 4).translate(s * 0.005, 0.04, -0.2), BRASS);
  }
  box('metal', IRON, [0.03, 0.034, 0.055], [0.037, 0.004, -0.02]);      // the energiser
  add('metal', new THREE.CylinderGeometry(0.0145, 0.0145, 0.007, 12).translate(-0.034, 0.05, -0.01), BRASS);   // the jar's cap
  rod('metal', VARNISH, [-0.034, 0.053, -0.01], [-0.012, 0.058, -0.032], 0.0025, 0.0025);
  rod('metal', VARNISH, [0.034, 0.022, -0.04], [0.014, 0.05, -0.06], 0.0025, 0.0025);
  box('metal', IRON, [0.006, 0.02, 0.008], [0, -0.034, 0.002]);         // the trigger
  box('crank', IRON, [0.005, 0.045, 0.01], [0.004, -0.02, 0]);
  add('crank', new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 8).rotateZ(Math.PI / 2).translate(0.014, -0.04, 0), WOOD_D);

  const wood = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }));
  const metal = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.85 }));
  metal.envMap = env; metal.envMapIntensity = 1.4;
  const mk = (l: L, m: THREE.Material) => { const g = mergeGeometries(lists[l])!; for (const x of lists[l]) x.dispose(); const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.receiveShadow = true; return o; };
  const group = new THREE.Group();
  const crank = new THREE.Group();
  crank.position.set(0.054, 0.004, -0.02);
  crank.add(mk('crank', metal));
  group.add(mk('wood', wood), mk('metal', metal), crank);
  const jar = new THREE.MeshBasicMaterial({ color: KNOT_GLOW, toneMapped: false });
  const jarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.034, 12).translate(-0.034, 0.03, -0.01), jar);
  jarMesh.frustumCulled = false;
  group.add(jarMesh);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.04, -0.205);
  group.add(muzzle);
  // The flash: a seven-pointed star of light at the prongs (additive: the tips fade to black, so to nothing).
  const pts = [0, 0, 0], cols = [1, 1, 1], idx: number[] = [], spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const a = i / (spikes * 2) * TAU, r = i % 2 ? 0.011 : 0.042;
    pts.push(Math.cos(a) * r, Math.sin(a) * r, 0); cols.push(i % 2 ? 0.45 : 0, i % 2 ? 0.45 : 0, i % 2 ? 0.45 : 0);
    idx.push(0, 1 + i, 1 + (i + 1) % (spikes * 2));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); sg.setIndex(idx);
  const flash = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: ELECTRIC.clone().multiplyScalar(3), vertexColors: true, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false }));
  flash.position.copy(muzzle.position); flash.frustumCulled = false; flash.renderOrder = 2;
  group.add(flash);
  return { group, crank, jar, flash, muzzle };
}
