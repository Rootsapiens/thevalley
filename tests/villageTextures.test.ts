import { describe, it, expect } from 'vitest';
import { VILLAGE_TEX, NORMAL_Y } from '../src/villageTextures';

// Files in public/art, read through Vite's glob so no node types are needed.
const FILES = new Set(Object.keys(import.meta.glob('../public/art/*.jpg')).map(p => p.split('/').pop()!));
const has = (f: string) => FILES.has(f);
const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
  return ab / Math.sqrt(aa * bb);
};

describe('village PBR textures', () => {
  it('every albedo file ships in public/art', () => {
    for (const name of Object.keys(VILLAGE_TEX)) expect(has(name + '.jpg'), name).toBe(true);
  });
  it('every flagged normal and rough map ships in public/art', () => {
    for (const [name, s] of Object.entries(VILLAGE_TEX)) {
      if (s.normal) expect(has(name + '_normal.jpg'), name + ' normal').toBe(true);
      if (s.rough) expect(has(name + '_rough.jpg'), name + ' rough').toBe(true);
    }
  });
  it('base colours are 6-digit hex', () => {
    for (const s of Object.values(VILLAGE_TEX)) expect(s.base).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
  it('unflagged sets do not ship extra maps', () => {
    for (const [name, s] of Object.entries(VILLAGE_TEX)) {
      if (!s.normal) expect(has(name + '_normal.jpg'), name).toBe(false);
      if (!s.rough) expect(has(name + '_rough.jpg'), name).toBe(false);
    }
  });
  // The albedo stands in for the height (seams and gaps are dark): red follows -dL/dx either way; green follows +dL/dy
  // (rows run down) for green-up maps and -dL/dy for green-down ones. The sign must agree with NORMAL_Y.
  it('normal maps point green the way NORMAL_Y says', async () => {
    const sharp = (await import('sharp' as string)).default;   // dev dependency; untyped import keeps node types out
    const raw = async (f: string): Promise<{ data: Uint8Array; info: { width: number; height: number } }> =>
      sharp(`public/art/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [name, s] of Object.entries(VILLAGE_TEX)) {
      if (!s.normal) continue;
      const A = await raw(name + '.jpg'), N = await raw(name + '_normal.jpg'), W = A.info.width, H = A.info.height;
      const L = (x: number, y: number) => { const i = (((y + H) % H) * W + (x + W) % W) * 3; return 0.3 * A.data[i] + 0.59 * A.data[i + 1] + 0.11 * A.data[i + 2]; };
      const r: number[] = [], g: number[] = [], dx: number[] = [], dy: number[] = [];
      for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
        r.push(N.data[(y * W + x) * 3]); g.push(N.data[(y * W + x) * 3 + 1]);
        dx.push(L(x - 1, y) - L(x + 1, y)); dy.push(L(x, y + 1) - L(x, y - 1));
      }
      expect(corr(r, dx), `${name}: red against the albedo slope (is the albedo a usable height?)`).toBeGreaterThan(0.3);
      expect(corr(g, dy) * NORMAL_Y, `${name}: green direction against NORMAL_Y = ${NORMAL_Y}`).toBeGreaterThan(0.3);
    }
  });
});
