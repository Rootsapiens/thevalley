import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay, readState } from './helpers';
import { EXAMINABLES, END_ZONE, trailPoints, SPAWN } from '../../src/village';

// Village slice (default level) end to end. window.__game: state() for reads, teleport/look to position,
// the real E key to examine. Geometry comes from the pure module src/village.ts (read only).
// Small viewport: software GL is slow and dt is capped per frame, so a small canvas keeps game time moving.
test.use({ viewport: { width: 320, height: 180 } });

interface VState {
  examined: string[]; finished: boolean; target: string | null; endT: number;
  pos: { x: number; y: number; z: number }; storyTime: number;
}
const st = (page: Page) => readState(page) as unknown as Promise<VState>;
const game = (page: Page, fn: 'teleport' | 'look', ...a: number[]) =>
  page.evaluate(([f, args]) => (window as unknown as { __game: Record<string, (...x: number[]) => void> }).__game[f as string](...(args as number[])), [fn, a] as const);

test('village: examine all 12, follow the hoofprints, reach the end card', async ({ page }) => {
  test.setTimeout(600_000);
  const problems = watchPage(page);
  await waitForGame(page, '/');

  const s0 = await st(page);
  expect((s0 as unknown as { level: string }).level).toBe('village');
  expect(s0.examined).toEqual([]);
  expect(s0.finished).toBe(false);
  expect(EXAMINABLES.length).toBe(12);
  const hookList = await page.evaluate(() => (window as unknown as { __game: { examinables: () => { id: string }[] } }).__game.examinables().map(e => e.id));
  expect(hookList).toEqual(EXAMINABLES.map(e => e.id));
  await startPlay(page);

  // 1. Examine all 12: stand at the authored viewpoint, aim at the object, wait for target, press the real E key.
  for (const [i, e] of EXAMINABLES.entries()) {
    await game(page, 'teleport', e.from.x, e.from.y, e.from.z);
    const eyeY = e.from.y + 1.6;
    const dx = e.pos.x - e.from.x, dy = e.pos.y - eyeY, dz = e.pos.z - e.from.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let seen = false;
    for (let k = 0; k < 60 && !seen; k++) {
      await game(page, 'look', yaw, pitch);
      await page.waitForTimeout(100);
      seen = (await st(page)).target === e.id;
    }
    expect(seen, `target ${e.id} acquired from (${e.from.x}, ${e.from.z}); state=${JSON.stringify(await st(page))}`).toBe(true);
    await page.keyboard.press('KeyE');
    const ar = (await page.locator('#sub-ar').textContent())?.trim() ?? '';
    const en = (await page.locator('#sub-en').textContent())?.trim() ?? '';
    expect(ar.length, `${e.id} AR subtitle`).toBeGreaterThan(0);
    expect(en.length, `${e.id} EN subtitle`).toBeGreaterThan(0);
    expect(ar).toBe(e.line.ar);
    expect(en).toBe(e.line.en);
    expect((await st(page)).examined.length, `examined after ${e.id}`).toBe(i + 1);
  }
  const s1 = await st(page);
  expect(s1.examined.length).toBe(12);
  expect(new Set(s1.examined)).toEqual(new Set(EXAMINABLES.map(e => e.id)));
  expect(s1.finished).toBe(false);

  // 2. Follow the hoofprint trail from the barn door toward the gap, ~3 m hops, stopping short of the end zone.
  await game(page, 'teleport', SPAWN.x, SPAWN.y, SPAWN.z);
  const trail = trailPoints(3).filter(p => p.z > END_ZONE.box.max.z + 4);
  expect(trail.length).toBeGreaterThan(10);
  let prev = { x: 0.4, z: -5.5 };
  for (const p of trail) {
    await game(page, 'teleport', p.x, 0.01, p.z);
    await game(page, 'look', Math.atan2(-(p.x - prev.x), -(p.z - prev.z)), -0.03);
    await page.waitForTimeout(60);
    prev = p;
    expect((await st(page)).finished, `finished too early at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBe(false);
  }

  // 3. Last stretch on foot with the real W key until the end zone trigger fires.
  const cx = (END_ZONE.box.min.x + END_ZONE.box.max.x) / 2;
  const last = trail[trail.length - 1];
  await game(page, 'teleport', cx, 0.01, last.z);
  await game(page, 'look', 0, -0.03);
  await page.keyboard.down('KeyW');
  try {
    await expect.poll(async () => (await st(page)).finished, { timeout: 90_000, intervals: [200] }).toBe(true);
  } finally {
    await page.keyboard.up('KeyW');
  }

  // 4. End card: the title screen gets class "show" once the end sequence passes ~8.8 s of game time.
  await expect.poll(async () => (await st(page)).endT, { timeout: 30_000, intervals: [200] }).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#title.show')).toBeVisible({ timeout: 180_000 });
  await expect.poll(() => page.locator('#title').evaluate(el => getComputedStyle(el).opacity), { timeout: 20_000 }).toBe('1');
  await expect(page.locator('#title h1')).toHaveText('OMEGA VALLEY');
  await expect(page.locator('#title-stats')).toContainText('12/12');

  await expectNoProblems(problems);
});
