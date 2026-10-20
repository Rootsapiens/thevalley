import { test, expect, type Page } from '@playwright/test';
import { watchPage, expectNoProblems, waitForGame } from './helpers';

interface Actor { id: string; x: number; y: number; z: number; seated: boolean; cuffed: boolean }
interface Usable { id: string; open: number; solid: boolean }
interface GameState { npc: string | null; talked: { npc: string; line: string }[]; story: { flags: string[]; medicalCheckComplete: boolean } }
type Game = {
  npcs: () => Actor[];
  usables: () => Usable[];
  teleport: (x: number, y: number, z: number) => void;
  look: (yaw: number, pitch: number) => void;
  advance: (seconds: number) => void;
  state: () => GameState;
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __game: Game }).__game.state());

async function face(page: Page, id: string) {
  await page.evaluate(id => {
    const g = (window as unknown as { __game: Game }).__game;
    const actor = g.npcs().find(candidate => candidate.id === id)!;
    const x = actor.x - 2, z = actor.z, y = actor.y;
    g.teleport(x, y + 0.01, z);
    const chest = actor.y + (actor.seated ? 0.9 : 1.3);
    g.look(Math.atan2(-(actor.x - x), -(actor.z - z)), Math.atan2(chest - (y + 1.64), 2));
  }, id);
  await expect.poll(async () => (await state(page)).npc).toBe(id);
}

async function talk(page: Page, id: string, line: string) {
  const before = (await state(page)).talked.length;
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await state(page)).talked.length).toBeGreaterThan(before);
  await expect.poll(async () => (await state(page)).talked.at(-1)).toMatchObject({ npc: id, line });
}

test('Chapter 1: objectives follow farmer and Maryam story beats', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = watchPage(page);
  await page.addInitScript(() => sessionStorage.setItem('ov-prologue-complete', '1'));
  await waitForGame(page, '/?day=1');
  await page.locator('#single-player').click();

  await expect(page.locator('#story-objective')).toBeVisible();
  await expect(page.locator('#objective-en')).toHaveText('Investigate the farm and speak with the farmer');

  await face(page, 'npc_farmer');
  await talk(page, 'npc_farmer', 'farmer_light');
  await expect(page.locator('#objective-en')).toHaveText('Find Maryam at her home');

  await face(page, 'npc_maryam');
  await talk(page, 'npc_maryam', 'maryam_door');
  await expect(page.locator('#objective-en')).toHaveText('Wait, then ask Maryam again');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(8.2));
  await expect(page.locator('#objective-en')).toHaveText('Ask Maryam whether Joseph has returned');

  await face(page, 'npc_maryam');
  await talk(page, 'npc_maryam', 'maryam_confirmed_missing');
  await expect(page.locator('#objective-en')).toHaveText('Follow Maryam to the square');
  await expect.poll(async () => (await state(page)).talked.at(-1)?.line).toBe('maryam_confirmed_missing');
  // Her story action must open the gate through the normal door entity, not leave a closed collider in place.
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __game: Game }).__game.usables().find(u => u.id === 'gate-maryam')!.solid)).toBe(false);
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(1));
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __game: Game }).__game.usables().find(u => u.id === 'gate-maryam')!.open)).toBe(1);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.teleport(0, 0, 0); // leave her route clear so the NPC follows it on the fixed clock
    g.advance(130);
  });
  await expect.poll(async () => (await state(page)).story.flags).toContain('maryam_reached_square');
  const maryam = await page.evaluate(() => (window as unknown as { __game: Game }).__game.npcs().find(actor => actor.id === 'npc_maryam'));
  expect(Math.hypot(maryam!.x - 43.5, maryam!.z - 43.0)).toBeLessThan(0.1);
  await expect(page.locator('#objective-en')).toHaveText('Talk to Omar at the police post');

  await face(page, 'npc_omar');
  expect((await page.evaluate(() => (window as unknown as { __game: Game }).__game.npcs().find(actor => actor.id === 'npc_omar')!)).cuffed).toBe(true);
  await talk(page, 'npc_omar', 'omar_mountain');
  await expect(page.locator('#objective-en')).toHaveText('Wait for the guarded medical check to finish');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(15));
  await expect.poll(async () => (await state(page)).story.medicalCheckComplete).toBe(true);
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __game: Game }).__game.npcs().find(actor => actor.id === 'npc_omar')!.cuffed)).toBe(false);
  await expect(page.locator('#objective-en')).toHaveText('Speak to Moreno about Omar');

  await face(page, 'npc_moreno');
  await talk(page, 'npc_moreno', 'moreno_reporter');
  await face(page, 'npc_moreno');
  await talk(page, 'npc_moreno', 'moreno_said');
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.advance(10));
  await expect(page).toHaveURL(/\?day=2$/, { timeout: 60_000 });
  await expect(page.locator('#objective-en')).toHaveText("Meet Elia. Moreno assigned her to pose as Omar's girlfriend.");
  await expectNoProblems(problems);
});
