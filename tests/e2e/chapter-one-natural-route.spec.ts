import { test, expect } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame } from './helpers';

interface Position { x: number; y: number; z: number }
interface GameState { pos: Position; vel: Position; npc: string | null; target: string | null; yaw: number; pitch: number; use: string | null; talked: { npc: string; line: string }[] }
interface Actor { id: string; x: number; y: number; z: number; seated: boolean }
interface Usable { id: string; pos: Position; from: Position; open: number }
interface Game {
  state: () => GameState;
  look: (yaw: number, pitch: number) => void;
  npcs: () => Actor[];
  usables: () => Usable[];
  useTarget: () => string | null;
  advance: (seconds: number) => void;
}
const state = (page: import('@playwright/test').Page) => page.evaluate(() =>
  (window as unknown as { __game: { state: () => GameState } }).__game.state());

test('Chapter 1: walk naturally from Lorenzo through the farmer, Maryam, Omar and Moreno', async ({ page }) => {
  test.setTimeout(300_000);
  const problems = watchPage(page);
  await page.addInitScript(() => sessionStorage.setItem('ov-prologue-complete', '1'));
  await waitForGame(page, '/?day=1');
  await page.locator('#single-player').click();

  const walkTo = async (x: number, z: number, tolerance = 0.9) => {
    await page.keyboard.down('KeyW');
    let position: Position;
    try {
      position = await page.evaluate(({ x, z, tolerance }) => {
        const g = (window as unknown as { __game: Game }).__game;
        let p = g.state().pos;
        for (let i = 0; i < 500; i++) {
          if (Math.hypot(p.x - x, p.z - z) < tolerance) break;
          g.look(Math.atan2(-(x - p.x), -(z - p.z)), -0.03);
          const before = p;
          g.advance(0.12);
          p = g.state().pos;
          if (Math.hypot(p.x - before.x, p.z - before.z) < 0.015 && i > 12) break;
        }
        return p;
      }, { x, z, tolerance });
    } finally {
      await page.keyboard.up('KeyW');
    }
    // Let ground friction settle momentum without reversing into a nearby collision boundary.
    // Advance the game clock directly because SwiftShader may stall RAF in headless tests.
    await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(0.75));
    // Check the settled position, not the pre-release point. On a narrow gate,
    // leftover momentum can carry the capsule into a fence post after W is released.
    const finalState = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state());
    position = finalState.pos;
    const blockers = await page.evaluate(({ x, z }) => {
      const g = (window as unknown as { __game: { solidsAt: (x: number, z: number) => unknown; npcs: () => unknown } }).__game;
      return { solids: g.solidsAt(x, z), npcs: g.npcs() };
    }, position);
    const error = Math.hypot(position.x - x, position.z - z);
    expect(error, `walk blocked at ${JSON.stringify({ ...finalState, target: { x, z } })}; nearby ${JSON.stringify(blockers)}`)
      .toBeLessThan(tolerance <= 0.1 ? 0.45 : 1.2);
  };

  const openUse = async (id: string) => {
    const usable = await page.evaluate(id => (window as unknown as { __game: Game }).__game.usables().find(item => item.id === id)!, id);
    await walkTo(usable.from.x, usable.from.z, id === 'door-maryam' || id === 'gate-maryam' ? 0.1 : 0.25);
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      await page.evaluate(({ pos }) => {
        const g = (window as unknown as { __game: Game }).__game, p = g.state().pos;
        const eye = p.y + 1.64 - 0.16, dx = pos.x - p.x, dz = pos.z - p.z;
        g.look(Math.atan2(-dx, -dz), Math.atan2(pos.y - eye, Math.hypot(dx, dz)));
        g.advance(0.12);
      }, usable);
      seen = (await state(page)).use === id;
    }
    expect(seen, `usable ${id} from ${JSON.stringify((await state(page)).pos)}`).toBe(true);
    await page.keyboard.press('KeyE');
    await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(2));
    await expect.poll(async () => page.evaluate(id => (window as unknown as { __game: Game }).__game.usables().find(item => item.id === id)!.open, id))
      .toBe(1);
  };

  // Stay south of the barn walls, then approach the farmer from the north.
  await walkTo(12, 21.5);
  await walkTo(-12.5, 21.5);
  await walkTo(-12.5, 8.5);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game, p = g.state().pos, farmer = g.npcs().find(actor => actor.id === 'npc_farmer')!;
    g.look(Math.atan2(-(farmer.x - p.x), -(farmer.z - p.z)), Math.atan2(farmer.y + 1.3 - (p.y + 1.64), Math.hypot(farmer.x - p.x, farmer.z - p.z)));
    g.advance(0.12);
  });
  await expect.poll(async () => (await state(page)).npc).toBe('npc_farmer');
  await page.keyboard.press('KeyE');
  // The farmer's objective advances only when this authored line is heard; the separate
  // Chapter 1 objectives test also checks the explicit talk log entry.
  await expect(page.locator('#objective-en')).toHaveText('Find Maryam at her home');

  // Follow the authored square-to-yard path, open Maryam's gate and door, and reach her at home.
  // The café balcony stairs block a straight eastward crossing at z=56; skirt their south edge.
  for (const [x, z] of [[-12.5, 23.5], [-22, 23.5], [-22, 56], [8, 54.5], [12, 54.5], [49, 54.5], [49, 37.5], [62, 37.5], [77.5, 37.5], [77.5, 24.2]]) {
    await walkTo(x, z);
  }
  await openUse('gate-maryam');
  // The gate leaves only about 0.7 m clear after the player's capsule radius; center up before crossing.
  await walkTo(77.5, 23.0, 0.1);
  await walkTo(77.5, 18.0);
  // Align with the narrow door before walking straight into its opening.
  await walkTo(74, 18.0);
  await openUse('door-maryam');
  await walkTo(74, 12);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game, p = g.state().pos, maryam = g.npcs().find(actor => actor.id === 'npc_maryam')!;
    g.look(Math.atan2(-(maryam.x - p.x), -(maryam.z - p.z)), Math.atan2(maryam.y + 1.3 - (p.y + 1.48), Math.hypot(maryam.x - p.x, maryam.z - p.z)));
    g.advance(0.12);
  });
  await expect.poll(async () => (await state(page)).npc).toBe('npc_maryam');
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).talked.at(-1)).toMatchObject({ npc: 'npc_maryam', line: 'maryam_door' });
  await expect(page.locator('#objective-en')).toHaveText('Wait, then ask Maryam again');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(8.2));
  await expect(page.locator('#objective-en')).toHaveText('Ask Maryam whether Joseph has returned');
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game, p = g.state().pos, maryam = g.npcs().find(actor => actor.id === 'npc_maryam')!;
    g.look(Math.atan2(-(maryam.x - p.x), -(maryam.z - p.z)), Math.atan2(maryam.y + 1.3 - (p.y + 1.48), Math.hypot(maryam.x - p.x, maryam.z - p.z)));
    g.advance(0.12);
  });
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).talked.at(-1)).toMatchObject({ npc: 'npc_maryam', line: 'maryam_confirmed_missing' });
  await expect(page.locator('#objective-en')).toHaveText('Follow Maryam to the square');

  // Leave Maryam's house and yard before she starts the one-way route. Stand clear of the footpath while she walks.
  // Circle north of Maryam and the table, then approach the east side of the south doorway.
  // The door swings into the west half of the opening, so a straight exit from the kitchen aisle is blocked.
  await walkTo(72.0, 12.6);
  await walkTo(72.0, 11.0);
  await walkTo(74.5, 11.0);
  await walkTo(75.2, 11.0);
  await walkTo(75.2, 13.5);
  await walkTo(74.0, 13.5, 0.1);
  await walkTo(74, 17);
  // Line up inside the yard, then cross the narrow opening squarely beside the open gate leaf.
  await walkTo(77.5, 20);
  await walkTo(77.5, 21.5, 0.1);
  await walkTo(77.5, 24.7, 0.1);
  await walkTo(77.5, 37.5);
  // Stand outside Maryam's 4 m attention radius; she pauses her route when Lorenzo is close enough to talk.
  await walkTo(85, 38);
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(130));
  await expect.poll(async () => page.evaluate(() => {
    const a = (window as unknown as { __game: Game }).__game.npcs().find(actor => actor.id === 'npc_maryam')!;
    return Math.hypot(a.x - 43.5, a.z - 43.0);
  })).toBeLessThan(0.1);
  await expect(page.locator('#objective-en')).toHaveText('Talk to Omar at the police post');

  // Follow the south edge of the square so Maryam and the villagers do not block the route.
  // Skirt the officer and pass the parked police car on its narrow east side.
  for (const [x, z] of [
    [77.5, 37.5], [62, 37.5], [49, 37.5], [-9.4, 37.5], [-9.4, 45.0],
  ]) await walkTo(x, z);
  await walkTo(-8.66, 45.0, 0.1);
  // The narrow car clearance ends at the north bumper; finish beyond it, then line up with the door.
  await walkTo(-8.66, 48.2, 0.1);
  await walkTo(-9.4, 47.5);
  await openUse('door-post');
  const talkTo = async (id: string, line: string) => {
    const actor = await page.evaluate(id => (window as unknown as { __game: Game }).__game.npcs().find(candidate => candidate.id === id)!, id);
    const p = await page.evaluate(() => (window as unknown as { __game: Game }).__game.state().pos);
    await page.evaluate(({ actor, p }) => {
      const g = (window as unknown as { __game: Game }).__game;
      const chest = actor.y + (actor.seated ? 0.9 : 1.3);
      g.look(Math.atan2(-(actor.x - p.x), -(actor.z - p.z)), Math.atan2(chest - (p.y + 1.48), Math.hypot(actor.x - p.x, actor.z - p.z)));
      g.advance(0.12);
    }, { actor, p });
    await expect.poll(async () => (await state(page)).npc).toBe(id);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state(page)).talked.at(-1)).toMatchObject({ npc: id, line });
  };
  await walkTo(-12.5, 47.5);
  await talkTo('npc_omar', 'omar_mountain');
  await expect(page.locator('#objective-en')).toHaveText('Wait for the guarded medical check to finish');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(15));
  await expect(page.locator('#objective-en')).toHaveText('Speak to Moreno about Omar');
  // The seated Omar conversation is at the west side of the room; step into the open east aisle for Moreno.
  await walkTo(-13.5, 45.5);
  await talkTo('npc_moreno', 'moreno_reporter');
  await talkTo('npc_moreno', 'moreno_said');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(10));
  await expect(page).toHaveURL(/\?day=2$/, { timeout: 60_000 });

  await expectNoProblems(problems);
});
