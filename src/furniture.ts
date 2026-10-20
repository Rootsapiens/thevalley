// Furniture of the furnished rooms (src/interiors.ts): Aktham's CC0 models (public/models, binary glTF) loaded once,
// their base-colour textures packed into one 2048 atlas (a square grid of as many cells as it needs), and each room merged into one mesh on the set's
// baked material: sky occlusion through the doors and windows and the lamps' warm pools (villageScene bakeAt), so a
// room costs one draw plus one for its soft contact shadows, and nothing is drawn in a room out of view. Glass and other
// see-through parts are left out. The meshes start as one-triangle stand-ins with the final attribute layout, so their
// programs link in the warm-up even when the models arrive later.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeAt, patchBake } from './villageScene';
import { INTERIORS, MODELS, itemRect, isSolid, interiorBuilding, type Model } from './interiors';

const SIZE = 2048, PAD = 4, LIFT = 1.6;

export interface Furniture {
  /** Resolves (never rejects) once every room is built, or its models failed to load. */
  ready: Promise<void>;
  rooms: THREE.Mesh[];
  shadows: THREE.Mesh[];
  stats: { tris: number; models: number; cells: number; ms: number };
}

/** A one-triangle stand-in with the final layout: position, normal, uv, color (3 or 4), bake. */
function standIn(rgba: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -50, 0, 0.001, -50, 0, 0, -50, 0.001], 3));
  if (rgba) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(0), 4));
  else {
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(9).fill(1), 3));
    g.setAttribute('bake', new THREE.Float32BufferAttribute([1, 0, 1, 0, 1, 0], 2));
  }
  g.setIndex([0, 1, 2]);
  return g;
}

export function buildFurniture(scene: THREE.Scene, renderer: THREE.WebGLRenderer, env: THREE.Texture): Furniture {
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
  const mat = patchBake(new THREE.MeshStandardMaterial({ vertexColors: true, map: white, roughness: 0.82, metalness: 0 }));
  mat.envMap = env; mat.envMapIntensity = 2.4;
  const shadowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const rooms = INTERIORS.map(r => { const m = new THREE.Mesh(standIn(false), mat); m.name = `furniture-${r.building}`; m.matrixAutoUpdate = false; m.receiveShadow = true; scene.add(m); return m; });
  const shadows = INTERIORS.map(() => { const m = new THREE.Mesh(standIn(true), shadowMat); m.matrixAutoUpdate = false; scene.add(m); return m; });
  const stats = { tris: 0, models: 0, cells: 0, ms: 0 };

  const ready = (async () => {
    const t0 = performance.now();
    const used = [...new Set(INTERIORS.flatMap(r => r.items.map(i => i.model)))] as Model[];
    const loader = new GLTFLoader();
    const gltfs = await Promise.all(used.map(m => loader.loadAsync(`${import.meta.env.BASE_URL}models/${m}.glb`).catch(() => null)));
    // The atlas: cell 0 is white (the colour-only parts); each base-colour image gets the next cell, inset by PAD px so
    // the mip levels a room is seen at do not bleed the neighbours in.
    const images = new Set<unknown>();
    for (const gl of gltfs) gl?.scene.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && !Array.isArray(m) && m.map?.image) images.add(m.map.image); });
    const GRID = Math.ceil(Math.sqrt(images.size + 1)), CELL = Math.floor(SIZE / GRID);
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, CELL, CELL);
    const cellOf = new Map<unknown, number>();
    const model = new Map<Model, THREE.BufferGeometry>();
    used.forEach((name, k) => {
      const gl = gltfs[k];
      if (!gl) return;
      gl.scene.updateMatrixWorld(true);
      const prims: THREE.BufferGeometry[] = [];
      gl.scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const mm = mesh.material as THREE.MeshPhysicalMaterial;
        if (mm.transparent || mm.opacity < 1 || (mm.transmission ?? 0) > 0) return;   // glass
        const img = mm.map?.image as CanvasImageSource | undefined;
        let cell = 0;
        if (img) {
          cell = cellOf.get(img) ?? 0;
          if (!cell && cellOf.size + 1 < GRID * GRID) { cell = cellOf.size + 1; cellOf.set(img, cell); c2.drawImage(img, (cell % GRID) * CELL, Math.floor(cell / GRID) * CELL, CELL, CELL); }
        }
        const src = mesh.geometry, g = new THREE.BufferGeometry(), pos = src.getAttribute('position'), n = pos.count;
        g.setAttribute('position', pos.clone()); g.setAttribute('normal', src.getAttribute('normal').clone());
        const uv = src.getAttribute('uv'), out = new Float32Array(n * 2), cx = (cell % GRID) * CELL, cy = Math.floor(cell / GRID) * CELL;
        for (let i = 0; i < n; i++) {
          const u = cell && uv ? Math.min(1, Math.max(0, uv.getX(i))) : 0.5, v = cell && uv ? Math.min(1, Math.max(0, uv.getY(i))) : 0.5;
          out[i * 2] = (cx + PAD + u * (CELL - 2 * PAD)) / SIZE; out[i * 2 + 1] = (cy + PAD + v * (CELL - 2 * PAD)) / SIZE;
        }
        g.setAttribute('uv', new THREE.BufferAttribute(out, 2));
        const col = new Float32Array(n * 3);
        // The scans' albedos are physical and dark; under the set's dim baked light they would read as silhouettes, so
        // the furniture is lifted like the hand-coloured set around it.
        for (let i = 0; i < n; i++) { col[i * 3] = mm.color.r * LIFT; col[i * 3 + 1] = mm.color.g * LIFT; col[i * 3 + 2] = mm.color.b * LIFT; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (src.index) g.setIndex(src.index.clone()); else g.setIndex([...Array(n).keys()]);
        prims.push(g.applyMatrix4(mesh.matrixWorld));
      });
      if (prims.length) { model.set(name, mergeGeometries(prims)!); stats.models++; }
      for (const p of prims) p.dispose();
      gl.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.MeshStandardMaterial).map?.dispose(); } });
    });
    stats.cells = cellOf.size + 1;
    const atlas = new THREE.CanvasTexture(cv);
    atlas.colorSpace = THREE.SRGBColorSpace; atlas.flipY = false; atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.initTexture(atlas);
    mat.map = atlas;

    // Rooms: each item's model, turned and set on the floor, its bake taken where it stands.
    const _v = new THREE.Vector3(), _n = new THREE.Vector3(), bk: [number, number] = [1, 0], m4 = new THREE.Matrix4();
    INTERIORS.forEach((r, ri) => {
      const b = interiorBuilding(r.building), parts: THREE.BufferGeometry[] = [], blobs: THREE.BufferGeometry[] = [];
      for (const it of r.items) {
        const src = model.get(it.model);
        if (!src) continue;
        const g = src.clone().applyMatrix4(m4.makeRotationY(it.yaw).setPosition(it.x, b.floor + (it.y ?? 0), it.z));
        const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), n = pos.count, bake = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          _v.fromBufferAttribute(pos, i); _n.fromBufferAttribute(nor, i);
          bakeAt(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, bk);
          bake[i * 2] = bk[0]; bake[i * 2 + 1] = bk[1];
        }
        g.setAttribute('bake', new THREE.BufferAttribute(bake, 2));
        parts.push(g);
        if (isSolid(it)) blobs.push(contactShadow(itemRect(it), b.floor + 0.02, MODELS[it.model][2]));
      }
      if (parts.length) {
        const merged = mergeGeometries(parts)!;
        stats.tris += (merged.index?.count ?? 0) / 3;
        rooms[ri].geometry.dispose(); rooms[ri].geometry = merged;
      }
      if (blobs.length) { shadows[ri].geometry.dispose(); shadows[ri].geometry = mergeGeometries(blobs)!; }
      for (const p of [...parts, ...blobs]) p.dispose();
    });
    for (const g of model.values()) g.dispose();
    for (const img of cellOf.keys()) (img as ImageBitmap).close?.();
    stats.ms = Math.round(performance.now() - t0);
  })().catch(() => {});

  return { ready, rooms, shadows, stats };
}

/** A soft dark rectangle under a piece: opaque-ish over its inset footprint, fading out 0.12 m beyond its edges. */
function contactShadow(q: { x0: number; x1: number; z0: number; z1: number }, y: number, h: number): THREE.BufferGeometry {
  const ix = Math.min(0.08, (q.x1 - q.x0) / 3), iz = Math.min(0.08, (q.z1 - q.z0) / 3), o = 0.12;
  const xs = [q.x0 - o, q.x0 + ix, q.x1 - ix, q.x1 + o], zs = [q.z0 - o, q.z0 + iz, q.z1 - iz, q.z1 + o];
  const a = Math.min(0.45, 0.22 + h * 0.15), pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    pos.push(xs[i], y, zs[j]);
    col.push(0, 0, 0, i > 0 && i < 3 && j > 0 && j < 3 ? a : 0);
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const k = j * 4 + i;
    idx.push(k, k + 4, k + 1, k + 1, k + 4, k + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}
