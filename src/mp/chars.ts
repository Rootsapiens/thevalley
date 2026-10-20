// Animated player bodies (public/models/characters, studio/art/characters-manifest.md). One shared loader, one cached
// GLB per model, SkeletonUtils.clone per player with its materials cloned and team-tinted (never Skin or Face).
// Until a model has loaded the figure is a capsule, so a slow or failed load never blocks play.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

type Role = 'torso' | 'legs' | 'accent' | 'head';
interface Spec { file: string; mats: Record<string, Role> }
const PEOPLE: Record<string, Record<string, Role>> = {
  soldier_male: {
    Main: 'torso', DarkGreen: 'legs', Helmet: 'head', Hair: 'head',
    TacticalFabric: 'legs', PlateCarrier: 'torso', PouchCanvas: 'accent', HardArmor: 'head',
    MetalHardware: 'accent', GoggleLens: 'head', BootRubber: 'legs',
  },
  soldier_female: {
    Main: 'torso', DarkGreen: 'legs', Helmet: 'head', Hair: 'head',
    TacticalFabric: 'legs', PlateCarrier: 'torso', PouchCanvas: 'accent', HardArmor: 'head',
    MetalHardware: 'accent', GoggleLens: 'head', BootRubber: 'legs',
  },
  worker_male: { Shirt: 'torso', Pants: 'legs', Vest: 'accent', Hat: 'head' },
  worker_female: { Shirt: 'torso', Pants: 'legs', Vest: 'accent', Hat: 'head' },
  cowboy_male: { Jacket: 'torso', Top: 'torso', Pants: 'legs', Scarf: 'accent', HatBrown: 'head', HatLightBrown: 'head' },
  oldclassy_female: { Shirt: 'torso', Pants: 'legs', Detail: 'accent', Belt: 'accent', Hat: 'head' },
};
const SPECS: Record<string, Spec> = {
  mannequin: { file: 'mannequin', mats: { M_Main: 'torso', M_Joints: 'accent' } },
  ...Object.fromEntries(Object.entries(PEOPLE).map(([k, m]) => [k, { file: k.startsWith('soldier_') ? `${k}_operator` : k, mats: m }])),
};
const TINT: Record<0 | 1, Record<Role, number>> = {
  0: { torso: 0x2b2b30, legs: 0x1b1b1f, accent: 0x8c1c1c, head: 0x26262b },   // Ravens
  1: { torso: 0x625440, legs: 0x4a3d30, accent: 0x9e7136, head: 0x5b6046 },    // Village
};
/** Both sides use the operator body; team colour keeps Ravens and Village easy to read. */
const BOT_MODELS: Record<0 | 1, string[]> = {
  0: ['soldier_male', 'soldier_female'],
  1: ['soldier_male', 'soldier_female'],
};
export const modelFor = (id: number, team: 0 | 1, _human: boolean): string =>
  BOT_MODELS[team][(id >> 1) % BOT_MODELS[team].length];

let ENV: THREE.Texture | null = null;
/** The village sky environment lights the PBR bodies (the scene itself has none). */
export const setCharEnv = (t: THREE.Texture) => { ENV = t; };
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF | null>>();
function load(name: string): Promise<GLTF | null> {
  let p = cache.get(name);
  if (!p) { p = loader.loadAsync(`${import.meta.env.BASE_URL}models/characters/${SPECS[name].file}.glb`).catch(() => null); cache.set(name, p); }
  return p;
}

const clip = (clips: THREE.AnimationClip[], name: string) => clips.find(c => c.name.toLowerCase() === name) ?? clips.find(c => c.name.toLowerCase().includes(name));

export class Figure {
  readonly group = new THREE.Group();
  /** True once this figure has been seen alive (spectators who joined mid-round never show a corpse). */
  wasAlive = false;
  private placeholder: THREE.Object3D;
  private mixer: THREE.AnimationMixer | null = null;
  private act: Partial<Record<'idle' | 'walk' | 'run' | 'shoot' | 'death', THREE.AnimationAction>> = {};
  private cur: THREE.AnimationAction | null = null;
  private dead = false;
  private shootT = 0;
  private disposed = false;

  constructor(readonly id: number, readonly team: 0 | 1, human: boolean) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 4, 8), new THREE.MeshLambertMaterial({ color: TINT[team].torso }));
    body.position.y = 0.85; this.placeholder = body; this.group.add(body);
    const name = modelFor(id, team, human);
    void load(name).then(g => { if (g && !this.disposed) this.attach(name, g); });
  }

  private attach(name: string, gltf: GLTF): void {
    const model = cloneSkinned(gltf.scene) as THREE.Object3D;
    const roles = SPECS[name].mats, tint = TINT[this.team];
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const fix = (mat: THREE.Material) => {
        const c = mat.clone() as THREE.MeshStandardMaterial;
        const role = roles[mat.name];
        if (ENV) { c.envMap = ENV; c.envMapIntensity = 1.1; }
        if (role && c.color) c.color.setHex(tint[role]);       // never Skin or Face: they are not in the table
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
    });
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI;                                // glTF characters face +Z; the game's forward is -Z
    holder.add(model);
    this.group.remove(this.placeholder); this.group.add(holder);
    const mixer = new THREE.AnimationMixer(model); this.mixer = mixer;
    for (const k of ['idle', 'walk', 'run', 'shoot', 'death'] as const) {
      const c = clip(gltf.animations, k);
      if (!c) continue;
      const a = mixer.clipAction(c);
      if (k === 'shoot' || k === 'death') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.act[k] = a;
    }
    this.fade(this.act.idle ?? null);
  }

  private fade(next: THREE.AnimationAction | null): void {
    if (!next || next === this.cur) return;
    next.reset().play();
    if (this.cur) this.cur.crossFadeTo(next, 0.15, false);
    this.cur = next;
  }

  /** The figure fired its weapon. */
  shoot(): void { this.shootT = 0.45; }

  update(dt: number, speed: number, alive: boolean): void {
    if (alive) this.wasAlive = true;
    if (!this.mixer) return;
    if (!alive) {
      if (!this.dead) { this.dead = true; this.fade(this.act.death ?? null); }
    } else {
      if (this.dead) { this.dead = false; this.cur = null; this.mixer.stopAllAction(); }
      this.shootT = Math.max(0, this.shootT - dt);
      if (this.shootT > 0 && this.act.shoot) { if (this.cur !== this.act.shoot) { this.act.shoot.reset(); } this.fade(this.act.shoot); }
      else this.fade((speed > 3.5 ? this.act.run : speed > 0.4 ? this.act.walk : this.act.idle) ?? this.act.idle ?? null);
    }
    this.mixer.update(dt);
  }

  dispose(): void { this.disposed = true; this.mixer?.stopAllAction(); }
}
