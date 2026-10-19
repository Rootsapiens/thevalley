import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { boardUVs, PLANK_BOARDS, PLANK_INSET } from '../src/villageScene';
import { TILE_M } from '../src/materials';

// Plank seams (rajaie-village-textures.md): the plank texture has a gap line every 1/8 of a tile, at u = (k + 0.5) / 8.
// A board shows a false seam when its u range crosses one of those lines. Boards here are sized like boards() makes
// them (0.19-0.29 m wide, 2-5 m tall) and keyed like it (position hash).
const crossesGap = (lo: number, hi: number) => Math.floor(lo * PLANK_BOARDS - 0.5) !== Math.floor(hi * PLANK_BOARDS - 0.5);
const span = (g: THREE.BufferGeometry, axis: 'x' | 'y') => {
  const uv = g.getAttribute('uv');
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < uv.count; i++) { const v = axis === 'x' ? uv.getX(i) : uv.getY(i); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return [lo, hi];
};

describe('Barn plank UVs', () => {
  it('keeps every board inside one texture board, clear of its gap lines (world UVs: most boards crossed one)', () => {
    let world = 0, perBoard = 0, x = -10;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const w = 0.19 + ((i * 7) % 11) * 0.01, h = 2 + (i % 7) * 0.5;
      if (crossesGap(x / TILE_M, (x + w) / TILE_M)) world++;            // the old mapping: u = x / TILE_M
      const g = boardUVs(new THREE.BoxGeometry(w - 0.004, h, 0.045), (x + w / 2) * 3.7 + 1.3, h);
      const [lo, hi] = span(g, 'x');
      if (crossesGap(lo, hi)) perBoard++;
      const k = Math.round((lo + hi) / 2 * PLANK_BOARDS);
      expect(lo - (k - 0.5) / PLANK_BOARDS).toBeGreaterThanOrEqual(PLANK_INSET / PLANK_BOARDS - 1e-6);   // inset from the gap (Float32 UVs)
      expect((k + 0.5) / PLANK_BOARDS - hi).toBeGreaterThanOrEqual(PLANK_INSET / PLANK_BOARDS - 1e-6);
      x += w + 0.004;
    }
    expect(world / n).toBeGreaterThan(0.75);
    expect(perBoard).toBe(0);
  });

  it('keeps the grain scale along the board and varies which board and where along it', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 64; i++) {
      const h = 3.2, g = boardUVs(new THREE.BoxGeometry(0.24, h, 0.045), i * 0.913, h);
      const [lo, hi] = span(g, 'y'), [ulo, uhi] = span(g, 'x');
      expect(hi - lo).toBeCloseTo(h / TILE_M, 6);   // same metres per tile as the world UVs: grain is not stretched
      picks.add(`${Math.round((ulo + uhi) / 2 * PLANK_BOARDS)}:${lo.toFixed(3)}`);
    }
    expect(picks.size).toBeGreaterThan(40);
  });
});
