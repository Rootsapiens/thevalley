import * as THREE from 'three';

/** Full-body, low-poly Lorenzo, styled from the owner's film stills. */
export class LorenzoPlayerModel {
  readonly root = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly head: THREE.Group;
  private readonly jacket = new THREE.MeshStandardMaterial({ color: 0x263444, roughness: 0.84 });
  private readonly jacketEdge = new THREE.MeshStandardMaterial({ color: 0x3c4b58, roughness: 0.86 });
  private readonly knit = new THREE.MeshStandardMaterial({ color: 0x594436, roughness: 0.96 });
  private readonly shirt = new THREE.MeshStandardMaterial({ color: 0xc9c8bf, roughness: 0.94 });
  private readonly skin = new THREE.MeshStandardMaterial({ color: 0x8b674f, roughness: 0.94 });
  private readonly hair = new THREE.MeshStandardMaterial({ color: 0x292a29, roughness: 0.92 });
  private readonly hairGrey = new THREE.MeshStandardMaterial({ color: 0x777875, roughness: 0.94 });
  private readonly eyeWhites = new THREE.MeshStandardMaterial({ color: 0xb6aa94, roughness: 0.9 });
  private readonly stubble = new THREE.MeshStandardMaterial({ color: 0x4b4038, roughness: 1 });
  private readonly trousers = new THREE.MeshStandardMaterial({ color: 0x292c31, roughness: 0.95 });
  private readonly boots = new THREE.MeshStandardMaterial({ color: 0x25231f, roughness: 0.82 });
  private readonly zipper = new THREE.MeshStandardMaterial({ color: 0xaaa69b, roughness: 0.45, metalness: 0.35 });
  private readonly shadows = new THREE.MeshBasicMaterial({ color: 0x090a0a, transparent: true, opacity: 0.3, depthWrite: false });

  constructor(scene: THREE.Scene) {
    this.root.name = 'lorenzo-film-reference-player';
    const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name: string, position: THREE.Vector3, scale?: THREE.Vector3) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name; mesh.position.copy(position);
      if (scale) mesh.scale.copy(scale);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
      return mesh;
    };
    const capsule = (parent: THREE.Object3D, material: THREE.Material, name: string, at: [number, number, number], radius: number, length: number, scale: [number, number, number] = [1, 1, 1]) =>
      add(parent, new THREE.CapsuleGeometry(radius, length, 4, 9), material, name, new THREE.Vector3(...at), new THREE.Vector3(...scale));

    // Trousers and boots, with shoulder pivots for a relaxed walk cycle.
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.105, 0.91, 0); leg.name = `lorenzo-${side < 0 ? 'left' : 'right'}-leg`;
      capsule(leg, this.trousers, 'trouser-leg', [0, -0.22, 0], 0.085, 0.28, [0.95, 1, 0.95]);
      capsule(leg, this.trousers, 'lower-trouser-leg', [0, -0.58, 0], 0.062, 0.25, [0.92, 1, 0.95]);
      capsule(leg, this.boots, 'leather-boot', [0, -0.78, -0.045], 0.069, 0.12, [1, 0.68, 1.6]);
      this.root.add(leg); this.legs.push(leg);

      const arm = new THREE.Group(); arm.position.set(side * 0.245, 1.37, 0); arm.name = `lorenzo-${side < 0 ? 'left' : 'right'}-arm`;
      capsule(arm, this.jacket, 'field-jacket-sleeve', [side * 0.012, -0.19, 0], 0.083, 0.22, [1, 1, 0.92]);
      capsule(arm, this.jacket, 'lower-field-jacket-sleeve', [side * 0.025, -0.49, -0.015], 0.066, 0.22, [1, 1, 0.92]);
      capsule(arm, this.shirt, 'shirt-cuff', [side * 0.028, -0.62, -0.019], 0.068, 0.045, [1, 1, 0.94]);
      capsule(arm, this.skin, 'bare-hand', [side * 0.03, -0.72, -0.02], 0.06, 0.08, [0.9, 1, 0.8]);
      this.root.add(arm); this.arms.push(arm);
    }

    // A tapered, rounded silhouette keeps the clothes readable at the game's village scale.
    capsule(this.root, this.trousers, 'trouser-waist', [0, 0.94, 0.005], 0.18, 0.14, [1.14, 0.72, 0.78]);
    capsule(this.root, this.jacket, 'navy-field-jacket', [0, 1.22, 0], 0.225, 0.28, [1.11, 1.0, 0.74]);
    capsule(this.root, this.knit, 'brown-zip-knit-layer', [0, 1.22, -0.17], 0.12, 0.27, [0.9, 1.0, 0.15]);
    // The navy field jacket, brown knit, and pale collar follow Lorenzo's film look.
    // Give the rear silhouette the same tailored read when the camera follows him.
    capsule(this.root, this.jacketEdge, 'field-jacket-back-yoke', [0, 1.36, 0.166], 0.16, 0.055, [1.24, 0.38, 0.18]);
    add(this.root, new THREE.BoxGeometry(0.012, 0.31, 0.012), this.jacketEdge, 'field-jacket-back-seam', new THREE.Vector3(0, 1.20, 0.174));
    for (const side of [-1, 1]) {
      const pocket = add(this.root, new THREE.BoxGeometry(0.13, 0.12, 0.018), this.jacket, 'field-jacket-back-pocket', new THREE.Vector3(side * 0.105, 1.11, 0.168));
      const flap = add(this.root, new THREE.BoxGeometry(0.145, 0.032, 0.022), this.jacketEdge, 'field-jacket-pocket-flap', new THREE.Vector3(side * 0.105, 1.17, 0.181));
      pocket.rotation.z = side * -0.035; flap.rotation.z = side * -0.035;
      add(this.root, new THREE.SphereGeometry(0.012, 7, 5), this.zipper, 'jacket-pocket-snap', new THREE.Vector3(side * 0.105, 1.16, 0.195));
    }
    // Open jacket fronts and lapels frame the sweater, as in the close-up references.
    for (const side of [-1, 1]) {
      const lapel = add(this.root, new THREE.BoxGeometry(0.075, 0.36, 0.025), this.jacketEdge, 'jacket-lapel', new THREE.Vector3(side * 0.105, 1.34, -0.163));
      lapel.rotation.z = side * -0.16;
      const panel = add(this.root, new THREE.BoxGeometry(0.065, 0.36, 0.025), this.jacket, 'open-jacket-front', new THREE.Vector3(side * 0.17, 1.23, -0.134));
      panel.rotation.z = side * -0.05;
    }
    add(this.root, new THREE.BoxGeometry(0.13, 0.12, 0.022), this.shirt, 'pale-collared-shirt', new THREE.Vector3(0, 1.47, -0.156));
    for (const side of [-1, 1]) {
      const collar = add(this.root, new THREE.BoxGeometry(0.065, 0.10, 0.035), this.shirt, 'shirt-collar-point', new THREE.Vector3(side * 0.045, 1.43, -0.183));
      collar.rotation.z = side * -0.2;
    }
    add(this.root, new THREE.BoxGeometry(0.008, 0.25, 0.008), this.zipper, 'knit-zipper', new THREE.Vector3(0, 1.20, -0.19));
    for (const y of [1.09, 1.17, 1.25]) add(this.root, new THREE.SphereGeometry(0.009, 6, 5), this.zipper, 'zip-knit-button', new THREE.Vector3(0.016, y, -0.197));

    this.head = new THREE.Group(); this.head.position.set(0, 1.53, 0); this.head.name = 'lorenzo-head'; this.root.add(this.head);
    add(this.head, new THREE.SphereGeometry(0.122, 14, 10), this.skin, 'weathered-olive-face', new THREE.Vector3(0, 0.13, -0.008), new THREE.Vector3(0.96, 1.08, 0.9));
    // Short, close stubble gives Lorenzo the same mature, road-worn face as the film stills.
    add(this.head, new THREE.SphereGeometry(0.119, 14, 9, 0, Math.PI * 2, 1.05, 0.42), this.stubble,
      'close-dark-stubble', new THREE.Vector3(0, 0.015, -0.017), new THREE.Vector3(0.96, 0.92, 0.88));
    add(this.head, new THREE.SphereGeometry(0.027, 9, 7), this.skin, 'defined-nose', new THREE.Vector3(0, 0.125, -0.132), new THREE.Vector3(0.62, 1.1, 1.18));
    for (const side of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.022, 8, 6), this.skin, 'ear', new THREE.Vector3(side * 0.113, 0.14, 0), new THREE.Vector3(0.5, 1, 0.68));
      const brow = add(this.head, new THREE.BoxGeometry(0.041, 0.014, 0.014), this.hair, 'strong-dark-brow', new THREE.Vector3(side * 0.039, 0.166, -0.113));
      brow.rotation.z = side * 0.08;
      add(this.head, new THREE.SphereGeometry(0.009, 7, 5), this.eyeWhites, 'eye-white', new THREE.Vector3(side * 0.038, 0.145, -0.119), new THREE.Vector3(1.15, 0.7, 0.45));
      add(this.head, new THREE.SphereGeometry(0.004, 6, 5), this.hair, 'pupil', new THREE.Vector3(side * 0.038, 0.145, -0.124));
      const greyTemple = add(this.head, new THREE.SphereGeometry(0.043, 8, 6), this.hairGrey, 'grey-temple', new THREE.Vector3(side * 0.092, 0.198, -0.002), new THREE.Vector3(0.72, 1.35, 1));
      greyTemple.rotation.z = side * -0.12;
    }
    const hair = add(this.head, new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), this.hair, 'short-dark-swept-hair', new THREE.Vector3(0, 0.22, 0.005), new THREE.Vector3(0.98, 0.95, 0.9));
    hair.rotation.x = -0.08;
    const mouth = add(this.head, new THREE.BoxGeometry(0.052, 0.009, 0.009), this.hair, 'subtle-mouth', new THREE.Vector3(0, 0.078, -0.116));
    mouth.rotation.z = -0.025;
    // Film reference shows a mature face and short hair; these creases stay subtle in the low-poly art style.
    for (const y of [0.186, 0.198]) add(this.head, new THREE.BoxGeometry(0.075, 0.0025, 0.002), this.hairGrey, 'forehead-crease', new THREE.Vector3(0, y, -0.118));

    add(this.root, new THREE.CircleGeometry(0.28, 16).rotateX(-Math.PI / 2), this.shadows, 'soft-player-contact-shadow', new THREE.Vector3(0, 0.012, 0));
    // Soft local fill keeps facial detail readable in the dusk village without bleaching the shirt.
    const fill = new THREE.PointLight(0xffdfbf, 1.25, 2.8, 2);
    fill.name = 'soft-character-fill'; fill.position.set(0, 1.55, -0.38); this.root.add(fill);
    scene.add(this.root);
  }

  update(x: number, y: number, z: number, yaw: number, speed: number, time: number, crouched: boolean): void {
    const gait = Math.min(speed / 3.8, 1), stride = Math.sin(time * 9) * gait * 0.48;
    this.root.position.set(x, y + (gait ? Math.abs(Math.sin(time * 18)) * 0.018 : 0), z);
    this.root.rotation.y = yaw;
    this.root.scale.set(1, crouched ? 0.72 : 1, 1);
    this.head.rotation.x = Math.sin(time * 1.3) * 0.012;
    this.legs[0].rotation.x = stride; this.legs[1].rotation.x = -stride;
    this.arms[0].rotation.x = -stride * 0.68; this.arms[1].rotation.x = stride * 0.68;
  }

  dispose(): void {
    this.root.parent?.remove(this.root);
    this.root.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    for (const m of [this.jacket, this.jacketEdge, this.knit, this.shirt, this.skin, this.hair, this.hairGrey, this.eyeWhites, this.stubble, this.trousers, this.boots, this.zipper, this.shadows]) m.dispose();
  }
}
