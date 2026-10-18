import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { churchLayout, LAMPS } from '../../src/village';
import { BUILDINGS } from '../../src/villageMap';

// The church pictures and the lit lamps, checked in the rendered frame (the owner saw "no drawing": the pictures were
// inside the walls). Each picture is shot from the aisle, straight on and from 0.7 m to the side, cropped by its
// projected corners and correlated with its source image: it must show (NCC), be lit, be the right way round (beats its
// mirror and its upside-down copy) and be readable (projected width). STILLS=1 also writes studio/stills/*.png.
declare const process: { env: Record<string, string | undefined> };   // no @types/node in this project
const STILLS = !!process.env.STILLS;
const B = BUILDINGS.find(b => b.kind === 'church')!;
const L = churchLayout(B);
const EYE = 1.64;

interface Pic { name: string; x: number; y: number; z: number; w: number; h: number; nz: number }
type G = Record<string, (...a: number[]) => unknown>;
const call = <T>(page: Page, fn: string, ...a: number[]) =>
  page.evaluate(([f, args]) => (window as unknown as { __game: G }).__game[f as string](...(args as number[])), [fn, a] as const) as Promise<T>;
/** One round trip (each evaluate waits out a whole SwiftShader frame): stand, look, let 3 frames draw. */
async function standAndLook(page: Page, x: number, y: number, z: number, tx: number, ty: number, tz: number) {
  const dx = tx - x, dz = tz - z, yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(ty - (y + EYE), Math.hypot(dx, dz));
  await page.evaluate(([x, y, z, yaw, pitch]) => new Promise<void>(res => {
    const g = (window as unknown as { __game: G }).__game;
    g.teleport(x, y, z); g.look(yaw, pitch);
    let c = 0; const f = () => (++c >= 3 ? res() : void requestAnimationFrame(f)); requestAnimationFrame(f);
  }), [x, y + 0.01, z, yaw, pitch] as const);
}
/** World points to screen pixels, in one round trip. */
const project = (page: Page, pts: number[][]) => page.evaluate(ps => ps.map(([x, y, z]) =>
  ((window as unknown as { __game: G }).__game.project(x, y, z) as { x: number; y: number; z: number })), pts);
type Img = ReturnType<typeof sharp>;
const luma = (img: Img, w: number, h: number): Promise<Uint8Array> => img.resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer();
function ncc(a: Uint8Array, b: Uint8Array): number {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
  return ab / Math.sqrt(aa * bb + 1e-9);
}

test.describe('church and lamps (rendered)', () => {
  // 640x360 keeps SwiftShader quick; sizes below are scaled to 1280x720. Stills are shot at 1280x720.
  test.use({ viewport: STILLS ? { width: 1280, height: 720 } : { width: 640, height: 360 } });

  test('church: every picture shows, lit, the right way round, at a readable size', async ({ page }) => {
    test.setTimeout(420_000);
    const problems = watchPage(page);
    await waitForGame(page, '/');
    await startPlay(page);
    const pics = await call<Pic[]>(page, 'pictures');
    expect(pics.map(p => p.name).sort()).toEqual(L.pictures.map(p => p.name).sort());
    if (STILLS) {
      await standAndLook(page, B.x0 + 2.0, B.floor, L.cz, B.x1, B.floor + 2.2, L.cz);
      await page.screenshot({ path: 'studio/stills/church-nave.png' });
    }
    for (const [n, p] of pics.entries()) {
      // Straight on, and for the first picture on each wall also from 0.7 m aside (z-fighting would break the match).
      for (const side of n === 0 || pics[n - 1].nz !== p.nz ? [0, 0.7] : [0]) {
        await standAndLook(page, p.x + side, B.floor, L.cz, p.x, p.y, p.z);
        const shot = await page.screenshot();
        if (STILLS && side === 0) await page.screenshot({ path: `studio/stills/church-${p.name}.png` });
        const pts = await project(page, [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => [p.x + u * p.w / 2, p.y + v * p.h / 2, p.z]));
        for (const q of pts) expect(Math.abs(q.z), `${p.name} corner behind the camera`).toBeLessThan(1);
        const x0 = Math.min(...pts.map(q => q.x)), x1 = Math.max(...pts.map(q => q.x)), y0 = Math.min(...pts.map(q => q.y)), y1 = Math.max(...pts.map(q => q.y));
        const width = x1 - x0, k = 1280 / page.viewportSize()!.width, size = Math.max(width, y1 - y0) * k;
        expect(size, `${p.name} readable (longer side on screen, px at 1280x720)`).toBeGreaterThan(side ? 120 : 150);
        // Inner 76% of the picture on screen against the same part of the source.
        const m = 0.12, cw = Math.round(width * (1 - 2 * m)), ch = Math.round((y1 - y0) * (1 - 2 * m));
        const crop = { left: Math.round(x0 + width * m), top: Math.round(y0 + (y1 - y0) * m), width: cw, height: ch };
        const W = 40, H = Math.max(8, Math.round(40 * ch / cw));
        const seen = await luma(sharp(shot).extract(crop), W, H);
        const meta = await sharp(`public/art/photos/${p.name}.jpg`).metadata();
        const srcCrop = { left: Math.round(meta.width! * m), top: Math.round(meta.height! * m), width: Math.round(meta.width! * (1 - 2 * m)), height: Math.round(meta.height! * (1 - 2 * m)) };
        const src = (f: (s: Img) => Img) => luma(f(sharp(`public/art/photos/${p.name}.jpg`).extract(srcCrop)), W, H);
        const right = ncc(seen, await src(s => s)), mirror = ncc(seen, await src(s => s.flop())), upside = ncc(seen, await src(s => s.flip()));
        const avg = (b: Uint8Array) => b.reduce((a, v) => a + v, 0) / b.length, mean = avg(seen), srcMean = avg(await src(s => s));
        console.log(`PIC ${p.name} side ${side}: ncc ${right.toFixed(3)} mirror ${mirror.toFixed(3)} upside ${upside.toFixed(3)} mean ${mean.toFixed(0)}/${srcMean.toFixed(0)} size ${size.toFixed(0)} px@1280`);
        expect(right, `${p.name} shows (correlates with its image)`).toBeGreaterThan(side ? 0.5 : 0.8);
        // The crucifixion is nearly symmetric left to right (0.91 vs 0.85 mirrored), so that margin is small.
        expect(right - mirror, `${p.name} not mirrored (seen from behind)`).toBeGreaterThan(0.03);
        expect(right - upside, `${p.name} not upside down`).toBeGreaterThan(0.08);
        expect(mean / srcMean, `${p.name} lit (screen mean over image mean)`).toBeGreaterThan(0.55);
      }
    }
    await expectNoProblems(problems);
  });

  test('lamps: the lantern glass and the street lamp glow where their lights are', async ({ page }) => {
    test.setTimeout(240_000);
    const problems = watchPage(page);
    await waitForGame(page, '/');
    await startPlay(page);
    const shots: [string, number, number, number][] = [   // still name, lamp index, stand x, stand z
      ['lamps-barn-hanging', 0, 0, 1.5], ['lamps-barn-bracket', 2, 1.5, 4.5], ['lamps-street', 3, LAMPS[3].x - 7, LAMPS[3].z + 1],
    ];
    for (const [name, i, x, z] of shots) {
      const l = LAMPS[i];
      await standAndLook(page, x, await call<number>(page, 'ground', x, z), z, l.x, l.y + 0.12, l.z);
      const shot = await page.screenshot();
      if (STILLS) await page.screenshot({ path: `studio/stills/${name}.png` });
      // The glass sits at the light (street lamp: its pane is 0.18 m above the light). Brightest pixel near it.
      const [q] = await project(page, [[l.x, l.y + (l.street ? 0.18 : 0), l.z]]);
      const r = Math.round(10 * page.viewportSize()!.width / 1280) + 2, left = Math.round(q.x - r), top = Math.round(q.y - r);
      const px = await sharp(shot).extract({ left, top, width: 2 * r + 1, height: 2 * r + 1 }).greyscale().raw().toBuffer();
      const peak = Math.max(...px);
      console.log(`LAMP ${name}: peak ${peak} at (${q.x.toFixed(0)}, ${q.y.toFixed(0)})`);
      expect(peak, `${name} glass glows`).toBeGreaterThan(200);
    }
    await expectNoProblems(problems);
  });
});
