// South Farmland continues the existing valley road without changing village coordinates.
// All vegetation and livestock models are CC0; source/license details are in the art manifest.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Box } from './physics';

type Ground = (x: number, z: number) => number;
type Point = { x: number; z: number };
type Placement = Point & { yaw: number; scale: number };
type Occupied = Point & { radius: number };

const BOUNDS = { x0: -22, x1: 115, z0: 122, z1: 246 };
const ROUTE: Point[] = [
  { x: 37.5, z: 118 }, // overlap the current south road after its turnback
  { x: 40, z: 130 },
  { x: 48, z: 144 },
  { x: 57, z: 160 },
  { x: 67, z: 176 },
  { x: 75, z: 193 },
  { x: 81, z: 210 },
  { x: 85, z: 228 },
];

const randomFrom = (initial: number) => {
  let seed = initial | 0;
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

function routeDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1], b = ROUTE[i], dx = b.x - a.x, dz = b.z - a.z;
    const along = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - along * dx, z - a.z - along * dz));
  }
  return best;
}

const occupied: Occupied[] = [];
function scatter(seed: number, count: number, margin: number, pathClearance: number, radius: number): Placement[] {
  const random = randomFrom(seed), placements: Placement[] = [];
  for (let tries = 0; tries < count * 24 && placements.length < count; tries++) {
    const x = BOUNDS.x0 + margin + random() * (BOUNDS.x1 - BOUNDS.x0 - margin * 2);
    const z = BOUNDS.z0 + margin + random() * (BOUNDS.z1 - BOUNDS.z0 - margin * 2);
    // Keep the road and the small livestock paddock clear.
    if (routeDistance(x, z) < pathClearance || (x > 89 && z > 206 && z < 238)) continue;
    const scale = 0.82 + random() * 0.38, extent = radius * scale;
    if (occupied.some(p => Math.hypot(p.x - x, p.z - z) < Math.max(1.7, (p.radius + extent) * 0.72))) continue;
    placements.push({ x, z, yaw: random() * Math.PI * 2, scale });
    occupied.push({ x, z, radius: extent });
  }
  return placements;
}

const PLACEMENTS: Record<string, Placement[]> = {
  tree_broad_1: scatter(2101, 4, 8, 13, 3.2), tree_broad_2: scatter(2102, 4, 8, 13, 3.2),
  tree_broad_3: scatter(2103, 4, 8, 13, 3.2), tree_broad_4: scatter(2104, 3, 8, 13, 3.2),
  bush_1: scatter(2201, 6, 4, 6, 0.8), bush_2: scatter(2202, 6, 4, 6, 0.8), bush_3: scatter(2203, 6, 4, 6, 0.8),
  rock_1: scatter(2301, 6, 4, 4.5, 1.85), rock_2: scatter(2302, 6, 4, 4.5, 1.85), rock_3: scatter(2303, 6, 4, 4.5, 1.85),
  grass_1: scatter(2401, 10, 2, 3.4, 0.3), grass_2: scatter(2402, 10, 2, 3.4, 0.3),
};

function makeRoute(ground: Ground): THREE.Mesh {
  const dense: Point[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const p0 = ROUTE[Math.max(0, i - 1)], p1 = ROUTE[i], p2 = ROUTE[i + 1], p3 = ROUTE[Math.min(ROUTE.length - 1, i + 2)];
    const steps = Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 1.5);
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const curve = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: curve(p0.x, p1.x, p2.x, p3.x), z: curve(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  dense.push(ROUTE[ROUTE.length - 1]);
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], width = 4.2;
  const base = new THREE.Color('#695d48'), light = new THREE.Color('#7a6b50');
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i], before = dense[Math.max(0, i - 1)], after = dense[Math.min(dense.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) {
      const x = p.x - dz / length * width * 0.5 * side, z = p.z + dx / length * width * 0.5 * side;
      positions.push(x, ground(x, z) + 0.04, z);
      const tint = (i % 3 === 0 ? light : base).clone().multiplyScalar(0.94 + (i % 4) * 0.025);
      colors.push(tint.r, tint.g, tint.b);
    }
    if (i) { const k = (i - 1) * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  mesh.name = 'south-farmland-road'; mesh.receiveShadow = true;
  return mesh;
}

export interface SouthFarmland {
  group: THREE.Group;
  ready: Promise<void>;
  solids: Box[];
  stats: { cells: number; scatterInstances: number; animalModels: number; animatedAnimals: number; meshes: number };
  tick(dt: number): void;
}

export function buildSouthFarmland(scene: THREE.Scene, ground: Ground): SouthFarmland {
  const group = new THREE.Group(); group.name = 'south-farmland'; scene.add(group); group.add(makeRoute(ground));
  const solids: Box[] = [];
  for (const [name, placements] of Object.entries(PLACEMENTS)) {
    const tree = name.startsWith('tree_'), rock = name.startsWith('rock_'), bush = name.startsWith('bush_');
    if (!(tree || rock || bush)) continue;
    for (const p of placements) {
      const y = ground(p.x, p.z), radius = (tree ? 0.35 : rock ? 1.85 : 0.95) * p.scale, height = (tree ? 4.5 : rock ? 1.5 : 1.2) * p.scale;
      solids.push({ min: { x: p.x - radius, y, z: p.z - radius }, max: { x: p.x + radius, y: y + height, z: p.z + radius } });
    }
  }
  // Livestock grazes behind a simple, open farm gate. Fence bars are lightweight instanced-free boxes.
  const fence = new THREE.MeshStandardMaterial({ color: '#69543a', roughness: 1 });
  const field = { x0: 91, x1: 113, z0: 207, z1: 236 };
  const postGeometry = new THREE.BoxGeometry(0.14, 1.15, 0.14), railGeometry = new THREE.BoxGeometry(1, 0.12, 0.12);
  const postTransforms: THREE.Matrix4[] = [], railTransforms: THREE.Matrix4[] = [];
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3();
  const postAt = (x: number, z: number) => { position.set(x, ground(x, z) + 0.57, z); matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); postTransforms.push(matrix.clone()); };
  const railAt = (x: number, z: number, length: number, yaw: number, height: number) => {
    position.set(x, ground(x, z) + height, z); rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    scale.set(length, 1, 1); matrix.compose(position, rotation, scale); railTransforms.push(matrix.clone());
  };
  for (let x = field.x0; x <= field.x1; x += 3.5) { postAt(x, field.z0); postAt(x, field.z1); }
  for (let z = field.z0; z <= field.z1; z += 3.5) { postAt(field.x0, z); postAt(field.x1, z); }
  // Three closed sides; a four-metre gate opening faces west toward the road.
  for (let x = field.x0; x < field.x1; x += 1) for (const y of [0.35, 0.78]) {
    railAt(x + 0.5, field.z0, 1, 0, y); railAt(x + 0.5, field.z1, 1, 0, y);
  }
  for (let x = field.x0; x < field.x1; x += 1) {
    for (const z of [field.z0, field.z1]) {
      const y = ground(x + 0.5, z);
      solids.push({ min: { x, y, z: z - 0.08 }, max: { x: x + 1, y: y + 0.92, z: z + 0.08 } });
    }
  }
  for (let z = field.z0; z < field.z1; z += 1) for (const y of [0.35, 0.78]) {
    if (z < 218 || z >= 222) railAt(field.x0, z + 0.5, 1, Math.PI / 2, y);
    railAt(field.x1, z + 0.5, 1, Math.PI / 2, y);
  }
  for (let z = field.z0; z < field.z1; z += 1) {
    const y = ground(field.x1, z + 0.5);
    solids.push({ min: { x: field.x1 - 0.08, y, z }, max: { x: field.x1 + 0.08, y: y + 0.92, z: z + 1 } });
    if (z < 218 || z >= 222) {
      const westY = ground(field.x0, z + 0.5);
      solids.push({ min: { x: field.x0 - 0.08, y: westY, z }, max: { x: field.x0 + 0.08, y: westY + 0.92, z: z + 1 } });
    }
  }
  const posts = new THREE.InstancedMesh(postGeometry, fence, postTransforms.length);
  const rails = new THREE.InstancedMesh(railGeometry, fence, railTransforms.length);
  postTransforms.forEach((m, i) => posts.setMatrixAt(i, m)); railTransforms.forEach((m, i) => rails.setMatrixAt(i, m));
  posts.instanceMatrix.needsUpdate = rails.instanceMatrix.needsUpdate = true; posts.castShadow = rails.castShadow = true;
  group.add(posts, rails);

  const stats = { cells: 1, scatterInstances: Object.values(PLACEMENTS).reduce((n, a) => n + a.length, 0), animalModels: 7, animatedAnimals: 0, meshes: 3 };
  const mixers: THREE.AnimationMixer[] = [];
  const ready = (async () => {
    const loader = new GLTFLoader(), names = Object.keys(PLACEMENTS);
    const [nature, animals] = await Promise.all([
      Promise.all(names.map(name => loader.loadAsync(`${import.meta.env.BASE_URL}models/nature/${name}.glb`).catch(() => null))),
      Promise.all(['cow', 'sheep', 'horse', 'pig'].map(name => loader.loadAsync(`${import.meta.env.BASE_URL}models/animals/${name}.glb`).catch(() => null))),
    ]);
    for (let i = 0; i < names.length; i++) {
      const asset = nature[i], placements = PLACEMENTS[names[i]];
      if (!asset || !placements.length) continue;
      asset.scene.updateMatrixWorld(true);
      asset.scene.traverse(object => {
        const source = object as THREE.Mesh; if (!source.isMesh) return;
        const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
        const material = Array.isArray(source.material) ? source.material.map(m => m.clone()) : source.material.clone();
        const mesh = new THREE.InstancedMesh(geometry, material, placements.length); mesh.name = `south-${names[i]}`; mesh.castShadow = mesh.receiveShadow = true;
        const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3(), color = new THREE.Color();
        placements.forEach((p, n) => { position.set(p.x, ground(p.x, p.z), p.z); rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw); scale.setScalar(p.scale); matrix.compose(position, rotation, scale); mesh.setMatrixAt(n, matrix); mesh.setColorAt(n, color.setScalar(0.94 + ((n * 13 + i * 7) % 6) * 0.02)); });
        mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        geometry.computeBoundingSphere(); group.add(mesh); stats.meshes++;
      });
    }
    const herds = [
      ['cow', 0, [[96, 214], [101, 220], [107, 213]], 0.82],
      ['sheep', 1, [[103, 229], [109, 227]], 0.95],
      ['horse', 2, [[98, 231]], 1],
      ['pig', 3, [[109, 218]], 0.95],
    ] as const;
    for (const [species, modelIndex, spots, size] of herds) {
      const model = animals[modelIndex]; if (!model) continue;
      for (const [i, [x, z]] of spots.entries()) {
        const animal = cloneSkeleton(model.scene); animal.position.set(x, ground(x, z), z); animal.rotation.y = (i % 2 ? 1 : -1) * 0.45; animal.scale.setScalar(size); animal.name = `south-${species}-${i + 1}`; group.add(animal);
        const idle = model.animations.find(clip => /idle/i.test(clip.name)) ?? model.animations[0];
        if (idle) { const mixer = new THREE.AnimationMixer(animal); mixer.clipAction(idle).play(); mixers.push(mixer); stats.animatedAnimals++; }
      }
    }
  })().catch(() => {});
  return { group, ready, solids, stats, tick: dt => { for (const mixer of mixers) mixer.update(dt); } };
}
