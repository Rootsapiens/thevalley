import * as THREE from 'three';
import palette from '../studio/art/palette.json';

/** A small in-engine capture beat: roots climb around the first-person player at the cave-path boundary. */
export interface PrologueRoots {
  grow(x: number, y: number, z: number, yaw: number, seconds: number): void;
  hide(): void;
}

const easeOut = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;

export function buildPrologueRoots(scene: THREE.Scene): PrologueRoots {
  const group = new THREE.Group();
  group.name = 'JosephPrologueRootCapture';
  const bark = new THREE.MeshStandardMaterial({ color: palette.rust, roughness: 0.96, metalness: 0.0 });
  const dark = new THREE.MeshStandardMaterial({ color: palette.hazardBlack, roughness: 0.98, metalness: 0.0 });
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.58, 0, sa * 0.58),
      new THREE.Vector3(ca * 0.78, 0.24, sa * 0.78),
      new THREE.Vector3(ca * 0.64, 0.86, sa * 0.64),
      new THREE.Vector3(ca * 0.24, 1.78 + (i % 3) * 0.08, sa * 0.24),
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
  }
  group.scale.y = 0;
  group.visible = false;
  scene.add(group);

  return {
    grow(x, y, z, yaw, seconds) {
      group.visible = true;
      group.position.set(x, y + 0.015, z);
      group.rotation.y = yaw;
      group.scale.y = easeOut(seconds / 1.8);
    },
    hide() {
      group.visible = false;
      group.scale.y = 0;
    },
  };
}
