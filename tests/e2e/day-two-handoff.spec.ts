import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame, startPlay } from './helpers';
import { NPCS, type NpcId } from '../../src/npcData';
import { CAST } from '../../src/npcTalk';

interface Npc { id: string; x: number; y: number; z: number; seated: boolean }
interface StoryState { flags: string[] }
interface GameState { npc: string | null; story: StoryState; talked: { npc: string; line: string }[] }
const state = (page: Page) => page.evaluate(() => (window as unknown as { __game: { state: () => GameState } }).__game.state());
const label = (id: NpcId) => id === 'npc_omar' ? { en: 'Omar', ar: 'عمر' } : CAST[id].label;

async function face(page: Page, id: NpcId) {
  let seen = false;
  for (let k = 0; k < 60 && !seen; k++) {
    await page.evaluate(id => {
      const g = (window as unknown as { __game: { npcs: () => Npc[]; teleport: (x: number, y: number, z: number) => void; look: (yaw: number, pitch: number) => void } }).__game;
      const npc = g.npcs().find(actor => actor.id === id)!;
      const x = npc.x - 2, z = npc.z, y = npc.y, chest = y + (npc.seated ? 0.9 : 1.3);
      g.teleport(x, y + 0.01, z);
      g.look(Math.atan2(-(npc.x - x), -(npc.z - z)), Math.atan2(chest - (y + 1.64), 2));
    }, id);
    await page.waitForTimeout(100);
    seen = (await state(page)).npc === id;
  }
  expect(seen, `talk prompt on ${id}`).toBe(true);
  await expect(page.locator('#prompt-en')).toHaveText(label(id).en);
}

async function talk(page: Page, id: NpcId, lineId: string) {
  const line = NPCS[id].triggers.find(trigger => trigger.id === lineId)!;
  await page.keyboard.press('KeyE');
  await expect(page.locator('#sub-en')).toHaveText(line.line);
  await expect(page.locator('#sub-ar')).toHaveText(line.ar);
  await expect(page.locator('#sub-who-en')).toHaveText(label(id).en);
  await expect.poll(async () => (await state(page)).talked.at(-1)?.line).toBe(lineId);
}

test('Day 2: Moreno assignment, Elia cover, then Omar response', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = watchPage(page);
  await page.addInitScript(() => sessionStorage.setItem('ov-prologue-complete', '1'));
  await waitForGame(page, '/?day=2');
  await expect(page.locator('#overlay')).toContainText('Moreno assigns Elia her cover');
  await expect(page.locator('#objective-en')).toHaveText("Meet Elia. Moreno assigned her to pose as Omar's girlfriend.");
  await page.locator('#single-player').click();

  // Omar's cover line must stay locked until Lorenzo hears Elia's photo line.
  await face(page, 'npc_omar');
  await talk(page, 'npc_omar', 'omar_mountain');
  await face(page, 'npc_omar');
  await talk(page, 'npc_omar', 'omar_mountain');

  await face(page, 'npc_elia');
  await talk(page, 'npc_elia', 'elia_rest');
  await face(page, 'npc_elia');
  await talk(page, 'npc_elia', 'elia_photos');
  await expect.poll(async () => (await state(page)).story.flags).toContain('elia_cover_introduced');

  await face(page, 'npc_omar');
  await talk(page, 'npc_omar', 'omar_watcher');
  await page.evaluate(() => (window as unknown as { __game: { advance: (seconds: number) => void } }).__game.advance(10));
  await expect(page).toHaveURL(/\?chapter=2$/, { timeout: 60_000 });
  await expectNoProblems(problems);
});

test('Day 2: real keyboard route reaches Elia balcony', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => sessionStorage.setItem('ov-prologue-complete', '1'));
  await waitForGame(page, '/?day=2');
  await startPlay(page);
  await expect(page.locator('#overlay')).toBeHidden();
  const walkToward = async (x: number, z: number, targetY = -Infinity) => {
    await page.keyboard.down('KeyW');
    let result;
    try {
      // Batch the normal fixed-step simulation in the page. W remains a real keyboard input;
      // only the test clock is advanced, so collisions and stair height checks still run.
      result = await page.evaluate(({ x, z, targetY }) => {
        const g = (window as unknown as { __game: { look: (yaw: number, pitch: number) => void; advance: (seconds: number) => void; state: () => { pos: { x: number; y: number; z: number } } } }).__game;
        let s = g.state();
        for (let i = 0; i < 500; i++) {
          if ((Number.isFinite(targetY) && s.pos.y > targetY) || Math.hypot(s.pos.x - x, s.pos.z - z) < 1.0) break;
          g.look(Math.atan2(-(x - s.pos.x), -(z - s.pos.z)), -0.03);
          g.advance(0.12);
          const next = g.state();
          if (Math.hypot(next.pos.x - s.pos.x, next.pos.z - s.pos.z) < 0.015 && i > 12) break;
          s = next;
        }
        return s.pos;
      }, { x, z, targetY });
    } finally { await page.keyboard.up('KeyW'); }
    const reached = (Number.isFinite(targetY) && result.y > targetY) || Math.hypot(result.x - x, result.z - z) < 1.0;
    expect(reached, `walkToward blocked at ${JSON.stringify(result)} while heading for (${x}, ${z})`).toBe(true);
  };
  // The graveyard wall runs west from x=-0.5 to x=-20; go around its west end
  // and the police post before crossing the square toward the café stairs.
  await walkToward(-22.0, 21.5);
  await walkToward(-22.0, 56);
  await walkToward(9.8, 54.8);
  await walkToward(9.8, 59.8, 2.5);
  const reached = await page.evaluate(() => {
    const g = (window as unknown as { __game: { state: () => { pos: { x: number; y: number; z: number }; npc: string | null } } }).__game.state();
    return { pos: g.pos, npc: g.npc };
  });
  expect(reached.pos.y).toBeGreaterThan(2.5);
  expect(reached.pos.x).toBeGreaterThan(7);
  expect(reached.pos.x).toBeLessThan(13);
});
