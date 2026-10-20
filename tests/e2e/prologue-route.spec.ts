import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { trailPoints } from '../../src/village';

interface PrologueState {
  pos: { x: number; y: number; z: number };
  prologue: { cowFound: boolean; cowProgress: number; respawns: number };
  endT: number;
  endingTitleVisible: boolean;
}

const state = (page: Page) => page.evaluate(() =>
  (window as unknown as { __game: { state: () => PrologueState } }).__game.state());

test('Prologue: walk the herd trail to the roots attack and Hall reveal', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watchPage(page);
  await waitForGame(page, '/?prologue=1');
  await startPlay(page);
  // Joseph starts close enough to spot the cow immediately; the live objective should advance.
  await expect(page.locator('#objective-en')).toHaveText('Follow the cow and hoofprints toward the stream');

  const path = trailPoints(3);
  const start = { x: 0, z: 1.8 };
  let first = 0, nearest = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - start.x, path[i].z - start.z);
    if (d < nearest) { nearest = d; first = i; }
  }
  const route = path.slice(first + 1);
  const walkToward = async (x: number, z: number) => {
    await page.keyboard.down('KeyW');
    let result = { x: 0, y: 0, z: 0 };
    try {
      result = await page.evaluate(({ x, z }) => {
        const g = (window as unknown as {
          __game: {
            look: (yaw: number, pitch: number) => void;
            advance: (seconds: number) => void;
            state: () => PrologueState;
          }
        }).__game;
        let current = g.state();
        for (let i = 0; i < 500; i++) {
          if (current.endT >= 0 || Math.hypot(current.pos.x - x, current.pos.z - z) < 1) break;
          g.look(Math.atan2(-(x - current.pos.x), -(z - current.pos.z)), -0.03);
          g.advance(0.12);
          const next = g.state();
          if (next.endT >= 0) { current = next; break; }
          if (Math.hypot(next.pos.x - current.pos.x, next.pos.z - current.pos.z) < 0.015 && i > 12) {
            current = next; break;
          }
          current = next;
        }
        return current.pos;
      }, { x, z });
    } finally {
      await page.keyboard.up('KeyW');
    }
    const current = await state(page);
    if (current.endT < 0) {
      const blockers = await page.evaluate(({ x, z }) => {
        const g = (window as unknown as { __game: { solidsAt: (x: number, z: number) => unknown; npcs: () => unknown } }).__game;
        return { solids: g.solidsAt(x, z), npcs: g.npcs() };
      }, result);
      expect(Math.hypot(result.x - x, result.z - z), `blocked at ${JSON.stringify(result)} toward (${x}, ${z}); nearby: ${JSON.stringify(blockers)}`).toBeLessThan(1.4);
    }
  };

  let last = await state(page);
  for (const point of route) {
    if (last.endT >= 0) break;
    // Walk beside the cow rather than through its collision body. The small east
    // offset still fits the barn doorway and the authored wall gap.
    await walkToward(point.x + 1.1, point.z);
    last = await state(page);
  }

  expect(last.prologue.cowFound, 'Joseph must find the cow before reaching the root attack').toBe(true);
  expect(last.prologue.cowProgress).toBeGreaterThan(0.1);
  expect(last.endT, 'reaching the mountain trail should start the roots attack').toBeGreaterThanOrEqual(0);
  await page.evaluate(() => (window as unknown as { __game: { advance: (seconds: number) => void } }).__game.advance(10));
  await expect.poll(async () => (await state(page)).pos.x).toBeCloseTo(1000, 0);
  await expect.poll(async () => (await state(page)).pos.z).toBeCloseTo(1001.5, 0);
  await expect.poll(async () => (await state(page)).endingTitleVisible).toBe(true);
  await expect(page.locator('#title-stats')).toContainText('THE ROOTS TAKE JOSEPH');
  await expectNoProblems(problems);
});
