// East Valley extension. Keeps the authored village grid fixed and reuses its terrain sampler at the seam.
// Nature assets are CC0 Quaternius GLBs; see studio/art/free-assets-manifest.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Box } from './physics';

type Ground = (x: number, z: number) => number;
type Scatter = { x: number; z: number; yaw: number; scale: number };
type Occupied = { x: number; z: number; radius: number };

const EAST: readonly [number, number, number, number] = [125, 225, -20, 110];
const ROUTE: readonly { x: number; z: number }[] = [
  { x: 123.5, z: 12.5 }, // exact overlap with the existing village trail seam
  { x: 140, z: 12.5 },
  { x: 157, z: 17 },
  { x: 174, z: 15 },
  { x: 190, z: 24 },
  { x: 207, z: 37 },
  { x: 222, z: 40 },
];

const mulberry = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

function routeDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1], b = ROUTE[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
}

function scatter(seed: number, count: number, margin: number, pathClearance: number, occupied: Occupied[], footprintRadius: number): Scatter[] {
  const rand = mulberry(seed), out: Scatter[] = [];
  for (let tries = 0; tries < count * 18 && out.length < count; tries++) {
    const x = EAST[0] + margin + rand() * (EAST[1] - EAST[0] - margin * 2);
    const z = EAST[2] + margin + rand() * (EAST[3] - EAST[2] - margin * 2);
    if (routeDistance(x, z) < pathClearance) continue;
    const scale = 0.82 + rand() * 0.38, radius = footprintRadius * scale;
    if (occupied.some(p => Math.hypot(p.x - x, p.z - z) < Math.max(1.8, (p.radius + radius) * 0.72))) continue;
    const placement = { x, z, yaw: rand() * Math.PI * 2, scale };
    out.push(placement); occupied.push({ x, z, radius });
  }
  return out;
}

// Shared occupied list prevents separately-seeded species from being placed inside one another.
const OCCUPIED: Occupied[] = [];
const PLACEMENTS: Record<string, Scatter[]> = {
  'tree_broad_1': scatter(821, 8, 7, 11, OCCUPIED, 3.2),
  'tree_broad_2': scatter(822, 8, 7, 11, OCCUPIED, 3.2),
  'tree_broad_3': scatter(823, 7, 7, 11, OCCUPIED, 3.2),
  'tree_broad_4': scatter(824, 7, 7, 11, OCCUPIED, 3.2),
  'bush_1': scatter(925, 12, 4, 6, OCCUPIED, 0.8),
  'bush_2': scatter(926, 12, 4, 6, OCCUPIED, 0.8),
  'bush_3': scatter(927, 12, 4, 6, OCCUPIED, 0.8),
  'rock_1': scatter(1031, 12, 4, 4.5, OCCUPIED, 1.85),
  'rock_2': scatter(1032, 12, 4, 4.5, OCCUPIED, 1.85),
  'rock_3': scatter(1033, 12, 4, 4.5, OCCUPIED, 1.85),
  'grass_1': scatter(1134, 18, 2, 3.3, OCCUPIED, 0.3),
  'grass_2': scatter(1135, 18, 2, 3.3, OCCUPIED, 0.3),
};

function routeMesh(ground: Ground): THREE.Mesh {
  const pos: number[] = [], color: number[] = [], index: number[] = [];
  const width = 3.8, base = new THREE.Color('#625746'), light = new THREE.Color('#75684f');
  const dense: { x: number; z: number }[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const p0 = ROUTE[Math.max(0, i - 1)], p1 = ROUTE[i], p2 = ROUTE[i + 1], p3 = ROUTE[Math.min(ROUTE.length - 1, i + 2)];
    const length = Math.hypot(p2.x - p1.x, p2.z - p1.z), steps = Math.max(1, Math.ceil(length / 1.5));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const interp = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: interp(p0.x, p1.x, p2.x, p3.x), z: interp(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  dense.push(ROUTE[ROUTE.length - 1]);
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i], before = dense[Math.max(0, i - 1)], after = dense[Math.min(dense.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, d = Math.hypot(dx, dz) || 1;
    const nx = -dz / d, nz = dx / d;
    for (const side of [-1, 1]) {
      const x = p.x + nx * width * 0.5 * side, z = p.z + nz * width * 0.5 * side;
      pos.push(x, ground(x, z) + 0.035, z);
      const c = (i % 3 === 0 ? light : base).clone().multiplyScalar(0.92 + (i % 4) * 0.035);
      color.push(c.r, c.g, c.b);
    }
    if (i > 0) {
      const k = (i - 1) * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geo.setIndex(index); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'east-valley-herd-road'; mesh.receiveShadow = true;
  return mesh;
}

export interface EastValley {
  group: THREE.Group;
  /** Resolves after the region's CC0 GLBs load (or cleanly settles if an asset is unavailable). */
  ready: Promise<void>;
  solids: Box[];
  stats: { instances: number; meshes: number };
}

/** Build a lightweight connected outdoor cell without shifting any existing village coordinates. */
export function buildEastValley(scene: THREE.Scene, ground: Ground): EastValley {
  const group = new THREE.Group(); group.name = 'east-valley'; scene.add(group);
  group.add(routeMesh(ground));
  const solids: Box[] = [], stats = { instances: Object.values(PLACEMENTS).reduce((n, a) => n + a.length, 0), meshes: 0 };

  for (const [name, placed] of Object.entries(PLACEMENTS)) {
    const tree = name.startsWith('tree_'), rock = name.startsWith('rock_'), bush = name.startsWith('bush_');
    if (!(tree || rock || bush)) continue;
    for (const p of placed) {
      // Conservative asset-footprint circles (GLB X/Z bounds from Zurub's asset check); tree canopy stays non-solid.
      const g = ground(p.x, p.z), radius = tree ? 0.35 * p.scale : rock ? 1.85 * p.scale : 0.95 * p.scale;
      const height = tree ? 4.5 * p.scale : rock ? 1.5 * p.scale : 1.2 * p.scale;
      solids.push({ min: { x: p.x - radius, y: g, z: p.z - radius }, max: { x: p.x + radius, y: g + height, z: p.z + radius } });
    }
  }

  const ready = (async () => {
    const loader = new GLTFLoader();
    const names = Object.keys(PLACEMENTS);
    const models = await Promise.all(names.map(name =>
      loader.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}.glb`).catch(() => null),
    ));
    for (let i = 0; i < names.length; i++) {
      const gltf = models[i], placements = PLACEMENTS[names[i]];
      if (!gltf || !placements.length) continue;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(object => {
        const source = object as THREE.Mesh;
        if (!source.isMesh) return;
        const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
        // Keep geometry groups intact: several CC0 tree and bush GLBs use multiple material
        // slots, and InstancedMesh supports the same material array as Mesh.
        const material = Array.isArray(source.material)
          ? source.material.map(slot => slot.clone())
          : source.material.clone();
        const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
        mesh.name = `east-${names[i]}`; mesh.castShadow = true; mesh.receiveShadow = true;
        const matrix = new THREE.Matrix4(), rot = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3();
        const color = new THREE.Color();
        placements.forEach((p, n) => {
          position.set(p.x, ground(p.x, p.z), p.z); rot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
          scale.setScalar(p.scale); matrix.compose(position, rot, scale); mesh.setMatrixAt(n, matrix);
          const tone = 0.92 + ((n * 17 + i * 11) % 9) * 0.02; mesh.setColorAt(n, color.setRGB(tone, tone, tone));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        group.add(mesh); stats.meshes++;
        geometry.computeBoundingSphere();
      });
    }
  })().catch(() => {});

  return { group, ready, solids, stats };
}
