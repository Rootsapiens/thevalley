import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { USABLES, LINES, LOCKED_LINE, TRAIL_END_ZONE } from '../../src/village';
import { STONES } from '../../src/villageMap';

// Full village blockout end to end: gates and doors with the real E key, a locked door, Maryam's yard and back gate,
// the six steps, the stepping stones and the herd trail on foot with the real W key, the end card; then the
// turn-back line down the valley road. Positioning uses window.__game (teleport/look); every action is a real key.
test.use({ viewport: { width: 320, height: 180 } });

interface TState { pos: { x: number; y: number; z: number }; use: string | null; finished: boolean; endT: number }
interface TUsable { id: string; open: number; solid: boolean }
const st = (page: Page) => page.evaluate(() => (window as unknown as { __game: { state: () => unknown } }).__game.state()) as Promise<TState>;
const usables = (page: Page) => page.evaluate(() => (window as unknown as { __game: { usables: () => unknown } }).__game.usables()) as Promise<TUsable[]>;
const call = (page: Page, fn: 'teleport' | 'look', ...a: number[]) =>
  page.evaluate(([f, args]) => (window as unknown as { __game: Record<string, (...x: number[]) => void> }).__game[f as string](...(args as number[])), [fn, a] as const);
const ground = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => (window as unknown as { __game: { ground: (x: number, z: number) => number } }).__game.ground(x, z), [x, z] as const);

/** Stands on the usable's spot, aims at it until the prompt targets it, presses the real E key. */
async function useIt(page: Page, id: string) {
  const u = USABLES.find(v => v.id === id)!;
  await call(page, 'teleport', u.from.x, u.from.y, u.from.z);
  const dx = u.pos.x - u.from.x, dy = u.pos.y - (u.from.y + 1.64), dz = u.pos.z - u.from.z;
  let seen = false;
  for (let k = 0; k < 60 && !seen; k++) {
    await call(page, 'look', Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    await page.waitForTimeout(100);
    seen = (await st(page)).use === id;
  }
  expect(seen, `prompt on ${id}`).toBe(true);
  await page.keyboard.press('KeyE');
}
/** Holds the real W key toward a point until within `tol` metres. */
async function walkTo(page: Page, x: number, z: number, tol = 0.6, timeout = 120_000) {
  const t0 = Date.now();
  await page.keyboard.down('KeyW');
  try {
    for (;;) {
      const s = await st(page);
      const d = Math.hypot(x - s.pos.x, z - s.pos.z);
      if (d < tol) return;
      if (Date.now() - t0 > timeout) throw new Error(`walkTo (${x}, ${z}) timed out at (${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}, ${s.pos.z.toFixed(2)})`);
      await call(page, 'look', Math.atan2(-(x - s.pos.x), -(z - s.pos.z)), -0.05);
      await page.waitForTimeout(80);
    }
  } finally { await page.keyboard.up('KeyW'); }
}
async function waitOpen(page: Page, id: string, open: number) {
  await expect.poll(async () => (await usables(page)).find(u => u.id === id)!.open, { timeout: 60_000, intervals: [200] }).toBe(open);
}

test('village tour: gates, a locked door, the back gate, the stepping stones, the herd trail to the end card', async ({ page }) => {
  test.setTimeout(600_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await startPlay(page);

  // Farm gate on the footpath: opens with E, the field beyond is reached on foot, and it closes again.
  await useIt(page, 'gate-farm-s');
  await waitOpen(page, 'gate-farm-s', 1);
  await walkTo(page, 47.5, 12);
  await useIt(page, 'gate-farm-s');
  await waitOpen(page, 'gate-farm-s', 0);

  // A locked door rattles and says so in the prompt at once, without touching a spoken line that may still be up
  // (under SwiftShader the sim runs slower than real time, so the opening line is often still showing here).
  await useIt(page, 'locked-cafe');
  await expect(page.locator('#prompt-en')).toHaveText(LOCKED_LINE.en);
  await expect(page.locator('#prompt-ar')).toHaveText(LOCKED_LINE.ar);
  await expect(page.locator('#prompt')).toHaveClass(/locked/);
  expect(await page.locator('#sub-en').textContent(), 'the rattle is not a subtitle line').not.toBe(LOCKED_LINE.en);

  // Maryam's yard gate, then her back gate, the six steps down and the seven stones across.
  await useIt(page, 'gate-maryam');
  await waitOpen(page, 'gate-maryam', 1);
  await walkTo(page, 77.5, 19.5);
  await useIt(page, 'gate-back');
  await waitOpen(page, 'gate-back', 1);
  await walkTo(page, 92.0, 7.5, 0.5);
  await walkTo(page, 96.5, 7.6, 0.6);
  const z = STONES[0].z;
  await walkTo(page, 101.6, z, 0.5);
  let low = Infinity;
  await page.keyboard.down('KeyW');
  try {
    for (let k = 0; k < 600; k++) {
      const s = await st(page);
      if (s.pos.x > STONES[0].x && s.pos.x < STONES[6].x) low = Math.min(low, s.pos.y);
      if (s.pos.x > STONES[6].x + 1.2) break;
      await call(page, 'look', Math.atan2(-1, -(z - s.pos.z) * 0.6), -0.05);
      await page.waitForTimeout(80);
    }
  } finally { await page.keyboard.up('KeyW'); }
  expect(low, 'stayed on the stones').toBeGreaterThan(Math.min(...STONES.map(s => s.top)) - 0.05);

  // Up the herd trail to the end of the playable area: the end sequence runs to the title card.
  const cx = (TRAIL_END_ZONE.box.min.x + TRAIL_END_ZONE.box.max.x) / 2, cz = (TRAIL_END_ZONE.box.min.z + TRAIL_END_ZONE.box.max.z) / 2;
  await walkTo(page, 117, cz, 0.8);
  await page.keyboard.down('KeyW');
  try {
    await expect.poll(async () => {
      const s = await st(page);
      if (!s.finished) await call(page, 'look', Math.atan2(-(cx - s.pos.x), -(cz - s.pos.z)), -0.03);
      return s.finished;
    }, { timeout: 120_000, intervals: [150] }).toBe(true);
  } finally { await page.keyboard.up('KeyW'); }
  await expect(page.locator('#title.show')).toBeVisible({ timeout: 180_000 });
  await expect(page.locator('#title h1')).toHaveText('OMEGA VALLEY');

  await expectNoProblems(problems);
});

test('valley road south: Lorenzo turns back at the edge of the village', async ({ page }) => {
  test.setTimeout(300_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await startPlay(page);
  await call(page, 'teleport', 37.5, (await ground(page, 37.5, 102)) + 0.01, 102);
  await call(page, 'look', Math.PI, -0.03);
  await page.keyboard.down('KeyW');
  try {
    await expect(page.locator('#sub-en')).toHaveText(LINES.turnback.en, { timeout: 90_000 });
  } finally { await page.keyboard.up('KeyW'); }
  const s = await st(page);
  expect(s.pos.z).toBeLessThan(111.2);
  expect(s.finished).toBe(false);
  await expectNoProblems(problems);
});
