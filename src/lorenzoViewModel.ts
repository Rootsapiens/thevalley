import * as THREE from 'three';

/** Lorenzo's visible first-person clothing, based on the film reference stills.
 * He wears a navy field jacket over a brown knit layer and a pale shirt. */
export class LorenzoViewModel {
  readonly group = new THREE.Group();
  private readonly arms: THREE.Mesh[] = [];
  private readonly hands: THREE.Mesh[] = [];
  private readonly cameraBody: THREE.Group;
  private readonly torso: THREE.Mesh;
  private readonly collar: THREE.Mesh;
  private readonly chestDetails: THREE.Mesh[] = [];
  private readonly chestBaseY: number[] = [];
  private readonly fingers: THREE.Mesh[] = [];
  private pose = 0;
  private readonly sleeve = new THREE.MeshStandardMaterial({ color: 0x202a38, roughness: 0.93 });
  private readonly seam = new THREE.MeshStandardMaterial({ color: 0x34404a, roughness: 0.96 });
  private readonly knit = new THREE.MeshStandardMaterial({ color: 0x46382e, roughness: 1 });
  private readonly shirt = new THREE.MeshStandardMaterial({ color: 0xd5d1c7, roughness: 0.95 });
  private readonly skin = new THREE.MeshStandardMaterial({ color: 0x80604d, roughness: 0.95 });
  private readonly cameraMat = new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 0.5, metalness: 0.24 });
  private readonly glass = new THREE.MeshStandardMaterial({ color: 0x273d48, roughness: 0.18, metalness: 0.4 });
  private readonly zipper = new THREE.MeshStandardMaterial({ color: 0x9b968b, roughness: 0.62, metalness: 0.35 });

  constructor(camera: THREE.Camera) {
    this.group.name = 'lorenzo-film-reference-viewmodel';
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.095), this.knit);
    this.torso.name = 'lorenzo-brown-knit-sweater'; this.torso.position.set(0, -0.8, -0.43);
    this.torso.frustumCulled = false; this.torso.renderOrder = 19; this.group.add(this.torso);
    // The film reference shows a navy outer jacket over a brown zip knit and pale shirt.
    // Keep the layers legible from the low first-person camera angle.
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.205, 0.026), this.sleeve);
      panel.name = `lorenzo-navy-jacket-front-${side < 0 ? 'left' : 'right'}`;
      panel.position.set(side * 0.135, -0.8, -0.485);
      panel.frustumCulled = false; panel.renderOrder = 20; this.chestDetails.push(panel); this.chestBaseY.push(panel.position.y); this.group.add(panel);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.043, 0.012), this.sleeve);
      pocket.name = 'lorenzo-jacket-chest-pocket'; pocket.position.set(side * 0.14, -0.77, -0.503);
      pocket.frustumCulled = false; pocket.renderOrder = 21; this.chestDetails.push(pocket); this.chestBaseY.push(pocket.position.y); this.group.add(pocket);
    }
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.17, 0.008), this.zipper);
    zip.name = 'lorenzo-knit-front-zipper'; zip.position.set(0, -0.805, -0.501);
    zip.frustumCulled = false; zip.renderOrder = 22; this.chestDetails.push(zip); this.chestBaseY.push(zip.position.y); this.group.add(zip);
    const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.027, 0.009), this.zipper);
    zipPull.name = 'lorenzo-knit-zip-pull'; zipPull.position.set(0.008, -0.742, -0.506);
    zipPull.frustumCulled = false; zipPull.renderOrder = 22; this.chestDetails.push(zipPull); this.chestBaseY.push(zipPull.position.y); this.group.add(zipPull);
    this.collar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.085, 0.025), this.shirt);
    this.collar.name = 'lorenzo-pale-shirt-collar'; this.collar.position.set(0, -0.69, -0.49);
    this.collar.frustumCulled = false; this.collar.renderOrder = 20; this.group.add(this.collar);
    // The stills show a layered open jacket and collared shirt. Small lapel and seam
    // pieces keep the silhouette readable in first person without a flat color block.
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BufferGeometry(), this.sleeve);
      const x = side;
      lapel.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0, x * 0.09, 0.045, 0, x * 0.17, -0.13, 0,
      ], 3));
      lapel.geometry.setIndex(side < 0 ? [0, 2, 1] : [0, 1, 2]); lapel.geometry.computeVertexNormals();
      lapel.name = `lorenzo-jacket-lapel-${side < 0 ? 'left' : 'right'}`;
      lapel.position.set(0, -0.7, -0.51); lapel.frustumCulled = false; lapel.renderOrder = 21; this.group.add(lapel);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.15, 0.008), this.seam);
      seam.name = `lorenzo-jacket-stitch-${side < 0 ? 'left' : 'right'}`;
      seam.position.set(side * 0.176, -0.82, -0.506); seam.frustumCulled = false; seam.renderOrder = 22;
      this.chestDetails.push(seam); this.chestBaseY.push(seam.position.y); this.group.add(seam);
    }
    const armGeo = new THREE.CapsuleGeometry(0.075, 0.31, 3, 7);
    const handGeo = new THREE.BoxGeometry(0.11, 0.13, 0.095);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, this.sleeve);
      arm.name = `lorenzo-${side < 0 ? 'left' : 'right'}-navy-sleeve`;
      arm.frustumCulled = false; arm.renderOrder = 20; this.arms.push(arm); this.group.add(arm);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.052, 8), this.shirt);
      cuff.name = 'lorenzo-pale-shirt-cuff'; cuff.frustumCulled = false; cuff.renderOrder = 21;
      this.arms.push(cuff); this.group.add(cuff);
      const hand = new THREE.Mesh(handGeo, this.skin);
      hand.name = 'lorenzo-bare-hand'; hand.frustumCulled = false; hand.renderOrder = 22;
      this.hands.push(hand); this.group.add(hand);
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.055, 2, 5), this.skin);
      finger.name = 'lorenzo-fingers'; finger.frustumCulled = false; finger.renderOrder = 23;
      this.hands.push(finger); this.group.add(finger);
      // Four fingers and a thumb read more like the bare hands in the film stills
      // when the camcorder comes up. These stay subtle when lowered out of frame.
      for (let digit = 0; digit < 4; digit++) {
        const detail = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.053, 2, 5), this.skin);
        detail.name = `lorenzo-finger-${digit + 1}`;
        detail.frustumCulled = false; detail.renderOrder = 24; this.fingers.push(detail); this.group.add(detail);
      }
    }

    // Compact shoulder camera with a visible lens, matching his on-camera reporter role.
    this.cameraBody = new THREE.Group(); this.cameraBody.name = 'lorenzo-handheld-camcorder';
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.13), this.cameraMat);
    housing.position.y = -0.01; this.cameraBody.add(housing);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.055, 12), this.cameraMat);
    lens.rotation.x = Math.PI / 2; lens.position.set(0.035, 0.005, -0.087); this.cameraBody.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), this.glass);
    glass.position.set(0.035, 0.005, -0.116); this.cameraBody.add(glass);
    const viewfinder = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 0.07), this.cameraMat);
    viewfinder.position.set(-0.095, 0.07, 0.025); this.cameraBody.add(viewfinder);
    const topMic = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.025), this.cameraMat);
    topMic.position.set(0.04, 0.084, 0.018); this.cameraBody.add(topMic);
    this.cameraBody.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).frustumCulled = false; (o as THREE.Mesh).renderOrder = 24; } });
    this.group.add(this.cameraBody);
    this.group.renderOrder = 10;
    camera.add(this.group);
    this.tick(false, 0, 0, 1);
  }

  tick(raised: boolean, speed: number, time: number, dt: number): void {
    this.pose += ((raised ? 1 : 0) - this.pose) * Math.min(1, dt * 9);
    const p = this.pose, bob = Math.sin(time * 8) * Math.min(speed / 4, 1) * 0.008;
    this.cameraBody.visible = p > 0.015;
    this.torso.position.y = -0.8 + 0.12 * p + bob;
    this.collar.position.y = -0.69 + 0.12 * p + bob;
    this.chestDetails.forEach((mesh, i) => { mesh.position.y = this.chestBaseY[i] + 0.12 * p + bob; });
    this.cameraBody.position.set(0, -0.6 + 0.38 * p + bob, -0.79);
    this.cameraBody.rotation.set(-0.05, 0, 0);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const shoulder = new THREE.Vector3(side * (0.47 - 0.08 * p), -0.82 + 0.22 * p + bob, -0.42);
      const wrist = new THREE.Vector3(side * (0.16 - 0.025 * p), -0.7 + 0.42 * p + bob, -0.78);
      const arm = this.arms[i * 2];
      const direction = wrist.clone().sub(shoulder);
      arm.position.copy(shoulder).add(wrist).multiplyScalar(0.5);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      arm.scale.y = 0.9 + direction.length() * 0.35;
      const cuff = this.arms[i * 2 + 1];
      cuff.position.copy(wrist); cuff.quaternion.copy(arm.quaternion);
      const hand = this.hands[i * 2];
      hand.position.set(side * (0.13 - 0.025 * p), -0.68 + 0.42 * p + bob, -0.755);
      hand.rotation.z = side * (0.28 + 0.25 * p);
      const fingers = this.hands[i * 2 + 1];
      fingers.position.set(side * (0.18 - 0.025 * p), -0.685 + 0.42 * p + bob, -0.8);
      fingers.rotation.set(Math.PI / 2, 0, side * -0.72);
      for (let digit = 0; digit < 4; digit++) {
        const detail = this.fingers[i * 4 + digit];
        const offset = (digit - 1.5) * 0.022;
        detail.position.set(side * (0.13 - 0.025 * p) + offset, -0.68 + 0.42 * p + bob, -0.81);
        detail.rotation.set(Math.PI / 2, 0, (digit - 1.5) * 0.06);
      }
    }
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    for (const m of [this.sleeve, this.seam, this.knit, this.shirt, this.skin, this.cameraMat, this.glass, this.zipper]) m.dispose();
  }
}
