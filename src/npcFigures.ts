// Village NPC figures: every actor in one draw call, plus one for the soft contact shadows. Each figure is a few dozen
// low-poly primitives merged once: vertex colours from palette.json, the set's baked sky occlusion and bounce taken at
// its rest pose (villageScene bakeAt), and per vertex (actor, part). The vertex shader poses them from three small
// uniform arrays (body position and yaw; head yaw and pitch, breath, weight shift; neck pivot, scale, waist), so a
// frame costs 3 x 16 vec4 and no geometry upload. Silhouettes carry the roles: cassock, peaked caps, a flat cap and
// hands on hips, headscarves and aprons, a chair and handcuffs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import palette from '../studio/art/palette.json';
import type { Token } from './nightshift';
import { bakeAt, patchBake } from './villageScene';
import { CAST, type Actor, type Figure } from './npcTalk';
import { rng } from './village';

export const NPC_MAX = 16;
const P = (t: Token) => new THREE.Color(palette[t]);
const mix = (a: Token, b: Token, t: number, k = 1) => P(a).lerp(P(b), t).multiplyScalar(k);
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

// ---------- Colours (palette only; muted, no teal: teal is the rupture) ----------
const SKIN = [mix('sodium', 'concrete', 0.6, 0.62), mix('sodium', 'concrete', 0.55, 0.5), mix('sodium', 'concrete', 0.66, 0.72), mix('sodium', 'rust', 0.45, 0.46)];
const HAIR = { brown: mix('ink', 'rust', 0.35, 1.0), black: mix('ink', 'hazardBlack', 0.5, 1.6), grey: mix('concrete', 'concreteDark', 0.45, 1.0), white: mix('concrete', 'hudAmber', 0.05, 1.7) };
const C = {
  navy: mix('skyNight', 'metal', 0.3, 1.6), navyDark: mix('skyNight', 'metal', 0.12, 1.25), shirtBlue: mix('metal', 'concrete', 0.55, 1.45),
  black: mix('hazardBlack', 'ink', 0.4, 1.7), white: mix('concrete', 'hudAmber', 0.06, 2.5), gold: mix('hudAmber', 'rust', 0.3, 0.85),
  steel: mix('metal', 'concrete', 0.4, 1.9), timber: mix('rust', 'concrete', 0.55, 0.8), timberDark: mix('rust', 'hazardBlack', 0.45, 1.05),
  leather: mix('hazardBlack', 'rust', 0.3, 1.15), boots: mix('rust', 'hazardBlack', 0.6, 0.6), jeans: mix('skyNight', 'metal', 0.55, 1.25),
  olive: mix('rust', 'wallPaint', 0.45, 0.8), trousers: mix('concreteDark', 'skyNight', 0.4, 0.9), cap: mix('rust', 'concreteDark', 0.5, 0.55),
  green: mix('wallPaint', 'skyNight', 0.35, 0.75), apron: mix('concrete', 'hudAmber', 0.1, 1.55), maroon: mix('rust', 'emergencyRed', 0.35, 0.75),
  mourning: mix('rust', 'fogHaze', 0.55, 0.55), slate: mix('fogHaze', 'concrete', 0.4, 1.15), cloth: mix('concrete', 'hudAmber', 0.04, 1.8),
  paper: mix('concrete', 'hudAmber', 0.12, 2.0), grey: mix('concrete', 'concreteDark', 0.5, 0.9),
};
const COATS = [mix('concreteDark', 'rust', 0.3, 1.0), mix('wallPaint', 'concreteDark', 0.5, 0.8), mix('rust', 'hazardBlack', 0.35, 0.9), mix('fogHaze', 'concrete', 0.3, 1.2)];
const SCARVES = [mix('fogHaze', 'concrete', 0.35, 1.1), mix('rust', 'hudAmber', 0.25, 0.7), C.maroon];

type V3 = [number, number, number];
type Arms = 'side' | 'behind' | 'hips' | 'clasp' | 'fold' | 'paper' | 'cloth' | 'cane' | 'cuffed';
interface Dress {
  skin: THREE.Color; hair: THREE.Color; hairStyle: 'short' | 'thin' | 'none';
  top: THREE.Color; sleeves?: THREE.Color; bottom: THREE.Color; shoes: THREE.Color;
  lower: 'trousers' | 'robe' | 'skirt'; stockings?: THREE.Color; coat?: boolean;
  apron?: THREE.Color; shawl?: THREE.Color; collar?: THREE.Color; cross?: boolean; belt?: THREE.Color; holster?: boolean; tie?: boolean;
  hat: 'none' | 'peaked' | 'flat' | 'scarf'; hatCol?: THREE.Color; band?: THREE.Color;
  arms: Arms; seated?: boolean; stoop?: number; moustache?: THREE.Color; stubble?: boolean;
  height: number; girth: number;
}

function dressFor(f: Figure, id: string, r: () => number): Dress {
  const base = { skin: pick(r, SKIN), hair: HAIR.brown, hairStyle: 'short' as const, shoes: C.black, lower: 'trousers' as const, hat: 'none' as const, arms: 'side' as Arms, height: 1.75, girth: 1 };
  switch (f) {
    case 'priest': return { ...base, hair: HAIR.grey, hairStyle: 'thin', top: C.black, bottom: C.black, lower: 'robe', collar: C.white, cross: true, arms: 'clasp', height: 1.74, girth: 1.05 };
    case 'officer': return { ...base, hair: HAIR.black, top: C.navy, bottom: C.navyDark, belt: C.black, holster: true, tie: true, hat: 'peaked', hatCol: C.navy, band: C.black,
      arms: id.endsWith('1') ? 'behind' : 'fold', height: 1.78 };
    case 'chief': return { ...base, hair: HAIR.grey, top: C.navy, bottom: C.navyDark, coat: true, belt: C.black, tie: true, hat: 'peaked', hatCol: C.navy, band: C.gold,
      moustache: HAIR.grey, arms: 'paper', height: 1.8, girth: 1.14 };
    case 'farmer': return { ...base, skin: SKIN[3], hair: HAIR.grey, top: C.olive, bottom: C.trousers, shoes: C.boots, coat: true, hat: 'flat', hatCol: C.cap, arms: 'hips', height: 1.76, girth: 1.06 };
    case 'wife': return { ...base, top: C.green, bottom: C.green, lower: 'skirt', stockings: C.black, apron: C.apron, hat: 'scarf', hatCol: C.maroon, arms: 'fold', height: 1.64, girth: 1.06, hairStyle: 'none' };
    case 'maryam': return { ...base, skin: SKIN[2], top: C.mourning, bottom: C.mourning, lower: 'robe', hat: 'scarf', hatCol: C.slate, shawl: C.slate, arms: 'cloth', height: 1.66, hairStyle: 'none' };
    case 'omar': return { ...base, hair: HAIR.black, top: C.leather, bottom: C.jeans, shoes: C.boots, seated: true, arms: 'cuffed', stubble: true, height: 1.8 };
    case 'elia': return { ...base, top: C.green, bottom: C.jeans, arms: 'side', height: 1.68 };
    case 'woman': return { ...base, top: pick(r, COATS), bottom: C.trousers, lower: 'skirt', stockings: C.black, hat: 'scarf', hatCol: pick(r, SCARVES), arms: r() < 0.5 ? 'clasp' : 'fold', height: 1.63 + r() * 0.05, girth: 1 + r() * 0.08, hairStyle: 'none' };
    case 'widow': return { ...base, skin: SKIN[0], top: C.mourning, bottom: C.mourning, lower: 'robe', hat: 'scarf', hatCol: C.black, shawl: C.black, arms: 'clasp', stoop: 0.16, height: 1.58, hairStyle: 'none' };
    case 'elder': return { ...base, hair: HAIR.white, top: C.navyDark, sleeves: C.white, bottom: C.grey, hat: 'flat', hatCol: C.grey, moustache: HAIR.white, arms: 'cane', stoop: 0.12, height: 1.7 };
    default: {   // 'man': a coat, sometimes a flat cap
      const capped = r() < 0.5;
      return { ...base, hair: r() < 0.5 ? HAIR.black : HAIR.brown, top: pick(r, COATS), bottom: r() < 0.5 ? C.trousers : C.jeans, shoes: r() < 0.5 ? C.black : C.boots,
        coat: r() < 0.5, hat: capped ? 'flat' : 'none', hatCol: C.cap, arms: pick(r, ['side', 'hips', 'fold', 'behind'] as const), height: 1.72 + r() * 0.08, girth: 0.97 + r() * 0.12 };
    }
  }
}

// ---------- Primitive kit (local frame: feet at the origin, facing -Z, the figure's right is +X) ----------
interface Piece { g: THREE.BufferGeometry; c: THREE.Color; p: number }
const LEGS = 0, TORSO = 1, HEAD = 2, ARMS = 3;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
class Kit {
  out: Piece[] = [];
  put(g: THREE.BufferGeometry, c: THREE.Color, p: number) { g.deleteAttribute('uv'); this.out.push({ g, c, p }); }
  box(at: V3, s: V3, c: THREE.Color, p: number, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rx, ry, rz, 'YXZ')).setPosition(at[0], at[1], at[2]));
    this.put(g, c, p);
  }
  ball(at: V3, r: number, c: THREE.Color, p: number, sc: V3 = [1, 1, 1], w = 10, h = 7) {
    this.put(new THREE.SphereGeometry(r, w, h).scale(sc[0], sc[1], sc[2]).translate(at[0], at[1], at[2]), c, p);
  }
  /** Sphere cap from the top pole down `theta`, tilted back by `tilt` (hair, a headscarf). */
  cap(at: V3, r: number, theta: number, tilt: number, c: THREE.Color, p: number, sc: V3 = [1, 1, 1]) {
    this.put(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, theta).scale(sc[0], sc[1], sc[2]).rotateX(tilt).translate(at[0], at[1], at[2]), c, p);
  }
  seg(a: V3, b: V3, r0: number, r1: number, c: THREE.Color, p: number, sides = 7) {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]).sub(_a);
    const len = _b.length(), g = new THREE.CylinderGeometry(r1, r0, len, sides, 1).translate(0, len / 2, 0);
    _q.setFromUnitVectors(_up, _b.normalize());
    this.put(g.applyMatrix4(_m.compose(_a, _q, _one)), c, p);
  }
  /** Tapered elliptic tube along y (torso, skirt, robe). */
  tube(y0: number, y1: number, r0: number, r1: number, c: THREE.Color, p: number, depth = 0.7, sides = 10, z = 0, w = 1) {
    this.put(new THREE.CylinderGeometry(r1, r0, y1 - y0, sides, 1).scale(w, 1, depth).translate(0, (y0 + y1) / 2, z), c, p);
  }
  limb(a: V3, b: V3, c: V3, r: [number, number, number], col: THREE.Color, p: number) {
    this.seg(a, b, r[0], r[1], col, p); this.ball(b, r[1], col, p, [1, 1, 1], 6, 4); this.seg(b, c, r[1], r[2], col, p);
  }
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dirOf = (a: V3, b: V3): V3 => { const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };

const HIP_Y = 0.94, NECK: V3 = [0, 1.52, 0];
/** Arm targets (elbow, wrist) per side s (+1 = the figure's right), upright frame. */
function armPose(a: Arms, s: number): [V3, V3] {
  switch (a) {
    case 'behind': return [[s * 0.23, 1.13, 0.085], [s * 0.075, 0.98, 0.165]];
    case 'hips': return [[s * 0.37, 1.17, 0.03], [s * 0.2, 1.01, 0.0]];
    case 'clasp': return [[s * 0.215, 1.13, -0.05], [s * 0.045, 1.02, -0.175]];
    case 'fold': return [[s * 0.215, 1.18, -0.055], [-s * 0.075, 1.27 + s * 0.012, -0.165 + s * 0.008]];
    case 'paper': return [[s * 0.2, 1.12, -0.12], [s * 0.12, 1.16, -0.31]];
    case 'cloth': return s > 0 ? [[0.22, 1.15, -0.07], [0.05, 1.31, -0.15]] : [[-0.22, 1.13, -0.045], [-0.06, 1.03, -0.18]];
    case 'cane': return s > 0 ? [[0.25, 1.12, -0.04], [0.23, 0.9, -0.2]] : [[-0.235, 1.12, 0.02], [-0.25, 0.87, -0.01]];
    default: return [[s * 0.235, 1.12, 0.02], [s * 0.25, 0.87, -0.01]];
  }
}

/** Builds one person into the kit; returns the neck pivot (y, z) and the waist height, before the height scale. */
function person(k: Kit, d: Dress): { neck: [number, number]; waist: number } {
  const g = d.girth, sk = d.skin;
  // ----- Lower body -----
  if (d.seated) {
    k.box([0, 0.455, 0.02], [0.44, 0.05, 0.42], C.timber, LEGS);                       // the chair
    for (const [x, z] of [[-0.19, -0.16], [0.19, -0.16], [-0.19, 0.2], [0.19, 0.2]]) k.seg([x, 0, z], [x, 0.43, z], 0.02, 0.02, C.timberDark, LEGS, 5);
    for (const x of [-0.19, 0.19]) k.seg([x, 0.43, 0.215], [x, 0.95, 0.24], 0.02, 0.018, C.timberDark, LEGS, 5);
    k.box([0, 0.86, 0.235], [0.42, 0.11, 0.025], C.timber, LEGS, -0.05);
    k.box([0, 0.55, 0.03], [0.33 * g, 0.15, 0.22], d.bottom, LEGS);
    for (const s of [-1, 1]) {
      k.limb([s * 0.095, 0.55, 0.02], [s * 0.115, 0.56, -0.39], [s * 0.12, 0.085, -0.42], [0.082, 0.062, 0.046], d.bottom, LEGS);
      k.box([s * 0.12, 0.04, -0.465], [0.1, 0.075, 0.25], d.shoes, LEGS);
    }
  } else {
    if (d.lower === 'robe') {
      k.tube(0.03, 1.0, 0.27 * g, 0.165 * g, d.bottom, LEGS, 0.8, 12);
      for (const s of [-1, 1]) k.box([s * 0.08, 0.035, -0.16], [0.1, 0.07, 0.14], d.shoes, LEGS);
    } else {
      const leg = d.lower === 'skirt' ? d.stockings ?? d.bottom : d.bottom;
      for (const s of [-1, 1]) {
        const knee: V3 = [s * 0.1, 0.5, s > 0 ? -0.035 : -0.01];
        if (d.lower === 'skirt') k.limb([s * 0.085, 0.62, 0], knee, [s * 0.1, 0.085, 0], [0.06, 0.05, 0.042], leg, LEGS);
        else k.limb([s * 0.095, 0.9, 0], knee, [s * 0.105, 0.085, 0], [0.082 * g, 0.06, 0.046], leg, LEGS);
        k.box([s * 0.105, 0.04, -0.045], [0.1, 0.075, 0.25], d.shoes, LEGS);
      }
      if (d.lower === 'skirt') k.tube(0.36, 1.0, 0.26 * g, 0.165 * g, d.bottom, LEGS, 0.8, 12);
      else k.box([0, HIP_Y, 0], [0.33 * g, 0.17, 0.21 * g], d.bottom, LEGS);
    }
    if (d.apron) { k.box([0, 0.72, -0.18 * g], [0.32, 0.56, 0.012], d.apron, LEGS, 0.12); }
  }
  // ----- Upper body (upright frame), then seated / stooped by one transform about the hip -----
  const u0 = k.out.length;
  k.tube(0.98, 1.42, 0.155 * g, 0.19 * g, d.top, TORSO, 0.62 * g, 8);
  k.ball([0, 1.395, 0], 1, d.top, TORSO, [0.215 * g, 0.08, 0.125 * g], 10, 6);           // shoulders
  if (d.coat) k.tube(0.7, 1.02, 0.205 * g, 0.172 * g, d.top, TORSO, 0.68 * g, 10);
  if (d.belt) { k.tube(0.98, 1.025, 0.163 * g, 0.163 * g, d.belt, TORSO, 0.64 * g, 10); if (d.holster) k.box([0.19 * g, 0.94, 0.03], [0.06, 0.13, 0.06], d.belt, TORSO); }
  if (d.tie) { k.box([0, 1.44, -0.082 * g], [0.12, 0.05, 0.03], C.shirtBlue, TORSO, -0.25); k.box([0, 1.33, -0.112 * g], [0.03, 0.17, 0.01], C.navyDark, TORSO, -0.12); }
  if (d.apron) k.box([0, 1.2, -0.122 * g], [0.22, 0.2, 0.012], d.apron, TORSO, -0.12);
  if (d.cross) { k.box([0, 1.26, -0.122 * g], [0.012, 0.06, 0.006], C.gold, TORSO, -0.1); k.box([0, 1.272, -0.123 * g], [0.035, 0.011, 0.006], C.gold, TORSO, -0.1); }
  if (d.shawl) k.tube(1.24, 1.5, 0.235 * g, 0.12, d.shawl, TORSO, 0.72, 12);
  k.seg([0, 1.42, 0.005], [0, 1.535, 0], 0.048, 0.046, sk, TORSO, 7);                   // neck
  if (d.collar) k.tube(1.46, 1.49, 0.056, 0.056, d.collar, TORSO, 0.95, 10);
  // Head (turns about the neck pivot)
  const hy = 1.625, face = -0.105;
  k.ball([0, hy, -0.005], 0.105, sk, HEAD, [0.92, 1.1, 1.02], 10, 8);
  k.box([0, 1.607, face - 0.008], [0.026, 0.042, 0.035], sk.clone().multiplyScalar(0.93), HEAD, -0.25);   // nose
  for (const s of [-1, 1]) {
    k.box([s * 0.037, 1.643, face + 0.006], [0.024, 0.012, 0.01], C.black, HEAD);                         // eyes
    k.box([s * 0.037, 1.662, face + 0.004], [0.038, 0.009, 0.012], d.hairStyle === 'none' ? sk.clone().multiplyScalar(0.7) : d.hair, HEAD);
    k.box([s * 0.098, 1.62, 0.005], [0.02, 0.045, 0.03], sk.clone().multiplyScalar(0.95), HEAD);           // ears
  }
  k.box([0, 1.571, face + 0.001], [0.04, 0.008, 0.01], sk.clone().lerp(C.maroon, 0.35).multiplyScalar(0.8), HEAD);
  if (d.moustache) k.box([0, 1.586, face - 0.004], [0.062, 0.015, 0.016], d.moustache, HEAD);
  if (d.stubble) k.ball([0, 1.565, -0.055], 0.075, d.hair.clone().lerp(sk, 0.55), HEAD, [1, 0.62, 0.78], 8, 5);
  if (d.hairStyle !== 'none') k.cap([0, 1.633, 0.008], 0.111, Math.PI * 0.56, d.hairStyle === 'thin' ? 0.95 : 0.6, d.hair, HEAD, [0.95, 1.06, 1.04]);
  if (d.hat === 'peaked') {
    const hc = d.hatCol!;
    k.tube(1.69, 1.765, 0.116, 0.116, hc, HEAD, 1.05, 12, 0.005);
    k.tube(1.76, 1.79, 0.13, 0.131, hc, HEAD, 1.08, 12, -0.004);
    k.tube(1.69, 1.716, 0.118, 0.118, d.band ?? C.black, HEAD, 1.06, 12, 0.005);
    k.box([0, 1.695, -0.15], [0.17, 0.012, 0.075], C.black, HEAD, -0.25);              // visor
    k.box([0, 1.74, -0.118], [0.03, 0.03, 0.01], C.gold, HEAD);                        // badge
  } else if (d.hat === 'flat') {
    k.ball([0, 1.715, -0.012], 0.125, d.hatCol!, HEAD, [1.0, 0.36, 1.1], 10, 5);
    k.box([0, 1.7, -0.13], [0.17, 0.014, 0.065], d.hatCol!, HEAD, -0.12);
  } else if (d.hat === 'scarf') {
    // A cap round the head with the pole at the back: an oval of face open (45 deg, centred a little low), brow to
    // chin; then the drape to the shoulders.
    k.cap([0, 1.625, 0.006], 0.122, Math.PI * 0.75, Math.PI / 2 - 0.09, d.hatCol!, HEAD, [0.98, 1.1, 1.0]);
    k.tube(1.33, 1.53, 0.2 * g, 0.11, d.hatCol!, TORSO, 0.82, 12, 0.025);
  }
  const lean = d.seated ? 0.36 : d.stoop ?? 0;
  const U = new THREE.Matrix4().makeTranslation(0, HIP_Y + (d.seated ? -0.39 : 0), d.seated ? 0.03 : 0)
    .multiply(new THREE.Matrix4().makeRotationX(-lean)).multiply(new THREE.Matrix4().makeTranslation(0, -HIP_Y, 0));
  for (let i = u0; i < k.out.length; i++) k.out[i].g.applyMatrix4(U);
  const tv = (p: V3): V3 => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(U); return [v.x, v.y, v.z]; };
  // ----- Arms (built in the final frame) -----
  for (const s of [-1, 1]) {
    const sh = tv([s * 0.205 * g, 1.385, 0]);
    let [el, wr] = armPose(d.arms, s);
    if (d.arms === 'cuffed') { el = [s * 0.21, 0.74, -0.27]; wr = [s * 0.04, 0.6, -0.4]; }
    else { el = tv(el); wr = tv(wr); }
    const sl = d.sleeves ?? d.top;
    k.limb(sh, el, wr, [0.052, 0.045, 0.037], sl, ARMS);
    const dir = dirOf(el, wr);
    k.ball(add(wr, dir, 0.05), 0.045, sk, ARMS, [0.8, 1.15, 0.65], 7, 5);               // hand
    if (d.arms === 'cuffed') {
      k.seg(add(wr, dir, -0.015), add(wr, dir, 0.02), 0.043, 0.043, C.steel, ARMS, 8);
      if (s > 0) k.seg(add(wr, dir, 0.0), add([-wr[0], wr[1], wr[2]], dir, 0.0), 0.007, 0.007, C.steel, ARMS, 4);
    }
  }
  if (d.arms === 'paper') k.box(tv([0, 1.19, -0.335]), [0.3, 0.21, 0.004], C.paper, ARMS, -0.65 - lean);
  if (d.arms === 'cloth') k.box(tv([-0.055, 0.9, -0.19]), [0.075, 0.25, 0.02], C.cloth, ARMS, -0.05);
  if (d.arms === 'cane') k.seg(tv([0.23, 0.86, -0.23]), [0.27, 0.0, -0.33], 0.012, 0.012, C.timberDark, LEGS, 5);
  const nk = tv(NECK);
  return { neck: [nk[1], nk[2]], waist: tv([0, 1.0, 0])[1] };
}

// ---------- The batch ----------
const HEAD_GLSL = [
  'attribute vec2 npcPart;',
  `uniform vec4 uNpcA[ ${NPC_MAX} ];`, `uniform vec4 uNpcB[ ${NPC_MAX} ];`, `uniform vec4 uNpcC[ ${NPC_MAX} ];`,
  'mat3 npcRy( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c ); }',
  'mat3 npcRx( float a ) { float c = cos( a ), s = sin( a ); return mat3( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c ); }',
  'mat3 npcRz( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0 ); }',
].join('\n');
// uNpcA = (x, y, z, body yaw); uNpcB = (head yaw, head pitch, breath -1..1, weight-shift roll); uNpcC = (neck y, neck z, scale, waist y)
const NORMAL_GLSL = [
  'int npcI = int( npcPart.x + 0.5 );',
  'vec4 npcA = uNpcA[ npcI ], npcB = uNpcB[ npcI ], npcC = uNpcC[ npcI ];',
  'mat3 npcBody = npcRy( npcA.w ) * npcRz( npcB.w );',
  'mat3 npcHead = npcRy( npcB.x ) * npcRx( npcB.y );',
  'bool npcIsHead = abs( npcPart.y - 2.0 ) < 0.5;',
  'if ( npcIsHead ) objectNormal = npcHead * objectNormal;',
  'objectNormal = npcBody * objectNormal;',
].join('\n');
const POSITION_GLSL = [
  'if ( npcPart.y > 0.5 ) {',
  '  if ( npcPart.y < 1.5 ) transformed.xz *= 1.0 + npcB.z * vec2( 0.012, 0.03 );',   // the chest fills
  '  transformed.y += npcB.z * 0.006 * smoothstep( npcC.w, npcC.x, transformed.y );',   // shoulders, arms, head rise
  '}',
  'if ( npcIsHead ) { vec3 npcPv = vec3( 0.0, npcC.x, npcC.y ); transformed = npcHead * ( transformed - npcPv ) + npcPv; }',
  'transformed = npcBody * ( transformed * npcC.z ) + npcA.xyz;',
].join('\n');

export interface NpcFigures {
  mesh: THREE.Mesh;
  shadows: THREE.Mesh;
  /** Poses every actor for this frame (t in seconds). No allocation. */
  update(actors: readonly Actor[], t: number): void;
  stats: { tris: number; verts: number };
}

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _bake: [number, number] = [1, 0];
export function buildNpcFigures(scene: THREE.Scene, actors: readonly Actor[], env: THREE.Texture): NpcFigures {
  if (actors.length > NPC_MAX) throw new Error(`npcFigures: ${actors.length} actors > NPC_MAX ${NPC_MAX}`);
  const vec = () => Array.from({ length: NPC_MAX }, () => new THREE.Vector4());
  const U = { uNpcA: { value: vec() }, uNpcB: { value: vec() }, uNpcC: { value: vec() } };
  const geos: THREE.BufferGeometry[] = [];
  for (const a of actors) {
    const k = new Kit(), d = dressFor(CAST[a.id].figure, a.id, rng(7919 * (a.index + 1) + 13));
    const { neck, waist } = person(k, d);
    const s = d.height / 1.75, cy = Math.cos(a.rest), sy = Math.sin(a.rest);
    U.uNpcC.value[a.index].set(neck[0] * s, neck[1] * s, 1, waist * s);
    for (const pc of k.out) {
      const g = pc.g.scale(s, s, s), pos = g.getAttribute('position'), nor = g.getAttribute('normal'), n = pos.count;
      const col = new Float32Array(n * 3), bake = new Float32Array(n * 2), part = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        // Rest pose in the world (the bake's frame): yaw about y (three's rotation.y), then the spot.
        _v.fromBufferAttribute(pos, i); _n.fromBufferAttribute(nor, i);
        const wx = _v.x * cy + _v.z * sy + a.x, wz = -_v.x * sy + _v.z * cy + a.z;
        bakeAt(wx, _v.y + a.y, wz, _n.x * cy + _n.z * sy, _n.y, -_n.x * sy + _n.z * cy, _bake);
        bake[i * 2] = _bake[0]; bake[i * 2 + 1] = _bake[1];
        col[i * 3] = pc.c.r; col[i * 3 + 1] = pc.c.g; col[i * 3 + 2] = pc.c.b;
        part[i * 2] = a.index; part[i * 2 + 1] = pc.p;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('bake', new THREE.BufferAttribute(bake, 2));
      g.setAttribute('npcPart', new THREE.BufferAttribute(part, 2));
      geos.push(g);
    }
  }
  const geo = geos.length ? mergeGeometries(geos)! : new THREE.BufferGeometry();
  for (const g of geos) g.dispose();
  const mat = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 }),
    { key: 'npc', uniforms: U, head: HEAD_GLSL, normal: NORMAL_GLSL, position: POSITION_GLSL });
  mat.envMap = env; mat.envMapIntensity = 2.4;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;            // posed in the vertex shader: the CPU bounds are the rest pose at the origin
  mesh.visible = actors.length > 0;      // an empty cast (the arena sandbox) draws nothing
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = true;             // the static sun map is drawn without them; they take its shade
  scene.add(mesh);

  // Contact shadows: a soft dark disc under each (a wider one under the chair), one transparent draw.
  const discs = actors.map(a => {
    const r = a.seated ? 0.52 : 0.38, f = a.seated ? 0.12 : 0.03;   // centred a little ahead: the feet, the chair and knees
    const g = new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2).translate(a.x - Math.sin(a.rest) * f, a.y + 0.014, a.z - Math.cos(a.rest) * f);
    const n = g.getAttribute('position').count, c = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) c[i * 4 + 3] = i === 0 ? 0.5 : 0;
    g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    return g;
  });
  const shadows = new THREE.Mesh(discs.length ? mergeGeometries(discs)! : new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
  for (const g of discs) g.dispose();
  shadows.matrixAutoUpdate = false; shadows.frustumCulled = false; shadows.visible = actors.length > 0;
  scene.add(shadows);

  const TAU = Math.PI * 2;
  return {
    mesh, shadows,
    stats: { tris: (geo.index?.count ?? 0) / 3, verts: geo.getAttribute('position')?.count ?? 0 },
    update(list, t) {
      for (const a of list) {
        const breath = Math.sin(t * TAU / a.breathT + a.breathP);
        const nod = a.talk > 0 ? 0.05 * Math.sin(t * 7.3 + a.breathP) * Math.min(1, a.talk * 2) : 0;
        U.uNpcA.value[a.index].set(a.x, a.y, a.z, a.yaw);
        U.uNpcB.value[a.index].set(a.headYaw, a.headPitch + nod, breath, a.seated ? 0 : 0.012 * Math.sin(t * 0.37 + a.breathP * 1.7));
      }
    },
  };
}
