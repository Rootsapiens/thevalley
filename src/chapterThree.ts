import * as THREE from 'three';

/** Chapter 3 tower dressing and the four marked ladder flights. The existing village tower remains the shell. */
export function buildChapterThree(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = 'chapter-3-bell-tower';
  scene.add(group);
  const timber = new THREE.MeshStandardMaterial({ color: '#563f2b', roughness: 0.92 });
  const worn = new THREE.MeshStandardMaterial({ color: '#82755d', roughness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: '#aa8748', roughness: 0.62, metalness: 0.35 });
  const stone = new THREE.MeshStandardMaterial({ color: '#282b2a', roughness: 1 });
  const ladderX = 2.5, ladderZ = 25.72, topY = 20;
  const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  };
  const addRod = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) => {
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true; group.add(mesh);
  };
  // The four landings make each ladder flight visible and give the player a clear progress landmark.
  for (let flight = 0; flight < 4; flight++) {
    const y0 = flight * 5, y1 = y0 + 5;
    addRod(new THREE.Vector3(ladderX - 0.42, y0, ladderZ), new THREE.Vector3(ladderX - 0.42, y1, ladderZ), 0.055, timber);
    addRod(new THREE.Vector3(ladderX + 0.42, y0, ladderZ), new THREE.Vector3(ladderX + 0.42, y1, ladderZ), 0.055, timber);
    for (let step = 1; step <= 10; step++) {
      const y = y0 + step * 0.5;
      addRod(new THREE.Vector3(ladderX - 0.42, y, ladderZ), new THREE.Vector3(ladderX + 0.42, y, ladderZ), 0.028, worn);
    }
    if (flight < 3) {
      const side = flight % 2 === 0 ? 1 : -1;
      addBox(ladderX + side * 0.42, y1 + 0.04, ladderZ + 0.33, 1.25, 0.1, 0.86, stone);
      addBox(ladderX, y1 + 0.23, ladderZ + 0.33, 0.08, 0.34, 0.08, brass);
    }
  }
  // Top landing and a plain camcorder upload marker; no fictional device or network brand.
  addBox(ladderX, topY + 0.04, ladderZ + 0.36, 1.35, 0.12, 1.0, stone);
  addBox(ladderX + 0.52, topY + 0.62, ladderZ + 0.6, 0.08, 1.2, 0.08, brass);
  addRod(new THREE.Vector3(ladderX + 0.52, topY + 1.18, ladderZ + 0.6), new THREE.Vector3(ladderX + 0.52, topY + 1.55, ladderZ + 0.6), 0.035, brass);
  const lamp = new THREE.PointLight('#e8a951', 2.2, 7, 2);
  lamp.position.set(ladderX, topY + 1.65, ladderZ + 0.5); group.add(lamp);
  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 5, 18), new THREE.MeshBasicMaterial({ color: '#e8a951' }));
  marker.rotation.x = Math.PI / 2; marker.position.set(ladderX, topY + 0.13, ladderZ + 0.36); group.add(marker);
  // Four north windows and three south windows (the south doorway replaces one); two candles on every sill = 14.
  const candleSpots: Array<[number, number]> = [];
  for (const z of [27.02, 34.48]) {
    const xs = z < 30 ? [7.375, 12.125, 16.875, 21.625] : [12.125, 16.875, 21.625];
    for (const x of xs) for (const side of [-1, 1]) candleSpots.push([x + side * 0.18, z]);
  }
  const candleBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.07, 0.25, 7), brass, 14);
  const candleFlame = new THREE.InstancedMesh(new THREE.ConeGeometry(0.045, 0.13, 5), new THREE.MeshBasicMaterial({ color: '#ffc56b' }), 14);
  const candlePose = new THREE.Object3D();
  candleSpots.forEach(([x, z], i) => {
    candlePose.position.set(x, 2.54, z); candlePose.rotation.set(0, 0, 0); candlePose.updateMatrix(); candleBody.setMatrixAt(i, candlePose.matrix);
    candlePose.position.set(x, 2.73, z); candlePose.rotation.set(0, 0, 0); candlePose.updateMatrix(); candleFlame.setMatrixAt(i, candlePose.matrix);
  });
  candleBody.instanceMatrix.needsUpdate = candleFlame.instanceMatrix.needsUpdate = true;
  candleBody.castShadow = true; group.add(candleBody, candleFlame);
  const vigilGlow = new THREE.PointLight('#df9e4e', 1.25, 18, 2);
  vigilGlow.position.set(14.5, 3.0, 31); group.add(vigilGlow);
  const vehicles = new THREE.Group();
  vehicles.visible = false;
  group.add(vehicles);
  const tireMat = new THREE.MeshStandardMaterial({ color: '#121313', roughness: 1 });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#333a39', roughness: 0.45, metalness: 0.25 });
  for (let i = 0; i < 4; i++) {
    const x = 26 + i * 7.2, z = 103 + (i % 2) * 3;
    const van = new THREE.Group(); vehicles.add(van); van.position.set(x, -1.025, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 4.6), stone); body.position.y = 0.95; body.castShadow = true; van.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.9, 2.1), windowMat); cabin.position.set(0, 1.86, -0.25); cabin.castShadow = true; van.add(cabin);
    for (const wx of [-0.88, 0.88]) for (const wz of [-1.45, 1.45]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.18, 10), tireMat);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(wx, 0.42, wz); van.add(wheel);
    }
    const beam = new THREE.SpotLight('#ffd894', 0, 56, Math.PI / 5, 0.75, 1.3);
    beam.position.set(0, 1.6, -2.25); beam.target.position.set(0, 4, -22); van.add(beam, beam.target);
    van.userData.beam = beam;
  }
  const showVehicles = () => {
    vehicles.visible = true;
    vehicles.traverse(obj => { if (obj instanceof THREE.SpotLight) obj.intensity = 26; });
  };
  const resetVehicles = () => {
    vehicles.visible = false;
    vehicles.traverse(obj => { if (obj instanceof THREE.SpotLight) obj.intensity = 0; });
  };
  const grabbingHands = new THREE.Group();
  grabbingHands.visible = false;
  const sleeve = new THREE.MeshStandardMaterial({ color: '#201e1b', roughness: 1 });
  const glove = new THREE.MeshStandardMaterial({ color: '#77634c', roughness: 1 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.58, 7), sleeve);
    arm.position.set(side * 0.22, -0.32, -0.62); arm.rotation.z = side * -0.22; grabbingHands.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.12), glove);
    hand.position.set(side * 0.2, -0.05, -0.68); grabbingHands.add(hand);
  }
  return { group, ladderX, ladderZ, topY, upload: { x: ladderX, y: topY, z: ladderZ + 0.36 }, showVehicles, resetVehicles, grabbingHands };
}
