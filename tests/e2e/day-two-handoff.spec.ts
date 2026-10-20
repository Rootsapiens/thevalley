import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame } from './helpers';
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
