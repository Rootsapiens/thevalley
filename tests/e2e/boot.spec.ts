import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, readState, startPlay } from './helpers';

// Both entry points: '/' is the village slice (default), '/?level=nightshift' is Chapter 1.
const ENTRIES = ['/', '/?level=nightshift'];

for (const path of ENTRIES) {
  test(`boots ${path} with no page errors, console errors or failed requests`, async ({ page }) => {
    const problems = watchPage(page);
    await waitForGame(page, path);

    // The render loop runs before any input: the hook answers with a sane state.
    await page.waitForTimeout(1500);
    const s = await readState(page);
    expect(s.health).toBeGreaterThan(0);
    expect(s.facility.finished).toBe(false);
    expect(s.pos.y).toBeGreaterThanOrEqual(-0.01);

    // Starting play (pointer lock may be refused headless; the SecurityError is allowed by helpers.ts).
    await startPlay(page);
    await page.waitForTimeout(500);

    await expectNoProblems(problems);
  });
}
