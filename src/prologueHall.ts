import * as THREE from 'three';

/** Small authored reveal set for Joseph's first look into the mountain Hall. */
export interface PrologueHall {
  enter(): { x: number; y: number; z: number; yaw: number };
  tick(seconds: number): void;
  hide(): void;
}

export function buildPrologueHall(scene: THREE.Scene): PrologueHall {
  const root = new THREE.Group();
  root.name = 'JosephPrologueHallReveal';
  const origin = new THREE.Vector3(1000, 0, 1000);
  root.position.copy(origin);
  root.visible = false;
  scene.add(root);
  const rock = new THREE.MeshStandardMaterial({ color: '#242720', roughness: 1, side: THREE.BackSide });
  const floor = new THREE.MeshStandardMaterial({ color: '#39372c', roughness: 1 });
  const wet = new THREE.MeshStandardMaterial({ color: '#52686b', roughness: 0.24, metalness: 0.12 });
  const bark = new THREE.MeshStandardMaterial({ color: '#51412d', roughness: 1 });
  const oldWood = new THREE.MeshStandardMaterial({ color: '#6c5737', roughness: 0.96 });
  const cream = new THREE.MeshStandardMaterial({ color: '#b9af91', roughness: 1 });
  const shadow = new THREE.MeshStandardMaterial({ color: '#24221f', roughness: 1 });
  const amber = new THREE.PointLight('#cba06b', 1.5, 18, 2);
  amber.position.set(0, 7, -8); root.add(amber);
  const blue = new THREE.PointLight('#78989a', 1.8, 14, 2);
  blue.position.set(-7, 4, -3); root.add(blue);
  const rockShell = new THREE.Mesh(new THREE.SphereGeometry(19, 18, 12), rock);
  rockShell.position.set(0, 4.5, -8); rockShell.scale.set(1.5, 1, 1.1); root.add(rockShell);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(32, 0.45, 26), floor);
  slab.position.set(0, -0.25, -8); slab.receiveShadow = true; root.add(slab);
  const stream = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.035, 25), wet);
  stream.position.set(-5.1, 0.01, -8); root.add(stream);
  // Narrow side gallery recalls the Ravens' lower passages. The opening keeps the silhouettes readable at a glance.
  const galleryWall = new THREE.Mesh(new THREE.BoxGeometry(0.75, 5.2, 17), rock.clone());
  galleryWall.material.side = THREE.DoubleSide; galleryWall.position.set(11.6, 2.6, -8); root.add(galleryWall);
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.7, 0.7), bark); jamb.position.set(11.3, 1.85, -10.2); root.add(jamb);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 0.9), bark); lintel.position.set(11.7, 4.1, -10.2); root.add(lintel);
  // Root curtains frame the distant light column at the Well.
  for (let i = 0; i < 9; i++) {
    const x = -1.8 + i * 0.45;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 15, -16), new THREE.Vector3(x + Math.sin(i) * 0.7, 10, -16),
      new THREE.Vector3(x - Math.cos(i) * 0.6, 5, -16), new THREE.Vector3(x + Math.sin(i * 2) * 0.4, 0.2, -16),
    ]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.075, 5, false), bark); root.add(cord);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 17, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#b4b19a', transparent: true, opacity: 0.11, side: THREE.DoubleSide }));
  beam.position.set(0, 8.5, -17); root.add(beam);

  const makeCow = (x: number, z: number, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m;
    };
    add(new THREE.SphereGeometry(0.62, 9, 6), cream, 0, 1.0, 0, 1.08, 0.8, 1.35);
    add(new THREE.SphereGeometry(0.34, 8, 5), shadow, -0.32, 1.32, -0.15, 0.9, 0.9, 0.85);
    add(new THREE.SphereGeometry(0.34, 8, 5), cream, 0, 1.35, -0.78, 0.88, 0.9, 0.82);
    add(new THREE.SphereGeometry(0.19, 7, 5), oldWood, 0, 1.13, -1.02, 1, 0.6, 0.75);
    for (const lx of [-0.38, 0.38]) for (const lz of [-0.62, 0.62]) {
      const leg = add(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 5), cream, lx, 0.37, lz);
      leg.rotation.x = 0.06;
    }
    add(new THREE.SphereGeometry(0.075, 6, 4), oldWood, 0, 1.08, -0.62);
    return g;
  };
  // Preserved herd, all turned toward the Well; their mud trail ends beneath them.
  makeCow(1.1, -8.5, 0.92); makeCow(4.3, -11, 0.68); makeCow(2.9, -4.8, 0.7);
  for (let i = 0; i < 13; i++) {
    const x = -8 + (i % 5) * 1.1, z = -4 - Math.floor(i / 5) * 2.1;
    const hoof = new THREE.Mesh(new THREE.SphereGeometry(0.065, 5, 4), shadow);
    hoof.position.set(x, 0.035, z); hoof.scale.set(1, 0.18, 1.8); root.add(hoof);
  }
  // Joseph reaches for the bell cow. A child-sized silhouette avoids assigning an unapproved face or dialogue.
  const joseph = new THREE.Group(); joseph.position.set(1.15, 0, -6.1); root.add(joseph);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.33, 0.9, 7), oldWood); coat.position.y = 0.78; joseph.add(coat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), cream); head.position.set(0, 1.42, -0.03); joseph.add(head);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.78, 5), oldWood); arm.position.set(0.42, 1.02, -0.33); arm.rotation.x = -0.9; arm.rotation.z = -0.58; joseph.add(arm);
  const legs: THREE.Mesh[] = [];
  for (const x of [-0.13, 0.13]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.66, 5), shadow); leg.position.set(x, 0.22, 0.02); joseph.add(leg); legs.push(leg); }
  const rootCage = new THREE.Group(); rootCage.position.set(1.15, 0, -6.1); root.add(rootCage);
  const tendrils: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(ca * 0.2, 0, sa * 0.2), new THREE.Vector3(ca * 0.44, 0.28, sa * 0.44), new THREE.Vector3(ca * 0.34, 0.85, sa * 0.34), new THREE.Vector3(ca * 0.12, 1.65, sa * 0.12)]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.075, 5), bark); t.scale.y = 0.001; rootCage.add(t); tendrils.push(t);
  }
  return {
    enter: () => { root.visible = true; return { x: origin.x, y: 0, z: origin.z + 1.5, yaw: 0 }; },
    tick(seconds) {
      const h = Math.min(1, Math.max(0, (seconds - 0.15) / 2.2));
      for (const t of tendrils) t.scale.y = h;
      joseph.rotation.z = Math.min(0.18, h * 0.18);
    },
    hide: () => { root.visible = false; for (const t of tendrils) t.scale.y = 0.001; },
  };
}
