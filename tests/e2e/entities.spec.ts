import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { BELL_ROPE, PROPS } from '../../src/village';

// GoldSrc-style entities and physical feedback with the real keys: W pushes the barn pail along the alley until the
// manger stops it (he never climbs it while pushing), E on the bell rope rings the bell, and a drop shakes the camera.
test.use({ viewport: { width: 320, height: 180 } });

interface Ents { bells: number; props: { id: string; pos: { x: number; y: number; z: number }; vel: { x: number; z: number } }[] }
interface St { pos: { x: number; y: number; z: number }; onGround: boolean; trauma: number }
type G = Record<string, (...a: number[]) => unknown>;
const call = <T>(page: Page, fn: string, ...a: number[]) =>
  page.evaluate(([f, args]) => (window as unknown as { __game: G }).__game[f as string](...(args as number[])), [fn, a] as const) as Promise<T>;
const pail = async (page: Page) => (await call<Ents>(page, 'ents')).props.find(p => p.id === 'pail')!;

test('entities: push the pail with W, ring the bell with E, feel a hard landing', async ({ page }) => {
  test.setTimeout(420_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await startPlay(page);

  // Pail: stand east of it in the alley and walk west into it. The manger's back (x 6.0) stops it.
  const P0 = PROPS.find(p => p.id === 'pail')!;
  await call(page, 'teleport', P0.pos.x + 0.16 + 0.35 + 0.05, 0.01, P0.pos.z - 0.1);
  await call(page, 'look', Math.PI / 2, -0.2);
  const x0 = (await pail(page)).pos.x;
  await page.keyboard.down('KeyW');
  let maxY = 0;
  try {
    await expect.poll(async () => {
      const s = await call<St>(page, 'state');
      const pl = await pail(page);
      if (pl.pos.x > 6.4) maxY = Math.max(maxY, s.pos.y);   // while it is still sliding freely
      return x0 - pl.pos.x;
    }, { timeout: 120_000, intervals: [200] }).toBeGreaterThan(0.8);
    // Keep pushing into the manger (back face x 6.0): it must stop there and stay, not pass through.
    await expect.poll(async () => (await pail(page)).pos.x, { timeout: 120_000, intervals: [200] }).toBeLessThan(6.0 + P0.half.x + 0.02);
    const st0 = (await call<{ storyTime: number }>(page, 'state')).storyTime;
    await expect.poll(async () => (await call<{ storyTime: number }>(page, 'state')).storyTime - st0, { timeout: 60_000 }).toBeGreaterThan(1);
  } finally { await page.keyboard.up('KeyW'); }
  const end = await pail(page);
  console.log(`PAIL moved ${(x0 - end.pos.x).toFixed(2)} m to x ${end.pos.x.toFixed(3)}, player max y while pushing ${maxY.toFixed(3)}`);
  expect(end.pos.x, 'stopped by the manger, not through it').toBeGreaterThan(6.0 + P0.half.x - 0.001);
  expect(maxY, 'walked behind it, never climbed it').toBeLessThan(0.05);

  // Bell rope: from its standing spot, aim at the sally until the prompt names it, press the real E.
  await call(page, 'teleport', BELL_ROPE.from.x, BELL_ROPE.from.y, BELL_ROPE.from.z);
  const dx = BELL_ROPE.pos.x - BELL_ROPE.from.x, dz = BELL_ROPE.pos.z - BELL_ROPE.from.z, dy = BELL_ROPE.pos.y - (BELL_ROPE.from.y + 1.64);
  await expect.poll(async () => {
    await call(page, 'look', Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    return call<string | null>(page, 'buttonTarget');
  }, { timeout: 60_000, intervals: [200] }).toBe(BELL_ROPE.id);
  await expect(page.locator('#prompt-en')).toHaveText(BELL_ROPE.name.en);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await call<Ents>(page, 'ents')).bells, { timeout: 30_000 }).toBe(1);
  await page.keyboard.press('KeyE');   // resting: a second pull right away does nothing
  expect((await call<Ents>(page, 'ents')).bells).toBe(1);

  // A 4 m drop onto the square: trauma (camera shake) builds on landing and decays.
  const g = await call<number>(page, 'ground', 30, 45);
  await call(page, 'teleport', 30, g + 4, 45);
  const peak = await page.evaluate(() => new Promise<number>(res => {
    const g = (window as unknown as { __game: { state: () => { trauma: number } } }).__game;
    let m = 0; const t0 = performance.now();
    const f = () => { m = Math.max(m, g.state().trauma); if (performance.now() - t0 < 20_000 && m < 0.3) requestAnimationFrame(f); else res(m); };
    requestAnimationFrame(f);
  }));
  console.log(`LANDING trauma peak ${peak.toFixed(2)}`);
  expect(peak).toBeGreaterThan(0.3);
  await expect.poll(async () => (await call<St>(page, 'state')).trauma, { timeout: 60_000 }).toBe(0);

  await expectNoProblems(problems);
});
