import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Box } from './physics';
import type { Examinable } from './village';

type Ground = (x: number, z: number) => number;
export interface ChapterTwoWorld {
  group: THREE.Group;
  solids: Box[];
  examinables: Examinable[];
  rootArm: THREE.Group;
  hallTarget: THREE.Vector3;
  ready: Promise<void>;
  setHazard(warning: boolean, lashing: boolean, closing: boolean): void;
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({
  min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 },
});

function meshBox(parent: THREE.Group, x: number, y: number, z: number, sx: number, sy: number, sz: number,
                 material: THREE.Material, name = 'mine-stone'): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

function floorMesh(parent: THREE.Group, ground: Ground, x0: number, x1: number, z0: number, z1: number, color: string, name: string): void {
  const nx = Math.ceil((x1 - x0) / 2), nz = Math.ceil((z1 - z0) / 2), vertices: number[] = [], indices: number[] = [];
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const x = x0 + (x1 - x0) * ix / nx, z = z0 + (z1 - z0) * iz / nz;
    vertices.push(x, ground(x, z) + 0.045, z);
    if (ix < nx && iz < nz) {
      const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }));
  mesh.name = name; mesh.receiveShadow = true; parent.add(mesh);
}

/** A lightweight, walkable quarry mine and cave sequence for Chapter 2. */
export function buildChapterTwo(scene: THREE.Scene, ground: Ground): ChapterTwoWorld {
  const group = new THREE.Group(); group.name = 'chapter-two-ravens-road'; scene.add(group);
  const solids: Box[] = [];
  const rock = new THREE.MeshStandardMaterial({ color: '#292a28', roughness: 1, side: THREE.DoubleSide });
  const timber = new THREE.MeshStandardMaterial({ color: '#55402e', roughness: 0.96 });
  const iron = new THREE.MeshStandardMaterial({ color: '#303431', roughness: 0.72, metalness: 0.28 });
  const track = new THREE.MeshStandardMaterial({ color: '#655744', roughness: 1 });
  const cableMat = new THREE.MeshStandardMaterial({ color: '#272724', roughness: 0.9 });
  const deadLamp = new THREE.MeshStandardMaterial({ color: '#494239', roughness: 0.9, emissive: '#604d35', emissiveIntensity: 0.12 });
  const wood = new THREE.MeshStandardMaterial({ color: '#67563d', roughness: 1 });
  const rootMat = new THREE.MeshStandardMaterial({ color: '#32261e', roughness: 1, emissive: '#57270f', emissiveIntensity: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: '#161816', roughness: 1 });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const staticBoxes = new Map<THREE.Material, { x: number; y: number; z: number; sx: number; sy: number; sz: number }[]>();
  const addStaticBox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material) => {
    let batch = staticBoxes.get(material); if (!batch) staticBoxes.set(material, batch = []);
    batch.push({ x, y, z, sx, sy, sz });
  };
  const flushStaticBoxes = () => {
    for (const [material, batch] of staticBoxes) {
      const mesh = new THREE.InstancedMesh(boxGeometry, material, batch.length);
      mesh.name = `chapter-two-${material === rock ? 'rock' : material === timber ? 'timber' : 'wood'}-batch`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
      for (let i = 0; i < batch.length; i++) {
        const b = batch[i]; position.set(b.x, b.y, b.z); scale.set(b.sx, b.sy, b.sz);
        matrix.compose(position, rotation, scale); mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
    }
  };

  // The packed quarry road continues the walkable East Valley track to the mine portal.
  const road = new THREE.Mesh(new THREE.PlaneGeometry(44, 4.1, 22, 2), track);
  road.rotation.x = -Math.PI / 2; road.position.set(240, 0, 40); road.name = 'quarry-track';
  const rp = road.geometry.getAttribute('position');
  for (let i = 0; i < rp.count; i++) {
    const x = road.position.x + rp.getX(i), z = road.position.z + rp.getZ(i);
    rp.setY(i, ground(x, z) + 0.06 - road.position.y);
  }
  road.geometry.computeVertexNormals(); road.receiveShadow = true; group.add(road);

  // Portal: the mine gate stands open, with the old winch and rusted rails visible from the track.
  const portalX = 258, portalZ = 40, portalY = ground(portalX, portalZ);
  for (const z of [37.4, 42.6]) {
    meshBox(group, portalX, portalY + 2.4, z, 0.9, 4.8, 0.8, rock, 'mine-gate-jamb');
    solids.push(box(portalX - 0.5, portalY, z - 0.45, portalX + 0.5, portalY + 4.8, z + 0.45));
  }
  meshBox(group, portalX, portalY + 4.75, portalZ, 1.1, 0.7, 6.1, rock, 'mine-gate-lintel');
  solids.push(box(portalX - 0.6, portalY + 4.4, 36.8, portalX + 0.6, portalY + 5.2, 43.2));
  const gate = meshBox(group, portalX + 1.2, portalY + 1.55, 37.8, 0.12, 3.1, 2.1, iron, 'open-ravens-gate'); gate.rotation.y = -0.45;
  const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 8), iron); winch.rotation.z = Math.PI / 2; winch.position.set(portalX - 0.9, portalY + 3.35, 42.4); group.add(winch);
  floorMesh(group, ground, 255, 374, 37.7, 42.3, '#37332c', 'mine-floor');

  const addTunnel = (x0: number, x1: number, z0: number, z1: number, height: number, spacing = 2) => {
    for (let x = x0; x < x1; x += spacing) {
      const len = Math.min(spacing, x1 - x), cx = x + len / 2, cz = (z0 + z1) / 2, floorY = ground(cx, cz);
      const width = z1 - z0, wallT = 0.75;
      for (const z of [z0 - wallT / 2, z1 + wallT / 2]) {
        addStaticBox(cx, floorY + height / 2, z, len + 0.02, height, wallT, rock);
        solids.push(box(x - 0.01, floorY, z - wallT / 2, x + len + 0.01, floorY + height, z + wallT / 2));
      }
      addStaticBox(cx, floorY + height + 0.25, cz, len + 0.03, 0.5, width + 2.1, rock);
      solids.push(box(x - 0.01, floorY + height, z0 - 1.05, x + len + 0.01, floorY + height + 0.5, z1 + 1.05));
    }
  };
  addTunnel(259, 323, 37.7, 42.3, 3.3);
  // A low crawlway forces the crouch control. Ceiling and collision use the same 1.3 m clearance.
  for (let x = 298; x < 306; x += 2) {
    const cx = x + 1, floorY = ground(cx, 40), h = 1.32;
    meshBox(group, cx, floorY + h + 0.24, 40, 2.02, 0.48, 6.6, rock, 'low-crawlway-roof');
    solids.push(box(x, floorY + h, 36.7, x + 2, floorY + h + 0.5, 43.3));
  }

  // Timber sets and dead string lights establish the old lower gallery; the wiring continues to the Hall.
  const cablePositions: THREE.Vector3[] = [], bulbPositions: THREE.Vector3[] = [];
  for (let x = 263; x <= 320; x += 2) {
    const y = ground(x, 40);
    for (const z of [38.2, 41.8]) {
      addStaticBox(x, y + 1.4, z, 0.18, 2.8, 0.18, timber);
      if (x % 4 === 3) addStaticBox(x, y + 2.72, 40, 0.2, 0.18, 3.8, timber);
    }
    cablePositions.push(new THREE.Vector3(x + 1, y + 3.07, 40));
    if ((x - 263) % 6 === 0) {
      bulbPositions.push(new THREE.Vector3(x, y + 2.94, 40));
    }
  }
  const cableMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 5), cableMat, cablePositions.length);
  cableMesh.name = 'dead-string-light-wiring'; cableMesh.castShadow = false;
  const cableMatrix = new THREE.Matrix4(), cableRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  cablePositions.forEach((p, i) => { cableMatrix.compose(p, cableRotation, new THREE.Vector3(1, 1, 1)); cableMesh.setMatrixAt(i, cableMatrix); });
  cableMesh.instanceMatrix.needsUpdate = true; group.add(cableMesh);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 4), deadLamp, bulbPositions.length);
  bulbMesh.name = 'dead-string-lights'; bulbMesh.castShadow = false;
  const identity = new THREE.Quaternion();
  bulbPositions.forEach((p, i) => { cableMatrix.compose(p, identity, new THREE.Vector3(1, 1, 1)); bulbMesh.setMatrixAt(i, cableMatrix); });
  bulbMesh.instanceMatrix.needsUpdate = true; group.add(bulbMesh);

  // Small depot pocket, open to the gallery. The recorder sits visibly on a crate at its mouth.
  const depotX = 282, depotZ = 48.5, depotY = ground(depotX, depotZ);
  floorMesh(group, ground, 276, 288, 43.2, 53.5, '#38342d', 'depot-floor');
  for (const [x, z, sx, sz] of [[276, 48.4, 0.65, 10.3], [288, 48.4, 0.65, 10.3], [282, 53.5, 12.6, 0.65]] as const) {
    addStaticBox(x, depotY + 1.6, z, sx, 3.2, sz, rock);
    solids.push(box(x - sx / 2, depotY, z - sz / 2, x + sx / 2, depotY + 3.2, z + sz / 2));
  }
  const crate = meshBox(group, 281, ground(281, 46) + 0.34, 46, 0.9, 0.68, 0.72, timber, 'recorder-crate');
  const recorder = new THREE.Group(); recorder.name = 'voice-recorder'; recorder.position.set(281, ground(281, 46) + 0.74, 45.9); group.add(recorder);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.2), iron); recorder.add(body);
  const red = new THREE.MeshStandardMaterial({ color: '#a33b29', emissive: '#76291b', emissiveIntensity: 0.45 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), red); led.position.set(0.09, 0.075, 0.02); recorder.add(led);
  const recorderLight = new THREE.PointLight('#d39b54', 1.7, 4.2, 2); recorderLight.position.y = 0.45; recorder.add(recorderLight);
  const depotLamp = new THREE.PointLight('#c4945d', 3.2, 9, 2); depotLamp.position.set(281, ground(281, 46) + 2.65, 46.8); group.add(depotLamp);
  void crate;

  // Root warning and lunge. Creaking roots visibly hold one wall; the lash is a timed sweep across the gallery.
  const rootArm = new THREE.Group(); rootArm.name = 'warning-root-lash'; rootArm.position.set(295.8, ground(296, 40) + 0.55, 39.1); group.add(rootArm);
  const anchoredCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.4, -0.25, 0), new THREE.Vector3(0.3, 0.1, 0), new THREE.Vector3(0.6, 0.55, 0), new THREE.Vector3(0.2, 1.0, 0),
  ]);
  rootArm.add(new THREE.Mesh(new THREE.TubeGeometry(anchoredCurve, 12, 0.14, 6), rootMat));
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, 0.25, 0), new THREE.Vector3(0.65, 0.65, 0.4), new THREE.Vector3(1.15, 0.45, 1.1), new THREE.Vector3(1.5, 0.18, 2.6),
  ]);
  const lash = new THREE.Mesh(new THREE.TubeGeometry(lashCurve, 14, 0.11, 6), rootMat); lash.name = 'root-lash'; rootArm.add(lash);
  const crawlLamp = new THREE.PointLight('#bd8a4e', 3.8, 9, 2); crawlLamp.position.set(302, ground(302, 40) + 2.35, 40); group.add(crawlLamp);
  const dust = new THREE.Group(); dust.name = 'falling-dust'; group.add(dust);
  for (let i = 0; i < 11; i++) {
    const grain = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (i % 3) * 0.018, 4, 3), new THREE.MeshBasicMaterial({ color: '#b1a080', transparent: true, opacity: 0.45 }));
    grain.position.set(293.5 + (i % 5) * 0.7, ground(296, 40) + 2.8 + Math.random() * 0.35, 38.5 + (i % 4) * 0.9); dust.add(grain);
  }

  // Four unnamed Bound Ravens at the card table: this transformation reveal belongs in the tunnels, not the Prologue Hall.
  floorMesh(group, ground, 309, 323, 36, 49, '#342f29', 'card-room-floor');
  for (const [x, z, sx, sz] of [[309, 47, 0.7, 6], [323, 47, 0.7, 6], [316, 50, 14, 0.7]] as const) {
    addStaticBox(x, ground(316, 42) + 2.6, z, sx, 5.2, sz, rock);
    solids.push(box(x - sx / 2, ground(316, 42), z - sz / 2, x + sx / 2, ground(316, 42) + 5.2, z + sz / 2));
  }
  addStaticBox(316, ground(316, 47) + 0.95, 47, 2.1, 0.2, 0.9, wood);
  const cardLamp = new THREE.PointLight('#c19a68', 4.2, 13, 2); cardLamp.position.set(316, ground(316, 42) + 2.6, 43.2); group.add(cardLamp);
  for (let i = 0; i < 5; i++) {
    const z = 44.6 + i * 1.05, x = i === 4 ? 319.2 : 312.8;
    addStaticBox(x, ground(x, z) + 0.52, z, 0.68, 1.04, 0.58, timber);
    if (i < 4) {
      const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 3, 6), dark); bodyMesh.position.set(x, ground(x, z) + 1.48, z - 0.2); bodyMesh.rotation.z = -0.18; bodyMesh.castShadow = true; group.add(bodyMesh);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 6, 5), dark); head.position.set(x, ground(x, z) + 2.05, z - 0.3); group.add(head);
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, ground(x, z) + 0.08, z + 0.15), new THREE.Vector3(x + 0.2, ground(x, z) + 0.7, z), new THREE.Vector3(x, ground(x, z) + 1.4, z - 0.15),
      ]), 8, 0.06, 5), rootMat); group.add(cord);
    }
  }

  // Breakthrough Hall, with the animals facing the daylight well. No bodies or dialogue are added here.
  floorMesh(group, ground, 322, 365, 20, 64, '#39372f', 'hall-floor');
  const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 28, 18), rock);
  dome.position.set(344, ground(344, 42) + 7.3, 42); dome.scale.set(1.15, 0.92, 1.08); dome.name = 'cave-hall-shell'; group.add(dome);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 16, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#d7d0b4', transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide }));
  well.position.set(344, ground(344, 42) + 8, 42); well.name = 'hall-daylight-well'; group.add(well);
  const wellLight = new THREE.PointLight('#d5cba8', 6, 38, 2.2); wellLight.position.set(344, ground(344, 42) + 14, 42); group.add(wellLight);
  const hallFill = new THREE.PointLight('#b79d75', 4.4, 24, 2); hallFill.position.set(341, ground(341, 42) + 3, 42); group.add(hallFill);
  const animalLoader = new GLTFLoader();
  const ready = Promise.all([
    animalLoader.loadAsync(`${import.meta.env.BASE_URL}models/animals/cow.glb`).catch(() => null),
    animalLoader.loadAsync(`${import.meta.env.BASE_URL}models/animals/sheep.glb`).catch(() => null),
  ]).then(([cowAsset, sheepAsset]) => {
    const cows = [[340, 38], [342.5, 35.8], [338, 34.4], [346, 37.2], [349, 40.5], [341, 45.5], [348, 47.5]];
    for (let i = 0; i < cows.length; i++) {
      const [x, z] = cows[i], animal = cowAsset ? cloneSkeleton(cowAsset.scene) : new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshStandardMaterial({ color: i % 3 ? '#d8d1c1' : '#343330', roughness: 1 }));
      animal.position.set(x, ground(x, z), z); animal.scale.setScalar(cowAsset ? 0.9 : 1); animal.rotation.y = Math.PI; animal.name = 'preserved-cow';
      animal.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); group.add(animal);
    }
    if (sheepAsset) for (const [x, z] of [[337, 40.5], [345.5, 43.5], [351, 35.7], [336, 46]]) {
      const animal = cloneSkeleton(sheepAsset.scene); animal.position.set(x, ground(x, z), z); animal.rotation.y = Math.PI; animal.name = 'preserved-sheep';
      animal.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); group.add(animal);
    }
  });
  const joseph = new THREE.Group(); joseph.name = 'preserved-joseph-silhouette'; joseph.position.set(339, ground(339, 42), 42); group.add(joseph);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.95, 7), new THREE.MeshStandardMaterial({ color: '#92734e', roughness: 1, emissive: '#241609', emissiveIntensity: 0.2 })); coat.position.y = 0.72; joseph.add(coat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), new THREE.MeshStandardMaterial({ color: '#c0a27d', roughness: 1 })); head.position.y = 1.34; joseph.add(head);
  for (let i = 0; i < 5; i++) {
    const x = 343.5 + (i % 2) * 0.45, z = 42 + (i - 2) * 0.55;
    const root = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 1.4, ground(x, z) + 0.1, z), new THREE.Vector3(x - 0.55, ground(x, z) + 0.35, z), new THREE.Vector3(x, ground(x, z) + 0.08, z),
    ]), 10, 0.075, 5), rootMat); root.name = 'hall-preserving-root'; group.add(root);
  }
  // A narrow, visibly brighter cave mouth follows the Hall to the east.
  addTunnel(360, 375, 39.1, 44.9, 2.55);
  const mouthX = 376, mouthZ = 42, mouthY = ground(mouthX, mouthZ);
  const mouthGlow = new THREE.PointLight('#e0cda0', 4.2, 28, 2); mouthGlow.position.set(mouthX + 2, mouthY + 2.4, mouthZ); group.add(mouthGlow);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: '#e0cda0', transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }));
  mouth.position.set(mouthX + 0.5, mouthY + 2.45, mouthZ); mouth.rotation.y = Math.PI / 2; mouth.name = 'cave-mouth-light'; group.add(mouth);
  // Roots close the entrance crawlway only after filming; their root curtain stays behind the player.
  const closingRoots = new THREE.Group(); closingRoots.position.set(318, ground(318, 40) + 0.2, 40); closingRoots.name = 'closing-root-crawlway'; group.add(closingRoots);
  for (let i = 0; i < 7; i++) {
    const x = -1.8 + i * 0.6;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 3.05, -2), new THREE.Vector3(x + 0.3, 2.2, -1.2), new THREE.Vector3(x - 0.2, 1.1, 0), new THREE.Vector3(x + 0.15, 0.08, 1.8)]);
    closingRoots.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.095, 5), rootMat));
  }
  closingRoots.visible = false;

  const examinables: Examinable[] = [
    { id: 'ch2-mine-gate', name: { ar: 'بوابة المنجم', en: "Ravens' mine gate" },
      line: { ar: 'البوابة مفتوحة. مصابيح الخيط ميتة، والسلك يمتد إلى الداخل.', en: 'The gate hangs open. The string lights are dead; their cable runs deeper inside.' },
      pos: { x: portalX, y: portalY + 2.3, z: portalZ }, r: 1.1, from: { x: portalX - 2, y: portalY, z: portalZ } },
    { id: 'ch2-recorder', name: { ar: 'مسجّل صوتي', en: 'Voice recorder' },
      line: { ar: '«أغلقوا البوابة! الحيطان تتحرك!»', en: '“Shut the gate! The walls are moving!”' },
      pos: { x: 281, y: ground(281, 46) + 0.85, z: 45.9 }, r: 0.45, from: { x: 281, y: ground(281, 46), z: 44.4 } },
  ];

  flushStaticBoxes();

  function setHazard(warning: boolean, lashing: boolean, closing: boolean) {
    rootArm.scale.set(1, 1, lashing ? 1 : 0.34);
    rootArm.rotation.y = lashing ? -0.7 : warning ? 0.06 : 0;
    dust.visible = warning;
    closingRoots.visible = closing;
  }
  return { group, solids, examinables, rootArm, hallTarget: new THREE.Vector3(339, ground(339, 42) + 1.25, 42), ready, setHazard };
}
