import * as THREE from 'three';
import palette from '../studio/art/palette.json';

/** Roots rise ahead of Joseph, then reach his legs. The camera stays outside the thick stems. */
export interface PrologueRoots {
  grow(x: number, y: number, z: number, yaw: number, seconds: number): void;
  hide(): void;
}

const easeOut = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

export function buildPrologueRoots(scene: THREE.Scene): PrologueRoots {
  const group = new THREE.Group();
  group.name = 'JosephPrologueRootCapture';
  const bark = new THREE.MeshStandardMaterial({ color: '#4f3024', roughness: 0.96, metalness: 0.0 });
  const dark = new THREE.MeshStandardMaterial({ color: palette.hazardBlack, roughness: 0.98, metalness: 0.0 });
  const edge = new THREE.MeshStandardMaterial({ color: '#b8794b', emissive: '#3b180b', emissiveIntensity: 0.3, roughness: 0.94 });
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.58, 0, sa * 0.58),
      new THREE.Vector3(ca * 0.78, 0.24, sa * 0.78),
      new THREE.Vector3(ca * 0.64 + Math.sin(i * 2.5) * 0.16, 0.86, sa * 0.64),
      new THREE.Vector3(ca * 0.24 + Math.sin(i * 1.7) * 0.17, 1.78 + (i % 3) * 0.08, sa * 0.24),
    ]);
    const main = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, i % 2 ? 0.085 : 0.11, 5, false), bark);
    main.castShadow = false; main.receiveShadow = true; group.add(main);

    const branch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.69, 0.52, sa * 0.69),
      new THREE.Vector3(ca * 0.98, 0.82, sa * 0.98),
      new THREE.Vector3(ca * 0.94, 1.18, sa * 0.94),
    ]);
    const twig = new THREE.Mesh(new THREE.TubeGeometry(branch, 8, 0.035, 4, false), dark);
    twig.castShadow = false; twig.receiveShadow = true; group.add(twig);
    const vein = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.017, 4, false), edge);
    vein.position.x = ca * 0.07; vein.position.z = sa * 0.07;
    group.add(vein);
  }
  const reach = new THREE.Group();
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.72, 0.08, 0.35),
      new THREE.Vector3(side * 0.75, 0.35, 0.75),
      new THREE.Vector3(side * 0.5, 0.95, 1.25),
      new THREE.Vector3(side * 0.23, 1.42, 1.55),
    ]);
    reach.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.072, 6, false), bark));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.24, 6), edge);
    tip.position.copy(curve.getPoint(1));
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1));
    reach.add(tip);
  }
  group.add(reach);
  group.scale.y = 0;
  group.visible = false;
  scene.add(group);

  return {
    grow(x, y, z, yaw, seconds) {
      group.visible = true;
      // Two metres ahead keeps the rising stems visible instead of placing the
      // first-person camera inside opaque tubes that fill the whole image.
      group.position.set(x - Math.sin(yaw) * 2, y + 0.015, z - Math.cos(yaw) * 2);
      group.rotation.y = yaw;
      group.scale.y = easeOut(seconds / 2.1);
      reach.scale.y = easeOut((seconds - 0.55) / 1.45);
    },
    hide() {
      group.visible = false;
      group.scale.y = 0;
    },
  };
}
