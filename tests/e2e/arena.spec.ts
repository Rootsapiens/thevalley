import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay, clickCentre } from './helpers';

// Village arena (?arena=1, src/arena.ts): root walkers in the square and the spark caster. Aim through the test hook
// (look), fire with real mouse clicks at the centre, crank with the real R key. Off by default: '/' has no arena.
// Small viewport: software GL is slow and dt is capped per frame, so a small canvas keeps game time moving.
test.use({ viewport: { width: 320, height: 180 } });

interface Walker { id: number; mode: string; health: number; x: number; z: number; chest: { x: number; y: number; z: number } }
interface AState {
  level: string; health: number; weapon: string; mag: number; reserve: number; kills: number; pos: { x: number; y: number; z: number };
  arena?: { shots: number; hits: number; marks: number; down: boolean; reloading: boolean; bots: Walker[] };
}
const st = (page: Page) => page.evaluate(() => (window as unknown as { __game: { state: () => AState } }).__game.state());
/** Aims the logical view at a world point from the player's eye (standing: 1.64 m). */
const aim = (page: Page, t: { x: number; y: number; z: number }) => page.evaluate(t => {
  const g = (window as unknown as { __game: { state: () => AState; look: (y: number, p: number) => void } }).__game, s = g.state();
  const dx = t.x - s.pos.x, dy = t.y - (s.pos.y + 1.64), dz = t.z - s.pos.z;
  g.look(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
}, t);

test('arena: walkers grow in the square; the spark caster kills one with real clicks; R cranks it', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watchPage(page);
  // Every arena program links in the warm-up: none after frame 1 starts, the first shot's arc, flash and debris
  // included. The sun's shadow depth program is left out, as in warmup.spec.ts: it links late with or without the
  // arena (its warm-up stand-in has no point lights since the lamps became real lights).
  await page.addInitScript(() => {
    const w = window as unknown as { __late: number; __raf0: number | null };
    w.__late = 0; w.__raf0 = null;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { if (w.__raf0 === null) w.__raf0 = performance.now(); cb(t); });
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const link = C.prototype.linkProgram;
      C.prototype.linkProgram = function (this: WebGLRenderingContext, p: WebGLProgram) {
        if (w.__raf0 !== null && !(this.getAttachedShaders(p) ?? []).some(s => /#define DEPTH_PACKING/.test(this.getShaderSource(s) ?? ''))) w.__late++;
        link.call(this, p);
      };
    }
  });
  await waitForGame(page, '/?arena=1');
  const s0 = await st(page);
  expect(s0.level).toBe('village');
  expect(s0.weapon).toBe('caster');
  expect([s0.health, s0.mag, s0.kills]).toEqual([100, 6, 0]);
  expect(s0.arena!.bots.length).toBeGreaterThanOrEqual(3);
  expect(s0.arena!.bots.length).toBeLessThanOrEqual(5);
  expect(s0.arena!.bots.every(b => b.mode === 'dormant' && b.health === 100)).toBe(true);   // paused behind the overlay
  await expect(page.locator('#ammo')).toContainText('6');
  await expect(page.locator('#hud')).toContainText('HEALTH 100');
  await startPlay(page);

  // The nearest walker, shot until it lets go: re-aim at its chest before every click (it walks, flinches, retreats).
  const near = (s: AState) => s.arena!.bots.filter(b => b.mode !== 'dead').sort((a, b) => Math.hypot(a.x - s.pos.x, a.z - s.pos.z) - Math.hypot(b.x - s.pos.x, b.z - s.pos.z))[0];
  const target = near(await st(page)).id;
  let clicks = 0, s = await st(page);
  for (; clicks < 24; clicks++) {
    const t = s.arena!.bots.find(b => b.id === target)!;
    if (t.mode === 'dead') break;
    if (s.arena!.reloading) { await page.waitForTimeout(400); s = await st(page); continue; }
    await aim(page, t.chest);
    await page.waitForTimeout(50);
    await clickCentre(page);
    await page.waitForTimeout(380);   // the caster's 0.3 s cooldown
    s = await st(page);
  }
  const t = s.arena!.bots.find(b => b.id === target)!;
  expect(t.mode, `walker ${target} after ${clicks} clicks: ${JSON.stringify(s.arena)}`).toBe('dead');
  expect(s.kills).toBeGreaterThanOrEqual(1);
  expect(s.arena!.hits).toBeGreaterThanOrEqual(2);              // 100 health: two knot hits at least
  expect(s.arena!.marks).toBe(s.arena!.hits);                   // every hit showed the marker
  expect(s.arena!.shots).toBeLessThanOrEqual(clicks);
  expect(s.health).toBeGreaterThan(0);

  // Crank with the real R key: the jar refills from the reserve.
  if (s.mag === 6) { await aim(page, { x: s.pos.x + 10, y: 1.5, z: s.pos.z }); await clickCentre(page); await page.waitForTimeout(400); s = await st(page); }
  const before = s;
  expect(before.mag).toBeLessThan(6);
  if (!before.arena!.reloading) await page.keyboard.press('KeyR');
  await expect.poll(async () => (await st(page)).mag, { timeout: 30_000 }).toBe(6);
  const after = await st(page);
  expect(after.reserve).toBe(before.reserve - (6 - before.mag));

  expect(await page.evaluate(() => (window as unknown as { __late: number }).__late), 'programs linked after frame 1').toBe(0);
  await expectNoProblems(problems);
});

test('arena is off by default: the slice has no walkers, no caster, no hit marker', async ({ page }) => {
  const problems = watchPage(page);
  await waitForGame(page, '/');
  await page.waitForTimeout(800);
  const s = await st(page);
  expect([s.weapon, s.mag, s.kills, s.health]).toEqual(['none', 0, 0, 100]);
  expect(s.arena).toBeUndefined();
  await expect(page.locator('#hitmark')).toHaveCount(0);
  await expect(page.locator('#ammo')).toBeHidden();
  await expectNoProblems(problems);
});
