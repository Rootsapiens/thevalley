import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';

// The owner's secret word: typing "sinafly" (real keys) summons the flying carpet, Space (held, real key) climbs, the
// rug shows at the bottom of the frame, and typing the word again lands Lorenzo back on the ground.
// STILLS=1 also writes studio/stills/carpet-*.png.
declare const process: { env: Record<string, string | undefined> };   // no @types/node in this project
const STILLS = !!process.env.STILLS;
test.use({ viewport: { width: 640, height: 360 } });

interface Carpet { flying: boolean; visible: boolean; x: number; y: number; z: number; yaw: number }
interface St { pos: { x: number; y: number; z: number }; onGround: boolean }
type G = Record<string, (...a: number[]) => unknown>;
const call = <T>(page: Page, fn: string, ...a: number[]) =>
  page.evaluate(([f, args]) => (window as unknown as { __game: G }).__game[f as string](...(args as number[])), [fn, a] as const) as Promise<T>;
const frames = (page: Page, n = 3) =>
  page.evaluate(k => new Promise<void>(res => { let c = 0; const f = () => (++c >= k ? res() : void requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

test('sinafly: the carpet appears, Space climbs, it shows under Lorenzo, and the word again lands him', async ({ page }) => {
  test.setTimeout(300_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await startPlay(page);
  const g0 = await call<number>(page, 'ground', 30, 45);
  await call(page, 'teleport', 30, g0 + 0.01, 45);
  await call(page, 'look', 0.6, -0.12);
  expect((await call<Carpet>(page, 'carpet')).visible).toBe(false);

  await page.keyboard.type('sinafly', { delay: 40 });
  await expect(page.locator('#toast')).toHaveText('FLY MODE ON');
  expect(await call<Carpet>(page, 'carpet')).toMatchObject({ flying: true, visible: true });

  const y0 = (await call<St>(page, 'state')).pos.y;
  await page.keyboard.down('Space');
  try {
    await expect.poll(async () => (await call<St>(page, 'state')).pos.y - y0, { timeout: 120_000, intervals: [250] }).toBeGreaterThan(3);
  } finally { await page.keyboard.up('Space'); }
  const high = (await call<St>(page, 'state')).pos.y;
  await frames(page, 4);
  expect((await call<St>(page, 'state')).pos.y, 'hovers when Space is let go').toBeGreaterThan(high - 0.5);

  // On screen: the point 1 m ahead of the rug's centre projects into the lower part of the frame, and the pixels there
  // are the rug's warm red and gold, not the bluish dusk below.
  await call(page, 'look', 0.6, -0.12);
  await frames(page, 4);
  const c = await call<Carpet>(page, 'carpet');
  const q = await call<{ x: number; y: number; z: number }>(page, 'project', c.x - Math.sin(c.yaw) * 1.0, c.y, c.z - Math.cos(c.yaw) * 1.0);
  const vp = page.viewportSize()!;
  expect(q.x).toBeGreaterThan(vp.width * 0.3);
  expect(q.x).toBeLessThan(vp.width * 0.7);
  expect(q.y).toBeGreaterThan(vp.height * 0.6);
  expect(q.y).toBeLessThan(vp.height - 4);
  const shot = await page.screenshot();
  if (STILLS) await page.screenshot({ path: 'studio/stills/carpet-flying.png' });
  const r = 8, { data } = await sharp(shot).extract({ left: Math.round(q.x - r), top: Math.round(q.y - r), width: 2 * r + 1, height: 2 * r + 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let R = 0, Bl = 0;
  for (let i = 0; i < data.length; i += 3) { R += data[i]; Bl += data[i + 2]; }
  const n = data.length / 3;
  console.log(`CARPET at (${q.x.toFixed(0)}, ${q.y.toFixed(0)}): mean R ${(R / n).toFixed(0)} B ${(Bl / n).toFixed(0)}, climbed ${(high - y0).toFixed(2)} m`);
  expect(R / n - Bl / n, 'the rug (red and gold) is under the view').toBeGreaterThan(25);

  await page.keyboard.type('sinafly', { delay: 40 });
  await expect(page.locator('#toast')).toHaveText('FLY MODE OFF');
  expect(await call<Carpet>(page, 'carpet')).toMatchObject({ flying: false, visible: false });
  await expect.poll(async () => (await call<St>(page, 'state')).onGround, { timeout: 120_000, intervals: [250] }).toBe(true);
  await expectNoProblems(problems);
});
