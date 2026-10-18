// Material registry: one shared MeshStandardMaterial per surface/token, flat palette colour first,
// swapped to a tileable texture from public/art/<name>.png when that file exists.
import * as THREE from 'three';
import palette from '../studio/art/palette.json';
import { C, type Surface, type Token } from './nightshift';

/** Metres covered by one texture tile (1024 px tiles → ~2 px/cm). */
export const TILE_M = 2;

/** Texture → palette token its average colour was authored to (studio/art/prompts/<name>.md). */
const TEX_BASE = {
  'floor-concrete': 'concrete', 'concrete-spillway-wet': 'concreteDark', 'wall-painted': 'wallPaint',
  'grating-metal': 'metal', 'grating-catwalk': 'metal', 'corrugated-metal': 'metal', 'panel-control': 'metal',
  'pipe-rusty': 'rust', 'stripe-hazard': 'hazardYellow',
} as const satisfies Record<string, Token>;
export type TexName = keyof typeof TEX_BASE;

interface Spec { rough: number; metal: number; tex?: TexName }
// Metalness stays <= 0.25: there is no environment map, so high metalness would render black.
export const SURFACES: Record<Surface, Spec> = {
  concrete: { rough: 0.95, metal: 0, tex: 'floor-concrete' },
  wetConcrete: { rough: 0.45, metal: 0, tex: 'concrete-spillway-wet' },
  ceiling: { rough: 0.95, metal: 0, tex: 'floor-concrete' },
  wall: { rough: 0.85, metal: 0, tex: 'wall-painted' },
  tunnel: { rough: 0.7, metal: 0.2, tex: 'corrugated-metal' },
  metal: { rough: 0.6, metal: 0.2, tex: 'grating-metal' },
  grating: { rough: 0.6, metal: 0.2, tex: 'grating-metal' },
  catwalk: { rough: 0.6, metal: 0.25, tex: 'grating-catwalk' },
  panel: { rough: 0.55, metal: 0.2, tex: 'panel-control' },
  locker: { rough: 0.5, metal: 0.2, tex: 'corrugated-metal' },
  hazard: { rough: 0.7, metal: 0.1, tex: 'stripe-hazard' },
  rust: { rough: 0.85, metal: 0.2, tex: 'corrugated-metal' },
  pipe: { rough: 0.75, metal: 0.2, tex: 'pipe-rusty' },
  door: { rough: 0.7, metal: 0.2, tex: 'corrugated-metal' },
};

export const color = (t: Token) => new THREE.Color(palette[t]);

const mats = new Map<string, THREE.Material>();
const textures = new Map<TexName, { tex: THREE.Texture | null; waiting: ((t: THREE.Texture) => void)[] }>();
const loader = new THREE.TextureLoader();
let anisotropy = 1;

/** Call once with renderer.capabilities.getMaxAnisotropy() before textures load. */
export function setAnisotropy(n: number) { anisotropy = Math.max(1, Math.min(8, n)); }

function bind(m: THREE.MeshStandardMaterial, t: THREE.Texture, name: TexName, token: Token) {
  // Texture already carries its base colour; tint only when the surface token differs (e.g. dark ceiling).
  const base = color(TEX_BASE[name]), want = color(token);
  m.color.setRGB(want.r / base.r, want.g / base.g, want.b / base.b, THREE.LinearSRGBColorSpace);
  m.map = t;
  m.needsUpdate = true;
}

/** Calls back with the shared texture once public/art/<name>.png has loaded. Never called if the file is missing. */
export function withTexture(name: TexName, cb: (t: THREE.Texture) => void) {
  let e = textures.get(name);
  if (!e) {
    const entry: { tex: THREE.Texture | null; waiting: ((t: THREE.Texture) => void)[] } = { tex: null, waiting: [] };
    textures.set(name, entry);
    e = entry;
    loader.load(`${import.meta.env.BASE_URL}art/${name}.png`, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = anisotropy;
      entry.tex = t;
      for (const f of entry.waiting) f(t);
      entry.waiting.length = 0;
    }, undefined, () => { entry.waiting.length = 0; /* no file yet: keep the flat palette colour */ });
  }
  if (e.tex) cb(e.tex); else e.waiting.push(cb);
}

/** Palette colour a texture's average was authored to (multiply by want/base to retint it). */
export const textureBase = (name: TexName) => color(TEX_BASE[name]);

function useTexture(m: THREE.MeshStandardMaterial, name: TexName, token: Token) {
  withTexture(name, t => bind(m, t, name, token));
}

function cached<M extends THREE.Material>(key: string, make: () => M): M {
  let m = mats.get(key) as M | undefined;
  if (!m) { m = make(); mats.set(key, m); }
  return m;
}

/** Shared lit material for a level surface. */
export function surfaceMaterial(s: Surface): THREE.MeshStandardMaterial {
  return cached(`surface:${s}`, () => {
    const spec = SURFACES[s];
    const m = new THREE.MeshStandardMaterial({ color: palette[C[s]], roughness: spec.rough, metalness: spec.metal });
    if (spec.tex) useTexture(m, spec.tex, C[s]);
    return m;
  });
}

/** Shared flat-colour lit material (props, pickups, enemies). Same arguments → same instance. */
export function tokenMaterial(token: Token, rough: number, metal: number, glow: Token | null = null, glowAmt = 0,
  flat = false): THREE.MeshStandardMaterial {
  return cached(`std:${token}:${rough}:${metal}:${glow}:${glowAmt}:${flat}`, () => new THREE.MeshStandardMaterial({
    color: palette[token], roughness: rough, metalness: metal, flatShading: flat,
    emissive: glow ? palette[glow] : 0x000000, emissiveIntensity: glowAmt,
  }));
}

/** Shared unlit material (lamps, bolts, impacts), exact palette colour (not tone mapped).
 *  `lift` mixes toward white so small things pop. */
export function glowMaterial(token: Token, lift = 0): THREE.MeshBasicMaterial {
  return cached(`basic:${token}:${lift}`, () => new THREE.MeshBasicMaterial({
    color: color(token).lerp(new THREE.Color(1, 1, 1), lift), toneMapped: false,
  }));
}

/** World-space planar UVs (1 tile per TILE_M metres) on a geometry already placed in world space. */
export function worldUVs(g: THREE.BufferGeometry, offset?: THREE.Vector3): THREE.BufferGeometry {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv');
  const ox = offset?.x ?? 0, oy = offset?.y ?? 0, oz = offset?.z ?? 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, z / TILE_M, y / TILE_M);
    else if (ay >= az) uv.setXY(i, x / TILE_M, z / TILE_M);
    else uv.setXY(i, x / TILE_M, y / TILE_M);
  }
  uv.needsUpdate = true;
  return g;
}

/** Number of distinct materials created so far (for the F3/report numbers). */
export const materialCount = () => mats.size;
