import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems } from './helpers';

// Real PeerJS public relay (needs internet). Skips when the relay cannot be reached, so offline CI stays green.
test.use({ viewport: { width: 320, height: 180 } });
interface S { code: string; status: string; id: number; players: { i: number; h: boolean }[] }
const st = (p: import('@playwright/test').Page) => p.evaluate(() => (window as unknown as { __mp: { state: () => S } }).__mp.state());

test('multiplayer over the real PeerJS relay: host code, joiner connects, both see 2 humans', async ({ context }) => {
  test.setTimeout(240_000);
  const a = await context.newPage(), b = await context.newPage();
  const problems = [...watchPage(a), ...watchPage(b)];
  await a.goto('/mp.html?bots=0&lowfx=1'); await b.goto('/mp.html?bots=0&lowfx=1');
  await a.click('#host');
  await a.waitForFunction(() => (window as unknown as { __mp: { state: () => S } }).__mp.state().status === 'ready', undefined, { timeout: 60_000 })
    .catch(() => undefined);
  const code = (await st(a)).code;
  test.skip(!code, 'PeerJS relay unreachable from this machine');
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await b.fill('#code', code); await b.click('#join');
  await expect.poll(async () => (await st(b)).status, { timeout: 60_000 }).toBe('ready');
  await expect.poll(async () => (await st(b)).players.filter(p => p.h).length, { timeout: 15_000 }).toBe(2);
  await expect.poll(async () => (await st(a)).players.filter(p => p.h).length, { timeout: 15_000 }).toBe(2);
  await expectNoProblems(problems);
});
