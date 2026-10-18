import { test, expect, type Page } from '@playwright/test';
import {
  watchPage, expectNoProblems, waitForGame, startPlay, readState, walkPath, face, engageIfThreat,
} from './helpers';

// Chapter 1 "Night Shift" (src/nightshift.ts), played with real keyboard and mouse only.
// window.__game is read for state() and coordinates. No teleport, look, key or press helper is used.
// Yaw convention (src/main.ts): forward = (-sin yaw, -cos yaw). Forward -Z is yaw 0.
const YAW = { minusZ: 0, minusX: Math.PI / 2, plusX: -Math.PI / 2, plusZ: Math.PI };

// Small viewport: headless swiftshader renders the lit scene at ~1.8 fps at 1280x720, which would make
// game time (dt is capped at 0.1 s per frame) crawl. Logic is viewport-independent.
test.describe('slice walkthrough: Night Shift', () => {
  test.use({ viewport: { width: 320, height: 180 } });

  // Rupture sampler: runs in the page on a timer, so the first storyTime at which the rupture
  // enemy (id 0, wake 'rupture') appears is captured even if the test is slow to read state.
  async function installRuptureSampler(page: Page): Promise<void> {
    await page.evaluate(() => {
      const w = window as unknown as {
        __game: { state: () => { storyTime: number; enemies: { id: number }[] } };
        __ruptureSeenAt?: number;
      };
      w.__ruptureSeenAt = undefined;
      setInterval(() => {
        const s = w.__game.state();
        if (w.__ruptureSeenAt === undefined && s.enemies.some(e => e.id === 0)) w.__ruptureSeenAt = s.storyTime;
      }, 5);
    });
  }

  // Prints one line per step (state snapshot) so a failing run shows where it stopped.
  async function progress(page: Page, step: string): Promise<void> {
    const s = await readState(page);
    console.log(`STEP ${step} t=${s.storyTime.toFixed(1)} pos=(${s.pos.x.toFixed(1)},${s.pos.y.toFixed(1)},${s.pos.z.toFixed(1)}) hp=${s.health} kills=${s.kills} weapon=${s.weapon} fired=${s.facility.fired.join(',')}`);
  }

  // Presses E (real key) and checks the breaker lamp state through the hook.
  async function pressUse(page: Page, index: number): Promise<void> {
    await engageIfThreat(page);
    const before = await readState(page);
    await page.keyboard.press('KeyE');
    const after = await readState(page);
    // Breaker positions from src/nightshift.ts, with the 1.8 m use range.
    const at = [[-9.8, 1.4, -34], [-9.8, 1.4, -46], [9.8, 3.8, -46.5]][index];
    const eye = { x: before.pos.x, y: before.pos.y + 1.64, z: before.pos.z };
    const d = Math.hypot(at[0] - eye.x, at[1] - eye.y, at[2] - eye.z);
    expect(after.facility.breakers[index], [
      `breaker ${index} should be on after pressing E`,
      `pos=(${before.pos.x.toFixed(2)}, ${before.pos.y.toFixed(2)}, ${before.pos.z.toFixed(2)}) yaw=${before.yaw.toFixed(3)} pitch=${before.pitch.toFixed(3)}`,
      `eye-to-breaker distance ${d.toFixed(2)} m (use range 1.8 m)`,
    ].join('; ')).toBe(true);
  }

  test('rupture by storyTime 7, three breakers, door, catwalk collapse, finish', async ({ page }) => {
    test.setTimeout(900_000);
    const problems = watchPage(page);
    await waitForGame(page, '/?level=nightshift');
    await installRuptureSampler(page);

    // Start state: spawn in the locker room, nothing fired, rupture not yet.
    const s0 = await readState(page);
    expect(s0.facility.finished).toBe(false);
    expect(s0.facility.breakers).toEqual([false, false, false]);
    expect(s0.enemies.some(e => e.id === 0)).toBe(false);
    expect(s0.pos.z).toBeGreaterThan(4);

    await startPlay(page);

    // 1. Locker room to the maintenance tunnel (trigger t-tunnel at z=-2).
    await progress(page, '1');
    await face(page, YAW.minusZ);
    await walkPath(page, [{ x: 0, z: -3.5, until: s => s.facility.fired.includes('t-tunnel') }]);

    // 2. Fallen pipe at z=-12 (bottom 1.15 m): crouch through it with Ctrl held.
    await progress(page, '2');
    await page.keyboard.down('ControlLeft');
    let sawCrouch = false;
    try {
      await walkPath(page, [{ x: 0, z: -16, until: s => { sawCrouch ||= s.crouched; return false; } }]);
    } finally {
      await page.keyboard.up('ControlLeft');
    }
    expect(sawCrouch, 'crouch flag was set while passing the pipe').toBe(true);

    // 3. Control room doorway, trigger t-control at z=-31.5.
    await progress(page, '3');
    // Stop just inside the room, 13 m from the first pair of drifters, so the fight starts at range.
    await walkPath(page, [{ x: 0, z: -31, tol: 0.4, until: s => s.facility.fired.includes('t-control') }, { x: -4, z: -33, tol: 0.5 }]);
    expect((await readState(page)).facility.fired).toContain('t-control');

    // 4. Breaker A at (-9.8, 1.4, -34): stand at (-8.2, -34), face -X, press E.
    await progress(page, '4');
    await walkPath(page, [{ x: -8.2, z: -31.5 }, { x: -8.2, z: -34, tol: 0.25 }]);
    await face(page, YAW.minusX);
    await pressUse(page, 0);

    // 5. Breaker B at (-9.8, 1.4, -46): stand at (-8.2, -46), face -X, press E.
    await progress(page, '5');
    await walkPath(page, [{ x: -8.2, z: -46, tol: 0.25 }]);
    await face(page, YAW.minusX);
    await pressUse(page, 1);

    // 6. Breaker C at (9.8, 3.8, -46.5) on the gantry: back out to (8, -31.5), up the stairs at x=8.
    await progress(page, '6');
    await walkPath(page, [
      { x: -8.2, z: -31.5 }, { x: 8, z: -31.5 }, { x: 8, z: -33 }, { x: 8, z: -40 }, { x: 8.2, z: -46.5, tol: 0.25 },
    ]);
    await face(page, YAW.plusX);
    await pressUse(page, 2);

    // 7. All breakers on: floodgate opens (doorOpen), so the door no longer blocks.
    await progress(page, '7');
    const doorState = await readState(page);
    expect(doorState.facility.doorOpen).toBe(true);
    expect(doorState.facility.breakers).toEqual([true, true, true]);

    // 8. Down the stairs, along x=1 (clear of the desk and crate), through the door at z=-50.25.
    await progress(page, '8');
    await walkPath(page, [{ x: 8, z: -40 }, { x: 8, z: -33 }, { x: 1, z: -33 }, { x: 1, z: -48 }, { x: 0, z: -52 }]);

    // 9. Front catwalk, then the mid span (trigger t-catwalk at z=-62) collapses under the player.
    await progress(page, '9');
    await walkPath(page, [
      { x: 0, z: -58 },
      { x: 0, z: -66, until: s => s.facility.fired.includes('t-catwalk') },
    ]);
    expect((await readState(page)).facility.fired).toContain('t-catwalk');

    // 10. Fall to the spillway (trigger t-spillway), run up the exit stairs to the finish trigger at z=-94.
    await progress(page, '10');
    await walkPath(page, [{ x: 0, z: -94, tol: 0.8, until: s => s.facility.finished }], 150_000);

    // Finish state and end screen.
    const s = await readState(page);
    expect(s.facility.finished).toBe(true);
    for (const id of ['t-tunnel', 't-control', 't-catwalk', 't-spillway', 't-exit']) {
      expect(s.facility.fired, `trigger ${id} fired`).toContain(id);
    }
    await expect(page.locator('#end')).toBeVisible();

    // Rupture: first seen at storyTime >= 7 (sampled every 5 ms in the page).
    const ruptureAt = await page.evaluate(() => (window as unknown as { __ruptureSeenAt?: number }).__ruptureSeenAt);
    console.log(`WALKTHROUGH rupture enemy first seen at storyTime ${ruptureAt?.toFixed(2)} s; final storyTime ${s.storyTime.toFixed(1)} s; health ${s.health}`);
    expect(ruptureAt, 'rupture spawned').toBeDefined();
    expect(ruptureAt!).toBeGreaterThanOrEqual(7);
    expect(ruptureAt!).toBeLessThan(8);

    await expectNoProblems(problems);
  });
});
