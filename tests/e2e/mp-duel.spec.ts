import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems } from './helpers';

// Multiplayer (mp.html): two tabs of one browser connect through the BroadcastChannel transport (?net=local; the real
// PeerJS relay needs the internet). Host (Ravens) kills the joiner (Village) with real hitscan; score, HUD and
// zero console errors are checked on both pages. Small viewport and low-fx: software GL.
test.use({
  viewport: { width: 320, height: 180 },
  launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] },
});

interface P { i: number; x: number; y: number; z: number; a: boolean; hp: number; k: number }
interface S { mode: string; code: string; status: string; id: number; phase: string; score: [number, number]; players: P[]; me: P | null }
const st = (p: Page) => p.evaluate(() => (window as unknown as { __mp: { state: () => S } }).__mp.state());

test('multiplayer: host and joiner connect, one kills the other, scores update', async ({ context }) => {
  test.setTimeout(240_000);
  const host = await context.newPage(), guest = await context.newPage();
  const problems = [...watchPage(host), ...watchPage(guest)];
  const url = '/mp.html?net=local&bots=0&lowfx=1';

  await host.goto(url); await guest.goto(url);
  await host.fill('#name', 'Hawk'); await host.click('#host');
  await expect.poll(async () => (await st(host)).code, { timeout: 120_000 }).toMatch(/^[A-Z2-9]{5}$/);
  const code = (await st(host)).code;
  await expect(host.locator('#room')).toContainText(code);

  await guest.fill('#name', 'Wren'); await guest.fill('#code', code); await guest.click('#join');
  await expect.poll(async () => (await st(guest)).status, { timeout: 30_000 }).toBe('ready');
  expect((await st(guest)).id).toBe(1);

  // freeze (5 s) then live on both pages
  await expect.poll(async () => (await st(host)).phase, { timeout: 90_000 }).toBe('live');
  await expect.poll(async () => (await st(guest)).phase, { timeout: 30_000 }).toBe('live');

  await host.waitForTimeout(3500);   // spawn protection (3 s of game time)
  // Host aims at the joiner (head height) and fires with the real trigger path until the round ends.
  for (let shot = 0; shot < 40; shot++) {
    const s = await st(host);
    if (s.score[0] + s.score[1] > 0) break;
    await host.evaluate(({ me, foe }) => {
      const g = (window as unknown as { __mp: { look: (y: number, p: number) => void; fire: () => void } }).__mp;
      const dx = foe.x - me.x, dz = foe.z - me.z;
      g.look(Math.atan2(-dx, -dz), Math.atan2(1.5 - 1.64, Math.hypot(dx, dz)));
      g.fire();
    }, { me: s.me!, foe: s.players.find(p => p.i === 1)! });
    await host.waitForTimeout(450);
  }
  await expect.poll(async () => (await st(host)).score, { timeout: 20_000 }).toEqual([1, 0]);
  await expect.poll(async () => (await st(guest)).score, { timeout: 20_000 }).toEqual([1, 0]);
  const g = await st(guest);
  expect(g.me!.a).toBe(false);
  expect(g.players.find(p => p.i === 0)!.k).toBe(1);
  await expect(guest.locator('#top')).toContainText('RAVENS 1 : 0 VILLAGE');
  await expect(host.locator('#feed')).toContainText('Hawk eliminated Wren');

  await expectNoProblems(problems);
});

test('multiplayer: wrong room code shows an error, no console noise', async ({ page }) => {
  const problems = watchPage(page);
  await page.goto('/mp.html?net=local&bots=0&lowfx=1');
  await page.fill('#code', 'ZZZZZ'); await page.click('#join');
  await expect(page.locator('#status')).toContainText('room not found', { timeout: 10_000 });
  await expectNoProblems(problems);
});
