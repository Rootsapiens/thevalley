import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { trailPoints } from './village';
import type { Box, Ground } from './physics';

export interface PrologueCow {
  readonly group: THREE.Group;
  readonly box: Box;
  tick(dt: number, playerX: number, playerZ: number): void;
  reset(): void;
  position(): { x: number; z: number };
  progress(): number;
  checkpoint(): number;
  restore(checkpoint: number): void;
}

const cowYaw = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** Low-poly farm cow that leads Joseph along the authored hoofprint trail in Night 0. */
export function buildPrologueCow(scene: THREE.Scene, ground: Ground): PrologueCow {
  const group = new THREE.Group();
  group.name = 'JosephPrologueFarmerCow';
  const fallback = new THREE.Group();
  fallback.name = 'ProceduralCowFallback';
  group.add(fallback);
  // Quaternius Farm Animals (CC0): Y-up, floor-centred GLB. Its head faces +Z,
  // while this trail convention uses -Z, so the asset child is turned around.
  const asset = new THREE.Group();
  asset.name = 'QuaterniusCow';
  asset.rotation.y = Math.PI;
  asset.visible = false;
  group.add(asset);
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null, walkAction: THREE.AnimationAction | null = null;
  let playingWalk = false;
  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/animals/cow.glb`, gltf => {
    gltf.scene.name = 'AnimatedQuaterniusCow';
    gltf.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = true; }
    });
    asset.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    const idle = gltf.animations.find(c => /idle$/i.test(c.name));
    const walk = gltf.animations.find(c => /walkslow$/i.test(c.name)) ?? gltf.animations.find(c => /walk$/i.test(c.name));
    if (idle) { idleAction = mixer.clipAction(idle).play(); }
    if (walk) walkAction = mixer.clipAction(walk);
    playingWalk = false;
    asset.visible = true;
    fallback.visible = false;
  });
  const coat = new THREE.MeshStandardMaterial({ color: '#E4DDC8', roughness: 0.92 });
  const patch = new THREE.MeshStandardMaterial({ color: '#262522', roughness: 0.98 });
  const hide = new THREE.MeshStandardMaterial({ color: '#6B4937', roughness: 0.96 });
  const horn = new THREE.MeshStandardMaterial({ color: '#D5C59D', roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: '#A87536', roughness: 0.55, metalness: 0.35 });
  const eye = new THREE.MeshStandardMaterial({ color: '#171715', roughness: 0.4 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = false; m.receiveShadow = true; fallback.add(m); return m;
  };
  // Rounded torso, irregular dark hide patches, and a lowered head silhouette.
  add(new THREE.SphereGeometry(0.62, 10, 7), coat, 0, 1.05, 0, 1.08, 0.82, 1.38);
  add(new THREE.SphereGeometry(0.37, 8, 6), patch, -0.43, 1.32, 0.08, 0.82, 0.94, 0.88);
  add(new THREE.SphereGeometry(0.27, 8, 6), patch, 0.39, 0.91, -0.38, 0.85, 0.88, 0.95);
  add(new THREE.SphereGeometry(0.38, 9, 6), coat, 0, 1.42, -0.91, 0.85, 0.88, 0.8);
  add(new THREE.SphereGeometry(0.24, 8, 5), hide, 0, 1.19, -1.2, 0.95, 0.58, 0.68);
  // Ears, horns and eyes read at the camera's third-person distance.
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.13, 7, 5), hide, s * 0.34, 1.55, -0.84, 1.55, 0.48, 0.72);
    const h = add(new THREE.ConeGeometry(0.075, 0.28, 5), horn, s * 0.25, 1.78, -0.92, 1, 1, 1); h.rotation.z = s * 0.35;
    add(new THREE.SphereGeometry(0.045, 6, 4), eye, s * 0.23, 1.51, -1.18);
  }
  // Four short legs, pivoted at the shoulders/hips for a simple walking gait.
  const legs: THREE.Group[] = [];
  for (const x of [-0.39, 0.39]) for (const z of [-0.69, 0.68]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.79, z); fallback.add(leg); legs.push(leg);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.065, 0.66, 6), (x < 0 && z < 0) || (x > 0 && z > 0) ? patch : coat);
    shin.position.y = -0.38; shin.castShadow = false; leg.add(shin);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.14, 6), hide); hoof.position.set(0, -0.72, -0.015); hoof.castShadow = false; leg.add(hoof);
  }
  // Bell and tail make the animal identifiable in the dark barn.
  add(new THREE.SphereGeometry(0.085, 7, 5), brass, 0, 1.18, -0.64);
  add(new THREE.SphereGeometry(0.04, 6, 4), brass, 0, 1.06, -0.67);
  const tail = add(new THREE.CylinderGeometry(0.035, 0.045, 0.82, 5), hide, 0.06, 1.06, 1.12);
  tail.rotation.x = -0.48;
  scene.add(group);

  const path = trailPoints(0.5);
  let index = 0;
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    if (path[i].z > 0.5) continue; // start inside the barn's northbound feed aisle, ahead of Joseph
    const d = Math.hypot(path[i].x - 0.25, path[i].z + 2.5);
    if (d < best) { best = d; index = i; }
  }
  const caveEnd = path.findIndex((p, i) => i > index && p.z < -40 && p.x > 21);
  const endIndex = caveEnd >= 0 ? caveEnd : path.length - 1;
  const box: Box = { min: { x: 0, y: -100, z: 0 }, max: { x: 0, y: -99, z: 0 } };
  let phase = 0, stepClock = 0;
  const setAt = (i: number) => {
    const p = path[Math.min(endIndex, i)];
    group.position.set(p.x, ground(p.x, p.z), p.z);
    const n = path[Math.min(endIndex, i + 1)];
    group.rotation.y = cowYaw(n.x - p.x, n.z - p.z);
    // Asset bounds: 0.68 m wide × 2.76 m long × 1.55 m high. Use an
    // axis-aligned footprint for the current route yaw so movement/camera rays
    // keep matching the visible cow instead of the old short placeholder.
    const halfX = 0.34, halfZ = 1.38, c = Math.abs(Math.cos(group.rotation.y)), s = Math.abs(Math.sin(group.rotation.y));
    const rx = c * halfX + s * halfZ, rz = s * halfX + c * halfZ;
    box.min.x = p.x - rx; box.max.x = p.x + rx; box.min.y = group.position.y; box.max.y = group.position.y + 1.6;
    box.min.z = p.z - rz; box.max.z = p.z + rz;
  };
  setAt(index);

  return {
    group,
    box,
    tick(dt, playerX, playerZ) {
      const p = path[Math.min(endIndex, index)], distance = Math.hypot(playerX - p.x, playerZ - p.z);
      const moving = index < endIndex && distance < 24 && distance > 3.8;
      if (mixer) {
        if (moving !== playingWalk) {
          const next = moving ? walkAction : idleAction;
          const prev = moving ? idleAction : walkAction;
          if (next) {
            next.reset().play();
            if (prev && prev.isRunning()) next.crossFadeFrom(prev, 0.22, true);
          }
          playingWalk = moving;
        }
        mixer.update(dt);
      }
      if (moving) {
        const target = path[index + 1], dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.55) index++;
        else {
          const stride = Math.min(d, 1.75 * dt);
          const nextX = p.x + dx / d * stride, nextZ = p.z + dz / d * stride;
          // The path is sampled at 0.5 m; advance its cursor smoothly without allocating new waypoints.
          let nearest = index, nd = Infinity;
          for (let i = index; i <= Math.min(endIndex, index + 4); i++) {
            const q = Math.hypot(path[i].x - nextX, path[i].z - nextZ);
            if (q < nd) { nd = q; nearest = i; }
          }
          index = Math.max(index, nearest);
          phase += dt * 7.2; stepClock += dt;
          setAt(index);
        }
      }
      group.position.y = ground(group.position.x, group.position.z) + (moving ? Math.abs(Math.sin(phase)) * 0.025 : 0);
      for (let i = 0; i < legs.length; i++) legs[i].rotation.x = moving ? Math.sin(phase + (i % 2) * Math.PI) * 0.28 : 0;
      tail.rotation.z = Math.sin(stepClock * 3.1) * 0.16;
    },
    reset() {
      index = 0; phase = stepClock = 0; setAt(index); group.visible = true;
      if (mixer && idleAction) { walkAction?.stop(); idleAction.reset().play(); playingWalk = false; }
    },
    position() { return { x: group.position.x, z: group.position.z }; },
    progress() { return endIndex <= 0 ? 1 : index / endIndex; },
    checkpoint() { return index; },
    restore(checkpoint) {
      index = Math.max(0, Math.min(endIndex, Math.floor(checkpoint)));
      phase = stepClock = 0; setAt(index); group.visible = true;
      if (mixer && idleAction) { walkAction?.stop(); idleAction.reset().play(); playingWalk = false; }
    },
  };
}
