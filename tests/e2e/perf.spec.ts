import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay, percentile } from './helpers';

// Numbers are printed and attached to the report. The 33 ms bound is soft: a miss is logged as
// PERF BOUND MISS and annotated, but does not fail the run (the roadmap M0 hard bound is 16.7 ms).
const SOFT_P50_MS = 33;

test.describe('performance (headless swiftshader, 1280x720)', () => {
  test('load-to-first-click time is recorded', async ({ page }) => {
    const problems = watchPage(page);
    await waitForGame(page);

    // Page-side: time of the first pointer click, measured on the same performance.now() clock as loadEventEnd.
    await page.evaluate(() => {
      (window as unknown as { __firstClickAt?: number }).__firstClickAt = undefined;
      addEventListener('click', () => {
        const w = window as unknown as { __firstClickAt?: number };
        if (w.__firstClickAt === undefined) w.__firstClickAt = performance.now();
      }, { capture: true, once: false });
    });
    await startPlay(page);

    const timings = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadEventEnd: nav.loadEventEnd,
        firstClickAt: (window as unknown as { __firstClickAt?: number }).__firstClickAt ?? NaN,
      };
    });
    const loadToFirstClickMs = timings.firstClickAt - timings.loadEventEnd;
    test.info().annotations.push({ type: 'load-to-first-click-ms', description: loadToFirstClickMs.toFixed(0) });
    console.log(`PERF load-to-first-click: ${loadToFirstClickMs.toFixed(0)} ms (performance.now() ${timings.firstClickAt.toFixed(0)} - loadEventEnd ${timings.loadEventEnd.toFixed(0)})`);
    expect(Number.isFinite(loadToFirstClickMs)).toBe(true);

    await expectNoProblems(problems);
  });

  test('frame time over 5 s (p50 soft < 33 ms)', async ({ page }) => {
    const problems = watchPage(page);
    await waitForGame(page);
    await startPlay(page);
    await page.waitForTimeout(1000); // let the frame ring buffer settle after the overlay closes

    await page.waitForTimeout(5000);
    const frames = await page.evaluate(() => (window as unknown as { __game: { frameTimes: () => number[] } }).__game.frameTimes());

    // Keep the trailing frames that add up to 5 s of wall time.
    const window5s: number[] = [];
    let sum = 0;
    for (let i = frames.length - 1; i >= 0 && sum + frames[i] <= 5000; i--) { window5s.unshift(frames[i]); sum += frames[i]; }
    const p50 = percentile(window5s, 50);
    const p95 = percentile(window5s, 95);
    const fps = window5s.length / (sum / 1000);
    const line = `PERF frame-time over ${(sum / 1000).toFixed(2)} s, ${window5s.length} frames: p50 ${p50.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, ${fps.toFixed(1)} fps`;
    console.log(line);
    test.info().annotations.push({ type: 'frame-p50-ms', description: p50.toFixed(2) });

    // Sanity guard only: the render loop must have produced frames during the window.
    expect(window5s.length).toBeGreaterThanOrEqual(5);
    if (!(p50 < SOFT_P50_MS)) {
      console.log(`PERF BOUND MISS: p50 ${p50.toFixed(2)} ms >= soft bound ${SOFT_P50_MS} ms (not a failure)`);
      test.info().annotations.push({ type: 'soft-bound-miss', description: `p50 ${p50.toFixed(2)} ms >= ${SOFT_P50_MS} ms` });
    }

    await expectNoProblems(problems);
  });
});
